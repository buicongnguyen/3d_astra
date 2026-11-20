// The status core (AAA round 2, W0-B; src/sim/effects.js): lazy e.fx timers, immunity, the speed,
// reload and taken factors, noFire and noCast, the one-second sweep and saves. The statuses are
// registered by a fixture module through the dispatcher's test hook (src/sim/content.js).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { setContentModules, STATUSES } from "../src/sim/content.js";
import { statusInfo } from "../src/sim/effects.js";
import { advance } from "./lib/sim.js";

const TICK = 0.05;
const run = (s, seconds) => { advance(s, seconds, { steps: "round", events: "clear" }); return s.hash(); };
const FIXTURE = { id: "fixture-statuses", statuses: {
  pinned: { speed: 0.5, reload: 1.5, noCast: true, icon: "pin" },
  stunned: { noFire: true, icon: "stun" },
  exposed: { taken: 1.25 },
  slowed: { speed: 0.8 },
} };
let restore;
test.beforeEach(() => { restore = setContentModules([FIXTURE]); });
test.afterEach(() => restore());
const field = () => new Simulation({ ai: false });

test("statuses are registered from content modules, with their icons", () => {
  assert.deepEqual(Object.keys(STATUSES), ["pinned", "stunned", "exposed", "slowed"]);
  assert.equal(statusInfo("pinned").icon, "pin");
  assert.throws(() => { STATUSES.pinned.speed = 1; }, TypeError, "a registered status is frozen");
});

test("state is lazy: no fx and no fxOn until the first status, then both", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  assert.equal("fx" in r, false);
  assert.equal("fxOn" in s, false);
  assert.equal(s.hasStatus(r, "pinned"), false);
  assert.equal(s.statusFactor(r, "speed"), 1);
  assert.equal(s.canAct(r, "fire"), true);
  assert.equal(s.applyStatus(r, "pinned", 3), true);
  assert.deepEqual(r.fx, { pinned: 3 });
  assert.equal(s.fxOn, true);
  assert.throws(() => s.applyStatus(r, "frozen", 1), /Unknown status "frozen"/);
  assert.throws(() => s.canAct(r, "dance"), /unknown act/);
});

test("a status is active while its end is later than the clock, and never shortened", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  s.applyStatus(r, "slowed", 2);
  s.applyStatus(r, "slowed", 1);
  assert.equal(r.fx.slowed, 2, "a shorter one does not cut the running one");
  run(s, 1.95);
  assert.equal(s.hasStatus(r, "slowed"), true);
  s.applyStatus(r, "slowed", 1);
  assert.ok(Math.abs(r.fx.slowed - (s.time + 1)) < 1e-9, "a longer one extends it");
  run(s, 1.05);
  assert.equal(s.hasStatus(r, "slowed"), false);
  assert.equal(s.applyStatus(s.spawn("ranger", 0, 2, 0), "slowed", 0), false, "zero seconds do nothing");
  const dead = s.spawn("ranger", 0, 4, 0);
  dead.hp = 0;
  assert.equal(s.applyStatus(dead, "slowed", 3), false, "the dead take no status");
});

test("immunity: refused while the status runs and for `immune` seconds after it, then accepted", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  assert.equal(s.applyStatus(r, "pinned", 3, { immune: 4 }), true);
  assert.equal(r.fx.pinnedImmune, 7);
  run(s, 1);
  assert.equal(s.applyStatus(r, "pinned", 3, { immune: 4 }), false, "no refresh while pinned: a pin lasts at most 3 s");
  run(s, 2.5);
  assert.equal(s.hasStatus(r, "pinned"), false);
  assert.equal(s.applyStatus(r, "pinned", 3), false, "immune");
  assert.equal(s.applyStatus(r, "slowed", 3), true, "immunity is per status");
  run(s, 3.6);
  assert.equal(s.applyStatus(r, "pinned", 3, { immune: 4 }), true);
});

test("factors multiply over the active statuses in registration order; expired ones count for nothing", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  s.applyStatus(r, "slowed", 5);
  s.applyStatus(r, "pinned", 1);
  assert.equal(s.statusFactor(r, "speed"), 0.5 * 0.8);
  assert.equal(s.statusFactor(r, "reload"), 1.5);
  assert.equal(s.statusFactor(r, "taken"), 1);
  assert.deepEqual(s.activeStatuses(r), ["pinned", "slowed"], "registration order, not the order applied");
  run(s, 1.5);
  assert.equal(s.statusFactor(r, "speed"), 0.8);
  assert.deepEqual(s.activeStatuses(r), ["slowed"]);
});

test("H11: speed statuses slow movement, before the ford's factor", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  const base = s.moveSpeed(r);
  s.applyStatus(r, "pinned", 3);
  assert.equal(s.moveSpeed(r), base * 0.5);
  // A pinned unit covers half the ground of a free twin in the same time.
  const free = s.spawn("ranger", 0, 0, 6);
  s.issue([r.id], { type: "move", x: 0, z: -20 });
  s.issue([free.id], { type: "move", x: 0, z: -14 });
  run(s, 1);
  const pinnedWent = Math.abs(r.z), freeWent = Math.abs(free.z - 6);
  assert.ok(Math.abs(pinnedWent / freeWent - 0.5) < 0.05, `${pinnedWent.toFixed(2)} against ${freeWent.toFixed(2)}`);
});

