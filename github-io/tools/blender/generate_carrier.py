"""Troop carrier for Frontier Defence waves (0.22). Headless Blender 5.2.5 LTS; no external assets.

  blender -b --python tools/blender/generate_carrier.py -- [--manifest]

Writes public/models/carrier.glb. With --manifest it also records the model in
public/models/manifest.json (kind unit, `defence: true`, its triangle budget).

The shape follows the owner's own Tank_game_3D `transport.glb` (cab, ribbed cargo body, six
wheels, rescue stripe), rebuilt with this repository's kit so it keeps the runtime contract of
frontier_kit.py: one attribute set with baked COLOR_0, Team paint, single-sided materials,
Blender -Y as the front. Only four materials (Team, Armor, Undercarriage, Glass) plus the Lamp
headlights, so a carrier on the field costs few batches.
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
from frontier_kit import Asset, chamfered

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
R = math.pi / 2
BUDGET = 4500


def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.04):
    return a.part(name, mat).box(size, loc=loc, rot=rot, bevel=bevel, seg=1)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=14):
    return a.part(name, mat).cyl(r, depth, loc=loc, rot=rot, seg=seg, bevel=.015, bseg=1)


def carrier(a):
    # Six wheels on three axles, hubs in team paint (they read as the side's colour from above).
    for x in (-1.12, 1.12):
        for y in (-1.45, 0.25, 1.35):
            cyl(a, 'Wheels', 'Undercarriage', .46, .34, (x, y, .48), rot=(0, R, 0), seg=16)
            cyl(a, 'Wheel_hubs', 'Armor', .22, .37, (x, y, .48), rot=(0, R, 0), seg=10)
    box(a, 'Chassis', 'Undercarriage', (1.9, 4.2, .3), (0, 0, .72), bevel=.06)
    for x in (-1.12, 1.12):
        box(a, 'Fenders', 'Armor', (.5, 1.2, .12), (x, -1.45, 1.0), bevel=.04)
        box(a, 'Rear_fenders', 'Armor', (.5, 1.9, .12), (x, .8, 1.0), bevel=.04)
    # The cab at the front (-Y): an armoured nose, a sloped windscreen and a roof hatch.
    a.part('Cab', 'Team').prism(chamfered(2.05, 1.35, .22), 1.05, loc=(0, -1.55, 1.38), axis='Z', bevel=.06, seg=1, taper=.86)
    box(a, 'Hood', 'Armor', (1.8, .55, .4), (0, -2.25, 1.08), rot=(.18, 0, 0), bevel=.06)
    box(a, 'Windshield', 'Glass', (1.55, .08, .42), (0, -2.2, 1.62), rot=(-.09, 0, 0), bevel=.02)
    for x in (-1.03, 1.03):
        box(a, 'Side_windows', 'Glass', (.06, .6, .32), (x * .97, -1.55, 1.62), bevel=.015)
        box(a, 'Mirrors', 'Armor', (.12, .1, .22), (x * 1.08, -2.0, 1.62), bevel=.02)
    box(a, 'Roof_hatch', 'Armor', (.7, .55, .1), (0, -1.45, 1.96), bevel=.03)
    box(a, 'Bumper', 'Undercarriage', (2.1, .22, .28), (0, -2.55, .82), bevel=.05)
    for x in (-.62, .62):
        cyl(a, 'Headlights', 'Lamp', .12, .08, (x, -2.53, 1.12), rot=(R, 0, 0), seg=12)
    for i in range(4):
        box(a, 'Grille', 'Undercarriage', (.9, .05, .05), (0, -2.55, .95 + i * .09), bevel=.01)
    # The troop body behind: armoured walls, team-painted canvas roof over ribs, a rear ramp.
    box(a, 'Cargo_walls', 'Armor', (2.15, 2.85, .82), (0, .65, 1.36), bevel=.07)
    a.part('Canvas_roof', 'Team').prism([(-1.08, 0), (-.95, .35), (-.55, .55), (0, .62), (.55, .55), (.95, .35), (1.08, 0)],
                                        2.9, loc=(0, .65, 1.76), axis='Y', bevel=.02, seg=1)
    for y in (-.55, .05, .65, 1.25, 1.85):
        a.part('Cargo_ribs', 'Undercarriage').prism([(-1.11, 0), (-.98, .37), (-.57, .58), (0, .65), (.57, .58), (.98, .37), (1.11, 0)],
                                                    .09, loc=(0, y, 1.76), axis='Y', bevel=.01, seg=1)
    for x in (-1.09, 1.09):
        box(a, 'Rescue_stripe', 'Team', (.04, 2.6, .16), (x, .65, 1.26), bevel=.01)
        for y in (-.3, .4, 1.1, 1.8):
            box(a, 'Vision_slits', 'Glass', (.05, .32, .07), (x, y - .25, 1.56), bevel=.01)
    box(a, 'Rear_ramp', 'Armor', (1.9, .14, .78), (0, 2.12, 1.25), rot=(.12, 0, 0), bevel=.04)
    for x in (-.7, .7):
        box(a, 'Ramp_hinges', 'Undercarriage', (.22, .2, .14), (x, 2.12, .86), bevel=.02)
    box(a, 'Rear_step', 'Undercarriage', (1.5, .4, .1), (0, 2.25, .62), bevel=.03)
    cyl(a, 'Exhaust_stack', 'Undercarriage', .08, .9, (.95, -.95, 2.05), seg=10)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build(manifest=False):
    root = kit.workspace('FrontierCarrier')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    a = Asset('carrier', root, ao_distance=1, ao_samples=40)
    carrier(a)
    tris = count(a)
    if tris > BUDGET:
        raise RuntimeError(f'carrier: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'carrier.glb')
    print('CARRIER_ASSET', a.triangles(), (OUT / 'carrier.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'carrier'] + [
            {'name': 'carrier', 'file': 'carrier.glb', 'triangles': a.triangles(), 'kind': 'unit', 'defence': True, 'budget': BUDGET,
             'source': 'Kit rebuild after Tank_game_3D public/models/transport.glb (same owner)',
             'animation': 'Runtime articulated parts; no baked clips'}]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args)
