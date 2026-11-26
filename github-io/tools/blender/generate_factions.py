"""Faction-unique models. Headless Blender 4.5; no external assets.

  blender -b --factory-startup --python tools/blender/generate_factions.py -- [names...] [--report] [--blend]
  (generate_assets.py --factions runs the same build)

Writes public/models/<name>.glb for the twelve faction-unique models and their manifest.json entries
(review 'pending owner review (visual round V)'). --report prints the triangles of every part; --blend also
saves assets/source/frontier-factions.blend (a tracked file: only when the source library should change).

Visual round V (2026-11-26) rebuilt every model to the shared kit's finish, each in its faction's language:
  Ashfall  welded scrap plates and rivets, hazard stripes, exhaust stacks, spikes and ram blades, a hook on a
           chain, gas masks, tracks; boxy, heavy, leaning forward. Scrapper, Scorcher, Salvage yard.
  Sunward  cream canvas, brass domes and trims, banners and pennants, spoked wheels, a solar fan, wide-brim
           hats and scarves; tall and airy. Rider, Supply wagon, Waystation.
  Wardens  smooth white ceramic shells, single big lens eyes, floating rings, segmented legs with claw feet,
           glow seams; symmetrical and calm. Sentinel drone, Walker, Pylon.
  Veil     hoods and long cloaks, angular crystal shards, seer lenses, thin spires and folded fins, charcoal
           with silver piping; low and narrow. Shade, Watcher, Veil relay.
The faction paint (a.armor: ArmorAshfall rust, ArmorSunward canvas, ArmorWardens ceramic, ArmorVeil mauve)
and the shapes carry the faction whatever team colour the player picks; Team* parts carry the team colour.

Runtime contract (src/view.js prepareModels, src/unit-rig.js): leg_L / leg_R pivots at the hips with a Knee*
mesh at the bend (shader-bone infantry: Scrapper, Shade, Watcher, Rider, Walker); Tyres* / Spokes* roll the
Rider's wheels; Wheels* roll and Tracks* stay put on the hulls (Scorcher, Wagon); Turret_pivot + Turret_head*
turn and Barrel* / Muzzle* aim and recoil (Scorcher, Walker; the Watcher's rail rifle, the Rider's carbines,
the Drone's emitters); `hover` makes the Drone bob. Never name a body part Barrel*, Muzzle*, Cannon* or
Turret_head* (it would join the gun rig) or leg_* (a pivot).

Cost (phones first): each model keeps the same or fewer runtime batches (meshes per rigid group and finish
after the view merges them) as round 3, no more materials than tests/assets.test.js allows, and triangles
within +25 % of round 3 (ROUND3 below; checked here and in tests/visual-round-v.test.js). Parts no rig or test
looks up merge per material and pivot before export (consolidate: a smaller GLB, the same drawing), and every
part is rebuilt in a fixed element order (faction_parts.FactionAsset), so a build writes byte-identical files.
"""
import json
import math
import re
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit  # noqa: E402
from frontier_kit import chamfered  # noqa: E402
import faction_parts as fp  # noqa: E402
from faction_parts import (ACROSS, FORWARD, R, Body, box, crystal, cyl, frame, at, lens_eye, limb, pennant, prism,  # noqa: E402
                           rivets, sphere, spike, stack, stripes, torus, track, wheel)

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
REVIEW = 'pending owner review (visual round V)'
FACTION_ARMOR = {'ashfall': 'ArmorAshfall', 'sunward': 'ArmorSunward', 'wardens': 'ArmorWardens', 'veil': 'ArmorVeil'}
# name: (faction, kind, manifest budget, minimum triangles)
CATALOG = {
    'scrapper': ('ashfall', 'unit', 3200, 2800), 'scorcher': ('ashfall', 'unit', 4500, 0), 'salvageyard': ('ashfall', 'building', 4000, 0),
    'rider': ('sunward', 'unit', 4500, 0), 'wagon': ('sunward', 'unit', 4500, 0), 'waystation': ('sunward', 'building', 4000, 0),
    'drone': ('wardens', 'unit', 4500, 0), 'walker': ('wardens', 'unit', 6300, 0), 'pylon': ('wardens', 'building', 4000, 0),
    'shade': ('veil', 'unit', 3200, 2800), 'watcher': ('veil', 'unit', 3200, 2800), 'veilrelay': ('veil', 'building', 4000, 0),
}
# Round 3 (main 9fbb7c6): triangles of each model before visual round V. A rebuild stays within +25 %.
ROUND3 = {'scrapper': 2852, 'scorcher': 2336, 'salvageyard': 2140, 'rider': 2496, 'wagon': 2224, 'waystation': 2148,
          'drone': 3536, 'walker': 3268, 'pylon': 2976, 'shade': 2844, 'watcher': 2836, 'veilrelay': 2248}
INFANTRY = {'scrapper', 'shade', 'watcher', 'rider'}


def cap(name):
    return min(CATALOG[name][2], int(ROUND3[name] * 1.25))


# ============================================================================ Ashfall
def ashfall_leg(a, side, x, hip=.92, extra=None):
    A = a.armor
    p = fp.leg(a, side, (x, .04, hip), hip, ('Suit', A, 'Undercarriage'), wide=1.08, toe='Steel', boot_len=.5)
    if extra:
        extra(p)
    return p


def scrapper(a):
    """Ashfall Scrapper (Vanguard slot): a hunched scrap brawler in a gas mask, a huge salvaged pauldron with
    spikes, a boiler pack with twin exhaust stacks, a drum-fed scattergun and a cargo hook on a chain."""
    A = a.armor
    ashfall_leg(a, 'L', -.23, extra=lambda p: box(a, 'Knee_plate', 'Hazard', (.25, .09, .22), (0, -.2, -.47), rot=(-.12, 0, .14), bevel=.02, parent=p))
    ashfall_leg(a, 'R', .23, extra=lambda p: box(a, 'Shin_plate', 'Steel', (.22, .07, .2), (0, -.2, -.7), rot=(-.1, 0, -.1), bevel=.015, parent=p))
    # Hips: a heavy belt with a hazard buckle, a pouch, and a cargo hook on a short chain at the left hip.
    box(a, 'Pelvis', 'Suit', (.5, .34, .24), (0, .03, 1.0), bevel=.06)
    box(a, 'Belt', 'Undercarriage', (.6, .4, .09), (0, .03, 1.1), bevel=.025)
    box(a, 'Buckle', 'Hazard', (.16, .05, .11), (0, -.18, 1.1), bevel=.015)
    box(a, 'Pouch', A, (.16, .15, .18), (.33, -.06, 1.0), bevel=.03)
    for k in range(3):
        torus(a, 'Chain', 'Steel', .05, .016, (-.36, -.02, 1.0 - k * .085), rot=(0, R if k % 2 else 0, 0), seg=8, ring=3)
    limb(a, 'Hook', 'Steel', (-.36, -.02, .76), (-.36, -.02, .56), .055, bevel=0)
    limb(a, 'Hook', 'Steel', (-.36, -.02, .56), (-.36, -.17, .5), .055, bevel=0)
    limb(a, 'Hook', 'Steel', (-.36, -.17, .5), (-.36, -.2, .62), .05, bevel=0)
    # Upper body, leaning forward over the gun.
    T = Body((0, .03, 1.1), .24)
    box(a, 'Abdomen', 'Suit', (.46, .32, .26), T.p((0, 0, .13)), T.rot(), bevel=.07)
    box(a, 'Chest', 'Team', (.74, .5, .5), T.p((0, .03, .44)), T.rot(), bevel=.1, seg=2, taper=(1.08, 1.0))
    # Mismatched welded plates: a riveted rust plate on the left breast, a hazard patch low on the right.
    box(a, 'Chest_plate', A, (.32, .06, .3), T.p((-.15, -.24, .5)), T.rot((0, 0, .08)), bevel=.015)
    rivets(a, 'Rivets', 'Steel', [T.p((x, -.28, z)) for x, z in ((-.28, .62), (-.03, .64), (-.28, .38), (-.03, .4))], r=.026, h=.03, rot=T.rot(FORWARD))
    box(a, 'Hazard_patch', 'Hazard', (.26, .05, .18), T.p((.17, -.25, .3)), T.rot((0, 0, -.16)), bevel=.01)
    stripes(a, 'Hazard_bars', (.26, .05, .18), T.p((.17, -.25, .3)), T.rot((0, 0, -.16)), n=3, slant=.6)
    limb(a, 'Bandolier', 'Undercarriage', T.p((-.3, -.24, .66)), T.p((.3, -.24, .18)), .07, .03, bevel=0)
    # Left: a huge salvaged pauldron (team) over a rust rim, three spikes; right: a smaller rust plate.
    box(a, 'Pauldron', 'Team', (.5, .6, .34), T.p((-.5, .02, .68)), T.rot((0, -.38, 0)), bevel=.1, seg=2)
    box(a, 'Pauldron_rim', A, (.5, .6, .12), T.p((-.54, .02, .52)), T.rot((0, -.38, 0)), bevel=.03)
    stripes(a, 'Pauldron_bars', (.5, .6, .12), T.p((-.54, .02, .52)), T.rot((0, -.38, 0)), n=3, slant=.7)
    for dy in (-.18, .02, .22):
        spike(a, 'Spikes', 'Steel', T.p((-.58, dy, .8)), T.p((-.86, dy + .02, 1.1)), r=.065)
    box(a, 'Shoulder_plate', A, (.38, .46, .2), T.p((.48, .01, .62)), T.rot((0, .32, 0)), bevel=.04)
    box(a, 'Shoulder_edge', 'Hazard', (.4, .06, .07), T.p((.5, -.22, .6)), T.rot((0, .32, 0)), bevel=.01)
    box(a, 'Collar', 'Undercarriage', (.42, .36, .1), T.p((0, .01, .74)), T.rot(), bevel=.03)
    # Boiler pack on the back, banded in hazard dark; two exhaust stacks rise past the head.
    cyl(a, 'Boiler', 'Hazard', .2, .58, T.p((0, .37, .44)), T.rot(), seg=12, bevel=.03)
    for dz in (.26, .62):
        cyl(a, 'Boiler_bands', 'Undercarriage', .207, .06, T.p((0, .37, dz)), T.rot(), seg=12, bevel=0)
    for x in (-.13, .13):
        b = T.p((x, .44, .7))
        stack(a, 'Exhaust', 'Undercarriage', 'Steel', b[0], b[1] + .05, b[2] - .1, 2.26 - b[2] + .1, r=.065, seg=8)
    # Gas-mask helmet: a rust dome under a jagged team crest, a dark mask, lit amber goggles and a filter snout.
    box(a, 'Helmet', A, (.44, .46, .36), T.p((0, -.04, 1.0)), T.rot((-.12, 0, 0)), bevel=.13, seg=2, taper=(.88, .9))
    prism(a, 'Helmet_crest', 'Team', [(-.22, 0), (-.13, .15), (-.07, .05), (.01, .18), (.07, .06), (.16, .16), (.23, 0)], .07,
          loc=T.p((0, -.02, 1.15)), rot=T.rot((-.12, 0, 0)), axis='X', bevel=0)
    box(a, 'Mask', 'Undercarriage', (.38, .17, .28), T.p((0, -.26, .9)), T.rot((.1, 0, 0)), bevel=.07)
    for x in (-.1, .1):
        cyl(a, 'Goggles', 'Alloy', .078, .05, T.p((x, -.36, .96)), T.rot(FORWARD), seg=10, bevel=0)
        torus(a, 'Goggle_rims', 'Steel', .088, .024, T.p((x, -.375, .96)), T.rot(FORWARD), seg=10, ring=3)
    cyl(a, 'Filter', 'Steel', .08, .2, T.p((0, -.43, .77)), T.rot((R + .55, 0, 0)), seg=10, bevel=.012)
    cyl(a, 'Filter_band', 'Hazard', .087, .05, T.p((0, -.47, .73)), T.rot((R + .55, 0, 0)), seg=10, bevel=0)
    # Arms to the scattergun: suit sleeves, welded steel gauntlets; right hand on the grip, left under the barrel.
    for s, elbow, wrist in ((1, (.5, -.16, 1.34), (.3, -.44, 1.22)), (-1, (-.36, -.42, 1.36), (.14, -.78, 1.27))):
        shoulder = T.p((s * .44, .02, .6))
        limb(a, 'Arms', 'Suit', shoulder, elbow, .17, .19, bevel=.04)
        limb(a, 'Gauntlets', 'Steel', elbow, wrist, .21, .22, bevel=.04, taper=(.85, .85))
        box(a, 'Elbow_pads', 'Undercarriage', (.16, .16, .14), elbow, bevel=.035)
        box(a, 'Gloves', 'Undercarriage', (.15, .16, .14), wrist, bevel=.035)
    # Drum-fed scattergun: a dark receiver, a hazard drum, a stubby barrel with a heat shield and a flared muzzle.
    box(a, 'Scattergun', 'Undercarriage', (.17, .58, .2), (.27, -.62, 1.24), rot=(-.05, 0, 0), bevel=.03)
    box(a, 'Scattergun_stock', A, (.14, .3, .17), (.29, -.24, 1.2), rot=(.1, 0, 0), bevel=.03)
    cyl(a, 'Drum', 'Hazard', .14, .13, (.27, -.56, 1.06), rot=ACROSS, seg=12, bevel=.015)
    cyl(a, 'Scatter_barrel', 'Steel', .075, .44, (.27, -.98, 1.28), rot=FORWARD, seg=10, bevel=0)
    cyl(a, 'Scatter_flare', 'Steel', .09, .12, (.27, -1.24, 1.28), rot=FORWARD, seg=10, r2=.13, bevel=0)
    box(a, 'Heat_shield', A, (.13, .34, .03), (.27, -.96, 1.37), bevel=0)


