// Glider: a bomb dropped from the airframe, falling to the ground with a short streak, then a blast.
// Balloon (firebomb.js): the same drop as a burning ball with an ember trail and a fireball on landing.
import { CELL, STRETCH } from "./cells.js";
import { glow, onLand, sparks } from "./common.js";

const IRON = [0.13, 0.12, 0.12, 1], IRON_END = [0.2, 0.18, 0.17, 1], FIRE = [1, 0.62, 0.2, 1], FIRE_END = [1, 0.3, 0.05, 0.9];
export function drop(fx, ev, rng, a, fire) {
  const { from, to, ux, uy, uz, len, anchor, travel } = a, v = { vx: (to.x - from.x) / travel, vy: (to.y - from.y) / travel, vz: (to.z - from.z) / travel };
  // The body of the bomb, and its streak (stretched along the fall).
  fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y - 0.2, z: from.z, ...v, s0: fire ? 0.55 : 0.32, s1: fire ? 0.5 : 0.3, life: travel, cell: fire ? CELL.glow : CELL.puff,
    c0: fire ? FIRE : IRON, c1: fire ? FIRE_END : IRON_END, anchor, rot: rng() * 6.28 });
  fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y - 0.2, z: from.z, ...v, mode: STRETCH, ax: ux, ay: uy, az: uz, length: Math.min(1.6, len), s0: 0.1, s1: 0.08, life: travel, cell: CELL.streak,
    c0: fire ? [1, 0.7, 0.25, 0.9] : [0.9, 0.85, 0.7, 0.6], c1: [1, 0.5, 0.2, 0.2], anchor, rot: rng() * 6.28 });
  if (fire) for (let i = 0, n = fx.count(4); i < n; i++)
    fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y - 0.2, z: from.z, vx: v.vx * 0.9 + (rng() - 0.5), vy: v.vy * 0.9, vz: v.vz * 0.9 + (rng() - 0.5), life: travel * (0.6 + rng() * 0.4), s0: 0.16, s1: 0.03,
      cell: CELL.flare, c0: [1, 0.7, 0.3, 1], c1: FIRE_END, anchor, delay: i * travel * 0.12, rot: rng() * 6.28 });
  onLand(fx, a, () => {
    glow(fx, a.to, fire ? 3.4 : 2.4, fire ? [1, 0.55, 0.15, 0.9] : [1, 0.85, 0.5, 0.9], 0.2, anchor);
    if (fire) for (let i = 0, n = fx.count(5); i < n; i++)
      fx.particle(fx.glow, { lifted: true, x: a.land.x, y: 0.4, z: a.land.z, vx: (rng() - 0.5) * 3, vy: 1.2 + rng() * 1.6, vz: (rng() - 0.5) * 3, drag: 1.4, life: 0.5 + rng() * 0.3, s0: 0.9, s1: 0.2,
        c0: [1, 0.72, 0.25, 0.9], c1: [1, 0.3, 0.05, 0], anchor, rot: rng() * 6.28 });
    sparks(fx, rng, a.to, 4, anchor, 0.8);
  });
}
export default { id: "bomb", spawn: (fx, ev, rng, a) => drop(fx, ev, rng, a, false) };
