// 0.18 "Wings": air rules (src/sim/air.js and the hooks in movement, combat, vision, orders, AI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';
import { FACTION_RULES, AIR } from '../src/factions.js';
import { TERRAIN } from '../src/terrain.js';

const TICK = 0.05;
const run = (s, seconds) => { for (let i = 0; i < seconds / TICK; i++) s.tick(TICK); };
// A quiet match: the starting armies are parked in a far corner so nothing else fights.
function quiet(options = {}) {
  const s = new Simulation({ ai: false, ...options });
  for (const e of s.entities) if (e.kind === 'unit') { e.x = e.team === 0 ? -40 : 40; e.z = e.team === 0 ? 40 : -40; }
  return s;
}
const put = (s, type, team, x, z) => { const e = s.spawn(type, team, x, z, true, true); s.updateVision(); return e; };
const lastMessage = (s) => s.events.filter((e) => e.type === 'message').at(-1)?.text;

test('flyers are four units of class air; every faction keeps at least two unit types that hit air', () => {
  const flyers = Object.entries(D).filter(([, d]) => d.flying).map(([type]) => type);
  assert.deepEqual(flyers.sort(), ['balloon', 'glider', 'hawk', 'kite']);
  for (const type of flyers) assert.equal(D[type].class, 'air');
  for (const faction of Object.keys(FACTION_RULES)) {
    const s = new Simulation({ ai: false, factions: { 0: faction } });
    const anti = s.unitRoster(0).filter((type) => D[type].hits_air);
    assert.ok(anti.length >= 2, `${faction}: ${anti}`);
    assert.ok(s.unitRoster(0).includes('kite'), `${faction}: Kite scout`);
  }
  const roster = (f) => new Simulation({ ai: false, factions: { 0: f } }).unitRoster(0);
  assert.ok(roster('meridian').includes('hawk') && !roster('ashfall').includes('hawk'));
  assert.ok(roster('ashfall').includes('balloon') && roster('sunward').includes('glider'));
  assert.ok(!roster('wardens').some((t) => ['hawk', 'balloon', 'glider'].includes(t)));
});

test('the Command core is the airfield: Flak, the Kite at level 2 and the faction\'s own flyer; four tiles at most', () => {
  const s = new Simulation({ ai: false, factions: { 0: 'ashfall', 1: 'sunward' } });
  const core = (team) => s.own(team).find((e) => e.type === 'hq');
  assert.deepEqual(core(0).trains, ['worker', 'flak', 'kite', 'balloon']);
  assert.deepEqual(core(1).trains, ['worker', 'flak', 'kite', 'glider']);
  s.players[0].alloy = s.players[0].energy = 5000;
  assert.equal(s.enqueue(core(0).id, 'kite'), false);
  assert.match(lastMessage(s), /level 2/);
  core(0).level = 2;
  assert.ok(s.enqueue(core(0).id, 'kite'));
  // Barracks and Foundry keep their four tiles (a phone shows four).
  for (const faction of Object.keys(FACTION_RULES)) {
    const f = new Simulation({ ai: false, factions: { 0: faction } });
    for (const type of ['hq', 'barracks', 'foundry']) {
      const b = f.own(0).find((e) => e.type === type) || f.spawn(type, 0, -20, 30);
      assert.ok(b.trains.filter((t) => !['upgrade2', 'plating', 'plating2'].includes(t)).length <= 4, `${faction} ${type}: ${b.trains}`);
    }
  }
  // The default Meridian lists stay the definitions' own (saves keep slimming them).
  const m = new Simulation({ ai: false });
  assert.equal(m.own(0).find((e) => e.type === 'hq').trains, D.hq.trains);
  assert.equal(m.own(0).find((e) => e.type === 'barracks').trains, D.barracks.trains);
  assert.equal(m.spawn('foundry', 0, -20, 30).trains, D.foundry.trains);
  // Story missions keep their rosters unless rules.air is set.
  const story = new Simulation({ ai: false, mission: { id: 'x', rules: {}, objectives: [], setup: [], win: [], triggers: [] } });
  assert.deepEqual(story.own(0).find((e) => e.type === 'hq').trains, ['worker']);
  assert.ok(!story.unitRoster(0).includes('kite'));
  const sky = new Simulation({ ai: false, mission: { id: 'y', rules: { air: true }, objectives: [], setup: [], win: [], triggers: [] } });
  assert.equal(sky.own(0).find((e) => e.type === 'hq').trains, D.hq.trains);
  // A story unlock of another side's flyer joins the core.
  story.unlockUnits(0, ['balloon']);
  assert.ok(story.own(0).find((e) => e.type === 'hq').trains.includes('balloon'));
});

