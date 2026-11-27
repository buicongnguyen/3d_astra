"""Close-up detail models (H3b, batch 2): the air units (generate_air.py: hawk, balloon, glider) and the roster
additions (generate_roster.py: lancer, bulwark, moth, halo).

Each function adds small surface parts to the normal model after its own builder (and, for the roster units,
after generate_roster.detail; before settle() for the flyers), on the same pivots, part names and materials, so
the silhouette, team slots and rig names stay those of the normal model. Rotor and propeller parts sit on their
spin_* pivots, leg parts on leg_L / leg_R, turret parts are Turret_head*, barrel parts Barrel_* (they recoil).
Only materials each model already has; Hazard, Steel and Undercarriage are plain paints.
"""
import math
import sys
from pathlib import Path

from mathutils import Euler, Matrix, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import generate_air as air  # noqa: E402

R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y (front is -Y)
ACROSS = (0, R90, 0)    # cylinder axis along X
SIDES = ((-1, 'L'), (1, 'R'))


def radial(ang):
    """Euler rotation that points a cylinder's axis outward along the XY direction `ang`."""
    return (0, R90, ang)


def frame(loc, rot):
    """Local frame of a rotated part: at(frame, p) maps a point given in the part's own axes."""
    return Matrix.Translation(Vector(loc)) @ Euler(rot, 'XYZ').to_matrix().to_4x4()


def at(m, p):
    return tuple(m @ Vector(p))


def bolts(shape, points, r=.022, h=.02, rot=(0, 0, 0), seg=5):
    """Flat-topped rivets without a bevel (16 triangles each; the kit's bolts bevel every one)."""
    for p in points:
        shape.cyl(r, h, loc=p, rot=rot, seg=seg, bevel=0, bseg=1)
    return shape


# ----------------------------------------------------------------------------- hawk
def hawk_detail(a):
    steel = a.part('Hull_bolts', 'Steel')
    seams = a.part('Panel_lines', 'Undercarriage')
    # Fuselage sides (the profile is extruded to x = +-.5): panel lines, a rivet row and an access hatch.
    for s in (-1, 1):
        x = s * .505
        for y, h in ((-.75, .5), (-.1, .66), (.55, .58)):
            seams.box((.02, .025, h), loc=(x, y, .86), bevel=0)
        seams.box((.02, 1.9, .025), loc=(x, -.1, 1.12), bevel=0)
        bolts(steel, [(x + s * .005, y, .62) for y in (-1.0, -.45, .1, .65)], r=.022, h=.02, rot=ACROSS)
        a.part('Side_hatches', 'Armor').box((.02, .34, .26), loc=(x + s * .005, .2, .84), bevel=0)
        steel.box((.025, .06, .03), loc=(x + s * .012, .3, .84), bevel=0)
    # Canopy frame: a centre bar and two hoops over the tinted glass.
    cm = frame((0, -.82, 1.2), (-.32, 0, 0))
    a.part('Canopy_frame', 'Steel').box((.04, .58, .03), loc=at(cm, (0, 0, .155)), rot=(-.32, 0, 0), bevel=0)
    for ly, w in ((-.16, .6), (.18, .62)):
        a.part('Canopy_frame', 'Steel').box((w, .035, .03), loc=at(cm, (0, ly, .155)), rot=(-.32, 0, 0), bevel=0)
    # Dorsal intake louvres, a spine antenna with a team light, and rivets down the spine.
    a.part('Intake_louvres', 'Undercarriage').grille(.26, .12, loc=(0, -.42, 1.42), slats=3, depth=.03, thickness=.02)
    bolts(steel, [(x, y, 1.465) for x in (-.18, .18) for y in (.05, .55)], r=.02, h=.02)
    a.part('Antenna', 'Steel').cyl(.012, .3, loc=(.14, .62, 1.6), seg=5, bevel=0)
    air.box(a, 'Antenna_light', 'TeamGlow', (.035, .035, .035), (.14, .62, 1.76), bevel=0)
    # Tail boom rivets, fin rivets and a stabiliser edge strip.
    bolts(steel, [(s * .15, y, 1.165) for s in (-1, 1) for y in (1.4, 1.9)], r=.02, h=.02)
    bolts(steel, [(s * .048, y, z) for s in (-1, 1) for y, z in ((2.15, 1.2), (2.36, 1.42))], r=.02, h=.015,
                rot=ACROSS)
    seams.box((1.1, .03, .02), loc=(0, 2.11, 1.085), bevel=0)
    # Stub wings: a team stripe and rivets by each duct, a walkway line.
    for s in (-1, 1):
        a.part('Wing_stripes', 'Team').box((.07, .42, .02), loc=(s * .86, -.05, 1.05), bevel=0)
        bolts(steel, [(s * x, y, 1.05) for x in (.6, .72) for y in (-.2, .1)], r=.02, h=.02)
        seams.box((.3, .02, .02), loc=(s * .36, .12, 1.05), bevel=0)
    # Ducts: bolts round each lip, hazard tips and a steel cap on the fans (they turn on the spin pivots).
    for s, side in SIDES:
        x = s * 1.32
        bolts(steel, [(x + math.cos(k * math.tau / 6) * .56, -.05 + math.sin(k * math.tau / 6) * .56, 1.105)
                     for k in range(6)], r=.022, h=.02)
        p = f'spin_fan_{side}'
        for i in range(3):
            ang = i * math.pi / 3
            for e in (-1, 1):
                c, d = math.cos(ang) * e * .4, math.sin(ang) * e * .4
                air.box(a, 'Rotor_tips', 'Hazard', (.1, .14, .034), (c, d, 0), rot=(.22, 0, ang), bevel=0, parent=p)
        air.cyl(a, 'Rotor_hub', 'Steel', .05, .05, (0, 0, .085), seg=8, bevel=0, parent=p)
        # Gun pods: cooling jackets on the barrels (they recoil with them), pod rivets and a side vent.
        gx = s * .74
        for dx in (-.065, .065):
            for y in (-1.0,):
                a.part('Barrel_guns_jackets', 'Undercarriage').cyl(.06, .08, loc=(gx + dx, y, .74), rot=FORWARD, seg=8,
                                                                     bevel=0)
        a.part('Pod_vents', 'Undercarriage').grille(.3, .14, loc=(gx + s * .135, -.4, .74), rot=(0, 0, -s * R90), slats=3,
                                                   depth=.025, thickness=.02)
    # Skids: foot pads and step plates.
    for s in (-1, 1):
        for y in (-.66, .6):
            a.part('Skid_pads', 'Steel').box((.1, .14, .05), loc=(s * .5, y, .045), bevel=0)
        a.part('Skid_steps', 'Steel').box((.16, .1, .025), loc=(s * .42, -.62, .3), bevel=0)


