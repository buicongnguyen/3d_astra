# Frontier Command — RTS Game Plan v2

**Purpose:** A reusable specification for rebuilding a better 3D real-time strategy game, incorporating the requirements, bugs and fixes discovered while developing Frontier Command.

**Prepared:** 2026-09-11. **Reference implementation:** Three.js commit `93329726cf462596b748c0be96049ec8c3a6eae0` and the Godot edition developed during this project.

This is a new version of [RTS_GAME_PLAN.md](RTS_GAME_PLAN.md). The original remains historical context. Use this document as the primary specification for a future rebuild. Requirements below describe the intended result; they are not a claim that every proposed improvement already exists in either edition.

## 1. Product brief

Create an original, stylized science-fiction RTS inspired by the economy and expansion of Age of Empires and the responsive army control of StarCraft II. Prioritize reliable commands, readable battles and a complete match before expanding art or content.

The player scouts, gathers alloy and energy, constructs a base, trains a mixed army, upgrades buildings, contests expansion deposits and eliminates rival factions. Micro control must matter: players can retreat wounded units, focus fire, patrol routes and use healers and repair units.

### Delivery targets

| Track | Technology | Intended delivery |
|---|---|---|
| Browser first | Three.js, a separate JavaScript simulation, Blender assets | Static GitHub Pages game; desktop and Android Chrome |
| Godot edition | Godot, GDScript, the same asset and gameplay definitions | Native desktop build and a separately verified browser export |
| Later online play | Authoritative server plus client adapters | Private internet matches, followed by optional cross-engine clients |

For a fresh project, finish a playable browser slice before porting it. If the task requests Godot first, reverse the implementation order while retaining the same rules. Each edition must work independently. Blender creates assets; it is not needed on players' devices.

### Target scope

- One original faction design usable by every participant, with distinguishable army colors.
- Single-player skirmish against **1, 2 or 3 AI enemies**; free-for-all by default.
- Eight unit types, five building types, building levels 1–3 and one initial weapon research item.
- Seven maps with different sizes, terrain and expansion opportunities.
- Complete opening menu, settings, play, pause, victory/defeat/draw and restart flows.
- Desktop keyboard/mouse controls and fully playable touch controls.
- Target a satisfying 10–20 minute match; tune this through playtesting rather than treating it as a guaranteed duration.
- Defer multiplayer implementation, flying/naval units, elaborate campaigns and additional factions until the core game is reliable.

**Success means:** a new player can start a match, understand available actions, gather continuously, build an army, withdraw during combat and finish a match without a hidden control or a stuck economy.

## 2. Architecture that prevents recurring bugs

Separate rules from input and rendering. DOM elements, Godot controls, animations and effects must never be the authoritative source of money, health, damage, progress or ownership.

```text
Desktop / touch input
         |
         v
Command submission -> validation -> fixed-step simulation
                                      |
                                      v
                            state + gameplay events
                               /             \
                         HUD / camera     models / effects
```

### Suggested project boundaries

```text
game-spec/          versioned balance, maps, command schema, scenario fixtures
asset-source/      .blend sources and reproducible Blender generation scripts
assets/            optimized GLB models, textures, audio and UI assets
simulation/        economy, orders, navigation, combat, AI and match lifecycle
client/            input adapters, camera, HUD, rendering and audio
tests/             rule tests, interaction regressions and engine-parity fixtures
docs/              controls, setup, known limitations and release instructions
```

In two repositories, distribute the shared specification/assets as a versioned package or a scripted copy with checksums. Record the specification version in both builds. Do not assume two manually edited copies will stay equivalent.

### Required rules

1. Use a fixed simulation step, initially **20 Hz / 0.05 seconds**. Interpolate presentation independently. Bound catch-up work after a long pause; measure FPS using actual wall time.
2. Give entities and production jobs stable IDs. Include a match/session generation so an old callback cannot operate on a restarted match that reused an ID.
3. Store commands explicitly: command type, owning participant, entity IDs, target/destination and append/replace behavior. Bound queues and reject nonfinite coordinates, invalid target kinds and unauthorized ownership.
4. Validate at submission and again when executing. Targets, money, supply, terrain and prerequisites may change between those moments.
5. Record the cost paid on each job/site. Charge once and refund from that record. Catalog changes must not alter an existing match's accounting.
6. Use simulation events for work, shots, damage and death. Rendering consumes events; drawing a projectile or an explosion must not apply damage again.
7. Distinguish a persistent player order from a temporary automatic combat target. Automatic targeting cannot silently replace an explicit withdrawal.
8. Rebuild navigation and visibility when required by world changes. Clear selection and stale references when entities disappear.
9. Reject gameplay mutations after a terminal result. Pause prevents simulation advancement and gameplay purchases/cancellation.
10. Use the same command path for UI buttons, hotkeys, touch and AI. Test-only hooks are explicit opt-in diagnostics, not production authorization boundaries.

