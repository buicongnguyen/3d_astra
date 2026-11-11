// The four enemy factions: unit numbers, traits, abilities, auras, cloaks and AI personalities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';
import { FACTION_RULES } from '../src/factions.js';
import balance from '../src/balance.json' with { type: 'json' };

const TICK = 0.05;
const sim = (faction, options = {}) => new Simulation({ ai: false, factions: { 1: faction }, ...options });
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds / TICK); i++) s.tick(TICK); };
// Far from both bases, so nothing else interferes.
const FIELD = { x: 0, z: 30 };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('every faction type has a definition, a model and the slot it replaces', async () => {
  const fs = await import('node:fs');
  for (const [id, f] of Object.entries(FACTION_RULES)) {
    for (const [slot, type] of Object.entries(f.swap)) {
      assert.ok(D[type], `${id}: ${type}`);
      assert.equal(D[type].kind, 'unit');
      assert.equal(D[type].class, D[slot].class, `${type} keeps the class of ${slot}`);
      assert.equal(D[type].required_level, D[slot].required_level, `${type} unlocks where ${slot} does`);
      assert.ok(fs.existsSync(new URL(`../public/models/${type}.glb`, import.meta.url)));
    }
    if (f.building) { assert.equal(D[f.building].kind, 'building'); assert.equal(D[f.building].requires, 'barracks'); }
    if (f.ai) assert.ok(balance.ai_personalities[f.ai], `${id}: personality ${f.ai}`);
    if (f.trait) assert.ok(balance.traits[f.trait], `${id}: trait ${f.trait}`);
  }
});

test('a faction match starts with that faction\'s units and trains them', () => {
  const s = sim('ashfall');
  assert.ok(s.own(1).some((e) => e.type === 'scrapper') && !s.own(1).some((e) => e.type === 'vanguard'));
  assert.ok(s.own(0).some((e) => e.type === 'vanguard'));
  const b = s.own(1).find((e) => e.type === 'barracks');
  s.players[1].alloy = 1000;
  assert.equal(s.enqueue(b.id, 'scrapper'), true);
  run(s, D.scrapper.time + 1);
  assert.equal(s.own(1).filter((e) => e.type === 'scrapper').length, 2);
  // Wardens have no Medics or Engineers anywhere on their roster.
  const w = sim('wardens');
  assert.ok(!w.unitRoster(1).includes('medic') && !w.unitRoster(1).includes('engineer'));
  assert.ok(!w.own(1).find((e) => e.type === 'barracks').trains.includes('medic'));
});

test('Scorcher: double damage to buildings, a burn line that hurts units only and ends', () => {
  const s = sim('ashfall'), scorcher = s.spawn('scorcher', 1, FIELD.x, FIELD.z);
  const tower = s.spawn('tower', 0, FIELD.x + 3, FIELD.z), soldier = s.spawn('ranger', 0, FIELD.x + 30, FIELD.z);
  tower.shield = soldier.shield = 0;
  let hp = tower.hp; s.hit(scorcher, tower);
  assert.ok(near(hp - tower.hp, D.scorcher.damage * 2), 'building bonus');
  hp = soldier.hp; s.hit(scorcher, soldier);
  assert.ok(near(hp - soldier.hp, D.scorcher.damage), 'no bonus against a unit');
  // Burn line: aimed, in range only.
  const a = D.scorcher.ability, victim = s.spawn('breaker', 0, FIELD.x + 5, FIELD.z + 10), friend = s.spawn('scrapper', 1, FIELD.x + 5, FIELD.z + 10.5);
  const wall = s.spawn('tower', 0, FIELD.x + 6.5, FIELD.z + 10);
  victim.shield = 0; wall.shield = 0;
  assert.equal(s.useAbility(scorcher, { x: FIELD.x + 40, z: FIELD.z }), false, 'out of range');
  assert.equal(s.useAbility(scorcher, { x: FIELD.x + 5, z: FIELD.z + 4 }), true);
  assert.equal(s.zones.length, 1);
  s.zones[0].x = victim.x; s.zones[0].z = victim.z;
  const before = { victim: victim.hp, friend: friend.hp, wall: wall.hp };
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.zones.length, 1, 'zones are saved');
  assert.equal(copy.hash(), s.hash());
  for (let i = 0; i < 20; i++) s.stepTactics(TICK);
  // stepTactics does not advance the clock, so the zone is still burning: one second of damage.
  assert.ok(near(before.victim - victim.hp, a.dps, 1e-6), `burn damage ${before.victim - victim.hp}`);
  assert.equal(friend.hp, before.friend, 'own units are safe');
  assert.equal(wall.hp, before.wall, 'buildings do not burn');
  s.time += a.duration + 0.1; s.stepTactics(TICK);
  assert.equal(s.zones.length, 0, 'the fire goes out');
  for (let i = 0; i < 20; i++) { s.time += 0.01; assert.ok(s.useAbility(scorcher, { x: scorcher.x + 1, z: scorcher.z }) || s.time < scorcher.abilityAt); scorcher.abilityAt = 0; }
  assert.ok(s.zones.length <= 16, 'capped');
});

