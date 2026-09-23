"""Generate the Frontier Command unit and structure models. No add-ons or paid services.

Headless:  blender --background --python tools/blender/generate_assets.py
Live, through MCP for Blender (builds into a separate "Frontier" scene):
    import sys; sys.path.insert(0, r'<repo>/github-io/tools/blender')
    import generate_assets; generate_assets.build_all(export=True)

Outputs public/models/<type>.glb and manifest.json. Headless runs also save
assets/source/frontier-library.blend. Units keep the named leg pivots used for walking;
run animate_units.py afterwards to bake the rigid-part clips used by the Godot edition.
Shared look development and runtime naming rules are documented in frontier_kit.py.
"""
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import Asset, arc, chamfered  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'assets' / 'source'
R90 = math.pi / 2
SIDES = ((-1, 'L'), (1, 'R'))
UNITS = ['worker', 'vanguard', 'ranger', 'breaker', 'medic', 'engineer', 'tank', 'antitank']
BUILDINGS = ['hq', 'barracks', 'foundry', 'relay', 'tower']
FORWARD = (R90, 0, 0)   # cylinder axis along Y; a cone's narrow end points to the front (-Y)
ACROSS = (0, R90, 0)    # cylinder axis along X


# ----------------------------------------------------------------------------- infantry
# Hand targets per class: (right elbow, right wrist, left elbow, left wrist). Arms are posed
# once; only the legs animate, so every hand must visibly grip its weapon or tool.
GRIPS = {
    'ranger': ((.46, -.06, 1.36), (.2, -.3, 1.31), (-.34, -.3, 1.38), (.06, -.64, 1.37)),
    'vanguard': ((.54, -.04, 1.38), (.42, -.3, 1.22), (-.56, -.04, 1.38), (-.52, -.3, 1.22)),
    'worker': ((.5, -.04, 1.36), (.42, -.33, 1.27), (-.5, -.04, 1.38), (-.36, -.32, 1.26)),
    'medic': ((.5, -.04, 1.36), (.34, -.36, 1.33), (-.5, -.04, 1.38), (-.38, -.32, 1.27)),
    'engineer': ((.5, -.04, 1.36), (.36, -.34, 1.3), (-.5, -.04, 1.38), (-.38, -.32, 1.27)),
    'antitank': ((.58, -.08, 1.42), (.42, -.34, 1.63), (-.32, -.32, 1.46), (.3, -.66, 1.7)),
}


