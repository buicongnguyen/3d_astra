# Scenario and environment improvements

Date: 19 September 2026  
Status: proposed design; gameplay changes are not implemented by this document.

Priority clarification: improve explosions, gunfire, background and color first.
See [the visual combat improvement plan](VISUAL_COMBAT_IMPROVEMENT_PLAN.md) for the
comparison with the Tank game and recommended work before scenario expansion.

## Reference review

Reviewed the local `C:/Users/n/source/repos/Tank_game_3D` repository, especially
`src/three/environment.ts`, `frontier-environment.ts`, `frontier-surfaces.ts`,
`terrain.ts`, `campaign.ts`, and the frontier campaign/art plans. This is a source
and design review, not a new visual playtest or physical-phone performance test.

The useful ideas are biome-specific ground, sky and sunlight palettes; recognizable
Blender landmarks; small shared procedural surface textures; reserved routes that
decoration cannot obstruct; and missions with distinct objectives. Its source
includes capture, escort, defense, assault and boss missions, with glacier,
volcanic, desert, jungle and city environments among its settings.

Frontier Command already has seven maps, configurable armies, tanks, anti-tank
infantry, support units, construction, harvesting, fog and mobile controls.
However, `src/maps.json` largely varies size, resource sites, biome and river flags.
`src/terrain.js` shares crossing positions and road formulas across maps. Existing
match victory depends on surviving Command cores; adding campaign objectives
requires simulation work, not just adding map names to a menu.

Adapt the Tank game's environment techniques to RTS readability. Do not transfer
its quarter-speed sand traps, strong ice inertia or very slow mud directly: these
would undermine formation movement, retreat micro and reliable harvesting.

## Six scenario proposals

Sizes and mission durations below are starting design values, subject to playtests.
Each map first ships as ordinary skirmish; its optional mission follows later.

| Scenario | Background and terrain | Tactical layout | Optional mission |
| --- | --- | --- | --- |
| **Amber Dunes — Oasis Supply** (existing, 128×128) | Wind-marked sand, rocky outcrops, sparse palms and an abandoned pump station; distant dunes outside the playable boundary | Two expansion oases, a broad central road and two flanking routes. Preserve viable starting deposits for every faction | Escort three supply transports along a clear road; protect at least two and the player's core. Engineer repair gives support units a role |
| **Verdant Crossing — River Watch** (existing, 160×160) | Layered riverbanks, opaque water, reeds, broadleaf groves and old bridge supports | Distinct broad bridge routes plus a longer ford route. Dense tree decoration stays outside combat and harvesting corridors | Capture and hold two of three relay sites simultaneously for 90 uncontested seconds; both player and scripted rival can win |
| **Obsidian Highlands — Mining Frontier** (existing, 192×192) | Fractured basalt, exposed mineral seams, quarry ruins and distant ridgelines | Three resource-rich expansion pockets, wide tank approaches and alternate infantry paths; keep the central routes open | Deliver a target quantity of newly harvested resources while surviving attacks. Count deliveries, not starting funds or refunds |
| **Polar Relay — White Horizon** (new, 160×160) | Snow patches, blue ice, glacier outcrops and a research station; clear unit silhouettes against pale ground | Safe roads connect bases and expansions; ice is visual only in the first release, with no forced sliding | Protect the research relay for eight minutes through announced waves; loss of the relay or all player cores ends the mission |
| **Cinder Basin — Furnace Line** (new, 160×160) | Dark volcanic ground, cooled lava channels, basalt and an off-map crater landmark | Two broad attack lanes and a central contested resource pocket. Glowing lava must either be outside the playable area or visibly blocked by shared collision data | Destroy two fortified enemy foundries and their command core; introduce armor-versus-anti-tank choices without unavoidable environmental damage |
| **Citadel Ruins — Broken Capital** (new, 160×160) | Low ruined blocks, cracked streets, plazas, rubble and restrained industrial details | At least two connected routes between bases, turning space for tanks and open buildable plazas. Keep tall silhouettes near map edges | Sequential assault: secure an outer relay, then destroy the defended command core. Announce each phase without adding a permanent large HUD panel |

Recommended order: **Amber Dunes**, **Verdant Crossing**, **Citadel Ruins**, then
Highlands, Polar and Cinder. The first two improve existing maps quickly; the city
adds a strongly different setting without needing hazardous terrain simulation.

## Environment work

- Give each biome a coordinated ground, water, fog and light palette. Atmospheric
  fog must remain distinct from gameplay fog of war and must not conceal targets.
- Use small repeating surface textures, restrained ground decals and clustered
  props. Favor readable landmarks over uniformly scattering decoration everywhere.
- Keep simulation terrain flat in the first release. Suggest elevation using
  outcrops and distant scenery; real ramps and height advantages require matching
  movement, visibility, weapon and placement rules in both engines.
