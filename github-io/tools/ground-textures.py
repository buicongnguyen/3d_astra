"""Ground detail layers for the battlefield (V1 terrain round, 2026-11-26).

Writes the fourteen tileable ground textures the game blends over its painted ground:

    public/textures/ground/<layer>.webp       512 x 512 (desktop High), seamless, one tile = 4 x 4 m of ground
    public/textures/ground/256/<layer>.webp   256 x 256 copies for Eco and phones (6-8 m tiles there)

Layers: grass, grass-dry, dirt, road, stone, mud, sand, hardpan, snow, ice, basalt, ash, beach, cliff.
Which land uses which layer for which surface is the table GROUND_LAYERS in src/ground-detail.js
(documented in docs/ASSET_PIPELINE.md, "Ground detail layers").

Contract (a painted replacement set must keep it, with the same file names):
  - mid-value full-colour paintings, average luminance about 45-60 %, no strong lighting beyond a soft key from the
    image's top (the game maps the image top to world +z and turns the frame 40 degrees, so it falls from the sun's
    side), no text, no hard borders, no directional marks (ruts, stripes); seamless on all four sides;
  - the shader multiplies the painted ground by the tile's luminance ratio to its own mean (strength k per layer in
    src/ground-detail.js) and by its chroma relative to its own mean chroma, so every map keeps its own palette.

The shipped set (2026-11-26) is Codex-painted (owner-commissioned) for twelve layers; this script made the first set
and still makes the two the game ships from it, `road` and `cliff` (Codex's road has directional wheel ruts that would
stripe diagonal roads, and its cliff tiles as a regular slab grid). By default it writes only those two (GENERATED),
so it never overwrites a painting; `--all` writes all fourteen (a fallback set), `--only a,b` the named ones.

Re-run (deterministic, seeded):  python tools/ground-textures.py [--out public/textures/ground] [--size 512]
                                 [--all | --only grass,dirt] [--preview .tmp/ground-preview.png] [--quality 90]
Export paintings from their 1024 px masters (both sizes, WebP q90 method 6):
                                 python tools/ground-textures.py --from-masters <folder of <layer>.png> --only a,b,...
Needs numpy and Pillow (with WebP).
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LAYERS = ["grass", "grass-dry", "dirt", "road", "stone", "mud", "sand", "hardpan", "snow", "ice", "basalt", "ash", "beach", "cliff"]
# The layers the shipped set takes from this script (the others are paintings; see the docstring).
GENERATED = ["road", "cliff"]


# ---------------------------------------------------------------- helpers (all periodic on the tile)

def spectral_noise(n, rng, beta=2.0, lo=1, hi=None, aniso=(1.0, 1.0)):
    """Periodic fractal noise by spectral synthesis: power ~ 1/f^beta between frequencies lo..hi (cycles per tile).
    Returns values normalised to 0..1. Periodic by construction (a sum of whole-tile waves)."""
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    hi = hi or n / 2
    amp = np.where((f >= lo) & (f <= hi), 1.0 / np.maximum(f, 1e-6) ** (beta / 2), 0.0)
    phase = rng.uniform(0, 2 * np.pi, (n, n))
    spec = amp * np.exp(1j * phase)
    field = np.real(np.fft.ifft2(spec))
    field -= field.min()
    return field / max(field.max(), 1e-9)


def worley(n, rng, count, jitter=1.0, grid=None, warp=0.0):
    """Periodic Worley (cellular) noise: F1, F2 distances (in pixels) and the nearest cell id for every pixel.
    `grid` (k) places points on a jittered k x k lattice (even cells, as basalt columns); `warp` (pixels) bends
    the cell borders with periodic noise, so plates read as broken rock rather than paving."""
    if grid:
        k = grid
        gx, gy = np.meshgrid(np.arange(k), np.arange(k))
        # Hexagonal stagger: every other row shifted half a cell.
        px = (gx + 0.5 + (gy % 2) * 0.5 + rng.uniform(-0.5, 0.5, (k, k)) * jitter) * (n / k)
        py = (gy + 0.5 + rng.uniform(-0.5, 0.5, (k, k)) * jitter) * (n / k)
        pts = np.stack([px.ravel() % n, py.ravel() % n], 1)
    else:
        pts = rng.uniform(0, n, (count, 2))
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    if warp:
        xs = xs + (spectral_noise(n, rng, beta=2.4, lo=1, hi=12) - 0.5) * 2 * warp
        ys = ys + (spectral_noise(n, rng, beta=2.4, lo=1, hi=12) - 0.5) * 2 * warp
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = np.full((n, n), 1e9, np.float32)
    cell = np.zeros((n, n), np.int32)
    for i, (px_, py_) in enumerate(pts):
        dx = np.abs(xs - px_)
        dx = np.minimum(dx, n - dx)
        dy = np.abs(ys - py_)
        dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        cell = np.where(closer, i, cell)
        f1 = np.where(closer, d, f1)
    return f1, f2, cell, pts


def ridge_lines(f1, f2, width):
    """Crack lines along Worley cell borders (F2 - F1 small): 1 on the crack, 0 away from it."""
    e = f2 - f1
    return np.clip(1.0 - e / width, 0.0, 1.0) ** 1.5


def lerp(a, b, t):
    return a + (b - a) * t


def colour_map(value, stops):
    """Maps 0..1 values through colour stops [(t, (r, g, b)), ...] (sRGB 0..255) to an n x n x 3 float image."""
    ts = np.array([s[0] for s in stops], np.float32)
    cs = np.array([s[1] for s in stops], np.float32)
    out = np.zeros(value.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(value, ts, cs[:, c])
    return out


class Canvas:
    """A supersampled RGBA canvas that draws every shape with its wrapped copies, so the tile stays seamless."""

    def __init__(self, n, scale=2, base=None):
        self.n, self.s = n, scale
        size = n * scale
        if base is None:
            self.img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        else:
            big = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").resize((size, size), Image.BICUBIC)
            self.img = big.convert("RGBA")
        self.draw = ImageDraw.Draw(self.img, "RGBA")

    def _copies(self, pts):
        n = self.n
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                yield [((x + ox) * self.s, (y + oy) * self.s) for x, y in pts]

    def polygon(self, pts, fill):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        n = self.n
        for ox in (-n, 0, n):
            if max(xs) + ox < 0 or min(xs) + ox > n:
                continue
            for oy in (-n, 0, n):
                if max(ys) + oy < 0 or min(ys) + oy > n:
                    continue
                self.draw.polygon([((x + ox) * self.s, (y + oy) * self.s) for x, y in pts], fill=fill)

    def ellipse(self, cx, cy, rx, ry, fill, angle=0.0, segments=14):
        pts = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            x, y = math.cos(a) * rx, math.sin(a) * ry
            pts.append((cx + x * math.cos(angle) - y * math.sin(angle), cy + x * math.sin(angle) + y * math.cos(angle)))
        self.polygon(pts, fill)

    def blade(self, x, y, angle, length, width, fill_base, fill_tip, bend=0.0):
        """A tapered grass blade from (x, y) leaning along `angle`, drawn as two quads (base colour, tip colour)."""
        dx, dy = math.cos(angle), math.sin(angle)
        nx, ny = -dy, dx
        mx, my = x + dx * length * 0.5 + nx * bend * 0.5, y + dy * length * 0.5 + ny * bend * 0.5
        tx, ty = x + dx * length + nx * bend, y + dy * length + ny * bend
        w0, w1 = width, width * 0.55
        self.polygon([(x + nx * w0, y + ny * w0), (mx + nx * w1, my + ny * w1), (mx - nx * w1, my - ny * w1), (x - nx * w0, y - ny * w0)], fill_base)
        self.polygon([(mx + nx * w1, my + ny * w1), (tx, ty), (mx - nx * w1, my - ny * w1)], fill_tip)

    def line(self, pts, fill, width):
        n = self.n
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for ox in (-n, 0, n):
            if max(xs) + ox < -width or min(xs) + ox > n + width:
                continue
            for oy in (-n, 0, n):
                if max(ys) + oy < -width or min(ys) + oy > n + width:
                    continue
                self.draw.line([((x + ox) * self.s, (y + oy) * self.s) for x, y in pts], fill=fill, width=max(1, int(round(width * self.s))), joint="curve")

    def result(self):
        return np.asarray(self.img.convert("RGB").resize((self.n, self.n), Image.LANCZOS), np.float32)


def rgba(c, a=255):
    return (int(np.clip(c[0], 0, 255)), int(np.clip(c[1], 0, 255)), int(np.clip(c[2], 0, 255)), int(a))


def shade(c, k):
    return (c[0] * k, c[1] * k, c[2] * k)


def mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def pebble(cv, rng, x, y, r, base, light=1.25, dark=0.62, squash=0.72):
    """A pebble: a soft contact shadow, the stone, then a cap lit from the image's top-left (the game maps the image
    top toward the sun's side)."""
    a = rng.uniform(0, math.pi)
    cv.ellipse(x + r * 0.22, y + r * 0.18, r * 1.12, r * squash * 1.12, rgba(shade(base, 0.45), 110), a)
    cv.ellipse(x, y, r, r * squash, rgba(shade(base, dark)), a)
    cv.ellipse(x - r * 0.18, y - r * 0.1, r * 0.72, r * squash * 0.66, rgba(base), a)
    cv.ellipse(x - r * 0.32, y - r * 0.22, r * 0.36, r * squash * 0.3, rgba(shade(base, light)), a)


