// AAA round 3, R3-X "slow and beautiful, but cheap": every weapon maps to one effect class; the heavy classes fly
// pooled rounds drawn by one instanced mesh; every round lands exactly when the hit does (its flight time is the
// weapon's visual-style `life`, the hit flash's wait); the Barrage shell falls in step with the simulation's strike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import balance from '../src/balance.json' with { type: 'json' };
import { weaponStyle } from '../src/visual-style.js';
import { WEAPON_CLASSES, weaponClass, CLASS_LOOK } from '../src/fx-kinds/weapon-class.js';

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const { Effects } = await import('../src/fx.js');
const { ordnanceGeometry, OrdnanceBodies } = await import('../src/fx-kinds/ordnance-body.js');
const { launch, place } = await import('../src/fx-kinds/ordnance.js');
const { LOOKS } = await import('../src/fx-kinds/index.js');
const { BEAM_SEGMENTS } = await import('../src/fx-kinds/beam.js');

const shot = (unit, extra = {}) => ({ type: 'shot', unit, weapon: balance.definitions[unit]?.shot || unit, ...extra });
const classOf = (unit, extra) => weaponClass(shot(unit, extra));

test('weapon -> effect class: every armed unit has a class, and each family reads as its own', () => {
  for (const [type, d] of Object.entries(balance.definitions)) if (d.damage > 0) assert.ok(WEAPON_CLASSES.includes(classOf(type)), type);
  const expect = {
    ranger: 'tracer', gunner: 'tracer', vanguard: 'tracer', scrapper: 'tracer', rider: 'tracer',
    tank: 'shell', tower: 'shell', walker: 'shell', rampart: 'shell', breaker: 'lob',
    stalker: 'beam', watcher: 'beam', drone: 'tracer', scorcher: 'flamer', antitank: 'missile',
    hawk: 'strafe', glider: 'bomb', balloon: 'bomb',
  };
  for (const [unit, cls] of Object.entries(expect)) if (balance.definitions[unit]) assert.equal(classOf(unit), cls, unit);
  assert.equal(classOf('tower', { tAir: 3.6 }), 'flak', 'a ground cannon at a flyer fires flak');
  assert.equal(classOf('hawk', { tAir: 3.6 }), 'missile', 'the Hawk fires missiles at flyers');
  assert.equal(classOf('ranger', { tAir: 3.6 }), 'tracer');
  assert.equal(weaponClass({ type: 'support', weapon: 'medic' }), 'heal');
  const reached = new Set([...Object.keys(expect).map((u) => classOf(u)), 'flak', 'missile', 'heal']);
  assert.equal(reached.size, WEAPON_CLASSES.length, [...reached].join());
});

test('ordnance body: a finned shell of at most 60 triangles, one instanced mesh, no shadow, hidden when nothing flies', () => {
  const tris = ordnanceGeometry().attributes.position.count / 3;
  assert.ok(tris >= 30 && tris <= 60, `${tris} triangles`);
  const o = new OrdnanceBodies(3);
  o.begin(1); o.end();
  assert.equal(o.mesh.visible, false);
  o.begin(1); for (let i = 0; i < 5; i++) o.add(i, 1, 0, 1, 0, 0, 0, 1, [2, 1, 0.5]); o.end();
  assert.equal(o.mesh.count, 3, 'capped');
  assert.equal(o.mesh.castShadow, false);
  // A still frame (dt 0) with the same count re-sends nothing.
  const version = o.mesh.instanceMatrix.version;
  o.begin(1); for (let i = 0; i < 3; i++) o.add(i, 1, 0, 1, 0, 0, 0, 1, [2, 1, 0.5]); o.end(false);
  assert.equal(o.mesh.instanceMatrix.version, version);
});

const fxWith = (lowPower = false) => new Effects({ lowPower, scene: { add() {} }, terrain: { id: 'riverlands' }, activity: { combat: { motion: true } }, motionLevel: 2, unitsPerPixel: 0.05 });
const aim = (travel, extra = {}) => ({ from: { x: 0, y: 1.7, z: 0 }, to: { x: 12, y: 1, z: 2 }, land: { x: 12, y: 1, z: 2 }, ux: 0.98, uy: -0.05, uz: 0.16, len: 12.2, sx: -0.16, sz: 0.98, nx: 0.99, nz: 0.16, travel, anchor: null, power: 0.8, style: {}, color: [1, 0.8, 0.4, 1], ...extra });
const alive = { id: 7, hp: 50, mechanical: true };
const simWith = (target = alive, extra = {}) => ({ entities: [], time: 0, isVisible: () => true, get: (id) => (id === target?.id ? target : null), ...extra });

