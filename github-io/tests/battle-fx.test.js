import test from 'node:test';
import assert from 'node:assert/strict';
import { damageState, isBurning, damagedEntities, burningEntities, SMOKING, BURNING, hitPower, scorchPlan, SCORCH,
  startFlash, stepFlash, HIT_FLASH } from '../src/combat-feedback.js';

// Headless stub: fx.js builds a canvas atlas at construction time.
const ctx = {createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData() {}};
globalThis.document = {createElement: () => ({getContext: () => ctx, width:0, height:0})};

const building = (share, extra = {}) => ({kind:'building', complete:true, maxHp:1000, hp:1000*share, ...extra});

test('damage states: buildings smoke below half health and burn below a quarter; machines burn below 35%', () => {
  assert.equal(damageState(building(1)), 0);
  assert.equal(damageState(building(.5)), 0, 'exactly half is not yet smoking');
  assert.equal(damageState(building(.49)), SMOKING);
  assert.equal(damageState(building(.25)), SMOKING);
  assert.equal(damageState(building(.24)), BURNING);
  assert.equal(damageState(building(0)), 0, 'destroyed buildings stop emitting');
  assert.equal(damageState(building(.1, {complete:false})), 0, 'construction sites never smoke');
  const tank = {kind:'unit', mechanical:true, complete:true, maxHp:400};
  assert.equal(damageState({...tank, hp:200}), 0, 'machines do not smoke at half health');
  assert.equal(damageState({...tank, hp:130}), BURNING);
  assert.equal(damageState({kind:'unit', complete:true, maxHp:100, hp:5}), 0, 'infantry never burn');
  assert.equal(damageState({kind:'wall', complete:true, maxHp:100, hp:5}), 0);
  assert.equal(isBurning(building(.2)), true);
  assert.equal(isBurning(building(.4)), false);
});

test('damaged entities: fog-aware, fires and smoke capped separately, refilled in place', () => {
  const entities = [];
  for (let i = 0; i < 20; i++) entities.push(building(.2, {id:i}));
  for (let i = 0; i < 20; i++) entities.push(building(.4, {id:100+i}));
  entities.push(building(.2, {id:999, hidden:true}));
  const sim = {entities, isVisible: e => !e.hidden};
  const out = [];
  const high = damagedEntities(sim, false, out);
  assert.equal(high, out, 'the caller array is reused');
  assert.equal(high.filter(e => damageState(e) === BURNING).length, 16);
  assert.equal(high.filter(e => damageState(e) === SMOKING).length, 12);
  assert.ok(!high.some(e => e.hidden), 'hidden damage never shows');
  const eco = damagedEntities(sim, true, out);
  assert.equal(eco.filter(e => damageState(e) === BURNING).length, 8);
  assert.equal(eco.filter(e => damageState(e) === SMOKING).length, 6);
  assert.equal(burningEntities(sim, true).length, 8, 'the HUD fire list keeps its cap');
  assert.ok(burningEntities(sim, false).every(e => damageState(e) === BURNING));
});

test('hit power: heavy rounds hit hard, small arms stay light', () => {
  assert.equal(hitPower('tank', 'cannon'), 1);
  assert.ok(hitPower('breaker', 'cannon') > hitPower('tank', 'cannon'), 'artillery hits hardest');
  assert.ok(hitPower('antitank', 'rocket') > 0 && hitPower('antitank', 'rocket') < 1);
  assert.equal(hitPower('ranger', 'rifle'), 0);
  assert.equal(hitPower('scorcher', 'rifle'), 0);
  assert.equal(hitPower('newcannon', 'cannon'), 1, 'unknown weapons fall back on their kind');
  assert.equal(hitPower('toString', 'rifle'), 0, 'prototype names are not weapons');
});

test('scorch plan: merges nearby hits, evicts the oldest hit scorch at the cap, ignores other decals', () => {
  const mark = (x, z, age, extra = {}) => ({x, z, age, life:SCORCH.life, hitScorch:true, ...extra});
  assert.deepEqual(scorchPlan([], 0, 0, 3), {});
  assert.deepEqual(scorchPlan([mark(5, 5, 1), mark(0.4, 0.3, 2)], 0, 0, 3), {merge:1});
  assert.deepEqual(scorchPlan([mark(0.4, 0.3, SCORCH.life)], 0, 0, 3), {}, 'expired scorches do not merge');
  const full = [mark(10, 0, 1), mark(20, 0, 6), mark(30, 0, 3)];
  assert.deepEqual(scorchPlan(full, 0, 0, 3), {evict:1});
  assert.deepEqual(scorchPlan(full, 0, 0, 4), {});
  const deaths = [mark(0.2, 0, 1, {hitScorch:false}), mark(40, 0, 1)];
  assert.deepEqual(scorchPlan(deaths, 0, 0, 1), {evict:1}, 'destruction scorches neither merge nor count');
  assert.ok(SCORCH.life >= 10 && SCORCH.life <= 20, 'hit scorches fade over 10-20 s');
  assert.ok(SCORCH.ecoCap < SCORCH.cap);
});

