"""Dune Wyrm and Wyrmling for the Wild frontier desert test (AAA round 4, P1). Headless Blender 4.5; no external assets.

  blender -b --python tools/blender/generate_wyrm.py -- [--manifest] [--report]

Writes public/models/wyrm.glb (the tamed creature) and public/models/wyrmling.glb (the nest guard). With
--manifest it also records both in public/models/manifest.json (kind unit, triangle budget, review pending).

The adult and nest guard share a cool segmented hide, cream belly, luminous eyes, upturned tusks
and articulated forelegs. A coloured border on the fan carries the team tint. Five materials;
Blender -Y is the front. Geometry is authored in metres and the juvenile scales about its feet.
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

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
R = math.pi / 2
BUDGETS = {'wyrm': 3200, 'wyrmling': 2600}

kit.MATERIALS.setdefault('Hide', ('#387d77', 0.03, 0.62, 0.0))
kit.MATERIALS.setdefault('Belly', ('#f6dbab', 0.0, 0.64, 0.0))
kit.MATERIALS.setdefault('Ridge', ('#213e45', 0.05, 0.55, 0.0))


def spine(t):
    """Pose the widened body above the ground along the original S-shaped footprint."""
    rise = max(0.0, 1.0 - t * 2.4)
    r = (0.5 * (1 - 0.62 * t) + 0.08) * 1.4
    r *= min(1.0, (1 - t) * 5 + .12)
    return (0.34 * math.sin(t * math.pi * 1.5), -.7 + t * 3.3, .84 * r + .98 * rise * rise), r


def tapered_curve(shape, points, radii, sides=8):
    """Loft smooth tapered anatomy through its joints, including the hooked tusks."""
    points = [Vector(p) for p in points]
    rings = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i+1, len(points)-1)] - points[max(0, i-1)]).normalized()
        normal = tangent.cross(Vector((1, 0, 0))).normalized()
        binormal = tangent.cross(normal)
        rings.append([shape.bm.verts.new(point + radius * (math.cos(angle) * normal + math.sin(angle) * binormal))
                      for angle in (k * math.tau / sides for k in range(sides))])
    shape._faces(rings)


def body(a, young):
    # Overlapping scutes have a dark leading band, and a warm underside visible across both flanks.
    n = 6 if young else 8
    for i in range(n):
        t = i / (n - 1)
        (x, y, z), r = spine(t)
        a.part('Scute', 'Hide').sphere((1.08*r, .85*r, .88*r), loc=(x,y,z), seg=10, rings=5)
        if i < n - 1:
            a.part('Ventral_scute', 'Belly').sphere((.99*r, .77*r, .52*r), loc=(x,y-.04*r,z-.31*r), seg=10, rings=4)
            a.part('Segment_band', 'Ridge').torus(.80*r, .075*r, loc=(x,y+.39*r,z), rot=(R-.16,0,0), seg=10, ring=3)
    if not young:
        (x,y,z),r=spine(.39)
        a.part('Saddle', 'Ridge').sphere((.67*r,.91*r,.27*r),loc=(x,y,z+.74*r),seg=10,rings=4)


def head(a, young):
    (x,y,z), body_r = spine(0)
    # Original 0.609 m head reference radius; the 1.6 factor is independent of body thickening.
    r = .58 * 1.05 * 1.6
    y -= body_r * .22
    z += body_r * .2
    def pt(dx,dy,dz):
        return (x+dx*r, y+dy*r, z+dz*r)
    def oval(name,mat,rad,at,seg=12,rings=6):
        a.part(name,mat).sphere(tuple(v*r for v in rad),loc=pt(*at),seg=seg-1 if young else seg,rings=rings)
    oval('Crown','Hide',(.81,.86,.62),(0,-.54,.15))
    oval('Lower_jaw','Belly',(.66,.77,.24),(0,-1.10,-.25))
    oval('Mouth','Ridge',(.68,.68,.13),(0,-1.21,-.10))
    oval('Muzzle','Hide',(.70,.68,.36),(0,-1.23,.09))
    for sign in (-1,1):
        oval('Nostril','Ridge',(.070,.060,.044),(.28*sign,-1.78,.26),7,4)
        oval('Eye_socket','Ridge',(.28,.31,.27),(.57*sign,-.91,.39),10,5)
        oval('Eye','Flame',(.22,.23,.22),(.64*sign,-1,.44),10,5)
        oval('Pupil','Ridge',(.086,.11,.14),(.76*sign,-1.10,.49),8,4)
        tapered_curve(a.part('Ivory_tusks','Belly'),
                      [pt(sign*dx,dy,dz) for dx,dy,dz in [(.55,-1.15,-.24),(.73,-1.40,-.19),(.77,-1.64,-.02),(.68,-1.77,.18)]],
                      [r*.16,r*.17,r*.105,r*.012])
    # The scalloped outer strip remains readable even with a neutral nest tint.
    h=.64 if young else .87
    outline=[(-.99,.09),(-1.13,.55),(-.85,.50),(-.82,.91),(-.48,.76),
             (-.34,1.12),(0,.97),(.34,1.12),(.48,.76),(.82,.91),(.85,.50),(1.13,.55),(.99,.09),(0,0)]
    profile=[(dx*r,dz*r*h) for dx,dz in outline]
    a.part('Crest_edge','Team').prism(profile,.13*r,loc=pt(0,.02,.60),rot=(-.48,0,0),axis='Y',bevel=0)
    a.part('Crest_web','Hide').prism([(dx*.66,dz*.62) for dx,dz in profile],.18*r,
                                      loc=pt(0,-.005,.61),rot=(-.48,0,0),axis='Y',bevel=0)


def forelegs(a, young):
    (x,y,z),r=spine(.16)
    for s,side in ((-1,'L'),(1,'R')):
        p=a.pivot('leg_'+side,(x+s*.76*r,y,z))
        reach=.84 if young else 1
        elbow=(s*.35*reach,-.16,-.40)
        ankle=(s*.47*reach,-.42,-z+.19)
        tapered_curve(a.part('Forelimb','Hide',p),[(0,0,0),elbow,ankle],[.28,.245,.175],7)
        foot=(ankle[0],ankle[1]-.13,.16-z)
        a.part('Forelimb','Hide',p).sphere((.24,.32,.16),loc=foot,seg=9,rings=4)
        for k in (-1,1):
            tapered_curve(a.part('Claws','Belly',p),
                          [(foot[0]+k*.12,foot[1]-.12,foot[2]),(foot[0]+k*.15,foot[1]-.29,foot[2]-.04),
                           (foot[0]+k*.18,foot[1]-.42,foot[2]-.10)], [.095,.075,.012],6)


def creature(a, young=False):
    body(a, young)
    head(a, young)
    forelegs(a, young)


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
                          'review': 'pending owner review (F8 creature art)', 'animation': 'Runtime articulated parts (foreleg pivots); no baked clips'})


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
