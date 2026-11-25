// Replays (plan B3, W6). The simulation is deterministic and logs every accepted command with its tick
// (src/commands.js `commandLog`), so a match replays exactly from its options and that log: build a fresh
// Simulation from the options, apply each command before the tick it arrived on, step 0.05 s at a time.
// Nothing new is stored in the simulation: the page remembers the options each match was built with
// (rememberOptions, beside the simulation, in a WeakMap) and reads the final hash once, when the match ends.
// The options must be the constructor's own: a saved match's options are not (a mission's AI speed is
// adjusted by the difficulty when it is built, and some missions raise it during play).
//
// A replay: { v: REPLAY_VERSION, save: SAVE_VERSION, app: game version, at, options, ticks, hash, log }
//   log: [[ticksSincePrevious, command]] (command without `tick`, and without `team` when it is 0)
// A replay made by another game version is refused with a message (replayProblem); one whose rules moved
// anyway is caught at its end, when the final hash differs.
import { SAVE_VERSION } from "../snapshot.js";

export const REPLAY_VERSION = 1;
export const TICK = 0.05;

export function packLog(log) {
  let last = 0;
  return log.map(({ tick, ...c }) => {
    const d = tick - last;
    last = tick;
    if (c.team === 0) delete c.team;
    return [d, c];
  });
}
export function unpackLog(packed) {
  if (!Array.isArray(packed)) return null;
  let tick = 0;
  const out = [];
  for (const item of packed) {
    if (!Array.isArray(item) || !Number.isInteger(item[0]) || item[0] < 0 || !item[1] || typeof item[1] !== "object") return null;
    tick += item[0];
    out.push({ tick, team: 0, ...item[1] });
  }
  return out;
}

// Options as JSON: non-finite numbers keep snapshot.js's marker ({ $n: "Infinity" }).
const encode = (key, value) => (typeof value === "number" && !Number.isFinite(value) ? { $n: String(value) } : value);
const revive = (key, value) => (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && typeof value.$n === "string" ? Number(value.$n) : value);
export const replayOptions = (replay) => JSON.parse(JSON.stringify(replay.options), revive);

// The options each simulation was built with (main.js createSim), copied when it is built.
const BUILT = new WeakMap();
export function rememberOptions(sim, options) {
  try { BUILT.set(sim, JSON.parse(JSON.stringify(options, encode))); } catch { /* not replayable */ }
  return sim;
}
export const optionsOf = (sim) => BUILT.get(sim) || null;

// The replay of a finished match: a simulation built from `options` at tick 0 and played in one sitting.
export function recordReplay(sim, { options = optionsOf(sim), app = "dev", at = 0, hash = sim.hash() } = {}) {
  if (!options) return null;
  return { v: REPLAY_VERSION, save: SAVE_VERSION, app: String(app), at, options: JSON.parse(JSON.stringify(options, encode)), ticks: sim.ticks, hash, log: packLog(sim.commandLog) };
}

// Why a stored replay cannot be watched by this game (null when it can).
export function replayProblem(replay, app = "dev") {
  if (!replay || typeof replay !== "object" || !replay.options || !Number.isInteger(replay.ticks) || typeof replay.hash !== "string" || !unpackLog(replay.log)) return "This replay is damaged and cannot be played.";
  if (replay.v !== REPLAY_VERSION || replay.save !== SAVE_VERSION || String(replay.app) !== String(app)) return `This replay was recorded with version ${replay.app} and cannot be played in version ${app}.`;
  return null;
}

// Feeds a replay's commands into a simulation, tick by tick. `send(command)` applies one (the viewer sends
// through the real command door; the replay's own commands are the only ones accepted while it plays).
export function replayFeeder(replay) {
  const log = unpackLog(replay.log) || [];
  let next = 0;
  return {
    // Every command logged for the tick the simulation is about to step.
    feed(sim, send) {
      while (next < log.length && log[next].tick < sim.ticks) next++;
      while (next < log.length && log[next].tick === sim.ticks) { const { tick, ...c } = log[next++]; send(c); }
    },
    get left() { return log.length - next; },
    // Where a replay stands: "playing", "ok" (the end matches), or "drift" (the rules changed since).
    status(sim, hash = () => sim.hash()) {
      if (sim.ticks < replay.ticks) return sim.result ? "drift" : "playing";
      return sim.ticks === replay.ticks && hash() === replay.hash ? "ok" : "drift";
    },
  };
}

// The whole replay at once (tests, tools): { sim, status }.
export function runReplay(Simulation, replay) {
  const sim = new Simulation(replayOptions(replay)), feeder = replayFeeder(replay);
  while (!sim.result && sim.ticks < replay.ticks) {
    feeder.feed(sim, (c) => sim.command(c));
    sim.tick(TICK);
    sim.events.length = 0;
  }
  return { sim, status: feeder.status(sim) };
}
