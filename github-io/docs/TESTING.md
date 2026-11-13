# Testing

## Unit tests
`npm test` runs `node:test` files in `tests/*.test.js`: rules, save and replay, missions, tactics, data checks, palettes, string catalogues. They need no browser and take a few seconds.

## Browser suites
Each is `npm run test:<name>` (`tests/<name>.mjs`, Playwright) and runs against a built game:

```sh
npx vite build
npx vite preview --host 127.0.0.1 --port <free port> --strictPort
TEST_URL=http://127.0.0.1:<port>/ npm run test:missions
```

Pick a port nothing else uses. Suites check behaviour at desktop 1440x900, phone portrait 390x844 and phone landscape 844x390 where relevant, including text size (11 px minimum) and touch targets (44 px).

Notes
- Under `?test` automatic harvesting is off unless `?autoharvest`.
- Suites that are sensitive to machine load (patrol, mobile-controls, webkit) can flake locally; run them again before suspecting the code.
- The webkit suite needs `npx playwright install webkit`.
- `ui-extras` (idle units, minimap drag and pings, fight hints, core beat, notch insets, training-card tap guard) writes screenshots to `SHOTS` (default `test-results`); `EXTRAS_ONLY=idle,minimap,...` runs part of it.
- `abilities` (harness, 1440x900, 390x844, 844x390; item 16.3): ready tiles pulse and glow, nothing while recharging, a cooldown ending pulses again; the first-time ability hint shows once per ability across matches; the Barrage ring at the pointer (blast radius, red out of reach), the impact ring and the incoming whistle for own and seen enemy Barrages; `:root.motion-off` follows Eco and reduced motion live, and no CSS animation runs under it. First-time ability hints are off under `?test` unless the URL has `?abilityhints`. Rules: `abilities.test.js`.
- `messages` (harness, desktop, 390x844, 844x390, 320x568): a hint and an alert at once, the alert not covered (elementFromPoint), a routine notice waiting the alert's full time, phone hints outside the middle third and gone after about 4 s, an alert during targeting and with a dialogue line. Its rules are unit-tested in `message-queue.test.js`.

