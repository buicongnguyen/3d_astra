# Army settings and a more realistic battlefield

Status: settings, ground, water and scenery release implemented. See [evaluation, execution and review](EVALUATION_AND_RELEASE.md) for exact delivered scope, test evidence and remaining improvements. The original proposal below includes optional follow-up work and is retained for design context.
Prepared: 2026-09-08. Baseline: browser release `08e8406`.
Project: `github-io/`, Three.js + Blender, desktop and mobile, GitHub Pages.

## 1. Direction and release scope

Make Frontier Command feel like a believable frontier outpost: painted metal armies, distinct ground surfaces, a stream with visible crossings, rocky banks, vegetation, and grounded lighting. Preserve the clear silhouettes and readable elevated camera of an RTS.

Build in this order:

1. **Army settings:** choose colors, preview them, apply or cancel, and remember preferences.
2. **Ground variety:** grass, dirt, sand, roads and stone, supported by shared terrain data.
3. **Water and crossings:** an animated stream, wet banks, impassable deep water, bridges and a ford.
4. **Environmental detail:** Blender props, improved materials, bounded particles and ambient sound.
5. **True elevation later:** hills, slopes, raised bridges and height-aware combat only after the terrain foundation is tested.

Keep the current map available as a regression scenario while developing the new **Meridian Riverlands** scenario. The new map uses the same 96 × 96 meter bounds, units, resources and economy. A map choice belongs in the pre-match briefing; changing map during a match requires starting a new match. Visual settings can change during play.

The first environment release includes phases 1–4 with flat traversable ground. Ships, swimming units, destructible bridges, weather-driven gameplay, a day/night simulation, multiplayer and the deferred Godot project are outside this release.

## 2. Findings in the current code

| Current implementation | Consequence for the plan |
|---|---|
| `view.js` uses a two-entry `COLORS` array and creates team material variants. | Replace the constants with a team palette service and update materials shared by existing and future entities. |
| Blender models already use materials named `Team` and `TeamGlow`. | Army recoloring does not require remaking or re-exporting the nine models. Neutral armor and metal should retain their materials. |
| Minimap markers, remembered enemy structures and several effects use hard-coded colors in `main.js`, `view.js` and CSS. | Audit all team-color consumers, not just unit armor. Separate team identity from success/error colors and resource colors. |
| Ground is a flat plane with a generated canvas texture. Rock collisions come from `ROCKS`; paths are drawn separately. | Introduce one authoritative terrain definition before adding gameplay-affecting water or terrain. |
| Navigation stores blocked grid cells and circular obstacles; commands raycast against a flat plane. | Flat water/bridge gameplay is feasible first. Real elevation needs changes to picking, navigation, unit grounding and fog. |
| Eco/High and mute controls exist, but there is no saved settings model. | Reuse those controls through the settings model instead of creating contradictory settings. |
| Desktop and touch tests exist, including five phone/tablet dimensions. | Extend these suites with settings and terrain scenarios. Keep physical-device testing as a release requirement. |

## 3. Settings experience

### Entry points and interaction

- Add **Settings** to the briefing and pause menu, with a compact gear button in the header if it fits the 320 px layout. On constrained layouts, use the pause menu rather than crowding the existing buttons.
- Use a dialog with **Army**, **Graphics** and **Audio** tabs. Desktop gets a centered panel; mobile gets a scrollable sheet with accessible Apply/Cancel controls and safe-area spacing.
- Opening settings during play pauses the match and cancels active gestures/placement mode. Capture whether the player was already paused. Closing settings restores the preceding state; it must not resume a previously paused match or start an undeployed game.
- Keep a draft copy of settings. Changes update a preview. **Apply** commits and saves; **Cancel**, Escape or closing without Apply discards the draft. Avoid accidental backdrop dismissal on touch.
- **Reset defaults** changes the draft; Apply is still required. It does not restart or erase the current match.
- Trap keyboard focus within the dialog, label every control, show a visible focus outline, and restore focus to the opening control on close. Aim for 44 × 44 CSS-pixel touch targets.

### Army tab

First release:

