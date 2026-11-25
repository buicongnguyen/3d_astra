// The service record (W6 replay value): lifetime counters from every finished match, kept in this browser
// only, for the achievements beyond the campaign (src/story/achievements.js) and the medal cosmetics
// (src/meta/rewards.js). Pure: no DOM; the page side is src/meta-ui.js.
//
// localStorage RECORD_KEY = {
//   v: 1,
//   skirmishWins, bigWins (3 AI), relentlessWins: n,
//   beaten: [factionId],                 enemy factions beaten in a Skirmish
//   kites, dives, tamed: n,              Kite scouts trained, Kite Dives landed, creatures tamed (any mode)
//   fieldRank: n,                        best Field commander level reached in Frontier Defence (1-5)
//   branchWins: ["artillery"|"rally"],   Defence wins with that commander branch
//   earned: [achievementId],             achievements beyond the campaign, once reached (never lost)
//   meta: { ach, gold, goldActs: [act], sets }   written by the page: what the medal cosmetics read
// }
// A missing or corrupt record reads as a fresh one; unknown values are dropped; counters are capped.
export const RECORD_KEY = "frontier-record-v1";
export const FACTION_IDS = Object.freeze(["meridian", "ashfall", "sunward", "wardens", "veil"]);
const BRANCHES = ["artillery", "rally"];
const CAP = 1e6;
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.min(CAP, Math.floor(v)) : 0);
const ids = (list, allowed) => (Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === "string" && (!allowed || allowed.includes(x))))] : []);

export function freshRecord() {
  return { v: 1, skirmishWins: 0, bigWins: 0, relentlessWins: 0, beaten: [], kites: 0, dives: 0, tamed: 0, fieldRank: 0, branchWins: [], earned: [], meta: { ach: 0, gold: 0, goldActs: [], sets: 0 } };
}

export function normalizeRecord(raw) {
  const out = freshRecord();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of ["skirmishWins", "bigWins", "relentlessWins", "kites", "dives", "tamed"]) out[key] = count(raw[key]);
  out.fieldRank = Math.min(5, count(raw.fieldRank));
  out.beaten = ids(raw.beaten, FACTION_IDS);
  out.branchWins = ids(raw.branchWins, BRANCHES);
  out.earned = ids(raw.earned).slice(0, 200);
  const m = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  out.meta = { ach: count(m.ach), gold: count(m.gold), goldActs: Array.isArray(m.goldActs) ? [...new Set(m.goldActs.filter((a) => Number.isInteger(a) && a > 0 && a < 10))] : [], sets: count(m.sets) };
  return out;
}

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function loadRecord(store = storage()) {
  try { return normalizeRecord(JSON.parse(store?.getItem(RECORD_KEY) || "null")); } catch { return freshRecord(); }
}
// True when stored; blocked or full storage fails silently (the record lasts for the visit).
export function saveRecord(record, store = storage()) {
  try { store.setItem(RECORD_KEY, JSON.stringify(normalizeRecord(record))); return true; } catch { return false; }
}

// One finished match, as the page describes it (src/meta-ui.js matchContext):
//   { mode, win, enemyCount, aiSpeed, rivals: [factionId], stats: { kites, dives, tamed }, hero: { level, branch } | null, scored }
// `live` (a match still being played) counts what already happened but no win.
export function addMatch(record, ctx = {}, { live = false } = {}) {
  const r = normalizeRecord(record), stats = ctx.stats || {};
  const win = !live && !!ctx.win && !ctx.scored;
  r.kites += count(stats.kites); r.dives += count(stats.dives); r.tamed += count(stats.tamed);
  if (ctx.hero) r.fieldRank = Math.max(r.fieldRank, Math.min(5, count(ctx.hero.level)));
  if (win && ctx.mode === "skirmish") {
    r.skirmishWins++;
    if ((ctx.enemyCount || 1) >= 3) r.bigWins++;
    if (ctx.aiSpeed === "relentless") r.relentlessWins++;
    r.beaten = ids([...r.beaten, ...(ctx.rivals || [])], FACTION_IDS);
  }
  if (win && ctx.mode === "defence" && BRANCHES.includes(ctx.hero?.branch)) r.branchWins = ids([...r.branchWins, ctx.hero.branch], BRANCHES);
  return r;
}
