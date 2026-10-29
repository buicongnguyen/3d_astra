import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";

const hqOf = (s) => s.own(0).find((e) => e.type === "hq");

test("units hugging or overlapping a building leave it and reach their destination", () => {
  for (const type of ["worker", "vanguard"]) {
    const s = new Simulation({ map: "classic", enemyCount: 1 });
    const hq = hqOf(s), units = [];
    // Footprint centre, inside the footprint, flush against it and just outside, all round the core.
    for (const frac of [0, 0.5, 0.95, 1.05, 1.3]) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, r = hq.radius * frac, u = s.spawn(type, 0, hq.x + Math.cos(a) * r, hq.z + Math.sin(a) * r);
      u.goal = { x: hq.x - 10 + units.length * 0.6, z: hq.z - 24 };
      units.push(u);
      s.issue([u.id], { type: "move", x: u.goal.x, z: u.goal.z });
    }
    for (let t = 0; t < 400 && !s.result; t++) s.tick(0.05);
    const stuck = units.filter((u) => Math.hypot(u.x - u.goal.x, u.z - u.goal.z) > 5);
    assert.deepEqual(stuck.map((u) => `${type}@${u.x.toFixed(1)},${u.z.toFixed(1)}`), []);
  }
});

test("a big unit squeezes out of a pocket between buildings instead of staying sealed in", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  const hq = hqOf(s);
  // Two buildings 1.25 m apart (the minimum the placement rule now allows): narrower than a vanguard, wider than a Harvester.
  for (const [kind, ang] of [["relay", 0], ["barracks", Math.PI * 0.6]]) {
    const r = hq.radius + 1.25 + D[kind].radius, b = s.spawn(kind, 0, hq.x + Math.cos(ang) * r, hq.z + Math.sin(ang) * r);
    b.complete = true;
  }
  s.nav.rebuild(s.entities);
  const u = s.spawn("vanguard", 0, hq.x + Math.cos(Math.PI * 0.3) * (hq.radius + 1.2), hq.z + Math.sin(Math.PI * 0.3) * (hq.radius + 1.2));
  const goal = { x: hq.x - 5, z: hq.z - 24 };
  s.issue([u.id], { type: "move", ...goal });
  for (let t = 0; t < 400 && !s.result; t++) s.tick(0.05);
  assert.ok(Math.hypot(u.x - goal.x, u.z - goal.z) < 5, `vanguard reached ${u.x.toFixed(1)},${u.z.toFixed(1)}`);
});

test("buildings keep a gap wide enough for the smallest unit", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  s.players[0].alloy = s.players[0].energy = 9999;
  const hq = hqOf(s), d = D.relay;
  // 1.0 m of clear ground between two footprints would seal a gap shut (a Harvester is 1.1 m wide).
  const z = (gap) => hq.z + hq.radius + gap + d.radius; // away from the starting Barracks
  assert.match(s.placement("relay", 0, hq.x, z(1.0)), /Too close/);
  assert.equal(s.placement("relay", 0, hq.x, z(1.3)), "");
});

test("ordinary infantry repair a damaged friendly building; vehicles and Engineers do not", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  s.players[0].alloy = s.players[0].energy = 9999;
  const bar = s.own(0).find((e) => e.type === "barracks");
  const ranger = s.spawn("ranger", 0, bar.x + 6, bar.z), tank = s.spawn("tank", 0, bar.x - 6, bar.z), engineer = s.spawn("engineer", 0, bar.x, bar.z + 6);
  bar.hp = bar.maxHp * 0.2;
  assert.ok(s.repairValid(ranger, bar));
  assert.equal(s.repairValid(tank, bar), false);
  assert.equal(s.repairValid(engineer, bar), false);
  const before = bar.hp;
  s.issue([ranger.id, tank.id], { type: "repair", target: bar.id });
  assert.equal(ranger.orders[0]?.type, "repair");
  assert.equal(tank.orders.length, 0, "a vehicle ignores the repair order");
  for (let t = 0; t < 200 && ranger.orders[0]; t++) s.tick(0.05);
  assert.ok(bar.hp > before + 10, `repaired ${before.toFixed(0)} -> ${bar.hp.toFixed(0)}`);
});

test("a soldier repairs slower than a Harvester", () => {
  const rate = (type) => {
    const s = new Simulation({ map: "classic", enemyCount: 1 });
    s.players[0].alloy = s.players[0].energy = 9999;
    const bar = s.own(0).find((e) => e.type === "barracks");
    const u = type === "worker" ? s.own(0).find((e) => e.type === "worker") : s.spawn("ranger", 0, bar.x + 4, bar.z);
    u.x = bar.x + bar.radius + 1; u.z = bar.z;
    bar.hp = bar.maxHp * 0.2;
    s.issue([u.id], { type: "repair", target: bar.id });
    const before = bar.hp;
    for (let t = 0; t < 40; t++) s.tick(0.05);
    return bar.hp - before;
  };
  const w = rate("worker"), r = rate("ranger");
  assert.ok(r > 0 && r < w, `ranger ${r.toFixed(1)} < worker ${w.toFixed(1)}`);
});

test("a Barracks boxed in by other buildings still releases its units, and they walk out", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  s.players[0].alloy = s.players[0].energy = 9999;
  const bar = s.own(0).find((e) => e.type === "barracks");
  // A tight ring of Sentinel towers right around the Barracks seals every ordinary exit point.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = bar.radius + D.tower.radius + 0.9, t = s.spawn("tower", 0, bar.x + Math.cos(a) * r, bar.z + Math.sin(a) * r);
    t.complete = true;
  }
  s.nav.rebuild(s.entities);
  const before = s.own(0).filter((e) => e.type === "vanguard").length;
  assert.ok(s.enqueue(bar.id, "vanguard") !== false);
  for (let i = 0; i < 400 && s.own(0).filter((e) => e.type === "vanguard").length === before; i++) s.tick(0.05);
  assert.equal(bar.queue[0]?.blocked ?? null, null, "the queue is not stuck on Exit blocked");
  const fresh = s.own(0).filter((e) => e.type === "vanguard").pop();
  assert.ok(fresh && s.own(0).filter((e) => e.type === "vanguard").length === before + 1, "the unit appeared");
  assert.ok(s.nav.canStand(fresh.x, fresh.z, fresh.radius), "on clear ground");
  const goal = { x: bar.x - 4, z: bar.z - 20 };
  s.issue([fresh.id], { type: "move", ...goal });
  for (let i = 0; i < 400; i++) s.tick(0.05);
  assert.ok(Math.hypot(fresh.x - goal.x, fresh.z - goal.z) < 5, `reached ${fresh.x.toFixed(1)},${fresh.z.toFixed(1)}`);
});

test("Harvesters have 100 health and repair at 16 HP per second", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1 });
  s.players[0].alloy = s.players[0].energy = 9999;
  const w = s.own(0).find((e) => e.type === "worker"), bar = s.own(0).find((e) => e.type === "barracks");
  assert.equal(w.maxHp, 100);
  w.x = bar.x + bar.radius + 1; w.z = bar.z;
  bar.hp = bar.maxHp * 0.2;
  s.issue([w.id], { type: "repair", target: bar.id });
  const before = bar.hp;
  for (let t = 0; t < 20; t++) s.tick(0.05); // one second at the work site
  assert.ok(Math.abs(bar.hp - before - 16) < 4, `restored ${(bar.hp - before).toFixed(1)} HP in about a second`);
});
