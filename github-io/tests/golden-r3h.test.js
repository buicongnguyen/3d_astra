// Golden pin, R3-H (AAA round 3, "Boss phase 2 and The Sovereign Walks"): the new content only.
//  - Sandbox: ironsovereign2 on Classic with three Ashfall relays (tag "ward"), 6 Rangers and 2 Breakers
//    on attack-move at it; hashes at 30 and 90 s (shielded fight, march, the core opening).
//  - Phase 2: the same sandbox without relays, the boss set to 55% health so it crosses half within the
//    run; hashes at 20 and 60 s (surge, drones, the rail sweep and the barrage).
//  - Mission: "The Sovereign Walks" (m11d) played with no orders (the camp only harvests): hashes at 120 s
//    and at 330 s (the relays up and the Sovereign walking); GOLDEN_FULL=1 adds 600 s.
// The Iron Sovereign's own pins (golden-w1e) are untouched: engine III is optional data it does not use.
// Pins are re-recorded only by the integrator, with a named reason; GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import { Simulation } from "../src/simulation.js";
import { SOVEREIGN_WALKS } from "../src/story/sovereign-mission.js";
import { LONG, pin } from "./lib/golden.mjs";

// Re-recorded 2026-11-23 (owner): the Sovereign's health cut from 44,000 to 15,000 (story 12,000, veteran 14,000).
const PINS = {
  sandbox: ["2d29faa8", "a5a27277"],
  phase: ["fbb61775", "91dae137"],
  // Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
  // Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
  // Re-recorded 2026-11-24 (Kite scout sight 18 -> 32 m and its manual Dive, docs/CHANGELOG.md "Kite scout: twice the sight, and Dive"): the player's Kites, and the computer's at Fast or Relentless, open more fog for their side (the fog is in the hashed state), and Fast/Relentless computer Kites may dive. Relaxed, Normal, Defence and story computer Kites keep 18 m, so those pins did not move.
  // Re-recorded 2026-11-25 (concise story lines): text only. The hash covers the mission definition, so the shorter say lines move it; with the old lines put back the run reproduces the old pin exactly (same waves, lives, result), so play is unchanged. Old 51e858c1 / 6610206c / fd25c6e7.
  mission: { 120: "61b6861e", 330: "f9ca1ca5", 600: "d87a06fe" },
};

function sandbox(relays) {
  const mission = { id: "t-sov2", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [
      ...[[-12, -20], [0, -26], [12, -20]].slice(0, relays).map(([x, z]) => ({ spawn: "relay", team: 1, at: { x, z }, tag: "ward", hp: 3000 })),
      { spawn: "ironsovereign2", team: 1, at: { x: 0, z: -10 }, tag: "boss", exact: true },
    ], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty: "standard" });
  const army = [];
  for (let i = 0; i < 6; i++) army.push(s.spawn("ranger", 0, -6 + i * 1.5, 8));
  for (let i = 0; i < 2; i++) army.push(s.spawn("breaker", 0, -4 + i * 2.5, 11));
  s.issue(army.map((e) => e.id), { type: "attackmove", x: 0, z: -10 });
  return { s, boss: s.tagged("boss")[0] };
}
const hashesAt = (s, times) => times.map((t) => { while (s.time < t - 1e-9 && !s.result) { s.tick(0.05); s.events.length = 0; } return s.hash(); });

test("golden R3-H: ironsovereign2 shielded by three relays against 6 Rangers and 2 Breakers, 30 and 90 s", () => {
  pin("r3h sandbox", hashesAt(sandbox(3).s, [30, 90]), PINS.sandbox);
});
test("golden R3-H: phase 2 (no relays, from 55% health), 20 and 60 s", () => {
  const { s, boss } = sandbox(0);
  boss.hp = boss.maxHp * 0.55;
  pin("r3h phase", hashesAt(s, [20, 60]), PINS.phase);
});
const mission = () => new Simulation({ map: SOVEREIGN_WALKS.map, enemyCount: 1, aiSpeed: SOVEREIGN_WALKS.speed, alliance: SOVEREIGN_WALKS.alliance, mission: SOVEREIGN_WALKS, difficulty: "standard" });
test("golden R3-H: The Sovereign Walks with no orders, 120 and 330 s", () => {
  const [a, b] = hashesAt(mission(), [120, 330]);
  pin("r3h mission 120", a, PINS.mission[120]);
  pin("r3h mission 330", b, PINS.mission[330]);
});
test("golden R3-H: The Sovereign Walks with no orders, 600 s", LONG, () => {
  pin("r3h mission 600", hashesAt(mission(), [600])[0], PINS.mission[600]);
});
