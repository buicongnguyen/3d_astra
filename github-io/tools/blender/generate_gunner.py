"""Gunner team for the Meridian Field workshop (AAA round 2, W1-B). Headless Blender 4.5; no external assets.

  blender --background --python tools/blender/generate_gunner.py -- [--manifest]

Writes public/models/gunner.glb. With --manifest it also records the model in
public/models/manifest.json (kind unit, its triangle budget, review pending).

Two soldiers and a tripod machine gun between them: the gunner leans over the gun with both hands on
its grips, the loader beside him feeds the belt from a brass ammunition box. Warm teal fatigues,
Team shoulder pads, helmet crests and stripe (so the side's colour reads from above), a gunmetal gun
with an amber-brass belt and a glowing visor.

Runtime contract (docs/ASSET_PIPELINE.md, tests/assets.test.js):
  * One `leg_L` / `leg_R` pivot pair at the hips. The loader's legs are parented to the same two pivots
    as the gunner's, so the team steps as one rig (the pivots only swing about X, so a leg anywhere
    along X swings in step).
  * The gun's barrel pieces are named Barrel* / Muzzle*: the view merges them into the BarrelRig that
    recoils (src/view.js RIG_PART).
  * Muzzle at 1.3 m ahead of the centre and 1.2 m high, as `weapons.gunner` in src/visual-style.json
    says (reach 1.3, height 1.2), so tracers leave the barrel.
  * Seven materials at most, like the Ranger: Team, TeamGlow, Fatigue (teal, new), Armor, Steel,
    Undercarriage and Hazard (brass). Grey COLOR_0 baked by the kit, single-sided, one attribute set.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y; a cone's narrow end points to the front (-Y)
BUDGET = 3200
HIP = .95               # the leg pivots' height

# The teal of Meridian's field uniform: deep and saturated, so the side's colour on the pads, crests and
# visors stays readable against it (COLOR_0 multiplies it by ~0.8).
kit.MATERIALS['Fatigue'] = ('#2d9aa6', 0.0, 0.8, 0.0)


class Figure:
    """A soldier: its own origin (x, y), a yaw and a lean. Every part is placed through this frame, so the
    two figures share the helpers. `legs` are built in the leg pivots' space (hips at HIP)."""

    def __init__(self, a, x, y=0.0, yaw=0.0):
        self.a = a
        self.frame = Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(yaw, 4, 'Z')

    def at(self, loc, rot=(0, 0, 0), parent=None):
        m = self.frame @ (Matrix.Translation(Vector(loc)) @ kit.Euler(rot, 'XYZ').to_matrix().to_4x4())
        loc, rot = m.to_translation(), m.to_euler('XYZ')
        if parent:
            loc = loc - Vector((0, 0, HIP))
        return tuple(loc), tuple(rot)

    def point(self, p, parent=None):
        q = self.frame @ Vector(p)
        return tuple(q - Vector((0, 0, HIP))) if parent else tuple(q)

    def box(self, name, mat, size, loc, rot=(0, 0, 0), bevel=.04, seg=1, parent=None, **kw):
        loc, rot = self.at(loc, rot, parent)
        self.a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=seg, **kw)

    def cyl(self, name, mat, r, depth, loc, rot=(0, 0, 0), seg=10, parent=None, **kw):
        loc, rot = self.at(loc, rot, parent)
        self.a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, bevel=kw.pop('bevel', .015), bseg=1, **kw)

    def limb(self, name, mat, p0, p1, w, d, bevel=.04, taper=(1, 1)):
        self.a.part(name, mat).limb(self.point(p0), self.point(p1), w, d, bevel=bevel, seg=1, taper=taper)


