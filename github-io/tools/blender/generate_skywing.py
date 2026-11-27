"""Skywing, the assist hero's own model (owner 2026-11-28: "I can't see the hero below the Kite").
Headless Blender 5.2.5 LTS; no external assets.

  blender -b --factory-startup --python tools/blender/generate_skywing.py -- [--manifest]
  node tools/compress-models.mjs public/models/skywing.glb          (meshopt, after every export)
  node tools/build-detail.mjs skywing                               (the close-up model, generate_detail.py)

A ranger-style pilot wearing a rigid jet-wing on the back: helmet and goggles, a back pack with two thrusters
(team glow in the nozzles), two swept wings with a team-colour sail stripe and a glowing wing tip, and the weapon
in hand (a long sniper rifle or a compact rocket launcher, one shown at a time). The Kite scout keeps its own
model (generate_air.py kite); Skywing only draws this one (src/skywing-view.js).

Authored standing, like the infantry (Blender -Y is the front, z = 0 the soles), wings spread. The runtime
(src/unit-rig.js shader bones, src/skywing-view.js) poses it:
  * flying: the whole model pitches forward about the hip until the pilot lies prone, wings out to the sides
    (as modelled), arms raised so the weapon points ahead between the wings, legs trailing;
  * landed: upright, the wings folded flat down the back, arms down holding the weapon, legs walking.
Runtime contract (src/view.js buildTemplates, type "skywing"):
  * leg_L / leg_R      hip pivots (the infantry walk, as every Meridian trooper)
  * skywing_wing_L/_R  wing hinges on the back pack; the wing folds about the axis through the back (Blender Y)
  * skywing_arms       the shoulder line: arms and gloves raise about it in flight
  * skywing_sniper / skywing_rocket  the two weapons, each on its own pivot at the shoulder line (it raises with
                       the arms); the view shows the one in hand
Materials: kit paints only (they bake into one draw), Team for the chest, crest and wing stripes, TeamGlow for the
visor, goggles, nozzles and wing tips (a flyer's glow joins its team paint): 3 draws with the weapon.
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
from frontier_kit import Asset  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'models'
R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y (front is -Y)
ACROSS = (0, R90, 0)    # cylinder axis along X
SIDES = ((-1, 'L'), (1, 'R'))
BUDGET = 5000           # the hero model (the close-up one: generate_detail.py, 15000)
HIP = .95
SHOULDER = (0, .01, 1.6)   # the arms' and weapons' pivot (the shoulder line)
WING_HINGE = (.2, .45, 1.66)  # x mirrored per side; on the back pack, under the hinge housing
WING_STAGGER = .03            # the right wing sits this much further back, so folded wings never z-fight
# Hands (from the Ranger's rifle grip): right elbow, right wrist, left elbow, left wrist.
GRIP = ((.46, -.06, 1.36), (.2, -.3, 1.31), (-.34, -.3, 1.38), (.06, -.64, 1.37))


def rel(p, origin):
    return tuple(a - b for a, b in zip(p, origin))


def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.03, parent=None, taper=(1, 1)):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=1, taper=taper)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12, r2=None, bevel=.015, parent=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, r2=r2, bevel=bevel, bseg=1)


def legs(a):
    """The Ranger's legs in a flight suit: suit, armoured shins, boots (they walk on the hip pivots)."""
    for s, side in SIDES:
        leg = a.pivot(f'leg_{side}', (s * .19, 0, HIP))
        a.part('Leg_suit', 'Suit', leg).box((.21, .25, .52), loc=(0, .02, -.27), bevel=.07, seg=1, taper=(1.15, 1.05))
        shin = a.part('Shin', 'Armor', leg)
        shin.box((.22, .09, .3), loc=(0, -.14, -.2), rot=(-.08, 0, 0), bevel=.035, seg=1)
        shin.box((.25, .29, .36), loc=(0, -.02, -.6), bevel=.06, seg=1, taper=(1.12, 1.1))
        boot = a.part('Boot', 'Undercarriage', leg)
        boot.box((.27, .44, .15), loc=(0, -.07, -.875), bevel=.05, seg=1, taper=(.92, .86), shift=(0, .02))
        boot.box((.23, .24, .14), loc=(0, .02, -.75), bevel=.04, seg=1)


