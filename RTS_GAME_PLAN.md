# Detailed Plan: 3D Real-Time Strategy Game

Build a small, complete RTS inspired by **Age of Empires' economy and construction** and **StarCraft II's responsive controls and readable combat**, using original assets and game design.

This plan assumes **Godot with GDScript and Blender**. Unity or Unreal can replace Godot using the architecture mapping at the end. Use one engine for the entire project.

## 1. Game concept and scope

**Working title:** Frontier Command

**Setting:** Two expedition forces compete for resources on an abandoned alien frontier.

**Visual style:** Stylized science fiction with angular buildings, readable silhouettes, restrained textures, and strong team colors.

**Perspective:** Elevated 3D RTS camera.

**Platform:** Windows, mouse and keyboard.

**Mode:** Single-player skirmish against one AI opponent.

**Target match length:** Approximately 10–15 minutes, subject to playtesting.

The player starts with a headquarters, four workers, and enough resources to begin expanding.

**Core loop:**

1. Scout nearby terrain.
2. Assign workers to resources.
3. Build supply and production structures.
4. Train a mixed army.
5. Defend the base and contest expansion resources.
6. Destroy the enemy headquarters.

**Initial scope:**

| Category | Included |
|---|---|
| Factions | One faction shared by both sides |
| Maps | One handcrafted battlefield |
| Resources | Alloy and energy |
| Units | Worker, melee fighter, ranged fighter, heavy fighter |
| Buildings | Headquarters, supply relay, barracks, foundry, defensive tower |
| Progression | One weapon upgrade |
| Match outcome | Victory, defeat, restart |
| Excluded | Multiplayer, campaigns, naval combat, flying units, complex technology trees |

## 2. Establish the project

**Tasks**

- Inspect the installed engine and Blender versions.
- Inspect available Blender skills or integrations.
- Create the project and version-control setup.
- Configure input actions and collision layers.
- Establish scale: **one world unit equals one meter**.
- Create a graybox test level and a separate asset-import test scene.
- Document naming, export, and folder conventions.

**Suggested structure**

```text
project/
├── assets/
│   ├── models/
│   ├── materials/
│   ├── textures/
│   ├── animations/
│   ├── audio/
│   └── ui/
├── scenes/
│   ├── maps/
│   ├── units/
│   ├── buildings/
│   ├── effects/
│   └── ui/
├── scripts/
│   ├── input/
│   ├── commands/
│   ├── units/
│   ├── economy/
│   ├── construction/
│   ├── combat/
│   ├── ai/
│   └── match/
├── data/
│   ├── units/
│   ├── buildings/
│   └── upgrades/
├── tools/
│   └── blender/
└── docs/
```

Keep editable Blender source files alongside the project or in a clearly documented source-assets directory.

**Completion check:** The project opens, runs the test scene, and imports a correctly scaled Blender test object.

## 3. Design the battlefield

Create an approximately **128 × 128 meter** map as an initial sizing assumption.

Include:

- Two opposing starting locations.
- Alloy and energy deposits near each base.
- Two contested expansion areas.
- A central route and two flanking routes.
- Rocks or cliffs that create meaningful obstacles.
- Enough space for small armies to pass and engage.
- Clear camera and navigation boundaries.

Use simple geometry first. Terrain decoration must not obscure units or imply an obstacle where units can walk.

**Completion check:** Units can travel between both bases and reach every intended resource deposit.

## 4. Build the RTS camera and input

**Camera behavior**

- WASD or arrow-key panning.
- Optional screen-edge panning.
- Mouse-wheel zoom with minimum and maximum distances.
- Middle-mouse drag panning.
- Camera bounds.
- A shortcut to focus on the headquarters.
- A shortcut to focus on selected units.

Keep camera rotation fixed initially to simplify navigation and visual readability.

**Input rules**

- UI receives input before the game world.
- A small pointer-movement threshold distinguishes clicking from dragging.
- Placement mode and selection mode have explicit behavior.
- Escape cancels placement or clears the current interaction.

