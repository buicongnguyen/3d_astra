# CW-C: Spatial grid and fast paths

Branch `r2/cwc-grid` from tag `r2-wave-2`. Behaviour-neutral; nothing was pushed.

## What changed
- `src/sim/grid.js` (new): an 8 m grid in a module `WeakMap` keyed by the Simulation (no entity or snapshot field), filed lazily on the first query of a tick and refiled when the tick, the entity list or its length changes. `near(sim, x, z, reach)` returns indices into `sim.entities` in ascending (entity) order, so ties pick the same target. It only prunes: each caller keeps its exact tests on live positions. Positions move after the build, so the window is widened by a slack (fastest speed x2 x the gap since the last build + 32 x gap + 0.5 m); a window over half the map, fewer than 40 entities, or a non-finite reach falls back to the plain scan.
- `combat.js`: `enemy`, `preferredEnemy`, `defenseTarget` and the splash loop in `hit` walk the grid candidates. Not done: the `garrisonHit` radius loop (it lives in `sim/defence.js`, which CW-A is splitting); attacker scans (`attacker` is a single id lookup, nothing to replace).
- `movement.js`: `separate()` keeps its pair order (i, then j ascending) and uses a unit grid from 40 units; the window is 1.81 x the largest radius plus the farthest any unit has been pushed so far (tracked exactly, so the margin is sound). The pair body is now `separatePair` (same code).
- `vision.js`: Defence skips team 0's sight loop (the later `fill(1)` overwrote it); the cell-distance maths is inlined; `isVisible`, `isExplored` and `hiddenTop` use `terrain.cellIndex` (no array).
- `terrain.js`, `navigation.js`: `cellAt` without `.map`, new `cellIndex`, `inWater` loop, `canStand`, `canTraverse` and `clearLine` without arrays and closures; same arithmetic, same order.
- `tools/perf-ab.mjs`: scene `riverlands-x3-300` (3 rivals), a `max` column, no `--scene` runs every scene. `npm run perf:tick` = `node --expose-gc tools/perf-ab.mjs --a r2-wave-2 --b src`.
- `tests/spatial-grid.test.js` (6 tests): 1,000 seeded random scenes (dead units, flyers, preferences, odd radii, fog, two maps) with `enemy`, `preferredEnemy` (both with and without clear shot) and `defenseTarget` equal grid on vs off; `near()` lists in order and misses nobody in reach; splash victims; `separate()` against the all-pairs loop on crowded scenes (bosses, flyers); ring ties by entity order; a 2,400-tick AI match with the same hash grid on and off. Mutation checks: removing the sort or the slack fails them.

## Neutrality
| Check | Result |
|---|---|
| `npm test` | 941 tests, 915 pass, 26 skipped, 0 fail (935 -> 941: the 6 new) |
| `npm run test:golden-full` | 82 / 82 (idle match d071360b among them) |
| `baselines:diff --full` | all 8 identical (missions x5, chronicles, defence, bench-classic) |
| `check:defence --json` | byte-identical to the `r2-wave-2` tree (6,982 bytes) |
| perf-ab final hashes | equal on every scene, both sides |

## Speed (interleaved A/B, median of 7, `--expose-gc`, loaded desktop; indicative)
| Scene | tick p95 A -> B | mean | p50 |
|---|---|---|---|
| riverlands, 3 rivals, 300 s | 0.810 -> 0.602 ms (-25.7%; first run -29.9%) | -26.9% | -28.0% |
| riverlands, 2 rivals, 300 s | 0.601 -> 0.423 ms (-29.7%) | -23.4% | -20.1% |
| Three Roads, DefenceBot, 120 s | 0.161 -> 0.093 ms (-42.3%; first run 0.271 -> 0.198, -27.1%) | -23.2% | -27.5% |

Skirmish clears the 20% gate. Defence p95 swings between -27% and -42% on a loaded machine; the mean is about -22%. Caveat for the integrator: these scenes peak near 100 entities, below the plan's "120-unit" wave, and a tick is 0.1 to 0.8 ms on this PC, so the quiet-machine re-run should decide the 30% gate. `max` (the AI think spike) is unchanged: that is CW-D's.

## Notes for CW-E / the integrator
- No source-text test reads the changed files in a way the edits broke (`npm test` green). `tests/terrain-labels.test.js` and `tests/review-2026-10d-09.test.js` needed no change.
- The grid trusts that positions change only by one tick of movement between a build and a query, or by a spawn (which changes the list length and refiles). Code that moves entities by hand and then queries within the same tick (a test) must bump `sim.ticks`/`sim.time`, or run with fewer than 40 entities; `setGridMinimum(Infinity)` forces the plain scan.