def ram_blade(a, y, z, width=2.2, height=.5):
    """A V-shaped ram plough: two hazard-striped plates meeting at the front, with forward spikes."""
    A = a.armor
    for s in (-1, 1):
        cx = s * width / 4
        rot = (0, 0, s * .32)
        box(a, 'Ram_blade', 'Hazard', (width / 2 + .06, .1, height), (cx, y + abs(cx) * .32, z), rot=rot, bevel=.025)
        stripes(a, 'Ram_stripes', (width / 2 + .06, .1, height * .7), (cx, y + abs(cx) * .32, z), rot=rot, n=4, slant=.55)
        box(a, 'Ram_edge', A, (width / 2 + .06, .14, .08), (cx, y + abs(cx) * .32 + .01, z - height / 2 - .02), rot=rot, bevel=.02)
    for x in (-.75, -.25, .25, .75):
        yy = y + abs(x) * .32 - .06
        spike(a, 'Ram_spikes', 'Steel', (x, yy, z + .05), (x, yy - .42, z + .03), r=.07)


def scorcher(a):
    """Ashfall Scorcher (Breaker slot): a tracked flame tank on scrap armour, a spiked ram plough, a striped fuel
    tank with two tall stacks, and a team-painted welded turret with a caged flame nozzle."""
    A = a.armor
    for x in (-.86, .86):
        track(a, x, .05, .33, 2.6, .62, .42, wheels=3)
    # Hull: team paint, a sloped glacis, welded rust deck plates; fender decks over the tracks.
    prism(a, 'Hull', 'Team', [(-1.18, .42), (-1.18, .66), (-.74, .98), (1.08, .98), (1.24, .8), (1.24, .42)], 1.3, bevel=.05)
    box(a, 'Deck_plates', A, (.62, .7, .05), (-.32, .55, 1.0), rot=(0, 0, .06), bevel=.015)
    box(a, 'Deck_plates', A, (.5, .4, .05), (.3, -.95, .84), rot=(.63, 0, -.05), bevel=.015)
    rivets(a, 'Rivets', 'Steel', [(-.56, .3, 1.03), (-.08, .28, 1.03), (-.56, .82, 1.03), (-.08, .8, 1.03)], r=.035, h=.04, rot=(0, 0, 0), seg=4)
    a.part('Engine_grille', 'Undercarriage').grille(.7, .3, loc=(.0, 1.25, .7), rot=(0, 0, math.pi), slats=3, depth=.05, thickness=.04)
    for s in (-1, 1):
        box(a, 'Fenders', 'Undercarriage', (.5, 2.5, .06), (s * .87, .05, .69), bevel=.015)
        box(a, 'Fender_edges', 'Hazard', (.06, 2.46, .08), (s * 1.1, .05, .7), bevel=0)
    # Mismatched side skirts hung below the fenders (rust, hazard, team), riveted.
    mats = (A, 'Hazard', 'Team')
    for s in (-1, 1):
        for i in range(3):
            y = -.8 + i * .8
            box(a, 'Side_skirts', mats[(i + (s > 0)) % 3], (.07, .78, .3), (s * 1.12, y, .5), rot=(0, s * .08, .04 * (i - 1)), bevel=.02)
        rivets(a, 'Rivets', 'Steel', [(s * 1.165, y, .58) for y in (-1.0, -.6, .0, .6, 1.0)], r=.03, h=.04, rot=ACROSS, seg=4)
    ram_blade(a, -1.42, .56)
    for s in (-1, 1):
        limb(a, 'Ram_struts', 'Steel', (s * .55, -1.1, .55), (s * .62, -1.36, .56), .09, bevel=0)
    # Fuel tank across the back deck, hazard yellow with dark bands and steel straps; two tall stacks.
    cyl(a, 'Fuel_tank', 'Hazard', .32, 1.16, (0, .66, 1.3), rot=ACROSS, seg=12, bevel=.04)
    for x in (-.36, .36):
        cyl(a, 'Fuel_bands', 'Undercarriage', .33, .09, (x, .66, 1.3), rot=ACROSS, seg=12, bevel=0)
    for x in (-.15, .15):
        box(a, 'Tank_straps', 'Steel', (.06, .2, .7), (x, .66, 1.05), bevel=0)
    for s in (-1, 1):
        stack(a, 'Stacks', 'Undercarriage', 'Steel', s * .56, 1.04, .98, 1.36, r=.1, seg=10)
    # Turret (Turret_pivot + Turret_head*, all team paint) and the flame gun (Barrel* / Muzzle* aim and recoil).
    a.pivot('Turret_pivot', (0, -.28, 1.0))
    prism(a, 'Turret_head', 'Team', [(-.4, .4), (.4, .4), (.46, .0), (.34, -.38), (-.34, -.38), (-.46, .0)], .42, loc=(0, -.28, 1.2), axis='Z', bevel=.05, taper=.86)
    box(a, 'Turret_head_plates', 'Team', (.08, .5, .3), (.45, -.3, 1.2), rot=(0, .12, 0), bevel=.02)
    box(a, 'Turret_head_plates', 'Team', (.08, .44, .26), (-.45, -.24, 1.18), rot=(0, -.12, 0), bevel=.02)
    cyl(a, 'Turret_head_hatch', 'Team', .17, .08, (.12, -.16, 1.44), seg=10, bevel=.02)
    box(a, 'Turret_head_mantlet', 'Team', (.38, .14, .3), (0, -.66, 1.22), bevel=.04)
    cyl(a, 'Barrel_flame', 'Steel', .1, 1.06, (0, -1.18, 1.26), rot=FORWARD, seg=10, bevel=.01)
    for y in (-.9, -1.46):
        cyl(a, 'Barrel_cage', A, .145, .07, (0, y, 1.26), rot=FORWARD, seg=10, bevel=0)
    cyl(a, 'Muzzle_nozzle', 'Hazard', .12, .16, (0, -1.78, 1.26), rot=FORWARD, seg=10, r2=.16, bevel=0)
    cyl(a, 'Muzzle_bore', 'Undercarriage', .11, .02, (0, -1.865, 1.26), rot=FORWARD, seg=10, bevel=0)
    cyl(a, 'Muzzle_igniter', 'Steel', .035, .2, (0, -1.7, 1.13), rot=FORWARD, seg=6, bevel=0)


