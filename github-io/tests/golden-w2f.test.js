// Golden pin, W2-F (m11c Hold the Keystone Roads): the DefenceBot plays the mission on Standard (default
// decisions), as tools/mission-check.mjs does. Fast pin: the first 120 s. GOLDEN_FULL=1: the whole mission.
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md); GOLDEN_RECORD=1 prints them.
import test from "node:test";
import { HOLD_THE_ROADS } from "../src/story/defence-missions.js";
import { resolveMission } from "../src/story/choices.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { pin, LONG } from "./lib/golden.mjs";

const play = (limit) => { const r = playDefence(resolveMission(HOLD_THE_ROADS, null), { difficulty: "standard", limit }); return { wave: r.wave, lives: r.lives, result: r.result, hash: r.sim.hash() }; };

test("m11c Hold the Keystone Roads, DefenceBot, 120 s", () => {
  pin("w2f m11c 120s", play(120), PIN_120);
});
test("m11c Hold the Keystone Roads, DefenceBot, the whole mission", LONG, () => {
  pin("w2f m11c full", play(1500), PIN_FULL);
});
const PIN_120 = { wave: 2, lives: 20, result: "timeout", hash: "a929add0" };
const PIN_FULL = { wave: 10, lives: 18, result: "victory", hash: "a0e890fc" };
