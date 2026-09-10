import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const types = ['vanguard', 'ranger', 'breaker', 'tank', 'antitank'];
const health = e => e.hp + e.shield;
const step = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) s.tick(.05); };
function setup(type = 'ranger') {
  const s = new Simulation({ai: false});
  s.entities = s.entities.filter(e => e.kind === 'building');
  const unit = s.spawn(type, 0, 0, 20);
  s.nav.rebuild(s.entities); s.updateVision();
  return {s, unit};
}
function hostile(s, unit) {
  const enemy = s.spawn('worker', 1, unit.range + .55, 20);
  enemy.hp = enemy.maxHp = 10000;
  s.updateVision();
  return enemy;
}

test('every soldier and tank repeats both patrol legs without consuming the order', () => {
  for (const type of types) {
    const {s, unit} = setup(type);
    s.issue([unit.id], {type: 'patrol', x: 0, z: 32});
    let previous = 32, reversals = 0;
    for (let i = 0; i < 700; i++) {
      s.tick(.05);
      assert.equal(unit.orders[0]?.type, 'patrol', type);
      if (unit.orders[0].z !== previous) { reversals++; previous = unit.orders[0].z; }
    }
    assert.ok(reversals >= 4, `${type}: repeated outward and return legs`);
    assert.ok(unit.z >= 19 && unit.z <= 33, type);
  }
});

test('patrol fires at weapon range, respects cooldown, and resumes after the threat leaves', () => {
  for (const type of types) {
    const {s, unit} = setup(type), enemy = hostile(s, unit), before = health(enemy);
    s.issue([unit.id], {type: 'patrol', x: 0, z: 32}); s.tick(.05);
    assert.ok(health(enemy) < before, type); assert.equal(unit.attacking, true);
    const after = health(enemy); s.tick(.05); assert.equal(health(enemy), after);
    step(s, 7);
    assert.equal(unit.orders[0].type, 'patrol'); assert.equal(unit.z, 20);
    enemy.x = 40; enemy.z = -40; s.tick(.05);
    assert.equal(unit.attacking, false); assert.equal(unit.moving, true);
    step(s, 5); assert.ok(unit.z > 20); assert.equal(unit.orders[0].type, 'patrol');
  }
});

test('patrol resumes after a kill and Move or Stop cancels its loop', () => {
  const {s, unit} = setup('tank'), enemy = hostile(s, unit);
  enemy.hp = 1; enemy.shield = 0;
  s.issue([unit.id], {type: 'patrol', x: 0, z: 32}); s.tick(.05);
  assert.equal(s.get(enemy.id), undefined); s.tick(.05); assert.ok(unit.moving);
  const next = hostile(s, unit); unit.cooldown = 0; s.tick(.05);
  const before = health(next), cooldown = unit.cooldown;
  s.issue([unit.id], {type: 'move', x: 0, z: 36});
  assert.equal(unit.cooldown, cooldown); s.tick(.05);
  assert.ok(unit.moving); assert.equal(health(next), before); assert.equal(unit.orders[0].type, 'move');
  s.issue([unit.id], {type: 'patrol', x: 0, z: 32});
  s.issue([unit.id], {type: 'stop'}); assert.deepEqual(unit.orders, []);
});

test('patrol targets require visibility, range, and a clear shot', () => {
  for (const reason of ['hidden', 'distant', 'blocked']) {
    const {s, unit} = setup(), enemy = hostile(s, unit);
    if (reason === 'hidden') { s.visible[0].fill(0); s.visionClock = 100; }
    if (reason === 'distant') enemy.x += 2;
    if (reason === 'blocked') { s.spawn('barracks', 0, 3, 20); s.nav.rebuild(s.entities); }
    const before = health(enemy);
    s.issue([unit.id], {type: 'patrol', x: 0, z: 32}); s.tick(.05);
    assert.equal(health(enemy), before, reason); assert.ok(unit.moving, reason);
  }
  const {s, unit} = setup(), blocked = hostile(s, unit);
  blocked.x = 6;
  s.spawn('barracks', 0, 3, 20);
  const clear = s.spawn('worker', 1, 0, 26.3), before = health(clear);
  s.nav.rebuild(s.entities); s.updateVision();
  s.issue([unit.id], {type: 'patrol', x: 0, z: 32}); s.tick(.05);
  assert.ok(health(clear) < before, 'an obstructed enemy does not hide another clear target');
});

