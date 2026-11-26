"""Faction dress for the shared kit (visual round V, 2026-11-26). Headless Blender 4.5; no external assets.

  blender -b --factory-startup --python tools/blender/generate_dress.py -- [factions...] [--manifest] [--report]

Writes public/models/dress-<faction>.glb for Ashfall, Sunward, Wardens and Veil: each faction's extra parts for the
fourteen shared models (six infantry, Breaker, Tank, Kite and the five base buildings), following the faction design
language (docs/aaa/ROADMAP_TO_AAA_2026-11-25.md, W5): Ashfall welded scrap, gas masks, exhaust stacks, spikes and
hazard stripes; Sunward canvas hats, canopies, brass domes, pennants, sun wheels and turquoise; Wardens white ceramic
shells, single lens eyes, floating halos, insect legs and glow seams; Veil hoods, long cloaks, crystal shards, thin
spires, folded fins and silver piping. The base models are untouched (Meridian keeps them as they are).

Runtime contract (src/faction-dress.js merges each part into the model's own team-paint mesh of the same rigid group,
so a battle between two factions draws no extra batch):
  * one root empty `dress_<type>` per model at the origin; its meshes are named `<type>__<group>__<material>`
    with group body | turret | barrel | legL | legR (turret and barrel on the Tank and Breaker; barrel is also the
    Tower's turning head);
  * Team and TeamGlow keep the team's paint and glow; every other material is the part's own colour, baked into the
    vertex colour at load (alpha 0 = not team paint);
  * a group only carries what its base model already draws there (GROUPS): TeamGlow only where the base has a glow
    mesh, own colours only where it has team paint;
  * built in place on the base model (generate_assets / generate_air builders), so its AO bake sees the body it sits
    on; no UVs (team paint has no texture); at most +25 % of the base model's triangles (SHARE); heights stay
    within a few percent (selection rings, vitals bars and pick boxes keep fitting).
"""
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset  # noqa: E402
import generate_assets as shared  # noqa: E402
import generate_air as air  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
R = math.pi / 2
FORWARD = (R, 0, 0)   # cylinder axis along -Y (the front)
ACROSS = (0, R, 0)    # cylinder axis along X
FACTIONS = ('ashfall', 'sunward', 'wardens', 'veil')
INFANTRY = ('worker', 'vanguard', 'ranger', 'medic', 'engineer', 'antitank')
VEHICLES = ('breaker', 'tank', 'kite')
BUILDINGS = ('hq', 'barracks', 'foundry', 'relay', 'tower')
TYPES = INFANTRY + VEHICLES + BUILDINGS
SHARE = 0.25          # a dress adds at most a quarter of its base model's triangles
REVIEW = 'pending owner review (visual round V)'
# The team materials each rigid group of a base model draws (src/view.js template buckets). A dress part may only
# join one of these, so it lands in an existing team batch; own colours ride in the Team mesh. Flyers draw their
# glow as team paint (compact bake), so the Kite takes Team only.
_INF = {'body': {'Team', 'TeamGlow'}, 'legL': {'Team'}, 'legR': {'Team'}}
_BLD = {'body': {'Team', 'TeamGlow'}}
GROUPS = {**{k: _INF for k in INFANTRY}, **{k: _BLD for k in ('hq', 'barracks', 'foundry', 'relay')},
          'breaker': {'body': {'Team'}, 'turret': {'Team'}, 'barrel': {'TeamGlow'}},
          'tank': {'body': {'Team'}, 'turret': {'Team', 'TeamGlow'}},
          'kite': {'body': {'Team'}},
          'tower': {'body': {'Team', 'TeamGlow'}, 'barrel': {'Team'}}}


# ----------------------------------------------------------------------------- helpers
def place(loc, rot, local=(0, 0, 0)):
    """A point on a rotated part (part space -> model space)."""
    return tuple(kit._matrix(loc, rot) @ Vector(local))


def axis_rot(direction):
    """Euler that turns local +Z (a cylinder or cone axis) to `direction`."""
    return tuple(Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized()).to_euler('XYZ'))


class Dress:
    """The dress parts of one model: one Shape per (group, material), named for the runtime contract."""

    def __init__(self, a, kind):
        self.a, self.kind = a, kind

    def __call__(self, mat, group='body', flat=False):
        allowed = GROUPS[self.kind].get(group, set())
        team = mat in ('Team', 'TeamGlow')
        if (team and mat not in allowed) or (not team and 'Team' not in allowed):
            raise RuntimeError(f'{self.kind}: {mat} has no team batch to join in group {group}')
        return self.a.part(f'{self.kind}__{group}__{mat}' + ('__flat' if flat else ''), mat, flat=flat)


def panel(s, a, b, w, d, taper=(1, 1), across=(1, 0, 0), bevel=0, seg=1):
    """A box from point a to point b (b end tapered) whose width stays along `across` (world X by default). Kit
    Shape.limb turns +Z onto the segment by the shortest arc, which twists a downward box's width into depth."""
    a, b = Vector(a), Vector(b)
    z = (b - a).normalized()
    ref = Vector(across)
    x = (ref - z * ref.dot(z)).normalized()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_euler('XYZ')
    return s.box((w, d, (b - a).length), loc=tuple((a + b) / 2), rot=tuple(rot), bevel=bevel, seg=seg, taper=taper)