**Completion check:** Camera movement remains predictable at different zoom levels, and interacting with UI never moves units.

## 5. Implement selection and commands

**Selection**

- Click to select one friendly unit or building.
- Drag a box to select friendly units.
- Shift-click or Shift-drag to modify selection.
- Display selection rings and health information.
- Support control groups using Ctrl + number to assign and number to recall.
- Show selected entities in the command panel.

**Commands**

| Input or target | Result |
|---|---|
| Right-click ground | Move |
| Right-click enemy | Attack |
| Worker right-click resource | Gather |
| Worker right-click unfinished building | Construct |
| Worker right-click headquarters while carrying resources | Deliver |
| Attack-move action, then click ground | Move while engaging enemies |
| Stop action | Cancel current orders |
| Shift + order | Add to command queue |

Represent commands as explicit data with a type, destination or target, and queue behavior.

Validate commands both when issued and when executed. A queued command may become invalid before the unit reaches it.

**Completion check:** A mixed selection receives appropriate orders, queues execute in sequence, and destroyed targets do not cause errors.

## 6. Implement movement and unit behavior

Each unit needs:

- Ownership/team information.
- A data definition.
- Health.
- Selection presentation.
- A command queue.
- Navigation and steering.
- An explicit behavior state.
- Animation hooks.

**Initial states**

```text
Idle
Moving
Gathering
Delivering
Constructing
Attacking
Dead
```

**Movement tasks**

- Navigate around terrain.
- Assign separate destination slots to group members.
- Apply local avoidance.
- Detect arrival using a tolerance.
- Detect units that are stuck.
- Retry or safely abandon unreachable orders.
- Update traversability when buildings are placed or destroyed.

Local avoidance alone must not be treated as sufficient for blocking passage through buildings.

**Completion check:** Groups of 20–30 units can cross the map, pass around structures, and settle near a destination without endlessly pushing toward one point.

## 7. Implement the economy

**Resource rules**

- **Alloy:** Used for basic units and buildings.
- **Energy:** Used for advanced units and upgrades.
- Resource deposits contain finite amounts.
- Workers carry limited quantities.
- The headquarters accepts deliveries.

**Worker gathering cycle**

1. Find a reachable interaction position.
2. Move to the deposit.
3. Gather at fixed intervals.
4. Return when carrying capacity is reached.
5. Deposit resources.
6. Resume gathering.

Handle exhausted deposits, destroyed delivery buildings, interrupted orders, and unreachable targets.

**Initial tuning values**

| Property | Starting value |
|---|---:|
| Starting alloy | 400 |
| Starting energy | 100 |
| Starting workers | 4 |
| Worker carrying capacity | 10 |
| Gathering interval | 1 second |
| Amount gathered per interval | 2 |
| Headquarters supply | 15 |
| Supply relay contribution | 10 |
| Maximum population | 100 |

These are prototype values to adjust through playtesting.

**Completion check:** Resource totals change correctly, multiple workers can use a deposit, and depleted deposits cannot produce additional resources.

## 8. Implement construction and production

**Building placement**

- Display a transparent footprint preview.
- Indicate valid and invalid placement.
- Reject overlap with buildings, obstacles, resource deposits, and map boundaries.
- Require suitable terrain and worker access.
- Check costs again when confirming placement.
- Deduct costs once.
- Spawn a construction site and assign the worker.

Start with one active builder per site to keep construction rules simple.

Define cancellation explicitly: for example, refund 75% of the construction cost when the player cancels an unfinished building, and provide no refund when enemies destroy it.

**Production**

- Maintain a queue per production building.
- Charge resources when an item enters the queue.
- Reserve population when a unit enters the queue.
- Release reservations on cancellation or building destruction.
- Refund canceled queued units in full.
- Spawn completed units at an available exit.
- Hold completed units if no exit is available.
- Send spawned units toward the rally point.

**Initial building values**