def torso(a):
    suit = a.part('Suit', 'Suit')
    suit.box((.44, .3, .24), loc=(0, 0, 1.02), bevel=.08, seg=1)
    suit.box((.4, .28, .24), loc=(0, .01, 1.22), bevel=.08, seg=1)
    gear = a.part('Gear', 'Undercarriage')
    gear.box((.52, .34, .08), loc=(0, 0, 1.1), bevel=.025, seg=1)               # belt
    # Slim flight cuirass in team paint, with a dark harness crossing it (the wing pack's straps).
    team = a.part('Chest', 'Team')
    team.box((.62, .42, .42), loc=(0, 0, 1.52), bevel=.1, taper=(1.1, 1.0))
    for s, _ in SIDES:
        gear.box((.07, .04, .52), loc=(s * .12, -.225, 1.5), rot=(0, s * .45, 0), bevel=0)
        team.box((.36, .46, .22), loc=(s * .47, 0, 1.71), rot=(0, s * .32, 0), bevel=.09)   # pauldrons
    gear.box((.16, .05, .12), loc=(0, -.235, 1.5), bevel=.015, seg=1)          # harness buckle
    a.part('Armor', 'Armor').box((.46, .38, .1), loc=(0, 0, 1.77), bevel=.035, seg=1)   # collar


def head(a):
    """Flight helmet with a team crest, a glowing visor slit and big round goggles."""
    a.part('Helmet', 'Armor').box((.44, .47, .36), loc=(0, 0, 2.02), bevel=.13, seg=2, taper=(.88, .9))
    a.part('Helmet_crest', 'Team').box((.12, .4, .07), loc=(0, .03, 2.21), bevel=.025)
    a.part('Armor', 'Armor').box((.34, .08, .13), loc=(0, -.17, 1.88), rot=(-.2, 0, 0), bevel=.03, seg=1)   # jaw guard
    strap = a.part('Goggle_strap', 'Undercarriage')
    strap.box((.47, .44, .06), loc=(0, .01, 2.05), bevel=.02, seg=1)
    for s in (-1, 1):
        cyl(a, 'Goggles', 'Steel', .085, .07, (s * .095, -.235, 2.04), rot=FORWARD, seg=12, bevel=.01)
        cyl(a, 'Goggle_lens', 'TeamGlow', .062, .03, (s * .095, -.272, 2.04), rot=FORWARD, seg=12, bevel=0)
    box(a, 'Goggles', 'Steel', (.06, .05, .04), (0, -.24, 2.05), bevel=0)        # bridge


def wing_pack(a):
    """The rigid jet-wing: a back plate, a hinge housing for the wings, two thrusters with glowing nozzles."""
    pack = a.part('Pack', 'Armor')
    pack.box((.42, .2, .7), loc=(0, .29, 1.44), bevel=.06, seg=1, taper=(.85, 1))
    pack.box((.5, .14, .18), loc=(0, .36, 1.7), bevel=.04, seg=1)
    cyl(a, 'Hinge', 'Steel', .07, .56, (0, .45, 1.66), rot=ACROSS, seg=10, bevel=.01)
    for s in (-1, 1):
        cyl(a, 'Thruster', 'Steel', .09, .44, (s * .13, .42, 1.17), seg=12, bevel=.015)
        cyl(a, 'Thruster', 'Undercarriage', .1, .14, (s * .13, .42, .89), seg=12, r2=.08, bevel=.01)
        cyl(a, 'Nozzle', 'TeamGlow', .068, .03, (s * .13, .42, .81), seg=12, bevel=0)
        box(a, 'Thruster_fin', 'Hazard', (.03, .14, .2), (s * .24, .42, 1.12), bevel=0)