def salvageyard(a):
    """Ashfall Salvage yard: a welded scrap shed with a sawtooth team roof and stacks, a hazard crane gantry
    with an operator cab and a hook on a chain over a pile of crushed scrap."""
    A = a.armor
    base(a, 4.6, 4.1)
    # The shed (back left): rust walls, a team sawtooth roof, a rolling door and a lit furnace mouth.
    box(a, 'Shed', A, (2.3, 2.0, 1.55), (-.95, .82, 1.0), bevel=.06)
    for i in range(3):
        y0 = -.18 + i * .68
        prism(a, 'Shed_roof', 'Team', [(y0, 0), (y0 + .68, 0), (y0 + .68, .08), (y0, .5)], 2.42, loc=(-.95, 0, 1.77), axis='X', bevel=.02)
    box(a, 'Shed_door', 'Undercarriage', (1.1, .08, 1.05), (-1.15, -.2, .78), bevel=.015)
    for i in range(5):
        box(a, 'Door_slats', 'Steel', (1.04, .03, .03), (-1.15, -.25, .38 + i * .2), bevel=0)
    box(a, 'Furnace_mouth', 'Window', (.5, .05, .36), (-.15, -.2, .7), bevel=.01)
    box(a, 'Cab_windows', 'Window', (.05, .9, .26), (-2.11, .7, 1.25), bevel=.01)
    for p, size, mat, rot in (((-.35, -.21, 1.32), (.42, .05, .34), 'Team', .08), ((-1.82, -.21, 1.4), (.36, .05, .3), 'Hazard', -.1),
                              ((-.12, .4, 1.4), (.05, .5, .4), 'Team', 0)):
        box(a, 'Patch_plates', mat, size, p, rot=(0, 0, rot), bevel=.01)
    stripes(a, 'Hazard_bars', (.36, .05, .3), (-1.82, -.21, 1.4), rot=(0, 0, -.1), n=3, slant=.6)
    rivets(a, 'Rivets', 'Steel', [(-1.95, -.22, .55), (-.4, -.22, .55), (-1.95, -.22, 1.55), (-.3, -.22, 1.58)], r=.04, h=.04)
    for x, h in ((-1.7, 2.5), (-1.25, 2.0)):
        stack(a, 'Stacks', 'Undercarriage', 'Steel', x, 1.45, 1.6, h, r=.15, seg=10)
    # Crane gantry (front right): hazard posts and beam, spiked caps, a jib with a hook on a chain.
    for x in (.55, 2.0):
        box(a, 'Gantry_posts', 'Hazard', (.2, .2, 3.3), (x, .55, 1.82), bevel=.03)
        stripes(a, 'Gantry_bars', (.2, .2, .5), (x, .55, .45), n=2, slant=.7)
        spike(a, 'Gantry_spikes', 'Steel', (x, .55, 3.48), (x, .55, 3.9), r=.08)
    box(a, 'Gantry_beam', 'Hazard', (1.75, .26, .26), (1.27, .55, 3.42), bevel=.03)
    limb(a, 'Crane_jib', 'Steel', (1.27, .55, 3.32), (1.27, -1.2, 3.62), .14, bevel=.02)
    limb(a, 'Crane_cable', 'Undercarriage', (1.27, -1.2, 3.55), (1.27, -1.2, 2.4), .035, bevel=0)
    for k in range(3):
        torus(a, 'Chain', 'Steel', .07, .02, (1.27, -1.2, 2.33 - k * .12), rot=(0, R if k % 2 else 0, 0), seg=8, ring=3)
    limb(a, 'Hook', 'Steel', (1.27, -1.2, 1.98), (1.27, -1.2, 1.74), .08, bevel=0)
    limb(a, 'Hook', 'Steel', (1.27, -1.2, 1.74), (1.27, -1.44, 1.66), .08, bevel=0)
    limb(a, 'Hook', 'Steel', (1.27, -1.44, 1.66), (1.27, -1.48, 1.84), .07, bevel=0)
    # Operator cab on the right post, its lit windows toward the yard.
    box(a, 'Operator_cab', A, (.7, .7, .6), (1.86, .1, 2.55), bevel=.05)
    box(a, 'Cab_roof', 'Team', (.8, .8, .08), (1.86, .1, 2.89), bevel=.02)
    box(a, 'Cab_windows', 'Window', (.54, .05, .28), (1.86, -.26, 2.6), bevel=.01)
    # Crushed scrap blocks stacked under the hook (rust, team, hazard, steel).
    for (x, y, z, r, mat) in ((.75, -1.1, .5, .12, A), (1.65, -1.25, .5, -.18, 'Team'), (1.2, -1.15, 1.04, .35, 'Hazard'), (.7, -.45, .5, -.3, 'Steel'),
                              (1.7, -.45, .5, .2, A)):
        box(a, 'Scrap_blocks', mat, (.66, .58, .56), (x, y, z), rot=(0, .04 * (1 if r > 0 else -1), r), bevel=.04)
    # Front left: a stack of old tyres, oil drums and a hazard-striped loading strip painted on the deck.
    for k in range(3):
        torus(a, 'Tyre_stack', 'Undercarriage', .3, .11, (-1.75, -1.3, .3 + k * .21), rot=(0, 0, k * .4), seg=12, ring=5)
    for x, y, mat in ((-1.0, -1.55, 'Hazard'), (-.62, -1.25, A), (-1.05, -1.0, 'Team')):
        cyl(a, 'Oil_drums', mat, .2, .5, (x, y, .43), seg=10, bevel=.02)
        cyl(a, 'Drum_bands', 'Undercarriage', .205, .05, (x, y, .5), seg=10, bevel=0)
    box(a, 'Loading_strip', 'Hazard', (1.9, .3, .02), (-1.2, -1.86, .19), bevel=0)
    stripes(a, 'Loading_bars', (1.9, .02, .3), (-1.2, -1.86, .19), rot=(-R, 0, 0), n=6, slant=.6)


# ============================================================================ Sunward
def sunward_hat(a, T, y, z, brim=.38):
    A = a.armor
    cyl(a, 'Hat_brim', A, brim, .045, T.p((0, y, z)), T.rot((-.08, 0, 0)), seg=16, bevel=0)
    cyl(a, 'Hat_crown', A, .19, .2, T.p((0, y + .01, z + .11)), T.rot((-.08, 0, 0)), seg=12, r2=.16, bevel=0)
    cyl(a, 'Hat_band', 'Team', .195, .06, T.p((0, y + .01, z + .05)), T.rot((-.08, 0, 0)), seg=12, bevel=0)


