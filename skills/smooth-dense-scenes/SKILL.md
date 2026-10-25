---
name: smooth-dense-scenes
description: Profile and optimize Three.js/WebGL games with dense worlds, many units, lag, stutter, heat, or battery drain. Measure draws including shadows, CPU work, matrix updates, GPU buffer traffic, frame pacing, loading, and memory; apply instancing, material sharing, transform caching, selective uploads, culling, or adaptive quality while preserving visuals and gameplay. Use for browser-game performance reviews or requests for bigger, denser scenes. Individual asset authoring and unrelated application work are outside this skill.
---

# Smooth dense scenes

Dense scenes can spend time submitting draws, updating transforms, uploading unchanged
buffers, shading pixels, or searching obstacles. The limiting cost varies with the device
and scene. Preserve the intended artwork and gameplay while removing measured waste.

Work in this order: **measure → find the real cost → apply the matching technique →
measure again → confirm the picture did not change.** Don't guess. In one game the
scenery cost 22 draw calls, the player character 23, and the **shadow pass 239**.

For the loop, feel, controls, camera, saves and tests, `web-game-craft` can help if installed;
for individual asset authoring, `lightweight-game-objects` can help if installed. Neither
is required to apply this performance workflow.

Core recipes are in `references/three-recipes.md` (read only the section you need).
An adaptive quality governor is in `templates/governor.js`. Those recipes were verified
against three.js r180. For measured r185 transform caching, selective instance uploads and
effect-buffer reuse, read [CPU and buffer optimization](references/cpu-and-buffer-optimization.md).
Read the installed version (`package.json`, lockfile) before applying a recipe to another release.

Keep the review within the requested project and scope. A performance request does not
itself authorize publishing, deployment, or changing unrelated projects. When transferring
this skill, copy its whole folder, including `references`, `scripts` and `templates`.

## Symptoms → where to look

| What people say | Usual cause | Check | Fix |
|---|---|---|---|
| "Laggy on my phone, fine on PC" | Pixels drawn (pixel ratio × antialiasing), the shadow pass, draw calls | `render-probe.mjs` canvas MP, GPU, real draw calls | Governor resolution first; antialiasing off at DPR ≥ 2; shadow rules (8) |
| "Stutters when I enter an area / land / first fight" | Shaders compiling, files loading on first use | DevTools long tasks at that moment | `compileAsync` warm-up, prefetch (9); `advanced-techniques.md` §1 |
| "Slows down with many enemies" | Every creature in the shadow box casts; many meshes per creature | Shadow profile (recipe 2) | Nearby-only shadows; bake per part (5, 8) |
| "Drops in the forest" | Batches never culled, or too many per tile | Probe at that spot; bounding spheres | Tiles centred on the hub, `computeBoundingSphere` (4) |
| "Clicking to walk feels sluggish near trees" | Pathfinding scans every obstacle | Profile the route search | Grid-indexed obstacles (7) |
| "Takes ages to load on mobile" | Everything downloaded up front | Recon network sizes by file type | On-demand files; cache on first use (9) |
| "Phone gets hot, battery drains" | Full resolution all the time; drawing while hidden | Pixel ratio; frame time | Governor; pause when hidden (`governor-tuning.md`) |
| "It looks slightly different after optimising" | Merging changed a material | `pixel-diff.mjs` before/after | Finish groups; keep emissive and glass separate (5) |
| "A little laggy on PC, worse on phone", though draws are already < 200 | The main thread: native cost per WebGL call (`(program)` in a profile), walking a big visible scene graph (bones count), uneven frames from a shadow map drawn every other frame | `cpu-profile.mjs --cpu 8`, then `--expand` the biggest function; count visible objects by group | Fewer draws and state changes; small creatures drawn only near; even 30 fps pacing on slow phones (Starline, in Pitfalls) |
| "Sometimes smooth, sometimes not" | Other programs or sessions loading the machine | Repeat the run; compare draw counts | Trust repeatable numbers only |
| "Draw calls are already low, but a large army still costs CPU" | Rebuilding unchanged local/world transforms | CPU profile and matrix-operation counts; compare stationary and moving armies | Opt-in pose caching with parent invalidation; CPU/buffer reference §2 |
| "Nothing moves, but buffers are uploaded every frame" | Unconditional `needsUpdate`, empty effect pools, whole-capacity uploads | Count `bufferSubData` calls and bytes after warm-up | Changed instance ranges, live effect prefixes, one-time empty clearing; CPU/buffer reference §3–4 |
| "A 2D DOM/SVG screen is slow though nothing moves" | Ticking text restyles thousands of inline SVG nodes; CSS animation inside a big SVG repaints it all | Browser-trace sums per second (Paint, Raster, Layout, FunctionCall), old and new builds interleaved; fps swings 38–55 on a shared machine | Static art as cached `<img>` data URIs, inline SVG only for animated parts, layers, `contain` (`clone-reference-app/references/09-web-apps.md` §9.4, from Tiệm Mì Cay) |

