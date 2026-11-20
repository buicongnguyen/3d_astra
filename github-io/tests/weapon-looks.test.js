import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import balance from '../src/balance.json' with { type: 'json' };
import { weaponStyle } from '../src/visual-style.js';
import { LOOKS, MOMENTS } from '../src/fx-kinds/index.js';
import { DamageNumbers, counterKind, NUMBERS } from '../src/combat-feedback.js';
import { defaults, normalize } from '../src/settings.js';
import { weaponVoice } from '../src/audio-logic.js';
import { BANK } from '../src/sfx-bank.js';
import { Effects } from '../src/fx.js';

const vi = JSON.parse(readFileSync(new URL('../src/locales/vi.json', import.meta.url), 'utf8')).messages;
const styles = JSON.parse(readFileSync(new URL('../src/visual-style.json', import.meta.url), 'utf8')).weapons;
const armed = Object.entries(balance.definitions).filter(([, d]) => d.damage > 0);
const RIFLE_ON_PURPOSE = new Set(['ranger', 'worker']);
const OWN_KEY = new Set(['vanguard', 'tank', 'breaker', 'antitank', 'tower']); // their weapon key is their own style

test('every armed definition resolves to its own style, or the rifle on purpose', () => {
  assert.ok(armed.length >= 20);
  const fallback = weaponStyle({ unit: 'nobody', weapon: 'nothing' });
  for (const [type, d] of armed) {
    const s = weaponStyle({ type: 'shot', unit: type, weapon: d.shot || type });
    if (RIFLE_ON_PURPOSE.has(type)) { assert.equal(s.kind, 'rifle'); continue; }
    if (OWN_KEY.has(type)) { assert.ok(styles[type], type); continue; }
    assert.ok(s !== fallback && s.look, `${type} falls back to the rifle look`);
  }
});
test('Rider, Drone, Hawk and Glider (all shot "ranger") never share a look', () => {
  const looks = ['rider', 'drone', 'hawk', 'glider'].map((u) => weaponStyle({ unit: u, weapon: 'ranger' }).look);
  assert.equal(new Set(looks).size, 4, looks.join());
  assert.equal(weaponStyle({ unit: 'ranger', weapon: 'ranger' }).look, undefined);
});
test('at least 16 looks, every look id resolves to a kind with a spawn function', () => {
  const withLook = Object.entries(styles).filter(([, s]) => s.look);
  assert.ok(withLook.length >= 16, `${withLook.length}`);
  for (const [k, s] of withLook) assert.equal(typeof LOOKS[s.look]?.spawn, 'function', k);
  assert.ok(Object.keys(MOMENTS).length >= 6);
});
test('faction tints change a shared weapon only', () => {
  const plain = weaponStyle({ unit: 'ranger', weapon: 'ranger' }), veil = weaponStyle({ unit: 'ranger', weapon: 'ranger' }, 'veil');
  assert.notDeepEqual(plain.color, veil.color);
  assert.equal(veil.life, plain.life);
  assert.equal(weaponStyle({ unit: 'drone', weapon: 'ranger' }, 'veil').color, weaponStyle({ unit: 'drone', weapon: 'ranger' }).color);
});

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const sim = { entities: [], isVisible: () => true, get: () => null };
const fxWith = (rng) => { const fx = new Effects({ lowPower: false, scene: { add() {} }, terrain: { id: 'riverlands' }, activity: { combat: { motion: true } }, motionLevel: 2 }); fx.rng = rng; return fx; };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const aim = () => ({ from: { x: 0, y: 1.4, z: 0 }, to: { x: 8, y: 1, z: 3 }, land: { x: 8, y: 1, z: 3 }, ux: 0.93, uy: -0.05, uz: 0.35, len: 8.6, sx: -0.35, sz: 0.93, nx: 0.94, nz: 0.35, travel: 0.2, anchor: null, power: 0.5, style: {}, color: [1, 0.8, 0.4, 1] });

