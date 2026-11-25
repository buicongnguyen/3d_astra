// Can a selected Harvester walk to a build site? (W14, 2026-11-25.) On a plateau without ramps (and on any
// ground cut off by water or walls) the ghost used to show green and the order was then refused with
// "The Harvester cannot reach that site." (sim/orders.js build). The ghost now runs the same check first and
// turns red with that reason, so the player knows before tapping.
//
// The check is the sim's own: the route search (sim.nav.path) from each selected Harvester to the site's
// approach point (sim.approach). It runs on hover and tap only, never per frame, and each answer is kept per
// building type, site cell, Harvester cells and navigation revision (a new building or a fallen wall changes
// the routes), so moving the pointer inside one 2 m cell costs nothing. Reads only: the sim state and hash do
// not change (nav.path fills its own route caches, which hold no game state).
import { DEFINITIONS as D } from "./data.js";

export const REACH_ERROR = "The Harvester cannot reach that site.";
const caches = new WeakMap();
const LIMIT = 256;

// The first selected Harvester (in selection order) that can walk to the site, or null.
export function reachingBuilder(sim, type, x, z, selected) {
  const workers = (selected || []).filter((e) => e?.type === "worker" && e.team === 0 && e.hp > 0);
  if (!workers.length || !sim?.nav || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const radius = D[type]?.radius ?? 0;
  const terrain = sim.terrain, site = terrain.cellIndex(x, z);
  let cache = caches.get(sim);
  if (!cache || cache.revision !== sim.nav.revision) caches.set(sim, (cache = { revision: sim.nav.revision, answers: new Map() }));
  const key = `${type}|${site}|${workers.map((w) => `${w.id}:${terrain.cellIndex(w.x, w.z)}`).join(",")}`;
  if (cache.answers.has(key)) return sim.get(cache.answers.get(key)) || null;
  const builder = workers.find((w) => sim.nav.path(w, sim.approach(w, { x, z, radius })).length > 0) || null;
  if (cache.answers.size >= LIMIT) cache.answers.clear();
  cache.answers.set(key, builder ? builder.id : -1);
  return builder;
}

// What stops this build, for the ghost and the build card: the placement rule's reason, else the reach
// reason when Harvesters are selected and none can get there, else "".
export function buildSiteError(sim, type, x, z, selected) {
  const error = sim.placement(type, 0, x, z);
  if (error) return error;
  if (!(selected || []).some((e) => e?.type === "worker")) return "";
  return reachingBuilder(sim, type, x, z, selected) ? "" : REACH_ERROR;
}

