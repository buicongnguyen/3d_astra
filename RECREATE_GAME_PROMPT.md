# Reusable prompt: recreate Frontier Command

Copy everything below the separator into a coding agent. Replace the configuration placeholders first. This prompt describes the desired finished product, including the bug fixes learned during development. It asks for feature parity across the two new editions; the existing editions may still differ in features outside harvesting.

---

You are an experienced real-time strategy game developer, gameplay programmer, technical artist and QA engineer. Build a playable original 3D RTS called **Frontier Command** using **Three.js + Blender** and **Godot + Blender**.

I have wanted to make a game inspired by StarCraft II and Age of Empires for a long time. Recreate their broad appeal—building a base, gathering resources, developing technology and controlling armies—with original names, assets, visual identity and setting. Deliver working games, not just a design document, mockup or disconnected code snippets.

## 1. Configuration and working rules

- Workspace: `<ABSOLUTE_PARENT_FOLDER>`.
- GitHub account: `<GITHUB_USERNAME>`.
- Three.js repository: `<THREE_REPO_NAME>`; suggested name `3d_astra`.
- Godot repository: `<GODOT_REPO_NAME>`; suggested name `3d_astra_godot`.
- Primary mobile target: **Android with Chrome**.
- Desktop target: keyboard and mouse in Chrome/Edge, plus a native Godot Windows export.
- Player-facing game language: English.

First inspect the workspace, applicable project instructions, installed Godot and Blender versions, available Blender skills/MCP tools, Node.js, Git, GitHub CLI and existing SSH configuration. Use compatible installed tools, verify export support, and pin the versions you use. Do not claim a tool is installed or a check passed without evidence.

Create two separate Git repositories under the workspace. Put the Three.js web app in a `github-io/` subfolder of its repository. Put the Godot project in the second repository. Preserve existing user work and never overwrite an unrelated repository.

Work in this order:
1. Write the implementation plan and asset/gameplay specifications.
2. Build and verify the Three.js edition first.
3. Build the Godot edition using the same assets, gameplay data and acceptance criteria.
4. Complete three distinct code/logic review passes, document improvements, implement the accepted improvements and verify both editions.
5. Commit, push and deploy both web editions to GitHub Pages using Git SSH.

Proceed with routine reversible implementation choices without repeatedly asking for approval. Ask only for genuinely missing configuration, credentials or consequential choices that cannot be inferred. Do not purchase services or post to social media. Commit/push/deployment of these requested game repositories is authorized after verification.

## 2. Gameplay and architecture

Create a single-player skirmish RTS with:

- An angled overhead 3D camera, mouse/touch selection, formations, queued orders, rally points, camera panning and zoom.
- Two resources: **alloy** and **energy**.
- Workers, resource deposits, base construction, production queues, supply limits, technology upgrades and combat.
- Health, shields, weapon range, attack cadence, line of sight, healing and repair.
- Fog of war with separate visible/explored states for every faction.
- Opponent AI that gathers, constructs, trains, defends, upgrades and launches attacks.
- Victory, defeat, simultaneous-destruction draw and clean restart behavior.

Keep gameplay simulation separate from rendering, UI, input and audio. Use stable entity IDs and data-driven unit, building and map definitions. Establish a canonical rules/data specification and parity tests so the JavaScript and GDScript implementations do not silently drift.

Use a fixed simulation timestep, initially **20 Hz**, independently of display refresh rate. Bound frame catch-up work. Validate commands, costs, ownership, prerequisites and finite coordinates at the simulation boundary. Do not rely on disabled buttons alone to enforce rules.

## 3. Economy and reliable Harvesters

Each faction starts with:

- 450 alloy and 150 energy.
- One Command core and one Barracks.
- Four Harvesters, two Rangers and one Vanguard.
- 15 supply capacity and 7 supply used.

Provide generous but finite deposits and multiple expansion locations. Start with three nearby alloy deposits of 2,000 each and one energy deposit of 1,750 per faction. Expansion deposits can contain 3,000 alloy or 2,250 energy. Avoid overlapping deposits, structures and additional starting bases.

Harvester rules must match in both engines:

