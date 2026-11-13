import { DEFINITIONS as D } from "./data.js";
import { aiPace } from "./ai-plan.js";

// Match saves. A save is one JSON string: the options the match was created with plus every
// field of the simulation except what is derived (navigation grid, terrain, AI tempo table)
// or transient (the event queue). Bump SAVE_VERSION whenever a stored field changes meaning;
// older saves are then refused instead of loading wrongly.
export const SAVE_VERSION = 1;
const DERIVED = new Set(["nav", "terrain", "pace", "events", "commandLog", "lookup", "lookupFor", "lookupSize", "missionDef", "tickEvents"]);

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
  const text = atob(d), cells = new Uint8Array(n);
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
      options: { ...(Object.values(this.factions).some(id => id !== "meridian") ? {factions:this.factions} : {}), map: this.terrain.id, enemyCount: this.enemyCount, aiSpeed: this.aiSpeed, alliance: this.coalition ? "coalition" : "ffa", ai: this.aiEnabled, mission: this.missionDef || null, difficulty: this.difficulty, playerBonus: this.playerBonus || null, capturePoints: !!this.capturePointsOn, ...(this.aiPlayer ? {aiPlayer:true} : {}) },
      nav: { revision: this.nav.revision, wallsSpawned: this.nav.wallsSpawned },
      state,
    }, encode);
  },
  // A short fingerprint of the whole state: equal hashes mean two simulations are in step.
  hash() {
    const text = this.serialize();
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16).padStart(8, "0");
  },
};

// Rebuilds a simulation from serialize() output. Returns null for a save this version cannot read.
export function restore(Simulation, saved) {
  let data;
  try { data = typeof saved === "string" ? JSON.parse(saved, decode) : saved; } catch { return null; }
  if (data?.version !== SAVE_VERSION || !data.state || !data.options) return null;
  const sim = new Simulation(data.options);
  Object.assign(sim, data.state);
  sim.entities = data.state.entities.map((e) => ({ ...D[e.type], ...e }));
  sim.events = [];
  sim.pace = aiPace(sim.aiSpeed, !!sim.mission);
  sim.nav.wallsSpawned = data.nav.wallsSpawned;
  // Frontier Defence: blown bridges and pontoons live in the derived terrain; put them back
  // before the grid is built, or a loaded match walks over a blown bridge.
  sim.applyCrossings?.(false);
  sim.nav.rebuild(sim.entities);
  sim.nav.revision = data.nav.revision;
  return sim;
}
