# Stage 2: faction identity

Read [README.md](README.md) first. Goal: the four enemy factions stop being recolours of the player. Each gets two units of its own, one building, one trait and an AI personality. With colour removed, a screenshot still shows who is who, and each needs a different answer. Release as 0.11.0 (framework and Ashfall), 0.12.0 (the other three), 0.13.0 (missions and skirmish).

**Today:** every team trains the same eight units from `balance.json`. `mission.factions` (`{ 1: "ashfall" }`) only drives colours (`src/faction-colors.js`) and emblems (`src/emblems.js`). `src/sim/ai.js` names unit types directly (`'vanguard'`, `'ranger'`, `'breaker'`, `'tank'`). Counters compare `e.counter === t.type` in `src/sim/combat.js`.

**Approach: slots.** A faction does not get a whole new roster. It swaps two of the base units for its own and adds one building. The AI, the hints and the missions keep talking about base slots (`vanguard`, `ranger`, ...) and a small lookup turns a slot into the faction's real type. This keeps the change small and the twelve missions playable throughout.

## Package 2.0: load models per match

**Why first.** Twelve new models would add about 2 MB to every first visit, and eleven suites hard-code 13 models.

**Work**
1. `WorldView.loadModels` (`src/view.js`) and `prefetchModels` (`src/app/loading.js`) take a list of types. Boot loads the **core set**: the 13 current models plus `environment`. Add `view.ensureModels(types, onProgress)` that fetches and prepares any missing type, with the same three-try retry.
2. `A.newGame` and `restart` (`src/app/match-flow.js`) work out the types the match needs (base roster plus the rosters of the factions in play), call `ensureModels` and show the existing loading progress on the Start button or briefing until it resolves. A failure shows the existing Retry.
3. Add `view.modelsReady` (true when every type the current match needs is prepared). Replace every `view.models.size === 13` in `tests/*.mjs` with it (expose it through `src/app/debug-hooks.js`).
4. Service worker (`tools/sw.template.js`): faction models are cached on first fetch, like the current models; they are not precached.

**Tests.** All existing suites still pass. Extend `tests/offline.mjs`: a faction model fetched once is served offline. Unit test for the "types a match needs" function.

## Package 2.1: faction framework in the rules

**Data** (`src/balance.json`)
- Every definition with `kind: "unit"` gets a `class`: `worker`, `melee` (Vanguard), `ranged` (Ranger), `siege` (Breaker), `armor` (Battle tank), `antiarmor` (Anti-tank soldier), `support` (Medic, Engineer).
- `counter` now names a class (`"ranged"`, not `"ranger"`). `combat.js` uses `e.counter === t.class`. Keep the numbers; `tests/` and `docs/BALANCE.md` must show the same matchups as before for the base roster.
- New top-level key:

```json
"factions": {
  "meridian": { "swap": {}, "building": null, "trait": null, "ai": null },
  "ashfall":  { "swap": { "vanguard": "scrapper", "breaker": "scorcher" }, "building": "salvageyard", "trait": "salvage", "ai": "rush" },
  "sunward":  { "swap": { "ranger": "rider", "medic": "wagon" }, "building": "waystation", "trait": "roads", "ai": "raider" },
  "wardens":  { "swap": { "ranger": "drone", "tank": "walker" }, "building": "pylon", "trait": "selfrepair", "ai": "turtle" },
  "veil":     { "swap": { "vanguard": "shade", "antitank": "watcher" }, "building": "veilrelay", "trait": "farsight", "ai": "evasive" }
}
```

**Rules**
- `Simulation` takes `factions: { [team]: id }` (default: all `meridian`), saved with the match. A mission supplies it from `mission.factions` **only when the mission has `rules.rosters: true`** (so missions switch over one at a time, package 2.6).
- `sim.typeFor(team, slot)` returns the swapped type or the slot itself. `sim.slotOf(type)` is the reverse.
- A building's `trains` list is resolved per team through `typeFor` when the building is created (store the resolved list on the entity so saves stay simple). The faction building is added to that team's construction list; `BUILDINGS` in `src/data.js` becomes `sim.buildable(team)`.
- `enqueue` and `placement` in `src/sim/orders.js` reject types outside the team's roster.
- Mission data keeps using slots in `wave`, `spawn` and `count` (`{ vanguard: 4 }` spawns Scrappers for an Ashfall team when rosters are on). A literal faction type is also accepted.
- `src/sim/ai.js` and `src/sim/ai-counter.js`: every literal unit type goes through `typeFor(team, slot)`; composition logic reasons in classes.
- Traits are small hooks, each in a new `src/sim/traits.js`, switched by `factions[id].trait`. Each is specified with its faction below.

**Interface**
- Command card, production panel, field guide (`src/field-guide.js`), fight hints (`src/app/ui-extras.js`) and tooltips read `class` and resolved rosters instead of fixed type names.
- An enemy unit's info panel names its faction.

**Tests** (`tests/factions.test.js`): the base roster's matchups are unchanged (golden numbers from the current `balance.json`); `typeFor`/`slotOf` round trip; a team cannot train another faction's unit; save and load keep factions; a match with all teams `meridian` produces the same `sim.hash()` after 60 s as before this package for the same options (record the hash from `main` before starting).