test('flyer models load after the match starts; story missions need none unless rules.air', async () => {
  const { modelsForMatch, airModelsFor } = await import('../src/model-roster.js');
  const s = new Simulation({ ai: false, factions: { 0: 'meridian', 1: 'ashfall' } });
  assert.ok(!modelsForMatch(s).some((t) => D[t]?.flying), 'the start waits for no flyer');
  assert.deepEqual(airModelsFor(s).sort(), ['balloon', 'hawk', 'kite']);
  assert.deepEqual(airModelsFor(new Simulation({ ai: false, mission: { id: 'x', rules: {}, objectives: [], setup: [], win: [], triggers: [] } })), []);
  // A flyer already on the field (a loaded save, a mission spawn) is required up front.
  put(s, 'hawk', 0, 0, 30);
  assert.ok(modelsForMatch(s).includes('hawk'));
});

test('a flyer flies straight over the river, walls and a plateau, inside the map', () => {
  const s = quiet({ map: 'riverlands' });
  const k = put(s, 'kite', 0, 30, -20);
  s.issue([k.id], { type: 'move', x: 30, z: 20 });
  let wobble = 0;
  for (let i = 0; i < 200 && k.orders.length; i++) { s.tick(TICK); wobble = Math.max(wobble, Math.abs(k.x - 30)); }
  assert.equal(k.orders.length, 0, 'arrived');
  assert.ok(Math.abs(k.z - 20) < 1.3 && wobble < 0.01, `straight across the water (${wobble})`);
  // Through a wall (classic map, wall at -9,-5) and the ford is no slower.
  const c = quiet();
  const w = put(c, 'kite', 0, -9, -15);
  c.issue([w.id], { type: 'move', x: -9, z: 5 });
  run(c, 4);
  assert.ok(w.z > 3.7 && Math.abs(w.x + 9) < 0.01, `${w.x}, ${w.z}`);
  // Over a plateau rim (dunes) and never past the edge of the map.
  const d = quiet({ map: 'dunes' }), p = d.terrain.plateaus[0];
  const f = put(d, 'glider', 0, p.x - p.r - 6, p.z);
  d.issue([f.id], { type: 'move', x: p.x + p.r + 6, z: p.z });
  run(d, 4);
  assert.ok(Math.abs(f.z - p.z) < 0.01 && f.x > p.x + p.r);
  f.x = d.terrain.half - 1.5; d.issue([f.id], { type: 'move', x: d.terrain.half + 20, z: p.z });
  run(d, 1);
  assert.ok(f.x <= d.terrain.half - 1);
  // inFord: a flyer is never slowed.
  assert.equal(s.inFord({ x: 0, z: 0, flying: true }), false);
});

