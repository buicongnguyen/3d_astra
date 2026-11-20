// The Outrider drill (AAA round 2, W2-A; U8 slice 1): Sunward Riders step back from close-assault units
// under the Expanded roster. Inert under Classic, for other factions and on Hold; bounded by nav checks,
// a 1.5 s cadence and saves. Duel gates: docs/BALANCE.md "Rampart and the Outrider drill".
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DRILL } from "../src/sim/content/outrider.js";
import { duel } from "./lib/duel.mjs";

const EXP = { roster: "expanded" };
const field = (options = {}) => {
  const s = new Simulation({ ai: false, map: "classic", factions: { 0: "sunward", 1: "ashfall" }, ...options });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  return s;
};
const tick = (s, n) => { for (let i = 0; i < n; i++) { s.tick(0.05); s.events.length = 0; } };
// A Rider at (0,30) and a harmless foe `gap` m south of it that holds its ground.
function pair(foe, gap, options, rider = {}) {
  const s = field(options);
  const r = s.spawn("rider", 0, 0, 30);
  Object.assign(r, rider);
  const f = s.spawn(foe, 1, 0, 30 - gap);
  r.hp = r.maxHp = 1e7; f.stance = "hold"; f.hp = f.maxHp = 1e7;
  return { s, r, f };
}

test("data: the drill numbers and the Rider's one ability", () => {
  assert.deepEqual(DRILL, { faction: "sunward", types: ["rider"], near: 4, back: 3, every: 1.5, threat_range: 5 });
});

test("steps 3 m straight away from a Scrapper at 4 m, then fights on", () => {
  const { s, r, f } = pair("scrapper", 3, { rules: EXP });
  const z0 = r.z;
  tick(s, 40);
  assert.ok(r.z - z0 > 2.5, `stepped back ${r.z - z0} m`);
  assert.ok(r.drill && !r.drill.to, "the step ended");
  assert.ok(Math.abs(r.x) < 0.01, "straight away");
  tick(s, 20);
  assert.ok(f.hp < f.maxHp, "and it keeps shooting");
});

test("does not step from a Ranger or a Breaker (range above 5 m)", () => {
  for (const foe of ["ranger", "breaker", "tank"]) {
    const { s, r } = pair(foe, 3, { rules: EXP, factions: { 0: "sunward", 1: "meridian" } });
    tick(s, 20);
    assert.equal(r.drill, undefined, foe);
  }
});

test("steps from Vanguard, Shade and Scorcher as well", () => {
  for (const foe of ["vanguard", "shade", "scorcher"]) {
    const { s, r } = pair(foe, 3, { rules: EXP, factions: { 0: "sunward", 1: "veil" } });
    tick(s, 8);
    assert.ok(r.drill, foe);
  }
});

test("not on Hold", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP }, { stance: "hold" });
  tick(s, 20);
  assert.equal(r.drill, undefined);
  assert.equal(r.z, 30);
});

test("at most one step per 1.5 s", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP });
  const starts = [];
  let last = null;
  for (let i = 0; i < 200; i++) {
    s.tick(0.05); s.events.length = 0;
    if (r.drill && r.drill.at !== last) { last = r.drill.at; starts.push(last); }
    // Keep the foe pressing so the Rider has a reason to step again and again.
    for (const u of s.entities) if (u.team === 1 && u.kind === "unit" && u.hp > 0) { u.x = r.x; u.z = r.z - 3; u.cooldown = 9; }
  }
  assert.ok(starts.length >= 3, `${starts.length} steps`);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 1.5 - 1e-9, `${starts[i] - starts[i - 1]}`);
});

test("a step lasts at most 0.6 s", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP });
  let moving = 0, longest = 0;
  for (let i = 0; i < 60; i++) { s.tick(0.05); s.events.length = 0; moving = r.drill?.to ? moving + 0.05 : 0; longest = Math.max(longest, moving); }
  assert.ok(longest <= 0.6 + 1e-9, `${longest}`);
});

test("never into water or a cliff: with the way back blocked it fights as today", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP });
  // Nothing may be stood on behind the Rider: every probe of the ground says no.
  s.nav.canStand = () => false;
  tick(s, 30);
  assert.ok(!r.drill?.to && Math.abs(r.z - 30) < 0.5, "did not move");
  assert.ok(s.get(s.entities.find((u) => u.team === 1 && u.kind === "unit").id).hp < 1e7, "still firing");
});

test("a blocked straight-back spot tries 35 degrees to a side", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP });
  const stand = s.nav.canStand.bind(s.nav);
  s.nav.canStand = (x, z, rad) => (Math.abs(x) < 0.5 && z > 31 ? false : stand(x, z, rad));
  tick(s, 14);
  assert.ok(Math.abs(r.x) > 1, `sidestepped to x ${r.x}`);
});

test("inert under Classic, for a Meridian Rider and in a mission", () => {
  for (const options of [{}, { rules: { roster: "classic" } }, { rules: EXP, factions: { 0: "meridian", 1: "ashfall" } }]) {
    const { s, r } = pair("scrapper", 3, options);
    tick(s, 30);
    assert.equal(r.drill, undefined, JSON.stringify(options));
    assert.equal(r.z, 30);
  }
});

test("a save in the middle of a step reloads to an identical hash", () => {
  const { s, r } = pair("scrapper", 3, { rules: EXP });
  let n = 0;
  while (!r.drill?.to && n++ < 100) tick(s, 1);
  assert.ok(r.drill?.to, "mid-step");
  const back = Simulation.load(s.serialize());
  assert.equal(back.hash(), s.hash());
  tick(s, 100); tick(back, 100);
  assert.equal(back.hash(), s.hash());
});

test("drill duels: Riders gain against close assault, not against Rangers", () => {
  const gain = (foe, f) => duel("rider", foe, { factions: ["sunward", f], budget: 1500, rules: EXP }).mean - duel("rider", foe, { factions: ["sunward", f], budget: 1500 }).mean;
  assert.ok(gain("vanguard", "meridian") >= 0.25);
  assert.ok(gain("scrapper", "ashfall") >= 0.25);
  assert.ok(gain("shade", "veil") >= 0.25);
  assert.ok(Math.abs(gain("ranger", "meridian")) <= 0.05);
});
