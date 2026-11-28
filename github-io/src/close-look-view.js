import { CLOSE_DETAIL, atlasTexture, closeDetailOn } from "./close-detail.js";

// H5 close-view look (a view plugin, docs/VIEW_PLUGINS.md): drives the shared close-detail uniforms (close-detail.js)
// and the Hero mode shadow box. Nothing draws here and nothing is built.
//   - Surface detail: on in Hero mode when Settings closeDetail (auto / on / off) and the governor allow it.
//   - Rim light: the Fresnel rim (look-grade.js) grows near the Hero camera in Hero mode, on every device.
//   - Tight shadow: in Hero mode the sun's shadow box shrinks around the look point (sharper shadows near the
//     hero for the same 2048 map; fewer far casters in the shadow pass, so it never costs draws).
// The RTS view keeps everything at zero: the detail block is skipped and the shadow box is the view's own.
export const CLOSE_LOOK = Object.freeze({
  rim: 0.75,
  range: { pc: [7, 22], touch: [5, 15] },
  // Shadow box half size in Hero mode (m): PCs get the tight box, touch devices a slightly larger one.
  shadow: { pc: 30, touch: 34 },
});

export class CloseLookView {
  constructor(view) {
    this.view = view;
    view.closeLook = this; // H5: tests and probes reach the plugin here (class names are minified in a build)
    this.touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    this.state = { on: false, detail: false, rim: 0, shadow: 0 }; // read by tests and probes
    view.closeShadowHalf = null;
  }
  update(sim, dt) {
    const v = this.view, hero = !!v.heroCameraOn, s = v.settings || {};
    const detail = hero && closeDetailOn(s.closeDetail ?? "auto", { touch: this.touch, level: v.closeLevel || "full", eco: !!v.lowPower });
    if (detail) CLOSE_DETAIL.atlas.value ||= atlasTexture();
    CLOSE_DETAIL.amount.value = detail ? 1 : 0;
    CLOSE_DETAIL.rim.value = hero ? CLOSE_LOOK.rim : 0;
    if (hero && v.heroEye) CLOSE_DETAIL.eye.value.copy(v.heroEye);
    const range = CLOSE_LOOK.range[this.touch ? "touch" : "pc"];
    CLOSE_DETAIL.range.value.set(range[0], range[1]);
    const half = hero && s.closeDetail !== "off" ? CLOSE_LOOK.shadow[this.touch ? "touch" : "pc"] : 0;
    v.closeShadowHalf = half ? (dist) => Math.min(130, Math.max(half, dist * 1.4)) : null;
    // Creature life: while the close view is on and motion is allowed; the hero the creatures shy from.
    const lively = !!v.closeView?.on && (v.motionLevel ?? 2) > 0 && !v.reducedMotion?.matches && s.unitMotion !== false;
    CLOSE_DETAIL.life.value = lively ? 1 : 0;
    if (lively && dt > 0) CLOSE_DETAIL.lifeTime.value = (CLOSE_DETAIL.lifeTime.value + Math.min(0.05, dt)) % 3600;
    const driven = hero ? sim?.get?.(sim.heroMode?.teams?.[0]?.id) : null;
    if (driven) CLOSE_DETAIL.hero.value.set(driven.x, v.terrain?.heightAt?.(driven.x, driven.z) ?? 0, driven.z); else CLOSE_DETAIL.hero.value.set(0, -1000, 0);
    this.state.on = hero; this.state.detail = detail; this.state.rim = CLOSE_DETAIL.rim.value; this.state.shadow = half;
  }
  reset() {
    CLOSE_DETAIL.amount.value = 0;
    CLOSE_DETAIL.rim.value = 0;
    CLOSE_DETAIL.life.value = 0;
    this.view.closeShadowHalf = null;
  }
}
