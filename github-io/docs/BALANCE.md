# Unit balance: power for the price

The question was whether each unit, and the Battle tank in particular, is worth what it costs. The tank was suspected to need a wider attack and a longer range.

## How it was measured

Armies of equal value fought in the real simulation on the Ashen Frontier map, using the same attack-move order, targeting and shields as a match.

- **Value.** A unit's value is its alloy cost plus 1.5 × its energy cost. Energy is the scarcer resource: 8,000 energy against 18,000 alloy on the default maps.
- **Sides.** Every pair fought from both starting sides with two formation offsets. This removes terrain bias.
- **Army sizes.** Budgets were 1,000 (a skirmish, about 2 tanks) and 2,400 (a large battle, about 5 tanks).
- **Score.** A cell is the row army's share of value kept, minus the column army's share, × 100. +100 means the row wins without a loss. **Overall** averages a unit's four matchups.

The harness is reproducible with `tests/balance.test.js`, which asserts the key results.

## Before

| Budget 1,000 | Vanguard | Ranger | Breaker | Anti-tank | Tank | **Overall** |
|---|---|---|---|---|---|---|
| Vanguard | · | 89 | 39 | 93 | 88 | **+77** |
| Ranger | −89 | · | −9 | 68 | 22 | −2 |
| Breaker | −39 | 9 | · | −38 | 31 | −9 |
| Anti-tank | −93 | −68 | 38 | · | 73 | −12 |
| Tank | −88 | −22 | −31 | −73 | · | **−53** |

- **Battle tank.** It lost to every unit type, including the cheaper Breaker. For the price of one tank (275 alloy + 125 energy and 4 supply), a player got more of almost anything else.
- **Vanguard.** It beat everything, including the tank. At 75 alloy it had about ten times the raw strength per cost of a Ranger or tank.
- **Counters that failed.**
  - Rangers were meant to counter Breakers, but in large battles they lost to them badly (−59 at a 2,400 budget), because Breaker splash hit their formation.
  - Nothing reliably countered the Vanguard.

## Changes

| Unit | Change | Why |
|---|---|---|
| **Battle tank** | Range **10 → 12**. Each shell also hits enemies within **2 m for 40%** damage. Deals **1.5×** damage to Vanguards. Cost unchanged. | A heavy cannon that outranges infantry and punishes clumped troops. The splash stays small so the Anti-tank soldier still counters it. |
| **Anti-tank soldier** | Rockets **4× → 6×** against vehicles (120 damage). Range **11 → 12**, equal to the tank. HP **80 → 90**. | Stays the tank's counter. Auto-targeting spreads rocket fire over several tanks, so the bonus must be large to win. |
| **Vanguard** | Cost **75 → 100** alloy. Damage **15 → 12**. HP / shield **150 / 60 → 140 / 50**. | Still the cheap melee unit that beats Rangers and Anti-tank soldiers, but no longer beats every unit type. |
| **Ranger** | HP **85 → 95**. Damage **12 → 13**. Range **9 → 10**. Bonus against Breakers **1.6× → 2.6×**. | Makes the Ranger–Breaker counter hold in large battles. |
| **Breaker** | Splash **50% → 40%** (radius 3 m unchanged). New **1.5×** bonus against Vanguards. | Artillery counters melee blobs, not every infantry formation. |

The Medic, Engineer, Harvester, Sentinel tower and buildings are unchanged.

## After

| Budget 1,000 | Vanguard | Ranger | Breaker | Anti-tank | Tank | **Overall** |
|---|---|---|---|---|---|---|
| Vanguard | · | 76 | −39 | 86 | 0 | +31 |
| Ranger | −76 | · | 53 | 70 | −24 | +6 |
| Breaker | 39 | −53 | · | −68 | −10 | −23 |
| Anti-tank | −86 | −70 | 68 | · | 65 | −6 |
| Tank | 0 | 24 | 10 | −65 | · | **−8** |

| Budget 2,400 | Vanguard | Ranger | Breaker | Anti-tank | Tank | **Overall** |
|---|---|---|---|---|---|---|
| Vanguard | · | 74 | −79 | 86 | −37 | +11 |
| Ranger | −74 | · | 17 | 71 | −72 | −15 |
| Breaker | 79 | −17 | · | −38 | 6 | +8 |
| Anti-tank | −86 | −71 | 38 | · | −16 | −34 |
| Tank | 37 | 72 | −6 | 16 | · | **+30** |

Every unit now has prey and a predator:

- Vanguard beats Ranger and Anti-tank, and loses to Breaker and Tank.
- Ranger beats Breaker and Anti-tank, and loses to Vanguard and Tank.
- Breaker beats Vanguard, and loses to Ranger and Anti-tank.
- Anti-tank beats Tank and Breaker, and loses to Vanguard and Ranger.
- Tank beats Ranger, and Vanguards in large battles. It loses to Anti-tank in normal battles.

The tank is now about even for its price in skirmishes and strong in large battles. At equal **supply**, which is what counts near the 100-population cap, it is the strongest unit.

Specialists score below zero overall because half their opponents are not their targets. The Anti-tank soldier is the clearest case.

## Known limits

- In very large battles (5 tanks or more), the Anti-tank soldier's advantage shrinks to about even (−16 at a 2,400 budget), because auto-targeting spreads its rockets. Focus fire with **N** (Attack) or right-click concentrates the rockets.
- Results assume armies meet head-on in formation. Flanking, focus fire, upgrades and support units change the outcome.
- The Godot edition still uses the previous numbers.

## Sentinel tower

The tower costs 125 alloy and no energy (value 125, so it can be placed before any blue deposit is tapped) and uses no supply. It has 650 HP / 50 shield and deals 19 damage every 1.2 s at 13 m, which outranges every unit.

To measure it, armies of one unit type attack-moved into a single tower until it fell. The tables show the smallest army that destroyed it, that army's value as a multiple of what was invested in the tower, and the attacker's losses.

### What was wrong

- **Targeting.** The tower shot whichever enemy was nearest, measured to its edge, so buildings with a large footprint won. A tower built near enemy structures fired at a Command core while a single Anti-tank soldier destroyed it without a scratch.
- **Repair stacking.** Any number of Harvesters could repair the same tower, and a full repair costs only about 40. The army needed to destroy one tower rose sharply:

  | Harvesters repairing | Tanks needed | Army value vs the tower |
  |---|---|---|
  | none | 1 | 2.8× |
  | 4 | 3 | 8.5× |
  | 6 | 4 | 11.4× |

- **Upgrades were a trap.** Each level added only 25% damage and HP for 175–350. A level-3 tower (687.5 invested) needed just 0.6–1.4× its investment to destroy with Vanguards, Rangers, Breakers or tanks, far worse than building more level-1 towers.
- **One-sided.** The AI never built towers; only the player did.

### Changes

| Area | Change |
|---|---|
| Targeting | Towers shoot combat and support units first, then Harvesters, then buildings. |
| Repair | At most two Harvesters repair one building at a time. The others wait nearby and take over. |
| Levels | Each level adds **+50% base damage and +1 m range** (L2: 28.5 at 14 m; L3: 38 at 15 m). HP still rises 25% per level. |
| Upgrade cost | 75 alloy + 25 energy per level (L2 75/25, L3 150/50), instead of 100/50 and 200/100. |
| AI | From Normal speed up, the AI builds Sentinel towers on the side of its base facing the map centre once its Foundry stands: 1 (Normal after 180 s, Fast after 120 s) or 2 (Relentless after 90 s). A siege-corps ally builds one more. Relaxed AIs build none. |

### After

| Tower | Invested | Vanguards | Rangers | Breakers | Anti-tank | Tanks |
|---|---|---|---|---|---|---|
| Level 1 | 162.5 | 3 (1.8×), lose 1 | 4 (3.4×), lose 1 | 2 (3.5×), lose 0 | 5 (6.2×), lose 2 | 1 (2.8×), lose 0 |
| Level 1 + 4 repairing Harvesters | 162.5 | 4 (2.5×), lose 2 | 5 (4.2×), lose 2 | 3 (5.3×), lose 0 | 7 (8.6×), lose 3 | 2 (5.7×), lose 0 |
| Level 2 | 275 | 4 (1.5×), lose 2 | 5 (2.5×), lose 2 | 3 (3.1×), lose 1 | 7 (5.1×), lose 3 | 2 (3.4×), lose 0 |
| Level 3 | 500 | 5 (1.0×), lose 4 | 6 (1.6×), lose 4 | 4 (2.3×), lose 1 | 8 (3.2×), lose 6 | 2 (1.9×), lose 1 |

Each cell gives the army size, its value as a multiple of the tower investment, and the attacker's losses.

- **Level 1.** It is cost-effective defence: an attacker must bring about 2–3.5 times its value. That is normal for static defence, which cannot move or attack.
- **Counters.** Breakers and Battle tanks remain the cheapest way to break a tower without losses. Anti-tank rockets are poor against buildings, as intended.
- **Repair.** Harvester repair still helps, but four repairers are now worth the same as two.
- **Upgrades.** An upgraded tower trades a little cost-efficiency for range and much heavier attacker losses. Upgrading is now a real alternative to building another tower.

