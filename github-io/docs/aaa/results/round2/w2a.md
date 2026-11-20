# W2-A: Rampart ram tank, facing armour and the Outrider drill: results

Branch `r2/w2a-rampart` (base `r2-wave-1`), port 4232. Nothing pushed, merged or deployed.

## Acceptance

| Criterion | Number | Met |
|---|---|---|
| Rampart hit only from behind dies >= 1.8x faster than from the front | 2.5x (x1.5 / x0.6), `tests/facing.test.js` | yes |
| Drill duels (10 battles, 1,500, Expanded minus Classic): Vanguard, Scrapper, Shade >= +0.25; Ranger within 0.05 | +0.27, +0.36, +0.31; Ranger 0.00 | yes |
| 600 s Expanded soak: no more Rider stalls than Classic | 0 stalled Rider ticks in both (the matches ended at 243 s Expanded, 144 s Classic) | yes (short samples) |
| Expanded bench (120 matches, `--jobs 3`): every faction 25 to 75% | Meridian 54.2, Ashfall 37.5, Sunward 68.8, Wardens 52.1, Veil 37.5 | yes |
| Ashfall >= its Classic 40% | 37.5% (Ashfall vs Sunward 1 of 12) | **no** |
| Sunward >= its Classic 38% | 68.8% | yes |
| Each workshop unit fielded in >= 50% of Expanded AI matches over 8 min | Gunner 2 of 2, Stalker 1 of 1, Rampart 1 of 2 (36 matches, only 5 lasted over 480 s; `.tmp` probe) | yes, tiny sample |
| `battle-expanded-full-eco` <= 150 draws | 149 (battle-eco 107, unchanged) | yes |
| `golden-w2a.test.js`: Rampart flank sandbox with one Ram, drill sandbox; 30 and 60 s | rampart `4b722ec9`, `8d38668e`; drill `da962f95`, `8210b34a` | yes |
| Classic baselines identical | `npm test` pins, `d071360b` and the 13 checksums hold; `baselines:diff` below | yes |
| Test count +18 | 816 to 854 (+38): facing 9, rampart 9, outrider 12, expanded-roster 6, golden 2 | yes |
| Rampart model <= 6,300 triangles, no more materials than the Battle tank | 5,848 triangles, 7 materials | yes |

Expanded bench before (integrator, `baseline/bench-expanded.json`): Meridian 31, Ashfall 20, Sunward 17, Wardens 33, Veil 19 wins of 48. After: 26, 18, 33, 25, 18 (`bench-expanded-w2a.json`). The drill turns Sunward from the weakest into the strongest faction in AI play (Sunward vs Meridian 2 to 7 of 12). Ashfall vs Sunward is 1 of 12 whatever the Rampart's economy (3 of 12 with the drill off). Six bench runs: the first drill numbers (back 3 m, every 1.5 s) gave Sunward 70.8%; a gentler drill passing the duel gate (back 3.6, every 2) gave 68.8%; the gate and the bench cannot both be met by drill numbers alone. Rampart economy changes (level 3 to 1, 250/90 to 200/70, 28 to 22 s, want after 480 to 150 s) lifted Ashfall from 33.3 to 37.5%; a stronger variant (180/60, up to 3) lowered it. Four attempts used; stopped. **Owner/integrator decision:** accept Ashfall at 37.5%, or soften the drill further (below +0.25 duel gain) or give Ashfall an answer to Riders in round 3.

## Wave-1 economy fields
None changed (`gunner`, `stalker`, `workshop`): `golden-expanded` need not be re-recorded for W2-A.

## Deviations from the brief
- Rampart `required_level` 1 (brief 3), cost 200/70, time 22 s, AI `after` 150: bench-tuned (the Salvage yard is levelled only by the Expanded AI, which rarely reached level 3 before matches ended). Description and Vietnamese say no level.
- Drill `back` 3.6 and `every` 2 (brief 3 and 1.5): see above. The step is a plain walk in the `fight` hook (nav `canStand` + `canTraverse`, 0 / +-35 degrees), `e.drill = { at, to?, until? }` lazily.
- Wall bonus is a data field `wall_bonus` read by the Rampart module (kind "wall" is not a building, so `building_bonus` does not apply).
- Ram marks its first contact with a buff flag key `ram` (deleted when the buff ends) and applies the 80 through `applyDamage` in `onHit`.
- Field guide edit: `balance.json` is imported for the drill numbers.

## Tests run
- `npm test`: 854 tests, 836 pass, 18 skipped (GOLDEN_FULL), 0 fail.
- Render budget on 4232: `battle-eco` 107 draws (identical), `battle-expanded-full-eco` 149 (limit 150, triangles limit 400,000 on its own line, 370,566 measured).
- `baselines:diff` (fast set): see the end of this file.
- Not run: browser suites and the check:missions / check:defence tools (no gating, AI or Defence code changed; `d071360b`, the mission checksums and the Defence pins are in `npm test`).

## Seam requests
- None blocking. `view.js` has no Rampart-specific rig tuning (the `tank` shot is used; W2-E styles it). The Rampart shows no portrait (as planned).

## Test changes for the integrator
- None. `golden-expanded` stays as recorded (no Gunner, Stalker or workshop economy field moved). Note: AI matches with the Expanded roster now differ for Ashfall and Sunward, so `golden-round2` (to be recorded after Wave 2) is the first pin that covers them.

## Owner notes
- Models carry "pending owner review (round 2)". Preview sheets: `w2a/rampart-game.png`, `w2a/rampart-hero.png`.
- A stray empty `C:\.tmp\prev` from an earlier package's Blender runs still exists (not mine).

## baselines:diff
`npm run baselines:diff`: missions-standard identical (162 s), defence identical (98 s).
