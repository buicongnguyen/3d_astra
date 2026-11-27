"""Close-up detail models (H3b, batch 2): the ground units built by generate_assets.py (medic, engineer, breaker),
generate_gunner.py, generate_stalker.py, generate_rampart.py and generate_carrier.py.

Each function adds small surface parts to the asset after the unit's own generator has built it and before the
kit finishes it (tools/blender/generate_detail.py build_kind): same pivots, same moving-part names, only the
unit's own materials, so the silhouette, the team slots and the draw classes match the normal model. Generator
modules that add kit materials on import (gunner: Fatigue, rampart: Rust) are imported inside the functions;
each kind builds in its own Blender process.
"""
import math

R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y (front is -Y)
ACROSS = (0, R90, 0)    # cylinder axis along X
SIDES = ((-1, 'L'), (1, 'R'))


def rivets(shape, points, r=.02, h=.02, rot=(0, 0, 0)):
    """Flat six-sided rivet heads without bevels (20 triangles each; the kit's bolts() bevels them to 68)."""
    for p in points:
        shape.cyl(r, h, loc=p, rot=rot, seg=6, bevel=0)
    return shape


# ----------------------------------------------------------------------------- shared infantry kit
def _infantry_common(a, b=1.0, slits=True):
    """Visor frame, rebreathers, ear pieces, helmet rivets, chest straps, belt pouches and leg detail for the
    generate_assets.py infantry body (helmet at z 2.02, cuirass at 1.52, hips at .95)."""
    steel = a.part('Steel', 'Steel')
    gear = a.part('Gear', 'Undercarriage')
    glow = a.part('Lights', 'TeamGlow')
    for z in (2.068, 1.932):
        steel.box((.36, .03, .022), loc=(0, -.236, z), bevel=0)
    for s in (-1, 1):
        steel.box((.022, .03, .15), loc=(s * .17, -.236, 2.0), bevel=0)
        if slits:
            glow.box((.07, .02, .028), loc=(s * .075, -.243, 2.005), bevel=0)
        gear.cyl(.042, .09, loc=(s * .1, -.25, 1.86), rot=FORWARD, seg=8, bevel=0)
        steel.cyl(.03, .02, loc=(s * .1, -.3, 1.86), rot=FORWARD, seg=8, bevel=0)
        gear.cyl(.07, .05, loc=(s * .245, -.02, 1.98), rot=ACROSS, seg=10, bevel=0)
        steel.cyl(.026, .02, loc=(s * .275, -.02, 1.98), rot=ACROSS, seg=6, bevel=0)
        rivets(steel, [(s * .232, y, 1.9) for y in (-.12, .0, .12)], r=.018, h=.02, rot=ACROSS)
    gear.grille(.14, .07, loc=(0, -.235, 1.85), slats=3, depth=.02, thickness=.015)
    # Chest straps crossing the cuirass with buckles; belt pouches with steel snaps; a belt buckle.
    for s in (-1, 1):
        gear.box((.055, .03, .48), loc=(s * .13 * b, -.245, 1.52), rot=(0, s * .42, 0), bevel=0)
        steel.box((.07, .03, .05), loc=(s * .2 * b, -.255, 1.68), bevel=0)
        gear.box((.1, .08, .1), loc=(s * .17 * b, -.205, 1.08), bevel=.015, seg=1)
        steel.box((.04, .02, .03), loc=(s * .17 * b, -.25, 1.11), bevel=0)
        # Shoulder straps over the collar and rivets along the pauldron edge.
        gear.box((.06, .3, .03), loc=(s * .14 * b, .05, 1.83), bevel=0)
        rivets(steel, [(s * .5 * b, y, 1.86) for y in (-.16, 0, .16)], r=.018, h=.02)
    steel.box((.12, .03, .07), loc=(0, -.2, 1.1), bevel=.008, seg=1)
    # Legs (on the hip pivots so they swing): shin stripe and plate, shin bolts, boot toe cap and straps,
    # thigh pockets.
    for s, side in SIDES:
        leg = f'leg_{side}'
        a.part('Shin_stripe', 'Team', leg).box((.2 * b, .02, .05), loc=(0, -.178, -.52), bevel=0)
        rivets(a.part('Shin_bolts', 'Steel', leg), [(x * b, -.178, -.68) for x in (-.07, .07)], r=.018, h=.02, rot=FORWARD)
        a.part('Shin_plate', 'Steel', leg).box((.12, .02, .1), loc=(0, -.178, -.4), bevel=0)
        a.part('Boot_cap', 'Steel', leg).box((.22 * b, .05, .05), loc=(0, -.3, -.86), bevel=.01, seg=1)
        a.part('Boot_strap', 'Undercarriage', leg).box((.29 * b, .2, .03), loc=(0, -.05, -.74), bevel=0)
        a.part('Boot_strap', 'Undercarriage', leg).box((.24, .03, .03), loc=(0, -.29, -.8), bevel=0)
        a.part('Thigh_pocket', 'Undercarriage', leg).box((.03, .14, .14), loc=(s * .12 * b, .02, -.3), bevel=0)
        a.part('Thigh_pocket', 'Steel', leg).box((.02, .04, .03), loc=(s * .14 * b, .02, -.24), bevel=0)
    return steel, gear, glow


