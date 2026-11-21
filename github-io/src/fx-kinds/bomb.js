// Glider: a bomb dropped from the airframe, falling to the ground, then a blast.
// Balloon (firebomb.js): the same drop as a burning bomb with an ember trail and a fireball on landing.
// R3-X: the bomb is a real finned body (the ordnance mesh, one draw for every round in flight) that falls faster
// and faster and grows as it nears the ground, over a shadow dot that darkens where it will land; it lands exactly
// when the hit does (src/fx-kinds/ordnance.js landRound: the heavy hit, dust thrown out, fire for the Balloon).
import { launch, shadowDot } from "./ordnance.js";

export function drop(fx, ev, rng, a, fire) {
  const { anchor } = a;
  const r = launch(fx, "bomb", a, ev, { fire });
  r.from.y -= 0.2; // out of the belly
  shadowDot(fx, a.land.x, a.land.z, r.travel, anchor);
  return r;
}
export default { id: "bomb", spawn: (fx, ev, rng, a) => drop(fx, ev, rng, a, false) };
