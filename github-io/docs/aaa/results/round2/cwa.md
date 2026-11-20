# CW-A: Split `sim/defence.js` and move the Defence effects (code move only)

Branch `r2/cwa-defence-split` from `r2-wave-2`, port 4232. Behaviour-neutral; nothing pushed.

## What changed
- `src/sim/defence.js` is a 3-line re-export shim over `src/sim/defence/index.js`. The methods (83, not 81: the plan's count was slightly low) moved unchanged into `defence/{towers,waves,route,commander,armour,crossings}.js` as contiguous slices of the original object; `index.js` spreads them in that order, so `Object.keys` equals the original list. Named exports kept: `GARRISONS`, `seeded`, `seedOf`, `endlessWave`, `starsFor`, `defence`.
- Extra file `defence/common.js` (not in the plan): the shared constants, route geometry helpers, the `BLOCKERS` WeakMap (one instance) and `starsFor`, so the parts do not import each other in a cycle.
- `seeded`, `seedOf` and `endlessWave` live in `waves.js` (unchanged). `defenceResult` and `defenceStatus` ride with `crossings.js` to keep their original last position in the key order.
- `src/sim/effects.js` gained `applyHitEffects` (slow, mark, area slow/mark, burn zone), `pierceShield` and `burstStep`; same entity fields, zone and event. `garrisonHit`, `garrisonPierce` and `garrisonBurst` remain as thin wrappers in `towers.js` (combat.js untouched).
- `endlessWave` and `palette` are memoised in module WeakMaps keyed by the level definition (a per-n Map for waves). Callers only read the result.
- Largest new file: `waves.js`, 244 lines (limit 450).

## Neutrality proof
| Check | Result |
|---|---|
| `npm test` | 940 tests (935 + 5 new), 0 fail, 26 skipped |
| `npm run test:golden-full` | 82 / 82 |
| `d071360b`, 14 checksums, all golden pins | unchanged (inside `npm test` / golden-full) |
| `check:defence --json` | byte-identical (`cmp`) to the output from the `r2-wave-2` code, Heroic rows included |
| `baselines:diff --full` | all 8 identical (story, standard, veteran, mercy, firm, chronicles, defence, bench-classic); one run of the mercy table was killed by my own shell (exit 143) and re-run alone: identical |
| render budget (port 4232) | `defence-heroic-eco` 114 draws p95 (wave-2 record 114); `battle-eco` 107 p95. A first run of `battle-eco` failed `noGrowth` while baselines were running (load), the rerun passed |
| Command bench samples | the Classic bench is in baselines (identical); no Expanded/Field code path touched |

## Tests
New `tests/mixins.test.js`: no method name in two Simulation mixins (all 23 tables), the Defence key list in order, the named exports, the three wrappers over `effects.js`, `endlessWave` memo and purity.

## For the integrator
- No source-text test reads `sim/defence.js` (chronicles.test.js and story-scenes.test.js only import `GARRISONS` and mention the path in a comment), so no test edit is needed. CW-E has nothing to convert for this file.
- CHANGELOG: a CW-A subsection was added under "Unreleased: AAA round 2" (the brief asked for it; the plan reserves the file for CW-F, so expect a trivial append-only merge).
- Following up with `src/rng.js` (CW-B): replace `seeded` in `defence/waves.js` in round 3.

## Deviations
- 83 methods, extra `common.js`, CHANGELOG edited by CW-A, as above.
