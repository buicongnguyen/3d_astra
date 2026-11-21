# R3-M results: cover and menus, a war across several worlds

Branch `r3/m-cover-ui`, base `r3-base`. UI only: no sim, balance, mission, pin or baseline change.

## What changed

- **Painted cover (owner decision).** Codex's original key art replaced the first Blender backdrop. Three flat covers sit in `src/art/cover/`, one per frame shape, and `<picture>` fetches only the matching one. Sixteen parallax layers rebuild the flat cover. They load lazily, after the game's models are in and the browser is idle, then cross-fade in. The placement table from the art's README is in `src/app/cover-layers.js`.
- **Live layers** (`src/app/cover.js`):
  - pointer parallax on desktop and a slow drift on touch, at the README's amplitudes;
  - aircraft drift and bob, and the Ranger's muzzle flash fires a double shot every 3.6 s;
  - the star layer twinkles;
  - one Canvas 2D layer (≤ 1.5× density, 30 fps on touch) draws ship streaks, battle flashes on the worlds, lightning on the storm world and the horizon, and a faint sensor sweep.
  - Nothing runs during a match, in a hidden tab or with the menu closed.
  - **Calm** (reduced motion, or "Animate combat effects" off) keeps the flat cover, draws one still frame and never fetches the layers. Eco quality alone keeps the cover live, because phones default to Eco.
  - Phones in portrait: the setup sheet covers the lower half of the cover, so the assembly lifts the squad to stand above the sheet.
- **Logo.** The SVG wordmark is chrome-gold FRONTIER with a horizon line, holo-teal COMMAND, a teal halo and a light sweep (paused when calm). Under it is the subtitle "War for the Meridian Frontier" (translated). It sits in the art's reserved title area.
- **Holo theme.** The tokens are the "Holo theme" block at the end of `ui-theme.css`; the rules are in `src/cover.css`. It gives glass panels, glowing edges and corner brackets. Mode cards are teal and turn gold when chosen, with a hover sheen, a warm hover glow and a press state. Start is gold with a periodic sweep. Field labels and mission numbers are gold.
  - The same theme covers the briefing card, the skirmish and Defence setup, the campaign map frame (whose board sits on the painted nebula), Settings and the loading screen.
  - Desktop puts the briefing card and the setup in a left column, because the cover keeps its squad on the right.
  - Landscape phones put the setup on the left and the art and logo on the right.
  - A header strip ("Command uplink · Sector 07") and planet tags give the flavour. The tags step aside for the logo, the panels, other worlds and the squad.
- **Loading.**
  - The first load is a loading screen: a planet in a progress ring over the dimmed painted cover, with the byte-true percent and the part being fetched. It mirrors Start's own progress and does not block taps.
  - Later roster loads turn Start into a gold progress bar.
  - The `index.html` boot splash now uses the same planet style.
- **Sound.** Soft hover and confirm blips on the mode cards and Start use the existing `A.tone`, so mute and volume apply.
- **Quick battle seam for R3-Q.** `<div id="title-actions" class="title-actions" hidden>` sits above the mode cards in the setup panel. To use it, add a `.primary` button and remove `hidden`; the layout already styles it.
- **Owner rule: nothing tidied away.** No control was grouped into a sub-menu, drawer, "More…" button or hidden tab. `tests/cover-ui.mjs` checks this at all five viewports against `tests/fixtures/r3-base-menu-controls.json`, recorded from the r3-base build: every control the title menu, the skirmish setup and Settings showed on r3-base is still shown, and a click at its centre reaches it with nothing to open first. The only movement allowed is scrolling inside the setup column.

## Art provenance

- **Source:** `3d_astra/codex-cover-art/`, read-only, copied into `src/art/cover/`.
- **Origin:** original key art made for this game with OpenAI's built-in image generation (Codex) on 21 November 2026, following the Round 3 unit sheets.
- **Content:** no third-party art, logos or lettering. All text on screen is live HTML.
- **Changes:** one file was re-encoded: `layer-foreground-squad.webp`, 1536×1024 → 1280×853 at WebP q72 / alpha q75, **572,364 → 289,986 bytes**. Side-by-side crops held up. Every other file is byte-identical to the source.
- A credit and licence note is in `docs/ASSET_PIPELINE.md`, in the section "Title cover art".
- The first Blender backdrop (`tools/blender/render_cover_art.py`) was dropped and is not committed.

## Bytes

**Initial page (first paint) by viewport**

| Viewport | Key art before (r3-base) | Key art after |
|---|---|---|
| Desktop 1440×900, HD 1920×1080 | keyart.webp, 94,278 | keyart-desktop.webp, 344,670 |
| Landscape phone 844×390 | keyart.webp, 94,278 | keyart-landscape.webp, 252,838 |
| Portrait phone 390×844, tablet 768×1024 | keyart-960.webp, 47,296 | keyart-portrait.webp, 312,642 |

**JS and CSS, all viewports**

| File | Before (raw / gzip) | After (raw / gzip) |
|---|---|---|
| index CSS | 158.31 / 31.01 KB | 179.02 / 35.16 KB (+4.2 KB gzip) |
| index JS | 849.14 / 280.76 KB | 865.66 / 286.96 KB (+6.2 KB gzip) |

