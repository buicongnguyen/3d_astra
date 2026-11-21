# R3 map variety: six new Skirmish maps (results)

Branch `r3/map-variety` from `feat/aaa-round3` (6ef4261), worktree `C:\Users\n\source\repos\3d_astra-r3-maps`, port 4236.
Owner request: "create several maps which differ a little in resource location, number of resources, land, river and
walls, so that we have variety of styles like a real game." Status: **done**; latest `feat/aaa-round3` merged in and
re-verified (see Checks).

## The six maps

All six are in the Skirmish battlefield picker (after the seven older maps) as "Name · size×size", with a one-line idea as
the option's tooltip; names and lines are in `vi.json` and `ko.json`. Each borrows an existing land's look (palette,
light, dressing, ambient life, grade and music), so no new art. No concrete walls (`rocks: []`): every wall is natural
ground, a plateau (a plateau without ramps is a crag). Every map mirrors on both axes, so all four camps start alike.

| Map | Size, look | Idea | Deposits (1 rival) | Land, water, walls |
|---|---|---|---|---|
| **Golden Heart** (`heartland`) | 128 m, Copper Basin | Rich centre: the standard home field, a modest natural each, and a heart worth more than both camps' fields together | 24: 18 alloy (52,800), 6 energy (15,500); the heart has four 5,000 alloy and four 3,000 energy | A ring of four large crags around the heart with roads in from every camp (the diagonals are the ways in), four crags by the side naturals; centre ring in the heart |
| **Dry Reach** (`dryreach`) | 160 m, Amber Dunes | Scarce, long game: small deposits (1,300 to 2,000) spread wide, so the field is worked a little at a time and expansions matter | 42 small: 32 alloy (58,400), 6 + 4 energy (13,900) | Open sand, two ramped mesas with a ring on each top, eight crags, a ring in the centre; no roads |
| **Twin Rivers** (`twinrivers`) | 160 m, Meridian Riverlands | Two rivers, three lanes: each river has a bridge on each flank and two fords inside; a cliff ridge from each river to the map edge splits the two camps on each bank | 34: 26 alloy (62,000), 8 energy (15,500) | Rivers at z = ±22; the strip between them holds the contested deposits and the three rings; roads from each camp to its bridge |
| **Ironback Ridge** (`ironback`) | 160 m, Obsidian Highlands | Highland walls: a cliff ridge across the map with one 10 m pass in the middle and a flank path at each end; the ridge tops are high ground, reached by four ramps a segment; a second ridge between the camps on each side | 28: 22 alloy (50,800), 6 energy (11,500) | Box plateaus 60 × 8 m (and 8 × 34 m) with ramps; rings in the pass and on both flanks |
| **Crown Mesa** (`crownmesa`) | 160 m, Verdant Crossing | Island-like basin: a mesa 48 m across in the middle with eight ramps (one facing each camp, one between each pair), its rich deposits and the centre ring on top; camps on the rim | 30: 22 alloy (56,000), 8 energy (19,500); the top holds four 4,000 alloy and four 3,000 energy | Mesa r 24 (its top is hidden from below), eight ramps, four crags at its foot; scatter density 0.85 (`dressing`) to keep the woodland dressing inside its triangle budget |
| **Open Steppe** (`steppe`) | 128 m, Frontier Expanse | Open plains: closer camps (92 m apart against Golden Heart's 115 m), no water, no walls, twelve small crags and an X of roads through the centre: fast and aggressive | 16: 12 alloy (27,000), 4 energy (7,500) | Crags only; roads from every camp to the centre ring |

For comparison: Ashen Frontier has 22 deposits (33,000 alloy), Copper Basin 34 (57,000), Frontier Expanse 40 (69,000).

Screenshots, 1440×900 and 390×844, fog lifted for the overview, the in-game shot after 150 s of the computer playing
both sides: `docs/aaa/results/round3/maps/` (`<map>-overview-1440.jpg`, `<map>-overview-390.jpg`,
`<map>-ingame-1440.jpg`, `<map>-ingame-390.jpg`, `<map>-minimap.png`).

## Map engine (opt-in, backwards compatible)

New optional `maps.json` fields, documented in `docs/MISSIONS.md` "Map layouts": `rivers`, `rocks`, `roads`,
`deposits`, `symmetry`, plateau `mirror: "quad"`, `look`, `dressing`, `blurb`. Every rule and renderer that assumed the
one river at z = 0 now reads `terrain.rivers` (one river at z = 0 with `CROSSINGS` on the old river maps):
`terrain.js` (surface, banks, building rule, water), `sim/traits.js` (ford slow-down), `terrain-labels.js` (crossing
label), `environment-view.js` (one merged water mesh for all rivers, bridges, ford marks, reeds), `view.js` (channel),
`ground-paint.js` (wet banks and foam), `map-edge.js` (skirt and waterfalls), `app/minimap.js` (crossing ticks),
`ambient-life.js` (fish, dragonflies), `app/frame.js` (river ambience). `navigation.js` and `scatter.js` read the
map's `rocks`; `visual-style.js` and `audio-logic.js` let a skirmish map borrow a look as Defence maps do.

**Older maps unchanged, proven:**
- Terrain fingerprints (surface, standing for two radii, building rule, render height, level, cliffs and ramps on a
  0.5 m lattice, plus water, plateaus, walls, levels and hidden cells) of the 7 Skirmish and 7 Defence maps, and match
  fingerprints of the 7 Skirmish maps (start with 1, 2 and 3 rivals, 90 s of AI play), recorded on 6ef4261 before any
  change: identical (`tests/maps-variety.test.js`, `tests/lib/map-fingerprint.mjs`).
- In the browser, before and after, for each of the 7 maps: the ground texture (128 px downsample: mean and max
  difference 0), the terrain group's geometry (ground, relief, map edge), the environment (water, bridges, ford marks,
  reeds) and the scatter geometry: identical hashes.
