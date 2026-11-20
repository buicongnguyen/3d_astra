# W1-D: Phones first-class (results)

Branch `r2/w1d-phones`, base `r2-wave-0`. Screenshots: `docs/aaa/results/round2/w1d/` (before-*/after-*).

## Acceptance (390x844 and 844x390, `tests/phones.mjs`, elementFromPoint grid 20x40, notices expired)

| Item | Before | After | Met |
|---|---|---|---|
| Portrait share, nothing selected | 59.3% | 70.1% | yes |
| Portrait share, one unit | 48.0% | 60.8% | yes |
| Landscape share, nothing selected | 66.7% | 71.4% | yes |
| Landscape share, one unit | 53.1% | 60.5% | yes |
| Campaign mission (same numbers; no dialogue showing) | same | same | yes |
| 11 px text / 44 px taps / no sideways scroll | | `layout-f` portrait, landscape, landscape-vi, portrait-vi, tablet clean | yes |
| Tank at zoom 92 on Three Roads, tight silhouette, portrait / landscape | 19.3 / 14.1 px | 30.8 / 22.6 px (infantry 10.8 / 8.4 -> 17.2 / 13.4) | yes |
| Render scenarios (12), p95 draws | wave-0 table | identical | yes |
| Golden pins, `npm test` | 710 | 720 tests, 0 fail, 15 skipped | yes |

Margins are thin: portrait "nothing selected" is 70.1%. A dialogue chip, hint or toast shows about 2 to 3% more while it is up (toasts are pointer-events none and are not counted by the grid).

## Deviations from the brief (code differs)
- Brief: tab strip 56 px. Code: tab strip 44 px plus a 16 px bottom margin; the 56 px was the slim "Awaiting your command" bar above it, now removed.
- Brief: tank 7 to 10 px at zoom 92 today. Measured 19 px (landscape 14); 7 to 10 matches infantry. P3 helps both.
- Brief: 28 px rule at 844x390. Passes with the same bounding-box measure as portrait (28.0 px minimum), not with a tight silhouette (20 to 25 px).
- Landscape keeps 12 px side margins (`mobile-gestures` guards them); an 8 px try was reverted. Idle buttons are hidden in portrait while something is selected. Info & stats leaves the landscape dock (it is in the "..." sheet; Defence keeps it). The unit card drops its status line unless on high ground, ford or air.
- `--dock-height` is now the live height of the dock (0 collapsed). `hud.js` draws the strip under a dock shorter than the camera cover (the old "undrawn under open dock" saving is lost for the short card).
- No `golden-w1d` pin: view-only package. Extra test file `tests/army-readability.test.js`.
- Unit intro cards are off in Defence (W1-F's new-enemy card), Training and under `?test` (use `?unitintros`).

## Seam requests
1. `view.js` `setCoverOpen(openHeight)`: allow a partial cover so a short dock does not force drawing the whole strip (perf).
2. `ui-theme.css` (W2-C): lines 487-498 (slim bar), 501 (`--dock-height: 202px`) and 482-484 are superseded by `landscape-hud.css` overrides; delete them.
3. `boss-ui.css:37` uses `--view-cover` (202) not `--dock-height`; move the boss bar to `--band` if wanted. `defence-ui.css:82` and `:284` already follow `--dock-height`; W1-F sets `--defence-bar-h`, which `--band` reads.

## Test changes made (my files) the integrator should know
`mobile.mjs`, `mobile-controls.mjs` (sheet), `messages.mjs` (hint in the dock band, bound 0.33 of height), `layout-f.mjs` (free share 0.65), `feel.mjs` (landscape + zoom 92). Not mine and untested here: `boss.mjs`, `hotkeys.mjs`, `missions.mjs`, `tactics-ui.mjs`, `webkit.mjs` reference `.touch-controls`/`#select-workers`; run them at integration.

## Not run
`npm run baselines:diff` was started late (view-only change; it cannot move sim baselines). Full `test:ci-local`, Defence share (integrator, after W1-F), m02b stacking check.
