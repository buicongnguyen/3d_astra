# Progression parity with Godot

Implemented September 8, 2026. The Godot edition already delivered these features in commit `2e8b275`; this update brings the Three.js edition to the same gameplay feature set.

## Completed scope

- Six unit types: Harvester, Vanguard, Ranger, Breaker, Medic and Engineer.
- Five buildings, each with three upgrade levels, visible level indicators and a description of its functions.
- Current HP, shield and effective attack in selection details. Info & stats opens an accessible, scrollable field guide covering every entity, including locked units.
- Real shields: damage is absorbed before HP; recharge is 4/s after five seconds without damage.
- Medic: 12 HP/s for other friendly infantry. Engineer: 18 HP/s for completed buildings and Breakers. Both have range 6, respect line of sight, cannot attack, cannot revive, and do not restore shields. Idle automatic support and explicit Support → ally orders work with mouse and touch.
- Command core L2 unlocks L2 upgrades for other buildings. Barracks L2 unlocks Medics; Foundry L2 unlocks Engineers. Command core L3 permits L3 building upgrades.
- Costs, prerequisites and production conflicts produce actionable messages. Level upgrades can be canceled for an exact, single full refund. Destruction gives no refund.
- AI follows the same costs and progression gates, and drains production queues before upgrading.
- Visible building-surface picking makes roofs and walls selectable, with a small-target fallback.
- Original Blender support models, editable sources and reproducible generation scripts; all six units include the same five rigid-part clips as the Godot library. Three.js retains its existing runtime articulated movement rather than evaluating these clips.

## Shared balance

`src/balance.json` is an exact copy of the Godot repository's `data/balance.json` at the release baseline. It is consumed directly by Three.js through `src/data.js`. The repositories remain independently runnable. Compare these files when changing balance in either edition.

| Unit | HP | Shield | Base attack | Production |
| --- | ---: | ---: | ---: | --- |
| Harvester | 55 | 10 | 4 | Command core |
| Vanguard | 150 | 60 | 15 | Barracks |
| Ranger | 85 | 25 | 12 | Barracks |
| Breaker | 300 | 80 | 30 | Foundry |
| Medic | 75 | 30 | 0 | Level 2 Barracks |
| Engineer | 100 | 30 | 0 | Level 2 Foundry |

| Upgrade | L2 | L3 |
| --- | --- | --- |
| Command core cost | 200 alloy / 100 energy | 350 alloy / 175 energy |
| Other building cost | 100 alloy / 50 energy | 200 alloy / 100 energy |
| Duration | 20 s | 30 s |
| HP versus base | +25% | +50% total |
| Shield versus base | +25 | +50 total |
| Production rate | 1.2× | 1.4× |
| Tower attack | +25% | +50% total |
| Relay supply | 15 | 20 |

Upgrades retain the current absolute HP deficit. Added shield capacity recharges normally. Existing troops are not individually leveled; the separate weapon research grants +10% combat-unit damage to both existing and future combat units. Supply remains capped at 100. Completed upgrades remain after a higher-level core is destroyed.

The three stages are economy, support technology, and fortified late-game production within the existing two maps. This release does not add separate campaign missions or saved progression.

## Review and validation

1. Rules review: validated costs, prerequisites, ownership for upgrades, shield overflow, recharge delay, support eligibility, cooldowns, line of sight, HP caps, production acceleration, supply loss, destruction and single refunds. Stop now clears an appended order queue, and completed/queued research is reported before resource shortages.
2. Integration review: checked all 11 entity GLBs, shared balance equality with Godot, building surface picks, support effects, shield bars, level markers and resource disposal. Field-guide keyboard input stays inside the native dialog and closing it restores its prior pause state.
3. UI review: tested desktop, touch portrait/landscape and tablet layouts, guide entry selection, cancellation/refund, Medic unlock/production, support targeting and level 3 technology. Screenshots were inspected for readable content and reachable close controls.

Three.js: 42 Node tests plus desktop, mobile, improvements and progression browser suites. Godot: 47 simulation checks, 37 progression checks, model/animation and native UI checks. Each GitHub workflow validates its own export before Pages deployment.

## Next improvements

- Scenario missions with saved completion: defend a relay, escort an Engineer, assault a fortified base.
- Longer playtests to tune unlimited HP support against ranged damage and shield recharge.
- Distinct building silhouettes for higher levels and richer support animations in the Three.js renderer.
- Physical Android/iOS performance and usability checks before expanding army sizes.