- Gather 2 resources every 0.7 seconds, carrying at most 10.
- Deliver cargo to a completed friendly Command core, then resume the assigned deposit.
- Preserve the resource type of carried cargo. If redirected to a different resource, deliver the old cargo before collecting the new type.
- On depletion, deliver any partial load first. Then obey the next queued command if present; otherwise choose the nearest reachable, explored deposit of the same type within 30 world units of the worker's current position.
- Do not automatically switch to unknown, distant or different-type deposits.
- If no replacement exists, give a clear message telling the player to assign another deposit.
- If no completed friendly core exists, preserve cargo and explain that a core must be built or completed before delivery can resume.
- Explicit Move and Stop commands must interrupt gathering immediately. Automatic reassignment must not override queued player commands.
- Reset stale path/stall state when changing between gathering and delivery and while actively working.

Prevent the known “frozen Harvester” bugs:

- Movement arrival must end inside harvesting range. For example, use a target-radius + 0.8 approach point, 0.2 arrival tolerance, and target-radius + 1.4 gathering range.
- Never define “stuck” using a fixed distance travelled per rendered frame. Measure accumulated progress over time or actual path failures.
- Truly blocked orders should time out with a clear message after roughly six seconds of no progress.
- Workers must not duplicate resources, lose carried cargo or silently become idle during ordinary collection.

## 4. Units, defenses and balance

Implement eight unit types. Use these starting balance values in both editions. Costs are alloy/energy; attack is damage per hit. Treat them as a baseline and only retune with documented gameplay evidence.

| Unit | Role | HP / shield | Attack / interval / range | Cost | Supply | Train time | Production requirement |
|---|---|---:|---|---:|---:|---:|---|
| Harvester | Gather and construct | 55 / 10 | 4 / 1s / 1.8 | 50 / 0 | 1 | 8s | Command core |
| Vanguard | Fast close assault | 150 / 60 | 15 / 0.85s / 2 | 75 / 0 | 1 | 10s | Barracks L1 |
| Ranger | Ranged infantry | 85 / 25 | 12 / 1.05s / 9 | 100 / 25 | 1 | 13s | Barracks L1 |
| Breaker | Heavy mechanical splash unit | 300 / 80 | 30 / 1.7s / 7.5 | 175 / 75 | 3 | 20s | Foundry L1 |
| Medic | Heal friendly infantry | 75 / 30 | No weapon; heal 12 HP/s, range 6 | 100 / 50 | 1 | 15s | Barracks L2 |
| Engineer | Repair buildings and vehicles | 100 / 30 | No weapon; repair 18 HP/s, range 6 | 125 / 50 | 1 | 15s | Foundry L2 |
| Battle tank | Durable heavy weapon | 460 / 100 | 48 / 2.2s / 10 | 275 / 125 | 4 | 28s | Foundry L3 |
| Anti-tank soldier | Counter mechanical units | 80 / 20 | 20 / 2.4s / 11 | 125 / 50 | 2 | 17s | Barracks L2 |

Tank speed is 2.5, Harvester 4.6, Vanguard 5, Ranger 4.2, Breaker 2.7 and Anti-tank soldier 3.7 world units/s. Choose and document support-unit speeds consistently in both editions. Tanks use a 1.05 movement radius; navigation must account for their larger footprint.

Combat details:

- Anti-tank soldiers deal 4× damage to mechanical units; they must not receive this bonus against infantry or ordinary buildings.
- Vanguard deals 1.6× damage to Rangers; Ranger deals 1.6× damage to Breakers.
- Breaker splash deals half damage to other enemies within 3 units of the impact.
- Shields absorb damage before health and regenerate at 4/s after five seconds without damage.
- Medics and Engineers cannot attack, heal themselves, revive dead units or restore shields. Engineers repair completed friendly buildings and mechanical vehicles, including tanks; healing does not finish construction.
- Friendly support requires suitable targets, range and clear line of sight. Idle helpers assist nearby allies; explicit Move must still work immediately.

Make tank power justify its resource cost, four supply and technology requirement while leaving practical infantry/anti-tank counters. Avoid an unbeatable tank strategy.

## 5. Buildings, upgrades and understandable requirements

