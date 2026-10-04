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
- **微信公众号文章也能发**：在微信里点「… → 在浏览器打开」选 Edge，打开后右键菜单「发送到 Kindle」即可（已针对公众号 `#js_content` 正文与图片防盗链做适配）。

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

## 宣传物料（用于公众号 / 博客等）

想在自己的渠道推广这个扩展？仓库 `promo/` 目录已备好可直接用的物料：

- **`promo/edge-store-qr.png`** — Edge 商店链接的二维码（纠错级别 H），可长按识别 / 嵌进文章。
- **`promo/landing.html`** — 自包含落地页（内嵌二维码、功能介绍、安装按钮），可托管到 GitHub Pages 后作为一个干净、不易被微信拦截的「宣传链接」。
- **`promo/wechat_article_copy.md`** — 一份可直接复制粘贴进公众号文章的宣传文案（含短文案 / 长文案 / 配图建议）。

> 提示：微信对外部链接会做中和页提示，读者需再点一次「继续访问」；用二维码 +「在 Edge 打开」的引导能绕开大部分摩擦。

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

## 如何填写并保存配置（必看）

「自动推送」需要你填 **4 项配置**，这些配置**只保存在你本机**，不会上传到任何第三方。

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| 后端地址 | 代发 SMTP 的后端 URL（默认已填免费共享后端，一般不用改） | `https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com` |
| 信任邮箱 | 你的发件 / SMTP 账号，如 `123456@qq.com` | 空 |
| 邮箱授权码 | 在邮箱设置里获取的**授权码**（**不是登录密码**） | 空 |
| Kindle 邮箱 | 亚马逊「发送至 Kindle」邮箱，形如 `xxx@kindle.cn` | 空 |

### 在哪里填？

- **桌面 Edge / Chrome**：点工具栏「网页转 Kindle」图标 → 弹窗**最上方**就是配置区（红框高亮，标题「① 填写并保存配置」）。
- **手机 Edge**：地址栏输入 `edge://extensions` → 点本扩展的「详细信息」→「扩展选项」，在选项页里填写（手机无 toolbar 弹窗，只能走这里）。

### 怎么保存？（v1.1.6+）

- 配置区下方有醒目的**红色「保存配置」按钮**，点一下即保存，并弹出绿色「✓ 配置已保存」提示。
- 输入框**输入即自动保存**，关掉弹窗也不会丢（彻底避免"填了没保存"）。
- 已保存后再次打开，会显示「✓ 配置已保存，可直接发送」。

> 提示：只有「自动推送」模式需要填这些；「仅下载」「分享到邮箱」两种模式**不需要**后端和授权码，开箱即用。

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

## 微信公众号一键推送（可选）

除浏览器扩展外，仓库还提供一个**公众号后端**：粉丝**关注你的公众号**后，把任意网页 / 公众号文章链接发给公众号，即可自动推送到他绑定的 Kindle。适合把「推送能力」直接做进公众号，无需让用户装扩展。

- 源码：`wechat-kindle/`（零依赖，腾讯云 SCF Web 函数）；部署包：`wechat-kindle.zip`。
- 用户用法（在公众号对话框）：
  1. 绑定：`bind <Kindle邮箱> <发件邮箱> <授权码>`
  2. 之后发送任意 http(s) 链接即可推送；服务端抓取正文（微信文章走 `#js_content`、图片过防盗链）→ 生成 EPUB → SMTP 发信。
- 部署：见 `wechat-kindle/README.md`（新建 Web 函数 → 配置 `WX_TOKEN` 环境变量 → 在公众号后台「服务器配置」填函数 URL 与同一 Token）。

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
├── wechat-kindle/          # 微信公众号一键推送后端（可选）
│   ├── app.py              # 微信消息接入 + 抓取正文 → EPUB → SMTP 发信
│   └── scf_bootstrap       # 启动脚本（探测 Python 版本）
├── wechat-kindle.zip       # 公众号后端部署包（直接上传腾讯云）
├── promo/                  # 宣传物料（二维码 / 落地页 / 公众号文案）
├── README_EN.md            # 英文 README
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
