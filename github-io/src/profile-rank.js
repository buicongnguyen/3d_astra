// Commander rank and unlocks (AAA round 3, R3-R). Pure: no DOM, no stylesheet, so Node tests and the
// view plugin registry can import it. The page side (title chip, skirmish pickers, results toast) is
// src/rank-ui.js.
//
// Every finished match gives XP (xpForMatch); about twenty ranks (RANKS) each unlock one cosmetic or
// choice item (ITEMS): a paint scheme for the player's units, an emblem, a title banner or a Daily
// order (a pledge judged after a win for bonus XP). Nothing here reaches the simulation: no pick is a
// rule, nothing is written into options.rules, and the paint is a tint the view multiplies into the
// batches' instanceColor (RankPaintView below), so every pin is identical with any pick.
//
// The profile lives in localStorage under PROFILE_KEY, read and written in try/catch: blocked storage
// keeps the rank for the visit only.

export const PROFILE_KEY = "frontier-command.rank.v1";
export const MAX_RANK = 20;

// XP to reach rank r (rank 1 at 0): 100, 250, 450, 700 ... 10,450 at rank 20.
export const xpForRank = (rank) => 25 * (rank - 1) * (rank + 2);

export const RANK_NAMES = [
  "Recruit", "Private", "Lance Corporal", "Corporal", "Sergeant", "Staff Sergeant", "Warrant Officer", "Ensign",
  "Second Lieutenant", "Lieutenant", "Captain", "Major", "Lieutenant Colonel", "Colonel", "Brigadier",
  "Major General", "Lieutenant General", "General", "Marshal", "Frontier Marshal",
];

// The unlock items. `rank` is the rank that unlocks it (1 = from the start, the default of its kind).
// paint.tint multiplies the colour of every part of the player's units (instanceColor); swatch is its UI colour.
export const ITEMS = {
  paint: [
    { id: "factory", label: "Factory", rank: 1, tint: null, swatch: "#92ebc5" },
    { id: "sand", label: "Sand", rank: 2, tint: [1.3, 1.0, 0.56], swatch: "#e0b679" },
    { id: "arctic", label: "Arctic", rank: 6, tint: [0.78, 1.04, 1.4], swatch: "#bfe3ff" },
    { id: "ember", label: "Ember", rank: 10, tint: [1.45, 0.72, 0.48], swatch: "#ef8a5c" },
    { id: "jungle", label: "Jungle", rank: 14, tint: [0.68, 1.18, 0.56], swatch: "#7fc06a" },
    { id: "night", label: "Night", rank: 18, tint: [0.5, 0.64, 1.12], swatch: "#4f72b4" },
    { id: "gold", label: "Gold", rank: 20, tint: [1.45, 1.1, 0.36], swatch: "#ffd17b" },
  ],
  emblem: [
    { id: "ring", label: "Meridian ring", rank: 1 },
    { id: "spear", label: "Spearhead", rank: 3 },
    { id: "wings", label: "Wings", rank: 7 },
    { id: "star", label: "Star", rank: 11 },
    { id: "crown", label: "Crown", rank: 15 },
    { id: "phoenix", label: "Phoenix", rank: 19 },
  ],
  banner: [
    { id: "field", label: "Field Commander", rank: 1 },
    { id: "vanguard", label: "Vanguard", rank: 4 },
    { id: "pathfinder", label: "Pathfinder", rank: 8 },
    { id: "iron", label: "Iron Marshal", rank: 12 },
    { id: "legend", label: "Frontier Legend", rank: 16 },
    { id: "meridian", label: "Hero of the Meridian", rank: 20 },
  ],
  // Daily orders: an optional pledge, judged from the match counters after a win. Met once a day, it adds
  // PLEDGE_XP. It never changes the battle.
  pledge: [
    { id: "none", label: "None", rank: 1, help: "No pledge." },
    { id: "ironline", label: "Iron line", rank: 5, help: "Win losing 5 units or fewer." },
    { id: "swift", label: "Swift", rank: 9, help: "Win within 12 minutes." },
    { id: "lean", label: "Lean", rank: 13, help: "Win building 6 structures or fewer." },
    { id: "hunter", label: "Hunter", rank: 17, help: "Win with 40 kills or more." },
  ],
};
export const KINDS = Object.keys(ITEMS);
export const KIND_LABELS = { paint: "Paint", emblem: "Emblem", banner: "Title banner", pledge: "Daily order" };
// The label an unlock is announced with ("Sand paint").
export const UNLOCK_LABELS = { paint: "paint", emblem: "emblem", banner: "banner", pledge: "Daily order" };

