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

// Plays `sim` on from where it is for `seconds` of game time, one 0.05 s tick at a time, and returns `seen`.
// The unit tests' own small `run()` helpers were twenty copies of this loop with these differences, kept
// as options so each file plays exactly as before:
//   steps   how many ticks `seconds` means: "ceil" = every tick while i < seconds * 20 (the default),
//           "round" = Math.round(seconds * 20), "div" = every tick while i < seconds / TICK
//   stop    stop at the end of the match (default true)
//   events  "keep" copies each event into `seen` and clears the queue (default), "clear" drops them,
//           "leave" leaves the queue alone (a test that reads sim.events itself), "stamp" copies each
//           with `at` = the game time after the tick
export function advance(sim, seconds, { seen = [], steps = "ceil", stop = true, events = "keep" } = {}) {
  const count = steps === "round" ? Math.round(seconds * 20) : steps === "div" ? Math.ceil(seconds / TICK) : Math.ceil(seconds * 20);
  for (let i = 0; i < count && !(stop && sim.result); i++) {
    sim.tick(TICK);
    if (events === "keep") seen.push(...sim.events);
    else if (events === "stamp") seen.push(...sim.events.map((e) => ({ ...e, at: sim.time })));
    if (events !== "leave") sim.events.length = 0;
  }
  return seen;
}
