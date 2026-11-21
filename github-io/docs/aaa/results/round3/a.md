# R3-A: Field command fields its army (results)

Branch `r3/a-field-ai` from `r3-base` (5fad815). Worktree `C:\Users\n\source\repos\3d_astra-r3-a`. Port 4232. No push, no merge.

Every change sits behind `fieldPlan()` (`rules.aiPlan === "field"`, a computer team, `!this.mission`). Classic, missions and Defence never reach it. The classic perf scenes show the same final hash on both sides.

## What was built

| Item | Where | Notes |
|---|---|---|
| Army census | new `src/sim/ai-census.js`, hooked in `src/sim/ai.js` (a guarded `aiCensusPick` call in the training choice, plus a census save) | Roles: front, ranged, heavy, antiarmor, support, workshop, air (Kite left out). Target mix per faction in a new `balance.json` key `ai_mix` (appended). The enemy census raises anti-armour against vehicles (40%+ seen → 30%), ranged against an infantry swarm, and heavy against 2+ towers. Flyers seen set an anti-air floor (2 per flyer + 2). It is counted afresh each think and adds no state. |
| Wardens fix | the same call | The old `support` override always asked a Wardens Barracks for the Medic it cannot train, so it never got to Anti-tank. The census only offers roles the faction can train. |
| Workshop floor | `src/sim/content/workshops.js` (gated by `fieldPlan`) | Each host keeps at least 1 workshop unit, and the Barracks saves alloy for it (`aiCensusSave`). Veil now gets its Stalker before 600 s. |
| Join the fight | `ai-attack.js` `aiJoinFight`, `aiDanger` | A free fighter within 18 m of a visible enemy fighter attack-moves on it. While an enemy army (4+ supply) is in sight, no squad is sent to a capture ring. |
| Field economy | `ai-plan.js` `FIELD_PACE` / `fieldPace` | Normal: +3 Harvesters from 90 s, Foundry ×1.6, tech ×1.5. Fast: +2 from 60 s, ×1.5, ×1.3. Relentless: +1 from 80 s, ×1.5, ×1.3. Relaxed: unchanged. |
| S7 stall breaker | `ai-census.js` `aiBreakStall` | From 480 s match time, after 240 s with no contact (no own entity hit or fired) and with 8+ free fighters, they launch on the nearest enemy building seen (intel), tracked with `aiLaunch`. |
| Scouting | `ai-census.js` `aiScout` | An idle Kite flies the existing `scoutDestination` pattern. It extends the existing spotter; there is no new scout system. |

### Why the economy and the fight rules (beyond the brief)
The census alone left the bench at 100% for the bot. Ablations on `classic`, bot attack-at 16, showed:
- Concentrating the AI army by hand did not help.
- Turning off `aiPoints` did help: point duty pulled units away mid-fight.
- The main factor was army size. At the bot's push the AI had 13–16 units against the bot's 16–24, because its workers and tech timing (shared with Classic) under-spend on troops.

With the bigger crew and later tech, the bench came into band.

An early version added workers from 0 s. Then Ashfall's rush killed Meridian at 156 s in the `golden-w2d` match, so the extra workers now start from 60–90 s.

## Acceptance

### Census matrix (`npm run test:ai-census-check`, CI matrix `r3-a`)
Setup: each faction as the Field + Expanded rival on Dunes, Normal, against a turtling PlayBot (4 towers, Ranger-heavy), 600 s. Types count combat units fielded; Harvesters and the unarmed Kite do not count.

| Faction | Before: types / workshop | After: types / workshop | Fielded after |
|---|---|---|---|
| Meridian | 8* / 1 | 7 / 5 | antitank 2, breaker 7, engineer 7, gunner 5, medic 1, ranger 26, vanguard 11 |
| Ashfall | 9* / 1 | 7 / 2 | antitank 2, engineer 2, medic 2, rampart 2, ranger 16, scorcher 6, scrapper 38 |
| Sunward | 8* / n/a | 6 / n/a | antitank 5, breaker 7, engineer 3, rider 21, vanguard 14, wagon 3 |
| Wardens | **3*** / n/a | 4 / n/a | antitank 7, breaker 4, drone 19, vanguard 21 |
| Veil | 8* / **0** | 6 / 2 | breaker 9, engineer 5, ranger 19, shade 11, stalker 2, watcher 4 |

\* The before probe counted the Kite as a type, so subtract 1 for a like-for-like count. Wardens before: vanguard and drone only.

- Factions with workshop units: 3 of 3 have at least 1 by 600 s (before: 2 of 3, Veil missing).
- Every faction has at least 4 types (before: Wardens had 2).
- **Sunward and Wardens have no workshop units.** Their hosts have been wired but empty since round 2 (plan R2 §W1-A defers the Wardens unit to round 3, and no package of round 3 adds one). The "at least 1 workshop unit" gate cannot hold for them, so the tool reports "n/a". This is an integrator / owner decision.

npm test census test: Ashfall, 300 s, Field + Expanded, Dunes. It fields 4 types (rampart, ranger, scorcher, scrapper) and 1 Rampart, in about 4 s.

### Highlands, Field against Field, Normal, cap 1800 s
The sim has no seed, so 5 fixed pairings stand in for seeds. They include every pairing that timed out in a 25-pairing sweep of `r3-base`.