# ---------------------------------------------------------------- the layers

def layer_grass(n, rng, dry=False):
    soil = (122, 96, 58) if dry else (78, 92, 44)
    low = spectral_noise(n, rng, beta=2.6, lo=1, hi=24)
    base = colour_map(low, [(0, shade(soil, 0.85)), (0.5, soil), (1, shade(soil, 1.15))])
    cv = Canvas(n, 2, base)
    # Clumps of blades: many small tufts, each a fan of blades leaning a little to the north-east (the wind).
    clumps = 520 if dry else 900
    for _ in range(clumps):
        x, y = rng.uniform(0, n, 2)
        k = rng.uniform(0, 1)
        if dry:
            tip = mix((214, 176, 96), (236, 206, 128), k)
            base_c = mix((120, 94, 52), (150, 118, 66), k)
        else:
            tip = mix((128, 196, 74), (182, 222, 96), k)
            base_c = mix((44, 96, 40), (70, 120, 46), k)
        blades = int(rng.integers(5, 10))
        lean = -1.15 + rng.uniform(-0.35, 0.35)
        size = rng.uniform(10, 22) * (0.8 if dry else 1)
        for b in range(blades):
            ang = lean + rng.uniform(-0.9, 0.9)
            cv.blade(x + rng.uniform(-3, 3), y + rng.uniform(-2, 2), ang, size * rng.uniform(0.6, 1.0), rng.uniform(1.3, 2.4),
                     rgba(base_c), rgba(tip), bend=rng.uniform(-3, 3))
    # Small dark gaps between clumps read as depth.
    for _ in range(70):
        x, y = rng.uniform(0, n, 2)
        cv.ellipse(x, y, rng.uniform(5, 11), rng.uniform(3, 7), rgba(shade(soil, 0.7), 45), rng.uniform(0, 3))
    if dry:
        for _ in range(60):
            x, y = rng.uniform(0, n, 2)
            pebble(cv, rng, x, y, rng.uniform(3, 6), (150, 130, 100))
    return cv.result()


