# W1-A results: Roster setting and faction workshops

Branch `r2/w1a-roster` (base tag `r2-wave-0`), port 4232. Machine shared and loaded; timings indicative.

## Before and after

| Item | Before (base) | After |
|---|---|---|
| `npm test` | 710 tests, 695 pass, 15 skipped | **727 tests**, 711 pass, 0 fail, 16 skipped (+17; brief asked +12) |
| `baselines:diff` (defence, missions-standard) | identical (recorded at base, `.tmp`) | identical (2 of 2) |
| `battle-eco` p95 draws | 107 | 107 |
| `battle-expanded-eco` (new, limit 125) | n/a | **114** (0 fallbacks, nothing unloaded) |
| Golden pins | all hold | all hold (none re-recorded) |
| `workshops` browser suite | n/a | PASS at 1440x900, 390x844, 844x390 |

## Acceptance

| Criterion | Number | Met |
|---|---|---|
| `baselines:diff` and all golden pins identical | pins identical in `npm test`; baselines below | yes (see Baselines) |
| `battle-expanded-eco` 125 draws or fewer | 114 | yes |
| `golden-w1a.test.js`: faction-isolated Expanded Wardens v Wardens at 180 s (`GOLDEN_FULL`: 600 s) | 60 `b7a68cbf`, 180 `834aaa89`, 600 `a7acb772`, 800 `a48e3b9c` | yes |
| Test count +12 | +17 | yes |
| Model at most 4,000 triangles, 5 materials | 3,640, 5 (Concrete, Armor, Team, Hazard, TeamGlow) | yes |

Preview sheets: `w1a/workshop-game.png` (game angle beside Foundry and Barracks), `w1a/workshop-hero.png`.

## Design notes and deviations
- `S.rules` holds only non-default choices; `createSim` passes it for a skirmish only (Wave 0 note). Remembered in its own key `frontier-command.rules.v1` (`src/app/rules-store.js`) because `settings.js` is not owned this wave and drops unknown keys. Helpers live in the new `rules-store.js`; `rule-options.js` stays a pure append-only registry.
- Continue restores `S.rules` from the save through a click listener in `briefing.js`, because `match-flow.js` is unowned in Wave 1. Seam request (optional, cleaner): in `match-flow.js` Continue, after `S.sim = loaded;` set `S.rules = loaded.rules ? { ...loaded.rules } : null;` and drop the listener.
- The AI builds the Field workshop only when Meridian has at least one workshop unit (an empty workshop is a waste); the building is always buildable by the player under Expanded.
- Units without `ai` data are never trained by the AI. Sunward and Wardens hosts are wired but have no units this round.
- Wardens AI is a slow turtle: on Dunes (Normal) its pylon completes at about 440 s, so the 180 s pin covers the early Expanded game only; the 600 and 800 s pins (`GOLDEN_FULL`) cover host levelling and training with two fixture units.
- Field guide: workshop units show "Expanded roster: trained at the X, level N" instead of "Requires level N Foundry"; hosts list their Expanded units.
- Phone/tablet layout of the Battle rules row checked by `tests/workshops.mjs` (44 px taps, 11 px text, no sideways scroll). The production card with real units is checked after B and C merge; the suite uses stand-in `trains` when none exist.

## Test changes for the integrator
- `tests/review-2026-10b-00.test.js` (owned here, already changed): the `createSim` line now carries the skirmish-only guard `...(!S.mission && S.playMode === "skirmish" && S.rules ? { rules: S.rules } : {})`. `tests/rules-hook.test.js` (W0-A) still passes unchanged.
- Merge conflicts are append-only: `balance.json`, `vi.json`, `manifest.json`, `sim/content/index.js`, `package.json`, `pages.yml` (entry `r2-w1a`), `render-budget.mjs`, CHANGELOG, BALANCE.
- After W1-B and W1-C merge, `golden-w1a` is unaffected (Wardens only). Real Meridian/Veil units train via `workshopUnitsOf`; no edit needed.

## Baselines
`npm run baselines:diff`: missions-standard identical, defence identical (both re-run after all W1-A changes).
