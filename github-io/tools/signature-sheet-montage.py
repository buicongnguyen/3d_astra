# Joins the frames of tools/signature-sheet.mjs into one contact sheet per faction and viewport: a row per unit (muzzle, flight,
# landing), every other frame; with a "before" label beside an "after" one, the before row sits over the after row.
# Usage: python tools/signature-sheet-montage.py <sheet dir> <viewport> <out dir> [labels,comma (default after)] [frames per row]
import sys, os
from PIL import Image, ImageDraw
root, vp, out = sys.argv[1:4]
labels = sys.argv[4].split(",") if len(sys.argv) > 4 else ["after"]
per = int(sys.argv[5]) if len(sys.argv) > 5 else 10
os.makedirs(out, exist_ok=True)
factions = sorted(set(f for label in labels if os.path.isdir(os.path.join(root, label, vp)) for f in os.listdir(os.path.join(root, label, vp))))
for faction in factions:
    rows = []
    units = []
    for label in labels:
        d = os.path.join(root, label, vp, faction)
        if os.path.isdir(d):
            for u in sorted(os.listdir(d), key=lambda u: os.path.getmtime(os.path.join(d, u))):
                if u not in units: units.append(u)
    for unit in units:
        for label in labels:
            d = os.path.join(root, label, vp, faction, unit)
            if not os.path.isdir(d): continue
            files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
            step = max(1, len(files) // per)
            rows.append((f"{unit} {label}" if len(labels) > 1 else unit, [os.path.join(d, f) for f in files[::step][:per]]))
    if not rows: continue
    w, h = Image.open(rows[0][1][0]).size
    pad = 18
    sheet = Image.new("RGB", (per * w, len(rows) * (h + pad)), (16, 18, 22))
    g = ImageDraw.Draw(sheet)
    for r, (name, files) in enumerate(rows):
        y = r * (h + pad)
        g.text((4, y + 3), f"{faction} - {name} ({vp})", fill=(255, 255, 255))
        for i, f in enumerate(files):
            sheet.paste(Image.open(f).convert("RGB"), (i * w, y + pad))
    path = os.path.join(out, f"{faction}-{vp}.jpg")
    sheet.save(path, quality=85)
    print(path, sheet.size)
