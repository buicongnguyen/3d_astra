# Frontier Command: AAA round 4 plan, "Wild Frontier"

Date: 2026-11-21. Branch `r4/wild-frontier`, worktree `C:\Users\n\source\repos\3d_astra-r4`, base `feat/aaa-round3`
(`9d0b706`, Wave 2 being integrated; `r3-wave-2` is merged in before the P1 sign-off).

**Owner-approved direction.** New lands where weather and creatures are things a side **captures and uses**, not
passive slowdowns. Every Wild land has exactly one **Weather Spire** (a capture point near the centre: its holder gets
one aimed weather power) and one **Creature Nest** (wild guards; clear them, hold the nest 30 s, and a special creature
joins you). One power, one creature, one ability each: low micro, readable on a phone.

Phase P1 (the desert test on the existing Amber Dunes, no new map art) is built on this branch; its results are in
`docs/aaa/results/round4/p1.md`. Everything after P1 waits for the owner's verdict on P1.

## 0. Why this, and what it should move

| Area (round-3 target) | Lever in this round | Expected lift |
|---|---|---|
| Skirmish and units (7.3) | Two new things worth fighting over on every Wild map (Spire swings, nest raids), a creature per land, weather as a selectable modifier | +0.4 to +0.6 |
| Campaign (7.8) | A few Wild missions per phase (storm at the Spire, escort a Leviathan), each with its own hook | +0.2 |
| Defence (7.4) | One Defence level per phase where the weather and a creature are yours to call | +0.2 |
| Reasons to return | New lands (snow, volcano, water, sky) and creatures to tame; Rank-track unlocks (R3-R) can name them | +0.2 |

A round-4 reviewer should remember: "the sandstorm hid my push", "my Wyrm burst up under their tank", "the tide opened
a landing". Each phase below names its one moment.

## 1. Hard owner rules (apply to every package)

Round 3's section 2 (`docs/aaa/AAA_ROUND3_PLAN.md`) applies in full: worktree and git rules, determinism (idle
fingerprint `d071360b`, the mission checksums in `tests/wings.test.js`, every `tests/golden-*.test.js` pin,
`baselines:diff --full`), append-only shared files, ports, art and definition of done. Repeated and added here:

1. **Never raise difficulty on Relaxed or Normal.** The owner finds two AIs already hard; Fast and Relentless are the
   chosen-challenge speeds.
   - The computer **never** tames or uses weather on Relaxed (no plan entry: `wild_frontier.ai` has no `relaxed` key,
     and `canTame()` refuses a computer side without a plan).
   - Normal uses them **late and rarely** (P1: Spire crew and weather from 600 s, at most one storm per 240 s and only on
     8 or more enemy fighters in one place; the nest from 900 s with 14 or more fighters).
   - Fast and Relentless use them fully.
   - Gate: `npm run check:difficulty` in its 6-map form (`--maps classic,riverlands,dunes,basin,expanse,highlands`; a land rule only acts on its own map, so the Wild map rows are the real test, and on the other five the rule never reaches the match) and
     the new wild-land bench `npm run bench:wild`. No Relaxed or Normal row (1v1, 1v2) may lose more than one bot win
     with a phase's rules on, against the same tree with them off.
2. **Low micro.** One power per land (one button), one ability per creature, the creature's ability autocasts on every
   side (no setting needed, no extra button). Reward control, never require it.
3. **No bunkers or barricades.** Weather and creatures change sight, fire rate and movement; they never add cover objects.
4. **Hazards are warned and usable by both sides.** Every weather power has a visible warning (P1: 3 s, an orange sweep
   on the ground that every side sees, on the minimap too); every creature strike has a telegraph (P1: a 1.5 s ripple).
   Any side can take the Spire and the nest; the rules never favour the player.
5. **Visible, one-tap actions.** The Weather button is always on screen in a Wild match, on desktop and phones, never
   behind a ⋯ or a sheet (owner, 2026-11-21: "no hidden buttons", flat menus). Phones have a one-row command bar
   (`9d0b706`); the Weather button floats outside it so the fixed dock heights never grow.
6. **Phones and PC are both first-class.** Check 1440×900, 390×844 and 844×390: text at least 11 px, taps at least
   44 px, no sideways scroll, command-tile sub-lines at most 10 characters, no `system-ui` in a font stack.
7. **Vivid warm art.** Night means a very dark blue sky (no purple). Desert amber and rust, snow in warm-lit ice blue
   and white with gold light (not grey), volcano in black basalt with orange lava.
