# R3-D: Night and storm looks (results)

Branch `r3/d-night-storm` (base `r3-base`), worktree `C:\Users\n\source\repos\3d_astra-r3-d`, port 4235.
View-only package: no sim, mission, Chronicle or Defence definition was touched.

## What changed

| Piece | File | Draws |
|---|---|---|
| Night grade: blue-black shadow tint `[-0.035, 0.006, 0.03]`, saturation 0.86, contrast 0.24 (storm: cold tint, saturation 0.94). Installed once when the look's name changes. | `src/look-grade.json` (`looks`), `src/look-grade.js` (`gradeFor`/`installGrade` take a look) | 0 |
| Night palette: ambient `#3a66c0` (was `#4560b4`), bounce `#0a1428`, moon `#8fb4ff`, ambient strength 0.7 | `src/mission-looks.js` | 0 |
| Map edge and void recoloured black-blue at night, blue-grey in a storm (it was the hard orange edge) | `src/map-edge.js` `tintEdge`, `edgeColor` | 0 |
| Rim light turns moonlit (`#8fb0ff`) at night; team rims keep the team colour | `src/mission-look-view.js` | 0 |
| Moon (screen-anchored, drawn after the map edge with no depth test, so the battlefield covers it and it shows over the void) | `src/night-sky.js` | 1 |
| Stars on the void around the map (depth tested: cliffs hide them) | `src/night-sky.js` | 1 |
| Storm rain: 1300 streaks (600 on Eco) in a box that wraps around the camera focus, animated in the vertex shader | `src/night-sky.js` | 1 |
| Storm cloud shade: a drifting full-screen shade, High only | `src/night-sky.js` | 1 (High) |
| Storm distance fog: near x0.5, far x0.72 at full strength | `src/mission-looks.js`, `src/mission-look-view.js` | 0 |
| m06: storm strength 0.35 at 0:00, 0.75 by 1:30, held, 1.0 by 16:20 (was 0 until 16:00) | `MISSION_LOOKS` `ramp` | 0 |
| Window*/Lamp* glow (name contract, see seam requests) | `src/mission-look-view.js` `NIGHT_GLOW` | 0 |
| Storm sound bed: band-passed rain hiss + wind rumble, thunder swell 0.7 s after a strike | `src/ambience.js` `StormBed`, `stormLevel` | 0 |

