"""Faction roster additions (roster 2026-11-24). Headless Blender 5.2.5 LTS; no external assets.

  blender -b --factory-startup --python tools/blender/generate_roster.py -- [names...] [--manifest] [--report]

Writes public/models/{lancer,bulwark,moth,halo}.glb. With --manifest it also records them in
public/models/manifest.json (flagged 'pending owner review (roster 2026-11-24)').

  lancer   Sunward "Lance buggy": a light two-seat desert buggy on four balloon tyres under a sun-canvas
           canopy, a harpoon-rocket rack on a rear pintle (Turret_pivot + Turret_head_cradle turn; the
           Barrel_harpoon tubes and Muzzle_harpoon heads recoil). A tracked-hull style rig (unit-rig.js
           RIG_HULL): its Wheels roll and the body pitches. Ground unit, like the Wagon and Rider.
  bulwark  Wardens "Bulwark": a stocky two-legged shield walker carrying a tall ward plate with a glowing
           ward emitter, a sensor head peeking over the plate and a light side gun (Barrel_gun /
           Muzzle_gun). Its legs are the Walker's shader-bones contract: leg_L / leg_R pivots at the hips
           with Upper_leg / Knee / Shin / Boot parts (unit-rig.js RIG_INFANTRY, gait "stomp", no kneel).
  moth     Veil "Veil moth": a silent moth-winged flyer, broad violet membrane wings with team eyespots,
           big green lens eyes and an under-slung beam gun (Barrel_beam / Muzzle_lens).
  halo     Wardens "Halo interceptor": a shield ring around a compact core with a lift fan spinning
           inside the ring (spin_fan) and twin forward guns (Barrel_guns / Muzzle_guns).

Flyers follow generate_air.py's contract: lowest point at z = 0, a `hover` empty at the origin, spin_*
pivots turn about Blender Z, AO without a ground plane. Weapon heights and reaches in
src/visual-style.json `weapons.<type>` match the muzzles printed by this script (ROSTER_MUZZLE).
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
R = math.pi / 2
FORWARD = (R, 0, 0)   # cylinder axis along Y
ACROSS = (0, R, 0)    # cylinder axis along X
REVIEW = 'pending owner review (roster 2026-11-24)'

# Veil colours, as generate_stalker.py adds them (kept on every team; only Team* is recoloured).
kit.MATERIALS.setdefault('Cloak', ('#8e63ee', 0.0, 0.78, 0.0))
kit.MATERIALS.setdefault('Lens', ('#32ff86', 0.0, 0.22, 2.6))
kit.GLOWING.add('Lens')

# name: (faction, kind, budget, minimum triangles, flyer)
CATALOG = {
    'lancer': ('sunward', 'unit', 3500, 3000, False),
    'bulwark': ('wardens', 'unit', 4500, 3500, False),
    'moth': ('veil', 'unit', 1500, 0, True),
    'halo': ('wardens', 'unit', 1500, 0, True),
}
SPIN = {'lancer': {}, 'bulwark': {}, 'moth': {}, 'halo': {'spin_fan': 'Z'}}


# ----------------------------------------------------------------------------- helpers
def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.035, parent=None, taper=(1, 1)):
    return a.part(name, mat, parent).box(size, loc=loc, rot=rot, bevel=bevel, seg=1, taper=taper)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12, r2=None, bevel=.015, parent=None):
    return a.part(name, mat, parent).cyl(r, depth, loc=loc, rot=rot, seg=seg, r2=r2, bevel=bevel, bseg=1)


def beam(a, name, mat, start, end, width=.07, parent=None):
    return a.part(name, mat, parent).limb(start, end, width, width, bevel=0, seg=1)


def sheet(a, name, mat, points, loc=(0, 0, 0), rot=(0, 0, 0), depth=.04, axis='Z', bevel=0):
    """A flat panel (canvas, membrane, fin) extruded from an outline."""
    return a.part(name, mat).prism(points, depth, loc=loc, rot=rot, axis=axis, bevel=bevel, seg=1)


def eye(a, loc, r, mat='TeamGlow', seg=16):
    """The Wardens eye: a steel rim round a glowing lens, facing -Y."""
    cyl(a, 'Eye_rim', 'Steel', r * 1.4, .1, loc, rot=FORWARD, seg=seg)
    cyl(a, 'Single_eye', mat, r, .12, (loc[0], loc[1] - .04, loc[2]), rot=FORWARD, seg=seg, bevel=0)


# ----------------------------------------------------------------------------- lancer
def lancer(a):
    """Sunward Lance buggy (front is -Y)."""
    A = a.armor  # ArmorSunward: sun-bleached canvas cream
    # Balloon tyres: fat, soft and big at the back (rolled by the hull rig: the meshes are named Wheels*).
    for y, r, w in ((-1.0, .42, .4), (.95, .5, .46)):
        for x in (-.98, .98):
            cyl(a, 'Wheels', 'Undercarriage', r, w, (x, y, r), rot=ACROSS, seg=18, bevel=.09)
            cyl(a, 'Wheel_hubs', 'Team', r * .5, w + .04, (x, y, r), rot=ACROSS, seg=10, bevel=.02)
    # Low tub: team-painted side pods and a sloped nose, cream deck between them.
    box(a, 'Body_tub', 'Team', (1.18, 2.5, .34), (0, -.05, .62), bevel=.08, taper=(.96, .96))
    box(a, 'Nose_cowl', 'Team', (1.0, .62, .3), (0, -1.45, .66), rot=(-.32, 0, 0), bevel=.07, taper=(.86, .8))
    box(a, 'Skid_plate', 'Steel', (.9, .5, .08), (0, -1.6, .42), rot=(.35, 0, 0), bevel=.02)
    box(a, 'Deck', A, (1.1, 2.2, .06), (0, .05, .81), bevel=.02)
    # Fenders over the four tyres: thin cream arches over the top, so the fat tyres still show.
    for y, r in ((-1.0, .42), (.95, .5)):
        for s_ in (-1, 1):
            ts = [math.radians(d) for d in (165, 135, 105, 75, 45, 15)]
            arch = [(y + (r + .11) * math.cos(t), r + (r + .11) * math.sin(t)) for t in ts]
            arch += [(y + (r + .04) * math.cos(t), r + (r + .04) * math.sin(t)) for t in reversed(ts)]
            sheet(a, 'Fenders', A, arch, loc=(s_ * 1.0, 0, 0), depth=.44, axis='X')
    # Side rails joining the fenders, with a team stripe.
    for s in (-1, 1):
        box(a, 'Side_rails', 'Steel', (.12, 1.2, .12), (s * .66, 0, .9), bevel=.02)
    # Two seats side by side up front (driver and spotter), the engine and fuel behind.
    for x in (-.3, .3):
        box(a, 'Seats', 'Undercarriage', (.42, .42, .14), (x, -.35, .9), bevel=.04)
        box(a, 'Seats', 'Undercarriage', (.42, .12, .5), (x, -.1, 1.12), rot=(-.18, 0, 0), bevel=.04)
    # Driver (left) and spotter (right): suit, cream wraps, goggles.
    for x, lean in ((-.3, 0), (.3, .1)):
        box(a, 'Crew', 'Suit', (.4, .3, .46), (x, -.35, 1.2), rot=(-.1, 0, lean), bevel=.06)
        a.part('Crew_heads', A).sphere(.17, loc=(x, -.4, 1.57), seg=10, rings=6)
        box(a, 'Goggles', 'Hazard', (.24, .06, .07), (x, -.56, 1.59), bevel=0)
        box(a, 'Scarves', 'Team', (.3, .26, .08), (x, -.36, 1.43), bevel=.02)
        a.part('Crew_arms', 'Suit').limb((x - .18, -.4, 1.35), (x - .14, -.78, 1.1), .1, .11, bevel=0, seg=1)
        a.part('Crew_arms', 'Suit').limb((x + .18, -.4, 1.35), (x + .14, -.78, 1.1), .1, .11, bevel=0, seg=1)
    cyl(a, 'Steering_wheel', 'Steel', .16, .04, (-.3, -.8, 1.12), rot=(R - .5, 0, 0), seg=10, bevel=0)
    box(a, 'Dash', 'Steel', (1.0, .12, .2), (0, -.88, .98), rot=(.4, 0, 0), bevel=.03)
    box(a, 'Engine_block', 'Steel', (.8, .6, .4), (0, .75, 1.02), bevel=.05)
    a.part('Engine_vents', 'Undercarriage').grille(.6, .26, loc=(0, 1.07, 1.02), rot=(0, 0, math.pi), slats=3, depth=.04,
                                                   thickness=.04)
    for x in (-.5, .5):
        cyl(a, 'Water_cans', 'Hazard', .14, .5, (x, 1.25, .95), seg=10)
        cyl(a, 'Exhausts', 'Undercarriage', .055, .55, (x * .6, 1.15, 1.25), rot=(-.5, 0, 0), seg=8, bevel=0)
    # Roll cage: steel hoops over the crew and posts to the canopy.
    a.part('Roll_cage', 'Steel').tube([(-.62, -1.0, .8), (-.55, -.85, 1.72), (.55, -.85, 1.72), (.62, -1.0, .8)], .045, seg=6)
    a.part('Roll_cage', 'Steel').tube([(-.62, .05, .8), (-.56, -.1, 1.72), (.56, -.1, 1.72), (.62, .05, .8)], .045, seg=6)
    for s in (-1, 1):
        beam(a, 'Roll_cage_bars', 'Steel', (s * .55, -.85, 1.72), (s * .56, -.1, 1.72), .07)
    # Sun canopy over the crew only: a cream canvas with a gentle arch, a team band and the Sunward sun disc.
    roof = [(-.8, 0), (-.4, .1), (0, .13), (.4, .1), (.8, 0)]
    a.part('Sun_canopy', A).prism(roof, 1.0, loc=(0, -.5, 1.76), axis='Y', bevel=.015, seg=1)
    a.part('Canopy_band', 'Team').prism([(x * 1.02, z + .02) for x, z in roof], .28, loc=(0, -.5, 1.76), axis='Y',
                                         bevel=.01, seg=1)
    cyl(a, 'Sun_disc', 'Hazard', .2, .03, (0, -.86, 1.9), rot=(.1, 0, 0), seg=12, bevel=0)
    # Fringe tassels along the canopy's front edge (Sunward canvas).
    for k in range(6):
        box(a, 'Canopy_fringe', A, (.08, .03, .14), (-.65 + k * .26, -1.0, 1.7), bevel=0, taper=(.4, 1))
    # Whip antenna with a team pennant.
    beam(a, 'Whip_antenna', 'Steel', (.62, .45, 1.0), (.68, .75, 2.75), .03)
    sheet(a, 'Pennant', 'Team', [(.75, 2.72), (.75, 2.42), (1.25, 2.6)], loc=(.685, 0, 0), depth=.02, axis='X')
    # Rear pintle over the engine: a tall steel post, a team cradle that turns (Turret_pivot / Turret_head_*)
    # and a rack of three harpoon rockets above the canopy line that recoil (Barrel_* tubes, Muzzle_* heads).
    a.pivot('Turret_pivot', (0, .65, 1.85))
    cyl(a, 'Pintle_post', 'Steel', .1, .7, (0, .65, 1.55), seg=10)
    box(a, 'Turret_head_cradle', 'Team', (.78, .62, .18), (0, .5, 1.96), bevel=.05)
    for x in (-.42, .42):
        box(a, 'Turret_head_cheeks', A, (.1, .56, .34), (x, .5, 2.08), bevel=.03)
    for x in (-.22, 0, .22):
        cyl(a, 'Barrel_harpoon', 'Steel', .095, 1.35, (x, .2, 2.14), rot=(R - .06, 0, 0), seg=10)
        cyl(a, 'Barrel_harpoon_band', 'Team', .112, .14, (x, .62, 2.16), rot=(R - .06, 0, 0), seg=10, bevel=0)
        cyl(a, 'Muzzle_harpoon', 'Hazard', .12, .36, (x, -.65, 2.19), rot=(R - .06, 0, 0), seg=8, r2=.01, bevel=0)
        for k in (-1, 1):  # barbs
            box(a, 'Muzzle_harpoon_barbs', 'Steel', (.03, .18, .04), (x + k * .09, -.5, 2.19), rot=(0, 0, k * .5), bevel=0)
    for x in (-.18, .18):
        beam(a, 'Turret_head_handles', 'Steel', (x, .85, 2.02), (x, 1.12, 1.9), .045)


# ----------------------------------------------------------------------------- bulwark
def bulwark_legs(a, wide=.52, height=1.25):
    # The renderer bends these two pivots in the vertex shader (unit-rig.js): every leg part hangs from one.
    for sign, side in [(-1, 'L'), (1, 'R')]:
        p = a.pivot('leg_' + side, (sign * wide, .12, height))
        box(a, 'Upper_leg', a.armor, (.36, .42, height * .5), (0, 0, -height * .26), bevel=.06, parent=p)
        cyl(a, 'Knee', 'Steel', .17, .42, (0, 0, -height * .55), rot=ACROSS, seg=12, parent=p)
        box(a, 'Shin', 'Team', (.38, .44, height * .4), (0, -.03, -height * .76), bevel=.06, taper=(1.1, 1.1), parent=p)
        box(a, 'Knee_guard', a.armor, (.3, .14, .26), (0, -.24, -height * .55), bevel=.04, parent=p)
        box(a, 'Boot', 'Undercarriage', (.52, .74, .2), (0, -.08, -height + .1), bevel=.05, parent=p)
        box(a, 'Boot_toes', 'Steel', (.5, .16, .12), (0, -.5, -height + .07), bevel=.03, parent=p)


def bulwark(a):
    A = a.armor  # ArmorWardens: ice white
    bulwark_legs(a)
    box(a, 'Hip_bridge', 'Steel', (1.3, .55, .3), (0, .12, 1.3), bevel=.08)
    # Stocky body: a bevelled hull with a team roof panel and a back pack of capacitors.
    box(a, 'Body_hull', A, (1.4, 1.1, .95), (0, .2, 1.85), bevel=.18, taper=(.86, .84))
    box(a, 'Roof_panel', 'Team', (.9, .62, .08), (0, .28, 2.33), bevel=.03)
    a.part('Brow_band', 'Team').torus(.6, .05, loc=(0, .2, 2.12), rot=(0, 0, 0), seg=20, ring=5)
    for x in (-.32, 0, .32):
        cyl(a, 'Capacitors', 'Steel', .13, .7, (x, .83, 1.95), seg=10)
        cyl(a, 'Capacitor_caps', 'TeamGlow', .09, .06, (x, .83, 2.32), seg=10, bevel=0)
    # Sensor head peeking over the ward plate, with the Wardens eye and crest.
    box(a, 'Head', A, (.62, .5, .36), (0, -.02, 2.55), bevel=.1, taper=(.8, .8))
    eye(a, (0, -.29, 2.56), .1)
    a.part('Crest', 'Team').prism([(.35, 2.68), (.0, 3.12), (-.32, 3.08), (-.42, 2.72)], .1, loc=(0, 0, 0), axis='X',
                                  bevel=.02, seg=1)
    # Shield arms: two steel struts from the hull to the plate's back.
    for s in (-1, 1):
        cyl(a, 'Shoulder_socket', A, .2, .3, (s * .7, -.05, 2.0), rot=ACROSS, seg=12)
        beam(a, 'Shield_arms', 'Steel', (s * .6, -.1, 1.95), (s * .5, -.66, 1.75), .12)
    # The ward plate (tower shield): tall, slightly leaning back, white with team stripes, rim and boss.
    lean = .1
    plate = [(-.85, -.95), (.85, -.95), (.95, .55), (.62, .95), (-.62, .95), (-.95, .55)]
    a.part('Ward_plate', A).prism(plate, .16, loc=(0, -.78, 1.7), rot=(lean, 0, 0), axis='Y', bevel=.05, seg=1)
    a.part('Ward_rim', 'Steel').prism([(x * 1.06, z * 1.05) for x, z in plate], .1, loc=(0, -.7, 1.7), rot=(lean, 0, 0),
                                       axis='Y', bevel=.02, seg=1)
    fwd = Matrix.Translation((0, -.78, 1.7)) @ Matrix.Rotation(lean, 4, 'X')
    for x in (-.55, .55):
        p = fwd @ Vector((x, -.09, -.1))
        box(a, 'Shield_stripes', 'Team', (.2, .05, 1.5), tuple(p), rot=(lean, 0, 0), bevel=.015)
    p = fwd @ Vector((0, -.09, .72))
    box(a, 'Shield_crown', 'Team', (1.0, .05, .14), tuple(p), rot=(lean, 0, 0), bevel=.015)
    # The ward emitter: a big glowing lens in a steel boss, three small lamps under it.
    p = fwd @ Vector((0, -.08, .05))
    cyl(a, 'Ward_boss', 'Steel', .34, .1, tuple(p), rot=(R + lean, 0, 0), seg=18)
    p = fwd @ Vector((0, -.14, .05))
    cyl(a, 'Ward_emitter', 'TeamGlow', .22, .08, tuple(p), rot=(R + lean, 0, 0), seg=18, bevel=0)
    a.part('Ward_ring', 'Steel').torus(.27, .025, loc=tuple(fwd @ Vector((0, -.17, .05))), rot=(R + lean, 0, 0), seg=16,
                                       ring=4)
    for x in (-.3, 0, .3):
        p = fwd @ Vector((x, -.1, -.55))
        cyl(a, 'Ward_lamps', 'TeamGlow', .05, .05, tuple(p), rot=(R + lean, 0, 0), seg=8, bevel=0)
    # Bolts round the plate edge.
    for x, z in ((-.75, -.8), (.75, -.8), (-.82, .45), (.82, .45), (-.5, .82), (.5, .82)):
        p = fwd @ Vector((x, -.09, z))
        cyl(a, 'Plate_bolts', 'Steel', .04, .04, tuple(p), rot=(R + lean, 0, 0), seg=6, bevel=0)
    # Light side gun on the right shoulder, poking past the plate (Barrel_* / Muzzle_* recoil).
    box(a, 'Gun_mount', 'Steel', (.22, .4, .2), (.9, -.05, 2.1), bevel=.04)
    box(a, 'Barrel_housing', A, (.24, .7, .24), (1.02, -.45, 2.12), bevel=.05)
    for dz in (-.05, .05):
        cyl(a, 'Barrel_gun', 'Steel', .04, .8, (1.02, -1.15, 2.12 + dz), rot=FORWARD, seg=8)
    cyl(a, 'Muzzle_gun', 'Undercarriage', .08, .12, (1.02, -1.58, 2.12), rot=FORWARD, seg=10)


# ----------------------------------------------------------------------------- moth
def moth(a):
    """Veil moth (front is -Y): violet membrane wings with team eyespots, green lens eyes, belly beam gun."""
    A = a.armor  # ArmorVeil: dusk mauve
    a.pivot('hover', (0, 0, 0))
    z = .62
    # Body: thorax, a tapering abdomen behind, a small head with two big lens eyes.
    a.part('Thorax', A).sphere((.26, .42, .24), loc=(0, -.05, z), seg=10, rings=7)
    a.part('Abdomen', 'Cloak').sphere((.2, .55, .18), loc=(0, .72, z - .02), seg=10, rings=6)
    for y in (.5, .78, 1.02):
        a.part('Abdomen_bands', 'Team').torus(.19 - (y - .5) * .12, .03, loc=(0, y, z - .02), rot=FORWARD, seg=10, ring=3)
    a.part('Head', A).sphere(.17, loc=(0, -.52, z + .02), seg=8, rings=6)
    for s in (-1, 1):
        a.part('Lens_eyes', 'Lens').sphere(.11, loc=(s * .12, -.6, z + .06), seg=8, rings=5)
        # Feathered antennae sweeping up and back.
        beam(a, 'Antennae', 'Steel', (s * .06, -.62, z + .16), (s * .32, -.95, z + .55), .03)
        for k in range(3):
            t = .35 + k * .22
            px, py, pz = s * (.06 + .26 * t), -.62 - .33 * t, z + .16 + .39 * t
            beam(a, 'Antenna_plumes', 'Cloak', (px, py, pz), (px + s * .12, py + .02, pz - .06), .03)
    # Wings: a broad forewing and a rounded hindwing per side, flat membranes with a little dihedral.
    wz = z + .12
    for s in (-1, 1):
        fore = [(s * .18, -.25), (s * .8, -.55), (s * 1.55, -.62), (s * 1.82, -.35), (s * 1.6, .1), (s * .9, .22),
                (s * .2, .1)]
        hind = [(s * .18, .12), (s * .8, .26), (s * 1.3, .45), (s * 1.28, .88), (s * .9, 1.1), (s * .45, .95),
                (s * .15, .5)]
        if s > 0:
            fore, hind = fore[::-1], hind[::-1]
        dih = -s * .1
        sheet(a, 'Wing', 'Cloak', fore, loc=(0, 0, wz), rot=(0, dih, 0), depth=.04)
        sheet(a, 'Hindwing', 'Cloak', hind, loc=(0, 0, wz - .03), rot=(0, dih, 0), depth=.04)
        rot = Matrix.Rotation(dih, 4, 'Y')

        def on(x, y, h=.03):
            return tuple(Vector((0, 0, wz)) + rot @ Vector((x, y, h)))
        # Leading-edge spar in team paint and two veins, so the side reads from above.
        a.part('Wing_spars', 'Team').limb(on(s * .2, -.26), on(s * .8, -.56), .07, .05, bevel=0, seg=1)
        a.part('Wing_spars', 'Team').limb(on(s * .8, -.56), on(s * 1.55, -.63), .06, .05, bevel=0, seg=1)
        a.part('Wing_veins', A).limb(on(s * .25, -.05), on(s * 1.6, -.3), .04, .04, bevel=0, seg=1)
        a.part('Wing_veins', A).limb(on(s * .25, .25), on(s * 1.1, .8, .0), .04, .04, bevel=0, seg=1)
        # Eyespots: a team disc ringed in mauve on each forewing, a glowing lens pip on each hindwing.
        cyl(a, 'Eyespots', A, .26, .02, on(s * 1.18, -.2, .025), rot=(0, dih, 0), seg=14, bevel=0)
        cyl(a, 'Eyespots_team', 'Team', .18, .03, on(s * 1.18, -.2, .04), rot=(0, dih, 0), seg=14, bevel=0)
        cyl(a, 'Hindwing_pips', 'Lens', .07, .03, on(s * .95, .72, .01), rot=(0, dih, 0), seg=8, bevel=0)
        # Wing tip lamps (nav lights sit here in air-life-view.js).
        box(a, 'Wing_tips', 'Steel', (.08, .12, .05), on(s * 1.78, -.36), rot=(0, dih, 0), bevel=0)
    # Under-slung beam gun: a short emitter barrel under the thorax with a green lens muzzle.
    box(a, 'Gun_pylon', 'Steel', (.12, .3, .16), (0, -.1, z - .28), bevel=.02)
    cyl(a, 'Barrel_beam', 'Steel', .06, .7, (0, -.38, z - .38), rot=FORWARD, seg=8)
    cyl(a, 'Barrel_beam_coil', A, .09, .2, (0, -.2, z - .38), rot=FORWARD, seg=8, bevel=0)
    cyl(a, 'Muzzle_lens', 'Lens', .075, .06, (0, -.76, z - .38), rot=FORWARD, seg=8, bevel=0)
    # Tucked legs (three pairs) under the thorax.
    for s in (-1, 1):
        for y in (-.25, -.05, .15):
            beam(a, 'Legs', 'Undercarriage', (s * .14, y, z - .14), (s * .26, y + .1, z - .4), .035)


# ----------------------------------------------------------------------------- halo
def halo(a):
    """Wardens Halo interceptor (front is -Y): a shield ring round a core, a lift fan inside, twin guns."""
    A = a.armor  # ArmorWardens
    a.pivot('hover', (0, 0, 0))
    z = .55
    # The shield ring: white duct, a team band on its top lip and a lit rim inside.
    a.part('Halo_ring', A).torus(1.08, .13, loc=(0, 0, z), seg=24, ring=5)
    a.part('Halo_band', 'Team').torus(1.08, .07, loc=(0, 0, z + .1), seg=24, ring=3)
    a.part('Halo_rimlight', 'TeamGlow').torus(.94, .025, loc=(0, 0, z + .02), seg=20, ring=3)
    # Four struts from the core to the ring, a small tower shield plate on each side of the ring.
    for k in range(4):
        ang = math.pi / 4 + k * R
        c, s = math.cos(ang), math.sin(ang)
        beam(a, 'Ring_struts', 'Steel', (c * .3, s * .3, z + .08), (c * .98, s * .98, z + .04), .07)
    for s in (-1, 1):
        box(a, 'Tower_shields', A, (.1, .5, .44), (s * 1.24, 0, z), bevel=.03, taper=(1, .8))
        box(a, 'Shield_stripes', 'Team', (.12, .14, .38), (s * 1.26, -.04, z), bevel=0)
        box(a, 'Ring_lamps', 'TeamGlow', (.06, .1, .06), (s * 1.31, 0, z + .26), bevel=0)
    # Core: a compact white pod with the Wardens eye in front, a team crest and a thruster under it.
    a.part('Core', A).sphere((.36, .42, .3), loc=(0, 0, z + .1), seg=12, rings=8)
    a.part('Core_band', 'Team').torus(.35, .04, loc=(0, 0, z + .12), seg=12, ring=3)
    eye(a, (0, -.4, z + .14), .09, seg=12)
    a.part('Crest', 'Team').prism([(.25, z + .32), (.0, z + .62), (-.24, z + .6), (-.3, z + .36)], .07, loc=(0, 0, 0),
                                  axis='X', bevel=.015, seg=1)
    cyl(a, 'Thruster', 'Steel', .2, .2, (0, 0, z - .22), seg=10, r2=.14)
    cyl(a, 'Thruster_light', 'TeamGlow', .12, .04, (0, 0, z - .33), seg=10, bevel=0)
    # Lift fan between the core and the ring: three blades on a hub (spins about Z, like the Hawk's fans).
    fan = a.pivot('spin_fan', (0, 0, z - .1))
    for i in range(3):
        box(a, 'Fan_blades', 'Steel', (1.8, .16, .025), (0, 0, 0), rot=(.2, 0, i * math.pi / 3), bevel=0, parent=fan)
    cyl(a, 'Fan_hub', 'Undercarriage', .12, .06, (0, 0, 0), seg=8, bevel=0, parent=fan)
    # Twin forward guns under the core, reaching past the ring's front.
    for s in (-1, 1):
        box(a, 'Gun_housings', A, (.14, .44, .14), (s * .22, -.42, z - .06), bevel=0)
        cyl(a, 'Barrel_guns', 'Steel', .035, .85, (s * .22, -.95, z - .06), rot=FORWARD, seg=8, bevel=0)
        cyl(a, 'Muzzle_guns', 'Undercarriage', .06, .1, (s * .22, -1.4, z - .06), rot=FORWARD, seg=8, bevel=0)


BUILDERS = {'lancer': lancer, 'bulwark': bulwark, 'moth': moth, 'halo': halo}
ARMOR = {'sunward': 'ArmorSunward', 'wardens': 'ArmorWardens', 'veil': 'ArmorVeil'}


# ----------------------------------------------------------------------------- pipeline
def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def settle(a):
    """Flyers: put the lowest point at z = 0 (the view adds the fly height)."""
    lo = math.inf
    for (name, mat, parent), shape in a.shapes.items():
        off = a.pivots[parent].location.z if parent else 0.0
        for v in shape.bm.verts:
            lo = min(lo, v.co.z + off)
    if abs(lo) < 1e-4:
        return
    for (name, mat, parent), shape in a.shapes.items():
        if parent is None:
            for v in shape.bm.verts:
                v.co.z -= lo
    for name, p in a.pivots.items():
        if name != 'hover':
            p.location.z -= lo


def detail(a, name, minimum):
    """Functional fasteners up to the family's surface detail (as generate_factions.py does)."""
    n = 0
    while count(a) < minimum:
        if name == 'lancer':
            x = (n % 4 - 1.5) * .22
            y = -.9 + (n // 4) * .3
            box(a, 'Deck_fixtures', 'Steel', (.08, .08, .05), (x, y, .85), bevel=.01)
        else:
            x = (n % 5 - 2) * .2
            z = 1.6 + (n // 5) * .14
            cyl(a, 'Hull_fasteners', 'Steel', .03, .04, (x * 1.1, -.36, z), rot=FORWARD, seg=6)
        n += 1
        if n > 120:
            raise RuntimeError('Detail budget did not converge: ' + name)


def muzzles(a):
    """World-space centres of Muzzle* parts (for visual-style.json weapons.<type>)."""
    out = []
    for ob in a.objects:
        if ob.name.startswith('Muzzle') and not ob.name.endswith('barbs'):
            mw = Matrix.Translation(ob.parent.location) if ob.parent else Matrix.Identity(4)
            pts = [mw @ v.co for v in ob.data.vertices]
            c = sum(pts, Vector()) / len(pts)
            out.append((ob.name, round(c.x, 2), round(-min(p.y for p in pts), 2), round(c.z, 2)))
    return out


def build_all(names=None, manifest=False, parts=False):
    root = kit.workspace('FrontierRoster')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in names or CATALOG:
        faction, kind, budget, minimum, flyer = CATALOG[name]
        a = Asset(name, root, ao_distance=.5 if flyer else .9, grime_height=.45 if flyer else .5, ao_samples=40,
                  ground=not flyer)
        a.armor = ARMOR[faction]
        BUILDERS[name](a)
        detail(a, name, minimum)
        if flyer:
            settle(a)
        tris = count(a)
        if parts or tris > budget:
            rows = sorted(((sum(len(f.verts) - 2 for f in s.bm.faces), k[0], k[1]) for k, s in a.shapes.items()), reverse=True)
            for n, part, mat in rows:
                print(f'ROSTER_PART {name} {n:5d} {part} ({mat})')
        if tris > budget:
            raise RuntimeError(f'{name}: {tris} triangles > {budget}')
        a.finish()
        a.export(OUT / f'{name}.glb')
        mats = sorted({ob.data.materials[0].name for ob in a.objects})
        report[name] = dict(triangles=a.triangles(), budget=budget, faction=faction, flyer=flyer, materials=mats,
                            muzzles=muzzles(a))
        print('ROSTER_ASSET', name, a.triangles(), len(mats), mats, flush=True)
        print('ROSTER_MUZZLE', name, report[name]['muzzles'], flush=True)
        # Free object names (hover, leg_L, Turret_pivot) before the next model, so none exports as ".001".
        kit.clear_workspace(root)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        fresh = {}
        for n, r in report.items():
            if r['flyer']:
                fresh[n] = {'name': n, 'file': f'{n}.glb', 'triangles': r['triangles'], 'air': True, 'budget': r['budget'],
                            'animation': 'Runtime spin_*/flicker_* pivots and hover bob; no baked clips',
                            'review': REVIEW, 'faction': r['faction'], 'roster': '2026-11-24'}
            else:
                fresh[n] = {'name': n, 'file': f'{n}.glb', 'triangles': r['triangles'], 'kind': 'unit', 'budget': r['budget'],
                            'review': REVIEW, 'animation': 'Runtime articulated parts; no baked clips',
                            'faction': r['faction'], 'roster': '2026-11-24'}
        data['assets'] = [fresh.pop(e['name'], e) for e in data['assets']] + list(fresh.values())
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(data, indent=2) + '\n')
    print('ROSTER_REPORT', json.dumps(report), flush=True)
    return report


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build_all([n for n in args if n in CATALOG] or None, manifest='--manifest' in args, parts='--report' in args)