| Building | Alloy | Energy | Health | Build time | Purpose |
|---|---:|---:|---:|---:|---|
| Headquarters | 400 | 0 | 2,000 | 60 s | Workers and resource delivery |
| Supply relay | 100 | 0 | 400 | 20 s | Adds 10 population capacity |
| Barracks | 150 | 0 | 800 | 30 s | Melee and ranged units |
| Foundry | 200 | 100 | 1,000 | 40 s | Heavy units and weapon upgrade |
| Defensive tower | 125 | 25 | 600 | 25 s | Static defense |

Require a completed barracks before constructing a foundry.

**Completion check:** Construction, cancellation, queues, population accounting, and rally points work without duplicating costs or units.

## 9. Implement combat and progression

**Initial unit values**

| Unit | Alloy / energy | HP | Speed | Damage | Attack interval | Range | Population | Train time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Worker | 50 / 0 | 45 | 4.0 m/s | 3 | 1.0 s | 1.2 m | 1 | 12 s |
| Vanguard | 75 / 0 | 120 | 4.5 m/s | 12 | 0.9 s | 1.5 m | 1 | 15 s |
| Ranger | 100 / 25 | 75 | 4.0 m/s | 10 | 1.0 s | 8 m | 1 | 20 s |
| Breaker | 175 / 75 | 240 | 2.8 m/s | 24 | 1.8 s | 6 m | 3 | 30 s |

**Counter relationships**

- Vanguard closes distance and deals bonus damage to Rangers.
- Ranger deals bonus damage to Breakers.
- Breaker uses a small splash attack against clustered Vanguards.

Keep modifiers in data definitions.

**Combat behavior**

- Acquire valid visible enemies.
- Move into attack range.
- Respect cooldowns.
- Apply damage at a defined attack event.
- Prevent friendly fire initially.
- Handle death and remove dead units from selection, targeting, and population.
- Give attack-move a limited pursuit distance.
- Prevent attacks through blocking terrain.

**Upgrade**

Add one foundry research item: a one-time 10% damage increase for combat units. Apply it consistently to existing and newly produced units.

**Completion check:** Small mixed-army fights reward unit composition, and damage timing remains consistent with animation and effects.

## 10. Build the AI opponent

Use a simple decision system that issues the same commands available to the player.

**AI responsibilities**

- Assign workers between resources.
- Train workers up to a configurable target.
- Build supply before reaching the cap.
- Construct production buildings.
- Produce a mixed army.
- Defend against nearby threats.
- Attack when army strength reaches a threshold.
- Rebuild essential structures when affordable.

Run strategic decisions at a modest interval rather than every frame.

After fog of war is implemented, restrict AI decisions to visible enemies and remembered sightings. Do not give it hidden resource or production advantages by default.

**Completion check:** The AI can develop from its starting base, launch an attack, and threaten an idle player without scripted unit spawns.

## 11. Create Blender assets

First validate the asset pipeline with **one animated unit and one building**. Produce the remaining assets after import conventions are proven.

**Proposed asset budgets**

| Asset | Approximate triangle budget | Required animation |
|---|---:|---|
| Worker | 1,500–3,000 | Idle, move, gather, build, attack, death |
| Vanguard | 2,000–4,000 | Idle, move, attack, death |
| Ranger | 2,000–4,000 | Idle, move, attack, death |
| Breaker | 3,000–6,000 | Idle, move, attack, death |
| Headquarters | 5,000–10,000 | Optional moving machinery |
| Other buildings | 2,000–6,000 each | Optional activity animation |
| Resource deposits | 500–2,000 each | Static |
| Rocks and props | 100–1,000 each | Static |

Budgets are starting targets, not substitutes for profiling.

**Asset workflow**

1. Block out silhouettes.
2. Check readability from the gameplay camera.
3. Model and UV unwrap.
4. Add reusable materials and team-color regions.
5. Rig animated units.
6. Create in-place animations.
7. Export with documented scale and axis settings.
8. Verify materials, orientation, animation names, and bounds in-engine.