def rider(a):
    """Sunward Rider (Ranger slot): an outrider on a tall-wheeled sand bike: brass tank, canvas fairing and
    panniers, a taupe duster, a wide-brim hat and a streaming team scarf, brass goggles and spokes, a solar fan
    sail and a pennant whip, twin carbines on the bars."""
    A = a.armor
    for y in (-.92, .88):
        wheel(a, 0, y, .52, .52, .16, mats=('Undercarriage', 'Hazard', 'Hazard'), names=('Tyres', 'Spokes', 'Spokes_hub'), spokes=6, seg=14, tyre_ring=5, rim_seg=10)
    # Frame: a team backbone from the rear axle to the steering head, a steel fork, a canvas fairing.
    limb(a, 'Bike_frame', 'Team', (0, .86, .56), (0, .3, 1.0), .12, bevel=.02)
    limb(a, 'Bike_frame', 'Team', (0, .3, 1.0), (0, -.6, 1.16), .14, bevel=.02)
    limb(a, 'Bike_frame', 'Team', (0, .2, .62), (0, -.5, .98), .1, bevel=.02)
    for s in (-1, 1):
        limb(a, 'Front_fork', 'Undercarriage', (s * .11, -.62, 1.18), (s * .11, -.92, .52), .055, bevel=0)
    arch = [(-.92 + (.62) * math.cos(t), .52 + .62 * math.sin(t)) for t in [math.radians(d) for d in (160, 125, 90, 55, 20)]]
    arch += [(-.92 + .55 * math.cos(t), .52 + .55 * math.sin(t)) for t in [math.radians(d) for d in (20, 55, 90, 125, 160)]]
    prism(a, 'Fairing', A, arch, .3, axis='X', bevel=.015)
    box(a, 'Fairing_cowl', A, (.42, .36, .34), (0, -.74, 1.16), rot=(-.45, 0, 0), bevel=.07)
    cyl(a, 'Headlamp', 'Hazard', .1, .06, (0, -.93, 1.18), rot=FORWARD, seg=10, bevel=0)
    box(a, 'Fuel_tank', 'Hazard', (.32, .52, .24), (0, -.26, 1.14), rot=(.12, 0, 0), bevel=.1)
    box(a, 'Seat', 'Undercarriage', (.3, .5, .12), (0, .3, 1.07), bevel=.04)
    for s in (-1, 1):
        box(a, 'Panniers', A, (.2, .46, .34), (s * .29, .76, .86), bevel=.06)
        box(a, 'Pannier_flaps', 'Team', (.22, .32, .07), (s * .3, .74, 1.05), bevel=0)
    # The solar fan: a canvas half disc behind the rider with team rays, on a brass hub; a pennant whip.
    fan = [(math.cos(t) * .64, 1.22 + math.sin(t) * .64) for t in [math.radians(d) for d in range(0, 181, 20)]]
    prism(a, 'Sail', 'Team', fan, .04, loc=(0, 1.0, 0), axis='Y', bevel=.01)
    for k in range(5):
        ang = math.radians(18 + k * 36)
        limb(a, 'Sail_rays', A, (math.cos(ang) * .12, .975, 1.22 + math.sin(ang) * .12), (math.cos(ang) * .6, .975, 1.22 + math.sin(ang) * .6), .05, .02, bevel=0)
    cyl(a, 'Sail_hub', 'Hazard', .11, .1, (0, .97, 1.22), rot=FORWARD, seg=8, bevel=0)
    limb(a, 'Sail_post', 'Undercarriage', (0, .95, .86), (0, .97, 1.18), .06, bevel=0)
    limb(a, 'Whip', 'Hazard', (.24, .98, .9), (.3, 1.1, 2.7), .035, bevel=0)
    pennant(a, 'Pennant', 'Team', .3, 1.1, 2.68, length=.55, height=.3)
    # Legs on the pegs (leg_L / leg_R: the ride gait holds them still; Knee* marks the bend).
    for s, side in ((-1, 'L'), (1, 'R')):
        p = a.pivot('leg_' + side, (s * .19, .3, 1.15))
        limb(a, 'Thigh', A, (0, 0, 0), (s * .07, -.42, -.2), .2, .22, bevel=.04, parent=p)
        cyl(a, 'Knee', 'Undercarriage', .1, .2, (s * .07, -.42, -.2), rot=ACROSS, seg=8, bevel=0, parent=p)
        limb(a, 'Shin', A, (s * .07, -.42, -.2), (s * .07, -.34, -.62), .2, .22, bevel=.04, parent=p)
        box(a, 'Boot', 'Undercarriage', (.2, .36, .14), (s * .07, -.42, -.66), bevel=.04, parent=p)
    # Rider: a taupe duster leaning into the ride, canvas mantle, a brass belt, a team scarf, a wide-brim hat.
    T = Body((0, .28, 1.18), .4)
    box(a, 'Duster', 'Suit', (.52, .38, .56), T.p((0, 0, .3)), T.rot(), bevel=.1, seg=2, taper=(1.05, 1.0))
    prism(a, 'Coat_tails', 'Suit', [(-.26, .0), (.26, .0), (.3, -.36), (0, -.28), (-.3, -.36)], .06, loc=T.p((0, .2, .04)), rot=T.rot((.5, 0, 0)), axis='Y', bevel=0)
    box(a, 'Sash', 'Hazard', (.55, .4, .09), T.p((0, 0, .1)), T.rot(), bevel=.02)
    for s in (-1, 1):
        box(a, 'Shoulder_pads', 'Team', (.24, .34, .14), T.p((s * .3, .0, .55)), T.rot((0, s * .35, 0)), bevel=.05)
    H = Body(T.p((0, -.02, .62)), .12)
    sphere(a, 'Head', A, (.17, .18, .18), H.p((0, 0, .1)), H.rot(), seg=8, rings=6)
    torus(a, 'Scarf', 'Team', .16, .07, H.p((0, 0, -.02)), H.rot(), seg=10, ring=4)
    box(a, 'Scarf_mask', 'Team', (.3, .1, .14), H.p((0, -.15, .06)), H.rot(), bevel=.04)
    prism(a, 'Scarf_tail', 'Team', [(0, 0), (.55, .08), (.7, -.04), (.5, -.12), (.0, -.12)], .12, loc=H.p((0, .14, .0)), rot=(0, 0, R + .1), axis='Y', bevel=0)
    box(a, 'Goggles', 'Hazard', (.3, .05, .08), H.p((0, -.17, .16)), H.rot(), bevel=.015)
    sunward_hat(a, H, .0, .26)
    for s in (-1, 1):
        shoulder = T.p((s * .3, .0, .5))
        hand = (s * .33, -.62, 1.36)
        elbow = (s * .36, -.24, 1.42)
        limb(a, 'Rider_arms', 'Suit', shoulder, elbow, .16, .18, bevel=0)
        limb(a, 'Rider_forearms', 'Suit', elbow, hand, .15, .17, bevel=0, taper=(.9, .9))
        box(a, 'Gloves', 'Undercarriage', (.15, .16, .14), hand, bevel=0)
    limb(a, 'Handlebars', 'Undercarriage', (-.4, -.62, 1.34), (.4, -.62, 1.34), .06, bevel=0)
    # Twin carbines on the handlebars (Barrel_*: the aim and recoil rig; one dark finish, one batch).
    for s in (-1, 1):
        cyl(a, 'Barrel_twin', 'Undercarriage', .035, .62, (s * .17, -.92, 1.36), rot=FORWARD, seg=8, bevel=0)
        box(a, 'Barrel_twin_body', 'Undercarriage', (.08, .26, .1), (s * .17, -.66, 1.34), bevel=0)


def wagon(a):
    """Sunward Supply wagon (Medic slot): a covered caravan wagon the size of a Breaker: spoked wheels with brass
    hubs, a team bed with brass rails, a hooped canvas tilt with red crosses, a driver in a wide hat, water
    barrels and a pennant pole."""
    A = a.armor
    for y, r in ((-.86, .4), (.78, .5)):
        for x in (-.98, .98):
            wheel(a, x, y, r, r, .14, spokes=6, seg=12, tyre_ring=5, rim_seg=10)
    for y, r in ((-.86, .4), (.78, .5)):
        limb(a, 'Axles', 'Steel', (-.92, y, r), (.92, y, r), .08, bevel=0)
    box(a, 'Chassis', 'Undercarriage', (1.3, 2.6, .12), (0, -.05, .62), bevel=.02)
    box(a, 'Bed', 'Team', (1.56, 2.5, .38), (0, -.02, .86), bevel=.06, taper=(1.1, 1.02))
    for s in (-1, 1):
        limb(a, 'Brass_rails', 'Hazard', (s * .86, -1.26, 1.06), (s * .86, 1.24, 1.06), .06, bevel=0)
        box(a, 'Bed_trim', 'Hazard', (.04, 2.1, .08), (s * .815, -.02, .78), bevel=0)
    limb(a, 'Brass_rails', 'Hazard', (-.86, -1.26, 1.06), (.86, -1.26, 1.06), .06, bevel=0)
    # Canvas tilt over the rear two thirds: a cream arch, team hoops, the red cross on both sides and on top.
    arc = [(math.cos(t) * .84, 1.05 + math.sin(t) * .86) for t in [math.radians(d) for d in range(0, 181, 20)]]
    prism(a, 'Canvas_tilt', A, arc, 1.84, loc=(0, .32, 0), axis='Y', bevel=.02)
    hoop = [(math.cos(t) * .89, 1.05 + math.sin(t) * .91) for t in [math.radians(d) for d in range(0, 181, 20)]]
    hoop += [(math.cos(t) * .8, 1.05 + math.sin(t) * .82) for t in [math.radians(d) for d in range(180, -1, -20)]]
    for y in (-.55, .32, 1.2):
        prism(a, 'Canvas_hoops', 'Team', hoop, .09, loc=(0, y, 0), axis='Y', bevel=0)
    back = [(math.cos(t) * .5, 1.05 + math.sin(t) * .56) for t in [math.radians(d) for d in range(0, 181, 30)]]
    prism(a, 'Canvas_opening', 'Undercarriage', back, .04, loc=(0, 1.245, 0), axis='Y', bevel=0)
    for s in (-1, 1):
        for size in ((.06, .46, .14), (.06, .14, .46)):
            box(a, 'Red_cross', 'Cross', size, (s * .835, .32, 1.42), bevel=0)
    for size in ((.6, .18, .05), (.18, .6, .05)):
        box(a, 'Red_cross', 'Cross', size, (0, .32, 1.94), bevel=.012)
    # A solar fan standing on the back of the tilt: canvas half disc, team rays, brass hub.
    fan = [(math.cos(t) * .48, 1.78 + math.sin(t) * .48) for t in [math.radians(d) for d in range(0, 181, 20)]]
    prism(a, 'Solar_fan', A, fan, .04, loc=(0, 1.3, 0), axis='Y', bevel=.01)
    for k in range(5):
        ang = math.radians(18 + k * 36)
        limb(a, 'Fan_rays', 'Team', (math.cos(ang) * .1, 1.275, 1.78 + math.sin(ang) * .1), (math.cos(ang) * .45, 1.275, 1.78 + math.sin(ang) * .45), .045, .02, bevel=0)
    cyl(a, 'Fan_hub', 'Hazard', .09, .1, (0, 1.27, 1.78), rot=FORWARD, seg=8, bevel=0)
    # Driver's bench at the front, a driver in a canvas duster with a team scarf and a wide-brim hat.
    box(a, 'Bench', 'Undercarriage', (1.2, .36, .1), (0, -.92, 1.16), bevel=.02)
    box(a, 'Bench_back', 'Undercarriage', (1.2, .08, .3), (0, -.74, 1.32), rot=(-.15, 0, 0), bevel=.02)
    box(a, 'Footboard', 'Steel', (1.1, .3, .05), (0, -1.2, .9), rot=(.35, 0, 0), bevel=0)
    T = Body((-.3, -.92, 1.22), .1)
    box(a, 'Driver', A, (.36, .28, .4), T.p((0, 0, .2)), T.rot(), bevel=.07)
    torus(a, 'Driver_scarf', 'Team', .13, .055, T.p((0, 0, .43)), T.rot(), seg=10, ring=4)
    sphere(a, 'Driver_head', A, .14, T.p((0, -.01, .54)), T.rot(), seg=10, rings=6)
    box(a, 'Driver_goggles', 'Hazard', (.24, .05, .06), T.p((0, -.13, .57)), T.rot(), bevel=0)
    sunward_hat(a, T, -.01, .68, brim=.3)
    for s in (-1, 1):
        limb(a, 'Driver_arms', A, T.p((s * .2, 0, .32)), (-.3 + s * .16, -1.18, 1.32), .11, .12, bevel=.02)
    limb(a, 'Reins', 'Undercarriage', (-.46, -1.18, 1.3), (-.1, -1.18, 1.3), .04, bevel=0)
    # Drawbar and yoke in front.
    limb(a, 'Drawbar', 'Steel', (0, -1.2, .62), (0, -1.52, .5), .09, bevel=0)
    limb(a, 'Yoke', 'Steel', (-.36, -1.5, .52), (.36, -1.5, .52), .07, bevel=0)
    # Brass water barrels along both sides, a pennant pole at the back corner.
    for s in (-1, 1):
        cyl(a, 'Water_kegs', 'Hazard', .19, .46, (s * .94, .02, .86), rot=FORWARD, seg=10, bevel=.02)
        cyl(a, 'Keg_bands', 'Steel', .196, .04, (s * .94, .02, .86), rot=FORWARD, seg=10, bevel=0)
    limb(a, 'Pennant_pole', 'Steel', (.72, 1.22, 1.0), (.76, 1.3, 2.7), .045, bevel=0)
    pennant(a, 'Pennant', 'Team', .76, 1.3, 2.66, length=.6, height=.32)