- The idle fingerprint `d071360b`, every golden pin (`npm run test:golden-full`, 97/97) and the round-2 baselines.

## Bot against AI

`tools/difficulty-check.mjs` (the test bot against one rival, 1v1, and two rivals united against it, 1v2), Classic rules
(the Skirmish default), capture points on, 2,400 s cap, deterministic. The gate cells (Relaxed and Normal) use 15 attack
thresholds (10 to 24) per cell, because 4 thresholds swung by two matches on a small layout change; Fast and Relentless
are reported at the tool's default 4 thresholds. Bot wins:

| Map | 1v1 Relaxed | 1v1 Normal | 1v2 Relaxed | 1v2 Normal | 1v1 Fast | 1v1 Relentless | 1v2 Fast | 1v2 Relentless |
|---|---|---|---|---|---|---|---|---|
| Ashen Frontier | 15/15 | 15/15 | 10/15 | 0/15 | 3/4 | 4/4 | 0/4 | 0/4 |
| Meridian Riverlands | 15/15 | 15/15 | 9/15 | 0/15 | 4/4 | 3/4 | 0/4 | 0/4 |
| Copper Basin | 15/15 | 15/15 | 6/15 | 6/15 | 3/4 | 4/4 | 0/4 | 1/4 |
| Frontier Expanse | 15/15 | 12/15 | 8/15 | 10/15 | 4/4 | 2/4 | 1/4 | 4/4 |
| Amber Dunes | 15/15 | 15/15 | 5/15 | 7/15 | 4/4 | 4/4 | 1/4 | 1/4 |
| Verdant Crossing | 15/15 | 14/15 | 9/15 | 5/15 | 3/4 | 2/4 | 2/4 | 2/4 |
| Obsidian Highlands | 15/15 | 12/15 | 8/15 | 10/15 | 0/4 | 0/4 | 1/4 | 1/4 |
| **Older maps, average** | **100%** | **93%** | **52%** | **36%** | 75% | 68% | 18% | 32% |
| Golden Heart | 15/15 | 15/15 | 8/15 | 8/15 | 4/4 | 4/4 | 3/4 | 2/4 |
| Dry Reach | 15/15 | 15/15 | 8/15 | 6/15 | 1/4 | 1/4 | 1/4 | 0/4 |
| Twin Rivers | 15/15 | 15/15 | 13/15 | 11/15 | 4/4 | 2/4 | 0/4 | 1/4 |
| Ironback Ridge | 15/15 | 15/15 | 11/15 | 7/15 | 4/4 | 0/4 | 1/4 | 4/4 |
| Crown Mesa | 15/15 | 14/15 | 8/15 | 8/15 | 1/4 | 0/4 | 2/4 | 2/4 |
| Open Steppe | 15/15 | 14/15 | 10/15 | 6/15 | 4/4 | 4/4 | 0/4 | 0/4 |
| **New maps, average** | **100%** | **98%** | **64%** | **51%** | 75% | 46% | 29% | 38% |

