"""Story cast busts for Frontier Command (src/story/world.js CAST), rendered headless in Blender.

    blender --background --factory-startup --python tools/blender/render_cast_portraits.py -- [out_dir] [id ...]

Writes 256 px PNGs (default public/portraits/<id>.png). Convert to webp with
tools/portraits_to_webp.py (Pillow) so src/cast-portraits.js picks them up with no code change.
Every character is built from a handful of smooth primitives and lit by the same rig (warm key
from the left, cool rim, soft fill) over a dark field with a faction-colour halo, so the cast
reads as one set from 28 px to 160 px: large head, big eyes, one strong colour per person.
All characters are original. ECHO and the Commander have no face on purpose.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SIZE = 256
FIELD = '#0c2029'


def lin(h, a=1.0):
    h = h.lstrip('#')
    def ch(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (ch(h[0:2]), ch(h[2:4]), ch(h[4:6]), a)


_mats = {}


def mat(hex_, rough=0.5, metal=0.0, emit=0.0, sss=0.0):
    key = (hex_, rough, metal, emit, sss)
    if key not in _mats:
        m = bpy.data.materials.new(hex_)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = lin(hex_)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        if emit:
            b.inputs['Emission Color'].default_value = lin(hex_)
            b.inputs['Emission Strength'].default_value = emit
        if sss and 'Subsurface Weight' in b.inputs:
            b.inputs['Subsurface Weight'].default_value = sss
            b.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.25)
            b.inputs['Subsurface Scale'].default_value = 0.05
        _mats[key] = m
    return _mats[key]


def finish(o, m, smooth=True):
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def sphere(loc, scale, m, rot=(0, 0, 0), seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cyl(loc, r, depth, m, rot=(0, 0, 0), scale=(1, 1, 1), r2=None, seg=32):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def torus(loc, major, minor, m, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=14,
                                     location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def box(loc, size, m, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    if bevel:
        bv = o.modifiers.new('b', 'BEVEL')
        bv.width, bv.segments = bevel, 3
    return finish(o, m)


def curve(points, radius, m, handles='AUTO', taper=False):
    c = bpy.data.curves.new('c', 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth = radius
    c.bevel_resolution = 4
    c.use_fill_caps = True
    s = c.splines.new('BEZIER')
    s.bezier_points.add(len(points) - 1)
    for p, v in zip(s.bezier_points, points):
        p.co = v
        p.handle_left_type = p.handle_right_type = handles
    o = bpy.data.objects.new('c', c)
    bpy.context.scene.collection.objects.link(o)
    c.materials.append(m)
    return o


def cut(o, z_at_front, tilt=0.0, keep_above=True):
    """Trim a sphere with a tilted horizontal plane (hairlines, hoods, beards)."""
    bpy.context.view_layer.update()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    mw = o.matrix_world
    n = Vector((0, -tilt, 1))
    bm.transform(mw)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z_at_front), plane_no=n,
                           clear_inner=keep_above, clear_outer=not keep_above)
    bm.transform(mw.inverted())
    bm.to_mesh(o.data)
    bm.free()
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# --------------------------------------------------------------------------- shared anatomy
HC = Vector((0, 0, 1.08))      # head centre
HS = (0.46, 0.43, 0.52)        # head radii


def face_y(x, z, shrink=1.0):
    t = 1 - (x / HS[0]) ** 2 - ((z - HC.z) / HS[2]) ** 2
    return HC.y - HS[1] * math.sqrt(max(t, 0.02)) * shrink


def body(coat, skin, shoulder=1.0, neck_w=1.0, collar=None):
    sphere((0, 0.08, -0.06), (1.0 * shoulder, 0.5, 0.66), mat(coat, 0.62))
    cyl((0, -0.02, 0.72), 0.17 * neck_w, 0.45, mat(skin, 0.55, sss=0.2))
    if collar:
        torus((0, -0.02, 0.62), 0.24, 0.07, mat(collar, 0.6), scale=(1.15, 1, 0.8))


def head(skin, jaw=1.0):
    sphere(HC, (HS[0], HS[1], HS[2]), mat(skin, 0.5, sss=0.25))
    # chin / jaw softness
    sphere((0, -0.1, 0.78), (0.3 * jaw, 0.27, 0.2), mat(skin, 0.5, sss=0.25))
    # ears
    for s in (-1, 1):
        sphere((s * 0.45, 0.03, 1.04), (0.07, 0.06, 0.12), mat(skin, 0.5, sss=0.25))
    # nose and cheeks
    sphere((0, face_y(0, 0.99) - 0.03, 0.99), (0.07, 0.08, 0.09), mat(skin, 0.5, sss=0.25))
    for s in (-1, 1):
        sphere((s * 0.27, face_y(0.27, 0.9) + 0.03, 0.9), (0.11, 0.07, 0.09), mat('#ff8f80', 0.7), seg=16).scale.y = 0.05


def eyes(iris, spread=0.19, z=1.1, size=1.0, lid=0.0, look=(0, 0)):
    for s in (-1, 1):
        x = s * spread
        y = face_y(x, z)
        sphere((x, y - 0.0, z), (0.085 * size, 0.045, 0.1 * size * (1 - lid)), mat('#fbfbf6', 0.25))
        sphere((x + look[0], y - 0.035, z + look[1]), (0.058 * size, 0.03, 0.066 * size * (1 - lid * 0.6)), mat(iris, 0.2))
        sphere((x + look[0], y - 0.055, z + look[1]), (0.03 * size, 0.02, 0.034 * size), mat('#08121a', 0.15))
        sphere((x + look[0] - 0.02, y - 0.07, z + look[1] + 0.025), (0.016, 0.012, 0.016), mat('#ffffff', 0.1, emit=3), seg=12)


def brows(color, spread=0.19, z=1.25, tilt=0.0, arch=0.02, thick=0.02, raise_r=0.0, w=0.1):
    """tilt > 0 lowers the inner ends (stern); < 0 raises them (worried)."""
    for s in (-1, 1):
        r = raise_r if s == 1 else 0.0
        xi, xo = s * (spread - w), s * (spread + w)
        zi, zo = z - tilt * 0.05 + r, z + tilt * 0.05 + r
        curve([(xo, face_y(xo, zo) - 0.03, zo), (s * spread, face_y(s * spread, z + arch) - 0.035, z + arch + r),
               (xi, face_y(xi, zi) - 0.03, zi)], thick, mat(color, 0.6))


def mouth(kind, color='#7a2b2f', z=0.88, w=0.13):
    y = face_y(0, z) - 0.02
    if kind == 'smile':
        curve([(-w, y + 0.02, z + 0.035), (0, y - 0.025, z - 0.035), (w, y + 0.02, z + 0.035)], 0.017, mat(color, 0.5))
    elif kind == 'smirk':
        curve([(-w, y + 0.015, z), (0, y - 0.02, z - 0.025), (w + 0.02, y + 0.02, z + 0.06)], 0.017, mat(color, 0.5))
    elif kind == 'flat':
        curve([(-w * 0.8, y, z), (0, y - 0.02, z - 0.005), (w * 0.8, y, z)], 0.017, mat(color, 0.5))
    elif kind == 'worry':
        curve([(-w * 0.8, y + 0.015, z - 0.01), (0, y - 0.02, z + 0.012), (w * 0.8, y + 0.015, z - 0.01)], 0.016, mat(color, 0.5))
    elif kind == 'grin':
        sphere((0, y + 0.005, z - 0.005), (w * 1.05, 0.03, 0.065), mat('#5a1d24', 0.4))
        sphere((0, y - 0.025, z + 0.02), (w * 0.9, 0.012, 0.028), mat('#fffaf0', 0.3))


def halo(hex_, strength=1.6):
    """Dark field with a soft faction-colour disc behind the head."""
    plane = bpy.data.objects.new('field', bpy.data.meshes.new('field'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4.0)
    bm.to_mesh(plane.data)
    bm.free()
    plane.rotation_euler = (math.pi / 2, 0, 0)
    plane.location = (0, 1.6, 0.8)
    bpy.context.scene.collection.objects.link(plane)
    plane.data.materials.append(mat(FIELD, 1.0))
    for r, e, name in ((1.0, 0.32, 'a'), (0.7, 0.3, 'b')):
        bpy.ops.mesh.primitive_circle_add(vertices=64, radius=r, fill_type='NGON', location=(0, 1.5, 1.12),
                                          rotation=(math.pi / 2, 0, 0))
        o = bpy.context.object
        o.data.materials.append(mat(hex_, 1.0, emit=e))
        o.name = 'halo' + name
    return plane


# --------------------------------------------------------------------------- the cast
def commander(hex_):
    # A faceless dress helmet: smooth dark-teal shell, a mint visor line, the ring-and-line badge and one bright light.
    body('#17556b', '#17556b', 1.0)
    for s in (-1, 1):
        sphere((s * 0.78, -0.04, 0.45), (0.3, 0.3, 0.2), mat('#1f7487', 0.4, 0.2))
    sphere(HC, (0.5, 0.47, 0.56), mat('#12394a', 0.28, 0.35))
    sphere((0, -0.05, 1.12), (0.4, 0.4, 0.34), mat('#0a1f2a', 0.08, 0.6), seg=32).scale.y = 0.42
    curve([(-0.34, -0.39, 1.05), (0, -0.46, 1.05), (0.34, -0.39, 1.05)], 0.03, mat(hex_, 0.3, emit=2.5))
    torus((0, -0.5, 0.35), 0.2, 0.045, mat(hex_, 0.3, 0.2, emit=1.4), rot=(math.pi / 2, 0, 0))
    box((0, -0.5, 0.3), (0.05, 0.05, 0.62), mat(hex_, 0.3, 0.2, emit=1.4), bevel=0.01)
    sphere((0, -0.05, 1.72), (0.1, 0.1, 0.1), mat('#fff3c0', 0.2, emit=7), seg=24)
    sphere((0, -0.05, 1.72), (0.21, 0.21, 0.21), mat('#fff3c0', 0.2, emit=0.5), seg=24).scale.y = 0.2


def vale(hex_):
    skin = '#8a5638'
    body('#1c7a80', skin, 1.0, collar=hex_)
    # coat collar V in mint, ring pin, slate edge
    for s in (-1, 1):
        box((s * 0.2, -0.3, 0.45), (0.12, 0.42, 0.06), mat(hex_, 0.5), rot=(0.25, 0, s * 0.62), bevel=0.02)
        box((s * 0.55, -0.34, 0.12), (0.5, 0.06, 0.28), mat('#1b6870', 0.6), rot=(0, 0, s * 0.1))
    torus((0.46, -0.5, 0.25), 0.06, 0.016, mat(hex_, 0.3, 0.3, emit=0.8), rot=(math.pi / 2, 0, 0))
    box((-0.52, -0.58, -0.05), (0.52, 0.04, 0.38), mat('#2a3441', 0.3, 0.3), rot=(0.1, 0, 0.12), bevel=0.02)
    box((-0.52, -0.61, -0.05), (0.44, 0.01, 0.3), mat('#5ad0ff', 0.2, emit=1.2), rot=(0.1, 0, 0.12), bevel=0)
    head(skin)
    hair = mat('#232029', 0.4)
    h = sphere((0, 0.06, 1.17), (0.5, 0.5, 0.52), hair)
    cut(h, 1.22, tilt=0.5)
    # silver streak and tied-back bun
    curve([(-0.2, -0.38, 1.5), (-0.05, -0.43, 1.52), (0.15, -0.38, 1.46), (0.35, -0.2, 1.38)], 0.032, mat('#d7dfe3', 0.35))
    sphere((0.3, 0.3, 1.56), (0.17, 0.17, 0.17), hair)
    eyes('#4b2e1f', size=1.0, lid=0.12)
    brows('#1d1a20', z=1.27, tilt=0.15, arch=0.02, thick=0.017)
    mouth('smile', '#6b2a2d', w=0.11)
    # headset
    curve([(-0.42, 0.0, 1.3), (-0.47, -0.05, 1.12), (-0.43, -0.1, 0.98)], 0.022, mat('#1b2a33', 0.4))
    sphere((-0.47, -0.04, 1.06), (0.07, 0.09, 0.14), mat(hex_, 0.3, 0.2, emit=0.5))
    curve([(-0.45, -0.1, 0.98), (-0.4, -0.3, 0.84), (-0.2, -0.42, 0.8)], 0.014, mat('#1b2a33', 0.4))
    sphere((-0.18, -0.43, 0.8), (0.035, 0.035, 0.035), mat(hex_, 0.3, emit=2), seg=12)


def okoro(hex_):
    skin = '#b0733f'
    body('#9be3c1', skin, 1.0)
    box((0, -0.46, 0.2), (0.3, 0.06, 0.86), mat('#f6ead0', 0.7), bevel=0.02)
    for s in (-1, 1):
        box((s * 0.34, -0.4, 0.28), (0.34, 0.07, 0.8), mat('#7fd1ad', 0.55), rot=(0, 0, s * -0.08), bevel=0.02)
    curve([(0.65, -0.1, 0.55), (0.9, -0.2, 0.3), (0.86, -0.3, 0.05)], 0.05, mat('#edc76f', 0.6))
    # glowing blue crystal in the raised, gloved hand
    sphere((-0.64, -0.55, -0.02), (0.14, 0.14, 0.14), mat('#2a2f33', 0.7))
    o = sphere((-0.64, -0.6, 0.18), (0.1, 0.1, 0.2), mat('#59c8ff', 0.15, emit=4.0), seg=8)
    head(skin)
    hair = mat('#1a120d', 0.55)
    for i in range(14):
        a = math.pi * (0.08 + i / 13 * 0.84)
        sphere((math.cos(a) * 0.4, 0.02 - math.sin(a) * 0.24 + 0.17, 1.4 + math.sin(a) * 0.17), (0.12, 0.12, 0.12), hair, seg=16)
    sphere((0, 0.08, 1.5), (0.3, 0.3, 0.17), hair)
    # goggles pushed up: strap, rims, glass
    curve([(-0.45, 0.04, 1.33), (0, -0.28, 1.36), (0.45, 0.04, 1.33)], 0.035, mat('#3b2a1c', 0.7))
    for s in (-1, 1):
        torus((s * 0.17, -0.34, 1.42), 0.098, 0.028, mat('#edc76f', 0.3, 0.8), rot=(math.pi / 2 - 0.25, 0, 0))
        sphere((s * 0.17, -0.34, 1.42), (0.092, 0.01, 0.092), mat('#7fd6ee', 0.05, emit=0.6), rot=(-0.25, 0, 0), seg=24)
    eyes('#3a2415', size=1.05, z=1.08)
    brows('#1a120d', z=1.25, tilt=-0.3, arch=0.04, thick=0.019, raise_r=0.02)
    mouth('grin', w=0.13, z=0.86)


def hale(hex_):
    skin = '#ecd0b8'
    body('#2b3138', skin, 1.0)
    for s in (-1, 1):
        # high collar flaps with coral piping, falling-spark badge
        box((s * 0.26, -0.28, 0.62), (0.3, 0.3, 0.3), mat('#3a424b', 0.5), rot=(0.1, 0.2 * s, s * 0.35), bevel=0.04)
        curve([(s * 0.12, -0.46, 0.5), (s * 0.3, -0.5, 0.18), (s * 0.45, -0.46, -0.2)], 0.018, mat(hex_, 0.4, emit=0.4))
    sphere((0.5, -0.5, 0.25), (0.06, 0.02, 0.06), mat(hex_, 0.3, emit=1.6), seg=16)
    curve([(-0.5, -0.5, 0.45), (-0.35, -0.55, 0.1), (-0.15, -0.56, 0.04)], 0.012, mat('#d6aa4a', 0.25, 0.9))
    cyl((-0.15, -0.56, 0.02), 0.07, 0.03, mat('#d6aa4a', 0.25, 0.9), rot=(math.pi / 2, 0, 0))
    head(skin, jaw=1.05)
    g = mat('#aab3b6', 0.7)
    hairc = sphere((0, 0.06, 1.17), (0.5, 0.5, 0.5), g)
    cut(hairc, 1.28, tilt=0.35)
    for s in (-1, 1):
        sphere((s * 0.44, 0.0, 1.13), (0.07, 0.1, 0.2), g)
    # close grey beard with moustache
    b = sphere((0, -0.06, 0.88), (0.42, 0.4, 0.42), mat('#8d979c', 0.8))
    cut(b, 0.84, tilt=-0.9, keep_above=False)
    sphere((0, face_y(0, 0.93) - 0.05, 0.93), (0.15, 0.06, 0.04), mat('#8d979c', 0.8))
    eyes('#3d4f5f', size=0.9, z=1.1, lid=0.25)
    brows('#8d979c', z=1.22, tilt=0.55, arch=0.0, thick=0.026, w=0.11)
    mouth('flat', '#6b3a36', z=0.84, w=0.08)
    # lines
    for s in (-1, 1):
        curve([(s * 0.3, face_y(0.3, 1.12) - 0.03, 1.18), (s * 0.24, face_y(0.24, 1.0) - 0.035, 1.0)], 0.008, mat('#b79a85', 0.6))


def sol(hex_):
    skin = '#d6a06c'
    body('#d9962f', skin, 1.05)
    box((0, -0.46, 0.1), (0.2, 0.05, 0.7), mat('#f3d27a', 0.6), bevel=0.02)
    # wide scarf
    torus((0, -0.06, 0.58), 0.34, 0.14, mat('#f6c24b', 0.7), scale=(1.15, 1, 0.8))
    sphere((0.3, -0.34, 0.3), (0.2, 0.12, 0.2), mat('#f6c24b', 0.7))
    # goggles at neck, half-sun brooch
    curve([(-0.35, -0.3, 0.55), (0, -0.42, 0.4), (0.35, -0.3, 0.55)], 0.03, mat('#3a2a1a', 0.7))
    for s in (-1, 1):
        torus((s * 0.1, -0.45, 0.4), 0.075, 0.022, mat('#a4742a', 0.3, 0.8), rot=(math.pi / 2, 0, 0))
        sphere((s * 0.1, -0.45, 0.4), (0.065, 0.008, 0.065), mat('#ffd98a', 0.05, emit=0.7), seg=20)
    b = sphere((-0.5, -0.52, 0.2), (0.11, 0.03, 0.11), mat('#fff0b0', 0.2, emit=1.5))
    cut(b, 0.2, keep_above=True)
    head(skin)
    hair = mat('#15131a', 0.35)
    h = sphere((0, 0.06, 1.17), (0.5, 0.5, 0.52), hair)
    cut(h, 1.4, tilt=0.4)
    # braid over the shoulder
    for i in range(7):
        sphere((0.5 + i * 0.012, -0.12 - i * 0.02, 0.95 - i * 0.22), (0.1 - i * 0.004, 0.1, 0.13), hair, seg=16)
    eyes('#4a2f1a', size=1.0, lid=0.1)
    brows('#15131a', z=1.26, tilt=0.0, arch=0.035, thick=0.018, raise_r=0.04)
    mouth('smirk', '#8b2e33', w=0.12)
    for s in (-1, 1):
        curve([(s * 0.3, face_y(0.3, 1.1) - 0.03, 1.1), (s * 0.34, face_y(0.34, 1.06) - 0.03, 1.07)], 0.008, mat('#a8754a', 0.6))


def maren(hex_):
    skin = '#c79a74'
    body('#7a5ad0', skin, 0.95)
    # hood and drape around the head, silver thread, pendant
    hood = sphere((0, 0.22, 1.12), (0.62, 0.58, 0.64), mat('#5a3fa6', 0.65))
    cut(hood, 0.85, tilt=-0.4, keep_above=True)
    sphere((0, 0.05, 0.62), (0.7, 0.5, 0.3), mat('#5a3fa6', 0.65))
    curve([(-0.5, -0.1, 0.8), (-0.62, -0.06, 1.1), (-0.5, 0.0, 1.45), (0, -0.1, 1.7)], 0.013, mat('#d9dde6', 0.3, 0.8))
    curve([(0, -0.5, 0.55), (0, -0.55, 0.2)], 0.012, mat('#d9dde6', 0.3, 0.8))
    sphere((0, -0.56, 0.12), (0.075, 0.04, 0.075), mat('#241b3d', 0.15, 0.2))
    sphere((0, -0.6, 0.12), (0.03, 0.01, 0.03), mat('#8f7bff', 0.1, emit=3), seg=12)
    head(skin)
    hair = mat('#f2f4f5', 0.7)
    h = sphere((0, 0.06, 1.17), (0.49, 0.49, 0.5), hair)
    cut(h, 1.3, tilt=0.35)
    eyes('#6b5440', size=1.05, z=1.1)
    for s in (-1, 1):
        torus((s * 0.19, face_y(0.19, 1.1) - 0.09, 1.1), 0.115, 0.014, mat('#e3e7ee', 0.2, 0.9), rot=(math.pi / 2 - 0.04, 0, 0))
        sphere((s * 0.19, face_y(0.19, 1.1) - 0.095, 1.1), (0.11, 0.004, 0.11), mat('#cfe3ff', 0.02), seg=24)
    curve([(-0.08, face_y(0, 1.12) - 0.09, 1.12), (0, face_y(0, 1.15) - 0.1, 1.15), (0.08, face_y(0, 1.12) - 0.09, 1.12)], 0.012, mat('#e3e7ee', 0.2, 0.9))
    brows('#cfd3d8', z=1.27, tilt=-0.7, arch=0.0, thick=0.017)
    mouth('worry', '#8a4a48', z=0.86, w=0.08)
    # small dark crystal held at the chest
    sphere((0.1, -0.62, 0.05), (0.11, 0.11, 0.16), mat('#1c1730', 0.1, 0.3), seg=8)
    sphere((0.1, -0.66, 0.05), (0.04, 0.03, 0.08), mat('#8f7bff', 0.1, emit=2.2), seg=8)


def echo(hex_):
    # Twelve soft lights in a ring around a pale lens, over a dark relay stone. No face.
    cyl((0, -0.1, 0.0), 0.7, 0.4, mat('#0f1d2e', 0.7, 0.3), r2=0.35, seg=6)
    box((0, -0.38, 0.0), (0.8, 0.02, 0.05), mat(hex_, 0.3, emit=1.5), bevel=0)
    centre = Vector((0, -0.2, 1.1))
    for i in range(12):
        a = i / 12 * math.tau
        bright = i in (1, 11, 6)
        loc = centre + Vector((math.sin(a) * 0.74, 0, math.cos(a) * 0.74))
        r = 0.09 if bright else 0.06
        sphere(loc, (r, r, r), mat('#f2f9ff' if bright else hex_, 0.2, emit=7 if bright else 3), seg=20)
        if bright:
            sphere(loc, (r * 2, r * 0.4, r * 2), mat('#dff0ff', 0.2, emit=0.5), seg=16)
    torus(centre, 0.74, 0.012, mat(hex_, 0.3, emit=1.0), rot=(math.pi / 2, 0, 0))
    sphere(centre, (0.34, 0.34, 0.34), mat('#cfe4ff', 0.08, 0.1, emit=0.5))
    sphere(centre + Vector((0, -0.2, 0)), (0.22, 0.2, 0.22), mat(hex_, 0.1, emit=2.5))
    sphere(centre + Vector((-0.1, -0.35, 0.12)), (0.07, 0.04, 0.07), mat('#ffffff', 0.1, emit=6), seg=12)


CAST_BUILD = {'commander': commander, 'vale': vale, 'okoro': okoro, 'hale': hale, 'sol': sol, 'maren': maren, 'echo': echo}
HEX = {'commander': '#92ebc5', 'vale': '#92ebc5', 'okoro': '#92ebc5', 'hale': '#ef7660', 'sol': '#f3b33f',
       'maren': '#9a7df0', 'echo': '#6cc7ff'}


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)
    _mats.clear()


def light(kind, name, energy, color, rotation, size):
    d = bpy.data.lights.new(name, kind)
    d.energy, d.color = energy, color[:3]
    d.angle = math.radians(size)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = [math.radians(a) for a in rotation]
    bpy.context.scene.collection.objects.link(o)


def render(who, out):
    reset()
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'Standard'
    scene.eevee.taa_render_samples = 64
    for attr in ('use_raytracing', 'use_shadows', 'use_gtao'):
        if hasattr(scene.eevee, attr):
            setattr(scene.eevee, attr, True)
    w = bpy.data.worlds.new('w')
    scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = lin('#9fb8c8')
    bg.inputs['Strength'].default_value = 0.35
    hex_ = HEX[who]
    halo(hex_)
    CAST_BUILD[who](hex_)
    light('SUN', 'key', 3.4, lin('#ffe0b8'), (62, 0, -28), 5)
    light('SUN', 'rim', 2.6, lin('#a8d8ff'), (118, 0, 150), 8)
    light('SUN', 'fill', 1.0, lin('#bcd0ff'), (70, 0, 50), 25)
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = {'commander': 2.55, 'echo': 2.2}.get(who, 2.35)
    cam = bpy.data.objects.new('cam', cd)
    scene.collection.objects.link(cam)
    cam.location = (0.0, -6, {'commander': 0.95, 'echo': 1.05}.get(who, 0.88))
    cam.rotation_euler = (math.pi / 2 - 0.04, 0, 0)
    scene.camera = cam
    scene.render.filepath = str(out / f'{who}.png')
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ids = [a for a in args if a in CAST_BUILD]
    folders = [a for a in args if a not in CAST_BUILD]
    out = Path(folders[0]) if folders else ROOT / 'public' / 'portraits'
    out.mkdir(parents=True, exist_ok=True)
    for who in ids or CAST_BUILD:
        render(who, out)
    print('Cast portraits written to', out)


main()