def waystation(a):
    """Sunward Waystation: a rounded adobe trading post under a brass dome, a striped market awning, banner
    poles, brass water jars and a solar fan on a mast."""
    A = a.armor
    base(a, 4.7, 4.0)
    # The hall: rounded canvas-cream adobe, a brass dome with a finial, lit arched door and windows.
    box(a, 'Adobe_hall', A, (3.0, 2.2, 1.5), (0, .62, .93), bevel=.28, seg=2)
    box(a, 'Adobe_roof', A, (2.6, 1.8, .2), (0, .62, 1.75), bevel=.08)
    sphere(a, 'Brass_dome', 'Hazard', (.82, .82, .78), (0, .62, 1.82), seg=16, rings=10, cut=0)
    torus(a, 'Dome_ring', 'Team', .82, .06, (0, .62, 1.86), seg=20, ring=4)
    cyl(a, 'Finial', 'Steel', .04, .55, (0, .62, 2.85), seg=6, bevel=0)
    sphere(a, 'Finial_sun', 'Hazard', .1, (0, .62, 3.16), seg=8, rings=6)
    door = [(-.34, 0), (.34, 0), (.34, .62)] + [(math.cos(t) * .34, .62 + math.sin(t) * .3) for t in [math.radians(d) for d in (30, 60, 90, 120, 150)]] + [(-.34, .62)]
    prism(a, 'Door_glow', 'Window', door, .05, loc=(0, -.49, .2), axis='Y', bevel=0)
    for x in (-1.0, 1.0):
        box(a, 'Hall_windows', 'Window', (.32, .05, .34), (x, -.49, 1.08), bevel=.01)
    # The market awning: canvas stripes alternating cream and team, on brass poles, over a team counter.
    for i in range(6):
        x = -1.75 + i * .7
        box(a, 'Awning', 'Team' if i % 2 else A, (.7, 1.25, .05), (x, -1.05, 1.66), rot=(-.32, 0, 0), bevel=0)
    for x in (-2.05, 2.05):
        cyl(a, 'Awning_poles', 'Hazard', .05, 1.55, (x, -1.58, .97), seg=8, bevel=0)
    box(a, 'Counter', 'Team', (2.2, .5, .62), (0, -1.15, .5), bevel=.05)
    box(a, 'Counter_top', A, (2.3, .58, .08), (0, -1.15, .84), bevel=.02)
    for x in (-.7, 0, .7):
        cyl(a, 'Jars', 'Hazard', .14, .26, (x, -1.15, 1.0), seg=10, r2=.1, bevel=.02)
    # Banner poles at the front corners: brass poles, team banners.
    for x in (-2.08, 2.08):
        cyl(a, 'Banner_poles', 'Steel', .05, 3.2, (x, -1.75, 1.75), seg=6, bevel=0)
        limb(a, 'Banner_bars', 'Hazard', (x - .32, -1.72, 3.16), (x + .32, -1.72, 3.16), .05, bevel=0)
        prism(a, 'Banners', 'Team', [(x - .28, 3.14), (x + .28, 3.14), (x + .28, 2.0), (x, 2.22), (x - .28, 2.0)], .03, loc=(0, -1.7, 0), axis='Y', bevel=0)
        cyl(a, 'Banner_suns', 'Hazard', .13, .03, (x, -1.73, 2.74), rot=FORWARD, seg=10, bevel=0)
        sphere(a, 'Pole_tops', 'Hazard', .08, (x, -1.75, 3.38), seg=8, rings=5)
    # Brass water tank (left) and a solar fan on a mast (back right).
    cyl(a, 'Water_tank', 'Hazard', .42, 1.0, (-1.9, 1.35, .7), seg=16, bevel=.05)
    sphere(a, 'Water_tank_dome', 'Hazard', .42, (-1.9, 1.35, 1.2), seg=16, rings=8, cut=0)
    torus(a, 'Tank_bands', 'Steel', .425, .035, (-1.9, 1.35, .55), seg=16, ring=3)
    cyl(a, 'Fan_mast', 'Steel', .06, 2.4, (1.75, 1.2, 1.38), seg=8, bevel=0)
    for k in range(8):
        ang = k * math.pi / 4
        box(a, 'Solar_fan', A, (.16, .03, .62), (1.75 + math.cos(ang) * .34, 1.05, 2.6 + math.sin(ang) * .34), rot=(0, -ang + R, 0), bevel=0)
    cyl(a, 'Fan_hub', 'Hazard', .12, .1, (1.75, 1.04, 2.6), rot=FORWARD, seg=10, bevel=.01)
    box(a, 'Crates', A, (.5, .45, .4), (1.55, -.2, .4), rot=(0, 0, .2), bevel=.04)
    box(a, 'Crates', 'Team', (.4, .4, .34), (1.62, -.25, .78), rot=(0, 0, -.1), bevel=.04)


# ============================================================================ Wardens
def drone(a):
    """Wardens Sentinel drone (Ranger slot): a ceramic seed in two shells with a glowing seam between them, one
    big lens eye, a crest fin, a floating halo ring carrying two petal shields, and a glowing tail. Same four
    materials as round 3 (ArmorWardens, Steel, Team, TeamGlow), the `hover` bob and the emitter rig."""
    A = a.armor
    a.pivot('hover', (0, 0, 0))
    lower = [(.08, .92), (.2, .97), (.36, 1.07), (.5, 1.2), (.58, 1.33), (.6, 1.4)]
    upper = [(.57, 1.47), (.56, 1.56), (.5, 1.68), (.38, 1.8), (.2, 1.88), (.0, 1.9)]
    a.part('Smooth_shell', A).lathe([(0, .9)] + lower, seg=18)
    a.part('Smooth_shell', A).lathe([(.5, 1.46)] + upper, seg=18)
    torus(a, 'Seam_glow', 'TeamGlow', .55, .04, (0, 0, 1.435), seg=18, ring=4)
    torus(a, 'Brow_band', 'Team', .57, .05, (0, 0, 1.52), seg=18, ring=4)
    prism(a, 'Crest', 'Team', [(.46, 1.8), (.0, 2.42), (-.44, 2.36), (-.62, 1.9), (-.12, 2.0)], .12, axis='X', bevel=.03)
    lens_eye(a, (0, -.55, 1.33), .23, seg=18)
    box(a, 'Eye_visor', A, (.54, .15, .07), (0, -.5, 1.65), rot=(.35, 0, 0), bevel=.02)
    # The floating halo (a ring with no struts), lit on its inside, carrying the two petal shields and a node.
    m = frame((0, .03, 1.16), (.14, 0, 0))
    torus(a, 'Halo', 'Steel', .8, .05, at(m, (0, 0, 0)), rot=(.14, 0, 0), seg=28, ring=5)
    torus(a, 'Halo_rimlight', 'TeamGlow', .755, .02, at(m, (0, 0, .015)), rot=(.14, 0, 0), seg=24, ring=3)
    box(a, 'Halo_lights', 'TeamGlow', (.1, .12, .08), at(m, (0, .8, 0)), rot=(.14, 0, 0), bevel=0)
    # Each petal shield folds along its middle: the lower leaf hangs near upright, the upper one flares out.
    lower_leaf = [(-.24, -.36), (.05, -.46), (.28, -.26), (.27, .02), (-.22, .02)]
    upper_leaf = [(-.22, 0), (.27, 0), (.33, .2), (.12, .48), (-.22, .32)]
    for s in (-1, 1):
        c = at(m, (s * .84, -.02, .12))
        prism(a, 'Tower_shields', A, lower_leaf, .09, loc=c, rot=(.14, s * .2, 0), axis='X', bevel=.025)
        prism(a, 'Tower_shields', A, upper_leaf, .09, loc=(c[0] + s * .01, c[1], c[2] + .01), rot=(.14, s * .55, 0), axis='X', bevel=.025)
        box(a, 'Shield_stripes', 'Team', (.11, .12, .4), (c[0] + s * .03, c[1] - .02, c[2] - .14), rot=(.14, s * .2, 0), bevel=.02)
        box(a, 'Shield_stripes', 'Team', (.11, .12, .36), (c[0] + s * .11, c[1] - .01, c[2] + .2), rot=(.14, s * .55, 0), bevel=.02)
        box(a, 'Shield_lights', 'TeamGlow', (.1, .06, .06), (c[0] + s * .17, c[1] - .2, c[2] + .38), rot=(.14, s * .55, 0), bevel=0)
    # Twin emitters under the eye (Barrel_*: aim and recoil).
    for s in (-1, 1):
        cyl(a, 'Barrel_emitters', 'Steel', .055, .48, (s * .2, -.62, 1.04), rot=FORWARD, seg=8, bevel=.01)
        cyl(a, 'Barrel_emitter_tips', 'Steel', .08, .08, (s * .2, -.86, 1.04), rot=FORWARD, seg=8, bevel=0)
    # Glow seams down the shell, back fins, the floating tail rings and the thruster light.
    for ang in (math.radians(d) for d in (-40, -140, 40, 140)):
        pts = [(math.cos(ang) * r * 1.01, math.sin(ang) * r * 1.01, z) for r, z in ((.38, 1.06), (.52, 1.18), (.6, 1.33))]
        a.part('Panel_seams', 'TeamGlow').tube(pts, .018, seg=3)
    for s in (-1, 1):
        prism(a, 'Tail_fins', 'Team', [(.35, 1.0), (.62, .82), (.66, 1.12), (.45, 1.3)], .05, loc=(s * .2, 0, 0), axis='X', bevel=0)
    torus(a, 'Tail_rings', A, .2, .04, (0, 0, .8), seg=14, ring=4)
    torus(a, 'Tail_rings', A, .12, .035, (0, 0, .69), seg=12, ring=4)
    cyl(a, 'Thruster_light', 'TeamGlow', .1, .05, (0, 0, .6), seg=10, bevel=0)


