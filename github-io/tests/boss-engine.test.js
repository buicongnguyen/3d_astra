// Boss engine II (src/sim/bosses.js, W1-E): the Iron Sovereign in a field sandbox: multi-zone spread,
// building target, stun, strafe, break the attack, drops, caps; and no boss state without a boss.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { BOSSES, warningSeconds, inZone } from "../src/sim/bosses.js";
import { advance } from "./lib/sim.js";

const SPEC = BOSSES["iron-sovereign"], STOMP = SPEC.attacks[0], SPREAD = SPEC.attacks[1];
const field = (difficulty = "standard") => {
  const mission = { id: "t-sov", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [{ spawn: "ironsovereign", team: 1, at: { x: 0, z: -10 }, tag: "boss", exact: true }], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty });
  return { s, boss: s.tagged("boss")[0] };
};
const run = (s, seconds, seen = []) => advance(s, seconds, { seen, steps: "round", events: "stamp" });
const until = (s, test, cap = 60, seen = []) => { for (let i = 0; i < cap * 20 && !test(); i++) { s.tick(0.05); seen.push(...s.events.map((e) => ({ ...e, at: s.time }))); s.events.length = 0; } assert.ok(test(), "condition reached"); return seen; };
const holders = (s, n, at = { x: 0, z: 2 }) => Array.from({ length: n }, (_, i) => { const u = s.spawn("ranger", 0, at.x - 1.2 + (i % 3) * 1.2, at.z + Math.floor(i / 3) * 1.2); u.damage = 0; u.stance = "hold"; return u; });

test("the Sovereign's data: 10,000 HP and 300 shield, leak 10 lives, Defence tuned, caps and zones", () => {
  const d = D.ironsovereign;
  assert.equal(d.hp, 10000); assert.equal(d.shield, 300); assert.equal(d.leak_lives, 10); assert.equal(d.defence_tuned, true);
  assert.equal(d.boss, "iron-sovereign");
  assert.equal(STOMP.count, undefined); assert.equal(SPREAD.count, 3);
  assert.ok(SPREAD.spread >= 2 * SPREAD.zone.radius + 0.5, "zones never overlap");
  for (const a of SPEC.attacks) assert.ok(a.damage * a.rounds * 1.1 <= 36 + 1e-9, a.id);
});

test("a spread marks three non-overlapping zones at once, each warning at least the walk out", () => {
  const { s, boss } = field();
  holders(s, 6, { x: 0, z: 4 });
  boss.bs = { phase: "tracking", stage: 1, cycle: 1, post: { x: boss.x, z: boss.z }, next: 0 };
  s.tick(0.05);
  assert.equal(boss.bs.phase, "warning");
  const zones = s.dangerZones.filter((z) => z.boss === boss.id);
  assert.equal(zones.length, 3);
  for (const z of zones) assert.ok(z.at - z.from >= warningSeconds(SPREAD) - 1e-9);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(zones[i].x - zones[j].x, zones[i].z - zones[j].z) >= 2 * SPREAD.zone.radius + 0.5 - 1e-9);
  assert.equal(new Set(zones.map((z) => z.id)).size, 3);
});

test("a unit on Hold takes at most 36 damage from one attack, summed over every zone and round", () => {
  for (const cycle of [0, 1]) {
    const { s, boss } = field("veteran");
    boss.damage = 0;
    const [u] = holders(s, 1, { x: 0, z: 4 });
    u.hp = u.maxHp = 1000; u.shield = u.maxShield = 0;
    boss.bs = { phase: "tracking", stage: 1, cycle, post: { x: boss.x, z: boss.z }, next: 0 };
    until(s, () => boss.bs.phase === "exposed", 20);
    assert.ok(1000 - u.hp <= 36 + 1e-9 && 1000 - u.hp > 0, `cycle ${cycle}: ${1000 - u.hp}`);
  }
});

test("the stomp aims at the highest-tier tower in reach, then the dearest, and stuns it for exactly 4 s", () => {
  const { s, boss } = field();
  const mk = (x, tier, crew) => { const t = s.spawn("tower", 0, x, 2); t.crew = crew; t.tier = tier; t.damage = 20; return t; };
  mk(-8, 1, "tank"); const best = mk(0, 3, "ranger"); mk(8, 3, "ranger").x = 9;
  s.updateVision();
  boss.bs = { phase: "tracking", stage: 1, cycle: 0, post: { x: boss.x, z: boss.z }, next: 0 };
  const seen = until(s, () => boss.bs.phase === "exposed", 20, []);
  const warn = seen.find((e) => e.type === "bossWarn");
  assert.ok(Math.hypot(warn.zone.x - best.x, warn.zone.z - best.z) < 10, "aimed at a tier-3 tower");
  const stomp = seen.find((e) => e.type === "bossStomp");
  assert.ok(stomp.ids.length >= 1);
  const t = s.get(stomp.ids[0]);
  assert.ok(s.hasStatus(t, "stunned"));
  run(s, 3.9); assert.ok(s.hasStatus(t, "stunned"), "still stunned at 3.9 s");
  run(s, 0.2); assert.ok(!s.hasStatus(t, "stunned"), "free after 4 s");
});

test("break the attack: damage of the share cancels it and opens the core for 6 s, and less does not", () => {
  const outcome = (dmg) => {
    const { s, boss } = field();
    boss.damage = 0;
    holders(s, 3, { x: 0, z: 4 });
    boss.bs = { phase: "tracking", stage: 1, cycle: 0, post: { x: boss.x, z: boss.z }, next: 0 };
    until(s, () => boss.bs.phase === "warning", 20);
    boss.hp -= dmg;
    const seen = run(s, 0.1);
    return { phase: boss.bs.phase, seen, s, boss };
  };
  const need = SPEC.break.share * (D.ironsovereign.hp + D.ironsovereign.shield);
  const hit = outcome(need + 1), no = outcome(need - 50);
  assert.equal(hit.phase, "exposed");
  assert.ok(hit.seen.some((e) => e.type === "bossBroken"));
  assert.equal(hit.s.dangerZones.length, 0);
  assert.notEqual(no.phase, "exposed");
});

test("drops: 2 Drones at 2/3 and 1/3 of its health, once each", () => {
  const { s, boss } = field();
  holders(s, 3, { x: 0, z: 4 });
  boss.bs = { phase: "tracking", stage: 1, cycle: 0, post: { x: boss.x, z: boss.z }, next: 1e9 };
  const count = () => s.entities.filter((e) => e.type === "drone" && e.team === 1).length;
  boss.hp = boss.maxHp * 0.66; run(s, 0.1); assert.equal(count(), 2);
  run(s, 1); assert.equal(count(), 2, "once");
  boss.hp = boss.maxHp * 0.33; run(s, 0.1); assert.equal(count(), 4);
});

test("a save mid-warning of a spread reloads to the same hash and plays on in step", () => {
  const { s, boss } = field();
  holders(s, 6, { x: 0, z: 4 });
  boss.bs = { phase: "tracking", stage: 1, cycle: 1, post: { x: boss.x, z: boss.z }, next: 0 };
  until(s, () => boss.bs.phase === "warning", 5);
  run(s, 1);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  run(s, 8); run(copy, 8);
  assert.equal(copy.hash(), s.hash());
});

test("no boss state in a match without a boss, and no fx", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  run(s, 5);
  assert.ok(!s.entities.some((e) => "bs" in e || "fx" in e) && !s.fxOn && !s.dangerZones);
});
