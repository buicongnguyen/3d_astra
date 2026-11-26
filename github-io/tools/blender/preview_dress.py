"""Review sheets for the faction dress (visual round V): every shared model with one faction's dress on it, in a
row, at the in-game camera direction (or a close 3/4 hero angle). What is rendered is what the game loads: the base
GLB plus the dress-<faction>.glb parts, team parts painted like the runtime does.

  blender -b --factory-startup --python tools/blender/preview_dress.py -- <ABSOLUTE out.png> <faction|meridian> units|buildings|<type,type,...>
          [--team=<hex>] [--greyscale] [--hero]

--team paints Team/TeamGlow parts (default: the faction's own colour); --greyscale renders luminance only (the
silhouette and value read without colour). Meridian renders the base models alone.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public' / 'models'
GROUND = (0.25, 0.21, 0.15, 1)
COLOURS = {'meridian': '#92ebc5', 'ashfall': '#ef7660', 'sunward': '#edc76f', 'wardens': '#689dff', 'veil': '#b397ee'}
GLOWS = {'meridian': '#92ebc5', 'ashfall': '#ffb347', 'sunward': '#fff2a8', 'wardens': '#c8f1ff', 'veil': '#f0b3ff'}
UNITS = ['worker', 'vanguard', 'ranger', 'medic', 'engineer', 'antitank', 'breaker', 'tank', 'kite']
BUILDINGS = ['hq', 'barracks', 'foundry', 'relay', 'tower']


def linear(hex_):
    h = hex_.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1,)


def paint(mat, colour, glow):
    if not mat.use_nodes:
        return
    for n in mat.node_tree.nodes:
        if n.type != 'BSDF_PRINCIPLED':
            continue
        base = n.inputs['Base Color']
        if base.is_linked:
            for s in base.links[0].from_node.inputs:
                if s.type == 'RGBA' and not s.is_linked:
                    s.default_value = colour
        else:
            base.default_value = colour
        if mat.name.startswith('TeamGlow'):
            n.inputs['Emission Color'].default_value = glow


def imported(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def main():
    raw = sys.argv[sys.argv.index('--') + 1:]
    args = [a for a in raw if not a.startswith('--')]
    out, faction, which = args[0], args[1], args[2]
    team = next((a.split('=', 1)[1] for a in raw if a.startswith('--team=')), COLOURS.get(faction, '#92ebc5'))
    glow = linear(GLOWS.get(faction, team) if not any(a.startswith('--team=') for a in raw) else team)
    team = linear(team)
    greyscale, hero = '--greyscale' in raw, '--hero' in raw
    names = UNITS if which == 'units' else BUILDINGS if which == 'buildings' else which.split(',')
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    scene.use_nodes = greyscale
    if greyscale:
        nodes = scene.node_tree.nodes
        nodes.clear()
        src, grey, dst = nodes.new('CompositorNodeRLayers'), nodes.new('CompositorNodeRGBToBW'), nodes.new('CompositorNodeComposite')
        scene.node_tree.links.new(src.outputs['Image'], grey.inputs['Image'])
        scene.node_tree.links.new(grey.outputs['Val'], dst.inputs['Image'])
    transforms = [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items]
    scene.view_settings.view_transform = 'AgX' if 'AgX' in transforms else 'Filmic'
    world = scene.world or bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.42, 0.47, 0.46, 1)
    bg.inputs['Strength'].default_value = 0.9

    # The faction's dress file once; each model's root `dress_<type>` rides with its base model.
    dress = {}
    if faction != 'meridian':
        for o in imported(MODELS / f'dress-{faction}.glb'):
            if o.parent is None and o.name.startswith('dress_'):
                dress[o.name[len('dress_'):].split('.')[0]] = o
    x, placed, groups = 0.0, [], []
    for name in names:
        objs = imported(MODELS / f'{name}.glb')
        for o in objs:
            o.animation_data_clear()
        roots = [o for o in objs if o.parent is None]
        lift = 1.0 if name == 'kite' else 0.0
        if name in dress:
            roots.append(dress[name])
            objs += [dress[name]] + list(dress[name].children_recursive)
        for r in roots:
            r.location.z += lift
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
        lo = min(p.x for p in pts)
        width = max(p.x for p in pts) - lo
        for r in roots:
            r.location.x += x - lo
        placed.append((name, x + width / 2, max(p.z for p in pts)))
        groups.append(roots)
        x += width + 0.9
        for o in objs:
            if o.type == 'MESH':
                for slot in o.material_slots:
                    if slot.material and slot.material.name.startswith('Team'):
                        paint(slot.material, team, glow)
    for name, root in dress.items():
        if name not in names:
            for o in [root] + list(root.children_recursive):
                bpy.data.objects.remove(o)
    span = x - 0.9
    for roots in groups:
        for r in roots:
            r.location.x -= span / 2

    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    ground = bpy.context.object
    gm = bpy.data.materials.new('ground')
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    gb.inputs['Base Color'].default_value = GROUND
    gb.inputs['Roughness'].default_value = 0.95
    ground.data.materials.append(gm)
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy, sun.angle, sun.color = 3.6, math.radians(3), (1.0, 0.9, 0.75)
    so = bpy.data.objects.new('sun', sun)
    scene.collection.objects.link(so)
    so.rotation_euler = Vector((-25, -20, 55)).to_track_quat('Z', 'Y').to_euler()
    cam = bpy.data.cameras.new('cam')
    co = bpy.data.objects.new('cam', cam)
    scene.collection.objects.link(co)
    scene.camera = co
    height = max(z for _, _, z in placed)
    if hero:
        cam.lens = 55
        direction = Vector((0.55, -1.0, 0.5)).normalized()
        target = Vector((0, 0, height * 0.42))
        co.location = target + direction * max(span * 1.25, height * 2.6)
    else:
        cam.type = 'ORTHO'
        direction = Vector((22, -38, 56)).normalized()
        target = Vector((0, 0, height * 0.35))
        co.location = target + direction * 60
    co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
    cam.clip_end = 500
    label_mat = bpy.data.materials.new('labels')
    label_mat.use_nodes = True
    next(n for n in label_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.025, .035, .04, 1)
    bpy.context.view_layer.update()
    view = co.matrix_world.inverted()
    pts = [view @ (o.matrix_world @ Vector(c)) for o in bpy.data.objects if o.type == 'MESH' and o != ground for c in o.bound_box]
    label_y = min(p.y for p in pts) - .5
    for name, centre, _ in placed:
        text = bpy.data.curves.new('label', 'FONT')
        text.body = name
        text.align_x = 'CENTER'
        text.size = max(.2, min(.32, span / 45))
        text.materials.append(label_mat)
        label = bpy.data.objects.new('label', text)
        scene.collection.objects.link(label)
        label.location = co.matrix_world @ Vector(((view @ Vector((centre - span / 2, 0, 0))).x, label_y, -1))
        label.rotation_euler = co.rotation_euler
    if not hero:
        bpy.context.view_layer.update()
        view = co.matrix_world.inverted()
        pts = [view @ (o.matrix_world @ Vector(c)) for o in bpy.data.objects if o.type in {'MESH', 'FONT'} and o != ground for c in o.bound_box]
        left, right = min(p.x for p in pts), max(p.x for p in pts)
        bottom, top = min(p.y for p in pts), max(p.y for p in pts)
        co.location += co.matrix_world.to_3x3() @ Vector(((left + right) / 2, (bottom + top) / 2, 0))
        cam.ortho_scale = max(right - left, (top - bottom) * scene.render.resolution_x / scene.render.resolution_y) * 1.1
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('PREVIEW_WRITTEN', out)


if __name__ == '__main__':
    main()