| Building | Functions | HP / shield | Cost | Build time |
|---|---|---:|---:|---:|
| Command core | Resource delivery, Harvester production, technology | 2200 / 150 | 400 / 0 | 40s |
| Barracks | Infantry, Medics, Anti-tank soldiers | 850 / 60 | 150 / 0 | 18s |
| Foundry | Breakers, Engineers, tanks, weapon research | 1100 / 90 | 200 / 100 | 25s |
| Supply relay | Additional supply | 450 / 40 | 100 / 0 | 12s |
| Sentinel tower | Automatic defensive cannon/gun tower | 650 / 50 | 125 / 25 | 15s |

The Sentinel tower deals 19 damage every 1.2 seconds at range 13. It attacks visible enemies with a clear shot. Foundry construction requires completed Barracks.

Support building levels 1–3:

- L2: +25% base HP and +25 shield; L3: +50% base HP and +50 shield total.
- Production speed: 1.2× at L2 and 1.4× at L3.
- Tower damage: +25% base at L2 and +50% at L3.
- Relay supply: 10 at L1, 15 at L2, 20 at L3. Core supply starts at 15. Maximum total supply is 100.
- Core upgrade costs: L2 200/100, L3 350/175. Other buildings: L2 100/50, L3 200/100. Upgrade times: 20s and 30s.
- Other building upgrades require a completed core at the target level. Upgrading and training cannot occupy the same building simultaneously.
- Weapon research costs 150/100, takes 25s, and adds 10% combat-unit damage once.

Production reserves supply immediately, charges once and cannot overdraw resources. Supply loss must hold completed production until capacity is available. Queue cancellation refunds fully; unfinished-building cancellation refunds 75%; destruction gives no refund. Building upgrade cancellation refunds fully.

Selection must be forgiving: clicking roofs, edges and visible silhouettes should reliably select buildings, including at distant zoom and on touchscreens.

Every unit/building needs an information panel or field-guide entry showing its role, functions, cost, requirements, HP, shield, attack, attack interval, range, level and available upgrades. Explain missing prerequisites and exact resource shortages immediately—for example, “Build Barracks first” or “Need 40 more alloy.” Never leave a failed construction click unexplained.

## 6. Combat micro-control, movement and camera

The following command priorities are mandatory in both editions:

- Idle combat units automatically attack visible enemies in weapon range with a clear line of fire.
- Attack-move engages enemies and resumes its route when the engagement ends.
- **Explicit Move overrides combat immediately**, allowing withdrawal and kiting. Units continue toward the requested destination without stopping to fire, then resume idle automatic targeting after arrival.
- A normal Move replaces the current attack and old queue. An appended/queued Move waits its turn.
- Direct Attack prioritizes its valid chosen target.
- Reissuing Move or Attack must never reset weapon cooldowns or allow extra shots.

Use obstacle-aware pathfinding, footprint clearance, swept movement and local separation. Support bridges, fords, building placement and navigation updates when structures appear or disappear. Keep crossings clear of construction.

All camera and movement bounds must derive from the active map size and unit footprint. Test all four corners on the largest maps. Include downward edge scrolling even when a footer covers the canvas edge. Minimap corner taps must reach the intended location instead of activating nearby controls.

## 7. Maps, AI and game progression

Provide seven selectable skirmish maps in both editions:

| Map | Size | Theme |
|---|---:|---|
| Ashen Frontier | 96 × 96 | Open starting battlefield |
| Meridian Riverlands | 96 × 96 | River, bridges and ford |
| Copper Basin | 128 × 128 | Larger mineral basin and expansions |
| Frontier Expanse | 160 × 160 | Large river map with multiple expansion sites |
| Amber Dunes | 128 × 128 | Sand and dry terrain |
| Verdant Crossing | 160 × 160 | Woodland, water and crossings |
| Obsidian Highlands | 192 × 192 | Stone terrain and widely separated resources |

Use grass, dirt, sand, stone, rocks, trees, water and readable shorelines. Decorative terrain must agree with navigation. Do not visually imply traversable water or impassable cliffs contrary to the simulation. Actual elevation can be a later improvement.

The briefing must allow **1, 2 or 3 AI enemies**. Default to **free-for-all**: every faction can attack every other faction. Do not silently ally all AIs against the player. An optional future “allied enemies” mode belongs in the improvement plan unless explicitly requested for implementation.