test('each fx kind draws the same particles twice with the same seeded rng', () => {
  const snap = (fx) => JSON.stringify([fx.glow.items, fx.smoke.items, fx.decals.items, fx.timeline.length, fx.projectiles.length], (k, v) => (k === 'rot' || k === 'anchor' ? undefined : v));
  for (const id of Object.keys(LOOKS)) {
    const out = [0, 1].map(() => {
      const fx = fxWith(seeded(7));
      LOOKS[id].spawn(fx, { x: 0, z: 0, weapon: 'tank' }, fx.rng, aim());
      fx.update(sim, 0.05);
      return snap(fx);
    });
    assert.equal(out[0], out[1], id);
    assert.ok(out[0].length > 40, id);
  }
});
test('the kinds use only the existing pools (no new mesh, so no new draw)', () => {
  const fx = fxWith(seeded(5)), before = fx.root.children.length;
  for (const k of Object.values(LOOKS)) k.spawn(fx, { x: 0, z: 0, weapon: 'tank' }, fx.rng, aim());
  for (const m of Object.values(MOMENTS)) m(fx, { x: 0, z: 0, radius: 3 }, fx.rng, [1, 1, 1], null);
  assert.equal(fx.root.children.length, before);
  assert.equal(before, 4);
});
test('counter hits: counter class, mechanical bonus, resisted', () => {
  const D = balance.definitions;
  assert.equal(counterKind({ counter: 'ranged' }, { class: 'ranged' }), 1);
  assert.equal(counterKind(D.antitank, { class: 'armor', mechanical: true }), 1);
  assert.equal(counterKind({ kind: 'unit', class: 'ranged' }, { class: 'armor', mechanical: true }), -1);
  assert.equal(counterKind({ kind: 'unit', class: 'armor' }, { class: 'worker' }), 0);
  assert.equal(counterKind(null, D.tank), 0);
});
test('damage numbers come from hp + shield deltas, sum per 0.14 s, ignore heals', () => {
  const n = new DamageNumbers(), e = { id: 1, hp: 100, shield: 20, team: 1, kind: 'unit', x: 1, z: 2, boss: 'b' }, s = { entities: [e] }, vis = () => true;
  n.observe(s, 0, 'all', vis);
  e.shield = 10; n.observe(s, 0.05, 'all', vis); e.hp = 95; n.observe(s, 0.1, 'all', vis);
  assert.equal(n.live, 0);
  n.observe(s, 0.25, 'all', vis);
  assert.equal(n.live, 1); assert.equal(n.slots.find((x) => x.on).text, '15');
  e.hp = 150; n.observe(s, 0.5, 'all', vis); n.observe(s, 0.8, 'all', vis);
  assert.equal(n.live, 1, 'a heal shows nothing');
  n.step(NUMBERS.life + 0.1); assert.equal(n.live, 0);
  n.observe(s, 1, 'off', vis); assert.equal(n.watch.size, 0);
});
test('default mode shows bosses only, and everything in Defence', () => {
  const grunt = { id: 2, hp: 100, shield: 0, team: 1, kind: 'unit', x: 0, z: 0 }, n = new DamageNumbers();
  n.observe({ entities: [grunt] }, 0, 'focus', () => true); grunt.hp = 50; n.observe({ entities: [grunt] }, 0.5, 'focus', () => true);
  assert.equal(n.live + n.pending.length, 0);
  const m = new DamageNumbers(), sd = { defence: {}, entities: [grunt] };
  grunt.hp = 50; m.observe(sd, 0, 'focus', () => true); grunt.hp = 20; m.observe(sd, 0.1, 'focus', () => true); m.observe(sd, 0.5, 'focus', () => true);
  assert.equal(m.live, 1);
});
test('tag labels: REAR, PINNED, PIERCE, one per target per 0.5 s', () => {
  const n = new DamageNumbers();
  assert.ok(n.tag({ target: 4, tx: 0, tz: 0 }, 1, 'REAR'));
  assert.equal(n.tag({ target: 4, tx: 0, tz: 0 }, 1.2, 'PINNED'), null);
  assert.equal(n.slots.find((s) => s.on).kind, 3);
});
test('the setting is saved with its default, and its strings are in vi.json', () => {
  assert.equal(defaults().damageNumbers, 'focus');
  assert.equal(normalize({ version: 1, damageNumbers: 'all' }).damageNumbers, 'all');
  assert.equal(normalize({ version: 1, damageNumbers: 'x' }).damageNumbers, 'focus');
  for (const k of ['Damage numbers', 'Bosses & Defence', 'All', 'REAR', 'PINNED', 'PIERCE']) assert.ok(vi[k], k);
});
test('new weapon voices exist and are picked by unit', () => {
  assert.equal(weaponVoice('ranger', 'gunner'), 'mg'); assert.equal(weaponVoice('ranger', 'stalker'), 'laser'); assert.equal(weaponVoice('ranger', 'hawk'), 'pod');
  for (const n of ['shot:mg', 'shot:laser', 'shot:pod', 'shot:flame', 'impact:crit']) assert.ok(BANK[n], n);
});