| Pairing | Before | After |
|---|---|---|
| meridian : wardens | timeout (armies 56:0) | victory 554 s |
| ashfall : meridian | timeout (68:10) | defeat 652 s |
| wardens : wardens | timeout (38:11) | defeat 1482 s |
| meridian : meridian | victory 1172 s | defeat 931 s |
| veil : wardens | victory 1524 s | victory 1304 s |

- After: 5 of 5 end before 30 minutes. Before: 2 of 5; across all 25 pairings, 22 of 25.
- The before stalls were dominant armies falling back from towers, not "no contact".
- The Wardens mirror stays the longest. At one point it ran to 1755 s; the fall-back rule in `aiWatch` against towers plus Pylons is the reason. Watch this pairing.

### Bench: `skirmish-bench --rules '{"aiPlan":"field","roster":"expanded"}'`
Setup: 3 maps × 4 attack-at, cap 2400 s. Figures are the bot's win rate.

| Speed | Before (r3-base) | After |
|---|---|---|
| Relaxed | 100% (12/12) | 100% (12/12) |
| Normal | 100% | **67%** (8/12) |
| Fast | 100% | **67%** (8/12) |
| Relentless | 75% | **58%** (7/12) |
| All 48 | 94% | 73% (35/48) |
| Field speeds (36) | 92% | 64% (23/36) |

- Relaxed stays at 100%: the AI pace is unchanged there, and Relaxed has no field commander (`aiCommandFor` is null).
- Early rushes (attack-at 12) still always win for the bot.
- Rows after:
  - Normal: c12 v247, c16 v512, c20 v476, c24 v774, r12 v444, r16 d597, r20 d597, r24 d597, d12 v251, d16 v257, d20 d993, d24 v576.
  - Fast: c12 v351, c16 v437, c20 v391, c24 v441, r12 d754, r16 v335, r20 v376, r24 v423, d12 d962, d16 d726, d20 v621, d24 d853.
  - Relentless: c12 v361, c16 d469, c20 d469, c24 d469, r12 v342, r16 v322, r20 d508, r24 d508, d12 v301, d16 v303, d20 v358, d24 v430.

### Timing (indicative, shared machine)
- `perf-ab --a r3-base --b src`, 5 runs, the three Classic scenes:
  - same final hash on both sides (3f77c63b, 3fddebae, 06e1a37a);
  - the deltas are noise on this machine (−39% to +56% in both directions).
- Field + Expanded scene (riverlands, 2 rivals, Fast, 300 s, `aiPlayer`), interleaved ABBA, 5 runs:
  - **think mean +14.8%, think p99 +15.5%** (under the 20% gate);
  - tick +14% (the field armies are bigger, so the matches are not the same);
  - the script was a scratch copy of perf-ab with a field scene. `tools/perf-ab.mjs` is not mine. **Seam request:** add a `riverlands-x2-field-300` scene there.

## Pins moved (declared)

| Pin | Old | New | Reason |
|---|---|---|---|
| `golden-w2d` 180 s | 80fb27d8 | a72ac3ba | census picks, field economy, join-fight |
| `golden-w2d` 600 s (GOLDEN_FULL) | 549eb7a3 | 8cc05d90 | same |
| `golden-round2` "arena 300" (GOLDEN_FULL) | 4cce2935 | e4913c66 | same (Expanded + Field, 4 factions) |
| `tests/field-command.test.js` | — | not edited | still green. The Fast tech delay was softened to ×1.3 so that "Tank or Walker by 600 s" holds (Meridian Classic 449 s, Wardens Expanse 470 s). |

Unchanged: every other golden pin, `d071360b`, and the mission checksums. `npm test`: 961 → 970 tests (+9), 944 pass, 26 skipped, 0 fail. `baselines:diff --full`: all 8 identical.

## Tests added (+9 in npm test)
`tests/ai-census.test.js`:
- the 300 s census;
- the role map;
- `ai_mix` sanity;
- pick toward the shortfall, with the air floor, the vehicle counter and no Wardens Medic;
- Classic, Expanded alone and missions never call the census, plus `fieldPace`;
- the S7 stall breaker;
- Kite scouting;
- the workshop floor (Veil Stalker under Field, none under the Classic AI);
- join-fight.

Long check: `tools/ai-census-check.mjs`, through the wrapper `tests/ai-census-check.mjs` (the ci-matrix test requires `node tests/*.mjs`). The script is `test:ai-census-check`, matrix entry `r3-a`. It takes about 4–6 min with 2 processes and needs no browser.

## Seam requests / notes for the integrator
1. `tools/perf-ab.mjs`: add a Field + Expanded scene (above).
2. Sunward and Wardens workshop units do not exist. The R3-A gate "1 workshop unit for all 5 factions" is n/a for them until a unit is added (owner decision).
3. `src/sim/ai.js`: the pop-cap line (R3-C's) is untouched; my inserts are new lines elsewhere. The `if (affordable) this.enqueue(...)` line was rewritten to also update the census. The behaviour is the same for Classic.
4. `balance.json`: one appended key, `ai_mix` (with `counter`, `stall`, `join`, `danger`).
5. The bench target is met at Normal, Fast and Relentless. Relaxed stays at 100% by design (Classic pace there).

## baselines:diff --full
All 8 baselines identical: missions story, standard, veteran, standard-mercy and standard-firm, chronicles, defence, bench-classic.