The Godot edition still uses the previous tower rules.

## Energy sinks (0.9.1)

Energy comes from the blue deposits (about 8,000 per default map against 18,000 alloy) and is spent on:

1. **Units.** Rangers 25, Breakers 75, Medics, Engineers and Anti-tank 50, Battle tanks 125.
2. **The Foundry research branch.** Overcharged weapons (150 alloy + 100 energy) or Reinforced plating (100 alloy + 150 energy). The two exclude each other: a team takes one. Plating is the energy-heavy choice, weapons the alloy-heavy one.
3. **Building levels.** Command core L2 costs 200 alloy + 100 energy and L3 350 + 175; Barracks and Foundry levels cost 100 x level alloy + 50 x level energy; tower levels 75 x level + 25 x level.

Support units (Medic, Engineer) are also energy sinks. Abilities have no energy cost: they use cooldowns only. The tests (tests/ai-rules-091.test.js) check the research branch cost, the six unit costs and the core level cost.

## AI composition (0.9.1)

Normal and faster AIs counter what they have seen. A rival remembers fighters, towers and cores in its vision. At 4 or more seen fighters: 40% vehicles or more draws Anti-tank soldiers (Rangers at Barracks Level 1), 60% infantry or more draws Rangers and Breakers; two or more towers draw Breakers. Skirmish bench (PlayBot at 16 fighters, win time): Normal 285-320 s before, 291-325 s after; Fast 282-293 s before, 338-1095 s after (the AI now spends surplus and counters; Normal on Highlands went from a bot defeat to a win at 302 s).

## Stage 1 difficulty and skirmish measurements (0.10.0-alpha.4)

All results use the existing deterministic objective bot. Numbers are simulated seconds, not wall time. Raw per-bot/per-map results are in [aaa/results/stage-1-benchmarks.json](aaa/results/stage-1-benchmarks.json).

| Mission | Story | Standard | Veteran |
|---|---:|---:|---:|
| m01-first-light | 427 | 427 | 427 |
| m02-first-contact | 475 | 529 | 615 |
| m03-the-ashen-line | 581 | 470 | 465 |
| m04-three-way-dunes | 545 | 643 | 603 |
| m05-the-verdant-pact | 507 | 509 | 596 |
| m06-copper-harvest | 646 | 661 | 678 |
| m07-copper-siege | 660 | 660 | 660 |
| m08-the-quiet-vault | 482 | 652 | 558 |
| m09-a-debt-in-the-dunes | 408 | 693 | 370 |
| m10-obsidian-storm | 583 | 845 | defeat at 648 |
| m11-cut-the-draw | 421 | 644 | 1026 |
| m12-frontiers-end | 774 | 778 | 749 |

Story wins 12/12. Standard meets all original passive, generic and objective targets and has unchanged objective times. Veteran wins 11/12 within 1.5 times the Standard upper limit; every Veteran passive run survives 155 seconds. The strict Veteran checker still exits 1 for mission 10. The plan permits recording a mission after three unsuccessful tuning attempts; it is an outstanding exception, not a passing test.

Difficulty-specific tuning (Standard unchanged): Story Okoro in mission 8 has 700 HP instead of 400; Veteran mission 10 dampers have 2200 HP, mission 11 conduits 4200 HP, and mission 12's engine 15000 HP. Mission 10 damper trials at 4200, 3000 and 2200 HP all failed the objective bot; mission 11 won at 1026 s and mission 12 at 749 s. No further mission-10 tuning was performed after the prescribed three passes.

### Skirmish ladder

Each speed uses classic, riverlands and dunes, with bot attack thresholds 12, 16, 20 and 24 (12 matches per speed). Capture points are on, matching the live skirmish default. The win rate is the test bot's, not a claim about human difficulty.

| Speed | Bot win rate | Target | Median seconds |
|---|---:|---:|---:|
| relaxed | 100.0% | 90–100% | 445.5 |
| normal | 100.0% | 60–80% | 313 |
| fast | 100.0% | 30–50% | 387.5 |
| relentless | 100.0% | 5–20% | 388 |

Only Relaxed reaches its target. Before tuning the bot also won all 48 matches. More aggressive worker, technology, second-Barracks and minimum-wave settings improved some matchups (one trial gave Fast 25% and Relentless 58.3%), but broke existing affordable-defense and coalition-wave regression checks. Those settings were not retained and the tests were not weakened. The retained changes only increase Normal/Fast army caps and expand defensive response to approaching units; they preserve campaign tempo. Pace-only tuning did not establish the requested ladder. Further AI behavior work and human play review are still needed; this is not claimed as balanced.

