import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

// A relay site the AI could legally have placed near its core (spawned directly, so the
// test controls builders; placement() keeps it clear of existing structures).
const legalSite = s => {
  const hq = s.own(1).find(e => e.type === 'hq');
  for (const r of [10, 17])
    for (let i = 0; i < 12; i++) {
      const x = hq.x + Math.cos(i / 6 * Math.PI) * r, z = hq.z + Math.sin(i / 6 * Math.PI) * r;
      if (!s.placement('relay', 1, x, z)) return s.spawn('relay', 1, x, z, false);
    }
};

test('AI resumes construction after its builder dies and keeps building afterwards', () => {
  const s = new Simulation({map:'classic'});
  let site = null;
  for (let i = 0; i < 20000 && !site; i++) {
    s.tick(.05);
    site = s.own(1).find(e => e.kind === 'building' && !e.complete);
  }
  assert.ok(site, 'AI started a structure');
  s.own(1).find(e => e.orders[0]?.type === 'build' && e.orders[0].target === site.id).hp = 0;
  const before = s.own(1).filter(e => e.kind === 'building' && e.complete).length;
  for (let i = 0; i < 4000; i++) s.tick(.05);
  assert.equal(site.complete, true, 'abandoned site finished by another Harvester');
  assert.ok(s.own(1).filter(e => e.kind === 'building' && e.complete).length > before);
  assert.equal(s.own(1).filter(e => e.kind === 'building' && !e.complete && (e.aiRetries || 0) > 3).length, 0);
});

test('AI cancels a site its Harvesters cannot reach instead of stalling every later structure', () => {
  const s = new Simulation({map:'classic'});
  const site = legalSite(s);
  s.nav.rebuild(s.entities);
  // Every route to the site fails, as if it were walled off after placement.
  const path = s.nav.path.bind(s.nav);
  s.nav.path = (from, to, radius) => Math.hypot(to.x - site.x, to.z - site.z) < site.radius + 3 ? [] : path(from, to, radius);
  const refunds = [], pay = s.pay.bind(s);
  s.pay = (team, cost, factor = 1) => { if (factor < 0) refunds.push([team, cost[0] * -factor]); pay(team, cost, factor); };
  for (let i = 0; i < 1400 && site.hp > 0; i++) s.tick(.05);
  assert.ok(site.hp <= 0 || !s.get(site.id), 'site cancelled');
  assert.deepEqual(refunds, [[1, 75]], 'standard 75% cancellation refund');
});

test('AI never cancels a reachable site whose builders keep being killed, nor one waiting for workers', () => {
  const s = new Simulation({map:'classic'});
  const site = legalSite(s);
  s.nav.rebuild(s.entities);
  const workers = () => s.own(1).filter(e => e.type === 'worker');
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < 400 && !workers().some(w => w.working && w.orders[0]?.target === site.id); i++) s.tick(.05);
    for (let i = 0; i < 20; i++) s.tick(.05);
    const builder = workers().find(w => w.orders[0]?.type === 'build' && w.orders[0].target === site.id);
    if (builder) builder.hp = 0;
  }
  assert.ok(site.hp > 0 && !site.complete, 'site survives six builder deaths');
  for (const w of workers()) w.hp = 0;
  for (let i = 0; i < 400; i++) s.tick(.05);
  assert.ok(site.hp > 0, 'no builder available is not a failed attempt');
});

test('units ordered to attack a screened target walk to a clear firing position', () => {
  const s = new Simulation({ai:false});
  const target = s.spawn('relay', 1, 0, -20);
  s.spawn('barracks', 1, 0, -14.5);
  const ranger = s.spawn('ranger', 0, 0, -6);
  s.nav.rebuild(s.entities); s.updateVision();
  s.issue([ranger.id], {type:'attack', target:target.id});
  for (let i = 0; i < 400; i++) s.tick(.05);
  assert.equal(ranger.orders[0]?.type, 'attack', 'order kept while flanking');
  assert.ok(target.hp < target.maxHp, 'screened relay takes damage');
  assert.ok(s.nav.clearLine(ranger, target, target.id));
});

test('a lone harvester near an AI core does not recall a distant attack wave', () => {
  const s = new Simulation({map:'classic'});
  const hq = s.own(1).find(e => e.type === 'hq');
  const wave = [0, 1, 2, 3, 4].map(i => s.spawn('vanguard', 1, -20 + i, 20));
  const guard = s.spawn('vanguard', 1, hq.x - 4, hq.z - 6);
  s.issue(wave.map(e => e.id), {type:'attackmove', x:-25, z:24});
  const scout = s.spawn('worker', 0, hq.x - 12, hq.z - 12);
  s.updateVision();
  s.aiClock = 0; s.tick(.05);
  assert.deepEqual(wave.map(e => e.orders[0]?.type), Array(5).fill('attackmove'));
  assert.equal(guard.orders[0]?.type, 'attack');
  assert.equal(guard.orders[0].target, scout.id);
});