def revolve(s, profile, loc=(0, 0, 0), rot=(0, 0, 0), seg=12):
    """Revolve [(radius, z)...] (bottom to top) around local Z. A zero radius is one apex vertex, so cones, domes and
    crystals need no vertex welding (kit Shape.lathe welds its tips with remove_doubles, whose surviving vertex is
    not stable from run to run, and this export must be byte-identical)."""
    bm = s.bm
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(k * math.tau / seg), r * math.sin(k * math.tau / seg), z)) for k in range(seg)])
    faces = []
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            j = (k + 1) % seg
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                faces.append(bm.faces.new((a[0], b[k], b[j])))
            elif len(b) == 1:
                faces.append(bm.faces.new((a[k], a[j], b[0])))
            else:
                faces.append(bm.faces.new((a[k], a[j], b[j], b[k])))
    if len(rings[0]) > 1:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
    if len(rings[-1]) > 1:
        faces.append(bm.faces.new(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    s._finish([v for ring in rings for v in ring], loc, rot, 0, 1)
    return s


# Motifs (cheap on purpose: a bevel-free box is 12 triangles, a 6-sided stud 20).
def rivets(s, loc, rot, points, r=.026, h=.024):
    for p in points:
        s.cyl(r, h, loc=place(loc, rot, p), rot=rot, seg=6, bevel=0)


def plate(d, mat, size, loc, rot=(0, 0, 0), group='body', bevel=.02, studs=(), stud_mat='Steel', r=.026):
    """A welded plate (thin along local Z) with rivet studs at local (x, y) on its outer face."""
    d(mat, group).box(size, loc=loc, rot=rot, bevel=bevel, seg=1)
    if studs:
        rivets(d(stud_mat, group), loc, rot, [(x, y, size[2] / 2) for x, y in studs], r=r)


def stripes(d, size, loc, rot=(0, 0, 0), group='body', bars=2, bar='Soot'):
    """Hazard band (thin along local Z) with dark diagonal bars on it."""
    d('Hazard', group).box(size, loc=loc, rot=rot, bevel=0)
    w = size[0] / (bars * 2 + 1)
    for i in range(bars):
        x = -size[0] / 2 + w * (2 * i + 1.5)
        m = kit._matrix(loc, rot) @ kit._matrix((x, 0, size[2] / 2 + .003), (0, 0, .7))
        d(bar, group).box((w * .8, size[1] * 1.25, .012), loc=tuple(m.to_translation()), rot=tuple(m.to_euler('XYZ')), bevel=0)


def spike(s, base, tip, r, seg=5):
    base, tip = Vector(base), Vector(tip)
    revolve(s, [(r, 0), (0, (tip - base).length)], loc=tuple(base), rot=axis_rot(tip - base), seg=seg)


def stack(d, base, top, r, group='body', band='Rust', seg=6, crown=0):
    """Exhaust stack: a dark pipe bending to its top, a heat band, a wider sooty lip and `crown` spikes."""
    base, top = Vector(base), Vector(top)
    mid = base + (top - base) * .55
    mid.x, mid.y = base.x + (top.x - base.x) * .2, base.y + (top.y - base.y) * .2
    d('Soot', group).tube([tuple(base), tuple(mid), tuple(top)], r, seg=seg)
    band_at = base + (top - base) * .72
    d(band, group).cyl(r * 1.28, r * 1.4, loc=tuple(band_at), rot=axis_rot(top - mid), seg=seg, bevel=0)
    d('Soot', group).cyl(r * 1.35, r * .9, loc=tuple(top), rot=axis_rot(top - mid), seg=seg, bevel=0)
    for k in range(crown):
        ang = k * math.tau / crown
        p = top + Vector((math.cos(ang) * r * 1.3, math.sin(ang) * r * 1.3, -r * .2))
        spike(d('Soot', group), tuple(p), tuple(p + Vector((math.cos(ang) * r * .9, math.sin(ang) * r * .9, r * 1.6))), r * .35, seg=4)


def pennant(d, base, height, flag=.5, group='body', pole='Steel', cloth='Team', bead='Turquoise', lean=(0, 0)):
    """A pole with a swallow-tail pennant blowing to +Y (back) and a bead on top."""
    x, y, z = base
    top = (x + lean[0], y + lean[1], z + height)
    d(pole, group).limb(base, top, .045, .045, bevel=0)
    fz = top[2] - .06
    d(cloth, group).prism([(top[1], fz), (top[1] + flag, fz - flag * .22), (top[1] + flag * .78, fz - flag * .3),
                           (top[1] + flag, fz - flag * .45), (top[1], fz - flag * .55)], .025,
                          loc=(top[0], 0, 0), axis='X', bevel=0)
    if bead:
        d(bead, group).ico(.07, loc=(top[0], top[1], top[2] + .04), sub=0)


def canopy(d, w, depth, loc, rise=.12, group='body', cloth='Canvas', trim='Team', poles=True, pole_mat='Brass', post=1.0,
           tassels=4, rot=(0, 0, 0), steps=6):
    """A cream canvas sheet arched across X over (w x depth), a team valance on both long edges with tassels, and
    four posts reaching `post` metres down from its corners."""
    top = [(-w / 2 + w * i / steps, rise * math.sin(math.pi * i / steps)) for i in range(steps + 1)]
    profile = top + [(x, z - .03) for x, z in reversed(top)]
    d(cloth, group).prism(profile, depth, loc=loc, rot=rot, axis='Y', bevel=0)
    for side in (-1, 1):
        edge = place(loc, rot, (0, side * depth / 2, -.04))
        d(trim, group).box((w * .98, .03, .1), loc=edge, rot=rot, bevel=0)
        for k in range(tassels):
            x = -w / 2 + w * (k + .5) / tassels
            d(trim, group).box((.06, .03, .14), loc=place(loc, rot, (x, side * depth / 2, -.15)), rot=rot, bevel=0, taper=(.3, 1))
    if poles:
        for sx in (-1, 1):
            for sy in (-1, 1):
                a = place(loc, rot, (sx * (w / 2 - .06), sy * (depth / 2 - .06), -.01))
                d(pole_mat, group).limb(a, (a[0], a[1], a[2] - post), .05, .05, bevel=0)


def solar_fan(d, centre, r, normal=(0, 0, 1), blades=6, group='body', blade='Canvas', hub='Brass', mast=0.0, mast_mat='Steel'):
    """A radial solar fan: cream blades round a brass hub, facing `normal`, on an optional mast below."""
    rot = axis_rot(normal)
    for k in range(blades):
        ang = k * math.tau / blades
        m = kit._matrix(centre, rot) @ kit._matrix((math.cos(ang) * r * .55, math.sin(ang) * r * .55, 0), (.25, 0, ang))
        d(blade, group).box((r * .9, r * .36, .025), loc=tuple(m.to_translation()), rot=tuple(m.to_euler('XYZ')), bevel=0,
                            taper=(1.0, .55))
    d(hub, group).cyl(r * .24, .1, loc=centre, rot=rot, seg=8, bevel=0)
    if mast:
        d(mast_mat, group).limb((centre[0], centre[1], centre[2] - mast), centre, .07, .07, bevel=0)


def sun_wheel(d, centre, r, normal, group='body', disc='Brass', spokes='Canvas', hub='Turquoise'):
    """A brass sun disc with cream spokes and a turquoise boss (spoked-wheel cover / Sunward emblem)."""
    rot = axis_rot(normal)
    d(disc, group).cyl(r, .05, loc=centre, rot=rot, seg=12, bevel=0)
    for k in range(4):
        m = kit._matrix(centre, rot) @ kit._matrix((0, 0, .03), (0, 0, k * math.pi / 4))
        d(spokes, group).box((r * 1.7, r * .16, .03), loc=tuple(m.to_translation()), rot=tuple(m.to_euler('XYZ')), bevel=0)
    d(hub, group).cyl(r * .3, .1, loc=place(centre, rot, (0, 0, .04)), rot=rot, seg=8, bevel=0)


def dome(s, centre, r, h, seg=12, rot=(0, 0, 0), low=False):
    """A smooth dome (lathe), its base ring at `centre`; `low` is the three-band version for small domes."""
    prof = [(r, 0), (r * .97, h * .3), (r * .86, h * .58), (r * .64, h * .82), (r * .34, h * .96), (0, h)]
    if low:
        prof = [(r, 0), (r * .9, h * .5), (r * .5, h * .9), (0, h)]
    revolve(s, prof, loc=centre, rot=rot, seg=seg)


def arch_band(s, y0, y1, r_in, r_out, cz=1.35, a0=math.pi, a1=0.0, steps=8, drop=0.0):
    """A shell over the Barracks' arched hangar (arc centre z = cz, axis along Y) from y0 to y1: a band between two
    radii, its ends lowered `drop` metres down the walls."""
    outer = [(-r_out, cz - drop)] if drop else []
    outer += kit.arc(0, cz, r_out, a0, a1, steps)
    outer += [(r_out, cz - drop)] if drop else []
    inner = [(r_in, cz - drop)] if drop else []
    inner += kit.arc(0, cz, r_in, a1, a0, steps)
    inner += [(-r_in, cz - drop)] if drop else []
    s.prism(outer + inner, y1 - y0, loc=(0, (y0 + y1) / 2, 0), axis='Y', bevel=0)


def lens(d, centre, r, normal=(0, -1, 0), group='body', glow='TeamGlow', ring='Steel', seg=12):
    """The Wardens eye: a steel ring round a glowing lens, facing `normal`."""
    rot = axis_rot(normal)
    d(ring, group).cyl(r * 1.35, .06, loc=centre, rot=rot, seg=seg, bevel=0)
    d(glow, group).cyl(r, .07, loc=place(centre, rot, (0, 0, .02)), rot=rot, seg=seg, bevel=0)


def halo(s, centre, R_, r, rot=(0, 0, 0), seg=18, ring=3):
    s.torus(R_, r, loc=centre, rot=rot, seg=seg, ring=ring)


def crystal(s, base, tip, r, seg=5):
    """An angular crystal shard (bipyramid)."""
    base, tip = Vector(base), Vector(tip)
    n = (tip - base).length
    revolve(s, [(0, 0), (r, n * .28), (r * .7, n * .62), (0, n)], loc=tuple(base), rot=axis_rot(tip - base), seg=seg)


def spire(d, base, height, r, group='body', mat='Charcoal', collar='Silver', gem=None, seg=6):
    """A thin needle spire with a silver collar, and a glowing crystal tip when `gem` names a material."""
    x, y, z = base
    revolve(d(mat, group), [(r, 0), (r * .55, height * .45), (r * .3, height * .8), (0, height)], loc=base, seg=seg)
    d(collar, group).cyl(r * 1.25, height * .06, loc=(x, y, z + height * .32), seg=seg, bevel=0)
    if gem:
        crystal(d(gem, group, flat=True), (x, y, z + height * .86), (x, y, z + height * 1.12), r * .9, seg=4)


def fin(d, root_a, root_b, tip, group='body', mat='Charcoal', edge='Silver', thick=.03):
    """A folded fin: a thin triangle (root edge a-b on the body, `tip` out) with a silver leading edge."""
    a, b, t = Vector(root_a), Vector(root_b), Vector(tip)
    n = (b - a).cross(t - a).normalized()
    bm = d(mat, group).bm
    top = [bm.verts.new(tuple(p + n * thick / 2)) for p in (a, b, t)]
    bot = [bm.verts.new(tuple(p - n * thick / 2)) for p in (a, b, t)]
    faces = [bm.faces.new(top), bm.faces.new(list(reversed(bot)))]
    for i in range(3):
        j = (i + 1) % 3
        faces.append(bm.faces.new((top[i], bot[i], bot[j], top[j])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    if edge:
        d(edge, group).limb(tuple(a), tuple(t), thick * 1.6, thick * 1.6, bevel=0)


# ----------------------------------------------------------------------------- infantry
# Where each role's back is free (y of its back surface; the worker's crystal frame, the medic's big pack, the
# engineer's tool frame, the anti-tank rockets and the ranger's cape all sit behind the shoulders).
BACK = {'vanguard': .44, 'antitank': .3, 'worker': .3, 'medic': .6, 'engineer': .36, 'ranger': .32}


def ashfall_infantry(d, kind):
    """Salvagers in gas-mask hoods: a dark rubber hood over the helmet (its team crest still on top) with round glowing
    goggles, a rust respirator snout and hazard-yellow filter cans; one big spiked scrap pauldron with a hazard band; a
    riveted rust patch on the chest; exhaust stacks off the back; a rust plate on the right thigh. The Engineer keeps
    its hard hat over a smaller face mask."""
    b = 1.1 if kind == 'vanguard' else 1.0
    soot, glow, rust = d('Soot'), d('TeamGlow'), d('Rust')
    face = -.29
    if kind != 'engineer':
        soot.box((.52, .54, .39), loc=(0, .01, 2.01), bevel=.11, seg=1, taper=(.86, .88))     # the gas-mask hood
        soot.box((.42, .16, .12), loc=(0, .24, 1.84), rot=(.4, 0, 0), bevel=0)                  # hood skirt at the neck
        face = -.3
    d('Rust').box((.24, .18, .17), loc=(0, face, 1.87), rot=(-.32, 0, 0), bevel=.04, seg=1, taper=(.72, .78))
    soot.cyl(.05, .04, loc=(0, face - .1, 1.84), rot=axis_rot((0, -1, -.35)), seg=6, bevel=0)  # snout valve
    for s in (-1, 1):
        d('Hazard').cyl(.075, .18, loc=(s * .17, face - .01, 1.82), rot=axis_rot((s * .55, -.55, -.62)), seg=6, bevel=0)
        glow.cyl(.07, .05, loc=(s * .1, face + .025, 2.02), rot=FORWARD, seg=6, bevel=0)
        soot.cyl(.092, .03, loc=(s * .1, face + .045, 2.02), rot=FORWARD, seg=6, bevel=0)
    # The big scrap pauldron on the left shoulder: a layered rust plate under team paint, three spikes, a hazard band.
    pl, pr = (-.59 * b, 0, 1.94), (0, -.55, 0)
    plate(d, 'Rust', (.44 * b, .62, .08), (-.63 * b, 0, 1.86), (0, -.78, 0), bevel=.015)
    d('Team').box((.5 * b, .64, .13), loc=pl, rot=pr, bevel=.03, seg=1)
    for y in (-.2, 0, .2):
        p = place(pl, pr, (-.05, y, .065))
        spike(soot, p, (p[0] - .08, p[1] + y * .4, p[2] + .3), .06)
    stripes(d, (.44 * b, .09, .02), place(pl, pr, (0, -.26, .07)), pr, bars=2)
    # Mismatched armour: a riveted rust patch over the right of the chest.
    plate(d, 'Rust', (.26 * b, .3, .04), (.17 * b, -.255, 1.52), (R + .05, 0, .12), bevel=.01)
    # Exhaust stacks off the back: a tall one on the right, a short one on the left (one on the Anti-tank, whose
    # launcher fills the right shoulder).
    y = BACK[kind] + .02
    z0 = 1.84 if kind == 'medic' else 1.5
    if kind != 'antitank':
        x = .4 if kind in ('worker', 'engineer') else .3 * b
        stack(d, (x, y, z0), (x + .03, y + .06, 2.24), .07, crown=0)
    x = -.4 if kind in ('worker', 'engineer') else -.3 * b
    stack(d, (x, y, z0), (x - .02, y + .05, 2.02 if kind != 'antitank' else 2.22), .065)
    # A riveted rust plate on the right thigh (it swings with the leg).
    plate(d, 'Rust', (.22, .28, .05), (.21 * b, -.21, .72), (R - .08, 0, 0), group='legR', bevel=.01,
          studs=((0, .09), (0, -.09)), r=.022)


def sunward_infantry(d, kind):
    """Caravan traders: a wide-brim canvas hat with a team band (the Engineer keeps its hard hat under a sun flap),
    a turquoise scarf with tails, a cream sash with brass studs, a bedroll and a little team pennant."""
    b = 1.1 if kind == 'vanguard' else 1.0
    canvas, brass, turq = d('Canvas'), d('Brass'), d('Turquoise')
    tilt = (.07, 0, 0)
    if kind != 'engineer':
        crown = {'medic': 'ArmorMedic', 'ranger': 'Cape'}.get(kind, 'Canvas')
        canvas.cyl(.45, .035, loc=(0, .02, 2.18), rot=tilt, seg=16, bevel=0)
        revolve(d(crown), [(.27, 0), (.262, .05), (.21, .1), (.11, .125), (0, .13)], loc=(0, .02, 2.19), rot=tilt, seg=12)
        d('Team').cyl(.276, .045, loc=(0, .024, 2.215), rot=tilt, seg=12, bevel=0)
        if kind == 'medic':
            for sz in ((.07, .22, .03), (.22, .07, .03)):
                d('Cross').box(sz, loc=(0, .035, 2.32), rot=tilt, bevel=0)
        else:
            brass.box((.08, .03, .06), loc=(0, -.25, 2.215), rot=tilt, bevel=0)  # band buckle
    else:
        canvas.box((.52, .05, .32), loc=(0, .3, 1.93), rot=(.38, 0, 0), bevel=.015, seg=1)       # sun flap
        d('Team').box((.5, .05, .07), loc=(0, -.28, 2.0), bevel=0)                               # goggles strap
        canopy(d, .62, .4, (0, .5, 2.72), rise=.08, poles=False, tassels=3)                      # awning on the frame
    turq.cyl(.235, .1, loc=(0, .0, 1.84), seg=10, bevel=0)
    panel(turq, (-.08, .2, 1.84), (-.2, .5, 1.42), .13, .03)
    panel(turq, (.04, .2, 1.84), (.12, .46, 1.5), .11, .03)
    a, c = (.3 * b, -.27, 1.74), (-.28 * b, -.27, 1.2)
    panel(canvas, a, c, .12, .04, across=(0, 0, 1))
    for t in (.25, .55, .85):
        p = Vector(a).lerp(Vector(c), t)
        brass.cyl(.035, .03, loc=(p.x, p.y - .025, p.z), rot=FORWARD, seg=6, bevel=0)
    # Bedroll across the back (under the worker's crystal and the engineer's frame, on top of the medic's pack).
    y = BACK[kind]
    roll = {'medic': (0, .38, 1.96), 'worker': (0, .5, 1.16), 'engineer': (0, .5, 1.16)}.get(kind, (0, y + .02, 1.84))
    if kind != 'ranger':
        canvas.cyl(.1, .62, loc=roll, rot=ACROSS, seg=10, bevel=0)
        for x in (-.18, .18):
            d('Team').cyl(.105, .05, loc=(x, roll[1], roll[2]), rot=ACROSS, seg=10, bevel=0)
    # A little team pennant on the pack (the Ranger's rides off its cape, the Anti-tank's off the rockets).
    if kind != 'engineer':
        at = {'ranger': (-.3, .45, 1.6), 'medic': (-.3, .5, 1.7), 'antitank': (-.3, .4, 1.5), 'worker': (-.38, .36, 1.4)}
        x, yy, z = at.get(kind, (-.3 * b, y + .02, 1.45))
        pennant(d, (x, yy, z), 2.18 - z, flag=.18, bead='Turquoise')


def wardens_infantry(d, kind):
    """Guardian machines: a smooth ceramic dome head with one big lens eye (the Engineer keeps its hard hat), a
    glowing halo behind the head, ceramic shoulder shells with glow seams, a chest plate and segmented shins."""
    b = 1.1 if kind == 'vanguard' else 1.0
    cer, glow = d('Ceramic'), d('TeamGlow')
    if kind != 'engineer':
        dome(cer, (0, 0, 1.86), .3, .42, seg=12)
        if kind == 'medic':
            for sz in ((.07, .24, .03), (.24, .07, .03)):
                d('Cross').box(sz, loc=(0, 0, 2.275), bevel=0)
        lens(d, (0, -.29, 2.0), .1, normal=(0, -1, .12))
    else:
        lens(d, (0, -.27, 1.98), .085, normal=(0, -1, 0))
    hy = {'ranger': .38, 'worker': .27, 'medic': .32}.get(kind, .3)
    hr = .24 if kind in ('medic', 'antitank') else .28
    hz = 2.08 if kind == 'medic' else 2.02
    halo(glow, (0, hy, hz), hr, .026, rot=(R - .15, 0, 0), seg=16, ring=3)
    for s in (-1, 1):
        c = (s * .53 * b, 0, 1.79)
        cer.sphere((.25 * b, .28, .17), loc=c, rot=(0, s * .32, 0), seg=10, rings=6, cut=0)
        glow.box((.035, .5, .035), loc=place(c, (0, s * .32, 0), (0, 0, .168)), rot=(0, s * .32, 0), bevel=0)
    plate(d, 'Ceramic', (.4 * b, .3, .05), (0, -.255, 1.5), (R, 0, 0), bevel=.02)
    glow.cyl(.055, .04, loc=(0, -.285, 1.52), rot=FORWARD, seg=4, bevel=0)
    # Segmented shins: two ceramic plates per leg (they bend with the knee).
    for s, g in ((-1, 'legL'), (1, 'legR')):
        for z in (.34, .55):
            d('Ceramic', g).box((.24 * b, .06, .15), loc=(s * .21 * b, -.205, z), rot=(-.08, 0, 0), bevel=0)


def veil_infantry(d, kind):
    """Scholars and infiltrators: a tall pointed charcoal hood with a long tail and silver piping, a glowing seer lens
    (a cowl under the Engineer's hard hat), a charcoal mantle over the backs of the shoulders, a long split cloak that
    flares at the hem, and glowing crystal shards on the right shoulder."""
    b = 1.1 if kind == 'vanguard' else 1.0
    char, silver, glow = d('Charcoal'), d('Silver'), d('TeamGlow')
    if kind != 'engineer':
        char.box((.64, .66, .46), loc=(0, .1, 2.02), bevel=.05, seg=1, taper=(.34, .4), shift=(0, .2))
        revolve(char, [(.07, 0), (0, .3)], loc=(0, .36, 2.2), rot=axis_rot((0, .9, .42)), seg=4)   # the hood's point
        panel(char, (0, .42, 2.14), (0, .55, 1.62), .18, .06)                       # the hood's tail down the back
        for s in (-1, 1):
            silver.limb((s * .31, -.2, 1.8), (s * .1, -.12, 2.27), .04, .03, bevel=0)  # piping on the hood edge
        if kind == 'medic':
            for sz in ((.05, .03, .16), (.16, .03, .05)):
                d('Cross').box(sz, loc=(0, .43, 1.98), rot=(-.6, 0, 0), bevel=0)
    else:
        char.box((.54, .52, .22), loc=(0, .1, 1.93), bevel=.03, seg=1, taper=(.9, .9))
    glow.cyl(.07, .05, loc=(.1, -.262, 2.03), rot=FORWARD, seg=8, bevel=0)
    silver.cyl(.09, .03, loc=(.1, -.245, 2.03), rot=FORWARD, seg=8, bevel=0)
    # A charcoal mantle over the backs of both shoulders (the team pads still show in front).
    char.box((1.02 * b, .42, .07), loc=(0, .16, 1.9), rot=(.18, 0, 0), bevel=.025, seg=1, taper=(.82, 1))
    silver.box((1.0 * b, .04, .04), loc=(0, -.05, 1.92), bevel=0)
    # Long split cloak from the shoulders (behind the role's back gear), flaring at the hem, silver edges.
    top_y = {'worker': .74, 'medic': .6, 'engineer': .56, 'antitank': .58}.get(kind, BACK[kind] + .02)
    if kind != 'ranger':
        for s in (-1, 1):
            t, bot = (s * .22 * b, top_y, 1.86), (s * .3 * b, top_y + .14, .58)
            panel(char, t, bot, .4 * b, .045, taper=(1.4, 1))
            panel(silver, (s * .42 * b, top_y + .03, 1.84), (s * .58 * b, top_y + .17, .58), .04, .05)
        silver.box((1.18 * b, .05, .05), loc=(0, top_y + .15, .56), bevel=0)
    # Crystal shards on the right shoulder.
    c = (.56 * b, .02, 1.86)
    for tip, r in (((.7 * b, .12, 2.26), .075), ((.78 * b, -.08, 2.14), .06), ((.58 * b, -.16, 2.2), .055)):
        crystal(d('TeamGlow', flat=True), c, tip, r)


# ----------------------------------------------------------------------------- vehicles
# (Blender metres, front is -Y.) Tank: tracks x +-0.95 (0.46 wide, 3.0 long, z 0.07-0.73), hull to z 1.08 (x +-0.73),
# turret ring at (0, 0.15, 1.16), turret z 1.24-1.82 (x +-0.86, y -0.73..0.95), gun at z 1.7 to y -2.9.
# Breaker: tracks x +-0.82 (2.6 long, z 0.07-0.65), hull to z 0.95 (x +-0.62), turret ring (0, 0.1, 1.0), turret
# z 1.06-1.52 (x +-0.63), twin guns at x +-0.26, z 1.44 to y -1.92.
VEH = {
    'tank': dict(half=.95, length=3.0, hull=1.08, hullw=.73, side=1.31, turret=(0, .15), tz=(1.24, 1.82), tw=.86,
                 front=-1.5, back=1.45, gun=1.7),
    'breaker': dict(half=.82, length=2.6, hull=.95, hullw=.62, side=1.11, turret=(0, .1), tz=(1.06, 1.52), tw=.63,
                    front=-1.25, back=1.25, gun=1.44),
}


def ashfall_vehicle(d, kind):
    """Scrap war wagon: a team ram blade with hazard stripes, teeth and push arms, two tall exhaust stacks with
    spiked crowns, riveted rust plates on the sides and turret, spikes on the turret and tow hooks."""
    v = VEH[kind]
    k = v['length'] / 3.0
    f = v['front']
    team, soot = d('Team'), d('Soot')
    # Ram blade across the front of the tracks.
    bw = (v['half'] + .2) * 2
    team.prism([(f - .42 * k, .1), (f - .3 * k, .1), (f - .1 * k, .82 * k), (f - .22 * k, .86 * k)], bw, bevel=.03)
    stripes(d, (bw * .9, .05, .14 * k), (0, f - .225 * k, .72 * k), (R - .28, 0, 0), bars=4)
    for i in range(5):
        x = (i - 2) * bw * .2
        spike(soot, (x, f - .38 * k, .14), (x, f - .62 * k, .1), .06, seg=4)
    for s in (-1, 1):
        soot.limb((s * v['hullw'] * .7, f - .28 * k, .55 * k), (s * v['hullw'] * .7, f + .35 * k, .78 * k), .1, .1, bevel=0)
        soot.tube([(s * (v['half'] - .1), f - .32 * k, .32), (s * (v['half'] - .1), f - .5 * k, .3), (s * (v['half'] - .1), f - .52 * k, .44)], .035, seg=4)
    # Exhaust stacks at the rear corners, crowned with spikes.
    for s in (-1, 1):
        x, y = s * v['hullw'] * .78, v['back'] - .2 * k
        stack(d, (x, y, v['hull'] - .05), (x, y + .12, v['hull'] + 1.2 * k), .085 * k, crown=4, seg=8)
    # Riveted scrap plates on both sides, set at odd angles.
    for s in (-1, 1):
        for y, size, tilt in ((-.55 * k, (.62 * k, .34 * k), .08), (.45 * k, (.5 * k, .28 * k), -.12)):
            plate(d, 'Rust', (size[0], size[1], .04), (s * v['side'], y, v['hull'] * .78), (0, s * R, tilt * s), bevel=0,
                  studs=((size[0] * .38, size[1] * .3), (-size[0] * .38, -size[1] * .3)))
    # Turret: a rust plate welded across the front left, spikes along the roof, a hazard band at the back.
    tx, ty = v['turret']
    t0, t1 = v['tz']
    plate(d, 'Rust', (.6 * k, .06, (t1 - t0) * .8), (-v['tw'] * .45, ty - .7 * k, (t0 + t1) / 2 + .03), (-.2, 0, .3),
          group='turret', bevel=.015, studs=((-.2 * k, .0), (.2 * k, 0)))
    for i in range(4):
        x = (i - 1.5) * v['tw'] * .4
        spike(d('Soot', 'turret'), (x, ty + .45 * k, t1 - .02), (x, ty + .62 * k, t1 + .26 * k), .055, seg=4)
    stripes(d, (v['tw'] * 1.2, .04, .14 * k), (0, ty + .95 * k if kind == 'tank' else ty + .66 * k, (t0 + t1) / 2 + .02),
            (R, 0, 0), group='turret', bars=3)


def sunward_vehicle(d, kind):
    """Caravan carrier: a cream canvas awning over the turret with a team valance, a brass dome hatch, two tall
    pennants, brass sun wheels on the track sides, a rolled carpet on the rear deck and a turquoise band."""
    v = VEH[kind]
    k = v['length'] / 3.0
    tx, ty = v['turret']
    t0, t1 = v['tz']
    canopy(d, v['tw'] * 2.25, 1.15 * k, (tx, ty + .3 * k, t1 + .5 * k), rise=.12, group='turret', post=.5 * k + .03,
           tassels=4)
    cup = (.35, .45, 2.0) if kind == 'tank' else (-.25, .35, 1.61)
    dome(d('Brass', 'turret'), cup, .26 if kind == 'tank' else .2, .2, seg=10)
    for s in (-1, 1):
        pennant(d, (s * v['hullw'] * .85, v['back'] - .15 * k, v['hull']), (1.7 if kind == 'tank' else 1.25) * k, flag=.38 * k)
        sun_wheel(d, (s * (v['side'] + .03), -.05, v['hull'] * .7), .3 * k, (s, 0, 0))
    # Rolled carpet across the rear deck, strapped in team colour.
    y = v['back'] - .45 * k
    d('Turquoise').cyl(.14 * k, v['hullw'] * 1.7, loc=(0, y, v['hull'] + .14 * k), rot=ACROSS, seg=10, bevel=0)
    for x in (-.3, .3):
        d('Team').cyl(.15 * k, .07, loc=(x, y, v['hull'] + .14 * k), rot=ACROSS, seg=10, bevel=0)
    # A turquoise band with brass studs along the glacis.
    f = v['front']
    d('Turquoise').box((v['hullw'] * 1.9, .05, .1), loc=(0, f + .52 * k, v['hull'] - .03), rot=(-.62, 0, 0), bevel=0)
    for x in (-.45, -.15, .15, .45):
        d('Brass').cyl(.045, .04, loc=(x * v['hullw'] * 1.6, f + .48 * k, v['hull'] - .01), rot=(-.62 + R, 0, 0), seg=6, bevel=0)
    # Canvas skirts over the upper tracks.
    for s in (-1, 1):
        d('Canvas').box((.04, v['length'] * .82, .24 * k), loc=(s * (v['side'] + .07), -.03, v['hull'] * .58), bevel=0)


def wardens_vehicle(d, kind):
    """Guardian engine: smooth ceramic side pods with segmented insect legs over the tracks, a ceramic turret cap
    with one big lens eye and glow seams, a floating team halo round the turret and a ceramic glacis."""
    v = VEH[kind]
    k = v['length'] / 3.0
    tx, ty = v['turret']
    t0, t1 = v['tz']
    cer = d('Ceramic')
    for s in (-1, 1):
        cer.sphere((.15 * k, v['length'] * .42, .26 * k), loc=(s * (v['side'] - .07), -.05, v['hull'] * .86), seg=10, rings=6)
        for y in (-.75 * k, 0, .75 * k):
            root = (s * (v['side'] - .02), y, v['hull'] * .98)
            knee = (s * (v['side'] + .03), y - .08 * k, v['hull'] * 1.12)
            foot = (s * (v['half'] + .12), y - .16 * k, .2)
            d('Ceramic').limb(root, knee, .11, .09, bevel=0)
            d('Steel').limb(knee, foot, .08, .07, bevel=0)
            d('Seam').cyl(.07, .14, loc=knee, rot=ACROSS, seg=6, bevel=0)
    cap_mat = 'Ceramic'
    d(cap_mat, 'turret').sphere((v['tw'] * .86, v['tw'] * .98, (t1 - t0) * .62), loc=(tx, ty + .05, t1 - .1), seg=12, rings=8, cut=0)
    if kind == 'tank':
        lens(d, (tx, ty - .78, t1 + .02), .15, normal=(0, -1, .35), group='turret')
        for s in (-1, 1):
            d('TeamGlow', 'turret').box((.035, .9, .035), loc=(s * .42, ty + .05, t1 + .12), rot=(0, s * .55, 0), bevel=0)
    else:
        # The Breaker's turret has no glow mesh: its eye sits on the gun mantlet between the barrels.
        d('Steel', 'turret').cyl(.17, .06, loc=(tx, ty - .58, (t0 + t1) / 2 + .14), rot=axis_rot((0, -1, .3)), seg=12, bevel=0)
        d('TeamGlow', 'barrel').cyl(.12, .07, loc=(0, -.66, v['gun'] + .17), rot=axis_rot((0, -1, .3)), seg=12, bevel=0)
        for s in (-1, 1):
            d('Seam', 'turret').box((.035, .7, .035), loc=(s * .33, ty + .05, t1 + .1), rot=(0, s * .55, 0), bevel=0)
    halo(d('Team', 'turret'), (tx, ty + .05, t1 + .32 * k), v['tw'] + .16, .045, seg=24, ring=4)
    f = v['front']
    plate(d, 'Ceramic', (v['hullw'] * 1.7, .55 * k, .07), (0, f + .27 * k, v['hull'] * .82), (-.62, 0, 0), bevel=.03)
    d('Seam').box((v['hullw'] * 1.2, .04, .04), loc=(0, f + .12 * k, v['hull'] * .66), rot=(-.62, 0, 0), bevel=0)


def veil_vehicle(d, kind):
    """Silent seer: folded charcoal fins down both flanks, angled skirts that slim the hull, a charcoal drape with a
    silver hem on the rear deck, a faceted cowl over the turret front, a thin spire with a glowing crystal, a seer
    lens and crystal shards."""
    v = VEH[kind]
    k = v['length'] / 3.0
    tx, ty = v['turret']
    t0, t1 = v['tz']
    for s in (-1, 1):
        for y, h in ((-.7 * k, .35), (.05 * k, .48), (.75 * k, .62)):
            x = s * v['hullw'] * .98
            fin(d, (x, y - .32 * k, v['hull']), (x, y + .2 * k, v['hull']), (x + s * .18, y + .42 * k, v['hull'] + h * k))
        d('Charcoal').box((.06, v['length'] * .86, .42 * k), loc=(s * (v['side'] + .02), -.02, v['hull'] * .55),
                          rot=(0, -s * .3, 0), bevel=.02, seg=1)
        d('Silver').box((.04, v['length'] * .86, .035), loc=(s * (v['side'] + .09), -.02, v['hull'] * .76), bevel=0)
    d('Charcoal').box((v['hullw'] * 1.8, .9 * k, .06), loc=(0, v['back'] - .5 * k, v['hull'] + .04), rot=(-.08, 0, 0), bevel=.02,
                      seg=1, taper=(1.06, 1))
    d('Silver').box((v['hullw'] * 1.84, .04, .04), loc=(0, v['back'] - .05 * k, v['hull'] + .02), bevel=0)
    # Turret: a faceted cowl (two angled plates meeting in a ridge) over the front, a spire, a seer lens, shards.
    for s in (-1, 1):
        d('Charcoal', 'turret').box((v['tw'] * .62, .7 * k, .06), loc=(s * v['tw'] * .3, ty - .32 * k, t1 + .04),
                                    rot=(.12, s * .42, 0), bevel=.015, seg=1, taper=(.6, 1))
    spire(d, (tx - v['tw'] * .45, ty + .6 * k, t1 - .05), 1.0 * k, .07, group='turret',
          gem='TeamGlow' if kind == 'tank' else None)
    if kind == 'tank':
        d('TeamGlow', 'turret').cyl(.12, .06, loc=(v['tw'] + .02, ty, (t0 + t1) / 2), rot=ACROSS, seg=8, bevel=0)
        d('Silver', 'turret').cyl(.15, .04, loc=(v['tw'] - .01, ty, (t0 + t1) / 2), rot=ACROSS, seg=8, bevel=0)
        for tip in ((.3, .55, t1 + .32), (.42, .4, t1 + .22), (.18, .72, t1 + .18)):
            crystal(d('TeamGlow', 'turret', flat=True), (.3, .55, t1 - .02), tip, .06)
    else:
        # No glow mesh on the Breaker's turret: its seer lens rides on the gun mantlet.
        d('TeamGlow', 'barrel').cyl(.09, .06, loc=(0, -.66, v['gun'] + .16), rot=FORWARD, seg=8, bevel=0)
        d('Silver', 'turret').cyl(.12, .05, loc=(0, -.6, v['gun'] + .16), rot=FORWARD, seg=8, bevel=0)


def ashfall_kite(d, kind):
    """Patched scrap kite: rust patches stitched on the sail, a spiked tail fin, a hazard band and a burner nozzle."""
    for loc, size, ang in (((.3, -.2, 1.04), (.36, .28), .4), ((-.28, .18, 1.04), (.3, .26), -.3), ((0, -.55, 1.04), (.22, .2), 0)):
        d('Rust').box((size[0], size[1], .02), loc=loc, rot=(0, 0, ang), bevel=0)
        d('Soot').box((size[0] * 1.05, .02, .025), loc=(loc[0], loc[1], loc[2] + .005), rot=(0, 0, ang + .7), bevel=0)
    d('Team').prism([(1.6, .44), (2.0, .62), (2.05, .3), (1.85, .38)], .03, loc=(0, 0, 0), axis='X', bevel=0)
    d('Hazard').cyl(.33, .08, loc=(0, .1, .6), rot=FORWARD, seg=10, bevel=0)
    d('Soot').cyl(.08, .2, loc=(0, .55, .58), rot=FORWARD, seg=6, bevel=0)
    for s in (-1, 1):
        spike(d('Soot'), (s * .78, -.05, 1.04), (s * 1.0, -.05, 1.0), .04, seg=4)


def sunward_kite(d, kind):
    """Caravan kite: a brass sun disc with cream rays on the sail, cream trailing edges, pennant streamers on the tail
    and turquoise beads on the side corners."""
    sun_wheel(d, (0, -.05, 1.06), .22, (0, 0, 1), spokes='Canvas', hub='Turquoise')
    for s in (-1, 1):
        d('Canvas').box((1.1, .07, .025), loc=(s * .41, .37, 1.045), rot=(0, 0, -s * .76), bevel=0)
        d('Turquoise').ico(.065, loc=(s * .82, -.05, .97), sub=0)
    for y, z in ((1.15, .42), (1.62, .41)):
        d('Team').prism([(y, z), (y + .32, z - .02), (y + .22, z - .08), (y + .32, z - .14), (y, z - .12)], .025,
                        loc=(0, 0, 0), axis='X', bevel=0)


def wardens_kite(d, kind):
    """Guardian kite: a smooth ceramic shell over the pod, a floating team halo round it and a seam ring."""
    d('Ceramic').sphere((.39, .5, .2), loc=(0, .06, .72), seg=10, rings=6, cut=0)
    halo(d('Team'), (0, .02, .62), .62, .03, seg=18, ring=3)
    d('Seam').box((.05, .7, .03), loc=(0, .08, .92), bevel=0)


def veil_kite(d, kind):
    """Moth-like kite: two folded charcoal hind fins with silver edges, a charcoal sail overlay, a crystal under the
    pod and a thin spire tail."""
    for s in (-1, 1):
        fin(d, (s * .1, .3, .98), (s * .1, .9, .9), (s * .95, .95, .86))
        d('Charcoal').prism([(0, -.86), (s * .7, -.08), (0, -.1)], .02, loc=(0, 0, 1.04), axis='Z', bevel=0)
    crystal(d('Team', flat=True), (0, -.05, .3), (0, -.12, .02), .09, seg=4)
    revolve(d('Charcoal'), [(.04, 0), (.02, .5), (0, .9)], loc=(0, .5, .62), rot=(-R, 0, 0), seg=5)


# ----------------------------------------------------------------------------- buildings
def wall_plate(d, mat, side, size, y, z, tilt=0.0, lean=.13, x=2.33, studs=True, r=.05):
    """A big riveted cladding plate on a side wall (side -1 left, +1 right), sloping with the wall."""
    loc, rot = (side * x, y, z), (0, side * (R - lean), tilt)
    st = ((size[0] * .38, size[1] * .4), (-size[0] * .38, -size[1] * .4), (size[0] * .38, -size[1] * .4)) if studs else ()
    plate(d, mat, (size[0], size[1], .06), loc, rot, bevel=.02, studs=st, r=r)


def arch_plates(d, mat, ys, angles=(38, 90, 142), r=1.98, cz=1.35, size=(1.0, .9), studs=False):
    """Welded plates round the Barracks arch: one per (y, angle), its face along the arch."""
    for y in ys:
        for a in angles:
            ang = math.radians(a)
            loc = (math.cos(ang) * r, y, cz + math.sin(ang) * r)
            rot = (0, R - ang, 0)
            plate(d, mat, (size[0], size[1], .05), loc, rot, bevel=0,
                  studs=((size[0] * .36, size[1] * .34), (-size[0] * .36, -size[1] * .34)) if studs and a == 90 else (), r=.045)


def side_awnings(d, half_x, half_y, z, depth=.7, drop=.28, cloth='Canvas', trim='Team', skip=(), tassels=2, steps=6, group='body'):
    """Cream canvas awnings sloping out from the four walls (a sunshade ring); `skip` names sides left bare."""
    sides = {
        'front': (half_x * 1.6, (0, -half_y - depth / 2, z), (-drop, 0, 0)),
        'back': (half_x * 1.6, (0, half_y + depth / 2, z), (drop, 0, 0)),
        'left': (half_y * 1.6, (-half_x - depth / 2, 0, z), (drop, 0, R)),
        'right': (half_y * 1.6, (half_x + depth / 2, 0, z), (-drop, 0, R)),
    }
    for side, (w, loc, rot) in sides.items():
        if side not in skip:
            canopy(d, w, depth, loc, rise=.06, rot=rot, poles=False, tassels=tassels, cloth=cloth, trim=trim, steps=steps, group=group)


def ashfall_building(d, kind):
    """Scrap yard architecture: big riveted rust cladding on the walls and roofs, black exhaust stacks with spiked
    crowns, a spiked roofline, hazard-striped door frames and spiked barricades."""
    soot = d('Soot')
    if kind == 'hq':
        for s in (-1, 1):
            stack(d, (s * 1.25, 2.35, 1.5), (s * 1.3, 2.5, 4.85), .19, crown=4, seg=8)
            wall_plate(d, 'Rust', s, (1.5, 2.0), 0, 1.38, tilt=.04 * s)
            wall_plate(d, 'Rust', s, (.8, .9), .75 * s, .98, tilt=-.2 * s, x=2.42, studs=False)
        stack(d, (0, 2.7, 1.5), (0, 2.85, 4.1), .15, crown=3, seg=8)
        for i in range(8):
            ang = math.pi / 8 + i * math.pi / 4
            x, y = math.cos(ang) * 2.05, math.sin(ang) * 1.88
            spike(soot, (x, y, 2.6), (x * 1.16, y * 1.16, 3.22), .12)
        stripes(d, (2.0, .06, .26), (0, -2.47, 2.12), (R, 0, 0), bars=5)
        for s in (-1, 1):
            stripes(d, (1.3, .06, .2), (s * 1.02, -2.43, 1.25), (R, R, 0), bars=3)
        for i in range(5):
            x = (i - 2) * .62
            spike(soot, (x, -2.75, .32), (x, -3.12, .85), .1, seg=4)
        plate(d, 'Rust', (1.5, 1.2, .06), (-.35, -.6, 3.6), (0, 0, .25), bevel=.02, studs=((.55, .45), (-.55, -.45)), r=.05)
    elif kind == 'barracks':
        arch_plates(d, 'Rust', (-1.0, .3, 1.5), studs=True, size=(1.05, .95))
        for i in range(6):
            y = -1.45 + i * .64
            spike(soot, (0, y, 3.24), (0, y + .14, 3.72), .1)
        stripes(d, (2.6, .06, .24), (0, -2.0, 2.52), (R, 0, 0), bars=5)
        for s in (-1, 1):
            stack(d, (s * 1.3, 2.15, .3), (s * 1.36, 2.3, 3.55), .14, crown=3, seg=8)
            spike(soot, (s * .9, -2.15, .32), (s * 1.0, -2.55, .82), .1, seg=4)
        spike(soot, (0, -2.15, .32), (0, -2.6, .82), .1, seg=4)
    elif kind == 'foundry':
        for s in (-1, 1):
            x, y = s * 1.35, 1.25
            for k_ in range(5):
                ang = k_ * math.tau / 5
                p = (x + math.cos(ang) * .38, y + math.sin(ang) * .38, 3.7)
                spike(soot, p, (x + math.cos(ang) * .7, y + math.sin(ang) * .7, 4.05), .08, seg=4)
            stripes(d, (.66, .06, .2), (x, y - .4, 3.15), (R, 0, 0), bars=2)
        stack(d, (0, 1.7, 2.5), (0, 1.8, 4.0), .2, crown=3, seg=8)
        wall_plate(d, 'Rust', 1, (1.7, 3.0), .25, 1.4, tilt=.03, lean=.03, x=2.17)
        wall_plate(d, 'Rust', -1, (1.2, 1.6), 1.4, 1.2, tilt=-.08, lean=.03, x=2.17, studs=False)
        for s in (-1, 1):
            plate(d, 'Rust', (.6, .06, 1.7), (s * 1.8, -1.6, 1.25), (0, 0, s * .06), bevel=.015)
        soot.tube([(.6, -1.6, 3.05), (.6, -1.6, 2.6), (.68, -1.62, 2.35), (.54, -1.62, 2.28)], .045, seg=5)
        d('Rust').box((.4, .3, .32), loc=(.6, -1.6, 2.1), rot=(.2, .3, .1), bevel=.02, seg=1)
        d('Team').box((2.9, .12, .26), loc=(0, -1.6, 3.48), bevel=.02, seg=1)
    elif kind == 'relay':
        stack(d, (1.05, 1.05, .3), (1.1, 1.15, 2.9), .12, crown=3, seg=6)
        for i in range(4):
            ang = math.pi / 4 + i * R
            plate(d, 'Rust', (.95, .55, .05), (math.cos(ang) * 1.18, math.sin(ang) * 1.18, .6), (0, R - .45, ang), bevel=.01,
                  studs=((.36, 0), (-.36, 0)), r=.04)
        for i in range(6):
            ang = i * math.tau / 6
            spike(soot, (math.cos(ang) * .62, math.sin(ang) * .62, 2.42), (math.cos(ang) * .95, math.sin(ang) * .95, 2.85), .07, seg=4)
        stripes(d, (1.4, .06, .16), (0, -1.0, .62), (R + .5, 0, 0), bars=3)
    elif kind == 'tower':
        for loc, rot in (((0, -.86, 1.3), (R + .14, 0, .1)), ((.86, 0, 1.15), (0, R + .14, -.1)), ((-.86, .05, 1.5), (0, -R - .14, .08))):
            plate(d, 'Rust', (.8, .75, .05), loc, rot, bevel=.01, studs=((.3, .26), (-.3, -.26)), r=.04)
        for i in range(6):
            ang = i * math.tau / 6
            spike(soot, (math.cos(ang) * .72, math.sin(ang) * .72, 3.05), (math.cos(ang) * 1.08, math.sin(ang) * 1.08, 3.25), .07, seg=4)
        for x in (-.3, 0, .3):
            spike(d('Soot', 'barrel'), (x, .1, 3.84), (x, .3, 4.02), .07, seg=4)
        plate(d, 'Rust', (.55, .06, .45), (-.62, -.25, 3.5), (0, 0, .5), group='barrel', bevel=.01)
        stripes(d, (.84, .05, .16), (0, .66, 3.55), (R, 0, 0), group='barrel', bars=2)


def sunward_building(d, kind):
    """Caravan architecture: cream canvas over the roofs and round the walls (team valances and tassels), brass domes,
    tall team banners, solar fans on masts, brass sun wheels and turquoise tiles."""
    if kind == 'hq':
        dome(d('Brass'), (0, .1, 3.7), .82, .66, seg=12)
        revolve(d('Brass'), [(.07, 0), (0, .4)], loc=(0, .1, 4.34), seg=6)
        side_awnings(d, 2.2, 2.0, 2.3, depth=.75, skip=('front',))
        canopy(d, 2.3, 1.0, (0, -2.78, 2.08), rise=.1, rot=(-.22, 0, 0), post=1.78, tassels=5)
        for s in (-1, 1):
            x, y = s * 2.55, -2.5
            d('Steel').limb((x, y, .3), (x, y, 4.55), .08, .08, bevel=0)
            d('Team').box((.62, .05, 1.9), loc=(x - s * .36, y, 3.5), bevel=0)
            d('Canvas').box((.62, .055, .22), loc=(x - s * .36, y, 2.66), bevel=0)
            d('Brass').box((.76, .08, .07), loc=(x - s * .36, y, 4.47), bevel=0)
            d('Turquoise').ico(.13, loc=(x, y, 4.66), sub=0)
            solar_fan(d, (s * 1.55, 1.55, 3.45), .5, normal=(0, .35, 1), mast=.62)
        for i in range(4):
            ang = i * math.tau / 4 + .4
            d('Turquoise').box((.34, .34, .08), loc=(math.cos(ang) * 2.0, math.sin(ang) * 1.85, 2.68), rot=(0, 0, ang), bevel=0)
    elif kind == 'barracks':
        for (y0, y1), cloth in zip(((-1.53, -.45), (-.25, .85), (1.05, 1.9)), ('Canvas', 'Turquoise', 'Canvas')):
            arch_band(d(cloth), y0, y1, 1.93, 1.98, drop=.35, steps=6)   # a striped caravan tent over the hangar
        canopy(d, 2.6, .9, (0, -2.25, 2.35), rise=.08, rot=(-.25, 0, 0), post=2.0, tassels=3)
        for y in (-.7, .9):
            dome(d('Brass'), (0, y, 3.43), .36, .32, seg=8, low=True)
        for s in (-1, 1):
            d('Steel').limb((s * .2, s * 1.75 + .15, 3.25), (s * .2, s * 1.75 + .15, 3.9), .045, .045, bevel=0)
        d('Canvas').limb((-.2, -1.6, 3.86), (.2, 1.9, 3.86), .02, .02, bevel=0)
        for i in range(5):
            y = -1.2 + i * .72
            d('Team').prism([(y - .15, 3.84), (y + .15, 3.84), (y, 3.56)], .02, loc=(0, 0, 0), axis='X', bevel=0)
        pennant(d, (2.15, -1.8, .3), 3.4, flag=.75)
    elif kind == 'foundry':
        canopy(d, 3.0, .9, (0, -2.0, 2.35), rise=.08, rot=(-.25, 0, 0), post=2.0, tassels=5)
        for s in (-1, 1):
            d('Canvas').box((1.5, 1.25, .05), loc=(-1.05, .3 + s * .55, 3.38), rot=(s * .5, 0, 0), bevel=0)
            d('Team').box((1.54, .06, .1), loc=(-1.05, .3 + s * 1.08, 3.08), bevel=0)
            d('Team').box((.62, .05, 1.25), loc=(s * 1.55, -1.6, 1.7), bevel=0)
            d('Brass').box((.78, .07, .07), loc=(s * 1.55, -1.63, 2.35), bevel=0)
            d('Brass').cyl(.42, .12, loc=(s * 1.35, 1.25, 3.4), seg=12, bevel=0)
        d('Brass').limb((-1.05, -.3, 3.0), (-1.05, -.3, 3.72), .05, .05, bevel=0)
        d('Brass').limb((-1.05, .9, 3.0), (-1.05, .9, 3.72), .05, .05, bevel=0)
        sun_wheel(d, (2.18, .3, 1.5), .55, (1, 0, 0))
        solar_fan(d, (.75, .1, 3.75), .55, normal=(0, -.3, 1), mast=.7)
        for i in range(5):
            d('Turquoise').box((.34, .1, .12), loc=(-1.6 + i * .8, -1.5, 2.62), bevel=0)
    elif kind == 'relay':
        solar_fan(d, (0, 0, 2.95), .78, normal=(0, 0, 1), blades=8)
        dome(d('Brass'), (0, 0, 2.43), .5, .3, seg=12)
        side_awnings(d, 1.12, 1.12, .95, depth=.42, drop=.3, skip=(), tassels=0, steps=4)
        for s in (-1, 1):
            pennant(d, (s * 1.25, -1.25, .3), 2.5, flag=.55)
        for i in range(3):
            ang = i * math.tau / 3 + .5
            d('Turquoise').ico(.1, loc=(math.cos(ang) * .58, math.sin(ang) * .58, 1.6), sub=0)
    elif kind == 'tower':
        canopy(d, 1.5, 1.3, (0, .05, 3.96), rise=.04, group='barrel', post=.12, tassels=3, steps=4)
        pennant(d, (.5, .5, 3.83), .2, flag=.3, group='barrel', bead=None)
        d('Brass').cyl(.84, .1, loc=(0, 0, 2.0), seg=12, bevel=0)
        side_awnings(d, .7, .7, 2.6, depth=.36, drop=.35, skip=(), tassels=0, steps=4)
        d('Turquoise').box((.3, .06, .3), loc=(0, -.74, 1.2), rot=(-.14, 0, 0), bevel=0)


def wardens_building(d, kind):
    """Guardian architecture: smooth white ceramic domes and shells over the roofs, one big lens eye, floating team
    halos and cyan glow seams."""
    cer, glow = d('Ceramic'), d('TeamGlow')
    if kind == 'hq':
        dome(cer, (0, .1, 2.62), 1.95, 1.55, seg=20)
        lens(d, (0, -1.55, 3.25), .36, normal=(0, -1, .55), seg=14)
        halo(d('Team'), (0, .1, 4.65), 1.2, .075, seg=24, ring=4)
        for i in range(4):
            ang = math.pi / 4 + i * R
            glow.box((.06, .06, .9), loc=(math.cos(ang) * 1.5, math.sin(ang) * 1.42 + .1, 3.1), rot=(0, 0, ang), bevel=0)
            glow.box((.08, .08, 1.0), loc=(math.cos(ang) * 2.45, math.sin(ang) * 2.25, 1.3), rot=(0, 0, ang), bevel=0)
        for s in (-1, 1):
            cer.sphere((.38, .9, .38), loc=(s * 2.62, .55, .95), seg=10, rings=6)
    elif kind == 'barracks':
        for y0, y1 in ((-1.53, -.45), (-.25, .85), (1.05, 1.9)):
            arch_band(cer, y0, y1, 1.92, 1.96, drop=.25)
            glow.box((.06, y1 - y0 - .1, .06), loc=(0, (y0 + y1) / 2, 3.33), bevel=0)
        lens(d, (0, -1.85, 2.75), .24, normal=(0, -1, .2))
        halo(d('Team'), (0, .2, 3.72), .95, .055, seg=20, ring=3)
    elif kind == 'foundry':
        for y0 in (-1.4, -.2, 1.0):
            plate(d, 'Ceramic', (4.0, .85, .06), (0, y0 + .5, 2.82), (.47, 0, 0), bevel=.03)
            glow.box((3.8, .05, .05), loc=(0, y0 + .06, 3.08), bevel=0)
        for s in (-1, 1):
            x, y = s * 1.35, 1.25
            revolve(cer, [(.47, 0), (.48, .3), (.45, .62), (.41, .8)], loc=(x, y, 2.95), seg=14)
            halo(d('Team'), (x, y, 4.2), .52, .045, seg=16, ring=3)
        lens(d, (0, -1.62, 2.75), .26, normal=(0, -1, .1))
    elif kind == 'relay':
        for z, tilt in ((1.35, (.28, 0, 0)), (1.95, (-.22, .2, 0))):
            halo(d('Team'), (0, 0, z), .9, .045, rot=tilt, seg=20, ring=3)
        dome(cer, (0, 0, 2.3), .74, .42, seg=14)
        dome(cer, (0, 0, .3), 1.35, .66, seg=14)
        lens(d, (0, -1.22, .78), .17, normal=(0, -1, .6))
        for i in range(4):
            ang = math.pi / 4 + i * R
            glow.box((.05, .05, .55), loc=(math.cos(ang) * 1.02, math.sin(ang) * 1.02, .62), bevel=0)
    elif kind == 'tower':
        d('Ceramic', 'barrel').sphere((.68, .64, .2), loc=(0, .03, 3.8), seg=12, rings=6, cut=0)
        d('Steel', 'barrel').cyl(.21, .06, loc=(0, -.58, 3.66), rot=FORWARD, seg=12, bevel=0)
        d('Seam', 'barrel').cyl(.16, .08, loc=(0, -.6, 3.66), rot=FORWARD, seg=12, bevel=0)
        halo(d('Team'), (0, 0, 2.45), 1.02, .05, seg=20, ring=3)
        revolve(cer, [(.86, 0), (.84, .14), (.74, .28)], loc=(0, 0, 2.62), seg=12)
        for i in range(4):
            ang = math.pi / 4 + i * R
            glow.box((.05, .05, 1.1), loc=(math.cos(ang) * .62, math.sin(ang) * .62, 1.3), bevel=0)


def veil_building(d, kind):
    """Seer architecture: charcoal drapes over roofs and doors with silver hems, thin spires with glowing crystal tips,
    crystal clusters, folded fins and a seer lens."""
    glow = d('TeamGlow')
    shards = d('TeamGlow', flat=True)
    char = d('Charcoal')
    if kind == 'hq':
        for sx in (-1, 1):
            for sy in (-1, 1):
                spire(d, (sx * 2.02, sy * 1.82, 2.0), 2.9, .15, gem=None)
        spire(d, (0, .1, 3.7), 1.55, .17, gem='TeamGlow')
        for i in range(4):
            ang = i * R
            c, s_ = math.cos(ang), math.sin(ang)
            fin(d, (c * 1.55 - s_ * .9, .1 + s_ * 1.45 + c * .9, 3.62), (c * 1.55 + s_ * .9, .1 + s_ * 1.45 - c * .9, 3.62),
                (c * .25, .1 + s_ * .25, 4.45), mat='Charcoal', edge='Silver', thick=.05)
        for i in range(5):
            ang = i * math.tau / 5 + .3
            crystal(shards, (math.cos(ang) * .5, .1 + math.sin(ang) * .5, 3.68),
                    (math.cos(ang) * .95, .1 + math.sin(ang) * .95, 4.35 + .12 * (i % 2)), .15)
        for s in (-1, 1):
            fin(d, (s * 2.3, -1.2, .5), (s * 2.3, .6, .5), (s * 2.75, 1.05, 2.25))
        char.box((1.6, .08, 1.4), loc=(0, -2.3, 1.2), rot=(.06, 0, 0), bevel=.02, seg=1, taper=(1.12, 1))
        d('Silver').box((1.7, .1, .06), loc=(0, -2.34, .52), bevel=0)
        glow.cyl(.28, .06, loc=(0, -1.72, 3.2), rot=axis_rot((0, -1, .3)), seg=12, bevel=0)
        d('Silver').cyl(.36, .05, loc=(0, -1.69, 3.19), rot=axis_rot((0, -1, .3)), seg=12, bevel=0)
    elif kind == 'barracks':
        for y0, y1 in ((-1.53, -.45), (-.25, .85), (1.05, 1.9)):
            arch_band(char, y0, y1, 1.93, 1.98, drop=.75)
            for s in (-1, 1):
                d('Silver').box((.05, y1 - y0, .05), loc=(s * 1.99, (y0 + y1) / 2, .62), bevel=0)
        for s in (-1, 1):
            spire(d, (s * 2.05, -2.05, .3), 2.9, .13, gem='TeamGlow')
        for i in range(4):
            y = -1.2 + i * .9
            crystal(shards, (0, y, 3.2), (.18 * (1 if i % 2 else -1), y + .12, 3.75), .14)
        char.box((2.3, .08, 1.5), loc=(0, -1.92, 1.1), bevel=.02, seg=1, taper=(1.1, 1))
        d('Silver').box((2.4, .1, .06), loc=(0, -1.96, .38), bevel=0)
        glow.cyl(.22, .06, loc=(0, -1.95, 2.75), rot=FORWARD, seg=10, bevel=0)
        d('Silver').cyl(.28, .05, loc=(0, -1.92, 2.75), rot=FORWARD, seg=10, bevel=0)
    elif kind == 'foundry':
        for y0 in (-1.4, -.2, 1.0):
            char.box((4.05, .88, .05), loc=(0, y0 + .52, 2.84), rot=(.47, 0, 0), bevel=0)
            d('Silver').box((4.05, .05, .05), loc=(0, y0 + .1, 3.07), bevel=0)
        for s in (-1, 1):
            spire(d, (s * 2.0, 1.25, 2.5), 1.85, .13, gem='TeamGlow')
            fin(d, (s * 2.1, -1.2, .5), (s * 2.1, .6, .5), (s * 2.5, 1.05, 2.1))
        for i in range(5):
            ang = i * math.tau / 5
            crystal(shards, (math.cos(ang) * .3, -.2 + math.sin(ang) * .3, 3.1), (math.cos(ang) * .65, -.2 + math.sin(ang) * .65, 3.78), .14)
        char.box((2.7, .08, 1.6), loc=(0, -1.7, 1.15), bevel=.02, seg=1, taper=(1.08, 1))
        d('Silver').box((2.8, .1, .06), loc=(0, -1.74, .38), bevel=0)
        glow.cyl(.22, .06, loc=(0, -1.6, 2.62), rot=FORWARD, seg=10, bevel=0)
    elif kind == 'relay':
        for i in range(6):
            ang = i * math.tau / 6
            crystal(shards, (math.cos(ang) * .25, math.sin(ang) * .25, 2.42), (math.cos(ang) * .62, math.sin(ang) * .62, 3.15 + .15 * (i % 2)), .12)
        for s in (-1, 1):
            spire(d, (s * 1.18, s * 1.18, .3), 2.6, .11, gem=None)
        for i in range(4):
            ang = i * R
            c, sn = math.cos(ang), math.sin(ang)
            fin(d, (c * 1.2 - sn * .45, sn * 1.2 + c * .45, .3), (c * 1.2 + sn * .45, sn * 1.2 - c * .45, .3), (c * 1.5, sn * 1.5, 1.45))
        revolve(char, [(1.25, 0), (1.12, .3), (.7, .62)], loc=(0, 0, .32), seg=8)
    elif kind == 'tower':
        for x in (-.16, 0, .16):
            revolve(d('Charcoal', 'barrel'), [(.08, 0), (0, .2 - abs(x) * .4)], loc=(x, .3, 3.86), seg=4)
        for s in (-1, 1):
            d('Charcoal', 'barrel').box((.44, .55, .06), loc=(s * .2, -.42, 3.86), rot=(.15, s * .45, 0), bevel=.01, seg=1, taper=(.6, 1))
        for i in range(3):
            ang = i * math.tau / 3 + .4
            crystal(shards, (math.cos(ang) * .6, math.sin(ang) * .6, 2.75), (math.cos(ang) * 1.0, math.sin(ang) * 1.0, 3.3), .1)
        for i in range(4):
            ang = math.pi / 4 + i * R
            c, sn = math.cos(ang), math.sin(ang)
            fin(d, (c * .7, sn * .7, .4), (c * .62, sn * .62, 1.7), (c * 1.2, sn * 1.2, .5))
        revolve(char, [(.92, 0), (.86, .18), (.62, .36)], loc=(0, 0, 2.42), seg=8)


BUILDERS = {
    'ashfall': (ashfall_infantry, ashfall_vehicle, ashfall_kite, ashfall_building),
    'sunward': (sunward_infantry, sunward_vehicle, sunward_kite, sunward_building),
    'wardens': (wardens_infantry, wardens_vehicle, wardens_kite, wardens_building),
    'veil': (veil_infantry, veil_vehicle, veil_kite, veil_building),
}


def dress_builder(faction, kind):
    infantry, vehicle, kite, building = BUILDERS[faction]
    return infantry if kind in INFANTRY else kite if kind == 'kite' else vehicle if kind in VEHICLES else building


# ----------------------------------------------------------------------------- pipeline
def base_triangles():
    data = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    return {e['name']: e['triangles'] for e in data['assets'] if e['name'] in TYPES}


def count(shapes):
    return sum(len(f.verts) - 2 for s in shapes for f in s.bm.faces)


def canonical(a):
    """Put every part's BMesh (base and dress) in a canonical vertex / edge / face order. Blender's bevel operator
    emits its new geometry in pointer-hash order, so without this the AO bake (a BVH over all parts) broke ties on
    touching faces differently from run to run, and the export was not byte-identical."""
    def by(seq, key):   # BMElemSeq.sort wants a number: rank the elements first
        rank = {e: i for i, e in enumerate(sorted(seq, key=key))}
        seq.sort(key=lambda e: rank[e])
        seq.index_update()

    for shape in a.shapes.values():
        bm = shape.bm
        # The bevel's float results also differ in the last bits between runs: snap to 0.01 mm first.
        for v in bm.verts:
            v.co = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
        by(bm.verts, lambda v: (v.co.x, v.co.y, v.co.z, v.index))
        # Every face starts at its lowest vertex (same winding): the exporter splits a square quad along the
        # diagonal its first loop picks.
        for f in list(bm.faces):
            vs = list(f.verts)
            k = min(range(len(vs)), key=lambda i: vs[i].index)
            if k:
                bm.faces.remove(f)
                bm.faces.new(vs[k:] + vs[:k])
        by(bm.edges, lambda e: tuple(sorted(v.index for v in e.verts)))
        by(bm.faces, lambda f: (tuple(sorted(v.index for v in f.verts)), tuple(v.index for v in f.verts)))
        bm.normal_update()   # new faces have no normal yet (finish() reads them to mark sharp edges)


def build_model(faction, kind, root):
    """The base model with the faction's dress on it; returns the Asset and the dress part keys."""
    flyer = kind == 'kite'
    if flyer:
        a = Asset(kind, root, ao_distance=.5, grime_height=.45, ao_samples=40, ground=False)
        air.BUILDERS[kind](a)
    else:
        infantry_unit = kind in shared.GRIPS
        unit = kind in shared.UNITS
        a = Asset(kind, root, ao_distance=.7 if infantry_unit else .5 if unit else 1.6, grime_height=.45 if unit else .9)
        shared.BUILDERS[kind](a)
    base = set(a.shapes)
    dress_builder(faction, kind)(Dress(a, kind), kind)
    return a, [k for k in a.order if k not in base]


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return [round(min(p[i] for p in pts), 3) for i in range(3)], [round(max(p[i] for p in pts), 3) for i in range(3)]


def compact_glb(path):
    """Rewrite the exported dress GLB small and simple (deterministic, pure Python):
      * every own-colour part of a (model, group) becomes one `Dress` primitive whose COLOR_0 is its final colour
        (the part material's colour x the baked AO), so a group carries at most Team, TeamGlow and Dress;
      * NORMAL as int8 (KHR_mesh_quantization, read natively by three's GLTFLoader), COLOR_0 as normalized uint8,
        POSITION stays float. Node `dress_<type>` roots keep their mesh children named `<type>__<group>__<class>`."""
    raw = path.read_bytes()
    jlen = struct.unpack_from('<I', raw, 12)[0]
    src = json.loads(raw[20:20 + jlen])
    blen = struct.unpack_from('<I', raw, 20 + jlen)[0]
    blob = raw[28 + jlen:28 + jlen + blen]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def read(index):
        acc = src['accessors'][index]
        view = src['bufferViews'][acc['bufferView']]
        n, f = width[acc['type']], fmt[acc['componentType']]
        stride = view.get('byteStride', struct.calcsize(f) * n)
        start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        scale = 255.0 if f == 'B' and acc.get('normalized') else 65535.0 if f == 'H' and acc.get('normalized') else None
        rows = [struct.unpack_from('<' + f * n, blob, start + i * stride) for i in range(acc['count'])]
        return [tuple(v / scale for v in row) for row in rows] if scale else rows

    mats = src['materials']
    groups = {}   # (type, group, class) -> [positions, normals, colours, indices]

    def matrix(node):
        if 'matrix' in node:
            m = node['matrix']
            return Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]).transposed()
        t = Matrix.Translation(node.get('translation', (0, 0, 0)))
        x, y, z, w = node.get('rotation', (0, 0, 0, 1))
        s = node.get('scale', (1, 1, 1))
        return t @ Quaternion((w, x, y, z)).to_matrix().to_4x4() @ Matrix.Diagonal((*s, 1))

    def meshes_under(index, parent):
        node = src['nodes'][index]
        world = parent @ matrix(node)
        if 'mesh' in node:
            yield node, world
        for child in node.get('children', []):
            yield from meshes_under(child, world)

    for root in src['scenes'][src.get('scene', 0)]['nodes']:
        holder = src['nodes'][root]
        kind = holder['name'][len('dress_'):]
        for node, world in meshes_under(root, Matrix.Identity(4)):
            _, group, *_ = node['name'].split('__')
            normal_m = world.to_3x3().inverted().transposed()
            for prim in src['meshes'][node['mesh']]['primitives']:
                mat = mats[prim['material']]
                cls = mat['name'] if mat['name'] in ('Team', 'TeamGlow') else 'Dress'
                tint = mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
                pos = [tuple(world @ Vector(p)) for p in read(prim['attributes']['POSITION'])]
                nor = [tuple((normal_m @ Vector(n)).normalized()) for n in read(prim['attributes']['NORMAL'])]
                col = read(prim['attributes']['COLOR_0'])
                idx = [i[0] for i in read(prim['indices'])]
                g = groups.setdefault((kind, group, cls), [[], [], [], []])
                base = len(g[0])
                g[0] += pos
                g[1] += nor
                g[2] += [tuple(c[k] * (tint[k] if cls == 'Dress' else 1) for k in range(3)) for c in col]
                g[3] += [i + base for i in idx]
    out = bytearray()
    views, accessors, meshes, nodes, roots = [], [], [], [], []

    def add(data, target, stride=None):
        while len(out) % 4:
            out.append(0)
        view = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data), 'target': target}
        if stride:
            view['byteStride'] = stride
        out.extend(data)
        views.append(view)
        return len(views) - 1

    keep = {m['name']: m for m in mats if m['name'] in ('Team', 'TeamGlow')}
    materials = [keep[n] for n in ('Team', 'TeamGlow') if n in keep]
    materials.append({'name': 'Dress', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': .25,
                                                                 'roughnessFactor': .42}})
    slot = {m['name']: i for i, m in enumerate(materials)}
    by_kind = {}
    for (kind, group, cls) in sorted(groups):
        pos, nor, col, idx = groups[(kind, group, cls)]
        # Canonical order: the exporter's vertex order is not stable from run to run (the geometry is), so vertices
        # are sorted by their stored values and triangles by their (rotated) indices; the file is byte-identical.
        pos = [struct.unpack('<3f', struct.pack('<3f', *v)) for v in pos]
        nor = [tuple(max(-127, min(127, round(c * 127))) / 127 for c in v) for v in nor]
        col = [tuple(max(0, min(255, round(c * 255))) / 255 for c in v) for v in col]
        # (Identical vertices are welded, or their tie order would leak into the indices.)
        unique = sorted({(pos[i], nor[i], col[i]) for i in range(len(pos))})
        slot_of = {rec: n for n, rec in enumerate(unique)}
        where = {i: slot_of[(pos[i], nor[i], col[i])] for i in range(len(pos))}
        pos, nor, col = [r[0] for r in unique], [r[1] for r in unique], [r[2] for r in unique]
        tris = []
        for t in range(0, len(idx), 3):
            a_, b_, c_ = (where[i] for i in idx[t:t + 3])
            while a_ != min(a_, b_, c_):
                a_, b_, c_ = b_, c_, a_
            tris.append((a_, b_, c_))
        idx = [i for tri in sorted(tris) for i in tri]
        p = add(b''.join(struct.pack('<3f', *v) for v in pos), 34962)
        lo = [min(v[i] for v in pos) for i in range(3)]
        hi = [max(v[i] for v in pos) for i in range(3)]
        accessors.append({'bufferView': p, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': lo, 'max': hi})
        nv = add(b''.join(struct.pack('<3bx', *(max(-127, min(127, round(c * 127))) for c in v)) for v in nor), 34962, stride=4)
        accessors.append({'bufferView': nv, 'componentType': 5120, 'normalized': True, 'count': len(nor), 'type': 'VEC3'})
        cv = add(b''.join(struct.pack('<4B', *(max(0, min(255, round(c * 255))) for c in v), 255) for v in col), 34962)
        accessors.append({'bufferView': cv, 'componentType': 5121, 'normalized': True, 'count': len(col), 'type': 'VEC4'})
        iv = add(b''.join(struct.pack('<H', i) for i in idx), 34963)
        accessors.append({'bufferView': iv, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'})
        a0 = len(accessors) - 4
        meshes.append({'name': f'{kind}__{group}__{cls}', 'primitives': [{'attributes': {'POSITION': a0, 'NORMAL': a0 + 1,
                       'COLOR_0': a0 + 2}, 'indices': a0 + 3, 'material': slot[cls]}]})
        nodes.append({'name': f'{kind}__{group}__{cls}', 'mesh': len(meshes) - 1})
        by_kind.setdefault(kind, []).append(len(nodes) - 1)
    for kind in [k for k in TYPES if k in by_kind]:
        nodes.append({'name': f'dress_{kind}', 'children': by_kind[kind]})
        roots.append(len(nodes) - 1)
    while len(out) % 4:
        out.append(0)
    doc = {'asset': {'generator': 'Frontier Command generate_dress.py (frontier_kit export, compacted)', 'version': '2.0'},
           'extensionsUsed': ['KHR_mesh_quantization', 'KHR_materials_emissive_strength'],
           'extensionsRequired': ['KHR_mesh_quantization'], 'scene': 0, 'scenes': [{'nodes': roots}], 'nodes': nodes,
           'meshes': meshes, 'materials': materials, 'accessors': accessors, 'bufferViews': views,
           'buffers': [{'byteLength': len(out)}]}
    text = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    text += b' ' * (-len(text) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(out))
    glb += struct.pack('<II', len(text), 0x4E4F534A) + text + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
    path.write_bytes(glb)


def build_faction(faction, budgets, report_parts=False):
    root = kit.workspace('FrontierDress')
    kit.clear_workspace(root)
    out = bpy.data.collections.new(f'frontier_dress_{faction}')
    root.children.link(out)
    report = {}
    for kind in TYPES:
        a, keys = build_model(faction, kind, root)
        tris = count(a.shapes[k] for k in keys)
        if report_parts or tris > budgets[kind]:
            for k in keys:
                print(f'DRESS_PART {faction} {kind} {count([a.shapes[k]]):5d} {k[0]} ({k[1]})', flush=True)
        if tris > budgets[kind]:
            raise RuntimeError(f'{faction} {kind}: {tris} triangles > {budgets[kind]}')
        canonical(a)
        a.finish()
        base_objs = [o for o in a.objects if (o.name, o.data.materials[0].name) not in {(k[0], k[1]) for k in keys}]
        dress_objs = [o for o in a.objects if o not in base_objs]
        base_box, dressed_box = bounds(base_objs), bounds(a.objects)
        holder = bpy.data.objects.new(f'dress_{kind}', None)
        out.objects.link(holder)
        for o in dress_objs:
            a.collection.objects.unlink(o)
            out.objects.link(o)
            o.parent = holder
        groups = sorted({k[0].split('__')[1] for k in keys})
        report[kind] = dict(triangles=tris, budget=budgets[kind], groups=groups,
                            base_size=[round(h - l, 2) for l, h in zip(*base_box)],
                            dressed_size=[round(h - l, 2) for l, h in zip(*dressed_box)])
        print('DRESS_MODEL', faction, kind, tris, budgets[kind], json.dumps(report[kind]), flush=True)
        kit.clear_workspace(root, keep=(out.name,))
    path = OUT / f'dress-{faction}.glb'
    kit.export_collection(out, path, texcoords=False)
    compact_glb(path)
    total = sum(r['triangles'] for r in report.values())
    print('DRESS_FILE', faction, path.stat().st_size, total, flush=True)
    kit.clear_workspace(root)
    return {'name': f'dress-{faction}', 'file': path.name, 'faction': faction, 'triangles': total,
            'bytes': path.stat().st_size, 'types': {k: r['triangles'] for k, r in report.items()},
            'budgets': {k: r['budget'] for k, r in report.items()}, 'review': REVIEW,
            'sizes': {k: {'base': r['base_size'], 'dressed': r['dressed_size']} for k, r in report.items()}}


def build_all(factions=None, manifest=False, report_parts=False):
    base = base_triangles()
    budgets = {k: int(base[k] * SHARE) for k in TYPES}
    entries = [build_faction(f, budgets, report_parts) for f in factions or FACTIONS]
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        fresh = {e['name']: {k: v for k, v in e.items() if k != 'sizes'} for e in entries}
        data['dress'] = [fresh.pop(e['name'], e) for e in data.get('dress', [])] + list(fresh.values())
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(data, indent=2) + '\n')
    print('DRESS_REPORT', json.dumps(entries), flush=True)
    return entries


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_all([a for a in args if a in FACTIONS] or None, manifest='--manifest' in args, report_parts='--report' in args)
