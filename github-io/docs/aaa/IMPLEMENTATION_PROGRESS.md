# AAA implementation progress

## Round 3 (Claude, 2026-11-13, 0.16.0–0.19.0): plan finished

Plan: [PLAN_ROUND3_REFINED_2026-11-13.md](PLAN_ROUND3_REFINED_2026-11-13.md), built by agents in separate worktrees, merged and checked by Claude.

| Plan release | Shipped in | State |
|---|---|---|
| 0.16 Hold the Line (faction pick, terrain rules, abilities, music) | 0.16.0, 0.16.1 | Done |
| 0.17 Frontier Defence | 0.17.0 (reached the site with 0.19.0) | Done |
| 0.18 Wings (air) | 0.18.0 (reached the site with 0.19.0) | Done; the Command core is the airfield (phones keep four tiles per building) |
| 0.19a Choices (decisions, endings, map) | 0.17.0 | Done |
| 0.19b Story you see (scenes, reworks, new missions) | 0.19.0 | Done, except: m06's ford idea dropped (Copper Basin has no river); voice tones skipped (optional) |
| 0.20 Chronicles | 0.19.0 | Done; 3 Veteran misses for the objective bot (ca2, cs2, cw2) |
| 0.21 Defence complete | 0.19.0 | Done, except: twin rivers (the river is fixed at z = 0, so Long Crossing uses the standard river) |

**Open for the owner:**
- Listen to the music: open `music-lab/listen/index.html` at the repo root (moved from 3D_claudeopus55 on 2026-11-14; see `music-lab/README.md`).
- Read the new story lines in `docs/aaa/review/story-lines.md` (0.19a, 0.19b, 0.18.3 and Chronicles sections).
- Refine the air models (`docs/aaa/review/air-units-sheet.png`).
- Play-test Defence pacing (Endless may be generous early), m06b's length (the bot takes 8.5 min) and the faction balance (Wardens and Meridian are above the 35–65% band; Veil is below).

## Improvement round 1 (Claude, 2026-11-13, 0.14.0)

Plan: docs/aaa/IMPROVEMENT_PLAN_2026-11-13.md. Items 1-4 shipped as 0.14.0, item 5 (enemy AI) as 0.15.0 (see CHANGELOG).

Open after item 5: Mirror skirmish without capture points may now be too hard for a person (test bot 67% -> 8% at Normal); with capture points (the default) the ladder is still easier than its targets. Pairs still outside 35-65%: Ashfall-Veil, Sunward-Wardens, Wardens-Veil (decided by the first fight at home, so roster/tempo numbers are next).

Listen checklist for the owner (constants to tweak if something is wrong):
1. Small arms crisp, not harsh: `src/sfx-bank.js` shot levels, or `bankLevel` in `src/audio-mix.js`.
2. Tank and artillery shots thump, then the shell lands: `shot:tank`, `shot:artillery` in sfx-bank.js.
3. Explosions grow: shell < artillery < vehicle < building < core: `blast()` in sfx-bank.js.
4. A big fight does not turn to mush or pump: `maxVoices`/`groupCaps` in audio-mix.js; compressor and limiter in `src/music.js`.
5. Music swells into fights and settles about 8 s after: `intensity` and `intensityWeight` in audio-mix.js.
6. Blasts dip the music without breathing: `loudDuck` in audio-mix.js.
7. Radio chirps short, not nagging: `radio` in audio-mix.js, `RADIO_VOICE` in sfx-bank.js.
8. Engine hum barely there: `engine.level` in audio-mix.js.

Known small points: a box-plateau ramp shows a small dark rock end where it cuts the top (close zoom only); the fog edge sits slightly high next to cliffs; phone hints are clamped to two lines (a long Vietnamese hint at 320 px may end in an ellipsis).

The owner instructed commit, push and continuation on 2026-11-11.

## Stage 3 started (Claude, 2026-11-12)

- 0.12.1: campaign on faction rosters (owner decision), one-minute holds that end early when nobody is left to contest them (owner), screen shake only for cores and Barrages plus a Settings switch (owner), baked model finishes (fewer draws), faction AIs form up before attacking.
- 0.13.0: package 3.1 terrain height on three maps, straight wall lines (owner request). Rules in `src/terrain.js` (plateaus, ramps, cliffs, `heightAt`) and `src/sim/height.js`; vision rule in `src/sim/vision.js`.
- Next: 3.2 cover (woods and ruins), 3.3 weather, 3.4 map rework with more plateaus.

## Faction gameplay, packages 2.3 to 2.6 (Claude, 2026-11-12)

