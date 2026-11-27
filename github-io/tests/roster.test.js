// Faction roster (2026-11-24): the four new units, the Full army battle per faction, the Quick battle
// rival rotation and the Wild frontier on more dry maps.
//  - Lance buggy (Sunward workshop) and Bulwark (Wardens workshop): Expanded only, at their hosts, the
//    AI wants them only from its intel (so Relaxed, which keeps none, never trains them);
//  - Veil moth (Veil flyer) and Halo interceptor (Wardens flyer) at the Command core; the computer's
//    Halo answers enemy flyers only;
//  - the Bulwark's ward: other own units within 6 m take x0.85, never stacking, never itself;
//  - equal-cost duels: each new unit beats what it is for and loses to its counter;
//  - Full army: your faction's slots (no Medics or Engineers for the Wardens), its workshop units and
//    its own flyer;
//  - Quick battle: Ashfall first (as before), then Sunward, Wardens and Veil, by the count of battles;
//  - Wild frontier lands: every land's nests stand clear, are reachable from every core, and the rule
//    Off leaves the match exactly as it was.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { FACTION_RULES, workshopUnitsOf } from "../src/factions.js";
import { wantedCount } from "../src/sim/content/workshops.js";
import { wardFactor } from "../src/sim/content/ward.js";
import { ARENA, arenaArmy, arenaFlyer, quickRival, quickRivals } from "../src/sim/content/quick-battle.js";
import { WILD } from "../src/sim/content/wild-frontier.js";
import { RULE_OPTIONS } from "../src/app/rule-options.js";
import { rulesForMap } from "../src/app/rules-store.js";
import { duel } from "./lib/duel.mjs";
import { run } from "./lib/sim.js";

const EXP = { roster: "expanded" };
const step = (s, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) s.tick(0.05); s.events.length = 0; };

test("the four units: workshop units at their hosts, flyers at the Command core", () => {
  assert.deepEqual(workshopUnitsOf("sunward"), ["lancer"]);
  assert.deepEqual(workshopUnitsOf("wardens"), ["bulwark"]);
  assert.deepEqual(FACTION_RULES.veil.extra, { hq: ["moth"] });
  assert.deepEqual(FACTION_RULES.wardens.extra, { hq: ["halo"] });
  for (const type of ["lancer", "bulwark", "moth", "halo"]) {
    const d = D[type];
    assert.ok(d.name && d.role && d.description && d.intro && d.cost && d.pop >= 2, type);
    assert.ok(d.shield > 0, `${type} has a shield`);
  }
  const s = new Simulation({ ai: false, factions: { 0: "sunward", 1: "wardens" }, rules: EXP });
  assert.ok(s.unitRoster(0).includes("lancer") && s.unitRoster(1).includes("bulwark") && s.unitRoster(1).includes("halo"));
  const way = s.spawn("waystation", 0, -20, 20), pylon = s.spawn("pylon", 1, 20, -20);
  assert.deepEqual(way.trains, ["lancer"]);
  assert.deepEqual(pylon.trains, ["bulwark"]);
  s.players[1].alloy = s.players[1].energy = 5000;
  assert.equal(s.enqueue(pylon.id, "bulwark"), false, "the Bulwark needs a level 2 pylon");
  pylon.level = 2;
  assert.ok(s.enqueue(pylon.id, "bulwark"));
  const classic = new Simulation({ ai: false, factions: { 0: "sunward", 1: "wardens" } });
  assert.ok(!classic.unitRoster(0).includes("lancer") && !classic.unitRoster(1).includes("bulwark"), "Classic: no workshop units");
  assert.ok(classic.unitRoster(1).includes("halo"), "Classic: the faction flyer stays");
  const veil = new Simulation({ ai: false, factions: { 0: "veil" } });
  const hq = veil.entities.find((e) => e.team === 0 && e.type === "hq");
  assert.ok(hq.trains.includes("moth") && !hq.trains.includes("hawk"));
});

test("the AI wants the workshop units only from what it has seen (never at Relaxed, which keeps no intel)", () => {
  const s = new Simulation({ ai: false, rules: EXP });
  const none = { total: 0, infantry: 0, support: 0, antiarmor: 0, towers: 0, mech: 0 };
  assert.equal(wantedCount(D.lancer.ai, s, none), 0);
  assert.equal(wantedCount(D.bulwark.ai, s, none), 0);
  assert.equal(wantedCount(D.lancer.ai, s, { ...none, total: 4, mech: 3 }), 2);
  assert.equal(wantedCount(D.lancer.ai, s, { ...none, total: 4, mech: 1 }), 1);
  assert.equal(wantedCount(D.bulwark.ai, s, { ...none, total: 5, infantry: 3 }), 1);
  s.time = 5000;
  assert.equal(wantedCount(D.lancer.ai, s, none), 0, "no timed fallback");
});

