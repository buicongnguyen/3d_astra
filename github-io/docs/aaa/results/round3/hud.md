# Round 3: phone battle HUD tidy pass

Owner request (21 November 2026): "On phone make the control area, buttons and text tidy and neat, so that we have a clear area for the scene." The look follows Codex's command console UI kit (`3d_astra/codex-ui-kit/`, owner-commissioned).

Branch `r3/phone-hud`, based on `feat/aaa-round3` 9d0b706, with the latest `feat/aaa-round3` merged in (Korean, the campaign map, the copyright line).

Scope: the battle HUD on phones only. No change to the simulation, balance, missions, pins or baselines, and the desktop HUD is unchanged.

## Free battlefield, before and after

The free battlefield is the share of a point grid (20 × 40 in portrait, 40 × 20 in landscape) where `elementFromPoint` hits the battlefield canvas. It is the same measure as `tests/phones.mjs`.

The numbers come from `node tools/phone-hud-audit.mjs`, against a `vite preview` build. Before is base 9d0b706 (`hud/before/audit.json`); after is this branch with feat/aaa-round3 merged in (`hud/after/audit.json`).

- **Selections:**
  - Mixed group: up to eight of your own units of at least two types.
  - Building: the Command core. In Defence, it is a tower just built on the first pad.
- **Defence has no mixed group.** The commander is the only unit.
- **The mission is m01.**

| Viewport | Mode | Nothing | One unit | Mixed group | Building |
|---|---|---|---|---|---|
| 390×844 | skirmish | 67.9 → 84.6 (+16.8) | 58.5 → 74.0 (+15.5) | 47.3 → 66.6 (+19.4) | 49.5 → 64.0 (+14.5) |
| 390×844 | mission | 67.9 → 84.4 (+16.5) | 58.5 → 73.8 (+15.3) | 47.3 → 66.4 (+19.1) | 49.5 → 63.7 (+14.2) |
| 390×844 | defence | 68.3 → 86.5 (+18.3) | 59.0 → 76.0 (+17.0) | n/a | 50.0 → 76.0 (+26.0) |
| 360×780 | skirmish | 65.6 → 82.5 (+16.9) | 54.0 → 69.4 (+15.4) | 42.8 → 62.0 (+19.3) | 45.0 → 59.4 (+14.4) |
| 360×780 | mission | 65.6 → 82.3 (+16.6) | 54.0 → 69.1 (+15.1) | 42.8 → 61.8 (+19.0) | 45.0 → 59.1 (+14.1) |
| 360×780 | defence | 67.8 → 85.9 (+18.1) | 54.0 → 70.8 (+16.8) | n/a | 45.3 → 70.8 (+25.5) |
| 844×390 | skirmish | 69.1 → 81.6 (+12.5) | 58.3 → 71.4 (+13.1) | 51.5 → 63.9 (+12.4) | 55.6 → 66.9 (+11.2) |
| 844×390 | mission | 69.1 → 81.6 (+12.5) | 58.3 → 71.4 (+13.1) | 51.5 → 63.9 (+12.4) | 59.6 → 71.3 (+11.6) |
| 844×390 | defence | 70.1 → 84.9 (+14.7) | 61.6 → 76.5 (+14.9) | n/a | 59.8 → 74.4 (+14.6) |
| 740×360 | skirmish | 67.3 → 79.6 (+12.4) | 55.3 → 68.3 (+13.0) | 48.3 → 60.4 (+12.1) | 52.3 → 63.4 (+11.1) |
| 740×360 | mission | 67.3 → 79.6 (+12.4) | 55.3 → 68.3 (+13.0) | 48.3 → 60.4 (+12.1) | 56.8 → 68.3 (+11.5) |
| 740×360 | defence | 65.3 → 79.6 (+14.4) | 56.5 → 70.8 (+14.3) | n/a | 54.8 → 68.8 (+14.0) |
| 320×568 | skirmish | 57.3 → 76.5 (+19.3) | 42.8 → 59.6 (+16.9) | 27.0 → 42.1 (+15.1) | 27.0 → 44.6 (+17.6) |
| 320×568 | mission | 57.3 → 76.1 (+18.9) | 42.8 → 59.3 (+16.5) | 27.0 → 41.8 (+14.7) | 27.0 → 44.3 (+17.3) |
| 320×568 | defence | 58.5 → 81.3 (+22.8) | 42.8 → 61.4 (+18.6) | n/a | 24.8 → 61.4 (+36.6) |

Every case gained at least 11 points, against the brief's target of 8.

