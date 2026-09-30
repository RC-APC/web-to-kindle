# -*- coding: utf-8 -*-
"""Generate Chinese-language store assets (everything except logo) for Edge/Chrome store.

Outputs into ./store-assets/ (Chinese variants):
  - promo-small-zh-440x280.png
  - screenshot-1-zh.png   (popup)
  - screenshot-2-zh.png   (right-click menu)
  - screenshot-3-zh.png   (kindle flow)
Rendered at 2x then downscaled for anti-aliasing.
"""
import os
import random
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "store-assets")
os.makedirs(OUT, exist_ok=True)

RED = (228, 37, 63)
RED_DARK = (178, 24, 46)
RED_DEEP = (140, 15, 35)
INK = (24, 26, 32)
GRAY = (108, 114, 126)
LINE = (222, 226, 232)
PAPER = (250, 250, 252)
WHITE = (255, 255, 255)
PINK = (255, 228, 232)

F_ZH_BD = "C:/Windows/Fonts/msyhbd.ttc"   # YaHei Bold
F_ZH = "C:/Windows/Fonts/simhei.ttf"      # SimHei
F_ARIAL_BD = "C:/Windows/Fonts/arialbd.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(F_ARIAL_BD, size)


def kbadge(size, s=2):
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(2, n // 16)
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n // 5, fill=RED)
    d.rounded_rectangle([pad, n * 0.78, n - pad, n - pad], radius=n // 5, fill=RED_DARK)
    f = font(F_ARIAL_BD, int(n * 0.60))
    bb = d.textbbox((0, 0), "K", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((n - w) / 2 - bb[0], (n - h) / 2 - bb[1]), "K", fill=WHITE, font=f)
    return img


def save(img, s, name):
    img = img.resize((img.width // s, img.height // s), Image.LANCZOS)
    p = os.path.join(OUT, name)
    img.save(p)
    print("wrote", p, img.size)


def browser_frame(w, h, url, s=2):
    img = Image.new("RGB", (w * s, h * s), PAPER)
    d = ImageDraw.Draw(img)
    bar = int(52 * s)
    d.rectangle([0, 0, w * s, bar], fill=(232, 234, 238))
    d.line([0, bar, w * s, bar], fill=LINE, width=s)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = int((26 + i * 24) * s)
        cy = bar // 2
        r = 6 * s
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    pill = [int(110 * s), int(12 * s), int((w - 30) * s), int(40 * s)]
    d.rounded_rectangle(pill, radius=14 * s, fill=WHITE, outline=LINE, width=s)
    d.text((pill[0] + 14 * s, pill[1] + (pill[3] - pill[1]) // 2 - 9 * s),
           url, font=font(F_ARIAL_BD, 14 * s), fill=GRAY)
    return img, d, [0, bar, w, h]


def article_body(d, box, s, title, lines=13):
    x0 = int(90 * s)
    d.text((x0, (box[1] + 40) * s), title, font=font(F_ZH_BD, 30 * s), fill=INK)
    y = box[1] + 96
    rnd = random.Random(7)
    for i in range(lines):
        wln = rnd.uniform(0.55, 0.82)
        d.rounded_rectangle([x0, y * s, int(x0 + 700 * wln * s / 0.68), (y + 10) * s],
                            radius=5 * s, fill=(226, 229, 234))
        y += 26
    return y


# ------------------------------------------------------------ 440x280 small tile
W, H = 440, 280
s = 2
img = Image.new("RGB", (W * s, H * s), RED)
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, H * s * 0.82, W * s, H * s], radius=0, fill=RED_DARK)
badge = kbadge(120, s)
img.paste(badge, (int(28 * s), int((H - 120) // 2 * s)), badge)
x = 175 * s
d.text((x, 78 * s), "Web to Kindle", font=font(F_ZH_BD, 40 * s), fill=WHITE)
d.text((x, 140 * s), "网页一键转 EPUB", font=font(F_ZH, 15 * s), fill=PINK)
d.text((x, 172 * s), "图文版 · 纯文字版", font=font(F_ZH, 15 * s), fill=PINK)
save(img, s, "promo-small-zh-440x280.png")

# ------------------------------------------------------- screenshot 1: popup
W, H = 1280, 800
s = 2
img = Image.new("RGB", (W * s, H * s), PAPER)
d = ImageDraw.Draw(img)
frame, d, box = browser_frame(W, H, "https://example.com/long-read-article", s)
img = frame
article_body(d, box, s, "如何每天多读一点书", lines=13)
px, py, pw, ph = int(430 * s), int(120 * s), int(420 * s), int(560 * s)
d.rounded_rectangle([px, py, px + pw, py + ph], radius=16 * s, fill=WHITE,
                    outline=(210, 214, 220), width=s)
badge = kbadge(40, s)
img.paste(badge, (px + 20 * s, py + 20 * s), badge)
d.text((px + 72 * s, py + 26 * s), "Web to Kindle", font=font(F_ZH_BD, 19 * s), fill=INK)
d.line([px + 16 * s, py + 76 * s, px + pw - 16 * s, py + 76 * s], fill=LINE, width=s)
labels = ["标题", "后端地址", "发件邮箱", "SMTP 授权码", "Kindle 邮箱"]
y = py + 96 * s
for lb in labels:
    d.text((px + 24 * s, y), lb, font=font(F_ZH, 13 * s), fill=GRAY)
    fy = y + 22 * s
    d.rounded_rectangle([px + 24 * s, fy, px + pw - 24 * s, fy + 34 * s],
                        radius=8 * s, fill=(246, 247, 249), outline=LINE, width=s)
    y = fy + 48 * s
by = y + 6 * s
d.rounded_rectangle([px + 24 * s, by, px + pw - 24 * s, by + 44 * s], radius=10 * s, fill=RED)
d.text((px + pw // 2 - 58 * s, by + 12 * s), "发送到 Kindle", font=font(F_ZH, 16 * s), fill=WHITE)
d.rounded_rectangle([px + 24 * s, by + 56 * s, px + pw // 2 - 14 * s, by + 96 * s],
                    radius=10 * s, fill=(242, 243, 246))
d.rounded_rectangle([px + pw // 2 + 14 * s, by + 56 * s, px + pw - 24 * s, by + 96 * s],
                    radius=10 * s, fill=(242, 243, 246))
d.text((px + 40 * s, by + 68 * s), "下载 EPUB", font=font(F_ZH, 13 * s), fill=INK)
d.text((px + pw // 2 + 30 * s, by + 68 * s), "纯文字版", font=font(F_ZH, 13 * s), fill=INK)
save(img, s, "screenshot-1-zh.png")

# --------------------------------------------- screenshot 2: right-click menu
img = Image.new("RGB", (W * s, H * s), PAPER)
d = ImageDraw.Draw(img)
frame, d, box = browser_frame(W, H, "https://news.example.com/story/2026", s)
img = frame
article_body(d, box, s, "年度科学回顾", lines=12)
mx, my, mw = int(760 * s), int(180 * s), int(340 * s)
items = ["生成并发送到 Kindle", "下载图文 EPUB", "下载纯文字 EPUB", "分享到邮箱"]
ih = 44
mh = (ih * len(items) + 28) * s
d.rounded_rectangle([mx, my, mx + mw, my + mh], radius=12 * s, fill=WHITE,
                    outline=(208, 212, 218), width=s)
yy = my + 14 * s
for i, it in enumerate(items):
    if i:
        d.line([mx + 12 * s, yy - 7 * s, mx + mw - 12 * s, yy - 7 * s], fill=(238, 240, 243), width=s)
    d.text((mx + 20 * s, yy), it, font=font(F_ZH, 14 * s), fill=INK)
    yy += ih * s
save(img, s, "screenshot-2-zh.png")

# ------------------------------------------------- screenshot 3: kindle flow
img = Image.new("RGB", (W * s, H * s), (252, 250, 247))
d = ImageDraw.Draw(img)
d.text((W * s // 2 - 320 * s, 70 * s), "从网页到你的 Kindle，一键搞定",
       font=font(F_ZH_BD, 34 * s), fill=INK)
steps = [("1", "提取", "在正文中读取文章\n文字与图片"),
         ("2", "生成 EPUB", "浏览器内生成\n干净的 EPUB"),
         ("3", "发送", "经你的后端\n发到 Kindle")]
cw, ch, gap = 340, 300, 60
x = (W - (cw * 3 + gap * 2)) // 2
yc = 200
for n, t, desc in steps:
    cx = x * s
    cy = yc * s
    d.rounded_rectangle([cx, cy, cx + cw * s, cy + ch * s], radius=18 * s, fill=WHITE,
                        outline=(224, 227, 232), width=s)
    d.ellipse([cx + 24 * s, cy + 24 * s, cx + 72 * s, cy + 72 * s], fill=RED)
    f = font(F_ZH_BD, 26 * s)
    bb = d.textbbox((0, 0), n, font=f)
    d.text((cx + 48 * s - (bb[2] - bb[0]) / 2 - bb[0], cy + 48 * s - (bb[3] - bb[1]) / 2 - bb[1]),
           n, fill=WHITE, font=f)
    d.text((cx + 24 * s, cy + 96 * s), t, font=font(F_ZH_BD, 24 * s), fill=INK)
    for j, ln in enumerate(desc.split("\n")):
        d.text((cx + 24 * s, cy + 140 * s + j * 30 * s), ln, font=font(F_ZH, 17 * s), fill=GRAY)
    x += cw + gap
x = (W - (cw * 3 + gap * 2)) // 2
for i in range(2):
    ax = (x + cw + 8) * s
    ay = (yc + ch // 2) * s
    d.line([ax, ay, ax + (gap - 16) * s, ay], fill=RED, width=4 * s)
    d.polygon([(ax + (gap - 16) * s, ay - 8 * s), (ax + (gap - 16) * s, ay + 8 * s),
               (ax + (gap - 4) * s, ay)], fill=RED)
    x += cw + gap
d.rounded_rectangle([W * s // 2 - 380 * s, 570 * s, W * s // 2 + 380 * s, 640 * s],
                    radius=12 * s, fill=(255, 241, 243))
d.text((W * s // 2 - 340 * s, 588 * s),
       "无账号 · 无追踪 · 配置只留在本机浏览器",
       font=font(F_ZH_BD, 18 * s), fill=RED_DEEP)
save(img, s, "screenshot-3-zh.png")

print("done")