def infantry(a, kind):
    heavy = kind == 'vanguard'
    b = 1.1 if heavy else 1.0
    plate = 'Team' if heavy else 'Armor'
    helmet = {'worker': 'Hazard', 'engineer': 'Hazard', 'medic': 'Medical'}.get(kind, 'Armor')
    pack_mat = {'medic': 'Medical', 'engineer': 'Hazard'}.get(kind, 'Armor')

    # Legs swing from the hip pivots (runtime and baked clips rotate these empties).
    for s, side in SIDES:
        leg = a.pivot(f'leg_{side}', (s * .21 * b, 0, .95))
        a.part('Leg_suit', 'Suit', leg).box((.22 * b, .26, .52), loc=(0, .02, -.27), bevel=.07, seg=1, taper=(1.15, 1.05))
        a.part('Thigh_plate' if heavy else 'Shin', plate, leg).box(
            (.23 * b, .09, .32), loc=(0, -.14, -.2), rot=(-.08, 0, 0), bevel=.035, seg=1)
        shin = a.part('Shin', 'Armor', leg)
        shin.box((.26 * b, .3, .36), loc=(0, -.02, -.6), bevel=.06, seg=1, taper=(1.12, 1.1))
        shin.box((.18, .13, .15), loc=(0, -.16, -.43), bevel=.05, seg=1)
        boot = a.part('Boot', 'Undercarriage', leg)
        boot.box((.28 * b, .46, .15), loc=(0, -.07, -.875), bevel=.05, seg=1, taper=(.92, .86), shift=(0, .02))
        boot.box((.24, .24, .14), loc=(0, .02, -.75), bevel=.04, seg=1)

    suit = a.part('Suit', 'Suit')
    suit.box((.46 * b, .32, .24), loc=(0, 0, 1.02), bevel=.08, seg=1)
    suit.box((.4 * b, .28, .24), loc=(0, .01, 1.22), bevel=.08, seg=1)
    gear = a.part('Gear', 'Undercarriage')
    gear.box((.54 * b, .36, .08), loc=(0, 0, 1.1), bevel=.025, seg=1)
    armor = a.part('Armor', 'Armor')
    for x in (-.19, .19):
        armor.box((.12, .09, .13), loc=(x * b, -.19, 1.03), bevel=.03, seg=1)
    armor.box((.28 * b, .12, .15), loc=(0, .19, 1.04), bevel=.03, seg=1)
    for z in (1.18, 1.28):
        armor.box((.3 * b, .07, .085), loc=(0, -.15, z), bevel=.025, seg=1)
    # Cuirass: broad chest with a V of pectoral plates and a dark sternum seam.
    team = a.part('Chest', 'Team')
    team.box((.68 * b, .44, .44), loc=(0, 0, 1.52), bevel=.1, taper=(1.1, 1.0))
    for s, _ in SIDES:
        team.box((.3 * b, .08, .24), loc=(s * .15 * b, -.215, 1.56), rot=(.12, 0, s * .18), bevel=.04)
    gear.box((.04, .05, .26), loc=(0, -.25, 1.54), bevel=.01, seg=1)
    armor.box((.5 * b, .4, .1), loc=(0, 0, 1.77), bevel=.035, seg=1)
    glow = a.part('Lights', 'TeamGlow')
    glow.box((.14, .03, .04), loc=(0, -.25, 1.7), bevel=.01, seg=1)
    right_elbow, right_wrist, left_elbow, left_wrist = GRIPS[kind]
    for s, _ in SIDES:
        team.box((.34 * b, .42, .24), loc=(s * .5 * b, 0, 1.72), rot=(0, s * .32, 0), bevel=.1)
        armor.box((.3 * b, .36, .1), loc=(s * .53 * b, 0, 1.57), rot=(0, s * .32, 0), bevel=.03, seg=1)
        shoulder = (s * .44 * b, .01, 1.6)
        elbow, wrist = (right_elbow, right_wrist) if s > 0 else (left_elbow, left_wrist)
        suit.limb(shoulder, elbow, .16 * b, .18, bevel=.05, seg=1)
        armor.limb(elbow, wrist, .19 * b, .2, bevel=.05, seg=1, taper=(.85, .85))
        armor.box((.14, .14, .12), loc=elbow, bevel=.04, seg=1)
        gear.box((.13, .14, .13), loc=wrist, bevel=.04, seg=1)

    helm = a.part('Helmet', helmet)
    helm.box((.38, .42, .34), loc=(0, 0, 2.0), bevel=.13, seg=2, taper=(.88, .9))
    a.part('Helmet_crest', 'Team').box((.08, .3, .06), loc=(0, .02, 2.18), bevel=.025)
    armor.box((.36, .08, .14), loc=(0, -.18, 1.89), rot=(-.2, 0, 0), bevel=.03, seg=1)   # jaw guard
    a.part('Visor', 'Alloy' if kind == 'engineer' else 'TeamGlow').box(
        (.32, .07, .12), loc=(0, -.2, 2.0), bevel=.03)
    steel = a.part('Steel', 'Steel')
    steel.box((.06, .14, .1), loc=(.2, .02, 1.98), bevel=.02, seg=1)

    pack = a.part('Pack', pack_mat)
    pack.box((.5 * b, .24, .48), loc=(0, .31, 1.5), bevel=.07)
    gear.grille(.34, .24, loc=(0, .44, 1.47), rot=(0, 0, math.pi), slats=4, depth=.05, thickness=.04)

    if kind == 'ranger':
        rifle = a.part('Rifle', 'Armor')
        rifle.box((.14, .56, .22), loc=(.12, -.42, 1.38), bevel=.035)
        rifle.box((.12, .34, .17), loc=(.12, -.02, 1.34), bevel=.03, taper=(1, .8))
        steel.cyl(.055, .5, loc=(.12, -.94, 1.42), rot=FORWARD, seg=10, bevel=.01, bseg=1)
        steel.cyl(.05, .24, loc=(.12, -.44, 1.55), rot=FORWARD, seg=10, bevel=.01, bseg=1)
        gear.cyl(.075, .12, loc=(.12, -1.2, 1.42), rot=FORWARD, seg=10, bevel=.015, bseg=1)
        gear.box((.09, .13, .22), loc=(.12, -.5, 1.2), rot=(-.2, 0, 0), bevel=.02, seg=1)
        a.part('Lens', 'Glass').box((.08, .02, .08), loc=(.12, -.565, 1.55), bevel=0)
        glow.box((.06, .03, .06), loc=(.12, -1.27, 1.42), bevel=.01, seg=1)
        steel.cyl(.015, .7, loc=(-.18, .38, 2.0), seg=6, bevel=0)
    elif heavy:
        shield = [(-.38, -.52), (-.38, .47), (0, .62), (.38, .47), (.38, -.42), (0, -.66)]
        team.prism(shield, .1, loc=(-.62, -.44, 1.2), rot=(0, 0, .28), axis='Y', bevel=.035)
        rim = [(x * 1.09, z * 1.08) for x, z in shield]
        armor.prism(rim, .06, loc=(-.6, -.37, 1.2), rot=(0, 0, .28), axis='Y', bevel=.02, seg=1)
        glow.box((.08, .03, .74), loc=(-.64, -.5, 1.2), rot=(0, 0, .28), bevel=.01, seg=1)
        steel.box((.08, 1.05, .19), loc=(.42, -.8, 1.22), bevel=.02, taper=(1, .2), shift=(0, -.02))
        glow.box((.035, .96, .045), loc=(.42, -.82, 1.11), bevel=.008, seg=1)
        gear.box((.14, .18, .14), loc=(.42, -.28, 1.22), bevel=.03, seg=1)
    elif kind == 'worker':
        cargo = a.part('Cargo', 'Alloy')
        cargo.cyl(.17, .46, loc=(0, .43, 1.58), seg=12, bevel=.03)
        for z in (1.36, 1.8):
            steel.torus(.19, .03, loc=(0, .43, z), seg=16, ring=6)
        armor.box((.2, .32, .2), loc=(.42, -.46, 1.27), bevel=.045)
        steel.cyl(.12, .46, loc=(.42, -.84, 1.27), rot=FORWARD, seg=12, r2=.02, bevel=0)
        for y in (-.68, -.8):
            steel.torus(.1, .02, loc=(.42, y, 1.27), rot=FORWARD, seg=12, ring=4)
        helm.box((.46, .5, .04), loc=(0, -.02, 2.06), bevel=.015, seg=1)
        cargo.cyl(.05, .07, loc=(-.5, 0, 1.87), seg=8, bevel=.01, bseg=1)
    elif kind == 'medic':
        pack.box((.22, .14, .14), loc=(-.4, -.4, 1.2), bevel=.03, seg=1)
        for sz in ((.1, .03, .32), (.32, .03, .1)):
            glow.box(sz, loc=(0, .44, 1.52), bevel=.008, seg=1)
        for sz in ((.06, .03, .2), (.2, .03, .06)):
            glow.box(sz, loc=(.5, -.02, 1.84), rot=(0, .32, 0), bevel=.008, seg=1)
        steel.cyl(.075, .38, loc=(.34, -.56, 1.34), rot=FORWARD, seg=10, bevel=.015, bseg=1)
        a.part('Emitter', 'Energy').cyl(.09, .1, loc=(.34, -.79, 1.34), rot=FORWARD, seg=12, bevel=.02, bseg=1)
    elif kind == 'engineer':
        for s in (-1, 1):
            steel.cyl(.08, .42, loc=(s * .14, .47, 1.55), seg=10, bevel=.02, bseg=1)
        steel.cyl(.05, .5, loc=(.36, -.6, 1.3), rot=FORWARD, seg=8, bevel=0)
        jaws = a.part('Jaws', 'Hazard')
        for s in (-1, 1):
            jaws.box((.08, .28, .17), loc=(.36 + s * .1, -.92, 1.3), bevel=.02, seg=1)
        a.part('Torch', 'Energy').cyl(.04, .09, loc=(.36, -1.07, 1.3), rot=FORWARD, seg=8, bevel=0)
        helm.box((.46, .5, .04), loc=(0, -.02, 2.06), bevel=.015, seg=1)
    elif kind == 'antitank':
        tube = a.part('Launcher', 'Armor')
        tube.cyl(.16, 1.5, loc=(.42, -.28, 1.83), rot=FORWARD, seg=14, bevel=.03)
        gear.cyl(.19, .14, loc=(.42, -1.05, 1.83), rot=FORWARD, seg=14, bevel=.02)
        steel.cyl(.14, .22, loc=(.42, .54, 1.83), rot=FORWARD, seg=14, r2=.19, bevel=.01, bseg=1)
        steel.box((.07, .2, .14), loc=(.42, -.34, 1.66), bevel=.015, seg=1)
        a.part('Sight', 'Glass').box((.09, .22, .11), loc=(.25, -.5, 1.97), bevel=.02, seg=1)
        glow.box((.03, .02, .06), loc=(.25, -.62, 1.97), bevel=0)
        rockets = a.part('Rockets', 'Alloy')
        for x in (-.15, .15):
            armor.cyl(.08, .62, loc=(x, .47, 1.6), seg=10, bevel=.02, bseg=1)
            rockets.cyl(.08, .14, loc=(x, .47, 1.98), seg=10, r2=.02, bevel=0)


