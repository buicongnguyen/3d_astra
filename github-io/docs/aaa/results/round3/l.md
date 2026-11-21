# R3-L: Living buildings and south exits: results

Branch `r3/l-building-life`, base `r3/f-warm-kit` (`629b19e`), worktree `C:\Users\n\source\repos\3d_astra-r3-l`, port 4237.

Status: **PARTIAL.**
- Part 1 (building decals and gate details) is done.
- Part 2 (south exits) is built and tested, and its pins are re-recorded. But it fails the mission gate: the ObjectiveBot no longer wins **m12 Standard**, **m03 Standard** or **m04 Veteran**.
- As the brief asks, I stopped there and did not retune any mission. An owner decision is needed (see "Mission checks").

Commits, oldest first:
1. `ef9ffe0` R3-L: trained units leave on the south side (sim: `src/sim/economy.js`, new `tests/south-exit.test.js`).
2. `9265fc6` Re-record pins for south exits (owner decision). Only pins the exit change moved.
3. `7444f0b` R3-L: living buildings (view plugin, atlas, tests, render-budget scenario, `docs/VIEW_PLUGINS.md`).
4. `a064e4b` Decals hold still with combat motion off too.
5. This results file and the CHANGELOG subsection.

Commits 1 and 2 are independent of commits 3 to 5. Reverting `9265fc6` and then `ef9ffe0` keeps the decals working and puts every pin back as on the base. The gate details are drawn on the south side either way, which is where units come out with commit 1.

## Part 1: building decals and gate details (view only)

The work is in `src/building-decals-view.js` (`BuildingDecalsView`, registered last in `src/view-plugins.js`) and `src/building-decals-atlas.js`.

### The atlas

- 32 cells of 128 px in an 8 × 4 grid (1024 × 512).
- Drawn with Canvas 2D when the first building appears. There is no file to load. It takes about 2.8 MB of GPU memory with mipmaps.
- White cells are tinted per instance with the team colour.

### On the walls

The decals for each building type live in the data table `WALL`. It covers the HQ, Barracks, Foundry, Relay, Tower, Field workshop, Salvage yard, Waystation, Pylon and Veil relay. The decals are:
- hazard stripes;
- bay numbers 01 and 02;
- team emblem plates and banners;
- pictograms: helmet, gear, bolt, sight and wrench;
- vents, crystal gauges and caution signs;
- blinking beacons in red, amber, ice, mauve, or ember for each faction;
- a scrolling chevron sign;
- a production light bar, lit while the building trains;
- a door light that flashes when a unit comes out.

**Placement.** Each decal is placed once per type and facing, by casting a ray at that type's own model. Decals go on the world faces the default camera sees (south, east and west). So they land on the real surface both for team 0 (facing 0) and for rivals (facing π).

### On the ground, in front of the gate

