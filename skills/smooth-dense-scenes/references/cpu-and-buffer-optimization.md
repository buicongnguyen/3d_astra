# CPU and GPU buffer optimization after draw-call reduction

Use this reference when profiling points to matrix calculations or graphics uploads,
including games that already use instancing. The measured case used Three.js 0.185.1;
inspect the destination project's engine and update loop before adapting it.

Contents: 1. Measure · 2. Transforms · 3. Instance buffers · 4. Effects ·
5. Correctness and acceptance · 6. Measured case · 7. Apply elsewhere.

## 1. Measure the remaining work

Use `scripts/cpu-profile.mjs` on an unminified local build. Select representative
stationary and moving scenes; include active combat if optimizing effects. Use the
project's existing test hook or a temporary development-only setup, not production
debug APIs. Use Playwright's available browser or the project's configured executable;
do not embed another machine's Chrome path in the game or portable scripts.

In addition to raw WebGL draws, record:

- Matrix composition and multiplication counts per rendered frame, including engine
  work. Instrument the installed Matrix4 implementation only in the measurement page.
- Actual `bufferSubData` calls and bytes, including shadow passes. Distinguish initial
  `bufferData` allocation from steady-state uploads. For WebGL2 typed-array overloads,
  source offsets and lengths are elements, so multiply by `BYTES_PER_ELEMENT`. An
  omitted/zero length uploads the remainder of the source; do not count capacity
  when only a subrange is submitted.
- CPU work, frame intervals, geometry/program counts, and viewport/DPR/quality.

Use fixed camera, seed, quality and cosmetic time for image comparisons. Warm the
scene before collecting steady-state counters. Capture before a moving benchmark
changes water, dust, recoil or other cosmetic state. An identical-build image pair
establishes whether the capture setup itself is deterministic.

Instrumentation adds cost per operation. Remove operation-count wrappers from both
arms before timing; alternate original/optimized arms in one page with an identical-arm
control. On a shared machine, a difference comparable to the control's variation is
not evidence of a speedup. A few fewer draw calls can still increase CPU or triangle
work; measure the trade instead of assuming every reduction improves frame time.

## 2. Reuse unchanged local and world transforms

Profile `updateMatrixWorld`, `compose` and `multiplyMatrices`. Three normally composes
automatic local matrices every traversal, making descendants recalculate their world
matrices even when a pose is unchanged. Merely hiding a mesh does not necessarily stop
matrix traversal. Simply disabling all matrix updates breaks moving units and picking.

Prefer existing dirty-transform infrastructure when the project has it. For scenes
without one, an opt-in cache can retain each node's last position, quaternion and scale:

1. Apply it to live instances after cloning, not shared templates or engine prototypes.
   Start with the measured entity/deposit trees; do not blanket-wrap cameras, skeletons,
   or nodes with custom update methods without inspecting their semantics.
2. Store pose components at CPU precision. A rotation/Euler change is reflected in
   the quaternion. Only unchanged poses can skip local recomposition.
3. Preserve normal world-matrix traversal and its force flag. A changed parent must
   still update descendants, even when their local poses are unchanged. Check the
   parent identity so reparenting invalidates the world matrix.
4. Keep explicit `updateMatrix` and `updateWorldMatrix` behavior intact. The initial
   prototype in this case wrapped `updateMatrix` itself and broke direct parent-first
   updates. The corrected implementation wraps the instance's `updateMatrixWorld`:
   on an unchanged pose it temporarily disables local automatic composition, invokes
   the original traversal, then restores the flag in `finally`.
5. Use the normal path for manually managed matrices or pivot transforms unless those
   are explicitly supported and tested. Invalidate cached state while taking that
   path so switching back to automatic matrices recomposes correctly.

An always-dirty scene root can force the entire tree to update. Account for it using
the same controlled cache or a correctly managed static root. Avoid adding a second
full hierarchy traversal merely to save calculations without measuring the result.
Cache ownership should follow live objects (for example, a WeakMap) so destroyed
units are not retained. This is an engine-version-sensitive optimization, not a
drop-in rule for every Object3D subclass.

## 3. Send only changed instance data

Keep batch grouping, visibility, picking and shader behavior unchanged. Compare each
new instance matrix with the slot already stored in the GPU-source typed array. When
that array is Float32Array, compare `Math.fround(value)` with the stored component;
comparing an unrounded double makes unchanged rotations appear dirty indefinitely.

- Copy and mark a slot only when its data changes. Track a bounded first/last changed
  range and set `needsUpdate` only for changed buffers. A single range can deliberately
  include some unchanged slots to avoid hundreds of tiny upload calls.
- `addUpdateRange(start, count)` takes components, not bytes or instance counts.
  A matrix occupies 16 components. Set dynamic usage before the buffer is first used.
- Do not clear pending ranges blindly at the start of a frame. If the renderer culled
  the batch, it may not yet have uploaded yesterday's data. Union new and pending
  ranges, then coalesce to a bounded representation; otherwise hidden updates can
  accumulate unbounded metadata or silently discard changes.
- Shrinking a draw count does not require uploading unused trailing slots. Removing
  a middle instance does require updating the replacement in that slot. Growth must
  preserve earlier slots and correctly initialize the replacement GPU allocation.
- Maintain bounding volumes and actual instance counts. Fog, depletion, death,
  quality changes and restarts must not reveal stale instances. Retain pending data
  if the object disappears before a render and later returns.

