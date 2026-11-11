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

## Mission bot
`npm run check:missions` (about 90 s) plays all twelve missions through the command layer. Each must stay alive for a passive player, not be won by a generic bot too easily, and be won by the objective bot within its time targets. Run it after any change to `src/story/missions.js` or to rules that affect balance.

## CI
`.github/workflows/pages.yml` pins Ubuntu 24.04, runs the unit tests, builds, runs the browser suites in groups (commands, settings, feedback, layout, maps, construction, visuals, story) and deploys `dist/` on success. A run takes 15 to 30 minutes; a new push cancels the run before it.

## What is not tested
Real phones, real audio output and sound taste. Touch tests use browser emulation.

## Stage 1 additions

- `test:feel`: harness-based portrait test for all eight projected unit bounds, Barrage shake/decay, disabled motion, camera cues, camera restoration and render-only hit-stop.
- `test:campaign`: additionally checks difficulty selection, persistence, Vietnamese and 44 px controls at desktop, portrait and landscape.
- `test:audio`: additionally checks the burst limiter, combat ducking and seven cue buttons at all three viewports.
- `check:missions -- --difficulty story|standard|veteran`: per-difficulty bot tables. The plan requires 10/12 Veteran objective wins and all passive players surviving 150 seconds, but the checker remains stricter: any individual failure produces a nonzero exit.
- `node tools/skirmish-bench.mjs`: 48 games; `--speeds`, `--maps`, `--attack-at` narrow an investigation without changing default coverage.
