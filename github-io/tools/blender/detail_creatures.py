"""Close-up detail models (H3b batch 2): the bosses and the creatures.

Each function adds small surface parts to the asset after the unit's own builder (generate_bosses.py,
generate_drake.py, generate_wyrm.py, generate_creatures.py) and before the kit finishes it. Every part sits on the
group the builder already uses (boss part nodes LegsA/LegsB/Turret/Cannon/LightGun, LeftLeg/RightLeg/ArmL/ArmR,
Wing_L/Wing_R/Jaw/Tail, and the creatures' leg_* pivots), in the unit's own materials. No new pivots, no BossCore or
EmberGlow geometry, no part names starting with 'Knee' (the shader rig reads knee height from Knee* meshes).

Detail: bosses get rivets, plate seams, vents, hatches, barrel rings and muzzle slots; the creatures get scale studs,
dorsal spines, brow ridges, teeth, horn and tusk rings, claws and armour studs.
"""
import math

from mathutils import Euler, Matrix, Vector

R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y
ACROSS = (0, R90, 0)    # cylinder axis along X
UP = Vector((0, 0, 1))


def V(p):
    return Vector(p)


def aim(direction):
    """Euler that turns local +Z onto direction."""
    return UP.rotation_difference(V(direction).normalized()).to_euler('XYZ')


def stud(shape, loc, normal, r, h, seg=6):
    """A flat bolt head or armour stud standing on a surface with the given normal (half sunk into it)."""
    shape.cyl(r, h, loc=tuple(loc), rot=aim(normal), seg=seg, bevel=0)


def dome(shape, loc, normal, r, flat=.4, seg=6, rings=3):
    """A low rounded scale or stud lying on a surface."""
    shape.sphere((r, r, r * flat), loc=tuple(loc), rot=aim(normal), seg=seg, rings=rings)


def ring(shape, centre, tangent, R, r, seg=8):
    """A band round a limb, barrel or horn whose axis is tangent."""
    shape.torus(R, r, loc=tuple(centre), rot=aim(tangent), seg=seg, ring=3)


def spike(shape, base, direction, r, h, seg=4):
    """A small cone (claw, tooth, spine) from base along direction."""
    d = V(direction).normalized()
    shape.cyl(r, h, loc=tuple(V(base) + d * (h / 2)), rot=aim(d), seg=seg, r2=r * .06, bevel=0)


def on_ellipsoid(centre, radii, d):
    """Surface point and normal of an axis-aligned ellipsoid in direction d (unit-sphere coordinates)."""
    d = V(d).normalized()
    rx, ry, rz = radii
    p = V(centre) + V((d.x * rx, d.y * ry, d.z * rz))
    n = V((d.x / rx, d.y / ry, d.z / rz)).normalized()
    return p, n


def xf(points, rot, origin):
    """Points turned by an XYZ Euler then moved to origin."""
    m = Matrix.Translation(V(origin)) @ Euler(rot, 'XYZ').to_matrix().to_4x4()
    return [m @ V(p) for p in points]


def lerp(a, b, t):
    return V(a).lerp(V(b), t)


def frame(a, b):
    """Unit direction a->b, an 'up' perpendicular to it (towards world +Z) and a side vector."""
    d = (V(b) - V(a)).normalized()
    up = (UP - d * UP.dot(d)).normalized()
    return d, up, d.cross(up).normalized()


