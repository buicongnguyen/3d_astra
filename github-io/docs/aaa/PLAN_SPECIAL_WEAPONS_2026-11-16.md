# Special weapons plan: missile and its answers, EMP, Sonic, smoke, mines (2026-11-16, at 0.19.0)

> **Status: plan only.** Nothing here is built. It runs **after** Wings II
> ([PLAN_WINGS2_2026-11-16.md](PLAN_WINGS2_2026-11-16.md)) is released and measured, because it
> depends on that plan's baseline bench and on the `slowed`/timed-effect work there.
> Owner ideas (2026-11-16): a sound weapon that freezes a type of enemy, an EMP, a long-range missile
> that can be dodged or shot at, and an anti-missile weapon.

## 1. Goal

More expert play: weapons with a clear answer, so a match is won by scouting, timing and
combinations, not by unit count. Every weapon here has (a) a visible warning or tell, (b) a counter
that already exists or ships in the same release, (c) a cost that makes a wasted use hurt.

The triangle the plan builds:

| Weapon | Stops | Does nothing to | Answer |
|---|---|---|---|
| Sonic | infantry | vehicles, buildings, flyers | bring vehicles; spread out; kill the emitter (short range) |
| EMP | vehicles, towers, flyers (all mechanical) | infantry | bring infantry; stay out of its radius; it removes shields only for a few seconds |
| Missile | anything that stands still, buildings | units that move out, anything under an interceptor | shoot it down, intercept it, dodge it |

## 2. Releases

| Release | Content | Depends on |
|---|---|---|
| **0.22 "Long reach"** | Missile launcher, the missile as a flying object, three defences (shoot down, tower interceptor, dodge), AI for both sides | Wings II released; air rules (`sim/air.js`) |
| **0.23 "Pulse"** | EMP and Sonic as a matched pair, status marks over affected units | 0.22 played; timed effects from Wings II |
| **0.24 "Fieldcraft"** | Smoke screen, mines | 0.23 played |
| later, only if play-testing asks | Shield truck (mobile point defence), decoy, Overcharge | - |

Each release goes through the measurement in section 7 and can be stopped there.

## 3. 0.22 "Long reach": the missile and what stops it

### 3.1 The missile

| | Starting value | Notes |
|---|---|---|
| Launched by | **Launcher**, a Meridian vehicle at Foundry level 3 (takes the place of nothing if the fourth Foundry tile fits; otherwise see 6.2) | Meridian's signature weapon; other factions get the defences |
| Order | the Launcher's single ability: aim at a point 18 to 60 m away | reuses Barrage aiming (`app/abilities.js`, `tactics-view.js`), with a minimum range |
| Needs | sight of the point, or the point explored and a friendly Kite within 12 m of it | makes the Kite a spotter for artillery; no blind fire on hidden plateau tops |
| Cost per shot | 150 alloy, 50 energy, cooldown 40 s | paid on launch; the attacker loses real resources when it is stopped |
| Flight | speed 9, straight, at flyer height: 2 to 7 s | long enough to react |
| Missile health | 60, no shield | two or three Rangers already in place kill it; one does not |
| Blast | 140 damage in 3.5 m, half at the edge, 1.25× to buildings, never hits flyers | removes a tower's shield and half its health; kills infantry that stay |
| Warning | ring at the landing point for the whole flight (enemy colour), incoming whistle, minimap ping for the target's owner if they see the point | same rule as Barrage: seen warnings only, fog respected |

**Rules.** The missile is an entity of a new type `missile`: `flying: true`, no orders, no
selection, no supply, not counted in the air cap, removed on impact or death. It exists only while
in flight, so a match without missiles keeps its state and the `d071360b` hash. On impact it reuses
the strike path (`sim.strikes`: damage, radius, team, credit to the Launcher). A missile whose
Launcher died still lands. Saves taken mid-flight load and land identically (test).

### 3.2 Three defences (all ship with the missile)

