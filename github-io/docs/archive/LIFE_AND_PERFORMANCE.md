# Living battlefields and phone performance

October 2026. This adds small, cheap, living details to every map and makes big battles draw far less, so the game stays smooth on phones. When a device still struggles, the tiny things slow down, then hold still.

## Ambient life per map

| Map | Life |
|---|---|
| Ashen Frontier | crows circling, falling ash |
| Meridian Riverlands | gulls, trout and koi in the river, butterflies, dragonflies along the banks, pollen |
| Copper Basin | soaring hawks, copper dust, a few butterflies |
| Frontier Expanse | geese crossing in V formation, fish, butterflies, dragonflies, pollen |
| Amber Dunes | vultures gliding, blowing sand |
| Verdant Crossing | songbirds, many butterflies, fireflies, fish, dragonflies |
| Obsidian Highlands | ravens, rising embers |

Counts are set per 96 × 96 of map area. Eco quality (the phone default) draws 60% of them.

**How it stays cheap** (`src/ambient-life.js`):
- **One draw per family.** Each family (birds, bird shadows, butterflies, dragonflies, fish, motes) is a single instanced draw.
- **Motion runs in the vertex shader.** It covers circling and formation flight, wingbeats with gliding, butterfly loops, dragonfly hover-and-dart, and fish swimming along the river with a body wave. The CPU only advances one clock.
- **Tiny shapes.** Birds have 9 triangles, butterflies 10, fish 3, and motes are points. No family casts into the shadow map; birds draw a soft fake shadow on the ground, offset along the sun.
- **Fog of war.** Creatures sample the fog texture, so nothing shows over unexplored ground.
- **Inside the map.** Every path is bounded inside the playable map, and creatures shrink away before the edge.
- **Seeded placement.** `planLife()` is pure and seeded, so a map always gets the same cast. `tests/ambient.test.js` checks determinism, budgets and bounds.
- **Settings.** "Decorative vegetation" hides the life, and reduced motion holds it still.

**Measured cost.** On the weak-GPU proxy (Chrome with SwiftShader) I toggled the life on and off every 40 frames in one page, with a null-control pair:

| Scenario | Cost | Null-control swing |
|---|---|---|
| Verdant Crossing, phone | +3.2% | −3.8% |
| Obsidian Highlands, phone | +0.7% | +0.9% |
| Verdant Crossing, desktop | +0.2% | −0.9% |

All three are within noise.

## Creatures can be killed, and are thinned when needed

- **Combat kills them.** Impacts (1.5 m), deaths (2.5 m), vehicle wrecks (4 m) and building collapses (6 m) kill the butterflies, dragonflies, fish and motes they reach. Birds fly above the battle and survive. A killed creature swaps places with the last live one in the instance buffers and the draw shrinks by one, so dead creatures cost nothing. A new match brings the full cast back.
- **The governor thins them.** At "still" only half the creatures are drawn, and at "rescue" none are.

## Units drawn in batches

Units and buildings of one type and team are clones that share geometry and materials (`src/entity-batches.js`). Their parts are now drawn through shared `InstancedMesh` batches:
- **The clones still exist.** They stay in the scene graph for transforms, animation and picking, but on a layer the camera and shadow pass skip.
- **Culling per batch.** Each batch fits a bounding sphere around its instances every frame, so an army out of view skips both passes.
- **Shared blob shadows.** Blob shadows share one material and one geometry per radius, so they batch too.

| Phone view, 60-unit battle (Riverlands) | Before | After |
|---|---|---|
| Real WebGL draw calls per frame | 641 | 174 |

Phone GPU drivers pay roughly 10–30 µs per draw call, so this is the change that matters most on phones. On desktop the CPU difference was within noise.

## Frame-time governor

`src/governor.js` judges each second of play:
- **Slow:** frames over 37 ms (under 27 fps), or over 24 ms while the main thread is busy. A steady ~33 ms with little main-thread work is a 30 Hz display cap (battery saver), not slowness, so the governor does not act on it.
- **Smooth:** 90% of frames under 19 ms.

| Level | What changes |
|---|---|
| full | everything moves |
| calm | ambient life slower, with smaller wingbeats |
| still | ambient life, water ripples and dust hold still; half the creatures are hidden |
| rescue | all creatures hidden; render scale 0.8, kept only if frames get at least 10% faster within 3 s; otherwise undone and never retried |

- **Stepping down and up.** Two slow seconds step down one level; eight smooth seconds step back up.
- **Ignored time.** Hitches over 250 ms, pauses, dialogs and the first 3 s of a match are ignored.
- **In tests.** Browser tests keep the governor off unless the URL has `?governor=1`.

## Verification

- `npm test` includes `tests/ambient.test.js`, which covers governor behaviour on synthetic timings (60 fps, a 30 Hz cap, GPU-bound and CPU-bound slowness, recovery, hitches) and the life plan's bounds.
- `npm run test:ambient-life` runs in CI as part of the `interface` group. It checks that:
  - all seven maps build their families with no shader errors;
  - a 60-unit phone battle stays under 300 real draw calls;
  - the governor goes full → calm → still → full;
  - reduced motion holds the life still.
- All other browser suites still pass.

## Godot edition

The Godot repository has the same seven casts, motion levels and governor rules, without the render-scale step (`scripts/ambient_life.gd`, `scripts/governor.gd`). It uses one MultiMesh per family, and its instance data carry motion parameters that the shaders read. Its fog of war now uploads the simulation's visibility bytes as two textures instead of setting thousands of pixels from GDScript every quarter second.
