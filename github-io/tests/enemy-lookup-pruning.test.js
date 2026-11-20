import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

test('enemy() prunes by distance before hostile/fog checks', () => {
  const s = new Simulation({ ai: false });
  const e = s.entities.find((x) => x.kind === 'unit' && x.team === 0 && x.vision);
  assert.ok(e);
  let calls = 0;
  const orig = s.isVisible.bind(s);
  s.isVisible = (...a) => { calls++; return orig(...a); };
  const far = s.entities.filter((t) => Math.hypot(t.x - e.x, t.z - e.z) - t.radius > e.vision + 1).length;
  assert.ok(far > 10);
  s.enemy(e);
  assert.ok(calls <= s.entities.length - far, `isVisible called ${calls} times`);
});

test('enemy() result unchanged: nearest visible hostile within radius', () => {
  const s = new Simulation({ ai: false });
  const e = s.entities.find((x) => x.kind === 'unit' && x.team === 0);
  const brute = (r) => {
    let best = null, bd = r;
    for (const t of s.entities) {
      if (t.hp <= 0 || !s.hostile(e.team, t.team) || !s.isVisible(t, e.team)) continue;
      const d = Math.hypot(t.x - e.x, t.z - e.z) - t.radius;
      if (d <= bd + 0.00001) { best = t; bd = d; }
    }
    return best;
  };
  for (const r of [5, 30, 200]) assert.equal(s.enemy(e, r), brute(r));
});
