// Walker: two heavy rounds from twin barrels, a beat apart, each with a muzzle blast and a shell burst.
// R3-X: each round is a glowing shell on a slight arc with a short smoke trail (src/fx-kinds/ordnance.js, the
// ordnance mesh). The second barrel fires a beat early, so both shells land together on the target's hit.
import { flare, smokePuff } from "./common.js";
import { launch } from "./ordnance.js";
import { spriteMuzzle, spriteStomp } from "./sprite-fx.js";

const BEAT = 0.14;
export default {
  id: "twin-heavy",
  spawn(fx, ev, rng, a) {
    spriteStomp(fx, { x: ev.x, y: 0.1, z: ev.z }, a.anchor); // R3-FX2: the walker-stomp sheet at its feet, so a Walker does not read as a Tank
    for (let i = 0; i < 2; i++) {
      const side = (i ? 1 : -1) * 0.38, delay = i ? 0 : BEAT, at = { x: a.from.x + a.sx * side, y: a.from.y, z: a.from.z + a.sz * side };
      flare(fx, at, 2.1, fx.motion ? undefined : [1, 0.8, 0.5, 0.45], 0.1, a.anchor, delay);
      fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, s0: 2.1, s1: 2.5, life: 0.13, c0: [1, 0.72, 0.35, 0.7], c1: [1, 0.4, 0.1, 0], anchor: a.anchor, delay, rot: rng() * 6.28 });
      spriteMuzzle(fx, at, a.ux, a.uy, a.uz, "medium", a.anchor, 1.05); // R3-FX: the muzzle-flash sheet, turned along the barrel
      smokePuff(fx, rng, at, a.ux * 1.5, a.uz * 1.5, a.anchor, 1.6, undefined, 0.9, delay);
      // The first barrel waits a beat and flies a beat faster: both land at `travel`.
      launch(fx, "shell", a, ev, { side, delay, travel: Math.max(0.08, a.travel - delay) }).walker = true;
    }
  },
};
