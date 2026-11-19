# Frontier Command: AAA evaluation, round 2

Date: 2026-11-19. Code read: branch `feat/defence-zones-armour` at `11e70a9` (worktree `3d_astra-zones`).

This document merges 8 independent reviews:

- unit roster and combat;
- campaign and story;
- Frontier Defence;
- skirmish, AI and maps;
- presentation and feel;
- code health;
- an audit of every plan against the code;
- research on shipped games.

Where reviewers disagreed, the code was checked (section 4.1). Nothing in the game was changed.

Scores are out of 10. They are judged against shipped AAA and AA strategy and tower-defence games, not against this game's own docs. The reference games are StarCraft II, Company of Heroes 3, Age of Empires IV, Iron Harvest, Northgard, Kingdom Rush and Bloons TD 6. A shipped AAA game would score about 9 and a good AA game about 7.

---

## 1. Verdict

Frontier Command scores about **5.4 out of 10** against shipped AAA and AA strategy games.

**The foundations are AA grade.** It has:

- a deterministic sim with save and replay;
- data-driven units;
- bots that check every mission and every Defence level;
- render budgets enforced by tests;
- a boss framework that keeps the owner's no-micro rule.

**The content, and what the player sees, are not.** For the owner's goal the central problem is simple: the game has less unit variety than an RTS needs, and it shows even less than it has.

- Each faction is the shared roster with 2 slots swapped, which gives 12 ground combat types across 5 factions.
- 7 combat units have no ability, and only the Hawk fights in the air.
- The skirmish AI fields 3 to 5 unit types per match and never builds Tanks or Walkers.
- 8 faction and boss weapons draw the same rifle tracer.
- Combat has one axis, damage multipliers. So the turtling Wardens top the faction bench at 71%, while the factions with the most style sit at 33 to 40%.
- The campaign has one boss in 27 missions. No hero fights on the field, and Ashfall is the main enemy in every mission.
- Defence is the strongest mode, but it has no bosses or elites and a low difficulty ceiling.
- On a phone, half the screen is HUD.

**The good news is that most fixes are additive.** Three things already exist that new content can build on:

- the Defence code holds an effects library: slow, pierce, bursts, marks, burn, cargo and expiring units;
- 10 Tank_game_3D boss models are ready;
- new state is created only when a feature uses it.

So new units, missions, maps and modes can land without moving `d071360b` or the mission checksums.

**Two things come first:**

1. Fix the promotion bug that strips health from the commander and the armour squads.
2. Add golden gameplay pins. Today's pins do not cover AI, combat or Defence play, so nothing else can be proven safe without them.

### Score per area

| Area | Score | Why |
|---|---:|---|
| Campaign (missions and structure) | 5.5 | The objective spread is good: only m02 requires a core kill, and the mission tooling is safe. But there is 1 boss in 27 missions and no hero on the field. Ashfall is team 1 in all 15 missions. Act 3 is four base missions in a row, and the finale is a 30,000 HP static relay. |
| Story (writing and delivery) | 6.5 | The story bible is consistent and warm, with planted clues, 3 decisions, 2 endings and 12 Chronicles. But the big moments happen on the radio, choices change words more than play, and there are no voices and no codex. |
| Battle gameplay (combat rules) | 5.5 | Clean, deterministic and measured, with a tested counter wheel, height rules, stances, autocast and a full stealth loop. But hits land instantly and damage has one axis (multipliers only). There is no positional layer, and turtling beats every style. |
| Unit variety and styles of fighting | 4 | 12 ground combat types are shared by 5 factions, each faction swaps only 2 slots, and Tank, Breaker, Anti-tank and Engineer appear in 4 of 5 factions. 7 combat units have no ability, only the Hawk fights in the air, and the AI fields 3 to 5 types per match. |
| Frontier Defence | 6 | More systems than most TD games: 6 crews × 2 branches × 2 ranks, zones, armour, bridges and carriers, plus a balance bot. But there are only 7 levels of 10 waves each, no bosses or elites, enemies have no TD traits, the ceiling is low, there is one commander, and a promotion bug strips health. |
| Skirmish, AI and maps | 4.5 | The field-command AI never cheats, and it gathers, retreats and flanks. But the 7 maps share one template and there is one win rule. Capture rings are worth about 15% of a Harvester. There is no randomness, no AI ally, and expansions are left undefended. |
| Presentation and feel | 5 | Strong effects and feel engineering inside the budgets, and charming art at close zoom. But on phones the battlefield fills half the screen, at pixel ratio 1 with no shadows. 8 faction weapons draw the rifle tracer, the UI has a generic identity and the battle music is synthesised. |
| Code health | 6.5 | A deterministic mixin sim, 609 tests, 79 to 100% line coverage and no dead modules. But the pins do not cover gameplay, target search is all-pairs, AI ticks cause spikes, three files are monoliths, 31 tests read source text, and the main chunk is 754 KB. |
| **Overall (simple average)** | **5.4** | AA foundations with indie-scale content and on-screen variety. |

---

## 2. Strengths worth protecting

Any change must keep these working.

1. **Determinism with lazy state.** Every action goes through the command log, and save and replay work. New state is created only when a feature uses it (boss `e.bs`, `defence.armourNext`, cargo). So all-Meridian matches keep `d071360b`, and old saves keep loading. This is what makes additive content cheap. Never add state before a feature needs it.
2. **A data-driven unit model** (`src/balance.json`). Each unit has a counter class, `counter_bonus`, `mechanical_bonus`, `building_bonus`, splash, `siege_range`, `hits_air`, `shield_delay` and cloak/detect fields. A new unit is mostly one JSON block. The golden counter damages are pinned in `tests/factions.test.js`.
3. **Balance is measured, not guessed.**
   - `check:missions` runs per difficulty with `--decide mercy/firm`.
   - `check:defence` checks four things: the bot meets its star target, a passive player loses, no single-crew player gets 3★, and Endless lasts at least 15 waves.
   - `bench:factions` (round robin) and `tools/skirmish-bench.mjs`.
   - PlayBot and ObjectiveBot.
4. **Low-micro scaffolding.** Every ability can autocast. Guard, Hold and Aggressive stances keep units on a leash. Units auto-evade 1.5 s into a 3 s boss warning, and soldiers help with repairs. This matches the owner's "reward control, never require it" rule.
5. **Terrain with weight.** Plateaus give +2 m range, ×1.2 damage firing down and ×0.85 firing up, and +3 vision, and their tops are hidden from below. Fords slow units to ×0.6, walls can be broken, and rocks block shots.
6. **A complete stealth loop for Veil.** Units cloak after 3 s without firing. Units reveal them at 4 m, towers and cores at 9 m, and Kites detect them at 8 m. Relays conceal and reveal.
7. **A boss framework.** It has circle, cone and line zones, with warnings sized to the walk out. The core is exposed at ×1.75 and the armour takes ×0.65. A test caps each attack at 30% of a Ranger's health, and there is a model port tool (`tools/port-boss-model.mjs`).
8. **A fair field-command AI.** It gets the same costs and income as the player. It remembers only what it has seen, gathers before it attacks and weighs the odds (towers count 3×). It also retreats, focuses fire, flanks with a second group, counters the mix it has seen, expands, and plans with allied AIs.
9. **Defence depth.**
   - Crews and pads: 6 crews × 2 branches × 2 ranks, rim and deep pads, build zones.
   - Armour squads that work with no orders.
   - Bridges you can blow up, which enemy builders cover with pontoons.
   - Varied enemies: carriers, cloaked units and air waves.
   - Wave intel and an early-call bonus.
   - Endless and Daily, with save and replay.
10. **The story bible** (`docs/WORLD.md`). It suits all ages and nobody is evil. Clues run from m01 to m12. Decisions are settled before the match (`resolveMission`), so saves and replays stay deterministic. There are 2 endings and 12 Chronicles, and `tests/story-vi.test.js` enforces the Vietnamese story catalogue.
11. **Feel inside the budgets.**
    - Effects are pooled into 4 fixed draw calls.
    - Hits flash, health bars leave a ghost chip, and the camera has trauma shake and hit-stop.
    - Wrecks last 20 s and buildings collapse.
    - Audio has 12 synthesised weapon voices.
    - Tests enforce a draw budget per scenario (`battle-eco` 120, `defence-big-eco` 112), the 11 px text and 44 px tap rules, and a 28 px minimum unit height.
12. **Code basics.**
    - 21 mixins with 245 methods and no name clashes.
    - 609 unit tests run in 50 s, and the sim files have 89 to 100% line coverage.
    - No unreachable modules and no TODOs.
    - The CI matrix fails if a suite is left out.
13. **Plans that agents can run.** Each package names its files, tests and keep-or-drop rule. Once the owner approves a plan, it ships: Round 3 and the Defence asks C1 and C9 to C13 all landed.

---

## 3. Top gaps, ranked by impact on the AAA and variety goal

> **Fix first (bug).** In `src/sim/tactics.js:42` a promotion sets `e.maxHp = Math.round(D[e.type].hp * (1 + RANK_BONUS * e.rank))`. That recomputes health from the base definition and throws away every extra health factor. In a scratch run the commander went from 936 to 562 max HP after one kill, and a Bulwark squad tank from 1,193 to 562. A bot run on Three Roads ends with the commander at rank 3 and 645 max HP; it should have about 1,161. This hits the owner's two newest Defence features. It is fixed by idea D1, which takes under a day.

| # | Gap | Key evidence | Raised by |
|---|---|---|---|
| 1 | **Unit variety is thin, and style does not pay** | Each faction is the base roster with 2 swaps, and each swapped unit keeps the class of the unit it replaces. 12 ground combat types cover 5 factions, and Tank, Breaker, Anti-tank and Engineer each appear in 4 of 5. Meridian has no unique ground unit, and the Wardens field 7 types in all. 7 combat units have no ability, and 7 of the 12 abilities are timed self-buffs. Air: 4 flyers, a cap of 4 (2 for the AI), no flyer for Wardens or Veil, and no flyer ability. Round robin in 0.18 (`BALANCE.md`): Wardens 71, Meridian 69, Ashfall 40, Sunward 38, Veil 33. For comparison, SC2 has about 15 types per race and AoE IV about 20 per civ. | roster, research, audit |
| 2 | **The AI hides the variety that exists** | `ai-counter.js counterChoice` turns the Foundry's Tank into a Breaker in almost every case. Harvesters always send 1 in 4 to energy (`economy.js:238`), but the AI spends mostly alloy. Over 17 measured matches the AI fielded 3 to 5 unit types: no Tank or Walker ever, one Hawk, and 1,000 to 3,000 energy left unspent. | skirmish |
| 3 | **Combat has one axis** | Damage is base × counter × mechanical × rank × height, and every hit lands at once. `fight()` stops a unit to shoot. Suppression, facing armour, mines, player transports, deploy-for-range, call-ins outside Defence and concealment are all missing. The Walker's description says "flanking is the answer", but no flank rule exists. The richer Defence effects run only when `e.crew` is set (`combat.js`). | roster, research |
| 4 | **Bosses: 1 of 11 ported, and the engine blocks the rest** | The Iron Vanguard in m03 has one attack. 10 GLBs sit unused in `Tank_game_3D/public/models`: helicopter, jet, laser, missile-truck, missile, quadcopter, rail, siege-mech, spider and walker. The engine has no multi-zone attacks, route walking, strafe, building targets, tower stun or flying bosses. There is no boss in Defence, the Chronicles, skirmish or the finale. | all 8 |
| 5 | **The campaign does not escalate or show its cast** | 0 hero units in 27 missions, and Hale never appears on the field. Ashfall is team 1 in all 15 missions. Act 3 is 4 base missions against coalitions with the same rhythm. The finale is "survive 10:00", then shoot a 30,000 HP static relay. 33 objective spawns use the Supply relay model, and 11 of 15 twists are a scripted `wave`. Air returns in no story mission after m06b and m07b. The commander, armour squads and build zones are in no story mission. m10 "Obsidian Storm" has no storm, and m08 "night 38" plays in daylight. | campaign, audit, research |
| 6 | **Defence lacks peaks, enemy variety and a ceiling** | Every final wave is a bigger stack of ordinary units. Enemies have no tower-defence traits and never use their abilities, because autocast is gated on `aiEnabled` (`tactics.js:138`), which Defence sets to false. The bot gets 3★ on Veteran on 5 of 7 levels, and Endless reaches the 40-wave test cap on 6 of 7. All 7 levels have 10 waves and the same 18/10-lives medals. There is one commander with no levels, and 3 perks cost 12 of the 21 stars. There is no fast-forward and no targeting choice, and upgrade numbers appear only in hover tooltips, which phones never show. | defence, research, audit |
| 7 | **Phones are not first-class yet** | The battlefield fills 50% of a portrait phone and 53% in landscape, against 80% on desktop. Touch devices default to Eco, which means pixel ratio 1 and no shadows. On Three Roads, tanks are 7 to 10 px tall at the start zoom of 92. Dialogue and counter hints sit over the fight. | presentation |
| 8 | **Variety is invisible on screen** | `visual-style.json` has 6 weapon styles, so 11 of 18 armed types fall back to the rifle look, among them the Scorcher, Shade, Drone, Hawk, Glider, Rider, Scrapper and the Iron Vanguard. Counter hits look like any other hit. Deaths vary by category only. 8 GLBs ship Death and Attack clips that are never played (there is no `AnimationMixer` in `src`). The boss reads as about 1.5× a tank, and the debrief opens 0.7 s after it dies. | presentation, audit |
| 9 | **Skirmish is one template with one rule** | Base spots are fixed in code. The same 14 `ROCKS` sit on every map. The river is always at abs(z) < 3, with crossings at x = -22/0/22, and the middle deposits are the same everywhere. Only 3 of 7 maps have a plateau pair. The only win rule is annihilation, and there is no AI ally. Rings pay 0.25 alloy/s, about 15% of a Harvester. There is no `sim.rng`. The AI leaves an expansion more than about 35 m from its main core undefended: it lost 1,274 HP with 0 defenders. It never builds a third core, and big maps stall to the 30-minute cap. | skirmish |
| 10 | **Little to earn between matches** | Campaign: no armory, no veteran carry-over, no codex, and no challenges or achievements. Defence: the perks run out after about 12 stars. Skirmish: no daily battle, no mutators and no replay viewer. | campaign, defence, research, audit |
| 11 | **The owner's newest Defence features reach little play** | Besides the promotion bug, zones and armour exist only on Three Roads (`levels.js:410, 417`): that is 1 of 7 levels and no story Defence mission. The bot buys ranks on 0 towers in 6 of 7 levels. | defence, audit |
| 12 | **Weak safety net, and sim hot spots** | `d071360b` is a 60 s run with the AI off, all Meridian and no orders, asserted separately in 7 files. The mission checksums hash data, not play. `serialize()` hashes every enumerable field, so adding a cache changes the hash. `combat.enemy`, `defenseTarget` and `separate` scan all pairs. AI think ticks spike: on desktop p99 is 7.1 ms and the max 26 ms. About 42% of each Defence tick computes team 0's vision and then overwrites it. The main chunk is 754 KB. | code, audit |
| 13 | **No identity in look or sound** | System fonts, and a title screen that is a dropdown form. Battle music comes from oscillators, the UI makes 37 single-sine beeps, and there are no voices. No weather and no colour grade, and the fog on the Ashen maps is near-black (`#190f24`). | presentation |
| 14 | **The docs no longer match the code** | The `ROADMAP.md` stage table is stale. The counts in VISION, FUTURE_IDEAS, HEAVY_WEAPONS, WORLD and TESTING are wrong. `BALANCE.md` gives the boss 40,000 HP; the code says 32,000. `package.json` says 0.19.1 while labels go up to 0.24, and the CHANGELOG has 7 "Unreleased" sections. `IMPLEMENTATION_PROGRESS.md` stops at 2026-11-13. The AAA list says A1 and A4 move the hash; they do not. | audit, code, roster |

