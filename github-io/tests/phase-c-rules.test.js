import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

const base = { id: 't', map: 'classic', objectives: [], win: [], regions: { mid: { x: 0, z: 0, r: 7 } } };
const advance = (s, sec) => { for (let i = 0; i < sec * 20 && !s.result; i++) s.tick(0.05); };

test('killing the enemy core does not complete a "destroy the tagged objects" objective', () => {
  const s = new Simulation({ map: 'classic', ai: false, mission: { ...base,
    setup: [{ spawn: 'relay', team: 1, at: 'mid', tag: 'siphon', hp: 500 }, { spawn: 'vanguard', team: 0, at: { x: -30, z: 30 }, count: 1 }],
    objectives: [{ id: 'sip', text: 'Destroy siphons', type: 'destroyTag', tag: 'siphon' }], win: ['sip'] } });
  advance(s, 1);
  for (const e of s.own(1)) if (e.type === 'hq') e.hp = 0;
  advance(s, 2);
  assert.equal(s.players[1].eliminated, true);
  assert.equal(s.tagged('siphon').length, 1, 'tagged siphon stays standing');
  assert.equal(s.result, null);
  s.tagged('siphon')[0].hp = 0;
  advance(s, 1);
  assert.equal(s.result, 'victory');
});

test('Reinforced plating: an exclusive branch with weapons (0.9.1), costs energy, 12% less damage, saved', () => {
  const s = new Simulation({ ai: false });
  const f = s.spawn('foundry', 0, -10, 32);
  Object.assign(s.players[0], { alloy: 1000, energy: 1000 });
  s.players[0].upgrade = true;
  assert.equal(s.enqueue(f.id, 'plating'), false, 'locked once weapons were chosen (was: needed weapons first)');
  s.players[0].upgrade = false;
  assert.equal(s.enqueue(f.id, 'plating'), true);
  assert.equal(s.players[0].energy, 850);
  assert.equal(s.enqueue(f.id, 'plating'), false, 'not twice');
  advance(s, 31);
  assert.equal(s.players[0].plating, true);
  const u = s.spawn('vanguard', 0, 0, 30), hp = u.hp + u.shield;
  s.applyDamage(u, 100, 1);
  assert.ok(Math.abs(hp - (u.hp + u.shield) - 88) < 1e-6);
  const r = Simulation.load(s.serialize());
  assert.equal(r.players[0].plating, true);
  assert.equal(r.hash(), s.hash());
});

test('skirmish capture points: opt-in, symmetric, off the camps, paid, taken by the AI, saved', async () => {
  const { MAPS } = await import('../src/terrain.js');
  assert.deepEqual(new Simulation({ ai: false }).skirmishPoints, {}, 'off by default (Training, missions)');
  for (const map of Object.keys(MAPS)) {
    const s = new Simulation({ map, ai: false, capturePoints: true }), p = s.skirmishPoints, names = Object.keys(p);
    assert.ok(names.length >= 2 && names.length <= 4, map);
    for (const [name, a] of Object.entries(p)) {
      assert.ok(s.terrain.canStand(a.x, a.z, 1), `${map} ${name} on land`);
      for (const hq of s.entities.filter((e) => e.type === 'hq')) assert.ok(Math.hypot(hq.x - a.x, hq.z - a.z) > 17);
      const mirror = Object.values(p).find((b) => Math.abs(b.x + a.x) < 1e-9 && Math.abs(b.z + a.z) < 1e-9);
      assert.ok(mirror, `${map} ${name} has a mirror`);
    }
    const [h0, h1] = [0, 1].map((t) => s.own(t).find((e) => e.type === 'hq'));
    const total = (h) => Object.values(p).reduce((n, a) => n + Math.hypot(h.x - a.x, h.z - a.z), 0);
    assert.ok(Math.abs(total(h0) - total(h1)) < 1e-6, `${map} equal for both camps`);
  }
  assert.deepEqual(new Simulation({ capturePoints: true, mission: { id: 'x', map: 'classic', objectives: [], win: [] } }).skirmishPoints, {});
  const s = new Simulation({ ai: false, capturePoints: true });
  const ring = s.skirmishPoints.crossroads;
  s.spawn('vanguard', 0, ring.x, ring.z);
  const before = s.players[0].alloy;
  advance(s, 12);
  assert.equal(ring.owner, 0);
  assert.ok(s.players[0].alloy > before + 1);
  const r = Simulation.load(s.serialize());
  assert.equal(r.skirmishPoints.crossroads.owner, 0);
  assert.equal(r.hash(), s.hash());
});

test('the AI sends a small squad to its nearest ring and holds it', () => {
  const s = new Simulation({ capturePoints: true, aiSpeed: 'normal' });
  Object.assign(s.players[1], { alloy: 5000, energy: 5000 });
  for (let i = 0; i < 12; i++) s.spawn(i % 2 ? 'ranger' : 'vanguard', 1, 20 - i, -22);
  advance(s, 150);
  assert.ok(s.entities.some((e) => e.team === 1 && e.pointDuty), 'a squad is on duty');
  assert.ok(Object.values(s.skirmishPoints).some((p) => p.owner === 1), 'the AI took a ring');
});

test('AI expansion: normal builds a second core at an unclaimed deposit and trains more crew; relaxed does not', () => {
  const run = (aiSpeed) => {
    const s = new Simulation({ aiSpeed });
    for (const e of s.own(0)) e.hp = e.maxHp = 1e9;
    let t0 = performance.now();
    for (let i = 0; i < 700 * 20; i++) { s.tick(0.05); if (i % 40 === 0) s.command({ team: 0, type: 'harvest' }); }
    return { s, ms: performance.now() - t0 };
  };
  const { s } = run('normal'), cores = s.own(1).filter((e) => e.type === 'hq');
  assert.equal(cores.length, 2);
  assert.ok(cores.every((c) => c.complete));
  assert.ok(Math.hypot(cores[0].x - cores[1].x, cores[0].z - cores[1].z) >= 22);
  assert.ok(s.own(1).filter((e) => e.type === 'worker').length > 9, 'extra crew for the second core');
  assert.equal(run('relaxed').s.own(1).filter((e) => e.type === 'hq').length, 1);
});
