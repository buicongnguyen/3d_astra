# W2-E: Battle feel (weapon looks and counter hits)

Branch `r2/w2e-battle-feel` on `r2-wave-1`. Port 4236. Nothing pushed.

## What the player gets
- 16 weapon looks keyed `weapons[ev.unit] ?? weapons[ev.weapon]` inside `weaponStyle` (Scorcher flame cone, Shade beam, Drone twin pulses, Scrapper 3 pellets, Hawk pod rockets with smoke, Glider bomb, Rider twin tracers, Vanguard 3-round burst, Walker twin heavy rounds, Watcher green rail, Balloon fire bomb, Iron Vanguard and Sovereign shoulder hose, Gunner MG stream, Stalker violet beam, Rampart plough cannon with dust wake). Kinds live in `src/fx-kinds/`.
- Faction tints on shared weapons (Veil green, Ashfall orange, Wardens blue, Sunward dust).
- Ability moments: Brace shockwave, Rush/Dash/Ram dust, Overdrive exhaust, Crossfire muzzle storm, Steady aim glint, decloak shimmer.
- Counter hits flare gold with a "crit" chime; resisted hits puff grey.
- Floating damage numbers from hp+shield deltas; REAR / PINNED / PIERCE labels. Setting "Damage numbers: Bosses & Defence (default) / All / Off".
- New voices: MG, laser, pod rocket, crit (flame, rail, pellet already existed in the bank).

## Acceptance
| Criterion | Number | Met |
|---|---|---|
| fx draws stay 4 | 4 (test: root children unchanged after every kind) | yes |
| render-budget p95 draws, 17 scenarios, before vs after | 0 differences | yes |
| fx update, `battle-eco`-like scene, median of 5 held-clock runs | before 0.289 ms, after 0.233 ms (delta -0.06 ms; limit +0.2). Indicative: that scene fires base weapons, so the looks run only in the sheet | yes (integrator re-measures) |
| Audio voice caps | `test:audio` PASS (maxVoices 22, weapon 12, explosion 8) | yes |
| Golden pins / d071360b / checksums | `npm test` 810 pass, 0 fail (816 -> 828, +12) | yes |
| No per-frame allocation | slots preallocated; kinds allocate only at shot time | yes |
| Reduced motion | kinds run only with combat motion on; numbers stay still, flares off | yes |

Tests: `npm test` 828 (810 pass, 18 skipped GOLDEN_FULL), `test:visual-combat` and `test:audio` pass on 4236, `test:render-budget` PASS.

## Pins / baselines
None moved. View and audio only.

## Deviations from the brief
- 16 looks, not "about 17": the brief's list plus Gunner, Stalker, Rampart, Sovereign is 16.
- Counter hits use the shot event (it names the shooter); the impact event does not.
- `src/combat-feedback.js` hosts `DamageNumbers`/`counterKind`; the plugin only draws them (2D canvas, no WebGL draw).
- All `Math.random` calls inside `Effects` now go through `this.rng` (default `Math.random`, behaviour identical) so CW-B only swaps one field.
- The Rampart does not exist in this tree (W2-A): its style is tested synthetically; no render in the sheet.
- Stalker style `life` kept 0.42 (`tests/stalker.test.js` requires it); the beam duration is `beamLife`.

## Seam requests
- CW-B / `src/view.js` owner: set `view.fx.rng` to the per-match seeded generator in `WorldView.reset()`.
- Optional (view.js, W2-C): `view.js:1304`/`1315` still call `weaponStyle(event)` without a faction (shot-flight time and recoil are unaffected by tints).

## Test changes for the integrator
None needed.

## Screenshots
`w2e/weapons-before.png`, `w2e/weapons-after.png` (held-clock contact sheet, same camera), `w2e/battle-numbers-counter.png` (damage numbers, gold counter flares).
