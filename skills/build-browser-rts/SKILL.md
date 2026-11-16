---
name: build-browser-rts
description: Build or extend a real-time strategy game that runs in the browser (Three.js + Vite, static site, phone and PC) the way Frontier Command was built - a deterministic fixed-tick simulation behind a command layer, data-driven units/buildings/maps/missions, Blender-generated models, a client that only reads the simulation, bots that prove balance and missions, browser suites at three viewports, and push-to-deploy on GitHub Pages. Use when asked to create an RTS / base-building / tower-defence / skirmish-and-campaign strategy game for the web, to recreate Frontier Command, or to add a large feature (faction, game mode, campaign, air units, story scenes, music) to such a game without breaking saves, replays, tests or phone performance.
---

# Build a browser RTS (the Frontier Command method)

Frontier Command (`github-io/` in this repo, live at buicongnguyen.github.io/3d_astra) is the worked
example: 4 factions, skirmish, a 15-mission campaign with decisions and two endings, four faction
chronicles, a Defence mode, air units, recorded music, English and Vietnamese, phone and PC.
This skill is the method that got there. Read `references/lessons.md` before a large change; it
lists what went wrong and the rule each failure produced.

Sibling skills cover the neighbouring ground: `web-game-craft` (feel, controls, cameras),
`lightweight-game-objects` (cheap models and creatures), `smooth-dense-scenes` (many units on a
phone), `game-ui-upgrade` (screen audits). Use them; this skill is about the shape of an RTS.

## 0. Before writing code

1. Inspect the workspace, Node, Git, `gh`, Blender (and its version). Never claim a tool or a
   check without evidence.
2. Write the spec first: resources, the unit table (HP, shield, damage, interval, range, cost,
   supply, train time, requirement), buildings and levels, counters, the starting position, win and
   draw rules. `RECREATE_GAME_PROMPT.md` at the repo root is a complete example; start from it.
3. Decide the owner's standing rules and write them down: target devices (here: Android Chrome
   portrait 390x844, landscape 844x390, desktop 1440x900), languages, original names and art only.
4. Keep temporary files inside the project (`.tmp/`, ignored). Never in another project's folder.

## 1. Order of work

Build in this order; each step is playable or testable before the next.

| Step | Deliver | Proof |
|---|---|---|
| 1 | Simulation: tick, entities, orders, movement, combat, economy, fog, win/lose | unit tests in Node, no browser |
| 2 | Command layer, save/load, state hash, replay | a match replays to the same hash |
| 3 | Opponent AI as a player of the command layer | bot-vs-bot benches finish; AI never cheats on fog |
| 4 | Client: view, selection, orders, HUD, minimap, touch | browser suite at three viewports |
| 5 | Blender models + runtime contract | `assets` test on every GLB |
| 6 | Tutorial, settings, language, offline (service worker) | suites per feature |
| 7 | Missions as data + a mission engine + mission bots | `check:missions` |
| 8 | Extra modes (Defence), factions, air, story scenes, music | each behind lazy state, hash unchanged |
| 9 | CI matrix and Pages deploy | green run, live version checked |

## 2. Architecture rules (do not bend these)

- **Simulation is a pure library.** One class, fixed 20 Hz tick, deterministic: no `Math.random`,
  no `Date`, no DOM, no imports from the client. Systems are mixins in `src/sim/*.js` (vision,
  orders, movement, combat, economy, ai, tactics, missions, plus one file per mode).
- **Every action is a command.** `sim.command({ team, type, ... })` validates ownership, cost,
  prerequisites and finite coordinates, and logs the command with its tick. The client never mutates
  the simulation. Disabled buttons are not enforcement.
- **Events out, nothing in.** The sim pushes to an `events` array (shot, death, say, scene, message);
  the client drains it every frame and turns events into visuals, sound and UI.
- **Save = serialize the rules state only.** Derived data (navigation, terrain, lookups) is rebuilt
  on load. `sim.hash()` is pinned in a test.
- **New state is lazy.** A feature creates its state only in a match that uses it, so an old match
  serializes byte-for-byte as before and the pinned hash never changes. This one rule is what let
  factions, Defence, air and decisions ship without breaking saves or replays.
- **Numbers live in data.** `balance.json`, `maps.json`, `visual-style.json`, mission files. Code
  reads them; tuning never edits logic.
- **Client modules don't import each other.** Each `src/app/*.js` exports `setupX(S, A)`: `S` is the
  one shared state object, `A` the functions modules offer one another; `setup` returns `bind()`.
  `main.js` is a short composition root. Screens move only through a screen-state machine with a
  unit-tested table of legal moves.
- **Fog is a rule, not a look.** One `isVisible(entity, team)` is used by targeting, rendering, the
  minimap and sound. Nothing visual or audible may reveal a fogged enemy.
- **Cosmetic randomness has its own seeded generator** and never touches simulation state.

