// Rampart: a short, fat plough cannon round, a dust wake kicked up under the hull and a heavy puff of smoke.
import { flare, tracer, smokePuff, onLand } from "./common.js";

export default {
  id: "plough",
  spawn(fx, ev, rng, a) {
    const { from, anchor } = a;
    flare(fx, from, 1.5, undefined, 0.1, anchor);
    smokePuff(fx, rng, from, a.ux * 1.6, a.uz * 1.6, anchor, 1.8, undefined, 0.9);
    tracer(fx, a, rng, { width: 0.36, length: 1.6, c0: a.color, head: 0.7, speed: 1.1 });
    // The wake: dust thrown up behind the hull along the ground, a few puffs spread over a second.
    for (let i = 0; i < 3; i++)
      fx.dust({ x: ev.x - a.nx * (1.2 + i * 0.9) + (rng() - 0.5) * 0.6, y: 0.25, z: ev.z - a.nz * (1.2 + i * 0.9) + (rng() - 0.5) * 0.6 }, 1, anchor, 0.9, 0.9);
    onLand(fx, a, () => fx.hit(a.land, a.power, anchor));
  },
};
