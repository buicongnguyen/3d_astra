// Hawk: two pod rockets one after the other, each with a smoke trail (the pool's rocket projectile) and a small blast.
import { CELL, STRETCH } from "./cells.js";
import { flare, smokePuff } from "./common.js";

export default {
  id: "pods",
  spawn(fx, ev, rng, a) {
    const { from, to, ux, uz, sx, sz, anchor, travel } = a, c = a.color;
    for (let i = 0, n = fx.count(2); i < n; i++) {
      const side = (i ? 1 : -1) * 0.32, delay = i * 0.1;
      const f = { x: from.x + sx * side, y: from.y, z: from.z + sz * side, lifted: true }, t = { x: to.x + sx * side, y: to.y, z: to.z + sz * side, lifted: true };
      flare(fx, f, 0.7, [1, 0.9, 0.7, 0.95], 0.07, anchor, delay);
      smokePuff(fx, rng, f, -ux * 1.2, -uz * 1.2, anchor, 1.2, [0.6, 0.58, 0.55, 0.45], 0.7, delay);
      const dx = t.x - f.x, dy = t.y - f.y, dz = t.z - f.z, len = Math.hypot(dx, dy, dz) || 1, v = { vx: dx / travel, vy: dy / travel, vz: dz / travel };
      fx.particle(fx.glow, { ...f, ...v, mode: STRETCH, ax: dx / len, ay: dy / len, az: dz / len, length: Math.min(1.3, len), s0: 0.16, s1: 0.16, life: travel, cell: CELL.streak,
        c0: c, c1: [c[0], c[1], c[2], 0.8], anchor, delay, rot: rng() * 6.28 });
      fx.particle(fx.glow, { ...f, ...v, s0: 0.45, s1: 0.45, life: travel, c0: [1, 0.85, 0.5, 1], c1: [1, 0.7, 0.4, 1], anchor, delay, rot: rng() * 6.28 });
      fx.projectiles.push({ from: f, to: t, land: { x: t.x, y: 0.95, z: t.z }, travel, age: 0, wait: delay, rocket: true, cannon: false, power: a.power, anchor, trail: 0, weapon: ev.weapon });
    }
  },
};
