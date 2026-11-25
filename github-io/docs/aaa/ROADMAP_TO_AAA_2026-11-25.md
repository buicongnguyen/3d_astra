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
| W2 | Buildings on high ground drawn at the right height; plateau shape analysis | Terrain 6.8, Stability 7.6 | | done (4207abc): ghost/markers on plateau tops; rounded-rect mesas = owner decision. Hills mix (claude/hills-mix): `rbox` plateaus on 6 Skirmish maps, 3 kept round; see "Hills mix notes" |
| W3 | Voices: unit acknowledgements, announcer (base under attack, unit lost, objective), story lines; per-faction tone; EN first, VI/KO subtitles; switchable off | Voices 2.0, Audio 6.0, Faction identity | | done (claude/voices): replies, announcer, mission 1 story lines, 5 faction voices; owner listen pass open |
| W4 | Animation pass: hit flinch, death falls/wrecks, kneel-to-fire for more infantry, mech heavy walk, air bank/landing | Animation 5.5, VFX 6.8, Polish | | done on claude/animation (hit flinch + hull rock, three seeded infantry falls, firing stances, heavy walk, Sovereign tripods, flyer dip/flare); not merged. Notes below. |
| W5 | Faction identity: per-faction silhouettes and palettes, signature unit per faction, faction UI accent, faction music stinger (models via Codex briefs or agents) | Faction identity 4.5, Unit models | | todo (after W1 list) |
| W5a | Field Guide 3D view of each unit: real model, orbit/zoom, Idle / Walk / Fire, team colour, Ranger for scale; lazy chunk, disposed on close | Faction identity, Unit models, UI | | done (claude/unit-viewer) |
| W6 | Replay value: challenges (C7.1), medal cosmetics (C7.3), achievements 13 -> 25, match history and replay viewer (B2-B3) | Replay 5.3, Content | | done on claude/replay-meta (5ec39af achievements, a6e9f1b challenges, 0edc26d cosmetics, 30494b6 history, 82fa2d1 replays); not merged. Notes below. |
| W7 | Depth: second doctrine tier, special weapons plan, abilities for Hawk / Balloon / Glider | Balance & depth 5.0, Content 5.4 | | todo |
| W8 | AI quality on Fast / Relentless only: focus fire, retreat wounded, flank, use abilities, scout with Kites; Relaxed/Normal untouched | AI quality 5.0 | | done (claude/ai-smarter): shared focus fire with spill, wounded rejoin from behind the healer, timed and tower-aware flanks (paired retreat), Kite scouting with anti-air avoidance, Dash/Rush/Rapid fire casts; Fast/Relentless pins move (notes below) |
| W9 | Content: C6 missions (4 of 6-8), story scenes (2 of 8), new lands (snow / volcano / water), Ember Drake boss, Ancient ruins | Content 5.4, Campaign 6.0 | | todo |
| W10 | Defence mode: more maps, enemy variety, commander abilities shown in waves, Endless leaderboard (local) | Defence 6.2 | | todo |
| W11 | Multiplayer: 1v1 over WebRTC with lockstep (the sim is deterministic and hashed), room code to share, no server of our own beyond signalling; then co-op vs AI | Multiplayer 1.2 | | todo (owner decision: signalling service) |
| W12 | Audio: SFX pass (weapon families, impacts by armour, UI clicks), mix ducking for voices | Audio 6.0 | | done (claude/voices): metal impacts, infantry falls, 6 new weapon voices, 13 ability casts, UI clicks, eco voice caps, voice ducking |
| W13 | Phone HUD chrome ~35 % -> under 30 %, minimap side choice on phones, left-handed layout, two-finger camera twist | UI phone 7.3, Controls 6.9, Accessibility 6.9 | | done on claude/phone-hud: HUD 12-28 % at 390x844 / 844x390 (was 16-33 %, 35-38 % with a notice), notices settle to one line, minimap side + Left hand in Settings, two-finger twist; not merged. Notes below. |
| W14 | Small fixes from audits: lake fords slow units, Page Up/Down in help, landscape word breaks | Polish 7.1 | | done (claude/small-fixes): unreachable build sites red with the reason, lake fords slow (0.6), no mid-word breaks (layout-f checks), help lists Page Up/Down/G/Esc/?, Field Guide 3D view fits, rings and crystals on plateau tops |

## Order
1. Now: W1, W2 (running), W3 + W12 (audio, no overlap with view code), W6 (meta/UI, no overlap).
2. After W1: W4, then W5 from W1's art list.
3. Then W7 and W8 (both move golden pins: one at a time), W9, W10, W13, W14.
4. W11 needs the owner's yes on a signalling service (free PeerJS cloud or a tiny worker).
5. Re-score after each wave; record the score here.