This was the owner's scope addition. In the owner's priority order:
1. **Apron.** A painted concrete apron, with team chevrons pointing out of the exit.
2. **Runway lights.** Lights along the apron chase toward the gate while the building trains, at speed 0.8 + 2.2 × progress. When a unit exits, the door flashes and a dust puff appears (from a pool of 12 slots).
3. **Tracks.** Boot or tread marks appear behind each unit that has just come out. They age on the GPU and fade over 20 s. They use a fixed pool of 96 slots.
4. **Energy dashes.** Glowing dashes run on the ground from each Foundry and Relay toward the nearest own Command core. They are drawn in pieces of about 4 m, each at its own terrain height.
5. **Blueprint grid.** A blue grid scrolls under a building that is going up, and fades over 1.5 s when the building completes.
6. **Light pools.** Warm amber pools sit in front of each gate.
   - They are faint by day (0.05) and strong on night looks (0.05 + 0.7 × night).
   - The night strength comes from `view.mood.state` (R3-D's `MissionLook`): night 1, storm 0.55, dusk 0.45, each times the look's fade k.
   - No R3-D file was edited.
7. **Faction ground style,** beside the apron:
   - Ashfall: a scorch stencil with two blinking embers.
   - Wardens: a frost-edged slab.
   - Sunward: a canvas rug with a sun mark.
   - Veil: a slow, rotating mist swirl.
   - Meridian: mint lines.

### Rules kept

- **Height.** Ground parts sit 0.05 to 0.09 m above the terrain height at their own spot, plateaus included. They also use a negative polygon offset.
- **Draw order.** `renderOrder` −1 draws them under units, selection rings (3), markers (4) and Eco blob shadows (0). The fog-of-war plane (2) covers them in fog.
- **Look.** Colours are calm and low in saturation, except the lights. Nothing casts or receives shadows.
- **Following the building.** Decals follow:
  - the team colour (they are re-tinted when colours change);
  - fog of war (a hidden building's decals go);
  - construction (only the blueprint grid shows until the building is complete);
  - destruction (they are removed with the building).
- **Buffer writes.** The static buffers are rewritten only when the signature of the drawn buildings changes.

### Motion

- All animation runs in the shader, from one clock uniform plus per-instance data (cell, mode, phase, value).
- The modes are blink, progress, scroll, pulse, chase, track, rotate, night, blueprint and dust.
- **What stops the clock:**
  - a paused game (dt 0);
  - reduced motion;
  - combat motion switched off in Settings;
  - the governor's motion level 0.
- **When still:** the look is static, with beacons and runway lights lit steadily. No tracks or dust are added.

### Cost

The render budget was measured on the same machine (RTX 4080). "Before" is this branch without the plugin, built side by side.

| Scenario | Draws before → after | Shadow draws | Triangles before → after | Buffer uploads on a still frame |
|---|---|---|---|---|
| base-high | 139 → 140 | 61 → 61 | 117,326 → 117,636 | 0 → 0 |
| battle-eco | 106 → 107 | 0 → 0 | 283,334 → 283,738 | 0 → 0 |
| three-factions-eco | 181 → 182 | 0 → 0 | 281,418 → 282,018 | 0 → 0 |
| defence-wave-eco | 108 → 109 | 0 → 0 | 500,186 → 500,542 | 0 → 0 |
| night-battle-eco | 106 → 107 | 0 → 0 | 283,334 → 283,738 | 0 → 0 |
| building-life-eco (new) | 96 → 97 | 0 → 0 | 77,666 → 78,148 | 0 → 0 |

- **Draws:** +1 in every scenario (the budget allows +2). There is no shadow-pass draw.
- **Triangles:** +300 to +600. That is 2 per decal, and a six-building base has about 110 decals.
- **Matrix work:** +1 `compose` and +2 `multiplyMatrices` per frame, for the mesh's own transform.
- **Uploads:** the instance buffers upload only when a building appears, finishes, hides or dies, plus a few floats while a building trains.
- **New scenario:** `building-life-eco` shows the player's base on the phone with a second Barracks, a Relay and a Tower. Its limit is 110. `battle-eco` is at 107 of its 120.

### Screenshots (`l/`)

- [Close up, before and after](l/close-before-after.jpg)
- [Phone zoom (390 × 844), before and after](l/phone-before-after.jpg)
- [Night look, before and after](l/night-before-after.jpg)
- [A unit leaving a Barracks, before and after](l/exit-before-after.jpg):
  - before (the base's exit order): the unit appears north-east, behind the building;
  - after: it appears south, on the apron, toward the camera.
- [The same exit at phone zoom](l/exit-phone-after.jpg)
- [A Foundry going up, with its blueprint grid](l/construct-after.jpg)
- Rival bases (facing π), one per faction: [Ashfall](l/enemy-ashfall-after.jpg), [Veil](l/enemy-veil-after.jpg), [Sunward](l/enemy-sunward-after.jpg), [Wardens](l/enemy-wardens-after.jpg)

No DOM UI changed. So there are no new strings for `vi.json` (the atlas holds only digits and pictograms) and no viewport audit to run. The phone shot serves as the 390 × 844 check.

## Part 2: south exits (sim)

### Which way is south

South is +z. `CAMERA_OFFSET` in `src/view.js` is (25, 51, 43), so the camera sits at +z (and +x) and looks toward −z. A unit at +z of a building is drawn in front of it.

### Before and after

- **Before:** `exitPoint` tried 28 angles per ring, starting at `r × 0.7` radians. For a Barracks, ring 1 is at 5 m, so the first angle is about 3.85 rad, which is north-west. Units mostly appeared behind the building.
- **After:** `EXIT_ORDER` (exported from `src/sim/economy.js`) lists 32 directions sorted by their angle from south. On a tie, east comes before west. The order is S, SSE, SSW, …, SE, SW, …, E, W, …, NE, NW, …, N.
- **What stays the same:** each ring is tried in that order, and every other check is unchanged:
  - the spot must be walkable ground with no unit in the way;
  - there must be a route to the rally point or the core;
  - rings still widen out to 16 m;
  - flyers still need only airspace.
- **Determinism:** it is a fixed table with no random numbers.

### Blocked exits and the rally point

- **Blocked south** (cliff, water, building, map edge or plateau edge): `canStand` and the route check reject the spot, and the next direction in the order is used.
- **Default rally:** the simulation has no default rally point (`rally: null`). Without one, a unit waits where it exits, so the gather point is now the south side too. The rally flag UI is unchanged.

### Tests

`tests/south-exit.test.js` has 5 tests:
1. **The order:** S comes first, SE before SW, E then W, and N last. It also checks that the camera offset really is +z.
2. **South free:** a Vanguard trained at a Barracks (through `updateProduction`) appears due south.
3. **South taken:** the next unit uses SE, then SW.
4. **South walled off:** with a wall across the whole south side, the unit uses east or west. It never goes north first, and never through the wall.
5. **Determinism:** the same state gives the same spot.

### Pins moved

All of these moved because of the exit change, and were re-recorded in `9265fc6`.
- **Unchanged:** the idle fingerprint `d071360b` and the 14 mission checksums in `tests/wings.test.js`. The idle match trains nothing, and the checksums hash the mission definitions.
- **Moved:** every moved pin plays unit production by an AI or by the ObjectiveBot.

| Pin | Before | After |
|---|---|---|
| expanded meridian 300 | `51312236` | `6036d277` |
| expanded meridian 600 | `ff066aef` | `5ec489b1` |
| expanded veil 300 | `94bdc14d` | `af50d623` |
| expanded veil 500 | `5f895c63` | `4f437973` |
| round2 arena 300 | `4cce2935` | `f94f7658` |
| classic x1 normal 60 s | `fef65c4f` | `baf36c17` |
| classic x1 normal 180 s | `39426dbc` | `8095a061` |
| classic x1 normal 300 s | `6d992886` | `f117790c` |
| classic x1 normal end | `defeat 231` | `victory 211` |
| highlands x2 relentless coalition 60 s | `807ca1eb` | `0aaa724a` |
| highlands x2 relentless coalition 180 s | `6bada781` | `b20629ec` |
| highlands x2 relentless coalition 300 s | `6bada781` | `85a06f36` |
| highlands x2 relentless coalition end | `defeat 167` | `running 300` |
| riverlands x2 fast 60 s | `30be65e6` | `5948dbf7` |
| riverlands x2 fast 180 s | `d16fd4cd` | `a80c9e11` |
| riverlands x2 fast 300 s | `3f77c63b` | `7f9a6072` |
| basin x3 fast 60 s | `853fdf6c` | `abede88b` |
| basin x3 fast 180 s | `8422f5d9` | `4f8a69db` |
| basin x3 fast 300 s | `db45b921` | `8a63c4a4` |
| basin x3 fast end | `defeat 246` | `running 300` |
| riverlands x3 normal, Sunward against mixed rivals 60 s | `56c0461d` | `498523ba` |
| riverlands x3 normal, Sunward against mixed rivals 180 s | `387ab7ee` | `51d0e53f` |
| riverlands x3 normal, Sunward against mixed rivals 300 s | `42be5155` | `51d0e53f` |
| riverlands x3 normal, Sunward against mixed rivals end | `running 300` | `defeat 154` |
| dunes x1 normal, Ashfall against Veil 60 s | `af9fa074` | `fbdd5fcc` |
| dunes x1 normal, Ashfall against Veil 180 s | `baac3a09` | `b36a3f1e` |
| dunes x1 normal, Ashfall against Veil 300 s | `82f0f29c` | `82d11644` |
| m01-first-light | `a740365c` | `03e8cb2b` |
| m03-the-ashen-line | `9d9693b6` | `59c479c0` |
| m06b-wings-over-copper | `223ff814` | `56d5c731` |
| ca1-cold-berths | `ab4e3941` | `c9716b32` |
| w1a wardens expanded 60 | `b7a68cbf` | `7333a2e4` |
| w1a wardens expanded 180 | `4b5a50ae` | `9f2229f3` |
| w1a wardens expanded 600 | `69b78cbe` | `e4c0f4c3` |
| w1a wardens expanded 800 | `69b78cbe` | `e4c0f4c3` |
| w2d field 180 | `80fb27d8` | `706784b9` |
| w2d field 600 | `549eb7a3` | `5fcd83f0` |

- **Count:** 37 stored pins moved, and the 12 derived save/reload points follow them. 33 of the 82 printed points are unchanged.
- **Long points:** these were recorded with `GOLDEN_RECORD=1 GOLDEN_FULL=1` on this branch, and on the same tree with the base `economy.js`.

Two other test changes are in the same commit:
- `tests/content-seams.test.js:435` repeats the classic x1 180 s pin: `39426dbc` → `8095a061`.
- `tests/opponents.test.js` ("each AI gathers, trains and launches its own wave"): the idle player's core is now held up (`hp = 1e9`).
  - **Why:** with south exits on highlands, team 1's first wave hits team 2. Team 2 then launches its own wave at 189 s, but the idle player's core fell at 185 s and ended the match first.
  - **Result:** with the core held up, all three AIs launch within the test's own 5-minute bound.

**Owner decisions O5 and O6 are affected.** `golden-w2d` and the `golden-round2` arena pin belong to R3-A (O6), and `golden-story` belongs to R3-I (O5). They moved here only because of the exit change. Whichever package merges second re-records them on the merged tree.

## Mission checks (`check:missions`, ObjectiveBot)

### Standard

Run with `node tools/mission-check.mjs --difficulty standard --jobs 2`. Objective bot, base → after:

| Mission | Before | After |
|---|---|---|
| m02 First Contact | victory 525 s, gold | victory 557 s, **silver** |
| **m03 The Ashen Line** | victory 604 s, gold | **running at 1260 s (not won)** |
| m04 Three-Way Dunes | victory 443 s, gold | victory 422 s, gold |
| m09 A Debt in the Dunes | victory 431 s, gold | victory 405 s, gold (misses the 420 s earliest-win window by 15 s) |
| m11 Cut the Draw | victory 502 s, gold | victory 738 s, gold |
| **m12 Frontier's End** | victory 772 s, gold | **defeat at 914 s** |
| All others (m01, m02b, m05, m06, m06b, m07, m07b, m08, m10, m11c) | won | won, same medal |

### Veteran and Story

From `baselines:diff --full`:
- **Veteran:**
  - **m04 flips to defeat** (881 s).
  - m03 drops from gold to bronze (1561 s).
  - m05 rises from silver to gold.
  - m12 still wins: 714 → 672 s, gold.
  - Every other mission still wins with the same medal.
- **Story:** every mission still wins; only times and losses moved.

### Why, and what I tried

- **Cause:** these flips are knife-edge outcomes, not a systematic weakness.
  - In m03, the enemy's first wave left 20 s later (215 → 235 s).
  - The bot's first march then met a fresh enemy army, instead of one that had just broken on the bot's defence, and lost 31 units.
- **Second variant tried:** south exits for the player only (team 0, AI unchanged).
  - m03 then won, with silver.
  - **But m12 Standard flipped instead** (running at 1260 s), and m09 again won too early.
- **Decision:** neither variant keeps every win. So I kept the owner's rule as asked (every producer, every team), stopped, and did not retune any mission. The brief says: "Mission 12 is knife-edge … report if it flips and stop".
- **Baselines:** I did **not** re-record them, because that would record m12 and m03 as losses. The `baselines:diff -- --full` result is in the last section.

### Owner decision needed

Choose one:
- **(a)** Accept the south exits. The integrator or R3-I then retunes the bot runs that now fail: m03 Standard, m04 Veteran and m12 Standard (through the ObjectiveBot or the mission data).
- **(b)** Ship Part 1 only: revert `9265fc6` and `ef9ffe0`. The decals stay, and units come out on the old sides.

## Tests

- **`npm test`:** 974 tests: 948 pass, 26 skipped, 0 fail. The base had 963, so this adds 11: 5 in `tests/south-exit.test.js` and 6 in `tests/building-decals.test.js`.
- **`tests/building-decals.test.js`** checks:
  - the atlas cells and the per-type table;
  - one instanced mesh, with no shadows, drawn under the rings, and nothing built before a building exists;
  - fog of war, construction and death;
  - while training, the bar lights and the runway lights speed up; when a unit comes out, the door flashes, dust puffs and tracks are laid;
  - motion off, reduced motion and combat motion off all hold the clock;
  - night strengthens the light pools, and reset removes the mesh;
  - gate details sit south of the building for both facings.
- **Render budget** (`battle-eco`, `building-life-eco`): green.
- **`check:defence`:** identical to the baseline (the `defence` row of `baselines:diff`).

## Seam requests

1. **R3-D (night looks):**
   - The light pools read `view.mood.state` (`{ name, k }` from `mission-look-view.js`). If R3-D renames that field, `nightOf()` in `src/building-decals-view.js` needs the new name.
   - If R3-D adds a night boost for `Window*` materials, the decal pools already follow the same look strength.
2. **R3-A (Field AI, O6) and R3-I (story pins, O5):** `golden-w2d`, the `golden-round2` arena pin and `golden-story` moved because trained units now exit south. Re-record them after whichever merge comes second.
3. **Integrator:** the mission gate (above) needs an owner decision before merge.
4. **Selection UI owner (rally flag), optional:** with no rally set, the rally preview could show the south exit as the default gather point. This package does not need it.

## baselines:diff -- --full

Run on this branch, compared with `docs/aaa/results/round2/baseline/`. Not re-recorded (see "Mission checks").

| Baseline | Result |
|---|---|
| defence | **identical**: Frontier Defence trains nothing from Barracks or Foundry. |
| missions-story | Differs in times and losses only; every mission is won. |
| missions-standard | Differs. m03 and m12 are not won by the objective bot; m02 drops from gold to silver; m09 wins at 405 s, 15 s before its 420 s window. |
| missions-veteran | Differs. m04 is a defeat; m03 drops from gold to bronze; m05 rises from silver to gold. |
| missions-standard-mercy, -firm | m03 is not won, as on Standard; m02 drops from gold to silver; in mercy, m05 also drops from gold to silver. The tool lists only the first 12 differences per table, so m12 is not shown there; it was checked on Standard only. |
| chronicles | Differs in times, losses and medals; all 12 are still won (`tools/chronicle-check.mjs --chronicle all`: "All targets met"). ca2 drops from gold to bronze; cw2 rises from bronze to gold. |
| bench-classic (120 AI-vs-AI matches) | Wins by faction, before → after: Meridian 31 → 37, Wardens 33 → 32, Sunward 21 → 18, Veil 17 → 19, Ashfall 18 → 14. |
