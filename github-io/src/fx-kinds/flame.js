// Scorcher: a cone of flame puffs and embers sprayed at the target, a scorch where it lands.
import { CELL } from "./cells.js";
import { flare, glow, smokePuff, sparks, onLand } from "./common.js";

const FLAME = [1, 0.72, 0.24, 0.95], FLAME_END = [0.7, 0.14, 0.04, 0], EMBER = [1, 0.7, 0.3, 1], EMBER_END = [1, 0.3, 0.05, 0];
export default {
  id: "flame",
  spawn(fx, ev, rng, a) {
    const { from, ux, uy, uz, sx, sz, anchor, len, travel } = a;
    flare(fx, from, 1.1, [1, 0.8, 0.4, 0.9], 0.1, anchor);
    const speed = Math.max(4, len / Math.max(0.12, travel * 1.6));
    for (let i = 0, n = fx.count(8); i < n; i++) {
      const spread = (rng() - 0.5) * 0.55, v = speed * (0.7 + rng() * 0.5);
      fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, vx: (ux + sx * spread) * v, vy: uy * v + (rng() - 0.5) * 0.8, vz: (uz + sz * spread) * v,
        drag: 1.6, life: 0.26 + rng() * 0.16, s0: 0.22, s1: 0.8 + rng() * 0.5, c0: FLAME, c1: FLAME_END, anchor, delay: i * 0.018, spin: (rng() - 0.5) * 2, rot: rng() * 6.28 });
    }
    for (let i = 0, n = fx.count(3); i < n; i++)
      fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, vx: (ux + (rng() - 0.5) * 0.5) * speed * 0.6, vy: 1.5 + rng() * 1.5, vz: (uz + (rng() - 0.5) * 0.5) * speed * 0.6,
        gravity: 4, drag: 1, life: 0.5 + rng() * 0.3, s0: 0.1, s1: 0.02, cell: CELL.flare, c0: EMBER, c1: EMBER_END, anchor, delay: i * 0.05, rot: rng() * 6.28 });
    smokePuff(fx, rng, from, ux * 1.2, uz * 1.2, anchor, 1.3, [0.18, 0.17, 0.16, 0.45], 0.8, 0.12);
    onLand(fx, a, () => {
      glow(fx, a.to, 1.6, [1, 0.6, 0.2, 0.8], 0.25, anchor);
      sparks(fx, rng, a.to, 3, anchor, 0.45, EMBER, EMBER_END);
      fx.scorch(a.land, 1.3, anchor);
    }, travel * 0.3);
  },
};