def medic(a):
    steel, gear, glow = _infantry_common(a)
    white = a.part('Pack', 'ArmorMedic')
    cross = a.part('Cross', 'Cross')
    # The aid pack (x +-.36, y .16..58, z 1.19..1.85): two straps down the back with buckles, corner bolts,
    # a carry handle, side pouches with snaps, vial clips and a rolled bandage under it.
    for s in (-1, 1):
        gear.box((.06, .02, .6), loc=(s * .22, .585, 1.52), bevel=0)
        steel.box((.08, .025, .05), loc=(s * .22, .59, 1.36), bevel=0)
        steel.box((.08, .025, .05), loc=(s * .22, .59, 1.7), bevel=0)
        rivets(steel, [(s * .31, .585, z) for z in (1.25, 1.79)], r=.02, h=.02, rot=FORWARD)
        white.box((.04, .22, .26), loc=(s * .37, .37, 1.42), bevel=.012, seg=1)
        gear.box((.045, .22, .03), loc=(s * .372, .37, 1.53), bevel=0)
        steel.box((.02, .04, .03), loc=(s * .39, .37, 1.5), bevel=0)
        for k in range(2):
            steel.cyl(.022, .07, loc=(s * (.12 + k * .08), .53, 1.88), seg=6, bevel=0)
    steel.limb((-.12, .3, 1.86), (.12, .3, 1.86), .03, .03, bevel=0, seg=1)
    for x in (-.13, .13):
        steel.box((.03, .03, .04), loc=(x, .3, 1.85), bevel=0)
    white.cyl(.06, .5, loc=(0, .4, 1.14), rot=ACROSS, seg=8, bevel=0)
    for x in (-.16, .16):
        gear.cyl(.064, .03, loc=(x, .4, 1.14), rot=ACROSS, seg=8, bevel=0)
    # Medkit in the left hand (x -.51..-.29, front y -.47): a red cross, corner bolts and a latch.
    for sz in ((.1, .02, .03), (.03, .02, .1)):
        cross.box(sz, loc=(-.4, -.476, 1.2), bevel=0)
    rivets(steel, [(x, -.475, z) for x in (-.48, -.32) for z in (1.15, 1.25)], r=.012, h=.012, rot=FORWARD)
    steel.box((.04, .03, .03), loc=(-.4, -.47, 1.275), bevel=0)
    # The healing emitter (steel tube y -.75..-.37 at x .34, z 1.34): rings, cooling fins, a grip, a power
    # hose from the pack and three prongs round the glowing head.
    for y in (-.45, -.62, -.72):
        steel.torus(.08, .01, loc=(.34, y, 1.34), rot=FORWARD, seg=10, ring=3)
    for y in (-.5, -.56, -.66):
        steel.box((.02, .03, .05), loc=(.34, y, 1.43), bevel=0)
    gear.box((.05, .07, .12), loc=(.34, -.48, 1.24), rot=(.2, 0, 0), bevel=0)
    gear.tube([(.36, .2, 1.3), (.46, .05, 1.2), (.44, -.25, 1.22), (.38, -.42, 1.3)], .022, seg=6)
    for k in range(3):
        ang = k * math.tau / 3 + R90
        steel.box((.018, .06, .018), loc=(.34 + math.cos(ang) * .085, -.83, 1.34 + math.sin(ang) * .085), bevel=0)


def engineer(a):
    steel, gear, glow = _infantry_common(a)
    safety = a.part('Tool_frame', 'Safety')
    # Hard hat (brim .6 x .62 at z 2.06): rivets round the brim, a small head lamp above the visor.
    rivets(steel, [(x, -.345, 2.085) for x in (-.22, -.07, .07, .22)], r=.015, h=.015)
    rivets(steel, [(s * .295, y, 2.085) for s in (-1, 1) for y in (-.2, .05, .22)], r=.015, h=.015)
    steel.cyl(.04, .05, loc=(0, -.255, 2.13), rot=FORWARD, seg=8, bevel=0)
    glow.cyl(.026, .01, loc=(0, -.283, 2.13), rot=FORWARD, seg=8, bevel=0)
    # Tool frame (uprights from (+-.22, .48, 1.28) to (+-.12, .5, 2.62)): bolts where the bars cross, a hydraulic
    # strut under the jib, a pulley with cheek plates at the jib tip and a hook under the block.
    for z in (1.72, 2.1):
        x = .22 - .1 * (z - 1.28) / 1.34
        rivets(steel, [(s * x, .535, z) for s in (-1, 1)], r=.022, h=.02, rot=FORWARD)
    rivets(steel, [(s * .15, .555, 2.62) for s in (-1, 1)], r=.022, h=.02, rot=FORWARD)
    steel.limb((0, .5, 2.3), (0, .12, 2.72), .035, .035, bevel=0, seg=1)
    steel.cyl(.022, .06, loc=(0, .3, 2.495), rot=ACROSS, seg=6, bevel=0)
    for s in (-1, 1):
        steel.box((.015, .13, .13), loc=(s * .058, -.22, 2.84), rot=(-.31, 0, 0), bevel=0)
        rivets(safety, [(s * .055, y, 2.62 + (.5 - y) * .32) for y in (.3, .05)], r=.015, h=.012, rot=ACROSS)
    steel.cyl(.05, .1, loc=(0, -.25, 2.79), rot=ACROSS, seg=8, bevel=0)
    steel.torus(.035, .01, loc=(0, -.25, 2.42), rot=ACROSS, seg=8, ring=3)
    # Gas bottles on the pack sides with valve caps and straps; a gauge on the pack.
    for s in (-1, 1):
        steel.cyl(.055, .34, loc=(s * .3, .32, 1.45), seg=8, bevel=0)
        gear.cyl(.03, .05, loc=(s * .3, .32, 1.645), seg=6, bevel=0)
        gear.box((.12, .12, .03), loc=(s * .28, .32, 1.35), bevel=0)
    steel.cyl(.05, .02, loc=(.15, .44, 1.68), rot=FORWARD, seg=8, bevel=0)
    gear.box((.004, .008, .04), loc=(.15, .452, 1.69), rot=(0, .5, 0), bevel=0)
    # Cutter (steel tube y -.85..-.35 at x .36, z 1.3): rings, a grip, a hose from the pack, jaw rivets and teeth.
    for y in (-.45, -.7, -.8):
        steel.torus(.055, .01, loc=(.36, y, 1.3), rot=FORWARD, seg=8, ring=3)
    gear.box((.05, .07, .12), loc=(.36, -.44, 1.21), rot=(.2, 0, 0), bevel=0)
    gear.tube([(.26, .26, 1.35), (.47, .08, 1.2), (.45, -.25, 1.2), (.38, -.5, 1.27)], .022, seg=6)
    for s in (-1, 1):
        rivets(steel, [(.36 + s * .142, y, 1.3) for y in (-.84, -.98)], r=.018, h=.015, rot=ACROSS)
        for k in range(3):
            steel.box((.02, .03, .03), loc=(.36 + s * .058, -1.0 + k * .06, 1.3), bevel=0)
    # Hammer and wrench clipped to the belt at the back.
    steel.box((.03, .02, .22), loc=(-.15, .2, 1.0), bevel=0)
    steel.box((.07, .02, .04), loc=(-.15, .2, 1.11), bevel=0)
    gear.box((.025, .025, .2), loc=(.15, .2, 1.0), bevel=0)
    steel.box((.08, .03, .05), loc=(.15, .2, .89), bevel=0)