test('ground melee cannot target a flyer nor be ordered to attack it; a Ranger can', () => {
  const s = quiet();
  const k = put(s, 'kite', 1, 0, 30), v = put(s, 'vanguard', 0, 1.5, 30), r = put(s, 'ranger', 0, -6, 30);
  assert.equal(s.enemy(v, 10), null);
  assert.equal(s.enemy(r, 10)?.id, k.id);
  s.issue([v.id], { type: 'attack', target: k.id });
  assert.equal(v.orders.length, 0);
  assert.match(lastMessage(s), /cannot hit flyers/);
  s.issue([r.id], { type: 'attack', target: k.id });
  assert.equal(r.orders[0]?.type, 'attack');
  const hp = k.hp + k.shield;
  run(s, 2);
  assert.ok(k.hp + k.shield < hp, 'the Ranger hits the Kite');
  // A Kite never attacks, and a flyer that shot a Vanguard is not its "attacker".
  const kid = put(s, 'kite', 0, -10, 20);
  s.issue([kid.id], { type: 'attack', target: v.id });
  assert.equal(kid.orders.length, 0);
  const h = put(s, 'hawk', 1, 4, 30);
  v.hitBy = h.id; v.hitAt = s.time;
  assert.equal(s.attacker(v), null);
});

test('a Sentinel tower shoots flyers only after Flak, and then 1.5 times harder', () => {
  const s = quiet();
  const tower = s.spawn('tower', 0, 0, 25), h = put(s, 'hawk', 1, 0, 33);
  h.damage = 0; // a target that does not fight back
  assert.equal(s.defenseTarget(tower), null);
  s.players[0].flak = true;
  assert.equal(s.defenseTarget(tower)?.id, h.id);
  h.shield = 0;
  const hp = h.hp;
  s.hit(tower, h);
  assert.ok(Math.abs(hp - h.hp - D.tower.damage * AIR.flak_bonus) < 1e-9);
});

test('splash, Barrage and burning ground skip flyers; the balloon\'s bombs splash the ground', () => {
  const s = quiet();
  const tank = put(s, 'tank', 0, 0, 20), foe = put(s, 'ranger', 1, 0, 30), above = put(s, 'kite', 1, 0.5, 30.5), side = put(s, 'ranger', 1, 1, 31);
  for (const e of [foe, above, side]) e.shield = 0;
  const kiteHp = above.hp, sideHp = side.hp;
  s.hit(tank, foe);
  assert.equal(above.hp, kiteHp, 'tank splash');
  assert.ok(side.hp < sideHp, 'ground splash still lands');
  // Barrage on the spot.
  const breaker = put(s, 'breaker', 0, 0, 22);
  assert.ok(s.useAbility(breaker, { x: 0, z: 30 }));
  run(s, 2);
  assert.equal(above.hp, kiteHp, 'Barrage');
  // Burn line.
  (s.zones ||= []).push({ x: 0.5, z: 30.5, radius: 3, until: s.time + 5, dps: 50, team: 0, by: breaker.id });
  run(s, 1);
  assert.equal(above.hp, kiteHp, 'burning ground');
  // The Ember balloon bombs a group: the second soldier takes half.
  const b = quiet({ factions: { 0: 'ashfall' } });
  const balloon = put(b, 'balloon', 0, 0, 30), x = put(b, 'ranger', 1, 0, 32), y = put(b, 'ranger', 1, 1.5, 33), over = put(b, 'kite', 1, 0.5, 32.5);
  x.shield = y.shield = over.shield = 0;
  const yHp = y.hp, overHp = over.hp;
  b.hit(balloon, x);
  assert.ok(Math.abs(yHp - y.hp - D.balloon.damage * D.balloon.splash_damage) < 1e-9);
  assert.equal(over.hp, overHp);
  // It cannot pick a flyer as a target.
  assert.equal(b.enemy(balloon, 20)?.id, x.id);
  assert.equal(b.canHit(balloon, over), false);
});

