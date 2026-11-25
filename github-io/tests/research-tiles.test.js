import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { productionTiles, researchState, buildingUnits, trainsLine } from '../src/research-tiles.js';
import { translate } from '../src/i18n.js';
import { DEFINITIONS as D } from '../src/data.js';
import { workshopUnitsOf } from '../src/factions.js';

// A player Foundry with plenty of resources.
function setup(level = 1) {
  const s = new Simulation({ ai: false, factions: { 0: 'meridian', 1: 'meridian' } });
  s.players[0].alloy = s.players[0].energy = 5000;
  const hq = s.own(0).find((e) => e.type === 'hq');
  const b = s.spawn('foundry', 0, hq.x + 9, hq.z + 7);
  b.complete = true; b.progress = 1; b.level = level;
  return { s, b };
}
// Doctrine tiles (the either/or pair, 2026-11-24) are checked in tests/faction-depth.test.js; these views leave them out.
const noDoctrine = (t) => !t.doctrine;
const view = (s, b, choosing) => productionTiles(s, b, { choosing }).tiles.filter(noDoctrine).map((t) => `${t.action}:${t.label}:${t.state}${t.sub ? ':' + t.sub : ''}`);

test('before the choice the Foundry shows one Research slot; locked items name the level they need', () => {
  const { s, b } = setup();
  assert.deepEqual(view(s, b, false), [
    'breaker:Breaker:ready',
    'research:Research:ready:Pick 1 of 2',
    'engineer:Engineer:locked:Needs L2',
    'tank:Battle tank:locked:Needs L3',
  ]);
  assert.deepEqual(view(s, b, true), ['upgrade:Damage +10%:ready', 'plating:Armor +12%:ready', 'back:Back:ready']);
});

test('the slot moves forward: researching with progress, tier II (locked until Foundry L2), then done', () => {
  const { s, b } = setup();
  assert.ok(s.enqueue(b.id, 'upgrade'));
  for (let i = 0; i < 100; i++) s.tick(0.05); // 5 s of a 25 s research
  let r = researchState(s, 0);
  assert.equal(r.state, 'busy'); assert.equal(r.type, 'upgrade');
  assert.ok(r.progress > 0.15 && r.progress < 0.25, String(r.progress));
  assert.match(view(s, b, false)[1], /^upgrade:Damage \+10%:busy:Researching 2\d%$/);
  // The choice sheet never reopens once a branch is chosen.
  assert.equal(productionTiles(s, b, { choosing: true }).choosing, false);
  for (let i = 0; i < 500; i++) s.tick(0.05);
  assert.equal(s.players[0].upgrade, true);
  // Between tiers the first stays visible as active, with the next step under it.
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +10% ✓:locked:+8% at L2');
  b.level = 2;
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +10% ✓:ready');
  assert.equal(productionTiles(s, b).tiles[1].next, '+8%');
  assert.ok(s.enqueue(b.id, 'upgrade2'));
  assert.match(view(s, b, false)[1], /^upgrade2:Damage \+8%:busy:/);
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  r = researchState(s, 0);
  assert.deepEqual([r.state, r.branch], ['done', 'weapons']);
  assert.equal(view(s, b, false)[1], 'upgrade2:Damage +19%:done:Active');
  // Four tiles at most: the slot never adds a fifth tile (phones show four).
  assert.equal(view(s, b, false).length, 4);
});

test('Flak is a one-off Command core research: locked below L2, then researching, then done', () => {
  const s = new Simulation({ ai: false });
  s.players[0].alloy = s.players[0].energy = 5000;
  const hq = s.own(0).find((e) => e.type === 'hq');
  const tile = () => productionTiles(s, hq).tiles.filter(noDoctrine).map((t) => `${t.action}:${t.label}:${t.state}${t.sub ? ':' + t.sub : ''}`);
  // The core is the airfield (0.18): four tiles, as many as a phone shows.
  assert.deepEqual(tile(), ['worker:Harvester:ready', 'flak:Anti-air guns:locked:Needs L2', 'kite:Kite scout:locked:Needs L2', 'hawk:Hawk gunship:locked:Needs L3']);
  assert.equal(s.enqueue(hq.id, 'flak'), false);
  hq.level = 2;
  assert.equal(tile()[1], 'flak:Anti-air guns:ready');
  assert.ok(s.enqueue(hq.id, 'flak'));
  assert.equal(s.enqueue(hq.id, 'flak'), false, 'once per match');
  for (let i = 0; i < 100; i++) s.tick(0.05);
  assert.match(tile()[1], /^flak:Anti-air guns:busy:Researching \d+%$/);
  for (let i = 0; i < 500; i++) s.tick(0.05);
  assert.equal(s.players[0].flak, true);
  assert.equal(tile()[1], 'flak:Anti-air guns:done:Active');
  // Story missions without air keep the core's list as it was.
  const m = { id: 'fixture', rules: {}, objectives: [], setup: [], win: [], triggers: [] };
  const story = new Simulation({ ai: false, mission: m });
  assert.deepEqual(story.own(0).find((e) => e.type === 'hq').trains, ['worker']);
});

