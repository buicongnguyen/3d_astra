// W6 replay value: the 25 achievements (src/story/achievements.js) and the service record that feeds the 12
// beyond the campaign (src/meta/record.js): every condition, the record's migration from nothing or junk,
// what a live match may count, and that every name and line reads in Vietnamese and Korean.
// The page side (toast, Records screen) is tests/meta.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, achievementsFor, recordMoreAchievements, CAMPAIGN_IDS, goldActs } from "../src/story/achievements.js";
import { MISSIONS, recordClear } from "../src/campaign.js";
import { RECORD_KEY, freshRecord, normalizeRecord, loadRecord, saveRecord, addMatch } from "../src/meta/record.js";
import { translate } from "../src/i18n.js";

const done = (p, x) => achievementsFor(p, x).filter((a) => a.done).map((a) => a.id);
const W6 = ACHIEVEMENTS.filter((a) => !CAMPAIGN_IDS.has(a.id)).map((a) => a.id);
const win = (over = {}) => ({ mode: "skirmish", win: true, enemyCount: 1, aiSpeed: "normal", rivals: ["meridian"], stats: {}, hero: null, ...over });

test("25 achievements: the campaign's 13 and 12 more, unique ids, short text, an icon each", () => {
  assert.equal(ACHIEVEMENTS.length, 25);
  assert.equal(CAMPAIGN_IDS.size, 13);
  assert.equal(W6.length, 12);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 25);
  for (const a of ACHIEVEMENTS) assert.ok(a.title.length <= 24 && a.how.length <= 48, a.id);
  for (const a of ACHIEVEMENTS.filter((x) => x.group)) assert.ok(a.icon, a.id);
  assert.deepEqual([...new Set(ACHIEVEMENTS.filter((a) => a.group).map((a) => a.group))].sort(), ["campaign", "defence", "kite", "skirmish", "wild"]);
});

test("nothing is earned by a fresh profile, and nothing but the campaign without a record", () => {
  assert.deepEqual(done({ cleared: {} }, { record: freshRecord(), defence: { levels: {} } }), []);
  assert.deepEqual(done({ cleared: {} }), []);
});

test("Skirmish: a win, three AI, Relentless, and all five factions beaten", () => {
  let r = addMatch(freshRecord(), win());
  assert.deepEqual(done({ cleared: {} }, { record: r }), ["skirmish-win"]);
  r = addMatch(r, win({ enemyCount: 3, rivals: ["ashfall", "sunward", "wardens"] }));
  r = addMatch(r, win({ aiSpeed: "relentless", rivals: ["veil"] }));
  const got = done({ cleared: {} }, { record: r });
  for (const id of ["skirmish-win", "three-fronts", "unbreakable", "know-enemy"]) assert.ok(got.includes(id), id);
  assert.deepEqual(r.beaten.sort(), ["ashfall", "meridian", "sunward", "veil", "wardens"]);
  // A loss, a Defence or campaign win, or a live match counts no Skirmish win.
  for (const ctx of [win({ win: false }), win({ mode: "defence" }), win({ mode: "campaign" })]) assert.equal(addMatch(freshRecord(), ctx).skirmishWins, 0);
  assert.equal(addMatch(freshRecord(), win(), { live: true }).skirmishWins, 0);
  const four = ["meridian", "ashfall", "sunward", "wardens"].reduce((acc, f) => addMatch(acc, win({ rivals: [f] })), freshRecord());
  const know = achievementsFor({ cleared: {} }, { record: four }).find((a) => a.id === "know-enemy");
  assert.deepEqual([know.have, know.need, know.done], [4, 5, false]);
});

test("Defence: 15 stars, the Field commander at Rank 5, and wins with each branch", () => {
  const levels = Object.fromEntries(["a", "b", "c", "d", "e"].map((id) => [id, { stars: 3, lives: 20, difficulty: "standard" }]));
  assert.ok(done({ cleared: {} }, { record: freshRecord(), defence: { levels } }).includes("line-holder"));
  const fourteen = { ...levels, e: { stars: 2, lives: 1 } };
  assert.ok(!done({ cleared: {} }, { defence: { levels: fourteen } }).includes("line-holder"));
  assert.ok(done({ cleared: {} }, { defence: { levels: fourteen, heroic: { gorge: { won: true, lives: 3 } } } }).includes("line-holder"), "a Heroic win is a star");
  let r = addMatch(freshRecord(), { mode: "defence", win: false, hero: { level: 4, branch: "rally" } });
  assert.equal(r.fieldRank, 4);
  assert.deepEqual(r.branchWins, [], "a loss is no branch win");
  r = addMatch(r, { mode: "defence", win: true, hero: { level: 5, branch: "rally" } });
  r = addMatch(r, { mode: "defence", win: true, hero: { level: 4, branch: "artillery" } });
  const got = done({ cleared: {} }, { record: r });
  for (const id of ["field-marshal", "rally-line", "steel-rain"]) assert.ok(got.includes(id), id);
  assert.equal(addMatch(freshRecord(), { mode: "defence", win: true, scored: true, hero: { level: 2, branch: "artillery" } }).branchWins.length, 0, "Endless and Daily are scores, not wins");
  assert.equal(addMatch(freshRecord(), { hero: { level: 99 } }).fieldRank, 5);
});