## Faction framework golden checks

Before package 2.1, `new Simulation({ai:false})` after 1200 ticks of 0.05 seconds hashes to `d071360b`. Default/all-Meridian matches and their restored saves retain that hash after class and faction integration.

| Attacker | Target class (representative) | Base hit damage |
|---|---|---:|
| Vanguard | ranged (Ranger) | 19.2 |
| Ranger | siege (Breaker) | 33.8 |
| Breaker | melee (Vanguard) | 45 |
| Battle tank | melee (Vanguard) | 72 |
| Anti-tank | mechanical armor (Battle tank) | 120 |

These values are asserted in tests/factions.test.js. Ordinary attacks without a counter must not match an absent target class; existing anti-tank tests continue to verify building and infantry damage.

## Factions (0.12.0)

Each enemy faction swaps two base units for its own and adds one building, one trait and an AI personality. All numbers are in `src/balance.json` (`definitions`, `factions`, `traits`, `ai_personalities`). The class counter table is unchanged: a faction unit keeps the class of the unit it replaces, so the same answers work (Rangers and towers against melee swarms, Anti-tank soldiers against vehicles, Breakers against packed infantry).

| Unit | Replaces | HP / shield | Speed | Weapon | Alloy / energy | Supply | Notes |
|---|---|---|---|---|---|---|---|
| Scrapper (`scrapper`) | Vanguard | 105 / 0 | 5.4 | 10 every 0.8 s, range 2 | 60 / 0 | 1 | 1.6× ranged, ability Rush |
| Scorcher (`scorcher`) | Breaker | 260 / 40 | 3.2 | 9 every 0.3 s, range 5 | 175 / 75 | 3 | 1.5× melee, 2× buildings, splash 2.5 m at 60%, ability Burn line |
| Rider (`rider`) | Ranger | 120 / 25 | 6.4 | 11 every 0.85 s, range 9 | 110 / 25 | 1 | 2× siege, ability Dash |
| Supply wagon (`wagon`) | Medic | 240 / 30 | 3.6 | heals 6/s, range 6 | 150 / 75 | 2 | +4 supply |
| Sentinel drone (`drone`) | Ranger | 60 / 60 | 4.6 | 10 every 1 s, range 9 | 120 / 45 | 1 | 2.2× siege, shield returns after 3 s |
| Walker (`walker`) | Battle tank | 700 / 150 | 1.9 | 60 every 2.6 s, range 13 | 325 / 150 | 4 | 1.5× melee, splash 2.5 m at 50%, ability Brace |
| Shade (`shade`) | Vanguard | 130 / 40 | 5.6 | 20 every 0.9 s, range 2 | 110 / 25 | 1 | 1.6× ranged, cloaked |
| Watcher (`watcher`) | Anti-tank soldier | 85 / 20 | 4 | 14 every 1.4 s, range 13 | 125 / 50 | 2 | 3× vehicles, ability Mark |

| Building | Faction | HP / shield | Cost | Effect |
|---|---|---|---|---|
| Salvage yard (`salvageyard`) | Ashfall Combine | 700 / 40 | 150 / 0 | Vehicles and buildings of any side destroyed within 14 m of a Salvage yard or an Ashfall Command core pay Ashfall a quarter of their alloy cost. |
| Waystation (`waystation`) | Sunward Caravan | 600 / 40 | 125 / 0 | Friendly shields within 10 m recharge three times faster. |
| Shield pylon (`pylon`) | The Wardens | 500 / 200 | 100 / 50 | Other Wardens buildings within 10 m have 50% more shield and recharge it 50% faster. Destroy the pylon first. |
| Veil relay (`veilrelay`) | Veil Survey | 450 / 40 | 125 / 75 | Veil units within 9 m are hidden while they have not attacked for 3 seconds. It also reveals hidden enemies within 9 m. |

