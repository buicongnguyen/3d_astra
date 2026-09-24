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
