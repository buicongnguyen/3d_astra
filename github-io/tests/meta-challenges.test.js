// W6 daily challenges (src/meta/challenges.js, plan C7.1): seeded from the date alone (same day, same set,
// on any device), one per group, judged from a finished match, paid once, a set per day, stored safely.
import test from "node:test";
import assert from "node:assert/strict";
import { CHALLENGES, GROUPS, CHALLENGE_XP, CHALLENGE_KEY, dailyChallenges, judgeChallenges, normalizeChallenges, loadChallenges, saveChallenges, freshChallenges } from "../src/meta/challenges.js";
import { translate } from "../src/i18n.js";

const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
const ctxFor = (c) => ({
  skirmish: { mode: "skirmish", win: true, seconds: 600, enemyCount: 2, stats: { lost: 3, kites: 1, killed: 50, abilities: 0 } },
  campaign: { mode: "campaign", win: true, medal: "gold", optional: 1, stats: { abilities: 4, killed: 10 } },
  defence: { mode: "defence", win: true, scored: false, stars: 3, hero: { level: 3 }, stats: {} },
}[c.group]);

test("the same date always gives the same three, one from each group", () => {
  for (const day of days) {
    const a = dailyChallenges(day), b = dailyChallenges(day);
    assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id), day);
    assert.deepEqual(a.map((c) => c.group), GROUPS, day);
  }
  assert.deepEqual(dailyChallenges("2026-11-25").map((c) => c.id), dailyChallenges("2026-11-25").map((c) => c.id));
  assert.deepEqual(dailyChallenges("junk").map((c) => c.id), dailyChallenges("2026-01-01").map((c) => c.id), "a bad date falls back to a fixed day");
});

test("the set rotates: over two months every challenge comes up and most days differ from the day before", () => {
  const seen = new Set(days.flatMap((d) => dailyChallenges(d).map((c) => c.id)));
  assert.deepEqual([...seen].sort(), CHALLENGES.map((c) => c.id).sort());
  const changed = days.slice(1).filter((d, i) => dailyChallenges(d).map((c) => c.id).join() !== dailyChallenges(days[i]).map((c) => c.id).join()).length;
  assert.ok(changed >= 45, `${changed} of 59 days changed`);
});

test("every challenge: a short goal, a mode, a reward, and its test met by a fitting match only", () => {
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, CHALLENGES.length);
  for (const c of CHALLENGES) {
    assert.ok(c.goal.length <= 40 && c.title.length <= 16, c.id);
    assert.ok(["skirmish", "campaign", "defence"].includes(c.mode), c.id);
    const ctx = ctxFor(c);
    const fit = c.id === "df-waves" ? { ...ctx, win: false, scored: true, score: 12 } : c.id === "df-win" ? ctx : ctx;
    assert.equal(!!c.test(fit), true, `${c.id} met`);
    assert.equal(!!c.test({ mode: c.mode, win: false, stats: {} }), false, `${c.id} not met by a bare loss`);
  }
});

test("judging: a met challenge pays once, others wait, three make a set, the next day starts fresh", () => {
  const day = "2026-11-25", [sk, cp, df] = dailyChallenges(day);
  let s = freshChallenges(day);
  let r = judgeChallenges(s, { ...ctxFor(sk), mode: "skirmish" }, day);
  assert.deepEqual(r.met.map((c) => c.id), [sk.id]);
  assert.equal(r.xp, CHALLENGE_XP);
  assert.equal(r.set, false);
  r = judgeChallenges(r.state, { ...ctxFor(sk), mode: "skirmish" }, day);
  assert.deepEqual([r.met.length, r.xp], [0, 0], "paid once");
  r = judgeChallenges(r.state, ctxFor(cp), day);
  r = judgeChallenges(r.state, { ...ctxFor(df), ...(df.id === "df-waves" ? { win: false, scored: true, score: 11 } : {}) }, day);
  assert.equal(r.set, true);
  assert.deepEqual([r.state.done.length, r.state.sets, r.state.setDay], [3, 1, day]);
  assert.equal(judgeChallenges(r.state, ctxFor(cp), day).set, false, "a set once a day");
  const next = normalizeChallenges(r.state, "2026-11-26");
  assert.deepEqual([next.done, next.sets], [[], 1], "a new day: nothing done, sets kept");
  // The wrong mode never meets a challenge, even with matching numbers.
  assert.equal(judgeChallenges(freshChallenges(day), { ...ctxFor(sk), mode: "campaign" }, day).met.some((c) => c.id === sk.id), false);
});

test("stored state: junk is dropped, another day's list is cleared, blocked storage is harmless", () => {
  const day = "2026-11-25", today = dailyChallenges(day).map((c) => c.id);
  assert.deepEqual(normalizeChallenges({ day, done: [today[0], "nope", today[0], 4], sets: 2.5, setDay: "x" }, day), { day, done: [today[0]], sets: 0, setDay: null });
  assert.deepEqual(normalizeChallenges({ day: "2026-11-24", done: today, sets: 4, setDay: "2026-11-24" }, day), { day, done: [], sets: 4, setDay: "2026-11-24" });
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadChallenges(day, storage), freshChallenges(day));
  assert.ok(saveChallenges({ day, done: [today[1]], sets: 1, setDay: null }, storage));
  assert.deepEqual(loadChallenges(day, storage).done, [today[1]]);
  store.set(CHALLENGE_KEY, "{bad");
  assert.deepEqual(loadChallenges(day, storage), freshChallenges(day));
  const blocked = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  assert.deepEqual(loadChallenges(day, blocked), freshChallenges(day));
  assert.equal(saveChallenges(freshChallenges(day), blocked), false);
});

test("every challenge reads in Vietnamese and Korean", () => {
  for (const lang of ["vi", "ko"]) for (const c of CHALLENGES) for (const text of [c.title, c.goal]) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
});
