# R3-R: Commander rank and unlocks (results)

Branch `r3/r-rank` from `r3-wave-2-final`, worktree `C:\Users\n\source\repos\3d_astra-r3-r`, port 4234.
Plan: `docs/aaa/AAA_ROUND3_PLAN.md`, Wave 3, R3-R. Status: **done**. Meta and cosmetic only: no file under `src/sim/`, no `simulation.js`, `snapshot.js`, `balance.json`, mission, Defence level, wave or battle rule was touched.

## What the player gets

| Item | What it does | Where |
|---|---|---|
| **XP from every match** | 25 for playing, 75 for a win (Training finished counts), +25 for a Veteran win, medal 20 / 35 / 50 (bronze / silver / gold), 20 per Defence star, 5 per wave held in Endless and the Daily seed (up to 50 waves), 1 per 2 kills (up to 25), +60 for a Daily order met (once a day); at most 400 a match. A Standard skirmish win (105 with 10 kills) is the first rank up. | `src/profile-rank.js` `xpForMatch` |
| **20 ranks** | Recruit, Private, Lance Corporal, Corporal, Sergeant, Staff Sergeant, Warrant Officer, Ensign, Second Lieutenant, Lieutenant, Captain, Major, Lieutenant Colonel, Colonel, Brigadier, Major General, Lieutenant General, General, Marshal, Frontier Marshal. XP to reach rank r: 25·(r−1)·(r+2): 100, 250, 450, 700 … 2,700 at rank 10, 10,450 at rank 20 (about 80 to 100 matches). | `RANKS`, `xpForRank` |
| **One unlock per rank from 2** | 2 Sand paint · 3 Spearhead emblem · 4 Vanguard banner · 5 Iron line order · 6 Arctic paint · 7 Wings emblem · 8 Pathfinder banner · 9 Swift order · 10 Ember paint · 11 Star emblem · 12 Iron Marshal banner · 13 Lean order · 14 Jungle paint · 15 Crown emblem · 16 Frontier Legend banner · 17 Hunter order · 18 Night paint · 19 Phoenix emblem · 20 Gold paint and Hero of the Meridian banner. Defaults from rank 1: Factory paint, Meridian ring, Field Commander, no order. | `ITEMS` |
| **Paint schemes** | A tint multiplied into every part of the player's own units (team 0, `kind === "unit"`) through `part.userData.tint`, which the entity batches copy into `instanceColor`. Enemies and buildings keep their colours. Factory sets nothing (the frame is exactly as before). A new pick repaints the units on the field; hit flashes keep the paint as their base. All modes (Skirmish, missions, Defence, Training). | `RankPaintView` (view plugin, appended to `src/view-plugins.js`) |
| **Emblems, title banners** | The emblem sits on the title chip and the results toast; the banner is the line under the rank on the chip, and colours its edge (coral Vanguard, green Pathfinder, steel Iron Marshal, amber Frontier Legend, gold Hero of the Meridian). | `src/rank-ui.js`, `src/rank.css` |
| **Daily orders** (the brief's "Daily modifiers") | A pledge judged from the match counters after a win, for bonus XP: Iron line (lose 5 units or fewer), Swift (win within 12 minutes), Lean (build 6 structures or fewer), Hunter (40 kills or more). The first win that meets it each local day pays +60. It never changes the battle: a modifier that changed the Daily seed's waves would move the sim, so the choice widens how you play it, not what you face. | `PLEDGE_MET`, `recordMatch` |
| **Rank chip on the title** | In the setup panel under the "Command uplink" strip: emblem, `RANK n` and the name, the banner, the XP bar and `xp / next XP`. A status, not a control (no tap needed). | `#rank-chip` |
| **Commander rank rows (Skirmish setup)** | After Battle rules: Paint (swatch), Emblem (glyph), Title banner and Daily order, each item its own 44 px button (one tap, `aria-pressed`), plus the next locked item of each kind as a dashed, readable teaser with "Rank n" (the kit's disabled look). Items further away are not shown until they are next, so nothing is tucked behind a menu. The Daily order row's help line names the picked order's condition. | `#rank-unlocks` |
| **Rank toast** | On every results screen (Skirmish, mission debrief, Defence result and score, Training), above the result actions: "Commander XP" or, on a rank up, a gold "Rank up!", the rank and name, `+n XP`, the bar, "Daily order met" when it was, and "Unlocked:" with each item (swatch or glyph, "Paint · Sand") and "Pick it in the Skirmish setup." Slides in (none with reduced motion). | R3-V's `onMatchEnd`, `summary.root` |
| **Profile** | `localStorage["frontier-command.rank.v1"]`: `{ xp, matches, picks, pledgeDay }`, read and written in try/catch; bad data and locked picks fall back to the defaults; blocked storage keeps the rank for the visit. | `loadProfile`, `saveProfile`, `normalizeProfile` |
| **Strings** | 59 messages and 6 patterns appended to `vi.json` and `ko.json` in the same order (rank names, items, rows, toast; "Rank 10" to "Rank 20", XP lines, "Unlocks at rank n"). The Korean font subset was re-cut (`tools/subset-korean-font.py`). Vietnamese keeps "XP"; Korean reads 경험치. | `src/locales/*.json`, `src/fonts/noto-sans-kr-*` |

## Acceptance numbers

| Check | Result |
|---|---|
| Unit test of the XP formula and the rest (`tests/rank.test.js`, 6 tests, < 0.1 s) | PASS |
| `npm test` | 1075 → **1081 tests** (+6), 1053 pass, 28 skipped, **0 fail**, 42 s |
| `tests/rank.mjs` (matrix `r3-r`) at 1440x900, 390x844, 844x390 | **PASS** (18 to 25 s for all three on 4234): fresh profile rank 1, Factory picked and Sand locked; scripted win shows "Rank up! · Rank 2 · Private · +100 XP · Unlocked: Paint · Sand" above the result actions; back on the title rank 2 and Sand picked in one tap (centre of the button reaches it); next match: every player unit wears Sand, no enemy unit is painted, `sim.rules` is null; reload keeps rank 2 and Sand; no page errors |
| Text ≥ 11 px, taps ≥ 44 px, no sideways scroll, nothing grouped | 0 / 0 / 0 on the chip, the pickers and the toast at all three viewports; the results card still fits the screen |
| Pins | idle fingerprint `d071360b`, the 14 mission checksums and every `golden-*` pin identical (all in `npm test`). No pin moved. |
| No sim reach | no file of this package imports `rules-store`, `rule-options`, `src/sim/` or `simulation.js` (checked in `rank.test.js`); `RULE_OPTIONS` unchanged; match rules stay null after picks (browser suite) |
| `baselines:diff` | not run: no tool, `src/sim/`, `simulation.js` or `snapshot.js` imports any file of this package, and nothing in the sim path changed (as R3-V's argument) |
| Draws with paint (desktop, Riverlands start, held frame) | Factory, Sand, Arctic, Ember, Jungle, Night, Gold: **142 draws, 117,640 triangles each** (identical) |
| Render budget `battle-eco` (RTX 4080 SUPER, Eco) | **PASS**: 107 draws, 0 shadow, 0 buffer uploads, `noGrowth` batches [97, 101, 101] (as wave 2) |
| Bundle (vite build, gzip) | index JS 979.97 / 326.76 KB → 991.13 / 331.28 KB (+4.5 KB gzip, incl. the 59 vi and ko strings); index CSS 218.86 / 42.03 → 224.35 / 43.15 KB (+1.1 KB). Korean font subset 92,348 → 92,548 bytes. Before = `r3-wave-2-final` built in `.tmp/base` |
| Browser suites on 4234 after the change | rank, cover-ui (nothing-hidden check, 5 viewports), title, ui-quality, layout-f, ceremony, workshops, army-depth, phones, language-ko: **PASS** |
| `language` suite | FAIL on "landscape mission list: Toàn màn hình cut" — **pre-existing**: the same failure on the `r3-wave-2-final` build served on 4234 (Full screen button in the phone landscape Campaign column). Not this package; reported to the integrator below. |

## Screenshots (`r/`)

- Title chip: `title-desktop.png`, `title-portrait.png`, `title-landscape.png` (fresh profile, rank 1).
- Commander rank rows, fresh: `setup-fresh-portrait.png`, `setup-fresh-landscape.png`; after the rank up with Sand picked: `setup-sand-{desktop,portrait,landscape}.png`.
- Rank toast on a Skirmish win (rank up, "Unlocked: Paint · Sand"): `toast-{desktop,portrait,landscape}.png`.
- Paint on the field: `match-sand-desktop.png`, and the contact sheet `paint-schemes.png` (the same squad at 2x in all seven schemes; before = Factory).

## Decisions taken (change any)

- **Daily modifiers are Daily orders (pledges for XP)**, not rule changes to the Daily seed: the owner rule "purely cosmetic, no strength" and "pickers never reach options.rules/sim" leave a pledge as the only choice-widening item that moves no pin. A real modifier (for example "double waves") would be a Defence rule and a new pin.
- **The pickers live in the Skirmish setup** (the brief), but the picks apply everywhere: your paint is worn in missions, Defence and Training too.
- **Only the next locked item of each kind is shown** (dashed, with its rank), not all nineteen locked items: all of them would add about eight rows of disabled buttons on a phone. Every unlocked item is always its own button.
- **The paint tints the whole unit**, not only its team-coloured parts: `instanceColor` multiplies every part, which reads as a camouflage scheme and keeps the team colour readable on the trim.
- **XP numbers**: a win is worth about four losses; Veteran adds 25; medals and Defence stars reward quality; kills are capped low so long matches do not farm. Rank 2 comes after one win, rank 5 after about six, rank 20 after roughly 80 to 100 matches.
- **No sound on a rank up**: R3-U owns the audio files this wave; a rank-up sting can be added in `rank-ui.js` `matchEnded` once its stinger exists (one line, see seam requests).

## Seam requests

None needed for the acceptance. For the integrator:
1. **`main.js`** (shared, one line each, appended): the `setupRank` import, `["rank", setupRank]` at the end of SETUP and `"rank"` at the end of BIND. If another Wave 3 package also appends there, keep both.
2. **Korean font subset**: R3-R re-cut `src/fonts/noto-sans-kr-subset.woff2` and `noto-sans-kr-chars.txt`. Other Wave 3 packages that add Korean text will do the same: after the merge, re-run `python tools/subset-korean-font.py <NotoSansKR[wght].ttf>` once on the merged `ko.json` (the source font is `ofl/notosanskr` in google/fonts) instead of picking one binary.
3. **R3-U (audio)**: an optional rank-up sting; `rank-ui.js` `matchEnded` knows `record.rankUp` (one line, after the toast is added).
4. **R3-Q (title)**: the chip is inserted after `.setup-head` in `.briefing-setup` (before `#title-actions`); a Quick battle button there sits below it. No file of R3-Q is touched.
5. **Pre-existing, not R3-R**: `tests/language.mjs` fails at 844x390 on the Campaign list ("Toàn màn hình" cut in the Full screen button) on the `r3-wave-2-final` build too.

## Test changes for the integrator

- New: `tests/rank.test.js` (6 tests), `tests/rank.mjs`, script `test:rank`, matrix entry `r3-r` in `.github/workflows/pages.yml`, a "Commander rank" section in `docs/TESTING.md`.
- `window.__frontier` gained `rank()` and `rankPick(kind, id)` (appended in `debug-hooks.js`).
- Every results screen now carries a `.rank-toast` (above `.result-actions` / `.debrief-actions`); the existing suites that read results (ceremony, layout-f, phones, ui-quality) pass with it.
- The title setup panel has `#rank-chip`, and `#skirmish-setup` ends with `#rank-unlocks` (`.rule-rows` look, own id; `#battle-rules` is unchanged).
- No existing test was edited.

## Files

New: `src/profile-rank.js` (pure: XP, ranks, items, profile, the paint view plugin), `src/rank-ui.js` (chip, pickers, toast), `src/rank.css`, `tests/rank.test.js` (6 tests), `tests/rank.mjs` (browser suite), this file and `r/`.
Edited (one line each, appended): `src/main.js` (import, `["rank", setupRank]` in SETUP, `"rank"` at the end of BIND), `src/view-plugins.js` (import and `RankPaintView` at the end of the registry), `src/app/debug-hooks.js` (`rank()`, `rankPick()`).
Appended: `src/locales/vi.json`, `src/locales/ko.json`, `package.json` (`test:rank`), `.github/workflows/pages.yml` (matrix `r3-r`), `docs/CHANGELOG.md`, `docs/TESTING.md`.
Regenerated: `src/fonts/noto-sans-kr-subset.woff2`, `src/fonts/noto-sans-kr-chars.txt`.
Not touched: `src/app/briefing.js`, `src/app/screens.js`, `src/start-screen.css`, `src/cover.css`, `src/ceremony*.js`, `src/app/match-flow.js`, `src/results-ui.js`, `src/rule-options.css`, any sim file.
