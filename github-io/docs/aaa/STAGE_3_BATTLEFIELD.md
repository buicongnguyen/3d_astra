# Stage 3: battlefield depth

Read [README.md](README.md) first. Goal: where an army stands changes whether it wins. Today the ground is flat: `src/terrain.js` gives each 2 m cell a surface (`grass`, `road`, `water`, ...), `src/maps.json` holds only size, river, biome and expansion sites, and the view draws one flat `PlaneGeometry` (`src/view.js`, near "Surfaces, accent patches"). Release as 0.14.0 (height and cover), 0.15.0 (weather, maps), 0.16.0 (air, if approved).

This stage changes pathfinding and vision, the two most delicate systems. Keep each package behind map data: a map with no plateaus, cover or weather must behave exactly as before, and the `sim.hash()` of a 60 s match on `classic` must not change until package 3.4 edits that map.

## Package 3.1: terrain height

**Model.** Two levels only: ground (0) and plateau (1, drawn 2.4 m higher). No slopes in the rules, only ramps.

**Data** (`src/maps.json`, per map, optional):
```json
"plateaus": [
  { "shape": "disc", "x": -20, "z": 14, "r": 11, "ramps": [ { "angle": 200, "width": 6 } ] },
  { "shape": "box", "x": 30, "z": -8, "w": 18, "d": 12, "ramps": [ { "side": "south", "at": 0, "width": 6 }, { "side": "east", "at": 2, "width": 6 } ] }
]
```
Symmetric maps list each plateau once with `"mirror": true` (point mirror through the origin, like bases).

**Rules**
- `Terrain.level(x, z)` returns 0 or 1. `Terrain.at` is unchanged.
- **Movement:** a cell edge between different levels is a cliff and blocks movement, except inside a ramp. Implement in `src/navigation.js` as blocked links, not blocked cells, so units can stand right at a cliff edge: either mark the cliff ring cells as blocked (simplest; cliffs then take one 2 m cell of space) or add an edge test to `canTraverse`. Choose the cell ring unless it makes ramps narrower than 4 m. Buildings cannot be placed on a ramp or across a cliff (`Terrain.placement`).
- **High ground** (numbers under `balance.json` `terrain`): a unit on level 1 attacking a target on level 0 has +2 range and +20% damage; a unit on level 0 attacking up has −15% damage. Towers get the same.
- **Vision** (`src/sim/vision.js`): a viewer on level 0 does not see level 1 cells further than 5 m from the cliff edge, unless a friendly unit is on that plateau. A viewer on level 1 sees +3 m further.
- **AI:** prefers plateau cells for towers within its base area, and treats ramps as the approach when attacking a plateau (the pathfinder does this already; add no special code unless the bench shows units stuck).
- Entities store nothing new; level is derived from position. Saves are unaffected.

**View**
- The ground mesh is displaced by level with a short smooth step; a cliff skirt mesh (one draw, map rock colour, vertex-coloured) is generated along plateau edges; ramps are a visible wedge with the road surface.
- Every placed object's `y` follows `terrain.heightAt(x, z)` (a smooth render height: 0, 2.4 or the ramp interpolation): units, buildings, contact shadows, selection rings, health bars, effects in `src/fx.js`, scatter (`src/scatter.js`), capture rings, the fog mesh, emblems, minimap shading (plateaus drawn slightly lighter).
- Picking (`src/app/input-pointer.js`): ray against the height surface, not the y = 0 plane. Building-placement ghost follows height.

**Tests**
- Unit (`tests/terrain-height.test.js`): level lookup for disc and box, mirror; no path crosses a cliff, a path exists through each ramp; range and damage bonuses; vision rule; placement refused on ramps; a map without plateaus hashes as before.
- Stuck-unit stress (the existing soak test) on a map with plateaus: no more stuck units than before.
- Browser (`tests/terrain.mjs`, new): tap on a plateau moves a unit there; units and rings sit at the right height (compare projected positions); the three viewports; `npm run test:render-budget` before and after.

## Package 3.2: cover

**Data** (`src/maps.json`): `"cover": [ { "type": "woods" | "ruins", "x": 0, "z": 0, "r": 7, "mirror": true } ]`.

