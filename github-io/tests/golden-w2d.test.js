// Golden pin of W2-D (Field command AI plan): AI against AI with the Classic roster, Meridian against
// Ashfall, Dunes, Normal, rules { aiPlan: "field" }. 180 s in npm test, 600 s with GOLDEN_FULL.
import test from "node:test";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { LONG, pin } from "./lib/golden.mjs";
const match = () => new Simulation({ map: "dunes", aiSpeed: "normal", factions: { 0: "meridian", 1: "ashfall" }, capturePoints: true, aiPlayer: true, rules: { aiPlan: "field" } });
// R3-A (AAA round 3) moved both: census, field economy, join-fight (old 180 "80fb27d8", 600 "549eb7a3"; R3-A "a72ac3ba", "8cc05d90").
// Difficulty guard (Wave 1b, owner 2026-11-21): no field economy, census/join/scouting from 300 s at first (180 "80fb27d8" = r3-base,
// 600 "b422139c"). Then south exits (owner, R3-L) + difficulty guard on the merged tree (census from 480 s): 180
// "706784b9", 600 "440a467c".
// Re-recorded 2026-11-24 (600 s): Breaker Barrage cooldown 40 -> 32 s and Anti-tank 4x (not 6x) to flyers (commits 5e4c07c, 2e293ea).
// Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
// Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
const PINS = { 180: "706784b9", 600: "7bdcddbe" };
test("Field command, Meridian against Ashfall, 180 s", () => pin("w2d field 180", run(match(), 180), PINS[180]));
test("Field command, Meridian against Ashfall, 600 s", LONG, () => pin("w2d field 600", run(match(), 600), PINS[600]));
