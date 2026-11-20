# Mission scripts

A campaign mission is one plain data object in `src/story/missions.js`. The mission engine (`src/sim/missions.js`) reads it inside the simulation, so missions are deterministic, saved with the match and replayable. The interface only shows what the engine emits (dialogue, objective changes, camera cues).

Status: format agreed 2026-11-10; engine and campaign in progress.

## Shape

```js
{
  id: "m03-the-relay-line",            // stable, used in saves and progress
  act: 1,                               // 1-3, for the campaign map screen
  title: "The Relay Line",
  map: "riverlands",                    // a maps.json id
  enemies: 1, speed: "relaxed", alliance: "ffa",   // as in Skirmish
  bonus: { alloy: 200, energy: 100, tower: true }, // optional starting help
  rules: { ai: true, playerBase: true, enemyBase: true }, // ai "home": harvests, builds and defends but never attacks (scripted waves only); false playerBase = no-base mission

  briefing: {
    place: "Meridian Riverlands, day 9",
    lines: [ { who: "vale", text: "..." }, { who: "okoro", text: "..." } ],
    intel: ["One sentence the player should remember.", "..."],
  },

  regions: { ford: { x: 0, z: 0, r: 8 }, relayNorth: { x: -22, z: 4, r: 7 } },

  setup: [                               // applied once at tick 0
    { spawn: "tower", team: 1, at: "ford" },
    { spawn: "vanguard", team: 0, at: { x: -30, z: 20 }, count: 4, tag: "escort" },
    { spawn: "worker", team: 0, at: { x: -31, z: 22 }, tag: "convoy", name: "Survey crawler", hp: 400, speed: 2.2 },
    { capturePoint: "relayNorth", gives: { alloy: 2 } },     // neutral point, see below
    { resources: { alloy: 300 } },                            // set the player's starting stock
  ],

  objectives: [
    { id: "hold", text: "Hold two relays for 3 minutes", type: "hold", points: ["relayNorth", "relaySouth", "relayEast"], need: 2, seconds: 180 },
    { id: "core", text: "Destroy the Ashfall command core", type: "destroyCores", hidden: true },
    { id: "fast", text: "Finish in under 12 minutes", type: "timeUnder", seconds: 720, optional: true },
  ],
  win: ["hold"],                          // objective ids that must all be done
  lose: [ { type: "coreLost" }, { type: "tagLost", tag: "convoy" }, { type: "time", seconds: 900 } ],

  triggers: [
    { when: { time: 45 }, do: [ { say: { who: "okoro", text: "..." } } ] },
    { when: { enter: "ford", team: 0 }, do: [ { say: {...} }, { wave: { team: 1, units: { vanguard: 4, ranger: 2 }, from: "enemyBase", target: "ford" } } ] },
    { when: { objective: "hold", is: "done" }, do: [ { reveal: "core" }, { say: {...} } ] },
    { when: { event: "incoming" }, once: true, do: [ { say: {...} } ] },
    { when: { tagHpBelow: { tag: "convoy", percent: 50 } }, do: [ { say: {...} } ] },
  ],

  debrief: {
    win: [ { who: "vale", text: "..." } ],
    lose: [ { who: "okoro", text: "..." } ],
  },
  medals: { gold: { seconds: 600 }, silver: { seconds: 840 } },   // bronze = any win
}
```

## Vocabulary

**Objective types**

| type | fields | done when |
|---|---|---|
| `destroyCores` | — | every enemy Command core is destroyed |
| `destroyTag` | `tag` | every entity with the tag is destroyed |
| `hold` | `points`, `need`, `seconds` | the player has owned `need` of the capture points for `seconds` in a row |
| `survive` | `seconds` | the mission clock reaches `seconds` with the player alive |
| `escort` | `tag`, `to` (region) | every living entity with the tag is inside the region (at least one must live) |
| `collect` | `alloy` and/or `energy` | the player has banked that much in total during the mission |
| `build` | `building`, `count` | the player owns that many finished buildings of the type |
| `reach` | `region` | any player combat unit is inside the region |
| `timeUnder` | `seconds` | checked at victory: the win came before `seconds` (use only with `optional: true`) |

`hidden: true` keeps an objective off the list until a trigger `reveal`s it. `optional: true` objectives never block victory; they feed the debrief and medals.

**Lose conditions:** `coreLost` (all player cores gone; default when `rules.playerBase` is true), `tagLost` (`tag`), `time` (`seconds`), `armyLost` (no player units left; for no-base missions).

**Trigger conditions (`when`)**: `time` (seconds), `enter` (region + team), `objective` + `is` (`done`/`failed`), `event` (a simulation event type: `incoming`, `built`, `levelup`, and `bossWake` in a mission with a boss), `tagHpBelow`, `tagDead` (tag), `count` (`{ team, type, atLeast }`), `pointOwned` (`{ point, team }`), `bossStage` (2 or 3: the boss has fallen to 2/3 or 1/3 of its health), and in a mission under the Defence rules `wave` (wave n beaten) and `waveStart` (wave n started). Triggers fire once unless `repeat: seconds` is given.

**Bosses** (docs/aaa/BOSSES.md): spawn one like any unit (`{ spawn: "ironvanguard", team: 1, at, tag, exact: true, hpByDifficulty }`); a second boss is refused while one lives. Its objective is `destroyTag`, its entrance a scene on `{ event: "bossWake" }`, its stage lines `{ bossStage: n }`, its fall `tagDead`. Mission 3 is the first: the Iron Vanguard guards the north siphon.

**Actions (`do`)**: `decide` (a decision id, see below), `say` (`who`, `text`), `wave` (`team`, `units`, `from` region or `"enemyBase"`, `target` region or `"playerBase"`), `spawn` (as in setup), `reveal` (objective id), `complete`/`fail` (objective id), `give` (`{ alloy, energy }` to the player), `camera` (region; a short pan the player can cancel), `ping` (region), `aiSpeed` (new speed), `music` (`calm`/`tense`/`battle`), `scene` (a staged scene id, see below).

