// Phone-length matches (owner, 2026-11-23; plan G1): the `economy: "rich"` rule.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { gridLine, isCluster, RICH } from "../src/sim/rich-economy.js";

const MAPS = ["classic", "riverlands", "basin", "expanse", "dunes", "woodlands", "highlands", "heartland", "dryreach", "twinrivers", "ironback", "crownmesa", "steppe"];
const rich = (map, enemyCount = 1) => new Simulation({ map, enemyCount, ai: false, rules: { economy: "rich" } });
const count = (s, team, type) => s.own(team).filter((e) => e.type === type).length;

test("without the rule a match starts exactly as before", () => {
  const s = new Simulation({ map: "classic", ai: false });
  assert.equal(count(s, 0, "worker"), 4);
  assert.equal(s.players[0].alloy, 450);
  assert.equal(s.resources.length, 22);
});

test("the player starts with 6 Harvesters and 600 alloy; rivals keep their start", () => {
  for (const map of MAPS) {
    const s = rich(map);
    assert.equal(count(s, 0, "worker"), RICH.workers, map);
    assert.equal(s.players[0].alloy, RICH.alloy, map);
    assert.equal(count(s, 1, "worker"), 4, map);
    assert.equal(s.players[1].alloy, 450, map);
  }
});

test("every map has a full cluster in every grid cell in 1v1, keeps its deposits and mirrors the new ones", () => {
  for (const map of MAPS) {
    const base = new Simulation({ map, ai: false }), s = rich(map), line = gridLine(s.terrain.size);
    assert.ok(line.length >= 3, map);
    for (const x of line) for (const z of line) assert.ok(isCluster(s, x, z), `${map}: ${x},${z}`);
    for (const r of base.resources) assert.ok(s.resources.some((q) => q.x === r.x && q.z === r.z && q.type === r.type), `${map}: kept`);
    assert.equal(new Set(s.resources.map((r) => r.id)).size, s.resources.length, `${map}: unique ids`);
    for (const r of s.resources.filter((q) => q.id < 0)) assert.ok(s.resources.some((q) => q.type === r.type && Math.abs(q.x + r.x) < 1e-9 && Math.abs(q.z + r.z) < 1e-9), `${map}: mirrored`);
  }
});

test("a rich match saves and plays on to the same state", () => {
  const s = rich("riverlands");
  s.command({ team: 0, type: "harvest" });
  for (let i = 0; i < 400; i++) s.tick(0.05);
  const restored = Simulation.load(s.serialize());
  for (let i = 0; i < 400; i++) { s.tick(0.05); restored.tick(0.05); }
  assert.equal(restored.hash(), s.hash());
});
