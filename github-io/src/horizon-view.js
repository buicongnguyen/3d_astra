// The Hero-view horizon (a view plugin, docs/VIEW_PLUGINS.md; owner 2026-11-28): a sky dome, far mountains or sea and
// the key art's planets around the hero camera. The sky itself is src/horizon-sky.js, imported on the first Hero mode
// entry (nothing is built, fetched or drawn before, and nothing in the RTS view). At most 3 draws in Hero mode (the
// dome; the ring and the planets only while the camera can see above the far haze), 0 in the RTS view.
//   - Off with Settings > Display > Decorative vegetation Off (the scenery switch, `detail`); the governor's rescue step
//     keeps the dome but drops the ring and the planets; phones get all of it (it is cheap).
//   - While it is on, the backdrop's own screen-space sky gives way to the dome (map-edge.js uEdgeHero), and the night
//     sky's stars and moon (night-sky.js, drawn on the void below the map for the RTS camera, which read as dots on the
//     ground from the hero camera) give way to the dome's own stars.
// view.horizon.state is read by the tests and probes; forceOff turns it off for A/B timing.
export class HorizonView {
  constructor(view) {
    this.view = view;
    view.horizon = this;
    this.sky = null;
    this.loading = null;
    this.forceOff = false;
    this.state = { on: false, built: false, dome: false, ring: false, planets: false, draws: 0 };
  }
  load() {
    this.loading ||= import("./horizon-sky.js").then((m) => {
      if (!this.view.scene) return;
      this.sky = new m.HorizonSky(this.view);
    }).catch(() => { this.loading = null; });
    return this.loading;
  }
  update(sim, dt) {
    const v = this.view;
    const on = !!v.heroCameraOn && !!v.terrain && v.settings?.detail !== false && !this.forceOff;
    if (on && !this.sky) this.load();
    this.sky?.update(sim, dt, on);
    const dome = on && !!this.sky;
    const edge = v.backdrop?.material?.userData?.motion?.hero;
    if (edge) edge.value = dome ? 1 : 0;
    if (dome) {
      const night = v.mood?.sky?.pieces;
      if (night?.stars) night.stars.visible = false;
      if (night?.moon) night.moon.visible = false;
    }
    const s = this.sky?.state;
    Object.assign(this.state, { on: dome, built: !!this.sky, dome: !!s?.dome && dome, ring: !!s?.ring && dome, planets: !!s?.planets && dome, draws: dome ? this.sky.draws : 0, look: s?.look ?? null, triangles: s?.triangles ?? 0, style: s?.style ?? null, sea: s?.sea ?? null, top: s?.top ?? null });
  }
  reset() {
    // A new match keeps the built sky (the ring follows the terrain on its next update).
  }
}