test('salvage: wrecks near a yard or an Ashfall core pay a quarter of their alloy, others pay nothing', () => {
  const s = sim('ashfall'), yard = s.spawn('salvageyard', 1, FIELD.x, FIELD.z);
  const pay = (victim) => { const alloy = s.players[1].alloy; s.events.length = 0; s.applyDamage(victim, 1e6, 1, null); return { gain: s.players[1].alloy - alloy, event: s.events.find((e) => e.type === 'salvage') }; };
  let r = pay(s.spawn('tank', 0, FIELD.x + 10, FIELD.z));
  assert.equal(r.gain, Math.round(D.tank.cost[0] * 0.25));
  assert.deepEqual({ amount: r.event.amount, team: r.event.team }, { amount: r.gain, team: 1 });
  assert.equal(pay(s.spawn('scorcher', 1, FIELD.x + 5, FIELD.z)).gain, Math.round(D.scorcher.cost[0] * 0.25), 'own wrecks count too');
  assert.equal(pay(s.spawn('tower', 0, FIELD.x, FIELD.z + 8)).gain, Math.round(D.tower.cost[0] * 0.25), 'buildings count');
  assert.equal(pay(s.spawn('ranger', 0, FIELD.x + 3, FIELD.z)).gain, 0, 'infantry leave nothing');
  assert.equal(pay(s.spawn('tank', 0, FIELD.x + 15, FIELD.z)).gain, 0, 'outside 14 m');
  yard.complete = false;
  assert.equal(pay(s.spawn('tank', 0, FIELD.x + 5, FIELD.z)).gain, 0, 'an unfinished yard collects nothing');
  const core = s.own(1).find((e) => e.type === 'hq');
  assert.ok(pay(s.spawn('tank', 0, core.x + 6, core.z)).gain > 0, 'the core collects as well');
  // A Meridian enemy collects nothing.
  const m = new Simulation({ ai: false }), mc = m.own(1).find((e) => e.type === 'hq'), alloy = m.players[1].alloy;
  m.applyDamage(m.spawn('tank', 0, mc.x + 6, mc.z), 1e6, 1, null);
  assert.equal(m.players[1].alloy, alloy);
});

test('Scrapper Rush and Rider Dash are timed sprints; Sunward is faster on roads and sand', () => {
  const s = sim('ashfall'), e = s.spawn('scrapper', 1, FIELD.x, FIELD.z);
  assert.equal(s.useAbility(e), true);
  assert.ok(near(e.speed, D.scrapper.speed * 1.4));
  run(s, D.scrapper.ability.duration + 0.2);
  assert.equal(e.speed, D.scrapper.speed);
  const d = sim('sunward', { map: 'dunes' }), rider = d.spawn('rider', 1, 0, 0), ranger = d.spawn('ranger', 0, 0, 0);
  const surface = d.terrain.at(rider.x, rider.z);
  assert.ok(balance.traits.roads.surfaces.includes(surface), `test spot is ${surface}`);
  assert.ok(near(d.moveSpeed(rider), D.rider.speed * 1.15));
  assert.equal(d.moveSpeed(ranger), D.ranger.speed, 'other factions get nothing');
  assert.equal(d.useAbility(rider), true);
  assert.ok(near(rider.speed, D.rider.speed * 2));
  // On the classic map everything is dirt: no bonus.
  const c = sim('sunward'), plain = c.spawn('rider', 1, 0, 0);
  assert.equal(c.moveSpeed(plain), D.rider.speed);
});

