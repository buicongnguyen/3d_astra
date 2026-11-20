# Wave 2 integration: results

Integrator, 2026-11-20. Integration worktree `3d_astra-zones`, branch `feat/aaa-round2`, base tag `r2-wave-1` (`6d32b89`; deployed `main` is the older `dfc3d1a`). Port 4238. Tag `r2-wave-2` (local, annotated). Nothing was pushed, deployed or dispatched. No separate reviewer ran: the integrator also reviewed each diff (section 5).

## 1. What merged

Order from the plan: W2-A, W2-D, W2-B, W2-E, W2-C, W2-F. All six merged with `--no-ff`; none was reverted.

| Package | Branch | Conflicts |
|---|---|---|
| W2-A Rampart, facing armour, Outrider drill | `r2/w2a-rampart` | none |
| W2-D Field command AI plan | `r2/w2d-field-command` | append-only: BALANCE.md, `content/index.js` |
| W2-B Heroic Defence, elites | `r2/w2b-heroic` | append-only: CHANGELOG, `balance.json`, `vi.json`, `content/index.js`, `render-budget.mjs` |
| W2-E Weapon looks, counter hits, damage numbers | `r2/w2e-battle-feel` | append-only: CHANGELOG, `vi.json`, `view-plugins.js` |
| W2-C First impression and story light | `r2/w2c-first-impression` | append-only: `pages.yml`, CHANGELOG, `render-budget.mjs` |
| W2-F Campaign showtime, m11c | `r2/w2f-showtime` | append-only: `pages.yml`, MISSIONS, `package.json`, `vi.json`, `view-plugins.js` |

Conflict checks: every JSON parses; `balance.json`, `package.json`, `story-vi.json`, `manifest.json` have no duplicate keys (`vi.json` keeps the one old duplicate "Next idle Harvester"). `content/index.js` has one entry per package (facing, rampart, outrider, aiCasts, fieldCommand, elites); `view-plugins.js` adds EliteView, CounterHitView, BossPresenceView; `pages.yml` adds `r2-w2b`, `r2-w2c`, `r2-w2f`. Key-by-key, `balance.json` against `r2-wave-1` has **no changed existing value**, only the new `outrider_drill`, `elites` and the definition `rampart` (the economy fields W2-A may tune were not touched).

## 2. Commits by the integrator

| Fix | What |
|---|---|
| W2-E seam | `view.js` `WorldView.reset()` sets `view.fx.rng = mulberry32(1482)` (cosmetic effects only; the sim never sees it). The optional `weaponStyle` faction argument was not done (not trivial: two call sites in the shot path). |
| `vi.json` patterns | The last entry held two pairs, so "Speed x" never loaded: split. Also found: W2-A's two Field guide patterns had lost their backslashes (`(d+)` instead of `(\\d+)`), so they never matched either: fixed. |
| `workshops.mjs` | asserts the roster row's buttons only (Classic, Expanded); W2-D's AI plan row adds two more. |
| `mission-looks.test.js` | m11c (new content) may carry `look: "dusk"`; existing missions still may not. |
| `mobile-controls.mjs` | the AI plan row pushes `#enemy-count` under the sticky Start bar on 320x568 and 667x375 (a reachable control, but not before scrolling): the test now scrolls it into view first. The only suite that failed in ci-local. |
| BALANCE.md | Field command section updated to the final W2-D numbers. |
| golden pins | new `tests/golden-round2.test.js` (section 4) and m11c added to `golden-story` (`a929add0`, wave 2, 20 lives, same run as `golden-w2f`). |
| baselines | m11c rows recorded in the five mission tables: `git diff --numstat` shows 0 deleted lines in each, so every existing row is identical. |
| CI | `pages.yml`: `visuals` split into `visuals` and `visuals-world` (section 6). |

## 3. Tests