def layer_dirt(n, rng):
    low = spectral_noise(n, rng, beta=2.4, lo=1, hi=40)
    base = colour_map(low, [(0, (104, 74, 46)), (0.5, (132, 98, 62)), (1, (156, 120, 78))])
    cv = Canvas(n, 2, base)
    # Clods and pebbles of every size, small ones many.
    for _ in range(420):
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(2.5, 6.5) if rng.uniform() < 0.8 else rng.uniform(7, 12)
        c = mix((120, 96, 70), (170, 150, 120), rng.uniform())
        pebble(cv, rng, x, y, r, c)
    # A few tiny grass sprigs.
    for _ in range(70):
        x, y = rng.uniform(0, n, 2)
        for b in range(4):
            cv.blade(x, y, -1.2 + rng.uniform(-0.8, 0.8), rng.uniform(6, 11), 1.2, rgba((70, 96, 44)), rgba((130, 160, 70)))
    return cv.result()


def layer_road(n, rng):
    low = spectral_noise(n, rng, beta=2.2, lo=2, hi=60)
    base = colour_map(low, [(0, (138, 112, 82)), (0.5, (160, 132, 98)), (1, (182, 154, 118))])
    cv = Canvas(n, 2, base)
    # Packed gravel: many small, flat, pale stones.
    for _ in range(1300):
        x, y = rng.uniform(0, n, 2)
        c = mix((150, 130, 104), (206, 190, 162), rng.uniform())
        pebble(cv, rng, x, y, rng.uniform(1.6, 4.2), c, light=1.18, dark=0.7, squash=0.8)
    # A few bigger set stones.
    for _ in range(40):
        x, y = rng.uniform(0, n, 2)
        pebble(cv, rng, x, y, rng.uniform(6, 9), mix((140, 124, 104), (186, 170, 146), rng.uniform()), squash=0.65)
    return cv.result()