## Package 2.2: models for the twelve new types

**Work** (`tools/blender/generate_assets.py`, `tools/blender/frontier_kit.py`)
- One GLB per new type in `public/models/`, following the runtime contract in `docs/ASSET_PIPELINE.md`. Budgets: infantry 2.8 to 3.2k triangles, light vehicles 4.5k, the Walker 6.3k, buildings 2.1 to 4k.
- **Silhouette rule:** each faction has one shape language, visible at game zoom with colour removed:
  - Ashfall: patched, asymmetric salvage; exposed frames, mismatched plates, a tall exhaust stack.
  - Sunward: wheels, awnings and round water tanks; low and wide.
  - Wardens: smooth old machines; rings, a single eye light, no visible crew.
  - Veil: tall and thin; masts, hoods, lens discs.
- Moving parts follow the existing names so they animate without new code: `leg_L`/`leg_R` for infantry, `Barrel*`/`Turret_head*` for aiming parts. The Drone has no legs: add a `hover` empty and let the view bob it (two lines in `src/view.js`, accumulated phase, per-unit phase offset).
- Extend `tests/assets.test.js` to cover the new files, and `manifest.json` with their triangle counts.
- Render review sheets with `tools/blender/preview_assets.py` (one sheet per faction, game camera, plus a greyscale version) into `docs/aaa/review/`. **Stop here for the owner's approval of the look before wiring the models in.**
- Regenerate the portrait atlas (`tools/blender/render_ui_art.py`) with the new types appended to `PORTRAIT_ORDER` (`src/portraits.js`); never reorder existing entries.

## Package 2.3: Ashfall (the vertical slice)

Build one faction end to end before the others, to prove the framework.

| Type | Replaces | Numbers | Notes |
|---|---|---|---|
| `scrapper` "Scrapper" | Vanguard | hp 85, shield 0, speed 5.4, damage 9 every 0.8 s, range 2, cost 60/0, pop 1, time 6, class `melee`, counter `ranged` ×1.6 | Cheap and many. Ability "Rush": +40% speed for 5 s, cooldown 30 |
| `scorcher` "Scorcher" | Breaker | mechanical, hp 260, shield 40, speed 3.2, damage 9 every 0.3 s, range 5, splash radius 2.5 at 0.6, `building_bonus` 2, cost 175/75, pop 3, time 20, class `siege`, counter `melee` ×1.5 | Short-range flame. Ability "Burn line": the target area (radius 3) burns for 6 s, 8 damage per second to units, cooldown 40 |
| `salvageyard` "Salvage yard" | (new building) | hp 700, shield 40, radius 2.2, cost 150/0, time 16, requires a Barracks | Enables the trait around it |

- **Trait `salvage`:** when a vehicle or building of any team is destroyed within 14 m of an Ashfall Salvage yard or Command core, Ashfall gains 25% of its alloy cost. Emit a `salvage` event for a small "+N" float at the wreck (visible only if the player can see the spot).
- **AI `rush`:** pace modifiers applied on top of the speed: `firstWave` ×0.7, `waveGap` ×0.85, `minWave` +2, `foundryAt` ×1.3, builds a Salvage yard after its first Barracks. Modifiers live in `balance.json` under `ai_personalities`.
- `building_bonus` is a new multiplier in `hit()` against `kind: "building"`. Burning ground is a new timed area in the simulation (`sim.zones`, saved, capped at 16) with an fx hook in `src/fx.js`.

**Tests.** Unit tests for each number-bearing rule (salvage income and radius, burn zone damage and expiry, save and load of zones). A bot match (`tools/skirmish-bench.mjs --enemy ashfall`): the standard bot build must do measurably worse than a build with more Rangers and towers; record both win rates. Browser: a new `tests/factions.mjs` checks an Ashfall skirmish loads its models, shows the units' names, portraits or icons, and the info panel at the three viewports.

## Package 2.4: Sunward, Wardens, Veil

Same shape as 2.3. Numbers are starting points; tune them with the bench, keep them in `balance.json`.

