"""
Generate app icons, Android adaptive layers, splash mark and favicon from src/config/brand.json.

    python scripts/make_icons.py            # uses the active brand
    npm run icons                            # same thing

Needs Pillow (pip install pillow). If the gym has a real logo, replace the generated
files in assets/images with exported versions of their logo at the same sizes.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "src", "config", "brand.json")
OUT = os.path.join(ROOT, "assets", "images")
FONT = os.path.join(
    ROOT, "node_modules", "@expo-google-fonts", "bricolage-grotesque", "800ExtraBold", "BricolageGrotesque_800ExtraBold.ttf"
)


def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    def ch(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def readable_on(rgb):
    white = (255, 255, 255)
    dark = (18, 22, 32)
    lb = luminance(rgb)
    c_white = (1.05) / (lb + 0.05)
    c_dark = (lb + 0.05) / (luminance(dark) + 0.05)
    return white if c_white >= c_dark else dark


def font(size):
    if not os.path.exists(FONT):
        sys.exit("Bricolage Grotesque font not found. Run npm install first.")
    return ImageFont.truetype(FONT, size)


def draw_rings(img, cx, cy, size, rgba):
    """The plate motif from the app: rim, raised ring, hub, bore."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def ring(r, w):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba, width=max(1, int(w)))

    ring(size * 0.47, size * 0.05)
    ring(size * 0.37, size * 0.012)
    ring(size * 0.17, size * 0.03)
    r = size * 0.08
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba)
    img.alpha_composite(layer)


def draw_mark(img, text, color, height_ratio, center=None):
    w, h = img.size
    target = int(h * height_ratio)
    f = font(target)
    d = ImageDraw.Draw(img)
    box = d.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    # Keep wide monograms inside the canvas.
    if tw > w * 0.78:
        f = font(int(target * (w * 0.78) / tw))
        box = d.textbbox((0, 0), text, font=f)
        tw, th = box[2] - box[0], box[3] - box[1]
    cx, cy = center or (w / 2, h / 2)
    d.text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=f, fill=color)


def main():
    with open(BRAND, encoding="utf-8") as fh:
        brand = json.load(fh)
    primary = hex_to_rgb(brand["colors"]["primary"])
    on = readable_on(primary)
    mono = brand["monogram"].upper()
    os.makedirs(OUT, exist_ok=True)

    # iOS / store icon: full-bleed square, the OS applies the mask.
    icon = Image.new("RGBA", (1024, 1024), primary + (255,))
    draw_rings(icon, 1024 * 0.86, 1024 * 0.9, 900, on + (26,))
    draw_mark(icon, mono, on, 0.46)
    icon.convert("RGB").save(os.path.join(OUT, "icon.png"))

    # Android adaptive icon layers (512 canvas, 66% safe zone in the middle).
    bg = Image.new("RGBA", (512, 512), primary + (255,))
    draw_rings(bg, 512 * 0.86, 512 * 0.9, 450, on + (26,))
    bg.convert("RGB").save(os.path.join(OUT, "android-icon-background.png"))

    fg = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw_mark(fg, mono, on + (255,), 0.3)
    fg.save(os.path.join(OUT, "android-icon-foreground.png"))

    mono_img = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    draw_mark(mono_img, mono, (255, 255, 255, 255), 0.3)
    mono_img.save(os.path.join(OUT, "android-icon-monochrome.png"))

    # Splash mark sits on the brand-coloured splash background.
    splash = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    draw_mark(splash, mono, on + (255,), 0.62)
    splash.save(os.path.join(OUT, "splash-icon.png"))

    icon.convert("RGB").resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"))
    print(f"Icons written for {brand['name']} ({brand['colors']['primary']}, {mono}) to assets/images")


if __name__ == "__main__":
    main()
