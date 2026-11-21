// AAA round 3, R3-C "Army depth": veteran intake at a level-3 Barracks (Expanded roster), the Combined
// armour-squad step (Frontier Defence) and the skirmish Army size rule (pop 100 / 150 / 200).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D, MAX_POP } from "../src/data.js";
import { RANK_BONUS, RANK_XP } from "../src/sim/tactics.js";
import { RULE_OPTIONS } from "../src/app/rule-options.js";
import { activeRules, withRule } from "../src/app/rules-store.js";
import { onExitRing, veteranIntake, veteranNote } from "../src/sim/content/barracks-veterans.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { advance } from "./lib/sim.js";
import { readFileSync } from "node:fs";

const own = (sim, type, team = 0) => sim.entities.find((e) => e.team === team && e.type === type && e.hp > 0);
const trained = (sim, type, team = 0) => sim.entities.filter((e) => e.team === team && e.type === type && e.hp > 0);
// A level-2 Barracks ordered to level 3 by its commander (the `upgrade` command), with a level-3 core.
function levelThree(sim, { command = true } = {}) {
  const hq = own(sim, "hq"), b = own(sim, "barracks");
  sim.players[0].alloy = sim.players[0].energy = 20000;
  hq.level = 3;
  b.level = 2;
  if (command) assert.ok(sim.command({ team: 0, type: "upgrade", building: b.id }));
  else assert.ok(sim.upgradeBuilding(b.id, 0));
  advance(sim, 31);
  assert.equal(b.level, 3);
  return b;
}
// Trains `type` at the Barracks and returns the new unit.
function train(sim, b, type) {
  const before = new Set(trained(sim, type).map((e) => e.id));
  assert.ok(sim.command({ team: 0, type: "train", building: b.id, unit: type }));
  advance(sim, D[type].time / (1 + 0.2 * (b.level - 1)) + 1);
  const made = trained(sim, type).filter((e) => !before.has(e.id));
  assert.equal(made.length, 1, `one ${type} trained`);
  return made[0];
}

test("veteran intake: under Expanded, a Barracks ordered to level 3 trains Rangers and Vanguards at rank 1", () => {
  const sim = new Simulation({ ai: false, rules: { roster: "expanded" } }), b = own(sim, "barracks");
  assert.equal(veteranNote(sim, b), "Level 3: recruits arrive as veterans");
  levelThree(sim);
  assert.equal(b.veterans, true);
  assert.equal(veteranIntake(sim, b), true);
  assert.equal(veteranNote(sim, b), "Recruits arrive as veterans");
  for (const type of ["ranger", "vanguard"]) {
    const u = train(sim, b, type);
    assert.ok(onExitRing(b, u.x, u.z), "the recruit stands on the Barracks' exit ring");
    assert.equal(u.rank, 1, type);
    assert.equal(u.xp, RANK_XP[0]);
    assert.equal(u.maxHp, Math.round(D[type].hp * (1 + RANK_BONUS)));
    assert.equal(u.hp, u.maxHp);
    assert.equal(sim.rankFactor(u), 1 + RANK_BONUS);
  }
  // A Medic does not fight and earns no rank.
  assert.equal(train(sim, b, "medic").rank, undefined);
});

test("veteran intake: not under Classic, not below level 3, and not for a Barracks the computer levelled", () => {
  const classic = new Simulation({ ai: false }), cb = levelThree(classic);
  assert.equal(cb.veterans, undefined, "no flag without the Expanded roster");
  assert.equal(train(classic, cb, "ranger").rank, undefined);
  assert.equal(veteranNote(classic, cb), "");

  const low = new Simulation({ ai: false, rules: { roster: "expanded" } }), lb = own(low, "barracks");
  low.players[0].alloy = low.players[0].energy = 5000;
  assert.equal(train(low, lb, "ranger").rank, undefined, "level 1 Barracks");

  const ai = new Simulation({ ai: false, rules: { roster: "expanded" } }), ab = levelThree(ai, { command: false });
  assert.equal(ab.veterans, undefined, "levelled without a command (the computer's way)");
  assert.equal(train(ai, ab, "ranger").rank, undefined);
});

test("veteran intake: of two neighbouring Barracks only the level-3 one trains veterans", () => {
  const sim = new Simulation({ ai: false, rules: { roster: "expanded" } }), b = levelThree(sim);
  const second = sim.spawn("barracks", 0, b.x + 8, b.z);
  assert.equal(second.level, 1);
  const plain = train(sim, second, "ranger");
  assert.equal(onExitRing(b, plain.x, plain.z), false);
  assert.equal(plain.rank, undefined);
  assert.equal(train(sim, b, "ranger").rank, 1);
});

