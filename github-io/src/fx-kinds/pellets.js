// Scrapper: three pellets in a short fan, metal sparks where they strike.
import { flare, tracer, onLand, sparks } from "./common.js";

const PELLET = [1, 0.82, 0.45, 1];
export default {
  id: "pellets",
  spawn(fx, ev, rng, a) {
    const c = a.color || PELLET;
    flare(fx, a.from, 0.55, [1, 0.86, 0.5, 0.9], 0.06, a.anchor);
    for (let i = 0, n = fx.count(3); i < n; i++) {
      const side = (i - 1) * 0.3 + (rng() - 0.5) * 0.12;
      tracer(fx, a, rng, { side, width: 0.17, length: 0.7, c0: c, speed: 0.9 + rng() * 0.2, head: 0.2 });
    }
    onLand(fx, a, () => sparks(fx, rng, a.to, 5, a.anchor, 0.55, [1, 0.85, 0.55, 1], [0.9, 0.4, 0.1, 0]));
  },
};
