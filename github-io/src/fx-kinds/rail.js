// Watcher: a thin green rail shot, a ring at the muzzle and a green burst at the target.
// R3-X: a short charge at the muzzle for the shot's flight time, then the rail snaps out as the hit lands and fades
// from the muzzle forward (beam.js beamLine).
import { ring, glow, sparks, fade } from "./common.js";
import { chargeGlow, beamLine } from "./beam.js";
import { spriteBeamImpact, spriteBeamLine } from "./sprite-fx.js";

const HOT = [0.9, 1, 0.92, 1];
export default {
  id: "rail",
  spawn(fx, ev, rng, a) {
    const { from, to, anchor, travel } = a, c = a.color;
    chargeGlow(fx, rng, from, c, travel, anchor, 0.8);
    ring(fx, from, 0.3, 1.2, c, 0.2, anchor, travel);
    // R3-FX2: the magenta-white beam-line strip (the rail), tiled along the ray with caps.
    if (!spriteBeamLine(fx, from, to, a.ux, a.uy, a.uz, "magenta", 0.9, 0.32, anchor, travel)) {
      beamLine(fx, rng, a, HOT, 0.07, 0.2, travel);
      beamLine(fx, rng, a, c, 0.2, 0.26, travel);
    }
    spriteBeamImpact(fx, { x: to.x, y: to.y - fx.ground(to.x, to.z), z: to.z }, c, anchor, travel); // R3-FX: the beam-impact sheet at the hit
    ring(fx, to, 0.4, 2, c, 0.3, anchor, travel + 0.03);
    glow(fx, to, 1.2, [c[0], c[1], c[2], 0.75], 0.16, anchor, travel + 0.02);
    sparks(fx, rng, to, 4, anchor, 0.6, HOT, fade(c), travel);
  },
};
