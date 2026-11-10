import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {AI_SPEEDS} from '../src/ai-plan.js';
import {MISSIONS, ACTS, loadProgress, saveProgress, isUnlocked, isCleared, recordClear, nextMission, bestTime, bestMedal} from '../src/campaign.js';
import {MAPS} from '../src/terrain.js';
const step = (s, n) => { for (let i = 0; i < n * 20; i++) s.tick(.05); };
const messages = s => s.events.filter(e => e.type === 'message').map(e => e.text);
const core = (s, team) => s.own(team).find(e => e.type === 'hq');

test('defaults: normal speed, free-for-all', () => {
  const s = new Simulation({ai: false});
  assert.equal(s.aiSpeed, 'normal'); assert.equal(s.coalition, false);
  assert.deepEqual([s.pace.think, s.waveAt[1], s.pace.waveGap, s.pace.workers], [2.5, 110, 50, 9]);
  assert.equal(new Simulation({ai: false, aiSpeed: 'warp'}).aiSpeed, 'normal', 'unknown speeds fall back');
});

test('speed presets change tempo without changing costs', () => {
  const tempo = Object.keys(AI_SPEEDS).map(speed => new Simulation({ai: false, aiSpeed: speed}));
  for (let i = 1; i < tempo.length; i++) {
    assert.ok(tempo[i].pace.think < tempo[i - 1].pace.think, 'faster AIs think more often');
    assert.ok(tempo[i].waveAt[1] < tempo[i - 1].waveAt[1], 'and attack sooner');
    assert.deepEqual(tempo[i].players[1], tempo[0].players[1], 'with the same starting resources');
  }
});

test('a faster AI builds a bigger economy and army in the same time', () => {
  const grow = speed => { const s = new Simulation({aiSpeed: speed}); step(s, 150); const units = s.own(1).filter(e => e.kind === 'unit'); return {army: units.length, workers: units.filter(e => e.type === 'worker').length}; };
  const fast = grow('relentless'), slow = grow('relaxed');
  // Both AIs can sit at the same army size this early; the economy is where tempo shows.
  assert.ok(fast.workers > slow.workers, `workers ${fast.workers} > ${slow.workers}`);
  assert.ok(fast.army >= slow.army, `army ${fast.army} >= ${slow.army}`);
});

test('coalition AIs are allies: no mutual fire, shared vision, only the player is hostile', () => {
  const s = new Simulation({ai: false, enemyCount: 2, alliance: 'coalition'});
  assert.ok(s.coalition);
  assert.equal(s.hostile(1, 2), false); assert.equal(s.hostile(0, 1), true); assert.equal(s.hostile(2, 0), true);
  const a = s.spawn('ranger', 1, 0, 0), b = s.spawn('ranger', 2, 3, 0), p = s.spawn('vanguard', 0, 12, -6);
  p.damage = 0; // unarmed, so the idle Rangers' new guard reaction cannot muddy the no-friendly-fire check
  step(s, 3);
  assert.equal(a.hp + a.shield, a.maxHp + a.maxShield); assert.equal(b.hp + b.shield, b.maxHp + b.maxShield);
  assert.equal(s.isVisible(p, 1), s.isVisible(p, 2), 'allies see the same battlefield');
  assert.ok([...s.knownCores[1].values()].every(c => c.team === 0), 'allies only hunt the player');
  // Coalition needs at least two AIs; free-for-all keeps AIs hostile to each other.
  assert.equal(new Simulation({ai: false, enemyCount: 1, alliance: 'coalition'}).coalition, false);
  const ffa = new Simulation({ai: false, enemyCount: 2});
  assert.equal(ffa.hostile(1, 2), true);
});

test('joint offensive: every allied AI attacks your core at the same time', () => {
  const s = new Simulation({enemyCount: 3, alliance: 'coalition'});
  for (const team of [1, 2, 3]) { const hq = core(s, team); for (let i = 0; i < 5; i++) s.spawn('ranger', team, hq.x + i, hq.z + (hq.z > 0 ? -6 : 6)); }
  s.time = s.offensiveAt;
  for (const team of [1, 2, 3]) s.updateAI(team);
  s.advanceCoalition();
  const player = core(s, 0);
  for (const team of [1, 2, 3]) {
    const orders = s.own(team).filter(e => e.kind === 'unit' && e.type !== 'worker' && e.orders[0]?.type === 'attackmove' && !e.raiding);
    assert.ok(orders.length >= 3, `AI ${team} joins the offensive`);
    assert.ok(orders.every(e => Math.hypot(e.orders[0].x - player.x, e.orders[0].z - player.z) < 3), `AI ${team} targets your core`);
  }
  assert.ok(messages(s).some(t => /Joint offensive: 3 enemy armies/.test(t)), 'the player is warned');
  assert.ok(s.offensiveAt > s.time, 'next offensive is scheduled');
});

test('the raider harasses your nearest deposit before the offensive', () => {
  const s = new Simulation({enemyCount: 2, alliance: 'coalition'});
  const hq = core(s, 2);
  for (let i = 0; i < 4; i++) s.spawn('vanguard', 2, hq.x + i, hq.z - 6);
  s.time = s.raidAt;
  s.updateAI(2);
  const raiders = s.own(2).filter(e => e.raiding);
  assert.ok(raiders.length >= 2 && raiders.length <= 3);
  const player = core(s, 0), target = raiders[0].orders[0];
  const deposit = s.resources.filter(r => r.amount > 0).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
  // Group orders spread into a formation around the chosen point.
  assert.equal(target.type, 'attackmove'); assert.ok(Math.hypot(target.x - deposit.x, target.z - deposit.z) < 3);
  assert.ok(messages(s).some(t => /raiders/.test(t)));
});