**Lazy downloads**

- Layers are fetched after the models are in and the browser is idle, and never when calm.
  - Desktop and landscape: 1,436,742 bytes (14 layers plus the wide nebula).
  - Portrait: 1,437,786 bytes (14 layers plus the tall nebula).
- The campaign board's nebula (106,116 bytes) is fetched only when Campaign opens. On desktop it is already cached by then.

## Fresh-reviewer scores

Each round used a new subagent that saw only the before and after screenshots. The criterion was "eye-catching / vivid / high-science multi-planet war", scored 1–10.

| Round | Before | After | Desktop | HD | Portrait | Landscape | Tablet |
|---|---|---|---|---|---|---|---|
| 1 (painted cover, first layout) | 4 | 6 | 7 | 7.5 | 6 | 5.5 | 6.5 |
| 2 (campaign grid fixed, loading over art) | 4 | 7 | 7 | 7.5 | 6.5 | 6 | 7.5 |
| 3 (tag placement, settings glow, nebula map) | 4 | 7 | 7 | 7.5 | 6.5 | 5.5 | 7 |
| 4 (final) | 4 | **7.5** | 7.5 | **8** | 6.5 | 5.5 | 7.5 |

**The target was 8 overall. It was not reached after four rounds**, so I stopped at the four-correction limit. The final reviewer's open points:

1. **Landscape phones are cramped.** The art is cropped beside the 300–400 px setup column, and only Battlefield shows above Start. The base layout has the same column.
2. **Portrait is thin.** The lifted squad sits right of centre and partly under the heading.
3. **The art shows through the translucent left column** on desktop and HD.
4. **There is no visible enemy fire** in the art. A balloon in space feels off-tone. Asking for more war (enemy, beams, explosions) means asking Codex for more layers.
5. **Settings content is still mostly the old slate.** Only the frame, header, tabs, previews and backdrop changed.

## Tests

- **Unit tests (+3):** `tests/cover-ui.test.js` covers the art budget per frame, the squad re-encode, the picture sources, the Quick-battle slot, lazy-only layer URLs, the layer table order and registration, the world-to-label mapping, 11 px text, no system-ui, calm-gated animations and the vi strings. `npm test`: 964 tests, 938 pass, 0 fail, 26 skipped (r3-base: 961).
- **Browser suite `tests/cover-ui.mjs`** (`npm run test:cover-ui`, pages.yml matrix entry `r3-m`, runs cover-ui and title) checks, at desktop, portrait, landscape, HD and tablet:
  - the loading screen;
  - exactly one flat cover request, and the right one;
  - 15 layer requests, all after the models;
  - the live layer draws;
  - tags clear of the logo, panel and heading;
  - 11 px text, 44 px taps, no sideways scroll;
  - the nothing-hidden check above;
  - the campaign frame;
  - Settings in the holo theme;
  - calm mode: no layer downloads, a still canvas, no running animations.
- **Green on port 4232 (final build):** cover-ui, title, ui-quality, choices, campaign, language, mobile, phones. Also green on the previous build: new-game, progression, fullscreen, improvements, offline.
- **Pins and baselines:** none moved. No sim file was touched, and no `golden-*`, `wings` or `baselines` input changed.

## Seam requests

1. **`src/app/frame.js`, line 190.** The desktop start screen is now fully covered by the opaque cover, but the hidden battlefield is still redrawn every frame (only phones use the 2 Hz "covered" redraw). Proposed change: drop the `compact-ui` condition, so the covered redraw applies whenever `in-briefing` is set. This saves GPU on the desktop menu.
2. **Defence sub-tab subtitles** (`defence-menu.css`, "Ten waves, s…") and the **campaign chronicle cards** (`campaign-map-ui.js`, wrapping "Clear Three-Way Dunes to unlock") truncate or wrap at desktop widths. The fresh reviewers flagged both. They are owned elsewhere.
3. **For R3-Q:** use `#title-actions` (above).

## Files

- New: `src/app/cover.js`, `src/app/cover-layers.js`, `src/cover.css`, `src/art/cover/*` (19 files), `tests/cover-ui.test.js`, `tests/cover-ui.mjs`, `tests/fixtures/r3-base-menu-controls.json`, and this file with `m/` (before and after JPEGs, 6 screens × 5 viewports).
- Changed:
  - `src/app/shell.js`: picture, logo subtitle, setup header, R3-Q slot.
  - `src/main.js`: import plus one `setupCover(A, S)` line.
  - `src/art/wordmark.svg`.
  - `src/ui-theme.css`: Holo theme tokens appended.
  - `index.html`: boot splash and theme colour.
  - `src/locales/vi.json`: 8 strings appended.
  - `package.json`: one script.
  - `.github/workflows/pages.yml`: `r3-m` entry.
  - `docs/CHANGELOG.md`: R3-M subsection.
  - `docs/ASSET_PIPELINE.md`: new section.
