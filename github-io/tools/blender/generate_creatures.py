"""Acid Hound and Vault Sentinel (creature round). Headless Blender 4.5; no external assets.

  blender -b --python tools/blender/generate_creatures.py -- [--manifest] [--report]

Writes public/models/acidhound.glb (a light desert pack predator, packs of 3-5 on screen) and
public/models/vaultsentinel.glb (the Quiet Vault's guardian construct, joins the player after it
kneels). With --manifest both are recorded in public/models/manifest.json (kind unit, triangle budget,
review pending). --report prints the triangles of every part.

Both walk with the infantry shader-bones rig (src/unit-rig.js): every mesh under a `leg_*` empty is
tagged with that empty's hip and knee, so the whole body is one instanced batch per material.
  * Acid Hound: four leg empties. The rig names the phase by the suffix (`_R` = right phase, anything
    else = left), so the diagonal pairs share a phase for a trot:
      leg_L        front left   (left phase)     leg_hindR_L  hind right  (left phase)
      leg_R        front right  (right phase)    leg_hindL_R  hind left   (right phase)
    Each leg has a `Knee_*` mesh at its bend (front elbow / hind hock); the shin and paw below it fold
    back as the foot lifts. GAIT 'trot' (no run lean, the legs do not pitch with the body).
  * Vault Sentinel: two hip empties leg_L / leg_R with `Knee_cap` meshes, the infantry proportions
    (knee about half the hip height), so the infantry KNEEL pose plants the left foot and drops the
    right knee to the ground. Arms, shield and blade ride the body bone (lean and kneel drop).
Colour: vivid and warm (ochre hide, wine chitin, acid green glow; sandstone, gold bronze, turquoise
core). Glow materials are emissive and skip the AO bake. Blender -Y is the front; metres.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
R = math.pi / 2
BUDGETS = {'acidhound': 1400, 'vaultsentinel': 3200}
REVIEW = 'pending owner review (creature round)'
ANIMATION = {
    'acidhound': 'Shader-bones rig (src/unit-rig.js, GAIT trot): leg_L + leg_hindR_L and leg_R + leg_hindL_R '
                 'swing as diagonal pairs, Knee_* bends; no baked clips',
    'vaultsentinel': 'Shader-bones rig (src/unit-rig.js, GAIT stomp): leg_L / leg_R hips with Knee_cap knees, '
                     'infantry KNEEL pose when it yields (set by the view); no baked clips',
}

# name: (sRGB base colour, metallic, roughness, emission strength)
kit.MATERIALS.setdefault('HoundHide', ('#f0a04a', 0.0, 0.7, 0.0))      # warm ochre-orange hide
kit.MATERIALS.setdefault('Chitin', ('#8a2f45', 0.1, 0.32, 0.0))        # glossy wine-red chitin
kit.MATERIALS.setdefault('Acid', ('#9dff3a', 0.0, 0.35, 1.6))          # acid glands, eyes, drool
kit.MATERIALS.setdefault('VaultStone', ('#d9845a', 0.0, 0.82, 0.0))    # red desert sandstone (Petra), apart from the gold bronze
kit.MATERIALS.setdefault('Bronze', ('#ffbe4d', 0.3, 0.25, 0.0))        # gold bronze trim (low metal stays bright in Eco)
kit.MATERIALS.setdefault('Basalt', ('#6a4a3e', 0.05, 0.7, 0.0))        # dark warm joints
kit.MATERIALS.setdefault('VaultCore', ('#3ff4e2', 0.0, 0.3, 2.2))      # turquoise core and carvings
kit.GLOWING.update({'Acid', 'VaultCore'})


def loft(shape, points, radii, sides=6, caps=True):
    """Tapered tube through joints (legs, necks, tails, horns)."""
    points = [Vector(p) for p in points]
    rings = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        ref = Vector((1, 0, 0)) if abs(tangent.x) < 0.9 else Vector((0, 1, 0))
        normal = tangent.cross(ref).normalized()
        binormal = tangent.cross(normal)
        rings.append([shape.bm.verts.new(point + radius * (math.cos(a) * normal + math.sin(a) * binormal))
                      for a in (k * math.tau / sides for k in range(sides))])
    shape._faces(rings, caps, caps)
    return shape


# ----------------------------------------------------------------------------- Acid Hound
def hound(a):
    hide, chitin, acid, team = 'HoundHide', 'Chitin', 'Acid', 'Team'
    # Torso: deep chest, tucked waist, lower haunch (a hyena's sloping back).
    a.part('Torso', hide).sphere((.2, .3, .23), loc=(0, -.2, .6), seg=9, rings=6)
    a.part('Torso', hide).sphere((.14, .24, .15), loc=(0, .1, .56), seg=7, rings=5)
    a.part('Torso', hide).sphere((.16, .2, .18), loc=(0, .32, .55), seg=8, rings=5)
    loft(a.part('Neck', hide), [(0, -.38, .66), (0, -.52, .78), (0, -.6, .84)], [.13, .1, .09], 6)
    # Head: skull, long muzzle, open dark jaw, tall ears with glowing insides.
    a.part('Skull', hide).sphere((.12, .14, .115), loc=(0, -.66, .86), seg=8, rings=5)
    a.part('Muzzle', hide).sphere((.075, .15, .068), loc=(0, -.83, .82), seg=7, rings=5)
    a.part('Jaw', chitin).sphere((.062, .13, .04), loc=(0, -.81, .745), rot=(.22, 0, 0), seg=6, rings=4)
    a.part('Nose', chitin).sphere((.034, .03, .026), loc=(0, -.975, .845), seg=5, rings=3)
    for s in (-1, 1):
        a.part('Ear', hide).prism([(-.05, 0), (.05, 0), (.012, .2)], .03, loc=(s * .075, -.62, .93),
                                  rot=(-.25, 0, s * -.35), axis='Y', bevel=0)
        a.part('Ear_glow', acid).prism([(-.03, .02), (.03, .02), (.008, .15)], .02, loc=(s * .075, -.638, .93),
                                       rot=(-.25, 0, s * -.35), axis='Y', bevel=0)
        a.part('Eye', acid).sphere(.03, loc=(s * .075, -.765, .895), seg=5, rings=3)
    # Acid glands: a fat throat sac, drool off the jaw, three sacs along each flank.
    a.part('Throat_sac', acid).sphere((.075, .1, .08), loc=(0, -.6, .7), seg=7, rings=4)
    a.part('Drool', acid).cyl(.018, .14, loc=(0, -.9, .67), seg=5, r2=.004, bevel=0)
    for s in (-1, 1):
        for y, z, r in ((-.14, .56, .068), (.2, .53, .056)):
            a.part('Flank_sac', acid).sphere((r * .7, r, r), loc=(s * (.15 if y > 0 else .19), y, z), seg=6, rings=4)
    # Chitin back plates, each with a team crest down its middle (reads from the RTS camera).
    for i, (y, z, rx, ry, tilt) in enumerate(((-.36, .8, .16, .12, .5), (-.2, .82, .2, .14, .2), (-.02, .74, .17, .13, 0),
                                               (.17, .72, .17, .12, -.1), (.34, .71, .15, .11, -.25))):
        a.part('Back_plate', chitin).sphere((rx, ry, .07), loc=(0, y, z - .06), rot=(tilt, 0, 0), seg=8, rings=4, cut=0)
        a.part('Plate_crest', team).box((.05, ry * 1.6, .035), loc=(0, y, z + .005 - abs(tilt) * .02), rot=(tilt, 0, 0), bevel=0)
    a.part('Collar', team).torus(.115, .028, loc=(0, -.43, .7), rot=(R + .75, 0, 0), seg=8, ring=3)
    # Spined tail with a glowing sting.
    loft(a.part('Tail', chitin), [(0, .48, .6), (0, .6, .58), (0, .7, .48), (0, .76, .38)], [.045, .055, .04, .02], 5)
    a.part('Tail_tip', acid).sphere(.04, loc=(0, .77, .36), seg=5, rings=3)

    # Legs (relative to their pivots). Front: shoulder -> elbow (knee) -> wrist -> paw.
    front = [(0, .05, -.24), (0, -.01, -.48), (0, -.04, -.56)]
    hind = [(0, -.07, -.18), (0, .1, -.37), (0, .07, -.53)]
    legs = (('leg_L', -1, -.24, .58, front), ('leg_R', 1, -.24, .58, front),
            ('leg_hindR_L', 1, .33, .55, hind), ('leg_hindL_R', -1, .33, .55, hind))
    for name, s, y, z, (knee, ankle, paw) in legs:
        p = a.pivot(name, (s * .135, y, z))
        loft(a.part('Upper_leg', hide, p), [(0, 0, .04), knee], [.075, .05], 6)
        a.part('Knee_joint', chitin, p).sphere(.05, loc=knee, seg=5, rings=3)
        loft(a.part('Shin', chitin, p), [knee, ankle, (paw[0], paw[1] + .02, paw[2] + .02)], [.042, .03, .028], 5)
        a.part('Paw', chitin, p).sphere((.045, .065, .03), loc=(paw[0], paw[1] - .02, -z + .03), seg=6, rings=3)


# ----------------------------------------------------------------------------- Vault Sentinel
def sentinel(a):
    stone, bronze, basalt, core, team = 'VaultStone', 'Bronze', 'Basalt', 'VaultCore', 'Team'
    hip_z = 1.38
    for s, side in ((-1, 'L'), (1, 'R')):
        p = a.pivot('leg_' + side, (s * .37, 0, hip_z))
        a.part('Hip_joint', basalt, p).sphere(.2, seg=8, rings=6)
        a.part('Thigh', stone, p).limb((0, 0, -.04), (0, -.03, -.6), .38, .42, bevel=.05, seg=1, taper=(.85, .85))
        a.part('Thigh_plate', bronze, p).box((.3, .08, .3), loc=(0, -.235, -.34), rot=(-.05, 0, 0), bevel=.02, seg=1)
        a.part('Thigh_rune', core, p).box((.04, .02, .34), loc=(s * -.02, -.235, -.3), bevel=0)
        a.part('Knee_cap', bronze, p).sphere((.18, .2, .17), loc=(0, -.09, -.64), seg=8, rings=6)
        a.part('Shin', stone, p).limb((0, -.03, -.7), (0, 0, -1.2), .46, .5, bevel=.05, seg=1, taper=(.82, .82))
        a.part('Greave', bronze, p).box((.5, .54, .09), loc=(0, -.01, -1.05), bevel=.02, seg=1)
        a.part('Foot', stone, p).box((.52, .74, .2), loc=(0, -.13, -hip_z + .1), bevel=.04, seg=1, taper=(.8, .78))
        a.part('Toe_cap', bronze, p).box((.46, .12, .12), loc=(0, -.5, -hip_z + .07), bevel=.02, seg=1)

    # Pelvis, team tabard between the legs, bronze waist ring.
    a.part('Pelvis', basalt).box((.98, .6, .34), loc=(0, 0, 1.46), bevel=.05, seg=1)
    a.part('Tabard', team).prism([(-.19, 0), (.19, 0), (.15, -.5), (0, -.6), (-.15, -.5)], .06,
                                 loc=(0, -.33, 1.42), axis='Y', bevel=0)
    a.part('Waist', bronze).cyl(.33, .3, loc=(0, 0, 1.74), seg=10, bevel=.02, bseg=1)
    # Chest: a broad tapering block (wide shoulders), the core in a bronze ring, carved glowing lines.
    a.part('Chest', stone).box((1.25, .82, .88), loc=(0, 0, 2.24), bevel=.08, seg=2, taper=(1.14, 1.04))
    a.part('Core', core).sphere(.2, loc=(0, -.43, 2.24), seg=10, rings=7)
    a.part('Core_ring', bronze).torus(.25, .055, loc=(0, -.43, 2.24), rot=(R, 0, 0), seg=12, ring=4)
    for x, z, sx, sz in ((-.36, 2.24, .045, .5), (.36, 2.24, .045, .5), (0, 2.58, .5, .045), (0, 1.92, .34, .045)):
        a.part('Carving', core).box((sx, .03, sz), loc=(x, -.425, z), bevel=0)
    for s in (-1, 1):
        a.part('Carving', core).box((.035, .03, .28), loc=(s * .2, -.42, 2.0), rot=(0, s * .7, 0), bevel=0)
    # Ancient crust: weathered stone lumps on the back and shoulders.
    for loc, rad, seed in (((-.3, .38, 2.5), (.3, .2, .24), 1.0), ((.32, .4, 2.15), (.26, .18, .22), 2.0),
                           ((-.95, .12, 2.86), (.2, .2, .1), 3.0), ((.78, .18, 2.88), (.16, .14, .08), 4.0)):
        a.part('Crust', stone).ico(rad, loc=loc, sub=2, jitter=.35, seed=seed)
    # Abdomen plates over the waist and a bronze spine with glowing vents on the back.
    a.part('Abdomen', stone).box((.8, .62, .16), loc=(0, -.04, 1.86), bevel=.03, seg=1, taper=(1.1, 1.0))
    a.part('Spine', bronze).box((.3, .14, .8), loc=(0, .44, 2.3), bevel=.03, seg=1)
    for z in (2.05, 2.3, 2.55):
        a.part('Carving', core).box((.42, .03, .04), loc=(0, .43, z), bevel=0)

    # Shoulders: huge stone pauldrons with team bands and a carved glow line.
    for s in (-1, 1):
        x = s * .86
        a.part('Pauldron', stone).sphere((.44, .46, .4), loc=(x, 0, 2.56), seg=10, rings=6, cut=-.25)
        a.part('Pauldron_band', team).torus(.43, .055, loc=(x, 0, 2.5), seg=12, ring=4)
        a.part('Pauldron_rune', core).box((.05, .03, .2), loc=(x + s * .05, -.44, 2.7), rot=(.3, 0, 0), bevel=0)
        a.part('Shoulder_joint', basalt).sphere(.2, loc=(s * .95, 0, 2.32), seg=8, rings=5)
        a.part('Bracer', bronze).box((.44, .44, .12), loc=(s * 1.045, -.1, 1.5), rot=(-.53, 0, 0), bevel=.02, seg=1)
    # Head sunk between the shoulders: one glowing eye slit, bronze crest and swept horns.
    a.part('Collar', basalt).box((.5, .5, .2), loc=(0, -.02, 2.72), bevel=.04, seg=1)
    a.part('Head', stone).box((.38, .42, .36), loc=(0, -.12, 2.9), bevel=.05, seg=1, taper=(.82, .9))
    a.part('Brow', bronze).box((.42, .12, .08), loc=(0, -.31, 2.99), bevel=.02, seg=1)
    a.part('Eye_slit', core).box((.27, .04, .055), loc=(0, -.335, 2.92), bevel=0)
    a.part('Crest', bronze).prism([(.18, 0), (-.2, 0), (-.08, .2), (.12, .14)], .06, loc=(0, -.1, 3.03), axis='X', bevel=0)
    for s in (-1, 1):
        loft(a.part('Horn', bronze), [(s * .17, -.16, 2.98), (s * .3, -.05, 3.08), (s * .36, .14, 3.12)], [.05, .035, .008], 5)

    # Left arm: the great shield (team rim behind a bronze face, glowing boss).
    loft(a.part('Upper_arm', stone), [(-.98, 0, 2.3), (-1.04, .04, 1.78)], [.17, .15], 7)
    a.part('Elbow', basalt).sphere(.16, loc=(-1.04, .04, 1.74), seg=8, rings=5)
    a.part('Forearm', stone).limb((-1.04, .03, 1.72), (-1.05, -.2, 1.3), .36, .36, bevel=.04, seg=1, taper=(1.15, 1.15))
    turn = .55
    n = Vector((-math.cos(turn), -math.sin(turn), 0))
    c = Vector((-1.2, -.3, 1.42))
    shield = [(0, .72), (.36, .56), (.44, .1), (.3, -.4), (0, -.66), (-.3, -.4), (-.44, .1), (-.36, .56)]
    a.part('Shield_rim', team).prism(shield, .08, loc=c, rot=(0, 0, turn), axis='X', bevel=0)
    a.part('Shield', bronze).prism([(y * .84, z * .86) for y, z in shield], .06, loc=c + n * .05, rot=(0, 0, turn), axis='X', bevel=0)
    a.part('Shield_boss', core).cyl(.12, .06, loc=c + n * .09, rot=(0, R, turn), seg=8, bevel=0)
    a.part('Shield_rune', core).box((.02, .03, .8), loc=c + n * .085, rot=(0, 0, turn), bevel=0)

    # Right arm: a broad bronze blade with a glowing fuller, held low and forward.
    loft(a.part('Upper_arm', stone), [(.98, 0, 2.3), (1.04, .04, 1.78)], [.17, .15], 7)
    a.part('Elbow', basalt).sphere(.16, loc=(1.04, .04, 1.74), seg=8, rings=5)
    a.part('Forearm', stone).limb((1.04, .03, 1.72), (1.06, -.24, 1.28), .38, .38, bevel=.04, seg=1, taper=(1.2, 1.2))
    a.part('Hilt', basalt).box((.2, .26, .14), loc=(1.07, -.27, 1.17), bevel=.02, seg=1)
    blade = [(-.17, 0), (.17, 0), (.21, -.7), (0, -1.35), (-.21, -.7)]
    a.part('Blade', bronze).prism(blade, .08, loc=(1.08, -.3, 1.14), rot=(-.7, 0, 0), axis='X', bevel=0)
    a.part('Blade_fuller', core).prism([(y * .25, z * .82) for y, z in blade], .1, loc=(1.08, -.3, 1.14),
                                       rot=(-.7, 0, 0), axis='X', bevel=0)
    a.part('Hilt_guard', bronze).box((.16, .5, .1), loc=(1.08, -.3, 1.15), rot=(-.7, 0, 0), bevel=.02, seg=1)


# ----------------------------------------------------------------------------- build
def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build_one(name, make, rows, parts=False):
    root = kit.workspace('FrontierCreature' + name)
    kit.clear_workspace(root)
    a = Asset(name, root, ao_distance=.6 if name == 'acidhound' else 1.0, ao_samples=40)
    make(a)
    tris = count(a)
    if parts:
        for key, shape in sorted(a.shapes.items(), key=lambda kv: -sum(len(f.verts) - 2 for f in kv[1].bm.faces)):
            print(f'CREATURE_PART {name} {sum(len(f.verts) - 2 for f in shape.bm.faces):5d} {key}')
    if tris > BUDGETS[name]:
        raise RuntimeError(f'{name}: {tris} triangles > {BUDGETS[name]}')
    a.finish()
    a.export(OUT / f'{name}.glb')
    mats = sorted({m.name for ob in a.objects for m in ob.data.materials})
    print('CREATURE_ASSET', name, a.triangles(), (OUT / f'{name}.glb').stat().st_size, mats, flush=True)
    rows.append({'name': name, 'file': f'{name}.glb', 'triangles': a.triangles(), 'kind': 'unit', 'budget': BUDGETS[name],
                 'review': REVIEW, 'animation': ANIMATION[name]})


def build(manifest=False, parts=False):
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    build_one('acidhound', hound, rows, parts)
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_one('vaultsentinel', sentinel, rows, parts)
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