# ----------------------------------------------------------------------------- breaker
def breaker(a):
    steel = a.part('Steel', 'Steel')
    dark = a.part('Deck', 'Undercarriage')
    armor = a.part('Armor', 'Armor')
    # Track lugs round the bottom run, inside the belts' own bounds (belts x .59..1.05, y +-1.3, z .07..65).
    belt = a.part('Tracks', 'Undercarriage')
    for s in (-1, 1):
        for i in range(12):
            belt.box((.44, .07, .04), loc=(s * .82, -1.1 + i * .2, .09), bevel=0)
    for s in (-1, 1):
        # Side skirts (x +-1.06, z .59..89): two rows of rivets and a seam.
        rivets(steel, [(s * 1.115, y, z) for y in (-1.0, -.5, 0, .5, 1.0) for z in (.66, .82)], r=.025, h=.02, rot=ACROSS)
        steel.box((.02, 2.2, .02), loc=(s * 1.112, -.05, .74), bevel=0)
        # Tow eyes at the nose and tail, headlight guards round the lamps.
        steel.torus(.06, .016, loc=(s * .55, -1.27, .5), rot=ACROSS, seg=8, ring=3)
        steel.torus(.06, .016, loc=(s * .55, 1.27, .5), rot=ACROSS, seg=8, ring=3)
        for dx in (-.09, .09):
            steel.box((.02, .05, .11), loc=(s * .38 + dx, -1.29, .7), bevel=0)
        steel.box((.2, .05, .02), loc=(s * .38, -1.29, .765), bevel=0)
        # Exhaust stacks (x +-.42, y 1.12, z .93..1.31): two clamp bands and a heat shield.
        for z in (1.0, 1.22):
            steel.torus(.074, .01, loc=(s * .42, 1.12, z), seg=10, ring=3)
        dark.box((.03, .12, .24), loc=(s * .5, 1.12, 1.14), bevel=0)
        # Spare track links on the glacis.
        for k in range(2):
            dark.box((.22, .07, .04), loc=(s * .42, -1.0 - k * .1, .76 + k * .07), rot=(-.63, 0, 0), bevel=0)
    # Glacis (y -1.25..-.8, z .62..95): a row of bolts; driver's periscopes and hatch on the front deck.
    rivets(steel, [(x, -1.04, .79) for x in (-.5, -.2, .2, .5)], r=.025, h=.02, rot=(-.63, 0, 0))
    for x in (-.18, 0, .18):
        dark.box((.1, .05, .05), loc=(x, -.7, .975), bevel=0)
    armor.cyl(.14, .03, loc=(-.38, -.68, .965), seg=10, bevel=0)
    steel.box((.16, .02, .02), loc=(-.38, -.68, .99), bevel=0)
    # Deck rivets along both edges and behind the engine grille; a cable along the left deck edge.
    rivets(steel, [(s * .56, y, .965) for s in (-1, 1) for y in (-.75, .75, 1.0)], r=.025, h=.02)
    rivets(steel, [(x, .96, 1.025) for x in (-.45, -.15, .15, .45)], r=.02, h=.015)
    steel.tube([(-.55, -.4, .97), (-.6, .3, .97), (-.55, .85, .97)], .02, seg=5)
    # Turret (Turret_head parts turn with it; z 1.06..1.52): hatch ring, handles and hinge on the team hatch,
    # periscopes, rivets along both cheeks, smoke dischargers, a rear stowage bin and an antenna base.
    tsteel = a.part('Turret_head', 'Steel')
    tdark = a.part('Turret_head', 'Undercarriage')
    tarmor = a.part('Turret_head', 'Armor')
    tsteel.torus(.12, .012, loc=(-.25, .35, 1.615), seg=10, ring=3)
    for s in (-1, 1):
        tsteel.box((.02, .1, .02), loc=(-.25 + s * .08, .35, 1.625), bevel=0)
    tsteel.box((.22, .03, .03), loc=(-.25, .55, 1.56), bevel=0)
    for x in (.15, .32):
        tdark.box((.08, .06, .06), loc=(x, -.1, 1.55), bevel=0)
    for s in (-1, 1):
        rivets(tsteel, [(s * .6, -.02, 1.3), (s * .575, .3, 1.3), (s * .535, .55, 1.3)], r=.022, h=.02, rot=ACROSS)
        for k in range(3):
            tdark.cyl(.035, .1, loc=(s * (.36 + k * .045), -.3 + k * .08, 1.55), rot=(.6, 0, 0), seg=6, bevel=0)
        tsteel.box((.12, .2, .02), loc=(s * .3, -.4, 1.535), bevel=0)
    tarmor.box((.6, .14, .18), loc=(0, .62, 1.24), bevel=.015, seg=1)
    tsteel.box((.62, .02, .03), loc=(0, .695, 1.28), bevel=0)
    tsteel.cyl(.04, .06, loc=(.38, .5, 1.54), seg=8, bevel=0)
    # Twin cannons (x +-.26): breech bolts, two bands and a sleeve on each barrel, slots in the muzzles.
    cannon = a.part('Cannon', 'Steel')
    muzzle = a.part('Muzzle', 'Undercarriage')
    for s in (-1, 1):
        x = s * .26
        for y in (-1.0, -1.4):
            cannon.torus(.088, .012, loc=(x, y, 1.44), rot=FORWARD, seg=10, ring=3)
        cannon.cyl(.1, .1, loc=(x, -1.62, 1.44), rot=FORWARD, seg=10, bevel=0)
        rivets(cannon, [(x + .135 * math.cos(t), -.75, 1.4 + .135 * math.sin(t)) for t in (.4, 2.74, 3.54, 5.88)],
                     r=.018, h=.02, rot=FORWARD)
        for y in (-1.75, -1.85):
            for e in (-1, 1):
                muzzle.box((.03, .04, .12), loc=(x + e * .115, y, 1.44), bevel=0)


