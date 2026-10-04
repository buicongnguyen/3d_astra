import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/i18n.js';

const leftovers = ['Awaiting supply','Exit blocked','Needs Harvester','refund','Paused','PAUSED','Operation','OPERATION','battlefield','BATTLEFIELD','All systems','ALL SYSTEMS','Initialization','INITIALIZATION','Control group','remaining','Select Harvesters','click or press','Shift-click','Ctrl-click','FFA','allied','Next:'];
const samples = [
  'Cancel Tank, queue item 2, 40%, full refund, Awaiting supply',
  'Cancel Tank, 40%, 75% refund, Exit blocked',
  'Cancel Tank, 40%, full refund, Needs Harvester',
  'Cancel Tank, queue item 1, 5%, full refund',
  'Paused', 'PAUSED', 'Operation complete', 'OPERATION COMPLETE', 'Choose your battlefield', 'CHOOSE YOUR BATTLEFIELD',
  'Operation active', 'OPERATION ACTIVE', 'All systems ready', 'ALL SYSTEMS READY', 'Initialization failed', 'INITIALIZATION FAILED',
  'Control group 3 assigned.', 'Control group 3 extended.',
  'ALLOY · 300 remaining. Select Harvesters to gather.',
  'Group 3 · 5 units — click or press 3 to recall, Ctrl-click to save, Shift-click to add',
  'Group 4 · 1 unit — click or press 4 to recall, Ctrl-click to save, Shift-click to add',
  '2 AIs', '1 AI allied', '3 AIs allied', '3 AIs FFA',
  'Next: Stage 2 · Ridge, 2 AIs · allied against you · Fast speed.',
  'Next: Stage 3 · Ridge, 1 AI · Relaxed speed.',
];

test('review 2026-10c strings translate without leftover English fragments', () => {
  for (const s of samples) {
    const out = translate(s, 'vi');
    assert.notEqual(out, s, s);
    for (const word of leftovers) {
      if (!s.includes(word)) continue;
      if (word === 'Next:' && /Ridge/.test(s)) continue; // stage names stay as proper nouns
      assert.ok(!out.includes(word), `${s} -> ${out} still contains "${word}"`);
    }
  }
});

test('cancel labels translate the reason and refund phrase separately', () => {
  assert.equal(translate('Cancel Tank, 40%, 75% refund, Exit blocked', 'vi'), 'Hủy Tank, 40%, hoàn 75% tài nguyên, Lối ra bị chặn');
  assert.ok(!/refund/.test(translate('Cancel Tank, 40%, full refund', 'vi')));
});
