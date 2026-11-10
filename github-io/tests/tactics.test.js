import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';
import { RANK_XP, RANK_BONUS } from '../src/sim/tactics.js';

const run = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };
// An empty field: no rival units to interfere, everything visible.
function field(options = {}) {
  const s = new Simulation({ ai: false, ...options });
  for (const e of s.own(1)) if (e.kind === 'unit') e.hp = 0;
  s.tick(0.05); s.events.length = 0;
  s.isVisible = () => true;
  return s;
}

test('kills earn ranks: more damage and health, a patch-up, and a promote event', () => {
  const s = field(), hero = s.spawn('ranger', 0, 0, 0), seen = [];
  for (let i = 0; i < RANK_XP[0]; i++) {
    const victim = s.spawn('vanguard', 1, 6, 0); victim.hp = 1; victim.shield = 0; victim.damage = 0;
    run(s, 3, seen);
  }
  assert.equal(hero.rank, 1);
  assert.equal(hero.maxHp, Math.round(D.ranger.hp * (1 + RANK_BONUS)));
  assert.ok(Math.abs(s.attackValue(hero) - D.ranger.damage * (1 + RANK_BONUS)) < 1e-9);
  assert.deepEqual(seen.filter((e) => e.type === 'promote').map((e) => [e.id, e.rank]), [[hero.id, 1]]);
  // Harvesters and towers never rank up; walls give nothing.
  const tower = s.spawn('tower', 0, -6, 0);
  s.creditKill(tower.id, { kind: 'unit', pop: 30 }); s.creditKill(hero.id, { kind: 'wall' });
  assert.equal(tower.rank, undefined); assert.equal(hero.xp, RANK_XP[0]);
  s.creditKill(hero.id, { kind: 'building' });
  assert.equal(hero.xp, RANK_XP[0] + 2);
  s.creditKill(hero.id, { kind: 'unit', pop: 40 });
  assert.equal(hero.rank, RANK_XP.length, 'ranks stop at the top');
});

test('stances: hold stays put, guard returns to its post, aggressive keeps chasing', () => {
  const at = {};
  for (const stance of ['hold', 'guard', 'aggressive']) {
    const s = field({ map: 'expanse' }), unit = s.spawn('vanguard', 0, 0, 20), bait = s.spawn('worker', 1, 9, 20); // z = 20 is open ground on this map
    bait.hp = bait.maxHp = 1e6; bait.speed = 4; // survives the chase, a little slower than the Vanguard
    assert.equal(s.command({ team: 0, type: 'stance', ids: [unit.id], stance }), true);
    s.command({ team: 1, type: 'order', ids: [bait.id], order: { type: 'move', x: 55, z: 20 } });
    run(s, 5);
    at[stance + '5'] = Math.hypot(unit.x, unit.z - 20);
    run(s, 20);
    at[stance] = Math.hypot(unit.x, unit.z - 20);
  }
  assert.ok(at.hold5 < 0.5 && at.hold < 0.5, 'hold never leaves');
  assert.ok(at.guard5 > 2, 'guard gives chase at first'); assert.ok(at.guard < 2.5, 'then walks back');
  assert.ok(at.aggressive > 25, `aggressive follows far beyond the leash: ${at.aggressive}`);
  const s = field();
  assert.equal(s.command({ team: 0, type: 'stance', ids: [s.spawn('ranger', 0, 0, 0).id], stance: 'berserk' }), false);
});

