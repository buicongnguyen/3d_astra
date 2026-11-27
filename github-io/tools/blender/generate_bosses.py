"""The two campaign bosses, redrawn at a readable size (owner request, 2026-11-23). Headless Blender 5.2.5 LTS.

  blender -b --python tools/blender/generate_bosses.py -- ironvanguard|ironsovereign|ironsovereign2

Writes public/models/<name>.glb. Run one boss per Blender process: each has its own palette for the kit's
material names. Sizes are real metres, so the runtime no longer enlarges a boss (BOSS_SCALE is 1).

Iron Vanguard: a slim rust-and-brass war walker, about 3.7 m tall, twin guns on each forearm.
Iron Sovereign: a brass six-legged crab fortress, about 5 m across, a domed turret and one long cannon.

Runtime contract (src/boss-view.js BOSS_PARTS): LeftLeg, RightLeg, Turret, ArmL, ArmR, LightGun for the
Vanguard; LegsA, LegsB, Turret, Cannon, LightGun for the Sovereign. Meshes under a part move with it and the
BossCore material is hidden until the core opens, so a dark socket sits behind it. Gun positions match
balance.json `muzzles`, `core` and `gun_height`.
"""
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit
from frontier_kit import Asset

OUT = HERE.parents[1] / 'public/models'
R = math.pi / 2
BUDGETS = {'ironvanguard': 3000, 'ironsovereign': 2800, 'ironsovereign2': 2800}


def palette(name):
    if name == 'ironvanguard':
        kit.MATERIALS.update({
            'Armor': ('#c4552f', 0.12, 0.34, 0.0),        # Ashfall rust red
            'Steel': ('#e9c47c', 0.9, 0.24, 0.0),         # polished brass
            'Undercarriage': ('#4b3a32', 0.35, 0.7, 0.0),
            'Visor': ('#5ff2ff', 0.0, 0.25, 3.0),
            'BossCore': ('#ffb347', 0.0, 0.3, 3.0),
        })
        kit.GLOWING.update({'Visor', 'BossCore'})
    else:
        kit.MATERIALS.update({
            'Armor': ('#e0a33e', 0.12, 0.34, 0.0),        # warm brass hull
            'Steel': ('#efe6d2', 0.9, 0.24, 0.0),
            'Undercarriage': ('#5a4436', 0.35, 0.7, 0.0),
            'Crimson': ('#c42b2b', 0.6, 0.24, 0.0),
            'BossCore': ('#ff7a3c', 0.0, 0.3, 3.0),
        })
        kit.GLOWING.add('BossCore')


def box(a, name, mat, size, loc, rot=(0, 0, 0), parent=None, bevel=.05, taper=(1, 1)):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=1, taper=taper)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), parent=None, seg=8, r2=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, r2=r2, bevel=.008, bseg=1)


def limb(a, name, mat, p, q, w, d, parent=None):
    return a.part(name, mat, parent).limb(p, q, w, d, bevel=.04, seg=1)


