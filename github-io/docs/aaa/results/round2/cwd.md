# CW-D: flatter AI ticks and dead code

Branch `r2/cwd-ai-dead-code` from `r2-wave-2`. Behaviour-neutral; nothing pushed.

## Changes
- `sim/ai.js`: one pass over `own` builds structure counts (hq, barracks, foundry, tower, completed foundry) and the unfinished-site list, replacing 8 repeated `own.some/filter` scans per think; the build-site search skips candidates that touch a standing structure before `placement()` (those always fail it, so the same first valid site is chosen, same orders, same messages).
- Removed (grep and tests prove unused): `TEAMS` (`data.js`), `disposeEmblems` (`emblems.js`), `BANK_NAMES` (`sfx-bank.js`), 7 dead CSS rules (`.mission-footer`, `.entity-stats`, `.progression-stats`, `.entity-purpose`, `.health-track`, `.queue-label`, `.cancel-build`; style, mobile, progression css), 113 stale `vi.json` messages.
- Dropped `export` from `FIELD_PERSONA` (ai-attack), `RECOVER` (ai-counter), `POINT_RADIUS`, `POINT_INCOME` (points). `worth` stays exported: `tests/ai-attack.test.js` imports it.
- New `tests/i18n-reverse.test.js` (2 tests): every `vi.json` message matches text in src/index.html/public (template literals count with `${}` as a wildcard); one explicit keep (`Can't see up there: send a unit up the ramp first`, asserted by `terrain-rules.test.js`).
- Template-built strings found reachable and kept: the Plateaus guide text, "Tap Build here / Click the site to start construction.", `Hold the Heroic 6 waves`, the ford text.

## Not done: needs CW-B / CW-C files (for the integrator, after those merge)
`MAP_SIZE`, `HALF`, `CELL`, `GRID`, `cellAt`, `worldAt` (`data.js`) and `paintTerrain` (`environment-view.js`) are unused but still imported by files owned by other packages: remove the names from the import lines of `view.js` (MAP_SIZE, HALF, GRID, paintTerrain), `navigation.js` (CELL, GRID, HALF, cellAt, worldAt) and `terrain.js` (HALF), then delete them from `data.js` / `environment-view.js`. Deleting them first would break those imports.

## Neutrality (all on this branch)
| Check | Result |
|---|---|
| `npm test` | 937 tests (935 + 2 new), 911 pass, 26 skipped, 0 fail |
| `test:golden-full` | PASS |
| `baselines:diff --full` (8: five mission tables, chronicles, defence = `check:defence --json`, Classic bench) | all identical |
| d071360b, the 14 checksums | inside `npm test`, pass |
| perf-ab final hash | riverlands `3f77c63b` and crossroads `06e1a37a` equal on both sides |
Not run: browser screenshot diff on the 6 viewports after the CSS removals (no browser run here; the 7 selectors have no use in src, tests or markup).

## Speed (`tools/perf-ab.mjs`, interleaved, median of 7, indicative, busy machine)
| Scene | p99 A | p99 B | B/A |
|---|---|---|---|
| riverlands-x2-300 (AI vs AI) | 0.765 ms | 0.760 ms | -0.6% |
| crossroads-wave-120 | 0.166 ms | 0.169 ms | +2.1% (noise) |
In these scenes AI think was already about 6% of tick time (70 of 1,150 ms over 6,000 ticks) and p99 is far below 5 ms; the 7.1 ms / 26 ms in the plan did not reproduce. The largest ticks are tick 0 (cold JIT, 11 ms inside the first `updateAI`) and `build()` ticks (about 3 ms, mostly `nav.rebuild`/path in `orders.js`, not owned here). The hoist is correct but gives no measurable gain; a real max fix needs `orders.js`/`navigation.js` (CW-C) or a warm-up, which this brief forbids changing. The acceptance (p99 5 ms, max 12 ms) is not demonstrably improved; the integrator should re-measure on a quiet machine.

## CHANGELOG subsection (for CW-F to paste)
"Clean-up (CW-D): the computer opponent counts its structures once per think and skips impossible build sites sooner (same decisions); removed unused code, 7 unused style rules and 113 unused Vietnamese messages; a test now fails if a Vietnamese message no longer matches any text in the game."

## Notes for CW-E
No source-text test regex was changed. `tests/ai-attack.test.js` still imports `worth`.
