"""Air unit models (release 0.18 "Wings", item 18.2). Headless Blender 4.5; no external assets.

  blender -b --python tools/blender/generate_air.py -- [--manifest] [--blend <file.blend>]

Writes public/models/{kite,hawk,balloon,glider}.glb. The game manifests are left alone unless
--manifest is given (the rules package registers air units and their portraits).

Runtime contract for flyers, on top of the one in frontier_kit.py:
  * Authored on the ground: the lowest point sits at z = 0 and the origin is the footprint
    centre, so the view adds the fly height (and the blob shadow stays on the terrain).
    Baked AO ignores the ground plane (Asset(ground=False)): undersides are lit like a flyer.
  * `hover` empty at the origin, like the Wardens drone: the view's existing bob applies.
  * `spin_*` empties are hinge pivots. Their child meshes turn about the empty's local up
    axis (Blender Z = three.js +Y) for rotors and fans, or the fore-aft axis (Blender Y =
    three.js Z after the glTF axis change; models face three.js +Z) for the glider's pusher
    propeller; see SPIN below.
  * `flicker_flame` (balloon) sits at the burner nozzle; scale it on its local up axis.
  * Barrel*/Muzzle* parts form the aim/recoil rig exactly as on ground vehicles.
  * Team-coloured parts use the Team / TeamGlow materials; Flame keeps its own orange.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y
ACROSS = (0, R90, 0)    # cylinder axis along X
BUDGET = 1500
BUDGETS = {'balloon': 2500}  # the Ember balloon carries a gored envelope, rigging and a basket

# name: (faction that builds it, short role)
CATALOG = {
    'kite': ('all', 'Kite scout: unarmed spotter drone-kite'),
    'hawk': ('meridian', 'Hawk gunship: twin ducted fans, side guns'),
    'balloon': ('ashfall', 'Ember balloon: patched hot-air bomber'),
    'glider': ('sunward', 'Swift glider: fabric-wing raider'),
}
# Spinning pivots per model and the Blender axis they turn about.
SPIN = {
    'kite': {'spin_rotor_L': 'Z', 'spin_rotor_R': 'Z'},
    'hawk': {'spin_fan_L': 'Z', 'spin_fan_R': 'Z'},
    'balloon': {},
    'glider': {'spin_prop': 'Y'},
}


# ----------------------------------------------------------------------------- helpers
def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.03, parent=None, taper=(1, 1)):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=1, taper=taper)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12, r2=None, bevel=.015, parent=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, r2=r2, bevel=bevel, bseg=1)


def beam(a, name, mat, start, end, width=.06, parent=None):
    return a.part(name, mat, parent).limb(start, end, width, width, bevel=0, seg=1)


def ellipsoid_point(centre, radii, az, el, lift=0.0):
    """Point and outward normal on an ellipsoid at azimuth/elevation (radians)."""
    rx, ry, rz = radii
    ce, se, ca, sa = math.cos(el), math.sin(el), math.cos(az), math.sin(az)
    n = Vector((ce * ca / rx, ce * sa / ry, se / rz)).normalized()
    p = Vector(centre) + Vector((rx * ce * ca, ry * ce * sa, rz * se)) + n * lift
    return p, n


def patch(a, name, mat, centre, radii, az, el, size, spin=0.0):
    """A flat scrap patch lying on an ellipsoid surface."""
    p, n = ellipsoid_point(centre, radii, az, el, lift=size[2] * .2)
    q = n.to_track_quat('Z', 'Y')
    rot = (q.to_matrix().to_4x4() @ Matrix.Rotation(spin, 4, 'Z')).to_euler('XYZ')
    box(a, name, mat, size, tuple(p), rot=tuple(rot), bevel=0)


def belt(a, name, mat, r, z, height=.06, seg=16, r2=None, parent=None, at=(0, 0)):
    """An open ribbon around the Z axis (a hoop, strap or load tape): two triangles per segment."""
    bm = a.part(name, mat, parent).bm
    r2 = r if r2 is None else r2
    lo = [bm.verts.new((at[0] + r * math.cos(k * math.tau / seg), at[1] + r * math.sin(k * math.tau / seg), z - height / 2)) for k in range(seg)]
    hi = [bm.verts.new((at[0] + r2 * math.cos(k * math.tau / seg), at[1] + r2 * math.sin(k * math.tau / seg), z + height / 2)) for k in range(seg)]
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new((lo[k], lo[j], hi[j], hi[k]))


def rotor(a, pivot, count, length, chord, mat='Steel', hub=.07, pitch=.16):
    """Horizontal rotor centred on its pivot (origin at the hinge)."""
    for i in range(count):
        ang = i * math.pi / count  # each blade spans both sides of the hub
        box(a, 'Rotor_blades', mat, (length, chord, .028), (0, 0, 0), rot=(pitch, 0, ang), bevel=0, parent=pivot)
    cyl(a, 'Rotor_hub', 'Undercarriage', hub, .08, (0, 0, .02), seg=8, bevel=0, parent=pivot)


# ----------------------------------------------------------------------------- models
def kite(a):
    """Small recon drone-kite: a diamond sail, an egg pod with one big lens, twin tip rotors."""
    a.pivot('hover', (0, 0, 0))
    a.part('Pod', 'Armor').sphere((.36, .5, .32), loc=(0, .02, .6), seg=12, rings=8)
    # Diamond kite sail over the pod, with steel spars: the silhouette from above.
    a.part('Sail', 'Team').prism([(0, -.9), (.82, -.05), (0, .78), (-.82, -.05)], .06, loc=(0, 0, 1.0),
                                 axis='Z', bevel=.02, seg=1)
    beam(a, 'Spars', 'Steel', (-.86, -.05, 1.04), (.86, -.05, 1.04), .045)
    beam(a, 'Spars', 'Steel', (0, -.94, 1.04), (0, .82, 1.04), .045)
    beam(a, 'Mast', 'Steel', (0, -.1, .86), (0, -.1, .98), .07)
    box(a, 'Sail_stripe', 'Hazard', (.12, .5, .02), (0, .4, 1.04), bevel=0)
    # R3-W: warm Hazard edging on the two leading edges, so the diamond reads from above at a glance.
    for s in (-1, 1):
        ang = math.atan2(.85, .82)
        box(a, 'Sail_edge', 'Hazard', (1.12, .09, .025), (s * .41, -.48, 1.045), rot=(0, 0, s * ang), bevel=0)
    # Spotter eye: lens barrel, dark glass and a glowing pupil on the pod's nose.
    cyl(a, 'Lens_barrel', 'Steel', .2, .2, (0, -.44, .62), rot=FORWARD, seg=12)
    cyl(a, 'Lens_glass', 'Glass', .15, .06, (0, -.56, .62), rot=FORWARD, seg=12, bevel=.01)
    cyl(a, 'Lens_eye', 'TeamGlow', .075, .04, (0, -.6, .62), rot=FORWARD, seg=10, bevel=0)
    box(a, 'Lens_hood', 'Armor', (.36, .2, .06), (0, -.47, .83), rot=(-.25, 0, 0), bevel=.015)
    # Tip rotors on short pylons at the sail's side corners.
    for s, side in ((-1, 'L'), (1, 'R')):
        x = s * .82
        cyl(a, 'Rotor_pylons', 'Undercarriage', .07, .16, (x, -.05, 1.1), seg=8, bevel=.01)
        p = a.pivot(f'spin_rotor_{side}', (x, -.05, 1.2))
        rotor(a, p, 2, .74, .1)
        box(a, 'Tip_lights', 'TeamGlow', (.08, .08, .04), (x, -.05, .96), bevel=0)
    # Kite tail with two bows, and light landing skids.
    a.part('Tail_line', 'Undercarriage').tube([(0, .5, .62), (0, .85, .5), (0, 1.15, .42), (0, 1.45, .4), (0, 1.85, .44)], .02, seg=5)
    for y, z in ((.95, .47), (1.38, .4), (1.8, .44)):
        a.part('Tail_bows', 'Team').prism([(-.18, -.06), (.18, .06), (.18, -.06), (-.18, .06)], .03, loc=(0, y, z),
                                          axis='Z', bevel=0)
    for s in (-1, 1):
        beam(a, 'Skids', 'Undercarriage', (s * .18, -.1, .36), (s * .26, -.12, .04), .045)
        beam(a, 'Skids', 'Undercarriage', (s * .18, .18, .36), (s * .26, .2, .04), .045)
        beam(a, 'Skids', 'Steel', (s * .26, -.3, .025), (s * .26, .36, .025), .05)


    # Round 5 detail pass: an inset seam outline and glowing corner beacons on the sail, a seam hoop on the
    # pod, an iris and bolts on the lens, a belly sensor dome between the skids and a tail beacon.
    pts = [(0, -.62), (.54, -.04), (0, .52), (-.54, -.04)]
    for p0, p1 in zip(pts, pts[1:] + pts[:1]):
        beam(a, 'Sail_seams', 'Steel', (p0[0], p0[1], 1.05), (p1[0], p1[1], 1.05), .028)
    for p0 in ((0, -.88), (0, .76)):
        box(a, 'Sail_beacons', 'TeamGlow', (.1, .1, .04), (p0[0], p0[1], 1.05), bevel=0)
    a.part('Pod_seam', 'Steel').torus(.32, .016, loc=(0, .2, .6), rot=(R90, 0, 0), seg=16, ring=3)
    a.part('Lens_iris', 'Steel').torus(.1, .015, loc=(0, -.585, .62), rot=(R90, 0, 0), seg=12, ring=3)
    for k in range(4):
        ang = math.pi / 4 + k * R90
        box(a, 'Lens_bolts', 'Steel', (.045, .06, .045), (math.cos(ang) * .185, -.55, .62 + math.sin(ang) * .185), bevel=0)
    a.part('Belly_dome', 'Glass').sphere(.12, loc=(0, -.02, .36), seg=8, rings=4)
    box(a, 'Tail_beacon', 'TeamGlow', (.08, .08, .06), (0, 1.9, .46), bevel=0)


def hawk(a):
    """Meridian gunship: armoured fuselage, glass nose, twin ducted lift fans, two gun pods."""
    a.pivot('hover', (0, 0, 0))
    # Fuselage side profile (y, z), extruded across X. Front is -Y.
    a.part('Fuselage', 'Team').prism(
        [(-1.45, .78), (-1.25, .52), (.9, .5), (1.2, .78), (1.2, 1.06), (.55, 1.32), (-.55, 1.36), (-1.1, 1.14)],
        1.0, bevel=.06, seg=1)
    box(a, 'Belly', 'Armor', (.86, 2.1, .16), (0, -.15, .47), bevel=.03)
    box(a, 'Canopy', 'Glass', (.74, .8, .3), (0, -.82, 1.2), rot=(-.32, 0, 0), bevel=.06, taper=(.82, .7))
    box(a, 'Spine', 'Armor', (.5, 1.1, .16), (0, .25, 1.38), bevel=.03, taper=(.8, .9))
    a.part('Exhaust', 'Undercarriage').grille(.42, .2, loc=(0, 1.22, .92), rot=(0, 0, math.pi), slats=3, depth=.05,
                                              thickness=.04)
    # Tail boom, fin and stabiliser.
    box(a, 'Tail_boom', 'Armor', (.34, 1.25, .28), (0, 1.75, 1.02), bevel=.04, taper=(.75, 1))
    a.part('Tail_fin', 'Team').prism([(2.0, 1.05), (2.45, 1.05), (2.55, 1.7), (2.3, 1.72)], .09, bevel=.02, seg=1)
    box(a, 'Stabiliser', 'Steel', (1.2, .3, .06), (0, 2.25, 1.05), bevel=.015, taper=(.85, 1))
    # R3-W: team end plates on the stabiliser and a dorsal intake: a twin-tail gunship silhouette.
    for s in (-1, 1):
        box(a, 'Tail_plates', 'Team', (.05, .34, .36), (s * .6, 2.27, 1.16), bevel=0)
    box(a, 'Intake', 'Armor', (.36, .42, .18), (0, -.2, 1.42), bevel=0, taper=(.8, .7))
    box(a, 'Tail_light', 'TeamGlow', (.06, .1, .08), (0, 2.5, 1.62), bevel=0)
    # Stub wings carry the fans; duct rings are team paint so the pair reads from above.
    box(a, 'Stub_wings', 'Armor', (2.4, .55, .13), (0, -.05, .98), bevel=.035, taper=(1, .85))
    for s, side in ((-1, 'L'), (1, 'R')):
        x = s * 1.32
        a.part('Fan_ducts', 'Team').torus(.56, .11, loc=(x, -.05, 1.0), seg=16, ring=6)
        for ang in (0, R90):
            c, sn = math.cos(ang), math.sin(ang)
            beam(a, 'Fan_stators', 'Undercarriage', (x - c * .5, -.05 - sn * .5, .94), (x + c * .5, -.05 + sn * .5, .94),
                 .05)
        cyl(a, 'Fan_motors', 'Armor', .13, .18, (x, -.05, .97), seg=8, bevel=0)
        p = a.pivot(f'spin_fan_{side}', (x, -.05, 1.06))
        rotor(a, p, 3, .92, .13, hub=.1, pitch=.22)
        box(a, 'Duct_lights', 'TeamGlow', (.1, .1, .05), (x + s * .62, -.05, 1.0), bevel=0)
        # Side guns: twin barrels under each stub wing (recoil rig names).
        gx = s * .74
        box(a, 'Gun_pods', 'Armor', (.26, .62, .24), (gx, -.45, .74), bevel=.04)
        for dx in (-.065, .065):
            cyl(a, 'Barrel_guns', 'Steel', .045, .8, (gx + dx, -1.08, .74), rot=FORWARD, seg=8, bevel=0)
        cyl(a, 'Muzzle_guns', 'Undercarriage', .11, .12, (gx, -1.5, .74), rot=FORWARD, seg=8, bevel=0)
    box(a, 'Nose_light', 'TeamGlow', (.34, .05, .05), (0, -1.4, .7), rot=(.4, 0, 0), bevel=0)
    # Skids.
    for s in (-1, 1):
        beam(a, 'Skids', 'Undercarriage', (s * .32, -.6, .5), (s * .5, -.66, .05), .06)
        beam(a, 'Skids', 'Undercarriage', (s * .32, .55, .5), (s * .5, .6, .05), .06)
        beam(a, 'Skids', 'Steel', (s * .5, -1.0, .035), (s * .5, .9, .035), .07)


def gored_envelope(a, centre, radii, gores=12, per_gore=3, rings=11, amp=.04, accent=3):
    """Hot-air envelope sewn from gores: an ellipsoid whose surface dips at every seam, so the panel
    lines catch the light. Every `accent`-th gore is Hazard cloth, the rest Team (two meshes)."""
    cx, cy, cz = centre
    rx, ry, rz = radii
    seg = gores * per_gore
    team = a.part('Envelope', 'Team').bm
    trim = a.part('Envelope_stripes', 'Hazard').bm
    th = [math.radians(160 - (160 - 17) * i / (rings - 1)) for i in range(rings)]  # bottom to top
    grid = []
    for t in th:
        row = []
        for k in range(seg):
            phi = k * math.tau / seg
            dip = 1 - amp * math.sin(t) * (.5 + .5 * math.cos(gores * phi))
            row.append((cx + rx * dip * math.sin(t) * math.cos(phi), cy + ry * dip * math.sin(t) * math.sin(phi),
                        cz + rz * math.cos(t)))
        grid.append(row)
    for bm, want in ((team, False), (trim, True)):
        made = {}

        def vert(i, k):
            key = (i, k % seg)
            if key not in made:
                made[key] = bm.verts.new(grid[i][k % seg])
            return made[key]
        for i in range(rings - 1):
            for k in range(seg):
                if ((k // per_gore) % accent == 0) != want:
                    continue
                bm.faces.new((vert(i, k), vert(i, k + 1), vert(i + 1, k + 1), vert(i + 1, k)))


def balloon(a):
    """Ashfall bomber: a gored envelope with load-tape bands and patches, rope rigging to a wicker-and-iron
    gondola, a burner whose ember glow lights the throat, sandbags, lanterns and a bomb rack."""
    a.pivot('hover', (0, 0, 0))
    centre, radii = (0, 0, 2.9), (1.15, 1.15, 1.32)
    gored_envelope(a, centre, radii)
    patches = [(1.9, -.1, 'Armor', (.46, .5, .05), -.2), (3.0, .55, 'Medical', (.36, .36, .05), .5),
               (4.3, .1, 'Armor', (.4, .34, .05), .7), (-.4, .25, 'Hazard', (.5, .42, .05), .3)]
    for az, el, mat, size, spin in patches:
        patch(a, 'Patches', mat, centre, radii, az, el, size, spin)
    # Load tapes: a Steel equator band, two thin umber bands above it, and a crown vent cap with a ring.
    belt(a, 'Envelope_band', 'Steel', 1.13, 2.62, .1, 24)
    belt(a, 'Load_tape', 'Undercarriage', 1.07, 3.42, .08, 24)
    belt(a, 'Load_tape', 'Undercarriage', .76, 3.98, .07, 24)
    cyl(a, 'Vent_cap', 'Steel', .34, .14, (0, 0, 4.2), seg=12, r2=.22, bevel=0)
    for k in range(4):
        ang = k * R90 + .4
        c, sn = math.cos(ang), math.sin(ang)
        box(a, 'Streamers', 'Team', (.05, .16, .7), (c * 1.19, sn * 1.19, 2.2), rot=(0, 0, ang), bevel=0, taper=(1, .3))
    cyl(a, 'Skirt', 'Armor', .36, .32, (0, 0, 1.66), seg=14, r2=.6, bevel=.01)
    belt(a, 'Skirt_ring', 'Steel', .44, 1.5, .07, 14, r2=.46)
    # Ember glow inside the throat, lit from below by the burner (Flame keeps its orange on every team).
    cyl(a, 'Ember_glow', 'Flame', .3, .03, (0, 0, 1.78), seg=12, bevel=0)
    # Rope rigging: eight load ropes from the equator band to the gondola rim, four short stays from the
    # skirt ring, and TeamGlow lanterns where the stays meet the rim.
    for k in range(8):
        ang = k * math.pi / 4 + math.pi / 8
        top = (1.12 * math.cos(ang), 1.12 * math.sin(ang), 2.58)
        cx_, cy_ = (.5 if math.cos(ang) > 0 else -.5), (.44 if math.sin(ang) > 0 else -.44)
        beam(a, 'Rigging', 'Undercarriage', top, (cx_, cy_, 1.0), .03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(a, 'Rigging', 'Undercarriage', (sx * .3, sy * .3, 1.52), (sx * .46, sy * .4, .96), .035)
            box(a, 'Lanterns', 'TeamGlow', (.1, .1, .12), (sx * .5, sy * .44, 1.08), bevel=0)
    # Burner on a steel yoke with a coil; the flame pivot is the nozzle.
    for sx in (-1, 1):
        beam(a, 'Burner_yoke', 'Steel', (sx * .44, 0, .98), (sx * .1, 0, 1.16), .05)
    cyl(a, 'Burner', 'Steel', .14, .2, (0, 0, 1.12), seg=10, r2=.1, bevel=.01)
    belt(a, 'Burner_coil', 'Undercarriage', .145, 1.12, .05, 10, r2=.12)
    flame = a.pivot('flicker_flame', (0, 0, 1.22))
    cyl(a, 'Flame', 'Flame', .16, .5, (0, 0, .25), seg=8, r2=.02, bevel=0, parent=flame)
    cyl(a, 'Flame', 'Flame', .09, .36, (.04, .03, .4), seg=6, r2=.01, bevel=0, parent=flame)
    # Gondola: a woven basket (umber hoops over a sand-plate body), steel corner posts and rim,
    # mismatched side plates, a crooked stack, a banded fuel drum, sandbags and a lamp.
    box(a, 'Gondola', 'Armor', (.96, .86, .52), (0, 0, .66), bevel=.05, taper=(1.1, 1.1))
    for z in (.5, .66, .82):
        box(a, 'Wicker_hoops', 'Undercarriage', (1.0, .9, .04), (0, 0, z), bevel=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(a, 'Corner_posts', 'Steel', (sx * .5, sy * .44, .42), (sx * .54, sy * .47, .98), .05)
    box(a, 'Gondola_rim', 'Steel', (1.12, 1.0, .08), (0, 0, .95), bevel=.02)
    box(a, 'Side_plates', 'Team', (.06, .5, .34), (-.52, -.08, .68), rot=(0, -.06, .1), bevel=.012)
    box(a, 'Side_plates', 'Hazard', (.5, .06, .3), (.12, -.47, .66), rot=(0, .12, 0), bevel=.012)
    box(a, 'Side_plates', 'Steel', (.06, .44, .28), (.53, .12, .64), rot=(0, .08, -.08), bevel=.012)
    for sx in (-1, 1):
        a.part('Sandbags', 'Undercarriage').sphere((.1, .08, .12), loc=(sx * .6, .3, .52), seg=6, rings=4)
        a.part('Sandbags', 'Undercarriage').sphere((.1, .08, .12), loc=(sx * .6, -.2, .54), seg=6, rings=4)
        beam(a, 'Sandbag_ties', 'Steel', (sx * .56, .3, .66), (sx * .6, .3, .6), .02)
    cyl(a, 'Exhaust_stack', 'Undercarriage', .065, .8, (.36, .3, 1.24), rot=(.12, .1, 0), seg=8, bevel=0)
    cyl(a, 'Stack_cap', 'Steel', .1, .07, (.4, .35, 1.65), rot=(.12, .1, 0), seg=8, bevel=0)
    a.part('Pennant', 'Hazard').prism([(0, 0), (.42, .1), (0, .22)], .02, loc=(.42, .36, 1.5), rot=(R90, 0, .5), axis='Z', bevel=0, seg=1)
    cyl(a, 'Fuel_drum', 'Hazard', .14, .34, (-.24, .2, 1.15), seg=10, bevel=.01)
    for z in (1.07, 1.24):
        belt(a, 'Fuel_drum_bands', 'Steel', .15, z, .035, 10, at=(-.24, .2))
    box(a, 'Lamp_front', 'TeamGlow', (.2, .04, .07), (0, -.47, .84), bevel=0)
    # Bomb rack under the gondola.
    box(a, 'Bomb_rack', 'Steel', (.86, .14, .07), (0, 0, .36), bevel=.012)
    for x in (-.3, 0, .3):
        a.part('Bombs', 'Undercarriage').sphere((.12, .12, .17), loc=(x, 0, .18), seg=8, rings=4)
        box(a, 'Bomb_fins', 'Hazard', (.22, .03, .1), (x, 0, .3), bevel=0)
        box(a, 'Bomb_clamps', 'Steel', (.04, .04, .08), (x, 0, .33), bevel=0)


def glider(a):
    """Sunward raider: wide fabric delta wing over a three-wheel trike, pusher prop, nose gun."""
    a.pivot('hover', (0, 0, 0))
    wing_z = 1.72
    for s in (-1, 1):
        # Each wing half: a flat sail panel with slight dihedral, leading-edge spar and tip stripe.
        a.part('Wing', 'Team').prism([(0, -.95), (s * 2.0, .58), (s * 1.82, .82), (0, .5)], .05,
                                     loc=(0, 0, wing_z), rot=(0, -s * .07, 0), axis='Z', bevel=.015, seg=1)
        beam(a, 'Wing_spars', 'Steel', (0, -.97, wing_z + .04), (s * 2.0, .56, wing_z + .04 + .14), .05)
        tip = Vector((s * 1.72, .52, wing_z + .03 + .12))
        box(a, 'Wing_stripes', 'Medical', (.12, .44, .03), tuple(tip), rot=(0, -s * .07, -s * .65), bevel=0)
        box(a, 'Wing_stripes', 'Medical', (.1, .4, .03), (s * 1.18, .2, wing_z + .03 + .08), rot=(0, -s * .07, -s * .65),
            bevel=0)
    beam(a, 'Keel', 'Steel', (0, -.95, wing_z + .05), (0, .55, wing_z + .05), .06)
    # R3-W: upturned team winglets and a Sunward sun disc on the sail: a raider, not a kite.
    for s in (-1, 1):
        box(a, 'Winglets', 'Team', (.05, .36, .34), (s * 1.93, .66, wing_z + .3), rot=(0, s * .25, 0), bevel=0, taper=(1, .6))
    cyl(a, 'Sun_disc', 'Hazard', .3, .025, (0, -.05, wing_z + .06), seg=12, bevel=0)
    # A-frame mast from the trike to the wing hang point.
    for sx in (-1, 1):
        beam(a, 'A_frame', 'Steel', (sx * .42, -.42, 1.0), (0, -.1, wing_z - .02), .045)
    beam(a, 'Mast', 'Steel', (0, .3, .82), (0, -.05, wing_z - .02), .06)
    beam(a, 'Control_bar', 'Steel', (-.42, -.42, 1.0), (.42, -.42, 1.0), .04)
    # Trike: sand-gold nose fairing, seat, pilot in goggles, a round water tank behind.
    box(a, 'Nose_fairing', 'Team', (.42, .62, .32), (0, -.5, .55), bevel=.06, taper=(.7, .7))
    box(a, 'Seat_pod', 'Armor', (.46, .9, .2), (0, .05, .48), bevel=.04)
    box(a, 'Pilot', 'Suit', (.4, .3, .44), (0, .06, .8), bevel=.06)
    a.part('Helmet', 'Armor').sphere(.17, loc=(0, .04, 1.14), seg=10, rings=6)
    box(a, 'Goggles', 'Glass', (.24, .06, .07), (0, -.12, 1.15), bevel=0)
    box(a, 'Scarf', 'Hazard', (.08, .34, .05), (0, .26, .98), rot=(-.4, 0, 0), bevel=0)
    for sx in (-1, 1):
        a.part('Pilot_arms', 'Suit').limb((sx * .2, .0, .92), (sx * .36, -.38, .98), .1, .11, bevel=0, seg=1)
    cyl(a, 'Water_tank', 'Medical', .17, .52, (0, .5, .66), rot=ACROSS, seg=12, bevel=.015)
    # Wheels: one at the nose, a wide pair behind (Sunward rolls everywhere).
    cyl(a, 'Wheels', 'Undercarriage', .17, .1, (0, -.72, .17), rot=ACROSS, seg=10, bevel=.015)
    beam(a, 'Wheel_struts', 'Steel', (0, -.6, .45), (0, -.72, .17), .045)
    for sx in (-1, 1):
        cyl(a, 'Wheels', 'Undercarriage', .2, .11, (sx * .5, .32, .2), rot=ACROSS, seg=10, bevel=.015)
        cyl(a, 'Wheel_hubs', 'Team', .09, .13, (sx * .5, .32, .2), rot=ACROSS, seg=8, bevel=0)
        beam(a, 'Wheel_struts', 'Steel', (sx * .18, .25, .42), (sx * .48, .32, .2), .045)
    # Pusher engine and propeller (origin at the hub; spins about the Y axis).
    cyl(a, 'Engine', 'Armor', .13, .3, (0, .82, .86), rot=FORWARD, seg=10, bevel=.02)
    p = a.pivot('spin_prop', (0, 1.02, .86))
    box(a, 'Prop_blades', 'Steel', (.09, .03, 1.0), (0, 0, 0), rot=(0, .0, 0), bevel=0, parent=p)
    box(a, 'Prop_blades', 'Steel', (1.0, .03, .09), (0, 0, 0), rot=(0, .0, 0), bevel=0, parent=p)
    cyl(a, 'Prop_spinner', 'Undercarriage', .07, .14, (0, .05, 0), rot=FORWARD, seg=8, r2=.02, bevel=0, parent=p)
    # Light raider gun beside the nose (recoil rig name).
    cyl(a, 'Barrel_nose', 'Steel', .04, .6, (.24, -.82, .62), rot=FORWARD, seg=8, bevel=0)
    box(a, 'Nose_light', 'TeamGlow', (.16, .04, .05), (0, -.82, .6), bevel=0)


BUILDERS = {'kite': kite, 'hawk': hawk, 'balloon': balloon, 'glider': glider}


# ----------------------------------------------------------------------------- pipeline
def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def describe(a):
    """Node summary for the wiring package: pivots, their child parts, materials."""
    pivots = {}
    for ob in a.objects:
        if ob.parent:
            pivots.setdefault(ob.parent.name, []).append(ob.name)
    mats = sorted({ob.data.materials[0].name for ob in a.objects})
    pts = []
    for ob in a.objects:
        mw = Matrix.Translation(ob.parent.location) if ob.parent else Matrix.Identity(4)
        pts += [mw @ v.co for v in ob.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return {'pivots': {k: sorted(v) for k, v in pivots.items()},
            'empties': sorted(a.pivots),
            'team_parts': sorted(ob.name for ob in a.objects if ob.data.materials[0].name.startswith('Team')),
            'rig_parts': sorted(ob.name for ob in a.objects if kit.RIG.match(ob.name)),
            'materials': mats,
            'size_m': [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)],
            'min_z': round(lo.z, 3)}


def build_all(names=None, export=True, manifest=False, keep=False):
    """keep=True leaves every model in the scene (for --blend); names then get .001 suffixes,
    so only exports made with keep=False are valid runtime files."""
    if keep:
        export = False
    root = kit.workspace('FrontierAir')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in names or CATALOG:
        a = Asset(name, root, ao_distance=.5, grime_height=.45, ao_samples=40, ground=False)
        BUILDERS[name](a)
        tris = count(a)
        budget = BUDGETS.get(name, BUDGET)
        if tris > budget or '--parts' in sys.argv:
            parts = {f'{k[0]}/{k[1]}': sum(len(f.verts) - 2 for f in s.bm.faces) for k, s in a.shapes.items()}
            print('AIR_PARTS', name, json.dumps(dict(sorted(parts.items(), key=lambda kv: -kv[1]))), flush=True)
        if tris > budget:
            raise RuntimeError(f'{name}: {tris} triangles > {budget}')
        a.finish()
        if export:
            a.export(OUT / f'{name}.glb')
        info = describe(a)
        info.update(triangles=a.triangles(), budget=budget, faction=CATALOG[name][0], spin=SPIN[name],
                    bytes=(OUT / f'{name}.glb').stat().st_size if export else None)
        report[name] = info
        print('AIR_ASSET', name, info['triangles'], flush=True)
        # Free the object names before the next model: a second `hover` would export as
        # `hover.001`, and the view looks the bob pivot up by its exact name.
        if export and not keep:
            kit.clear_workspace(root)
    if export and manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        # In place (the portrait atlas order follows the manifest), flagged for the owner (round 3, R3-W).
        fresh = {n: {'name': n, 'file': f'{n}.glb', 'triangles': r['triangles'], 'air': True, 'budget': BUDGETS.get(n, BUDGET),
                     'animation': 'Runtime spin_*/flicker_* pivots and hover bob; no baked clips',
                     'review': 'pending owner review (round 3)'} for n, r in report.items()}
        data['assets'] = [fresh.pop(e['name'], e) for e in data['assets']] + list(fresh.values())
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(data, indent=2) + '\n')
    print('AIR_REPORT', json.dumps(report), flush=True)
    return report


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_all([n for n in args if n in CATALOG] or None, manifest='--manifest' in args)
    if '--blend' in args:
        # A separate pass keeps all four models side by side for editing.
        build_all(keep=True)
        for i, coll in enumerate(c for c in kit.workspace('FrontierAir').children if c.name.startswith('frontier_')):
            for o in coll.objects:
                if o.parent is None:
                    o.location.x += i * 6
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(args[args.index('--blend') + 1]).resolve()))
