# W0-A · Safety net, baseline tools and the view seam: results

Branch `r2/w0a-safety-net` (worktree `3d_astra-r2-w0a`), base `feat/aaa-round2` at `4f951a6`, port 4232. Ideas: K1 (pins and tools), part of K11 (`tests/lib/sim.js`, `tests/lib/duel.mjs`), the view seam.

Commits:

| Commit | What |
|---|---|
| `20a6b31` | Golden pins split into skirmish, Defence and story files; new pins; `GOLDEN_FULL` split, `test:golden-full`, `ci:build-job`, CI entry `golden-full` |
| `46c855a` | Equal-cost duel harness `tests/lib/duel.mjs` and `tests/duel.test.js` |
| `1e274bb` | `check:missions --json`, bench `--jobs` / `--rules` / `--json`, `tools/baseline-diff.mjs`, `tests/baseline-tools.test.js` |
| `672d111` | View plugin seam (`src/view-plugins.js`, six call sites in `src/view.js`), `tests/view-plugins.test.js`, `docs/VIEW_PLUGINS.md` |
| `d84eca4` | The guarded `rules` line in `createSim`, the `rules` test hook, `tests/rules-hook.test.js`, the data-driven render-budget harness |
| (last) | This file, `docs/TESTING.md` section, `docs/CHANGELOG.md` subsection |

Nothing changes for the player. No pin, checksum or baseline moved.

All timings below were taken on a machine shared with other agents (CPU at about 90%); they are indicative, as section 2.3 says.

## 1. Before (base `4f951a6`, recorded before the first edit)

Kept in `.tmp/before/` while working (deleted at hand-off; the numbers are here).

- `npm test`: 645 tests, 644 pass. The one failure was `review-2026-09.test.js` "binary-heap pathfinding ... quickly", a wall-clock assert that failed under the machine load and passed in every later run.
- `tests/golden-play.test.js`: 33 subtests pass (values in section 3).
- Render budget (`--record before`, GPU, old harness): p95 draws in section 4.
- `check:missions --only <id> --jobs 3` (text), Standard:

  | Mission | passive | generic | objective |
  |---|---|---|---|
  | m01-first-light | running 305 s, ADAa, wave 130, lost 1 | victory 143 s, DDDd, gold | victory 187 s, DDDd, lost 0, gold |
  | m03-the-ashen-line | running 305 s, AAdaa, wave 215 | running 485 s, AAdda, wave 223, lost 24 | victory 604 s, DDddd, lost 30, gold |
  | m06b-wings-over-copper | running 215 s, AAa, wave 100 | running 485 s, DAa, lost 1 | victory 508 s, DDd, lost 1, gold |

- `bench:factions --factions meridian,ashfall --maps classic,riverlands,dunes,basin,highlands --speeds normal` (10 matches, one process): Meridian 70, Ashfall 30; 122 s.
- `tools/skirmish-bench.mjs --speeds normal --maps classic,riverlands --attack-at 12,20` (4 games): 100% wins, median 333 s.
- `check:defence --json`: 28 rows, PASS (8 min 18 s under load).

## 2. Acceptance