# ============================================================================= Iron Vanguard
def vanguard_detail(a):
    steel, dark, armor, team = 'Steel', 'Undercarriage', 'Armor', 'Team'
    for s, leg in ((-1, 'LeftLeg'), (1, 'RightLeg')):
        bolts = a.part('Leg_rivets', steel, leg)
        gear = a.part('Leg_fittings', dark, leg)
        # Joint caps on both ends of the knee drum, each with a centre bolt.
        for e in (-1, 1):
            gear.cyl(.1, .04, loc=(e * .245, -.1, -.8), rot=ACROSS, seg=8, bevel=0)
        # Thigh: rivets down its front and a centre seam.
        A, B = V((0, .03, -.05)), V((0, -.08, -.76))
        d = (B - A).normalized()
        front = V((0, d.z, -d.y))
        if front.y > 0:
            front = -front
        for t in (.3, .7):
            for x in (-.13, .13):
                p = lerp(A, B, t) + front * .24
                stud(bolts, (x, p.y, p.z), front, .026, .03)
        gear.limb(A + front * .242 + d * .12, B + front * .242 - d * .12, .025, .02, bevel=0, seg=1)
        # Thigh side plate seams.
        for e in (-1, 1):
            gear.limb(A + V((e * .2, -.02, -.1)), B + V((e * .2, 0, .1)), .02, .2, bevel=0, seg=1)
        # Shin: rivets beside the team stripe, louvred vents on both sides, a horizontal seam.
        for z, y in ((-1.0, -.326), (-1.4, -.308)):
            for x in (-.15, .15):
                stud(bolts, (x, y, z), (0, -1, 0), .026, .03)
        for e in (-1, 1):
            gear.grille(.3, .2, loc=(e * .222, -.02, -1.25), rot=(0, 0, e * R90), slats=3, depth=.03, thickness=.025)
        gear.box((.4, .02, .025), loc=(0, -.322, -1.5), bevel=0)
        # Ankle bolts, three steel toe ridges and a heel plate.
        for e in (-1, 1):
            stud(bolts, (e * .155, 0, -1.56), (e, 0, 0), .035, .025)
        for x in (-.14, 0, .14):
            bolts.box((.06, .34, .03), loc=(x, -.3, -1.556), bevel=0)
        gear.box((.3, .1, .08), loc=(0, .3, -1.64), bevel=0)

    # Pelvis and waist (body): rivets on the pelvic plate, a bolt ring round the waist drum, side plates.
    body = a.part('Hull_rivets', steel)
    for x in (-.14, .14):
        stud(body, (x, -.355, 1.82), (0, -1, 0), .026, .03)
        stud(body, (x, -.385, 1.62), (0, -1, 0), .026, .03)
    for k in range(6):
        t = (k + .5) * math.tau / 6
        stud(body, (.3 * math.cos(t), .3 * math.sin(t), 1.96), (math.cos(t), math.sin(t), 0), .025, .03)

    # Torso (Turret): breastplate rivets, side vents, top bolts, a rear hatch, reactor cooling rings, rear grille,
    # chest-trim bolts, visor frame, cheek vents and crest bolts.
    T = 'Turret'
    tb = a.part('Torso_rivets', steel, T)
    td = a.part('Torso_fittings', dark, T)
    for s in (-1, 1):
        rot = (-.12, 0, -s * .22)
        for p in xf([(x, -.052, z) for x in (-.17, .17) for z in (-.24, .24)], rot, (s * .3, -.46, .46)):
            tb.cyl(.024, .025, loc=tuple(p), rot=(R90 - .12, 0, -s * .22), seg=6, bevel=0)
        td.grille(.34, .26, loc=(s * .596, .06, .4), rot=(0, 0, s * R90), slats=4, depth=.03, thickness=.025)
        for z in (.32, .62):
            ring(td, (s * .28, .52, z), (0, 0, 1), .172, .022, seg=7)
        stud(tb, (s * .4, -.535, .8), (0, -1, 0), .025, .025)
        # Visor frame posts and cheek vents.
        tb.box((.02, .03, .1), loc=(s * .2, -.36, 1.07), bevel=0)
        for z in (.99, 1.04, 1.09):
            td.box((.02, .16, .022), loc=(s * .213, -.08, z), bevel=0)
        stud(tb, (s * .08, -.15, 1.215), (0, 0, 1), .02, .02)
        stud(tb, (s * .08, .12, 1.215), (0, 0, 1), .02, .02)
    for z in (1.118, 1.022):
        tb.box((.42, .03, .018), loc=(0, -.36, z), bevel=0)
    a.part('Torso_hatch', armor, T).cyl(.11, .03, loc=(0, .2, .805), seg=10, bevel=0)
    tb.torus(.11, .012, loc=(0, .2, .82), seg=10, ring=3)
    td.box((.12, .025, .025), loc=(0, .2, .83), bevel=0)
    td.grille(.18, .4, loc=(0, .445, .5), rot=(0, 0, math.pi), slats=4, depth=.03, thickness=.025)
    a.part('Torso_stripe', team, T).box((.5, .03, .04), loc=(0, .445, .78), bevel=0)

    # Arms: pauldron ridge and rivets, rim bolts, an upper-arm band and piston, forearm vents and bolts,
    # barrel cooling rings, a barrel clamp and muzzle lips.
    for s, arm in ((-1, 'ArmL'), (1, 'ArmR')):
        ab = a.part('Arm_rivets', steel, arm)
        ad = a.part('Arm_fittings', dark, arm)
        x0 = s * .06
        a.part('Pauldron_ridge', armor, arm).box((.06, .5, .03), loc=(x0, 0, .33), bevel=0)
        for dx in (-.14, .14):
            for y in (-.22, .22):
                stud(ab, (x0 + dx, y, .325), (0, 0, 1), .024, .025)
        ad.box((.31, .33, .06), loc=(0, 0, -.3), bevel=0)
        ab.limb((0, .165, -.14), (0, .165, -.46), .04, .04, bevel=0, seg=1)
        ad.grille(.32, .13, loc=(s * .202, -.4, -.72), rot=(0, 0, s * R90), slats=3, depth=.025, thickness=.022)
        for y in (-.12, -.36, -.6):
            stud(ab, (-s * .202, y, -.6), (-s, 0, 0), .024, .025)
        for x in (-.1, .1):
            stud(ab, (x, -.14, -.508), (0, 0, 1), .02, .02)
        for dx in (-.11, .11):
            for y in (-.85, -1.25):
                ring(ad, (dx, y, -.7), (0, 1, 0), .068, .012, seg=6)
            ab.torus(.052, .012, loc=(dx, -1.474, -.7), rot=FORWARD, seg=6, ring=3)
        ad.box((.3, .06, .1), loc=(0, -1.18, -.7), bevel=0)

    # Light gun: barrel rings, a sight and mount bolts.
    g = 'LightGun'
    gb = a.part('Gun_fittings', steel, g)
    for y in (-.25, -.5):
        ring(a.part('Gun_rings', dark, g), (0, y, .01), (0, 1, 0), .043, .01)
    gb.box((.03, .1, .04), loc=(0, -.04, .08), bevel=0)
    for e in (-1, 1):
        stud(gb, (e * .082, 0, 0), (e, 0, 0), .02, .02)


