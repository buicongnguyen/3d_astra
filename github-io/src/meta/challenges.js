// Daily challenges (plan C7.1, W6): three short goals a day, one from each group (Skirmish, campaign,
// Frontier Defence), picked from the local date by a pure hash, so the same day gives the same set on
// every device and nothing random. Each is judged from the finished match (src/meta-ui.js matchContext)
// and pays CHALLENGE_XP Commander XP once; all three on one day is a "set", which the medal cosmetics count
// (src/meta/rewards.js). Never a rule: a challenge changes no battle.
//
// localStorage CHALLENGE_KEY = { day: "YYYY-MM-DD", done: [challengeId], sets: n, setDay: "YYYY-MM-DD"|null }
// A new day starts with nothing done; `sets` is kept for ever.
import { fnv1a } from "../rng.js";

export const CHALLENGE_KEY = "frontier-challenges-v1";
export const CHALLENGE_XP = 50;
export const GROUPS = Object.freeze(["skirmish", "campaign", "defence"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// mode: the match mode a challenge needs (the title tile switches to it). goal ≤ 36 characters.
// test(ctx): ctx = { mode, win, seconds, enemyCount, difficulty, medal, stars, score, optional, stats, hero }.
export const CHALLENGES = Object.freeze([
  { id: "sk-swift", group: "skirmish", mode: "skirmish", icon: "dash", title: "Swift strike", goal: "Win a Skirmish within 15 minutes", test: (c) => c.win && c.seconds <= 900 },
  { id: "sk-lean", group: "skirmish", mode: "skirmish", icon: "shield", title: "Iron line", goal: "Win a Skirmish losing 8 units or fewer", test: (c) => c.win && (c.stats?.lost ?? Infinity) <= 8 },
  { id: "sk-kite", group: "skirmish", mode: "skirmish", icon: "kite", title: "Sky scout", goal: "Win a Skirmish with a Kite scout", test: (c) => c.win && (c.stats?.kites || 0) >= 1 },
  { id: "sk-two", group: "skirmish", mode: "skirmish", icon: "people", title: "Two fronts", goal: "Win a Skirmish against 2+ AI", test: (c) => c.win && (c.enemyCount || 1) >= 2 },
  { id: "sk-hunter", group: "skirmish", mode: "skirmish", icon: "crosshair", title: "Hunter", goal: "Destroy 40 units in a Skirmish win", test: (c) => c.win && (c.stats?.killed || 0) >= 40 },
  { id: "cp-win", group: "campaign", mode: "campaign", icon: "flag", title: "Expedition", goal: "Win any campaign mission", test: (c) => c.win },
  { id: "cp-silver", group: "campaign", mode: "campaign", icon: "star", title: "Polished", goal: "Earn silver or gold in a mission", test: (c) => c.win && (c.medal === "silver" || c.medal === "gold") },
  { id: "cp-extra", group: "campaign", mode: "campaign", icon: "objectives", title: "Extra mile", goal: "Complete an optional objective", test: (c) => c.win && (c.optional || 0) >= 1 },
  { id: "cp-ability", group: "campaign", mode: "campaign", icon: "bolt", title: "Tactician", goal: "Use 3 abilities in a mission win", test: (c) => c.win && (c.stats?.abilities || 0) >= 3 },
  { id: "df-win", group: "defence", mode: "defence", icon: "tower", title: "Hold the road", goal: "Win a Defence level", test: (c) => c.win && !c.scored },
  { id: "df-stars", group: "defence", mode: "defence", icon: "star", title: "Three stars", goal: "Earn 3 stars on a Defence level", test: (c) => (c.stars || 0) >= 3 },
  { id: "df-rank", group: "defence", mode: "defence", icon: "levelup", title: "Promotion", goal: "Raise the Field commander to Rank 3", test: (c) => (c.hero?.level || 0) >= 3 },
  { id: "df-waves", group: "defence", mode: "defence", icon: "chevrons", title: "Endurance", goal: "Hold 10 waves in Endless or Daily", test: (c) => c.scored && (c.score || 0) >= 10 },
]);
export const challengeById = (id) => CHALLENGES.find((c) => c.id === id) || null;

// The day's three: one per group, chosen by fnv1a(day + group). The same day always gives the same set.
export function dailyChallenges(day) {
  const key = DAY.test(day) ? day : "2026-01-01";
  return GROUPS.map((group) => {
    const pool = CHALLENGES.filter((c) => c.group === group);
    return pool[fnv1a(`${key}|${group}`) % pool.length];
  });
}

export function freshChallenges(day) { return { day, done: [], sets: 0, setDay: null }; }
// A clean state for `day`: another day's done list is dropped; ids not in today's set are dropped.
export function normalizeChallenges(raw, day) {
  const out = freshChallenges(day);
  if (!raw || typeof raw !== "object") return out;
  out.sets = Number.isInteger(raw.sets) && raw.sets > 0 ? Math.min(raw.sets, 100000) : 0;
  out.setDay = typeof raw.setDay === "string" && DAY.test(raw.setDay) ? raw.setDay : null;
  if (raw.day === day && Array.isArray(raw.done)) {
    const today = dailyChallenges(day).map((c) => c.id);
    out.done = [...new Set(raw.done.filter((id) => today.includes(id)))];
  }
  return out;
}
const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function loadChallenges(day, store = storage()) {
  try { return normalizeChallenges(JSON.parse(store?.getItem(CHALLENGE_KEY) || "null"), day); } catch { return freshChallenges(day); }
}
export function saveChallenges(state, store = storage()) {
  try { store.setItem(CHALLENGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

// A finished match against the day's set: { state, met: [challenge], xp, set } (`set` true when this match
// completed the third). A challenge already done today pays nothing again.
export function judgeChallenges(state, ctx, day) {
  const s = normalizeChallenges(state, day), today = dailyChallenges(day);
  const met = today.filter((c) => !s.done.includes(c.id) && c.mode === ctx?.mode && safe(c, ctx));
  if (!met.length) return { state: s, met: [], xp: 0, set: false };
  const done = [...s.done, ...met.map((c) => c.id)];
  const set = done.length === today.length && s.setDay !== day;
  return { state: { ...s, done, ...(set ? { sets: s.sets + 1, setDay: day } : {}) }, met, xp: met.length * CHALLENGE_XP, set };
}
function safe(c, ctx) { try { return !!c.test(ctx); } catch { return false; } }
