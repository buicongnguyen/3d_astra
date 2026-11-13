# World: the story bible

This is the reference for the Frontier Command campaign: the world, the factions, the cast and the twelve missions. Data lives in `src/story/world.js` (factions, cast) and `src/story/missions.js` (mission scripts in the format of [MISSIONS.md](MISSIONS.md)). If this page and the data disagree, the data is right and this page needs an update.

Tone: warm, clear and hopeful. Nobody in this story is evil; everybody is short of something. Suitable for all ages. No real-world nations, religions or politics.

## The story in one paragraph

The Meridian Expedition lands on Astra, an abandoned frontier world, to restart the Builders' energy relays and make the frontier fit for settlers. Each relay they light makes a rival camp's lights fail, so every expedition believes the others are stealing its power, and a war starts over a misunderstanding. Meridian's engineer discovers that the relays are one circuit, the Lattice, and that the Lattice does not burn crystal: it grows it. In a Builder vault a caretaker mind called ECHO explains that the Builders left on purpose and put the Lattice to sleep so the crystal fields could regrow. Director Hale of the Ashfall Combine has taken the key to the central relay, the Keystone, and means to draw all the power at once to save his fleet of forty thousand sleepers, which would turn every crystal on Astra to dust. With the Sunward Caravan, a rival turned ally, Meridian breaks his draw engine, tunes the Keystone for everyone, and sends the first beam of power up to Hale's own fleet.

## The world

**Astra** is a warm, bright frontier world: river valleys, ash plains, amber dunes, forest, a copper basin, black highlands and a wide northern expanse. The Builders left it about four centuries ago. Their cities are gone; their machines are not.

**The Lattice** is the Builders' planet-wide network of energy relays. It is a single circuit. Small relays stand in every region; larger ones (the Basin relay, the Crown in the highlands) steady whole regions; one, **the Keystone** in the Frontier Expanse, balances the entire circuit.

**Crystal.** Two kinds grow on Astra and nowhere else:

- **Alloy crystal** (amber) is the Lattice's building material. Command cores turn it into everything: buildings, armour, machines.
- **Energy crystal** (blue) is stored Lattice power. Advanced units and research need it.

Both grow only near a relay that is awake. This is the fact the plot turns on: the deposits every expedition is mining are the last harvest of a sleeping machine. Wake the Lattice in tune and the fields regrow for good. Drain it and they turn to dust.

**Relays in play.** The Supply relay the player builds is a small field tap on the Lattice (that is why it raises the army limit). The Builder relays on the maps are the old, large ones: capture points that pay resources to whoever holds them.

**Surge storms.** When one relay wakes alone, it borrows power from its neighbours. Their lights fail, and sometimes the imbalance breaks out as a violent electrical storm. In tune, the Lattice makes no storms.

**Why every army has the same units.** Nobody brought an army to Astra. Each expedition found or salvaged a Builder **Command core**, and a Command core prints one set of guardian patterns for whoever wakes it: Harvester, Vanguard, Ranger, Breaker and the rest. The patterns are copies of the **Wardens**, the Lattice's own guardians. Expeditions differ only in paint.

**Why there is a war.** Four expeditions each woke relays near their own camp. Every relay lit dimmed someone else's. Each camp saw its lights fail just as a neighbour's came on, and drew the obvious, wrong conclusion.

**The mystery and its payoff.**

| Clue | Mission | What the player learns |
|---|---|---|
| Ashfall's lights fail the second the river relay wakes | 1 | Something links the relays |
| "When our relay lit, theirs went dim. Same second." | 2 | It is not sabotage by either side |
| Hale's siphon beams point straight up | 3 | He feeds a fleet in orbit: forty thousand sleepers |
| The Sunward wells lose pressure when an oasis is tuned | 4 | The same thing is happening to everyone |
| The tuning core reads the forest relay | 5 | The relays are one circuit |
| Crystals sprout beside the half-charged Basin relay | 6 | The Lattice grows crystal; it is a garden |
| The circuit map: all lines meet at one point | 7 | There is a centre, the Keystone |
| ECHO wakes in the vault | 8 | The Builders left on purpose; Hale has the Keystone key and will drain everything |
| The Crown lights with no storm | 10 | In tune, the Lattice is safe (this convinces the Veil) |
| The Keystone is tuned | 12 | Power for every camp, and the crystal grows again |

