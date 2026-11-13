// Commander decisions and the two endings (story rules: docs/aaa/PLAN_ROUND3_REFINED_2026-11-13.md,
// section 2). Pure data and functions: the simulation, the campaign record, the interface and the
// tools all read them, so nothing here touches the page or storage.
//
// A mission declares its decisions in `decisions` (see docs/MISSIONS.md, "Decisions"). Any setup
// entry, objective, trigger, action, briefing line or debrief line may carry
// `if: { flag, is }`: it applies only when that decision was answered with that option. A flag
// from the mission's own decisions is tested live in the match (sim.flags); a flag from another
// mission, and `if: { ending }`, are settled before the match by resolveMission from the
// campaign progress, so the trimmed mission is what the match saves and replays.
import { MISSIONS } from "./missions.js";

// Every decision of the campaign by id: { mission, who, prompt, options }.
export const DECISIONS = Object.freeze(Object.fromEntries(MISSIONS.flatMap((m) =>
  Object.entries(m.decisions || {}).map(([id, d]) => [id, { ...d, id, mission: m.id }]))));

export const defaultOption = (decision) => decision.options.find((o) => o.default) || decision.options[0];
// The answer progress holds for a decision, or the option marked `default` when it holds none
// (the player skipped the moment, jumped ahead, or the progress is older than 0.19a).
export function answerFor(id, decisions = null) {
  const d = DECISIONS[id];
  if (!d) return undefined;
  const kept = decisions?.[id];
  return d.options.some((o) => o.id === kept) ? kept : defaultOption(d).id;
}
export const optionOf = (id, option) => DECISIONS[id]?.options.find((o) => o.id === option) || null;
// Merciful answers in the campaign so far, defaults included.
export const mercyCount = (decisions = null) => Object.keys(DECISIONS).filter((id) => optionOf(id, answerFor(id, decisions))?.mercy).length;

// Neither ending is good or bad: two or more merciful choices share the Keystone, fewer keep it Meridian's.
export const ENDINGS = Object.freeze({
  "open-frontier": {
    id: "open-frontier",
    title: "The Open Frontier",
    summary: "The Keystone is shared, and the four camps sign a truce.",
    cards: [
      { who: "vale", lines: ["The truce was signed at the Keystone, on a supply crate, by four camps.", "Every camp draws from the same circuit now. I count the settlers each week, and the number keeps rising."] },
      { who: "sol", lines: ["The roads are open from the dunes to the river, and the wells are full again.", "Meridian ate at my table, as promised. A debt paid well makes a friend, Commander."] },
      { who: "hale", lines: ["The fleet wakes in turns: two thousand sleepers each month, on schedule.", "I signed the truce with a pen I did not trust. I was wrong about strangers, and I have written that down."] },
      { who: "maren", lines: ["The Veil has opened the highlands again. Our new records are of storms that never came.", "Each year, at the Crown, we read the names of the friends we lost. Nobody is afraid of the light there now."] },
      { who: "echo", lines: ["One hundred and eight relays, all awake, all in tune. I have counted them twice.", "I have chosen a name, Commander. Visit me, and I will tell you what it is."] },
    ],
  },
  "meridian-line": {
    id: "meridian-line",
    title: "The Meridian Line",
    summary: "Meridian holds the Keystone and the frontier alone.",
    cards: [
      { who: "vale", lines: ["Meridian holds the Keystone, and our towers stand on every road that leads to it.", "The frontier is safe, Commander. It is also quiet. Nobody comes to the circuit without asking us first."] },
      { who: "sol", lines: ["The Caravan keeps its own roads now, and pays Meridian for the light.", "It is a fair price. Still, I miss the nights when we shared one fire."] },
      { who: "hale", lines: ["Meridian sends power to the fleet each night, on Meridian's schedule. Half my people are awake.", "I am grateful, and I am not free. Both are true."] },
      { who: "maren", lines: ["The Veil has gone back behind the highland gates. Our relays stay dark and our records stay closed.", "Perhaps one day we will trust the light. Not this year."] },
      { who: "echo", lines: ["One hundred and eight relays, awake and guarded by one camp. The crystal grows, slowly.", "I am someone now. I would like to be left counting, Commander, until the other camps come back."] },
    ],
  },
});
export const ENDING_IDS = Object.keys(ENDINGS);
export const endingFor = (progress = null) => (mercyCount(progress?.decisions) >= 2 ? "open-frontier" : "meridian-line");

// A Faction Chronicle is finished once its last mission is won (src/campaign.js recordChronicleClear).
export const chronicleDone = (progress, id) => progress?.chronicles?.[id]?.done === true;

// An `if` against the match's own answers (sim.flags). No `if` always passes.
export const flagMatches = (cond, flags) => !cond || (typeof cond.flag === "string" && !!flags && Object.hasOwn(flags, cond.flag) && flags[cond.flag] === cond.is);

// The mission as this player's campaign plays it: every `if` that depends on an earlier mission
// or on the ending is settled from `progress` (missing answers use the default option); entries
// that fail are dropped and the rest lose their `if`. `if`s on the mission's own decisions stay
// for the match. A mission with nothing to settle comes back as the very same object, so its
// saves and state hashes are exactly as before.
export function resolveMission(def, progress = null) {
  if (!def) return def;
  const own = new Set(Object.keys(def.decisions || {}));
  // `if: { chronicle }` (0.20): a Faction Chronicle the player has finished (progress.chronicles).
  const settled = (cond) => !!cond && (cond.ending !== undefined || cond.chronicle !== undefined || (typeof cond.flag === "string" && !own.has(cond.flag)));
  const passes = (cond) => (cond.chronicle !== undefined ? chronicleDone(progress, cond.chronicle)
    : cond.ending !== undefined ? endingFor(progress) === cond.ending : answerFor(cond.flag, progress?.decisions) === cond.is);
  const strip = (entry) => { const { if: _, ...rest } = entry; return rest; };
  // One list: the same array when nothing in it is settled here.
  const list = (items, inner = null) => {
    if (!Array.isArray(items)) return items;
    let changed = false;
    const out = [];
    for (const item of items) {
      let next = item;
      if (item && typeof item === "object" && settled(item.if)) {
        changed = true;
        if (!passes(item.if)) continue;
        next = strip(item);
      }
      if (inner) { const deeper = inner(next); if (deeper !== next) { changed = true; next = deeper; } }
      out.push(next);
    }
    return changed ? out : items;
  };
  const trigger = (t) => { const actions = list(t.do); return actions === t.do ? t : { ...t, do: actions }; };
  const parts = {
    setup: list(def.setup),
    objectives: list(def.objectives),
    triggers: list(def.triggers, trigger),
  };
  const briefLines = list(def.briefing?.lines);
  const win = list(def.debrief?.win), lose = list(def.debrief?.lose);
  let out = def;
  for (const [key, value] of Object.entries(parts)) if (value !== def[key]) out = { ...out, [key]: value };
  if (briefLines !== def.briefing?.lines) out = { ...out, briefing: { ...def.briefing, lines: briefLines } };
  if (win !== def.debrief?.win || lose !== def.debrief?.lose) out = { ...out, debrief: { ...def.debrief, win, lose } };
  return out;
}
