# Changelog

## 0.21.0: Defence complete (round 3 plan, items 21.1–21.4)

- **Two more crews:** the Tank emplacement (heavy single shots, slow, strong against machines) and the Scorcher flame trap (short range, sets the road on fire; best against swarms on foot).
- **Tier-3 branches:** a gold tower picks one of two upgrades, shown on its tile: Ranger Marksman or Suppressor (slows), Mortar Cluster or Guided, Anti-tank Heavy or Rapid, Watcher Beacon (marked targets take 25% more) or Far-eye, Tank Breacher or Shrapnel, Flame trap Inferno or Firewall.
- **A commander on the field:** a gold-trimmed tank you send down the road with a tap. It holds and blocks the column, calls Barrage and Reinforce (three Vanguards hold the road for 20 s), and comes back 20 s after it falls.
- **Six levels:** Switchback Pass (Wardens), Fordwood (Ashfall with Warden machines, one bridge and the ford), Amber Canyon (Veil shades: Watcher posts matter) and Long Crossing (Veil with hired Sunward riders) join Gorge Road and Twin Bridges; each opens with a star on the one before.
- **Bridges:** on river levels, tap a bridge to blow it (3 s fuse). The columns turn to another crossing; the ford and the last open way across can't be blown. Bridge builders stop at the bank and raise a pontoon in 20 s unless you bring them down.
- **Endless and Daily:** any open level, waves forever from a seed; the score is waves held and your best is kept. The Daily seed is the same for everyone that day.
- **Perks:** stars buy Quartermaster (first tower −20%), Reserves (+2 lives) and Fast guns (faster Barrage). Defence levels only, never the campaign.
- Checks: the bot reaches its stars on all six levels at three difficulties, Endless holds 15+ waves, the wave scene stays at 109 draws on the phone (limit 120).

## 0.16.1: recorded music

- Five original instrumental tracks, made locally with ACE-Step 1.5 (MIT; see `public/music/LICENCE.txt`):
  - title theme (104 bpm, soft bending monochord lead, 55 s loop);
  - campaign and briefing (88 bpm, 44 s loop);
  - Defence between waves (96 bpm, low taiko and marimba, 60 s loop);
  - victory and defeat stings.
- 1.44 MB in total, AAC 64 kbps, -16 LUFS. Loops are cut to whole bars and loop sample-exactly.
- Nothing downloads until the first tap; each track is cached on first play.
- The takes were chosen by measurement (loop seam, beat steadiness, no voice-like sound). The blind listen page with the other shortlisted takes is in the 3D_claudeopus55 repo, `experiments/music-frontier-1113/listen/`; any track can be swapped.

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
