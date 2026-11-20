// Iron Vanguard (orange) and the Sovereign's light gun (cold white-cyan): heavy tracers hosed from the
// shoulders, one after another, alternating sides.
import { flare, tracer, onLand, sparks, glow } from "./common.js";

export default {
  id: "hose",
  spawn(fx, ev, rng, a) {
    const c = a.color;
    for (let i = 0, n = fx.count(4); i < n; i++) {
      const side = (i % 2 ? 1 : -1) * 0.9, delay = i * 0.05, at = { x: a.from.x + a.sx * side, y: a.from.y, z: a.from.z + a.sz * side };
      flare(fx, at, 1, [c[0], c[1], c[2], 0.95], 0.07, a.anchor, delay);
      tracer(fx, a, rng, { side, delay, width: 0.28, length: 3, c0: c, speed: 1.3, jitter: 0.12, head: 0.4 });
      onLand(fx, a, () => { glow(fx, a.to, 1.1, [c[0], c[1], c[2], 0.75], 0.12, a.anchor); sparks(fx, rng, a.to, 3, a.anchor, 0.6, [1, 0.9, 0.6, 1], [c[0], c[1], c[2], 0]); }, delay - a.travel * 0.2);
    }
  },
};
