import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

// Representative core footprints for each improved expansion. The other camps use their
// mirror of the same site. Each test starts with an ordinary Harvester and standard funds.
const expansions = [
  { map: "heartland", x: -27, z: 57, stock: 4200 },
  { map: "ironback", x: -27, z: 19, stock: 4000 },
  { map: "ironback", x: -33, z: 67, stock: 3800 },
  { map: "crownmesa", x: -33, z: 25, stock: 3400 },
  { map: "steppe", x: -23, z: -7, stock: 4000 },
];

function advanceUntil(sim, seconds, condition) {
  for (let i = 0; i < seconds * 20; i++) {
    sim.events.length = 0;
    sim.tick(0.05);
    if (condition()) return true;
  }
  return false;
}

for (const site of expansions) {
  test(`${site.map} expansion ${site.x},${site.z}: each camp can build and bank both veins`, () => {
    for (let team = 0; team < 4; team++) {
      const sim = new Simulation({ map: site.map, enemyCount: 3, ai: false, capturePoints: true });
      const camp = sim.own(team).find(e => e.type === "hq");
      const worker = sim.own(team).find(e => e.type === "worker");
      const x = site.x * -Math.sign(camp.x), z = site.z * Math.sign(camp.z);
      const order = action => sim.command({ type: "order", team, ids: [worker.id], order: action });

      order({ type: "move", x, z });
      assert.ok(advanceUntil(sim, 60, () => sim.isVisible({ x, z }, team)), "scout the footprint");
      const core = sim.command({ type: "build", team, worker: worker.id, building: "hq", x, z });
      assert.ok(core && advanceUntil(sim, 120, () => core.complete), "complete the expansion core");
      const field = sim.resources.filter(r => r.type === "alloy" && Math.hypot(r.x - x, r.z - z) <= 10);
      assert.equal(field.length, 2);
      assert.equal(field.reduce((sum, r) => sum + r.amount, 0), site.stock);
      for (const patch of field) {
        const stock = patch.amount, bank = sim.players[team].alloy;
        order({ type: "gather", target: patch.id });
        assert.ok(advanceUntil(sim, 45, () => sim.events.some(e =>
          e.type === "deliver" && e.resource === "alloy" && e.tx === x && e.tz === z)));
        assert.ok(patch.amount < stock && sim.players[team].alloy > bank, "ore from this patch reached the new core");
      }
    }
  });
}

test("a Harvester keeps its outcrop target after saving and continuing", () => {
  const sim = new Simulation({ map: "steppe", ai: false });
  const worker = sim.own(0).find(e => e.type === "worker");
  const patch = sim.resources.find(r => r.x === -27 && r.z === 0);
  sim.command({ type: "order", team: 0, ids: [worker.id], order: { type: "move", x: patch.x, z: patch.z } });
  assert.ok(advanceUntil(sim, 60, () => sim.isVisible(patch, 0)));
  sim.command({ type: "order", team: 0, ids: [worker.id], order: { type: "gather", target: patch.id } });
  const restored = Simulation.load(sim.serialize());
  assert.equal(restored.get(worker.id).orders[0].target, patch.id);
  for (let i = 0; i < 1200; i++) {
    sim.tick(0.05);
    restored.tick(0.05);
  }
  assert.ok(restored.get(patch.id).amount < patch.initial);
  assert.equal(restored.hash(), sim.hash());
});
