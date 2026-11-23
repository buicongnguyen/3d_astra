# Campaign plan: faces, carry-over and reasons to return (2026-11-24)

> **Status: plan only, awaiting owner approval.** Nothing here is built. It replaces the open parts of
> [PLAN_CAMPAIGN_HEROES_PRISONERS_2026-11-16.md](PLAN_CAMPAIGN_HEROES_PRISONERS_2026-11-16.md) and the
> unfinished items of [STAGE_4_STORY.md](STAGE_4_STORY.md) and stage 5 of
> [../AAA_PLAN_2026-11.md](../AAA_PLAN_2026-11.md).
> Written from the repo (docs, `src/story/*`, `balance.json`, a code search) and the recent re-score.
> **No campaign mission was replayed to write it.** Work package C0 does that first.

## 1. Goal

Make the campaign the reason to open the game twice, on a phone, in short sittings.

A player who finishes it should be able to say: *I know who I fought, I kept some of my soldiers alive
from mission to mission, my choices changed what happened, and I want to try the other ending or a harder
level.*

Measured by (section 9): every mission clears in its time target on the bot at Relaxed and Normal,
a second play-through shows a different line, force and ending, and no phone screen fails the
11 px / 44 px audit.

## 2. What the campaign has today (verified in the code)

| Piece | State |
|---|---|
| Missions | 16 story missions in three acts (`src/story/missions.js`, ids m01 to m12 with b/c/d side missions), plus 4 faction Chronicles (`src/story/chronicles.js`). Three are Frontier Defence missions (m02b, m07b, m11c). |
| Mission types in use | build and reach, assault, hold two of three, escort, collect, survive, no-base strike, high-ground hold, boss, waves. |
| Bosses | Iron Vanguard (m03), Iron Sovereign and Iron Sovereign 2 (m11d). Rules in `src/sim/bosses.js`. |
| Story delivery | About 10 staged scenes (`src/story/scenes.js`): the relay wakes, the truce, the Vanguard, the first balloon, ECHO wakes, the crown lights, the cut, the Keystone open or held. Cast with portraits. |
| Decisions and endings | Three decisions (`src/story/choices.js`), a mercy count, two endings: "Open Frontier" and "Meridian Line". |
| Difficulty | Story, Standard, Veteran per mission (`src/difficulty.js`). Veteran raises AI speed one step. |
| Medals | Bronze for any win, silver and gold by time. Campaign map screen exists (`src/story/campaign-map.js`). |
| Length | Design times are 6 to 15 minutes, m11 up to 20. Missions that start with a base already got the phone-length economy (6 Harvesters, 600 alloy). |

## 3. What is missing (ranked by player value)

1. **The fights have no faces.** Apart from three boss machines, every mission is ordinary units against
   ordinary units. Heroes exist only in Defence mode. Nobody can be captured or spared, so the mercy
   count is only fed by three dialogue choices.
2. **Nothing carries over.** Each mission starts fresh. Stage 4 promised "a veteran squad that
   follows you with their names" and it was never built. There is no reason to keep units alive.
3. **Only three decisions, and little shows afterwards.** A second play-through changes only a few lines.
4. **Missions are long for a phone.** Design times of 8 to 15 minutes conflict with the owner's wish for
   short matches. The real times after the phone-length economy change have not been re-measured.
5. **No reasons to return.** No achievements, no per-mission challenge, no cosmetic reward for medals,
   no New Game+.
6. **Story voices are text only.** Characters have portraits but no voice tone under their lines.
7. **No archive.** The cast, the factions and what the player decided cannot be re-read.
8. **Mission variety stops at the old toolbox.** The new content (Hawk and air, Wyrm nests, the Full army
   fight, Anti-tank counters) is not used by any mission.

## 4. Guardrails (owner rules that bind this plan)

- Phone is the main purpose. Missions are short. 11 px text, 44 px taps, no system fonts.
- **Never make Relaxed or Normal harder.** AI changes go through the difficulty gate
  (`node tools/difficulty-check.mjs --compare`); the 1v2 setups must not lose more than one match.
- **Squad control first.** One ability per unit, low micro. **No player hero with two powers.** Heroes are on
  the AI side; the player's best veteran is a named unit, not a spellcaster.
