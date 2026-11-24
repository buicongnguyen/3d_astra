// Support units (owner, 2026-11-24: "increase the health of medic and engineer types, because they do not
// attack, and do the fixes"): sturdier Medics, Engineers and Supply wagons; support stays behind the
// fighters it walks with (sim/escort.js), falls back when hurt, comes along when the army is ordered
// without it; Harvesters repair at the base only while no enemy is near (sim/auto-repair.js).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { restore } from "../src/snapshot.js";
import { DEFINITIONS as D } from "../src/data.js";
import { BEHIND, FALL_BACK, ENLIST, escortPlan } from "../src/sim/escort.js";
import { AUTO_REPAIR, autoRepairJobs } from "../src/sim/auto-repair.js";
import { chipModel } from "../src/type-chips-model.js";

const TICK = 0.05;
const ids = (list) => list.map((e) => e.id);
const step = (s, seconds) => { for (let i = 0; i < seconds / TICK; i++) s.tick(TICK); };

// A mixed squad on open ground (basin) facing six enemy infantry 20 m east. The support units start
// beside the fighters and 3.5 m ahead of them: the worst case.
function fight() {
  const s = new Simulation({ ai: false, map: "basin" });
  const mine = ["vanguard", "vanguard", "ranger", "ranger", "antitank", "tank", "medic", "medic", "engineer"].map((t, i) => s.spawn(t, 0, -34 + (i % 3) * 1.9, 6 + Math.floor(i / 3) * 1.9));
  for (const e of mine.filter((u) => u.support)) e.x += 3.5;
  const foes = ["ranger", "ranger", "ranger", "vanguard", "vanguard", "antitank"].map((t, i) => s.spawn(t, 1, -14 + (i % 3) * 1.9, 6 + Math.floor(i / 3) * 1.9));
  s.tick(TICK);
  return { s, mine, foes, support: mine.filter((e) => e.support), fighters: mine.filter((e) => !e.support) };
}
// Over `seconds`, the smallest distance (m, along +x toward the enemy) a living support unit kept behind
// the frontmost living fighter, from the second second on.
function behindFront(run, seconds) {
  let least = Infinity;
  for (let i = 1; i <= seconds / TICK; i++) {
    run.s.tick(TICK);
    const live = run.fighters.filter((f) => f.hp > 0);
    if (i * TICK < 2 || !live.length) continue;
    const front = Math.max(...live.map((f) => f.x));
    for (const e of run.support) if (e.hp > 0) least = Math.min(least, front - e.x);
  }
  return least;
}

test("the player's Medics, Engineers and Supply wagons are sturdier; the computer's keep the old values; prices stay", () => {
  // Owner rule: the buff must not make the computer stronger, so it is the player's side (team 0) only.
  // Player: Medic 95 + 55 shield, Engineer 150 + 30, Supply wagon 340 + 30. Computer (the old values):
  // Medic 75 + 30, Engineer 100 + 30, Supply wagon 240 + 30.
  assert.deepEqual([D.medic.hp, D.medic.shield, D.medic.player_hp, D.medic.player_shield, D.medic.cost], [75, 30, 95, 55, [100, 50]]);
  assert.deepEqual([D.engineer.hp, D.engineer.shield, D.engineer.player_hp, D.engineer.cost], [100, 30, 150, [125, 50]]);
  assert.deepEqual([D.wagon.hp, D.wagon.shield, D.wagon.player_hp, D.wagon.cost], [240, 30, 340, [150, 75]]);
  const s = new Simulation({ ai: false, map: "basin" });
  const stats = (e) => [e.hp, e.maxHp, e.shield, e.maxShield];
  for (const [type, mine, theirs] of [["medic", [95, 95, 55, 55], [75, 75, 30, 30]], ["engineer", [150, 150, 30, 30], [100, 100, 30, 30]], ["wagon", [340, 340, 30, 30], [240, 240, 30, 30]]]) {
    assert.deepEqual(stats(s.spawn(type, 0, -30, 0, true, true)), mine, `player ${type}`);
    assert.deepEqual(stats(s.spawn(type, 1, 30, 0, true, true)), theirs, `computer ${type}`);
  }
  // A team 0 the computer plays (aiPlayer, AI against AI) is a computer side: the old values.
  const ai = new Simulation({ map: "basin", aiPlayer: true });
  assert.deepEqual(stats(ai.spawn("medic", 0, -30, 0, true, true)), [75, 75, 30, 30], "computer-played team 0");
  // Saved: a player Medic keeps its health through a save and load.
  const medic = s.entities.find((e) => e.type === "medic" && e.team === 0);
  const loaded = restore(Simulation, s.serialize()).get(medic.id);
  assert.deepEqual(stats(loaded), [95, 95, 55, 55]);
  // A Stalker's Steady aim (95 through shields) still drops a Medic in one shot: it is the healer hunter.
  assert.ok(D.medic.player_hp <= D.stalker.damage && D.medic.hp <= D.stalker.damage);
});