test("H9: a reload status lengthens the cooldown after a shot", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0), foe = s.spawn("vanguard", 1, 6, 0);
  s.hit(r, foe);
  assert.equal(r.cooldown, D.ranger.interval);
  s.applyStatus(r, "pinned", 3);
  s.hit(r, foe);
  assert.equal(r.cooldown, D.ranger.interval * 1.5);
});

test("H10: a stunned tower keeps facing its target but stays silent until the stun ends", () => {
  const s = field(), tower = s.spawn("tower", 0, 0, 0), foe = s.spawn("vanguard", 1, 6, 2);
  Object.assign(foe, { hp: 9999, maxHp: 9999, damage: 0 });
  s.updateVision();
  s.applyStatus(tower, "stunned", 2);
  let shots = 0, firstShot = null;
  for (let i = 0; i < 60; i++) {
    s.tick(TICK);
    for (const ev of s.events) if (ev.type === "shot" && ev.source === tower.id) { shots++; firstShot ??= s.time; }
    s.events.length = 0;
    if (i === 10) assert.ok(Math.abs(tower.angle - Math.atan2(foe.x - tower.x, foe.z - tower.z)) < 1e-9 && tower.attacking, "aimed while stunned");
  }
  assert.ok(shots > 0, "fires again after the stun");
  assert.ok(firstShot >= 2 - 1e-9, `first shot at ${firstShot}`);
});

test("H14: a noCast status holds the ability back; H12: taken statuses scale damage", () => {
  const s = field(), r = s.spawn("ranger", 0, 0, 0);
  assert.equal(s.abilityReady(r), true);
  s.applyStatus(r, "pinned", 3);
  assert.equal(s.abilityReady(r), false);
  assert.equal(s.useAbility(r), false);
  assert.equal(s.canAct(r, "cast"), false);
  assert.equal(s.canAct(r, "fire"), true, "Pinned still fires");
  run(s, 3.1);
  assert.equal(s.abilityReady(r), true);
  const v = s.spawn("vanguard", 1, 6, 0);
  v.shield = 0;
  s.applyStatus(v, "exposed", 5);
  s.applyDamage(v, 40, 0);
  assert.equal(v.maxHp - v.hp, 50);
});

test("the sweep deletes expired keys once a second, then e.fx, then sim.fxOn", () => {
  // `twin` never has a status, nor `plain` (the same match without any): their keys are what a's and s's come back to.
  const s = field(), a = s.spawn("ranger", 0, 0, 0), b = s.spawn("ranger", 0, 2, 0), twin = s.spawn("ranger", 0, 4, 0);
  const plain = field();
  for (const x of [0, 2, 4]) plain.spawn("ranger", 0, x, 0);
  s.applyStatus(a, "slowed", 0.5);
  s.applyStatus(b, "pinned", 1.5, { immune: 1 });
  run(s, 1);
  assert.equal("fx" in a, false, "a's only status ended and was swept at 1 s");
  assert.deepEqual(Object.keys(b.fx), ["pinned", "pinnedImmune"]);
  run(s, 1);
  assert.deepEqual(Object.keys(b.fx), ["pinnedImmune"], "the pin is swept; its immunity runs on");
  assert.equal(s.fxOn, true);
  run(s, 1);
  assert.equal("fx" in b, false);
  assert.equal("fxOn" in s, false);
  run(plain, 3);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(plain).sort(), "the sim's keys are a match's without statuses");
  assert.equal(s.hash(), plain.hash(), "and so is its whole state");
  assert.deepEqual(Object.keys(a).sort(), Object.keys(twin).sort(), "and the unit's are a twin's that never had a status");
  assert.equal(s.clearStatus(a, "slowed"), false);
  s.applyStatus(a, "slowed", 9);
  assert.equal(s.clearStatus(a, "slowed"), true);
  assert.equal("fx" in a, false);
});

test("a save mid-status reloads to the same hash and plays on identically", () => {
  const pin = { id: "fixture-pinner", order: 1, step(sim) {
    // Every 2 s, pin the first enemy unit near the middle (a scripted stand-in for a Gunner's fire).
    if (sim.ticks % 40) return;
    const t = sim.entities.find((e) => e.team === 1 && e.kind === "unit" && e.hp > 0 && e.type !== "worker");
    if (t) sim.applyStatus(t, "pinned", 3, { immune: 4 });
  } };
  setContentModules([FIXTURE, pin]);
  const a = new Simulation({ map: "classic", aiSpeed: "fast" });
  run(a, 61);
  assert.ok(a.entities.some((e) => e.fx), "someone is under a status at the save");
  const b = Simulation.load(a.serialize());
  assert.equal(b.hash(), a.hash());
  for (let i = 0; i < 3; i++) assert.equal(run(b, 20), run(a, 20), `${20 * (i + 1)} s after loading`);
});
// The 300 s AI-against-AI check (no entity carries fx, no fxOn) shares its run with the key check in tests/content-seams.test.js.