| Faction | Trait | AI personality |
|---|---|---|
| Ashfall | Salvage: a vehicle or building of any side destroyed within 14 m of a Salvage yard or an Ashfall core pays Ashfall 25% of its alloy cost | Rush: first wave at ×0.7 of the speed's time, waves every ×0.85, 3 more units per wave, army allowance ×1.5, Foundry later (×1.3); builds the yard right after its first Barracks |
| Sunward | Roads: +15% speed on road and sand (nothing on the classic map, which is all dirt) | Raider: 2 of its fastest idle fighters go for the Harvesters at the nearest known core 20 s before each wave |
| Wardens | Self-repair: a unit that neither fired nor was hit for 6 s regains 2% of its health per second; no Medics or Engineers | Turtle: first wave at ×1.3, 4 more units per wave, 2 more towers, one Pylon per production building (three at most) |
| Veil | Farsight: +3 m sight on everything, damage ×0.95; Shades (and any Veil unit within 9 m of a Veil relay) are hidden while they have not fired for 3 s. Units within 4 m, and towers, Command cores and Veil relays within 9 m, reveal them. Splash and burning ground still hurt a hidden unit | Evasive: waves every ×0.8; a force in the field that sees 2.2 times its own supply in enemy fighters goes home |

In a story mission the personality's tempo numbers are not applied: missions are paced by their script.

### How it was measured

`npm run bench:factions` (`tools/faction-bench.mjs`). The simulation has no random numbers, so every figure repeats exactly.

- **Round robin:** each faction's AI against each other's, both seats, three maps (`classic`, `riverlands`, `dunes`), Normal and Fast: 120 matches. Headless only: the option `aiPlayer` lets the computer play the first seat.
- **Test bot:** the scripted player (`tools/playbot.mjs`) against one faction's AI, 12 matches per cell (three maps, four attack thresholds), with its standard build and with a build of more Rangers (4 per Vanguard) and four towers.

### Round robin after five tuning passes

| Wins of the row against the column | meridian | ashfall | sunward | wardens | veil | All games |
|---|---|---|---|---|---|---|
| meridian | - | 12/12 | 6/12 | 0/12 | 12/12 | 63% |
| ashfall | 0/12 | - | 0/12 | 0/12 | 7/12 | 15% |
| sunward | 6/12 | 12/12 | - | 0/12 | 9/12 | 56% |
| wardens | 12/12 | 12/12 | 12/12 | - | 10/12 | 96% |
| veil | 0/12 | 5/12 | 3/12 | 2/12 | - | 21% |

Median match 191 s, longest 863 s, no undecided matches, seats even (54 wins for the first seat, 66 for the second).

**The 40 to 60% target of package 2.5 is not met.** Ashfall and Veil are far below it and the Wardens far above. The cause is the AI, not the unit prices: between two computer players the match is decided by the first big fight at about two minutes, and the side that attacks into the other's camp loses it (the defenders are gathered and the attackers arrive strung out). So the Wardens, who wait, win; Ashfall, who rush, lose; and unit numbers moved the table very little across five passes (Ashfall 15, 21, 25, 25, 15%; Wardens 100, 100, 85, 85, 96%). A fair round robin needs the AI to defend and attack with the same care, which is AI work rather than balance data. Tuning stopped here on purpose.

### Test bot against each faction (player's win rate)

| Enemy AI | Standard build, Normal | Standard build, Fast | More Rangers and towers, Normal | More Rangers and towers, Fast |
|---|---|---|---|---|
| meridian | 67% | 67% | 33% | 100% |
| ashfall | 67% | 100% | 100% | 100% |
| sunward | 100% | 100% | 100% | 100% |
| wardens | 33% | 100% | 50% | 92% |
| veil | 100% | 100% | 100% | 100% |

What a player meets is closer to this table. At Normal, Ashfall is as hard for the bot as the mirror opponent, the Wardens are harder, and Sunward and Veil are easier (the bot wins every match). Package 2.3's check holds: against Ashfall at Normal the standard build wins 67% and the build with more Rangers and towers 100%. The instrument is coarse: the mirror figure of 67% is "loses all four matches on `classic` to the first wave, wins all eight on the other maps".

### Changes made while tuning (from the plan's starting numbers)

Scrapper 85 → 105 HP and 9 → 10 damage; Sentinel drone shield 90 → 60, damage 11 → 10 every 1 s, cost 110/40 → 120/45; Rider 110/20 → 120/25 HP and shield, damage 10 → 11 every 0.85 s, range 8 → 9; Shade 100/30 → 130/40 HP and shield, damage 16 → 20; Veil damage penalty 10% → 5%; rush wave +2 → +3 units with a ×1.5 army allowance; turtle first wave ×1.5 → ×1.3; evasive retreat at 1.5 → 2.2 times its supply and no smaller waves; raid party 3 → 2.

### Still to do

- Sunward and Veil need to be more dangerous to a player; the Wardens at Normal may be too hard. Owner play-testing should decide before more numbers move.
- The campaign stays on the base roster (see docs/MISSIONS.md, "Faction rosters"): the story says every faction prints the same patterns.
