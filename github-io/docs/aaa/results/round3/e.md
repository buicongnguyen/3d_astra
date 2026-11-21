# R3-E: Defence onboarding and readability (results)

Branch `r3/e-defence-onboarding` from `r3-base`, worktree `C:\Users\n\source\repos\3d_astra-r3-e`, port 4236.
Interface only: no file under `src/sim/`, no `balance.json`, no Defence level or wave was touched.

## What the player gets

| Item | What it does | Where |
|---|---|---|
| Guided first build | On a profile with no Defence win: a ring on the glowing pad (ground or rim pad nearest the road; the camera opens on it), then on a crew tile (Rangers first; the Actions tab first on a phone showing another tab), then on Call wave. Each step follows the match (pad picked, tower standing, wave called), so stepping back shows too. Skip button (44 px). Done or skipped, it is stored as `guided: true` and never shows again. The empty card's "Crew the pads" hint gives way to the guide's while it runs. | `src/app/defence/guide.js` (new), `src/defence/progress.js` (`guideWanted`, `recordGuided`, `hasDefenceWin`), glow in `pads-view.js` `paintPads` |
| Crew badges | A plate over each crewed tower: crew glyph + tier pips (bronze 1, steel 2, gold 3; branch ranks: gold double rim and white extra pips), 30 px on screen at every zoom, always on top. | `src/defence-readability-view.js` (new view plugin, registered last) |
| Contrast discs | A dark disc with a team-coloured rim (cyan yours, red the waves) under every unit of a Defence match (waves, armour squads, commander, Vanguards). | same plugin |
| Landscape dock | In Defence on a landscape phone the Selection/Actions panel is 184 px (was 236 px) and a 44 px button on top collapses it to that button; a new battlefield pick opens it again. | `src/app/defence/dock.js` (new), Defence block at the end of `src/landscape-hud.css` |
| Next star | The level result names the lives for the next star (or all the waves on a loss), then one tip from the match: the wave that cost the most lives and the crews that counter its toughest unit; else gold tier, a rim pad, or the call-early rule. Three stars point at Heroic, then Veteran. | `src/app/defence/result.js` (`nextStar`), lives lost per wave counted in `bar.js` `announce` |

## Acceptance numbers

| Check | Before | After | Limit |
|---|---|---|---|
| Actions panel width at 844x390 (Defence) | 236 px = 28.0% | **184 px = 21.8%** | at most 22% |
| Dock column incl. its 8 px edge gap | 244 px = 28.9% | 192 px = 22.7% | (reported) |
| Collapsed dock | n/a | one 44x44 button (5.2%) | |
| `defence-wave-eco` draws (render-budget, held clock) | 109 | **111** (+2) | +3, limit 120 |
| `defence-big-eco` draws | 91 | 93 (+2) | limit 112 |
| `battle-eco` draws | 107 | 107 | 120 |
| `compose` per frame, defence-wave-eco | 417 | 419 | 450 |
| GPU buffer uploads on still frames | 0 | 0 | 0 |
| Badges / discs | | 1 draw / 1 draw | badges at most 2 |
| `check:defence` | PASS | PASS, every row identical (no sim file touched) | identical |
| `npm test` | 961 tests, 935 pass, 26 skipped | **966 tests, 940 pass, 26 skipped, 0 fail** | +5 |
| `baselines:diff --full` | | **identical**: missions-story, -standard, -veteran, -standard-firm, chronicles, defence, bench-classic; missions-standard-mercy matched once m12 was given a longer wall clock (see note) | identical |

"Before" draws were measured on this branch with the plugin taken out of the registry (same build, same machine), then put back.

Browser suite `tests/defence-onboarding.mjs` (CI matrix `r3-e`), 3 viewports, about 26 s locally:
- desktop, portrait, landscape: guide steps 1, 2 and 3 tapped for real, guide gone and stored, second visit shows no guide;
- 6 badges for 6 towers, discs under the units in view;
- landscape: panel 21.8%, collapse to one 44 px button, a new pad pick opens it;
- result: 2 stars at 12 lives, hint "Next star Finish with 18 lives or more (you kept 12)." plus one tip;
- no text under 11 px, no tap under 44 px, no sideways scroll, no page errors.

