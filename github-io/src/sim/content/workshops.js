// Faction workshops (AAA round 2, W1-A; docs/CONTENT_SEAMS.md). Under the skirmish rule
// `roster: "expanded"` every faction building is a host that trains its faction's workshop units, and
// the computer plays them. A match without that rule never reaches any line below the guards.
//
//   hosts     balance.json "workshops": meridian "workshop" (the Field workshop, new), ashfall
//             "salvageyard", sunward "waystation", wardens "pylon", veil "veilrelay".
//   units     definitions with `workshop: "<faction>"` and `roster: "expanded"` (written by the unit
//             packages), the first `max_tiles` in definition order. Their `required_level` is the host's
//             level; the production card (app/hud.js, research-tiles.js) already shows "Needs L2".
//   AI data   `ai: { role: "line" | "back" | "front", want: [{ if?, n }], max }` on the unit definition:
//             `want` is read in order, the first entry whose `if` holds gives the wanted count (an entry
//             with no `if` always holds); `max` caps the units alive plus queued. `if` keys, all of which
//             must hold: seenInfantry (share of the seen enemy army, from the AI's intel, once it has
//             seen at least 4), seenSupport / seenAntiarmor / seenTowers (counts seen), after (seconds).
//             Intel is only kept by Normal and faster AIs (sim/ai-counter.js), as for the counter-picks.
//             `role` is read by W2-D's placement, not here.
import { DEFINITIONS as D } from "../../data.js";
import { EXPANDED, HOST_FACTION, HOST_OF, workshopUnitsOf } from "../../factions.js";
import { fieldPlan } from "../../ai-plan.js";

// Enemy units the AI must have seen before a share of them means anything (as ai-counter.js MIN_SEEN).
const MIN_SEEN = 4;

// What the AI believes the enemy fields (its intel memory, id -> type), as counts.
function seen(sim, team) {
  const mix = { total: 0, infantry: 0, support: 0, antiarmor: 0, towers: 0 };
  for (const type of (sim.intel[team] || new Map()).values()) {
    const d = D[type];
    if (!d) continue;
    if (d.kind === "building") { if (type === "tower") mix.towers++; continue; }
    mix.total++;
    if (!d.flying && !d.mechanical) mix.infantry++;
    if (d.class === "support") mix.support++;
    if (d.class === "antiarmor") mix.antiarmor++;
  }
  return mix;
}

// True when every key of an `ai.want` condition holds; an unknown key never does.
function holds(cond, sim, mix) {
  if (!cond) return true;
  for (const [key, need] of Object.entries(cond)) {
    const ok = key === "seenInfantry" ? mix.total >= MIN_SEEN && mix.infantry / mix.total >= need
      : key === "seenSupport" ? mix.support >= need
      : key === "seenAntiarmor" ? mix.antiarmor >= need
      : key === "seenTowers" ? mix.towers >= need
      : key === "after" ? sim.time >= need
      : false;
    if (!ok) return false;
  }
  return true;
}

// How many of a unit the AI wants now: the first `want` entry that holds, capped by `max`.
export function wantedCount(ai, sim, mix) {
  let n = 0;
  for (const w of ai.want || []) if (holds(w.if, sim, mix)) { n = w.n; break; }
  return Math.min(n, ai.max ?? Infinity);
}

// Meridian has no building of its own: once its Foundry stands the AI adds the Field workshop, on the
// ring around the core the Classic AI uses (12 angles at 10, 17 and 23 m).
function buildHost(sim, team, host, { own, workers, hq, afford }) {
  if (!hq || !workers.length || own.some((e) => e.type === host) || !own.some((e) => e.type === "foundry" && e.complete)) return;
  // One construction at a time, as the Classic AI; checked live, because it may have just placed one.
  if (sim.own(team).some((e) => e.kind === "building" && !e.complete) || !afford(D[host].cost)) return;
  for (const r of [10, 17, 23])
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2, x = hq.x + Math.cos(angle) * r, z = hq.z + Math.sin(angle) * r;
      if (!sim.placement(host, team, x, z) && sim.build(workers[0].id, host, x, z)) return;
    }
}

function workshopAi(sim, team, ctx) {
  if (sim.mission || sim.ruleOn("roster") !== EXPANDED) return;
  const faction = sim.factionId(team), host = HOST_OF[faction], units = workshopUnitsOf(faction);
  if (!host || !units.length) return;
  const { own, pace, afford } = ctx;
  if (faction === "meridian") buildHost(sim, team, host, ctx);
  // The deepest level any of the faction's workshop units needs: the host is raised that far, one
  // level at a time and never past the Command core's, so the Stalker (level 2) and the Rampart
  // (level 3) can be trained at all. The Classic AI only ever levels the Barracks and the Foundry.
  const top = Math.max(...units.map((type) => D[type].required_level || 1));
  const mix = seen(sim, team);
  const alive = (type) => own.filter((e) => e.type === type && e.hp > 0).length + own.reduce((n, e) => n + (e.queue || []).filter((q) => q.type === type).length, 0);
  // Field command (R3-A census): at least one workshop unit stands per host once it can be afforded.
  const floor = fieldPlan(sim, team) && !units.some((type) => alive(type) > 0) ? 1 : 0;
  for (const b of own.filter((e) => e.type === host && e.complete)) {
    if (b.levelJob) continue;
    if (!b.queue.length && b.level < Math.min(top, sim.techLevel(team)) && sim.time > pace.upgradeAt && afford(sim.levelCost(b))) {
      sim.upgradeBuilding(b.id, team);
      continue;
    }
    if (b.queue.length >= 2) continue;
    for (const type of units) {
      const d = D[type], ai = d.ai;
      if (!ai || !b.trains?.includes(type) || b.level < (d.required_level || 1) || alive(type) >= Math.max(floor, wantedCount(ai, sim, mix))) continue;
      const pop = sim.population(team);
      if (pop.used + pop.reserved + d.pop > pop.cap || !afford(d.cost)) continue;
      if (sim.enqueue(b.id, type)) break;
    }
  }
}

export const workshops = {
  id: "workshops",
  // A host of an Expanded match trains its faction's workshop units. The key is made only here, so
  // every Classic entity keeps the keys it had.
  onSpawn(sim, e) {
    if (e.kind !== "building" || sim.ruleOn("roster") !== EXPANDED) return;
    const faction = HOST_FACTION[e.type];
    if (!faction || sim.factionId(e.team) !== faction) return;
    const units = workshopUnitsOf(faction);
    if (units.length) e.trains = units;
  },
  aiRules: [{ id: "workshops", run: workshopAi }],
};