def layer_stone(n, rng):
    # Rocky ground: a few big broken slabs half buried in grit, cracks filled with gravel and moss.
    f1, f2, cell, pts = worley(n, rng, 16, warp=26)
    tone = rng.uniform(0.82, 1.12, len(pts))[cell]
    edge = np.clip((f2 - f1) / 26.0, 0, 1)
    grain = spectral_noise(n, rng, beta=1.6, lo=4, hi=200)
    lumpy = spectral_noise(n, rng, beta=2.2, lo=2, hi=40)
    v = 0.42 + 0.2 * edge ** 0.7 * tone + 0.16 * (grain - 0.5) + 0.12 * (lumpy - 0.5)
    cracks = ridge_lines(f1, f2, 5.5)
    gravel = spectral_noise(n, rng, beta=0.6, lo=60, hi=256)
    v = v * (1 - 0.35 * cracks) + cracks * 0.12 * (gravel - 0.5)
    # Bevel: slabs lit on their lower-left rims, softly.
    gy, gx = np.gradient(edge)
    v += np.clip(-gx * 4 + gy * 4, -0.08, 0.1)
    img = colour_map(np.clip(v, 0, 1), [(0, (60, 62, 60)), (0.5, (128, 128, 120)), (1, (196, 192, 178))])
    lichen = spectral_noise(n, rng, beta=2.2, lo=3, hi=60)
    img = lerp(img, img * np.array([1.02, 1.08, 0.86]), np.clip((lichen - 0.62) * 3, 0, 1)[..., None])
    # Moss and grit settle in the cracks.
    img = lerp(img, np.array([86, 104, 58], np.float32), (ridge_lines(f1, f2, 5.0) * 0.45)[..., None])
    return img


def layer_mud(n, rng):
    low = spectral_noise(n, rng, beta=2.8, lo=1, hi=30)
    wet = spectral_noise(n, rng, beta=2.4, lo=2, hi=40)
    fine = spectral_noise(n, rng, beta=1.2, lo=20, hi=256)
    # Wet hollows: darker, smoother, with a soft lighter sheen along their sunny side.
    hollow = np.clip((wet - 0.55) * 4, 0, 1)
    sheen = np.clip((np.roll(wet, (3, -3), axis=(0, 1)) - wet) * 30, 0, 1) * hollow
    v = 0.5 + 0.16 * (low - 0.5) + 0.07 * (fine - 0.5) * (1 - hollow) - 0.2 * hollow + 0.16 * sheen
    img = colour_map(np.clip(v, 0, 1), [(0, (58, 44, 32)), (0.5, (104, 82, 58)), (1, (150, 128, 98))])
    cv = Canvas(n, 2, img)
    # Ruts left by wheels and feet.
    for _ in range(12):
        x, y = rng.uniform(0, n, 2)
        a = rng.uniform(0, math.pi)
        length = rng.uniform(40, 90)
        pts = [(x + math.cos(a) * t + math.sin(t * 0.05) * 3, y + math.sin(a) * t) for t in np.linspace(0, length, 8)]
        cv.line(pts, rgba((62, 48, 34), 80), rng.uniform(3, 5))
    # Small stones half sunk in the mud: low contrast, no bright caps.
    for _ in range(140):
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(2, 4.5)
        c = mix((96, 80, 60), (130, 112, 88), rng.uniform())
        a = rng.uniform(0, 3)
        cv.ellipse(x + 0.8, y - 0.6, r * 1.1, r * 0.7, rgba(shade(c, 0.6), 110), a)
        cv.ellipse(x, y, r, r * 0.62, rgba(c), a)
    return cv.result()


