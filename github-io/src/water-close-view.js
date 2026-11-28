import { WATER_CLOSE, waterTier, clearRings, RINGS, RING, WASH } from "./water-close.js";
import { isSkywing } from "./sim/content/skywing.js";

// Hero-view water (a view plugin, docs/VIEW_PLUGINS.md; the look itself is in water-close.js): each frame it sets the
// water tier (0 in the RTS view, so the water draws exactly as before), copies the backdrop's sky into the water's
// reflection, starts wading rings where units cross a ford near the Hero camera, and places Skywing's downwash ring
// over water. Nothing draws here and nothing is built: it writes shared uniforms only.
// Rings and downwash need the water clock running (motion on): reduced motion, Animate water Off and the governor's
// still step leave the water still.
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const WET = new Set(["water", "ford"]);

export class WaterCloseView {
  constructor(view) {
    this.view = view;
    view.waterClose = this; // tests and probes reach the plugin here (class names are minified in a build)
    this.touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    this.cursor = 0;
    this.next = new Map(); // entity id -> water clock time of its next ring
    this.lastT = null;
    this.state = { tier: 0, rings: 0, wash: 0 }; // read by tests and probes
  }
  update(sim) {
    const v = this.view, env = v.environment, U = WATER_CLOSE;
    const tier = waterTier({ hero: !!v.heroCameraOn && !!env?.water, touch: this.touch, eco: !!v.lowPower, level: v.closeLevel || "full", lava: !!env?.lava });
    U.tier.value = tier;
    this.state.tier = tier;
    if (!tier) {
      if (this.lastT !== null) { clearRings(); this.next.clear(); this.lastT = null; }
      this.state.rings = 0; this.state.wash = 0;
      return;
    }
    // The sky in the water is the sky behind it: the backdrop's horizon and zenith (night and storm tint them).
    const sky = (v.backdrop || v.terrainRoot?.getObjectByName("backdrop"))?.material?.userData?.sky;
    if (sky) {
      U.horizon.value.copy(sky.horizon);
      U.zenith.value.copy(sky.zenith);
      U.light.value = Math.min(1.3, Math.max(0.04, lum(sky.horizon) / Math.max(1e-4, lum(sky.dayHorizon || sky.horizon))));
    } else if (v.scene?.fog) {
      U.horizon.value.copy(v.scene.fog.color);
      U.zenith.value.copy(v.scene.background?.isColor ? v.scene.background : v.scene.fog.color);
      U.light.value = 1;
    }
    const t = env.waterTime.value;
    if (!env.motion) {
      // Still water: no ring starts and none is left half-spread; no downwash.
      if (this.lastT !== null) { clearRings(); this.next.clear(); }
      this.lastT = t;
      this.state.rings = 0; this.state.wash = 0;
      return;
    }
    const moved = t !== this.lastT;
    this.lastT = t;
    if (moved && sim) this.wade(sim, t);
    this.downwash(sim);
    let live = 0;
    for (const r of U.rings.value) if (t - r.z >= 0 && t - r.z <= RING.life) live++;
    this.state.rings = live;
    this.state.wash = U.wash.value.z;
  }
  // A ring every RING.every s from each moving ground unit in a ford within RING.reach m of the camera (seen ones only).
  wade(sim, t) {
    const v = this.view, eye = v.heroEye, rings = WATER_CLOSE.rings.value, terrain = v.terrain;
    if (!eye || !terrain) return;
    for (const e of sim.entities) {
      if (e.kind !== "unit" || e.hp <= 0 || e.flying || !e.moving) continue;
      if (Math.abs(e.x - eye.x) > RING.reach || Math.abs(e.z - eye.z) > RING.reach) continue;
      if (terrain.at(e.x, e.z) !== "ford" || !sim.isVisible(e)) continue;
      const due = this.next.get(e.id);
      if (due !== undefined && t < due && due - t < RING.every * 2) continue;
      // Each unit's own phase, so a squad's rings do not start in step.
      this.next.set(e.id, t + RING.every * (0.85 + ((e.id * 0.618) % 1) * 0.3));
      rings[this.cursor].set(e.x, e.z, t, e.radius > 1 ? 1.5 : 1);
      this.cursor = (this.cursor + 1) % RINGS;
    }
    if (this.next.size > 64) for (const [id, due] of this.next) if (due < t - 5) this.next.delete(id);
  }
  // Skywing over water: the driven hero's drawn height above the water (cruise 3.5 m: full) gives the strength.
  downwash(sim) {
    const v = this.view, w = WATER_CLOSE.wash.value, id = sim?.heroMode?.teams?.[0]?.id, e = id != null ? sim.get(id) : null;
    w.z = 0;
    if (!e || !isSkywing(e) || e.hp <= 0) return;
    const o = v.objects?.get(e.id);
    const f = o?.userData?.skywing?.f ?? (e.flying ? 1 : 0);
    if (!o || f <= 0.02) return;
    const terrain = v.terrain, r = WASH.radius;
    const wet = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([dx, dz]) => WET.has(terrain.at(e.x + dx, e.z + dz)));
    if (!wet) return;
    // A flyer's root stays on the ground (its blob shadow); the drawn flight height is userData.air.y (view.js stepFlyer).
    const alt = (o.userData.air?.y ?? o.position.y) + 0.09;
    const k = f * (1 - Math.min(1, Math.max(0, (alt - WASH.low) / (WASH.high - WASH.low))));
    if (k <= 0.01) return;
    w.set(o.position.x, o.position.z, k, r);
  }
  reset() {
    clearRings();
    this.next.clear();
    this.lastT = null;
    WATER_CLOSE.tier.value = 0;
  }
}
