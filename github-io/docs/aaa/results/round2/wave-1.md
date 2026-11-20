# Wave 1 integration: results

Integrator, 2026-11-20. Integration worktree `3d_astra-zones`, branch `feat/aaa-round2`, base tag `r2-wave-0` (`dfc3d1a` deployed). Port 4238. Tag `r2-wave-1` (local, annotated). Nothing was pushed, deployed or dispatched. No separate reviewer ran, so the integrator also reviewed each diff (section 5).

## 1. What merged

Merge order from the plan: W1-B, W1-C, W1-E, W1-A, W1-F, W1-D. All six merged with `--no-ff`; none was reverted.

| Package | Branch | Test count (engineer) | Merge |
|---|---|---|---|
| W1-B Gunner team | `r2/w1b-gunner` | +17 | first merge, no conflicts |
| W1-C Stalker and ability-UI data | `r2/w1c-stalker` | +25 | append-only conflicts, both sides kept |
| W1-E Boss engine II, Iron Sovereign | `r2/w1e-boss-engine` | +15 | append-only conflicts |
| W1-A Roster and workshops | `r2/w1a-roster` | +17 | append-only conflicts (+ `package.json` comma fixed by hand) |
| W1-F Defence command deck | `r2/w1f-defence-deck` | +20 | append-only conflicts |
| W1-D Phones first-class | `r2/w1d-phones` | | append-only conflicts (`view-plugins.js`, `package.json`, `pages.yml`, `vi.json`, CHANGELOG) |

Conflict checks: every JSON file parses; `balance.json`, `story-vi.json`, `manifest.json`, `visual-style.json`, `package.json` have no duplicate keys (`vi.json` keeps the one old duplicate `"Next idle Harvester"`). `src/sim/content/index.js` has one entry per package (suppression, marksman, bossStatus, workshops, towerAim); `src/view-plugins.js` has StatusView and ArmyReadabilityView; `pages.yml` has `r2-w1a`, `r2-w1b`, `r2-w1d`, `r2-w1e`, `r2-w1f` (W1-C added no browser suite). A key-by-key comparison of `balance.json` against `r2-wave-0` finds **no changed existing value**: only new `workshops`, the definitions `gunner`, `stalker`, `ironsovereign`, `workshop` and the boss `iron-sovereign`.

## 2. Commits by the integrator (after the merges)

