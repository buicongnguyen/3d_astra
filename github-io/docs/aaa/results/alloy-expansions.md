# Alloy expansion fields

The audit compared the generated 1v1 Skirmish layouts at `bfcabe0` with the four updated maps. Starting camps already have three 2,000-alloy patches. Candidate expansion cores had to fit the game's terrain and building clearances, stand at least 22 m from existing cores, and serve the field within 13 m. The verified fields below are all within 10 m. The seven classic layouts retain their authored expansion fields, incidental midfield deposits and campaign economy. Dry Reach and Twin Rivers already have paired field deposits when their map reflections are applied.

| Skirmish map | Total alloy patches, before → after | Total alloy stock, before → after |
|---|---:|---:|
| Ashen Frontier | 14 → 14 | 33,000 → 33,000 |
| Meridian Riverlands | 14 → 14 | 33,000 → 33,000 |
| Copper Basin | 22 → 22 | 57,000 → 57,000 |
| Frontier Expanse | 26 → 26 | 69,000 → 69,000 |
| Amber Dunes | 22 → 22 | 57,000 → 57,000 |
| Verdant Crossing | 26 → 26 | 69,000 → 69,000 |
| Obsidian Highlands | 30 → 30 | 81,000 → 81,000 |
| Golden Heart | 18 → 22 | 52,800 → 57,600 |
| Dry Reach | 32 → 32 | 58,400 → 58,400 |
| Twin Rivers | 26 → 26 | 62,000 → 62,000 |
| Ironback Ridge | 22 → 30 | 50,800 → 62,400 |
| Crown Mesa | 22 → 26 | 56,000 → 61,600 |
| Open Steppe | 12 → 14 | 27,000 → 30,000 |

Each site gained a second mineable patch. Coordinates below are representative. The maps mirror their fields for the other camps.

| Site and tested core position (x, z) | Local alloy, before → after | Centre distance to each patch (m) | Actual first loaded return from each patch (m) | Alloy delivered to this core in 60 s, before → after |
|---|---:|---:|---:|---:|
| Golden Heart (−27, 57) | 3,000 → 4,200 | 7.6, 7.6 | 2.8, 0.2 | 480 → 960 |
| Ironback Ridge (−27, 19) | 2,500 → 4,000 | 7.1, 8.6 | 0.7, 0.9 | 480 → 920 |
| Ironback Ridge (−33, 67) | 2,400 → 3,800 | 7.6, 7.6 | 2.8, 0.2 | 480 → 960 |
| Crown Mesa (−33, 25) | 2,000 → 3,400 | 7.1, 7.1 | 0.2, 0.7 | 440 → 930 |
| Open Steppe (−23, −7) | 2,500 → 4,000 | 7.1, 8.1 | 0.5, 0.0 | 480 → 930 |

The single-worker run used a scout order, normal Command core construction and gather orders. The return distance measures actual movement from full cargo until banking. A worker can already be in the delivery radius when it finishes harvesting. The 60-second comparison used six Harvesters placed by the same finished core, empty at the start, assigned evenly to the available patches. Each patch supports three active workers. Only deliveries to that core were counted. Results describe the fixture, and approach positions and crowding affect a live match.

At 390×844 in Chromium touch emulation, the Command core tile, ground tap and confirmation built the Open Steppe expansion. Tapping the new alloy with a selected Harvester mined 54 alloy and banked 50 in 20 s. The automated test builds all five example sites from every camp and delivers from both patches in each case.

## Difficulty and compatibility

The difficulty sweep compared 64 pairs of matches across the four changed maps, Relaxed and Normal, 1v1 and 1v2 coalition, and attack thresholds 12, 16, 20 and 24, with capture points enabled. Every winner matched, and 19 match durations changed. Player-bot wins before and after were 16/16 for both 1v1 speeds, 11/16 for Relaxed 1v2, and 9/16 for Normal 1v2.

New static outcrops have separate IDs because unit movement timing depends on unit IDs. The four maps retain all original deposit IDs, coordinates, stock and the next dynamic entity ID. Actual saves from the baseline loaded with their original deposit lists, matched their previous hashes, and stayed in step with the original simulation for another 200 ticks.

The production build passed. The final unit suite passed 1,101 tests and skipped 28, with zero failures. All 99 full golden tests and all eight full balance baselines matched. The phone check used touch emulation. A physical handset review remains available to the owner.