- No hidden or grouped buttons, no map chores, no camera shake, no formations.
- Original art and text only. EN, VI and KO for every new string. The Godot twin stays frozen.
- Deterministic simulation: anything that changes the world goes through the mission engine and is saved.
  Scenes stay client-only and never change the simulation.
- Phone frame budget must not get worse. New fighters reuse existing models with a trim and a name bar.

## 5. The plan

Phases are in build order. Sizes: S = a day or less, M = two to three days, L = about a week of work.
Every phase ends with the checks in section 9. Phases C2 to C4 are the heart; C0 and C1 make them safe.

### C0. Baseline and measure (S)

*Why:* the plan rests on a doc-and-code reading. Measure before changing.

- C0.1 Run `npm run check:missions` and record the real time to clear each mission with the bot at every
  difficulty. Save the table in `docs/aaa/results/campaign/baseline.md`.
- C0.2 Play every mission on a phone viewport (390 x 844 and 844 x 390) with the autopilot and by hand for
  the first and last three. Log every readability problem, dead moment, and unclear objective.
- C0.3 Read all 16 mission scripts and write one line each: what is the fun moment, what is the longest
  quiet stretch. This becomes the per-mission table in the appendix.
- C0.4 Re-score the campaign with the game-aaa-scorecard (story, content, onboarding, UI parts only) so the
  end result has a before and after.

*Done when:* a baseline file and a ranked list of the five slowest or flattest missions exist.

### C1. Short and sharp: the pacing pass (M)

*Why:* short matches on a phone. This must come before new content so new content is built to the budget.

- C1.1 Set a time target per mission: **intro 6, assaults and holds 8, big set pieces 10, finale 12**.
  No mission above 12 minutes at Standard on the bot.
- C1.2 Trim by moving the scripted beats earlier (first wave, objectives revealing sooner), not by changing the
  AI. Do not raise enemy strength; the Relaxed and Normal rule stands.
- C1.3 Re-time the medals to the new lengths (gold about 70% of the target).
- C1.4 Retune Story difficulty so a first-time player can clear every mission without losing more than
  once; keep Standard as it is.
- C1.5 Update the "design" text and the bot expectations in `docs/MISSIONS.md`.

*Done when:* the bot clears every mission within target on Relaxed and Normal, and the difficulty gate is
unchanged.

### C2. The veteran squad (M)

*Why:* the cheapest way to make the player care, and it needs no new controls.

- C2.1 **Rules.** After a win, up to **six** surviving units with rank 1 or higher are saved with their name,
  type and rank. They join the next mission at its start point.
- C2.2 **Names.** Units get a first name from a small original list (EN, VI and KO sets). The name shows in the
  selection card and on the results screen.
- C2.3 **Briefing line.** The briefing shows the squad as six small portrait tiles, and says in one line what
  carried over.
- C2.4 **Fairness.** A mission with a fixed squad (m08) ignores carry-over. A player with no veterans loses
  nothing: missions give the same starting force either way. Carry-over adds, it never gates.
- C2.5 **Death is a moment.** A named unit that dies produces one short notice (no pause, no popup).
- C2.6 **Saves.** The squad lives in campaign progress, versioned, with a migration for old saves.

*Done when:* a test plays two missions in a row and the same named unit appears in the second; old saves
load; the squad shows on a phone without covering the objective card.

### C3. Enemy heroes and surrender (L)

*Why:* gives the fights faces and feeds the mercy count that picks the ending.

- C3.1 **A hero is a tagged enemy unit** built from a faction unit (health multiplier, a gold-red trim, a name
  bar, a larger selection ring), driven by the AI. No new abilities the player must answer.