# ============================================================================= Iron Sovereign
def sovereign_detail(a):
    steel, dark, armor, team = 'Steel', 'Undercarriage', 'Armor', 'Team'
    for pivot, feet in (('LegsA', ((-1, -1), (1, 0), (-1, 1))), ('LegsB', ((1, -1), (-1, 0), (1, 1)))):
        lb = a.part('Leg_rivets', steel, pivot)
        ld = a.part('Leg_fittings', dark, pivot)
        for sx, row in feet:
            y0, y1, y2 = row * .86, row * 1.28, row * 1.62
            hip, knee, foot = V((sx * .92, y0, 1.04)), V((sx * 1.88, y1, 1.42)), V((sx * 2.42, y2, .1))
            low = V((foot.x, foot.y, .34))
            d, up, side = frame(hip, knee)
            # Upper leg: a piston along its top and rivets on both flanks.
            ld.limb(hip + up * .19 + d * .15, knee + up * .19 - d * .25, .06, .06, bevel=0, seg=1)
            for t, e in ((.35, -1), (.65, 1)):
                stud(lb, lerp(hip, knee, t) + side * e * .158, side * e, .03, .04)
            # Knee: a steel hub ring round the team joint.
            d2 = (low - knee).normalized()
            axis = d.cross(d2)
            if axis.length < 1e-3:
                axis = side
            ring(lb, knee, axis, .19, .03, seg=8)
            # Lower leg: two clamp bands and a bolt on its outer face.
            ring(lb, lerp(knee, low, .45), d2, .16, .024)
            out = V((sx, 0, 0))
            stud(lb, lerp(knee, low, .48) + out * .1, out, .03, .03)
            # Foot: a rim ring on top and three anchor bolts.
            lb.torus(.25, .022, loc=(foot.x, foot.y, .3), seg=8, ring=3)
            for k in range(2):
                t = math.atan2(foot.y, foot.x) + (k - .5) * 1.2
                n = V((math.cos(t), math.sin(t), -.45)).normalized()
                stud(ld, (foot.x + .215 * math.cos(t), foot.y + .215 * math.sin(t), .2), n, .035, .04)

    # Carapace (Turret): radial plate seams, a rivet row round the rim, two top hatches, crown periscopes,
    # mantlet bolts and a team stripe on the mantlet.
    T = 'Turret'
    cb = a.part('Hull_rivets', steel, T)
    cd = a.part('Hull_seams', dark, T)
    prof = [(1.2, .04), (1.16, .26), (.98, .56), (.66, .8), (.28, .93), (0, .96)]

    def dome_r(z):   # carapace radius at height z (a 14-sided lathe: faces sit inside the vertex circle)
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            if z0 <= z <= z1:
                return (r0 + (r1 - r0) * (z - z0) / (z1 - z0)) * .985
        return 0
    for deg in (20, 55, 125, 160, 200, 235, 305, 340):
        t = math.radians(deg)
        c, s = math.cos(t), math.sin(t)
        for z0, z1 in ((.3, .55), (.6, .78)):
            r0, r1 = dome_r(z0), dome_r(z1)
            cd.limb((r0 * c, r0 * s, z0), (r1 * c, r1 * s, z1), .04, .04, bevel=0, seg=1)
    for k in range(8):
        t = math.radians(22.5 + 45 * k)
        if abs(math.cos(t)) < .35 and math.sin(t) < 0:
            continue   # the mantlet sits there
        stud(cb, (1.19 * math.cos(t), 1.19 * math.sin(t), .15), (math.cos(t), math.sin(t), .1), .035, .04)
    for e in (-1, 1):
        a.part('Hatch', armor, T).cyl(.14, .04, loc=(e * .5, 0, .875), rot=(0, e * .33, 0), seg=10, bevel=0)
        cb.torus(.14, .014, loc=(e * .502, 0, .89), rot=(0, e * .33, 0), seg=10, ring=3)
        cd.box((.03, .16, .03), loc=(e * .5, 0, .91), rot=(0, e * .33, 0), bevel=0)
    for x in (-.22, .22):
        for z in (.18, .46):
            stud(cb, (x, -1.215, z), (0, -1, 0), .03, .03)
    a.part('Mantlet_stripe', team, T).box((.08, .3, .03), loc=(0, -1.0, .555), bevel=0)

    # Cannon: thermal bands on the barrel, slots in the muzzle brake, a bolt ring on the sleeve.
    C = 'Cannon'
    cn = a.part('Cannon_bands', dark, C)
    for y in (-.62, -.9, -1.18):
        ring(cn, (0, y, 0), (0, 1, 0), .102, .018, seg=8)
    for y in (-1.34, -1.43):
        for e in (-1, 1):
            cn.box((.04, .04, .18), loc=(e * .155, y, 0), bevel=0)
    for k in range(4):
        t = (k + .5) * math.tau / 4
        stud(a.part('Cannon_rivets', steel, C), (.16 * math.cos(t), -.06, .16 * math.sin(t)),
             (math.cos(t), 0, math.sin(t)), .025, .03)

    # Light gun.
    g = 'LightGun'
    for y in (-.28, -.55):
        ring(a.part('Gun_rings', dark, g), (0, y, .02), (0, 1, 0), .048, .011)
    a.part('Gun_fittings', steel, g).box((.035, .12, .045), loc=(0, -.04, .095), bevel=0)