## 3. Content and progression

Use the [balance catalog](github-io/src/balance.json) as a versioned starting reference. The prices below capture the current starting point; they are tuning inputs, not evidence of perfect balance.

### Unit roster: eight types

| Unit | Role | Alloy / energy | Population | Unlock |
|---|---|---:|---:|---|
| Harvester | Gather, deliver, construct; weak explicit attack | 50 / 0 | 1 | Command core L1 |
| Vanguard | Front-line melee | 75 / 0 | 1 | Barracks L1 |
| Ranger | Mobile ranged damage | 100 / 25 | 1 | Barracks L1 |
| Breaker | Heavy assault; maintain a distinct role from the tank | 175 / 75 | 3 | Foundry L1 |
| Medic | Restore friendly nonmechanical infantry health | 100 / 50 | 1 | Barracks L2 |
| Engineer | Repair friendly mechanical units and completed buildings | 125 / 50 | 1 | Foundry L2 |
| Anti-tank soldier | Cost-effective specialist against vehicles | 125 / 50 | 2 | Barracks L2 |
| Battle tank | Expensive, slow heavy fire support | 275 / 125 | 4 | Foundry L3 |

Every definition includes health, shield capacity, armor if used, speed, radius, attack damage, cooldown, range, population, cost, training time, target categories and prerequisites. Support units also define restoration amount and interval. Display restoration per second as amount divided by interval.

### Building roster: five types

| Building | Purpose | Initial cost | Upgrade purpose |
|---|---|---:|---|
| Command core | Train Harvesters, receive cargo, establish technology level | 400 / 0 | Unlock higher production-building levels; improve durability |
| Supply relay | Increase population capacity | 100 / 0 | Increase capacity and durability |
| Barracks | Train Vanguard, Ranger, Medic and Anti-tank soldier | 150 / 0 | Unlock support and specialist infantry |
| Foundry | Train Breaker, Engineer and Battle tank; research weapons | 200 / 100 | Unlock repair units and tanks |
| Sentinel tower | Static cannon/turret defense | 125 / 25 | Improve durability and damage |

- Require a completed Barracks before building a Foundry.
- A non-core building can upgrade only when a completed Command core provides the required technology level.
- Levels stop at 3. Upgrading and training are mutually exclusive in the same building.
- Keep the Upgrade button in the same slot while busy; disable it and use the work strip for cancellation.
- The initial weapon research grants a one-time 10% combat-unit damage improvement. Define exclusions, prevent duplicate research and apply it to existing and future eligible units exactly once.
- **Info & stats** explains each building's purpose, unlocks, costs and prerequisites. Keep this detail out of the always-visible HUD.

### Balance process

Give the tank useful durability and firepower, but meaningful costs: money, energy, population, training time, technology and mobility. Anti-tank infantry must be available before tanks become dominant. Infantry and flanking should punish unsupported specialist units.

Compare equal-cost and equal-population armies, not only one tank against one soldier. Record damage per second, time to kill, travel time, losses, cost remaining and repair/healing impact. Test tanks against buildings, spread infantry, clustered infantry and anti-tank groups, with and without support. Keep cooldowns unchanged when moving or retargeting so micro cannot generate free shots.

## 4. Camera, selection and command priority

### Selection and camera

- Select units and buildings with a forgiving, intentional hit area. Combine mesh picking with simple selection proxies; roofs and narrow decorative meshes must not make buildings difficult to select.
- Support click, drag-box, Shift selection, same-type selection and control groups. Box selection targets friendly units by default.
- UI interactions never issue orders through a panel into the world.
- Camera panning uses keyboard, mouse drag, optional edge scrolling, touch drag and minimap input. Zoom uses wheel, buttons and pinch.
- Calculate camera bounds from the **active map and visible game viewport**, including dock size and zoom. Do not reuse a fixed 96-unit-map boundary on larger maps.
- Minimap coordinates, fog resolution, collision bounds, picking and resource placement all derive from the same map definition.
- Verify all four map corners at near and far zoom, before/after rotation or viewport resize, using mouse edges and minimap taps. Test edges covered by a footer as well.

### Order contract