## 1. Measure first

Run `scripts/render-probe.mjs`. It needs no hooks in the game, because it counts raw WebGL
draws, including shadow passes:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
node ~/.claude/skills/smooth-dense-scenes/scripts/render-probe.mjs http://127.0.0.1:5173/ \
  --viewport 390x844 --mobile --throttle 4 --click "#start" --wait 4000 --frames 120
```

It prints draw calls, instanced draws, triangles and frame times (median, p95, max) for a
phone-sized view with a slowed CPU. On a desktop GPU frame time is capped by vsync (about
16.7 ms), so judge by draw calls and triangles, and use `--throttle` to expose CPU cost.
Keep a before/after table for every change, measured at the same spots.

**`renderer.info.render.calls` hides the shadow pass**: three.js resets it after the shadow
maps are drawn. In practice it reported 105 calls while the real count was 344.

Historical investigation thresholds (real draws include shadows), not guarantees for
every phone or a substitute for testing on the target device:

| Measure | Comfortable | Investigate |
|---|---:|---:|
| Draw calls per frame | < 200 | > 300 |
| Triangles per frame | < 400k | > 700k |
| Shadow-casting meshes in the shadow box | < 100 | > 200 |
| Frame time at 4× CPU throttle | < 16 ms | > 25 ms |

To see **which objects** cost the calls, in any three.js game that exposes its renderer and scene:

```bash
node ~/.claude/skills/smooth-dense-scenes/scripts/draw-attribution.mjs <url> \
  --renderer "window.game.renderer" --scene "window.game.scene" --viewport 390x844 --mobile [--pass shadow]
```

It wraps `renderBufferDirect` and lists the draws per frame by pass (view, shadow, post), by scene group and
by object + material. Recipes 1 (view) and 2 (shadow box) do the same by hand.

When draw counts are low but frames are still slow, profile the main thread as well as
GPU/pixel cost. Use an **unminified** build; 4× or 8× CPU throttling are useful stress
probes, not equivalents of a particular phone:

```bash
node ~/.claude/skills/smooth-dense-scenes/scripts/cpu-profile.mjs <url> --viewport 390x844 --mobile \
  --setup "js that puts the player at a busy spot" --cpu 8 --secs 5 [--expand "update game.js:120"]