test("the computer's Halo answers enemy flyers only; the Veil moth flies like the other faction flyers", () => {
  const s = new Simulation({ factions: { 0: "meridian", 1: "wardens" }, aiSpeed: "normal" });
  const hq = s.entities.find((e) => e.team === 1 && e.type === "hq");
  hq.level = 2;
  hq.trains = s.resolvedTrains(1, D.hq.trains);
  s.spawn("foundry", 1, hq.x + 10, hq.z);
  s.time = 2000;
  const pace = { ...s.paceFor(1), upgradeAt: 0, foundryAt: 0 };
  s.aiKiteAt = { 1: 1e9 };
  assert.equal(s.aiAirChoice(1, hq, [], pace), null, "nothing seen in the air: no Halo");
  const hawk = s.spawn("hawk", 0, 0, 0);
  (s.intel[1] ||= new Map()).set(hawk.id, "hawk");
  assert.equal(s.aiAirChoice(1, hq, [], pace), "halo");
});

test("the ward: other own units within 6 m take 15% less, never stacking, never the Bulwark itself", () => {
  const s = new Simulation({ ai: false, factions: { 0: "wardens", 1: "meridian" }, rules: EXP });
  const b = s.spawn("bulwark", 0, -20, 0), b2 = s.spawn("bulwark", 0, -19, 1), near = s.spawn("drone", 0, -16, 0), far = s.spawn("drone", 0, -5, 0), foe = s.spawn("ranger", 1, -21, 2);
  s.tick(0.05);
  assert.equal(wardFactor(s, near), D.bulwark.ward.taken);
  assert.equal(wardFactor(s, far), 1);
  assert.equal(wardFactor(s, foe), 1, "enemies are not warded");
  assert.equal(wardFactor(s, b), D.bulwark.ward.taken, "covered by the other Bulwark");
  b2.hp = 0;
  s.tick(0.05);
  assert.equal(wardFactor(s, b), 1, "a Bulwark never wards itself");
  // The real damage path: the same hit on a warded and an unwarded drone.
  b2.hp = b2.maxHp;
  s.tick(0.05);
  near.shield = far.shield = 0;
  const h0 = near.hp, h1 = far.hp;
  s.applyDamage(near, 40, 1, foe.id);
  s.applyDamage(far, 40, 1, foe.id);
  assert.ok(Math.abs((h0 - near.hp) / (h1 - far.hp) - D.bulwark.ward.taken) < 0.02);
  // A match without a ward unit: the hook answers 1.
  const plain = new Simulation({ ai: false });
  assert.equal(wardFactor(plain, plain.entities.find((e) => e.kind === "unit")), 1);
});

test("equal-cost duels: each new unit wins what it is for and loses to its counter", () => {
  const R = { rules: EXP };
  const win = (a, b, f) => { const r = duel(a, b, { factions: f, offsets: [0, 8, -8], ...R }); return r.mean; };
  assert.ok(win("lancer", "tank", ["sunward", "meridian"]) > 0, "Lance buggies hunt tanks");
  assert.ok(win("lancer", "antitank", ["sunward", "meridian"]) < 0, "Anti-tank soldiers beat them");
  assert.ok(win("lancer", "vanguard", ["sunward", "meridian"]) < 0, "close assault beats them");
  assert.ok(win([["bulwark", 1], ["drone", 5]], [["drone", 7]], ["wardens", "wardens"]) > 0, "a Bulwark lifts a drone line");
  assert.ok(win("bulwark", "antitank", ["wardens", "meridian"]) < 0, "rockets cut it down");
  assert.ok(win("halo", "hawk", ["wardens", "meridian"]) > 0, "the Halo beats a gunship in the air");
  assert.ok(win("halo", "ranger", ["wardens", "meridian"]) < 0, "but not Rangers on the ground");
  assert.ok(win("moth", "ranger", ["veil", "meridian"]) < 0, "Rangers bring the moth down");
});

test("Full army battle: each faction's own slots, workshop units and flyer; the Wardens get no Medics", () => {
  for (const faction of Object.keys(FACTION_RULES)) {
    const s = new Simulation({ map: "riverlands", aiSpeed: "relaxed", factions: { 0: faction, 1: faction === "ashfall" ? "meridian" : "ashfall" }, rules: { quick: "arena" } });
    const types = arenaArmy(s);
    assert.ok(!types.some((t) => FACTION_RULES[faction].exclude?.includes(s.slotOf(t))), faction);
    for (const t of workshopUnitsOf(faction)) assert.ok(types.includes(t), `${faction}: ${t}`);
    assert.equal(arenaFlyer(s), FACTION_RULES[faction].extra.hq[0]);
    step(s, 3);
    const mine = s.entities.filter((e) => e.team === 0 && e.kind === "unit");
    // Skywing comes free with the sandbox: a hero to try, not the faction's own flyers.
    const flyers = mine.filter((e) => e.flying && !e.assist).map((e) => e.type);
    assert.deepEqual(flyers, Array(ARENA.hawks).fill(arenaFlyer(s)), `${faction} flies its own flyer`);
    if (faction === "wardens") assert.ok(!mine.some((e) => e.type === "medic" || e.type === "engineer"), "Wardens: no Medics or Engineers");
    for (const t of types) assert.ok(mine.some((e) => e.type === t), `${faction}: ${t} on the field`);
  }
});