Each AI needs its own resources, supply, visibility, color, production and decisions. Starting camps must fit in distinct areas, with fair accessible resources. AI must not spend the player's wallet or leak messages into the player's UI.

AI may know public initial deployment locations, but newly constructed hidden cores must be discovered. Remember last-seen cores; do not learn unseen destruction instantly. Scout valid map locations when no core location is known.

When a faction loses all Command cores, remove its remaining forces, production, support and vision. Clear its collision obstacles. Do not award free kill credit or cancellation refunds for surrender cleanup. Remaining factions continue fighting. A surviving completed or unfinished core keeps a faction alive, while only completed cores provide the functions that require completion.

The three technology levels create early, middle and late phases within each match. These maps are skirmishes, not a completed narrative campaign.

## 8. Blender assets, visuals and audio

Use Blender to create original reusable 3D assets for eight unit types and five building types, plus terrain props. Use a relevant Blender skill/MCP integration if available. Otherwise use Blender Python automation and save the source scripts and `.blend` files. Inspect dependencies before deciding Blender is unnecessary; primitive placeholders are acceptable during development, but the final requested asset pipeline must be reproducible.

Design a cohesive stylized science-fiction frontier look: readable silhouettes, visible team-color panels, distinct tank tracks and turrets, recognizable support units, clear building functions, soft lighting and restrained effects. Do not copy StarCraft or Age of Empires artwork, logos, names, sounds or story.

Document per-asset triangle budgets, materials, texture sizes, pivots, scale, collision footprints and animation requirements. Initial mobile-conscious targets: roughly 1–3k triangles for infantry, 3–6k for heavy vehicles and 2–8k for buildings, adjusted based on profiling. Share materials/atlases where practical.

Export GLB assets usable by both Three.js and Godot. Validate axis conversion, real scale, centered pivots, ground contact, normals, team-color materials and animation playback. Provide idle, movement and attack/work animations where appropriate. Use lightweight muzzle flashes, projectile trails, impacts, selection rings and health/shield bars.

Settings must allow army color selection and clearly distinguish all factions. Persist graphics quality, volume and color preferences locally. Include High and Eco rendering modes; default touch devices to Eco. Cap resolution appropriately, reduce shadows/effects on mobile, reuse geometry/materials and dispose replaced map resources.

Audio must respect browser gesture requirements, volume and mute controls. Do not let missing optional audio block gameplay.

## 9. Desktop and Android controls/UI

Desktop:

- Click selection and drag-box selection.
- Right-click context orders: move, gather, attack, build assistance or deliver.
- Shift to queue, control groups, Attack-move, Stop, Home, pause and camera shortcuts.
- Wheel zoom, WASD/arrow panning and edge scrolling.

Mobile:

- Visible Workers, Army, Box, Queue, Move, Attack-move, Stop, Home and zoom controls.
- Tap selection, tap destinations/targets, drag panning and pinch zoom.
- Distinguish taps from drags and cancel interrupted gestures safely.
- Touch-friendly construction preview, explicit placement confirmation and visible prerequisite feedback.
- Queue mode must be obvious; explain that immediate withdrawal requires Queue off.

Keep status and selection panels compact so they do not cover the battle. Use collapsible/tabbed Selection, Actions and Map panels on phones; allow internal scrolling and keep essential controls reachable. Handle portrait, landscape, browser viewport changes and safe-area insets.

Check at least 320×568, 390×844, 667×375, 844×390 and tablet layouts. Target 60 FPS desktop and a stable 30 FPS or better on representative Android hardware at Eco, with documented unit counts and device details. Browser emulation on a powerful PC does not prove real-phone performance: report it honestly if physical-device testing is unavailable.

## 10. Reviews, tests and improvement loop

Complete three substantive review passes, fixing findings and rerunning affected checks:

1. **Code review:** module boundaries, lifecycle cleanup, stale references, invalid input, asset loading, render resource disposal and exported builds.
2. **Logic review:** economy conservation, costs/refunds, supply, queues, harvesting, upgrades, healing, combat cooldowns, command priority, faction elimination, AI fog-of-war knowledge and pathfinding.
3. **Gameplay/UI review:** discoverability, building selection, mobile buttons, compact HUD, terrain readability, tank/anti-tank usefulness, resource availability, pacing and parity between engines.