def wing(a, s, side):
    """One swept wing on its hinge (origin at the hinge): an armour panel with a steel leading edge, a team sail
    stripe on the back face (up in flight), a team winglet and a glowing tip. Spread along X, swept toward the feet."""
    x, y, z = WING_HINGE
    p = a.pivot(f'skywing_wing_{side}', (s * x, y + (WING_STAGGER if s > 0 else 0), z))
    span, tip = 1.32, s * 1.32
    # Profile in (x, z) about the hinge: root leading edge high, tip swept down and back.
    outline = [(0, .12), (tip, -.26), (tip, -.44), (s * .5, -.5), (0, -.44)]
    if s > 0:
        outline = list(reversed(outline))
    a.part('Wing', 'Armor', p).prism(outline, .05, axis='Y', bevel=.012, seg=1)
    # Steel leading-edge spar from root to tip.
    a.part('Wing_spar', 'Steel', p).limb((0, -.005, .1), (tip * .98, -.005, -.255), .05, .06, bevel=0, seg=1)
    # Team sail stripe on the back face, along the middle of the chord, and a team winglet at the tip.
    a.part('Wing_stripe', 'Team', p).limb((s * .06, .032, -.12), (tip * .94, .032, -.33), .13, .016, bevel=0, seg=1)
    box(a, 'Wing_stripe', 'Team', (.04, .14, .2), (tip, .07, -.36), bevel=.008, parent=p)
    box(a, 'Wing_tip', 'TeamGlow', (.05, .06, .1), (tip + s * .03, 0, -.33), bevel=0, parent=p)
    # A dark root fairing where the wing meets the hinge housing.
    box(a, 'Wing_root', 'Undercarriage', (.16, .09, .5), (s * .06, 0, -.16), bevel=.02, parent=p)
    return span


def arms(a):
    """Upper arms, forearms and gloves on the shoulder pivot (they raise in flight)."""
    p = a.pivot('skywing_arms', SHOULDER)
    right_elbow, right_wrist, left_elbow, left_wrist = GRIP
    suit, armor, glove = a.part('Arm_suit', 'Suit', p), a.part('Arm_armor', 'Armor', p), a.part('Glove', 'Undercarriage', p)
    for s, _ in SIDES:
        shoulder = (s * .42, .01, 1.6)
        elbow, wrist = (right_elbow, right_wrist) if s > 0 else (left_elbow, left_wrist)
        suit.limb(rel(shoulder, SHOULDER), rel(elbow, SHOULDER), .16, .18, bevel=.05, seg=1)
        armor.limb(rel(elbow, SHOULDER), rel(wrist, SHOULDER), .18, .19, bevel=.05, seg=1, taper=(.85, .85))
        armor.box((.13, .13, .12), loc=rel(elbow, SHOULDER), bevel=.04, seg=1)
        glove.box((.13, .14, .13), loc=rel(wrist, SHOULDER), bevel=.04, seg=1)


def sniper(a):
    """The long marksman rifle (the Ranger's, a touch longer), held at the grip; no lights (one baked draw)."""
    p = a.pivot('skywing_sniper', SHOULDER)
    r = lambda q: rel(q, SHOULDER)  # noqa: E731
    stock = a.part('Rifle', 'Armor', p)
    stock.box((.13, .56, .2), loc=r((.12, -.42, 1.37)), bevel=.03)
    stock.box((.11, .34, .16), loc=r((.12, -.02, 1.33)), bevel=.03, taper=(1, .8))
    steel = a.part('Rifle_steel', 'Steel', p)
    steel.cyl(.06, 1.2, loc=r((.12, -1.28, 1.41)), rot=FORWARD, seg=8, bevel=.01, bseg=1)
    steel.cyl(.06, .5, loc=r((.12, -.46, 1.58)), rot=FORWARD, seg=10, bevel=.01, bseg=1)       # scope
    dark = a.part('Rifle_dark', 'Undercarriage', p)
    dark.cyl(.068, .18, loc=r((.12, -1.92, 1.41)), rot=FORWARD, seg=8, bevel=.015, bseg=1)    # muzzle brake
    dark.box((.08, .13, .2), loc=r((.12, -.5, 1.2)), rot=(-.2, 0, 0), bevel=.02, seg=1)       # magazine
    a.part('Rifle_band', 'Hazard', p).cyl(.072, .05, loc=r((.12, -.72, 1.58)), rot=FORWARD, seg=10, bevel=0)