# ----------------------------------------------------------------------------- balloon
def balloon_detail(a):
    steel = a.part('Band_bolts', 'Steel')
    # Envelope band: bolts round it.
    for k in range(12):
        ang = k * math.tau / 12
        steel.cyl(.03, .03, loc=(math.cos(ang) * 1.145, math.sin(ang) * 1.145, 2.62), rot=radial(ang), seg=5, bevel=0)
    # Load tapes: stitch tabs round the upper tapes.
    centre, radii = (0, 0, 2.9), (1.15, 1.15, 1.32)
    for el, n in ((math.asin(.52 / 1.32), 12), (math.asin(1.08 / 1.32), 8)):
        for k in range(n):
            air.patch(a, 'Tape_stitches', 'Steel', centre, radii, k * math.tau / n + .13, el, (.05, .09, .03))
    # Tacks round every scrap patch.
    for az, el, size in ((1.9, -.1, .25), (3.0, .55, .2), (4.3, .1, .22), (-.4, .25, .27)):
        for k in range(6):
            t = k * math.tau / 6
            daz, d_el = math.cos(t) * size / 1.15, math.sin(t) * size / 1.32
            air.patch(a, 'Patch_tacks', 'Steel', centre, radii, az + daz, el + d_el, (.045, .045, .02), spin=t)
    # Crown vent: a steel ring, spokes and four team lamps.
    a.part('Vent_ring', 'Steel').torus(.29, .025, loc=(0, 0, 4.28), seg=12, ring=4)
    for k in range(6):
        ang = k * math.pi / 3
        air.beam(a, 'Vent_spokes', 'Steel', (0, 0, 4.28), (math.cos(ang) * .28, math.sin(ang) * .28, 4.28), .03)
    for k in range(4):
        ang = k * R90 + math.pi / 4
        air.box(a, 'Vent_lamps', 'TeamGlow', (.05, .05, .04), (math.cos(ang) * .29, math.sin(ang) * .29, 4.31), bevel=0)
    # Skirt ribs from the throat ring up to the envelope.
    for k in range(8):
        ang = k * math.pi / 4
        c, s = math.cos(ang), math.sin(ang)
        air.beam(a, 'Skirt_ribs', 'Undercarriage', (c * .375, s * .375, 1.52), (c * .6, s * .6, 1.8), .035)
    # Gondola: vertical wicker weave between the hoops, rim bolts, a team stripe at the back.
    weave = a.part('Wicker_weave', 'Undercarriage')
    for s in (-1, 1):
        for y in (-.32, -.16, 0, .16, .32):
            weave.limb((s * .492, y, .42), (s * .535, y * 1.1, .9), .03, .03, bevel=0, seg=1)
        for x in (-.36, -.18, 0, .18, .36):
            weave.limb((x, s * .442, .42), (x * 1.1, s * .485, .9), .03, .03, bevel=0, seg=1)
    bolts(steel, [(sx * x, sy * .5, .995) for sx in (-1, 1) for sy in (-1, 1) for x in (.15, .4)], r=.025, h=.02)
    bolts(steel, [(sx * .56, y, .995) for sx in (-1, 1) for y in (-.25, .25)], r=.025, h=.02)
    a.part('Gondola_stripe', 'Team').box((.6, .03, .06), loc=(0, .487, .74), bevel=0)
    # Lantern cages, a gas line from the fuel drum to the burner, a valve wheel and a drum cap.
    for sx in (-1, 1):
        for sy in (-1, 1):
            for dz in (-.07, .07):
                air.box(a, 'Lantern_cages', 'Steel', (.13, .13, .025), (sx * .5, sy * .44, 1.08 + dz), bevel=0)
    a.part('Gas_line', 'Undercarriage').tube([(-.24, .2, 1.33), (-.2, .12, 1.36), (-.12, .04, 1.3), (-.1, 0, 1.18)], .018,
                                             seg=6)
    a.part('Burner_valve', 'Steel').torus(.06, .012, loc=(.16, 0, 1.22), rot=ACROSS, seg=8, ring=3)
    air.cyl(a, 'Burner_valve', 'Steel', .015, .1, (.12, 0, 1.22), rot=ACROSS, seg=6, bevel=0)
    air.cyl(a, 'Drum_cap', 'Steel', .05, .04, (-.24, .2, 1.33), seg=8, bevel=0)
    # Bomb bands.
    for x in (-.3, 0, .3):
        a.part('Bomb_bands', 'Steel').torus(.118, .012, loc=(x, 0, .2), seg=10, ring=3)
    # Rigging toggles part-way down each rope.
    for k in range(8):
        ang = k * math.pi / 4 + math.pi / 8
        top = Vector((1.12 * math.cos(ang), 1.12 * math.sin(ang), 2.58))
        bot = Vector(((.5 if math.cos(ang) > 0 else -.5), (.44 if math.sin(ang) > 0 else -.44), 1.0))
        a.part('Rope_toggles', 'Armor').cyl(.035, .1, loc=tuple(top.lerp(bot, .55)), seg=6, bevel=0)


