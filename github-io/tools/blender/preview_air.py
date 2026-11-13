"""Review sheets and portraits for the air units (release 0.18, item 18.2).

  blender -b --factory-startup --python tools/blender/preview_air.py

Renders the exported GLBs (what the game loads) with preview_assets.py and composes:
  docs/aaa/review/air-units-sheet.png            colour
  docs/aaa/review/air-units-sheet-greyscale.png  silhouettes and values only
    row 1: scale lineup next to the Battle tank and Ranger, on the ground | at fly height
    row 2: each flyer from the game camera (orthographic, in-game direction)
    row 3: each flyer in a close 3/4 view
  docs/aaa/review/air-portraits.png  192 px unit-card portraits (team paint white, as in the
                                     atlas) for kite, hawk, balloon, glider, left to right.
The portrait atlas itself (src/art/portraits.webp) is not touched here.
"""
import math
import sys
import tempfile
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import preview_assets  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'docs' / 'aaa' / 'review'
AIR = ['kite', 'hawk', 'balloon', 'glider']
# Faction paint per flyer (Meridian mint is the player's default; kite is built by everyone).
PAINT = {'kite': '92ebc5', 'hawk': '92ebc5', 'balloon': 'ef7660', 'glider': 'edc76f'}
FLY = 3.5  # metres; the suggested fly height shown in the lineup


def render_panel(path, angle, names, grey):
    sys.argv = ['preview_assets.py', '--', str(path), angle, *names, *(['--greyscale'] if grey else []),
                '--hero-distance=1.7']
    preview_assets.main()


def load(path, w, h):
    img = bpy.data.images.load(str(path))
    img.scale(w, h)
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)


def save_png(pixels, path):
    h, w = pixels.shape[:2]
    img = bpy.data.images.new(Path(path).stem, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    img.filepath_raw = str(path)
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def sheet(tmp, grey):
    suffix = '-greyscale' if grey else ''
    ground = ['tank', 'ranger'] + [f'{n}:{PAINT[n]}' for n in AIR]
    flying = ['tank', 'ranger'] + [f'{n}@{FLY}:{PAINT[n]}' for n in AIR]
    W, H = 2400, 1350
    canvas = np.ones((H, W, 4), dtype=np.float32)
    canvas[..., :3] = .12
    rows = []  # (path, x, y, w, h); Blender images start at the bottom row
    for i, names in enumerate((ground, flying)):
        p = tmp / f'lineup{i}{suffix}.png'
        render_panel(p, 'game', names, grey)
        rows.append((p, i * 1200, 0, 1200, 675))
    for j, name in enumerate(AIR):
        for k, angle in enumerate(('game', 'hero')):
            p = tmp / f'{name}-{angle}{suffix}.png'
            render_panel(p, angle, [f'{name}:{PAINT[name]}'], grey)
            rows.append((p, j * 600, 675 + k * 338, 600, 337))
    for p, x, y, w, h in rows:
        y0 = H - y - h
        canvas[y0:y0 + h, x:x + w] = load(p, w, h)
    out = OUT / f'air-units-sheet{suffix}.png'
    save_png(canvas, out)
    print('AIR_SHEET', out, flush=True)


def portraits(tmp):
    """Same camera, light and paint as render_ui_art.portraits, one 192 px cell per flyer."""
    source = (HERE / 'render_ui_art.py').read_text(encoding='utf-8')
    ui = {'__file__': str(HERE / 'render_ui_art.py'), '__name__': 'render_ui_art'}
    exec(compile(source.rsplit('\nmain()', 1)[0], 'render_ui_art.py', 'exec'), ui)  # skip its main()
    cell = ui['CELL']
    bpy.context.scene.use_nodes = False  # the greyscale sheet left its compositor on
    strip = np.zeros((cell, cell * len(AIR), 4), dtype=np.float32)
    for index, name in enumerate(AIR):
        ui['reset']()
        ui['setup'](cell * 2, cell * 2, True, samples=64)
        ui['world'](ui['lin']('#6f8796'), 0.45)
        roots, objects = ui['import_glb'](name)
        ui['paint_team'](objects, ui['PAINT'])
        ui['place'](roots, objects, (0, 0, 0), 0)
        lo, hi = ui['bounds'](objects)
        centre = (lo + hi) / 2
        size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
        direction = preview_assets.Vector((-0.62, -1.0, 0.62)).normalized()
        cam = ui['camera'](centre + direction * size * 4, centre, ortho=1.0)
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        pts = [inv @ (o.matrix_world @ preview_assets.Vector(c)) for o in objects if o.type == 'MESH' for c in o.bound_box]
        xs, ys = [p.x for p in pts], [p.y for p in pts]
        cam.data.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.12
        right = cam.matrix_world.to_3x3() @ preview_assets.Vector((1, 0, 0))
        up = cam.matrix_world.to_3x3() @ preview_assets.Vector((0, 1, 0))
        cam.location += right * (max(xs) + min(xs)) / 2 + up * (max(ys) + min(ys)) / 2
        ui['light']('SUN', 'key', 3.6, ui['lin']('#ffe2b8'), rotation=(48, 0, -35), size=math.radians(4))
        ui['light']('SUN', 'rim', 3.0, ui['lin']('#bfe6ff'), rotation=(62, 0, 160), size=math.radians(8))
        ui['light']('SUN', 'fill', 0.9, ui['lin']('#9fc3ff'), rotation=(70, 0, 55), size=math.radians(20))
        path = tmp / f'portrait-{name}.png'
        ui['render'](path)
        strip[:, index * cell:(index + 1) * cell] = load(path, cell, cell)
    out = OUT / 'air-portraits.png'
    save_png(strip, out)
    print('AIR_PORTRAITS', out, flush=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='frontier-air-') as d:
        tmp = Path(d)
        for grey in (False, True):
            sheet(tmp, grey)
        portraits(tmp)


main()
