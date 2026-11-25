// What each production tile of a building says and which state it is in, as plain data
// (hud.js turns it into buttons). Research is one slot that moves forward:
//   Research (pick 1 of 2) -> Damage +10% / Armor +12% -> researching -> tier II -> done.
// Tile states: "ready" (can be ordered), "locked" (needs a level of the selected building: "Needs L2"
// is on the tile), "busy" (researching, with progress) and "done" (in effect, never shown with a price).
import { DEFINITIONS as D } from "./data.js";
import balance from "./balance.json" with { type: "json" };
import { EXPANDED, HOST_FACTION, workshopUnitsOf } from "./factions.js";

const DOCTRINES = balance.doctrines;

export const BRANCHES = {
  weapons: {
    tiers: ["upgrade", "upgrade2"],
    label: ["Damage +10%", "Damage +8%"],
    // Between the tiers the slot shows the first tier as active and the second as its next step.
    active: "Damage +10% ✓",
    next: "+8%",
    done: "Damage +19%",
  },
  plating: {
    tiers: ["plating", "plating2"],
    label: ["Armor +12%", "Armor +8%"],
    active: "Armor +12% ✓",
    next: "+8%",
    done: "Armor +19%",
  },
};
export const RESEARCH_TYPES = ["upgrade", "plating", "upgrade2", "plating2"];

// Where a research type sits in the team's queues: the building, its place in line and its progress.
function queued(sim, team, type) {
  for (const b of sim.own(team)) {
    const index = b.queue?.findIndex((q) => q.type === type) ?? -1;
    if (index >= 0) return { building: b, index, progress: index === 0 ? Math.min(1, b.queue[0].elapsed / D[type].time) : 0 };
  }
  return null;
}

// The team's research: the chosen branch (null before the choice), the tier in the slot and its state.
export function researchState(sim, team = 0) {
  const p = sim.players[team];
  const branch = p.upgrade || queued(sim, team, "upgrade") ? "weapons" : p.plating || queued(sim, team, "plating") ? "plating" : null;
  if (!branch) return { branch: null };
  const [first, second] = BRANCHES[branch].tiers;
  if (p[second]) return { branch, type: second, tier: 2, state: "done" };
  for (const [tier, type] of [[1, first], [2, second]]) {
    const q = queued(sim, team, type);
    if (q) return { branch, type, tier, state: "busy", progress: q.progress, waiting: q.index > 0 };
  }
  // First tier done (or a pre-0.7 save holding it): the second tier is next.
  return { branch, type: p[first] ? second : first, tier: p[first] ? 2 : 1, state: "ready" };
}

const label = (type) => {
  for (const branch of Object.values(BRANCHES)) {
    const tier = branch.tiers.indexOf(type);
    if (tier >= 0) return branch.label[tier];
  }
  return D[type].name;
};

// The Flak tile: ready (or locked below a level 2 core), researching with progress, or done.
export function flakTile(sim, b, lock = "") {
  const tile = { type: "flak", action: "flak", label: D.flak.name, research: true };
  if (sim.players[b.team].flak) return Object.assign(tile, { state: "done", sub: "Active" });
  const q = queued(sim, b.team, "flak");
  if (q) return Object.assign(tile, { state: "busy", progress: q.progress, sub: q.index > 0 ? "Waiting in queue" : `Researching ${Math.round(q.progress * 100)}%` });
  return Object.assign(tile, { state: lock ? "locked" : "ready", sub: lock || null });
}

// Doctrines (sim/content/doctrines.js): the either/or pair of a Command core, Barracks or Foundry, both
// tiles on the card at once (one tap picks, the other locks: no sub-menu). Before the building's level
// they show "Needs L2"; once one is picked, a single "done" tile names it.
//   { doctrine: true, building, pick, label, name, icon, cost, state, sub, pair: 0 | 1 }
export function doctrineTiles(sim, b) {
  const spec = DOCTRINES[b.type];
  if (!spec || b.team !== 0) return [];
  const chosen = sim.players[b.team].doctrine?.[b.type];
  const tile = (pick, extra) => { const o = spec.options[pick]; return { doctrine: true, type: "doctrine", action: "doctrine", building: b.type, pick, label: o.label, name: o.name, icon: o.icon, cost: o.cost, description: o.description, ...extra }; };
  if (chosen) return [tile(chosen, { state: "done", sub: "Active" })];
  const lock = (b.level || 1) < spec.level ? `Needs L${spec.level}` : "";
  return Object.keys(spec.options).map((pick, pair) => tile(pick, { state: lock ? "locked" : "ready", sub: lock || null, pair }));
}