test('timed abilities change the unit for their duration, then put it back, and have a cooldown', () => {
  const s = field(), seen = [];
  const v = s.spawn('vanguard', 0, 0, 0), r = s.spawn('ranger', 0, 3, 0), t = s.spawn('tank', 0, 6, 0), a = s.spawn('antitank', 0, 9, 0);
  assert.equal(s.command({ team: 0, type: 'ability', ids: [v.id, r.id, t.id, a.id] }), true);
  run(s, 1, seen);
  assert.equal(seen.filter((e) => e.type === 'ability').length, 4);
  assert.ok(Math.abs(v.speed - D.vanguard.speed * 0.7) < 1e-9);
  assert.ok(Math.abs(r.interval - D.ranger.interval * 0.6) < 1e-9);
  assert.ok(Math.abs(t.speed - D.tank.speed * 1.5) < 1e-9); assert.ok(Math.abs(s.attackValue(t) - D.tank.damage * 1.25) < 1e-9);
  assert.equal(a.range, D.antitank.range + 3);
  const before = v.hp + v.shield; s.applyDamage(v, 40, 1);
  assert.equal(before - (v.hp + v.shield), 20, 'Shield wall halves damage');
  assert.equal(s.command({ team: 0, type: 'ability', ids: [v.id] }), false, 'cooling down');
  run(s, 9);
  for (const [unit, key] of [[v, 'speed'], [r, 'interval'], [t, 'speed'], [a, 'range']]) assert.equal(unit[key], D[unit.type][key], `${unit.type} ${key} restored`);
  assert.equal(v.buff, null);
  run(s, 25);
  assert.equal(s.command({ team: 0, type: 'ability', ids: [v.id] }), true, 'ready again after the cooldown');
});

test('Barrage lands after a delay on the marked area; Triage and Field repair mend the right allies', () => {
  const s = field(), seen = [];
  const b = s.spawn('breaker', 0, 0, 0), near = s.spawn('vanguard', 1, 10, 0), edge = s.spawn('vanguard', 1, 10, 3.5), far = s.spawn('vanguard', 1, 10, 9), friend = s.spawn('vanguard', 0, 11, 0);
  for (const e of [near, edge, far]) e.damage = 0;
  b.damage = 0; friend.damage = 0;
  assert.equal(s.command({ team: 0, type: 'ability', ids: [b.id] }), false, 'needs a target point');
  assert.equal(s.command({ team: 0, type: 'ability', ids: [b.id], x: 40, z: 0 }), false, 'out of reach');
  assert.equal(s.command({ team: 0, type: 'ability', ids: [b.id], x: 10, z: 0 }), true);
  run(s, 1, seen);
  assert.equal(near.hp + near.shield, near.maxHp + near.maxShield, 'nothing lands before the delay');
  run(s, 1, seen);
  const lost = (e) => e.maxHp + e.maxShield - (e.hp + e.shield);
  assert.ok(lost(near) > 80 && lost(edge) > 80, 'both targets inside the circle are hit');
  assert.equal(lost(far), 0); assert.equal(lost(friend), 0, 'no friendly fire');
  assert.equal(seen.filter((e) => e.type === 'strike').length, 1);

  const m = s.spawn('medic', 0, -10, 0), e = s.spawn('engineer', 0, -10, 4);
  const soldier = s.spawn('ranger', 0, -12, 0), truck = s.spawn('breaker', 0, -12, 4);
  assert.equal(s.command({ team: 0, type: 'ability', ids: [m.id, e.id] }), false, 'nobody is hurt: the ability is not wasted');
  soldier.hp = 20; truck.hp = 100;
  assert.equal(s.command({ team: 0, type: 'ability', ids: [m.id, e.id] }), true);
  assert.equal(soldier.hp, 60); assert.equal(truck.hp, 180);
});

test('the computer uses abilities in a fight; the player can switch on auto-cast; saves keep ability state', () => {
  const s = field(), seen = [];
  const foe = s.spawn('vanguard', 1, 0, 0), mine = s.spawn('vanguard', 0, 2, 0);
  s.aiEnabled = true; s.updateAI = () => {};
  run(s, 3, seen);
  assert.ok(seen.some((e) => e.type === 'ability' && e.id === foe.id), 'the AI Vanguard braced');
  assert.ok(!seen.some((e) => e.type === 'ability' && e.id === mine.id), 'player units wait for the order');
  s.command({ team: 0, type: 'autocast', on: true });
  run(s, 2, seen);
  assert.ok(seen.some((e) => e.type === 'ability' && e.id === mine.id));
  delete s.isVisible; delete s.updateAI;
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  const twin = copy.get(mine.id);
  assert.equal(twin.abilityAt, mine.abilityAt); assert.equal(twin.ability, D.vanguard.ability);
});
