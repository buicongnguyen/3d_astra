// Achievements (plan C7.2, W6): the campaign's 13 are derived from the saved progress; the 12 added in W6
// (Skirmish, Frontier Defence, the Field commander, Kites and taming) read the service record
// (src/meta/record.js) and the Defence progress. Local to the browser, no account. `earned` in the
// progress (campaign) and in the record (the rest) keeps every one ever earned, so a New Game+ loses none.
import { MISSIONS } from "./missions.js";
import { DECISIONS } from "./choices.js";
import { CHRONICLES } from "./chronicles.js";

const cleared = (p) => MISSIONS.filter((m) => p?.cleared?.[m.id]);
// Side missions (m02b, m11c...) are extras and do not count toward an act.
const act = (p, n) => { const list = MISSIONS.filter((m) => m.act === n && !/^m\d+[a-z]-/.test(m.id)); return list.length > 0 && list.every((m) => p?.cleared?.[m.id]); };
const answers = (p) => Object.keys(DECISIONS).filter((id) => typeof p?.decisions?.[id] === "string");
const HEROES = ["m04-sol", "m07-hale", "m10-maren"];
// An act whose main missions are all cleared with gold (the medal cosmetics read the same, src/meta/rewards.js).
export const goldActs = (p) => [1, 2, 3].filter((n) => { const list = MISSIONS.filter((m) => m.act === n && !/^m\d+[a-z]-/.test(m.id)); return list.length > 0 && list.every((m) => p?.cleared?.[m.id]?.medal === "gold"); });
export const goldCount = (p) => cleared(p).filter((m) => p.cleared[m.id].medal === "gold").length;
const one = (ok) => ({ have: ok ? 1 : 0, need: 1 });
const rec = (x) => x?.record || {};
const stars = (x) => Object.values(x?.defence?.levels || {}).reduce((n, l) => n + (Number.isFinite(l?.stars) ? l.stars : 0), 0) + Object.keys(x?.defence?.heroic || {}).length;

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
  // W6: beyond the campaign. `x` is { record, defence } (src/meta/record.js, src/defence/progress.js).
  { id: "golden-act", group: "campaign", icon: "star", title: "Golden act", how: "Win gold in every mission of an act", test: (p) => one(goldActs(p).length > 0) },
  { id: "skirmish-win", group: "skirmish", icon: "crosshair", title: "Field victory", how: "Win a Skirmish", test: (p, x) => one(rec(x).skirmishWins > 0) },
  { id: "three-fronts", group: "skirmish", icon: "people", title: "Three fronts", how: "Win a Skirmish against 3 AI enemies", test: (p, x) => one(rec(x).bigWins > 0) },
  { id: "unbreakable", group: "skirmish", icon: "shield", title: "Unbreakable", how: "Win a Skirmish against Relentless AI", test: (p, x) => one(rec(x).relentlessWins > 0) },
  { id: "know-enemy", group: "skirmish", icon: "flag", title: "Know your enemy", how: "Beat all five factions in Skirmish", test: (p, x) => ({ have: (rec(x).beaten || []).length, need: 5 }) },
  { id: "line-holder", group: "defence", icon: "tower", title: "Line holder", how: "Earn 15 Defence stars", test: (p, x) => ({ have: stars(x), need: 15 }) },
  { id: "field-marshal", group: "defence", icon: "levelup", title: "Field marshal", how: "Raise the Field commander to Rank 5", test: (p, x) => ({ have: rec(x).fieldRank || 0, need: 5 }) },
  { id: "steel-rain", group: "defence", icon: "barrage", title: "Steel rain", how: "Win a Defence level with Artillery", test: (p, x) => one((rec(x).branchWins || []).includes("artillery")) },
  { id: "rally-line", group: "defence", icon: "rally", title: "Rally the line", how: "Win a Defence level with Rally", test: (p, x) => one((rec(x).branchWins || []).includes("rally")) },
  { id: "eyes-in-sky", group: "kite", icon: "kite", title: "Eyes in the sky", how: "Train 10 Kite scouts", test: (p, x) => ({ have: rec(x).kites || 0, need: 10 }) },
  { id: "falling-star", group: "kite", icon: "dive", title: "Falling star", how: "Land 3 Kite Dives", test: (p, x) => ({ have: rec(x).dives || 0, need: 3 }) },
  { id: "wyrm-tamer", group: "wild", icon: "wyrm", title: "Wyrm whisperer", how: "Tame a Dune Wyrm", test: (p, x) => one(rec(x).tamed > 0) },
]);
// The campaign's own achievements (kept in the campaign progress; the rest are kept in the service record).
export const CAMPAIGN_IDS = new Set(ACHIEVEMENTS.filter((a) => !a.group).map((a) => a.id));

// Every achievement with its state: done now, or earned in an earlier play-through.
// `extra` is { record, defence }; without it the W6 entries show their progress as nothing yet.
export function achievementsFor(progress, extra = {}) {
  const kept = new Set([...(Array.isArray(progress?.earned) ? progress.earned : []), ...(Array.isArray(extra?.record?.earned) ? extra.record.earned : [])]);
  return ACHIEVEMENTS.map((a) => {
    const { have, need } = a.test(progress, extra);
    return { id: a.id, title: a.title, how: a.how, icon: a.icon || "star", group: a.group || "campaign", have: Math.min(have, need), need, done: have >= need || kept.has(a.id) };
  });
}
// The W6 achievements reached now, remembered in the record: { record, added: [id] } (the same record when nothing is new).
export function recordMoreAchievements(progress, record, defence) {
  const old = Array.isArray(record?.earned) ? record.earned : [];
  const added = achievementsFor(progress, { record, defence }).filter((a) => a.done && !CAMPAIGN_IDS.has(a.id) && !old.includes(a.id)).map((a) => a.id);
  return { record: added.length ? { ...record, earned: [...old, ...added] } : record, added };
}
// The progress with every achievement reached so far remembered; the same object when nothing is new.
export function recordAchievements(progress) {
  const done = achievementsFor(progress).filter((a) => a.done).map((a) => a.id), old = Array.isArray(progress?.earned) ? progress.earned : [];
  const next = [...new Set([...old, ...done])];
  return next.length === old.length ? progress : { ...progress, earned: next };
}