// The tiles for one selected building of the player. `choosing` is true while the research choice is open.
export function productionTiles(sim, b, { choosing = false } = {}) {
  const tiles = [];
  const level = (type) => D[type].required_level || 1;
  // Short enough for the narrowest tile on Linux fonts; the selected building is the one meant,
  // and the "Upgrade to L2" button sits right below.
  const levelLock = (type) => (b.level < level(type) ? `Needs L${level(type)}` : "");
  const researches = b.team === 0 && b.trains?.includes("upgrade");
  const research = researches ? researchState(sim, b.team) : null;
  if (research && !research.branch && choosing) {
    for (const type of ["upgrade", "plating"]) tiles.push({ type, action: type, label: label(type), state: "ready", research: true, choice: true });
    tiles.push({ type: "back", action: "back", label: "Back", state: "ready" });
    return { tiles, choosing: true };
  }
  for (const type of b.trains || []) {
    if (RESEARCH_TYPES.includes(type)) {
      if (type !== "upgrade" || !research) continue;
      // The single research slot.
      if (!research.branch) { tiles.push({ type: "research", action: "research", label: "Research", state: "ready", sub: "Pick 1 of 2" }); continue; }
      const t = research.type, tile = { type: t, action: t, research: true };
      if (research.state === "done") Object.assign(tile, { label: BRANCHES[research.branch].done, state: "done", sub: "Active" });
      else if (research.state === "busy") Object.assign(tile, { label: label(t), state: "busy", progress: research.progress, sub: research.waiting ? "Waiting in queue" : `Researching ${Math.round(research.progress * 100)}%` });
      else if (research.tier === 2) {
        // First tier in effect, second next: "Damage +10% ✓" over "+8% at L2" or "+8%: price".
        const { active, next } = BRANCHES[research.branch], need = level(t);
        Object.assign(tile, { label: active, next, partial: true, state: b.level < need ? "locked" : "ready", sub: b.level < need ? `${next} at L${need}` : null });
      } else {
        const lock = levelLock(t);
        Object.assign(tile, { label: label(t), state: lock ? "locked" : "ready", sub: lock || null });
      }
      tiles.push(tile);
      continue;
    }
    // Flak (Command core, 0.18): a one-off research of its own, outside the Foundry's branch slot.
    if (type === "flak") { tiles.push(flakTile(sim, b, levelLock(type))); continue; }
    const lock = b.team === 0 ? levelLock(type) : "";
    tiles.push({ type, action: type, label: D[type].name, state: lock ? "locked" : "ready", sub: lock || null });
  }
  tiles.push(...doctrineTiles(sim, b));
  return { tiles, choosing: false };
}

// The units a building would train for this team once built (build menu tiles, 2026-11-25): its faction's
// roster for the building (sim.resolvedTrains: faction swaps, flyers, story unlocks, mission limits), or an
// Expanded match's workshop units at the faction's host (sim/content/workshops.js). Research is left out;
// `level` is the building level each unit needs (a new building starts at level 1).
export function buildingUnits(sim, type, team = 0) {
  const faction = sim.factionId?.(team);
  const workshop = sim.ruleOn?.("roster") === EXPANDED && HOST_FACTION[type] === faction ? workshopUnitsOf(faction) : [];
  const trains = workshop.length ? workshop : D[type]?.trains ? sim.resolvedTrains(team, D[type].trains) : [];
  return trains.filter((unit) => D[unit]?.kind === "unit").map((unit) => ({ type: unit, name: D[unit].name, level: D[unit].required_level || 1 }));
}
// The tile's accessible line for those units: "Trains: Vanguard · Ranger · Medic (level 2)". The " · " joints
// let each name be translated on its own (i18n.js); "(level N)" has its own pattern in the catalogs.
export const trainsLine = (units) => units.length ? `Trains: ${units.map((u) => (u.level > 1 ? `${u.name} (level ${u.level})` : u.name)).join(" · ")}` : "";
