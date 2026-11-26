"""Faction part library for the faction-unique models (visual round V, 2026-11-26).

Small, cheap building blocks in each faction's design language (docs: the visual round brief), on top of
frontier_kit's Shape primitives. Every helper adds geometry to named parts of an Asset (`a.part(name, mat,
parent)`), so the runtime contract stays in the caller's hands: part names decide the rigs (Barrel*/Muzzle*/
Turret_head* aim and recoil, leg_* pivots, Knee* knee height, Wheels* / Tyres* rolling wheels).

Triangle habits (phones first): bevels only on the big plates that catch light at game zoom (seg=1), plain
boxes and 6-10 sided cylinders for small details, no hidden faces where a part can sit on another's surface.

Materials added here (non-emissive ones merge into the baked finish at runtime, so they never add a draw):
  Charcoal  Veil cloth: a deep plum charcoal (cloaks, hoods, plinths), with Steel as the silver piping.
  Lens      the Veil seer-lens green (the Stalker's and Moth's), lit; same values as generate_stalker.py.
"""
import math

import bmesh
import frontier_kit as kit
from mathutils import Euler, Matrix, Vector

R = math.pi / 2
FORWARD = (R, 0, 0)   # cylinder axis along Y (a cone's narrow end toward -Y with r2 < r)
ACROSS = (0, R, 0)    # cylinder axis along X

kit.MATERIALS.setdefault('Charcoal', ('#553f6d', 0.1, 0.55, 0.0))
kit.MATERIALS.setdefault('Lens', ('#32ff86', 0.0, 0.22, 2.6))
kit.GLOWING.add('Lens')


# ----------------------------------------------------------------------------- deterministic export
class Shape(kit.Shape):
    """frontier_kit.Shape with a reproducible bevel. The kit gathers the edges to bevel (and a cut sphere's
    rim) in a Python set, whose order follows memory addresses, so two runs of the same build could write
    a model's vertices in another order: the same model, a different file. Sorting by index makes every
    export of a faction model byte-identical. Shapes, sizes and shading are exactly the kit's."""

    def _finish(self, verts, loc, rot, bevel, seg, angle=math.radians(35)):
        bmesh.ops.transform(self.bm, matrix=kit._matrix(loc, rot), verts=verts)
        if bevel <= 0:
            return
        self.bm.edges.index_update()
        edges = sorted({e for v in verts for e in v.link_edges}, key=lambda e: e.index)
        edges = [e for e in edges if e.is_manifold and e.calc_face_angle(0) > angle]
        if not edges:
            return
        res = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=seg,
                              profile=0.5, affect='EDGES', clamp_overlap=True)
        faces = set(res['faces'])
        for f in res['faces']:
            for v in f.verts:
                if all(g in faces for g in v.link_faces):
                    v[self.wear] = 1.0

    def sphere(self, radius, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, rings=10, cut=None):
        rx, ry, rz = (radius,) * 3 if isinstance(radius, (int, float)) else radius
        verts = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)['verts']
        if cut is not None:
            dead = [v for v in verts if v.co.z < cut - 1e-4]
            bmesh.ops.delete(self.bm, geom=dead, context='VERTS')
            verts = [v for v in verts if v.is_valid]
            self.bm.edges.index_update()
            edge = sorted({e for v in verts for e in v.link_edges if e.is_boundary}, key=lambda e: e.index)
            if edge:
                bmesh.ops.holes_fill(self.bm, edges=edge)
        for v in verts:
            v.co = (v.co.x * rx, v.co.y * ry, v.co.z * rz)
        self._finish(verts, loc, rot, 0, 1)
        return self


def canonical(shape):
    """Rebuild a part's bmesh in a fixed order (vertices by position, faces by their vertices, each face starting
    at its lowest vertex), so element order no longer depends on the order Blender's bevel created them in."""
    bm, wear = shape.bm, shape.wear
    key = {v: (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5), round(v[wear], 3)) for v in bm.verts}
    order = sorted(bm.verts, key=lambda v: (key[v], tuple(sorted(key[e.other_vert(v)] for e in v.link_edges))))
    index = {v: i for i, v in enumerate(order)}
    faces = []
    for f in bm.faces:
        ids = [index[v] for v in f.verts]
        k = ids.index(min(ids))
        faces.append(tuple(ids[k:] + ids[:k]))
    faces.sort()
    new = bmesh.new()
    layer = new.verts.layers.float.new('wear')
    made = []
    for v in order:
        n = new.verts.new(v.co)
        n[layer] = v[wear]
        made.append(n)
    for ids in faces:
        new.faces.new([made[i] for i in ids])
    bm.free()
    shape.bm, shape.wear = new, layer


