# R3 map pass: the painted campaign map

Branch `r3/map-campaign`, base `feat/aaa-round3` at 9d0b706 (Wave 2: R3-G map, R3-H's m11d, one-row phone command bar). View and UI only: no sim, mission, balance, pin or baseline change. Port 4234.

## What changed

- **Art.** The owner-commissioned painting (Codex/OpenAI ImageGen) from `3d_astra/codex-campaign-map/` is in `src/art/campaign/`, byte-identical:
  - `campaign-map-wide.webp`, 2560×1440, 592,264 bytes: desktop, tablets and phones in portrait;
  - `campaign-map-strip.webp`, 2560×900, 491,376 bytes: landscape phones.
  - The credit is in `docs/ASSET_PIPELINE.md` under "Campaign map art", next to the cover art's.
- **Anchors from a table.** `MAP_ANCHORS` in `src/story/campaign-map.js` holds the README's 17 anchors for each painting. Each row is keyed by mission id and also gives the side its name plate takes.
  - `mapNodes(missions, art)` reads the table. `mapLayout` stays the fallback for any future mission that has no anchor.
  - `MAP_NODES` (wide) and `STRIP_NODES` are built from it.
  - The older unit tests still pass on the anchors as they are: act bands, 15% spacing, Act 2 running west, nodes inside 10–90%.
- **One layer, scaled together.** `.cmap-layer` holds the painting, the route SVG and the relays, and covers the board like `object-fit: cover`. Anchors are percentages of that layer.
  - Desktop and portrait boards are locked to the painting's shape.
  - Wide desktop frames may be up to 12% wider than the painting, and landscape phone boards up to 10% taller. The layer then trims a few pixels instead of leaving dark bands.
- **Pins.**
  - Won relays show their medal colour with a gold rim.
  - The next mission is a cyan beacon whose ring breathes outward. It uses transform and opacity only, and holds still under reduced motion or motion-off.
  - The picked mission is larger, with a gold ring and halo, and draws over its neighbours.
  - Locked relays are dim glass with a light dashed rim.
  - Defence missions stay square.
  - R3-G's decision diamonds, answered marks, ending hints, merciful counter and chronicles are unchanged.
  - Every pin is a 44 px button.
  - On boards under 700 px the pins are drawn smaller (27 px, locked 23 px) so the painting shows between them. The tap area stays 44 px.
- **Route.** One smooth SVG curve runs along the zigzag (Catmull-Rom).
  - Walked legs are solid gold, the leg to the next mission is a cyan dash, and the rest is a faint survey dash.
  - Each leg sits over a soft glow and uses a non-scaling stroke.
- **Plates.**
  - **Mission names** are glass plates placed on the side the table picks. "A Debt in the Dunes" sits to the right, so the painting's calm top-left area keeps the Act 3 title. Plates near the board edges align to the pin's outer edge. Act 1 plates are capped at 17% of the board so they never meet, and longer (Vietnamese) names wrap to two lines.
  - **Act titles** are plates at the left of each act's band.
  - **Small boards** show only the picked and next plates. In Act 1 those sit above the pin; in Acts 2 and 3 they sit below.
- **Layout.**
  - **Desktop and HD.** The left command column matches the title screen. The map is large in the centre, with the decisions legend and "relays lit" in its header. Below it, the two endings and the four chronicle cards share one row, and the briefing is a glass panel: title and story on the left, rivals and objective on the right.
  - **Picked mission in the list.** The setup column scrolls the picked mission into view above the pinned Start. When it has to scroll down, it starts at that mission's act heading, so it never stops halfway through the mode cards.
  - **Tablets.** The map runs full width. The endings sit beside the chronicles (two by two), followed by the same briefing panel and the four modes in one compact row.
  - **Portrait phones.** The wide painting runs full bleed with the count chip on it and vertical act tags. The endings and chronicles row from R3-G follows. The four modes (Training too) share one row, icon over name.
  - **Landscape phones.** The strip panorama sits beside a narrower setup column (`clamp(300px, 37vw, 330px)`), which gives the board 522 px.
  - **Short portrait phones** (height up to 700 px) drop the footer, as R3-G did.
- **Fix.** On phones in portrait, opening Campaign scrolled the whole start screen, map included, out of view: `revealPick` found the screen's own scroll box. It now never scrolls a box that also holds the map.
- **Strings.** No new UI strings: the plates reuse the mission and act titles, and the head and footer reuse R3-G's words. There is no `ko.json` on the base. The landmark notes in `MAP_ANCHORS` are documentation and are not shown.

## Fresh-reviewer scores

Each round used a new subagent. It saw only the before and after screenshots, with the owner's criteria (AAA look, the map as hero, readable state and labels, phones show the map plus several missions above Start, the 11 px / 44 px rules). Each round was followed by one correction.

| Viewport | Before | Round 1 | Round 2 | Round 3 | Round 4 |
|---|---|---|---|---|---|
| Desktop 1440×900 | 6 | 7.5 | 8 | 7.5 | **8** |
| HD 1920×1080 | 6 | 8 | 8.5 | 8 | **8.5** |
| Tablet 1024×1366 | 5.5 | 7 | 7.5 | 7.5 | **7.5** |
| Portrait 390×844 | 3 | 6 | 7 | 6 | **6.5** |
| Landscape 844×390 | 5 | 6.5 | 7 | 6.5 | **7** |
| Small 320×568 | 3 | 5 | 6 | 5 | **5.5** |

The corrections:

1. The picked mission is revealed in the list on desktop too. Wide frames are covered instead of banded. Phone plates are placed by act. Four modes share one row on phones and tablets. Tablets get the briefing panel.
2. A stronger picked pin, drawn over its neighbours. More room for the endings. Plates sit clear of the decision marks.
3. The column starts at the act heading. Phone pins are smaller. The square Defence relay is crisper. The briefing columns size to their content.
4. Brighter locked pins and survey dashes. A margin above the act heading. This last correction came after round 4 and was not re-scored. The screenshots in `map/` show it.

**The target of 8 everywhere was not reached.** Desktop and HD reach it. I stopped at the four-correction limit. The open points:

- **Small phones (320×568).** Two missions show above Start. The map, the four modes and the act heading take the first screen. The reviewers want a shorter map band or smaller pins again.
- **Portrait (390×844).** Five missions show above Start (three before), but the reviewers find the 218 px board crowded with 17 pins. Only the picked and next missions are named, and the picked plate can sit on a neighbouring pin. The list starts at Act 1 because the whole screen scrolls; revealing the picked row would scroll the map away.
- **Tablet.** About 3.5 missions show above Start. The endings and chronicles headings are hidden there, and the decisions legend shows only on desktop.
- **Landscape.** The board is about 194 px tall, so 17 pins dominate it. The endings and chronicles take about 40% of the right column.
- **Desktop.** The chronicle row is tight at 1440: "The Quiet Survey" wraps. The briefing panel leaves a gap on HD.
- **Why portrait phones use the wide painting, not the strip.** At 390 px the strip is 137 px tall. Relays #10 and #13 (and #8/#15, #6/#17) would be 34 px apart, under the 44 px rule `tests/story.mjs` enforces, and plates could not fit. The wide painting at full bleed (388×218) keeps every pair at least 44 px apart, down to 318 px wide. Both paintings share the same horizontal positions. The strip serves landscape phones, where its shape matches the board.

## Bytes and loading

| | Before | After |
|---|---|---|
| index JS (raw / gzip) | 976,499 / 325,083 | 978,681 / 326,006 (+0.9 KB gzip) |
| index CSS (raw / gzip) | 207,016 / 39,749 | 216,431 / 41,420 (+1.7 KB gzip) |
| Request when Campaign opens | `layer-nebula-wide.webp` (106 KB, the board's backdrop) | exactly one: `campaign-map-wide.webp` (592 KB) or, on landscape phones, `campaign-map-strip.webp` (491 KB) |
| On the title screen | — | nothing (no preload; the `<picture>` lives in the map's HTML, which is drawn only in Campaign) |

The cover's parallax layers still fetch their own nebula as before, because that is R3-M's cover. Checked at all six viewports: one campaign-map request per page, and the right file for each layout.

Performance: one image, two small SVGs (one hidden) and about 30 positioned elements. No script runs per frame. The one CSS animation is the next mission's beacon ring (transform and opacity), and it stops under reduced motion and motion-off.

## Tests

- `npm test`: 1065 tests, 1037 pass, 0 fail, 28 skipped (base: 1061 / 1033 / 0 / 28).
  - New `tests/campaign-map-art.test.js` (+4):
    - the anchors on both paintings, with README spot checks;
    - the `mapLayout` fallback;
    - 44 px between relays and pins inside the board, on the smallest boards each painting gets;
    - the art is byte-identical, imported only by the map, uses one `<picture>`, and the strip media query matches the CSS;
    - the CSS keeps 11 px text, no system-ui and a single calm-gated animation;
    - the nebula is gone from the board.
- **Browser suites, green on port 4234 (final build).** story, choices, openings, campaign, chronicles, cover-ui (nothing-hidden check), ui-quality, phones, mobile, language, title and defence.
  - `tests/story.mjs` still asserted 16 relays after R3-H's m11d made 17 and failed on the base too. It now counts relays from the mission list.
- **Pins and baselines.** Not touched. No sim, mission, balance, Defence or AI file changed.

## Files

- **New:**
  - `src/art/campaign/campaign-map-wide.webp`, `src/art/campaign/campaign-map-strip.webp`;
  - `tests/campaign-map-art.test.js`;
  - `map/campaign-<viewport>-before.jpg` and `-after.jpg` for `desktop`, `hd`, `tablet`, `portrait`, `landscape` and `small`.
  - The state shown is mid-campaign: 7 won, two decisions answered, mission 8 next.
- **Changed:**
  - `src/story/campaign-map.js` (anchor table, `mapNodes`);
  - `src/campaign-map-ui.js`;
  - `src/campaign-map.css`;
  - `src/app/briefing.js` (`revealPick`);
  - `src/cover.css` (the nebula rule removed from the board);
  - `tests/story.mjs`;
  - `docs/CHANGELOG.md`;
  - `docs/ASSET_PIPELINE.md`.