# ============================================================================= Ember Drake
def drake_detail(a):
    import generate_drake as m
    H, S = m.H, m.HEAD_SCALE
    ridge, bone, armor = 'Ridge', 'Bone', 'Armor'
    # Back plates: two rivets each.
    sc = a.part('Plate_rivets', ridge)
    for i, y in enumerate((-1.45, -0.75, -0.05, 0.65, 1.35)):
        w = 0.95 - abs(i - 1.5) * 0.12
        z = 2.5 - abs(y + 0.3) * 0.08 + .1
        for x in (-w * .26, w * .26):
            stud(sc, (x, y - .05, z - .01), (0, -.12, 1), .035, .03)
    # Flank scales: rows of low scales on the torso and chest, belly scute seams.
    scales = a.part('Scales', ridge)
    for centre, radii, rows in (((0, 0.2, 1.7), (0.95, 1.7, 0.85), ((-.55, (.15, .55)), (-.2, (.1, .5)), (.15, (.12, .52)), (.5, (.15, .5)))),
                                ((0, -1.0, 1.85), (0.85, 0.95, 0.9), ((-.25, (.2, .55)), (.15, (.15, .5))))):
        for dy, ups in rows:
            for up in ups:
                for s in (-1, 1):
                    r = math.sqrt(max(0, 1 - dy * dy - up * up))
                    p, n = on_ellipsoid(centre, radii, (s * r, dy, up))
                    dome(scales, p, n, .1, flat=.35)
    seams = a.part('Belly_seams', ridge)
    bc, br = V((0, -0.35, 1.38)), (0.78, 1.65, 0.55)
    for dy in (-.6, -.3, 0, .3, .6):
        pts = []
        for deg in (-160, -130, -100, -80, -50, -20):
            t = math.radians(deg)
            k = math.sqrt(1 - dy * dy)
            p, _ = on_ellipsoid(bc, br, (k * math.cos(t), dy, k * math.sin(t)))
            pts.append(p)
        seams.tube(pts, .02, seg=4)
    # Neck: small spines between the big ones and scale bands.
    ns = a.part('Neck_spines', ridge)
    for (y, z) in ((-2.02, 2.97), (-2.55, 3.42)):
        ns.prism([(-0.1, 0), (0.1, 0), (0, 0.22)], 0.07, loc=(0, y, z), rot=(0.5, 0, 0), axis='X', bevel=0)
    for p, t, r in (((0, -1.9, 2.47), (0, -.7, .63), .5), ((0, -2.55, 3.03), (0, -.6, .5), .41)):
        ring(ns, p, t, r * .95, .03, seg=10)
    # Head: horn rings, upper teeth, cheek spikes, crown scales.
    hd = a.part('Head_detail', ridge)
    tooth = a.part('Upper_teeth', bone)
    for s in (-1, 1):
        h0, h1, h2 = V(H(0.27 * s, -2.75, 3.45)), V(H(0.42 * s, -2.35, 3.78)), V(H(0.5 * s, -1.9, 3.9))
        for t, rr in ((.3, .15), (.7, .12)):
            ring(hd, lerp(h0, h1, t), h1 - h0, rr * S * .82, .022)
        ring(hd, lerp(h1, h2, .4), h2 - h1, .065 * S, .016, seg=6)
        for y, z in ((-3.5, 3.096), (-3.72, 3.1), (-3.92, 3.12)):
            spike(tooth, (.27 * s, y, z + .03), (0, 0, -1), .035, .13)
        for k, (y, z) in enumerate(((-3.0, 3.3), (-2.8, 3.25))):
            spike(hd, H(.42 * s, y, z), (s, .6, .3), .045, .16 - k * .04)
        for dy, up in ((-.25, .35), (.1, .45), (.35, .3)):
            r = math.sqrt(1 - dy * dy - up * up)
            p, n = on_ellipsoid(H(0, -2.85, 3.2), (0.5 * S, 0.62 * S, 0.42 * S), (s * r, dy, up))
            dome(hd, p, n, .07, flat=.4)
    # Forelegs (body): scale bands, an elbow spur and knuckle studs.
    fl = a.part('Leg_scales', ridge)
    for s in (-1, 1):
        A, B, C = V((0.5 * s, -1.0, 1.45)), V((0.66 * s, -1.25, 0.75)), V((0.6 * s, -1.5, 0.14))
        ring(fl, lerp(A, B, .55), B - A, .2, .025)
        ring(fl, lerp(B, C, .45), C - B, .15, .022)
        spike(a.part('Leg_spurs', bone), B + V((s * .1, .12, 0)), (s * .3, 1, .2), .05, .16)
        for k in (-1, 0, 1):
            dome(fl, (0.6 * s + k * 0.1, -1.72, 0.2), (0, -.4, 1), .045, flat=.5)
    # Tail: scale rings and small spines between the spikes.
    tl = a.part('Tail_scales', ridge, 'Tail')
    pts = [V((0, 0, 0)), V((0, 1.3, -0.22)), V((0, 2.6, -0.45)), V((0, 3.7, -0.5))]
    radii = [0.55, 0.38, 0.22, 0.08]
    for seg_i, t in ((0, .5), (1, .5), (2, .4)):
        p = lerp(pts[seg_i], pts[seg_i + 1], t)
        r = radii[seg_i] + (radii[seg_i + 1] - radii[seg_i]) * t
        ring(tl, p, pts[seg_i + 1] - pts[seg_i], r * .95, .03, seg=10)
    for k, (y, z) in enumerate(((1.15, -.0), (2.45, -.3), (3.3, -.4))):
        tl.prism([(-0.08, 0), (0.08, 0), (0, 0.18 - k * .04)], 0.06, loc=(0, y, z + (.36, .2, .08)[k]), rot=(0.4, 0, 0),
                 axis='X', bevel=0)
    # Wings: membrane veins, a thumb claw at the wrist and studs along the arm.
    for s in (1, -1):
        p = 'Wing_' + ('L' if s > 0 else 'R')

        def X(q):
            return V((q[0] * s, q[1], q[2]))
        veins = a.part('Wing_veins', ridge, p)
        for q0, q1, q2 in (((.9, .15, .36), (.95, .9, .345), (.75, 1.6, .345)), ((2.0, -.05, .36), (2.2, .8, .345), (2.1, 1.6, .345)),
                           ((3.4, .3, .36), (3.9, .9, .345), (4.15, 1.2, .345))):
            veins.tube([X(q0), X(q1), X(q2)], .022, seg=4)
        wrist = X((3.0, -0.35, 0.5))
        spike(a.part('Wing_claw', bone, p), wrist + V((0, -.06, 0)), (s * .3, -1, .1), .06, .26)
        for q in ((.8, .1, .62), (1.6, .2, .76), (2.3, -.07, .84)):
            dome(a.part('Wing_studs', armor, p), X(q), (s * -.1, 0, 1), .055, flat=.5)
    # Hind legs: a knee plate, shin scale bands, a heel spur and toe studs.
    for s in (1, -1):
        p = 'leg_' + ('L' if s > 0 else 'R')
        a.part('Thigh_plate', armor, p).box((.26, .05, .24), loc=(0.05 * s, -.63, -.14), rot=(-.2, 0, 0), bevel=0)
        hb = a.part('Leg_scales', ridge, p)
        A, B, C = V((0.1 * s, 0.15, -0.45)), V((0.14 * s, 0.35, -0.9)), V((0.12 * s, -0.2, -1.3))
        ring(hb, lerp(A, B, .5), B - A, .19, .025)
        ring(hb, lerp(B, C, .5), C - B, .145, .022)
        spike(a.part('Heel_spur', bone, p), B + V((0, .14, 0)), (0, 1, -.3), .05, .17)
        for k in (-1, 0, 1):
            dome(hb, (0.12 * s + k * 0.11, -0.6, -1.23), (0, -.3, 1), .045, flat=.5)


