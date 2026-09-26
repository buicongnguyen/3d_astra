# Code and gameplay logic review — 2026-09-26

## Reviewed versions

- Three.js: `308ec88`, including the earlier Claude-coauthored combat, repair, AI and campaign changes through `e334b8d`.
- Godot: `d0bba3c`, including the corresponding gameplay port and training mission.
- Fetched both SSH remotes before reviewing. Local `main` and `origin/main` matched in each repository, with no newer committed or uncommitted code changes at the start of this review. A later Claude edit in another directory or branch is outside this review until that location is identified.

## Confirmed findings and fixes

### P2 — Three.js discarded fresh attack commands after a failed firing-position search

When an attack could not find a firing position, the unit cached that failure for the target and navigation revision. A new Move or Attack command cleared its route but retained the failure. Repositioning and then attacking the same stationary target could therefore immediately discard the new command.

Fix: clear the firing-position cache when replacing orders or stopping. Appending an order still preserves the current engagement. Godot already cleared this cache on replacement.

Regression: exhaust the firing search against a screened target, move the Ranger to a different position, and order a fresh attack. It must approach again instead of immediately dropping the order.

### P2 — Godot attack-move chased a screened target while ignoring an available shot

Attack-move selected the nearest enemy without first looking for an unobstructed enemy in weapon range. With two enemies nearby, a blocked nearer target could make a Ranger move away rather than shoot the visible target it could already hit. Three.js already prioritized the available shot.

Fix: attack-move and patrol first acquire an unobstructed enemy within weapon range. Combat retains queued destinations and resets movement stall tracking. Explicit Move still withdraws, and explicit Attack retains its chosen target.

Regression: place a structure between a Ranger and the nearest enemy, with another enemy in clear range. Confirm damage to the clear target, retained queued orders, reset stall tracking, and immediate withdrawal after Move.

### P2 — Godot single-unit Move and Attack-move accepted destinations outside the map

Formation commands and Patrol clamped destinations, but a lone unit's Move or Attack-move could retain coordinates such as `(999, 999)`. The unit followed an edge route, then waited for an unreachable destination and reported a false blockage.

Fix: clamp all three positional orders to the active map boundary with unit-radius clearance, matching Three.js.

Regression: lone Rangers and tanks receive off-map Move and Attack-move commands on Classic and Expanse. Destinations must fit the map; actual corner movement must complete without a blockage warning.

## Validation

- All 132 Three.js logic tests pass, including the new real-command reproduction; the production build passes.
- Godot's focused review suite reproduced 18 failing assertions before the fixes and passes with zero failures afterward.
- Godot simulation (47 checks), progression (37 checks), patrol (63 checks), expansion, parity and tutorial suites also pass with zero failures or script errors.
- These fixes change simulation logic; no art, UI layout, or balance values were changed.
- This is a focused review, not a guarantee that every possible game defect is absent. Physical Android performance and internet multiplayer were not evaluated in this pass.

## Release verification

The fixes and regression tests use each repository's existing GitHub Pages release workflow. Publishing requires the logic, build and browser checks to pass. See the [Three.js workflow](https://github.com/buicongnguyen/3d_astra/actions/workflows/pages.yml) and [Godot workflow](https://github.com/buicongnguyen/3d_astra_godot/actions/workflows/pages.yml) for release results. Unrelated screenshots and import metadata are excluded from these changes.