test("Quick battle rival: Ashfall first as before, then Sunward, Wardens and Veil; never your own faction", () => {
  assert.equal(quickRival("meridian"), "ashfall");
  assert.equal(quickRival("ashfall"), "meridian");
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => quickRival("meridian", n)), ["ashfall", "sunward", "wardens", "veil", "ashfall"]);
  for (const player of Object.keys(FACTION_RULES)) {
    const list = quickRivals(player);
    assert.ok(!list.includes(player), player);
    assert.equal(new Set(list).size, list.length);
    for (const id of ["sunward", "wardens", "veil"]) if (id !== player) assert.ok(list.includes(id), `${player} meets ${id}`);
  }
  assert.equal(quickRival("meridian", -3), "ashfall");
  assert.equal(quickRival("meridian", NaN), "ashfall");
});

test("Wild frontier lands: Dunes plus three more dry maps; the setup row offers every one", () => {
  assert.deepEqual(Object.keys(WILD.lands), ["dunes", "dryreach", "heartland", "basin"]);
  assert.deepEqual(RULE_OPTIONS.find((o) => o.id === "wild").maps, Object.keys(WILD.lands));
  for (const map of Object.keys(WILD.lands)) assert.deepEqual(rulesForMap({ wild: "on" }, map), { wild: "on" }, map);
  assert.equal(rulesForMap({ wild: "on" }, "woodlands"), null);
});

for (const map of ["dryreach", "heartland", "basin"]) {
  test(`Wild frontier on ${map}: nests stand clear of camps and deposits, every core reaches them; Off is untouched`, () => {
    for (const enemyCount of [1, 2]) {
      const s = new Simulation({ map, ai: false, enemyCount, rules: { wild: "on" } });
      const cores = s.entities.filter((e) => e.type === "hq");
      assert.equal(s.wild.nests.length, enemyCount === 1 ? 4 : 3, `${map} x${enemyCount}`);
      for (const n of s.wild.nests) {
        assert.ok(s.nav.canStand(n.x, n.z, 2), "the nest is standable");
        assert.ok(cores.every((c) => Math.hypot(c.x - n.x, c.z - n.z) >= 13));
        if (!n.elder) assert.ok(s.resources.every((r) => Math.hypot(r.x - n.x, r.z - n.z) > WILD.nest.aggro), "Harvesters never wake the guards");
        for (const c of cores) {
          const d = Math.hypot(n.x - c.x, n.z - c.z), out = c.radius + 4;
          const from = { x: c.x + ((n.x - c.x) / d) * out, z: c.z + ((n.z - c.z) / d) * out };
          assert.ok(s.nav.path(from, n, 1.1).length > 0, `core ${c.team} reaches the nest at ${n.x.toFixed(0)},${n.z.toFixed(0)}`);
        }
        assert.equal(n.guards.length, n.elder ? WILD.nest.elder_guards : WILD.nest.guards);
      }
      assert.ok(s.skirmishPoints.spire && s.nav.canStand(0, 0, 1.5), "the Spire ring stands at the centre");
    }
    // Rule off: the same match, hash for hash, as a match that never heard of the rule.
    const make = (rules) => new Simulation({ map, aiSpeed: "fast", aiPlayer: true, capturePoints: true, ...(rules ? { rules } : {}) });
    assert.equal(rulesForMap({ wild: "off" }, map), null, "Off is the default: no rule key");
    const off = make(rulesForMap({ wild: "off" }, map)), none = make(null);
    assert.equal(off.wild, undefined);
    run(off, 60);
    run(none, 60);
    assert.equal(off.hash(), none.hash());
  });
}

test("Wild frontier on Dry Reach plays: AI against AI on Fast tames and storms deterministically, and a save reloads", () => {
  const make = () => new Simulation({ map: "dryreach", aiSpeed: "fast", aiPlayer: true, capturePoints: true, rules: { wild: "on" } });
  const a = make(), b = make();
  run(a, 200);
  run(b, 200);
  assert.equal(a.hash(), b.hash());
  const saved = Simulation.load(a.serialize());
  assert.equal(saved.hash(), a.hash());
});
