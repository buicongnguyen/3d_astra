import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';

const run = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) { s.tick(0.05); s.events.length = 0; } };

test('research is an either/or branch: weapons exclude plating and the reverse, per team, saved', () => {
  const s = new Simulation({ ai: false });
  const f = s.spawn('foundry', 0, -10, 32);
  Object.assign(s.players[0], { alloy: 2000, energy: 2000 });
  assert.equal(s.enqueue(f.id, 'upgrade'), true);
  assert.equal(s.enqueue(f.id, 'plating'), false, 'queued weapons lock plating');
  assert.equal(s.enqueue(f.id, 'upgrade'), false, 'not twice');
  run(s, 26);
  assert.equal(s.players[0].upgrade, true);
  assert.equal(s.enqueue(f.id, 'plating'), false, 'researched weapons lock plating');
  const r = Simulation.load(s.serialize());
  assert.equal(r.enqueue(r.entities.find((e) => e.type === 'foundry' && e.team === 0).id, 'plating'), false);
  // The other team is not affected, and plating first locks weapons.
  const g = s.spawn('foundry', 1, 10, -32);
  Object.assign(s.players[1], { alloy: 2000, energy: 2000 });
  assert.equal(s.enqueue(g.id, 'plating'), true);
  assert.equal(s.enqueue(g.id, 'upgrade'), false);
});

test('a 0.7.0 save holding both researches still loads and keeps both bonuses', () => {
  const s = new Simulation({ ai: false });
  s.players[0].upgrade = true;
  s.players[0].plating = true;
  const r = Simulation.load(s.serialize());
  assert.equal(r.players[0].upgrade && r.players[0].plating, true);
  const u = r.spawn('vanguard', 0, 0, 30);
  assert.ok(Math.abs(r.attackValue(u) - u.damage * 1.1) < 1e-9, 'weapons bonus kept');
  const hp = u.hp + u.shield;
  r.applyDamage(u, 100, 1);
  assert.ok(Math.abs(hp - (u.hp + u.shield) - 88) < 1e-6, 'plating kept');
});

test('energy has several real sinks: units, the research branch and building levels', () => {
  assert.ok(D.plating.cost[1] >= 100 && D.upgrade.cost[1] >= 100, 'the research branch costs energy');
  const unitSinks = ['ranger', 'breaker', 'medic', 'engineer', 'antitank', 'tank'].filter((t) => D[t].cost[1] > 0);
  assert.equal(unitSinks.length, 6);
  const s = new Simulation({ ai: false });
  const hq = s.own(0).find((e) => e.type === 'hq');
  assert.ok(s.levelCost(hq)[1] > 0, 'core levels cost energy');
});

test('the AI reads only what it can see: a hidden army is not counted', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  // Tanks parked far from every rival unit and building stay in the fog.
  const hidden = [0, 1, 2, 3, 4].map((i) => s.spawn('tank', 0, 40 + i, 40));
  s.updateVision();
  assert.equal(hidden.some((t) => s.isVisible(t, 1)), false, 'test setup: tanks are in the fog');
  s.observeEnemies(1);
  assert.equal(s.seenMix(1).mech, 0);
  // Moving them next to the rival's core reveals them.
  const hq = s.own(1).find((e) => e.type === 'hq');
  hidden.forEach((t, i) => { t.x = hq.x + 3 + i; t.z = hq.z + 6; });
  s.updateVision();
  s.observeEnemies(1);
  assert.equal(s.seenMix(1).mech, 5);
  // They are remembered after leaving sight, and forgotten when they die.
  hidden.forEach((t) => { t.x = 40; t.z = 40; });
  s.updateVision();
  s.observeEnemies(1);
  assert.equal(s.seenMix(1).mech, 5);
  hidden[0].hp = 0;
  s.observeEnemies(1);
  assert.equal(s.seenMix(1).mech, 4);
});

test('counter-building: vehicles draw Anti-tank, infantry draws Rangers, towers draw Breakers; relaxed stays simple', () => {
  const make = (aiSpeed, types) => {
    const s = new Simulation({ map: 'classic', aiSpeed });
    const intel = (s.intel[1] = new Map());
    types.forEach((t, i) => intel.set(1000 + i, t));
    for (const [id, t] of intel) s.entities.push({ id, type: t, team: 0, hp: 10, kind: D[t].kind, orders: [] });
    return s;
  };
  const barracks = { type: 'barracks', level: 2 }, foundry = { type: 'foundry', level: 3 };
  const tanks = make('normal', ['tank', 'tank', 'breaker', 'tank', 'ranger']);
  assert.equal(tanks.counterChoice(1, barracks, [], 'ranger'), 'antitank');
  assert.equal(tanks.counterChoice(1, { type: 'barracks', level: 1 }, [], 'vanguard'), 'ranger', 'level 1 cannot train rockets');
  const foot = make('normal', ['ranger', 'ranger', 'vanguard', 'vanguard', 'ranger']);
  assert.equal(foot.counterChoice(1, barracks, [], 'vanguard'), 'ranger');
  assert.equal(foot.counterChoice(1, foundry, [], 'tank'), 'breaker');
  const towers = make('fast', ['tower', 'tower']);
  assert.equal(towers.counterChoice(1, foundry, [], 'tank'), 'breaker');
  const relaxed = make('relaxed', ['tank', 'tank', 'tank', 'tank']);
  assert.equal(relaxed.counterChoice(1, barracks, [], 'vanguard'), 'vanguard');
});

test('the AI branch follows its role: siege takes plating, others weapons; relaxed keeps weapons', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  assert.equal(s.researchBranch(1, 'siege'), 'plating');
  assert.equal(s.researchBranch(1, 'raider'), 'upgrade');
  assert.equal(new Simulation({ aiSpeed: 'relaxed' }).researchBranch(1, 'siege'), 'upgrade');
});

test('a badly hurt fighter retreats to a Medic and rejoins when healed; no Medic means no retreat', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  const medic = s.spawn('medic', 1, -30, -20), r = s.spawn('ranger', 1, -30, 0);
  r.hp = r.maxHp * 0.2;
  const army = () => s.own(1).filter((e) => e.kind === 'unit' && e.type !== 'worker');
  s.aiRetreat(1, army());
  assert.equal(r.retreating, true);
  assert.equal(r.orders[0].type, 'move');
  r.hp = r.maxHp * 0.9;
  s.aiRetreat(1, army());
  assert.equal(r.retreating, false);
  medic.hp = 0; s.entities = s.entities.filter((e) => e !== medic);
  r.hp = r.maxHp * 0.1;
  s.aiRetreat(1, army());
  assert.ok(!r.retreating, 'alone it keeps fighting');
});

test('a rich Normal AI adds a third Barracks and extra towers; a relaxed one does not', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  s.players[1].alloy = 900;
  const own = s.own(1);
  assert.equal(s.surplusBuilding(1, own, 'balanced'), 'barracks');
  s.players[1].alloy = 100;
  assert.equal(s.surplusBuilding(1, own, 'balanced'), null);
  const r = new Simulation({ map: 'classic', aiSpeed: 'relaxed' });
  r.players[1].alloy = 900;
  assert.equal(r.surplusBuilding(1, r.own(1), 'balanced'), null);
});

test('the intel memory is saved and a counter-building match replays to the same state', () => {
  const a = new Simulation({ map: 'classic', aiSpeed: 'normal' });
  run(a, 150);
  const b = Simulation.load(a.serialize());
  assert.equal(b.hash(), a.hash());
  run(a, 30); run(b, 30);
  assert.equal(b.hash(), a.hash());
});