- The old `src/art/keyart.webp` and `keyart-960.webp` are no longer imported. They are left in place because `render_ui_art.py` (R3-F's area) still writes them.

## Integration on feat/aaa-round3 (after r3-wave-1)

Merged `r3/m-cover-ui` (dd82653) into `feat/aaa-round3` at fd2f215. Conflicts were all unions: `docs/CHANGELOG.md`, `docs/ASSET_PIPELINE.md`, `src/locales/vi.json`, `package.json` scripts and the `pages.yml` matrix (the `r3-m` entry joins r3-d/e/b/c/a). R3-M touched none of `app/selection.js`, `mobile.css` or `landscape-hud.css`, so R3-B's phone group strip stays removed (owner decision 83848d4) and none of its strings came back.

### Seam requests, applied

1. **Covered redraw on desktop too** (`src/app/frame.js`): the start screen is opaque on every frame shape, so the hidden battlefield is redrawn twice a second whenever `in-briefing` is set (the `compact-ui` condition is gone). Models and shaders stay warm for Start; nothing visible changes.
2. **Defence sub-tabs** (`defence-menu.css`): notes wrap to two lines at most instead of cutting ("Ten waves, s…"); desktop and portrait phones show the four ways to play as two rows of two, so every note fits one line.
3. **Chronicle cards** (`chronicles.css`): on desktop the card's words join its grid, so the lock line runs the full card width (two lines, was three or four); the endings stack so the four cards get the footer's width. Tablets in portrait get the same labelled cards on their own row, with a taller campaign hero so the map keeps its height.
4. **`#title-actions`** is in place for R3-Q (hidden, styled; unchanged).

### Polish (integration rounds; `src/cover.css`, `src/app/cover.js`)

- **Landscape phones.** The setup column is wider (64vw) and is one four-column grid. The four modes sit in one row. Below them are Battlefield, Rivals and AI speed, then both factions, then AI teams with Full screen, and Start. Every battle setting and Start are on the first screen; before, only Battlefield showed above Start. The battle rules follow under the pinned Start (scroll). The logo is smaller.
- **Settings in landscape.** The heading, tabs, language and close share one top row, which gives the tab body its height back.
- **Portrait phones.** The hero is shorter, with a slimmer logo and no eyebrow over the art. The lifted squad steps toward the centre, grows 10%, and never rises over the logo. The flavour strip gives its line to the form, the mode cards are slimmer, and Rivals, AI speed and both factions now show above Start.
- **Tablet.** The hero is shorter and the cards and gaps tighter, so all six selects show above Start.
- **Readability.** The left column glass is denser (0.9–0.95), so the art no longer shows through the text. A soft fade sits above the pinned Start on desktop. A locked AI teams select reads as locked.
- **Holo theme carried through.** The settings rows are glass strips with a teal edge, holo switches and selects, holo tabs, close button and footer buttons. The Defence sub-tabs and R3-C's battle-rule rows use the same tiles (teal, gold when chosen).
- **Owner rules.** No control was grouped or moved behind anything; `tests/cover-ui.mjs` still checks every r3-base control at five viewports.

### Fresh-reviewer scores (integration)

Each round used a new reviewer subagent that saw only the before (merge commit) and after screenshots. Screens: title, Defence, campaign and settings. Shots: `m/integrated-before-*` and `m/integrated-after-*`.

| Round | Desktop | HD | Tablet | Portrait | Landscape |
|---|---|---|---|---|---|
| Before (merged R3-M) | 7–7.5 | 7–7.5 | 6.5–7 | 5–6.5 | 4–6 |
| 1 | 7.5 | 7.5 | 7 | 6 | 7.5 |
| 2 | 8 | 8 | 8 | 7 | 6.5 (campaign cards regressed, fixed in 3) |
| 3 | 7.5 | 8 | 7.5 | 7 | 7.5 |
| 4 (final) | **8** | **8** | **8** | 7 | 7 |

The four-correction limit was reached. **Portrait and landscape phones stay at 7.** The final reviewer's open points:

- **Portrait campaign:** the map, endings and chronicles leave one mission row above Start, and the endings and chronicles show without labels. This is the compact campaign map's own layout (`campaign-map.css`), not the cover.
- **Landscape campaign:** the mode tabs drop their icons to fit the narrow column beside the map (they are 44 px tall). Endings and chronicles show without labels.
- **Desktop:** the AI teams label peeks under Start's fade. The battle rules are below the fold in the scrolling column, as on r3-base.
- **Tablet:** the hero art is tight under the headline.

### Tests (integration, preview build on port 4238)

- `npm test`: 1027 tests, 1000 pass, 0 fail, 27 skipped.
- Browser suites, green: cover-ui (all five viewports, including the nothing-hidden check against `r3-base-menu-controls.json`), ui-quality, title, campaign difficulty, choices, phones, mobile, language, army-depth, defence-onboarding and squad-orders. One fix came from ui-quality: the landscape mode buttons were raised from 44 to 46 px, because the press animation scales a card to 98.5%.
- `test:golden-full` was not run, because no sim, balance, mission or pin file changed. `frame.js` changes only how often the hidden menu backdrop is drawn.
