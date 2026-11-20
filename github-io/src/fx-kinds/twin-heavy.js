// Walker: two heavy rounds from twin barrels, a beat apart, each with a muzzle blast and a shell burst.
import { flare, tracer, smokePuff, onLand } from "./common.js";

const SHELL = [1, 0.78, 0.4, 1];
export default {
  id: "twin-heavy",
  spawn(fx, ev, rng, a) {
    for (let i = 0; i < 2; i++) {
      const side = (i ? 1 : -1) * 0.38, delay = i * 0.14, at = { x: a.from.x + a.sx * side, y: a.from.y, z: a.from.z + a.sz * side };
      flare(fx, at, 1.5, undefined, 0.1, a.anchor, delay);
      fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, s0: 2.1, s1: 2.5, life: 0.13, c0: [1, 0.72, 0.35, 0.7], c1: [1, 0.4, 0.1, 0], anchor: a.anchor, delay, rot: rng() * 6.28 });
      smokePuff(fx, rng, at, a.ux * 1.5, a.uz * 1.5, a.anchor, 1.6, undefined, 0.9, delay);
      tracer(fx, a, rng, { side, delay, width: 0.3, length: 2.2, c0: SHELL, head: 0.65 });
      onLand(fx, a, () => fx.hit(a.land, a.power, a.anchor), delay);
    }
  },
};
