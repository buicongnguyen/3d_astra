import { DIFFICULTIES, difficultyId } from "./difficulty.js";
// Campaign: the twelve story missions (src/story/missions.js) played in order. This module is
// the pure progress record: which missions are cleared, with the best time and best medal, the
// Commander's decisions and the endings seen. Progress is kept in this browser only, under a new
// key; the older seven-stage record ('frontier-campaign-v1') is left untouched and those players
// start the story from mission 1.
import { MISSIONS } from "./story/missions.js";
import { resolveMission, endingFor, ENDINGS, chronicleDone } from "./story/choices.js";
import { CHRONICLES, chronicleById } from "./story/chronicles.js";

export { MISSIONS, resolveMission, endingFor };
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
const isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// {
//   cleared: { [missionId]: { time: seconds, medal: "bronze"|"silver"|"gold", difficulty } },
//   decisions?: { [decisionId]: optionId },      since 0.19a, written on a mission win
//   endingsSeen?: [endingId],                    since 0.19a, written when the finale is won
//   chronicles?: { [id]: { cleared, done, best } }, since 0.20, kept as stored (see recordIn)
//   ...any other field a newer version wrote is kept as it is.
// }
// Fields other than `cleared` appear only once something was recorded, so older progress reads
// back exactly as it was stored.
export function loadProgress(store = storage()) {
  try {
    const raw = JSON.parse(store?.getItem(KEY) || "{}");
    const data = isRecord(raw) ? raw : {};
    const out = {};
    // Keep only entries with a finite, non-negative time; anything else is corrupt.
    if (isRecord(data.cleared))
      for (const [id, entry] of Object.entries(data.cleared))
        if (entry && typeof entry === "object" && validTime(entry.time))
          out[id] = { time: entry.time, medal: rank(entry.medal) >= 0 ? entry.medal : "bronze", difficulty: difficultyId(entry.difficulty) };
    const progress = { ...data, cleared: out };
    if (isRecord(data.decisions)) progress.decisions = Object.fromEntries(Object.entries(data.decisions).filter(([, option]) => typeof option === "string"));
    else delete progress.decisions;
    if (Array.isArray(data.endingsSeen)) progress.endingsSeen = [...new Set(data.endingsSeen.filter((id) => Object.hasOwn(ENDINGS, id)))];
    else delete progress.endingsSeen;
    if (!isRecord(data.chronicles)) delete progress.chronicles;
    return progress;
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
// Mission 1 is open; a mission opens when it is cleared itself or the one before it is. Keyed by
// mission id, so a mission inserted later never locks one the player has already cleared.
export const isUnlocked = (progress, index) => index === 0 || (index > 0 && index < MISSIONS.length && (isCleared(progress, index) || isCleared(progress, index - 1)));
export const bestTime = (progress, index) => (isCleared(progress, index) ? entry(progress, index).time : null);
export const bestMedal = (progress, index) => (isCleared(progress, index) ? entry(progress, index).medal : null);
// Keeps the best (shortest) time and the best medal, each on its own. Every other field stays.
export function recordClear(progress, index, time, medal = "bronze", difficulty = "standard") {
  const id = MISSIONS[index].id, old = isCleared(progress, index) ? progress.cleared[id] : null;
  const earned = rank(medal) >= 0 ? medal : "bronze";
  return {
    ...progress,
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
// The decisions a won mission made (sim.flags). A replayed mission's new answer replaces the old one.
export function recordDecisions(progress, flags) {
  const answers = Object.entries(flags || {}).filter(([, option]) => typeof option === "string");
  return answers.length ? { ...progress, decisions: { ...progress.decisions, ...Object.fromEntries(answers) } } : progress;
}
export function recordEnding(progress, ending) {
  if (!Object.hasOwn(ENDINGS, ending)) return progress;
  const seen = progress.endingsSeen || [];
  return seen.includes(ending) ? progress : { ...progress, endingsSeen: [...seen, ending] };
}
// The first open mission that is not cleared yet; the last one when everything is.
export const nextMission = (progress) => {
  const open = MISSIONS.findIndex((_, i) => isUnlocked(progress, i) && !isCleared(progress, i));
  return open < 0 ? MISSIONS.length - 1 : open;
};
export const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
// Where a mission id lives: { campaign: "main" or a chronicle id, index in that campaign, mission }.
export function missionById(id) {
  const index = missionIndex(id);
  if (index >= 0) return { campaign: "main", index, mission: MISSIONS[index] };
  for (const c of CHRONICLES) {
    const i = c.missions.findIndex((m) => m.id === id);
    if (i >= 0) return { campaign: c.id, index: i, mission: c.missions[i] };
  }
  return null;
}

// ---------------------------------------------------------------- Faction Chronicles (0.20)
// progress.chronicles = { [chronicleId]: { cleared: [missionId], done: bool, best?: { [missionId]: { time, medal, difficulty } } } }
// written on a chronicle win only. The record is kept exactly as stored on load (like every other
// field); these readers ignore anything malformed in it.
export { CHRONICLES, chronicleById, chronicleDone };
const chronicleRecord = (progress, id) => (isRecord(progress?.chronicles?.[id]) ? progress.chronicles[id] : {});
const chronicleCleared = (progress, id) => (Array.isArray(chronicleRecord(progress, id).cleared) ? chronicleRecord(progress, id).cleared.filter((x) => typeof x === "string") : []);
// A chronicle opens once its `unlockAfter` main mission (the end of Act 1) is cleared.
export const chronicleUnlocked = (progress, id) => { const c = chronicleById(id), i = c ? missionIndex(c.unlockAfter) : -1; return i >= 0 && isCleared(progress, i); };
// Missions cleared in a chronicle, 0 to 3, counted against today's mission list.
export const chronicleCount = (progress, id) => { const done = new Set(chronicleCleared(progress, id)); return (chronicleById(id)?.missions || []).filter((m) => done.has(m.id)).length; };

// One reading of progress for any campaign ("main" or a chronicle id), by index in that campaign.
export const missionsOf = (campaign = "main") => (campaign === "main" ? MISSIONS : chronicleById(campaign)?.missions || []);
export function clearedIn(progress, campaign, index) {
  if (campaign === "main") return isCleared(progress, index);
  const m = missionsOf(campaign)[index];
  return !!m && chronicleCleared(progress, campaign).includes(m.id);
}
// Inside a chronicle the first mission opens with the chronicle; each next one when the one before is cleared.
export function unlockedIn(progress, campaign, index) {
  if (campaign === "main") return isUnlocked(progress, index);
  if (!chronicleUnlocked(progress, campaign) || index < 0 || index >= missionsOf(campaign).length) return false;
  return index === 0 || clearedIn(progress, campaign, index) || clearedIn(progress, campaign, index - 1);
}
export function bestIn(progress, campaign, index) {
  if (campaign === "main") return isCleared(progress, index) ? progress.cleared[MISSIONS[index].id] : null;
  const m = missionsOf(campaign)[index], best = m && clearedIn(progress, campaign, index) ? chronicleRecord(progress, campaign).best?.[m.id] : null;
  return best && validTime(best.time) ? { time: best.time, medal: rank(best.medal) >= 0 ? best.medal : "bronze", difficulty: difficultyId(best.difficulty) } : null;
}
export const nextIn = (progress, campaign = "main") => {
  if (campaign === "main") return nextMission(progress);
  const list = missionsOf(campaign), open = list.findIndex((_, i) => unlockedIn(progress, campaign, i) && !clearedIn(progress, campaign, i));
  return open < 0 ? Math.max(0, list.length - 1) : open;
};
// A won mission of any campaign. A chronicle keeps its cleared ids and best result per mission,
// and is `done` once every one of its missions is cleared. Every other field stays.
export function recordIn(progress, campaign, index, time, medal = "bronze", difficulty = "standard") {
  if (campaign === "main") return recordClear(progress, index, time, medal, difficulty);
  const c = chronicleById(campaign), m = c?.missions[index];
  if (!m) return progress;
  const old = chronicleRecord(progress, campaign), was = bestIn(progress, campaign, index), earned = rank(medal) >= 0 ? medal : "bronze";
  const cleared = [...new Set([...chronicleCleared(progress, campaign), m.id])];
  const best = {
    ...(isRecord(old.best) ? old.best : {}),
    [m.id]: {
      difficulty: DIFFICULTIES[Math.max(was ? DIFFICULTIES.indexOf(was.difficulty) : 0, DIFFICULTIES.indexOf(difficultyId(difficulty)))],
      time: was ? Math.min(was.time, time) : time,
      medal: was && rank(was.medal) > rank(earned) ? was.medal : earned,
    },
  };
  const done = c.missions.every((x) => cleared.includes(x.id));
  return { ...progress, chronicles: { ...(isRecord(progress.chronicles) ? progress.chronicles : {}), [campaign]: { ...old, cleared, done: old.done === true || done, best } } };
}