---

## 4. Status of the owner's ideas

### 4.1 Disagreements checked in the code

| Question | What reviewers said | What the code shows |
|---|---|---|
| Build zones | "done" or "partial" | The feature works, but only `d-crossroads` sets `zones` (`src/defence/levels.js:410`) and `armour` (`:417`). The other 6 levels and the 4 story Defence missions (m02b, m07b, ca3, cw3) have neither. |
| Defence commander | "on 6 levels" or "on every level" | It is on all 7 levels (`levels.js` lines 68, 130, 184, 241, 294, 349 and 419). No story Defence mission sets `commander`: `defence-missions.js` and the Chronicles have none, and `defence.js:156` spawns the commander only when it is set. |
| Capture points in skirmish | "opt-in" or "always on" | Always on, with no toggle: `main.js:64` passes `capturePoints: !S.mission && S.playMode === "skirmish"`. |
| Missions that end on a core kill | "only m02" or "5 of 15" | 5 missions have a `destroyCores` objective (m02, m03, m09, m10 and m12), but only m02's is required. The others are optional. |
| A5 hit feel | "done" or "partial" | Partial. There is no `AnimationMixer` or `clipAction` in `src`, and `visual-style.json` `weapons` has only 6 styles. |
| B3 heroes | "partial" or "missing" | Missing as heroes with powers. In m08, Okoro is a tagged Engineer (400 HP) that you escort. |
| B5 scenes | "done" or "partial" | Partial. `src/story/scenes.js` has 9 scenes. The planned beam-to-orbit, one-circuit, sol-crosses and echo-says-i scenes are not built, and the Chronicles have none. |
| Troop carriers | "done" or "partial" | Done as a Defence enemy. There is no player transport in any mode. |
| Veil's bench score | 25% or 33% | The latest result (0.18 air round robin) is Meridian 69, Ashfall 40, Sunward 38, Wardens 71 and Veil 33. 25% is the 0.15 figure. |
| Units with no ability | "7" or "8" | 12 of the 20 trainable types have an ability. The 8 without one are the Harvester plus 7 others: wagon, drone, shade, kite, hawk, balloon and glider. |
| Main enemy in the campaign | "Ashfall in all" | Confirmed: every mission in `missions.js` and both story Defence missions use `{1: "ashfall"}`. |
| What `d071360b` pins | The AAA list says A1 and A4 move it | They do not. The pin is `new Simulation({ai:false})` with all Meridian, ticked for 60 s (`tests/factions.test.js:6-10`). AI and non-Meridian changes move the bench and mission-check tables instead. |

### 4.2 The owner's direct requests

| Idea | Status | Notes |
|---|---|---|
| Naval map: ports, ships, transports, islands | **Missing** | A plan only (`docs/naval/NAVAL_PLAN.md`). Water is hard-wired as the z=0 band in `terrain.js`, `view.js:687`, `environment-view.js`, `ground-paint.js` and `minimap.js`. The engine already has the hooks: Navigation needs only `canStand`/`cellAt`/`worldAt`, movement branches for flyers, `nav.regions()` finds islands, and the Defence carriers hold cargo. The plan's rule "vi.json identical with the Godot twin" contradicts `docs/README` (the twin is frozen). See S17 and C13. |
| Bosses ported from Tank_game_3D | **Partial** | 1 of 11 is ported: the Iron Vanguard (`boss-quad-mech`), in m03 only. The BOSSES.md lineup (Atlas Launcher, Iron Sovereign, Rail Titan, Siege Marshal, Defence heavy boss, Sky Wraith) is not built, and the engine features it needs are missing. See C1, C7, C11, C12 and D8. |
| Tank_game_3D weapons | **Partial** | Only analogues exist: Barrage, burning ground, the flame trap and the Marksman pierce rank. Not ported: pulse-laser line pierce, arc rockets over cover, the re-targeting guided barrage, mines, fuel-drum chains, and directional armour (`rules.ts armorMultiplier`: front ×0.65, rear ×1.5). See M2, M3, U3 and D11. |
| Defence: more placement spots (build zones) | **Partial** | The feature is done but used on 1 of 7 levels. See D5. |
| Defence: hero with a special weapon | **Done in the mode, partial overall** | On every level. One fixed hero: a Tank with ×1.8 HP, Barrage and Reinforce. It has no levels, no choice of hero and no Tank_game weapon. The promotion bug cuts its health. It is in no story mission and not in skirmish. See D1, D11, C9 and S12. |
| Defence: multi-route larger maps | **Done** | Three Roads: 128 m, 3 entries, 4 forking roads. It is the only large level, and it is not used in the story (see C9). |
| Defence: movable tanks (armour squads) | **Done, on 1 level** | Guard and Hold road, a refit after each wave, Rank 2, then Assault or Bulwark. Only on Three Roads. The promotion bug wipes the upgrade health. |
| Defence: troop carriers | **Done (enemy only)** | Long Crossing wave 8, Three Roads, and every 5th wave in Endless. There is no player transport (see U9 and S17). |
| Defence: more upgrade levels | **Done** | 2 ranks per branch (24 in all) plus the armour upgrades. In 10-wave levels the bot ranks almost nothing, so in practice they are an Endless sink. Skirmish and campaign still have 3 ranks at +8% each. |
| Defence: sturdier towers | **Done** | Tier HP ×1, ×1.35 and ×1.75, health factors for front-line crews, and repair at 4%/s after 6 s unhit. Towers lost in bot runs fell from 42 to 15. Switchback on Veteran still loses 6. |

### 4.3 The AAA list (`AAA_GAMEPLAY_STORY_DEFENCE.md`)

| Id | Idea | Status | Notes |
|---|---|---|---|
| A1 | Bigger AI waves | Not started | Waits for owner OK. Measured waves on Normal: 5 to 22 units. What the AI builds matters more than wave size (gap 2, idea S1). |
| A2 | Battle camera | Missing | Alerts are toasts and minimap pings with no jump. See P7. |
| A3 | Map objectives in skirmish | Partial | The rings are always on but weak. There are no drops, watchtowers or camps. See S11. |
| A4 | AI personalities with real tactics | Partial | Rush, raider, turtle and evasive exist, tied to the faction. The Meridian AI has none (`factions.meridian.ai = null`), there is no choice in setup, and the AI does not scout. See S3 to S5. |
| A5 | Hit feel | Partial | Heavy impacts, wrecks and the weapon voices are done. Deaths per unit type are missing, and the authored clips are never played. See P6. |
| A6 | Naval Phase A | Missing | See S17. |
| B1 | Choices with consequences | Partial | 3 decisions. The only mechanical effect across missions is one Breaker fewer in m07. The Chronicles have no decisions. See C15. |
| B2 | Twists inside missions | Partial | 11 of 15 twists are a scripted wave, and none changes the map or the rules. See C4. |
| B3 | Named heroes on the field | Missing | The heroes plan's cast table lists Hale as a Meridian hero (he is the Ashfall Director) and leaves out Okoro. See C5. |
| B4 | Veteran carry-over | Missing | See C18. |
| B5 | More staged scenes | Partial | 9 scenes. There are no title-card, shake or slow-motion beats. See P8 and C20. |
| B6 | Codex or archive | Missing | See C17. |
| C1 | Wave preview | Done | No trait chips. See D4. |
| C2 | Boss and elite waves | Missing | See D6 and D8. |
| C3 | Enemy traits | Partial | Cloak, healing aura, flyers, carriers and bridge builders exist. There are no affixes, splitters, rushers or tower disablers. See D6 and D7. |
| C4 | One rule per level | Partial | Bridges, `startBlown`, air, cloak and zones. No night, sandstorm or two exits. See D14. |
| C5 | Stars and challenges | Partial | Stars are earned by lives only. See D13. |
| C6 | Tower targeting choice | Missing | `combat.js:31-43` ranks units, then workers, then buildings, and picks the nearest in each group. See D3. |
| C7 | Commander skill tree | Partial | 3 flat perks. See D12. |
| C8 | Endless with a daily seed | Done | Local bests only, no modifiers. See D16. |
| C9 to C13 | Carriers, zones, armour, large level, ranks and sturdier towers | Done | Zones and armour are on 1 level only. |

### 4.4 Other plans

| Plan | Status | Notes |
|---|---|---|
| Wings II (Aegis, Wraith, flyer abilities, Kite Crash dive, Lancer, Hexer) | Missing | No source hits. Its baseline bench, W0, was never run. See U10 and U11. |
| Special weapons (missile and interceptor, EMP, Sonic, smoke, mines) | Missing | Plan only, and it depends on W0. See U3, U11 and M3. |
| Campaign heroes and prisoners | Missing | Plan only. Fix its cast table first. See C5 and C21. |
| Bunkers and barricades | **Dropped by the owner (2026-11-16)** | Do not propose them. `PLAN_SPECIAL_WEAPONS` section 10 also rules out "a second ability per unit", and every idea below respects that. |
| Stage 3.2 cover, 3.3 weather, 3.4 map rework | Missing | No `cover` in `maps.json` and no `sim.rng`. 4 of 7 maps have no plateau. See M6 to M8 and S9 to S10. |
| Stage 4.2 voice tones, 4.4 veterans | Missing | See P14 and C18. |
| Stage 5: achievements, challenges, skirmish options, daily battle, replay viewer, cosmetics | Missing or partial | Only the faction pickers and the alliance option exist. See S15, S18 and S19. |
| Stage 6.1 test on a real phone | Missing | "Not tested on a physical phone" has been an open item since 0.9. |
| Stage 6.3 and internet multiplayer | Missing | Plan only. S13 gives a co-op feel offline first. |
| Rebuild plan (2026-11) | Partial | Splitting the Simulation and `main.js` is done. Still open: a spatial hash (K5), golden pins (K1), keyed messages (K15), tests renamed by feature, and WebKit in CI (K11, K13). |
| Visual track V1 to V6 | Partial | V2 (falls) and V4 (tier trims) are done, and V3 is partial. Missing: V1 faction projectiles, V5 per-mission time of day, and V6 bloom. See P4 and C3. |
| FUTURE_IDEAS | Partial | Save and resume, veterancy and stances are done. Formations are only a grid (see M5). Gamepad support, a map editor and seed sharing are missing. |

---

## 5. Ideas

### 5.0 Rules every idea follows

- **Determinism.**
  - New state is created only when content uses it.
  - Caches stay off the hashed sim (use a WeakMap or the `DERIVED` set in `snapshot.js`).
  - Anything that changes existing skirmish or campaign play is marked "changes existing balance: yes" and needs owner OK.
  - "No" means the idea is opted into by new content or an option, so `d071360b`, the mission checksums and today's bot tables stay put.
- **Phones.** Keep 100 to 150 draw calls, text of at least 11 px, taps of at least 44 px, and both portrait and landscape.
- **Strings.** Every new UI string needs Vietnamese in `src/locales/vi.json` (story text goes in `story-vi.json`).
- **Art.** Stylised low-poly flat-colour models from `tools/blender/` generators, in vivid warm colour.
- **Micro.** Low micro. "Micro" below is the control the idea asks of the player: none, low (one tap, or optional) or medium.
- **Owner rulings.** No bunkers, no barricades, and no second ability on a unit that already has one.

### 5.1 Index

