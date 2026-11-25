// The Kite's player price (owner 2026-11-25: "Kite should be cheap so that we can use it to observe the
// enemy"): your side pays balance.json `player_cost` 45 / 0 and trains it in `player_time` 8 s; every
// computer side (teams 1+, and team 0 when the computer plays it: aiPlayer) keeps `cost` 75 / 25 and
// `time` 12, so AI play is unchanged. Simulation.humanTeam / trainCost / trainTime; the queue's `paid`.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { readFileSync } from "node:fs";

const core = (s, team) => s.own(team).find((e) => e.type === "hq");
const rich = (s, team) => { s.players[team].alloy = 1000; s.players[team].energy = 1000; };
const wallet = (s, team) => [s.players[team].alloy, s.players[team].energy];
// Ticks production only (no AI, no combat) until the core's queue empties; returns the seconds taken.
function trainSeconds(s, b) {
  const dt = 0.05;
  let t = 0;
  while (b.queue.length && t < 60) { s.updateProduction(b, dt); t += dt; }
  return t;
}
const ready = (s, team) => { const b = core(s, team); b.level = 2; rich(s, team); return b; };

test("data: the Kite keeps the computer price and carries a separate player price", () => {
  assert.deepEqual(D.kite.cost, [75, 25]);
  assert.equal(D.kite.time, 12);
  assert.deepEqual(D.kite.player_cost, [45, 0]);
  assert.equal(D.kite.player_time, 8);
});

test("the human side pays 45 / 0 for a Kite and trains it in 8 s (6.7 s at a level 2 core)", () => {
  const s = new Simulation({ ai: false });
  assert.equal(s.humanTeam(0), true);
  assert.equal(s.humanTeam(1), false);
  assert.deepEqual(s.trainCost(0, "kite"), [45, 0]);
  assert.equal(s.trainTime(0, "kite"), 8);
  const b = ready(s, 0);
  assert.ok(s.enqueue(b.id, "kite"));
  assert.deepEqual(wallet(s, 0), [955, 1000]);
  assert.deepEqual(b.queue[0].paid, [45, 0]);
  const kites = () => s.own(0).filter((e) => e.type === "kite").length;
  const secs = trainSeconds(s, b);
  assert.ok(Math.abs(secs - 8 / 1.2) < 0.06, `trained in ${secs} s`);
  assert.equal(kites(), 1);
});

test("a computer side pays 75 / 25 and trains it in 12 s; other units keep one price", () => {
  const s = new Simulation({ ai: false });
  const b = ready(s, 1);
  assert.ok(s.enqueue(b.id, "kite"));
  assert.deepEqual(wallet(s, 1), [925, 975]);
  assert.equal(b.queue[0].paid, undefined, "a base-price entry stores nothing extra (saves and hashes unchanged)");
  const secs = trainSeconds(s, b);
  assert.ok(Math.abs(secs - 12 / 1.2) < 0.06, `trained in ${secs} s`);
  for (const type of ["worker", "ranger", "tank", "hawk"]) {
    assert.equal(s.trainCost(0, type), D[type].cost, type);
    assert.equal(s.trainTime(0, type), D[type].time, type);
  }
});

test("when the computer plays team 0 (aiPlayer) it pays the base price too", () => {
  const s = new Simulation({ aiPlayer: true });
  assert.equal(s.humanTeam(0), false);
  assert.deepEqual(s.trainCost(0, "kite"), [75, 25]);
  assert.equal(s.trainTime(0, "kite"), 12);
  s.aiEnabled = false;
  const b = ready(s, 0);
  assert.ok(s.enqueue(b.id, "kite"));
  assert.deepEqual(wallet(s, 0), [925, 975]);
});

test("cancel refunds what was paid, for each side", () => {
  const s = new Simulation({ ai: false });
  for (const team of [0, 1]) {
    const b = ready(s, team);
    assert.ok(s.enqueue(b.id, "kite"));
    assert.ok(s.cancelQueue(b.id, 0));
    assert.deepEqual(wallet(s, team), [1000, 1000], `team ${team}`);
  }
  // An entry from a save made before `paid` existed refunds this side's price today.
  const b = core(s, 0);
  assert.ok(s.enqueue(b.id, "kite"));
  delete b.queue[0].paid;
  assert.ok(s.cancelQueue(b.id, 0));
  assert.deepEqual(wallet(s, 0), [1000, 1000]);
});

test("a save mid-queue loads with the price paid and the player training time", () => {
  const s = new Simulation({ ai: false });
  const b = ready(s, 0);
  assert.ok(s.enqueue(b.id, "kite"));
  assert.ok(s.enqueue(b.id, "kite"));
  s.updateProduction(b, 2);
  const loaded = Simulation.load(s.serialize()), lb = core(loaded, 0);
  assert.equal(lb.queue.length, 2);
  assert.deepEqual(lb.queue[1].paid, [45, 0]);
  assert.ok(loaded.cancelQueue(lb.id, 1));
  assert.deepEqual(wallet(loaded, 0), [955, 1000], "the cancel refunds 45 / 0");
  const secs = trainSeconds(loaded, lb);
  assert.ok(Math.abs(secs - (8 - 2.4) / 1.2) < 0.06, `the rest of the 8 s (${secs} s)`);
});

// field-guide.js imports CSS (browser only), so its text is checked here and its page in tests/air.mjs.
test("the HUD tiles and the field guide read the price through trainCost / trainTime", () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  assert.match(src("app/hud.js"), /S\.sim\.trainCost\(0, t\.type\)/);
  assert.match(src("field-guide.js"), /sim\.trainCost\(team, type\)/);
  assert.match(src("field-guide.js"), /sim\.trainTime\(team, type\)/);
});
