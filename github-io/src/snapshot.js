import { fnv1a } from "./rng.js";
import { DEFINITIONS as D } from "./data.js";
import { aiPace } from "./ai-plan.js";

// Match saves. A save is one JSON string: the options the match was created with plus every
// field of the simulation except what is derived (navigation grid, terrain, AI tempo table)
// or transient (the event queue). Bump SAVE_VERSION whenever a stored field changes meaning;
// older saves are then refused instead of loading wrongly.
export const SAVE_VERSION = 1;
const DERIVED = new Set(["nav", "terrain", "pace", "events", "commandLog", "lookup", "lookupFor", "lookupSize", "missionDef", "tickEvents"]);
// H18: skirmish rules are a match option: saved once, with the options, and handed back to the constructor on load.
DERIVED.add("rules");

const packBits = (cells) => {
  let text = "";
  for (let i = 0; i < cells.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) if (cells[i + b]) byte |= 1 << b;
    text += String.fromCharCode(byte);
  }
  return { n: cells.length, d: btoa(text) };
};
const unpackBits = ({ n, d }) => {
  const text = atob(d);
  if (!Number.isSafeInteger(n) || n < 0 || text.length !== Math.ceil(n / 8))
    throw new Error("Incomplete visibility grid");
  const cells = new Uint8Array(n);
  for (let i = 0; i < n; i++) cells[i] = (text.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return cells;
};
// JSON has no Map, Set, typed array or Infinity; each is stored under a one-key marker object.
function encode(key, value) {
  if (value instanceof Map) return { $map: [...value] };
  if (value instanceof Set) return { $set: [...value] };
  if (value instanceof Uint8Array) return { $bits: packBits(value) };
  if (typeof value === "number" && !Number.isFinite(value)) return { $n: String(value) };
  return value;
}
function decode(key, value) {
  if (!value || typeof value !== "object") return value;
  if ("$map" in value) return new Map(value.$map);
  if ("$set" in value) return new Set(value.$set);
  if ("$bits" in value) return unpackBits(value.$bits);
  if ("$n" in value) return Number(value.$n);
  return value;
}
// An entity is stored as its type plus whatever differs from that type's definition, with keys
// sorted so the same state always gives the same text (the state hash depends on it).
function slim(e) {
  const base = D[e.type] || {}, out = {};
  for (const key of Object.keys(e).sort()) if (e[key] !== base[key] || key === "type") out[key] = e[key];
  return out;
}

export const snapshot = {
  serialize() {
    const state = {};
    for (const [key, value] of Object.entries(this)) if (!DERIVED.has(key) && !(key === "factions" && Object.values(value).every(id => id === "meridian"))) state[key] = value;
    state.entities = this.entities.map(slim);
    return JSON.stringify({
      version: SAVE_VERSION,
      options: { ...(Object.values(this.factions).some(id => id !== "meridian") ? {factions:this.factions} : {}), map: this.terrain.id, enemyCount: this.enemyCount, aiSpeed: this.aiSpeed, alliance: this.coalition ? "coalition" : "ffa", ai: this.aiEnabled, mission: this.missionDef || null, difficulty: this.difficulty, playerBonus: this.playerBonus || null, capturePoints: !!this.capturePointsOn, ...(this.aiPlayer ? {aiPlayer:true} : {}), ...(this.lan ? { lan: this.lan } : {}), ...(this.rules ? { rules: this.rules } : {}) },
      nav: { revision: this.nav.revision, wallsSpawned: this.nav.wallsSpawned },
      state,
    }, encode);
  },
  // A short fingerprint of the whole state: equal hashes mean two simulations are in step.
  hash() {
    const text = this.serialize();
    return fnv1a(text).toString(16).padStart(8, "0");
  },
};

// These collections exist in every version-1 save. A partial save can parse as JSON but
// still be unusable on the first tick (for example, a fog grid that lost its last row).
function hasMatchState(sim, state) {
  const teams = sim.players.length;
  const cells = sim.terrain.grid ** 2;
  const perTeam = (list, check) => Array.isArray(list) && list.length === teams && list.every(check);
  const grid = value => value instanceof Uint8Array && value.length === cells;
  return Array.isArray(state.entities) && state.entities.every(e =>
    e && (Object.hasOwn(D, e.type) || e.type === "wall") &&
    Number.isInteger(e.id) && Number.isFinite(e.x) && Number.isFinite(e.z) &&
    Array.isArray(e.orders) && Array.isArray(e.queue) && Array.isArray(e.path)) &&
    Array.isArray(state.resources) &&
    perTeam(state.players, p => p && Number.isFinite(p.alloy) && Number.isFinite(p.energy)) &&
    perTeam(state.visible, grid) && perTeam(state.explored, grid);
}

// Rebuilds a simulation from serialize() output or its parsed JSON. The caller can
// discard an unreadable slot and return to the menu without installing a broken match.
export function restore(Simulation, saved) {
  try {
    const text = typeof saved === "string" ? saved : JSON.stringify(saved, encode);
    const data = JSON.parse(text, decode);
    if (data?.version !== SAVE_VERSION || !data.state || !data.options || !Number.isInteger(data.nav?.revision)) return null;
    const sim = new Simulation(data.options);
    if (!hasMatchState(sim, data.state)) return null;
    const initialObjectives = sim.mission?.objectives;
    Object.assign(sim, data.state);
    // Older campaign saves only recorded targets once their objectives became visible.
    // The reconstructed setup tells us which targets existed even if they have since died.
    for (const [id, initial] of Object.entries(initialObjectives || {})) {
      if (initial.seen && sim.mission?.objectives[id]) sim.mission.objectives[id].seen = true;
    }
    sim.entities = data.state.entities.map(e => ({ ...D[e.type], ...e }));
    sim.events = [];
    sim.pace = aiPace(sim.aiSpeed, !!sim.mission);
    sim.nav.wallsSpawned = data.nav.wallsSpawned;
    // Restore crossings before rebuilding walkable terrain.
    sim.applyCrossings?.(false);
    // H6: the cover pieces in the save stand in the nav grid again.
    if (sim.cover) sim.applyCover?.();
    sim.nav.rebuild(sim.entities);
    sim.nav.revision = data.nav.revision;
    return sim;
  } catch {
    return null;
  }
}
