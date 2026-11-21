# R3-V: Victory ceremony and MVP card (results)

Branch `r3/v-ceremony` from `r3-wave-1m`, worktree `C:\Users\n\source\repos\3d_astra-r3-v`, port 4237.
Presentation only: no file under `src/sim/`, no `simulation.js`, `balance.json`, mission, Defence level or wave was touched.

## What the player gets

| Item | What it does | Where |
|---|---|---|
| Slow motion on the last kill | 1.2 s at ×0.3 view time, camera eased onto the last enemy kill in 0.5 s. Skipped when the core / boss beat of `app/ui-extras.js` already slowed that kill (no double beat). | `src/ceremony.js` (`begin`, `step`), wrapped around `A.stepBeat` / `A.beginBeat` in `match-flow.js` `bind()` |
| Camera swing to the MVP | 0.9 s eased pan onto the MVP with a gold "MVP" tag projected over the unit. | same |
| MVP card | Every win (Skirmish, missions and Chronicles, Defence levels and Heroic, Endless / Daily score): portrait, name, damage, healing, kills. A tower shows the unit that crews it. A win with no damage dealt (a quiet objective win) names the most seasoned unit, "Held the line". | `ceremony-rules.js` `mvpCardHTML`, `fallbackMvp`; counting in `match-stats.js` |
| Stamp + sting | The Skirmish emblem, the mission medal, the Defence stars / Heroic badge or the Endless score lands (scale 2.6 → 1, -16° → 0°) with a three-note `A.tone` sting (mute and volume apply), then a `frontier:stamp` DOM event. | `ceremony.js` `present`, `ceremony.css` |
| Confetti | One Canvas 2D burst from the stamp in the player's team colour plus gold and holo teal, 46 bits on phones / 72 on desktop, 1.6 s, seeded (same every time), `pointer-events: none`, removed after. | `ceremony.js` `confetti` |
| Stats count up | Integers and m:ss tiles count from 0 over 0.9 s (ease-out, 60 ms stagger) and end on the exact text. | `ceremony.js` `countUp` |
| "So close." + one tip | On a loss: "So close.", how close it was (the enemy core's health in Skirmish, main objectives done in a mission, waves held in Defence), and one tip from the match counters: economy (< 120 resources a minute), army (few units trained), trades (lost ≥ 6 and killed < 60% of that), base (≥ 3 buildings lost), else upgrades. Defence keeps R3-E's next-star tip as its one tip. A draw gets the tip without "So close". | `ceremony-rules.js` `lossTip`, `closeness`, `lossHTML` |
| Holo results | The Skirmish result, mission debrief and Defence result in the holo theme of R3-M: glass panel, corner brackets (gold on a win, coral on a loss, teal for a score), sensor line, holo tiles. Scoped to `#modal.result-wide` / `#modal.debrief-wide`; no other dialog changes. | `src/ceremony.css` |
| `onMatchEnd` for R3-R | `import { onMatchEnd } from "./ceremony.js"` (or `A.onMatchEnd`): `fn(summary)` once per finished match after its results screen is on the page; returns an unsubscribe. A throwing listener is logged and the others still run. Summary: `mode` (skirmish, campaign, defence, training), `result`, `win`, `seconds`, `stats`, `mvp`, `medal`, `stars`, `score`, `variant`, `difficulty`, `missionId`, `campaignId`, `tutorialDone`, `ceremony` (what was added), `root` (the results element, to add a rank-up toast). | `ceremony-rules.js`, `match-flow.js` `announce` |

Motion off follows the title cover's "calm" (R3-M): reduced motion or "Animate combat effects" off skips the slow motion, swing, confetti and count-up, and the stamp lands at once. **Eco quality alone keeps the ceremony** (phones default to Eco; it is two seconds of camera pan and a 2D canvas). Browser suites (`?test`) see the static results unless the URL has `?ceremony`, so their timing and stat reads stay as they were.

## Acceptance numbers

| Check | Result |
|---|---|
| `tests/ceremony.mjs` (matrix `r3-v`), 1440x900, 390x844, 844x390 | **PASS** (50 s for all three on 4237): Skirmish win sees phases `slow` → `swing`, the MVP tag centred over the unit, `.mvp-card` with name and portrait naming the unit that destroyed the core, a stamp event, the count-up settling on the real values, `onMatchEnd` summary; Skirmish loss shows "So close.", "The enemy core was down to 40% health." and a tip, no MVP card, no stamp; desktop with motion off: no swing / confetti / count-up, stamp still lands; a mission win and a Defence win each reach `.mvp-card` (name + portrait) and a stamp event |
| One tap per results action | every button sits on the card, nothing grouped (checked in every screen of the suite) |
| Text ≥ 11 px, taps ≥ 44 px, no sideways scroll | 0 / 0 / 0 at all three viewports, all modes |
| Docks | `--dock-height` and the dock / tabs / commands heights identical before and after a ceremony |
| `npm test` | 1027 → **1031 tests** (+4, `tests/ceremony.test.js`, 0.2 s), 1004 pass, 27 skipped, **0 fail** |
| Idle fingerprint `d071360b`, 14 mission checksums, every `golden-*` pin | identical (in `npm test`) |
| Sim hash with the MVP tracker on vs off | identical (unit test, 300 ticks; also 3,574 ticks of a 4-player Riverlands match in a scratch run) |
| MVP tracker cost | **0.005 ms per tick** (3,574 ticks, 76 entities, Node) |
| Render budget `battle-eco` | 107 draws, 0 uploads, PASS 3 of 4 runs; one run under six-agent load failed `noGrowth` with batches `[73, 101, 101]` (the passing runs read `[97, 101, 101]`: the staged-scene count before the first restart varies with load; the restart path only gained `ceremony.cancel()`) |
| `baselines:diff -- --full` | no balance tool imports any file of this package (`tools/`, `src/sim/`, `simulation.js` and `snapshot.js` import none of `match-stats`, `ceremony*`, `results-ui`, `match-flow`). The run on this machine listed the same mission-table rows as the round-2 recordings differ on for `r3-wave-1m` (Wave 1 AI work) and veteran timed out (exit 143) under load; neither can come from this package |
| Bundle | index JS 948.4 KB raw / 316.4 KB gzip, index CSS 200.3 / 38.7 KB (ceremony sources: JS 18.6 KB, CSS 9.5 KB, unminified) |

Suites run on 4237 after the change, all green: `ceremony`, `layout-f` (all eight shapes incl. Vietnamese; the result card still fits and keeps its six tiles), `missions`, `boss`, `defence-onboarding`, `music`.

## Screenshots (`v/`)

- Camera swing with the MVP tag: `swing-desktop.png`, `swing-portrait.png`, `swing-landscape.png`.
- Skirmish win (MVP card, stamped emblem, settled stats): `skirmish-win-{desktop,portrait,landscape}.png`.
- Skirmish loss ("So close.", core at 40%, tip): `skirmish-loss-{desktop,portrait,landscape}.png`, and Vietnamese `skirmish-loss-portrait-vi.png`.
- Mission win (medal stamp, MVP card): `mission-win-{desktop,portrait,landscape}.png`.
- Defence win (stars stamp, MVP card above the next-star tip): `defence-win-{desktop,portrait,landscape}.png` (a forced test win, so no stars are lit).
- Before: the r3-wave-1m results are in `e/after-result-{desktop,portrait,landscape}.png` (Defence) and the round-2 screens; this package did not record a separate before set.

## Decisions taken (change any)

- The MVP is damage plus healing on the player's side, credited from each tick's health-and-shield drop to the unit the simulation records as the hitter (`hitBy` / `hitAt`); healing is one `support` amount per restarted support cooldown. Kills count toward the card line, not the score. Ties go to the older unit.
- Ceremony timing: slow 1.2 s (×0.3), swing 0.9 s (view at ×0.6), stamp at 0.25 s + 0.42 s after the results open, count-up 0.9 s, confetti 1.6 s. A win where the core beat ran adds 0.9 s before the results; one where it did not adds 2.1 s.
- Calm = reduced motion or combat motion off, not Eco (as R3-M's cover).
- On a loss there is no MVP card (the screen is about the tip). Endless / Daily score screens are dressed like a win (MVP and the score stamped) but play no swing.
- The skirmish stamp is the existing emblem, not a new medal; missions already have medals and Defence has stars.

## Seam requests

None needed for the acceptance. For the integrator / later packages:
1. **R3-R:** subscribe with `onMatchEnd` from `src/ceremony.js`; `summary.root` is the results element for the rank-up toast. Listeners run after the screen is dressed. The Defence result loads lazily, so its summary arrives a moment after the modal opens.
2. **R3-U (audio):** the stamp sting is three `A.tone` notes in `ceremony.js` `sting()`. If the sfx bank gets a real stinger, swap it there (one function).
3. `src/app/ui-extras.js` (not mine): its `beginBeat` / `stepBeat` are wrapped, not edited. If its owner renames them, `match-flow.js` `bind()` needs the new names.

## Test changes for the integrator

- New: `tests/ceremony.test.js` (4 tests), `tests/ceremony.mjs`, script `test:ceremony`, matrix entry `r3-v` in `.github/workflows/pages.yml`.
- `window.__frontier` gained `ceremony` (phase, stamps, presented, played, listeners), `onMatchEnd(fn)` and `mvp()` (appended).
- `match-stats.js` keeps the exact `stats` object (the `deepEqual` in `tests/match-stats.test.js` holds); the MVP and the last kill are separate (`mvp()`, `lastKill`).
- No existing test was edited.

## Files

New: `src/ceremony.js`, `src/ceremony-rules.js` (the pure parts, so Node tests need no stylesheet), `src/ceremony.css`, the two tests.
Edited (owned): `src/match-stats.js`, the results part of `src/app/match-flow.js` (`showResult` split into the ceremony and `openResult`, plus `dress` / `announce`; one `ceremony.cancel()` line each in `restart` and `beginMatch`; the beat wrappers in `bind()`).
Appended: `src/locales/vi.json` (14 messages, 7 patterns), `src/app/debug-hooks.js`, `package.json`, `.github/workflows/pages.yml`, `docs/CHANGELOG.md`.
Not touched: `src/results-ui.js` and `src/app/defence/result.js` (owned; the ceremony dresses their output instead), `ui-theme.css`, `cover.css`, any dock stylesheet.
