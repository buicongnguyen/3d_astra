// AAA round 3, R3-W "Wings and rockets": the air cap by Command core level, the readable Anti-tank rocket
// (one instanced draw, an arced cosmetic flight, a shaped impact) and the flyers' air life (motion and lights).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';
import { AIR } from '../src/factions.js';
import { HIT } from '../src/audio-logic.js';
import { weaponStyle } from '../src/visual-style.js';
import { translate, setLanguage } from '../src/i18n.js';

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const { Effects } = await import('../src/fx.js');
const { rocketGeometry, RocketBodies } = await import('../src/fx-kinds/rocket-body.js');
const { LOOKS } = await import('../src/fx-kinds/index.js');
const { airMotion } = await import('../src/air-motion.js');
const { AIR_PARTS, AirLifeView } = await import('../src/air-life-view.js');

const quiet = (options = {}) => {
  const s = new Simulation({ ai: false, ...options });
  for (const e of s.entities) if (e.kind === 'unit') { e.x = e.team === 0 ? -40 : 40; e.z = e.team === 0 ? 40 : -40; }
  return s;
};
const core = (s, team) => s.entities.find((e) => e.team === team && e.type === 'hq');

test('air cap: the player fields 4, 6 or 8 flyers by Command core level; computer teams keep 4 outside the Field plan', () => {
  assert.equal(AIR.cap, 4, 'the base cap is kept');
  assert.deepEqual(AIR.cap_by_level, [4, 6, 8]);
  assert.equal(AIR.ai_cap, 2);
  const s = quiet();
  for (const [level, cap] of [[1, 4], [2, 6], [3, 8]]) {
    core(s, 0).level = level; core(s, 1).level = level;
    assert.equal(s.airCap(0), cap, `player at level ${level}`);
    assert.equal(s.airCap(1), AIR.cap, `Classic computer team at level ${level}`);
    assert.equal(s.aiAirCap(1), AIR.ai_cap);
  }
  // The computer playing team 0 (benches, goldens) keeps the flat cap too.
  const bot = quiet({ ai: true, aiPlayer: true });
  core(bot, 0).level = 3;
  assert.equal(bot.airCap(0), AIR.cap);
});

test('air cap: the Field plan scales the computer like the player (and its armed-flyer limit 2 / 3 / 4); never in a mission', () => {
  const s = quiet({ rules: { aiPlan: 'field' } });
  for (const [level, cap, armed] of [[1, 4, 2], [2, 6, 3], [3, 8, 4]]) {
    core(s, 1).level = level;
    assert.equal(s.airCap(1), cap);
    assert.equal(s.aiAirCap(1), armed);
  }
  const story = new Simulation({ ai: false, mission: { id: 'x', rules: {}, objectives: [], setup: [], win: [], triggers: [] } });
  const hq = core(story, 1);
  if (hq) { hq.level = 3; assert.equal(story.airCap(1), AIR.cap); }
  assert.equal(story.aiAirCap(1), AIR.ai_cap);
});

test('air strings: the limit message, the tile line and the field guide sentence have Vietnamese', () => {
  setLanguage('vi');
  try {
    for (const text of ['Air limit reached: 6 flyers at once.', 'Air limit: 3 of 6 flyers; 8 with a level 3 Command core', 'Air limit: 8 of 8 flyers',
      'Each side fields at most 4 flyers at a level 1 Command core, 6 at level 2 and 8 at level 3, counting those in production.'])
      assert.notEqual(translate(text, 'vi'), text, text);
  } finally { setLanguage('en'); }
  const guide = readFileSync(new URL('../src/field-guide.js', import.meta.url), 'utf8');
  assert.match(guide, /AIR\.cap_by_level/);
});

test('rocket body: a finned body with a self-lit flame in at most 28 triangles, every rocket in one instanced mesh', () => {
  const g = rocketGeometry(), tris = g.attributes.position.count / 3;
  assert.ok(tris >= 16 && tris <= 28, `${tris} triangles`);
  assert.ok([...g.attributes.hot.array].some((h) => h === 1), 'a hot flame');
  assert.ok([...g.attributes.tint.array].some((t) => t === 1), 'a faction band');
  const r = new RocketBodies(4);
  r.begin(0, 1); r.end();
  assert.equal(r.mesh.visible, false, 'hidden while no rocket flies');
  r.begin(0, 1);
  for (let i = 0; i < 6; i++) r.add(i, 1, 0, 1, 0, 0, 0, 1, [1, 0.5, 0.2]);
  r.end();
  assert.equal(r.mesh.count, 4, 'capped at capacity');
  assert.equal(r.mesh.visible, true);
  assert.equal(r.mesh.castShadow, false, 'no shadow-pass draw');
});

