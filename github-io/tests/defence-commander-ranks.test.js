// Commander ranks (Frontier Defence, 2026-11-25): the Field commander is bought up like a tower: Rank 2,
// Rank 3, then Artillery or Rally with two ranks each; ranks are kept when it falls and through a save.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { commanderStats } from "../src/sim/defence/commander.js";
import { COMMANDER_TEXT } from "../src/app/defence/constants.js";
import { advance } from "./lib/sim.js";

const GORGE = DEFENCE_LEVELS[0], C = GARRISONS.commander;
const make = () => new Simulation({ map: GORGE.map, enemyCount: 1, ai: false, mission: GORGE, difficulty: "standard" });
const run = (s, seconds) => advance(s, seconds, { steps: "round", events: "leave" });
const up = (s, branch) => s.command({ team: 0, type: "heroUpgrade", ...(branch ? { branch } : {}) });

test("the data: two ranks, then two branches of two ranks, costs in the armour squad's range", () => {
  assert.equal(C.ranks.length, 2);
  assert.deepEqual(Object.keys(C.branches), ["artillery", "rally"]);
  for (const step of [...C.ranks, ...Object.values(C.branches).flatMap((b) => b.ranks)]) {
    assert.ok(step.cost >= 160 && step.cost <= 320, `cost ${step.cost}`);
    // Every step changes an ability, not only health.
    assert.ok(step.barrage || step.reinforce, JSON.stringify(step));
  }
});

test("rank 1 is today's commander, and the sheet's lines match the figures", () => {
  assert.equal(commanderStats(undefined), C);
  assert.equal(commanderStats({ id: 1 }), C);
  const r2 = commanderStats({ rank: 2 }), r3 = commanderStats({ rank: 3 }), art = commanderStats({ rank: 3, branch: "artillery", branchRank: 2 }), rally = commanderStats({ rank: 3, branch: "rally", branchRank: 2 });
  assert.equal(r2.shield, 700); assert.equal(r2.barrage.damage, 160);
  assert.equal(r3.barrage.cooldown, 30); assert.equal(r3.reinforce.count, 4); assert.ok(Math.abs(r3.hp - C.hp * 1.3) < 1e-9);
  assert.equal(art.barrage.radius, 5.5); assert.equal(art.barrage.damage, 200); assert.equal(art.barrage.shells, 2); assert.equal(art.barrage.cooldown, 24);
  assert.equal(rally.reinforce.count, 6); assert.equal(rally.reinforce.cooldown, 28); assert.equal(rally.reinforce.hp, 1.6);
  // The base data is never changed by the merge.
  assert.equal(C.barrage.damage, 110); assert.equal(C.reinforce.count, 3);
  assert.match(COMMANDER_TEXT.rank2, new RegExp(`${r2.shield}.*${r2.barrage.damage}`));
  assert.match(COMMANDER_TEXT.rank3, new RegExp(`${r3.barrage.cooldown} s`));
  assert.match(COMMANDER_TEXT.artillery[0], /5\.5 m.*200/);
  assert.match(COMMANDER_TEXT.artillery[1], new RegExp(`${art.barrage.cooldown} s`));
  assert.match(COMMANDER_TEXT.rally[0], new RegExp(`${C.branches.rally.ranks[0].reinforce.seconds} s`));
  assert.match(COMMANDER_TEXT.rally[1], new RegExp(`${rally.reinforce.cooldown} s`));
});

