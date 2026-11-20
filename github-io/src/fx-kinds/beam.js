// Shade (and the Stalker, longer and thinner): an instant beam from muzzle to target and a ring where it ends.
import { CELL, STRETCH } from "./cells.js";
import { flare, ring, glow, sparks, fade } from "./common.js";

export default {
  id: "beam",
  spawn(fx, ev, rng, a) {
    const { from, to, ux, uy, uz, len, anchor, style } = a;
    const life = style.beamLife ?? 0.12, width = style.beamWidth ?? 0.2, c0 = a.color, hot = [1, 1, 1, 1];
    flare(fx, from, 0.8, hot, 0.07, anchor);
    // The beam: a hot white core over a coloured sheath (two stretched quads along the whole path).
    for (const [w, col] of [[width * 0.45, hot], [width, c0]])
      fx.particle(fx.glow, { lifted: true, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2, mode: STRETCH, ax: ux, ay: uy, az: uz,
        length: len, s0: w, s1: w * 0.5, life, cell: CELL.glow, c0: col, c1: fade(col), anchor, rot: rng() * 6.28 });
    ring(fx, to, 0.3, style.ring ?? 1.5, c0, 0.26, anchor, 0.02);
    glow(fx, to, 0.9, [c0[0], c0[1], c0[2], 0.7], 0.14, anchor);
    sparks(fx, rng, to, 3, anchor, 0.5, hot, fade(c0));
  },
};