// --------------------------------------------------------------------- Combined armour squads
const ROADS = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads");
const defence = () => new Simulation({ map: ROADS.map, enemyCount: 1, ai: false, mission: ROADS });

test("Combined: 320 after a branch, both branches' effects, leash 9, once, kept by a refit", () => {
  const a = GARRISONS.armour, s = defence();
  assert.equal(a.combined.cost, 320);
  s.players[0].alloy = 5000;
  assert.ok(s.command({ team: 0, type: "armourBuy" }));
  const squad = s.armourSquads()[0].squad, units = () => s.armourUnits(squad);
  const base = units().map((e) => ({ hp: e.maxHp, damage: e.damage, interval: e.interval, leash: e.leash, mech: e.mechanical_bonus || 1 }));
  // Not before a branch.
  assert.equal(s.armourCombinedCost(squad), null);
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, combined: true }), false);
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad }));
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, combined: true }), false, "not after Rank 2 alone");
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad, branch: "assault" }));
  assert.equal(s.armourNextUpgrade(squad), null, "armourNextUpgrade never offers Combined");
  assert.equal(s.armourCombinedCost(squad), 320);
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, combined: "yes" }), false, "combined must be true");
  const alloy = s.players[0].alloy;
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad, combined: true }));
  assert.equal(s.players[0].alloy, alloy - 320);
  const as = a.branches.assault, bw = a.branches.bulwark;
  units().forEach((e, i) => {
    assert.equal(e.combined, true);
    assert.equal(e.squadBranch, "assault");
    assert.ok(Math.abs(e.damage - base[i].damage * a.rank2.damage * as.damage) < 1e-9, "Assault's damage");
    assert.ok(Math.abs(e.interval - base[i].interval * as.interval) < 1e-9, "Assault's reload");
    assert.ok(Math.abs(e.mechanical_bonus - base[i].mech * as.mech) < 1e-9, "Assault's bite on machines");
    assert.ok(Math.abs(e.maxHp - base[i].hp * a.rank2.hp * bw.hp) <= 1, "Bulwark's armour");
    assert.equal(e.mend, bw.repair, "Bulwark's mending");
    assert.equal(e.leash, base[i].leash, "the leash is the default 9");
    assert.equal(e.leash, 9);
  });
  assert.equal(s.armourCombinedCost(squad), null);
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, combined: true }), false, "once");
  // A refit tank comes Combined.
  const [keep, lost] = units(), want = keep.maxHp;
  lost.hp = 0;
  for (const e of s.entities) if (e.team === 1) e.hp = 0;
  s.startWave();
  s.defence.queue.length = 0;
  advance(s, 1, { steps: "round", events: "leave" });
  for (const e of units()) { assert.equal(e.combined, true); assert.equal(e.maxHp, want); assert.equal(e.leash, 9); assert.ok(Math.abs(e.interval - keep.interval) < 1e-9); }
});

test("Combined from Bulwark adds Assault's guns; the leash stays 9", () => {
  const a = GARRISONS.armour, s = defence();
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "armourBuy" });
  const [t] = s.armourUnits(1), b0 = { damage: t.damage, interval: t.interval, hp: t.maxHp };
  s.command({ team: 0, type: "armourUpgrade", squad: 1 });
  s.command({ team: 0, type: "armourUpgrade", squad: 1, branch: "bulwark" });
  const hp = t.maxHp;
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad: 1, combined: true }));
  assert.equal(t.maxHp, hp, "Bulwark's health kept");
  assert.ok(Math.abs(t.damage - b0.damage * a.rank2.damage * a.branches.assault.damage) < 1e-9);
  assert.ok(Math.abs(t.interval - b0.interval * a.branches.assault.interval) < 1e-9);
  assert.equal(t.leash, 9);
  assert.equal(t.mend, a.branches.bulwark.repair);
});

test("the Defence bot never buys Combined (armourNextUpgrade is unchanged)", () => {
  const r = playDefence(ROADS, { maxWaves: 3 });
  const tanks = r.sim.entities.filter((e) => e.squad);
  assert.ok(tanks.length > 0, "the bot fielded squads");
  assert.equal(tanks.some((e) => e.combined), false);
  // The bot reads only armourNextUpgrade (tools/defence-bot.mjs), which never names Combined.
  const bot = readFileSync(new URL("../tools/defence-bot.mjs", import.meta.url), "utf8");
  assert.equal(/combined/i.test(bot), false);
});

