# W2-F: Campaign showtime (results)

Engineer W2-F, branch `r2/w2f-showtime`, based on tag `r2-wave-1`, port 4237. Nothing pushed, merged or deployed.

## What the player gets
- A title card on every mission, Chronicle mission and Defence level ("ACT I · LANDFALL · DAY 1", title, place).
- Boss presence for any boss (m03's Iron Vanguard today): x1.5, footfall dust and shake, a name card, "<name> destroyed", full combat music while it is awake, and a 1.2 s slow-motion end beat when its fall ends the match.
- m11c "Hold the Keystone Roads" (optional, Act 3) with the first two Gunner teams in the story.

## Acceptance numbers
| Criterion | Number | Met |
|---|---|---|
| 13 existing mission checksums unchanged | `tests/wings.test.js` passes; m11c recorded as `8b3c253d` | yes |
| `check:missions` rows of the existing missions (Standard, full run) | 45 rows identical to `baseline/missions-standard.json`; 3 new m11c rows | yes |
| m11c, Story / Standard / Veteran | 3 / 3 / 2 stars (targets 3 / 2 / 1); Story 531 s, Standard 571 s, Veteran 643 s; passive loses at about 126 s on all three | yes |
| Lent Gunners pin a Scrapper group (Standard bot run) | 6 pinned shots on 5 Scrappers and 1 Ranger; both Gunners alive at the end (`tests/keystone-roads.test.js`) | yes |
| `golden-w2f` | m11c DefenceBot 120 s: wave 2, 20 lives, `a929add0`; `GOLDEN_FULL`: whole mission, victory, 18 lives, `a0e890fc` | yes |
| Golden pins identical | `npm test` 827 tests, 808 pass, 19 skipped, 0 fail (before: 816 / 798 / 18 / 0) | yes |
| Boss at zoom 30 vs a Battle tank | 168 px vs 56 px = 3.0x (2.3x required) at 1440x900; same check on both phones in `tests/showtime.mjs` | yes |
| Debrief after the boss's death ends the match | end beat 0.7 s pan + 1.2 s hold = 1.9 s; the test requires 1.4 s or more | yes |
| Title card covers no control on 3 viewports | `elementFromPoint`-style box test over every visible control, text 11 px or more | yes |
| `boss-battle-eco` draws | 116 (limit 120, unchanged from wave 1); `battle-eco` 107, `boss-sovereign-eco` 113, `defence-big-eco` 91 | yes |
| Tests added | 13 node tests (11 in `tests/keystone-roads.test.js`, 2 in `tests/golden-w2f.test.js`) plus the 3-viewport browser suite `tests/showtime.mjs` | yes (at least 12 with the browser suite) |

m11c tuning: alloy 420 / 330 / 290 and counts x0.9 / x1.35 / x1.5 (Story / Standard / Veteran), found in 5 bot passes against the first draft (which was too easy: 3 stars on Veteran). The generic single-crew bot loses on Standard.

## Browser suites (port 4237, build)
`showtime` PASS (36 s), `boss` PASS, `story` PASS (after the 16-relay update), `campaign` PASS, `ui-extras` PASS. Screenshots in `docs/aaa/results/round2/w2f/`: title card, boss scale, boss entrance (with the name card inside the scene) and the campaign map with the m11c node, each at desktop, portrait and landscape.

## Deviations and where the brief was wrong
- The m03 entrance scene already opens when the boss wakes, so the wake name card would sit under the scene. The `title` beat is the entrance card there; the plugin's card appears only when no scene is open.
- The end beat also uses the last `bossDefeated` seen within 3 s (kept in `ui-extras.js` `factionEvent`), because the fall and the win can land on different ticks.
- Under reduced motion the app turns off all animations and transitions (`:root.motion-off`), so the title card's fade uses an `!important` opacity transition of 0.3 s; the boss name card just appears.
- `vi.json` patterns: the existing last pattern entry had its "Speed" pair inside the same array as the roster pattern, so that pair never loaded; I left it alone and appended my five as separate entries (reported, not fixed).
- No new render-budget scenario: m11c uses the same Three Roads map and objects as `defence-big-eco`, which stays at 91 draws.

## Seam requests
None.

## Test changes for the integrator
All are in files this package owns or that the brief's missions change: `tests/gunner.test.js:58` excludes m11c from "no mission names the Gunner" (done here); `tests/missions-data.test.js`, `wings.test.js`, `story-scenes.test.js` and `story.mjs` count 16 missions. `baselines:diff` will show `missions-standard`, `missions-story`, `missions-veteran` and their mercy/firm variants with new m11c rows only; all existing rows are identical. The integrator re-records those files and adds m11c to `golden-round2`.

## Owner notes
- m11c is optional by design: it never locks m12 and never changes an ending.
- Round 3 adds the Rampart to wave 9 with a re-pinned m11c checksum.
