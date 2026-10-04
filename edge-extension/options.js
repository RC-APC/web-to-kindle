// options.js — 独立配置页（桌面/手机均可用，手机 Edge 在扩展详情→设置打开）。
// 与 popup 同款内置双语字典 + 手动切换，默认中文。

const I18N = {
  zh: {
    opt_title: "网页转 Kindle · 设置",
    lbl_backend: "后端地址",
    ph_backend: "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com",
    lbl_smtpUser: "信任邮箱（发件 / SMTP 账号）",
    ph_smtpUser: "123456@qq.com",
    lbl_smtpPass: "邮箱授权码（非登录密码）",
    ph_smtpPass: "在邮箱设置里获取授权码",
    lbl_kindle: "亚马逊 Kindle 邮箱（收件人）",
    ph_kindle: "你的推送邮箱@kindle.cn",
    btn_save: "保存配置",
    opt_tip: "手机 Edge：扩展详情页 → 设置，打开本页填一次即可。配置只存于本机扩展，不会上传开发者；桌面与手机各自独立保存。",
    saved: "已保存 ✓"
  },
  en: {
    opt_title: "Web to Kindle · Settings",
    lbl_backend: "Backend URL",
    ph_backend: "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com",
    lbl_smtpUser: "From email (SMTP account)",
    ph_smtpUser: "123456@qq.com",
    lbl_smtpPass: "Email auth code (not login password)",
    ph_smtpPass: "Get the auth code in your email settings",
    lbl_kindle: "Amazon Kindle email (recipient)",
    ph_kindle: "your-push@kindle.cn",
    btn_save: "Save settings",
    opt_tip: "On Edge mobile: extension details → Settings, open this page and fill once. Settings are stored only in this extension on the device, never uploaded; desktop and mobile keep separate copies.",
    saved: "Saved ✓"
  }
};
let LANG = "zh";

function $(id) { return document.getElementById(id); }
function setStatus(msg, kind) { const el = $("status"); el.textContent = msg; el.className = "status show " + (kind || "info"); }

function applyLang(lang) {
  LANG = (lang === "en") ? "en" : "zh";
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var k = el.getAttribute("data-i18n"); if (I18N[LANG][k] != null) el.textContent = I18N[LANG][k];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    var k = el.getAttribute("data-i18n-ph"); if (I18N[LANG][k] != null) el.placeholder = I18N[LANG][k];
  });
  var lt = $("langToggle");
  if (lt) { lt.textContent = LANG === "zh" ? "EN" : "中"; lt.title = LANG === "zh" ? "Switch to English" : "切换到中文"; }
}

function saveAll() {
  var backend = $("backend").value.trim().replace(/\/+$/, "");
  if (backend && !/^https?:\/\//i.test(backend)) backend = "https://" + backend;
  chrome.storage.local.set({
    backend: backend,
    smtpUser: $("smtpUser").value.trim(),
    smtpPass: $("smtpPass").value,
    kindleEmail: $("kindle").value.trim()
  });
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get(["backend", "smtpUser", "smtpPass", "kindleEmail", "ui_lang"], function (s) {
    applyLang(s.ui_lang || "zh");
    $("backend").value = s.backend || "https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com";
    $("smtpUser").value = s.smtpUser || "";
    $("smtpPass").value = s.smtpPass || "";
    $("kindle").value = s.kindleEmail || "";
    if (s.backend || s.smtpUser || s.smtpPass || s.kindleEmail) setStatus(I18N[LANG].saved, "ok");
  });
  $("langToggle").addEventListener("click", function () {
    var next = LANG === "zh" ? "en" : "zh";
    chrome.storage.local.set({ ui_lang: next });
    applyLang(next);
  });
  // 输入框随手输入即自动保存
  ["backend", "smtpUser", "smtpPass", "kindle"].forEach(function (id) {
    $(id).addEventListener("input", saveAll);
  });
  $("save").addEventListener("click", function () {
    saveAll();
    setStatus(I18N[LANG].saved, "ok");
  });
});
