"""Rampart ram tank for the Ashfall Salvage yard (AAA round 2, W2-A). Headless Blender 4.5; no external assets.

  blender --background --python tools/blender/generate_rampart.py -- [--manifest]

Writes public/models/rampart.glb. With --manifest it also records the model in
public/models/manifest.json (kind unit, its triangle budget, review pending).

A welded plough tank: a broad hull with riveted side skirts, a two-leaf plough blade across the nose
(rust-orange, a Team-coloured stripe along its lip), a squat turret with a short, fat ram gun, two
exhaust stacks and a scrap rack at the back. Rust-orange Ashfall paint, Team trim and a glowing Team
lamp so the side's colour reads from above.

Runtime contract (docs/ASSET_PIPELINE.md, tests/assets.test.js, src/view.js):
  * The model faces -Y in Blender (+Z in glTF), like every unit.
  * `Turret_head*` parts (turning about the `Turret_pivot` empty) and `Main_cannon` / `Muzzle_brake`
    parts form the TurretRig / BarrelRig that the view aims and recoils.
  * The muzzle ends 2.8 m ahead of the centre, 1.78 m high (the Battle tank's 'tank' shot starts at
    1.7 m high and 2.85 m ahead), so shells leave the gun above the blade.
  * Seven materials like the Battle tank: Team, TeamGlow, Rust (new), Steel, Undercarriage, Glass, Lamp.
    Grey COLOR_0 baked by the kit, single-sided, one attribute set.
"""
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y
ACROSS = (0, R90, 0)    # cylinder axis along X
BUDGET = 6300

# Ashfall paint, welded and weathered: a deep, saturated rust orange (COLOR_0 multiplies it by about 0.8,
# so it lands warm and vivid).
kit.MATERIALS['Rust'] = ('#f06a24', 0.3, 0.58, 0.0)


def tracks(a):
    belt = a.part('Tracks', 'Undercarriage')
    wheel = a.part('Wheels', 'Steel')
    for s in (-1, 1):
        x = s * 1.12
        belt.box((.56, 3.3, .74), loc=(x, .05, .4), bevel=.26, seg=2)
        for i in range(5):
            y = -1.2 + i * .6
            wheel.cyl(.25, .09, loc=(x + s * .29, y, .36), rot=ACROSS, seg=10, bevel=.02, bseg=1)
            belt.cyl(.1, .11, loc=(x + s * .31, y, .36), rot=ACROSS, seg=6, bevel=.01, bseg=1)
        # Cleats on the front and rear curves.
        for y0 in (-1, 1):
            for dz in (.3, -.3):
                belt.box((.6, .08, .05), loc=(x, y0 * 1.52, .4 + dz), bevel=.012, seg=1)


def hull(a):
    rust = a.part('Hull', 'Rust')
    rust.prism([(-1.7, .55), (-1.7, .8), (-1.25, 1.12), (1.3, 1.12), (1.62, .95), (1.62, .55)], 1.9, bevel=.06, seg=1)
    team = a.part('Trim', 'Team')
    steel = a.part('Steel', 'Steel')
    dark = a.part('Deck', 'Undercarriage')
    for s in (-1, 1):
        # Riveted side skirts hanging over the tracks, with a Team stripe along the top edge.
        skirt = a.part('Skirt', 'Rust')
        skirt.box((.12, 3.0, .56), loc=(s * 1.5, .05, .78), bevel=.04, seg=1, taper=(1, .97))
        team.box((.14, 2.9, .09), loc=(s * 1.5, .05, 1.1), bevel=.02, seg=1)
        steel.bolts([(s * 1.58, y, .78) for y in (-1.2, -.6, 0, .6, 1.2)], r=.045, h=.04, rot=ACROSS)
        # Welded gussets between skirt and hull.
        for y in (-1.0, 0.1, 1.2):
            steel.box((.28, .1, .22), loc=(s * 1.38, y, 1.0), bevel=.02, seg=1)
        # Exhaust stacks at the back, with dark caps.
        steel.cyl(.12, .85, loc=(s * .62, 1.5, 1.45), seg=10, bevel=.02, bseg=1)
        dark.cyl(.15, .1, loc=(s * .62, 1.5, 1.92), seg=10, bevel=.02, bseg=1)
        a.part('Lamps', 'Lamp').box((.2, .05, .1), loc=(s * .55, -1.72, .98), bevel=.01, seg=1)
    # Engine deck behind the turret and a scrap rack at the tail.
    dark.grille(1.2, .55, loc=(0, 1.0, 1.14), rot=(-R90, 0, 0), slats=6, depth=.09, thickness=.05)
    steel.box((1.5, .12, .5), loc=(0, 1.72, .98), bevel=.03, seg=1)
    for x in (-.5, 0, .5):
        steel.box((.12, .2, .55), loc=(x, 1.76, 1.3), bevel=.02, seg=1)
    team.box((1.4, .1, .09), loc=(0, 1.78, 1.6), bevel=.02, seg=1)


