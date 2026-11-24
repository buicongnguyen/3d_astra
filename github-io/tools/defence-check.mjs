// Frontier Defence balance check: every level on every difficulty must be
//   won by the DefenceBot with at least its target stars (level.check[difficulty]),
//   lost by a passive player who builds nothing,
//   kept under 3 stars by a greedy player who builds one crew type only (on Story: on at most
//   STORY_GREEDY_MAX levels, since 2026-11-24);
// on river levels with demolition the bot that also blows a bridge must still reach its target;
// and Endless (standard, the level's own seed) must be held for at least ENDLESS_MIN waves.
// Heroic rows (AAA round 2, W2-B), only with --heroic (script test:defence-heroic-check; the build job runs without it):
// the bot wins each Heroic variant on Standard with at least HEROIC_LIVES_LEFT lives left, a passive player loses by
// wave 3, and a greedy single-crew player loses on at least HEROIC_GREEDY_LOSE levels (a level counts when most of
// its crews lose).
// Usage: node tools/defence-check.mjs [--level d-gorge] [--difficulty standard] [--no-endless] [--json] [--heroic]
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { seedOf } from "../src/sim/defence.js";
import { playDefence } from "./defence-bot.mjs";
import { hasHeroic } from "../src/defence/heroic.js";

const HEROIC_LIVES_LEFT = 2, HEROIC_GREEDY_LOSE = 5;

// Endless runs stop here (they are scored, not won); the bot must hold at least ENDLESS_MIN.
const ENDLESS_CAP = 40, ENDLESS_MIN = 15;
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const levels = DEFENCE_LEVELS.filter((l) => !arg("level") || l.id === arg("level"));
const difficulties = arg("difficulty") ? [arg("difficulty")] : ["story", "standard", "veteran"];
const rows = [], failures = [];
const heroicOnly = process.argv.includes("--heroic");
let greedyLost = 0, heroicLevels = 0;
// Story levels on which a single-crew player may reach 3★ (see the greedy rule below; was 0 before 2026-11-24).
const STORY_GREEDY_MAX = 4, storyGreedy = [];
for (const level of levels) {
  if (heroicOnly) {
    if (!hasHeroic(level.id)) continue;
    const h = defenceVariant(level, { variant: "heroic" });
    const bot = playDefence(h, {}), passive = playDefence(h, { policy: "passive" });
    const greedy = h.defence.crews.filter((c) => c !== "watcher").map((crew) => ({ crew, ...playDefence(h, { policy: "greedy", crew }) }));
    heroicLevels++;
    if (greedy.filter((g) => g.result !== "victory").length * 2 > greedy.length) greedyLost++;
    rows.push({ level: level.id, difficulty: "heroic", bot: `${bot.result} ${bot.lives}♥ w${bot.wave}`, passive: `${passive.result} w${passive.wave}`, greedy: greedy.map((g) => `${g.crew}:${g.result[0]}${g.lives}♥`).join(" ") });
    if (bot.result !== "victory" || bot.lives < HEROIC_LIVES_LEFT) failures.push(`${level.id} heroic: bot ${bot.result} with ${bot.lives} lives left (< ${HEROIC_LIVES_LEFT})`);
    if (passive.result !== "defeat" || passive.wave > 3) failures.push(`${level.id} heroic: passive player ${passive.result} at wave ${passive.wave}`);
    continue;
  }
  for (const difficulty of difficulties) {
    const target = level.check[difficulty];
    const bot = playDefence(level, { difficulty });
    const passive = playDefence(level, { difficulty, policy: "passive" });
    const greedy = level.defence.crews.filter((c) => c !== "watcher").map((crew) => ({ crew, ...playDefence(level, { difficulty, policy: "greedy", crew }) }));
    const blow = level.defence.bridges ? playDefence(level, { difficulty, demolish: true }) : null;
    const row = { level: level.id, difficulty, target, bot: `${bot.result} ${bot.stars}★ ${bot.lives}♥ w${bot.wave} ${bot.towers}`, passive: `${passive.result} w${passive.wave}`, greedy: greedy.map((g) => `${g.crew}:${g.stars}★${g.lives}♥`).join(" ") };
    if (blow) row.demolish = `${blow.result} ${blow.stars}★ ${blow.lives}♥ ${Object.entries(blow.sim.crossings || {}).map(([x, c]) => `${x}:${c.state}`).join(",")}`;
    rows.push(row);
    if (bot.result !== "victory" || bot.stars < target) failures.push(`${level.id} ${difficulty}: bot ${bot.result} ${bot.stars}★ < ${target}★`);
    if (blow && (blow.result !== "victory" || blow.stars < target)) failures.push(`${level.id} ${difficulty}: demolishing bot ${blow.result} ${blow.stars}★ < ${target}★`);
    if (passive.result !== "defeat") failures.push(`${level.id} ${difficulty}: passive player ${passive.result}`);
    // Story (2026-11-24, defence pads): longer reach for the short-range crews lets one crew type
    // carry a few levels to 3★ on the easiest difficulty. Story is meant to be forgiving (owner: never
    // make Relaxed/Normal harder), so there it only counts across levels (STORY_GREEDY_MAX); Standard
    // and Veteran keep the strict rule.
    for (const g of greedy) if (g.stars >= 3) { if (difficulty === "story") storyGreedy.push(`${level.id} ${g.crew}`); else failures.push(`${level.id} ${difficulty}: ${g.crew}-only reached 3★`); }
  }
  if (!process.argv.includes("--no-endless")) {
    const endless = playDefence(defenceVariant(level, { variant: "endless", seed: seedOf(level.id) }), { limit: 6000, maxWaves: ENDLESS_CAP });
    rows.push({ level: level.id, difficulty: "endless", held: endless.held, result: endless.result });
    if (endless.held < ENDLESS_MIN) failures.push(`${level.id} endless: held ${endless.held} < ${ENDLESS_MIN}`);
  }
}
if (new Set(storyGreedy.map((g) => g.split(" ")[0])).size > STORY_GREEDY_MAX) failures.push(`story: single-crew 3★ on more than ${STORY_GREEDY_MAX} levels (${storyGreedy.join(", ")})`);
if (heroicOnly && greedyLost < Math.min(HEROIC_GREEDY_LOSE, heroicLevels)) failures.push(`heroic: single-crew play loses on ${greedyLost} levels (< ${HEROIC_GREEDY_LOSE})`);
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log(r.difficulty === "heroic" ? `${r.level.padEnd(14)} heroic   bot ${r.bot} | passive ${r.passive} | greedy ${r.greedy}` : r.difficulty === "endless"
  ? `${r.level.padEnd(14)} endless  held ${r.held >= ENDLESS_CAP ? `${r.held}+ waves (stopped at the cap)` : `${r.held} waves (lost)`}`
  : `${r.level.padEnd(14)} ${r.difficulty.padEnd(8)} target ${r.target}★ | bot ${r.bot} | passive ${r.passive} | greedy ${r.greedy}${r.demolish ? ` | demolish ${r.demolish}` : ""}`);
if (failures.length) { console.log(`\nFAIL\n${failures.join("\n")}`); process.exitCode = 1; }
else console.log("\nPASS");
