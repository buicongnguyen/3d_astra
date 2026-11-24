// Map variety (2026-11-24): Cut the Draw (m11) moved to Twin Rivers, Gun Hill (m06c) at night, and two new optional
// Act 1 side missions: Mirror Lake (m02c, the lake map) and Canyon Run (m04b, a no-base run up the Defence map
// Amber Canyon). Bot results: tools/mission-check.mjs MISSION_TARGETS.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { isUnlocked, recordClear, nextMission } from "../src/campaign.js";
import { missionLook } from "../src/mission-looks.js";

const byId = (id) => MISSIONS.find((m) => m.id === id);
const make = (m, difficulty = "standard") => new Simulation({ map: m.map, enemyCount: m.enemies, ai: false, mission: m, difficulty });
const run = (s, seconds) => { for (let i = 0; i < seconds / 0.05; i++) s.tick(0.05); };
const clearUpTo = (index) => { let p = { cleared: {} }; for (let k = 0; k < index; k++) p = recordClear(p, k, 300); return p; };

test("Cut the Draw is fought on Twin Rivers: two conduits between the rivers, the north one across the far river by Ashfall", () => {
  const m = byId("m11-cut-the-draw"), s = make(m), t = s.terrain;
  assert.equal(m.map, "twinrivers");
  assert.notEqual(m.map, byId("m12-frontiers-end").map, "no longer the finale's battlefield");
  const [mid, west, north] = ["conduitMid", "conduitWest", "conduitNorth"].map((r) => s.tagged(r)[0]);
  const rivers = t.rivers.map((r) => r.z).sort((a, b) => a - b);
  for (const c of [mid, west]) assert.ok(c.z > rivers[0] + 3 && c.z < rivers[1] - 3, `${c.tag} between the rivers`);
  assert.ok(north.z < rivers[0] - 3, "north conduit beyond the far river");
  const ashfall = s.entities.find((e) => e.type === "hq" && e.team === 1);
  assert.ok(Math.hypot(north.x - ashfall.x, north.z - ashfall.z) < 45, "north conduit by the Ashfall camp");
  // Everything the mission places stands on dry, open ground, and the player's army can reach every conduit.
  for (const e of s.entities) assert.ok(t.canStand(e.x, e.z, 0.3), `${e.type} at ${e.x}, ${e.z}`);
  const unit = s.own(0).find((e) => e.kind === "unit" && e.type !== "worker");
  for (const c of [mid, west, north]) assert.ok(s.nav.path(unit, { x: c.x, z: c.z + 5 }, 0.55).length, `${c.tag} reachable`);
});

test("Gun Hill plays at night; the basin missions around it stay as they were", () => {
  assert.equal(missionLook({ missionDef: byId("m06c-gun-hill"), time: 10 }).name, "night");
  assert.equal(missionLook({ missionDef: byId("m06b-wings-over-copper"), time: 10 }), null);
  assert.equal(missionLook({ missionDef: byId("m07-copper-siege"), time: 10 }), null);
});

test("the two side missions sit in Act 1, open after their mission and never lock the next one", () => {
  for (const [id, before, after] of [["m02c-mirror-lake", "m02b-hold-the-river", "m03-the-ashen-line"], ["m04b-canyon-run", "m04-three-way-dunes", "m05-the-verdant-pact"]]) {
    const m = byId(id), i = MISSIONS.indexOf(m);
    assert.ok(m.optional && m.act === 1, id);
    assert.equal(MISSIONS[i - 1].id, before);
    assert.equal(MISSIONS[i + 1].id, after);
    const p = clearUpTo(i);
    assert.equal(isUnlocked(p, i), true, `${id} opens after ${before}`);
    assert.equal(isUnlocked(p, i + 1), true, `${after} opens without ${id}`);
    assert.notEqual(MISSIONS[nextMission(p)].id, id, "the campaign's next mission is never a side mission");
  }
});

test("Mirror Lake: the island gun, then a tower of ours on the island, then a one-minute hold of the relay", () => {
  const m = byId("m02c-mirror-lake"), s = make(m), t = s.terrain, island = s.missionPlace("island");
  assert.equal(m.map, "mirrorlake");
  assert.equal(t.level(island.x, island.z), 1, "the relay is on the island hill");
  assert.ok(t.lakes.length === 1 && island.r < t.lakes[0].inner, "the relay circle stays on the island");
  const gun = s.tagged("islandGun");
  assert.equal(gun.length, 1);
  assert.equal(t.level(gun[0].x, gun[0].z), 1);
  assert.equal(s.mission.objectives.island.hidden, true, "the hold waits for our tower");
  // A tower in camp does not count; one on the island does, and it opens the hold.
  const hq = s.own(0).find((e) => e.type === "hq");
  Object.assign(s.spawn("tower", 0, hq.x + 5, hq.z - 5), { complete: true });
  run(s, 2);
  assert.equal(s.mission.objectives.tower.state, "active");
  gun[0].hp = 0;
  Object.assign(s.spawn("tower", 0, island.x - 3, island.z + 2), { complete: true });
  run(s, 2);
  assert.equal(s.mission.objectives.gun.state, "done");
  assert.equal(s.mission.objectives.tower.state, "done");
  assert.equal(s.mission.objectives.island.hidden, false, "the hold is revealed");
});

test("Canyon Run: no base, crawlers arrive in two pairs, each pair an escort; the outpost opens after both", () => {
  const m = byId("m04b-canyon-run"), s = make(m), t = s.terrain;
  assert.equal(m.map, "canyon");
  assert.equal(t.defence, true, "the Defence map Amber Canyon, played as a field mission");
  assert.equal(s.defence ?? null, null, "not under the Defence rules");
  assert.equal(s.own(0).filter((e) => e.kind === "building").length, 0, "no base");
  const outpost = s.tagged("outpost")[0];
  assert.ok(outpost && outpost.type === "hq" && outpost.team === 1, "Hale's outpost core");
  for (const e of s.entities) assert.ok(t.canStand(e.x, e.z, 0.3) && !t.cliff(e.x, e.z), `${e.type} at ${e.x}, ${e.z}`);
  assert.equal(s.tagged("convoy").length, 0, "no crawler before 1:00");
  run(s, 61);
  assert.equal(s.tagged("convoy").length, 2);
  assert.equal(s.mission.objectives.escort.hidden, false);
  assert.equal(s.mission.objectives.escort2.hidden, true);
  run(s, 140);
  assert.equal(s.tagged("convoy2").length, 2);
  assert.equal(s.mission.objectives.outpost.hidden, true, "the outpost waits for the second pair");
  // Both pairs reach the north mouth: the outpost objective opens.
  const exit = s.missionPlace("exit");
  for (const e of [...s.tagged("convoy"), ...s.tagged("convoy2")]) { e.x = exit.x + (e.id % 3) - 1; e.z = exit.z; e.orders = []; }
  run(s, 2);
  assert.equal(s.mission.objectives.escort.state, "done");
  assert.equal(s.mission.objectives.escort2.state, "done");
  assert.equal(s.mission.objectives.outpost.hidden, false);
  assert.ok(s.own(0).filter((e) => e.tag === "squad").length >= 4, "a reinforcement for the outpost");
});

test("Canyon Run: losing a pair of crawlers loses the mission", () => {
  const m = byId("m04b-canyon-run"), s = make(m);
  run(s, 61);
  for (const e of s.tagged("convoy")) e.hp = 0;
  run(s, 1);
  assert.equal(s.result, "defeat");
});