Done, version 0.12.0:
- 2.3 Ashfall and 2.4 Sunward, Wardens, Veil: twelve definitions, four traits, five abilities, three building auras, the cloak rule and four AI personalities, with tests for each rule.
- 2.5: `npm run bench:factions` (round robin and test bot). Five tuning passes. **The 40 to 60% round-robin target is not met** (Meridian 63, Ashfall 15, Sunward 56, Wardens 96, Veil 21%); docs/BALANCE.md explains why this is AI behaviour rather than unit numbers, and gives the test-bot table a player's experience is closer to.
- 2.6: Skirmish "Enemy faction" (Mirror, the four factions, Mixed) with faction colours and emblems; Riders for the player from mission 9. **Campaign rosters are not switched on**: the story says all factions print the same units (docs/MISSIONS.md). The mission 12 Walker gift was dropped (it destabilised that mission's bot check).
- Stage 2 exit checks: first-visit download is 1297260 bytes gzipped against 1287022 at 0.9.4 (+10238 bytes, +0.8%, all of it script; the same 14 models are fetched at boot), so "not larger than 0.9.4" is missed by that margin. Mission checks: every target met at Standard and Story; Veteran misses only the mission 10 exception already recorded below. A battle against three different factions costs 206 draw calls on the phone view against 148 for three mirror rivals, and about 20 to 25% more render time, so the 10% line of package 2.6 is missed (follow-up: bake faction unit materials into vertex colour).
- CI: the browser install step now retries (the run for 98c41f6 failed twice on a package mirror, not on the game).

Open for the owner: play each faction in Skirmish and say which feel too weak or too strong; decide whether the campaign story changes so missions can use faction rosters.

Not started: Stage 3 (terrain height, cover, weather, maps), Stage 4 (story), Stage 5 (replay value), Stage 6 (ship quality).

## Committed work

- Stage 1: b80549d, pushed. [CI and deployment succeeded](https://github.com/buicongnguyen/3d_astra/actions/runs/43003557594).
- Package 2.0: 0f4ccb3, selective model loading, retry/recovery, readiness flag and offline late-model caching.
- Package 2.1: aa6a9fb, faction slots/classes, resolved rosters, save compatibility, AI/UI integration and opt-in mission rosters.
- Package 2.2: 89c927c added twelve original GLBs, Blender source library, exact manifest budgets and eight color/greyscale review sheets. [CI and deployment succeeded](https://github.com/buicongnguyen/3d_astra/actions/runs/43008680968). The owner approved all four looks on 2026-11-11; the follow-up appends all twelve portraits and records approval in the manifest and generator.

## Approval follow-up validation

- 353 unit tests, build, portrait checks at three viewports, UI quality at four viewports, and render-budget pass. The atlas and runtime contact sheet were visually inspected.
- Phone emulation remains 122 draws / 281045 triangles; CPU median 6.0 ms, p95 7.1 ms, zero idle uploads.
- Removed the redundant frontier-factions.blend1 backup and the failed portrait render temporary directory. Future portrait renders clean their temporary files automatically. No extra worktrees, stashes or local branches existed to merge or delete; work is on main. The untracked share-images directory is preserved.
- Follow-up CI is checked after push.

## Framework local validation

- Fresh build passes. All 352 unit tests and all 36 browser scripts have passing runs.
- After final loading-guard changes: rebuilt and reran model-loading, new-game, offline and the full unit suite. Stale downloads cannot override a newer ready/Retry state; failed-load UI remains recoverable.
- All standard mission outcomes and times exactly match Stage 1; every target passes.
- All-Meridian 60-second hash remains d071360b, also after save/load. Golden counter-damage checks pass.
- Every candidate passes topology/triangle limits, shared attribute sets, team materials and leg/weapon/hover marker checks. No quantization.
- Boot still downloads only the thirteen base models plus environment. A late Drone template retains hover metadata and has no shadow pass.
- Phone render budget: 122 calls, 281045 triangles, median CPU render 5.8 ms, p95 6.6 ms, zero idle GPU uploads (390x844 emulation on the existing PC).
- Full measured results: results/stage-2-validation.json. Remote CI for the next push is tracked after it starts.

## Owner approval recorded

[Review packet](review/README.md). The owner explicitly answered "Approve all four faction looks" on 2026-11-11. The package 2.2 art gate is cleared.

Next: implement the Ashfall gameplay slice (2.3), then the other faction gameplay packages. Portrait integration completes the approved art package; gameplay rosters are not yet enabled. Default order remains factions before story. Stages 3-6 are pending. The optional air unit still requires explicit confirmation.

## Retained Stage 1 limitations

Story wins 12/12. Standard meets its original targets. Veteran wins 11/12 and all passive players survive 155 seconds; mission 10 still fails after three tuning passes. Its checker remains strict and exits 1. The owner authorized continuing with this documented exception.

Normal/Fast/Relentless skirmish win-rate ranges are still unmet and documented in BALANCE.md; no AI regression tests were weakened. Owner play/listening review and physical-device testing remain pending.
