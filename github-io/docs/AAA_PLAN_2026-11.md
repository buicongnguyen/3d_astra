# Evaluation and plan to reach the AAA bar (2026-11-11, at 0.9.4)

This follows [REVIEW_AND_REBUILD_PLAN_2026-11.md](REVIEW_AND_REBUILD_PLAN_2026-11.md), whose phases 0 and A to F are done. That plan built the foundations. This one is about what a player feels.

## What "AAA" can mean here

A browser game made by one owner cannot match the content volume of a studio title, and it should not try. The reachable target is **AAA polish at a small scope**: every minute the player sees is distinct, finished and has a reason, even if there are only a few hours of it. The plan below is ordered by that rule.

## Evaluation

Scores are my judgement from the code, the data, the test screenshots and bot matches. I have not heard the audio and nobody has reported a full human play-through, so the feel scores are the least certain.

| Area | Score | What is there | What holds it back |
|---|---|---|---|
| Rules core | 7/10 | Deterministic sim, 8 units with one ability each, stances, veterancy, either/or research with two tiers, capture points | Small roster; no air, no heroes; little reason to change army mid-match |
| Factions | 3/10 | Four factions with colours, emblems, motives | **Every faction fields the same units and buildings.** Enemies are recolours of the player |
| Battlefield | 5/10 | Seven maps with their own palettes, rivers, bridges, dressing | Flat ground: no high ground, cover or weather, so position matters less than the Vision says |
| Enemy AI | 6/10 | Harvests, expands, counter-builds, retreats | One personality for all factions; Fast may be too hard, Relaxed is used for all missions |
| Mission design | 7/10 | Twelve missions with varied goals (hold, escort, quota, survive, no-base strike), medals | No difficulty choice; nothing carries from one mission to the next; little surprise on a second play |
| Story writing | 7/10 | A real premise, an antagonist with a defensible motive, arcs for Sol, Maren and ECHO | Good on paper (docs/WORLD.md) |
| Story delivery | 4/10 | Text cards with a portrait before, during and after a mission | No voice, no staged scenes, the Commander never chooses anything, the big moments are sentences |
| Look | 6.5/10 | Clean stylised kit, living dressing, turrets track, faction emblems | Units are small and similar from the game camera; impacts and deaths are modest |
| Sound | unknown | In-house music and effects exist | Never judged by ear |
| Interface | 7.5/10 | Checked at three sizes, tactics card, minimap pings, hints, results screen | No campaign map; menus are functional rather than memorable |
| Replay value | 4/10 | Skirmish at four speeds, medals | No achievements, challenges, unlocks or AI personalities |
| Technology | 8/10 | 339 unit tests, browser matrix, save and load, offline | First visit downloads about 1 MB of models; no real-phone test |

**The three biggest gaps, in order:** faction identity, story delivery, battlefield depth. A player who finishes mission 4 has seen every unit and every kind of fight the game has.

## Plan

Six stages. Each ends with a release, the full test run and a check that phone frame time did not get worse. Sizes: S is about a session, M a few sessions, L a long round with parallel agents.

### Stage 1: Prove the feel (S to M)
Do this first, because it decides how much of the rest is needed.
1. **Owner play-through** of missions 1 to 4 and one Normal skirmish, on PC and on a real phone, with the sound on. Notes go to a list: what was boring, confusing, too easy or too hard.
2. **Combat feel pass:** larger unit read at game camera (scale or outline), heavier muzzle flash, hit sparks and shield flicker, a short hit-stop and small camera shake on big shells, wrecks that stay for a while, stronger death sounds. Each effect measured against the phone budget.
3. **Campaign difficulty:** Story, Standard and Veteran, chosen per mission. It scales AI speed and wave size; medals record the level. Retune Fast in skirmish with the same knobs.
4. **Sound review** from the owner's notes: mix levels, repeated effects, music that fits each act.

*Done when:* the owner says a fight is fun to watch, and each difficulty is beatable by the test bot inside its target time.

