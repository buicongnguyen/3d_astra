# Packs the Codex weapon VFX sheets (owner-commissioned, codex-vfx, codex-vfx2 and the optional codex-vfx3) into ONE atlas per
# tier, as WebP with a straight alpha, and writes src/fx-atlas-layout.json (frame rectangles normalised to the atlas, identical
# for both tiers).
# Usage: python tools/pack-fx-atlas.py <codex-vfx dir> <codex-vfx2 dir> [<codex-vfx3 dir>] [--out <dir>] [--layout <json>]
#   -> public/fx/fx-atlas.webp (desktop, 128 px frames), public/fx/fx-atlas-phone.webp (64 px frames, same UVs)
# codex-vfx3 (V4 signature shots, docs/ASSET_PIPELINE.md): each of its nine sheets joins the atlas when its PNG is in the folder
# (and its -phone.png, else the desktop sheet halved); the game takes a sheet when the layout lists it and falls back to its
# procedural cells otherwise, so dropping sheets in and re-running this needs no code change. Their transparent texels are
# black in the source: the edge colours are bled into those gutters (per cell) so filtering never draws a dark halo.
# --out and --layout write elsewhere (a trial pack); the defaults are the game's own files.
import sys, os, json, math
from PIL import Image
args, opts = [], {}
argv = sys.argv[1:]
while argv:
    a = argv.pop(0)
    if a.startswith("--"): opts[a[2:]] = argv.pop(0)
    else: args.append(a)
V1, V2 = args[0], args[1]
V3 = args[2] if len(args) > 2 else None
# name, directory, file stem, crop (x, y, w, h in desktop px or None), frame w, frame h (in the atlas), columns, frame count
# [, scale: the crop is resized by it into the atlas]
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
# V4 signature shots (codex-vfx3, optional; README there): frames 0-7 a flight loop pointing right, 8-15 the impact once. Each
# sheet is split: the flight loop at 64 px frames (a round in flight draws at about 30-50 CSS px) as `<name>`, the impact at
# the painted 128 px as `<name>Hit` (frames 0-7 of that item); lightning-arcs (16 poses, one per arc segment) and muzzle-energy
# (rows of four: cyan, electric blue, gold, violet) at 64 px. So the desktop atlas stays under 20 MB of texture memory
# (tests/fx-sprites.test.js) without a second atlas (which would cost a draw). All normal alpha.
V3_SPLIT = [("orbCyan", "orb-plasma-cyan"), ("orbElectric", "orb-electric-blue"), ("crescent", "crescent-violet"), ("sunDisc", "sun-disc-gold"),
            ("moltenSlug", "molten-slug"), ("voidOrb", "void-orb"), ("hoop", "ring-hoop-cyan")]
V3_WHOLE = [("lightning", "lightning-arcs"), ("muzzleEnergy", "muzzle-energy")]
if V3:
    for name, stem in V3_SPLIT:
        if not os.path.exists(os.path.join(V3, stem + ".png")): continue
        ITEMS.append((name, V3, stem, (0, 0, 512, 256), 64, 64, 4, 8, 0.5))
        ITEMS.append((name + "Hit", V3, stem, (0, 256, 512, 256), 128, 128, 4, 8, 1))
    for name, stem in V3_WHOLE:
        if os.path.exists(os.path.join(V3, stem + ".png")): ITEMS.append((name, V3, stem, None, 64, 64, 4, 16, 0.5))
ITEMS = [item if len(item) == 9 else (*item, 1) for item in ITEMS]
W, G = 2048, 64
# Skyline packing on a 64 px grid, tallest (then widest) first: each item goes as low as it fits, leftmost on a tie.
def extent(item):
    name, d, stem, crop, fw, fh, cols, n, scale = item
    w, h = (crop[2], crop[3]) if crop else Image.open(os.path.join(d, stem + ".png")).size
    return round(w * scale), round(h * scale)
sizes = {i: extent(item) for i, item in enumerate(ITEMS)}
order = sorted(range(len(ITEMS)), key=lambda i: (-sizes[i][1], -sizes[i][0], i))
sky, place = [0] * (W // G), {}
for i in order:
    w, h = sizes[i]; span = w // G
    y, c0 = min((max(sky[c:c + span]), c) for c in range(0, len(sky) - span + 1))
    place[i] = (c0 * G, y)
    for c in range(c0, c0 + span): sky[c] = y + h
H = -(-max(sky) // 64) * 64
layout = {"width": W, "height": H, "items": {}}
for i, (name, d, stem, crop, fw, fh, cols, n, scale) in enumerate(ITEMS):
    px, py = place[i]
    layout["items"][name] = {"x": px / W, "y": py / H, "fw": fw / W, "fh": fh / H, "cols": cols, "count": n, "pw": fw, "ph": fh}
here = os.path.dirname(os.path.abspath(__file__))
json.dump(layout, open(opts.get("layout") or os.path.join(here, "..", "src", "fx-atlas-layout.json"), "w", newline="\n"), indent=1)

def bleed_gutters(im, cell, passes=3):
    """The codex-vfx3 sheets keep black RGB under alpha 0: spread each cell's edge colours `passes` texels outwards into its
    transparent texels (alpha untouched), so bilinear filtering at the edges mixes in the shape's own colour, not black. The
    atlas has no mipmaps (src/fx-sprites.js), so a few texels are enough; texels further out stay black (they compress best)."""
    import numpy as np
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    for cy in range(0, h, cell):
        for cx in range(0, w, cell):
            c = a[cy:cy + cell, cx:cx + cell]
            known = c[..., 3] > 0
            if not known.any() or known.all(): continue
            rgb = c[..., :3] * known[..., None]
            for _ in range(passes):
                total = np.zeros_like(rgb); count = np.zeros(known.shape, np.float32)
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                    k = np.roll(np.roll(known, dy, 0), dx, 1); v = np.roll(np.roll(rgb, dy, 0), dx, 1)
                    # no wrap-around across the cell's edges
                    if dy == -1: k[-1, :] = False
                    if dy == 1: k[0, :] = False
                    if dx == -1: k[:, -1] = False
                    if dx == 1: k[:, 0] = False
                    total += v * k[..., None]; count += k
                grow = (~known) & (count > 0)
                if not grow.any(): break
                rgb[grow] = total[grow] / count[grow][..., None]
                known = known | grow
            c[..., :3] = rgb
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), "RGBA")
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
    for i, (name, d, stem, crop, fw, fh, cols, n, scale) in enumerate(ITEMS):
        path = os.path.join(d, stem + ("-phone" if suffix else "") + ".png")
        if d == V3 and suffix and not os.path.exists(path):
            im = Image.open(os.path.join(d, stem + ".png")).convert("RGBA")
            im = im.resize((im.width // 2, im.height // 2), Image.Resampling.LANCZOS)
        else:
            im = Image.open(path).convert("RGBA")
        if d == V3: im = bleed_gutters(im, round(fw / scale) // k)
        remove_printed_rings(im, name, fw // k)
        if crop:
            c = tuple(v // k for v in crop); im = im.crop((c[0], c[1], c[0] + c[2], c[1] + c[3]))
        if scale != 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
            if d == V3: im = bleed_gutters(im, fw // k, 2)
        px, py = place[i]; atlas.paste(im, (px // k, py // k))
    path = os.path.join(opts.get("out") or os.path.join(here, "..", "public", "fx"), f"fx-atlas{suffix}.webp")
    atlas.save(path, "WEBP", quality=q, alpha_quality=90, method=6, exact=True)
    print(os.path.basename(path), atlas.size, os.path.getsize(path))
