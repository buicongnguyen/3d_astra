# Logic and code review — desktop and mobile

## 2026-09-24 review: game logic, renderer and Blender asset overhaul

Scope:
- **Simulation:** orders, combat, economy, AI, navigation and progression.
- **Client:** input ownership, event handling, lifecycle, rendering and model loading.
- **Assets:** the Blender pipeline. All thirteen unit and structure models and the scenery were rebuilt; see [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

Every finding below was reproduced before it was fixed.

### Confirmed issues and fixes

| Severity | Finding and player impact | Resolution | Coverage |
|---|---|---|---|
| High | **AI construction stalled permanently when its builder died or gave up.** The AI only starts a structure when none is unfinished, and nothing reassigned an orphaned site. Reproduced: a relay stayed at 0% and the AI built nothing for 200 s, so it stopped growing supply for the rest of the match. | The nearest Harvester is reassigned. A site is cancelled, with the standard 75% refund, only after three reassignments that made no progress. Builders killed on a reachable site never exhaust the retries, and time spent without any free Harvester does not count. | `review-2026-09.test.js`: builder death, repeated deaths, unreachable site |
| High (performance) | **A\* scanned its open list linearly.** One cross-map path cost 15–20 ms on the 160/192 maps. Placing or losing any structure makes every moving unit replan in the same tick, so about 50 units stalled a frame for roughly one second. | Binary-heap open list and cached vehicle-clearance checks bring a path down to 1–1.7 ms. Route lengths are unchanged. | Timed highlands route test; all 102 prior logic tests unchanged |
| Medium | **Attacks on screened targets were silently dropped.** A unit in range whose line of fire was blocked by a rock or building walked into the obstacle, never fired, and after six seconds the order was cleared as "cannot reach". | The unit searches rings around the target for a standable point with a clear shot, cached per target and navigation revision. Arriving still screened, or 3 s without progress, moves on to a closer ring. When every ring fails, an attack order ends with a message and an attack-move passes the target and keeps advancing. | Screened relay, fully enclosed target, attack-move past it |
| Medium | **One scout could recall the whole AI army.** Any visible enemy within 25 units of the AI core, even a single Harvester, re-ordered the entire army every 2.5 s, cancelling attack waves from across the map. | Threats are weighted. A minor incursion is answered by defenders within 40 units, or by the two closest units when none are home, and attack waves continue without them. A real incursion (power ≥ 4) still recalls everything. | Lone-scout, no-defender and real-incursion tests |
| Medium | **Half of the tower and Breaker guns did not aim or recoil.** GLTFLoader renames Blender's `Barrel.001` to `Barrel001`, which the rig pattern rejected. One tower barrel tracked targets while the other stayed fixed. | `RIG_PART` accepts sanitised suffixes. The new tower's whole head (`Turret_head*`) turns with its barrels. | `assets.test.js` |
| Medium | **Large maps lost shadows.** The shadow frustum was fixed at ±65 around the origin, so on Obsidian Highlands the player's whole base (≈ ±61, ±60) and the map edges had no shadows in High quality. | The shadow frustum follows the camera focus, is sized to the farthest visible ground corner at the current zoom and aspect, and is snapped to shadow texels so edges do not shimmer while panning. | Maximum zoom-out captures on Ashen Frontier and Obsidian Highlands |
| Medium | **Fogged deposits could not be gathered.** Explored deposits are drawn under fog, but picking ignored them, so right-click or tap issued a plain move and Harvesters stood idle. | Any deposit that is drawn can be picked. | Desktop and mobile browser suites |
| Low | **Units moved in visible 20 Hz steps** on 60–240 Hz displays. | Positions and headings interpolate between the last two simulation ticks. This happens only from a snapshot exactly one tick old, never across a teleport, and with the blend held while paused. | Browser suites |
| Low | **Presentation assumed the 96-unit map.** Landing pads ignored the base offset (drawn about 17 units off on Basin and Dunes), the G grid always had 48 divisions, and ground scatter covered only ±47. | All derive from the active terrain. | Browser captures |
| Low | **Markers and effects kept fading while paused.** | Presentation time stops while paused. | Browser suites |
| Low (latent) | **Breaker splash used the primary target's multipliers.** Counter and anti-vehicle bonuses were applied to every splash victim. | Multipliers are per victim. | Splash multiplier test |

### Follow-up review of this change set

A second review of the diff found ten problems in the first round of fixes and art integration. All were verified and fixed before release:
- **AI defence and waves:** a minor threat with no defenders at home was ignored, and it also blocked every later attack wave.
- **Construction retries:** the counter grew during stretches with no free Harvester and never reset after progress.
- **Firing positions:**
  - With every candidate blocked, a unit waited forever, because arrival never counts toward the movement stall.
  - The last-resort point was not checked for standability.
- **Black ruins:** the backdrop ruins reused the new vertex-coloured hill material on boxes without colours, which renders black.
- **Boulder footprints:** boulders were drawn larger than their collision circle, so units clipped into them. They are now scaled from each model's measured footprint.
- **Shadow frustum:** it kept a fixed ±65 extent and was not texel-snapped.
- **Interpolation:**
  - It could use a stale snapshot after ticks run outside the frame loop.
  - Units snapped back and forth when pausing.
- **Terrain scatter:** it depended on model load timing, and pebbles and grass sat inside rocks.
- **Leak:** the room scene used to bake the reflection map was never disposed.

**Test change:** `tests/mobile.mjs` asserted that alloy was exactly unchanged while Harvesters were gathering in real time. The new pathfinding breaks ties between equal-length routes differently, which moves a +10 delivery into that window. The assertion now checks the intent, that the placement preview never spends (a relay costs 100).

**Checked and found correct:**
- Every client command path filters to the player's own entities.
- `sim.events` is drained every frame.
- Restart and map changes dispose models and terrain.
- Tab hiding pauses the game.

### Assets and rendering

The previous models were 450–1,050-triangle box assemblies with flat colours. The new set was authored live in Blender 4.5.9 through MCP for Blender and is reproducible headless:
- bevelled hard-surface geometry with weighted normals;
- PBR materials;
- ray-traced AO, edge wear and grime baked into vertex colours;
- new infantry with posed, weapon-gripping arms;
- tracked vehicles with fenders, road wheels and skirts;
- detailed structures;
- faceted boulders and crystal deposits that replace the three.js placeholders;
- a truss bridge.

The renderer adds a PMREM reflection environment to model materials only; the terrain lighting is unchanged. Terrain surface borders are softened. Muzzle positions and tracer origins match. Budgets are listed in the pipeline document.

### Verification

- 109 logic tests pass, including the new regression and asset-contract tests.
- The production build succeeds.
- All 17 browser suites used by CI pass against the production build.
- Before/after captures were compared at the same camera.
- Both versions render at the 60 fps vsync cap on the development GPU (desktop High and the phone-sized Eco layout). That shows no regression there; it does not measure headroom.

Physical phones were not profiled.

### Open recommendations (not changed in this pass)

1. **Ownership in the simulation API.** `issue`, `enqueue`, `cancelQueue` and `cancelBuilding` trust the caller's team; `upgradeBuilding` and `cancelLevel` already check it. The UI filters correctly today, but authoritative multiplayer ([plan](docs/INTERNET_MULTIPLAYER_PLAN.md)) needs these checks in the simulation.
2. **Scale.**
   - Unit separation and target scans are quadratic.
   - `Simulation.get` is a linear search.
   - Each unit draws as 10–14 meshes without instancing.

   A spatial hash, an id index and per-type instancing are the next performance steps for large battles.
3. **Desktop input edge cases.**
   - **R with a mixed selection:** the build tile wins over the advertised Support hotkey.
   - **Backspace with several buildings selected:** it cancels on the first building selected, not the focused one.
   - **Hover label:** it goes stale when the mouse is still and the hovered unit dies or enters fog.
4. **Art.** Texture baking (normal and roughness), per-unit animation beyond the legs, and faction-specific silhouettes are the remaining steps toward hand-authored AAA art. The procedural pipeline is designed to accept them.

---

Subsequent settings/Riverlands review and fixes: [EVALUATION_AND_RELEASE.md](EVALUATION_AND_RELEASE.md). The original mobile review below is retained as historical context.

Reviewed 2026-09-08. Scope: simulation, navigation, browser input, rendering lifecycle, responsive HUD, tests, and GitHub Pages deployment. Changes preserve the original Three.js/Blender project and the deferred Godot plan.

## Findings and fixes

| Severity | Finding and player impact | Resolution | Regression coverage |
|---|---|---|---|
| High | Narrow/short screens were covered by a blocking overlay, and commands required right-click/keyboard input. Mobile users could not play. | Removed the overlay. Added touch command controls, compact panels, portrait/landscape layouts, safe-area spacing, scrollable dialogs, and construction confirmation. | Touch integration suite at five phone/tablet sizes; actual taps, pans, pinch, cancellation, selection and construction. |
| High | Production reserved supply when queued but did not recheck supply at completion. Destroying a relay could allow queued units to bypass the current cap. | Hold completed units until capacity exists; show Awaiting supply. Research has no population requirement. | Destroy supply during production, verify blocked queue, restore supply, verify spawn; research while over cap. |
| High | Line checks compared an omitted ignored ID with rocks' missing IDs, accidentally skipping all rocks. Active movement routes could also outlive a newly placed obstacle. | Only skip an explicitly ignored ID. Navigation revisions invalidate routes; swept movement checks prevent crossing obstacle footprints. | Rock line/segment checks; place an obstacle across a live route and verify arrival without penetration. |
| Medium | An absent original builder could retain the construction lock while another worker waited at the site. | A lock requires an active builder within working range. A nearby worker can take over. | Construction handover test. |
| Medium | Invalid target kinds, friendly attack targets, nonfinite positions and unbounded queued orders could reach simulation logic. | Validate orders and positions, deduplicate unit IDs, bound order queues to 32, and validate worker/combat targets again during execution. | Invalid order/target/coordinate tests, duplicate IDs and queue limit. |
| Medium | Rendering and FPS used the same clamped delta, overstating FPS on slow hardware and slowing simulation at moderately low frame rates. | Measure FPS from wall time. Permit up to five fixed simulation ticks per render frame; retain a bound after long stalls. | Code inspection plus desktop render sample; no claim of real-phone performance. |
| Medium | Touch availability alone classified a mouse-controlled Windows computer as a phone. | Detect the primary pointer for initial controls and graphics; switch when an actual touch occurs. Narrow mouse windows can use the compact HUD. | Desktop browser on a host reporting ten touch points while its primary pointer is fine; touch-emulated contexts. |
| Medium | High device pixel ratios and dynamic shadows raise rendering cost substantially on phones. | Eco mode caps pixel ratio at 1, uses contact shadows, and disables shadow maps. High mode remains available. ResizeObserver updates the camera and renderer when the HUD changes. | Retina touch emulation verifies pixel ratio, graphics toggles, viewport rotation, and asset/error checks. |
| Low | Queue cancellation could still refund resources after the match ended. | Completed matches reject new orders, production, building and cancellation mutations. | Terminal-state mutation regression test. |

## Input design and code structure

- `touch-controls.js` owns pointer capture and gesture state. A drag/pinch never becomes a command tap; pointer cancellation, lost capture, rotation, pause and hidden tabs clear gesture state.
- DOM controls retain native button interaction. Canvas disables browser touch scrolling/zooming so gestures control the game. Panels can still scroll.
- Mouse input keeps left-click selection/box selection, right-click commands, wheel zoom, hotkeys and control groups. Touch input uses tap selection/context commands, an explicit box mode, queue toggle, force-selection buttons and command-panel tabs.
- Construction previews do not charge resources. On touch, **Build here** validates placement again before spending, so an invalid or stale preview cannot create a structure.
- The existing stable queue IDs/DOM updates remain intact; progress refreshes cannot detach a cancellation button mid-click.
- The simulation remains independent of Three.js and DOM input. All assets remain local to the static build; no server or runtime CDN was introduced.

## Verification and remaining limits

See [VERIFICATION.md](VERIFICATION.md) for executed checks and hardware scope. The Pages workflow gates deployment on simulation, desktop browser, and Chromium mobile interaction tests.

No unresolved release-blocking issue was found in the reviewed flows. This is a prototype review, not a proof of correctness. Navigation uses a coarse grid and common movement clearance, circular footprints, and pairwise unit separation. Combat target scans and separation are quadratic as armies grow; spatial indexing and more instancing remain the next performance work. Large battles and device thermal/memory limits require physical phone profiling.

Mobile browser emulation does not certify physical iOS Safari or Android Chrome. Browser chrome, virtual keyboards, notches and device-specific GPU drivers should receive a real-device acceptance pass. No multiplayer, saved matches or offline service worker is included.

## Implementation references

- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) — canvas gesture ownership versus browser scrolling.
- [MDN: pinch zoom with Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures) — tracking simultaneous pointers.
- [MDN: pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) — interruption handling.
- [Three.js responsive rendering](https://threejs.org/manual/en/responsive.html) — matching renderer and camera to display size.
