"""生成 Edge 扩展图标：16/32/48/128 png（红底 + 白色 K）。"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)

RED = (255, 36, 66)
FONT = "C:/Windows/Fonts/arial.ttf"


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(1, size // 16)
    rounded(d, [pad, pad, size - pad, size - pad], size // 5, RED)
    # 白色 K
    try:
        f = ImageFont.truetype(FONT, int(size * 0.62))
    except Exception:
        f = ImageFont.load_default()
    txt = ImageDraw.Draw(img)
    label = "K"
    bb = txt.textbbox((0, 0), label, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    pos = ((size - w) / 2 - bb[0], (size - h) / 2 - bb[1])
    txt.text(pos, label, fill=(255, 255, 255, 255), font=f)
    p = os.path.join(OUT, f"icon{size}.png")
    img.save(p)
    print("wrote", p, os.path.getsize(p), "bytes")


for s in (16, 32, 48, 128):
    make(s)