# ----------------------------------------------------------------------------- vehicles
def tracks(a, half_width, length, height, wheel_r, wheels, z):
    belt = a.part('Tracks', 'Undercarriage')
    wheel = a.part('Wheels', 'Steel')
    fender = a.part('Armor', 'Armor')
    for s in (-1, 1):
        x = s * half_width
        rb = min(.24, height * .45)
        belt.box((.46, length, height), loc=(x, 0, z), bevel=rb, seg=3)
        # Track cleats show on the exposed front and rear curves; fenders cover the top run.
        for y0 in (-1, 1):
            for zc, angles in ((z + height / 2 - rb, (.5, 1.05)), (z - height / 2 + rb, (-.5, -1.05))):
                for phi in angles:
                    radial = (y0 * math.cos(phi), math.sin(phi))
                    belt.box((.5, .08, .05), loc=(x, y0 * (length / 2 - rb) + radial[0] * rb, zc + radial[1] * rb),
                             rot=(math.atan2(-radial[0], radial[1]), 0, 0), bevel=.012, seg=1)
        fender.box((.6, length * .9, .06), loc=(x, -.03, z + height / 2 + .05), bevel=.02, seg=1, taper=(1, .98))
        for i in range(wheels):
            y = -length / 2 + .45 + i * (length - .9) / (wheels - 1)
            wheel.cyl(wheel_r, .08, loc=(x + s * .25, y, z - .06), rot=ACROSS, seg=12, bevel=.02, bseg=1)
            belt.cyl(wheel_r * .4, .1, loc=(x + s * .27, y, z - .06), rot=ACROSS, seg=8, bevel=.01, bseg=1)