| Id | Title | Size | Micro | Existing balance |
|---|---|---|---|---|
| U1 | Faction workshops | M | none | no |
| U2 | Gunner team and the suppression rule (Meridian) | M | none | no |
| U3 | Longshot howitzer (Meridian siege) | M | low | no |
| U4 | Bulwark projector (Wardens shield dome) | M | low | no |
| U5 | Sapper: mines and demolition (Ashfall) | M | low | no |
| U6 | Rampart ram tank (Ashfall) | M | low | no |
| U7 | Stalker sniper (Veil) | M | none | no |
| U8 | Outrider drill: auto-kiting cavalry (Sunward) | M | none | no |
| U9 | Caravan truck: ground transport | L | medium | no |
| U10 | Wings II flyers: Aegis and Wraith | M | low | no |
| U11 | Signature abilities for the 7 ability-less units | M | low | **yes** |
| U12 | War Council slot variants and Custom army | M | none | no |
| U13 | Experimental units (opt-in rule) | L | low | no |
| M1 | Opt-in effects library for every mode | M | none | no |
| M2 | Facing armour (opt-in field) | S | low | no |
| M3 | Mines and demolition charges | M | low | no |
| M4 | Doctrine powers in skirmish | L | low | no |
| M5 | Fall back, role formations, select by type | M | low | no |
| M6 | Concealment brush and explosive props | M | low | no |
| M7 | Area cover on new maps (owner decision) | M | none | no |
| M8 | Weather and time of day in the sim | M | none | no |
| C1 | Boss engine extensions | M | low | no |
| C2 | Distinct objective-structure models | M | none | no |
| C3 | Night and storm looks per mission | S | none | no |
| C4 | Mission hazards library | M | low | no |
| C5 | Campaign hero rules (corrected cast) | M | low | no |
| C6 | m08b "Breaking Camp" | M | low | no |
| C7 | m09b "The Sovereign Walks" | L | low | no |
| C8 | m09c "Forty Lights" | M | medium | no |
| C9 | m11c "Hold the Keystone Roads" | S | low | no |
| C10 | m11b "Two Keys" | L | medium | no |
| C11 | m13 "The Grey Coat" finale | L | low | **yes** |
| C12 | Side operations: other factions and new bosses | L | low | no |
| C13 | m10b "Glass Lake" naval landing | L | medium | no |
| C14 | Campaign fork after m10 | M | none | no |
| C15 | Consequences you can see | M | none | no |
| C16 | Allied units in their faction colours | S | none | no |
| C17 | Camp, Archive and Armory between missions | M | none | no |
| C18 | Veterans who carry over | M | none | no |
| C19 | Chronicles: decision, scene and lead hero | M | low | **yes** |
| C20 | Rewrites of existing missions (owner OK) | M | low | **yes** |
| C21 | Yield and capture (prisoners slice) | M | low | no |
| D1 | Fix the promotion health bug | S | none | **yes** |
| D2 | Fast-forward ×2/×3 | S | none | no |
| D3 | Tower targeting priority | S | low | no |
| D4 | Trait chips, new-enemy card, phone stats | S | none | no |
| D5 | Zones and armour on the older levels | M | none | **yes** |
| D6 | Elite affixes | M | none | no |
| D7 | Six enemies built for tower defence | M | none | no |
| D8 | Road bosses | L | low | no |
| D9 | Vanguard barracks crew (blockers) | M | low | no |
| D10 | Signal relay support crew | M | none | no |
| D11 | Commander choice with in-match levels | L | low | no |
| D12 | Commander tree replaces the perks | M | none | no |
| D13 | Heroic and Iron challenges | M | none | no |
| D14 | Level rule variants | M | none | no |
| D15 | Levels 8 to 10 | L | low | no |
| D16 | Harder Veteran, Endless escalation, Daily modifiers | M | none | **yes** |
| D17 | Endless field-order cards | M | low | no |
| S1 | AI spends what it earns | S | none | **yes** |
| S2 | AI defends every core and ring | S | none | **yes** |
| S3 | AI scouting and punishing expansions | S | none | **yes** |
| S4 | AI doctrines | M | none | **yes** |
| S5 | Harassment and two-pronged attacks | M | low | **yes** |
| S6 | Smart AI ability use | S | none | **yes** |
| S7 | Big-map AI | S | none | **yes** |
| S8 | Recruit and Warlord levels | S | none | no |
| S9 | Map engine | M | none | no |
| S10 | Four purpose-built skirmish maps | M | low | no |
| S11 | Skirmish map objectives | M | low | no |
| S12 | Win modes | M | low | no |
| S13 | AI ally (2v2, 3v1) | M | low | no |
| S14 | Last Stand mode | M | low | no |
| S15 | Match seed, daily battle, mutators | M | none | no |
| S16 | Frontier War conquest | L | low | no |
| S17 | Naval Phase A | L | low | no |
| S18 | Achievements and challenges | M | none | no |
| S19 | Replay viewer | M | none | no |
| P1 | Give phones their battlefield back | M | none | no |
| P2 | "Balanced" render tier | M | none | no |
| P3 | Readable armies at strategic zoom | S | none | no |
| P4 | Distinct weapon looks and ability moments | M | none | no |
| P5 | Counter-hit feedback and damage numbers | S | none | no |
| P6 | Varied deaths | M | none | no |
| P7 | Battle camera and threat arrows | S | none | no |
| P8 | Boss presence pack | S | none | no |
| P9 | Colour grade and team rim light | S | none | no |
| P10 | Visual weather | M | none | no |
| P11 | Painted fog of war | M | none | no |
| P12 | Title screen and brand pass | M | none | no |
| P13 | Results and wave ceremonies | S | none | no |
| P14 | Recorded battle music and voice tones | M | none | no |
| P15 | UI sound kit | S | none | no |
| P16 | Idle personality and victory cheers | S | none | no |
| P17 | Defence tower models and board dressing | L | none | no |
| K1 | Golden gameplay pins | S | none | no |
| K2 | Remove dead code and stale strings | S | none | no |
| K3 | Shared rng and hash module | S | none | no |
| K4 | Fast vision path, allocation-free helpers | S | none | no |
| K5 | Spatial grid for targets, splash, separation | M | none | no |
| K6 | Flatten AI-think spikes | M | none | no |
| K7 | Split `sim/defence.js` | M | none | no |
| K8 | Break up `app/defence-ui.js` | M | none | no |
| K9 | Split `view.js` | L | none | no |
| K10 | Instanced rings and health bars | M | none | no |
| K11 | Convert source-text tests | M | none | no |
| K12 | Lint and format gate | S | none | no |
| K13 | Shared UI checks in browser suites | M | none | no |
| K14 | Shrink the main chunk | M | none | no |
| K15 | Message ids from the sim | M | none | no |
| K16 | Seeded cosmetic randomness | S | none | no |
| K17 | CSS components with `@layer` | M | none | no |
| K18 | Docs and version hygiene | S | none | no |

### 5.2 Units and factions (U)

#### U1. Faction workshops
Give each faction building a `trains` list of 1 or 2 signature units: Salvage yard, Waystation, Pylon and Veil relay. `resolvedTrains` already handles lists. Add a Meridian **Field workshop** as `factions.meridian.building` (150/50 to build, needs the Foundry, 700 HP and 40 shield). The Barracks and the Command core already carry 4 tiles each, so the phone command card does not grow. Each workshop adds at most 2 tiles. Add one AI production rule in `sim/ai.js` for the faction building, gated by `!this.mission`, so story missions play exactly as before.
Files: `balance.json`, `factions.js`, `sim/ai.js`, `production-ui.js`, `tools/blender/generate_factions.py` (workshop model), `vi.json`, `tests/faction-rules.test.js`.
**Why:** it gives every faction room for real identity units within the 44 px layout, and it is the enabler for U2 to U7. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### U2. Gunner team and the suppression rule (Meridian)
Add a weapon field `suppress {per_hit 1, pin_at 6, decay 2/s, seconds 3, immune 4}`. A non-mechanical target that reaches 6 points is **Pinned** for 3 s:
- it moves at ×0.5, through the existing `slowUntil`/`slowBy` path;
- it reloads at ×1.5;
- it cannot cast abilities.

It is then immune for 4 s, so it can never be locked down for good. One instanced pin icon shows the state.
**Gunner team** (Field workshop): 110 HP and 30 shield, speed 3.6, 4 damage every 0.25 s (16 dps), range 11, ×0.25 against mechanical units, cost 125/40, supply 2. Its ability, **Crossfire**, doubles suppression for 6 s. Counters: Breaker, Tank and Scorcher splash. Vehicles are immune. The AI trains 2 when more than 60% of the enemy units it has seen are infantry.
Files: `balance.json`, `sim/combat.js hit`, `sim/tactics.js`, `selection-view.js`, `vi.json`.
**Why:** a Company of Heroes style line-holder. It stops Scrapper swarms and Shade rushes without killing them, and it works without input. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** U1, M1.

#### U3. Longshot howitzer (Meridian siege)
Field workshop, level 3: 240 HP and 40 shield, speed 2.3, cost 250/125, supply 4.
- **Deploying:** it deploys by itself after 2 s without a move order (at once on Hold) and packs up in 1.5 s.
- **Firing when deployed:** range 22 (24 against buildings), minimum range 7, a 60-damage shell every 5 s, splash 3 m at 50%. It never hits flyers.
- **Shells:** each shell is a delayed strike through the existing `this.strikes` path. It lands 1.4 s later on the ground the target stood on, and the target's owner sees a ring. Moving units escape on their own.
- **Spotting:** it fires only at what its side can see, so Kites (18 m) and Watchers (22 m) become its spotters.

It outranges a tower (13 m) and a braced Walker (16 m). Its single ability, **Guided shell**, is the special-weapons missile (decision E3): 150 damage on a slow flight that towers and anti-air can shoot down, cooldown 40.
Files: `balance.json` (`deploy`, `min_range`, `shell_delay`), `sim/combat.js`, `sim/tactics.js`, `sim/ai-attack.js` (the AI deploys it 18 m behind the rally point), a Blender model with spade and recoil parts, and a range ring in `tactics-view.js`.
**Why:** a real siege style, a turtle-breaker the bench needs (Wardens are at 71%), and a reward for scouting. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** U1.

#### U4. Bulwark projector (Wardens shield dome)
Put it on the Wardens' empty Engineer tile as `extra.foundry`: 200 HP and 150 shield, speed 3.2, no weapon, cost 175/100, supply 3.
- **Dome:** radius 6 m, with a pool of 450 that regenerates 30/s after 4 s unhit and collapses for 10 s at 0.
- **What it blocks:** hits on friendly ground units inside, from attackers outside, drain the dome first.
- **What gets through:** strikes (Barrage, Longshot shells, Burn line, boss zones) and attackers inside the dome. Domes do not stack.
- **Movement:** it follows the largest friendly group through the existing support-follow logic.
- **Cost on screen:** one transparent instanced mesh, 1 draw.

Ship it only if the Wardens rise no more than 3 points on the bench (the Wings II rule), and pair it with U3.
Files: `balance.json`, `progression.js applyDamage` (checked only while a dome exists), `sim/traits.js`, the view, `vi.json`.
**Why:** a slow shielded phalanx advance with a clear answer (artillery and melee). **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** U1, a bench run.

#### U5. Sapper (Ashfall mines and demolition)
Salvage yard, level 1: 90 HP and 10 shield, speed 4.8, 8 damage every 1 s at range 2, cost 80/20, supply 1.
- **Passive mines:** after 3 s idle on Guard or Hold it lays a mine (M3). It carries 2 and regains 1 every 25 s near its own buildings.
- **Ability, Demolition charge:** autocast beside an enemy building or wall. A 3 s fuse (the Defence demolish fuse), then 260 damage to buildings and 60 to units within 2 m. Cooldown 40.

Files: `balance.json`, `sim/tactics.js`, `vi.json`, a kit model.
**Why:** trap, area-denial and demolition play. Mined fords and raids that crack towers give Ashfall a second style besides the rush. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** U1, M3.

#### U6. Rampart ram tank (Ashfall)
Salvage yard, level 3: a welded plough tank with 650 HP and no shield (the Ashfall style), speed 3.0, 34 damage every 1.3 s at range 4, ×2 against buildings and walls, cost 250/90, supply 4. It carries `facing {front 0.6, rear 1.5}` (M2). Its ability, **Ram**, doubles its speed for 2.5 s, and the first contact deals 80 damage. Keep the push-back out of the first version: displacement in the shared movement path is the kind of "abnormal behaviour" risk the owner vetoed bunkers for. Add it later only if a soak test is clean.
Files: `balance.json`, `sim/combat.js`, `combat-feedback.js` ("REAR" hit number), `generate_factions.py`, `vi.json`.
**Why:** an armoured spearhead with a swarm behind it. Flanking, which the AI's second group already does, starts to matter. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** U1, M2.

#### U7. Stalker sniper (Veil)
Veil relay, level 2: 75 HP and 20 shield, speed 3.9, vision 18 (+3 for Veil), one 85-damage shot every 4.5 s, range 17, ×0.3 against mechanical units and ×0.4 against buildings. It has `cloak: true` and hides again 3 s after firing. Cost 150/60, supply 2.
A new optional field, `prefers: ["support","antiarmor","ranged"]`, makes `combat.enemy` rank those classes before distance. It applies only to units that carry the field. Two shots kill a Medic. Its ability, **Steady aim**, gives +3 m range and full shield pierce for 8 s, using the Defence pierce code.
Files: `balance.json`, `sim/combat.js`, `sim/tactics.js` (TIMED), `generate_factions.py`, `vi.json`.
**Why:** an anti-support ambush style that breaks heal-balls. Veil gets a damage dealer that fits its stealth fantasy (its bench score is 33%). **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** U1.

#### U8. Outrider drill: auto-kiting cavalry (Sunward)
A Waystation research, 150/75, once per match. Riders and Gliders on Guard or attack-move gain two behaviours:
- `skirmish {near 4, back 3, every 1.5}`: when a melee or flame enemy comes within 4 m, they step 3 m straight back (checked with `nav.canTraverse`, like `stepEvade`) and keep firing;
- `move_fire 0.6`: they fire on the move at 60% of their normal rate.

Because it is a research, the missions that unlock the Rider and the fingerprint are untouched. The Sunward AI researches it in skirmish only.
Files: `balance.json`, `sim/combat.js` (`fight`, `holdPost`), `sim/orders.js`, `sim/ai.js`, `vi.json`.
**Why:** hit-and-run cavalry without kiting micro, the style shipped games reward with skill. It answers Sunward's 38% through behaviour, not stats. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### U9. Caravan truck: ground transport
380 HP and 60 shield, mechanical, speed 5.4, a light MG (5 damage every 0.5 s at range 7), cost 125/40, supply 2. It carries 4 supply of infantry.
- **Boarding:** select infantry and tap the truck (a new `board` order), or use the "Load nearby" tile.
- **Unloading:** with a tile, or automatically when an attack-move ends or the truck loses 30% of its health.
- **Passengers:** they mend 2%/s inside and bail out at 50% health if the truck dies.

Move the cargo helpers (`cargo`, `dropCargo`, `ringSpots`, save fields) from `sim/defence.js` into `sim/cargo.js` (part of M1). Sunward gets it first, then every faction.
Files: `sim/orders.js`, `simulation.js`, `app/command-card.js` (2 tiles), the Sunward AI raid rule, a variant of `generate_carrier.py`, `vi.json`.
**Why:** drop-and-raid and flank play, the owner's transport idea outside Defence, and the base layer that naval transports need. **Size:** L. **Micro:** medium. **Existing balance:** no. **Needs:** M1.

#### U10. Wings II flyers: Aegis and Wraith
Run the plan's W0 bench first: `npm run bench:factions` at head, plus loss time per pair, recorded in `BALANCE.md`. Then add:
- the **Aegis** for the Wardens, a support flyer whose aura recharges shields 2.5× within 6 m (it does not stack);
- the **Wraith** for Veil, a cloaked striker, excluded in `airSeenBy` while cloaked.

Both go under `factions.<id>.extra.hq`. Keep or drop each by the plan's bench rule (its pair must move 2+ wins toward 6/12). If W0 shows the need, add the plan's Lancer (Sunward) and Hexer (Veil snare) the same way.
Files: `balance.json`, `sim/air.js`, `sim/traits.js`, `sim/vision.js`, `tools/blender/generate_air.py`, `model-roster.js`, `field-guide.js`, `vi.json`.
**Why:** every faction then has a flyer, which closes the clearest gap in the data. **Size:** M. **Micro:** low. **Existing balance:** no (new units). **Needs:** the W0 bench.