If material sharing and instancing are also under review, share only compatible
finishes. Keep team paint, glow, transparency and independently recolored parts
separate. Source-part culling must retain off-screen casters affecting the light
frustum. Hiding a parent suppresses children; a clipped mesh parent does not imply
all its child meshes are clipped. These safeguards mattered in the preceding draw
review of the same game.

## 4. Update effect pools according to occupancy

Preallocated particle pools avoid allocation spikes but still waste bandwidth when
every frame resends the entire capacity. Track active/drawn counts separately from
capacity, including delayed particles and particles hidden by fog.

- Upload only the live prefix of position, color, axis, size and debris-matrix data.
  For each attribute, prefix length is `drawnCount * attribute.itemSize`.
- When the last visible effect ends, clear its representation once. On later empty
  frames, skip identical writes/uploads. Preserve pending ranges until rendered.
- Continue advancing particle lifetimes, delayed events and projectiles while they
  are hidden. Skip submission work, not gameplay/effect scheduling required for their
  eventual visibility. Pause must still freeze presentation age when the game says so.
- Verify new effects reappear after expiry/clear and that stale tails never render.
- Preserve the project's shader warm-up strategy. In this case one existing
  zero-size/transparent instance was retained, so shaders stayed warm without empty
  buffer uploads. A project with explicit warm-up can hide empty meshes instead;
  do not universally add dummy draws.

This technique keeps particles, textures, colors, motion and quality caps intact.
Reducing effect density is a separate visual trade requiring its own evidence.

## 5. Correctness and acceptance

Choose focused checks for the affected behavior; do not run unrelated suites repeatedly.
For transform changes, compare cached and ordinary world matrices through movement,
turning, animated child parts, construction scaling, death, reparenting, hidden/revealed
nodes, forced updates and direct picking updates. For buffer changes, cover stable
frames, capacity growth, middle-slot replacement, pending updates without a render,
fog/culling, effect expiry and reuse. Include level restart/resource ownership checks
when batching or pooling lifecycles change.

Accept a change when it removes measurable work without a material regression in
moving scenes, visuals, input or memory. Record limitations. Zero steady-state buffer
uploads in a frozen fixture do not mean a running battle uploads nothing. Desktop
CPU throttling does not model mobile GPU bandwidth, thermals or battery use. Do not
promise phone FPS improvement without appropriate device evidence.

## 6. Measured case: 3d_astra

Frontier Command / `3d_astra`, October 25, 2026. Installed Three.js 0.185.1;
Chrome/D3D11 on RTX 4080 SUPER. Desktop 1280×800; phone-sized viewport 390×844,
DPR 2, Eco rendering ratio 1, 4× CPU throttle. Ten warm-up frames, 30 sampled frames.
Simulation, camera, visibility, quality and cosmetic time were frozen.

The earlier sharing/instancing/culling pass reduced raw draws, including shadows:
base 190→178; Riverlands overview 381→207; Expanse overview 709→255; 74-unit phone
scene 171→112. Expanse used stress-only zoom 105 beyond the normal cap of 88.

The subsequent CPU/buffer pass used that already-optimized build as its baseline:

| Fixture | Matrix compositions | Matrix multiplications | Buffer uploads | Bytes uploaded |
| --- | ---: | ---: | ---: | ---: |
| Base, High | 698→155 | 846→304 | 78→0 | 88,768→0 |
| Riverlands overview, High | 746→203 | 887→345 | 90→0 | 99,904→0 |
| Expanse overview, High | 1,259→274 | 1,402→418 | 114→0 | 117,824→0 |
| 74 stationary units, Eco | 2,051→368 | 1,971→289 | 94→0 | 131,008→0 |

The effect pools alone previously resent 80,704 empty bytes per frame. Draw counts,
triangle counts and GPU geometry counts stayed unchanged during this second pass.
Desktop image pairs were pixel-identical; 12 of 163,968 phone pixels differed slightly,
none by more than 8 levels in a color channel. Same-build control pairs differed by zero.

Before the effect change, 12 interleaved pairs for transform/instance reuse gave
optimized/original CPU-time ratios 0.912 idle and 1.030 moving; identical-arm controls
were 1.024 and 0.957. Moving results were within observed variation, so no active-battle
CPU speedup or phone FPS gain was claimed. These project counts are examples, not
universal performance budgets. Validation: 212 unit tests, four render-budget scenes,
desktop/phone combat checks, production build.

## 7. Apply to another project

Run the skill from its installed folder, preserving relative references. Inventory
the destination engine version, rendering loop, batch/effect ownership and existing
tests. Capture that project's own baseline; select only techniques supported by its
profile. Adapt the implementation to its scene graph, materials, visibility and
input rules instead of copying game-specific globals, map sizes or army budgets.

Other possible targets after this pass are fewer redraws behind opaque menus, cached
unchanged HUD text, hidden-minimap work, and spatial indexing for expensive target or
path searches. They were candidates, not measured gains here. Measure them before
rewriting systems or lowering detail. Keep simulation timing and responsive input
unless the user's task specifically calls for changing them.

Primary engine references:

- [Object3D matrix controls](https://threejs.org/docs/pages/Object3D.html#matrixAutoUpdate)
- [BufferAttribute update ranges](https://threejs.org/docs/pages/BufferAttribute.html#updateRanges)
- [InstancedMesh ownership and bounds](https://threejs.org/docs/pages/InstancedMesh.html)
