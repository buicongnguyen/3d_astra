// Golden pin of W2-D (Field command AI plan): AI against AI with the Classic roster, Meridian against
// Ashfall, Dunes, Normal, rules { aiPlan: "field" }. 180 s in npm test, 600 s with GOLDEN_FULL.
import test from "node:test";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { LONG, pin } from "./lib/golden.mjs";
const match = () => new Simulation({ map: "dunes", aiSpeed: "normal", factions: { 0: "meridian", 1: "ashfall" }, capturePoints: true, aiPlayer: true, rules: { aiPlan: "field" } });
const PINS = { 180: "80fb27d8", 600: "549eb7a3" };
test("Field command, Meridian against Ashfall, 180 s", () => pin("w2d field 180", run(match(), 180), PINS[180]));
test("Field command, Meridian against Ashfall, 600 s", LONG, () => pin("w2d field 600", run(match(), 600), PINS[600]));
