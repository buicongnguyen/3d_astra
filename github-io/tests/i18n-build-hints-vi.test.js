import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/i18n.js';

test('vi prerequisite hints distinguish missing from under construction', () => {
  assert.match(translate('Build Barracks before building Foundry.', 'vi'), /^Cần xây /);
  assert.match(translate('Finish building Barracks before building Foundry.', 'vi'), /^Hoàn thành /);
});

test('vi build hint uses the same relay term as the building name', () => {
  assert.ok(!translate('BUILD: Q Relay · E Barracks · R Foundry · T Tower · Y Core', 'vi').includes('tiếp vận'));
});