# ============================================================================= Wyrm / Wyrmling
def wyrm_detail(a):
    import generate_wyrm as m
    young = a.name == 'wyrmling'
    n = 6 if young else 8
    ridge, belly = 'Ridge', 'Belly'
    spines = a.part('Dorsal_spines', ridge)
    studs = a.part('Scale_studs', ridge)
    for i in range(n):
        t = i / (n - 1)
        (x, y, z), r = m.spine(t)
        radii = (1.08 * r, .85 * r, .88 * r)
        if r < .12:
            continue
        # A blade spine on the top of each scute (the grown Wyrm's saddle keeps its own top).
        if i > 0 and (young or abs(t - .39) > .12):
            h = .22 * r
            spines.prism([(-.16 * r, 0), (.16 * r, 0), (.05 * r, h)], .05 * r + .02, loc=(x, y + .05 * r, z + .84 * r),
                         axis='X', bevel=0)
        # Rows of scale studs down both flanks.
        for up in (.55, .1):
            for dy in ((-.3, .3) if r > .3 else (0,)):
                for s in (-1, 1):
                    k = math.sqrt(max(0, 1 - up * up - dy * dy))
                    p, nn = on_ellipsoid((x, y, z), radii, (s * k, dy, up))
                    dome(studs, p, nn, .075 * r + .02, flat=.4)
    # Head.
    (x, y, z), body_r = m.spine(0)
    r = .58 * 1.05 * 1.6
    y -= body_r * .22
    z += body_r * .2

    def pt(dx, dy, dz):
        return V((x + dx * r, y + dy * r, z + dz * r))

    hd = a.part('Brow_ridge', ridge)
    for s in (-1, 1):
        m.tapered_curve(hd, [pt(s * .36, -1.12, .58), pt(s * .58, -.97, .72), pt(s * .79, -.8, .55)],
                        [.04 * r, .05 * r, .02 * r], 6)
        # Tusk rings.
        t0, t1, t2 = (pt(s * dx, dy, dz) for dx, dy, dz in ((.55, -1.15, -.24), (.73, -1.40, -.19), (.77, -1.64, -.02)))
        ring(a.part('Tusk_rings', ridge), lerp(t0, t1, .35), t1 - t0, .165 * r, .022 * r)
        ring(a.part('Tusk_rings', ridge), lerp(t1, t2, .35), t2 - t1, .13 * r, .018 * r, seg=6)
        # Cheek studs behind the eyes.
        for dy, up in ((-.35, .25), (-.05, .35), (.25, .15), (-.15, -.05)):
            k = math.sqrt(1 - dy * dy - up * up)
            p, nn = on_ellipsoid(pt(0, -.54, .15), (.81 * r, .86 * r, .62 * r), (s * k, dy, up))
            dome(studs, p, nn, .055 * r, flat=.45)
    # Upper teeth round the mouth line.
    teeth = a.part('Teeth', belly)
    for deg in (-62, -40, -18, 18, 40, 62):
        f = math.radians(deg)
        p = pt(.62 * math.sin(f), -1.21 - .6 * math.cos(f), -.04)
        spike(teeth, p, (0, 0, -1), .05 * r, .15 * r)
    # Crest web ribs on both faces.
    h = .64 if young else .87
    ribs = a.part('Crest_ribs', ridge)
    for face in (-1, 1):
        for dx, dz in ((-.82, .91), (-.34, 1.12), (0, .97), (.34, 1.12), (.82, .91)):
            p0 = (0, face * (.09 * r + .006), .08 * r)
            p1 = (dx * .62 * r, face * (.09 * r + .006), dz * .58 * r * h)
            q0, q1 = xf([p0, p1], (-.48, 0, 0), pt(0, -.005, .61))
            ribs.limb(q0, q1, .035 * r, .02, bevel=0, seg=1)
    # Forelegs: scale bands, an elbow spur, foot studs and a middle claw.
    (fx, fy, fz), fr = m.spine(.16)
    for s, side in ((-1, 'L'), (1, 'R')):
        p = 'leg_' + side
        reach = .84 if young else 1
        elbow = V((s * .35 * reach, -.16, -.40))
        ankle = V((s * .47 * reach, -.42, -fz + .19))
        lb = a.part('Leg_scales', ridge, p)
        ring(lb, lerp((0, 0, 0), elbow, .5), elbow, .262, .03, seg=8)
        ring(lb, lerp(elbow, ankle, .45), ankle - elbow, .215, .028, seg=8)
        ring(lb, lerp(elbow, ankle, .8), ankle - elbow, .19, .025, seg=8)
        spike(a.part('Elbow_spur', ridge, p), elbow + V((s * .05, .2, 0)), (s * .4, 1, .3), .07, .2)
        foot = V((ankle.x, ankle.y - .13, .16 - fz))
        for k in (-1, 0, 1):
            dome(lb, foot + V((k * .1, -.05, .14)), (0, -.3, 1), .05, flat=.5)
        m.tapered_curve(a.part('Claws', belly, p),
                        [foot + V((0, -.16, 0)), foot + V((0, -.3, -.04)), foot + V((0, -.4, -.1))], [.08, .06, .01], 6)


