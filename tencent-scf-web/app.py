"""腾讯云 SCF Web 函数：网页转 Kindle 邮件代发后端（零依赖，纯标准库）

接收插件 POST 来的 JSON：
  smtp_user / smtp_password / kindle_email / title / epub_base64
在本函数内用 smtplib 把 EPUB 作为附件发给亚马逊，不存储任何密码。

部署形态：SCF「Web 函数」（API 网关已停止服务，不再使用）。
Web 函数要求：监听 0.0.0.0:9000，由 scf_bootstrap 启动。
"""
import base64
import json
import os
import smtplib
import ssl
import sys
import time
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT") or 9000)
MAX_BODY = 30 * 1024 * 1024  # 30MB：足够容纳 base64 后的 18MB EPUB

# 常见邮箱服务商的 SMTP 预设；用户不手动填服务器时按发件域名自动推断。
SMTP_PRESETS = {
    "qq.com":      ("smtp.qq.com", 465, "ssl"),
    "foxmail.com": ("smtp.qq.com", 465, "ssl"),
    "163.com":     ("smtp.163.com", 465, "ssl"),
    "126.com":     ("smtp.126.com", 465, "ssl"),
    "yeah.net":    ("smtp.yeah.net", 465, "ssl"),
    "gmail.com":   ("smtp.gmail.com", 587, "tls"),
    "outlook.com": ("smtp.office365.com", 587, "tls"),
    "hotmail.com": ("smtp.office365.com", 587, "tls"),
}


def _infer_smtp(user):
    domain = user.split("@")[-1].lower()
    return SMTP_PRESETS.get(domain)


def _smtp_context():
    """TLS 上下文：强制最高 TLS1.2（部分老邮件服务器 TLS1.3 握手会崩）。"""
    ctx = ssl.create_default_context()
    try:
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    except Exception:
        pass
    return ctx


def handle_probe(body):
    """SMTP 连接分阶段诊断：TCP → 横幅 → TLS → EHLO。用于远程定位连通性问题。"""
    import socket
    host = (body.get("host") or "").strip()
    port = int(body.get("port") or 0)
    mode = (body.get("mode") or "ssl").lower()
    if not host or not port:
        return {"error": "need host & port"}
    out = {"host": host, "port": port, "mode": mode}
    sock = None
    try:
        t0 = time.time()
        sock = socket.create_connection((host, port), timeout=15)
        out["tcp"] = "ok (%.2fs)" % (time.time() - t0)
        sock.settimeout(15)

        def _read_banner(tag):
            try:
                data = sock.recv(512)
                out[tag] = data.decode("utf-8", "replace").strip()[:120] or "(empty)"
            except Exception as e:
                out[tag] = "FAIL: %s: %s" % (type(e).__name__, str(e)[:80])

        if mode == "ssl":
            t1 = time.time()
            ctx = _smtp_context()
            tls = ctx.wrap_socket(sock, server_hostname=host)
            out["tls"] = "ok %s (%.2fs)" % (tls.version(), time.time() - t1)
            sock = tls
            _read_banner("banner_after_tls")
        else:
            _read_banner("banner_plain")
            try:
                sock.sendall(b"EHLO probe\r\n")
                buf = b""
                while True:
                    chunk = sock.recv(1024)
                    buf += chunk
                    if b"\n250 " in buf or buf.endswith(b"\n") and b"250" in buf:
                        break
                out["ehlo"] = "ok"
                t1 = time.time()
                sock.sendall(b"STARTTLS\r\n")
                starttls_reply = sock.recv(256).decode("utf-8", "replace").strip()[:60]
                out["starttls_reply"] = starttls_reply
                tls = _smtp_context().wrap_socket(sock, server_hostname=host)
                out["tls"] = "ok %s (%.2fs)" % (tls.version(), time.time() - t1)
                sock = tls
                sock.sendall(b"EHLO probe\r\n")
                out["banner_after_tls"] = sock.recv(512).decode("utf-8", "replace").strip()[:120]
            except Exception as e:
                out["tls_stage"] = "FAIL: %s: %s" % (type(e).__name__, str(e)[:100])
    except Exception as e:
        out["tcp"] = "FAIL: %s: %s" % (type(e).__name__, str(e)[:100])
    finally:
        try:
            if sock:
                sock.close()
        except Exception:
            pass
    return out


