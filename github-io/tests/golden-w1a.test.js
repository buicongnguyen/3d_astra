// Golden pin of W1-A (roster setting and faction workshops): an Expanded AI-against-AI match on a
// faction-isolated setup that no later package of the round changes, Wardens against Wardens on
// Dunes (the Wardens get no real workshop unit this round). Two fixture Wardens workshop units are
// injected here (a level 1 and a level 3 unit with `ai` data), so the pin covers host levelling and
// AI training. Pins are re-recorded only by the integrator, with a named reason.
// GOLDEN_RECORD=1 prints the values; GOLDEN_FULL=1 adds the long points.
import test from "node:test";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { skirmishSides } from "../src/factions.js";
import { run } from "./lib/sim.js";
import { LONG, pin } from "./lib/golden.mjs";

D.fxwarden1 = { ...D.drone, name: "Fixture one", workshop: "wardens", roster: "expanded", required_level: 1, cost: [110, 40], ai: { role: "line", want: [{ if: { seenInfantry: 0.6 }, n: 2 }, { n: 1 }], max: 2 } };
D.fxwarden3 = { ...D.drone, name: "Fixture three", workshop: "wardens", roster: "expanded", required_level: 3, cost: [140, 50], ai: { role: "back", want: [{ n: 1 }], max: 1 } };

const match = () => new Simulation({ map: "dunes", enemyCount: 1, aiSpeed: "normal", factions: skirmishSides("wardens", "mirror", 1, "dunes"), capturePoints: true, aiPlayer: true, rules: { roster: "expanded" } });
const PINS = { 60: "7333a2e4", 180: "9f2229f3", 600: "e4c0f4c3", 800: "e4c0f4c3" };

test("Expanded Wardens against Wardens, 60 and 180 s", () => {
  const sim = match();
  for (const at of [60, 180]) pin(`w1a wardens expanded ${at}`, run(sim, at), PINS[at]);
});

test("Expanded Wardens against Wardens, 600 and 800 s (workshop units trained)", LONG, () => {
  const sim = match();
  for (const at of [600, 800]) pin(`w1a wardens expanded ${at}`, run(sim, at), PINS[at]);
});
