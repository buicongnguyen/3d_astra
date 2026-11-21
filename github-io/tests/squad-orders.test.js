// R3-B squad orders (docs/aaa/AAA_ROUND3_PLAN.md): group pace, support units trailing the fighters, the
// follow on arrival, the settings switch and the high-ground hint. The `pace: "group"` flag comes only
// from src/app/orders.js; without it every order runs as before (the golden pins guard that).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Simulation } from "../src/simulation.js";
import { restore } from "../src/snapshot.js";
import { formationSlots, groupSpeed, squadRole, KEEP } from "../src/sim/formation.js";
import { defaults, normalize } from "../src/settings.js";
import { TERRAIN } from "../src/terrain.js";
import { translate } from "../src/i18n.js";
import { HIGH_GROUND_HINT } from "../src/app/orders.js";

const TICK = 0.05, GOAL = { x: -8, z: 12.5 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// The owner's case on open ground (basin): two tanks, a Medic and an Engineer side by side, an enemy
// tower far ahead. `supportX` moves the two support units ahead of the tanks (worst case).
function squad({ flag = true, supportX = -36, only = null } = {}) {
  const s = new Simulation({ ai: false, map: "basin" });
  const units = [s.spawn("tank", 0, -36, 14), s.spawn("tank", 0, -36, 11), s.spawn("medic", 0, supportX, 13.5), s.spawn("engineer", 0, supportX, 11.5)];
  const enemy = s.spawn("tower", 1, 10, 12.5, true);
  const moving = only ? units.filter((e) => e.type === only).slice(0, 1) : units;
  s.issue(moving.map((e) => e.id), { type: "move", ...GOAL, ...(flag ? { pace: "group" } : {}) });
  return { s, units, moving, enemy, tanks: units.filter((e) => e.type === "tank"), support: units.filter((e) => e.support) };
}
// Ticks until every moving unit is done (a support unit on its follow order counts as arrived).
function arrive(run, limit = 60) {
  const done = () => run.moving.every((e) => !e.orders.length || e.orders[0].type === "support");
  for (let i = 1; i <= limit / TICK; i++) { run.s.tick(TICK); if (done()) return i * TICK; }
  return Infinity;
}

test("group pace: the Medic stays behind the tanks, the group arrives spread out and on time", () => {
  const solo = arrive(squad({ flag: false, only: "tank" }));
  const run = squad();
  let closest = Infinity, arrived = null;
  for (let i = 1; i <= 60 / TICK && arrived === null; i++) {
    run.s.tick(TICK);
    const medic = run.support.find((e) => e.type === "medic");
    // From the first second on (they start side by side): the Medic farther from the enemy than every tank.
    if (i * TICK >= 1) closest = Math.min(closest, dist(medic, run.enemy) - Math.max(...run.tanks.map((t) => dist(t, run.enemy))));
    if (run.moving.every((e) => !e.orders.length || e.orders[0].type === "support")) arrived = i * TICK;
  }
  assert.ok(closest > 0, `the Medic got ${closest.toFixed(2)} m closer to the enemy than a tank`);
  let spread = Infinity;
  for (const a of run.units) for (const b of run.units) if (a !== b) spread = Math.min(spread, dist(a, b) / Math.max(a.radius, b.radius));
  assert.ok(spread >= 1.5, `arrival spread ${spread.toFixed(2)} unit radii`);
  assert.ok(arrived <= solo * 1.1, `group ${arrived} s against the slowest unit alone ${solo} s`);
});

test("group pace: support units that start ahead step aside and the tanks are not held up", () => {
  const solo = arrive(squad({ flag: false, only: "tank" }));
  const run = squad({ supportX: -33 });
  assert.ok(run.support.every((e) => e.orders.length === 2 && e.orders[0].aside), "each steps aside first");
  const arrived = arrive(run);
  assert.ok(arrived <= solo * 1.1, `group ${arrived} s against ${solo} s`);
  for (const e of run.support) assert.ok(dist(e, GOAL) > Math.max(...run.tanks.map((t) => dist(t, GOAL))), `${e.type} ends behind the tanks`);
});

test("formation: fighters in front by health, ranged behind, support 3 m or more behind the fighters", () => {
  const s = new Simulation({ ai: false, map: "basin" });
  const units = ["ranger", "medic", "tank", "breaker", "engineer", "ranger"].map((type, i) => s.spawn(type, 0, -36, 6 + i * 1.6));
  const f = formationSlots(s, units, GOAL);
  const back = (e) => -((f.slots.get(e.id).x - GOAL.x) * f.hx + (f.slots.get(e.id).z - GOAL.z) * f.hz);
  const by = (role) => units.filter((e) => squadRole(e) === role).map(back);
  assert.deepEqual(units.map(squadRole), ["ranged", "support", "front", "front", "support", "ranged"]);
  assert.ok(Math.max(...by("front")) < Math.min(...by("ranged")), "front row ahead of the ranged row");
  assert.ok(Math.min(...by("support")) - Math.max(...by("ranged")) >= 3, "support at least 3 m behind the fighters");
  assert.equal(f.cap, Math.min(...units.filter((e) => !e.support).map((e) => e.speed)), "group pace is the slowest fighter's");
});

test("without the flag nothing changes: the 1.9 m grid, no squad data, own speeds", () => {
  const a = squad({ flag: false });
  for (const e of a.moving) assert.equal(e.orders[0].squad, undefined);
  // The plain grid offsets (sim/orders.js) for 4 units: a 2 x 2 grid at 1.9 m.
  assert.deepEqual(a.moving.map((e) => [e.orders[0].x, e.orders[0].z]), [[-8.95, 11.55], [-7.05, 11.55], [-8.95, 13.45], [-7.05, 13.45]]);
  for (const e of a.moving) assert.equal(a.s.moveSpeed(e), e.speed);
  // A flagged order with a single unit is a plain order too.
  const one = squad({ only: "medic" });
  assert.equal(one.moving[0].orders[0].squad, undefined);
  assert.equal(one.s.moveSpeed(one.moving[0]), one.moving[0].speed);
});

test("group pace lets go in combat and for units far from the group", () => {
  const run = squad();
  run.s.tick(TICK);
  const medic = run.support.find((e) => e.type === "medic"), tank = run.tanks[0];
  assert.ok(run.s.moveSpeed(medic) < medic.speed, "capped while with the group");
  medic.hitAt = run.s.time;
  assert.equal(groupSpeed(run.s, medic, medic.orders[0]), medic.speed, "hit: own speed");
  medic.hitAt = -99;
  medic.x -= KEEP + 5;
  run.s.tick(TICK);
  assert.equal(groupSpeed(run.s, medic, medic.orders[0]), medic.speed, "far behind: own speed to catch up");
  assert.equal(run.s.moveSpeed(tank), tank.speed, "the slowest fighter walks at its own speed");
});

test("on arrival an Engineer follows the nearest tank and a Medic the nearest infantry", () => {
  const s = new Simulation({ ai: false, map: "basin" });
  const units = [s.spawn("tank", 0, -36, 14), s.spawn("ranger", 0, -36, 11), s.spawn("medic", 0, -36, 9), s.spawn("engineer", 0, -36, 16)];
  s.issue(units.map((e) => e.id), { type: "move", ...GOAL, pace: "group" });
  for (let i = 0; i < 40 / TICK; i++) s.tick(TICK);
  const [tank, ranger, medic, engineer] = units;
  assert.deepEqual(engineer.orders.map((o) => [o.type, o.target]), [["support", tank.id]]);
  assert.deepEqual(medic.orders.map((o) => [o.type, o.target]), [["support", ranger.id]]);
});

test("a save mid-march reloads into the same march", () => {
  const a = squad({ supportX: -33 }), b = squad({ supportX: -33 });
  for (let i = 0; i < 3 / TICK; i++) { a.s.tick(TICK); b.s.tick(TICK); }
  const c = restore(Simulation, b.s.serialize());
  for (let i = 0; i < 8 / TICK; i++) { a.s.tick(TICK); c.tick(TICK); }
  assert.equal(c.hash(), a.s.hash());
});

test("Group pace setting: on by default, kept when off, and only the interface sends the flag", () => {
  assert.equal(defaults().groupPace, true);
  assert.equal(defaults(true).groupPace, true);
  assert.equal(normalize({ ...defaults(), groupPace: false }).groupPace, false);
  assert.equal(normalize({ version: 1 }).groupPace, true, "old saves get the default");
  // No test, bot, tool or AI sets the flag: only src/app/orders.js writes `pace: "group"`.
  const root = join(import.meta.dirname, ".."), hits = [];
  const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(m?js)$/.test(name) && /pace:\s*["']group["']\s*[,}]/.test(readFileSync(p, "utf8"))) hits.push(relative(root, p).replaceAll("\\", "/")); } };
  for (const dir of ["src", "tools"]) walk(join(root, dir));
  assert.deepEqual(hits, ["src/app/orders.js"]);
});

test("high-ground hint states the balance numbers and has its Vietnamese", () => {
  assert.equal(HIGH_GROUND_HINT, `High ground: +${TERRAIN.high_range} m range, +${Math.round((TERRAIN.high_damage - 1) * 100)}% damage`);
  assert.notEqual(translate(HIGH_GROUND_HINT, "vi"), HIGH_GROUND_HINT);
  for (const text of ["All army", "Fighters", "Group pace", "+ Group 2", "Following Battle tank"]) assert.notEqual(translate(text, "vi"), text, text);
});