test('the plating branch reads as armor, and a research queued behind a unit waits', () => {
  const { s, b } = setup();
  assert.ok(s.enqueue(b.id, 'breaker'));
  assert.ok(s.enqueue(b.id, 'plating'));
  const r = researchState(s, 0);
  assert.deepEqual([r.branch, r.state, r.waiting], ['plating', 'busy', true]);
  assert.equal(view(s, b, false)[1], 'plating:Armor +12%:busy:Waiting in queue');
});

// Build menu tiles (owner, 2026-11-25): a Harvester's building tiles show the units each building trains.
const units = (s, type) => buildingUnits(s, type).map((u) => `${u.type}${u.level > 1 ? '@' + u.level : ''}`).join(' ');
test('build menu: each building lists the units its faction trains there, with the level each needs', () => {
  const expect = {
    meridian: { barracks: 'vanguard ranger medic@2 antitank@2', foundry: 'breaker engineer@2 tank@3', hq: 'worker kite@2 hawk@3' },
    ashfall: { barracks: 'scrapper ranger medic@2 antitank@2', foundry: 'scorcher engineer@2 tank@3', hq: 'worker kite@2 balloon@2', salvageyard: '' },
    wardens: { barracks: 'vanguard drone antitank@2', foundry: 'breaker walker@3', hq: 'worker kite@2 halo@2', pylon: '' },
  };
  for (const [faction, buildings] of Object.entries(expect)) {
    const s = new Simulation({ ai: false, factions: { 0: faction, 1: 'meridian' } });
    for (const [type, list] of Object.entries(buildings)) assert.equal(units(s, type), list, `${faction} ${type}`);
    // Walls of the build menu that train nothing show nothing; research (flak, upgrades) is never a unit.
    assert.equal(units(s, 'relay'), ''); assert.equal(units(s, 'tower'), '');
    // The same list the building gets once it stands (sim.resolvedTrains), research left out.
    const hq = s.own(0).find((e) => e.type === 'hq');
    assert.deepEqual(buildingUnits(s, 'hq').map((u) => u.type), hq.trains.filter((t) => D[t].kind === 'unit'));
  }
});

test('build menu: an Expanded match shows the workshop units at the faction host; a story mission keeps its roster', () => {
  const s = new Simulation({ ai: false, factions: { 0: 'ashfall', 1: 'meridian' }, rules: { roster: 'expanded' } });
  assert.deepEqual(buildingUnits(s, 'salvageyard').map((u) => u.type), workshopUnitsOf('ashfall'));
  assert.ok(buildingUnits(s, 'salvageyard').length > 0);
  const m = new Simulation({ ai: false, factions: { 0: 'meridian', 1: 'meridian' }, rules: { roster: 'expanded' } });
  assert.deepEqual(buildingUnits(m, 'workshop').map((u) => u.type), workshopUnitsOf('meridian'));
  const story = new Simulation({ ai: false, mission: { id: 'fixture', rules: {}, objectives: [], setup: [], win: [], triggers: [] } });
  assert.equal(units(story, 'hq'), 'worker', 'no flyers in a story mission without air');
});

test('build menu: the trains line reads in English, Vietnamese and Korean', () => {
  const s = new Simulation({ ai: false });
  const label = `Barracks, 150 alloy · ${trainsLine(buildingUnits(s, 'barracks'))}`;
  assert.equal(label, 'Barracks, 150 alloy · Trains: Vanguard · Ranger · Medic (level 2) · Anti-tank soldier (level 2)');
  assert.equal(trainsLine([]), '');
  const vi = translate(label, 'vi'), ko = translate(label, 'ko');
  assert.equal(vi, `${translate('Barracks', 'vi')}, ${translate('150 alloy', 'vi')} · Huấn luyện: ${translate('Vanguard', 'vi')} · ${translate('Ranger', 'vi')} · ${translate('Medic', 'vi')} (cấp 2) · ${translate('Anti-tank soldier', 'vi')} (cấp 2)`);
  assert.match(ko, /^.+, .+ · 훈련: .+ · .+ · .+ \(레벨 2\) · .+ \(레벨 2\)$/);
  // Every faction's lists translate without English left over, except the flyers' kept names (Kite, Hawk...).
  for (const faction of ['meridian', 'ashfall', 'sunward', 'wardens', 'veil']) {
    const f = new Simulation({ ai: false, factions: { 0: faction, 1: 'meridian' } });
    for (const type of f.buildable(0)) {
      const line = trainsLine(buildingUnits(f, type));
      if (!line) continue;
      for (const lang of ['vi', 'ko']) {
        const out = translate(line, lang);
        assert.ok(!/Trains|\(level/.test(out), `${faction} ${type} ${lang}: ${out}`);
      }
    }
  }
});
