// Golden pins of the whole of AAA round 2 (Wave 2 integrator): protects the round's content during clean-up.
//  1. Expanded roster plus Field command, AI against AI, four factions (Ashfall with Ramparts, Sunward with the
//     Outrider drill, Meridian with Gunners, Veil with Stalkers), Riverlands, 300 s.
//  2. Heroic d-gorge and d-longcrossing: the DefenceBot's final hash, lives and wave (as golden-w2b).
//  3. m11c Hold the Keystone Roads on Standard, DefenceBot, 120 s (the mission is a Defence mission: the
//     ObjectiveBot does not play it; golden-w2f pins the whole mission).
// GOLDEN_FULL=1 runs the long pins; GOLDEN_RECORD=1 prints the values. Only the integrator re-records a pin.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { HOLD_THE_ROADS } from "../src/story/defence-missions.js";
import { resolveMission } from "../src/story/choices.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { LONG, RECORD, pin } from "./lib/golden.mjs";

const arena = () => new Simulation({ map: "riverlands", enemyCount: 3, aiSpeed: "normal", factions: { 0: "ashfall", 1: "sunward", 2: "meridian", 3: "veil" }, capturePoints: true, aiPlayer: true, rules: { roster: "expanded", aiPlan: "field" } });
test("Expanded plus Field command, four AI factions, 300 s", LONG, () => {
  const sim = arena();
  pin("round2 arena 300", run(sim, 300), ARENA_300);
  if (!RECORD) {
    const types = new Set(sim.entities.map((e) => e.type));
    assert.ok(sim.entities.length > 0 && types.size > 4, "the match is live and varied");
  }
});

const heroic = (id) => { const r = playDefence(defenceVariant(DEFENCE_LEVELS.find((l) => l.id === id), { variant: "heroic" }), {}); return { result: r.result, lives: r.lives, wave: r.wave, hash: r.sim.hash() }; };
test("Heroic d-gorge", () => pin("round2 heroic d-gorge", heroic("d-gorge"), { result: "victory", lives: 2, wave: 6, hash: "d78d0600" }));
test("Heroic d-longcrossing", () => pin("round2 heroic d-longcrossing", heroic("d-longcrossing"), { result: "victory", lives: 5, wave: 6, hash: "9752f7e0" }));

test("m11c Hold the Keystone Roads, DefenceBot, 120 s", () => {
  const r = playDefence(resolveMission(HOLD_THE_ROADS, null), { difficulty: "standard", limit: 120 });
  pin("round2 m11c 120", { wave: r.wave, lives: r.lives, hash: r.sim.hash() }, { wave: 2, lives: 20, hash: "a929add0" });
});
const ARENA_300 = "4cce2935";