def rocket(a):
    """The compact rocket launcher: a thick tube held like the rifle, a hazard warhead ring at the mouth."""
    p = a.pivot('skywing_rocket', SHOULDER)
    r = lambda q: rel(q, SHOULDER)  # noqa: E731
    a.part('Launcher', 'Armor', p).cyl(.14, 1.25, loc=r((.12, -.72, 1.45)), rot=FORWARD, seg=14, bevel=.03)
    dark = a.part('Launcher_dark', 'Undercarriage', p)
    dark.cyl(.165, .14, loc=r((.12, -1.32, 1.45)), rot=FORWARD, seg=14, bevel=.02)            # mouth ring
    dark.box((.08, .12, .18), loc=r((.12, -.5, 1.24)), rot=(.2, 0, 0), bevel=.015, seg=1)     # grip
    steel = a.part('Launcher_steel', 'Steel', p)
    steel.cyl(.13, .2, loc=r((.12, -.02, 1.45)), rot=FORWARD, seg=14, r2=.17, bevel=.01, bseg=1)   # rear flare
    steel.box((.07, .22, .1), loc=r((.12, -.7, 1.62)), bevel=.015, seg=1)                    # sight
    a.part('Launcher_band', 'Hazard', p).cyl(.145, .1, loc=r((.12, -1.12, 1.45)), rot=FORWARD, seg=14, bevel=0)
    a.part('Launcher_band', 'Hazard', p).cyl(.09, .1, loc=r((.12, -1.4, 1.45)), rot=FORWARD, seg=10, r2=.03, bevel=0)  # warhead


def skywing(a):
    legs(a)
    torso(a)
    head(a)
    wing_pack(a)
    for s, side in SIDES:
        wing(a, s, side)
    arms(a)
    sniper(a)
    rocket(a)


