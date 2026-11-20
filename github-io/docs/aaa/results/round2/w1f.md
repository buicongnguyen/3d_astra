# W1-F: Defence command deck (results)

Branch `r2/w1f-defence-deck`, base tag `r2-wave-0`, port 4237. Engineer: Claude. Status: done, with one number open: landscape 28 px (below).

## What the player gets
- Fast-forward on the Defence bar (44 px) and Shift+Space: x1, x2 (x3 with a mouse). Space still pauses, G still toggles the grid.
- An Aim tile on every tower: Nearest, First, Strongest, Air.
- Trait chips on the next-wave strip; a new-enemy card the first time a type is in a wave (traits and two counter crews); tower stats as text (dps, reach, x vs armour, air, next-tier change).
- On phones Defence opens at road zoom (55) and follows the wave front; the Overview button became a View button (Follow, Overview, Free; desktop skips Follow); the bar is still one row of at most 56 px.

## Acceptance
| Criterion | Number | Met |
|---|---|---|
| `check:defence --json` identical to the post-W0 baseline | 28 rows, PASS, byte-identical rows before (100 s run) and after | yes |
| Golden pins identical | `npm test` 730 tests, 715 pass, 15 skipped (long pins), 0 fail; `d071360b` and the 13 checksums hold | yes |
| `baselines:diff` (fast set) | `missions-standard` identical (133 s), `defence` identical (98 s) | yes |
| `defence-big-eco` 112 draws or fewer | 91 p95 (was 106). It dropped because the scenario is a phone and now opens at zoom 55, so less of the map is drawn; speed does not change draws | yes |
| Other scenarios | `battle-eco` 107 and `defence-wave-eco` 109, both unchanged | yes |
| Bar at most 56 px tall in portrait on 390x844, no sideways scroll, controls at least 44 x 44 | 52 px on Gorge Road and Three Roads (7 controls, 374 px wide bar inside the 8 px gutters); every control at least 44 x 44; no sideways scroll at the three viewports | yes |
| `golden-w1f.test.js` | Gorge Road, DefenceBot plus padAim `first`/`strong`: wave 3 `b2b14c54` (5 towers aimed), wave 6 `8d7902a4` (8 aimed) | yes |
| Test count +15 | 710 to 730 (+20: 19 in `tests/defence-deck.test.js`, 1 golden) | yes |
| Determinism through the real frame loop | x3: 60.0 s of match in 20.0 s (3.00x), 1,201 ticks; x2: 60.0 s in 30.0 s (2.00x), 1,201 ticks; the command log (Call twice, a tower) replayed without the frame loop gives the same hash in both | yes (see deviation 1) |
| Tower sheet readable with no hover at 390x844; 11 px and 44 px audit | stats text inside the sheet without scrolling at 390x844 and 1440x900 (landscape scrolls in its small dock, as the 6-tile pad sheet already does) | yes |
| View button cycles its 3 states | phone: follow, overview, free, follow; desktop: free, overview, free | yes |
| 28 px unit rule in Defence at the new phone zoom | portrait 390x844: a Vanguard is 33.0 px tall at zoom 55 (asserted). Landscape 844x390: 17.2 px (recorded, not asserted: it needs W1-D's unit scale) | portrait yes, landscape no |

## Before and after (screenshots in `w1f/`)
`before-*` are the base build, `after-*` the new one: `d-gorge` and `d-crossroads` x `desktop`, `portrait`, `landscape` x `open`, `wave`, `tower`, plus `sheet-*` (the tower sheet). `defence-deck-*` come from the new suite (bar, sheet, card; Three Roads portrait).
Bar before: 339 (Gorge) and 374 (Three Roads) px wide, 52 px tall at 390; zoom 70 and 92. After: zoom 55 on phones, bar 324 and 374 px with the speed button added.

## Tests run
- `npm test`: 730 / 715 / 0 fail / 15 skipped.
- Browser, port 4237: `defence-deck` PASS (63 s), `defence` PASS, `defence-zones` PASS, `hotkeys` PASS, `ui-quality` exit 0, `story` PASS, `language` PASS.
- i18n tests green (`vi.json` gained 49 messages and one pattern).

## Pins and baselines moved
None.

## Seam requests
None. (`app/defence-entry.js` was not needed: `defence-ui.js` keeps its own two-line copy of `hasSeen`/`recordSeen` because importing `defence/progress.js` there made the bundler split a 183 kB shared chunk out of the main bundle.)

## Test changes for the integrator
None.

## Deviations from the brief
1. **Replay in the same browser, not in Node.** Chrome and Node differ in the last bit of `Math.atan2` (a tower's `angle`), so a Node replay of a browser match can never match bit for bit (found by diffing the states: one key, one ulp). The suite replays the logged commands headless inside the same page (`sim.constructor`), which is what proves the frame loop's speed is neutral.
2. Healer chip reads `support` or `heals` (Medic and Engineer have `support`; only the Supply wagon has `heals`).
3. "First" aim ranks by road metres left to the exit (from the route leg and position) so routes of different length compare fairly.
4. New-enemy cards are off under `?test` unless the URL has `?enemycards` (the ability-hint convention), so older suites are untouched.
5. On a desktop the View button skips Follow, so its first tap is still the Overview (`tests/defence-zones.mjs` relies on it).

## Owner notes
- The speed resets to x1 at every scene, decision and new match (by design).
- The card queue shows one new type at a time; a wave that introduces three new types shows three cards in turn.

## Open items
- Landscape 844x390: units are 17.2 px at zoom 55 until W1-D's unit scale (P3) is merged; the integrator should re-measure after the merge.
