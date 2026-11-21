// The weapon looks of the combat effects (AAA round 2, W2-E). `LOOKS` maps a look id (the `look` field of a
// `weapons` entry in src/visual-style.json) to its kind: `{ id, spawn(fx, ev, rng, aim) }`, see common.js.
// A weapon without a look (rifle, cannon, rocket, support) keeps the shot drawing of src/fx.js.
// Registry: add a file in this folder and one line here.
import flame from "./flame.js";
import beam from "./beam.js";
import twinPulse from "./twin-pulse.js";
import pellets from "./pellets.js";
import pods from "./pods.js";
import bomb from "./bomb.js";
import firebomb from "./firebomb.js";
import twinTracer from "./twin-tracer.js";
import burst from "./burst.js";
import twinHeavy from "./twin-heavy.js";
import rail from "./rail.js";
import hose from "./hose.js";
import stream from "./stream.js";
import plough from "./plough.js";
import rocket from "./rocket.js";

export const LOOKS = Object.freeze(Object.fromEntries([flame, beam, twinPulse, pellets, pods, bomb, firebomb, twinTracer, burst, twinHeavy, rail, hose, stream, plough, rocket].map((k) => [k.id, k])));
export { MOMENTS, shimmer } from "./moments.js";