def layer_sand(n, rng, beach=False):
    grain = spectral_noise(n, rng, beta=0.8, lo=40, hi=256)
    low = spectral_noise(n, rng, beta=2.6, lo=1, hi=12)
    warp = spectral_noise(n, rng, beta=2.4, lo=1, hi=8)
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    # Wind ripples: whole-tile waves along an oblique direction (integer frequencies keep them seamless), warped.
    phase = 2 * np.pi * (11 * xs + 5 * ys) / n + (warp - 0.5) * 7.0
    ripple = 0.5 + 0.5 * np.sin(phase)
    ripple = ripple ** 2.2  # sharp crests, wide troughs
    v = 0.5 + 0.18 * (ripple - 0.3) + 0.10 * (grain - 0.5) + 0.16 * (low - 0.5)
    if beach:
        img = colour_map(np.clip(v, 0, 1), [(0, (150, 128, 92)), (0.5, (204, 182, 138)), (1, (238, 222, 184))])
    else:
        img = colour_map(np.clip(v, 0, 1), [(0, (150, 112, 62)), (0.5, (196, 158, 98)), (1, (230, 196, 136))])
    cv = Canvas(n, 2, img)
    if beach:
        # Shells and coral bits, and a few darker wet flecks.
        for _ in range(90):
            x, y = rng.uniform(0, n, 2)
            c = [(250, 236, 222), (244, 190, 170), (236, 214, 170)][int(rng.integers(0, 3))]
            pebble(cv, rng, x, y, rng.uniform(2, 4.5), c, light=1.1, dark=0.8, squash=0.6)
    else:
        for _ in range(70):
            x, y = rng.uniform(0, n, 2)
            pebble(cv, rng, x, y, rng.uniform(1.8, 3.6), (176, 140, 96))
    return cv.result()


def layer_hardpan(n, rng):
    f1, f2, cell, pts = worley(n, rng, 60, warp=6)
    cracks = ridge_lines(f1, f2, 2.6)
    tone = rng.uniform(0.9, 1.08, len(pts))[cell]
    # Each crust plate curls up at its rim: lighter near the crack, then the crack itself dark.
    rim = np.clip(1 - (f2 - f1) / 10, 0, 1)
    grain = spectral_noise(n, rng, beta=1.2, lo=8, hi=200)
    low = spectral_noise(n, rng, beta=2.6, lo=1, hi=10)
    v = 0.5 * tone + 0.08 * (grain - 0.5) + 0.12 * (low - 0.5)
    v = v * (1 - 0.62 * cracks) + 0.06 * rim * (1 - cracks)
    return colour_map(np.clip(v, 0, 1), [(0, (82, 56, 38)), (0.45, (168, 122, 80)), (1, (222, 180, 128))])


def layer_snow(n, rng):
    low = spectral_noise(n, rng, beta=2.8, lo=1, hi=16)
    mid = spectral_noise(n, rng, beta=2.0, lo=6, hi=60)
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    warp = spectral_noise(n, rng, beta=2.4, lo=1, hi=6)
    phase = 2 * np.pi * (3 * xs - 7 * ys) / n + (warp - 0.5) * 9
    drift = 0.5 + 0.5 * np.sin(phase)
    lee = np.clip(np.cos(phase), 0, 1) * drift  # the shaded side of each drift
    v = 0.56 + 0.16 * (low - 0.5) + 0.12 * (mid - 0.5) + 0.16 * (drift ** 2 - 0.35) - 0.08 * lee
    img = colour_map(np.clip(v, 0, 1), [(0, (132, 164, 204)), (0.5, (200, 222, 242)), (1, (248, 252, 255))])
    cv = Canvas(n, 2, img)
    # A few soft pits (old footprints, wind scoops), then sparkles.
    for _ in range(60):
        x, y = rng.uniform(0, n, 2)
        cv.ellipse(x, y, rng.uniform(5, 10), rng.uniform(3, 6), rgba((176, 200, 228), 45), rng.uniform(0, 3))
    for _ in range(420):
        x, y = rng.uniform(0, n, 2)
        cv.ellipse(x, y, 0.9, 0.9, rgba((255, 255, 255), 230), 0, 6)
    return cv.result()


