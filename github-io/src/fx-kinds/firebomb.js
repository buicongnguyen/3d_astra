// Balloon: a burning bomb (the drop itself is drawn by bomb.js, with the fire variant on).
import { drop } from "./bomb.js";

export default { id: "firebomb", spawn: (fx, ev, rng, a) => drop(fx, ev, rng, a, true) };
