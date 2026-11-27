// H1 Skywing: which story missions and Defence levels field no enemy anti-air (owner 2026-11-27: allowed,
// since Skywing is an opt-in assist; the briefing says so and tests/skywing.test.js lists them into
// docs/MISSIONS.md "Skywing assist"). Static and pure: it reads a mission definition, never plays it.
// An enemy can hit Skywing when it may field a unit with `hits_air` (faction swaps applied: a Sunward Rider
// or a Wardens drone still does), counted from
//   - setup spawns, trigger spawns and waves of any enemy team (team > 0);
//   - Defence waves (`defence.waves[].groups[].units`);
//   - a computer side that trains an army (rules.ai true or "home" with an enemy base): its roster has Rangers.
// Sentinel towers hit flyers only after Flak research, which these missions never give a side at the start.
import { DEFINITIONS as D } from "../data.js";
import { FACTION_RULES } from "../factions.js";

// The unit type `team` fields for `type` under the mission's factions (factions[team], with its swaps).
function swapped(def, team, type) {
  return FACTION_RULES[def.factions?.[team]]?.swap?.[type] || type;
}

// The enemy unit types this mission may field, as a sorted list.
export function enemyTypes(def) {
  const out = new Set();
  const add = (team, type) => { if (team > 0 && D[type]) out.add(swapped(def, team, type)); };
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    if (typeof o.spawn === "string") add(o.team ?? 0, o.spawn);
    if (o.wave && typeof o.wave === "object" && o.wave.units) for (const t of Object.keys(o.wave.units)) add(o.wave.team ?? 1, t);
    for (const [k, v] of Object.entries(o)) if (k !== "wave") walk(v);
  };
  walk(def.setup);
  walk(def.triggers);
  for (const w of def.defence?.waves || []) for (const g of w.groups || []) for (const t of Object.keys(g.units || {})) add(1, t);
  // A computer that trains an army builds Rangers (or its faction's swap) among the first units.
  if (def.rules?.enemyBase && def.rules?.ai && def.rules.mode !== "defence") add(1, "ranger");
  return [...out].sort();
}

// True when some enemy unit of this mission can shoot a flyer.
export const enemyAntiAir = (def) => enemyTypes(def).some((t) => !!D[t]?.hits_air);

// The ids of the missions (in order) whose enemies cannot hit Skywing.
export const missionsWithoutAntiAir = (list) => list.filter((m) => !enemyAntiAir(m)).map((m) => m.id);
