// What each production tile of a building says and which state it is in, as plain data
// (hud.js turns it into buttons). Research is one slot that moves forward:
//   Research (pick 1 of 2) -> Damage +10% / Armor +12% -> researching -> tier II -> done.
// Tile states: "ready" (can be ordered), "locked" (needs a building level: the reason is on the
// tile), "busy" (researching, with progress) and "done" (in effect, never shown with a price).
import { DEFINITIONS as D } from "./data.js";

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

// The tiles for one selected building of the player. `choosing` is true while the research choice is open.
export function productionTiles(sim, b, { choosing = false } = {}) {
  const tiles = [];
  const level = (type) => D[type].required_level || 1;
  const levelLock = (type) => (b.level < level(type) ? `Needs ${b.name} L${level(type)}` : "");
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
        // First tier in effect, second next: "Damage +10% ✓" over "+8% at Foundry L2" or "+8%: price".
        const { active, next } = BRANCHES[research.branch], need = level(t);
        Object.assign(tile, { label: active, next, partial: true, state: b.level < need ? "locked" : "ready", sub: b.level < need ? `${next} at ${b.name} L${need}` : null });
      } else {
        const lock = levelLock(t);
        Object.assign(tile, { label: label(t), state: lock ? "locked" : "ready", sub: lock || null });
      }
      tiles.push(tile);
      continue;
    }
    const lock = b.team === 0 ? levelLock(type) : "";
    tiles.push({ type, action: type, label: D[type].name, state: lock ? "locked" : "ready", sub: lock || null });
  }
  return { tiles, choosing: false };
}