# ----------------------------------------------------------------------------- glider
def glider_detail(a):
    wing_z = 1.72
    steel = a.part('Wing_battens', 'Steel')
    for s, side in SIDES:
        rot = Matrix.Rotation(-s * .07, 4, 'Y')

        def on(x, y, h=.035):
            return tuple(Vector((0, 0, wing_z)) + rot @ Vector((x, y, h)))
        # Battens from the leading edge to the trailing edge, and a hem along the trailing edge.
        for t in (.22, .44, .66, .86):
            lead = (s * 2.0 * t + s * .04, -.95 + 1.53 * t + .05)
            tail = (s * 1.82 * t, .5 + .32 * t - .04)
            steel.limb(on(*lead), on(*tail), .025, .02, bevel=0, seg=1)
        a.part('Wing_hem', 'Undercarriage').limb(on(s * .05, .48), on(s * 1.8, .79), .03, .02, bevel=0, seg=1)
        # Grommets along the leading edge, a team light on the tip.
        bolts(a.part('Wing_grommets', 'Steel'), [on(s * 2.0 * t + s * .02, -.95 + 1.53 * t - .02, .03)
                                                for t in (.12, .3, .5, .7, .9)], r=.022, h=.02)
        air.box(a, 'Tip_lights', 'TeamGlow', (.06, .06, .03), on(s * 1.84, .72, .04), bevel=0)
        # Flying wires from the control-bar corners to the wing.
        air.beam(a, 'Flying_wires', 'Steel', (s * .42, -.42, 1.0), on(s * 1.25, .1, -.03), .012)
        air.beam(a, 'Flying_wires', 'Steel', (s * .3, .5, .7), on(s * 1.0, .45, -.03), .012)
    bolts(a.part('Keel_bolts', 'Steel'), [(0, y, wing_z + .085) for y in (-.8, -.4, .2, .45)], r=.025, h=.02)
    air.box(a, 'Hang_bracket', 'Steel', (.16, .14, .06), (0, -.1, wing_z - .04), bevel=0)
    # Pusher prop: hazard tips on the four blade ends, on the spin pivot.
    for loc in ((0, 0, .44), (0, 0, -.44), (.44, 0, 0), (-.44, 0, 0)):
        air.box(a, 'Prop_tips', 'Hazard', (.1, .036, .1), loc, bevel=0, parent='spin_prop')
    # Engine: cooling fins, an exhaust stub; water tank bands.
    for y in (.72, .8, .88):
        a.part('Engine_fins', 'Steel').torus(.135, .016, loc=(0, y, .86), rot=FORWARD, seg=10, ring=3)
    air.cyl(a, 'Exhaust_stub', 'Undercarriage', .035, .18, (.12, .9, .76), rot=FORWARD, seg=6, bevel=0)
    for x in (-.15, .15):
        a.part('Tank_bands', 'Steel').torus(.172, .014, loc=(x, .5, .66), rot=ACROSS, seg=12, ring=3)
    air.cyl(a, 'Tank_cap', 'Steel', .05, .05, (0, .5, .84), seg=8, bevel=0)
    # Seat pod and nose fairing: rivets, a team stripe; pilot's helmet ridge and harness; gun jackets.
    for s in (-1, 1):
        bolts(a.part('Pod_rivets', 'Steel'), [(s * .235, y, .48) for y in (-.25, .05, .35)], r=.02, h=.02, rot=ACROSS)
        bolts(a.part('Fairing_rivets', 'Steel'), [(s * .2, y, .56) for y in (-.66, -.4)], r=.02, h=.02, rot=ACROSS)
        a.part('Seat_stripe', 'Team').box((.02, .7, .05), loc=(s * .232, .05, .52), bevel=0)
        a.part('Harness', 'Undercarriage').box((.05, .02, .42), loc=(s * .09, -.095, .82), rot=(0, s * .3, 0), bevel=0)
    a.part('Helmet_ridge', 'Steel').box((.04, .3, .04), loc=(0, .04, 1.3), bevel=0)
    a.part('Barrel_nose_jacket', 'Undercarriage').cyl(.055, .16, loc=(.24, -.7, .62), rot=FORWARD, seg=8, bevel=0)
    a.part('Barrel_nose_jacket', 'Undercarriage').cyl(.05, .05, loc=(.24, -1.06, .62), rot=FORWARD, seg=8, bevel=0)


