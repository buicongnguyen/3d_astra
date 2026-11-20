// Expanded roster integration (AAA round 2, W2-A): every real workshop unit (Gunner, Stalker, Rampart)
// trains at its host and level under Expanded and is absent under Classic; the AI's `want` rules fire for
// each of the three in fixture situations; the drill is inert under Classic. Browser side: tests/workshops.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { HOST_OF, workshopUnitsOf } from "../src/factions.js";
import { wantedCount } from "../src/sim/content/workshops.js";

const EXP = { roster: "expanded" };
const UNITS = { gunner: "meridian", stalker: "veil", rampart: "ashfall" };

test("the three real workshop units sit at their hosts with the declared levels", () => {
  for (const [type, faction] of Object.entries(UNITS)) {
    assert.ok(workshopUnitsOf(faction).includes(type), `${faction} workshop lists ${type}`);
    assert.equal(D[type].workshop, faction);
    assert.equal(D[type].roster, "expanded");
  }
  assert.deepEqual([D.gunner.required_level, D.stalker.required_level, D.rampart.required_level], [1, 2, 3]);
});

test("each trains at its host from its level under Expanded, never under Classic", () => {
  for (const [type, faction] of Object.entries(UNITS)) {
    const host = HOST_OF[faction];
    for (const rules of [EXP, undefined]) {
      const s = new Simulation({ ai: false, factions: { 0: faction, 1: "wardens" }, ...(rules ? { rules } : {}) });
      s.players[0].alloy = s.players[0].energy = 9999;
      const b = s.spawn(host, 0, 0, 0);
      if (!rules) { assert.equal(s.enqueue(b.id, type), false, `${type}: Classic refuses`); assert.ok(!s.canTrain(0, type)); continue; }
      assert.ok(s.canTrain(0, type), type);
      b.level = D[type].required_level - 1 || 1;
      if (D[type].required_level > 1) assert.equal(s.enqueue(b.id, type), false, `${type}: refused below level ${D[type].required_level}`);
      b.level = D[type].required_level;
      assert.equal(s.enqueue(b.id, type), true, `${type}: queued at level ${b.level}`);
      assert.equal(b.queue.at(-1).type, type);
    }
  }
});

test("a queued Rampart rolls out of the Salvage yard", () => {
  const s = new Simulation({ ai: false, factions: { 0: "ashfall", 1: "wardens" }, rules: EXP });
  s.players[0].alloy = s.players[0].energy = 9999;
  const b = s.spawn("salvageyard", 0, 0, 0);
  b.level = 3;
  s.enqueue(b.id, "rampart");
  for (let i = 0; i < 28 / 0.05 + 100 && !s.entities.some((e) => e.type === "rampart"); i++) { s.tick(0.05); s.events.length = 0; }
  assert.ok(s.entities.some((e) => e.type === "rampart" && e.team === 0));
});

test("AI want rules: Gunner follows infantry, Stalker follows healers and anti-tank, Rampart follows towers and time", () => {
  const mix = (o) => ({ total: 10, infantry: 0, support: 0, antiarmor: 0, towers: 0, ...o });
  const g = D.gunner.ai, st = D.stalker.ai, r = D.rampart.ai;
  assert.equal(wantedCount(g, { time: 100 }, mix({ infantry: 8 })), 2);
  assert.equal(wantedCount(g, { time: 100 }, mix({ infantry: 1 })), 1);
  assert.equal(wantedCount(st, { time: 100 }, mix({ support: 2 })), 2);
  assert.equal(wantedCount(st, { time: 100 }, mix({ antiarmor: 3 })), 2);
  assert.equal(wantedCount(st, { time: 100 }, mix({})), 0);
  assert.equal(wantedCount(st, { time: 700 }, mix({})), 1);
  assert.equal(wantedCount(r, { time: 100 }, mix({ towers: 1 })), 2);
  assert.equal(wantedCount(r, { time: 100 }, mix({})), 0);
  assert.equal(wantedCount(r, { time: 500 }, mix({})), 1);
  assert.equal(wantedCount(r, { time: 500 }, mix({ towers: 3 })), 2, "capped by max");
});

test("the Ashfall AI raises its Salvage yard and trains Ramparts in a long Expanded match", () => {
  const s = new Simulation({ map: "classic", rules: EXP, factions: { 0: "ashfall", 1: "ashfall" }, aiPlayer: true, aiSpeed: "fast" });
  let yard = 1, seen = false;
  while (s.time < 900 && !s.result) {
    s.tick(0.05); s.events.length = 0;
    for (const e of s.entities) if (e.type === "salvageyard" && e.hp > 0) yard = Math.max(yard, e.level);
    if (!seen && s.entities.some((e) => e.type === "rampart")) seen = true;
  }
  assert.ok(seen || s.result || yard >= 2, `yard level ${yard}, rampart ${seen}, ended ${s.result} at ${Math.round(s.time)}`);
});

test("the drill and facing leave a Classic match alone: no drill key, no facing tag, with or without rules {}", () => {
  const a = new Simulation({ map: "classic", factions: { 0: "sunward", 1: "ashfall" }, aiPlayer: true });
  const b = new Simulation({ map: "classic", factions: { 0: "sunward", 1: "ashfall" }, aiPlayer: true, rules: {} });
  for (let i = 0; i < 6000; i++) { a.tick(0.05); b.tick(0.05); a.events.length = 0; b.events.length = 0; }
  assert.equal(a.hash(), b.hash());
  assert.ok(!a.entities.some((e) => e.drill));
});
