// Gunner: a true machine-gun stream, many small bright tracers close together, with a spent case thrown out.
import { CELL } from "./cells.js";
import { flare, tracer, onLand, sparks } from "./common.js";

export default {
  id: "stream",
  spawn(fx, ev, rng, a) {
    for (let i = 0, n = fx.count(5); i < n; i++) {
      const delay = i * 0.028;
      flare(fx, a.from, 0.45, [1, 0.9, 0.55, 0.9], 0.035, a.anchor, delay);
      tracer(fx, a, rng, { delay, width: 0.09, length: 1.2, speed: 1.6, jitter: 0.14 });
      if (i % 2 === 0) onLand(fx, a, () => sparks(fx, rng, a.to, 2, a.anchor, 0.35), delay - a.travel * 0.38);
    }
    fx.particle(fx.glow, { lifted: true, x: a.from.x, y: a.from.y - 0.1, z: a.from.z, vx: a.sx * 2.2, vy: 2.2, vz: a.sz * 2.2, gravity: 14, life: 0.3, s0: 0.07, s1: 0.05,
      cell: CELL.flare, c0: [1, 0.85, 0.4, 0.9], c1: [1, 0.7, 0.2, 0], anchor: a.anchor, rot: rng() * 6.28 });
  },
};
