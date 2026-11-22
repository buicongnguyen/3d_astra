// Counter-hit feedback (AAA round 2, W2-E): an effective hit flares gold (a star flare and gold sparks),
// a resisted hit puffs dull grey. Pooled particles only; random numbers from `rng`.
import { CELL } from "./cells.js";
import { flare, sparks } from "./common.js";

const GOLD = [1, 0.82, 0.3, 1], GOLD_END = [1, 0.55, 0.1, 0];
export function crit(fx, rng, at, anchor) {
  flare(fx, at, 1.7, [1, 0.92, 0.55, 1], 0.05, anchor);
  sparks(fx, rng, at, 6, anchor, 0.9, GOLD, GOLD_END);
}
export function resisted(fx, rng, at, anchor) {
  fx.particle(fx.smoke, { lifted: true, x: at.x, y: at.y, z: at.z, vy: fx.motion ? 0.7 : 0, drag: 1.2, life: 0.5, s0: 0.0875, s1: 0.275, cell: CELL.puff, c0: fx.dustColor(.55,at.x,at.z), c1: fx.dustColor(0,at.x,at.z),
    anchor, spin: (rng() - 0.5), rot: rng() * 6.28 });
  sparks(fx, rng, at, 2, anchor, 0.35, [0.78, 0.78, 0.76, 0.9], [0.6, 0.6, 0.6, 0]);
}
