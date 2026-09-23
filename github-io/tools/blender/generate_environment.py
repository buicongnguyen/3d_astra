"""Generate Frontier Command scenery: rocks, resource crystals, foliage, crates and bridges.

Headless:  blender --background --python tools/blender/generate_environment.py
Live, through MCP for Blender:
    import generate_environment; generate_environment.build_environment(export=True)

Every asset is a root empty named asset_<name> at the origin; src/environment-view.js and
src/view.js look them up by that name, merge each one by material and instance it.
Rock is exported near-white because the runtime tints it with each map's rock colour.
"""
import json
import math
import random
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
SOURCE = ROOT / 'assets' / 'source'
TAU = math.tau


def asset(root, name, **kw):
    a = Asset(name, root, **kw)
    return a, a.pivot(f'asset_{name}', (0, 0, 0))


def rocks(root):
    """Three unit-radius boulder variants; the view scales them to each rock obstacle."""
    built = []
    for letter, seed, size in (('a', 1.3, (1.0, .9, .62)), ('b', 4.7, (.95, .82, .78)), ('c', 8.2, (.9, 1.0, .5))):
        a, p = asset(root, f'rock_{letter}', ao_distance=.9, grime_height=.3)
        rock = a.part('Rock', 'Rock', p, flat=True)
        rock.ico(size, loc=(0, 0, size[2] * .5), sub=3, jitter=.3, seed=seed)
        rock.ico((.46, .4, .32), loc=(.78, .38, .14), sub=2, jitter=.32, seed=seed + 2)
        rock.ico((.32, .28, .22), loc=(-.7, -.52, .08), sub=2, jitter=.32, seed=seed + 5)
        built.append(a.finish())
    return built


def crystals(root, kind):
    """Deposit cluster about 2.6 wide: a tall central spire and leaning satellites on a rock bed."""
    a, p = asset(root, f'crystal_{kind}', ao_distance=.6, grime_height=.25)
    crystal = a.part('Crystal', 'CrystalAlloy' if kind == 'alloy' else 'CrystalEnergy', p, flat=True)
    rng = random.Random(7 if kind == 'alloy' else 11)
    count = 8 if kind == 'alloy' else 7
    for i in range(count):
        central = i == 0
        ang = i / count * TAU + rng.uniform(-.3, .3)
        dist = 0 if central else rng.uniform(.5, 1.0)
        h = (2.2 if kind == 'alloy' else 2.4) if central else rng.uniform(.8, 1.55)
        r = .34 if central else rng.uniform(.14, .26)
        tilt = rng.uniform(0, .12) if central else rng.uniform(.3, .6)
        profile = [(r * .8, -.25), (r, h * .12), (r * .88, h * .7), (0, h)]
        if kind == 'energy':  # energy shards are slimmer with a longer point
            profile = [(r * .75, -.25), (r * .9, h * .1), (r * .7, h * .55), (0, h)]
        crystal.lathe(profile, loc=(math.cos(ang) * dist, math.sin(ang) * dist, 0),
                      rot=(-tilt, 0, ang - math.pi / 2), seg=6 if kind == 'alloy' else 5)
    bed = a.part('Rock', 'Rock', p, flat=True)
    for i in range(5):
        ang = i / 5 * TAU + .4
        bed.ico((.42, .36, .2), loc=(math.cos(ang) * .95, math.sin(ang) * .95, .05), sub=2, jitter=.35,
                seed=i * 1.9 + (0 if kind == 'alloy' else 3))
    return a.finish()


def tree(root):
    a, p = asset(root, 'tree', ao_distance=1.2, grime_height=.6)
    a.part('Trunk', 'Bark', p).cyl(.2, 2.6, loc=(0, 0, 1.3), r2=.08, seg=8, bevel=0)
    for i in range(4):
        mat = 'Foliage' if i % 2 == 0 else 'FoliageLight'
        a.part('Crown', mat, p).tier(1.4 - i * .26, 1.45 - i * .12, loc=(0, 0, 1.95 + i * .64), seg=12,
                                     droop=.16 - i * .02, seed=i * 1.7)
    return a.finish()


def bush(root):
    a, p = asset(root, 'bush', ao_distance=.7, grime_height=.3)
    for i, (x, y, r) in enumerate(((-.38, .05, .62), (.35, .12, .56), (0, -.28, .5), (.05, .3, .44))):
        a.part('Leaves', 'Foliage' if i % 2 == 0 else 'FoliageLight', p).ico(
            (r, r * .95, r * .78), loc=(x, y, r * .62), sub=2, jitter=.2, seed=i * 2.3)
    return a.finish()