#### U11. Signature abilities for the 7 ability-less units
One ability each. That is allowed, because the owner's rule forbids only a second ability.
- **Drone EMP:** a 5 m pulse after a 0.8 s ring. Enemy mechanical units lose their shields, cannot recharge them for 5 s and cannot fire for 3 s. Cooldown 45.
- **Supply wagon Sonic:** infantry in a 6 m cone cannot move or fire for 2.5 s, then are immune for 8 s.
- **Shade Smoke:** a 5 m cloud for 8 s that hides the units inside from anyone farther than 3 m.
- **Hawk Strafe**, **Balloon Firedrop**, **Glider Dive** and **Kite Crash dive** (6 m, 70 damage, the Kite is lost), from Wings II section B.

These reuse the TIMED, barrage and burnline rules, plus the status effects from M1. The AI casts them through the existing autocast. The Wardens are above the band, so the EMP starts weak.
Files: `balance.json`, `sim/tactics.js`, `sim/combat.js`, `vi.json`, `field-guide.js`.
**Why:** the faction-signature units become the most interesting units instead of the plainest. It delivers parts of two plans the owner approved. **Size:** M. **Micro:** low. **Existing balance:** **yes.** The fingerprint stays, but the bench and `check:missions` move (Veil in m06; Wardens in m09 to m12). **Needs:** owner OK, W0, M1.

#### U12. War Council slot variants and Custom army
Before each campaign mission, the player picks one variant per roster slot from units that already exist with models:

| Slot | Variants |
|---|---|
| Vanguard | Vanguard, Scrapper, Shade |
| Ranger | Ranger, Rider, Drone |
| Breaker | Breaker, Scorcher |
| Tank | Tank, Walker |
| Anti-tank | Anti-tank, Watcher |
| Medic | Medic, Wagon |
| Flyer | Hawk, Glider, Balloon |

A variant unlocks after the first win against its faction ("salvaged prints", which fits WORLD.md: every faction prints the same base units). Store the picks as `council {slot: type}` in progress, and apply them as a player-side swap map through the existing faction swap path. Add a 7-tile War Council row to `app/briefing.js` (2 rows in portrait).
In skirmish, an opt-in "Custom army" option lets the player choose the same variants, and the AI picks counter variants by personality. `check:missions` on the default roster keeps every checksum, and a new `--council random` sweep checks the variants.
**Why:** StarCraft II Legacy of the Void's War Council roughly triples army variety with no new art, and players replay missions to try other combinations. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** owner OK on the story framing.

#### U13. Experimental units (opt-in rule)
An opt-in skirmish rule, also usable by new Act 3 missions. Each side may build one experimental. It needs Foundry L3 and core L3, costs 600/400, takes 60 s to build, uses 8 supply, and the enemy is told when it starts. Each faction has its own:

| Faction | Experimental | What it does |
|---|---|---|
| Meridian | Vanguard Mk II | The Iron Vanguard at 6,000 HP, with its telegraphed burst run on its own |
| Ashfall | Crawler forge | A mobile factory that drops 2 Scrappers every 20 s |
| Sunward | Sky caravan | A flyer that heals 8/s within 8 m and adds +8 supply |
| Wardens | Bastion | Allies within 8 m take ×0.6 damage |
| Veil | Phantom spire | Allies within 10 m stay cloaked while they stand still |

They are built on `sim/bosses.js` with player-team support (C1), and use ported Tank_game_3D models at about 7 draws each. The player only moves it.
**Why:** Rusted Warfare-style late-game peaks that end turtles with a visible warning and a counter. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** C1, a render-budget check (`boss-battle-eco` is at 116 of 120).

### 5.3 Mechanics (M)

#### M1. Opt-in effects library for every mode
Move the Defence-only effects out of `sim/defence.js` into `sim/effects.js` and `sim/cargo.js`, so any entity that carries the field can use them:
- slow and slow radius, mark and mark radius, shield pierce, bursts, burn on hit;
- expiring units, demolition fuses, cargo and drop.

Add the status effects that new content needs: pin, stun, EMP and smoke-hidden. Each is a lazy field such as `e.fx = {pinUntil, stunUntil, empUntil}`, read in `combat.js`, `movement.js` and the shield regen. Status icons come from one instanced quad.
This is behaviour-neutral for existing content: `combat.hit` keeps calling `garrisonHit` for `e.crew`. Verify with K1, `d071360b` and identical `check:defence --json` output.
**Why:** it unlocks the "richer toolbox locked inside Defence" for U2 to U11, the heroes and the bosses. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### M2. Facing armour (opt-in field)
Port the rule from Tank_game_3D `rules.ts armorMultiplier`. A dot product above 0.55 counts as front, below -0.55 as rear, and anything else as side (×1). The values come from a data field such as `facing {front 0.6, rear 1.5}`. `combat.hit` applies it only to targets that carry the field, and a rear hit shows a "REAR" number. Use it on U6 and on the ported bosses first. Applying it to the existing Tank and Walker would make the Walker's "flanking is the answer" text true, but it changes skirmish numbers and needs owner OK and a bench run.
Files: `sim/combat.js`, `combat-feedback.js`, `balance.json`.
**Why:** flanking gets a payoff, and it is never required. **Size:** S. **Micro:** low. **Existing balance:** no as specified (yes if applied to existing units). **Needs:** nothing.

#### M3. Mines and demolition charges
A new `sim/mines.js` with a lazy `this.mines`.
- **Hidden:** mines use the existing cloak and `seenBy` rule. Kite detect (8 m), towers and cores (9 m) and units within 2 m reveal them.
- **Trigger:** an enemy ground unit within 1.2 m sets one off, for 70 damage in 2.5 m (×1.5 against mechanical units).
- **Visible:** once seen, a mine has 20 HP and can be shot.
- **Limits:** at most 6 live mines per side, drawn as one instanced mesh.

The demolition fuse is shared with Defence `demolish`. Hosts: the Sapper (U5), Okoro's "Mine line" in Defence (D11), and Ashfall doctrine powers (M4).
**Why:** area denial and traps, from the owner's special-weapons plan ("mines"). **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** M1.

#### M4. Doctrine powers in skirmish
An opt-in rule, "Doctrines", that new missions can also use.
- **Choice:** at core L2 each side picks 1 of 2 faction doctrines, locked for the match.
- **Command points:** earned at +1 per 150 value of enemy units destroyed and +1 per 45 s per capture ring held, to a maximum of 10.
- **Powers:** each doctrine has 3 powers costing 3, 5 and 8. Each takes one tap on a point you can see, and shows its warning ring to the enemy.

| Faction | Example powers |
|---|---|
| Meridian | Barrage (3 × 90 in 4.5 m over 3 s), Paradrop (3 Vanguards and a Medic for 40 s), Recon sweep (reveal and detect 25 m for 12 s) |
| Ashfall | Scrap rain (burn 6 m), Frenzy (+30% speed and +15% damage for 10 s) |
| Sunward | Supply drop (heal 150 in 8 m), Forced march, Hired riders |
| Wardens | Shield surge, Lockdown (towers +4 m for 10 s), Repair wave |
| Veil | Blackout (enemy sight -50% in 30 m), Phantom column (decoys), Hunter's mark |

No barricade-type powers (owner veto). The powers reuse Defence `heroCast`, `strikes`, `zones`, `markedUntil` and `expires`. The AI casts with simple rules, such as Barrage on 5 or more units or on a tower.
Files: a new `sim/powers.js`, `balance.json powers`, `app/abilities.js`, a 44 px meter chip in `hud.js`, `ai-counter.js`, `vi.json`.
**Why:** big strategic choices and spectacle at almost no micro cost, like Company of Heroes 3 battlegroups and C&C Generals promotions. It also extends the owner's Defence hero idea to the main mode. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** M1, a faction bench run with doctrines on (pairs kept within 35 to 65%).

#### M5. Fall back, role formations and select by type
These are player-only command flags. The AI never sends them, and old command logs replay the same.
1. **Fall back:** one tap. Selected units run to the nearest own core or Waystation at ×1.25 speed and take ×0.6 damage. They hold fire and cannot be cancelled for 3 s. On arrival they heal 3%/s. This saves veterans.
2. **Formations:** move and attack-move orders from the player UI carry `formation: true`. Melee and armour go in a front arc, ranged units 3 m behind, and support in the middle, checked with `canStand` at the existing 1.9 m spacing. A setting switches it off.
3. **Quick-select:** buttons for "all infantry", "all vehicles" and "all flyers".

Files: `commands.js`, `sim/orders.js`, `sim/movement.js`, `app/command-card.js`, `app/selection.js`, `vi.json`.
**Why:** mixed armies look and fight like armies, and phones get the CoH retreat and Tooth and Tail-style one-press control. **Size:** M. **Micro:** low (it rewards control). **Existing balance:** no. **Needs:** nothing.

#### M6. Concealment brush and explosive props (new maps)
- **Brush:** rectangles in `maps.json`. Ground units inside are hidden from enemies farther than 4 m, unless they fired in the last 3 s. This works through `isVisible`, not `nav.clearLine`, so it is concealment, not the vetoed cover rule. Kites and towers reveal as usual.
- **Explosive props:** fuel drums and ore carts are neutral 60 HP props. They explode for 65 damage in 5 m and set each other off (the Tank_game EXPLOSIVES rule), and they are marked before they blast.

Use them on new maps only (for example a woodland variant or the naval map).
Files: `maps.json`, `terrain.js`, `sim/traits.js`, prop spawning next to `spawnStraightWalls`, `ground-paint.js`, `scatter.js` (instanced reeds, 1 or 2 draws).
**Why:** ambush and trap play for every faction, more value for Watchers and Kites, and maps that play differently. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** S9 helps.

#### M7. Area cover on new maps (owner decision)
This is the STAGE_3 package 3.2 idea. `maps.json cover` zones (woods or ruins): infantry inside take ×0.7 to ×0.75 from direct shots fired from outside the zone and more than 3 m away. Splash and flame ignore cover, so Breakers, Scorchers and Balloons become the answer. Woods slow vehicles by 25%.
No units enter buildings and no barricades are built. But the rule touches the shared damage path, and the owner's 2026-11-16 ruling worried about exactly that, so it needs a new owner decision. M6 is the safe alternative.
**Why:** positioning wins fights (CoH, Iron Harvest), and the AI rallies into cover on its own. **Size:** M. **Micro:** none. **Existing balance:** no (new maps only). **Needs:** an owner decision, S9.

#### M8. Weather and time of day in the sim
Add `sim.weather` with four kinds:

| Weather | Effect |
|---|---|
| Clear | none |
| Storm | vehicle speed ×0.8, vision ×0.75, shield regen ×0.5 |
| Dust | ranged range ×0.85, flyers grounded for 30 s every 4 min with a 15 s warning |
| Night | vision ×0.6 |

Each faction gets one perk in `balance.json weather`, in the spirit of Northgard's winter: Ashfall +10% damage in dust, Wardens shields 1.5× in a storm, Veil cloaks faster at night, Sunward roads unaffected.
It is set by a mission action `{weather: id}` or the skirmish option "Weather: Clear / Changing". "Changing" adds the first `sim.rng` (mulberry32 from `options.seed`, saved in `snapshot.js`; see S15).
**Why:** the same army has to fight differently, and the story's storms and nights become real. **Size:** M. **Micro:** none. **Existing balance:** no (new content and the option only). **Needs:** P10 for the visuals, S15.

### 5.4 Campaign, story and bosses (C)

#### C1. Boss engine extensions
Add to `src/sim/bosses.js`:
- `attacks.count` and `spread`, for N zones at once with their own warnings;
- `target: "building"`;
- a strafe move between attacks;
- `route`, to walk a polyline or a Defence route between attacks;
- a building `stunUntil`;
- `shieldedBy: tag`, so the boss takes ×0.2 while tagged units live;
- flying bosses, which only units that hit air can hurt until they land;
- one boss per team, so team 0 can field a boss.

Keep the cap at 30% of a Ranger's health per attack and the walk-out warning rule, and extend `tests/bosses.test.js` and `tests/render-budget.mjs`.
**Why:** every later boss in BOSSES.md, the Defence bosses and U13 are blocked on these features. **Size:** M (L with flying). **Micro:** low. **Existing balance:** no. **Needs:** nothing.

