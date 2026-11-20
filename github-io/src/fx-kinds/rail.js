// Watcher: a thin green rail shot, a ring at the muzzle and a green burst at the target.
import { CELL, STRETCH } from "./cells.js";
import { flare, ring, glow, sparks, fade } from "./common.js";

export default {
  id: "rail",
  spawn(fx, ev, rng, a) {
    const { from, to, ux, uy, uz, len, anchor } = a, c = a.color, hot = [0.9, 1, 0.92, 1];
    flare(fx, from, 0.9, hot, 0.08, anchor);
    ring(fx, from, 0.3, 1.2, c, 0.2, anchor);
    for (const [w, col, life] of [[0.07, hot, 0.2], [0.2, c, 0.26]])
      fx.particle(fx.glow, { lifted: true, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2, mode: STRETCH, ax: ux, ay: uy, az: uz, length: len,
        s0: w, s1: w * 0.4, life, cell: CELL.glow, c0: col, c1: fade(col), anchor, rot: rng() * 6.28 });
    ring(fx, to, 0.4, 2, c, 0.3, anchor, 0.03);
    glow(fx, to, 1.2, [c[0], c[1], c[2], 0.75], 0.16, anchor, 0.02);
    sparks(fx, rng, to, 4, anchor, 0.6, hot, fade(c));
  },
};
