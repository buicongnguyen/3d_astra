// Why no shot (owner 2026-11-28): while a driven hero's trigger waits, the sim says why with a `heroBlocked` event
// (sim/content/hero-mode.js BLOCKED): out of range, not visible, a blocked line of fire, a weapon switch or a magazine
// reload. At most one every BLOCKED_EVERY ticks, the same in every run, and none while a shot can go or nothing is held.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { LAND } from "../src/sim/content/skywing.js";
import { enterCommands, BLOCKED, BLOCKED_EVERY } from "../src/sim/content/hero-mode.js";

const TICK = 0.05;
// Plays on, collecting the driven hero's heroBlocked reasons.
function play(s, seconds) {
  const out = [];
  for (let i = 0, n = Math.round(seconds / TICK); i < n; i++) { s.tick(TICK); for (const ev of s.events) if (ev.type === "heroBlocked") out.push(ev.reason); s.events.length = 0; }
  return out;
}
// Skywing in Hero mode (0.5x), landed at the middle of a quiet field.
function field() {
  const s = new Simulation({ map: "classic", ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  s.command({ team: 0, type: "skywing" });
  const e = s.get(s.skywing.id);
  e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
  s.tick(TICK);
  for (const c of enterCommands(0, e.id, 0.5)) s.command(c);
  s.command({ team: 0, type: "skywingLand", id: e.id, land: true, x: 0, z: 0 });
  play(s, LAND.land * 0.5 + 0.1);
  assert.equal(e.landed, true);
  return { s, e };
}
const foe = (s, x, z) => { const t = s.spawn("ranger", 1, x, z, true, true); t.orders = []; t.damage = 0; t.hp = t.maxHp = 5000; return t; };
const fire = (s, t, hold = true) => s.command({ team: 0, type: "heroFire", target: t.id, hold });

test("the reasons are the owner's list", () => {
  for (const r of ["No target", "Out of range", "Reloading", "Hold to lock", "Blocked", "Switching weapon", "Not visible"]) assert.ok(BLOCKED.includes(r), r);
});

test("out of range, then nothing once it can fire; a few a second at most", () => {
  const { s, e } = field();
  const t = foe(s, 0, 40);
  s.updateVision();
  fire(s, t);
  const far = play(s, 2);
  assert.ok(far.length > 0 && far.every((r) => r === "Out of range"), JSON.stringify(far));
  assert.ok(far.length <= Math.ceil(2 / TICK / BLOCKED_EVERY), `rate: ${far.length}`);
  // In range and seen: it fires, nothing to say (the gap between two shots is not a reason).
  t.z = 8;
  s.updateVision();
  const near = play(s, 1);
  assert.deepEqual(near.filter((r) => r !== "Reloading"), [], JSON.stringify(near));
  assert.ok(t.hp < 5000, "hit");
  void e;
});

test("not visible: an enemy in reach under the fog", () => {
  const { s, e } = field();
  const t = foe(s, 0, 9);
  // Blind: no sight from anything of team 0.
  for (const u of s.entities) if (u.team === 0) u.vision = 0;
  e.vision = 0;
  s.updateVision();
  s.command({ team: 0, type: "heroFire", target: t.id, hold: true });
  // (Skywing's scope, up after a second standing still, would see it: the first reasons come before.)
  delete e.scope; e.stillAt = s.time;
  const seen = play(s, 0.4);
  assert.ok(seen.length && seen.every((r) => r === "Not visible"), JSON.stringify(seen));
});

test("blocked: a building on the line of fire", () => {
  const { s } = field();
  const t = foe(s, 0, 12);
  const wall = s.spawn("barracks", 0, 0, 6, true, true);
  s.nav.rebuild(s.entities);
  assert.equal(s.nav.clearLine(s.get(s.skywing.id), t, t.id), false, "the barracks stands in the way");
  s.updateVision();
  fire(s, t);
  const seen = play(s, 1);
  assert.ok(seen.includes("Blocked"), JSON.stringify(seen));
  void wall;
});

test("switching weapon and reloading while in reach", () => {
  const { s, e } = field();
  const t = foe(s, 0, 8);
  s.updateVision();
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "rocket" });
  fire(s, t);
  const sw = play(s, 0.5);
  assert.ok(sw.includes("Switching weapon"), JSON.stringify(sw));
  // A magazine run dry reloads: the wait says so.
  play(s, 1);
  e.mag = 1;
  const rl = play(s, 3);
  assert.ok(rl.includes("Reloading"), JSON.stringify(rl));
});

test("the same reasons in every run (deterministic), none without a trigger", () => {
  const run = () => { const { s } = field(); const t = foe(s, 0, 40); s.updateVision(); const idle = play(s, 1); fire(s, t); return { idle, held: play(s, 2), hash: s.hash() }; };
  const a = run(), b = run();
  assert.deepEqual(a.idle, []);
  assert.deepEqual(a.held, b.held);
  assert.equal(a.hash, b.hash);
});
