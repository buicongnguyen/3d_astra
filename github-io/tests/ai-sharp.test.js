// W8 AI quality (src/sim/ai-sharp.js): Fast and Relentless skirmish rivals share focus targets, time and place
// a flank, rejoin their attack once healed, scout with Kites (turning back from anti-air) and cast Dash, Rush
// and Rapid fire sensibly. Relaxed and Normal play exactly as before: the last test pins whole Normal and
// Relaxed AI matches to the hashes they had before W8.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { sharpSide } from "../src/ai-plan.js";
import { aiCasts } from "../src/sim/content/ai-casts.js";
import { distance } from "../src/data.js";
import { run } from "./lib/sim.js";

// The rival (team 1) with only the fighters given, at its rally point, with no money (as tests/ai-attack.test.js).
function staged({ fighters = 6, type = "ranger", aiSpeed = "fast", rules } = {}) {
  const s = new Simulation({ map: "classic", aiSpeed, ai: false, ...(rules ? { rules } : {}) });
  for (const e of s.own(1)) if (e.kind === "unit" && e.type !== "worker") e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.players[1].alloy = s.players[1].energy = 0;
  const hq = s.own(1).find((e) => e.type === "hq"), core = s.aiNearestCore(1, hq), rally = s.aiRallyPoint(hq, core);
  const army = Array.from({ length: fighters }, (_, i) => s.spawn(type, 1, rally.x + (i % 3) * 1.5 - 1.5, rally.z + Math.floor(i / 3) * 1.5));
  s.updateVision();
  s.time = s.waveAt[1] + 1;
  return { s, hq, core, rally, army };
}
const standOn = (s, x, z) => (s.nav.canStand(x, z, 0.6) ? { x, z } : (([cx, cz]) => s.terrain.worldAt(cx, cz))(s.nav.nearest(...s.nav.cellAt(x, z), 0.6)));

test("W8 runs only for Fast and Relentless skirmish rivals", () => {
  const cmd = (aiSpeed, extra = {}) => new Simulation({ ai: false, aiSpeed, ...extra }).aiCommandFor(1);
  assert.equal(cmd("relaxed"), null);
  assert.equal(cmd("normal").sharp, false);
  assert.equal(cmd("fast").sharp, true);
  assert.equal(cmd("relentless").sharp, true);
  assert.equal(cmd("fast", { rules: { aiPlan: "field" } }).sharp, true, "both AI plans");
  const mission = { id: "fixture", rules: {}, objectives: [], setup: [], win: [], triggers: [] };
  assert.equal(new Simulation({ ai: false, mission, difficulty: "veteran" }).aiCommandFor(1).sharp, false, "Veteran borrows Fast's numbers, not W8");
  const s = new Simulation({ ai: false, aiSpeed: "fast" });
  assert.equal(sharpSide(s, 0), false, "the player's side is never steered");
  assert.equal(sharpSide(s, 1), true);
});

test("shared focus: the attack's shooters agree on the target they can kill soonest, and spill extra fire onto a second", () => {
  const { s, army } = staged({ fighters: 6 });
  const mid = { x: army.reduce((n, e) => n + e.x, 0) / 6, z: army.reduce((n, e) => n + e.z, 0) / 6 };
  const at = (dx) => standOn(s, mid.x + dx, mid.z + 6);
  const tank = s.spawn("tank", 0, at(-2).x, at(-2).z), hurt = s.spawn("ranger", 0, at(0).x, at(0).z), fresh = s.spawn("vanguard", 0, at(2).x, at(2).z);
  hurt.hp = 30;
  s.updateVision();
  const n = s.aiLaunch(1, army, { x: mid.x, z: mid.z + 30 }, null, false), a = s.aiWar[1].attacks.find((x) => x.n === n);
  s.aiFocusShared(1, army, a);
  const targets = army.filter((e) => e.orders[0]?.type === "attack").map((e) => e.orders[0].target);
  assert.ok(targets.length >= 4, "most shooters were given a focus target");
  assert.ok(new Set(targets).size <= 2, "at most two shared targets");
  assert.equal(a.focus[0], hurt.id, "the wounded Ranger dies soonest: it is the first target");
  assert.ok(targets.filter((t) => t === hurt.id).length >= 1 && targets.filter((t) => t === hurt.id).length < 6, "no overkill: a 30 hp Ranger does not take all six");
  assert.ok(!targets.includes(tank.id) || a.focus.includes(tank.id));
  // Hysteresis: the next think keeps the same targets (nothing changed).
  const before = [...a.focus];
  s.aiFocusShared(1, army, a);
  assert.deepEqual(a.focus, before);
  void fresh;
});

