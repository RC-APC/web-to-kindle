# Web to Kindle · Edge Extension

[简体中文](README.md) | English

> Turn **any web page** (title + body text + images) into an EPUB and send it to your Kindle in one click.

[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-Install-brightgreen)](https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje)

**Edge Add-ons:** https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje

Open any web page → click the toolbar button → an EPUB is generated locally → download it, share it to your mail app, or push it automatically via SMTP. Works on desktop Edge / Chrome and Edge for Android. No server is required for the core flow.

---

## Features

- **Any web page → EPUB**: extracts the body text and images and builds a valid EPUB entirely on your device (no server-side scraping).
- **Three ways to send**:
  - 📥 **Download**: download the EPUB directly from the current page.
  - 📤 **Share to email**: opens the system share sheet and attaches the EPUB to your mail app (handy on mobile).
  - 📧 **Auto push**: a built-in free shared backend sends the SMTP email for you (or bring your own backend).
- **Works on mobile**: Edge for Android has no toolbar popup, so configuration is done on the options page; download/share happen in the current page context, so desktop and mobile behave the same.
- **Works out of the box**: a free shared backend (Tencent Cloud SCF) is pre-filled; you only add your email auth code + Kindle address.

---

## Install

### Option 1: Edge Add-ons (recommended)
Open 👉 https://microsoftedge.microsoft.com/addons/detail/bokmelgompgkjjgplnhpppimabakfcje and click "Get".

### Option 2: Load from source (developer mode)
1. Open `edge://extensions` in Edge → enable **Developer mode**.
2. Click "Load unpacked" → select the `edge-extension/` folder.
3. Pin it to the toolbar; open any page and use it.
> Chrome: `chrome://extensions` → Developer mode → load `edge-extension/`.

---

## Getting started

1. Open a web page and click the "Web to Kindle" toolbar button.
2. Choose a mode:
   - **Download**: you get the EPUB directly.
   - **Share to email**: the system share sheet appears — pick your mail app; the EPUB is attached (if the system can't share files, it falls back to "download EPUB + open a mail draft").
   - **Auto push** — fill in (in the popup / options page):
     - "From email" + "auth code" (QQ/163 etc. require enabling SMTP and using an **auth code**, not your login password);
     - "Kindle address" (Amazon "Manage Your Content and Devices → Preferences → Send to Kindle", e.g. `xxx@kindle.cn`).
3. **Important**: add your from-email to Amazon's "Approved Personal Document E-mail List", otherwise the email is dropped.

---

## How to fill & save the configuration (read this)

"Auto push" needs **4 config fields**. These are **stored only on your device** and are never uploaded.

| Field | What it is | Default |
| --- | --- | --- |
| Backend address | URL of the SMTP relay backend (pre-filled with the free shared backend — usually leave it as-is) | `https://1305482411-6z3u3re2yl.ap-guangzhou.tencentscf.com` |
| From email | your SMTP / sender account, e.g. `123456@qq.com` | empty |
| Auth code | the **app password** from your mailbox settings (**not your login password**) | empty |
| Kindle address | Amazon "Send to Kindle" address, e.g. `xxx@kindle.cn` | empty |

### Where to fill it in

- **Desktop Edge / Chrome**: click the "Web to Kindle" toolbar icon → the config panel is at the **top of the popup** (red border, titled "① Fill & save configuration").
- **Edge for Android**: type `edge://extensions` in the address bar → tap the extension's "Details" → "Extension options" (mobile has no toolbar popup, so this is the only entry).

### How to save it (v1.1.6+)

- There is a prominent **red "Save configuration" button** at the bottom of the panel — click it to save, and a green "✓ Configuration saved" toast appears.
- Fields **auto-save as you type**, so closing the popup won't lose your input.
- Once saved, reopening shows "✓ Configuration saved — ready to send".

> Tip: only "Auto push" needs these fields. **Download** and **Share to email** work out of the box without a backend or auth code.

---

## Backend

By default the extension generates the EPUB locally and uses your own mail client, so a backend isn't required. The "auto push" mode needs an SMTP relay backend:

- **Built-in free shared backend** (deployed on Tencent Cloud SCF) — works out of the box.
- **Self-hosted backend** (better for privacy / higher volume): deploy your own Tencent Cloud SCF function and put its URL into the extension's "backend address".

> ⚠️ Privacy: the shared backend handles your SMTP auth code and EPUB content only to relay the email, and does **not** store them. If you mind, self-host it (the code is fully open source and deploys in one step). The auth code is stored only in your local extension config and is never uploaded anywhere else.

---

## Self-hosting the backend (Tencent Cloud SCF · free)

The backend source is in `tencent-scf-web/` (zero-dependency `stdlib http.server`, listening on `0.0.0.0:9000`); the deploy package `kindle-scf-web.zip` can be uploaded directly.

1. Tencent Cloud → Cloud Functions → create a **Web Function** (not an event function) → runtime **Python 3.10**.
2. Upload `kindle-scf-web.zip` (contains `app.py` + `scf_bootstrap`; the script auto-detects the Python interpreter version).
3. In the trigger settings, get the public `*.ap-guangzhou.tencentscf.com` function URL (no domain, no credit card required).
4. Put that URL into the extension's "backend address".

Endpoints:
- `POST /api/send`: receives `{smtp_user, smtp_password, kindle_email, title, epub_base64}` and relays it via SMTP.
- `POST /api/probe`: staged SMTP connectivity diagnosis (TCP → banner → TLS → EHLO).
- TLS 1.2 is enforced for compatibility with older mail servers, and `Access-Control-Allow-Origin: *` is enabled for direct calls from the extension.

> Measured SMTP coverage from the Guangzhou egress: 163 / 126 / yeah ✅, Outlook / Hotmail ✅, QQ / Foxmail ✅ (needs TLS1.2); Gmail ❌ (blocked by the GFW, not recommended).

---

## Project structure

```
.
├── edge-extension/         # Edge/Chromium extension (core)
│   ├── manifest.json       # MV3 manifest (with options_page as the mobile config entry)
│   ├── popup.*             # toolbar popup UI
│   ├── options.*           # options page (the only config entry on mobile)
│   ├── content.js          # injected into the current page: extract text + images + build EPUB + download/share
│   ├── background.js       # Service Worker
│   ├── epub.js             # pure-JS valid EPUB generator
│   ├── _locales/           # zh / en messages
│   ├── icons/              # icons
│   └── store-assets/       # store listing images
├── tencent-scf-web/        # backend source (optional self-host)
│   ├── app.py              # Web Function HTTP service (SMTP relay + /api/probe)
│   └── scf_bootstrap       # startup script (detects the Python version)
├── kindle-scf-web.zip      # backend deploy package (upload to Tencent Cloud)
├── LICENSE
└── README.md
```

---

## Known limitations

- **Image fetching is subject to CORS**: the content script fetches images inside the page; cross-origin images without a CORS header will fail → that image is skipped (the EPUB is still valid).
- **Page structures vary**: body extraction uses generic heuristics (prefers `article` / `[role=main]` / common content classes); some sites may include navigation or miss body text — site-specific adapters can be added later.
- **`chrome://` pages** cannot be extracted (blocked by the browser) — expected.
- The `host_permissions: ["<all_urls>"]` permission shows a "read all site data" prompt on install; it's required to extract page content and is normal for a personal tool.
- Auto push depends on the SMTP provider's sending limits; for high volume, self-host the backend or use a corporate mailbox.

---

## License

[MIT](LICENSE) © 2026 阮聪 (RC-APC)