test("ranks are bought in order, cost alloy, and refuse without it", () => {
  const s = make(), hero = s.commander();
  s.players[0].alloy = 100;
  assert.equal(up(s), false, "not enough alloy");
  assert.equal(s.players[0].alloy, 100);
  s.players[0].alloy = 5000;
  assert.deepEqual(s.commanderNextUpgrade(), { kind: "rank", rank: 2, cost: 180 });
  assert.equal(up(s, "artillery"), false, "no branch before Rank 3");
  assert.ok(up(s));
  assert.equal(s.players[0].alloy, 5000 - 180);
  assert.equal(hero.maxShield, 700);
  assert.equal(hero.heroRank, 2);
  const hp = hero.maxHp;
  assert.ok(up(s));
  assert.equal(hero.maxHp, Math.round((hp / C.hp) * C.hp * 1.3));
  assert.equal(s.commanderNextUpgrade().kind, "branch");
  assert.equal(up(s), false, "a branch must be named");
  assert.equal(up(s, "nope"), false);
  assert.ok(up(s, "rally"));
  assert.equal(up(s, "artillery"), false, "the branch cannot be changed");
  assert.ok(up(s));
  assert.equal(s.commanderNextUpgrade(), null);
  assert.equal(up(s), false, "top rank");
  assert.deepEqual([s.defence.hero.rank, s.defence.hero.branch, s.defence.hero.branchRank, hero.heroRank], [3, "rally", 2, 5]);
  assert.equal(s.players[0].alloy, 5000 - 180 - 260 - 200 - 280);
});

test("the abilities change: Artillery fires two wider shells, Rally drops six tougher Vanguards", () => {
  const s = make(), hero = s.commander();
  s.players[0].alloy = 5000;
  up(s); up(s); up(s, "artillery"); up(s);
  assert.ok(s.command({ team: 0, type: "heroCast", ability: "barrage", x: hero.x + 4, z: hero.z }));
  assert.equal(s.strikes.length, 2);
  assert.deepEqual(s.strikes.map((k) => [k.damage, k.radius]), [[200, 5.5], [200, 5.5]]);
  assert.ok(Math.abs(s.strikes[1].at - s.strikes[0].at - 0.8) < 1e-9);
  assert.ok(Math.abs(s.commanderCooldown("barrage") - 24) < 1e-9);

  const r = make(), h = r.commander();
  r.players[0].alloy = 5000;
  up(r); up(r); up(r, "rally"); up(r);
  const before = new Set(r.entities.map((e) => e.id));
  // A spot on the road beside the commander.
  const p = GORGE.defence.routes[Object.keys(GORGE.defence.routes)[0]].find((q) => Math.hypot(q.x - h.x, q.z - h.z) < 15 && Math.hypot(q.x - h.x, q.z - h.z) > 3) || { x: h.x, z: h.z };
  assert.ok(r.command({ team: 0, type: "heroCast", ability: "reinforce", x: p.x, z: p.z }));
  const drop = r.entities.filter((e) => !before.has(e.id));
  assert.equal(drop.length, 6);
  for (const v of drop) assert.equal(v.maxHp, Math.round(D[v.type].hp * 1.6));
  assert.ok(Math.abs(r.commanderCooldown("reinforce") - 28) < 1e-9);
});

test("ranks are kept when the commander falls and through a save", () => {
  const s = make();
  s.players[0].alloy = 5000;
  up(s); up(s); up(s, "artillery");
  const hero = s.commander(), max = hero.maxHp;
  hero.hp = 0;
  run(s, C.respawn + 1);
  const back = s.commander();
  assert.ok(back && back.id !== hero.id);
  assert.equal(back.maxHp, Math.round(D[back.type].hp * commanderStats(s.defence.hero).hp));
  assert.equal(back.maxHp, max);
  assert.equal(back.maxShield, 700);
  assert.deepEqual([back.heroRank, back.heroBranch], [4, "artillery"]);
  // Bought while down: it comes back with it.
  back.hp = 0;
  run(s, 1);
  assert.equal(s.commander(), null);
  assert.ok(up(s));
  const copy = Simulation.load(s.serialize());
  assert.deepEqual(copy.commanderNextUpgrade(), null);
  run(copy, C.respawn + 1);
  assert.equal(copy.commander().heroRank, 5);
  assert.equal(copy.defence.hero.branchRank, 2);
});

test("a commander who buys nothing keeps exactly the old state", () => {
  const s = make();
  run(s, 5);
  const h = s.defence.hero, e = s.commander();
  assert.deepEqual(Object.keys(h).sort(), ["barrageAt", "deadAt", "id", "reinforceAt"]);
  assert.ok(!("heroRank" in e) && !("heroBranch" in e));
});
