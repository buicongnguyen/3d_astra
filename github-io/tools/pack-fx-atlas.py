# Packs the Codex weapon VFX sheets (owner-commissioned) into one atlas per tier, as lossless-alpha-quality WebP.
# Usage: python tools/pack-fx-atlas.py <codex-vfx dir>   -> public/fx/fx-atlas.webp (1536x2048), fx-atlas-phone.webp (768x1024)
# The sheet order and grid must match src/fx-sprites-data.js (SHEETS, GRID_COLS).
import sys, os
from PIL import Image
SHEETS = ["tank-shell-impact", "rocket-explosion", "artillery-blast", "flak-burst", "flame-jet", "beam-impact",
          "heal-sparkle", "air-bomb-blast", "smoke-trail", "scorch-decals", "muzzle-flash"]
COLS = 3
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), "..", "public", "fx")
for suffix, cell, q in (("", 512, 88), ("-phone", 256, 88)):
    rows = -(-len(SHEETS) // COLS)
    atlas = Image.new("RGBA", (COLS * cell, rows * cell), (0, 0, 0, 0))
    for i, name in enumerate(SHEETS):
        im = Image.open(os.path.join(src, f"{name}{suffix}.png")).convert("RGBA")
        assert im.size == (cell, cell), (name, im.size)
        atlas.paste(im, ((i % COLS) * cell, (i // COLS) * cell))
    path = os.path.join(out, f"fx-atlas{suffix}.webp")
    atlas.save(path, "WEBP", quality=q, alpha_quality=100, method=6, exact=True)
    print(path, atlas.size, os.path.getsize(path))