| Order | Required behavior |
|---|---|
| Move / withdraw | Immediately replace prior orders unless explicitly queued; suppress automatic attacks until arrival or interruption by a new player command |
| Attack chosen enemy | Validate ownership, visibility, target type and life; attack the chosen target without resetting cooldown |
| Attack-move | Advance and engage valid nearby enemies; resume the route after combat; limit pursuit |
| Patrol | Repeat between endpoints; engage nearby enemies and return to the patrol route; available to combat soldiers and tanks |
| Stop | Clear orders, routes and transient targets; no leftover harvesting effect; define normal idle acquisition separately |
| Gather / deliver / construct | Follow the worker rules below; do not turn a worker's harvesting assignment into unwanted automatic combat |
| Support | Follow and heal/repair an eligible ally; show why an invalid target is unsuitable and keep the targeting mode pending |
| Rally | Set the destination for future units from completed production buildings |

Priority is **terminal/pause rules → new explicit player command → current order → permitted automatic behavior**. Idle combat units and attack-moving/patrolling units acquire valid enemies in range. A normal Move remains a reliable retreat even when an enemy is already firing. Queued Move waits its turn; explain Shift/Queue behavior so players know how to withdraw immediately.

For invalid Attack or Support clicks, return an explicit rejected result. Input handlers clear the pending mode only after success or explicit Escape/Cancel. A missing return value must not accidentally count as success.

## 5. Desktop and touch input

Generate visible shortcuts, help text and bindings from one command definition. Use a collision rule for context keys: a selected building's production tile can use R, while a selected Medic uses R for Support. Keep key/button order deterministic.

| Action | Starting keyboard scheme |
|---|---|
| Build menu | B |
| Context build/train tiles | Q, E, R, T, Y in displayed order |
| Move / Attack-move / Patrol / explicit Attack | M / F / P / N |
| Stop / context gather-assist / return cargo | X / C / V |
| Support / rally / building upgrade | R / L / U |
| Cancel last queued job or unfinished site | Backspace; selected target and refund must be unambiguous |
| Next idle worker / army / workers / buildings | F1 or period / F2 / F3 / F4 |
| Cycle Command cores / Barracks / Foundries | H / J / K |
| Assign / add to / recall group | Ctrl+1–9 / Shift+1–9 / 1–9 |
| Queue order / toggle queue mode | Shift + command / O |
| Focus selection / info / pause | Home / I / Space |
| Pan / zoom / cancel pending mode | WASD or arrows / wheel or + and − / Escape |

Retain [the full controls reference](github-io/docs/PC_SHORTCUTS.md) as a reference, but generate the future game's help from its own binding catalog.

### Input correctness

- Respect text inputs, selects, composition, settings dialogs and unrelated browser/system shortcuts.
- Before a match, **Enter and Space activate focused native buttons**, including Start and Settings. Global pause handling must not swallow those events.
- During play, apply the documented game shortcuts deliberately. Repeated keydown must not buy multiple units or repeatedly cancel jobs.
- Clear held keys, pointer capture, drag state and pending gesture state on blur, pause, pointer cancellation and visibility changes.
- Distinguish taps from drags; a completed pinch must not become an accidental command tap.
- Detect the primary pointer and actual interaction rather than assuming every touch-capable Windows laptop is a phone.
- Touch players need visible selection, Move, Attack, Patrol, Support, Stop, build, cancel, queue, camera and zoom controls. Do not require hover, right-click or keyboard to complete a match.
- Touch placement is choose site → visible validity feedback → **Build here**. Revalidate before paying.

## 6. Economy and Harvester reliability

Begin with four Harvesters, a Command core, a Barracks and three defenders, with **450 alloy and 150 energy per faction** as a baseline. Use finite, generous starting deposits and additional contested sites so expansion is worthwhile. Tune resource quantities separately from gathering speed.

### Worker state machine

```text
Assigned deposit -> Travel to working position -> Gather
                          ^                       |
                          |                       v
                     Resume deposit <- Deliver <- Travel to completed core

Interruptions: explicit Move/Attack/Build/Stop, depleted resource,
destroyed core, blocked route, dead worker, eliminated faction.
```

- A worker's navigation arrival tolerance must place it **inside** the actual gathering/building interaction range. Do not allow movement to report success just outside the work radius.
- Check real work conditions before advancing gather time or playing mining effects. A gather order alone is not evidence that mining is happening.
- Measure stuck movement over a time window using accumulated displacement. A fixed per-render-frame threshold can falsely classify healthy movement at 144/240 FPS as stuck.
- Reset stale paths, arrival samples and work timers at appropriate state transitions. Retry with another reachable interaction position before abandoning an order.
- Preserve cargo when reassigned or interrupted. Never mix resource types in a partial load or silently discard resources.
- Define cargo on death explicitly: initially it is lost, and accounting treats that loss as a resource sink rather than an unexplained discrepancy.
- When a deposit empties, deliver the partial load. Then honor explicit queued commands before automatically finding another reachable, explored deposit of the same type within a documented search radius.
- If no completed delivery core exists, retain the cargo and show a concise reason. Retry/recover when a suitable core becomes available.
- Multiple workers must be able to use a deposit without permanently reserving the same approach point.
- Construction ownership belongs to an active builder in working range. A nearby eligible Harvester can take over when the previous builder leaves or dies.