Note on `missions-standard-mercy`: in the full run, m12 hit the 600 s wall clock with six agents on the machine ("did not finish"). Rerun alone with `--timeout 1400`: objective bot victory at 772 s, objectives `DDad`, wave 235, gold, exactly the baseline. No sim file changed in this package.

Suites run on 4236 after the change, all green: `defence` (52 s), `defence-zones` (60 s), `defence-deck` (90 s), `defence-heroic` (21 s), `phones` (25 s), `layout-f`, `ui-quality`, `defence-onboarding` (26 s); render-budget `defence-wave-eco`, `defence-big-eco`, `battle-eco`.

## Screenshots (`e/`)

- Before: `before-landscape-actions.png` (the 236 px Actions panel), `before-landscape-start.png`.
- Guide: `after-step1-desktop.png`, `after-step1-portrait.png`, `after-step2-portrait.png`, `after-step3-portrait.png`, `after-step1-landscape.png`, `after-step2-landscape.png`, `after-step3-landscape.png`.
- Badges and discs: `after-badges-desktop.png`, `after-badges-portrait.png`, `after-badges-landscape.png`, `after-discs-closeup-landscape.png` (zoom 24: dark discs with red rims under the first wave on the orange road).
- Dock: `after-dock-landscape.png` (184 px), `after-collapsed-landscape.png`.
- Result: `after-result-desktop.png`, `after-result-portrait.png`, `after-result-landscape.png`.

## Decisions taken (change any)

- The guide shows on any variant while the profile has no Defence win and the guide was never finished or skipped. It does not hold the first-wave countdown (that would need `frame.js`; the 30 s first wave is enough for three taps, and calling the wave is step 3 anyway).
- Under `?test` the guide is off unless the URL has `?guide`, like the new-enemy cards (`?enemycards`), so the other suites are not covered by coach marks.
- Tier colours on the badges: bronze `#b8692e`, steel `#c4dcee`, gold `#ffd23a`; the disc rims cyan `#7fe8ff` (yours) and red `#ff5a6e` (theirs).
- The landscape dock reopens on a new battlefield pick (pad, tower, commander, squad, bridge, zone spot).

## Seam requests

None needed for the acceptance. Optional, for the integrator or a later package:
1. `src/app/frame.js` (not mine): if the owner wants the first-wave countdown to wait during the guide, `running` at line 104 could also check `!S.defenceGuideHold`, which `guide.js` would set while steps 1 and 2 run. Not done.
2. R3-K (battle readability) may want the same disc in skirmish; the geometry and the no-compose writer in `defence-readability-view.js` can be shared.

## Test changes for the integrator

- New: `tests/defence-onboarding.test.js` (5 tests), `tests/defence-onboarding.mjs`, script `test:defence-onboarding`, matrix entry `r3-e` in `.github/workflows/pages.yml`.
- `src/view-plugins.js`: `DefenceReadabilityView` appended (import line plus registry entry). `tests/defence-onboarding.test.js` asserts it is the **last** entry; if another Wave-1 package appends a plugin after it at merge, change that assertion to `VIEW_PLUGINS.includes(DefenceReadabilityView)`.
- No existing test was edited.

## Files

New: `src/app/defence/guide.js`, `src/app/defence/dock.js`, `src/defence-readability-view.js`, the two tests.
Edited (owned): `src/app/defence-ui.js`, `src/app/defence-entry.js`, `src/app/defence/{bar,constants,input (picked only),pads-view,result,sheets (emptySheet and the sheet key only)}.js`, `src/defence-ui.css`, `src/landscape-hud.css` (appended Defence block), `src/defence/progress.js`.
Appended: `src/locales/vi.json`, `src/view-plugins.js`, `package.json`, `.github/workflows/pages.yml`, `docs/CHANGELOG.md`.
Not touched: `armourSheet` and `armourAct` / the squad buttons (R3-C).
