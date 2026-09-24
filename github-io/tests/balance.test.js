import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DEFINITIONS as D} from '../src/data.js';

// Equal-cost battles in the real simulation (energy counted 1.5x, it is the scarcer resource).
// Each pair fights from both sides of the map; the result is the average share of army value
// the first type keeps minus the share the second keeps (+1 = first wins untouched).
const value = t => D[t].cost[0] + 1.5 * D[t].cost[1];
function battle(a, b, budget) {
  const s = new Simulation({ai: false, map: 'classic'});
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === 'unit') e.hp = 0;
  s.tick(0.05);
  const army = (t, team, z) => Array.from({length: Math.max(1, Math.round(budget / value(t)))}, (_, i) =>
    s.spawn(t, team, -30 + (i % 5) * 1.9, z + (team ? 1 : -1) * Math.floor(i / 5) * 1.9));
  const A = army(a, 0, -9), B = army(b, 1, 9);
  s.issue(A.map(u => u.id), {type: 'attackmove', x: -26, z: 14});
  s.issue(B.map(u => u.id), {type: 'attackmove', x: -26, z: -14});
  for (let t = 0; t < 150 && A.some(u => u.hp > 0) && B.some(u => u.hp > 0); t += 0.05) s.tick(0.05);
  const kept = us => us.reduce((n, u) => n + Math.max(0, u.hp + u.shield) / (u.maxHp + u.maxShield), 0) / us.length;
  return kept(A) - kept(B);
}
const matchup = (a, b, budget = 1000) => (battle(a, b, budget) - battle(b, a, budget)) / 2;

test('equal-cost counters hold: each unit type has prey and a predator', () => {
  for (const [winner, loser] of [
    ['vanguard', 'ranger'], ['ranger', 'breaker'], ['breaker', 'vanguard'],
    ['antitank', 'tank'], ['antitank', 'breaker'], ['tank', 'ranger'], ['vanguard', 'antitank'],
  ]) assert.ok(matchup(winner, loser) > 0.25, `${winner} should beat ${loser} at equal cost`);
});

test('the Battle tank is worth its price: splash, 12 m range, beats Vanguard swarms at scale', () => {
  assert.equal(D.tank.range, 12);
  assert.ok(D.tank.splash_radius > 0 && D.tank.splash_damage > 0);
  assert.ok(matchup('tank', 'vanguard', 2400) > 0.2, 'tanks beat an equal-cost Vanguard swarm');
  assert.ok(matchup('tank', 'breaker') > -0.2, 'tank is at least even with the cheaper artillery');
});
