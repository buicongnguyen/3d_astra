// Frontier Defence progress (src/defence/progress.js): best stars, lives and difficulty kept on
// their own, corrupt or blocked storage tolerated, and levels opening in order.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFENCE_KEY, loadDefence, saveDefence, recordDefence, starsOf, levelOpen, totalStars, OPEN_FROM_START } from "../src/defence/progress.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { MODES, MENU_LEGAL, isLegalMenuMove } from "../src/app/screens.js";
import { writeSave, readSave, SAVE_KEY } from "../src/savegame.js";
import { Simulation } from "../src/simulation.js";

const memory = (text = null) => {
  const data = new Map(text === null ? [] : [[DEFENCE_KEY, text]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data };
};

test("a first visit has no stars and the first levels open", () => {
  const p = loadDefence(memory());
  assert.deepEqual(p, { levels: {} });
  assert.equal(totalStars(p), 0);
  for (let i = 0; i < DEFENCE_LEVELS.length; i++) assert.equal(levelOpen(p, i), i < OPEN_FROM_START);
  assert.equal(levelOpen(p, -1), false);
  assert.equal(levelOpen(p, DEFENCE_LEVELS.length), false);
});

test("a win keeps the best stars, the most lives and the hardest difficulty, each on its own", () => {
  const id = DEFENCE_LEVELS[0].id;
  let p = recordDefence({ levels: {} }, id, { stars: 2, lives: 14, difficulty: "veteran" });
  p = recordDefence(p, id, { stars: 3, lives: 12, difficulty: "story" });
  assert.deepEqual(p.levels[id], { stars: 3, lives: 14, difficulty: "veteran" });
  assert.equal(starsOf(p, id), 3);
  assert.equal(recordDefence(p, id, { stars: 0, lives: 0 }), p, "a loss records nothing");
  const store = memory();
  saveDefence(p, store);
  assert.deepEqual(loadDefence(store), p);
  assert.equal(totalStars(p), 3);
});

test("corrupt, partial or blocked storage loads as empty or drops the bad entries", () => {
  assert.deepEqual(loadDefence(memory("{not json")), { levels: {} });
  assert.deepEqual(loadDefence(memory(JSON.stringify({ levels: { a: { stars: 9, lives: 3 }, b: { stars: 2, lives: -1 }, c: { stars: 1, lives: 5, difficulty: "nightmare" } } }))), { levels: { c: { stars: 1, lives: 5, difficulty: "standard" } } });
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadDefence(blocked), { levels: {} });
  assert.doesNotThrow(() => saveDefence({ levels: {} }, blocked));
  assert.deepEqual(loadDefence(null), { levels: {} });
});

test("Defence is the fourth start-screen mode and moves freely with the others", () => {
  assert.deepEqual(MODES, ["training", "skirmish", "campaign", "defence"]);
  for (const from of MODES) assert.ok(isLegalMenuMove(from, "defence") && isLegalMenuMove("defence", from), from);
  assert.ok(!isLegalMenuMove("defence", "briefing"));
  assert.deepEqual(MENU_LEGAL.defence, MODES);
});

test("a defence match autosaves and offers Continue with its level", () => {
  const level = DEFENCE_LEVELS[1], store = memory();
  const sim = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level });
  sim.command({ team: 0, type: "padBuild", pad: level.defence.pads[0].id, crew: "ranger" });
  for (let i = 0; i < 40; i++) sim.tick(0.05);
  assert.ok(writeSave({ mode: "defence", missionId: level.id, sim }, store));
  const save = readSave(store);
  assert.equal(save.mode, "defence");
  assert.equal(save.missionId, level.id);
  assert.equal(save.map, "bridges");
  const loaded = Simulation.load(save.text);
  assert.equal(loaded.hash(), sim.hash());
  assert.equal(loaded.missionDef.id, level.id);
  assert.ok(store.data.has(SAVE_KEY));
});
