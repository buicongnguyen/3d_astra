import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

const run = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) s.tick(0.05); };
const quiet = (s) => { for (const e of s.own(1)) if (e.kind === 'unit') e.hp = 0; s.tick(0.05); };

test('an idle fighter answers a shooter that outranges it, then returns to its post', () => {
  const s = new Simulation({ ai: false }); quiet(s);
  const guard = s.spawn('vanguard', 0, 0, 0), sniper = s.spawn('ranger', 1, 9, 0);
  s.isVisible = () => true;
  s.issue([sniper.id], { type: 'attack', target: guard.id });
  run(s, 12);
  assert.ok(sniper.hp + sniper.shield < sniper.maxHp + sniper.maxShield || sniper.hp <= 0, 'the Vanguard closed in and hit back');
  sniper.hp = 0; run(s, 10);
  assert.ok(Math.hypot(guard.x, guard.z) < 2, 'it walked back to where it was left');
});

test('an idle fighter does not follow an enemy beyond its leash', () => {
  const s = new Simulation({ ai: false, map: 'expanse' }); quiet(s);
  const guard = s.spawn('vanguard', 0, 0, 0), bait = s.spawn('worker', 1, 8, 0);
  s.isVisible = () => true;
  s.issue([bait.id], { type: 'move', x: 60, z: 0 });
  run(s, 30);
  assert.ok(Math.hypot(guard.x, guard.z) < guard.vision + 6, 'guard stayed near its post');
});

test('the AI fields vehicles and researches once its Foundry stands', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  for (const e of s.own(0)) if (e.type === 'hq') e.hp = e.maxHp = 1e9;
  const seen = new Set();
  for (let i = 0; i < 12 * 1200; i++) { s.tick(0.05); s.events.length = 0; if (i % 200 === 0) for (const e of s.own(1)) if (e.mechanical && e.kind === 'unit') seen.add(e.id); }
  assert.ok(seen.size >= 3, `vehicles built: ${seen.size}`);
  assert.equal(s.players[1].upgrade, true);
});

test('a team left with only an unfinished core has a limited time to finish it', () => {
  const s = new Simulation({ ai: false });
  const hq = s.own(1).find((e) => e.type === 'hq');
  s.spawn('hq', 1, 12, -35, false); hq.hp = 0;
  run(s, 60); assert.equal(s.result, null);
  run(s, 40); assert.equal(s.result, 'victory');
});

test('cancelling a damaged site refunds less, and a site sees only its own footprint', () => {
  const s = new Simulation({ ai: false }); quiet(s);
  const w = s.own(0).find((e) => e.type === 'worker'), hq = s.own(0).find((e) => e.type === 'hq');
  const spot = s.findPlacement('tower', 0, hq.x + 12, hq.z);
  const b = s.build(w.id, 'tower', spot.x, spot.z); assert.ok(b);
  b.progress = 0.8; b.hp = b.maxHp * 0.2;
  const before = s.players[0].alloy;
  s.cancelBuilding(b.id);
  assert.ok(Math.abs(s.players[0].alloy - before - b.cost[0] * 0.75 * 0.25) < 0.01);
  const far = s.spawn('relay', 0, 0, 30, false); s.updateVision();
  assert.equal(s.isVisible({ x: far.x + 10, z: far.z, team: 1 }, 0), false);
  far.complete = true; s.updateVision();
  assert.equal(s.isVisible({ x: far.x + 10, z: far.z, team: 1 }, 0), true);
});

test('a launched wave warns the defender, and idle Harvesters can be sent to work in one call', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  s.assignHarvesters(0);
  const workers = s.own(0).filter((e) => e.type === 'worker');
  assert.ok(workers.every((e) => e.orders[0]?.type === 'gather'));
  assert.equal(workers.filter((e) => s.resources.find((r) => r.id === e.orders[0].target).type === 'energy').length, 1);
  let warned = null;
  for (let i = 0; i < 200 * 20 && !warned; i++) { s.tick(0.05); warned = s.events.find((e) => e.type === 'incoming'); s.events.length = 0; }
  assert.equal(warned?.team, 0); assert.ok(warned.count >= 4);
});
