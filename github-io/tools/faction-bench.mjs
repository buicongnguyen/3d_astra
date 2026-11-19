// Faction balance bench. Deterministic: the simulation has no random numbers.
//   node tools/faction-bench.mjs                      round robin, AI against AI, every pair in both seats
//   node tools/faction-bench.mjs --enemy ashfall      the test bot (two builds) against one faction's AI
//                                --player veil        ...with the test bot commanding another faction
// Options: --maps classic,riverlands,dunes  --speeds normal,fast  --factions meridian,ashfall  --cap 1800 (seconds)
//          --json out.json  (the rows; no wall-clock field)
//          --jobs 3         plays the matches in 3 forked processes; rows are printed and saved in the
//                           single-process order, so the output and the JSON equal a one-process run
//          --rules '{"roster":"expanded"}'  skirmish rules for every match (new Simulation({ rules }); round 2)
import fs from 'node:fs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Simulation } from '../src/simulation.js';
import { PlayBot } from './playbot.mjs';
const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const maps = arg('--maps', 'classic,riverlands,dunes').split(','), speeds = arg('--speeds', 'normal,fast').split(',');
const CAP = Number(arg('--cap', 1800)), TICK = 0.05, FACTIONS = ['meridian', 'ashfall', 'sunward', 'wardens', 'veil'];
const RULES = args.includes('--rules') ? JSON.parse(arg('--rules')) : null, withRules = RULES ? { rules: RULES } : {};
const JOBS = Math.max(1, Number(arg('--jobs', 1)) || 1);
const strength = (s, team) => s.own(team).reduce((n, e) => n + (e.kind === 'unit' ? (e.pop || 1) * 20 : 0) + (e.kind === 'building' && e.complete ? 30 : 0), 0);
// Package 2.3: the bot's standard build against a build with more Rangers and towers.
const BUILDS = { standard: {}, 'rangers+towers': { towers: 4, rangerShare: 4 } };
const enemyMode = args.includes('--enemy'), enemy = arg('--enemy', 'ashfall'), player = arg('--player', 'meridian');
const only = arg('--factions', FACTIONS.join(',')).split(',');

// Every match of the run, in the order its rows are printed and saved.
function matches() {
  const out = [];
  // --player wardens: the test bot commands that faction (skirmish "Your faction"); default Meridian.
  if (enemyMode) for (const build of Object.keys(BUILDS)) for (const speed of speeds) for (const map of maps) for (const attackAt of [12, 16, 20, 24]) out.push({ build, speed, map, attackAt });
  else for (const speed of speeds) for (const map of maps) for (const a of only) for (const b of only) if (a !== b) out.push({ speed, map, a, b });
  return out;
}

// Plays one match and returns its row.
function play(m) {
  if (enemyMode) {
    const s = new Simulation({ map: m.map, aiSpeed: m.speed, factions: { 0: player, 1: enemy }, ...withRules }), bot = new PlayBot(s, { attackAt: m.attackAt, ...BUILDS[m.build] });
    while (s.time < CAP && !s.result) { bot.step(); s.tick(TICK); for (const e of s.events) bot.see(e); s.events.length = 0; }
    return { player, enemy, build: m.build, speed: m.speed, map: m.map, attackAt: m.attackAt, result: s.result || 'timeout', seconds: Math.round(s.time) };
  }
  const { a, b } = m;
  const s = new Simulation({ map: m.map, aiSpeed: m.speed, factions: { 0: a, 1: b }, aiPlayer: true, ...withRules });
  while (s.time < CAP && !s.result) { s.tick(TICK); s.events.length = 0; }
  // A match still running at the cap goes to the side with clearly more left; otherwise it is a draw.
  let winner = s.result === 'victory' ? a : s.result === 'defeat' ? b : null;
  if (!s.result) { const x = strength(s, 0), y = strength(s, 1); if (x > y * 1.3) winner = a; else if (y > x * 1.3) winner = b; }
  return { speed: m.speed, map: m.map, seat0: a, seat1: b, result: s.result || 'timeout', winner, seconds: Math.round(s.time) };
}

// Plays every match, here or in JOBS forked processes, and prints each row once every row before it
// is in, so the lines come out in the same order either way. Returns the rows in that order.
async function playAll(list) {
  const rows = new Array(list.length);
  let printed = 0;
  const land = (i, row) => { rows[i] = row; while (printed < rows.length && rows[printed]) console.log(JSON.stringify(rows[printed++])); };
  if (JOBS === 1) { list.forEach((m, i) => land(i, play(m))); return rows; }
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, () => new Promise((done, fail) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker', ...args], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const send = () => { if (next < list.length) { const i = next++; child.send({ i, match: list[i] }); } else child.disconnect(); };
    child.on('message', ({ i, row }) => { land(i, row); send(); });
    child.on('exit', (code) => (code ? fail(new Error(`bench worker exited with ${code}`)) : done()));
    send();
  })));
  return rows;
}

if (args.includes('--worker')) process.on('message', ({ i, match }) => process.send({ i, row: play(match) }));
else {
  const rows = await playAll(matches());
  if (enemyMode) {
    for (const build of Object.keys(BUILDS)) for (const speed of speeds) {
      const set = rows.filter((r) => r.build === build && r.speed === speed);
      console.log(JSON.stringify({ summary: build, enemy, speed, games: set.length, winRate: Math.round(100 * set.filter((r) => r.result === 'victory').length / set.length) }));
    }
  } else {
    for (const f of only) {
      const mine = rows.filter((r) => r.seat0 === f || r.seat1 === f), wins = mine.filter((r) => r.winner === f).length, draws = mine.filter((r) => !r.winner).length;
      console.log(JSON.stringify({ summary: f, games: mine.length, wins, draws, losses: mine.length - wins - draws, score: Math.round(100 * (wins + draws / 2) / mine.length) }));
    }
  }
  if (args.includes('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 1));
}
