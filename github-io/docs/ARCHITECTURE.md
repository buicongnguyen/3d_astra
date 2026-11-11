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
| `main.js` (153 lines) | Composition root: imports (their order fixes the stylesheet order), creates the page and the shared state, runs each module's `setup` then `bind`, boots the 3D view and loads the models |
| `app/state.js` | The one shared mutable state object `S` (match, selection, modes, input, audio, settings, campaign picks) and the frame governor |
| `app/screens.js` | Screen-state machine: `menu`, `playing`, `held`, `pause`, `help`, `result`, `graphics`, `fullscreen`, `guide`, `settings`. Every move goes through `begin`, `toMenu`, `open`, `close`, `dismiss`, `hold`/`release` or `snapshot`/`restore`; the legal-move table is unit-tested |
| `app/shell.js`, `app/dom.js` | The static page markup; the `$(id)` helper |
| `app/hud.js` | Layout (compact, touch, desktop console), notices, top bar and selection / command panel refresh (`updateUI`), training panel, objectives toggle, mission UI |
| `app/preferences.js` | `applyPreferences`, the settings dialog, language row, quality and sound buttons |
| `app/sound.js` | Audio context, UI tones, the audio clock that sleeps while paused or hidden |
| `app/selection.js` | Selection, control groups, select-all-of-a-type |
| `app/orders.js` | Targeting modes, building placement, the order a click or tap sends (`commandAt`) |
| `app/abilities.js` | Abilities, stances, Barrage aiming, auto-cast |
| `app/command-card.js` | Order buttons, command tiles, tooltip line, production and construction panels |
| `app/input-pointer.js` | Mouse and touch: hover, drag boxes, taps, camera drag, touch buttons |
| `app/input-keyboard.js` | Keyboard shortcuts (`runShortcut`), key handling, pause on blur |
| `app/minimap.js` | Minimap drawing, remembered buildings and deposits, minimap clicks |
| `app/modals.js` | Modal shell, pause, help, full screen, graphics-lost and field-guide dialogs |
| `app/briefing.js` | Start screen: mode switch, campaign list, battle setup and preview |
| `app/match-flow.js` | Start, restart, new game, autosave and Continue, result and debrief |
| `app/frame.js` | The frame loop (simulation steps, event dispatch, camera pan, governor sampling) and alerts |
| `app/debug-hooks.js` | `window.__frontier`, the opt-in hook for browser tests (`?test`) |
| `view.js` | Rendering, models, effects, fog, camera |
| `scatter.js`, `map-edge.js`, `ground-paint.js`, `fog-aware.js`, `visual-style.json` | Map look: palettes, lighting, dressing |
| `faction-colors.js` | Faction colours for mission enemies |
| `tactics-ui.js`, `tactics-card.js`, `tactics-view.js` | Ability tiles, stances, Barrage aiming, rank marks |
| `mission-ui.js`, `mission-text.js`, `capture-view.js`, `campaign.js`, `savegame.js` | Campaign interface, progress, autosave |
| `story/world.js`, `story/missions.js` | Factions, cast, mission data |
| `i18n.js`, `locales/` | Text catalogue (keyed by the English string); the Vietnamese and story catalogues are separate chunks loaded when Vietnamese is shown |
| `app/loading.js`, `app/offline.js`, `tools/sw.template.js` | Staged model download with progress; service worker registration; the worker (published as `sw.js`) |
| `governor.js`, `entity-batches.js`, `ambient-life.js` | Frame-time governor, instanced batches, ambient life |
| `music.js` | Music and sound |

**How the app modules fit together.** Each `app/` module exports `setupX(S, A)`. `S` is the shared state; `A` is what modules offer one another (functions and widgets). `setup` registers functions on `A` and builds widgets; it returns a `bind()` that attaches listeners and does one-off DOM changes. `main.js` runs all setups, then all binds in a fixed order (same-type listeners keep their order). Modules never import each other, so there are no cycles. A module that is the only user of a value keeps it as a local; everything shared lives on `S`. The hot frame loop is in `frame.js` only.

## Text and translation
Every visible English string is its own key in `locales/vi.json` (`messages`, matched ignoring case and spacing); sentences with numbers or names use a `patterns` entry (regex, `{1}` is the translated capture). Convention for new text: write the English in the source as a plain literal or HTML template text, add the Vietnamese to `vi.json` in the same change, and list names, key labels and units that stay English in the `KEEP` set of `tests/i18n-coverage.test.js`. That test scans the UI source for visible strings (template text, `title`/`aria-label`/`placeholder`, `notice(...)`, `.textContent = "..."`) and fails when one has no Vietnamese entry; strings built with `${...}` need a pattern and are covered by `tests/language.mjs`. At runtime, development builds (and any page opened with `?i18nwarn`) log each untranslated string once with `[i18n]`; production never does. In the browser the Vietnamese catalogue is fetched when Vietnamese is first shown (`loadLocale`), the story catalogue likewise (`loadStory`); Node loads the catalogue up front so `translate()` stays synchronous.

## Loading and offline
`main.js` renders the shell, then `prefetchModels` (app/loading.js) downloads the .glb files in a fixed order into three.js' cache while the Start button shows stage and percent; `WorldView.loadModels` parses them. The sound engine is imported on the first gesture (app/sound.js). `vite.config.js` publishes `sw.js` from `tools/sw.template.js`: precache of the build's files (`fc-shell-<build>`), models cached on first fetch (`fc-models-<hash>`), network-first pages, no skipWaiting. Both cache families are versioned by content; old ones are deleted when the new worker activates.

## Rules that keep it correct
- The simulation never imports the client; the client reads it and sends commands.
- Cosmetic randomness uses its own seeded generator and never touches simulation state.
- Fogged enemies are never revealed by anything visual or audible.
- Visual changes need a before/after table of draw calls, triangles and frame time on a phone viewport.
- Materials and shader programs outlive match restarts.

## Stage 1 presentation and audio

`camera-shake.js` owns deterministic cosmetic trauma. `visual-style.json.feel` contains the feedback settings. The view temporarily offsets the camera only during rendering and slows only cosmetic delta time during hit-stop. The rules emit presentation metadata but never read view state.

`audio-mix.js` holds mix parameters and audition names. VoiceBudget enforces the burst ceiling; CombatMix counts only audible effects accepted by the voice budget. AudioDirector applies combat attenuation to the music bus independently of dialogue ducking.

| Moment | Cue | Dispatch |
|---|---|---|
| Unit ready | trained | spawn event |
| Research done | research | research event |
| Building lost | boom:building | death event |
| Objective done / failed | objective / objective-failed | mission UI |
| Mission won / lost | win / lose | result flow |

The settings Audio tab previews every cue without resuming the simulation. Mute and volume settings still apply.

Model roster: model-roster.js defines a stable boot set and modelsForMatch. WorldView.ensureModels serializes missing-model preparation; modelsReady describes the current match requirement. loadAssets reuses the loading/Retry screen for later rosters and calls ready only once. Faction GLBs remain first-fetch cached by the existing service worker.