**Acceptance:** on every map and faction slot, several workers gather for at least five simulated minutes without unexplained idle freezes. Check 30/60/144/240 FPS presentation, partial loads, depleted deposits, destroyed/rebuilt cores, contested paths and explicit interruption. Resource conservation must account for remaining deposits, carried cargo, banked resources, spending/refunds and explicitly defined losses.

## 7. Construction, queues and cancellation

### Construction transaction

Validate prerequisite buildings, required level, resources, exploration, surface type, map bounds, collision footprint and worker access. Check again at confirmation, deduct once, create one site and assign a valid builder. A preview never spends money.

Errors say what to do: **Need 100 energy**, **Finish Barracks**, **Upgrade Command core to L2**, **Needs Harvester**, **Awaiting supply**, or **Exit blocked**. Keep unmet requirements visible where the action is attempted. Refresh them when the world changes so a resolved shortage does not leave a disabled retry button.

### Production accounting

- Limit each building to five queued jobs initially.
- Charge money and reserve population when accepting a job.
- At completion, recheck current supply and a valid exit. Losing a relay can block a completed unit; it must not spawn over the new cap.
- Hold blocked work without charging again or losing completion progress. Resume once the blocker clears.
- Research does not consume population and must not be blocked solely by an army being over supply.
- Spawn a completed unit once and release its reservation once. Obstructed exits must never produce duplicate units on retry.
- Destroying a production building releases reservations and discards its jobs without cancellation refunds.

| Event | Refund rule |
|---|---|
| Player cancels unfinished building | 75% of its recorded paid cost |
| Player cancels queued unit or research | 100% of its recorded paid cost |
| Player cancels building-level upgrade | 100% of its recorded paid cost |
| Enemy destroys a site/building, or faction is eliminated | No refund |
| Repeat cancellation, stale callback, completed job, or ended match | No new mutation or refund |

Cancel by stable job identity, not only queue index. A tap held across HUD refreshes must still refer to the same job. If the first job finishes, a stale callback cannot cancel its replacement. Reject callbacks captured from a different match or destroyed/replaced entity.

## 8. Compact, stable HUD

The battlefield is the main view. Descriptions belong in Info & stats; routine work does not need large paragraphs.

### Opening screen

- Use **Start**, centered in the viewport on desktop, portrait phones and landscape phones.
- Put the briefing above it and map/enemy/settings controls below it, with controlled scrolling on short screens.
- Disable Start while essential assets load; show a useful loading/failure state.
- Hide gameplay tips during the briefing. Allow keyboard activation and ensure overlays cannot intercept the Start target.

### Selected-object panel

- One heading and level indicator; compact, aligned HP, Shield, ATK and optional Restore columns.
- Keep numbers on one line. Abbreviate large totals and expose exact values in accessible details.
- Label group summaries accurately. If ATK shows the first unit, say so; do not imply it is total army damage.
- Reserve a short activity/warning line and a separate work row for selected buildings, including when idle.
- Keep roster scrolling separate from the work row and action controls.

### Work strip

- Each job uses a small recognizable icon/glyph and **ten green progress squares**.
- Place a small **red × strip** below the icon to cancel that job.
- Keep the touch target at least **44 × 44 CSS pixels or logical UI units**, even though the visible cancel strip is smaller.
- Show concise blocked-state feedback, with amber/status cues where useful. Color is reinforced by icons and text details.
- Put names, exact progress, cancellation action and refund information in tooltips, accessible labels and touch-accessible details.
- Keep all five jobs in one row at the supported minimum viewport. Do not wrap the queue into commands or let it disappear behind another row.
- Reserve enough space for buildings with two rows of production commands, such as the Barracks and Foundry.
- Starting, finishing or cancelling work must not reorder, replace or move command buttons. Preserve a pressed button through refreshes. Disabled styles must keep the same dimensions and padding.
- Keep building Upgrade in its normal slot while busy; the red work control performs cancellation. Use stable explicit pages in Godot if the full action list cannot fit.

### Cheap activity feedback

- Put a thin segmented progress strip above busy buildings for construction, training and upgrades; remove it when work ends.
- Mark the selected Harvester's assigned deposit with a selection ring, including while it returns cargo. Clear/update it after Stop, reassignment or depletion.
- Use a small tool light/beam or slight motion only during actual mining. Show cargo/progress and distinguish travelling, gathering, delivering and waiting.
- Use brief shield/hit rings and small death bursts for soldiers, tanks and buildings. Avoid adding a light, shadow or particle system per effect.
- Pool/cap effects, throttle repeated building hits, respect pause/fog and offer reduced motion. Initial reference budgets are 32 transient hit/death effects and a 0.2-second per-building hit-feedback interval.

