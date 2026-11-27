"""Close-up detail models (H3b, batch 1): the normal unit plus small parts that only read up close.

Headless:  blender --background --python tools/blender/generate_detail.py [-- ranger tank ...]

Each detail model is the normal model built by its own generator (generate_assets.py, generate_air.py)
with extra parts added on the same pivots, part names and materials before the kit finishes it. So the
silhouette, the team-colour slots, the leg/turret/barrel/rotor pivots and the rig names match the normal
model exactly and the runtime swaps one for the other (src/close-view.js). Nothing here changes the normal
GLBs: outputs go to public/models/detail/<type>.glb plus public/models/detail/manifest.json.

Detail added: visor frames and eye slits, rebreathers, straps, buckles and pouches, boot caps, weapon
rings, rails and vents, track cleats, rivets and hatches, wing ribs and lights, and team-colour stripes.
Only materials the kit already has (all but Team, TeamGlow, Glass bake into one shared material at
runtime), so a close unit costs the same number of draws per type as a far one.
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
import generate_assets as ga  # noqa: E402
import generate_air as air  # noqa: E402

OUT = HERE.parents[1] / 'public' / 'models' / 'detail'
R90 = math.pi / 2
FORWARD = (R90, 0, 0)   # cylinder axis along Y (front is -Y)
ACROSS = (0, R90, 0)    # cylinder axis along X
SIDES = ((-1, 'L'), (1, 'R'))
BATCH = ['ranger', 'vanguard', 'antitank', 'tank', 'worker', 'kite']
BUDGET = 9000  # triangles per detail model (the tank is the largest)


def rotated(points, rz, origin):
    """Points (x, y, z) turned about Z by rz, then moved to origin."""
    m = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(rz, 4, 'Z')
    return [tuple(m @ Vector(p)) for p in points]


# ----------------------------------------------------------------------------- infantry
def infantry_detail(a, kind):
    heavy = kind == 'vanguard'
    b = 1.1 if heavy else 1.0
    am = {'worker': 'ArmorWorker'}.get(kind, 'Armor')
    steel = a.part('Steel', 'Steel')
    gear = a.part('Gear', 'Undercarriage')
    glow = a.part('Lights', 'TeamGlow')
    team = a.part('Chest', 'Team')

    # Visor: a steel frame round the glowing strip, two brighter eye slits, a rebreather under it.
    for z in (2.068, 1.932):
        steel.box((.36, .03, .022), loc=(0, -.236, z), bevel=0)
    for s in (-1, 1):
        steel.box((.022, .03, .15), loc=(s * .17, -.236, 2.0), bevel=0)
        glow.box((.07, .02, .028), loc=(s * .075, -.243, 2.005), bevel=0)
        gear.cyl(.042, .09, loc=(s * .1, -.25, 1.86), rot=FORWARD, seg=8, bevel=0)
        steel.cyl(.03, .02, loc=(s * .1, -.3, 1.86), rot=FORWARD, seg=8, bevel=0)
        # Ear pieces with a rivet, and a row of rivets along the helmet rim.
        gear.cyl(.07, .05, loc=(s * .245, -.02, 1.98), rot=ACROSS, seg=10, bevel=.008, bseg=1)
        steel.cyl(.026, .02, loc=(s * .275, -.02, 1.98), rot=ACROSS, seg=6, bevel=0)
        steel.bolts([(s * .232, y, 1.9) for y in (-.12, .0, .12)], r=.018, h=.02, rot=ACROSS)
    gear.grille(.14, .07, loc=(0, -.235, 1.85), slats=3, depth=.02, thickness=.015)

    # Chest straps crossing the cuirass, a buckle, belt pouches and a steel buckle at the belt.
    for s in (-1, 1):
        gear.box((.055, .03, .48), loc=(s * .13 * b, -.245, 1.52), rot=(0, s * .42, 0), bevel=0)
        steel.box((.07, .03, .05), loc=(s * .2 * b, -.255, 1.68), bevel=0)
        gear.box((.1, .08, .1), loc=(s * .17 * b, -.205, 1.08), bevel=.015, seg=1)
        steel.box((.04, .02, .03), loc=(s * .17 * b, -.25, 1.11), bevel=0)
    steel.box((.12, .03, .07), loc=(0, -.2, 1.1), bevel=.008, seg=1)
    # Team-colour stripe on each pauldron and rivets along its top edge.
    for s in (-1, 1):
        team.box((.06, .5, .03), loc=(s * .62 * b, 0, 1.79), rot=(0, s * .32, 0), bevel=0)
        steel.bolts(rotated([(0, y, 0) for y in (-.16, 0, .16)], 0, (s * .45 * b, 0, 1.87)), r=.018, h=.02)
    # Backpack: two straps over the shoulders, side pouches and an antenna.
    for s in (-1, 1):
        gear.box((.06, .3, .03), loc=(s * .14 * b, .05, 1.77), bevel=0)
        if kind != 'medic':
            gear.box((.08, .1, .2), loc=(s * .3 * b, .32, 1.42), bevel=.015, seg=1)
    if kind in ('ranger', 'antitank', 'vanguard'):
        steel.cyl(.012, .5, loc=(-.2, .38, 1.95), seg=5, bevel=0)
        glow.box((.03, .03, .03), loc=(-.2, .38, 2.21), bevel=0)

    # Legs (on the hip pivots so they swing): a team stripe on each shin, knee rivets, boot toe caps.
    for s, side in SIDES:
        leg = f'leg_{side}'
        a.part('Shin_stripe', 'Team', leg).box((.2 * b, .02, .05), loc=(0, -.178, -.52), bevel=0)
        a.part('Shin_bolts', 'Steel', leg).bolts([(x * b, -.178, -.68) for x in (-.07, .07)], r=.018, h=.02, rot=FORWARD)
        a.part('Boot_cap', 'Steel', leg).box((.22 * b, .05, .05), loc=(0, -.3, -.86), bevel=.01, seg=1)
        a.part('Boot_strap', 'Undercarriage', leg).box((.29 * b, .2, .03), loc=(0, -.05, -.74), bevel=0)

    if kind == 'ranger':
        # Rifle: scope rings and caps, a rail with bolts, a slotted muzzle brake, a folded bipod, a sling.
        for y in (-.32, -.6):
            steel.torus(.072, .012, loc=(.12, y, 1.6), rot=FORWARD, seg=10, ring=3)
        gear.cyl(.07, .03, loc=(.12, -.72, 1.6), rot=FORWARD, seg=10, bevel=0)
        steel.box((.04, .5, .03), loc=(.12, -.55, 1.5), bevel=0)
        steel.bolts([(.12, y, 1.52) for y in (-.4, -.55, -.7)], r=.014, h=.015)
        for y in (-1.83, -1.89):
            a.part('Rifle', 'Armor').box((.16, .02, .05), loc=(.12, y, 1.42), bevel=0)
        for s in (-1, 1):
            steel.limb((.12 + s * .03, -1.05, 1.36), (.12 + s * .05, -.75, 1.32), .02, .02, bevel=0, seg=1)
        gear.box((.025, .9, .025), loc=(.25, -.35, 1.3), rot=(.25, 0, 0), bevel=0)
        # Cape: a team hem stripe and a clasp.
        a.part('Cape', 'Cape').box((.08, .05, .1), loc=(0, -.12, 1.86), bevel=0)
        team.box((.92, .03, .05), loc=(0, .19, 1.89), rot=(-.12, 0, 0), bevel=0)
        steel.cyl(.035, .03, loc=(0, -.12, 1.9), rot=FORWARD, seg=8, bevel=0)
    elif heavy:
        # Shield: a steel boss, rivets round the rim, a team chevron. The shield is turned .28 about Z.
        origin = (-.62, -.49, 1.2)
        steel.sphere(.09, loc=rotated([(0, -.02, 0)], .28, origin)[0], seg=10, rings=5)
        rim = [(-.36, -.02, -.4), (-.36, -.02, .4), (.36, -.02, .4), (.36, -.02, -.36), (0, -.02, .56), (0, -.02, -.6)]
        steel.bolts(rotated(rim, .28, origin), r=.025, h=.025, rot=(R90, 0, .28))
        for s in (-1, 1):
            team.box((.32, .025, .06), loc=rotated([(s * .12, -.03, .28)], .28, origin)[0], rot=(0, s * .5, .28), bevel=0)
    elif kind == 'worker':
        # Tool: a hose from the pack to the drill, a hazard band; cargo frame rivets; helmet lamp.
        gear.tube([(.3, .3, 1.5), (.48, .1, 1.35), (.46, -.25, 1.3), (.42, -.4, 1.27)], .028, seg=6)
        a.part('Hazard_band', 'Hazard').box((.22, .04, .22), loc=(.42, -.6, 1.27), bevel=.01, seg=1)
        steel.bolts([(s * .24, .44, z) for s in (-1, 1) for z in (1.3, 1.62, 1.95)], r=.02, h=.02, rot=FORWARD)
        a.part('Cargo', 'Alloy').box((.06, .06, .06), loc=(0, -.22, 2.15), bevel=0)
        team.box((.5, .03, .06), loc=(0, .44, 1.62), bevel=0)
    elif kind == 'antitank':
        # Launcher: steel rings, a hazard band, a grip and trigger, a rear vent and a sight hood; rocket fins.
        for y in (-.85, -.3, .25):
            steel.torus(.165, .015, loc=(.42, y, 1.83), rot=FORWARD, seg=14, ring=3)
        a.part('Hazard_band', 'Hazard').cyl(.163, .1, loc=(.42, -.62, 1.83), rot=FORWARD, seg=14, bevel=0)
        gear.box((.06, .08, .16), loc=(.42, -.12, 1.62), rot=(.2, 0, 0), bevel=.01, seg=1)
        gear.grille(.2, .12, loc=(.42, .66, 1.83), rot=(0, 0, math.pi), slats=3, depth=.03, thickness=.02)
        gear.box((.12, .08, .05), loc=(.25, -.6, 2.05), bevel=0)
        team.box((.04, .9, .05), loc=(.42, -.3, 2.0), bevel=0)
        for x in (-.15, .15):
            for k in range(3):
                ang = k * math.tau / 3
                steel.box((.012, .1, .1), loc=(x + math.cos(ang) * .09, .47 + math.sin(ang) * .09, 1.34),
                          rot=(0, 0, ang), bevel=0)


# ----------------------------------------------------------------------------- tank
def tank_detail(a):
    steel = a.part('Steel', 'Steel')
    dark = a.part('Deck', 'Undercarriage')
    team = a.part('Hull', 'Team')
    # Track cleats along the bottom run and grousers on the outer face of each belt.
    belt = a.part('Tracks', 'Undercarriage')
    for s in (-1, 1):
        x = s * .95
        for i in range(13):
            y = -1.2 + i * .2
            belt.box((.5, .07, .04), loc=(x, y, .065), bevel=0)
        steel.bolts([(s * 1.27, y, .5) for y in (-1.3, 1.3)], r=.05, h=.04, rot=ACROSS)
    # Hull: rivets round the upper deck, rear exhaust grilles, tow hooks, headlight guards, a team stripe.
    steel.bolts([(x, y, 1.1) for x in (-1.05, 1.05) for y in (-1.2, 0, 1.2)], r=.035, h=.03)
    steel.bolts([(x, -1.42, .88) for x in (-.9, -.3, .3, .9)], r=.035, h=.03, rot=FORWARD)
    for s in (-1, 1):
        dark.grille(.5, .3, loc=(s * .55, 1.47, .82), rot=(0, 0, math.pi), slats=3, depth=.04, thickness=.03)
        steel.torus(.07, .02, loc=(s * .8, -1.56, .62), rot=ACROSS, seg=8, ring=3)
        for dx in (-.11, .11):
            steel.box((.02, .06, .12), loc=(s * .45 + dx, -1.55, .78), bevel=0)
        steel.box((.24, .06, .02), loc=(s * .45, -1.55, .85), bevel=0)
        team.box((.06, 2.4, .08), loc=(s * 1.31, -.05, 1.0), bevel=0)
    steel.tube([(-.8, -1.0, 1.12), (-.95, 0, 1.14), (-.8, 1.0, 1.12)], .025, seg=5)   # tow cable
    steel.tube([(.8, -1.0, 1.12), (.95, 0, 1.14), (.8, 1.0, 1.12)], .025, seg=5)
    # Turret (Turret_head parts turn with it): commander hatch with handles, periscopes, rivets,
    # stowage boxes, a team stripe band and a second antenna light.
    thatch = a.part('Turret_head', 'Armor')
    tsteel = a.part('Turret_head', 'Steel')
    tteam = a.part('Turret_head', 'Team')
    tdark = a.part('Turret_head', 'Undercarriage')
    thatch.cyl(.2, .05, loc=(-.32, .4, 1.85), seg=14, bevel=.01, bseg=1)
    tsteel.torus(.1, .015, loc=(-.32, .4, 1.89), seg=10, ring=3)
    for s in (-1, 1):
        tsteel.box((.03, .14, .03), loc=(-.32 + s * .1, .4, 1.9), bevel=0)
    for x in (-.1, .1):
        tdark.box((.08, .06, .07), loc=(x, -.5, 1.86), bevel=0)
    tsteel.bolts([(x, -.7, 1.84) for x in (-.4, 0, .4)], r=.03, h=.025)
    tsteel.bolts([(s * .83, y, 1.62) for s in (-1, 1) for y in (-.2, .2, .6)], r=.03, h=.025, rot=ACROSS)
    for s in (-1, 1):
        tdark.box((.3, .5, .22), loc=(s * .62, 1.12, 1.78), bevel=.02, seg=1)
        tsteel.box((.32, .03, .03), loc=(s * .62, .86, 1.85), bevel=0)
    tteam.box((1.24, .06, .1), loc=(0, .82, 1.6), bevel=0)
    tsteel.cyl(.04, .1, loc=(-.5, .85, 1.86), seg=8, bevel=0)
    # Main cannon: a bore evacuator, thermal-sleeve bands and slots in the muzzle brake.
    cannon = a.part('Main_cannon', 'Steel')
    cannon.cyl(.15, .3, loc=(0, -2.0, 1.7), rot=FORWARD, seg=14, bevel=.02, bseg=1)
    for y in (-2.35, -1.75):
        cannon.torus(.125, .012, loc=(0, y, 1.7), rot=FORWARD, seg=12, ring=3)
    brake = a.part('Muzzle_brake', 'Undercarriage')
    for y in (-2.7, -2.82):
        for s in (-1, 1):
            brake.box((.04, .05, .2), loc=(s * .185, y, 1.7), bevel=0)


# ----------------------------------------------------------------------------- kite
def kite_detail(a):
    steel = a.part('Spars', 'Steel')
    # Wing ribs from the spine out to the sail edges, a rib cap at the centre.
    for p in ((.6, -.05), (-.6, -.05), (.3, -.5), (-.3, -.5), (.3, .4), (-.3, .4)):
        air.beam(a, 'Sail_ribs', 'Steel', (0, p[1] * .4, 1.045), (p[0], p[1], 1.045), .022)
    a.part('Sail_ribs', 'Steel').cyl(.06, .03, loc=(0, -.05, 1.06), seg=10, bevel=0)
    # Wing-tip and nose lights (team glow), a pod antenna with a light, pod panel lines.
    for s in (-1, 1):
        air.box(a, 'Sail_beacons', 'TeamGlow', (.06, .06, .03), (s * .74, -.05, 1.06), bevel=0)
    air.box(a, 'Sail_beacons', 'TeamGlow', (.05, .05, .03), (0, -.8, 1.06), bevel=0)
    steel.cyl(.01, .3, loc=(0, .3, .95), seg=5, bevel=0)
    air.box(a, 'Sail_beacons', 'TeamGlow', (.03, .03, .03), (0, .3, 1.11), bevel=0)
    for s in (-1, 1):
        a.part('Pod', 'Armor').box((.02, .22, .12), loc=(s * .355, .02, .62), bevel=0)
        a.part('Pod_bolts', 'Steel').bolts([(s * .37, y, .62) for y in (-.12, .16)], r=.018, h=.02, rot=ACROSS)
    # Team stripe along the pod spine and hazard tips on every rotor blade (on the spin pivots).
    a.part('Pod_stripe', 'Team').box((.06, .6, .03), loc=(0, .05, .925), bevel=0)
    for s, side in SIDES:
        p = f'spin_rotor_{side}'
        for i in range(2):
            ang = i * math.pi / 2
            for e in (-1, 1):
                c, d = math.cos(ang) * e * .34, math.sin(ang) * e * .34
                air.box(a, 'Rotor_tips', 'Hazard', (.06, .1, .03), (c, d, 0), rot=(.16, 0, ang), bevel=0, parent=p)
        air.cyl(a, 'Rotor_hub', 'Steel', .03, .04, (0, 0, .07), seg=6, bevel=0, parent=p)


DETAILS = {**{k: (lambda a, k=k: infantry_detail(a, k)) for k in ('ranger', 'vanguard', 'antitank', 'worker')},
           'tank': tank_detail, 'kite': kite_detail}


# ----------------------------------------------------------------------------- pipeline
def build_ground(kind, root):
    """generate_assets.build with the detail parts added before finish (same AO settings)."""
    unit = kind in ga.UNITS
    infantry_unit = kind in ga.GRIPS
    a = kit.Asset(kind, root, ao_distance=.7 if infantry_unit else .5 if unit else 1.6,
                  grime_height=.45 if unit else .9)
    ga.BUILDERS[kind](a)
    base = sum(len(f.verts) - 2 for s in a.shapes.values() for f in s.bm.faces)
    DETAILS[kind](a)
    a.finish()
    if kind == 'vanguard':
        shoulder, elbow = a.pivots['SwordArm'], a.pivots['SwordElbow']
        elbow.location -= shoulder.location
        elbow.parent = shoulder
    return a, base


def build_flyer(kind, root):
    a = kit.Asset(kind, root, ao_distance=.5, grime_height=.45, ao_samples=40, ground=False)
    air.BUILDERS[kind](a)
    base = air.count(a)
    DETAILS[kind](a)
    a.finish()
    return a, base


def build_all(kinds=None):
    root = kit.workspace('FrontierDetail')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / 'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    manifest.update({'generator': 'Blender Python (frontier_kit + generate_detail.py)', 'units': 'meters',
                     'provenance': 'Original assets generated for this repository; no third-party model sources.',
                     'note': 'Close-up detail models, loaded only by the close view (src/close-view.js).'})
    entries = {e['name']: e for e in manifest.get('assets', [])}
    for kind in kinds or BATCH:
        a, base = (build_flyer if kind in air.BUILDERS else build_ground)(kind, root)
        tris = a.triangles()
        if tris > BUDGET:
            raise RuntimeError(f'{kind}: {tris} triangles > {BUDGET}')
        a.export(OUT / f'{kind}.glb')
        entries[kind] = {'name': kind, 'file': f'{kind}.glb', 'triangles': tris, 'base_triangles': base,
                         'bytes': (OUT / f'{kind}.glb').stat().st_size,
                         'review': 'pending owner review (H3b batch 1)'}
        print('DETAIL_ASSET', kind, base, tris, entries[kind]['bytes'], flush=True)
        kit.clear_workspace(root)   # free the pivot names (`hover`, `leg_L`) for the next model
    manifest['assets'] = [entries[k] for k in sorted(entries)]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    result = build_all([n for n in args if n in DETAILS] or None)
    print('DETAIL_COMPLETE', json.dumps([(e['name'], e['triangles']) for e in result['assets']]))