test("Normal keeps the per-unit focus (no shared target is stored)", () => {
  const { s, army } = staged({ fighters: 6, aiSpeed: "normal" });
  const mid = { x: army[0].x, z: army[0].z }, p = standOn(s, mid.x, mid.z + 6);
  s.spawn("ranger", 0, p.x, p.z);
  s.updateVision();
  const n = s.aiLaunch(1, army, { x: mid.x, z: mid.z + 30 }, null, false);
  s.aiWatch(1, s.own(1).find((e) => e.type === "hq"), army, s.aiCommandFor(1));
  assert.equal(s.aiWar[1].attacks.find((x) => x.n === n).focus, undefined);
});

test("a wounded unit steps in behind its Medic and, healed, rejoins its attack", () => {
  const { s, hq, army } = staged({ fighters: 4 });
  const medic = s.spawn("medic", 1, army[0].x - 5, army[0].z);
  const target = { x: army[0].x + 40, z: army[0].z };
  const n = s.aiLaunch(1, army, target, null, false);
  const hurt = army[0];
  hurt.hp = hurt.maxHp * 0.2;
  s.aiRetreat(1, [...army, medic], hq);
  assert.equal(hurt.retreating, true);
  assert.equal(hurt.aiRejoin, n, "it remembers its attack");
  const spot = hurt.orders[0];
  assert.equal(spot.type, "move");
  assert.ok(distance(spot, target) > distance(medic, target), "it stands behind the Medic, away from the objective");
  hurt.hp = hurt.maxHp;
  s.aiRetreat(1, [...army, medic], hq);
  assert.equal(hurt.retreating, false);
  assert.equal(hurt.orders[0]?.type, "attackmove");
  assert.equal(hurt.orders[0].aiw, n, "healed, it rejoins the same attack");

  // Normal: the healed unit stops where it is, as before.
  const normal = staged({ fighters: 4, aiSpeed: "normal" });
  const m2 = normal.s.spawn("medic", 1, normal.army[0].x - 5, normal.army[0].z);
  normal.s.aiLaunch(1, normal.army, target, null, false);
  normal.army[0].hp = normal.army[0].maxHp * 0.2;
  normal.s.aiRetreat(1, [...normal.army, m2], normal.hq);
  assert.equal(normal.army[0].aiRejoin, undefined);
  normal.army[0].hp = normal.army[0].maxHp;
  normal.s.aiRetreat(1, [...normal.army, m2], normal.hq);
  assert.equal(normal.army[0].orders.length, 0);
});

test("a flank takes the side with fewer seen towers, and the main push waits so both arrive together", () => {
  const { s, hq, core, army } = staged({ fighters: 12 });
  const cmd = { ...s.aiCommandFor(1), split: 1, to: "flank" };
  // Where each side's waypoint lies.
  const d = distance(hq, core), px = -(core.z - hq.z) / d, pz = (core.x - hq.x) / d;
  const side = (sd) => ({ x: (hq.x + core.x) / 2 + px * sd * d * 0.35, z: (hq.z + core.z) / 2 + pz * sd * d * 0.35 });
  const roll = s.aiRoll(1, (s.aiWar?.n ?? 0) + 101) < 0.5 ? 1 : -1;
  // A tower the rival has seen beside the seeded side's waypoint: the flank goes the other way.
  const near = standOn(s, side(roll).x, side(roll).z), tower = s.spawn("tower", 0, near.x, near.z);
  tower.complete = true;
  s.intel[1].set(tower.id, "tower");
  const second = s.aiSecondGroup(1, hq, army, core, cmd);
  assert.ok(second?.via, "a flank by a waypoint");
  assert.ok(distance(second.via, side(-roll)) < distance(second.via, side(roll)), "it avoids the tower's side");
  // Timing: the flank's longer road means the main push holds a few seconds.
  const main = army.filter((e) => !second.units.includes(e));
  const delay = s.aiFlankDelay(main, second.units, second.via, core);
  assert.ok(delay >= 3 && delay <= 25, `a hold of ${delay.toFixed(1)} s`);
});