**Capture points** are neutral markers. A team owns one while it has a combat unit within the region and no enemy combat unit is there for 5 seconds; ownership stays until another team takes it. `gives` adds resources per second to the owner.

**Speakers (`who`)** are ids from `src/story/world.js` (`CAST`). Text is English; every story string (titles, briefings, intel, objectives, lines, unit names, capture point labels) also needs a Vietnamese entry in `src/locales/story-vi.json`, keyed by the English text; `tests/story-vi.test.js` fails until it has one, with the same numbers and names (`node tools/story-strings.mjs` lists the strings). Give each `capturePoint` a `label`: it is the name in the capture toasts. Keep lines under 140 characters so they fit a phone.

## Decisions and `if` (0.19a)

A mission may ask the Commander one decision. It is declared on the mission and asked by an action:

```js
decisions: {
  "m03-alloy": {
    who: "okoro",                                  // the speaker on the choice card (CAST id)
    prompt: "One sentence, under 140 characters.",
    options: [                                     // two orders, written as orders, never as dialogue
      { id: "return", label: "Return the alloy to Ashfall's scavengers", effect: "One line: what it costs or brings.", mercy: true },
      { id: "keep", label: "Keep the alloy for the expedition", effect: "+300 alloy now.", mercy: false, default: true },
    ],
  },
},
triggers: [ { when: { enter: "siphonNorth", team: 0 }, do: [ { say: {...} }, { decide: "m03-alloy" },
  { if: { flag: "m03-alloy", is: "return" }, say: {...} }, { if: { flag: "m03-alloy", is: "keep" }, give: { alloy: 300 } } ] } ],
```

- `{ decide: id }` stores `mission.pending = { id, trigger, at }` and emits a `decision` event. Only that trigger waits; every other trigger keeps running. The client shows the choice card and holds the match (the `decision` screen keeps its music); headless players answer at once (`answerDecision` in `tools/playbot.mjs`).
- The answer is the command `{ team: 0, type: "decide", id, option }` (accepted only while that decision is pending and the option exists). It sets `sim.flags[id] = option` and runs the rest of the trigger, so it is logged and replays. `sim.flags` and `mission.pending` exist only once used: other matches save and hash exactly as before. A save taken while the card is open shows it again on Continue.
- `if: { flag, is }` may sit on a setup entry, an objective, a trigger, an action, a briefing line or a debrief line. A flag from the mission's own `decisions` is tested in the match; a flag from an earlier mission, and `if: { ending: "open-frontier" | "meridian-line" }`, are settled before the match by `resolveMission(def, progress)` (`src/story/choices.js`): entries that fail are dropped, the rest lose their `if`, a missing answer uses the option marked `default`. The trimmed mission is what the match saves and replays. Variants of one objective share its id, each under its own `if`.
- Every option is merciful or firm. Two or more merciful answers lead to the ending "The Open Frontier", fewer to "The Meridian Line" (`endingFor`). Keep consequences small: a line, an objective text, one wave of two or three units more or less. Check both branches: `npm run check:missions -- --only m07 --decide mercy` and `--decide firm` (or `--progress file.json` for any campaign record).

**Campaign progress** (`frontier-campaign-v2`, `src/campaign.js`): `cleared` as before, plus `decisions` (`{ [id]: option }`, written on a mission win; a loss writes nothing; replaying a mission replaces its answer), `endingsSeen` (written when the finale is won) and `chronicles` (0.20, see "Faction Chronicles" below). Every field is kept on load and on every record, older progress loads unchanged, and a mission opens when it is cleared itself or the one before it is (by mission id). `missionById(id)` returns `{ campaign, index, mission }`. The mission checker's targets are keyed by mission id (`MISSION_TARGETS` in `tools/mission-check.mjs`).

## Staged scenes (0.19b)

A scene is a short sequence (5 to 20 s) the client plays while the match is held: letterbox bars, eased camera moves, lines in the dialogue box with portraits and small screen glows. Data: `SCENES` in `src/story/scenes.js`; client: `src/app/scenes.js` (the `scene` screen in `src/app/screens.js`, which holds the match but keeps the music, like the decision card).

```js
"relay-wakes": { letterbox: true, beats: [
  { camera: { at: "oldRelay", zoom: 0.8, seconds: 2.4 } },   // a region of the mission (or { x, z }); zoom is a factor of the standard view
  { fx: { flash: "relay" } },                                // "relay" (teal), "dark" (lights out) or "alarm" (warm)
  { say: { who: "okoro", text: "It is answering..." } },     // held for its reading time
  { wait: 0.5 },
] }
```

- The action `{ scene: id }` only emits a `scene` event. The frame loop stops on that tick and plays it; lines said on the same tick wait until it ends; a scene on the winning tick plays before the debrief. Nothing in the simulation waits for a scene, so saves and replays are as without it, and a save taken during a scene continues after it (the scene does not play again).
- Camera beats go only to places the player has explored (an unexplored one is skipped, so a scene never scouts); under `:root.motion-off` the camera cuts. At the end the camera returns to where the player had it.
- Skip (44 px, top right), Escape, Space or Enter end a scene; its remaining lines go to the Comms log. A scene plays once per match.
- Move the lines of the moment into the scene (word for word if they existed) rather than saying them twice. Every scene line needs a Vietnamese entry (`tools/story-strings.mjs` walks scenes too).
- The six big moments: mission 1 (`relay-wakes`, the hold done), mission 4 (`the-truce`, at 5:00), mission 8 (`echo-wakes`, the vault open), mission 10 (`crown-lights`, the Crown tuned), mission 11 (`draw-cut`, the last conduit) and the finale (`keystone-open` / `keystone-held`, chosen by `if: { ending }`).

## Defence rules in the campaign (0.19b)