test("Kites, Dives and taming add up over matches, live or not", () => {
  let r = freshRecord();
  for (let i = 0; i < 4; i++) r = addMatch(r, { mode: "skirmish", win: false, stats: { kites: 3, dives: 1, tamed: i === 2 ? 1 : 0 } });
  assert.deepEqual([r.kites, r.dives, r.tamed], [12, 4, 1]);
  const got = done({ cleared: {} }, { record: r });
  for (const id of ["eyes-in-sky", "falling-star", "wyrm-tamer"]) assert.ok(got.includes(id), id);
  const live = addMatch(freshRecord(), { mode: "campaign", stats: { dives: 3 } }, { live: true });
  assert.equal(live.dives, 3, "a live match counts what already happened");
});

test("Golden act: every main mission of an act with gold", () => {
  let p = { cleared: {} };
  for (const [i, m] of MISSIONS.entries()) if (m.act === 1 && !/^m\d+[a-z]-/.test(m.id)) p = recordClear(p, i, 200, "gold");
  assert.deepEqual(goldActs(p), [1]);
  assert.ok(done(p).includes("golden-act"));
  const firstAct1 = MISSIONS.findIndex((m) => m.act === 1);
  assert.deepEqual(goldActs({ ...p, cleared: { ...p.cleared, [MISSIONS[firstAct1].id]: { time: 1, medal: "silver", difficulty: "standard" } } }), [], "one silver breaks the act");
});

test("earned W6 achievements are kept in the record, never lost, and returned once", () => {
  const r = addMatch(freshRecord(), win());
  const first = recordMoreAchievements({ cleared: {} }, r, null);
  assert.deepEqual(first.added, ["skirmish-win"]);
  assert.deepEqual(first.record.earned, ["skirmish-win"]);
  const again = recordMoreAchievements({ cleared: {} }, first.record, null);
  assert.deepEqual(again.added, []);
  assert.equal(again.record, first.record);
  // Kept even when the counter it came from is gone (an older record, a hand edit).
  assert.ok(done({ cleared: {} }, { record: { ...freshRecord(), earned: ["skirmish-win"] } }).includes("skirmish-win"));
  assert.ok(!first.record.earned.some((id) => CAMPAIGN_IDS.has(id)), "the campaign's own stay in the campaign progress");
});

test("the record: old profiles (no record) load fresh, junk is cleaned, counters capped, blocked storage harmless", () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadRecord(storage), freshRecord());
  const r = addMatch(freshRecord(), win({ rivals: ["ashfall", "nope"], stats: { kites: 2 } }));
  assert.ok(saveRecord(r, storage));
  assert.deepEqual(loadRecord(storage), { ...r, beaten: ["meridian", "ashfall"].filter((f) => r.beaten.includes(f)) });
  assert.deepEqual(normalizeRecord({ kites: -4, dives: "x", tamed: 2.9, fieldRank: 12, beaten: ["veil", "veil", 3, "orcs"], branchWins: ["rally", "laser"], earned: ["a", "a", 7], meta: { ach: 3, goldActs: [1, 1, 9.5, 2], sets: -1 } }),
    { ...freshRecord(), tamed: 2, fieldRank: 5, beaten: ["veil"], branchWins: ["rally"], earned: ["a"], meta: { ach: 3, gold: 0, goldActs: [1, 2], sets: 0 } });
  assert.equal(normalizeRecord({ kites: 1e12 }).kites, 1e6);
  store.set(RECORD_KEY, "{broken");
  assert.deepEqual(loadRecord(storage), freshRecord());
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadRecord(blocked), freshRecord());
  assert.equal(saveRecord(r, blocked), false);
  assert.ok(JSON.stringify(normalizeRecord({ earned: Array.from({ length: 900 }, (_, i) => `a${i}`) })).length < 4000, "the stored record stays small");
});

test("every achievement's name and line reads in Vietnamese and Korean", () => {
  for (const lang of ["vi", "ko"]) for (const a of ACHIEVEMENTS) for (const text of [a.title, a.how]) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
});
