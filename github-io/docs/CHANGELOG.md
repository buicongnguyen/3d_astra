# Changelog

## Unreleased: AAA round 3

### R3-F: Warm kit and distinct silhouettes (art 1)
- **Warm palette.** The near-black gunmetal armour that covered about 60% of every model is now a glossy warm sand. Tracks, boots and joints stay a warm dark umber, the infantry suit is a warm taupe, and foundations are warm concrete. Team paint is unchanged. On the 13 core models the armour got about 3.8 times brighter, and the share of near-black armour pixels fell from 57% to 24%.
- **Shared infantry you can tell apart on a phone:**
  - the Medic is white, with a red-cross pack and helmet;
  - the Worker is bright yellow, with a crystal cargo frame;
  - the Engineer wears an orange hard hat and carries an A-frame tool rig with a crane hook;
  - the Ranger has a green hood and cape and a long scoped rifle.
- **Faction identity that survives any player colour.**
  - Each faction's own models wear a faction paint: Ashfall rust, Sunward canvas cream, Wardens ice white and Veil mauve.
  - Each faction also gains one accent:
    - Ashfall: spikes and exhausts;
    - Sunward: sails and fins (the Rider's parasol is now a mast and sail);
    - Wardens: tower shields and crests;
    - Veil: hoods and long cloaks;
    - Meridian: antennas and shoulder plates.
- **Lit windows.** The windows on the HQ, Barracks, Foundry and Veil relay are a new warm emissive `Window` material. They follow the `Window*` name contract with R3-D's night looks.
- **Cost.** No model gained a draw.
  - The render-budget scenarios show 1–2 fewer draw calls: the Ranger's glass lens became a team light.
  - Triangle counts stay within budget. The Drone and the bosses are unchanged (R3-J).
- Every changed model is flagged "pending owner review (round 3)" in `public/models/manifest.json`. See `docs/aaa/results/round3/f.md`.

### R3-D: Night and storm looks
- **Night is very dark blue, not purple.** A per-look grade (`look-grade.json` `looks.night`: blue-black shadows, saturation 0.86) and a cooler moonlit ambient replace the warm shadow lift that turned red ground purple. The map edge and the void below it turn black-blue at night (`map-edge.js` `tintEdge`; it was the hard orange edge), and the warm rim light turns moonlit. m08 frame average red minus blue: +40.8 before, -39.5 after; luminance 5.6%.
- **Moon and stars** (`src/night-sky.js`): a moon disc with a soft halo behind the battlefield (it shows over the void) and stars scattered over the void. One draw each.
- **m06 storm from the start.** The look table (not the mission) builds the storm from 0.35 to 0.75 over the first 90 s and breaks it in full at 16:00, when Vale's surge storm is due. Storms get slanting rain (one draw, animated on the GPU), a drifting cloud shade on High (one draw) and distance fog closing in. Lightning stays on the deterministic `flashAt`.
- **Glows:** team glows, energy and crystals were already boosted at night; lit windows and lamps now are too, through a name contract (emissive materials named `Window*` or `Lamp*`).
- **Storm sound bed** (`ambience.js`): rain hiss, wind rumble and a thunder swell after each strike, built only on the first storm frame, silent when muted, with ambience off or paused.
- Motion-off (reduced motion or the motion setting at 0) turns the lightning off and holds rain, stars and clouds still. Draws: +2 over the same map by day (+1 for a storm on Eco). View only: every pin and baseline is identical.
- Tests: `tests/night-sky.test.js` (+6), browser suite `tests/night-storm.mjs` (CI group `r3-d`), render-budget `night-base-high`, `storm-base-high`, `storm-battle-eco`. Results: `docs/aaa/results/round3/d.md`.

### R3-E: Defence onboarding and readability
- **Guided first build.** On a profile with no Defence win, three coach steps point at the real elements: a ring on the glowing pad (the ground or rim pad nearest the road; the camera opens on it), then on a crew tile (or the Actions tab on a phone), then on Call wave. Each step follows the match, so stepping back shows too. Skippable; stored as `guided: true` in `frontier-defence-v1` (`src/defence/progress.js`, written only once done), so it shows once. The empty card's "Crew the pads" hint becomes the guide's while it runs. Off under `?test` unless the URL has `?guide`. New `src/app/defence/guide.js`.
- **Crew badges.** A small plate over every crewed tower: the crew's glyph and its tier pips (bronze 1, steel 2, gold 3; a gold double rim and white pips for branch ranks), 30 px on screen at any zoom. One InstancedMesh of camera-facing quads on one canvas atlas: 1 draw.
- **Contrast discs.** A dark disc with a team-coloured rim (cyan for yours, red for the waves) under every Defence unit, so units read on orange ground. One InstancedMesh, 1 draw; matrices are written straight into the buffer only when a unit moved (no compose, no upload while still). Both live in the new view plugin `src/defence-readability-view.js` (registered last), which builds nothing outside a Defence match.
- **Landscape dock.** In Defence on a landscape phone the Selection / Actions panel is 184 px (21.8% of an 844 px view, was 236 px = 28%) and a 44 px button on top of it collapses it to that one button; a new pick opens it again (`src/app/defence/dock.js`, the Defence block at the end of `src/landscape-hud.css`).
- **Next star.** A level's result names one concrete next-star hint: the lives needed for the next star (or all the waves on a loss), then one tip from the match: the wave that cost the most lives with the crews that counter its toughest unit, else a gold tier, a rim pad or the call-early rule. Three stars point at Heroic, then Veteran.
- Pins, baselines and `check:defence` unchanged (interface only). Render budget: `defence-wave-eco` 109 to 111 draws, `defence-big-eco` 91 to 93. Tests: `tests/defence-onboarding.test.js` (+5) and the browser suite `tests/defence-onboarding.mjs` (CI matrix `r3-e`).

### R3-B: Squad orders

- **Group pace.** Move or attack-move two or more units and they keep together: fighters walk in front (the toughest first), ranged units behind them, and Medics, Engineers and other support units about 3.5 m behind the fighters, all at the slowest fighter's speed. A unit that falls more than 12 m behind catches up at its own speed, and units in a fight move at their own speed. Support units standing ahead of the fighters step aside first so the tanks pass them. Settings > Army > Group pace (on by default) turns it off.
- **Support units keep company.** When a group arrives, each Medic or Engineer follows the nearest fighter it can tend (a Support order), so it keeps healing or repairing.
- **Follow tether.** A selected Medic or Engineer on a Support order shows a dashed team-colour line to the unit it follows, a heart or wrench over that unit, and "Following <name>" on its card.
- **Control groups on phones: not shipped.** Owner decision (2026-11-21): phones show no group-control buttons; the group strip stays hidden on the compact UI as before. The PC console tabs and the Ctrl/number hotkeys are unchanged.
- **High-ground hint.** The first building you place on a plateau says "High ground: +2 m range, +20% damage".
- No pin or baseline moved: the group-pace flag is sent only by the player's own orders, never by the AI, bots or tests.

### R3-C: Army depth (Barracks level 3, Combined squads, army size)

Plan: docs/aaa/AAA_ROUND3_PLAN.md, R3-C. Results: docs/aaa/results/round3/c.md.

- **Veteran intake (Expanded roster).** Fighting recruits from a Barracks you raised to level 3 arrive at rank 1: +8% damage and health and the gold chevron, as if they had their first kills. Medics arrive as they are. No research (owner decision O4). The computer's Barracks do not get it, so every Expanded pin and bench stays as it was (see the results file).
- **Combined armour squads (Frontier Defence).** After its Assault or Bulwark branch a squad can buy "Combined" for 320 alloy: it adds the other branch (Assault's guns and Bulwark's armour and mending) and holds within the default 9 m leash (O3). A refit keeps it; the tanks carry `combined` for the gold trim (R3-K). The Defence bot never buys it, so Defence balance and `check:defence` are unchanged.
- **Army size (skirmish Battle rules).** "Army size: 100 / 150 / 200", default 100 (no rule key, so every match without it is unchanged). 200 is offered on the desktop only; a touch device shows 100 and 150 (O2). Both the player and the AI stop at the chosen cap; the AI builds relays up to it.
- **Tests.** `tests/army-depth.test.js` (9), `tests/golden-r3c.test.js` (5 pins, one long), browser suite `npm run test:army-depth` (CI entry `r3-c`), render-budget scenario `battle-200` (desktop, 200 units, limit 260 draws).

### R3-A: Field command fields its army

Everything below applies only under the skirmish rule `aiPlan: "field"` (`fieldPlan()`: a computer team, never a mission). Classic, missions and Defence are unchanged.
- **Army census** (new `src/sim/ai-census.js`, data `balance.json` `ai_mix`): every think the AI counts its army by role (front, ranged, heavy, anti-armour, support, workshop, air) and the Barracks and Foundry train toward the biggest shortfall of the faction's target mix. The enemy census raises the targets: anti-armour against vehicles, ranged against an infantry swarm, heavy guns against towers, a floor of anti-air units against flyers. A Wardens Barracks no longer asks for the Medic it cannot train, so it fields Anti-tank teams.
- **Workshops**: under the Expanded roster each host keeps at least one workshop unit (the Veil relay now trains a Stalker before 600 s), and the Barracks saves alloy for it.
- **Fights**: from 8 minutes, free fighters within 18 m of a visible enemy fighter join the fight.
- **Difficulty guard** (Wave 1b, owner 2026-11-21: "don't make it too hard"): the census, join-fight and Kite scouting start at 8 minutes (`ai_mix.from` 480, as the stall breaker), so the opening plays as before; the larger crew and later tech (`FIELD_PACE`) and the "no capture ring while an enemy army is in sight" rule were removed; at Relaxed the Field AI plays exactly as before. The test bot wins as often as on `r3-base` or more at every speed, against one rival and two (`npm run check:difficulty`, `docs/aaa/results/round3/difficulty.md`).
- **S7 stall breaker**: from 8 minutes, after 4 minutes with no contact, the free army attack-moves on the nearest enemy building seen. **Scouting**: an idle Kite flies the `scoutDestination` search pattern.
- New check `npm run test:ai-census-check` (`tools/ai-census-check.mjs`, CI matrix `r3-a`). Results: docs/aaa/results/round3/a.md.

### R3-W: Wings and rockets (owner request)

- **A rocket you can see.** The Anti-tank rocket is now a finned body with an orange-white tail flame. It flies a slight arc in 0.45 s (was a 0.24 s streak), rolling as it goes, and leaves a short smoke ribbon. The hit sound waits for it.
  - On a tank or other machine it lands with a white-hot flash, sparks thrown back off the plate, metal chips and a ring. On infantry or a building it makes a smaller burst.
  - A shot that kills keeps the old quick flight, so it lands before the wreck falls. The Hawk's pod rockets get a small body too.
  - All rockets in flight are one draw, and none while no rocket flies. Damage timing is unchanged (view only).
- **More flyers with a stronger core.** Your air limit is 4 flyers at a level 1 Command core, 6 at level 2 and 8 at level 3 (`balance.json` `air.cap_by_level`). Computer opponents keep 4 (and at most 2 armed flyers) on every plan, Field included (owner decision, 2026-11-21). The flyer tiles show the limit, and the "Air limit reached" message names the current number.
- **Flyers come alive.** They bank into turns, lift the nose on a climb, and the balloon sways. Rotors and the glider's propeller show a blur disc. Red and green wing lights blink, a white tail strobe flashes, and engines and the burner glow, much brighter at night. Fast flyers draw thin wing-tip contrails. The ground shadow shrinks as a flyer rides higher.
  - All of this is one more draw. With combat motion off or reduced motion, the lights stay steady and nothing trails.
- **Flyer models.** The Kite has warm edging on its sail and a longer tail. The Hawk has a twin tail and a dorsal intake. The Balloon has a crown vent and team streamers. The Glider has team winglets and a sun disc. No new materials, all within budget, flagged "pending owner review (round 3)". See `docs/aaa/results/round3/w.md`.

### R3-L: Living buildings and south exits
- **Trained units come out toward the camera** (owner decision 2026-11-21). A Barracks, Foundry or Command core now releases each unit on its south side, the side facing the default camera, instead of mostly the north side behind the building. If that spot is taken or blocked, the unit tries south-east, then south-west, then east and west, and north only last. The route check to the rally point or the Command core is unchanged. This moves play: every AI and ObjectiveBot golden pin was re-recorded (the 14 mission checksums and the idle fingerprint hold), and the ObjectiveBot no longer wins m03 and m12 on Standard or m04 on Veteran. That needs an owner decision before merge (`docs/aaa/results/round3/l.md`).
- **2D details on every building**, drawn from one canvas-drawn atlas: hazard stripes, bay numbers, team emblem plates and banners, pictogram signs (helmet, gear, bolt, sight, wrench), vents, crystal gauges, blinking beacons and a scrolling chevron sign. A light bar fills while a building trains, and the door light flashes when a unit comes out.
- **Life at the gate**, on the ground in front of the south exit: a painted concrete apron with team chevrons pointing out, runway lights that chase toward the gate while the building trains (faster near the end), a dust puff and fading boot or tread marks when a unit leaves, energy dashes from the Foundry and Relays toward the Command core, a blueprint grid under a building going up, warm light pools that glow strong on night looks, and a ground stencil per faction (Ashfall scorch and embers, Wardens frost slab, Sunward canvas rug, Veil mist swirl, Meridian mint lines).
- **Cost: one draw call** for all of it, with no shadow pass (render budget: +1 draw in every scenario, about +300 to +600 triangles; no buffer uploads while nothing changes). Animations run in the shader and hold still with reduced motion or when the frame governor stops motion. Decals follow team colour, fog of war, construction and destruction.

### R3-M: cover and menus, a war across several worlds
- New title cover: painted key art made for this game (src/art/cover/, provenance in docs/ASSET_PIPELINE.md): a squad of the game's units (tank, Ranger, Vanguard, Medic) on a crystal ridge under a binary sun, with a ringed river world, a dune world, a volcanic world and a storm world, aircraft crossing and a lightning horizon. First paint is one flat cover for the frame shape (desktop 345 KB, landscape 253 KB, portrait 313 KB); the page fetches only that one.
- Live cover: once the game's models are in, 15 parallax layers (1.6 MB, lazy) rebuild the cover and cross-fade in; pointer parallax on desktop, a slow drift on touch, aircraft drifting, the Ranger firing every few seconds, twinkling stars, plus one Canvas 2D layer for ship streaks, battle flashes on the worlds and lightning on the storm world and the horizon, and a faint sensor sweep. 30 fps on touch; nothing runs in a match, a hidden tab or with the menu closed. Reduced motion, or "Animate combat effects" off, keeps the flat cover and never fetches the layers. On phones in portrait the squad is lifted to stand above the setup sheet.
- Planet labels (name and front status) that step aside for the logo, the briefing text, the panel and each other.
- New logo treatment: chrome-gold FRONTIER, holo-teal COMMAND, a halo and a light sweep, with the line "War for the Meridian Frontier".
- Holo menus: the briefing card and the setup sit in a left column (the cover keeps its squad on the right and its title area at the top centre); the setup is a glass panel with glowing edges and corner brackets ("Command uplink · Sector 07"); the mode cards glow teal and turn gold when chosen, with a sheen on hover and a press; the gold Start has a light sweep. The same theme tokens (ui-theme.css, "Holo theme") frame the campaign map, Settings and the loading screen. A hidden slot (#title-actions) waits for the one-tap Quick battle (R3-Q).
- Loading screen: a planet in a progress ring over the painted cover, with the byte-true percent and the part being fetched; for later roster loads Start becomes a progress bar.
- Nothing is tidied away (owner rule): every control of the title menu, skirmish setup and Settings on r3-base is still shown and one click away (checked at five viewports).
- Soft hover and confirm blips on the menu cards (the in-code UI tone; mute and volume apply).

## 0.25.0: AAA round 2 (release label for the deploy; owner decision O17)

This is the label proposed for the next release. `package.json` still says 0.19.1, nothing is deployed, and the owner decides the number at deploy. It gathers everything of AAA round 2 (plan: docs/aaa/AAA_ROUND2_PLAN.md, results: docs/aaa/results/round2/). The Defence and campaign sections under "Unreleased" further down (0.22 to 0.24 labels) were built before this round and are not part of it.

**In short**
- **A second roster, opt-in.** Skirmish setup gets "Roster: Classic / Expanded" (default Classic): three signature units (Gunner, Stalker, Rampart) in faction workshops, facing armour and the Outrider drill. Classic play, the campaign and every earlier pin are unchanged.
- **A second AI plan, opt-in.** "AI plan: Classic / Field command" (skirmish only).
- **Bosses.** The boss engine can mark several zones, aim at towers, stun, strafe and release units at health stages; the Iron Sovereign (10,000 HP) joins the Iron Vanguard (32,000 HP on Standard and Veteran, 26,000 on Story).
- **Frontier Defence.** A command deck (fast-forward, tower aim, trait chips, new-enemy card, tower stats), elites and Heroic challenges, and the optional mission m11c "Hold the Keystone Roads" (16 campaign missions).
- **Phones first-class.** At least 70% of the screen is battlefield with nothing selected (60% with a unit selected).
- **Look and feel.** New title, warm colour grade and team rim light, night and storm missions, sixteen weapon looks, counter-hit flares, mission title cards and boss presence.
- **Tests.** `npm test` runs 961 tests (935 pass, 26 long pins skip and run in `npm run test:golden-full`); the round began at 645.

### Safety net, seams and tools (no change for the player)

#### W0-A: Safety net, baseline tools and the view seam
Nothing changes for the player: no rule, number or picture moved. This makes every later change provable.
- **Golden pins split and extended (K1).** `tests/golden-play.test.js` is now `tests/golden-skirmish.test.js`, `golden-defence.test.js` and `golden-story.test.js`, run in parallel; all 33 earlier values are kept. New pins, recorded at the base before any change: two skirmish setups as the skirmish screen makes them (riverlands ×3 Sunward against mixed rivals, dunes Ashfall against Veil), a save at 180 s that reloads to the same 300 s hash on all six AI setups, the towers left standing in the DefenceBot runs, Endless on Gorge Road to wave 12, Hold the River (DefenceBot, 120 s) and the Ashfall Chronicle's Cold Berths (120 s). The 300 s points, save and reload, Three Roads and Endless run only in `npm run test:golden-full` (new CI matrix entry `golden-full`); `npm test` keeps the fast ones. `d071360b` is now checked in one file only.
- **Tools.** `check:missions --json` (rows without wall-clock fields; `--only` takes a comma list); `bench:factions` and `tools/skirmish-bench.mjs` gain `--jobs N` (forked workers, byte-identical to a one-process run) and `--rules '<json>'`, and the ladder gains `--json` and `--cap`; new `npm run baselines:diff` (`tools/baseline-diff.mjs`) re-runs and compares the round's baselines once the integrator records them; `npm run ci:build-job` runs the CI build job's steps for the 2-core timing. Shared test helpers `tests/lib/sim.js`, `tests/lib/golden.mjs` and the equal-cost duel harness `tests/lib/duel.mjs` (10 battles: five offsets from both spawn sides).
- **View plugin seam.** `src/view-plugins.js`: visual features register a class and get `dress`, `scaleFor`, `frameScaleFor`, `event`, `update` and `reset` hooks from `WorldView` (docs/VIEW_PLUGINS.md). The registry is empty: render-budget p95 draws are identical in all 12 scenarios and the held-clock `battle-eco` screenshot is pixel-identical to the base build.
- **Rules seam.** `createSim` passes skirmish rules to the Simulation only when set (`window.__frontier.rules` for tests); inert until the Simulation takes them (W0-B). The render-budget harness takes data-driven scenarios (`spawn`, `boss`, `variant`, `status`, `rules`) and loads every type a scenario puts on screen first.
- Tests: 645 → 674 (`npm test` runs 659 of them; the 15 long pins skip there and run in `test:golden-full`). Results: `docs/aaa/results/round2/w0a.md`.

#### W0-B: Sim seams and status core

- **Nothing changes in play.** Every golden pin, `d071360b`, the 13 mission checksums and `check:defence --json` are identical (D1, the promotion fix, landed before this package; see the D1 entries below).
- **Content seams (H1 to H20).** New units, statuses, abilities, tower rules, commands, fight behaviours and AI rules are plain modules in `src/sim/content/` (append-only list `src/sim/content/index.js`, dispatcher `src/sim/content.js`). The hot sim files call them through one guarded line each (spawn, step, damage factors, hit, taken, death, fight, autocast, tower aim, commands, AI rules); with no module of a kind, a seam multiplies by exactly 1 or does nothing. A typo'd field, a duplicate id or step order, a command or method that already exists, or an ability with a built-in id throws at import. Guide and worked example: `docs/CONTENT_SEAMS.md`.
- **Status core** (`src/sim/effects.js`): timed statuses registered by modules (speed, reload and taken factors, noFire, noCast, an icon), with immunity after a status ends. State is created only by the first status (`e.fx`, `sim.fxOn`) and swept away once a second, so after the last status the state is what it would have been without it.
- **Registered abilities** are a generic timed buff: every changed key is put back, a key the unit did not have is deleted, and health, shield and ranks are never saved or restored (a promotion during a buff keeps its health, D1). Or an instant effect.
- **Skirmish rules option:** `new Simulation({ rules })` keeps `sim.rules` only when one is set; `sim.ruleOn(id)` reads it (else the mission's rules); saves carry it with their options.
- **Target preference:** a definition with `prefers` (a list of classes) ranks enemies by it, then by distance, then by entity order (`preferredEnemy`). No definition has it yet.
- **Shot events** carry `unit` (the shooter's type: Rider, Drone, Hawk and Glider all fire the Ranger's shot) and, when a module tags a hit, `tags`. Events are not saved, so the state hash does not see them.
- **`tools/perf-ab.mjs`:** interleaved A/B tick timing of two source trees (a `src` folder or a git ref) in one process, scenes `riverlands-x2-300` and `crossroads-wave-120`, median of 7 runs.
- **Tests:** `tests/content-seams.test.js` (23) and `tests/effects.test.js` (11); `tests/progression.test.js` counts only the Classic roster (definitions without `roster: "expanded"`: 21 units, 9 buildings, 4 flyers, 1 Defence unit), so Expanded-only units never touch its counts, and allows a shield-less Ashfall workshop unit. 645 → 681 tests.

#### Bigger plateaus (Amber Dunes, Verdant Crossing, Obsidian Highlands)
- **Why.** The high-ground plateaus were too small to use: the cliff band and the 1 m placement margin left room for one small building (a Sentinel tower and a Supply relay did not fit together). They are now 35-45% larger in linear size so a few buildings fit on top. Only these three maps change; Classic, Riverlands, Basin and Expanse, Frontier Defence and every terrain number in `balance.json` (cliff, height, vision depth) are untouched.
- **New sizes** (`src/maps.json`; ramps keep width 7 and still sit on the new edge; each plateau keeps its two ramps and its mirrored copy). Amber Dunes: disc r 8 to 11.5 m. Verdant Crossing: box 18 x 12 to 25 x 17 m, centre moved from x -14 to -17.5 so the east edge (and the clear space before the eastern mining site) stays where it was. Obsidian Highlands: disc r 11 to 15 m. Bases, mining sites, deposits, walls and flank routes keep their clearances; base-to-base and base-to-site paths still exist.
- **Room on top** (buildings of radius 2 / radius 3 that fit side by side on one plateau, with the cliff and ramp margin): Dunes 3 / 1 to 11 / 4, Verdant Crossing 3 / 1 to 10 / 5, Highlands 8 / 3 to 21 / 8.
- **Missions moved with the ground.** In m09 the Ashfall guard at (21, -17) became (21, -20.5) and in m10 and in Chronicles cv1 and cv3 the three Vanguards at (-54, 4) became (-56, 2), because the bigger cliff ring covered those spots (the positions test needs them standable).
- **Pins and baselines re-recorded, reason "plateaus enlarged".** Golden pins on dunes and highlands (Ashfall against Veil 60/180/300 s, Expanded Meridian and Veil, Wardens expanded, Field command, Highlands x2 coalition) and the m09/m10 mission checksums in `tests/wings.test.js`; the mission and Chronicle baselines for missions on these maps and the dunes, woodlands and highlands rows of `bench-classic`. Every target is still met; `d071360b`, Defence and every row on the other maps are identical. Tests that hard-coded plateau geometry now aim relative to the rim (`air`, `terrain-rules`); two AI-duel tests (`field-command`, `workshops`) moved their match to a map whose duel does not end early.
- **How the baselines moved** (all targets still met, every mission beatable on Story, Standard, Veteran, mercy and firm; Chronicles pass; Defence byte-identical). Bot clear times shift by a few seconds on most rows; larger moves: m05 Veteran 499 to 697 s (gold to silver), m10 Veteran 563 to 738 s, Chronicle cw2 479 to 950 s (gold to bronze), cv1 463 to 504 s (gold to silver); m09 Standard 511 to 431 s and cs2 522 to 413 s got faster. bench-classic: only the Dunes rows moved (39 of 40; 14 flipped winner), the Classic and Riverlands rows are identical.

#### Defence fixes and golden pins
- Tests (AAA round 2, K1): golden gameplay pins in `tests/golden-play.test.js`: state hashes of the idle all-Meridian match (`d071360b`), four computer-against-computer matches at 60, 180 and 300 s, the DefenceBot on Gorge Road, Twin Bridges (blowing a bridge) and Three Roads (Standard: hash, stars, lives), and the ObjectiveBot for 120 s on missions 1, 3 and 6b. The seven copies of the `d071360b` check in other test files now live there only. No game code changed.
- **Fix: a promotion no longer drops extra health (AAA round 2, D1).** A rank used to rebuild health from the unit type alone, so the Defence commander fell from 936 to 562 max health at its first rank, and a Bulwark armour tank from 1,193 to 562. Ranks now build on the unit's own health before ranks (`baseHp`): the commander's ×1.8, armour Rank 2 and Bulwark, tougher waves (`defence.hp`, a group's `hp`), a carrier's passengers and a mission's own `hp`. `baseHp` exists only on units that can earn ranks and whose health differs from their type's, so skirmish, the campaign's other missions and the AI keep their fingerprints (`d071360b`, the AI and the ObjectiveBot pins are unchanged). The campaign's Defence missions (Hold the River, Hold the Valley, and the chronicles' The Scrapyard Gorge and Hold the River) have waves with a health factor (×0.65 to ×1.5), so an enemy there that earns a rank now keeps its factor. The bot's runs there are unchanged on all three difficulties: no such enemy earns a rank, and the final hashes are the same. Towers are buildings and never take ranks. A commander from an older save ranks as before until it falls and comes back. An armour tank from an older save gets the right `baseHp` at its next upgrade. Tests: six cases in `tests/defence-ranks.test.js` (the commander rank on rank, through a save and after it falls; armour promoted before and after Bulwark; a Rank 2 squad from an older save buying Bulwark; tougher waves and passengers; towers; a plain unit exactly as before).
- Balance (D1): `npm run check:defence` passes. 17 of 28 rows are identical, and every passive, single-crew and Endless result is unchanged. The bot's stars and lives moved on 8 runs: Gorge Road Veteran 3★ 20♥ → 3★ 18♥; Twin Bridges Standard 2★ 14♥ → 2★ 16♥, Veteran 2★ 13♥ → 2★ 10♥; Switchback Pass Standard 2★ 15♥ → 3★ 20♥, Veteran 2★ 17♥ → 2★ 14♥; Amber Canyon Veteran 3★ 19♥ → 3★ 20♥; Long Crossing Veteran 3★ 20♥ → 1★ 7♥ (target 1★; its bridge-blowing run 2★ 15♥ → 3★ 20♥). Fordwood, Amber Canyon Standard and Long Crossing Standard keep their stars and lives with other towers; Three Roads is unchanged. A run plays exactly as before until the first promotion of a unit with extra health (on Long Crossing Veteran, the commander's first rank at 37 s); after that the bot's own choices (branches, when to call a wave) differ, so one run's shift is not a measure of difficulty. `npm run check:missions` (and `--chronicle all`) gives identical tables on Story, Standard and Veteran. Golden pins: the three Defence hashes moved (Gorge Road d05fdf96 → 3f391c5e, Twin Bridges b3595628 → d3c0f7a1, Three Roads 23c88f85 → c77144f6; stars and lives unchanged); the AI and campaign pins did not.

### New ways to fight

#### W1-A: Roster setting and faction workshops
- Skirmish setup gains a "Battle rules" row with "Roster: Classic / Expanded" (default Classic, remembered; skirmish only). Expanded makes every faction building a workshop host for signature units (`workshop: "<faction>"` definitions, at most 2 per host); Meridian gets a new Field workshop (150/50, needs a Foundry, `workshop.glb`, 3,640 triangles, 5 materials).
- The Expanded AI builds the Field workshop, raises each host to its units' highest `required_level` (never above the core) and trains units from their `ai.want` data. Classic play, campaign and Chronicles are unchanged (all golden pins and baselines identical).
- New: `src/sim/content/workshops.js`, `src/app/rule-options.js` (append-only rule registry), `src/app/rules-store.js`, `balance.json` `workshops` and `workshop`, field guide and model roster follow the `workshop` field, `tests/workshops.test.js`, `tests/workshops.mjs`, `tests/golden-w1a.test.js`, render scenario `battle-expanded-eco`.

#### W1-B: Gunner team (Meridian line-holder)
- New unit `gunner` (Expanded roster only, Meridian workshop, trained once W1-A merges): a two-soldier tripod machine-gun team, 125 HP and 35 shield, class `siege`, 16 dps at 11 m with a 1.8 m sweep. Its fire **suppresses**: infantry within 2 m of the target gain points, and at 6 points a unit is **Pinned** for 3 s (half speed, 1.5x reload, no abilities), then immune for 4 s (at most 3/7 of the time). Ability **Crossfire** (suppression x2 for 6 s) autocasts when 3 or more infantry are in range.
- New content module `src/sim/content/suppression.js` (status `pinned`, hooks `onHit`, ability, autocast), view plugin `src/status-view.js` (one draw call for all status icons, plus the Gunner's barrel kick), model `gunner.glb` (3,196 triangles, 7 materials), `weapons.gunner`, Vietnamese strings.
- Tests: `tests/gunner.test.js` (15), `tests/golden-w1b.test.js` (2), browser suite `tests/gunner.mjs` (CI group `r2-w1b`), render scenario `gunner-battle-eco`. No existing pin or baseline moved.

#### W1-C: Veil Stalker and ability UI from data
- **Stalker (Veil workshop unit, Expanded roster only).** A hooded long-rifle sniper: 95 damage every 4.5 s from 18 m, hides again 3 s after each shot (the Veil cloak), shoots Medics, Anti-tank soldiers and Rangers first (`prefers`). Kites (8 m), towers and Command cores (9 m) and anything within 4 m reveal it. **Steady aim** (autocast): +3 m and shields ignored for 8 s, tagged `pierce` on the shot. Nothing in Classic play changes: no roster lists it until W1-A.
- **Ability UI from data.** An ability's `icon`, `aimed`, `order` and `tint` in balance.json drive the command-card tile, the hint order, the buff ring and the cast flash, so new units need no edit to UI tables. Today's 12 abilities keep their exact icons, order and colours.
- Art: `stalker.glb` (Blender kit, 2,724 triangles, 7 materials, violet cloak, green lens), `weapons.stalker` look, Vietnamese strings. Tests: 710 to 735. Results: `docs/aaa/results/round2/w1c.md`.

#### W2-A: Rampart ram tank, facing armour and the Outrider drill
Expanded roster only; Classic play, the campaign and every pin are unchanged.
- **Rampart** (Ashfall Salvage yard, level 1, 200 alloy / 70 energy, 22 s): 650 HP, no shield, 34 damage every 1.3 s at 4 m, double to buildings and walls (`wall_bonus`). Welded plough tank in Ashfall rust orange with a Team-striped blade, ram gun and exhaust stacks (5,848 triangles). **Ram** (autocast when an enemy building or 3 or more enemies are within 10 m): double speed for 2.5 s and 80 extra damage on the first contact, once per cast.
- **Facing armour** (`src/sim/content/facing.js`, any unit with `facing: { front, rear }`): shots from within 57 degrees of the nose do x0.6, shots from behind x1.5, from the side x1; direct hits and splash; shots carry the `front` or `rear` tag. A Rampart hit only from behind dies 2.5x faster than from the front.
- **Outrider drill** (Sunward Riders, Expanded): a Rider steps back 3.6 m (at most 0.6 s, one step per 2 s) when a melee or flame unit comes within 4 m, then keeps shooting. Not on Hold, never onto unstandable ground (35 degree fallbacks). Numbers in balance.json `outrider_drill`.
- Field guide pages for the Rampart (facing rule) and the Rider (drill); Vietnamese for all strings. Tests +38 (816 to 854). Details: docs/aaa/results/round2/w2a.md.

#### W2-D: Field command AI plan (opt-in)
New Battle rule "AI plan: Classic / Field command" (`rules.aiPlan === "field"`, skirmish only). The computer keeps its heavy slot, sends fewer Harvesters to energy when it is rich, saves alloy for the Foundry and Tanks, defends every other core and held ring, fields one of each combat slot, casts abilities with intent (`ai-casts.js`) and places `ai.role` units (`field-command.js`). Classic is unchanged (pins, tick time identical).

### Bosses

#### W1-E: Boss engine II and the Iron Sovereign
- The boss engine can mark several zones at once (`count`, `spread`), aim at the best tower (`target: "building"`), stun buildings (`stun`, status `stunned`), step sideways between attacks (`strafe`), release units at health stages (`drops`), let damage during a warning break the attack (`break`) and walk a Defence road (route mode). The Iron Vanguard and mission 3 are unchanged.
- Defence: `leak_lives` sets what a leak costs, `spawnOnRoute` puts a unit on a road, and a boss group spawns exactly its count.
- New boss: the Iron Sovereign (10,000 HP, six legs, ported from Tank_game_3D `boss-walker.glb`). Round 3 puts it in a Heroic finale; this round it exists in the sandbox, tests and render scenarios.
- `tools/port-boss-model.mjs` takes a parts map (`--parts`) and a palette; `ironvanguard.glb` is byte-identical.

### Frontier Defence

#### W1-F: Defence command deck
Frontier Defence gets the controls other tower-defence games have. No rule, number or tower stat changed: `check:defence --json` equals the post-Wave-0 baseline and every golden pin holds.
- **Fast-forward (D2).** A 44 px speed button on the Defence bar and **Shift+Space** cycle x1, x2 (x3 with a mouse; Space still pauses, G still toggles the grid). It only feeds the clock that drives the fixed 0.05 s ticks, so a match replays tick for tick at any speed. At most 6 ticks a frame; a scene or a decision puts it back to x1; a new match starts at x1; a touch device whose frames stay over budget for 2 s drops to x1 with a toast.
- **Tower aim (D3).** New command `padAim` (`src/sim/content/tower-aim.js`) and an Aim tile on every tower: Nearest (today), First (least road left), Strongest, Air (crews that hit air). `e.aim` exists only once changed; the DefenceBot never sends it.
- **Trait chips, new-enemy card, tower stats (D4).** Armoured, Flying, Cloaked, Healer, Carrier, Heavy shield, Elite and Boss chips on the next-wave strip (`src/defence/traits.js`); a card the first time an enemy type is in a wave, with its traits and two crews that counter it (recorded in `progress.seen`); the tower sheet shows dps, reach, x vs armour, air and next-tier changes as text.
- **Phones (P3, Defence part).** Defence opens at road zoom (55) over the first spawn and follows the front of the wave (a manual pan or zoom holds it 6 s). The old Overview button is now a View button: Follow, Overview, Free (a desktop skips Follow). The bar stays one row of at most 56 px; `--defence-bar-h` is set while it sits at the foot of a portrait screen.
- Tests: +19 unit tests (`tests/defence-deck.test.js`), the browser suite `test:defence-deck` (CI entry `r2-w1f`) with the x3 and x2 determinism test through the real frame loop, and `tests/golden-w1f.test.js`. Results: `docs/aaa/results/round2/w1f.md`.

#### W2-B: Defence peaks, elites and Heroic challenges

- **Elites.** A wave group may carry `mods: { elite: "<affix>" }` (new content only). Every elite has 1.6x health, 3x bounty and a gold ring (one instanced draw, `src/elite-view.js`); six affixes (balance.json `elites`): Plated, Swift, Splitter, Volatile, Banner, Mender (`src/sim/content/elites.js`). Designed levels and Endless are untouched.
- **Heroic.** Clear a level to open its Heroic challenge (a fourth tab beside Levels, Endless, Daily, with a locked teaser): waves 5 to 10 of the level, the two largest groups elite, an all-elite finale, 5 lives, fixed alloy, no early-call bonus, +1 star (21 to 28), a Heroic badge on the result. Cloaked Stalker columns walk with the two Veil levels from wave 2. The empty `finale` slot is for round 3's bosses.
- **Tools.** `npm run test:defence-heroic-check` (bot wins 7 of 7 with 2 or more lives left, a passive player loses by wave 3, single crews lose on 5 or more levels); `defence-heroic-eco` render scenario; `tests/defence-heroic.mjs` (3 viewports). The build job's `check:defence` is unchanged.
- Model roster declares Splitter children and a Heroic finale boss's drops. Progress gets `heroic: { [levelId]: { won, lives } }`, written once something is recorded.

### Phones

#### W1-D: Phones first-class
On a phone the battlefield is at least 70% of the screen with nothing selected (was 59% portrait, 67% landscape) and at least 60% with a unit selected (was 48% and 53%).
- **Touch row:** Army, Workers and a "..." sheet (Box select, Queue orders, Clear selection, Info & stats). +/- are hidden (pinch zooms); all seven ids stay in the DOM.
- **Dock:** portrait collapses to the tab strip when nothing is selected and shows a short unit card (about 113 px) for one unit; landscape keeps its side dock with the orders in one row.
- **Dialogue** is a one-line chip at the bottom left that opens on a tap; hints (and the new unit intro cards) sit in the dock band. The Eco/High badge is not drawn on touch devices.
- **Armies at strategic zoom (P3):** units grow from 1.0 at zoom 40 to 1.6 at zoom 90 (view plugin `ArmyReadabilityView`).
- **Unit intro cards:** the first time a unit type with `intro` is on screen its line shows once (`frontier-command.unit-intros.v1`).
- Tests: `tests/phones.mjs` (CI entry `r2-w1d`), `army-readability.test.js`, `unit-intros.test.js`.

### Look, feel and showtime

#### W2-C: First impression and story light
- Title: FRONTIER COMMAND wordmark and emblem over the key art, three large choice cards (Campaign, Skirmish, Defence) with Training as a slim row, pressed and hover states, the setup as a rising sheet on phones. Display font Baloo 2 ExtraBold (OFL, Latin and Vietnamese, 24 KB, `src/fonts/`) as `--font-display` for headings only; tiles keep the old stack as `--font-tile`.
- Look: warm grade (one `CustomToneMapping` chunk) and a Fresnel team rim on every render tier, lighter Ashen fog; all numbers in `src/look-grade.json` (owner decision O7).
- Story light: `src/mission-looks.js` (id-keyed table, no new fields on missions): night for m08 and cv1, storm with lightning for m10 and for m06 from 16:00; Eco gets the palette swap only. View only; checksums unchanged.
- Tests: `look-grade`, `mission-looks` (8), browser suite `title`, scenario `night-battle-eco`; tool `tools/look-shots.mjs`.

#### W2-E: Battle feel

- Sixteen weapon looks (`src/fx-kinds/`, keyed by the shooter's unit type), faction tints, ability moments, counter-hit flares with a crit sound, damage numbers (setting "Damage numbers") and REAR / PINNED / PIERCE labels. View and audio only; no draw call added.

#### W2-F: Campaign showtime (title cards, boss presence, Hold the Keystone Roads)
- **Mission title cards.** Every mission, Chronicle mission and Defence level opens on a 2.6 s card in the top third of the battlefield: "ACT I · LANDFALL · DAY 1", the title, the place. The act and day labels are an id-keyed table in the new `src/story/mission-intros.js` (no field was added to any mission, so no checksum moved); an id missing from it falls back to the mission's title and `briefing.place`. A tap skips it; it never covers a control (checked at 1440x900, 390x844 and 844x390); a scene hides it; under reduced motion it only fades. Browser suites (`?test`) opt in with `?titlecard`. The Vietnamese of the labels is four patterns in `vi.json` (ACT, DAY, NIGHT, CHRONICLE).
- **Boss presence (view plugin `src/boss-presence-view.js`, any boss).** x1.5 on screen (3.0 Battle tanks tall at zoom 30), footfall dust and a small camera shake on each leg step, a name card when a boss wakes without a scene, "<name> destroyed" when one falls mid-match, the combat music layer at full while a boss is awake (`audio.js`). Scenes gain two beats, `title` (a name card between the letterbox bars) and `shake`; the m03 entrance scene uses both (scene data is not part of the mission checksum), and a scene clears the old dialogue line when it starts. When a boss's fall ends the match the end beat focuses on it and holds 1.2 s at x0.3 before the debrief (1.9 s from the result).
- **m11c "Hold the Keystone Roads".** A new optional Act 3 mission between Cut the Draw and Frontier's End: Three Roads with build zones, an armour cap of 2 and the commander's post (the first in the story), ten waves of Ashfall and Wardens, Walkers leading wave 8, story beats, and two lent Gunner teams before wave 4 (their story debut, outside the Expanded rule). It carries `optional: true` and `look: "dusk"`. A mission now opens when the nearest earlier non-optional mission is cleared, so m12 never waits for m11c and m11c counts for medals, never for endings. Standard: 3 stars; Story 3; Veteran 2 (target 1). The campaign map has 16 relays.
- Tests: `tests/keystone-roads.test.js` (9), `tests/golden-w2f.test.js` (2, one behind GOLDEN_FULL), `tests/showtime.mjs` (browser, CI entry r2-w2f), the m11c checksum in `tests/wings.test.js`. Existing missions, pins and baselines are unchanged.

### Integration

#### Wave 1 integration
- Wave 1 merged (W1-A to W1-F): Expanded roster with the Gunner and the Stalker, the Iron Sovereign, the Defence command deck and phones first-class. Classic play is unchanged: every baseline, golden pin and the Classic bench are identical.
- Integrator fixes: the Field guide hides Expanded-only entries in Classic, Continue restores the rules, Gunner/Stalker ability tile orders are unique, the boss bar clears the phone dialogue chip, the 320 px unit card and the Hidden-from-below card fit, and the suites follow the new phone UI. New pin `tests/golden-expanded.test.js`; new baseline `bench-expanded.json`; the CI `interface` and `ui-extras` groups are split.

#### Wave 2 integration
- Wave 2 merged (W2-A to W2-F), none reverted. Integrator fixes: `WorldView.reset()` seeds the cosmetic effects generator, two Field guide patterns in `vi.json` had lost their backslashes and one pair never loaded (both fixed), `mission-looks.test.js` lets m11c carry `look: "dusk"`, `mobile-controls.mjs` scrolls the enemy count into view, the CI `visuals` group is split into `visuals` and `visuals-world`. New pin `tests/golden-round2.test.js`; m11c added to `golden-story` and to the five mission baselines (new rows only).
- Checks: `npm test` 935 tests (909 pass, 26 skipped, 0 fail); `test:golden-full` 82 of 82; `check:defence --json` and the Classic bench identical; `d071360b` and the 13 mission checksums unchanged (m11c adds the 14th, `8b3c253d`); render budget `battle-expanded-full-eco` 149 (limit 150), `defence-heroic-eco` 114 (125), `night-battle-eco` 107 (120); CI build job on 2 cores 310 s. Expanded bench (120 matches): Meridian 54.2%, Ashfall 37.5%, Sunward 68.8%, Wardens 52.1%, Veil 37.5%. Open owner decisions are in docs/aaa/results/round2/review-packet.md.

### Clean-up wave (no change for the player)
- **CW-D: flatter AI ticks and dead code.** `sim/ai.js` builds its structure counts in one pass per think (same orders, same messages); unused `TEAMS`, `disposeEmblems`, `BANK_NAMES`, `MAP_SIZE`, `HALF`, `CELL`, `GRID`, `cellAt`, `worldAt` and `paintTerrain` removed, 7 dead CSS rules and 113 stale `vi.json` messages dropped; new `tests/i18n-reverse.test.js`.
- **CW-E: Source-text tests converted.** Tests only. `tests/lib/sim.js` `advance()` replaces 21 local `run()` copies; the 32 `review-*` files are named by feature; new behavioural tests `service-worker` (the built worker runs in a sandbox), `css-layout` (parsed rules), `docs-facts` (README numbers from a running match), `suite-hygiene` (syntax-tree check of the stages suite); client wiring checks added to the `hotkeys` browser suite. 935 to 938 tests, same wall time. See `docs/aaa/results/round2/cwe.md`.
- **CW-A: Defence split (code move only).** `src/sim/defence.js` is now a re-export shim over `src/sim/defence/{index,common,towers,waves,route,commander,armour,crossings}.js`: the 83 methods are unchanged and `index.js` builds the mixin in the original key order; every named export (`GARRISONS`, `seeded`, `seedOf`, `endlessWave`, `starsFor`) is kept. The garrison on-hit helpers moved to `src/sim/effects.js` (`applyHitEffects`, `pierceShield`, `burstStep`, same entity fields); `garrisonHit`, `garrisonPierce` and `garrisonBurst` stay as thin wrappers. `endlessWave` and its palette are memoised in module WeakMaps keyed by the level definition (off the sim, never hashed). Tests: `tests/mixins.test.js` (no method name in two mixins, the Defence key order, exports, wrappers, memo). No play changed: every golden pin, `d071360b`, the 14 checksums and `check:defence --json` are identical.
- **CW-B: Shared rng and seeded cosmetic randomness.** New `src/rng.js` (`mulberry32`, `fnv1a`): the one copy used by the scatter, ambient life, audio, effects and the state hash. `audio-logic.js` still re-exports `mulberry32` and `hashString`; `src/sim/defence.js` keeps its own `seeded` and `seedOf` (equal output, pinned by `tests/rng.test.js`). No `Math.random` is left in `fx.js`, `fx-kinds/*`, `view.js`, `scatter.js`, `ambient-life.js` or `ambience.js`: particle rotation draws from the per-match `fx.rng`, the view module generator is a reseeded mulberry32, the ambience noise bed uses a fixed seed. Held-clock renders are now repeatable. Simulation untouched: every golden pin, `d071360b` and the Defence check are identical.
- **CW-C: Spatial grid and fast paths.** Nothing changes in play: every golden pin, `d071360b`, the 8 baselines and `check:defence --json` are identical. `src/sim/grid.js`: a per-tick 8 m grid (module WeakMap, off the hashed state) feeds `enemy`, `preferredEnemy`, `defenseTarget`, splash and `separate()`, visiting candidates in entity order. Defence skips team 0's sight loop; `cellAt`, `canStand`, `canTraverse`, `clearLine` and the visibility reads no longer allocate. Tick p95 on the AI-against-AI scenes about 26 to 30% lower and the Defence scene 27 to 42% lower (interleaved A/B on a loaded machine). `npm run perf:tick` runs `tools/perf-ab.mjs` (new scene, max column) against `r2-wave-2`. Tests: `spatial-grid` (6). Results: `docs/aaa/results/round2/cwc.md`.
- **The Defence match interface is split** (CW-F). `src/app/defence-ui.js` is now a short assembler; the pads and crossings, the bar, the command-card sheets, the input and the result screen live in `src/app/defence/{pads-view,bar,sheets,input,result}.js`, the tints and texts in `src/app/defence/constants.js`. The same DOM, ids, classes and events; the first-load bundle did not split. Zone names moved to `ZONE_NAMES` in `src/defence/levels.js`, a separate export keyed by level id (never a level field, so `serialize()` of a Three Roads match is byte-identical); the unused `TIER_NAMES` is gone. New `tests/defence-text.test.js`.

## Unreleased: Frontier Defence "Build zones, armour and Three Roads" (plan: docs/aaa/AAA_GAMEPLAY_STORY_DEFENCE.md, C10–C12)

- **Build zones (C10):** a level may mark fields (`defence.zones`) where a crew can stand anywhere, on the 2 m grid, besides its fixed pads. Tap a spot in a marked field, pick a crew: the tower gets a pad of its own, so Upgrade, branches and Sell work as on any pad (selling frees the spot). A spot is refused, with the reason on the card and a red ring, within 4.5 m of a road (the column must always pass), near a spawn spot or the exit, within 5 m of another pad or tower, under a unit, where it would wall in ground, or when the field is full. The open cells are painted as one flat mesh (one draw). Command `zoneBuild { zone, x, z, crew }`, saved and replayed like `padBuild`.
- **Armour squads (C11):** two Battle tanks bought at the commander's post for 240 alloy, two squads at most. The Armour chip on the Defence bar (44 px, "1/2") picks the next squad on each tap, or opens the depot; a tank tapped picks its squad; then a tap on the map sends it. On **Guard** (the default) a squad fires at anything in range, chases only within 9 m of its spot and drives back; **Hold road** makes it stand fast and stop the column like the commander. After every wave beaten each squad is mended and refitted to two tanks; a squad wiped out can be bought again. Commands `armourBuy`, `armourMove`, `armourMode`. Nothing needs steering: a squad left alone guards where it stands.
- **Three Roads (C12):** a seventh level after Long Crossing, the first 128 m valley (others are 96 m): three entries and four roads (the north road forks round the basin, all meet before the exit), 15 pads and four build zones, armour, Ashfall with Warden machines and troop carriers on several roads at once. Overview zoom 124. Vietnamese for every new string.
- **Fix: a phone's ghost click.** The click that follows a tap on the battlefield no longer presses the command card tile that the tap just opened under the finger (seen on landscape phones, where the card opens on the right).
- Balance: `npm run check:defence` passes with every older level's results identical to before. Three Roads: the bot (which now builds in zones and buys and moves armour) wins Story 3★ 20♥, Standard 2★ 16♥, Veteran 3★ 18♥ (targets 3/2/1); passive loses by wave 2; no single-crew player wins; Endless held 34 waves. `npm run check:missions` meets all targets. The ordinary match fingerprint (d071360b) and the mission checksums are unchanged.
- Render budget: new phone scenario `defence-big-eco` (Three Roads, 120 units over four roads, 14 towers, both squads): 106 draws (limit 112), 478 composes (limit 500).
- Tests: `tests/defence-zones.test.js` (snapping, road clearance, overlaps, caps, armour buy/move/leash/Hold road/refit, save and replay, a deterministic bot run) and the browser suite `tests/defence-zones.mjs` (`npm run test:defence-zones`, CI group `defence`) at 1440x900, 390x844 and 844x390.
- **More levels to upgrade the army (0.24):** every tower branch now has **two ranks** after it, each adding an effect as well as armour: Marksman shots pass shields (half, then all) and bite into armour; Suppressor slows harder and the slow spreads; Cluster blasts grow; Guided reaches further and marks; Heavy hits machines harder; Rapid fires in bursts of two, then three; Beacon's mark strengthens and spreads; Far-eye sees further and pierces; Breacher, Shrapnel, Inferno and Firewall grow their blast or fire and thicken their armour. 110–200 alloy a rank: a sink for the last waves and Endless. Rank pips on the tower's health plate and in the tower sheet; the trim brightens. **Armour squads** get Rank 2 (160: thicker armour, a little more damage, the tanks mend between fights) and then a branch: **Assault** (200: harder, faster guns, strong against machines and carriers, chases further) or **Bulwark** (200: much thicker armour, faster mending: holds the road longer). Bought on the squad sheet, kept through refits. Commands `padRank`, `armourUpgrade`.
- **Towers last longer (0.24):** the owner saw towers shot down too easily. Tiers now give ×1 / ×1.35 / ×1.75 health (was ×1.5 at gold), the front-line crews carry more (Scorcher and Tank ×1.5, Breaker ×1.2), and a tower not hit for 6 seconds mends 4% of its health a second, during a wave too. Towers destroyed in the bot's games (Story / Standard / Veteran): Gorge Road 0/1/1 → 0/0/0, Twin Bridges 0/0/0 → 0/0/0, Switchback Pass 4/9/11 → 2/3/6, Fordwood 0/1/2 → 0/0/2, Amber Canyon 0/1/3 → 0/0/1, Long Crossing 0/0/1 → 0/0/0, Three Roads 0/4/4 → 0/0/1 (42 → 15 in all). Switchback Pass keeps the most: Warden walkers out-range the towers on its two exposed pads. The bot now also leaves a pad whose tower fell empty until that wave is beaten..
- Balance (0.24): `npm run check:defence` passes. The bot's stars and lives are unchanged on 17 of 21 level/difficulty runs; Switchback Pass Veteran 3★ 18♥ → 2★ 17♥ (target 1★), Three Roads Story 20♥ → 18♥ and Standard 16♥ → 15♥, the bridge-blowing bot on Twin Bridges Veteran 15♥ → 14♥. Passive players lose every level as before; no single-crew player wins anywhere it lost before (Long Crossing Story Scorcher-only 1★ 7♥ → 2★ 13♥ and Breaker-only 2★ 10♥ → 2★ 12♥ were already wins). To get there: Scorcher direct hits ×0.75 → ×0.7, Three Roads Story enemy hull ×0.8 → ×0.85, Endless hull growth 0.06 → 0.1 a wave from wave 10. Endless (cap 40): Twin Bridges 27 waves as before; Switchback Pass 34 → 40+, Fordwood 39 → 40+, Three Roads 34 → 40+ (the ranks are meant as the Endless sink). `npm run check:missions` meets all targets; the fingerprint d071360b and the mission checksums are unchanged.
- Tests (0.24): `tests/defence-ranks.test.js` (rank costs and order, every rank effect, front-line health, repair timing, armour Rank 2/branch and refit, a Rank 2 squad mending, state only on first use, save and replay), and `tests/defence-zones.mjs` buys a branch rank and a squad's Rank 2 and Bulwark by taps on desktop and both phone shapes.
## Unreleased: Frontier Defence "Wave intel and carriers" (plan: docs/aaa/AAA_GAMEPLAY_STORY_DEFENCE.md, C1)

- **Wave preview (C1):** while the next wave can still be called, a strip beside the Defence bar shows its units (portraits with counts as they will spawn on this difficulty; a carrier as "×1 (8)", its passengers in brackets) and, on levels with several roads, which roads it takes (Ford, West bridge, East bridge). Under the bar on PCs (top right) and landscape phones, just above it on portrait phones; text 12 px or larger, no taps. `sim.wavePreview()` feeds it.
- **Troop carrier:** a new Defence-only enemy (`carrier` in balance.json, an armoured truck built with the Blender kit after the owner's Tank_game_3D transport, 3,368 triangles, `tools/blender/generate_carrier.py`). Wave group `{ units: { carrier: n }, carry: { slot: n }, dropLeg }` (`carriers()` in levels.js): it drives its road, stops at route point `dropLeg`, its squad steps out around it and walks on, and the empty carrier drives on. Destroyed before the drop, the squad dies with it and pays its bounty too: a bigger blast and a "+N" over the wreck. Through the line it costs 2 lives. Passengers are saved on the carrier (`cargo`), so a save mid-ride plays on identically. Only in Long Crossing wave 8 (one carrier with six shades over the ford) and in Endless/Daily (every fifth wave from the fifth).
- **Fix: calling a wave early no longer loses the previous wave's reward.** A wave still on the road when the next is called is held apart (`defence.open`, units tagged `wave`); when its last unit falls it pays its clear bonus, its "Wave held" and the tower repair, once. The level is won only when every wave is beaten. Matches without an early call save exactly as before.
- **Fix: flyers pass over ground blockers.** The commander and Reinforce Vanguards no longer stop Kites, gliders and balloons in mid-air.
- **One "incoming" warning per spawn point** a wave uses (one minimap ping each, one alert and tone for the batch). Every current level has a single spawn point, so nothing changes there yet.
- Balance: `npm run check:defence` passes, every level at or above its star target, the bot's stars unchanged. Lives moved on the two air levels because flyers are no longer held by the commander (Gorge Road Veteran 18♥ → 20♥; Twin Bridges Standard 16♥ → 14♥; the bridge-blowing bot on Twin Bridges Standard 19♥ → 18♥ and Veteran 3★ 18♥ → 2★ 15♥, target 1★). Endless with carriers: Switchback Pass 40+ → 34 waves held, Fordwood 36 → 39 (minimum 15; the others still reach the 40-wave cap). Render budget: a new phone scenario `defence-carrier-eco` (Long Crossing, six carriers among 120 units) draws 139 calls against 134 without carriers. The early-call fix changes no bot result (the bot only calls with the road empty). The ordinary match fingerprint (d071360b) is unchanged.
## Unreleased: bosses, and the Iron Vanguard in mission 3 (docs/aaa/BOSSES.md)
- **A boss system.** A boss is a unit whose behaviour is data (`balance.json` `bosses`). It runs a slow cycle: it walks to the biggest enemy group, marks a danger zone on the ground (circle, cone or line), fires, then opens its core. While the core is open it takes ×1.75 damage; otherwise it is armoured (×0.65). At 2/3 and 1/3 of its health it attacks sooner. Warnings always last long enough to walk out, and difficulty never shortens them: it changes damage (Story half) and cadence.
- **Units step out of danger zones by themselves** on Guard and Aggressive; Hold stays. This is in the rules: deterministic, saved, replayed.
- **The Iron Vanguard** guards the north siphon in *The Ashen Line*, in place of that siphon's tower. It is an old Builder war machine Ashfall dug out and refitted, ported from the owner's tank game (`tools/port-boss-model.mjs`). It has 32,000 health (Story 26,000), a marked four-gun burst about every 13 s that never takes more than 30% of a Ranger, a light gun, a 4 s open core, an entrance scene, stage and defeat lines (Okoro, Hale, Vale), a debrief line, and a required objective. Units on Guard or Aggressive step out of the mark by themselves 1.5 s into its 3 s warning, so slow units near the centre get clipped unless you move them. Medals are now 12:00 and 16:40, and the time limit is 16 minutes.
- **On screen:** the boss bar (name; ARMORED / ATTACK INBOUND / CORE EXPOSED; health with stage notches) above the console on PCs, above the dock in portrait and in the top row in landscape. Also: the red ground marks, the guns glowing as they aim, the open core lit, shake and a blast at each stage, and a long fall. The boss draws 7 batched parts and 1 draw per mark (`boss-battle-eco` render budget: 116 draws).
- Only mission 3 plays differently. Skirmish and Defence fingerprints are unchanged, and the mission 3 data checksum is re-pinned. The objective bot's times are 522 / 602 / 632 s on Story / Standard / Veteran (were 428 / 501 / 589).
- Tests: `tests/bosses.test.js`, and the browser suite `tests/boss.mjs` (`npm run test:boss`, CI group `bosses`).

## Unreleased: selection fixes
- A drag box that ends over the dock, the minimap or another panel now selects what it covers (it selected nothing). Clicks still have to land on the map.
- Portrait phones with a panel open: taps aimed at the full canvas height while the map is drawn above the dock, so a tap could pick the wrong thing (often a building). Picking now uses the drawn height, like the drag box and the minimap.
- A unit under the pointer wins over a building behind it (a Harvester at a Refinery).
- New browser suite `tests/selection.mjs` (`npm run test:selection`).

## Unreleased – gameplay and offline fixes

- Destroying the launch yard early in Wings over Copper counts when the objective appears, including when resuming an older save. Two campaign briefings now give the correct one-minute hold time.
- Hold the River has lighter waves on Story in the main campaign and on Standard in the Wardens Chronicle. On Veteran, Lights Out and Three-Way Dunes give the player reinforcements at the start, and the survey masts in A Grey Coat take less damage to destroy.
- Aircraft keep their position when a building goes up beneath them, and ground obstructions no longer block takeoff. If a flyer’s model is unavailable offline, it appears as a selectable team-coloured airframe. Reconnecting restores the animated model and keeps the selection.
- Switching skirmish factions during a download restores the Start button as soon as the chosen roster is ready. Returning players can use their selected faction offline after its models have loaded online. The loader can recover from a damaged model download.
- The installed game opens through a temporary server outage, after reading the build prompt, and on hosts that vary asset responses by Origin. Campaign mission buttons keep keyboard focus when downloads finish. Vietnamese loads in development, and Chronicle Defence briefings show the selected faction’s mission.
- Damaged visibility grids are detected when loading a match. The start screen now opens without loading the sound engine. Its 11 KB of compressed JavaScript can load on first interaction.
- In the 390 × 844 Eco air-battle benchmark, eight aircraft among 82 units used 116 draw calls and 291,782 triangles. The median CPU render time was 6 ms in Chrome on a desktop RTX 4080 SUPER.

## Unreleased: AAA pass 4 (plan: docs/aaa/AAA_PASS_1.md)

- **Shorter phone messages:** counter tips are one line on phones ("Vanguard beats Ranger: use Breaker"), and alerts such as "Under attack!" are small pills instead of full-width bars, so they cover less of the battlefield. PCs keep the full sentences.
- **PC dock with nothing selected:** the idle Harvesters and idle army buttons sit side by side and no longer run off the bottom of the screen.
- **After losing your Command core** the dock says so ("Your Command core is down") instead of "Your expedition is ready".
- **Smoother minimap:** drawn from the battlefield's own painted ground, with soft fog edges, instead of square blocks.
- **Sharper ground on PCs:** High quality on a mouse-and-keyboard computer uses a 2048 ground texture; phones and Eco keep 1024.

## Unreleased: painted portraits, sharper ground, a tidier phone HUD (plan: docs/aaa/AAA_PASS_1.md)

- **The seven story characters have new painted portraits** (briefings, dialogue, Comms log, choices, Chronicles), replacing the Blender busts. Generated by Codex (built-in image generation, 2026-11-17) and chosen by the owner; 256 px WebP, 3–14 KB each. Mira Vale is now drawn as an East Asian woman, and her `portrait` description in `CAST` says so.
- **Sharper ground:** the ground texture is painted at about 1.2 m per colour cell instead of 2 m, with half the blur, so grass and dirt borders stay crisp. Bare dirt and stone get small pebbles and clods (shadow plus lit top) instead of zigzag cracks that blurred into smears. Paint only: rules, saves and the match fingerprint are unchanged.
- **Phones, nothing selected:** the Selection tab no longer shows greyed-out orders with the idle row running over them; the floating idle buttons already jump to idle Harvesters and army.
- **More map on portrait phones:** with nothing selected, the Selection panel shrinks to one slim bar ("Awaiting your command" and Info & stats) and the map fills the screen down to it (about 70% of a 390x844 screen, was 53%). With a panel open the view is framed exactly as before, and the hidden strip under the panel is not drawn, so it costs nothing. The view never resizes when you switch tabs.
- **Tidier phone battle HUD:** the top tool row's seven buttons share the width equally; six orders sit as two rows of three; a group's attack shows its range ("ATK 4–13") instead of "ATK*" for the first unit only; a long unit roster fades at the edge to show it scrolls.

## 0.19.1: Anti-air guns you can find

Towers could always shoot flyers after a Command core research, but it was called "Flak guns" and nothing on a tower mentioned it, so towers looked unable to hit air at all.

- **"Flak guns" is now "Anti-air guns"** everywhere the player reads it: the Command core tile, its messages, the flyers hint, the field guide, unit cards and the Wings over Copper lines. Rules, cost (125 alloy, 75 energy, level 2 core) and saves are unchanged; the internal id stays `flak`.
- **Your Sentinel tower's card says whether it can shoot flyers:** "No anti-air guns: see Command core" until the research is done, then "Anti-air guns: shoots flyers". Only in matches with air; Defence towers (crews) are unchanged.
- Vietnamese already said "Pháo phòng không"; the new lines are translated.
- `tests/air.mjs` checks both lines at the three viewports and that the text is not cut off.

## 0.19.0: Story you see, Faction Chronicles, Defence complete (round 3 plan finished)

The rest of the round 3 plan (docs/aaa/PLAN_ROUND3_REFINED_2026-11-13.md: releases 0.19b, 0.20 and 0.21, plus item 18.3). 0.17.0 and 0.18.0 never reached the site, because CI stopped on slow-runner test timing; this release carries them too.

**Campaign: 15 missions**
- **Staged scenes:**
  - Six big moments play as short scenes: letterbox, eased camera, lines with portraits.
  - The scenes are relay held (m01), the truce (m04), ECHO wakes (m08), the Crown lights (m10), the draw cut (m11), and the Keystone, by ending (m12).
  - Skip with the button, Esc or Space. Music keeps playing. Under motion-off the camera cuts instead of panning.
- **Reworked missions:**
  - **Mission 2 is a bridge assault:** Ashfall towers cover the far half of the west bridge, and the ford is slow.
  - **Mission 9 is a plateau hold:** hold the dune top for 3 minutes while Warden drones climb the ramps.
  - Veil scouts appear in mission 6 and Wardens in mission 9, before the finale.
- **Three new missions:**
  - *Hold the River* (Act 1, Twin Bridges) and *Hold the Valley* (Act 2, Gorge Road) play under Defence rules, with story between the waves.
  - *Wings over Copper* (Act 2) is the first air raid: guard the refinery through three balloon raids, research Flak, then burn the balloon yard.
- **Anti-air hint:** when an enemy flyer is in sight and nothing you have can hit it, a hint says what can.
- **No skirmish line in missions:** missions, Defence levels and chronicles no longer open with the skirmish line about Harvesters.

**Faction Chronicles**
- Four campaigns of three missions each, played as that faction:
  - Ashfall, *Salvage Rights* (Hale)
  - Sunward, *The Long Road* (Sol)
  - Wardens, *ECHO's Key* (ECHO)
  - Veil, *The Quiet Survey* (Maren)
- They tell the same war from the other side, on the existing maps plus two Defence missions.
- They open after Act 1. Each has its own card on the campaign map, its own headers and debrief, and works with Continue.
- Each finished chronicle adds its lead's line to the finale's debrief.

**Frontier Defence complete**
- **Two more crews:** the Tank emplacement (heavy single shots, slow, strong against machines) and the Scorcher flame trap (short range, sets the road on fire; best against swarms on foot).
- **Tier-3 branches:** a gold tower picks one of two upgrades, shown on its tile: Ranger Marksman or Suppressor (slows), Mortar Cluster or Guided, Anti-tank Heavy or Rapid, Watcher Beacon (marked targets take 25% more) or Far-eye, Tank Breacher or Shrapnel, Flame trap Inferno or Firewall.
- **A commander on the field:** a gold-trimmed tank you send down the road with a tap. It holds and blocks the column, calls Barrage and Reinforce (three Vanguards hold the road for 20 s), and comes back 20 s after it falls.
- **Six levels:** Switchback Pass (Wardens), Fordwood (Ashfall with Warden machines, one bridge and the ford), Amber Canyon (Veil shades: Watcher posts matter) and Long Crossing (Veil with hired Sunward riders) join Gorge Road and Twin Bridges; each opens with a star on the one before.
- **Bridges:** on river levels, tap a bridge to blow it (3 s fuse). The columns turn to another crossing; the ford and the last open way across can't be blown. Bridge builders stop at the bank and raise a pontoon in 20 s unless you bring them down.
- **Endless and Daily:** any open level, waves forever from a seed; the score is waves held and your best is kept. The Daily seed is the same for everyone that day.
- **Perks:** stars buy Quartermaster (first tower −20%), Reserves (+2 lives) and Fast guns (faster Barrage). Defence levels only, never the campaign.
- **Air waves:** on Gorge Road and Twin Bridges, Kites spot from above and Ember balloons and Swift gliders bomb. Crews whose unit hits air (Ranger, Anti-tank, Watcher) shoot flyers at ×1.5; Breaker, Tank and Scorcher crews can't.

**Checks**
- 561 unit tests and every browser suite, including the new `test:story`, `test:chronicles` and `test:air`.
- The mission checker meets every target on all 15 missions and both decision branches.
- All 12 chronicle missions are winnable at Normal and Story. Three miss at Veteran (recorded in docs/MISSIONS.md).
- `check:defence`: the bot reaches its stars on all six levels at three difficulties, an empty field always loses, and no single crew type earns three stars.
- Phone draws: Defence wave 109 (limit 120), river wave with a blown bridge 132 (limit 135), air battle 116.

## 0.18.0: Wings (air units)

- **Four flyers**, made with the project's own Blender kit:
  - **Kite scout:** every faction; unarmed; sees up cliffs and spots cloaked units within 8 m.
  - **Hawk gunship:** Meridian.
  - **Ember balloon:** Ashfall, a splash bomber.
  - **Swift glider:** Sunward, a fast raider.
- **How they fly:** they ignore water, walls and cliffs. Rotors spin, the balloon's burner flickers, and a soft shadow on the ground shows where they are.
- **The Command core is the airfield:** Kite at L2, the faction flyer at L2/L3, and Flak guns. This keeps phones at four tiles per building.
- **Who can hit them:** only anti-air weapons can (Ranger, Rider, Sentinel drone, Anti-tank, Watcher, Hawk); every faction has at least two. Towers hit flyers after Flak research (×1.5). Splash, Barrage and burning ground skip flyers.
- **Spotting:** a flyer over a plateau opens it to its side. Enemies below still see a flyer hovering over a plateau.
- **Limits:** at most 4 flyers per side, queue included. Flyers can't capture rings.
- **The AI:** counts the flyers it sees, answers with anti-air, researches Flak after seeing two, sends a Kite ahead of its attacks, and builds its own flyer from spare resources.
- **Campaign:** story missions keep their rosters, so there are no flyers in the campaign yet.
- **Speed:** a phone battle with 4 flyers per side costs 116 draws (battle-eco 107); flyer models load in the background once a match starts.
- **Balance:** round robin Meridian 69, Ashfall 40, Sunward 38, Wardens 71, Veil 33%. This is within noise of 0.17; the faction balance pass is still open.
- **Validation:** 515 unit tests; all browser suites, including the new `test:air`; the mission checker on all 12 missions.

## 0.17.0: Frontier Defence and Choices (round 3 plan, releases 0.17 and 0.19a)

- **Frontier Defence, a new mode** (a fourth card on the start screen):
  - Enemy columns march along a road; you crew build pads beside it with your own army's units: a Ranger nest, a Breaker mortar, an Anti-tank post and a Watcher post.
  - Each tower has three tiers with bronze, steel and gold trims.
  - Kills pay alloy and leaks cost lives. Call waves early for a bonus. Stars come from lives kept.
  - Two levels:
    - **Gorge Road:** the road climbs past plateau rims. Pads deep on a plateau are hidden from below; rim pads are closer but exposed.
    - **Twin Bridges:** a river with two bridges and a slow ford.
  - Three difficulties, an Overview zoom, and progress saved per level.
  - A bot checks that every level is winnable and that no single tower type earns three stars.
  - A 120-enemy wave costs 92 draws on a phone.
- **Choices and two endings:**
  - Three Commander decisions: m03 (the alloy), m05 (the pact) and m10 (the Veil).
  - Each answer has a small, honest consequence later.
  - Two or more merciful answers lead to "The Open Frontier"; otherwise to "The Meridian Line".
  - The finale's objective, closing line and debrief follow the ending, then five epilogue cards (Vale, Sol, Hale, Maren, ECHO).
  - The choice card holds the battle but keeps the music, and comes back after Continue.
- **Campaign map:** the frontier as a map with three acts, relays that light up with your medal, decision marks, endings seen, and a slot for the Faction Chronicles.
- **Progress fixes:** campaign progress keeps every field. A mission opens when it or the one before is cleared, so adding missions never locks a cleared one. Continue uses the mission as it was saved.
- **Music:** Defence plays the between-waves track while no wave is on the road.
- **Short phones:** the four mode cards sit in one row, so the setup stays above the pinned Start button.
- **Validation:** 498 unit tests; all browser suites, including the new `test:defence` and `test:choices`; `check:defence`; the mission checker on both decision branches.

## 0.16.1: recorded music

- Five original instrumental tracks, made locally with ACE-Step 1.5 (MIT; see `public/music/LICENCE.txt`):
  - title theme (104 bpm, soft bending monochord lead, 55 s loop);
  - campaign and briefing (88 bpm, 44 s loop);
  - Defence between waves (96 bpm, low taiko and marimba, 60 s loop);
  - victory and defeat stings.
- 1.44 MB in total, AAC 64 kbps, -16 LUFS. Loops are cut to whole bars and loop sample-exactly.
- Nothing downloads until the first tap; each track is cached on first play.
- The takes were chosen by measurement (loop seam, beat steadiness, no voice-like sound). The blind listen page with the other shortlisted takes is `music-lab/listen/` at the repo root (first kept in the 3D_claudeopus55 repo, moved here on 2026-11-14); any track can be swapped.

## 0.16.0: Hold the Line (round 3 plan, docs/aaa/PLAN_ROUND3_REFINED_2026-11-13.md)

- **Choose your army in Skirmish:**
  - A "Your faction" picker sits next to Enemy faction; all five armies are playable, each with its own roster and its own building in the build menu.
  - Mirror means your faction, Mixed never includes it, and Meridian is now an enemy choice too.
  - The opening and victory lines name your faction.
  - Training and the campaign stay Meridian.
  - The bots map unit names by slot, so they work for every faction.
- **Terrain rules you can see:**
  - Units in the ford move at 60% speed and can't use abilities (the card and tile say so).
  - Barrage and Burn line can't target a plateau top nobody on your side can see ("Can't see up there").
  - Units deep on a plateau, where no visible enemy stands, show an eye-slash mark, with "Hidden from below" on their card and a one-time hint.
  - Ramps carry red-orange kill-zone stripes, painted into the ground (no extra draws), and red ticks on the minimap.
- **Abilities you discover:**
  - Ready abilities glow, and pulse when they become ready.
  - The first time each ability is ready, a hint names it, says what it does and gives its key.
  - Barrage shows its real blast ring while aiming (red out of reach), a closing ring where shells will land (enemy ones too, when seen), and a falling-shell whistle that ends on impact.
- **Motion-off:** Eco quality, combat motion off or the system's reduced-motion setting stop every decorative CSS animation (`:root.motion-off`). Phones start in Eco.
- **Recorded music player:**
  - Tracks are decoded and loop at exact points, with crossfades.
  - Nothing is downloaded before the first tap, and files are cached on first play.
  - A Settings choice: Recorded + adaptive / Adaptive only / Off.
  - The adaptive in-code score keeps playing in battle.
  - The tracks themselves ship in 0.16.1.
- **Balance:**
  - The ford slow-down made river missions slightly easier: every target still holds; m02, m11 and m12 now reach gold at Normal.
  - The faction round robin moved within noise: Meridian 65, Ashfall 42, Sunward 35, Wardens 71, Veil 38%.
- **Validation:** 459 unit tests; all browser suites, including the new `test:abilities` and `test:music`.

## 0.15.1: research, crossings and high ground read clearly (owner reports)

- **Research panel:** research is one slot that moves forward: "Research · Pick 1 of 2" opens Damage +10% or Armor +12% (the header says the pick is for this match), then "Researching 37%" with a bar, then "Damage +10% ✓" with the next step under it, then "Damage +19% ✓ Active". A finished research never shows a price again. Locked tiles say what they need ("Needs Foundry L2"); the building-level button reads "Upgrade to L2". Phones no longer hide a fifth tile. Rules unchanged (`src/research-tiles.js`).
- **River crossings:** the middle crossing is a ford and now looks like one: a gravel bar with riffles, marker posts, cairns and stones (one merged mesh). Roads lead only to crossings; the minimap marks the two bridges and the ford; hovering (or tapping on a phone) a crossing names it. The campaign text had the crossings swapped (it called the middle one a bridge): missions 2, 5, 11 and 12 now say centre ford and west/east bridges, in English and Vietnamese.
- **High ground:** units on a plateau top show a gold ▲; the card reads "High ground: +2 m range, +20% damage, +3 m sight"; a selected unit there shows its extended reach; downhill hits flare gold; a one-time hint and a Field guide section explain it. Measured with the new `tools/high-ground-bench.mjs`: the high side wins 161 of 162 equal fights (HP-weighted 72% against 50% on flat ground), so the numbers are unchanged.
- Validation: 426 unit tests, all browser suites, `npm run check:missions` (all targets; Veteran m12 is the recorded exception). Draw calls +1 (the ford mesh).

## 0.15.0: enemy AI that attacks well (improvement plan item 5)

- The AI gathers each wave at a rally point and marches when it clearly outweighs the defence it has seen (fog-fair memory), or after a wait so it never turtles. Losing waves fall back and regroup; units below 35% health pull back to a healer or home; ranged units focus artillery, Harvesters and support first without flipping targets; some waves send a fast second group to an expansion, the Harvesters or a flank (`src/sim/ai-attack.js`).
- Faction styles: Ashfall rushes, Wardens wait for better odds and give ground early, Veil breaks off sooner and flanks, Sunward raids Harvesters.
- Applies to Normal and Fast skirmish and to Standard and Veteran missions; Relaxed skirmish and Story missions keep the previous AI unchanged.
- Balance (docs/BALANCE.md): AI round robin Meridian 58, Ashfall 58, Sunward 38, Wardens 71, Veil 25% (was 52/17/48/98/35); the 35-65% target is met for 4 of 10 pairs. Mission targets still hold at every difficulty; Veteran mission 10 is now winnable.
- Validation: unit tests (new `tests/ai-attack.test.js`), all browser suites, `npm run check:missions` per difficulty.

## 0.14.0: improvement round 1 (plan docs/aaa/IMPROVEMENT_PLAN_2026-11-13.md)

- **Readable messages:** alerts ("Under attack!", "Enemy attack incoming!", points lost, raid warnings) keep the message line for their full time; hints and routine notices wait instead of covering them (`src/message-queue.js`). On phones, hints are a thin two-line strip outside the middle of the battlefield and leave after 4 s.
- **Height you can see:** plateaus have lit rock cliff faces, a bright lip and a foot shadow; ramps are roads with uphill chevrons (`src/plateau-relief.js`, merged into the ground mesh, no extra draws). The camera looks down about 46° instead of 52° and starts a little closer. Highlands are warm peat, moss and granite instead of purple.
- **Battles that feel big:** tank, artillery, rocket and Barrage hits have a flash, fireball, bouncing debris and fading scorch marks; damaged buildings smoke below half health and burn below a quarter; destroyed buildings collapse in a series of blasts and dust; units flash briefly when hit (per-instance tint, no extra draws).
- **Sound that has weight (all made in code):** layered explosions sized by what blew up, a voice for each weapon class with faction pitch, a quiet engine hum, radio replies to orders and first enemy contact, battle music with a combat layer that follows the fighting, distance-based volume, music ducking on big blasts, a 24-voice cap and a limiter. Nobody has listened yet: see the listen checklist in docs/aaa/IMPLEMENTATION_PROGRESS.md.
- Validation: 406 unit tests; all browser suites, new `test:messages`; draw calls unchanged in render-budget and boundary-fx.

## 0.13.2: escort and travel destinations are marked (owner report)

- The place an escort or a "reach" objective must get to (for example the forest relay in mission 5) was only named in the objective text. It now shows as a pulsing gold ring with a beam of light on the map, visible through fog, and as a gold ring on the minimap, until that objective is done. Hidden objectives stay unmarked until revealed.
- Validation: 379 unit tests (new `tests/mission-destinations.test.js`); the campaign suite checks the mission 5 marker.

## 0.13.1: shots that land, wrecks that look dead (owner reports)

- **Shots looked like misses:** a round takes 0.14 to 0.32 s to fly but was drawn to where the target stood when it fired, so a moving target was already gone when it arrived. Rounds now lead the target by its speed (up to 3 m). On plateau maps the tracer flew at the shooter's height and passed over or under a target on different ground; it now flies between the real heights.
- **Firing you could not see:** a shot was drawn only when every metre of its path was in view, so an enemy firing from fog (or a shot over a hidden plateau top) hit your unit with nothing drawn, and your own unit rocked without a tracer. Now the end you can see is shown: the muzzle flash when only the shooter is in view, the hit landing when only the target is; the path through fog stays hidden.
- **Wrecks:** a destroyed vehicle or building is tinted burnt and its lights go out, and vehicle wrecks smoke until they sink. The tint is per instance in the existing batches, so wrecks add no draw calls. Wrecks on a plateau stay at plateau height.
- Validation: 377 unit tests (new `tests/shot-aim.test.js`); visual-combat, boundary-fx, render-budget, terrain, feel, activity, auto-combat, ambient-life and model-loading suites pass.

## 0.13.0: high ground and straight walls (Stage 3, package 3.1 and the owner's wall request)

- **Plateaus:** Amber Dunes, Verdant Crossing and Obsidian Highlands each have a pair of raised plateaus (2.4 m high, mirrored for fairness) reached by two ramps. Cliffs block movement and building; ramps are drawn as road. Units, effects, shells, fog and scenery follow the ground, and taps and clicks land on the raised ground.
- **High ground matters:** a unit or tower on a plateau firing down gets +2 m range and +20% damage; firing up from below deals 15% less. From below, a plateau top more than 5 m inside its rim stays hidden unless one of your units stands on it; a unit on top sees 3 m further. Numbers in `balance.json` `terrain`.
- **Straight walls** (owner request): maps can have horizontal or vertical concrete wall lines (`walls` in `maps.json`), each made of breakable 2 m pieces, so armies can blast a gap. Dunes, Verdant Crossing and Highlands have them.
- **Readable on phones:** each plateau has a dark rock rim, a lighter top and road-coloured ramps painted into the ground texture, so it reads without shadows (Eco) at no draw cost.
- Maps without plateaus or walls (Ashen Frontier, Riverlands, Copper Basin, Frontier Expanse) play exactly as before; the recorded state hash is unchanged.
- 0.12.1 did not reach the site: GitHub's Pages deploy step failed to find the uploaded build (CI tests had passed). This release deploys both.
- Validation: 375 unit tests (new `tests/terrain-height.test.js`), all 38 browser suites (new `npm run test:terrain`, three viewports, in the CI visuals group). Mission checks: Standard and Story meet every target on the new maps; Veteran unchanged (mission 10 exception; mission 12 runs longer than the checker's 4-minute limit on this machine and lost when played out directly).

## 0.12.1: campaign on faction rosters, one-minute holds, lighter factions, optional screen shake

- **The campaign's enemies now field their own faction's units** (owner decision, 2026-11-12). Every mission has `rules.rosters: true`: Ashfall sends Scrappers and Scorchers, Sunward Riders and Supply wagons, the Wardens drones and Walkers, the Veil Shades and Watchers. The story now says each faction prints the Builder patterns its own way (mission 2's debrief, two lines that named Breakers and Battle tanks on the enemy side, `story/world.js`). The two scripted Breaker batteries (missions 7 and 9) stay Breakers through a new `exact: true` spawn flag. Briefings name each faction's special units the first time you meet them (missions 1, 4 and 10).
- **Hold objectives last one minute** (owner request), and a hold is won as soon as the points are yours and no enemy fighter is left anywhere to contest them. Mission 1 can now end after about two and a half minutes.
- **Screen shake only for the biggest moments** (a Command core falling, a Barrage landing), and a new **Screen shake** switch in Settings turns it off. Ordinary shells and buildings no longer shake the camera.
- **Fewer draw calls for every army:** within each rigid part of a model, the plain painted pieces are merged into one mesh that carries each piece's colour, roughness and metalness per vertex (`bakeFinishes` in `src/view.js`). The picture is unchanged (compared side by side with 0.12.0). Phone battle (390x844, Eco): mirror 122 → 106 draws; three rivals 148 → 132; three different factions 206 → 168. Desktop base view 172 → 140. The render-budget limits were tightened to match.
- **Balance:** faction AIs gather their wave at a rally point before marching. Veil no longer deals less damage, Shades cost 100/15, Scrapper damage 10 → 11, Sentinel drone HP 60 → 50, Wardens self-repair 2% → 1.5% per second, the Wardens AI builds one extra tower instead of two. Round robin at Normal: Meridian 58, Ashfall 21, Sunward 50, Wardens 100, Veil 21%; the 40 to 60% target is still not met (docs/BALANCE.md explains why). Against the test bot at Normal (standard build): Ashfall 33%, Sunward 67%, Wardens 25%, Veil 100% player wins.
- **Mission checks:** Standard and Story meet every target. Mission 2 was retuned three times for the Ashfall roster (more Scrappers and Rangers in the camp) and its window now starts at 6:00; mission 1's window starts at 2:00 because of the one-minute hold. Veteran: 10 of 12 missions won by the objective bot (the target); mission 10 as before, and mission 12 now loses to the Wardens' Walkers. Heavy machines in scaled waves round to the nearest whole unit instead of up, which fixed Veteran missions 9 and 11.
- **Fix:** a unit whose model has not downloaded yet (for example offline, in a mission that needs a faction model not yet cached) is no longer drawn from a missing template, which threw an error; it appears once its model arrives.
- Validation: 369 unit tests, all 37 browser suites locally, mission checks as above.


## 0.12.0: four enemy factions in Skirmish (packages 2.3 to 2.6)

- **Skirmish has an "Enemy faction" choice:** Mirror (the old behaviour, still the default), Ashfall Combine, Sunward Caravan, The Wardens, Veil Survey, or Mixed (each rival a different faction, starting from one picked by the map). Rivals wear their faction's colour and emblem, and their models download only when a faction is chosen.
- **Each faction fights differently.** Ashfall: cheap Scrappers, flame Scorchers that burn the ground and double their damage on buildings, a Salvage yard that pays for wrecks, and an early rush. Sunward: fast Riders, a Supply wagon that heals everything and adds supply, a Waystation that triples shield recharge, quicker on roads and sand, and raids on Harvesters before each wave. Wardens: Sentinel drones that are half shield, a slow long-range Walker that can brace for more reach, Shield pylons, self-repairing units, no Medics, and a patient, fortified AI. Veil: cloaked Shades, long-sighted Watchers that mark a target for 25% more damage, a Veil relay that hides units near it, more sight and slightly less damage, and an AI that falls back when outnumbered. Numbers and measurements: docs/BALANCE.md.
- **Hidden units obey the fog rules:** a cloaked unit is not drawn, listed, targeted or heard until a unit within 4 m or a tower or Command core within 9 m reveals it, or it strikes. Splash and burning ground still hurt it. The first ambush shows a one-time hint.
- **Naming the enemy:** the hover label now adds the faction ("Scrapper · Ashfall · ENEMY"). On touch, where nothing hovers, a tap on an enemy with nothing selected shows the same line. (Enemy units have never been selectable, so the "enemy info panel" added in 0.11.0-alpha.1 could not be reached.)
- **Campaign:** Sol's troops in mission 9 are Riders, and the player's Barracks can train Riders from the link-up in mission 9 through mission 12. The campaign's enemies stay on the base roster: the story says every faction prints the same patterns, so switching them is a story decision (docs/MISSIONS.md). The planned Walker gift in mission 12 was dropped.
- **Balance, stated plainly:** the round-robin target (every faction between 40 and 60%) is not met after five tuning passes: Meridian 63, Ashfall 15, Sunward 56, Wardens 96, Veil 21%. Against the test bot at Normal, Ashfall is as hard as the mirror opponent, the Wardens harder, Sunward and Veil easier.
- **Field guide** lists all 16 units and 9 buildings; all new text is translated to Vietnamese.
- **First-visit download:** 1297260 bytes gzipped until the start screen is usable, against 1287022 at 0.9.4 (+10238 bytes, +0.8%, script only; the boot models are unchanged at 14 files and 2951916 bytes).
- **Unchanged for existing play:** an all-Meridian match has the same state hash as before (d071360b after 60 s), old saves load, and Mirror skirmishes and Training are untouched.
- Validation: 368 unit tests; mission bot checks meet every target at Standard and Story; at Veteran one target is missed, the same mission 10 exception recorded in Stage 1 (the objective bot is defeated at 648 s). All 37 browser suites pass locally (three viewports where they apply), including the new factions suite. Phone render budget: the mirror battle is unchanged at 122 draw calls and 281045 triangles; a battle against three different factions draws 206 calls against 148 for three mirror rivals (more unit types on screen means more batches) and its render CPU time is about 20 to 25% higher (7.6 against 6.1 ms median in 390x844 emulation), which misses the 10% line of package 2.6. Triangles are 9% lower. Follow-up: bake the faction unit materials into vertex colour to cut about eight draws per unit type.
- Tools: `npm run bench:factions`, `tools/faction-matrix.mjs`, `tools/first-visit.mjs`, `ROSTERS=1 npm run check:missions`. CI: the browser install step retries.

## 0.11.0-alpha.3: approved faction portraits (package 2.2)

- Owner approved all four faction looks on 2026-11-11. Recorded approval in the review packet, model manifest and reproducible generator.
- Appended twelve portraits after the original thirteen entries; regenerated the 768x1344 atlas and team-paint mask, with matching CSS row coordinates. The renderer computes row count from its roster and cleans temporary renders automatically.
- Added checks that every atlas and mask cell contains visible pixels at desktop, portrait-phone and landscape-phone sizes, that Blender and runtime orders agree, and that legacy positions stay unchanged. CI includes the new portrait suite.
- Art files total 154290 bytes (previously 79858; +74432). The Stage 2 first-visit download budget still needs checking and optimization before the exit gate.
- Validation: 353 unit tests, build, portraits (three viewports), UI quality (four viewports) and render-budget all pass locally. Phone emulation: 122 calls, 281045 triangles, median CPU 6.0 ms (previous 5.8), p95 7.1 ms (previous 6.6), zero idle GPU uploads. No simulation/mission data changed, so the mission bench was not rerun.
- Faction gameplay remains package 2.3 onward; no rules or mission outcomes change in this art-only update. Previous framework CI and deployment are green.

## 0.11.0-alpha.2: faction model candidates (package 2.2, approval pending)

- Generated twelve original faction GLBs and a Blender source library. Manifest records exact topology counts and per-type budgets; every candidate passes geometry attributes, materials, rig names and quantization checks.
- Added reproducible `generate_assets.py -- --factions` and eight labeled review sheets (four faction colors plus greyscale) in aaa/review/. Existing base regeneration preserves faction manifest entries.
- Review rendering now fits all projected bounds and labels below the silhouettes; this corrects clipping in wide sheets and removes label shadows on the models.
- Loader retains the Drone hover marker. Cosmetic hover phase honors pause, reduced motion, combat-motion preference and Eco. New repeated faction units have no shadow pass.
- Superseded roster downloads no longer change the current progress/Retry state. Only the current loading request can finish startup or update readiness.
- Candidates are not connected to live rosters or portraits. Package 2.2 explicitly requires owner approval before that integration.
- Local validation: all 352 unit tests and 36 browser scripts pass. The final loading guards were also checked after rebuilding (model-loading, new-game and offline). All 36 standard mission bot outcomes/times exactly match Stage 1. New CI is pending the push.
- Phone render budget stays at 122 draws and 281045 triangles; median CPU render time is 5.8 ms (previous verified 5.9 ms), p95 6.6 ms, zero idle GPU uploads. Measurements are 390x844 emulation on the same PC, not a physical phone.
- CI partitions the slow layout job into status, desktop/tablet and mobile jobs while preserving every existing viewport and assertion. Invalid layout selections now fail explicitly.

## 0.11.0-alpha.1: faction rules framework (package 2.1)

- Unit counters now target classes; all recorded base damage matchups remain unchanged. The pre-framework default 60-second simulation hash remains d071360b, including after save/load.
- Faction slot lookup, resolved training lists, roster-restricted training/construction, opt-in mission rosters and saved factions are implemented. Default all-Meridian state is omitted from snapshots and reconstructed on load to preserve legacy hashes.
- AI composition and mission spawns/counts resolve slots. Trait hooks are deterministic and inert until each faction's gameplay package defines its behavior.
- Command cards, guide production lists, counter hints and enemy details read rosters/classes. Shared faction names moved from the story catalog to the interface catalog with their original Vietnamese translations.
- New faction definitions and gameplay are not enabled before the model approval step. Framework tests supply isolated definitions to verify foreign-roster rejection and persistence.
- Complete unit suite passes (352 with candidate-asset checks); final browser sweep and CI tracked separately.

## 0.10.0-alpha.4: Stage 1 implementation (local validation in progress)

- Package 1.1: deterministic distance-attenuated camera shake, render-only hit-stop, 80 ms ring/vitals flashes, projected unit readability, directed infantry falls, and 20 s vehicle wrecks (8 s Eco), capped at 24 oldest-first. Camera transforms are restored immediately after drawing. Motion preferences and mission camera cues suppress shake and hit-stop. Unit materials remain shared: ring/vitals flash is the explicitly permitted fallback because batches currently store transforms only.
- At 390x844 the Engineer needed scale 1.00885 to reach 28 px; the other seven unit types already pass. The browser assertion allows 1e-9 px arithmetic roundoff (the initial projection returned 27.999999999999993).
- Presentation-only death direction and Barrage victim coordinates were added to existing events; simulation timing and damage are unchanged by feedback.
- Package 1.2: saved Story/Standard/Veteran choice, translated selector and debrief, highest difficulty in campaign progress, and Veteran clear marks. Legacy progress defaults to Standard; medals and best times remain independent. Benchmark tooling accepts `--difficulty`. Mission-specific `hpByDifficulty` setup data tunes the Story escort and late Veteran objectives without changing Standard.
- Package 1.3: reproducible 48-game ladder (three maps, four attack thresholds, four speeds), reporting win rates and median duration. Skirmish pace overrides preserve campaign tempo. Full results are in BALANCE.md. The requested Normal/Fast/Relentless win-rate ranges remain unmet after regression-safe tuning; only Relaxed meets its target.
- Package 1.4: three-identical-effects/80 ms ceiling, 4 dB combat music duck after more than six audible combat effects in one second, seeded +/-4% pitch, research completion cue, and seven keyboard/touch sound-preview buttons. Preview works while settings pause gameplay.
- Existing progress-shape assertions now require the new difficulty field. The new time-limit fixture uses an independent required objective and an active optional deadline, matching real missions; it asserts victory and both difficulty-specific outcomes. No failure assertions were removed.

Phone render benchmark (390x844, Eco, 4x CPU throttle, RTX 4080 SUPER; emulation, not a real phone):

| Metric | Before | After feedback |
|---|---:|---:|
| Draw calls | 122 | 122 |
| Triangles | 281045 | 281045 |
| CPU render median ms | 5.8 | 5.9 |
| CPU render p95 ms | 8.6 | 6.6 |
| Stationary GPU buffer uploads | 0 | 0 |

The 0.1 ms median difference is not evidence of real-phone equivalence. Draw counts, triangles, transform counts and idle upload budgets are unchanged; physical-device timing remains unverified.

Offline sound cues at default gain (linear peak, RMS dBFS; RMS is not LUFS):

| Cue | Peak | RMS dBFS |
|---|---:|---:|
| Unit ready | 0.117 | -44.9 |
| Research done | 0.126 | -42.1 |
| Building lost | 0.238 | -30.0 |
| Objective done | 0.181 | -38.9 |
| Objective failed | 0.172 | -38.6 |
| Mission won | 0.239 | -34.0 |
| Mission lost | 0.349 | -31.7 |

All offline sanity checks passed; no cue clips. Listening quality needs the owner. Story wins 12/12, Standard meets its original targets, Veteran wins 11/12. Veteran mission 10 remains a strict-check failure after three tuning passes. The boundary-effects test now requires a vehicle wreck at 3.3 seconds and zero wrecks after 21.7 seconds, replacing its obsolete 3.3-second cleanup deadline. CI, deployment and real-device reviews have not been performed. See aaa/IMPLEMENTATION_PROGRESS.md for current validation and outstanding packages.


## 0.9.4: faction emblems and research tier II

Faction emblems (story missions)
- Every building floats a small glyph in its team colour: Meridian's ring and line for you, and for each enemy the glyph from src/story/world.js (Ashfall spark over bars, Sunward half sun over a wheel, Veil book and eye, Wardens triangle of circles). One texture per faction and one sprite material per team, so it costs one extra draw per building and nothing in skirmish. The glyph hides when the building starts to fall and follows colour changes.

Research tier II
- Overcharged weapons II (+8% more damage, 250 alloy and 180 energy) and Reinforced plating II (a further 8% less damage taken, 200 alloy and 250 energy). Each needs its own first tier and a level 2 Foundry, so the either/or choice carries on into the second tier. They appear beside the chosen first-tier tile in the Foundry card.
- Skirmish AIs that counter-build take the second tier of their branch once their Foundry is level 2; missions are unchanged (check:missions untouched).
- Old saves load as before (the new flags default to off). Vietnamese strings added.

Tried and dropped: meshopt-compressing the 13 unit and building models. Gzip already shrinks them to about 855 KB; meshopt with quantisation reached 540 KB but the batched renderer drew the quantised models distorted, and the safe setting only reached about 600 KB while losing vertex colours on some parts. A 250 KB saving was not worth a changed look.

## 0.9.0: interface

Training
- Bug fixed (CI only, phone landscape): a new lesson could open its card under the finger, and on a slow machine the click that ended the tap was hit-tested after the card had appeared, landed on "Focus target" and folded the card away. A click on the card buttons now counts only when its pointer-down began on the same button (keyboard clicks always count). The panel also moves (across, to the bottom of the battlefield, or to the opposite corner) whenever the lesson target would sit under it; before, in phone portrait and landscape it could cover the target.
- tests/tutorial.mjs is strict again (the "stayed collapsed" workaround is gone); tests/ui-extras.mjs forces the stray click and fails on the old code.

Idle units
- New key `,` selects the next idle army unit and centres the camera on it (F1 and `.` still cycle idle Harvesters). The empty dock lists both with their counts; phones get two 44 px buttons that appear only while something is idle (in the landscape rail, floating at the right edge in portrait). Listed in the help.

Minimap
- Dragging the minimap moves the camera. Double-tap, double-click or Alt-click sends your own ping (cool colour, two ripples, fades in 2.5 s, client-only, the simulation never sees it); right-click pings when nothing is selected and still gives orders when something is. Your buildings or units being hit raise an "Under attack!" toast and a minimap ping (at most one per ten seconds of play).

In-fight hints
- When your army and a visible, on-screen enemy unit type meet, a small non-blocking hint says which of your types counters it or is countered by it (from balance.json `counter` and `mechanical_bonus`). Once per enemy type per match, dismissible, auto-hides after 9 s, never in Training.

Core beat
- The match-ending Command core death now holds the result for 1.5 s: the camera moves to the core and the effects play at 30% speed, then the result screen. Presentation only: the simulation has already finished, so replays and hashes are unchanged. Skipped with reduced motion and in Training. The `death` event gained `core: true` for this.

Tests
- tests/ui-extras.mjs (`npm run test:ui-extras`, CI group ui-extras): the six items above on 1440x900, 390x844 and 844x390, plus a notch test that sets 44 px safe-area insets through the browser (`Emulation.setSafeAreaInsetsOverride`; custom-property fallback) and checks no control, resource, minimap, toast or card sits under them (portrait: top and bottom, landscape: all four edges).

## 0.9.1: rules

AI
- Normal and faster AIs now compose their army against what they have seen: they remember the enemy fighters, towers and cores that were in their vision (nothing from the fog; forgotten when seen dead) and counter them. Mostly vehicles: Anti-tank soldiers (Level 2 Barracks) up to half the seen vehicles, else Rangers. Mostly infantry: Rangers, and Breakers from the Foundry. Two or more towers: Breakers. Relaxed stays simple.
- Surplus is used: a rich AI (500+ alloy) builds a third Barracks and extra towers, keeps more supply headroom (10 instead of 5) so a destroyed Supply relay is rebuilt sooner, and picks a research branch by role (siege: plating, others: weapons).
- Badly hurt fighters (under 35% health) fall back to a Medic when the AI has one and rejoin at 70%.
- Bug fixed (found by the new soak test): the expansion scout was re-picked on every think, so up to half the Harvesters walked off mining while a second core site was unexplored. One scout every 25 s now. Normal AI on Highlands no longer beats the bench bot by waiting out its economy.
- tests/ai-soak.test.js: eight matches of ten sim-minutes (1 to 3 rivals, every speed, FFA and coalition, no human): every AI keeps 70% of its Harvesters busy, spends (alloy under 900), grows an army and never stalls on a full queue.

Research
- Overcharged weapons and Reinforced plating are now exclusive branches of the Foundry research: one per team. The old "needs weapons first" rule is gone. A save from 0.7.0 that holds both keeps both.
- Card: the Foundry still shows four tiles. The research tile reads "Research / Choose one" and opens a sheet with Weapons +, Plating and Back; once one is chosen the slot shows it and the other is locked (message and tooltip say so).

Energy
- Energy sinks documented in docs/BALANCE.md (units, the research branch, building levels).

## 0.9.2: loading

Startup
- Measured on a phone profile (390x844, Fast 3G 1.6 Mbit/s with 562 ms latency, CPU 4x, cold cache, median of 5): before, 3.36 MB over the wire (JS 328 kB, models 2.95 MB), start screen drawn at 3.7 s, Start enabled at 19.2 s, first match frame 0.38 s after tapping Start. After, 3.35 MB (JS 311 kB), 4.0 s, 19.7 s, 0.47 s: within run-to-run noise, because 88% of the bytes are the 14 .glb models and the link is the limit. Smaller models (meshopt or Draco compression, owned by the art work) are the only way to move that number; the service worker below makes every later visit instant.
- The main chunk is 437 kB (144 kB gzip, was 507 kB / 167 kB): the Vietnamese catalogue (69 kB, 23 kB gzip) is its own chunk fetched when Vietnamese is first shown, and the sound engine (audio.js, sfx.js) is its own chunk fetched on the first tap. three stays its own chunk. The campaign story data, the mission, settings and tactics interfaces, scatter and the map edge stay in the main chunk: each is built synchronously for the start screen's preview match or the setup of the HUD, so deferring them would add a visible pop-in for no earlier start screen.
- index.html carries a small inline splash that paints with the HTML, before any script runs.
- Real load progress: the Start button shows "Loading terrain... 34%" (stage name, byte-true percent, a fill behind the label). Files are fetched in order (terrain, headquarters, harvester, then the rest) six at a time and handed to three.js' own cache, so WorldView.loadModels parses them without downloading again; failures fall back to its own retries. Start still stays disabled until every model is parsed.

Offline
- New service worker (tools/sw.template.js, published as sw.js by vite.config.js with the build's file list and hashes): the app files are precached per build (fc-shell-<build>), models are cached cache-first (fc-models-<hash of the model files>), pages go network first with the cached copy only when offline. A new worker waits (no skipWaiting), so an open match keeps its files; a small "A new version is ready" notice appears and the new version runs the next time the game is opened, which also deletes the old caches. Works under /3d_astra/. Not registered in development or under ?test (add ?sw to opt in).
- tests/offline.mjs (npm run test:offline, DIST_DIR=<build>): first visit, offline reload shows a ready start screen, a new build waits beside the old one and replaces it when the game is reopened.

Text
- tests/i18n-coverage.test.js scans the UI source for visible English strings (templates, titles, aria-labels, notices, textContent) and fails when one has no Vietnamese entry. It found ten help-dialog rows; they are translated now. In development builds (or with ?i18nwarn) untranslated text reaching the screen in Vietnamese is listed once in the console; never in production.

Screens
- The start screen modes (Training, Skirmish, Campaign) are states of the screen machine (S.playMode now reads and writes Screens.mode) and the campaign mission briefing is a fourth state that opens only from Campaign; illegal moves are recorded like screen moves. Unit tests cover the legal transitions.

Tests
- tests/lib/harness.mjs (launch, three standard viewports, page factory with error capture, ?test URL helper, screenshots, timeouts, PASS/FAIL line with time); browser, hotkeys and language use it, behaviour unchanged. CI writes each suite's result and time to the job summary.

## 0.9.3: art

Models
- The battle tank and the Breaker have a separate turret (`Turret_head*` parts plus a `Turret_pivot` empty in the GLB); the barrel stays its own recoil part inside it. Same triangle counts as before.
- The view turns the turret toward its target (3 rad/s, shortest way, snaps with reduced motion or combat motion off) while the hull keeps its heading; recoil is along the barrel. Towers behave as before.
- Tests: tests/assets.test.js checks the pivot, turret head and barrel on both vehicles.

Portraits
- The seven story busts (Commander, Vale, Okoro, Hale, Sol, Maren, ECHO) are Blender renders (`tools/blender/render_cast_portraits.py`, `tools/portraits_to_webp.py`): 256 px webp, 4-6 KB each, one lighting rig, faction-colour halo. Commander and ECHO stay faceless. The SVG drawings remain as the fallback.
- tests/missions.mjs accepts an img as well as an svg portrait.

Cost: a 60-unit battle draws about 9 more calls (battle-eco 113 -> 122) for the extra turret batches; triangles unchanged.

## 0.2.0: rebuild phase 0

Rules
- Idle fighters guard the spot they were left on: they answer whoever shoots them, chase enemies they can see within a short leash, then walk back. Patrols answer fire too.
- The AI now fields vehicles and researches Overcharged weapons (its Barracks used to starve the Foundry of alloy).
- A team whose only Command core is still under construction has 90 seconds to finish it.
- Cancelling a damaged construction site refunds less; an unfinished site sees only its own footprint.
- Area weapons reach the edge of large buildings.
- One unarmed enemy building near an AI base no longer recalls its whole army.
- Relaxed AI attacks later (first wave at 210 s, then every 90 s).
- Attack waves raise an "incoming" warning for the defender.
- Harvesters can be sent to work in one call (`assignHarvesters`), used at match start.

## 0.3.0: rebuild phase A (rules core)

No visible change to play; this is groundwork for saves, missions and deeper combat.

- Every player action goes through one command door (`sim.command`) that checks ownership and logs the command with its tick.
- Matches can be saved and loaded (`sim.serialize()`, `Simulation.load()`), with a version number and a state hash.
- A match replays exactly from its options and command log.
- The rules step is about five times faster on the largest map with three AIs (average 7.0 ms to 1.3 ms; spikes of about 300 ms to under 30 ms): square-root distances, obstacle buckets, reused route buffers, six route searches per step, one AI thinking per step.
- The 1,400-line rules file is split into systems under `src/sim/` (vision, orders, movement, combat, economy, AI).

## 0.4.0: campaign, tactics and balance

Campaign
- Twelve story missions in three acts replace the old six-stage ladder: mission list with medals, briefings, in-match dialogue with portraits, objectives with progress, capture points, a debrief screen.
- Missions are data (`src/story/missions.js`, format in `docs/MISSIONS.md`): setup, objectives, lose conditions, triggers, waves, medals. The story bible is `docs/WORLD.md`.
- The match autosaves; the menu offers Continue.
- A test bot plays every mission through the command door (`npm run check:missions`); each mission must be survivable when idle and winnable by the objective bot.

Rules
- Units earn up to three ranks from kills (8% damage and health each).
- Stances: guard, hold, aggressive.
- Seven unit abilities (Shield wall, Focus fire, Barrage, Overdrive, Lock-on, Triage, Field repair); the AI uses them, the player can switch on auto-cast.
- Interface for these: ability tiles with cooldowns (E / T / Y), a stance switch ([ ] \), Barrage aiming with a range ring, rank chevrons, promotion and ability effects, and an auto-cast setting (on by default on touch devices).
- A deposit takes three Harvesters; a core or relay supports two towers; Breakers out-range towers against buildings; battle tanks are tougher and take 3 population.
- The AI army grows on a curve per speed instead of arriving at full size.
- Tagged mission entities are left alone by the AI and by automatic harvesting.

Known limits
- Story text is English only for now.
- Destroying an enemy core also removes that side's tagged buildings, so a "destroy the siphons" objective can be finished that way.

## 0.8.1: the computer opponent

- Mission 1: the enemy camp now harvests, builds and trains (it used to stand still with 450 alloy and four idle Harvesters). It defends but never marches by itself; the scripted waves still come on the clock (`rules.ai: "home"`, see MISSIONS.md).
- Skirmish: a rival with 600 or more alloy in the bank trains past its army curve instead of sitting on the pile (relaxed rivals banked over 1,300 alloy by minute four).
- New tests in `tests/ai-economy.test.js`: every speed harvests, builds and trains; no alloy hoarding; mission 1 camp works but does not march.

## 0.8.0: structure

No visible change; the client is easier to work in.

- `src/main.js` (2,389 lines, one closure with about 50 shared variables) is now a 153-line composition root plus 19 modules under `src/app/`: state, screens, shell, HUD, preferences, sound, selection, orders, abilities, command card, pointer and keyboard input, minimap, modals, briefing, match flow, frame loop and test hooks.
- The app flow is an explicit screen-state machine (`src/app/screens.js`): `menu`, `playing`, `held`, `pause`, `help`, `result`, `graphics`, `fullscreen`, `guide`, `settings`. `started`, `paused` and the dialog flag are no longer assigned all over the code; screens change through `begin`, `toMenu`, `open`, `close`, `dismiss`, `hold` / `release` and `snapshot` / `restore`. A unit test checks the legal-move table and every transition.
- Shared mutable state is one object (`S`); modules reach one another through a registry (`A`), so there are no import cycles. `window.__frontier`, DOM ids and classes, listener order, event order and match hashes are unchanged (checked by a before/after DOM and listener snapshot across start, play, pause and help).
- Source-text tests now read the module that owns each behaviour (`tests/lib/client-source.js`): `client-2026-11`, `review-2026-10-02`, `review-2026-10b-00`, `review-2026-10b-01`, `review-2026-10d-02`, `review-2026-10d-07`.
- Bundle: main chunk 493.3 kB to 507.3 kB (gzip 164.7 kB to 167.3 kB); the growth is the `S.`, `A.` and `Z.` property accesses that a minifier cannot shorten. Draw calls are unchanged (`test:render-budget`).

## 0.7.0: rebuild phase C (rules depth)

Rules
- Mission fix: when an enemy is eliminated its tagged objects (siphons, conduits, jammers) stay standing, so "destroy the tagged objects" objectives can no longer be won by killing the core.
- Energy sink: a second Foundry research, Reinforced plating (100 alloy / 150 energy, 30 s): combat units take 12% less damage. It follows Overcharged weapons (refused until then) and takes over its slot on the command card once weapons are done, so the card keeps four tiles. Data-only, no model.
- Skirmish capture points: a crossroads at the map centre plus two mirrored ridges (`flank` in maps.json), each paying its owner 0.25 alloy and 0.1 energy per second. Skirmish only (not Training, not story missions). The AI sends a squad of 2 (Relaxed) or 3 units to each of its one or two nearest points and keeps it there.
- AI expansion: from 300 s (Normal), 220 s (Fast) and 160 s (Relentless), once its Command core is level 2 and every home alloy deposit has its miners, the AI saves 400 alloy, sends a Harvester ahead and builds a second Command core near an unclaimed deposit, then trains 4 more Harvesters. Same price and placement rules as the player. Relaxed and story missions do not expand.
- Saves record whether capture points are on (`capturePoints` option); new state: `players[].plating`, `skirmishPoints`, `pointDue`, `pointDuty` on units.

Tools
- `tools/skirmish-bench.mjs` times the PlayBot against the AI per speed and map. The PlayBot now refreshes its known cores and sweeps the map when none is in sight.

## 0.6.0: music, sound and interface

- In-house adaptive music (calm, tense, battle, victory, defeat; per-map key and scale, faction motifs) and about 40 synthesized sound effects with a voice budget and fog rules; separate Music and Effects volume.
- Phone landscape layout: slim top strip, button rail, collapsed objectives chip, one right dock; at least 60% of the screen stays free for the battlefield.
- Desktop HUD is larger at 1440x900 and 1920x1080; the remaining 9 and 10 px texts are fixed.
- New result screens (win, loss, draw) with six stat tiles; the mission debrief has the same tiles and a sticky action bar.
- Shared hover, pressed and disabled states and tooltip look.

## 0.5.0: rebuild phase E (look)

Palette and light
- Every map has its own vivid palette, time of day and light (`src/visual-style.json`): bright morning on the Riverlands, golden hour on the Dunes, green noon in the Verdant Crossing, ember dusk on the Ashen Frontier, late afternoon in the Copper Basin, clear noon on the Expanse, twilight on the Highlands. Warm sun, cool sky fill, warm bounce light.
- Neutral tone mapping instead of ACES, which greyed every colour.
- Fog of war and unexplored ground use each map's own deep colour instead of grey-green.
- Bug fixed: on every map without a river the ground texture was hidden under the old base slab, so those maps showed one flat dark colour.
- Team colours are checked against every ground surface of every map (unit test).

Map dressing
- Seeded dressing per map (`src/scatter.js`): grass, flowers, pebbles, rocks, shrubs, small trees, Builder paving and pillars, and each map's own props (lily pads, cacti and bones, ferns and mushrooms, cinders and dead trees, copper ore, basalt columns and crystal shards). One mesh and one draw per map, no shadows, fewer triangles than the instanced pebbles and grass it replaces. It never blocks movement, stays lower than a unit, keeps out of camps, roads and walls, sinks into the fog of war and is pressed flat under buildings and deposits.
- A real map edge (`src/map-edge.js`): a cliff skirt, the land or sea below fading to the horizon colour, and a waterfall where the river leaves the map.
- Painted ground detail (`src/ground-paint.js`): accent patches, wandering borders, grass dabs, sand ripples, foam along the river banks. The minimap uses the same colours on every map.
- Walls are ruined Builder pylons with a band of Lattice light; water is clear and foam-edged; crystals glow and shimmer.

Units and buildings
- Legs and bob follow the ground actually covered, every shooter rocks back when it fires, finished buildings settle with a bounce, lamps and relays breathe, idle troops breathe at High quality.
- Vitals bars and selection rings keep a readable size on phones.
- All of it stops with reduced motion, the combat-motion setting or the frame governor, as before.

Factions
- In story missions each enemy team wears its faction's colour and glow (Ashfall coral, Sunward gold, Veil violet, Wardens blue), taken from `mission.factions` and `src/story/world.js` (`src/faction-colors.js`). The player's chosen colour always wins a clash.

## 0.1.0

Everything up to 2 November 2026. See the dated review documents for the history.
