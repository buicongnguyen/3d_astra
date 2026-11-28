// The Hero-view horizon (a view plugin, docs/VIEW_PLUGINS.md; owner 2026-11-28): a sky dome, far mountains or sea and
// the key art's planets around the hero camera, and (Settings > Hero > Sky, default Vivid; owner 2026-11-28/29) the
// Vivid space sky: nebula, glowing planets, an orbital ring, a far space war, meteors and one sky event a match. The sky
// itself is src/horizon-sky.js with src/horizon-vivid.js, imported on the first Hero mode entry (nothing is built,
// fetched or drawn before, and nothing in the RTS view). Calm: at most 3 draws in Hero mode (the dome; the ring and the
// planets only while the camera can see above the far haze). Vivid: at most 6 (the dome, the far ring, the bodies, the
// orbital layer, the meteors, the event). 0 in the RTS view.
//   - Off with Settings > Display > Decorative vegetation Off (the scenery switch, `detail`); the governor's rescue step
//     keeps the dome (and the Vivid bodies) but drops the far ring, the meteors, the event and the far war; phones drop
//     the far war at its first step.
//   - Off on software WebGL (view.softwareGL: SwiftShader, llvmpipe, Microsoft Basic Render, so a computer without a
//     working GPU and CI's runners), as the ground detail drops to Eco there: such a renderer has no parallel shader
//     compile and its new programs stalled the first Hero mode frames for about 2 s (more on a slow CPU).
//   - While it is on, the backdrop's own screen-space sky gives way to the dome (map-edge.js uEdgeHero), and the night
//     sky's stars and moon (night-sky.js, drawn on the void below the map for the RTS camera, which read as dots on the
//     ground from the hero camera) give way to the dome's own stars.
//   - The sky answers the battle (sky-events.js SkyFlash): a big blast near the hero camera warms the low Vivid sky.
// view.horizon.state is read by the tests and probes; forceOff turns it off for A/B timing; forceEvent picks the event
// (tests and screenshots), forceSky the sky ("calm", "vivid", "burning") over the setting.
import { skyMode, skySeed, skyPlan, campaignMission, FLEET_SHIP, SkyFlash, blastSize, blastAt, blastStrength } from "./sky-events.js";

export class HorizonView {
  constructor(view) {
    this.view = view;
    view.horizon = this;
    this.sky = null;
    this.loading = null;
    this.forceOff = false;
    this.forceEvent = null;
    this.forceSky = null;
    this.flash = new SkyFlash();
    this.planFor = { sim: null, mode: null, force: null, terrain: null, plan: null, seed: null };
    // The match the Hero camera was last used in (victory-fireworks.js reads it).
    this.heroSim = null;
    this.state = { on: false, built: false, dome: false, ring: false, planets: false, draws: 0, flash: 0 };
  }
  // The module, then its programs compiled off the frame (KHR_parallel_shader_compile where the browser has it), so
  // the first Hero mode frames never stall on a shader compile; the sky shows once they are ready.
  load() {
    this.loading ||= import("./horizon-sky.js").then((m) => {
      const v = this.view;
      if (!v.scene) return null;
      const sky = new m.HorizonSky(v);
      if (v.terrain) sky.setTerrain(v.terrain);
      sky.root.visible = false;
      const compiled = v.renderer?.compileAsync && v.camera ? v.renderer.compileAsync(sky.root, v.camera, v.scene).catch(() => null) : null;
      return Promise.resolve(compiled).then(() => { this.sky = sky; });
    }).catch(() => { this.loading = null; });
    return this.loading;
  }
  // The match's sky: its mode, seed and plan (sky-events.js), worked out once per match and setting.
  plan(sim) {
    const v = this.view, mode = this.forceSky || skyMode(v.settings), P = this.planFor, terrain = v.terrain?.id ?? null;
    if (P.sim !== sim || P.mode !== mode || P.force !== this.forceEvent || P.terrain !== terrain) {
      const seed = skySeed(sim), faction = sim?.factions?.[0] ?? "meridian";
      P.plan = { ...skyPlan({ mode, terrain: v.terrain, seed, force: this.forceEvent, campaign: campaignMission(sim) }), fleet: FLEET_SHIP[faction] || "ark" };
      // A new match starts the sky's clock again (its opening fleet, its first shockwave).
      if (P.sim !== sim && this.sky) this.sky.time = 0;
      Object.assign(P, { sim, seed, mode, force: this.forceEvent, terrain });
    }
    return P;
  }
  update(sim, dt) {
    const v = this.view;
    const on = !!v.heroCameraOn && !!v.terrain && !v.softwareGL && v.settings?.detail !== false && !this.forceOff;
    if (v.heroCameraOn && sim) this.heroSim = sim;
    if (on && !this.sky) this.load();
    const P = this.plan(sim);
    this.flash.advance(dt);
    const calm = P.mode === "calm", still = !!v.reducedMotion?.matches;
    this.sky?.update(sim, dt, on, { mode: P.mode, plan: P.plan, seed: P.seed, blast: calm || still ? 0 : this.flash.value() });
    // The sky's own big moments (a landing flare, a bloom in orbit) answer back through the same flash.
    const own = on && this.sky?.vivid ? this.sky.state.flashAsk : 0;
    if (own > 0 && !calm && !still) this.flash.trigger(own);
    const dome = on && !!this.sky;
    const edge = v.backdrop?.material?.userData?.motion?.hero;
    if (edge) edge.value = dome ? 1 : 0;
    if (dome) {
      const night = v.mood?.sky?.pieces;
      if (night?.stars) night.stars.visible = false;
      if (night?.moon) night.moon.visible = false;
    }
    const s = this.sky?.state;
    Object.assign(this.state, { ...(s || {}), on: dome, built: !!this.sky, dome: !!s?.dome && dome, ring: !!s?.ring && dome, planets: !!s?.planets && dome, draws: dome ? this.sky.draws : 0, look: s?.look ?? null, triangles: s?.triangles ?? 0, style: s?.style ?? null, sea: s?.sea ?? null, top: s?.top ?? null, mode: P.mode, plan: P.plan, seed: P.seed, flash: this.flash.value(), flashes: this.flash.flashes });
  }
  // The sky answers the battle: a big blast seen near the Hero camera (sky-events.js blastSize) flashes the low sky.
  event(ev, sim) {
    const v = this.view;
    if (!this.state.on || this.planFor.mode === "calm" || v.reducedMotion?.matches) return;
    const size = blastSize(ev);
    if (!size) return;
    const at = blastAt(ev);
    if (!Number.isFinite(at.x) || !Number.isFinite(at.z) || (sim?.isVisible && !sim.isVisible(at))) return;
    const eye = v.heroEye || v.focus || { x: 0, z: 0 };
    this.flash.trigger(blastStrength(size, Math.hypot(at.x - eye.x, at.z - eye.z)));
  }
  reset() {
    // A new match keeps the built sky (the ring follows the terrain on its next update; the plan follows the match).
    this.flash.reset();
  }
}