test('a flyer looks over a deep plateau top from low ground and opens it to its side', () => {
  const s = quiet({ map: 'dunes' }), t = s.terrain, p = t.plateaus[0];
  const [cx, cz] = t.cellAt(p.x, p.z), centre = cz * t.grid + cx;
  assert.equal(t.cellDeep[centre], 1);
  // A Ranger on low ground at 10 m does not see the centre; a Kite at the same spot does.
  const r = put(s, 'ranger', 0, p.x, p.z + p.r + 2);
  s.updateVision();
  assert.equal(s.visible[0][centre], 0);
  const k = put(s, 'kite', 0, p.x, p.z + p.r + 2);
  s.updateVision();
  assert.equal(s.visible[0][centre], 1, 'the Kite sees the top');
  assert.equal(s.levelOf(k), 0);
  // No high-ground bonus for a flyer over the plateau, but the plateau opens to the team.
  k.x = p.x + 2; k.z = p.z;
  r.vision = 1; // the Ranger alone would see nothing
  s.updateVision();
  const [fx, fz] = t.cellAt(p.x - 2, p.z + 2);
  assert.equal(s.visible[0][fz * t.grid + fx], 1);
  assert.equal(s.heightRange(k, r), 0);
  assert.equal(s.heightDamage(k, r), 1);
});

test('the army below sees and shoots an enemy flyer over a hidden plateau cell (airSeenBy)', () => {
  const s = quiet({ map: 'dunes' }), t = s.terrain, p = t.plateaus[0];
  const k = put(s, 'hawk', 1, p.x, p.z + 1), r = put(s, 'ranger', 0, p.x, p.z + p.r + 1.5);
  k.damage = 0;
  s.updateVision();
  const [cx, cz] = t.cellAt(k.x, k.z);
  assert.equal(s.visible[0][cz * t.grid + cx], 0, 'the cell itself stays hidden from below');
  assert.equal(s.isVisible(k, 0), true);
  assert.equal(k.airSeenBy & 1, 1);
  assert.equal(s.enemy(r, r.range)?.id, k.id);
  // Out of everyone's sight it is hidden again.
  r.x = -40; r.z = 40;
  s.updateVision();
  assert.equal(s.isVisible(k, 0), false);
});

test('air cap: four flyers per side, counting the queue; flyers cost supply', () => {
  const s = quiet();
  s.players[0].alloy = s.players[0].energy = 20000;
  const core = s.own(0).find((e) => e.type === 'hq');
  core.level = 3;
  core.supply = 60;
  put(s, 'kite', 0, -20, 30);
  for (let i = 0; i < 2; i++) assert.ok(s.enqueue(core.id, 'kite'), `kite ${i + 2}`);
  assert.ok(s.enqueue(core.id, 'hawk'));
  assert.equal(s.airCount(0), 4);
  const pop = s.population(0);
  assert.equal(pop.reserved, 2 * D.kite.pop + D.hawk.pop);
  assert.equal(s.enqueue(core.id, 'kite'), false);
  assert.match(lastMessage(s), /Air limit reached: 4 flyers/);
  s.cancelQueue(core.id, 0);
  assert.ok(s.enqueue(core.id, 'kite'));
});

test('flyers never take a capture point', () => {
  const s = new Simulation({ ai: false, capturePoints: true });
  const ring = Object.values(s.skirmishPoints)[0];
  for (const e of s.entities) if (e.kind === 'unit') { e.x = -45; e.z = 45; }
  const h = put(s, 'hawk', 0, ring.x, ring.z);
  run(s, 8);
  assert.equal(ring.owner, null);
  h.hp = 0;
  put(s, 'ranger', 0, ring.x, ring.z);
  run(s, 8);
  assert.equal(ring.owner, 0, 'a ground fighter does');
});

test('a match saved mid-flight loads to the same state and keeps playing in step', () => {
  const s = new Simulation({ ai: true, map: 'dunes', factions: { 0: 'meridian', 1: 'ashfall' } });
  const k = put(s, 'kite', 0, -10, 20), b = put(s, 'balloon', 1, 10, -10);
  s.issue([k.id], { type: 'move', x: 20, z: -20 });
  s.issue([b.id], { type: 'attackmove', x: -20, z: 20 });
  run(s, 3);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  run(s, 5); run(copy, 5);
  assert.equal(copy.hash(), s.hash());
  assert.ok(copy.get(k.id).flying && copy.get(k.id).airSeenBy !== undefined);
});