| Setting | Proposed behavior |
|---|---|
| Your army color | Eight named presets: Mint, Blue, Cyan, Gold, Orange, Violet, Rose and Ivory. Retain current Mint as the initial player default. |
| Enemy color | Same presets plus the existing Coral default. Reject identical player/enemy selections and show a side-by-side preview for comparison. |
| Preview | Show a Harvester and a building with the selected paint; also show player/enemy minimap samples. Use a paused view or inexpensive preview, avoiding a second continuously running WebGL renderer on phones. |
| Identity markers | Maintain player/enemy labels and distinct marker shapes or insignia so ownership is readable without color alone. Selection adds a bright outline independent of paint color. |

Test every preset against grass, sand, water and fog. Rejecting identical colors alone is insufficient: tune preset pairs and outlines through visual review. Add a curated high-contrast pair as a quick choice. This is a readability feature, not a claim of universal color-vision accessibility.

Optional subsequent improvement: a custom hex color picker with strict `#RRGGBB` validation, a labeled text field and a warning for hard-to-distinguish pairs. Presets should ship first so the small-screen experience stays simple.

Applying a palette updates:

- Paint and team emissive accents on units and buildings, including units still in production.
- Team-colored rings, rally markers, banners, projectiles where appropriate, and HUD/minimap legends.
- Remembered enemy-building markers using a muted version of the selected enemy color, without revealing new information through fog.

Neutral metal, ground, resource deposits, damaged-state effects, and valid/invalid construction feedback retain their semantic colors. Changing army color must not change allegiance, AI behavior, stats, targeting or match state.

### Graphics and audio tabs

- Start with the existing **Eco / High** setting and mute control, plus a master volume slider.
- Add terrain detail, water animation and ambient effects controls as the corresponding systems ship. Do not show nonfunctional controls.
- Keep the header quality/mute shortcuts synchronized with the saved settings.
- Respect reduced-motion preferences for water motion, sway and camera effects. Decorative animation may stop; movement, damage and targeting remain understandable.
- Disabling detail never removes a collision landmark, hides a cliff, changes a crossing, or makes deep water look walkable.

### Persistence and material ownership

Proposed storage record:

```json
{
  "version": 1,
  "playerColor": "mint",
  "enemyColor": "coral",
  "quality": "eco",
  "masterVolume": 0.5,
  "muted": false
}
```

Use a namespaced key such as `frontier-command.settings.v1`; GitHub Pages project sites share an origin, so avoid generic keys. Resolve defaults from primary-pointer detection only when no valid saved value exists. Load settings before creating team materials. Validate known preset IDs, enums and numeric ranges, merge missing fields with defaults, and ignore unsupported versions safely.

