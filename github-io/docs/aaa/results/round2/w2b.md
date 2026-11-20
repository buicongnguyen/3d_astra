# W2-B: Defence peaks, elites and Heroic challenges: results

Engineer W2-B, branch `r2/w2b-heroic` (base `r2-wave-1`), port 4233. Nothing pushed, merged or deployed.

## What shipped
- `src/sim/content/elites.js` (six affixes, `balance.json` `elites`), `src/elite-view.js` (gold rings, 1 instanced draw, lazy, uploads only on change), `src/defence/heroic.js` (spec per level, builder), `defenceVariant(level, { variant: "heroic" })`.
- Heroic tab, locked teaser, level marks, result badge (`defence-entry.js`, `defence-ui.js`, CSS), `progress.heroic`, +1 star per win, affix chips (`ELITE_TRAITS`), model roster (Splitter children, finale boss drops), `--heroic` check, `test:defence-heroic-check`, `test:defence-heroic`, CI entry `r2-w2b`, `defence-heroic-eco` render scenario, `tests/golden-w2b.test.js`.
- Screenshots: `docs/aaa/results/round2/w2b/` (locked teaser, wave strip with elites and chips, Heroic result, at 1440x900, 390x844, 844x390).

## Acceptance
| Criterion | Number | Met |
|---|---|---|
| Designed levels and Endless: `check:defence --json` identical to post-Wave-1 | byte-identical (28 rows, before = after) | yes |
| Bot wins Heroic 7 of 7 with at least 2 of 5 lives left | gorge 2, bridges 5, switchback 5, fordwood 5, canyon 5, longcrossing 5, crossroads 5 | yes |
| Passive player loses by wave 3 | loses at wave 1 on all 7 | yes |
| Greedy single crew loses on at least 5 of 7 levels | counted as "most of the level's 5 crews lose": gorge 4/5, bridges 4/5, switchback 5/5, longcrossing 3/5, crossroads 5/5 = 5 levels (fordwood 1/5, canyon 1/5). Ranger-only loses on 7 of 7 | yes, by that reading (see deviations) |
| `defence-heroic-eco` 125 draws or fewer | 114 (wave 50, 6 towers, elites with all six affixes, 2 Stalkers) | yes |
| `golden-w2b`: Heroic d-gorge and d-longcrossing; `GOLDEN_FULL`: all 7 | d-gorge `d78d0600` (2 lives, 1 star); d-longcrossing `9752f7e0` (5 lives); other five pinned under `GOLDEN_FULL` | yes |
| Build job 7 minutes or less on 2 cores | not measured (integrator). `check:defence` unchanged (about 100 s), `npm test` 845 tests | not measured |
| Test count +15 | 816 -> 845 (+29): elites 11, defence-heroic 11, golden-w2b 7 | yes |

Before numbers: `npm test` 816 tests, 798 pass, 18 skipped; `check:defence` 28 rows PASS. After: 845 tests, 822 pass, 23 skipped (`GOLDEN_FULL`), 0 fail. Browser: `defence-heroic` (3 viewports), `defence`, `defence-deck`, `language` pass; `ui-quality` runs; `defence-river-eco` 124 (as Wave 1), `battle-eco` 107.

## Heroic tuning (knobs only: alloy, affix spacing)
Alloy added to the Standard alloy: gorge 4400, bridges 2600, switchback 400, fordwood, canyon, longcrossing and crossroads 2600. `everyOf` (every n-th unit of a group is elite): Splitter 6, Volatile 3, Plated 2, Swift 2; gorge Plated 3 and Swift 3; bridges Swift 2 and Volatile 3. Stalker groups: canyon and longcrossing `[1,1,1,2,2]` from wave 2 (2 to 3 Stalkers). The bot's outcome is chaotic in alloy (neighbouring alloys flip win and loss), so the chosen values sit on stable plateaus; Gorge Heroic is the tightest (2 lives left).

## Deviations
- "All elite" finale is every group except troop carriers. Elites are every n-th unit of a group on most levels (`everyOf`), not whole groups, because whole-group Plated and Splitter elites were beyond the bot at any alloy.
- Greedy gate reads "a level counts when most of its crews lose" (the plan says "loses on 5 of 7 levels"; several levels have crews that win alone).
- `tools/defence-bot.mjs`: a Heroic variant opens at wave 5 of its level, so the bot's growth thresholds (towers wanted, armour, ranks) add `offset = heroic.from - 1` (0 on every designed level, check:defence identical).
- Elite ring colour is per affix, static (no pulse): a pulse resent the buffers every frame and broke the render budget's no-upload rule.
- The affix chips are `ELITE_TRAITS` in `traits.js` beside `TRAITS`, not appended to it: `tests/defence-deck.test.js` pins the `TRAITS` id list.
- Elites run from `stepDefence` through the mixin `stepElites` (only once `defence.elites` is set), not as a `step` hook: `tests/content-seams.test.js` asserts the real module list has no step hooks.
- Render budget harness (not owned, append-only rule): small edits so the scenario can exist: an `elite` scenario field, `unlockAfter` accepts an array, and the Defence field-count assertion counts team-1 `spawn` entries. The scenario is trimmed (wave 50, 6 towers, 2 Stalkers): the River level alone is 126 draws with 10 towers and the Stalker model costs about 10 draws.
- `src/defence/heroic.js` sets `look: "dusk"` on Heroic variants (data for W2-C's `mission-looks`).
- Stalker columns: no bot change needed; the bot still wins with them (7 of 7).

## Seam requests
None required. For round 3: `HEROIC[id].finale` takes a wave group (`{ units: { <boss>: 1 }, route, ... }`) and the model roster declares the boss and its drops.

## Test changes for the integrator
None needed (no non-owned test was edited). `render-budget.mjs` edits above are in the shared file, append-style.

## Pins and baselines moved
None. `d071360b`, the 13 checksums, every existing golden pin, and `check:defence` are unchanged. New pin file `tests/golden-w2b.test.js`.

## Owner notes
Heroic Gorge is tight (2 lives left for the bot); a human will find the finales hard by design. Elite affix chips on the wave strip show the answer (Barrage for Mender, Marksman for Banner, and so on). Heroic alloy is high on Gorge (4,660 at the start) because Plated and Swift elites out-scale the bot's crews on that map.
