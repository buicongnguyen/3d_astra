import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

const advance = (s, sec) => { for (let i = 0; i < sec * 20 && !s.result; i++) s.tick(0.05); };
const rich = (s) => Object.assign(s.players[0], { alloy: 5000, energy: 5000 });

test('second research tier needs its first tier and a level 2 Foundry, then stacks', () => {
  const s = new Simulation({ ai: false });
  const f = s.spawn('foundry', 0, -10, 32);
  rich(s);
  assert.equal(s.enqueue(f.id, 'upgrade2'), false, 'locked until a Foundry is level 2');
  f.level = 2;
  assert.equal(s.enqueue(f.id, 'upgrade2'), false, 'needs Overcharged weapons first');
  assert.equal(s.enqueue(f.id, 'plating2'), false, 'needs Reinforced plating first');
  s.players[0].upgrade = true;
  const unit = s.spawn('vanguard', 0, 0, 0), before = s.attackValue(unit);
  assert.equal(s.enqueue(f.id, 'plating2'), false, 'the other branch stays locked');
  assert.equal(s.enqueue(f.id, 'upgrade2'), true);
  assert.equal(s.enqueue(f.id, 'upgrade2'), false, 'only once');
  advance(s, 45);
  assert.equal(s.players[0].upgrade2, true);
  assert.ok(Math.abs(s.attackValue(unit) / before - 1.08) < 1e-9, 'a further 8%');
});

test('plating II lowers damage taken again and survives a save', () => {
  const s = new Simulation({ ai: false });
  s.players[0].plating = true;
  const u = s.spawn('vanguard', 0, 0, 0);
  s.applyDamage(u, 100, 1); const one = u.maxHp + u.shield - u.hp - u.shield;
  u.hp = u.maxHp; u.shield = 0;
  s.players[0].plating2 = true;
  const hp = u.hp; s.applyDamage(u, 100, 1);
  assert.ok(Math.abs((hp - u.hp) - 100 * 0.88 * 0.92) < 1e-6, 'damage 100 becomes about 81');
  assert.ok(one >= 0);
  const r = Simulation.load(s.serialize());
  assert.equal(r.players[0].plating2, true);
});
