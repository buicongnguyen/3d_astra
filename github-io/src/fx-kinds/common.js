// Helpers shared by the weapon kinds in this folder (AAA round 2, W2-E). A kind is
//   { id, spawn(fx, ev, rng, a) }          draws one shot (motion on; the static version is src/fx.js's)
// with `fx` the Effects (its pooled layers glow / smoke / decals), `ev` the shot event, `rng` the random
// source (injected: the per-match seeded generator) and `a` the aim:
//   from, to      muzzle and aim point in the world (y includes the ground)     land   the ground point
//   ux, uy, uz    unit direction muzzle -> aim        len   distance         sx, sz   unit sideways (horizontal)
//   nx, nz        horizontal unit direction           travel   seconds a round flies      anchor   the fog anchor
//   power         how hard the landing hits (src/combat-feedback.js hitPower, or style.hit)
//   style, color  the weapon style (src/visual-style.js) and its tracer colour (faction tinted for shared weapons)
// Everything here draws from the existing pools (no new draw call). Random numbers only through `rng`.
import { CELL, STRETCH } from "./cells.js";

const FLASH = [1, 0.96, 0.82, 1], FLASH_END = [1, 0.55, 0.15, 0];
const fade = (c, a = 0) => [c[0], c[1], c[2], a];

// A short star flare at the muzzle (or anywhere): `size` metres, `life` seconds.
export function flare(fx, at, size, c0 = FLASH, life = 0.07, anchor = null, delay = 0) {
  return fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, cell: CELL.flare, s0: size, s1: size * 1.2, life, c0, c1: c0 === FLASH ? FLASH_END : fade(c0), anchor, delay });
}
// A soft glow blob.
export function glow(fx, at, size, c0, life, anchor, delay = 0, grow = 1.3) {
  return fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, s0: size, s1: size * grow, life, c0, c1: fade(c0), anchor, delay });
}
// A ring that opens on the spot (billboard).
export function ring(fx, at, s0, s1, c0, life, anchor, delay = 0) {
  return fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, cell: CELL.ring, s0, s1, life, c0, c1: fade(c0), anchor, delay });
}
// One streak flying muzzle -> aim, sideways `side` metres, starting `delay` s late. `speed` scales the flight time.
export function tracer(fx, a, rng, { side = 0, delay = 0, width = 0.15, length = 2, c0, c1, speed = 1, jitter = 0, head = 0 } = {}) {
  const j = jitter ? (rng() - 0.5) * 2 * jitter : 0, o = side + j;
  const fx0 = a.from.x + a.sx * o, fz0 = a.from.z + a.sz * o, tx = a.to.x + a.sx * o, tz = a.to.z + a.sz * o;
  const dx = tx - fx0, dy = a.to.y - a.from.y, dz = tz - fz0, len = Math.hypot(dx, dy, dz) || 1, life = Math.max(0.04, a.travel / speed);
  const stroke = Math.max(width, 4 * (fx.view?.unitsPerPixel || 0));
  const col = c0 || a.color, end = c1 || fade(col, 0.8);
  const p = fx.particle(fx.glow, { lifted: true, x: fx0, y: a.from.y, z: fz0, vx: dx / life, vy: dy / life, vz: dz / life, mode: STRETCH,
    ax: dx / len, ay: dy / len, az: dz / len, length: Math.min(Math.max(length, 16 * (fx.view?.unitsPerPixel || 0)), len), s0: stroke, s1: stroke, life, cell: CELL.streak, c0: col, c1: end, anchor: a.anchor, delay, rot: rng() * 6.28 });
  if (head) fx.particle(fx.glow, { lifted: true, x: fx0, y: a.from.y, z: fz0, vx: dx / life, vy: dy / life, vz: dz / life, s0: head, s1: head, life, c0: col, c1: end, anchor: a.anchor, delay, rot: rng() * 6.28 });
  return p;
}
// A metal-spark burst at a point: streaks thrown out with gravity (rng-driven, unlike fx.sparks).
export function sparks(fx, rng, at, n, anchor, power = 1, c0 = [1, 0.88, 0.55, 1], c1 = [1, 0.45, 0.12, 0], delay = 0) {
  for (let i = 0, count = fx.count(n); i < count; i++) {
    const ang = rng() * Math.PI * 2, e = 0.3 + rng() * 0.7, v = (4 + rng() * 5) * power;
    const vx = Math.cos(ang) * e * v, vy = (0.4 + rng()) * v * 0.7, vz = Math.sin(ang) * e * v, l = Math.hypot(vx, vy, vz) || 1;
    fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, vx, vy, vz, gravity: 14, drag: 1.5, life: 0.22 + rng() * 0.22, mode: STRETCH,
      ax: vx / l, ay: vy / l, az: vz / l, length: 0.3 * power, s0: 0.06, s1: 0.035, cell: CELL.streak, c0, c1, floor: 0.05, anchor, delay, rot: rng() * 6.28 });
  }
}
// A puff of smoke drifting forward from the muzzle.
export function smokePuff(fx, rng, at, vx, vz, anchor, s1 = 1.5, c0 = [0.6, 0.58, 0.55, 0.5], life = 0.9, delay = 0) {
  fx.particle(fx.smoke, { lifted: true, x: at.x, y: at.y, z: at.z, vx, vy: 0.5 + rng() * 0.4, vz, drag: 2.2, life: life + rng() * 0.3, s0: 0.4, s1,
    cell: CELL.puff, c0, c1: fade(c0), anchor, spin: (rng() - 0.5) * 1.6, rot: rng() * 6.28, delay });
}
// Runs `fn` when the round lands (and `after` seconds later): the hit effects of a kind.
export function onLand(fx, a, fn, after = 0) { fx.timeline.push({ at: fx.time + a.travel + after, run: fn }); }
export { fade };