test('a lone scout is still answered when no defender is home, and waves still launch', () => {
  const s = new Simulation({map:'classic'});
  const hq = s.own(1).find(e => e.type === 'hq');
  for (const e of s.own(1).filter(e => e.kind === 'unit' && e.type !== 'worker')) e.hp = 0;
  const army = [0, 1, 2, 3, 4, 5].map(i => s.spawn('vanguard', 1, -20 + i, 20));
  const scout = s.spawn('worker', 0, hq.x - 12, hq.z - 12);
  s.updateVision();
  s.time = s.waveAt[1] + 1;
  s.aiClock = 0; s.tick(.05);
  const orders = army.map(e => e.orders[0]);
  assert.equal(orders.filter(o => o?.type === 'attack' && o.target === scout.id).length, 2, 'two closest answer');
  assert.equal(orders.filter(o => o?.type === 'attackmove').length, 4, 'the rest launch the wave');
});

test('an attack on a target with no possible firing position ends instead of waiting forever', () => {
  const s = new Simulation({ai:false});
  const target = s.spawn('relay', 1, 0, -20);
  for (let i = 0; i < 8; i++) s.spawn('relay', 0, Math.cos(i * Math.PI / 4) * 4, -20 + Math.sin(i * Math.PI / 4) * 4);
  const ranger = s.spawn('ranger', 0, 0, -9);
  s.nav.rebuild(s.entities); s.updateVision();
  s.issue([ranger.id], {type:'attack', target:target.id});
  for (let i = 0; i < 600 && ranger.orders.length; i++) s.tick(.05);
  assert.equal(ranger.orders.length, 0, 'order cleared');
  assert.equal(target.hp, target.maxHp);
  assert.ok(s.events.some(e => e.type === 'message' && /line of fire|cannot reach/.test(e.text)), 'player is told why');
});

test('attack-move passes a target it cannot shoot and keeps advancing', () => {
  const s = new Simulation({ai:false});
  const target = s.spawn('relay', 1, 0, -20);
  for (let i = 0; i < 8; i++) s.spawn('relay', 0, Math.cos(i * Math.PI / 4) * 4, -20 + Math.sin(i * Math.PI / 4) * 4);
  const ranger = s.spawn('ranger', 0, 0, -9);
  s.nav.rebuild(s.entities); s.updateVision();
  s.issue([ranger.id], {type:'attackmove', x:-20, z:-20});
  for (let i = 0; i < 1200 && ranger.orders.length; i++) s.tick(.05);
  assert.equal(ranger.orders.length, 0, 'destination reached');
  assert.ok(Math.hypot(ranger.x + 20, ranger.z + 20) < 3, 'arrived away from the enemy base');
});

test('a real incursion still recalls the whole AI army', () => {
  const s = new Simulation({map:'classic'});
  const hq = s.own(1).find(e => e.type === 'hq');
  const wave = [0, 1, 2, 3].map(i => s.spawn('ranger', 1, -20 + i, 20));
  s.issue(wave.map(e => e.id), {type:'attackmove', x:-25, z:24});
  for (let i = 0; i < 2; i++) s.spawn('breaker', 0, hq.x - 12 - i * 2, hq.z - 12);
  s.updateVision();
  s.aiClock = 0; s.tick(.05);
  assert.deepEqual(wave.map(e => e.orders[0]?.type), Array(4).fill('attack'));
});

test('splash damage applies anti-vehicle multipliers per victim', () => {
  const s = new Simulation({ai:false});
  const shooter = s.spawn('breaker', 0, 0, 0);
  shooter.mechanical_bonus = 3;
  const infantry = s.spawn('ranger', 1, 0, 7), vehicle = s.spawn('tank', 1, 1.5, 7);
  for (const t of [infantry, vehicle]) t.shield = 0;
  s.hit(shooter, infantry);
  assert.equal(infantry.maxHp - infantry.hp, 30, 'primary infantry target takes base damage');
  assert.equal(vehicle.maxHp - vehicle.hp, 45, 'vehicle splash takes half of the anti-vehicle damage');
});

test('binary-heap pathfinding finds equal-length routes on the largest map quickly', () => {
  const s = new Simulation({map:'highlands', enemyCount:3, ai:false});
  const h = s.terrain.half - 4, started = performance.now();
  for (const radius of [0.55, 1.05]) {
    const path = s.nav.path({x:-h, z:h}, {x:h, z:-h}, radius);
    assert.ok(path.length > 90);
    for (let i = 1; i < path.length; i++) assert.ok(Math.hypot(path[i].x - path[i-1].x, path[i].z - path[i-1].z) < 3);
  }
  assert.ok(performance.now() - started < 250, 'two cross-map routes stay well below a frame budget each');
});