def breaker(a):
    tracks(a, .82, 2.6, .58, .2, 5, .36)
    hull = a.part('Hull', 'Team')
    hull.prism([(-1.25, .45), (-1.25, .62), (-.8, .95), (1.05, .95), (1.25, .75), (1.25, .45)], 1.24,
               loc=(0, 0, 0), bevel=.05)
    armor = a.part('Armor', 'Armor')
    for s in (-1, 1):
        armor.box((.1, 2.3, .3), loc=(s * 1.06, -.05, .74), bevel=.03, taper=(1, .96))
    armor.box((1.0, .5, .08), loc=(0, .72, .98), bevel=.02, seg=1)
    dark = a.part('Deck', 'Undercarriage')
    dark.grille(.8, .36, loc=(0, .74, 1.03), rot=(-R90, 0, 0), slats=5, depth=.08, thickness=.05)
    steel = a.part('Steel', 'Steel')
    for s in (-1, 1):
        steel.cyl(.07, .38, loc=(s * .42, 1.12, 1.12), seg=10, bevel=.015, bseg=1)
        a.part('Lamps', 'Lamp').box((.16, .04, .08), loc=(s * .38, -1.26, .7), bevel=.01, seg=1)
    steel.cyl(.6, .12, loc=(0, .05, 1.0), seg=20, bevel=.02, bseg=1)
    turret = a.part('turret', 'Armor')
    turret.prism([(-.55, .55), (.55, .55), (.63, -.1), (.42, -.62), (-.42, -.62), (-.63, -.1)], .46,
                 loc=(0, .1, 1.29), axis='Z', bevel=.05, taper=.9)
    hull.box((.18, .9, .05), loc=(0, .15, 1.53), bevel=.015, seg=1)
    hull.cyl(.18, .1, loc=(-.25, .35, 1.56), seg=12, bevel=.02, bseg=1)
    a.part('Periscope', 'Glass').box((.22, .06, .06), loc=(.2, -.36, 1.52), bevel=.01, seg=1)
    steel.cyl(.012, .8, loc=(.38, .5, 1.9), seg=5, bevel=0)
    cannon = a.part('Cannon', 'Steel')
    muzzle = a.part('Muzzle', 'Undercarriage')
    for s in (-1, 1):
        cannon.cyl(.13, .26, loc=(s * .26, -.62, 1.4), rot=FORWARD, seg=12, bevel=.02, bseg=1)
        cannon.cyl(.085, 1.1, loc=(s * .26, -1.2, 1.44), rot=FORWARD, seg=12, bevel=.01, bseg=1)
        muzzle.cyl(.12, .22, loc=(s * .26, -1.8, 1.44), rot=FORWARD, seg=12, bevel=.02, bseg=1)
        a.part('Muzzle_glow', 'TeamGlow').cyl(.065, .02, loc=(s * .26, -1.915, 1.44), rot=FORWARD, seg=10, bevel=0)


def tank(a):
    tracks(a, .95, 3.0, .66, .22, 6, .4)
    hull = a.part('Hull', 'Team')
    hull.prism([(-1.5, .5), (-1.5, .72), (-1.0, 1.08), (1.2, 1.08), (1.45, .9), (1.45, .5)], 1.45, bevel=.06)
    armor = a.part('Armor', 'Armor')
    steel = a.part('Steel', 'Steel')
    dark = a.part('Deck', 'Undercarriage')
    for s in (-1, 1):
        armor.box((.12, 2.75, .44), loc=(s * 1.24, -.05, .82), bevel=.04, taper=(1, .97))
        steel.bolts([(s * 1.31, y, .95) for y in (-1.1, -.55, 0, .55, 1.1)], r=.04, h=.04, rot=ACROSS)
        steel.cyl(.09, .34, loc=(s * .5, 1.52, .86), rot=FORWARD, seg=10, bevel=.015, bseg=1)
        a.part('Lamps', 'Lamp').box((.18, .04, .09), loc=(s * .45, -1.51, .78), bevel=.01, seg=1)
        steel.box((.12, .14, .1), loc=(s * .55, -1.55, .58), bevel=.02, seg=1)
    dark.grille(1.0, .5, loc=(0, .82, 1.13), rot=(-R90, 0, 0), slats=6, depth=.09, thickness=.05)
    steel.cyl(.82, .18, loc=(0, .15, 1.16), seg=24, bevel=.03)
    turret = a.part('turret', 'Armor')
    outline = [(-.72, .8), (.72, .8), (.86, .2), (.72, -.55), (.32, -.88), (-.32, -.88), (-.72, -.55), (-.86, .2)]
    turret.prism(outline, .58, loc=(0, .15, 1.53), axis='Z', bevel=.06, taper=.9)
    turret.box((1.2, .5, .4), loc=(0, 1.1, 1.5), bevel=.05, taper=(.95, .9))
    for s in (-1, 1):
        hull.box((.08, .9, .3), loc=(s * .8, .2, 1.52), rot=(0, 0, s * .12), bevel=.02)
        for i in range(3):
            steel.cyl(.045, .16, loc=(s * (.62 + i * .08), -.58, 1.72), rot=(.6, 0, s * .4), seg=8, bevel=0)
    steel.box((.5, .24, .42), loc=(0, -.78, 1.62), bevel=.05)
    hull.box((.3, 1.0, .04), loc=(0, .35, 1.83), bevel=.012, seg=1)
    hull.cyl(.24, .16, loc=(.35, .45, 1.9), seg=14, bevel=.03, bseg=1)
    armor.cyl(.2, .06, loc=(.35, .45, 2.0), seg=14, bevel=.015, bseg=1)
    glass = a.part('Periscope', 'Glass')
    for x in (.18, .52):
        glass.box((.1, .06, .07), loc=(x, .24, 1.93), bevel=.01, seg=1)
    dark.box((1.1, .4, .26), loc=(0, 1.42, 1.44), bevel=.03, seg=1)
    steel.cyl(.014, 1.0, loc=(-.5, .85, 2.3), seg=5, bevel=0)
    a.part('Beacon', 'TeamGlow').sphere(.05, loc=(-.5, .85, 2.81), seg=8, rings=5)
    cannon = a.part('Main_cannon', 'Steel')
    cannon.cyl(.12, 1.8, loc=(0, -1.78, 1.7), rot=FORWARD, seg=14, bevel=.02, bseg=1)
    cannon.cyl(.165, .32, loc=(0, -1.55, 1.7), rot=FORWARD, seg=14, bevel=.03)
    brake = a.part('Muzzle_brake', 'Undercarriage')
    brake.box((.36, .32, .3), loc=(0, -2.76, 1.7), bevel=.04)


