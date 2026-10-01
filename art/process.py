"""Turns the raw generated art (art/raw/*.png) into the textures the game loads
(client/public/fx/). Run after art/gen.sh:  python art/process.py

- tex_*   seamless ground and material tiles -> 1024 webp. Seams are blended
          so the tile wraps even if the generator left a visible edge.
- fx_* on black (additive): levels pushed so the background is exactly 0.
- *_mask: greyscale alpha masks (white = opaque), tinted in the shader.
- fx_debris: magenta chroma key -> RGBA.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "..", "client", "public", "fx")
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(RAW, name + ".png")).convert("RGB")


def square(im, size):
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((size, size), Image.LANCZOS)


def seamless(im, band=0.12):
    """Blend each edge with the opposite one so the tile wraps cleanly."""
    a = np.asarray(im).astype(np.float32)
    n = a.shape[0]
    b = int(n * band)
    rolled = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    # Weight: 1 in the middle, falling to 0 at the edges (where `rolled` is continuous).
    ramp = np.clip(np.minimum(np.arange(n), n - 1 - np.arange(n)) / b, 0, 1)
    w = np.minimum.outer(ramp, ramp)[..., None]
    return Image.fromarray((a * w + rolled * (1 - w)).astype(np.uint8))


def tile(name, size=1024):
    im = seamless(square(load(name), size))
    im.save(os.path.join(OUT, name + ".webp"), quality=86)


def additive(name, size, floor=10):
    im = load(name)
    im = im.resize((size, size), Image.LANCZOS) if im.size[0] == im.size[1] else im.resize((size, size * im.size[1] // im.size[0]), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a = np.clip((a - floor) * 255.0 / (255 - floor), 0, 255)
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(OUT, name + ".webp"), quality=88)


def mask(name, size, floor=12):
    im = load(name).convert("L").resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a = np.clip((a - floor) * 255.0 / (255 - floor), 0, 255)
    Image.fromarray(a.astype(np.uint8), "L").save(os.path.join(OUT, name + ".png"), optimize=True)


def scorch(name, size):
    """The generated scorch is lighter at the rim than the burnt centre; fill
    the centre so the decal is darkest in the middle."""
    im = load(name).convert("L").resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    y, x = np.mgrid[0:size, 0:size]
    r = np.hypot(x - size / 2, y - size / 2) / (size / 2)
    core = np.clip(1 - r / 0.55, 0, 1) ** 0.7
    out = np.maximum(a, core * 0.95)
    Image.fromarray((out * 255).astype(np.uint8), "L").save(os.path.join(OUT, name + ".png"), optimize=True)


def keyed(name, size):
    a = np.asarray(load(name).resize((size, size), Image.LANCZOS)).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Distance from magenta: magenta has high r and b and low g.
    mag = np.clip(((r + b) / 2 - g - 60) / 80, 0, 1)
    alpha = (1 - mag) * 255
    # Remove magenta spill from the edges.
    spill = np.minimum(r, b) - g
    a[..., 0] -= np.clip(spill, 0, None) * 0.5 * (1 - alpha / 255)
    a[..., 2] -= np.clip(spill, 0, None) * 0.5 * (1 - alpha / 255)
    rgba = np.dstack([np.clip(a, 0, 255), alpha]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    im.putalpha(im.getchannel("A").filter(ImageFilter.MinFilter(3)))
    im.save(os.path.join(OUT, name + ".webp"), quality=90)


JOBS = {
    "tex_grass": lambda n: tile(n),
    "tex_dirt": lambda n: tile(n),
    "tex_nightgrass": lambda n: tile(n),
    "tex_stone": lambda n: tile(n),
    "tex_snow": lambda n: tile(n),
    "tex_boulder": lambda n: tile(n, 512),
    "tex_wood": lambda n: tile(n, 512),
    "tex_fur": lambda n: tile(n, 512),
    "tex_hide": lambda n: tile(n, 512),
    "tex_leather": lambda n: tile(n, 512),
    "tex_plate": lambda n: tile(n, 512),
    "tex_bark": lambda n: tile(n, 512),
    "tex_needles": lambda n: tile(n, 512),
    "tex_sand": lambda n: tile(n),
    "tex_ice": lambda n: tile(n),
    "tex_rock": lambda n: tile(n),
    "tex_marble": lambda n: tile(n),
    "fx_explosion_sheet": lambda n: additive(n, 1024),
    "fx_fireball": lambda n: additive(n, 256),
    "fx_purge": lambda n: additive(n, 512),
    "fx_shockwave": lambda n: additive(n, 512),
    "fx_dust_mask": lambda n: mask(n, 512),
    "fx_scorch_mask": lambda n: scorch(n, 512),
    "fx_flames_sheet": lambda n: additive(n, 1024),
    "fx_debris": lambda n: keyed(n, 512),
    # From Arcane Arena (additive, on black).
    "fx_fire_sheet": lambda n: additive(n, 1024),
    "fx_smoke": lambda n: mask(n, 256),
    "fx_spark": lambda n: additive(n, 128),
    "fx_flare": lambda n: additive(n, 256),
}

if __name__ == "__main__":
    names = sys.argv[1:] or list(JOBS)
    for n in names:
        if not os.path.exists(os.path.join(RAW, n + ".png")):
            print("missing", n)
            continue
        JOBS[n](n)
        print("ok", n)
