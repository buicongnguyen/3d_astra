// Golden pins of the Rampart and the Outrider drill (AAA round 2, W2-A): two scripted sandboxes, `ai: false`,
// classic map, units spawned here. They use only the Rampart, Ranger, Scrapper, Rider and Vanguard, so no
// later package moves them. Hashes at 30 and 60 s. Pins are re-recorded only by the integrator, with a named
// reason (docs/TESTING.md). GOLDEN_RECORD=1 prints the values.
//   1. Flank fight: two Ramparts (Ashfall) against six Rangers; four Rangers come at the front, two circle
//      to the rear; one Ram is cast by command at 8 s.
//   2. Drill: eight Sunward Riders (Expanded) against twelve Scrappers.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { pin } from "./lib/golden.mjs";

function empty(options) {
  const s = new Simulation({ ai: false, map: "classic", ...options });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  return s;
}
const row = (s, type, team, n, x0, z, dz = 1.9, per = 5) => Array.from({ length: n }, (_, i) => s.spawn(type, team, x0 + (i % per) * 1.9, z + dz * Math.floor(i / per), true, true));

test("Rampart flank fight, one Ram: hashes at 30 and 60 s", () => {
  const s = empty({ factions: { 0: "ashfall", 1: "meridian" }, rules: { roster: "expanded" } });
  const rams = row(s, "rampart", 0, 2, -30, -9, -1.9, 2);
  const front = row(s, "ranger", 1, 4, -32, 12, 1.9, 4), flank = row(s, "ranger", 1, 2, 4, -6, 1.9, 2);
  s.issue(rams.map((u) => u.id), { type: "attackmove", x: -30, z: 14 });
  s.issue(front.map((u) => u.id), { type: "attackmove", x: -30, z: -14 });
  s.issue(flank.map((u) => u.id), { type: "attackmove", x: -30, z: -9 });
  run(s, 8);
  assert.equal(s.command({ team: 0, type: "ability", ids: [rams[0].id] }), true);
  const at30 = run(s, 30), at60 = run(s, 60);
  pin("w2a rampart 30 s", at30, "4b722ec9");
  pin("w2a rampart 60 s", at60, "8d38668e");
});

test("Outrider drill, Sunward Riders against Scrappers under Expanded: hashes at 30 and 60 s", () => {
  const s = empty({ factions: { 0: "sunward", 1: "ashfall" }, rules: { roster: "expanded" } });
  const riders = row(s, "rider", 0, 8, -34, -9, -1.9, 4), scrappers = row(s, "scrapper", 1, 12, -36, 9, 1.9, 6);
  s.issue(riders.map((u) => u.id), { type: "attackmove", x: -30, z: 14 });
  s.issue(scrappers.map((u) => u.id), { type: "attackmove", x: -30, z: -14 });
  const at30 = run(s, 30), at60 = run(s, 60);
  assert.ok(s.entities.some((e) => e.drill) || riders.every((u) => u.hp <= 0), "the drill ran");
  pin("w2a drill 30 s", at30, "d28058bb");
  pin("w2a drill 60 s", at60, "8d09b14c");
});