# ----------------------------------------------------------------------------- structures
def foundation(a, w, d, c=.8, h=.3):
    base = a.part('Foundation', 'Concrete')
    base.prism(chamfered(w, d, c), h, loc=(0, 0, h / 2), axis='Z', bevel=.05, taper=.98)
    trim = a.part('Trim', 'Undercarriage')
    trim.prism(chamfered(w + .12, d + .12, c + .05), .08, loc=(0, 0, .04), axis='Z', bevel=.02, seg=1)
    lamps = a.part('Guide_lights', 'Lamp')
    for x, y in ((w / 2 - c / 2, -d / 2 + c / 2), (-w / 2 + c / 2, -d / 2 + c / 2)):
        lamps.box((.14, .14, .06), loc=(x - .12 * math.copysign(1, x), y + .12, h + .02),
                  rot=(0, 0, math.pi / 4), bevel=.02, seg=1)
    return h


def hq(a):
    h = foundation(a, 6.4, 6.2, 1.1)
    tier = a.part('Foundation', 'Concrete')
    tier.prism(chamfered(5.6, 5.4, 1.0), .2, loc=(0, 0, h + .1), axis='Z', bevel=.04)
    hall = a.part('Hall', 'Armor')
    hall.prism(chamfered(4.8, 4.4, 1.15), 1.8, loc=(0, 0, 1.4), axis='Z', bevel=.07, taper=.9)
    team = a.part('Team_panels', 'Team')
    team.prism(chamfered(4.5, 4.12, 1.05), .36, loc=(0, 0, 2.47), axis='Z', bevel=.05, taper=.94)
    hall.prism(chamfered(3.3, 3.1, .75), .95, loc=(0, .1, 3.1), axis='Z', bevel=.06, taper=.86)
    a.part('Windows', 'Glass').prism(chamfered(3.1, 2.9, .7), .26, loc=(0, .1, 3.14), axis='Z',
                                     bevel=.02, seg=1, taper=.97)
    team.prism(chamfered(2.9, 2.7, .62), .16, loc=(0, .1, 3.64), axis='Z', bevel=.04, taper=.94)
    steel = a.part('Steel', 'Steel')
    dark = a.part('Gear', 'Undercarriage')
    glow = a.part('Lights', 'TeamGlow')
    lamps = a.part('Lamps', 'Lamp')
    # Entrance (front, -Y)
    dark.box((1.5, .12, 1.3), loc=(0, -2.18, 1.16), bevel=.02, seg=1)
    for i in range(3):
        dark.box((1.44, .05, .03), loc=(0, -2.25, .72 + i * .34), bevel=0)
    steel.box((1.95, .42, .2), loc=(0, -2.22, 1.9), bevel=.04)
    for s in (-1, 1):
        hall.box((.26, .48, 1.55), loc=(s * .92, -2.16, 1.25), bevel=.04, taper=(.9, .85))
        lamps.box((.1, .06, .18), loc=(s * .92, -2.42, 1.62), bevel=.015, seg=1)
    glow.box((1.4, .05, .07), loc=(0, -2.44, 1.78), bevel=.01, seg=1)
    a.part('Hazard', 'Hazard').box((1.6, .36, .02), loc=(0, -2.62, .51), bevel=0)
    # Chamfer-corner buttresses with floodlights.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 2.02, sy * 1.82
            hall.box((.5, .9, 1.6), loc=(x, y, 1.3), rot=(0, 0, sx * sy * -math.pi / 4), bevel=.05, taper=(.6, .55))
            lamps.box((.14, .1, .1), loc=(x * 1.04, y * 1.04, 2.14), rot=(0, 0, sx * sy * -math.pi / 4),
                      bevel=.015, seg=1)
    # Side fuel tanks on cradles.
    for s in (-1, 1):
        steel.cyl(.36, 1.7, loc=(s * 2.62, .55, .95), rot=FORWARD, seg=16, bevel=.06)
        for y in (-.15, 1.25):
            hall.box((.7, .2, .5), loc=(s * 2.62, y, .68), bevel=.03, seg=1)
        a.part('Hazard', 'Hazard').cyl(.37, .1, loc=(s * 2.62, -.32, .95), rot=FORWARD, seg=16, bevel=.02, bseg=1)
    # Rear generator with vents and piping.
    hall.box((2.2, .9, 1.1), loc=(0, 2.35, 1.05), bevel=.05)
    dark.grille(1.6, .7, loc=(0, 2.82, 1.08), rot=(0, 0, math.pi), slats=5, depth=.08, thickness=.05)
    for s in (-1, 1):
        steel.tube([(s * .7, 2.3, 1.62), (s * .7, 2.3, 2.1), (s * .7, 1.7, 2.35)], .08, seg=8)
    # Roof: comms mast, radar dish and beacon.
    steel.cyl(.07, 1.6, loc=(.75, .6, 4.5), seg=8, bevel=0)
    steel.cyl(.18, .2, loc=(.75, .6, 3.8), seg=10, bevel=.03, bseg=1)
    glow.sphere(.11, loc=(.75, .6, 5.33), seg=10, rings=6)
    steel.cyl(.12, .55, loc=(-.75, .45, 3.95), seg=10, bevel=.02, bseg=1)
    dish = a.part('Dish', 'Steel')
    dish.lathe([(.06, 0), (.35, .06), (.62, .2), (.64, .24), (.58, .22), (.3, .1), (.05, .04)],
               loc=(-.75, .45, 4.25), rot=(-.5, 0, .6), seg=18)
    dark.cyl(.04, .4, loc=(-.75, .3, 4.47), rot=(-.5, 0, .6), seg=6, bevel=0)
    for s in (-1, 1):
        hall.box((.56, .56, .24), loc=(s * .7, -.55, 3.84), bevel=.04)
        dark.cyl(.2, .04, loc=(s * .7, -.55, 3.97), seg=14, bevel=0)
        steel.box((.44, .05, .03), loc=(s * .7, -.55, 3.99), rot=(0, 0, s * .6), bevel=0)
        steel.box((.05, .44, .03), loc=(s * .7, -.55, 3.99), rot=(0, 0, s * .6), bevel=0)