# ----------------------------------------------------------------------------- lancer
def lancer_detail(a):
    A = a.armor
    steel = a.part('Body_bolts', 'Steel')
    dark = a.part('Body_seams', 'Undercarriage')
    # Fenders: a team pinstripe on each outer face and rivets over the arch.
    for y, r in ((-1.0, .42), (.95, .5)):
        ts = [math.radians(d) for d in (160, 135, 110, 90, 70, 45, 20)]
        for s in (-1, 1):
            band = [(y + (r + .095) * math.cos(t), r + (r + .095) * math.sin(t)) for t in ts]
            band += [(y + (r + .065) * math.cos(t), r + (r + .065) * math.sin(t)) for t in reversed(ts)]
            a.part('Fender_stripes', 'Team').prism(band, .02, loc=(s * 1.225, 0, 0), axis='X', bevel=0, seg=1)
            for t in ts[1:-1]:
                for dx in (.14, -.14):
                    steel.cyl(.022, .02, loc=(s * 1.0 + dx, y + (r + .118) * math.cos(t), r + (r + .118) * math.sin(t)),
                              rot=(t - R90, 0, 0), seg=6, bevel=0)
    # Body tub: panel seams and a rivet row along each side, rail clamps, headlamps.
    for s in (-1, 1):
        x = s * .595
        for y in (-.9, -.2, .5):
            dark.box((.02, .025, .26), loc=(x, y, .62), bevel=0)
        bolts(steel, [(x + s * .005, y, .74) for y in (-1.0, -.6, -.2, .2, .6, 1.0)], r=.022, h=.02, rot=ACROSS)
        for y in (-.45, .45):
            a.part('Rail_clamps', 'Undercarriage').box((.15, .06, .15), loc=(s * .66, y, .9), bevel=0)
        a.part('Headlamps', 'Steel').cyl(.08, .08, loc=(s * .32, -1.72, .73), rot=(R90 + .32, 0, 0), seg=10, bevel=0)
        a.part('Headlamp_glass', 'Undercarriage').cyl(.055, .02, loc=(s * .32, -1.765, .745), rot=(R90 + .32, 0, 0),
                                                       seg=10, bevel=0)
    # Hazard chevrons and bolts on the skid plate.
    pm = frame((0, -1.6, .42), (.35, 0, 0))
    for x in (-.28, 0, .28):
        a.part('Skid_chevrons', 'Hazard').box((.1, .3, .02), loc=at(pm, (x, 0, .045)), rot=(.35, 0, .5), bevel=0)
    bolts(steel, [at(pm, (x, y, .045)) for x in (-.38, .38) for y in (-.18, .18)], r=.02, h=.02, rot=(.35, 0, 0))
    # Crew: harness straps, goggle bands; dash gauges and steering spokes.
    for x in (-.3, .3):
        for s in (-1, 1):
            a.part('Crew_harness', 'Undercarriage').box((.05, .02, .44), loc=(x + s * .08, -.508, 1.2),
                                                        rot=(-.1, s * .35, 0), bevel=0)
        a.part('Goggle_bands', 'Undercarriage').torus(.168, .014, loc=(x, -.4, 1.6), seg=12, ring=3)
        a.part('Gauges', 'Steel').cyl(.045, .03, loc=(x * .6 + .05, -.92, 1.04), rot=(R90 - .4, 0, 0), seg=8, bevel=0)
        a.part('Gauge_faces', A).cyl(.032, .02, loc=(x * .6 + .05, -.94, 1.05), rot=(R90 - .4, 0, 0), seg=8, bevel=0)
    wm = frame((-.3, -.8, 1.12), (R90 - .5, 0, 0))
    for k in range(3):
        ang = k * math.tau / 3 + R90
        a.part('Steering_spokes', 'Steel').limb(at(wm, (0, 0, .02)), at(wm, (math.cos(ang) * .15, math.sin(ang) * .15, .02)),
                                                 .025, .015, bevel=0, seg=1)
    # Engine: cooling fins on top, a rocker cover, bolts, a hazard warning band; water-can bands and caps.
    for k in range(5):
        a.part('Engine_fins', 'Steel').box((.7, .03, .06), loc=(0, .55 + k * .1, 1.25), bevel=0)
    a.part('Rocker_cover', 'Undercarriage').box((.5, .3, .06), loc=(0, .72, 1.3), bevel=0)
    bolts(steel, [(x, y, 1.33) for x in (-.2, .2) for y in (.6, .84)], r=.02, h=.02)
    a.part('Engine_band', 'Hazard').box((.82, .03, .08), loc=(0, .44, 1.0), bevel=0)
    for x in (-.5, .5):
        for z in (.78, 1.12):
            a.part('Can_bands', 'Steel').torus(.143, .014, loc=(x, 1.25, z), seg=10, ring=3)
        air.cyl(a, 'Can_caps', 'Steel', .05, .06, (x, 1.25, 1.22), seg=8, bevel=0)
        a.part('Exhaust_shields', 'Steel').cyl(.07, .14, loc=(x * .6, 1.17, 1.22), rot=(-.5, 0, 0), seg=8, bevel=0)
    # Roll cage clamps and grab handles; canopy tie-down straps.
    for s in (-1, 1):
        for y in (-.85, -.1):
            a.part('Cage_clamps', 'Undercarriage').box((.1, .1, .1), loc=(s * .55, y, 1.7), bevel=0)
        a.part('Grab_handles', 'Steel').tube([(s * .6, -.6, 1.3), (s * .63, -.5, 1.38), (s * .63, -.3, 1.38),
                                              (s * .6, -.2, 1.3)], .018, seg=6)
    roof = [(-.8, 0), (-.4, .1), (0, .13), (.4, .1), (.8, 0)]
    for y in (-.24, -.08):
        a.part('Canopy_straps', 'Undercarriage').prism([(x * 1.01, z + .015) for x, z in roof], .05, loc=(0, y, 1.77),
                                                       axis='Y', bevel=0, seg=1)
    a.part('Antenna_base', 'Steel').cyl(.05, .1, loc=(.625, .46, 1.04), rot=(-.17, .03, 0), seg=8, bevel=0)
    # Turret: cradle bolts, a sight box on the left cheek, a cable; harpoon tube rings and fletching.
    bolts(a.part('Turret_head_bolts', 'Steel'), [(x, y, 2.055) for x in (-.3, .3) for y in (.28, .72)], r=.022, h=.02)
    a.part('Turret_head_sight', 'Steel').box((.1, .22, .1), loc=(-.5, .35, 2.2), bevel=0)
    a.part('Turret_head_sight', 'Undercarriage').cyl(.035, .05, loc=(-.5, .22, 2.2), rot=FORWARD, seg=8, bevel=0)
    a.part('Turret_head_cable', 'Undercarriage').tube([(.42, .75, 2.0), (.5, .85, 1.95), (.45, .95, 1.85)], .02, seg=5)
    for x in (-.22, 0, .22):
        for y in (-.25, .35):
            z = 2.14 + (.2 - y) * .06
            a.part('Barrel_harpoon_rings', 'Steel').torus(.1, .014, loc=(x, y, z), rot=(R90 - .06, 0, 0), seg=10, ring=3)
        for k in (-1, 1):
            a.part('Barrel_harpoon_fins', 'Hazard').box((.02, .14, .06), loc=(x + k * .1, .82, 2.12), bevel=0)


