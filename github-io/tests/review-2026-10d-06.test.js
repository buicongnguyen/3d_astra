import test from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/i18n.js';

test('joined tooltips translate whole parts before sentence splitting', () => {
  const desc = 'Fast armored fighter. Strong against Rangers; weak against Breakers and Battle tanks.';
  const whole = translate(desc, 'vi');
  assert.notEqual(whole, desc);
  assert.equal(translate(`Q · Vanguard · ${desc}`, 'vi'), `Q · ${translate('Vanguard', 'vi')} · ${whole}`);
  assert.notEqual(translate('Patrol (soldiers / tanks) · P', 'vi'), 'Patrol (soldiers / tanks) · P');
  assert.notEqual(translate('Cancel last job / site · Backspace', 'vi'), 'Cancel last job / site · Backspace');
});
