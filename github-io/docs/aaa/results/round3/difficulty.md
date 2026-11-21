# Difficulty guard (AAA round 3, Wave 1b integration)

Owner, 2026-11-21: "currently I play with AI and it is not easy to win, quite difficult to win against 2 AIs, so
don't make it too hard". R3-A wanted only more **variety** from the Field command AI (mixed armies, workshop units, no
Highlands stall), but its bench showed it also got stronger (R3-A's `skirmish-bench`, bot win rate: Normal 100% to
67%, Fast 100% to 67%, Relentless 75% to 58%).

## What changed (commits 69bf5dd, 6b9d61b)

| R3-A part | Now | Why |
|---|---|---|
| Army census (`ai-census.js`), census save for the workshop unit | kept, from `ai_mix.from` = **480 s** | the opening plays as on `r3-base`; the census only shapes the later army (variety) |
| Workshop floor (one workshop unit per host) | kept | variety (Veil Stalker) |
| Join the fight within 18 m | kept, from 480 s | without it the Highlands pairing ashfall:meridian ran to 1800 s again |
| Kite scouting | kept, from 480 s | early scouting moved the Field rival's whole opening (it cost the "Tank or Walker by 600 s" check) |
| S7 stall breaker | kept (from 480 s as before) | no Highlands stall |
| `FIELD_PACE` (more Harvesters, later Foundry and core levels, the Fast tech-delay softening) | **removed** | strength |
| No capture ring while an enemy army is in sight (`aiDanger`) | **removed** | strength |
| Relaxed | **none of R3-A runs** | Relaxed plays exactly as on `r3-base` (rows identical) |
| R3-W's larger air cap for the Field AI (seam W1) | **not applied**; computer teams keep 4 flyers (2 armed) | owner decision |

`ai_mix` lost `danger` and gained `from`. The first version (69bf5dd) started the census at 300 s; after the south
exits merged, 480 s measured better at every speed against two rivals (below), so 6b9d61b moved it.

## The tool

`npm run check:difficulty` (`tools/difficulty-check.mjs`, documented in `docs/TESTING.md`): the test bot
(`tools/playbot.mjs`) against one rival (1v1) and two rivals united against it (1v2, coalition), every AI speed,
classic / riverlands / dunes, attack thresholds 12/16/20/24, capture points on, 2400 s cap: 12 matches per cell.
Deterministic. `--compare before.json` is the gate: no cell may lose more than 1 bot win. The base was measured
from `r3-base`'s extracted `src/` (`.tmp/base`).

## Results (bot wins out of 12)

Field command + Expanded (`--rules '{"aiPlan":"field","roster":"expanded"}'`):

| Setup | Speed | r3-base | Step 2 (W merged, guard at 300 s) | Merged tree (W + L, guard at 480 s) |
|---|---|---|---|---|
| 1v1 | Relaxed | 12 | 12 | 12 |
| 1v1 | Normal | 12 | 12 | 12 |
| 1v1 | Fast | 12 | 12 | 12 |
| 1v1 | Relentless | 9 | 9 | 10 |
| 1v2 | Relaxed | 7 | 7 | 10 |
| 1v2 | Normal | 2 | 2 | 10 |
| 1v2 | Fast | 7 | 9 | **3 (fails the gate: south exits, see below)** |
| 1v2 | Relentless | 3 | 3 | 4 |

Classic AI (no rules; R3-A never runs here):

| Setup | Speed | r3-base | Step 2 | Merged tree (south exits) |
|---|---|---|---|---|
| 1v1 | Relaxed | 11 | 11 | 12 |
| 1v1 | Normal | 11 | 11 | 12 |
| 1v1 | Fast | 11 | 11 | 11 |
| 1v1 | Relentless | 10 | 10 | 11 |
| 1v2 | Relaxed | 4 | 4 | 7 |
| 1v2 | Normal | 1 | 1 | 2 |
| 1v2 | Fast | 2 | 2 | 1 |
| 1v2 | Relentless | 2 | 2 | 1 |

Step 2 (before R3-L): every cell is at or above `r3-base`; Classic rows are identical; Relaxed rows are identical
match by match. The gate held.

Faction bench (`tools/faction-bench.mjs --enemy ashfall --speeds relaxed,normal,fast,relentless`, Field + Expanded,
Step 2 against `r3-base`, bot win rate of 12): standard build 100 / 67 / 92 / 100 to 100 / 67 / 92 / 100;
rangers+towers 100 / 100 / 58 / 100 to 100 / 100 / 50 / 100 (Fast one match fewer, inside the margin).

## After the south exits (R3-L, owner: keep)

On the merged tree the Fast 1v2 cell fails (Field 7 to 3; Classic 2 to 1 is inside the margin). This comes from the
south exits, not from the Field AI:

- The losses at classic and riverlands come at 174 to 236 s whatever the bot's attack threshold: an early fight around
  90 s that the bot used to win now goes the other way. No R3-A code runs before 480 s.
- A wider sample, 1v2 coalition on 6 maps (classic, riverlands, dunes, basin, expanse, highlands, 24 matches per
  speed):

  | Rules | Speed | r3-base | Merged, R3-A off after 480 s too | Merged, census from 300 s | Merged, census from 480 s (shipped) |
  |---|---|---|---|---|---|
  | Field | Normal | 10 | — | 16 | 17 |
  | Field | Fast | 15 | 10 | 7 | 10 |
  | Field | Relentless | 11 | 12 | 9 | 12 |
  | Classic | Relaxed / Normal / Fast / Relentless | 11 / 9 / 7 / 2 | merged: 13 / 8 / **3** / 7 | | |

  So the south exits make **Fast against two rivals** harder (Classic 7 to 3, Field 15 to 10 with no R3-A at all) and
  Relentless and Normal easier. Starting the census at 480 s removes the Field AI's own share of it (7 to 10).
- Exits for the player only (rivals keep the old order) was tried as an experiment and was not better (3-map Field:
  Fast 1v2 3, Relentless 1v2 1). It was reverted.

**Owner decision needed:** keep the south exits as they are (Fast 1v2 is harder, Normal and Relentless 1v2 easier), or
ask for a Fast-only easing in Wave 2. The Field AI cannot give back the early-fight swing because it happens before
any of its round-3 code runs.

## Variety still holds (`npm run test:ai-census-check`, merged tree, census from 480 s)

| Faction (Field + Expanded, Dunes, Normal, 600 s) | Types | Workshop units |
|---|---|---|
| Meridian | 7 | 2 |
| Ashfall | 8 | 2 |
| Sunward | 8 | n/a |
| Wardens | 5 | n/a |
| Veil | 8 | 1 |

Highlands, Field against Field, 5 pairings: all end before 1800 s (740, 1056, 887, 296, 465 s). 10 of 10 pass.

## Pins (reason "difficulty guard", later "south exits (owner) + difficulty guard")

| Pin | r3-wave-1a | After Step 2 | Merged tree (final) |
|---|---|---|---|
| `golden-w2d` 180 s | a72ac3ba | 80fb27d8 (= r3-base) | 706784b9 |
| `golden-w2d` 600 s | 8cc05d90 | b422139c | 440a467c |
| `golden-round2` arena 300 | e4913c66 | 4cce2935 (= r3-base) | f94f7658 |

The other pins that moved on the merged tree moved because of the south exits (list in `wave-1.md`, Wave 1b).
