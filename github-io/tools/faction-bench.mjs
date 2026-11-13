// Faction balance bench. Deterministic: the simulation has no random numbers.
//   node tools/faction-bench.mjs                      round robin, AI against AI, every pair in both seats
//   node tools/faction-bench.mjs --enemy ashfall      the test bot (two builds) against one faction's AI
//                                --player veil        ...with the test bot commanding another faction
// Options: --maps classic,riverlands,dunes  --speeds normal,fast  --cap 1800 (seconds)  --json out.json
import fs from 'node:fs';
import { Simulation } from '../src/simulation.js';
import { PlayBot } from './playbot.mjs';
const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const maps = arg('--maps', 'classic,riverlands,dunes').split(','), speeds = arg('--speeds', 'normal,fast').split(',');
const CAP = Number(arg('--cap', 1800)), TICK = 0.05, FACTIONS = ['meridian', 'ashfall', 'sunward', 'wardens', 'veil'];
const strength = (s, team) => s.own(team).reduce((n, e) => n + (e.kind === 'unit' ? (e.pop || 1) * 20 : 0) + (e.kind === 'building' && e.complete ? 30 : 0), 0);
const rows = [];
if (args.includes('--enemy')) {
  // Package 2.3: the bot's standard build against a build with more Rangers and towers.
  // --player wardens: the test bot commands that faction (skirmish "Your faction"); default Meridian.
  const enemy = arg('--enemy', 'ashfall'), player = arg('--player', 'meridian');
  for (const build of [{ name: 'standard', options: {} }, { name: 'rangers+towers', options: { towers: 4, rangerShare: 4 } }])
    for (const speed of speeds) for (const map of maps) for (const attackAt of [12, 16, 20, 24]) {
      const s = new Simulation({ map, aiSpeed: speed, factions: { 0: player, 1: enemy } }), bot = new PlayBot(s, { attackAt, ...build.options });
      while (s.time < CAP && !s.result) { bot.step(); s.tick(TICK); for (const e of s.events) bot.see(e); s.events.length = 0; }
      const row = { player, enemy, build: build.name, speed, map, attackAt, result: s.result || 'timeout', seconds: Math.round(s.time) };
      rows.push(row); console.log(JSON.stringify(row));
    }
  for (const build of ['standard', 'rangers+towers']) for (const speed of speeds) {
    const set = rows.filter((r) => r.build === build && r.speed === speed);
    console.log(JSON.stringify({ summary: build, enemy, speed, games: set.length, winRate: Math.round(100 * set.filter((r) => r.result === 'victory').length / set.length) }));
  }
} else {
  const only = arg('--factions', FACTIONS.join(',')).split(',');
  for (const speed of speeds) for (const map of maps) for (const a of only) for (const b of only) {
    if (a === b) continue;
    const s = new Simulation({ map, aiSpeed: speed, factions: { 0: a, 1: b }, aiPlayer: true });
    while (s.time < CAP && !s.result) { s.tick(TICK); s.events.length = 0; }
    // A match still running at the cap goes to the side with clearly more left; otherwise it is a draw.
    let winner = s.result === 'victory' ? a : s.result === 'defeat' ? b : null;
    if (!s.result) { const x = strength(s, 0), y = strength(s, 1); if (x > y * 1.3) winner = a; else if (y > x * 1.3) winner = b; }
    const row = { speed, map, seat0: a, seat1: b, result: s.result || 'timeout', winner, seconds: Math.round(s.time) };
    rows.push(row); console.log(JSON.stringify(row));
  }
  for (const f of only) {
    const mine = rows.filter((r) => r.seat0 === f || r.seat1 === f), wins = mine.filter((r) => r.winner === f).length, draws = mine.filter((r) => !r.winner).length;
    console.log(JSON.stringify({ summary: f, games: mine.length, wins, draws, losses: mine.length - wins - draws, score: Math.round(100 * (wins + draws / 2) / mine.length) }));
  }
}
if (args.includes('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 1));
