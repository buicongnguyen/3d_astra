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
// Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
// Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
test("Heroic d-longcrossing", () => pin("round2 heroic d-longcrossing", heroic("d-longcrossing"), { result: "victory", lives: 5, wave: 6, hash: "9752f7e0" }));

test("m11c Hold the Keystone Roads, DefenceBot, 120 s", () => {
  const r = playDefence(resolveMission(HOLD_THE_ROADS, null), { difficulty: "standard", limit: 120 });
  pin("round2 m11c 120", { wave: r.wave, lives: r.lives, hash: r.sim.hash() }, { wave: 2, lives: 20, hash: "a929add0" });
});
// R3-A (AAA round 3) moved it: the Field command census and economy (old "4cce2935", R3-A "e4913c66").
// Difficulty guard (Wave 1b, owner 2026-11-21): census from 300 s and no field economy, so 300 s is back to r3-base
// ("4cce2935"); then south exits (owner, R3-L) + difficulty guard on the merged tree: "f94f7658".
// Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
// Re-recorded 2026-11-24 (integration of faction depth + support units + faction roster): Fast/Relentless AIs take doctrines and cast signature abilities; Medic/Engineer/Supply wagon health rose; Veil/Wardens cores train the new flyers and an Expanded Shield pylon trains the Bulwark (new trains lists and AI play). ("42bae522" -> "674ca6a0")
// Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
const ARENA_300 = "674ca6a0";