// --------------------------------------------------------------------- Army size
test("Army size rule: 100 is the default and stores no key; 150 and 200 do; 200 is desktop-only", () => {
  const o = RULE_OPTIONS.find((r) => r.id === "pop");
  assert.equal(o.default, "100");
  assert.deepEqual(o.values.map((v) => v.id), ["100", "150", "200"]);
  assert.deepEqual(o.values.filter((v) => v.desktop).map((v) => v.id), ["200"]);
  assert.equal(activeRules({ pop: "100" }), null);
  assert.deepEqual(withRule(null, "pop", "150"), { pop: "150" });
  assert.equal(new Simulation({ ai: false }).maxPop(), MAX_POP);
  assert.equal(new Simulation({ ai: false, rules: { pop: "150" } }).maxPop(), 150);
  assert.equal(new Simulation({ ai: false, rules: { pop: "200" } }).maxPop(), 200);
  assert.equal(new Simulation({ ai: false, rules: { pop: "999" } }).maxPop(), MAX_POP, "an unknown size plays 100");
  // The default match is the match before the rule existed.
  assert.equal("rules" in new Simulation({ ai: false, rules: activeRules({ pop: "100" }) }), false);
});

test("Army size 150: the player and the AI both stop at 150 supply", () => {
  const sim = new Simulation({ map: "classic", enemyCount: 1, rules: { pop: "150" } });
  // Plenty of relays for both sides (raw supply above 200) and money to spend.
  for (const team of [0, 1]) {
    const hq = own(sim, "hq", team), side = team ? 1 : -1;
    for (let i = 0; i < 12; i++) { const r = sim.spawn("relay", team, hq.x + (i % 4) * 5 * -side, hq.z - side * (8 + Math.floor(i / 4) * 5)); r.level = 3; r.supply = D.relay.supply + 10; }
    sim.players[team].alloy = sim.players[team].energy = 100000;
  }
  assert.equal(sim.population(0).cap, 150);
  assert.equal(sim.population(1).cap, 150);
  // Fill both armies to just under the cap, then let them train.
  for (const team of [0, 1]) {
    const hq = own(sim, "hq", team);
    // Tanks (4 supply each) keep the entity count, and the test, small.
    while (sim.population(team).used < 146) sim.spawn(sim.population(team).used <= 142 ? "tank" : "ranger", team, hq.x + (sim.population(team).used % 16) - 8, hq.z + (team ? -6 : 6));
  }
  const b = own(sim, "barracks");
  for (let i = 0; i < 5; i++) sim.command({ team: 0, type: "train", building: b.id, unit: "ranger" });
  let most = [0, 0];
  for (let t = 0; t < 60 && !sim.result && !(most[0] >= 150 && most[1] >= 150); t += 2) {
    advance(sim, 2);
    most = [0, 1].map((team) => Math.max(most[team], sim.population(team).used));
  }
  assert.equal(most[0], 150, "the player fills to 150 and no further");
  assert.ok(most[1] > 146 && most[1] <= 150, `the AI trains up to 150 (${most[1]})`);
  if (sim.population(0).used + sim.population(0).reserved >= 150) assert.equal(sim.enqueue(b.id, "ranger"), false, "no training past 150");
});

test("the AI builds relays past 100 supply only under a larger Army size", () => {
  const relaysWanted = (rules) => {
    const sim = new Simulation({ map: "classic", enemyCount: 1, rules });
    const hq = own(sim, "hq", 1);
    for (let i = 0; i < 6; i++) { const r = sim.spawn("relay", 1, hq.x + (i % 3) * 5, hq.z - 8 - Math.floor(i / 3) * 5); r.supply = 15; }
    sim.players[1].alloy = sim.players[1].energy = 100000;
    const cap = sim.population(1).cap;
    while (sim.population(1).used < cap - 2) sim.spawn("ranger", 1, hq.x + (sim.population(1).used % 8) - 4, hq.z - 20);
    const before = trained(sim, "relay", 1).length;
    advance(sim, 20);
    return { cap, built: trained(sim, "relay", 1).length - before };
  };
  const plain = relaysWanted(null), larger = relaysWanted({ pop: "150" });
  assert.equal(plain.cap, 100);
  assert.equal(plain.built, 0, "at 100 the AI wants no more relays");
  assert.ok(larger.built >= 1, "under 150 the AI raises a relay past 100");
});
