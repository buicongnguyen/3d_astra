# Frontier Command: full review and rebuild plan (November 2026)

Four reviews were run on commit `089e694`: game-rules code, client code and systems, a played design review (109 screenshots on desktop, phone portrait and phone landscape), and a review of every plan document against the code. This file combines them and proposes a rebuild. Nothing in the plan is built yet.

Limits of the review: matches were played by a scripted bot in headless Chrome (software rendering), audio was judged from code, and no physical phone was used. Findings marked *confirmed* were reproduced with a script or traced through the code; *plausible* ones were read only.

## 1. Verdict

The game is a clean, well-tested RTS skeleton with a good menu shell and strong draw-call discipline. It is far from a top-tier game in three ways:

1. **No story.** The campaign is seven rows of map, enemy count and AI speed with one sentence each. Every stage has the same objective.
2. **Shallow play.** One win condition, one +10% research, no abilities, stances, veterancy or map objectives. Cheap infantry and towers beat everything else, and the AI almost never builds vehicles.
3. **A flat, muted battlefield with no music.** The title art shows grass, pines and a blue river; the match is beige sand on a grey slab.

The code is sound enough to keep. The rebuild is a restructuring of the same code base, not a rewrite.

## 2. Code review: bugs to fix

### Game rules

| # | Severity | Finding | Where |
|---|---|---|---|
| R1 | High, confirmed | The AI's Foundry is starved of alloy, so it fields almost no vehicles (0 breakers and 0 tanks in 30 minutes on Classic/Normal) while energy piles up unused. | `simulation.js:1045`, `1114-1134` |
| R2 | High, confirmed | Idle units do not react to fire from beyond their own range. An idle Vanguard 9 m from a Ranger died without moving. Towers (range 13) kill idle armies for free. | `simulation.js:1204-1207` |
| R3 | Medium, confirmed | Commands have no ownership check: the sim accepted a player order on an enemy unit and a player enqueue on the enemy Barracks. The UI also writes `b.rally` directly. | `simulation.js:279, 376, 404, 477, 525`; `main.js:756, 788` |
| R4 | Medium, confirmed | An unfinished Command core keeps a team alive, so a match can fail to end. | `simulation.js:1282-1284` |
| R5 | Medium, confirmed | Cancelling a building refunds a flat 75% whatever its damage; foundations give full vision, so they are cheap scouts. | `simulation.js:528, 255-257` |
| R6 | Medium, plausible | One hostile building near an AI core recalls its whole army and blocks every wave. | `simulation.js:1136-1169` |
| R7 | Low | The AI never researches and never builds a second core; units hugging a wall can shoot through it; splash ignores building size; `ROCKS` is duplicated in `data.js` and `balance.json`. | `simulation.js:1082-1130, 781`; `navigation.js:262` |

### Client

| # | Severity | Finding | Where |
|---|---|---|---|
| C1 | Medium, confirmed | Touch mode is one-way: one touch or pen contact on a hybrid laptop locks the compact touch HUD until reload. | `main.js:177, 949` |
| C2 | Medium, plausible | Audio never suspends on pause or hide, and may not recover from iOS's "interrupted" state. | `ambience.js:26`, `main.js:269` |
| C3 | Medium, plausible | WebGL context loss shows no message and the match keeps running behind a dead canvas. | `view.js:112` |
| C4 | Low-medium, confirmed | One failed model download makes boot fail for good, with no retry and no progress indicator. | `view.js:276`, `main.js:1875` |
| C5 | Low, confirmed | The pause modal does not cover the top bar: opening Help over it, then closing, resumes the match. | `main.js:1209, 1235` |
| C6 | Low, confirmed | Minimap label, page title and description are never translated; "Training n/8" is hard-coded. | `i18n.js:48`, `main.js:1897` |
| C7 | Low, confirmed | Hover picking raycasts every visible entity on each mouse move; each resize sets the renderer size three times; a new game builds two simulations. | `main.js:996, 231, 1500-1507` |
| C8 | Low, confirmed | No keyboard path to select or target on the map; any window blur opens the pause modal. | `main.js:1167` |

### Performance of the rules

On Highlands with three fast AIs the average tick reached 5.7 ms at 310 entities, with single ticks of 40-90 ms (longer than the 50 ms step). Causes: pairwise unit separation each tick (`simulation.js:1252-1273`), obstacle scans in `canTraverse`/`canStand`/`clearLine`, A* allocating three grid arrays per call, a full entity scan per combat unit for targeting, and linear `get(id)`.

## 3. System review: what blocks a bigger game

