import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, recordClear, recordOptional, startNewGamePlus, loadProgress, saveProgress, resolveMission } from "../src/campaign.js";
import { ACHIEVEMENTS, achievementsFor, recordAchievements } from "../src/story/achievements.js";
import { carriesSquad } from "../src/story/squad.js";

const done = (p) => achievementsFor(p).filter((a) => a.done).map((a) => a.id);
const clearAll = (p, medal = "gold", difficulty = "standard") => MISSIONS.reduce((acc, _, i) => recordClear(acc, i, 300, medal, difficulty), p);

test("nothing is earned before a win; the first clear earns First victory", () => {
  assert.deepEqual(done({ cleared: {} }), []);
  assert.deepEqual(done(recordClear({ cleared: {} }, 0, 100)), ["first-light"]);
});

test("acts, gold medals, Veteran clears, decisions, endings and optional objectives each count", () => {
  const all = clearAll({ cleared: {} }, "gold", "veteran");
  const got = done({ ...all, decisions: { "m03-alloy": "keep", "m04-sol": "accept", "m05-pact": "drive", "m07-hale": "accept", "m10-veil": "break", "m10-maren": "finish" }, endingsSeen: ["open-frontier", "meridian-line"], squad: Array.from({ length: 6 }, (_, i) => ({ type: "ranger", name: "N" + i, rank: 1, xp: 3 })) });
  for (const id of ["first-light", "act-1", "act-2", "act-3", "gold-5", "veteran-5", "decider", "both-endings", "squad-6"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("mercy") && !got.includes("no-quarter"), "two accepts and a finish is neither all merciful nor all firm");
  let p = { cleared: {} };
  for (const m of MISSIONS.slice(0, 5)) p = recordOptional(p, m.id, 2);
  assert.ok(done(p).includes("extras-10"));
});

test("side missions do not block an act; recordOptional keeps the best count", () => {
  let p = { cleared: {} };
  for (const [i, m] of MISSIONS.entries()) if (m.act === 1 && !/^m\d+[a-z]-/.test(m.id)) p = recordClear(p, i, 200);
  assert.ok(done(p).includes("act-1"));
  p = recordOptional(p, "m01-first-light", 2); p = recordOptional(p, "m01-first-light", 1);
  assert.equal(p.optional["m01-first-light"], 2);
});

test("earned achievements are kept in progress and survive New Game+, which resets clears and decisions only", () => {
  let p = recordAchievements({ ...clearAll({ cleared: {} }), decisions: { "m04-sol": "accept" }, squad: [{ type: "ranger", name: "Ada", rank: 2, xp: 9 }], endingsSeen: ["open-frontier"] });
  assert.ok(p.earned.includes("act-3"));
  const next = startNewGamePlus(p);
  assert.deepEqual(next.cleared, {}); assert.equal(next.decisions, undefined); assert.equal(next.ngPlus, 1);
  assert.deepEqual(next.squad, p.squad); assert.deepEqual(next.earned, p.earned); assert.deepEqual(next.endingsSeen, p.endingsSeen);
  assert.ok(done(next).includes("act-3"), "still shown as earned");
  assert.equal(startNewGamePlus(next).ngPlus, 2);
});

test("New Game+ brings the squad into mission one; a first run does not", () => {
  const squad = [{ type: "ranger", name: "Ada", rank: 2, xp: 9 }];
  assert.equal(carriesSquad(MISSIONS[0], { squad }), false);
  assert.equal(carriesSquad(MISSIONS[0], { squad, ngPlus: 1 }), true);
  const m1 = resolveMission(MISSIONS[0], { cleared: {}, squad, ngPlus: 1 });
  assert.ok(m1.setup.some((s) => s.veteran && s.name === "Ada"));
});

test("progress fields validate on load and survive a save", () => {
  const store = { v: null, getItem() { return this.v; }, setItem(_, v) { this.v = v; } };
  saveProgress({ cleared: {}, optional: { m01: 2, bad: -1, worse: "x" }, earned: ["a", 5, "a"], ngPlus: 2.7 }, store);
  const p = loadProgress(store);
  assert.deepEqual(p.optional, { m01: 2 }); assert.deepEqual(p.earned, ["a"]); assert.equal(p.ngPlus, 2);
  assert.ok(ACHIEVEMENTS.every((a) => a.title.length <= 24 && a.how.length <= 48));
});
