// Golden pin, R4-P1 (AAA round 4, "Wild frontier: the desert test"): the new content only, with the
// Battle rule `wild: "on"` on Amber Dunes (every other pin is untouched: the rule's default stores no key).
//  - AI against AI at Fast with capture points (the computer takes the Spire, calls storms and goes for
//    the nest): hashes at 180 s, and 420 s under GOLDEN_FULL=1;
//  - a scripted sandbox (no AI): the player holds the Spire, calls a Sandstorm on an enemy squad and a
//    tamed Wyrm ambushes a tank; hash at 40 s. The run is saved at 20 s and the save, played on with the
//    command log, must reach the same hash.
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins and
// baselines"); GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { run, aiMatch } from "./lib/sim.js";
import { LONG, RECORD, pin } from "./lib/golden.mjs";

// Re-recorded 2026-11-23 (owner): several Wyrm nests, two Wyrms per side, Elder nests.
const PINS = {
  // Re-recorded 2026-11-24: Breaker Barrage cooldown 40 -> 32 s and Anti-tank 4x (not 6x) to flyers (commits 5e4c07c, 2e293ea) change long AI matches.
  // fast 180 and 420 s: Re-recorded 2026-11-24 (integration of faction depth + support units): Fast/Relentless AIs take doctrines and cast signature abilities, and Medic/Engineer/Supply wagon health rose (95 + 55 shield, 150, 340).
  // Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
  // Re-recorded 2026-11-24 (support health only for a human team 0): a computer-played team 0 (aiPlayer) keeps the computer's support health, so AI-against-AI matches are back to their faction depth / roster values.
  // Re-recorded 2026-11-24 (Kite scout sight 18 -> 32 m and its manual Dive, docs/CHANGELOG.md "Kite scout: twice the sight, and Dive"): the player's Kites, and the computer's at Fast or Relentless, open more fog for their side (the fog is in the hashed state), and Fast/Relentless computer Kites may dive. Relaxed, Normal, Defence and story computer Kites keep 18 m, so those pins did not move.
  fast: { 180: "c3e66257", 420: "55bd6c80" },
  sandbox: { 40: "84c9ae8a" },
};
const RULES = { wild: "on" };

function sandbox() {
  const s = new Simulation({ map: "dunes", ai: false, rules: RULES });
  for (let i = 0; i < 4; i++) s.spawn("ranger", 1, 4 + i * 1.5, -18, true, true);
  s.spawn("tank", 1, -6, -26, true, true);
  s.spawn("wyrm", 0, -16, -24, true, true);
  for (let i = 0; i < 3; i++) s.spawn("vanguard", 0, -2 + i * 1.5, -10, true, true);
  s.skirmishPoints.spire.owner = 0;
  return s;
}
// The player's plan: at 1 s the Spire is armed (test shortcut), at 2 s the storm goes on the squad, at 6 s
// the Vanguards attack-move into it.
const PLAN = [
  [20, (s) => { s.wild.readyAt = s.time; return null; }],
  [40, () => ({ type: "weather", x: 6, z: -18 })],
  [120, (s) => ({ type: "order", ids: s.own(0).filter((e) => e.type === "vanguard").map((e) => e.id), order: { type: "attackmove", x: 6, z: -18 } })],
];
function play(s, seconds, save = -1) {
  let text = null;
  const end = Math.round(seconds / 0.05);
  while (s.ticks < end && !s.result) {
    for (const [at, c] of PLAN) if (at === s.ticks) { const command = c(s); if (command) s.command({ team: 0, ...command }); }
    if (s.ticks === save) text = s.serialize();
    s.tick(0.05);
    s.events.length = 0;
  }
  return text;
}

test("R4-P1 golden: AI against AI at Fast on Amber Dunes with the Wild frontier, 180 s", () => {
  const s = aiMatch({ map: "dunes", aiSpeed: "fast", capturePoints: true, rules: RULES });
  pin("r4p1 fast 180", run(s, 180), PINS.fast[180]);
});

test("R4-P1 golden: AI against AI at Fast, 420 s (long)", LONG, () => {
  const s = aiMatch({ map: "dunes", aiSpeed: "fast", capturePoints: true, rules: RULES });
  pin("r4p1 fast 420", run(s, 420), PINS.fast[420]);
});

test("R4-P1 golden: the scripted storm and Ambush, 40 s; the save at 20 s replays to the same hash", () => {
  const s = sandbox();
  const saved = play(s, 40, 400);
  const hash = s.hash();
  pin("r4p1 sandbox 40", hash, PINS.sandbox[40]);
  if (RECORD) return;
  assert.ok(s.wild.stats.casts[0] === 1, "the storm was called");
  const again = Simulation.load(saved);
  const end = Math.round(40 / 0.05);
  while (again.ticks < end && !again.result) {
    for (const c of s.commandLog) if (c.tick === again.ticks) { const { tick: _, ...command } = c; again.command(command); }
    again.tick(0.05);
    again.events.length = 0;
  }
  assert.equal(again.hash(), hash);
});