test("attack-move with the whole group: support stays behind the front, heals, and survives", () => {
  const run = fight();
  run.s.issue(ids(run.mine), { type: "attackmove", x: 8, z: 8, pace: "group" });
  let heals = 0;
  const least = behindFront({ ...run, s: { tick: (dt) => { run.s.tick(dt); heals += run.s.events.filter((e) => e.type === "support" && e.team === 0).length; run.s.events.length = 0; } } }, 40);
  assert.ok(least > -0.5, `a support unit got ${(-least).toFixed(2)} m ahead of the front`);
  assert.ok(run.support.every((e) => e.hp > 0), "every support unit lives");
  assert.ok(run.foes.every((e) => !(e.hp > 0)), "the fight is won");
  assert.ok(heals > 0, "they healed from behind");
});

test("tapping an enemy with a mixed group: support follows the fighters instead of walking onto the enemy", () => {
  const run = fight();
  const fighters = run.fighters.filter((e) => e.damage > 0);
  run.s.issue(ids(fighters), { type: "attack", target: run.foes[0].id });
  run.s.issue(ids(run.support), { type: "escort", members: ids(fighters), x: run.foes[0].x, z: run.foes[0].z });
  assert.ok(run.support.every((e) => e.orders[0]?.type === "support" && e.orders[0].escort), "an escort order each");
  const least = behindFront(run, 30);
  assert.ok(least > -2.5, `a support unit got ${(-least).toFixed(2)} m ahead of the front`);
  assert.ok(run.support.every((e) => e.hp > 0), "every support unit lives");
});

test("a hurt support unit falls back behind the fighters", () => {
  const run = fight();
  run.s.issue(ids(run.mine), { type: "attackmove", x: 8, z: 8, pace: "group" });
  step(run.s, 1);
  const medic = run.support[0];
  run.support[1].hp = 0; // (the other Medic would heal it back up)
  medic.hp = medic.maxHp * 0.3;
  step(run.s, 4);
  const plan = escortPlan(run.s, medic, medic.orders[0].members, medic.orders[0].hx, medic.orders[0].hz);
  assert.ok(plan.hurt, "counts as hurt");
  assert.ok(plan.rear - plan.along(medic) >= FALL_BACK - 2.5, `only ${(plan.rear - plan.along(medic)).toFixed(2)} m behind the rear fighter`);
  assert.ok(FALL_BACK > BEHIND);
});

test("the army ordered without its support: idle support nearby comes along, far support stays", () => {
  const run = fight();
  const far = run.s.spawn("medic", 0, -34, -26);
  run.s.issue(ids(run.fighters), { type: "attackmove", x: 8, z: 8, pace: "group" });
  for (const e of run.support) assert.deepEqual([e.orders[0]?.type, e.orders[0]?.escort], ["support", true], `${e.type} comes along`);
  assert.equal(far.orders.length, 0, `a Medic more than ${ENLIST} m away stays`);
  // A plain order (the AI's, a bot's, Group pace off) enlists nobody.
  const plain = fight();
  plain.s.issue(ids(plain.fighters), { type: "attackmove", x: 8, z: 8 });
  assert.ok(plain.support.every((e) => !e.orders.length));
  const least = behindFront(run, 30);
  assert.ok(least > -0.5 && run.support.every((e) => e.hp > 0), `enlisted support kept behind (${least.toFixed(2)} m) and lived`);
});

