// Drone: two short blue laser pulses, a hair apart, and a blue flicker where they land.
import { flare, tracer, glow, onLand, sparks, fade } from "./common.js";

const PULSE = [0.45, 0.78, 1, 1], PULSE_END = [0.3, 0.5, 1, 0.7];
export default {
  id: "twin-pulse",
  spawn(fx, ev, rng, a) {
    const c = a.color || PULSE;
    flare(fx, a.from, 0.6, [c[0], c[1], c[2], 0.9], 0.06, a.anchor);
    for (let i = 0, n = fx.count(2); i < n; i++) {
      const side = (i ? 1 : -1) * 0.22, delay = i * 0.07;
      tracer(fx, a, rng, { side, delay, width: 0.12, length: 1.1, c0: c, c1: PULSE_END, speed: 1.4, head: 0.28 });
      const at = { x: a.to.x + a.sx * side, y: a.to.y, z: a.to.z + a.sz * side };
      onLand(fx, a, () => { glow(fx, at, 0.7, [c[0], c[1], c[2], 0.85], 0.12, a.anchor); sparks(fx, rng, at, 2, a.anchor, 0.4, c, fade(c)); }, delay - a.travel * 0.29);
    }
  },
};
