// Vanguard: a 3-round burst, each round a short tracer with its own muzzle flick.
import { flare, tracer, onLand, sparks } from "./common.js";

export default {
  id: "burst",
  spawn(fx, ev, rng, a) {
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.06;
      flare(fx, a.from, 0.5, [1, 0.92, 0.65, 0.9], 0.04, a.anchor, delay);
      tracer(fx, a, rng, { delay, width: 0.12, length: 1.6, speed: 1.3, jitter: 0.1 });
      if (i !== 1) onLand(fx, a, () => sparks(fx, rng, a.to, 2, a.anchor, 0.4), delay - a.travel * 0.23);
    }
  },
};