## 9. Maps, terrain and larger stages

Keep terrain, dimensions, starting slots and expansion sites in data. Reference catalog: [maps.json](github-io/src/maps.json).

| Map | Size in world units | Character |
|---|---:|---|
| Ashen Frontier | 96 × 96 | Clear introductory battlefield |
| Meridian Riverlands | 96 × 96 | River crossings and flanking routes |
| Copper Basin | 128 × 128 | More room and contested resource sites |
| Frontier Expanse | 160 × 160 | Larger river map and multiple expansions |
| Amber Dunes | 128 × 128 | Sand/desert palette |
| Verdant Crossing | 160 × 160 | Woodland palette and crossings |
| Obsidian Highlands | 192 × 192 | Largest stage, stone/highland palette |

Use grass, dirt, sand, roads, stone, mud, water, bridges and fords with clear visual meaning. Decoration should not imply blocked terrain when movement is allowed, or suggest a crossing where none exists.

### Navigation requirements

- Maintain a map-owned traversability grid or equivalent engine navigation representation.
- Use the full unit footprint for tanks/heavy units on bridges and narrow paths, including local separation corrections.
- Do not let avoidance push units through water, cliffs or buildings. Revalidate movement segments against obstacles.
- Invalidate routes when a building appears/disappears. Preserve water restrictions after a navigation rebuild.
- An ignored entity ID is only ignored when explicitly provided; missing IDs must not accidentally exclude all terrain obstacles.
- Separate projectile obstruction from walking restrictions: a declared water crossing rule does not automatically make water block bullets.
- Resolve unreachable destinations to a valid nearby reachable location or return a clear failure. Do not loop forever.
- For 2–3 AI enemies, validate all added starting camps and resource placements. Remove overlaps fairly and preserve viable income for every faction.

Larger maps need meaningful expansion incentives and discoverable routes, not only more empty ground. Optional future stage objectives can add escort, hold-a-crossing or expansion-defense missions after skirmish rules work. Campaign art/story is a separate content milestone.

## 10. Fair AI, fog and match lifecycle

### Free-for-all behavior

Every faction can attack every other faction in FFA. Two or three AI enemies must not automatically act as an alliance against the human. Choose threats/targets using visibility, distance, remembered enemy positions and strategic value. Label an optional team/co-op mode separately if added later.

AI uses normal gathering, spending, prerequisites, queues, navigation and combat. Difficulty can change decision quality, timing or explicitly disclosed modifiers. Hidden money or scripted armies are not the default.

### Visibility contract

- Maintain unexplored, explored-but-unseen and currently visible states per faction.
- Hide unseen mobile enemies from picking, targeting, minimap, health bars and effects.
- Last-known buildings retain only last-seen information. Do not reveal hidden damage, upgrades or destruction by refreshing the marker from live state.
- Starting camps may be public if the rules say so. New enemy cores require scouting; AI must not scan the full hidden entity list to find them.
- Scout reachable unknown locations when no known target remains. Public faction elimination can clear remembered targets.

### Elimination and restart

- A faction is eliminated when it has no surviving Command core. Explicitly retain the existing rule that an unfinished surviving core keeps a faction alive.
- On elimination, remove its units/buildings and stop its production, upgrades, construction, support, combat and vision. Clear navigation and selection references; give no artificial refunds or extra kill credit for cleanup.
- Win only after every opponent is eliminated. Resolve simultaneous final-core destruction as a draw.
- AI with only an unfinished core must have a valid fallback planning position; it cannot train or upgrade from that site until complete.
- After a terminal result, prevent new commands, purchases and refunds.
- Restart preserves chosen map, enemy count and preferences while resetting entities, job queues, resources, vision, AI memory, selection, commands, input state, effects and camera focus. Issue a new match/session generation; reused entity/job IDs must never revive old callbacks.

## 11. Blender pipeline and visual quality

Inspect installed Blender/engine versions and available integrations first. If a Blender MCP/skill is available and appropriate, use it to generate or edit assets. Otherwise use reproducible Blender scripts. Do not claim an integration was used without actually using it.

Prove the pipeline with one unit and one building before generating the complete roster.

