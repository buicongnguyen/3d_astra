# Wave 0 integration: results

Integrator, 2026-11-19. Integration worktree `3d_astra-zones`, branch `feat/aaa-round2`, base `4f951a6` (the plan commit; D1 and the first golden pins were already on the branch: `8e2ff6b`, `1da6220`, `98c0471`). Port 4238. Tag `r2-wave-0` (local, annotated). Nothing was pushed, deployed or dispatched.

**Machine load.** Every number below was taken on the shared machine (28 logical CPUs). Other sessions kept it between 80 and 100% CPU most of the afternoon, with 80 to 115 node processes; a short quieter spell (35 to 55%) came at 17:15. No quiet machine was available, so the timing gates and the 2-core build-job time are indicative and noise-limited (section 6). Deterministic results (pins, baselines, hashes, draw counts) do not depend on load.

## 1. What merged

| Package | Branch, head | Engineer | Reviewer | Merge commit | Result |
|---|---|---|---|---|---|
| W0-A · Safety net, baseline tools and the view seam | `r2/w0a-safety-net`, `91bfb14` (6 + 4 review commits) | partial | fixed (3 defects fixed in review) | `06d75bf` | **Merged.** "Partial" meant one declared source-text test change for the integrator; applied in `ba70376`. Nothing of the package is missing after that: both seam requests were applied too (`ba70376`, `5984311`). |
| W0-B · Sim seams, status core (D1 commit 2 skipped: D1 already merged) | `r2/w0b-sim-seams`, `a4e4c12` (4 + 2 review commits) | done | fixed (2 latent defects in registered abilities fixed in review) | `751c779` | **Merged.** |

Not merged: none. Blocked: none.

Integrator commits on `feat/aaa-round2` after the base:

