// Frontier Defence progress, kept in this browser only (like src/campaign.js):
// localStorage 'frontier-defence-v1' = {
//   levels: { [levelId]: { stars, lives, difficulty } },
//   perks: [perkId],                         (0.21: bought with stars, see GARRISONS.perks)
//   endless: { [levelId]: bestWavesHeld },   (0.21)
//   daily: { [YYYY-MM-DD]: { [levelId]: bestWavesHeld } }   (0.21, the last DAILY_KEEP days)
//   seen: [unitType],                        (AAA round 2 W1-F: enemy types whose new-enemy card was shown)
//   heroic: { [levelId]: { won, lives } },   (AAA round 2 W2-B: Heroic wins, +1 star each; written once something is recorded)
//   guided: true,                            (AAA round 3 R3-E: the guided first build was finished or skipped; written only then)
//   board: { [levelId]: [{ wave, score, date, branch, rank }] },   (W10: the Endless top ten of each map, best first;
//                                            written once a run is recorded; `seen` may also hold "kind:<id>" for a wave kind's card)
// }
// The best stars and the best lives are kept, each on its own, with the hardest difficulty cleared.
// The 0.21 keys are written only once they hold something, so older progress reads the same.
import { DIFFICULTIES, difficultyId } from "../difficulty.js";
import { DEFENCE_LEVELS } from "./levels.js";
import { hasHeroic } from "./heroic.js";
import GARRISONS from "./garrisons.json" with { type: "json" };
import { seedOf } from "../sim/defence.js";
import { DEFINITIONS as D } from "../data.js";
import KINDS from "./kinds.json" with { type: "json" };

// The wave kinds a "kind:<id>" card may name (W10; kinds.json, not traits.js, so this always-loaded module stays small).
const KIND_IDS = Object.keys(KINDS).filter((k) => k !== "about" && !KINDS[k].child);

export const DEFENCE_KEY = "frontier-defence-v1";
export const PERKS = GARRISONS.perks;
const DAILY_KEEP = 7;
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const whole = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const scores = (o) => {
  const out = {};
  if (o && typeof o === "object") for (const [id, v] of Object.entries(o)) if (DEFENCE_LEVELS.some((l) => l.id === id) && whole(v, 9999)) out[id] = v;
  return out;
};
// Leaves out the 0.21 keys (and `seen`) while they are empty.
function shaped(levels, perks = [], endless = {}, daily = {}, seen = [], heroic = {}, guided = false, board = {}) {
  return { levels, ...(perks.length ? { perks } : {}), ...(Object.keys(endless).length ? { endless } : {}), ...(Object.keys(daily).length ? { daily } : {}), ...(seen.length ? { seen } : {}), ...(Object.keys(heroic).length ? { heroic } : {}), ...(guided ? { guided: true } : {}), ...(Object.keys(board).length ? { board } : {}) };
}

