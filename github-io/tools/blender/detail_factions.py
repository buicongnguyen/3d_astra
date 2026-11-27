"""Close-up detail models (H3b, batch 2): the eight faction-unique units (generate_factions.py).

Each function adds small surface parts to the normal model after generate_factions.BUILDERS[kind](a) and before
consolidate(a) + finish (tools/blender/generate_detail.py build_kind): rivets and weld beads, straps, buckles and
laces, gauges, hoses and heat bands, rails and vents on the guns, panel seams, sensor lights, piping and trims.
Only the unit's own materials, the builder's pivots (leg_L / leg_R) and the gun-rig names (Turret_head*, Barrel*,
Muzzle*) for parts that move; no new part named Knee*, Wheel*, Tyres*, Spokes*, Tracks* or Sail.
"""
import math

from mathutils import Euler, Vector

from faction_parts import ACROSS, FORWARD, R, Body, at, box, cyl, frame, limb, prism, rivets, torus

SIDES = ((-1, 'L'), (1, 'R'))


# ----------------------------------------------------------------------------- helpers
def frot(m, r=(0, 0, 0)):
    """A local rotation r inside rigid frame m, as model-space Euler angles."""
    return tuple((m.to_3x3() @ Euler(r, 'XYZ').to_matrix()).to_euler('XYZ'))


def studs(a, name, mat, m, points, r=.024, h=.03, axis=FORWARD, parent=None, seg=6):
    """Plain studs at points local to frame m, their axis along the frame's local `axis` rotation."""
    rivets(a, name, mat, [at(m, p) for p in points], r=r, h=h, rot=frot(m, axis), parent=parent, seg=seg)


def lerp(p, q, t):
    return tuple(a + (b - a) * t for a, b in zip(p, q))


def aligned(n):
    """Rotation taking local +Z onto direction n."""
    return tuple(Vector((0, 0, 1)).rotation_difference(Vector(n).normalized()).to_euler('XYZ'))


def ellipsoid(c, radii, th, ph, off=.005):
    """A point on an ellipsoid (azimuth th from +X toward +Y, elevation ph) pushed out by off, and its normal."""
    rx, ry, rz = radii
    d = Vector((rx * math.cos(ph) * math.cos(th), ry * math.cos(ph) * math.sin(th), rz * math.sin(ph)))
    n = Vector((d.x / rx ** 2, d.y / ry ** 2, d.z / rz ** 2)).normalized()
    return tuple(Vector(c) + d + n * off), tuple(n)


def lathe_at(profile, i, t, ang, off=.006):
    """A point on a lathe surface (profile [(r, z)...] round Z) between profile points i and i+1, and its normal."""
    (r0, z0), (r1, z1) = profile[i], profile[i + 1]
    r, z = r0 + (r1 - r0) * t, z0 + (z1 - z0) * t
    nr, nz = z1 - z0, -(r1 - r0)
    k = math.hypot(nr, nz)
    nr, nz = nr / k, nz / k
    n = Vector((nr * math.cos(ang), nr * math.sin(ang), nz))
    return tuple(Vector((r * math.cos(ang), r * math.sin(ang), z)) + n * off), tuple(n)


def ring_studs(a, name, mat, centre, radius, n, axis_rot, r=.022, h=.025, skip=(), parent=None, start=0.0):
    """n studs on a circle (radius, in the frame of axis_rot at centre), facing along that frame's Z."""
    m = frame(centre, axis_rot)
    pts = [(math.cos(start + k * math.tau / n) * radius, math.sin(start + k * math.tau / n) * radius, 0) for k in range(n) if k not in skip]
    studs(a, name, mat, m, pts, r=r, h=h, axis=(0, 0, 0), parent=parent)


