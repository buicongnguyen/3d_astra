// View plugins (AAA round 2, docs/VIEW_PLUGINS.md): a visual feature hooks into the battlefield view
// (WorldView, src/view.js) from its own file instead of editing view.js. Each WorldView builds every
// registered plugin once, in registry order, as `new Plugin(view)`; a plugin may use view.fx,
// view.shake (read it each time: reset() replaces it), view.scene and view.camera. Every hook is
// optional and is called for each plugin that has it, in registry order:
//   dress(root, e)            at the end of createEntity: extra parts on a new entity's root
//   scaleFor(e)               a static factor on the entity's model, applied after the readability clamp
//                             (so it may pass FEEL.maxModelScale) and before the vitals bar is placed
//   frameScaleFor(e, u, view) a factor each frame, applied with u.readabilityScale (visible entities
//                             only; u is the root's userData); the vitals bar rides with it
//   event(ev, sim)            each event WorldView.event gets, after its own handling (src/app/frame.js
//                             sends the interface's events, such as message, say, objective, incoming
//                             and drop, to the interface instead: they never reach a view plugin)
//   update(sim, dt)           once a frame, after the effects and tactics views, before drawing
//   reset()                   when the view is reset for a new match
// A scale hook that returns undefined counts as 1. With no plugin (or none with a hook), nothing is
// called and every frame is drawn exactly as before: the scale factors are exactly 1.
//
// Plugin modules are imported here, one line each, below this comment.
import { StatusView } from "./status-view.js";

export const HOOKS = ["dress", "scaleFor", "frameScaleFor", "event", "update", "reset"];

// The plugins of one WorldView. Its methods have the hooks' names and call every plugin that has
// that hook; the two scale hooks return the product of the factors (1 when there are none).
export class ViewPlugins {
  constructor(view, classes = VIEW_PLUGINS) {
    this.list = classes.map((Plugin) => new Plugin(view));
    this.with = Object.fromEntries(HOOKS.map((hook) => [hook, this.list.filter((p) => typeof p[hook] === "function")]));
  }
  dress(root, e) { for (const p of this.with.dress) p.dress(root, e); }
  scaleFor(e) {
    let k = 1;
    for (const p of this.with.scaleFor) k *= p.scaleFor(e) ?? 1;
    return k;
  }
  frameScaleFor(e, u, view) {
    let k = 1;
    for (const p of this.with.frameScaleFor) k *= p.frameScaleFor(e, u, view) ?? 1;
    return k;
  }
  event(ev, sim) { for (const p of this.with.event) p.event(ev, sim); }
  update(sim, dt) { for (const p of this.with.update) p.update(sim, dt); }
  reset() { for (const p of this.with.reset) p.reset(); }
}

// The registry (append-only): add your plugin class at the end, one entry per package, and never
// edit or reorder the entries above yours.
export const VIEW_PLUGINS = [
  StatusView,
];