**Rules** (`balance.json` `terrain.cover`)
- Infantry (classes `melee`, `ranged`, `antiarmor`, `support`, `worker`) inside cover take 30% less damage from attacks whose source is outside that cover zone and further than 3 m. Splash and burning ground ignore cover.
- Woods slow vehicles by 25%. Ruins block nothing but cannot be built on.
- A unit inside woods is seen only from within 8 m, unless it has attacked in the last 3 s.
- The AI rallies waiting infantry inside cover near its rally point when one exists.

**View.** Woods are a dense ring of the existing tree and bush instances (`src/scatter.js`, same batches, seeded); ruins are a new low-poly scenery set generated in `tools/blender/generate_environment.py` (`asset_ruin_*`, 300 triangles each, instanced). A unit in cover shows a small shield-leaf mark on its health bar. The ground under cover is tinted so the zone edge reads on phones.

**Tests.** Unit tests for each rule and for save and load; `tests/terrain.mjs` extended (the cover mark appears, the tint is visible, sizes at three viewports).

## Package 3.3: weather

**Rules**
- `sim.weather` is `"clear"`, `"storm"` or `"dust"`, saved. Changed by a new mission action `{ weather: "storm" }` (`src/sim/missions.js`, document in `docs/MISSIONS.md`) and, in skirmish, by an option "Weather: Clear, Changing". "Changing" switches every 150 to 240 s using `sim.rng` (added here; see rule 1 in the README) and emits a `weather` event 10 s before as a warning.
- Storm: vehicles −20% speed, all vision −25%, shields recharge −50%. Dust (desert maps): ranged range −15%, vision −20%. Numbers under `balance.json` `weather`.
- The top bar shows the weather icon and, on change, a one-line notice with the effect.

**View and sound.** GPU rain or dust (one instanced draw, positions animated in the vertex shader, count scaled by quality: 0 in Eco, where only the tint and fog change), darker ambient light, wind on existing scatter if it sways, a rain or wind loop in `src/audio.js`. Respect `combatMotion` off (no particles, tint only).

**Missions.** Use it where the story already has it: mission 6 (the storm arrives at the quota deadline: a warning line, then storm for the last 3 minutes), mission 10 "Obsidian Storm" (storm from the start, clearing when the Crown lights). Retune with `npm run check:missions`.

**Tests.** Unit tests for each modifier, the seeded schedule and save and load; browser check of the icon, notice and Eco fallback; render budget.

## Package 3.4: rework three maps

Use height and cover to make real choke points on `highlands`, `dunes` and `woodlands`, then add a little to the others.

- For each map write the intent in `docs/EXPANSION_STAGES.md`: where the plateaus, ramps and cover are and what choice they force (for example, "the central plateau overlooks both natural expansions; two ramps, one facing each base").
- Rules for placement: bases and expansion `sites` stay on level 0 with 10 m clear; every plateau has at least two ramps unless it is a deliberate dead-end tower spot; nothing blocks the `flank` routes; mission regions in `src/story/missions.js` that fall inside a cliff ring or on a ramp must be moved (write a node script that checks every region and spawn with `s.nav.canStand`).
- After each map: `npm run check:missions` for the missions on it, the skirmish bench, and the stuck-unit soak.

**Done when** a unit test shows the same two armies give opposite results depending on which holds the plateau, and a bot match on each reworked map completes without stuck units.

## Package 3.5: air units (only after the owner confirms)

**Scope.** One scout flyer per side and anti-air roles. No bombers.

- `kite` "Kite" (all factions, Foundry level 2): hp 70, shield 20, speed 7, no weapon, vision 20, cost 100/75, pop 1, time 16, class `air`. Flies over cliffs, water and buildings (no pathfinding: straight lines with separation), drawn 5 m up with a blob shadow on the ground.
- Only `tower`, `antitank`, `watcher`, `drone` and `ranger`-slot units can target class `air` (`anti_air: true` in `balance.json`); everything else ignores it.
- The AI builds one Kite at Normal and faster and keeps it circling its army; it sends it to scout the player once per wave.
- Interface: air units are selectable through a larger tap target; the minimap draws them as a different mark.

**Tests.** Targeting matrix, flight over obstacles, save and load, AI does not over-build, render budget, three viewports.

## Stage 3 exit check

- A map without the new data plays identically to before (hash test).
- No increase in stuck units in the soak test.
- Missions on reworked maps meet their bot targets at all three difficulties.
- Phone frame time within budget with storm on a 3-enemy match.