test('Supply wagon heals people and machines and adds supply; a Waystation triples shield recharge', () => {
  const s = sim('sunward'), wagon = s.spawn('wagon', 1, FIELD.x, FIELD.z);
  const rider = s.spawn('rider', 1, FIELD.x + 2, FIELD.z), other = s.spawn('wagon', 1, FIELD.x - 2, FIELD.z);
  const cap = s.population(1).cap;
  assert.equal(cap, s.own(1).reduce((n, e) => n + (e.complete ? e.supply || 0 : 0), 0));
  assert.ok(s.supportValid(wagon, rider) && s.supportValid(wagon, other) && !s.supportValid(wagon, wagon));
  rider.hp = 50;
  run(s, 2.05);
  assert.ok(rider.hp >= 50 + 2 * D.wagon.support - 1e-6, `healed to ${rider.hp}`);
  const supplyBefore = s.population(1).cap;
  other.hp = 0; s.settle();
  assert.equal(s.population(1).cap, supplyBefore - D.wagon.supply);
  // Waystation: 4 per second becomes 12 within 10 m.
  const station = s.spawn('waystation', 1, FIELD.x + 20, FIELD.z + 10);
  const close = s.spawn('rider', 1, station.x + 5, station.z), far = s.spawn('rider', 1, station.x + 20, station.z);
  close.shield = far.shield = 0; close.shieldDelay = far.shieldDelay = 0;
  run(s, 1);
  assert.ok(close.shield > far.shield * 2.4, `${close.shield} vs ${far.shield}`);
  station.hp = 0; s.settle(); run(s, 0.5);
  assert.equal(close.shieldRate, undefined, 'the bonus ends with the building');
});

test('Wardens: units mend themselves after six quiet seconds; a Pylon adds half again to building shields', () => {
  const s = sim('wardens'), drone = s.spawn('drone', 1, FIELD.x, FIELD.z);
  drone.hp = 20; drone.hitAt = s.time;
  run(s, 5.5);
  assert.equal(drone.hp, 20, 'still waiting');
  run(s, 1.5);
  assert.ok(drone.hp > 20 && drone.hp < 20 + D.drone.hp * 0.02 * 1.6, `mending: ${drone.hp}`);
  const meridian = s.spawn('ranger', 0, FIELD.x - 30, FIELD.z); meridian.hp = 20;
  run(s, 8);
  assert.equal(meridian.hp, 20, 'other factions do not self-repair');
  // Drone shields come back after 3 s, not 5.
  s.applyDamage(drone, 10, 0, null);
  assert.equal(drone.shieldDelay, 3);
  // Pylon.
  const core = s.own(1).find((e) => e.type === 'hq'), base = core.maxShield;
  const pylon = s.spawn('pylon', 1, core.x + 6, core.z);
  run(s, 0.3);
  assert.equal(core.maxShield, base * 1.5);
  assert.equal(pylon.maxShield, D.pylon.shield, 'a pylon does not boost itself');
  pylon.hp = 0; s.settle(); run(s, 0.3);
  assert.equal(core.maxShield, base);
  assert.ok(core.shield <= base);
});

test('Walker Brace: no movement, three metres more range, then back to normal', () => {
  const s = sim('wardens'), walker = s.spawn('walker', 1, FIELD.x, FIELD.z);
  s.issue([walker.id], { type: 'move', x: FIELD.x + 20, z: FIELD.z });
  assert.equal(s.useAbility(walker), true);
  assert.equal(walker.range, D.walker.range + 3);
  run(s, 4);
  assert.ok(near(walker.x, FIELD.x) && walker.orders.length === 1, 'stands still and keeps its order');
  run(s, D.walker.ability.duration);
  assert.equal(walker.range, D.walker.range);
  assert.ok(walker.x > FIELD.x + 1, 'walks on afterwards');
});

