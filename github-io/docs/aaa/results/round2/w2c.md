# W2-C First impression and story light: results

Branch `r2/w2c-first-impression`, port 4234. Screenshots in `w2c/` (`before-*` and `after-*`: title, battle, defence at 1440x900 High, 390x844 and 844x390 Eco; themes riverlands/highlands/dunes/basin on desktop and phone; m08 night, m10 storm, m06 at 16:15 on High and Eco). Tool: `tools/look-shots.mjs`.

## Acceptance
| Criterion | Before | After | Met |
|---|---|---|---|
| first-visit gzip | 1,454,210 B | 1,477,287 B (+23 KB; font 24 KB) | yes (limit +80 KB) |
| render budget p95 draws, 17 existing scenarios | see below | identical in all | yes |
| `night-battle-eco` draws | - | 107 (limit 120) | yes |
| frame time, SwiftShader, median ms (title / battle) desktop | 96 / 182 | 85 / 219 | indicative only: machine loaded, run-to-run noise is larger than 10%; integrator re-measures on a quiet machine |
| frame time phone portrait / landscape (battle) | 46 / 79 | 55 / 64 | same caveat |
| 13 checksums, `check:missions --only m06,m08,m10` | | all targets met, 816 + 8 tests | yes (view only, no sim file touched) |
| precache carries the font, title offline | | `sw.js` lists both woff2; `offline` PASS | yes |
| `npm test` | 816 | 824 (+8) | one failure was the CI-matrix test, fixed with entry r2-w2c |

Baseline draws (unchanged): base-high 141, river-overview-high 170, large-map-high 218, battle-eco 107, three-rivals-eco 146, three-factions-eco 182, defence-wave-eco 109, air-battle-eco 116, boss-battle-eco 116, defence-river-eco 124, defence-carrier-eco 129, defence-big-eco 91, gunner 117, stalker 121, sovereign 113, defence-boss 116, expanded 114.

## Tests run
`npm test`; `title`, `ui-quality`, `missions`, `defence`, `offline`, `mobile`, `render-budget` (all pass on 4234). Not run: full `test:ci-local`, `phones`, `webkit`, language (integrator).

## Deviations
- Brief: grade strength 'saturation +12%' etc. as a per-theme table; built as one default plus optional per-theme overrides (`themes: {}` is empty).
- The rim is added to the emissive term of the baked material (warm colour) and of Team materials (team colour), because an extra term in the instanced shader needs no new draw. Team materials now compile their own program (cache key), not extra draws.
- Wordmark text is live SVG text in the display font (inlined), not outlines.
- Title keeps Training as a slim fourth row (the three big choices are Campaign, Skirmish, Defence).
- Existing `--font-display` consumers (HUD, dialogs) now use Baloo 2 too; tiles and stage list use `--font-tile`. Owner may want it narrower.
- No `tests/night.mjs`: the look is covered by `mission-looks.test.js`, the `night-battle-eco` scenario and screenshots.
- Lightning on Eco flashes the sky only (no light change).

## Seam requests
- `ui-theme.css` lines ~482-501 superseded rules from W1-D were not removed (low value, risk of phone layout moves).
- The orange "outland" terrain beyond the map edge stays bright at night (texture painted in `createTerrain`, not tinted by the look); a night tint there is a follow-up.

## Owner notes (O7)
Grade: `src/look-grade.json` (`strength` 0 to 1.5). Font: swap the two files in `src/fonts/` and the family in `ui-theme.css`. Night/storm colours: `LOOKS` in `src/mission-looks.js`.

## Pins and baselines
None moved.