def handle_send(body):
    """处理一次发信请求，返回 (http_status, 响应dict)。逻辑与 Vercel 版 send.py 一致。"""
    user = (body.get("smtp_user") or "").strip()
    pwd = body.get("smtp_password") or ""
    kindle = (body.get("kindle_email") or "").strip()
    title = (body.get("title") or "网页转Kindle").strip() or "网页转Kindle"
    epub_b64 = body.get("epub_base64") or ""

    if not user or not pwd or not kindle:
        return 400, {"detail": "缺少发件邮箱 / 授权码 / Kindle 邮箱"}
    if not epub_b64:
        return 400, {"detail": "缺少 EPUB 数据"}

    # SMTP 服务器：优先用请求体显式指定的，否则按发件域名自动推断
    host = (body.get("smtp_host") or "").strip()
    port = int(body.get("smtp_port") or 0)
    mode = (body.get("smtp_mode") or "").lower()
    if not host:
        preset = _infer_smtp(user)
        if preset:
            host, port, mode = preset
    if not host:
        return 400, {"detail": "无法识别邮箱服务商，请在高级选项手动填写 SMTP 服务器"}
    if mode not in ("ssl", "tls"):
        mode = "ssl"

    try:
        data = base64.b64decode(epub_b64)
    except Exception:
        return 400, {"detail": "EPUB 数据解码失败"}

    if len(data) > 18 * 1024 * 1024:
        return 413, {"detail": "EPUB 过大（>18MB），请少抓图或改用纯文字模式"}

    # 构造邮件
    msg = MIMEMultipart()
    msg["From"] = user
    msg["To"] = kindle
    msg["Subject"] = title
    msg.attach(MIMEText("由「网页转Kindle」插件发送。", "plain", "utf-8"))

    part = MIMEBase("application", "epub+zip")
    part.set_payload(data)
    encoders.encode_base64(part)
    safe = "".join(c for c in title if c.isalnum() or c in " _-").strip() or "note"
    part.add_header("Content-Disposition", "attachment", filename=safe + ".epub")
    msg.attach(part)

    try:
        if mode == "tls":
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=_smtp_context())
                s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP_SSL(host, port, context=_smtp_context(), timeout=30) as s:
                s.login(user, pwd)
                s.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        return 401, {"detail": "邮箱登录失败：请使用邮箱『授权码』而不是登录密码，并确认已开启 SMTP 服务（QQ/163 等在邮箱设置里获取授权码）。"}
    except smtplib.SMTPRecipientsRefused:
        return 400, {"detail": "亚马逊拒绝该收件地址，请检查 Kindle 邮箱是否正确（应为 @kindle.com / @kindle.cn）"}
    except Exception as e:
        return 502, {"detail": "发送失败：" + str(e)}

    return 200, {"ok": True, "message": "已发送至 " + kindle}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "kindle-push-webfunc/1.0"

    # ---- 公共 ----
    def _send(self, status, payload, extra_headers=None):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, *")
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(raw)

    def _drain_body(self):
        """读完请求体再处理（HTTP/1.1 keep-alive 下必须清空才能继续用连接）。"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        return self.rfile.read(length) if length > 0 else b""

    # ---- 路由 ----
    def do_OPTIONS(self):
        self._drain_body()
        self._send(204, {})

    def do_GET(self):
        self._drain_body()
        self._send(200, {
            "service": "kindle-push-backend",
            "python": sys.version,
            "usage": "POST /api/send  JSON: smtp_user, smtp_password, kindle_email, title, epub_base64",
        })

    def do_POST(self):
        raw = self._drain_body()
        try:
            body = json.loads(raw.decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("body must be a JSON object")
        except Exception:
            self._send(400, {"detail": "请求体不是合法 JSON"})
            return
        if self.path.split("?")[0] == "/api/probe":
            self._send(200, handle_probe(body))
            return
        status, payload = handle_send(body)
        self._send(status, payload)

    # SCF 用 stdout 收日志；默认 log_message 走 stderr 也能收到，这里统一 print 更稳
    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("kindle-push web function listening on 0.0.0.0:%d" % PORT, flush=True)
    server.serve_forever()
