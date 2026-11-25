// The local Endless leaderboard (W10, Defence 6.7): src/defence/progress.js board, recordRun, boardOf, endlessScore.
import test from "node:test";
import assert from "node:assert/strict";
import { loadDefence, saveDefence, recordRun, boardOf, endlessScore, BOARD_SIZE, DEFENCE_KEY, recordSeen } from "../src/defence/progress.js";

const store = (value) => ({ v: value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value), getItem() { return this.v; }, setItem(_k, v) { this.v = v; } });
const run = (wave, killed, date = "2026-11-20", branch = "", rank = 1) => ({ wave, score: endlessScore(wave, killed), date, branch, rank });

test("the score is waves held x 100 plus enemies defeated", () => {
  assert.equal(endlessScore(12, 340), 1540);
  assert.equal(endlessScore(0, 0), 0);
  assert.equal(endlessScore(3.9, 7.8), 307);
  assert.equal(endlessScore(-2, -5), 0);
});

test("runs sort by score, then waves, then the earlier date; the board keeps ten per map", () => {
  let p = { levels: {} };
  const places = [];
  for (let i = 0; i < 14; i++) { const r = recordRun(p, "d-fork", run(i, 10, `2026-11-${String(10 + i).padStart(2, "0")}`)); p = r.progress; places.push(r.place); }
  const board = boardOf(p, "d-fork");
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(board.map((r) => r.wave), [13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.deepEqual(places.slice(-3), [1, 1, 1]);
  // A run below the tenth is not placed and changes nothing.
  const low = recordRun(p, "d-fork", run(1, 0));
  assert.equal(low.place, 0);
  assert.equal(low.progress, p);
  // Ties: the same score goes to more waves held, then to the earlier run.
  let t = { levels: {} };
  t = recordRun(t, "d-gorge", { wave: 5, score: 900, date: "2026-11-21", branch: "", rank: 1 }).progress;
  t = recordRun(t, "d-gorge", { wave: 6, score: 900, date: "2026-11-22", branch: "rally", rank: 3 }).progress;
  const third = recordRun(t, "d-gorge", { wave: 6, score: 900, date: "2026-11-20", branch: "artillery", rank: 3 });
  assert.equal(third.place, 1);
  assert.deepEqual(boardOf(third.progress, "d-gorge").map((r) => `${r.wave}${r.branch[0] || "-"}`), ["6a", "6r", "5-"]);
  // Maps keep their own boards.
  assert.equal(boardOf(third.progress, "d-fork").length, 0);
});

test("a run that is not a real one, or on an unknown map, is refused", () => {
  const p = { levels: {} };
  for (const bad of [{ wave: -1, score: 5 }, { wave: 2, score: "x" }, { wave: 2, score: 5, branch: "laser" }, { wave: 2, score: 5, rank: 7 }, { wave: 2, score: 5, date: "yesterday" }]) assert.equal(recordRun(p, "d-fork", bad).place, 0, JSON.stringify(bad));
  assert.equal(recordRun(p, "d-nowhere", run(5, 5)).place, 0);
  // The date defaults to today.
  assert.match(recordRun(p, "d-fork", { wave: 1, score: 100, branch: "", rank: 1 }).progress.board["d-fork"][0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test("saved and loaded: the board round-trips; corrupt or hand-edited entries are dropped, the rest kept in order", () => {
  let p = { levels: {} };
  for (const r of [run(9, 50, "2026-11-01", "artillery", 3), run(4, 20), run(7, 0, "2026-11-02", "rally", 2)]) p = recordRun(p, "d-serpent", r).progress;
  const s = store();
  saveDefence(p, s);
  assert.deepEqual(loadDefence(s).board, p.board);
  const raw = JSON.parse(s.v);
  raw.board["d-serpent"].push({ wave: "lots" }, null, 7, { wave: 99, score: 1, date: "2026-13-99x", branch: "", rank: 1 }, { wave: 50, score: 99999, date: "2026-11-03", branch: "rally", rank: 9 });
  raw.board["d-serpent"].unshift({ wave: 1, score: 100, date: "2026-11-05", branch: "", rank: 1 });
  raw.board["d-nowhere"] = [run(3, 3)];
  raw.board["d-fork"] = "not a list";
  const loaded = loadDefence(store(raw)).board;
  assert.deepEqual(Object.keys(loaded), ["d-serpent"]);
  assert.deepEqual(loaded["d-serpent"].map((r) => r.score), [950, 700, 420, 100]);
  // More than ten in storage: the best ten.
  raw.board = { "d-fork": Array.from({ length: 15 }, (_, i) => run(i, 0)) };
  assert.equal(loadDefence(store(raw)).board["d-fork"].length, 10);
  assert.equal(loadDefence(store(raw)).board["d-fork"][0].wave, 14);
  // Broken JSON, a board that is not an object, blocked storage: no board, and the menu still works.
  assert.deepEqual(loadDefence(store("{not json")), { levels: {} });
  assert.equal(loadDefence(store({ levels: {}, board: [1, 2] })).board, undefined);
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.deepEqual(loadDefence(blocked), { levels: {} });
  assert.doesNotThrow(() => saveDefence(p, blocked));
});

test("older progress reads and saves as before: no board key until a run is recorded", () => {
  const old = { levels: { "d-gorge": { stars: 3, lives: 20, difficulty: "standard" } }, endless: { "d-gorge": 14 } };
  const s = store(old);
  const p = loadDefence(s);
  assert.equal("board" in p, false);
  saveDefence(p, s);
  assert.deepEqual(JSON.parse(s.v), old);
  assert.equal(DEFENCE_KEY, "frontier-defence-v1");
});

test("a wave kind's card is kept as kind:<id>; unknown kinds are dropped on load", () => {
  const p = recordSeen({ levels: {} }, ["vanguard"]);
  const s = store({ ...p, seen: ["vanguard", "kind:shieldwall", "kind:laser", "kind:broodling", "dragon"] });
  assert.deepEqual(loadDefence(s).seen, ["vanguard", "kind:shieldwall"]);
});
