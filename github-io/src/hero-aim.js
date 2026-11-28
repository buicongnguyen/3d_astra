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

// Body pick (owner 2026-11-28: "in landed skywing, it seems that I have to aim at their feet"): from the low shoulder camera the
// ground under the reticle lies far behind a soldier the reticle sits on, so the page first casts the camera ray against
// every candidate's body, an upright cylinder of its radius (at least BODY.minRadius) and height (BODY heights, or the
// drawn model's via `size(t)` -> { r, h, base }), and takes the nearest one the ray meets in reach. Only when the ray meets
// no body does the ground point (pickTarget's assist) decide. `ray` = { o: {x,y,z}, d: {x,y,z} } in world metres (d unit
// length), `groundAt(x, z)` the terrain height. Returns { target, x, y, z } (the point on the body) or null.
export const BODY = Object.freeze({ infantry: 1.8, vehicle: 2.2, building: 3.5, flyer: 1.6, minRadius: 0.55, pad: 0.15 });
export function bodyHeight(t) {
  return t.kind === "building" ? BODY.building : t.flying ? BODY.flyer : t.mechanical ? BODY.vehicle : BODY.infantry;
}
export function rayPick(sim, hero, ray, groundAt, { reach = AIM.reach, size = null } = {}) {
  if (!hero || !ray) return null;
  const range = (hero.range || 0) + reach, { o, d } = ray, flat = Math.hypot(d.x, d.z);
  let best = null, bestT = Infinity;
  for (const t of sim.entities) {
    if (!(t.hp > 0) || (t.kind !== "unit" && t.kind !== "building") || !sim.hostile(hero.team, t.team) || !sim.isVisible(t, hero.team)) continue;
    if (t.flying && !sim.canHit(hero, t)) continue;
    if (Math.hypot(t.x - hero.x, t.z - hero.z) - (t.radius || 0) > range) continue;
    const s = size?.(t), r = Math.max(BODY.minRadius, s?.r ?? t.radius ?? 0.6) + BODY.pad, h = s?.h ?? bodyHeight(t);
    const base = s?.base ?? groundAt(t.x, t.z) + (t.flying ? (t.fly || 3.5) - h / 2 : 0);
    if (flat < 1e-6) continue;
    // The ray's closest approach to the body's axis in the ground plane, then the height there.
    const px = t.x - o.x, pz = t.z - o.z, along = (px * d.x + pz * d.z) / (flat * flat);
    const cx = o.x + d.x * along - t.x, cz = o.z + d.z * along - t.z, miss2 = cx * cx + cz * cz;
    if (miss2 > r * r) continue;
    const half = Math.sqrt(r * r - miss2) / flat;
    // Entry into the cylinder, or the first point of it within its height (a ray from above enters through the top).
    for (const k of [along - half, along, along + half]) {
      if (k <= 0) continue;
      const y = o.y + d.y * k;
      if (y < base - 0.05 || y > base + h + 0.05) continue;
      if (k < bestT) { bestT = k; best = { target: t, x: o.x + d.x * k, y, z: o.z + d.z * k }; }
      break;
    }
  }
  return best;
}

// The camera ray against one upright cylinder (centre x, z; radius r; from `base` up `h` m). Returns the ray distance of
// its first point inside, or null.
export function rayCylinder(ray, x, z, r, base, h) {
  const { o, d } = ray, flat = Math.hypot(d.x, d.z);
  if (flat < 1e-6) return null;
  const px = x - o.x, pz = z - o.z, along = (px * d.x + pz * d.z) / (flat * flat);
  const cx = o.x + d.x * along - x, cz = o.z + d.z * along - z, miss2 = cx * cx + cz * cz;
  if (miss2 > r * r) return null;
  const half = Math.sqrt(r * r - miss2) / flat;
  for (const k of [along - half, along, along + half]) {
    if (k <= 0) continue;
    const y = o.y + d.y * k;
    if (y >= base - 0.05 && y <= base + h + 0.05) return k;
  }
  return null;
}
// H8 explosive barrels under the body pick: the intact hazard (`list` of [x, z, intact]) the camera ray meets first, as
// { i, k } (k: its distance along the ray), or null. The page compares k with the body hit, so a barrel in front of an
// enemy (or of a building behind it) still takes the crosshair.
export function rayHazard(list, ray, groundAt, { r = 0.7, h = 1.1 } = {}) {
  if (!ray || !list?.length) return null;
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const z = list[i];
    if (!z[2]) continue;
    const k = rayCylinder(ray, z[0], z[1], r, groundAt(z[0], z[1]), h);
    if (k !== null && (!best || k < best.k)) best = { i, k };
  }
  return best;
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