A campaign mission may carry a `defence` block (the format of the Frontier Defence levels below) and is then played under the Defence rules: no base, lives, pads and crews, waves on fixed roads. Its `rules` are `{ ai: false, mode: "defence", rosters: true }`, its objective `{ id, type: "waves", count }`, its lose condition `{ type: "lives" }`, its `medals` go by lives (`{ gold: { lives }, silver: { lives } }`) and `check: { story, standard, veteran }` is the stars `npm run check:missions` requires of the DefenceBot (which also checks that a player who crews nothing loses; one-crew players are reported, not required). Story beats between the waves use the `wave` / `waveStart` conditions. The two missions live in `src/story/defence-missions.js`; their roads come from `src/defence/maps.json`, so they always match the painted route.

| # | id | Map | Enemy | Waves | Story |
|---|---|---|---|---|---|
| 3 | `m02b-hold-the-river` | Twin Bridges | Ashfall | 7 | Hale comes back for the river crossings while Okoro tunes the river relay (no air: it comes before Wings over Copper) |
| 10 | `m07b-hold-the-valley` | Gorge Road | Ashfall | 8 | Okoro's survey on the relay plateau finds where the lines meet: a Builder vault (sets up The Quiet Vault). Since 0.18.3 `rules.air`: a Kite in wave 6 and 2 Ember balloons in wave 8, each with a line |

The campaign has 15 missions since *Wings over Copper* (0.18.3). Ids are stable; an inserted mission takes the id of the one before it with a letter (`m02b-…`). A player who cleared all twelve keeps everything open and finds the new ones next (a mission opens when it or the one before it is cleared). The campaign map lays out its nodes from the list (`mapLayout` in `src/story/campaign-map.js`; an act of six, Act 2 now, widens from 12–86% to 11–89% so neighbours stay 15% apart); missions under the Defence rules have square relays. `RESERVED_IDS` in `src/story/defence-missions.js` is empty.

## Wings over Copper: the first air raid (0.18.3)

Mission 8, `m06b-wings-over-copper`, Act 2 on the Copper Basin, day 32 (after Copper Harvest, before Copper Siege). `rules: { ai: "home", playerBase: true, enemyBase: true, rosters: true, air: true }`: the Ashfall AI builds and defends but never attacks (the script sends every raid), and `air` lets the player's Command core offer Kite, Hawk (level 3) and Flak (level 2). It is the only story mission with `air`, so it is where the campaign teaches air:

- **Setup.** The usual camp, 600 alloy, the *Copper refinery* (a relay-class building, tag `refinery`, 2000 HP, 2400 on Story) in the relay yard 19 m from the core with a tower beside it, two more Harvesters. On the east rim the *Balloon yard* (Ashfall salvage yard, tag `balloonYard`, 3000 HP) with two towers, 4 Scrappers, 3 Rangers and an Anti-tank soldier, 45 m from the Ashfall core.
- **Objectives.** `raids` (survive 8 minutes: "Guard the Copper refinery through three air raids"), then `yard` (hidden until `raids` is done: destroy the balloon yard); optional `fast` (13 minutes). Lose: the core, the refinery, or 20 minutes.
- **Raids.** 1:40 two Ember balloons; 4:00 two Kites and two balloons, with 4 Scrappers and 2 Rangers from the Ashfall core; 6:30 three balloons and a Kite with 5 Scrappers and an Anti-tank soldier; at 8:00 (the yard revealed) one more balloon at the camp. Balloons are supply 3, so their counts round to nearest by difficulty (1 / 2 / 3 in the first raid).
- **Scene.** `first-balloon` plays when the first flyer enters `skyWatch` (24 m around the refinery): Okoro sees it, Vale names the answer (Rangers, Anti-tank soldiers, Flak). Lines at 0:50 (lights over the rim), 2:50 (Hawks at a level 3 core), the refinery at half health, the yard at half health, the yard down.
- **Decision echo.** Mission 3's alloy changes Hale's third-raid line (kept: he collects it from the air; returned: he aims at the refinery, not the people). Nothing else differs.
- **Anti-air hint** (client, `src/air-hint.js`, shown by `app/ui-extras.js`): the first enemy flyer in sight while the player has no unit that hits air and no Flak (in Defence: no crew that hits air) shows once per match what can hit it. It works in any match, not only this mission.
- **Checker** (Story, Normal and Veteran): passive survives past 3:30 (2:30 on Veteran), generic past 8:00, the objective bot wins at about 8:30 with gold (medals: gold 9:00, silver 12:00). A person needs 9 to 12 minutes: 8 minutes of raids, then the yard.

**Reworked in 0.19b.** Mission 2 is a bridge assault: Ashfall holds a bridgehead at the far end of the west bridge (two towers whose 13 m reach covers the far half of the span, 9 guards in the gap between the rocks), the ford is slow and stops abilities, and the core falls after the bridgehead. Mission 9 is a high-ground hold: after the link-up, take the dune plateau and hold it for 3 minutes while Hale's Warden drones climb its ramps (the core is optional). Mission 6 shows two Veil scouts on the basin rim. The plan's ford fight for mission 6 is not possible on the Copper Basin, which has no river.

## Rules for authors

- Tagged objects of an eliminated enemy stay standing. When an enemy loses its last Command core every untagged unit and building of that team is removed, but entities with a `tag` remain (they stop acting but still fight if armed), so `destroyTag` objectives such as the siphons (mission 3) and conduits (mission 11) are always won by destroying them, never by killing the core. Keep tagged objects reachable once the base is gone.

- Positions are world metres, origin at map centre, `x` and `z` within ± half the map size minus 6. Check them with a node script against `new Simulation({ map })`: use `s.nav.canStand(x, z, 2)` and keep 8 m clear of bases unless intended.
- A mission must be winnable with the units and buildings the player has unlocked by then. State the intended solution in a `design` string on the mission.
- No objective may depend on something the player cannot see or be told about.
- Do not reference abilities or units that do not exist in `balance.json`.

## Campaign difficulty