8. **Strings.** Every new UI string goes in `src/locales/vi.json` (story text in `story-vi.json`). A Korean
   `src/locales/ko.json` is being added by another agent: every new string will need a `ko` entry too once it lands
   (each phase's results file lists its new strings for that).
9. **Opt-in and pin-safe.** New behaviour sits behind a Battle-rules option whose default stores no key
   (`src/app/rule-options.js`), or behind new content (a new map, mission or level). New sim state is created only when
   content uses it (`sim.wild` exists only in a Wild match; `tests/content-seams.test.js:444` lists the sim keys of a
   normal match exactly). No `Math.random` in sim code.

## 2. The system (shared by every phase)

### 2.1 Data
`src/balance.json` gets one top-level key, `wild_frontier` (P1 already has it):

```json
"wild_frontier": {
  "lands": { "dunes": { "spire": [0, 0], "nest": [-38, -38], "power": "sandstorm", "creature": "wyrm", "guard": "wyrmling" } },
  "spire": { "r": 5, "cooldown": 90, "arm": 15, "warn": 3 },
  "sandstorm": { "radius": 10, "duration": 18, "reload": 1.43, "sight": 4 },
  "nest": { "r": 5.5, "aggro": 8, "tame": 30, "regrow": 150, "guards": 3, "cap": 1, "regen": 0.02 },
  "ai": { "normal": { "spire": 600, "weather": 600, "weather_min": 8, "gap": 240, "nest": 900, "nest_army": 14, "crew": 2, "party": 5 },
          "fast": { ... }, "relentless": { ... } }
}
```

Each later phase appends its land to `lands` (one Spire spot, one nest spot, the power id, the creature and guard
types) and its power's numbers next to `sandstorm` (`blizzard`, `eruption`, `tide`, `jetstream`, `lightning`).
Creature and guard definitions are appended to `definitions` with `"creature": true` (no roster, no cost, never
trained; `tests/progression.test.js` leaves creatures out of the Classic counts and allows them no shield).

### 2.2 Sim (one content module per land family, `src/sim/content/wild-*.js`)
P1's `src/sim/content/wild-frontier.js` is the engine; later lands add their power and creature to it (or to a sibling
module registered after it in `src/sim/content/index.js`).

| Piece | Where it lives | Notes |
|---|---|---|
| Rule | `rules.wild` (`"on"`), read in the `simulation.js` constructor: `if (this.rules?.wild && !mission && field) this.initWild();` | One guarded line. The land comes from the map; `createSim` drops a rule whose `maps` leave out the battlefield (`rulesForMap`). |
| Wild state | `sim.wild = { land, readyAt, owner, storms, nest, stats, ai? }`, created only by `initWild()` | Saved and hashed like any field; absent from every other match. |
| Spire | `spireOf(sim)`: with capture points on, the crossroads ring itself (`wild: "spire"`, `aiCrew: true`), so rings, incomes and computer crews are exactly as without the rule; otherwise a ring of its own, `skirmishPoints.spire`, that `aiPoints` skips and the module crews by plan | Reuses the ring mechanics (`stepPoints`), `capture-view.js`, the minimap and the capture toasts. |
| Wild guards | Units of `WILD_TEAM = -2` (`src/sim/constants.js`), with ids from their own range (1,000,000 up) so every other entity keeps its id | `sim.hostile(team, WILD_TEAM)` is true, `sim.hostile(WILD_TEAM, x)` is false (`simulation.js`), so every side's normal targeting fights them, and the guards act only through the module's step (they bite whatever is within `aggro` of the nest, never leave it, regenerate when idle). `applyDamage` credits no kill to a negative team (`progression.js`). |
| Weather | `castWeather(team, x, z)` (a mixin) and the command `weather` (a content command: logged, replayed, checked against the holder) | Warning `warn` s, then `duration` s. A spire-wide cooldown, and `arm` s for a new holder. |
| Effects | a status (`sandblind`, `reload` factor, `src/sim/effects.js`) renewed every 0.5 s on the holder's enemies inside; a sight mask in `updateVision()` (`if (this.wild) this.wildVision();`, `src/sim/vision.js`) | The mask hides the storm's ground from the holder's enemies except within `sight` m of their own units, so the holder's units inside are hidden and enemies inside see 4 m. Flyers keep their own air sight. |
| Nest | `sim.wild.nest = { x, z, r, state: guarded/open/regrow, guards, taker, since, regrowAt }` | Same side rules as the rings (allied computer sides count as one, a contest pauses). The creature spawns for the taker; the cap is per side. |
| Creature | a normal unit of the taker's side, its ability a content ability, cast by the module's step for every side | P1 Ambush: dive (hidden, `e.burrow`), 1.5 s ripple at the target's spot, burst. The `fight` hook keeps a diving creature from biting. |
| AI | one AI rule (H19) per module, by `wild_frontier.ai[sim.aiSpeed]` | Spire crew (`pointDuty: "spire"`), a nest party (`pointDuty: "nest"`), and weather on the densest group of seen enemy fighters. |

