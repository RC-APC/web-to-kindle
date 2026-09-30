# 网页转 Kindle 推送 · Edge 扩展

简体中文 | [English](README_EN.md)

> 一键把**任意网页**（标题 + 正文 + 图片）排版成 EPUB，发到你的 Kindle。

[![Edge 商店](https://img.shields.io/badge/Edge%20商店-安装-brightgreen)](https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje)

**Edge 商店地址：** https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje

打开任意网页 → 点工具栏按钮 → 本地生成 EPUB →（下载 / 系统分享到邮箱 / 自动 SMTP 推送）到 Kindle。
桌面 Edge / Chrome、移动端 Edge 均可用，无需任何服务器即可工作。

---

## 功能特性

- **任意网页转 EPUB**：提取正文与图片，纯本地生成合法 EPUB（不依赖服务器抓网页）。
- **三种发送方式**：
  - 📥 **仅下载**：在当前页面直接下载 EPUB，自己发。
  - 📤 **分享到邮箱**：调起系统分享面板，把 EPUB 作为附件带进邮件 App（移动端最顺手）。
  - 📧 **自动推送**：内置一个免费共享后端代发 SMTP 邮件，连邮件都不用手动发（也可换成你自建的）。
- **移动端可用**：手机 Edge 无 toolbar popup，通过 `options_page` 单独配置；下载/分享走当前页面上下文，桌面与移动行为一致。
- **开箱即用**：默认已预填一个免费共享后端（腾讯云 SCF），你只需填自己的邮箱授权码 + Kindle 推送邮箱。

---

## 安装

### 方式一：Edge 商店（推荐）
打开 👉 https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje 点「获取」即可。

### 方式二：开发者模式加载源码
1. Edge 地址栏打开 `edge://extensions` → 打开**开发人员模式**。
2. 点「加载解压缩的扩展」→ 选择本仓库的 `edge-extension/` 目录。
3. 固定到工具栏，打开任意网页即可使用。
> Chrome 同理：`chrome://extensions` → 开发者模式 → 加载 `edge-extension/`。

---

## 首次使用

1. 打开网页，点工具栏「网页转 Kindle」按钮。
2. 选模式：
   - **仅下载**：直接得到 EPUB。
   - **分享到邮箱**：调起系统分享，选邮件 App，EPUB 作为附件带上（不支持文件分享时自动降级为「下载 EPUB + 打开邮件草稿」，你手动附上）。
   - **自动推送**：在弹窗/选项页填：
     - 「发件邮箱」+「授权码」（QQ/163 等需在邮箱设置开启 SMTP 并获取**授权码**，不是登录密码）；
     - 「Kindle 推送邮箱」（Amazon「管理我的内容和设备 → 设置 → 发送到 Kindle 邮箱」，形如 `xxx@kindle.cn`）。
3. **重要**：把你的发件邮箱加入 Amazon「个人文档设置 → 认可发件人」，否则邮件会被丢弃。

---

## 后端说明

扩展默认走**本地生成 EPUB + 你自己的邮件客户端**，本就不强依赖后端。
「自动推送」模式需要一个 SMTP 代发后端：

- **默认内置免费共享后端**（已部署于腾讯云 SCF），开箱即用，无需自建。
- **自建后端**（推荐用于更高隐私 / 更大发送量）：见下文「自部署后端」，用自己的腾讯云 SCF 函数，把函数 URL 填进扩展的「后端地址」即可。

> ⚠️ 隐私提示：共享后端会经手你提交的 SMTP 授权码与 EPUB 内容用于代发，**不会留存**；介意的话请自建后端（代码完全开源，一键部署）。授权码仅保存在你本机扩展配置，不会上传到任何第三方。

---

## 自部署后端（腾讯云 SCF · 免费）

后端源码在 `tencent-scf-web/`（零依赖，`stdlib http.server` 监听 `0.0.0.0:9000`），部署包 `kindle-scf-web.zip` 可直接上传。

1. 腾讯云 → 云函数 → **新建「Web 函数」**（不是事件函数）→ 运行环境选 **Python 3.10**。
2. 上传 `kindle-scf-web.zip`（含 `app.py` + `scf_bootstrap`，脚本会自动探测 Python 解释器版本）。
3. 触发管理里拿到公网 `*.ap-guangzhou.tencentscf.com` 函数 URL（无需绑域名、免信用卡）。
4. 把该 URL 填进扩展的「后端地址」即可。

后端接口：
- `POST /api/send`：接收 `{smtp_user, smtp_password, kindle_email, title, epub_base64}`，SMTP 代发。
- `POST /api/probe`：SMTP 连通性分阶段诊断（TCP → banner → TLS → EHLO）。
- 已强制 TLS 1.2 以兼容老邮件服务器，并开放 `Access-Control-Allow-Origin: *` 供扩展直连。

> 实测广州出口 SMTP 覆盖面：163 / 126 / yeah ✅、Outlook / Hotmail ✅、QQ / Foxmail ✅（需 TLS1.2）；Gmail ❌（被 GFW 阻断，不建议）。

---

## 目录结构

```
.
├── edge-extension/         # Edge/Chromium 浏览器扩展（核心）
│   ├── manifest.json       # MV3 清单（含 options_page 移动端配置入口）
│   ├── popup.*             # 工具栏弹窗 UI
│   ├── options.*           # 选项页（移动端唯一配置入口）
│   ├── content.js          # 注入当前网页：提取正文+抓图+生成 EPUB+下载/分享（最稳路径）
│   ├── background.js       # Service Worker
│   ├── epub.js             # 纯 JS 生成合法 EPUB
│   ├── _locales/           # 中/英双语文案
│   ├── icons/              # 图标
│   └── store-assets/       # 商店上架图
├── tencent-scf-web/        # 后端源码（可选自建）
│   ├── app.py              # Web 函数 HTTP 服务（SMTP 代发 + /api/probe）
│   └── scf_bootstrap       # 启动脚本（探测 Python 版本）
├── kindle-scf-web.zip      # 后端部署包（直接上传腾讯云）
├── LICENSE
└── README.md
```

---

## 已知限制

- **图片抓取受 CORS 限制**：content script 在页面内 `fetch` 图片，跨域且目标服务器未开放 CORS 时会失败 → 该图被跳过（EPUB 仍有效）。
- **页面结构千差万别**：正文提取用通用启发式（优先 `article` / `[role=main]` / 常见内容类），个别站点可能多抓导航或少抓正文，后续可加站点适配。
- **`chrome://` 类页面**无法提取（浏览器禁止），属正常。
- 安装时 `host_permissions: ["<all_urls>"]` 会提示"读取所有网站内容"，这是提取网页正文所必需，属个人工具正常权限。
- 自动推送依赖 SMTP 服务商的发送限额；用户量大时建议自建后端或用企业邮箱。

---

## 许可证

[MIT](LICENSE) © 2026 (RC-APC)
