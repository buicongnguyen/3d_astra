// Skirmish timing: the PlayBot (marches at 16 fighters) against one AI on four maps and three
// speeds. Prints the result, game time of the ending and wall-clock ms per simulation tick.
// Usage: node tools/skirmish-bench.mjs [--speeds relaxed,normal] [--maps classic,basin]
import { Simulation } from "../src/simulation.js";
import { PlayBot } from "./playbot.mjs";

const args = process.argv.slice(2), value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback).split(",");
const CAP = 40 * 60, TICK = 0.05;
for (const speed of value("--speeds", "relaxed,normal,fast")) for (const map of value("--maps", "classic,riverlands,basin,highlands")) {
  const s = new Simulation({ map, aiSpeed: speed, capturePoints: !args.includes("--no-points") });
  const bot = new PlayBot(s, { attackAt: 16 });
  const t0 = performance.now();
  let i = 0;
  for (; i < CAP / TICK && !s.result; i++) {
    bot.step();
    s.tick(TICK);
    for (const e of s.events) bot.see(e);
  }
  const ms = performance.now() - t0;
  console.log(`${speed.padEnd(8)} ${map.padEnd(10)} ${String(s.result).padEnd(8)} t=${Math.round(s.time)}s  ${(ms / i).toFixed(3)} ms/tick`);
}
