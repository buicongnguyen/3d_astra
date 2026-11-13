// 0.19a "Choices": campaign progress fixes, Commander decisions (flags, the decide command, `if`
// filters, resolveMission) and the two endings. Browser checks: tests/choices.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { MISSIONS } from '../src/story/missions.js';
import { CAST } from '../src/story/world.js';
import { DECISIONS, ENDINGS, ENDING_IDS, answerFor, endingFor, mercyCount, resolveMission, flagMatches } from '../src/story/choices.js';
import { MAP_NODES, MAP_TEXT } from '../src/story/campaign-map.js';
import { loadProgress, saveProgress, recordClear, recordDecisions, recordEnding, isUnlocked, isCleared, nextMission, missionById } from '../src/campaign.js';
import { storyStrings } from '../tools/story-strings.mjs';
import { answerDecision } from '../tools/playbot.mjs';

const byId = (id) => MISSIONS.find((m) => m.id === id);
const memory = (text) => { const store = new Map(text === undefined ? [] : [['frontier-campaign-v2', text]]); return { store, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }; };
const run = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20 && !s.result; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };
const ifs = (value) => JSON.stringify(value).includes('"if"');
const mercy = Object.fromEntries(Object.values(DECISIONS).map((d) => [d.id, d.options.find((o) => o.mercy).id]));
const firm = Object.fromEntries(Object.values(DECISIONS).map((d) => [d.id, d.options.find((o) => !o.mercy).id]));

// A small mission with one decision at 2 s: a wave and a gift wait on the answer, a line at 3 s does not.
const base = {
  id: 't-choice', map: 'classic', objectives: [{ id: 'hold', text: 'Hold', type: 'survive', seconds: 600 }], win: ['hold'], regions: { mid: { x: 0, z: 0, r: 7 } },
  decisions: { 't-pick': { who: 'vale', prompt: 'Which way?', options: [{ id: 'kind', label: 'Kind', effect: 'k', mercy: true }, { id: 'hard', label: 'Hard', effect: 'h', mercy: false, default: true }] } },
  triggers: [
    { when: { time: 2 }, do: [{ say: { who: 'vale', text: 'before' } }, { decide: 't-pick' }, { if: { flag: 't-pick', is: 'kind' }, say: { who: 'vale', text: 'kind' } }, { if: { flag: 't-pick', is: 'hard' }, give: { alloy: 300 } }, { say: { who: 'vale', text: 'after' } }] },
    { when: { time: 3 }, do: [{ say: { who: 'okoro', text: 'still running' } }] },
    { if: { flag: 't-pick', is: 'kind' }, when: { time: 1 }, do: [{ say: { who: 'sol', text: 'kind trigger' } }] },
  ],
};
const make = (mission = base) => new Simulation({ map: mission.map, ai: false, mission });

test('the three decisions follow the story rules', () => {
  assert.deepEqual(Object.keys(DECISIONS).sort(), ['m03-alloy', 'm05-pact', 'm10-veil']);
  for (const d of Object.values(DECISIONS)) {
    assert.ok(Object.hasOwn(CAST, d.who), `${d.id}: speaker`);
    assert.ok(d.prompt.length < 140, d.id);
    assert.equal(d.options.length, 2, d.id);
    assert.equal(d.options.filter((o) => o.default).length, 1, `${d.id}: one default`);
    assert.deepEqual(d.options.map((o) => !!o.mercy).sort(), [false, true], `${d.id}: one merciful, one firm`);
    for (const o of d.options) assert.ok(o.label.length < 70 && o.effect.length < 90, `${d.id}.${o.id}`);
    const m = byId(d.mission);
    assert.equal(m.triggers.flatMap((t) => t.do).filter((a) => a.decide === d.id).length, 1, `${d.id}: asked once`);
  }
  // Every `if` names a decision and one of its options, or an ending.
  const walk = (value, where) => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, where));
    if (!value || typeof value !== 'object') return;
    if (value.if) {
      if (value.if.ending !== undefined) assert.ok(ENDING_IDS.includes(value.if.ending), `${where}: ending ${value.if.ending}`);
      else assert.ok(DECISIONS[value.if.flag]?.options.some((o) => o.id === value.if.is), `${where}: ${JSON.stringify(value.if)}`);
    }
    for (const v of Object.values(value)) walk(v, where);
  };
  for (const m of MISSIONS) walk(m, m.id);
});

