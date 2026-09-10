# Construction, harvesting and combat feedback

Both editions show compact progress bars above your busy buildings, including construction, unit training and level upgrades. Waiting construction names the missing Harvester; blocked production displays the supply or exit problem. Bars disappear when the work finishes or is cancelled.

- Select a production building and tap its numbered queue item for a full refund. All five queue items stay visible in one row, with progress and at least 44×44 touch targets. Each button cancels exactly that job; a stale tap cannot cancel its replacement. Three.js also offers full named cancellation cards in Actions, with horizontal scrolling.
- Select an unfinished building to **Cancel construction/site** for a 75% refund. Finished buildings cannot be cancelled this way.
- Selected Harvesters mark their active resource target with an amber or blue ground ring. It remains during cargo delivery, updates on reassignment, and clears after Stop, withdrawal or depletion.
- A small tool beam/glow and gentle rocking indicate actual mining. Selected workers show cargo out of 10 and Harvesting, To deposit, Returning cargo or Waiting. Travelling, stopped and full workers do not emit mining effects.
- Building hits produce a short blue shield or amber impact ring. Unit destruction uses a short burst, larger for tanks and buildings. These effects obey visibility, pause and the motion preference.

## Rendering budget

The selection panel reserves separate space for HP, shield, attack, one activity line and the production queue. Values stay on one line within their columns; large army totals use `k`, with exact totals available in tooltips. Group ATK is marked `*` because it describes the first selected unit. Restore appears only for a single support unit. Full descriptions remain in **Info & stats**. The queue is independent of roster scrolling and Godot's command pages.

Three.js uses a single 2D overlay, capped pixel density, at most 32 new transient effects, and at most 64 existing shot/support effects. Godot draws into its existing 2D overlay and caps the new effects at 32. Building impacts are throttled to one per building per 0.2 seconds. No particle emitters, extra lights, shadows or new model assets are required. Reduced motion uses steady tool lights and fading rings. Godot uses its existing motion setting.

## Verification

Simulation checks cover real work versus travel, cargo/full/depleted deposits, construction staffing, cancellation refunds and stale job IDs. Browser checks exercise real cancellation taps/clicks, overhead feedback and resource targets in desktop, small portrait and landscape Chrome layouts. Existing construction, harvesting and keyboard checks remain in deployment CI. Emulated Chrome checks do not substitute for physical-device FPS measurements.