export const PLEDGE_XP = 60;
const PLEDGE_MET = {
  none: () => false,
  ironline: (s) => (s.stats?.lost ?? Infinity) <= 5,
  swift: (s) => Number.isFinite(s.seconds) && s.seconds <= 720,
  lean: (s) => (s.stats?.built ?? Infinity) <= 6,
  hunter: (s) => (s.stats?.killed ?? 0) >= 40,
};

export const RANKS = RANK_NAMES.map((name, i) => ({
  rank: i + 1, name, xp: xpForRank(i + 1),
  unlocks: KINDS.flatMap((kind) => ITEMS[kind].filter((item) => item.rank === i + 1 && i > 0).map((item) => ({ kind, ...item }))),
}));

// XP for one finished match (the onMatchEnd summary of src/ceremony-rules.js). Every part is listed so
// the results can show where the XP came from.
//   played 25 · win 75 (Training finished counts as a win) · Veteran win +25
//   medal: bronze 20, silver 35, gold 50 · Defence stars 20 each · Endless / Daily waves held 5 each (max 50 waves)
//   kills 1 per 2 (max 25) · Daily order met +60 (once a day) · at most 400 a match
export const XP = { played: 25, win: 75, veteran: 25, medal: { bronze: 20, silver: 35, gold: 50 }, star: 20, wave: 5, maxWaves: 50, killsPer: 2, maxKills: 25, cap: 400 };
export function xpForMatch(summary = {}, { pledge = "none", pledgeReady = true } = {}) {
  const parts = [];
  const add = (label, xp) => { if (xp > 0) parts.push({ label, xp: Math.round(xp) }); };
  const scored = Number.isFinite(summary.score);
  const win = summary.mode === "training" ? !!summary.tutorialDone : !!summary.win || scored;
  add("Match played", XP.played);
  if (win) add(summary.mode === "training" ? "Training complete" : "Victory", XP.win);
  if (win && summary.difficulty === "veteran") add("Veteran", XP.veteran);
  if (summary.medal && XP.medal[summary.medal]) add("Medal", XP.medal[summary.medal]);
  if (Number.isFinite(summary.stars)) add("Defence stars", summary.stars * XP.star);
  if (scored) add("Waves held", Math.min(XP.maxWaves, Math.max(0, summary.score)) * XP.wave);
  add("Kills", Math.min(XP.maxKills, Math.floor((summary.stats?.killed ?? 0) / XP.killsPer)));
  const met = win && pledgeReady && pledge !== "none" && !!PLEDGE_MET[pledge]?.(summary);
  if (met) add("Daily order", PLEDGE_XP);
  const raw = parts.reduce((sum, p) => sum + p.xp, 0);
  return { total: Math.min(XP.cap, raw), parts, pledgeMet: met };
}

// Rank, progress and the XP bounds of a total.
export function rankOf(xp = 0) {
  let rank = 1;
  while (rank < MAX_RANK && xp >= xpForRank(rank + 1)) rank++;
  const floor = xpForRank(rank), next = rank < MAX_RANK ? xpForRank(rank + 1) : null;
  return { rank, name: RANK_NAMES[rank - 1], xp, floor, next, progress: next ? (xp - floor) / (next - floor) : 1 };
}

export const itemOf = (kind, id) => ITEMS[kind]?.find((item) => item.id === id) || null;
export const isUnlocked = (kind, id, rank) => (itemOf(kind, id)?.rank ?? Infinity) <= rank;
// The items unlocked going from rank `from` to rank `to` (both inclusive of `to`, exclusive of `from`).
export const unlocksBetween = (from, to) => RANKS.filter((r) => r.rank > from && r.rank <= to).flatMap((r) => r.unlocks);

