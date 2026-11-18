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
2. **Auto-evade.** Danger zones are part of the simulation (`sim.dangerZones`). Before units act each tick (`stepDangerZones`), every ground unit of a hostile team inside a zone gets a spot just outside it (`zoneExits`, nearest standable spot with a straight path). It walks straight there and does nothing else meanwhile (`stepEvade`), then returns to its orders. A unit on guard keeps the new spot as its post. Units on **Hold** stay where they are. Guard (the default) and Aggressive units step out. Flyers are not hit by ground zones. Evading is deterministic, saved and replayed.
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
| Health | 40,000 (Story 30,000, Veteran 32,000), shield 300 (regenerates after 6 s), radius 2.2 m, speed 1.7 m/s |
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

- **Should auto-evade be partial?** On Guard (the default) the four-gun burst never hits anyone, so the boss's threat is lost firing time and the light gun. Possible middle grounds: units react after a short delay, or only idle units step out.
- **Is 40,000 health right for real players?** It was sized on the bot's army. A smaller human army takes longer.
- **Standard with a 3-unit-smaller army** (`--spread`) now times out. Is that acceptable, or should the boss be easier to meet early?
- **The north siphon lost its tower** to make room for the boss. Keep it that way?