Simulation accepts and saves `difficulty` (`story`, `standard`, `veteran`; default Standard). Values in `balance.json.difficulty` scale scripted wave counts, enemy damage to team 0, optional finish deadlines and time medals. Story grants 150 alloy after mission setup. Veteran advances Relaxed to Normal and Normal to Fast, including scripted speed changes. Skirmish ignores these modifiers.

A spawn can override its base unit count or health for a single difficulty with `countByDifficulty: {veteran: 6}` or `hpByDifficulty: {story: 700}`. Other difficulties use the base `count` and `hp`. Saves include the mission data and chosen difficulty. The benchmark is `npm run check:missions -- --difficulty story` (or standard/veteran). The plan's Veteran target permits at most two objective-bot misses, but the checker remains strict and exits nonzero for any miss. Report exceptions explicitly.

## Faction roster opt-in

## Faction rosters and unlocks

A mission's faction colours remain cosmetic until `rules.rosters: true`. With that flag its `factions` map also sets the simulation rosters: each enemy team fields its faction's units, building and trait. Spawn and wave data keep base slot names (`{ vanguard: 4 }` becomes four Scrappers for an Ashfall team); count conditions resolve the same slots; a faction type name is also accepted. The AI personality's tempo numbers are not applied in a mission (the script sets the pace); its other habits are (the faction building, Sunward raids, Veil falling back).

**Since 0.12.1 every mission has rosters on** (owner decision). Story text was changed where it said the factions print identical units. A spawn with `exact: true` keeps the named type on any roster (the Breaker batteries of missions 7 and 9). Hold objectives last 60 seconds and finish early when no enemy fighter remains. In scaled waves (Story and Veteran), units of supply 3 or more round to the nearest whole number instead of up.

**Unlocks.** `rules.unlock: ["rider"]` lends the player a unit from another roster for the whole mission; the action `{ unlock: ["rider"] }` does it at a moment in the script and prints "Rider can now be trained." The unit joins the building that trains the slot it replaces (Riders at the Barracks beside Rangers) and is saved with the match. Mission 9 gives the player Sol's Riders (her troops in the setup and at the link-up are Riders, and the Barracks can train them once the camps are joined); missions 10 to 12 keep them from the start. The plan's gift of a Walker and two Riders at the start of mission 12 was tried and dropped: that mission is finely balanced for the objective bot, and each variant of the gift moved its result between a win at 1053 s, a loss and a timeout.

## Height and walls on maps (0.13.0)

`maps.json` may give a map `plateaus` (`{ shape: "disc", x, z, r, ramps: [{ angle, width }] }` or `{ shape: "box", x, z, w, d, ramps: [{ side: "north"|"south"|"east"|"west", at, width }] }`, with `mirror: true` for the point-mirrored copy) and `walls` (`{ x, z, length, axis: "h"|"v", mirror }`). Mission regions and spawns must not sit on a cliff band or a ramp: `tests/missions-data.test.js` checks every one with `nav.canStand`.

## Frontier Defence levels (0.17)

A Defence level (`src/defence/levels.js`, rules in `src/sim/defence.js`) is a mission-shaped definition with `rules: { ai: false, mode: "defence", rosters: true }`, `factions: { 1: … }`, `objectives: [{ id, type: "waves", count, text }]`, `win`, `medals: { gold: { lives }, silver: { lives } }` (3, 2 and 1 stars) and `check: { story, standard, veteran }` (the stars `npm run check:defence` requires of its bot), plus a `defence` block:

| Field | Meaning |
|---|---|
| `lives`, `alloy` | Lives, and starting alloy (a number or one per difficulty). There is no energy and no supply. |
| `firstWave`, `gap` | Seconds before wave 1, and between a beaten wave and the next. `waveCall` starts the next one now and pays 2 alloy per second left. |
| `routes`, `exit` | Named polylines of `{ x, z }` from the spawn to the exit circle `{ x, z, r }`; the map's `routes` in `src/defence/maps.json` paint the road. |
| `lane`, `pace` | Lane width (each unit walks its own offset) and the share of field speed the waves march at. |
| `count`, `hp` | Per-difficulty wave-size and hull factors (they replace `balance.json.difficulty.wave` for this level). |
| `pads` | `{ id, x, z, high? }`: `high` is `"rim"` (3.5–5 m inside a plateau: seen from the road, +2 m reach) or `"deep"` (hidden from below). `tests/defence-data.test.js` checks pads against the terrain. |
| `crews` | Crew ids from `src/defence/garrisons.json` (`ranger`, `breaker`, `antitank`, `watcher`, and since 0.21 `tank`, `scorcher`); slots resolve through the player's roster. |
| `waves` | `{ groups: [{ units: { slot: n }, route, every, delay, hp?, faction?, tag?, carry?, dropLeg? }], bonus }`: slots resolve through the enemy roster; types take turns within a group. Any unit type may stand in for a slot (it names itself). `faction` (0.21) resolves the group's slots with that faction's roster instead: a mixed wave under one enemy team. `tag: "bridger"` (0.21): its units build a pontoon over a blown crossing on their route. `units: { carrier: n }` with `carry: { slot: n }` and `dropLeg` (0.22): troop carriers, each with that squad aboard, dropped at route point `dropLeg` (see "Troop carriers" below; helper `carriers(carry, route, dropLeg, delay, n, hp)`). |
| `camera` | `{ x, z, zoom, maxZoom }`: the start view and the Overview zoom. |
| `commander` | 0.21, optional: `{ x, z }`, the post of the player's commander (a gold-trimmed unit of the roster's `tank` slot). Leave it out and there is no commander. |
| `bridges`, `crossings`, `startBlown` | 0.21, optional, river maps only: `bridges: true` allows `demolish`; `crossings` maps each route to the crossing it uses (`{ west: -22, ford: 0, east: 22 }`, the x of `CROSSINGS` in `src/terrain.js`), for rerouting and the last-crossing rule; `startBlown: [x]` opens the level with those bridges down. Skirmish and any block without `bridges: true` never blow a bridge. |
| `zones` | 0.23, optional: build zones, `{ id, x, z, w, d, max? }` (a rectangle by its centre and size) or `{ id, poly: [[x, z], ...], max? }`. A crew may stand anywhere inside, on the 2 m grid; `max` caps the towers one zone takes. See "Build zones and armour" below. `zoneClear` (default 4.5) is the metres a zone tower keeps from a road's centre line. |
| `armour` | 0.23, optional: `{ cap?, cost?, size?, leash?, depot?: { x, z } }` over `garrisons.json` `armour` (2 Battle tanks of the roster's `tank` slot, 240 alloy, 2 squads, 9 m leash; the depot defaults to the commander's post). Leave it out and there is no armour. |
| `roads` | 0.23, optional: `{ routeId: "name" }`, the road names the wave intel shows (default: Road, West bridge, Ford, East bridge). |
| `perks`, `endless` | 0.21, set only by the Defence menu (`defenceVariant` in `src/defence/levels.js`), never by a campaign mission: `perks: [id]` from progress; `endless: { seed }` generates waves forever from the seed (`endlessWave`). |

