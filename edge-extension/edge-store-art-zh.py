# -*- coding: utf-8 -*-
"""Generate Chinese large promo tile (1400x560) for Edge/Chrome store."""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "store-assets")
os.makedirs(OUT, exist_ok=True)

RED = (228, 37, 63)
RED_DARK = (178, 24, 46)
WHITE = (255, 255, 255)
PINK = (255, 228, 232)

F_ZH_BD = "C:/Windows/Fonts/msyhbd.ttc"   # Microsoft YaHei Bold
F_ZH = "C:/Windows/Fonts/simhei.ttf"      # SimHei (regular-ish)
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


W, H = 1400, 560
s = 2
img = Image.new("RGB", (W * s, H * s), RED)
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, H * s * 0.86, W * s, H * s], radius=0, fill=RED_DARK)

fb = font(F_ZH_BD, 56 * s)
# headline
d.text((90 * s, 96 * s), "把任意网页", font=fb, fill=WHITE)
d.text((90 * s, 168 * s), "变成 EPUB 发到你的 Kindle", font=fb, fill=WHITE)

# bullets with hand-drawn checkmarks (Segoe lacks U+2713)
bullets = ["图文版或纯文字版 EPUB",
           "用你的邮箱后端发送，或下载到本地",
           "右键菜单即可触发，含 Edge 移动端"]
fr = font(F_ZH, 24 * s)
yy = 286
for b in bullets:
    ckx, cky = 98 * s, yy * s + 14 * s
    d.line([ckx - 9 * s, cky + 2 * s, ckx - 2 * s, cky + 9 * s], fill=PINK, width=3 * s)
    d.line([ckx - 2 * s, cky + 9 * s, ckx + 11 * s, cky - 9 * s], fill=PINK, width=3 * s)
    d.text((124 * s, yy * s), b, font=fr, fill=PINK)
    yy += 48

# brand badge on the right
badge = kbadge(220, s)
img.paste(badge, (int(1050 * s), int(120 * s)), badge)
d.text((int(1000 * s), int(392 * s)), "Web to Kindle", font=font(F_ZH_BD, 30 * s), fill=WHITE)

img = img.resize((W, H), Image.LANCZOS)
p = os.path.join(OUT, "promo-large-zh-1400x560.png")
img.save(p)
print("wrote", p, img.size)
