# Joins the frames of tools/fx-strips.mjs into one image per class and viewport, before (top row) over after (bottom row).
# Usage: python tools/fx-strip-montage.py <strips dir> <viewport> <out dir> [classes,comma]
import sys, os
from PIL import Image, ImageDraw
root, vp, out = sys.argv[1:4]
only = sys.argv[4].split(",") if len(sys.argv) > 4 else None
os.makedirs(out, exist_ok=True)
classes = sorted(set(os.listdir(os.path.join(root, "after", vp))) | set(os.listdir(os.path.join(root, "before", vp))) if os.path.isdir(os.path.join(root, "before", vp)) else os.listdir(os.path.join(root, "after", vp)))
for name in classes:
    if only and name not in only: continue
    rows = []
    for label in ("before", "after"):
        d = os.path.join(root, label, vp, name)
        if os.path.isdir(d): rows.append((label, sorted(f for f in os.listdir(d) if f.endswith(".png"))[::2]))
    if not rows: continue
    first = Image.open(os.path.join(root, rows[0][0], vp, name, rows[0][1][0]))
    w, h = first.size; cols = 8; scale = 1 if vp == "desktop" else 1
    cw, ch = w // scale, h // scale
    frames = max(len(r[1]) for r in rows)
    lines = -(-frames // cols)
    sheet = Image.new("RGB", (cols * cw, len(rows) * lines * ch + len(rows) * 16), (18, 20, 24))
    g = ImageDraw.Draw(sheet); y = 0
    for label, files in rows:
        g.text((4, y + 2), f"{name} - {label} ({vp})", fill=(255, 255, 255)); y += 16
        for i, f in enumerate(files):
            im = Image.open(os.path.join(root, label, vp, name, f)).convert("RGB")
            sheet.paste(im, ((i % cols) * cw, y + (i // cols) * ch))
        y += lines * ch
    path = os.path.join(out, f"{name}-{vp}.jpg"); sheet.save(path, quality=80); print(path, sheet.size)
