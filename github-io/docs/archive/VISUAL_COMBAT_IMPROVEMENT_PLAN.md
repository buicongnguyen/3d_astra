# Combat effects, backgrounds and color improvement plan

19 September 2026 — logic reviewed and visual implementation completed in Three.js and Godot.

This complements [the scenario plan](SCENARIO_AND_ENVIRONMENT_PLAN.md). The immediate
priority is improving how existing battles look, before adding more mission mechanics.

## What the source comparison shows

Reviewed `Tank_game_3D/src/three/effects.ts`, `world.ts`, `environment.ts`,
`frontier-environment.ts` and `frontier-surfaces.ts`, against this project's
`view.js`, `combat-feedback.js`, `activity-view.js`, `environment-view.js`,
`terrain.js` and `settings.js`. Godot's `combat_feedback.gd` uses corresponding
simple hit/burning/death feedback. This is a code-based assessment; the proposals
still need side-by-side gameplay captures and measurements on a physical phone.

| Area | Tank game approach | Current RTS approach | Recommended improvement |
| --- | --- | --- | --- |
| Gunfire | Model muzzle attachments, brief flashes, sparks, smoke and rocket exhaust | Shot/support events create a line lasting 0.12 seconds between generic heights | Weapon-specific muzzle flashes, short tracers, cannon recoil and limited rocket trails |
| Explosions | Layered flash, expanding ring, fragments and smoke; different surface responses | Canvas circles, polygon fragments, flame shapes and smoke circles; heavy death lasts 2.2 seconds | A rapid bright core, irregular orange burst, short ground dust ring and slower smoke; distinguish infantry, tank and building destruction |
| Damaged units | Smoke/fire and bounded wreck visuals | Burning below 35% HP for completed buildings and mechanical units | Retain the rule; improve flame/smoke softness and anchor effects to actual model locations |
| Background | Biome-specific sky/fog/sun colors, authored landmarks and small shared ground textures | Fixed scene background/fog and common lighting; terrain surface colors vary, with a dedicated river environment kit | Per-biome palette and landmark composition while preserving battlefield readability |
| Color | Distinct environment palettes and warm weapon effects | Custom army colors, team-colored shot lines, mint support beams and common terrain colors | Keep army colors on markings/rings; use consistent weapon colors and distinct support shapes |

Both games already use ACES tone mapping. The exposure values differ (Tank 1.0,
RTS 1.2), but simply copying one value is not a justified fix: compare the lighting,
materials and active battles together. Likewise, more particles alone are not the goal.

## 1. Make each weapon recognizable

- **Infantry rifle:** small warm muzzle flash for roughly 60–90 ms, a short thin
  tracer, and a tiny impact spark. Avoid showing every infantry bullet as a long laser.
- **Tank cannon:** a brief white-yellow core with an orange outer flash, a small
  smoke puff and visible barrel recoil returning over roughly 150–220 ms. Recoil
  animates the model only; it never moves the simulation unit or changes accuracy.
- **Anti-tank rocket:** a distinct projectile silhouette and a short, sparsely sampled
  smoke trail. Keep the explosion concentrated unless the weapon actually has splash
  damage. A cosmetic projectile must not postpone or apply damage a second time.
- **Cannon tower:** a restrained cannon flash and heavier impact than a rifle, without
  making the tower's range or damage appear larger than it is.
- **Harvester / healer / engineer:** keep harvesting amber/blue, healing a soft green
  pulse and repairs short pale sparks. Different shapes and rhythm should distinguish
  these actions even when the player selects a green or blue army color.

Add stable muzzle and barrel attachment names in the Blender export where missing.
Use model-local fallbacks for older assets. Render-only variation must use a separate
random generator and must never change simulation randomness or weapon cooldowns.

## 2. Give destruction a clear sequence

Starting timings for visual tuning:

1. **0–100 ms:** small bright core; no whole-screen flash.
2. **100–450 ms:** irregular orange burst and a shallow dust ring.
3. **0.3–2 seconds:** smoke expands, rises slightly and becomes transparent.
4. **Optional aftermath:** a small scorch mark fades after 4–6 seconds.