Determinism: every decision runs on `sim.ticks % 10` (0.5 s), in entity order, with no random numbers. A save
mid-storm or mid-dive reloads to the same hash (`tests/wild-frontier.test.js`, `tests/golden-r4p1.test.js`).

### 2.3 View and performance budget (lightweight-game-objects, smooth-dense-scenes)
- One view plugin per phase (`src/wild-view.js` for P1, registered last in `src/view-plugins.js`). Nothing is built
  until `sim.wild` exists.
- Budget per Wild match, measured with `tests/render-budget.mjs` against a twin scene on the same map with the rule off:
  **at most +4 draws** for the land's own pieces (Spire, nest, weather), on Eco phones. A creature on screen costs its
  model's material batches like any new unit type (P1 Wyrm: 5 materials, 6 batches).
- Weather is drawn with procedural shaders on shared geometry: no textures, no per-frame buffer uploads (uniforms
  only), a single open cylinder for a wall of sand or snow (front faces only on Eco, so about 1x overdraw on phones),
  one ground disc for warnings and haze. Particles come from the existing pooled `fx` layers (`dust`, `shockwave`).
- Rain, snow and ash for the "weather on any map" modifier reuse R3-D's `night-sky.js` streak field (one draw, moved
  in the vertex shader) with a new colour and fall speed per weather, not a new particle system.
