# R3-Q: First-minute hooks (results)

Branch `r3/q-hooks` from `r3-wave-2-final`, worktree `C:\Users\n\source\repos\3d_astra-r3-q`, port 4237.
New sim content behind a new rule (`rules.quick`) and a new Defence variant only: no existing mission, Defence level, wave, `balance.json` entry or Classic AI code was edited, and every existing pin is identical.

## What the player gets

| Item | What it does | Where |
|---|---|---|
| Quick battle, one tap | A teal tile in R3-M's `#title-actions` slot, above the mode cards (on landscape phones beside Start, in the pinned launch row). One tap starts the match: Meridian Riverlands, one **Relaxed** rival (Ashfall; Meridian when you command Ashfall), your remembered faction, no other battle rules. No menu, no sheet, no second tap. | `src/quick-battle.js`, `src/quick-battle.css` |
| A ready outpost | At the start: a Sentinel tower 11 m towards the enemy, a Supply relay, two more Harvesters, +150 alloy. | `src/sim/content/quick-battle.js` (AI rule H19, first think) |
| Scouts at about 0:40 | On the rival's first think from 0:32, three scouts of its roster (two Vanguards, a Ranger) set off 50 m out on the line between the cores and attack-move on your core: "Enemy scouts sighted! Meet them at your tower." The fight starts at 37 to 39 s. | same (`quickScouts` on the rival's player record) |
| Your setup is kept | `rules.quick` is added only while the match is built (`A.createSim` wrapper) and never stored or shown in Battle rules; your own rules (for example Expanded) and the setup selects are untouched. "Play again" replays a Quick battle; "New game" goes back to your setup. A saved Quick battle continues as one. | `src/quick-battle.js` |
| First watch | A profile with no Defence win plays level 1 (Gorge Road, "Levels") through a new variant built from it (`firstWatch()`); Endless, Daily, Heroic, other levels and the designed level are untouched. Same level id, so stars count for Gorge Road. Under `?test` it is off unless the URL has `?firstwatch`. | `src/defence/first-watch.js`, `A.defenceMission` wrapper |
| Enemy roster strip | From the start of a First watch match until wave 1 sets off: "Enemy roster", the Scout Runner first (gold), then every enemy type with the wave it first comes in. Desktop shows names; phones show portraits and wave numbers in one or two short rows. Taps pass through it to the field. | `src/quick-battle.js` (`A.defenceHud` wrapper), `#roster-preview` |
| Scout Runner | A fast, unarmed Rider sets off 4 m ahead of wave 1's column. Caught: 84 bonus alloy (the Rider's bounty x6) and "Scout Runner caught: bonus alloy!". Escaped: no lives lost, and a notice says so. | `src/sim/content/scout-runner.js` (onSpawn / onDeath hooks) |

## Acceptance numbers

| Check | Before | After | Limit |
|---|---|---|---|
| Time to first combat, Quick battle, test bot (60 matches: 5 factions x Riverlands / Classic / Dunes x attack at 12, 16, 20, 24) | plain Relaxed 1v1 skirmish: up to 229.8 s | **37.2 to 38.8 s** (Riverlands 38.3 to 38.8 s) | 45 s |
| Quick battle bot wins | plain Relaxed 1v1: 175 / 180 in a wider sweep | **60 / 60**; also 180 / 180 in a wider sweep (5 player factions x 6 rival choices x 3 maps x 2 timings; first combat at most 39.3 s, median end 164 s) | every match |
| Quick battle at Normal speed (not shipped, for the record) | | 174 / 180 (the losses are Wardens or Ashfall games running past 700 s) | |
| Time to first combat, Defence level 1, Defence bot | designed level: 30.4 / 30.7 / 30.7 s (Story / Standard / Veteran) | First watch: **30.1 s** on every difficulty | 60 s |
| First watch with the Defence bot | 3 / 3 / 3 stars, 20 / 20 / 18 lives | 3 / 3 / 3 stars, 20 / 20 / 20 lives, runner caught on all three (+84 alloy) | target stars |
| One-tap start at 390x844 | n/a | `#quick-battle` at y 356 to 402, on screen with nothing to open first, 358x46 px; one tap starts the match | |
| Quick battle in the browser (held clock, stepped) | | first combat 38.55 s at 1440x900, 390x844 and 844x390 | 45 s |
| `npm test` | 1075 tests | **1079** tests, 1051 pass, 28 skipped, 0 fail | +4 |
| Render budget `battle-eco` / `defence-wave-eco` draws | 107 / 111 | 107 / 111 | 120 |
| Bundle (index JS / CSS, gzip) | | 329.4 KB / 43.0 KB; new source: JS 6.7 KB, CSS 2.4 KB gzip | |

The bot rows: `npm run test:quick-battle-check` (deterministic, about 50 s).

## Pins and baselines

- **No existing pin moved.** The idle fingerprint, the 14 mission checksums (`tests/wings.test.js`), every `tests/golden-*.test.js` pin and `content-seams` pass unchanged.
- `npm run baselines:diff -- --full`: **all 8 baselines identical** (missions story / standard / veteran / standard-mercy / standard-firm, chronicles, defence, bench-classic).
- `npm run check:defence`: **PASS**, rows unchanged (the designed levels are untouched).
- **New pins** (`tests/golden-r3q.test.js`): Quick battle `{ 20: "f4a9bba2", 60: "6b227e40" }` (and a save at 20 s plays on to the same 60 s hash), First watch with the Defence bot `{ 60: "ceb63cce" }`.
- Why no pin can move: the Quick battle code runs only under `rules.quick` (an AI rule that returns at once otherwise), and the Scout Runner hooks return at once unless the level's `defence` block has a `runner`, which only the new variant has. No step hook was added: `tests/content-seams.test.js` (H4) expects the shipped content to have none, so the Quick battle moments run as an AI rule of the rival and the runner rides the spawn and death hooks.

