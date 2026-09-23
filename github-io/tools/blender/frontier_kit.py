"""Frontier Command hard-surface asset kit for Blender 4.5 (bmesh only).

The same code runs headless (`blender --background --python generate_assets.py`) and live
inside an interactive Blender driven through MCP for Blender. It never switches the window
scene, saves the open file, or touches objects outside the collections it creates.

Look development shared by every model:
  * Hard-surface parts with two-segment bevels and weighted normals, so edges catch light
    even at RTS camera distance while flat plates stay flat.
  * COLOR_0 carries grey lighting detail: ray-traced ambient occlusion against the whole
    asset and a ground plane, bright worn bevel edges, ground grime and soft mottling. It is
    grey on purpose: the runtime recolours materials named Team* and the vertex colour
    multiplies that team colour cleanly.
  * Materials only describe the surface (painted armour, bare steel, rubber, glass, lights).
    Every mesh has the same attributes (normal, UV, colour), so three.js can merge parts by
    material without dropping any of them.
Runtime contract (src/view.js): Blender -Y is the model's front, `leg_*` empties stay
articulated, and meshes named Main_cannon/Muzzle_brake/Barrel*/Cannon*/Muzzle*/Turret_head*
form the aim and recoil rig.
"""
import contextlib
import io
import math
import re

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

TAU = math.tau
SHARP = math.radians(50)
BASE_TONE = 0.8
# Must match the aim/recoil rig pattern in src/view.js.
RIG = re.compile(r'^(main_cannon|muzzle_brake|barrel|cannon|muzzle|turret_head)(?![a-z])', re.I)


def lin(value):
    """sRGB hex -> linear RGB tuple."""
    h = value.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0 or 1e-9)))
    return t * t * (3 - 2 * t)


# name: (sRGB base colour, metallic, roughness, emission strength)
# Base colours are authored ~1/BASE_TONE brighter because COLOR_0 multiplies them.
MATERIALS = {
    'Team': ('#c9d6cf', 0.25, 0.42, 0.0),        # recoloured per faction at runtime
    'TeamGlow': ('#b8ffe4', 0.0, 0.3, 3.0),      # emissive recoloured per faction
    'Armor': ('#59605f', 0.55, 0.46, 0.0),       # painted gunmetal plates
    'Steel': ('#c4c8c4', 0.95, 0.28, 0.0),       # machined bare metal
    'Undercarriage': ('#23282a', 0.35, 0.72, 0.0),
    'Suit': ('#343a3a', 0.0, 0.82, 0.0),         # padded fabric under infantry armour
    'Glass': ('#12303a', 0.2, 0.06, 0.35),
    'Alloy': ('#ff9b36', 0.1, 0.35, 2.4),        # amber cargo / hazard lights
    'Energy': ('#62c4ff', 0.05, 0.22, 2.8),
    'Lamp': ('#ffe7b8', 0.0, 0.3, 3.2),          # floodlights and windows
    'Concrete': ('#8d8a7e', 0.0, 0.9, 0.0),
    'Hazard': ('#e2b64a', 0.15, 0.5, 0.0),
    'Medical': ('#e9ece6', 0.1, 0.4, 0.0),
    # Scenery. Obstacle boulders are recoloured per map at runtime; the neutral grey here is
    # what crystal-deposit beds keep.
    'Rock': ('#a29d92', 0.0, 0.92, 0.0),
    'Bark': ('#6e5a44', 0.0, 0.9, 0.0),
    'Foliage': ('#56733f', 0.0, 0.85, 0.0),
    'FoliageLight': ('#86995a', 0.0, 0.8, 0.0),
    'Crate': ('#737a5c', 0.2, 0.6, 0.0),
    # Resources must read instantly: saturated bodies with a low glow (strong emission
    # tone-maps to white under ACES and loses the amber/cyan identity).
    'CrystalAlloy': ('#f28a1c', 0.1, 0.24, 0.3),
    'CrystalEnergy': ('#2fb0f0', 0.1, 0.2, 0.42),
}
GLOWING = {'TeamGlow', 'Alloy', 'Energy', 'Lamp', 'CrystalAlloy', 'CrystalEnergy'}