# ----------------------------------------------------------------------------- gunner
def gunner(a):
    import generate_gunner as gg
    gx, lx = -.36, .6
    for fig, role in ((gg.Figure(a, gx, .08, 0), 'gunner'), (gg.Figure(a, lx, .1, -.28), 'loader')):
        # Helmet: a steel visor frame, rebreathers, ear pieces, rim rivets.
        for z in (2.055, 1.925):
            fig.box('Visor_frame', 'Steel', (.34, .03, .02), (0, -.25, z), bevel=0)
        for s in (-1, 1):
            fig.box('Visor_frame', 'Steel', (.02, .03, .14), (s * .165, -.25, 1.99), bevel=0)
            fig.cyl('Rebreather', 'Undercarriage', .038, .08, (s * .09, -.24, 1.8), rot=FORWARD, seg=8, bevel=0)
            fig.cyl('Rebreather', 'Steel', .028, .02, (s * .09, -.285, 1.8), rot=FORWARD, seg=8, bevel=0)
            fig.cyl('Ear_piece', 'Undercarriage', .06, .04, (s * .195, -.01, 1.96), rot=ACROSS, seg=8, bevel=0)
            for y in (-.1, .1):
                fig.cyl('Helmet_rivets', 'Steel', .015, .02, (s * .19, y, 1.88), rot=ACROSS, seg=6, bevel=0)
            # Vest straps over the shoulders with buckles; magazine pouches; belt pouches with snaps.
            fig.box('Vest_straps', 'Undercarriage', (.06, .03, .36), (s * .17, -.255, 1.37), bevel=0)
            fig.box('Vest_straps', 'Undercarriage', (.06, .3, .03), (s * .17, -.08, 1.6), bevel=0)
            fig.box('Buckles', 'Steel', (.07, .025, .04), (s * .17, -.265, 1.48), bevel=0)
            fig.box('Mag_pouches', 'Undercarriage', (.09, .05, .12), (s * .12, -.265, 1.22), bevel=0)
            fig.box('Buckles', 'Steel', (.03, .015, .025), (s * .12, -.292, 1.26), bevel=0)
            fig.box('Belt_pouches', 'Fatigue', (.1, .08, .1), (s * .2, -.19, .97), bevel=.012)
            fig.box('Buckles', 'Steel', (.035, .015, .03), (s * .2, -.232, 1.0), bevel=0)
            # Team pad rivets, pack side pouches.
            for y in (-.12, .12):
                fig.cyl('Pad_rivets', 'Steel', .016, .02, (s * .47, y, 1.75), seg=6, bevel=0)
            fig.box('Pack_pouches', 'Undercarriage', (.04, .14, .2), (s * .225, .27, 1.34), bevel=0)
        fig.box('Buckles', 'Steel', (.1, .03, .06), (0, -.185, 1.0), bevel=0)
        fig.box('Patch_frame', 'Undercarriage', (.24, .02, .02), (0, -.262, 1.49), bevel=0)
        fig.cyl('Bedroll', 'Undercarriage', .06, .4, (0, .28, 1.62), rot=ACROSS, seg=8, bevel=0)
        for x in (-.12, .12):
            fig.box('Bedroll_straps', 'Steel', (.02, .13, .13), (x, .28, 1.62), bevel=0)
        # Legs on the shared hip pivots: shin stripe, boot caps and straps, thigh pockets.
        for s, side in SIDES:
            leg = f'leg_{side}'
            fig.box('Shin_stripe', 'Team', (.2, .02, .04), (s * .17, -.12, .3), parent=leg, bevel=0)
            fig.box('Boot_cap', 'Steel', (.2, .05, .05), (s * .17, -.27, .1), parent=leg, bevel=0)
            fig.box('Boot_strap', 'Undercarriage', (.27, .2, .03), (s * .17, -.03, .2), parent=leg, bevel=0)
            fig.box('Thigh_pocket', 'Fatigue', (.04, .13, .14), (s * .29, .02, .76), parent=leg, bevel=0)
            fig.box('Thigh_pocket', 'Steel', (.02, .04, .03), (s * .312, .02, .82), parent=leg, bevel=0)
        if role == 'loader':
            # Ammunition can: lid latches and a handle; antenna base with a spring coil.
            for x in (-.42, -.3):
                fig.box('Can_latch', 'Steel', (.03, .02, .05), (x, -.345, 1.07), bevel=0)
            fig.box('Can_handle', 'Steel', (.12, .03, .02), (-.36, -.28, 1.125), bevel=0)
            fig.cyl('Antenna_base', 'Undercarriage', .04, .1, (.14, .3, 1.6), seg=8, bevel=0)
            fig.cyl('Antenna_base', 'Steel', .03, .06, (.14, .3, 1.68), seg=6, bevel=0)
    # The gun (centre line gx): tripod hinge bolts and feet spikes, receiver rivets and cover hinge, sight
    # ring; on the recoiling rig: jacket cooling rings, a carry handle and slots in the flash hider.
    x = gx
    steel = a.part('Gun_bolts', 'Steel')
    dark = a.part('Gun_detail', 'Undercarriage')
    for foot in ((x - .5, -1.0, .04), (x + .5, -1.0, .04), (x, .1, .04)):
        dark.cyl(.02, .1, loc=(foot[0], foot[1], .0), seg=6, bevel=0)
        steel.cyl(.03, .02, loc=(foot[0], foot[1], .07), seg=6, bevel=0)
        mid = tuple(c + (f - c) * .45 for c, f in zip((x, -.42, 1.0), foot))
        steel.box((.09, .09, .05), loc=mid, bevel=0)
    steel.cyl(.04, .26, loc=(x, -.42, 1.0), rot=ACROSS, seg=8, bevel=0)
    rivets(steel, [(x + s * .112, y, z) for s in (-1, 1) for y in (-.6, -.4, -.2) for z in (1.14, 1.26)],
                r=.016, h=.015, rot=ACROSS)
    steel.cyl(.02, .22, loc=(x, -.21, 1.4), rot=ACROSS, seg=6, bevel=0)
    steel.torus(.04, .008, loc=(x, -.5, 1.52), rot=FORWARD, seg=8, ring=3)
    dark.box((.02, .02, .06), loc=(x, -.6, 1.47), bevel=0)
    for y in (-.7, -.8, -.9):
        a.part('Barrel_rings', 'Steel').torus(.088, .01, loc=(x, y, 1.2), rot=FORWARD, seg=10, ring=3)
    for y in (-.72, -.88):
        a.part('Barrel_handle', 'Undercarriage').box((.03, .03, .06), loc=(x, y, 1.3), bevel=0)
    a.part('Barrel_handle', 'Undercarriage').box((.03, .2, .03), loc=(x, -.8, 1.34), bevel=0)
    for e in (-1, 1):
        a.part('Muzzle_slots', 'Steel').box((.02, .07, .03), loc=(x + e * .068, -1.24, 1.2), bevel=0)
        a.part('Muzzle_slots', 'Steel').box((.03, .07, .02), loc=(x, -1.24, 1.2 + e * .068), bevel=0)
    # Belt cartridges along the brass feed; ammo-box latches, ribs and handle.
    pts = [(x + .55, -.46, .36), (x + .5, -.44, .62), (x + .34, -.4, 1.0), (x + .2, -.36, 1.22)]
    for p, q in zip(pts, pts[1:]):
        for t in (.25, .75):
            c = tuple(u + (v - u) * t for u, v in zip(p, q))
            a.part('Belt_rounds', 'Hazard').box((.03, .1, .03), loc=(c[0] - .03, c[1] - .02, c[2]), bevel=0)
    for e in (-1, 1):
        steel.box((.04, .02, .06), loc=(x + .55 + e * .1, -.585, .32), bevel=0)
        dark.box((.02, .2, .02), loc=(x + .55 + e * .172, -.46, .19), bevel=0)
    steel.box((.16, .03, .03), loc=(x + .55, -.46, .4), bevel=0)


