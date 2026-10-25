# Rendering review using Claude's dense-scene workflow

Reviewed October 25, 2026, against Three.js 0.185.1.

## Skill reused

The requested workflow was found in the shared Claude skill at
`C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md`, rather than a tracked skill
file in the local `3D_game_scene` checkout. Its Starline/Hoshi Valley case study
describes the signpost instancing, material sharing and shadow review used there.

Applied its sequence: measure real draws, attribute them to objects/passes, change
the measured bottleneck, then repeat identical scenes and compare images. Its
`draw-attribution.mjs` was used with the installed Chrome executable. The reusable
local regression/measurement command is `npm run test:render-budget`.

## Changes

- Neutral model finishes now share materials across armies. Team paint and glowing
  team paint remain separate and editable per army. Existing instance batches can
  combine identical armour, suits and tyres across factions.
- Blender resource deposits join the instance batches. Their individual discovery,
  remembered quantity, shrinkage, depletion and gathering targets remain intact.
- Batches test source parts against the view and light frustums before uploading
  instances. The first prototype submitted extra off-screen triangles on phones;
  this check brought them below the original count. Off-screen shadow casters remain
  when their shadows can affect the scene. Hidden parents suppress all descendants.

No models, texture detail, lighting, team colours, animation or graphics-quality
defaults were removed to obtain these reductions. Instancing reuses geometry and
materials instead of merging duplicate geometry into a larger mesh. The relevant
[Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html)
also describes the bounding-volume and buffer-update requirements.

## Measurements

Raw WebGL draw calls per rendered frame, **including the shadow pass**:

| Frozen fixture | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Initial Riverlands base, High | 190 | 178 | 6% |
| Revealed Riverlands overview, High | 381 | 207 | 46% |
| Revealed Expanse stress overview, three AI rivals, High | 709 | 255 | 64% |
| Riverlands phone battle, Eco, 74 units | 171 | 112 | 35% |

The phone fixture has 60 added combat units plus 14 initial units. Desktop fixtures
use 1280×800; the phone uses 390×844 at device scale 2 and 4× CPU throttling. Rendering
resolution remains controlled by the unchanged quality settings. GPU: RTX 4080 SUPER,
Chrome/D3D11. Simulation, cosmetic time, camera, visibility and quality are fixed for
repeatability. Ten warm-up frames precede 30 measured frames; no governor adapts quality.
Zoom is 42 for the base, 70 for Riverlands and 30 for the phone battle. The large-map
stress overview uses a test-only zoom of 105 to expose more of the map; normal player
zoom is capped at 88. It is a stress comparison, not a typical player-view estimate.

Triangles: phone 316,582 → 294,698 (7% less); large map 399,213 → 403,157 (1% more,
because shared batches cull more coarsely between the main and shadow passes).
Other fixtures' triangle counts are unchanged. Reported GPU geometry allocation
counts do not increase; the phone fixture falls from 141 to 139.

These are rendering-work reductions, **not a claimed phone FPS improvement**. CPU
timings varied on this shared machine. Twelve interleaved culling on/off pairs gave
a 1.11 median time ratio while identical arms varied by a 1.07 ratio; that does not
establish a reliable overall CPU speedup. Culling trades some CPU work for fewer GPU
submissions. Actual mobile GPU/frame-pacing performance still needs device testing.
The fixture excludes simulation advancement, so it is not a full gameplay benchmark.

## Visual and logic validation

Two captures of each unchanged fixture had zero differing pixels. Before/after
battlefield-only captures differed at 1, 5, 8 and 0 pixels respectively, out of
970,240 desktop pixels or 163,968 phone pixels. Only one desktop pixel differed by
more than 8 in a colour channel; none differed by more than 24. There was no visible
artwork change in these fixtures.

The regression checks cover team recolouring isolation, resource targeting,
remembered deposits under fog, hidden/depleted deposits, stable batch allocations
after restarting, camera movement, off-screen shadow casters, hidden parents,
visible children of a clipped mesh, and shared-asset ownership on disposal.

Validation completed: 206 unit tests, the four rendering-budget fixtures, ambient life
across seven maps, the existing 60-unit battle/governor check, visual-combat checks at
1280-, 390- and 844-pixel widths, and a successful production build.

## Repeat the review

From `github-io`, run the local server and then, in another terminal:

```text
npm run dev -- --port 4193
npm run test:render-budget
```

Set `TEST_URL` to point at a production preview or another local port. The test emits
JSON reports and two frozen PNG captures per fixture in
`test-results/render-current/`. CI runs it with the interface checks.

Before changing rendering code, record a baseline with
`node tests/render-budget.mjs --record before`; after editing, use `--record after`.
Record mode gathers evidence without enforcing the new budgets or behavior checks;
the default test enforces both. Optional `--cull-ablation` runs interleaved culling
comparisons with an identical-arm control. Do not interpret desktop throttling or
software-renderer timings as physical-phone FPS.

Keep the raw draw counter: `renderer.info` resets between renderer passes, so a
single sampled counter can omit work. See the
[renderer statistics documentation](https://threejs.org/docs/pages/WebGLRenderer.html#info).