# ============================================================================ Ashfall
def scrapper(a):
    A = a.armor
    T = Body((0, .03, 1.1), .24)
    # Legs (on the hip pivots): ankle wraps with a steel buckle, boot laces, side rivets on the shins; a thigh
    # strap on both and a thigh pouch on the right (the left hip carries the hook on its chain).
    for s, side in SIDES:
        p = 'leg_' + side
        box(a, 'Thigh_strap', 'Undercarriage', (.29, .3, .04), (0, .01, -.15), bevel=0, parent=p)
        box(a, 'Leg_buckles', 'Steel', (.06, .02, .05), (0, -.145, -.15), bevel=0, parent=p)
        box(a, 'Ankle_wrap', 'Undercarriage', (.31, .34, .04), (0, -.03, -.79), bevel=0, parent=p)
        box(a, 'Leg_buckles', 'Steel', (.06, .02, .05), (0, -.205, -.79), bevel=0, parent=p)
        for y in (-.13, -.19, -.25):
            box(a, 'Boot_laces', 'Steel', (.15, .025, .016), (0, y, -.755), bevel=0, parent=p)
        rivets(a, 'Shin_rivets', 'Steel', [(x, -.03, z) for x in (-.158, .158) for z in (-.58, -.72)], r=.022, h=.022, rot=ACROSS, parent=p)
        box(a, 'Boot_heel', 'Steel', (.22, .05, .06), (0, .19, -.86), bevel=0, parent=p)
        if s > 0:
            box(a, 'Thigh_pouch', A, (.06, .15, .13), (.165, .0, -.27), bevel=.012, parent=p)
            box(a, 'Leg_buckles', 'Steel', (.015, .04, .04), (.2, .0, -.25), bevel=0, parent=p)
        else:
            rivets(a, 'Shin_rivets', 'Steel', [(x, -.252, -.47) for x in (-.07, .07)], r=.02, h=.02, rot=FORWARD, parent=p)

    # Belt rivets, a snap on the pouch, two grenades at the back of the belt.
    rivets(a, 'Belt_rivets', 'Steel', [(x, -.175, 1.1) for x in (-.24, -.15, .15, .24)], r=.02, h=.02)
    box(a, 'Pouch_snap', 'Steel', (.04, .02, .04), (.33, -.145, 1.03), bevel=0)
    for x in (-.15, .15):
        cyl(a, 'Grenades', 'Undercarriage', .045, .1, (x, .25, 1.02), seg=8, bevel=0)
        cyl(a, 'Grenade_caps', 'Steel', .025, .04, (x, .25, 1.09), seg=6, bevel=0)

    # Chest: weld beads round the rust plate, shells on the bandolier, rivets on the hazard patch.
    for (x0, z0), (x1, z1) in (((-.3, .345), (0, .37)), ((-.3, .345), (-.32, .65)), ((0, .37), (.01, .66))):
        limb(a, 'Weld_beads', 'Steel', T.p((x0, -.255, z0)), T.p((x1, -.255, z1)), .018, .018, bevel=0)
    for k in range(6):
        p = lerp((-.27, -.262, .62), (.27, -.262, .22), (k + .5) / 6)
        cyl(a, 'Shells', 'Hazard', .02, .065, T.p(p), T.rot((0, .9, 0)), seg=6, bevel=0)
    mh = T.m @ frame((.17, -.25, .3), (0, 0, -.16))
    studs(a, 'Rivets_more', 'Steel', mh, [(x, -.03, z) for x in (-.11, .11) for z in (-.065, .065)], r=.018, h=.02)

    # Pauldron: rivets along the top and the rim; the right shoulder plate riveted too.
    mp = T.m @ frame((-.5, .02, .68), (0, -.38, 0))
    studs(a, 'Rivets_more', 'Steel', mp, [(x, y, .172) for x in (-.13, .1) for y in (-.2, 0, .2)], r=.026, h=.03, axis=(0, 0, 0))
    mr = T.m @ frame((-.54, .02, .52), (0, -.38, 0))
    studs(a, 'Rivets_more', 'Steel', mr, [(x, -.305, 0) for x in (-.18, -.06, .06, .18)], r=.02, h=.02)
    ms = T.m @ frame((.48, .01, .62), (0, .32, 0))
    studs(a, 'Rivets_more', 'Steel', ms, [(x, y, .1) for x in (-.1, .1) for y in (-.13, .13)], r=.022, h=.025, axis=(0, 0, 0))

    # Boiler: rivets on both bands, a pressure gauge, a valve wheel and a pipe to the stack.
    for z in (.26, .62):
        for ang in (0, .6, 1.2, 1.9, 2.5, math.pi):
            p = (math.cos(ang) * .207, .37 + math.sin(ang) * .207, z)
            cyl(a, 'Boiler_rivets', 'Steel', .018, .03, T.p(p), frot(T.m, aligned((math.cos(ang), math.sin(ang), 0))), seg=6, bevel=0)
    mg = T.m @ frame((.1, .575, .44), (-R, 0, 0))
    cyl(a, 'Gauge', 'Steel', .06, .03, at(mg, (0, 0, 0)), frot(mg), seg=10, bevel=0)
    cyl(a, 'Gauge_face', 'Undercarriage', .045, .01, at(mg, (0, 0, .018)), frot(mg), seg=10, bevel=0)
    box(a, 'Gauge_face', 'Hazard', (.008, .04, .006), at(mg, (0, .012, .024)), frot(mg, (0, 0, .5)), bevel=0)
    mv = T.m @ frame((-.205, .37, .44), (0, -R, 0))
    torus(a, 'Valve', 'Steel', .05, .012, at(mv, (0, 0, .03)), frot(mv), seg=8, ring=3)
    box(a, 'Valve', 'Steel', (.1, .012, .012), at(mv, (0, 0, .03)), frot(mv), bevel=0)
    a.part('Boiler_pipe', 'Steel').tube([T.p((.19, .37, .5)), T.p((.21, .43, .62)), T.p((.14, .47, .7))], .025, seg=6)
    # Exhaust stacks: two heat bands each.
    for x in (-.13, .13):
        b = T.p((x, .44, .7))
        for z in (1.55, 1.9):
            cyl(a, 'Stack_bands', 'Steel', .072, .03, (b[0], b[1] + .05, z), seg=8, bevel=0)

    # Helmet: a goggle strap round the sides and back, side rivets; a breathing hose from the filter.
    mh = T.m @ frame((0, -.04, 1.0), (-.12, 0, 0))
    for s in (-1, 1):
        box(a, 'Mask_strap', 'Undercarriage', (.02, .36, .05), at(mh, (s * .213, -.02, -.03)), frot(mh), bevel=0)
        studs(a, 'Rivets_more', 'Steel', mh, [(s * .214, y, .07) for y in (-.12, .06)], r=.02, h=.02, axis=ACROSS)
    box(a, 'Mask_strap', 'Undercarriage', (.38, .02, .05), at(mh, (0, .19, -.03)), frot(mh), bevel=0)
    a.part('Mask_hose', 'Undercarriage').tube([T.p((.06, -.44, .74)), T.p((.17, -.36, .7)), T.p((.26, -.27, .64)), T.p((.36, -.14, .66)), T.p((.4, .02, .68))], .028, seg=6)
    mm = T.m @ frame((0, -.26, .9), (.1, 0, 0))
    for x in (-.15, .15):
        cyl(a, 'Mask_vents', 'Steel', .03, .03, at(mm, (x, -.09, -.06)), frot(mm, FORWARD), seg=8, bevel=0)

    # Arms: straps round the gauntlets, rivets on the elbow pads.
    for s, elbow, wrist in ((1, (.5, -.16, 1.34), (.3, -.44, 1.22)), (-1, (-.36, -.42, 1.36), (.14, -.78, 1.27))):
        for t in (.35, .6):
            limb(a, 'Gauntlet_straps', 'Undercarriage', lerp(elbow, wrist, t), lerp(elbow, wrist, t + .07), .225, .235, bevel=0)
        rivets(a, 'Rivets_more', 'Steel', [(elbow[0] + s * .082, elbow[1] + dy, elbow[2]) for dy in (-.04, .04)], r=.018, h=.02, rot=ACROSS)

    # Scattergun: a sight rail with notches, receiver bolts, a drum hub and rivets, barrel bands, heat-shield slots,
    # a sling.
    box(a, 'Gun_rail', 'Steel', (.045, .44, .022), (.27, -.64, 1.348), rot=(-.05, 0, 0), bevel=0)
    for y in (-.5, -.6, -.7, -.8):
        box(a, 'Gun_rail', 'Steel', (.06, .015, .012), (.27, y, 1.362 + (-.62 - y) * .05), bevel=0)
    rivets(a, 'Gun_bolts', 'Steel', [(.27 + s * .087, y, 1.26) for s in (-1, 1) for y in (-.45, -.75)], r=.018, h=.02, rot=ACROSS)
    cyl(a, 'Drum_hub', 'Steel', .045, .155, (.27, -.56, 1.06), rot=ACROSS, seg=8, bevel=0)
    for s in (-1, 1):
        ring_studs(a, 'Gun_bolts', 'Steel', (.27 + s * .068, -.56, 1.06), .1, 6, (0, R, 0), r=.014, h=.015)
    for y in (-.84, -1.12):
        cyl(a, 'Gun_bands', 'Steel', .082, .03, (.27, y, 1.28), rot=FORWARD, seg=10, bevel=0)
    for y in (-.86, -.94, -1.02, -1.1):
        box(a, 'Shield_slots', 'Undercarriage', (.09, .025, .008), (.27, y, 1.386), bevel=0)
    limb(a, 'Sling', 'Undercarriage', (.36, -.24, 1.16), (.36, -.86, 1.22), .04, .015, bevel=0)


