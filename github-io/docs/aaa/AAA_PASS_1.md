# AAA pass 1 (2026-11-17)

Review of four screenshots against an AAA strategy-game bar gave about 6.5/10. Each finding was
re-checked in real play (a fresh skirmish on Meridian Riverlands, no spawned units) at 1440x900,
390x844 and 844x390 before anything was changed. Screens: `.tmp/aaa-shots.mjs` (idle, Selection tab
with nothing selected, army selected; also lists text overlapping buttons and text cut off-screen).

| # | Finding | Re-checked in real play | Action |
|---|---|---|---|
| 1 | Phone: idle row runs over the order buttons | Real, only on the Selection tab with nothing selected (orders greyed out underneath) | **Fixed:** that state hides the orders and the idle row (`ui-extras.css`); the floating idle buttons do the job |
| 2 | Phone HUD takes about half the screen | Map is 53% of a 390x844 screen. Hiding the empty panel left a black gap: the 3D view is sized to the space above the dock | **Deferred** to pass 2: needs the stage to resize with the dock (see below) |
| 3 | Alerts in the middle of the fight | Alerts sit on the notice line under the top bar, as in most RTS games, and already ping the minimap (`app/frame.js`). The test shot had the camera centred on the fight | **No change** |
| 4 | Muddy, smeared ground | Real: colours painted at 2 m per cell, upscaled, blurred 3 px; dirt "cracks" blurred into streaks | **Fixed** in `ground-paint.js` (1.2 m cells, 1.5 px blur, pebbles and clods) |
| 5 | Desktop command panel cut off | Not in real play: the panel fits; the shot was the empty state after a test setup | **No change** |
| 6 | Population 20/15 | Caused by the test setup spawning 12 extra units; play cannot exceed the cap | **No change** |
| 7 | Weak impacts | `fx.js` already draws flash, fireball, sparks, debris, shockwave, scorch, plus `camera-shake.js`; the still frame was taken with time held | **No change** |

## Checks
`npm test` and the browser suites mobile, mobile-controls, ui-quality, layout-f, status-layout,
terrain, render-budget and messages pass. The rules are untouched, so the pinned match
fingerprint cannot move.

## Pass 2: more map on portrait phones (done)
The 3D view on portrait phones used to stop above the tallest dock (so switching tabs never
resized it). It now runs under the dock and under the tool row, and still never resizes:
- `ui-theme.css` sets `#world` from the top of the stage to the tabs, with `--view-cover: 202px`
  (the dock) and `--view-cover-top: 48px` (the tool row).
- `view.js resize()` reads both; `updateCamera()` frames the uncovered part exactly as before
  (same pixels per metre, focus in its middle) and extends the orthographic frustum over the
  covered strips. Bar size, tap radius (`pick`) and drag panning use `unitsPerPixel` (the framed
  scale), not canvas height / zoom. The shadow box grows with the extra depth.
- **The strip under an open panel is not drawn** (`setCoverOpen`, viewport set to the part above
  it): phones pay nothing for map nobody can see. Drawing it always had cost about 6% more draw
  calls (three-rivals-eco 146 -> 159, three-factions-eco 182 -> 197, over their budgets); with
  this the budgets hold unchanged. `project()`, `point()`, the minimap outline (`visibleRect()`),
  the readability scale of models and the ambient-life pixel size all use the drawn height.
- Selection tab with nothing selected: the panel shrinks to one slim bar on the tabs ("Awaiting
  your command" + Info & stats, which is the phone's only way into the field guide) and the strip
  is drawn as extra map.
- The floating idle buttons sit above the dock (`bottom: var(--view-cover) + 8px`).

Map share of a 390x844 screen: 53% before; 53% with a panel open (same framing, by design) and
about 70% with nothing selected. Landscape and desktop are unchanged (no cover variables there).

Tests adjusted to the new box (intent kept): `mobile.mjs` drags its box across the framed part;
`mobile-construction.mjs` checks the build card against the framed battlefield; `render-budget.mjs`
allows 6 (was 4) new batches on the first restart, which on a phone now shows the map under its
closed dock (no growth from one restart to the next is still required).

## Pass 3: phone screens neat and tidy (done)
Audited menu, skirmish, campaign, defence, settings, battle HUD (normal and worst-case values),
help, pause, win and lose at 390x844, 844x390 and 360x740 (`game-ui-upgrade` ui-pass). The 11 px /
44 px / no-sideways-scroll standard already held (only deliberate flags: a screen-reader label and
icon-only buttons). Menus, settings, pause, help and results were already tidy. Fixed in the battle
HUD:
- Portrait tool row: the seven buttons share the width equally (icon buttons were narrower).
- Orders: six sit as 3 + 3 (was 4 + 2); seven or eight as four columns (`wide-orders`).
- Group card: "ATK*" (attack of the first unit only) is now the range in the group, e.g. "4–13".
- A unit roster wider than its row fades at the right edge until scrolled to its end, instead of
  ending in a half portrait.

## Pass 4 (2026-11-18, toward 8/10; re-evaluated in real AI-vs-AI play on the live build)
- Phone messages: the counter hint has a short phone form ("Vanguard beats Ranger: use Breaker",
  `counterHint(..., short)`), and phone notices are as wide as their text, so "Under attack!" is
  a small pill instead of a full-width bar. PC keeps the full sentences.
- PC dock, nothing selected: the idle buttons sit side by side (they wrapped and ran off the
  screen in real play; pass 1 wrongly called this a test artefact).
- The no-selection hint says "Your Command core is down" once the core is gone (it kept saying
  "Your expedition is ready").
- Minimap: drawn from the battlefield's own painted ground (`view.groundCanvas`), with soft fog
  edges, instead of one flat block per 2 m cell.
- Ground on PCs (High quality, fine pointer): 2048 texture; detail sizes scale with the texture
  (`k` in ground-paint.js). Phones and Eco stay 1024 and paint exactly as before.

Open: bigger battles (supply, AI wave size, fight camera) change balance and the pinned match
fingerprint: options go to the owner first.

## Later (proposed)
1. **Ground, second step:** a 2048 texture on PCs (keep 1024 on phones), measured with
   `render-budget` for load time and memory.
2. Measure ground paint time at load on a 4x-throttled CPU before and after pass 1.
3. A translucent dock, or a shorter one for small selections, to show more map with a panel open.
