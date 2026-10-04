// popup.js — 工具栏弹窗：收集参数、把"生成+下载/分享"指令发给页面里的 content script。
// 弹窗文案为内置双语字典（默认中文），右上角「EN/中」按钮手动切换并记住选择；
// 商店名称/描述/右键菜单仍走 chrome.i18n（_locales/）。

const PRESET_KINDLE = "";
const i18n = (k, s) => (chrome.i18n && chrome.i18n.getMessage) ? chrome.i18n.getMessage(k, s) : k;

// —— 内置双语字典（弹窗 UI）——
const I18N = {
  zh: {
    popup_title: "网页转 Kindle",
    reading: "读取中…",
    cfg_title: "① 填写并保存配置（长期保存，下次免填）",
    btn_save: "保存配置",
    save_auto: "填写过程中已自动保存 ✓",
    save_saved: "✓ 配置已保存，可直接发送",
    save_ok: "配置已保存 ✓ 以后直接点发送即可",
    lbl_backend: "后端地址",
    ph_backend: "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com",
    lbl_smtpUser: "信任邮箱（发件 / SMTP 账号）",
    ph_smtpUser: "123456@qq.com",
    lbl_smtpPass: "邮箱授权码（非登录密码）",
    ph_smtpPass: "在邮箱设置里获取授权码",
    lbl_kindle: "亚马逊 Kindle 邮箱（收件人）",
    ph_kindle: "你的推送邮箱@kindle.cn",
    btn_send: "生成并发送到 Kindle",
    btn_img: "图文下载",
    btn_text: "纯文字下载",
    btn_share: "生成并分享到邮箱",
    tip_text: "本地生成 EPUB；点「发送到 Kindle」会由后端用信任邮箱把 EPUB 作为附件发到亚马逊（已内置免费共享后端，也可换成你自己的后端）。\n首次：把信任邮箱加入 Amazon「认可发件人」；QQ/163 等需在邮箱设置开启 SMTP 并获取授权码（不是登录密码）。\n授权码仅存于本机扩展配置，不会上传。",
    no_title: "(无标题)",
    prog_share: "正在生成并分享",
    prog_send: "正在生成并发送",
    prog_download: "正在生成并下载",
    suffix_img: "（图文）…",
    suffix_text: "（纯文字）…",
    err_no_tab: "找不到当前标签页",
    err_no_backend: "请先填后端地址（已内置默认免费后端，留空即用）",
    err_missing_fields: "请填齐：信任邮箱、授权码、Kindle 邮箱",
    err_prefix: "出错：$1",
    err_comm: "无法与页面通信：$1（请刷新当前页面，或在扩展管理里重载本扩展后再试）"
  },
  en: {
    popup_title: "Web to Kindle",
    reading: "Reading…",
    cfg_title: "① Fill & save your config (saved for next time)",
    btn_save: "Save config",
    save_auto: "Auto-saved as you type ✓",
    save_saved: "✓ Config saved, ready to send",
    save_ok: "Config saved ✓ just tap Send",
    lbl_backend: "Backend URL",
    ph_backend: "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com",
    lbl_smtpUser: "From email (SMTP account)",
    ph_smtpUser: "123456@qq.com",
    lbl_smtpPass: "Email auth code (not login password)",
    ph_smtpPass: "Get the auth code in your email settings",
    lbl_kindle: "Amazon Kindle email (recipient)",
    ph_kindle: "your-push@kindle.cn",
    btn_send: "Generate & Send to Kindle",
    btn_img: "Download (with images)",
    btn_text: "Download (text only)",
    btn_share: "Generate & Share via Email",
    tip_text: "EPUB is generated locally; \"Send to Kindle\" uses a backend to email the EPUB as an attachment to Amazon (a free shared backend is pre-filled; you can also use your own backend).\nFirst time: add your from-email to Amazon \"Approved senders\"; QQ/163 etc. need SMTP enabled with an auth code (not your login password).\nThe auth code is stored only in this extension's local config.",
    no_title: "(Untitled)",
    prog_share: "Generating & sharing",
    prog_send: "Generating & sending",
    prog_download: "Generating & downloading",
    suffix_img: " (with images)…",
    suffix_text: " (text only)…",
    err_no_tab: "No active tab found",
    err_no_backend: "Enter a backend URL (a free default is pre-filled; clear it to use the default)",
    err_missing_fields: "Fill all fields: from-email, auth code, Kindle email",
    err_prefix: "Error: $1",
    err_comm: "Cannot talk to the page: $1 (reload the page or reload this extension, then retry)"
  }
};
let LANG = "zh";
const T = (k, s) => {
  let m = (I18N[LANG] && I18N[LANG][k]) || I18N.zh[k] || k;
  if (s) (Array.isArray(s) ? s : [s]).forEach(function (v, i) { m = m.replace("$" + (i + 1), v); });
  return m;
};

function $(id) { return document.getElementById(id); }

function setStatus(msg, kind) {
  var el = $("status");
  el.textContent = msg;
  el.className = "status show " + (kind || "info");
}
function resetButtons() {
  $("share").disabled = false;
  $("downloadImg").disabled = false;
  $("downloadText").disabled = false;
  var s = $("send"); if (s) s.disabled = false;
}