# ----------------------------------------------------------------------------- stalker
def stalker(a):
    steel = a.part('Rig_detail', 'Steel')
    dark = a.part('Rig_straps', 'Undercarriage')
    armor = a.part('Rig_plates', 'Armor')
    # Mask (front y -.275, z 1.9..2.06): a steel frame round the slit, twin filters, a grille, cheek bolts.
    for z in (2.035, 1.965):
        steel.box((.26, .02, .015), loc=(0, -.282, z), bevel=0)
    for s in (-1, 1):
        steel.box((.015, .02, .085), loc=(s * .125, -.282, 2.0), bevel=0)
        dark.cyl(.035, .07, loc=(s * .08, -.29, 1.92), rot=FORWARD, seg=8, bevel=0)
        steel.cyl(.026, .02, loc=(s * .08, -.33, 1.92), rot=FORWARD, seg=8, bevel=0)
        rivets(steel, [(s * .155, -.23, z) for z in (1.94, 2.02)], r=.012, h=.015, rot=ACROSS)
    dark.grille(.08, .05, loc=(0, -.28, 1.92), slats=2, depth=.015, thickness=.012)
    # Mantle clasp with a team jewel, hood trim rivets.
    steel.cyl(.045, .03, loc=(0, -.27, 1.78), rot=FORWARD, seg=8, bevel=0)
    a.part('Clasp_jewel', 'Team').cyl(.025, .01, loc=(0, -.288, 1.78), rot=FORWARD, seg=6, bevel=0)
    rivets(steel, [(x, -.222, 2.2) for x in (-.16, 0, .16)], r=.012, h=.012, rot=FORWARD)
    # Chest rig (front y -.27): straps, buckles, pouch flaps and snaps, a knife.
    for s in (-1, 1):
        dark.box((.05, .02, .22), loc=(s * .2, -.278, 1.42), bevel=0)
        steel.box((.06, .02, .035), loc=(s * .2, -.285, 1.5), bevel=0)
        armor.box((.135, .07, .04), loc=(s * .15, -.29, 1.45), bevel=0)
        steel.box((.03, .012, .02), loc=(s * .15, -.326, 1.44), bevel=0)
    dark.box((.04, .025, .18), loc=(-.13, -.28, 1.2), rot=(0, .3, 0), bevel=0)
    steel.box((.025, .02, .12), loc=(-.17, -.285, 1.06), rot=(0, .3, 0), bevel=0)
    # Belt (front y -.2): buckle, pouches; satchel flap and snap; canteen cap and strap.
    steel.box((.1, .025, .06), loc=(0, -.205, 1.15), bevel=0)
    for x in (.14, .22):
        dark.box((.07, .06, .09), loc=(x, -.215, 1.08), bevel=0)
    steel.box((.03, .015, .02), loc=(.14, -.247, 1.11), bevel=0)
    armor.box((.21, .05, .1), loc=(-.36, -.11, 1.13), bevel=0)
    steel.box((.04, .015, .03), loc=(-.36, -.137, 1.1), bevel=0)
    steel.cyl(.03, .04, loc=(.37, .08, 1.15), seg=6, bevel=0)
    dark.box((.17, .17, .025), loc=(.37, .08, 1.02), bevel=0)
    # Legs (pivots at (+-.2, 0, .94)): a strap round the thigh, a thigh pocket, shin bolts and plate, boot caps
    # and laces.
    for s, side in SIDES:
        leg = f'leg_{side}'
        a.part('Thigh_strap', 'Undercarriage', leg).box((.235, .265, .035), loc=(0, 0, -.18), bevel=0)
        a.part('Thigh_strap', 'Steel', leg).box((.02, .05, .04), loc=(s * .12, -.03, -.18), bevel=0)
        a.part('Thigh_pocket', 'Armor', leg).box((.03, .14, .14), loc=(s * .12, .02, -.32), bevel=0)
        rivets(a.part('Shin_bolts', 'Steel', leg), [(x, -.157, -.66) for x in (-.07, .07)], r=.016, h=.015, rot=FORWARD)
        a.part('Shin_plate', 'Armor', leg).box((.14, .02, .12), loc=(0, -.157, -.73), bevel=0)
        a.part('Boot_cap', 'Steel', leg).box((.22, .05, .05), loc=(0, -.29, -.88), bevel=0)
        for k in range(3):
            a.part('Boot_laces', 'Steel', leg).box((.14, .015, .012), loc=(0, -.215 + k * .04, -.78), bevel=0)
    # Rifle: bolt handle, receiver rivets, scope rings, a turret knob and a bell ring, a sling;
    # on the recoiling rig: vent slots and a band on the shroud, ports in the muzzle brake.
    steel.limb((.385, -.2, 1.42), (.47, -.24, 1.4), .025, .025, bevel=0, seg=1)
    steel.sphere(.03, loc=(.48, -.24, 1.4), seg=6, rings=4)
    rivets(steel, [(.3 + e * .088, y, z) for e in (-1, 1) for y in (-.55, -.15) for z in (1.32, 1.44)],
                r=.013, h=.012, rot=ACROSS)
    for y in (-.62, -.05):
        steel.torus(.08, .01, loc=(.3, y, 1.66), rot=FORWARD, seg=10, ring=3)
    steel.cyl(.035, .05, loc=(.38, -.34, 1.66), rot=ACROSS, seg=8, bevel=0)
    steel.torus(.13, .01, loc=(.3, -.7, 1.66), rot=FORWARD, seg=12, ring=3)
    dark.box((.03, .9, .02), loc=(.39, -.15, 1.3), rot=(.08, 0, 0), bevel=0)
    for k in range(4):
        for e in (-1, 1):
            a.part('Barrel_vents', 'Undercarriage').box((.02, .1, .04), loc=(.3 + e * .081, -.85 - k * .15, 1.4), bevel=0)
    a.part('Barrel_vents', 'Steel').torus(.082, .01, loc=(.3, -1.58, 1.4), rot=FORWARD, seg=10, ring=3)
    for y in (-2.38, -2.46):
        for e in (-1, 1):
            a.part('Muzzle_ports', 'Undercarriage').box((.02, .04, .06), loc=(.3 + e * .085, y, 1.4), bevel=0)
    # Bipod feet and hinge pin.
    for e in (-1, 1):
        steel.box((.06, .04, .03), loc=(.3 + e * .12, -2.03, 1.31), bevel=0)
    steel.cyl(.02, .2, loc=(.3, -1.45, 1.34), rot=ACROSS, seg=6, bevel=0)