# ============================================================================= Acid Hound
def hound_detail(a):
    import generate_creatures as m
    chitin, acid = 'Chitin', 'Acid'
    # Hyena stripes down the flanks of the chest and haunch.
    stripes = a.part('Hide_stripes', chitin)
    for centre, radii, dys in (((0, -.2, .6), (.2, .3, .23), (-.25, .05, .35)), ((0, .32, .55), (.16, .2, .18), (-.1, .3))):
        for dy in dys:
            for s in (-1, 1):
                pts = []
                for deg in (55, 25, -5):
                    t = math.radians(deg)
                    k = math.sqrt(1 - dy * dy)
                    p, nn = on_ellipsoid(centre, radii, (s * k * math.cos(t), dy, k * math.sin(t)))
                    pts.append(p + nn * .004)
                stripes.tube(pts, .011, seg=4)
    # Back: studs beside each plate's crest, a mane of small spines on the neck, spines along the tail.
    sp = a.part('Spines', chitin)
    for y, z, rx, ry, tilt in ((-.36, .8, .16, .12, .5), (-.2, .82, .2, .14, .2), (-.02, .74, .17, .13, 0),
                               (.17, .72, .17, .12, -.1), (.34, .71, .15, .11, -.25)):
        for s in (-1, 1):
            dome(sp, (s * rx * .55, y, z - .06 + .055), (s * .4, -math.sin(tilt) * .5, 1), .022, flat=.6)
    for y, z in ((-.47, .84), (-.54, .88)):
        spike(sp, (0, y, z), (0, .5, 1), .022, .07)
    for (y, z), d in (((.56, .62), (0, .3, 1)), ((.66, .56), (0, .6, 1)), ((.73, .46), (0, 1, .6))):
        spike(sp, (0, y, z), d, .016, .06)
    # Head: brow ridges, acid fangs, muzzle wrinkles, flank sac rims, collar studs.
    for s in (-1, 1):
        m.loft(a.part('Brow', chitin), [(s * .04, -.74, .935), (s * .085, -.75, .93), (s * .115, -.72, .91)],
               [.016, .02, .01], 5)
        spike(a.part('Fangs', acid), (s * .035, -.92, .775), (0, -.15, -1), .01, .045)
        for k, y in enumerate((-.84, -.9)):
            a.part('Muzzle_wrinkles', chitin).box((.012, .025, .012), loc=(s * .045, y, .875 - k * .01),
                                                  rot=(0, s * .5, 0), bevel=0)
        for y, z, r in ((-.14, .56, .068), (.2, .53, .056)):
            x = s * (.15 if y > 0 else .19)
            ring(a.part('Sac_rims', chitin), (x + s * r * .35, y, z), (s, 0, 0), r * .82, .01, seg=8)
        stud(a.part('Collar_studs', chitin), (s * .12, -.43, .7), (s, 0, .1), .014, .014)
    # Legs: a chitin band on each upper leg and shin, a spur at the bend, three claws on each paw.
    front = [(0, .05, -.24), (0, -.01, -.48), (0, -.04, -.56)]
    hind = [(0, -.07, -.18), (0, .1, -.37), (0, .07, -.53)]
    legs = (('leg_L', .58, front), ('leg_R', .58, front), ('leg_hindR_L', .55, hind), ('leg_hindL_R', .55, hind))
    for name, z, (knee, ankle, paw) in legs:
        knee = V(knee)
        lb = a.part('Leg_bands', chitin, name)
        ring(lb, lerp((0, 0, .04), knee, .45), knee - V((0, 0, .04)), .058, .011, seg=8)
        back = 1 if knee.y > 0 else -1
        spike(a.part('Leg_spurs', chitin, name), knee + V((0, back * .035, 0)), (0, back, .4), .014, .05)
        pz = -z + .03
        for k in (-1, 0, 1):
            spike(a.part('Claws', chitin, name), (paw[0] + k * .022, paw[1] - .075, pz - .005), (k * .2, -1, -.35),
                  .009, .035)
        ring(lb, lerp(knee, V(ankle), .6), V(ankle) - knee, .036, .008, seg=6)


