"""The Ember Drake, the first flying boss (W9). Headless Blender 4.5; no external assets.

  blender -b --python tools/blender/generate_drake.py -- [--manifest] [--report]

Writes public/models/emberdrake.glb; with --manifest it also records it in public/models/manifest.json.

An original Builder fire beast: a burnt-sienna hide over a warm gold belly, bronze back plates with glowing ember
vents between them, a glowing throat and eyes, cream horns and claws, crimson wing membranes and a team-painted
crest, wing edge and tail fin. Blender -Y is the front; sizes are real metres (about 7.5 m nose to tail, 11 m
across the wings). It stands on its hind legs and forefeet when perched; in the air the runtime lifts it.

Runtime contract (src/boss-view.js DRAKE_PARTS): rigid pivots Wing_L, Wing_R (flap about the body axis), Jaw (opens
to breathe), Tail (sways), leg_L, leg_R (fold up in flight). The EmberGlow material is drawn as one always-lit
emissive mesh (eyes, throat, vents, mouth) whose brightness follows the fight. Gun mouth and core positions match
balance.json `muzzles` and `core` (mouth at about 3 m, chest at about 1.9 m, before the runtime's flight lift).
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
import frontier_kit as kit
from frontier_kit import Asset

OUT = HERE.parents[1] / 'public/models'
BUDGET = 4600

kit.MATERIALS.update({
    'Hide': ('#8a3a22', 0.05, 0.6, 0.0),        # burnt sienna scales
    'Belly': ('#e8a84c', 0.05, 0.55, 0.0),      # warm gold underside
    'Armor': ('#c98a3e', 0.45, 0.32, 0.0),      # bronze back plates (Builder work)
    'Ridge': ('#3a1e1c', 0.1, 0.6, 0.0),        # dark spines and nostrils
    'Bone': ('#f2e4c4', 0.0, 0.5, 0.0),         # horns, claws, wing fingers
    'Membrane': ('#c2302a', 0.0, 0.72, 0.0),    # crimson wing skin
    'EmberGlow': ('#ff8a2a', 0.0, 0.4, 3.0),    # eyes, throat, vents, mouth
})
kit.GLOWING.add('EmberGlow')


def curve(shape, points, radii, sides=8):
    """Loft a tapered limb through its joints (the Wyrm's recipe)."""
    points = [Vector(p) for p in points]
    rings = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        side = Vector((1, 0, 0)) if abs(tangent.x) < 0.9 else Vector((0, 0, 1))
        normal = tangent.cross(side).normalized()
        binormal = tangent.cross(normal)
        rings.append([shape.bm.verts.new(point + radius * (math.cos(a) * normal + math.sin(a) * binormal))
                      for a in (k * math.tau / sides for k in range(sides))])
    shape._faces(rings)


HEAD_CENTRE, HEAD_SCALE, HEAD_SHIFT = (0, -2.9, 3.15), 1.25, (0, -0.35, 0.25)


def H(x, y, z):
    """A head point drawn about the head's centre at HEAD_SCALE and moved by HEAD_SHIFT."""
    c, k, d = HEAD_CENTRE, HEAD_SCALE, HEAD_SHIFT
    return (c[0] + (x - c[0]) * k + d[0], c[1] + (y - c[1]) * k + d[1], c[2] + (z - c[2]) * k + d[2])


def body(a):
    a.part('Torso', 'Hide').sphere((0.95, 1.7, 0.85), loc=(0, 0.2, 1.7), seg=14, rings=8)
    a.part('Chest', 'Hide').sphere((0.85, 0.95, 0.9), loc=(0, -1.0, 1.85), seg=12, rings=7)
    a.part('Belly', 'Belly').sphere((0.78, 1.65, 0.55), loc=(0, -0.35, 1.38), seg=12, rings=6)
    # Bronze back plates with glowing vents between them: the glow reads from the RTS camera above.
    for i, y in enumerate((-1.45, -0.75, -0.05, 0.65, 1.35)):
        w = 0.95 - abs(i - 1.5) * 0.12
        a.part('Back_plate', 'Armor').box((w, 0.52, 0.2), loc=(0, y, 2.5 - abs(y + 0.3) * 0.08), rot=(0.12, 0, 0), bevel=0.06, seg=1, taper=(0.75, 0.85))
        if i < 4:
            a.part('Vent', 'EmberGlow').box((w * 0.7, 0.16, 0.1), loc=(0, y + 0.35, 2.42 - abs(y + 0.05) * 0.08), bevel=0)
    a.part('Throat', 'EmberGlow').sphere((0.42, 0.32, 0.5), loc=(0, -1.72, 1.98), seg=10, rings=5)
    # Neck and head: the head is drawn 1.25x and lifted forward (readability: a big face with bright eyes).
    curve(a.part('Neck', 'Hide'), [(0, -1.55, 2.15), (0, -2.25, 2.78), (0, -2.85, 3.28)], [0.56, 0.45, 0.38])
    for k, (y, z) in enumerate(((-1.75, 2.72), (-2.3, 3.2), (-2.8, 3.62))):
        a.part('Neck_spine', 'Ridge').prism([(-0.16, 0), (0.16, 0), (0, 0.4 - k * 0.05)], 0.1, loc=(0, y, z), rot=(0.5, 0, 0), axis='X', bevel=0)
    S = HEAD_SCALE
    a.part('Crown', 'Hide').sphere((0.5 * S, 0.62 * S, 0.42 * S), loc=H(0, -2.85, 3.2), seg=12, rings=7)
    a.part('Snout', 'Hide').sphere((0.35 * S, 0.62 * S, 0.26 * S), loc=H(0, -3.42, 3.1), seg=10, rings=6)
    a.part('Mouth', 'EmberGlow').sphere((0.24 * S, 0.48 * S, 0.08 * S), loc=H(0, -3.32, 2.94), seg=8, rings=4)
    a.part('Brow', 'Armor').box((0.86 * S, 0.3 * S, 0.12 * S), loc=H(0, -3.0, 3.48), rot=(-0.25, 0, 0), bevel=0.04, seg=1, taper=(0.8, 1))
    for s in (-1, 1):
        a.part('Eye', 'EmberGlow').sphere((0.15 * S, 0.17 * S, 0.12 * S), loc=H(0.34 * s, -3.08, 3.32), seg=8, rings=5)
        a.part('Nostril', 'Ridge').sphere((0.06 * S, 0.05 * S, 0.04 * S), loc=H(0.15 * s, -3.98, 3.2), seg=6, rings=3)
        curve(a.part('Horn', 'Bone'), [H(0.27 * s, -2.75, 3.45), H(0.42 * s, -2.35, 3.78), H(0.5 * s, -1.9, 3.9)], [0.14 * S, 0.08 * S, 0.012], 6)
        # Forelegs (rigid): tucked under the chest, they stand on the perch.
        curve(a.part('Foreleg', 'Hide'), [(0.5 * s, -1.0, 1.45), (0.66 * s, -1.25, 0.75), (0.6 * s, -1.5, 0.14)], [0.24, 0.18, 0.13], 7)
        a.part('Forefoot', 'Hide').sphere((0.2, 0.32, 0.12), loc=(0.6 * s, -1.65, 0.12), seg=8, rings=4)
        for k in (-1, 0, 1):
            curve(a.part('Claw', 'Bone'), [(0.6 * s + k * 0.1, -1.85, 0.12), (0.6 * s + k * 0.13, -2.02, 0.04)], [0.05, 0.008], 5)
    # The crest: a team-painted fin along the top of the head.
    _, cy0, cz = H(0, -3.3, 3.52)
    _, cy1, _ = H(0, -2.2, 3.52)
    a.part('Crest', 'Team').prism([(cy0, 0), (cy1, 0), (cy1 - 0.35 * S, 0.42 * S), (cy0 + 0.4 * S, 0.34 * S)], 0.1, loc=(0, 0, cz), axis='X', bevel=0)


def jaw(a):
    S = HEAD_SCALE
    p = a.pivot('Jaw', H(0, -2.78, 2.95))
    a.part('Lower_jaw', 'Belly', p).sphere((0.32 * S, 0.62 * S, 0.14 * S), loc=(0, -0.62 * S, -0.06 * S), seg=10, rings=5)
    for s in (-1, 1):
        for k in range(3):
            a.part('Tooth', 'Bone', p).prism([(-0.05, 0), (0.05, 0), (0, 0.15)], 0.06, loc=(0.18 * S * s, (-0.75 - k * 0.2) * S, 0.02), axis='Y', bevel=0)


def tail(a):
    p = a.pivot('Tail', (0, 1.8, 1.62))
    pts = [(0, 0, 0), (0, 1.3, -0.22), (0, 2.6, -0.45), (0, 3.7, -0.5)]
    curve(a.part('Tail_body', 'Hide', p), pts, [0.55, 0.38, 0.22, 0.08], 8)
    for k, (x, y, z) in enumerate(pts[:3]):
        a.part('Tail_spike', 'Armor', p).prism([(-0.14, 0), (0.14, 0), (0, 0.34 - k * 0.07)], 0.12, loc=(0, y + 0.55, z + 0.42 - k * 0.12), rot=(0.4, 0, 0), axis='X', bevel=0)
    a.part('Tail_fin', 'Team', p).prism([(0, -0.25), (0.62, 0.1), (0, 0.95), (-0.62, 0.1)], 0.08, loc=(0, 3.75, -0.5), axis='Z', bevel=0)


def wing(a, s):
    """One rigid wing on its shoulder hinge, spread flat: arm bones, three fingers, a scalloped membrane."""
    side = 'L' if s > 0 else 'R'
    p = a.pivot('Wing_' + side, (0.72 * s, -0.7, 2.38))
    X = lambda pts: [(x * s, y, z) for x, y, z in pts]
    arm = X([(0, 0, 0), (1.6, 0.2, 0.32), (3.0, -0.35, 0.5)])
    curve(a.part('Wing_arm', 'Team', p), arm, [0.17, 0.13, 0.1], 7)
    wrist = arm[-1]
    for tip in X([(5.2, 0.15, 0.32), (4.5, 1.35, 0.18), (3.2, 2.05, 0.08)]):
        curve(a.part('Wing_finger', 'Bone', p), [wrist, tip], [0.08, 0.025], 5)
    outline = [(0.05, -0.12), (1.6, 0.12), (3.0, -0.4), (5.2, 0.15), (4.3, 0.85), (4.5, 1.35), (3.75, 1.55), (3.2, 2.05), (2.2, 1.75), (1.0, 1.85), (0.15, 1.45)]
    if s < 0:
        outline = [(-x, y) for x, y in reversed(outline)]
    a.part('Wing_membrane', 'Membrane', p).prism(outline, 0.07, loc=(0, 0, 0.3), axis='Z', bevel=0)


def hind_leg(a, s):
    side = 'L' if s > 0 else 'R'
    p = a.pivot('leg_' + side, (0.72 * s, 0.85, 1.45))
    a.part('Thigh', 'Hide', p).sphere((0.4, 0.6, 0.52), loc=(0.05 * s, -0.05, -0.12), seg=10, rings=6)
    curve(a.part('Shin', 'Hide', p), [(0.1 * s, 0.15, -0.45), (0.14 * s, 0.35, -0.9), (0.12 * s, -0.2, -1.3)], [0.22, 0.17, 0.13], 7)
    a.part('Foot', 'Hide', p).sphere((0.24, 0.42, 0.12), loc=(0.12 * s, -0.42, -1.33), seg=8, rings=4)
    for k in (-1, 0, 1):
        curve(a.part('Claw', 'Bone', p), [(0.12 * s + k * 0.12, -0.7, -1.33), (0.12 * s + k * 0.15, -0.9, -1.42)], [0.06, 0.01], 5)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build(manifest=False, report=False):
    OUT.mkdir(parents=True, exist_ok=True)
    root = kit.workspace('FrontierDrake')
    kit.clear_workspace(root)
    a = Asset('emberdrake', root, ao_distance=0.9, ao_samples=40, ground=False)
    body(a)
    jaw(a)
    tail(a)
    for s in (1, -1):
        wing(a, s)
        hind_leg(a, s)
    tris = count(a)
    if report:
        for key, shape in sorted(a.shapes.items(), key=lambda kv: -sum(len(f.verts) - 2 for f in kv[1].bm.faces)):
            print(f'DRAKE_PART {sum(len(f.verts) - 2 for f in shape.bm.faces):5d} {key}')
    if tris > BUDGET:
        raise RuntimeError(f'emberdrake: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'emberdrake.glb')
    print('DRAKE_ASSET', a.triangles(), (OUT / 'emberdrake.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        row = {'name': 'emberdrake', 'file': 'emberdrake.glb', 'triangles': a.triangles(), 'boss': 'ember-drake', 'budget': BUDGET,
               'review': 'pending owner review (W9)', 'source': 'tools/blender/generate_drake.py (frontier_kit), original design',
               'animation': 'Runtime parts (src/boss-view.js DRAKE_PARTS): wings flap and fold, jaw opens to breathe, tail sways, hind legs tuck in flight; no baked clips; ember glow, breath and gust are drawn at runtime'}
        data['assets'] = [e for e in data['assets'] if e['name'] != 'emberdrake'] + [row]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args, report='--report' in args)