Use simple collision proxies and separate navigation footprints. Keep origins consistent: ground-level center for units and footprint center for buildings.

Store Blender scripts in the project so generated assets can be reproduced.

**Completion check:** Every asset imports without manual scale correction and remains distinguishable during combat.

## 12. Add UI, minimap, and fog of war

**HUD**

- Alloy and energy totals.
- Used, reserved, and maximum population.
- Selection details.
- Context-sensitive commands.
- Construction and production progress.
- Upgrade status.
- Clear feedback for invalid actions.

**Minimap**

- Terrain overview.
- Friendly entities.
- Currently visible enemies.
- Camera position.
- Click-to-move camera.
- Right-click movement orders for selected units.

**Fog of war**

Track three states:

- Unexplored.
- Explored but currently unseen.
- Currently visible.

Use a visibility grid and update it at a fixed interval. Visibility must affect targeting and UI information, not just visual shading.

Hide unseen mobile enemies. Previously discovered buildings may appear as last-known markers without revealing changes that occurred out of sight.

**Completion check:** Hidden enemies cannot be selected, targeted, or revealed through minimap icons or health bars.

## 13. Integrate, test, and polish

**Match flow**

```text
Main menu → Start skirmish → Play → Victory or defeat → Restart or menu
```

End the match when either headquarters is destroyed. Define simultaneous destruction as a draw.

**Verification**

- Resource deductions, refunds, and population reservations.
- Command queues with destroyed or unreachable targets.
- Production when building exits are blocked.
- Building placement near narrow passages.
- Unit death during movement, gathering, and combat.
- Fog-of-war information leakage.
- Restart without leftover units or state.

Use targeted automated tests for economy and queue accounting, plus manual playtests for movement, readability, and combat.

**Performance target**

Aim for smooth play with approximately 100 active units on the test machine. Record hardware, resolution, frame time, and the test scenario.

Profile before optimizing. Investigate pathfinding, avoidance, target searches, shadows, and draw calls based on measured cost.

**Polish**

- Command acknowledgment sounds.
- Resource delivery feedback.
- Construction progress visuals.
- Muzzle flashes, impacts, and restrained explosions.
- Clear damage and selection feedback.
- Pause and audio controls.

## 14. Delivery milestones

| Milestone | Deliverable | Exit condition |
|---|---|---|
| 1. Foundation | Graybox map, camera, selection, movement | Groups navigate reliably |
| 2. Economy | Gathering, placement, construction | Player establishes a functioning base |
| 3. Production | Queues, supply, rally points | Player produces an army |
| 4. Complete match | Combat, AI, victory, defeat, restart | A full match is playable |
| 5. Presentation | Blender assets, animation, HUD | Game is visually coherent |
| 6. Information systems | Minimap and fog of war | Visibility rules work correctly |
| 7. Release prototype | Fixes, profiling, desktop build | Exported build passes acceptance checks |

Do not begin broad asset production until the economy and movement work. Do not expand the faction roster until a complete match is enjoyable.

## 15. Engine architecture mapping

| Responsibility | Godot | Unity | Unreal |
|---|---|---|---|
| Reusable entities | Scenes | Prefabs | Actor Blueprints |
| Gameplay logic | GDScript | C# | C++ and Blueprints |
| Unit/building definitions | Resources | ScriptableObjects | Data Assets |
| Event communication | Signals | C# events | Delegates |
| RTS input | Input actions and controller node | Input System and controller components | Enhanced Input and PlayerController |
| Navigation | Navigation agents and regions | Navigation agents and surfaces | Navigation system and AIControllers |
| UI | Control scenes | Canvas UI or UI Toolkit | UMG |

Choose the exact APIs after checking the installed engine version.

**Final deliverables:** editable engine project, Blender source assets and generation scripts, playable Windows build, setup instructions, controls reference, balancing data, test results, and a short list of known limitations.
