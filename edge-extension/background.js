// background.js — Service Worker：抓取图片字节、调用 epub.js 打包、推送到后端 /api/send 或下载。
import { makeEpub } from "./epub.js";

const MAX_IMAGES = 30;

function notify(msg) {
  try { chrome.runtime.sendMessage(msg); } catch (e) { /* 弹窗已关，忽略 */ }
}

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fetchImageBytes(url) {
  try {
    if (url.startsWith("data:")) {
      const m = url.match(/^data:(.*?);base64,(.*)$/);
      if (!m) return null;
      const mime = m[1];
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ext: mime.indexOf("png") >= 0 ? "png" : "jpg", bytes };
    }
    const r = await fetch(url, { credentials: "include", mode: "cors" });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "";
    const ext = ct.indexOf("png") >= 0 ? "png" : "jpg";
    return { ext, bytes: new Uint8Array(buf) };
  } catch (e) {
    return null;
  }
}

async function packAndSend(msg) {
  try {
    const blocks = msg.content.blocks || [];
    const imgBlocks = blocks.filter((b) => b.type === "img").slice(0, MAX_IMAGES);
    notify({ type: "PROGRESS", text: "正在抓取图片（" + imgBlocks.length + " 张）…" });

    let ok = 0, fail = 0;
    await Promise.all(imgBlocks.map(async (b) => {
      const r = await fetchImageBytes(b.src);
      if (r) { b.ext = r.ext; b.bytes = r.bytes; ok++; }
      else { b._skip = true; fail++; }
    }));
    const finalBlocks = blocks.filter((b) => !(b.type === "img" && b._skip));

    notify({ type: "PROGRESS", text: "图片完成（成功 " + ok + "，跳过 " + fail + "），正在生成 EPUB…" });
    const epub = makeEpub(msg.content.title || chrome.i18n.getMessage("web_default"), finalBlocks);

    // 打包完成：把 EPUB 字节回传 popup，由 popup 负责下载 / 调起系统分享（避免 SW 里的受限 API）。
    notify({ type: "PACKED", epub, title: msg.content.title || chrome.i18n.getMessage("web_default"), ok, fail });
  } catch (e) {
    notify({ type: "ERROR", message: (e && e.message) ? e.message : String(e) });
  }
}

// 由 content script 委托抓取图片字节：background 上下文不受 CORS 限制（已声明 host_permissions: <all_urls>），
// 可绕过知乎/小红书等图床的跨域限制；并自动附带 Referer 以过防盗链。
async function fetchImgInBg(url, referer) {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return { ok: false };
    const mime = m[1];
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { ok: true, ext: mime.indexOf("png") >= 0 ? "png" : "jpg", b64: m[2] };
  }
  const tries = [];
  if (referer) tries.push({ referrer: referer, credentials: "omit" });
  tries.push({ credentials: "omit" });
  for (const opts of tries) {
    // 8s 超时：部分图床（如 MSN 的 CDN）会对无有效 Referer 的请求挂起不响应，
    // 无超时会拖死整个 Promise.all —— 超时即放弃、换下一策略或跳过。
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      const ct = r.headers.get("content-type") || "";
      const ext = ct.indexOf("png") >= 0 ? "png" : "jpg";
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return { ok: true, ext, b64: btoa(bin) };
    } catch (e) { /* 超时/网络失败，尝试下一种策略 */ }
    finally { clearTimeout(timer); }
  }
  return { ok: false };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "PACK_SEND") {
    packAndSend(msg);
    return false; // 进度通过 sendMessage 单独回报
  }
  if (msg && msg.type === "XHS_FETCH_IMG") {
    fetchImgInBg(msg.url, msg.referer)
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // 异步 sendResponse，需保持消息通道打开
  }
  if (msg && msg.type === "XHS_PROXY") {
    // 由 content script 委托发起任意 HTTP 请求（用于把 EPUB 发到用户后端），
    // background 上下文不受 CORS 限制。90s 超时（SCF Web 函数默认超时 + 余量）。
    (async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 90000);
      try {
        const r = await fetch(msg.url, {
          method: msg.method || "POST",
          headers: msg.headers || {},
          body: msg.body,
          signal: ctl.signal,
        });
        const text = await r.text();
        sendResponse({ ok: r.ok, status: r.status, text: text });
      } catch (e) {
        // 网络层失败（DNS/超时/断网）：带 status:0 与真实错误文本回传，
        // 避免 content 端拼出 "HTTP undefined" 把根因吞掉。
        sendResponse({ ok: false, status: 0, text: "网络错误：" + ((e && e.message) || String(e)) });
      } finally { clearTimeout(timer); }
    })();
    return true;
  }
});

// ===== 右键 / 长按菜单（移动端 Edge 主要入口，桌面端也更顺手）=====
const XHS_MENU_ITEMS = [
  { id: "xhs_send",  title: chrome.i18n.getMessage("menu_send"),  mode: "send",     img: true },
  { id: "xhs_img",   title: chrome.i18n.getMessage("menu_img"),   mode: "download", img: true },
  { id: "xhs_text",  title: chrome.i18n.getMessage("menu_text"),  mode: "download", img: false },
  { id: "xhs_share", title: chrome.i18n.getMessage("menu_share"), mode: "share",    img: true },
];
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    XHS_MENU_ITEMS.forEach((m) => {
      chrome.contextMenus.create({ id: m.id, title: m.title, contexts: ["page", "selection"] });
    });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const item = XHS_MENU_ITEMS.find((m) => m.id === info.menuItemId);
  if (!item || !tab || !tab.id) return;
  chrome.storage.local.get(["backend", "smtpUser", "smtpPass", "kindleEmail"], (s) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "XHS_BUILD",
      mode: item.mode,
      includeImages: item.img,
      kindleEmail: s.kindleEmail || "",
      backend: s.backend || "",
      smtpUser: s.smtpUser || "",
      smtpPass: s.smtpPass || "",
    });
  });
});