export function loadDefence(store = storage()) {
  try {
    const raw = JSON.parse(store?.getItem(DEFENCE_KEY) || "{}"), levels = raw.levels, out = {};
    if (levels && typeof levels === "object")
      for (const [id, entry] of Object.entries(levels)) {
        const stars = whole(entry?.stars, 3), lives = whole(entry?.lives, 99);
        // Anything else is corrupt and dropped.
        if (stars !== null && stars > 0 && lives !== null) out[id] = { stars, lives, difficulty: difficultyId(entry.difficulty) };
      }
    const perks = Array.isArray(raw.perks) ? [...new Set(raw.perks.filter((p) => Object.hasOwn(PERKS, p)))] : [];
    const daily = {};
    if (raw.daily && typeof raw.daily === "object")
      for (const date of Object.keys(raw.daily).filter((d) => DATE.test(d)).sort().slice(-DAILY_KEEP)) { const s = scores(raw.daily[date]); if (Object.keys(s).length) daily[date] = s; }
    // Only real unit types are kept: a hand-edited record cannot bring in a name the game does not know.
    const seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((t) => typeof t === "string" && (Object.hasOwn(D, t) || (t.startsWith("kind:") && KIND_IDS.includes(t.slice(5))))))] : [];
    const heroic = {};
    if (raw.heroic && typeof raw.heroic === "object")
      for (const [id, v] of Object.entries(raw.heroic)) if (hasHeroic(id) && v?.won === true && whole(v.lives, 99) !== null) heroic[id] = { won: true, lives: v.lives };
    return shaped(out, perks, scores(raw.endless), daily, seen, heroic, raw.guided === true, readBoard(raw.board));
  } catch {
    return { levels: {} };
  }
}
export function saveDefence(progress, store = storage()) {
  try { store?.setItem(DEFENCE_KEY, JSON.stringify(progress)); } catch { /* private mode or full storage */ }
}
// A win: keeps the best stars, the most lives and the hardest difficulty, each on its own.
export function recordDefence(progress, id, { stars, lives, difficulty = "standard" }) {
  if (!(stars > 0)) return progress;
  const old = progress.levels[id];
  const hardest = DIFFICULTIES[Math.max(old ? DIFFICULTIES.indexOf(difficultyId(old.difficulty)) : 0, DIFFICULTIES.indexOf(difficultyId(difficulty)))];
  return { ...progress, levels: { ...progress.levels, [id]: { stars: Math.max(old?.stars || 0, stars), lives: Math.max(old?.lives || 0, lives), difficulty: hardest } } };
}
export const starsOf = (progress, id) => progress.levels[id]?.stars || 0;
// The first OPEN_FROM_START levels are open; each later one opens once the one before it has a star.
export const OPEN_FROM_START = 2;
export const levelOpen = (progress, index) => index >= 0 && index < DEFENCE_LEVELS.length && (index < OPEN_FROM_START || starsOf(progress, DEFENCE_LEVELS[index - 1].id) > 0);
// Heroic (W2-B): opens after the first clear of that level; each win is worth one more star.
export const heroicOpen = (progress, id) => hasHeroic(id) && starsOf(progress, id) > 0;
export const heroicWon = (progress, id) => !!progress.heroic?.[id]?.won;
export const totalStars = (progress) => DEFENCE_LEVELS.reduce((n, l) => n + starsOf(progress, l.id) + (heroicWon(progress, l.id) ? 1 : 0), 0);
export function recordHeroic(progress, id, { lives }) {
  if (!hasHeroic(id)) return progress;
  const old = progress.heroic?.[id];
  return { ...progress, heroic: { ...(progress.heroic || {}), [id]: { won: true, lives: Math.max(old?.lives || 0, lives) } } };
}

// ---------------------------------------------------------------- Perks (0.21)
// Stars buy small permanent perks; a perk is bought once and spends its stars for good. They apply
// to the Defence menu's levels only (src/defence/levels.js defenceVariant), never to the campaign.
export const ownedPerks = (progress) => progress.perks || [];
export const starsSpent = (progress) => ownedPerks(progress).reduce((n, id) => n + (PERKS[id]?.stars || 0), 0);
export const starsFree = (progress) => totalStars(progress) - starsSpent(progress);
export const canBuyPerk = (progress, id) => Object.hasOwn(PERKS, id) && !ownedPerks(progress).includes(id) && starsFree(progress) >= PERKS[id].stars;
export function buyPerk(progress, id) {
  return canBuyPerk(progress, id) ? { ...progress, perks: [...ownedPerks(progress), id] } : progress;
}

// ---------------------------------------------------------------- Endless and the Daily seed (0.21)
// The day as the player's own calendar shows it, YYYY-MM-DD: everyone gets the same waves that day.
export function dayKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
export const dailySeed = (day) => seedOf(`frontier-daily:${day}`);
export const endlessSeed = (levelId) => seedOf(levelId);
export function bestScore(progress, variant, levelId, day = dayKey()) {
  return (variant === "daily" ? progress.daily?.[day]?.[levelId] : progress.endless?.[levelId]) || 0;
}
// Keeps the most waves held; older daily entries beyond DAILY_KEEP days are dropped.
export function recordScore(progress, variant, levelId, score, day = dayKey()) {
  if (!(score > bestScore(progress, variant, levelId, day))) return progress;
  if (variant === "daily") {
    const daily = { ...(progress.daily || {}), [day]: { ...(progress.daily?.[day] || {}), [levelId]: score } };
    for (const old of Object.keys(daily).sort().slice(0, -DAILY_KEEP)) delete daily[old];
    return { ...progress, daily };
  }
  return { ...progress, endless: { ...(progress.endless || {}), [levelId]: score } };
}