def walker(a):
    """Wardens Walker (Tank slot): a ceramic beetle carapace on two segmented legs with claw feet, a big lens eye,
    a glowing seam, a floating halo behind the crest, and two team cannon pods with tower shields on the turret."""
    A = a.armor
    for s, side in ((-1, 'L'), (1, 'R')):
        p = a.pivot('leg_' + side, (s * .62, .12, 1.74))
        sphere(a, 'Hip_joint', 'Steel', .22, (0, 0, 0), seg=8, rings=5, parent=p)
        box(a, 'Thigh', A, (.38, .48, .74), (s * .04, -.02, -.42), rot=(.12, 0, 0), bevel=.1, parent=p, taper=(.82, .86))
        cyl(a, 'Knee', 'Steel', .17, .46, (0, -.06, -.86), rot=ACROSS, seg=10, parent=p)
        box(a, 'Shin', 'Team', (.34, .4, .44), (0, .0, -1.1), rot=(-.08, 0, 0), bevel=.07, parent=p, taper=(.86, .86))
        cyl(a, 'Shin_ring', 'Steel', .15, .08, (0, .02, -1.34), seg=10, parent=p)
        box(a, 'Shin_lower', A, (.28, .32, .3), (0, .04, -1.46), rot=(-.08, 0, 0), bevel=.06, parent=p, taper=(.8, .8))
        box(a, 'Shin_seam', 'TeamGlow', (.05, .04, .5), (0, -.2, -1.12), rot=(-.08, 0, 0), bevel=0, parent=p)
        cyl(a, 'Ankle', 'Steel', .1, .3, (0, .05, -1.6), rot=ACROSS, seg=8, parent=p)
        for ang, ln, w in ((0, .62, .2), (-.6, .5, .16), (.6, .5, .16), (math.pi, .34, .16)):
            dx, dy = math.sin(ang) * ln, -math.cos(ang) * ln
            limb(a, 'Claw_toes', 'Steel' if ang == math.pi else A, (0, .05, -1.62), (dx, .05 + dy, -1.7), w, .14, bevel=.03, parent=p, taper=(.5, .6))
    box(a, 'Hip_bridge', 'Steel', (1.5, .56, .3), (0, .12, 1.8), bevel=.1)
    sphere(a, 'Smooth_carapace', A, (1.0, .98, .74), (0, .08, 2.62), seg=18, rings=12)
    cyl(a, 'Belly_plate', 'Steel', .78, .16, (0, .08, 2.0), seg=16, bevel=.03)
    torus(a, 'Seam_glow', 'TeamGlow', .97, .035, (0, .08, 2.48), seg=20, ring=3)
    torus(a, 'Brow_band', 'Team', .86, .07, (0, .08, 2.9), seg=24, ring=4)
    for ang in (-.5, .5):
        mm = frame((0, .08, 2.62), (0, 0, ang))
        a.part('Panel_seams', 'TeamGlow').tube([at(mm, (0, -.55, .5)), at(mm, (0, -.05, .74)), at(mm, (0, .5, .52))], .02, seg=3)
    prism(a, 'Crest', 'Team', [(.62, 3.18), (.08, 3.86), (-.5, 3.8), (-.82, 3.3), (-.18, 3.5)], .15, axis='X', bevel=.03)
    lens_eye(a, (0, -.86, 2.6), .32, seg=16)
    box(a, 'Eye_visor', A, (.82, .2, .12), (0, -.78, 3.02), rot=(.4, 0, 0), bevel=.04)
    # The floating halo behind the crest, lit on its inside.
    torus(a, 'Halo', 'Steel', .92, .07, (0, .55, 3.2), rot=(-.6, 0, 0), seg=24, ring=4)
    torus(a, 'Halo_rimlight', 'TeamGlow', .86, .028, (0, .53, 3.21), rot=(-.6, 0, 0), seg=20, ring=3)
    # Turret: team cannon pods on the turret ring (Turret_pivot + Turret_head*, all team paint so the ring is one
    # batch), each with a tall tower shield; the ceramic-sleeved cannons (Barrel* / Muzzle*) aim and recoil.
    a.pivot('Turret_pivot', (0, 0, 2.5))
    for s in (-1, 1):
        cyl(a, 'Turret_head_socket', 'Team', .26, .32, (s * 1.0, -.02, 2.52), rot=ACROSS, seg=10, bevel=0)
        box(a, 'Turret_head_arm', 'Team', (.46, .86, .5), (s * 1.2, -.18, 2.52), bevel=.14, seg=2)
        box(a, 'Turret_head_shield', 'Team', (.12, 1.0, 1.36), (s * 1.5, -.2, 2.62), rot=(0, s * .1, 0), bevel=.05, taper=(1, .82))
        box(a, 'Turret_head_rib', 'Team', (.07, .8, .14), (s * 1.57, -.2, 2.62), rot=(0, s * .1, 0), bevel=.02)
        cyl(a, 'Barrel_cannon', 'Steel', .12, 1.32, (s * 1.2, -1.2, 2.5), rot=FORWARD, seg=12, bevel=.015)
        cyl(a, 'Barrel_sleeve', A, .16, .34, (s * 1.2, -.7, 2.5), rot=FORWARD, seg=10, bevel=0)
        cyl(a, 'Muzzle_ring', A, .18, .16, (s * 1.2, -1.86, 2.5), rot=FORWARD, seg=10, bevel=0)


def pylon(a):
    """Wardens Pylon: a smooth ceramic spire on a stepped plinth, three floating team rings, one big lens eye,
    glow seams and four tower-shield monoliths."""
    A = a.armor
    base(a, 3.8, 3.8)
    prism(a, 'Plinth', A, chamfered(2.6, 2.6, .55), .36, loc=(0, 0, .36), axis='Z', bevel=.05, taper=.92)
    prism(a, 'Plinth', A, chamfered(1.7, 1.7, .4), .3, loc=(0, 0, .69), axis='Z', bevel=.05, taper=.9)
    a.part('Spine', A).lathe([(.52, .8), (.6, 1.2), (.56, 1.9), (.46, 2.6), (.34, 3.25), (.2, 3.8), (0, 4.3)], seg=18)
    for k in range(4):
        ang = math.pi / 4 + k * R
        m = frame((0, 0, 0), (0, 0, ang))
        a.part('Spine_seams', 'TeamGlow').tube([at(m, (.615, 0, 1.25)), at(m, (.57, 0, 1.95)), at(m, (.475, 0, 2.62)), at(m, (.355, 0, 3.25))], .025, seg=3)
    for z, r, tilt in ((1.45, 1.02, .0), (2.2, .88, .06), (3.2, .62, -.06)):
        torus(a, 'Orbit_rings', 'Team', r, .1, (0, 0, z), rot=(tilt, 0, 0), seg=26, ring=6)
    lens_eye(a, (0, -.5, 2.68), .28, seg=16)
    prism(a, 'Crest', 'Team', [(.3, 3.95), (0, 4.75), (-.3, 3.95)], .12, axis='X', bevel=.02)
    for k in range(4):
        ang = math.pi / 4 + k * R
        c, s = math.cos(ang), math.sin(ang)
        box(a, 'Tower_shields', A, (.8, .16, 1.55), (c * 1.48, s * 1.48, 1.05), rot=(0, 0, ang + R), bevel=.05, taper=(.8, 1))
        box(a, 'Shield_stripes', 'Team', (.16, .18, 1.25), (c * 1.52, s * 1.52, 1.02), rot=(0, 0, ang + R), bevel=.02)
        box(a, 'Shield_glow', 'TeamGlow', (.06, .2, .3), (c * 1.53, s * 1.53, 1.6), rot=(0, 0, ang + R), bevel=0)
    for k in range(4):
        ang = k * R
        c, s = math.cos(ang), math.sin(ang)
        box(a, 'Plinth_windows', 'Window', (.07, .4, .16), (c * 1.17, s * 1.17, .4), rot=(0, 0, ang), bevel=.01)


