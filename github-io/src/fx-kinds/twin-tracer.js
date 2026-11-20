// Rider: two fast thin tracers side by side.
import { flare, tracer } from "./common.js";

export default {
  id: "twin-tracer",
  spawn(fx, ev, rng, a) {
    flare(fx, a.from, 0.55, [1, 0.95, 0.7, 0.9], 0.05, a.anchor);
    for (let i = 0, n = fx.count(2); i < n; i++)
      tracer(fx, a, rng, { side: (i ? 1 : -1) * 0.18, delay: i * 0.035, width: 0.1, length: 2.2, speed: 1.6, jitter: 0.03 });
  },
};
