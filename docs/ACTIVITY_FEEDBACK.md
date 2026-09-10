# Construction, harvesting and combat feedback

Both editions show a thin strip of green progress squares above busy buildings, including construction, unit training and level upgrades. Large overhead text labels are replaced by ten small segments. The selected building retains a short warning when a Harvester, supply or a clear exit is needed. Bars disappear when work finishes or is cancelled.

- Select a building and tap the small red **×** strip under a work icon to cancel that job. The whole tile provides a 44×44 touch target. Training and upgrades refund their full cost; unfinished structures refund 75%. Finished buildings cannot be cancelled this way. Stable job references prevent a stale tap from cancelling a replacement job.
- All five queue items fit in one fixed row. Three.js uses the same compact strip in Selection and Actions; Godot keeps it above its action pages. Starting, cancelling or completing work does not insert buttons, replace the command panel, or change the action order. Disabled command buttons retain their size. Names, percentages and refund details are available in tooltips and accessible labels instead of repeated on-screen paragraphs.
- Selected Harvesters mark their active resource target with an amber or blue ground ring. It remains during cargo delivery, updates on reassignment, and clears after Stop, withdrawal or depletion.
- A small tool beam/glow and gentle rocking indicate actual mining. Selected workers show cargo in the HUD and a thin cargo strip overhead. Travelling, stopped and full workers do not emit mining effects.
- Building hits produce a short blue shield or amber impact ring. Unit destruction uses a short burst, larger for tanks and buildings. These effects obey visibility, pause and the motion preference.

## Rendering budget

The selection panel reserves separate space for HP, shield, attack, one activity line and the production queue. Values stay on one line within their columns; large army totals use `k`, with exact totals available in tooltips. Group ATK is marked `*` because it describes the first selected unit. Restore appears only for a single support unit. Full descriptions remain in **Info & stats**. The queue is independent of roster scrolling and Godot's command pages.

Three.js uses a single 2D overlay, capped pixel density, at most 32 new transient effects, and at most 64 existing shot/support effects. Godot draws into its existing 2D overlay and caps the new effects at 32. Building impacts are throttled to one per building per 0.2 seconds. No particle emitters, extra lights, shadows or new model assets are required. Reduced motion uses steady tool lights and fading rings. Godot uses its existing motion setting.

## Verification

Simulation checks cover real work versus travel, cargo/full/depleted deposits, construction staffing, cancellation refunds and stale job IDs. Browser checks exercise red-strip taps, progress-square bounds, unchanged command positions through queue and upgrade changes, overhead feedback and resource targets across seven desktop/mobile Chrome layouts. Existing construction, harvesting and keyboard checks remain in deployment CI. Emulated Chrome checks do not substitute for physical-device FPS measurements.