# ----------------------------------------------------------------------------- bulwark
def bulwark_detail(a):
    A = a.armor
    steel = a.part('Hull_rivets', 'Steel')
    dark = a.part('Hull_seams', 'Undercarriage')
    h = 1.25
    # Legs (on the hip pivots): thigh rivets and plates, shin rivets, a calf piston, boot cleats and ankle bands.
    for s, side in SIDES:
        leg = f'leg_{side}'
        bolts(a.part('Thigh_rivets', 'Steel', leg), [(x, -.215, -h * z) for x in (-.11, .11) for z in (.15, .38)],
                                                   r=.022, h=.02, rot=FORWARD)
        a.part('Thigh_plates', 'Steel', leg).box((.04, .3, .4), loc=(s * .185, 0, -h * .26), bevel=0)
        bolts(a.part('Shin_rivets', 'Steel', leg), [(x, -.26, -h * z) for x in (-.13, .13) for z in (.68, .86)],
                                                  r=.022, h=.02, rot=FORWARD)
        a.part('Shin_stripe', A, leg).box((.3, .02, .06), loc=(0, -.258, -h * .77), bevel=0)
        a.part('Calf_piston', 'Steel', leg).cyl(.045, .38, loc=(0, .22, -h * .78), seg=8, bevel=0)
        a.part('Calf_piston', 'Undercarriage', leg).cyl(.065, .12, loc=(0, .22, -h * .66), seg=8, bevel=0)
        for x in (-.2, 0, .2):
            a.part('Boot_cleats', 'Steel', leg).box((.08, .7, .04), loc=(x, -.08, -h + .015), bevel=0)
        a.part('Ankle_band', 'Steel', leg).box((.48, .7, .04), loc=(0, -.08, -h + .2), bevel=0)
        bolts(a.part('Boot_bolts', 'Steel', leg), [(sx * .262, y, -h + .1) for sx in (-1, 1) for y in (-.3, .1)],
                                                 r=.022, h=.02, rot=ACROSS)
    # Hip bridge bolts and hoses.
    bolts(steel, [(x, -.155, 1.3) for x in (-.5, -.25, 0, .25, .5)], r=.025, h=.02, rot=FORWARD)
    for s in (-1, 1):
        a.part('Hip_hoses', 'Undercarriage').tube([(s * .3, .4, 1.45), (s * .5, .45, 1.3), (s * .55, .35, 1.2)], .03, seg=6)
    # Hull: side vents and seams, a team stripe on each flank, roof bolts, a hatch and an antenna.
    for s in (-1, 1):
        x = s * .665
        a.part('Hull_vents', 'Undercarriage').grille(.44, .24, loc=(x, .35, 1.72), rot=(0, 0, -s * R90), slats=4,
                                                     depth=.03, thickness=.025)
        dark.box((.02, .025, .5), loc=(x - s * .01, -.05, 1.8), rot=(0, s * .1, 0), bevel=0)
        a.part('Flank_stripes', 'Team').box((.02, .8, .08), loc=(x - s * .018, .2, 2.0), rot=(0, s * .1, 0), bevel=0)
        bolts(steel, [(x - s * .005, y, 1.5) for y in (-.15, .2, .55)], r=.022, h=.02, rot=ACROSS)
    bolts(steel, [(sx * .4, y, 2.375) for sx in (-1, 1) for y in (.03, .53)], r=.025, h=.02)
    a.part('Roof_hatch', 'Steel').cyl(.16, .04, loc=(-.18, .3, 2.39), seg=10, bevel=0)
    a.part('Roof_hatch', 'Undercarriage').box((.03, .2, .03), loc=(-.18, .3, 2.42), bevel=0)
    a.part('Antenna', 'Steel').cyl(.012, .5, loc=(.4, .62, 2.6), seg=5, bevel=0)
    a.part('Antenna_light', 'TeamGlow').box((.035, .035, .035), loc=(.4, .62, 2.86), bevel=0)
    # Capacitors: steel bands and cables back into the hull.
    for x in (-.32, 0, .32):
        for z in (1.72, 2.12):
            a.part('Capacitor_bands', 'Steel').torus(.135, .016, loc=(x, .83, z), seg=10, ring=3)
        a.part('Capacitor_cables', 'Undercarriage').tube([(x, .83, 1.6), (x * .9, .78, 1.52), (x * .8, .7, 1.5)], .025,
                                                         seg=5)
    # Head: ear vents and a brow strip.
    for s in (-1, 1):
        a.part('Head_vents', 'Undercarriage').grille(.24, .16, loc=(s * .28, -.02, 2.55), rot=(0, 0, -s * R90), slats=3,
                                                     depth=.025, thickness=.02)
    a.part('Head_brow', 'Steel').box((.44, .04, .04), loc=(0, -.26, 2.68), bevel=0)
    # Shield arms: clamps at both ends and a piston beside each.
    for s in (-1, 1):
        for p in ((s * .58, -.18, 1.94), (s * .51, -.6, 1.77)):
            a.part('Arm_clamps', 'Undercarriage').box((.17, .1, .17), loc=p, bevel=0)
        a.part('Arm_pistons', 'Steel').limb((s * .62, -.15, 1.85), (s * .55, -.58, 1.68), .05, .05, bevel=0, seg=1)
    # Ward plate: horizontal seams, more rim bolts, bolts round the boss, and handles on the back.
    fwd = frame((0, -.78, 1.7), (.1, 0, 0))
    for z in (-.45, .35):
        for x0, x1 in ((-.42, .42), (-.88, -.68), (.68, .88)):
            dark.box((x1 - x0, .02, .03), loc=at(fwd, ((x0 + x1) / 2, -.085, z)), rot=(.1, 0, 0), bevel=0)
    rim = [(-.76, -.3), (.76, -.3), (-.8, .1), (.8, .1), (0, -.88), (-.4, -.88), (.4, -.88), (0, .86), (-.25, .86),
           (.25, .86)]
    bolts(steel, [at(fwd, (x, -.09, z)) for x, z in rim], r=.035, h=.035, rot=(R90 + .1, 0, 0))
    for k in range(8):
        ang = k * math.pi / 4
        p = at(fwd, (math.cos(ang) * .3, -.135, .05 + math.sin(ang) * .3))
        a.part('Boss_bolts', 'Steel').cyl(.025, .03, loc=p, rot=(R90 + .1, 0, 0), seg=6, bevel=0)
    for x in (-.35, .35):
        a.part('Plate_handles', 'Steel').box((.06, .08, .7), loc=at(fwd, (x, .11, -.1)), rot=(.1, 0, 0), bevel=0)
    # Gun: cooling jackets and housing bolts (Barrel_* recoils with the gun), an ammo feed to the mount.
    for dz in (-.05, .05):
        for y in (-.95, -1.3):
            a.part('Barrel_gun_jackets', 'Undercarriage').cyl(.055, .08, loc=(1.02, y, 2.12 + dz), rot=FORWARD, seg=8,
                                                              bevel=0)
    bolts(a.part('Barrel_housing_bolts', 'Steel'), [(1.145, y, 2.12 + dz) for y in (-.65, -.25) for dz in (-.06, .06)],
                                                   r=.02, h=.02, rot=ACROSS)
    a.part('Barrel_housing_vents', 'Undercarriage').box((.18, .4, .02), loc=(1.02, -.45, 2.245), bevel=0)
    a.part('Ammo_feed', 'Undercarriage').tube([(.85, .08, 2.12), (.8, .25, 2.05), (.62, .4, 2.0)], .04, seg=6)


