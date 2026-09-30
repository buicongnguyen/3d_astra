"""Render the start-screen and HUD art from the exported GLB models (what the game loads).

Run headless so an interactive Blender session is never affected:
  blender --background --factory-startup --python tools/blender/render_ui_art.py -- [out_dir] [keyart] [portraits] [emblem]
The default out_dir is src/art, where Vite fingerprints the files it bundles.

Outputs (WebP, sRGB):
  keyart.webp / keyart-960.webp  golden-hour outpost scene for the start screen
  portraits.webp                 4x4 atlas of 192 px unit and building portraits, team paint white
  portrait-mask.webp             same atlas; alpha marks visible team paint so the page can tint
                                 portraits with the player's chosen army colour
  emblem.webp                    512 px Frontier Command emblem on a transparent background
No text is baked into images: every label stays HTML so it can be translated and scaled.
The Standard view transform keeps the vivid palette (AgX desaturates it).
"""
import math
import sys
import tempfile
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public' / 'models'
# Atlas order is part of the page contract (see src/portraits.js).
PORTRAITS = ['worker', 'vanguard', 'ranger', 'breaker', 'medic', 'engineer', 'tank', 'antitank',
             'hq', 'relay', 'barracks', 'foundry', 'tower']
CELL, COLS = 192, 4


def lin(hex_color, alpha=1.0):
    h = hex_color.lstrip('#')
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (channel(h[0:2]), channel(h[2:4]), channel(h[4:6]), alpha)


