import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreen } from '../src/fullscreen.js';

function setup() {
  const doc = new EventTarget();
  doc.documentElement = {};
  const states = [], unavailable = [];
  const control = createFullscreen({doc, onChange: state => states.push(state), onUnavailable: reason => unavailable.push(reason)});
  return {doc, control, states, unavailable};
}

test('unsupported and denied fullscreen requests expose fallback and allow retry', async () => {
  const {doc, control, states, unavailable} = setup();
  await control.toggle();
  assert.deepEqual(unavailable, ['enter']);
  doc.fullscreenEnabled = false;
  doc.documentElement.requestFullscreen = () => assert.fail('disabled API must not be called');
  await control.toggle();
  doc.fullscreenEnabled = true;
  doc.documentElement.requestFullscreen = async () => { throw new Error('Permission denied'); };
  await control.toggle();
  assert.deepEqual(unavailable, ['enter', 'enter', 'enter']);
  assert.deepEqual(states.at(-1), {active:false, pending:false});
});

test('fullscreen requests use the document root, ignore double taps, and follow browser exits', async () => {
  const {doc, control, states, unavailable} = setup();
  let finish, calls = 0;
  doc.documentElement.requestFullscreen = function () {
    assert.equal(this, doc.documentElement);
    calls++;
    return new Promise(resolve => { finish = resolve; });
  };
  const request = control.toggle();
  assert.equal(calls, 1, 'request happens synchronously during user activation');
  await control.toggle();
  assert.equal(calls, 1);
  doc.fullscreenElement = doc.documentElement;
  doc.dispatchEvent(new Event('fullscreenchange'));
  finish();
  await request;
  assert.deepEqual(states.at(-1), {active:true, pending:false});
  doc.fullscreenElement = null;
  doc.dispatchEvent(new Event('fullscreenchange'));
  assert.deepEqual(states.at(-1), {active:false, pending:false});
  doc.fullscreenElement = doc.documentElement;
  doc.exitFullscreen = async function () { assert.equal(this, doc); doc.fullscreenElement = null; };
  await control.toggle();
  assert.deepEqual(states.at(-1), {active:false, pending:false});
  assert.deepEqual(unavailable, []);
});

test('prefixed fullscreen API exits correctly and reports exit failures separately', async () => {
  const {doc, control, states, unavailable} = setup();
  doc.documentElement.webkitRequestFullscreen = function () { doc.webkitFullscreenElement = this; };
  doc.webkitExitFullscreen = () => { throw new Error('Exit rejected'); };
  await control.toggle();
  assert.equal(states.at(-1).active, true);
  await control.toggle();
  assert.deepEqual(unavailable, ['exit']);
  doc.webkitExitFullscreen = () => { doc.webkitFullscreenElement = null; };
  await control.toggle();
  assert.deepEqual(states.at(-1), {active:false, pending:false});
});