# ----------------------------------------------------------------------------- moth
def moth_detail(a):
    A = a.armor
    z = .62
    wz = z + .12
    for s in (-1, 1):
        dih = -s * .1
        rot = Matrix.Rotation(dih, 4, 'Y')

        def on(x, y, h=.03):
            return tuple(Vector((0, 0, wz)) + rot @ Vector((x, y, h)))

        def vein(name, p0, p1, w=.03, hgt=.025):
            a.part(name, A).limb(on(s * p0[0], p0[1], hgt), on(s * p1[0], p1[1], hgt), w, w * .8, bevel=0, seg=1)
        # Forewing veins fanning from the root and cross veins between them (moth wing cells).
        for p1 in ((1.75, -.45), (1.45, .05), (.95, .18)):
            vein('Wing_veins', (.22, -.1), p1)
        for p0, p1 in (((.8, -.38), (.75, .05)), ((1.3, -.5), (1.25, -.05)), ((1.55, -.5), (1.6, -.12))):
            vein('Wing_cross_veins', p0, p1, .025)
        # Hindwing veins.
        for p1 in ((1.25, .55), (.9, 1.02), (.5, .9)):
            vein('Hindwing_veins', (.2, .2), p1, .03, -.005)
        # Edge spots along the trailing edges (mauve dots on the violet membrane).
        for x, y in ((1.68, -.2), (1.48, .0), (1.2, .08), (.95, .12)):
            a.part('Wing_spots', A).cyl(.045, .02, loc=on(s * x, y, .025), rot=(0, dih, 0), seg=8, bevel=0)
        for x, y in ((1.22, .7), (1.05, .98), (.7, 1.04)):
            a.part('Wing_spots', A).cyl(.045, .02, loc=on(s * x, y, -.005), rot=(0, dih, 0), seg=8, bevel=0)
        # Eyespot pupil, a steel ring round the eyespot and a wing-root hinge.
        a.part('Eyespot_pupils', 'Lens').cyl(.06, .02, loc=on(s * 1.18, -.2, .06), rot=(0, dih, 0), seg=8, bevel=0)
        a.part('Eyespot_rings', 'Steel').torus(.215, .012, loc=on(s * 1.18, -.2, .04), rot=(0, dih, 0), seg=14, ring=3)
        a.part('Wing_hinges', 'Steel').cyl(.06, .24, loc=(s * .2, -.05, wz + .01), rot=FORWARD, seg=8, bevel=0)
        # Leg claws, thorax side plates and abdomen spiracles.
        for y in (-.25, -.05, .15):
            a.part('Leg_claws', 'Steel').box((.05, .07, .04), loc=(s * .26, y + .12, z - .39), bevel=0)
        a.part('Thorax_plates', 'Steel').box((.02, .3, .12), loc=(s * .262, -.05, z - .02), bevel=0)
        bolts(a.part('Abdomen_spiracles', 'Steel'), [(s * .185, y, z - .02) for y in (.6, .9)], r=.02, h=.02, rot=ACROSS)
    # Thorax: a steel collar behind the head, fur ridges, a team stripe down the back.
    a.part('Neck_collar', 'Steel').torus(.15, .025, loc=(0, -.4, z + .02), rot=FORWARD, seg=12, ring=4)
    for y in (-.3, -.1, .1, .25):
        a.part('Thorax_ridges', 'Cloak').box((.3, .05, .04), loc=(0, y, z + .225 - abs(y) * .1), bevel=0)
    a.part('Thorax_stripe', 'Team').box((.08, .55, .03), loc=(0, -.03, z + .245), bevel=0)
    # Beam gun: cooling rings (Barrel_* recoils), pylon bolts.
    for y in (-.5, -.62):
        a.part('Barrel_beam_rings', 'Steel').torus(.07, .014, loc=(0, y, z - .38), rot=FORWARD, seg=8, ring=3)
    bolts(a.part('Pylon_bolts', 'Steel'), [(s * .065, y, z - .28) for s in (-1, 1) for y in (-.18, -.02)], r=.018, h=.015,
                                         rot=ACROSS)