#### C2. Distinct objective-structure models (client only)
Six Blender-kit models from a new `tools/blender/generate_objectives.py`:
- the Ashfall siphon (a mast with a beam to the sky);
- the jammer (a dish truck);
- the Veil damper (a violet obelisk in a cage);
- the draw conduit (a pipe pylon);
- the Keystone draw engine (a ring-and-spike machine about 3× the relay's footprint);
- a refinery and beacon pair.

They are picked by the existing `name` field through a table in `src/model-roster.js` read by `view.js`. Mission data is untouched, so the checksums stay. Add a render-budget scenario with the engine on screen.
**Why:** 33 objective spawns are a Supply relay with a label today. This is the cheapest visible step toward AAA. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### C3. Night and storm looks per mission (client only)
A `MISSION_LOOKS` table, read by `environment-view.js` and `view.js`, overrides the sky, fog, sun and lamps:
- **Night**, for m08 "night 38" and cv1 "Night Count": very dark blue sky, black-blue water, moonlight, brighter team glows and lamps (the owner's night bar).
- **Storm**, for m10 and the last 4 minutes of m06: dark clouds, with lightning flashes from `fx.js`.

Eco gets only a palette swap, with no new lights.
**Why:** it fixes the most visible clashes between story and screen, with no rule change. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### C4. Mission hazards library
Let a danger zone belong to the mission instead of a boss: `team: -1`, hostile to all. Add the actions `{hazard: {id, regions, every, radius, damage, until}}` and `{stopHazard}`. Warnings follow the existing radius rule, and auto-evade works for every team. On top of this, build reusable rules:
- **storm cells**;
- **rising flood**, on low ground below plateau height;
- **advancing firestorm**, a line moving at 0.4 m/s;
- **night cycle**, 4 minutes of day and 2 of night with a night-only wave;
- **rail convoy**, destroy 8 of 12 trains;
- **relic race**, against a rival AI.

Write `tests/hazards.test.js` (determinism, saving mid-warning, no state until used), and use the rules in new missions first.
**Why:** StarCraft II's Wings of Liberty campaign feels varied because nearly every mission has one map rule (lava, fire wall, night, trains). **Size:** M (L for all six). **Micro:** low. **Existing balance:** no. **Needs:** C3 for the looks.

#### C5. Campaign hero rules (corrected cast)
Package C2 of the heroes plan. Move hero state from `defence.hero` to a generic `e.hero` with `sim.heroes`, so `heroMove` and `heroCast` stop requiring `sim.defence`. Powers come from a new `src/story/heroes.json`. A downed hero returns after 30 s, and state is created only when a mission places a hero. Add a passive aura per hero and hero levels 1 to 5 carried across missions, with power 2 at level 2 and an upgraded power at level 4. Both powers can autocast.

**Fix the plan's table first.**
- Player-side heroes:
  - **Mira Vale** (Ranger): squad Rapid fire within 6 m, and a Recon flare that reveals 18 m for 8 s.
  - **Tobi Okoro** (Engineer): Fortify, and Retune, which repairs a relay or building by 30% over 4 s.
  - **Tamsin Sol**, from m09 (Rider): Dash for Riders within 8 m, and a Supply drop that heals in 5 m.
- Enemy side:
  - **Hale**, only in the finale (C11).
  - A Veil seer and an Ashfall foreman, with names for the owner to approve.

Write `tests/heroes.test.js`, and teach the ObjectiveBot "cast when 3 or more enemies are in reach".
**Why:** no one in the cast fights on the field today, unlike Iron Harvest, Warcraft III and Northgard. Most new missions need this. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** owner approval of the plan (F1 to F8) and of the corrected cast.

#### C6. m08b "Breaking Camp": Sol leaves the Pact
Day 41, between m08 and m09. The player's 14-unit strike group starts on a ridge above the Pact camp, where Sol's 5 wagons are loading. At 1:30 the Ashfall garrison turns on Sol, through a new logged action `{switchTeam: {tag, to}}`.
- **Phase 1:** hold the south gate for 3 minutes.
- **Phase 2:** escort the wagons out. Take the plateau road (slower, hidden from below) or the low road (faster, with two marked ambushes).

Sol rides as an allied hero. You win with at least 3 wagons out, and gold needs all 5. The flag `m08b-wagons` changes only Sol's m09 line, so knife-edge m09 keeps its balance. The planned sol-crosses scene is built here.
**Why:** the rival-to-ally turn is the campaign's emotional spine, and today it happens off-screen. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** C5 (or Sol first as a named Rider without powers).

#### C7. m09b "The Sovereign Walks": boss hunt
Day 44, on a new 160 m map, "Basalt Steps". Port the Iron Sovereign (`boss-walker.glb`), with a three-shell spread and a sideways strafe. It walks toward the Veil gate at 1.2 m/s and stops at three relays for 60 s each. Each stop is guarded by 2 Pylons that make it `shieldedBy`: break them to open its core.
Okoro pays off his m03 line ("I would like to see how it was put together"). The player gets the rebuilt Iron Vanguard as a team-0 boss that fights with no orders. If the Sovereign reaches the gate, the mission is still won when its escort column is broken, and it returns as a guard in m13.
Files: `balance.json`, `sim/bosses.js`, `boss-view.js`, `boss-ui.js`, `story/missions.js`, `story/scenes.js`, the tests.
**Why:** a hunt on a moving target, and a boss-against-boss moment, like the Odin in SC2's "Media Blitz", that leaves m09 untouched. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** C1.

#### C8. m09c "Forty Lights": Maren's record
ECHO opens the Veil camp record, and the player plays Maren's first camp, 30 years ago, on the Obsidian Highlands in storm light. The army has no base: Maren as a hero (Vanish, and Lantern call), 4 Watchers and 4 Medics. 40 survivors in 8 huts follow the nearest Veil unit on their own, so herding needs no micro. A storm front of hazard cells (C4) advances every 60 s. You win with at least 24 survivors saved in 12 minutes, through a new `need` count on `escort`. The flag `m09c-saved` changes Maren's plea in m10.
**Why:** the campaign's best motive becomes playable, and the storm hazard is taught before m10. **Size:** M. **Micro:** medium. **Existing balance:** no. **Needs:** C4, C5, a follow rule.

#### C9. m11c "Hold the Keystone Roads": the Defence package in the story
A third campaign Defence mission, between m11 and m12, on Three Roads (`crossroads`). A new `HOLD_THE_ROADS` in `src/story/defence-missions.js` copies `zones`, `armour {cap 2}`, `commander` and the carrier groups from `levels.js`. It has 10 waves of Ashfall, Wardens and carriers, with a Walker-led column in wave 8, and story beats on `waveStart`. The Commander takes the field in the story for the first time.
**Why:** it brings the owner's whole Defence package into the campaign and breaks up the run of base missions in Act 3. It is mostly data. **Size:** S. **Micro:** low. **Existing balance:** no. **Needs:** D1.

#### C10. m11b "Two Keys": stealth commando
Night 53, on the expanse. Vale and Okoro lead an 8-unit squad with no base.
- **Converting:** Okoro's Retune, held for 20 s on a Warden Pylon, converts nearby Drones and Walkers to the player (a new logged action, `convert`).
- **Being spotted:** Ashfall watch posts trigger `when: {spotted: {team, region}}`, built on `isVisible`. Being seen calls a patrol and never fails the mission.
- **Goal:** retune 3 Pylons and march the converted column on Hale's gun battery.

**Why:** two styles the campaign lacks: stealth that never punishes with failure, like SC2's "Ghost of a Chance", and growing an army by conversion. **Size:** L. **Micro:** medium. **Existing balance:** no. **Needs:** C5, C3.

#### C11. m13 "The Grey Coat": Hale on the field
After m12's engine falls, Hale pilots the Siege Marshal (`boss-siege-mech.glb`). It alternates a cone sweep with circles aimed at buildings, and calls an escort wave at each stage.
- **Phase 1:** hold the Keystone circle for 90 s while ECHO tunes it (the planned echo-says-i scene).
- **Phase 2:** the duel. Sol, Okoro, and Maren if she was spared, fight as heroes.
- **At 25%:** the mech kneels (C21). Taking Hale to the core is capture, which counts as mercy. Destroying the mech lets him eject, the firm outcome. He lives either way.

Earlier choices feed in: if the alloy was returned in m03, he yields at 40%. The ending scenes move from m12 to m13. That re-pins m12's checksum through text and triggers only.
**Why:** the antagonist finally appears, and mercy is chosen on the battlefield. This is the owner's "mission 13 finale" slot. **Size:** L. **Micro:** low. **Existing balance:** **yes** (m12's ending trigger moves). **Needs:** C1, C5, C21.

#### C12. Side operations: other factions and new bosses
New campaign-map nodes between acts. No existing checksum moves.
- **"Grey Wall"** (Wardens as team 1): a Walker line with Pylon shields. Win by flanking up a ramp, or with the EMP once U11 ships.
- **"Night Count"** (Veil): night light and cloaked Shades. The player gets Watchers and Kites, and must find 4 relays.
- **"Caravan Run"** (Sunward): intercept 3 moving wagons, a new `intercept` objective on tagged units.
- **"op-atlas"**: the Atlas Launcher (`boss-missile-truck`, 2 circles of 7 m).
- **"op-rail"**: the Rail Titan (`boss-rail`, a 40 to 50 m line 2 m wide).

**Why:** Ashfall is the enemy in all 15 missions. Missions built around another faction's way of fighting give the most variety per mission and reuse existing rosters. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** C1, C3.

#### C13. m10b "Glass Lake": naval landing
Day 50. The draw's west conduit is fed from three islands in a highland lake. Build a Port, ferry a Harvester and guards, and hold 2 of 3 island relays for 1 minute while Hale's gunboats contest the water. A sunk transport can be rebuilt, and losing all three only triggers a warning.
**Why:** the owner's naval idea enters the story with a new style, amphibious control. **Size:** L. **Micro:** medium. **Existing balance:** no. **Needs:** S17.

#### C14. Campaign fork after m10
After m10, the campaign map shows two nodes, each with a reward in m13:
- "The Sovereign Walks" (C7), which brings the Iron Vanguard;
- "Glass Lake" (C13) or "Two Keys" (C10), which brings a Transport drop or the converted Wardens.

The other branch stays playable on replay but does not count toward the record. Replace the "the one before it" rule with `after: [ids]` in `src/campaign.js`, and draw the fork in `campaign-map.js`.
**Why:** player choice of path, as in SC2 and C&C, which adds replay value. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** two of C7, C10 and C13.

#### C15. Consequences you can see
1. **A "Remembered" row** in the briefing and debrief lists each earlier decision that changed this mission, for example "Hale sent one Breaker fewer: you returned the alloy". It is a client-side table.
2. **The 3 existing decisions get effects in the new missions only:** pact "share" gives C6 3 extra Riders, "spare" puts Maren on the m13 field, and "return" makes Hale yield earlier.
3. **New decisions in C6 and C7.** Their defaults stay firm, so m12's resolved checksum stays.

Whether the ending rule becomes "at least half merciful" is the owner's decision.
**Why:** choices feel weighty without re-tuning the knife-edge missions. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** C6, C7, C11.

#### C16. Allied units in their faction colours
Units on team 0 tagged `sunward` or `veilFriends` get their faction's trim and emblem: Sunward gold, Veil violet. The batch key gains a tint variant, and the minimap shows an allied dot. The rules do not change. Check the cost (+2 to 4 draws).
**Why:** "the Caravan rides with you" today shows Meridian Vanguards in Meridian teal. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### C17. Camp, Archive and Armory between missions
1. **Archive (B6):** cast, faction and place entries that unlock as you meet them, written from `story/world.js`, in a new `app/archive.js`.
2. **Camp:** 2 or 3 optional portrait lines after each debrief, a light version of SC2's Hyperion.
3. **Armory**, run by Okoro: each unit has two passives with one active, swapped freely between missions. Requisition comes from medals, bonus objectives and bosses. No barricade passives. Examples:

| Unit | Passive A | Passive B |
|---|---|---|
| Ranger | AP rounds (pierce half of shields) | Overwatch (+2 m on Hold) |
| Breaker | Incendiary shells (2 s burn zone) | Spotter link (+4 m Barrage range near a Kite) |
| Anti-tank | Tandem warhead (mechanical ×7) | Light launcher (speed 4.4, supply 1) |
| Tank | Coax gun (6 damage every 0.5 s at 6 m against infantry) | Reactive armour (the first hit every 8 s is halved) |
| Medic | Field surgeon (heals 18) | Smoke on Triage |
| Kite | Flare | Long eye (vision 22) |

The picks go to the Simulation as options, like `flags`, so mission data stays put. `check:missions` runs with no upgrades and with all of them, and an all-upgrades run must not win more than 25% faster.
**Why:** progress between missions, a reason to earn medals, and a personal fighting style built only from passives (SC2 Armory, HotS mutations). **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### C18. Veterans who carry over
Build STAGE_4 package 4.4. The six highest-ranked surviving combat units are saved as `veterans [{type, rank, kills, name}]`, with names from a fixed list. They spawn beside the core, unless a mission sets `rules.veterans: false`. Add a "Carried forward" row and a death notice by name. `check:missions` runs with none (identical to today) and with six rank-2 veterans, and the veteran run must not be faster than 0.75× the baseline.
**Why:** attachment, as with CoH's veteran company. Careful players are rewarded without being asked for micro. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** M5 (Fall back) helps.

#### C19. Chronicles: decision, scene and lead hero
Each of the 4 Chronicles gets:
- one decision in its second mission (for example Ashfall: spare the raiders' water);
- one staged scene;
- its lead as the player's hero in the third mission (Hale, Sol, ECHO's avatar, Maren).

The decisions add a finale line through `if: {chronicle}`, which already exists.
**Why:** the Chronicles have 0 decisions, 0 scenes and no heroes, so they play like skirmish variants. **Size:** M. **Micro:** low. **Existing balance:** **yes** (the Chronicle missions change). **Needs:** C5.

#### C20. Rewrites of existing missions (owner OK only)
1. **m10:** storm cells until the Crown is tuned.
2. **m06:** storm cells from 16:00.
3. **m12:** the engine vents a ring zone at 66% and 33%.
4. **m09 to m12:** `rules.air: true`, so air comes back.
5. **Heroes:** Vale leads m08, and Sol joins m09 as a hero.
6. **Scenes:** the 4 planned ones (beam-to-orbit, one-circuit, sol-crosses, echo-says-i).
7. **Medals:** m07 earns medals from its optional objectives.

Each needs `check:missions` on all difficulties with `--decide`, plus re-pinned checksums.
**Why:** it fixes the places where the story and the mechanics disagree, but m09 and m12 are knife-edge. **Size:** M. **Micro:** low. **Existing balance:** **yes.** **Needs:** C4, C5, owner OK.

#### C21. Yield and capture (prisoners slice, campaign only)
- A `yield` action at an HP threshold, through `tagHpBelow`.
- A `capture` objective and a `take` command.
- The ransom shown in the debrief.
- The ObjectiveBot learns to take a yielding boss.

Used first by C11 and one enemy hero-boss in a C12 operation: an Ashfall warlord on a Scorcher base. Whether captures count toward the ending is the owner's decision.
**Why:** capture against kill ties the fights to the endings system. **Size:** M. **Micro:** low. **Existing balance:** no (yes if captures change the ending count). **Needs:** C5, owner approval.

### 5.5 Defence (D)

#### D1. Fix the promotion health bug
In `tactics.js creditKill`, use `(e.baseHp ?? D[e.type].hp)`. Set `e.baseHp` wherever a unit gets extra health:
- in `spawnCommander` (D.hp × the commander's factor);
- in `spawnArmour` and `armourBoost`;
- in `spawnQueued` and `dropCargo` when the health factor is not 1.

Units without `baseHp` (every skirmish and campaign unit) compute exactly as before, so `d071360b` holds. Add cases to `tests/defence-ranks.test.js`: the commander keeps 936 × 1.08 after one promotion, and a Bulwark tank keeps 1,193 × 1.08. Re-run `check:defence` and log the shifts.
**Why:** the hero and armour upgrades lose up to 40% of their health today. **Size:** S. **Micro:** none. **Existing balance:** **yes** (Defence results shift; it is a bug fix). **Needs:** nothing. Do it first.

#### D2. Fast-forward ×2 (×3 on PC)
Multiply the accumulator in `app/frame.js` by `S.speed`. The sim still ticks at 0.05 s, so replays and hashes are identical. Add a 44 px toggle (key F), drop back to ×1 during scenes, and let the governor fall back to ×1 if phone frame time goes over budget.
**Why:** standard in every shipped TD game. Early waves are slow (first wave at 30 s, 16 s gaps). **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### D3. Tower targeting priority (C6)
A new command `padAim {building, aim}` with four modes:
- **near**, the default and today's rule;
- **first**, the unit with the most route progress, from `leg` and the fraction of the leg;
- **strong**, the unit with the most HP plus shield;
- **air**, flyers first.

Store `e.aim` only once it has been changed, so saves and bot runs do not change. Add one cycling tile with a 12 px label.
**Why:** one button of depth (Marksman on the strongest, Anti-tank on air) that needs no control. **Size:** S. **Micro:** low. **Existing balance:** no. **Needs:** nothing.

#### D4. Trait chips, new-enemy card and phone stats
- **Intel strip:** 12 px chips per unit: armoured, flying, cloaked, healer, carrier, heavy shield (shield of 100 or more), elite and boss.
- **New enemy:** a Kingdom Rush-style card the first time a type appears (`progress.seen`). It shows the traits and the 2 crews that counter it, and closes after 6 s.
- **Tower sheet:** damage per second, range, ×vs armour, air yes or no, and next-tier deltas, shown as text rather than in hover tooltips.

**Why:** players know why a wave will hurt before they call it, and phones never show tooltips. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### D5. Zones and armour on the older levels
Add 2 to 4 `zones` to d-gorge, d-bridges, d-switchback, d-fordwood, d-canyon and d-longcrossing, each clear of the roads, and `armour {cap 1}` to the three river levels. Do the same for m02b and m07b if the owner wants. Re-run `check:defence`, and let the bot use zones as it does on Three Roads.
**Why:** the owner's "people want to optimise placement" request reaches 1 of 7 levels today. **Size:** M. **Micro:** none. **Existing balance:** **yes** (the bot tables for 6 levels move). **Needs:** owner OK, D1.

#### D6. Elite affixes
A wave-group field `elite: [...]`, applied as lazy fields at spawn. Each elite gets ×1.6 HP, a gold ring (one instanced draw) and ×3 bounty, plus one affix:

| Affix | Effect | Answered by |
|---|---|---|
| Plated | Shield ×2.5, back after 2 s | Pierce ranks, Anti-tank |
| Swift | +35% speed, -20% HP | Suppressor slow |
| Splitter | Drops 2 to 3 Scrappers on death | Cluster splash |
| Volatile | 40 damage in 2.5 m on death | Rim pads, range |
| Banner | Allies within 7 m take -20% damage | Kill first (Marksman) |
| Ward | Shield recharge 40/s after 1.5 s (needs `shield_regen`; `simulation.js:316` hard-codes 4/s) | Bursts |
| Mender | Heals 40 within 7 m every 6 s | Barrage |
| Regen | Wardens self-repair, 3%/s after 3 s | Steady damage |
| Shrouded | Veil cloak | Watchers, Far-eye |

Use them only in new levels, challenges, Elite Endless and Endless from wave 11, so the designed waves stay the same. Each gets an intel chip (D4).
**Why:** Bloons TD 6's camo, lead, fortified and regrow properties are why players mix towers. Without them, the 6 crews × 4 branches differ mostly in damage per second. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** D4, M1.

#### D7. Six enemies built for tower defence
Add them as `defence: true` units, like the carrier:

| Unit | Faction | Stats and behaviour | Tests the player's |
|---|---|---|---|
| Courier bike | Sunward | 70 HP, 20 shield, speed 8.5, comes in packs of 10 | slows |
| Ward-bearer | Wardens | 180 HP, 260 shield, recharges 40/s | pierce |
| Scrap hauler | Ashfall | 600 HP; drops 3 Scrappers on death | splash |
| Sapper bomber | Ashfall | Speed 6; detonates within 5 m of a tower for 220 damage in 3 m | deep pads and far zone spots |
| Burrower | Veil | Untargetable on legs marked `burrow`; surfaces before the exit | crews near the exit |
| Siege ram | any | 900 HP; attacks only blockers, which hold it for just 0.5 s | blockers |

Also add a group flag, `abilities: true`, that lets that group autocast (Shield wall, Dash, Brace) without touching existing waves. Extend the bot's `chooseCrew`, and add one rules test per trait.
**Why:** each trait makes a different crew or placement the right answer. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** D4.

#### D8. Road bosses (C2)
Use C1's `route` mode in Defence. A boss follows the road at the level's pace and stops to attack. A leak costs 10 lives. "Break the attack": 600 damage during the 3 s warning cancels it and opens the core for 6 s, a reward that is never required.

| Boss | Model | HP (Standard) | Signature |
|---|---|---|---|
| Iron Sovereign | `boss-walker.glb` | 12,000, 300 shield | Stomps a 5 m circle on the most-upgraded towers for 150 damage and a 4 s stun; drops 4 Drones at 2/3 and 1/3 HP |
| Atlas Launcher | `boss-missile-truck.glb` | 10,000 | 3 circles of 4 m on towers, 120 each |
| Sky Wraith | `boss-helicopter.glb` | 7,000, flying | Only air crews can hit it until it lands for 5 s each cycle |
| Rift Stalker | `boss-spider.glb` | about 9,000 | Drops 4 Scrappers at 75%, 50% and 25% HP |

Size the HP with the bot so the boss alone is 1.0 to 1.3× wave 10's strength. Place bosses in new levels (D15), Heroic finales (D13) and every 10th Endless wave. Budget: about 7 draws plus 1 mark.
**Why:** a climax per level and a showcase for the owner's boss models. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** C1, D6.

#### D9. Vanguard barracks crew (blockers)
A new `barracks` crew with no gun, costing 90, 70 and 110 for its three tiers.
- **Soldiers:** it keeps 3 Vanguards (×1.3 HP) on a rally point within 10 m. The point defaults to the nearest road point, and moving it with a tap is optional.
- **Blocking:** they are blockers like Reinforce, and each respawns 12 s after it falls.
- **Tiers:** tier 2 adds a 4th soldier, and tier 3 gives ×1.5 HP.
- **Branches:** Shield line (auto Shield wall, ×1.4 HP) or Lancers (Anti-tank soldiers, ×3 against machines).
- **Ranks:** each rank shortens the respawn, from 12 s to 9 s to 6 s.

It reuses `heroCast` reinforce, `blockersNow` and `ringSpots`. Offer it on new levels and challenges first. Adding it to the 7 existing levels needs owner OK.
**Why:** holding enemies in the kill zone is Kingdom Rush's signature, and it makes Scorcher and Breaker combos work. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** a bot rule.

#### D10. Signal relay support crew
A new `relay` crew with no attack, costing 120, 90 and 130. Towers within 9 m fire 15%, 20% or 25% faster (by tier) and reach 1 m further. Its two branches:
- **Overwatch:** +10 m reveal, and towers in the radius can hit air.
- **Supply:** +25% bounty in the radius and +15 alloy per wave.

The buff is refreshed each tick like `traits.js` auras and shown as a ring. The bot places it where it covers the most towers.
**Why:** a cluster-or-spread placement puzzle that suits build zones, like the Village and Farm in BTD6. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### D11. Commander choice with in-match levels
`garrisons.json` `commander` becomes `commanders`, picked in `app/defence-entry.js` and unlocked by stars:

| Commander | Power 1 | Power 2 | Level 3 power |
|---|---|---|---|
| Field commander (default) | Barrage | Reinforce | Overdrive |
| Okoro, Siege engineer (Walker base) | Rail lance: a 40 × 2 m line, 260 damage, cooldown 45 (Rail Titan pattern) | Workshop: towers within 10 m mend 25% and fire 20% faster for 8 s | Mine line (M3) |
| Vale, Sky marshal (Storm Kite, scaled `boss-quadcopter.glb`; flies, never blocks) | Missile salvo: 3 circles of 4 m, 70 each (Atlas pattern) | Flare: reveals and slows the column 35% within 10 m | Smoke |
| Sol, Outrider (Rider base) | Dash intercept | Supply drop: +40% bounty for 15 s | Hired riders |

The in-match level is 1 + floor(waves cleared / 2), up to 5. Each level gives +8% HP and damage, the third power comes at level 3, and the powers are empowered at level 5. To keep the existing bot results, give levels only to the new commanders, or flag the change. All powers can autocast.
**Why:** the hero is the emotional centre and the replay lever of Kingdom Rush and BTD6. This is the owner's "hero with a special weapon", with Tank_game weapons. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** D1, M1, C1 (the line zone).

#### D12. Commander tree replaces the perks (C7)
5 tracks × 3 nodes costing 1, 2 and 3 stars (30 stars in all):
- **Barrage:** radius, damage, a second shell.
- **Reinforce:** +1 Vanguard, +5 s, Shield wall.
- **Commander:** HP, respawn 20 → 14 s, starts at level 2.
- **Logistics:** +20 starting alloy, 70% sell refund, early-call bonus.
- **Crews:** tier 1 -5%, repair 5%/s, +1 m on rim pads.

The 3 current perks map onto nodes, so old saves keep them, and a respec is free. It applies only through `defenceVariant`, and the bot plays without perks.
**Why:** today there is nothing left to earn after about 12 stars. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** D13 (more stars to earn).

#### D13. Heroic and Iron challenges (C5)
Add `challenges` per level, built by `defenceVariant` like Endless:
- **Heroic:** 6 elite waves and a boss or elite finale, 1 life, fixed alloy.
- **Iron:** one long wave with two crews allowed, for example Gorge with Ranger and Tank only, and 1 life.

Each gives +1 star and a badge, so there are 14 extra stars. `defence-check.mjs` gains targets: the bot wins each challenge, and passive play loses.
**Why:** Kingdom Rush's replay structure turns 7 levels into 21 fights at little map cost. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** D6, and D8 for some finales.

#### D14. Level rule variants (C4)
Variants beside the designed levels, which stay the same:

| Variant | Rule |
|---|---|
| Night Gorge | Tower sight ×0.6, Watchers light the road, the owner's night palette |
| Sandstorm Canyon | Every 3rd wave: -2 m range, flyers grounded for 20 s |
| Tidal Fordwood | The ford floods for waves 4 to 6, through a `tides` schedule that reuses `crossings` and `rerouteWaves` |
| Two-gate Long Crossing | `exits` with 10 lives each; losing either gate fails |

**Why:** levels should play differently, not just look different. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** C3 (looks).

#### D15. Levels 8 to 10
Each has 12 to 15 waves, zones and armour.
- **Iron Causeway:** 128 m, a long causeway with side zones, Wardens, and the Iron Sovereign as the finale.
- **Harbour Landing:** landing craft are carriers with `amphibious: true` that cross water like flyers and land squads on 3 beaches. Ashfall, with an Atlas finale. A cheap first test of the naval ideas.
- **Skyfall Relay:** Sunward air, with the Sky Wraith.

Each needs bot targets, render-budget scenarios and Vietnamese strings.
**Why:** 7 → 10 levels, and a difficulty arc that ends on spectacle. **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** D6, D7, D8.

#### D16. Harder Veteran, Endless escalation and Daily modifiers
- **Veteran:** add `bounty {veteran: 0.8}`, and raise the check target to 2★. Today Veteran pays more bounty than Standard, so the bot ends it with more gold-tier towers.
- **Endless:** from wave 11 one group per wave is elite, every 10th wave brings a boss, and every 10 waves a new unit tier joins. Tune it so the bot falls between waves 25 and 35 on Standard.
- **Daily:** the seed picks 1 or 2 modifiers, for example no Scorcher, double bounty with 10 lives, columns +20% pace, or +40 shield on all units.

**Why:** a real challenge for good players, and runs that end differently. **Size:** M. **Micro:** none. **Existing balance:** **yes** (Veteran and Endless results). **Needs:** owner OK, D6, D8.

#### D17. Endless field-order cards
Every 5 waves in Endless or Daily, offer 3 seeded cards, such as +15% Ranger damage, +1 m Barrage radius, the next branch at half price, or +1 life per wave for 5 waves. Picking one is a command `defenceBoon {id}`, saved and replayed. If nothing is picked within 15 s the first card is taken, so there is no forced micro.
**Why:** roguelite variety per run, as in BTD6 Odysseys and Rogue Tower. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** nothing.

### 5.6 Skirmish, AI, maps and modes (S)

All AI ideas are gated by `!this.mission`, so the campaign is unchanged. `d071360b` runs with `ai: false` and does not move. They do change skirmish behaviour and the bench tables, so they need owner OK.

#### S1. AI spends what it earns
1. **Keep the heavy unit.** In `ai-counter.js counterChoice`, keep the Tank (or the faction's swap) unless the enemy has 2 or more towers or 60% infantry, and switch to a Breaker only while Breakers number fewer than Tanks + 2.
2. **Balance the economy.** `assignHarvesters(team, energyEvery)`: the AI sends 1 in 6 Harvesters to energy when it has more than 400 energy and less than 200 alloy, and 1 in 3 when energy is below 100.
3. **Save for heavy units.** Above 500 energy, the Barracks holds alloy for the Foundry upgrade and the next energy-heavy unit (Tank, Walker, Hawk, Balloon).

Add a test: a Normal AI against a turtling PlayBot fields at least one Tank or Walker by 600 s.
**Why:** the cheapest single change toward variety. Players start meeting armour columns and flyers that already exist. **Size:** S. **Micro:** none. **Existing balance:** **yes.** **Needs:** owner OK.

#### S2. AI defends every core and ring
Build the threat list per complete core, each with its own `defendRadius`, and per held ring. The nearest home or point-duty group answers each threat. Add a test: 6 Rangers hitting a Highlands expansion draw defenders within 15 s.
**Why:** it fixes a measured exploit, where an expansion lost 1,274 HP with 0 defenders. **Size:** S. **Micro:** none. **Existing balance:** **yes.** **Needs:** owner OK.

#### S3. AI scouting and punishing expansions
From 120 s, and every 120 s after, one fast unit (a Kite once the AI has one) visits the enemy's likely expansion sites and middle deposits. When it finds a new core, the next wave targets that core if it is closer or weaker. The player sees "Scouts spotted near your expansion".
**Why:** hidden expansions are safe today. **Size:** S. **Micro:** none. **Existing balance:** **yes.** **Needs:** S2.

#### S4. AI doctrines
A new `sim/ai-doctrine.js` and `balance.json ai_doctrines`. Each doctrine is a target mix by slot with tech and expansion timings: infantry, armour, artillery park, air wing, fast expand and early rush. Each AI picks one from its personality weights plus a seed roll, and `counterChoice` adjusts the mix rather than replacing it. The setup gets "AI plan: Random / ...", and the briefing says, for example, "Scouts: Ashfall is massing armour".
**Why:** each match against the same faction plays differently, and every unit gets used. **Size:** M. **Micro:** none. **Existing balance:** **yes** (offer "Classic" to keep today's behaviour). **Needs:** S1, S15.

#### S5. Harassment and two-pronged attacks
While the main wave gathers, a group of 3 to 6 of the fastest units (Riders, Scrappers, Shades, Gliders, a Hawk) hits the least-defended mining core. It falls back if outweighed 1.2 to 1, and raids at most once per wave. At Fast and above, the main wave and the raid arrive within 10 s of each other. The existing raid warning and a tower are enough to answer it.
**Why:** pressure in more than one place, as AAA item A4 asks. **Size:** M. **Micro:** low. **Existing balance:** **yes.** **Needs:** S2.

#### S6. Smart AI ability use
For AI teams only:
- Barrage and Burn line aim at the densest cluster, reusing `bossAim`'s pick.
- Shield wall fires when siege targets the Vanguard.
- Lock-on fires only when a vehicle is in range + 3.
- Overdrive fires to chase, or to escape below 35% HP.
- Brace fires when 3 or more enemies approach.
- Triage fires when 2 or more allies are under 60%.

**Why:** abilities become visible tactics. Today Barrage fires at the nearest enemy (`tactics.js:143`). **Size:** S. **Micro:** none. **Existing balance:** **yes.** **Needs:** nothing.

#### S7. Big-map AI
Allow 2 cores on 96 to 128 m maps, 3 on 160 m and 4 on 192 m (Normal and above). Each expansion gets a tower facing the centre. Idle Harvesters repair after a fight, and a lost expansion is rebuilt once it has been safe for 30 s.
**Why:** big maps stall today: Highlands AI against AI hit the 30-minute cap. **Size:** S. **Micro:** none. **Existing balance:** **yes.** **Needs:** S2.

#### S8. Recruit and Warlord levels
Add two entries to `AI_SPEEDS`:
- **Recruit:** Relaxed tempo, 25% less harvest, no towers, first wave at 300 s.
- **Warlord:** Relentless tempo, +30% harvest and +15% production, labelled "bonus income".

The 4 current levels stay exactly as they are. Tune Warlord to a 5 to 20% bot win rate.
**Why:** the bot still beats Relentless 67% of the time, against a 5 to 20% target. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### S9. Map engine
`maps.json` gains optional `bases` (2 to 4 with facings), `rocks`, `water` (rects, discs, polylines), `crossings`, `deposits` (with `rich: 2`), `points` and `objectives`. Missing fields default to today's `ROCKS`, `waterRects`/`CROSSINGS` and `MIDFIELD_DEPOSITS`.
Files: `terrain.js`, the `simulation.js` constructor, `constants.js`, the river code in `view.js:687`, `environment-view.js`, `ground-paint.js`, `minimap.js`. A test asserts that each of the 7 maps produces today's exact layout, and that classic still gives `d071360b`.
**Why:** it is needed before any real map, 4-player layout or naval map. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### S10. Four purpose-built skirmish maps
1. **Ember Pass** (128 m, highland 1v1): a central pass between plateaus, a rich deposit, a back road, and ramp tower spots.
2. **Saltpan Crossroads** (160 m, 4-player FFA): corner bases, a raised hub ring, four watchtowers.
3. **Broken Bridges** (128 m): 5 crossings, two of them bridges you can blow up and a Harvester can rebuild for 150 alloy.
4. **Builder's Yard** (160 m): a dormant neutral boss guards a relic.

Each comes with a design note, bench runs, a stuck-unit soak and a render-budget check.
**Why:** map identity changes where armies fight. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** S9, S11, M6.

#### S11. Skirmish map objectives
- **Watchtower:** a unit in its 4 m ring gives 24 m of vision.
- **Supply drop:** every 150 s at one of 3 or 4 spots, announced 15 s ahead. Hold it unopposed for 4 s to get 150 alloy and 75 energy.
- **Neutral boss camp:** an Iron Vanguard variant of about 8,000 HP. Killing it pays 600 alloy or a 3-minute +10% damage relic.

The AI contests them with point-duty squads. They are on for new maps, with an "Objectives" option on the old ones. New maps may also pay more for rings.
**Why:** AAA item A3. Reasons to split the army, and a skirmish home for the bosses. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** S9, C1.

#### S12. Win modes
A new `sim/victory.js`, called from `settle()`, and a "Victory" option. Annihilation stays the default.
- **King of the Hill:** hold the centre ring for 240 s in total.
- **Frontline:** 500 tickets per side. Each ring you hold beyond the enemy's drains them 1 per second.
- **Commander:** each side fields the Defence commander as a hero, and losing it loses the match.

The AI learns to target the rings and the hill, and the results screen shows the cause of the win.
**Why:** different rules make different fights, and the owner's hero comes to skirmish. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** C5 (generic hero state).

#### S13. AI ally (2v2, 3v1)
A `teams` option read by `hostile()`, with shared vision. The ally runs `coalitionOrders` with the player as leader, joins your pushes, and answers the pings "Attack here" and "Defend here" (minimap long-press on phones, a hotkey on PC).
**Why:** a co-op feel offline, bigger battles, and a testbed for online co-op later. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** S2, S4 help.

#### S14. Last Stand mode
Full base building against waves that attack from 2 or 3 map edges. The waves come from the Defence Endless generator (carriers every 5th wave, a boss every 10th), with the wave intel strip reused. The score is the number of waves survived, with a local best per map and difficulty.
**Why:** a They Are Billions or SC2 co-op style mode, with short sessions and high replay value. **Size:** M. **Micro:** low. **Existing balance:** no. **Needs:** D8 for the bosses.

#### S15. Match seed, daily battle and mutators
Add `sim.rng` (mulberry32) seeded from a new `seed` option and saved in `snapshot.js`. Nothing existing reads it, so old matches are identical.
- **Uses:** it drives S4 picks, S11 drop spots and M8 weather.
- **Daily battle:** a client-side daily picks the map, factions, speed and mutators from the UTC date.
- **Sharing:** a setup can be shared as `#s=`.
- **Mutators:** Armour Age, Air Superiority (air cap 8), Scarcity (deposits -50%, rings ×4) and Veteran Corps (everyone starts at rank 1).

**Why:** something new every day without breaking replays. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K3.

#### S16. Frontier War conquest
A turn-based map of 14 sectors held by the 4 rival factions.
- **Attacking:** attacking a sector starts a skirmish on its map with its modifier.
- **Capturing:** sectors give lasting bonuses: +150 starting alloy, a prebuilt tower, an early Tank, or a veteran squad.
- **Rivals:** they counter-attack between turns.
- **Winning:** take the 4 capitals, each guarded by a boss.

Saved in versioned `localStorage`.
**Why:** the strongest long-term replay hook for a single-player RTS (Dark Crusade, Northgard Conquest). **Size:** L. **Micro:** low. **Existing balance:** no. **Needs:** S4, S10, S12, C1.

#### S17. Naval Phase A
Merged from four reviews. Build it in two steps.
- **A0, quick:** a hover transport (6 supply of infantry over land and water, reusing the cargo from M1) and an amphibious Skimmer light tank (×0.7 speed on water). Islands become capture points. No water nav grid yet.
- **A1, full:**
  - Terrain: a 1 m sea mask (deep, shallow, shore) for sea maps only, with `seaNav = new Navigation(new SeaView(terrain))` reusing A*, a naval branch in `movement.js` next to the flyer branch, and `separate()` skipping ships against ground units.
  - Units: the Port, the Gunboat and the Ferry.
  - **No load/unload micro:** ordering ground units onto an island walks them to the nearest Port, where they board and land at the nearest beach.
  - AI: it finds island deposits with `nav.regions()`, builds a Port, guards it with 2 Gunboats and ferries a Harvester with guards.
  - Map: "Two coasts, three islands" at 192 to 224 m rather than 256 m. A 128 × 128 grid makes each route search 1.8× dearer under the budget of 6 routes per tick.
  - Rendering: one water mesh, shore foam and instanced ships with wakes.

**Why:** the owner's top unbuilt idea, and the only entirely new way to fight on the list. **Size:** L. **Micro:** low (with the auto-ferry). **Existing balance:** no. **Needs:** S9, M1, the owner's NAVAL_PLAN decisions (map size, island alloy).

#### S18. Achievements and challenges
A new `src/achievements.js` (about 30 entries, stored as `frontier-achievements-v1`) and `src/story/challenges.js`. Per-mission challenges include noLoss, noBuild, an army cap and an ability count. They are judged from `match-stats.js` and events at match end, so mission definitions stay. Add a toast queue that never covers the dock, pips on the campaign map, results rows, and cosmetic unlocks (army colour presets, emblem frames).
**Why:** Stage 5 is untouched, and challenges push players toward styles they would skip. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### S19. Replay viewer
Keep `{options, commandLog, version, hash every 600 ticks}` at match end and store the last 3. A spectator HUD offers 1×, 2×, 4× and 8× speed, scrubbing by re-simulating, and a fog toggle. It reuses the P7 camera auto-follow.
**Why:** it shows off the deterministic engine, and fights become worth watching again. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** P7.

### 5.7 Presentation (P)

#### P1. Give phones their battlefield back
Target: at least 70% of the screen shows the battlefield, in both portrait and landscape. Today it is 50% and 53%.
1. Collapse the dock to its 56 px tab strip when nothing is selected.
2. Replace the 7-button touch row with Army, Workers and a "..." sheet, and hide +/- (pinch already zooms).
3. Show dialogue as a one-line chip at the bottom left that expands on tap.
4. Move fight and counter hints into the dock.
5. Drop the "Eco/High" badge.

Add an `elementFromPoint` open-share assertion to `tests/ui-quality.mjs`.
**Why:** every other visual upgrade is wasted if the fight cannot be seen. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P2. "Balanced" render tier
A quality level between Eco and High. It renders at min(dpr, 1.5) and uses a 1,024 shadow map in which only units and buildings cast shadows. If that breaks the budget, it keeps blob shadows plus contact AO instead. Make it the default on touch devices, and let `governor.js` step down to Eco when the first 10 s run over budget. Add `battle-balanced` and `defence-big-balanced` render-budget scenarios.
**Why:** a 3× phone draws 1/9 of its native pixels today, with no shadows. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P3. Readable armies at strategic zoom
1. A view-only unit scale that grows from 1.0 at zoom 40 to 1.6 at zoom 90 or more. Collision radii do not change.
2. Above zoom 60, a team-coloured pip of constant screen size over each enemy group, with icons for carriers and elites. It uses the existing instanced quad, so 0 new draws.
3. Defence on phones opens at road zoom (about 55) and follows the wave front.
4. Extend the 28 px rule to 844 × 390 and to Defence.

**Why:** Three Roads tanks are 7 to 10 px tall on phones. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P4. Distinct weapon looks and ability moments
New styles in `visual-style.json weapons` and new kinds in `fx.js shot()`/`hit()`, all from the existing pools, so 0 extra draws:

| Shooter | Look |
|---|---|
| Scorcher | A cone of flame puffs and embers, with a small scorch |
| Shade | An instant white-violet beam and a ring |
| Drone | Twin blue laser pulses |
| Scrapper | A 3-pellet spread with metal sparks |
| Hawk | Pod rockets with smoke trails |
| Glider | A dropped bomb |
| Rider | Fast twin tracers |
| Iron Vanguard | Heavy orange tracers from the shoulders |
| Vanguard | A 3-round SMG burst |

Add faction tints for shared weapons (Veil green rail, Ashfall orange spit, Wardens blue arc, Sunward dust) and moments: a Brace shockwave, a decloak shimmer, a Rush dust wake and an Overdrive exhaust. Extend `tests/battle-fx.test.js` so every armed type resolves to a style on purpose.
**Why:** fighting styles become visible, and the "colours off" screenshot test passes. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P5. Counter-hit feedback and damage numbers
View only: in `WorldView.event('impact')`, a hit counts as effective when `D[source].counter === D[target].class` or the mechanical bonus applies.
- **Effective hit:** a gold flare, bigger sparks, a gold ghost flash on the health bar, and a "crit" sound layer.
- **Resisted hit:** a dull grey puff.

Optionally, port pooled numbers from Tank_game_3D `hit-feedback.ts` (summed per 0.14 s), on by default only for bosses and Defence, with a setting. Then show the "X counters your Y" tips less often.
**Why:** players learn the counters by watching instead of reading tips. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P6. Varied deaths
1. A tank, Walker or Breaker killed by a heavy round throws its turret as a spinning piece.
2. Infantry killed by splash are thrown in an arc along the blast.
3. Bake the unused Death and Attack clips in 8 GLBs into per-group keyframes at load, with no `AnimationMixer` per unit.
4. Author Death clips for the Scrapper, Scorcher, Walker, Rider, Shade, Watcher and Drone in `tools/blender/animate_units.py`.

Keep the wreck cap of 24.
**Why:** AAA item A5, and it uses art that already ships. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P7. Battle camera and threat arrows (A2)
Tapping the "Under attack!" toast, the Fight button or key G pans to the densest cluster of impacts and deaths from the last 4 to 5 s, bucketed on a 16 m grid. A second tap returns to the previous view. Port `Tank_game_3D/src/three/threat-arrows.ts`: up to 4 red edge arrows toward your own units under fire off-screen, DOM only.
**Why:** a portrait phone sees about 36 m across, so flank attacks arrive unseen. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P8. Boss presence pack
1. A view-only ×1.5 scale for bosses (exempt from `maxModelScale`), so the boss stands about 2.5 tanks tall.
2. Footfall dust and a local shake.
3. New scene beats: `title` (a name card), `shake` and `slow`. Clear the old dialogue line when a scene starts.
4. A boss music mood.
5. 1.2 s of slow motion on the boss's fall before the debrief. Extend `beginBeat` to boss deaths and to the objective that ends the mission.

**Why:** today the boss reads as a big tank, and the win cuts straight to a stats card. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P9. Colour grade and team rim light
1. A `CustomToneMapping` chunk with no extra pass: +10 to 15% saturation per theme, warm shadows and a slight contrast curve, set by a `grade` key in `visual-style.json`.
2. A Fresnel rim term in `bakedMaterial()`, tinted by team colour through the existing instance tint, so dark hulls get a red or teal edge.
3. Lighten the classic fog (`#190f24`).

0 extra draws.
**Why:** it moves the whole game toward the owner's vivid "Mario Kart 8" bar, and the armies read by colour. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P10. Visual weather
A new `src/weather-view.js`: one instanced layer of rain, snow, ash or sand that follows the camera, in 1 draw, with half the particles in Eco. A ground uniform darkens wet ground or tints dust. Rain loops and thunder go in `sfx-bank.js`, and a "Weather" setting switches it off. On existing maps it is presentation only. Rule effects come only through M8.
**Why:** roadmap item 3.3 has not started, and it gives each map a mood. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P11. Painted fog of war
Replace the near-black overlay with drifting cloud fog, tinted by theme and animated by noise in `fog-aware.js`. Explored but unseen ground is desaturated and dimmed. Hidden units stay hidden.
**Why:** the Ashen maps open on a mostly dark purple screen. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P12. Title screen and brand pass
1. A "FRONTIER COMMAND" wordmark with the emblem.
2. A live 3D diorama behind the menu, off in Eco and under reduced motion.
3. Self-host one OFL display font with Vietnamese glyphs (for example Baloo 2 or Lexend, as a woff2 subset of about 50 KB) through `--font-display`. This also makes CI screenshots stable.
4. Pressed and hover states.
5. A briefing card with a minimap plate of the mission and objective markers.

**Why:** the game opens like a settings form, and its type changes on every device. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** P15.

#### P13. Results and wave ceremonies
- **Debrief:** the medal drops in with a glint, the stats count up, objectives tick one by one with sounds, and there is an MVP unit card.
- **Defence:** a large wave banner built from `wavePreview()`, with icons, roads and a horn, plus a red variant for elite and boss waves.
- **Fix:** the landscape debrief, whose objectives scroll under the sticky buttons.

**Why:** the payoff moments are where mobile AAA games feel lavish. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P14. Recorded battle music and voice tones
1. ACE-Step battle stems (calm, tense, battle and boss) at one BPM and key per act, loop-mastered like `public/music/manifest.json`, and crossfaded by the existing CombatIntensity. The synthesised score stays as the fallback.
2. Voice tones: babbled syllables under each line, "Animalese" style, with a pitch and timbre per character (Vale, Okoro, Sol, Hale, ECHO). They are language-neutral, so they work in English and Vietnamese.

**Why:** battles sound like oscillators today, and story lines are silent. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** an owner listening pass.

#### P15. UI sound kit
Replace the 37 single-sine `A.tone(hz)` calls with named recipes in `sfx-bank.js`: tap, confirm, back, error, buy, upgrade, rank, star and wave-horn. Route them through `app/sound.js` with voice caps, and unit-test the bank.
**Why:** cheap tactile polish on every tap. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P16. Idle personality and victory cheers
Transform-only motion on visible idle units after 4 s: infantry look around, turrets scan, Walkers shift their weight, flyers bank. When a nearby fight ends, units hop or cheer once. It is off with reduced motion.
**Why:** charm between fights that suits the toy-like art. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### P17. Defence tower models and board dressing
A new `tools/blender/generate_towers.py` makes:
- 6 crew bases;
- 3 tier dressings (sandbags, then riveted plating, then a gold crown and banner);
- 12 branch toppers (Marksman scope, Suppressor drum, Cluster rack, Inferno tank and others).

Merge them into instanced batches, about one per crew and tier. Add an upgrade "pop". Replace the 2 m zone grid with painted field edges, and the white hexagon pads with stone plinths. Defence must stay within 112 draws on phones.
**Why:** players read the defence at a glance, and tower identity is where polish shows most in TD. **Size:** L. **Micro:** none. **Existing balance:** no. **Needs:** K10 helps the budget.

### 5.8 Code clean-up (K)

Every K item must change no behaviour. K1 comes first, and every other K item is checked against it.

#### K1. Golden gameplay pins
Add `tests/golden-play.test.js`, with `sim.hash()` recorded at fixed times:
1. **AI against AI** (`aiPlayer: true`): classic ×1 normal, highlands ×2 relentless coalition, riverlands ×2 and basin ×3 fast, at 60, 180 and 300 s.
2. **`playDefence`** on d-gorge, d-bridges (demolish) and d-crossroads, Standard: the final hash, stars and lives.
3. **ObjectiveBot** for 120 s on m01, m03 (the boss) and m06b (air).

Move the 7 duplicated `d071360b` asserts here, with one shared `run()`. Keep the `--json` output of `check:missions` and `check:defence` as baselines.
**Why:** without it, no refactor can be proven behaviour-neutral. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing. Do it first.

#### K2. Remove dead code and stale strings
Delete:
- the unused exports `TIER_NAMES`, `TEAMS`, `disposeEmblems`, `BANK_NAMES` and `paintTerrain` (with its import);
- the legacy 96 m constants and helpers in `data.js` (`MAP_SIZE`, `HALF`, `CELL`, `GRID`, `cellAt`, `worldAt`) and their unused imports. Three Roads is 128 m, so any new use of them would be a bug;
- 7 dead CSS selectors;
- about 86 stale `vi.json` messages, after checking each one.

Add a reverse i18n test, and drop `export` from about 60 module-internal names.
**Why:** a smaller surface, and a latent bug removed. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K3. Shared rng and hash module
A new `src/rng.js` with `mulberry32` and `fnv1a`. It replaces 4 copies of the random generator (`scatter.js`, `ambient-life.js`, `audio-logic.js`, `sim/defence.js`) and 5 of the hash. The two mulberry variants compute the same thing, and all ids are ASCII. Verify with `d071360b`, K1, the scatter tests and the Daily seed fixtures.
**Why:** determinism-critical code should not drift apart. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K4. Fast vision path and allocation-free helpers
1. In a Defence match, skip team 0's cell loop, because `vision.js:56` overwrites it with `fill(1)`.
2. Inline the `distance(e, nav.worldAt(x, z))` maths.
3. Remove the per-call arrays and closures in `terrain.cellAt`, `canTraverse` and `canStand`.
4. Memoise `endlessWave` and `palette` off the sim.

Measured share today: about 42% of each Defence tick (vision) and 13% of skirmish time (`canTraverse`).
**Why:** a cheap win on phones, most of all on big Defence maps. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K5. Spatial grid for targets, splash and separation
A per-tick 8 m grid kept off the hashed state. Use it in `combat.enemy`, `defenseTarget`, attacker scans, the `garrisonHit` radius loop and splash. Visit candidates in the original entity order, so ties still pick the same target. Do `separate()` last, with a margin of at least 2 × max radius × 0.9 plus the largest push, and keep it only if K1 matches.
**Why:** all-pairs scans are the biggest sim cost, and more unit variety means bigger battles. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K6. Flatten AI-think spikes
Hoist the repeated `own(team)` and filter scans into one pass per think, and cache building-site candidates and probes for the duration of the think. Do not change cadence; that changes decisions. Record p99 and max tick time before and after. Desktop today: p99 7.1 ms, max 26 ms.
**Why:** hitches during big waves feel un-AAA on phones, which are about 4 to 6× slower. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K7. Split `sim/defence.js`
Move the 81 methods, unchanged, into `src/sim/defence/`: `waves.js`, `towers.js`, `route.js`, `commander.js`, `armour.js` and `crossings.js`. An `index.js` builds the mixin in the original key order and keeps the named exports. Add a test that fails on any mixin method-name collision.
**Why:** Defence is the fastest-growing system (+340 lines on this branch), and hero, boss and tower work need clear homes. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K1.

#### K8. Break up `app/defence-ui.js`
Split the 880-line `createDefenceUI` closure into `pads-view.js`, `sheets.js`, `bar.js`, `input.js` and `result.js`. Import `dressKey` from `view.js` instead of copying its formula (line 233). Move `ZONE_NAME` into `levels.js`, like `roads`. Add a test that every branch and rank has a text line.
**Why:** new towers and levels should not need edits to UI constants. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K11.

#### K9. Split `view.js`
Split the 1,697-line file into `src/view/` modules: `models.js`, `camera.js`, `entities.js` and `pose.js` (the per-entity body of `update()` as named functions). Verify with the render budget (p95 draws unchanged), `visual-combat`, `model-loading`, `air`, `boss`, and screenshots with held clocks.
**Why:** it is the most-edited code file (38 commits since October), and every visual feature collides there. **Size:** L. **Micro:** none. **Existing balance:** no. **Needs:** K11, K16.

#### K10. Instanced rings and health bars
Replace the per-entity ShaderMaterial and PlaneGeometry ring and bar with two InstancedMesh pools. Per-instance attributes carry HP share, shield share, flash and selection, and the bars are billboarded in the vertex shader. Then remove the "12 weakest bars" cap, its per-frame sort and the per-frame Sets.
**Why:** health bars stay visible in big fights within the draw budget. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### K11. Convert source-text tests
Rewrite the 31 files that match source text with regexes. Either pull the logic out into pure modules and test those, or move the check into the browser harness. Fold the 32 `review-YYYY-MM-*` files into tests named by feature, and add `tests/lib/sim.js` to replace 22 local copies of `run()`. The test count must not fall.
**Why:** it unblocks every client refactor and the formatter. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### K12. Lint and format gate
Pinned eslint (`no-unused-vars`, `no-undef`, `no-dupe-keys`, `no-redeclare`) and Prettier, with `npm run lint` in CI. Format in one commit, listed in `.git-blame-ignore-revs`. Today eslint finds only about 13 issues in `src`.
**Why:** it catches dead code and typos before they ship. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** K11.

#### K13. Shared UI checks in browser suites
Add `auditUI(page, scope, {touch})` to `tests/lib/harness.mjs`, checking 11 px text, 44 × 44 taps, no sideways scroll and no system fonts. Use it in the 11 suites that write their own check; this fixes the 40 px tolerance in `tests/air.mjs:17`. Then:
- move the 28 suites that launch Chromium themselves onto the harness;
- replace the 111 `waitForTimeout` calls with `__frontier.hold`/`step` and `waitForFunction`;
- add a WebKit smoke group to `pages.yml`.

**Why:** one standard for the phone rules, and a CI that is less flaky and faster. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### K14. Shrink the main chunk
Split each story mission into its metadata and its full script, and load the scripts and the Chronicles only when needed (about 211 KB raw). Move `setMusicMood` into a small `music-mood.js`, so `frame.js`, `match-flow.js` and `debug-hooks.js` stop preloading the music chunk at boot. Then set `chunkSizeWarningLimit` just above three.js (about 650 KB). Verify with `tools/first-visit.mjs` and the offline suite.
**Why:** a faster first load on phones. More missions will add data. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### K15. Message ids from the sim
Make the 37 `this.message(text)` calls also emit `{id, args}`, with English templates in `src/messages.js` and Vietnamese by id. Then retire the matching parts of the 168 regex patterns and the MutationObserver. The event queue is in `DERIVED`, so the hash does not change.
**Why:** hero and story barks will multiply, and regex translation costs frame time. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

#### K16. Seeded cosmetic randomness
Feed `fx.js` (`Math.random` at lines 101 and 287 to 316) and the module-level generator at `view.js:84` from `rng.js`, seeded per match and reset in `WorldView.reset()`. Add a pixel-identical held-clock check.
**Why:** before-and-after screenshots for art passes become cheap to verify. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** K3.

#### K17. CSS components with `@layer`
Move each component's rules out of the 27 stylesheets into one file per component, ordered by `@layer base, components, layout, overrides`. Merge the override patch files into their components, and remove the 36 `!important` declarations where layers make them unnecessary. Verify on six viewports with a screenshot diff.
**Why:** `#notice` is styled in 9 files and `.icon` in 15. **Size:** M. **Micro:** none. **Existing balance:** no. **Needs:** K13.

#### K18. Docs and version hygiene
- Rewrite `ROADMAP.md` as one status table, with this document's statuses.
- Refresh the counts in VISION, WORLD, TESTING and docs/README.
- Fix the Tank stats in HEAVY_WEAPONS and EXPANSION_STAGES, and the boss HP in `BALANCE.md`.
- Explain what `d071360b` really pins.
- Close or carry forward `IMPLEMENTATION_PROGRESS.md`.
- Pick one version line: cut a release from the 7 "Unreleased" sections, and renumber the plan labels.
- Mark `STAGE_4_STORY.md` as superseded where it differs from what shipped.
- Fix NAVAL_PLAN's Godot-twin rule.

**Why:** agents pick their work from these docs. **Size:** S. **Micro:** none. **Existing balance:** no. **Needs:** nothing.

---

## 6. Suggested first waves

This is a suggestion for the planning step. It is ordered by impact per day and by dependencies.

1. **Safety first (about 1 day).** K1 golden pins, D1 promotion fix, K18 docs table.
2. **Cheap visible variety (S-sized, no new rules).**
   - Skirmish AI: S1 (heavy units and energy), S2 (defend every core), S6 (smart abilities). These need owner OK for the skirmish bench.
   - Defence: D2 (fast-forward), D3 (targeting), D4 (trait chips).
   - Presentation: P3 (readable armies), P5 (counter hits), P7 (battle camera), P9 (colour grade), P8 (boss presence).
   - Campaign: C3 (mission looks), C9 (Keystone Roads), C16 (allied colours).
3. **New ways to fight.**
   - Enablers first: M1 (effects library), then U1 (workshops).
   - New units: U2 (Gunner), U3 (Longshot), U5 with M3 (Sapper and mines), U7 (Stalker), U8 (Outrider drill).
   - Defence: D6 (elites), D7 (TD enemies), D9 (barracks).
   - Bosses: C1 (boss engine), then D8 (road bosses) and C7 (Sovereign hunt).
   - Presentation: P4 (weapon looks), P1 (phone HUD), P2 (balanced tier).
4. **Depth and modes.**
   - Campaign: C5 heroes, then C6 and C11; C4 hazards; C17 armory and C18 veterans.
   - Defence: D11 commanders, D13 challenges.
   - Skirmish: S9 map engine, then S10 and S11; S12 win modes; S15 seed and daily.
   - Naval: S17 (A0, then A1), then C13.
   - Code: K5 to K7 as the sim grows.

### Owner decisions needed

| Decision | Ideas |
|---|---|
| Change skirmish AI behaviour (the bench tables move) | S1 to S7 |
| Add abilities to existing faction units | U11 |
| Add zones and armour to the 6 older levels | D5 |
| A harder Veteran and Endless | D16 |
| Touch existing missions | C11, C19, C20 |
| Approve the heroes plan (F1 to F8) and the corrected cast table | C5, C21 |
| Allow area cover after the bunker and barricade veto | M7 |
| The story framing of War Council variants | U12 |
| NAVAL_PLAN: map size and island alloy | S17, C13 |
| The ending rule if new decisions or captures are added | C15, C21 |
