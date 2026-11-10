import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../src/simulation.js';
import { translate } from '../src/i18n.js';
import { defaults, normalize } from '../src/settings.js';
import { ABILITY_KEYS, ABILITY_ICONS, ABILITY_ORDER, STANCE_INFO, STANCES, abilityGroups, abilityStatus, aimState, stanceState, stancesInUse,
  tacticalUnits, takesStance, rankBadge, rankTitle, rankBonus, clampRank, autocastDefault } from '../src/tactics-ui.js';

function field() {
  const s = new Simulation({ ai: false });
  for (const e of s.own(1)) if (e.kind === 'unit') e.hp = 0;
  s.tick(0.05); s.events.length = 0;
  return s;
}
const hotkeys = JSON.parse(readFileSync(new URL('../src/hotkeys.json', import.meta.url), 'utf8'));

test('ability groups: one per distinct ability, ready counts, shortest wait, fixed order, capped', () => {
  const s = field();
  const v1 = s.spawn('vanguard', 0, 0, 0), v2 = s.spawn('vanguard', 0, 2, 0), r = s.spawn('ranger', 0, 4, 0), b = s.spawn('breaker', 0, 6, 0), t = s.spawn('tank', 0, 8, 0), w = s.spawn('worker', 0, 10, 0);
  const all = [t, b, r, v2, v1, w];
  let groups = abilityGroups(s, all, 9);
  assert.deepEqual(groups.map((g) => g.id), ['shieldwall', 'focus', 'barrage', 'overdrive'], 'display order is fixed, whatever the selection order');
  assert.deepEqual(groups[0].ids.sort(), [v1.id, v2.id].sort());
  assert.deepEqual(groups.map((g) => [g.count, g.ready, g.fraction]), [[2, 2, 0], [1, 1, 0], [1, 1, 0], [1, 1, 0]]);
  assert.equal(groups.find((g) => g.id === 'barrage').aimed, true);
  assert.equal(groups.filter((g) => g.aimed).length, 1);
  assert.equal(abilityStatus(groups[0]), 'Ready 2/2'); assert.equal(abilityStatus(groups[1]), 'Ready');

  assert.equal(s.command({ team: 0, type: 'ability', ids: [v1.id, r.id] }), true);
  groups = abilityGroups(s, all, 9);
  assert.equal(groups[0].ready, 1); assert.equal(abilityStatus(groups[0]), 'Ready 1/2'); assert.equal(groups[0].fraction, 0, 'a ready unit keeps the tile live');
  const focus = groups[1];
  assert.equal(focus.ready, 0); assert.equal(focus.wait, r.ability.cooldown); assert.equal(focus.fraction, 1); assert.equal(abilityStatus(focus), `${r.ability.cooldown}s`);
  for (let i = 0; i < 200; i++) s.tick(0.05);
  const later = abilityGroups(s, all, 9)[1];
  assert.ok(Math.abs(later.wait - (r.ability.cooldown - 10)) < 1e-6); assert.ok(Math.abs(later.fraction - (r.ability.cooldown - 10) / r.ability.cooldown) < 1e-6);
  assert.equal(abilityStatus(later), `${r.ability.cooldown - 10}s`);
  assert.equal(abilityStatus({ ready: 0, wait: 0.2, count: 1 }), '1s', 'never shows 0s while still cooling');

  // Over the cap, the abilities most units share stay; the order is still the fixed one.
  const capped = abilityGroups(s, [t, b, r, v1, v2], 2);
  assert.deepEqual(capped.map((g) => g.id), ['shieldwall', 'focus']);
  assert.deepEqual(abilityGroups(s, [t, t, b, v1], 0), []);
  assert.deepEqual(abilityGroups(s, [w], 9), [], 'Harvesters have no ability');
  r.hp = 0;
  assert.ok(!abilityGroups(s, all, 9).some((g) => g.id === 'focus'), 'the dead are left out');
  for (const id of ABILITY_ORDER) assert.ok(ABILITY_ICONS[id], `icon for ${id}`);
});

