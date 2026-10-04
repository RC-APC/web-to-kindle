// content.js — 注入到当前网页（content script，隔离世界）。
// 负责：提取正文 → 抓取图片字节 → 本地生成 EPUB → 在【当前页面上下文】下载/分享。
// 关键点：下载在用户正在浏览的真实页面里用 <a download> 触发，是浏览器最信任的下载上下文，
//         桌面 Chrome / 移动端 Edge·Kiwi 都可靠，不再依赖 chrome.downloads 或 popup 生命周期。

(function () {
  "use strict";

  // ===== EPUB 生成（复制自 epub.js，去掉 ESM export，纯函数）=====
  function _buildCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }
  const CRC_TABLE = _buildCrcTable();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function strToBytes(s) { return new TextEncoder().encode(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function buildZipFixed(files) {
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const nameBytes = strToBytes(f.name);
      const data = f.data, crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      chunks.push(local); chunks.push(data);
      const cen = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true); cv.setUint32(42, f.offsetStart, true);
      cen.set(nameBytes, 46);
      central.push(cen);
      offset += local.length + data.length;
    }
    const cdStart = offset;
    for (const c of central) { chunks.push(c); offset += c.length; }
    const cdSize = offset - cdStart;
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, cdStart, true);
    ev.setUint16(20, 0, true);
    chunks.push(end);
    const total = chunks.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const a of chunks) { out.set(a, p); p += a.length; }
    return out;
  }
  const CONTAINER = strToBytes(
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );
  function makeEpub(title, blocks) {
    const tEsc = esc(title || "网页");
    const bodyParts = [];
    let manifestItems = "";
    let imgIndex = 0;
    const imgFiles = [];
    for (const b of (blocks || [])) {
      if (b.type === "h") bodyParts.push("<h2>" + esc(b.text) + "</h2>");
      else if (b.type === "p") bodyParts.push("<p>" + esc(b.text || "") + "</p>");
      else if (b.type === "img" && b.bytes) {
        const ext = (b.ext === "png") ? "png" : "jpg";
        const href = "images/img" + imgIndex + "." + ext;
        bodyParts.push('<img src="' + href + '" alt="图' + (imgIndex + 1) + '"/>');
        manifestItems += '<item id="img' + imgIndex + '" href="' + href +
          '" media-type="image/' + (ext === "png" ? "png" : "jpeg") + '"/>\n';
        imgFiles.push({ name: "OEBPS/" + href, data: b.bytes });
        imgIndex++;
      }
    }
    const html = strToBytes(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">' +
      '<head><meta charset="utf-8"/><title>' + tEsc + '</title></head><body>' +
      "<h1>" + tEsc + "</h1>\n" + bodyParts.join("\n") + "\n</body></html>"
    );
    const opf = strToBytes(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">\n' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '<dc:identifier id="bookid">urn:uuid:web2kindle</dc:identifier>\n' +
      "<dc:title>" + tEsc + "</dc:title>\n<dc:language>zh</dc:language>\n" +
      '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>\n</metadata>\n' +
      '<manifest>\n<item id="nav" href="text.html" media-type="application/xhtml+xml"/>\n' +
      manifestItems + "</manifest>\n<spine><itemref idref=\"nav\"/></spine>\n</package>"
    );
    const files = [
      { name: "mimetype", data: strToBytes("application/epub+zip") },
      { name: "META-INF/container.xml", data: CONTAINER },
      { name: "OEBPS/content.opf", data: opf },
      { name: "OEBPS/text.html", data: html }
    ].concat(imgFiles);
    let off = 0;
    for (const f of files) { f.offsetStart = off; off += 30 + strToBytes(f.name).length + f.data.length; }
    return buildZipFixed(files);
  }

  // 把相对 URL 解析为绝对 URL；pickImgUrl / extractContent 共用。
  function resolve(u) {
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  }

  // 从 <img> 解析真实图片地址。
  // 重点：懒加载图常把真实地址放 data-original/data-src/data-actualsrc/data-srcset，
  //       而 src 只是一个 1x1 的 data: 占位图 —— 必须跳过 data: 占位，优先取原图地址。
  function pickImgUrl(el) {
    function firstSrcset(v) {
      const parts = String(v).split(",").map(function (s) {
        return s.trim().split(/\s+/)[0];
      }).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null; // 取最大尺寸那张
    }
    const order = ["data-original", "data-src", "data-actualsrc", "data-srcset", "srcset", "src"];
    for (let i = 0; i < order.length; i++) {
      let v = el.getAttribute(order[i]);
      if (!v) continue;
      v = String(v).trim();
      if (/^data:/.test(v)) continue; // 跳过 data: 占位图
      if (order[i].indexOf("srcset") >= 0) v = firstSrcset(v);
      if (v && !/^data:/.test(v)) return resolve(v);
    }
    return null;
  }

  // ===== 提取正文（在页面上下文执行）=====
  const MAX_BLOCKS = 2500; // 巨型 SPA（MSN 等）防护：块数封顶，避免遍历/生成 EPUB 卡死
  const IS_WEIXIN = /weixin\.(qq|sogou)\.com$/i.test(location.hostname); // 微信公众号文章（含搜狗镜像）
  function extractContent() {
    function pick() {
      // 微信公众号文章：正文在 #js_content，比 .rich_media_content 更干净（不含文末二维码/在看）
      if (IS_WEIXIN) {
        const js = document.getElementById("js_content");
        if (js) return js;
      }
      return document.querySelector("article") ||
        document.querySelector('[role="main"]') ||
        document.querySelector(".article-body, .post-content, .article-content, .article, .content, #article, .rich_media_content");
    }
    const root = pick() || document.body;
    const blocks = [];
    (function walk(node) {
      if (blocks.length >= MAX_BLOCKS) return;
      for (let i = 0; i < node.childNodes.length; i++) {
        if (blocks.length >= MAX_BLOCKS) return;
        const c = node.childNodes[i];
        if (c.nodeType === 3) {
          const t = c.textContent.replace(/\s+/g, " ").trim();
          if (t.length > 1) blocks.push({ type: "p", text: t });
        } else if (c.nodeType === 1) {
          const tag = c.tagName.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "nav" || tag === "header" ||
            tag === "footer" || tag === "aside" || tag === "noscript") continue;
          if (tag === "img") {
            const url = pickImgUrl(c);
            if (url) blocks.push({ type: "img", src: url });
            continue;
          }
          if (tag === "h1" || tag === "h2" || tag === "h3") {
            const ht = c.textContent.replace(/\s+/g, " ").trim();
            if (ht) blocks.push({ type: "h", text: ht });
            continue;
          }
          if (tag === "li") {
            const lt = c.textContent.replace(/\s+/g, " ").trim();
            if (lt) blocks.push({ type: "p", text: "• " + lt });
            continue;
          }
          if (tag === "br") continue;
          walk(c);
        }
      }
    })(root);
    return { title: document.title || location.hostname, blocks: blocks };
  }

  // ===== 抓取图片字节：委托 background service worker 抓（其上下文不受 CORS 限制）=====
  // content script 直接 fetch 跨域图会被 CORS 拦截，故转交 background；background 已声明 <all_urls> host 权限。
  const FETCH_TIMEOUT_MS = 12000; // 单图抓取总超时：background 挂起/通道丢失时跳过该图，绝不让 Promise.all 卡死
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
  }
  function fetchImageBytes(url) {
    return new Promise(function (resolve) {
      if (!url || (!/^https?:/.test(url) && !url.startsWith("data:"))) { resolve(null); return; }
      if (url.startsWith("data:")) {
        const m = url.match(/^data:(.*?);base64,(.*)$/);
        if (!m) { resolve(null); return; }
        const mime = m[1], bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve({ ext: mime.indexOf("png") >= 0 ? "png" : "jpg", bytes });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "XHS_FETCH_IMG", url: url, referer: IS_WEIXIN ? location.href : location.origin },
          function (resp) {
            if (chrome.runtime.lastError || !resp || !resp.ok) { resolve(null); return; }
            const bin = atob(resp.b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            resolve({ ext: resp.ext || "jpg", bytes });
          }
        );
      } catch (e) { resolve(null); }
    });
  }

  function safeName(title) {
    return ((title || "web").replace(/[\\/:*?"<>|]/g, "_")).slice(0, 60) + ".epub";
  }

  // ===== 图片压缩：大图重编码为 JPEG（最长边 1568 / 质量 0.72）=====
  // 背景：后端走腾讯云 SCF 函数 URL，平台限制请求体约 6MB；EPUB base64 后塞进 JSON，
  //       因此 EPUB 原始体积须控制在 ~4.5MB 以内，多图页面不压缩必超限（RequestTooLarge）。
  const IMG_COMPRESS_OVER = 300 * 1024; // 超过 300KB 才压（小图标/截图保持原样）
  const IMG_MAX_DIM = 1568;             // Kindle 300ppi 屏幕已足够清晰
  const IMG_JPEG_Q = 0.72;
  async function compressImage(r) {
    if (!r || !r.bytes || r.bytes.length <= IMG_COMPRESS_OVER) return r;
    try {
      if (typeof createImageBitmap === "undefined") return r;
      const blob = new Blob([r.bytes], { type: r.ext === "png" ? "image/png" : "image/jpeg" });
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, IMG_MAX_DIM / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      const out = await new Promise(function (res) { cv.toBlob(res, "image/jpeg", IMG_JPEG_Q); });
      cv.width = 0; cv.height = 0; // 立即释放画布内存
      if (!out || !out.size || out.size >= r.bytes.length) return r; // 压不小就保留原图
      return { ext: "jpg", bytes: new Uint8Array(await out.arrayBuffer()) };
    } catch (e) { return r; }
  }

  // ===== 在【当前页面】下载（最可靠）=====
  function triggerDownload(epubBytes, filename) {
    const blob = new Blob([epubBytes], { type: "application/epub+zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }

  // ===== 分享（页面上下文 navigator.share，带文件）=====
  async function shareEpub(epubBytes, title, kindleEmail) {
    try {
      const file = new File([epubBytes], safeName(title), { type: "application/epub+zip" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title || _i("web_default"), text: _i("share_text") });
        return true;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return true;
    }
    // 降级：页面内下载 + 打开 mailto
    triggerDownload(epubBytes, safeName(title));
    const to = kindleEmail || "";
    const mailto = "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent(_i("share_subject", title || _i("web_default"))) +
      "&body=" + encodeURIComponent(_i("mail_body"));
    location.href = mailto;
    return false;
  }

  const _i = (k, s) => (chrome.i18n && chrome.i18n.getMessage) ? chrome.i18n.getMessage(k, s) : k;
  function post(m) { try { chrome.runtime.sendMessage(m); } catch (e) { /* popup 未开 */ } }

  function bytesToBase64(bytes) {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // 规范化后端地址：容错用户手输（缺 scheme、首尾空格、结尾斜杠）。
  function normalizeBackend(url) {
    let u = (url || "").trim().replace(/\/+$/, "");
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }

  // 直连后端（备用路径）：后端已开 CORS(allow_origins=*)，绕过 background 代理。
  // 注意：页面 CSP 可能拦截跨域 fetch，失败则返回 status:-1，由调用方决定提示。
  function directFetch(url, body) {
    const ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 90000) : null;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      signal: ctl ? ctl.signal : undefined,
    }).then(async (r) => {
      const text = await r.text();
      return { ok: r.ok, status: r.status, text: text };
    }).catch((e) => ({ ok: false, status: -1, text: "网络错误：" + ((e && e.message) || String(e)) }))
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  // 把凭据+EPUB 交给后端 /api/send 发送。
  // 主路径：background 代理（不受页面 CORS/CSP 限制）；备用路径：content 直连（后端已开 CORS）。
  // 手机端个别版本的 background SW fetch 不稳定，双路径兜底。
  function postToBackend(payload, backendUrl) {
    const url = normalizeBackend(backendUrl) + "/api/send";
    const body = JSON.stringify(payload);
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          {
            type: "XHS_PROXY",
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body
          },
          async function (resp) {
            if (chrome.runtime.lastError || !resp) {
              // 代理通道不通（SW 未响应等）→ 直接走 content 直连
              resolve(await directFetch(url, body));
              return;
            }
            if (!resp.ok && !resp.status) {
              // 代理 fetch 抛异常（网络/DNS 错误，resp 无 status）→ 直连重试，拿到更真实的错误
              const direct = await directFetch(url, body);
              if (direct.ok) { resolve(direct); return; }
              // 两条路都失败：给出信息量最大的错误文本（不再是 "HTTP undefined"）
              const detail = direct.text || resp.text || resp.error || "网络错误";
              resolve({ ok: false, status: 0, error: String(detail).slice(0, 200) });
              return;
            }
            if (!resp.ok) {
              const errText = resp.text || resp.error || ("HTTP " + resp.status);
              resolve({ ok: false, status: resp.status || 0, error: String(errText).slice(0, 200) });
              return;
            }
            try { resolve({ ok: true, status: resp.status, data: JSON.parse(resp.text) }); }
            catch (e) { resolve({ ok: true, status: resp.status, data: { message: resp.text } }); }
          }
        );
      } catch (e) { resolve({ ok: false, status: 0, error: String(e) }); }
    });
  }

  // 判断是否为「体积过大」类错误：后端 413，或平台层 RequestTooLarge/413/502（请求体超限）
  function isTooLarge(res) {
    if (!res) return false;
    if (res.status === 413) return true;
    const t = (res.error || "") + " " + (res.data && res.data.message ? res.data.message : "");
    return /413|过大|toolarge|too large|payload too large|body.{0,4}large/i.test(t);
  }

  // 在网页内浮层提示（右击 / 移动端无 popup 时也能看到反馈）
  // type: "info"(处理中) | "success"(成功) | "error"(失败)
  let _toastRoot = null;
  function _toastRootEl() {
    if (!_toastRoot) {
      _toastRoot = document.createElement("div");
      _toastRoot.style.cssText =
        "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;" +
        "display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:88vw;";
      (document.body || document.documentElement).appendChild(_toastRoot);
    }
    return _toastRoot;
  }
  function showToast(text, type) {
    try {
      const palette = {
        info:    "background:rgba(34,34,34,.92);",
        success: "background:rgba(22,135,68,.96);",
        error:   "background:rgba(200,45,45,.96);"
      };
      const d = document.createElement("div");
      d.textContent = text;
      d.style.cssText = (palette[type] || palette.info) +
        "color:#fff;padding:10px 14px;border-radius:8px;" +
        "font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:84vw;text-align:center;" +
        "box-shadow:0 2px 12px rgba(0,0,0,.35);opacity:0;transition:opacity .2s ease;";
      _toastRootEl().appendChild(d);
      requestAnimationFrame(function () { d.style.opacity = "1"; });
      const ttl = (type === "error") ? 6000 : 4000;
      setTimeout(function () {
        d.style.opacity = "0";
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 260);
      }, ttl);
    } catch (e) { /* 忽略 */ }
  }

  // 是否开着工具栏 popup：开着时由 popup 自己反馈，避免重复；关着（右击/移动端）才在页面内弹。
  function popupOpen() {
    try {
      return !!(chrome.extension && chrome.extension.getViews &&
        chrome.extension.getViews({ type: "popup" }).length);
    } catch (e) { return false; }
  }
  // 页面内提示（已按 popup 开合做去重）
  function pageNotify(text, type) {
    try { if (popupOpen()) return; } catch (e) { /* 默认弹 */ }
    showToast(text, type);
  }
  // 统一回报：进度走 popup；完成/出错同时回到 popup 并在页面内弹 toast。
  function reportDone(ok, message) {
    post({ type: "XHS_DONE", ok: ok, message: message });
    pageNotify(message, ok ? "success" : "error");
  }
  function reportError(message) {
    post({ type: "XHS_ERROR", message: message });
    pageNotify(message, "error");
  }

  // ===== 预滚动：SPA 懒加载页（MSN/知乎等）图片进入视口才会填真实地址，抓图前先滚一遍 =====
  function scrollLazy() {
    return new Promise(function (done) {
      try {
        const maxScroll = (document.body && document.body.scrollHeight) || 0;
        if (!maxScroll) { done(); return; }
        let y = 0;
        const step = Math.max(600, window.innerHeight || 800);
        const timer = setInterval(function () {
          y += step;
          window.scrollTo(0, y);
          if (y >= maxScroll || y > step * 12) {
            clearInterval(timer);
            window.scrollTo(0, 0); // 滚回顶部再提取
            setTimeout(done, 350);
          }
        }, 200);
      } catch (e) { done(); }
    });
  }

  // ===== 主流程 =====
  // includeImages: true=图文（抓图），false=纯文字（不抓图、不进 EPUB）
  async function run(mode, kindleEmail, includeImages, creds) {
    // 看门狗：整个流程 90s 内必须结束，否则报错，绝不无限卡死
    let watchdog = setTimeout(function () {
      reportDone(false, _i("err_timeout"));
    }, 90000);
    try {
      post({ type: "XHS_PROGRESS", text: _i("prog_read") });
      pageNotify(_i("prog_read"), "info");
      if (includeImages) await scrollLazy();
      const content = extractContent();
      let blocks = content.blocks || [];
      if (!blocks.length) {
        reportDone(false, _i("err_no_content"));
        return;
      }
      let ok = 0, fail = 0;
      if (includeImages) {
        const imgBlocks = blocks.filter((b) => b.type === "img").slice(0, 50);
        post({ type: "XHS_PROGRESS", text: _i("prog_fetch_img", String(imgBlocks.length)) });
        await Promise.all(imgBlocks.map(async (b) => {
          const r = await withTimeout(fetchImageBytes(b.src), FETCH_TIMEOUT_MS);
          if (r) { const c = await compressImage(r); b.ext = c.ext; b.bytes = c.bytes; ok++; }
          else { b._skip = true; fail++; }
        }));
        blocks = blocks.filter((b) => !(b.type === "img" && b._skip));
      } else {
        // 纯文字：剔除所有图片块，只保留标题与段落
        blocks = blocks.filter((b) => b.type !== "img");
      }
      post({ type: "XHS_PROGRESS", text: includeImages
        ? _i("prog_img_done", [String(ok), String(fail)])
        : _i("prog_text_epub") });
      let epub = makeEpub(content.title || _i("web_default"), blocks);

      if (mode === "download") {
        triggerDownload(epub, safeName(content.title));
        reportDone(true, includeImages
          ? _i("done_img_download", String(ok))
          : _i("done_text_download"));
      } else if (mode === "share") {
        const used = await shareEpub(epub, content.title, kindleEmail);
        reportDone(true, used ? _i("done_share") : _i("done_share_fallback"));
      } else if (mode === "send") {
        if (!creds.backend || !creds.smtpUser || !creds.smtpPass || !kindleEmail) {
          const tip = _i("tip_mobile_cfg");
          reportDone(false, tip);
          return;
        }
        post({ type: "XHS_PROGRESS", text: _i("prog_sending") });
        pageNotify(_i("prog_sending"), "info");
        // 体积预算：SCF 平台限制请求体约 6MB，EPUB base64 后须 <4.5MB。
        // 超预算时从最大的图开始逐张剔除重打，尽量保留最多内容。
        if (includeImages) {
          const SEND_BUDGET = 3.5 * 1024 * 1024;
          let guard = 0;
          while (epub.length > SEND_BUDGET && guard++ < 60) {
            let mi = -1, ms = 0;
            for (let i = 0; i < blocks.length; i++) {
              const b = blocks[i];
              if (b.type === "img" && b.bytes && b.bytes.length > ms) { ms = b.bytes.length; mi = i; }
            }
            if (mi < 0) break;
            blocks.splice(mi, 1);
            epub = makeEpub(content.title || _i("web_default"), blocks);
          }
        }
        const payload = {
          smtp_user: creds.smtpUser,
          smtp_password: creds.smtpPass,
          kindle_email: kindleEmail,
          title: content.title || _i("web_default"),
          epub_base64: bytesToBase64(epub)
        };
        let res = await postToBackend(payload, creds.backend);
        // 体积过大（后端 413 或平台 413/502）→ 自动降级为纯文字版重发
        if (!res.ok && isTooLarge(res)) {
          post({ type: "XHS_PROGRESS", text: _i("prog_too_large") });
          const textBlocks = blocks.filter((b) => b.type !== "img");
          const textEpub = makeEpub(content.title || _i("web_default"), textBlocks);
          res = await postToBackend({
            smtp_user: creds.smtpUser,
            smtp_password: creds.smtpPass,
            kindle_email: kindleEmail,
            title: content.title || _i("web_default"),
            epub_base64: bytesToBase64(textEpub)
          }, creds.backend);
          if (res.ok && res.data) {
            reportDone(true, _i("done_too_large"));
            return;
          }
        }
        if (res.ok && res.data) {
          reportDone(true, _i("done_sent", kindleEmail));
        } else {
          reportDone(false, _i("err_send", res.error || _i("unknown_err")));
        }
      }
    } catch (e) {
      reportError((e && e.message) ? e.message : String(e));
    } finally {
      clearTimeout(watchdog);
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "XHS_BUILD") {
      // 默认图文；仅当明确 includeImages===false 时为纯文字
      run(msg.mode || "download", msg.kindleEmail || "", msg.includeImages !== false,
        { backend: msg.backend, smtpUser: msg.smtpUser, smtpPass: msg.smtpPass });
      if (sendResponse) sendResponse({ started: true });
      return true;
    }
  });
})();
