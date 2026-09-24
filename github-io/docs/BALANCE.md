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

The tower costs 125 alloy + 25 energy (value 162.5) and uses no supply. It has 650 HP / 50 shield and deals 19 damage every 1.2 s at 13 m, which outranges every unit.

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
