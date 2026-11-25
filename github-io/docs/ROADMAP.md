# Roadmap

One status table for everything that was planned, newest first. Last checked 2026-11-20 against the tree at tag `r2-wave-2` (the clean-up wave is being merged). `package.json` says 0.19.1; the CHANGELOG labels the next release 0.25.0 and the owner decides the number at deploy (O17). Nothing of AAA round 2 is deployed yet.

| Work | Plan | State | Where to read more |
|---|---|---|---|
| Clean-up wave (CW-A to CW-F): split `sim/defence.js`, shared rng, spatial grid, flatter AI ticks, source-text tests, `app/defence-ui.js` split, docs | [aaa/AAA_ROUND2_PLAN.md](aaa/AAA_ROUND2_PLAN.md) | In progress, behaviour-neutral. CW-F (Defence interface split, this documentation pass) is done on its branch | the plan's "Clean-up wave" section |
| AAA round 2, Wave 2: Rampart and facing armour, Heroic Defence and elites, title and story light, Field command AI plan, battle feel, m11c | the same plan | Merged and tagged `r2-wave-2`; not deployed | [aaa/results/round2/wave-2.md](aaa/results/round2/wave-2.md), [aaa/results/round2/review-packet.md](aaa/results/round2/review-packet.md) (owner decisions) |
| AAA round 2, Wave 1: Expanded roster and workshops, Gunner, Stalker, ability UI from data, boss engine II and the Iron Sovereign, phones first-class, Defence command deck | the same plan | Merged and tagged `r2-wave-1`; not deployed | [aaa/results/round2/wave-1.md](aaa/results/round2/wave-1.md) |
| AAA round 2, Wave 0: golden pins, baseline tools, view and content seams, status core, promotion fix (D1) | the same plan | Merged and tagged `r2-wave-0`; not deployed | [aaa/results/round2/wave-0.md](aaa/results/round2/wave-0.md), [CONTENT_SEAMS.md](CONTENT_SEAMS.md), [VIEW_PLUGINS.md](VIEW_PLUGINS.md) |
| Round 3 plan (2026-11-13): Hold the Line, Frontier Defence, Wings (air), Choices, Story you see, Chronicles, Defence complete | [aaa/PLAN_ROUND3_REFINED_2026-11-13.md](aaa/PLAN_ROUND3_REFINED_2026-11-13.md) | Done (0.16.0 to 0.19.1). Dropped or open: Copper Basin ford, voice tones, twin rivers; Endless pacing and faction balance need play-testing | [aaa/IMPLEMENTATION_PROGRESS.md](aaa/IMPLEMENTATION_PROGRESS.md) |
| Improvement round 1 (feel, sound, enemy AI that attacks well) | [aaa/IMPROVEMENT_PLAN_2026-11-13.md](aaa/IMPROVEMENT_PLAN_2026-11-13.md) | Done (0.14.0 items 1 to 4, 0.15.0 item 5) | CHANGELOG |
| AAA stage 6, Ship (phone round, install, multiplayer hand-over) | [aaa/STAGE_6_SHIP.md](aaa/STAGE_6_SHIP.md) | The phone layout was redone in AAA round 2 (W1-D: at least 70% of the screen is battlefield). Physical iPhone and Android tests are still required | [TESTING.md](TESTING.md) |
| AAA stage 5, Replay (achievements, challenges, skirmish options, replay viewer) | [aaa/STAGE_5_REPLAY.md](aaa/STAGE_5_REPLAY.md) | Not built as a stage. Related pieces shipped: Endless, Daily seed, perks and Heroic challenges in Defence; Roster and AI plan options in Skirmish | CHANGELOG |
| AAA stage 4, Story | [aaa/STAGE_4_STORY.md](aaa/STAGE_4_STORY.md) | Done (0.19.0, with Chronicles), extended in round 2 by title cards and m11c: 16 campaign missions and 4 Chronicles | [WORLD.md](WORLD.md), [MISSIONS.md](MISSIONS.md) |
| AAA stage 3, Battlefield | [aaa/STAGE_3_BATTLEFIELD.md](aaa/STAGE_3_BATTLEFIELD.md) | 3.1 height and straight walls done (0.13.0); air units done (0.18.0). Cover, weather and the map rework not built | CHANGELOG |
| AAA stage 2, Factions | [aaa/STAGE_2_FACTIONS.md](aaa/STAGE_2_FACTIONS.md) | Done (0.12.0, 0.12.1): four factions in Skirmish and the campaign, Rider unlock, faction bench. The round-robin balance target is still open | [BALANCE.md](BALANCE.md) |
| AAA stage 1, Feel | [aaa/STAGE_1_FEEL.md](aaa/STAGE_1_FEEL.md) | Pushed; the owner's play and listening review is pending | CHANGELOG |
| Online multiplayer | [INTERNET_MULTIPLAYER_PLAN.md](INTERNET_MULTIPLAYER_PLAN.md) | LAN play built (W11: lockstep over a host server on the home network, 1v1 and co-op vs AI); internet play not started | [LAN_PLAY.md](LAN_PLAY.md) |
| Naval maps | [naval/NAVAL_PLAN.md](naval/NAVAL_PLAN.md) | Plan only | |
| Rebuild plan phases 0 and A to F | [REVIEW_AND_REBUILD_PLAN_2026-11.md](REVIEW_AND_REBUILD_PLAN_2026-11.md) | Done (0.2.0 to 0.9.4): rules fixes, command layer, save and replay, mission engine, veterancy and abilities, rules depth, story and campaign, the look, in-house music and sound, phone landscape, client restructure, staged loading and offline. Left from then: smaller model files and moving the other browser scripts onto the shared harness (`tests/lib/harness.mjs`) | CHANGELOG 0.2.0 to 0.9.4 |

## Known gaps
- Mission times swing by minutes with small data edits; `npm run check:missions` guards the winnable range.
- Not tested on a physical phone; all phone checks use browser emulation.
- Open owner decisions of round 2 (default Roster and AI plan stay Classic, Ashfall at 37.5% in the Expanded bench, night outland tint, missing review captures): see [aaa/results/round2/review-packet.md](aaa/results/round2/review-packet.md) and [aaa/IMPLEMENTATION_PROGRESS.md](aaa/IMPLEMENTATION_PROGRESS.md).
