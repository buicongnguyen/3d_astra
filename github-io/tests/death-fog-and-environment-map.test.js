import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldView } from '../src/view.js';

test('beginDeath keeps the team so own deaths stay visible in fog', () => {
  const part = { visible: true };
  const o = { position: { x: 3, z: 4 }, userData: { ring: part, bar: part, contactShadow: part, model: { rotation: { y: 0 } } } };
  const self = { objects: new Map([[7, o]]), dying: [] };
  WorldView.prototype.beginDeath.call(self, { seed: 7, team: 0, building: true });
  assert.equal(self.dying[0].team, 0);
});

test('restoreEnvironmentMap rebuilds the map and reapplies reflections', () => {
  const calls = [];
  const old = { dispose: () => calls.push('dispose') };
  const self = {
    environmentMap: old,
    buildEnvironmentMap() { calls.push('build'); this.environmentMap = {}; },
    applyReflections() { calls.push('apply'); },
  };
  assert.equal(typeof WorldView.prototype.restoreEnvironmentMap, 'function');
  WorldView.prototype.restoreEnvironmentMap.call(self);
  assert.deepEqual(calls, ['dispose', 'build', 'apply']);
});