Infantry death should use a small dust/armor burst, not a tank-sized fireball.
Tank destruction can use a few nonphysical fragments and a darker smoke column.
Building destruction should use a broader dust cloud and a few larger silhouettes;
scale to the building footprint and cap its screen coverage. Do not leave invisible
collision or navigation obstacles behind cosmetic wreckage.

Keep the existing shield-hit versus hull-hit distinction. Metal impacts use brief
sparks; stone/concrete uses pale dust; ground impacts use the biome's dust color.
Do not add fuel explosions to ordinary structures unless gameplay explicitly supports
them. Visual rings must not be confused with the real damage radius or selection ring.

Preserve the existing 35% critical-health rule and stop burning when repaired above
the threshold. Cosmetic fire does not imply damage over time. Reduce flame frequency
and opacity when many damaged buildings overlap in the camera view.

## 3. Improve background composition

Use three readable layers: quiet playable ground, clustered nearby scenery, and
low-detail landmarks beyond the playable boundary. Avoid tall objects obscuring
buildings, resources or mouse targets. Keep scenery out of unit exits and routes.

| Existing biome | Ground direction | Background / light direction | Landmark kit |
| --- | --- | --- | --- |
| Ashen Frontier / Copper Basin | Warm dirt, muted copper rock, restrained mineral seams | Warm neutral sunlight and desaturated distance | Quarry machinery and broken outpost walls |
| Meridian Riverlands / Frontier Expanse | Olive banks, brown roads, subdued teal water | Cooler distance with slightly warm sunlight | Bridge supports, reeds, low riverside ruins |
| Amber Dunes | Pale tan sand with darker wind ripples | Warm haze; avoid orange everywhere | Sandstone, sparse palms, pump station |
| Verdant Crossing | Darker olive soil/grass with clear brown paths | Cool green-gray distance | Broadleaf groves and old crossing structures |
| Obsidian Highlands | Blue-gray basalt with warm exposed earth | Cool neutral distance and crisp highlights | Fractured outcrops and mining ruins |

Use shared 128–256 px procedural ground maps and merged/instanced props where useful.
Keep water opaque with restrained highlights; do not add expensive reflection passes
as a prerequisite. Cosmetic distance fog must remain separate from fog of war.

## 4. Color and readability rules

- Keep terrain less saturated than units, selection feedback and combat flashes.
  Preserve the user's chosen army colors; avoid recoloring the whole battlefield.
- Favor warm ivory/orange for conventional gunfire and blue-white for shield hits.
  Reserve strong red for danger/enemies and green progress feedback for construction.
  Use shapes and labels as well as color because custom army colors may overlap.
- Add a dark edge under selection rings and health bars so they remain visible on
  sand, snow, grass and bright effects. Keep green construction blocks and red cancel
  controls readable throughout nearby explosions.
- Avoid global heavy bloom, camera shake on every shot, or exposure pumping. Optional
  subtle shake could be considered later for a nearby major destruction event, disabled
  by default on touch devices and by reduced-motion preferences.
- Review mint, coral, blue, gold and ivory army presets against every biome, and test
  all four faction colors together. Increase marking contrast before brightening ground.

## 5. RTS-specific performance and correctness

The Tank implementation caps particles at 85 in Low and 230 in Detailed, but creates
a mesh and material per emitted particle. Do not copy that implementation directly
into a many-unit RTS. Borrow the layered appearance and use pooled/batched rendering.

- Retain the current 32 impact/death-event cap, 64 line/marker-effect cap and 8/16
  burning-object limits as the initial baseline. Adding layers inside one event still
  costs work: enforce a separate total sprite budget and measure it before increasing.
- Prefer one small shared procedural atlas and pooled sprites/instances. No per-shot
  point lights, shadow-casting smoke, physics debris or unbounded trails. Reuse buffers
  rather than allocating new geometry/materials for every shot.
- Keep construction, resource targeting and health feedback above cosmetic effects.
  The current canvas effects do not receive scene depth testing: use depth-tested world
  sprites for large smoke where practical, or keep the canvas version small and faint.