test("escorts are deterministic and survive a save and reload", () => {
  const a = fight(), b = fight();
  for (const r of [a, b]) r.s.issue(ids(r.fighters), { type: "attackmove", x: 8, z: 8, pace: "group" });
  step(a.s, 3); step(b.s, 3);
  assert.equal(a.s.hash(), b.s.hash());
  const c = restore(Simulation, b.s.serialize());
  step(a.s, 10); step(c, 10);
  assert.equal(c.hash(), a.s.hash());
});

test("Harvesters auto-repair only at the base, only with no enemy near, then go back to mining", () => {
  const s = new Simulation({ ai: false, map: "classic" });
  step(s, 1);
  const hq = s.own(0).find((e) => e.type === "hq"), w = s.own(0).find((e) => e.type === "worker");
  const relay = s.spawn("relay", 0, hq.x + 8, hq.z + 6), outpost = s.spawn("relay", 0, hq.x + 8 + AUTO_REPAIR.base + 20, hq.z);
  relay.hp = relay.maxHp * 0.5; outpost.hp = outpost.maxHp * 0.5;
  const deposit = w.orders[0]?.target ?? w.resource;
  w.orders = []; w.x = relay.x + 4; w.z = relay.z;
  const far = s.own(0).filter((e) => e.type === "worker" && e !== w);
  // The other Harvesters are busy (a long walk), so only `w` is idle.
  for (const o of far) o.orders = [{ type: "move", x: hq.x, z: hq.z - 30 }];
  assert.deepEqual(JSON.parse(JSON.stringify(autoRepairJobs(s, 0))), [{ ids: [w.id], target: relay.id }], "the base building, by the nearby idle Harvester");
  // An enemy near the building: no job.
  const raider = s.spawn("ranger", 1, relay.x + 6, relay.z);
  s.visible?.[0]?.fill?.(1);
  s.tick(TICK);
  assert.deepEqual(autoRepairJobs(s, 0), [], "no auto-repair with an enemy near");
  raider.hp = 0; s.tick(TICK);
  for (const job of autoRepairJobs(s, 0)) s.issue(job.ids, { type: "repair", target: job.target, auto: true, resume: true });
  assert.equal(w.orders[0]?.type, "repair");
  step(s, 2);
  // Enemy arrives mid-job: the auto job ends.
  const second = s.spawn("ranger", 1, relay.x + 6, relay.z);
  step(s, 1);
  assert.notEqual(w.orders[0]?.type, "repair", "an automatic repair stops when an enemy comes near");
  second.hp = 0; step(s, 0.2);
  // A repair (or build) with `resume` sends the Harvester back to its last deposit afterwards.
  w.resource = deposit ?? s.resources[0].id;
  s.issue([w.id], { type: "repair", target: relay.id, resume: true });
  relay.hp = relay.maxHp - 1;
  step(s, 4);
  assert.equal(w.orders[0]?.type, "gather", "back to mining");
});

test("type chips: one per unit type of a mixed selection; a narrowed selection keeps its group", () => {
  const s = new Simulation({ ai: false, map: "basin" });
  const units = ["ranger", "ranger", "tank", "medic"].map((t, i) => s.spawn(t, 0, -30 + i * 2, 0));
  const all = new Set(ids(units));
  const m = chipModel(s, all, null);
  assert.deepEqual(m.types.map((t) => [t.type, t.ids.length]), [["ranger", 2], ["tank", 1], ["medic", 1]], "fighters first, support last");
  assert.equal(m.active, null);
  const narrowed = chipModel(s, new Set(m.types[0].ids), [...all]);
  assert.equal(narrowed.active, "ranger");
  assert.equal(narrowed.types.length, 3, "the chips of the whole group stay");
  assert.equal(chipModel(s, new Set(m.types[0].ids), null), null, "one type alone: no chips");
});