Write `GAME_REVIEW.md` with confirmed issues, fixes, validation and remaining limitations. Write `IMPROVEMENT_PLAN.md`, prioritize concrete improvements that fit this scope, implement them, and record completion. Separate future art, story, campaign and multiplayer work from features actually delivered. Do not claim every possible bug has been eliminated.

Regression coverage must include:

- Every map/enemy-count combination, starting access, map switching and all four corners.
- All workers sharing a deposit for five simulated minutes, with each worker continuing to deliver.
- Movement/harvesting at 30, 60, 144 and 240 FPS-equivalent timings.
- Depletion, partial cargo, same-type reassignment, exploration limits, missing cores and queued commands.
- Withdrawal from idle auto-combat, direct Attack and Attack-move for every combat type; no cooldown exploit.
- Construction prerequisites, insufficient resources, upgrades, canceled queues, supply loss and restart cleanup.
- Real desktop and touch input against built web exports, not just direct simulation calls.

Use shared scenario descriptions/fixtures where possible to compare outcomes across engines. Keep test hooks gated to an explicit test mode. Record failures, reproduce them, fix the root cause and add focused regressions.

## 11. Documentation and future multiplayer

Deliver Markdown documents for:

- `RTS_GAME_PLAN.md`: milestones, mechanics, architecture and acceptance criteria.
- `GODOT_BLENDER_PLAN.md`: native scenes/scripts, Blender workflow and export steps.
- `ASSET_PIPELINE.md`: reproducible asset generation and budgets.
- `GAME_REVIEW.md` and `IMPROVEMENT_PLAN.md`.
- `ENGINE_PARITY.md`: common gameplay contract, checks and any remaining differences.
- `INTERNET_MULTIPLAYER_PLAN.md`: planning only; do not implement online multiplayer yet.
- `README.md` in each repository with install, run, test, export and deployment instructions.

The multiplayer plan should explain that GitHub Pages serves the static client while real-time matches require a separately hosted backend. Propose authoritative server simulation, WebSocket/WSS transport, rooms/invite codes, validation, fog-filtered state, reconnects, latency handling, rate limits, hosting/cost choices and a later Godot-compatible protocol. Start with private 1v1 before expanding to more players. Do not claim the single-player Pages build already supports internet multiplayer.

Art and story need further investment to attract players. Provide an original short setting for Frontier Command and a practical future plan for faction identity, visual polish, mission narratives, sound and campaign progression. Keep these ambitions distinct from the delivered skirmish prototype.

## 12. GitHub delivery and shareable screenshots

Use Git SSH with repository-specific remotes such as `git@github.com:<GITHUB_USERNAME>:<REPO_NAME>.git`. Reuse existing SSH setup where appropriate without exposing private keys or changing unrelated repositories. Never force-push or discard user changes.

Create CI that runs the relevant logic, asset and browser checks, then exports and deploys GitHub Pages only on success. Ensure Three.js assets work under the repository subpath. Choose a Godot web export compatible with Pages hosting; avoid requiring unsupported headers or backend services. Also produce a native Windows Godot build artifact.

After push, verify CI completion and test the public URLs:

- `https://<GITHUB_USERNAME>.github.io/<THREE_REPO_NAME>/`
- `https://<GITHUB_USERNAME>.github.io/<GODOT_REPO_NAME>/`

Do not say “deployed” merely because a push succeeded. Report the commit, deployment result and public checks. If a real external blocker remains, explain exactly what is blocked while completing independent work.

Finally, run an actual in-game battle with tanks, infantry and support units. Capture at least two high-resolution screenshots suitable for sharing: one clean battlefield view and one with normal controls. A staged skirmish is acceptable; label it as such and use genuine engine gameplay rather than AI-generated promotional artwork. Visually inspect the screenshots before delivery. Provide the image files and clean public game links, without test query parameters. Do not post to Facebook yourself.

Begin by inspecting the environment and writing the plan, then execute it through working, tested and deployed games. Keep progress updates concise and conclude with the playable links, files, verification results and meaningful remaining limitations.
