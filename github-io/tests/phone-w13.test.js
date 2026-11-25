// W13 (2026-11-25): two-finger camera twist (touch-controls.js), the Hand and Minimap side settings, and the phone
// stylesheets' load order. Browser checks: tests/phone-hud-w13.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TouchControls, twistStep, angleDelta, TWIST_THRESHOLD, TWIST_MIN_SPAN } from '../src/touch-controls.js';
import { defaults, normalize } from '../src/settings.js';

function setup() {
  const canvas = new EventTarget(), captures = new Set(), twists = [], pans = [];
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  const controls = new TouchControls(canvas, { enabled: () => true, activate: () => {}, boxMode: () => false,
    rectangle: () => {}, panZoom: (dx, dy, ratio) => pans.push(ratio), box: () => {}, tap: () => {}, twist: (r) => twists.push(r) });
  const send = (type, x, y, id) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch' });
    canvas.dispatchEvent(e);
  };
  // Two fingers on a circle of radius r around (200, 300), at angle a (radians) for finger 1, a + pi for finger 2.
  const at = (a, r = 80) => [[200 + r * Math.cos(a), 300 + r * Math.sin(a)], [200 - r * Math.cos(a), 300 - r * Math.sin(a)]];
  const place = (a, r, type = 'pointermove') => { const [p, q] = at(a, r); send(type, p[0], p[1], 1); send(type, q[0], q[1], 2); };
  return { controls, send, twists, pans, place, at };
}
const sum = (list) => list.reduce((a, b) => a + b, 0);

test('angleDelta wraps across +-pi', () => {
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9);
  assert.ok(Math.abs(angleDelta(-Math.PI + 0.1, Math.PI - 0.1) + 0.2) < 1e-9);
});

test('twistStep: a dead zone of the threshold, then every degree; nothing when the fingers are too close', () => {
  const s = { total: 0, on: false };
  assert.equal(twistStep(s, 0.1, 100), 0);
  assert.equal(twistStep(s, 0.1, 100), 0);
  const past = twistStep(s, 0.1, 100);
  assert.ok(Math.abs(past - (0.3 - TWIST_THRESHOLD)) < 1e-9, 'only the part beyond the threshold');
  assert.equal(twistStep(s, -0.05, 100), -0.05, 'once on, it follows both ways');
  const close = { total: 0, on: false };
  assert.equal(twistStep(close, 1, TWIST_MIN_SPAN - 1), 0);
});

test('a two-finger rotate twists the camera; a pinch with a wobble does not', () => {
  const f = setup();
  f.place(0, 80, 'pointerdown');
  for (let i = 1; i <= 12; i++) f.place((i * Math.PI) / 36, 80); // 60° clockwise in 5° steps
  const turned = sum(f.twists);
  assert.ok(Math.abs(turned - (Math.PI / 3 - TWIST_THRESHOLD)) < 1e-6, `twisted ${turned}`);
  f.send('pointerup', 0, 0, 1); f.send('pointerup', 0, 0, 2);

  const g = setup();
  g.place(0, 60, 'pointerdown');
  // Pinch out from 60 to 160 px radius while the line wobbles up to 10° either way.
  for (let i = 1; i <= 20; i++) g.place(Math.sin(i) * (Math.PI / 18), 60 + i * 5);
  assert.deepEqual(g.twists, [], 'a pinch alone never twists');
  assert.ok(g.pans.some((r) => r < 1), 'the pinch still zooms');
});

test('lifting a finger starts the next twist from the threshold again', () => {
  const f = setup();
  f.place(0, 80, 'pointerdown');
  for (let i = 1; i <= 6; i++) f.place((i * Math.PI) / 36, 80); // 30°
  const first = sum(f.twists);
  f.send('pointerup', 0, 0, 2);
  const [, q] = f.at(Math.PI / 6, 80);
  f.send('pointerdown', q[0], q[1], 2);
  f.place(Math.PI / 6 + Math.PI / 36, 80); // 5° more: inside the new dead zone
  assert.equal(sum(f.twists), first);
});

test('Hand and Minimap side: defaults, kept values, and anything else falls back', () => {
  assert.equal(defaults(true).handedness, 'right');
  assert.equal(defaults(true).minimapSide, 'left');
  assert.equal(normalize({ version: 1, handedness: 'left', minimapSide: 'right' }, true).handedness, 'left');
  assert.equal(normalize({ version: 1, handedness: 'left', minimapSide: 'right' }, true).minimapSide, 'right');
  assert.equal(normalize({ version: 1, handedness: 'sideways' }, true).handedness, 'right');
  assert.equal(normalize({ version: 1 }, true).handedness, 'right', 'older saves have no Hand and get the default');
});

test('the W13 phone stylesheets load last, after the theme and the HUD contrast pass', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const order = ['./theme-walnut.css', './hud-contrast.css', './phone-hud-slim.css', './phone-handed.css'].map((f) => main.indexOf(`import "${f}"`));
  assert.ok(order.every((i) => i > 0), 'all four are imported');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in this order');
  const cssImports = [...main.matchAll(/import "\.\/([\w-]+)\.css"/g)].map((m) => m[1]);
  assert.equal(cssImports.at(-1), 'phone-handed');
});
