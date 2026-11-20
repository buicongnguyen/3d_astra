// Faction workshops and the Expanded roster (AAA round 2, W1-A). Fixture definitions stand in for the
// unit packages' real workshop units (added to the live definitions in this process only).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { FACTION_RULES, skirmishSides, workshopUnitsOf } from "../src/factions.js";
import { modelsForMatch } from "../src/model-roster.js";
import { wantedCount } from "../src/sim/content/workshops.js";
import { activeRules, withRule, loadRules, saveRules, ruleValue } from "../src/app/rules-store.js";
import { MISSIONS } from "../src/story/missions.js";
import { run } from "./lib/sim.js";

const EXP = { roster: "expanded" };
D.fxwarden1 = { ...D.drone, name: "Fixture one", workshop: "wardens", roster: "expanded", required_level: 1, cost: [110, 40], ai: { role: "line", want: [{ if: { seenInfantry: 0.6 }, n: 2 }, { n: 1 }], max: 2 } };
D.fxwarden3 = { ...D.drone, name: "Fixture three", workshop: "wardens", roster: "expanded", required_level: 3, cost: [140, 50], ai: { role: "back", want: [{ n: 1 }], max: 1 } };
D.fxmeridian = { ...D.ranger, name: "Fixture meridian", workshop: "meridian", roster: "expanded", required_level: 1, ai: { role: "line", want: [{ n: 1 }], max: 1 } };
const wardens = (rules, extra = {}) => new Simulation({ factions: skirmishSides("wardens", "mirror", 1, "dunes"), map: "dunes", rules, aiPlayer: true, capturePoints: true, ...extra });

test("Classic rosters and build menus of all five factions are untouched", () => {
  for (const f of Object.keys(FACTION_RULES)) {
    const classic = new Simulation({ ai: false, factions: { 0: f, 1: f } });
    const empty = new Simulation({ ai: false, factions: { 0: f, 1: f }, rules: {} });
    assert.deepEqual(classic.unitRoster(0), empty.unitRoster(0));
    assert.ok(!classic.unitRoster(0).some((t) => D[t].workshop), f);
    assert.ok(!classic.buildable(0).includes("workshop"), f);
    assert.equal(classic.rules, undefined);
  }
});

test("campaign missions keep their rosters and build menus", () => {
  for (const m of MISSIONS) {
    const s = new Simulation({ ai: false, map: m.map, enemyCount: m.enemies, mission: m });
    assert.ok(!s.buildable(0).includes("workshop") && !s.unitRoster(0).some((t) => D[t].workshop), m.id);
  }
});

test("Expanded: Meridian can build the Field workshop; units follow the faction", () => {
  const s = new Simulation({ ai: false, rules: EXP });
  assert.deepEqual(s.buildable(0).slice(-1), ["workshop"]);
  assert.deepEqual(workshopUnitsOf("meridian"), ["fxmeridian"]);
  assert.ok(s.unitRoster(0).includes("fxmeridian") && s.canTrain(0, "fxmeridian"));
  const w = new Simulation({ ai: false, factions: { 0: "wardens", 1: "wardens" }, rules: EXP });
  assert.ok(w.buildable(0).includes("pylon") && !w.buildable(0).includes("workshop"));
  assert.ok(!w.unitRoster(0).includes("fxmeridian"));
});

test("a host trains workshop units only from their required level", () => {
  const s = new Simulation({ ai: false, factions: { 0: "wardens", 1: "wardens" }, rules: EXP });
  const p = s.spawn("pylon", 0, 0, 0);
  assert.deepEqual(p.trains, ["fxwarden1", "fxwarden3"]);
  s.players[0].alloy = 5000; s.players[0].energy = 5000;
  assert.ok(s.enqueue(p.id, "fxwarden1"));
  assert.equal(s.enqueue(p.id, "fxwarden3"), false);
  p.level = 3;
  assert.ok(s.enqueue(p.id, "fxwarden3"));
});

test("without the rule a host has no trains and refuses the unit", () => {
  const s = new Simulation({ ai: false, factions: { 0: "wardens", 1: "wardens" } });
  const p = s.spawn("pylon", 0, 0, 0);
  assert.equal("trains" in p, false);
  assert.equal(s.enqueue(p.id, "fxwarden1"), false);
});