def soldier(a, fig, role):
    """One soldier standing at the figure's origin, facing -Y. role: 'gunner' leans over the gun; 'loader'
    holds the belt feed with his right hand and a spare ammunition can in his left."""
    gunner = role == 'gunner'
    # Legs: swing from the shared hip pivots.
    for s, side in ((-1, 'L'), (1, 'R')):
        leg = f'leg_{side}'
        fig.box('Leg_suit', 'Fatigue', (.22, .26, .54), (s * .17, .02, .68), parent=leg, bevel=.06, taper=(1.1, 1.05))
        fig.box('Knee_pad', 'Undercarriage', (.2, .1, .22), (s * .17, -.12, .5), parent=leg, bevel=.03)
        fig.box('Boot', 'Undercarriage', (.26, .44, .17), (s * .17, -.06, .09), parent=leg, bevel=.05, taper=(.92, .86))
    # Torso: teal jacket, a gunmetal vest plate with a Team patch, a pack behind.
    fig.box('Jacket', 'Fatigue', (.5, .34, .62), (0, 0, 1.27), bevel=.09, taper=(1.12, 1.0))
    fig.box('Vest', 'Armor', (.46, .1, .36), (0, -.2, 1.34), bevel=.03)
    fig.box('Patch', 'Team', (.2, .04, .12), (0, -.26, 1.42), bevel=.012)
    fig.box('Belt', 'Undercarriage', (.52, .36, .08), (0, 0, 1.0), bevel=.025)
    fig.box('Pack', 'Fatigue' if gunner else 'Team', (.42, .2, .4), (0, .27, 1.38), bevel=.06)
    # Arms: shoulders with Team pads, forearms to the hands (static poses, so every hand grips something).
    if gunner:
        hands = {-1: (-.1, -.56, 1.2), 1: (.1, -.56, 1.2)}
        elbows = {-1: (-.3, -.24, 1.3), 1: (.3, -.24, 1.3)}
    else:
        hands = {-1: (-.36, -.34, 1.02), 1: (.12, -.52, 1.15)}
        elbows = {-1: (-.4, -.08, 1.22), 1: (.34, -.22, 1.32)}
    for s in (-1, 1):
        fig.box('Pad', 'Team', (.3, .34, .2), (s * .36, 0, 1.64), rot=(0, s * .35, 0), bevel=.08)
        shoulder = (s * .33, .0, 1.58)
        fig.limb('Sleeve', 'Fatigue', shoulder, elbows[s], .17, .18, bevel=.04)
        fig.limb('Forearm', 'Fatigue', elbows[s], hands[s], .15, .15, bevel=.035, taper=(.85, .85))
        fig.box('Glove', 'Undercarriage', (.13, .13, .12), hands[s], bevel=.03)
    # Helmet, visor, crest, jaw guard.
    fig.box('Helmet', 'Armor', (.38, .42, .32), (0, -.01, 1.98), bevel=.12, seg=2, taper=(.9, .92))
    fig.box('Crest', 'Team', (.09, .32, .07), (0, .01, 2.17), bevel=.025)
    fig.box('Visor', 'TeamGlow', (.32, .07, .1), (0, -.21, 1.99), bevel=.025)
    fig.box('Jaw', 'Armor', (.3, .08, .12), (0, -.17, 1.84), rot=(-.2, 0, 0), bevel=.03)
    if not gunner:
        # The loader carries a spare ammunition can on his left hip and a cap-lamp on the helmet.
        fig.box('Can', 'Hazard', (.2, .12, .26), (-.36, -.28, .98), bevel=.03)
        fig.box('Can_strap', 'Undercarriage', (.22, .13, .05), (-.36, -.28, 1.04), bevel=.01)