test('Veil: more sight; Mark raises damage taken and does not stack', () => {
  const s = sim('veil'), watcher = s.spawn('watcher', 1, FIELD.x, FIELD.z);
  assert.equal(watcher.vision, D.watcher.vision + 3);
  const tank = s.spawn('tank', 0, FIELD.x + 8, FIELD.z); tank.shield = 0;
  let hp = tank.hp; s.hit(watcher, tank);
  assert.ok(near(hp - tank.hp, D.watcher.damage * 3 * balance.traits.farsight.damage), 'farsight costs some damage');
  s.updateVision();
  assert.equal(s.useAbility(watcher), true);
  assert.ok(tank.markedUntil > s.time);
  hp = tank.hp; s.applyDamage(tank, 100, 0, null);
  assert.ok(near(hp - tank.hp, 125));
  watcher.abilityAt = 0; s.useAbility(watcher);
  hp = tank.hp; s.applyDamage(tank, 100, 0, null);
  assert.ok(near(hp - tank.hp, 125), 'a second Mark replaces the first');
  s.time += D.watcher.ability.duration + 1;
  hp = tank.hp; s.applyDamage(tank, 100, 0, null);
  assert.ok(near(hp - tank.hp, 100), 'it wears off');
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
});

test('cloak: a Shade is hidden until it strikes or a detector is close; splash still hurts it', () => {
  const s = sim('veil'), shade = s.spawn('shade', 1, FIELD.x, FIELD.z);
  shade.stance = 'hold';
  const scout = s.spawn('ranger', 0, FIELD.x + 8, FIELD.z);
  run(s, 0.3);
  assert.equal(shade.cloaked, true);
  assert.equal(s.isVisible(shade, 0), false, 'in sight range but hidden');
  assert.equal(s.isVisible(shade, 1), true, 'its own side always sees it');
  assert.equal(s.enemy(scout, scout.vision), null, 'cannot be targeted');
  assert.equal(s.fight(scout, shade, TICK), false);
  // Splash from a shot at something else still lands.
  const decoy = s.spawn('worker', 1, FIELD.x + 1, FIELD.z), tank = s.spawn('tank', 0, FIELD.x + 9, FIELD.z + 1);
  const hp = shade.hp + shade.shield; s.hit(tank, decoy);
  assert.ok(shade.hp + shade.shield < hp);
  // A unit within 4 m reveals it, and the player is told.
  scout.x = FIELD.x + 3; s.events.length = 0; run(s, 0.3);
  assert.equal(s.isVisible(shade, 0), true);
  assert.ok(s.events.some((e) => e.type === 'reveal'));
  scout.x = FIELD.x + 8; run(s, 0.3);
  assert.equal(s.isVisible(shade, 0), false);
  // A tower within 9 m reveals it; a Supply relay does not.
  const tower = s.spawn('tower', 0, FIELD.x, FIELD.z + 8); tower.damage = 0;
  run(s, 0.3); assert.equal(s.isVisible(shade, 0), true);
  tower.hp = 0; s.settle(); s.spawn('relay', 0, FIELD.x, FIELD.z + 8); run(s, 0.3);
  assert.equal(s.isVisible(shade, 0), false);
  // Striking drops the cloak at once, for three seconds.
  s.events.length = 0; s.hit(shade, scout);
  assert.equal(shade.cloaked, undefined);
  assert.ok(s.events.some((e) => e.type === 'reveal' && e.ambush && e.victim === 0), 'the ambush is announced');
  assert.equal(s.isVisible(shade, 0), true);
  shade.cooldown = 99; scout.damage = 0; tank.damage = 0;
  run(s, 2); assert.equal(shade.cloaked, undefined);
  run(s, 1.5); assert.equal(shade.cloaked, true);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.isVisible(copy.get(shade.id), 0), false, 'the cloak survives a save');
  assert.equal(copy.hash(), s.hash());
});