- C3.2 **Surrender.** A hero below 35% health stops fighting and calls out (this reuses the existing "hurt units
  pull back" rule). The player then chooses with **two visible buttons on the objective card**: *Accept
  surrender* or *Finish them*. Not hidden, one tap each.
- C3.3 **Outcome.** Accepting counts as one mercy, removes the hero from the fight, and may change what the AI
  does next (for example, its camp stops producing). Finishing them is the normal win. Both are valid.
- C3.4 **Candidates** (to be confirmed in C0.3 against the scripts): Hale at the Ashen Line and the siege,
  Sol at the dunes, Maren at the Obsidian Storm, and one Sovereign-linked commander before the finale.
- C3.5 **No hero in every mission.** Four to five encounters in 16 missions, so each stays special.
- C3.6 **Difficulty.** Heroes scale with the Story, Standard and Veteran tables. At Relaxed and Normal a hero
  must not make the mission longer than its C1 target.
- C3.7 **Prisoners.** A surrendered hero appears in the cast archive (C5) and may speak in a later mission
  (a changed line, not a new unit).

*Done when:* bot tests cover both outcomes in each hero mission, the mercy count changes the ending
text, and the mission still clears in time.

### C4. Decisions with visible consequences (M)

*Why:* a second play-through must feel different.

- C4.1 Grow decisions from **three to six**, spread over the three acts. Each one changes something the
  player can see within one mission: a different starting force, a different ally arriving, a different
  enemy opening, or one line of dialogue that names the choice.
- C4.2 Add a one-line **"Because you chose..."** note on the briefing of the mission that reacts. The player
  always sees why something changed.
- C4.3 Add a **third ending** only if the owner wants it (decision D3). Default: keep two endings and make
  each ending text depend on which decisions were made.
- C4.4 Save every decision, show them in the archive (C5), and let the player replay a mission with other
  choices from the campaign map without losing the first result.
- C4.5 Tests: each decision has a unit test for its effect, and a bot match for each branch.

*Done when:* two play-throughs with opposite choices differ in at least four missions, and tests cover
every branch.

### C5. Story delivery and the archive (M)

- C5.1 **Staged scenes** for the remaining big moments that still play as plain text, chosen in C0.3
  (target: eight more, short, 5 to 10 seconds).
- C5.2 **Voice tones** (decision D2): a short synthesised tone and rhythm per character under each line,
  original and tiny, working the same in all three languages. Off in the existing audio settings.
- C5.3 **Archive screen** on the campaign map: the cast with portraits, each faction, the decisions made, the
  heroes met, captured or spared. One scrolling list, no sub-menus.
- C5.4 **Campaign map** on phones: tap a mission, see its medal, time, challenge and carry-over squad in one
  card. Portrait and landscape.
- C5.5 Every line is localised (EN, VI, KO) and the text length is checked for the 11 px phone layout.

*Done when:* someone who skips no text can retell the story, and the archive is complete after one play-through.

### C6. New missions that use the new toolbox (L)

Six to eight additions, each at most 8 minutes, placed where the act needs variety. Candidate ideas, to be
approved one by one (decision D1):

- **Air mission:** the player gets Hawks and the enemy brings Anti-tank, teaching the counter by playing.
- **Wyrm nest mission:** wild frontier rules, with nests as optional threats and a reward.
- **Full army parade:** the first time every unit type is available, as a short "show what you have" fight.
- **Prisoner escort:** walking a surrendered hero home. Uses the existing escort objective. No map chores.
- **Night mission:** a very dark blue sky, lights on, enemy seen by their glow. Uses the existing night look.
- **Quick skirmish chapter:** a three-minute mission after a big one, for a short sitting.

*Done when:* each new mission has a bot test, a medal table, a decision hook or challenge, and lands inside
its length target.

### C7. Reasons to return (M)

- C7.1 **One challenge per mission**, chosen from a short list: no tower built, under the gold time, no named
  unit lost, spare the hero. Shown on the mission card, optional.
- C7.2 **Achievements:** about 25 local achievements (first mission, all gold in an act, both endings, all
  heroes spared, a veteran of five missions). A single list screen. No account needed.
- C7.3 **Medal rewards:** cosmetic only. Unit colour sets and banners unlocked by medals. They do not change
  strength.
- C7.4 **New Game+:** Veteran difficulty with the squad kept from the last play-through and all decisions
  open again.
- C7.5 If the owner later adds the Google Sheet leaderboard, campaign times can be posted there (separate
  plan, needs approval, no personal data).

### C8. Phone, accessibility and localisation (M)

- C8.1 Run the 11 px / 44 px audit on every campaign screen at six viewports.
- C8.2 Scenes, briefing and the hero choice card in portrait and landscape; nothing hidden behind a menu.
- C8.3 Reduced-motion and quiet modes respected by scenes and voice tones.
- C8.4 VI and KO review of all new text by the owner or a native check.

### C9. Verification and release (S)

- C9.1 Full unit tests, mission check, difficulty check, golden pins re-recorded with a written reason.
- C9.2 Browser groups for the campaign, the briefing, the campaign map and the results screens.
- C9.3 Perf: phone frame time must not get worse; new fighters add no models.
- C9.4 A real-phone test round (iPhone and a mid Android) is still needed and cannot be done here.
- C9.5 Push and release **only when the owner says so**; then watch CI and check the live site.

### Owner additions, 2026-11-24 (approved: "execute the plan")

The owner approved running this plan with the defaults in section 10 and added three items.

**C6a. High-ground maps with gun hills (M).** A campaign map needs a large plateau or hill where the player
can build a Sentinel tower and shoot down at an attacker.
- Already in the engine: plateaus give shooters on high ground extra range and damage against targets below
  (`sim/height.js`, `balance.json` terrain numbers). Dunes, Woodlands, Highlands and Gorge Road have plateaus.
- Missing: Classic, Basin and Crossroads have no biome, no plateau and no dressing, and no campaign map has
  a *large* hill built for towers.
- Work: (1) check that a tower can be placed on a plateau (placement rules) and fix if not; (2) add one large
  plateau with a ramp to Basin and one to Crossroads, a biome and dressing to Classic, Basin and Crossroads;
  (3) tell the player in the briefing which hill to hold; (4) bot tests that a tower on the hill out-ranges one
  below. Maps used by skirmish keep their match fingerprints unless the owner agrees to re-pin them.

**C6b. Troop truck (M).** The Defence-only Troop carrier already exists (520 health, drives a squad down the
road, the squad dies if the truck dies). Bring it to the campaign without new player micro:
- enemy trucks drop a squad behind your line in two or three missions (Anti-tank crews are the answer);
- a friendly truck arrives by script with six soldiers at a named point as a reinforcement beat (no loading or
  unloading by the player);
- the six soldiers can come from the veteran squad (C2) so the player sees them arrive by truck.
Needs: campaign spawn and drop commands in the mission engine, a model check, VI and KO text.

**C6c. Model detail pass (M).** Make the Balloon and the low, round, hovering units look more detailed:
Ember balloon, Drone and Kite (the closest matches to "a circle near the floor"; **the owner should confirm
which units were meant**). Work in Blender, keep the triangle budget and the draw-call count, check the phone
frame time, and compare before and after screenshots.

**C1 correction.** The baseline (`results/campaign/baseline.md`) shows most missions already finish inside their
targets. Only **m04 (fails its own check: the bot loses at 1124 s), m03 (837 s) and m06 (634 s)** need work. C1 is
now "fix m04, trim m03 and m06, re-time medals" rather than a blanket trim.

## 6. Order and dependencies

```
C0 baseline -> C1 pacing -> C2 veterans -> C3 heroes -> C4 decisions -> C5 delivery
                                  \-> C7 reasons to return (after C2, C3, C4)
                         C6 new missions (after C1; use C2 to C4 as they land)
                         C8 phone and language checks run after every phase, a full pass at the end
                         C9 last
```

If only three phases are done: **C1, C2, C3**. If the owner wants the biggest first impression: **C2 first**,
because it is the cheapest and shows on every mission.

## 7. Who does what: do we need Codex?

**No, Claude can do all of it.** Codex is optional and is only worth using for work that cannot clash.

- Codex already has two worktrees on this repo (`3d_astra-codex-a`, `3d_astra-codex-b`) on branches
  `codex/round-a` and `codex/round-b`, last touched about a day ago. The first one has an uncommitted change
  in `campaign-map.css`, which is exactly where C5.4 would work. **Ask the owner to land or park that work
  before C5 starts.**
- **Claude:** all of C0 to C4 and C6, because they all edit `src/story/missions.js`, `balance.json`,
  the mission engine and the progress saves. One writer for those files avoids merge trouble.
- **Safe to give to Codex in its own worktree, after the plan is approved:**
  - C5.2 the voice-tone synthesis (a separate audio module, no shared files);
  - C5.4 and C8 campaign map and phone layout (CSS, with the audit scripts);
  - C9.2 browser test authoring for new screens;
  - portrait and trim art for the heroes if the owner wants new images.
- Rule: **one owner per file.** Codex never touches `missions.js`, `balance.json` or `src/sim/`.

## 8. Risks

| Risk | Answer |
|---|---|
| Pacing changes make missions easier or harder by accident | C0 measures first; the difficulty gate and the mission check run after every phase. |
| Heroes feel like damage sponges | Cap the hero's health multiplier; test time-to-kill; the C1 length target is a hard gate. |
| Carry-over makes later missions too easy | Carry-over is capped at six units and adds only a small share of the starting force; the bot is tested with and without. |
| Old saves break | Versioned progress with a migration and a test with a saved old file. |
| Translations lag | Every new string is added to `vi.json` and `ko.json` in the same change; a test checks for missing keys. |
| Scope grows | Each phase is a separate release candidate; C6 missions are approved one at a time. |

## 9. Success checks

1. Bot clears all 16 missions inside their time targets at Relaxed and Normal. Difficulty gate unchanged
   (no setup loses more than one match against the saved run).
2. Two play-throughs with opposite choices differ in at least four missions and in the ending text.
3. A named veteran can be followed across at least three missions in a test.
4. Both hero outcomes (spare, finish) are tested in every hero mission.
5. The 11 px / 44 px audit passes on every campaign screen at all six viewports.
6. All new text exists in EN, VI and KO.
7. Phone frame time is not worse than the baseline.
8. The scorecard parts for story, content and onboarding go up against the C0 baseline, with the numbers
   reported.

## 10. Decisions for the owner

- **D1.** Which of the six C6 ideas do you want first (one air mission, one Wyrm mission, the prisoner
  escort, the parade, the night mission, the short chapter)?
- **D2.** Voice tones, or text only? (Default in this plan: tones, on by default, switchable off.)
- **D3.** Two endings with richer text, or a third ending? (Default: two.)
- **D4.** Do heroes **surrender by choice** (two buttons) or **always die** (simpler)? (Default: choice, because
  it ties into the mercy count.)
- **D5.** Is carry-over **six units** right, or fewer?
- **D6.** Do you want Codex on the optional parts in section 7, or Claude on all of it?

## Appendix: per-mission starting table (to be filled in C0.3)

| Mission | Map and AI | Design time | Proposed change |
|---|---|---|---|
| m01 First Light | riverlands, 1 Relaxed | about 6 min | keep; add the challenge "no tower" |
| m02 First Contact | riverlands, 1 Relaxed | about 10 min | trim to 8; first carry-over squad appears after it |
| m02b Hold the River | bridges, Defence | about 6 min | keep; challenge "no lives lost" |
| m03 The Ashen Line | classic, 1 Relaxed, boss | about 10 min | trim to 8; Hale as the first hero (surrender choice) |
| m04 Three-Way Dunes | dunes, 2 Relaxed | about 10 min | trim to 8; Sol hero choice tied to the oasis decision |
| m05 The Verdant Pact | woodlands, 2 Relaxed | about 9 min | keep at 8; carry-over shown |
| m06 Copper Harvest | basin, 1 AI | about 11 min | trim to 8; lowest-fun candidate, check in C0 |
| m06b Wings over Copper | basin, air raid | 9 to 12 min | trim to 8; place of the first Hawk lesson |
| m07 Copper Siege | basin, 2 AI | exactly 11 min | trim to 10 |
| m07b Hold the Valley | gorge, Defence | about 7 min | keep |
| m08 The Quiet Vault | classic, no base | about 11 min | trim to 8; fixed squad ignores carry-over |
| m09 A Debt in the Dunes | dunes, high ground | 8 to 9 min | keep; reacts to the mercy count |
| m10 Obsidian Storm | highlands, 3 AI | about 13 min | trim to 10; Maren hero choice |
| m11 Cut the Draw | expanse, 2 AI | about 15 min | trim to 10; reacts to decisions |
| m11c Hold the Keystone Roads | crossroads, Defence | about 14 min | trim to 10 |
| m11d The Sovereign Walks | expanse, boss | 8 to 10 min | keep; optional |
| m12 Frontier's End | expanse, 3 AI | about 13 min | trim to 12; the ending changes by decisions and heroes |

(All "proposed change" cells are starting guesses from the design notes. C0.3 confirms or replaces them after
reading each script.)