test('stance state: shared, mixed, or none; only armed non-Harvesters take a stance', () => {
  const s = field();
  const v = s.spawn('vanguard', 0, 0, 0), r = s.spawn('ranger', 0, 2, 0), m = s.spawn('medic', 0, 4, 0), w = s.spawn('worker', 0, 6, 0), tower = s.spawn('tower', 0, 12, 0);
  assert.equal(stanceState([v, r]), 'guard', 'guard is the default');
  assert.equal(stanceState([m, w, tower]), null);
  assert.deepEqual([v, r, m, w, tower].map(takesStance), [true, true, false, false, false]);
  assert.deepEqual(tacticalUnits([v, m, w, tower]).map((e) => e.id), [v.id, m.id], 'a Medic has an ability but no stance');
  s.command({ team: 0, type: 'stance', ids: [v.id], stance: 'hold' });
  assert.equal(stanceState([v]), 'hold'); assert.equal(stanceState([v, r, m]), 'mixed');
  assert.deepEqual([...stancesInUse([v, r, m])].sort(), ['guard', 'hold']);
  s.command({ team: 0, type: 'stance', ids: [v.id, r.id, m.id, w.id], stance: 'aggressive' });
  assert.equal(stanceState([v, r, m, w]), 'aggressive');
  assert.equal(m.stance, undefined); assert.equal(w.stance, undefined);
  assert.deepEqual(STANCES, Object.keys(STANCE_INFO));
});

test('aiming Barrage: ready Breakers, those in reach of the point, and the circle', () => {
  const s = field();
  const near = s.spawn('breaker', 0, 0, 0), far = s.spawn('breaker', 0, 30, 0), v = s.spawn('vanguard', 0, 2, 0);
  const a = near.ability;
  let aim = aimState(s, [near, far, v], null);
  assert.deepEqual([aim.sources.length, aim.ok, aim.range, aim.radius, aim.casters.length], [2, false, a.range, a.radius, 0]);
  aim = aimState(s, [near, far, v], { x: 10, z: 0 });
  assert.equal(aim.ok, true); assert.deepEqual(aim.casters, [near.id]);
  assert.equal(aimState(s, [near, far], { x: 15, z: 0 }).ok, false, 'between the two, out of reach of both');
  assert.equal(aimState(s, [near], { x: a.range, z: 0 }).ok, true, 'the edge counts');
  assert.equal(aimState(s, [near], { x: NaN, z: 0 }).ok, false);
  // The rules accept exactly what the interface offers.
  assert.equal(s.command({ team: 0, type: 'ability', ids: aimState(s, [near, far], { x: 10, z: 0 }).casters, x: 10, z: 0 }), true);
  assert.equal(far.abilityAt || 0, 0, 'the Breaker out of reach keeps its shell');
  assert.deepEqual(aimState(s, [near, far], { x: 10, z: 0 }).sources.map((e) => e.id), [far.id], 'a Breaker cooling down no longer aims');
  assert.equal(aimState(s, [v], { x: 3, z: 0 }).sources.length, 0);
});

test('rank badge and titles', () => {
  assert.equal(rankBadge(0), ''); assert.equal(rankBadge(undefined), '');
  for (const n of [1, 2, 3]) {
    const html = rankBadge(n);
    assert.equal(html.match(/<path/g).length, n); assert.ok(html.includes(`data-rank="${n}"`) && html.includes(`aria-label="Rank ${n}"`));
  }
  assert.equal(clampRank(7), 3); assert.equal(clampRank(-1), 0);
  assert.equal(rankBonus(2), 16); assert.equal(rankTitle(2), 'Rank 2 · +16% damage and health');
});