test('hit flash: waits for the round, lights ~0.1 s, fades to white, holds while paused', () => {
  const u = {}, out = [1, 1, 1];
  assert.equal(stepFlash(u, .016, out), false, 'nothing without a hit');
  startFlash(u, .3);
  assert.equal(stepFlash(u, .1, out), false, 'waits for the shell in flight');
  assert.equal(stepFlash(u, .1, out), false);
  assert.equal(stepFlash(u, .11, out), true, 'lights when the round lands');
  assert.deepEqual(out, HIT_FLASH.warm, 'starts at the full warm-white tint');
  assert.ok(out[0] > out[2], 'warm, not cold');
  assert.equal(stepFlash(u, 0, out), true, 'paused frames hold the flash');
  let frames = 0, last = out[0];
  while (stepFlash(u, 1 / 60, out)) { frames++; assert.ok(out[0] <= last); last = out[0]; assert.ok(frames < 20); }
  assert.ok(frames >= 5 && frames <= 7, `about 0.1 s at 60 fps (${frames} frames)`);
  startFlash(u, 0, true); stepFlash(u, .016, out);
  assert.deepEqual(out, HIT_FLASH.shield, 'shields flash cyan');
  assert.ok(out[2] > out[0]);
  startFlash(u, 0); stepFlash(u, .016, out, HIT_FLASH.building);
  assert.ok(out[0] > 1 && out[0] < HIT_FLASH.warm[0], 'buildings flash softer');
});

test('heavy hits throw flash, fireball, debris and one capped scorch; small arms stay light', async () => {
  const { Effects } = await import('../src/fx.js');
  const view = {lowPower:false, scene:{add() {}}, terrain:{id:'riverlands'}, activity:{combat:{motion:true}}};
  const fx = new Effects(view), sim = {entities:[], isVisible:() => true};
  fx.hit({x:0, y:.95, z:0}, 0, null);
  assert.equal(fx.debris.length, 0, 'rifle hits throw no debris');
  assert.equal(fx.decals.items.length, 0, 'rifle hits leave no scorch');
  const light = fx.glow.items.length + fx.smoke.items.length;
  assert.ok(light <= 8, `rifle hits stay light (${light})`);
  fx.clear();
  fx.hit({x:0, y:.95, z:0}, 1, null);
  assert.ok(fx.debris.length >= 3, 'tank shells throw debris');
  assert.equal(fx.decals.items.filter(p => p.hitScorch).length, 1);
  assert.ok(fx.glow.items.some(p => p.s0 >= 2.5), 'a big flash');
  assert.ok(fx.smoke.items.length >= 8, 'a fireball and smoke');
  fx.hit({x:.3, y:.95, z:.2}, 1, null);
  assert.equal(fx.decals.items.filter(p => p.hitScorch).length, 1, 'a hit on a fresh scorch merges');
  for (let i = 0; i < 60; i++) fx.hit({x:i * 3, y:.95, z:0}, 1.25, null);
  assert.equal(fx.decals.items.filter(p => p.hitScorch && p.age < p.life).length, SCORCH.cap, 'hit scorches are capped');
  fx.update(sim, .1);
  assert.ok(fx.debris.length <= fx.debrisCapacity);
  // Expired records go back to the pools and are reused.
  fx.update(sim, 30);
  assert.equal(fx.active, 0);
  const pooled = fx.glow.free.length;
  assert.ok(pooled > 0);
  fx.hit({x:0, y:.95, z:0}, 1, null);
  assert.ok(fx.glow.free.length < pooled, 'new particles reuse pooled records');
  view.lowPower = true; fx.clear();
  for (let i = 0; i < 60; i++) fx.hit({x:i * 3, y:.95, z:0}, 1, null);
  assert.equal(fx.decals.items.filter(p => p.hitScorch && p.age < p.life).length, SCORCH.ecoCap, 'fewer scorches in Eco');
  assert.ok(fx.debris.length <= 32);
});

test('damaged buildings emit from pools, scaled by the governor, nothing while paused', async () => {
  const { Effects } = await import('../src/fx.js');
  const view = {lowPower:false, scene:{add() {}}, terrain:{id:'riverlands'}, activity:{combat:{motion:true}}, motionLevel:2};
  const fx = new Effects(view);
  const smoking = building(.4, {id:1, x:0, z:0, radius:3, type:'barracks'}), burning = building(.1, {id:2, x:20, z:0, radius:3, type:'hq'});
  const sim = {entities:[smoking, burning], isVisible:() => true};
  fx.update(sim, 0);
  assert.equal(fx.active, 0, 'paused: no emission');
  for (let i = 0; i < 60; i++) fx.update(sim, 1 / 60);
  const near = (e) => fx.smoke.items.filter(p => p.anchor === e).length;
  assert.ok(near(smoking) >= 1, 'a smoking building smokes');
  assert.ok(near(burning) > near(smoking) * 3, 'a burning building smokes and burns far more');
  assert.ok(fx.glow.items.some(p => p.anchor === burning), 'flames glow');
  assert.ok(!fx.glow.items.some(p => p.anchor === smoking), 'smoke alone has no fire');
  const full = fx.smoke.items.length;
  fx.clear(); view.motionLevel = 0;
  for (let i = 0; i < 60; i++) fx.update(sim, 1 / 60);
  assert.ok(fx.smoke.items.length < full * 0.75, `the governor thins emission (${fx.smoke.items.length} < ${full})`);
  fx.clear();
  smoking.hp = smoking.maxHp; burning.hp = burning.maxHp;
  for (let i = 0; i < 30; i++) fx.update(sim, 1 / 60);
  assert.equal(fx.active, 0, 'repaired buildings stop smoking');
});