test('endingFor: two or more merciful answers share the Keystone; missing answers use the defaults', () => {
  const table = [
    [null, 'meridian-line'],
    [{}, 'meridian-line'],
    [{ decisions: {} }, 'meridian-line'],
    [{ decisions: firm }, 'meridian-line'],
    [{ decisions: { 'm03-alloy': 'return' } }, 'meridian-line'],
    [{ decisions: { 'm03-alloy': 'return', 'm05-pact': 'share' } }, 'open-frontier'],
    [{ decisions: { 'm03-alloy': 'return', 'm10-veil': 'spare' } }, 'open-frontier'],
    [{ decisions: { 'm05-pact': 'share', 'm10-veil': 'spare', 'm03-alloy': 'keep' } }, 'open-frontier'],
    [{ decisions: mercy }, 'open-frontier'],
    [{ decisions: { 'm03-alloy': 'nonsense', 'm05-pact': 'share' } }, 'meridian-line'],
  ];
  for (const [progress, ending] of table) assert.equal(endingFor(progress), ending, JSON.stringify(progress));
  assert.equal(mercyCount(mercy), 3); assert.equal(mercyCount(null), 0);
  assert.equal(answerFor('m05-pact', null), 'drive'); assert.equal(answerFor('m05-pact', { 'm05-pact': 'share' }), 'share'); assert.equal(answerFor('nope', {}), undefined);
  for (const e of Object.values(ENDINGS)) {
    assert.deepEqual(e.cards.map((c) => c.who), ['vale', 'sol', 'hale', 'maren', 'echo'], e.id);
    for (const c of e.cards) { assert.ok(c.lines.length >= 1 && c.lines.length <= 3); for (const l of c.lines) assert.ok(l.length < 140, l); }
  }
});

test('resolveMission settles earlier answers and the ending; untouched missions come back as the same object', () => {
  for (const m of MISSIONS) {
    const own = new Set(Object.keys(m.decisions || {}));
    const foreign = JSON.stringify(m).match(/"if":\{"(flag|ending)":"([^"]+)"/g) || [];
    const settled = foreign.some((text) => text.includes('ending') || ![...own].some((id) => text.includes(id)));
    if (!settled) for (const p of [null, { decisions: mercy }, { decisions: firm }]) assert.equal(resolveMission(m, p), m, `${m.id} unchanged`);
  }
  const m07 = byId('m07-copper-siege'), m09 = byId('m09-a-debt-in-the-dunes'), m12 = byId('m12-frontiers-end');
  const wave7 = (p) => resolveMission(m07, p).triggers.find((t) => t.when.time === 420).do.find((a) => a.wave).wave.units;
  assert.deepEqual(wave7(null), { vanguard: 4, antitank: 2, breaker: 1 }, 'kept alloy: the full wave');
  assert.deepEqual(wave7({ decisions: { 'm03-alloy': 'return' } }), { vanguard: 4, antitank: 2 }, 'returned alloy: no Breaker');
  const riders9 = (p) => resolveMission(m09, p).triggers.find((t) => t.when.objective === 'link').do.filter((a) => a.spawn === 'rider').reduce((n, a) => n + a.count, 0);
  assert.equal(riders9(null), 3); assert.equal(riders9({ decisions: { 'm05-pact': 'share' } }), 5);
  for (const [p, ending] of [[null, 'meridian-line'], [{ decisions: mercy }, 'open-frontier']]) {
    const r = resolveMission(m12, p);
    assert.ok(!ifs(r), 'nothing left to settle in the finale');
    assert.equal(r.objectives.filter((o) => o.id === 'engine').length, 1);
    assert.equal(r.objectives.find((o) => o.id === 'engine').text, ending === 'open-frontier' ? 'Destroy the draw engine and open the Keystone to every camp' : 'Destroy the Keystone draw engine');
    assert.equal(r.debrief.win.length, ending === 'open-frontier' ? 4 : 3);
    assert.equal(resolveMission(r, { decisions: p ? firm : mercy }), r, 'a settled mission stays as it is');
  }
  const maren = (p) => resolveMission(m12, p).triggers.find((t) => t.when.tagHpBelow?.tag === 'engine').do[0].say.text;
  assert.match(maren({ decisions: { 'm10-veil': 'spare' } }), /You let my crews walk out/);
  assert.match(maren(null), /I watched the Crown light/);
  // A decision's own `if`s stay for the match.
  assert.ok(ifs(resolveMission(byId('m03-the-ashen-line'), { decisions: mercy })));
  // The defaults keep missions 7 and 9 exactly as they were before 0.19a.
  assert.ok(!ifs(resolveMission(m07)) && !ifs(resolveMission(m09)));
});

