import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, loadProgress, recordClear, isCleared } from '../src/campaign.js';

const store = (v) => ({ getItem: () => JSON.stringify(v) });

test('loadProgress drops non-numeric or negative stored times', () => {
  const [a, b, c, d, e] = MISSIONS.map((m) => m.id);
  const p = loadProgress(store({ cleared: { [a]: { time: 'abc', medal: 'gold' }, [b]: { time: 0, medal: 'silver' }, [c]: { time: -5 }, [d]: null, [e]: { time: 90, medal: 'platinum' } } }));
  assert.deepEqual(p.cleared, { [b]: { time: 0, medal: 'silver', difficulty: 'standard' }, [e]: { time: 90, medal: 'bronze', difficulty: 'standard' } });
  assert.equal(isCleared(p, 0), false);
});

test('recordClear never produces NaN', () => {
  const id = MISSIONS[0].id;
  const p = recordClear({ cleared: { [id]: { time: 'abc', medal: 'gold' } } }, 0, 120);
  assert.deepEqual(p.cleared[id], { time: 120, medal: 'bronze', difficulty: 'standard' });
});
