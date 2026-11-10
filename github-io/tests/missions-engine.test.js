import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

const base = { id: 't', map: 'classic', objectives: [], win: [], regions: { mid: { x: 0, z: 0, r: 7 }, east: { x: 14, z: 0, r: 6 } } };
const make = (mission, options = {}) => new Simulation({ map: mission.map, ai: false, ...options, mission });
const run = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20 && !s.result; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };
const types = (events, type) => events.filter((e) => e.type === type);

test('hold: owning enough capture points for long enough wins, and an enemy can take one back', () => {
  const s = make({ ...base, setup: [{ capturePoint: 'mid', gives: { alloy: 2 } }, { capturePoint: 'east' }, { spawn: 'vanguard', team: 0, at: 'mid', count: 2 }, { spawn: 'vanguard', team: 0, at: 'east', count: 2 }],
    objectives: [{ id: 'hold', text: 'Hold both', type: 'hold', points: ['mid', 'east'], need: 2, seconds: 20 }], win: ['hold'], medals: { gold: { seconds: 40 } } });
  const before = s.players[0].alloy, seen = run(s, 12);
  assert.equal(s.mission.points.mid.owner, 0); assert.equal(types(seen, 'point').length, 2);
  assert.ok(s.players[0].alloy > before + 8, 'the point pays its owner');
  assert.equal(s.missionStatus()[0].have, 2);
  // An enemy squad clears the east point and takes it: the hold timer starts over.
  for (const e of s.own(0)) if (Math.hypot(e.x - 14, e.z) < 7) e.hp = 0;
  const raiders = s.missionSpawn({ spawn: 'vanguard', team: 1, at: 'east', count: 2 });
  run(s, 8);
  assert.equal(s.mission.points.east.owner, 1); assert.equal(s.mission.objectives.hold.held, 0); assert.equal(s.result, null);
  for (const e of raiders) e.hp = 0;
  s.missionSpawn({ spawn: 'vanguard', team: 0, at: 'east', count: 2 });
  run(s, 30, seen);
  assert.equal(s.result, 'victory'); assert.equal(s.mission.medal, 'bronze');
  assert.equal(types(seen, 'missionEnd')[0].result, 'victory');
});

test('escort: the convoy must arrive; losing it fails the mission', () => {
  const mission = { ...base, rules: { ai: false, playerBase: false, enemyBase: false },
    setup: [{ spawn: 'worker', team: 0, at: { x: -20, z: 0 }, tag: 'convoy', name: 'Survey crawler', hp: 400 }, { spawn: 'vanguard', team: 0, at: { x: -22, z: 2 }, count: 2 }],
    objectives: [{ id: 'go', text: 'Escort', type: 'escort', tag: 'convoy', to: 'east' }], win: ['go'], lose: [{ type: 'tagLost', tag: 'convoy' }, { type: 'armyLost' }] };
  const a = make(mission), convoy = a.tagged('convoy')[0];
  assert.equal(convoy.name, 'Survey crawler'); assert.equal(convoy.maxHp, 400);
  assert.equal(a.own(0).filter((e) => e.kind === 'building').length, 0, 'no base in a strike mission');
  a.command({ team: 0, type: 'order', ids: [convoy.id], order: { type: 'move', x: 14, z: 0 } });
  run(a, 40);
  assert.equal(a.result, 'victory');
  const b = make(mission);
  run(b, 1); b.tagged('convoy')[0].hp = 0; run(b, 1);
  assert.equal(b.result, 'defeat');
});

test('survive, collect, build, reach and destroyTag objectives complete on their conditions', () => {
  const s = make({ ...base, setup: [{ spawn: 'relay', team: 1, at: { x: 6, z: 20 }, tag: 'jammer' }, { spawn: 'ranger', team: 0, at: { x: -10, z: 0 }, count: 1 }, { resources: { alloy: 900, energy: 0 } }],
    objectives: [{ id: 'live', text: '', type: 'survive', seconds: 15 }, { id: 'bank', text: '', type: 'collect', alloy: 100 }, { id: 'relay', text: '', type: 'build', building: 'relay', count: 1 },
      { id: 'go', text: '', type: 'reach', region: 'mid' }, { id: 'jam', text: '', type: 'destroyTag', tag: 'jammer' }, { id: 'secret', text: '', type: 'reach', region: 'east', hidden: true }, { id: 'quick', text: '', type: 'timeUnder', seconds: 200, optional: true }],
    win: ['live', 'bank', 'relay', 'go', 'jam'],
    triggers: [{ when: { objective: 'go', is: 'done' }, do: [{ reveal: 'secret' }, { give: { alloy: 60 } }, { say: { who: 'ops', text: 'In position.' } }] }] });
  assert.equal(s.players[0].alloy, 900);
  assert.equal(s.missionStatus().some((o) => o.id === 'secret'), false, 'hidden objectives stay off the list');
  const seen = [];
  s.command({ team: 0, type: 'harvest' });
  const w = s.own(0).find((e) => e.type === 'worker'), hq = s.own(0).find((e) => e.type === 'hq'), spot = s.findPlacement('relay', 0, hq.x + 9, hq.z);
  s.command({ team: 0, type: 'build', worker: w.id, building: 'relay', x: spot.x, z: spot.z });
  s.command({ team: 0, type: 'order', ids: [s.own(0).find((e) => e.type === 'ranger').id], order: { type: 'move', x: 0, z: 0 } });
  run(s, 60, seen);
  const state = (id) => s.mission.objectives[id].state;
  assert.deepEqual(['live', 'bank', 'relay', 'go'].map(state), ['done', 'done', 'done', 'done']);
  assert.equal(types(seen, 'say')[0].text, 'In position.');
  assert.ok(s.missionStatus().some((o) => o.id === 'secret'));
  assert.equal(s.result, null);
  s.tagged('jammer')[0].hp = 0; run(s, 1, seen);
  assert.equal(s.result, 'victory'); assert.equal(state('quick'), 'done');
});