def material(name):
    """Get or create a kit material. Existing user materials with the same name are ignored;
    kit materials are reconfigured on every call so live tuning takes effect."""
    m = next((m for m in bpy.data.materials if m.get('frontier_kit') == name), None)
    if m is None:
        m = bpy.data.materials.new(name)
        m['frontier_kit'] = name
    color, metallic, roughness, emission = MATERIALS[name]
    m.use_backface_culling = True  # exported as single-sided
    m.use_nodes = True
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL')]:
        nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    rgba = (*lin(color), 1.0)
    m.diffuse_color = rgba
    # COLOR_0 x base colour: the glTF exporter writes COLOR_0 plus baseColorFactor.
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    a = next(s for s in mix.inputs if s.identifier == 'A_Color')
    b = next(s for s in mix.inputs if s.identifier == 'B_Color')
    out = next(s for s in mix.outputs if s.identifier == 'Result_Color')
    b.default_value = rgba
    nt.links.new(attr.outputs['Color'], a)
    nt.links.new(out, bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


# ----------------------------------------------------------------------------- geometry
def _matrix(loc, rot):
    return Matrix.Translation(Vector(loc)) @ Euler(rot, 'XYZ').to_matrix().to_4x4()


class Shape:
    """Accumulates bevelled primitives into one bmesh (one exported mesh per material)."""

    def __init__(self):
        self.bm = bmesh.new()
        self.wear = self.bm.verts.layers.float.new('wear')

    # -- internal helpers
    def _finish(self, verts, loc, rot, bevel, seg, angle=math.radians(35)):
        bmesh.ops.transform(self.bm, matrix=_matrix(loc, rot), verts=verts)
        if bevel <= 0:
            return
        edges = {e for v in verts for e in v.link_edges}
        edges = [e for e in edges if e.is_manifold and e.calc_face_angle(0) > angle]
        if not edges:
            return
        res = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=seg,
                              profile=0.5, affect='EDGES', clamp_overlap=True)
        faces = set(res['faces'])
        for f in faces:
            for v in f.verts:
                if all(g in faces for g in v.link_faces):
                    v[self.wear] = 1.0

    def _faces(self, rings, cap_start=True, cap_end=True, closed=True):
        bm, faces = self.bm, []
        n = len(rings[0])
        for a, b in zip(rings, rings[1:]):
            for i in range(n if closed else n - 1):
                j = (i + 1) % n
                faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
        if cap_start:
            faces.append(bm.faces.new(list(reversed(rings[0]))))
        if cap_end:
            faces.append(bm.faces.new(rings[-1]))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return faces

    # -- primitives (all return self for chaining)
    def box(self, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.04, seg=2, taper=(1, 1), shift=(0, 0)):
        """Box centred at loc. taper/shift scale and offset the top face (sloped armour)."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)['verts']
        sx, sy, sz = size
        for v in verts:
            x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
            if v.co.z > 0:
                x, y = x * taper[0] + shift[0], y * taper[1] + shift[1]
            v.co = (x, y, z)
        self._finish(verts, loc, rot, min(bevel, min(size) * 0.45), seg)
        return self

    def limb(self, a, b, w, d, bevel=0.05, seg=2, taper=(1, 1)):
        """Box spanning joint a -> joint b (arms, struts); taper narrows the b end."""
        a, b = Vector(a), Vector(b)
        v = b - a
        rot = Vector((0, 0, 1)).rotation_difference(v.normalized()).to_euler('XYZ')
        return self.box((w, d, v.length), loc=(a + b) / 2, rot=rot, bevel=bevel, seg=seg, taper=taper)

    def cyl(self, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, r2=None, bevel=0.02, bseg=2):
        """Cylinder or frustum along local Z."""
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                                      radius2=r if r2 is None else r2, depth=depth)['verts']
        self._finish(verts, loc, rot, min(bevel, r * 0.4, depth * 0.4), bseg, angle=math.radians(60))
        return self

    def prism(self, profile, depth, loc=(0, 0, 0), rot=(0, 0, 0), axis='X', bevel=0.04, seg=2, taper=1.0):
        """Extrude a 2D outline. axis X: profile is (y, z); Y: (x, z); Z: (x, y).
        taper scales the positive end of the extrusion (sloped walls on axis Z)."""
        rings = []
        for side in (-depth / 2, depth / 2):
            ring = []
            k = taper if side > 0 else 1.0
            for a, b in profile:
                a, b = a * k, b * k
                co = {'X': (side, a, b), 'Y': (a, side, b), 'Z': (a, b, side)}[axis]
                ring.append(self.bm.verts.new(co))
            rings.append(ring)
        self._faces(rings)
        self._finish(rings[0] + rings[1], loc, rot, bevel, seg)
        return self

    def lathe(self, profile, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, bevel=0.0):
        """Revolve [(radius, z)...] around local Z, bottom to top. Zero radius ends are capped."""
        rings = []
        for r, z in profile:
            rings.append([self.bm.verts.new((max(r, 1e-4) * math.cos(a), max(r, 1e-4) * math.sin(a), z))
                          for a in (k * TAU / seg for k in range(seg))])
        self._faces(rings)
        bmesh.ops.remove_doubles(self.bm, verts=[v for ring in rings for v in ring], dist=2e-4)
        verts = [v for ring in rings for v in ring if v.is_valid]
        self._finish(verts, loc, rot, bevel, 2)
        return self

    def sphere(self, radius, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, rings=10, cut=None):
        """UV sphere; radius may be (rx, ry, rz). cut=z keeps only the part above local z."""
        rx, ry, rz = (radius,) * 3 if isinstance(radius, (int, float)) else radius
        verts = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)['verts']
        if cut is not None:
            dead = [v for v in verts if v.co.z < cut - 1e-4]
            bmesh.ops.delete(self.bm, geom=dead, context='VERTS')
            verts = [v for v in verts if v.is_valid]
            edge = [e for v in verts for e in v.link_edges if e.is_boundary]
            if edge:
                bmesh.ops.holes_fill(self.bm, edges=list(set(edge)))
        for v in verts:
            v.co = (v.co.x * rx, v.co.y * ry, v.co.z * rz)
        self._finish(verts, loc, rot, 0, 1)
        return self

    def ico(self, radius, loc=(0, 0, 0), rot=(0, 0, 0), sub=1, jitter=0.0, seed=0.0):
        """Noise-displaced icosphere for rocks, boulders and foliage clumps."""
        rx, ry, rz = (radius,) * 3 if isinstance(radius, (int, float)) else radius
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0)['verts']
        off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
        for v in verts:
            n = v.co.normalized()
            k = 1 + jitter * noise.noise(n * 1.9 + off)
            v.co = (n.x * rx * k, n.y * ry * k, n.z * rz * k)
        self._finish(verts, loc, rot, 0, 1)
        return self

    def tier(self, r, depth, loc=(0, 0, 0), seg=9, droop=0.12, jitter=0.12, seed=0.0):
        """Conifer foliage tier: a cone whose ragged rim droops below its base."""
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=True, segments=seg, radius1=r, radius2=0,
                                      depth=depth)['verts']
        for v in verts:
            if v.co.z < 0 and v.co.xy.length > 1e-4:
                a = math.atan2(v.co.y, v.co.x)
                k = 1 + jitter * math.sin(a * 3 + seed * 5.3) + jitter * .5 * math.sin(a * 7 + seed)
                v.co = (v.co.x * k, v.co.y * k, v.co.z - droop * (0.6 + 0.4 * math.sin(a * 5 + seed)))
        self._finish(verts, loc, (0, 0, seed), 0, 1)
        return self

    def torus(self, R, r, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, ring=8):
        rings = []
        for i in range(seg):
            a = i * TAU / seg
            rings.append([self.bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a),
                                              r * math.sin(b))) for b in (j * TAU / ring for j in range(ring))])
        rings.append(rings[0])
        faces = []
        for a, b in zip(rings, rings[1:]):
            for j in range(ring):
                k = (j + 1) % ring
                faces.append(self.bm.faces.new((a[j], b[j], b[k], a[k])))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._finish([v for ring_ in rings[:-1] for v in ring_], loc, rot, 0, 1)
        return self

    def tube(self, points, radius, seg=8, caps=True):
        """Pipe through a polyline with mitred joints (hoses, cables, handrails)."""
        pts = [Vector(p) for p in points]
        tangents = []
        for i in range(len(pts)):
            a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
            tangents.append((b - a).normalized())
        up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
        normal = tangents[0].cross(up).normalized()
        rings = []
        for i, (p, t) in enumerate(zip(pts, tangents)):
            if i:
                axis = tangents[i - 1].cross(t)
                if axis.length > 1e-6:
                    normal = Matrix.Rotation(tangents[i - 1].angle(t), 3, axis.normalized()) @ normal
            binormal = t.cross(normal).normalized()
            # Mitre: widen the ring at bends so the pipe keeps its thickness.
            k = 1.0
            if 0 < i < len(pts) - 1:
                d = (pts[i] - pts[i - 1]).normalized().dot((pts[i + 1] - pts[i]).normalized())
                k = 1 / max(0.5, math.cos(math.acos(max(-1, min(1, d))) / 2))
            rings.append([self.bm.verts.new(p + (normal * math.cos(a) * k + binormal * math.sin(a)) * radius)
                          for a in (j * TAU / seg for j in range(seg))])
        self._faces(rings, caps, caps)
        return self

    def grille(self, width, height, loc, rot=(0, 0, 0), slats=5, depth=0.06, thickness=0.05):
        """Vent louvres in the local XZ plane facing -Y."""
        frame = _matrix(loc, rot)
        for i in range(slats):
            z = -height / 2 + (i + 0.5) * height / slats
            m = frame @ _matrix((0, 0, z), (math.radians(-25), 0, 0))
            self.box((width, depth, thickness), loc=m.to_translation(), rot=m.to_euler('XYZ'), bevel=0.008, seg=1)
        return self

    def bolts(self, points, r=0.035, h=0.03, rot=(0, 0, 0), seg=6):
        for p in points:
            self.cyl(r, h, loc=p, rot=rot, seg=seg, bevel=0.008, bseg=1)
        return self


def mirror_x(points):
    return [(-x, y, z) for x, y, z in points] + list(points)


def chamfered(w, d, c):
    """Rectangle outline (x, y) with 45-degree chamfered corners, centred at the origin."""
    x, y = w / 2, d / 2
    return [(-x + c, -y), (x - c, -y), (x, -y + c), (x, y - c), (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c)]


def arc(cx, cy, r, a0, a1, steps):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / steps), cy + r * math.sin(a0 + (a1 - a0) * i / steps))
            for i in range(steps + 1)]


# ----------------------------------------------------------------------------- assets
def _hemisphere(n):
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        a = i * golden
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u)))))
    return dirs


class Asset:
    """Named parts (one Shape per part/material/parent) that finish into exportable objects."""

    def __init__(self, name, parent_collection, ao_distance=0.9, ao_strength=0.9, grime_height=0.5, ao_samples=40,
                 lattice=0.0):
        self.name = name
        self.collection = bpy.data.collections.new(f'frontier_{name}')
        parent_collection.children.link(self.collection)
        self.shapes = {}
        self.order = []
        self.pivots = {}
        self.objects = []
        self.ao_distance = ao_distance
        self.ao_strength = ao_strength
        self.grime_height = grime_height
        self.ao_samples = ao_samples
        self.lattice = lattice

    def pivot(self, name, loc):
        o = bpy.data.objects.new(name, None)
        o.empty_display_size = 0.2
        o.location = loc
        self.collection.objects.link(o)
        self.pivots[name] = o
        return name

    def part(self, name, mat, parent=None, flat=False):
        """flat=True shades every face flat (faceted rocks and crystals)."""
        key = (name, mat, parent)
        if key not in self.shapes:
            self.shapes[key] = Shape()
            self.shapes[key].flat = flat
            self.order.append(key)
        return self.shapes[key]

    def _world(self, parent):
        return Matrix.Translation(self.pivots[parent].location) if parent else Matrix.Identity(4)

    def finish(self):
        meshes = []
        for key in self.order:
            name, mat, parent = key
            bm = self.shapes[key].bm
            flat = getattr(self.shapes[key], 'flat', False)
            if self.lattice:
                lattice_slice(bm, self._world(parent), self.lattice)
            for f in bm.faces:
                f.smooth = True
            for e in bm.edges:
                if flat or not e.is_manifold or e.calc_face_angle(math.pi) > SHARP:
                    e.smooth = False
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(material(mat))
            ob = bpy.data.objects.new(name, me)
            self.collection.objects.link(ob)
            if parent:
                ob.parent = self.pivots[parent]
            meshes.append((ob, self._world(parent), mat))
        self._shade(meshes)
        for ob, _, _ in meshes:
            box_uv(ob.data)
            mod = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
            mod.mode = 'FACE_AREA'
            mod.weight = 50
            mod.keep_sharp = True
            self.objects.append(ob)
        return self

    def _shade(self, meshes):
        def bvh(parts):
            verts, polys = [], []
            for ob, mw, _ in parts:
                base = len(verts)
                verts += [mw @ v.co for v in ob.data.vertices]
                polys += [tuple(base + i for i in p.vertices) for p in ob.data.polygons]
            return BVHTree.FromPolygons(verts, polys, epsilon=0.0)
        # Aim/recoil rig parts move at runtime, so they must not bake shadows onto the body.
        full = bvh(meshes)
        static = bvh([m for m in meshes if not RIG.match(m[0].name)])
        dirs = _hemisphere(self.ao_samples)
        dist = self.ao_distance
        for ob, mw, mat in meshes:
            tree = full if RIG.match(ob.name) else static
            me = ob.data
            normals = [Vector(n.vector) for n in me.vertex_normals]
            wear = me.attributes.get('wear')
            wear = [d.value for d in wear.data] if wear else [0.0] * len(me.vertices)
            rot3 = mw.to_3x3()
            glow = mat in GLOWING
            colors = []
            for v, n, w in zip(me.vertices, normals, wear):
                p = mw @ v.co
                n = (rot3 @ n).normalized() if n.length > 1e-6 else Vector((0, 0, 1))
                if glow:
                    colors += [1.0, 1.0, 1.0, 1.0]
                    continue
                basis = n.to_track_quat('Z', 'Y').to_matrix()
                origin = p + n * (dist * 0.015 + 2e-3)
                hit = 0.0
                for d in dirs:
                    ray = basis @ d
                    loc, hit_normal, _, t = tree.ray_cast(origin, ray, dist)
                    # A back-face hit means this vertex is buried inside another part (a strut
                    # through a plate). It is hidden, but its colour still interpolates across
                    # visible faces, so buried samples must not darken it.
                    if loc is not None and hit_normal.dot(ray) > 0:
                        loc = None
                    if loc is None and ray.z < -1e-4 and origin.z >= -1e-3:
                        t = -origin.z / ray.z
                        loc = t < dist or None
                    if loc is not None:
                        hit += 1 - (t / dist) ** 2 * 0.5
                ao = 1 - hit / len(dirs)
                k = 1 - self.ao_strength * (1 - ao)
                edge = 1 + 0.24 * w
                grime = 0.8 + 0.2 * smoothstep(0.0, self.grime_height, p.z)
                mott = 1 + 0.035 * noise.noise(p * 1.3) + 0.02 * noise.noise(p * 5.1)
                g = max(0.0, min(1.0, BASE_TONE * k * edge * grime * mott))
                dust = 1 - 0.05 * (1 - smoothstep(0.0, self.grime_height, p.z))
                colors += [g, g * (0.995 * dust + 0.005), g * (0.985 * dust), 1.0]
            attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
            attr.data.foreach_set('color', colors)
            me.color_attributes.active_color = attr
            me.color_attributes.render_color_index = me.color_attributes.active_color_index
            if 'wear' in me.attributes:
                me.attributes.remove(me.attributes['wear'])

    def triangles(self):
        # Weighted normals never change topology, so the base meshes give the exported count.
        return sum(len(p.vertices) - 2 for ob in self.objects for p in ob.data.polygons)

    def export(self, path):
        export_collection(self.collection, path)

    def offset(self, dx, dy):
        """Move the asset for a showcase layout (after exporting at the origin)."""
        for o in self.collection.objects:
            if o.parent is None:
                o.location.x += dx
                o.location.y += dy


def export_collection(collection, path):
    """Export only one collection (nested ones included) to GLB. A live session's context
    scene is the user's, so the collection is linked into it only for the duration of the call."""
    scene = bpy.context.scene
    linked = collection.name not in {c.name for c in scene.collection.children_recursive}
    if linked:
        scene.collection.children.link(collection)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', collection=collection.name,
                                      export_apply=True, export_yup=True, export_animations=False,
                                      export_extras=False)
    finally:
        if linked:
            scene.collection.children.unlink(collection)


