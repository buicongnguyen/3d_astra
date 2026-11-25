// Equal-cost duels (round 2, section 2.6 of docs/aaa/AAA_ROUND2_PLAN.md): the battle of
// tests/balance.test.js generalised. Two armies of equal value meet head on in the real simulation
// on the classic map, with no AI and nothing else on the field, and each battle is scored as the
// share of its army's health the first side keeps minus the share the second keeps (+1: the first
// side wins untouched, -1: it is wiped out without a scratch on the other).
//
// A single layout is not a result: who wins can flip with the spawn side or a rock in the way. So a
// duel plays every spawn offset (the whole battle moved along x) from both spawn sides, 10 battles
// by default, and a gate states the mean of all of them and how many the first side won.
//
//   duel(sideA, sideB, { budget, factions, offsets, rules, watch, limit })
//     side      a unit type ("ranger"), sized to the budget, or a mix [[type, count], ...] of exact counts
//     budget    value per side (cost alloy + 1.5 x energy); default the value of the mix if one side is a
//               mix, else 1000
//     factions  [factionOfA, factionOfB]: each side keeps its faction from either spawn side
//     offsets   x offsets of the battle in metres (default [0, 4, 8, -4, -8])
//     rules     skirmish rules passed to the Simulation ({ roster: "expanded" }, read once W0-B merges)
//     watch     ({ sim, a, b, deaths, offset, seat }) => any: a fact per battle (deaths lists each unit
//               as it fell: { side: "a" | "b", type, id, at }, in order)
//     limit     seconds before a battle is stopped and scored as it stands (default 150)
//     each      (sim) => void, called before every tick (W7: a bench that casts abilities for both sides)
//   returns { mean, wins, battles: [{ offset, seat, score, seconds, kept: { a, b }, deaths, watch? }] }
//   (seat 0: side A spawns as team 0 at z -9; seat 1: side A spawns as team 1 at z +9)
import { Simulation } from "../../src/simulation.js";
import { DEFINITIONS as D } from "../../src/data.js";

export const OFFSETS = [0, 4, 8, -4, -8];
const TICK = 0.05;

// A unit's value: energy counts 1.5x, it is the scarcer resource.
export const value = (type) => D[type].cost[0] + 1.5 * D[type].cost[1];
const isMix = (side) => Array.isArray(side);
const worth = (mix) => mix.reduce((n, [type, count]) => n + value(type) * count, 0);
// The units of a side as [type, count] pairs.
function roster(side, budget) {
  if (isMix(side)) return side;
  if (!D[side]) throw new Error(`duel: unknown unit type ${side}`);
  return [[side, Math.max(1, Math.round(budget / value(side)))]];
}

// One battle. Formation and orders are tests/balance.test.js's: rows of five, 1.9 m apart, team 0
// spawned first, both sides attack-moving through each other's spawn.
function battle(armyA, armyB, { offset, seat, factions, rules, watch, limit, each }) {
  const teams = seat ? [armyB, armyA] : [armyA, armyB];
  const sideOf = seat ? ["b", "a"] : ["a", "b"];
  const s = new Simulation({ ai: false, map: "classic", ...(factions ? { factions: seat ? { 0: factions[1], 1: factions[0] } : { 0: factions[0], 1: factions[1] } } : {}), ...(rules ? { rules } : {}) });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(TICK);
  const army = (mix, team, z) => {
    const out = [];
    for (const [type, count] of mix) for (let k = 0; k < count; k++) {
      const i = out.length;
      out.push(s.spawn(type, team, -30 + offset + (i % 5) * 1.9, z + (team ? 1 : -1) * Math.floor(i / 5) * 1.9));
    }
    return out;
  };
  const first = army(teams[0], 0, -9), second = army(teams[1], 1, 9);
  s.issue(first.map((u) => u.id), { type: "attackmove", x: -26 + offset, z: 14 });
  s.issue(second.map((u) => u.id), { type: "attackmove", x: -26 + offset, z: -14 });
  const deaths = [], dead = new Set();
  const note = (units, side) => { for (const u of units) if (u.hp <= 0 && !dead.has(u.id)) { dead.add(u.id); deaths.push({ side, type: u.type, id: u.id, at: Math.round(s.time * 100) / 100 }); } };
  let t = 0;
  for (; t < limit && first.some((u) => u.hp > 0) && second.some((u) => u.hp > 0); t += TICK) {
    each?.(s);
    s.tick(TICK);
    note(first, sideOf[0]);
    note(second, sideOf[1]);
  }
  const kept = (units) => units.reduce((n, u) => n + Math.max(0, u.hp + u.shield) / (u.maxHp + u.maxShield), 0) / units.length;
  const a = seat ? second : first, b = seat ? first : second;
  const result = { offset, seat, score: kept(a) - kept(b), seconds: Math.round(t * 100) / 100, kept: { a: kept(a), b: kept(b) }, deaths };
  if (watch) result.watch = watch({ sim: s, a, b, deaths, offset, seat });
  return result;
}

export function duel(sideA, sideB, { budget, factions = null, offsets = OFFSETS, rules = null, watch = null, limit = 150, each = null } = {}) {
  const size = budget ?? (isMix(sideA) ? worth(sideA) : isMix(sideB) ? worth(sideB) : 1000);
  const armyA = roster(sideA, size), armyB = roster(sideB, size);
  const battles = [];
  for (const offset of offsets) for (const seat of [0, 1]) battles.push(battle(armyA, armyB, { offset, seat, factions, rules, watch, limit, each }));
  const mean = battles.reduce((n, b) => n + b.score, 0) / battles.length;
  return { mean, wins: battles.filter((b) => b.score > 0).length, battles };
}