## W8 notes (2026-11-25)
- Gate: `sharpSide` (src/ai-plan.js) = skirmish, not Defence, Fast or Relentless, a computer side; `cmd.sharp` on the field commander. Relaxed/Normal, missions (Veteran borrows Fast's numbers with `sharp: false`) and Defence are byte-identical: `tests/ai-sharp.test.js` pins three whole Normal/Relaxed AI matches to their pre-W8 hashes; every Relaxed/Normal golden pin, `check:missions`, `check:defence` and `ai-census-check` (Normal) give the same rows as before.
- Difficulty bot wins /12 before -> after: 1v1 12/12/11/11 -> 12/12/12/10; 1v2 7/2/0/0 -> 7/2/0/0; 1v2ffa Fast 12 -> 11, Relentless 11 -> 12. A first cut that also used the Field command cast rules under the Classic plan made the AI weaker (1v2 Fast/Relentless 0 -> 2/3): those rules hold Shield wall, Lock-on, Brace and Overdrive for the right moment, so they are up less often. Under Classic only Barrage/Burn line aiming and the three new casts are used.
- Extra (not a gate): ai-census Highlands at Fast/Relentless (Field vs Field): before 1 timeout of 10 (Relentless veil:wardens), after 1 of 10 (Fast ashfall:meridian).
- Golden pins that move (all Fast/Relentless, AI play changed by W8; re-record): skirmish `riverlands x2 fast` 180 9b7b7eda, 300 8362467d, end "victory 270" (was running), reloaded 300 8362467d; `highlands x2 relentless coalition` 180 02b62956, 300 a63d7701, reloaded 300 a63d7701; `basin x3 fast` 180 f9ea053a, 300 20eda0b2, reloaded 300 20eda0b2; expanded `veil` (fast) 300 2b818975, 500 099ade0f; r4p1 `fast` 180 c3e66257, 420 55bd6c80. The 60 s points stay (no attack yet).
- Found, not fixed (would move Normal pins): `nav.nearest` takes and returns grid cells, but the AI passes world metres and reads `.x` (aiRallyPoint, aiFormed, the flank waypoint). The W8 flank path converts properly; the older paths are left as they were.

## W13 notes (2026-11-25)
- Measure: `tests/lib/hud-coverage.mjs`, run in the page: every rendered element except the battlefield canvas paints a 4 px grid; a background counts by its alpha (gradients by their most opaque stop), icons / images / the minimap fully over their box, text over its line boxes, scaled by opacity; full-screen layers are left out. Before/after, notice line empty (start notice on top in brackets, before only):

| Viewport | Nothing selected | Mixed army | Command core | Defence |
|---|---|---|---|---|
| 390x844 | 16.2 (20.7) -> 12.1 | 30.4 (35.0) -> 23.9 | 32.8 (37.3) -> 20.0 | 19.2 (21.3) -> 14.2 |
| 844x390 | 17.1 (21.6) -> 14.2 | 32.5 (37.1) -> 27.8 | 33.4 (37.9) -> 27.7 | 23.7 (26.7) -> 15.3 |
| 667x375 | 25.1 (31.0) -> 18.5 | 45.4 (51.3) -> 36.3 | 46.1 (52.1) -> 36.1 | 27.5 (29.9) -> 19.5 |

  A two-line routine notice adds 4.5 % fresh and 3.0 % once it settles (667x375: 6.0 -> 3.9). Left hand measures the same within 0.2 (Defence slightly less). 667x375 with a selection stays over 30 %: its 236 x 214 side dock alone is a fifth of the screen; `tests/phone-hud.mjs` asserts every state under 30 % at 390x844 and 844x390, and at 667x375 each state under 40 % with the four-state mean under 30 %. The next lever there would be a shorter landscape dock (two tile rows instead of chips + orders + two tile rows), a layout change for the owner to see first.
- What changed: the Walnut top-bar slab removed on phones (the pills of round 3 were meant to stand alone), glass dock and pills (`--slim-glass` 0.58, `--slim-pill` 0.84; buttons stay solid), 48 px landscape touch buttons, a building's portrait card without the tab row (Map + flag in its heading row), settling notices. Nothing hidden, no new sub-menu, every tap 44 px.
- Settings: `minimapSide` (left / right, now also on phones) and `handedness` (right / left; choosing Left also sets the minimap right). Defence keeps its centred HUD in both hands apart from the minimap side.
- Twist: `S.cameraTwist` (radians, session only) on top of Settings -> Camera -> Turn in `app/frame.js`; 15 degree dead zone, 60 px minimum span (`src/touch-controls.js` twistStep); reset by a new match or a Turn change; ignored in Defence.

## W14 notes (2026-11-25)
- Lake fords: only Mirror Lake has lakes, so Skirmish (difficulty bot 1v1 12/12/11/11, 1v2 7/2/0/0 before and after), Defence and every golden pin are unchanged; Mirror Lake's objective bot still wins gold (294 -> 318 s, lost 4 -> 0), the generic bot is still holding at 485 s (lost 4 -> 6). No pin needs re-recording.
- Build reach: the ghost runs the same route check as `sim.build` (`src/build-reach.js`), cached per type, site cell, Harvester cells and nav revision; a selection with several Harvesters builds with one that can reach.
- Word breaks: `tests/layout-f.mjs` now fails on any word split across lines (hyphen / slash breaks allowed) and runs phone landscape in Korean; it also found the tablet chronicle cards and the 1920 medal buttons.
- Field Guide: CSS only in `src/unit-viewer.css` (the 3D viewer's JS untouched); 320x568 still needs a scroll for the second button row (stage kept at the 220 px phone minimum).

## W6 notes (2026-11-25)
- Built: 12 new achievements (25) with toast, Records screen and results row; three daily challenges seeded from the local date (direct title tiles, +50 XP each, challenge days); nine medal cosmetics (paints, emblems, banners) picked in the Skirmish setup's Commander rows; match history (20) and a replay viewer (3 stored, x1/x2/x4, final-hash check, other versions refused). Storage keys: docs/ARCHITECTURE.md "Replay value storage (W6)".
- Golden pins identical (no simulation change). The replay needs the options each match was built with, remembered beside it in createSim (`src/main.js`), not a save's options: a mission's AI speed is adjusted when built and some missions raise it in play.
- Choices made without the owner (easy to change): challenges are a daily set of three (plan C7.1's per-mission challenge is not built; the brief asked for a rotating daily set); challenge XP is 50 each; a match continued from a save keeps no replay; the replay viewer has no timeline scrub or fog toggle (plan Stage 5.4 extras); unlock thresholds in `src/meta/rewards.js`.
- Owner to check: VI/KO wording of the new strings; whether the challenge strip on the phone title pushes the mode row down too far (it sits under the quick row).

## W4 notes (2026-11-25)
- Built (view only, golden pins identical): impact-driven hit flinch (infantry spring, hull pitch + roll rock, scaled by the share of health taken, direction from `hitBy`); three seeded infantry falls (back / knees / twist; Rider always tips) that lie still then sink; firing stances (`STANCE`: hunch, rock back, half-crouch brace for Walker and Bulwark); heavy walk dip, nod and sway on the stride phase; Iron Sovereign tripods that step with planted feet (they moved only centimetres in real play before); flyer speed-up dip and braking flare. Vehicle wrecks and flyer crashes already existed and were kept.
- Phone (300-unit live fight, 390x844, CPU x4, eco): main-thread median 16.6 ms before and after, 92 draws both.
- Choices made without the owner: the Walker and Bulwark brace rather than kneel (the roster test keeps them out of KNEELERS); infantry bodies stay 2.4 s (1.8 s Eco) and share the existing 24-model death cap; the Sovereign's leg sweep is capped at 0.5 model units so the rigid tripods stay on the dome (feet slip about a fifth of a step at its march). Kites and Hawks never land in the sim, so the "landing flare" is the braking flare into a hover.

## Hills mix notes (2026-11-25)
- Built: rounded-box plateaus (`rbox`, `src/terrain.js` `plateauEdge`/`rimReach`, `src/plateau-relief.js` corner arcs, `src/ground-paint.js` rounded outlines). Rounded boxes: Dunes, Verdant Crossing (woodlands), Dry Reach, Twin Rivers, Ironback, Crown Mesa. Round: Highlands, Golden Heart, Open Steppe and the small knolls. Campaign and Defence maps not converted; candidates: Highridge and Gun Hills (gun hills a line of towers would sit on), Gorge Road's relay plateau.
- Choices made without the owner: Dunes keeps the disc's footprint (22x20 m, centre 1 m further out). A 24x20 m mesa gave more room (12 barracks spots against 10) but slowed Mission 4's objective bot 369 -> 442 s (still gold) with 26 losses against 5, so the safer size was kept. Verdant Crossing's corner is 3 m and Ironback's north-south ridges 32 m long: the first tries (corner 4 m, 36 m) cost the test bot two 1v2 Relaxed/Normal wins on those maps. Crown Mesa 1v2 Normal is 3 -> 2 of 4 at every size tried (40-48 m, corners 6-16 m); within the check's one-match margin.
- Golden pins that moved (re-record with the reason "hills mix: Dunes mesas are rounded boxes"; values from GOLDEN_RECORD=1 / GOLDEN_FULL=1): golden-skirmish "dunes x1 normal, Ashfall against Veil" 60 s 97ebb1f4 -> 658bfd4d, 180 s 9053dd00 -> 523383ed, 300 s 866bafba -> 07ceec46 (end "running 300" unchanged); golden-r3i m04 120 894297ef -> 0ae451df; golden-r4p1 fast 180 c3e66257 -> 205125c2, fast 420 55bd6c80 -> cb9875af, sandbox 40 84c9ae8a -> 269d5ba7; golden-w1a wardens expanded 180 b5ed991b -> 7ef6ee2e, 600 ae7bbfcb -> 11d14808, 800 ae7bbfcb -> 7ec455e4 (outcome: seat 0 won at 431 s before; still running at 800 s now); golden-w2d field 180 706784b9 -> c301bda2, 600 eee24134 -> f05d6732 (seat 0 wins 578 -> 519 s); ai-sharp "Relaxed and Normal AI matches are unchanged by W8" normalCoalitionField 0854429a -> 076bdbdf (defeat at 178 s both).

