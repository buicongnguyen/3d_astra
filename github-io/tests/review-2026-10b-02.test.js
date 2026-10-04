import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('attack-move is not cancelled by a visible but unreachable enemy', () => {
  const s = new Simulation({ai:false});
  s.spawn('worker', 1, 6, 20);
  for (let i = 0; i < 14; i++) s.spawnWall(6 + Math.cos(i * Math.PI / 7) * 3.2, 20 + Math.sin(i * Math.PI / 7) * 3.2, 1.6);
  const u = s.spawn('vanguard', 0, 0, 20);
  s.nav.rebuild(s.entities); s.updateVision();
  s.issue([u.id], {type:'attackmove', x:30, z:20});
  for (let i = 0; i < 1600 && u.orders.length; i++) s.tick(.05);
  assert.ok(Math.hypot(u.x - 30, u.z - 20) < 3, `reached destination, at ${u.x},${u.z}`);
});
