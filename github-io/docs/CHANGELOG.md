# Changelog

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
