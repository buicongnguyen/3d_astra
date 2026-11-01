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

test("a building that would wall in the ground behind it is refused; ordinary building is not", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1, ai: false });
  s.players[0].alloy = s.players[0].energy = 9999;
  s.isVisible = () => true; // the placement rule under test is the geometry, not fog of war
  const centre = { x: 6, z: 40 }, ring = D.relay.radius * 2 + 1.5; // 1.5 m gaps: rarely passable on the 2 m route grid
  const spots = Array.from({ length: 6 }, (_, i) => ({ x: centre.x + Math.cos((i / 6) * Math.PI * 2) * ring, z: centre.z + Math.sin((i / 6) * Math.PI * 2) * ring }));
  let refused = 0, placed = 0;
  for (const p of spots) {
    const why = s.placement("relay", 0, p.x, p.z);
    if (why === "That would wall in the ground behind it.") refused++;
    else if (why === "") { const b = s.spawn("relay", 0, p.x, p.z); b.complete = true; s.nav.rebuild(s.entities); placed++; }
  }
  // Whatever got built, nothing near the ring may have been sealed off from the rest of the map.
  assert.equal(s.nav.wouldSeal(centre.x + 30, centre.z, 0.1, 40), false);
  assert.ok(placed >= 1, `some of the ring can be built (${placed} placed, ${refused} refused)`);
  const free = s.findPlacement("relay", 0, s.own(0).find((e) => e.type === "hq").x + 12, s.own(0).find((e) => e.type === "hq").z);
  assert.ok(free && s.placement("relay", 0, free.x, free.z) === "", "ordinary building next to the base is still allowed");
});

test("the sealing check refuses the last building of a closed ring and nothing in the open", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1, ai: false });
  const centre = { x: 0, z: 36 }, rel = D.relay.radius, ring = rel * 2 + 0.2; // buildings 0.2 m apart: a solid wall
  for (let i = 0; i < 5; i++) { const a = (i / 6) * Math.PI * 2, b = s.spawn("relay", 0, centre.x + Math.cos(a) * ring, centre.z + Math.sin(a) * ring); b.complete = true; }
  s.nav.rebuild(s.entities);
  const last = { x: centre.x + Math.cos((5 / 6) * Math.PI * 2) * ring, z: centre.z + Math.sin((5 / 6) * Math.PI * 2) * ring };
  assert.equal(s.nav.wouldSeal(last.x, last.z, rel), true, "closing the ring seals the middle");
  assert.equal(s.nav.wouldSeal(centre.x + 25, centre.z - 10, rel), false, "a building in open ground seals nothing");
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

test("a soldier on a repair job shoots back at an enemy in range, then resumes repairing", () => {
  const s = new Simulation({ map: "classic", enemyCount: 1, ai: false });
  s.players[0].alloy = s.players[0].energy = 9999;
  const bar = s.own(0).find((e) => e.type === "barracks");
  const ranger = s.spawn("ranger", 0, bar.x + bar.radius + 1.5, bar.z);
  bar.hp = bar.maxHp * 0.2;
  s.issue([ranger.id], { type: "repair", target: bar.id });
  for (let i = 0; i < 30; i++) s.tick(0.05);
  const enemy = s.spawn("vanguard", 1, ranger.x + 5, ranger.z);
  s.updateVision();
  const before = enemy.hp + enemy.shield;
  for (let i = 0; i < 80; i++) s.tick(0.05);
  assert.ok(enemy.hp + enemy.shield < before || enemy.hp <= 0, "the ranger fired at the enemy while on a repair order");
  assert.equal(ranger.orders[0]?.type, "repair", "and still holds its repair order");
});
