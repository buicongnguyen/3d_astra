// Campaign achievements (plan C7.2): derived from the saved progress, local to the browser, no account.
// `earned` in the progress keeps every one ever earned, so a New Game+ does not lose them.
import { MISSIONS } from "./missions.js";
import { DECISIONS } from "./choices.js";
import { CHRONICLES } from "./chronicles.js";

const cleared = (p) => MISSIONS.filter((m) => p?.cleared?.[m.id]);
// Side missions (m02b, m11c...) are extras and do not count toward an act.
const act = (p, n) => { const list = MISSIONS.filter((m) => m.act === n && !/^m\d+[a-z]-/.test(m.id)); return list.length > 0 && list.every((m) => p?.cleared?.[m.id]); };
const answers = (p) => Object.keys(DECISIONS).filter((id) => typeof p?.decisions?.[id] === "string");
const HEROES = ["m04-sol", "m07-hale", "m10-maren"];

// id, title, how, and a test returning { have, need }.
export const ACHIEVEMENTS = Object.freeze([
  { id: "first-light", title: "First victory", how: "Clear the first mission", test: (p) => ({ have: cleared(p).length ? 1 : 0, need: 1 }) },
  { id: "act-1", title: "Act 1 complete", how: "Clear every Act 1 mission", test: (p) => ({ have: act(p, 1) ? 1 : 0, need: 1 }) },
  { id: "act-2", title: "Act 2 complete", how: "Clear every Act 2 mission", test: (p) => ({ have: act(p, 2) ? 1 : 0, need: 1 }) },
  { id: "act-3", title: "Act 3 complete", how: "Clear every Act 3 mission", test: (p) => ({ have: act(p, 3) ? 1 : 0, need: 1 }) },
  { id: "gold-5", title: "Gold standard", how: "Win gold medals in 5 missions", test: (p) => ({ have: cleared(p).filter((m) => p.cleared[m.id].medal === "gold").length, need: 5 }) },
  { id: "veteran-5", title: "Hard road", how: "Clear 5 missions on Veteran", test: (p) => ({ have: cleared(p).filter((m) => p.cleared[m.id].difficulty === "veteran").length, need: 5 }) },
  { id: "decider", title: "The decider", how: "Answer all six decisions", test: (p) => ({ have: answers(p).length, need: Object.keys(DECISIONS).length }) },
  { id: "mercy", title: "Mercy", how: "Accept all three surrenders", test: (p) => ({ have: HEROES.filter((id) => p?.decisions?.[id] === "accept").length, need: 3 }) },
  { id: "no-quarter", title: "No quarter", how: "Finish all three yielding commanders", test: (p) => ({ have: HEROES.filter((id) => p?.decisions?.[id] === "finish").length, need: 3 }) },
  { id: "both-endings", title: "Both endings", how: "See both endings", test: (p) => ({ have: new Set(p?.endingsSeen || []).size, need: 2 }) },
  { id: "squad-6", title: "Full squad", how: "Keep six veterans at once", test: (p) => ({ have: Math.min(6, p?.squad?.length || 0), need: 6 }) },
  { id: "extras-10", title: "Going further", how: "Complete 10 optional objectives", test: (p) => ({ have: Math.min(10, Object.values(p?.optional || {}).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0)), need: 10 }) },
  { id: "chronicler", title: "Chronicler", how: "Finish a Faction Chronicle", test: (p) => ({ have: CHRONICLES.some((c) => p?.chronicles?.[c.id]?.done === true) ? 1 : 0, need: 1 }) },
]);

// Every achievement with its state: done now, or earned in an earlier play-through.
export function achievementsFor(progress) {
  const kept = new Set(Array.isArray(progress?.earned) ? progress.earned : []);
  return ACHIEVEMENTS.map((a) => {
    const { have, need } = a.test(progress);
    return { id: a.id, title: a.title, how: a.how, have: Math.min(have, need), need, done: have >= need || kept.has(a.id) };
  });
}
// The progress with every achievement reached so far remembered; the same object when nothing is new.
export function recordAchievements(progress) {
  const done = achievementsFor(progress).filter((a) => a.done).map((a) => a.id), old = Array.isArray(progress?.earned) ? progress.earned : [];
  const next = [...new Set([...old, ...done])];
  return next.length === old.length ? progress : { ...progress, earned: next };
}
