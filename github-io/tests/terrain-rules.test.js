// Terrain rules you can see (0.16, item 16.2): the ford slows units and stops abilities, Barrage
// and Burn line need sight of a deep plateau top, and the "hidden from below" mark is worked out
// from the ground and what the player already sees (never from what an unseen enemy sees).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { DEFINITIONS as D } from '../src/data.js';
import { TERRAIN } from '../src/terrain.js';
import { FORD_TEXT, FORD_SHORT, HIDDEN_TEXT, HIDDEN_HINT, SIGHT_TEXT, heldPlateaus, hiddenFromBelow, onHighGround, rampTicks, selectionGround } from '../src/terrain-labels.js';
import { abilityGroups, abilityStatus, aimState } from '../src/tactics-ui.js';
import { translate } from '../src/i18n.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;
// A quiet field: the starting units are removed so nothing walks into the test.
function field(map, options = {}) {
  const s = new Simulation({ ai: false, map, ...options });
  for (const e of s.entities) if (e.kind === 'unit') e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.updateVision();
  return s;
}

test('the ford slows everyone to ford_speed; the banks, bridges and dry maps do not', () => {
  assert.equal(TERRAIN.ford_speed, 0.6);
  const s = field('riverlands');
  const wading = s.spawn('ranger', 0, 0, 0), bank = s.spawn('ranger', 0, 0, 7), bridge = s.spawn('ranger', 0, -22, 0), edge = s.spawn('tank', 1, 4.5, -2.5);
  assert.equal(s.inFord(wading), true);
  assert.ok(near(s.moveSpeed(wading), D.ranger.speed * TERRAIN.ford_speed));
  assert.ok(near(s.moveSpeed(edge), D.tank.speed * TERRAIN.ford_speed), 'the whole ford, both teams');
  assert.equal(s.moveSpeed(bank), D.ranger.speed);
  assert.equal(s.moveSpeed(bridge), D.ranger.speed, 'bridges are not slowed');
  assert.equal(s.inFord({ ...wading, flying: true }), false, 'flyers pass over');
  // Sunward's road bonus and the ford multiply (the ford itself is not road).
  const d = field('riverlands', { factions: { 0: 'sunward' } }), rider = d.spawn('rider', 0, 1, 1);
  assert.ok(near(d.moveSpeed(rider), D.rider.speed * TERRAIN.ford_speed));
  // No river: the middle of the map is just ground.
  const c = field('classic'), plain = c.spawn('ranger', 0, 0, 0);
  assert.equal(c.inFord(plain), false);
  assert.equal(c.moveSpeed(plain), D.ranger.speed);
});

test('a unit crossing the ford takes longer than one crossing a bridge', () => {
  const s = field('riverlands');
  const ford = s.spawn('ranger', 0, 0, 8), bridge = s.spawn('ranger', 0, -22, 8);
  s.command({ team: 0, type: 'order', ids: [ford.id], order: { type: 'move', x: 0, z: -8 } });
  s.command({ team: 0, type: 'order', ids: [bridge.id], order: { type: 'move', x: -22, z: -8 } });
  let fordAt = null, bridgeAt = null;
  for (let i = 0; i < 20 * 20 && (fordAt === null || bridgeAt === null); i++) {
    s.tick(0.05);
    if (fordAt === null && ford.z < -6) fordAt = s.time;
    if (bridgeAt === null && bridge.z < -6) bridgeAt = s.time;
  }
  assert.ok(fordAt && bridgeAt, `both crossed (${fordAt}, ${bridgeAt})`);
  assert.ok(fordAt > bridgeAt + 0.5, `the ford is slower: ${fordAt.toFixed(2)} s against ${bridgeAt.toFixed(2)} s`);
});

test('no abilities in the ford: not ready, not cast, and the tile says why', () => {
  const s = field('riverlands');
  const wading = s.spawn('ranger', 0, 0, 1), dry = s.spawn('ranger', 0, 0, 9);
  assert.equal(s.abilityReady(wading), false);
  assert.equal(s.useAbility(wading), false);
  assert.equal(wading.buff ?? null, null);
  assert.equal(s.abilityReady(dry), true);
  const groups = abilityGroups(s, [wading]);
  assert.equal(groups[0].ready, 0);
  assert.equal(groups[0].ford, 1);
  assert.equal(abilityStatus(groups[0]), FORD_SHORT);
  assert.equal(abilityStatus(abilityGroups(s, [wading, dry])[0]), 'Ready 1/2');
  // Out of the water, the ability works again.
  wading.z = 9;
  assert.equal(s.useAbility(wading), true);
  // The selection card names the ford for a wading unit.
  assert.equal(FORD_TEXT, 'In the ford: -40% speed, no abilities');
  assert.deepEqual(selectionGround(s, [s.spawn('ranger', 0, 1, -1)]), { high: false, ford: true, hidden: false });
  assert.equal(selectionGround(s, [dry]).ford, false);
});

