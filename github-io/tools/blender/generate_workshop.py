"""Meridian Field workshop (AAA round 2, W1-A). Headless Blender 5.2.5 LTS; no external assets.

  blender -b --python tools/blender/generate_workshop.py -- [--manifest]

Writes public/models/workshop.glb. With --manifest it also records the model in
public/models/manifest.json (kind building, its triangle budget, review pending).

A crane-arm hangar with an open bay: a team-painted arched roof over gunmetal walls, an amber
crane jib with a hanging parts crate over the apron, hazard stripes, a glowing bay light and a
beacon mast. It follows the runtime contract of frontier_kit.py (one attribute set with baked
COLOR_0, Team paint, single-sided materials, Blender -Y as the front) and uses five materials
(Concrete, Armor, Team, Hazard, TeamGlow), as many as the Wardens' pylon, the fewest of any building.
Budget: 4,000 triangles (docs/ASSET_PIPELINE.md, structures 2.1k to 4.7k).
"""
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import frontier_kit as kit
from frontier_kit import Asset, chamfered

ROOT = HERE.parents[1]
OUT = ROOT / 'public/models'
R = math.pi / 2
BUDGET = 4000
Z0 = .18  # top of the platform


def box(a, name, mat, size, loc, rot=(0, 0, 0), bevel=.035):
    return a.part(name, mat).box(size, loc=loc, rot=rot, bevel=bevel, seg=1)


def cyl(a, name, mat, r, depth, loc, rot=(0, 0, 0), seg=12):
    return a.part(name, mat).cyl(r, depth, loc=loc, rot=rot, seg=seg, bevel=.015, bseg=1)


def beam(a, name, mat, start, end, width=.1):
    return a.part(name, mat).limb(start, end, width, width, bevel=.015, seg=1)


def arch(half, rise, steps=6):
    """Roof section (x, z): flat underside, parabolic top."""
    top = [(-half + 2 * half * i / steps, rise * (1 - ((-half + 2 * half * i / steps) / half) ** 2)) for i in range(steps + 1)]
    return top


