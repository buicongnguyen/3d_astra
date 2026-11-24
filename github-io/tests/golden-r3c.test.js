// Golden pin, R3-C (AAA round 3, "Army depth"): the new content only.
//  - Veteran intake: a scripted Expanded sandbox (no AI) where the player orders the Barracks to level 3,
//    trains Rangers and Vanguards (veterans) and they fight a fixed enemy line; hashes at 60 and 90 s.
//    The run is saved at 40 s and the save, played on with the command log, must reach the same hash.
//  - Combined squad: d-crossroads with a squad bought, Rank 2, Assault, then Combined, played with
//    the waves; hash at 120 s, and the replay from the command log must match.
//  - Army size: AI-against-AI on Classic under pop 150 at 180 s, and two AI armies near 200 supply under
//    pop 200 (scripted: the AI alone never passes 100) at 60 s; GOLDEN_FULL=1 adds 150 s.
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins and
// baselines"); GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { run, aiMatch } from "./lib/sim.js";
import { LONG, RECORD, pin } from "./lib/golden.mjs";

// Re-recorded in Wave 1b on the merged tree: south exits (owner) + difficulty guard (old veterans 60 "803cfa1c",
// 90 "feecd5f4"; pop150 180 "04c72406"; pop200 60 "ffd27339", 150 "8fd584f3"). combined 120 did not move. The
// veterans pins also follow the seam fix: onExitRing reads EXIT_ORDER, so recruits are veterans again.
const PINS = {
  veterans: { 60: "6b3b906b", 90: "168d7c59" },
  combined: { 120: "84d76e95" },
  pop150: { 180: "c59995f7" },
  pop200: { 60: "0a796b75", 150: "43031352" },
};

// Plays `sim` tick by tick to `seconds`, sending each [tick, command] of `plan` (a function of the sim)
// when its tick comes; `save` (a tick) keeps the serialized match at that tick.
function play(sim, seconds, plan, save = -1) {
  let text = null;
  const end = Math.round(seconds / 0.05);
  while (sim.ticks < end && !sim.result) {
    for (const [at, c] of plan) if (at === sim.ticks) sim.command({ team: 0, ...c(sim) });
    if (sim.ticks === save) text = sim.serialize();
    sim.tick(0.05);
    sim.events.length = 0;
  }
  return text;
}
// Replays the command log of `from` on `sim` (a loaded save or a fresh match) to `seconds`.
function replay(sim, from, seconds) {
  const end = Math.round(seconds / 0.05);
  while (sim.ticks < end && !sim.result) {
    for (const c of from.commandLog) if (c.tick === sim.ticks) { const { tick: _, ...command } = c; sim.command(command); }
    sim.tick(0.05);
    sim.events.length = 0;
  }
  return sim.hash();
}

function veteranSandbox() {
  const sim = new Simulation({ ai: false, rules: { roster: "expanded" } });
  const hq = sim.entities.find((e) => e.team === 0 && e.type === "hq"), b = sim.entities.find((e) => e.team === 0 && e.type === "barracks");
  hq.level = 3;
  b.level = 2;
  sim.players[0].alloy = sim.players[0].energy = 5000;
  // A fixed enemy line a little way out, on Hold.
  for (let i = 0; i < 6; i++) { const e = sim.spawn(i % 2 ? "ranger" : "vanguard", 1, 6 + i * 1.5, 6); e.stance = "hold"; }
  const bid = { building: b.id };
  const plan = [
    [1, () => ({ type: "upgrade", ...bid })],
    ...[0, 1, 2, 3, 4].map((i) => [640 + i, () => ({ type: "train", ...bid, unit: i % 2 ? "vanguard" : "ranger" })]),
    [700, () => ({ type: "rally", ids: [b.id], rally: { x: 4, z: 8 } })],
    [1300, (s) => ({ type: "order", ids: s.entities.filter((e) => e.team === 0 && e.rank && e.kind === "unit").map((e) => e.id), order: { type: "attackmove", x: 8, z: 4 } })],
  ];
  return { sim, plan };
}