### Stage 2: Faction identity (L)
The biggest single lift in quality.
1. Each enemy faction gets **two units of its own, one building of its own and one passive trait**, replacing parts of the shared roster:
   - **Ashfall** (salvage fleet): cheap scrap infantry in numbers, a flame unit strong against buildings; trait: wrecks give them alloy.
   - **Sunward** (caravan): fast riders and a mobile supply wagon that heals; trait: quicker movement on roads and sand.
   - **Wardens** (old machines): shielded drones and a slow walker; trait: no medics, units repair themselves when idle.
   - **Veil** (survey): cloaked scouts and a relay that hides units near it; trait: sees further, hits lighter.
2. **AI personality per faction:** Ashfall rushes, Sunward raids Harvesters, Wardens turtle and push late, Veil avoids the fight and takes points.
3. **The player earns allied units through the story:** Sunward riders from mission 9, one Warden walker in the finale.
4. New models come from the existing Blender kit, held to the triangle budget, one batch per type.

*Done when:* a screenshot with the colours removed still shows which faction is which, and the bot needs a different army against each.

### Stage 3: Battlefield depth (M to L)
1. **Terrain height** (the item left from phase E): plateaus and ramps; high ground gives vision and range.
2. **Cover:** woods and ruins cut ranged damage for infantry inside them.
3. **Weather tied to the story:** the storm in missions 6 and 10 slows vehicles and shortens vision.
4. **One air pair:** a scout flyer and an anti-air role for the tower and the Anti-tank soldier. Air needs no pathfinding.
5. Rework three maps to use height and cover as real choke points.

*Done when:* the same army wins or loses depending on where it stands, shown by a unit test and by a bot match.

### Stage 4: Story delivery (L)
The writing is ready; the staging is not.
1. **Staged scenes in the engine** for the six big moments (the relay waking, Hale's beam to orbit, the truce, the circuit map, Sol changing sides, ECHO saying "I"): scripted camera, letterbox, units acting, music cue. The mission engine already has camera and music cues.
2. **Voices without voice actors:** a short synthesised voice tone per character under each line. It is original, small, and works for English and Vietnamese alike.
3. **Three Commander decisions** with consequences in later missions: for example, return or keep Ashfall's alloy in mission 3 (changes Hale's opening force in 7), which oasis to give Sol in 4 (changes her help in 9), spare or break the Veil relay in 10 (changes the finale and the ending text).
4. **A veteran squad that carries over:** up to six ranked units follow the player into the next mission with their names.
5. **Campaign map screen:** the frontier with relays lighting as missions are won, replacing the plain list; an archive screen for cast and faction notes.
6. **Two endings** with a short epilogue, chosen by the decisions.

*Done when:* someone who skips no text can retell the story after playing, and a second play-through shows different lines and a different finale.

### Stage 5: Reasons to return (M)
1. Achievements and a challenge per mission (no towers, under a time, no units lost).
2. Skirmish options: pick the enemy faction and personality, map variants, a daily seed with a local best time.
3. Medal rewards: cosmetic colours and banners.
4. Replay viewer for a finished match (the command log already exists).

### Stage 6: Ship quality (M)
1. **First-visit time:** load only the models a match needs and show the menu before the rest arrive. This replaces model compression, which was tried in 0.9.4 and distorted the models.
2. Real-phone test round (iPhone and a mid Android) and fixes.
3. Install prompt and icons for the home screen.
4. Then online multiplayer, following INTERNET_MULTIPLAYER_PLAN.md.

## Order and risk

- Stage 1 is cheap and steers the rest; stages 2 and 4 are where the game changes most. If only two stages are done, do 1 and 2.
- Stage 2 and stage 3 both change balance: `npm run check:missions` and the skirmish bench must be retuned after each, and mission times will move.
- New units and effects add draw calls; each stage keeps the rule that phone frame time must not get worse.
- The Godot twin stays frozen.

## Decisions for the owner

1. Is the order right, or should story delivery (stage 4) come before factions (stage 2)?
2. Synthesised voice tones, or text only?
3. Should the Commander's decisions change the ending (two endings), or only flavour later missions?
4. Is one air unit pair wanted, or should the game stay ground-only?