test('Barrage needs sight of a deep plateau top: refused in fog, allowed with a friend up there', () => {
  const s = field('dunes'), p = s.terrain.plateaus[0], centre = { x: p.x, z: p.z };
  const breaker = s.spawn('breaker', 0, p.x, p.z + p.r + 3);
  s.updateVision();
  assert.equal(onHighGround(s.terrain, breaker), false);
  assert.ok(Math.hypot(breaker.x - centre.x, breaker.z - centre.z) <= D.breaker.ability.range, 'in reach');
  assert.equal(s.hiddenTop(centre, 0), true, 'the deep top is out of sight from below');
  assert.equal(s.useAbility(breaker, centre), false, 'refused');
  assert.equal(s.strikes?.length ?? 0, 0);
  const aim = aimState(s, [breaker], centre);
  assert.equal(aim.ok, false);
  assert.equal(aim.sight, true, 'the aim says why');
  // The rim strip is seen from below: shelling it is allowed.
  const rim = { x: p.x, z: p.z + p.r - 1.5 };
  assert.equal(s.hiddenTop(rim, 0), false);
  assert.equal(aimState(s, [breaker], rim).ok, true);
  // A friendly unit on the plateau opens the whole top to the team.
  s.spawn('ranger', 0, p.x + p.r - 2, p.z);
  s.updateVision();
  assert.equal(s.hiddenTop(centre, 0), false);
  assert.equal(aimState(s, [breaker], centre).ok, true);
  assert.equal(s.useAbility(breaker, centre), true);
  assert.equal(s.strikes.length, 1);
});

test('Burn line follows the same sight rule', () => {
  const s = field('dunes', { factions: { 0: 'ashfall' } }), p = s.terrain.plateaus[0];
  const scorcher = s.spawn('scorcher', 0, p.x, p.z + p.r + 2.5);
  // Burn line's 7 m can't reach a deep cell from the cliff foot; a longer reach puts the rule to the test.
  scorcher.ability = { ...scorcher.ability, range: 12 };
  s.updateVision();
  const deep = { x: p.x, z: p.z + 1 };
  assert.equal(s.hiddenTop(deep, 0), true);
  assert.equal(s.useAbility(scorcher, deep), false);
  s.spawn('ranger', 0, p.x - p.r + 2, p.z);
  s.updateVision();
  assert.equal(s.useAbility(scorcher, deep), true);
});

test('flat maps keep the old behaviour: a fogged point in reach can be shelled', () => {
  const s = field('classic'), breaker = s.spawn('breaker', 0, 0, 0), target = { x: 10, z: 0 };
  s.visible[0].fill(0);
  assert.equal(s.hiddenTop(target, 0), false);
  assert.equal(aimState(s, [breaker], target).ok, true);
  assert.equal(s.useAbility(breaker, target), true);
});

test('hidden from below: deep on a plateau, not on the rim, not where a visible enemy stands', () => {
  const s = field('dunes'), p = s.terrain.plateaus[0], q = s.terrain.plateaus[1];
  const deep = s.spawn('ranger', 0, p.x, p.z), rim = s.spawn('ranger', 0, p.x + p.r - 2, p.z), low = s.spawn('ranger', 0, p.x, p.z + p.r + 4);
  s.updateVision();
  assert.equal(onHighGround(s.terrain, rim), true, 'the rim is high ground');
  assert.equal(hiddenFromBelow(s, deep), true);
  assert.equal(hiddenFromBelow(s, rim), false, 'the rim strip is seen from below');
  assert.equal(hiddenFromBelow(s, low), false);
  assert.equal(hiddenFromBelow(field('classic'), { kind: 'unit', hp: 1, x: 0, z: 0 }), false);
  // An enemy on another plateau changes nothing here.
  const far = s.spawn('ranger', 1, q.x, q.z);
  s.updateVision();
  assert.equal(hiddenFromBelow(s, deep), true);
  // A visible enemy on the same plateau: the top is contested, no mark.
  const enemy = s.spawn('ranger', 1, p.x - p.r + 2, p.z);
  s.updateVision();
  assert.equal(s.isVisible(enemy, 0), true);
  assert.deepEqual([...heldPlateaus(s, 0)].sort(), s.isVisible(far, 0) ? [0, 1] : [0]);
  assert.equal(hiddenFromBelow(s, deep), false);
  // The same enemy unseen (cloaked): the mark comes back, so it never tells what the fog hides.
  enemy.cloaked = true; enemy.seenBy = 0;
  assert.equal(s.isVisible(enemy, 0), false);
  assert.equal(hiddenFromBelow(s, deep), true);
  // The selection card adds the line for the player's own hidden units only.
  enemy.hp = 0;
  assert.deepEqual(selectionGround(s, [deep]), { high: true, ford: false, hidden: true });
  assert.equal(selectionGround(s, [rim]).hidden, false);
  assert.equal(selectionGround(s, [deep, rim]).hidden, false);
  enemy.hp = 1; enemy.cloaked = false;
  assert.equal(selectionGround(s, [deep]).hidden, false);
});

test('ramp ticks for the minimap: one per ramp, across it, outside the rim', () => {
  const t = field('dunes').terrain, ticks = rampTicks(t);
  assert.equal(ticks.length, t.plateaus.reduce((n, p) => n + p.ramps.length, 0));
  for (const k of ticks) {
    assert.ok(t.onRamp(k.x, k.z), `tick centre on a ramp (${k.x}, ${k.z})`);
    assert.equal(t.level(k.x, k.z), 0, 'on the low side');
  }
  assert.deepEqual(rampTicks(field('classic').terrain), []);
});

test('the new words have Vietnamese', () => {
  for (const text of [FORD_TEXT, FORD_SHORT, HIDDEN_TEXT, HIDDEN_HINT, SIGHT_TEXT, `${SIGHT_TEXT}: send a unit up the ramp first`])
    assert.notEqual(translate(text, 'vi'), text, `Vietnamese for "${text}"`);
});