test("the timed flank: the flank leaves first, the main push follows when it is due, and the two fall back together", () => {
  const { s, hq, army } = staged({ fighters: 12 });
  const ranger = s.spawn("ranger", 0, 40, 40);
  s.intel[1].set(ranger.id, "ranger");
  const orig = s.aiCommandFor.bind(s);
  s.aiCommandFor = (team) => ({ ...orig(team), split: 1, to: "flank" });
  s.updateAI(1); // gather
  s.updateAI(1); // launch the flank, hold the main
  const war = s.aiWar[1];
  assert.ok(war.gather?.mainAt > s.time, "the main push holds at the rally");
  assert.equal(war.attacks.length, 1, "only the flank is out");
  const flank = war.attacks[0];
  assert.ok(army.filter((e) => e.orders.some((o) => o.aiw)).length < 12, "the main push waits");
  s.time = war.gather.mainAt + 0.1;
  s.updateAI(1);
  assert.equal(war.attacks.length, 2, "the main push is out");
  const mainA = war.attacks.find((a) => a.n !== flank.n);
  assert.equal(mainA.pair, flank.n);
  assert.equal(flank.pair, mainA.n);
  // The flank falls back: the main push is recalled too once in the field.
  flank.back = 1;
  for (const e of army) if (e.orders.some((o) => o.aiw === mainA.n)) { e.x = 0; e.z = 0; }
  s.aiWatch(1, hq, army, s.aiCommandFor(1));
  assert.equal(mainA.back, 1);
});

test("a Kite scouts where an enemy base is likely and turns back from anti-air", () => {
  const { s, hq } = staged({ fighters: 0 });
  const kite = s.spawn("kite", 1, hq.x + 4, hq.z + 4);
  s.updateVision();
  s.aiKites(1, [kite], hq);
  const goal = kite.orders[0];
  assert.equal(goal?.type, "move");
  const mirror = { x: -hq.x, z: -hq.z };
  assert.ok(distance(goal, mirror) < distance(goal, hq), "it heads for the far side, where the other core is likely");
  // A Ranger (it hits air) right ahead: the Kite turns away and remembers the spot.
  kite.x = goal.x * 0.5; kite.z = goal.z * 0.5;
  const aa = s.spawn("ranger", 0, kite.x + 4, kite.z);
  s.updateVision();
  s.aiKites(1, [kite], hq);
  assert.ok(distance(kite.orders[0], aa) > distance(kite, aa), "it flies away from the anti-air");
  assert.equal(s.aiWar[1].danger.length, 1);
  const next = s.aiScoutPoint(1, hq, kite);
  assert.ok(Math.hypot(next.x - aa.x, next.z - aa.z) >= 14, "the next scouting point avoids that spot");
  // Normal rivals never run this (aiKites is only called for cmd.sharp).
  assert.equal(new Simulation({ ai: false, aiSpeed: "normal" }).aiCommandFor(1).sharp, false);
});

test("Dash closes on a target just out of reach and Rapid fire waits for armed enemies (sharp only)", () => {
  const cast = (aiSpeed, type, foe, gap) => {
    const s = new Simulation({ map: "classic", aiSpeed, ai: false });
    const hq = s.own(1).find((e) => e.type === "hq"), p = standOn(s, hq.x + 12, hq.z), e = s.spawn(type, 1, p.x, p.z);
    const q = standOn(s, p.x + e.range + gap, p.z);
    s.spawn(foe, 0, q.x, q.z);
    s.updateVision();
    return aiCasts.autocast(s, e, e.ability);
  };
  assert.equal(cast("fast", "rider", "ranger", 5), true, "a target 5 m out of reach: Dash");
  assert.equal(cast("fast", "rider", "ranger", -1), false, "already in reach: no Dash");
  assert.equal(cast("normal", "rider", "ranger", 5), undefined, "Normal keeps today's rule");
  assert.equal(cast("fast", "ranger", "worker", -1), false, "a Harvester is not worth Rapid fire");
  assert.equal(cast("fast", "ranger", "vanguard", -1), true);
  assert.equal(cast("relentless", "antitank", "tank", -1), undefined, "Classic plan: other abilities keep the fight rule");
});

// Hashes of whole AI matches (every side computer-played, 300 s) recorded on the commit before W8.
test("Relaxed and Normal AI matches are unchanged by W8", () => {
  const pins = {
    normal1v2: [{ aiSpeed: "normal", enemyCount: 2, alliance: "ffa", map: "riverlands", capturePoints: true }, "757e367a"],
    normalCoalitionField: [{ aiSpeed: "normal", enemyCount: 2, alliance: "coalition", map: "dunes", capturePoints: true, rules: { aiPlan: "field" } }, "0854429a"],
    relaxed1v1: [{ aiSpeed: "relaxed", map: "classic", capturePoints: true }, "54ef8d71"],
  };
  for (const [name, [options, hash]] of Object.entries(pins)) assert.equal(run(new Simulation({ ...options, aiPlayer: true }), 300), hash, name);
});
