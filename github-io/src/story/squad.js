// The veteran squad (campaign plan C2, docs/aaa/PLAN_CAMPAIGN_FACES_AND_RETURN_2026-11-24.md).
// After a won story mission up to SQUAD_MAX of the player's ranked fighters are kept in the campaign
// progress with a name; the next story mission starts them beside the Command core. It adds, it
// never gates: a mission gives the same starting force to a player with no veterans.
// Pure data and functions, like story/choices.js: the simulation, the campaign record and the
// interface all read them.
import { MISSIONS } from "./missions.js";

export const SQUAD_MAX = 6;
// Original first names, shared by every language (a name is a name).
export const SQUAD_NAMES = Object.freeze([
  "Ada", "Bram", "Cora", "Dax", "Eda", "Finn", "Gita", "Hoa", "Ilya", "Joon", "Kai", "Lena", "Minh", "Nori", "Oren", "Pia",
  "Quill", "Rhea", "Sven", "Tala", "Uri", "Vera", "Wen", "Xan", "Yuna", "Zed", "Anh", "Bao", "Cass", "Dara", "Emi", "Fox",
  "Gus", "Hana", "Ivo", "Jin", "Kira", "Lio", "Mara", "Nan", "Odo", "Pax", "Rin", "Sol", "Tam", "Una", "Vik", "Wren",
]);

// Campaign heroes (story/heroes.js) come back on their own and never join the squad.
const eligibleUnit = (e) => e.team === 0 && e.kind === "unit" && e.hp > 0 && !e.boss && !e.hero && e.type !== "worker" && !!e.damage && (e.rank || 0) >= 1;

// The squad a won mission leaves: the best ranked survivors (rank, then experience, then id), named.
// Units that already carry a name (earlier squad members) keep it; new names skip the ones in use.
export function squadFrom(entities, missionId = "") {
  const picked = entities.filter(eligibleUnit)
    .sort((a, b) => (b.rank || 0) - (a.rank || 0) || (b.xp || 0) - (a.xp || 0) || a.id - b.id)
    .slice(0, SQUAD_MAX);
  const used = new Set(picked.map((e) => e.squadName).filter(Boolean));
  let seed = 0;
  for (const ch of missionId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return picked.map((e) => {
    let name = e.squadName;
    if (!name) {
      for (let k = 0; k < SQUAD_NAMES.length; k++) {
        const n = SQUAD_NAMES[(seed + e.id * 7 + k) % SQUAD_NAMES.length];
        if (!used.has(n)) { name = n; break; }
      }
      name = name || SQUAD_NAMES[(seed + e.id) % SQUAD_NAMES.length];
      used.add(name);
    }
    return { type: e.type, name, rank: e.rank || 1, xp: e.xp || 0 };
  });
}

export const validSquad = (value) => Array.isArray(value)
  ? value.filter((m) => m && typeof m.type === "string" && typeof m.name === "string" && Number.isFinite(m.rank) && m.rank >= 1 && m.rank <= 3).slice(0, SQUAD_MAX)
    .map((m) => ({ type: m.type, name: m.name.slice(0, 16), rank: Math.floor(m.rank), xp: Number.isFinite(m.xp) ? Math.max(0, m.xp) : 0 }))
  : [];

// Story missions with a Command core and no fixed squad take the veterans. Defence missions, the no-base
// strike (m08) and Faction Chronicles do not.
export const carriesSquad = (def, progress = null) => !!def && !def.defence && !def.noCarry && def.rules?.playerBase !== false
  && MISSIONS.some((m) => m.id === def.id) && (MISSIONS[0].id !== def.id || (progress?.ngPlus || 0) > 0);

// The mission with the squad added to its setup: one entry per member, standing by the Command core.
export function carrySquad(def, progress) {
  const squad = validSquad(progress?.squad);
  if (!squad.length || !carriesSquad(def, progress)) return def;
  const entries = squad.map((m, slot) => ({ slot, spawn: m.type, team: 0, at: "playerFront", exact: true, name: m.name, rank: m.rank, xp: m.xp, veteran: true }));
  return { ...def, setup: [...(def.setup || []), ...entries], squad };
}
