# AAA round 3, Wave 1 integration (tag `r3-wave-1a`)

Integrator, port 4238, worktree `3d_astra-r3` on `feat/aaa-round3`, base `r3-base` (5fad815), 2026-11-21.
This is Wave 1 **a**: six of the eight Wave 1 packages. R3-L (building life) and R3-W (wings and rockets) were
still running and join later; the full wave tag `r3-wave-1` follows their merge.

## Merge log

Order: F, D, E, B, C, A, each `git merge --no-ff`, each followed by `npx vite build` with visible output
(every build clean, no warnings beyond the usual chunk-size note).

| # | Branch | Merge commit | Conflicts | Resolution |
|---|---|---|---|---|
| 1 | `r3/f-warm-kit` | ca8b2c5 | none | — |
| 2 | `r3/d-night-storm` | 627faf2 | `docs/CHANGELOG.md` | union; blank line before each `### R3-` heading |
| 3 | `r3/e-defence-onboarding` | e733ce0 | `pages.yml`, `CHANGELOG.md`, `package.json` | union; a missing comma after `test:night-storm` |
| 4 | `r3/b-squad-orders` | 5700090 | `pages.yml`, `CHANGELOG.md`, `package.json`, `landscape-hud.css`, `vi.json`, `view-plugins.js` | union; `landscape-hud.css` keeps E's Defence dock block then B's group-strip block; `view-plugins.js` imports and registers both `DefenceReadabilityView` and `FollowTetherView` (one entry each); two commas in `vi.json` (strings and patterns), one in `package.json` |
| 5 | `r3/c-army-depth` | 0d83518 | `pages.yml`, `CHANGELOG.md`, `package.json`, `vi.json`, `render-budget.mjs` | union (D's three scenarios and limits, then C's `battle-200`); one comma each in `vi.json` and `package.json` |
| 6 | `r3/a-field-ai` | e81ff31 | `pages.yml`, `CHANGELOG.md`, `package.json` | union; one comma in `package.json` |

`src/sim/ai.js` (A everywhere but line 74, C line 74) merged without conflict: the pop-cap line reads
`pop.cap < this.maxPop()` and A's census inserts are intact. `balance.json` (A's `ai_mix`), `manifest.json`,
`story-vi.json`, `sim/content/index.js`, `rule-options.js` and `debug-hooks.js` auto-merged.

After every merge each JSON file parsed and was scanned for duplicate keys. The one duplicate,
`"Next idle Harvester"` in `vi.json` (twice, same value), is already in `r3-base`; left as it is.

## Integration fixes (one commit each)