def vanguard(a):
    hip_z = 1.72
    for sign, pivot in ((-1, 'LeftLeg'), (1, 'RightLeg')):
        a.pivot(pivot, (sign * .47, 0, hip_z))
        cyl(a, 'Hip', 'Steel', .2, .3, (0, 0, 0), rot=(0, R, 0), parent=pivot)
        limb(a, 'Thigh', 'Armor', (0, .03, -.05), (0, -.08, -.76), .4, .48, parent=pivot)
        cyl(a, 'Knee', 'Steel', .17, .46, (0, -.1, -.8), rot=(0, R, 0), parent=pivot)
        box(a, 'Knee guard', 'Team', (.3, .1, .3), (0, -.31, -.8), rot=(.25, 0, 0), parent=pivot)
        box(a, 'Shin', 'Armor', (.42, .56, .72), (0, -.02, -1.2), parent=pivot, taper=(1.12, 1.12))
        box(a, 'Shin stripe', 'Team', (.13, .04, .46), (0, -.31, -1.2), parent=pivot, bevel=.012)
        box(a, 'Ankle', 'Undercarriage', (.3, .34, .16), (0, 0, -1.56), parent=pivot)
        box(a, 'Foot', 'Undercarriage', (.56, .98, .16), (0, -.16, -1.64), parent=pivot, bevel=.06, taper=(.82, .9))
        box(a, 'Toe cap', 'Steel', (.46, .16, .1), (0, -.6, -1.63), parent=pivot, bevel=.03)
    box(a, 'Pelvis', 'Undercarriage', (.86, .62, .34), (0, 0, 1.76), taper=(1.15, 1.1))
    box(a, 'Pelvic plate', 'Armor', (.42, .1, .3), (0, -.32, 1.72), rot=(-.15, 0, 0), bevel=.03)
    cyl(a, 'Waist', 'Steel', .3, .16, (0, 0, 1.96))

    p = a.pivot('Turret', (0, 0, 2.0))
    box(a, 'Torso', 'Armor', (1.0, .78, .76), (0, .02, .42), parent=p, bevel=.1, taper=(1.36, 1.16))
    box(a, 'Breastplate L', 'Armor', (.46, .1, .62), (-.3, -.46, .46), rot=(-.12, 0, .22), parent=p, bevel=.03)
    box(a, 'Breastplate R', 'Armor', (.46, .1, .62), (.3, -.46, .46), rot=(-.12, 0, -.22), parent=p, bevel=.03)
    box(a, 'Chest trim', 'Team', (.86, .06, .08), (0, -.5, .8), parent=p, bevel=.015)
    a.part('Core ring', 'Steel', p).torus(.2, .045, loc=(0, -.52, .38), rot=(R, 0, 0), seg=10, ring=4)
    cyl(a, 'Core socket', 'Undercarriage', .19, .06, (0, -.5, .38), rot=(R, 0, 0), parent=p, seg=7)
    a.part('Core', 'BossCore', p).sphere(.17, loc=(0, -.54, .38), seg=8, rings=5)
    box(a, 'Neck', 'Undercarriage', (.3, .3, .14), (0, -.04, .88), parent=p)
    box(a, 'Head', 'Armor', (.46, .54, .32), (0, -.08, 1.06), parent=p, bevel=.08, taper=(.82, .86))
    box(a, 'Visor', 'Visor', (.36, .05, .08), (0, -.36, 1.07), parent=p, bevel=.012)
    box(a, 'Crest', 'Team', (.07, .62, .2), (0, .02, 1.28), parent=p, bevel=.02, taper=(1, .55))
    for sign in (-1, 1):
        cyl(a, 'Reactor', 'Steel', .17, .68, (sign * .28, .52, .5), parent=p, seg=7)
        cyl(a, 'Reactor cap', 'Undercarriage', .19, .08, (sign * .28, .52, .86), parent=p, seg=7)

    for sign, pivot in ((-1, 'ArmL'), (1, 'ArmR')):
        a.pivot(pivot, (sign * .95, 0, 2.72))
        a.part('Shoulder', 'Steel', pivot).sphere(.24, seg=8, rings=5)
        box(a, 'Pauldron', 'Team', (.56, .7, .24), (sign * .06, 0, .2), parent=pivot, bevel=.09, taper=(.76, .84))
        box(a, 'Pauldron rim', 'Armor', (.6, .74, .07), (sign * .06, 0, .07), parent=pivot, bevel=.025)
        limb(a, 'Upper arm', 'Armor', (0, 0, -.1), (0, 0, -.5), .28, .3, parent=pivot)
        box(a, 'Forearm', 'Armor', (.4, .78, .3), (0, -.34, -.66), parent=pivot, bevel=.06)
        box(a, 'Gun stripe', 'Team', (.12, .5, .03), (0, -.34, -.5), parent=pivot, bevel=.008)
        for dx in (-.11, .11):
            cyl(a, 'Barrel', 'Steel', .065, .78, (dx, -1.02, -.7), rot=(R, 0, 0), parent=pivot, seg=8)
            cyl(a, 'Barrel tip', 'Undercarriage', .085, .1, (dx, -1.42, -.7), rot=(R, 0, 0), parent=pivot, seg=8)

    g = a.pivot('LightGun', (.34, -.06, 3.2))
    box(a, 'Light mount', 'Undercarriage', (.16, .3, .12), (0, 0, 0), parent=g, bevel=.03)
    cyl(a, 'Light barrel', 'Steel', .04, .5, (0, -.36, .01), rot=(R, 0, 0), parent=g, seg=8)