| Commit | What |
|---|---|
| `06d75bf` | Merge W0-A (`--no-ff`) |
| `ba70376` | W0-A's declared test change: `tests/review-2026-10b-00.test.js` "newGame rebuilds a clean sim" now expects the guarded `...(S.rules ? { rules: S.rules } : {})` in the `createSim` line; `docs/TESTING.md` line 6 names the three golden files instead of the deleted `golden-play.test.js` (W0-A seam request 2) |
| `5984311` | `tools/chronicle-check.mjs --json` (W0-A seam request 1: `git apply docs/aaa/results/round2/w0a/chronicle-check-json.patch`), needed for `chronicles.json` |
| `751c779` | Merge W0-B (`--no-ff`). One conflict: both packages created `## Unreleased: AAA round 2` in `docs/CHANGELOG.md`; kept one heading with `### W0-A` then `### W0-B` under it |
| `878321b` | Fix: `baselines:diff` passes `--timeout 600` (was the tools' 240 s) to `check:missions` and the Chronicle checker, so the finale m12 is played to its end on a loaded machine; `docs/TESTING.md` updated (section 4) |
| `81dd772` | The eight round 2 baselines (section 4) |
| (this file) | `docs/aaa/results/round2/wave-0.md` |

Merge checks (plan step 3): every JSON file parses (`package.json`, `src/balance.json`, both locale files, `public/models/manifest.json`, `src/visual-style.json`). One duplicate key exists, `"Next idle Harvester"` in `src/locales/vi.json` (lines 109 and 763, same value), but it is older than this round (`a9147d4`) and neither package touched the file; left as it is. `src/sim/content/index.js` and `src/view-plugins.js` are both empty registries, as Wave 0 ships them. `.github/workflows/pages.yml` gained exactly one matrix entry, `golden-full`.

## 2. Tests

| Run | Tree | Result | Time |
|---|---|---|---|
| `npm test` | base `4f951a6` | 645 tests (package records) | |
| `npm test` | after W0-A + test change (`5984311`) | 674 tests: 659 pass, 15 skipped (the `GOLDEN_FULL` pins), 0 fail | 230 s (busy) |
| `npm test` | after W0-B (`751c779`) | **710 tests: 695 pass, 15 skipped, 0 fail** | 121 s (busy) |
| `npm test` | final code tree (inside `ci:build-job`, 2 cores) | 710 / 695 / 0 fail / 15 skipped | 249 s |
| `npm run test:golden-full` | `751c779` | **54 / 54** | 94 s (87 s inside node) |
| `tests/baseline-tools.test.js` | after `878321b` | 4 / 4 | 10 s |

Test count: 645 → 710 (+65: W0-A +29, W0-B +36; each brief asked for +25).

## 3. Golden pins

Every pin equals its value before the wave. **No pin was re-recorded.** The "After Wave 0" step that re-records `golden-defence.test.js` and the m02b row with the reason D1 found nothing to do: D1 was merged before W0-A recorded its pins, so the Defence values already include it, and W0-B's seams leave every hash unchanged. `d071360b` and the 13 mission checksums (`tests/wings.test.js`) hold; `grep -l d071360b tests/*.js` lists `tests/golden-skirmish.test.js` only.

Skirmish (`tests/golden-skirmish.test.js`), the computer on every side; 300 s, the end and save/reload run under `GOLDEN_FULL`:

| Setup | 60 s | 180 s | 300 s | End | Save at 180 s, reloaded, at 300 s |
|---|---|---|---|---|---|
| idle all-Meridian, 3 ways | `d071360b` | | | | |
| classic ×1 Normal | `fef65c4f` | `39426dbc` | `6d992886` | defeat 231 | same |
| highlands ×2 Relentless coalition | `807ca1eb` | `5450ac4a` | `45ab65f9` | defeat 181 | same |
| riverlands ×2 Fast | `30be65e6` | `d16fd4cd` | `3f77c63b` | running 300 | same |
| basin ×3 Fast | `853fdf6c` | `8422f5d9` | `db45b921` | defeat 246 | same |
| riverlands ×3 Normal, Sunward against mixed, capture points | `56c0461d` | `387ab7ee` | `42be5155` | running 300 | same |
| dunes ×1 Normal, Ashfall against Veil, capture points | `28775897` | `7fa3ba8f` | `4841198e` | running 300 | same |

Defence (`tests/golden-defence.test.js`), DefenceBot, Standard:

| Level | Result | Stars | Lives | Towers standing | Hash |
|---|---|---|---|---|---|
| d-gorge | victory | 3 | 20 | `r3mr3r3b3s1r3b3s1a3b2t3s1b1` | `3f391c5e` |
| d-bridges, demolishing | victory | 3 | 18 | `r3r3r3r3r3r3r3b1a3s1t1a2t1` | `d3c0f7a1` |
| d-crossroads (`GOLDEN_FULL`) | victory | 2 | 15 | `b3s3b3s3a3t3b3a3s3b3t3s1b3` | `c77144f6` |
| d-gorge Endless to wave 12 (`GOLDEN_FULL`) | held 12 | | 20 | | `5167e811` |

Story (`tests/golden-story.test.js`), 120 s, Standard: m01 `a740365c`, m03 `9d9693b6`, m06b `223ff814` (ObjectiveBot), ca1 `ab4e3941` (ObjectiveBot), m02b (DefenceBot) wave 4, 20 lives, `4c430aeb`.

## 4. Baselines (recorded once, on the merged tree)

Recorded into `docs/aaa/results/round2/baseline/` with `npm run baselines:diff -- --record --only <name>`, one at a time, `--jobs 3`, on the merged tree (`751c779`; the later `878321b` changed only the wall-clock cap the tool passes, and the game code at the tag is the same):

| Baseline | Command (`npm run baselines:diff -- --list`) | Rows | Record time | Check against the after-D1 tables (`.tmp/baselines/`, 2026-11-19) | `baselines:diff --full` |
|---|---|---:|---:|---|---|
| `missions-story.json` | `check:missions --json --difficulty story` | 30 | 351 s | identical, 30 of 30 rows (after the m12 row below) | identical |
| `missions-standard.json` | `--difficulty standard` | 45 | 316 s | identical, 45 of 45 | identical |
| `missions-veteran.json` | `--difficulty veteran` | 30 | 244 s | identical, 30 of 30 | identical (second run, alone; see below) |
| `missions-standard-mercy.json` | `--difficulty standard --decide mercy` | 45 | 403 s | (no earlier table) | identical |
| `missions-standard-firm.json` | `--difficulty standard --decide firm` | 45 | 355 s | (no earlier table); equals `missions-standard.json` row for row | identical |
| `chronicles.json` | `tools/chronicle-check.mjs --chronicle all --json` | 24 | 282 s | identical to the Standard Chronicle table, 24 of 24 | identical |
| `defence.json` | `check:defence --json` | 28 | 352 s | identical to `check-defence-after-D1.json`, 28 of 28 | identical |
| `bench-classic.json` | `bench:factions --jobs 3 --json` (120 matches) | 120 | 365 s | (no earlier JSON) | identical |

No row in any file misses a target (`misses` is empty everywhere) and no row is "did not finish".

**The m12 rows.** With the machine at 100%, the m12 objective run did not finish inside the tools' 240 s wall-clock cap in all five mission tables (a quiet machine plays the whole Standard table in about 132 s). A "did not finish" row is a wall-clock stop, not a result. Each was replaced by the same tool and arguments on m12 alone: Story and Standard finished within 240 s (234 s and 240 s), Veteran, mercy and firm with a 560 s cap. Every replaced row equals the after-D1 table: Story victory 777 s gold, Standard 772 s gold, Veteran 714 s gold (the plan expected Veteran m12 to time out; on the after-D1 run it finished, at 240 s for the whole table). Because every Wave 1 package runs `npm run baselines:diff` on this machine, `878321b` raised the cap that `baselines:diff` passes to 600 s, so those rows are played to the end (the cap is only a safety stop; a quiet machine never reaches it).

**`npm run baselines:diff -- --full`** (17:44 to 18:20, 2,148 s, while the CI matrices ran beside it): 7 of 8 identical; `missions-veteran` differed only in m12 objective, "did not finish" at the new 600 s cap. Run again alone (18:21, 327 s): identical. So all eight baselines reproduce; run `--full` alone, not beside the CI matrix, or pass `--timeout 900`.

### Objective bot, every mission (from the five mission baselines)

| Mission | Story | Standard | Veteran | Standard, mercy | Standard, firm |
|---|---|---|---|---|---|
| m01-first-light | victory 187 s gold | victory 187 s gold | victory 187 s gold | victory 187 s gold | victory 187 s gold |
| m02-first-contact | victory 327 s gold | victory 525 s gold | victory 494 s gold | victory 525 s gold | victory 525 s gold |
| m02b-hold-the-river | victory 179 s gold 3★ 18♥ | victory 239 s silver 2★ 14♥ | victory 285 s silver 2★ 12♥ | victory 239 s silver 2★ 14♥ | victory 239 s silver 2★ 14♥ |
| m03-the-ashen-line | victory 520 s gold | victory 604 s gold | victory 660 s gold | victory 607 s gold | victory 604 s gold |
| m04-three-way-dunes | victory 319 s gold | victory 434 s gold | victory 505 s gold | victory 434 s gold | victory 434 s gold |
| m05-the-verdant-pact | victory 503 s gold | victory 509 s gold | victory 499 s gold | victory 506 s gold | victory 509 s gold |
| m06-copper-harvest | victory 593 s gold | victory 655 s gold | victory 636 s gold | victory 655 s gold | victory 655 s gold |
| m06b-wings-over-copper | victory 507 s gold | victory 508 s gold | victory 508 s gold | victory 508 s gold | victory 508 s gold |
| m07-copper-siege | victory 660 s bronze | victory 660 s bronze | victory 660 s bronze | victory 660 s bronze | victory 660 s bronze |
| m07b-hold-the-valley | victory 163 s gold 3★ 20♥ | victory 287 s silver 2★ 12♥ | victory 321 s silver 2★ 15♥ | victory 287 s silver 2★ 12♥ | victory 287 s silver 2★ 12♥ |
| m08-the-quiet-vault | victory 457 s gold | victory 469 s gold | victory 494 s gold | victory 469 s gold | victory 469 s gold |
| m09-a-debt-in-the-dunes | victory 437 s gold | victory 511 s gold | victory 431 s gold | victory 511 s gold | victory 511 s gold |
| m10-obsidian-storm | victory 461 s gold | victory 537 s gold | victory 563 s gold | victory 479 s gold | victory 537 s gold |
| m11-cut-the-draw | victory 418 s gold | victory 502 s gold | victory 388 s gold | victory 502 s gold | victory 502 s gold |
| m12-frontiers-end | victory 777 s gold | victory 772 s gold | victory 714 s gold | victory 772 s gold | victory 772 s gold |

Mercy differs from the default on m03 (alloy returned: 607 s), m05 (pact shared: 506 s) and m10 (Veil spared: 479 s); firm equals the default everywhere. The passive and generic rows are in the JSON files.

### Chronicles, Standard

| Chronicle | Passive | ObjectiveBot |
|---|---|---|
| ca1-cold-berths | defeat 674 s | victory 308 s gold |
| ca2-lights-out | defeat 1260 s | victory 686 s gold |
| ca3-scrapyard-gorge | defeat 152 s 0★ 0♥ | victory 294 s 2★ 14♥ silver |
| cs1-dry-wells | defeat 269 s | victory 399 s gold |
| cs2-three-way-dunes | defeat 440 s | victory 522 s gold |
| cs3-verdant-road | defeat 293 s | victory 411 s gold |
| cw1-standing-orders | defeat 372 s | victory 435 s gold |
| cw2-a-grey-coat | defeat 416 s | victory 479 s gold |
| cw3-hold-the-river | defeat 216 s 0★ 0♥ | victory 426 s 2★ 10♥ silver |
| cv1-night-count | defeat 1200 s | victory 463 s gold |
| cv2-one-circuit | defeat 359 s | victory 420 s gold |
| cv3-inside-the-dampers | defeat 349 s | victory 574 s gold |

### Frontier Defence (`check:defence --json`, PASS)

| Level | Story bot | Standard bot | Veteran bot | Passive (S / St / V) | Endless |
|---|---|---|---|---|---|
| d-gorge | 3★ 20♥ | 3★ 20♥ | 3★ 18♥ | defeat w3 / w3 / w2 | held 40 (cap) |
| d-bridges | 3★ 20♥ | 2★ 16♥ | 2★ 10♥ | w4 / w4 / w3 | held 27 |
| d-switchback | 3★ 20♥ | 3★ 20♥ | 2★ 14♥ | w3 / w2 / w2 | held 40 (cap) |
| d-fordwood | 3★ 20♥ | 3★ 20♥ | 3★ 20♥ | w3 / w2 / w2 | held 40 (cap) |
| d-canyon | 3★ 20♥ | 3★ 20♥ | 3★ 20♥ | w3 / w3 / w2 | held 40 (cap) |
| d-longcrossing | 3★ 20♥ | 3★ 19♥ | 1★ 7♥ | w3 / w3 / w2 | held 40 (cap) |
| d-crossroads | 3★ 18♥ | 2★ 15♥ | 3★ 18♥ | w2 / w2 / w1 | held 40 (cap) |

Targets 3★ / 2★ / 1★ for the bot on Story / Standard / Veteran: all met. Every bot run is a victory; every passive run a defeat. The single-crew ("greedy") rows are in `defence.json` and equal the after-D1 run.

### Classic faction bench (`bench-classic.json`, 120 matches)

| Wins of the row against the column | meridian | ashfall | sunward | wardens | veil | All games |
|---|---|---|---|---|---|---|
| meridian | - | 8/12 | 10/12 | 5/12 | 10/12 | 69% |
| ashfall | 4/12 | - | 4/12 | 4/12 | 8/12 | 42% |
| sunward | 2/12 | 8/12 | - | 3/12 | 5/12 | 38% |
| wardens | 7/12 | 8/12 | 9/12 | - | 9/12 | 69% |
| veil | 2/12 | 4/12 | 7/12 | 3/12 | - | 33% |

Pair deviation 24; 2 of 10 pairs inside 35 to 65%. Median match 264 s; 4 matches reached the 1,800 s cap and were decided on strength; first seat 46 wins, second 74. This is the Classic reference for Wave 1 and later (row-identical, plan step 5).

## 5. Full suite (plan "Integration after each wave", step 5)

| Item | Result |
|---|---|
| `npx vite build` (visible output) | built, 44 s (chunk-size warning as before) |
| `npm test`, `npm run test:golden-full` | green (section 2) |
| `check:missions` Story, Standard, Veteran, Standard `--decide mercy`, `--decide firm` | recorded and compared as the baselines, one at a time (section 4): every target met, no "did not finish" after the m12 reruns |
| `tools/chronicle-check.mjs` | `chronicles.json`: every target met |
| `check:defence --json` | PASS, 28 rows identical to the after-D1 run |
| `test:render-budget` (port 4238, all 12 scenarios, asserting) | PASS, p95 draws identical to W0-A's base table (below), 0 stand-in airframes, `unloaded` empty in every scenario |
| `npm run baselines:diff -- --full` | all 8 identical (section 4) |
| `bench:factions` Classic | recorded (section 4); its `--full` re-run is identical |
| `CI_LOCAL_PORT=4238 CI_LOCAL_LANES=2 npm run test:ci-local -- --fast --no-unit` | **51 of 51 suites, 24 groups, passed first time**, 1,026 s (17:57 to 18:14) |
| `test:ci-local` slow (software rendering, CPU slowed 20×) | **Noise-limited, not a Wave 0 failure** (below): 17 of 51 passed, every failure a Playwright wait timeout; a base-against-merged A/B fails the same way on both builds |

**The slow matrix on a saturated machine.** The CI-like mode throttles each page's CPU 20× and renders with SwiftShader; with the machine at 100% from other sessions, pages often did not even finish loading in the suites' 20 to 30 s.

| Run | Result |
|---|---|
| 1: 3 lanes, 17:44, beside `baselines:diff --full` | Stopped by its PID after 15 suites (6 passed, 9 failed, all on `page.goto`, `page.reload`, `locator.click` or `waitForFunction` timeouts of 20 to 30 s), to free the machine for the fast run |
| 2: 2 lanes, `--no-build` on the same `dist/`, 18:27 to 19:11 (2,667 s) | **17 of 51 passed.** All 34 failures are wait timeouts: 27 on `page.goto`/`page.reload` (20 to 30 s), the rest on `locator.click`, `selectOption`, `waitFor` or `waitForFunction`. No assertion failed in any suite |
| A/B, slow mode, `browser`, `fullscreen`, `boss`, ABBA on port 4238: base build `4f951a6` against the merged build, same test files | base 2 of 6 passed, merged 4 of 6; the same timeouts on both builds (`browser` waits for `window.__frontier`, `fullscreen` and `boss` for `page.goto`) |

Suites that passed in slow mode at least once on the merged build (22 of 51): `interface/render-budget` (491 s), `interface/ui-quality`, `interface/ambient-life`, `golden-full`, `desktop/browser`, `mobile/*` (all 4), `training/tutorial`, `settings/improvements`, `settings/offline`, `story/audio`, `music`, `progression`, `maps/corners`, `maps/new-game`, `commands/auto-combat`, `commands/harvesters`, `commands/hotkeys`, `construction/mobile-construction`, `bosses/boss`. Wave 0 changes no UI or CSS; its client changes are the inert view-plugin hooks, one guarded `createSim` line and a test hook (+9.6 kB in the main bundle, 1.3%). Neither package ran the slow mode either (both used `--fast`). The slow matrix needs a quieter machine to be meaningful.

Render budget, p95 draw calls (base = W0-A's table at `4f951a6`):

| Scenario | Base | Wave 0 | Limit |
|---|---:|---:|---:|
| base-high | 141 | 141 | 160 |
| river-overview-high | 170 | 170 | 190 |
| large-map-high | 218 | 218 | 240 |
| battle-eco | 107 | 107 | 120 |
| three-rivals-eco | 146 | 146 | 150 |
| three-factions-eco | 182 | 182 | 185 |
| defence-wave-eco | 109 | 109 | 120 |
| air-battle-eco | 116 | 116 | 118 |
| boss-battle-eco | 116 | 116 | 120 |
| defence-river-eco | 132 | 132 | 135 |
| defence-carrier-eco | 139 | 139 | 142 |
| defence-big-eco | 106 | 106 | 112 |

Triangles, instanced draws and composes match W0-A's table too.

## 6. Timing gates (plan step 6; noise-limited)

### W0-B tick time: `node --expose-gc tools/perf-ab.mjs --scene riverlands-x2-300 --runs 7`

Base `4f951a6` (extracted by the tool) against the merged `src`, seven interleaved ABBA runs per side, median of the runs, ms per tick, 17:11 to 17:19 (the first run overlapped the last seconds of the bench recording). "AB" runs put the base first, "BA" runs the merged tree first; the A/A runs compare two copies of the base (the noise control; there the two value columns are the first and the second side). Both trees end in the same state (`3f77c63b`) in every run.

| Run | Order | Base mean | Merged mean | Merged against base, mean | p50 | p95 | p99 |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | AB | 0.423 | 0.460 | +8.7% | +4.2% | +0.2% | +44.6% |
| 2 | BA | 0.311 | 0.327 | +5.1% | +4.4% | +5.4% | -2.5% |
| 3 | AB | 0.355 | 0.356 | +0.3% | +4.1% | +2.5% | -3.4% |
| 4 | BA | 0.389 | 0.423 | +8.7% | +2.1% | +3.3% | +16.1% |
| 5 | AB | 0.326 | 0.332 | +2.0% | +3.2% | -0.9% | +5.6% |
| 6 | BA | 0.349 | 0.343 | -1.7% | -1.8% | -0.5% | -3.6% |
| 7 | AB | 0.310 | 0.312 | +0.9% | +2.5% | +0.9% | +1.7% |
| 8 | BA | 0.305 | 0.304 | -0.3% | -1.0% | -3.4% | -2.3% |
| **Median of 8** | | | | **+1.5%** | **+2.9%** | +0.6% | -0.3% |
| A/A control 1 | base, then copy | 0.298 | 0.299 | +0.3% | +0.2% | -1.4% | +2.1% |
| A/A control 2 | copy, then base | 0.312 | 0.338 | +8.1% | +4.1% | +9.6% | +10.1% |
| A/A control 3 | base, then copy | 0.303 | 0.331 | +9.3% | +8.7% | +6.0% | +2.0% |

Verdict: **within the +3% gate on the median (mean +1.5%, p50 +2.9%), but noise-limited**: two identical trees differed by up to +9.3% (mean) in the same session, the second side of a run tends to be slower, and the machine was at 35 to 100% CPU. The four pairs taken at lower load (runs 5 to 8) average +0.2% (mean) and +0.7% (p50). W0-B's own samples (+0.4%, -7.6%) and its reviewer's (-9.4%, -16.9%, A/A +13.9%) show the same noise. A quiet-machine re-run of the same command is still the formal gate.

### CI build job on 2 cores: `cmd //c "start /affinity 0x3 /wait /b npm run ci:build-job"`

| Step | Time |
|---|---:|
| `npm test` (710 tests, 0 fail) | 249 s |
| `npm run check:defence` (PASS) and `npm run build` (bundling 1.2 s) | 550 s together, so `check:defence` about 540 s |
| **Total** | **799 s (13 min 19 s)**, 17:19 to 17:32 |

CPU load sampled every 15 s during the run: median 94%, mean 87%, minimum 40%. Cores 0 and 1 were not reserved, so other sessions' processes ran on them too.

Verdict: **over the 7-minute rule (and the 10-minute GitHub cap) as measured, but noise-limited and not attributable to Wave 0.** Two thirds of the time is `check:defence`, whose code path and 28 rows are unchanged by this wave (the plan's figure for it is about 100 s on a quiet machine; it took 352 s on all cores when recording `defence.json` and 8 min 18 s in W0-A's busy run at the base). Wave 0's own share is in `npm test`: +65 tests, of which W0-A measured about +8 s net (its golden split saves about 6 s) and W0-B about +4 s at 33% load (about 16 s at 100%). A base-against-merged `npm test` pair on 2 cores was attempted at 17:35 and both sides exceeded a 290 s guard at 100% load, so no A/B number exists. The 2-core build-job time must be re-measured on a quiet machine before the CI cap can be judged. Also note: on a 2-vCPU runner `node --test` runs one file at a time, so the three golden files do not run in parallel there (W0-A reviewer).

## 7. Open issues

1. **Build job on 2 cores measured at 13 min 19 s** under 94% machine load (section 6). Needs a quiet-machine measure; if it is still over 7 minutes there, `check:defence` (not Wave 0) is the step to look at.
2. **Timing gate noise.** perf-ab median +1.5% (mean) / +2.9% (p50) passes, but the A/A control varied up to +9.3%. Re-run `node --expose-gc tools/perf-ab.mjs --a 4f951a6 --b src --scene riverlands-x2-300 --runs 7` on a quiet machine.
3. **Slow CI matrix** (software rendering, CPU 20×) not proven green: 17 of 51 on the saturated machine, every failure a load timeout, and the base build fails the same way (section 5). The fast matrix is 51 of 51. Re-run `CI_LOCAL_PORT=4238 CI_LOCAL_LANES=3 npm run test:ci-local` when the machine is quieter (before or with the Wave 1 integration).
4. **m12 near the wall-clock cap.** The tools' default 240 s cap stops m12 on a loaded machine (`check:missions` text runs too). `baselines:diff` now uses 600 s; `--full` beside the CI matrix still hit it once on Veteran. Run `--full` alone or with `--timeout 900`.
5. **Owner decision (from W0-B, not fixed):** building levels rebuild health from the type (`progression.js` `updateLevel`), the same bug class as D1. A player who levels the Basin relay in Copper Harvest (1,200) or Copper Siege (3,500), the refinery in Wings over Copper (2,000) or the Caravan beacon in A Debt in the Dunes (2,000) drops it to 562.5 at level 2. Fixing it changes campaign play.
6. Pre-existing duplicate key `"Next idle Harvester"` in `src/locales/vi.json` (same value twice, since `a9147d4`; not from this round).
7. SwiftShader held-clock screenshots of `air-battle-eco` and `boss-battle-eco` switch between two images (about 400 pixels, at most 3 levels) from run to run on the base build too; packages comparing screenshots should take two runs per side (W0-A).

## 8. Notes for Wave 1 (from the two reviews)

- The plan's contract name `registerStatus` does not exist: a status is declared in a content module's `statuses` field (read with `statusInfo`, `STATUSES`, `STATUS_IDS`). W1-B (`pinned`) and W1-E (`stunned`) declare theirs there (`docs/CONTENT_SEAMS.md`).
- `hitScale` and `onHit` also receive the shot's `tags`; only the shot's own target can tag it (a splash victim's tags are dropped).
- `rules` is saved once, in the save's options (`DERIVED` has `rules`).
- The `ability` event carries the ability data's `duration`, not one a module's `use()` returns; W1-C (ability flash) should read `e.buff.until` if it needs the real length.
- A Defence burst rank (`garrisonBurst`) overwrites the cooldown after H9, so a reload status stretches only the full reload after a burst.
- W1-A: `createSim`'s contract line passes `S.rules` to campaign and Defence matches too whenever it is set (only the test hook sets it today); the skirmish-only guard is W1-A's to add, together with the source-text assert in `tests/review-2026-10b-00.test.js`, which W1-A owns.
- W1-D: the tactics-view high-ground mark and a building's faction emblem do not follow a plugin's `frameScaleFor` / `scaleFor`.
- The view-plugin `event(ev, sim)` hook sees only what `WorldView.event` gets; interface events (`message`, `say`, `objective`, `incoming`, `drop` and others) go elsewhere (`src/app/frame.js`).
- The render-budget harness asserts no stand-in airframe and no undrawn entity (`unloaded`); a `rules` scenario restarts once with its rules to load the models they need; a `status` scenario now works (`sim.applyStatus` exists).
- Boss vitals bars follow a plugin's static `scaleFor`.
- `npm run baselines:diff` (fast set) takes about 8 to 11 minutes on the loaded machine (`defence` 150 to 350 s, `missions-standard` 300 s).