def workshop(a):
    # --- apron: a chamfered concrete slab with amber kerb stripes and team landing lights
    a.part('Platform', 'Concrete').prism(chamfered(4.9, 4.5, .45), .18, loc=(0, 0, .09), axis='Z', bevel=.025, seg=1)
    for x in (-2.12, 2.12):
        box(a, 'Landing_lights', 'TeamGlow', (.2, .12, .08), (x, -1.95, Z0 + .03), bevel=.015)
    for i in range(5):
        x = -1.0 + i * .5
        box(a, 'Apron_stripes', 'Hazard', (.26, .06, .02), (x, -1.72, Z0 + .01), rot=(0, 0, .6), bevel=0)

    # --- hangar shell: back and side walls, two front piers, a team-painted lintel over the open bay
    box(a, 'Back_wall', 'Armor', (3.9, .24, 2.1), (0, 2.0, Z0 + 1.05), bevel=.04)
    for sign in (-1, 1):
        box(a, 'Side_walls', 'Armor', (.24, 2.4, 2.1), (sign * 1.83, .85, Z0 + 1.05), bevel=.04)
        box(a, 'Front_piers', 'Armor', (.76, .34, 2.1), (sign * 1.36, -.35, Z0 + 1.05), bevel=.04)
        # team trim: a vertical stripe up the pier, a band round the side wall, amber footing
        box(a, 'Pier_trim', 'Team', (.2, .05, 1.7), (sign * 1.4, -.54, Z0 + 1.05), bevel=.01)
        box(a, 'Wall_band', 'Team', (.04, 2.1, .22), (sign * 1.97, .85, Z0 + 1.3), bevel=.01)
        box(a, 'Wall_footing', 'Hazard', (.05, 2.4, .12), (sign * 1.96, .85, Z0 + .1), bevel=.01)
        for y in (-.1, .6, 1.3):
            box(a, 'Wall_seams', 'Armor', (.05, .05, 1.8), (sign * 1.97, y, Z0 + 1.05), bevel=0)
        # R3-J: lit side windows between the seams (Window* glows at night, R3-D).
        for y in (.25, .95):
            box(a, 'Windows', 'Window', (.05, .42, .32), (sign * 1.975, y, Z0 + 1.62), bevel=.01)
    box(a, 'Bay_floor', 'Armor', (2.0, 2.2, .04), (0, .85, Z0 + .02), bevel=0)
    box(a, 'Lintel', 'Team', (2.2, .44, .5), (0, -.4, Z0 + 1.85), bevel=.05)
    for sign in (-1, 1):
        box(a, 'Door_rails', 'Armor', (.1, .1, 1.6), (sign * .93, -.5, Z0 + .85), bevel=.015)
    box(a, 'Bay_light', 'TeamGlow', (1.7, .09, .09), (0, -.62, Z0 + 1.56), bevel=.015)
    box(a, 'Floor_light', 'TeamGlow', (1.4, .07, .035), (0, -.45, Z0 + .06), bevel=.01)
    for x in (-1.0, 1.0):
        cyl(a, 'Bay_lamps', 'TeamGlow', .075, .14, (x * 1.0, -.66, Z0 + 1.38), rot=(R, 0, 0), seg=10)
    # inside the bay: a gun rack and a bench, so the dark opening reads as a workshop
    box(a, 'Gun_rack', 'Armor', (1.5, .16, .2), (0, 1.8, Z0 + 1.3), bevel=.02)
    for x in (-.5, -.15, .2, .55):
        cyl(a, 'Rack_barrels', 'Armor', .045, .9, (x, 1.74, Z0 + 1.0), rot=(0, 0, 0), seg=8)
    box(a, 'Work_bench', 'Hazard', (1.3, .5, .1), (0, 1.35, Z0 + .52), bevel=.02)
    for x in (-.55, .55):
        box(a, 'Bench_legs', 'Armor', (.1, .4, .46), (x, 1.35, Z0 + .26), bevel=.015)

    # --- roof: arched team-painted shell with gunmetal ribs, an amber lip and a vent
    half, rise, y0, depth = 2.05, .62, .62, 3.15
    a.part('Roof', 'Team').prism(arch(half, rise), depth, loc=(0, y0, Z0 + 2.1), axis='Y', bevel=.03, seg=1)
    for y in (-.7, .0, .7, 1.4, 2.1):
        a.part('Roof_ribs', 'Armor').prism(arch(half + .05, rise + .05), .12, loc=(0, y, Z0 + 2.1), axis='Y', bevel=.015, seg=1)
    box(a, 'Roof_lip', 'Hazard', (4.1, .1, .1), (0, -.95, Z0 + 2.15), bevel=.015)
    box(a, 'Vent', 'Armor', (.8, .7, .22), (-.95, 1.5, Z0 + 2.1 + rise + .1), bevel=.03)
    box(a, 'Vent_cap', 'Team', (.9, .8, .08), (-.95, 1.5, Z0 + 2.1 + rise + .24), bevel=.02)
    # beacon mast on the back corner
    cyl(a, 'Beacon_mast', 'Armor', .05, 1.15, (1.25, 1.75, Z0 + 2.1 + rise * .3 + .55), seg=8)
    a.part('Beacon', 'TeamGlow').sphere(.12, loc=(1.25, 1.75, Z0 + 2.1 + rise * .3 + 1.15), seg=10, rings=6)
    # R3-F Meridian accent: a tall antenna array on the roof crown (reads from the game camera).
    top = Z0 + 2.1 + rise
    cyl(a, 'Antenna_mast', 'Armor', .055, 2.0, (.35, .9, top + 1.0), seg=8)
    for z, w in ((top + 1.0, .9), (top + 1.5, .6)):
        box(a, 'Antenna_bars', 'Armor', (w, .06, .06), (.35, .9, z), bevel=0)
    box(a, 'Antenna_tip', 'TeamGlow', (.1, .1, .1), (.35, .9, top + 2.02), bevel=0)

    # --- crane: a gantry post outside the left wall, an amber jib reaching over the apron, a hanging crate
    px, py = -2.3, -1.15
    box(a, 'Crane_base', 'Hazard', (.74, .74, .14), (px, py, Z0 + .07), bevel=.02)
    box(a, 'Crane_post', 'Armor', (.28, .28, 3.55), (px, py, Z0 + 1.85), bevel=.03)
    box(a, 'Crane_collar', 'Hazard', (.4, .4, .16), (px, py, Z0 + 3.58), bevel=.02)
    box(a, 'Crane_jib', 'Hazard', (3.9, .26, .28), (px + 1.5, py, Z0 + 3.78), bevel=.03)
    beam(a, 'Crane_strut', 'Armor', (px, py, Z0 + 2.6), (px + 1.5, py, Z0 + 3.66), .13)
    box(a, 'Counterweight', 'Armor', (.62, .5, .5), (px - .38, py, Z0 + 3.45), bevel=.04)
    box(a, 'Counterweight_band', 'Hazard', (.66, .54, .1), (px - .38, py, Z0 + 3.45), bevel=.01)
    tx = .38
    box(a, 'Trolley', 'Armor', (.5, .4, .22), (tx, py, Z0 + 3.5), bevel=.03)
    beam(a, 'Cable', 'Armor', (tx, py, Z0 + 3.4), (tx, py, Z0 + 2.2), .05)
    box(a, 'Hook_block', 'Hazard', (.24, .24, .3), (tx, py, Z0 + 2.1), bevel=.03)
    a.part('Hook', 'Armor').torus(.11, .035, loc=(tx, py, Z0 + 1.88), rot=(R, 0, 0), seg=12, ring=6)
    # the hanging load: a team-painted parts crate in an amber sling
    box(a, 'Parts_crate', 'Team', (.62, .5, .42), (tx, py, Z0 + 1.55), bevel=.05)
    box(a, 'Crate_straps', 'Armor', (.66, .1, .46), (tx, py, Z0 + 1.55), bevel=.015)
    for sign in (-1, 1):
        beam(a, 'Sling', 'Hazard', (tx + sign * .26, py, Z0 + 1.78), (tx, py, Z0 + 1.98), .035)

    # --- yard clutter on the apron: crates and fuel drums
    for i, (x, y, w) in enumerate([(1.55, -1.75, .56), (2.05, -1.7, .46), (1.75, -1.7, .4)]):
        z = Z0 + w / 2 + (0 if i < 2 else .56)
        box(a, 'Crates', 'Armor', (w, w, w * .8), (x, y, z - .05 * i * 0), bevel=.03)
        box(a, 'Crate_lids', 'Hazard', (w + .02, w + .02, .06), (x, y, z + w * .4), bevel=.01)
    for x, y in ((-1.4, -1.9), (-1.0, -1.9)):
        cyl(a, 'Fuel_drums', 'Team', .24, .6, (x, y, Z0 + .3), seg=12)
        cyl(a, 'Drum_bands', 'Armor', .255, .06, (x, y, Z0 + .3), seg=12)


def count(a):
    return sum(len(f.verts) - 2 for shape in a.shapes.values() for f in shape.bm.faces)


def build(manifest=False):
    root = kit.workspace('FrontierWorkshop')
    kit.clear_workspace(root)
    OUT.mkdir(parents=True, exist_ok=True)
    a = Asset('workshop', root, ao_distance=1, ao_samples=40)
    workshop(a)
    tris = count(a)
    if tris > BUDGET:
        raise RuntimeError(f'workshop: {tris} triangles > {BUDGET}')
    a.finish()
    a.export(OUT / 'workshop.glb')
    print('WORKSHOP_ASSET', a.triangles(), (OUT / 'workshop.glb').stat().st_size, flush=True)
    if manifest:
        path = OUT / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['assets'] = [e for e in data['assets'] if e['name'] != 'workshop'] + [
            {'name': 'workshop', 'file': 'workshop.glb', 'triangles': a.triangles(), 'kind': 'building', 'budget': BUDGET,
             'review': 'pending owner review (round 3)',
             'animation': 'Runtime articulated parts; no baked clips'}]
        path.write_bytes((json.dumps(data, indent=2) + '\n').encode('utf-8'))  # LF on Windows too


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    build(manifest='--manifest' in args)