def barracks(a):
    h = foundation(a, 4.9, 4.7, .75)
    arch = [(-1.9, h)] + arc(0, 1.35, 1.9, math.pi, 0, 12) + [(1.9, h)]
    hangar = a.part('Hangar', 'Armor')
    hangar.prism(arch, 3.8, loc=(0, .15, 0), axis='Y', bevel=.04)
    team = a.part('Ribs', 'Team')
    rib = [(x * 1.035, (z - h) * 1.035 + h) for x, z in arch]
    for y in (-1.63, -.35, .95, 2.0):
        team.prism(rib, .2, loc=(0, y, 0), axis='Y', bevel=.03)
    dark = a.part('Gear', 'Undercarriage')
    steel = a.part('Steel', 'Steel')
    glow = a.part('Lights', 'TeamGlow')
    lamps = a.part('Lamps', 'Lamp')
    dark.box((2.3, .1, 1.75), loc=(0, -1.78, h + .88), bevel=.02, seg=1)
    for i in range(5):
        dark.box((2.24, .05, .03), loc=(0, -1.84, h + .3 + i * .33), bevel=0)
    for s in (-1, 1):
        steel.box((.2, .3, 1.95), loc=(s * 1.28, -1.8, h + .97), bevel=.04)
        lamps.box((.1, .05, 1.5), loc=(s * 1.13, -1.9, h + .9), bevel=.012, seg=1)
    steel.box((2.76, .32, .22), loc=(0, -1.82, h + 1.98), bevel=.04)
    glow.box((1.7, .05, .12), loc=(0, -1.99, h + 2.3), bevel=.015, seg=1)
    a.part('Hazard', 'Hazard').box((2.2, .4, .02), loc=(0, -2.15, h + .01), bevel=0)
    # Roof vents and fans.
    for y in (-.7, .9):
        dark.box((.7, .6, .3), loc=(0, y, 3.28), bevel=.04, seg=1)
        steel.cyl(.22, .06, loc=(0, y, 3.45), seg=14, bevel=.015, bseg=1)
    # Barracks annex with windows (left) and supply crates + mast (right).
    annex = a.part('Annex', 'Armor')
    annex.box((1.0, 2.4, 1.3), loc=(-2.05, .35, h + .65), bevel=.05)
    team.box((1.06, 2.46, .14), loc=(-2.05, .35, h + 1.36), bevel=.03, seg=1)
    a.part('Windows', 'Glass').box((.05, 1.9, .28), loc=(-2.56, .35, h + .92), bevel=.01, seg=1)
    crates = a.part('Crates', 'Hazard')
    for (x, y, z, r) in ((2.1, -.8, 0, .1), (2.15, -.1, 0, -.15), (2.12, -.45, .5, .3)):
        crates.box((.5, .5, .48), loc=(x, y, h + .24 + z), rot=(0, 0, r), bevel=.03, seg=1)
    steel.cyl(.05, 1.8, loc=(1.8, 1.7, h + 2.5), seg=8, bevel=0)
    glow.sphere(.09, loc=(1.8, 1.7, h + 3.45), seg=10, rings=6)
    steel.tube([(1.85, 1.2, h + .02), (1.85, 1.2, h + 1.1), (1.55, 1.2, h + 1.6)], .07, seg=8)


