// Match history and stored replays (plan B2/B3, W6). Pure: no DOM; the page side is src/meta-ui.js.
//
// localStorage HISTORY_KEY = [entry] (newest first, at most HISTORY_CAP):
//   { id, at (ms), mode, map, mission|null, player, rivals: [factionId], result: "victory"|"defeat"|"score",
//     seconds, difficulty, aiSpeed, enemyCount, medal|null, stars|null, score|null,
//     stats: { killed, lost, trained, built, alloy, energy }, replay: true|undefined }
// localStorage REPLAY_KEY = { [entryId]: replay } (src/meta/replay.js), at most REPLAY_CAP replays of at most
// REPLAY_BYTES each; the oldest goes first when a new one does not fit. Corrupt data reads as empty.
export const HISTORY_KEY = "frontier-history-v1";
export const REPLAY_KEY = "frontier-replays-v1";
export const HISTORY_CAP = 20;
export const REPLAY_CAP = 3;
export const REPLAY_BYTES = 200_000;
const MODES = ["skirmish", "campaign", "defence", "training"];
const RESULTS = ["victory", "defeat", "score"];
const STAT_KEYS = ["killed", "lost", "trained", "built", "alloy", "energy"];
const num = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v * 10) / 10) : 0);
const str = (v, max = 48) => (typeof v === "string" && v.length && v.length <= max ? v : null);

export function normalizeEntry(e) {
  if (!e || typeof e !== "object" || !str(e.id, 32) || !Number.isFinite(e.at) || !MODES.includes(e.mode) || !RESULTS.includes(e.result)) return null;
  const out = {
    id: e.id, at: Math.floor(e.at), mode: e.mode, map: str(e.map) || "", mission: str(e.mission, 64), player: str(e.player, 16) || "meridian",
    rivals: Array.isArray(e.rivals) ? e.rivals.filter((r) => str(r, 16)).slice(0, 3) : [], result: e.result, seconds: num(e.seconds, 1e6),
    difficulty: str(e.difficulty, 16) || "standard", aiSpeed: str(e.aiSpeed, 16) || "normal", enemyCount: Number.isInteger(e.enemyCount) ? Math.min(3, Math.max(1, e.enemyCount)) : 1,
    medal: ["bronze", "silver", "gold"].includes(e.medal) ? e.medal : null, stars: Number.isInteger(e.stars) ? Math.min(4, Math.max(0, e.stars)) : null,
    score: Number.isInteger(e.score) ? Math.max(0, e.score) : null, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, num(e.stats?.[k])])),
  };
  if (e.replay === true) out.replay = true;
  return out;
}
export function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.map(normalizeEntry).filter((e) => e && !seen.has(e.id) && seen.add(e.id)).slice(0, HISTORY_CAP);
}
// A new entry first; the list never grows past HISTORY_CAP.
export const addHistory = (list, entry) => normalizeHistory([entry, ...normalizeHistory(list).filter((e) => e.id !== entry?.id)]);

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function loadHistory(store = storage()) {
  try { return normalizeHistory(JSON.parse(store?.getItem(HISTORY_KEY) || "[]")); } catch { return []; }
}
export function saveHistory(list, store = storage()) {
  try { store.setItem(HISTORY_KEY, JSON.stringify(normalizeHistory(list))); return true; } catch { return false; }
}

// Replays: { [id]: replay }, only well-formed ones, newest REPLAY_CAP.
export function loadReplays(store = storage()) {
  try {
    const raw = JSON.parse(store?.getItem(REPLAY_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const list = Object.entries(raw).filter(([id, r]) => str(id, 32) && r && typeof r === "object" && Array.isArray(r.log) && Number.isFinite(r.at));
    return Object.fromEntries(list.sort((a, b) => b[1].at - a[1].at).slice(0, REPLAY_CAP));
  } catch { return {}; }
}
// Stores one replay (a new one is the newest). Too big: refused. Older replays make room (at most REPLAY_CAP
// kept); full storage drops the oldest until it fits; a replay that never fits is not stored.
// Returns the ids now stored, or null when this replay was not stored.
export function storeReplay(id, replay, store = storage()) {
  const text = JSON.stringify(replay);
  if (!store || text.length > REPLAY_BYTES) return null;
  const all = { ...loadReplays(store), [id]: replay };
  let ids = [id, ...Object.keys(all).filter((k) => k !== id).sort((a, b) => all[b].at - all[a].at)].slice(0, REPLAY_CAP);
  while (ids.length) {
    try { store.setItem(REPLAY_KEY, JSON.stringify(Object.fromEntries(ids.map((k) => [k, all[k]])))); return ids; }
    catch { ids = ids.slice(0, -1); }
  }
  return null;
}