# ----------------------------------------------------------------------------- halo
def halo_detail(a):
    z = .55
    # Ring: bolts round the outer face and short seam plates across it.
    for k in range(20):
        ang = k * math.tau / 20 + math.pi / 20
        a.part('Ring_bolts', 'Steel').cyl(.026, .03, loc=(math.cos(ang) * 1.205, math.sin(ang) * 1.205, z), rot=radial(ang),
                                         seg=6, bevel=0)
    for k in range(8):
        ang = k * math.pi / 4 + math.pi / 8
        c, s = math.cos(ang), math.sin(ang)
        a.part('Ring_seams', 'Undercarriage').box((.03, .02, .08), loc=(c * 1.2, s * 1.2, z), rot=(0, 0, ang + R90),
                                                  bevel=0)
    # Struts: collars at both ends.
    for k in range(4):
        ang = math.pi / 4 + k * R90
        c, s = math.cos(ang), math.sin(ang)
        for r, zz in ((.36, z + .08), (.9, z + .045)):
            a.part('Strut_collars', 'Steel').box((.1, .1, .1), loc=(c * r, s * r, zz), rot=(0, 0, ang), bevel=0)
    # Tower shields: steel rims and bolts.
    for s in (-1, 1):
        for zz in (-.2, .2):
            a.part('Shield_rims', 'Steel').box((.12, .5 - (zz + .22) * .2, .03), loc=(s * 1.245, 0, z + zz), bevel=0)
        bolts(a.part('Shield_bolts', 'Steel'), [(s * 1.31, y, z + dz) for y in (-.17, .17) for dz in (-.12, .12)],
                                              r=.02, h=.02, rot=ACROSS)
    # Fan: hazard tips and a cap on the spin pivot.
    for i in range(3):
        ang = i * math.pi / 3
        for e in (-1, 1):
            c, d = math.cos(ang) * e * .8, math.sin(ang) * e * .8
            air.box(a, 'Fan_tips', 'Hazard', (.16, .17, .03), (c, d, 0), rot=(.2, 0, ang), bevel=0, parent='spin_fan')
    air.cyl(a, 'Fan_cap', 'Steel', .07, .04, (0, 0, .045), seg=8, bevel=0, parent='spin_fan')
    # Core: a seam ring, rivets, side lights, an antenna; thruster vanes.
    a.part('Core_seam', 'Steel').torus(.31, .014, loc=(0, 0, z + .24), seg=12, ring=3)
    for k in range(6):
        ang = k * math.pi / 3 + math.pi / 6
        a.part('Core_rivets', 'Steel').cyl(.02, .02, loc=(math.cos(ang) * .345, math.sin(ang) * .4, z + .05),
                                           rot=radial(ang), seg=6, bevel=0)
    for s in (-1, 1):
        a.part('Core_lights', 'TeamGlow').box((.03, .07, .04), loc=(s * .35, .12, z + .14), bevel=0)
    a.part('Antenna', 'Steel').cyl(.01, .26, loc=(.12, .22, z + .48), seg=5, bevel=0)
    for k in range(4):
        ang = k * R90
        a.part('Thruster_vanes', 'Steel').box((.03, .14, .12), loc=(math.cos(ang) * .17, math.sin(ang) * .17, z - .2),
                                              rot=(0, 0, ang + R90), bevel=0)
    # Guns: cooling jackets (Barrel_* recoils) and housing vents.
    for s in (-1, 1):
        for y in (-.85, -1.15):
            a.part('Barrel_guns_jackets', 'Undercarriage').cyl(.05, .07, loc=(s * .22, y, z - .06), rot=FORWARD, seg=8,
                                                               bevel=0)
        a.part('Gun_vents', 'Undercarriage').grille(.3, .1, loc=(s * .22 + s * .075, -.42, z - .06), rot=(0, 0, -s * R90),
                                                    slats=2, depth=.02, thickness=.02)


DETAILS = {'hawk': hawk_detail, 'balloon': balloon_detail, 'glider': glider_detail, 'lancer': lancer_detail,
           'bulwark': bulwark_detail, 'moth': moth_detail, 'halo': halo_detail}