def scorcher(a):
    A = a.armor
    # Glacis: a driver's hatch with a handle and two vision blocks.
    g = frame((-.3, -.962, .842), (.63, 0, 0))
    cyl(a, 'Driver_hatch', A, .15, .04, at(g, (0, 0, 0)), frot(g), seg=10, bevel=.01)
    box(a, 'Hatch_handle', 'Steel', (.14, .025, .025), at(g, (0, .04, .03)), frot(g), bevel=0)
    for x in (-.08, .08):
        box(a, 'Vision_blocks', 'Undercarriage', (.07, .04, .05), at(g, (x, -.19, .02)), frot(g), bevel=0)
    studs(a, 'Hull_rivets', 'Steel', g, [(x, y, .02) for x in (-.19, .19) for y in (-.12, .12)], r=.02, h=.025, axis=(0, 0, 0))
    # Deck: rivets along both deck edges, the fender tops and the skirt bottoms; tow hooks at the back.
    rivets(a, 'Hull_rivets', 'Steel', [(s * .6, y, .99) for s in (-1, 1) for y in (-.66, -.1, .2, .9)], r=.025, h=.03, rot=(0, 0, 0))
    rivets(a, 'Hull_rivets', 'Steel', [(s * .87, y, .725) for s in (-1, 1) for y in (-1.05, -.55, -.05, .45, .95)], r=.025, h=.025, rot=(0, 0, 0))
    rivets(a, 'Hull_rivets', 'Steel', [(s * 1.163, y, .4) for s in (-1, 1) for y in (-1.0, -.6, -.2, .2, .6, 1.0)], r=.022, h=.03, rot=ACROSS)
    for s in (-1, 1):
        torus(a, 'Tow_hooks', 'Steel', .07, .02, (s * .5, 1.26, .5), rot=ACROSS, seg=8, ring=3)
        box(a, 'Tow_hooks', 'Steel', (.14, .05, .05), (s * .5, 1.25, .58), bevel=0)
        # Fender braces under the fender lip.
        for y in (-.8, .9):
            limb(a, 'Fender_braces', 'Steel', (s * 1.06, y, .675), (s * .9, y, .52), .04, .04, bevel=0)
    # A shovel on the left fender, spare track links on the right one.
    limb(a, 'Shovel', 'Steel', (-.82, -.75, .74), (-.82, .05, .74), .04, .03, bevel=0)
    box(a, 'Shovel', A, (.16, .2, .02), (-.82, -.86, .73), bevel=0)
    for y in (-.6, -.4, -.2):
        box(a, 'Spare_links', 'Undercarriage', (.3, .14, .035), (.84, y, .74), bevel=0)
        rivets(a, 'Hull_rivets', 'Steel', [(.84 + x, y, .76) for x in (-.1, .1)], r=.018, h=.02, rot=(0, 0, 0))
    # Rear: bolts round the engine grille.
    rivets(a, 'Hull_rivets', 'Steel', [(x, 1.26, z) for x in (-.4, .4) for z in (.58, .82)], r=.022, h=.025, rot=FORWARD)
    # Fuel tank: a filler cap, a gauge on the end, a fuel hose to the deck, rivets on the straps and bands.
    cyl(a, 'Filler_cap', 'Steel', .07, .06, (.22, .66, 1.63), seg=8, bevel=0)
    cyl(a, 'Filler_cap', 'Undercarriage', .045, .03, (.22, .66, 1.67), seg=8, bevel=0)
    cyl(a, 'Tank_gauge', 'Steel', .07, .03, (.59, .66, 1.38), rot=ACROSS, seg=10, bevel=0)
    cyl(a, 'Tank_gauge', 'Undercarriage', .052, .01, (.607, .66, 1.38), rot=ACROSS, seg=10, bevel=0)
    a.part('Fuel_hose', 'Undercarriage').tube([(-.56, .56, 1.16), (-.62, .44, 1.04), (-.58, .3, 1.0)], .03, seg=6)
    for x in (-.15, .15):
        rivets(a, 'Hull_rivets', 'Steel', [(x, .66 + dy, 1.0) for dy in (-.07, .07)], r=.018, h=.02, rot=(0, 0, 0))
    for x in (-.36, .36):
        ring_studs(a, 'Hull_rivets', 'Steel', (x, .66, 1.3), .335, 7, (0, R, 0), r=.016, h=.02, skip=(4, 5, 6), start=.3)
    # Stacks: two heat bands each.
    for s in (-1, 1):
        for z in (1.45, 1.85):
            cyl(a, 'Stack_bands', 'Steel', .108, .04, (s * .56, 1.04, z), seg=10, bevel=0)
    # Turret (Turret_head* turns with the turret): rivets round the top and on the side plates and mantlet, the
    # hatch handle and hinge, a periscope, grab rails and smoke dischargers.
    top = [(-.4, .4), (.4, .4), (.46, .0), (.34, -.38), (-.34, -.38), (-.46, .0)]
    rivets(a, 'Turret_head_rivets', 'Steel', [(x * .74, -.28 + y * .74, 1.42) for x, y in top], r=.022, h=.025, rot=(0, 0, 0))
    rivets(a, 'Turret_head_rivets', 'Steel', [(.495, y, z) for y in (-.45, -.15) for z in (1.12, 1.28)], r=.02, h=.025, rot=ACROSS)
    rivets(a, 'Turret_head_rivets', 'Steel', [(-.495, y, z) for y in (-.38, -.1) for z in (1.1, 1.25)], r=.02, h=.025, rot=ACROSS)
    rivets(a, 'Turret_head_rivets', 'Steel', [(x, -.735, z) for x in (-.13, .13) for z in (1.12, 1.32)], r=.02, h=.025, rot=FORWARD)
    box(a, 'Turret_head_handle', 'Steel', (.16, .025, .025), (.12, -.2, 1.5), bevel=0)
    box(a, 'Turret_head_handle', 'Steel', (.06, .06, .05), (.12, .02, 1.47), bevel=0)
    box(a, 'Turret_head_periscope', 'Steel', (.1, .08, .08), (-.16, -.5, 1.44), bevel=0)
    box(a, 'Turret_head_periscope', 'Undercarriage', (.08, .02, .04), (-.16, -.545, 1.45), bevel=0)
    for s in (-1, 1):
        for k in (0, 1):
            cyl(a, 'Turret_head_smoke', 'Steel', .035, .14, (s * (.2 + k * .08), .0, 1.45), rot=(-.6, 0, 0), seg=6, bevel=0)
    # Flame gun (Barrel* / Muzzle*: aim and recoil): cage bars between the cage rings, cooling fins, a fuel line under
    # the barrel and a steel band at the nozzle.
    for k in range(4):
        ang = math.pi / 4 + k * R
        box(a, 'Barrel_cage_bars', A, (.025, .58, .025), (math.cos(ang) * .128, -1.18, 1.26 + math.sin(ang) * .128), rot=(0, ang, 0), bevel=0)
    for y in (-1.05, -1.15, -1.25, -1.35):
        cyl(a, 'Barrel_fins', 'Steel', .118, .022, (0, y, 1.26), rot=FORWARD, seg=10, bevel=0)
    a.part('Barrel_fuel_line', 'Undercarriage').tube([(.06, -.72, 1.15), (.07, -1.0, 1.145), (.07, -1.55, 1.15)], .022, seg=5)
    cyl(a, 'Muzzle_band', 'Steel', .128, .03, (0, -1.71, 1.26), rot=FORWARD, seg=10, bevel=0)


