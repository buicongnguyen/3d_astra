# Packs the Codex weapon VFX sheets (owner-commissioned, codex-vfx and codex-vfx2) into ONE atlas per tier, as WebP with a
# straight alpha, and writes src/fx-atlas-layout.json (frame rectangles normalised to the atlas, identical for both tiers).
# Usage: python tools/pack-fx-atlas.py <codex-vfx dir> <codex-vfx2 dir>
#   -> public/fx/fx-atlas.webp (desktop, 128 px frames), public/fx/fx-atlas-phone.webp (64 px frames, same UVs)
import sys, os, json, math
from PIL import Image
V1, V2 = sys.argv[1], sys.argv[2]
# name, directory, file stem, crop (x, y, w, h in desktop px or None), frame w, frame h, columns, frame count
ITEMS = [
    ("tank", V2, "fireball-tank-shell", None, 128, 128, 4, 16),
    ("rocket", V2, "fireball-rocket", None, 128, 128, 4, 16),
    ("artillery", V2, "fireball-artillery", None, 128, 128, 4, 16),
    ("bomb", V2, "fireball-bomb", None, 128, 128, 4, 16),
    ("missile", V2, "missile-burst", None, 128, 128, 4, 16),
    ("tracer", V2, "tracer-streak", None, 128, 128, 4, 16),
    ("stomp", V2, "walker-stomp", None, 128, 128, 4, 16),
    ("heal", V2, "heal-beam-sparkle", None, 128, 128, 4, 16),
    ("flame", V2, "flame-jet-bright-atlas", (0, 0, 512, 256), 128, 128, 4, 8),
    ("flak", V1, "flak-burst", None, 128, 128, 4, 16),
    ("beam", V1, "beam-impact", None, 128, 128, 4, 16),
    ("muzzle", V1, "muzzle-flash", (0, 0, 512, 384), 128, 128, 4, 12),
    ("scorch", V1, "scorch-decals", (0, 0, 512, 256), 128, 128, 4, 8),
    ("smoke", V1, "smoke-trail", (0, 0, 512, 128), 128, 128, 4, 4),
    ("beamCyan", V2, "beam-line-cyan", None, 512, 64, 1, 1),
    ("beamMagenta", V2, "beam-line-magenta", None, 512, 64, 1, 1),
    ("healBeam", V2, "heal-beam", None, 512, 64, 1, 1),
    ("capCyan", V2, "beam-line-cyan-start-cap", (0, 0, 512, 128), 128, 128, 4, 4),
    ("endCyan", V2, "beam-line-cyan-end-flare", (0, 0, 512, 128), 128, 128, 4, 4),
    ("capMagenta", V2, "beam-line-magenta-start-cap", (0, 0, 512, 128), 128, 128, 4, 4),
    ("endMagenta", V2, "beam-line-magenta-end-flare", (0, 0, 512, 128), 128, 128, 4, 4),
    ("heads", V2, "projectile-heads", None, 64, 64, 3, 3),
]
W = 2048
# Shelf packing, tallest first.
order = sorted(range(len(ITEMS)), key=lambda i: -(ITEMS[i][3][3] if ITEMS[i][3] else Image.open(os.path.join(ITEMS[i][1], ITEMS[i][2] + ".png")).size[1]))
place, x, y, shelf = {}, 0, 0, 0
sizes = {}
for i in order:
    name, d, stem, crop, fw, fh, cols, n = ITEMS[i]
    w, h = (crop[2], crop[3]) if crop else Image.open(os.path.join(d, stem + ".png")).size
    if x + w > W: x, y, shelf = 0, y + shelf, 0
    place[i] = (x, y); sizes[i] = (w, h); x += w; shelf = max(shelf, h)
H = y + shelf
H = -(-H // 64) * 64
layout = {"width": W, "height": H, "items": {}}
for i, (name, d, stem, crop, fw, fh, cols, n) in enumerate(ITEMS):
    px, py = place[i]
    layout["items"][name] = {"x": px / W, "y": py / H, "fw": fw / W, "fh": fh / H, "cols": cols, "count": n, "pw": fw, "ph": fh}
here = os.path.dirname(os.path.abspath(__file__))
json.dump(layout, open(os.path.join(here, "..", "src", "fx-atlas-layout.json"), "w"), indent=1)
def remove_printed_rings(im, name, cell):
    """Keep the original flash, smoke and soil above each hand-traced shockwave."""
    if name not in ("tank", "bomb", "missile", "stomp"):
        return
    # The tank sheet's later poses are almost entirely its expanding ground ring.
    # Animate its own first star down to a glint, leaving the other palettes intact.
    if name == "tank":
        star = im.crop((0, 0, cell, cell))
        for frame in range(1, 16):
            size = max(1, round(cell * (0.78 ** frame)))
            glint = star.resize((size, size), Image.Resampling.LANCZOS)
            glint.putalpha(glint.getchannel("A").point(lambda a: round(a * 0.86 ** frame)))
            x, y = frame % 4 * cell, frame // 4 * cell
            im.paste((0, 0, 0, 0), (x, y, x + cell, y + cell))
            inset = (cell - size) // 2
            im.paste(glint, (x + inset, y + inset))
        return

    pixels = im.load()
    for frame in range(16):
        cx, cy = (frame % 4) * cell, (frame // 4) * cell
        for v in range(cell):
            for u in range(cell):
                r, g, b, alpha = pixels[cx + u, cy + v]
                if not alpha or (frame == 0 and name != "stomp"):
                    continue
                x = (u + 0.5) * 64 / cell - 32
                y = (v + 0.5) * 64 / cell - 32
                if name == "missile":
                    # Stay inside the inner edge of every expanding airburst ring.
                    radius = min(16, 3 + frame * 1.25)
                    edge = math.hypot(x, y) - radius
                else:
                    # Keep the original fire, soil and flying debris above the ellipse.
                    width = min(23, 6 + frame * 1.8)
                    lower = (6 if name == "bomb" else 4) - 0.015 * x * x
                    curve = math.hypot(x / width, max(0, y + 4) / 12) * width - width
                    edge = max(curve, y - lower)
                keep = max(0, min(1, (2 - edge) / 5))
                if keep < 1:
                    pixels[cx + u, cy + v] = (r, g, b, round(alpha * keep))

for suffix, k, q in (("", 1, 80), ("-phone", 2, 80)):
    atlas = Image.new("RGBA", (W // k, H // k), (0, 0, 0, 0))
    for i, (name, d, stem, crop, fw, fh, cols, n) in enumerate(ITEMS):
        im = Image.open(os.path.join(d, stem + ("-phone" if suffix else "") + ".png")).convert("RGBA")
        remove_printed_rings(im, name, fw // k)
        if crop:
            c = tuple(v // k for v in crop); im = im.crop((c[0], c[1], c[0] + c[2], c[1] + c[3]))
        px, py = place[i]; atlas.paste(im, (px // k, py // k))
    path = os.path.join(here, "..", "public", "fx", f"fx-atlas{suffix}.webp")
    atlas.save(path, "WEBP", quality=q, alpha_quality=90, method=6, exact=True)
    print(os.path.basename(path), atlas.size, os.path.getsize(path))