test('a queued patrol starts where earlier movement ends and yields to a queued follow-up', () => {
  const {s, unit} = setup();
  s.issue([unit.id], {type: 'move', x: 0, z: 26});
  s.issue([unit.id], {type: 'patrol', x: 0, z: 34}, true);
  for (let i = 0; i < 150 && !unit.orders[0]?.origin; i++) s.tick(.05);
  assert.ok(unit.orders[0].origin.z > 24, 'return point uses position when patrol starts');
  s.issue([unit.id], {type: 'move', x: 0, z: 20}, true);
  step(s, 15); assert.equal(unit.orders.length, 0); assert.ok(unit.z < 22);
});

test('invalid and ineligible patrols preserve existing orders; map edges respect vehicle radius', () => {
  for (const type of ['worker', 'medic', 'engineer']) {
    const {s, unit} = setup(type);
    s.issue([unit.id], {type: 'move', x: 0, z: 32});
    const before = structuredClone(unit.orders);
    s.issue([unit.id], {type: 'patrol', x: 0, z: 28});
    assert.deepEqual(unit.orders, before);
  }
  const {s, unit} = setup('tank');
  s.issue([unit.id], {type: 'move', x: 0, z: 30});
  for (const x of [NaN, Infinity, undefined]) {
    s.issue([unit.id], {type: 'patrol', x, z: 32}); assert.equal(unit.orders[0].type, 'move');
  }
  s.issue([unit.id], {type: 'patrol', x: 999, z: -999});
  assert.ok(Math.abs(unit.orders[0].x) <= s.terrain.half - unit.radius);
  assert.ok(Math.abs(unit.orders[0].z) <= s.terrain.half - unit.radius);
});

test('Harvesters attack only on command, retain cargo, and can withdraw without resetting cooldown', () => {
  const {s, unit} = setup('worker'), enemy = hostile(s, unit);
  unit.carry = 7; unit.carryType = 'alloy';
  const before = health(enemy); s.tick(.05); assert.equal(health(enemy), before);
  s.issue([unit.id], {type: 'attack', target: enemy.id}); s.tick(.05);
  assert.equal(health(enemy), before - 4); assert.equal(unit.carry, 7);
  const cooldown = unit.cooldown;
  s.issue([unit.id], {type: 'move', x: 0, z: 32});
  assert.equal(unit.cooldown, cooldown); s.tick(.05);
  assert.ok(unit.moving); assert.equal(health(enemy), before - 4);
  s.issue([unit.id], {type: 'attack', target: enemy.id}); s.tick(.05);
  assert.equal(health(enemy), before - 4, 'micro cannot bypass weapon cooldown');
});

test('Harvester attacks cannot target allies/resources and finish when the enemy dies', () => {
  const {s, unit} = setup('worker'), enemy = hostile(s, unit);
  const ally = s.spawn('worker', 0, -3, 20);
  s.issue([unit.id], {type: 'move', x: 0, z: 32});
  for (const target of [ally.id, s.resources[0].id, 999999]) {
    s.issue([unit.id], {type: 'attack', target}); assert.equal(unit.orders[0].type, 'move');
  }
  enemy.hp = 1; enemy.shield = 0;
  s.issue([unit.id], {type: 'attack', target: enemy.id});
  s.issue([unit.id], {type: 'move', x: 0, z: 32}, true);
  step(s, .2); assert.equal(unit.orders[0].type, 'move'); assert.ok(unit.moving);
});
