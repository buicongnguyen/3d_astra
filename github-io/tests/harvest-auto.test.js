// Owner 2026-11-28: Harvesters go to work on their own. A player's new Harvester with no rally heads for the nearest
// explored deposit; a builder with no deposit to go back to does the same once its site is done; the opening order
// leaves no Harvester idle when its kind of deposit is not explored yet. The AI keeps its own assignment (unchanged).
// Training still starts no economy (match-flow.js startEconomy), so its lessons keep teaching the player to send them.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { Tutorial } from "../src/tutorial.js";

const tick = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) s.tick(0.05); };
function trained(s, team) {
  const hq = s.own(team).find((e) => e.type === "hq");
  const before = new Set(s.own(team).map((e) => e.id));
  hq.queue.push({ type: "worker", elapsed: D.worker.time });
  s.tick(0.05);
  return s.own(team).find((e) => e.type === "worker" && !before.has(e.id));
}

test("a player's new Harvester with no rally goes to the nearest explored deposit", () => {
  const s = new Simulation({ ai: false });
  const w = trained(s, 0);
  assert.ok(w, "trained");
  assert.equal(w.orders[0]?.type, "gather", JSON.stringify(w.orders));
  const r = s.get(w.orders[0].target);
  assert.ok(r?.kind === "resource" && r.amount > 0 && s.isExplored(r, 0));
});

test("a rally still decides: ground rally walks there, deposit rally mines there", () => {
  const s = new Simulation({ ai: false });
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.rally = { x: hq.x + 6, z: hq.z + 6 };
  assert.equal(trained(s, 0).orders[0]?.type, "move");
  const r = s.resources.find((x) => x.type === "alloy");
  hq.rally = { x: r.x, z: r.z, target: r.id };
  const w = trained(s, 0);
  assert.deepEqual([w.orders[0]?.type, w.orders[0]?.target], ["gather", r.id]);
});

test("the AI's new Harvesters are left to the AI's own assignment (no change for computer sides)", () => {
  const s = new Simulation({ ai: false });
  const w = trained(s, 1);
  assert.ok(w, "trained for team 1");
  assert.equal(w.orders.length, 0);
});

test("a builder with no deposit to go back to goes to work when its site is done", () => {
  const s = new Simulation({ ai: false });
  const w = s.own(0).find((e) => e.type === "worker");
  w.orders = []; delete w.resource;
  s.players[0].alloy = 5000; s.players[0].energy = 5000;
  const hq = s.own(0).find((e) => e.type === "hq");
  let b = null;
  for (const [dx, dz] of [[10, 0], [-10, 0], [0, 10], [0, -10], [12, 8], [-12, -8]]) { b = s.build(w.id, "barracks", hq.x + dx, hq.z + dz); if (b) break; }
  assert.ok(b, "a site");
  s.issue([w.id], { type: "build", target: b.id, resume: true });
  for (let i = 0; i < 4000 && !b.complete; i++) s.tick(0.05);
  assert.ok(b.complete, "built");
  tick(s, 0.2);
  assert.equal(w.orders[0]?.type, "gather", `after building: ${JSON.stringify(w.orders)}`);
});

test("the opening order leaves no player Harvester idle, even with no explored deposit of its kind", () => {
  const s = new Simulation({ ai: false });
  // Hide every energy deposit from the player: the one-in-four energy Harvesters must take alloy.
  for (const r of s.resources) if (r.type === "energy") r.amount = 0;
  s.command({ team: 0, type: "harvest" });
  const idle = s.own(0).filter((e) => e.type === "worker" && !e.orders.length);
  assert.equal(idle.length, 0);
});

test("training never starts the economy: the tutorial's Harvesters wait for the player, and one trained during a lesson completes none", () => {
  const s = new Simulation({ map: "classic" }), t = new Tutorial(s), first = s.own(0).filter((e) => e.type === "worker");
  t.update(s, [first[0].id]);
  assert.equal(t.index, 1, "lesson 2, Move to the marker");
  const hq = s.own(0).find((e) => e.type === "hq");
  assert.ok(s.enqueue(hq.id, "worker"));
  for (let i = 0; i < 60 * 20; i++) { t.update(s, []); s.tick(0.05); t.update(s, []); }
  const fresh = s.own(0).find((e) => e.type === "worker" && !first.includes(e));
  assert.ok(fresh, "trained");
  // It goes to work (the one in four on energy), so the alloy lesson still waits for the player's own order.
  assert.deepEqual([fresh.orders[0]?.type, s.get(fresh.resource)?.type], ["gather", "energy"]);
  assert.ok(first.every((w) => !w.orders.length), "the starting Harvesters stand where they are");
  assert.equal(t.index, 1, "no lesson completed on its own");
  assert.equal(t.gathered, false, "Gather 10 alloy still needs the player");
});
