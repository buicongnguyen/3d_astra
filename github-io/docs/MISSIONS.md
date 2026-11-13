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

**Trigger conditions (`when`)**: `time` (seconds), `enter` (region + team), `objective` + `is` (`done`/`failed`), `event` (a simulation event type: `incoming`, `built`, `levelup`), `tagHpBelow`, `tagDead` (tag), `count` (`{ team, type, atLeast }`), `pointOwned` (`{ point, team }`), and in a mission under the Defence rules `wave` (wave n beaten) and `waveStart` (wave n started). Triggers fire once unless `repeat: seconds` is given.

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

**Campaign progress** (`frontier-campaign-v2`, `src/campaign.js`): `cleared` as before, plus `decisions` (`{ [id]: option }`, written on a mission win; a loss writes nothing; replaying a mission replaces its answer), `endingsSeen` (written when the finale is won) and `chronicles` (reserved for 0.20). Every field is kept on load and on every record, older progress loads unchanged, and a mission opens when it is cleared itself or the one before it is (by mission id). `missionById(id)` returns `{ campaign, index, mission }`. The mission checker's targets are keyed by mission id (`MISSION_TARGETS` in `tools/mission-check.mjs`).

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
| 3 | `m02b-hold-the-river` | Twin Bridges | Ashfall | 7 | Hale comes back for the river crossings while Okoro tunes the river relay |
| 9 | `m07b-hold-the-valley` | Gorge Road | Ashfall | 8 | Okoro's survey on the relay plateau finds where the lines meet: a Builder vault (sets up The Quiet Vault) |

The campaign has 14 missions since 0.19b. Ids are stable; an inserted mission takes the id of the one before it with a letter (`m02b-…`). A player who cleared all twelve keeps everything open and finds the new ones next (a mission opens when it or the one before it is cleared). The campaign map lays out its nodes from the list (`mapLayout` in `src/story/campaign-map.js`); missions under the Defence rules have square relays. The third new mission of the plan, *Wings over Copper* (the first air raid, id `m06b-wings-over-copper`, reserved), is added after the air units merge: a TODO marks its slot in `src/story/missions.js`.

**Reworked in 0.19b.** Mission 2 is a bridge assault: Ashfall holds a bridgehead at the far end of the west bridge (two towers whose 13 m reach covers the far half of the span, 9 guards in the gap between the rocks), the ford is slow and stops abilities, and the core falls after the bridgehead. Mission 9 is a high-ground hold: after the link-up, take the dune plateau and hold it for 3 minutes while Hale's Warden drones climb its ramps (the core is optional). Mission 6 shows two Veil scouts on the basin rim. The plan's ford fight for mission 6 is not possible on the Copper Basin, which has no river.

## Rules for authors

- Tagged objects of an eliminated enemy stay standing. When an enemy loses its last Command core every untagged unit and building of that team is removed, but entities with a `tag` remain (they stop acting but still fight if armed), so `destroyTag` objectives such as the siphons (mission 3) and conduits (mission 11) are always won by destroying them, never by killing the core. Keep tagged objects reachable once the base is gone.

- Positions are world metres, origin at map centre, `x` and `z` within ± half the map size minus 6. Check them with a node script against `new Simulation({ map })`: use `s.nav.canStand(x, z, 2)` and keep 8 m clear of bases unless intended.
- A mission must be winnable with the units and buildings the player has unlocked by then. State the intended solution in a `design` string on the mission.
- No objective may depend on something the player cannot see or be told about.
- Do not reference abilities or units that do not exist in `balance.json`.

## Campaign difficulty

Simulation accepts and saves `difficulty` (`story`, `standard`, `veteran`; default Standard). Values in `balance.json.difficulty` scale scripted wave counts, enemy damage to team 0, optional finish deadlines and time medals. Story grants 150 alloy after mission setup. Veteran advances Relaxed to Normal and Normal to Fast, including scripted speed changes. Skirmish ignores these modifiers.

Spawn/setup records may specify `hpByDifficulty: {story: 700}`; an absent entry uses `hp` as before. This supports isolated mission tuning. Saves include the mission data and chosen difficulty. The benchmark is `npm run check:missions -- --difficulty story` (or standard/veteran). The plan's Veteran target permits at most two objective-bot misses, but the checker remains strict and exits nonzero for any miss. Report exceptions explicitly.

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
| `crews` | Crew ids from `src/defence/garrisons.json` (`ranger`, `breaker`, `antitank`, `watcher`); slots resolve through the player's roster. |
| `waves` | `{ groups: [{ units: { slot: n }, route, every, delay, hp? }], bonus }`: slots resolve through the enemy roster; types take turns within a group. |
| `camera` | `{ x, z, zoom, maxZoom }`: the start view and the Overview zoom. |

Defence maps (`src/defence/maps.json`, `defence: true`) have no bases, deposits or boulder walls and are not offered in Skirmish; `look` borrows a skirmish map's palette, dressing, life and music. A kill pays a tenth of the unit's cost; a unit reaching the exit costs a life (two for supply 3 or more). Commands: `padBuild { pad, crew }`, `padUpgrade { building }`, `padSell { building }` (60% back), `waveCall`. Progress: `localStorage['frontier-defence-v1']`.