- Make scenery classes explicit: passable decoration, blocking terrain, and mission
  objects. A large solid-looking ruin cannot silently be passable. Decorative
  outlines must not resemble selection, harvesting or attack markers.
- Reserve spawn areas, production exits, base expansion space, resource approaches,
  bridge entrances and mission routes before placing props. Include the largest
  unit radius and formation clearance when calculating reservations.
- Start with shared GLB kits for palms, broadleaf trees, basalt, glaciers, low ruins
  and a neutral relay. Inspect source models, licensing, scale, pivots, materials,
  collision footprints and Low variants before selectively reusing any Tank assets.
  Keep reproducible Blender scripts and editable source files.

## Implementation phases

### 1. Data and visual foundation

Extend `github-io/src/maps.json` with versioned biome, road, crossing, landmark,
resource and scenery-reservation data. Preserve current map IDs and saved selection.
Make `terrain.js`, navigation, minimap, building placement and environment rendering
consume the same region definitions; replace fixed crossing assumptions carefully.

Update `environment-view.js` and `view.js` to support the biome kits and authored
layouts. First improve the existing desert and woodland maps with no economy,
weapon or movement changes. Retain the other existing maps as regression baselines.

### 2. New skirmish maps

Add Citadel, Polar and Cinder, initially with the existing core-destruction rules.
Every selectable enemy count (one to three in Three.js) needs reachable starts,
comparable initial resources and distance to expansions, and functioning AI routes.
If a layout cannot support a faction count, disclose and disable that combination
in setup rather than spawning overlapping or trapped armies.

Keep neutral mission landmarks decorative in skirmish. Do not introduce campaign
income advantages into free-for-all games.

### 3. Optional scenario rules

Separate **Skirmish** from **Scenarios** in setup. Each scenario declares supported
factions, teams, starting units, objective stages, success/failure conditions and
briefing text. Initially author missions for a fixed player-versus-scripted-enemy
setup; do not pretend the existing enemy-count selector balances these missions.

Add an objective state machine to the simulation, with a single match-end decision
per tick. Define defeat precedence when the player's last core and a mission target
die simultaneously. Timers use simulation time and stop during pause. Restart clears
waves, capture ownership, timers and deliveries; completed missions reject further
rewards and commands. Use stable scenario IDs for progress rather than array indexes.

Capture: combat units occupy the zone; contested zones stop the timer; builders and
production buildings cannot capture remotely. Escort: transports use normal pathing,
wait at blocked routes, expose HP and can be repaired; scripted waves cannot spawn
inside the transport's footprint. Survival: cap active attackers and use reachable
spawn corridors. Announce waves in advance. Economic objectives count actual resource
delivery events exactly once, excluding training cancellation and construction refunds.

Use a compact objective icon plus counter/timer. Keep longer briefing text in the
existing expandable objective view, collapsed by default on phones. Selection,
queue cancellation and building-progress indicators keep their current stable layout.

### 4. Godot parity

After the first Three.js map improvements are accepted, port the same definitions,
GLBs, palette and collision footprints to `3d_astra_godot`. Its renderer is independent;
do not copy Three.js scene code directly. Port mission rules after the data format and
state transitions are stable. Compare scripted outcome traces between engines and
document any faction-count limitation instead of silently changing mission rules.

## Performance targets and verification

Provisional targets, to be checked against a measured baseline:

- Load only the selected biome's kit. Target at most 3 MB of additional detailed
  environment assets or 1.5 MB for Low per selected biome, excluding existing units.
- Share geometry/materials, instance repeated props, and bound particles and scars.
  No per-prop lights, real water simulation or physics rubble. Low disables decorative
  weather and small ground detail; collision, objectives and visibility stay identical.
- On the same Android Chrome device and battle, target no more than a 10% increase
  in median and p95 frame time against the current map. If the baseline is already
  slow, reduce scene cost before adding effects. Browser emulation is not phone FPS.
- Test routes from every start to all expansions, objectives and map corners with
  infantry and tanks. Verify builder reachability, production exits, resource delivery,
  and safe recovery when dynamic buildings block a preferred route.
- Test right-click retreat during combat, queued orders, patrol, support, resource
  selection rings, harvesting feedback, construction cancellation and fog correctness.
- For missions, test success, defeat, contested capture, duplicate events, simultaneous
  deaths, pause, restart and old-save migration. Low and Detailed must produce identical
  simulation outcomes for identical inputs.
- Visually inspect an active battle and the largest queue on desktop, Android portrait
  and Android landscape. Check that props do not hide units or intercept ground input.
- Run focused checks per phase, then the existing deployment suite once per release.
  Publish Three.js first, verify the deployed revision, then release Godot parity.

## Deferred ideas

Dynamic floods, slippery ice physics, destructive earthquakes, falling volcanic rocks,
height-based attack bonuses and destructible bridges are later experiments. Each changes
pathfinding or fairness substantially; none is needed for the first visual refresh.
