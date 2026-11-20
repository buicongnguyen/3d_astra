import * as THREE from "three";
import { DamageNumbers, NUMBER_MODES, NUMBERS, TAG_TEXT, counterKind } from "./combat-feedback.js";
import { translate } from "./i18n.js";

// Battle feedback (AAA round 2, W2-E; docs/VIEW_PLUGINS.md). A view plugin that only reads the simulation:
//   * counter hits: a shot whose shooter counters its target (or has a mechanical bonus against a machine)
//     flares gold where it lands; a resisted shot puffs grey (src/combat-feedback.js counterKind). The sound
//     layer ("crit") is src/sfx.js. The shot event is used, not the impact event: impacts carry no shooter.
//   * floating damage numbers from the per-frame change of hp + shield (src/combat-feedback.js DamageNumbers),
//     and tag labels (REAR, PINNED, PIERCE) from a shot's `tags`. The setting "Damage numbers" is
//     "Bosses & Defence" (default), "All" or "Off" (src/settings.js `damageNumbers`).
// The numbers draw on one small 2D canvas over the battlefield (no WebGL draw call, nothing built until the
// first number). Reduced motion and "Animate combat effects" off: no flares, and numbers stay in place.
const FLARE_GAP = 0.25; // seconds between flares on one target
export class CounterHitView {
  constructor(view) {
    this.view = view;
    this.numbers = new DamageNumbers();
    this.flared = new Map(); // target id -> time of its last flare
    this.canvas = null;
    this.ctx = null;
    this.point = new THREE.Vector3();
    this.painted = false;
    this.visible = (e) => this.sim.isVisible(e);
    this.sim = null;
  }
  get mode() { const m = this.view.settings?.damageNumbers; return NUMBER_MODES.includes(m) ? m : "focus"; }
  event(ev, sim) {
    if (ev.type !== "shot" || ev.target == null || !Number.isFinite(ev.tx)) return;
    const view = this.view, at = { x: ev.tx, z: ev.tz };
    if (!sim.isVisible(at)) return;
    if (ev.tags && this.mode !== "off") for (const tag of ev.tags) {
      const text = TAG_TEXT[tag];
      if (text) this.numbers.tag(ev, sim.time, translate(text));
    }
    if (!view.feelEnabled?.()) return;
    const kind = counterKind(sim.get(ev.source) || null, sim.get(ev.target) || null);
    if (!kind) return;
    const last = this.flared.get(ev.target);
    if (last !== undefined && sim.time - last < FLARE_GAP) return;
    if (this.flared.size > 256) this.flared.clear();
    this.flared.set(ev.target, sim.time);
    view.fx.counterHit({ x: ev.tx, y: (ev.tAir || 0) + 1.1 + view.fx.ground(ev.tx, ev.tz), z: ev.tz }, { x: ev.tx, z: ev.tz }, kind > 0);
  }
  update(sim, dt) {
    const numbers = this.numbers, mode = this.mode;
    this.sim = sim;
    numbers.observe(sim, sim.time, mode, this.visible);
    numbers.step(dt);
    if (numbers.live || this.painted) this.paint();
  }
  // Draw every live slot, then (once) clear the canvas when the last one has gone.
  paint() {
    const view = this.view, numbers = this.numbers;
    if (!numbers.live && !this.canvas) return;
    if (!this.canvas) {
      if (typeof document === "undefined") return;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "damage-numbers";
      this.canvas.setAttribute("aria-hidden", "true");
      Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
      view.container.append(this.canvas);
      this.ctx = this.canvas.getContext("2d");
    }
    const c = this.ctx, dpr = Math.min(globalThis.devicePixelRatio || 1, view.lowPower ? 1 : 1.5);
    const w = Math.round(view.width * dpr), h = Math.round(view.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, view.width, view.height);
    this.painted = numbers.live > 0;
    if (!this.painted) return;
    const still = view.settings?.combatMotion === false || !!view.reducedMotion?.matches, p = this.point;
    c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = 3;
    for (const s of numbers.slots) {
      if (!s.on) continue;
      const k = s.age / s.life, rise = still ? 0 : NUMBERS.rise * (1 - (1 - k) * (1 - k));
      p.set(s.x, s.y + rise + view.fx.ground(s.x, s.z), s.z).project(view.camera);
      if (p.z > 1) continue;
      const x = (p.x * 0.5 + 0.5) * view.width, y = (-p.y * 0.5 + 0.5) * view.height;
      if (x < -40 || x > view.width + 40 || y < -20 || y > view.height + 20) continue;
      const tag = s.kind === 3;
      c.font = `800 ${tag ? 12 : s.kind === 2 ? 17 : 13}px Arial, Helvetica, sans-serif`;
      c.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      c.strokeStyle = "rgba(24,10,6,0.85)";
      c.fillStyle = tag ? "#ffd24a" : s.kind === 1 ? "#ff7a6a" : s.kind === 2 ? "#fff1c2" : "#ffffff";
      c.strokeText(s.text, x, y);
      c.fillText(s.text, x, y);
    }
    c.globalAlpha = 1;
  }
  reset() {
    this.numbers.reset();
    this.flared.clear();
    this.sim = null;
    if (this.canvas) { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.painted = false; }
  }
}