| Run | Result |
|---|---|
| `npm test` | 935 tests, 909 pass, 26 skipped (`GOLDEN_FULL`), 0 fail (816 at Wave 1 -> 935) |
| `npm run test:golden-full` | 82 / 82 |
| `npx vite build` | built |
| `test:ci-local -- --fast --no-unit`, port 4238, 2 lanes | 59 of 60 on the first pass (`mobile-controls`, fixed above, re-run green alone), about 10 min; the `visuals-world` split only moves two suites between entries |
| `test:defence-heroic-check` | PASS: Heroic bot wins 7 of 7 (Gorge with 2 lives, the rest 5), passive loses at wave 1 on all 7 |
| `test:render-budget` (20 scenarios) | PASS inside ci-local; every Wave 1 scenario identical; `battle-expanded-full-eco` 149 (limit 150), `defence-heroic-eco` 114 (125), `night-battle-eco` 107 (120) |
| `baselines:diff -- --full` | missions x5 differed **only by the new m11c rows** (the diff tool compares by position, so the inserted rows show as shifted; after recording, 0 deleted lines); chronicles identical; `check:defence --json` (28 rows) identical; Classic bench (120 matches) row-identical |
| `d071360b`, the 13 mission checksums, all earlier golden pins | unchanged (the 14th checksum `8b3c253d`, m11c, is in `wings.test.js`) |
| Not run | the slow (20x) ci-local matrix; `test:webkit`; a runner pass |

`check:missions` Story, Standard, Veteran, Standard mercy and firm ran inside `baselines:diff --full` (the same commands, `--jobs 3`), as did `chronicle-check`.

## 4. Round-2 content tables

- **Expanded bench** (W2-A, 120 matches, wins of 48): Meridian 26, Ashfall 18, Sunward 33, Wardens 25, Veil 18 = 54.2, 37.5, 68.8, 52.1, 37.5 %. All inside 25 to 75%; Ashfall below its Classic 40% (O24).
- **Field command** (W2-D): Field round robin scores Meridian 65, Ashfall 77, Sunward 19, Wardens 27, Veil 63; Field plus Expanded 58, 77, 23, 29, 63. PlayBot win rate at Normal 86% against a 35 to 75% band.
- **`tests/golden-round2.test.js`** (new, `GOLDEN_FULL` for the first): Expanded plus Field command, four AI factions (Ashfall, Sunward, Meridian, Veil), Riverlands, Normal, 300 s: `4cce2935` (the Outrider drill fires in it; no Rampart, Gunner or Stalker is fielded by 300 s, so those stay pinned by `golden-w2a`, `golden-expanded`); Heroic d-gorge `d78d0600` (victory, 2 lives), Heroic d-longcrossing `9752f7e0` (5 lives); m11c DefenceBot 120 s `a929add0`. The plan asked for an ObjectiveBot m11c run; m11c is a Defence mission, so the DefenceBot plays it (as `golden-w2f`).
- **m11c** (W2-F): Story / Standard / Veteran 3 / 3 / 2 stars (targets 3 / 2 / 1); the lent Gunners pin Scrapper groups.

## 5. Review notes (scope, seams, owner rules)

- Scope: files edited by more than one package are the append-only ones (`pages.yml`, CHANGELOG, BALANCE, MISSIONS, `package.json`, `balance.json`, `vi.json`, `content/index.js`, `view-plugins.js`, `render-budget.mjs`). W2-B's small `render-budget.mjs` and `tools/defence-bot.mjs` edits are declared in `w2b.md` and inert on every designed level (`check:defence` identical).
- Inert seams: `d071360b`, the 13 checksums, every earlier golden pin, all eight baselines and the Classic bench did not move. W2-D's `ai.js`/`economy.js` edits are gated on `fieldPlan(...)`; W2-B's `defence.js` edits on `mods`/`noCallBonus`/`bounty_x`; the drill and the Rampart on the Expanded roster.
- Owner rules: Rampart has one ability (Ram), Gunner and Stalker one each; no bunkers or barricades; no `system-ui` fonts (Baloo 2 is bundled, with the old stack as fallback); Vietnamese entries exist for every new string (new ones from W2-A, B, E, F merged; the two W2-A patterns fixed). Text and tap sizes are asserted by each package's browser suite (all green).
- Leaks: none found. The Rampart and the drill appear only under the Expanded roster; the Field plan only under `rules.aiPlan`.
- W2-C font: `--font-display` (Baloo 2) now also reaches the HUD and dialogs; tiles and the stage list use `--font-tile` (the old stack). Owner may want it narrower (O7).

## 6. CI timings

`ci:build-job` on 2 cores (`start /affinity 0x3`), quiet machine: **310 s (5.2 min)**: `npm test` 208 s (935 tests), `check:defence` about 95 s, build 1 s. Limit 10 min, target 7: met with 1.8 min to spare (the runner is slower, expect 8 to 9: move `check:defence` to its own matrix entry if it cancels; `defence-heroic-check` is already its own entry).

Browser groups, local fast mode, 2 lanes; runner estimate is x14 (calibrated on the old "story" group, 122 s here, 27 to 30 min there). Cap 30, rule 20.