Every new map is at or above the older maps' average in every Relaxed and Normal cell (Crown Mesa 1v1 Normal 14/15 equals it). Timeouts (counted as not a win): two, Open Steppe 1v1 Normal at threshold 13 and Ironback Ridge 1v2 Normal at 19.

How the gate was met (owner rule: never harder on Relaxed and Normal). The first versions lost too often against two
rivals: the test bot never builds a second core, so what lies within 35 m of its core decides its economy, and the AI's
expansions win the long game. Changes, each measured:
- Golden Heart first kept only two home deposits (1v1 Relaxed 1/4): back to the standard home field, rich heart kept;
  camps 16 m toward the corners instead of 12.
- Every map got a natural expansion within 35 m of each core (10,500 to 11,000 alloy there, like the older 160 m maps'
  11,500 to 12,000).
- Twin Rivers was 0/15 at 1v2 Normal (like Riverlands and Ashen Frontier): the second rival walked along the same bank.
  A cliff ridge now runs from each river to the map edge between the two camps of a bank, the middle ford became two
  fords, and two more naturals sit behind each camp's river (13/15 and 11/15).
- Dry Reach got one more small natural.
- Crown Mesa had four ramps (1v1 Normal 13/15, 87%, under the 93% average): eight ramps (14/15; 1v2 8/15 and 8/15).

Fast and Relentless are not gated; the bot does worse than average on Dry Reach (long, scarce: the AI's expansions
decide it) and on Crown Mesa 1v1, better on Golden Heart.

**Stuck units.** A headless soak (the computer playing every side, 900 s 1v1 and 700 s with three rivals, Normal)
looked for ground units holding a move order without moving 1.5 m for 45 s, not counting Harvesters waiting their turn
at a deposit or units in a fight: 0 to 1 per new map at 1v1 (Riverlands 2), 0 to 5 with three rivals, all of them
attack-moves stalled 8 to 23 m short of an enemy core in a base fight (Copper Basin shows the same, 4). None at a crag,
ridge, ramp, ford or bridge.

## Render budget

Scenario `twinrivers-high` (the heaviest new map: Twin Rivers, three rivals, fog lifted, zoom 105, desktop High), line
240 (large-map-high's): 235 to 237 draws (130 main, 105 shadow), 367,199 triangles, 222 matrix composes, no buffer
uploads. The other 160 m maps measured 174 to 175 draws in the same frame; Expanse (large-map-high) 218. Each bridge
is its own model (about 8 draws with its shadow), so four bridges cost about 17 more than Expanse's two.

## Checks

- `npm test`: 1,111 tests, 0 fail on the final merged tree (one wall-clock check, `binary-heap pathfinding ...
  quickly` on Highlands, failed once while the benches loaded the machine and passes alone).
- `tests/maps-variety.test.js` (12): old-map fingerprints, determinism, four-way symmetry of what play reads, equal
  start distances, deposits/camps/rings on clear level ground and apart, every deposit, ring and camp reachable from
  every camp (Walker-sized routes too), both rivers' crossings (stand, cross with a tank, label, ford slow-down), the
  ridge closed from river to edge, and the shape that makes each style. Older tests that counted seven maps or read the
  default deposits now cover the new maps where they apply.
- `npm run test:golden-full`: 97/97 (idle `d071360b` unchanged). `npm run baselines:diff -- --full`: all 8 baselines identical (merged tree).
- Browser suites on the merged build (port 4236): factions, language, cover-ui, phones, mobile, ui-quality and
  render-budget (`twinrivers-high`, `large-map-high`) pass. **terrain fails at 390×844 ("portrait: drawn on top",
  1.64)** on the merged tree, and identically on `feat/aaa-round3` alone (built from its own tree): an integration
  issue from the merged work, not this branch; it passed on this branch before the merge.