Motion-off (reduced motion, or the frame governor's motion level 0) gives no lightning (unchanged rule, now tested in the browser) and holds rain, stars and cloud shade still. The storm bed is silent when muted, with "River and wind ambience" off, or while paused (`stormLevel`), and it is only built on the first storm frame.

## Acceptance numbers

Measured with a scratch probe on the built game (desktop 1440×900 High and phone 390×844 Eco, campaign started for real, clock held, map revealed). Colours are 0–255 averages of the whole drawn frame and of its top band (the top 8 rows, the void and sky side). Before = `r3-base`.

### Night (m08 "The Quiet Vault", 0:30)

| | Before (High) | After (High) | After (Eco) | Gate |
|---|---|---|---|---|
| Frame average R, G, B | 65.7, 19.7, 24.9 | 5.5, 13.8, 45.0 | 10.6, 19.2, 41.9 | |
| Frame R − B (purple check) | **+40.8** | **−39.5** | −31.3 | below 0 |
| Top band R, G, B | 73.5, 19.2, 24.3 | 6.8, 14.4, 45.3 | 13.8, 15.0, 42.2 | |
| Top band B − R | −49.2 | **+38.5** | +28.4 | above 20 |
| Frame luminance | 11.7% | **5.6%** | 7.5% | under 15% |
| Background (sky) colour | `#030818` | `#030818` | `#030818` | very dark blue |
| Draws | 227 | 229 (+2) | 134 (day 132, +2) | at most +6 |

The Night Count Chronicle (cv1, Obsidian Highlands, 0:30): frame R − B −16.2 → **−47.3**, luminance 11.4% → 11.1%, purple pixel share 11.8% → 0%, draws 156 → 158.

The browser suite's own night check (Ashen map, skirmish look rule, void in view): frame 5, 12, 43; top band 2, 9, 40; luminance 5.0%; 109 draws against 107 by day.

### Storm

| Scene | Strength k before → after | Frame luminance before → after | Draws (day → look) |
|---|---|---|---|
| m06 at 0:30 | 0 → **0.48** (rain, darker) | 40.7% → 28.4% | 121 → 123 |
| m06 at 3:00 | 0 → **0.75** | 40.7% → 20.4% | 121 → 123 |
| m10 at 0:30 | 1 → 1 (now with rain, cloud shade, closer fog, cold grade) | 17.7% → 13.3% | 149 → 151 |
| m06 / m10 on Eco | | 25.1% / 13.4% | 72 → 73 / 75 → 76 |

### Render budget (`tests/render-budget.mjs`, port 4235)

| Scenario | Draws | Day twin | Limit |
|---|---|---|---|
| base-high | 141 | | 160 |
| night-base-high (new) | 143 | base-high +2 | 166 |
| storm-base-high (new) | 143 | base-high +2 | 166 |
| battle-eco | 107 | | 120 |
| night-battle-eco | 109 (was 107) | battle-eco +2 | 120 |
| storm-battle-eco (new) | 108 | battle-eco +1 | 126 |

No buffer uploads in any of them (the rain moves in the shader). The night and storm scenarios show more compiled programs (57 against 32 on High) because the look's grade recompiles the scene once at the start of the match, like a map's own grade change does today.

## Screenshots (`d/`)

| Scene | Before | After High | After Eco |
|---|---|---|---|
| m08 night 0:30 | [before](d/before-m08-night-high.jpg) | [after](d/after-m08-night-high.jpg) | [eco](d/after-m08-night-eco.jpg) |
| m06 0:30 | [before](d/before-m06-0030-high.jpg) | [after](d/after-m06-0030-high.jpg) | [eco](d/after-m06-0030-eco.jpg) |
| m06 3:00 | [before](d/before-m06-0300-high.jpg) | [after](d/after-m06-0300-high.jpg) | [eco](d/after-m06-0300-eco.jpg) |
| m10 0:30 | [before](d/before-m10-0030-high.jpg) | [after](d/after-m10-0030-high.jpg) | [eco](d/after-m10-0030-eco.jpg) |
| Chronicle cv1 night 0:30 | [before](d/before-cv1-night-high.jpg) | [after](d/after-cv1-night-high.jpg) | [eco](d/after-cv1-night-eco.jpg) |
| Ashen night with the void, moon and stars | | [after](d/after-night-void-high.jpg) | |
| Storm with a lightning strike | | [after](d/after-storm-flash-high.jpg) | |

The raw numbers are in `d/before-high.json`, `d/after-high.json` and `d/after-eco.json`.

## Tests

- `npm test`: 961 → **967** tests (941 pass, 26 skipped, 0 fail). New `tests/night-sky.test.js` (6 tests): m06 ramp; night grade; no-purple palette and black-blue edge for every theme; one draw per sky piece and at most 6; motion-off (no flash, sky held still) and the Window*/Lamp* contract; storm bed silence.
- Changed: `tests/mission-looks.test.js` "m06 turns to storm from 16:00" now says the storm gathers from the start (k ≥ 0.7 at 100 s, 1 at 1000 s). This is the brief's behaviour change.
- New browser suite `tests/night-storm.mjs` (`npm run test:night-storm`, CI group `r3-d`, about 13 s): night desktop numbers and draws, storm pieces and draws, lightning on with motion and off with reduced motion, m06 at 0:30 in the campaign, night on a phone.
- Render budget: three new scenarios, listed above.
- Pins: `npm test` holds `d071360b`, the 14 mission checksums and every golden pin. `npm run baselines:diff -- --full`: **all 8 baselines identical** (missions story, standard, veteran, standard-mercy, standard-firm, chronicles, defence, bench-classic; run in two parts because a shell timeout cut the first run).
- Browser: `tests/night-storm.mjs` PASS on port 4235 (13–18 s); render budget for the six scenarios above plus `battle-eco` exit 0.

## Seam requests

1. **R3-F and R3-J: lit windows.** The night glow reaches any emissive material whose name starts with `Window` or `Lamp` (`NIGHT_GLOW` in `src/mission-look-view.js`, pinned in `tests/night-sky.test.js`). Give such parts a warm emissive colour (for example `#ffc070`) and their day emissive strength; the night multiplies it by the look's `glow` (1.9) and restores it by day. Keep the names on separate materials: `bakeFinishes` in `view.js` leaves `Lamp*` and any emissive material unbaked, so they stay addressable. Today only `hq.glb` and `barracks.glb` carry `Windows`/`Lamps` materials.
2. **R3-U (audio):** the storm bed lives in `ambience.js` and reads `WEATHER` (`mission-looks.js`: `{ name, storm, flash }`, view state). If R3-U wants a thunder SFX or a stinger on the first strike, read `WEATHER.flash` rather than adding a second lightning schedule.
3. **R3-G (openings):** m08's moon sits in the upper left of the screen, behind the battlefield. An opening that frames the void beyond the south-west edge shows it best.
4. None for the integrator: no file outside this package's list changed except the append-only `package.json` script, `pages.yml` entry `r3-d`, `render-budget.mjs` scenarios and the CHANGELOG.

## Notes and limits

- The camera is orthographic and looks down at the map, so the sky colour itself is only seen past the map edge. The "sky" numbers above therefore use the void band and the whole frame; the background colour is unchanged (`#030818`).
- m06's sky and fog in a storm keep a little of Copper Basin's dusk purple (sky `#2b1b29` at 0:30). The no-purple rule is the night's; if the owner wants a cold storm sky there too, raise the storm's sky blend or give m06 its own storm sky.
- The night ground is very dark (frame luminance 5.6% on m08). Units, crystals and team glows read clearly; if the owner wants more of the ground's detail, raise `LOOKS.night.ambientI` (0.7) a little.
