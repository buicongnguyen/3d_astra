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

**Trigger conditions (`when`)**: `time` (seconds), `enter` (region + team), `objective` + `is` (`done`/`failed`), `event` (a simulation event type: `incoming`, `built`, `levelup`), `tagHpBelow`, `tagDead` (tag), `count` (`{ team, type, atLeast }`), `pointOwned` (`{ point, team }`). Triggers fire once unless `repeat: seconds` is given.

**Actions (`do`)**: `say` (`who`, `text`), `wave` (`team`, `units`, `from` region or `"enemyBase"`, `target` region or `"playerBase"`), `spawn` (as in setup), `reveal` (objective id), `complete`/`fail` (objective id), `give` (`{ alloy, energy }` to the player), `camera` (region; a short pan the player can cancel), `ping` (region), `aiSpeed` (new speed), `music` (`calm`/`tense`/`battle`).

**Capture points** are neutral markers. A team owns one while it has a combat unit within the region and no enemy combat unit is there for 5 seconds; ownership stays until another team takes it. `gives` adds resources per second to the owner.

**Speakers (`who`)** are ids from `src/story/world.js` (`CAST`). Text is English; every story string (titles, briefings, intel, objectives, lines, unit names, capture point labels) also needs a Vietnamese entry in `src/locales/story-vi.json`, keyed by the English text; `tests/story-vi.test.js` fails until it has one, with the same numbers and names (`node tools/story-strings.mjs` lists the strings). Give each `capturePoint` a `label`: it is the name in the capture toasts. Keep lines under 140 characters so they fit a phone.

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