## Screenshots (`q/`)

All at 1440x900 (desktop), 390x844 (portrait) and 844x390 (landscape):

- `before-title-*.jpg` / `after-title-*.jpg`: the title without and with Quick battle.
- `after-quick-start-*.jpg`: the ready outpost at 0:01. `after-quick-fight-*.jpg`: the scouts at the tower at about 0:40.
- `after-roster-*.jpg`: First watch, the enemy roster strip before wave 1. `after-runner-*.jpg`: wave 1 under way, the strip gone.

## Tests

- **Unit (+4):** `tests/quick-battle.test.js` (2: the setup and the rule that is never stored, the outpost, scouts and a first fight by 45 s with nobody playing; the First watch data, roster, a runner that escapes for free and is caught for 84 alloy, the strings in vi and ko, the CSS text sizes and no system-ui) and `tests/golden-r3q.test.js` (2 pins).
- **Browser suite** `tests/quick-battle.mjs` (`npm run test:quick-battle`), three viewports: Quick battle on screen and reached at its centre, 44 px, 11 px text, no sideways scroll; one tap starts Riverlands / Relaxed / Ashfall with `{ quick: "on" }` while the stored rules stay `{ roster: "expanded" }`; first combat by 45 s; the ready tower and relay; New game returns the selects, rules and preview to the player's own; First watch roster strip (runner first), clear of the Defence bar and the wave intel, 11 px, gone once wave 1 is out with the runner. About 20 s.
- **No-browser check** `tests/quick-battle-check.mjs` (`npm run test:quick-battle-check`): the bot rows above.
- **CI matrix** entry `r3-q`: `quick-battle quick-battle-check`.
- **Suites green on 4237:** quick-battle, cover-ui (all five viewports, the nothing-hidden check), title, ui-quality, layout-f, phones, mobile, campaign, defence, defence-onboarding; render budget `battle-eco` and `defence-wave-eco`.
- **`language` fails, and it fails the same with the Quick battle slot left hidden** (checked on this build): in landscape Campaign, Vietnamese, the menu's Full screen card label "Toàn màn hình" is reported as cut. Since the Wave 2 integration that label is visually hidden there (icon only, `cover.css`), and the suite's text check excludes only `.visually-hidden`. Pre-existing on `r3-wave-2-final`; see the seam requests.

## Test changes for the integrator

- `tests/cover-ui.mjs` (R3-M's): the slot is now shown, so the expected `state.slot` is `false` (one line, with a comment). Its unit test (`cover-ui.test.js`, the hidden slot in `shell.js`) is unchanged: the markup still ships hidden and `src/quick-battle.js` shows it when it fills it.

## Seam requests

1. **`tests/language.mjs` (not mine), pre-existing failure:** add `#fullscreen > span` (or give the landscape campaign label the `visually-hidden` class in `cover.css`) to the excluded selectors in `layout()`, since that label is hidden on purpose since the Wave 2 integration.
2. **Optional, R3-U (audio):** a distinct sting for the `incoming` event with `quick: true` (the scouts) and for `runner` events (`phase: "out" | "caught"`).
3. **Optional, R3-R (rank):** Quick battle wins could count for XP like any skirmish; the match is an ordinary skirmish with `rules.quick` set.

## Decisions taken (change any)

- Quick battle is Relaxed (owner: two rivals are already hard; the bot wins 180 / 180 at Relaxed and 174 / 180 at Normal).
- The rival is Ashfall (raiders, a vivid contrast), or Meridian for an Ashfall player; the map is Riverlands (the default battlefield).
- The tile is holo teal, not gold: the kit reserves gold for one primary action, and Start keeps it.
- On landscape phones Quick battle shares the pinned launch row with Start (1/4 and 3/4), so every battle setting still shows on the first screen (R3-M's layout); in landscape Campaign, whose column is narrow, it stays above the modes.
- The Scout Runner runs with wave 1 (not before it), so it needs no per-tick hook.

## Files

- New: `src/quick-battle.js`, `src/quick-battle.css`, `src/sim/content/quick-battle.js`, `src/sim/content/scout-runner.js`, `src/defence/first-watch.js`, `tests/quick-battle.test.js`, `tests/golden-r3q.test.js`, `tests/quick-battle.mjs`, `tests/quick-battle-check.mjs`, this file and `q/`.
- Changed: `src/main.js` (one import and the `quick-battle` entry at the end of SETUP and BIND), `tests/cover-ui.mjs` (one expected value).
- Appended: `src/sim/content/index.js`, `src/app/debug-hooks.js` (`quick` getter), `src/locales/vi.json` and `src/locales/ko.json` (11 strings each), `package.json` (2 scripts), `.github/workflows/pages.yml` (`r3-q`), `docs/CHANGELOG.md`.
- Not touched: `src/app/screens.js` (the state machine needed no new screen: Quick battle is a skirmish started through Start's own handler), `src/start-screen.css` (the tile's styles live in the new `quick-battle.css`).