| Group | Local s | Estimated min |
|---|---:|---:|
| visuals (before split: six suites) | 82 | **19** (split: now `visuals` 34 s, 8 min; `visuals-world` factions + terrain 48 s, 11 min) |
| r2-w1f defence-deck | 78 | 18 |
| commands | 76 | 18 |
| ui-extras | 75 | 17.5 |
| story (missions, tactics-ui) | 75 | 17.5 |
| layout-mobile / layout-desktop | 46 / 44 | 11 / 10 |
| ui-extras-messages | 46 | 11 |
| scenes | 45 | 10.5 |
| interface-budget | 44 | 10 |
| story-audio, settings | 47, 43 | 11, 10 |
| defence (defence, zones) | 57 | 13 |
| r2-w2b (heroic, heroic-check) | 57 | 13 |
| r2-w2f showtime | 41 | 9.5 |
| r2-w2c title | 11 | 2.5 |
| every other group | 3 to 35 | 1 to 8 |

No group is estimated above 19 minutes. Every new suite is in a matrix entry (`tests/ci-matrix.test.js` passes): `r2-w2b` (defence-heroic, defence-heroic-check), `r2-w2c` (title), `r2-w2f` (showtime); W2-A, W2-D and W2-E add node tests only; `golden-full` runs the new pins. Estimates are indicative (one calibration group, the machine ran 2 lanes).

## 7. Timing gates (quiet machine, no agents running)

| Gate | Result |
|---|---|
| Sim tick, Classic AI scene (`perf-ab`, `r2-wave-1` against HEAD, 7 runs, `riverlands-x2-300`) | p99 0.789 -> 0.810 ms (+2.7%), mean +1.5%; **same final hash `3f77c63b`** (Classic play inert) |
| Sim tick, Defence scene (`crossroads-wave-120`) | p99 0.178 -> 0.171 ms (-3.8%); same hash `06e1a37a` |
| W2-D think, Field plan on the same scene (7 runs, HEAD) | p99 0.831 ms for Classic, Field and Field plus Expanded alike: no cost measured |
| W2-E fx update, 24 mixed units fighting, 1280x720, 5 runs of 6 s | mean 0.15 to 0.25 ms per frame (W2-E measured 0.289 before / 0.233 after on a lighter scene); `performance.now()` resolution is 0.1 ms here, so noise-limited; the gate (+0.2 ms) holds |
| W2-C frame time, title and battle, real GPU, 1440x900, 5 runs each | median **16.7 ms (vsync) in all 10 runs**: no regression visible. The SwiftShader numbers of `w2c.md` stay noise-limited and were not repeated; the portrait phone measurement did not finish in the time box |
| W2-B build-job time | see above (310 s) |

## 8. Owner decisions (new and changed)

The full table is in `review-packet.md`. The three the integration found:

1. **O24: Ashfall at 37.5% (target 40%) in the Expanded bench.** Not retuned. Ashfall vs Sunward is 1 of 12 whatever the Rampart's economy (3 of 12 with the drill off): the drill is what moved Sunward from weakest to strongest.
2. **O25: Field command.** PlayBot win rate vs Field is 86% (band 35 to 75; Classic AI is 90% on the same runs); 8 of 12 Expanded matches reach 6+ combat types (target 10 of 12). Recorded, Classic not tuned.
3. **O1 and O2 flip conditions are not met** (O1: Ashfall is below Classic and fielding is untested over long matches; O2: win rate above the band). Both defaults stay Classic.

## 9. Open issues

1. Night outland terrain (beyond the map edge) is not tinted by the look: a W2-C follow-up.
2. Short captures (Heroic finale with Stalkers, Outrider drill, m11c Gunners) are not in the review packet; no package produced them.
3. The Rampart is not in the weapon contact sheet (not in W2-E's tree); no Rampart, Gunner or Stalker reaches the field in the 300 s `golden-round2` arena (pinned elsewhere).
4. `weaponStyle` calls in `view.js` (shot flight time, recoil) still take no faction (W2-E optional).
5. Phone Defence unit size (27.7 px portrait, 20.3 px landscape) from Wave 1 is unchanged.
6. Unconfirmed: the slow (20x) ci-local matrix, WebKit suite, runner timings, portrait phone frame time.
7. `ui-theme.css` lines ~482 to 501 (superseded W1-D rules) were not removed (W2-C seam note).
8. The merged package worktrees (`3d_astra-r2-w2a` to `-w2f`) are left in place for the lead.