test("max_tiles caps a host at two units", () => {
  D.fxwarden4 = { ...D.fxwarden1, name: "Fixture four" };
  try { assert.equal(workshopUnitsOf("wardens").length, 2); } finally { delete D.fxwarden4; }
});

test("Classic play is identical with no rules and with empty rules (300 s AI match)", () => {
  const a = wardens(null), b = wardens({});
  run(a, 300); run(b, 300);
  assert.equal(a.hash(), b.hash());
  assert.ok(!a.entities.some((e) => "trains" in e && D[e.type].trains === undefined));
});

test("rules persist in saves", () => {
  const s = wardens(EXP);
  run(s, 60);
  const back = Simulation.load(s.serialize());
  assert.deepEqual(back.rules, EXP);
  assert.equal(back.hash(), s.hash());
});

test("AI: fixture units are trained in a 900 s Expanded match", () => {
  const s = wardens(EXP);
  run(s, 900);
  const made = s.entities.filter((e) => e.type === "fxwarden1" || e.type === "fxwarden3").length;
  assert.ok(made > 0 || s.result);
});

test("AI host levelling: the host is raised, never above the core", () => {
  const s = wardens(EXP);
  let raised = false;
  const core = [1, 1, 1];
  while (s.time < 1200 && !s.result) {
    s.tick(0.05); s.events.length = 0;
    for (const t of [0, 1]) core[t] = Math.max(core[t], s.techLevel(t));
    for (const e of s.entities) if (e.type === "pylon" && e.hp > 0) {
      assert.ok(e.level <= core[e.team], "host never above the highest core level its team reached");
      if (e.level >= 2) raised = true;
    }
  }
  assert.ok(raised, "the pylon was raised");
});

test("Classic AI never levels a faction host", () => {
  const s = wardens(null);
  run(s, 900);
  assert.ok(s.entities.filter((e) => e.type === "pylon").every((e) => e.level === 1));
});

test("the AI builds the Field workshop once a Foundry stands (Meridian, Expanded)", () => {
  const s = new Simulation({ map: "classic", rules: EXP, aiPlayer: true, aiSpeed: "fast" });
  run(s, 600);
  assert.ok(s.entities.some((e) => e.type === "workshop") || s.result);
});

test("ai.want: first entry that holds wins, capped by max; unknown keys never hold", () => {
  const sim = { time: 100 };
  const mix = { total: 10, infantry: 8, support: 2, antiarmor: 0, towers: 1 };
  assert.equal(wantedCount({ want: [{ if: { seenInfantry: 0.6 }, n: 2 }, { n: 1 }], max: 2 }, sim, mix), 2);
  assert.equal(wantedCount({ want: [{ if: { seenInfantry: 0.9 }, n: 2 }, { n: 1 }] }, sim, mix), 1);
  assert.equal(wantedCount({ want: [{ if: { seenSupport: 2, after: 200 }, n: 3 }] }, sim, mix), 0);
  assert.equal(wantedCount({ want: [{ if: { seenTowers: 1, after: 50 }, n: 3 }], max: 2 }, sim, mix), 2);
  assert.equal(wantedCount({ want: [{ if: { nonsense: 1 }, n: 3 }] }, sim, mix), 0);
});

test("model roster declares hosts and workshop units only under Expanded", () => {
  const plain = modelsForMatch({ factions: { 0: "meridian", 1: "wardens" } });
  assert.ok(!plain.includes("workshop") && !plain.includes("fxwarden1"));
  const ex = modelsForMatch({ rules: EXP, factions: { 0: "meridian", 1: "wardens" } });
  assert.ok(ex.includes("workshop") && ex.includes("pylon") && ex.includes("fxwarden1") && ex.includes("fxmeridian"));
});

test("rules store keeps only non-default known choices and survives bad storage", () => {
  assert.equal(activeRules({ roster: "classic" }), null);
  assert.deepEqual(activeRules({ roster: "expanded", junk: 1 }), EXP);
  assert.equal(withRule(EXP, "roster", "classic"), null);
  assert.equal(ruleValue(null, "roster"), "classic");
  let held;
  const store = { getItem: () => held ?? null, setItem: (_, v) => { held = v; }, removeItem: () => { held = undefined; } };
  assert.ok(saveRules(EXP, store));
  assert.deepEqual(loadRules(store), EXP);
  held = "{bad";
  assert.equal(loadRules(store), null);
  assert.equal(saveRules(EXP, { setItem() { throw new Error("full"); } }), false);
});
