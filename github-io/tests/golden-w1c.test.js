// Golden pin of the Veil Stalker (AAA round 2, W1-C): a scripted sandbox that no later package changes.
// No AI (`ai: false`); Veil Stalkers (team 0) against a Meridian heal-ball (6 Rangers, 2 Medics) on the
// classic map, both attack-moving through each other; the first Stalker casts Steady aim by command at
// 10 s. Hashes at 30 and 60 s. Pins are re-recorded only by the integrator, with a named reason
// (docs/TESTING.md). GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { pin } from "./lib/golden.mjs";

function sandbox() {
  const s = new Simulation({ ai: false, map: "classic", factions: { 0: "veil", 1: "meridian" } });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  const st = Array.from({ length: 5 }, (_, i) => s.spawn("stalker", 0, -30 + (i % 5) * 1.9, -9));
  const ball = ["ranger", "ranger", "ranger", "ranger", "ranger", "ranger", "medic", "medic"].map((t, i) => s.spawn(t, 1, -30 + (i % 5) * 1.9, 9 + Math.floor(i / 5) * 1.9));
  s.issue(st.map((u) => u.id), { type: "attackmove", x: -26, z: 14 });
  s.issue(ball.map((u) => u.id), { type: "attackmove", x: -26, z: -14 });
  return { s, st };
}

test("Stalkers against a heal-ball, one Steady aim cast: hashes at 30 and 60 s", () => {
  const { s, st } = sandbox();
  run(s, 10);
  assert.equal(s.command({ team: 0, type: "ability", ids: [st[0].id] }), true);
  const at30 = run(s, 30), at60 = run(s, 60);
  // Re-recorded 2026-11-24 (roster): the Veil Command core's trains list gains the Veil moth (hashed state; no
  // flyer is trained here, ai: false).
  pin("w1c 30 s", at30, "daecb43b");
  pin("w1c 60 s", at60, "f48c398e");
  assert.ok(s.events !== undefined);
});