# ============================================================================ Sunward
def rider(a):
    A = a.armor
    # Engine under the tank: a dark block with brass cooling fins and an exhaust pipe under the right pannier.
    box(a, 'Engine', 'Undercarriage', (.22, .34, .2), (0, -.12, .8), bevel=.02)
    for y in (-.24, -.16, -.08, .0):
        box(a, 'Engine_fins', 'Hazard', (.27, .025, .16), (0, y, .82), bevel=0)
    a.part('Exhaust_pipe', 'Hazard').tube([(.12, -.05, .72), (.18, .3, .62), (.21, .7, .6), (.22, 1.0, .66)], .035, seg=6)
    cyl(a, 'Exhaust_pipe', 'Undercarriage', .045, .04, (.22, 1.02, .665), rot=(R - .2, 0, 0), seg=8, bevel=0)
    # Fork sleeves, headlamp rim and visor, a cap, a team stripe and straps on the tank.
    for s in (-1, 1):
        top, bottom = (s * .11, -.62, 1.18), (s * .11, -.92, .52)
        limb(a, 'Fork_sleeves', 'Hazard', lerp(top, bottom, .25), lerp(top, bottom, .5), .075, .075, bevel=0)
    torus(a, 'Lamp_rim', 'Undercarriage', .1, .016, (0, -.965, 1.18), rot=FORWARD, seg=10, ring=3)
    box(a, 'Lamp_visor', 'Undercarriage', (.2, .08, .02), (0, -.97, 1.28), rot=(-.3, 0, 0), bevel=0)
    cyl(a, 'Tank_cap', 'Undercarriage', .05, .04, (0, -.36, 1.27), rot=(.12, 0, 0), seg=8, bevel=0)
    box(a, 'Tank_stripe', 'Team', (.06, .34, .02), (0, -.2, 1.263), rot=(.12, 0, 0), bevel=0)
    for y in (-.1, -.42):
        box(a, 'Tank_straps', 'Undercarriage', (.34, .04, .26), (0, y, 1.13 - (y + .26) * .12), rot=(.12, 0, 0), bevel=0)
    # Seat studs; pannier straps with brass buckles and pockets; brass studs on the fan rays.
    rivets(a, 'Brass_studs', 'Hazard', [(s * .155, y, 1.08) for s in (-1, 1) for y in (.12, .3, .48)], r=.018, h=.02, rot=ACROSS)
    for s in (-1, 1):
        for y in (.62, .9):
            box(a, 'Pannier_straps', 'Undercarriage', (.02, .05, .32), (s * .395, y, .86), bevel=0)
            box(a, 'Pannier_buckles', 'Hazard', (.02, .06, .05), (s * .405, y, .82), bevel=0)
        box(a, 'Pannier_pockets', A, (.03, .2, .14), (s * .4, .76, .8), bevel=.01)
    for k in range(5):
        ang = math.radians(18 + k * 36)
        rivets(a, 'Brass_studs', 'Hazard', [(math.cos(ang) * .56, 1.025, 1.22 + math.sin(ang) * .56)], r=.02, h=.02, rot=FORWARD)
    cyl(a, 'Whip_tassel', 'Team', .03, .08, (.3, 1.1, 2.72), seg=6, bevel=0)
    # Rider: duster buttons, a bandolier with brass cartridges, a sash buckle, pocket flaps, studs on the pads.
    T = Body((0, .28, 1.18), .4)
    for z in (.22, .34, .46):
        cyl(a, 'Brass_studs', 'Hazard', .018, .02, T.p((.08, -.196, z)), T.rot(FORWARD), seg=6, bevel=0)
    limb(a, 'Bandolier', 'Undercarriage', T.p((-.22, -.2, .54)), T.p((.22, -.2, .16)), .06, .02, bevel=0)
    for k in range(5):
        p = lerp((-.18, -.215, .5), (.18, -.215, .19), (k + .5) / 5)
        cyl(a, 'Cartridges', 'Hazard', .015, .05, T.p(p), T.rot((0, .85, 0)), seg=6, bevel=0)
    box(a, 'Sash_buckle', 'Hazard', (.09, .02, .07), T.p((0, -.206, .1)), T.rot(), bevel=0)
    for s in (-1, 1):
        box(a, 'Pocket_flaps', 'Undercarriage', (.12, .02, .05), T.p((s * .16, -.195, .2)), T.rot(), bevel=0)
        mp = T.m @ frame((s * .3, .0, .55), (0, s * .35, 0))
        studs(a, 'Brass_studs', 'Hazard', mp, [(0, y, .072) for y in (-.11, .11)], r=.018, h=.02, axis=(0, 0, 0))
    # Head: dark goggle lenses on a strap, a brass sun badge on the hat band.
    H = Body(T.p((0, -.02, .62)), .12)
    for x in (-.075, .075):
        cyl(a, 'Goggle_lenses', 'Undercarriage', .033, .02, H.p((x, -.197, .16)), H.rot(FORWARD), seg=8, bevel=0)
    torus(a, 'Goggle_strap', 'Undercarriage', .176, .012, H.p((0, .0, .16)), H.rot(), seg=12, ring=3)
    cyl(a, 'Hat_badge', 'Hazard', .045, .02, H.p((0, -.196, .315)), H.rot((-.08 + R, 0, 0)), seg=8, bevel=0)
    # Arms: dark cuffs and elbow patches; grips and brake levers on the bars.
    for s in (-1, 1):
        shoulder = T.p((s * .3, .0, .5))
        hand = (s * .33, -.62, 1.36)
        elbow = (s * .36, -.24, 1.42)
        limb(a, 'Cuffs', 'Undercarriage', lerp(elbow, hand, .62), lerp(elbow, hand, .78), .165, .185, bevel=0)
        limb(a, 'Elbow_patches', A, lerp(shoulder, elbow, .82), lerp(elbow, hand, .12), .175, .195, bevel=0)
        box(a, 'Bar_grips', 'Hazard', (.025, .05, .07), (s * .41, -.62, 1.34), bevel=0)
        box(a, 'Brake_levers', 'Hazard', (.12, .02, .02), (s * .3, -.69, 1.33), rot=(0, 0, s * .15), bevel=0)
    # Twin carbines (Barrel_*: aim and recoil): brass bands, a sight on each body, a magazine under it.
    for s in (-1, 1):
        x = s * .17
        for y in (-.9, -1.1):
            cyl(a, 'Barrel_twin_bands', 'Hazard', .045, .03, (x, y, 1.36), rot=FORWARD, seg=8, bevel=0)
        box(a, 'Barrel_twin_sight', 'Hazard', (.03, .1, .04), (x, -.66, 1.41), bevel=0)
        box(a, 'Barrel_twin_mag', 'Undercarriage', (.05, .08, .1), (x, -.64, 1.25), rot=(.2, 0, 0), bevel=0)
        cyl(a, 'Barrel_twin_tip', 'Hazard', .042, .04, (x, -1.21, 1.36), rot=FORWARD, seg=8, bevel=0)
    # Legs (on the leg pivots): dark shin guards with brass studs, boot straps, a strap round the thigh.
    for s, side in SIDES:
        p = 'leg_' + side
        x = s * .07
        limb(a, 'Shin_guards', 'Undercarriage', (x, -.535, -.27), (x, -.465, -.56), .15, .03, bevel=0, parent=p)
        rivets(a, 'Leg_studs', 'Hazard', [(x, -.555, -.33), (x, -.53, -.47)], r=.018, h=.02, rot=FORWARD, parent=p)
        box(a, 'Boot_straps', 'Hazard', (.21, .37, .03), (x, -.42, -.61), bevel=0, parent=p)
        box(a, 'Boot_straps', 'Undercarriage', (.21, .06, .035), (x, -.56, -.64), bevel=0, parent=p)
        limb(a, 'Thigh_straps', 'Undercarriage', lerp((0, 0, 0), (x, -.42, -.2), .45), lerp((0, 0, 0), (x, -.42, -.2), .52), .215, .235, bevel=0, parent=p)