The Korean and Vietnamese runs at 360×780, 844×390, 740×360 and 320×568 (Skirmish and Defence) give the same shares within 0.5 points. The fixed bands:

| Band | Before | After |
|---|---|---|
| Portrait top bar | 86 px | 45 px |
| Portrait mixed-group dock | 214 px | 165 px |
| Landscape one-unit card | 143 px | 125 px |
| Defence portrait tower card | 202 px | 113 px |

Every dock is the same height or shorter, and none grew. Screenshots: `hud/before/` and `hud/after/`, named `<viewport>-<mode>-<selection>.jpg`. Each folder also has an `-early` shot taken 2 s into play; the after folder adds `-mission-talk` shots of the radio line.

## What changed

All of the following is in `src/phone-hud.css`, scoped to `:root.compact-ui:not(.in-briefing)`, plus a few JS lines.

1. **Full-bleed battlefield.**
   - `#world` is fixed to the whole screen behind every bar.
   - The 12 px side margins and the bottom home-bar strip stay gesture margins. `touch-controls.js` (through `inEdge` in `input-pointer.js`) ignores touches that start inside them. Before, those strips were a dark frame where the canvas did not reach.
   - The camera frames the part between the bars, using `--view-cover-top` and `--view-cover`. These are now `calc()` values, so `view.js` resolves them through a hidden probe.
   - The "squashed window" fallback limit went from 0.6 to 0.7 of the height. On a 320×568 phone the bars cover 355 of 568 px.
   - Units look a little larger on phones (about 9% in portrait), because the framed part is taller.
2. **Top bar.** Two dark-glass panels, with the map showing between them.
   - **Left panel:** resources and the clock. **Right panel:** Full screen, Sound, Help and Pause.
   - **Logo:** not shown in a match. Mid-match it only opened the pause menu, and Pause sits beside it.
   - **Captions:** the ALLOY / ENERGY / POPULATION captions are gone. The icons and tooltips carry the same information.
   - **Portrait:** one 44 px row. Resources and the clock form a 2 × 2 block.
   - **320 px:** numbers are 13 px and the edges are 6 px. The population drops its "+15" queued part, so a five-digit alloy and "85 / 100" still fit beside four 44 px buttons. Its icon also stays hidden at 320, as before this pass.
   - **Landscape:** compact resource chips. From 840 px wide, the six touch buttons sit in the top band between the panels; the Objectives flag and the idle buttons take the corner under it. Narrower landscape phones keep the second row.
3. **Objectives in portrait.** The flag ends the tab row at the bottom, and its list opens above the tabs.
4. **Docks.**
   - **Portrait:**
     - A group's six orders sit in one row from 340 px wide (`--dock-orders` 0). Two-line labels are allowed, as the kit's type rules say.
     - A Defence tower on the Selection tab gets the short card. An empty `#queue` is hidden, and a queue present makes the card 157 px.
     - The stats in the unit card are spaced across the row.
   - **Landscape:** the unit card drops "Standing by" (it stays in the tooltip), and five orders sit 3 + 2 instead of 4 + 1.
5. **Kit look.**
   - **Tokens:** `src/ui-kit.css` holds the kit's colours, spacing scale, chamfers, frame images and type scale. Only custom properties live there, so the menus, modals and desktop pass can reuse them.
   - **Phone HUD:** chamfered dark-glass faces with the thin kit edge (SVG `border-image` + `clip-path`) on:
     - the top panels, touch row, tabs, flag and idle buttons;
     - the dock panels, order buttons and minimap;
     - the radio line, toasts and the Defence bar, intel chip and collapse button.
   - **States:**
     - Selected tabs and toggles get the cyan edge and a 2 px bottom rail.
     - Toasts get a 3 px rail: green normally, warning-red on alerts.
   - **Spacing:** one scale, a 3 px command gutter and 8 px edges. Rows of buttons let taps through their gaps.
   - **Toasts in landscape:** centred between the minimap and the dock. At 667 px they used to run over the minimap.
6. **Audit tool.** `tools/phone-hud-audit.mjs` measures five phone sizes × three modes × four selections. It reports the share, text under 11 px, clipped labels, taps under 44 px, overlapping HUD blocks, sideways scroll and band heights, and takes the screenshots. `--lang ko|vi` picks the language first. Every after case reports 0 issues in English and Korean. The only issue in Vietnamese is the "Pháo phòng không" production tile in the landscape dock, which ends in an ellipsis; that tile and the dock width are untouched by this pass.

### Owner rules

