import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { productionTiles, researchState } from '../src/research-tiles.js';

// A player Foundry with plenty of resources.
function setup(level = 1) {
  const s = new Simulation({ ai: false, factions: { 0: 'meridian', 1: 'meridian' } });
  s.players[0].alloy = s.players[0].energy = 5000;
  const hq = s.own(0).find((e) => e.type === 'hq');
  const b = s.spawn('foundry', 0, hq.x + 9, hq.z + 7);
  b.complete = true; b.progress = 1; b.level = level;
  return { s, b };
}
const view = (s, b, choosing) => productionTiles(s, b, { choosing }).tiles.map((t) => `${t.action}:${t.label}:${t.state}${t.sub ? ':' + t.sub : ''}`);

test('before the choice the Foundry shows one Research slot; locked items name the level they need', () => {
  const { s, b } = setup();
  assert.deepEqual(view(s, b, false), [
    'breaker:Breaker:ready',
    'research:Research:ready:Pick 1 of 2',
    'engineer:Engineer:locked:Needs Foundry L2',
    'tank:Battle tank:locked:Needs Foundry L3',
  ]);
  assert.deepEqual(view(s, b, true), ['upgrade:Damage +10%:ready', 'plating:Armor +12%:ready', 'back:Back:ready']);
});

test('the slot moves forward: researching with progress, tier II (locked until Foundry L2), then done', () => {
  const { s, b } = setup();
  assert.ok(s.enqueue(b.id, 'upgrade'));
  for (let i = 0; i < 100; i++) s.tick(0.05); // 5 s of a 25 s research
  let r = researchState(s, 0);
  assert.equal(r.state, 'busy'); assert.equal(r.type, 'upgrade');
  assert.ok(r.progress > 0.15 && r.progress < 0.25, String(r.progress));
  assert.match(view(s, b, false)[1], /^upgrade:Damage \+10%:busy:Researching 2\d%$/);
  // The choice sheet never reopens once a branch is chosen.
  assert.equal(productionTiles(s, b, { choosing: true }).choosing, false);
  for (let i = 0; i < 500; i++) s.tick(0.05);
  assert.equal(s.players[0].upgrade, true);
  // Between tiers the first stays visible as active, with the next step under it.
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +10% ✓:locked:+8% at Foundry L2');
  b.level = 2;
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +10% ✓:ready');
  assert.equal(productionTiles(s, b).tiles[1].next, '+8%');
  assert.ok(s.enqueue(b.id, 'upgrade2'));
  assert.match(view(s, b, false)[1], /^upgrade2:Damage \+8%:busy:/);
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  r = researchState(s, 0);
  assert.deepEqual([r.state, r.branch], ['done', 'weapons']);
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +19%:done:Active');
  // Four tiles at most: the slot never adds a fifth tile (phones show four).
  assert.equal(view(s, b, false).length, 4);
});

test('the plating branch reads as armor, and a research queued behind a unit waits', () => {
  const { s, b } = setup();
  assert.ok(s.enqueue(b.id, 'breaker'));
  assert.ok(s.enqueue(b.id, 'plating'));
  const r = researchState(s, 0);
  assert.deepEqual([r.branch, r.state, r.waiting], ['plating', 'busy', true]);
  assert.equal(view(s, b, false)[1], 'plating:Armor +12%:busy:Waiting in queue');
});
