import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { MISSIONS } from '../src/story/missions.js';

const run = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) { s.tick(0.05); s.events.length = 0; } };
const stats = (s, team) => {
  const own = s.own(team);
  return { workers: own.filter((e) => e.type === 'worker').length, army: own.filter((e) => e.kind === 'unit' && e.type !== 'worker').length, buildings: own.filter((e) => e.kind === 'building').length };
};

test('every skirmish speed harvests, builds and trains in its first minutes', () => {
  for (const aiSpeed of ['relaxed', 'normal', 'fast']) {
    const s = new Simulation({ map: 'riverlands', aiSpeed });
    run(s, 120);
    const t = stats(s, 1);
    assert.ok(t.workers >= 7, `${aiSpeed}: workers ${t.workers}`);
    assert.ok(t.army >= 8, `${aiSpeed}: army ${t.army}`);
    assert.ok(t.buildings >= 3, `${aiSpeed}: buildings ${t.buildings}`);
    assert.ok(s.players[1].alloy < 800, `${aiSpeed}: alloy is spent (${Math.round(s.players[1].alloy)})`);
  }
});

test('a relaxed rival does not sit on a pile of alloy', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'relaxed' });
  run(s, 300);
  assert.ok(s.players[1].alloy < 900, `alloy ${Math.round(s.players[1].alloy)}`);
  assert.ok(stats(s, 1).army >= 14);
});

test('mission 1: the enemy camp works (harvests, builds, trains) but never marches by itself', () => {
  const def = MISSIONS.find((m) => m.id.startsWith('m01'));
  assert.equal(def.rules.ai, 'home');
  const s = new Simulation({ map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, mission: def });
  const sent = [];
  run(s, 100);
  assert.ok(stats(s, 1).workers > 4 && stats(s, 1).army > 3, JSON.stringify(stats(s, 1)));
  for (const e of s.own(1)) if (e.kind === 'unit' && e.type !== 'worker') sent.push(e);
  assert.ok(sent.every((e) => !e.orders.some((o) => o.type === 'attackmove')), 'no march before the scripted wave');
});
