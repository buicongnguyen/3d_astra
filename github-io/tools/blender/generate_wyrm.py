"""Dune Wyrm and Wyrmling for the Wild frontier desert test (AAA round 4, P1). Headless Blender 4.5; no external assets.

  blender -b --python tools/blender/generate_wyrm.py -- [--manifest] [--report]

Writes public/models/wyrm.glb (the tamed creature) and public/models/wyrmling.glb (the nest guard). With
--manifest it also records both in public/models/manifest.json (kind unit, triangle budget, review pending).

The Dune Wyrm is a sand serpent that rears up at the front: a segmented body of warm sandstone rings that
rises from a tail trailing on the ground into a raised neck, a wedge head with two hooked mandibles, a fan
crest and two glowing amber eyes, a row of glossy dorsal plates, and two short clawed forelegs. The
forelegs hang from the runtime's `leg_L`/`leg_R` pivots, so the renderer's gait swings them. A tamed Wyrm
wears its side's colour on a harness: two straps round the body, a saddle pad and the crest fan (Team), so
the side reads from above. The Wyrmling is the same animal young and small (no harness, a short crest):
the nest guards get a sand tint on their Team areas at runtime (src/wild-view.js).

Five materials (the Vanguard has six), so a Wyrm on screen costs five instanced draws: Hide (new: warm
sandstone, matte, kept on every team), Belly (new: pale cream underside, mandibles and claws), Ridge (new:
rust dorsal fins, crest spines and snout), Team (harness and crest fan) and Flame (the kit's glowing amber:
eyes and the throat glow). Blender -Y is the front.
"""
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit
from frontier_kit import Asset

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
R = math.pi / 2
BUDGETS = {'wyrm': 3200, 'wyrmling': 2600}

kit.MATERIALS.setdefault('Hide', ('#d98a3c', 0.0, 0.72, 0.0))
kit.MATERIALS.setdefault('Belly', ('#f6d9a0', 0.0, 0.8, 0.0))
kit.MATERIALS.setdefault('Ridge', ('#a8471f', 0.0, 0.6, 0.0))


def spine(t):
    """The body's centre line from the head end (t=0) to the tail tip (t=1): it rears up at the front
    and lies on the ground behind, with a gentle S to the side."""
    y = -0.7 + t * 3.3
    rise = max(0.0, 1.0 - t * 2.4)
    z = 0.4 + 1.15 * rise * rise
    x = 0.34 * math.sin(t * math.pi * 1.5)
    r = 0.5 * (1 - 0.62 * t) + 0.08
    return (x, y, z), r


def body(a, rings=9, harness=True, plates=True):
    pts = [spine(i / (rings - 1)) for i in range(rings)]
    for i, ((x, y, z), r) in enumerate(pts):
        # Each ring is a slightly flattened ball: the body reads as segmented sandstone.
        a.part('Body_ring', 'Hide').sphere((r * 1.08, r * 1.0, r * 0.94), loc=(x, y, z), seg=10, rings=6)
        # The pale underside where the ring meets the sand.
        a.part('Belly_plate', 'Belly').sphere((r * 0.86, r * 0.7, r * 0.42), loc=(x, y, z - r * 0.5), seg=8, rings=4, cut=0.0)
        if plates and i < rings - 1:
            # Glossy dorsal plates, one per ring, leaning back.
            a.part('Dorsal_plate', 'Ridge').prism([(-r * 0.5, 0), (r * 0.45, 0), (r * 0.15, r * 0.7)], r * 0.5, loc=(x, y + .05, z + r * 0.62), rot=(-.25, 0, 0), axis='X', bevel=.03, seg=1, taper=0.35)
    if harness:
        # Two straps round the body and a saddle pad between them: the tamer's colour.
        for i in (3, 5):
            (x, y, z), r = pts[i]
            a.part('Harness_strap', 'Team').torus(r * 1.02, .06, loc=(x, y, z), rot=(R, 0, 0), seg=12, ring=4)
        (x, y, z), r = pts[4]
        a.part('Saddle', 'Team').box((r * 1.1, r * 1.3, .16), loc=(x, y, z + r * 0.86), bevel=.04, seg=1)
    return pts