def plough(a):
    """Two angled blade leaves meeting at the centre line, on a pair of push arms."""
    rust = a.part('Blade', 'Rust')
    team = a.part('Blade_trim', 'Team')
    steel = a.part('Blade_arms', 'Steel')
    dark = a.part('Blade_back', 'Undercarriage')
    for s in (-1, 1):
        yaw = s * .42  # the outer ends sweep back: a plough, not a funnel
        # The leaf: a tall plate; a Team stripe along its top lip.
        rust.box((1.46, .26, 1.25), loc=(s * .66, -2.12, .98), rot=(0, 0, yaw), bevel=.07, seg=1, taper=(1, .9))
        team.box((1.5, .1, .1), loc=(s * .66, -2.27, 1.55), rot=(0, 0, yaw), bevel=.02, seg=1)
        # Cutting edge: a darker lip along the bottom.
        dark.box((1.5, .22, .12), loc=(s * .66, -2.18, .42), rot=(0, 0, yaw), bevel=.03, seg=1)
        # Rivets on the face.
        steel.bolts([(s * (.18 + k * .3), -2.27 - (.18 + k * .3) * .05, .95 + j * .3)
                     for k in range(2) for j in (0, 1)], r=.045, h=.05, rot=FORWARD)
        # Push arms from the hull to the blade, with a hydraulic ram on top.
        steel.limb((s * .9, -1.55, .72), (s * .85, -2.0, .75), .2, .2, bevel=.04, seg=1)
        steel.cyl(.06, 1.0, loc=(s * .85, -1.9, 1.32), rot=(R90 + .22, 0, 0), seg=8, bevel=.01, bseg=1)
    # Centre spike where the leaves meet.
    steel.box((.26, .5, .5), loc=(0, -2.38, 1.0), bevel=.05, seg=1, taper=(.3, .3))
    a.part('Blade_glow', 'TeamGlow').box((.34, .06, .08), loc=(0, -2.27, 1.57), bevel=.01, seg=1)


def turret(a):
    steel = a.part('Steel', 'Steel')
    steel.cyl(.78, .16, loc=(0, .1, 1.2), seg=16, bevel=.03, bseg=1)
    a.pivot('Turret_pivot', (0, .1, 1.2))
    t = a.part('Turret_head', 'Rust')
    outline = [(-.7, .72), (.7, .72), (.82, .15), (.7, -.52), (.3, -.82), (-.3, -.82), (-.7, -.52), (-.82, .15)]
    t.prism(outline, .52, loc=(0, .1, 1.5), axis='Z', bevel=.06, taper=.88, seg=1)
    tteam = a.part('Turret_head', 'Team')
    for s in (-1, 1):
        tteam.box((.08, .85, .26), loc=(s * .76, .15, 1.5), rot=(0, 0, s * .12), bevel=.02)
    tteam.box((.34, .9, .04), loc=(0, .3, 1.78), bevel=.012, seg=1)
    tsteel = a.part('Turret_head', 'Steel')
    tsteel.box((.62, .26, .38), loc=(0, -.78, 1.58), bevel=.05)
    tsteel.cyl(.014, 1.0, loc=(-.5, .75, 2.2), seg=5, bevel=0)
    tsteel.cyl(.2, .06, loc=(.4, .4, 1.8), seg=14, bevel=.015)
    a.part('Turret_head', 'TeamGlow').sphere(.05, loc=(-.5, .75, 2.72), seg=8, rings=5)
    glass = a.part('Turret_head', 'Glass')
    for x in (.18, .52):
        glass.box((.1, .06, .07), loc=(x, .2, 1.8), bevel=.01, seg=1)
    # The ram gun: short, fat, with a flared brake. Muzzle at y = -2.8, z = 1.78.
    cannon = a.part('Main_cannon', 'Steel')
    cannon.cyl(.2, 1.15, loc=(0, -1.62, 1.78), rot=FORWARD, seg=12, bevel=.025, bseg=1)
    cannon.cyl(.26, .36, loc=(0, -1.18, 1.78), rot=FORWARD, seg=12, bevel=.035, bseg=1)
    brake = a.part('Muzzle_brake', 'Undercarriage')
    brake.cyl(.27, .4, loc=(0, -2.6, 1.78), rot=FORWARD, seg=12, r2=.3, bevel=.03, bseg=1)
    a.part('Muzzle_brake', 'TeamGlow').cyl(.1, .02, loc=(0, -2.81, 1.78), rot=FORWARD, seg=10, bevel=0)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build(manifest=False):
    root = kit.workspace('FrontierRampart')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    a = Asset('rampart', root, ao_distance=.9, grime_height=.55)
    tracks(a)
    hull(a)
    plough(a)
    turret(a)
    tris = count(a)
    if tris > BUDGET:
        raise RuntimeError(f'rampart: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'rampart.glb')
    print('RAMPART_ASSET', a.triangles(), (OUT / 'rampart.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'rampart'] + [
            {'name': 'rampart', 'file': 'rampart.glb', 'triangles': a.triangles(), 'kind': 'unit', 'budget': BUDGET,
             'review': 'pending owner review (round 3)',
             'source': 'tools/blender/generate_rampart.py (frontier_kit), original design',
             'animation': 'Runtime articulated parts: TurretRig and a recoiling BarrelRig; no baked clips'}]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args)
