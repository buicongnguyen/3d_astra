// Headless match runners shared by the node tests (K1 golden pins, K11). One way to play a match on,
// so every pin and check ticks a simulation exactly as the balance tools do (tools/mission-check.mjs,
// tools/faction-bench.mjs): a 0.05 s tick, the bot's step before each tick, its `see` with each event
// after it, then the event queue cleared.
import { Simulation } from "../../src/simulation.js";
import { resolveMission } from "../../src/story/choices.js";
import { ObjectiveBot } from "../../tools/playbot.mjs";

export const TICK = 0.05;

// Plays `sim` on to `seconds` of game time, or to the end of the match if it ends first, calling
// `step` before each tick and `see` with each of its events after it. Returns the state hash.
export function run(sim, seconds, { step, see } = {}) {
  const end = Math.round(seconds / TICK);
  while (sim.ticks < end && !sim.result) {
    step?.();
    sim.tick(TICK);
    if (see) for (const e of sim.events) see(e);
    sim.events.length = 0;
  }
  return sim.hash();
}

// The computer plays every side (the faction bench's setup).
export const aiMatch = (options = {}) => new Simulation({ ...options, aiPlayer: true });

// The hash at each of `times` (seconds, ascending), playing one match on: { 60: "…", 180: "…" }.
// A match that ends sooner keeps its final state, so a later time repeats the last hash.
export function hashesAt(sim, times, options) {
  const out = {};
  for (const at of times) out[at] = run(sim, at, options);
  return out;
}

// A campaign or Chronicle mission set up as tools/mission-check.mjs `play()` sets it up (earlier
// decisions settled from `progress`, null = the default answers), with its ObjectiveBot. `run` plays
// it on with the bot. Defence-rules missions are played by the DefenceBot instead (tools/defence-bot.mjs).
export function missionMatch(mission, { difficulty = "standard", progress = null, decide = "default" } = {}) {
  const def = resolveMission(mission, progress);
  const sim = new Simulation({ difficulty, map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, playerBonus: def.bonus || null, mission: def });
  const bot = new ObjectiveBot(sim, sim.missionDef, { decide });
  return { sim, bot, run: (seconds) => run(sim, seconds, { step: () => bot.step(), see: (e) => bot.see(e) }) };
}