test('every heavy round lands on the frame its flight time ends (the hit flash), once', () => {
  const style = weaponStyle({ unit: 'tank', weapon: 'tank' });
  for (const cls of ['shell', 'lob', 'flak', 'missile', 'bomb']) {
    const fx = fxWith(), sim = simWith();
    fx.frameSim = sim;
    let hits = 0, landedAt = -1, t = 0;
    const count = () => { hits++; landedAt = t; };
    fx.hit = count;
    const air = cls === 'flak' || cls === 'missile';
    launch(fx, cls, aim(style.life, air ? { to: { x: 12, y: 4.5, z: 2 } } : {}), { target: 7, tAir: air ? 3.6 : 0 });
    const before = fx.glow.items.length + fx.smoke.items.length;
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) { t += dt; fx.update(sim, dt); }
    if (air) assert.ok(fx.glow.items.length + fx.smoke.items.length > before, `${cls}: an air burst`);
    else { assert.equal(hits, 1, cls); assert.ok(landedAt >= style.life - 1e-9 && landedAt < style.life + dt + 1e-9, `${cls} landed at ${landedAt}`); }
    assert.equal(fx.rounds.length, 0, cls);
    assert.equal(fx.ordnance.mesh.visible, false, `${cls}: the mesh hides when nothing flies`);
    assert.ok(!fx.glow.items.some((g) => g.owner), `${cls}: the halo is released`);
  }
});

test('pooled rounds: records are reused, the ordnance mesh is one draw for every round, a killing shot lands sooner', () => {
  const fx = fxWith(), sim = simWith();
  fx.frameSim = sim;
  for (let i = 0; i < 8; i++) launch(fx, 'shell', aim(0.32), { target: 7 });
  fx.update(sim, 1 / 60);
  assert.equal(fx.ordnance.drawn, 8, 'eight shells, one instanced mesh');
  const first = new Set(fx.rounds);
  for (let i = 0; i < 40; i++) fx.update(sim, 1 / 60);
  assert.equal(fx.rounds.length, 0);
  assert.equal(fx.roundFree.length, 8);
  for (let i = 0; i < 8; i++) launch(fx, 'shell', aim(0.32), { target: 7 });
  assert.ok(fx.rounds.every((r) => first.has(r)), 'the second volley reuses the first one\'s records');
  // A shot whose target already died flies at most CLASS_LOOK.quick.
  const r = launch(fx, 'shell', aim(0.32), { target: 99 });
  assert.equal(r.travel, CLASS_LOOK.quick);
  // Shells arc a little over the straight line; artillery lobs much higher.
  const shell = launch(fx, 'shell', aim(0.32), { target: 7 }), lob = launch(fx, 'lob', aim(0.28), { target: 7 }), p = {}, q = {};
  place(shell, 0.5, p); place(lob, 0.5, q);
  assert.ok(p.y > 1.35 && p.y < 2.2, `shell mid-flight ${p.y}`);
  assert.ok(q.y > p.y + 1, `artillery lob mid-flight ${q.y}`);
});

test('Eco keeps the shapes but shortens the trails', () => {
  const trail = (lowPower) => {
    const fx = fxWith(lowPower), sim = simWith();
    fx.frameSim = sim;
    launch(fx, 'lob', aim(0.6), { target: 7 });
    for (let i = 0; i < 30; i++) fx.update(sim, 1 / 60);
    return fx.smoke.items.length;
  };
  const high = trail(false), eco = trail(true);
  assert.ok(high >= 8, `${high} trail puffs`);
  assert.ok(eco < high, `${eco} < ${high}`);
});

test('beams and rails: a charge glow for the flight time, then the line lit at the landing, fading from the muzzle forward', () => {
  for (const id of ['beam', 'rail']) {
    const fx = fxWith();
    LOOKS[id].spawn(fx, { weapon: 'stalker' }, fx.rng, aim(0.42, { style: { beamLife: 0.45, beamWidth: 0.12 } }));
    const line = fx.glow.items.filter((p) => p.mode === 1 && p.age < 0);
    assert.ok(line.length >= BEAM_SEGMENTS, id);
    assert.ok(line.every((p) => Math.abs(p.age + 0.42) < 1e-9), `${id}: the line waits for the charge`);
    const muzzle = line.reduce((a, p) => (Math.hypot(p.x, p.z) < Math.hypot(a.x, a.z) ? p : a)), tip = line.reduce((a, p) => (Math.hypot(p.x, p.z) > Math.hypot(a.x, a.z) ? p : a));
    assert.ok(muzzle.life < tip.life, `${id}: the muzzle end fades first`);
    assert.ok(fx.glow.items.some((p) => p.age === 0 && Math.abs(p.life - 0.42) < 1e-9), `${id}: a charge glow lasting the flight`);
  }
});

test('Hawk: missiles corkscrew at a flyer; at the ground a strafing burst walks onto the target, the last round at the hit', () => {
  const fx = fxWith(), sim = simWith();
  fx.frameSim = sim;
  LOOKS.pods.spawn(fx, { weapon: 'ranger', target: 7, tAir: 3.6 }, fx.rng, aim(0.3, { to: { x: 12, y: 4.6, z: 2 } }));
  assert.equal(fx.rounds.length, 2);
  assert.ok(fx.rounds.every((r) => r.cls === 'missile' && r.weave > 0));
  const p = {};
  place(fx.rounds[0], 0.3, p);
  assert.ok(Math.abs(p.y - (1.7 + (4.6 - 1.7) * 0.3)) > 0.05 || Math.abs(p.x - 3.6) > 0.05, 'off the straight line');
  const g = fxWith();
  LOOKS.pods.spawn(g, { weapon: 'ranger', target: 7 }, g.rng, aim(0.3));
  assert.equal(g.rounds.length, 0, 'no rockets when strafing');
  const spurts = g.smoke.items.filter((q) => q.age < 0 && q.cell === 1);
  assert.ok(spurts.length >= 3, `${spurts.length} dust spurts`);
  const order = spurts.map((q) => [-q.age, Math.hypot(q.x - 12, q.z - 2)]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < order.length; i++) assert.ok(order[i][1] <= order[i - 1][1] + 0.6, 'each strike lands closer to the target');
  assert.ok(Math.abs(order[order.length - 1][0] - 0.3) < 1e-9, 'the last strike lands at the hit');
});

