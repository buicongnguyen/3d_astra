# CW-B: Shared rng and seeded cosmetic randomness

Branch `r2/cwb-rng` from `r2-wave-2`. Behaviour-neutral for the simulation.

## What changed
- New `src/rng.js`: `mulberry32`, `fnv1a`. Imported by `scatter.js`, `ambient-life.js`, `audio-logic.js` (still re-exports `mulberry32` and `hashString` for tests and callers), `audio-synth.js`, `music.js`, `sfx.js`, `snapshot.js` (state hash) and `view.js`. `src/sim/defence.js` keeps `seeded` and `seedOf` (CW-A's shim owns it); equality is pinned by a test.
- `Math.random` is gone from `fx.js` (particle rotation now draws from `fx.rng`, passed through `Layer.spawn(rng)`; default `fx.rng` is `mulberry32(1482)`, reseeded in `WorldView.reset()`), `fx-kinds/*` (comment only), `view.js` (module generator is now a mulberry32 stream reseeded in `createTerrain()`) and `ambience.js` (noise bed uses fixed seed 5). Only 3 `Math.random` calls were left in `fx.js` after W2-E, not 58.
- `map-edge.js` keeps its own mixing step: it is a bespoke jitter, not a mulberry32 or FNV copy; changing it would alter the cliff skirt geometry.
- `hashId` in scatter and ambient life was a signed FNV-1a; `fnv1a` is the unsigned form, and every use XORs then feeds `>>> 0`, so seeds are identical (tested).

## Tests
- New `tests/rng.test.js`: mulberry32 equals the scatter, audio and Defence generators (10 seeds x 200 draws); `fnv1a` equals the snapshot, audio, Defence and scatter hashes on 1,000 strings plus every map id.
- New `tests/cosmetic-seed.test.js` (source text): no `Math.random` in the listed files, reseed in `reset()` and `createTerrain()`, no private mulberry or FNV constants left in the seven files.
- The brief's "every save fixture" hashing is covered by the golden pins and `d071360b` in `npm test` (the state hash now runs through `fnv1a`).

## Neutrality checks
| Check | Result |
|---|---|
| `npm test` | 940 tests, 914 pass, 0 fail, 26 skipped |
| `npm run test:golden-full` | PASS |
| `baselines:diff --full` | all 8 identical (story, standard, veteran, mercy, firm, chronicles, defence, bench-classic) |
| `check:defence --json` vs `r2-wave-2` | byte-identical (`cmp`) |

## For the integrator
No existing test changed. Source-text tests keep matching: `tests/review-2026-10d-00.test.js` reads `view.js` (passes). Held-clock screenshot identity across two runs was not exercised in a browser here; code-level the only cosmetic sources are seeded.
