# AAA round 3, Wave 1 integration (tags `r3-wave-1a`, `r3-wave-1`)

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

# Wave 1b: R3-W, the difficulty guard, R3-L (tag `r3-wave-1`)

Integrator, port 4238, same worktree and branch, from `r3-wave-1a` (d70e36a), 2026-11-21. Three steps, each verified
before the next.

## Step 1: merge `r3/w-wings-rockets` (ea95ae1)

| Conflicts | Resolution |
|---|---|
| `CHANGELOG.md`, `vi.json`, `view-plugins.js`, `render-budget.mjs` | union; one comma in `vi.json`; `view-plugins.js` registers `DefenceReadabilityView`, `FollowTetherView`, `AirLifeView`; render-budget keeps D's and C's scenarios and limits, then W's `air-battle` |

- **Seam W1 not applied** (owner: the computer's air limit is unchanged). Beyond that, W's `sim.airCap` gave a Field
  AI 4/6/8 for orders; in the merge it returns `AIR.cap` (4) for every computer team, and `aiAirCap` /
  `air.ai_cap_by_level` were removed (the AI's armed-flyer cap stays `AIR.ai_cap` 2). The player keeps 4/6/8. The
  field guide now reads "You field at most 4 / 6 / 8 ...; computer opponents field at most 4" (vi pattern updated);
  `r3w-wings-rockets.test.js` checks the computer cap under the Field plan.
- `npx vite build` clean. `npm test` 1013 (986 pass, 27 skipped, 0 fail; +7). `baselines:diff` fast set
  (missions-standard, defence) identical.
- **W's note "render-budget noGrowth fails on base too" (battle-eco [73, 101, 101])**: not reproduced on the integrated
  tree. battle-eco reads [97, 101, 101], air-battle-eco [106, 110, 110], air-battle [114, 118, 118] (+4, 6 allowed),
  and the full 26-scenario run after Step 3 passed too. The 73 means fewer batches existed before the first restart in
  W's run (the staged scene was drawn before every part kind was built); no scenario grew from one restart to the
  next, so it is not a leak. No harness change; if it shows again, the first number is the one to look at.

## Step 2: difficulty guard (69bf5dd; 6b9d61b after Step 3)

See [`difficulty.md`](difficulty.md). Kept: the census (variety), the workshop floor and census save, join-fight, Kite
scouting and the S7 stall breaker, all from 480 s (300 s at first; moved after the south exits). Removed: `FIELD_PACE`
(more Harvesters, later tech, the Fast tech softening) and the "no ring while an enemy army is in sight" rule. None of
R3-A runs at Relaxed. New tool `npm run check:difficulty` (`tools/difficulty-check.mjs`, TESTING.md).

| Field + Expanded, bot wins of 12 | r3-base | Step 2 | Merged tree (final) |
|---|---|---|---|
| 1v1 Relaxed / Normal / Fast / Relentless | 12 / 12 / 12 / 9 | 12 / 12 / 12 / 9 | 12 / 12 / 12 / 10 |
| 1v2 Relaxed / Normal / Fast / Relentless | 7 / 2 / 7 / 3 | 7 / 2 / 9 / 3 | 10 / 10 / **3** / 4 |

| Classic AI, bot wins of 12 | r3-base | Step 2 | Merged tree (final) |
|---|---|---|---|
| 1v1 Relaxed / Normal / Fast / Relentless | 11 / 11 / 11 / 10 | identical | 12 / 12 / 11 / 11 |
| 1v2 Relaxed / Normal / Fast / Relentless | 4 / 1 / 2 / 2 | identical | 7 / 2 / 1 / 1 |

Step 2 held the gate everywhere (Relaxed identical match by match). After the south exits, **Field 1v2 Fast fails
(7 to 3)**; Classic 1v2 Fast and Relentless lose one match each (inside the margin). The 6-map check in
`difficulty.md` shows the cause is the south exits themselves (Classic 1v2 Fast 7 to 3 of 24; Field 15 to 10 with no
round-3 Field code), while Normal and Relentless against two rivals got easier. Owner decision needed (open item 1).
`ai-census-check` on the final tree: 10 of 10 (types 7/8/8/5/8; workshop units 2/2/1 where they exist; Highlands 5/5).

## Step 3: merge `r3/l-building-life` (8d4947c), owner: keep the south exits

| Conflicts | Resolution |
|---|---|
| `CHANGELOG.md`, `view-plugins.js`, `render-budget.mjs` | union; `BuildingDecalsView` registered last; `building-life-eco` and its limit after D, C, W |
| `golden-round2.test.js`, `golden-w2d.test.js` | kept ours, then re-recorded on the merged tree |

**Seam fix (R3-C x R3-L):** `barracks-veterans.js` `onExitRing` replayed the old exit angles, so after the south exits
no recruit was ever made a veteran (`golden-r3c` "veterans trained" failed). It now walks `EXIT_ORDER` as `exitPoint`
does.

### Pins: re-recorded once on the merged tree, reason "south exits (owner) + difficulty guard"; old = `r3-wave-1a`

`d071360b` and the 14 mission checksums did not move. 42 stored pins moved (12 derived save/reload points follow
them); the other 34 points hold, `golden-r3c` combined 120 among them. Only `golden-w2d` 600 moved again when the
census start went from 300 to 480 s (6b9d61b, 6566da25 to 440a467c).

| Pin | Old | New |
|---|---|---|
| expanded meridian 300 / 600 | 51312236 / ff066aef | 6036d277 / 5ec489b1 |
| expanded veil 300 / 500 | 94bdc14d / 5f895c63 | af50d623 / 4f437973 |
| r3c veterans 60 / 90 | 803cfa1c / feecd5f4 | 6b3b906b / 168d7c59 |
| r3c pop150 180 | 04c72406 | c59995f7 |
| r3c pop200 60 / 150 | ffd27339 / 8fd584f3 | 0a796b75 / 43031352 |
| round2 arena 300 | e4913c66 | f94f7658 |
| classic x1 normal 60 / 180 / 300 / end | fef65c4f / 39426dbc / 6d992886 / defeat 231 | baf36c17 / 8095a061 / f117790c / victory 211 |
| content-seams classic 180 copy | 39426dbc | 8095a061 |
| highlands x2 relentless coalition 60 / 180 / 300 / end | 807ca1eb / 6bada781 / 6bada781 / defeat 167 | 0aaa724a / b20629ec / 85a06f36 / running 300 |
| riverlands x2 fast 60 / 180 / 300 | 30be65e6 / d16fd4cd / 3f77c63b | 5948dbf7 / a80c9e11 / 7f9a6072 |
| basin x3 fast 60 / 180 / 300 / end | 853fdf6c / 8422f5d9 / db45b921 / defeat 246 | abede88b / 4f8a69db / 8a63c4a4 / running 300 |
| riverlands x3 normal, Sunward 60 / 180 / 300 / end | 56c0461d / 387ab7ee / 42be5155 / running 300 | 498523ba / 51d0e53f / 51d0e53f / defeat 154 |
| dunes x1 normal, Ashfall against Veil 60 / 180 / 300 | af9fa074 / baac3a09 / 82f0f29c | fbdd5fcc / b36a3f1e / 82d11644 |
| story m01 / m03 / m06b / ca1 | a740365c / 9d9693b6 / 223ff814 / ab4e3941 | 03e8cb2b / 59c479c0 / 56d5c731 / c9716b32 |
| w1a wardens expanded 60 / 180 / 600 / 800 | b7a68cbf / 4b5a50ae / 69b78cbe / 69b78cbe | 7333a2e4 / 9f2229f3 / e4c0f4c3 / e4c0f4c3 |
| w2d field 180 / 600 | a72ac3ba / 8cc05d90 | 706784b9 / 440a467c |

### Mission results that changed against the `r3-base` baselines (not retuned: R3-I, Wave 2)

`check:missions` with `--jobs 3`, one difficulty at a time, 600 s wall clock.

| Table | Mission (objective bot) | Before | After |
|---|---|---|---|
| Standard | m02 First Contact | victory 525 s gold | victory 557 s **silver** |
| Standard | **m03 The Ashen Line** | victory 604 s gold | **running at 1260 s (not won)** |
| Standard | **m12 Frontier's End** | victory 772 s gold | **defeat 914 s** |
| Veteran | m03 The Ashen Line | victory 660 s gold | victory 1561 s **bronze** |
| Veteran | **m04 Three-Way Dunes** | victory 498 s gold | **defeat 881 s** |
| Veteran | m05 The Verdant Pact | victory 697 s silver | victory 443 s **gold** |
| Standard mercy | m02 / m03 / m05 / m12 | gold / gold / gold / gold | silver / running / silver / defeat |
| Standard firm | m02 / m03 / m12 | gold / gold / gold | silver / running / defeat |
| Story | none: every mission still won with the same medal | | |

m12 Veteran finished inside the 600 s wall clock (victory 672 s, gold), so no long re-run was needed. Every other row
keeps its result and medal; times and losses moved.

### Baselines

Re-recorded (63b5c96): `chronicles` (all 12 still won; ca2 gold to bronze, cw2 bronze to gold; times and losses
moved), `bench-classic` (the 120 AI-against-AI matches reshuffled by the exits), `defence` (identical, file
unchanged). **Not re-recorded, left failing on purpose for R3-I:** `missions-story`, `missions-standard`,
`missions-veteran`, `missions-standard-mercy`, `missions-standard-firm`. Rows that differ in result or medal are in
the table above; the other differing rows are times, losses, waves and objective letters only (the story table:
m01 passive, m02 to m07, m09 to m12 objective runs; every mission still won).

### Other checks on the merged tree

| Check | Result |
|---|---|
| `npm test` | 1024 tests: 997 pass, 27 skipped, 0 fail (1006 at `r3-wave-1a`; +7 W, +11 L) |
| `npm run test:golden-full` | 87/87 |
| `npm run check:defence` | PASS (66 s) |
| `tests/render-budget.mjs`, all 26 scenarios | exit 0 (table below) |

Render budget (RTX 4080, median; the four new or changed rows in bold):

| Scenario | Draws / limit | Main / shadow | Triangles | Uploads |
|---|---|---|---|---|
| base-high | 140 / 160 | 79/61 | 118k | 0 |
| river-overview-high | 169 / 190 | 96/73 | 204k | 0 |
| large-map-high | 217 / 240 | 120/97 | 376k | 0 |
| battle-eco | 107 / 120 | 107/0 | 284k | 0 |
| three-rivals-eco | 146 / 150 | 146/0 | 303k | 0 |
| three-factions-eco | 182 / 185 | 182/0 | 282k | 0 |
| defence-wave-eco | 111 / 120 | 111/0 | 511k | 0 |
| **air-battle-eco** | **117 / 118** | 117/0 | 294k | 0 |
| boss-battle-eco | 116 / 120 | 116/0 | 286k | 0 |
| defence-river-eco | 126 / 135 | 126/0 | 506k | 0 |
| defence-carrier-eco | 131 / 142 | 131/0 | 363k | 0 |
| defence-big-eco | 93 / 112 | 93/0 | 168k | 0 |
| gunner-battle-eco | 117 / 125 | 117/0 | 276k | 0 |
| stalker-battle-eco | 121 / 125 | 121/0 | 317k | 0 |
| boss-sovereign-eco | 113 / 120 | 113/0 | 286k | 0 |
| defence-boss-eco | 118 / 125 | 118/0 | 308k | 0 |
| battle-expanded-eco | 114 / 125 | 114/0 | 291k | 0 |
| battle-expanded-full-eco | 149 / 150 | 149/0 | 372k | 0 |
| defence-heroic-eco | 116 / 125 | 116/0 | 197k | 0 |
| night-battle-eco | 109 / 120 | 109/0 | 284k | 0 |
| night-base-high | 142 / 166 | 81/61 | 118k | 0 |
| storm-base-high | 142 / 166 | 81/61 | 118k | 0 |
| storm-battle-eco | 108 / 126 | 108/0 | 284k | 0 |
| battle-200 | 247 / 260 | 135/112 | 1.80 M | 0 |
| **air-battle (R3-W)** | **126 / 135** | 126/0 | 304k | 0 |
| **building-life-eco (R3-L)** | **97 / 110** | 97/0 | 78k | 0 |

Every Eco scenario gained 1 draw from L's decals (W adds 1 only with flyers). `air-battle-eco` (117 of 118) and
`battle-expanded-full-eco` (149 of 150) are one draw under their limits: the next package that adds a draw there must
raise the limit or save one.

### test:ci-local (CI_LOCAL_PORT 4238, CI_LOCAL_LANES 2, software rendering, CPU slowed 20x, `--no-unit`)

Groups: r3-a, r3-b, r3-c, r3-d, r3-e, air, visuals, visuals-world, interface, interface-budget, commands,
construction, story. W and L added no CI matrix entry of their own; air, visuals, interface-budget (W) and commands,
construction, visuals-world, story (L: exits, rally, missions) are the groups their files reach. Final state:
**every suite PASS**.

| Group / suite | Final | Notes |
|---|---|---|
| r3-a ai-census-check | PASS (40 s) | |
| r3-b squad-orders | PASS (137 s) | |
| r3-c army-depth | PASS (280 s) | |
| r3-d night-storm | PASS (280 s) | |
| r3-e defence-onboarding | PASS (417 s) | |
| air | PASS (285 s) | |
| visuals visual-combat, feel, portraits | PASS (244 s, 54 s, 155 s) | |
| visuals model-loading | PASS (88 s) | failed once ("offline aircraft": the Kite's view object not yet built after a 13 s step on the slowed page); passed unchanged on the re-run and at full speed |
| visuals-world factions, terrain | PASS (413 s, 244 s) | |
| interface ui-quality, ambient-life | PASS (224 s, 246 s) | |
| interface-budget render-budget | PASS (1031 s) | |
| commands auto-combat, harvesters, hotkeys, pc-controls, selection | PASS | |
| construction mobile-construction, patrol, repair-rally | PASS | |
| story missions, tactics-ui | PASS (865 s, 442 s) | missions failed twice on slow-runner timing (a tap, then a page load over 20 s), tactics-ui once (page load); test-only fix: their `TIMEOUT` is 60 s when `SLOW_CPU` is set (commit below) |

## Open items (Wave 1b)

1. **Owner: south exits make Fast against two rivals harder.** The difficulty gate fails in one cell: Field 1v2 Fast
   7 to 3 of 12 (6-map check: Classic 7 to 3, Field 15 to 10 of 24, both from the exits; Normal and Relentless
   against two got easier). The Field AI cannot take it back: the deciding fight is around 90 s, before any round-3
   Field code runs. Choose: keep as is, or a Fast-only easing in Wave 2 (for example a later first wave at Fast, or
   exits toward the base's own side for computer teams; "player-only exits" was tried and was not better).
2. **R3-I (Wave 2):** the five missions tables in `baselines:diff` are left failing on purpose: m03 and m12 Standard are
   not won by the objective bot, m04 Veteran is a defeat, m02 Standard and m05 mercy drop to silver.
3. `air-battle-eco` is at 117 of 118 draws and `battle-expanded-full-eco` at 149 of 150.
4. R3-A's results file (`a.md`) still describes `FIELD_PACE` and the in-sight rule; `difficulty.md` supersedes it.
   R3-W's `w.md` still describes the Field AI's larger air cap and seam W1; not applied (owner).
5. Quiet-machine timing gates (`perf-ab`, `ci:build-job` on 2 cores) still not run: other agents were working.
6. The 12-match cells of `check:difficulty` swing by several wins on small changes (a knife-edge early fight decides
   a whole map row). For Wave 2 and later, use the 6-map form (`--maps classic,riverlands,dunes,basin,expanse,highlands`)
   for any change that touches the opening.