def reed(root):
    a, p = asset(root, 'reed', ao_distance=.4, grime_height=.2)
    rng = random.Random(3)
    blades = a.part('Blades', 'FoliageLight', p)
    heads = a.part('Heads', 'Bark', p)
    for i in range(8):
        x, y = rng.uniform(-.3, .3), rng.uniform(-.25, .25)
        h = rng.uniform(.8, 1.25)
        lean = (x * .5 + rng.uniform(-.15, .15), y * .5 + rng.uniform(-.15, .15))
        blades.limb((x, y, 0), (x + lean[0], y + lean[1], h), .05, .025, bevel=0, taper=(.2, .2))
        if i % 3 == 0:
            heads.cyl(.035, .16, loc=(x + lean[0] * .85, y + lean[1] * .85, h * .85), seg=6, bevel=0)
    return a.finish()


def crate(root):
    a, p = asset(root, 'crate', ao_distance=.6, grime_height=.3)
    a.part('Body', 'Crate', p).box((1.05, .85, .95), loc=(0, 0, .48), bevel=.05)
    steel = a.part('Frame', 'Steel', p)
    for x in (-.5, .5):
        for y in (-.4, .4):
            steel.box((.1, .1, .99), loc=(x, y, .5), bevel=.02, seg=1)
    a.part('Band', 'Hazard', p).box((1.08, .88, .12), loc=(0, 0, .78), bevel=.02, seg=1)
    ribs = a.part('Ribs', 'Undercarriage', p)
    for y in (-.2, .2):
        ribs.box((1.08, .06, .6), loc=(0, y, .4), bevel=.01, seg=1)
    return a.finish()


def bridge(root):
    """10 x 10 crossing deck with Warren trusses along both edges (Blender Y spans the river)."""
    a, p = asset(root, 'bridge', ao_distance=1.2, grime_height=.2, lattice=1.5)
    a.part('Deck', 'Concrete', p).box((10, 10, .3), loc=(0, 0, -.08), bevel=.04)
    seams = a.part('Seams', 'Undercarriage', p)
    for i in range(5):
        seams.box((9.4, .06, .012), loc=(0, -4 + i * 2, .075), bevel=0)
    armor = a.part('Girders', 'Armor', p)
    steel = a.part('Truss', 'Steel', p)
    for x in (-4.9, 4.9):
        armor.box((.42, 10.2, .55), loc=(x, 0, .05), bevel=.04)
        steel.box((.18, 9.7, .18), loc=(x, 0, 1.15), bevel=.03, seg=1)
        posts = [-4.8 + i * 2.4 for i in range(5)]
        for y in posts:
            steel.limb((x, y, .3), (x, y, 1.1), .14, .14, bevel=.02, seg=1)
        for y0, y1 in zip(posts, posts[1:]):
            steel.limb((x, y0, .32), (x, y1, 1.1), .1, .1, bevel=.015, seg=1)
        a.part('Lamps', 'Lamp', p).box((.14, .14, .14), loc=(x, -4.85, 1.32), bevel=.03, seg=1)
        a.part('Lamps', 'Lamp', p).box((.14, .14, .14), loc=(x, 4.85, 1.32), bevel=.03, seg=1)
    abut = a.part('Deck', 'Concrete', p)
    for y in (-4.9, 4.9):
        abut.box((10.8, .9, .9), loc=(0, y, -.35), bevel=.05)
    return a.finish()


BUILDERS = [rocks, lambda r: crystals(r, 'alloy'), lambda r: crystals(r, 'energy'), tree, bush, reed, crate, bridge]


def build_environment(export=True):
    root = kit.workspace()
    kit.clear_workspace(root, keep=[c.name for c in root.children if c.name != 'frontier_environment'])
    env = bpy.data.collections.new('frontier_environment')
    root.children.link(env)
    built = []
    for fn in BUILDERS:
        result = fn(env)
        built += result if isinstance(result, list) else [result]
    manifest = {'generator': 'Blender Python (frontier_kit)',
                'provenance': 'Original procedural scenery, no external assets', 'assets': []}
    for a in built:
        manifest['assets'].append({'name': f'asset_{a.name}', 'triangles': a.triangles()})
    if export:
        OUT.mkdir(parents=True, exist_ok=True)
        kit.export_collection(env, OUT / 'environment.glb')
        (OUT / 'environment-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    for i, a in enumerate(built):
        a.offset(-14 - (i % 4) * 7, (i // 4) * 7)
    return built, manifest


if __name__ == '__main__':
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    _, result = build_environment()
    SOURCE.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'riverlands-library.blend'))
    print('ENVIRONMENT_COMPLETE', json.dumps(result))