**The turn (missions 8-9).** Until the vault, the question is "who is stealing the power?". After it, the question is "can we reach the Keystone before Hale empties it?". The enemy stops being a rival camp and becomes a deadline, the Pact breaks, and a rival joins the player.

## Factions

Colours are keys of `PRESETS` in `settings.js`. Each mission carries a `factions` map (enemy team number to faction), and in a mission every enemy team is painted in its faction's colour and gives off its faction's `glow` (`src/faction-colors.js`). The player's own chosen colour always wins a clash: a faction that would share it takes the next free colour and keeps its glow. In a skirmish the enemy colour is still the player's setting.

| Faction | Colour | Who they are | What they want |
|---|---|---|---|
| **Meridian Expedition** (player) | mint / teal `#92ebc5` | Surveyors, engineers and settlers. They repair before they take. | Restart the relays so the frontier can hold a real settlement |
| **Ashfall Combine** | coral `#ef7660` | A salvage fleet, three generations on wrecks. Disciplined, punctual, short of everything. | Power for forty thousand sleepers in failing cold berths, tonight |
| **Sunward Caravan** | amber / gold `#edc76f` | Desert traders who came twenty years ago and stayed. Proud, fair, exact with a debt. | Keep the oasis relays lit; their wells and gardens run on them |
| **Veil Survey** | violet `#b397ee` | Scholars who came first and lost their first camp to a surge storm. | Keep the relays dark until the Lattice is understood |
| **The Wardens** | blue `#689dff` | The Lattice's own guardian machines. They obey whoever holds a Keystone key. | Nothing of their own; from mission 9 Hale commands them |

How the sides line up:

- **Act 1:** Ashfall fights Meridian; Sunward fights both.
- **Act 2:** Ashfall and Sunward sign the Pact against Meridian. The Veil watches.
- **Act 3:** Sunward joins Meridian. Ashfall, the Wardens (under Hale's key) and the Veil stand against them. In the finale the Veil stands down.

## Cast

Full entries, with portrait briefs for the artist and two sample lines each, are in `src/story/world.js`.

| id | Name | Role | In one line | How they speak |
|---|---|---|---|---|
| `commander` | Commander | The player | Listens first, decides once | Never speaks. Addressed only as "Commander": no name, no gender |
| `vale` | Mira Vale | Meridian operations officer, the main adviser | Calm and exact; counts people before crystals | Short sentences: the fact, then the order |
| `okoro` | Tobi Okoro | Meridian chief engineer and scout | Curious; talks to machines like shy animals | Excited, concrete, full of small discoveries |
| `hale` | Corvin Hale | Director of the Ashfall Combine, the antagonist | Courteous, tired, unbending | Polite, formal, speaks in schedules and numbers |
| `sol` | Tamsin Sol | Captain of the Sunward Caravan, rival then ally | Proud, generous, sharp at a bargain | Warm and direct: water, roads, debts, guests |
| `maren` | Ilse Maren | Archivist of the Veil Survey | Gentle, frightened of repeating one terrible night | Quiet; quotes records; asks rather than threatens |
| `echo` | ECHO | Caretaker mind of the Lattice | Patient, literal, glad of company | Counts things; says "this one" until the finale, then "I" |

**Hale's motive.** The Ashfall fleet is in orbit with forty thousand people asleep and the reactors failing. A full draw at the Keystone would keep them alive for a year. Tuning the Keystone would feed them for good, but it needs time and it needs him to trust three strangers and a machine. He can count a year; he cannot count a promise. He is wrong, and he is not a villain. The story ends with Meridian sending him the power anyway.

**Sol's arc.** Rival in mission 4 ("Nothing personal"), reluctant Pact partner in 5 and 7, doubting after the circuit map, attacked by Hale for leaving in 9, ally from then on.

**Maren's arc.** Her first camp was destroyed thirty years ago when one relay woke alone. She has kept the highlands dark ever since. She sees the Crown light without a storm (10) and stands the Veil down at the Keystone (12).

**ECHO's arc.** It calls itself "this one" and counts years. In the last briefing it says "I" for the first time: "This one has decided to be someone."

## The campaign

Twelve missions in three acts. The seven original stages are the spine, with the same maps, names and difficulty (missions 2, 3, 4, 5, 7, 10 and 12); five new missions sit between them.

Since 0.19b two more missions are played under the Frontier Defence rules: **Hold the River** (`m02b-hold-the-river`, Act 1 after First Contact: Hale comes back for the river crossings while Okoro tunes the river relay) and **Hold the Valley** (`m07b-hold-the-valley`, Act 2 after Copper Siege: Okoro's survey on Gorge Road finds the Builder vault). The tables below keep the twelve story missions; in the game they are numbered in campaign order (14 in all). Six moments are staged as scenes (missions 1, 4, 8, 10, 11 and the finale, by ending). Mission 2 is now a bridge assault on a bridgehead at the west bridge; mission 9 is a hold of the dune plateau, where Hale's Warden drones first appear; two Veil scouts watch the basin in mission 6.

### Act 1: Landfall

Note (tuning pass, 2026-11-10): every mission AI now opens Relaxed and some step up to Normal by script; several goals and times changed. `src/story/missions.js` (each mission's `design` field) is the source of truth where it differs from the tables below.

| # | id | Map | Enemies | You must | Twist |
|---|---|---|---|---|---|
| 1 | `m01-first-light` | Meridian Riverlands | 1, passive | Build a Supply relay, reach and hold the river relay | The relay wakes and the camp across the river goes dark; Hale demands you shut it down |
| 2 | `m02-first-contact` | Meridian Riverlands | 1 Relaxed | Build a Foundry, destroy the Ashfall core | As you cross the river, Hale raids your empty camp by the west ford |
| 3 | `m03-the-ashen-line` | Ashen Frontier | 1 Normal | Destroy three siphons | The north siphon's beam points at orbit: Hale is feeding a sleeper fleet |
| 4 | `m04-three-way-dunes` | Amber Dunes | 2 Normal, free-for-all | Hold two of three oases for 3 minutes | At 7:00 Hale and Sol call a truce and attack together |

### Act 2: The Pact

| # | id | Map | Enemies | You must | Twist |
|---|---|---|---|---|---|
| 5 | `m05-the-verdant-pact` | Verdant Crossing | 2 Relaxed, allied | Escort the Survey crawler to the forest relay | The bridge is covered by towers; Sol ambushes the north road. The core reads "one circuit" |
| 6 | `m06-copper-harvest` | Copper Basin | 1 Normal | Bank a crystal quota before the storm | At the first step, crystals grow beside the relay: the Lattice is a garden. Hale goes for your Harvesters |
| 7 | `m07-copper-siege` | Copper Basin | 2 Normal, allied | Survive 11 minutes; keep the Basin relay standing | The circuit map goes out to every camp; Sol doubts; Hale attacks from behind |
| 8 | `m08-the-quiet-vault` | Ashen Frontier (night) | 1, guards only | No base: destroy three jammers, bring Okoro to the vault, get him out | ECHO wakes and tells the truth; the whole Ashfall camp chases the squad |

### Act 3: The Keystone

| # | id | Map | Enemies | You must | Twist |
|---|---|---|---|---|---|
| 9 | `m09-a-debt-in-the-dunes` | Amber Dunes | 1 Normal, with Sunward help | Reach Sol's camp, protect its beacon, destroy the Ashfall core | Hale sends Warden machines at your own camp; Sol's second column arrives |
| 10 | `m10-obsidian-storm` | Obsidian Highlands | 3 Normal, allied | Destroy three Veil dampers, then hold the Crown relay | Maren explains her fear; three armies converge on the Crown |
| 11 | `m11-cut-the-draw` | Frontier Expanse | 2 Normal, allied | Cut three conduits in 20 minutes | The first cut pulls the Wardens onto the next conduit; the second sends them at your camp |
| 12 | `m12-frontiers-end` | Frontier Expanse | 3 Fast, allied | Survive the first offensive, destroy the draw engine | Maren stands the Veil down at half health; the coalition slows and Veil troops join you |

### What each mission teaches or tests

1. Economy, the Supply relay, capture circles, front line and back line.
2. A full match: Foundry, Breakers, and leaving a home guard.
3. Timing an attack between enemy waves; breaking towers.
4. Holding ground in two places; using enemies who fight each other.
5. Protecting something slow; choosing a route; Medics.
6. Economy under pressure; expanding; guarding Harvesters.
7. Pure defence: towers, Engineers, Anti-tank soldiers, one sally.
8. Unit control with no production; picking fights; healing.
9. Commanding two armies in two places.
10. Defending on every side while striking out.
11. Speed: building while marching, under a clock.
12. Everything: defend, then a decisive push with heavy units.

## Decisions and endings (0.19a)

The Commander still never speaks, but three times gives an order that the story remembers (data: `decisions` in `src/story/missions.js`; rules: `src/story/choices.js`):

| Mission | Who asks | Merciful order | Firm order (default) |
|---|---|---|---|
| 3, at the north siphon | Okoro | Return the alloy to Ashfall's scavengers | Keep the alloy for the expedition |
| 5, on the north road | Sol | Offer Sunward a share of the forest relay | Drive the Caravan off the forest road |
| 10, at the dampers | Maren | Let the Survey crews stand down | Break the dampers now |

Two or more merciful orders lead to **The Open Frontier**: the Keystone is shared and the four camps sign a truce. Fewer lead to **The Meridian Line**: Meridian holds the Keystone and the frontier alone. Neither is good or bad. The finale's last objective and closing lines follow the ending, and five epilogue cards (Vale, Sol, Hale, Maren, ECHO) close it. Every line is listed for review in `docs/aaa/review/story-lines.md`.

## Faction Chronicles (0.20)

Four short campaigns tell the same war from the other camps (data: `src/story/chronicles.js`; format in [MISSIONS.md](MISSIONS.md)). They open after mission 4. In a chronicle the player commands that faction, and its people never say "Commander":

| Chronicle | Lead | The player is | Its three missions |
|---|---|---|---|
| Ashfall: *Salvage Rights* | Hale | his Foreman | Cold Berths (day 3: raider camps strip the wrecks), Lights Out (day 4: mission 1's relay from Hale's side), The Scrapyard Gorge (day 44: holding the berth cores against Meridian columns) |
| Sunward: *The Long Road* | Sol | her Wagon-master | Dry Wells (day 11: Ashfall pumps on the oases), Three-Way Dunes (mission 4 from Sol's side, the truce), The Verdant Road (day 22: the Pact's north road; Okoro's "one circuit" starts Sol's doubt) |
| Wardens: *ECHO's Key* | ECHO | Warden-prime | Standing Orders (day 18: ECHO, still asleep, keeps the Keystone quiet), A Grey Coat (day 40: Hale holds the key; "obey, but count"), Hold the River (day 52: the river against Meridian while the crystals fade) |
| Veil: *The Quiet Survey* | Maren | her Surveyor | Night Count (night 9: Ashfall beacons on the plateau), One Circuit (day 22: the forest relay's records), Inside the Dampers (mission 10 from inside; the Crown lights with no storm) |

A finished chronicle adds one line by its lead to the finale's closing lines. Enemies who speak in a chronicle (Vale and Okoro for Meridian, Hale, Sol) keep their own voices; Meridian's people still call their own leader "Commander".

## Writing rules

- Lines are under 140 characters. One idea per line. No filler, no jokes about the game itself.
- Plain English that translates cleanly into Vietnamese: no idioms, no puns, no slang. Numbers are written so they can be read aloud.
- The player is "Commander". Never a name, never "he" or "she".
- Vale gives the orders and the stakes. Okoro gives the discoveries. Hale gives the other side of the argument, politely. Sol gives warmth. Maren gives doubt. ECHO gives the long view.
- Every antagonist line should be something a decent person could say.
- Win debriefs end on the next question. Lose debriefs are gentle and leave a way back.
- Place names: Meridian Riverlands, Ashen Frontier, Amber Dunes, Verdant Crossing, Copper Basin, Obsidian Highlands, Frontier Expanse. Things: the Lattice, the Keystone, the Crown, the Basin relay, the Builders, the Wardens, the Pact.

## Checks

`src/story/missions.js` was checked with a script against the real simulation: every region centre and spawn position is inside the map and passes `nav.canStand(x, z, 2)`; building spawns are clear of bases, deposits and each other; every speaker, objective id, region, tag, unit and building exists; hidden objectives are revealed by a trigger; waves stay within the size limit for their place in the campaign. Re-run a check like it after changing any position.
