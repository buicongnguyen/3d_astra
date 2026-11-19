# W0-B · Sim seams and status core: results

Branch `r2/w0b-sim-seams` (worktree `3d_astra-r2-w0b`), based on `feat/aaa-round2` at `4f951a6`. Port 4233.
Measured 2026-11-19 on the shared machine (CPU at 100%, about 100 node processes from other sessions):
every timing below is indicative.

## Scope

D1 (the promotion fix) was already on `feat/aaa-round2` (`1da6220`, `98c0471`) with the lazy `baseHp`
mechanism, so this package skipped its commit 2, as the integrator's Wave 0 status note says. The ratio
rule was not written, and `baseHp` was kept. Commit 1 (the seams) is the package. D1's before and after
tables now sit in `docs/BALANCE.md` ("D1: promotion keeps health factors").

| Commit | What |
|---|---|
| `047bfc5` | Sim seams H1 to H20, content registry, dispatcher, status core, rules option, shot `unit` and `tags`, `preferredEnemy`; `tests/content-seams.test.js`, `tests/effects.test.js` |
| `a44910b` | `tests/progression.test.js` counts only the Classic roster |
| `922480b` | `tools/perf-ab.mjs` |
| (last) | `docs/CONTENT_SEAMS.md`, `docs/BALANCE.md` D1 section, `docs/CHANGELOG.md`, this file |

## What a later package gets

- `src/sim/content/index.js`: the append-only module list (empty). `src/sim/content.js`: the dispatcher,
  with the module API of the plan (`id`, `order`, `mixin`, `onSpawn`, `hitScale`, `onHit`, `taken`,
  `onDeath`, `step`, `fight`, `statuses`, `abilities`, `autocast`, `towerAim`, `commands`, `aiRules`)
  and the test hook `setContentModules(list)` (returns a restore function).
