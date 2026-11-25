# Bosses

A boss is one big enemy machine with a readable attack rhythm: it marks the ground, fires, then opens its core. The system is built so that later bosses are mostly data. The first boss, **Iron Vanguard**, guards the north siphon in mission 3, *The Ashen Line*. The owner approved the design on 2026-11-18.

| Part | File |
|---|---|
| Rules (deterministic, saved) | `src/sim/bosses.js`; hooks in `simulation.js`, `progression.js` (damage taken, death), `sim/missions.js` (one boss at a time, `bossStage`), `sim/movement.js` (a boss is never pushed), `sim/tactics.js` (no ranks), `sim/traits.js` (no self-repair), `sim/combat.js` (light-gun muzzle height) |
| Data | `balance.json`: the unit under `definitions` (with `boss: "<id>"`) and its behaviour under `bosses.<id>` |
| Model and battlefield effects | `src/boss-view.js` (parts, danger-zone marks, gun glow, recoil, core, fall); `fx.js` (`charge`, `bossDeath`) |
| Boss bar | `src/boss-ui.js`, `src/boss-ui.css` (updated from `app/hud.js`) |
| Sound | `audio-logic.js` `soundFor`: alarm on `bossWarn`, heavy blast on `bossStage`, core blast on `bossDefeated` |
| Model port | `tools/port-boss-model.mjs` (Tank_game_3D model → this game's model contract) |
| Tests | `tests/bosses.test.js` (rules), `tests/boss.mjs` (`npm run test:boss`, CI group `bosses`), `tests/render-budget.mjs` scenario `boss-battle-eco` |

## The owner's rules and how the system keeps them

1. **Micro is a bonus, not a requirement.** No single attack takes more than about 30% of a typical unit's health. `tests/bosses.test.js` checks the worst case for every boss: a whole attack on one Ranger (95 HP) standing in the middle of the zone, on the hardest difficulty. Iron Vanguard: 25.6 damage on Standard, 28.2 on Veteran and 12.8 on Story (27%, 30% and 13%). One light-gun shot does 10 (11%). The objective bot wins mission 3 on every difficulty without any special handling of the boss.
2. **Auto-evade.** Danger zones are part of the simulation (`sim.dangerZones`). Before units act each tick (`stepDangerZones`), every ground unit of a hostile team inside a zone gets a spot just outside it (`zoneExits`, nearest standable spot with a straight path). It walks straight there and does nothing else meanwhile (`stepEvade`), then returns to its orders. A unit on guard keeps the new spot as its post. Units on **Hold** stay where they are. Guard (the default) and Aggressive units step out, but only `AUTO_REACT` (1.5 s) into the 3 s warning (owner OK, 2026-11-19): infantry still escape, a slow unit near the centre (Tank, Walker) is clipped, so moving slow units yourself pays without being required. Flyers are not hit by ground zones. Evading is deterministic, saved and replayed.
3. **Warnings last as long as the walk out.** Warning = max(`attack.warning`, 1 s + (escape distance + 0.5 m) / 2.5 m/s). The escape distance is the circle's radius, the half-width of a cone at its far end, or half a line's width. Difficulty never changes it; it changes damage (`bosses.<id>.damage`, Story 0.5) and cadence (`cadence`, a factor on the pause).
4. **Slow rhythm, one boss at a time.** Each cycle is the pause, then the warning, the rounds and the exposed window: about 11 to 16 s for every stage and difficulty (tested). `missionSpawn` refuses a second boss while one lives.
5. **Exposed core is automatic.** After every attack the boss takes `taken.exposed` damage for `exposed` seconds (×1.75 for 4 s). At all other times it takes `taken.armored` (×0.65). The bar reads CORE EXPOSED and the core lights up. Units that are already firing gain from it without new orders.
6. **Clear targeting.** The boss aims at the biggest group of enemy ground units it can see within `aggro`. This is the unit with the most others within one zone radius; ties go to the nearer group. The mark goes on the middle of that group. With no units in reach, it aims at the nearest enemy building. The mark appears before anything fires.
7. **HP sized by measurement.** See "Iron Vanguard" below. The Tank_game boss had 1,200 HP; this game's armies needed 30,000 to 40,000.
8. **Health stages at 2/3 and 1/3.** Each stage shortens the pause, starting with the next one. The warning stays the same. The boss emits `bossStage`, which brings camera shake (when the Settings switch allows it), a blast and a radio line through the mission condition `{ bossStage: n }`.

## The cycle

```
dormant  --hurt, or an enemy within `wake` m-->  tracking  --pause over and a target in range-->  warning (zone marked)
   tracking <--`exposed` s--  exposed  <--last round--  attacking (`rounds` over `over` s)  <--warning over--
```

- **dormant**: powered down. The boss does not move or fire, and is armoured. Seeing it from afar does not wake it; walking up to it does, so the player sees it wake.
- **tracking**: every 0.25 s the boss picks its aim (`bossAim`). It walks toward its target, but never more than `leash` metres from where it started (`bs.post`), and walks back when it has none. Its light gun is the definition's own weapon (`damage`, `interval`, `range`) and fires at the nearest enemy.
- **warning**: the zone is in `sim.dangerZones` with `from`, `at` (first round) and `until`. The boss faces the zone and stands still. The light gun keeps firing; the big guns do not.
- **attacking**: rounds are spread evenly over `over` seconds. Each hits every hostile ground unit whose centre is in the zone, and every hostile building whose footprint touches it (× `building`). Each round also emits a `shot` event (weapon `attack.weapon`, `boss`, `muzzle` 0–3, `sAir` = muzzle height), so the usual shell, impact and sound play from the right gun.
- **exposed**: the zone is gone and the core is open.

Events (all carry `id`, `boss`, `name`, `x`, `z`, `team`): `bossWake`, `bossWarn` (`zone`, `seconds`, `attack`), `bossAttack`, `shot` (one per round), `bossExposed` (`seconds`), `bossArmored`, `bossStage` (`stage`), `bossDefeated` (after the ordinary `death`).

State: everything is on the boss (`e.bs`: `phase`, `stage`, `cycle`, `post`, `next`, `until`, `zone`, `round`, `from`, `aim`), in `sim.dangerZones` and in `e.evade` on units stepping out. None of it exists until a boss acts. Skirmish, Defence and every other mission therefore save and hash exactly as before; the `d071360b` pins and the mission checksums other than mission 3's are unchanged. A save taken mid-warning or mid-burst loads and plays on in step (tested).

## Data format

The unit (`balance.json` `definitions`) is an ordinary unit definition plus `boss`. Its weapon is the light gun. `gun_height` is the light gun's muzzle height for the shot effect. `pop: 0` means it takes no supply, and no building trains it. The behaviour lives in `bosses.<id>`:

| Field | Meaning | Iron Vanguard |
|---|---|---|
| `wake` | an enemy ground unit this close wakes it (being hurt always does) | 14 m |
| `aggro` | how far it looks for a target | 20 m |
| `leash` | how far from its start point it will walk | 12 m |
| `first` | seconds from waking to the first pause ending | 3 |
| `pause` | tracking seconds before each attack, one per stage | 6, 4.5, 3 |
| `stages` | health shares that start stages 2, 3, … | 2/3, 1/3 |
| `exposed` | seconds the core stays open after an attack | 4 |
| `taken` | damage taken `armored` / `exposed` | ×0.65 / ×1.75 |
| `cadence` | pause factor by difficulty | Story 1.3, Veteran 0.85 |
| `damage` | final damage factor by difficulty (applyDamage's general mission factor is divided out) | Story 0.5, Veteran 1.1 |
| `attacks[]` | used in turn, one per cycle: `id`, `zone`, `range` (it fires only at an aim this close), `rounds`, `over` (s), `damage` (per round), `building` (factor), `weapon` (shot effect), optional `warning` (longer only), optional `cluster` (group radius when it is not the zone radius) | `four-gun-burst`: circle 4.5 m, 18 m, 8 rounds over 1.05 s, 3.2 each, buildings ×3, `tank` |
| `zone` | `{ shape: "circle", radius }`, `{ shape: "cone", length, half }` (half-angle in degrees, from the boss) or `{ shape: "line", length, width }` (from the boss) | circle |
| `muzzles` | gun mouths in model space `[x, height, z]`, used in turn by the rounds | four |
| `core` | the core's place in model space (the open-core flare) | `[0, 3.84, 0.78]` |

In a mission, spawn the boss like any unit: `{ spawn: "<type>", team, at, tag, exact: true, hpByDifficulty }`. Then use `destroyTag` for its objective, `{ event: "bossWake" }` for its entrance scene, `{ bossStage: 2 | 3 }` for stage lines, and `tagDead` for its fall. `tests/missions-data.test.js` allows boss triggers only in missions that field a boss.

## Iron Vanguard (mission 3)

**Story.** The Iron Vanguard is a Builder war machine, older than any camp on Astra. Ashfall's crews spent nine weeks pulling it out of a trench and refitting it, and painted it in Ashfall coral. It guards the north siphon, the one whose beam points at the sleeper fleet. Okoro recognises Builder work, and in the debrief he pulls its core from the wreck. All its lines are in `src/story/missions.js` and `src/story/scenes.js` (`iron-vanguard`), with their Vietnamese in `src/locales/story-vi.json`.

| Line | Who | When |
|---|---|---|
| And something big waits in his salvage yard by the north siphon. Four guns, two legs, older than any of us. | Okoro | briefing |
| That is no Ashfall print, Commander. It is an old Builder war machine, and they woke it up. | Okoro | entrance scene |
| The Iron Vanguard. Nine weeks to pull it out of a trench. It guards my siphons now. | Hale | entrance scene |
| It marks the ground before each burst. Stay out of the red. Hit it when its core opens. | Vale | entrance scene |
| Its armour is cracking! It fires sooner now, but the red on the ground still gives you the same time. | Okoro | stage 2 |
| One third of its plating left. I had hoped that machine would last the season, Commander. | Hale | stage 3 |
| It is down! Poor old thing. When this is over I would like to see how it was put together. | Okoro | defeated |
| Nine weeks of repairs, gone in minutes. I will add it to the account. | Hale | defeated |
| I pulled the Iron Vanguard's core from the wreck. Builder work, Commander. Ashfall only painted it. | Okoro | debrief (win) |

**Mission changes.**
- The boss stands in the `vanguardYard` (−4, −30), 11 m from the north siphon.
- It replaces that siphon's hardened tower: a tower beside the boss made the fight a war of attrition under tower fire. The intel line now says so.
- New required objective: "Destroy the Iron Vanguard". The win needs the siphons and the boss.
- The entrance scene plays when the boss wakes. There is a line at each stage and two when it falls, plus one in the debrief, a briefing line and two intel lines.
- Medals: gold 12:00, silver 16:40 (were 8:00 / 11:00). The optional time limit is 16 minutes (was 14).

**Numbers.**

| | |
|---|---|
| Health | 32,000 (Story 26,000; owner OK 2026-11-19, was 40,000), shield 300 (regenerates after 6 s), radius 2.2 m, speed 1.7 m/s |
| Four-gun burst | circle 4.5 m at the biggest group within 18 m; 3.0 s warning; 8 rounds over 1.05 s, 3.2 each (25.6 for a unit that stays; Story 12.8, Veteran 28.2); buildings ×3 |
| Light gun | 10 every 1.0 s at 14 m (Story 5, Veteran 11), during tracking and the warning |
| Rhythm | pause 6 / 4.5 / 3 s by stage, then 3 s warning, 1.05 s burst and 4 s exposed: a burst every 14.1 / 12.6 / 11.1 s on Standard (Story ×1.3 pause, 15.9–11.9 s; Veteran ×0.85, 13.2–10.6 s) |
| Damage taken | ×0.65 armoured, ×1.75 for 4 s after each burst |

**How the health was sized.**
- The objective bot meets the boss with 24 to 27 units (Standard: 16 Rangers and 11 Vanguards).
- With the north tower removed, the fight lasts from first hit to death:
  - 92 s at 32,000 HP, 115 s at 40,000 and 128 s at 46,000 (Standard);
  - 114 s on Story at 30,000;
  - 136 s on Veteran at 32,000.
- With the marching army 3 units larger, Standard takes 160 s.
- A player with fewer units than the bot will take longer, hence the lower end of the 2–3 minute window.
- Veteran has less health than Standard: there the player meets it with about 10% fewer units, under faster waves.

**What the boss actually does to an army that just fights.** In the bot's runs, almost every unit is on Guard, so auto-evade empties the zone before the first round: the burst hits nobody. Its cost to the army is time, because some 12 to 25 units stop firing to step out, every 11 to 14 s. Direct damage comes from the light gun: about 1,000 to 1,300 over the fight, 1 to 4 kills. Most losses in the mission are still from Ashfall's towers, guards and waves. Units on Hold, and buildings, do take the burst.

**`npm run check:missions`, mission 3, objective bot (seconds; medal):**

| Difficulty | Before (no boss) | After |
|---|---|---|
| Story | 428 gold | 522 gold |
| Standard | 501 silver | 602 gold |
| Veteran | 589 silver | 632 gold |

The passive and generic players are unchanged (still running at their limits). With `--spread`, every run wins except Standard `objective-3`, where the bot marches with 3 units fewer. That bot meets the boss early, at 4:40, with a small army. Its army then breaks and regroups several times, and it is still on the siphons at the 21-minute cap (before the boss it won at 492 s). Story and Veteran `--spread` all win. The other 14 missions are unchanged (full checker: all targets met).

**Client.**
- The model is the owner's Tank_game_3D `boss-quad-mech.glb`, ported by `tools/port-boss-model.mjs` at scale 0.9 (5.7 m tall, 2,228 triangles, 202 KB). The port adds grey COLOR_0 shading, recolours to Ashfall salvage (rust armour, warm steel, team trim, amber visor) and makes nothing double-sided.
- At runtime (`bossTemplates`) each rigid part becomes one baked mesh with the shared baked material: hull, two legs (they walk like infantry legs), torso, two arms and the light gun. That is 7 draws, plus the core while it is lit. There is no shadow pass in Eco.
- The arms rise to aim during the warning and recoil per gun. The torso turns like a vehicle turret. The four gun mouths glow brighter as the warning runs out. The core glows and flares while exposed.
- A danger zone is one shader mark (1 draw): a filled shape with an edge at least 3 px wide at any zoom, swept from the middle as the warning runs down, and gold while the rounds land.
- `boss-battle-eco` in `tests/render-budget.mjs` (battle-eco plus the boss and a mark): 116 draws against battle-eco's 107, limit 120.
- The boss bar shows the name, the state (ARMORED, ATTACK INBOUND, CORE EXPOSED) and the health with stage notches and a thin shield line. It appears when the boss wakes, takes no taps, and hides during scenes and briefings.
  - Desktop: above the central console.
  - Portrait: just above the dock, left of the idle buttons.
  - Landscape: in the top row, right of the idle buttons. JavaScript reads where the last idle button ends.
- A stage brings shake (the Settings switch applies), a blast and a sound. The fall is a 3.6 s kneel and topple with a chain of blasts, debris and a 20 m shockwave, plus core-level shake and hit-stop.

## Planned lineup (not built)

Each needs data, a model, lines and at most the engine features listed.

| Boss | Where | Attack (zone) | Engine work still needed |
|---|---|---|---|
| Atlas Launcher | mission 8 slot (owner's numbering) | three marked circles at once around the target group, each 4–5 m, warning from the radius rule | several zones per attack (`count`, `spread`); everything else exists |
| Iron Sovereign, reworked | mission 9 slot | a three-shell spread: one cone from the boss, or three small circles; repositions sideways between attacks | the sideways reposition (a `strafe` move in tracking) |
| Rail Titan | mission 11 slot | one long line through the target group (40–50 m, 2 m wide), warning about 1.6 s | cover blocking a line (`nav.clearLine` per unit), optional |
| Siege Marshal | finale slot (mission 13 in the owner's plan) | alternates a cone sweep and circles on buildings (`target: "building"`), calls a small escort wave at each stage | an attack `target` option; a stage action that spawns (the mission can already do this with `{ bossStage: n }` triggers) |
| Defence heavy boss | a Defence level | walks the road; its burst stuns towers in the zone for a few seconds instead of hurting units | a `stun` effect on buildings; a boss following a route (`stepRoute`) between attacks |
| Sky Wraith | a Defence air wave | a flying boss: rockets on marked circles, lands to expose its core | flying bosses (zones are ground-only today; a flyer is never hit by them) |

Mission numbers above follow the owner's list. In the game the campaign is now 15 missions, so the ids (for example `m08-the-quiet-vault`) should be confirmed before building.

## Open questions for the owner

- ~~Should auto-evade be partial?~~ Decided 2026-11-19: units react 1.5 s into the warning.
- ~~Is 40,000 health right?~~ Decided 2026-11-19: 32,000 on Standard and Veteran, 26,000 on Story; tune from real play. The `--spread` run with a 3-smaller army still times out on Standard (it never takes the west and east siphons either); accepted.
- **Standard with a 3-unit-smaller army** (`--spread`) now times out. Is that acceptable, or should the boss be easier to meet early?
- **The north siphon lost its tower** to make room for the boss. Keep it that way?

## Boss engine II and the Iron Sovereign (AAA round 2, W1-E)

All fields optional; the Iron Vanguard uses none. `attacks[]`: `count` and `spread` (N circle zones at once, the aimed one in the middle, the rest `spread` m to each side; spread >= 2 x radius + 0.5), `target: "building"` (highest tier in range, then dearest, then nearest; else the biggest unit group), `stun: { seconds }` (buildings in the zone get status `stunned`, module `sim/content/boss-status.js`). Boss entry: `strafe: { distance }` (field only), `break: { share, seconds }` (health lost during a warning of at least share x (max HP + shield) cancels the attack and opens the core), `drops: [{ at, type, n }]` (at a share of max HP; in Defence they walk the boss's road with `spawnOnRoute`). **Route mode:** a boss whose first order is a Defence route wakes at once, ignores its leash and walks with `stepRoute`; it stops while a target is within reach of its next attack and walks on otherwise. Events: `bossStomp`, `bossBroken`, `bossDrop`. Definition: `leak_lives`, `defence_tuned`.

**Port format** (`tools/port-boss-model.mjs <src> <dst> --parts tools/boss-parts/<name>.json`): `name`, `scale`, `palette` (key of PALETTES in the tool), `regroup` (new group nodes from named nodes with one parent: the Sovereign's legs become two tripods, one draw each) and `nodes` (local translation overrides). The runtime part names for a model are a table in `src/boss-view.js` (`BOSS_PARTS`, picked by a marker node). The Sovereign: 1,904 triangles, 6 materials, 11.7 x 4.9 x 9.1 m.

## Boss engine III and The Sovereign Walks (AAA round 3, R3-H)

All fields optional; the Iron Vanguard and the Iron Sovereign use none, so their pins (`golden-w1e`) hold. Boss entry:
- `phases: { "<stage>": { surge, attacks } }`: on reaching that health stage (`stages`) the boss drops the attack in hand, stands still for `surge` seconds (phase `surge`, event `bossSurge` with `stage` and `seconds`; the bar reads OVERDRIVE) and then uses that phase's `attacks`, from the first. `e.bs.set` is the phase in use. Phase attacks keep every owner rule (walk-out warnings, 30% of a Ranger, a cycle of 10 to 15 s): `tests/sovereign-walks.test.js`.
- `ward: { tag, taken }`: while any building of the boss's own team with that tag stands, every hit on the boss is multiplied by `taken`. `e.bs.warded` counts them each tick. The bar reads RELAY SHIELD; `boss-view.js` draws a bubble (fresnel rim, flickers on hits) and one tether per relay: two draws, made on first use.
- `march: { stop }`: a field boss that wakes at once and walks on the nearest hostile Command core. The road is found once at the wake (`e.bs.road`, centimetre-rounded points; a camp packed with buildings falls back to an ordinary unit's road) and ends `stop` m short of the core. It walks only with nothing in its sights and its post goes with it, so anything it sees (a tower, the army) holds it; a point it cannot pass is skipped after 3 s.

**Iron Sovereign, walking** (`ironsovereign2`, `iron-sovereign-2`): 44,000 HP (Story 34,000, Veteran 40,000 in the mission), shield 300, speed 0.8 m/s, radius 2.4, the light gun of the Sovereign. One stage at 50%. Phase 1: the Sovereign's stomp (stuns the best tower) and three-shell spread. Phase 2 (surge 4 s, two Sentinel drones): `rail-sweep` (a line 24 m long, 4 m wide, 3 s warning, 4 rounds of 7: 28, Veteran 30.8 of a Ranger's 120) and `ring-barrage` (five 3.5 m circles 7.5 m apart, 2.6 s warning, 3 rounds of 9: 27, Veteran 29.7). Break: 2.5% of health and shield during a warning. Ward: relays tagged `ward`, x0.15. March: stops 14 m short of the core. The model is `ironsovereign2.glb`, the Sovereign's port under its own root name (`tools/boss-parts/ironsovereign2.json`).

**Mission** `m11d-the-sovereign-walks` (`src/story/sovereign-mission.js`, one import and one entry in `src/story/missions.js`): see `docs/MISSIONS.md` and `docs/aaa/results/round3/h.md`.

## Boss engine IV: flying bosses, and the Ember Drake (W9, 2026-11-26)

A boss entry with `flight` runs its own cycle (`src/sim/boss-flight.js`, mixed into Simulation next to `bosses`); `stepBoss` hands it over on its first line, so the three walking bosses play exactly as before (their pins hold). Everything else is shared: the aim, the danger zones and auto-evade, the rounds, the light gun, stages, `phases` (surge), the 30% rule and the walk-out warning.

```
dormant (on its perch, on the ground)  --hurt, an enemy within `wake`, or `restless` s-->  takes off
tracking (in the air) --pause--> warning --> attacking --> exposed --> tracking ...
after every `every` attacks: landing (flies to its perch) --> warning (the wing gust round the perch) --> gust --> perched (`perch` s) --> takes off
```

- **In the air** `e.flying` is true: only units that hit air (Rangers, Anti-tank soldiers, Riders, Drones, towers with Anti-air guns...) can shoot it, and ground zones never touch it. It hangs `hover` m short of the group it aims at (so Rangers below reach it), within `leash` of its perch, and flies home with nothing in reach. `e.fly` is the height shots aim at.
- **The landing**: over its perch it marks `flight.land`, a circle with the usual walk-out warning; when it lands, every hostile ground unit still in the circle takes the gust's damage and is pushed `knock` m straight out (half-metre steps while the ground allows; units on Guard have already stepped out). Then it is **perched**: `e.flying` false, so every unit can hit it, and it takes `taken.exposed` (the bar reads LANDED) for `perch` s.
- **Phases wait for the air**: a stage reached on the perch or on the way down surges at take-off.
- Events: `bossTakeoff`, `bossLanding`, `bossLand` (`seconds`), `bossGust` (`zone`, `ids` pushed), and `bossAttack` carries `area` (a copy of the zone). Mission triggers may use `{ event: "bossLand" }` (a boss mission only, `tests/missions-data.test.js`).
- State, only on a flying boss: `e.flying`, `e.fly`, `e.bs.born`, `e.bs.breaths`, `e.bs.landing`. A flying boss is not nudged by other flyers (`separatePair`). Save and load in the air, mid-breath and on the perch play on in step (tested).

| Field (`flight`) | Meaning | Ember Drake |
|---|---|---|
| `fly` | shot height in the air (rules) | 4.8 m |
| `hover` | how far short of its target group it hangs | 6 m |
| `every` | attacks between landings | 2 |
| `perch` | seconds on the ground | 8 |
| `restless` | wakes on its own this long after it appears | 200 s |
| `land` | the gust: an attack with `knock` (m) | circle 5 m, 3.2 s warning, 1 round of 10, buildings x1, knock 3 m |

**The Ember Drake** (`emberdrake`, `ember-drake`): 42,000 HP (Story 34,000, Veteran 38,000 in the mission), shield 300, speed 3.4, radius 2.1, not mechanical (Anti-tank rockets do their normal damage), an ember spit of 8 every 1.2 s at 12 m. Stages at 2/3 and 1/3 (pause 6, 5, 4.5 s). **Fire breath**: a line 16 m long and 3 m wide from under it through the group, marked 2 s ahead (the walk-out rule asks 1.8 s), 4 rounds of 7 over 1 s (28; Veteran 30.8 of a Ranger's 120), buildings x0.5. **Phase 2** (surge 2.5 s): the breath and a **breath sweep**, a 13 m cone of 22 degrees (3.3 s warning), 4 rounds of 7. Taken x0.7 in the air, x1.75 after an attack and on the perch. Exposed 3 s after each breath.

**Story.** A Builder fire guardian that slept under the Crown relay of the Obsidian Highlands while the Veil's dampers kept the Crown dark. Mission 10 tuned the Crown and it woke; it is what burned Maren's first camp thirty years ago. Its lines are in `src/story/ember-mission.js` (scene `ember-drake`), with Vietnamese and Korean in the story catalogues.

**Model** (`tools/blender/generate_drake.py`, frontier_kit, original): 2,676 triangles, burnt-sienna hide, gold belly, bronze back plates, crimson membranes, a team-painted crest, wing edge and tail fin, and an `EmberGlow` material (eyes, throat, back vents, mouth). Rigid pivots `Wing_L`, `Wing_R`, `Jaw`, `Tail` (the hind legs sit on `leg_L`/`leg_R` for the unit contract but bake into the body). `src/boss-view.js` draws it as five rigid draws plus one lit ember mesh (`BossEmber`, brightness per frame) and moves it by maths (`updateDrake`): it flies `DRAKE_LIFT` (4 m) above its root, beats its wings (faster and harder while it hovers low to land), opens its jaw as the breath charges, sways its tail, folds its wings on the perch, and its blob shadow shrinks with height. The breath is one pooled mesh (`boss-breath`, 1 draw only while it shows): flame tongues over the zone for the rounds, then a scorch fading over 3 s; the gust is a dust ring on the same mesh plus pooled dust. Shot down in the air it falls rolling for 1.3 s and the boss blasts, shake and hit-stop wait for the crash.

**Cost on a phone** (`tests/render-budget.mjs` `boss-drake-eco`, the drake in the air marking its breath over battle-eco's 60 units): 84 draws, the same as `boss-battle-eco` with the Iron Vanguard (battle-eco 76) on the same build.

**Mission** `m10e-the-ember-roost`: see `docs/MISSIONS.md`. `npm run check:missions --only m10e`, objective bot: Story 337 s, Standard 357 s, Veteran 400 s, all gold, 0 to 1 unit lost (`--spread` the same).