| # | Criterion | Result | Met |
|---|---|---|---|
| 1 | `npm test` green; at least 609 + 25 tests; `grep -l d071360b tests/*.js` lists exactly one file | 673 tests at hand-off, 674 after the review (645 at the base, +29). 657 pass (658 after the review), 15 skipped (the long pins, which `test:golden-full` runs and passes), **1 fails: the exact-text assert "newGame rebuilds a clean sim" in `tests/review-2026-10b-00.test.js`**, which pins the old `createSim` line. W0-A owns the line but not that test (nobody owns it in Wave 0; W1-A in Wave 1), so per section 2.8 the replacement is in section 7 for the integrator. With it applied: 658 of 658 pass (659 of 659 after the review). `grep -l d071360b tests/*.js` → `tests/golden-skirmish.test.js` only | No, until the one-line test change is applied |
| 2 | The `npm test` part of the golden files in 30 s or less; `test:golden-full` in 3 minutes or less | Fast part (three files in parallel), interleaved with the old single file: 6.4 / 8.0 / 99.7 s against 14.2 / 13.8 / 211.0 s (the third pair hit a load spike on both sides); median 8.0 s against 14.2 s. `test:golden-full`: 54 of 54 in 124 s alone, 184 s inside the CI matrix run with a second lane busy | Yes (indicative; the integrator's quiet-machine run decides) |
| 3 | Each tool reproduces byte-identically on its subset | `check:missions --json --only m01-first-light,m03-the-ashen-line,m06b-wings-over-copper --jobs 3` twice: identical, and every row equals the base text run above. `bench:factions --json --jobs 3` on the 10-match subset: JSON and printed output byte-identical to the base tool's one-process run. `check:defence --json` three times (base tool at the base, `baselines:diff --record`, `baselines:diff`): identical, 28 rows | Yes |
| 4 | Render budget p95 identical in all 12 existing scenarios | Identical in all 12 (draws and every other p95 counter), old harness on the base build, new harness on the base build and new harness on the seam build; the asserting run passes all 12 with the new no-stand-in-airframe check | Yes |
| 5 | A held-clock `battle-eco` screenshot is pixel-identical before and after the view seam | SwiftShader (`SOFTWARE_RENDER=1`): 0 differing pixels, the PNG files are byte-identical (sha256 `5909de42…`) in 3 base runs and 2 seam runs. A third seam run differed in 403 grass and ground pixels by at most 3 levels (none on a unit, bar or building; `w0a/battle-eco-outlier-diff.png`); it did not come back, so it is a timing effect of the harness, not the seam (see section 8). GPU (d3d11): base against seam 2 to 3 pixels at ±1, the same as base against base (3 pixels at ±1) | Yes |
| 6 | All CI browser groups green (`CI_LOCAL_PORT=4232 CI_LOCAL_LANES=2 npm run test:ci-local -- --fast`) | 24 groups, 51 suites: 48 passed in the matrix; offline, render-budget and messages failed on load-sensitive waits and each passed when run again alone (section 5) | Yes, with three load reruns |

Test count: +28 (`golden-*` 48 against 33 in `golden-play`, `duel` 3, `baseline-tools` 4, `view-plugins` 4, `rules-hook` 2). Time (section 2.10, at most 10 s a package): the new files take `duel` 4.4 s, `baseline-tools` 8.1 s (child processes), `view-plugins` 0.5 to 1 s and `rules-hook` under 0.1 s, while the golden pins take about 6 s less than the old file: net about +8 s (busy machine, indicative).

## 3. Golden pins

Pins are re-recorded only by the integrator, with a named reason. Every value below was recorded at `4f951a6`, before any change; the 33 values of `golden-play.test.js` are unchanged.

Skirmish (`tests/golden-skirmish.test.js`), the computer on every side; 300 s and the end run with `GOLDEN_FULL=1`:

| Setup | 60 s | 180 s | 300 s | End |
|---|---|---|---|---|
| idle all-Meridian, 3 ways (60 s) | `d071360b` | | | |
| classic ×1 normal | `fef65c4f` | `39426dbc` | `6d992886` | defeat 231 |
| highlands ×2 relentless coalition | `807ca1eb` | `5450ac4a` | `45ab65f9` | defeat 181 |
| riverlands ×2 fast | `30be65e6` | `d16fd4cd` | `3f77c63b` | running 300 |
| basin ×3 fast | `853fdf6c` | `8422f5d9` | `db45b921` | defeat 246 |
| **new** riverlands ×3 normal, Sunward against mixed (Veil, Meridian, Ashfall), capture points | `56c0461d` | `387ab7ee` | `42be5155` | running 300 |
| **new** dunes ×1 normal, Ashfall against Veil, capture points | `28775897` | `7fa3ba8f` | `4841198e` | running 300 |

**New** (`GOLDEN_FULL`): each of the six saved at 180 s, reloaded with `Simulation.load` (same hash at once) and played to 300 s gives the 300 s pin above.

Defence (`tests/golden-defence.test.js`), DefenceBot on Standard:

| Level | Result | Stars | Lives | Towers standing (new) | Hash |
|---|---|---|---|---|---|
| d-gorge | victory | 3 | 20 | `r3mr3r3b3s1r3b3s1a3b2t3s1b1` | `3f391c5e` |
| d-bridges, demolishing | victory | 3 | 18 | `r3r3r3r3r3r3r3b1a3s1t1a2t1` | `d3c0f7a1` |
| d-crossroads (`GOLDEN_FULL`) | victory | 2 | 15 | `b3s3b3s3a3t3b3a3s3b3t3s1b3` | `c77144f6` |
| **new** d-gorge Endless to wave 12 (`GOLDEN_FULL`) | held 12, wave 12 | | 20 | | `5167e811` |

Story (`tests/golden-story.test.js`), 120 s on Standard, default decisions:

| Mission | Player | Pin |
|---|---|---|
| m01-first-light | ObjectiveBot | `a740365c` |
| m03-the-ashen-line | ObjectiveBot | `9d9693b6` |
| m06b-wings-over-copper | ObjectiveBot | `223ff814` |
| **new** ca1-cold-berths (Ashfall Chronicle) | ObjectiveBot | `ab4e3941` |
| **new** m02b-hold-the-river (Defence rules) | DefenceBot | wave 4, lives 20, `4c430aeb` |

Declared moves for the integrator after W0-B: none expected from W0-B's seam commit. D1 is already in the base (`1da6220`), so the Defence pins above already include it; W0-B skips its D1 commit, so the "re-record golden-defence and m02b with reason D1" step of "After Wave 0" should find nothing to re-record. If W0-B's seams move any pin, that is a bug in the seams.

## 4. Render budget (p95 draw calls)

| Scenario | Before (old harness, base) | Base (new harness) | Seam build (new harness) | Limit |
|---|---:|---:|---:|---:|
| base-high | 141 | 141 | 141 | 160 |
| river-overview-high | 170 | 170 | 170 | 190 |
| large-map-high | 218 | 218 | 218 | 240 |
| battle-eco | 107 | 107 | 107 | 120 |
| three-rivals-eco | 146 | 146 | 146 | 150 |
| three-factions-eco | 182 | 182 | 182 | 185 |
| defence-wave-eco | 109 | 109 | 109 | 120 |
| air-battle-eco | 116 | 116 | 116 | 118 |
| boss-battle-eco | 116 | 116 | 116 | 120 |
| defence-river-eco | 132 | 132 | 132 | 135 |
| defence-carrier-eco | 139 | 139 | 139 | 142 |
| defence-big-eco | 106 | 106 | 106 | 112 |

Triangles, instanced draws, composes, matrix multiplies and buffer uploads are identical too. Median CPU render times moved only with the machine load (for example battle-eco 14.9 / 11.6 / 9.7 ms).

The new scenario fields, tried with a scratch copy of the harness (not committed): `spawn` (3 Walkers and 2 Gliders, neither in the core set) and `boss: "ironvanguard"` drew every type with its real model (0 stand-ins; before the preload change the Gliders would have drawn as the stand-in wing and the Walkers not at all); `variant: "endless"` on d-gorge built the Endless level through the Defence menu (`missionDef.variant` = endless, 40 units, 4 towers); `rules: {}` was set before `restart()` and cleared after; `status` fails with "a status scenario needs the status core (sim.applyStatus)" until W0-B merges.

Screenshot: `w0a/battle-eco-held-clock.png` (SwiftShader, identical before and after).

## 5. CI browser groups

`CI_LOCAL_PORT=4232 CI_LOCAL_LANES=2 node tests/ci-local.mjs --fast --no-unit` (13:37 to 14:54; `--no-unit` because `npm test` was run on its own and its one declared failure, section 2, would stop the run): 24 groups (the 23 existing plus `golden-full`), 51 suites, **48 passed** on the first run. The three that failed all passed when run again alone on the same build:

| Suite (group) | In the matrix | Alone | Why it failed in the matrix |
|---|---|---|---|
| offline (settings) | FAIL after 386 s: the new service worker did not activate within 90 s after the page closed | PASS, 245 s | The hand-over wait its own comments call slow on a busy runner; it serves its own copy of the build on a random port, and W0-A changed nothing in the worker or caches |
| render-budget (interface) | FAIL after 345 s: the click on the Defence mode button (an existing step) timed out after 30 s, at the 7th scenario | PASS, 128 s, all 12 scenarios, 0 stand-ins | The page was too busy to take the click; the standalone asserting run before the matrix passed too |
| messages (ui-extras) | FAIL after 546 s at 320×568: "alert over the targeting prompt", measured 400 ms after a 0.25 s transition | PASS, 71 s | A layout read during a transition on a loaded machine; W0-A changed no UI or CSS |

`golden-full` passed in the matrix in 184 s (124 s alone before, so a little over the 3-minute line only with the matrix running beside it). Logs: `test-results/ci-local/` (not committed).

## 6. What was built

- `tests/golden-skirmish.test.js`, `golden-defence.test.js`, `golden-story.test.js` (section 3); `tests/golden-play.test.js` deleted. The pin files' comments now point at `golden-skirmish.test.js` (no `d071360b` literal outside it).
- `tests/lib/sim.js` (`run`, `aiMatch`, `hashesAt`, `missionMatch`), `tests/lib/golden.mjs` (`pin`, `LONG`, `FULL`, `RECORD`).
- `tests/lib/duel.mjs`: `duel(sideA, sideB, { budget, factions, offsets, rules, watch, limit })` → `{ mean, wins, battles }`. Offset 0 reproduces `balance.test.js` exactly. Rangers against Breakers at 1,000: mean +0.53, 10 of 10 won.
- `tools/mission-check.mjs` `--json` and a comma list for `--only`; `tools/faction-bench.mjs` and `tools/skirmish-bench.mjs` `--jobs N` and `--rules '<json>'` (the ladder also `--json`, `--cap`); `tools/baseline-diff.mjs` (`npm run baselines:diff`: fast set, `--full`, `--only`, `--record`, `--dir`, `--list`; "not recorded yet" for a missing file).
- `npm run test:golden-full` (`tests/golden-full.mjs`) and CI matrix entry `golden-full`; `npm run ci:build-job` (`npm test && npm run check:defence && npm run build`).
- `src/view-plugins.js` and six one-line call sites in `src/view.js` (constructor, `scaleFor` after the clamp, `dress` before the transform cache, `frameScaleFor` with the readability scale plus `scaleBar` for the vitals bar, `event`, `update`, `reset`); `docs/VIEW_PLUGINS.md`.
- `src/main.js` `createSim`: `...(S.rules ? { rules: S.rules } : {})` (inert until W0-B; W1-A owns the line next); `src/app/debug-hooks.js`: `get rules()` / `set rules(r)`.
- `tests/render-budget.mjs`: fields `spawn`, `boss: "<type>"` (with the boss's first attack read from `balance.json`), `variant`, `status`, `rules`; the preload union (spawn, air, boss and its drops); `Object.assign(limits, {});`; `SOFTWARE_RENDER=1`; an assert that no entity draws as the stand-in airframe.
- Docs: `docs/TESTING.md` section "Golden pins and baselines" (what each pin covers, what `d071360b` really pins, the `GOLDEN_FULL` split, the duel harness, the tools); `docs/CHANGELOG.md` `## Unreleased: AAA round 2` / `### W0-A`.

## 7. For the integrator

**Test change (source-text test W0-A does not own).** `tests/review-2026-10b-00.test.js`, test "newGame rebuilds a clean sim", line 23: the exact-text assert must include the new spread. Replace the string literal's end

```
capturePoints: !S.mission && S.playMode === \"skirmish\" });"));
```

with

```
capturePoints: !S.mission && S.playMode === \"skirmish\", ...(S.rules ? { rules: S.rules } : {}) });"));
```

(W1-A owns both that test and the `main.js` line in Wave 1.)

**Seam request 1: `tools/chronicle-check.mjs --json`** (owned by nobody this round). `chronicles.json`, one of the baselines the integrator records after Wave 0, needs JSON from the Chronicle checker; today it prints text only, so `baselines:diff` reports "ERROR ... it needs tools/chronicle-check.mjs --json" for it (the other seven baselines work). The patch is ready and applies cleanly to `4f951a6`: `git apply github-io/docs/aaa/results/round2/w0a/chronicle-check-json.patch` from the repo root. It mirrors `check:missions --json` (rows `{ mission, kind, result, time, objectives, stars, lives, towers, wave, lost, medal, misses }`, no wall-clock field, no `process.exit` after the JSON). Tried on a scratch copy: `--chronicle ashfall --only ca3 --json` gives the passive and objective rows of The Scrapyard Gorge.

**Seam request 2: `docs/TESTING.md` line 6** (the "Unit tests" section, an existing paragraph W0-A may not edit) still names `tests/golden-play.test.js`. Replace that paragraph with: "Golden gameplay pins (K1): `tests/golden-skirmish.test.js`, `golden-defence.test.js` and `golden-story.test.js`; see "Golden pins and baselines" below."

**Recording the baselines after Wave 0.** On a quiet machine, after the chronicle patch: `npm run baselines:diff -- --record --full` writes all eight files into `docs/aaa/results/round2/baseline/` with exactly the commands `baselines:diff` re-runs (`--list` prints them), one at a time at `--jobs 3`; then `npm run baselines:diff -- --full` must say identical. `--only missions-veteran` and friends record one at a time. Rows that a wall-clock `--timeout` stopped are "did not finish" rows, so a busy machine can record a different table (Veteran m12 times out today, as the plan says).

**Merging with W0-B.** No file overlap. W0-B's `rules` constructor option makes the `createSim` line, the harness's `rules` field and the bench `--rules` flags live; with empty or no rules they stay inert (the bench test passes `--rules '{}'` and checks it equals no rules, which holds after W0-B too). The render-budget `status` field becomes usable once `sim.applyStatus` exists. `tests/wings.test.js`, `chronicles.test.js` and `player-faction.test.js` (W0-A's) read `simulation.js` as text: W0-A changed only comment lines in the pin files, so any break there after W0-B's seam lines is W0-B's to list.

## 8. Notes and observations

- **What `d071360b` pins.** The classic map with no AI for 60 s is a still life: no Harvester gathers, no order, 450 alloy a side throughout, one message event. It pins map generation, the starting set-up, the idle tick and the save format, nothing of play. The AI-against-AI, DefenceBot and ObjectiveBot pins are what catch a change in play.
- **Render-budget screenshots are not perfectly held.** One of three seam-build runs under SwiftShader differed from all other runs in 403 small grass and ground pixels (scatter or ambient life; `w0a/battle-eco-outlier-diff.png`), which no other run of either build showed. Something cosmetic can advance before `__freezeFrames` takes hold (the page runs normally while models load). Draw counts are unaffected. A later package that compares screenshots should take two runs per side. On the GPU path, runs differ by 1 level in 2 to 5 pixels every time.
- **`ci:build-job`** was not timed on 2 cores here (the integrator's step); as committed it stops at `npm test` until the test change in section 7 is applied.
- The machine's load made one wall-clock unit test (`review-2026-09` pathfinding budget) fail once at the base; it passed in every later run.

## 9. Deviations from the brief

- **Three new files outside the "Files owned" list**, all new and conflict-free: `tests/golden-full.mjs` (the `test:golden-full` runner: `tests/ci-matrix.test.js` requires every matrix script to be `node tests/<file>.mjs`, and `GOLDEN_FULL=1 node --test ...` does not run from cmd or PowerShell), `tests/baseline-tools.test.js` (the brief's "bench `--jobs 3` equals single-process" test plus the `--json` tools), `tests/rules-hook.test.js` (the brief's "`createSim` without `S.rules` passes no `rules` key", run on `createSim`'s own source with a recording Simulation, plus the hook).
- **m02b is played by the DefenceBot**, not the ObjectiveBot: it is a Defence-rules mission, and `check:missions` plays those with the DefenceBot (`tools/mission-check.mjs` `playDefenceMission`). The pin is wave, lives and hash after 120 s.
- **The two new skirmish setups use capture points** and `skirmishSides`, as the skirmish screen builds a match (`createSim`), so capture points are pinned too; the four older setups keep their options.
- **The bench test uses `--cap 30`** (10 matches of 30 s), so `npm test` stays fast; the full-length 10-match equality was checked by hand (criterion 3).
- **Added beyond the brief:** the towers standing in the Defence pins, a save-and-reload check on all six AI setups (the brief names one), `--cap` and `--dir`/`--list` options, `SOFTWARE_RENDER=1` and the stand-in-airframe assert in the render harness.
- The brief's line numbers in `view.js` (1100, 1138, 1523) matched the code at `4f951a6`.

## 10. Adversarial review (after hand-off)

The reviewer re-ran the checks on this branch, port 4232, on the same busy machine (timings are indicative):

- `npm test`: 674 tests, 658 pass, 15 skipped (long pins), 1 fails: the declared source-text assert of section 7. The replacement in section 7 was checked: with it, that test passes. `grep -l d071360b tests/*.js` lists `tests/golden-skirmish.test.js` only; the 13 mission checksums pass.
- Golden fast part against the old file, interleaved (three pairs): 12.3 / 25.0 / 13.0 s against 38.6 / 23.4 / 26.6 s; median 13.0 s (limit 30 s). `test:golden-full` 64 s inside the CI-local run.
- The new non-golden test files on two cores (`start /affinity 0x3`), alone: `baseline-tools` 7.9 s, the others under 2 s.
- `check:missions --json --only m01-first-light,m06b-wings-over-copper --jobs 3` twice: byte-identical, rows equal the base table in section 1. `baselines:diff --dir .tmp/bl --record --only defence` then a compare: 28 rows, identical.
- Render budget, all 12 scenarios asserting: p95 draws exactly as in section 4, no stand-in airframe, no undrawn entity. SwiftShader `battle-eco` screenshot: sha256 `5909de42…` on the base build and on the reviewed build. `air-battle-eco` and `boss-battle-eco` flip between two images (about 400 pixels, at most 3 levels) from run to run on the base build as well; each reviewed-build image equals a base-build image exactly.
- CI-local, `--fast --no-unit`, 2 lanes, groups interface, visuals, air, bosses and golden-full: 12 of 12 suites passed.

Fixed in review (three commits, each with a check that fails without it):

1. **A boss's vitals bar did not follow a plugin's static scale.** `BossView.dress` sets the boss bar to 6.4 after the plugin factor is applied, so the documented example (bosses ×1.5, W2-F's boss presence) left the bar inside the enlarged model. `createEntity` now multiplies the boss bar by the plugin factor after `BossView.dress` (exactly 1 without a plugin). New test in `tests/view-plugins.test.js` (673 → 674 tests).
2. **The render-budget model check missed ground units.** A ground type without a loaded template is skipped by `WorldView.update`, not drawn as the stand-in airframe, so a `spawn` of an unloaded ground type measured too few draws and passed. The summary now has `unloaded` (types of entities without a view object), asserted empty; a scratch scenario spawning Walkers without the preload fails on it.
3. **A `rules` scenario could be measured without its rules.** `restart()` rebuilds the match later when the ruled match needs models that are not loaded (`ensureMatchModels`), and the harness had cleared the rules by then. The harness now restarts once with the rules and awaits that load; the frozen set-up's restart then builds at once and throws if it ever has to load again. A scratch probe forcing one asynchronous load showed the old flow building the final match with `rules = null`.

Docs: `VIEW_PLUGINS.md` and the `view-plugins.js` header now say the `event` hook sees only the events `WorldView.event` gets (`src/app/frame.js` sends `message`, `incoming`, `say`, `objective`, `drop` and the other interface events elsewhere), and that a building's faction emblem and the high-ground mark (`src/tactics-view.js`, reads `u.readabilityScale` only) do not follow a plugin's scale.

Notes for later packages, not fixed (files W0-A does not own):

- W1-A: `createSim`'s contract line passes `S.rules` to campaign missions too when it is set; "skirmish only" is W1-A's guard to add.
- W1-D (`frameScaleFor` at strategic zoom): the high-ground mark above a unit stays at the unscaled bar height (`tactics-view.js:196`).
- On a 2-vCPU CI runner `node --test` runs one file at a time (its default concurrency is the core count minus one), so the three golden files do not run in parallel there; the build-job timing on 2 cores stays the integrator's measurement.