def gun(a, x):
    """The tripod machine gun on the centre line x. Barrel* / Muzzle* meshes form the recoiling rig."""
    # Tripod: three splayed steel legs under a cradle.
    cradle = (x, -.42, 1.0)
    for foot in ((x - .5, -1.0, .04), (x + .5, -1.0, .04), (x, .1, .04)):
        a.part('Tripod', 'Steel').limb(cradle, foot, .07, .07, bevel=.012, seg=1)
        a.part('Foot', 'Undercarriage').box((.14, .16, .05), loc=foot, bevel=.015, seg=1)
    a.part('Cradle', 'Undercarriage').box((.2, .22, .16), loc=(x, -.42, 1.04), bevel=.04, seg=1)
    # Receiver, top cover, feed tray, handles, sight, stock plate.
    armor = a.part('Receiver', 'Armor')
    armor.box((.22, .56, .24), loc=(x, -.4, 1.2), bevel=.04, seg=1)
    armor.box((.2, .3, .08), loc=(x, -.36, 1.36), bevel=.025, seg=1)
    a.part('Feed_tray', 'Steel').box((.14, .3, .1), loc=(x + .17, -.36, 1.22), bevel=.02, seg=1)
    a.part('Grip', 'Undercarriage').box((.07, .1, .17), loc=(x - .1, -.12, 1.1), rot=(.25, 0, 0), bevel=.015, seg=1)
    a.part('Grip', 'Undercarriage').box((.07, .1, .17), loc=(x + .1, -.12, 1.1), rot=(.25, 0, 0), bevel=.015, seg=1)
    a.part('Buttplate', 'Undercarriage').box((.24, .08, .22), loc=(x, -.08, 1.2), bevel=.03, seg=1)
    a.part('Sight', 'Steel').box((.06, .12, .08), loc=(x, -.5, 1.44), bevel=.015, seg=1)
    a.part('Lamp', 'TeamGlow').box((.04, .03, .04), loc=(x, -.57, 1.44), bevel=0)
    # The rig that recoils: finned barrel jacket, the barrel, a flash hider. The muzzle ends at y = -1.3.
    a.part('Barrel_jacket', 'Armor').cyl(.085, .34, loc=(x, -.8, 1.2), rot=FORWARD, seg=10, bevel=.015, bseg=1)
    a.part('Barrel_core', 'Steel').cyl(.045, .66, loc=(x, -.98, 1.2), rot=FORWARD, seg=8, bevel=.01, bseg=1)
    a.part('Muzzle_brake', 'Undercarriage').cyl(.075, .13, loc=(x, -1.24, 1.2), rot=FORWARD, seg=8, bevel=.015, bseg=1)
    # Brass belt from the ammunition box (right of the gun) up into the feed tray.
    a.part('Belt', 'Hazard').tube([(x + .55, -.46, .36), (x + .5, -.44, .62), (x + .34, -.4, 1.0), (x + .2, -.36, 1.22)], .035, seg=6)
    a.part('Ammo_box', 'Hazard').box((.34, .24, .3), loc=(x + .55, -.46, .19), bevel=.04, seg=1)
    a.part('Ammo_lid', 'Undercarriage').box((.36, .26, .05), loc=(x + .55, -.46, .36), bevel=.02, seg=1)


def gunner_team(a):
    # Shared hips: the pivots sit at the middle of the team and only swing about X.
    for side in 'LR':
        a.pivot(f'leg_{side}', (0, 0, HIP))
    gx, lx = -.36, .6
    soldier(a, Figure(a, gx, .08, yaw=.0), 'gunner')
    soldier(a, Figure(a, lx, .1, yaw=-.28), 'loader')
    gun(a, gx)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build(manifest=False):
    root = kit.workspace('FrontierGunner')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    a = Asset('gunner', root, ao_distance=.7, grime_height=.45)
    gunner_team(a)
    tris = count(a)
    if tris > BUDGET:
        raise RuntimeError(f'gunner: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'gunner.glb')
    print('GUNNER_ASSET', a.triangles(), (OUT / 'gunner.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'gunner'] + [
            {'name': 'gunner', 'file': 'gunner.glb', 'triangles': a.triangles(), 'kind': 'unit', 'budget': BUDGET,
             'review': 'pending owner review (round 2)',
             'source': 'tools/blender/generate_gunner.py (frontier_kit), original design',
             'animation': 'Runtime articulated parts: one shared leg pivot pair, a recoiling BarrelRig; no baked clips'}]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args)