class FactionAsset(kit.Asset):
    """frontier_kit.Asset whose parts are the reproducible Shape above, put in a fixed element order before the
    kit finishes them (bake, normals, export)."""

    def part(self, name, mat, parent=None, flat=False):
        key = (name, mat, parent)
        if key not in self.shapes:
            self.shapes[key] = Shape()
            self.shapes[key].flat = flat
            self.order.append(key)
        return self.shapes[key]

    def finish(self):
        for key in self.order:
            canonical(self.shapes[key])
        return super().finish()


# ----------------------------------------------------------------------------- primitives
def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.03, seg=1, parent=None, taper=(1, 1), shift=(0, 0)):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=seg, taper=taper, shift=shift)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12, r2=None, bevel=.012, parent=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, r2=r2, bevel=bevel, bseg=1)


def limb(a, name, mat, start, end, w, d=None, bevel=.02, parent=None, taper=(1, 1), seg=1):
    return a.part(name, mat, parent).limb(start, end, w, d if d is not None else w, bevel=bevel, seg=seg, taper=taper)


def prism(a, name, mat, profile, depth, loc=(0, 0, 0), rot=(0, 0, 0), axis='X', bevel=.02, parent=None, taper=1.0, seg=1):
    return a.part(name, mat, parent).prism(profile, depth, loc=loc, rot=rot, axis=axis, bevel=bevel, seg=seg, taper=taper)


def sphere(a, name, mat, radius, loc, rot=(0, 0, 0), seg=12, rings=8, cut=None, parent=None):
    return a.part(name, mat, parent).sphere(radius, loc=loc, rot=rot, seg=seg, rings=rings, cut=cut)


def torus(a, name, mat, R_, r, loc, rot=(0, 0, 0), seg=20, ring=5, parent=None):
    return a.part(name, mat, parent).torus(R_, r, loc=loc, rot=rot, seg=seg, ring=ring)


def frame(loc, rot):
    return Matrix.Translation(Vector(loc)) @ Euler(rot, 'XYZ').to_matrix().to_4x4()


def at(m, p):
    """A point p (local to frame m) in model space, as a tuple."""
    return tuple(m @ Vector(p))


class Body:
    """An upper body built in its own frame: leaning forward by `lean` radians about `waist` (model space).
    p() maps a local point to model space, rot() a local rotation (so plates keep their pose on the lean)."""

    def __init__(self, waist, lean=0.0, turn=0.0):
        self.m = frame(waist, (lean, 0, turn))
        self.r = self.m.to_3x3()

    def p(self, p):
        return at(self.m, p)

    def rot(self, r=(0, 0, 0)):
        return tuple((self.r @ Euler(r, 'XYZ').to_matrix()).to_euler('XYZ'))


# ----------------------------------------------------------------------------- shared details
def rivets(a, name, mat, points, r=.03, h=.03, rot=FORWARD, seg=6, parent=None):
    """Weld rivets / bolt heads; each a plain 6-sided stud (24 triangles)."""
    shape = a.part(name, mat, parent)
    for p in points:
        shape.cyl(r, h, loc=p, rot=rot, seg=seg, bevel=0)
    return shape


def stripes(a, name, size, loc, rot=(0, 0, 0), n=5, slant=.5, mat='Undercarriage', parent=None):
    """Hazard stripes: n slanted dark bars laid on the -Y face of a yellow plate of `size` (x, y=thickness, z)
    placed at loc / rot (the caller draws the plate). The bars are parallelograms kept inside the plate."""
    w, t, h = size
    sh = min(h * math.tan(slant), w * .5)
    period = (w - sh) / (n - .5)
    bw = period / 2
    shape = a.part(name, mat, parent)
    m = frame(loc, rot)
    centre = at(m, (0, -t / 2 - .007, 0))
    for i in range(n):
        xb = -w / 2 + i * period
        shape.prism([(xb, -h / 2), (xb + bw, -h / 2), (xb + bw + sh, h / 2), (xb + sh, h / 2)], .014, loc=centre, rot=rot, axis='Y', bevel=0, seg=1)
    return shape


