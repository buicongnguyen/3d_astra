// H8 Hero challenges: the best stars of each challenge, kept on this device (src/hero-challenges-ui.js shows them on
// the title row and pays the new ones in coins, src/meta/coins.js). localStorage PROGRESS_KEY =
// { best: { [challenge id]: 0..3 }, played: n }; a broken or foreign value is cleaned, never thrown.
import { HERO_CHALLENGES } from "../story/hero-challenges.js";

export const PROGRESS_KEY = "frontier-hero-challenges-v1";
const whole = (n) => (Number.isFinite(n) && n > 0 ? Math.min(3, Math.floor(n)) : 0);
const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadProgress(store = storage()) {
  try {
    const raw = JSON.parse(store?.getItem(PROGRESS_KEY) || "null");
    const best = {};
    for (const m of HERO_CHALLENGES) best[m.challenge.id] = whole(raw?.best?.[m.challenge.id]);
    return { best, played: Number.isFinite(raw?.played) ? Math.max(0, Math.floor(raw.played)) : 0 };
  } catch {
    return { best: Object.fromEntries(HERO_CHALLENGES.map((m) => [m.challenge.id, 0])), played: 0 };
  }
}
export function saveProgress(p, store = storage()) {
  try { store?.setItem(PROGRESS_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
// The progress after a run with `stars`: the new best, and how many stars are better than the best before.
export function recordRun(p, id, stars) {
  const was = p.best[id] || 0, now = Math.max(was, whole(stars));
  return { progress: { best: { ...p.best, [id]: now }, played: p.played + 1 }, fresh: now - was };
}