def layer_ice(n, rng):
    low = spectral_noise(n, rng, beta=2.6, lo=1, hi=14)
    streak = spectral_noise(n, rng, beta=2.0, lo=2, hi=60, aniso=(0.25, 1.0))
    v = 0.48 + 0.16 * (low - 0.5) + 0.14 * (streak - 0.5)
    img = colour_map(np.clip(v, 0, 1), [(0, (70, 120, 168)), (0.5, (128, 180, 216)), (1, (200, 232, 248))])
    f1, f2, cell, pts = worley(n, rng, 14)
    crack = ridge_lines(f1, f2, 1.6)
    keep = (rng.uniform(0, 1, len(pts)) > 0.35)[cell]
    img = lerp(img, np.array([238, 250, 255], np.float32), (crack * keep * 0.85)[..., None])
    cv = Canvas(n, 2, img)
    for _ in range(120):  # trapped bubbles
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(1.2, 3.2)
        cv.ellipse(x, y, r, r, rgba((236, 248, 255), 170), 0, 8)
    return cv.result()


def layer_basalt(n, rng):
    f1, f2, cell, pts = worley(n, rng, 0, jitter=0.45, grid=9)
    tone = rng.uniform(0.85, 1.1, len(pts))[cell]
    edge = np.clip((f2 - f1) / 14.0, 0, 1)
    cracks = ridge_lines(f1, f2, 2.4)
    grain = spectral_noise(n, rng, beta=1.4, lo=6, hi=200)
    v = 0.34 + 0.22 * edge ** 0.5 * tone + 0.12 * (grain - 0.5)
    gy, gx = np.gradient(edge)
    v += np.clip(-gx * 5 + gy * 5, -0.1, 0.14)
    v = v * (1 - 0.6 * cracks)
    return colour_map(np.clip(v, 0, 1), [(0, (30, 28, 32)), (0.5, (96, 88, 92)), (1, (170, 156, 150))])


def layer_ash(n, rng):
    low = spectral_noise(n, rng, beta=2.6, lo=1, hi=20)
    fine = spectral_noise(n, rng, beta=1.0, lo=20, hi=256)
    v = 0.5 + 0.2 * (low - 0.5) + 0.12 * (fine - 0.5)
    img = colour_map(np.clip(v, 0, 1), [(0, (82, 76, 74)), (0.5, (140, 130, 124)), (1, (196, 186, 176))])
    cv = Canvas(n, 2, img)
    for _ in range(260):  # cinders
        x, y = rng.uniform(0, n, 2)
        pebble(cv, rng, x, y, rng.uniform(1.6, 4.4), mix((58, 50, 50), (96, 84, 80), rng.uniform()), light=1.3, dark=0.6)
    img = cv.result()
    # Pale ash drifts: broad, soft, all leaning one way.
    drifts = spectral_noise(n, rng, beta=2.2, lo=2, hi=24, aniso=(1.0, 0.35))
    return lerp(img, np.array([206, 198, 188], np.float32), (np.clip((drifts - 0.6) * 2.5, 0, 1) * 0.55)[..., None])


def layer_cliff(n, rng):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    warp = spectral_noise(n, rng, beta=2.4, lo=1, hi=10)
    # Strata: whole-tile horizontal bands (v runs up the face), wobbling with the warp.
    bands = 0.5 + 0.5 * np.sin(2 * np.pi * (6 * ys / n) + (warp - 0.5) * 3.0)
    steps = np.floor(bands * 4) / 4
    grain = spectral_noise(n, rng, beta=1.5, lo=6, hi=200)
    f1, f2, cell, pts = worley(n, rng, 0, jitter=0.9, grid=6)
    vertical = ridge_lines(f1, f2, 2.0) * (np.abs(np.gradient(f1)[1]) > 0.3)
    v = 0.44 + 0.2 * (steps - 0.5) + 0.08 * (bands - 0.5) + 0.12 * (grain - 0.5)
    # Ledges: a bright lip on top of each band step, a shadow under it.
    ledge = np.roll(steps, 2, axis=0) - steps
    v += np.clip(ledge * 0.6, -0.1, 0.12)
    v = v * (1 - 0.5 * vertical)
    return colour_map(np.clip(v, 0, 1), [(0, (70, 56, 48)), (0.5, (146, 120, 98)), (1, (212, 190, 160))])