Defence maps (`src/defence/maps.json`, `defence: true`) have no bases, deposits or boulder walls and are not offered in Skirmish; `look` borrows a skirmish map's palette, dressing, life and music. A kill pays a tenth of the unit's cost; a unit reaching the exit costs a life (two for supply 3 or more). Commands: `padBuild { pad, crew }`, `padUpgrade { building }`, `padBranch { building, branch }` (0.21), `padSell { building }` (60% back), `waveCall`, `heroMove { x, z }`, `heroCast { ability: "barrage"|"reinforce", x, z }`, `demolish { crossing }` (0.21), `zoneBuild { zone, x, z, crew }`, `armourBuy`, `armourMove { squad, x, z }`, `armourMode { squad, mode }` (0.23), `padRank { building }`, `armourUpgrade { squad, branch? }` (0.24). Progress: `localStorage['frontier-defence-v1']` (`levels`, and since 0.21 `perks`, `endless`, `daily`).

### Defence complete (0.21)

- **Crews and branches.** The Tank emplacement (heavy single shots, slow, ×1.8 against machines, no bonus against infantry) and the Scorcher flame trap (short range; every 1.5 s it lays a Burn line zone where it fires). At tier 3 a tower takes one of its crew's two branches (`padBranch`, stored as `branch`): Ranger Marksman/Suppressor (slows), Breaker Cluster/Guided, Anti-tank Heavy/Rapid, Watcher Beacon (marks: +25% damage taken)/Far-eye, Tank Breacher/Shrapnel, Scorcher Inferno/Firewall. Deltas in `garrisons.json` (`damage`, `interval`, `mech`, `splash` multiply; `range`, `reveal` add; `splash_damage` replaces; `slow`, `mark`, `burn` are on-hit).
- **The commander.** Moves where it is sent (never within 10 m of a spawn), holds, fires without chasing and blocks the road (a wave unit in front of a blocker stops). Barrage (the Breakers' shelling, 20 m reach, 40 s) and Reinforce (three Vanguards that hold the road for 20 s, 35 s). Back at its post 20 s after it falls (`defence.hero`).
- **Bridges.** `demolish` costs 60 alloy, lights a 3 s fuse, then throws anyone on the span to the nearer bank (by the sign of z) for 60 damage, closes the river there (`sim.crossings`, re-applied by `snapshot.restore` before the grid) and turns the columns on that road to the nearest open crossing. The ford can't be blown and the last open crossing the routes use is refused. Bridge builders stop at the bank; 20 s of work with at least one of them at the bank makes a pontoon (wades like the ford); the work resets if every builder falls.
- **Endless and Daily.** Waves from a seed, forever (`endlessWave`: a budget that grows each wave, groups drawn from the level's own units and routes, extra hull after wave 10, bridge builders every fourth wave where bridges can be blown). The score is waves held; the best per level (Endless) and per level per day (Daily, the last 7 days) is kept. Endless uses the level id as its seed; Daily the date (`dailySeed('YYYY-MM-DD')`), the same for everyone that day.
- **Perks.** Bought once with stars: Quartermaster (first tower −20%), Reserves (+2 lives), Fast guns (Barrage cooldown ×0.75).
- **Levels.** Six (seven since 0.23 with Three Roads): Gorge Road, Twin Bridges, Switchback Pass (Wardens), Fordwood (Ashfall with Warden machines; the east bridge is down), Amber Canyon (Veil shades), Long Crossing (Veil with Sunward riders). Each opens once the one before has a star.

### Build zones and armour (0.23)

- **Build zones.** `zoneBuild { zone, x, z, crew }` snaps (x, z) to the centre of its 2 m navigation cell and builds there if the spot is inside the zone, on open ground (off cliffs, ramps and river banks, 2 m inside the map edge), at least `zoneClear` (4.5 m, as the fixed pads) from every road's centre line, 10 m from every spawn spot, clear of the exit, 5 m from every pad and tower, not under a unit, does not wall in ground (`nav.wouldSeal`), and the zone is not full (`max`). Otherwise the command is refused with the reason as a message (`sim.zoneCheck(team, zone, x, z)` returns `{ x, z, zone }` or `{ why }`; `zoneGround(x, z)` is the part that never changes, which the interface paints). A build makes a pad of its own in `defence.zonePads` (`{ id: "<zone>-<n>", x, z, zone }`, numbers never reused, `defence.zoneNext`), so `padUpgrade`, `padBranch`, `padSell` and `towerOn` work as on a fixed pad; selling removes the pad (the spot is free again), a tower destroyed leaves it standing to be crewed again with `padBuild`. Both keys exist only after the first zone build, so levels without zones save and hash as before.
- **Armour squads.** `armourBuy` (no arguments) spends `cost` and puts `size` tanks at the depot on a ring clear of each other, refused at `cap` squads in the field. Each tank carries `squad` (the squad number, `defence.armourNext` counts them, created on the first purchase) and `leash`. `armourMove { squad, x, z }` sends the squad (an ordinary `move` order for each tank, spread as any group move; refused onto ground it cannot stand on and within 10 m of a spawn spot). Any ordinary `order` command moves them too. `armourMode { squad, mode: "guard"|"road" }`: on Guard (the default) a tank fires at anything in range, chases only enemies within `leash` of its spot (`combat.js` `holdPost`, `e.leash` in place of sight + 4 m) and drives back; on "Hold the road" it takes `stance: "hold"` and `blocker` and stops a column like the commander (never at a spawn spot, wherever it was moved). After every wave beaten each squad still in the field is mended and refitted to `size` beside its first tank (`armourRefit`); a squad wiped out frees its slot for a new purchase. Events: `armourBuy`, `armourMove`, `armourMode`, `armourRefit`.
- **Interface.** The zones' open cells are painted as one merged flat mesh. A tap in a zone opens the crew sheet for the snapped spot (its range ring red and the crews off, with the reason, when refused). The Armour chip in the Defence bar (squads in the field / cap) picks the next squad on each tap, or opens the depot when none is out; a tank tapped picks its squad; with a squad picked a tap on the map sends it. The squad sheet: Guard, Hold road, New squad, Squad (focus).
- **Three Roads** (`d-crossroads`, map `crossroads`, 128 m, after Long Crossing): three entries and four roads (the north road forks round the basin, every road meets the others before the exit), 15 pads, four zones, armour, Ashfall with Warden machines and carriers on several roads at once. The defence bot builds in zones (every other open cell, coverage cached per wave) and buys a squad at four towers, the second from wave 4, saving for them, and every 6 s posts each squad beside the road the wave loads most.

### Ranks, armour upgrades and tower repair (0.24)

- **Branch ranks.** Every tier-3 branch has two ranks after it (`garrisons.json` `crews[crew].branches[branch].ranks`, each `{ cost, ...effects }`), bought in order with `padRank { building }` (refused before a branch, after the last rank, or without the alloy), stored on the tower as `branchRank` (1 or 2; the key exists only after the first rank) and added to `spent` (so Sell refunds part). Rank effects stack on the branch in order: `damage`, `interval`, `mech`, `hp` multiply; `range`, `reveal` add; `splash` multiplies and `splash_add` adds metres of blast; `splash_damage` replaces; `slow` and `mark` replace the on-hit effect; `burn` multiplies dps/seconds/every and adds radius; and three new effects: `pierce` (the share of the target's shield a shot passes, `combat.js hit` → `garrisonPierce`), `burst` `{ shots, gap }` (shots of a burst `gap` seconds apart, then the full reload, `garrisonBurst`; state `burstShot`), `slow_radius` / `mark_radius` (the slow or mark also falls on enemies that near the target, `garrisonHit`). Event: `levelup` with `rank`. Shipped ranks (cost: effect): Marksman 140: ×1.15 damage, half the shield pierced / 190: every shield pierced, ×2 against machines, +1 m; Suppressor 120: slow 0.45 for 2.2 s / 170: slow 0.4 for 2.6 s spreading 2.5 m, ×1.2 damage; Cluster 150: ×1.2 blast / 200: ×1.15 blast, 80% splash, ×1.1 damage; Guided 140: +2 m, mark +15% for 3 s / 190: +2 m, ×1.15 damage, mark +25% for 4 s; Heavy 140: ×1.3 against machines / 190: ×1.3 again, ×1.1 damage; Rapid 140: bursts of 2 (0.15 s apart, reload ×1.6) / 190: bursts of 3 (reload ×1.5 more), ×1.1 damage; Beacon 120: mark +35% for 5 s / 170: mark spreads 3 m, ×1.2 damage; Far-eye 110: +6 m sight, +1 m / 160: ×1.3 damage, half the shield pierced, +1 m; Breacher 150: ×1.2 against machines / 200: ×1.15 damage, ×1.1 against machines; Shrapnel 150: +1 m blast / 200: 70% splash, ×1.1 damage; Inferno 140: ×1.3 burn / 180: ×1.25 burn, fires last ×1.3; Firewall 130: +1 m fire / 170: fires last ×1.3, laid every ×0.7. Every rank also adds armour (`hp` ×1.1, front-line Tank and Scorcher ranks ×1.2 to ×1.25).
- **Armour upgrades.** `armourUpgrade { squad }` buys `garrisons.json` `armour.rank2` (160: hp ×1.35, damage ×1.1, mends 3% a second), then `armourUpgrade { squad, branch }` one of `armour.branches`, once: `assault` (200: damage ×1.35, reload ×0.8, ×1.3 against machines, leash +4 m: hunts machines and carriers) or `bulwark` (200: hp ×1.7, mends 5% a second: holds the road far longer). Stored on each tank (`squadRank`, `squadBranch`, `mend`; created on the first upgrade) and given to the tanks a refit brings (`spawnArmour(..., like)`). A squad wiped out loses them. `sim.armourNextUpgrade(squad)` says what is next (`{ kind: "rank", cost }`, `{ kind: "branch", costs }` or null). Event: `armourUpgrade`.
- **Tower survival.** Tiers are hp ×1 / ×1.35 / ×1.75 (were ×1 / ×1.25 / ×1.5); a crew may carry its own `hp` factor (Scorcher and Tank ×1.5, Breaker ×1.2: the front line). **Field repair** (`garrisons.json` `repair: { delay: 6, rate: 0.04 }`, `fieldRepair` in `stepDefence`): a garrison not hit for `delay` seconds (its `hitAt`, set by any damage, the shield too) mends `rate` of its health a second, during waves and between them; a Rank 2 squad mends at its own `mend` rate the same way. The full repair when a wave is beaten is unchanged. Only Defence matches run any of this; campaign towers and units are untouched (fingerprint d071360b).
- **Retune.** Scorcher direct-hit damage ×0.75 → ×0.7 (a Scorcher-only defence must still fall where it fell), Three Roads Story enemy hull ×0.8 → ×0.85 (a Breaker-only defence still falls there), and Endless hull growth from wave 10 is `garrisons.json` `endless.hp` = 0.1 a wave (0.06 before), so the ranks' late-game power does not simply lengthen every Endless run.
- **Interface.** The tower sheet of a branched tower shows `RANK n / 2`, the branch name with one pale-gold diamond per rank, and a Rank up tile (cost, what the next rank does in its title and the hint; Top rank when done). The tower's model trim brightens per rank and its health plate gets one pale-gold pip per rank left of the three tier pips (`selection-view.js` `rank` uniform). The squad sheet adds Rank 2, then Assault and Bulwark, then the chosen branch with a check. The defence bot ranks the best-covering branched tower from wave 5 (once its tiers are done, or from wave 7) and gives each squad Rank 2 from wave 5 and a branch from wave 7 (Assault when the next wave has 3+ machines, else Bulwark).

### Wave intel and carriers (0.22)

- **Wave preview.** `sim.wavePreview()` returns the next wave (`{ wave, units: [{ type, count, carry?, passengers? }], routes }`, counts as they will spawn on the difficulty) while it can still be called; the Defence bar shows it as portraits with counts and the roads it takes.
- **Troop carriers.** The `carrier` unit (balance.json, `carrier: true`, `defence: true`; supply 3, so a leak costs 2 lives; mechanical, unarmed). A carrier group `{ units: { carrier: n }, carry: { slot: n }, dropLeg, route, every, delay }` gives each carrier the squad `carry` (scaled by the difficulty like any group, resolved through the group's roster), stored on the carrier as `cargo` (types in boarding order; `cargoHp` when the group has a hull factor). On reaching route point `dropLeg` (clamped before the exit) it stops; 0.6 s later the squad steps out on free spots around it (the Reinforce ring search) and walks on from the nearest leg, never back past the carrier's; the empty carrier waits 1 s and drives on. Destroyed with passengers aboard, they never spawn and their bounty is paid with the carrier's (`bounty` with `carried`, `carrierDown`, a `strike` blast). Events: `unload`, `drop`, `carrierDown`. Only Long Crossing wave 8 and Endless (every fifth wave from the fifth: 1–3 carriers with 4–8 foot soldiers of the level's own units, dropped half-way down a road) use them.
- **Waves called early.** A wave still on the road when the next starts is held apart: its units are tagged `wave`, its number goes in `defence.open` (both only then, so other matches save as before), and when its last unit falls it pays its clear bonus, `waveCleared` and the tower repair once. `defence.cleared` counts waves beaten. The level is won when the last wave has started and every wave is beaten.
- **Flyers and blockers.** Ground blockers (the commander, Reinforce Vanguards) hold ground units only.
- **Incoming.** `startWave` emits one `incoming` per distinct spawn point of the wave's groups (with that point's count); the interface pings each and alerts once.

## Faction Chronicles (0.20)

Four short campaigns of three missions each, played *as* another faction, tell the main war from that side (`src/story/chronicles.js`; story lines for review in `docs/aaa/review/story-lines.md`, "Chronicles").

```js
{
  id: "sunward", title: "The Long Road", faction: "sunward",
  lead: "sol",                       // a CAST id with a portrait; speaks most lines and the finale line
  address: "Wagon-master",           // how the chronicle's people address the player (never "Commander")
  unlockAfter: "m04-three-way-dunes", // the main mission that opens it (the end of Act 1)
  summary: "...",
  missions: [ /* three mission definitions */ ],
}
```

| Chronicle | Played as | Lead · address | Missions |
|---|---|---|---|
| `ashfall` *Salvage Rights* | Ashfall | Hale · Foreman | Cold Berths (classic), Lights Out (riverlands), The Scrapyard Gorge (Defence, Gorge Road) |
| `sunward` *The Long Road* | Sunward | Sol · Wagon-master | Dry Wells (dunes), Three-Way Dunes (dunes), The Verdant Road (woodlands) |
| `wardens` *ECHO's Key* | Wardens | ECHO · Warden-prime | Standing Orders (expanse), A Grey Coat (highlands), Hold the River (Defence, Twin Bridges) |
| `veil` *The Quiet Survey* | Veil | Maren · Surveyor | Night Count (highlands, no base), One Circuit (woodlands), Inside the Dampers (highlands) |

**Mission data.** The usual shape, plus:
- `chronicle`: the chronicle id.
- `factions[0]`: the chronicle's own faction, with `rules.rosters: true`. The simulation then gives team 0 that roster (units, faction building, trait; `normalizedFactions` in `src/factions.js`). Spawns and waves keep slot names (`vanguard` is a Shade for a Veil team 0). Enemies may be Meridian.
- Every field mission has a `time` lose condition, so a passive player always loses.
- `check`: the checker's targets. A field mission has `{ passive, win: [from, to], earliest }` (seconds). A Defence mission (a `defence` block, as in "Frontier Defence levels") has `{ story, standard, veteran }` stars for the DefenceBot.
- Only the existing objective kinds and triggers are used; chronicles ask no decisions.

**Progress** (`progress.chronicles`, kept as stored on load like every field): `{ [chronicleId]: { cleared: [missionId], done, best: { [missionId]: { time, medal, difficulty } } } }`, written on a chronicle win only. A chronicle opens when its `unlockAfter` main mission is cleared; inside it the first mission is open and each next one opens when the one before is cleared. `done` is set when all three are cleared. Readers in `src/campaign.js` work for any campaign id (`"main"` or a chronicle id): `missionsOf`, `clearedIn`, `unlockedIn`, `bestIn`, `nextIn`, `recordIn`; `missionById(id)` returns `{ campaign, index, mission }` for chronicle missions too, so a chronicle save continues (`mode: "campaign"`, its mission id).

**Finale.** `if: { chronicle: id }` may sit on any entry `if` accepts; `resolveMission` settles it before the match: it passes once that chronicle is `done`. Mission 12's debrief has one such line per chronicle, by its lead. Lines only: a squad would change the finale's knife-edge balance, and the plan allows one only if the checker passes with and without it. With no chronicle finished the finale resolves byte-identically to 0.19a.

**Interface.** The campaign map's footer shows four chronicle cards (faction colour and emblem, lead portrait, three relay pips, a locked state naming the opening mission); the setup list repeats them under the acts for the keyboard and screen readers. Choosing one lists its three missions; the header reads `CHRONICLE · Sunward · 2/3`, the briefing and debrief `CHRONICLE · 2/3`. A chronicle's Defence mission plays with the Defence interface but keeps the campaign header and debrief.

**Checks.** `npm run check:missions -- --chronicle <id|all> [--only cs1] [--difficulty story|veteran] [--jobs 1]` (`tools/chronicle-check.mjs`): the ObjectiveBot must win inside `check.win` and a passive player must lose, not before `check.passive`; a Defence mission's DefenceBot must reach its stars and an empty field must lose. Unit tests: `tests/chronicles.test.js`; browser: `npm run test:chronicles`.

### Air waves (0.18.3)

A level (or campaign Defence mission) with `rules.air: true` may name flyers in its wave groups (`{ kite: 2 }`, `{ balloon: 2 }`, `{ glider: 3 }`: any unit type stands for itself).

- **Flight.** A flyer follows the same route order as a walker, leg by leg in its own lane, but flies each leg straight from corner to corner over any ground (`stepRoute` skips the traverse check for `flying`). It fires on the move at what is in range (a balloon bombs towers within 4 m of its lane, a glider within 6 m), leaks like anyone (one life; two for supply 3 or more, so an Ember balloon costs two) and pays a tenth of its cost when shot down (Kite 10, glider 21, balloon 30). Kites are unarmed spotters: flyers see plateau tops, so a Kite over the road shows rim and deep pads to the column behind it.
- **Which crews hit air: the simplest rule.** Under `rules.air`, a crew whose own unit hits air makes its tower hit flyers (`garrisonStats` copies `hits_air`): Ranger nests, Anti-tank posts and Watcher posts do, Breaker mortars, Tank emplacements and Scorcher traps never do. Towers hit flyers ×1.5 like Flak towers (`AIR.flak_bonus`), and the crew's own machine factor applies (flyers are machines: Anti-tank posts are the hard answer, Ranger nests ×0.4 the soft one). There is no flak tier and no research in Defence. Without `rules.air` nothing changes (Hold the River and the four 0.21 levels keep their towers exactly as they were).
- **Where.** Gorge Road (Ashfall): 2 Kites in wave 5, 2 Ember balloons in wave 7, 2 Kites and 2 balloons in wave 9, 3 balloons in wave 10. Twin Bridges (Sunward): a Kite in wave 4, 2 Swift gliders in wave 6, 2 Kites and 2 gliders in wave 8 (hull ×1.5), 3 gliders in wave 10 (hull ×1.8; without the extra hull the flyers' bounty let a Ranger-only player reach three stars on Story). Hold the Valley: a Kite in wave 6, 2 balloons in wave 8. Hold the River has none (air first appears in Wings over Copper). Endless on these two levels draws flyers too, since it builds its groups from the level's own units.
- **Checks.** `npm run check:defence`: the DefenceBot still reaches its stars on every difficulty, the passive player loses, no single crew type reaches three stars, and Breaker-only now does worse (Gorge Road Story 1★ 6♥ → 0★, Twin Bridges Story 2★ 12♥ → 1★ 2♥, Standard 1★ → 0★). The bot: Gorge Road 3★/3★/3★ (Veteran 20♥ → 18♥), Twin Bridges 3★/2★/2★ (Story 18♥ → 20♥, Standard 15♥ → 16♥, Veteran 16♥ → 13♥). Endless (reported, not a target): Gorge Road still holds 40+ waves; Twin Bridges now falls at wave 27 (it held 40+), since its endless groups now include gliders. The anti-air hint names the crews that hit air the first time a flyer is in sight with none on the field.

## Heroic challenges (AAA round 2, W2-B)

A Heroic variant is **new content** built by `defenceVariant(level, { variant: "heroic" })` from the designed level; the designed levels get no field (`src/defence/heroic.js` holds one spec per level id).

- **Opens** after the first clear of the level (`progress.levels[id].stars > 0`); the menu's Heroic tab shows a locked teaser until then. A win records `progress.heroic[id] = { won, lives }` and is worth +1 star (`totalStars`): 21 to 28.
- **Waves.** Waves 5 to 10 of the designed level at Standard scale, whatever the difficulty setting. In each wave the 2 largest groups carry an elite affix from the level's table; wave 6 is all-elite (troop carriers excepted). 5 lives, alloy = Standard alloy + the spec's `alloy`, `noCallBonus`, `look: "dusk"`.
- **Affixes by level.** Gorge Plated, Swift; Bridges Swift, Volatile; Switchback Banner, Mender; Fordwood Splitter, Swift; Canyon Plated, Banner; Long Crossing Volatile, Splitter; Three Roads Mender, Plated, Banner. Knobs per level: `alloy`, `every` and `everyOf` (every n-th unit of a group is elite), `stalkers`.
- **Stalker columns** on Amber Canyon and Long Crossing: from Heroic wave 2 one group a wave adds 2 to 3 Stalkers (cloaked; pad towers within 9 m, anything within 4 m and each shot reveal them).
- **Elite rules.** `e.elite` (affix), `e.bounty_x` (3), lazy `defence.elites` count; Splitter children use `spawnOnRoute`; Banner never stacks. A wave preview names elite groups (`elite` field) and the wave strip shows an affix chip.
- **Finale slot.** `spec.finale` (null) is a wave group joined to the last wave: round 3 adds a boss with data only.
- **Checks.** `npm run test:defence-heroic-check`; `tests/golden-w2b.test.js`.