test('a decision holds only its own trigger until the decide command; answers are logged and replay to the same hash', () => {
  const a = make();
  const seen = run(a, 2.6);
  const asked = seen.filter((e) => e.type === 'decision');
  assert.deepEqual(asked.map((e) => [e.id, e.who]), [['t-pick', 'vale']]);
  assert.deepEqual(a.mission.pending, { id: 't-pick', trigger: 0, at: 2 });
  assert.equal(a.flags, undefined, 'no flags before an answer');
  run(a, 1, seen);
  assert.ok(seen.some((e) => e.type === 'say' && e.text === 'still running'), 'other triggers keep running');
  assert.ok(!seen.some((e) => e.text === 'after'), 'the rest of the trigger waits');
  // Only the player, only the open decision, only a real option.
  assert.equal(a.command({ team: 1, type: 'decide', id: 't-pick', option: 'kind' }), false);
  assert.equal(a.command({ team: 0, type: 'decide', id: 'other', option: 'kind' }), false);
  assert.equal(a.command({ team: 0, type: 'decide', id: 't-pick', option: 'maybe' }), false);
  const alloy = a.players[0].alloy;
  assert.ok(a.command({ team: 0, type: 'decide', id: 't-pick', option: 'kind' }));
  assert.deepEqual(a.flags, { 't-pick': 'kind' });
  assert.equal(a.mission.pending, undefined);
  const said = a.events.filter((e) => e.type === 'say').map((e) => e.text);
  assert.deepEqual(said, ['kind', 'after'], 'the held actions run, honouring their if');
  assert.equal(a.players[0].alloy, alloy, 'the other branch gives nothing');
  assert.equal(a.command({ team: 0, type: 'decide', id: 't-pick', option: 'hard' }), false, 'answered once');
  a.events.length = 0;
  run(a, 2, seen);
  assert.ok(seen.some((e) => e.text === 'kind trigger'), 'a trigger under an if fires once its answer is given');
  assert.deepEqual(a.commandLog.map(({ tick, ...c }) => c), [{ team: 0, type: 'decide', id: 't-pick', option: 'kind' }]);
  // Replay from the options and the command log.
  const b = make();
  let next = 0;
  while (b.ticks < a.ticks) {
    while (next < a.commandLog.length && a.commandLog[next].tick === b.ticks) { const { tick, ...c } = a.commandLog[next++]; b.command(c); }
    b.tick(0.05); b.events.length = 0;
  }
  assert.equal(b.hash(), a.hash());
  // The other answer is a different match.
  const c = make(); run(c, 2.6); c.command({ team: 0, type: 'decide', id: 't-pick', option: 'hard' });
  assert.equal(c.players[0].alloy, alloy + 300);
});

test('a save taken while a choice is open restores it; answering after loading plays out identically', () => {
  const a = make();
  run(a, 2.6);
  const copy = Simulation.load(a.serialize());
  assert.deepEqual(copy.mission.pending, a.mission.pending);
  assert.equal(copy.hash(), a.hash());
  for (const s of [a, copy]) { s.command({ team: 0, type: 'decide', id: 't-pick', option: 'hard' }); s.events.length = 0; run(s, 3); }
  assert.equal(copy.hash(), a.hash());
  assert.deepEqual(copy.flags, { 't-pick': 'hard' });
  const again = Simulation.load(a.serialize());
  assert.deepEqual(again.flags, { 't-pick': 'hard' }); assert.equal(again.hash(), a.hash());
});

test('missions without decisions keep no flags and no pending field, so their saves and hashes are as before', () => {
  for (const m of [MISSIONS[0], MISSIONS[1], byId('m06-copper-harvest')]) {
    const s = new Simulation({ map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, mission: m });
    run(s, 5);
    assert.equal(s.missionDef, m, `${m.id}: the very same mission object`);
    const text = s.serialize();
    assert.ok(!/"flags"|"pending"/.test(text), m.id);
  }
  const skirmish = new Simulation({ map: 'classic' });
  assert.equal(skirmish.flags, undefined);
});

test('the real decisions: the bot answers, and each branch has its own consequence', () => {
  const m03 = byId('m03-the-ashen-line');
  for (const [want, gift] of [['mercy', 0], ['firm', 300], ['default', 300]]) {
    const s = new Simulation({ map: m03.map, enemyCount: m03.enemies, aiSpeed: m03.speed, alliance: m03.alliance, ai: false, mission: m03 });
    run(s, 1);
    const scout = s.own(0).find((e) => e.kind === 'unit' && e.type !== 'worker');
    const north = m03.regions.siphonNorth;
    scout.x = north.x; scout.z = north.z + 2;
    const seen = run(s, 0.2);
    const ask = seen.find((e) => e.type === 'decision');
    assert.equal(ask?.id, 'm03-alloy', want);
    const alloy = s.players[0].alloy;
    assert.ok(answerDecision(s, ask.id, want));
    assert.equal(s.flags['m03-alloy'], want === 'mercy' ? 'return' : 'keep');
    assert.equal(Math.round(s.players[0].alloy - alloy), gift, want);
  }
});