test('Veil relay cloaks other Veil units near it and reveals hidden enemies', () => {
  const s = sim('veil'), relay = s.spawn('veilrelay', 1, FIELD.x, FIELD.z);
  const close = s.spawn('watcher', 1, FIELD.x + 5, FIELD.z), far = s.spawn('watcher', 1, FIELD.x + 20, FIELD.z);
  run(s, 0.3);
  assert.equal(close.cloaked, true);
  assert.equal(far.cloaked, undefined);
  relay.hp = 0; s.settle(); run(s, 0.3);
  assert.equal(close.cloaked, undefined, 'the cover ends with the relay');
  // Meridian units are never cloaked.
  const m = new Simulation({ ai: false }); run(m, 0.5);
  assert.ok(m.entities.every((e) => e.cloaked === undefined && e.shotAt === undefined));
});

test('AI personalities change the tempo per team and leave Meridian alone', () => {
  // The numbers are balance data (ai_personalities) and move with tuning; the test follows them.
  const P = balance.ai_personalities, base = new Simulation({ aiSpeed: 'normal' });
  assert.equal(base.paceFor(1), base.pace);
  const rush = new Simulation({ aiSpeed: 'normal', factions: { 1: 'ashfall' } }), p = rush.paceFor(1);
  assert.ok(P.rush.scale.firstWave < 1 && P.rush.add.minWave > 0, 'a rush comes earlier and in greater numbers');
  assert.ok(near(p.firstWave, base.pace.firstWave * P.rush.scale.firstWave) && near(p.waveGap, base.pace.waveGap * P.rush.scale.waveGap));
  assert.equal(p.minWave, base.pace.minWave + P.rush.add.minWave);
  assert.ok(near(rush.waveAt[1], base.pace.firstWave * P.rush.scale.firstWave));
  assert.equal(rush.paceFor(0), rush.pace, "the first seat is untouched");
  const turtle = new Simulation({ aiSpeed: 'normal', factions: { 1: 'wardens' } }).paceFor(1);
  assert.ok(P.turtle.scale.firstWave > 1 && P.turtle.add.towers > 0, 'a turtle waits and fortifies');
  assert.equal(turtle.towers, base.pace.towers + P.turtle.add.towers);
  assert.equal(turtle.minWave, base.pace.minWave + P.turtle.add.minWave);
  // A wave never drops below two units, whatever the personality subtracts.
  assert.ok(new Simulation({ aiSpeed: 'relaxed', factions: { 1: 'veil' } }).paceFor(1).minWave >= 2);
  assert.equal(base.pace.army[0], new Simulation({ aiSpeed: 'normal', factions: { 1: 'ashfall' } }).pace.army[0], 'the shared table is not modified');
});

test('each faction AI builds its own building, fields its own units and attacks', () => {
  for (const faction of ['ashfall', 'sunward', 'wardens', 'veil']) {
    const s = new Simulation({ aiSpeed: 'fast', factions: { 1: faction } });
    const special = Object.values(FACTION_RULES[faction].swap), building = FACTION_RULES[faction].building;
    const seen = new Set(); let built = false, attacked = false;
    for (let i = 0; i < 8 * 60 / TICK && !s.result; i++) {
      s.tick(TICK);
      if (i % 40 === 0) {
        // The player does nothing in this test: keep the core standing so the match runs on.
        for (const e of s.own(0)) if (e.type === 'hq') e.hp = e.maxHp;
        for (const e of s.own(1)) { if (special.includes(e.type)) seen.add(e.type); if (e.type === building && e.complete) built = true; }
      }
      for (const e of s.events) if (e.type === 'incoming') attacked = true;
      s.events.length = 0;
    }
    assert.ok(built, `${faction}: built a ${building}`);
    assert.ok(seen.size >= 1, `${faction}: fielded ${[...seen]}`);
    assert.ok(attacked || s.result, `${faction}: sent a wave`);
    for (const e of s.own(1)) assert.ok(s.unitRoster(1).includes(e.type) || e.kind !== 'unit', `${faction} fields ${e.type}`);
    const copy = Simulation.load(s.serialize());
    assert.equal(copy.hash(), s.hash(), `${faction}: save and load`);
  }
});