- **One tap:** every action is still one tap. Nothing went into a menu, drawer or "…".
- **Touch row:** it stays at the top (the owner's placement). The kit's mock-up puts it at the bottom right; that was not adopted.
- **Control groups:** no Ctrl+number group buttons on phones.
- **Text and taps:** text is at least 11 px and taps at least 44 px.
- **Layout:** no sideways scroll, and the safe-area insets are respected.
- **Fonts:** no system-ui fonts. The kit's font list is not used; the game's own font stacks stay.

## Tests

- **Unit tests:** `npm test` gives 1047 pass and 0 fail on the merged tree.
- **Browser suites:**
  - **Suites run against `vite preview` on port 4232:** phones, mobile, mobile-controls, mobile-gestures, mobile-construction, selection, hotkeys, ui-quality, readability, defence, defence-onboarding, tactics-ui, missions, cover-ui, language, language-ko, fullscreen, layout-f, ui-extras and status-layout. All of them pass on the final build. One step on the way: layout-f once failed with `landscape 2-campaign: spill: fullscreen 68>61` on the campaign start screen. That failure was not caused by this pass; the same merged tree failed the same way when built without `ui-kit.css` and `phone-hud.css`. feat/aaa-round3's f8ff598 fixed it in cover.css. After merging f8ff598 I re-ran npm test (1047 pass, 0 fail), layout-f, phones, missions and cover-ui, and all pass.
  - **Tests changed to follow the new layout.** No check was dropped.
    - `ui-quality` and `layout-f` press Pause instead of the logo on phones; ui-quality also asserts that phones show no logo in a match.
    - `status-layout` accepts the flag at the end of the tab row (portrait), or under the top band (landscape from 840 px).
    - `mobile-gestures` now checks the gesture margins in the input: touches starting at the left edge, the right edge or the bottom strip are not taken. It used to check that the canvas stopped 12 px short of the edges.
    - `mobile` starts the box drag 20 px in, the same screen position as before. The canvas used to start at 12 px.
    - `mobile-construction` reads the resolved `view.cover`.
    - `phones.mjs` floors rose from 67 / 57.5% to 78 / 68%.

## Review

A fresh reviewer (a subagent given only the screenshots, the kit and the rules) scored the first after set:

| Viewport | Before | After |
|---|---|---|
| 390×844 | 5 | 7.5 |
| 360×780 | 4.5 | 7 |
| 844×390 | 5.5 | 7.5 |
| 740×360 | 5 | 6.5 |
| 320×568 | 3.5 | 5.5 |

The target of 8 was **not** reached. One correction round followed:

- the unit card's HP / Shield / ATK no longer run together at 320 px;
- the Defence next-wave chip and the dock collapse button now wear the kit frame.

The same reviewer re-scored the new after set: 390×844 7.5, 360×780 7, 844×390 7.5, 740×360 6.5, 320×568 6 (up from 5.5). Both fixes landed. The reviewer accepted four design decisions and did not mark them down: two-line order labels, the fading last roster tile, the second row at 740 px, and the 44 px flag square.

The reviewer's remaining top three:
1. The Defence dock and wave bar: the bar and the next-wave chip float above the dock as two pieces.
2. The portrait resource block is dense.
3. The production dock does not shrink to its content.

These stay open (below). Every viewport is still under the target of 8.

## Open items

- **Reviewer points not addressed:**
  - **Portrait order labels:** they wrap to two lines ("Attack- / move", "Info & / stats"). The kit allows this; the alternative is shorter labels, which needs new strings in vi/ko.
  - **Portrait resource block:** the 2 × 2 block is dense. The clock sits in the left panel in portrait but in the right panel in landscape.
  - **Defence portrait:** the wave bar and the next-wave chip float above the dock as two pieces.
  - **Building dock:** the production dock (Actions tab, 202 px) does not shrink to its content.
  - **Radio line:** it is still cut with an ellipsis; tapping it opens the full line, as before.
  - **740×360 landscape:** the touch row stays on a second row. It needs about 840 px to fit in the top band with Vietnamese labels.
  - **Minimap:** the home button sits on its corner.
- **Kit pieces not used yet:** the kit's objective chip ("Hold the bridges · 1/2") and selection chip ("Vanguard · 4 selected"). The objective chip would need a small JS hook. It should collapse back to the flag after a few seconds, so that it does not take scene space.
- **Kit glyphs:** not used; the game keeps `src/icons.js`.
- **Rendering cost:** the canvas is now drawn in full on portrait phones, including under an open 202 px dock (before, the part under that dock was skipped). This adds fill cost only; draw calls are unchanged. The render-budget suite was not run.
- **Not verified on real phones:** iOS Safari notch and home bar, and Android back-swipe with the canvas at the edges.