const fxWith = () => new Effects({ lowPower: false, scene: { add() {} }, terrain: { id: 'riverlands' }, activity: { combat: { motion: true } }, motionLevel: 2, unitsPerPixel: 0.05 });
test('Anti-tank rocket: a slower readable flight (sound in step), an arc, a ribbon from the pools and an impact shaped by the target', () => {
  const style = weaponStyle({ unit: 'antitank', weapon: 'antitank' });
  assert.equal(style.look, 'rocket');
  assert.ok(style.life >= 0.4 && style.life <= 0.5, `${style.life} s`);
  assert.equal(HIT.rocket.delay, style.life);
  assert.equal(typeof LOOKS.rocket.spawn, 'function');
  const tank = { id: 9, hp: 100, mechanical: true }, man = { id: 10, hp: 50 };
  for (const [target, impact] of [[tank, 'armour'], [man, 'soft']]) {
    const fx = fxWith(), sim = { entities: [], isVisible: () => true, get: (id) => (id === target.id ? target : null) };
    fx.frameSim = sim;
    const aim = { from: { x: 0, y: 1.8, z: 0 }, to: { x: 10, y: 1, z: 0 }, land: { x: 10, y: 1, z: 0 }, ux: 1, uy: 0, uz: 0, len: 10, sx: 0, sz: 1, nx: 1, nz: 0, travel: style.life, anchor: null, power: 0.75, style, color: [1, 0.8, 0.5, 1] };
    LOOKS.rocket.spawn(fx, { weapon: 'antitank', target: target.id }, fx.rng, aim);
    const p = fx.projectiles[0];
    assert.equal(p.impact, impact);
    assert.ok(p.arc > 0 && p.body === 1);
    const glowBefore = fx.glow.items.length;
    let maxY = 0;
    for (let t = 0; t < style.life - 0.02; t += 1 / 60) { fx.update(sim, 1 / 60); if (fx.projectiles[0]) maxY = Math.max(maxY, fx.rockets.mesh.instanceMatrix.array[13]); }
    assert.equal(fx.rockets.drawn, 1, 'one body in flight');
    assert.ok(maxY > 1.8, 'the flight arcs above the straight line');
    assert.ok(fx.smoke.items.length >= 10, 'a ribbon trail');
    const sparksBefore = fx.glow.items.length;
    for (let i = 0; i < 6; i++) fx.update(sim, 1 / 60);
    assert.equal(fx.projectiles.length, 0, 'landed');
    assert.equal(fx.rockets.drawn, 0);
    assert.equal(fx.rockets.mesh.visible, false);
    if (impact === 'armour') assert.ok(fx.debris.length >= 3, 'metal chips off the armour');
    assert.ok(fx.glow.items.length > Math.min(glowBefore, sparksBefore), 'a flash at the hit');
    assert.ok(!fx.glow.items.some((g) => g.owner), 'the flame halo is released');
  }
  // A killing shot flies at the old speed, so it lands on the wreck while it is still there.
  const fx = fxWith(); fx.frameSim = { get: () => null };
  LOOKS.rocket.spawn(fx, { weapon: 'antitank', target: 3 }, fx.rng, { from: { x: 0, y: 1.8, z: 0 }, to: { x: 10, y: 1, z: 0 }, land: { x: 10, y: 1, z: 0 }, nx: 1, nz: 0, travel: style.life, power: 0.75, color: [1, 1, 1, 1] });
  assert.ok(fx.projectiles[0].travel < style.life);
});

test('flyer motion: banks into a turn, lifts the nose on a climb, settles level with motion off; the balloon only sways', () => {
  const a = { clock: 0 }, dt = 1 / 60;
  airMotion(a, 'hawk', 0, 4, dt, true);
  for (let i = 1; i <= 30; i++) airMotion(a, 'hawk', i * 0.02, 4 + i * 0.03, dt, true);
  assert.ok(a.bank < -0.1, `left turn rolls left wing down (${a.bank})`);
  assert.ok(a.bank >= -0.38 - 1e-9, 'capped');
  assert.ok(a.pitch < -0.05, `nose up on the climb (${a.pitch})`);
  for (let i = 0; i < 120; i++) airMotion(a, 'hawk', 0.6, 4.9, dt, false);
  assert.ok(Math.abs(a.bank) < 1e-3 && Math.abs(a.pitch) < 1e-3, 'level when still');
  const b = { clock: 1 };
  for (let i = 0; i < 60; i++) airMotion(b, 'balloon', i * 0.05, 3, dt, true);
  assert.ok(Math.abs(b.bank) <= 0.05 + 1e-9, 'a balloon never banks');
  // Every flyer has its air-life parts (rotor discs, nav lights, engine glow).
  for (const [type, d] of Object.entries(D)) if (d.flying) assert.ok(AIR_PARTS[type]?.red && AIR_PARTS[type].engines.length, type);
});

test('air life: one draw for discs and lights, hidden without flyers, lights stronger at night', () => {
  const added = [];
  const view = { scene: { add: (m) => added.push(m) }, objects: new Map(), motionLevel: 2, settings: {}, reducedMotion: { matches: false }, fx: null, mood: { state: null } };
  const life = new AirLifeView(view);
  assert.equal(added.length, 1, 'one mesh');
  life.update({ get: () => null }, 1 / 60);
  assert.equal(life.mesh.visible, false);
  assert.equal(life.glowScale, 1);
  view.mood.state = { name: 'night', k: 1 };
  assert.ok(life.glowScale > 1.5);
});