## 3. Gameplay building blocks

- **Movement:** A* on a grid with obstacle buckets and a per-tick pathing budget; steering and
  separation on top. Arrival must end inside working range (see the harvester rules in lessons).
- **Economy:** finite deposits, carry-and-deliver workers, supply cap, production queues, rally points.
- **Combat:** range, interval, shields before health, counters as multipliers in data, splash,
  line of sight, stances, veterancy, abilities with cooldowns.
- **Terrain that matters:** plateaus with ramps (two heights), high ground hidden from below beyond
  a rim strip, a river with bridges and a slow ford. Every terrain rule gets a visible mark and a
  first-time hint, or players will not find it.
- **AI:** a plan (economy, build order) plus field command (gather, attack on seen odds, retreat).
  Difficulty changes tempo and mistakes, never fog or resources.
- **Missions are data:** triggers (`when`) and actions (`do`), objectives, a cast, story text in its
  own catalogue. Decisions set flags; `resolveMission(def, progress)` settles earlier answers before
  a match starts. Scenes only emit an event, so they cannot change the outcome.
- **A second mode reuses the rules.** Defence is a mission-shaped definition with a `defence` block
  (routes, waves, pads), not a second game.

## 4. Art, sound and text

- **Models:** Python in Blender, one shared kit (bevelled primitives, vertex-colour baked lighting,
  team-colour materials), exported to `public/models/<type>.glb` with a manifest. The committed GLBs
  are all the game needs. A test checks triangle budgets and that every mesh has the same vertex
  attributes (merging drops meshes that differ).
- **Drawing many units:** instanced batches per model part; tint by instance colour, never by
  swapping materials; materials and shader programs outlive a restart; a frame governor lowers
  resolution first on weak phones.
- **Sound:** synthesised in code, with a voice budget, distance mix and combat ducking as pure
  functions with their numbers in one file. Recorded music is optional, decoded and looped by exact
  points, never precached, and falls back silently.
- **Text:** the English string is the key; every new string gets its translation in the same
  change; a test scans the UI source and fails on a missing entry.

## 5. Screens and devices

Every screen is checked at 1440x900, 390x844 and 844x390: text at least 11 px, touch targets at
least 44 px, no sideways scroll, nothing under pinned buttons. No `system-ui` fonts (CI Linux
renders them wider). Phones keep at most four command tiles per building. Reduced motion, an Eco
quality and a `motion-off` class stop every animation.

## 6. Tests and proof

- **Unit tests** (`node --test`, seconds): every rule, save/load, replays, data checks, catalogues.
- **Bots:** an objective bot must win each mission inside its time targets, a passive player must
  lose; benches play factions against each other. Run them after any balance or mission change.
- **Browser suites** (plain Playwright scripts against a built preview): one per feature, with an
  opt-in `window.__frontier` test hook (`?test`): `step(seconds)`, `hold` to freeze the match clock,
  `skipScene()`.
- **Never race the game clock.** Hold the clock and step it; skip scenes before waiting for what
  follows; measure related boxes in one `page.evaluate`; wait for an element before measuring it.
- **Run CI locally first:** `npm run test:ci-local` (groups read from the workflow, software
  rendering + CPU slowed 20x) and once with `--fast`. Five red CI runs in a row came from skipping this.
- **Performance is a gate:** a visual change needs a before/after table of draw calls, triangles and
  frame time on a phone viewport; a render-budget suite fails on regressions.

## 7. Ship

`vite build` with `base: "./"`, a generated service worker (versioned caches, no `skipWaiting`),
and a GitHub Actions workflow: unit tests, bot check, build, a browser matrix, then Pages. Nothing
deploys while any group is red. Bump the version, write the changelog entry, push once per batch
(a newer push cancels the older run), then confirm the live site serves the new bundle.

## 8. Working with agents on a big feature

One agent per feature, each in its own git worktree with a precise brief and owned files; the lead
reviews screenshots and merges. Append-only files (catalogues, changelog) conflict: merge them with
`git merge-file --union`, then fix the JSON. Never merge while a test run is in progress. Always
build with visible output. Remove only what this session created, and unlink a `node_modules`
junction before deleting a worktree folder.

## Checklist before calling a feature done

- [ ] Rules in `src/sim`, reached only through commands; unit tests for each rule.
- [ ] Pinned sim hash unchanged; an old save loads; a replay matches.
- [ ] New numbers in data files; new strings translated; story text in the story catalogue.
- [ ] Bots still pass (missions, defence, faction bench as relevant).
- [ ] Three viewports: 11 px text, 44 px taps, no sideways scroll; a screenshot reviewed by eye.
- [ ] Draw calls and frame time compared on the phone viewport.
- [ ] `npm run test:ci-local` green (slow) and `--fast` green.
- [ ] Docs and changelog updated; pushed; CI green; live version confirmed.
- [ ] Temporary files removed; nothing left outside the project folder.
