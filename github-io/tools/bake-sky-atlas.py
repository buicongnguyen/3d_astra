# Bakes the Hero-view sky atlas (src/art/sky/sky-atlas.webp, src/horizon-sky.js) from the title key art's own layers
# (src/art/cover/layer-*.webp, the owner's art): the ringed river world, the storm world, the dune moon, the small dark
# moon, the amber and silver suns, and a band of the wide nebula recoloured violet for night skies. One 1024x512 RGBA
# WebP, so the whole sky of planets is one texture and one draw. The planets keep a straight alpha; their transparent
# texels carry the edge colours (bled outward) so mipmaps never draw a dark halo. The nebula band is opaque black where
# it is empty: the game adds it (additive), so black adds nothing.
# The rectangles below are the game's: src/horizon-sky.js ATLAS must list the same ones.
# Usage: python tools/bake-sky-atlas.py [--out src/art/sky/sky-atlas.webp] [--quality 86]
import sys, os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
COVER = os.path.join(ROOT, "src", "art", "cover")
opts = dict(zip(sys.argv[1::2], sys.argv[2::2]))
OUT = opts.get("--out", os.path.join(ROOT, "src", "art", "sky", "sky-atlas.webp"))
QUALITY = int(opts.get("--quality", "86"))
W, H = 1024, 512
PAD = 4
# name -> (source layer, x, y, w, h): the cell in the atlas (the art is fitted inside it, PAD px from each side).
CELLS = {
    "ringed": ("planet-ringed-river", 0, 0, 576, 384),
    "storm": ("planet-storm", 576, 0, 384, 384),
    "silver": ("sun-silver", 960, 0, 64, 64),
    "ember": ("planet-ember", 960, 64, 64, 64),
    "dunes": ("planet-dunes", 640, 384, 128, 128),
    "amber": ("sun-amber", 768, 384, 128, 128),
}
NEBULA = (0, 384, 640, 128)


def bleed(img):
    """Fill the colour of transparent texels with a blur of the nearby opaque colours (alpha unchanged)."""
    a = np.asarray(img.getchannel("A"), dtype=np.float32) / 255.0
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    fill = np.zeros_like(rgb)
    weight = np.zeros_like(a)
    for radius in (2, 6, 16, 40):
        pre = Image.fromarray(np.clip(rgb * a[..., None], 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
        wa = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
        p = np.asarray(pre, dtype=np.float32)
        w = np.asarray(wa, dtype=np.float32) / 255.0
        take = (weight < 1e-3) & (w > 1e-3)
        fill[take] = p[take] / w[take][..., None]
        weight[take] = 1
    out = np.where(a[..., None] > 0.02, rgb, fill)
    alpha = np.where(a > 0.02, a, 0)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")


def nebula_band():
    src = Image.open(os.path.join(COVER, "layer-nebula-wide.webp")).convert("RGB")
    # The wavy band across the lower half of the wide nebula (rows 400-860 of 941).
    band = src.crop((0, 400, src.width, 860)).resize((NEBULA[2], NEBULA[3]), Image.LANCZOS)
    c = np.asarray(band, dtype=np.float32) / 255.0
    lum = c[..., 0] * 0.3 + c[..., 1] * 0.55 + c[..., 2] * 0.15
    lum = np.clip(lum - 0.025, 0, 1)
    warm = np.clip((c[..., 0] - c[..., 2]) * 3.0, 0, 1)  # the orange glow -> rose; the teal -> violet
    violet = np.array([0.56, 0.34, 1.0]); rose = np.array([1.0, 0.42, 0.82]); lilac = np.array([0.92, 0.84, 1.0])
    tint = violet[None, None, :] * (1 - warm[..., None]) + rose[None, None, :] * warm[..., None]
    col = lum[..., None] * 2.3 * tint
    hi = np.clip((lum - 0.28) * 2.5, 0, 1)[..., None]
    col = col * (1 - hi * 0.5) + lilac[None, None, :] * hi * lum[..., None] * 2.0
    # Soft ends and edges: the band fades out before its rectangle does.
    x = np.linspace(0, 1, NEBULA[2]); y = np.linspace(0, 1, NEBULA[3])
    sx = np.clip(np.minimum(x, 1 - x) / 0.14, 0, 1); sy = np.clip(np.minimum(y, 1 - y) / 0.2, 0, 1)
    win = (sx * sx * (3 - 2 * sx))[None, :] * (sy * sy * (3 - 2 * sy))[:, None]
    col = np.clip(col * win[..., None], 0, 1)
    return Image.fromarray((np.dstack([col, np.ones_like(lum)]) * 255).astype(np.uint8), "RGBA")


atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for name, (layer, x, y, w, h) in CELLS.items():
    img = Image.open(os.path.join(COVER, f"layer-{layer}.webp")).convert("RGBA")
    iw, ih = w - 2 * PAD, h - 2 * PAD
    k = min(iw / img.width, ih / img.height)
    fit = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    cell = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cell.paste(fit, ((w - fit.width) // 2, (h - fit.height) // 2))
    atlas.paste(bleed(cell), (x, y))
atlas.paste(nebula_band(), (NEBULA[0], NEBULA[1]))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
atlas.save(OUT, "WEBP", quality=QUALITY, alpha_quality=92, method=6, exact=True)
print(OUT, os.path.getsize(OUT), "bytes", f"{W}x{H}")
