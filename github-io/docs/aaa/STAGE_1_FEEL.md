# Stage 1: prove the feel

Read [README.md](README.md) first. Goal: fights are satisfying to watch and every player finds a difficulty that fits. No new content. Release as 0.10.0.

What already exists, so do not rebuild it: `src/fx.js` has muzzle flashes, tracers, shells, rockets, sparks, fireballs, smoke, shockwaves, scorch decals, debris and shield ripples; `src/view.js` (`updateDying`) sinks buildings and throws vehicles; settings have `combatMotion` (off = reduced motion) and `quality` (`eco` or `high`).

## Package 1.1: combat feedback

**Goal.** A hit is felt, and units read clearly from the game camera.

**Work**
1. **Camera shake.** New `src/camera-shake.js`: a trauma value 0..1 that decays at 1.6 per second; offset = trauma squared × max offset, sampled from two sine waves (no `Math.random`). Max offset 0.35 m, max roll 0.6 degrees. `WorldView` adds the offset after it has placed the camera each frame and removes it before input reads the camera, so picking and edge-pan are unaffected.
   - Sources (from simulation events the client already drains in `src/app/frame.js`): tank or Breaker shell landing 0.25, Barrage 0.45, building destroyed 0.5, Command core destroyed 0.9. Scale by distance from the camera target: full within 12 m, zero beyond 40 m.
   - Off when `combatMotion` is false. Half strength in Eco quality. Never during a mission `camera` cue.
2. **Hit-stop.** When a Command core falls or a Barrage kills three or more units on screen, the render clock (effects and animation only) slows to 0.15 for 90 ms. The simulation clock is not touched. Off when `combatMotion` is false.
3. **Hit flash.** A unit that takes damage flashes toward white for 80 ms. Implement as a per-instance colour or a shared uniform in the entity batches, not as a material clone per unit. If the batch layout makes a per-instance flash expensive, flash only the selection ring and health bar and say so in the changelog.
4. **Readability.** Measure the on-screen height of each unit type at the default zoom on 390x844 (project the bounding box, in a browser test). Any unit under 28 px tall gets its model scale raised until it reaches 28 px, to a cap of 1.25×. Collision radius in `balance.json` does not change. Update the health-bar height if the model grows.
5. **Deaths.** Infantry currently vanish quickly: add a 0.5 s fall (tilt to the ground along the shot direction carried by the event) before the existing fade. Vehicle wrecks stay 20 s (8 s in Eco) and are drawn through the existing batch path; cap at 24 wrecks, oldest removed first.

**Files.** `src/camera-shake.js` (new), `src/view.js`, `src/fx.js`, `src/entity-batches.js`, `src/app/frame.js`, `src/visual-style.json` (all numbers above live here under a new `feel` key).

**Tests**
- Unit (`tests/camera-shake.test.js`): trauma decays to zero; offset is zero at trauma zero; the same inputs give the same offsets; nothing happens with motion off.
- Browser (`tests/feel.mjs`, new, harness-based, add to the `visual-combat` CI group): with `?test`, fire a scripted Barrage and assert the camera offset became non-zero then returned to zero by polling state; assert every unit type is at least 28 px tall at 390x844; assert with `combatMotion` off that offset stays zero.
- `npm run test:render-budget` before and after; record the numbers.

**Done when** all of the above pass and the changelog has the before/after table.

**Not in this package.** New particle types, new sounds, any rule change.

## Package 1.2: campaign difficulty

**Goal.** Each mission can be played at Story, Standard or Veteran. Standard is today's game.

**Design**
- New option `difficulty` on `Simulation` (`"story" | "standard" | "veteran"`, default `"standard"`), saved with the match.
- Numbers in `balance.json` under a new top-level `difficulty` key:

| | Story | Standard | Veteran |
|---|---|---|---|
| Scripted wave size (each unit count, rounded up, minimum 1) | ×0.7 | ×1 | ×1.35 |
| Damage enemies deal to the player's units and buildings | ×0.8 | ×1 | ×1.1 |
| AI speed | as written in the mission | as written | one step faster (relaxed→normal→fast), including scripted `aiSpeed` changes |
| Player starting alloy | +150 | +0 | +0 |
| `timeUnder` and medal times | ×1.25 | ×1 | ×1 |