Browser storage can be unavailable or throw. Wrap both reads and writes and retain an in-memory preference if saving fails. Tell the player the preference will last only for this session; do not prevent play. Local storage normally survives browser sessions, but browser privacy modes and user deletion affect persistence. [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

Keep one registry of team-owned materials, shared by the team's model instances. Update those materials when applying a palette. Do not clone materials per entity on every color change, and never mutate a neutral material shared by both teams. New spawns must use the current palette automatically. Dispose any temporary preview resources when the dialog closes.

## 4. Ground types and map rules

Add a deterministic map definition containing dimensions, seed, terrain cells, spawn points, resources, static collision shapes and crossing locations. Use the existing 2-meter gameplay grid initially; visual geometry and textures can be finer. Rendering and the minimap read this data, rather than independently painting a different map.

Proposed terrain rules below are initial tuning values, not measured balance results:

| Ground | Appearance | Movement | Construction |
|---|---|---|---|
| Grass | Olive/green patches, sparse tufts and exposed soil | Normal | Allowed on clear ground |
| Dirt | Brown soil with compacted paths | Normal | Allowed |
| Sand/gravel | Pale granular patches with pebbles | Normal in the first release | Allowed |
| Road | Worn compacted earth or concrete strips | Normal first; optional 10% faster in a later balance pass | Block on designated travel corridors |
| Stone/cliff | Large rock faces and rubble at edges | Blocked where collision data marks a cliff | Blocked |
| Mud/wet bank | Dark soil near water | Normal first; optional 20% slower later | Blocked in marked wet zones |
| Shallow ford | Pale water with visible bed and entry banks | Traversable only in marked ford cells; normal first | Blocked |
| Deep water | Darker continuous channel | Blocked for all current units | Blocked |
| Fixed bridge | Clear deck, abutments and rails | Traversable across the marked deck | Blocked |

Implement walkability and construction rules before speed modifiers. If roads/mud later affect speed, movement and A* must both account for them. Use travel-time edge costs and a heuristic bounded by the fastest possible traversal so the search does not overestimate. Apply the same rules to the player and AI.

### Shared queries and integration

Proposed interface, with exact names finalized during implementation:

```text
terrainAt(x, z)
canTraverseSegment(from, to, unitRadius)
canPlaceFootprint(x, z, buildingRadius)
movementFactorAt(x, z, unitType)
heightAt(x, z) // initially 0 for traversable ground
```

- Combine static terrain restrictions with dynamic building obstacles. Rebuilding navigation after a structure changes must preserve water and cliff restrictions.
- Check the whole unit/building footprint and swept movement segment. A valid center point is insufficient at a bank, bridge edge or cliff.
- Update A*, line shortcuts, approach points, formation destinations, local separation, spawn exits, construction validation and AI site selection to use the same terrain rules.
- Preserve no-diagonal-corner-cutting and navigation revision invalidation. Test orders aimed into deep water: resolve to a legal reachable shore or show an unreachable message without a permanent loop.
- Distinguish movement blocking from projectile blocking. Water blocks walking but need not block a weapon fired across it; rock walls can block both. Do not reuse the movement mask blindly for line of fire.
- Decorate after reserving base footprints, deposits and required routes. Trees or rocks with collision must be visible at every quality level. Small grass and pebbles have no collision.
- Assert both bases can reach their starting deposits and at least two attack routes. Keep the original scenario as a fixture while map balance is evaluated.

## 5. Water and Riverlands layout

### Map composition

Keep the opposing bases in their current corners. Sketch a narrow central stream with a wide main bridge, a second flank bridge and a shallow ford. Preserve room for an army to assemble on each bank and keep initial mining areas dry. Crossing widths must be checked against unit radii and formation sizes on the 2-meter grid; narrow decoration must not contradict the actual traversable area.

Use a symmetrical gameplay layout for the first pass, with varied decoration to make the scene feel natural. Run reachability tests on the exact authored cells before spending time on water polish. Protect crossing decks and approaches from construction that would seal every route.

### First water implementation

- Generate channel geometry from the map definition. Lower its bed below the flat walkable surface, with water slightly below the banks; keep bridge decks and traversable ford contacts at the existing gameplay height for this phase.
- Give shallow and deep water visibly different colors. Use bank geometry, wet soil and a narrow shoreline strip to make depth and boundaries readable.
- Animate a small repeating ripple/normal pattern and a restrained highlight. Use simple tint/specular shading for Eco. High may add a second ripple layer and limited foam; real-time reflection passes are deferred until profiling justifies them.
- Keep transparency and particle overlap limited. Check render ordering against selection rings, contact shadows, fog and weapon effects. Water and shoreline details must remain covered by unexplored fog.
- Show crossings and explored water on the minimap using the same terrain data. Do not let effects or a separate water overlay reveal unexplored units/resources.
- Add pooled splash particles only when a moving unit is actually in a ford, with cooldown and density limits. Stop particles and optional water motion while paused or hidden.

A blue plane alone is not a finished water feature: completion requires navigation, building restrictions, readable banks, useful crossings, minimap integration and successful AI traversal.

## 6. Blender assets and visual realism

Use the existing reproducible Blender Python workflow and commit both editable sources and exported GLBs. Blender remains an authoring tool; the deployed game only needs exported assets. A Blender MCP connection is optional if available later and is not a prerequisite for this work.

Initial asset budgets are targets per exported mesh, to be checked in the manifest:

| Asset family | Variants | Triangle target | Material/placement notes |
|---|---:|---:|---|
| Rock clusters | 4 | 150–700 | Shared stone material; align visible footprint with collision |
| Grass/reed clumps | 3 each | 30–180 | Reusable geometry; avoid excessive layered transparency |
| Bushes | 3 | 150–500 | Shared atlas or simple color materials |
| Trees | 3 | 500–1,500 | Simple distant variant; blocking trunks remain visible in Eco |
| Bridge segments and abutments | 1 modular set | 800–2,500 per assembled bridge | Deck at agreed traversal height; collision authored separately |
| Crates, pipes, debris | 6 | 80–400 | Place around bases without blocking working space |
| Bank/cliff modules | 4 | 200–1,000 | Hide seams, use consistent scale and ground-level pivots |

For existing armies, improve perceived realism through roughness variation, restrained metal response, panel lines, small bevels and subtle wear. Preserve recognizable team-painted sections. Bake complex Blender material detail into exportable textures and validate the GLBs in the actual Three.js viewer. Do not assume arbitrary Blender procedural shader nodes transfer to the browser.

Use tiled ground textures with soft surface transitions, rather than adding dense geometry everywhere. Start with 512–1,024 px texture sets and shared prop atlases. Add normal/roughness detail where it remains visible from the RTS camera. Use original or clearly licensed assets and record provenance; do not copy Age of Empires or StarCraft assets.

For repeated grass, reeds and props, batch shared geometry/materials by terrain chunk. Three.js `InstancedMesh` is intended to reduce draw calls for repeated objects; it does not eliminate triangle count, overdraw or material cost. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

Later polish, after the map is functional:

- Consistent warm sun/cool ambient light, contact shadows and reduced uniform brightness.
- Bounded dust on dry paths, sparks at impacts, and smoke from visibly damaged structures.
- Wind sway and positional stream/wind ambience at low volume, with mute and reduced-motion behavior.
- More intentional attack/death animations before increasing model polygon counts substantially.

## 7. True elevation: separate follow-up

Do not add arbitrary visual hills under a simulation that assumes a flat plane. A later elevation phase must cover all of the following together:

1. One height field for terrain rendering, contact positions and navigation slope limits.
2. Unit/building grounding and stable foundations; no floating feet or embedded structures.
3. Terrain raycasting for mouse/touch commands, placement previews and minimap viewport projection.
4. Ramps and bridge approach connectivity, with size-aware clearance.
5. Selection rings, shadows, resource positions and effects conforming to the surface.
6. Fog rendering over raised terrain without clipping or leaking information.
7. Explicit high-ground visibility and combat rules. Visual elevation alone should not accidentally grant hidden bonuses.

Keep cosmetic background cliffs outside playable routes until this phase is ready.

## 8. Code organization

| File/module | Planned work |
|---|---|
| New `src/settings.js` | Defaults, schema validation, draft/apply state and safe storage |
| New `src/team-palette.js` | Presets and team color variants for paint, glow, outlines and remembered markers |
| New `src/settings-ui.js` | Accessible settings dialog and preview lifecycle |
| New `src/terrain.js` | Terrain definitions and shared traversal/placement queries |
| New `src/maps/meridian-riverlands.js` | Versioned deterministic map content and crossings |
| New `src/terrain-view.js`, `src/water-view.js` | Terrain visuals and quality-scaled water; separate from simulation |
| `src/main.js` | Settings entry points, pause restoration, palette/minimap integration and scenario choice |
| `src/view.js` | Team material registry, quality integration, terrain/water components and resource disposal |
| `src/navigation.js`, `src/simulation.js` | Terrain-aware routes, placement, production exits and AI |
| `src/style.css`, `src/mobile.css` | Settings tabs/sheet, readable swatches and compact-header layout |
| `tools/blender/`, `assets/source/`, `public/models/` | Reproducible environment assets and manifest budgets |
| `public/textures/`, `public/audio/` | Local textures/ambience with source/license records |
| `tests/` | Settings, terrain, navigation, AI, desktop/touch and quality regressions |

The simulation never reads CSS, the renderer, browser storage or cosmetic quality flags. Map rules are identical across Eco and High. Keep Three.js pinned initially; avoid coupling this feature work to an engine upgrade.

## 9. Milestones and acceptance gates

Effort values are relative planning sizes, not promised delivery dates.

| Milestone | Effort | Deliverable and gate |
|---|---|---|
| A. Settings and colors | Small–medium | Dialog works before/during a match; Apply/Cancel/defaults/persistence are correct; every current/future unit and team marker uses the selected palette; no resource or AI change. |
| B. Terrain foundation | Medium | Classic map migrated without changing its gameplay; new surface types visible; shared footprint rules and all original tests pass. |
| C. Riverlands water | Large | River, two bridges and ford agree visually and logically; no land unit walks in deep water; no structures on crossings/wet banks; both armies and workers navigate correctly. |
| D. Environment polish | Medium | Blender prop pack, improved materials, bounded effects and ambience; Eco remains readable and all terrain blockers remain visible. |
| E. Acceptance and release | Medium | Both scenarios complete a normal skirmish; desktop/touch/persistence tests pass; physical-device performance is measured; Pages build passes and the deployed URL is checked. |
| F. Elevation | Large; deferred | Complete height-aware integration described above, after a separate map/navigation review. |

Recommended first implementation slice: **Milestone A only**, followed by B and C as separate reviewable changes. This gives players a useful settings feature quickly while terrain navigation receives its own validation.

## 10. Tests and performance budgets

### Functional tests

- Validate settings defaults, valid saved values, malformed JSON, unsupported versions, blocked storage, same-color rejection, draft cancellation and Apply persistence.
- Change colors, produce a unit, destroy a unit, restart a match and reload the page. Confirm palette consistency and unchanged simulation results.
- Reopen settings repeatedly without growing material counts or event listeners. Test pause restoration from briefing, active play, pause and result screens; result screens must never resume simulation.
- Check all preset pairs visually on grass, sand and water, including minimap, selection and fog. Verify identity using labels/shapes as well as color.
- Test bridges, shore boundaries, diagonal movement, whole construction footprints, production exits and reachable approach points. A building/navigation rebuild must not unblock water.
- Run normal gathering, army production, AI attack and victory/defeat on both Classic and Riverlands. Include simultaneous large groups at crossings and blocked/unreachable commands.
- Test touch selection and placement near shorelines; settings scrolling must not pan the battlefield. Exercise portrait/landscape rotation while settings are open.
- Reuse 1440 × 960 desktop and 390 × 844, 844 × 390, 320 × 568, 667 × 375 and 768 × 1024 touch layouts. Check real iOS Safari and Android Chrome before claiming physical-device support.

### Proposed performance gates

Targets require measurement on named devices and are not guarantees:

- Desktop: aim for 60 FPS; phone Eco: aim for 30 FPS in a normal skirmish. Record median/p95 frame time, unit count, viewport, pixel ratio, GPU and graphics preset.
- Compare the existing 100-unit desktop scenario and a representative 40-unit phone battle before and after each environment milestone.
- Keep incremental environment draw calls below approximately 100 in Eco through batching/instancing. Profile baseline army draw-call cost separately; the existing 100-unit scene already has substantial draw calls.
- Begin with a combined environment model/texture download budget of 8 MB, preferably less; measure compressed transfer and decoded texture/GPU memory separately.
- Use one restrained water surface system, bounded particle pools, shared materials, chunked decoration and distance-based detail. Add no reflective water render pass in the first release.
- Check stable memory/material/geometry counts after five settings cycles and five match restarts. Compare post-cleanup values, allowing persistent shared assets and caches.
- If a target fails, first reduce decoration, effects, shadow cost and texture density while keeping terrain silhouettes and team recognition intact.

## 11. Delivery checklist

- [ ] Settings/color slice implemented and reviewed.
- [ ] Terrain data, visual surfaces and movement/placement rules agree.
- [ ] Water/crossing scenario passes player and AI tests.
- [ ] Blender exports, source files, asset budgets and license records committed.
- [ ] Eco/High and desktop/mobile checks recorded with their actual scope.
- [ ] README controls, screenshots, review notes and verification record updated.
- [ ] Existing and new tests gate the GitHub Actions build.
- [ ] Push reviewed implementation over the existing SSH origin and verify GitHub Pages after deployment.

Implementation status and release verification are tracked in [EVALUATION_AND_RELEASE.md](EVALUATION_AND_RELEASE.md). Optional advanced features and physical-device certification are not marked complete.