def spike(a, name, mat, base, tip, r=.06, seg=6, parent=None):
    """A cone from base to tip (Ashfall spikes, Veil crystal points)."""
    base, tip = Vector(base), Vector(tip)
    v = tip - base
    rot = Vector((0, 0, 1)).rotation_difference(v.normalized()).to_euler('XYZ')
    return a.part(name, mat, parent).cyl(r, v.length, loc=tuple((base + tip) / 2), rot=tuple(rot), seg=seg, r2=.004, bevel=0)


def stack(a, name, mat, rim_mat, x, y, z0, height, r=.11, seg=10, cap=True, parent=None):
    """An exhaust stack: a pipe with a flared steel rim (and a dark bore cap)."""
    cyl(a, name, mat, r, height, (x, y, z0 + height / 2), seg=seg, bevel=0, parent=parent)
    cyl(a, name + '_rims', rim_mat, r * 1.35, .1, (x, y, z0 + height - .02), seg=seg, bevel=0, parent=parent)
    if cap:
        cyl(a, name + '_rims', 'Undercarriage', r * .95, .02, (x, y, z0 + height + .035), seg=seg, bevel=0, parent=parent)


def crystal(a, name, mat, base, tip, r=.09, sides=5, twist=0.0, parent=None):
    """An angular crystal shard: a faceted bipyramid from base to tip (widest a third of the way up)."""
    base, tip = Vector(base), Vector(tip)
    v = tip - base
    q = Vector((0, 0, 1)).rotation_difference(v.normalized())
    shape = a.part(name, mat, parent)
    bm = shape.bm
    ring = []
    for k in range(sides):
        ang = twist + k * math.tau / sides
        p = Vector((math.cos(ang) * r, math.sin(ang) * r, v.length * .32))
        ring.append(bm.verts.new(base + q @ p))
    top = bm.verts.new(tip)
    bottom = bm.verts.new(base + q @ Vector((0, 0, -v.length * .06)))
    faces = []
    for k in range(sides):
        j = (k + 1) % sides
        faces.append(bm.faces.new((ring[k], ring[j], top)))
        faces.append(bm.faces.new((ring[j], ring[k], bottom)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    shape.flat = True
    return shape


def pennant(a, name, mat, x, y, z, length=.55, height=.3, depth=.025, toward=1, parent=None):
    """A swallow-tail pennant hanging from a pole top at (x, y, z), streaming back (+Y) by default."""
    s = toward
    pts = [(y, z), (y + s * length, z - height * .15), (y + s * length * .72, z - height * .5), (y + s * length, z - height * .85), (y, z - height)]
    if s < 0:
        pts = pts[::-1]
    return prism(a, name, mat, pts, depth, loc=(x, 0, 0), axis='X', bevel=0, parent=parent)


def wheel(a, x, y, z, r, width, mats=('Undercarriage', 'Steel', 'Hazard'), spokes=6, names=('Wheels', 'Wheel_spokes', 'Wheel_hubs'),
          seg=16, tyre=.11, tyre_ring=6, rim_seg=12, parent=None):
    """An open spoked wheel on an axle along X (the ground shows through it): a round tyre (named for the
    rolling rig: Wheels* on a hull, Tyres* on the Rider), a thin rim, spokes and a brass hub, all on one axle.
    `tyre` is the tyre's thickness; the wheel is `width` wide at the tyre."""
    tyre_mat, spoke, hub = mats
    n_tyre, n_spokes, n_hub = names
    shape = a.part(n_tyre, tyre_mat, parent)
    n0 = len(shape.bm.verts)
    shape.torus(r - tyre / 2, tyre / 2, loc=(x, y, z), rot=ACROSS, seg=seg, ring=tyre_ring)
    if width > tyre * 1.05:  # a fat tyre: stretch the tube across the axle
        for v in list(shape.bm.verts)[n0:]:
            v.co.x = x + (v.co.x - x) * width / tyre
    inner = r - tyre
    torus(a, n_spokes, spoke, inner - .015, .022, (x, y, z), rot=ACROSS, seg=rim_seg, ring=3, parent=parent)
    for k in range(spokes // 2):
        ang = k * math.pi / (spokes // 2)
        a.part(n_spokes, spoke, parent).box((.035, .04, inner * 2), loc=(x, y, z), rot=(ang, 0, 0), bevel=0)
    cyl(a, n_hub, hub, max(.06, r * .22), width + .06, (x, y, z), rot=ACROSS, seg=8, bevel=0, parent=parent)


def track(a, x, y, z, length, height, width, wheels=4, wheel_r=None, names=('Tracks', 'Wheels'), mats=('Undercarriage', 'Steel'),
          cleats=3, parent=None):
    """A lean track unit on the X side at (x, y, z) (centre): a stadium belt (one prism, no bevel), a few
    cleats on the exposed curves and steel road wheels on the outer face. Tracks* stay still; Wheels* roll."""
    belt, steel = mats
    n_belt, n_wheels = names
    rr = height / 2
    pts = []
    for k in range(7):  # front curve (toward -Y)
        ang = math.pi / 2 + k * math.pi / 6
        pts.append((-length / 2 + rr + math.cos(ang) * rr, math.sin(ang) * rr))
    for k in range(7):  # back curve
        ang = -math.pi / 2 + k * math.pi / 6
        pts.append((length / 2 - rr + math.cos(ang) * rr, math.sin(ang) * rr))
    prism(a, n_belt, belt, pts, width, loc=(x, y, z), axis='X', bevel=0, parent=parent)
    # Cleats: short bars on the front and rear curves (the top run sits under the fenders).
    for end in (-1, 1):
        for k in range(cleats):
            # Front curve (toward -Y) spans 90..270 degrees in the (y, z) plane, the back one -90..90.
            ang = (R if end < 0 else -R) + (k + 1) * math.pi / (cleats + 1)
            cy = y + end * (length / 2 - rr) + math.cos(ang) * (rr + .01)
            cz = z + math.sin(ang) * (rr + .01)
            a.part(n_belt, belt, parent).box((width + .04, .07, .05), loc=(x, cy, cz), rot=(ang - R, 0, 0), bevel=0)
    wr = wheel_r or rr * .62
    side = 1 if x >= 0 else -1
    for i in range(wheels):
        wy = y - length / 2 + rr + i * (length - 2 * rr) / max(1, wheels - 1)
        cyl(a, n_wheels, steel, wr, .08, (x + side * (width / 2 + .03), wy, z - rr * .25), rot=ACROSS, seg=10, bevel=0, parent=parent)
        # Hubs are Wheel_hubs (rolling with their wheel), not Wheels*: the view measures the road-wheel radius on
        # the last mesh named Wheels*, so a hub there would spin the wheels at the hub's radius.
        cyl(a, 'Wheel_hubs', belt, wr * .42, .1, (x + side * (width / 2 + .05), wy, z - rr * .25), rot=ACROSS, seg=6, bevel=0, parent=parent)


def lens_eye(a, loc, r, glow='TeamGlow', rim='Steel', names=('Eye_rim', 'Single_eye'), depth=.12, seg=18, facing=FORWARD, parent=None,
             iris=True):
    """A big single lens eye facing -Y: a deep steel bezel, the glowing lens and a dark iris ring."""
    x, y, z = loc
    cyl(a, names[0], rim, r * 1.32, depth, (x, y, z), rot=facing, seg=seg, bevel=.015, parent=parent)
    cyl(a, names[1], glow, r, depth * .6, (x, y - depth * .42, z), rot=facing, seg=seg, bevel=0, parent=parent)
    if iris:
        torus(a, names[0], rim, r * .55, r * .09, (x, y - depth * .74, z), rot=facing, seg=12, ring=3, parent=parent)


def leg(a, side, hip, length, mats, wide=1.0, knee_mat='Steel', boot_len=.46, parent_name='leg_', toe=None, seg=1):
    """A shared-kit style leg hanging from a `leg_L` / `leg_R` pivot at `hip` (the shader-bones contract:
    every leg part hangs from the pivot, a Knee* mesh marks the bend). mats = (thigh, shin, boot).
    Returns the pivot name."""
    thigh, shin, boot = mats
    p = a.pivot(parent_name + side, hip)
    h = length
    box(a, 'Thigh', thigh, (.24 * wide, .27, h * .46), (0, .01, -h * .25), bevel=.05, seg=seg, parent=p, taper=(1.12, 1.05))
    cyl(a, 'Knee', knee_mat, .1 * wide + .02, .26 * wide, (0, -.02, -h * .52), rot=ACROSS, seg=8, bevel=0, parent=p)
    box(a, 'Shin', shin, (.27 * wide, .31, h * .36), (0, -.03, -h * .71), bevel=.055, seg=seg, parent=p, taper=(1.1, 1.08))
    box(a, 'Boot', boot, (.3 * wide, boot_len, .16), (0, -.08, -h + .08), bevel=.045, seg=seg, parent=p, taper=(.92, .86), shift=(0, .02))
    if toe:
        box(a, 'Boot_caps', toe, (.26 * wide, .14, .1), (0, -.08 - boot_len * .4, -h + .07), bevel=.02, parent=p)
    return p