| Layer | Rule | Weakness the attacker can use |
|---|---|---|
| **Shoot it down** | `canHit` already lets `hits_air` units and Flak towers target a flyer; missiles are included, with target priority above other flyers when one is inside range | needs units in place; a thin line lets it through |
| **Interceptor** | research at the Command core (like Flak, level 2): each completed tower destroys one enemy missile that comes within 10 m, then recharges 20 s. Shown as a ring when the tower is selected and a small ready light on the tower | one per recharge: two missiles together, or a bait, get through. Covers the tower's surroundings only |
| **Dodge** | units move out of the ring; no rule needed | buildings cannot; an unwatched army does not |

Interceptors also stop a Kite's Crash dive (Wings II) inside their range: the Kite becomes a cheap
bait, which is the intended expert combination.

**Economics rule.** A missile always costs more than the thing that stops it: interception is free
after the one-time research (125/100), so firing into a covered base wastes 200 resources.

### 3.3 Computer player

- **Attack:** fires only at a point it sees with at least a building or four units in the blast, and
  not at a point within 10 m of a tower it has seen intercept in the last 60 s.
- **Defence:** researches the Interceptor after the second missile lands on it (the Flak pattern in
  `sim/ai-counter.js`: seen-count threshold), and moves units out of a seen ring when they are not
  fighting (reuse the Barrage avoidance if present; otherwise new, in `sim/ai-attack.js`).
- Difficulty changes reaction time, never sight.

## 4. 0.23 "Pulse": EMP and Sonic

Both are a unit's single ability, both are short-range (the carrier must get close), both show a
0.8 s wind-up ring before they fire, and both mark affected units with an icon and a timer bar.

| | **EMP** (Wardens, on the Drone, which has no ability today) | **Sonic** (Sunward, on the Supply wagon, which has no ability today and no weapon) |
|---|---|---|
| Area | 5 m circle around the caster | 6 m cone in front (or 4.5 m circle if cones cost too much UI) |
| Affects | enemy **mechanical** units, flyers and buildings | enemy **infantry** (non-mechanical units) |
| Effect | shields to 0 and no shield recharge for 5 s; cannot fire for 3 s (towers and interceptors included) | cannot move or fire for 2.5 s |
| Limits | at most 3 buildings per pulse (nearest first); does not stop production or research | a unit freed from a stun is immune to Sonic for 8 s |
| Cooldown | 45 s | 40 s |

**Rules.** One lazy timed-effect field per affected unit (`effects: { emp, stun }` with end ticks),
checked in `combat` (may fire), `movement` (may move) and shield recharge. Removed when it ends, so
unaffected matches serialize as before. Abilities already in progress are not cancelled; a stunned
caster's cooldown keeps running. Wardens are above the balance band today, so their EMP starts at
the weak end and is the first thing cut if the bench says so (section 7).

**Combination to test on purpose:** EMP on a tower line, then a missile into it (interceptors are
silent for 3 s). It must be possible and must not be automatic: the EMP carrier has to survive to
5 m from the towers.

## 5. 0.24 "Fieldcraft": smoke and mines