test('triggers: time, zone entry, attack warnings, a hurt convoy; waves march; repeats repeat', () => {
  const s = make({ ...base, setup: [{ spawn: 'worker', team: 0, at: { x: -10, z: 0 }, tag: 'convoy', hp: 300 }],
    objectives: [{ id: 'live', text: '', type: 'survive', seconds: 500 }], win: ['live'],
    triggers: [
      { when: { time: 2 }, do: [{ say: { who: 'ops', text: 'two' } }, { camera: 'mid' }, { music: 'tense' }] },
      { when: { time: 4 }, do: [{ wave: { team: 1, units: { vanguard: 3, ranger: 1 }, from: 'enemyBase', target: 'playerBase' } }] },
      { when: { event: 'incoming' }, do: [{ say: { who: 'ops', text: 'warned' } }] },
      { when: { tagHpBelow: { tag: 'convoy', percent: 50 } }, do: [{ say: { who: 'ops', text: 'hurt' } }] },
      { when: { enter: 'east', team: 0 }, do: [{ say: { who: 'ops', text: 'entered' } }] },
      { when: { time: 1 }, repeat: 3, do: [{ ping: 'mid' }] },
    ] });
  const army = s.own(1).filter((e) => e.kind === 'unit').length, seen = run(s, 3);
  assert.deepEqual(types(seen, 'say').map((e) => e.text), ['two']);
  assert.equal(types(seen, 'camera').length, 1); assert.equal(types(seen, 'music')[0].mood, 'tense');
  run(s, 2, seen);
  assert.equal(s.own(1).filter((e) => e.kind === 'unit').length, army + 4);
  assert.ok(s.own(1).filter((e) => e.orders[0]?.type === 'attackmove').length >= 4, 'the wave marches');
  assert.ok(types(seen, 'say').some((e) => e.text === 'warned'));
  const convoy = s.tagged('convoy')[0];
  convoy.hp = 100;
  s.command({ team: 0, type: 'order', ids: [convoy.id], order: { type: 'move', x: 14, z: 0 } });
  for (const e of s.own(1)) if (e.kind === 'unit') e.hp = 0;
  run(s, 25, seen);
  const said = types(seen, 'say').map((e) => e.text);
  assert.ok(said.includes('hurt') && said.includes('entered'));
  assert.equal(said.filter((t) => t === 'two').length, 1, 'one-shot triggers fire once');
  assert.ok(types(seen, 'ping').length >= 8, 'a repeating trigger keeps firing');
});

test('a mission saves and loads mid-way and then plays out identically; standard wins do not end it early', () => {
  const mission = { ...base, setup: [{ capturePoint: 'mid' }, { spawn: 'vanguard', team: 0, at: 'mid', count: 3 }],
    objectives: [{ id: 'hold', text: '', type: 'hold', points: ['mid'], need: 1, seconds: 60 }], win: ['hold'],
    triggers: [{ when: { time: 20 }, do: [{ wave: { team: 1, units: { ranger: 3 }, target: 'mid' } }, { aiSpeed: 'fast' }] }] };
  const a = new Simulation({ map: 'classic', aiSpeed: 'relaxed', mission });
  run(a, 30);
  assert.equal(a.aiSpeed, 'fast');
  const b = Simulation.load(a.serialize());
  assert.equal(b.hash(), a.hash()); assert.equal(b.pace, a.pace);
  run(a, 20); run(b, 20);
  assert.equal(b.hash(), a.hash());
  // Destroying the enemy core is not the goal of this mission.
  for (const e of a.own(1)) e.hp = 0;
  run(a, 2);
  assert.equal(a.result, null);
});
