# AAA round 3, Wave 2 integration (tag `r3-wave-2`)

## Wave 2 (G, H, J, K, V)

Integrator, port 4238, worktree `3d_astra-r3` on `feat/aaa-round3`, base `0b801da` (`r3-wave-1m` plus a CI fix,
deployed on main), 2026-11-21. R3-I finished during the integration and was merged as the sixth branch, so one
verification run covers all six packages and the two owner requests (top-bar Full screen, phone command row).

### Merge log

Each merge was `git merge --no-ff`. After each merge, every JSON file was parsed and scanned for duplicate keys.
The only duplicates are `"Next idle Harvester"` and `"Sector 07"` in `vi.json`, both with the same value. Both were already there before round 3 (`r3-wave-1m`), so they are left as they are.

| # | Branch (tip) | Merge commit | Conflicts | Resolution |
|---|---|---|---|---|
| 1 | `r3/g-openings` (ec33f34) | 6dc6c89 | none | — |
| 2 | `r3/h-sovereign` (677eee7) | 1e3b0dd | `pages.yml`, `CHANGELOG.md`, `package.json`, `story-vi.json`, `vi.json` | union, G then H; one comma each in `package.json`, `story-vi.json` and `vi.json`; a blank line before `### R3-H` |
| 3 | `r3/j-models` (0d56a6c) | 17b8133 | `CHANGELOG.md` | union |
| 4 | `r3/k-readability` (7afa9f5) | 17c6373 | `pages.yml`, `CHANGELOG.md`, `TESTING.md`, `package.json`, `render-budget.mjs` | union; `render-budget.mjs` keeps H's `boss-sovereign2-eco` scenario, then K's three; each limits line kept once |
| 5 | `r3/v-ceremony` (ce58d90) | f1ba7ce | `pages.yml`, `CHANGELOG.md`, `package.json`, `debug-hooks.js`, `vi.json` | union; `debug-hooks.js` keeps G's `jumpBoss`/`playOpening` and V's `ceremony`/`onMatchEnd`/`mvp`; one comma each in the strings and the patterns of `vi.json` |
| 6 | `r3/i-pacing` (d52661c) | 2b8c4cd | `CHANGELOG.md`, `MISSIONS.md`, `TESTING.md`, `story-vi.json` | union; `src/story/missions.js` merged on its own (H's import and entry, plus I's probes, m03 and m04 data) |