test('auto-cast is a saved setting: on by default for touch, off for desktop', () => {
  assert.equal(defaults(true).autocast, true); assert.equal(defaults(false).autocast, false);
  assert.equal(autocastDefault(true), true); assert.equal(autocastDefault(false), false);
  assert.equal(normalize({ version: 1 }, true).autocast, true, 'an older save takes the device default');
  assert.equal(normalize({ version: 1 }, false).autocast, false);
  assert.equal(normalize({ version: 1, autocast: false }, true).autocast, false, 'a choice survives');
  assert.equal(normalize({ version: 1, autocast: true }, false).autocast, true);
  assert.equal(normalize({ version: 1, autocast: 'yes' }, false).autocast, false);
});

test('tactics hotkeys are free: no clash with commands, tile keys, camera or groups', () => {
  const keys = hotkeys.commands.map((k) => k.key.split(' / ')[0].toLowerCase());
  assert.equal(new Set(keys).size, keys.length, 'every command key is bound once');
  const stances = Object.values(STANCE_INFO).map((s) => s.key);
  assert.deepEqual(stances, ['[', ']', '\\']);
  for (const id of STANCES) assert.equal(hotkeys.commands.find((k) => k.id === `stance-${id}`)?.key, STANCE_INFO[id].key);
  const taken = new Set([...keys.filter((k) => !stances.includes(k)), 'w', 'a', 's', 'd', 'g', '?', '.', '-', ' ', ...'123456789']);
  for (const key of stances) assert.ok(!taken.has(key), `${key} is free`);
  // Ability tiles use the card's tile keys except Q (Attack-move) and R (Heal / repair), which units keep.
  for (const key of ABILITY_KEYS) {
    assert.ok(hotkeys.actionKeys.includes(key), `${key} is a tile key`);
    assert.ok(!keys.includes(key.toLowerCase()), `${key} is not a command key`);
    assert.ok(!['Q', 'R', 'W', 'A', 'S', 'D', 'G'].includes(key));
  }
});

test('every new tactics string has a Vietnamese entry', () => {
  const s = field(), units = ['vanguard', 'ranger', 'breaker', 'medic', 'engineer', 'tank', 'antitank'].map((type, i) => s.spawn(type, 0, i * 2, 0));
  const strings = ['Guard', 'Hold', 'Aggressive', 'Stance', 'Stance: mixed', 'Ready', 'Ready 2/3', 'Barrage is recharging.', 'Shield wall is recharging.',
    'No injured infantry in range.', 'No damaged vehicle or building in range.', 'Select soldiers or tanks to set a stance.',
    'BARRAGE · Tap a target inside the ring', 'BARRAGE · Click a target inside the ring · Esc to cancel', 'BARRAGE · Out of range: choose a spot inside the ring',
    'Battle tank promoted to rank 2', 'Rank 3', rankTitle(1), 'Auto-cast abilities',
    'Your units use their abilities on their own in a fight, as rival armies do. Off: you give the order from the command card.',
    'Abilities: ', ' use the ability tiles of the selected soldiers and vehicles; Barrage then asks for a target area.',
    'Use an ability / set a stance', 'Select soldiers, then Actions',
    ...Object.values(STANCE_INFO).flatMap((i) => [i.label, `${i.title} · ${i.key}`, `Stance: ${i.label}`]),
    ...hotkeys.commands.filter((k) => k.id.startsWith('stance-')).map((k) => k.label),
    ...abilityGroups(s, units, 9).flatMap((g) => [g.name, `E · ${g.name} · ${g.description}`])];
  for (const text of strings) {
    const out = translate(text, 'vi');
    assert.notEqual(out, text, `vi.json lacks: ${text}`);
    for (const word of ['Ready', 'Stance', 'Rank', 'recharging', 'promoted', 'range', 'ring', 'Guard', 'Hold', 'Aggressive', 'abilities', 'Barrage'])
      assert.ok(!new RegExp(`\\b${word}\\b`, 'i').test(out), `"${text}" -> "${out}" still contains "${word}"`);
  }
  assert.equal(translate('Ready 2/3', 'vi'), 'Sẵn sàng 2/3');
  assert.equal(translate('12s', 'vi'), '12s');
});
