// Readable deaths at phone zoom (re-score 2026-11-26, Animation 6.2: "deaths are hard to read at phone zoom").
// A view plugin (docs/VIEW_PLUGINS.md) on the rules' death event, purely cosmetic (the simulation never sees it):
//   - the dying model flashes white-hot for a moment (per-instance tint: same batches, no draw);
//   - a burst in the side's colour where it died: a bright core and a ring that opens on the ground (a flyer's
//     opens in the air where it was hit), never smaller than a set number of CSS pixels, so it reads on a phone;
//   - a fading ring in the side's colour marks where it fell (a flyer's where it crashes);
//   - your own unit: a bigger burst, a second ripple and a longer-lasting ring (and a minimap mark, src/app/frame.js);
//   - Unit motion: a soldier is popped off its feet as it falls, a machine pops and tilts further with a dark puff.
// Every sprite comes from the existing effect pools in src/fx.js (glow and smoke: one draw each, one in all on
// a phone), so the cue adds no draw call. Combat motion off or reduced motion: no flash, no pop, rings that
// fade without opening. Eco or a still frame governor: no second ripple, no puff, shorter rings.
import { CELL, FLAT } from "./fx-kinds/cells.js";

// Sizes are world metres with a floor in CSS pixels (px x view.unitsPerPixel); lives in seconds.
export const DEATH_CUE = {
  flash: 0.14, // the white-hot model flash
  flashPeak: [3.2, 3.1, 2.9],
  burst: { own: 64, enemy: 52, infantry: 2.4, machine: 4.6 }, // the opening ring's sprite width (px floor, metres; the band is 0.72 of it)
  burstLife: 0.42,
  burstHold: 0.35, // the share of its life the ring stays at full strength before it fades
  core: 0.45, // the bright core, as a share of the ring
  coreLife: 0.16,
  marker: { own: 34, enemy: 28, infantry: 1.8, machine: 3.4 }, // the ring left where it fell (sprite width)
  markerLife: { own: 2.4, enemy: 1.4, eco: 0.9 },
  pop: { infantry: 0.32, machine: 0.3, seconds: 0.3, tilt: 0.12 }, // Unit motion: metres up, radians of extra tilt
  phonePop: 0.6, // the pop grows by up to this share at phone zoom
  cap: 24, // live flash records (the view's death cap)
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
// The share of "phone" in the current zoom: 0 at a desktop's ~24 px per metre, 1 at a phone's ~10.
export const phoneShare = (unitsPerPixel) => clamp01(((unitsPerPixel || 0) - 0.045) / 0.05);
// A size in metres that is never under `px` CSS pixels on screen.
export const floorSize = (metres, px, unitsPerPixel) => Math.max(metres, px * (unitsPerPixel || 0));
// What a death event gets: null for buildings, the Command core and a Kite's Dive (they have their own blasts).
export function cueKind(ev, dying) {
  if (ev?.type !== "death" || ev.building || ev.core || ev.dive) return null;
  if (!dying) return null;
  return dying.kind === "air" ? "air" : dying.kind === "vehicle" ? "machine" : dying.kind === "infantry" ? "infantry" : null;
}
// The minimap's mark for your own unit lost (src/app/frame.js): one per 1.5 s near the same place, at most five.
export const LOST_PING = { seconds: 2.5, near: 6, gap: 1.5, cap: 5 };
export function addLostPing(pings, ev, now) {
  if (ev?.type !== "death" || ev.team !== 0 || ev.building || !Number.isFinite(ev.x) || !Number.isFinite(ev.z)) return false;
  let lost = 0;
  for (const p of pings) {
    if (!p.lost) continue;
    lost++;
    if (now - p.at < LOST_PING.gap && Math.hypot(p.x - ev.x, p.z - ev.z) < LOST_PING.near) return false;
  }
  if (lost >= LOST_PING.cap) { const i = pings.findIndex((p) => p.lost); if (i >= 0) pings.splice(i, 1); }
  pings.push({ x: ev.x, z: ev.z, at: now, lost: true });
  return true;
}

export class DeathCueView {
  constructor(view) {
    this.view = view;
    this.cues = []; // live flash / pop records
    this.free = [];
    this.spawned = 0; // cues started this match (tests and probes)
    view.deathCues = this;
  }
  get live() { return this.cues.length; }
  get motion() { const v = this.view; return v.activity?.combat?.motion !== false && !v.reducedMotion?.matches; }
  get thin() { return this.view.motionLevel === 0; } // the frame governor at "still" (phones default to Eco: Eco keeps the cue)
  event(ev, sim) {
    if (ev.type !== "death" || ev.building || ev.core || ev.dive) return;
    const dying = this.view.dying;
    let d = null;
    if (dying) for (let i = dying.length - 1; i >= 0; i--) if (dying[i].id === ev.seed) { d = dying[i]; break; }
    const kind = cueKind(ev, d);
    if (!kind) return;
    this.spawned++;
    this.burst(d, kind, ev.team === 0);
    if (this.cues.length >= DEATH_CUE.cap) this.release(0);
    const c = this.free.pop() || { parts: [], saved: [], tint: [1, 1, 1] };
    c.d = d; c.kind = kind; c.own = ev.team === 0; c.t = 0; c.flashing = false; c.landed = kind !== "air";
    c.parts.length = c.saved.length = 0;
    d.object.userData.model?.traverse?.((part) => { if (part.isMesh && part.visible !== false) c.parts.push(part); });
    this.cues.push(c);
    this.flash(c, 0);
  }
  // The burst at the moment of death: a white core and a ring in the side's colour (air: in the air).
  burst(d, kind, own) {
    const v = this.view, fx = v.fx;
    if (!fx?.particle) return;
    const upp = v.unitsPerPixel, motion = this.motion, thin = this.thin, machine = kind !== "infantry";
    const team = rgb(v.colors?.[d.team] ?? 0xffffff), anchor = { x: d.x, z: d.z, team: d.team };
    const size = floorSize(machine ? DEATH_CUE.burst.machine : DEATH_CUE.burst.infantry, own ? DEATH_CUE.burst.own : DEATH_CUE.burst.enemy, upp);
    const air = kind === "air", o = d.object;
    const y = air ? o.position.y + (o.userData.model?.position?.y ?? 3) : (machine ? 1 : 0.8) + (v.terrain?.plateaus?.length ? v.terrain.heightAt(d.x, d.z) : 0);
    const white = [1, 0.97, 0.9, 0.95];
    fx.particle(fx.glow, { lifted: true, cell: CELL.glow, x: d.x, y, z: d.z, s0: size * DEATH_CUE.core, s1: size * DEATH_CUE.core * (motion ? 1.25 : 1), life: DEATH_CUE.coreLife,
      c0: white, c1: [team[0], team[1], team[2], 0], anchor, keep: true });
    // The ring is a thick band drawn normal-blended (the smoke pool: additive light washes out on bright sand and
    // snow) over a dark band a little wider, so the pale side colours read on light and dark ground alike.
    const ring = { x: d.x, z: d.z, cell: CELL.band, s0: motion ? size * 0.55 : size, s1: size, life: DEATH_CUE.burstLife, hold: DEATH_CUE.burstHold,
      c0: [team[0], team[1], team[2], 1], c1: [team[0], team[1], team[2], 0], anchor, keep: true, ...(air ? { lifted: true, y } : { y: 0.4, mode: FLAT }) };
    this.band(ring);
    if (own && !thin) this.band({ ...ring, delay: 0.12, s1: size * 1.3, c0: [team[0], team[1], team[2], 0.85] });
    if (!air) this.marker(d, own);
    if (machine && !air && !thin && motion)
      fx.burst(fx.smoke, 3, { x: d.x, y: 1.1, z: d.z }, { life: 1.2, s0: 0.7, s1: 2.2, drag: 1.6, gravity: -0.6, cell: CELL.puff,
        c0: [0.1, 0.095, 0.09, 0.8], c1: [0.28, 0.27, 0.26, 0], anchor, fadeIn: 0.06 }, [0.6, 1.4], 0.8);
  }
  // The ring left where it fell, in the side's colour, fading out (normal-blended, like the burst's ring).
  marker(d, own) {
    const v = this.view, fx = v.fx, team = rgb(v.colors?.[d.team] ?? 0xffffff), machine = d.kind !== "infantry";
    const size = floorSize(machine ? DEATH_CUE.marker.machine : DEATH_CUE.marker.infantry, own ? DEATH_CUE.marker.own : DEATH_CUE.marker.enemy, v.unitsPerPixel);
    const life = this.thin ? DEATH_CUE.markerLife.eco : own ? DEATH_CUE.markerLife.own : DEATH_CUE.markerLife.enemy;
    this.band({ x: d.x, y: 0.38, z: d.z, mode: FLAT, cell: CELL.band, s0: size, s1: size * 0.85, life, hold: 0.5, fadeIn: 0.12, delay: 0.2,
      c0: [team[0], team[1], team[2], own ? 0.9 : 0.75], c1: [team[0], team[1], team[2], 0], anchor: { x: d.x, z: d.z, team: d.team }, keep: true });
  }
  // A coloured band over its dark outline (two sprites of the smoke pool, the outline first so it draws under).
  band(o) {
    const fx = this.view.fx, a = o.c0[3];
    fx.particle(fx.smoke, { ...o, s0: o.s0 * 1.1, s1: o.s1 * 1.1, c0: [0.04, 0.04, 0.05, a * 0.55], c1: [0.04, 0.04, 0.05, 0], y: o.y - 0.01 });
    fx.particle(fx.smoke, o);
  }
  // The model's white-hot flash: the parts' tints are swapped for one shared array while it lasts and given back
  // after (a tint set meanwhile, such as the seared char, is kept).
  flash(c, dt) {
    const lit = this.motion && c.t < DEATH_CUE.flash;
    if (lit) {
      const k = 1 - c.t / DEATH_CUE.flash, p = DEATH_CUE.flashPeak;
      for (let i = 0; i < 3; i++) c.tint[i] = 1 + (p[i] - 1) * k;
      for (let i = 0; i < c.parts.length; i++) {
        const u = c.parts[i].userData;
        if (u.tint !== c.tint) { c.saved[i] = u.tint; u.tint = c.tint; }
      }
      c.flashing = true;
    } else if (c.flashing) this.unflash(c);
  }
  unflash(c) {
    for (let i = 0; i < c.parts.length; i++) {
      const u = c.parts[i].userData;
      if (u.tint === c.tint) u.tint = c.saved[i];
    }
    c.flashing = false;
  }
  release(i) {
    const c = this.cues[i];
    if (c.flashing) this.unflash(c);
    c.d = null; c.parts.length = c.saved.length = 0;
    this.cues.splice(i, 1);
    this.free.push(c);
  }
  // After WorldView.updateDying (which sets the fall's pose afresh each frame): the flash, the pop on top of the
  // fall and an air wreck's ring where it crashes.
  update(sim, dt) {
    const v = this.view, dying = v.dying, popOn = this.motion && v.richMotion !== false && v.motionLevel !== 0;
    const grow = 1 + DEATH_CUE.phonePop * phoneShare(v.unitsPerPixel);
    for (let i = this.cues.length - 1; i >= 0; i--) {
      const c = this.cues[i], d = c.d;
      if (!dying || !dying.includes(d)) { this.release(i); continue; }
      c.t = d.age;
      this.flash(c, dt);
      if (!c.landed && d.crashed) { c.landed = true; if (sim.isVisible?.(d) !== false) this.marker(d, c.own); }
      const o = d.object, m = o.userData.model, t = d.age, P = DEATH_CUE.pop;
      if (popOn && t < P.seconds && m) {
        const arc = Math.sin(Math.PI * clamp01(t / P.seconds));
        if (c.kind === "infantry") o.position.y += arc * P.infantry * grow;
        else if (c.kind === "machine") { o.position.y += arc * P.machine * grow; m.rotation.z += d.tilt * arc * P.tilt * grow; }
      }
      if (t >= P.seconds && !c.flashing && c.landed) this.release(i);
    }
  }
  reset() {
    for (let i = this.cues.length - 1; i >= 0; i--) this.release(i);
    this.spawned = 0;
  }
}
