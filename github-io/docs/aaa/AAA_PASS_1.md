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

## Pass 2 (proposed, not started)
1. **More map on portrait phones:** let the 3D stage extend under the dock and collapse the empty
   panel to the tab bar, then re-run every phone suite (camera framing, picking and the minimap
   depend on the stage size). Merge the 7-button tool row into the tab bar where possible.
   Target: map at least 65% of a 390x844 screen.
2. **Ground, second step:** a 2048 texture on PCs (keep 1024 on phones), measured with
   `render-budget` for load time and memory.
3. Measure ground paint time at load on a 4x-throttled CPU before and after.
