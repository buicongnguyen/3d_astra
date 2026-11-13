// Frontier Defence balance check: every level on every difficulty must be
//   won by the DefenceBot with at least its target stars (level.check[difficulty]),
//   lost by a passive player who builds nothing,
//   kept under 3 stars by a greedy player who builds one crew type only.
// Usage: node tools/defence-check.mjs [--level d-gorge] [--difficulty standard] [--json]
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { playDefence } from "./defence-bot.mjs";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const levels = DEFENCE_LEVELS.filter((l) => !arg("level") || l.id === arg("level"));
const difficulties = arg("difficulty") ? [arg("difficulty")] : ["story", "standard", "veteran"];
const rows = [], failures = [];
for (const level of levels)
  for (const difficulty of difficulties) {
    const target = level.check[difficulty];
    const bot = playDefence(level, { difficulty });
    const passive = playDefence(level, { difficulty, policy: "passive" });
    const greedy = level.defence.crews.filter((c) => c !== "watcher").map((crew) => ({ crew, ...playDefence(level, { difficulty, policy: "greedy", crew }) }));
    const row = { level: level.id, difficulty, target, bot: `${bot.result} ${bot.stars}★ ${bot.lives}♥ w${bot.wave} ${bot.towers}`, passive: `${passive.result} w${passive.wave}`, greedy: greedy.map((g) => `${g.crew}:${g.stars}★${g.lives}♥`).join(" ") };
    rows.push(row);
    if (bot.result !== "victory" || bot.stars < target) failures.push(`${level.id} ${difficulty}: bot ${bot.result} ${bot.stars}★ < ${target}★`);
    if (passive.result !== "defeat") failures.push(`${level.id} ${difficulty}: passive player ${passive.result}`);
    for (const g of greedy) if (g.stars >= 3) failures.push(`${level.id} ${difficulty}: ${g.crew}-only reached 3★`);
  }
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log(`${r.level.padEnd(10)} ${r.difficulty.padEnd(8)} target ${r.target}★ | bot ${r.bot} | passive ${r.passive} | greedy ${r.greedy}`);
if (failures.length) { console.log(`\nFAIL\n${failures.join("\n")}`); process.exitCode = 1; }
else console.log("\nPASS");