# ----------------------------------------------------------------------------- rampart
def rampart(a):
    import generate_rampart  # noqa: F401  (adds the Rust paint; build_kind has already imported it)
    steel = a.part('Steel', 'Steel')
    dark = a.part('Deck', 'Undercarriage')
    rust = a.part('Hull', 'Rust')
    # Track lugs under the bottom run (belts x .84..1.40, y -1.6..1.7, z .03..77).
    belt = a.part('Tracks', 'Undercarriage')
    for s in (-1, 1):
        for i in range(11):
            belt.box((.5, .07, .035), loc=(s * 1.12, -1.25 + i * .25, .05), bevel=0)
    for s in (-1, 1):
        # Skirts (x +-1.5, z .5..1.06): a second rivet row, a weld seam and a bolted patch plate; rear tow hooks.
        rivets(steel, [(s * 1.565, y, .6) for y in (-1.2, -.6, 0, .6, 1.2)], r=.03, h=.02, rot=ACROSS)
        steel.box((.02, 2.8, .025), loc=(s * 1.565, .05, .69), bevel=0)
        a.part('Skirt', 'Rust').box((.03, .5, .3), loc=(s * 1.57, -.3 + s * .5, .82), bevel=0)
        rivets(steel, [(s * 1.59, -.3 + s * .5 + dy, .82 + dz) for dy in (-.2, .2) for dz in (-.1, .1)],
                    r=.02, h=.015, rot=ACROSS)
        steel.torus(.08, .02, loc=(s * .85, 1.78, .72), rot=ACROSS, seg=8, ring=3)
        # Exhaust stacks (x +-.62, y 1.5, z 1.03..1.88): clamp bands and a heat shield.
        for z in (1.25, 1.7):
            steel.torus(.125, .012, loc=(s * .62, 1.5, z), seg=8, ring=3)
        dark.box((.03, .18, .4), loc=(s * .75, 1.5, 1.4), bevel=0)
        # Lamp guards round the headlights at the nose (x +-.55, y -1.72, z .98).
        for dx in (-.11, .11):
            steel.box((.025, .06, .14), loc=(s * .55 + dx, -1.75, .98), bevel=0)
        steel.box((.25, .06, .025), loc=(s * .55, -1.75, 1.06), bevel=0)
        # Weld beads along the deck edges.
        steel.box((.025, 2.5, .025), loc=(s * .95, -.05, 1.125), bevel=0)
    # Deck: a driver hatch with a handle and periscopes on the front deck, rivets round the engine grille, a
    # lashing chain over the scrap rack and a tool box.
    rust.cyl(.2, .04, loc=(-.55, -.95, 1.135), seg=10, bevel=0)
    steel.box((.22, .025, .025), loc=(-.55, -.95, 1.17), bevel=0)
    for x in (-.25, -.05, .15):
        dark.box((.12, .06, .06), loc=(x, -1.15, 1.15), bevel=0)
    rivets(steel, [(x, y, 1.135) for x in (-.68, .68) for y in (.8, 1.2)], r=.025, h=.02)
    steel.tube([(-.6, 1.86, 1.4), (0, 1.9, 1.35), (.6, 1.86, 1.4)], .022, seg=5)
    a.part('Toolbox', 'Undercarriage').box((.5, .2, .12), loc=(.55, -1.2, 1.18), bevel=.01, seg=1)
    steel.box((.1, .03, .03), loc=(.55, -1.31, 1.2), bevel=0)
    # Blade: welded ribs and a second rivet row on each leaf, bolts along the cutting edge, ram collars.
    blade = a.part('Blade', 'Rust')
    bsteel = a.part('Blade_arms', 'Steel')
    for s in (-1, 1):
        yaw = s * .42
        c, sn = math.cos(yaw), math.sin(yaw)

        def leaf(u, v, z, s=s, c=c, sn=sn):
            """A point near the leaf's front face: u along the leaf from its centre, v towards the back."""
            return (s * .66 + u * c - v * sn, -2.12 + u * sn + v * c, z)
        for u in (-.45, .45):
            blade.box((.1, .05, 1.0), loc=leaf(u, -.15, .98), rot=(0, 0, yaw), bevel=0)
        rivets(bsteel, [leaf(u, -.18, 1.3) for u in (-.55, -.2, .2, .55)], r=.035, h=.04, rot=(R90, 0, yaw))
        rivets(bsteel, [leaf(u, -.12, .45) for u in (-.5, 0, .5)], r=.03, h=.03, rot=(R90, 0, yaw))
        bsteel.torus(.07, .012, loc=(s * .85, -1.7, 1.25), rot=(R90 + .22, 0, 0), seg=8, ring=3)
    # Turret (Turret_head, z 1.24..1.76): hatch ring, handles and hinge, periscope hoods, rivet rows on the
    # cheeks, smoke dischargers, an antenna base and a rear rail.
    tsteel = a.part('Turret_head', 'Steel')
    tdark = a.part('Turret_head', 'Undercarriage')
    tsteel.torus(.13, .014, loc=(.4, .4, 1.84), seg=10, ring=3)
    for s in (-1, 1):
        tsteel.box((.025, .12, .025), loc=(.4 + s * .09, .4, 1.85), bevel=0)
    tsteel.box((.26, .04, .04), loc=(.4, .62, 1.79), bevel=0)
    for x in (.18, .52):
        tdark.box((.14, .04, .04), loc=(x, .16, 1.83), bevel=0)
    for s in (-1, 1):
        rivets(tsteel, [(s * .79, y, z) for y in (-.15, .15, .45) for z in (1.38, 1.62)], r=.025, h=.02, rot=ACROSS)
        for k in range(3):
            tdark.cyl(.04, .12, loc=(s * (.32 + k * .06), -.45 + k * .08, 1.79), rot=(.6, 0, 0), seg=6, bevel=0)
    rivets(tsteel, [(x, -.92, z) for x in (-.22, .22) for z in (1.48, 1.68)], r=.025, h=.02, rot=FORWARD)
    tsteel.cyl(.04, .08, loc=(-.5, .75, 1.79), seg=8, bevel=0)
    tdark.box((.6, .04, .04), loc=(0, .8, 1.66), bevel=0)
    # Ram gun (Main_cannon y -2.2..-1.0, Muzzle_brake y -2.8..-2.4): bands, breech bolts, brake slots.
    cannon = a.part('Main_cannon', 'Steel')
    for y in (-1.6, -2.05):
        cannon.torus(.205, .014, loc=(0, y, 1.78), rot=FORWARD, seg=10, ring=3)
    rivets(cannon, [(.2 * math.cos(t), -1.0, 1.78 + .2 * math.sin(t)) for t in (.5, 2.64, 3.64, 5.78)],
                 r=.025, h=.02, rot=FORWARD)
    brake = a.part('Muzzle_brake', 'Undercarriage')
    for y in (-2.52, -2.66):
        for e in (-1, 1):
            brake.box((.04, .06, .26), loc=(e * .28, y, 1.78), bevel=0)