test('bombs fall and grow over a shadow dot; the Barrage shell falls in step with the strike and a red ring warns first', () => {
  const fx = fxWith(), sim = simWith();
  fx.frameSim = sim;
  LOOKS.bomb.spawn(fx, { weapon: 'ranger', target: 7 }, fx.rng, aim(0.45, { from: { x: 12, y: 4.2, z: 2 } }));
  const bomb = fx.rounds[0], early = {}, late = {};
  assert.equal(bomb.cls, 'bomb');
  assert.ok(fx.decals.items.some((d) => d.mode === 2 && d.c1[3] > d.c0[3]), 'a shadow dot that darkens');
  place(bomb, 0.25, early); place(bomb, 0.75, late);
  assert.ok((4.2 - late.y) / (4.2 - early.y) > 3, 'accelerating fall');
  // The Barrage: drawn from sim.strikes, so it reaches the ground on the strike's own tick.
  const strike = { at: 1.5, x: 5, z: 5, radius: 4, team: 0, by: null };
  const s = simWith(null, { strikes: [strike] }), heights = [];
  const g = fxWith();
  let warned = false;
  for (let t = 0; t <= 1.49; t += 0.05) {
    s.time = t; g.update(s, 0.05);
    if (t === 0) warned = g.decals.items.filter((p) => p.mode === 2 && p.c0[0] > 0.8 && p.c0[1] < 0.3).length >= 2;
    if (g.ordnance.drawn) heights.push(g.ordnance.mesh.instanceMatrix.array[13]);
  }
  assert.ok(warned, 'red warning rings as soon as the strike is marked');
  assert.ok(heights.length >= 10 && heights.length <= Math.ceil(CLASS_LOOK.barrage.fall / 0.05) + 1, `${heights.length} frames of fall`);
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i] < heights[i - 1], 'falling');
  assert.ok(heights[0] > 10 && heights[heights.length - 1] < 1.5, `from ${heights[0]} to ${heights[heights.length - 1]}`);
});

test('a flyer shot down bursts in the air (no scorch under it), then trails smoke and crashes', () => {
  const object = { position: { x: 3, y: 0, z: 3 }, userData: { air: { top: 1 }, model: { position: { y: 3.6 } } } };
  const fx = fxWith();
  fx.view.objects = new Map([[42, object]]);
  const sim = simWith();
  fx.frameSim = sim;
  fx.death({ type: 'death', x: 3, z: 3, team: 1, heavy: true, seed: 42 });
  assert.equal(fx.decals.items.length, 0, 'no ground scorch');
  assert.ok(fx.glow.items.some((p) => p.y > 3), 'the burst is at altitude');
  const wreck = { kind: 'air', object, x: 3, z: 3, team: 1, age: 0 };
  fx.view.dying = [wreck];
  for (let i = 0; i < 30; i++) { wreck.age += 1 / 60; object.userData.model.position.y = Math.max(0, 3.6 * (1 - wreck.age / 0.9)); fx.update(sim, 1 / 60); }
  assert.ok(fx.smoke.items.length >= 8, 'a smoke trail behind the falling wreck');
  for (let i = 0; i < 40; i++) { wreck.age += 1 / 60; fx.update(sim, 1 / 60); }
  assert.equal(wreck.crashed, true);
  assert.ok(fx.decals.items.length >= 1, 'the crash leaves a scorch');
});

test('a normal ground volley queues one pooled ring at arrival, including at phone zoom', () => {
  for (const [unit, altitude, motion, expected] of [
    ['ranger', 0, true, 1], ['vanguard', 0, true, 1],
    ['ranger', 4, true, 0], ['ranger', 0, false, 0], ['medic', 0, true, 0],
  ]) {
    const fx = fxWith(true), sim = simWith();
    fx.view.activity.combat.motion = motion;
    fx.view.unitsPerPixel = 0.2;
    const e = shot(unit, { type: unit === 'medic' ? 'support' : 'shot', x: 1, z: 3, tx: 8, tz: 5, team: 0, tAir: altitude });
    fx.shot(e, sim);
    const rings = fx.decals.items.filter(p => p.mode === 2 && p.cell === 2);
    assert.equal(rings.length, expected, unit);
    if (expected) {
      assert.equal(rings[0].age, -weaponStyle(e).life);
      assert.ok(rings[0].s1 >= 32 * fx.view.unitsPerPixel);
    }
  }
});
