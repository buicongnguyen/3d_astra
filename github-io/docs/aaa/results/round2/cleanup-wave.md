# Clean-up wave (integration)

Base `r2-wave-2` (76fef35). Merged with `--no-ff` in the order CW-A, CW-B, CW-C, CW-D, CW-F, CW-E. None reverted. Tag `r2-cleanup`. Nothing pushed or deployed. `package.json` stays 0.19.1; the CHANGELOG 0.25.0 entry is a proposed label.

## What merged
| Package | Content |
|---|---|
| CW-A | `sim/defence.js` split into `sim/defence/*` behind a shim, effects helpers in `sim/effects.js`, `tests/mixins.test.js` |
| CW-B | `src/rng.js`, seeded cosmetic randomness |
| CW-C | `src/sim/grid.js` (8 m grid), `perf:tick`, scene riverlands-x3-300 |
| CW-D | AI think in one pass, dead code and 113 `vi.json` messages removed, `tests/i18n-reverse.test.js` |
| CW-F | `app/defence/*` split, docs refresh, CHANGELOG 0.25.0 |
| CW-E | 32 review tests renamed, source-text tests converted |

Integrator changes: the CHANGELOG conflicts folded into CW-F's 0.25.0 entry (plus a CW-D bullet); the names CW-D left unused were removed (`MAP_SIZE`, `HALF`, `CELL`, `GRID`, `cellAt`, `worldAt` in `data.js`, `paintTerrain` and the `SURFACES` import in `environment-view.js`, and their imports in `view.js`, `navigation.js`, `terrain.js`); the TESTING and CHANGELOG counts were corrected.

## Neutrality
| Check | Result |
|---|---|
| `npm run build` | OK |
| `npm test` | 961 tests, 935 pass, 26 skipped, 0 fail (r2-wave-2: 935 / 909 / 26) |
| `test:golden-full` | PASS |
| `check:defence --json` | byte-identical to r2-wave-2 |
| `baselines:diff --full` | 8 of 8 identical |
| CI-local `--fast`, 2 lanes, port 4238 | 60 of 60 suites pass, 36 groups (includes ui-quality, layout-f, mobile, status-layout, render-budget: covers CW-D's CSS removals) |
| `test:render-budget` | draws unchanged: battle-expanded-full-eco 149, defence-heroic-eco 114, night-battle-eco 107 (same as wave 2) |

## Bundle
Entry chunk 845.34 to 849.13 kB (+3.79 kB, gzip +1.56 kB). Per merge: CW-A +0.21, CW-B -0.58, CW-C +3.85, CW-D +0.18, CW-F +0.13, CW-E 0. All of the growth is CW-C (`sim/grid.js`, 6.4 kB source, and its fast paths). Accepted: the grid is the reason the tick got 22 to 30% cheaper (below), and moving it lazy would not work because the sim loads in the entry. Other chunks: vi 131.6 to 118.7 kB, defence-ui 54.4 to 57.1 kB, css 159.3 to 158.3 kB.

## Tick time (`tools/perf-ab.mjs`, 5 runs, r2-wave-2 vs merged; loaded-machine indicative, final hashes equal)
| Scene | p95 A to B | mean |
|---|---|---|
| riverlands-x2-300 | 0.482 to 0.345 ms (-28%) | -23% |
| crossroads-wave-120 | 0.133 to 0.085 ms (-36%) | -22% |
| riverlands-x3-300 | 0.651 to 0.453 ms (-30%) | -28% |

## CI
- `ci:build-job` on 2 cores (`start /affinity 0x3`): 232 s (was 310 s at wave 2; limit 10 min).
- Group estimate (local `--fast` suite sum x 14): the longest groups are commands 18.4 min, ui-extras 17.5, story 17.5, r2-w1f 14.9, construction 14.2; all under 20.

## Review: CW-C grid x CW-A split
Only `combat.js` and `movement.js` use the grid. Nothing in `sim/defence/*` queries it. The grid is per-Simulation (WeakMap), rebuilt when ticks, time, list or length change, with a per-tick travel slack on every query. `defence/route.js` moves units by hand; this is covered by the slack. The one-time push out of the water in `defence/crossings.js` was not proven to fit inside the slack. Results are identical, so no effect shows.

## Sweep
31 JSON files parse. Six deleted tests (renamed by CW-E) are referenced only by the plan document. TESTING counts match reality (160 test files, 62 browser scripts in tests/*.mjs, 36 CI groups).

## Open issues
- Entry chunk +3.79 kB (accepted above).
- `ci:build-job` pass/fail was read from the process exit code only (its log capture was empty).
- Perf timings were taken on a quiet but not isolated machine; the gate is a re-run if the owner wants numbers.
- Crossings slack not proven; add a test in round 3.