BUILDERS = {
    "grass": lambda n, r: layer_grass(n, r),
    "grass-dry": lambda n, r: layer_grass(n, r, dry=True),
    "dirt": layer_dirt,
    "road": layer_road,
    "stone": layer_stone,
    "mud": layer_mud,
    "sand": lambda n, r: layer_sand(n, r),
    "hardpan": layer_hardpan,
    "snow": layer_snow,
    "ice": layer_ice,
    "basalt": layer_basalt,
    "ash": layer_ash,
    "beach": lambda n, r: layer_sand(n, r, beach=True),
    "cliff": layer_cliff,
}


def luminance(img):
    return (0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]) / 255.0


def to_mid_value(img, target=0.52):
    """Keeps every tile mid-value (the contract): scales it so its mean luminance is `target`."""
    mean = luminance(img).mean()
    return np.clip(img * (target / max(mean, 1e-3)), 0, 255)


def seam_error(img):
    """Mean step across the wrap seams relative to the mean step between neighbouring pixels (about 1 when seamless)."""
    a = img.astype(np.float32)
    inner = (np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()) / 2
    seam = (np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0, :] - a[-1, :]).mean()) / 2
    return seam / max(inner, 1e-6)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--out", default=os.path.join(root, "public", "textures", "ground"))
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--quality", type=int, default=90)
    p.add_argument("--from-masters", default="", help="export these layers from <folder>/<layer>.png masters instead of generating")
    p.add_argument("--only", default="")
    p.add_argument("--all", action="store_true", help="write all fourteen layers (overwrites the painted set)")
    p.add_argument("--preview", default="")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    names = [x for x in a.only.split(",") if x] or (LAYERS if a.all else GENERATED)
    tiles = []
    os.makedirs(os.path.join(a.out, "256"), exist_ok=True)
    for i, name in enumerate(names):
        if name not in LAYERS:
            sys.exit(f"unknown layer {name}")
        if a.from_masters:
            master = Image.open(os.path.join(a.from_masters, f"{name}.png")).convert("RGB")
            out = master.resize((a.size, a.size), Image.LANCZOS) if master.size != (a.size, a.size) else master
        else:
            rng = np.random.default_rng(9100 + LAYERS.index(name) * 131)
            out = Image.fromarray(to_mid_value(BUILDERS[name](a.size, rng)).astype(np.uint8), "RGB")
        path, small = os.path.join(a.out, f"{name}.webp"), os.path.join(a.out, "256", f"{name}.webp")
        out.save(path, "WEBP", quality=a.quality, method=6)
        # The phone copy: a quarter of the bytes and GPU memory; Eco and phones tile it at 6-8 m.
        out.resize((a.size // 2, a.size // 2), Image.LANCZOS).save(small, "WEBP", quality=a.quality, method=6)
        lum = luminance(np.asarray(out, np.float32))
        print(f"{name:10s} {os.path.getsize(path):7d} + {os.path.getsize(small):6d} bytes  mean luminance {lum.mean():.3f}  spread {lum.std():.3f}  seam {seam_error(np.asarray(out)):.2f}")
        tiles.append((name, out))
    if a.preview:
        # Each tile 2 x 2 (shows the seams), four across.
        cell = a.size // 2
        cols = 4
        rows = math.ceil(len(tiles) / cols)
        sheet = Image.new("RGB", (cols * cell * 2, rows * (cell * 2 + 18)), (24, 24, 24))
        d = ImageDraw.Draw(sheet)
        for k, (name, img) in enumerate(tiles):
            small = img.resize((cell, cell), Image.LANCZOS)
            x0, y0 = (k % cols) * cell * 2, (k // cols) * (cell * 2 + 18)
            for i in range(2):
                for j in range(2):
                    sheet.paste(small, (x0 + i * cell, y0 + 18 + j * cell))
            d.text((x0 + 4, y0 + 3), name, fill=(240, 240, 240))
        os.makedirs(os.path.dirname(os.path.abspath(a.preview)), exist_ok=True)
        sheet.save(a.preview)
        print("preview", a.preview)


if __name__ == "__main__":
    main()
