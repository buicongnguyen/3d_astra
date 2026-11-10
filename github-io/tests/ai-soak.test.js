import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

// Ten simulated minutes with no human: team 0's slot is played by the same AI (updateAI(0) on the rivals'
// cadence), so every team keeps playing and fights. Each living team must always harvest, spend, grow an
// army and never sit on a stalled full queue.
const SCENARIOS = [
  ['classic', 1, 'relaxed', 'ffa'], ['classic', 1, 'normal', 'ffa'], ['classic', 1, 'fast', 'ffa'], ['classic', 1, 'relentless', 'ffa'],
  ['riverlands', 2, 'normal', 'ffa'], ['basin', 3, 'fast', 'coalition'], ['highlands', 2, 'relentless', 'coalition'], ['basin', 1, 'normal', 'ffa'],
];
const TICK = 0.05, MINUTES = 10;

const gathering = (w) => w.orders.length && ['gather', 'deliver', 'build'].includes(w.orders[0].type);

for (const [map, enemyCount, aiSpeed, alliance] of SCENARIOS) {
  test(`soak ${map} x${enemyCount} ${aiSpeed} ${alliance}: every AI harvests, spends, grows, never stalls`, () => {
    const s = new Simulation({ map, enemyCount, aiSpeed, alliance });
    const think = s.pace.think, problems = [], peaks = new Map();
    let clock = 0, sample = 0;
    for (let i = 0; i < (MINUTES * 60) / TICK && !s.result; i++) {
      s.tick(TICK);
      s.events.length = 0;
      clock += TICK;
      // The idle human slot is a punching bag: its core is kept whole so the match runs the full ten minutes.
      for (const e of s.own(0)) if (e.type === 'hq') e.hp = e.maxHp;
      if (clock >= think) { clock = 0; if (!s.players[0].eliminated) s.updateAI(0); }
      if (s.time - sample < 20 || s.time < 120) continue;
      sample = s.time;
      for (let team = 0; team < s.players.length; team++) {
        if (s.players[team].eliminated || !s.own(team).some((e) => e.type === 'hq')) continue;
        const own = s.own(team), workers = own.filter((e) => e.type === 'worker');
        const army = own.filter((e) => e.kind === 'unit' && e.type !== 'worker').length;
        peaks.set(team, Math.max(peaks.get(team) || 0, army));
        const busy = workers.filter(gathering).length;
        if (workers.length >= 4 && busy < workers.length * 0.7) problems.push(`t=${Math.round(s.time)} team ${team}: only ${busy}/${workers.length} workers busy`);
        if (s.players[team].alloy >= 900) problems.push(`t=${Math.round(s.time)} team ${team}: alloy ${Math.round(s.players[team].alloy)} unspent`);
        for (const b of own.filter((e) => e.kind === 'building' && e.complete && e.queue?.length >= 5))
          if (b.queue[0].blocked && s.time - (b.fullSince ??= s.time) > 40) problems.push(`t=${Math.round(s.time)} team ${team}: ${b.type} stalled with a full queue (${b.queue[0].blocked})`);
          else if (!b.queue[0].blocked) b.fullSince = undefined;
      }
    }
    assert.deepEqual(problems.slice(0, 5), [], problems.length + ' problems');
    for (let team = 1; team < s.players.length; team++)
      if (!s.players[team].eliminated) assert.ok((peaks.get(team) || 0) >= 8, `team ${team} grew an army (peak ${peaks.get(team)})`);
  });
}