# ============================================================================= Vault Sentinel
def sentinel_detail(a):
    bronze, basalt = 'Bronze', 'Basalt'
    hip_z = 1.38
    for s, side in ((-1, 'L'), (1, 'R')):
        p = 'leg_' + side
        lb = a.part('Leg_rivets', basalt, p)
        lz = a.part('Leg_studs', bronze, p)
        # Thigh plate rivets, a bronze ring round the hip ball.
        for x in (-.11, .11):
            for z in (-.23, -.45):
                stud(lb, (x, -.276, z), (0, -1, 0), .022, .02, seg=8)
        ring(lz, (s * .12, 0, 0), (1, 0, 0), .16, .03, seg=10)
        # Shin: bronze studs, a mortar seam; greave rivets; ankle studs.
        for x in (-.13, .13):
            stud(lz, (x, -.258, -.84), (0, -1, 0), .03, .03, seg=8)
        a.part('Leg_seams', basalt, p).box((.38, .02, .025), loc=(0, -.243, -.95), bevel=0)
        for x in (-.16, 0, .16):
            stud(lb, (x, -.281, -1.05), (0, -1, 0), .022, .02, seg=8)
        for e in (-1, 1):
            stud(lz, (e * .245, -.1, -hip_z + .12), (e, 0, 0), .035, .03, seg=8)
        # Toe grooves across the toe cap.
        for x in (-.08, .08):
            lb.box((.025, .13, .125), loc=(x, -.5, -hip_z + .07), bevel=0)

    # Body: masonry seams on the chest sides, bronze rivets, basalt studs on the spine and waist.
    seams = a.part('Masonry_seams', basalt)
    for e in (-1, 1):
        for z, half in ((2.05, .652), (2.45, .69)):
            seams.box((.02, .76, .025), loc=(e * half, 0, z), rot=(0, e * -.1, 0), bevel=0)
    rv = a.part('Rivets', bronze)
    for x in (-.5, .5):
        for z in (2.55, 1.95):
            stud(rv, (x, -.425 if z > 2.2 else -.413, z), (0, -1, 0), .035, .03, seg=8)
    bb = a.part('Studs', basalt)
    for z in (2.17, 2.43, 2.65):
        stud(bb, (0, .512, z), (0, 1, 0), .03, .025, seg=8)
    for k in range(8):
        t = (k + .5) * math.tau / 8
        stud(bb, (.33 * math.cos(t), .33 * math.sin(t), 1.74), (math.cos(t), math.sin(t), 0), .03, .03, seg=8)
    for x in (-.35, .35):
        stud(rv, (x, -.302, 1.46), (0, -1, 0), .035, .03, seg=8)
    # Pauldron studs, upper-arm bands.
    for s in (-1, 1):
        x = s * .86
        for deg in (40, 110, 180, 250, 320):
            t = math.radians(deg)
            pnt, nn = on_ellipsoid((x, 0, 2.56), (.44, .46, .4), (.55 * math.cos(t), .55 * math.sin(t), .835))
            stud(rv, pnt, nn, .035, .035, seg=8)
        A, B = V((s * .98, 0, 2.3)), V((s * 1.04, .04, 1.78))
        ring(rv, lerp(A, B, .5), B - A, .16, .03, seg=10)
        ring(bb, lerp(A, B, .8), B - A, .152, .022, seg=8)
    # Head: brow rivets, a mouth grille, cheek plates, horn rings.
    for x in (-.15, .15):
        stud(bb, (x, -.372, 2.99), (0, -1, 0), .022, .02, seg=8)
    bb.grille(.22, .09, loc=(0, -.33, 2.81), slats=3, depth=.025, thickness=.02)
    for s in (-1, 1):
        rv.box((.03, .16, .12), loc=(s * .18, -.16, 2.86), bevel=0)
        A, B = V((s * .17, -.16, 2.98)), V((s * .3, -.05, 3.08))
        ring(bb, lerp(A, B, .4), B - A, .045, .012, seg=6)
    # Shield face studs.
    turn = .55
    n = V((-math.cos(turn), -math.sin(turn), 0))
    c = V((-1.2, -.3, 1.42))
    shield = [(0, .72), (.36, .56), (.44, .1), (.3, -.4), (0, -.66), (-.3, -.4), (-.44, .1), (-.36, .56)]
    for q in xf([(0, y * .62, z * .62) for y, z in shield], (0, 0, turn), c + n * .08):
        stud(bb, q, n, .03, .03, seg=8)
    # Blade guard studs.
    for q in xf([(0, -.2, 0), (0, .2, 0)], (-.7, 0, 0), (1.08, -.3, 1.15)):
        stud(bb, q + V((.085, 0, 0)), (1, 0, 0), .03, .02, seg=8)
        stud(bb, q - V((.085, 0, 0)), (-1, 0, 0), .03, .02, seg=8)


DETAILS = {
    'ironvanguard': vanguard_detail,
    'ironsovereign': sovereign_detail,
    'ironsovereign2': sovereign_detail,
    'emberdrake': drake_detail,
    'wyrm': wyrm_detail,
    'wyrmling': wyrm_detail,
    'acidhound': hound_detail,
    'vaultsentinel': sentinel_detail,
}
