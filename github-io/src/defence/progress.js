// Frontier Defence progress, kept in this browser only (like src/campaign.js):
// localStorage 'frontier-defence-v1' = {
//   levels: { [levelId]: { stars, lives, difficulty } },
//   perks: [perkId],                         (0.21: bought with stars, see GARRISONS.perks)
//   endless: { [levelId]: bestWavesHeld },   (0.21)
//   daily: { [YYYY-MM-DD]: { [levelId]: bestWavesHeld } }   (0.21, the last DAILY_KEEP days)
// }
// The best stars and the best lives are kept, each on its own, with the hardest difficulty cleared.
// The 0.21 keys are written only once they hold something, so older progress reads the same.
import { DIFFICULTIES, difficultyId } from "../difficulty.js";
import { DEFENCE_LEVELS } from "./levels.js";
import GARRISONS from "./garrisons.json" with { type: "json" };
import { seedOf } from "../sim/defence.js";

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
// Leaves out the 0.21 keys while they are empty.
function shaped(levels, perks = [], endless = {}, daily = {}) {
  return { levels, ...(perks.length ? { perks } : {}), ...(Object.keys(endless).length ? { endless } : {}), ...(Object.keys(daily).length ? { daily } : {}) };
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
    return shaped(out, perks, scores(raw.endless), daily);
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
export const totalStars = (progress) => DEFENCE_LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);

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