- The damage factor applies in `applyDamage` (`src/progression.js`) only when a mission is running, the victim is team 0 and the attacker is not.
- Wave scaling applies in the `wave` action of `src/sim/missions.js`.
- Skirmish ignores `difficulty` (it has speeds).

**Interface**
- The campaign screen (`src/app/briefing.js`) gets a three-button segment above Start: Story, Standard, Veteran, with one line under it describing the choice. The choice is remembered per player in settings (`campaignDifficulty`).
- Progress (`src/campaign.js`, key `frontier-campaign-v2`): each cleared entry also stores `difficulty`, the highest difficulty cleared. Old entries load as `"standard"`. The mission list shows a small mark for Veteran clears. Medals are kept per mission as now (best medal at any difficulty).
- The debrief names the difficulty.

**Tests**
- Unit (`tests/difficulty.test.js`): wave sizes at each level; damage factor applies only to the player in a mission; save and load keep the difficulty; old progress loads.
- `tools/mission-check.mjs`: add a `--difficulty` argument. Targets: Story is won by the objective bot in every mission; Standard targets unchanged; Veteran is won by the objective bot in at least 10 of 12 missions within 1.5× its Standard time limit, and a passive player still survives at least 150 s. Record the table of times in `docs/BALANCE.md`.
- Browser: extend `tests/campaign.mjs` for the selector at the three viewports (sizes, persistence, Vietnamese).

**Done when** the three bot tables are in `docs/BALANCE.md` and all suites pass. If a mission cannot meet the Veteran target after tuning its numbers three times, leave it out, list it in the changelog and move on.

## Package 1.3: skirmish AI retune

**Goal.** The four skirmish speeds form an even ladder. At 0.9.3, Fast became much harder than Normal against the test bot.

**Work**
1. Extend `tools/skirmish-bench.mjs` to play the test bot (`tools/playbot.mjs`) against each speed on three maps (`classic`, `riverlands`, `dunes`) with four bot settings each (`attackAt` 12, 16, 20, 24; the simulation has no random seed, so the bot is what varies), and print win rate and median match length.
2. Tune `AI_SPEEDS` in `src/ai-plan.js` (and only that table, plus `pace`-driven constants) toward these bot win rates: Relaxed 90 to 100%, Normal 60 to 80%, Fast 30 to 50%, Relentless 5 to 20%.
3. Write the final table and the bench output into `docs/BALANCE.md`.

**Tests.** `npm test` (the AI economy and soak tests must still pass), `npm run check:missions` (missions use these speeds, so times will move: retune mission numbers only if a target fails).

**Done when** the bench shows the ladder within the ranges, or the changelog explains which range could not be met and why.

## Package 1.4: sound mix pass

**Goal.** Fix what can be fixed without ears, and prepare the owner's listening review.

**Work**
1. In `src/audio-logic.js` and `src/sfx.js`: limit identical effects to 3 voices within 80 ms (extra ones are dropped), duck music by 4 dB while more than 6 combat effects played in the last second, and vary pitch by ±4% per shot using the cosmetic seeded generator.
2. Add distinct cues if missing: unit ready, research done, building lost, objective done, objective failed, mission won, mission lost. List the cue table in `docs/ARCHITECTURE.md`.
3. Add a "Sound test" row to the settings dialog that plays each cue on tap (also used by the owner's review).
4. Run `npm run render:audio` and attach the measured peak and loudness of each cue to the changelog; nothing may clip.

**Tests.** Extend `tests/audio.mjs` (voice limit, ducking state, the sound-test row at three viewports). Unit tests for the pure logic.

**Owner step after this package.** Play with sound on and answer: which sounds are annoying, which moments are silent, does the music fit each act. Those notes become package 1.5 if needed.

## Stage 1 exit check

- `npm test`, `npm run check:missions` (all three difficulties), every browser suite, CI green.
- Changelog 0.10.0 with: render-budget before/after, difficulty tables, skirmish ladder table.
- Roadmap updated: add a "Stage" table for this plan under the existing phases.