These files merged without conflict:
- `manifest.json`
- `portraits.js` (one `ironsovereign2` entry, J's)
- `wings.test.js` (H's count 17 and I's 11 checksums)
- `story-scenes.test.js` (H's 17 and I's m04 truce wave)
- `mission-check.mjs`
- `view-plugins.js`
- the five baseline tables (I's recording)

CI matrix entries present: `r3-g` openings, `r3-h` sovereign-walks, `r3-k` readability, `r3-v` ceremony.

### Seam fixes and owner request

| Commit | Change |
|---|---|
| 7bbbe80 | **H→G:** `mission-intros.js` has an m11d row (ACT III, DAY 54), and the `PENDING` exemption in `keystone-roads.test.js` is removed.<br>**H→G:** `openings.js` has an m11d row: it starts at `ford` with offset [-7, -6], i.e. (-9, 0) on the ford's north-west bank, and drifts toward the line. Zoom 1.5, 5 s. The plain ford (-2, 6) was only 4.5 m and 17° from m01's start (the distinctness test failed). From the offset start the nearest other starts are m04 at 11.2 m, m11 at 12.4 m and m01 at 13.5 m. |
| 7bbbe80 | **H↔J:** `tools/boss-parts/ironsovereign2.json` now uses palette `sovereign3`. `ironsovereign2.glb` was re-ported from `Tank_game_3D/public/models/boss-walker.glb`: 1,904 triangles, 6 materials (Gold → Crimson, as J's). J's `ironsovereign.glb` re-ports byte-identical from the same source, which shows the source is right. `PORTRAIT_ORDER` keeps its single `ironsovereign2` cell. |
| 7bbbe80 | **K:** `main.js` sets `S.view.controlGroups = S.groups` after the WorldView is created, so group badges show in play. |
| 7bbbe80 | **G:** `briefing.js`: on phones, the picked (`aria-current`) mission row scrolls into view inside its scrolling setup column. This happens when the list is redrawn and when Campaign is chosen. The page itself never scrolls, and nothing changes on tablets or desktop. |
| 7d4dcbb | **Owner: one-tap Full screen in the top bar.** An icon-only `#fullscreen-top` sits before the sound button.<br>• When full screen is on, its `aria-label` and icon change to "Exit full screen" / collapse. The modal's text buttons are unchanged.<br>• It is hidden in the menu, which keeps its own Full screen card.<br>• It is also hidden in an installed web app and where the browser has no full-screen API (iPhone Safari).<br>• `tests/fullscreen.mjs` checks that it toggles both ways without pausing, that it is hidden without the API, and that at 390×844, 844×390 and 320×568 it stays in one row, 44 px tall, with no overflow. At 320 px it is 40 px wide, like every top-bar icon there.<br>• `vi.json` already had both strings. |
| 9d0b706 | **Owner: phones get a one-tap command row, with no "…" sheet.** There are six equal buttons in one row just under the top bar: Army, Workers, Box, Queue, Clear and Info. The full names stay as `aria-label`/`title`, and all ids, handlers and `aria-pressed` are kept.<br>• Portrait spans the screen: 59 px buttons at 390 px wide, 47 px at 320 px.<br>• In landscape the row replaces the left rail (6 × 56 px). The Objectives chip and the idle buttons follow it, and the dialogue box starts at the left edge.<br>• Every button is 44 px tall with 11 px text, and no label wraps or overflows.<br>• Zoom +/- stay hidden (pinch zooms). There are no group buttons, and the dock heights are unchanged.<br>• The row costs about 2 % of the battlefield, so the floors moved:<br>&nbsp;&nbsp;– `phones.mjs` 0.70 / 0.60 → 0.67 / 0.575. Measured: portrait 70.1 → 67.9 % and landscape 71.4 → 69.1 % with nothing selected; 58.5 % and 58.3 % with a unit.<br>&nbsp;&nbsp;– `layout-f.mjs` landscape 0.65 → 0.63 (0.636 measured).<br>• Tests that opened the sheet now tap the buttons directly: air, harvesters, mobile, mobile-controls, phones, squad-orders.<br>• `vi.json` gains "Clear" and "Info", and loses "More controls".<br>• Before/after shots: `wave-2/touch-row-{portrait,landscape,small}-{before,after}.png`.<br>• Suites green on 4238: ui-quality, phones, mobile, mobile-controls, mobile-gestures, mobile-construction, selection, cover-ui, air, harvesters, squad-orders, layout-f, status-layout, messages. |
| 656e93d | **Baselines:** the five mission tables re-recorded once on the merged tree (see below). |

Not done: H's optional seam to fold `SOVEREIGN_SCENES` into `SCENES`. The `Object.assign` works and moving it gains nothing.

### Tests on the merged tree

| Check | Result |
|---|---|
| `npx vite build` (output visible) | clean; index JS 974 KB / 324 KB gzip (the usual chunk-size note only) |
| `npm test` | **1061 tests: 1033 pass, 28 skipped, 0 fail**. That is 1027 at `r3-wave-1m`, plus G 5, H 10, J 4, K 5, V 4 and I 6. |
| `npm run test:golden-full` | **97 / 97** |
| `npm run check:defence` | PASS (every level meets its star target, endless at the cap) |
| `check:missions` (inside `baselines:diff --full`, all five tables) | every mission won by the objective bot on Story, Standard, Veteran, mercy and firm, m11d included; no missed target. Standard: 14 gold, 2 silver, 1 bronze. Veteran: 12 gold, 4 silver, 1 bronze. |
| `baselines:diff --full` | chronicles, defence and bench-classic identical. The five mission tables differ from I's recording **only by the m11d rows** (compared by row key: 0 changed, 0 removed; 3 added per Standard table, 2 on Story and Veteran). Re-recorded once (656e93d). The fast set afterwards: missions-standard and defence identical. |
| Render budget (RTX 4080 SUPER, Eco, all scenarios) | PASS. battle-eco 107; three-factions-eco 182 / 185; battle-expanded-eco 115; boss-sovereign2-eco 120 / 125; wide-battle-eco 149 / 152; groups-battle-eco 108 / 111; combined-defence-eco 95 / 97. `noGrowth` [97, 101, 101]. |
| Browser suites on 4238 (top bar change) | fullscreen, ui-quality, phones, mobile, hotkeys: PASS |

### Pins

- **Moved (declared by R3-I, taken from its branch):**
  - 11 mission checksums in `tests/wings.test.js`;
  - `golden-story` m01 / m03;
  - the five mission baseline tables.
- **New pins:**
  - `golden-r3h` (4, one long);
  - `golden-r3i` (6, including the m04 120 s pin `ded7f19b`);
  - the m11d rows in the mission tables.
- **Unchanged:** every other golden pin, the idle fingerprint `d071360b`, and the m02b, m08 and m11c checksums.
- **No integration change moved a pin.** The seams and the top bar are view, UI and data rows keyed by id.

### Owner decisions

- **2026-11-21, Fast against two AIs: leave it as is (R3-I option a).** Normal 1v2 got easier, and players choose the speed, so the AI is not eased.
  - The `check:difficulty` Fast 1v2 cells are accepted at their `r3-wave-1m` values as the **new accepted baseline**: Classic **3 / 24** and Field + Expanded **10 / 24** bot wins.
  - Read the difficulty gate against these numbers, not against `r3-base` (7 and 15), so these cells are not reported as a regression.
- **2026-11-21, one-tap Full screen in the in-game top bar** (owner request; commit 7d4dcbb).
- **2026-11-21, phones: one-tap command row, no "…" sheet** (owner request; commit 9d0b706). The free-battlefield floors were lowered by the row's cost (see above).

### test:ci-local (CI_LOCAL_PORT 4238, CI_LOCAL_LANES 2, software rendering, CPU slowed 20x, `--no-unit`)

The machine was shared with other sessions' browser suites during this run (CPU load up to about 80 %), so most failures were page loads that took longer than 30 s under the 20× CPU slowdown.

**Run 1** (HEAD 9d0b706, unit tests included: 1061 tests, 1033 pass, 0 fail):
- Passed: desktop/browser, training/tutorial, mobile/mobile, mobile-controls, mobile-gestures, mobile/fullscreen, settings/improvements, settings/campaign, settings/offline, story/missions, story/tactics-ui, music, interface/ambient-life and progression.
- From story-audio onward almost every suite failed at `page.goto` (load timeout). The run was stopped.

**Run 2** (`--no-build --no-unit`, the groups that were not yet green):
- Passed: story-audio/audio, story-audio/choices (1,100 s), interface/ui-quality, interface/ambient-life and maps/stages.
- Failed: languages/language, on a page-load timeout after both its desktop and mobile parts had passed.
- **One real failure:** scenes/story expected 16 relays. R3-H's count changes missed this browser suite; it now expects 17 (dd425c6), and `--fast` gives scenes/story PASS (71 s).
- The run was stopped at 7 of about 60 suites (about 5 min per suite under this load), because three more branches (ko, map-campaign, copyright) are being merged on top and change the UI again.

**The full CI-like matrix runs once on the final tree (`r3-wave-2-final`).** That tag records it, so one verification covers every Wave 2 merge.

Suites run at full speed on 4238 against this build, all green:
- fullscreen, ui-quality, phones, mobile, hotkeys;
- mobile-controls, mobile-gestures, mobile-construction, selection, cover-ui;
- air, harvesters, squad-orders, layout-f, status-layout, messages;
- story.

### Open items

1. H's walking Sovereign now shares J's `sovereign3` palette. A darker "refitted" palette for `ironsovereign2` would be one parts-file change plus a re-port, if the owner wants the two told apart by colour.
2. R3-U (Wave 3) can add a sound for H's `bossSurge` event and swap V's stamp sting (`ceremony.js` `sting()`).
3. G's optional seam: story scenes on phones leave the strip under the dock undrawn. The same `setCoverOpen(false)` fix that the openings use would apply.
4. Fold `SOVEREIGN_SCENES` into `SCENES` during the clean-up wave if wanted.
5. `vi.json` duplicates `"Next idle Harvester"` and `"Sector 07"` (same values, from before round 3).
6. R3-I option (b), a default rally point in front of the camp, is not needed after the owner's decision.