def foundry(a):
    h = foundation(a, 5.4, 5.1, .8)
    hall = a.part('Hall', 'Armor')
    hall.box((4.2, 3.6, 2.2), loc=(0, .25, h + 1.1), bevel=.08, taper=(.96, .96))
    team = a.part('Roof', 'Team')
    glass = a.part('Skylights', 'Glass')
    for i in range(3):
        y0 = -1.4 + i * 1.2
        team.prism([(y0, 0), (y0 + 1.2, 0), (y0 + 1.2, .08), (y0, .62)], 4.2, loc=(0, 0, h + 2.18), bevel=.03)
        glass.box((3.9, .05, .42), loc=(0, y0 - .02, h + 2.5), bevel=.01, seg=1)
    dark = a.part('Gear', 'Undercarriage')
    steel = a.part('Steel', 'Steel')
    hazard = a.part('Hazard', 'Hazard')
    glow = a.part('Lights', 'TeamGlow')
    lamps = a.part('Lamps', 'Lamp')
    dark.box((2.7, .1, 1.8), loc=(0, -1.57, h + .9), bevel=.02, seg=1)
    for i in range(6):
        dark.box((2.64, .05, .03), loc=(0, -1.63, h + .2 + i * .3), bevel=0)
    hazard.box((3.1, .2, .18), loc=(0, -1.62, h + 1.88), bevel=.03, seg=1)
    for s in (-1, 1):
        hazard.box((.2, .2, 1.8), loc=(s * 1.45, -1.62, h + .9), bevel=.03, seg=1)
    glow.box((2.3, .05, .1), loc=(0, -1.75, h + 2.06), bevel=.012, seg=1)
    # Vehicle exit: striped threshold plate and bollards either side of the bay.
    hazard.box((2.7, .5, .03), loc=(0, -1.95, h + .015), bevel=.01, seg=1)
    for i in range(7):
        dark.box((.14, .52, .012), loc=(-1.2 + i * .4, -1.95, h + .036), rot=(0, 0, .7), bevel=0)
    for s in (-1, 1):
        hazard.cyl(.1, .5, loc=(s * 1.55, -2.1, h + .25), seg=10, bevel=.03, bseg=1)
        dark.cyl(.105, .08, loc=(s * 1.55, -2.1, h + .32), seg=10, bevel=0)
    # Smokestacks with glowing furnace rims.
    for s in (-1, 1):
        x, y = s * 1.35, 1.25
        steel.cyl(.36, 2.6, loc=(x, y, h + 2.9), seg=18, bevel=.03)
        for z in (h + 2.4, h + 3.4):
            dark.cyl(.39, .12, loc=(x, y, z), seg=18, bevel=.02, bseg=1)
        dark.cyl(.3, .1, loc=(x, y, h + 4.16), seg=16, bevel=0)
        a.part('Furnace', 'Alloy').torus(.33, .05, loc=(x, y, h + 4.2), seg=18, ring=6)
    # Gantry crane over the bay.
    for s in (-1, 1):
        steel.box((.16, .16, 1.0), loc=(s * 1.9, -1.6, h + 2.6), bevel=.03, seg=1)
    steel.box((4.0, .18, .2), loc=(0, -1.6, h + 3.15), bevel=.03)
    hazard.box((.4, .3, .22), loc=(.6, -1.6, h + 2.98), bevel=.03, seg=1)
    dark.cyl(.02, .5, loc=(.6, -1.6, h + 2.62), seg=5, bevel=0)
    # Side tanks and piping.
    for y in (-.4, .9):
        steel.cyl(.4, 1.5, loc=(-2.5, y, h + .75), seg=16, bevel=.06)
        steel.tube([(-2.5, y, h + 1.5), (-2.5, y, h + 1.75), (-2.05, y, h + 1.75)], .07, seg=8)
    for s in (-1, 1):
        lamps.box((.12, .1, .1), loc=(2.12, s * 1.1, h + 2.05), bevel=.015, seg=1)


def relay(a):
    h = foundation(a, 3.3, 3.3, .85)
    base = a.part('Base', 'Armor')
    base.prism(chamfered(2.4, 2.4, .7), .6, loc=(0, 0, h + .3), axis='Z', bevel=.05, taper=.88)
    a.part('Core', 'Energy').cyl(.42, 1.25, loc=(0, 0, h + 1.25), seg=16, bevel=.04)
    steel = a.part('Steel', 'Steel')
    team = a.part('Rings', 'Team')
    for z in (h + .72, h + 1.82):
        team.torus(.56, .08, loc=(0, 0, z), seg=20, ring=8)
    a.part('Lights', 'TeamGlow').torus(.52, .035, loc=(0, 0, h + 1.27), seg=20, ring=6)
    for i in range(6):
        ang = i * math.tau / 6
        steel.box((.08, .08, 1.2), loc=(math.cos(ang) * .56, math.sin(ang) * .56, h + 1.27), rot=(0, 0, ang),
                  bevel=.02, seg=1)
    base.cyl(.66, .26, loc=(0, 0, h + 2.02), seg=18, bevel=.05)
    steel.cyl(.3, .45, loc=(0, 0, h + 2.37), r2=.12, seg=14, bevel=.02, bseg=1)
    steel.cyl(.04, 1.1, loc=(0, 0, h + 3.1), seg=6, bevel=0)
    a.part('Lights', 'TeamGlow').sphere(.1, loc=(0, 0, h + 3.7), seg=10, rings=6)
    gear = a.part('Gear', 'Undercarriage')
    # Diagonal pylons from the plinth corners to the cap.
    for i in range(4):
        ang = math.pi / 4 + i * math.pi / 2
        c, s = math.cos(ang), math.sin(ang)
        base.tube([(c * 1.2, s * 1.2, h), (c * 1.05, s * 1.05, h + .9), (c * .62, s * .62, h + 1.95)], .09, seg=8)
        gear.box((.34, .34, .2), loc=(c * 1.2, s * 1.2, h + .1), rot=(0, 0, ang), bevel=.03, seg=1)
    gear.tube([(1.5, -.2, .04), (1.25, -.2, .2), (1.0, -.25, h + .25)], .05, seg=6)


