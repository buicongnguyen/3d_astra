// First-minute hooks check (AAA round 3, R3-Q). No browser: the test bots play the new content.
//  - Quick battle: the bot (tools/playbot.mjs) plays the one-tap setup (Relaxed, one rival of another
//    faction) as each of the five factions, on Riverlands (the Quick battle map) and on Classic and
//    Dunes, with four attack thresholds. Every match must be won (owner: two rivals are already hard,
//    so this one is a fun, winnable 1v1), and the first combat must come by 45 s.
//  - First watch: the Defence bot plays Gorge Road's new-player variant on every difficulty. The first
//    combat must come by 60 s, the bot must still reach the level's target stars, and on Standard its
//    crews catch the Scout Runner.
// Deterministic. Usage: node tests/quick-battle-check.mjs [--json out.json]   (npm run test:quick-battle-check)
import fs from "node:fs";
import { Simulation } from "../src/simulation.js";
import { PlayBot } from "../tools/playbot.mjs";
import { DefenceBot } from "../tools/defence-bot.mjs";
import { skirmishSides } from "../src/factions.js";
import { QUICK_SETUP, quickRival } from "../src/sim/content/quick-battle.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { firstWatchLevel } from "../src/defence/first-watch.js";

const TICK = 0.05, CAP = 2400, QUICK_LIMIT = 45, DEFENCE_LIMIT = 60;
const FACTIONS = ["meridian", "ashfall", "sunward", "wardens", "veil"];
const args = process.argv.slice(2), json = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const firstShot = (s, e) => e.type === "shot" && (e.team === 0 || s.get(e.target)?.team === 0);
const failures = [];
const started = Date.now();

function quick(player, map, attackAt) {
  const s = new Simulation({ map, aiSpeed: QUICK_SETUP.aiSpeed, enemyCount: QUICK_SETUP.enemyCount, alliance: QUICK_SETUP.alliance, capturePoints: true, factions: skirmishSides(player, quickRival(player), 1, map), rules: { quick: "on" } });
  const bot = new PlayBot(s, { attackAt });
  let combat = null;
  while (s.time < CAP && !s.result) {
    bot.step();
    s.tick(TICK);
    for (const e of s.events) { bot.see(e); if (combat === null && firstShot(s, e)) combat = s.time; }
    s.events.length = 0;
  }
  return { player, rival: quickRival(player), map, attackAt, result: s.result || "timeout", seconds: Math.round(s.time), combat: combat === null ? null : Math.round(combat * 10) / 10 };
}

function defence(level, difficulty) {
  const s = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
  const bot = new DefenceBot(s, {});
  let combat = null;
  for (let i = 0; i < 1500 * 20 && !s.result; i++) {
    bot.step(TICK);
    s.tick(TICK);
    for (const e of s.events) if (combat === null && firstShot(s, e)) combat = s.time;
    s.events.length = 0;
  }
  const medal = s.result === "victory" ? s.mission.medal : null;
  return { level: level.id, variant: level.defence.runner ? "first-watch" : "designed", difficulty, result: s.result || "timeout", lives: s.defence.lives, stars: { gold: 3, silver: 2, bronze: 1 }[medal] || 0, combat: combat === null ? null : Math.round(combat * 10) / 10, runner: s.defence.runner?.done || (s.defence.runner ? "escaped" : "none"), bounty: s.defence.bounty };
}

const rows = [];
for (const player of FACTIONS) for (const map of [QUICK_SETUP.map, "classic", "dunes"]) for (const attackAt of [12, 16, 20, 24]) {
  const r = quick(player, map, attackAt);
  rows.push(r);
  if (r.result !== "victory") failures.push(`Quick battle ${player} vs ${r.rival} on ${map} (attack at ${attackAt}): ${r.result} at ${r.seconds} s`);
  if (r.combat === null || r.combat > QUICK_LIMIT) failures.push(`Quick battle ${player} on ${map}: first combat at ${r.combat} s (limit ${QUICK_LIMIT})`);
}
const gorge = DEFENCE_LEVELS[0], fw = firstWatchLevel(), defenceRows = [];
for (const difficulty of ["story", "standard", "veteran"]) {
  const designed = defence(gorge, difficulty), first = defence(fw, difficulty);
  defenceRows.push(designed, first);
  if (first.combat === null || first.combat > DEFENCE_LIMIT) failures.push(`First watch ${difficulty}: first combat at ${first.combat} s (limit ${DEFENCE_LIMIT})`);
  if (first.result !== "victory" || first.stars < gorge.check[difficulty]) failures.push(`First watch ${difficulty}: ${first.result}, ${first.stars} stars (target ${gorge.check[difficulty]})`);
  if (difficulty === "standard" && first.runner !== "caught") failures.push(`First watch standard: the runner ${first.runner}`);
}

const wins = rows.filter((r) => r.result === "victory").length, combats = rows.map((r) => r.combat ?? Infinity);
const summary = {
  quick: { games: rows.length, wins, firstCombat: { min: Math.min(...combats), max: Math.max(...combats) }, onRiverlands: rows.filter((r) => r.map === QUICK_SETUP.map).map((r) => r.combat) },
  defence: defenceRows,
};
console.log(JSON.stringify(summary, null, 1));
if (json) fs.writeFileSync(json, JSON.stringify({ rows, summary }, null, 1));
console.log(`quick-battle-check: ${rows.length + defenceRows.length} matches in ${Math.round((Date.now() - started) / 1000)} s`);
if (failures.length) {
  console.error(`FAIL quick-battle-check\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS quick-battle-check");