PLAYER, ENEMY, PAINT = lin('#92ebc5'), lin('#ef7660'), lin('#f4f7f5')


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def setup(width, height, transparent, samples=64):
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    eevee = scene.eevee
    eevee.taa_render_samples = samples
    for attr, value in (('use_raytracing', True), ('use_shadows', True), ('use_gtao', True)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    return scene


def world(color, strength):
    scene = bpy.context.scene
    w = scene.world or bpy.data.worlds.new('ui-art')
    scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = color
    bg.inputs['Strength'].default_value = strength


def light(kind, name, energy, color, rotation=(0, 0, 0), location=(0, 0, 10), size=0.2):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color[:3]
    if kind == 'SUN':
        data.angle = size
    elif kind == 'AREA':
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = [math.radians(a) for a in rotation]
    bpy.context.scene.collection.objects.link(obj)
    return obj


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{name}.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    return [o for o in new if o.parent is None], new


def paint_team(objects, color, mask=False):
    """Recolour Team* materials like the runtime does. mask=True renders team paint as a flat
    white emitter and everything else as holdout, so alpha marks the visible team paint."""
    for o in objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes:
                continue
            team = mat.name.startswith('Team')
            if mask:
                mat = mat.copy()
                slot.material = mat
                nodes, links = mat.node_tree.nodes, mat.node_tree.links
                out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
                if team:
                    shader = nodes.new('ShaderNodeEmission')
                    shader.inputs['Color'].default_value = (1, 1, 1, 1)
                    shader.inputs['Strength'].default_value = 1
                else:
                    shader = nodes.new('ShaderNodeHoldout')
                links.new(shader.outputs[0], out.inputs['Surface'])
                continue
            if not team:
                continue
            mat = mat.copy()
            slot.material = mat
            for n in mat.node_tree.nodes:
                if n.type != 'BSDF_PRINCIPLED':
                    continue
                base = n.inputs['Base Color']
                if base.is_linked:
                    for socket in base.links[0].from_node.inputs:
                        if socket.type == 'RGBA' and not socket.is_linked:
                            socket.default_value = color
                else:
                    base.default_value = color
                if mat.name.startswith('TeamGlow'):
                    n.inputs['Emission Color'].default_value = color


def bounds(objects):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objects if o.type in ('MESH', 'CURVE') for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def place(roots, objects, location, turn_degrees=0.0, scale=1.0):
    """Ground a model at location; game fronts face Blender -Y after the glTF axis change."""
    pivot = bpy.data.objects.new('pivot', None)
    bpy.context.scene.collection.objects.link(pivot)
    for r in roots:
        r.parent = pivot
    lo, hi = bounds(objects)
    pivot.location = (location[0] - (lo.x + hi.x) / 2 * scale, location[1] - (lo.y + hi.y) / 2 * scale, location[2] - lo.z * scale)
    pivot.rotation_euler[2] = math.radians(turn_degrees)
    pivot.scale = (scale, scale, scale)
    # Rotation moves the footprint centre; re-centre after it is applied.
    lo, hi = bounds(objects)
    pivot.location.x += location[0] - (lo.x + hi.x) / 2
    pivot.location.y += location[1] - (lo.y + hi.y) / 2
    return pivot


def camera(location, target, lens=40, ortho=None):
    data = bpy.data.cameras.new('cam')
    if ortho:
        data.type = 'ORTHO'
        data.ortho_scale = ortho
    else:
        data.lens = lens
    cam = bpy.data.objects.new('cam', data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def save_webp(pixels, width, height, path, quality):
    """pixels: float array (h, w, 4) of display-referred sRGB values in 0..1."""
    image = bpy.data.images.new(Path(path).stem, width, height, alpha=True)
    image.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    scene = bpy.context.scene
    settings = scene.render.image_settings
    settings.file_format, settings.color_mode, settings.quality = 'WEBP', 'RGBA', quality
    image.save_render(str(path), scene=scene)
    settings.file_format = 'PNG'
    bpy.data.images.remove(image)


def load_pixels(path):
    image = bpy.data.images.load(str(path))
    w, h = image.size
    data = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(data)
    bpy.data.images.remove(image)
    return data.reshape(h, w, 4)


def ground_material():
    """Sand plains with grass fields and fine dirt detail, like the Riverlands battlefield."""
    mat = bpy.data.materials.new('KeyartGround')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    # Object coordinates are metres on this plane (generated ones span 0..1 across it).
    coords = nodes.new('ShaderNodeTexCoord')
    fields = nodes.new('ShaderNodeTexNoise')
    links.new(coords.outputs['Object'], fields.inputs['Vector'])
    fields.inputs['Scale'].default_value = 0.075
    fields.inputs['Detail'].default_value = 3
    ramp = nodes.new('ShaderNodeValToRGB')
    stops = ramp.color_ramp.elements
    stops[0].position, stops[0].color = 0.4, lin('#d7bb86')
    stops[1].position, stops[1].color = 0.52, lin('#86ad54')
    stops.new(0.47).color = lin('#c4a26a')
    stops.new(0.62).color = lin('#5f9340')
    grain = nodes.new('ShaderNodeTexNoise')
    links.new(coords.outputs['Object'], grain.inputs['Vector'])
    grain.inputs['Scale'].default_value = 0.9
    grain.inputs['Detail'].default_value = 8
    shade = nodes.new('ShaderNodeMix')
    shade.data_type = 'RGBA'
    shade.blend_type = 'MULTIPLY'
    shade.inputs['Factor'].default_value = 0.22
    links.new(fields.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shade.inputs['A'])
    links.new(grain.outputs['Color'], shade.inputs['B'])
    links.new(shade.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    return mat


def water_material():
    mat = bpy.data.materials.new('KeyartWater')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = lin('#1f8fb3')
    bsdf.inputs['Roughness'].default_value = 0.06
    bsdf.inputs['Emission Color'].default_value = lin('#2fb6d6')
    bsdf.inputs['Emission Strength'].default_value = 0.18
    return mat


def keyart(out):
    reset()
    scene = setup(1600, 900, False, samples=96)
    scene.view_settings.look = 'Medium High Contrast'
    world(lin('#8db2d6'), 0.55)
    bpy.ops.mesh.primitive_plane_add(size=240, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(ground_material())
    # A river with a bridge behind the outpost, as on Meridian Riverlands.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(4, 21.5, 0.06))
    river = bpy.context.active_object
    river.scale = (160, 7.5, 1)
    river.rotation_euler[2] = math.radians(-8)
    river.data.materials.append(water_material())
    bank = bpy.data.materials.new('KeyartBank')
    bank.use_nodes = True
    bsdf = next(n for n in bank.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = lin('#9c8058')
    bsdf.inputs['Roughness'].default_value = 0.55
    bpy.ops.mesh.primitive_plane_add(size=1, location=(4, 21.5, 0.03))
    edge = bpy.context.active_object
    edge.scale = (160, 10.5, 1)
    edge.rotation_euler[2] = math.radians(-8)
    edge.data.materials.append(bank)

    def unit(name, location, turn, color):
        roots, objects = import_glb(name)
        paint_team(objects, color)
        place(roots, objects, location, turn)

    # Player outpost (left), army advancing toward the rival force (right).
    unit('hq', (-9.5, 4.0, 0), 20, PLAYER)
    unit('barracks', (-17.5, 9.5, 0), 35, PLAYER)
    unit('tower', (-3.0, 10.5, 0), 10, PLAYER)
    unit('worker', (-14.5, -1.8, 0), 150, PLAYER)
    unit('worker', (-12.0, -4.0, 0), 120, PLAYER)
    unit('tank', (-1.0, -1.0, 0), 95, PLAYER)
    for x, y in ((2.8, 2.2), (3.8, -3.6)):
        unit('vanguard', (x, y, 0), 100, PLAYER)
    for x, y in ((-2.6, 3.8), (-3.4, -5.2)):
        unit('ranger', (x, y, 0), 95, PLAYER)
    unit('breaker', (-6.8, -6.4, 0), 88, PLAYER)
    unit('tank', (15.5, 3.6, 0), -80, ENEMY)
    unit('antitank', (12.0, -1.2, 0), -95, ENEMY)
    unit('vanguard', (11.2, 4.6, 0), -100, ENEMY)

    env_roots, env_objects = import_glb('environment')
    library = {r.name: r for r in env_roots}
    for r in env_roots:
        r.hide_render = True
        for c in r.children_recursive:
            c.hide_render = True

    def prop(name, location, turn=0, scale=1.0):
        source = library[name]
        copies = {}
        for original in [source] + list(source.children_recursive):
            dup = original.copy()
            dup.hide_render = False
            bpy.context.scene.collection.objects.link(dup)
            copies[original] = dup
        for original, dup in copies.items():
            if original.parent in copies:
                dup.parent = copies[original.parent]
        root = copies[source]
        root.parent = None
        root.matrix_world.identity()
        place([root], list(copies.values()), location, turn, scale)

    for x, y, s in ((-15.5, -8.8, 1.2), (-12.8, -10.4, 1.0), (-17.8, -6.4, 0.9)):
        prop('asset_crystal_alloy', (x, y, 0), x * 13, s)
    prop('asset_crystal_energy', (-6.0, -11.5, 0), 25, 1.1)
    for name, x, y, s in (('asset_rock_a', 6.5, 9.0, 1.6), ('asset_rock_b', 20.0, -6.0, 1.8), ('asset_rock_c', -24.0, 1.0, 1.5),
                          ('asset_rock_a', 9.0, -12.0, 1.2), ('asset_rock_b', -22.0, 14.0, 1.4)):
        prop(name, (x, y, 0), x * 11, s)
    for x, y, s in ((-26.0, 27.0, 1.6), (-9.0, 29.0, 1.4), (14.0, 28.0, 1.5), (27.0, 24.0, 1.7), (-29.0, 8.0, 1.3), (29.0, 6.0, 1.5),
                    (-18.0, 30.0, 1.2), (3.0, 31.0, 1.3)):
        prop('asset_tree', (x, y, 0), x * 7, s)
    for x, y in ((0.0, 13.0), (-20.0, -3.0), (17.0, 9.0), (4.0, -14.0), (-10.0, 14.0)):
        prop('asset_bush', (x, y, 0), x * 5, 1.3)
    prop('asset_crate', (-13.0, 12.5, 0), 15, 1.0)
    prop('asset_crate', (-11.6, 13.4, 0), 40, 1.0)
    prop('asset_bridge', (7.0, 21.0, 0), 82, 1.0)
    for x in (-24.0, -14.0, 18.0, 26.0):
        prop('asset_reed', (x, 16.8 + x * -0.14, 0), x * 9, 1.4)

    # Golden-hour key from the front left, cool sky fill, bright rim behind the army.
    light('SUN', 'key', 4.2, lin('#ffd49a'), rotation=(62, 0, -58), size=math.radians(3))
    light('SUN', 'rim', 2.4, lin('#bfe0ff'), rotation=(70, 0, 150), size=math.radians(6))
    light('AREA', 'fill', 1400, lin('#9cc7ff'), rotation=(55, 0, -10), location=(-6, -40, 30), size=30)
    camera((-3.0, -31.0, 15.5), (-1.0, 3.0, 0.6), lens=36)
    tmp = Path(tempfile.mkdtemp()) / 'keyart.png'
    render(tmp)
    pixels = load_pixels(tmp)
    save_webp(pixels, 1600, 900, out / 'keyart.webp', 80)
    small = bpy.data.images.load(str(tmp))
    small.scale(960, 540)
    data = np.empty(960 * 540 * 4, dtype=np.float32)
    small.pixels.foreach_get(data)
    bpy.data.images.remove(small)
    save_webp(data.reshape(540, 960, 4), 960, 540, out / 'keyart-960.webp', 78)


def portraits(out):
    atlas = np.zeros((CELL * 4, CELL * COLS, 4), dtype=np.float32)
    mask_atlas = np.zeros_like(atlas)
    tmp = Path(tempfile.mkdtemp())
    for index, name in enumerate(PORTRAITS):
        for is_mask in (False, True):
            reset()
            setup(CELL * 2, CELL * 2, True, samples=64)
            world(lin('#6f8796'), 0.45)
            roots, objects = import_glb(name)
            paint_team(objects, PAINT, mask=is_mask)
            pivot = place(roots, objects, (0, 0, 0), 0)
            lo, hi = bounds(objects)
            centre = (lo + hi) / 2
            size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
            # Three-quarter front view from the left, slightly above, like a unit card.
            direction = Vector((-0.62, -1.0, 0.62)).normalized()
            cam = camera(centre + direction * size * 4, centre, ortho=1.0)
            bpy.context.view_layer.update()
            inv = cam.matrix_world.inverted()
            pts = [inv @ (o.matrix_world @ Vector(c)) for o in objects if o.type == 'MESH' for c in o.bound_box]
            xs, ys = [p.x for p in pts], [p.y for p in pts]
            cam.data.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.12
            right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
            up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
            cam.location += right * (max(xs) + min(xs)) / 2 + up * (max(ys) + min(ys)) / 2
            light('SUN', 'key', 3.6, lin('#ffe2b8'), rotation=(48, 0, -35), size=math.radians(4))
            light('SUN', 'rim', 3.0, lin('#bfe6ff'), rotation=(62, 0, 160), size=math.radians(8))
            light('SUN', 'fill', 0.9, lin('#9fc3ff'), rotation=(70, 0, 55), size=math.radians(20))
            path = tmp / f'{name}{"-mask" if is_mask else ""}.png'
            render(path)
            image = bpy.data.images.load(str(path))
            image.scale(CELL, CELL)
            cell = np.empty(CELL * CELL * 4, dtype=np.float32)
            image.pixels.foreach_get(cell)
            bpy.data.images.remove(image)
            row, col = divmod(index, COLS)
            # Blender images start at the bottom row.
            y0 = (3 - row) * CELL
            target = mask_atlas if is_mask else atlas
            target[y0:y0 + CELL, col * CELL:(col + 1) * CELL] = cell.reshape(CELL, CELL, 4)
    save_webp(atlas, CELL * COLS, CELL * 4, out / 'portraits.webp', 86)
    # The mask only needs alpha: team paint visible = opaque white.
    mask_atlas[..., :3] = 1.0
    save_webp(mask_atlas, CELL * COLS, CELL * 4, out / 'portrait-mask.webp', 80)


def triangle_curve(name, outer, inner, depth, bevel):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = depth
    curve.bevel_depth = bevel
    curve.bevel_resolution = 4
    for radius in (outer, inner):
        spline = curve.splines.new('POLY')
        spline.points.add(2)
        for i, angle in enumerate((90, 210, 330)):
            a = math.radians(angle)
            spline.points[i].co = (math.cos(a) * radius, math.sin(a) * radius, 0, 1)
        spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def metal(name, color, roughness, metallic=1.0, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = emission
        bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def emblem(out):
    reset()
    setup(512, 512, True, samples=96)
    # Metals mirror the world: a bright, cool studio environment keeps the gold vivid.
    world(lin('#b8c9d8'), 1.3)
    outer = triangle_curve('outer', 1.0, 0.7, 0.18, 0.04)
    inner = triangle_curve('inner', 0.42, 0.2, 0.22, 0.03)
    outer.data.materials.append(metal('EmblemGold', lin('#ffc65c'), 0.3))
    inner.data.materials.append(metal('EmblemMint', lin('#6fe0b0'), 0.4, 0.0, lin('#92ebc5'), 0.9))
    for o in (outer, inner):
        o.rotation_euler = (math.radians(90), 0, math.radians(-14))
    # The logo's inner triangle sits low inside the outer one.
    inner.location = (0.04, -0.06, -0.14)
    light('SUN', 'key', 4.5, lin('#fff0d6'), rotation=(45, 0, -35), size=math.radians(5))
    light('SUN', 'rim', 3.5, lin('#bde4ff'), rotation=(65, 0, 155), size=math.radians(10))
    lo, hi = bounds([outer, inner])
    centre = (lo + hi) / 2
    size = max(hi.x - lo.x, hi.z - lo.z)
    camera((centre.x, centre.y - 8, centre.z + 0.6), (centre.x, centre.y, centre.z), ortho=size * 1.18)
    tmp = Path(tempfile.mkdtemp()) / 'emblem.png'
    render(tmp)
    save_webp(load_pixels(tmp), 512, 512, out / 'emblem.webp', 88)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = {'keyart', 'portraits', 'emblem'}
    # Part names select what to render; any other argument is the output folder.
    folders = [a for a in args if a not in names]
    out = Path(folders[0]) if folders else ROOT / 'src' / 'art'
    out.mkdir(parents=True, exist_ok=True)
    parts = {a for a in args if a in names} or names
    if 'emblem' in parts:
        emblem(out)
    if 'portraits' in parts:
        portraits(out)
    if 'keyart' in parts:
        keyart(out)
    print('UI art written to', out)


main()