| Commit | Fix |
|---|---|
| 51e7744 | `tests/defence-onboarding.test.js`: `DefenceReadabilityView` is checked with `VIEW_PLUGINS.includes(...)` (R3-B's `FollowTetherView` now comes after it), as R3-E's results asked. |
| 9d6e880 | R3-C seam: the building card's command hint is `veteranNote(S.sim, e)` (`src/app/hud.js`, import from `src/sim/content/barracks-veterans.js`): "Recruits arrive as veterans" / "Level 3: recruits arrive as veterans" on an Expanded Barracks, "" elsewhere (Classic unchanged). |
| ecb9980 | R3-C seam: `src/app/defence/sheets.js` adds `${lead?.combined ? "+c" : ""}` to the squad key in `sheet()` and to `armourSheet`'s `data-key`. R3-C's manual redraw in `input.js` was left in place (harmless). |
| 7c7a177 | R3-B note: `.compact-ui:not(.in-briefing) #touch-sheet > #clear-selection { flex: none; }` in `landscape-hud.css`, beating `ui-theme.css:484`'s tool-row `flex: 1 1 0`. Measured on the built game: the sheet's Clear selection row is **202 × 44 px** in portrait (was 20 px tall) and in landscape. |
| 1714a2e | R3-E seam: `S.defenceGuideHold`. `guide.js` sets it while the guide is at step 1 or 2 and no wave has been called, and clears it on skip, finish or stop; `frame.js` adds `&& !S.defenceGuideHold` to `running` (the same hold `S.testHold` uses, so the whole match clock waits, not just the countdown; before the first wave nothing else moves). Probe on the built game: sim time advanced **0 s** in 3 s at step 1, and **3 s** in 3 s after Skip. Calling a wave during step 1 releases the hold. The guide stays off under `?test` unless `?guide`. |
| d085d3c | R3-D owner note: `LOOKS.night.ambientI` 0.7 → **0.85**. |
| 7f18f55 | R3-D note: the storm's sky and fog colour follow `k ** skyGather` (new optional look key, `storm.skyGather: 0.25`), the light still follows `k`. m06 at 0:30 (k 0.48): sky `#2b1b29` → **`#1a1823`** (blue now the largest channel). m10 (k = 1) is unchanged (`#0d1620`). View only. |
| 8d4aaee | R3-A seam: `tools/perf-ab.mjs` scene `riverlands-x2-field-300` (riverlands, 2 rivals, Fast, 300 s, `aiPlayer`, rules `{ roster: "expanded", aiPlan: "field" }`). |

| 83848d4 | Owner decision: no group-control buttons on phones (below). |
| 318eee8 | Tests only, slow-runner timing in the CI-like lanes (below). |

### Owner decision (2026-11-21): no group-control buttons on phones

Commit 83848d4 removes R3-B's phone group strip. On the compact UI the strip is hidden again, as on `r3-base`:
no smart chips (All army, Fighters, Support), no "+ Group N", no saved-group chips in the "…" sheet and no
hold-to-assign. `src/app/selection.js` and `src/mobile.css` are back to `r3-base` (R3-B's changes there were
only the phone strip); the sheet-strip rules left `landscape-hud.css`; the five strings and two patterns
left `vi.json`. Kept: group pace, formation, support trailing, the follow tether and pip, the "Following"
card line, the Group pace setting, the high-ground hint, the PC console tabs and the Ctrl/number hotkeys.
Tests: `tests/squad-orders.mjs` now checks that phones show no strip (not in the sheet, zero size, no chips)
and that the dock keeps its height (portrait 214 px, landscape 236 px); `tests/squad-orders.test.js` checks
the Vietnamese of "Group pace" and "Following …" only. `tests/layout-f.mjs` needs no `.group-strip`
exemption (the strip is hidden on touch). CHANGELOG and TESTING.md say so. Full-speed suites after the
change: squad-orders, phones, hotkeys, selection, status-layout all pass.

R3-F's `tests/stalker.test.js:288` change is confirmed: the manifest's Stalker entry reads
`"pending owner review (round 3)"` and the test expects that string.

### Night and storm re-shoot (1440×900, High, campaign started for real, clock held at 0:30, map revealed)

Screenshots in [`wave-1/`](wave-1/).

| Scene | Frame R, G, B | R − B | Luminance | Sky | Gate |
|---|---|---|---|---|---|
| m08 night, R3-D (ambient 0.7) | 5.5, 13.8, 45.0 | −39.5 | 5.6% | `#030818` | |
| m08 night, merged (ambient 0.85) | 6.8, 15.2, 47.0 | **−40.1** | **6.2%** | `#030818` | R − B < 0, luminance < 15%: pass |
| m06 storm, k 0.48 | 77.6, 75.4, 47.4 | +30.2 (ground) | 29.0% | `#1a1823` (was `#2b1b29`) | |
| m10 storm, k 1 | 32.6, 36.7, 33.7 | −1.1 | 14.0% | `#0d1620` (unchanged) | |

m08 draws 227. The night lift is modest (luminance 5.6% → 6.2%); if the owner still finds it dark, 1.0 keeps a
wide margin under 15%.

## Tests on the merged tree

| Check | Result |
|---|---|
| `npm test` | **1006 tests: 979 pass, 27 skipped, 0 fail** (65 s). Base was 961; the packages added +45. |
| `npm run test:golden-full` | **87/87 pass** (25 s) |
| `npm run baselines:diff -- --full` | **all 8 identical**: missions story 115 s, standard 105 s, veteran 168 s (m12 finished inside 600 s; no re-run needed), standard-mercy 101 s, standard-firm 116 s, chronicles 36 s, defence 65 s, bench-classic 103 s |
| `npm run check:defence` | **PASS** (62 s) |
| `tests/render-budget.mjs` (TEST_URL 4238, all 24 scenarios) | **exit 0** (table below) |
| `tests/defence-onboarding.mjs` (after fix 1714a2e) | PASS (3 viewports, 31.6 s) |
| `test:ci-local` (CI_LOCAL_PORT 4238, 2 lanes, slow CPU) | see below |

### Pins

`d071360b` and the 14 mission checksums are unchanged (they run in `npm test`). Against `r3-base`, only these
pin lines changed in `tests/golden-*.test.js`:

| Pin | Old | Merged tree | Declared by | Holds |
|---|---|---|---|---|
| `golden-w2d` 180 s | 80fb27d8 | a72ac3ba | R3-A | yes (`npm test`) |
| `golden-w2d` 600 s (GOLDEN_FULL) | 549eb7a3 | 8cc05d90 | R3-A | yes (`golden-full`) |
| `golden-round2` arena 300 (GOLDEN_FULL) | 4cce2935 | e4913c66 | R3-A | yes (`golden-full`) |
| `golden-r3c` (new file): veterans 60/90, combined 120, pop150 180, pop200 60/150 | — | 803cfa1c / feecd5f4, 3002bfed, 04c72406, ffd27339 / 8fd584f3 | R3-C (new content) | yes |

No other pin moved; nothing was re-recorded by the integrator.

### Render budget (merged tree, RTX 4080, median)

| Scenario | Draws | Limit | Main / shadow | Triangles | Uploads |
|---|---|---|---|---|---|
| base-high | 139 | 160 | 78/61 | 117k | 0 |
| river-overview-high | 168 | 190 | 95/73 | 204k | 0 |
| large-map-high | 216 | 240 | 119/97 | 375k | 0 |
| battle-eco | 106 | 120 | 106/0 | 283k | 0 |
| three-rivals-eco | 145 | 150 | 145/0 | 303k | 0 |
| three-factions-eco | 181 | 185 | 181/0 | 281k | 0 |
| defence-wave-eco | 110 | 120 | 110/0 | 510k | 0 |
| air-battle-eco | 115 | 118 | 115/0 | 293k | 0 |
| boss-battle-eco | 115 | 120 | 115/0 | 286k | 0 |
| defence-river-eco | 125 | 135 | 125/0 | 505k | 0 |
| defence-carrier-eco | 130 | 142 | 130/0 | 363k | 0 |
| defence-big-eco | 92 | 112 | 92/0 | 167k | 0 |
| gunner-battle-eco | 116 | 125 | 116/0 | 275k | 0 |
| stalker-battle-eco | 120 | 125 | 120/0 | 316k | 0 |
| boss-sovereign-eco | 112 | 120 | 112/0 | 285k | 0 |
| defence-boss-eco | 117 | 125 | 117/0 | 307k | 0 |
| battle-expanded-eco | 113 | 125 | 113/0 | 291k | 0 |
| battle-expanded-full-eco | 148 | 150 | 148/0 | 372k | 0 |
| defence-heroic-eco | 115 | 125 | 115/0 | 197k | 0 |
| night-battle-eco | 108 | 120 | 108/0 | 283k | 0 |
| night-base-high (R3-D) | 141 | 166 | 80/61 | 117k | 0 |
| storm-base-high (R3-D) | 141 | 166 | 80/61 | 117k | 0 |
| storm-battle-eco (R3-D) | 107 | 126 | 107/0 | 283k | 0 |
| battle-200 (R3-C) | 246 | 260 | 134/112 | 1.80 M | 0 |

### perf-ab, Field + Expanded (indicative, shared machine, 3 runs)

`riverlands-x2-field-300`, `r3-base` against the merged `src`: mean 0.228 → 0.231 ms/tick (+1.1%), p95 +2.9%.
The final states differ, as expected (R3-A changes how the Field plan plays). The quiet-machine gate run is
still to do (with no agent running).

### test:ci-local (CI_LOCAL_PORT 4238, CI_LOCAL_LANES 2, software rendering, CPU slowed 20x)

Groups: r3-a, r3-b, r3-c, r3-d, r3-e, r2-w1d (phones), layout-desktop, layout-mobile, interface (ui-quality,
ambient-life), defence, r2-w1f (defence-deck), r2-w2b (defence-heroic), commands (hotkeys, selection, ...),
status-layout, visuals-world. Final state: **every suite PASS**.

| Group / suite | Final | Notes |
|---|---|---|
| r3-a ai-census-check | PASS (68 s) | |
| r3-b squad-orders | PASS (180 s) | after the owner-decision commit |
| r3-c army-depth | PASS (336 s) | failed twice on slow-runner timing first (page load > 30 s, a Defence level tap blocked > 30 s); fixed in the test (318eee8) |
| r3-d night-storm | PASS (224 s) | |
| r3-e defence-onboarding | PASS (321 s) | same timing pattern as army-depth, plus its start wait 60 s → 180 s (318eee8) |
| r2-w1d phones | PASS (311 s) | failed twice at 57.0% < 60% (portrait campaign, one unit): m01's 0:03 radio line opened between the two samples on the slow clock. The test now lets it close and holds the clock (318eee8) |
| layout-desktop / layout-mobile layout-f | PASS (417 s / 530 s) | layout-mobile re-run after the owner decision |
| interface ui-quality, ambient-life | PASS (251 s, 107 s) | re-run after the owner decision |
| defence defence, defence-zones | PASS (786 s, 470 s) | defence passed in run 1 (450 s); one later run timed out at `defence.mjs:241` (the commander's move order, 20 s step wait, 706 s run on a loaded machine) and passed again unchanged on the next run. Left as is; watch it in CI |
| r2-w1f defence-deck | PASS (495 s) | failed once in run 1 (Shift+Space read ×1 on a loaded machine), passed on the re-run unchanged |
| r2-w2b defence-heroic, -check | PASS (335 s, 10 s) | |
| commands auto-combat, harvesters, hotkeys, pc-controls, selection | PASS | hotkeys and selection timed out at page load in run 1 (machine load), passed on the re-run |
| status-layout | PASS (496 s) | also PASS at full speed after the owner decision |
| visuals-world factions, terrain | PASS (333 s, 215 s) | |

The CI-only failures were all slow-runner timing; only tests changed (at most three corrections on one
suite, under the four-correction limit).

## Open items

1. R3-L and R3-W merge next, then the full `r3-wave-1` tag.
2. Owner: the night ambient (0.85) and the storm sky are one-number changes if the owner wants more or less.
3. Quiet-machine timing gates (`perf-ab` median of 7, `ci:build-job` on 2 cores) were not run: other agents
   (R3-L, R3-W) were working on the machine.
4. R3-C's relay and field-guide "capped at 100" texts left as they are (true at the default army size).
5. R3-A: Sunward and Wardens have no workshop unit (owner decision).
6. `vi.json` has a duplicate `"Next idle Harvester"` key from before round 3 (same value; harmless).
7. `tests/defence.mjs:241` (commander move after a ground tap, 20 s wait) timed out once under CI-like load and
   passed on the re-run; if CI shows it again, give that wait `TIMEOUT.models`.
8. R3-B's results file (`b.md`) still describes the phone group strip; the owner decision above supersedes it.
9. Seam requests for later packages (R3-J Drone/Walker/Ranger, R3-K gold trim, R3-U storm SFX via `WEATHER.flash`,
   R3-G m08 opening) are in the package results files.
