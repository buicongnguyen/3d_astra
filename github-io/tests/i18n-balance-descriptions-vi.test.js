import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {translate} from '../src/i18n.js';

test('review 2026-10e strings translate', () => {
  assert.equal(translate('Overcharged weapons online. Combat damage increased by 10%.', 'vi'), 'Vũ khí cường hóa đã sẵn sàng. Sát thương chiến đấu tăng 10%.');
  assert.equal(translate('Command core technology 2 / 3', 'vi'), 'Công nghệ Sở chỉ huy 2 / 3');
  assert.equal(translate('Engineer, 100 alloy and 20 energy', 'vi'), 'Công binh, 100 hợp kim và 20 năng lượng');
  assert.equal(translate('Supply relay, 50 alloy', 'vi'), 'Trạm tiếp tế, 50 hợp kim');
  assert.notEqual(translate('EXPEDITION SYSTEMS INITIALIZING', 'vi'), 'EXPEDITION SYSTEMS INITIALIZING');
});

test('every balance.json description has a Vietnamese entry', () => {
  const balance = JSON.parse(readFileSync(new URL('../src/balance.json', import.meta.url), 'utf8'));
  const found = [];
  const walk = o => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'description' && typeof v === 'string') found.push(v); else walk(v); } };
  walk(balance);
  assert.ok(found.length > 5);
  for (const d of found) assert.notEqual(translate(d, 'vi'), d, d);
  assert.ok(!/Anti-tank/.test(translate(found.find(d => d.startsWith('Fast armored fighter')), 'vi')));
});
