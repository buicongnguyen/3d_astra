# Lessons from building Frontier Command

Each entry: what happened, then the rule. Paths are in `github-io/` of this repo.

## Simulation and rules

- **Frozen workers.** Harvesters stopped just outside gathering range, or were called "stuck" by a
  distance-per-frame test. Rule: the approach point ends inside working range (target radius + 0.8
  approach, 0.2 tolerance, + 1.4 gather range); "stuck" is measured as progress over time; a truly
  blocked order times out after about 6 s with a message. Explicit Move and Stop always interrupt.
- **Cargo lost or duplicated on redirects.** Rule: carried cargo keeps its resource type and is
  delivered before a new type is collected; on depletion deliver the partial load, then take the next
  queued order, else the nearest explored same-type deposit in range.
- **A new feature changed every save.** Rule: state is created lazily (only when the match uses the
  feature); the pinned hash test (`tests/factions.test.js`) fails otherwise.
- **Derived state missing after load.** A blown bridge loaded as intact. Rule: anything derived from
  saved state (`applyCrossings`) is re-applied in `snapshot.restore`, with a save/load test.
- **AI-vs-AI balance barely moves with numbers** because the first fight decides the game. Rule:
  measure with a bench, stop tuning after a few passes, and record what is still outside the band
  (`docs/BALANCE.md`) instead of chasing it.
- **A knife-edge mission.** One mission is barely winnable by its bot. Rule: do not change a
  mission's starting force without re-running its bot on every difficulty.
- **Splash and abilities hit things they should not** (flyers, unseen plateau tops). Rule: one
  `canHit` / sight gate used by every damage path, tested per weapon.

## Terrain and maps

- The engine assumes two ground heights and one river line. Terraces and twin rivers were cut in
  review rather than half-built. Rule: check engine assumptions in the plan review, and cut early.
- Only cells deeper than a set distance inside a plateau are hidden from below. Towers on the rim
  can be hit; deep ones reach less. Rule: make the trade-off visible (marks on pads, card lines).
- Story text had the ford and the bridges swapped for weeks. Rule: text that names map features is
  checked against the map data by a test.

## Client and UI

- A long label ("Needs Barracks L2") overflowed a command tile on CI's Linux fonts although a local
  font probe passed. Rule: tile sub-lines stay short (about 10 characters); no `system-ui`.
- A fourth mode card pushed a counter under the pinned Start button on short phones. Rule: every
  start-screen change is checked at 390x700 and 320x568 too.
- Swapping materials on instanced parts created new batches and broke the draw budget. Rule: tint
  with instance colour (`userData.tint`).
- Many synchronous renders in a test queue frames the software renderer flushes later (a screenshot
  timeout on CI). Rule: keep render loops in tests short.
- Enemy units are not selectable, so players could not learn their names. Rule: a hover label on
  desktop and a tap notice on touch.

## Tests and CI

- **Five red CI runs in a row** were tests racing the game's real-time clocks on slow, GPU-less
  runners: a wave countdown expired, a win scene outlasted a wait, a cooldown ended before it was
  checked, a dialogue line came and went. Rules: `__frontier.hold` + `step()`, `skipScene()`, reset a
  countdown instead of racing it, one `page.evaluate` for related measurements.
- **The opposite race:** a check read once right after the start was too early on a fast machine.
  Rule: `waitForFunction`, then read.
- **A local slow-render switch never reached most suites** (they launch Chrome themselves). Rule:
  slow mode is a `node --import` preload that patches the launcher (`tests/lib/ci-like.mjs`).
- **A service-worker test** reopened the game while the closed page was still a client, so the new
  worker never took over. Rule: watch the hand-over from a page outside the worker's scope.
- **A hidden build error** let a whole run test an old `dist/`. Rule: build with visible output and
  stop on failure (the runner does both).
- **New suites missing from CI.** Rule: a unit test compares package.json's browser suites with the
  workflow matrix.
- `page.waitForFunction` does not await a predicate that returns a promise; poll async checks from Node.
- `vite preview --host 127.0.0.1`, or the suites cannot connect.

## Working method

- Merging agents' branches: conflicts cluster in the composition root, commands, the frame loop and
  the catalogues. Keep both sides; union-merge append-only files; a duplicate import breaks the build.
- Merging during a test run produced false failures and overlapping runs. Rule: never.
- A leftover worktree folder held a `node_modules` junction into the live install. Rule: unlink the
  junction (`cmd /c rmdir`), then delete; verify the real install after.
- Experiment output (music takes, logs) landed in another project's folder. Rule: everything for
  this project lives in this repo (`music-lab/`, `.tmp/`).
- Music: generate several takes per cue, pick by measurement (loop seam, beat steadiness, no
  voice-like sound), keep a blind listen page so the owner can swap (`music-lab/README.md`).

## Where to read more (this repo)

`RECREATE_GAME_PROMPT.md` (full starting spec), `github-io/docs/ARCHITECTURE.md`,
`ASSET_PIPELINE.md`, `MISSIONS.md`, `BALANCE.md`, `TESTING.md`, `CHANGELOG.md`,
`docs/aaa/PLAN_ROUND3_REFINED_2026-11-13.md` (a plan after logic and code review, as a model for
planning a large round) and `docs/aaa/IMPLEMENTATION_PROGRESS.md` (the running record).
