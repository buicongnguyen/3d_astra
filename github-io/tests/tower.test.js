import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DEFINITIONS as D} from '../src/data.js';

const quiet = () => {
  const s = new Simulation({ai: false, map: 'classic'});
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === 'unit') e.hp = 0;
  s.tick(0.05);
  return s;
};

test('towers shoot combat units before Harvesters, and buildings last', () => {
  const s = quiet(), tower = s.spawn('tower', 1, -26, 8);
  // The Harvester and the enemy Command core are both closer than the soldier; the soldier is shot first.
  const soldier = s.spawn('antitank', 0, -26, -4.5), worker = s.spawn('worker', 0, -24, -3);
  s.nav.rebuild(s.entities); s.updateVision();
  assert.equal(s.defenseTarget(tower).id, soldier.id, 'combat units first');
  soldier.hp = 0; s.tick(0.05);
  assert.equal(s.defenseTarget(tower).id, worker.id, 'then Harvesters');
  worker.hp = 0; s.tick(0.05);
  assert.equal(s.defenseTarget(tower).type, 'hq', 'buildings only when no unit is in range');
});

test('a tower beside an enemy base still kills the unit attacking it', () => {
  const s = quiet(), tower = s.spawn('tower', 1, -26, 8);
  s.nav.rebuild(s.entities); s.updateVision();
  const rocket = s.spawn('antitank', 0, -30, -14);
  s.issue([rocket.id], {type: 'attack', target: tower.id});
  for (let t = 0; t < 30 && rocket.hp > 0; t += 0.05) s.tick(0.05);
  assert.ok(rocket.hp <= 0 && tower.hp > tower.maxHp * 0.9);
});

test('tower levels add 50% base damage and 1 m range, and cost less than other buildings', () => {
  const s = quiet();
  Object.assign(s.players[0], {alloy: 5000, energy: 5000});
  s.own(0).find(e => e.type === 'hq').level = 3;
  const tower = s.spawn('tower', 0, -9, 24), relay = s.spawn('relay', 0, -9, 34);
  assert.deepEqual(s.levelCost(tower), [75, 25]); assert.deepEqual(s.levelCost(relay), [100, 50]);
  const stats = [];
  for (const level of [2, 3]) { s.upgradeBuilding(tower.id); s.updateLevel(tower, 40); stats.push([tower.level, tower.damage, tower.range]); }
  assert.deepEqual(stats, [[2, D.tower.damage * 1.5, 14], [3, D.tower.damage * 2, 15]]);
});

test('fast and relentless AIs build towers facing the map centre; relaxed AIs do not', () => {
  const towers = speed => {
    const s = new Simulation({map: 'basin', aiSpeed: speed});
    const core = s.own(0).find(e => e.type === 'hq'); core.maxHp = core.hp = 1e9;
    for (let i = 0; i < 20 * 240; i++) s.tick(0.05);
    const hq = s.own(1).find(e => e.type === 'hq');
    return s.own(1).filter(e => e.type === 'tower').map(t => Math.hypot(t.x, t.z) < Math.hypot(hq.x, hq.z));
  };
  assert.deepEqual(towers('relaxed'), []);
  const fast = towers('fast');
  assert.ok(fast.length >= 1 && fast.every(Boolean), `fast AI towers face the centre: ${fast}`);
});
