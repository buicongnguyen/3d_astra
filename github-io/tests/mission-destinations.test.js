import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDestinations } from '../src/capture-view.js';

const sim = (states) => ({
  mission: { objectives: states },
  missionDef: { objectives: [
    { id: 'escort', type: 'escort', tag: 'convoy', to: 'relaySite' },
    { id: 'scout', type: 'reach', region: 'ridge' },
    { id: 'out', type: 'escort', tag: 'okoro', to: 'landing' },
    { id: 'guns', type: 'destroyTag', tag: 'bridgeGuns' },
  ] },
  missionPlace: (at) => ({ relaySite: { x: -48, z: -46, r: 8 }, ridge: { x: 5, z: 5, r: 6 }, landing: { x: 1, z: 1, r: 6 } })[at],
});

test('escort and reach objectives mark their destination while active and shown', () => {
  const list = missionDestinations(sim({ escort: { state: 'active' }, scout: { state: 'active' }, out: { state: 'active', hidden: true }, guns: { state: 'active' } }));
  assert.deepEqual(list.map((d) => d.key), ['escort:relaySite', 'scout:ridge']);
  assert.deepEqual(list[0], { key: 'escort:relaySite', x: -48, z: -46, r: 8 });
});

test('finished, failed and skirmish objectives show no marker', () => {
  assert.deepEqual(missionDestinations(sim({ escort: { state: 'done' }, scout: { state: 'failed' }, out: { state: 'active', hidden: true } })), []);
  assert.deepEqual(missionDestinations({ mission: null }), []);
});