def sovereign(a):
    for pivot, feet in (('LegsA', ((-1, -1), (1, 0), (-1, 1))), ('LegsB', ((1, -1), (-1, 0), (1, 1)))):
        a.pivot(pivot, (0, 0, 0))
        for sx, row in feet:
            y0, y1, y2 = row * .86, row * 1.28, row * 1.62
            hip, knee, foot = (sx * .92, y0, 1.04), (sx * 1.88, y1, 1.42), (sx * 2.42, y2, .1)
            cyl(a, 'Leg hip', 'Steel', .16, .32, hip, rot=(R, 0, 0), parent=pivot, seg=7)
            limb(a, 'Leg upper', 'Armor', hip, knee, .3, .34, parent=pivot)
            a.part('Leg knee', 'Team', pivot).sphere(.2, loc=knee, seg=7, rings=4)
            limb(a, 'Leg lower', 'Crimson', knee, (foot[0], foot[1], .34), .2, .24, parent=pivot)
            cyl(a, 'Leg foot', 'Undercarriage', .17, .24, (foot[0], foot[1], .18), parent=pivot, seg=6, r2=.25)

    a.part('Chassis', 'Undercarriage').lathe([(.0, .62), (.72, .62), (1.14, .86), (1.28, 1.08), (1.22, 1.24), (0, 1.24)], seg=12)
    a.part('Chassis ring', 'Team').torus(1.26, .07, loc=(0, 0, 1.14), seg=14, ring=4)

    p = a.pivot('Turret', (0, 0, 1.2))
    a.part('Carapace', 'Armor', p).lathe([(1.2, .04), (1.16, .26), (.98, .56), (.66, .8), (.28, .93), (0, .96)], seg=14)
    a.part('Carapace band', 'Crimson', p).torus(1.075, .04, loc=(0, 0, .42), seg=14, ring=4)
    a.part('Carapace trim', 'Team', p).torus(.78, .03, loc=(0, 0, .72), seg=12, ring=4)
    a.part('Crown ring', 'Steel', p).torus(.32, .05, loc=(0, 0, .9), seg=10, ring=4)
    cyl(a, 'Crown', 'Team', .24, .14, (0, 0, .98), parent=p, seg=7, r2=.16)
    a.part('Core ring', 'Steel', p).torus(.22, .05, loc=(0, .78, .54), rot=(-.95, 0, 0), seg=10, ring=4)
    cyl(a, 'Core socket', 'Undercarriage', .21, .05, (0, .76, .53), rot=(-.95, 0, 0), parent=p, seg=7)
    a.part('Core', 'BossCore', p).sphere(.19, loc=(0, .8, .56), seg=8, rings=5)
    box(a, 'Mantlet', 'Crimson', (.66, .44, .46), (0, -1.0, .32), parent=p, bevel=.09, taper=(.82, .82))

    c = a.pivot('Cannon', (0, -1.18, 1.52))
    cyl(a, 'Cannon sleeve', 'Armor', .17, .62, (0, -.26, 0), rot=(R, 0, 0), parent=c, seg=7, r2=.13)
    cyl(a, 'Cannon barrel', 'Steel', .1, 1.06, (0, -.84, 0), rot=(R, 0, 0), parent=c, seg=7)
    cyl(a, 'Cannon brake', 'Crimson', .16, .2, (0, -1.38, 0), rot=(R, 0, 0), parent=c, seg=7)

    g = a.pivot('LightGun', (.62, -.36, 2.0))
    box(a, 'Light mount', 'Undercarriage', (.2, .34, .14), (0, 0, 0), parent=g, bevel=.03)
    cyl(a, 'Light barrel', 'Steel', .045, .56, (0, -.4, .02), rot=(R, 0, 0), parent=g, seg=8)


def build(name):
    palette(name)
    root_coll = kit.workspace('Frontier')
    kit.clear_workspace(root_coll)
    a = Asset(name, root_coll, ao_distance=.8, ao_samples=32)
    (vanguard if name == 'ironvanguard' else sovereign)(a)
    a.finish()
    root = bpy.data.objects.new(name, None)
    a.collection.objects.link(root)
    for o in a.collection.objects:
        if o is not root and o.parent is None:
            o.parent = root
    tris = a.triangles()
    if tris > BUDGETS[name]:
        raise RuntimeError(f'{name}: {tris} triangles > {BUDGETS[name]}')
    a.export(OUT / f'{name}.glb')
    print('BOSS_ASSET', name, tris, (OUT / f'{name}.glb').stat().st_size, flush=True)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(args[0])
