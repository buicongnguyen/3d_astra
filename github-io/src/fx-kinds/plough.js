// Rampart: a short, fat plough cannon round, a dust wake kicked up under the hull and a heavy puff of smoke.
// R3-X: the round is a fat glowing shell on a slight arc with a short smoke trail (src/fx-kinds/ordnance.js).
import { flare, smokePuff } from "./common.js";
import { launch } from "./ordnance.js";
import { spriteMuzzle } from "./sprite-fx.js";

export default {
  id: "plough",
  spawn(fx, ev, rng, a) {
    const { from, anchor } = a;
    flare(fx, from, 2.1, undefined, 0.1, anchor);
    spriteMuzzle(fx, from, a.ux, a.uy, a.uz, "large", anchor, 1.1); // R3-FX
    smokePuff(fx, rng, from, a.ux * 1.6, a.uz * 1.6, anchor, 2.4, undefined, 1.1);
    launch(fx, "shell", a, ev, { body: 1.25 });
    // The wake: dust thrown up behind the hull along the ground, a few puffs spread over a second.
    for (let i = 0; i < 3; i++)
      fx.dust({ x: ev.x - a.nx * (1.2 + i * 0.9) + (rng() - 0.5) * 0.6, y: 0.25, z: ev.z - a.nz * (1.2 + i * 0.9) + (rng() - 0.5) * 0.6 }, 1, anchor, 0.9, 0.9);
  },
};