- New props (a Spire per land, nest dressing) are merged meshes with baked vertex colour: one draw each.
- Motion off (reduced motion, or the governor's motion level 0) holds every shader still and drops flashes.

### 2.4 Interface
- The Battle-rules row (`src/app/rule-options.js`, append): "Wild frontier: Off / On" in P1. An option may list `maps`;
  the setup greys the row out on any other battlefield (`app/briefing.js syncRules`, `.rule-off-map`).
- **The Weather button** (`src/app/wild-ui.js`, `src/wild-ui.css`): one button, always on screen in a Wild match. It
  floats in the first free corner (bottom right on desktop, just above the dock on portrait phones, under the tool row
  on landscape phones), never over the dock, the top bar, the tool row, the minimap or the objectives (checked by
  `tests/wild-desert.mjs`). States: "Take Spire" (a tap pans to the Spire and says how), the seconds left ("47 s") while arming or recharging,
  "Ready" (glowing). Ready: one tap starts the aim, one tap on the map (or the minimap) calls it. Esc or Cancel stops.
  48 px tall, text 12 to 15 px.
- Messages: the warning is a sim message to the player for both sides ("Enemy sandstorm incoming: it lands in 3
  seconds."), the capture toasts are the existing ring toasts.
- Field guide: every creature page gets a "Wild frontier" section from the live numbers (`src/field-guide.js`).
- Hotkey: none in P1 (every letter is taken: WASD pan, QERTY actions, G grid). P2 may claim one if the owner wants it.

### 2.5 Art pipeline
- Creatures and guards: `tools/blender/generate_<creature>.py` on `frontier_kit.py`, run headless with the portable
  Blender (`--background --python ... -- --manifest`). Budgets from `docs/ASSET_PIPELINE.md`: a creature at most as many
  materials as the Vanguard (6), triangles at or under its nearest unit (P1 Wyrm 3,124 of 3,200; Wyrmling 2,442 of
  2,600). Non-mechanical creatures carry `leg_L`/`leg_R` pivots (the gait swings them). `Team` paint on a harness or
  crest so the tamer's colour reads from above; the wild guards get a sand tint at runtime (`WildPaint`).
- Portrait cells: appended before the reserved last cell (`ironsovereign2`) in `PORTRAIT_ORDER` and
  `render_ui_art.py PORTRAITS`, then `render_ui_art.py -- portraits` re-renders the atlas (about a minute).
- Terrain palettes for new lands: a theme per map id in `src/visual-style.json` `themes`, a biome in `terrain.js at()`,
  scatter in `src/scatter.js`, ambient life in `src/ambient-life.js`, a map-edge tint. Painted cover and props for snow
  and volcano: Codex (built-in image generation) from the prompts in section 7, chosen by the owner.
- Every changed manifest entry is marked `review: "pending owner review (round 4)"`.

## 3. Phases

The order is fixed: **P1 → owner verdict → P2 → P3 → P4**, with one dependency the review found (Appendix A, 1):
Cinder Reach's multi-band lava, Tidewater and Skyreach all need the S9 map engine (P3a). P2 therefore ships Cinder
Reach v1 on today's one-band river layout (reskinned as a lava river with its bridges and ford), and P3a moves ahead of
any multi-band land. Each later phase adds Skirmish maps, a few campaign
missions and one Defence level, and has its own results file and CI matrix entry (`r4-p<n>`).

### P1: the desert test (built; see `docs/aaa/results/round4/p1.md`)
- **The moment:** "the sandstorm hid my push and their towers went half-blind" and "my Wyrm burst up under their tank".
- **Map:** the existing Amber Dunes; no new map art. Spire on the crossroads `(0, 0)`. Nest in the south-west corner
  `(-38, -38)`, on the line equidistant from both camps (74 and 75 m), 14 m from the corner deposits so guards never
  bite harvesters there. With three rivals the corner is the third camp: no nest in that match.
- **Power:** Sandstorm (radius 10 m, 3 s warning, 18 s, cooldown 90 s, arming 15 s): enemies inside fire 30% slower
  (`reload` ×1.43) and see 4 m; the holder's units inside are hidden.
- **Creature:** Dune Wyrm (640 HP, a 26-damage bite ×1.4 on the armour class: Tank, Walker, Rampart; pop 3, cap 1 per side). Ambush (cooldown 26 s):
  dive, 1.5 s ripple at the nearest enemy vehicle within 22 m, burst for 150 within 3 m (half on buildings). A vehicle
  that moves off dodges it. Guards: three Wyrmlings (240 HP, 13 bite), aggro 8 m, regrow 150 s after a taming.
- **Files:** `src/sim/content/wild-frontier.js` (new), `src/wild-view.js` (new), `src/app/wild-ui.js` (new),
  `src/wild-ui.css` (new), `tools/blender/generate_wyrm.py` (new), `tools/wild-bench.mjs` (new),
  `tests/wild-frontier.test.js`, `tests/golden-r4p1.test.js`, `tests/wild-desert.mjs` (new); one guarded line each in
  `simulation.js` (constructor, `hostile`), `sim/vision.js`, `sim/points.js`, `progression.js`; append-only in
  `balance.json`, `visual-style.json`, `vi.json`, `rule-options.js`, `view-plugins.js`, `sim/content/index.js`,
  `render-budget.mjs`, `pages.yml`, `package.json`, `manifest.json`; the rule row's map check in `app/briefing.js`;
  the mode hooks in `app/input-pointer.js`, `app/minimap.js`, `app/frame.js`, `main.js`; portrait order in
  `portraits.js` and `render_ui_art.py`.
- **Acceptance:** every existing pin identical (P1 moves none); `npm test` green; `tests/wild-desert.mjs` green at three
  viewports; render budget: the Wild pieces at most +4 draws over the twin; `bench:wild` and `check:difficulty`:
  Relaxed and Normal not harder with the rule on; fun signals measured (Spire flips, storms, tamings, match length).

### P2: weather on any map, then Snow and Volcano
- **The moments:** "a blizzard froze their shields mid-fight" (Snow), "the eruption opened a gap in their line, and my
  Salamander's trail kept them out of it" (Volcano), and "I can play Classic in a thunderstorm".
- **P2a, weather as a modifier for any map** (no Spire, no nest): a new Battle rule `weather` with Off / Sandstorm /
  Blizzard / Ash fall / Thunderstorm. It maps internally to the look system (`src/mission-looks.js` `LOOKS`,
  `night-sky.js` streaks, `look-grade.json`, `ambience.js` storm bed); the existing `rules.look` stays a test hook with
  its own ids (night/storm/dusk). On a Wild land the weather row greys out (the land has its own weather). Small sim
  effects that apply to every side alike:
  - Sandstorm: sight −3 m for ground units (a vision factor in `updateVision`, one guarded line).
  - Blizzard: a new status kind `noShieldRegen` (read in `stepEntity` behind `e.fx`; `shieldRate` is rewritten by the
    Sunward and Wardens traits every few ticks, so it cannot carry weather), speed ×0.95.
  - Ash fall: vision −2 m, nothing else.
  - Thunderstorm: R3-D's storm look; lightning is cosmetic (no damage: "the tallest building" would hit whichever side
    builds taller).
  Same effects on every side are **not** the same for every faction (sight hurts short-range and tower-reliant play
  more), so P2a takes the full gate: the 6-map difficulty check with each weather value, all speeds. Snow falls as point
  flakes in the same single streak draw (streaks would read as rain).
- **P2b, Snow land "Frostreach"** (new map, 160 m, two plateaus, frozen lake as a ford with `ford_speed`):
  - Spire: **Blizzard** (radius 11 m, 3 s warning, 16 s): enemies inside "ice up": two statuses picked by weapon
    `interval` (`iced` reload ×2 for weapons slower than 1.5 s, `chilled` ×1.3 for the rest; statuses carry flat factors
    only, `sim/effects.js:51`), plus `noShieldRegen`; the holder's units inside move 10% faster.
  - Nest: **Frost Mammoth** (900 HP, slow, pop 4). **Stampede** (autocast when 4 or more enemy infantry are within 9 m
    in front of it): a 2 s charge in a straight line with a 1.2 s frost trail warning on the ground; infantry in its path
    take 60 and are knocked 3 m aside; vehicles block it (it stops). Guards: two Frost calves.
  - Land weapon: **Cryo Lance** crystals (a capturable crystal pair near each side's natural expansion: hold one to arm
    a one-shot lance on your Sentinel towers, +50% damage on the next hit against a vehicle; no button, it fires on its
    own). The crystals are `wild` rings (no `aiPoints` crew), and a computer side's lance arms only through its
    `wildPlan()` (never on Relaxed, late on Normal); they are part of the gate.
- **P2c, Volcano land "Cinder Reach"** (new map, 176 m, lava rivers as impassable bands with two bridges and a ford):
  - Spire: **Eruption** (aimed, 4 s warning: six warned lava bombs land in a 12 m circle over 3 s, 70 each, burning
    ground 6 s; both sides see every bomb's ring).
  - Nest: **Magma Salamander** (520 HP, fast, pop 3). **Ember trail** (autocast while moving into a fight): it leaves a
    6 s burning trail as status zones (`sim.zones`, the Burn line mechanics in `sim/tactics.js`): every enemy unit in it
    burns and slows, whoever owns them. No nav cost (navigation has only a binary `blocked` grid, and an AI-only
    avoidance would break rule 4). Guards: three Cinderlings.
  - Land feature: **vents** (four, mirrored, `wild` rings so `aiPoints` never crews them): a Harvester on a vent mines
    energy at 1.5×, and an Eruption on a vent makes it erupt for 30 s (no mining). A computer side gets the vent bonus
    only through its `wildPlan()` (none on Relaxed, from its weather time on Normal), and the vents are part of the gate.
  - Eruption's six bomb spots are a fixed pattern rotated by `sim.ticks` (no `Math.random`); ties in targeting by id.
- **Files (P2):** `src/sim/content/wild-snow.js`, `wild-volcano.js` (or one `wild-lands.js`), `src/maps.json` (append two
  maps), `src/terrain.js` (biomes `snow`, `volcano` in `at()`, lava bands as `blocked` cells like the river),
  `src/visual-style.json` themes `frostreach`, `cinder`; `src/scatter.js`, `src/ambient-life.js` (snow hares, ash motes,
  embers), `src/map-edge.js` tints; `tools/blender/generate_mammoth.py`, `generate_salamander.py`; Spire props in the
  view plugin; `src/app/rule-options.js` (weather row); missions `src/story/wild-missions.js` (own file, one import and
  one array entry in `missions.js`, as R3-H did); a Defence level appended to `src/defence/levels.js`.
- **Content:** Skirmish maps Frostreach and Cinder Reach; campaign side missions "White Out" (hold the Spire through
  three blizzards) and "Ash Road" (escort a convoy past eruption fields); Defence level "Glacier Gate" (the player holds
  the Spire: one Blizzard per wave, a tamed Mammoth on the road).
- **AI (P2):** the same rule shape; Relaxed none, Normal late and rare, Fast and Relentless full. Eruption is aimed at the
  densest seen enemy group outside the AI's own units' 8 m; Blizzard at an enemy group that is fighting its units.
- **Perf (P2):** snow fall and ash fall are the R3-D streak field recoloured (one draw); a blizzard wall is the P1 wall
  shader with a white-blue colour; lava is a scrolling emissive band in the ground shader (no new draw); vents are one
  instanced mesh. Budget: +4 draws over each map's twin; the two new maps' base scenes at or under Highlands' limits.
- **Acceptance (P2):** P1's list for each land; the 6-map difficulty check with each weather value; `bench:wild` on both
  new maps; three-viewport suites `tests/wild-snow.mjs`, `tests/wild-volcano.mjs`; mission checks win on Story,
  Standard and Veteran; `check:defence` for the new level only.
- **Risks:** lava bands are a new terrain kind (nav and vision tests); a second Wild map doubles the bench time (run on
  2 cores with `--jobs 3`); the snow palette must stay warm (owner: vivid, not grey).

### P3: Water (map engine first, then the Leviathan, then ships)
- **The moment:** "low tide opened a landing, and my Leviathan carried my squad across while it fought".
- **P3a, the S9 map engine** (from round 2: `terrain.js`, the `simulation.js` constructor, the river code in `view.js`
  and `environment-view.js`): a land/sea mask with shallows and sandbars in place of the hard-coded river rectangles,
  byte-identical for the seven existing maps (their golden pins prove it). Nothing else ships until it does.
- **P3b, Water land "Tidewater"** (192 to 224 m, owner decision O18 in round 2; two coasts and three islands as in
  `docs/naval/NAVAL_PLAN.md`):
  - Spire: **Tide** (not aimed; one tap toggles the tide after a 5 s warning; 60 s cooldown). High tide floods the
    sandbars (ground units cannot cross; units on a sandbar when it floods walk off to the nearest shore); low tide opens
    two landings to the middle island. The minimap and the ground paint show the next state during the warning.
  - Nest: **Leviathan** (a living ferry: 1,400 HP, swims shallows and deep water, carries up to 6 infantry, bites
    boats and shore units within 4 m). Its one ability, **Ferry**, is a tile in the infantry command row while a friendly
    Leviathan lives: one tap on the tile, one tap on the island's beach (tapping the Leviathan itself would select it on
    touch). This is "naval before full ships": it needs water pathing (new pathfinder work: flyers fly straight in
    `sim/air.js`, there is no air grid to copy) but no Port.
  - The tide changes walkable cells: its state is saved with the match and re-applied in `snapshot.restore` before
    `nav.rebuild`, through the same kind of hook as `applyCrossings`.
- **P3c, ships per NAVAL_PLAN Phase A** (Port, Gunboat, Transport/Ferry, island sites), only after P3b's verdict.
- **Files (P3):** `src/terrain.js` (mask), `src/navigation.js` (a water grid like the air layer), `src/sim/naval.js` (new,
  carry and unload, reusing the M1 cargo of round 2 if it has landed), `src/sim/content/wild-water.js`, the map in
  `maps.json`, the view's water and shore paint, `tools/blender/generate_leviathan.py`.
- **AI (P3):** Fast and Relentless ferry a squad to the middle island at low tide; Normal only defends its own coast; Relaxed
  never uses the tide or the Leviathan.
- **Acceptance (P3):** P3a: every existing pin, baseline and mission checksum identical with the new engine. P3b: ships
  and the Leviathan never enter land, ground units never enter deep water, loading keeps the unit count, each island is
  reachable only by water or at low tide, phone draw budget on the sea map.
- **Risks:** the map engine is the riskiest change of the round (it touches every map); keep it its own package with a
  byte-identity gate before any water content.

### P4: Sky islands
- **The moment:** "the jet stream carried my Hawks across while theirs were blown back, and my Cloud Ray dragged their
  gunships down into my anti-air".
- **Land "Skyreach"**: islands on a cloud sea (the void is the map edge; bridges and ramps join the islands; flyers rule).
  - Spire: **Jet stream** (aimed lane 40 × 8 m, 3 s warning, 15 s): the holder's flyers in the lane fly 40% faster;
    enemy flyers in it are pushed 1.5 m/s along it.
  - Nest: **Cloud Ray** (a flying creature, 700 HP). **Downdraft** (autocast when 2 or more enemy flyers are within 10 m):
    pulls enemy flyers 4 m down and toward it for 2 s, within reach of ground anti-air (a 1 s warning swirl).
- **AI air:** computer sides field at most 2 armed flyers (`air.ai_cap`, `sim/air.js airCap`), so a land where flyers
  rule needs a per-land AI air cap, given only to Fast and Relentless and benched, or it leans to the player.
- **Any land: Lightning storm + Storm Moth swarm** (a P4 "wild weather"; it replaces the land's power through a
  pre-match rule value, for example "Wild frontier: Off / On / Storm", never a second button or a picker in the match): Lightning (aimed, 3 strikes on warned rings) and the Storm Moth swarm (a creature
  that reveals cloaked or storm-hidden enemies within 8 m: the counter to Veil Shades and to an enemy sandstorm).
- **Land weapons (P2 to P4):** Cryo Lance (snow crystals), **Mirror Array** (desert glass: on a Dunes v2 map, a
  capturable array that blinds enemy towers in a 12 m cone for 6 s every 60 s, warned), vent energy (volcano).
- **Files (P4):** `src/sim/air.js` (a lane force, one guarded call), `src/sim/content/wild-sky.js`, the map,
  `tools/blender/generate_cloudray.py`, sky-island scatter and edge.
- **Acceptance (P4):** as P1 for the new land; flyer-heavy bench (`tools/faction-bench.mjs` with air) not harder on
  Normal; render budget with 16 flyers and the jet stream lane.

## 4. Tests and tools (every phase)
| What | Where | Gate |
|---|---|---|
| Rules (opt-in, power, area, cooldown, arming, nest, cap, creature ability, AI by speed, save and reload) | `tests/wild-<land>.test.js` | `npm test` |
| Golden pin for the new content only | `tests/golden-r4p<n>.test.js` | every other pin identical |
| Browser (rule row, one-tap button at three viewports, aim and call, creature, minimap, no page error) | `tests/wild-<land>.mjs`, CI `r4-p<n>` | `test:ci-local` |
| Draws | `tests/render-budget.mjs` twin + Wild scenes | Wild pieces ≤ +4 |
| Difficulty | `npm run check:difficulty` (6 maps) with and without the rule; `npm run bench:wild` | Relaxed and Normal not harder |
| Fun signals | `tools/wild-bench.mjs` (Spire flips, storms per side, tamings, match length; bot ignoring and using the land) | reported, compared phase to phase |

## 5. Score impact (estimate)
| Phase | Skirmish | Campaign | Defence | Overall |
|---|---|---|---|---|
| P1 (desert test) | +0.2 | 0 | 0 | +0.1 |
| P2 (weather on any map, snow, volcano) | +0.3 | +0.1 | +0.1 | +0.2 |
| P3 (water) | +0.2 | +0.1 | +0.1 | +0.1 |
| P4 (sky) | +0.1 | 0 | 0 | +0.1 |
| Round 4 total | 7.3 → ~8.1 | 7.8 → ~8.0 | 7.4 → ~7.6 | 7.5 → ~8.0 |

## 6. Owner decisions (defaults taken; change any)
| # | Decision | Default |
|---|---|---|
| D1 | P1 verdict: keep, tune or drop the desert test | waiting |
| D2 | Wyrm cap 1 per side on Dunes (plan said 1 to 2) | 1; 2 on maps of 176 m or more |
| D3 | With capture points on, the crossroads ring is the Spire (same ring, income and computer crews; a Relaxed rival may hold it but never calls a storm) | yes |
| D4 | The Weather button has no hotkey (every letter is taken) | none |
| D5 | P2 "weather on any map": symmetric effects only, no Spire on non-Wild maps | yes |
| D6 | Lightning + Storm Moth: a pre-match rule value that replaces a land's power, or a land of its own | rule value |
| D9 | P1 nest corner (-38, -38) is 14 m from Meridian-side corner deposits (team 0's far expansion); keep, or move to a spot equally far from both sides' expansions | keep for the test |
| D7 | Water map size (round-2 O18) | 192 to 224 m |
| D8 | Art: Codex paints snow and volcano cover and palettes from section 7's prompts; the owner picks | yes |

## 7. Ready-to-send Codex prompts (P2 art)

**Snow palette and props (Frostreach).**
> Paint a set of game-art reference swatches and three prop sheets for a stylized top-down RTS map called "Frostreach",
> in the same flat, warm, readable style as a mobile strategy game seen from a 46° camera. Palette: snow white #f4f6ff
> with warm gold sunlight highlights #ffe2a8, ice blue #8fd8ff and deep glacier blue #2f6fb0 in shadows, pine green
> #2f7a5a, rock warm grey-brown #8a7a70, a frozen lake in teal #4fc8d8 with white cracks. Never grey or muddy: the
> scene is lit by a low golden sun. Sheet 1: ground tiles (fresh snow, packed snow road, ice, rock, frozen lake edge)
> as 512 px squares, seamless. Sheet 2: props seen from above at 46°: snow-capped pines (three sizes), ice crystals
> (blue, glowing faintly), a frozen supply crate, a broken signal mast with icicles, snow drifts. Sheet 3: the Weather
> Spire of the snow land: a tall pale-blue ice obelisk on a stone plinth with a gold crystal on top and four leaning
> ice shards around it. No text, no logos, no people. Transparent background for the props.

**Volcano palette and props (Cinder Reach).**
> Paint a set of game-art reference swatches and three prop sheets for a stylized top-down RTS map called "Cinder
> Reach", same style and camera as above. Palette: black-blue basalt #1c1f2a and warm charcoal #3a2a26 ground, glowing
> lava orange #ff7a1f to yellow #ffd04a in cracks and rivers, ash grey-violet is NOT allowed (keep shadows warm brown
> #4a2a1c or deep blue #101a30), obsidian glass #2a1e3a with orange rim light, sulphur yellow #e8d040 accents. Sheet 1:
> ground tiles (cooled basalt, cracked basalt with lava glow, ash dune, obsidian road, lava river edge) as seamless 512 px
> squares. Sheet 2: props from above at 46°: basalt columns, obsidian spikes, a steaming vent with a stone ring, charred
> dead trees, a crashed ore cart. Sheet 3: the Weather Spire of the volcano land: a basalt pillar with lava seams and
> an orange crystal on top, four broken obsidian slabs around it. No text, no logos, no people. Transparent background
> for the props.

**Cover art (both lands, one each).**
> Paint a 2560×1440 key-art cover for "Frontier Command: Wild Frontier – <Frostreach | Cinder Reach>": a sweeping
> view over the land with the Weather Spire in the middle distance, a small expedition force (sand-coloured tanks and
> infantry with teal lights) advancing, and the land's creature (a Frost Mammoth | a Magma Salamander) in the
> foreground half in shadow. Warm, vivid, cinematic light; night scenes use a very dark blue sky, never purple. Leave
> the left third calm for the title. No text.

## Appendix A: corrections from the independent review

One fresh reviewer read the draft against the code (feasibility, determinism, difficulty, phones). Every point was
taken; P1 bugs were fixed in code on this branch.

| # | Severity | Finding | Where it went |
|---|---|---|---|
| 1 | High | Rivers are one hard-coded band (`terrain.js`); multi-band lava, sea and sky islands need the S9 engine first | Section 3 order note; Cinder Reach v1 on the one-band layout |
| 2 | High | The Salamander trail as an AI-only nav cost: the nav grid is binary, and it would favour the player | P2c: symmetric burn and slow zones |
| 3 | High | Land weapons (Cryo Lance, vents, Mirror Array) are passive buffs the AI gets by standing there; `aiPoints` would crew them on Relaxed | P2b/P2c: `wild` rings, armed for the computer only through `wildPlan()`, in the gate |
| 4 | High (P1 bug) | With Wild "On" and another battlefield, `createSim` still passed `rules: { wild: "on" }` (save options and hash changed) | Fixed: `rulesForMap` in `app/rules-store.js`, used by `createSim` and the preview; tests in `wild-frontier.test.js` and `rules-hook.test.js` |
| 5 | Medium | P2a "fair by construction" was wrong: `shieldRate` is rewritten by traits; statuses carry flat factors only; "tallest building" lightning favours one side; less sight hurts factions unequally | P2a/P2b rewritten (`noShieldRegen`, two statuses, cosmetic lightning, full gate) |
| 6 | Medium | `rules.look` is a visual test hook (night/storm/dusk), not the weather rule | P2a: a new `weather` rule; snow as point flakes |
| 7 | Medium | Computer flyers are capped at 2 armed; a "second power choice" means two buttons | P4: a per-land AI air cap for Fast/Relentless; D6 as a pre-match rule value |
| 8 | Medium | No air grid to copy for water; a tide flip must be restored before `nav.rebuild`; tapping a Leviathan selects it on touch | P3: water pathing sized as new work; restore hook; a Ferry tile |
| 9 | Medium (P1 bug) | Guards could rank up (`earnsRanks` had no team check); `aiJoinFight` and `observeEnemies` counted guards | Fixed: `e.team >= 0` in `sim/tactics.js`, `sim/ai-attack.js`, `sim/ai-counter.js`; test added |
| 10 | Medium | With capture points on, the Spire replaces the crossroads and `aiPoints` skips it, so Relaxed and early Normal give up the centre income (easier, not harder); the warning "expect a sandstorm" was false on Relaxed | Noted in P1 results; the message now depends on the plan; `bench:wild --no-points` added to the gate list |
| 11 | Medium | The nest corner is 14 m from team 0's far corner deposits (team 1's pair is far away), so Normal's late nest party walks past the player's expansion | D9 owner decision; side-swapped bench row in P2 |
| 12 | Low | Bite ×1.4 is a class counter (armour only); a per-land cap needs a per-land key; P2 adds no `rules.wild` values; the 6-map check re-runs maps where the rule does nothing | Fixed in the text |
| 13 | Low | Button label is "N s"; names are hard-coded for the desert; `place()` read layout every 0.15 s; `#mode-controls` not avoided | Text fixed; P2 takes names from `WILD.lands`; placement cached (once a second or on resize) and the Cancel controls avoided |
| 14 | Low | P1 is the first module with a `step`, so `contentStep` and the wild `fight`/`autocast` hooks now run in every match (no pin moves); Eruption needs a fixed bomb pattern | Noted; P2c fixed pattern |
| 15 | High (found by the P1 bench) | Two pin-safe changes still made Relaxed/Normal 1v2 swing on Dunes: (a) guards took ids from the shared counter, and shifting every later id by 3 alone reshuffles knife-edge matches (proved: `nextId += 3` with nothing else gives the same results as the rule); (b) replacing the crossroads ring changed every rival's opening ring crews | Fixed in P1: guard ids from their own range (`wild.guardId`); the crossroads ring itself is the Spire. Rule for every phase: a land rule must leave the opening (ids, rings, crews) byte-identical until a power or creature is used |