def lattice_slice(bm, world, step):
    """Cut every face by world-aligned planes `step` apart. Vertex colours are the only
    carrier of AO, so large plates need interior vertices or the shading streaks across
    them. Small parts are rarely crossed and stay cheap. Float layers (wear) interpolate."""
    if not bm.verts:
        return
    inv = world.inverted()
    pts = [world @ v.co for v in bm.verts]
    for axis in range(3):
        lo, hi = min(p[axis] for p in pts), max(p[axis] for p in pts)
        c = math.floor(lo / step) * step + step
        while c < hi - 1e-3:
            co, no = Vector((0, 0, 0)), Vector((0, 0, 0))
            co[axis], no[axis] = c, 1.0
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-4,
                                   plane_co=inv @ co, plane_no=(inv.to_3x3() @ no).normalized())
            c += step


def box_uv(mesh, scale=0.5):
    """World-unit box projection so tiling detail textures keep a constant texel density."""
    uv = mesh.uv_layers.new(name='UVMap')
    co = [v.co for v in mesh.vertices]
    data = uv.data
    for poly in mesh.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            p = co[mesh.loops[li].vertex_index]
            if ax == 0:
                data[li].uv = (p.y * scale * (1 if n.x > 0 else -1), p.z * scale)
            elif ax == 1:
                data[li].uv = (p.x * scale * (-1 if n.y > 0 else 1), p.z * scale)
            else:
                data[li].uv = (p.x * scale, p.y * scale * (1 if n.z > 0 else -1))


def workspace(name='Frontier'):
    """Collection that holds generated assets. Live sessions get a separate, undisplayed scene."""
    if bpy.app.background:
        return bpy.context.scene.collection
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    return scene.collection


def clear_workspace(root, keep=()):
    """Delete generated collections (recursively) under root, except names listed in keep."""
    def remove(coll):
        for child in list(coll.children):
            remove(child)
        for o in list(coll.objects):
            data = o.data
            bpy.data.objects.remove(o)
            if data is not None and data.users == 0:
                bpy.data.meshes.remove(data)
        bpy.data.collections.remove(coll)
    for coll in list(root.children):
        if coll.name.startswith('frontier_') and coll.name not in keep:
            remove(coll)