- One world unit is one meter. Document engine axis conversion, forward direction and export settings.
- Ground-centered origins, consistent footprints and simple separate collision/selection proxies.
- Original silhouettes: distinguish Harvester, infantry, support, anti-tank and tank at normal play zoom.
- Shared materials/atlases and named team-color regions; never tint every surface until factions become unreadable.
- In-place idle/move/work/attack/death animation hooks. Root motion must not independently move a simulated unit.
- Store editable `.blend` sources, scripts, exported GLB files and a small asset manifest.
- Start around 1,500–4,000 triangles for ordinary units, 3,000–6,000 for heavy units, 2,000–10,000 for buildings and simpler terrain props. Adjust after profiling draw calls, memory and actual screen coverage.
- Validate orientation, scale, material slots, animation names, bounds and import results in both renderers.

For better realism, improve terrain transitions, water/shore readability, coherent lighting, scale and environmental detail first. Keep gameplay silhouettes and team colors legible. Avoid expensive water reflection, dense grass or dynamic shadows on every unit as defaults for phones.

Add a short setting, faction motivation and a brief opening objective so the player understands why the battle matters. Expand story through a small polished mission before committing to a full campaign.

## 12. Performance and engine parity

### Performance targets to measure

- Aim for 60 FPS on the chosen desktop and at least 30 FPS in Eco mode on the chosen physical Android phone, with a representative large battle. These are targets, not existing certification.
- Start profiling around 100 units total; separately test the actual supported worst case with four factions and their population caps. A per-faction cap of 100 can mean up to 400 units, not a 100-unit global workload.
- Record device, browser/engine version, map, total units, resolution, quality preset, median/p95 frame time, memory and draw calls.
- Software-rendered CI timings test functionality; they do not represent physical-phone FPS.
- Test a sustained match for thermal slowdown, tab backgrounding, orientation changes and memory growth after repeated restarts.

Use Eco settings with a restrained pixel ratio, simple/contact shadows, capped effects and fewer decorative details. Cache reusable geometry/materials and use instancing or pooling where measured cost justifies it. Add spatial indexing for target/neighbor searches before scaling repeated all-pairs scans. Strategy and fog updates need not run at render frequency.

### Godot / Three.js parity contract

Same catalog version, costs, prerequisites, refunds, supply reservations, movement priority, harvesting rules, damage/cooldowns, FFA elimination and map dimensions. Native UI trees and rendering implementations can differ.

Create scenario fixtures containing map, participants, initial state, ordered commands and expected outcomes. Run them against each engine's simulation with documented numerical tolerances. Compare money, cargo, queues, spawn counts, health, target eligibility and match results; do not assume JavaScript and GDScript produce bit-identical floating-point trajectories.

Test the exported Godot build as well as editor/native execution. Verify the chosen renderer/export options in the installed Godot version and target browser. A successful Three.js web release does not establish Godot web compatibility.

## 13. Regression catalog from this project

These cases are requirements for the rebuilt game. Use targeted scenarios instead of repeatedly running unrelated checks during every small edit.

| ID | Failure experienced or boundary discovered | Acceptance case |
|---|---|---|
| R01 | Buildings difficult to select | Click roof, edge and proxy on desktop; tap on a phone; intended building is selected without an oversized invisible area stealing neighbors |
| R02 | Missing prerequisites/resources unclear | Attempt a Foundry before its prerequisite, spend resources after preview, lose a builder; show the current missing requirement and recover after it is resolved |
| R03 | Large-map corners unreachable by camera | Reach four corners on every map at multiple zooms through edge pan, keyboard and minimap, with HUD visible |
| R04 | Auto-attack prevented withdrawal | Move every combat type out of an active fight; it leaves immediately, keeps cooldown and resumes idle acquisition only afterward |
| R05 | Harvesters froze near deposits | Run multiple workers for five simulated minutes across map/slot combinations and presentation rates; interaction tolerances permit real work |
| R06 | Partial cargo lost or workers abandoned recovery | Deplete a deposit, destroy/rebuild a core and queue a new order; conserve cargo and respect player priorities |
| R07 | Original builder kept a stale construction lock | Move/kill it; a nearby assigned worker takes over without restarting payment/progress |
| R08 | Queue wrapped or hid command rows | Fill all five slots on a narrow phone, Barracks and Foundry; every job and supported action remains reachable |
| R09 | Busy/disabled buttons moved or shrank | Compare button order and bounds across idle, training, upgrade, cancellation and completion; maintain pointer target identity |
| R10 | Stale cancel could act on a replacement | Hold/tap during a refresh, finish the first job, destroy the building and restart the match; refund only the originally valid job once |
| R11 | Losing supply allowed excess completed units | Destroy a relay during training; retain completed work, show Awaiting supply and spawn once after capacity returns |
| R12 | Navigation ignored rocks or new obstacles | Test explicit ignored IDs, changed routes, swept movement and heavy-unit separation near bridges/buildings |
| R13 | AI used hidden enemy-core information | Build/destroy a core out of sight; targeting memory changes only after observation or public elimination |
| R14 | Eliminated factions kept fighting/producing | Destroy the last core with queues and active orders; clear the faction consistently; test an unfinished surviving core and a draw |
| R15 | Static workers looked inactive while harvesting | Show a deposit ring and small mining cue only during actual work; stop it on travel, Stop, full cargo or depletion |
| R16 | Mobile controls obscured or input leaked through | Raw tap/hit-test critical buttons; test portrait, landscape, safe areas, pinch cancellation and modal focus |
| R17 | Space did not activate Start/Settings | Focus each opening-menu button and press Space/Enter; start/open settings normally; retain gameplay pause behavior afterward |
| R18 | Invalid Support click cleared the command | Select Medic/Engineer, click self or an unsuitable target, then a valid ally without re-entering Support; apply valid restoration |
| R19 | Tests still expected removed text | Rename Deploy to Start or replace verbose work text; update affected accessible-name/behavior assertions in the same change |
| R20 | Serial checks and superseded releases delayed publishing | Run independent existing suites in parallel, retain failure diagnostics, gate publication on all groups and verify the deployed commit |