def tower(a):
    h = foundation(a, 2.9, 2.9, .75)
    ped = a.part('Pedestal', 'Armor')
    ped.prism(chamfered(1.7, 1.7, .48), 2.6, loc=(0, 0, h + 1.3), axis='Z', bevel=.05, taper=.72)
    a.part('Band', 'Team').prism(chamfered(1.52, 1.52, .43), .32, loc=(0, 0, h + 1.7), axis='Z', bevel=.03,
                                 taper=.97)
    a.part('Lights', 'TeamGlow').box((.14, .05, 1.3), loc=(0, -.7, h + .95), rot=(-.09, 0, 0), bevel=.01, seg=1)
    steel = a.part('Steel', 'Steel')
    steel.cyl(.74, .24, loc=(0, 0, 3.02), seg=20, bevel=.04)
    for s in (-1, 1):
        a.part('Gear', 'Undercarriage').box((.3, .5, .9), loc=(s * .72, .2, h + .5), bevel=.04, seg=1)
    # Rotating head: everything named Turret_head/Barrel/Muzzle aims and recoils together.
    head = a.part('Turret_head', 'Armor')
    head.prism([(-.6, .62), (.6, .62), (.72, .1), (.5, -.56), (-.5, -.56), (-.72, .1)], .66,
               loc=(0, 0, 3.5), axis='Z', bevel=.05, taper=.88)
    a.part('Turret_head', 'Team').box((.9, .7, .08), loc=(0, .12, 3.86), bevel=.03)
    a.part('Turret_head', 'Glass').box((.36, .06, .14), loc=(0, -.54, 3.72), rot=(-.3, 0, 0), bevel=.02, seg=1)
    a.part('Turret_head', 'Undercarriage').grille(.6, .3, loc=(0, .64, 3.5), rot=(0, 0, math.pi), slats=3,
                                                  depth=.06, thickness=.05)
    barrel = a.part('Barrel', 'Steel')
    muzzle = a.part('Muzzle', 'Undercarriage')
    for s in (-1, 1):
        barrel.cyl(.12, .3, loc=(s * .25, -.6, 3.65), rot=FORWARD, seg=12, bevel=.02, bseg=1)
        barrel.cyl(.075, 1.0, loc=(s * .25, -1.1, 3.65), rot=FORWARD, seg=12, bevel=.01, bseg=1)
        muzzle.cyl(.11, .18, loc=(s * .25, -1.62, 3.65), rot=FORWARD, seg=12, bevel=.02, bseg=1)


# ----------------------------------------------------------------------------- pipeline
def _infantry(kind):
    return lambda a: infantry(a, kind)


BUILDERS = {
    **{k: _infantry(k) for k in ['worker', 'vanguard', 'ranger', 'medic', 'engineer', 'antitank']},
    'breaker': breaker, 'tank': tank,
    'hq': hq, 'barracks': barracks, 'foundry': foundry, 'relay': relay, 'tower': tower,
}


def build(kind, root):
    unit = kind in UNITS
    infantry_unit = kind in GRIPS
    # Infantry parts are small enough for corner AO; vehicles use tighter contact AO;
    # structures get a coarse lattice so long walls and roofs carry AO gradients.
    a = Asset(kind, root, ao_distance=.7 if infantry_unit else .5 if unit else 1.6,
              grime_height=.45 if unit else .9, lattice=0 if unit else 1.2)
    BUILDERS[kind](a)
    return a.finish()


def build_all(kinds=None, export=True, layout=True):
    root = kit.workspace()
    kit.clear_workspace(root, keep=('frontier_environment',))
    OUT.mkdir(parents=True, exist_ok=True)
    kinds = kinds or UNITS + BUILDINGS
    manifest = {'generator': 'Blender Python (frontier_kit)', 'units': 'meters',
                'provenance': 'Original assets generated for this repository; no third-party model sources.',
                'assets': []}
    built = {}
    for index, kind in enumerate(kinds):
        a = build(kind, root)
        built[kind] = a
        tris = a.triangles()
        if export:
            a.export(OUT / f'{kind}.glb')
        manifest['assets'].append({'name': kind, 'file': f'{kind}.glb', 'triangles': tris,
                                   'animation': 'Runtime articulated parts; no baked clips'})
        if layout:
            a.offset((index % 5) * 9, (index // 5) * 9)
    if export and set(kinds) == set(UNITS + BUILDINGS):
        (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return built, manifest


if __name__ == '__main__':
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    _, result = build_all()
    SOURCE.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'frontier-library.blend'))
    print('FRONTIER_ASSETS_COMPLETE', json.dumps(result))
