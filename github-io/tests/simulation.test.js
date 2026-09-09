import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D, ROCKS, distance } from "../src/data.js";
import { Navigation } from "../src/navigation.js";

function advance(sim, seconds) {
  for (let t = 0; t < seconds; t += 0.05) {
    sim.tick(0.05);
    sim.events.length = 0;
  }
}
const own = (sim, type, team = 0) => sim.own(team).find((e) => e.type === type);

test("supply loss holds completed production until capacity is restored", () => {
  const sim = new Simulation({ ai: false }),
    hq = own(sim, "hq");
  const relay = sim.spawn("relay", 0, -10, 32);
  for (let i = 0; i < 8; i++) sim.spawn("ranger", 0, i * 2, 30);
  assert.equal(sim.population(0).used, 15);
  assert.equal(sim.enqueue(hq.id, "worker"), true);
  relay.hp = 0;
  advance(sim, 10);
  assert.equal(sim.population(0).used, 15);
  assert.equal(hq.queue[0].blocked, "Awaiting supply");
  sim.spawn("relay", 0, -10, 32);
  advance(sim, 0.2);
  assert.equal(sim.population(0).used, 16);
  assert.equal(hq.queue.length, 0);
});

test("research remains available when the army is over supply", () => {
  const sim = new Simulation({ ai: false }),
    foundry = sim.spawn("foundry", 0, -10, 32);
  sim.players[0].alloy = sim.players[0].energy = 1000;
  for (let i = 0; i < 10; i++) sim.spawn("ranger", 0, i * 2, 30);
  assert.ok(sim.population(0).used > sim.population(0).cap);
  assert.equal(sim.enqueue(foundry.id, "upgrade"), true);
  advance(sim, 26);
  assert.equal(sim.players[0].upgrade, true);
});

test("rock collisions participate in line checks and swept movement", () => {
  const nav = new Navigation();
  nav.rebuild([]);
  assert.equal(nav.clearLine({ x: -20, z: -5 }, { x: 0, z: -5 }), false);
  assert.equal(nav.canTraverse({ x: -20, z: -5 }, { x: 0, z: -5 }), false);
  assert.equal(nav.canStand(NaN, 0), false);
  assert.equal(nav.canTraverse({ x: NaN, z: 0 }, { x: 0, z: 0 }), false);
  assert.deepEqual(nav.path({ x: 0, z: 0 }, { x: Infinity, z: 0 }), []);
});

test("units displaced just inside obstacle clearance can escape but cannot move inward", () => {
  const nav = new Navigation();
  nav.rebuild([]);
  const [x, z, r] = ROCKS[0];
  assert.equal(
    nav.canTraverse({ x: x + r + 0.4, z }, { x: x + r + 0.45, z }, 0.55),
    true,
  );
  assert.equal(
    nav.canTraverse({ x: x + r + 0.4, z }, { x: x + r + 0.3, z }, 0.55),
    false,
  );
});

test("a finished match rejects production and construction refunds and new orders", () => {
  const sim = new Simulation({ ai: false }),
    hq = own(sim, "hq"),
    worker = own(sim, "worker");
  sim.enqueue(hq.id, "worker");
  const building = sim.spawn("relay", 0, -10, 32, false);
  own(sim, "hq", 1).hp = 0;
  sim.tick(0.05);
  const alloy = sim.players[0].alloy;
  assert.equal(sim.cancelQueue(hq.id, 0), false);
  assert.equal(sim.cancelBuilding(building.id), false);
  assert.equal(sim.enqueue(hq.id, "worker"), false);
  assert.equal(sim.build(worker.id, "relay", -10, 35), null);
  sim.issue([worker.id], { type: "move", x: 0, z: 0 });
  assert.equal(worker.orders.length, 0);
  assert.equal(sim.players[0].alloy, alloy);
});

test("a new obstacle invalidates an active route without allowing penetration", () => {
  const sim = new Simulation({ ai: false }),
    unit = own(sim, "ranger");
  unit.x = -8;
  unit.z = 30;
  sim.issue([unit.id], { type: "move", x: 16, z: 30 });
  advance(sim, 0.3);
  const revision = unit.pathRevision;
  const obstacle = sim.spawn("relay", 0, 3, 30);
  sim.nav.rebuild(sim.entities);
  for (let i = 0; i < 400; i++) {
    sim.tick(0.05);
    assert.ok(distance(unit, obstacle) >= obstacle.radius + 0.49);
  }
  assert.ok(unit.pathRevision > revision);
  assert.ok(distance(unit, { x: 16, z: 30 }) < 2);
});

