// Frontier Defence progress, kept in this browser only (like src/campaign.js):
// localStorage 'frontier-defence-v1' = { levels: { [levelId]: { stars, lives, difficulty } } }.
// The best stars and the best lives are kept, each on its own, with the hardest difficulty cleared.
import { DIFFICULTIES, difficultyId } from "../difficulty.js";
import { DEFENCE_LEVELS } from "./levels.js";

export const DEFENCE_KEY = "frontier-defence-v1";
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const whole = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

export function loadDefence(store = storage()) {
  try {
    const levels = JSON.parse(store?.getItem(DEFENCE_KEY) || "{}").levels, out = {};
    if (levels && typeof levels === "object")
      for (const [id, entry] of Object.entries(levels)) {
        const stars = whole(entry?.stars, 3), lives = whole(entry?.lives, 99);
        // Anything else is corrupt and dropped.
        if (stars !== null && stars > 0 && lives !== null) out[id] = { stars, lives, difficulty: difficultyId(entry.difficulty) };
      }
    return { levels: out };
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
  return { levels: { ...progress.levels, [id]: { stars: Math.max(old?.stars || 0, stars), lives: Math.max(old?.lives || 0, lives), difficulty: hardest } } };
}
export const starsOf = (progress, id) => progress.levels[id]?.stars || 0;
// The first OPEN_FROM_START levels are open; each later one opens once the one before it has a star.
export const OPEN_FROM_START = 2;
export const levelOpen = (progress, index) => index >= 0 && index < DEFENCE_LEVELS.length && (index < OPEN_FROM_START || starsOf(progress, DEFENCE_LEVELS[index - 1].id) > 0);
export const totalStars = (progress) => DEFENCE_LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);