| | **Smoke screen** (Veil, on the Shade, which has no ability today) | **Mines** (Ashfall; every Ashfall unit already has an ability, so the carrier is decided in that release's review: a new light unit, or the Salvage yard as a building ability) |
|---|---|---|
| What | a 5 m cloud for 8 s at a point up to 9 m away | a mine placed where the layer stands, 3 carried, 20 s to rearm one |
| Rule | units inside are not visible to enemies outside beyond 3 m; units inside see only 3 m. Uses `isVisible`, so targeting, drawing, minimap and sound follow | hidden (the cloak rule) and revealed by `detect` (Kite 8 m); triggers on an enemy ground unit within 1.2 m: 60 damage in 2.5 m; own units never trigger it |
| Counter | walk in; splash and missiles still hit the area; detectors do not see through | scout with a Kite, then shoot the mine (it has 20 health once seen) |
| Cap | one cloud per caster | 6 live mines per team |

Smoke changes vision, the most shared rule in the game: it gets its own review of every `isVisible`
caller before any code, and a fog-leak test (nothing inside a cloud is drawn, pinged or heard from
outside).

## 6. Things every release must respect

1. **Hash and saves:** `d071360b` unchanged; every new state lazy; a save taken with a missile in
   flight, an active EMP, a stun, a cloud and a live mine loads and replays identically.
2. **Phone tiles:** one ability per unit. If the Foundry cannot hold a fourth unit tile at 390x844
   and 844x390 (shown by a screenshot in package S4, before the model is made), the missile becomes
   a research that upgrades the Breaker's Barrage for Meridian instead of a new unit (decision E3).
3. **Fog:** warnings, rings, whistles and status icons follow `isVisible` for the viewer's team.
4. **Tells:** every weapon has a wind-up or flight the victim can see, and every affected unit shows
   what hit it and for how long. No random outcomes (no jammers, no miss chances).
5. **Draw budget:** `battle-eco` 120, `air-battle-eco` 118; missiles and rings are pooled effects,
   a mine is one instanced mesh.
6. **Text:** every string in `vi.json`; a field guide entry and one first-time hint per weapon.
7. **Motion-off:** rings and icons stay (they are information); only their animation stops.

## 7. Measurement (keep or drop)

Baseline: the Wings II bench. For each release, on the same 120-match round robin plus the test-bot
tables:

- No faction's overall win share moves by more than 5 points, except towards the 35 to 65% band.
- Wardens do not rise at all from the EMP; if they do, lower its numbers once, then cut it.
- Median match length stays within ±15% (missiles must not turn matches into sieges, EMP must not
  make them coin flips).
- New: a **weapon-use report** from the bench (shots fired, intercepted, shot down, dodged, landed;
  pulses and how many units each caught). A weapon that lands under 20% or over 80% of the time is
  retuned; a second miss means it is cut.
- Missions and Defence are unaffected unless a weapon is deliberately added to them (not planned).

## 8. Work packages and who does them

Same method as Wings II: one agent per package in its own worktree, temporary files in `.tmp/`,
the lead merges and reviews. Easy packages go to Sonnet 5.5, UI and Blender to Opus 5.5.

| # | Package (0.22) | Model |
|---|---|---|
| S1 | Missile entity, launch command, flight, impact, save/load, shoot-down priority, unit tests | lead (Fable) |
| S2 | Interceptor research and tower rule, bait rule for the Kite dive, unit tests | lead (Fable) |
| S3 | Launcher and missile models, tower ready-light part (Blender kit) | Opus 5.5 |
| S4 | Client: long-range aiming with minimum range, flight trail, landing ring, whistle, interceptor ring and flash, card lines, Foundry tile check at phone sizes | Opus 5.5 |
| S5 | AI attack and defence rules; weapon-use report in the bench | lead (Fable) |
| S6 | Browser suite `tests/missile.mjs` (launch, ring, dodge, shoot down, intercept, bait, three viewports), render-budget scene | Opus 5.5 |
| S7 | Text, field guide, hints, docs | Sonnet 5.5 |
| S8 | Merge, code and logic review, bench, `test:ci-local` slow and fast, release | lead (Fable) |

0.23 and 0.24 get their package tables when their turn comes, from what 0.22 taught.

## 9. Owner decisions

| # | Question | Default if no answer |
|---|---|---|
| E1 | One signature weapon per faction (missile Meridian, EMP Wardens, Sonic Sunward, smoke Veil, mines Ashfall), with defences for everyone | yes |
| E2 | Interceptors also stop a diving Kite (bait play) | yes |
| E3 | If the Launcher does not fit as a fourth Foundry tile on phones: make the missile an upgrade of the Breaker's Barrage instead of a new unit | yes |
| E4 | Shield truck (mobile anti-missile) only if play-testing shows field armies are helpless | yes, wait |
| E5 | Special weapons in Skirmish only at first; campaign and Defence later | yes |

## 10. Not doing

Jammers that turn missiles around, random misses, flares on every unit, a second ability per unit,
nuclear-scale "super weapons" that end a match in one use.

**Bunkers and barricades: decided against (owner, 2026-11-16).** They risk abnormal behaviour.
What the code check found: nothing lets a unit enter a building (Defence "crews" are tower labels,
not soldiers inside); every obstacle blocks shots both ways (`nav.clearLine`), so cover that units
fire over would need a new rule in the most shared combat path; the computer player skips walls as
targets and would not break through a player-built line. Do not propose them again without a new
owner decision.

**Surrender and prisoners:** campaign only (owner, 2026-11-16); not planned yet, and not part of
this plan.