# ============================================================================ Veil
def veil_body(a, kind):
    """Shade and Watcher: slim charcoal legs and robe with silver piping, a scholar's satchel, folded mauve
    shoulder fins, a deep pointed hood with a dark cowl and a team trim, a long tattered cloak with a silver
    hem, slim arms (added by the caller). Returns the upper-body frame."""
    A = a.armor
    for s, side in ((-1, 'L'), (1, 'R')):
        p = fp.leg(a, side, (s * .19, .04, .9), .9, ('Charcoal', A, 'Undercarriage'), wide=.9, boot_len=.46, toe='Steel', seg=2)
        box(a, 'Knee_guards', A, (.2, .08, .17), (0, -.18, -.46), rot=(-.15, 0, 0), bevel=.025, parent=p)
        box(a, 'Shin_piping', 'Steel', (.03, .02, .26), (0, -.19, -.64), bevel=0, parent=p)
    box(a, 'Pelvis', 'Charcoal', (.42, .3, .22), (0, .03, 1.0), bevel=.05)
    box(a, 'Belt', 'Steel', (.46, .33, .045), (0, .03, 1.1), bevel=.01)
    for s in (-1, 1):
        box(a, 'Belt_pouches', 'Undercarriage', (.1, .12, .12), (s * .24, -.08, 1.02), bevel=0)
    # A robe panel hanging in front from the belt, piped in silver.
    prism(a, 'Robe_panel', 'Charcoal', [(-.15, 1.06), (.15, 1.06), (.12, .62), (0, .52), (-.12, .62)], .04, loc=(0, -.17, 0), axis='Y', bevel=0)
    for (x0, z0), (x1, z1) in (((.12, .62), (0, .52)), ((0, .52), (-.12, .62))):
        limb(a, 'Robe_piping', 'Steel', (x0, -.195, z0), (x1, -.195, z1), .025, .015, bevel=0)
    # The scholar's satchel on the right hip on a strap across the chest.
    box(a, 'Satchel', A, (.12, .26, .22), (.29, .06, .96), rot=(0, 0, .1), bevel=.03)
    box(a, 'Satchel_clasp', 'Steel', (.03, .08, .08), (.36, .02, 1.0), bevel=0)
    T = Body((0, .03, 1.1), .17 if kind == 'shade' else .08)
    limb(a, 'Satchel_strap', 'Undercarriage', T.p((-.22, -.18, .66)), (.27, -.04, 1.07), .06, .025, bevel=0)
    box(a, 'Abdomen', 'Charcoal', (.38, .28, .24), T.p((0, 0, .12)), T.rot(), bevel=.06)
    box(a, 'Chest', 'Charcoal', (.5, .36, .44), T.p((0, .02, .42)), T.rot(), bevel=.08, seg=2, taper=(1.1, 1.0))
    box(a, 'Chest_plate', 'Team', (.3, .06, .26), T.p((0, -.17, .46)), T.rot(), bevel=.03)
    for x in (-.17, .17):
        box(a, 'Piping', 'Steel', (.025, .025, .3), T.p((x, -.17, .44)), T.rot(), bevel=0)
    # Folded shoulder fins: three layers a side, fanned up and out; the top one team-edged.
    for s in (-1, 1):
        for k, (w, d, z, ang) in enumerate(((.38, .46, .64, .5), (.3, .42, .72, .8), (.22, .34, .79, 1.1))):
            box(a, 'Shoulder_fins', A, (w, d, .045), T.p((s * (.33 - k * .04), .02 + k * .02, z)), T.rot((0, s * ang, 0)), bevel=0)
        box(a, 'Fin_edges', 'Team', (.23, .05, .05), T.p((s * .25, -.15, .79)), T.rot((0, s * 1.1, 0)), bevel=0)
    # Hood: a deep pointed cowl with a dark opening (the seer lens sits in it), a team rim and a tail.
    hood = [(-.28, -.2), (-.32, .02), (-.2, .26), (0, .44), (.2, .26), (.32, .02), (.28, -.2)]
    prism(a, 'Hood', 'Team', hood, .52, loc=T.p((0, .06, .86)), rot=T.rot((-.05, 0, 0)), axis='Y', bevel=.04, seg=2)
    prism(a, 'Hood_tail', 'Team', [(.2, .2), (.5, -.08), (.44, -.4), (.2, -.3)], .24, loc=T.p((0, 0, .86)), rot=T.rot(), axis='X', bevel=.02)
    m = T.m @ frame((0, -.215, .86), (-.05, 0, 0))
    prism(a, 'Cowl', 'Undercarriage', [(x * .66, z * .72 - .03) for x, z in hood], .02, loc=at(m, (0, 0, 0)), rot=T.rot((-.05, 0, 0)), axis='Y', bevel=0)
    for (x0, z0), (x1, z1) in zip(hood, hood[1:]):
        limb(a, 'Hood_trim', 'Steel', at(m, (x0 * 1.02, 0, z0 * 1.02)), at(m, (x1 * 1.02, 0, z1 * 1.02)), .05, .03, bevel=0)
    # A team stripe along the hood's ridge: the side's colour on top, seen from the game camera in any facing.
    mr = T.m @ frame((0, .06, .86), (-.05, 0, 0))
    limb(a, 'Hood_ridge', 'Team', at(mr, (0, -.24, .45)), at(mr, (0, .22, .45)), .1, .05, bevel=0)
    # A team mantle over the back of the shoulders, then the long cloak: two tattered tails with a silver hem.
    prism(a, 'Mantle', 'Team', [(-.52, .04), (.52, .04), (.44, -.3), (0, -.38), (-.44, -.3)], .09, loc=T.p((0, .22, .74)), rot=T.rot((-.35, 0, 0)), axis='Y', bevel=.02)
    for s in (-1, 1):
        tail = [(s * .04, 1.72), (s * .5, 1.5), (s * .62, .52), (s * .52, .3), (s * .44, .46), (s * .34, .22), (s * .24, .44), (s * .1, .3), (s * .05, .5)]
        if s > 0:
            tail = tail[::-1]
        prism(a, 'Cloak', 'Charcoal', tail, .06, loc=(0, .3, 0), rot=(-.12, 0, 0), axis='Y', bevel=.015)
        mc = frame((0, .3, 0), (-.12, 0, 0))
        hem = [(s * .62, .52), (s * .52, .3), (s * .44, .46), (s * .34, .22), (s * .24, .44), (s * .1, .3)]
        for (x0, z0), (x1, z1) in zip(hem, hem[1:]):
            limb(a, 'Cloak_hem', 'Steel', at(mc, (x0, .036, z0)), at(mc, (x1, .036, z1)), .03, .02, bevel=0)
    return T


def veil_arms(a, T, right, left, seg=2):
    """Slim charcoal sleeves, mauve bracers, dark gloves; right/left = (elbow, wrist)."""
    A = a.armor
    for s, (elbow, wrist) in ((1, right), (-1, left)):
        shoulder = T.p((s * .3, .02, .58))
        limb(a, 'Arms', 'Charcoal', shoulder, elbow, .14, .16, bevel=.03, seg=seg)
        limb(a, 'Bracers', A, elbow, wrist, .16, .17, bevel=.03, taper=(.85, .85), seg=seg)
        box(a, 'Gloves', 'Undercarriage', (.13, .14, .12), wrist, bevel=.03)


def shade(a):
    """Veil Shade (Vanguard slot): a low, narrow hooded infiltrator; one seer lens glowing in the cowl, a crystal
    blade along the left forearm, a slim beam pistol with a crystal emitter, crystal shards on the shoulder."""
    T = veil_body(a, 'shade')
    cyl(a, 'Seer_lens', 'TeamGlow', .06, .04, T.p((.06, -.24, .86)), T.rot(FORWARD), seg=10, bevel=0)
    veil_arms(a, T, ((.36, -.24, 1.4), (.27, -.52, 1.3)), ((-.36, -.22, 1.42), (-.24, -.56, 1.32)))
    crystal(a, 'Crystal_blade', 'TeamGlow', (-.22, -.5, 1.34), (-.18, -1.14, 1.44), r=.08, sides=4, twist=.4)
    box(a, 'Blade_mount', 'Steel', (.12, .2, .1), (-.22, -.5, 1.36), bevel=.015)
    box(a, 'Pistol', 'Undercarriage', (.1, .34, .14), (.27, -.62, 1.33), bevel=.02)
    cyl(a, 'Pistol_emitter', 'Steel', .04, .26, (.27, -.9, 1.35), rot=FORWARD, seg=8, bevel=0)
    crystal(a, 'Emitter_crystal', 'TeamGlow', (.27, -1.0, 1.35), (.27, -1.14, 1.35), r=.055, sides=4)
    crystal(a, 'Shoulder_crystals', 'TeamGlow', T.p((-.36, .14, .76)), T.p((-.5, .22, 1.12)), r=.065, sides=4)
    crystal(a, 'Shoulder_crystals', 'TeamGlow', T.p((-.28, .22, .76)), T.p((-.3, .34, 1.02)), r=.05, sides=4, twist=.5)


def watcher(a):
    """Veil Watcher (Anti-tank slot): a hooded seer-sniper with a seer monocle on a silver arm, a scroll case and
    a thin crystal spire on its back, and a long rail rifle with folded fins (Barrel* / Muzzle*: aim and recoil).
    Kneels to fire."""
    A = a.armor
    T = veil_body(a, 'watcher')
    # Seer monocle: a big green lens on a silver arm in front of the right eye.
    limb(a, 'Monocle_arm', 'Steel', T.p((.22, -.14, .95)), T.p((.1, -.32, .87)), .03, bevel=0)
    cyl(a, 'Monocle_rim', 'Steel', .1, .06, T.p((.08, -.33, .86)), T.rot(FORWARD), seg=12, bevel=.01)
    cyl(a, 'Seer_lens', 'TeamGlow', .075, .05, T.p((.08, -.36, .86)), T.rot(FORWARD), seg=12, bevel=0)
    # A scroll case slung across the back, and a thin silver spire carrying three team crystals.
    cyl(a, 'Scroll_case', 'Charcoal', .085, .8, T.p((-.06, .26, .46)), T.rot((0, .7, 0)), seg=10, bevel=.015)
    for k in (-1, 1):
        cyl(a, 'Scroll_caps', 'Steel', .095, .08, T.p((-.06 + k * .27, .26, .46 + k * .23)), T.rot((0, .7, 0)), seg=8, bevel=0)
    b = T.p((.1, .2, .7))
    limb(a, 'Spire', 'Steel', b, (b[0] + .05, b[1] + .12, 2.75), .035, bevel=0)
    for k, (h, r) in enumerate(((2.15, .07), (2.38, .055), (2.58, .045))):
        crystal(a, 'Spire_crystals', 'TeamGlow', (b[0] + .04, b[1] + .1 * (h - b[2]) / 2, h - .14), (b[0] + .04 + (.08 if k % 2 else -.08), b[1] + .14, h + .12), r=r, sides=4, twist=k)
    # Arms on the rail rifle: the right hand at the grip, the left under the rails.
    veil_arms(a, T, ((.42, -.08, 1.42), (.3, -.36, 1.46)), ((-.34, -.3, 1.4), (.22, -.82, 1.5)), seg=1)
    # Rail rifle (mauve and steel only: the rig stays one baked batch): receiver, twin rails, swept fins.
    box(a, 'Barrel_receiver', A, (.17, .72, .22), (.3, -.36, 1.56), bevel=.03)
    box(a, 'Barrel_stock', 'Steel', (.12, .3, .16), (.3, .12, 1.52), rot=(.15, 0, 0), bevel=.02)
    for dz in (-.05, .05):
        cyl(a, 'Barrel_rails', 'Steel', .032, 1.4, (.3, -1.4, 1.58 + dz), rot=FORWARD, seg=8, bevel=0)
    for k in range(3):
        y = -.95 - k * .38
        for sz in (1, -1):
            prism(a, 'Barrel_fins', A, [(y - .1, 1.58 + sz * .04), (y + .14, 1.58 + sz * .04), (y + .22, 1.58 + sz * .2)], .025, loc=(.3, 0, 0), axis='X', bevel=0)
    cyl(a, 'Muzzle_ring', 'Steel', .085, .08, (.3, -2.1, 1.58), rot=FORWARD, seg=10, bevel=0)


