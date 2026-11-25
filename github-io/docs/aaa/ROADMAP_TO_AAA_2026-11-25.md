# Road to AAA (2026-11-25)

Baseline: re-score 6.3 / 10 (game-aaa-scorecard, 32 parts, 2026-11-25). AAA bar here = every part 8+, none under 7.
Rules for every item: phone first (frame budget and draw calls must not rise; perf gates in render-budget), never harder on
Relaxed/Normal (difficulty-check, check:defence), no hidden or grouped buttons, 11 px / 44 px, EN/VI/KO, golden pins
re-recorded only by the integrator with a reason, one agent per worktree.

Status: todo / doing / done (commit).

## Weakest parts first (score now -> target)

| # | Work item | Parts it lifts | Now | Status |
|---|---|---|---|---|
| W1 | Unit review of every faction: wrong models, floating, droop, colour, readability; fixes + art wish list | Unit models 6.6, Faction identity 4.5, Animation 5.5 | | done (5e3df81): 35 types reviewed; bars, wheels, Scorcher droop fixed; art wish list in W5 |
| W2 | Buildings on high ground drawn at the right height; plateau shape analysis | Terrain 6.8, Stability 7.6 | | done (4207abc): ghost/markers on plateau tops; rounded-rect mesas = owner decision |
| W3 | Voices: unit acknowledgements, announcer (base under attack, unit lost, objective), story lines; per-faction tone; EN first, VI/KO subtitles; switchable off | Voices 2.0, Audio 6.0, Faction identity | | done (claude/voices): replies, announcer, mission 1 story lines, 5 faction voices; owner listen pass open |
| W4 | Animation pass: hit flinch, death falls/wrecks, kneel-to-fire for more infantry, mech heavy walk, air bank/landing | Animation 5.5, VFX 6.8, Polish | | done on claude/animation (hit flinch + hull rock, three seeded infantry falls, firing stances, heavy walk, Sovereign tripods, flyer dip/flare); not merged. Notes below. |
| W5 | Faction identity: per-faction silhouettes and palettes, signature unit per faction, faction UI accent, faction music stinger (models via Codex briefs or agents) | Faction identity 4.5, Unit models | | todo (after W1 list) |
| W5a | Field Guide 3D view of each unit: real model, orbit/zoom, Idle / Walk / Fire, team colour, Ranger for scale; lazy chunk, disposed on close | Faction identity, Unit models, UI | | done (claude/unit-viewer) |
| W6 | Replay value: challenges (C7.1), medal cosmetics (C7.3), achievements 13 -> 25, match history and replay viewer (B2-B3) | Replay 5.3, Content | | done on claude/replay-meta (5ec39af achievements, a6e9f1b challenges, 0edc26d cosmetics, 30494b6 history, 82fa2d1 replays); not merged. Notes below. |
| W7 | Depth: second doctrine tier, special weapons plan, abilities for Hawk / Balloon / Glider | Balance & depth 5.0, Content 5.4 | | todo |
| W8 | AI quality on Fast / Relentless only: focus fire, retreat wounded, flank, use abilities, scout with Kites; Relaxed/Normal untouched | AI quality 5.0 | | todo |
| W9 | Content: C6 missions (4 of 6-8), story scenes (2 of 8), new lands (snow / volcano / water), Ember Drake boss, Ancient ruins | Content 5.4, Campaign 6.0 | | todo |
| W10 | Defence mode: more maps, enemy variety, commander abilities shown in waves, Endless leaderboard (local) | Defence 6.2 | | todo |
| W11 | Multiplayer: 1v1 over WebRTC with lockstep (the sim is deterministic and hashed), room code to share, no server of our own beyond signalling; then co-op vs AI | Multiplayer 1.2 | | todo (owner decision: signalling service) |
| W12 | Audio: SFX pass (weapon families, impacts by armour, UI clicks), mix ducking for voices | Audio 6.0 | | done (claude/voices): metal impacts, infantry falls, 6 new weapon voices, 13 ability casts, UI clicks, eco voice caps, voice ducking |
| W13 | Phone HUD chrome ~35 % -> under 30 %, minimap side choice on phones, left-handed layout, two-finger camera twist | UI phone 7.3, Controls 6.9, Accessibility 6.9 | | todo |
| W14 | Small fixes from audits: lake fords slow units, Page Up/Down in help, landscape word breaks | Polish 7.1 | | todo |

## Order
1. Now: W1, W2 (running), W3 + W12 (audio, no overlap with view code), W6 (meta/UI, no overlap).
2. After W1: W4, then W5 from W1's art list.
3. Then W7 and W8 (both move golden pins: one at a time), W9, W10, W13, W14.
4. W11 needs the owner's yes on a signalling service (free PeerJS cloud or a tiny worker).
5. Re-score after each wave; record the score here.

## W6 notes (2026-11-25)
- Built: 12 new achievements (25) with toast, Records screen and results row; three daily challenges seeded from the local date (direct title tiles, +50 XP each, challenge days); nine medal cosmetics (paints, emblems, banners) picked in the Skirmish setup's Commander rows; match history (20) and a replay viewer (3 stored, x1/x2/x4, final-hash check, other versions refused). Storage keys: docs/ARCHITECTURE.md "Replay value storage (W6)".
- Golden pins identical (no simulation change). The replay needs the options each match was built with, remembered beside it in createSim (`src/main.js`), not a save's options: a mission's AI speed is adjusted when built and some missions raise it in play.
- Choices made without the owner (easy to change): challenges are a daily set of three (plan C7.1's per-mission challenge is not built; the brief asked for a rotating daily set); challenge XP is 50 each; a match continued from a save keeps no replay; the replay viewer has no timeline scrub or fog toggle (plan Stage 5.4 extras); unlock thresholds in `src/meta/rewards.js`.
- Owner to check: VI/KO wording of the new strings; whether the challenge strip on the phone title pushes the mode row down too far (it sits under the quick row).

## W4 notes (2026-11-25)
- Built (view only, golden pins identical): impact-driven hit flinch (infantry spring, hull pitch + roll rock, scaled by the share of health taken, direction from `hitBy`); three seeded infantry falls (back / knees / twist; Rider always tips) that lie still then sink; firing stances (`STANCE`: hunch, rock back, half-crouch brace for Walker and Bulwark); heavy walk dip, nod and sway on the stride phase; Iron Sovereign tripods that step with planted feet (they moved only centimetres in real play before); flyer speed-up dip and braking flare. Vehicle wrecks and flyer crashes already existed and were kept.
- Phone (300-unit live fight, 390x844, CPU x4, eco): main-thread median 16.6 ms before and after, 92 draws both.
- Choices made without the owner: the Walker and Bulwark brace rather than kneel (the roster test keeps them out of KNEELERS); infantry bodies stay 2.4 s (1.8 s Eco) and share the existing 24-model death cap; the Sovereign's leg sweep is capped at 0.5 model units so the rigid tripods stay on the dome (feet slip about a fifth of a step at its march). Kites and Hawks never land in the sim, so the "landing flare" is the braking flare into a hover.
