# Changelog

## Unreleased: Round A.2

### Vietnamese story voices (phase 2)
- With the game language set to Tiếng Việt, every voiced story line of the campaign and the Chronicles now speaks Vietnamese, saying the same words as the dialogue box (src/locales/story-vi.json). Made locally with VieNeu-TTS v3 Turbo preset voices (Apache-2.0), each person in a fitting voice of their own gender (tools/voices/vi-cast.json `story`); the faction voices are reused for Okoro (Hải Đăng), Hale (Xuân Vĩnh) and Maren (Đoan Trang). Same chain, loudness and MP3 settings as the English story packs (mono 24 kHz 32 kbps), one pack per mission like English (public/voices/vi/story-*.mp3), fetched only after Start for the mission being played. A Vietnamese pack that fails to load falls back to the English story pack. Korean keeps English audio with its text.

### Faction-unique models rebuilt (visual round V, W5 unique models)
- The twelve models only one faction fields now have the shared kit's finish, each in its faction's own look, so a faction reads by shape whatever colour its side wears. **Ashfall**: the Scrapper (a hunched brawler in a gas mask with lit amber goggles, a spiked salvage pauldron, a boiler pack with twin stacks, a drum-fed scattergun and a hook on a chain), the Scorcher (a tracked flame tank with a hazard-striped spiked ram, riveted mismatched skirts, a striped fuel tank with tall stacks and a caged nozzle) and the Salvage yard (a welded shed under a sawtooth roof, a hazard crane with its hook over crushed scrap, tyres and drums). **Sunward**: the Rider (a sand bike on open spoked wheels, a rider in a duster and a wide-brim hat with a streaming scarf, a solar fan and a pennant), the Supply wagon (now a Breaker-size covered wagon: hooped canvas with red crosses, a driver, brass kegs, a solar fan) and the Waystation (a rounded adobe trading post under a brass dome, a striped market awning, banners and a solar fan). **Wardens**: the Sentinel drone (a ceramic seed in two shells with a glowing seam, one big lens eye, a floating halo carrying folded petal shields), the Walker (a ceramic beetle carapace on segmented legs with claw feet, a floating halo, team tower shields on its cannon pods) and the Pylon (a ceramic spire with floating rings and one eye). **Veil**: the Shade and the Watcher (deep hoods in the side's colour with a lit seer lens in a dark cowl, plum robes and long tattered cloaks with silver piping, crystal blades and a crystal spire, a seer monocle and a folded-fin rail rifle) and the Veil relay (a narrow spire with folded fins and a crystal crown on a charcoal plinth).
- Same cost on phones: no model gained a draw or a material; triangles stay within a quarter of the old models (the Drone and the Rider have fewer). Every rig still moves: legs, wheels, tracks, turrets, guns and the Drone's hover. Faction models still load only when a match needs them. Tests: `tests/visual-round-v.test.js`, render-budget `faction-models-eco`.

### Every faction looks like itself (W5, visual round V)
- Ashfall, Sunward, the Wardens and the Veil now wear their own parts on the shared units and buildings (Harvester, Vanguard, Ranger, Medic, Engineer, Anti-tank, Breaker, Tank, Kite, Command core, Barracks, Foundry, Supply relay, Sentinel tower): gas-mask hoods, spiked pauldrons, exhaust stacks, ram blades and rust cladding; wide canvas hats, canopies, brass domes, banners and solar fans; ceramic domes, single lens eyes, halos and insect legs; pointed hoods, long cloaks, crystal shards, spires and charcoal drapes. They read by shape at phone zoom even in another colour; Meridian is unchanged. Only the factions in a match download their dress (0.23-0.34 MB each), and a battle draws no more than before. Tests: `tests/faction-dress.test.js`, `npm run test:faction-dress`, four render-budget scenes.

### Signature shots: every faction fires its own energy (V4)
- Every unit now fires in its faction's style, after the painted story portraits, whatever its team colour: **Meridian** cyan photon darts and bolts (the Vanguard keeps its new sword slash), a teal plasma comet for Tanks and Sentinel towers that lands in a cyan shock ring, a plasma mortar ball, a teal rocket with a ring of exhaust; **Ashfall** hot orange tracers, a Scrapper spray of molten slugs, molten slugs trailing black smoke that splash into embers; **Sunward** amber bolts that shimmer, twin sun-darts, spinning golden sun-discs that burst in a starburst, golden healing motes from the Wagon; **The Wardens** zig-zag electric bolts, a crackling electric shock ball from the Walker whose discharge arcs to nearby enemies you can see (drawing only), a jagged lightning arc from towers, ring hoops from the Halo; **Veil Survey** spinning violet crescent blades, a crystal rail with floating shards, void orbs that implode, homing wisps from the Moth. Painted flipbooks (Codex) for the comets, balls, discs, blades, hoops, lightning and muzzle flashes; procedural shapes elsewhere and as the fallback. Flight times, hits and every rule are unchanged; creatures, bosses, the Iron units, bombers, flamers and abilities keep their looks. No extra draw calls; reduced motion and combat motion off still show a still line and a calm landing.

### Richer ground, worn tracks and a land below the edge (V1 terrain)
- **Ground with grain:** every surface now has painted detail you can see at phone zoom (grass clumps, pebbly dirt, wind-rippled sand, cracked hardpan, rock, packed snow and ice, basalt, ash, beach, cliff strata), blended along softly broken borders and kept in each map's own colours; ramps, kill zones, ember cracks, crossings and every other mark read as before. Twelve layers painted by Codex (owner-commissioned), road and cliff generated; they load with the battle (36-64 KB a match on phones, 195-313 KB on desktop High), never on the title screen, and the light painted in them falls from the sun's side.
- **Worn tracks** from each camp to its crystals, the nearest crystal fields and the middle of the map, with wheel ruts; grass and flowers keep off them.
- **Beyond the edge:** no more flat void. Each land sits on its own lowland (meadows and groves, forest, dunes and mesas, copper terraces, dark rock and spires, snow with ice and pines, a basalt plain with lava rivers and a volcano, ash and dead trees) and Coral Isles stands in a sea with islets and palms. It recedes: the land's own ground grain at a coarser scale, broad patches of its other surfaces, a soft shade below the rim, and it greys and darkens toward the haze within about 40 m, so the eye stays on the field; groves and outcrops stand in mixed-size clusters with bushes and stones under them. The cliff edge of the playable ground stays clear. Still one draw.
- **Fuller dressing:** meadows grow in drifts, groves line the far edges, rocks gather at plateau feet, reeds on the river banks and lake shores, basalt spires, coral in the lagoon shallows; all in the one scatter draw and never where it could hide a unit.
- **Water edges:** foam laps along every bank, rivers run with faint streaks, banks are wet and darker, and fords are stepping stones over shallow running water with riffles. All fords and lake strips are one draw (Twin Rivers drew four).
- View only: every golden pin unchanged; phone draws no higher.
- A computer without a working GPU (software WebGL: SwiftShader, llvmpipe) gets the ground detail's one-layer Eco form whatever the quality setting: the full set doubled its frame time.

### Readable deaths at phone zoom
- A unit that dies now reads at a glance on a phone: the model flashes white-hot, a ring in its side's colour opens where it fell and a fainter ring stays there for a moment; soldiers are popped off their feet, machines pop and tilt with a puff of dark smoke, a shot-down flyer bursts in the air and leaves its ring where it crashes. Losing one of your own units gives a bigger double ring and a short mark on the minimap. Follows Unit motion, combat motion and reduced motion; no extra draw calls (every sprite comes from the existing effect pools). Tests: `tests/death-cue.test.js`, `npm run test:death-cue`.
### Home-screen app and iPhone readiness (Platform reach)
- **Install app** tile in Settings -> Display: on Android and desktop Chrome/Edge it opens the browser's install dialog; on iPhone and iPad it shows a one-screen Share -> Add to Home Screen guide. Hidden once the game is installed. EN/VI/KO.
- A real app icon (the game's tank in front of the gold emblem, rendered in Blender), a maskable Android icon, iOS launch screens for 18 iPhone/iPad sizes, a see-through status bar over the game, full screen when installed; still starts offline after the first visit.
- iPhone readiness checked in WebKit on iPhone SE, 13, 15 Pro Max and iPad (emulated): first tap, audio unlock, full screen, notch and home-indicator areas, swipe gestures, WebGL context loss, texture memory. Older iOS (before 14.5) gets sound through the prefixed AudioContext. A 10-minute real-iPhone checklist and an app-store assessment are in docs/PLATFORM.md.
- Tests: `tests/pwa.test.js`, `npm run test:pwa`, `npm run test:iphone-audit` (WebKit only, not in CI).
### Defence 6.7: three new maps, wave kinds, the commander hint and an Endless top ten (W10)
- **Three new Defence maps** (levels 8 to 10): **Hollow Fork** (two forest roads that meet at a fork), **Serpent Pass** (one long road with three bends over the dunes) and **Kingfisher Bridges** (a river with two bridges and no ford). Each has ten waves, stars, Heroic, Endless and the Daily seed, in EN/VI/KO.
- **Six wave kinds**, each with one readable answer: **Shield wall** (single shots glance off, blasts break it), **Runners** (fast and frail), **Crawler** (armoured, slows never hold it), **Sky swarm** (light flyers: anti-air crews only), **Surgeon** (heals the column: focus it), **Brood** (two broodlings walk on when it falls). Their models are tinted and ringed in the kind's colour; the wave strip shows a chip for each and the first meeting a card with the crews that answer it.
- **The commander in the wave strip:** a hint tile names the ability that answers the coming wave (Barrage for shield walls, broods, surgeons and crowds; Reinforce for runners, crawlers and machine columns). Information, not a button.
- **Endless top ten per map**, kept in this browser (waves held, score, date, the commander's branch): on the Endless result, with the new run marked, and in a new **Records** tab beside Levels, Endless, Daily and Heroic.
- Never harder: the seven older levels, their Endless and Daily waves and every golden pin are unchanged (`check:defence` gives the same 28 rows). Phone draws in a full wave with kinds: Hollow Fork 64 (Gorge Road 62), Kingfisher Bridges 91 (Long Crossing 91).
### New lands: Snow, Volcano, the Isles and the Ancient ruins (W9)
- **Three new lands, a Skirmish map on each** (160 m, four camps, EN/VI/KO names): **Frostmere** (snow: four frozen ponds crossed by slow ice roads, a ruined terrace in the middle, snow-laden pines, falling snow), **Ember Crown** (volcano: glowing lava channels crossed only by bridges, lava pools, ember-cracked basalt, ash falling and embers rising, the crown terrace in the middle) and **Coral Isles** (a turquoise lagoon: four camp isles, a centre isle and four edge islets linked by fords and plank bridges, palms, coral, gulls). Each land has its own palette and light (daylight, warm), ground, dressing, creatures, weather, sky and music.
- **Ancient ruins:** broken arches, carved stone heads, overgrown walls and fallen column drums, in the one scatter draw, on any land (maps.json `ruins`); each new map's centre terrace is a Builder shrine (high ground with the crossroads capture ring: existing rules).
- Rules reused: ice roads are lake fords, lava is water, the isles are lakes; one addition, a lake strip of `type: "bridge"` (a plank bridge, full speed), used only by the new map. Existing maps, their fingerprints and every golden pin are unchanged. Settings > Weather Off also stops the snow and ash.
- Phones: a 60-unit battle draws no more than the same battle on Twin Rivers (`npm run test:lands`); the AI plays all three (`tools/ai-census-check.mjs --field-maps`). Missions can be moved onto the lands later: docs/WORLD.md "Lands".
### The Ember Drake: a flying boss, and The Ember Roost (W9)
- **New optional Act 3 mission, The Ember Roost** (after Crown Hill, Obsidian Highlands at dusk): the Builder fire guardian that burned Maren's first camp comes home to the Crown. In the air only Rangers, Anti-tank soldiers and towers with Anti-air guns reach it; a glowing strip marks each fire breath 2 s ahead; after every second breath it lands on the Crown behind a wing-gust circle that pushes back anyone close, and for 8 s everything can hit it. A wider sweeping breath from two thirds, faster from one third; shot down in the air it falls and crashes. Boss bar: AIRBORNE / ATTACK INBOUND / LANDING / LANDED. EN, VI, KO; voice lines listed, audio to come.
- Boss engine IV (flying bosses, `src/sim/boss-flight.js`); original Blender model (2,676 triangles, rigid wings, jaw and tail moved by maths, ember glow); the drake costs a phone what the Iron Vanguard does (84 draws in `boss-drake-eco`). Tests: `tests/ember-drake.test.js`, `npm run test:ember-drake`.
### Story: four side missions, six scenes, scripted moments (W9)
- **Four optional side missions**, one in each gap of the campaign (25 missions): **Loose Crystal** (Act 1: bank 4500 alloy from the fallen siphons before Hale's salvage crews), **Hawk Wing** (Act 2: your first Hawks against Anti-tank crews, three balloon moorings, no base), **The Long Night** (Act 2, at night: keep two of three relays lit for 2:30 while raids come by the glow), **The Water Road** (Act 3: Sol's water wagons to the cistern and the east wells, no base). EN/VI/KO.
- **Six more staged scenes**: the east bridge blown (mission 2), Sol's well crew (mission 9), the grey crystal, the Hawks lifting off, the first light at night and water in the wells.
- **Scripted moments**: Hale blows the east bridge behind his crews (mission 2), a supply truck with three Rangers and a Medic (mission 5), a flank on the west pass shown with a camera nudge (a real column on Veteran only, mission 6), Sol's well crew on a 75-second clock (mission 9), Hale's taunt (mission 10), river fog that rolls in and lifts (mission 11, off with Weather Off). Never harder on Relaxed or Normal; golden pins unchanged.
- **Campaign map**: 25 relays on a four-row route (44 px apart on phones); name plates for the picked and next relays and on hover.
### Faction music (Audio 6.5)
- **Every faction has its own battle theme and stinger.** Under Music "Recorded", a skirmish, campaign or chronicle match loops the player's faction theme (Meridian guitar and horn, Ashfall brass-and-anvil march, Sunward lute and fiddle, Wardens machine pulse and bells, Veil flute and harp; 54-56 s loops), opened by a 3.8-4.9 s stinger; the stinger also answers a "Your faction" pick on the start screen and closes a won match. Only that faction's two files load (about 0.5 MB per match, cached on first fetch); music still ducks under voices and follows the Music volume. Defence and the menus keep their tracks; "Adaptive" keeps the synthesised battle score.

### Depth: second doctrines, air abilities, Full army sandbox (W7)
- **Second doctrine tier.** After a building's first doctrine, a level 3 Command core, Barracks or Foundry offers a second either/or pair for the match, each one a way to play rather than a few per cent: **Strike wing** (flyers 10% faster, flyer abilities recharge 40% sooner) or **Bastion** (towers and the core +25% damage, buildings take 20% less); **Dig in** (infantry on Hold stance take 25% less damage) or **Shock troops** (infantry +40% against buildings and walls); **Heavy armour** (vehicles take 20% less damage, move 10% slower) or **Overclock** (vehicle abilities recharge 40% sooner). One tap each, never more than two doctrine tiles on the card.
- **Air abilities.** Hawk gunship **Strafing run** (a 14 m line of fire through the nearest group: 16 to each soldier, half to vehicles), Ember balloon **Signal flare** (9 m of light for 8 s: your side sees the ground, hidden units are revealed, enemies there take 15% more), Swift glider **Bomb drop** (Harvesters first: 75 to Harvesters, 12 to other units). Tiles say "No target near" when there is nothing to hit; Auto-cast uses them. Icons, sounds, effects and field guide pages (every unit page now shows its ability).
- **Full army battle is now the Full army sandbox**: the same ready army against the same Relaxed rival (30-55 s to win with the whole army), named for what it is: a place to try every unit and ability.
- Never harder on Relaxed or Normal: computer sides cast the new abilities and take second doctrines only in a Fast or Relentless skirmish. Difficulty, missions, Defence and the AI census are identical to before on Relaxed and Normal; 1v1 Fast 12 -> 11 wins for the test bot. Duels and numbers: docs/BALANCE.md "W7 depth"; golden pins that move: roadmap "W7 notes".
- Tests: `tests/w7-depth.test.js` (16), `npm run test:faction-depth` (second pair and both done tiles, the three air tiles and a Strafing run cast, at three viewports).

### Re-score fixes (2026-11-25b): messages, commander tile, LAN strip, ability tiles, desktop taps, replay camera, challenges
- **Defence, portrait phones:** a counter hint ("Your Battle tank beats Scrapper") no longer covers the Next wave card: it rides above the card (and above the radio chip while a line shows), as story lines already did.
- **Defence commander tile:** it read "Hero 936" (a bare number next to the bar's Hero button); it now reads **Commander** over its rank pips and a slim health bar that follows hits. Its accessible name is "Field commander, rank N, health X of Y" (EN/VI/KO).
- **LAN on phones:** the strip in the top bar showed "H… 1 ms"; it is two short lines now, the other player's name over the dot and ping, so at least eight characters of the name show at 390 px.
- **Phone ability tiles:** portrait tiles show full names in up to two lines ("Lock-on", not "Lock"); short names are for landscape tiles only, and Lock-on keeps its name there too. With one or two abilities the portrait tiles had lost their glyph and right-aligned their name ("Shield", "Rapid" clipped, seen in the iPhone 13 WebKit profile and Chromium alike): they use the same centred layout as the five-column card. Every ability name is checked in English, Vietnamese and Korean at 390x844, 844x390 and 667x375.
- **Desktop taps:** the top bar's Pause / Mute / Settings, Focus base, the unit-type chips (also with seven types), Comms log and the dialogue's Dismiss are 44 px on PC; the top bar is 2 px taller (44). The roster's "+N" is 11 px text. The dense command board keeps its mouse-sized cells (hotkeys, 172 px card).
- **Replay viewer: Follow action.** The camera now follows the action, the busiest knot of units that fired in the last 3 s, else your army, and keeps its fight while that fight is most of the action. A **Follow action** toggle on the replay bar (on by default) turns it off and on; any manual camera move pauses it until the toggle is pressed. It only reads the match: replays still end on their recorded hash. Jumps to key moments were left out (a replay cannot seek without re-simulating from the start).
- **Daily challenges:** nine more goals (22 in all, at least 7 per mode): Master builder, New colours, Wrecking crew, Clean sweep, Forced march, Muster, Specialist, Road warden, Unbroken. Each reads a number the match already counts; still one per mode, chosen from the date alone.

### Subtitles: unit replies and the announcer in English, Vietnamese and Korean
- The voices are English only. Story lines already showed their translated text in the mission dialogue box, but unit replies ("Ready, Commander.", "Strip it for parts.") and announcer lines (base under attack, unit lost, construction complete, victory…) had no text in any language. Each line now shows a **caption** in the player's language while it is spoken: the speaker (the unit's name, or "Announcer") in the faction's tint, then the words of the take actually playing.
- **Follows the voice scheduler**: a caption appears only for a line that is really spoken (rate-limited replies, announcer cooldowns, waiting lines when they start, the announcer's 0.3 s delay), one at a time; a line that cuts in replaces it, a story line takes it away (no double captions), and it clears 0.7 s after the clip ends (at least 1.4 s on screen). It runs on the audio clock, so it holds while the match is paused.
- **Settings → Sound → Subtitles** (On / Off, default On, saved). Off keeps the voice and drops the caption; Voices off or muted shows none. The size follows Settings → Assist → Text size (Medium ×1.12, Large ×1.25).
- **Placement**: bottom centre of the battlefield, above anything that spans the bottom (phone dock, PC console) and between the side pieces at that height (minimap, landscape dock, Defence bar and next-wave strip), measured again 4 times a second while it shows, so a growing dock pushes it up and the left-handed layout mirrors on its own. Fixed position, `pointer-events: none` (no layout shift, never takes a tap), dark glass backing, 13 px words / 12 px speaker on phones (15 / 13 px on PC), an `aria-live="polite"` region for screen readers.
- **Phone HUD coverage** with a caption up (W13 budget, `tests/lib/hud-coverage.mjs`, before -> with the caption): portrait 12.1 -> 14.3 % (nothing selected), 23.9 -> 25.7 % (army selected); landscape 14.2 -> 16.3 %, 27.8 -> 29.6 %; Defence portrait 12.7 -> 16.2 %, landscape 15.3 -> 17.3 %; all under 30 %. One exception: the small 667x375 landscape with the army selected already covers 29.4 % without a caption (30.8 % in Korean), and no readable caption fits in what is left: 31.3 % while a reply is up (held under 32 % by the test; open for the owner). `tests/phone-hud.mjs` measures its states with the caption cleared, like the notice line.
- **Translations**: all 170 reply and announcer takes of the five factions (165 distinct lines) in Vietnamese and Korean, in `src/locales/vi.json` / `ko.json`, keeping each faction's voice: Meridian clean and professional, Ashfall rough and on the clock, Sunward warm trader talk, Wardens clipped machine reports, Veil hushed and archival. Korean uses only syllables the bundled font subset has (five lines reworded instead of rebuilding the font). Four English lines are shared by two or three factions and share their translation.
- Code: `src/voice-captions.js` (rules), `src/captions-ui.js` + `src/captions.css` (the box), the director's `caption()` in `src/audio.js`, `onStop` and the reply's unit type in `src/voice.js`. Tests: `tests/voice-captions.test.js` (every line in VI/KO, scheduler, rate limit, priority, Voices off, Subtitles off), browser suite `npm run test:captions` (portrait, landscape, desktop × EN/VI/KO, Defence, left-handed, coverage, sizes, setting saved; in the CI `story-voices` entry).

### Story lines: shorter, and lighter voice packs (owner request)
- Owner: "It is quite long, may you make the sentences concise and then we can have shorter file size?" Every spoken story line (the 416 `say` lines of the 21 campaign and 16 Chronicle missions, scene lines included) is rewritten shorter: **15.0 -> 9.0 words on average, longest 26 -> 14** (6240 -> 3742 words, 40% fewer). Plot facts, names and every instruction the player needs (what to build, where to go, what to hold) stay; each character keeps their voice (Vale's fact-then-order, Okoro's exclamations and numbers, Hale's schedules and "Noted.", Sol's wells and debts, Maren's records, Lind's head counts, Rask's workshop talk, ECHO's counts and "this one"). Example: "The Harvesters know their work, Commander. Alloy builds everything, so let them cut." -> "Harvesters know their work, Commander. Let them cut alloy." Briefing and debrief cards are unchanged.
- The on-screen line and the spoken line are the same text again: all 15 voice-only `spoken` variants are gone (the new lines were written to be heard right). Vietnamese and Korean subtitles are rewritten to match the shorter English (Korean only with syllables the bundled font subset already has, so the font is unchanged).
- **Smaller downloads:** the story packs went from 7.9 MB in 43 packs to **5.2 MB in 38 packs** (34% less); a mission's packs are now 46-253 KB (largest story-m10, was story-m06b at 285 KB). Five of the six missions that needed two parts now fit in one (m03, m07, m08, m09, m10); only the finale (m12) still has two, as one pack it would be about 360 KB. The clip index (voice-packs.json) is 23 -> 22 KB.
- Same cast voices and processing, rendered again with `make-voices.py --packs story --qa`. Whisper large-v3 round trip: mean WER 0.003 over 416 clips, none above 0.1 (the max is 0.1, so none is flagged). Short lines give Whisper less context, so 45 lines were reworded until they were heard right (e.g. "Tower up." -> "The tower is up!", "Where next?" -> "What comes next?"). The comparison now also counts Whisper's contractions (they're / they are) and true homophones of names (Saul / Sol, Vail / Veil, packed / Pact, cruise / crews, knights / nights, recs and rex / wrecks) as the same words. Listen page: `.tmp/voices/listen-story.html`.
- Play is unchanged: the objective bots and the DefenceBot play exactly as before, and `check:missions` with and without `--chronicle all` gives the same results line for line. The golden pins and mission checksums whose hash covers the mission definition (r3h mission, r3i m04, round2/w2f m11c, golden-story m01/m03/m06b/ca1/m02b/m11c, the wings.test.js resolve checksums) were re-recorded because the text changed. With the old lines put back, every one of them reproduces its old value exactly. Tests that matched story text (story-scenes, golden-r3i, choices, wings, voice, audio) follow the new lines.

### Hills mix: some hills round, some rounded rectangles
- Owner decision (W2 follow-up): "some hills will be round, some will be rectangles". A new plateau shape, the **rounded box** (`rbox`: x, z, w, d, corner radius 3 m or more), joins the disc. Its sides snap to the 2 m grid, so the cliff band falls on navigation and vision cell edges; ramps go on a side (`side`, `at`) or where an `angle` ray leaves the box (Crown Mesa's corner ramps). The rock cliff follows it with arcs at the corners (`src/plateau-relief.js`), the ground paint with rounded outlines (`src/ground-paint.js`); everything else reads the one signed distance (`plateauEdge` in `src/terrain.js`).
- **Rounded boxes now:** Amber Dunes (two 22x20 m mesas, ramps east and west; was a 23 m disc), Verdant Crossing (the bluffs, 24x18 m, corner 3 m; were sharp 25x17 m boxes), Dry Reach (two 20x16 m mesas; were 18 m discs), Twin Rivers (the dividing ridges, 8 m wide; were sharp 6 m), Ironback (the ridges, corner 3 m; the north-south ones 32 m long, were 34), Crown Mesa (44x44 m, corner 8 m, eight ramps; was a 48 m disc). **Kept round:** Obsidian Highlands (organic hills on the highland map, ramps at angles), Golden Heart and Open Steppe (small knolls nobody builds on), and the small knolls of Dry Reach and Crown Mesa. Campaign and Defence maps are unchanged (candidates for later: Highridge's and Gun Hills' gun hills, Gorge Road's relay plateau).
- Every rampless plateau is flagged `"decor": true` and checked out of reach; every ramped one reached up each ramp with room for a tower on top (`tests/terrain-rbox.test.js`).
- Building room on the tops (`node tools/plateau-area.mjs`, before -> after): m² where a barracks can stand: Dunes 252 -> 212, Verdant Crossing 185 -> 197, Dry Reach 80 -> 92, Crown Mesa 1015 -> 1053; towers that fit side by side: Dunes 24 -> 28, Verdant Crossing 24 -> 23, Dry Reach 12 -> 16, Ironback 26 -> 26, Crown Mesa 70 -> 74. "Keep cliffs and ramps clear" refusals in a 1 m barracks sweep of the whole map: Dunes 1456 -> 1448, Verdant Crossing 1576 -> 1488, Dry Reach 2656 -> 2760, Twin Rivers 1676 -> 1896, Ironback 3792 -> 3648, Crown Mesa 2384 -> 2516.
- The cliff lip had a 4 cm slot between the cap and the rock face where the low ground showed straight from above; the face now starts on the lip (all plateau maps, no extra triangles).
- Phone cost: the cliff rock is merged into the ground mesh (no draw added). Rock triangles: Dunes 7112 -> 6824, Verdant Crossing 9800 -> 6824, Dry Reach 14984 -> 15464, Twin Rivers 16032 -> 12288, Ironback 23928 -> 17016, Crown Mesa 10672 -> 10480 (straight runs take a column every 0.5 m, arcs every 0.4 m).
- Difficulty (test bot wins out of 12, before -> after): 1v1 Relaxed 12 -> 12, Normal 12 -> 12, Fast 12 -> 12, Relentless 10 -> 9; 1v2 Relaxed 7 -> 8, Normal 2 -> 3, Fast 0 -> 0, Relentless 0 -> 0. On the other converted maps (20 matches each): 1v1 Relaxed and Normal 20 -> 20; 1v2 Relaxed 12 -> 11, Normal 10 -> 11. Missions: every target met (Mission 4 objective bot 369 -> 366 s). Defence unchanged.
- Golden pins on Dunes moved (re-record by the integrator: roadmap "Hills mix notes"). `tests/maps-variety.test.js` pins the new Dunes and Verdant Crossing terrain fingerprints. The stale first copies of six maps in `src/maps.json` (JSON keeps the last of a duplicated key) are removed; the parsed maps are identical.

### LAN play: 1v1 and co-op on the same Wi-Fi (W11)
- **Play together on one network, PCs and phones, no internet.** One PC runs `npm run lan` (builds, then starts `tools/lan-server.mjs` on port 4570): it serves the game on every network address of the PC, prints the join address with a QR code, and passes the players' orders between them. Everyone opens that address; a **LAN play** tile on the title (and `?lan` / `?lan=join` in the address) opens the LAN screen. How to host and join, the Windows firewall prompt and phones on the same Wi-Fi: `docs/LAN_PLAY.md`.
- **Modes.** **1v1** (host against guest) and **Co-op vs AI** (both people allies against one or two computer sides, with the computer's faction and speed). The host picks the map and both factions; the guest sees the battle and taps Ready; the host starts. Each person commands their own team; computer sides play the same on both screens.
- **Lockstep.** Both pages run the same deterministic simulation: 150 ms turns, orders run two turns after they are given (225 ms on average) on both pages in the same order; a turn waits for every player's orders. Every 5 s the pages compare state hashes: if they ever differ, both stop, say so, and **Continue from the host's battle** loads the host's save on the guest. Speed is x1; any open menu or a hidden tab pauses both screens (the other says who paused); a player who stops answering shows **Waiting for a player** with a countdown, and after 30 s the battle ends with the reason. A player who leaves: in 1v1 the other wins by forfeit; in co-op the other plays on.
- **In the battle**: a strip with both names, colours and the ping (on phones in the free part of the top bar); the guest's screen shows the battle from its own side (its army is "yours": selection, fog, minimap, HUD), by swapping team labels for the interface and back before every tick and hash (`src/net/perspective.js`).
- **Single player unchanged**: the rules change only for a match built with the new `lan` option (`src/sim/lan.js`: human teams, sides, allies' shared sight, the result by side); every golden pin is the same. The LAN code is its own lazy chunk (`lan-ui`, ~35 kB); the title loads only the tile. Nothing of a LAN battle is saved, recorded or replayed.
- Measured on localhost: ~205 bytes a second per player, a few ms round trip; 3 minutes of 1v1 and 2.5 minutes of co-op with orders on both sides agree at every hash check.
- EN/VI/KO. Code: `src/net/` (protocol, lockstep, session, client, perspective, match, qr, lan-ui), `src/lan-entry.js`, `src/sim/lan.js`, `tools/lan-server.mjs`, `tools/lan-ws.mjs` (a minimal WebSocket server, no package), `commandAllowed` in `src/commands.js`, a LAN branch in `src/app/frame.js`. Tests: `tests/lan-lockstep.test.js`, `tests/lan-integration.test.js` (the real server and two headless players), `npm run test:lan-play` (new CI group "w11": a desktop host and a phone guest).

### Smarter computer at Fast and Relentless (W8)
- Only the chosen-challenge speeds change: Fast and Relentless skirmish rivals, under either AI plan (Classic or Field command). **Relaxed, Normal, every mission and Defence play exactly as before** (whole Normal and Relaxed AI matches hash the same as before; every Relaxed/Normal golden pin is unchanged).
- **Shared focus fire.** An attack's shooters agree on one target, the one their priorities rate highest for the seconds they need to kill it (a wounded Ranger before a full-health Tank); shooters beyond what it needs take a second shared target, so volleys drop units instead of scratching three. Targets are kept until a clearly better one appears.
- **Wounded step back and return.** A badly hurt unit pulled back to a Medic or Engineer stands behind it (away from the fight) and, healed, rejoins the same attack instead of idling where it was healed.
- **Flanks that land together.** A flank waypoint goes on the side with fewer seen enemy towers; the flank leaves first and the main push waits at the rally for the difference in marching time (3-25 s), leaving at once if the flank is already fighting. The two halves are paired: when one falls back, so does the other.
- **Kite scouting.** An idle Kite flies to the unexplored ground where an enemy base is likely (the mirror spots of its own core), turns back as soon as it sees something that shoots flyers, and keeps away from those spots afterwards.
- **Abilities.** Rider Dash and Scrapper Rush close on a target just out of reach or carry a badly hurt unit out of a fight; Ranger Rapid fire waits for armed enemies (or a tower) in range instead of firing at a Harvester; under the Classic plan Barrage and Burn line aim at the densest cluster.
- Difficulty (test bot wins out of 12, before -> after): 1v1 Relaxed 12 -> 12, Normal 12 -> 12, Fast 11 -> 12, Relentless 11 -> 10; 1v2 Relaxed 7 -> 7, Normal 2 -> 2, Fast 0 -> 0, Relentless 0 -> 0; two rivals free-for-all Fast 12 -> 11, Relentless 11 -> 12. AI cost stays about 0.1 ms per tick with 250+ units.
- Code: `src/sim/ai-sharp.js` (new), `src/ai-plan.js` (`sharpSide`), `src/sim/ai-attack.js` (`cmd.sharp`, timed flank, paired retreat), `src/sim/ai-counter.js` (rejoin), `src/sim/ai.js`, `src/sim/content/ai-casts.js`. Tests: `tests/ai-sharp.test.js`. Fast/Relentless golden pins moved (re-record by the integrator: roadmap W8 notes).

### Phone HUD: less chrome, minimap side, left hand, two-finger twist (W13)
- **Less HUD over the battlefield on phones.** Nothing hidden, grouped or moved behind a menu; the same buttons with less slab around them (`src/phone-hud-slim.css`, loaded last): the Walnut theme had put a full-width wood slab back behind the top bar's two pills (it is gone again); the dock is glass the map shows through (its buttons keep solid faces, its heading and stats their own backing); the landscape touch row's buttons are 48 px wide (were 56-57); a selected building's card drops its Selection / Map tab row in portrait (Map and the objectives flag stand in its heading row, as they already did for units). Measured with `tests/lib/hud-coverage.mjs` (the share of the screen the interface paints; glass counts by its alpha, text by its line boxes), notice line empty, before -> after: 390x844 nothing 16.2 -> 12.1 %, mixed army 30.4 -> 23.9 %, Command core 32.8 -> 20.0 %, Defence 19.2 -> 14.2 %; 844x390 17.1 -> 14.2, 32.5 -> 27.8, 33.4 -> 27.7, 23.7 -> 15.3 %; 667x375 25.1 -> 18.5, 45.4 -> 36.3, 46.1 -> 36.1, 27.5 -> 19.5 %. With the opening two-line notice on screen the old figures were 35-38 % (the "~35 %" of the re-score).
- **Notices settle.** A routine notice shows in full, then after 2.5 s shrinks to one line on lighter glass for the rest of its time (`app/hud.js` adds `.settled`); alerts (attacks, losses) stay in full. A two-line notice covers 4.5 % of a 390x844 screen fresh and 3.0 % settled (667x375: 6.0 -> 3.9 %).
- **Minimap side on phones.** Settings -> Display -> Minimap side (Left / Right) now shows on phones too: landscape puts the minimap in the bottom-right corner (its Home and enlarge buttons on its inner side, out of the 20 px back-swipe strip), Defence's portrait map strip moves right. When the minimap shares the dock's corner, the dock stands beside it.
- **Left-handed layout.** Settings -> Controls -> Hand (Right hand / Left hand, phones): Left hand mirrors the phone controls (portrait: the touch row from the right edge, the objectives flag and Map on the left, the idle buttons on the left; landscape: the dock on the left, the flag and idle buttons under the right-hand pill, the touch row from the right on phones under 840 px) and moves the minimap right (its own row can move it back). Frontier Defence keeps its own HUD apart from the minimap side. Every tap target stays 44 px; saved on the device (`handedness`, `src/phone-handed.css`).
- **Two-finger camera twist.** Twisting two fingers on the battlefield turns the camera freely about the focus, with the fingers, alongside pinch zoom and two-finger pan. The fingers' line must turn 15 degrees before the camera follows (a dead zone, not a jump), and fingers closer than 60 px are ignored, so a pinch never twists by accident. The twist is for this match only: a new match, or a Turn picked in Settings or with Page Up / Page Down, starts from no twist. Frontier Defence frames its roads itself (no twist). Desktop unchanged.
- EN/VI/KO. Tests: `tests/phone-w13.test.js` (twist dead zone and wrap, rotate vs wobbly pinch, lifting a finger, the Hand and Minimap side settings, the stylesheet order), `npm run test:phone-hud` (new CI group "phone-hud": coverage per state at 390x844, 844x390 and 667x375 with 44 px / 11 px audits, the settling notice, Hand and Minimap side chosen in the sheet and kept after a reload with the mirror checked in three viewports, a real two-finger rotate through CDP touch events turning the yaw clockwise with the fingers while a pinch only zooms, Defence ignoring it), `tests/iphone-gestures.mjs` now runs both hands (moved to the "phone-hud" group).

### Shorter side card on small landscape phones; reward pacing
- **Small landscape phones (667x375 class, up to 760 x 420 px) get a shorter side card.** With a group or a building selected the card was about 236 x 214 px and the HUD covered 36 % of the screen. Same buttons in the same card, all 44 px, nothing hidden or grouped (`src/phone-hud-slim.css` rule 5): a group's chips and orders sit flush and its build tiles stand in one row of 44 px tiles (icon over price; the small "unlocks" icons give way); a building's heading is one line of name and level over HP / Shield / ATK with their bars (no portrait), its tiles share a row with Rally, and the doctrines share a row with Upgrade; the minimap is a size smaller (118 x 94 -> 102 x 81). HUD coverage at 667x375, before -> after: nothing selected 18.5 -> 17.4 %, mixed army 36.3 -> 29.4 %, Command core 36.1 -> 24.8 % (left hand 36.3 -> 29.5 %, 36.0 -> 24.9 %). 844x390 and portrait unchanged (the rules stop at 760 px wide). `tests/phone-hud.mjs` now holds 667x375 under 30 % in every state (was under 40 %).
- **Reward pacing** (owner: decide from how other games do it; reasoning and sources in `docs/aaa/REWARD_PACING.md`): a daily challenge pays **60** Commander XP (was 50; about half a typical win, the same as a Daily order); the **Silverline** paint unlocks at **3** achievements (was 5) so a medal cosmetic arrives in the first session or two; the **Medal** emblem at **8** achievements (was 10); the **Crimson** paint at **5** challenge days (was 3; days need not be in a row). The rest of the ladder, the 25 achievements and every battle rule are unchanged; rewards stay looks only. EN/VI/KO.

### Animation pass: hits, falls, firing stances, heavy walks (W4)
- **Hit flinch.** A unit that takes a hit reacts to it: troopers jerk back (or forward, hit from behind; sideways, hit from the side) a few degrees and spring back within about half a second; tanks and other hulls rock on their suspension away from the shot. The size follows the share of health the hit took (a scratch still shows). Driven by the game's own impact events and the shooter's position, per unit, no draw call added. Settings > Unit motion off or reduced motion: no flinch.
- **Infantry falls.** A fallen trooper drops one of three ways, picked from its id so a squad never falls in step: thrown back off its feet, dropped to its knees and slumped forward on its face, or spun round onto its side (a Rider's bike always tips over). It lies still, then sinks away (2.4 s; 1.8 s on Eco). Vehicles already leave a dark smoking wreck that sinks (pooled, 24 at most, shorter on Eco) and shot-down flyers spiral down and crash: unchanged. Combat motion off or reduced motion: the last pose at once, no sink.
- **Firing stances.** Shooters standing still set themselves to fire: every kneeler kneels (Ranger, Anti-tank, Gunner team, Stalker, Watcher); the Gunner team hunches over its machine gun, the Stalker settles over its scope, the Anti-tank rocks back under its launcher; the Walker and the Bulwark brace in a half-crouch, feet apart.
- **Heavy walk.** The Walker, the Bulwark and the Vault Sentinel land each step with a dip and a nod of the body and sway over the stance leg; all of it rides the stride phase, which only the ground actually covered advances, so the feet stay planted and a stopped walker stands still. The **Iron Sovereign's** leg tripods barely moved in play (a few centimetres at its slow march, so they read as frozen): they now step in turn, the planted one sliding back with the ground, and the body dips as each lands.
- **Flyers** dip the nose as they speed up and flare it up as they brake into a hover, on top of the banking and climb pitch (Kites and Hawks never land: the flare is the stop).
- The Field Guide's 3D view plays the same motions through the same helpers (Fire: the stances; Walk: the heavy walk; Fly: the speed-up dip).
- Phone cost (live 300-unit fight, 390x844, CPU x4, eco; 11 baseline and 7 new runs interleaved): main-thread view update + render median 16.6 ms before and after, 92 draw calls both, at most 23 dying models both (cap 24). View only: golden pins unchanged.
- Code: `src/unit-rig.js` (STANCE, hitFlinch and the flinch springs, STOMP / stompBeat, FALL / fallFor / infantryFall, stepTripods), `src/air-motion.js` (accel / accelMax), `src/view.js`, `src/boss-view.js`, `src/unit-viewer.js`. Tests: `tests/animation-pass.test.js` (flinch recovers, scales and comes from the shooter's side, keeps its size at 30 fps; hull rock; motion off; the three fall timelines and their end state with motion off; stances; stride phase tied to speed, dip and sway; dip and flare clamped; the tripods' planted slide), `tests/visual-combat.mjs` (impact flinch and rock without a draw call, both settle, a death falls and is gone, reduced motion).

### Small fixes (W14)
- **Field Guide 3D view fits on opening.** On 390x844 the Colour / Size row sat under the Close bar (and on desktop the buttons were below the fold, so scrolling to them cut the small 2D portrait off). CSS only (`src/unit-viewer.css`): the stage is sized to leave room (desktop 220-270 px, phones 220-360 px), the portrait is 64 px (56 px on phones), and on narrow phones the guide takes the full height with a slimmer title and Close bar (the picker's label stays for screen readers). Measured with the article unscrolled: 1440x900 last button 680 / article bottom 722; 390x844 673 / 765; 1280x720 and 1920x1080 fit too. Phone landscape unchanged. Test: `tests/progression.mjs` (1440x960, 1440x900, 390x844).
- **No word breaks in the middle.** On 844x390 the title's mode tiles broke "Campa / ign" and "Traini / ng" (the label sat beside its icon in a ~66 px tile and was allowed to break anywhere), and the daily challenge tiles broke "Expedit / ion" and "Promot / ion". Labels now wrap only between words (no `overflow-wrap: anywhere`; Korean keeps its words whole with `word-break: keep-all`), and on landscape phones the icon or Start here badge sits above the label and the challenge icon above its name. The new layout check also found two more: the 768x1024 chronicle cards squeezed the faction name to one letter a line (its pips now sit on the row under it), and the medal cosmetics broke "achievements" at 1920x1080 (wider buttons). `tests/layout-f.mjs` now fails on any word broken across lines (a break at a hyphen or slash is allowed) on every screen and viewport it audits, and runs phone landscape in Korean too.
- **Keyboard list names every bound key.** The PC help list (`?`) now also lists Page Up / Page Down (turn the camera a quarter turn), G (show / hide grid), Esc (cancel targeting / pause) and ? (this list); like the others each is a button that runs it. They are list-only entries in `src/hotkeys.json` (the key handler keeps running those keys itself). EN/VI/KO. Tests: `tests/hotkey-help.test.js`, `tests/hotkeys.mjs`.
- **Unreachable build sites show red before the tap.** On plateaus without ramps (Heartland, Steppe, Crown Mesa, Dryreach, Twin Rivers, the Defence maps) the build ghost was green, then the order was refused with "The Harvester cannot reach that site." The ghost now runs the sim's own reach check (route from each selected Harvester to the site's approach, `src/build-reach.js`) and turns red with that reason: beside the pointer on PC (the hover label, now 11 px), on the build card on phones with Build here off. The check runs on hover and tap only, cached per building type, site cell, Harvester cells and navigation revision (one route search per new cell); it changes no game state. With several Harvesters selected, one that can reach the site builds it. Existing EN/VI/KO text. Tests: `tests/build-reach.test.js`, `tests/terrain.mjs` (Heartland, PC and phone).
- **Lake fords slow units like the river ford.** Wading one of Mirror Lake's four ford strips (between the island and the shore) now costs the same 40% speed as a river ford (`terrain.ford_speed` 0.6, plan round 3: "the ford slows units and leaves them exposed") and abilities wait for dry ground, with the same "In the ford" card line; flyers pass over. Before, only river fords did (`sim/traits.js inFord` returned early on maps without a river). Only Mirror Lake has lakes, so every other map, the Skirmish difficulty bot, Defence and the golden pins are unchanged; Mirror Lake's objective bot still wins with gold (294 -> 318 s). Test: `tests/campaign-lake.test.js`.
- **Capture rings and crystal deposits sit on plateau tops.** Capture-point rings were drawn at a fixed 0.1 m (`capture-view.js`) and deposits at 0 m (`view.js createResource`), so on high ground (Mirror Lake's island deposits, points on a plateau) they were inside the plateau. Both now use `placeOnGround` (`src/ground-y.js`); flat ground draws exactly as before. View only. Tests: `tests/ground-y.test.js` (rings), `tests/terrain.mjs` (a deposit on a Heartland top).

### Field Guide: a 3D view of every unit (owner request, W5)
- Every Field Guide page (units, creatures, flyers and buildings) has a **3D view** panel under the portrait: the unit's real model from the game's own model cache (the same merged parts, baked finishes, team paint, rim light and shader bones), turning slowly until touched. Drag or swipe to orbit, pinch or wheel to zoom (clamped), double-tap / double-click to reset. Direct buttons, no sub-menu: **Idle**, **Walk / Drive / Fly** (legs stride, wheels and tracks roll, hulls rock, rotors spin, flyers hover), **Fire** (the unit's own firing pose and shots: kneel-to-fire, turret swing, barrel lift and recoil, the Breaker's barrel snap), **Colour** (yours, the enemy's, then each faction's colour) and **Size** (a Ranger beside it for scale). Motions come from the game's code (`unit-rig.js`, `air-motion.js`); the few lines view.js had inline (recoil, turret on hull, leg swing, rotors) moved there as shared helpers, so the game draws exactly as before. Phone landscape puts the title and picker on one row and the 3D panel first, beside its buttons. Reduced motion: no auto-turn, motions on demand. EN/VI/KO.
- Light: the viewer is a lazy chunk (`src/unit-viewer.js`, 15.6 kB / 6.4 kB gzip, loaded the first time a guide page opens), one small renderer reused across pages (pixel ratio 1.5 at most on phones, 4-9 draws for a unit), drawing only while the guide is open, the panel on screen and the tab visible. While it draws, the paused battlefield behind the guide redraws twice a second instead of every frame. Closing the guide frees every geometry, material and texture it made (the cached models stay with the game) and releases its WebGL context; the game's draw calls, triangles, GPU memory counts, shader programs and canvases are the same before and after. A lost context (or no WebGL) shows the 2D portrait with a note. Tests: `npm run test:unit-viewer` (desktop, 390x844, 844x390, 320x568, 667x375: Ranger, Tank, Breaker, Scorcher, Rider, Hawk, Walker, Command core; pixel probe, real model, Walk/Fire/Colour/Size, orbit and zoom clamp, layout rules, dispose and before/after game numbers, context loss), `tests/unit-viewer-math.test.js` (camera fit, orbit and zoom clamps, double tap, colour cycle, motion buttons).

### Building on high ground shows the site (owner report)
- Aiming a building at a plateau top showed nothing: the build ghost (the green/red site disc) was drawn at a fixed 0.23 m, 2.2 m under the plateau surface, on every map with high ground, PC and phone. It now sits on the ground under the pointer (top or low ground), and so do the order marker and the rally flag and its route (they were at 0 m). One height source for all of them and the buildings themselves (`src/ground-y.js`, Terrain.heightAt). Buildings, finished or under construction, were already drawn on the top and stay so after save/load; placement rules and golden pins are unchanged (a footprint always stays on the flat top, never over the cliff). Tests: `tests/ground-y.test.js` (every building type on every plateau of every map), `tests/terrain.mjs` (every buildable type finished and unfinished on the top and below, seen by the camera; the ghost through the real pointer/tap path on three viewports).

### Unit review: every unit of every faction (owner question)
- All 35 unit types (five faction rosters with swaps, flyers and workshop units, plus Carrier, creatures and bosses) were drawn close up idle, moving, attacking, hit, for both teams and on a plateau top, and lined up at desktop and phone distance. Every one has its real model, stands on the ground (plateaus too), flies at its height and wears its team colour. Fixed: the vitals bar sat at one height for every ground unit, so it cut across the body of a Walker, Tank, Scorcher, Wagon, Carrier, Rider, Engineer or Vault Sentinel: it now sits just above the unit's own top (infantry unchanged). The Rampart, the Sunward Wagon and the Carrier drove with still wheels and a rigid body: they now roll their wheels and rock on their suspension like the Tank (shader bones, no new draw call). The Scorcher had the Breaker's old droop (nozzle carried 10° into the sand at rest): it now rests level and lifts to burn. New `npm run test:unit-roster` (every unit type of every faction: real model, on the ground, flyers up, team colour, on screen, bar above the model) and a unit check that every wheeled or tracked model is a hull and no barrel pose droops.

### Build menu shows what each building trains (owner request)
- Phones: with a Harvester selected, each building tile shows small pictures of the units that building trains standing at the foot of its picture (Barracks: Vanguard, Ranger, Medic, Anti-tank; Foundry: Breaker, Engineer, Tank; Command core: Harvester, Kite, Hawk), following your faction's roster (swaps, faction flyers, story unlocks, mission limits, an Expanded match's workshop units at the faction building). They are the same role glyphs as the building's own train tiles (inline SVG, nothing to download, drawn only when the selection changes); units that need a level 2 or 3 building are dimmed and, where the tile is wide enough, carry the level. Up to four (more show three and "+N"); walls of the menu that train nothing (Supply relay, Sentinel tower) show none. The tile stays one button (58 px tall on phones; the dock grows by those 14 px, landscape's wider second-row tiles keep 44 px with the pictures beside the building). The PC console keeps its fixed tile height, so there the list is in the tooltip.
- Accessibility: every layout's tile name lists them ("Barracks, 150 alloy · Trains: Vanguard · Ranger · Medic (level 2) · Anti-tank soldier (level 2)"), in Vietnamese and Korean through two new catalog patterns. `buildingUnits` / `trainsLine` in `src/research-tiles.js` (unit-tested in `tests/research-tiles.test.js`); `tests/faction-depth.mjs` checks the tiles for Meridian and the Wardens on PC, portrait and landscape.

### Story voices: every mission speaks (W3)
- **Every campaign and Chronicle mission is voiced.** All 416 story lines with a speaker (the `say` lines of the 21 campaign missions, Defence levels included, and the 16 Chronicle missions, plus the lines of the staged scenes they play) now have a voice; before, only mission 1 did. Briefing and debrief cards stay read-only (they show before Start and after the match; `src/voice-story.json` `excluded` says why), and the Commander never speaks.
- **One voice per character, everywhere:** Mira Vale af_sarah (clean), Tobi Okoro am_puck (clean, a touch quicker), Corvin Hale bm_fable (gritty radio, a touch slower), Tamsin Sol af_aoede (warm), Ilse Maren bf_emma (hushed), Teo Lind am_onyx (hushed), Juno Rask af_kore (warm), ECHO af_nova through the Wardens' machine chain (ring modulation and comb, slower). Kokoro-82M stock voices, local GPU, nothing cloned.
- **Light on phones:** one MP3 sprite per mission (mono 24 kHz 32 kbps; six long missions in two parts), 56-285 KB each, 7.9 MB on the server in all. Nothing is fetched before Start (not even on the briefing card); a match fetches its faction pack and only its own mission's story pack(s), the service worker keeps them (fc-voices), and the decoded story packs of the last mission are let go. The client carries no story text: a clip is found by a 32-bit hash of the exact English line (`storyHash`, the same in the generator), so the lazy audio chunk only grows by the clip index (voice-packs.json 11 -> 23 KB).
- **In step with the subtitles:** a line of play speaks when it shows in the dialogue box (EN, VI or KO text unchanged), and the box holds it at least until the voice ends; back-to-back lines follow one another with a 0.25 s breath, never overlapping or cut short (up to six story lines may wait); story lines still beat the announcer. Dismissing a line moves the voice on to the next one (or stops it). A staged scene's line speaks at once and the scene holds each line until its voice ends; Skip, Escape or Space stops it. Voices off silences them all.
- **QA:** every clip went through a Whisper large-v3 round trip: mean WER 0.007 over 416 clips, none above 0.1 (max 0.077). Fifteen lines were reworded for the voice only (`spoken` in voice-story.json; the screen keeps its text), e.g. "Ford ahead." is spoken "The ford is ahead.". The comparison folds British/American spelling, number words, compounds written two ways and a few true sound-alikes of names (Hale / hail). Listen page for the owner: `.tmp/voices/listen-story.html` (every clip by mission and character, with its WER).
- Tools: `node tools/voices/story-lines.mjs` extracts the lines from the mission data into `src/voice-story.json` (rerun after a story edit; the unit test fails while it is out of date), then `make-voices.py --packs story --qa` renders them.
- Tests: `tests/voice.test.js` (every line has a clip, index integrity, 300 KB per pack, lazy load of only the active mission's packs, order, breath, scene cut and skip, hush, Voices off); new browser suite `tests/story-voices.mjs` (`npm run test:story-voices`, CI group story-voices): mission 2, the Ashfall Chronicle in Vietnamese and the finale's two packs; requests after Start only, three lines in order without overlap, the Vietnamese subtitle over the English clip, a scene line cutting in and Skip stopping it, Voices off.

### Voices and an effects pass (W3, W12)
- **Units answer in words.** Selecting and ordering units gives a short spoken reply in your faction's voice (four takes each for select, move and attack, never the same twice running); tapping fast gives at most three replies in six seconds, and a reply never cuts in or waits. Quiet mode (now "Quiet mode: no unit replies") still silences them.
- **An announcer** speaks the big moments: base or units under attack, unit or building lost, construction and research complete, unit ready, objective complete / failed / updated, attack incoming, Defence waves incoming and cleared, points captured and lost, enemy sighted, victory and defeat. Each event has a cooldown; announcer lines cut a reply short and wait briefly behind each other.
- **Each faction sounds like itself:** Meridian clean and polite ("Ready, Commander."), Ashfall gruff and clipped on a crackling radio ("On the clock."), Sunward warm traders ("Collecting the debt!"), the Wardens ring-modulated machines ("Awaiting directive."), the Veil hushed scholars ("The record is open."). Ten story lines of mission 1 (Vale, Okoro, Hale) are voiced, matched to the line on screen.
- Made offline with Kokoro-82M (Apache-2.0, stock voices, local GPU; tools/voices/make-voices.py), processed per faction and packed into one MP3 per faction (190-290 KB; 1.35 MB for all six packs). Nothing loads before a match starts: only the player's faction pack (and the story pack in mission 1) is fetched, then kept by the service worker (fc-voices). English audio; Vietnamese and Korean players keep their on-screen text (Kokoro has no VI/KO voices).
- Settings > Audio: **Voices** switch (on by default) and **Voice volume**, direct, EN/VI/KO. Music dips 7 dB and effects 4 dB under a voice line. Mute, the master volume and pause apply.
- **Effects pass:** rounds on vehicles and machines ring as metal (`impact:metal`), infantry fall instead of exploding (`fall:body`), creatures bite and spit acid, Warden Halos and Vault sentinels fire charged bolts, the Veil Moth pulses, the iron bosses fire an autocannon (they all borrowed the Vanguard's SMG), the 13 abilities that were silent (Rush, Dash, Spurs, Burn line, Shield link, Brace, Shadow strike, Mark, Crossfire, Steady aim, Ram, Ambush, Reinforce) have casts, and interface beeps are button clicks. Eco quality (phones) plays at most two thirds as many effects at once.
- Phone probe (390x844, CPU x4, 300-unit fight, three runs): audio director main-thread time 3.3 -> 2.7 ms a frame (p95 10.4 -> 5.8 ms); frame time unchanged. The lazily loaded audio chunk grows 37 -> 62 KB (the line text and clip index). Sim untouched: golden pins identical.
- Tests: `tests/voice.test.js` (scheduler rate limit, priority, off switch, settings persistence, pack budget, effect families); `tests/audio.mjs` checks no pack before Start, a spoken reply, the announcer cutting it, the duck, a story line, and that Voices off stops playback and survives a reload.

### Replay viewer (W6 replay value, plan B3)
- Every finished match built from the start in one sitting keeps a replay: the options it was built with and its command log (the simulation already logs every accepted command with its tick). The three newest are stored (`frontier-replays-v1`, at most 200 KB each; a 3-minute mission is about 11 KB, a 22-minute one about 56 KB); full storage drops the oldest. A match continued from a save has no replay (its log starts at the save).
- **Watch** on a match history row plays it: a fresh simulation from the stored options, the recorded commands fed in before each tick by the normal frame loop, so it looks exactly like play. A bar at the foot of the screen: Play / Pause, ×1 ×2 ×4, time and track, Exit replay (44 px taps; Space toggles it). The command dock and order controls are hidden and the simulation refuses every command but the replay's own; nothing in a replay is saved, scored or added to history, achievements or challenges; decision cards take the recorded answer and story scenes are skipped.
- At the end the final state is checked against the recorded hash: "Replay complete: it matches the recorded match", or a clear message that it drifted because the rules changed. A replay made by another game version is listed with the reason ("recorded with version X and cannot be played in version Y") and no Watch button.
- No simulation change and no new simulation state: the options are remembered beside each match (`rememberOptions` in `src/main.js` createSim, a WeakMap in `src/meta/replay.js`), the hash is read once at the end, and the viewer's command lock is an own function, which serialize never writes. They must be the constructor's options: a saved match's options give the adjusted AI speed (a mission's speed is stepped by the difficulty when built, and some missions raise it in play), which drifted a 22-minute mission in testing. Frame hooks: `S.replay.feed` before each tick, its speed as the pace, paused holds the clock (`src/app/frame.js`); autosave skips a replay (`src/app/match-flow.js`).
- A Defence replay runs past the first-build guide's clock hold (`!S.defenceGuideHold || S.replay`).
- Phones: the daily challenge strip follows the mode's own setup (after the Commander rows, under the sticky Start on a scroll), so the map pickers and the campaign's first missions stay on the first screen (`mobile-controls`, `openings`); the Records tile in the quick row shows both counts (★ achievements · ✓ challenges today).
- Tests: `tests/meta-replay.test.js` (a scripted Skirmish and a Veteran story mission replay to the same hash through JSON, a changed log drifts, commands land on their own ticks, version and damage messages, no new simulation field and an own command function leaves the hash alone, storage cap and full storage); `tests/meta.mjs` records 6 s of real play on each viewport, watches it at ×4 to the recorded hash with no dock and commands refused, and checks the other-version row; `tests/rules-hook.test.js` checks createSim remembers its options.

### Match history (W6 replay value, plan B2)
- The last 20 finished matches (Skirmish, campaign, Chronicles, Defence; not Training) in the Records screen, newest first: result (Victory, Defeat, or a Score for Endless and Daily), mission, level or map, mode, your faction vs the rivals in a Skirmish, date and match time, kills and units lost, and the medal, stars or waves held. Stored in `frontier-history-v1` (`src/meta/history.js`): cleaned on load, capped at 20 rows (about 6 KB), silent when storage is blocked.
- The Records screen gets a row of four direct jump buttons at the top (Challenges, History, Achievements, Rewards; each section is also on the page, nothing behind a menu).
- Tests: `tests/meta-history.test.js` (cap, newest first, cleaning, storage); `tests/meta.mjs` checks the row after a win and the History jump at three viewports.

### Medal cosmetics (W6 replay value, plan C7.3)
- Nine rewards earned with medals, achievements and challenge days (`src/meta/rewards.js`): paints **Laurel** (gold in all of Act 1), **Silverline** (5 achievements), **Crimson** (3 challenge days), **Obsidian** (15 achievements); emblems **Laurels** (10 gold medals) and **Medal** (10 achievements); title banners **Daily Challenger** (1 challenge day), **Golden Commander** (gold in all of Act 3), **Decorated** (20 achievements).
- Picked in the Skirmish setup's existing Commander rows, one button each beside the rank items; a locked one is shown disabled with how to earn it. An unlock shows a toast, a "Rewards unlocked" row on the results and the reward in the Records screen ("Medal rewards", 1 / 9...).
- Looks only: an item is an id, a label, a swatch/tint or glyph and its unlock. The paint is the same view tint as the rank paints (no material, no draw call); no simulation file imports a cosmetic and a match plays to the same hash with every paint (`tests/meta-rewards.test.js`). The rank profile keeps a pick only while its unlock holds (read from the service record's summary).
- Korean: two W6 strings reworded to pass the catalog checks (no digit in "Complete an optional objective", a font-covered word for Crimson).

### Daily challenges (W6 replay value, plan C7.1)
- Three short goals a day, one each for Skirmish, the campaign and Frontier Defence (13 in the pool: Swift strike, Iron line, Sky scout, Two fronts, Hunter; Expedition, Polished, Extra mile, Tactician; Hold the road, Three stars, Promotion, Endurance). The local date alone picks them (`src/meta/challenges.js`, fnv1a of date + group), so the same day gives the same three on every device; nothing in a match reads the clock.
- Shown as three direct tiles under the quick row on the title (and in the Records screen); one tap picks the mode the challenge is played in. A finished match that meets one pays +50 Commander XP once (results row "Challenges complete", a toast); all three on a day count a **challenge day**, which the medal cosmetics read. Stored in `frontier-challenges-v1` (today's done list, challenge days); a new day starts fresh.
- Tests: `tests/meta-challenges.test.js` (same date -> same set, rotation over 60 days, every test, paid once, set once a day, storage, EN/VI/KO); `tests/meta.mjs` pins `?day=2026-11-25`, checks the tiles at three viewports, a one-tap mode switch, and a win meeting Iron line.

### Achievements 13 -> 25 (W6 replay value)
- Twelve new achievements beyond the campaign: **Golden act** (gold in every mission of an act), Skirmish (**Field victory**, **Three fronts** vs 3 AI, **Unbreakable** vs Relentless AI, **Know your enemy**: beat all five factions), Frontier Defence (**Line holder**: 15 stars, **Field marshal**: Field commander Rank 5, **Steel rain** / **Rally the line**: a Defence win with that commander branch), Kites (**Eyes in the sky**: train 10, **Falling star**: land 3 Dives) and taming (**Wyrm whisperer**). Each has an icon, EN/VI/KO text and progress where it counts up.
- A new service record (`src/meta/record.js`, localStorage `frontier-record-v1`) keeps lifetime counters from every finished match and the W6 achievements once earned; the campaign's 13 stay in the campaign progress. Old profiles load with an empty record (nothing to migrate); corrupt data reads as fresh; counters are capped and the record stays under 4 KB.
- Earned achievements show a toast at the top (taps pass through it; never over the dock or minimap); a Kite Dive, a tamed Wyrm or a commander rank earn theirs mid-match, a win's on its results screen ("Achievements earned"). The match counters (`src/match-stats.js`) now also count Kites trained, Dives, creatures tamed and abilities used, from the events the simulation already sends (no simulation change, pins identical).
- A **Records** tile in the title's quick row (one tap) opens the Records screen with all 25, grouped, with progress bars; the campaign archive counts all 25 too.
- Tests: `tests/meta-achievements.test.js` (every condition, record migration, EN/VI/KO), `tests/meta.mjs` (new CI entry `w6`: tile, screen, toast and results row at three viewports).

### iPhone: sideways swipes stay in the game (friend's report)
- Swiping left or right near the bottom of an iPhone could switch apps again: since the 2026-11-22 HUD passes the portrait Selection dock's sideways action row (build, train, abilities) sat 24 px above the screen bottom, inside the home-indicator strip, and the minimap 20 px. Every bottom bar now starts above a 34 px strip (or the bottom safe area if larger; `--home-zone` in `src/mobile.css`), so no sideways row, map drag or camera drag starts there; the Defence "Crew a pad" button lines up with them. A battlefield touch within 20 px of the left or right edge no longer starts Safari's back swipe. Rules in docs/TESTING.md ("iPhone gestures"); new `npm run test:iphone-gestures` (WebKit iPhone profile; Chromium on CI) checks the bottom strip in skirmish and Defence states, the edge guard and that play adds no history entries.

### Cheaper Kite scout (owner 2026-11-25)
- Your Kite scout costs 45 alloy and no energy (was 75 + 25) and trains in 8 s (was 12), so a spotter is cheap to send ahead to watch the enemy. Dive keeps 260 damage. The computer keeps 75 / 25 and 12 s (balance.json `player_cost` / `player_time`, only for the side you command; when the computer plays your side in AI-vs-AI checks it pays the base price), so AI matches are unchanged: golden pins, the AI census and the difficulty check (1v1 / 1v2 wins of 12, Relaxed..Relentless: 12/12/11/11 and 7/2/0/0, as before) match the values before the price change. A queued Kite refunds the price paid when cancelled, also after loading a save; the tile, its label and the field guide show 45 and 8 s.

### Field commander ranks (owner request)
- The Defence Field commander is bought up like the towers and the Armour squad, right on its own sheet (one tap, no sub-menu): **Rank 2** (180 alloy: shield 500 -> 700, Barrage 110 -> 160 damage), **Rank 3** (260: Barrage every 30 s instead of 40, Reinforce drops 4 Vanguards instead of 3, health x1.3), then one of two branches side by side, each with two ranks: **Artillery** (220: Barrage 5.5 m wide (was 4.5) for 200; 300: two shells 0.8 s apart and Barrage every 24 s) or **Rally** (200: 5 Vanguards for 28 s, health x1.3; 280: 6 Vanguards, health x1.6, damage x1.25, Reinforce every 28 s). Garrisons.json `commander.ranks` / `commander.branches`.
- Ranks are kept when the commander falls (it comes back with them, also when a rank is bought while it is down) and in saves. The sheet heading reads RANK n / 5, a line under the tiles shows Barrage and Reinforce figures and what the next rank adds, the commander tile carries rank pips, and the commander's gold trim brightens per rank (ember red for Artillery, pale gold for Rally; tints only, no new draws). The Barrage aim ring follows the wider Artillery burst. EN/VI/KO text.
- Easier only (upgrades add power): `check:defence` passes with identical bot results, since the DefenceBot buys no commander rank by default; golden pins do not move (a commander that buys nothing keeps exactly the old state). New `--commander late|first` on `tools/defence-check.mjs` measures them. Given free from wave 3, the full ranks lift Long Crossing Veteran from 2 stars 14 lives to 3 stars 20 (Twin Bridges Standard 18 -> 20 lives with Artillery); every other row was already 3 stars. Paid for: `late` (each step as soon as affordable from wave 5) passes every target but one (Three Roads Story 3 stars 20 lives -> 2 stars 11: the alloy went to the commander instead of towers); `first` (ahead of every tower) loses Three Roads on all difficulties and Gorge/Switchback Veteran. So the ranks are worth having but never the one good buy.
- Tests: `tests/defence-commander-ranks.test.js` (order, costs, abilities, respawn, save/load); `tests/defence.mjs` buys Rank 2, Rank 3 and Artillery through the sheet on every viewport.

### Breaker gun at rest (owner report)
- The Breaker's gun no longer droops when it is not fighting (it stowed 17° down on the move). Idle or moving it rests 6° raised with the barrels run in (74% length); to fire it runs out to full length and lifts 14°, eased both ways (no pops), recoil along the barrel as before. Each shot snaps the barrels in (to 78% within 0.1 s) and they run back out over 0.4 s, driven by the unit's own shot event (crewed towers too; off under reduced motion or Combat motion off). The barrel scales about its rear, so it stays seated in the turret. Defence Mortar crews pose the same way; reduced motion skips the tween, Unit motion off keeps the modelled gun. Same draw calls (34 phone / 78 PC in the test scene); `unit-rig.js` `BARREL_POSES`/`SNAP`/`stepBarrel`/`poseBarrel`, checked in `tests/unit-rig.test.js` and `tests/visual-combat.mjs`.

### Re-score fixes (AAA re-score 2026-11-25)
- Portrait phones: with a mixed selection, Map and the objectives flag stand just above the dock instead of over the unit-type chips; chips share the row evenly (seven types fit 390 px, and the PC panel too). A lone train tile (an HQ that trains only Harvesters) is never wider than a normal tile.
- Defence tower card: landscape tiles drop their picture so tier, cost, sell value and aim mode show (the heading drops its cut-off stat labels, so the sheet stays under the Next-wave card); portrait grows one row for the tower stats ("Air: no" was cut) and Info & stats is a 44 px button beside the name (it was an empty bar).
- Title, new players: the quick row (Quick battle, Full army battle) sits right under the campaign map above the mode row on phones (it was at y 2245 under the sticky Start bar). The separate "Start here · First lesson" tile is gone: the Training mode button carries a "Start here" badge instead (one way into Training; modes are never hidden).
- Abilities on phones: names take two lines in portrait (no "Khóa mụ…"), landscape tiles show a short name over the status (was "Ready 2/2" alone). New short names: Boost, Lock, Cross, Aim, Burn, Spur (EN/VI/KO). i18n: a catalogue key in exactly the shown case wins over the case-insensitive match, so the ability "Overdrive" reads "Tăng tốc" and only the boss state "OVERDRIVE" reads "QUÁ TẢI". Vietnamese and Korean touch-row labels may wrap to two lines ("Thông tin" was cut at the screen edge).
- PC: order labels 11 px (were 10), Focus base 36 px (was 21), top-bar icon buttons 40 px (were 36).
- A mission without a supply source shows its head count alone ("20", not "20 / 0").
- Your team wears your faction's colour when you command another faction with the default colour (Ashfall Chronicle: coral, not Meridian mint); a colour picked in Settings still wins.
- Night missions: models (units, the Vault Sentinel, buildings) get a stronger moonlit rim and light 22% of their own colour; ground, water and sky stay dark.
- Defence Field commander: its own 500 shield (was the Battle tank's 100; owner request). Easier only: `check:defence` passes with the same bot results. Golden pins re-recorded (reason: the commander's larger shield is in every DefenceBot game's hashed state; result, stars, lives and towers identical in every pin, hashes only): golden-defence (d-gorge, d-bridges, d-crossroads, Endless 12), golden-r3c, golden-r3q, golden-round2, golden-story (m02b/m11c), golden-w1f, golden-w2b (Heroic levels), golden-w2f (m11c), defence-deck D3/D4, defence-text d-crossroads serialize checksum.
- Full army: checked headless for every faction (attack-move at 3 s and 10 s: every faction wins; starting army values within 10%); Meridian is not weaker, so no setup change. `tests/quick-battle.test.js` guards it.

### Defence pads: build spots you can see, more reach for short-range crews (owner report)
- Empty pads now look like build spots: a warm stone hex with a brass ring and a small tower glyph on top (one more instanced draw for every pad of the match, about 200 triangles, no per-frame allocation). The marker pulses gently until the first pad of the match is crewed (steady under reduced motion), an empty pad brightens under the mouse on PC, and crewed pads keep their tier colour without the marker.
- "Crew a pad": with nothing picked in a Defence match, one tap picks the best empty pad (on the roads the next wave walks, the free pad that covers at least 80% of the best road coverage and meets the column earliest; deep pads last) and opens its crews. A tile in the command card on PC, its own button in the free bottom-right corner on phones (the folded dock hides the card there; the phone framing keeps pads out from under it). The guide's pad while the guided first build runs.
- Hold the River says what kind of mission it is: the briefing's first intel line and the title card of every campaign Defence mission read "Defence: no base — crew the pads beside the road" (Vietnamese and Korean). Portrait phones lift the radio line above the Next wave card (it covered it).
- Reach (garrisons.json `tier_range`: the metres each tier adds for that crew, in place of the shared 0/1/2): Ranger nest 13/14/15 m -> 14/15.5/17.5, Tank emplacement 13/14/15 -> 14/15.5/17.5, Breaker mortar 11.5/12.5/13.5 -> 12/13.5/15.5, Scorcher flame trap 6/7/8 -> 7/8.5/10; Anti-tank (15/16/17) and Watcher (16/17/18) unchanged. Branch and rank reach adds on top as before. The tower sheet, tile titles and range ring show the new reach (to half a metre).
- Pads set far back from the road moved nearer (same kind, same spacing rules): Gorge Road and Hold the Valley d1, d2 (6.7 m: a Ranger crew there covered no road at tier 1), d4 and g10; Twin Bridges and Hold the River s8 (3.6 m); Amber Canyon d1 and d2 (about 1.5 m); the Chronicle copies of those maps follow.
- Measured with the new `node tools/defence-coverage.mjs` (road metres in reach from every pad, per crew and tier, with the high-ground bonus). Worst pad per level, Ranger tier 1 / tier 3 before -> after: Gorge d2 0/8 -> 17.5/50.5 m, Twin Bridges s8 11/14 -> 19/38, Switchback d1 15.5/22.5 -> 19.5/29.5, Fordwood f12 17/24 -> 20.5/31, Amber Canyon d2 7/13.5 -> 14/22.5, Long Crossing l11 12.5/20 -> 16/30.5, Three Roads s1 16.5/20.5 -> 19/26 (every worst pad +27% or more at tier 3).
- Easier, never harder: `check:defence` passes with every bot target met (Three Roads Standard 2 stars 15 lives -> 3 stars 20 lives). On Story only, a single-crew player may now reach 3 stars on up to 4 levels (was never): the longer reach lets Breaker-only or Flame-trap-only play carry Switchback, Canyon and Long Crossing on the easiest difficulty; Standard and Veteran keep the strict rule (tools/defence-check.mjs `STORY_GREEDY_MAX`). Heroic: single-crew play must now lose on at least 4 of the 7 Heroic levels (was 5; it now holds Fordwood, Canyon, Long Crossing).
- First load: the pads are rebuilt if their mesh ever leaves the scene, and are never frustum-culled as one sphere (a zone pad added later could be culled). A new version waiting in the service worker now shows "New version · tap to reload" in the top-left notice lane (EN/VI/KO); a tap saves the match, lets the new worker take over (`skipWaiting` on request) and reloads, instead of the old build running on until every tab is closed.
- Golden pins re-recorded (reason: the reach and pad changes above move every DefenceBot game; results, stars and lives equal or better except m11c's full run, 18 -> 17 lives): golden-defence (d-gorge, d-bridges demolish, d-crossroads, Endless to wave 12), golden-r3q, golden-round2 (Heroic d-gorge, d-longcrossing, m11c 120 s), golden-story (m02b, m11c), golden-w1e, golden-w1f (padAim), golden-w2b (all seven Heroic levels), golden-w2f (m11c 120 s and full), defence-deck D3/D4; the m02b mission checksum (tests/wings.test.js) for its new intel line and pad.
### Kite scout: twice the sight, and Dive (owner request)
- The Kite scout sees 32 m (was 18 m), about twice a soldier, so you see the enemy coming from far away. It still reveals hidden units only within 8 m. A computer Kite sees that far only in a Fast or Relentless skirmish; on Relaxed, Normal, story missions and Defence it keeps 18 m.
- New ability **Dive** (tap the tile; never auto-cast, so Auto-cast does not throw your scouts away): the Kite crashes into the nearest enemy vehicle within 10 m for 260 damage, 40% to enemies within 2 m of it (a quarter of that to infantry and buildings), and is lost. Two Kites leave a Battle tank on 100 health, three destroy it. With no vehicle near, the tile reads "No vehicle near" (phones: "No vehicle") and a tap does nothing. A streak from the Kite into the vehicle, a blast and a falling whine. New glyph: an arrow diving onto a tank. Vietnamese and Korean text. Computer Kites dive only in a Fast or Relentless skirmish.
- Golden pins re-recorded (reason: Kites see 32 m, so their side's fog, which is in the hashed state, opens further; Fast/Relentless computer Kites may dive): golden-skirmish highlands x2 Relentless 180/300 s and riverlands x2 Fast 300 s, golden-expanded Veil 500, golden-r3h mission 330/600 (the player's Kites in The Sovereign Walks), golden-r4p1 fast 420, golden-w2d 600 (a Normal computer Kite's 18 m is now saved against the 32 m definition). Defence and the other story pins did not move.
- Difficulty gate (`tools/difficulty-check.mjs`, bot wins, before -> after): every 1v1 and 1v2 row unchanged against Meridian, against Veil (`--enemy veil`) and with the Field plan and Expanded roster. `check:missions`: every target met; only m11d The Sovereign Walks changed (objective bot 504 -> 491 s, 17 -> 14 units lost, gold). `check:defence`: identical.

### Faction roster: four new units, Full army per faction, Quick battle rivals, Wild frontier on more maps
- Sunward workshop (Waystation, Expanded roster): **Lance buggy**, a fast tank hunter (170 HP / 30 shield, speed 5.8, 18 damage every 1.8 s at 11 m, 3.5x to vehicles, picks tanks and siege first; 140 alloy / 60 energy, 2 supply). Infantry and Anti-tank soldiers beat it.
- Wardens workshop (Shield pylon level 2, Expanded roster): **Bulwark**, a two-legged shield walker (420 HP / 180 shield back after 3 s, 14 damage every 0.9 s at 7 m, 1.6x to close assault; 175 / 80, 3 supply). Its ward plate: your other units within 6 m take 15% less damage (no stacking).
- Veil flyer (Command core level 2): **Veil moth**, hidden while it holds fire, shoots Rangers and rocket teams first (150 / 40, 12 damage every 1.2 s at 7 m; 160 / 80). Wardens flyer: **Halo interceptor**, 2.5x damage to flyers, weak against ground (240 / 120, 10 every 0.8 s at 9 m; 175 / 85); the computer builds it only after it has seen enemy flyers. Every faction now has its own flyer; the Wardens roster has 8 slots like the others.
- Blender models (tools/blender/generate_roster.py, 1416 to 3524 triangles), portraits, role glyphs, weapon looks, Vietnamese and Korean text, field guide ward line. Balance numbers: docs/BALANCE.md "Faction roster (2026-11-24)".
- Full army battle: your faction's own units (the Wardens no longer get Medics and Engineers), two of each workshop unit, and two of your faction's own flyer (it was Hawks for everyone).
- Quick battle: the rival rotates Ashfall, Sunward, Wardens, Veil (Meridian when you play another faction), counted per browser; still Relaxed, and the test bot wins all 240 pairings.
- Wild frontier: the rule now also plays on Dry Reach, Golden Heart and Copper Basin (balance.json `wild_frontier.lands`); every nest is standable and reachable from every camp (tests/roster.test.js).
- Golden pins re-recorded (reason: the Veil and Wardens Command cores train the new flyers and an Expanded Shield pylon trains the Bulwark, so their trains lists in the hashed state and Veil/Wardens AI play change): golden-skirmish Sunward mixed and Ashfall against Veil, golden-w1a, golden-w1c, golden-expanded Veil, golden-round2 300 s.
- Difficulty gate (`tools/difficulty-check.mjs`, new `--enemy`): bot wins unchanged in every 1v1 and 1v2 row against Meridian, against Sunward / Wardens / Veil with the Expanded roster, and against Wardens / Veil Classic (only change: Veil Expanded 1v2 Relaxed 6 -> 7 bot wins).

### Faction depth: signature abilities and either/or doctrines (owner approved)
- Every faction's own ground unit now has an ability, cast on its own (no button needed on phones): Supply wagon (Sunward) **Spur on**, allies within 7 m move 30% faster for 5 s (cooldown 30 s); Sentinel drone (Wardens) **Shield link**, it and allies within 6 m regain 40 shield at once (30 s); Shade (Veil) **Shadow strike**, from hiding it lunges 40% faster for 4 s and its first hit deals 60 extra damage (25 s). Computer sides use them only in a Fast or Relentless skirmish.
- Doctrines: at level 2 the Command core, Barracks and Foundry each offer two upgrades for the match, side by side; one tap picks and the other locks. Paid mostly in energy (the energy sink): Command core Energy grid (+25% energy, 50/100) or Reserves (30% of a lost fighter's alloy back, 0/150); Barracks Field rations (infantry +12% speed, 0/125) or Drill (recruits one rank higher, 0/175); Foundry Tuned engines (vehicles +15% speed, 0/150) or Repair crews (vehicles mend 1.5%/s out of combat, 50/150). Portrait phones show the pair in the order row beside Rally; computer sides take doctrines only in a Fast or Relentless skirmish.
- Golden pins re-recorded (reason: Fast and Relentless skirmish AIs now take doctrines and cast the signature abilities): golden-skirmish highlands x2 Relentless, riverlands x2 Fast and basin x3 Fast at 180 and 300 s; golden-expanded Veil 300 and 500 s; golden-r4p1 fast 180 and 420 s. Relaxed, Normal, Defence and story pins did not move.
- Difficulty gate (`tools/difficulty-check.mjs`, bot wins out of 12, before -> after): 1v1 Relaxed 12 -> 12, Normal 12 -> 12, Fast 11 -> 11, Relentless 11 -> 11; 1v2 Relaxed 7 -> 7, Normal 2 -> 2, Fast 0 -> 0, Relentless 1 -> 0 (within the gate's margin). `check:missions`: every row identical.
### Support units hold the rear (owner request)
- Your Medics, Engineers and Supply wagons do not attack, so they are sturdier: Medic 75 + 30 shield -> 95 + 55, Engineer 100 -> 150 health, Supply wagon 240 -> 340 health (balance.json `player_hp` / `player_shield`, applied to your side, team 0, when the unit appears, and saved). Computer sides keep the old values, so the buff does not make the computer stronger (owner rule). Prices stay. Alone under fire a Medic now lasts 11.9 s (was 8.5), an Engineer 13.6 s (10.2), a wagon 27 s (20). A Stalker's Steady aim still drops a Medic in one shot.
- Support units walking with fighters never lead: they keep about 3.5 m behind the nearest fighters (measured toward the nearest enemy), step up behind a wounded fighter to heal it, and fall back about 10 m when below 40% health. Tapping an enemy with a mixed group no longer sends Medics and Engineers onto the enemy's spot; with Group pace off they follow the fighters too.
- The Army button selects fighters only; idle Medics, Engineers and wagons within 12 m of the fighters follow them on their own. Tap one, or its chip, to give it orders. A Medic healing nearby no longer counts as an idle army unit.
- A mixed selection shows a flat row of type chips (role symbol and count): one tap selects only that type, a tap on the lit chip brings the group back. Phones: the row takes the place of the group heading; PC: of the HP/Shield/ATK line (the unit roster stays).
- Phones: a tap within 26 px of your own unit picks it before a building, the ground or an enemy (a tap right on an enemy with units selected still attacks); tapping the same spot again steps to the next unit there.
- Harvesters: a repair sends only the two nearest; after building or repairing they go back to their last deposit. Idle Harvesters repair damaged buildings near a Command core on their own, only while no enemy is near, and stop when one comes close.
- Golden pins re-recorded (reason: Medic/Engineer/Supply wagon health; every pinned result, star count, lives and tower string is unchanged, only state hashes moved): golden-defence d-bridges demolish, golden-expanded Meridian 300/600 and Veil 300/500, golden-r3h mission 600, golden-r4p1 fast 420, golden-round2 Heroic d-longcrossing and arena 300, golden-skirmish highlands 180/300, riverlands/basin/dunes 300, golden-w2b Heroic d-longcrossing/d-bridges/d-canyon, golden-w2d 600.

### Integration (round 5): faction depth + map variety + support units + faction roster + settings sheet + creature story
- Creature story merged on top: the portrait atlas now has 45 cells in 4 x 12 (roster's four units before the reserved ironsovereign2 cell, Acid Hound and Vault Sentinel after it; composed from both branches' renders, `src/portraits.css` 1200%); the campaign creature step runs after the doctrines (order 42); wings checksums take m11 from map variety and m02/m04/m05/m08/m09/m12 from the creature round; `check:missions` m02 window 300-1200 s (the bot banks the den's alloy: 317 s, was 367 s). No golden pin moved.
- PC build cards: the doctrine pair takes a row of its own under the training tiles with Upgrade beside it (the card is one 44 px row taller, 154 px, while a pair is on it) instead of a fourth column, so the console is as narrow as before (940 px at 1920, 760 px at 1280 and 1024; it was 976 / 832 / 792 and the five queued jobs were cut at 1280). Below 1700 px the tile picture is 24 px (was 34), so a name and its "Needs L2" line have 91 px (was 79): Linux fonts no longer cut "Medic" / "Anti-tank" (CI run 45350601918, status-layout "Readable command labels").
- Portrait phones: with jobs queued and the doctrine pair showing, the jobs take their own row and Rally with the pair the row under it (the pair covered all jobs but the first; on 320 px all of them). Landscape phones: doctrine labels at 13 px like every tile name there, on up to two lines so Vietnamese fits the half-width tile, and the "or" chip sits in the second tile's bottom-right corner (phone tiles clip their contents). On PC the taller card also lifts the boss bar (it reads the same height). Browser suites air and story expect the core's doctrine pair after its four tiles (not on portrait phones at level 1).
- Golden pins re-recorded for the combined branches (reasons: Fast/Relentless AIs take doctrines and cast signature abilities; Medic/Engineer/Supply wagon health): golden-skirmish highlands x2 Relentless 180/300, riverlands x2 Fast 300, basin x3 Fast 300 (and their reload pins); golden-expanded Meridian 300/600 and Veil 300/500; golden-r4p1 fast 420. Map variety (m04b, m02c, m11 on Twin Rivers, m06c night) moved no pin.
- With the faction roster merged on top (reason: all three causes, plus the Veil/Wardens cores training the new flyers and the Expanded Shield pylon the Bulwark): golden-skirmish riverlands x3 Sunward against mixed 60/180/300 and dunes Ashfall against Veil 60/180/300 (and reloads); golden-expanded Veil 300/500; golden-round2 arena 300.
- Support health for the player only (reason: computer Medics/Engineers/wagons back at 75 + 30, 100, 240): golden-skirmish highlands x2 Relentless 180/300, riverlands x2 Fast 300, basin x3 Fast 300, dunes Ashfall against Veil 300 (and reloads); golden-expanded Meridian 300/600 and Veil 300/500; golden-r3h mission 600; golden-r4p1 fast 420; golden-round2 arena 300 and Heroic d-longcrossing; golden-defence d-bridges demolish; golden-w2b Heroic d-longcrossing/d-bridges/d-canyon; golden-w2d field 600. A team 0 the computer plays (AI against AI, `aiPlayer`) counts as a computer side, so those pins went back to their faction depth / roster values (golden-skirmish basin/highlands/riverlands/dunes 300, golden-expanded Meridian and Veil, golden-r4p1 fast 420, golden-round2 arena 300, golden-w2d field 600; tools/ai-census-check.mjs highlands Ashfall against Meridian decides again). Every defence result, star count, lives and tower string is unchanged. Difficulty gate (bot wins of 12): 1v1 Relaxed 12, Normal 12, Fast 11, Relentless 11; 1v2 Relaxed 7, Normal 2, Fast 0, Relentless 0 (Relaxed and Normal equal to b854e66; Relentless 1 -> 0 came with faction depth, within the margin).

### HUD buttons stand out (owner request)
- In a match the dock panels are darker and every button lighter with a 2 px brass edge (was 1.03:1 face against panel). Each tile carries a rail in the colour of its job: build amber, train mint, upgrade green, ability orange; the active stance or ability a gold rail.
- Tiles you cannot afford show the short price in red-orange and a faded picture (still tappable); locked tiles are dark and grey.
- Build tiles carry the building's own symbol as a corner badge. Box select, Queue, the Map tab and Objectives have their own symbols (no longer Fullscreen's corners or the Rally flag). Icon strokes are 2 px on phones.

### Map variety
- Cut the Draw (m11) is fought on Twin Rivers instead of Frontier Expanse (the battlefield of m11d and the finale): two conduits between the rivers, the north one across the far river by the Ashfall camp, a Meridian tower at the west ford. The objective bot wins sooner on every difficulty.
- Gun Hill (m06c) is a night battle.
- New campaign map Mirror Lake, the first with a lake: a ring of water round an island hill, four wadeable fords lined up with its ramps (terrain `lakes`; old maps unchanged).
- New optional Act 1 missions: Mirror Lake (m02c, after Hold the River: break the island gun, raise a tower there, hold the relay a minute) and Canyon Run (m04b, after Three-Way Dunes, at dusk: no base, bring four supply crawlers up Amber Canyon in two pairs, then burn Hale's outpost). Act 1 relays now sit 13.3% apart.

### Campaign round 5: Gun Hill and test repairs
- New optional Act 2 mission Gun Hill (m06c) on the campaign map Highridge: build two Sentinel towers on your hill (only towers inside the hill count) and hold it for 5:30; an optional Ashfall gun nest on the far hill. Act 2 relays on the campaign map now sit 13.3% apart.
- New optional Act 3 mission Crown Hill (m10b) on the campaign map Gun Hills: break three Warden towers on the central hill (firing uphill), then raise your own tower there against a counter-wave. Act 3 relays now sit 13.3% apart.
- Golden pins re-recorded (reason: Breaker Barrage cooldown 40 -> 32 s and Anti-tank 4x to flyers): golden-expanded Veil 500 s, golden-r4p1 fast 420 s, golden-skirmish basin x3 fast 300 s, golden-w2d 600 s.
- Landscape phones: the map enlarge button sits above the minimap, no longer on it (drags anywhere on the map move the camera). Portrait phones: alerts drop below a targeting prompt. PC command tiles: small text 12 px. Archive under the campaign map: its own row on desktop.

### Wild frontier: more Wyrm nests (owner request)
- The Battle rule on Amber Dunes now has a home nest behind each main camp and contested Elder nests in the free corners (five guards, a larger and stronger Elder Wyrm). Up to two Wyrms per side. The Wyrm art is redrawn with a darker hide, rounded jaw and team crest. The rule stays Off by default.

### Phone-length matches (owner request)
- You start with 6 Harvesters and 600 alloy in Skirmish and campaign missions with a base. Rivals keep 4 and 450.
- Skirmish maps get a full resource cluster (at least 2 alloy + 1 blue) about every 40 m: 9 on the smallest maps, up to 25 on the largest. No deposit is removed.
- Bot matrix (6 maps, 2 attack timings), wins out of 12 before -> after: 1v1 Relaxed 12 -> 12, Normal 12 -> 12; 1v2 Relaxed 8 -> 9, Normal 6 -> 7. Median 1v1 Normal 5.8 -> 5.2 min.

### Alloy expansions

Five skirmish expansion sites now have a second alloy outcrop within reach of the same Command core. The additional deposits keep their own IDs so older command logs still address the same units.

### A2.1 — Battlefield lighting

The horizon now follows the map's sky palette. Warm directional lighting and brighter energy cores make bases easier to pick out across the battlefield.

### A2.2 — Team markings

Units and buildings carry a strip of team colour on the model so their allegiance is visible against sand and grass.

### A2.3 — Combat effects

Ranger rounds leave a short rifle streak and a small contact spark. Shell and rocket blasts use a shorter glow, and damaged buildings burn lower. Unit hits shed sparks, dust or debris according to the weapon. Thin heal and repair cues leave the receiving unit visible. Phone rendering shares effect batches and gives hits on selected units priority during heavy fighting.

### A2.4 — Opening economy

The portrait Skirmish camera frames the Command core and its staffed alloy deposit together. A tool glint shows mining and a cargo marker follows workers carrying a full load back to base.

### A2.5 — Phone battle controls

Portrait battle controls leave more of the field visible with a unit selected. The Cancel action stays tappable while story dialogue is open, and Defence controls fit narrower headers.

## Unreleased: Round A

### Smaller, better-looking bosses (owner request)
- The Iron Vanguard and Iron Sovereign are redrawn in Blender (`tools/blender/generate_bosses.py`) so they no longer tower over the base: the Iron Vanguard is about 40% of its old height and the six-legged Iron Sovereign a quarter of its old width, a little over a tank. Portraits are updated.
- Campaign boss health is about a third: Iron Vanguard 32,000 to 11,000 (Story 9,000), Iron Sovereign in The Sovereign Walks 44,000 to 15,000 (Story 12,000, Veteran 14,000). The Defence Sovereign keeps its 10,000. The golden pins for those two missions are re-recorded for this change only.

### A7 — Large battles

Repeated blocked routes reuse navigation results until the battlefield changes. The frame loop budgets catch-up time, and health bars, selection rings and ground shadows share draw calls in crowded battles.

### A6 — Accessibility

Settings offers three colour-vision palettes and four interface sizes. The phone battle dock keeps its measured footprint at 130%.

### A5 — First minute

Fresh profiles can launch Training directly. Quick battle and Skirmish open with a skippable base fly-in and an economy objective.

### A4 — World edge

Biome-coloured foothills extend past the playable cliff and follow night and storm lighting.

### A3 — Infantry silhouettes

Six infantry models have wider helmet and shoulder silhouettes. Team paint has a stronger rim and the field guide and result cards share the rebuilt portrait atlas.

### A2 — Phone controls

Portrait phones share the selected unit header with Map and Objectives.

### A1 — Combat readability

Heavy impacts are larger, tracer trails last longer, and healing and repair have distinct symbols. The battle camera stays steady during strikes and building collapses.

## 0.26.0: AAA round 3 (proposed release notes)

Proposed, not released: nothing is pushed or deployed until the owner says "deploy". Every item below has its detail section further down ("Unreleased: AAA round 3") and a results file in `docs/aaa/results/round3/`.

### What players get
- **Command console look on every screen** (kit), one context panel on phones, and a phone battle HUD that leaves a clear area for the scene (about 15 to 20 points more of the screen shows the battlefield at 320 and 390 px).
- **Three languages:** English, Tiếng Việt and 한국어 (full catalogs, Hangul font, particles). It needs a native Korean read.
- **Fight:** Field command fields its army (A), squad orders (B), army depth with Barracks level 3, Combined squads and army sizes 100 / 150 / 200 (C), wings and rockets (W), weapon effects by class (X), battle readability (K), living buildings and south exits (L).
- **Look and sound:** warm kit and distinct silhouettes (F), night and storm looks (D), models and portraits (J), audio juice (U), victory ceremony and MVP card in every mode (V).
- **Story and campaign:** openings and a living campaign map (G), the painted campaign map, Boss phase 2 and "The Sovereign Walks" (H), campaign pacing (I).
- **Frontier Defence:** onboarding and readability (E), Heroic finale.
- **Menus and meta:** cover and menus across several worlds (M), Commander rank and unlocks with Daily orders (R), first-minute hooks: Quick battle, First watch, Scout Runner (Q).
- **Maps:** six new Skirmish maps (Golden Heart, Dry Reach, Twin Rivers, Ironback Ridge, Crown Mesa, Open Steppe; 13 in all) and an opt-in map engine.
- **Copyright:** all rights reserved, Bui Cong Nguyen, Solluxlabs.com.

### Integration and clean-up
- Kit polish (final pass): in landscape the Defence dock's Barrage / Reinforce / Field commander tiles no longer overlap (two tiles, then the commander full width); Start and Quick battle no longer cover each other on the landscape title; the result actions stay pinned at the foot of the card on short landscape and 320 px screens; desktop menu badges and the cover status label are 12 px.
- Dead code: five exports nothing read were removed (heroic affix names, ordnance palette alias, unlock labels, elite affix list, campaign land colours). No behaviour change: every pin, golden and baseline is identical.
- Owner decisions still open: `docs/aaa/results/round3/review-packet.md`.

## Unreleased detail: AAA round 3

### Command console kit on every screen; one context panel on phones (owner request)
- **Every screen in the kit's look.** This covers menus, campaign, Defence menu, Settings, pause, help, field guide, story cards, decisions, toasts, objectives, tooltips, command tiles, results, and the desktop and Defence HUDs.
  - Corners are chamfered and edges are 1 px.
  - There is one flat gold primary action per screen.
  - Selected controls show a cyan edge and a 2 px bottom rail; focus shows a cyan ring.
  - Speaker portraits are round.
  - Settings switches say On / Off.
  - Desktop tooltips show the name, then the role, then the cost.
  - The styles are in `src/kit-skin.css`, with the frames in `src/art/ui/`.
- **Phones: Selection and Actions are one panel.** The Selection tab shows the unit or building, its orders and all its actions in one row, each one tap. The tiles share the row equally: an icon over the cost, state or name. Build, train, abilities, stance and level-up are all there. The dock is not taller anywhere: 161 px for groups, units, Harvesters and buildings at 390×844.
- **Phones draw less.** Nothing is drawn under the open dock or the tab strip; the map still shows under the see-through top bar. Render-budget scenario `battle-dock-eco` added.
- Results, scores and heights: `docs/aaa/results/round3/kit.md`.

### R3 map variety: six new Skirmish maps
- **Six styles, like a real map pool** (all in the Skirmish battlefield picker with their size; a one-line idea as the option's tooltip; names and lines in Vietnamese and Korean):
  - **Golden Heart** (128 m, copper basin look): a ring of four crags around a rich heart (four 5,000 alloy and four 3,000 energy deposits, worth more than both camps' fields together) with roads in from every camp.
  - **Dry Reach** (160 m, dunes look): small deposits (1,300 to 2,000) spread wide, two mesas and scattered crags; expansions decide the long game.
  - **Twin Rivers** (160 m, riverlands look): two rivers, each crossed by a bridge on each flank and two fords inside: three lanes, contested deposits and the rings in the strip between the rivers; a cliff ridge from each river to the map edge splits the two camps of a bank.
  - **Ironback Ridge** (160 m, highlands look): a cliff ridge across the map with one pass in the middle and a flank path at each end, climbable ridge tops (four ramps a segment) and a ridge between the camps on each side.
  - **Crown Mesa** (160 m, woodland look): a mesa 48 m across in the middle, eight ramps (one facing each camp, one between each pair), its rich deposits and the centre ring on top; camps on the rim.
  - **Open Steppe** (128 m, expanse look): no water, no walls, closer camps, scattered crags and an X of roads through the centre: fast and aggressive.
- **Natural ground only**: no concrete walls on the new maps (`rocks: []`); crags and ridges are plateaus (a plateau without ramps is a crag).
- **Map engine, opt-in** (`maps.json`, documented in `docs/MISSIONS.md` "Map layouts"): `rivers` (any number of east-west rivers with their own bridges and fords: water, banks, building rules, ford slow-down and label, bridge models, ford marks, minimap ticks, channel, edge waterfalls, fish and reeds), `rocks`, `roads`, `deposits` with `symmetry: "quad"`, plateau `mirror: "quad"`, `look` (borrow a map's palette, light, dressing, life, grade and music), `dressing`, `blurb`. The seven older maps and the Defence maps build, render and play exactly as before (terrain and match fingerprints recorded before the change; ground texture, terrain, water and scatter geometry compared in the browser).
- **Fair for 2 to 4 players**: every new map mirrors on both axes, so all four camps start the same; data tests check determinism, symmetry, equal start distances, deposits and rings on clear ground and a route for the widest ground unit from every camp to every deposit and ring, and both rivers' crossings.
- **Not harder** (owner rule): on Relaxed and Normal, 1v1 and 1v2, the test bot wins at least as often on the new maps as on the older ones on average (table in the results; each map got a natural expansion near each camp, Twin Rivers its ridges, after the first measurements).
- **Checks**: `tests/maps-variety.test.js` (12 tests), the older map tests now cover the new maps where they apply, render-budget scenario `twinrivers-high` (the heaviest new map: 235 draws against large-map-high's line of 240), bot-against-AI difficulty table in `docs/aaa/results/round3/maps.md` with screenshots in `docs/aaa/results/round3/maps/`.

### Phone battle HUD: a clear area for the scene (owner request, Codex UI kit look)
- **More battlefield on every phone.** The map now fills the whole screen behind the bars.
  - The 12 px side margins and the bottom strip are still left to the phone's own swipes, but only for touches; they no longer show as a dark frame.
  - Free battlefield with nothing selected: 67.9% → 84.6% at 390×844, 69.1% → 81.6% at 844×390, and 57.3% → 76.5% at 320×568.
  - Every phone size, mode and selection gained at least 11 points. The table is in `docs/aaa/results/round3/hud.md`.
- **Top bar.** It is now two dark-glass panels with the map between them, instead of a solid strip. The left panel holds the resources and the clock. The right panel holds Full screen, Sound, Help and Pause.
  - In portrait the bar is one 44 px row instead of 86 px.
  - The logo no longer shows in a match: there it only opened the pause menu, and Pause sits beside it.
  - The ALLOY / ENERGY / POPULATION captions are gone; the icons and tooltips say the same.
- **Touch row.** On landscape phones 840 px or wider, the six touch buttons sit in the top band. The Objectives flag and the idle buttons sit in the corner under it.
- **Portrait.**
  - The Objectives flag moved to the end of the tab row, and its list opens above the tabs.
  - A group's six orders sit in one row (340 px or wider), so the card is one row shorter.
  - In Defence, a selected tower gets the short card: 113 px instead of 202 px.
- **Landscape.** The unit card drops the "Standing by" line, and five orders sit 3 + 2 instead of 4 + 1.
- **UI kit look.** UI kit design: Codex/OpenAI, owner-commissioned.
  - The kit's colours, spacing, corner cuts, frames and type scale are in `src/ui-kit.css`, ready for the menus and desktop later.
  - On phones in a match, panels and buttons have dark glass, cut corners and a thin edge.
  - A selected button gets a cyan line along its bottom, and toasts get a coloured bar on the left.
  - Four tinted frame SVGs are copied into `src/art/ui/`.
- **Unchanged.** Every action is still one tap, and nothing was moved into a menu. Text stays at least 11 px and taps at least 44 px, and no dock grew. The desktop HUD is the same.
- **Measuring.** `tools/phone-hud-audit.mjs` measures five phone sizes × Skirmish / mission / Defence × four selections. The minimum free-battlefield shares in `tests/phones.mjs` rose from 67% and 57.5% to 78% and 68%.

### Korean (한국어)
- **A third language.** 한국어 joins English and Tiếng Việt in the language picker on the start screen and in Settings (one choice, applied at once, saved like the others). `<html lang="ko">`.
- **Full coverage.** `src/locales/ko.json` has every message (1,242) and pattern (204) of `vi.json`; `src/locales/story-ko.json` has every story entry (826) plus 15 name-only entries (Korean writes names in Hangul). Both load lazily, like Vietnamese. A glossary for units, buildings, resources, factions and names is in `LOCALIZATION.md`.
- **Hangul font.** "Frontier KR" = Noto Sans KR (OFL), variable 400–800, subset to the ~800 syllables the catalogs use: one 92 KB woff2 (`tools/subset-korean-font.py`). Named only in the `:root[lang="ko"]` font stacks with a Hangul-only `unicode-range`, so English and Vietnamese players never fetch it. The Korean files stay out of the service-worker precache and are cached on first use.
- **Korean particles** (을/를, 이/가, 은/는, 와/과, (으)로) after filled-in names and numbers are resolved at run time (`koreanParticles` in `i18n.js`).
- **Also:** the Daily seed date ("21 Nov") is now translated in Vietnamese and Korean; chronicle cards and Defence level rows no longer mark faction and cast names `translate="no"` (the card label is `.chron-side`).
- **Size:** main JS +2.1 KB (+0.8 KB gzip), CSS +2.2 KB (+0.5 KB gzip); Korean-only downloads: ko 122 KB (43 KB gzip), story-ko 144 KB (52 KB gzip), font 92 KB.
- **Checks:** `tests/i18n-ko.test.js`, i18n-coverage for vi and ko, `npm run test:language` extended with Korean screens at 1440x900, 390x844 and 844x390 (`tests/language-ko.mjs`). Results and screenshots: `docs/aaa/results/round3/ko.md`.

### R3 map pass: the painted campaign map
- **The painting is the hero.** The campaign screen shows the owner-commissioned painted frontier (Codex/OpenAI ImageGen, `src/art/campaign/`): teal river meadows in the south, the copper basin, the northern Keystone. Desktop, tablets and phones in portrait use the 2560×1440 painting; landscape phones the 2560×900 strip panorama. One `<picture>` inside the map: nothing is fetched until Campaign opens, and only the painting the layout shows (592 KB or 491 KB, byte-identical to the source). The cover's nebula no longer backs the board.
- **Relays on their landmarks.** `MAP_ANCHORS` (`src/story/campaign-map.js`) carries the art README's 17 anchors per painting, keyed by mission id, with the side each name plate takes; `mapLayout` stays the fallback for a mission without an anchor. The painting, the route and the relays share one layer that covers the board like `object-fit: cover`, so they scale together (boards may be up to 12% wider than the painting on wide screens and 10% taller on landscape phones; the layer trims a few pixels instead of leaving bands).
- **Holo relay pins.** Won relays in their medal colour with a gold rim, the next mission a cyan beacon whose ring breathes outward (transform and opacity only; still under reduced motion or motion-off), the picked mission larger in a gold ring and halo, locked relays dim and dashed; Defence missions keep the square relay; R3-G's decision diamonds, answered marks, ending hints and merciful counter stay. 44 px taps.
- **Route and plates.** The route is one smooth SVG curve along the zigzag: walked legs solid gold, the leg to the next mission a cyan dash, the rest a faint survey dash, each over a soft glow. Mission names are small glass plates on the side the anchor table picks (never over the top-left calm area that holds the Act 3 title); act titles are plates at the left of each act's band. Small boards show only the picked and next plates.
- **Layout.** Desktop: the left command column (mode cards, mission list, Start) as on the title screen; the map large in the centre with the decisions legend in its header, the endings and the four chronicle cards in one row under it, and the briefing as a glass panel (title and story on the left, rivals and objective on the right). The list scrolls the picked mission into view above Start. Tablets: the map full width, endings beside the chronicles, the same briefing panel, the four modes in one row. Phones in portrait: the painting full bleed, the four modes (Training too) in one row, five missions above Start at 390×844 (three before); landscape: the strip beside a narrower setup column. Every control stays one tap away (`tests/cover-ui.mjs`).
- Fix: on phones in portrait, opening Campaign no longer scrolls the whole start screen (and the map) away to reveal the picked mission.
- Tests: `tests/campaign-map-art.test.js` (+4: anchors, fallback, 44 px spacing on the smallest boards, lazy art and CSS rules); `tests/story.mjs` counts relays from the mission list (17). Results and before/after screenshots: `docs/aaa/results/round3/map.md`.
## Unreleased: Round 4 Wild Frontier

Plan: `docs/aaa/AAA_ROUND4_PLAN.md`. Results: `docs/aaa/results/round4/p1.md`.

### R4-P1: the desert test on Amber Dunes (waiting for the owner's verdict)
- **A new Battle rule, "Wild frontier" (Off by default).** It plays on Amber Dunes only; elsewhere the row is greyed out and the rule never reaches the match. Off keeps every match exactly as before.
- **The Weather Spire.** A capture ring with a sandstone spire at the centre of the map (with capture points on it is the crossroads ring itself, so incomes and every rival's opening stay as they were). Whoever holds it gets one power, the **Sandstorm**: one tap on the always-visible Sandstorm button, one tap on the map (or the minimap). Every side sees a 3-second orange warning sweep on the ground and the minimap, then for 18 seconds enemies inside fire 30% slower and see only 4 m, and your units inside are hidden from them. It recharges in 90 seconds; a new holder waits 15 seconds.
- **The Dune Wyrm nest.** Three Wyrmlings guard a nest in the south-west corner and bite anything that comes close. Clear them and keep only your units in the nest for 30 seconds: a **Dune Wyrm** joins you (one per side). Its one ability, **Ambush**, casts on its own: it dives under the sand, the ground ripples for 1.5 seconds under the nearest enemy vehicle, then it bursts up for 150 damage. A vehicle that moves off dodges it. The nest regrows its guards 150 seconds later.
- **Rivals by speed.** Relaxed rivals never call a storm or tame the Wyrm. Normal rivals do so only late and rarely (from 10 and 15 minutes). Fast and Relentless rivals use both fully.
- **Art.** The Dune Wyrm and Wyrmling come from the Blender kit (`tools/blender/generate_wyrm.py`, five materials, 3,124 and 2,442 triangles, pending owner review) with portrait cells. The Spire, the nest, the storm and the ripple are drawn by a view plugin in at most 3 draws on screen.
- **Field guide** pages for both creatures explain the rule. All new text is in Vietnamese (Korean to follow when `ko.json` lands).
- Fixed in review: guards never rank up, and the rivals' counter-build and "join the fight" ignore them.

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
- Integration polish: landscape phones show every battle setting and Start on the first screen (one four-column grid); settings tabs share the header row in landscape; portrait and tablet heroes are shorter so more fields clear Start, with the squad centred under the logo; denser glass under the left column; settings rows, Defence sub-tabs and battle rules in the holo style; Defence notes and chronicle lock lines no longer cut or wrap over three lines; the hidden battlefield redraws at 2 Hz behind the start screen on desktop too.

### R3-G: openings and a living campaign map
- Mission openings: as a campaign mission begins, the camera starts on that mission's own landmark (the bridge, the plateau, the enemy camp, the enemy road or the objective), holds there with the act, title and place in the letterbox, then glides home to where the match starts. One shared fly-in with a table keyed by mission id (src/story/openings.js), 4.6 to 5.6 s, all 16 missions distinct (any two start at least 10 m apart). The match clock waits; Skip, a tap anywhere, Escape, Space or Enter end it at once; it plays once per mission per visit; reduced motion or "Animate combat effects" off skip it. The land is drawn without the fog of war while the camera is away (units and buildings out of sight stay hidden). The Quiet Vault opens on the night sky and its moon.
- Campaign map: a gold diamond marks each relay that still holds a decision, beside the answered merciful/firm marks; each ending names what leads there ("The Open Frontier: 2+ merciful choices", "The Meridian Line: 0-1 merciful choices") and the legend counts the merciful choices made so far.
- Desktop: the endings and the decision legend share one line and the four chronicle cards get the footer's full width, so their names no longer break mid-word and the chronicles stay above the fold down to 1280x720.
- Phones: the campaign screen shows three missions above Start (one before in portrait, two in landscape); endings keep short labels with their hint and chronicle cards keep the faction name; the landscape mode tabs keep their icons. Every control keeps its one-tap place.
- Dev hook `__frontier.jumpBoss(id)`: straight to a boss fight ("iron-vanguard" or a unit type), the map revealed and the army in front of it.

### R3-H: Boss phase 2 and "The Sovereign Walks"
- New optional Act 3 mission **The Sovereign Walks** (`m11d-the-sovereign-walks`, after Hold the Keystone Roads; opens when Cut the Draw is cleared, counts for medals, never for endings). On the Frontier Expanse at 5:00 the Iron Sovereign, refitted to walk, comes out of the north and marches on your Command core, stopping to fight whatever it sees. Three Ashfall relays wake with it and shield it: break them, then the machine. Okoro speaks the briefing; his Kite shows the Sovereign's entrance.
- The Sovereign's **relay shield**: an amber bubble and one tether from each standing relay; while any relay stands it takes 0.15x damage, and its bar reads RELAY SHIELD.
- **Phase 2** at half health: it plants itself for 4 s (OVERDRIVE on the bar, a "Phase 2: overdrive" name card, a blast, a heavy shake, the core blazing), sheds two Sentinel drones, the music rises, Okoro, Vale and Hale speak, and it switches to new attacks: a 24 m **rail sweep** (a line marked on the ground) and a **five-shell barrage**. Warnings still last as long as the walk out, and no attack takes more than 30% of a Ranger: spectacle, not a damage spike. In phase 2 the core keeps a hot glow.
- Gentle by design (owner rule): the Ashfall AI there never attacks on its own, one small probe and one escort come by script, two forward towers and ten units start on your line, and there is no time limit. The objective bot wins on Story, Standard and Veteran, all gold, and never lets the Sovereign reach the camp.
- Boss engine III (`src/sim/bosses.js`, optional data, used only by the new boss `ironsovereign2`): `phases` (new attacks from a health stage, with a surge), `ward` (relays that shield) and `march` (a field boss that walks on the enemy core). The Iron Vanguard and the Iron Sovereign play exactly as before (their pins hold).
- Model `ironsovereign2.glb`: the Iron Sovereign's port under its own name (pending owner review, round 3).
- Tests: `tests/sovereign-walks.test.js` (6), `tests/golden-r3h.test.js` (4 pins, one long), browser suite `npm run test:sovereign-walks` (CI matrix `r3-h`), render-budget scenario `boss-sovereign2-eco`.

### R3-J: Models and portraits (art 2)
- **Sentinel drone, Wardens look:** the team-coloured ball becomes an ice-white shell with the Wardens marks of the Walker and Pylon: a team crest fin, a team brow band, and two small tower shields with team stripes beside the twin emitters, over a steel halo and a lit thruster. Same four materials (no new draw), 2,516 triangles (budget 4,500).
- **Iron Sovereign, warm palette:** re-ported with the boss tool (`sovereign3` palette in `tools/port-boss-model.mjs`): a brass hull instead of the dark oxblood, so the team-coloured struts stand out on any side, crimson fittings, warm umber feet and bores, warm steel and a white-hot core. Same geometry, parts and bake classes (hull luminance about ×2.8 in the review render).
- **Lit windows** on the four buildings that had no light: the Shield pylon (control slits round the spine), the Salvage yard (an operator cab on the gantry), the Waystation (counter hatches) and the Field workshop (side windows). They use the `Window` material, so night and storm looks make them glow.
- **Portraits for every unit and building:** the atlas is re-rendered from the round-3 models and grows from 29 to 37 cells (4 × 10): the Carrier, Iron Vanguard, Gunner, Stalker, Iron Sovereign, Field workshop and Rampart now show their portrait in the HUD, command tiles and Defence intel instead of an icon, and one cell is reserved for the second Sovereign.
- All changed models are flagged "pending owner review (round 3)". Before/after sheets: `docs/aaa/results/round3/j.md`.

### R3-K: Battle readability
- **Type icons at the widest zoom.** Zoomed all the way out (within 2 of the widest zoom: 88, or 96 on a Defence Overview), every unit you can see carries a small team-coloured tile with its class glyph: hammer (Harvester), blade (melee), round (ranged), shell (siege), cross (support), tank (armour), rocket (anti-armour), wings (air), truck (transport). They share the status-icon atlas and its single draw; closer in they are gone.
- **Group badges.** At close zoom (56 or less) each unit in a Ctrl+number group shows its group number (the lowest if it is in several) on a navy tile with a warm rim; the digit is at least 11 px tall. Display only: no new button, nothing on the phone dock.
- **Combined squads in gold.** A Frontier Defence squad bought Combined stands on a gold trim ring with eight notches and a soft glow that breathes (still with reduced motion), and carries a gold star above its bar. One draw for all the rings.
- **Off-screen threat arrows.** When one of your units is hit outside the view, a warm red arrow on the battlefield's edge points at it for 2.6 s after the last hit (up to four; hits that way share one); a unit lost out of view makes its arrow flare. The arrows ignore taps and stay under the HUD; no pulse with reduced motion.
- **Three death looks.** Shells, rockets, bombs and barrages throw the body back along the shot (vehicles hop higher, roll and turn, with a secondary fireball); beams, rails, pulses and flame sear it (a flash in the weapon's colour, embers and ash, the soldier charred where it stands, a wreck that shudders and settles); rifles and blades drop it as before, with a dust kick. Every effect comes from the existing pools.
- **Cost:** +1 draw at the widest zoom (148 to 149 in `wide-battle-eco`, 217 to 218 in `large-map-high`), +1 with group badges (107 to 108 in `groups-battle-eco`), +2 for Combined squads (the gold trim and the star's atlas: 93 to 95 in `combined-defence-eco`), 0 in every other scenario; no shadow draw; no buffer upload on a still frame. View only: every pin, checksum and baseline is unchanged.

### R3-V: Victory ceremony and MVP card (all modes)
- **Win ceremony.** The last kill plays in slow motion for 1.2 s (when the core beat has not already slowed it), then the camera swings to your MVP with a gold "MVP" tag over the unit. The results open with a stamp landing (the Skirmish emblem, the mission medal or the Defence stars) and a three-note sting, a confetti burst in your team colour, and the stats counting up.
- **MVP card** on every win (Skirmish, missions and Chronicles, Defence, and the Endless / Daily score): the unit that did the most damage plus healing, with its portrait, name, damage, healing and kills. Towers show the unit that crews them. A quiet objective win names your most seasoned unit ("Held the line").
- **"So close."** on a loss, with how close it was (the enemy core's health, the objectives done, or the waves held) and one concrete tip read from your match (economy, army size, trades, base losses or upgrades). Defence keeps its own next-star tip.
- **Results in the holo theme:** glass panel with corner brackets and a sensor line, gold for a win, coral for a loss, holo tiles. Every action is still one tap on the card; text stays at 11 px or more and buttons at 44 px; the docks do not change.
- Motion off (reduced motion or "Animate combat effects" off) skips the slow motion, swing, confetti and count-up; the stamp lands at once. Eco quality alone keeps the ceremony.
- Presentation only: the match is over before any of it plays, and the MVP is counted from the ticks in the client (match-stats.js), so pins, checksums and saves are unchanged.
- For later packages: `onMatchEnd(fn)` in `src/ceremony.js` (also `A.onMatchEnd`) hears every finished match with its mode, result, stats, MVP, medal, stars, score and difficulty.

### R3-I: Campaign pacing
- **A first contact in the first two minutes.** Eleven missions with a base (m01 to m07 without m06b, m09 to m12) met the enemy only after 2:00 (the first wave near 3:30 to 4:00). Ten of them now open with one or two light scouts probing the camp at 1:10 (m12 at 1:00), with a short radio line; they meet the camp's guard at about 1:15. A probe is the same few scouts on every difficulty, is beaten by the starting guard and towers, and cost the objective bot nothing before 2:00 on Story, Standard and Veteran (`node tools/first-contact.mjs`). Mission 3 has none: there the guard chased the scouts out of the towers' cover and a player who did nothing lost 7 units to the first wave. The interface still warns of it, but a mission's "first attack" line waits for the first real wave (`wave.probe`, docs/MISSIONS.md).
- **Mission 3's towers objective costs something.** "Build two Sentinel towers" was done at 0:00 (the camp starts with two). It is now "Have four Sentinel towers standing".
- **Missions restored after the south exits** (owner: keep the exits). Every mission the objective bot won on r3-base is won again on Story, Standard and Veteran and with both decision paths, with no medal lower than on r3-base: m03 (not won on Standard) now has 5 guards in Hale's camp (8), a 5-unit counter-attack at the north siphon (7) and gold at 12:30 (12:00); m04 (lost on Veteran) has 4-unit Sunward waves for the centre and in the truce (5); m12 (lost on Standard) is won again with its probe. m09's objective bot now wins about 25 s sooner than on r3-base (6:45), so its check window starts at 6:30.
- **Fast against two rivals: not eased (partial).** The owner-approved Fast-only easing was tried in nine forms (a later first joint offensive by 30, 45 or 60 s, no first raid, both, a lighter first raid and offensive, a smaller army cap, AI rally behind the core, and as a diagnosis a player rally in front of the core); none moved the 6-map Fast 1v2 cells beyond noise, and the delay measured worse on a second sample, so no AI change ships. Numbers and the owner options are in `docs/aaa/results/round3/i.md`.

### R3-R: Commander rank and unlocks
- **XP from every match.** 25 for playing, 75 for a win (finishing Training counts), +25 for a Veteran win, a mission medal (bronze 20, silver 35, gold 50), 20 per Defence star, 5 per wave held in Endless and the Daily seed (up to 50 waves), 1 per 2 kills (up to 25); at most 400 a match. A Standard skirmish win is the first rank up.
- **Twenty ranks**, Recruit to Frontier Marshal (100 XP for rank 2, 10,450 for rank 20). Each rank from 2 unlocks one item:
  - **paint schemes** for your units: Sand, Arctic, Ember, Jungle, Night and Gold (a tint on every part of your own units; enemies and buildings keep their colours);
  - **emblems**: Spearhead, Wings, Star, Crown, Phoenix (the Meridian ring from the start);
  - **title banners**: Vanguard, Pathfinder, Iron Marshal, Frontier Legend, Hero of the Meridian (Field Commander from the start);
  - **Daily orders**: Iron line (lose 5 units or fewer), Swift (win within 12 minutes), Lean (build 6 structures or fewer), Hunter (40 kills or more). Pledge one, and the first win that meets it each day pays +60 XP.
- **Rank chip on the title**: emblem, rank, name, title banner and the XP bar, in the setup panel.
- **Commander rank rows in the Skirmish setup**: Paint, Emblem, Title banner and Daily order, each item its own button (one tap), plus the next locked item with the rank that opens it.
- **Rank toast on every results screen** (Skirmish, missions, Defence, Training): the XP gained, the rank bar, and on a rank up "Rank up!" with what it unlocked.
- Purely cosmetic: no pick is a battle rule or reaches the simulation, so every pin, checksum and baseline is unchanged. The paint is an instanceColor tint (no material, batch or draw call); the default Factory paint sets nothing. The rank is kept in this browser (`frontier-command.rank.v1`); blocked storage keeps it for the visit.

### R3-U: Audio juice
- **Sight and sound match.** Every shot belongs to one of ten weapon classes (`audio-logic.js` `weaponClass`, the same classes the weapon effects draw): rifle tracer, cannon shell, artillery lob, flak, beam/rail, flamer, heal beam, missile, falling bomb and strafing run. The classes that had no voice of their own get one: a Sentinel tower at a flyer fires a flak double-thud and bursts in the air, an Anti-tank team at a flyer launches a climbing missile, a Swift glider or Ember balloon lets go with a latch clunk, a whistle that ends on the landing and a blast (a fire bomb roars), a Hawk strafes ground troops with a cannon stream, and Medics and Supply wagons heal with a soft shimmer. An artillery lob now whistles down before it lands.
- **Impacts by size.** Every round that lands on the ground adds a small, medium or heavy layer (a snap, a crunch, a thud with falling dirt) over the target's own impact sound, timed to the round's flight.
- **Unit voices.** Selecting or ordering units plays a short synthesised chirp in that unit type's voice (infantry, armour, flyers and support each have their own; pitch varies a little every time), at most two a second. **Settings > Audio > "Quiet mode: no unit voices"** turns them off; everything else keeps sounding.
- **Stingers.** A boss losing a health stage plays a low brass-and-timpani stab, a boss's phase-2 surge an overdrive whine into a tritone hit, and the results stamp a rising fanfare (replacing its three beeps). The score dips under each.
- **Warnings and weather.** A soft heartbeat pulses while your Command core is under 35 % and still being hit (faster under 15 %). A lightning strike in a storm is followed by a thunder crack (with the ambience switch).
- All sounds are synthesised in code (no downloads), rendered once and pooled, go through the voice budget (rate limits, priorities, distance attenuation, the fog rule), follow the Master/Effects volume and Mute, and start only after the first gesture. No pin moved.

### R3-FX: Weapon effects from sprite sheets (Codex art)

- Weapon impacts, muzzle flashes, tracers, beams, heal beams, smoke trails, the flame jet and ground decals are the owner-commissioned Codex sprite sheets (VFX sprite sheets: Codex/OpenAI, owner-commissioned; VFX2 heavy-read sheets likewise), played from two pooled instanced batches (+2 draws, no per-effect Mesh). Tank, Tower shells: fireball-tank-shell with a smaller rocket fireball, muzzle flash, smoke trail and the shell head; Walker: its own stomp at the feet and an artillery-dust blast; rocket: rocket fireball and trail; Breaker lob: artillery fireball and crater; Barrage: bomb fireball and crater; missile: missile-burst; flak: flak-burst; Scorcher: bright flame jet; beam and rail: the beam-line strip tiled along the ray with start cap and end flare (cyan, magenta-white); heal: heal-beam strip with rising sparkle crosses; rifles and Hawk strafing: tracer-streak darts with muzzle and hit sparks; bombs: bomb fireball; scorch marks and craters are flat decals that fade over 20 s (24 at most, 12 in Eco).
- Flight times, hit times and events are unchanged (impact sprites start on the same frame as before). The old procedural effects remain the fallback (sheets not loaded, `?sprites=0`). Reduced motion: no flash frames, stepped frames, no jet, muzzle or tracer sprites. Eco: the 256 px sheets, fewer sprites, shorter trails.
- Results: `docs/aaa/results/round3/fx-sprites.md`.

### R3-X: Weapon effects, ground and air (owner request: "slow and beautiful, but cheap")
- **Ten weapon effect classes** (`src/fx-kinds/weapon-class.js`, the same ids as R3-U's sounds): the heavier the weapon, the slower and showier the round. Rifles and machine guns stay fast (thinner tracers with a white-hot head, a dust puff on every ground hit); tank-class cannons fire a big, bright glowing shell on a slight arc with a long, thick smoke trail, behind a stronger muzzle flash and recoil puff, then a big flash, a ring of sparks, a wide bright ring and a scorch ring; the Breaker lobs a high round over a red warning ring; a ground cannon at a flyer bursts black-and-orange flak around it; beams and rails charge at the muzzle, then snap out and fade from the muzzle forward; flamers gain a hot flame tongue and embers; the medic's heal is a soft green beam with sparkles rising off the patient.
- **Air:** Hawk missiles corkscrew to a flyer on thin curling ribbons and meet it in a sharp air burst; at the ground the Hawk strafes (tracer strikes walking onto the target, each kicking a dust spurt); Glider and Balloon bombs are real finned bodies that fall faster and grow over a shadow dot, then blast (fire for the Balloon); a flyer shot down bursts where it flies, spins down trailing smoke and crashes in dust and fire. Any round meeting a flyer now bursts in the air (no scorch on the ground under it).
- **Barrage:** the shell drops out of the sky onto its mark over its last 0.85 s, drawn from the simulation's own strike list so it lands on the strike's tick; the strike mark is red.
- **Lands when the damage shows:** every round lands exactly at its flight time (visual-style.json `life`, unchanged), when the target's hit flash fires, and the target's health bar now holds until then too; a killing round lands within 0.24 s.
- **Cost:** shells, lobs, flak, missiles and bombs are one pooled instanced mesh (52 triangles, no shadow, hidden when nothing flies): +1 draw only while one is in flight; everything else comes from the existing pools. Rounds are pooled records (no allocation per shot or per frame once warm). Eco shortens trails and halves bursts; reduced motion keeps static shapes and soft flares (no white flashes). Still frames re-send no debris buffers (a fix).
- View only: no sim file changed; every pin is identical.

### R3-Q: First-minute hooks
- **Quick battle, one tap from the title.** A teal "Quick battle" tile sits above the mode cards (on landscape phones beside Start). One tap starts a fun, winnable 1v1 at once: Meridian Riverlands, one Relaxed rival (Ashfall, or Meridian when you command Ashfall), your own faction, no other battle rules. Your outpost is ready (a Sentinel tower facing the enemy, a Supply relay, two more Harvesters, +150 alloy), and three enemy scouts set off at about 0:32 so the first fight comes at about 0:40. The test bot wins all 60 bot matches (5 factions x 3 maps x 4 attack timings), first combat 37 to 39 s. "Play again" replays a Quick battle; "New game" returns to your own skirmish setup, which Quick battle never changes (`rules.quick` is added only while the match is built and is never stored or listed in Battle rules).
- **First watch (Defence level 1 for new players).** A profile that has never won a Defence level plays Gorge Road through a new variant (`src/defence/first-watch.js`; the designed level is not edited): the match opens with the enemy roster as a strip (portraits and the wave each type first comes; on phones portraits and wave numbers) until the first wave sets off, and a **Scout Runner**, a fast unarmed scout, runs the road a little ahead of wave 1. Catch it for 84 bonus alloy; if it gets through it costs no lives. Stars count for Gorge Road as usual.
- New sim content behind a rule or a new variant only: pins, mission checksums, baselines and `check:defence` are unchanged. New pins in `tests/golden-r3q.test.js`; checks in `tests/quick-battle.test.js`, `tests/quick-battle-check.mjs` (bot: wins and first combat) and `tests/quick-battle.mjs` (browser, three viewports; CI matrix `r3-q`). Strings in Vietnamese and Korean.

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