// 保存配置到 chrome.storage.local；strong=true 时额外弹出成功提示
function saveConfig(strong) {
  var backend = $("backend").value.trim().replace(/\/+$/, "");
  if (backend && !/^https?:\/\//i.test(backend)) backend = "https://" + backend;
  var smtpUser = $("smtpUser").value.trim();
  var smtpPass = $("smtpPass").value;
  var kindle = $("kindle").value.trim();
  chrome.storage.local.set({ backend: backend, smtpUser: smtpUser, smtpPass: smtpPass, kindleEmail: kindle });
  var hint = $("saveHint");
  if (hint) { hint.style.display = "block"; hint.textContent = T("save_auto"); }
  if (strong) setStatus(T("save_ok"), "ok");
}

function applyLang(lang) {
  LANG = (lang === "en") ? "en" : "zh";
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var k = el.getAttribute("data-i18n");
    if (I18N[LANG][k] != null) el.textContent = I18N[LANG][k];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    var k = el.getAttribute("data-i18n-ph");
    if (I18N[LANG][k] != null) el.placeholder = I18N[LANG][k];
  });
  var lt = $("langToggle");
  if (lt) { lt.textContent = LANG === "zh" ? "EN" : "中"; lt.title = LANG === "zh" ? "Switch to English" : "切换到中文"; }
  // 语言切换后重画标题（若已读取到）
  if (window._pageTitleText != null) $("pageTitle").textContent = window._pageTitleText || T("no_title");
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get(["backend", "smtpUser", "smtpPass", "kindleEmail", "ui_lang"], function (s) {
    applyLang(s.ui_lang || "zh"); // 默认中文
    $("backend").value = s.backend || "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com";
    $("smtpUser").value = s.smtpUser || "";
    $("smtpPass").value = s.smtpPass || "";
    $("kindle").value = s.kindleEmail || PRESET_KINDLE;
    // 已配置过时，直接提示"已保存"，让用户安心
    var hint = $("saveHint");
    if (hint && (s.backend || s.smtpUser || s.smtpPass || s.kindleEmail)) {
      hint.style.display = "block";
      hint.textContent = T("save_saved");
    }
  });
  $("langToggle").addEventListener("click", function () {
    var next = LANG === "zh" ? "en" : "zh";
    chrome.storage.local.set({ ui_lang: next });
    applyLang(next);
  });
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var t = tabs[0];
    if (t) {
      window._pageTitleText = t.title || "";
      $("pageTitle").textContent = t.title || T("no_title");
      window._tabId = t.id;
    }
  });

  // 监听 content script 回传的进度与结果
  chrome.runtime.onMessage.addListener(function (m) {
    if (m.type === "XHS_PROGRESS") setStatus(m.text, "info");
    else if (m.type === "XHS_DONE") { setStatus(m.message, m.ok ? "ok" : "err"); resetButtons(); }
    else if (m.type === "XHS_ERROR") { setStatus(T("err_prefix", m.message), "err"); resetButtons(); }
  });

  $("downloadImg").addEventListener("click", function () { doAction("download", true); });
  $("downloadText").addEventListener("click", function () { doAction("download", false); });
  $("share").addEventListener("click", function () { doAction("share", true); });
  $("send").addEventListener("click", function () { doAction("send", true); });
  // 显式「保存配置」按钮
  $("saveCfg").addEventListener("click", function () { saveConfig(true); });
  // 输入框随手输入即自动保存，避免"填了没点按钮就关掉"导致丢失
  ["backend", "smtpUser", "smtpPass", "kindle"].forEach(function (id) {
    $(id).addEventListener("input", function () { saveConfig(false); });
  });
});

function doAction(mode, includeImages) {
  var backend = $("backend").value.trim().replace(/\/+$/, "");
  if (backend && !/^https?:\/\//i.test(backend)) backend = "https://" + backend;
  var smtpUser = $("smtpUser").value.trim();
  var smtpPass = $("smtpPass").value;
  var kindle = $("kindle").value.trim();
  chrome.storage.local.set({ backend: backend, smtpUser: smtpUser, smtpPass: smtpPass, kindleEmail: kindle });
  if (!window._tabId) { setStatus(T("err_no_tab"), "err"); return; }
  $("share").disabled = true;
  $("downloadImg").disabled = true;
  $("downloadText").disabled = true;
  var se = $("send"); if (se) se.disabled = true;

  var msg = { type: "XHS_BUILD", mode: mode, includeImages: includeImages, kindleEmail: kindle };
  if (mode === "send") {
    if (!backend) { setStatus(T("err_no_backend"), "err"); resetButtons(); return; }
    if (!smtpUser || !smtpPass || !kindle) { setStatus(T("err_missing_fields"), "err"); resetButtons(); return; }
    msg.backend = backend;
    msg.smtpUser = smtpUser;
    msg.smtpPass = smtpPass;
  }
  var verb = mode === "share" ? T("prog_share") : mode === "send" ? T("prog_send") : T("prog_download");
  var suff = includeImages ? T("suffix_img") : T("suffix_text");
  setStatus(verb + suff, "info");

  chrome.tabs.sendMessage(
    window._tabId,
    msg,
    function (resp) {
      if (chrome.runtime.lastError) {
        setStatus(T("err_comm", chrome.runtime.lastError.message), "err");
        resetButtons();
      }
    }
  );
}