def wagon(a):
    A = a.armor

    def bed_x(z):  # the bed's side face (it widens toward the top)
        return .78 + (z - .67) / .38 * .078
    # Bed: plank grooves on both sides, rivets on the trim, iron corner brackets, a steel-strapped tailgate.
    for s in (-1, 1):
        for z in (.92, .99):
            for y0, y1 in ((-1.2, -.25), (.29, 1.18)):
                box(a, 'Plank_grooves', 'Undercarriage', (.012, y1 - y0, .018), (s * (bed_x(z) + .003), (y0 + y1) / 2, z), rot=(0, -s * .2, 0), bevel=0)
        rivets(a, 'Bed_rivets', 'Steel', [(s * .838, y, .78) for y in (-1.0, -.6, .45, .8, 1.0)], r=.02, h=.02, rot=ACROSS)
        for y in (-1.24, 1.21):
            yy = y + (.03 if y < 0 else -.03)
            box(a, 'Corner_irons', 'Steel', (.05, .1, .32), (s * (bed_x(.86) + .012), yy, .86), rot=(0, -s * .2, 0), bevel=0)
            rivets(a, 'Bed_rivets', 'Steel', [(s * (bed_x(z) + .04), yy, z) for z in (.76, .96)], r=.016, h=.02, rot=ACROSS)
        box(a, 'Tailgate_straps', 'Steel', (.06, .03, .34), (s * .45, 1.245, .86), bevel=0)
        torus(a, 'Tailgate_chain', 'Steel', .04, .01, (s * .62, 1.25, 1.0), rot=(0, 0, 0), seg=6, ring=3)
    box(a, 'Tailgate_latch', 'Steel', (.12, .04, .06), (0, 1.25, .98), bevel=0)
    # Axle caps (round, so they need not roll), leaf springs between the axles and the chassis.
    for y, r in ((-.86, .4), (.78, .5)):
        for s in (-1, 1):
            cyl(a, 'Axle_caps', 'Steel', .05, .04, (s * 1.1, y, r), rot=ACROSS, seg=8, bevel=0)
            n = 3 if r < .45 else 1
            for k in range(n):
                box(a, 'Leaf_springs', 'Steel', (.09, .56 - k * .14, .022), (s * .55, y, .545 - k * .028), bevel=0)
            box(a, 'Leaf_springs', 'Undercarriage', (.1, .06, .1), (s * .55, y, r + .02 if r < .45 else .52), bevel=0)
    # Canvas: two dark straps over the tilt between the hoops, with brass buckles low on each side; rope ties at the
    # back opening.
    strap = [(math.cos(t) * .875, 1.05 + math.sin(t) * .895) for t in [math.radians(d) for d in range(0, 181, 20)]]
    strap += [(math.cos(t) * .835, 1.05 + math.sin(t) * .855) for t in [math.radians(d) for d in range(180, -1, -20)]]
    for y in (-.12, .76):
        prism(a, 'Tilt_straps', 'Undercarriage', strap, .05, loc=(0, y, 0), axis='Y', bevel=0)
        for s in (-1, 1):
            box(a, 'Tilt_buckles', 'Hazard', (.025, .07, .06), (s * .885, y, 1.16), bevel=0)
    for s in (-1, 1):
        for z in (1.15, 1.45):
            box(a, 'Rope_ties', 'Undercarriage', (.05, .03, .03), (s * .52, 1.262, z), rot=(0, s * .4, 0), bevel=0)
    # The solar fan: struts down to the tilt, brass studs at the ray tips on its back face.
    for s in (-1, 1):
        limb(a, 'Fan_struts', 'Steel', (s * .3, 1.33, 1.85), (s * .3, 1.2, 1.68), .03, .03, bevel=0)
    for k in range(5):
        ang = math.radians(18 + k * 36)
        rivets(a, 'Fan_studs', 'Hazard', [(math.cos(ang) * .42, 1.325, 1.78 + math.sin(ang) * .42)], r=.018, h=.02, rot=FORWARD)
    # Driver: buttons, a belt with a buckle, dark goggle lenses, a brass hat badge, cuffs.
    T = Body((-.3, -.92, 1.22), .1)
    for z in (.14, .26):
        cyl(a, 'Driver_buttons', 'Hazard', .016, .02, T.p((0, -.142, z)), T.rot(FORWARD), seg=6, bevel=0)
    box(a, 'Driver_belt', 'Undercarriage', (.38, .3, .05), T.p((0, 0, .06)), T.rot(), bevel=0)
    box(a, 'Driver_buttons', 'Hazard', (.06, .02, .045), T.p((0, -.152, .06)), T.rot(), bevel=0)
    for x in (-.06, .06):
        cyl(a, 'Goggle_lenses', 'Undercarriage', .025, .02, T.p((x, -.157, .57)), T.rot(FORWARD), seg=8, bevel=0)
    cyl(a, 'Hat_badge', 'Hazard', .035, .02, T.p((0, -.215, .76)), T.rot((R - .08, 0, 0)), seg=8, bevel=0)
    for s in (-1, 1):
        sh, hand = T.p((s * .2, 0, .32)), (-.3 + s * .16, -1.18, 1.32)
        limb(a, 'Driver_cuffs', 'Undercarriage', lerp(sh, hand, .72), lerp(sh, hand, .84), .125, .135, bevel=0)
    # Bench studs, footboard treads, a whip in its socket.
    rivets(a, 'Bench_studs', 'Hazard', [(x, -1.105, 1.16) for x in (-.5, -.1, .1, .5)], r=.018, h=.02, rot=FORWARD)
    rivets(a, 'Bench_studs', 'Hazard', [(x, -.79, 1.42) for x in (-.5, .5)], r=.018, h=.02, rot=(-.15 + R, 0, 0))
    for k in range(3):
        box(a, 'Footboard_treads', 'Undercarriage', (1.0, .03, .015), (0, -1.28 + k * .08, .885 + k * .028), rot=(.35, 0, 0), bevel=0)
    cyl(a, 'Whip_socket', 'Steel', .03, .14, (.5, -1.05, 1.2), seg=6, bevel=0)
    limb(a, 'Whip', 'Undercarriage', (.5, -1.05, 1.25), (.56, -1.2, 1.75), .022, .022, bevel=0)
    # Drawbar: brass caps on the yoke, a ring at the front.
    for s in (-1, 1):
        cyl(a, 'Yoke_caps', 'Hazard', .05, .05, (s * .38, -1.5, .52), rot=ACROSS, seg=8, bevel=0)
    torus(a, 'Drawbar_ring', 'Steel', .06, .015, (0, -1.56, .5), rot=(0, 0, 0), seg=8, ring=3)
    # Water kegs: end bands, a spigot at the front of each, a strap to the bed.
    for s in (-1, 1):
        for y in (-.17, .21):
            cyl(a, 'Keg_bands_more', 'Steel', .194, .03, (s * .94, y, .86), rot=FORWARD, seg=10, bevel=0)
        cyl(a, 'Keg_spigots', 'Steel', .025, .07, (s * .94, -.24, .78), rot=FORWARD, seg=6, bevel=0)
        box(a, 'Keg_spigots', 'Steel', (.02, .02, .05), (s * .94, -.27, .8), bevel=0)
        box(a, 'Keg_straps', 'Undercarriage', (.1, .04, .1), (s * .84, .02, 1.02), bevel=0)
    # Pennant pole: a bracket and a brass finial.
    box(a, 'Pole_bracket', 'Steel', (.08, .08, .12), (.72, 1.22, 1.08), bevel=0)
    cyl(a, 'Pole_finial', 'Hazard', .04, .08, (.76, 1.3, 2.74), seg=6, r2=.01, bevel=0)