def detail(a):
    """Close-up parts (generate_detail.py, family 'skywing'): only read near the Hero mode camera. Same pivots, part
    names and materials as the normal model (Team, TeamGlow, kit paints), so the close view swaps one for the other."""
    steel, gear = a.part('Steel', 'Steel'), a.part('Gear', 'Undercarriage')
    # Helmet: ear pieces with rivets, a rim of rivets, a small antenna with a light, goggle rims.
    for s in (-1, 1):
        gear.cyl(.07, .05, loc=(s * .235, -.02, 1.98), rot=ACROSS, seg=10, bevel=.008, bseg=1)
        steel.cyl(.026, .02, loc=(s * .265, -.02, 1.98), rot=ACROSS, seg=6, bevel=0)
        steel.bolts([(s * .222, y, 1.9) for y in (-.12, .0, .12)], r=.018, h=.02, rot=ACROSS)
        a.part('Goggles', 'Steel').torus(.075, .014, loc=(s * .095, -.272, 2.04), rot=FORWARD, seg=12, ring=3)
    steel.cyl(.012, .34, loc=(-.16, .1, 2.3), seg=5, bevel=0)
    box(a, 'Goggle_lens', 'TeamGlow', (.03, .03, .03), (-.16, .1, 2.48), bevel=0)
    gear.grille(.14, .07, loc=(0, -.225, 1.84), slats=3, depth=.02, thickness=.015)   # rebreather
    # Chest: harness buckles, a team stripe across the cuirass, pouches on the belt, a chest light.
    for s in (-1, 1):
        steel.box((.08, .03, .06), loc=(s * .2, -.255, 1.68), bevel=0)
        gear.box((.1, .08, .1), loc=(s * .17, -.2, 1.08), bevel=.015, seg=1)
        steel.box((.04, .02, .03), loc=(s * .17, -.245, 1.11), bevel=0)
        steel.bolts([(s * .45 + s * k * .07, 0, 1.84) for k in (-1, 0, 1)], r=.018, h=.02)
    a.part('Chest', 'Team').box((.5, .02, .05), loc=(0, -.215, 1.38), bevel=0)
    box(a, 'Goggle_lens', 'TeamGlow', (.1, .02, .03), (0, -.262, 1.58), bevel=0)
    # Legs: knee pads, a team stripe on each shin, boot caps and straps (on the hip pivots: they walk).
    for s, side in SIDES:
        leg = f'leg_{side}'
        a.part('Shin', 'Armor', leg).box((.2, .07, .14), loc=(0, -.19, -.42), bevel=.03, seg=1)
        a.part('Shin_stripe', 'Team', leg).box((.19, .02, .05), loc=(0, -.17, -.55), bevel=0)
        a.part('Shin_bolts', 'Steel', leg).bolts([(x, -.17, -.68) for x in (-.07, .07)], r=.018, h=.02, rot=FORWARD)
        a.part('Boot_cap', 'Steel', leg).box((.21, .05, .05), loc=(0, -.29, -.86), bevel=.01, seg=1)
        a.part('Boot_strap', 'Undercarriage', leg).box((.28, .2, .03), loc=(0, -.05, -.74), bevel=0)
    # Pack: vents, rivets, thruster rings and nozzle vanes, a hazard stencil on the hinge housing.
    gear.grille(.3, .26, loc=(0, .395, 1.42), rot=(0, 0, math.pi), slats=4, depth=.03, thickness=.025)
    steel.bolts([(x, .4, z) for x in (-.17, .17) for z in (1.16, 1.3, 1.62)], r=.02, h=.02, rot=FORWARD)
    for s in (-1, 1):
        for z in (1.0, 1.2, 1.36):
            steel.torus(.093, .012, loc=(s * .13, .42, z), seg=12, ring=3)
        for k in range(4):
            ang = k * R90 + math.pi / 4
            box(a, 'Thruster_fin', 'Hazard', (.012, .07, .05), (s * .13 + math.cos(ang) * .05, .42 + math.sin(ang) * .05, .84),
                rot=(0, 0, ang), bevel=0)
    for x in (-.2, .2):
        box(a, 'Thruster_fin', 'Hazard', (.08, .02, .04), (x, .52, 1.66), bevel=0)
    # Wings (on their hinges): ribs across the back face, rivets along the spar, a trailing-edge flap line.
    for s, side in SIDES:
        p = f'skywing_wing_{side}'
        tip = s * 1.32
        for k in range(1, 6):
            t = k / 6
            x, z0, z1 = tip * t, .12 + (-.26 - .12) * t, -.44 + (-.44 + .44) * t
            a.part('Wing_ribs', 'Steel', p).limb((x, .03, z0 - .03), (x, .03, z1 + .03), .025, .014, bevel=0, seg=1)
        a.part('Wing_bolts', 'Steel', p).bolts([(tip * t, -.035, .1 + (-.255 - .1) * t) for t in (.2, .4, .6, .8)], r=.016, h=.02,
                                               rot=FORWARD)
        a.part('Wing_flap', 'Undercarriage', p).limb((s * .55, .03, -.47), (tip * .97, .03, -.41), .03, .015, bevel=0, seg=1)
        box(a, 'Wing_tip', 'TeamGlow', (.04, .04, .04), (tip * .5, .045, -.2), bevel=0, parent=p)
    # Arms: elbow pads and a wrist unit with a light.
    p = 'skywing_arms'
    right_elbow, right_wrist, left_elbow, left_wrist = GRIP
    for elbow in (right_elbow, left_elbow):
        a.part('Arm_armor', 'Armor', p).box((.15, .1, .1), loc=rel((elbow[0], elbow[1] + .05, elbow[2] - .02), SHOULDER), bevel=.02, seg=1)
    a.part('Glove', 'Undercarriage', p).box((.1, .12, .06), loc=rel((left_wrist[0] - .02, left_wrist[1] + .1, left_wrist[2] + .07), SHOULDER), bevel=.01, seg=1)
    # Sniper: scope rings and caps, a rail with bolts, a folded bipod, a sling.
    p = 'skywing_sniper'
    r = lambda q: rel(q, SHOULDER)  # noqa: E731
    for y in (-.32, -.6):
        a.part('Rifle_steel', 'Steel', p).torus(.066, .012, loc=r((.12, y, 1.58)), rot=FORWARD, seg=10, ring=3)
    a.part('Rifle_dark', 'Undercarriage', p).cyl(.064, .03, loc=r((.12, -.72, 1.58)), rot=FORWARD, seg=10, bevel=0)
    a.part('Rifle_steel', 'Steel', p).box((.04, .5, .03), loc=r((.12, -.55, 1.49)), bevel=0)
    a.part('Rifle_steel', 'Steel', p).bolts([r((.12, y, 1.51)) for y in (-.4, -.55, -.7)], r=.014, h=.015)
    for k in (-1, 1):
        a.part('Rifle_steel', 'Steel', p).limb(r((.12 + k * .03, -1.08, 1.36)), r((.12 + k * .05, -.78, 1.32)), .02, .02, bevel=0, seg=1)
    for y in (-1.86, -1.94):
        a.part('Rifle', 'Armor', p).box((.15, .02, .05), loc=r((.12, y, 1.41)), bevel=0)
    a.part('Rifle_dark', 'Undercarriage', p).box((.025, .9, .025), loc=r((.24, -.35, 1.29)), rot=(.25, 0, 0), bevel=0)
    # Rocket launcher: steel rings, a grip guard, a rear vent and three fins on the warhead.
    p = 'skywing_rocket'
    for y in (-.3, -.9):
        a.part('Launcher_steel', 'Steel', p).torus(.145, .015, loc=r((.12, y, 1.45)), rot=FORWARD, seg=14, ring=3)
    a.part('Launcher_dark', 'Undercarriage', p).grille(.2, .12, loc=r((.12, .1, 1.45)), rot=(0, 0, math.pi), slats=3, depth=.03, thickness=.02)
    a.part('Launcher_dark', 'Undercarriage', p).box((.12, .2, .03), loc=r((.12, -.5, 1.32)), bevel=0)
    for k in range(3):
        ang = k * math.tau / 3
        a.part('Launcher_band', 'Hazard', p).box((.012, .1, .08), loc=r((.12 + math.cos(ang) * .1, -1.36, 1.45 + math.sin(ang) * .1)),
                                                  rot=(0, -ang, 0), bevel=0)


