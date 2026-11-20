import test from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/i18n.js';

test('Order cleared sentences are not read as stage names', () => {
  for (const s of ['Tank cannot reach its destination. Order cleared.', 'Tank has no clear line of fire on that target. Order cleared.'])
    assert.doesNotMatch(translate(s, 'vi'), /Đã vượt qua|Tank cannot|clear line/);
  assert.equal(translate('Ashen Line cleared.', 'vi').startsWith('Đã vượt qua'), true);
});

test('ai-plan notices are translated', () => {
  for (const s of ['Joint offensive: 3 enemy armies are attacking you from different sides!', 'Enemy reinforcements are moving to defend an allied base.', 'An enemy army is marching on your base.'])
    assert.notEqual(translate(s, 'vi'), s);
  assert.match(translate('Joint offensive: 3 enemy armies are attacking you from different sides!', 'vi'), /3/);
});