- **`simulation.js` is one 1,312-line class** mixing setup, orders, movement, combat, economy and AI. Behaviour is decided by type-name checks (`worker`, `medic`, `tank`), so a new unit class means editing the tick loop. There is no ability, cooldown, projectile, armour or status model.
- **No command layer.** Player actions reach the sim through seven direct calls plus one direct write. This blocks replay, save, scripted missions and multiplayer at once.
- **No save.** State is plain data with no closures and no random numbers, so serialising is feasible, but there is no schema or version.
- **Win and lose are hard-coded** to "has a core". There are no regions, timers or triggers, and the tutorial works by changing sim internals.
- **`main.js` is one 1,910-line closure** with about 40 shared variables. Game flow is a set of booleans; "create match" is duplicated in five places. There is no screen-state machine, and one shared modal is the only overlay, so a briefing or dialogue layer has nowhere to live.
- **Translation uses English text as keys**, applied after the fact, and the sim emits English prose that the UI string-matches. This will not carry dialogue.
- **Rendering:** static instanced batches are strong, but each entity has its own ring and bar draw, units have no skeletal animation, terrain is a flat plane, there is no post-processing slot and quality is two tiers only.
- **Loading:** 16 uncompressed models (about 3.1 MB) all load before Start, with no progress bar; no service worker, so no offline play.
- **Tests and CI:** 227 unit tests and 25 browser scripts with no shared helper or runner; about 45 test files are named by review round, not feature; tests run only after a push to main; WebKit is not in CI; a timing-based render test gates deploys. No changelog and no version shown in-game (`package.json` still says 0.1.0).
- **Audio** is an oscillator beep and filtered noise: no music, samples or buses.

What already helps: the sim imports no DOM or three.js, runs a fixed 20 Hz tick with no randomness (two 6-minute runs gave identical state), and emits an event queue.

## 4. Design review

### Gameplay

- The four starting Harvesters stand idle and nothing is earned until the player assigns them.
- Skirmish with Normal AI is preselected. A scripted build order was wiped out at 2:35-2:43 in three runs; even on Relaxed a 12-unit wave arrives at 2:41.
- Losing the core deletes every unit and building at once.
- Dominant choices: a Vanguard costs 100 alloy for 14.1 damage per second; a Battle tank costs 275/125 and four population for 21.8. Towers cost 125 alloy, need no population and outrange every unit. Energy is close to useless. Fourteen Harvesters on one base still earn 91 alloy a minute each, so more workers is always right.
- Counters exist only as text in the field guide; armies stack into one clump; no capture points, high ground or cover.
- The result card shows two numbers. The only lasting record is a best time per stage.

### Story

Effectively none: one faction name ("Meridian"), enemies told apart by colour, no characters, no reason for the war, no briefing, no in-mission dialogue, no debrief beyond "Next: Stage 2". `SCENARIO_AND_ENVIRONMENT_PLAN.md` already designs escort, hold-two-of-three and delivery missions; none is built.

### UI and look

- The menu shell (start, settings, result cards) is the strongest part and fits phones without overflow.
- The match does not look like the title art: flat beige sand, grey-teal water, no trees, a grey slab past the map edge, murky green-grey fog, placeholder-looking walls.
- Desktop HUD text is small (hotkey badges 9 px, command labels 10 px, icon-only buttons about 36 px); the dock is dead space with nothing selected; "96×96" and "High 60 FPS" read as debug text.
- Phone portrait is good. Phone landscape is the weakest layout: the battlefield gets about 40% of the screen and the training card covers the units it asks the player to tap.

## 5. Plan review

- 37 documents (about 50,000 words) in four folders with no index. Most are records of finished work, not plans.
- **Untrue or stale:** the root README calls the Godot edition "deferred" although it is live; "balance data matching the Godot edition" is false (Harvester 100 HP here, 55 there); `PROGRESSION_PLAN.md` and `VERIFICATION.md` carry old numbers and limits; `vi.json` differs between the two repos by 115 lines; `FUTURE_IDEAS.md` says lockstep multiplayer while `INTERNET_MULTIPLAYER_PLAN.md` chooses an authoritative server.
- **Never addressed anywhere:** who the player is, phone versus PC priority, what makes the game distinct, any world or narrative, any art direction, a roadmap with a definition of done, distribution beyond GitHub Pages. "Not tested on a physical phone" is repeated in seven documents and never closed.
- **Godot twin:** 42 commits, last on 1 October, against 79 here. It lacks everything from October onward. Two editions kept as equals double the cost of every feature.

## 6. Rebuild plan

Each phase ends with tests green, a deploy and a version tag. Phases A and B are prerequisites; C to F can then run in the order the owner prefers.

