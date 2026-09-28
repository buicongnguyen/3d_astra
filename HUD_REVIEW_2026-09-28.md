# Compact HUD review — 2026-09-28

Scope: selection, production and command panels in the Three.js and Godot games. Gameplay balance and simulation rules are unchanged.

## Findings and changes

- **Separated desktop controls:** Three.js used a full-width grid with space between the selection and command panels. They now form one joined, 672-pixel-wide bottom-center dock. On smaller desktops it shifts just enough to clear the minimap. Empty space around it remains available for world selection and orders.
- **Crowded stats and production:** The queue previously competed horizontally with selected-object stats. A reserved second row now holds the five production tiles or the unit roster. Health, shield, attack and activity remain readable; starting or cancelling work does not move command buttons. Production tiles retain their 44-pixel targets, progress blocks and red cancellation strips.
- **Tooltip anchoring:** Order tooltips now belong to the command panel, so they follow its new position. Placement cancellation remains inside that panel.
- **Large selections:** The narrower selection area needs bounded scrolling for both the roster and saved groups. All nine control groups remain accessible without extending over the command panel.
- **Godot's oversized footer:** The desktop footer now centers at a maximum width of 936 pixels instead of spanning the screen. This still accommodates four columns and three rows of 44-pixel command tiles, including the largest mixed-unit menu, without scrolling. Mobile keeps its existing portrait/landscape arrangement.

## Validation

- Three.js production build succeeds.
- Three.js status-layout browser checks pass at 1920×1080, 1280×800, 1024×768, 320×568, 390×844, 667×375, 844×390 and 768×1024.
- Checks cover five queued jobs, refunds, upgrades, readable labels, tooltip placement, unobstructed world input, resize transitions, scrolling saved groups/rosters and the placement Cancel button.
- Both games' PC mouse checks pass for selection, modifiers, drag selection, withdrawal, focus fire, targeting cancellation, minimap orders, rally points and preventing orders through the HUD.
- Godot Web export succeeds without script errors. Its status-layout checks pass at the same eight sizes, including complete desktop command visibility and mobile tap-target containment.
- Mobile checks use Chromium touch emulation; they do not measure physical Android performance.

The GitHub Pages workflows run the browser checks before publishing these changes.