DETAIL_BUDGET = 15000


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def new_asset(root, name='skywing'):
    """The Asset the normal and the close-up build share (same AO settings, so the two match)."""
    return Asset(name, root, ao_distance=.6, grime_height=.45, ao_samples=40, ground=False)


def build(export=True, manifest=False):
    root = kit.workspace('FrontierSkywing')
    kit.clear_workspace(root)
    a = new_asset(root)
    skywing(a)
    tris = count(a)
    if tris > BUDGET:
        parts = {f'{k[0]}/{k[1]}': sum(len(f.verts) - 2 for f in s.bm.faces) for k, s in a.shapes.items()}
        print('SKYWING_PARTS', json.dumps(dict(sorted(parts.items(), key=lambda kv: -kv[1]))), flush=True)
        raise RuntimeError(f'skywing: {tris} triangles > {BUDGET}')
    a.finish()
    path = OUT / 'skywing.glb'
    if export:
        a.export(path)
    row = {'name': 'skywing', 'file': 'skywing.glb', 'triangles': a.triangles(), 'hero': True, 'budget': BUDGET,
           'animation': 'Runtime shader bones: leg_* walk, skywing_wing_* fold, skywing_arms raise; weapons on skywing_sniper / skywing_rocket',
           'review': 'pending owner review (Skywing model 2026-11-28)'}
    if export and manifest:
        mpath = OUT / 'manifest.json'
        data = json.loads(mpath.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'skywing'] + [row]
        with open(mpath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(data, indent=2) + '\n')
    print('SKYWING_ROW ' + json.dumps(row), flush=True)
    return a, row


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args)