### Phase 0: quick wins and bug fixes (small)
- Fix R1-R7 and C1-C8.
- Harvesters start mining automatically; new players default to Campaign stage 1; "attack incoming" warning with a minimap ping.
- Remove debug-looking text from the HUD; show a version in Settings; start `CHANGELOG.md`.

### Phase A: core restructure (large, no visible change)
- Command layer: every action is `{tick, team, type, ...}` with an ownership check, including rally.
- Split `Simulation` into systems (orders, movement, combat, economy, production, vision, AI) over one state object with an id map and per-team lists.
- Data-driven behaviour: tags (`gatherer`, `depot`, `healer`), armour classes with a damage table, an ability list with cooldowns.
- Versioned `serialize()`/`load()`; determinism hash test in CI.
- Spatial hash for separation, targeting and splash; pooled A* buffers with a per-tick budget.

### Phase B: client restructure (large, little visible change)
- Screen-state machine: boot → menu → briefing → match → pause → debrief, with one `createMatch(config)`.
- Split `main.js` into input (mouse, touch, keyboard, gamepad mapped to intents), HUD parts, minimap, flow and audio.
- Keyed translation messages with parameters; the sim emits message ids.
- Staged loading with progress and retry; compressed models; service worker for offline play.
- Playwright Test with shared fixtures, tests renamed by feature, checks on pull requests, WebKit in CI.

### Phase C: gameplay depth (large)
- Stances (hold, guard, aggressive), return fire, formation spread.
- One active ability per combat unit; veterancy from kills; either/or upgrades at building levels 2 and 3.
- Rebalance: deposit saturation, vehicles worth their population, a siege unit that outranges towers, a tower limit or power need, refunds scaled by health, a real use for energy.
- Neutral capture points on every map (income or vision).
- AI that balances its economy, spends energy, expands, researches and composes against what it has seen.
- Save and resume a match.

### Phase D: story campaign (large)
- A world: why the expedition exists, two or three factions with their own look, a commander and an adviser with portraits, a named antagonist.
- Mission layer: objectives and triggers over events, regions and timers, with pluggable win conditions. The tutorial moves onto it.
- 10-12 missions with distinct objectives (hold relays, escort, delivery quota, survive, rescue, no-base strike), each with a briefing, radio lines on triggers and a debrief that reflects what happened.
- Medals per mission and a campaign map screen.

### Phase E: look and sound (large)
- Palette pass to vivid warm colour matching the title art; dark-blue fog; skirted map edge.
- Map dressing: trees and props, proper wall models, gentle height and cliffs, larger explosions.
- Instanced rings and health bars; quality tiers (shadows, resolution, post) driven by the frame governor; unit animation by vertex-animation textures.
- Music (menu, build-up, battle) and sampled combat and UI sounds on separate volume buses.

### Phase F: UI (medium)
- Phone landscape rework: full-bleed battlefield, slim overlay dock, persistent minimap.
- Desktop HUD: minimum 11 px text, larger command buttons with labels, idle-worker and army shortcuts in the empty dock, larger draggable minimap with pings.
- In-fight counter hints; briefing and dialogue overlay; results screen with army graph, breakdown and a core-destruction camera beat.

### Documentation
Create `VISION.md`, `ROADMAP.md`, `DESIGN.md`, `ARCHITECTURE.md`, `CHANGELOG.md` and `TESTING.md` in `github-io/docs/`; move finished plans and dated reviews to `docs/archive/`; correct the README claims above.

## 7. Decisions (owner, 2026-11-10)

The owner approved all phases, asked for both a phone and a PC version, and left the rest to the implementer:

- **Scope:** all phases, in order 0, then A to F.
- **Platform:** phone and PC are both first-class. Every screen is checked on desktop, phone portrait and phone landscape.
- **Story:** keep and deepen the Meridian expedition premise.
- **Godot twin:** frozen as a snapshot of 2026-10-01; no further porting.
- **Multiplayer:** after this rebuild. Phase A still adds the command layer and ownership checks so it stays possible.
- **Music and sound:** made in-house (generated tracks and synthesised effects), no licensed audio.

The questions as originally asked:

1. **Scope:** all phases, or a subset first (for example 0 + C + D)?
2. **Platform priority:** phone first or PC first? This decides HUD density and visual budget.
3. **Story premise:** keep "Meridian expedition on an abandoned frontier" and deepen it, or a new setting?
4. **Godot twin:** freeze it with a "snapshot as of 2026-10-01" note, or keep porting?
5. **Multiplayer:** in scope for this rebuild or later? It decides how strict Phase A must be.
6. **Music and voice:** generated in-house, or licensed tracks?