const DEFAULT_PICKS = Object.freeze(Object.fromEntries(KINDS.map((kind) => [kind, ITEMS[kind][0].id])));
export function freshProfile() { return { xp: 0, matches: 0, picks: { ...DEFAULT_PICKS }, pledgeDay: null }; }

// A clean profile from anything stored: known picks the rank has unlocked, else each kind's default.
export function normalizeProfile(raw) {
  const out = freshProfile();
  if (!raw || typeof raw !== "object") return out;
  out.xp = Number.isFinite(raw.xp) && raw.xp > 0 ? Math.floor(raw.xp) : 0;
  out.matches = Number.isInteger(raw.matches) && raw.matches > 0 ? raw.matches : 0;
  out.pledgeDay = typeof raw.pledgeDay === "string" && /^\d{4}-\d\d-\d\d$/.test(raw.pledgeDay) ? raw.pledgeDay : null;
  const { rank } = rankOf(out.xp);
  for (const kind of KINDS) if (isUnlocked(kind, raw.picks?.[kind], rank)) out.picks[kind] = raw.picks[kind];
  return out;
}

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function loadProfile(store = storage()) {
  try { return normalizeProfile(JSON.parse(store?.getItem(PROFILE_KEY) || "null")); } catch { return freshProfile(); }
}
// True when stored. Blocked storage fails silently: the rank lasts for the visit.
export function saveProfile(profile, store = storage()) {
  try { store.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile))); return true; } catch { return false; }
}

// A pick (only an unlocked item changes it): a new profile.
export function withPick(profile, kind, id) {
  if (!isUnlocked(kind, id, rankOf(profile.xp).rank)) return profile;
  return { ...profile, picks: { ...profile.picks, [kind]: id } };
}

export function localDay(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// One finished match into the profile: { profile, gained, parts, before, after, unlocked, rankUp, pledgeMet }.
export function recordMatch(profile, summary, { day = localDay() } = {}) {
  const before = rankOf(profile.xp);
  const { total, parts, pledgeMet } = xpForMatch(summary, { pledge: profile.picks.pledge, pledgeReady: profile.pledgeDay !== day });
  const next = { ...profile, xp: profile.xp + total, matches: profile.matches + 1, pledgeDay: pledgeMet ? day : profile.pledgeDay };
  const after = rankOf(next.xp);
  return { profile: next, gained: total, parts, before, after, unlocked: unlocksBetween(before.rank, after.rank), rankUp: after.rank > before.rank, pledgeMet };
}

// ---- The paint on the battlefield: a view plugin (src/view-plugins.js). The player's units (team 0)
// get the picked scheme's tint on every model part; the entity batches copy part.userData.tint into
// instanceColor, so a scheme costs no material, batch or draw call. The Factory scheme sets nothing:
// the frame is exactly what it was before this package. Hit flashes keep working (view.js
// setFlashTint remembers the tint as the part's base).
let currentPaint = "factory";
const views = new Set();
export const paintTint = (id = currentPaint) => itemOf("paint", id)?.tint || null;
export const activePaint = () => currentPaint;
export function setActivePaint(id) {
  const next = itemOf("paint", id) ? id : "factory";
  if (next === currentPaint) return;
  currentPaint = next;
  for (const plugin of views) plugin.repaint();
}

function tintModel(root, tint) {
  const u = root.userData, model = u.model;
  if (!model?.traverse) return;
  const parts = [];
  model.traverse((part) => { if (part.isMesh) parts.push(part); });
  for (const part of parts) {
    if (tint) part.userData.tint = tint; else delete part.userData.tint;
  }
  // A unit that flashed before keeps its base list (view.js setFlashTint): the new paint is its base now.
  if (u.flashParts) u.flashBase = u.flashParts.map(() => tint || undefined);
  if (u.flashLit && u.flashParts) for (const part of u.flashParts) part.userData.tint = u.flashTint;
}

export class RankPaintView {
  constructor(view) { this.view = view; views.add(this); }
  dress(root, e) {
    if (e.team !== 0 || e.kind !== "unit") return;
    root.userData.rankPaint = true;
    const tint = paintTint();
    if (tint) tintModel(root, tint);
  }
  repaint() {
    const tint = paintTint();
    for (const root of this.view.objects?.values?.() || []) if (root.userData.rankPaint) tintModel(root, tint);
  }
}