def head(a, at, r, crest=1.0):
    x, y, z = at
    # A wedge head, then the snout, the two hooked mandibles and the eyes.
    a.part('Head', 'Hide').box((r * 1.5, r * 1.9, r * 1.1), loc=(x, y - r * 0.75, z + r * 0.1), bevel=.08, seg=2, taper=(0.8, 0.85))
    a.part('Snout', 'Ridge').box((r * 1.1, r * 0.9, r * 0.5), loc=(x, y - r * 1.75, z + r * 0.2), bevel=.05, seg=1, taper=(0.7, 0.8))
    for s in (-1, 1):
        a.part('Mandible', 'Belly').prism([(0, 0), (-.08, -r * 0.9), (-.02, -r * 1.4), (.1, -r * 1.05), (.14, -r * 0.3)], .12,
                                          loc=(x + s * r * 0.42, y - r * 1.55, z - r * 0.38), rot=(0, 0, s * .35), axis='Z', bevel=.02, seg=1)
        a.part('Eye', 'Flame').sphere(r * 0.16, loc=(x + s * r * 0.55, y - r * 1.2, z + r * 0.42), seg=10, rings=6)
    # The throat glows where the Ambush strikes come from.
    a.part('Throat_glow', 'Flame').sphere((r * 0.4, r * 0.3, r * 0.2), loc=(x, y - r * 1.3, z - r * 0.38), seg=10, rings=5)
    # The fan crest: three spines with a web between them (Team on the tamed Wyrm, so the side shows from above).
    for i, k in enumerate((-1, 0, 1)):
        a.part('Crest_spine', 'Ridge').limb((x + k * r * 0.35, y - r * 0.3, z + r * 0.55), (x + k * r * 0.75, y + r * 0.55 * crest, z + r * (1.05 + 0.5 * crest)), .07, .07, bevel=.015, seg=1)
    a.part('Crest_fan', 'Team').prism([(-r * 0.75, 0), (r * 0.75, 0), (r * 0.7, r * 0.7 * crest), (0, r * 0.95 * crest), (-r * 0.7, r * 0.7 * crest)], .06,
                                      loc=(x, y - r * 0.05, z + r * 0.62), rot=(-.6, 0, 0), axis='Y', bevel=.015, seg=1)


def forelegs(a, at, r, size=1.0):
    x, y, z = at
    for sign, side in ((-1, 'L'), (1, 'R')):
        p = a.pivot('leg_' + side, (x + sign * r * 0.85, y, z - r * 0.1))
        a.part('Upper_leg', 'Hide', p).limb((0, 0, 0), (sign * .18 * size, -.12 * size, -.42 * size), .2 * size, .2 * size, bevel=.04, seg=1)
        a.part('Fore_leg', 'Belly', p).limb((sign * .18 * size, -.12 * size, -.42 * size), (sign * .12 * size, -.3 * size, -(z - r * 0.1) + .1), .15 * size, .15 * size, bevel=.03, seg=1)
        for k in (-1, 0, 1):
            a.part('Claw', 'Belly', p).cyl(.045 * size, .2 * size, loc=(sign * .12 * size + k * .07 * size, -.42 * size, -(z - r * 0.1) + .06), rot=(R * 1.2, 0, 0), seg=6, r2=.01)


def creature(a, young=False):
    rings = 7 if young else 10
    pts = body(a, rings=rings, harness=not young, plates=True)
    (hx, hy, hz), hr = pts[0]
    head(a, (hx, hy - hr * 0.2, hz + hr * 0.25), hr * 1.05, crest=0.55 if young else 1.0)
    (lx, ly, lz), lr = pts[1]
    forelegs(a, (lx, ly, lz), lr, size=0.8 if young else 1.0)
    if young:
        # The young one has a small Team-painted ridge (tinted sand at the nest by the view).
        (x, y, z), r = pts[2]
        a.part('Ridge_mark', 'Team').box((r * 0.5, r * 1.2, .08), loc=(x, y, z + r * 0.9), bevel=.02, seg=1)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build_one(name, young, manifest_rows, parts=False):
    root = kit.workspace('FrontierWyrm' + name)
    kit.clear_workspace(root)
    a = Asset(name, root, ao_distance=.9, ao_samples=40)
    creature(a, young)
    # Young Wyrmlings are 0.62 of a grown Wyrm: scale every shape about the ground under the body.
    if young:
        for shape in a.shapes.values():
            for v in shape.bm.verts:
                v.co *= 0.62
        # Parts on a pivot are authored relative to it: scaling the pivots too keeps them attached.
        for p in a.pivots.values():
            p.location *= 0.62
    tris = count(a)
    if parts:
        for key, shape in sorted(a.shapes.items(), key=lambda kv: -sum(len(f.verts) - 2 for f in kv[1].bm.faces)):
            print(f'WYRM_PART {name} {sum(len(f.verts) - 2 for f in shape.bm.faces):5d} {key}')
    if tris > BUDGETS[name]:
        raise RuntimeError(f'{name}: {tris} triangles > {BUDGETS[name]}')
    a.finish()
    a.export(OUT / f'{name}.glb')
    print('WYRM_ASSET', name, a.triangles(), (OUT / f'{name}.glb').stat().st_size, flush=True)
    manifest_rows.append({'name': name, 'file': f'{name}.glb', 'triangles': a.triangles(), 'kind': 'unit', 'budget': BUDGETS[name],
                          'review': 'pending owner review (round 4)', 'animation': 'Runtime articulated parts (foreleg pivots); no baked clips'})


def build(manifest=False, parts=False):
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    build_one('wyrm', False, rows, parts)
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_one('wyrmling', True, rows, parts)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        names = {r['name'] for r in rows}
        data['assets'] = [e for e in data['assets'] if e['name'] not in names] + rows
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args, parts='--report' in args)