**Sunward** (trait `roads`: +15% speed on `road` and `sand` surfaces; AI `raider`: sends a detachment of its fastest units at the player's Harvesters before each wave, reusing the coalition `raider` role in `src/ai-plan.js`)

| Type | Replaces | Numbers |
|---|---|---|
| `rider` "Rider" | Ranger | hp 110, shield 20, speed 6.4, damage 10 every 0.9 s, range 8, cost 110/25, pop 1, time 13, class `ranged`, counter `siege` ×2. Ability "Dash": double speed 3 s, cooldown 30 |
| `wagon` "Supply wagon" | Medic | mechanical, hp 240, shield 30, speed 3.6, no weapon, heals infantry and repairs vehicles 6 hp per second within 6 m, +4 population cap while alive, cost 150/75, pop 2, time 18, class `support` |
| `waystation` "Waystation" | (new) | hp 600, radius 2, cost 125/0, time 14. Friendly shields within 10 m recharge 3× faster |

**Wardens** (trait `selfrepair`: a unit that neither dealt nor took damage for 6 s regains 2% of max hp per second; their Barracks and Foundry do not train Medics or Engineers; AI `turtle`: `firstWave` ×1.5, `minWave` +4, towers +2, builds a Pylon beside each production building)

| Type | Replaces | Numbers |
|---|---|---|
| `drone` "Sentinel drone" | Ranger | mechanical, hp 60, shield 90, speed 4.6, damage 11 every 0.9 s, range 9, cost 110/40, pop 1, time 13, class `ranged`, counter `siege` ×2.2. Shield recharge delay 3 s instead of 5 |
| `walker` "Walker" | Battle tank | mechanical, hp 700, shield 150, speed 1.9, damage 60 every 2.6 s, range 13, splash radius 2.5 at 0.5, cost 325/150, pop 4, time 34, class `armor`, counter `melee` ×1.5. Ability "Brace": cannot move, +3 range for 8 s, cooldown 45 |
| `pylon` "Shield pylon" | (new) | hp 500, shield 200, radius 1.4, cost 100/50, time 14. Buildings within 10 m gain +50% shield and recharge |

**Veil** (trait `farsight`: +3 vision on every unit and building, −10% damage dealt; AI `evasive`: prefers capture points and undefended targets, retreats a group that is outnumbered 3 to 2 by supply, `minWave` −1, `waveGap` ×0.8)

| Type | Replaces | Numbers |
|---|---|---|
| `shade` "Shade" | Vanguard | hp 100, shield 30, speed 5.6, damage 16 every 0.9 s, range 2, cost 110/25, pop 1, time 12, class `melee`, counter `ranged` ×1.6. **Cloaked** while it has not attacked for 3 s |
| `watcher` "Watcher" | Anti-tank soldier | hp 85, shield 20, speed 4, damage 14 every 1.4 s, range 13, vision 22, cost 125/50, pop 2, time 16, class `antiarmor`, `mechanical_bonus` 3. Ability "Mark": the target takes +25% damage from all sources for 8 s, cooldown 35 |
| `veilrelay` "Veil relay" | (new) | hp 450, radius 1.8, cost 125/75, time 16. Own units within 9 m are cloaked while they have not attacked for 3 s |

**Cloak rule** (`src/sim/vision.js`): a cloaked entity is visible to a team only if one of that team's units is within 4 m, or one of its towers, relays or Command cores is within 9 m. A cloaked unit cannot be targeted by a team that cannot see it; splash still hurts it. The player sees a shimmer on own cloaked units; revealed enemy Shades play a reveal effect. The fog rule in `docs/ARCHITECTURE.md` holds: nothing visual or audible may reveal a hidden unit. Add a fight hint the first time the player is hit by a cloaked unit ("Shades are hidden until they strike. Towers and relays reveal them.").

**Tests.** As in 2.3 for each faction, plus unit tests for cloak visibility, targeting and detection, self-repair timing, road speed, waystation and pylon auras, Mark stacking (does not stack).

## Package 2.5: balance and the counter table

- Extend `tools/skirmish-bench.mjs` to a round robin: each faction's AI against each other faction's AI (AI versus AI, no player; this needs a small option that lets team 0 be AI-driven in headless runs) on three maps, in both seatings, at Normal and Fast. No faction may win more than 60% or fewer than 40% of its matches overall. Tune numbers in `balance.json` only.
- Rewrite `docs/BALANCE.md`: the class counter table, each faction's units, trait and personality, the bench table.
- Update the in-game field guide and the counter hints.

## Package 2.6: put the factions into the game

1. **Skirmish:** the setup screen (`src/app/briefing.js`) gets "Enemy faction": Mirror (today's behaviour, default), Ashfall, Sunward, Wardens, Veil, Mixed. Colours and emblems follow the faction as in missions.
2. **Missions:** turn on `rules.rosters: true` one mission at a time, in order, running `npm run check:missions` after each and retuning that mission's waves and timers until its targets hold. Update each mission's `design` string. Wave data keeps using slots, so most edits are counts.
3. **Story unlocks** (new mission field `rules.unlock: ["rider"]`, resolved into the player's Barracks or Foundry `trains`): Riders from mission 9 (Sol joins); in mission 12 the setup gives the player one Walker and two Riders named in the briefing. Add the lines to `docs/WORLD.md` and both story catalogues.
4. The mission briefing's intel list names the enemy faction's two special units the first time the player meets them.

**Tests.** `npm run check:missions` green for all twelve at Standard, and Story and Veteran per package 1.2. `tests/missions.mjs`, `tests/campaign.mjs`, `tests/factions.mjs`, `tests/layout-f.mjs`. `npm run test:render-budget` on a 3-enemy mixed-faction match at 390x844: frame time within 10% of the mirror match; if not, reduce before shipping.

## Stage 2 exit check

- A greyscale screenshot of each faction's base and army is in `docs/aaa/review/`, and the owner has approved the look.
- Round-robin table inside 40 to 60%.
- All twelve missions on faction rosters, bot targets met.
- First-visit download not larger than at 0.9.4 (measure the bytes fetched before the menu is usable, record in the changelog).
