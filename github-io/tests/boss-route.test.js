// Boss route mode (W1-E): the Iron Sovereign walks a Defence road, stops to attack and resumes,
// a leak costs 10 lives, a boss group spawns exactly its count, and the walk is deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { routeFight } from "./lib/sovereign.mjs";

const play = (towers, seconds) => {
  const { s } = routeFight({ towers });
  const log = { moved: 0, still: 0, warns: 0, drops: 0 };
  let last = null;
  for (let i = 0; i < seconds * 20 && !s.result; i++) {
    s.tick(0.05);
    for (const e of s.events) { if (e.type === "bossWarn") log.warns++; if (e.type === "bossDrop") log.drops++; }
    s.events.length = 0;
    const b = s.entities.find((e) => e.boss && e.hp > 0);
    if (b && last) { if (Math.hypot(b.x - last.x, b.z - last.z) > 1e-3) log.moved++; else log.still++; }
    last = b ? { x: b.x, z: b.z } : null;
  }
  return { s, log };
};

test("the boss group spawns exactly one Sovereign and it wakes at once on the road", () => {
  const { s } = routeFight({ towers: 0 });
  for (let i = 0; i < 100; i++) s.tick(0.05);
  const bosses = s.entities.filter((e) => e.boss);
  assert.equal(bosses.length, 1);
  assert.equal(bosses[0].bs.phase, "tracking");
});

test("route walk: it walks, stops to attack and resumes; two runs hash alike", () => {
  const a = play(10, 60), b = play(10, 60);
  assert.ok(a.log.moved > 20 && a.log.still > 20, JSON.stringify(a.log));
  assert.ok(a.log.warns >= 2);
  assert.equal(a.s.hash(), b.s.hash());
});

test("a Sovereign that reaches the exit costs 10 lives", () => {
  const { s } = routeFight({ towers: 0 });
  const start = s.defence.lives;
  for (let i = 0; i < 20 * 400 && s.defence.lives === start && !s.result; i++) { s.tick(0.05); s.events.length = 0; }
  assert.equal(start - s.defence.lives, 10);
});

test("a save mid-route reloads to the same hash", () => {
  const { s } = routeFight({ towers: 6 });
  for (let i = 0; i < 20 * 40; i++) { s.tick(0.05); s.events.length = 0; }
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  for (let i = 0; i < 200; i++) { s.tick(0.05); copy.tick(0.05); s.events.length = 0; copy.events.length = 0; }
  assert.equal(copy.hash(), s.hash());
});

test("drops walk the boss's road (spawnOnRoute)", () => {
  const { s } = routeFight({ towers: 0 });
  for (let i = 0; i < 40; i++) s.tick(0.05);
  const boss = s.entities.find((e) => e.boss);
  boss.hp = boss.maxHp * 0.6;
  s.tick(0.05);
  const drones = s.entities.filter((e) => e.type === "drone" && e.team === 1);
  assert.equal(drones.length, 2);
  assert.ok(drones.every((d) => d.orders[0]?.type === "route" && d.orders[0].route === boss.orders[0].route));
});
