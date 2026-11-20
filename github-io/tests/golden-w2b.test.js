// Golden pin, W2-B (Heroic): the DefenceBot plays Heroic on d-gorge and d-longcrossing (Standard), final hash,
// lives and stars (a Heroic win is one star). GOLDEN_FULL=1 adds the other five levels. Pins are re-recorded
// only by the integrator, with a named reason (docs/TESTING.md, "Golden pins and baselines");
// GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { LONG, pin } from "./lib/golden.mjs";

const EXPECTED = {
  "d-gorge": { result: "victory", lives: 2, stars: 1, wave: 6, hash: "d78d0600" },
  "d-longcrossing": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "9752f7e0" },
  "d-bridges": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "8e866709" },
  "d-switchback": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "0c5cf82f" },
  "d-fordwood": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "9a5d93d8" },
  "d-canyon": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "d783b0f8" },
  "d-crossroads": { result: "victory", lives: 5, stars: 1, wave: 6, hash: "a4f9cce5" },
};
const play = (id) => {
  const r = playDefence(defenceVariant(DEFENCE_LEVELS.find((l) => l.id === id), { variant: "heroic" }), {});
  return { result: r.result, lives: r.lives, stars: r.result === "victory" ? 1 : 0, wave: r.wave, hash: r.sim.hash() };
};
test("Heroic d-gorge: final hash, lives, stars", () => { pin("w2b heroic d-gorge", play("d-gorge"), EXPECTED["d-gorge"]); });
test("Heroic d-longcrossing (elites, Stalker columns): final hash, lives, stars", () => { pin("w2b heroic d-longcrossing", play("d-longcrossing"), EXPECTED["d-longcrossing"]); });
for (const id of ["d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-crossroads"])
  test(`Heroic ${id}: final hash, lives, stars`, LONG, () => { pin(`w2b heroic ${id}`, play(id), EXPECTED[id]); });