Suggested browser layouts: 1280×800, 1024×768, 320×568, 390×844, 667×375, 844×390 and 768×1024. Include high-density touch emulation and a physical Android Chrome pass. Raw hit tests matter: a test framework's automatic scrolling can hide a real off-screen-button defect.

## 14. Implementation milestones

| Phase | Deliverable | Exit evidence |
|---|---|---|
| 0. Foundation | Inspect tools; choose first engine; establish catalog, units, coordinates and fixed-step rules | Graybox opens; test asset imports; rule tests run |
| 1. Controls | Camera, building picking, selection, Move/Attack-move/Stop and basic touch | Corners reachable; input does not pass through UI; fighting units can withdraw |
| 2. Economy | Harvesting, cargo, delivery, construction, takeover and cancellation | Sustained income, resource conservation and interruption/recovery scenarios pass |
| 3. Complete match | Production, supply, basic combat, tower, AI, fog, results and restart | Human and AI can complete a match using normal economy and rules |
| 4. Useful progression | All eight units, levels 1–3, research, support and tank counters | Mixed-army tests, support targeting, prerequisites and economy timing make sense |
| 5. Content and readability | Seven maps, FFA slots, compact work strips, stats, settings and cheap effects | Narrow-screen queues fit; 1/2/3 AI games and faction elimination work |
| 6. Presentation | Blender roster, terrain, audio and short narrative framing | Silhouettes are readable; assets reproducible; agreed device targets are measured |
| 7. Release and second engine | Static web release, Godot/native export as requested, parity fixtures | Actual deployed/exported builds pass the relevant scenarios; versions documented |
| 8. Later expansion | Optional campaign content and separately scoped online implementation | Explicit scope and acceptance criteria agreed before building services/content |

Do not produce the entire art library before validating navigation, gathering and control feel. Each phase should leave a runnable game, a short record of completed work and an honest list of remaining limitations.

## 15. Efficient review, commit and release

1. Review the affected rules, callers, UI and current deployment state. Reproduce concrete defects; avoid speculative refactors unrelated to the task.
2. Fix the root cause and add or update a regression when it protects meaningful behavior. Small copy/layout edits normally need a focused visual/interaction check, not a new broad testing project.
3. When labels or layout change intentionally, search dependent tests and help text in the same change. Assert the new behavior instead of restoring obsolete UI text to satisfy a stale test.
4. Run fast simulation checks for rule changes and only the relevant local browser/engine suites. Once they pass, stop repeating them unless new evidence warrants it.
5. For application releases, CI builds once and distributes that immutable artifact to independent browser-test groups. Preserve the same coverage while parallelizing. Publish that tested artifact only after all required groups pass.
6. Keep the build, test and deployment artifact tied to the same commit. Cancel superseded runs when safe; do not let stale releases overwrite the intended version. Retain useful diagnostics on failure.
7. Commit intentional files only, using the configured SSH remote. Preserve unrelated/untracked user files, screenshots and assets.
8. For documentation-only changes outside the build inputs, check Markdown, links and diff; do not run the game or redeploy it unnecessarily. Use the repository's documented documentation/CI-skip policy.
9. After application deployment, perform one brief live check: correct build, successful load, Start, and the changed interaction on an appropriate desktop/touch layout. Report **pushed**, **deployment pending**, or **deployed and verified** accurately.
10. Keep progress reports and final delivery concise. Distinguish physical-device measurements from emulation and disclose remaining material limitations.

