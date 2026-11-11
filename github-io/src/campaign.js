import { DIFFICULTIES, difficultyId } from "./difficulty.js";
// Campaign: the twelve story missions (src/story/missions.js) played in order. This module is
// the pure progress record: which missions are cleared, with the best time and best medal.
// Progress is kept in this browser only, under a new key; the older seven-stage record
// ('frontier-campaign-v1') is left untouched and those players start the story from mission 1.
import { MISSIONS } from "./story/missions.js";

export { MISSIONS };
// Act titles from docs/WORLD.md.
export const ACTS = [
  { act: 1, title: "Landfall" },
  { act: 2, title: "The Pact" },
  { act: 3, title: "The Keystone" },
];
export const MEDALS = ["bronze", "silver", "gold"];
const rank = (medal) => MEDALS.indexOf(medal);

const KEY = "frontier-campaign-v2";
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const validTime = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

// { cleared: { [missionId]: { time: seconds, medal: "bronze"|"silver"|"gold" } } }
export function loadProgress(store = storage()) {
  try {
    const cleared = JSON.parse(store?.getItem(KEY) || "{}").cleared;
    const out = {};
    // Keep only entries with a finite, non-negative time; anything else is corrupt.
    if (cleared && typeof cleared === "object")
      for (const [id, entry] of Object.entries(cleared))
        if (entry && typeof entry === "object" && validTime(entry.time))
          out[id] = { time: entry.time, medal: rank(entry.medal) >= 0 ? entry.medal : "bronze", difficulty: difficultyId(entry.difficulty) };
    return { cleared: out };
  } catch {
    return { cleared: {} };
  }
}
export function saveProgress(progress, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(progress)); } catch { /* private mode or full storage */ }
}
const entry = (progress, index) => (index >= 0 && index < MISSIONS.length && Object.hasOwn(progress.cleared, MISSIONS[index].id) ? progress.cleared[MISSIONS[index].id] : null);
// A stored time (even 0) means cleared.
export const isCleared = (progress, index) => validTime(entry(progress, index)?.time);
// Mission 1 is open; mission n+1 opens when mission n is cleared.
export const isUnlocked = (progress, index) => index === 0 || (index > 0 && index < MISSIONS.length && isCleared(progress, index - 1));
export const bestTime = (progress, index) => (isCleared(progress, index) ? entry(progress, index).time : null);
export const bestMedal = (progress, index) => (isCleared(progress, index) ? entry(progress, index).medal : null);
// Keeps the best (shortest) time and the best medal, each on its own.
export function recordClear(progress, index, time, medal = "bronze", difficulty = "standard") {
  const id = MISSIONS[index].id, old = isCleared(progress, index) ? progress.cleared[id] : null;
  const earned = rank(medal) >= 0 ? medal : "bronze";
  return {
    cleared: {
      ...progress.cleared,
      [id]: {
        difficulty: DIFFICULTIES[Math.max(old ? DIFFICULTIES.indexOf(difficultyId(old.difficulty)) : 0, DIFFICULTIES.indexOf(difficultyId(difficulty)))],
        time: old ? Math.min(old.time, time) : time,
        medal: old && rank(old.medal) > rank(earned) ? old.medal : earned,
      },
    },
  };
}
// The first open mission that is not cleared yet; the last one when everything is.
export const nextMission = (progress) => {
  const open = MISSIONS.findIndex((_, i) => isUnlocked(progress, i) && !isCleared(progress, i));
  return open < 0 ? MISSIONS.length - 1 : open;
};
export const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
