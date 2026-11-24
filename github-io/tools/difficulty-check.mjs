// Difficulty check (AAA round 3, owner 2026-11-21: "it is not easy to win, quite difficult to win against
// 2 AIs, so don't make it too hard"). The test bot (tools/playbot.mjs) plays one rival (1v1) and two rivals
// (1v2) at every AI speed, on three maps, with four attack thresholds. Deterministic: the simulation has no
// random numbers, so the same source gives the same rows.
// Usage: node tools/difficulty-check.mjs [--rules '{"aiPlan":"field","roster":"expanded"}'] [--jobs 3]
//   --speeds relaxed,normal,fast,relentless   --maps classic,riverlands,dunes   --attack-at 12,16,20,24
//   --setups 1v1,1v2,1v2ffa   1v2 is "United against you" (coalition); 1v2ffa is two rivals free-for-all
//   --enemy veil      every rival plays this faction (default Meridian, as before)
//   --no-points       no capture points (the skirmish screen always has them, as tools/skirmish-bench.mjs)
//   --cap 2400        seconds of game time before a match is stopped (a timeout counts as not a win)
//   --json out.json   the rows and summaries (no wall-clock field)
//   --compare a.json  prints this run's win rates next to a saved run's, and exits 1 when a setup/speed
//                     lost more than --margin matches (default 1) against it: the difficulty gate
import fs from 'node:fs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Simulation } from '../src/simulation.js';
import { PlayBot } from './playbot.mjs';
const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback), list = (name, fallback) => arg(name, fallback).split(',');
const CAP = Number(arg('--cap', 2400)), TICK = 0.05;
const RULES = args.includes('--rules') ? JSON.parse(arg('--rules')) : null;
const ENEMY = arg('--enemy', null);
const JOBS = Math.max(1, Number(arg('--jobs', 1)) || 1), MARGIN = Number(arg('--margin', 1));
const SETUPS = { '1v1': { enemyCount: 1, alliance: 'ffa' }, '1v2': { enemyCount: 2, alliance: 'coalition' }, '1v2ffa': { enemyCount: 2, alliance: 'ffa' } };
const setups = list('--setups', '1v1,1v2'), speeds = list('--speeds', 'relaxed,normal,fast,relentless');
const matches = setups.flatMap((setup) => speeds.flatMap((speed) => list('--maps', 'classic,riverlands,dunes').flatMap((map) => list('--attack-at', '12,16,20,24').map(Number).map((attackAt) => ({ setup, speed, map, attackAt })))));

function play({ setup, speed, map, attackAt }) {
  const s = new Simulation({ map, aiSpeed: speed, capturePoints: !args.includes('--no-points'), ...SETUPS[setup], ...(RULES ? { rules: RULES } : {}), ...(ENEMY ? { factions: { 1: ENEMY, 2: ENEMY } } : {}) });
  const bot = new PlayBot(s, { attackAt });
  while (s.time < CAP && !s.result) {
    bot.step(); s.tick(TICK);
    for (const e of s.events) bot.see(e);
    s.events.length = 0;
  }
  return { setup, speed, map, attackAt, result: s.result || 'timeout', seconds: Math.round(s.time) };
}

async function playAll() {
  const rows = new Array(matches.length);
  let printed = 0;
  const land = (i, row) => { rows[i] = row; while (printed < rows.length && rows[printed]) console.log(JSON.stringify(rows[printed++])); };
  if (JOBS === 1) { matches.forEach((m, i) => land(i, play(m))); return rows; }
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, matches.length) }, () => new Promise((done, fail) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker', ...args], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const send = () => { if (next < matches.length) { const i = next++; child.send({ i, match: matches[i] }); } else child.disconnect(); };
    child.on('message', ({ i, row }) => { land(i, row); send(); });
    child.on('exit', (code) => (code ? fail(new Error(`difficulty worker exited with ${code}`)) : done()));
    send();
  })));
  return rows;
}

const summarise = (rows) => setups.flatMap((setup) => speeds.map((speed) => {
  const set = rows.filter((r) => r.setup === setup && r.speed === speed), wins = set.filter((r) => r.result === 'victory').length;
  return { summary: `${setup} ${speed}`, setup, speed, games: set.length, wins, winRate: Math.round(100 * wins / Math.max(1, set.length)) };
}));

if (args.includes('--worker')) process.on('message', ({ i, match }) => process.send({ i, row: play(match) }));
else {
  const rows = await playAll(), summary = summarise(rows);
  for (const line of summary) console.log(JSON.stringify(line));
  if (args.includes('--json')) fs.writeFileSync(arg('--json'), JSON.stringify({ rules: RULES, cap: CAP, rows, summary }, null, 2) + '\n');
  if (args.includes('--compare')) {
    const before = JSON.parse(fs.readFileSync(arg('--compare'), 'utf8')).summary;
    let failed = 0;
    for (const now of summary) {
      const was = before.find((b) => b.setup === now.setup && b.speed === now.speed);
      if (!was) continue;
      const ok = now.wins >= was.wins - MARGIN;
      if (!ok) failed++;
      console.log(`${now.setup.padEnd(7)} ${now.speed.padEnd(11)} bot wins ${was.wins}/${was.games} -> ${now.wins}/${now.games}${ok ? '' : '  FAIL (harder)'}`);
    }
    if (failed) { console.error(`difficulty-check: ${failed} setup/speed rows got harder by more than ${MARGIN} match(es)`); process.exit(1); }
  }
}