test('joint offensives keep a home guard and campaign bonus builds a tower', () => {
  const s = new Simulation({enemyCount: 2, alliance: 'coalition'});
  const hq = core(s, 1);
  for (let i = 0; i < 9; i++) s.spawn('ranger', 1, hq.x + (i % 5), hq.z + 6 + Math.floor(i / 5));
  s.time = s.offensiveAt; s.updateAI(1);
  const army = s.own(1).filter(e => e.kind === 'unit' && e.type !== 'worker'), sent = army.filter(e => e.orders[0]?.type === 'attackmove');
  assert.ok(sent.length > army.length / 2 && sent.length < army.length, `${sent.length} of ${army.length} attack`);
  const r = new Simulation({ai: false, enemyCount: 2, alliance: 'coalition', playerBonus: {alloy: 200, energy: 100, tower: true}});
  assert.deepEqual([r.players[0].alloy, r.players[0].energy], [650, 250]);
  assert.equal(r.own(0).filter(e => e.type === 'tower' && e.complete).length, 1);
});

test('allies reinforce a coalition base under attack', () => {
  const s = new Simulation({enemyCount: 2, alliance: 'coalition'});
  const base = core(s, 1), ally = core(s, 2);
  for (let i = 0; i < 4; i++) s.spawn('ranger', 2, ally.x + i, ally.z - 6);
  for (let i = 0; i < 5; i++) s.spawn('vanguard', 0, base.x + i, base.z + 8);
  s.updateVision();
  s.updateAI(1); s.updateAI(2);
  const helpers = s.own(2).filter(e => e.type === 'ranger' && e.orders[0]?.type === 'attackmove');
  assert.ok(helpers.length >= 1, 'an ally sends help');
  assert.ok(helpers.every(e => Math.hypot(e.orders[0].x - base.x, e.orders[0].z - base.z) < 3));
  assert.ok(helpers.length < s.own(2).filter(e => e.kind === 'unit' && e.type !== 'worker').length, 'half stays home');
});

test('campaign: twelve story missions in three acts on real maps, unlocked in order', () => {
  assert.equal(MISSIONS.length, 12);
  assert.deepEqual(ACTS.map(a => a.act), [1, 2, 3]);
  for (const m of MISSIONS) {
    assert.ok(MAPS[m.map], m.map); assert.ok(AI_SPEEDS[m.speed]);
    assert.ok(ACTS.some(a => a.act === m.act), `${m.id} belongs to an act`);
  }
  assert.equal(new Set(MISSIONS.map(m => m.id)).size, 12, 'mission ids are unique');
  let p = {cleared: {}};
  assert.deepEqual(MISSIONS.map((_, i) => isUnlocked(p, i)), [true, ...Array(11).fill(false)]);
  p = recordClear(p, 0, 300, 'silver'); p = recordClear(p, 0, 420, 'gold'); p = recordClear(p, 0, 500, 'bronze');
  assert.deepEqual(p.cleared[MISSIONS[0].id], {time: 300, medal: 'gold'}, 'best time and best medal are kept separately');
  assert.equal(bestTime(p, 0), 300); assert.equal(bestMedal(p, 0), 'gold'); assert.equal(bestTime(p, 1), null);
  assert.equal(isUnlocked(p, 1), true); assert.equal(isUnlocked(p, 2), false);
  assert.equal(nextMission(p), 1);
  assert.equal(isUnlocked(recordClear({cleared: {}}, 0, 0), 1), true, 'an instant clear still counts');
  assert.equal(isCleared(p, -1), false); assert.equal(isUnlocked(p, 12), false);
  let all = {cleared: {}};
  for (let i = 0; i < MISSIONS.length; i++) all = recordClear(all, i, 100 + i);
  assert.equal(nextMission(all), MISSIONS.length - 1, 'a finished campaign rests on the last mission');
});

test('campaign progress survives reloads, ignores the old stage record and tolerates broken storage', () => {
  const store = new Map(), fake = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  // The seven-stage record of earlier versions is left alone and does not unlock anything.
  store.set('frontier-campaign-v1', JSON.stringify({cleared: {'first-contact': 300}}));
  assert.deepEqual(loadProgress(fake), {cleared: {}});
  saveProgress(recordClear({cleared: {}}, 0, 200, 'silver'), fake);
  assert.deepEqual(loadProgress(fake).cleared[MISSIONS[0].id], {time: 200, medal: 'silver'});
  assert.equal(store.get('frontier-campaign-v1'), JSON.stringify({cleared: {'first-contact': 300}}), 'v1 data is untouched');
  assert.ok(store.has('frontier-campaign-v2'));
  store.set('frontier-campaign-v2', '{oops');
  assert.deepEqual(loadProgress(fake), {cleared: {}});
  const broken = {getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }};
  assert.deepEqual(loadProgress(broken), {cleared: {}});
  assert.doesNotThrow(() => saveProgress({cleared: {}}, broken));
});