test("orders reject invalid targets and coordinates and bound queued commands", () => {
  const sim = new Simulation({ ai: false }),
    unit = own(sim, "ranger");
  for (const order of [
    { type: "move", x: NaN, z: 0 },
    { type: "teleport", x: 0, z: 0 },
    { type: "attack", target: own(sim, "hq").id },
    { type: "attack", target: sim.resources[0].id },
  ]) {
    sim.issue([unit.id], order);
    assert.equal(unit.orders.length, 0);
  }
  sim.issue([unit.id, unit.id], { type: "move", x: 0, z: 20 }, true);
  assert.equal(unit.orders.length, 1);
  for (let i = 0; i < 100; i++)
    sim.issue([unit.id], { type: "move", x: i % 30, z: 20 }, true);
  assert.equal(unit.orders.length, 32);
});

test("a nearby worker can resume construction while the previous builder is away", () => {
  const sim = new Simulation({ ai: false });
  const workers = sim.own(0).filter((e) => e.type === "worker");
  const building = sim.spawn("relay", 0, -10, 32, false);
  building.builder = workers[0].id;
  sim.issue([workers[0].id, workers[1].id], {
    type: "build",
    target: building.id,
  });
  workers[1].x = building.x + building.radius + 1;
  workers[1].z = building.z;
  sim.tick(0.05);
  assert.equal(building.builder, workers[1].id);
  assert.ok(building.progress > 0);
});

test("production charges once, reserves population, and cancellation refunds", () => {
  const sim = new Simulation({ ai: false }),
    hq = own(sim, "hq"),
    before = sim.players[0].alloy;
  assert.equal(sim.enqueue(hq.id, "worker"), true);
  assert.equal(sim.players[0].alloy, before - 50);
  assert.equal(sim.population(0).reserved, 1);
  assert.equal(sim.cancelQueue(hq.id, 0), true);
  assert.equal(sim.players[0].alloy, before);
  assert.equal(sim.population(0).reserved, 0);
});

test("worker production completes and releases the population reservation", () => {
  const sim = new Simulation({ ai: false }),
    hq = own(sim, "hq");
  sim.enqueue(hq.id, "worker");
  advance(sim, 9);
  assert.equal(sim.own(0).filter((e) => e.type === "worker").length, 5);
  assert.deepEqual(sim.population(0), { used: 8, reserved: 0, cap: 15 });
});

test("queues enforce resources and population without overdrafts", () => {
  const sim = new Simulation({ ai: false }),
    hq = own(sim, "hq");
  sim.players[0].alloy = 49;
  assert.equal(sim.enqueue(hq.id, "worker"), false);
  assert.equal(sim.players[0].alloy, 49);
  sim.players[0].alloy = 1000;
  for (let i = 0; i < 8; i++) sim.spawn("ranger", 0, -5 + i, 20);
  assert.equal(sim.enqueue(hq.id, "worker"), false);
  assert.equal(sim.players[0].alloy, 1000);
});

test("worker gathers, delivers, and resumes without creating resources", () => {
  const sim = new Simulation({ ai: false }),
    worker = own(sim, "worker"),
    resource = sim.resources.find((r) => r.type === "alloy"),
    initial = resource.amount,
    bank = sim.players[0].alloy;
  sim.issue([worker.id], { type: "gather", target: resource.id });
  advance(sim, 35);
  assert.ok(
    sim.players[0].alloy > bank,
    `No delivery: ${JSON.stringify({ x: worker.x, z: worker.z, orders: worker.orders, carry: worker.carry })}`,
  );
  assert.equal(
    initial - resource.amount,
    sim.players[0].alloy - bank + worker.carry,
  );
  assert.ok(["gather", "deliver"].includes(worker.orders[0]?.type));
});

test("exhausted deposit delivers its final partial load and stops safely", () => {
  const sim = new Simulation({ ai: false }),
    worker = own(sim, "worker"),
    resource = sim.resources[0];
  resource.amount = 3;
  sim.resources = [resource]; // No nearby replacement exists in this scenario.
  const bank = sim.players[0].alloy;
  sim.issue([worker.id], { type: "gather", target: resource.id });
  advance(sim, 35);
  assert.equal(resource.amount, 0);
  assert.equal(sim.players[0].alloy, bank + 3);
  assert.equal(worker.carry, 0);
  assert.equal(worker.orders.length, 0);
});

test("placement rejects overlap, hidden terrain, and missing prerequisites", () => {
  const sim = new Simulation({ ai: false });
  assert.match(sim.placement("relay", 0, -25, 24), /structure/);
  assert.match(sim.placement("relay", 0, 30, -30), /Explore/);
  own(sim, "barracks").hp = 0;
  assert.match(sim.placement("foundry", 0, -15, 34), /Build Barracks before building Foundry/);
});

test("worker constructs relay and completed relay supplies population", () => {
  const sim = new Simulation({ ai: false }),
    worker = own(sim, "worker");
  const b = sim.build(worker.id, "relay", -19, 34);
  assert.ok(b, "Expected valid relay placement");
  advance(sim, 30);
  assert.equal(b.complete, true);
  assert.equal(sim.population(0).cap, 25);
});