Story you see (0.19b): `tests/story-scenes.test.js` checks the scene data (beats of one kind, cast speakers, lines under 140 characters with Vietnamese, every scene under 20 s and played by a mission, camera targets that are regions of that mission on its map, the finale's scene chosen by ending), that a `scene` action only emits an event (a save taken during a scene loads and stays in step, the scene does not replay, the state equals the same match without the action), the two missions under the Defence rules (stable ids and places in the list, Defence maps, 6 to 8 waves, the data checks of `tests/defence-data.test.js`, `wave`/`waveStart` story beats, medals by lives, the checker's DefenceBot targets), progress keyed by id (a finished twelve-mission campaign keeps all 14 open; older half-way progress keeps its missions open), the campaign map layout, the scene line queue and the `scene` screen rules. `tests/missions-data.test.js` pins the 14 ids in order. `npm run test:story` (harness, CI group "scenes") plays a scene in mission 1 at 1440x900, 390x844 and 844x390 (letterbox, the HUD hidden, the clock held, the music not paused, the line with its portrait above the lower bar, Skip by Escape or tap, the camera back within 0.5 m, the lines in the Comms log, once per match), a motion-off scene that cuts, the 14-node campaign map at the three viewports, and both defence missions started from the campaign (campaign heading, lives, a mid-wave screenshot, Hale's wave line); it also photographs the reworked missions 2 and 9. Screenshots: `test-results/story-*.png`. The mission checker routes missions with a `defence` block to the DefenceBot.

## Writing a suite (tests/lib/harness.mjs)
New browser suites use the shared harness; `browser.mjs`, `hotkeys.mjs` and `language.mjs` are the examples (the other scripts keep their own setup and move over one at a time).

```js
import { launchBrowser, openPage, suite, shot } from "./lib/harness.mjs";
const browser = await launchBrowser();
await suite("my-suite", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {   // 1440x900, 390x844, 844x390
    const { page, errors, tap, goto, ready } = await openPage(browser, viewport);
    await goto();                          // TEST_URL with ?test=1 (goto("firstrun") adds more)
    await ready();                         // models parsed and Start enabled
    await tap("#start");                   // tap on phones, click on desktop
    await shot(page, `my-suite-${viewport}`);   // test-results/<name>.png
    assert.deepEqual(errors, []);          // page errors are collected for you
  }
}, { browser });
```
`openPage` also takes `{width, height, mobile}` for odd sizes and `{deviceScaleFactor, timeout}`, and returns `badResponses`. `suite` prints `PASS name (12.3s)` or `FAIL`, closes the browser and sets the exit code; the CI job collects every script's result and time in its step summary.

Service worker: `DIST_DIR=<build folder> npm run test:offline` (default dist/). It serves its own copy of the build under /3d_astra/ and needs no preview server. The worker is not registered under `?test` unless the URL also has `?sw`.

## Frontier Defence
`npm run check:defence` (`tools/defence-check.mjs`, ~10 s) plays both levels on all three difficulties: the DefenceBot (`tools/defence-bot.mjs`) must reach each level's `check` stars, a passive player must lose and no single crew type may reach 3 stars. CI runs it after the unit tests. `npm run test:defence` (harness, three viewports, its own CI group) taps a pad, crews and upgrades a tower, calls a wave, opens the result and Next level, and saves `test-results/defence-*.png`; `DEFENCE_VIEWPORTS=portrait` runs one viewport. The render budget has a `defence-wave-eco` scene (limit 120 draws).

## Mission bot
`npm run check:missions` (about 90 s) plays all twelve missions through the command layer. Each must stay alive for a passive player, not be won by a generic bot too easily, and be won by the objective bot within its time targets. Run it after any change to `src/story/missions.js` or to rules that affect balance.

## CI
`.github/workflows/pages.yml` pins Ubuntu 24.04, runs the unit tests, builds, runs the browser suites in groups (commands, settings, feedback, layout, maps, construction, visuals, story) and deploys `dist/` on success. A run takes 15 to 30 minutes; a new push cancels the run before it.

## What is not tested
Real phones, real audio output and sound taste. Touch tests use browser emulation.

## Stage 1 additions

- `test:feel`: harness-based portrait test for all eight projected unit bounds, Barrage shake/decay, disabled motion, camera cues, camera restoration and render-only hit-stop.
- `test:campaign`: additionally checks difficulty selection, persistence, Vietnamese and 44 px controls at desktop, portrait and landscape.
- `test:audio`: additionally checks the burst limiter, combat ducking and seven cue buttons at all three viewports, and (2026-11-13) a staged big fight by the camera: voices under the caps (24 total, 12 weapons, 8 explosions), blasts duck the music, the combat music layer comes in, a burst of orders gets one radio reply, and the same fight is silent and error-free with sound off. `tests/audio-weight.test.js` covers the mixing rules and the rendered bank (levels, explosion sizes, seamless engine loops).
- `check:missions -- --difficulty story|standard|veteran`: per-difficulty bot tables. The plan requires 10/12 Veteran objective wins and all passive players surviving 150 seconds, but the checker remains stricter: any individual failure produces a nonzero exit.
- `node tools/skirmish-bench.mjs`: 48 games; `--speeds`, `--maps`, `--attack-at` narrow an investigation without changing default coverage.
- `node tools/high-ground-bench.mjs` (`--json`): equal groups (4 Rangers, 3 Battle tanks, a mixed six) on a Dunes plateau top and below it, 3 gaps × 3 sides × both team orders, each next to a flat-ground control. Prints wins and the HP-weighted outcome (50% = even); `tests/terrain-labels.test.js` keeps a short version. 2026-11-13: high side 161 of 162 fights, 71.9% (control 49.8%).
- `test:terrain` also covers what the player is told about the ground: the ▲ by units on a plateau top (none below), the card line, the reach rings, the one-time high-ground hint, the ford's marks, crossing hover label and tap notice, and the minimap crossing ticks. Since 16.2 (terrain rules you can see) it also checks the eye-slash beside the ▲ and the "Hidden from below" card line for a unit deep on a plateau (none for a unit on the rim strip; the phone dock keeps its height), the hidden-from-below hint (desktop), Barrage refused with "Can't see up there" at an unseen deep top (desktop), the red ramp ticks on the minimap, and a unit wading the ford (card line, "In the ford" on its ability tile). `tests/terrain-rules.test.js` holds the rules: ford speed (`terrain.ford_speed`, 0.6), no abilities in the ford, the Barrage and Burn line sight gate on deep cells only, the terrain-based hidden mark (never fog-dependent) and the ramp ticks.

Package 2.0 adds test:model-loading (harness): late asset retries, readiness gating, failed-load recovery and template reuse. test:offline also checks first-fetch-only caching of an additional model path.

Recorded music (0.16, item 16.4): `tests/music-plan.test.js` holds the `musicPlan` table, loop points, loudness trim, the Music setting migration, the worker's music rules and the 2 MB budget of `public/music/` (missing files are skipped). `test:music` (CI group "music") routes the tiny tone fixtures in `tests/fixtures/music/` in as `/music/*`: nothing under `/music/` before the first gesture; the first tap fetches and loops the title cue; Campaign switches cue; a match crossfades to the adaptive score and frees the loop; a result plays its sting; "Adaptive only" fetches nothing; "Off" silences both; a missing file falls back quietly; the precache list carries no audio; the Music row at 1440x900, 390x844 and 320x568 in both languages (screenshots `test-results/music-settings-*.png`). `test:offline` copies the same fixtures into its build: the played track lands in `fc-music`, plays offline and survives a new worker. Note: `page.waitForFunction` does not await a predicate that returns a promise (it passes at once), so the offline suite polls cache checks from Node (`poll`).

Choices (0.19a): `tests/choices.test.js` holds the story rules: the three decisions are well formed and every `if` names a real decision option or ending; the `endingFor` and `resolveMission` tables (missions with nothing to settle come back as the same object; the defaults keep missions 7 and 9 as they were); a decision holds only its own trigger, the `decide` command is refused for other teams, other ids and unknown options, is logged and replays to the same hash; a save with an open choice loads with it and plays out identically; missions without decisions keep no `flags`/`pending` field; pre-0.19 progress loads with its clears and every field is kept through each record; unlocks follow mission ids; the story-strings walk covers decisions, endings and the campaign map; the new interface words have Vietnamese. `npm run test:choices` (harness, CI group "story") checks the campaign map fresh, mid-campaign with decisions and complete with an ending seen (medal colours, decision marks, a node picks its mission), the choice card in mission 3 (the match holds, 44 px orders, Escape and Space ignored, Tab kept inside, keys 1 and 2, the answer in the command log, the card restored by Continue, Vietnamese on desktop), the epilogue from the map and from the test hook, and the finale won with merciful answers (its objective text, the Epilogue button, `endingsSeen`, back to the map with the ending marked), all at 1440x900, 390x844 and 844x390 with text of 11 px or more, 44 px taps and no sideways scroll. Screenshots: `test-results/choices-*.png`. The mission checker plays the decision branches with `--decide mercy|firm` (and `--progress file.json` for any campaign record).

Package 2.1 adds factions.test.js: pre-change hash, golden counter damage, slot resolution, foreign roster rejection, mission opt-in and faction save/load. Isolated test definitions exercise future rosters without enabling their unapproved assets in gameplay.

Package 2.2 extends assets.test.js to all twelve manifest-tagged candidates: triangle counts and caps, shared attribute sets, paint materials, required legs/weapon/hover markers, and absence of quantization. Approval sheets are visually inspected; aesthetic approval remains an owner step.

CI runs status-layout independently and partitions the eight layout-f viewports into desktop/tablet and mobile groups. The same assertions run for every viewport; unknown or empty viewport selections fail. This avoids placing both expensive software-rendered layout suites inside one 30-minute job.

`npm run test:portraits` checks all 25 portrait and team-mask cells, image dimensions, and CSS atlas coordinates at desktop, portrait-phone and landscape-phone sizes. It saves review contact sheets and runs in the CI visuals group.

Packages 2.3 to 2.6 add `tests/faction-rules.test.js` (15 tests: every number-bearing faction rule, cloak visibility and detection, zones and unlocks through save and load, AI personalities, and an eight-minute AI match per faction that must build the faction building, field its units and attack) and `npm run test:factions` (harness, three viewports, in the CI visuals group): the Enemy faction choice, late model loading, faction colours, naming an enemy by hover or tap, and a Veil match where a hidden Shade is not drawn until it strikes and the first ambush shows the hint. `npm run bench:factions` is the balance bench (see docs/BALANCE.md); `node tools/first-visit.mjs <url>` measures the bytes fetched before the start screen is usable. `ROSTERS=1 npm run check:missions` plays every mission on faction rosters as a trial.