# ============================================================================ Wardens
def drone(a):
    A = a.armor
    lower = [(.08, .92), (.2, .97), (.36, 1.07), (.5, 1.2), (.58, 1.33), (.6, 1.4)]
    upper = [(.57, 1.47), (.56, 1.56), (.5, 1.68), (.38, 1.8), (.2, 1.88), (.0, 1.9)]
    # Upper shell: steel panel seams down the meridians (back and sides) and a ring of studs.
    for deg in (0, 50, 90, 130, 180):
        ang = math.radians(deg)
        pts = [lathe_at(upper, i, 0, ang, .004)[0] for i in range(4)] + [lathe_at(upper, 3, .9, ang, .004)[0]]
        a.part('Shell_seams', 'Steel').tube(pts, .013, seg=3)
    for deg in range(0, 360, 30):
        if 230 < deg < 310:
            continue
        p, n = lathe_at(upper, 2, .5, math.radians(deg))
        cyl(a, 'Shell_studs', 'Steel', .022, .024, p, aligned(n), seg=6, bevel=0)
    # Lower shell: vent studs above the tail, team status lights.
    for deg in range(0, 360, 45):
        p, n = lathe_at(lower, 2, .4, math.radians(deg + 22.5))
        cyl(a, 'Shell_vents', 'Steel', .03, .03, p, aligned(n), seg=6, bevel=0)
    for deg in (0, 180, 90):
        p, n = lathe_at(lower, 3, .7, math.radians(deg))
        box(a, 'Status_lights', 'TeamGlow', (.04, .04, .02), p, aligned(n), bevel=0)
    # Eye: bolts round the bezel, a chin plate under it with two sensor lights.
    ring_studs(a, 'Eye_bolts', 'Steel', (0, -.613, 1.33), .27, 10, (R, 0, 0), r=.018, h=.02, start=math.pi / 10)
    box(a, 'Chin_plate', 'Steel', (.3, .06, .05), (0, -.56, 1.0), rot=(-.5, 0, 0), bevel=0)
    for x in (-.1, .1):
        box(a, 'Status_lights', 'TeamGlow', (.04, .02, .025), (x, -.59, 1.01), rot=(-.5, 0, 0), bevel=0)
    # Halo: ceramic node blocks round the ring.
    m = frame((0, .03, 1.16), (.14, 0, 0))
    for k in range(8):
        t = k * math.tau / 8 + math.pi / 8
        box(a, 'Halo_nodes', A, (.12, .07, .11), at(m, (math.cos(t) * .8, math.sin(t) * .8, 0)), frot(m, (0, 0, t)), bevel=0)
    # Petal shields: steel studs and a steel edge trim on the outer face of each leaf.
    lower_leaf = [(-.24, -.36), (.05, -.46), (.28, -.26), (.27, .02), (-.22, .02)]
    upper_leaf = [(-.22, 0), (.27, 0), (.33, .2), (.12, .48), (-.22, .32)]
    for s in (-1, 1):
        c = at(m, (s * .84, -.02, .12))
        for leaf, loc, r in ((lower_leaf, c, (.14, s * .2, 0)), (upper_leaf, (c[0] + s * .01, c[1], c[2] + .01), (.14, s * .55, 0))):
            ml = frame(loc, r)
            cy = sum(p[0] for p in leaf) / len(leaf)
            cz = sum(p[1] for p in leaf) / len(leaf)
            inner = [(cy + (y - cy) * .72, cz + (z - cz) * .72) for y, z in leaf]
            studs(a, 'Shield_bolts', 'Steel', ml, [(s * .048, y, z) for y, z in inner[:4]], r=.02, h=.02, axis=ACROSS)
            for (y0, z0), (y1, z1) in zip(leaf[:3], leaf[1:4]):
                limb(a, 'Shield_trim', 'Steel', at(ml, (s * .05, y0 * .97, z0 * .97)), at(ml, (s * .05, y1 * .97, z1 * .97)), .02, .02, bevel=0)
    # Emitters (Barrel_*: aim and recoil): steel rings, a ceramic fin on top, a lit lens in each tip.
    for s in (-1, 1):
        x = s * .2
        for y in (-.55, -.7):
            cyl(a, 'Barrel_emitter_rings', 'Steel', .066, .025, (x, y, 1.04), rot=FORWARD, seg=8, bevel=0)
        box(a, 'Barrel_emitter_fins', A, (.02, .2, .05), (x, -.62, 1.11), bevel=0)
        cyl(a, 'Barrel_emitter_lens', 'TeamGlow', .045, .02, (x, -.905, 1.04), rot=FORWARD, seg=8, bevel=0)
    # Crest: steel piping along its front edges on both faces.
    for x in (-.062, .062):
        for (y0, z0), (y1, z1) in (((.0, 2.4), (-.43, 2.34)), ((-.43, 2.34), (-.6, 1.91))):
            limb(a, 'Fin_piping', 'Steel', (x, y0, z0), (x, y1, z1), .018, .02, bevel=0)
    # Tail: studs on the big ring and the fins.
    ring_studs(a, 'Tail_studs', 'Steel', (0, 0, .8), .2, 6, (0, 0, 0), r=.018, h=.09)
    for s in (-1, 1):
        rivets(a, 'Tail_studs', 'Steel', [(s * .228, y, z) for y, z in ((.5, 1.05), (.58, .98))], r=.016, h=.015, rot=ACROSS)


def walker(a):
    A = a.armor
    # Legs (on the hip pivots): a hydraulic piston on the outer side of the thigh, studs on the thigh and shin, an
    # ankle guard, steel caps on the claw toes.
    for s, side in SIDES:
        p = 'leg_' + side
        cyl(a, 'Leg_piston', A, .055, .3, (s * .25, .04, -.3), rot=(.1, 0, 0), seg=8, bevel=0, parent=p)
        cyl(a, 'Leg_piston', 'Steel', .032, .32, (s * .24, .0, -.6), rot=(.1, 0, 0), seg=6, bevel=0, parent=p)
        cyl(a, 'Leg_piston', 'Steel', .05, .06, (s * .245, .055, -.14), rot=ACROSS, seg=6, bevel=0, parent=p)
        mt = frame((s * .04, -.02, -.42), (.12, 0, 0))
        studs(a, 'Leg_studs', 'Steel', mt, [(x, -.238, z) for x in (-.1, .1) for z in (-.08, .18)], r=.022, h=.025, parent=p)
        rivets(a, 'Leg_studs', 'Steel', [(x, -.205 + (z + 1.1) * .08, z) for x in (-.1, .1) for z in (-.98, -1.2)], r=.02, h=.025, rot=(R - .08, 0, 0), parent=p)
        box(a, 'Ankle_guard', 'Steel', (.2, .04, .08), (0, -.135, -1.55), rot=(-.08, 0, 0), bevel=0, parent=p)
        for ang, ln in ((0, .62), (-.6, .5), (.6, .5)):
            dx, dy = math.sin(ang) * ln, -math.cos(ang) * ln
            box(a, 'Toe_caps', 'Steel', (.08, .09, .06), (dx * .97, .05 + dy * .97, -1.69), rot=(0, 0, -ang), bevel=0, parent=p)
    # Hip bridge: front bolts.
    rivets(a, 'Hull_studs', 'Steel', [(x, -.165, z) for x in (-.5, -.2, .2, .5) for z in (1.74, 1.86)], r=.022, h=.025, rot=FORWARD)
    # Carapace: two rows of steel studs round the back and sides, a vent on the back, studs round the belly plate.
    c, radii = (0, .08, 2.62), (1.0, .98, .74)
    for ph, n in ((.32, 12), (-.12, 14)):
        for k in range(n):
            th = -R + (k + 1) * math.tau / (n + 2)
            if abs(math.sin(th) + 1) < .35:
                continue
            p, nn = ellipsoid(c, radii, th, ph)
            cyl(a, 'Shell_studs', 'Steel', .028, .03, p, aligned(nn), seg=6, bevel=0)
    for k in range(4):
        z = 2.28 + k * .1
        p, nn = ellipsoid(c, radii, R, math.asin((z - 2.62) / .74), off=.0)
        box(a, 'Back_vent', 'Steel', (.5, .07, .035), p, aligned(nn), bevel=0)
    for k in range(12):
        t = k * math.tau / 12
        cyl(a, 'Belly_studs', 'Steel', .025, .03, (math.cos(t) * .79, .08 + math.sin(t) * .79, 2.0), rot=aligned((math.cos(t), math.sin(t), 0)), seg=6, bevel=0)
    # Eye: bolts round the bezel, two sensor lights by the visor.
    ring_studs(a, 'Eye_bolts', 'Steel', (0, -.925, 2.6), .375, 10, (R, 0, 0), r=.022, h=.022, start=math.pi / 10)
    for s in (-1, 1):
        p, nn = ellipsoid(c, radii, -R + s * .5, .22, off=.0)
        box(a, 'Sensor_lights', 'TeamGlow', (.07, .05, .03), p, aligned(nn), bevel=0)
    # Crest piping along its front edges on both faces; ceramic nodes round the halo.
    for x in (-.077, .077):
        for (y0, z0), (y1, z1) in (((.06, 3.84), (-.48, 3.78)), ((-.48, 3.78), (-.79, 3.31))):
            limb(a, 'Fin_piping', 'Steel', (x, y0, z0), (x, y1, z1), .022, .025, bevel=0)
    m = frame((0, .55, 3.2), (-.6, 0, 0))
    for k in range(8):
        t = k * math.tau / 8
        box(a, 'Halo_nodes', A, (.12, .1, .16), at(m, (math.cos(t) * .92, math.sin(t) * .92, 0)), frot(m, (0, 0, t)), bevel=0)
    for s in (-1, 1):
        # Turret (Turret_head* turns with the turret): studs on the tower shields, vent slats on the arms, a steel
        # collar round each cannon.
        ms = frame((s * 1.5, -.2, 2.62), (0, s * .1, 0))
        studs(a, 'Turret_head_studs', 'Steel', ms, [(s * .065, y, z) for y in (-.38, .38) for z in (-.5, 0, .5)], r=.03, h=.03, axis=ACROSS)
        for y in (-.32, -.18, -.04, .1):
            box(a, 'Turret_head_vents', 'Steel', (.28, .05, .02), (s * 1.2, y, 2.775), bevel=0)
        torus(a, 'Turret_head_collar', 'Steel', .19, .028, (s * 1.2, -.62, 2.5), rot=FORWARD, seg=12, ring=3)
        # Cannons (Barrel* / Muzzle*: aim and recoil): cooling rings, studs on the sleeve, slots round the muzzle.
        for y in (-1.1, -1.3, -1.5):
            cyl(a, 'Barrel_rings', 'Steel', .136, .035, (s * 1.2, y, 2.5), rot=FORWARD, seg=10, bevel=0)
        for k in range(4):
            t = k * R + math.pi / 4
            cyl(a, 'Barrel_studs', 'Steel', .025, .03, (s * 1.2 + math.cos(t) * .162, -.7, 2.5 + math.sin(t) * .162),
                rot=aligned((math.cos(t), 0, math.sin(t))), seg=6, bevel=0)
            box(a, 'Muzzle_slots', 'Steel', (.035, .1, .035), (s * 1.2 + math.cos(t) * .18, -1.86, 2.5 + math.sin(t) * .18), rot=(0, -t, 0), bevel=0)


