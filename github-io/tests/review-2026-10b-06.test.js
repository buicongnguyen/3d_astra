import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, recordClear, isCleared } from '../src/campaign.js';

const store = (v) => ({ getItem: () => JSON.stringify(v) });

test('loadProgress drops non-numeric or negative stored times', () => {
  const p = loadProgress(store({ cleared: { 'first-contact': 'abc', 'ashen-line': 0, 'three-way-dunes': -5, 'verdant-pact': null, 'copper-siege': 90 } }));
  assert.deepEqual(p.cleared, { 'ashen-line': 0, 'copper-siege': 90 });
  assert.equal(isCleared(p, 0), false);
});

test('recordClear never produces NaN', () => {
  const p = recordClear({ cleared: { 'first-contact': 'abc' } }, 0, 120);
  assert.equal(p.cleared['first-contact'], 120);
});
