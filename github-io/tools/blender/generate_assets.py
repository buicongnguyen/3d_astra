"""Generate original Frontier Command models. No add-ons or paid services required.

Run: blender --background --python tools/blender/generate_assets.py
Outputs: public/models/*.glb, assets/source/frontier-library.blend, manifest.json.
Units use named articulated parts; walking/weapon motion is applied in Three.js.
"""
import bpy
import math
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'assets' / 'source'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = .55
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


armor = material('Armor', (.16, .23, .23), .5)
dark = material('Undercarriage', (.045, .065, .07), .35)
team = material('Team', (.24, .66, .52), .25)
glow = material('TeamGlow', (.34, 1., .76), .15, 2)
steel = material('Steel', (.52, .58, .53), .6)
glass = material('Glass', (.055, .18, .21), .4, .4)
amber = material('Alloy', (.93, .51, .15), .25, .55)
energy = material('Energy', (.25, .62, .92), .25, 1.1)
parts = []


def finish(obj, name, mat, parent=None):
    obj.name = name
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    parts.append(obj)
    return obj


def box(name, loc, scale, mat=armor, bevel=.08, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, mat, parent)


def cylinder(name, loc, radius, depth, mat=armor, vertices=12, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    return finish(bpy.context.object, name, mat, parent)


def pivot(name, loc):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    parts.append(o)
    return o


def beacon(x, y, z):
    cylinder('Beacon_pole', (x, y, z / 2), .045, z, steel, 6)
    cylinder('Beacon', (x, y, z), .12, .16, glow, 8)


def infantry(kind):
    heavy = kind == 'vanguard'
    for s in [-1, 1]:
        p = pivot('leg_L' if s < 0 else 'leg_R', (s * .27, 0, .95))
        box('Leg_armor', (0, 0, -.32), (.35, .42, .63), team if heavy else armor, .05, p)
        box('Boot', (0, -.13, -.8), (.4, .64, .27), dark, .035, p)
    box('Torso', (0, 0, 1.42), (1.0 if heavy else .85, .57, .85), team)
    box('Chest_inset', (0, -.31, 1.48), (.49, .1, .34), dark, .02)
    box('Chest_light', (0, -.38, 1.58), (.3, .03, .065), glow, .01)
    box('Backpack', (0, .44, 1.52), (.6, .28, .65), armor)
    box('Helmet', (0, -.01, 2.12), (.65, .62, .53), steel if kind == 'worker' else armor)
    box('Visor', (0, -.33, 2.13), (.52, .045, .18), glow, .015)
    for s in [-1, 1]:
        box('Shoulder', (s * .64, 0, 1.68), (.37, .56, .42), armor)
        box('Arm', (s * .65, -.1, 1.3), (.28, .32, .53), dark)
    if kind == 'worker':
        box('Mining_tool', (.68, -.55, 1.22), (.3, .95, .3), steel)
        box('Tool_tip', (.68, -1.08, 1.22), (.23, .18, .23), amber)
        cylinder('Cargo', (0, .52, 1.75), .27, .65, amber, 6)
    elif heavy:
        box('Shield', (-.77, -.42, 1.24), (.67, .23, 1.25), team)
        box('Shield_stripe', (-.77, -.56, 1.25), (.12, .03, .95), glow, .01)
        box('Blade', (.72, -.53, 1.04), (.12, .18, 1.2), steel, .02)
    else:
        box('Rifle', (.57, -.64, 1.43), (.25, 1.3, .26), armor, .03)
        box('Rifle_tip', (.57, -1.34, 1.43), (.12, .19, .12), glow, .01)


def breaker():
    box('Chassis', (0, 0, .68), (1.8, 2.55, .65), team)
    for s in [-1, 1]:
        box('Track', (s * 1.02, 0, .45), (.5, 2.85, .62), dark)
        for i in range(6):
            box('Tread', (s * 1.03, -.99 + i * .4, .78), (.55, .1, .05), steel, .01)
    cylinder('Turret_base', (0, .15, 1.15), .73, .35, armor)
    box('turret', (0, .1, 1.5), (1.3, 1.4, .62), armor)
    for s in [-1, 1]:
        box('Cannon', (s * .35, -1.05, 1.5), (.25, 1.5, .25), steel, .035)
        box('Muzzle', (s * .35, -1.84, 1.5), (.27, .13, .27), glow, .02)
    box('Team_stripe', (0, .13, 1.83), (.27, 1., .03), team, .01)


def foundation(sx, sy):
    box('Foundation', (0, 0, .2), (sx + .5, sy + .5, .4), dark)
    for x in [-sx / 2, sx / 2]:
        for y in [-sy / 2, sy / 2]:
            box('Corner_armor', (x, y, .5), (.45, .45, .7), steel, .06)


def building(kind):
    if kind == 'hq':
        foundation(5, 4.8)
        box('Core', (0, 0, 1.3), (4.8, 4.3, 2.2), armor, .22)
        box('Roof', (0, .25, 2.5), (4.4, 3.5, .4), team)
        box('Command_deck', (0, .3, 3.25), (2.4, 2.2, 1.2), armor, .15)
        box('Command_windows', (0, -.83, 3.38), (2.1, .08, .4), glow, .02)
        box('Door', (0, -2.2, 1.1), (1.6, .1, 1.65), dark, .03)
        box('Door_light', (0, -2.29, 2.02), (1.6, .1, .12), glow, .01)
        for s in [-1, 1]:
            box('Side_module', (s * 2.55, .1, 1.05), (.8, 3.4, 1.4), team)
            for y in [-.8, 0, .8]:
                box('Cooling_vent', (s * 2.55, y, 1.8), (.52, .35, .06), dark, .01)
        beacon(1, 1, 5)
        cylinder('Dish_pedestal', (-.65, .5, 4.0), .12, .7, steel)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=.65, location=(-.65, .5, 4.3))
        dish = finish(bpy.context.object, 'Satellite', steel)
        dish.scale = (1, 1, .22)
    elif kind == 'barracks':
        foundation(3.9, 3.8)
        box('Hangar', (0, 0, 1.25), (3.7, 3.5, 2.2), armor, .22)
        box('Roof', (0, .1, 2.45), (3.8, 3.3, .35), team)
        box('Bay', (0, -1.79, 1.14), (2.5, .1, 1.65), dark)
        for s in [-1, 1]: box('Bay_light', (s * 1.3, -1.88, 1.2), (.11, .08, 1.6), glow, .01)
        for i in [-1, 0, 1]: box('Roof_rib', (i * 1.1, 0, 2.7), (.23, 3.5, .18), steel, .02)
        beacon(1.5, 1.4, 3.5)
    elif kind == 'foundry':
        foundation(4.4, 4.2)
        box('Factory', (0, 0, 1.4), (4.1, 3.9, 2.5), armor, .17)
        box('Factory_roof', (0, 0, 2.8), (4.3, 3.8, .4), team)
        box('Bay', (0, -2, 1.3), (2.8, .1, 1.9), dark)
        for s in [-1, 1]:
            cylinder('Chimney', (s * 1.35, .75, 3.65), .42, 2.2, steel, 8)
            cylinder('Chimney_light', (s * 1.35, .75, 4.7), .44, .12, amber, 8)
        box('Bay_light', (0, -2.12, 2.35), (2.8, .1, .12), glow, .01)
    elif kind == 'relay':
        foundation(2.5, 2.5)
        box('Power_base', (0, 0, .75), (2.3, 2.3, 1.1), armor)
        cylinder('Reactor', (0, 0, 1.65), .7, 1.5, team, 8)
        cylinder('Reactor_ring', (0, 0, 2.1), .8, .16, glow, 12)
        cylinder('Antenna', (0, 0, 3), .065, 2.5, steel, 6)
        box('Antenna_cross', (0, 0, 3.7), (1.7, .12, .12), steel, .02)
        beacon(0, 0, 4.3)
    elif kind == 'tower':
        foundation(2.1, 2.1)
        box('Pedestal', (0, 0, 1.7), (1.2, 1.2, 3), armor)
        box('Vertical_light', (0, -.63, 1.8), (.2, .06, 2.2), glow, .01)
        cylinder('Turret_ring', (0, 0, 3.2), 1, .3, team)
        box('turret', (0, 0, 3.65), (1.5, 1.5, .7), armor)
        for s in [-1, 1]: box('Barrel', (s * .38, -1.1, 3.65), (.18, 1.5, .2), steel, .02)


manifest = {'generator': 'Blender Python', 'units': 'meters', 'provenance': 'Original assets generated for this repository; no third-party model sources.', 'assets': []}
for index, kind in enumerate(['worker', 'vanguard', 'ranger', 'breaker', 'hq', 'barracks', 'foundry', 'relay', 'tower']):
    parts = []
    if kind in ['worker', 'vanguard', 'ranger']:
        infantry(kind)
    elif kind == 'breaker':
        breaker()
    else:
        building(kind)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in parts if o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{kind}.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
    triangles = 0
    for o in parts:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            triangles += len(o.data.loop_triangles)
    manifest['assets'].append({'name': kind, 'file': f'{kind}.glb', 'triangles': triangles, 'animation': 'Runtime articulated parts; no baked clips'})
    # Move root objects into a browsable asset library after exporting at origin.
    for o in parts:
        if not o.parent:
            o.location.x += (index % 3) * 11
            o.location.y += (index // 3) * 11

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'frontier-library.blend'))
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('FRONTIER_ASSETS_COMPLETE', json.dumps(manifest))
