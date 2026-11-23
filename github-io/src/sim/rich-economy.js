// Phone-length matches (owner, 2026-11-23; plan G1). The game passes the rule `economy: "rich"` for Skirmish, Quick
// battle and campaign missions with a base (main.js createSim). A Simulation without the rule never runs this file,
// so every golden pin and balance baseline stays as it was.
//   start     the player has 6 Harvesters and 600 alloy, so the first minute is about building. Rivals keep their
//             original start: Relaxed and Normal must not get harder.
//   clusters  Skirmish maps get a resource cluster (at least 2 alloy + 1 blue) about every 40 m on a mirrored grid,
//             so there is always a choice of where to expand. Existing deposits are never removed.
import { reflect } from "../terrain.js";

export const RICH = Object.freeze({ workers: 6, alloy: 600, spacing: 40, margin: 14, reach: 13, alloyAmount: 2500, energyAmount: 1800 });
const ALLOY_SPOTS = [[-2.6, 0], [2.6, 0], [-5.2, 1.5], [5.2, 1.5], [0, -3.4]];
const ENERGY_SPOTS = [[0, 3.8], [0, -3.8], [3.4, 3.4], [-3.4, 3.4]];
const SHIFTS = [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [-5, 5], [5, -5], [-5, -5], [9, 0], [-9, 0], [0, 9], [0, -9], [9, 9], [-9, 9], [9, -9], [-9, -9]];

// The grid cell centres on one axis: centred on 0, so the grid is its own mirror image.
export function gridLine(size) {
  // At least three per axis, so the smallest map has nine clusters (a 96 m map spaces them 34 m apart).
  const usable = size - RICH.margin * 2, count = Math.max(3, Math.floor(usable / RICH.spacing) + 1), step = Math.min(RICH.spacing, usable / (count - 1));
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step);
}
const near = (list, x, z, r) => list.filter((p) => Math.hypot(p.x - x, p.z - z) < r);
export const isCluster = (sim, x, z) => {
  const here = near(sim.resources, x, z, RICH.reach);
  return here.filter((r) => r.type === "alloy").length >= 2 && here.some((r) => r.type === "energy");
};
function free(sim, x, z) {
  if (Math.abs(x) > sim.terrain.half - 5 || Math.abs(z) > sim.terrain.half - 5 || !sim.terrain.canStand(x, z, 2.2) || !sim.nav.canStand(x, z, 2.2)) return false;
  if (sim.entities.some((e) => e.hp > 0 && Math.hypot(e.x - x, e.z - z) < (e.radius || 1) + (e.kind === "building" ? 5 : 2.4))) return false;
  return !near(sim.resources, x, z, 3.5).length;
}
// Every mirror of a point is filled together (all four when there can be four camps), so no side gets a better field.
// A river or wall can block a four-way mirror: then the map's own symmetry (rival against rival) still keeps it fair.
const symmetries = (sim) => (sim.enemyCount > 1 ? ["quad", sim.terrain.symmetry || "point"] : [sim.terrain.symmetry || "point"]);

function fillCell(sim, cx, cz) {
  for (const symmetry of symmetries(sim)) if (fillWith(sim, cx, cz, symmetry)) return true;
  return false;
}
function fillWith(sim, cx, cz, symmetry) {
  const mirrors = (_, x, z) => reflect(x, z, symmetry), allFree = (_, x, z) => mirrors(_, x, z).every(([a, b]) => free(sim, a, b));
  for (const [dx, dz] of SHIFTS) {
    const x = cx + dx, z = cz + dz, here = near(sim.resources, x, z, RICH.reach);
    const wantAlloy = Math.max(0, 2 - here.filter((r) => r.type === "alloy").length), wantEnergy = here.some((r) => r.type === "energy") ? 0 : 1;
    const picked = [], open = (px, pz) => allFree(sim, px, pz) && !near(picked, px, pz, 3.5).length;
    for (const [n, type, spots] of [[wantAlloy, "alloy", ALLOY_SPOTS], [wantEnergy, "energy", ENERGY_SPOTS]]) {
      let left = n;
      for (const [ox, oz] of spots) {
        if (!left) break;
        if (open(x + ox, z + oz)) { picked.push({ type, x: x + ox, z: z + oz }); left--; }
      }
      if (left) { picked.length = 0; break; }
    }
    if (picked.length !== wantAlloy + wantEnergy) continue;
    for (const p of picked) for (const [a, b] of mirrors(sim, p.x, p.z)) {
      if (!free(sim, a, b)) continue;
      sim.resource(p.type, a, b, p.type === "alloy" ? RICH.alloyAmount : RICH.energyAmount, -(sim.resources.length + 1));
    }
    return true;
  }
  return false;
}

export function addClusters(sim) {
  const line = gridLine(sim.terrain.size);
  for (const x of line) for (const z of line) if (!isCluster(sim, x, z)) fillCell(sim, x, z);
}

export function richStart(sim) {
  const player = sim.players[0], own = sim.own(0), core = own.find((e) => e.type === "hq"), workers = own.filter((e) => e.type === "worker");
  if (!core || !workers.length) return;
  player.alloy = Math.max(player.alloy, RICH.alloy);
  const home = workers[workers.length - 1], stepX = workers.length > 1 ? home.x - workers[workers.length - 2].x : 2;
  for (let i = workers.length, n = 1; i < RICH.workers; i++, n++) {
    for (let ring = 0; ring < 10; ring++) {
      const x = home.x + (stepX || 2) * n + ring * 0.8, z = home.z + (ring % 2 ? ring * 0.8 : 0);
      if (!sim.nav.canStand(x, z, 0.65)) continue;
      sim.spawn("worker", 0, x, z);
      break;
    }
  }
}