For GitHub Pages, verify subpath asset URLs, exported files and MIME/loading behavior. Keep a rollback path to a previously tested build. A green local build alone is not proof that the public site runs.

## 16. Internet multiplayer — plan only until requested

A public web link lets people play the single-player game; it does not make participants share a match. GitHub Pages serves the static client/assets. Shared matches require a separately hosted authoritative service or another deliberately designed networking architecture.

Use [INTERNET_MULTIPLAYER_PLAN.md](github-io/docs/INTERNET_MULTIPLAYER_PLAN.md) for the detailed proposal. Start with private 1v1 rooms before four-player FFA or cross-engine play.

- Introduce a session adapter now so UI submits commands instead of directly mutating simulation state. LocalSession runs locally; NetworkSession submits to the future server.
- Server owns participants, team assignment, resources, damage, simulation time and victory. Validate ownership, finite/bounded data, sequence numbers, prerequisites and costs; deduplicate purchases/orders.
- Send each client only authorized, fog-filtered state. Hiding enemies visually is insufficient if their live state is transmitted.
- Version maps/catalogs/protocols. Define lobby readiness, reconnect, stale snapshots, surrender, server restarts and incompatible clients.
- Online pause is a local menu unless an explicit shared pause system exists. Backgrounded Android tabs may disconnect; reconnect must not duplicate units or player slots.
- Keep secrets server-side. Select provider, budget, capacity and region only when implementation is requested and current hosting details are checked.
- A future Godot client uses the same server authority and protocol. Independent Godot and JavaScript simulations are not automatically interoperable lockstep peers.

Online completion requires two human clients on separate internet connections to finish a match, with consistent results and no fog leakage. Do not advertise multiplayer or cross-play before that is demonstrated.

## 17. Reusable execution prompt

Copy the following prompt into a future development session and attach this document. Select one first engine; ask for the second edition only when it is part of that task.

> You are an experienced RTS developer, technical artist and game engineer. Build an original game called Frontier Command using the attached RTS_GAME_PLAN_V2.md as the main specification. The first target is **[Three.js browser / Godot native and web]**, with Blender source assets. Inspect the existing workspace, installed tools, engine versions and available Blender integrations before choosing exact APIs.
>
> Deliver a runnable game incrementally through the plan's milestones. Keep simulation independent of rendering and use versioned balance/map/command definitions. Preserve explicit withdrawal, reliable harvesting, stable cancellation identities and refunds, fair 1–3 enemy FFA, fog rules and restart cleanup. Support the eight-unit/five-building roster, levels 1–3 and seven-map target after the core match works.
>
> Make both desktop and Android Chrome controls usable. Start belongs in the screen center. Use concise stats, a fixed five-item work row, small green progress squares and red cancel strips with touch-sized hit targets. Keep command positions stable during work. Show real harvesting and combat activity using inexpensive effects. Every building needs touch-accessible Info & stats and clear missing-requirement feedback.
>
> Treat the regression catalog as acceptance requirements, especially camera corners, retreat during combat, deposit arrival tolerance, cargo conservation, supply loss, builder takeover, invalid Support targets, native Start keyboard activation and stale UI callbacks. Use focused checks while editing, update tests when intended labels change, and run required release checks in parallel where independent. Do not claim physical mobile performance from emulation or keep rerunning passed checks without a reason.
>
> Keep work reviewable and move forward on reversible implementation choices. Ask only for missing decisions that materially block progress. Do not implement multiplayer, buy hosting or create another engine edition unless requested. When commit/push/deployment is authorized, use the existing SSH setup, publish only tested artifacts and verify the live result. Finish with the game link, completed scope, checks and any remaining limitations.

## Reference material

- [Original game plan](RTS_GAME_PLAN.md) — historical starting scope.
- [Original Godot/Blender planning document](GODOT_BLENDER_PLAN.md) — historical engine notes; its deferred-status header predates the completed Godot edition.
- [Balance catalog](github-io/src/balance.json), [map catalog](github-io/src/maps.json), [shortcut catalog](github-io/src/hotkeys.json) — baseline data, subject to future versioned tuning.
- [Code and mobile review](github-io/CODE_REVIEW.md), [gameplay review](github-io/docs/GAME_REVIEW.md) — reproduced defects and reasoning behind fixes.
- [Activity and compact-status behavior](docs/ACTIVITY_FEEDBACK.md) — construction, cancellation, harvesting and lightweight effects.
- [Online multiplayer proposal](github-io/docs/INTERNET_MULTIPLAYER_PLAN.md) — future networking scope.

When historical notes and this future specification differ, identify the difference and make the chosen behavior explicit. Preserve the underlying player-facing requirement rather than blindly copying old implementation details.
