"""Render review sheets of the exported GLB models (what the game actually loads).

Run headless so an interactive Blender session is never affected:
  blender --background --python tools/blender/preview_assets.py -- <out.png> <angle> <model> [<model> ...]
angle: "game" (orthographic, the in-game camera direction) or "hero" (close 3/4 perspective).
Team materials are painted with the default player colour, as the runtime does.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public' / 'models'
TEAM = (0.29, 0.83, 0.56, 1)  # #92ebc5 in linear RGB
GROUND = (0.25, 0.21, 0.15, 1)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(color):
    color = color.lstrip('#')
    return tuple(srgb_to_linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)


def paint_team(mat, team=None):
    if not mat.use_nodes:
        return
    TEAM = team or globals()['TEAM']
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            base = n.inputs['Base Color']
            if base.is_linked:
                src = base.links[0].from_node
                for s in src.inputs:
                    if s.type == 'RGBA' and not s.is_linked:
                        s.default_value = TEAM
            else:
                base.default_value = TEAM
            if mat.name.startswith('TeamGlow'):
                n.inputs['Emission Color'].default_value = TEAM


def main():
    global TEAM
    raw = sys.argv[sys.argv.index('--') + 1:]
    greyscale = '--greyscale' in raw
    global HERO_DISTANCE
    HERO_DISTANCE = 1.0
    for flag in raw:
        if flag.startswith('--hero-distance='):
            HERO_DISTANCE = float(flag.split('=', 1)[1])
        if flag.startswith('--team='):
            color = flag.split('=',1)[1].lstrip('#')
            TEAM = tuple(srgb_to_linear(int(color[i:i+2],16)/255) for i in (0,2,4)) + (1,)
    args = [value for value in raw if not value.startswith('--')]
    out, angle, names = args[0], args[1], args[2:]
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = (1600, 900)
    scene.render.film_transparent = False
    scene.use_nodes = greyscale
    if greyscale:
        nodes = scene.node_tree.nodes
        nodes.clear()
        source = nodes.new('CompositorNodeRLayers')
        grey = nodes.new('CompositorNodeRGBToBW')
        output = nodes.new('CompositorNodeComposite')
        scene.node_tree.links.new(source.outputs['Image'],grey.inputs['Image'])
        scene.node_tree.links.new(grey.outputs['Val'],output.inputs['Image'])
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('preview') if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.42, 0.47, 0.46, 1)
    bg.inputs['Strength'].default_value = 0.9

    x = 0.0
    placed = []
    items = []
    colors = {}
    for name in names:
        # "kite@3.5" shows a flyer raised 3.5 m above the ground (its fly height in the view);
        # "balloon:ef7660" paints that model's team parts in its own faction colour.
        name, _, color = name.partition(':')
        name, _, lift = name.partition('@')
        colors[name] = hex_linear(color) if color else None
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{name}.glb') if not name.endswith('.glb') else name)
        new = [o for o in bpy.data.objects if o not in before]
        roots = [o for o in new if o.parent is None]
        # Core units carry baked clips on MotionRoot; their keys would undo the layout shift.
        for o in new:
            o.animation_data_clear()
        for r in roots:
            r.location.z += float(lift or 0)
        if Path(name).stem == 'environment':  # one scenery asset per asset_* root
            items += [(r.name, [r], [r] + list(r.children_recursive)) for r in roots]
        else:
            items.append((name, roots, new))
    for name, roots, new in items:
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        width = hi.x - lo.x
        shift = x - lo.x
        for r in roots:
            r.location.x += shift
        placed.append((name, x + width / 2, hi.z))
        x += width + 0.9
        for o in new:
            if o.type == 'MESH':
                for slot in o.material_slots:
                    if slot.material and slot.material.name.startswith('Team'):
                        paint_team(slot.material, colors.get(name))
    span = x - 0.9
    for _, roots, _ in items:
        for root in roots:
            root.location.x -= span / 2

    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    ground = bpy.context.object
    gm = bpy.data.materials.new('ground')
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    gb.inputs['Base Color'].default_value = GROUND
    gb.inputs['Roughness'].default_value = 0.95
    ground.data.materials.append(gm)

    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.6
    sun.angle = math.radians(3)
    sun.color = (1.0, 0.9, 0.75)
    so = bpy.data.objects.new('sun', sun)
    scene.collection.objects.link(so)
    so.rotation_euler = Vector((-25, -20, 55)).to_track_quat('Z', 'Y').to_euler()

    cam = bpy.data.cameras.new('cam')
    co = bpy.data.objects.new('cam', cam)
    scene.collection.objects.link(co)
    scene.camera = co
    height = max(z for _, _, z in placed)
    if angle == 'game':
        cam.type = 'ORTHO'
        cam.ortho_scale = max(span * 1.08, height * 3.2)
        direction = Vector((22, -38, 56)).normalized()
        target = Vector((0, 0, height * 0.35))
        co.location = target + direction * 60
    else:
        cam.lens = 55
        direction = Vector((0.55, -1.0, 0.5)).normalized()
        target = Vector((0, 0, height * 0.42))
        co.location = target + direction * max(span * 1.25, height * 2.6) * HERO_DISTANCE
    co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
    cam.clip_end = 500
    label_material = bpy.data.materials.new('Review labels')
    label_material.use_nodes = True
    principled = next(n for n in label_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (.025,.035,.04,1)
    bpy.context.view_layer.update()
    view = co.matrix_world.inverted()
    mesh_points = [view @ (o.matrix_world @ Vector(c)) for o in bpy.data.objects if o.type == 'MESH' and o != ground for c in o.bound_box]
    label_y = min(point.y for point in mesh_points) - .5
    for name, center, top in placed:
        text = bpy.data.curves.new('Review label','FONT')
        text.body = Path(name).stem
        text.align_x = 'CENTER'
        text.size = max(.2,min(.32,span/45))
        text.materials.append(label_material)
        label = bpy.data.objects.new('Review label',text)
        scene.collection.objects.link(label)
        label_x = (view @ Vector((center-span/2,0,0))).x
        label.location = co.matrix_world @ Vector((label_x,label_y,-1))
        label.rotation_euler = co.rotation_euler
        if hasattr(label,'visible_shadow'): label.visible_shadow = False
    if angle == 'game':
        bpy.context.view_layer.update()
        view = co.matrix_world.inverted()
        points = [view @ (o.matrix_world @ Vector(c)) for o in bpy.data.objects if o.type in {'MESH','FONT'} and o != ground for c in o.bound_box]
        left,right = min(p.x for p in points),max(p.x for p in points)
        bottom,top = min(p.y for p in points),max(p.y for p in points)
        co.location += co.matrix_world.to_3x3() @ Vector(((left+right)/2,(bottom+top)/2,0))
        aspect = scene.render.resolution_x / scene.render.resolution_y
        cam.ortho_scale = max(right-left,(top-bottom)*aspect)*1.15
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('PREVIEW_WRITTEN', out)


if __name__ == "__main__":
    main()