```

`(program)` can include native work; confirm its cause with submission counts rather
than treating it as a GPU timer. `projectObject` follows the rendered hierarchy;
world-matrix traversal can still visit invisible nodes. Count both total and visible
objects, including bones. If matrix work or `bufferSubData` is prominent, use the
CPU/buffer reference before reducing model detail or simulation frequency.

## 2. Pick the technique for the cost you found

| Symptom | Technique (recipe) |
|---|---|
| Shadow pass larger than the view | Only nearby movers cast; cover, flat and underwater things never cast (8) |
| Hundreds of copies of the same models | Instanced scatter in tiles centred on the hub (4) |
| Scenery should sway in the wind | Wind on the near instances only, one shared program, no extra draws (11) |
| The world scrolls past the camera (runner, side-scroller, rail) | Streamed instancing: one `InstancedMesh` per kind, refilled when a window around the camera moves a step (10) |
| One model = many meshes (one per material) | Bake colours: merge parts that differ only in colour (5) |
| Character or creature with many parts | Bake per animated part; keep recolourable or named parts (5) |
| Idle models repeatedly recompute transforms | Cache unchanged poses; preserve parent propagation and explicit updates (CPU/buffer reference §2) |
| Instances or effects upload full buffers every frame | Change-aware ranges and live prefixes; retain pending uploads (CPU/buffer reference §3–4) |
| Ground needs variety | Vertex-colour ground tiles; tiny nearest-filter texture for crisp patterns (6) |
| Walking or pathfinding slows with many trees | Grid-indexed obstacles (7) |
| Long download, slow first load on phones | Split asset files by use; load on demand; stand-ins (9) |
| Hitch after loading or travelling | `compileAsync` warm-up; give the governor a few seconds' grace (9) |
| Long levels: far scenery still costs calls and triangles | Automatic distance stand-ins; merge only the far ones; thin with an even sample (`references/lod-memory-and-budgets.md`) |
| Weak phones still struggle | Governor: resolution first, then shadows, then thin the ground cover (`templates/governor.js`; tuning rules in `references/governor-tuning.md`) |

For further techniques (BatchedMesh, impostors, KTX2/meshopt, WebGPU, Android-proof shader warm-up, tile-GPU draw order, MSAA without a post chain, OS frame caps), see `references/advanced-techniques.md`. Each one is tagged measured or researched, with the three.js version it needs.

### Plan scenery as data, draw it separately
Decide *what goes where* with a pure, seeded function (type, position, rotation, scale,
collision radius) from region tables such as `forest: [['tree_pine', 160, .45], ['grass', 360]]`,
then draw it in a separate step. You get:
- the same world and the same obstacles for every player, whether or not a model file has
  loaded (needed for multiplayer);
- unit tests for density, overlap, clear trails and hazards;
- redraws without re-planning (new models arrived, quality changed).

Use an occupancy grid so pieces never overlap. Put the world border **outside** the
walkable radius so it needs no collision.

### Draw it cheaply
First **count what is in the frustum and how often each geometry repeats there**. In a
side-on runner only about 55–60 scenery meshes were in view and most were distinct. There,
instancing would have saved about 15 draws, while baking colours saved about 190. Pick the
technique the count supports.

- **Instance** every repeated model: one `InstancedMesh` per model part per 64 m tile,
  with tiles centred on the hub (`floor(x / tile + .5)`). Call `computeBoundingSphere()`
  after writing the matrices.
- **Bake colours** so a model costs one draw per look rather than one per material.
  Group roughness into three finishes (glossy, satin, matte); keep glowing, see-through,
  textured, recolourable and named parts separate.
- **Shadows** cost a whole second pass over everything in a box wider than the screen.
  Ground cover, flat things and anything under water never cast. Creatures cast only
  within about 16–20 m of the view. Don't let tiny details cast.

### Load it gently
Split model files by where they are used and load each on first need; prefetch during
pauses (a loading flash, a flight, a menu). Draw stand-in shapes from the same plan until
the file arrives, then redraw. A service worker should precache the core files only and
cache on-demand files the first time they are fetched.
For choosing a full 3D or a light path per device, a boot that never strands the player,
a lazily loaded engine and cache-safe asset names, read `references/device-and-loading.md`.

## 3. Verify

1. Re-run the probe at the same spots and fill in the before/after table.
2. Screenshot the same spots before and after and **prove** it unchanged with numbers:
   `scripts/pixel-diff.mjs before.png after.png` reports "N of M pixels differ" and writes a
   diff image. Diff two captures of the same build first, to show the harness is
   deterministic. In Zoo Garden, baking changed 0.45% of the village's pixels, all of them HUD
   numbers, a quest text and the explorer's idle pose; the baked props were pixel-identical.
   Also check hidden-under-hat parts and recoloured clothing.
3. Run the game's tests, and add tests for the scenery plan: determinism, counts close to
   targets, no overlaps, clear trails, nothing in hazards, border outside the walkable area.
4. Check a phone viewport with a throttled CPU, not only the desktop view. Other sessions
   or apps loading the machine add noise (one run read 51.7 fps, the re-run 60.0, with
   identical draw counts), so repeat a dip before believing it.
   For timing claims on a shared machine, run a **null-control A/B**: one page, about 12
   interleaved before/after pairs of a few frames each, plus one A/B whose two arms are
   identical. That pair's swing (±3% in SUMMIT) is the noise floor; only differences above it
   count. Separate runs there showed "before" 2.4 ms vs "after" 0.9 ms, which was pure noise.
5. Also measure geometry memory: merging copies can trade draw calls for tens of MB. For a
   lasting guard, add a budget test that rebuilds each level and fails on regressions or
   leaks (`references/lod-memory-and-budgets.md`).
6. When changing transform or upload behavior, also verify moving/turning units, animated
   parts, construction scaling, picking, hidden/revealed objects, effect expiry and pool
   reuse. Report work counts separately from FPS. A frozen fixture reaching zero buffer
   updates does not mean normal gameplay uploads nothing (CPU/buffer reference §5).

Measured on **3d_astra / Frontier Command**, Three.js r185, 2026-10-25: draw-call work
first fell from 709 to 255 in the large-map overview. A subsequent CPU/buffer pass reduced
matrix multiplications from 1,971 to 289 in a stationary 74-unit phone-sized scene and
repeated buffer uploads from 94 calls / 131,008 bytes to zero after warm-up. The main
methods were pose caching, change-aware instance uploads, and empty/live-prefix effect
handling. Moving-battle FPS gains were not established. Full conditions, numerical
comparisons, logic safeguards and transferable procedures are in the
[CPU/buffer case study](references/cpu-and-buffer-optimization.md#6-measured-case-3d_astra).

Measured on Zoo Garden (phone view, village):

| Step | Real draw calls | Shadow casters |
|---|---:|---:|
| Start | 344 | 240 |
| Bake props, explorer and scenery parts | — | — (view: 165 → 119) |
| Nearby-only creature shadows; creatures baked | 233 | 128 |
| No pond or fishing shadows; rocket baked | 219 | 114 |

Measured on Choice of Life 2.4, a side-on runner (390×844 at 3×, CPU ÷4, raw draws with
shadow and bloom passes), **after adding** nine scatter kinds, gulls, footprints and ripples:

| Scene | Before | After | Change |
|---|---:|---:|---:|
| Harbour | 534 | 313 | −41% |
| Coast road | 591 | 345 | −42% |
| Storm | 400 | 228 | −43% |
| Festival | 737 | 389 | −47% |

Most of it came from baking:
- Scenery baked per model: harbour 534 → 346.
- Cloud puffs merged: 88 → 16 meshes.
- Characters baked per moving part: 350 → 313.

Main-thread time per frame fell from 7.5–9 ms to 5–7 ms, even with more on screen.

Measured on Starline (Hoshi Valley, a story valley with ~70 villagers, 2026-10-25), found with the two tools above:
High 808 → 509 draws at the busiest spot, phone tier 245 → ~150; JS per frame at 4× CPU 12.8 → ~11 ms; at 8× a
jittery 26–38 ms became a steady 30 fps. What it took:
- **Signposts**: 35 copies × 7 materials, ~170 draws with shadows → one `InstancedMesh` per part (7 + 7). Hide one
  copy by writing a zero matrix into its slot, behind a small `{ get visible, set visible }` stand-in, so old code
  that sets `sign.obj.visible` keeps working.
- **Buildings**: 7–9 materials each, baked at load into one mesh per roughness quarter. A single matte material
  dulled glossy roof tiles at night (the environment reflection is the roughness). Lit panes, metal and named
  nodes stay separate.
- **Unseen shadows**: fish under water, ducks, crows, lit panes, curtains, flower boxes, ivy and rope stopped casting.
- **Small creatures** (rabbits, fish, ducks, crabs, cats, hens) drawn and animated within 40 m (fish 25 m) instead
  of the people's 75 m: ~600 fewer bones walked per frame.
- **Even pacing** on the phone tier: frames swinging 26 ↔ 38 ms (shadow map every other frame) read as lag. When
  the game's own work per frame stays over ~17 ms for two 60-frame windows, draw every other display frame; go
  back after four calm windows (< 10 ms). Judge by work per frame, not by gaps (pacing changes the gaps).
- The governor there only stepped down at a 38 ms median (26 fps): a 35 fps phone counted as "fine" and was never
  helped. Check what your governor aims for.

## Pitfalls seen in practice

- **A material shared by an `InstancedMesh` and a plain mesh** is compiled twice, and three.js switches programs
  between the two kinds as it draws. Give instanced uses their own copy (a `WeakMap` cache; copy `onBeforeCompile`
  and `customProgramCacheKey`; register a lit pane's copy with the glow set; keep a link to the source so colour
  changes such as season tints reach both). Scan for it: traverse the scene and list materials used by more than
  one of plain / instanced / skinned meshes.
- **Shadow-only helper meshes** (invisible casters with `colorWrite: false`) are still drawn in the view, writing
  nothing. Put them on their own layer, enabled only on the light's shadow camera
  (`mesh.layers.set(1); light.shadow.camera.layers.enable(1)`).
- A culling helper that tests instances against **the game camera's** frustum keeps only what is in front of it:
  a cube-map bake or a second camera must open it up while it renders.

- Merging thousands of copies with `toNonIndexed()` explodes memory. Instance them
  instead; merge only within one model.
- A tile grid aligned at 0 puts a centred village in four tiles, so it draws 4× as much.
- A two-material part loads as `name` and `name_1`. Gather both before showing, hiding or
  scaling it (for example a rocket flame), or half of it never switches off.
- Camera-follow code that re-targets after a cut-scene has finished leaves the camera
  stuck. Re-target only while the sequence is still running.
- **Materials and shader programs must outlive level rebuilds.** Keep shared materials in a
  kit owned by the world (a `Map<key, Material>`, disposed only with the world); levels dispose
  only their geometry. Otherwise each level change recompiles programs, and a quick rebuild
  right after a `renderer.compile()` warm-up disposes programs that are still compiling. Chrome
  then logs `glGetProgramiv: Program object expected`. Test it: on an A → B → A visit, material
  `uuid`s and `renderer.info.programs.length` are unchanged (SUMMIT, `LivingKit` in `src/living.ts`).
- `InstancedMesh.dispose()` is needed to free the instance buffers. Flag shared kit
  geometry and materials so world teardown doesn't dispose them.
- The quality governor reads loading hitches as a slow device. Pass `playing = false` for
  a few seconds after starting or arriving, and ignore samples with dt > 0.25 s.
- **A glTF node with one material is a Mesh that can have children** (joints, sockets,
  limbs). When baking, never `removeFromParent()` such a node or its children vanish. Hide it
  with `mesh.layers.disableAll()` (this also skips the shadow pass) and keep it in the tree.
- Baking a character per part costs about 2–4 ms on desktop and about 4× that on phones.
  Bake characters that appear mid-play in `requestIdleCallback`, one per idle slice, and draw
  them unbaked until then. A queued bake for a removed character must do nothing.
- Keep emissive parts that the lighting drives (windows and lamps that glow at dusk) as
  separate meshes, or the day/night lighting breaks.
- With an `EffectComposer` (bloom and similar), `renderer.info` resets on every internal
  render, so it shows only the last pass. Set `renderer.info.autoReset = false` and call
  `renderer.info.reset()` at the start of each frame, or use `render-probe.mjs`.