| Commit | What |
|---|---|
| content-seams fix | "module checks" compares with the registered statuses and abilities (W1-C's patch) |
| Gunner order 12 | Crossfire `order: 12`; Steady aim is 13; built-ins use 0 to 11, so the tile orders are unique |
| field guide | `src/field-guide.js` lists `roster: "expanded"` definitions only while the Roster rule is Expanded (the list is rebuilt on open) |
| Continue | `match-flow.js`: `S.rules = loaded.rules ? { ...loaded.rules } : null;` after `S.sim = loaded;` |
| workshops.test | Meridian's workshop units are now `["gunner", "fxmeridian"]` (the fixture unit plus the real Gunner) |
| render-budget | restart allowance 6 -> 10 for scenarios that spawn `gunner`, `stalker` or `workshop`; Defence `field.units === wave + (boss ? 1 : 0)`; existing limits unchanged |
| golden-expanded | new `tests/golden-expanded.test.js` (section 4) |
| workshops.mjs | the Field workshop card trains and queues the real Gunner (no more stand-in) |
| defence-deck.mjs | the 28 px rule is recorded on both phones, floor 20 px (section 6) |
| boss bar | `boss-ui.css`: portrait phone bar sits above `--band` plus the dialogue chip (it overlapped W1-D's dialogue); `boss.mjs` waits for the throttled HUD refresh |
| suites vs W1-D/W1-F | `missions.mjs`, `language.mjs`, `ui-extras.mjs`, `harvesters.mjs`, `air.mjs`, `patrol.mjs`, `sovereign.mjs` follow the new phone UI (dialogue chip taps; Info & stats in the "..." sheet; idle chips hide while a unit is selected; the real Defence bar already sets `--defence-bar-h`) |
| CSS | `landscape-hud.css`: 320 px unit-card stats gap (2 px overflow) and `--dock-line` 22 px for the Hidden-from-below / anti-air line (terrain suite) |
| CI | `pages.yml`: `interface-budget` and `ui-extras-messages` split out (section 7) |
| baseline | `baseline/bench-expanded.json` |

## 3. Tests

| Run | Result |
|---|---|
| `npm test` (final tree) | 816 tests, 798 pass, 18 skipped (`GOLDEN_FULL` pins), 0 fail, 40 s on a quiet machine (645 at wave 0 -> 710 -> 816) |
| `npm run test:golden-full` | 64 / 64, 17 s |
| `npx vite build` | built |
| `test:ci-local -- --fast --no-unit`, port 4238, 2 lanes | first run 48 of 56 (eight suites broke against W1-D's phone UI; all fixed as above, none a game bug except the boss bar overlap, the 320 px stats and the status-line height); final run **56 of 56 passed**, about 17 min |
| `test:render-budget` (17 scenarios) | PASS, table below; also green inside the ci-local `interface` group |
| `baselines:diff -- --full` | **all 8 identical** (911 s): missions Story, Standard, Veteran, Standard mercy, Standard firm; Chronicles; `check:defence --json` (28 rows); Classic bench (120 matches, row-identical) |
| `d071360b`, the 13 mission checksums, every golden pin | unchanged; nothing was re-recorded |
| Slow (software 20x) ci-local | not run (wave 0 showed it is load-limited on this machine) |

Render budget, p95 draw calls. Wave 0 values for the existing scenarios are identical except the three phone Defence scenarios, which fell because W1-F opens a phone at road zoom 55 (fewer objects in view): `defence-river-eco` 132 -> 124, `defence-carrier-eco` 139 -> 129, `defence-big-eco` 106 -> 91. Their limits are unchanged.

| Scenario | p95 draws | Limit | Triangles | Units |
|---|---:|---:|---:|---:|
| base-high | 141 | 160 | 117,966 | 14 |
| river-overview-high | 170 | 190 | 205,094 | 14 |
| large-map-high | 218 | 240 | 377,667 | 28 |
| battle-eco | 107 | 120 | 282,374 | 74 |
| three-rivals-eco | 146 | 150 | 300,978 | 88 |
| three-factions-eco | 182 | 185 | 277,386 | 88 |
| defence-wave-eco | 109 | 120 | 485,342 | 121 |
| air-battle-eco | 116 | 118 | 291,782 | 82 |
| boss-battle-eco | 116 | 120 | 284,580 | 75 |
| defence-river-eco | 124 | 135 | 492,027 | 121 |
| defence-carrier-eco | 129 | 142 | 350,384 | 121 |
| defence-big-eco | 91 | 112 | 155,405 | 125 |
| gunner-battle-eco (W1-B) | 117 | 125 | 274,270 | 74 |
| stalker-battle-eco (W1-C) | 121 | 125 | 315,302 | 86 |
| boss-sovereign-eco (W1-E) | 113 | 120 | 284,256 | 75 |
| defence-boss-eco (W1-E) | 116 | 125 | 294,594 | 62 |
| battle-expanded-eco (W1-A) | 114 | 125 | 289,694 | 74 |

The W1-C "noGrowth fails on battle-eco" note did not reproduce: restart batches 98 -> 102 -> 102 on `battle-eco` (limit 6), 107 -> 111 on Gunners, 112 -> 116 on Stalkers (new allowance 10 for those).

## 4. Expanded integration

- **Training.** Meridian's Field workshop `trains: ["gunner"]`; `tests/workshops.mjs` builds it, checks the PRODUCTION card (44 px tiles, dock no taller than a Barracks) and queues a real Gunner. The Veil relay reaches level 2 through W1-A's host levelling (relay level 1 or 2 seen in the AI matches below; `golden-expanded` asserts it).
- **AI fielding, Classic AI with `rules.roster = "expanded"`.** The plan asks for at least half of 12 AI-against-AI matches longer than 8 minutes. The Classic AI ends most matches fast: of 12 mirror and cross matches (3 maps x 2 speeds x Meridian and Veil, `.tmp` probe), only **3 lasted more than 8 minutes**, and the unit was fielded in **3 of those 3** (Meridian Dunes Normal 606 s: 1 Gunner; Meridian Dunes Fast 508 s: 4 Gunners; Veil Dunes Fast 542 s: 3 Stalkers). In the short matches the AI never reached the workshop (it needs a Foundry; the Stalker needs the relay at level 2). Record only: the sample of long matches is too small to call it half of 12; W2-A should build the test with the time cap in mind.
- **`bench-expanded.json`** (`bench:factions --jobs 3 --rules '{"roster":"expanded"}'`, 120 matches; wins out of 48 against Classic in brackets): Meridian 31 (33), Ashfall 20 (20), Sunward 17 (18), Wardens 33 (33), Veil 19 (16). Score table: Meridian 65, Ashfall 42, Sunward 35, Wardens 69, Veil 40. 20 matches ran beyond 480 s, 3 hit the 1,800 s cap.
- **`tests/golden-expanded.test.js`** (new, `GOLDEN_FULL`, faction-isolated mirrors on Dunes): Meridian vs Meridian, Normal, hashes at 300 s `a7c963ae` and 600 s `afb7a148` (the match ends at 606 s); Veil vs Veil, Fast, 300 s `e962d2f7` and 500 s `bbf92080` (it ends at 542 s, so the second point is 500 s, not the plan's 600 s). Re-runs are identical. Pre-declared re-record: only W2-A changing an economy field of `gunner`, `stalker` or `workshop`.

## 5. Review notes (scope, seams, owner rules)

- Scope: the only files edited by more than one package are the append-only ones (pages.yml, CHANGELOG, BALANCE, package.json, balance.json, vi.json, content/index.js, view-plugins.js, visual-style.json, render-budget.mjs). No package edited a file outside its list otherwise.
- Inert seams: `d071360b`, the 13 checksums, all golden pins and all eight baselines are unchanged, so the new modules (suppression, marksman, boss-status, workshops, tower-aim) are inert in Classic play.
- Owner rules: Gunner and Stalker each have one ability (Crossfire, Steady aim) and are Expanded-only; no bunkers or barricades; no `system-ui` fonts added (the boss bar uses `var(--font-display, sans-serif)` as W1-E wrote it). Texts are 11 px or more in the touch rows, the rules row and the boss bar (each package's browser suite asserts it). Vietnamese strings: every new string has an entry in `vi.json`.
- Leaks: the Classic Field guide listed the Stalker, Gunner and Field workshop; fixed (section 2). The Classic roster shows none of them in the production cards (workshops are Expanded-only through `roster`).

## 6. Phones and Defence measurements

- **28 px unit rule in Defence at the phone zoom (re-measured after W1-D):** portrait 390x844: a Vanguard is **27.7 px** tall at zoom 55 (W1-F measured 33.0 before W1-D; just under 28); landscape 844x390: **20.3 px** (17.2 before W1-D). Both are below the rule. Not redesigned, as instructed; `defence-deck.mjs` records both and fails below 20 px. The owner or round 3 decides the phone Defence zoom.
- **Defence battlefield share on phones (elementFromPoint grid, `.tmp` probe on m02b):** portrait 390x844 **69.0%** with nothing shown, **65.3%** with a dialogue chip; landscape 844x390 **69.9%**. The plan's bar is 70%: just short in Defence (the Defence bar adds 60 px); skirmish and campaign measure 70.1% and 71.4% (`tests/phones.mjs`, passes).
- **m02b stacking at 390x844** (dialogue chip, Defence bar at `--defence-bar-h` 60 px, tab strip): no overlaps and every shown element reachable by `elementFromPoint`; the hint is `pointer-events: none` by design. The boss bar now clears the dialogue chip (it overlapped in portrait before the fix).

## 7. CI timings

| Item | Result |
|---|---|
| `ci:build-job` on 2 cores (`start /affinity 0x3`), quiet machine | **274 s (4.6 min)**: npm test 172 s (816 tests), `check:defence` about 97 s, build 1 s; cap 10 min, target 7 min: met with 2.4 min to spare. On the slower runner expect about 1.5 to 2x: 7 to 9 minutes, so the margin is thin; if it slips, move `check:defence` to its own matrix entry (it is the single biggest piece after the unit tests). |
| Browser groups | Local fast-mode times per group, `test:ci-local -- --fast`, 2 lanes. Calibration: the old "story" group (missions + tactics-ui + audio + choices) ran **122 s here and 27 to 30 min on the runner: factor about 14**. |

| Group | Local s | Estimated runner minutes (x14) |
|---|---:|---:|
| ui-extras (before split: ui-extras + messages + abilities) | 119 | **28 (over): split** |
| interface (before split: + render-budget) | 94 | **22 (over): split** |
| visuals | 81 | 19 |
| maps | 80 | 19 |
| commands | 76 | 18 |
| story (missions, tactics-ui) | 74 | 17 |
| r2-w1f defence-deck | 64 | 15 |
| languages | 62 | 14 |
| construction | 61 | 14 |
| defence | 55 | 13 |
| story-audio | 48 | 11 |
| mobile, layout-mobile, scenes, layout-desktop, settings | 41 to 45 | 10 |
| chronicles, air, status-layout, r2-w1d phones, music, golden-full, progression, bosses, others | 3 to 32 | 1 to 7 |

After the split: `ui-extras` (ui-extras + abilities, 73 s, about 17 min), `ui-extras-messages` (46 s, about 11 min), `interface` (ui-quality + ambient-life, 28 s, about 7 min), `interface-budget` (render-budget, 66 s, about 15 min). `visuals` and `maps` sit at about 19 min on the estimate: watch them on the first runner pass. The factor is calibrated on one group and the machine was not idle, so treat the estimates as indicative only. New entries `r2-w1a` (8 s), `r2-w1b` (4 s), `r2-w1d` (24 s), `r2-w1e` (3 s), `r2-w1f` (64 s) are small.

## 8. Open issues and owner notes

1. Phone Defence unit size is below the 28 px rule (27.7 px portrait, 20.3 px landscape) and the Defence battlefield share is 65 to 70% against a 70% bar. Decide the zoom (W1-F set 55) or accept.
2. The Classic AI ends most Expanded matches before it can field Gunners or Stalkers; the "half of 12 matches longer than 8 minutes" test cannot be made with Classic AI aggression as it is (W2-A and W2-D own this).
3. `ci:build-job` has 2.4 minutes of margin locally; the runner is slower. If the first runner pass cancels, move `check:defence` out.
4. Unconfirmed on the runner: the group estimates, and the slow (20x) ci-local matrix (not run).
5. Seam requests still open from the packages: `view.js setCoverOpen(openHeight)` (W1-D perf), the superseded rules at `ui-theme.css` lines 482 to 501 (W2-C), `boss-ui.css` stacking (now handled with `--band`), the aiming mode in `src/app/abilities.js` is still hard-wired to Barrage (W1-C).
6. The merged package worktrees (`3d_astra-r2-w1a` to `-w1f`) were left in place for the lead to remove.