test('progress: older records load with their clears; every field is kept; unlocks follow ids', () => {
  // Pre-0.19 progress, exactly as 0.16 wrote it.
  const old = memory(JSON.stringify({ cleared: { [MISSIONS[0].id]: { time: 300, medal: 'gold', difficulty: 'standard' }, [MISSIONS[1].id]: { time: 420, medal: 'silver' } } }));
  const p = loadProgress(old);
  assert.deepEqual(Object.keys(p), ['cleared']);
  assert.equal(isCleared(p, 1), true); assert.equal(nextMission(p), 2);
  // New fields survive a load and every kind of record.
  const full = memory(JSON.stringify({ cleared: {}, decisions: { 'm03-alloy': 'return', bad: 3 }, endingsSeen: ['open-frontier', 'nope', 'open-frontier'], chronicles: { sunward: { cleared: 1 } }, future: { x: 1 } }));
  let q = loadProgress(full);
  assert.deepEqual(q.decisions, { 'm03-alloy': 'return' });
  assert.deepEqual(q.endingsSeen, ['open-frontier']);
  assert.deepEqual(q.chronicles, { sunward: { cleared: 1 } });
  assert.deepEqual(q.future, { x: 1 }, 'a field from a newer version is kept');
  q = recordClear(q, 0, 200, 'gold');
  assert.deepEqual([q.decisions, q.endingsSeen, q.future], [{ 'm03-alloy': 'return' }, ['open-frontier'], { x: 1 }], 'a win keeps every field');
  q = recordDecisions(q, { 'm05-pact': 'share', 'm03-alloy': 'keep' });
  assert.deepEqual(q.decisions, { 'm03-alloy': 'keep', 'm05-pact': 'share' }, 'a replayed decision replaces the old answer');
  assert.equal(recordDecisions(q, undefined), q, 'a mission without decisions changes nothing');
  q = recordEnding(recordEnding(q, 'meridian-line'), 'meridian-line');
  assert.deepEqual(q.endingsSeen, ['open-frontier', 'meridian-line']);
  assert.equal(recordEnding(q, 'nonsense'), q);
  saveProgress(q, full);
  assert.deepEqual(loadProgress(full), q, 'saved and loaded unchanged');
  // A mission opens when it is cleared itself or the one before is: inserting a mission never locks a cleared one.
  const gap = { cleared: { [MISSIONS[5].id]: { time: 500, medal: 'bronze' } } };
  assert.equal(isUnlocked(gap, 5), true, 'cleared, so open');
  assert.equal(isUnlocked(gap, 6), true, 'the one after a clear');
  assert.equal(isUnlocked(gap, 4), false);
  assert.equal(isUnlocked(gap, 12), false);
  assert.deepEqual(missionById('m07-copper-siege'), { campaign: 'main', index: 6, mission: MISSIONS[6] });
  assert.equal(missionById('m99-nowhere'), null);
});

test('the story-strings walk covers decisions, endings and the campaign map', () => {
  const texts = new Set(storyStrings().map((s) => s.text));
  for (const d of Object.values(DECISIONS)) {
    assert.ok(texts.has(d.prompt), d.id);
    for (const o of d.options) assert.ok(texts.has(o.label) && texts.has(o.effect), `${d.id}.${o.id}`);
  }
  for (const e of Object.values(ENDINGS)) {
    assert.ok(texts.has(e.title) && texts.has(e.summary), e.id);
    for (const c of e.cards) for (const l of c.lines) assert.ok(texts.has(l), l);
  }
  for (const text of Object.values(MAP_TEXT)) assert.ok(texts.has(text), text);
  assert.deepEqual(Object.keys(MAP_NODES), MISSIONS.map((m) => m.id), 'one map node per mission, in order');
});

test('flagMatches only passes a recorded answer', () => {
  assert.equal(flagMatches(undefined, null), true);
  assert.equal(flagMatches({ flag: 'a', is: 'x' }, undefined), false);
  assert.equal(flagMatches({ flag: 'a', is: 'x' }, { a: 'y' }), false);
  assert.equal(flagMatches({ flag: 'a', is: 'x' }, { a: 'x' }), true);
  assert.equal(flagMatches({ flag: 'toString', is: 'x' }, {}), false);
});