# ============================================================================ Veil
def veil_detail(a, T):
    """Shared by the Shade and the Watcher: leg straps and ankle wraps, a gem buckle, clasps on the pouches and the
    satchel, silver piping on the robe, a sigil on the chest plate and the robe, piped shoulder fins, a hood clasp
    and back trim, a team band above the cloak hem, studs where the cloak hangs."""
    for s, side in SIDES:
        p = 'leg_' + side
        box(a, 'Thigh_strap', 'Undercarriage', (.245, .3, .03), (0, .01, -.16), bevel=0, parent=p)
        box(a, 'Leg_buckles', 'Steel', (.05, .02, .04), (0, -.152, -.16), bevel=0, parent=p)
        box(a, 'Ankle_wrap', 'Undercarriage', (.26, .33, .035), (0, -.03, -.77), bevel=0, parent=p)
        rivets(a, 'Leg_studs', 'Steel', [(x, -.03, z) for x in (-.131, .131) for z in (-.56, -.7)], r=.018, h=.02, rot=ACROSS, parent=p)
        rivets(a, 'Leg_studs', 'Steel', [(x, -.228, -.46) for x in (-.06, .06)], r=.016, h=.02, rot=FORWARD, parent=p)
        box(a, 'Boot_piping', 'Steel', (.24, .02, .02), (0, -.3, -.745), bevel=0, parent=p)
    # Belt: a steel buckle with a small lit gem; clasps on the pouches, a flap and studs on the satchel.
    box(a, 'Belt_buckle', 'Steel', (.09, .02, .07), (0, -.142, 1.1), bevel=0)
    box(a, 'Buckle_gem', 'TeamGlow', (.03, .015, .03), (0, -.155, 1.1), rot=(0, .78, 0), bevel=0)
    for s in (-1, 1):
        box(a, 'Pouch_clasps', 'Steel', (.03, .02, .04), (s * .24, -.145, 1.04), bevel=0)
    box(a, 'Satchel_flap', 'Undercarriage', (.135, .2, .04), (.29, .06, 1.06), rot=(0, 0, .1), bevel=0)
    rivets(a, 'Satchel_studs', 'Steel', [(.36, .06 + y, .9) for y in (-.08, .08)], r=.016, h=.02, rot=ACROSS)
    # Robe panel: silver side piping and a team sigil.
    for s in (-1, 1):
        limb(a, 'Robe_piping_sides', 'Steel', (s * .145, -.195, 1.05), (s * .118, -.195, .63), .02, .015, bevel=0)
    prism(a, 'Robe_sigil', 'Team', [(-.045, 0), (0, -.08), (.045, 0), (0, .08)], .015, loc=(0, -.195, .84), axis='Y', bevel=0)
    # Chest plate: a steel diamond trim and corner studs.
    d = [(0, .58), (.1, .46), (0, .34), (-.1, .46)]
    for p0, p1 in zip(d, d[1:] + d[:1]):
        limb(a, 'Plate_trim', 'Steel', T.p((p0[0], -.205, p0[1])), T.p((p1[0], -.205, p1[1])), .018, .012, bevel=0)
    studs(a, 'Plate_studs', 'Steel', T.m, [(x, -.204, z) for x in (-.12, .12) for z in (.36, .56)], r=.016, h=.015)
    # Satchel strap: a steel buckle half way.
    box(a, 'Strap_buckle', 'Steel', (.06, .02, .05), lerp(T.p((-.22, -.2, .66)), (.27, -.06, 1.07), .4), T.rot((0, -.6, 0)), bevel=0)
    # Shoulder fins: silver piping along the outer edge of each layer, two studs on the lowest one.
    for s in (-1, 1):
        for k, (w, dd, z, ang) in enumerate(((.38, .46, .64, .5), (.3, .42, .72, .8), (.22, .34, .79, 1.1))):
            mf = T.m @ frame((s * (.33 - k * .04), .02 + k * .02, z), (0, s * ang, 0))
            limb(a, 'Fin_piping', 'Steel', at(mf, (s * w / 2, -dd / 2 + .02, 0)), at(mf, (s * w / 2, dd / 2 - .02, 0)), .03, .055, bevel=0)
            if k == 0:
                studs(a, 'Fin_studs', 'Steel', mf, [(s * w * .2, y, .03) for y in (-.12, .12)], r=.018, h=.02, axis=(0, 0, 0))
    # Hood: a steel clasp at the throat, studs along the ridge, silver trim on the back edge.
    cyl(a, 'Hood_clasp', 'Steel', .045, .03, T.p((0, -.21, .67)), T.rot(FORWARD), seg=8, bevel=0)
    mr = T.m @ frame((0, .06, .86), (-.05, 0, 0))
    studs(a, 'Hood_studs', 'Steel', mr, [(0, y, .478) for y in (-.16, -.06, .04, .14)], r=.022, h=.02, axis=(0, 0, 0))
    # Belt rivets round the sides and back.
    rivets(a, 'Belt_rivets', 'Steel', [(s * .232, y, 1.1) for s in (-1, 1) for y in (-.06, .1)], r=.016, h=.015, rot=ACROSS)
    rivets(a, 'Belt_rivets', 'Steel', [(x, .197, 1.1) for x in (-.18, -.06, .06, .18)], r=.016, h=.015, rot=FORWARD)
    hood = [(-.28, -.2), (-.32, .02), (-.2, .26), (0, .44), (.2, .26), (.32, .02), (.28, -.2)]
    mb = T.m @ frame((0, .32, .86), (-.05, 0, 0))
    for (x0, z0), (x1, z1) in zip(hood, hood[1:]):
        limb(a, 'Hood_back_trim', 'Steel', at(mb, (x0 * 1.02, 0, z0 * 1.02)), at(mb, (x1 * 1.02, 0, z1 * 1.02)), .04, .03, bevel=0)
    # Cloak: a team band above the silver hem on its back face, studs where it hangs from the mantle.
    mc = frame((0, .3, 0), (-.12, 0, 0))
    for s in (-1, 1):
        band = [(s * .6, .7), (s * .5, .5), (s * .42, .62), (s * .32, .42), (s * .22, .6), (s * .1, .48)]
        for (x0, z0), (x1, z1) in zip(band, band[1:]):
            limb(a, 'Cloak_band', 'Team', at(mc, (x0, .034, z0)), at(mc, (x1, .034, z1)), .04, .012, bevel=0)
        studs(a, 'Cloak_studs', 'Steel', mc, [(s * .3, .036, 1.55), (s * .48, .036, 1.42)], r=.022, h=.02, axis=(-R, 0, 0))