test("R3-C veterans: Expanded sandbox, Barracks ordered to level 3, veterans fight, 60 and 90 s; save at 40 s replays", () => {
  const { sim, plan } = veteranSandbox();
  const saved = play(sim, 60, plan, 800);
  if (!RECORD) assert.ok(sim.entities.some((e) => e.team === 0 && e.rank >= 1 && (e.type === "ranger" || e.type === "vanguard")), "veterans trained");
  pin("r3c veterans 60", sim.hash(), PINS.veterans[60]);
  play(sim, 90, plan);
  pin("r3c veterans 90", sim.hash(), PINS.veterans[90]);
  if (!RECORD) {
    const loaded = Simulation.load(saved);
    assert.ok(loaded);
    assert.equal(loaded.entities.find((e) => e.type === "barracks" && e.team === 0).veterans, true, "the flag is saved");
    assert.equal(replay(loaded, sim, 90), sim.hash(), "a save played on matches");
  }
});

test("R3-C Combined: d-crossroads, a squad to Rank 2, Assault, then Combined, 120 s; the command log replays", () => {
  const level = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads");
  const make = () => { const s = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level }); s.players[0].alloy = 3000; return s; };
  const sim = make();
  const plan = [
    [20, () => ({ type: "armourBuy" })],
    [30, () => ({ type: "armourUpgrade", squad: 1 })],
    [40, () => ({ type: "armourUpgrade", squad: 1, branch: "assault" })],
    [50, () => ({ type: "armourUpgrade", squad: 1, combined: true })],
  ];
  play(sim, 120, plan);
  if (!RECORD) assert.ok(sim.armourUnits(1).length && sim.armourUnits(1).every((e) => e.combined), "the squad is Combined");
  pin("r3c combined 120", sim.hash(), PINS.combined[120]);
  if (!RECORD) assert.equal(replay(make(), sim, 120), sim.hash(), "the command log replays");
});

test("R3-C Army size 150: Classic AI against AI, 180 s", () => {
  pin("r3c pop150 180", run(aiMatch({ map: "classic", enemyCount: 1, aiSpeed: "normal", rules: { pop: "150" } }), 180), PINS.pop150[180]);
});

// Two armies near 200 supply (AI-against-AI never passes 100 on its own before 900 s): relays for both
// sides, tanks and Rangers to 190, and the computer plays both sides.
function battle200() {
  const sim = aiMatch({ map: "classic", enemyCount: 1, aiSpeed: "normal", rules: { pop: "200" } });
  for (const team of [0, 1]) {
    const hq = sim.entities.find((e) => e.team === team && e.type === "hq"), side = team ? 1 : -1;
    for (let i = 0; i < 14; i++) { const r = sim.spawn("relay", team, hq.x - side * (i % 4) * 5, hq.z - side * (8 + Math.floor(i / 4) * 5)); r.supply = 20; }
    sim.players[team].alloy = sim.players[team].energy = 20000;
    let n = 0;
    while (sim.population(team).used < 190) { const type = n % 3 === 2 ? "ranger" : "tank"; sim.spawn(type, team, hq.x - side * (6 + (n % 10) * 2), hq.z - side * (4 + Math.floor(n / 10) * 2.5)); n++; }
  }
  return sim;
}

test("R3-C Army size 200: two AIs at 190 supply each, 60 s; GOLDEN_FULL adds 150 s", () => {
  const sim = battle200();
  if (!RECORD) assert.equal(sim.population(0).cap, 200);
  pin("r3c pop200 60", run(sim, 60), PINS.pop200[60]);
});
test("R3-C Army size 200: the big battle at 150 s", LONG, () => {
  pin("r3c pop200 150", run(battle200(), 150), PINS.pop200[150]);
});
