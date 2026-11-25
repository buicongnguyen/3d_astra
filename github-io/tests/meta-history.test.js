// W6 match history (src/meta/history.js, plan B2): the last 20 finished matches, newest first, cleaned on load,
// small in storage, harmless when storage is blocked.
import test from "node:test";
import assert from "node:assert/strict";
import { HISTORY_KEY, HISTORY_CAP, addHistory, normalizeHistory, normalizeEntry, loadHistory, saveHistory } from "../src/meta/history.js";

const entry = (i, over = {}) => ({ id: `m${i}`, at: 1_700_000_000_000 + i * 1000, mode: "skirmish", map: "riverlands", mission: null, player: "meridian", rivals: ["ashfall"], result: i % 2 ? "victory" : "defeat",
  seconds: 600 + i, difficulty: "standard", aiSpeed: "normal", enemyCount: 1, medal: null, stars: null, score: null, stats: { killed: 10, lost: 4, trained: 12, built: 5, alloy: 900, energy: 300 }, ...over });

test("the last 20, newest first; a repeated id replaces the old row", () => {
  let list = [];
  for (let i = 0; i < 30; i++) list = addHistory(list, entry(i));
  assert.equal(HISTORY_CAP, 20);
  assert.equal(list.length, 20);
  assert.deepEqual(list.slice(0, 3).map((e) => e.id), ["m29", "m28", "m27"]);
  assert.equal(list.at(-1).id, "m10");
  list = addHistory(list, entry(15, { result: "victory", seconds: 1 }));
  assert.equal(list[0].id, "m15");
  assert.equal(list.filter((e) => e.id === "m15").length, 1);
});

test("rows are cleaned: unknown modes, results and junk dropped, numbers bounded, strings short", () => {
  assert.equal(normalizeEntry({ ...entry(1), mode: "arena" }), null);
  assert.equal(normalizeEntry({ ...entry(1), result: "draw" }), null);
  assert.equal(normalizeEntry({ ...entry(1), id: "" }), null);
  assert.equal(normalizeEntry(null), null);
  const e = normalizeEntry({ ...entry(1), enemyCount: 9, stars: 7, score: -3, medal: "platinum", rivals: ["a", 5, "b", "c", "d"], stats: { killed: -2, lost: "x", trained: 1e12 }, map: "x".repeat(200), extra: "dropped" });
  assert.deepEqual([e.enemyCount, e.stars, e.score, e.medal, e.rivals, e.stats.killed, e.stats.lost, e.stats.trained, e.map, "extra" in e], [3, 4, 0, null, ["a", "b", "c"], 0, 0, 1e9, "", false]);
  assert.deepEqual(normalizeHistory("junk"), []);
  assert.deepEqual(normalizeHistory([entry(1), { nope: 1 }, entry(1), entry(2)]).map((x) => x.id), ["m1", "m2"]);
});

test("stored: a missing key is an empty history, a full one stays small, blocked storage is harmless", () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadHistory(storage), []);
  let list = [];
  for (let i = 0; i < 25; i++) list = addHistory(list, entry(i, { mission: i % 3 ? null : "m01-first-light", medal: i % 3 ? null : "gold" }));
  assert.ok(saveHistory(list, storage));
  assert.deepEqual(loadHistory(storage), list);
  assert.ok(store.get(HISTORY_KEY).length < 12_000, `20 rows in ${store.get(HISTORY_KEY).length} bytes`);
  store.set(HISTORY_KEY, "{oops");
  assert.deepEqual(loadHistory(storage), []);
  const blocked = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  assert.deepEqual(loadHistory(blocked), []);
  assert.equal(saveHistory(list, blocked), false);
});
