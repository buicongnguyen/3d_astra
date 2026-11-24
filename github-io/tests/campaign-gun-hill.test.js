// Campaign C6: Gun Hill (m06c), the optional Act 2 side mission on the campaign map Highridge. The build objective
// counts only towers inside its region (sim/missions.js o.region), the region is the player's plateau, and the
// optional gun nest stands on the mirror hill.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { isUnlocked, recordClear } from "../src/campaign.js";

const M = MISSIONS.find((m) => m.id === "m06c-gun-hill");
const run = (s, n = 40) => { for (let i = 0; i < n; i++) s.tick(0.05); }; // objectives are checked every few ticks
const make = () => new Simulation({ map: M.map, enemyCount: M.enemies, ai: false, mission: M });

test("Gun Hill is an optional Act 2 mission on Highridge, after Wings over Copper", () => {
  assert.ok(M && M.optional && M.act === 2 && M.map === "highridge");
  const i = MISSIONS.indexOf(M);
  assert.equal(MISSIONS[i - 1].id, "m06b-wings-over-copper");
  // Opens once Wings is cleared; never locks Copper Siege.
  let p = { cleared: {} };
  for (let k = 0; k < i; k++) p = recordClear(p, k, 300);
  assert.equal(isUnlocked(p, i), true);
  assert.equal(isUnlocked(p, i + 1), true, "Copper Siege opens without Gun Hill");
});

test("the hill region sits on the player's plateau, the nest on the mirror plateau", () => {
  const s = make(), t = s.terrain, hill = s.missionPlace("hill");
  assert.equal(t.level(hill.x, hill.z), 1, "hill region centre is high ground");
  const top = t.plateaus.find((p) => Math.hypot(p.x - hill.x, p.z - hill.z) < 1);
  assert.ok(top && hill.r < top.r, "the region stays inside the plateau");
  const hq = s.own(0).find((e) => e.type === "hq"), foe = s.entities.find((e) => e.type === "hq" && e.team === 1);
  assert.ok(Math.hypot(hq.x - hill.x, hq.z - hill.z) < Math.hypot(foe.x - hill.x, foe.z - hill.z), "the player's own hill");
  const nest = s.tagged("nest");
  assert.equal(nest.length, 1);
  assert.equal(nest[0].team, 1);
  assert.equal(t.level(nest[0].x, nest[0].z), 1, "the nest is on high ground");
});

test("only towers on the hill count toward the build objective", () => {
  const s = make(), hill = s.missionPlace("hill"), hq = s.own(0).find((e) => e.type === "hq");
  const below = s.spawn("tower", 0, hq.x + 4, hq.z - 4), below2 = s.spawn("tower", 0, hq.x - 4, hq.z + 4);
  below.complete = below2.complete = true;
  run(s);
  assert.equal(s.mission.objectives.guns.state, "active", "towers in the camp do not count");
  for (const dx of [-3, 3]) { const t = s.spawn("tower", 0, hill.x + dx, hill.z); t.complete = true; }
  run(s);
  assert.equal(s.mission.objectives.guns.state, "done");
});
