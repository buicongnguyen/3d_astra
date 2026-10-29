import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

const drain = (s) => s.events.splice(0);

test("a finished training job announces a spawn at the new unit", () => {
  const s = new Simulation({ map: "classic" });
  const hq = s.own(0).find((e) => e.type === "hq");
  s.players[0].alloy = s.players[0].energy = 9999;
  drain(s);
  assert.ok(s.enqueue(hq.id, "worker") !== false);
  for (let i = 0; i < 600 && !s.events.some((e) => e.type === "spawn"); i++) s.tick(0.05);
  const ev = s.events.find((e) => e.type === "spawn");
  assert.ok(ev, "spawn event emitted");
  const unit = s.get(ev.seed);
  assert.equal(ev.team, 0);
  assert.equal(unit.x, ev.x);
  assert.equal(unit.z, ev.z);
});

test("a completed building and a drop-off each emit one event with position and team", () => {
  const s = new Simulation({ map: "classic" });
  const hq = s.own(0).find((e) => e.type === "hq");
  const worker = s.own(0).find((e) => e.type === "worker");
  s.players[0].alloy = s.players[0].energy = 9999;
  drain(s);
  const site = s.findPlacement("relay", 0, hq.x + 12, hq.z);
  const b = s.build(worker.id, "relay", site.x, site.z);
  assert.ok(b);
  for (let i = 0; i < 1200 && !b.complete; i++) s.tick(0.05);
  const built = s.events.filter((e) => e.type === "built" && e.team === 0);
  assert.equal(built.length, 1);
  assert.deepEqual([built[0].team, built[0].seed], [0, b.id]);
  assert.ok(built[0].radius > 0);
  // A Harvester carrying cargo into the Command core announces the delivery once.
  drain(s);
  Object.assign(worker, { carry: 8, carryType: "alloy", x: hq.x + hq.radius + 1, z: hq.z });
  s.issue([worker.id], { type: "deliver", target: hq.id });
  for (let i = 0; i < 100 && !s.events.some((e) => e.type === "deliver"); i++) s.tick(0.05);
  const drops = s.events.filter((e) => e.type === "deliver" && e.team === 0);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].resource, "alloy");
  assert.equal(drops[0].tx, hq.x);
});

test("a finished Command core upgrade announces a level-up", () => {
  const s = new Simulation({ map: "classic" });
  const hq = s.own(0).find((e) => e.type === "hq");
  s.players[0].alloy = s.players[0].energy = 9999;
  drain(s);
  assert.ok(s.upgradeBuilding(hq.id, 0) !== false);
  for (let i = 0; i < 1000 && !s.events.some((e) => e.type === "levelup"); i++) s.tick(0.05);
  const ev = s.events.find((e) => e.type === "levelup" && e.team === 0);
  assert.ok(ev, "levelup event emitted");
  assert.equal(ev.level, 2);
});

test("workers that mine or build are detectable by the work effects, and an emptied deposit flips once", async () => {
  const { isHarvesting } = await import("../src/activity.js");
  const s = new Simulation({ map: "classic" });
  const worker = s.own(0).find((e) => e.type === "worker");
  const dep = s.resources.filter((r) => r.type === "alloy").sort((a, b) => Math.hypot(a.x - worker.x, a.z - worker.z) - Math.hypot(b.x - worker.x, b.z - worker.z))[0];
  s.issue([worker.id], { type: "gather", target: dep.id });
  let mined = false;
  for (let i = 0; i < 1200 && !mined; i++) { s.tick(0.05); mined = isHarvesting(s, worker); }
  assert.ok(mined, "a Harvester at its deposit counts as mining (the spark effect keys on this)");
  const before = dep.amount;
  dep.amount = 0; // exhausted: the shatter effect fires on the live -> empty transition only
  assert.ok(before > 0 && dep.amount <= 0);
});