def veil_arm_bands(a, right, left):
    """Steel bands round each bracer and a steel cop at the elbow; right/left = (elbow, wrist)."""
    for elbow, wrist in (right, left):
        for t in (.25, .7):
            limb(a, 'Bracer_bands', 'Steel', lerp(elbow, wrist, t), lerp(elbow, wrist, t + .07), .17, .18, bevel=0)
        box(a, 'Elbow_cops', 'Steel', (.11, .1, .09), lerp(elbow, wrist, .02), bevel=0)


def shade(a):
    T = Body((0, .03, 1.1), .17)
    veil_detail(a, T)
    veil_arm_bands(a, ((.36, -.24, 1.4), (.27, -.52, 1.3)), ((-.36, -.22, 1.42), (-.24, -.56, 1.32)))
    # Seer lens: a steel bezel ring in the cowl.
    torus(a, 'Lens_bezel', 'Steel', .068, .012, T.p((.06, -.245, .86)), T.rot(FORWARD), seg=10, ring=3)
    # Blade mount: bolts and two small guard fins.
    rivets(a, 'Blade_bolts', 'Steel', [(-.22 + s * .062, -.5 + y, 1.36) for s in (-1, 1) for y in (-.06, .06)], r=.015, h=.015, rot=ACROSS)
    for s in (-1, 1):
        box(a, 'Blade_guard', 'Steel', (.02, .06, .1), (-.22 + s * .055, -.61, 1.37), rot=(.3, 0, 0), bevel=0)
    # Pistol: a top rail, a grip, a trigger guard, emitter rings, side studs.
    box(a, 'Pistol_rail', 'Steel', (.035, .28, .02), (.27, -.62, 1.41), bevel=0)
    box(a, 'Pistol_grip', 'Undercarriage', (.07, .09, .14), (.27, -.5, 1.22), rot=(-.3, 0, 0), bevel=0)
    box(a, 'Pistol_guard', 'Steel', (.02, .1, .02), (.27, -.58, 1.24), bevel=0)
    for y in (-.82, -.95):
        cyl(a, 'Emitter_rings', 'Steel', .05, .025, (.27, y, 1.35), rot=FORWARD, seg=8, bevel=0)
    rivets(a, 'Pistol_studs', 'Steel', [(.27 + s * .052, y, 1.34) for s in (-1, 1) for y in (-.7, -.56)], r=.014, h=.015, rot=ACROSS)
    # Shoulder crystals: steel mounts at their bases.
    for base in (T.p((-.36, .14, .76)), T.p((-.28, .22, .76))):
        box(a, 'Crystal_mounts', 'Steel', (.1, .1, .04), base, T.rot(), bevel=0)


def watcher(a):
    T = Body((0, .03, 1.1), .08)
    veil_detail(a, T)
    veil_arm_bands(a, ((.42, -.08, 1.42), (.3, -.36, 1.46)), ((-.34, -.3, 1.4), (.22, -.82, 1.5)))
    # Monocle: two studs on the rim, a hinge on the arm.
    studs(a, 'Monocle_studs', 'Steel', T.m, [(.15, -.36, .86), (.01, -.36, .86)], r=.012, h=.02)
    box(a, 'Monocle_hinge', 'Steel', (.04, .04, .04), T.p((.22, -.14, .95)), T.rot(), bevel=0)
    # Scroll case: two straps; collars up the spire.
    mS = T.m @ frame((-.06, .26, .46), (0, .7, 0))
    for z in (-.18, .18):
        cyl(a, 'Scroll_straps', 'Undercarriage', .092, .03, at(mS, (0, 0, z)), frot(mS), seg=10, bevel=0)
    b = T.p((.1, .2, .7))
    tip = (b[0] + .05, b[1] + .12, 2.75)
    for t in (.25, .5, .72):
        cyl(a, 'Spire_collars', 'Steel', .032, .04, lerp(b, tip, t), aligned((tip[0] - b[0], tip[1] - b[1], tip[2] - b[2])), seg=6, bevel=0)
    # Rail rifle (Barrel* / Muzzle*: aim and recoil; mauve, steel and dark only): a scope, ties between the rails,
    # vents and studs on the receiver, a grip.
    cyl(a, 'Barrel_scope', 'Steel', .04, .3, (.3, -.42, 1.72), rot=FORWARD, seg=8, bevel=0)
    for y in (-.32, -.52):
        box(a, 'Barrel_scope_mount', 'Steel', (.03, .03, .05), (.3, y, 1.68), bevel=0)
    cyl(a, 'Barrel_scope_lens', 'Undercarriage', .03, .02, (.3, -.575, 1.72), rot=FORWARD, seg=8, bevel=0)
    for y in (-.8, -1.2, -1.6, -1.95):
        box(a, 'Barrel_rail_ties', 'Steel', (.05, .03, .14), (.3, y, 1.58), bevel=0)
    for s in (-1, 1):
        for y in (-.2, -.36, -.52):
            box(a, 'Barrel_vents', 'Steel', (.012, .1, .03), (.3 + s * .088, y, 1.6), bevel=0)
    box(a, 'Barrel_grip', 'Steel', (.07, .1, .16), (.3, -.18, 1.38), rot=(-.25, 0, 0), bevel=0)
    rivets(a, 'Barrel_studs', 'Steel', [(.3 + s * .088, y, 1.5) for s in (-1, 1) for y in (-.6, -.1)], r=.015, h=.015, rot=ACROSS)


DETAILS = {'scrapper': scrapper, 'scorcher': scorcher, 'rider': rider, 'wagon': wagon, 'drone': drone,
           'walker': walker, 'shade': shade, 'watcher': watcher}
