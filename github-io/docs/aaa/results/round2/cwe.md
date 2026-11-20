# CW-E: Convert source-text tests (K11): results

Branch `r2/cwe-tests` from tag `r2-wave-2`. Tests only (`tests/*`, `tests/lib/*`); no `src/` file, `package.json` or `pages.yml` change, no golden pin file touched.

## Counts

| | Before | After |
|---|---|---|
| `npm test` tests | 935 (909 pass, 26 skipped) | 938 (912 pass, 26 skipped) |
| `npm test` wall time | 61.7 s | 61.0 s |
| `tests/review-*.test.js` files | 32 | 0 |
| local `run()` copies in unit tests | 21 | 0 (stalker keeps its float-accumulating loop on purpose, ambient and soak are different helpers) |

The converted tests ran against the unchanged `r2-wave-2` source (the worktree has no `src/` edit), and none reads a file CW-A to CW-D or CW-F change, so they do not depend on those files' text.

## Converted to behaviour

| New test | Replaces | Checks now |
|---|---|---|
| `service-worker.test.js` (5) | music-plan "service worker" regex test | runs the built `sw.js` (vite plugin output) in a vm with a fake cache store: audio/maps/notes not precached, activation keeps `fc-music`, a 200 track is stored and then served without the network, a 206 is not stored, manifest is network first with cached fallback and a fresh one drops unlisted tracks |
| `css-layout.test.js` (6) | review-2026-10d-03, -10d-04, -10d-05, the `scenes.css` line in story-scenes, the font-sheet lines in look-grade | postcss rule lookup by selector and media condition (training pointer-events and offsets, settings and briefing safe-area insets, letterbox transform, Baloo 2 files, no system-ui) |
| `docs-facts.test.js` (3) | review-2026-10d-11, -10d-12 | README relay supply (10/15/20) and core supply (15) are built from a running Simulation, not typed; pan row and New game wording kept as doc checks |
| `suite-hygiene.test.js` (2) | review-2026-10-05 | parses `stages.mjs` with rolldown's parser and finds the focus assertion as code (a commented-out assertion is not in the tree) |
| `look-grade` (edited) | `view.js` and `ui-theme.css` text | the shared baked material compiled with a fake shader gets the Fresnel rim; `addTeamRim` gives the team colour |
| `terrain-labels` (edited) | `missions.js` text | the wording check reads `MISSIONS` as loaded |
| `tests/lib/client-wiring.mjs`, run by `hotkeys.mjs` | the useGroup, newGame, Space-in-modal, start-recentre and selection-info source tests | in the page: Space on a modal button, Start centres on the HQ, recalling an empty group keeps the selection, an idle second writes nothing to `#selection-info`, restart builds a new Simulation from tick 0 |

`assets.test.js` could not import `PORTRAIT_ORDER` (`portraits.js` imports a `.css` file, which node cannot load), so its portrait order check still reads the file.

## Helper

`tests/lib/sim.js` gained `advance(sim, seconds, { seen, steps, stop, events })`. The options reproduce each copy's loop exactly (tick count rule, stop at the end of the match, event handling), so 21 files now share one loop: ai-attack, ai-economy, ai-rules-091, air, boss-engine, bosses, choices, content-seams, defence-complete, defence-intel, defence-ranks, defence-rules, defence-zones, effects, faction-rules, missions-engine, phase0-rules, save-replay, story-scenes, tactics, wings. Goldens still match.

## Folded: 32 review files, now named by feature

| Was | Is |
|---|---|
| review-2026-09 | ai-build-recovery-and-firing-position |
| review-2026-10-00 | walls-and-boulder-obstacles |
| review-2026-10-01 | building-pushout-blocked-space |
| review-2026-10-02 | client-minimap-preferences-focus |
| review-2026-10-03 | fx-anchors-carry-team |
| review-2026-10-05 | suite-hygiene (rewritten) |
| review-2026-10b-00 | client-start-and-preview-hover |
| review-2026-10b-01 | client-minimap-and-stale-hover |
| review-2026-10b-02 | attack-move-unreachable-enemy |
| review-2026-10b-03 | pathfinding-edge-clearance |
| review-2026-10b-04 | death-fog-and-environment-map |
| review-2026-10b-05 | fx-layer-quality-caps |
| review-2026-10b-06 | campaign-progress-sanitising |
| review-2026-10b-07 | ai-plan-notices-vi |
| review-2026-10b-10 | ai-core-upgrade-saving |
| review-2026-10b-11 | ai-raid-retry |
| review-2026-10c-vi | i18n-review-fragments-vi |
| review-2026-10d-00 | view-explored-walls |
| review-2026-10d-01 | enemy-lookup-pruning |
| review-2026-10d-02 | client-modal-focus-and-minimap |
| review-2026-10d-03, -04, -05 | css-layout |
| review-2026-10d-06 | i18n-joined-tooltips-vi |
| review-2026-10d-07 | briefing-text-node |
| review-2026-10d-09 | i18n-river-placement-vi |
| review-2026-10d-10 | i18n-build-hints-vi |
| review-2026-10d-11, -12 | docs-facts |
| review-2026-10d-13 | vanguard-description-matches-sim |
| review-2026-10d-14 | i18n-engineer-term-vi |
| review-2026-10e-vi | i18n-balance-descriptions-vi |
| review.test.js | squad-movement-and-ai-spending |

These were renamed (history kept with `git mv`), not merged into the older feature files: their tops differ (own imports and constants), and merging would only move code.

## Mutation checks (broke the behaviour, saw the test fail, restored)

- service worker: dropped `key !== MUSIC_CACHE` from activation: `activation keeps the fc-music cache` failed.
- css-layout: replaced the settings panel `env(safe-area-inset-right)` padding: failed.
- terrain-labels: inserted "middle bridge" into `missions.js`: failed.
- docs-facts: changed relay supply 10 to 12 in `balance.json`: failed.
- suite-hygiene: commented out the focus assertion in `stages.mjs`: failed.
- client wiring (browser, dev server): made an empty group recall clear the selection: failed; made `hud.js` rewrite the panel every tick: failed.

## Left as source text (needs a DOM or WebGL; could not be converted without a `src/` change or a larger browser suite)

`client-2026-11` (strings in `main.js`, training counter), `client-start-and-preview-hover` and `client-minimap-and-stale-hover` (hover is not exposed to the test hook), `client-minimap-preferences-focus`, `client-modal-focus-and-minimap` (modal inert, minimap images), `briefing-text-node`, `choices` and `story-scenes` (frame loop stops on a decision or scene tick), `player-faction` (picker wiring and the `view.js` line), `rules-hook` (evaluates `createSim` from `main.js` text), `unit-intros` (hint slot wiring), `view-explored-walls` (needs a WebGL `WorldView`), `defence-deck` (frame/keyboard, and the `defence-ui.js` check belongs to CW-F), `i18n-coverage` (a source scan by design), `assets` (portrait order, Blender list). Plan acceptance "no regex-on-source test left in its scope" is therefore only partly met; the next step is a hook that exposes hover and the frame loop to a browser suite, then these move to `tests/lib/client-wiring.mjs`.
