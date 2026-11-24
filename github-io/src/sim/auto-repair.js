import { hyp } from "../data.js";

// Harvester auto-repair (owner, 2026-11-24: "units do their own jobs", safely). The interface asks
// autoRepairJobs() about once a second and sends what it returns as ordinary repair orders flagged
// `auto` and `resume` (src/app/frame.js), so AI and bot matches never auto-repair. Only idle Harvesters
// help, only on a damaged building near one of their Command cores, and only while no enemy is near it;
// a flagged job ends as soon as an enemy comes near (sim/economy.js), and the Harvester goes back to its
// last deposit (sim/orders.js finish).
export const AUTO_REPAIR = Object.freeze({
  // A building counts as "at the base" within this distance of a Command core's edge (m).
  base: 22,
  // An idle Harvester helps a building within this distance of its edge (m).
  reach: 14,
  // No visible enemy unit within this distance of the building (m).
  enemy: 18,
  // Up to this many Harvesters per building (as progression.js REPAIR.crew).
  crew: 2,
  // Repairs start below this share of health.
  below: 0.95,
});

// An enemy unit (or armed building) the team can see near `b`.
export function enemyNear(sim, team, b, radius = AUTO_REPAIR.enemy) {
  for (const t of sim.entities) {
    if (!(t.hp > 0) || !sim.hostile(team, t.team)) continue;
    if (t.kind !== "unit" && !(t.kind === "building" && t.damage > 0)) continue;
    if (hyp(t.x - b.x, t.z - b.z) <= radius + (b.radius || 0) && sim.isVisible(t, team)) return true;
  }
  return false;
}

// [{ ids, target }]: the repair jobs idle Harvesters should take now (deterministic order).
export function autoRepairJobs(sim, team = 0) {
  if (sim.result || sim.defence) return [];
  const mine = sim.entities.filter((e) => e.team === team && e.hp > 0);
  const cores = mine.filter((b) => b.type === "hq" && b.complete);
  if (!cores.length) return [];
  const idle = mine.filter((w) => w.type === "worker" && w.complete && !w.orders.length);
  if (!idle.length) return [];
  const damaged = mine
    .filter((b) => b.kind === "building" && b.complete && b.hp < b.maxHp * AUTO_REPAIR.below
      && cores.some((c) => hyp(c.x - b.x, c.z - b.z) <= AUTO_REPAIR.base + c.radius)
      && !enemyNear(sim, team, b))
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id);
  const used = new Set(), jobs = [];
  for (const b of damaged) {
    const crew = mine.filter((w) => w.orders[0]?.type === "repair" && w.orders[0].target === b.id).length;
    const d = (w) => hyp(w.x - b.x, w.z - b.z);
    const near = idle.filter((w) => !used.has(w.id) && d(w) <= AUTO_REPAIR.reach + b.radius && sim.repairValid(w, b))
      .sort((p, q) => d(p) - d(q) || p.id - q.id).slice(0, Math.max(0, AUTO_REPAIR.crew - crew));
    if (!near.length) continue;
    for (const w of near) used.add(w.id);
    jobs.push({ ids: near.map((w) => w.id), target: b.id });
  }
  return jobs;
}
