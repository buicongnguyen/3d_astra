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

## Mission bot
`npm run check:missions` (about 90 s) plays all twelve missions through the command layer. Each must stay alive for a passive player, not be won by a generic bot too easily, and be won by the objective bot within its time targets. Run it after any change to `src/story/missions.js` or to rules that affect balance.

## CI
`.github/workflows/pages.yml` pins Ubuntu 24.04, runs the unit tests, builds, runs the browser suites in groups (commands, settings, feedback, layout, maps, construction, visuals, story) and deploys `dist/` on success. A run takes 15 to 30 minutes; a new push cancels the run before it.

## What is not tested
Real phones, real audio output and sound taste. Touch tests use browser emulation.