- Audit visibility: current shot lines are enabled when either endpoint is visible.
  Clip or suppress hidden segments so a muzzle/trail does not expose a shooter behind
  fog. Apply the same rule to explosions, fire, wrecks and optional dynamic illumination.
- Essential hit/attack feedback remains visible on Eco. Reduce smoke, fragments and
  trail density first; preserve unit silhouettes and exact simulation behavior.
- Add a separate combat-effects motion preference. Currently Three.js combat animation
  consults `waterMotion`; disabling animated water should not accidentally control fire
  animation. Honor reduced motion and migrate existing settings without losing colors.
- Pause freezes effects; restart clears them; expired effects return to their pool.
  Verify memory stays bounded through repeated battles and quality changes.

## Delivery order and acceptance

**Pass 1 — combat feel:** rifle/tank/rocket differentiation, muzzle anchors, cosmetic
recoil, improved shield/hull impacts and layered tank/building destruction.

**Pass 2 — art direction:** per-biome background/light palette, ground texture variation,
clearer team markings and restrained scenery. Improve the existing maps first.

**Pass 3 — parity and tuning:** reproduce event types, durations, fog rules and quality
settings in Godot using its native renderer. Share GLB anchors and palette definitions;
the internal rendering code does not need to be identical.

Capture the same rifle engagement, tank duel and building destruction before/after at
normal RTS zoom and maximum zoom-out. Check desktop and Android portrait/landscape,
including a battle with roughly 80 units. Target no more than 10% worsening of median
and p95 frame times on the same physical phone versus baseline; if baseline is already
poor, reduce cost first. Measure draw calls, active sprites and memory as well as FPS.

Acceptance also requires unchanged damage, cooldowns, pathing and retreat response;
no hidden-enemy leaks; readable construction/cancel controls through effects; correct
pause/restart/repair behavior; and equivalent gameplay on Eco and Detailed settings.

Only after these passes should the larger scenario expansion proceed. This is an
separate future project; this delivery improves the existing maps.

## Logic review and implementation results

- Reused existing Blender barrel meshes; no asset regeneration or new model downloads needed. Cosmetic recoil never moves the simulation entity or changes damage, cooldowns, navigation or retreat orders.
- Suppress shot trails if either endpoint or any sampled segment is hidden. Visibility is checked again while an effect remains alive.
- Replaced per-shot meshes with a 64-slot reusable event pool. Existing destruction and burning caps remain. Restored the 64-command-marker disposal cap during review.
- Added separate combat-motion settings and reduced-motion support, independent of animated water.
- Layered muzzle flashes, rifle/cannon tracers, rocket smoke, repair sparks, soft smoke and heavy destruction bursts. Status and construction indicators render above effects. Godot uses a separate fast effects layer without redrawing its minimap every frame.
- Shared biome palettes now drive terrain, background and lighting. Added restrained scenery beyond playable boundaries and dark selection-ring edges. Three.js exposes seven maps; Godot currently exposes four. No new missions or persistent scorch decals were added.

### Verification

Three.js: 94 logic tests pass; production build passes; desktop and mobile activity checks pass. New visual checks pass at 1280×800, 390×844 and 844×390 with an 80-unit battle. Godot import/export, activity checks and new visual checks pass, including its four selectable biome palettes. Both engines check pool limits, fog suppression, frozen lifetimes, restart cleanup and independent motion settings. Added visual checks to both GitHub workflows.

Initial same-machine CPU render samples before/after: desktop median 2.0/2.0 ms; portrait 1.2/1.3 ms; landscape 1.3/1.4 ms. A final run measured 2.2, 1.4 and 1.4 ms respectively, illustrating timing variability. Desktop draw calls increased from 1403 to 1544 for independent barrel animation; geometry count decreased from 245 to 230 after removing allocated shot lines. These are Chrome desktop CPU samples at DPR 1, not physical Android frame-rate measurements. The proposed physical-phone 10% frame-time target remains unverified.