def veilrelay(a):
    """Veil relay: a narrow mauve spire with folded charcoal fins and silver piping on a charcoal plinth, a
    hooded lit entrance, seer lenses on thin arms, and a cluster of team crystals at the crown."""
    A = a.armor
    base(a, 3.6, 3.6, mat='Charcoal')
    # Silver piping round the charcoal plinth, so its edge reads on dark ground too.
    edge = chamfered(3.6, 3.6, .4)
    for (x0, y0), (x1, y1) in zip(edge, edge[1:] + edge[:1]):
        limb(a, 'Plinth_piping', 'Steel', (x0 * .975, y0 * .975, .2), (x1 * .975, y1 * .975, .2), .07, .05, bevel=0)
    hexa = [(math.cos(k * math.tau / 6 + math.pi / 6) * .62, math.sin(k * math.tau / 6 + math.pi / 6) * .62) for k in range(6)]
    prism(a, 'Spire', A, hexa, 3.3, loc=(0, 0, 1.83), axis='Z', bevel=.03, taper=.5)
    prism(a, 'Spire_base', 'Charcoal', [(x * 1.5, y * 1.5) for x, y in hexa], .4, loc=(0, 0, .38), axis='Z', bevel=.04, taper=.85)
    for k in range(4):
        ang = math.pi / 4 + k * R
        m = frame((0, 0, 0), (0, 0, ang))
        # Each fin is folded: a charcoal blade and a shorter mauve leaf creased against it.
        fin = [(.42, .36), (1.38, .36), (1.1, 1.0), (.52, 3.3), (.42, 3.2)]
        prism(a, 'Folded_fins', 'Team', fin, .1, rot=(0, 0, ang - R), axis='X', bevel=.02)
        prism(a, 'Fin_leaves', A, [(.5, .5), (1.12, .5), (.94, 1.0), (.55, 2.4)], .06, rot=(0, 0, ang - R + .2), axis='X', bevel=.015)
        limb(a, 'Fin_piping', 'Steel', at(m, (1.38, 0, .38)), at(m, (1.1, 0, 1.02)), .035, bevel=0)
        limb(a, 'Fin_piping', 'Steel', at(m, (1.1, 0, 1.02)), at(m, (.52, 0, 3.32)), .035, bevel=0)
    # Hooded entrance at the front, lit.
    prism(a, 'Entrance_hood', 'Charcoal', [(-.5, .3), (-.5, 1.3), (0, 1.75), (.5, 1.3), (.5, .3), (.38, .3), (.38, 1.2), (0, 1.55), (-.38, 1.2), (-.38, .3)], .5,
          loc=(0, -.78, 0), axis='Y', bevel=.02)
    prism(a, 'Entrance', 'Window', [(-.36, .3), (.36, .3), (.36, 1.18), (0, 1.5), (-.36, 1.18)], .05, loc=(0, -.62, 0), axis='Y', bevel=0)
    # Seer lenses on thin silver arms at three heights, facing the front.
    for x, z in ((-.95, 1.7), (.85, 2.45), (-.6, 3.1)):
        limb(a, 'Lens_arms', 'Steel', (x * .35, 0, z - .1), (x, -.25, z), .04, bevel=0)
        cyl(a, 'Lens_rims', 'Steel', .2, .07, (x, -.27, z), rot=FORWARD, seg=14, bevel=.01)
        cyl(a, 'Lens_lights', 'TeamGlow', .14, .06, (x, -.31, z), rot=FORWARD, seg=12, bevel=0)
    # The crown: a cluster of team crystals round a lit core shard; two thin side spires.
    crystal(a, 'Crown_core', 'TeamGlow', (0, 0, 3.3), (0, 0, 4.65), r=.17, sides=5)
    for k in range(5):
        ang = k * math.tau / 5 + .3
        crystal(a, 'Crown_crystals', 'Team', (math.cos(ang) * .14, math.sin(ang) * .14, 3.25), (math.cos(ang) * .66, math.sin(ang) * .66, 4.05 + .14 * (k % 2)),
                r=.12, sides=4, twist=k)
    for x in (-1.45, 1.45):
        limb(a, 'Side_spires', 'Steel', (x, .9, .2), (x * .92, .9, 3.6), .05, bevel=0)
        crystal(a, 'Side_crystals', 'Team', (x * .92, .9, 3.5), (x * .9, .9, 4.0), r=.08, sides=4)


# ============================================================================ shared
def base(a, w=4, d=4, mat='Concrete'):
    a.part('Platform', mat).prism(chamfered(w, d, .4), .18, loc=(0, 0, .09), axis='Z', bevel=.025, seg=1)
    for x in [-w / 2 + .3, w / 2 - .3]:
        box(a, 'Landing_lights', 'TeamGlow', (.2, .12, .08), (x, -d / 2 + .2, .21), bevel=.015)


BUILDERS = {'scrapper': scrapper, 'scorcher': scorcher, 'salvageyard': salvageyard, 'rider': rider, 'wagon': wagon,
            'waystation': waystation, 'drone': drone, 'walker': walker, 'pylon': pylon, 'shade': shade, 'watcher': watcher,
            'veilrelay': veilrelay}


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


# Parts whose own name the runtime or the tests look up (src/view.js: the gun rig, leg knees, rolling wheels and
# tracks; src/team-bands.js: the Rider's Sail; tests/r3j-models-portraits.test.js: the Drone's parts) keep their
# own mesh, and so do the armour-paint parts (team-bands.js lays the team stripe on the largest of them) and the
# faceted crystals. Every other part merges with the other details of its material under the same pivot
# ("<Material>_details"). That only makes the GLB smaller (each part costs a mesh, a node and five accessors): the
# view merges all parts by material and rigid group anyway, and the baked shading is per vertex against the whole
# model, so nothing drawn changes.
KEEP_PART = re.compile(r'^(Main_cannon|Muzzle|Barrel|Cannon|Turret_head|Knee|Tyres|Spoked_rims|Spokes|Wheel|Tracks|Sail$|Smooth_|Crest|'
                       r'Brow_band|Tower_shields|Shield_stripes)', re.I)


def consolidate(a):
    shapes, order = {}, []
    for key in a.order:
        name, mat, parent = key
        shape = a.shapes[key]
        if KEEP_PART.match(name) or mat.startswith('Armor') or getattr(shape, 'flat', False):
            shapes[key] = shape
            order.append(key)
            continue
        target = (f'{mat}_details', mat, parent)
        if target not in shapes:
            shapes[target] = fp.Shape()
            shapes[target].flat = False
            order.append(target)
        me = bpy.data.meshes.new('_merge')
        shape.bm.to_mesh(me)
        shape.bm.free()
        shapes[target].bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    a.shapes, a.order = shapes, order


def report(a):
    rows = sorted(((sum(len(f.verts) - 2 for f in s.bm.faces), k[0], k[1]) for k, s in a.shapes.items()), reverse=True)
    for n, part, mat in rows:
        print(f'FACTION_PART {a.name} {n:5d} {part} ({mat})')


def build_all(names=None, parts=False, blend=False):
    root = kit.workspace('FrontierFactions')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for name in names or CATALOG:
        faction, kind, budget, minimum = CATALOG[name]
        infantry = name in INFANTRY
        a = fp.FactionAsset(name, root, ao_distance=.7 if infantry else .55 if kind == 'unit' else 1.3, grime_height=.45 if kind == 'unit' else .8, ao_samples=40)
        a.armor = FACTION_ARMOR[faction]
        BUILDERS[name](a)
        # The troops keep the family's surface detail (2800+ triangles, as the shared kit's) with real parts:
        # no padding with studs.
        tris = count(a)
        if tris < minimum:
            raise RuntimeError(f'{name}: {tris} triangles < the family minimum {minimum}')
        if parts or tris > cap(name):
            report(a)
        if tris > cap(name):
            raise RuntimeError(f'{name}: {tris} triangles > {cap(name)} (round 3 {ROUND3[name]} + 25 %, budget {budget})')
        consolidate(a)
        if count(a) != tris:
            raise RuntimeError(f'{name}: merging details changed the triangle count ({tris} -> {count(a)})')
        a.finish()
        a.export(OUT / f'{name}.glb')
        mats = sorted({ob.data.materials[0].name for ob in a.objects})
        entries.append(dict(name=name, file=name + '.glb', triangles=a.triangles(), faction=faction, kind=kind, budget=budget, review=REVIEW,
                            source='tools/blender/generate_factions.py + faction_parts.py (frontier_kit), visual round V',
                            animation='Runtime articulated parts; no baked clips'))
        print('FACTION_ASSET', name, a.triangles(), len(mats), mats, (OUT / f'{name}.glb').stat().st_size, flush=True)
        # Free object names (leg_L, Turret_pivot, hover) for the next model, so none exports as ".001".
        kit.clear_workspace(root)
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    built = {e['name']: e for e in entries}
    manifest['assets'] = [built.pop(e['name'], e) for e in manifest['assets']] + list(built.values())
    (OUT / 'manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf-8'))
    if blend:
        # The library file holds every model side by side (names there may take Blender suffixes; the GLBs
        # above were exported one model at a time, so theirs never do).
        for name in names or CATALOG:
            faction, kind = CATALOG[name][:2]
            a = fp.FactionAsset(name, root, ao_distance=.7 if name in INFANTRY else .55 if kind == 'unit' else 1.3,
                                grime_height=.45 if kind == 'unit' else .8, ao_samples=40)
            a.armor = FACTION_ARMOR[faction]
            BUILDERS[name](a)
            consolidate(a)
            a.finish()
        source = ROOT / 'assets/source'
        source.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(source / 'frontier-factions.blend'))
    return entries


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_all([n for n in args if n in CATALOG] or None, parts='--report' in args, blend='--blend' in args)
