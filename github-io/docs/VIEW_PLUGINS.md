# View plugins

A view plugin is a visual feature that lives in its own file and hooks into the battlefield view (`WorldView`, `src/view.js`) instead of editing it. `view.js` is the most-edited file in the game; round 2 adds unit looks, boss presence, phone readability, elite trims and weapon looks in parallel, so each of them is a plugin.

Plugins are view-only. They never change the simulation, so they cannot move a golden pin or a checksum.

## Register a plugin

1. Write the class in its own module, for example `src/boss-presence-view.js`.
2. In `src/view-plugins.js`, import it (one line under the comment at the top) and append it to `VIEW_PLUGINS` at the end. The list is append-only: never edit or reorder the entries above yours.

```js
import { BossPresenceView } from "./boss-presence-view.js";
// ...
export const VIEW_PLUGINS = [
  BossPresenceView,
];
```

Every `WorldView` builds each plugin once, in list order, as `new Plugin(view)`, at the end of its constructor (the renderer, scene, camera, effects and terrain exist by then).

## Hooks

All hooks are optional. Each one is called for every plugin that has it, in list order.

| Hook | Called | Use it for |
|---|---|---|
| `dress(root, e)` | At the end of `createEntity`, after the ring and vitals bar are made and before the root's transforms are cached and it joins the scene | Extra parts on a new entity: a trim, a banner, a badge. Add children to `root` (or to `root.userData.model` to move with the model). |
| `scaleFor(e)` | Once per new entity, after the readability clamp (`FEEL.maxModelScale`) and before the vitals bar is placed | A fixed size change: bosses ×1.5. The factor multiplies `root.userData.readabilityScale`, so it may pass the clamp, and the bar sits on top of the scaled model. |
| `frameScaleFor(e, u, view)` | Every frame, for each visible entity, with `u = root.userData` | A size that changes: units growing at strategic zoom. Applied together with `u.readabilityScale` to the model; the vitals bar rides with it. |
| `event(ev, sim)` | For each simulation event, after `WorldView` has handled it | Reacting to shots, impacts, deaths, abilities: a flash, a ring, a sound cue. |
| `update(sim, dt)` | Once a frame, after the effects and tactics views, before the frame is drawn | Animating what the plugin owns. `dt` is the cosmetic frame time (0 while paused, slowed during hit-stop). |
| `reset()` | At the end of `WorldView.reset` (a new match) | Removing and disposing what the plugin added. |

A scale hook returns a number, or `undefined` for "not mine" (counted as 1). The factors of several plugins multiply. With no plugin, or none that has the hook, the factor is exactly 1 and every frame is drawn as before (checked: render-budget p95 draws and a held-clock screenshot, `docs/aaa/results/round2/w0a.md`).

The vitals bar follows `frameScaleFor`: a flyer's from the craft's own top (its fly height is already in the bar), anything else's from the bar's height at scale 1, which is read the first time a plugin scales that entity (`u.barRest`). The selection ring does not scale: it marks the footprint.

## What a plugin may use

- `view.fx` (combat effects: `dust`, `burst` and the rest of `src/fx.js`), `view.scene`, `view.camera`.
- `view.shake` for camera shake (`view.shake.add(trauma, distance, view.shakeEnabled())`). Read `view.shake` each time: `reset()` replaces the object.
- Read-only: `view.objects` (entity id to root), `view.terrain`, `view.settings`, `view.lowPower` (Eco), `view.motionLevel` and `view.reducedMotion.matches`, `view.feelEnabled()`, `view.colors` (team colours).

## Rules

- **Never write to the simulation** (`sim`, an entity `e`, events). Read only.
- **Draw budget.** Every mesh is a draw. Prefer per-instance tints on the batched parts (`part.userData.tint`, see `setFlashTint`) and parts that join the entity batches (`adoptBatchedParts` from `src/entity-batches.js`) over new materials. A new render-budget scenario gets its limit as a new line `Object.assign(limits, { "<name>": <n> });` in `tests/render-budget.mjs`.
- **Hot paths.** `frameScaleFor` runs for every visible entity every frame: no allocation, no scene search, an early `return` for types that are not yours.
- **Motion.** Respect `view.feelEnabled()` (combat motion setting, reduced motion, camera cues) and `view.lowPower` for anything that moves or flashes.
- **Clean up** in `reset()`: remove what you added to the scene and dispose geometries and materials you created (not shared template ones).
- **Imports.** `src/view-plugins.js` is imported by `src/view.js`, so a plugin module that imports from `src/view.js` must use those imports only inside its methods, never at module top level (the circular import is not finished then).
- **Strings** shown on screen need Vietnamese in `src/locales/vi.json`, as everywhere.

## Example

```js
// src/boss-presence-view.js: bosses one and a half times as big; a boss's tank shell throws up dust
// and a small shake where it lands.
export class BossPresenceView {
  constructor(view) { this.view = view; }
  scaleFor(e) { return e.boss ? 1.5 : undefined; }
  event(ev, sim) {
    if (ev.type !== "shot" || ev.weapon !== "tank" || !sim.get(ev.source)?.boss) return;
    const at = { x: ev.tx, y: 0.3, z: ev.tz };
    if (!sim.isVisible(at)) return;
    this.view.fx.dust(at, 3, null, 1.2, 1);
    const v = this.view;
    v.shake.add(0.12, Math.hypot(at.x - v.focus.x, at.z - v.focus.z), v.shakeEnabled());
  }
}
```

## Testing a plugin

- Node: `tests/view-plugins.test.js` shows how to run `WorldView`'s real `createEntity`, `update`, `event` and `reset` on a staged view object (three.js scene objects work headless) with a ranger from a real `Simulation`. Pass your plugin class to `new ViewPlugins(view, [YourPlugin])`.
- Browser: a render-budget scenario that puts your entities on screen (`spawn`, `boss`, `variant`, `status`, `rules` fields; `tests/render-budget.mjs` header) with its own limit line, plus `battle-eco` to show nothing else moved.