# ----------------------------------------------------------------------------- carrier
def carrier(a):
    armor, dark = 'Armor', 'Undercarriage'

    def box(name, mat, size, loc, rot=(0, 0, 0)):
        a.part(name, mat).box(size, loc=loc, rot=rot, bevel=0)

    def bolts(name, mat, pts, rot=(0, 0, 0), r=.025):
        rivets(a.part(name, mat), pts, r=r, h=.02, rot=rot)

    # Cab (y -2.22..-.88, z .86..1.91): door outlines, handles and step plates, mirror arms, headlight guards,
    # tow hooks, wipers, grille and bumper bolts, roof hatch handle, hinge and bolts, hood vents.
    for s in (-1, 1):
        box('Cab_doors', dark, (.02, .02, .7), (s * 1.0, -1.9, 1.3), rot=(0, s * .07, 0))
        box('Cab_doors', dark, (.02, .02, .7), (s * 1.0, -1.2, 1.3), rot=(0, s * .07, 0))
        box('Cab_doors', dark, (.02, .7, .02), (s * .99, -1.55, 1.42))
        box('Door_handles', armor, (.03, .14, .03), (s * .99, -1.3, 1.3))
        box('Cab_steps', dark, (.3, .45, .04), (s * 1.0, -1.55, .9))
        box('Cab_steps', armor, (.3, .02, .02), (s * 1.0, -1.32, .93))
        box('Mirror_arms', dark, (.14, .025, .025), (s * 1.04, -2.0, 1.48))
        for dx in (-.14, .14):
            box('Lamp_guards', dark, (.02, .06, .26), (s * .62 + dx, -2.6, 1.12))
        box('Lamp_guards', dark, (.3, .06, .02), (s * .62, -2.6, 1.25))
        a.part('Tow_hooks', dark).torus(.07, .02, loc=(s * .8, -2.68, .8), rot=ACROSS, seg=8, ring=3)
        box('Wipers', dark, (.5, .02, .02), (s * .38, -2.26, 1.48), rot=(0, s * .35, 0))
    bolts('Grille_bolts', armor, [(x, -2.585, z) for x in (-.48, .48) for z in (.95, 1.22)], rot=FORWARD, r=.02)
    bolts('Bumper_bolts', armor, [(x, -2.665, .82) for x in (-.9, -.3, .3, .9)], rot=FORWARD)
    box('Hatch_handle', dark, (.3, .03, .03), (0, -1.65, 2.03))
    box('Hatch_hinge', dark, (.5, .04, .04), (0, -1.2, 2.02))
    bolts('Hatch_bolts', dark, [(x, y, 2.015) for x in (-.3, .3) for y in (-1.66, -1.24)], r=.02)
    bolts('Hood_bolts', dark, [(x, -2.3, 1.29) for x in (-.7, -.25, .25, .7)], rot=(.18, 0, 0), r=.02)
    box('Hood_vents', dark, (.6, .2, .02), (0, -2.15, 1.3), rot=(.18, 0, 0))
    # Cargo walls (x +-1.075, y -.775..2.075, z .95..1.77): two rivet rows, panel seams, jerrycans; tie-down
    # straps over the canvas between the ribs; mud flaps, fender lips and axle caps.
    for s in (-1, 1):
        bolts('Wall_rivets', dark, [(s * 1.085, y, z) for y in (-.6, 0, .6, 1.2, 1.8) for z in (1.06, 1.7)], rot=ACROSS)
        for y in (-.1, .55, 1.25):
            box('Wall_seams', dark, (.02, .02, .55), (s * 1.085, y + .25, 1.25))
        for y in (1.55, 1.8):
            box('Jerrycans', armor, (.08, .2, .3), (s * 1.12, y, 1.22))
            box('Jerrycans', dark, (.09, .04, .04), (s * 1.12, y, 1.39))
        for y in (-.25, .35, .95, 1.55):
            a.part('Roof_straps', dark).tube([(s * 1.1, y, 1.76), (s * .97, y, 2.12), (s * .56, y, 2.32),
                                              (0, y, 2.39)], .018, seg=4, caps=False)
        bolts('Wall_rivets', dark, [(s * 1.1, y, 1.76) for y in (-.25, .35, .95, 1.55)], rot=ACROSS, r=.03)
        for y in (-.9, .85, 1.8):
            box('Mud_flaps', dark, (.42, .03, .3), (s * 1.12, y, .85))
        box('Fender_lips', dark, (.04, 1.2, .03), (s * 1.37, -1.45, 1.06))
        box('Fender_lips', dark, (.04, 1.9, .03), (s * 1.37, .8, 1.06))
        # Axle caps on the hub centres (static and round, so they read the same on a turning wheel).
        for y in (-1.45, 0.25, 1.35):
            a.part('Axle_caps', dark).cyl(.08, .03, loc=(s * 1.315, y, .48), rot=ACROSS, seg=8, bevel=0)
    # Rear ramp: a ladder of grip bars, corner bolts, a hinge bar; an exhaust cap and clamp bands.
    for k in range(4):
        box('Ramp_ladder', dark, (1.2, .04, .04), (0, 2.21 + k * .012, .95 + k * .17), rot=(.12, 0, 0))
    bolts('Ramp_bolts', dark, [(x, 2.2, z) for x in (-.85, .85) for z in (1.0, 1.5)], rot=(R90 + .12, 0, 0))
    box('Ramp_hinges', dark, (1.6, .06, .05), (0, 2.12, .9))
    a.part('Exhaust_stack', dark).cyl(.1, .06, loc=(.95, -.95, 2.48), seg=8, bevel=0)
    for z in (1.8, 2.15):
        a.part('Exhaust_stack', armor).torus(.088, .01, loc=(.95, -.95, z), seg=8, ring=3)


DETAILS = {'medic': medic, 'engineer': engineer, 'breaker': breaker, 'gunner': gunner, 'stalker': stalker,
           'rampart': rampart, 'carrier': carrier}