- `src/sim/effects.js`: `applyStatus(e, id, seconds, { immune })`, `hasStatus`, `clearStatus`,
  `activeStatuses` (for W1-B's icons), `statusFactor(e, "speed" | "reload" | "taken")`,
  `canAct(e, "fire" | "cast")`, and `statusInfo(id)`.
- `sim.rules` (only when set), `sim.ruleOn(id)`, rules saved with the options.
- `prefers` on a definition (H5), `aim` on a tower (H6), shot events with `unit` and `tags`.
- `tools/perf-ab.mjs` for every timing gate of the round.
- `docs/CONTENT_SEAMS.md`: the rules, the API, the seam table and a worked example (tracer rounds). The
  example was run as printed in the doc (extracted from it into `.tmp/`): its status and tag land, its
  Volley autocasts, the buff's key is deleted after it, and the idle match keeps `d071360b` with the
  example registered.

## Acceptance

| # | Criterion | Result | Met |
|---|---|---|---|
| 1 | Before editing, record the hashes of the 6 W0-A skirmish setups, the 3 `playDefence` runs and `check:defence --json` at the base | Recorded in `.tmp/` before the first edit (scratch, removed at hand-off: the tables below are the record). The base `check:defence --json` equals the integrator's `check-defence-after-D1.json` byte for byte. | yes |
| 2 | Commit 1: all identical; `d071360b` and the 13 checksums hold | 70 of 70 recorded values identical after the seams (6 setups at 60, 180 and 300 s, their end, a save at 180 s reloaded to 300 s, the 3 Defence runs with stars, lives and towers, 5 story runs, the idle match, and the sim and entity key sets). `check:defence --json` byte-identical (PASS). `npm test` (with the golden pins and `tests/wings.test.js` checksums) green. | yes |
| 3 | Tick time on a 300 s riverlands ×2 run within +3% of the base (`perf-ab`, interleaved, median of 7) | Mean tick +0.4% (2.600 → 2.609 ms) and, in a second sample, -7.6% (0.489 → 0.452 ms): within the noise of a loaded machine; same final state on both trees. The integrator's quiet-machine re-run is the gate. | yes (indicative) |
| 4 | Commit 2 (D1) items | Skipped by the integrator's note: D1 is merged. Its tables are in `docs/BALANCE.md`. | n/a |
| 5 | Every `check:defence` target still met | PASS, output identical to the base | yes |
| 6 | Test count +25 or more | 645 → 680 (+35): `content-seams` 22, `effects` 11, `progression` +2 | yes |

### Before (base `4f951a6`) and after (`047bfc5`): identical

| Run | 60 s | 180 s | 300 s | End | Save at 180 s, reloaded, at 300 s |
|---|---|---|---|---|---|
| classic ×1 Normal | fef65c4f | 39426dbc | 6d992886 | defeat 231 s | 6d992886 |
| highlands ×2 Relentless coalition | 807ca1eb | 5450ac4a | 45ab65f9 | defeat 181 s | 45ab65f9 |
| riverlands ×2 Fast | 30be65e6 | d16fd4cd | 3f77c63b | running 300 s | 3f77c63b |
| basin ×3 Fast | 853fdf6c | 8422f5d9 | db45b921 | defeat 246 s | db45b921 |
| riverlands ×3 Normal, Sunward against Mixed | 40065495 | 2f53b764 | f3ddca7f | defeat 225 s | f3ddca7f |
| dunes ×1 Normal, Ashfall against Veil | de227178 | 4ab6d6f0 | 66b87d1b | victory 294 s | 66b87d1b |

| DefenceBot, Standard | Result | Towers at the end | Hash |
|---|---|---|---|
| d-gorge | victory 3★ 20♥ | r3mr3r3b3s1r3b3s1a3b2t3s1b1 | 3f391c5e |
| d-bridges, demolishing | victory 3★ 18♥ | r3r3r3r3r3r3r3b1a3s1t1a2t1 | d3c0f7a1 |
| d-crossroads | victory 2★ 15♥ | b3s3b3s3a3t3b3a3s3b3t3s1b3 | c77144f6 |

| Story run (Standard) | Hash |
|---|---|
| m01 ObjectiveBot 120 s | a740365c |
| m03 ObjectiveBot 120 s | 9d9693b6 |
| m06b ObjectiveBot 120 s | 223ff814 |
| m02b DefenceBot 120 s / to the end | 4c430aeb / victory 2★ 14♥ d1f56ddf |
| ca1 ObjectiveBot 120 s | ab4e3941 |
| Idle all-Meridian match, 60 s | d071360b |

### Timing (`tools/perf-ab.mjs`, A = base `4f951a6`, B = this branch, ms per tick, median of 7 ABBA runs after one warm-up each, GC before each run)

| Scene | Side | Mean | p50 | p95 | p99 |
|---|---|---:|---:|---:|---:|
| riverlands-x2-300 | A | 2.600 | 0.285 | 3.823 | 98.591 |
| | B | 2.609 | 0.290 | 4.434 | 104.004 |
| | B/A | +0.4% | +1.7% | +16.0% | +5.5% |
| riverlands-x2-300, second sample | A | 0.489 | 0.241 | 1.199 | 3.832 |
| | B | 0.452 | 0.256 | 1.289 | 2.950 |
| | B/A | -7.6% | +6.1% | +7.5% | -23.0% |
| crossroads-wave-120 | A | 0.275 | 0.062 | 0.381 | 2.658 |
| | B | 0.239 | 0.062 | 0.377 | 2.570 |
| | B/A | -13.1% | +1.1% | -1.1% | -3.3% |

The machine was saturated during the first samples: one riverlands 300 s run took 7.6 to 15.6 s there
against the plan's 0.5 to 1.4 s, and p99 was near 100 ms per tick; the second sample ran at lower load
(2.9 s a run). The crossroads mean of -13% and the riverlands means of +0.4% and -7.6% show the noise
level (B runs the same code plus guards). p50 rose in both riverlands samples (+1.7%, +6.1%), so I
isolated the most frequent new guard, `if (e.prefers)` at the top of `enemy()` (every unit, every tick):
12,900 `enemy()` calls on a real 180 s riverlands state, 9 interleaved rounds, gave B against A +5%, -5%
and +13% in three repeats (2.4 to 3.7 µs a call either way, the same targets found). That is noise, not
a measurable cost; the quiet-machine run should confirm the p50 too. Both scenes end in the same state on both trees (3f77c63b, 06e1a37a). Command for the
integrator's quiet-machine run: `node --expose-gc tools/perf-ab.mjs --a 4f951a6 --b src --scene riverlands-x2-300 --runs 7`
(`--a` takes a src folder or any git ref; a ref is extracted into `.tmp/perf-ab/<commit>/`).

### D1 and the seams together

- A registered timed buff never saves or restores `hp`, `maxHp`, `baseHp`, `shield`, `maxShield`,
  `rank`, `xp`, timers or bookkeeping (`BUFF_PROTECTED` in `src/sim/content.js`); changing one throws.
  Test: a Ranger with its own `baseHp` 200 casts a fixture buff, is promoted during it (216), and keeps
  216 and `baseHp` 200 after the buff ends, while the buff's `range` comes back and its `pierce` is gone.
- `docs/CONTENT_SEAMS.md` rule 5: a module that changes `maxHp` calls `sim.setBaseHp(e)`.
- The commander's health at the end of the Standard bot runs, before D1 (`8e2ff6b`) and now: Three
  Roads 645 (rank 3) → 1,161 (rank 3), the plan's figures. Full table in `docs/BALANCE.md`.

## Tests

| File | Tests | What |
|---|---:|---|
| `tests/content-seams.test.js` | 22 | Registry checks (unique ids and step orders, unknown fields, clashes), rules absent (byte-identical save) and present (round trip, `ruleOn` fallback), each hook H1 to H20 with fixture modules (spawn order, step order, damage factor and tags from the main target only, `unit` on every shot, taken and death order, the fight hook moving its own type and leaving a battle without it identical, autocast answers, tower aim, a registered command replaying from the log, mixin and command clashes), the timed buff (keys back, added key deleted, save mid-buff, D1 coexistence, instant abilities), AI rules, `preferredEnemy`, no-op hooks of every kind keeping the classic ×1 golden hash at 180 s, and the sim and entity keys after a 300 s AI match equal to the base (and no `fx`) |
| `tests/effects.test.js` | 11 | Lazy state, lifetimes, never shortened, immunity, factor products in registration order, movement, reload, noFire on a tower (still aimed), noCast, taken, the sweep (back to a state hash equal to a match without statuses), a save mid-status reloading and playing on identically |
| `tests/progression.test.js` | +2 | Classic-roster counts; a fixture `roster: "expanded"` set left out; the Ashfall shield rule; every definition still has a description and a model |

`npm test`: 680 tests. In the full run one wall-clock check failed under the machine's load
(`review-2026-09.test.js` "binary-heap pathfinding ... quickly", 250 ms budget, navigation code this
package does not touch); alone it passes in 43 to 49 ms, three times out of three.

Time of the new files (the 300 s and 180 s AI runs dominate): `content-seams` 3.3 s and `effects`
0.7 s alone at 33% machine load, 2.4 s for both with `progression` in parallel (about 13 s and 3 s at
100% load). The 300 s "no fx" check shares its run with the key check, inside the 10 s budget.

Final `npm test` on the committed tree: 680 of 680 green (82 s).

## Browser checks

All 23 CI groups (50 suites) on port 4233 with `tests/ci-local.mjs --fast --no-unit`, 2 lanes, in two
batches; ci-local builds, serves the build on 4233 and stops it by PID:

- `desktop story commands ui-extras defence bosses interface air chronicles`: 20 of 21 passed first time,
  `interface/render-budget` (all 12 scenarios, `battle-eco` included) among them. `chronicles/chronicles`
  timed out once on a 30 s tap of a Chronicle card (`tests/chronicles.mjs:89`, 232 s under load) and
  passed on the rerun (79 s).
- `training mobile settings scenes music languages progression maps construction feedback status-layout
  layout-desktop layout-mobile visuals`: 28 of 29 passed first time. `maps/corners` timed out once in
  `page.goto` (30 s, the page did not load under load) and passed on the rerun (175 s).

Nothing in this package touches the client, and the sim it drives plays identically (the hashes above).
Both first-time failures were waits for the browser under load, not checks of game state.

## Deviations from the brief (code facts and design choices)

1. **D1 commit 2 not done** (integrator's note): `baseHp` stays; no ratio rule.
2. **Statuses register through the module's `statuses` field.** The contract table names
   `registerStatus`; there is no separate function (a second path would escape the test hook's
   rebuild). `statusInfo(id)` reads one. Noted in `docs/CONTENT_SEAMS.md`.
3. **`hitScale` and `onHit` also get the shot's `tags` list** (`hitScale(sim, e, t, tags)`,
   `onHit(sim, e, t, tags)`). Only the shot's own target can tag the shot; a splash victim's tags are
   dropped (a "rear" label at the wrong unit would mislead). The call site passes `t === target`.
4. **`rules` is saved once, in the options**, not in the state (`DERIVED.add("rules")` in
   `snapshot.js`), and handed back to the constructor on load. `rules: {}` or `null` gives no field.
5. **The sweep counts ticks** (every 20th) instead of keeping a clock field, and also deletes
   `sim.fxOn` once no entity has `e.fx`, so after the last status the state hash equals a match that
   never had one (tested).
6. **Registered abilities** may also be instant (`use()` returns `{}`), and a buff may set its own
   `duration`. A registered ability may not reuse a built-in id (`BUILT_IN_ABILITIES` exported from
   `sim/tactics.js`), and a module with an unknown field throws at import.
7. **Source-text tests:** the brief says `terrain-labels`, `choices`, `mission-ui` and `story-scenes`
   (and W0-A's `wings`, `chronicles`, `player-faction`) read `simulation.js` as text. They import it;
   no test reads any file this package edits as text. No test outside this package's list needed a
   change.
8. **`effects.test.js`'s "no fx after a 300 s AI run"** check runs inside the key check of
   `content-seams.test.js` (one 300 s run instead of two, for the `npm test` time budget).
9. **The brief's line numbers held** (`simulation.js:436`, `combat.js:7` and `:31`, `traits.js:103`).
   Three existing lines changed in place: the constructor signature (`rules = null`), `e.cooldown =
   e.interval` (H9) and the `hit` condition in `fight()` (H10), plus `abilityReady()` gained a clause
   on a new line and `if (TIMED[a.id])` became `else if` after the H15 line. Everything else is new
   lines.

## Seam requests

None.

## Test changes for the integrator

None. When W0-A's split lands, `tests/golden-play.test.js` disappears; this package's tests do not
import it (the classic ×1 180 s hash `39426dbc` is asserted directly in `content-seams.test.js`).
`docs/CHANGELOG.md`: both Wave 0 packages create `## Unreleased: AAA round 2`; keep one heading with
both subsections under it.

## Notes for the owner and the integrator

- **Same bug class as D1, reported only:** building levels rebuild health from the type
  (`progression.js` `updateLevel`). A player who levels the Basin relay in Copper Harvest (1,200) or
  Copper Siege (3,500), the Copper refinery in Wings over Copper (2,000) or the Caravan beacon in A Debt
  in the Dunes (2,000) drops it to 562.5 at level 2 (checked headless with a 3,500 relay). The AI never
  levels a mission object (it skips tagged entities). Fixing it changes campaign play: owner decision.
- Mission `hp` spawns (`sim/missions.js:100`) already call `setBaseHp` since D1.
