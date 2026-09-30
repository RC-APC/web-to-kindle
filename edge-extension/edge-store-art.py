# -*- coding: utf-8 -*-
"""Generate Edge Partner Center store assets (English listing).

Outputs into ./store-assets/:
  - store-logo-300.png      (300x300, required)
  - promo-small-440x280.png (440x280, small promo tile)
  - screenshot-1.png ~ 3.png (1280x800, up to 6)
  - promo-large-1400x560.png (1400x560, large promo banner)

Rendered at 2x then downscaled for anti-aliasing.
"""
import os
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

F_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
F_SEMI = "C:/Windows/Fonts/segoeuisb.ttf"
F_REG = "C:/Windows/Fonts/segoeui.ttf"
F_ARIAL_BD = "C:/Windows/Fonts/arialbd.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(F_ARIAL_BD, size)


def canvas(w, h, s=2):
    return Image.new("RGB", (w * s, h * s), WHITE), s


def save(img, s, name):
    img = img.resize((img.width // s, img.height // s), Image.LANCZOS)
    p = os.path.join(OUT, name)
    img.save(p)
    print("wrote", p, img.size)


def kbadge(size, s=2):
    """Red rounded square with white K, transparent corners."""
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(2, n // 16)
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n // 5, fill=RED)
    # subtle bottom shade
    d.rounded_rectangle([pad, n * 0.78, n - pad, n - pad], radius=n // 5,
                        fill=RED_DARK + (0,))
    f = font(F_ARIAL_BD, int(n * 0.60))
    bb = d.textbbox((0, 0), "K", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((n - w) / 2 - bb[0], (n - h) / 2 - bb[1]), "K", fill=WHITE, font=f)
    return img


# ---------------------------------------------------------------- 300x300 logo
img, s = canvas(300, 300, s=4)
badge = kbadge(300, s=4)
img.paste(badge, (0, 0), badge)
save(img, 4, "store-logo-300.png")

# ------------------------------------------------------------ 440x280 small tile
W, H = 440, 280
img, s = canvas(W, H)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W * s, H * s], fill=RED)
d.rounded_rectangle([0, H * s * 0.82, W * s, H * s], radius=0, fill=RED_DARK)
badge = kbadge(120, s)
img.paste(badge, (int(28 * s), int((H - 120) // 2 * s)), badge)
x = 170 * s
d.text((x, 72 * s), "Web to Kindle", font=font(F_BOLD, 44 * s), fill=WHITE)
d.text((x, 136 * s), "Any web page → EPUB → your Kindle", font=font(F_REG, 19 * s), fill=(255, 219, 224))
d.text((x, 170 * s), "Image + text  ·  Text-only  ·  One click", font=font(F_REG, 19 * s), fill=(255, 219, 224))
save(img, s, "promo-small-440x280.png")


# ------------------------------------------------------------- browser mockup
def browser_frame(w, h, url, s=2):
    """Return (img, draw, content_box) of a browser window mockup."""
    img = Image.new("RGB", (w * s, h * s), PAPER)
    d = ImageDraw.Draw(img)
    # top chrome
    bar = int(52 * s)
    d.rectangle([0, 0, w * s, bar], fill=(232, 234, 238))
    d.line([0, bar, w * s, bar], fill=LINE, width=s)
    # traffic dots
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = int((26 + i * 24) * s)
        cy = bar // 2
        r = 6 * s
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    # url pill
    pill = [int(110 * s), int(12 * s), int((w - 30) * s), int(40 * s)]
    d.rounded_rectangle(pill, radius=14 * s, fill=WHITE, outline=LINE, width=s)
    d.text((pill[0] + 14 * s, pill[1] + (pill[3] - pill[1]) // 2 - 9 * s),
           url, font=font(F_REG, 14 * s), fill=GRAY)
    # content area
    box = [0, bar, w, h]
    return img, d, box


def article_body(d, box, s, title="How to Read More Every Day", lines=14):
    """Fake article: headline + gray text bars."""
    x0 = int(90 * s)
    d.text((x0, (box[1] + 40) * s), title, font=font(F_BOLD, 30 * s), fill=INK)
    y = box[1] + 96
    import random
    rnd = random.Random(7)
    for i in range(lines):
        wln = rnd.uniform(0.55, 0.82)
        d.rounded_rectangle([x0, y * s, int(x0 + 700 * wln * s / 0.68), (y + 10) * s],
                            radius=5 * s, fill=(226, 229, 234))
        y += 26
    return y


# ------------------------------------------------------- screenshot 1: popup
W, H = 1280, 800
img, s = canvas(W, H)
d = ImageDraw.Draw(img)
img2, d, box = None, None, None  # placeholder
frame, d, box = browser_frame(W, H, "https://example.com/long-read-article", s)
img = frame
article_body(d, box, s)
# popup card
px, py, pw, ph = int(430 * s), int(120 * s), int(420 * s), int(560 * s)
d.rounded_rectangle([px, py, px + pw, py + ph], radius=16 * s, fill=WHITE,
                    outline=(210, 214, 220), width=s)
d.shadow = None
# card header
badge = kbadge(40, s)
img.paste(badge, (px + 20 * s, py + 20 * s), badge)
d.text((px + 72 * s, py + 26 * s), "Web to Kindle", font=font(F_SEMI, 19 * s), fill=INK)
d.line([px + 16 * s, py + 76 * s, px + pw - 16 * s, py + 76 * s], fill=LINE, width=s)
# fields
labels = ["Title", "Backend URL", "Sender email", "SMTP auth code", "Kindle email"]
y = py + 96 * s
for lb in labels:
    d.text((px + 24 * s, y), lb, font=font(F_SEMI, 13 * s), fill=GRAY)
    fy = y + 22 * s
    d.rounded_rectangle([px + 24 * s, fy, px + pw - 24 * s, fy + 34 * s],
                        radius=8 * s, fill=(246, 247, 249), outline=LINE, width=s)
    y = fy + 48 * s
# buttons
by = y + 6 * s
d.rounded_rectangle([px + 24 * s, by, px + pw - 24 * s, by + 44 * s], radius=10 * s, fill=RED)
d.text((px + pw // 2 - 58 * s, by + 12 * s), "Send to Kindle", font=font(F_SEMI, 16 * s), fill=WHITE)
d.rounded_rectangle([px + 24 * s, by + 56 * s, px + pw // 2 - 14 * s, by + 96 * s],
                    radius=10 * s, fill=(242, 243, 246))
d.rounded_rectangle([px + pw // 2 + 14 * s, by + 56 * s, px + pw - 24 * s, by + 96 * s],
                    radius=10 * s, fill=(242, 243, 246))
d.text((px + 40 * s, by + 68 * s), "Download EPUB", font=font(F_SEMI, 13 * s), fill=INK)
d.text((px + pw // 2 + 34 * s, by + 68 * s), "Text-only", font=font(F_SEMI, 13 * s), fill=INK)
save(img, s, "screenshot-1.png")

# --------------------------------------------- screenshot 2: right-click menu
img, s = canvas(W, H)
frame, d, box = browser_frame(W, H, "https://news.example.com/story/2026", s)
img = frame
article_body(d, box, s, title="The Year in Science", lines=13)
# context menu
mx, my, mw = int(760 * s), int(180 * s), int(330 * s)
items = ["Web to Kindle: Generate & Send", "Web to Kindle: Download EPUB (images)",
         "Web to Kindle: Download EPUB (text)", "Web to Kindle: Share via email"]
ih = 44
mh = (ih * len(items) + 28) * s
d.rounded_rectangle([mx, my, mx + mw, my + mh], radius=12 * s, fill=WHITE,
                    outline=(208, 212, 218), width=s)
yy = my + 14 * s
for i, it in enumerate(items):
    if i:
        d.line([mx + 12 * s, yy - 7 * s, mx + mw - 12 * s, yy - 7 * s], fill=(238, 240, 243), width=s)
    d.text((mx + 20 * s, yy), it, font=font(F_REG, 14 * s), fill=INK)
    yy += ih * s
save(img, s, "screenshot-2.png")

# ------------------------------------------------- screenshot 3: kindle flow
img, s = canvas(W, H)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W * s, H * s], fill=(252, 250, 247))
# headline
d.text((W * s // 2 - 300 * s, 70 * s), "From web page to your Kindle in one click",
       font=font(F_BOLD, 34 * s), fill=INK)
# three step cards
steps = [("1", "Extract", "Article text and images\nare read locally"),
         ("2", "Build EPUB", "A clean EPUB is generated\ninside your browser"),
         ("3", "Deliver", "Emailed to your Kindle\nvia your own backend")]
cw, ch, gap = 340, 300, 60
x = (W - (cw * 3 + gap * 2)) // 2
yc = 200
for n, t, desc in steps:
    cx = x * s
    cy = yc * s
    d.rounded_rectangle([cx, cy, cx + cw * s, cy + ch * s], radius=18 * s, fill=WHITE,
                        outline=(224, 227, 232), width=s)
    d.ellipse([cx + 24 * s, cy + 24 * s, cx + 72 * s, cy + 72 * s], fill=RED)
    f = font(F_BOLD, 26 * s)
    bb = d.textbbox((0, 0), n, font=f)
    d.text((cx + 48 * s - (bb[2] - bb[0]) / 2 - bb[0], cy + 48 * s - (bb[3] - bb[1]) / 2 - bb[1]),
           n, fill=WHITE, font=f)
    d.text((cx + 24 * s, cy + 96 * s), t, font=font(F_SEMI, 24 * s), fill=INK)
    for j, ln in enumerate(desc.split("\n")):
        d.text((cx + 24 * s, cy + 140 * s + j * 30 * s), ln, font=font(F_REG, 17 * s), fill=GRAY)
    x += cw + gap
# arrows between cards
x = (W - (cw * 3 + gap * 2)) // 2
for i in range(2):
    ax = (x + cw + 8) * s
    ay = (yc + ch // 2) * s
    d.line([ax, ay, ax + (gap - 16) * s, ay], fill=RED, width=4 * s)
    d.polygon([(ax + (gap - 16) * s, ay - 8 * s), (ax + (gap - 16) * s, ay + 8 * s),
               (ax + (gap - 4) * s, ay)], fill=RED)
    x += cw + gap
# footnote strip
d.rounded_rectangle([W * s // 2 - 380 * s, 570 * s, W * s // 2 + 380 * s, 640 * s],
                    radius=12 * s, fill=(255, 241, 243))
d.text((W * s // 2 - 340 * s, 588 * s),
       "No account. No tracking. Your configuration stays in your browser.",
       font=font(F_SEMI, 18 * s), fill=RED_DEEP)
save(img, s, "screenshot-3.png")

# --------------------------------------------------------- 1400x560 large promo
W, H = 1400, 560
img, s = canvas(W, H)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W * s, H * s], fill=RED)
d.rounded_rectangle([0, H * s * 0.86, W * s, H * s], radius=0, fill=RED_DARK)
d.text((90 * s, 100 * s), "Turn any web page", font=font(F_BOLD, 56 * s), fill=WHITE)
d.text((90 * s, 168 * s), "into an EPUB on your Kindle", font=font(F_BOLD, 56 * s), fill=WHITE)
bullets = ["Image + text or text-only EPUB",
           "Send via your own email backend, or download locally",
           "Works with right-click menu — including Edge on mobile"]
yy = 270
for b in bullets:
    ckx, cky = 98 * s, yy * s + 14 * s
    d.line([ckx - 9 * s, cky + 2 * s, ckx - 2 * s, cky + 9 * s], fill=(255, 228, 232), width=3 * s)
    d.line([ckx - 2 * s, cky + 9 * s, ckx + 11 * s, cky - 9 * s], fill=(255, 228, 232), width=3 * s)
    d.text((124 * s, yy * s), b, font=font(F_REG, 22 * s), fill=(255, 228, 232))
    yy += 44
badge = kbadge(220, s)
img.paste(badge, (int(1050 * s), int(120 * s)), badge)
d.text((int(1010 * s), int(390 * s)), "Web to Kindle", font=font(F_BOLD, 30 * s), fill=WHITE)
save(img, s, "promo-large-1400x560.png")

print("done")
