import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('a raider without enough fast units keeps its raid due and retries', () => {
  const s = new Simulation({enemyCount: 2, alliance: 'coalition'});
  const hq = s.own(2).find(e => e.type === 'hq');
  for (const e of s.own(2).filter(e => e.kind === 'unit' && e.type !== 'worker')) e.hp = 0, s.entities.splice(s.entities.indexOf(e), 1);
  s.spawn('vanguard', 2, hq.x, hq.z - 6);
  const due = s.raidAt;
  s.time = due;
  s.updateAI(2);
  assert.equal(s.raidAt, due, 'no raid launched, so raidAt is not pushed forward');
  s.spawn('vanguard', 2, hq.x + 1, hq.z - 6);
  s.time = due + 2.5;
  s.updateAI(2);
  assert.ok(s.own(2).filter(e => e.raiding).length >= 2, 'raid goes out on the retry');
  assert.ok(s.raidAt > due);
});
