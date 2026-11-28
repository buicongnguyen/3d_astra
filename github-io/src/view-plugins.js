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
import { ArmyReadabilityView } from "./army-readability-view.js";
import { EliteView } from "./elite-view.js";
import { CounterHitView } from "./counter-hit-view.js";
import { BossPresenceView } from "./boss-presence-view.js";
import { DefenceReadabilityView } from "./defence-readability-view.js";
import { FollowTetherView } from "./follow-tether-view.js";
import { AirLifeView } from "./air-life-view.js";
import { BuildingDecalsView } from "./building-decals-view.js";
import { ThreatArrows } from "./threat-arrows.js";
import { DeathLooks } from "./combat-feedback.js";
import { RankPaintView } from "./profile-rank.js";
import { WildView } from "./wild-view.js";
import { CreatureView } from "./creature-view.js";
import { DeathCueView } from "./death-cue-view.js";
import { WaveKindView } from "./wave-kind-view.js";
import { HeroView } from "./hero-view.js";
import { HeroModeView } from "./hero-mode-view.js";
import { CoverView } from "./cover-view.js";
import { CloseLookView } from "./close-look-view.js";
import { UnitDecalsView } from "./unit-decals-view.js";
import { BirdView } from "./bird-view.js";
import { HazardView } from "./hazard-view.js";
import { ChallengeView } from "./challenge-view.js";

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
  ArmyReadabilityView,
  EliteView,
  CounterHitView,
  BossPresenceView,
  DefenceReadabilityView,
  FollowTetherView,
  AirLifeView, // R3-W: rotor blur, nav lights, engine glow, contrails (one draw)
  BuildingDecalsView,
  ThreatArrows, // R3-K: off-screen threat arrows (DOM, no draw)
  DeathLooks, // R3-K: three death looks by damage type (effect pools, no draw)
  RankPaintView, // R3-R: the picked paint scheme on the player's units (instanceColor tint, no draw)
  WildView, // R4-P1: Weather Spire, nest ring, sandstorm and Ambush ripples (only in a Wild frontier match)
  CreatureView, // creature round: campaign den rings, acid splashes, guardian side changes (only in a mission with dens)
  DeathCueView, // readable deaths: model flash, side-coloured burst and fall ring, Unit motion pop (effect pools, no draw)
  WaveKindView, // W10: Defence wave kinds, model tint (instanceColor) and a hexagon ring (one draw, only once a kind spawns)
  HeroView, // campaign heroes: gold ground ring (one draw) and an HTML nameplate that selects in one tap (no draw)
  HeroModeView, // H3a/H3d Hero mode: projectiles at the hero, landing rings and the reticle (3 draws, only in Hero mode)
  CoverView, // H6 cover walls: every piece merged into one static mesh (1 draw, only in a match with cover)
  CloseLookView, // H5: close-view surface detail, rim and tight shadow in Hero mode (shared uniforms, no draw)
  UnitDecalsView, // H5: team emblems, hull stripes and unit numbers on near units in Hero mode (one draw, only in Hero mode)
  BirdView, // H5: perched flocks that react (one card draw; in Hero mode one more per bird family near the camera)
  HazardView, // H8: explosive crates and barrels beside the cover, one instanced batch (1 draw, only in a match with cover)
  ChallengeView, // H8: Hero challenges' view cones and markers (2 draws, only in a challenge)
];
