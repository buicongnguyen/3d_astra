"""Stalker for the Veil workshop (AAA round 2, W1-C). Headless Blender 5.2.5 LTS; no external assets.

  blender -b --python tools/blender/generate_stalker.py -- [--manifest] [--report]

Writes public/models/stalker.glb. With --manifest it also records the model in
public/models/manifest.json (kind unit, its triangle budget, review pending: the owner has not seen it yet).

A hooded long-rifle sniper: a deep violet hood and a split cloak that trails behind it, a very long barrel
with a muzzle brake and a folded bipod, and a big scope with a green objective lens (the lens and the visor
slit are the only lit parts, so a hidden unit that has just fired reads at once). Team paint sits on the
hood trim, the shins, the shoulder tabs, the scope bell and the stock, so the side's colour shows from
above. Built with this repository's kit (frontier_kit.py) so it keeps the runtime contract: one attribute
set with baked COLOR_0, Team paint, single-sided materials, Blender -Y as the front, `leg_L` and `leg_R`
pivots at the hips, and Barrel*/Muzzle* parts for the aim and recoil rig (visual-style.json `weapons.stalker`
matches the muzzle: 2.5 m ahead, 1.4 m up).

Seven materials, as many as the Ranger: Cloak (new, violet, kept on every team), Team, Armor, Steel,
Undercarriage, Suit and Lens (new, green glow, kept on every team).
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
BUDGET = 3000
MIN_TRIANGLES = 2600

# Two materials the kit does not have: a violet cloak and a green lens. Like the kit's Flame, they keep
# their own colour on every team (only `Team*` is recoloured at runtime). Added here, not in the shared kit.
kit.MATERIALS.setdefault('Cloak', ('#8e63ee', 0.0, 0.78, 0.0))
kit.MATERIALS.setdefault('Lens', ('#32ff86', 0.0, 0.22, 2.6))
kit.GLOWING.add('Lens')


def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.035, parent=None):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=1)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12, parent=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, bevel=.015, bseg=1)


def beam(a, name, mat, start, end, width=.09):
    return a.part(name, mat).limb(start, end, width, width, bevel=.015, seg=1)


def legs(a, wide=.2, height=.94):
    # The renderer swings these two pivots (leg_L, leg_R): every leg part hangs from one of them.
    for sign, side in [(-1, 'L'), (1, 'R')]:
        p = a.pivot('leg_' + side, (sign * wide, 0, height))
        box(a, 'Upper_leg', 'Suit', (.22, .25, height * .54), (0, 0, -height * .27), parent=p)
        cyl(a, 'Knee', 'Steel', .12, .25, (0, 0, -height * .55), rot=(0, R, 0), seg=10, parent=p)
        box(a, 'Shin', 'Team', (.23, .26, height * .4), (0, -.025, -height * .77), parent=p)
        box(a, 'Boot', 'Undercarriage', (.29, .43, .15), (0, -.08, -height + .08), parent=p)


def stalker(a):
    legs(a)
    # Torso: a dark suit under a violet cloak; a chest rig, a satchel and a canteen on the belt.
    box(a, 'Pelvis', 'Armor', (.6, .36, .22), (0, 0, 1.02))
    box(a, 'Torso', 'Suit', (.6, .4, .57), (0, 0, 1.44), bevel=.07)
    box(a, 'Chest_rig', 'Armor', (.5, .08, .3), (0, -.23, 1.42))
    for x in (-.15, .15):
        box(a, 'Magazine_pouches', 'Undercarriage', (.13, .06, .17), (x, -.29, 1.36), bevel=.015)
    box(a, 'Belt', 'Undercarriage', (.64, .4, .07), (0, 0, 1.15), bevel=.02)
    box(a, 'Satchel', 'Armor', (.2, .16, .24), (-.36, -.05, 1.04), bevel=.03)
    cyl(a, 'Canteen', 'Steel', .075, .26, (.37, .08, 1.0), seg=10)
    # The cloak: a shoulder mantle, then a split cape that flares out behind and ends in a jagged hem.
    a.part('Mantle', 'Cloak').prism([(-.62, 1.5), (-.5, 1.78), (0, 1.92), (.5, 1.78), (.62, 1.5), (.46, 1.38), (-.46, 1.38)], .54, loc=(0, .02, 0), axis='Y', bevel=.03, seg=1)
    for sign in (-1, 1):
        a.part('Split_cape', 'Cloak').prism([(sign * .06, 1.72), (sign * .66, 1.45), (sign * .74, .42), (sign * .48, .2), (sign * .36, .5), (sign * .12, .3), (sign * .06, .62)], .11, loc=(0, .27, 0), axis='Y', bevel=.02, seg=1)
    for i, x in enumerate((-.52, -.26, .26, .52)):
        a.part('Hem_tatters', 'Cloak').prism([(x - .07, .46), (x + .07, .46), (x + .01, .08 + .06 * (i % 2))], .07, loc=(0, .3, 0), axis='Y', bevel=0, seg=1)
    # Head: a dark mask with a lit visor slit in a deep violet hood that droops over the nape (the hood is solid: it holds the head).
    box(a, 'Mask', 'Armor', (.3, .1, .15), (0, -.225, 1.98), bevel=.025)
    box(a, 'Visor_slit', 'Lens', (.2, .03, .045), (0, -.285, 2.0), bevel=.008)
    # Seen from the front the hood is the Veil family's pointed cowl; a short tail drops over the nape.
    a.part('Hood', 'Cloak').prism([(-.3, -.22), (-.35, .02), (-.22, .3), (0, .55), (.22, .3), (.35, .02), (.3, -.22)], .56, loc=(0, .08, 2.0), axis='Y', bevel=.03, seg=1)
    a.part('Hood_tail', 'Cloak').prism([(.2, .2), (.46, -.04), (.42, -.34), (.2, -.3)], .26, loc=(0, 0, 2.0), axis='X', bevel=.02, seg=1)
    box(a, 'Hood_trim', 'Team', (.44, .04, .07), (0, -.2, 2.2), bevel=.012)
    # Shoulders (the joints sit inside the mantle) and arms: the right hand on the grip, the left under the barrel; team tabs on the shoulders.
    for sign in (-1, 1):
        box(a, 'Shoulder_tab', 'Team', (.2, .3, .08), (sign * .45, .02, 1.74), rot=(0, 0, sign * -.18), bevel=.02)
    a.part('Arms', 'Suit').limb((.42, 0, 1.62), (.4, -.36, 1.42), .17, .2, bevel=.025, seg=1)
    a.part('Forearms', 'Suit').limb((.4, -.36, 1.42), (.32, -.5, 1.34), .15, .17, bevel=.02, seg=1)
    a.part('Arms', 'Suit').limb((-.42, 0, 1.62), (-.28, -.5, 1.48), .17, .2, bevel=.025, seg=1)
    a.part('Forearms', 'Suit').limb((-.28, -.5, 1.48), (.05, -.92, 1.4), .15, .17, bevel=.02, seg=1)
    box(a, 'Gloves', 'Undercarriage', (.18, .18, .16), (.3, -.52, 1.32), bevel=.02)
    box(a, 'Gloves', 'Undercarriage', (.18, .18, .16), (.05, -.95, 1.38), bevel=.02)
    # The rifle, held across the body: stock, receiver, a long shrouded barrel and a muzzle brake. The barrel
    # and brake are named Barrel*/Muzzle* so they recoil with each shot.
    box(a, 'Rifle_stock', 'Team', (.14, .6, .2), (.3, .2, 1.4), rot=(.05, 0, 0), bevel=.03)
    box(a, 'Cheek_rest', 'Armor', (.15, .24, .07), (.3, .08, 1.52), bevel=.015)
    box(a, 'Receiver', 'Armor', (.17, .62, .22), (.3, -.34, 1.38), bevel=.03)
    box(a, 'Magazine', 'Armor', (.1, .14, .24), (.3, -.28, 1.16), rot=(.12, 0, 0), bevel=.02)
    box(a, 'Grip', 'Undercarriage', (.1, .12, .2), (.3, -.52, 1.2), rot=(-.25, 0, 0), bevel=.02)
    cyl(a, 'Barrel_shroud', 'Armor', .08, .9, (.3, -1.15, 1.4), rot=(R, 0, 0), seg=10)
    cyl(a, 'Barrel_long', 'Steel', .05, 1.3, (.3, -1.75, 1.4), rot=(R, 0, 0), seg=10)
    cyl(a, 'Muzzle_brake', 'Steel', .085, .22, (.3, -2.42, 1.4), rot=(R, 0, 0), seg=10)
    # A folded bipod under the barrel.
    for sign in (-1, 1):
        beam(a, 'Bipod_legs', 'Steel', (.3 + sign * .07, -1.45, 1.335), (.3 + sign * .12, -2.0, 1.31), .05)
    box(a, 'Bipod_clamp', 'Undercarriage', (.16, .1, .08), (.3, -1.45, 1.34), bevel=.012)
    # The scope: tube on two mounts, a wide objective bell in team paint with the green lens in its mouth.
    for y in (-.2, -.5):
        box(a, 'Scope_mounts', 'Armor', (.09, .1, .13), (.3, y, 1.55), bevel=.012)
    cyl(a, 'Scope_tube', 'Armor', .075, .78, (.3, -.34, 1.66), rot=(R, 0, 0), seg=12)
    cyl(a, 'Scope_bell', 'Team', .125, .24, (.3, -.8, 1.66), rot=(R, 0, 0), seg=12)
    cyl(a, 'Scope_lens', 'Lens', .1, .06, (.3, -.94, 1.66), rot=(R, 0, 0), seg=12)
    cyl(a, 'Scope_eyepiece', 'Undercarriage', .08, .1, (.3, .1, 1.66), rot=(R, 0, 0), seg=10)
    box(a, 'Scope_turret', 'Steel', (.06, .08, .08), (.3, -.34, 1.77), bevel=.01)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def report(a):
    """Triangles per part and material, biggest first (for budget reviews: --report)."""
    rows = sorted(((sum(len(f.verts) - 2 for f in shape.bm.faces), key[0], key[1]) for key, shape in a.shapes.items()), reverse=True)
    for n, name, mat in rows:
        print(f'STALKER_PART {n:5d} {name} ({mat})')


def build(manifest=False, parts=False):
    root = kit.workspace('FrontierStalker')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    a = Asset('stalker', root, ao_distance=.9, ao_samples=40)
    stalker(a)
    # Functional fasteners on the chest rig, as on the other infantry, bring the surface detail up to the family's.
    n = 0
    while count(a) < MIN_TRIANGLES:
        x = (n % 5 - 2) * .09
        z = 1.3 + (n // 5) * .1
        cyl(a, 'Rig_fasteners', 'Steel', .027, .035, (x, -.276, z), rot=(R, 0, 0), seg=6)
        n += 1
        if n > 80:
            raise RuntimeError('Detail budget did not converge: stalker')
    tris = count(a)
    if parts:
        report(a)
    if tris > BUDGET:
        raise RuntimeError(f'stalker: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'stalker.glb')
    print('STALKER_ASSET', a.triangles(), (OUT / 'stalker.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'stalker'] + [
            {'name': 'stalker', 'file': 'stalker.glb', 'triangles': a.triangles(), 'kind': 'unit', 'budget': BUDGET,
             'review': 'pending owner review (round 3)', 'animation': 'Runtime articulated parts; no baked clips'}]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args, parts='--report' in args)
