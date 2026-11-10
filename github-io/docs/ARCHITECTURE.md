# Architecture

Three.js r185 and Vite. The game is a static site; there is no server.

## Rules (no browser needed)

`src/simulation.js` is the `Simulation` class. It runs a fixed 20 Hz tick and is deterministic: no `Math.random`, no `Date`, an `events` array that the client drains. Its systems are mixed in from `src/sim/`:

| File | Responsibility |
|---|---|
| `sim/constants.js` | Shared rule constants |
| `sim/vision.js` | Fog of war, what each team knows |
| `sim/orders.js` | Orders, queues, construction |
| `sim/movement.js` | Steering, separation, pathing budget |
| `sim/combat.js` | Targeting, damage, stances (`holdPost`) |
| `sim/economy.js` | Deposits, harvesting, income |
| `sim/ai.js`, `ai-plan.js` | The computer opponent |
| `sim/tactics.js` | Veterancy, stances, unit abilities |
| `sim/missions.js` | Mission engine (format in [MISSIONS.md](MISSIONS.md)) |

Other rules modules: `data.js` (definitions, maps), `balance.json` (numbers), `progression.js` (building levels, shields), `navigation.js` (A*, obstacle buckets), `coalitionPlan`.

**Command layer** (`commands.js`): every player action is `sim.command({ team, type, ... })`. It checks ownership and logs the command with its tick, so a match replays exactly from its options and command log. The client never mutates the simulation directly.

**Save and load** (`snapshot.js`): `sim.serialize()`, `Simulation.load(text)`, `sim.hash()`. Derived data (navigation, terrain, lookups) is rebuilt on load and is not saved.

## Client

| File | Responsibility |
|---|---|
| `main.js` | Input, selection, command UI, match flow (large; to be split) |
| `view.js` | Rendering, models, effects, fog, camera |
| `scatter.js`, `map-edge.js`, `ground-paint.js`, `fog-aware.js`, `visual-style.json` | Map look: palettes, lighting, dressing |
| `faction-colors.js` | Faction colours for mission enemies |
| `tactics-ui.js`, `tactics-card.js`, `tactics-view.js` | Ability tiles, stances, Barrage aiming, rank marks |
| `mission-ui.js`, `mission-text.js`, `capture-view.js`, `campaign.js`, `savegame.js` | Campaign interface, progress, autosave |
| `story/world.js`, `story/missions.js` | Factions, cast, mission data |
| `i18n.js`, `locales/` | Text catalogue (keyed by the English string); the story catalogue loads on demand |
| `governor.js`, `entity-batches.js`, `ambient-life.js` | Frame-time governor, instanced batches, ambient life |
| `music.js` | Music and sound |

## Rules that keep it correct
- The simulation never imports the client; the client reads it and sends commands.
- Cosmetic randomness uses its own seeded generator and never touches simulation state.
- Fogged enemies are never revealed by anything visual or audible.
- Visual changes need a before/after table of draw calls, triangles and frame time on a phone viewport.
- Materials and shader programs outlive match restarts.
