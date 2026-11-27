// H3a Hero mode: the aiming rules, pure and unit-tested (tests/hero-mode.test.js). The page (src/hero-mode.js)
// turns the pointer, the reticle and the camera into an aim point on the ground; these pick the target.
//   pickTarget  aim assist: the enemy nearest the aim line inside the cone (and in reach), else the enemy nearest
//               the aim point within `snap` metres (a tap on a unit), else null
//   RocketLock  Skywing's rocket: holding on one target for LOCK_SECONDS locks it; then it fires
//   moveVector  the move stick in camera space (right, forward) to a world x/z direction
//   battleTime  the eased clock scale while entering or leaving Hero mode
import { HERO_TIME } from "./sim/content/hero-mode.js";

export const AIM = Object.freeze({ cone: 12, conePhone: 18, snap: 3.5, reach: 2 });
export const LOCK_SECONDS = 0.6;

const angleBetween = (ax, az, bx, bz) => {
  const d = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
  return Math.abs(d);
};

// `hero` { x, z, team, range }, `aim` { x, z } on the ground. Candidates: alive, hostile, seen, hittable, within reach.
export function pickTarget(sim, hero, aim, { cone = AIM.cone, snap = AIM.snap, reach = AIM.reach } = {}) {
  if (!hero || !aim) return null;
  const dx = aim.x - hero.x, dz = aim.z - hero.z, far = Math.hypot(dx, dz) > 0.5;
  const limit = (cone * Math.PI) / 180, range = (hero.range || 0) + reach;
  let best = null, bestA = Infinity, bestD = Infinity, near = null, nearD = snap;
  for (const t of sim.entities) {
    if (!(t.hp > 0) || (t.kind !== "unit" && t.kind !== "building") || !sim.hostile(hero.team, t.team) || !sim.isVisible(t, hero.team)) continue;
    if (t.flying && !sim.canHit(hero, t)) continue;
    const tx = t.x - hero.x, tz = t.z - hero.z, d = Math.hypot(tx, tz) - (t.radius || 0);
    if (d > range) continue;
    const toAim = Math.hypot(t.x - aim.x, t.z - aim.z) - (t.radius || 0);
    if (toAim < nearD || (toAim === nearD && near && t.id < near.id)) { near = t; nearD = toAim; }
    if (!far) continue;
    const a = angleBetween(dx, dz, tx, tz);
    if (a > limit) continue;
    // Units before buildings, then the smaller angle, then the nearer, then the lower id.
    const rank = (t.kind === "unit" ? 0 : 10) + a;
    if (rank < bestA - 1e-9 || (Math.abs(rank - bestA) <= 1e-9 && (d < bestD || (d === bestD && t.id < best.id)))) { best = t; bestA = rank; bestD = d; }
  }
  return near && (!best || nearD < 1) ? near : best || near;
}

// Holding on a target: `update(targetId, dt)` returns the locked id once the same target was held
// LOCK_SECONDS, else null. A new target or none starts over; `progress` is 0..1 for the lock ring.
export class RocketLock {
  constructor(seconds = LOCK_SECONDS) {
    this.seconds = seconds;
    this.reset();
  }
  reset() {
    this.target = null;
    this.held = 0;
  }
  get progress() {
    return this.target === null ? 0 : Math.min(1, this.held / this.seconds);
  }
  update(target, dt) {
    if (target === null || target === undefined) { this.reset(); return null; }
    if (target !== this.target) { this.target = target; this.held = 0; }
    this.held += Math.max(0, dt);
    return this.held >= this.seconds - 1e-9 ? target : null;
  }
}

// The stick in camera space (right, forward; each -1..1) to a world direction, from the camera's right and
// forward vectors on the ground ({ x, z }, unit length). Quantised to 1/16 steps so a still hand sends no command.
export function moveVector(right, forward, camRight, camForward) {
  let x = camRight.x * right + camForward.x * forward, z = camRight.z * right + camForward.z * forward;
  const n = Math.hypot(x, z);
  if (n < 0.12) return { x: 0, z: 0 };
  const k = Math.min(1, n) / n;
  x *= k; z *= k;
  const q = (v) => Math.round(v * 16) / 16;
  return { x: q(x), z: q(z) };
}

// The clock scale `t` real seconds into an ease from `from` to `to` (HERO_TIME.ease seconds, smoothstep).
export function battleTime(from, to, t, seconds = HERO_TIME.ease) {
  if (!(seconds > 0) || t >= seconds) return to;
  const k = Math.max(0, t / seconds), s = k * k * (3 - 2 * k);
  return from + (to - from) * s;
}