test('story unlocks lend the player another roster\'s unit, in the right building, and survive a save', () => {
  const mission = { id: 'fixture', factions: { 1: 'ashfall' }, rules: { unlock: ['rider'] }, objectives: [], setup: [], win: [], triggers: [] };
  const s = new Simulation({ ai: false, mission }), barracks = s.own(0).find((e) => e.type === 'barracks');
  assert.ok(barracks.trains.includes('rider') && barracks.trains.includes('ranger'), 'Riders join the Barracks beside Rangers');
  assert.ok(!s.own(0).find((e) => e.type === 'hq').trains.includes('rider'));
  assert.ok(!s.own(1).find((e) => e.type === 'barracks').trains.includes('rider'), 'only the player');
  s.players[0].alloy = s.players[0].energy = 1000;
  assert.equal(s.enqueue(barracks.id, 'rider'), true);
  assert.equal(s.enqueue(barracks.id, 'shade'), false);
  const copy = Simulation.load(s.serialize());
  assert.ok(copy.own(0).find((e) => e.type === 'barracks').trains.includes('rider'));
  assert.equal(copy.hash(), s.hash());
  // The same through a mission action, with a message; a Barracks built later gets it too.
  const later = new Simulation({ ai: false, mission: { ...mission, rules: {} } });
  assert.ok(!later.own(0).find((e) => e.type === 'barracks').trains.includes('rider'));
  later.events.length = 0;
  later.missionAction({ unlock: ['rider'] });
  assert.ok(later.own(0).find((e) => e.type === 'barracks').trains.includes('rider'));
  assert.ok(later.events.some((e) => e.type === 'message' && /Rider can now be trained/.test(e.text)));
  assert.ok(later.spawn('barracks', 0, 0, 30).trains.includes('rider'));
  // A match without unlocks stores nothing new.
  assert.equal(new Simulation({ ai: false }).unlocks, undefined);
});

test('the models a mission needs include what its script spawns or unlocks later', async () => {
  const { modelsForMatch } = await import('../src/model-roster.js');
  const { MISSIONS } = await import('../src/campaign.js');
  const m9 = MISSIONS.find((m) => m.id === 'm09-a-debt-in-the-dunes'), m12 = MISSIONS.find((m) => m.id === 'm12-frontiers-end');
  assert.ok(modelsForMatch(new Simulation({ ai: false, mission: m9, map: m9.map })).includes('rider'));
  const twelve = modelsForMatch(new Simulation({ ai: false, mission: m12, map: m12.map, enemyCount: m12.enemies }));
  assert.ok(twelve.includes('rider'));
  const m1 = MISSIONS[0];
  const one = modelsForMatch(new Simulation({ ai: false, mission: m1, map: m1.map }));
  assert.ok(one.includes('scrapper') && !one.some((t) => ['rider', 'walker', 'shade'].includes(t)), 'mission 1 downloads Ashfall models only');
});

test('a hold is won at once when no enemy fighter is left to contest it', () => {
  const mission = { id: 'hold-fixture', rules: { ai: false }, regions: { spot: { x: 0, z: 30, r: 6 } }, points: [{ id: 'spot', region: 'spot' }],
    objectives: [{ id: 'h', text: 'Hold', type: 'hold', points: ['spot'], need: 1, seconds: 60 }], win: ['h'], setup: [], triggers: [] };
  const s = new Simulation({ ai: false, mission });
  s.mission.points.spot = { owner: 0 };
  const hold = mission.objectives[0];
  s.stepObjective(hold, s.mission.objectives.h, 0.05);
  assert.equal(s.mission.objectives.h.state, 'active', 'enemy fighters still stand');
  for (const e of s.entities) if (e.team === 1 && e.kind === 'unit' && e.type !== 'worker') e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.stepObjective(hold, s.mission.objectives.h, 0.05);
  assert.equal(s.mission.objectives.h.state, 'done');
});