test('no flyer, no change: the all-Meridian hash is unchanged', () => {
  const s = new Simulation({ ai: false });
  run(s, 60);
  assert.equal(s.hash(), 'd071360b');
  assert.equal(s.players[0].flak, undefined);
  assert.ok(!s.entities.some((e) => 'airSeenBy' in e));
});

test('the computer answers flyers: Flak after two seen, units that hit air, and a Kite spotter', () => {
  const s = new Simulation({ ai: true, aiSpeed: 'normal' });
  const hq = s.own(1).find((e) => e.type === 'hq');
  hq.level = 2;
  s.players[1].alloy = s.players[1].energy = 5000;
  for (const i of [0, 1]) { const k = put(s, 'kite', 0, hq.x - 6 - i * 2, hq.z + 6); k.hp = k.maxHp = 1e6; }
  run(s, 30);
  assert.ok(s.seenMix(1).air >= 2, 'it saw the flyers');
  assert.ok(s.players[1].flak || hq.queue.some((q) => q.type === 'flak'), 'Flak researched or under way');
  // Barracks training answers air with a unit that hits air.
  const barracks = s.own(1).find((e) => e.type === 'barracks');
  assert.ok(D[s.typeFor(1, s.counterChoice(1, barracks, s.own(1).filter((e) => e.kind === 'unit' && e.type !== 'worker'), 'vanguard'))].hits_air);
  // With a Foundry up, the core keeps one Kite.
  s.spawn('foundry', 1, hq.x + 8, hq.z - 8);
  hq.queue = [];
  s.time = Math.max(s.time, s.paceFor(1).foundryAt + 1);
  assert.equal(s.aiAirChoice(1, hq, [], s.paceFor(1)), 'kite');
  // Then its own flyer (Meridian: the Hawk, at a level 3 core), at most two.
  const kite = [{ type: 'kite', flying: true, damage: 0 }];
  assert.equal(s.aiAirChoice(1, hq, kite, s.paceFor(1)), null, 'a level 2 core has no Hawk yet');
  hq.level = 3; s.time = Math.max(s.time, s.paceFor(1).upgradeAt + 1);
  assert.equal(s.aiAirChoice(1, hq, kite, s.paceFor(1)), 'hawk');
  const two = [...kite, { flying: true, damage: 5 }, { flying: true, damage: 5 }];
  assert.equal(s.aiAirChoice(1, hq, two, s.paceFor(1)), null);
  // Story missions: never.
  const story = new Simulation({ ai: true, mission: { id: 'x', rules: {}, objectives: [], setup: [], win: [], triggers: [] } });
  assert.equal(story.aiAirChoice(1, story.own(1).find((e) => e.type === 'hq'), [], story.paceFor(1)), null);
});

test('flyers are drawn at altitude: shots to and from them say so, and the Kite detects cloaks', () => {
  const s = quiet({ factions: { 0: 'meridian', 1: 'veil' } });
  const r = put(s, 'ranger', 0, 30, 10), h = put(s, 'hawk', 1, 30, 15);
  s.hit(r, h);
  const shot = s.events.filter((e) => e.type === 'shot').at(-1);
  assert.equal(shot.tAir, D.hawk.fly);
  assert.equal(shot.sAir, undefined);
  s.hit(h, r);
  assert.equal(s.events.filter((e) => e.type === 'shot').at(-1).sAir, D.hawk.fly);
  // A Shade 7 m from a Kite is revealed (plain units reveal at 4 m).
  r.hp = h.hp = 0;
  const shade = put(s, 'shade', 1, 0, 38);
  const k = put(s, 'kite', 0, 0, 45);
  run(s, 4);
  assert.equal(shade.cloaked, true);
  assert.equal(s.isVisible(shade, 0), true);
  k.x = -40;
  run(s, 1);
  assert.equal(s.isVisible(shade, 0), false);
  assert.ok(TERRAIN.plateau_height < D.kite.fly + 3);
});