test("canceled construction refunds only 75 percent and unblocks navigation", () => {
  const sim = new Simulation({ ai: false }),
    worker = own(sim, "worker"),
    before = sim.players[0].alloy;
  const b = sim.build(worker.id, "relay", -19, 34);
  assert.ok(b);
  assert.equal(sim.cancelBuilding(b.id), true);
  assert.equal(sim.players[0].alloy, before - 25);
  assert.equal(sim.cancelBuilding(b.id), false);
  advance(sim, 1);
  assert.equal(worker.orders.length, 0);
});

test("A* routes through open cells without cutting corners around obstacles", () => {
  const sim = new Simulation({ ai: false }),
    path = sim.nav.path({ x: -20, z: -15 }, { x: 20, z: 15 });
  assert.ok(path.length > 0);
  for (const p of path)
    for (const [x, z, r] of ROCKS)
      assert.ok(Math.hypot(p.x - x, p.z - z) >= r + 0.6);
});

test("queued movement completes in sequence and deleted targets are safe", () => {
  const sim = new Simulation({ ai: false }),
    unit = own(sim, "ranger");
  sim.issue([unit.id], { type: "move", x: -18, z: 9 });
  sim.issue([unit.id], { type: "move", x: -24, z: 10 }, true);
  advance(sim, 15);
  assert.equal(unit.orders.length, 0);
  assert.ok(distance(unit, { x: -24, z: 10 }) < 2);
  unit.orders.push({ type: "attack", target: -1 });
  advance(sim, 0.1);
  assert.equal(unit.orders.length, 0);
});

test("unseen enemies cannot be explicitly targeted", () => {
  const sim = new Simulation({ ai: false }),
    unit = own(sim, "ranger"),
    enemy = own(sim, "hq", 1);
  assert.equal(sim.isVisible(enemy), false);
  sim.issue([unit.id], { type: "attack", target: enemy.id });
  assert.equal(unit.orders.length, 0);
});

test("upgrade cannot be duplicated and affects existing and future combat units", () => {
  const sim = new Simulation({ ai: false }),
    b = sim.spawn("foundry", 0, -10, 32);
  sim.players[0].alloy = 1000;
  sim.players[0].energy = 1000;
  assert.equal(sim.enqueue(b.id, "upgrade"), true);
  assert.equal(sim.enqueue(b.id, "upgrade"), false);
  advance(sim, 26);
  assert.equal(sim.players[0].upgrade, true);
  assert.equal(sim.enqueue(b.id, "upgrade"), false);
  const attacker = own(sim, "ranger"),
    enemy = sim.spawn("worker", 1, attacker.x + 3, attacker.z),
    before = enemy.hp;
  enemy.shield = 0; // Isolate weapon research from the separately tested shield layer.
  sim.hit(attacker, enemy);
  assert.ok(Math.abs(before - enemy.hp - D.ranger.damage * 1.1) < 0.0001);
});

test("HQ destruction produces victory, defeat, and simultaneous draw", () => {
  for (const [dead, result] of [
    [[1], "victory"],
    [[0], "defeat"],
    [[0, 1], "draw"],
  ]) {
    const sim = new Simulation({ ai: false });
    for (const team of dead) own(sim, "hq", team).hp = 0;
    sim.tick(0.05);
    assert.equal(sim.result, result);
  }
});

test("AI gathers resources, produces troops, and launches an attack", () => {
  const sim = new Simulation();
  advance(sim, 95);
  assert.ok(sim.own(1).filter((e) => e.type === "worker").length > 4);
  assert.ok(
    sim.own(1).filter((e) => e.kind === "unit" && e.type !== "worker").length >
      3,
  );
  assert.ok(sim.waveAt[1] > 95, "AI should have launched its first wave");
  assert.ok(sim.players.every((p) => p.alloy >= 0 && p.energy >= 0));
});

test("trained army can navigate, fight defenders, and destroy enemy headquarters", () => {
  const sim = new Simulation({ ai: false }),
    barracks = own(sim, "barracks");
  for (let i = 0; i < 4; i++)
    assert.equal(sim.enqueue(barracks.id, "ranger"), true);
  advance(sim, 60);
  sim.issue(
    sim
      .own(0)
      .filter((e) => e.kind === "unit" && e.type !== "worker")
      .map((e) => e.id),
    { type: "attackmove", x: 25, z: -24 },
  );
  advance(sim, 180);
  assert.equal(sim.result, "victory");
  assert.ok(sim.players[0].kills > 3);
});

test("active AI defeats an undefended player through ordinary combat", () => {
  const sim = new Simulation();
  advance(sim, 240);
  assert.equal(sim.result, "defeat");
  assert.ok(sim.players[1].kills > 3);
});

test("blocked move destination resolves nearby rather than looping forever", () => {
  const sim = new Simulation({ ai: false }),
    unit = own(sim, "ranger");
  sim.issue([unit.id], { type: "move", x: -9, z: -5 });
  advance(sim, 25);
  assert.equal(unit.orders.length, 0);
  assert.ok(Math.hypot(unit.x + 9, unit.z + 5) > 3);
});