// ---------------------------------------------------------------- New-enemy cards (AAA round 2, W1-F)
// The enemy types a player has met in a Defence wave: their card was shown once. The key is written only
// once something is recorded, so progress that never saw a card reads and saves exactly as before.
export const hasSeen = (progress, type) => (progress.seen || []).includes(type);
export function recordSeen(progress, types) {
  const fresh = [...new Set(types)].filter((t) => Object.hasOwn(D, t) && !hasSeen(progress, t));
  return fresh.length ? { ...progress, seen: [...(progress.seen || []), ...fresh] } : progress;
}

// ---------------------------------------------------------------- Guided first build (AAA round 3, R3-E)
// Three coach steps (tap the glowing pad, pick a crew, call the wave) on a profile with no Defence win.
// Done once finished or skipped; `guided` is written only then, so older progress reads and saves the same.
export const hasDefenceWin = (progress) => Object.keys(progress.levels || {}).length > 0;
export const guideWanted = (progress) => !progress.guided && !hasDefenceWin(progress);
export const recordGuided = (progress) => (progress.guided ? progress : { ...progress, guided: true });

// ---------------------------------------------------------------- Endless leaderboard (W10, Defence 6.7)
// The ten best Endless runs of each map, kept in this browser: { wave, score, date, branch, rank } with wave the
// waves held, score = waves held x 100 + enemies defeated, date YYYY-MM-DD, branch the commander's branch
// ("artillery", "rally" or "" for none) and rank its rank (1 to 3). Best score first; a tie goes to more waves, then
// to the earlier run. Anything malformed in storage is dropped, so a hand-edited record cannot break the menu.
export const BOARD_SIZE = 10;
export const BRANCHES = ["", "artillery", "rally"];
export const endlessScore = (held, killed = 0) => Math.max(0, Math.floor(held)) * 100 + Math.max(0, Math.floor(killed));
const byRank = (a, b) => b.score - a.score || b.wave - a.wave || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
function runOf(v) {
  if (!v || typeof v !== "object") return null;
  const wave = whole(v.wave, 9999), score = whole(v.score, 9999999), rank = whole(v.rank ?? 1, 3);
  if (wave === null || score === null || !rank || typeof v.date !== "string" || !DATE.test(v.date)) return null;
  const branch = BRANCHES.includes(v.branch ?? "") ? v.branch ?? "" : null;
  return branch === null ? null : { wave, score, date: v.date, branch, rank };
}
function readBoard(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, list] of Object.entries(raw)) {
    if (!DEFENCE_LEVELS.some((l) => l.id === id) || !Array.isArray(list)) continue;
    const runs = list.map(runOf).filter(Boolean).sort(byRank).slice(0, BOARD_SIZE);
    if (runs.length) out[id] = runs;
  }
  return out;
}
export const boardOf = (progress, levelId) => progress.board?.[levelId] || [];
// One finished Endless run into the board: { progress, place } (place 1 to 10, or 0 when it did not make the top ten).
export function recordRun(progress, levelId, run) {
  const r = runOf({ date: dayKey(), ...run });
  if (!r || !DEFENCE_LEVELS.some((l) => l.id === levelId)) return { progress, place: 0 };
  const list = [...boardOf(progress, levelId), r].sort(byRank), place = list.indexOf(r) + 1;
  if (place > BOARD_SIZE) return { progress, place: 0 };
  return { progress: { ...progress, board: { ...(progress.board || {}), [levelId]: list.slice(0, BOARD_SIZE) } }, place };
}
