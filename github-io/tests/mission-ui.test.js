import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../src/simulation.js';
import { MISSIONS } from '../src/campaign.js';
import { CAST } from '../src/story/world.js';
import { clock, pointLabel, objectiveProgress, DialogueQueue, lineSeconds, LOG_LIMIT, BACKLOG_LIMIT } from '../src/mission-text.js';
import { castPortrait, castName, hasCast } from '../src/cast-portraits.js';
import { writeSave, readSave, clearSave, SAVE_KEY } from '../src/savegame.js';
import { setMusicMood, musicMood } from '../src/music.js';

const memory = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('objective progress text by type', () => {
  const o = (extra) => ({ state: 'active', have: 0, held: 0, need: 1, seconds: 0, ...extra });
  assert.equal(objectiveProgress(o({ type: 'hold', have: 2, need: 2, held: 75, seconds: 180 })), '2/2 held · 1:15 / 3:00');
  assert.equal(objectiveProgress(o({ type: 'survive', held: 25.2, seconds: 300 })), '4:35 left');
  assert.equal(objectiveProgress(o({ type: 'collect', have: 0.426 })), '42%');
  assert.equal(objectiveProgress(o({ type: 'collect', have: 3 })), '100%');
  assert.equal(objectiveProgress(o({ type: 'build', have: 1, need: 2 })), '1/2');
  assert.equal(objectiveProgress(o({ type: 'escort', have: 1 }), 1), '1/1 arrived');
  assert.equal(objectiveProgress(o({ type: 'escort', have: 0 }), 3), '0/3 arrived');
  assert.equal(objectiveProgress(o({ type: 'destroyTag' }), 2), '2 left');
  assert.equal(objectiveProgress(o({ type: 'destroyCores' })), '');
  assert.equal(objectiveProgress(o({ type: 'hold', state: 'done', have: 2, need: 2, held: 180, seconds: 180 })), '', 'finished objectives show no progress');
  assert.equal(clock(0), '0:00'); assert.equal(clock(605.9), '10:05');
});

test('capture points are named from their region key unless the mission gives a label', () => {
  assert.equal(pointLabel({}, 'relayNorth'), 'Relay North');
  assert.equal(pointLabel({}, 'oldRelay'), 'Old Relay');
  assert.equal(pointLabel({}, 'seam'), 'Seam');
  assert.equal(pointLabel({ regions: { seam: { x: 0, z: 0, label: 'Copper seam' } } }, 'seam'), 'Copper seam');
  assert.equal(pointLabel({ setup: [{ capturePoint: 'crown', label: 'The Crown' }] }, 'crown'), 'The Crown');
});

test('dialogue queue: one line at a time, backlog over four goes to the log, log keeps twenty', () => {
  const q = new DialogueQueue();
  assert.equal(q.push('vale', 'One.'), true, 'the first line shows at once');
  assert.equal(q.current.text, 'One.');
  for (const n of ['Two.', 'Three.', 'Four.', 'Five.']) assert.equal(q.push('okoro', n), false);
  assert.equal(q.waiting.length, BACKLOG_LIMIT); assert.equal(q.skipped, 0);
  q.push('hale', 'Six.'); q.push('hale', 'Seven.');
  assert.equal(q.waiting.length, BACKLOG_LIMIT, 'only four lines wait');
  assert.equal(q.skipped, 2, 'the older ones are counted as moved to the log');
  assert.deepEqual(q.log.map((l) => l.text), ['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six.', 'Seven.'], 'no line is lost');
  // The line on screen stays for five seconds plus reading time, then the next waiting line shows.
  assert.ok(lineSeconds('x'.repeat(140)) > 10 && lineSeconds('x'.repeat(140)) <= 13);
  assert.equal(q.tick(4.9), false); assert.equal(q.current.text, 'One.');
  assert.equal(q.tick(1), true); assert.equal(q.current.text, 'Four.');
  assert.equal(q.next(), true); assert.equal(q.current.text, 'Five.');
  q.next(); q.next(); assert.equal(q.current.text, 'Seven.');
  assert.equal(q.next(), true); assert.equal(q.current, null);
  assert.equal(q.next(), false);
  for (let i = 0; i < 30; i++) q.push('vale', `Line ${i}`);
  assert.equal(q.log.length, LOG_LIMIT);
  assert.equal(q.log.at(-1).text, 'Line 29');
  assert.equal(q.flush(), true); assert.equal(q.current, null); assert.equal(q.waiting.length, 0);
  assert.equal(q.log.length, LOG_LIMIT, 'ending the match keeps the log');
});

test('every speaker in the campaign has a portrait drawn from the cast data', () => {
  const speakers = new Set();
  for (const m of MISSIONS) {
    for (const l of [...m.briefing.lines, ...m.debrief.win, ...m.debrief.lose]) speakers.add(l.who);
    for (const t of m.triggers || []) for (const a of t.do || []) if (a.say) speakers.add(a.say.who);
  }
  const seen = new Set();
  for (const who of [...speakers, ...Object.keys(CAST)]) {
    assert.ok(hasCast(who), `${who} is in CAST`);
    const html = castPortrait(who);
    assert.match(html, /^<span class="cast-portrait"[^>]*data-who="[a-z]+"[^>]*><svg viewBox="0 0 96 96"/);
    assert.ok(!html.includes('undefined') && !html.includes('NaN'), who);
    seen.add(html.replace(/data-who="[a-z]+"/, ''));
  }
  assert.equal(seen.size, Object.keys(CAST).length, 'each character has a distinct drawing');
  assert.equal(castName('vale'), 'Mira Vale');
  assert.match(castPortrait('nobody'), /<text[^>]*>\?<\/text>/, 'an unknown speaker falls back to initials');
});

test('savegame: one slot, never training or a finished match, tolerant of bad storage', () => {
  const store = memory();
  const sim = new Simulation({ map: MISSIONS[0].map, enemyCount: 1, aiSpeed: 'relaxed', mission: MISSIONS[0] });
  for (let i = 0; i < 40; i++) sim.tick(0.05);
  assert.equal(readSave(store), null);
  assert.equal(writeSave({ mode: 'training', sim }, store), false);
  assert.equal(writeSave({ mode: 'campaign', missionId: MISSIONS[0].id, sim }, store), true);
  const raw = JSON.parse(store.m.get(SAVE_KEY));
  assert.deepEqual(Object.keys(raw).sort(), ['at', 'missionId', 'mode', 'text']);
  const save = readSave(store);
  assert.equal(save.mode, 'campaign'); assert.equal(save.missionId, MISSIONS[0].id); assert.equal(save.map, MISSIONS[0].map);
  assert.ok(Math.abs(save.time - sim.time) < 1e-9);
  const loaded = Simulation.load(save.text);
  assert.equal(loaded.hash(), sim.hash(), 'the restored match is in step with the saved one');
  // A full or blocked storage fails silently.
  assert.equal(writeSave({ mode: 'skirmish', sim }, { setItem: () => { throw new Error('quota'); } }), false);
  assert.equal(readSave({ getItem: () => { throw new Error('denied'); } }), null);
  store.m.set(SAVE_KEY, '{broken'); assert.equal(readSave(store), null);
  store.m.set(SAVE_KEY, JSON.stringify({ at: 1, mode: 'campaign', missionId: 'x', text: 'not json' })); assert.equal(readSave(store), null);
  store.m.set(SAVE_KEY, JSON.stringify({ at: 1, mode: 'training', text: save.text })); assert.equal(readSave(store), null);
  writeSave({ mode: 'skirmish', sim }, store);
  sim.result = 'victory';
  assert.equal(writeSave({ mode: 'skirmish', sim }, store), false, 'a finished match is not saved');
  clearSave(store);
  assert.equal(readSave(store), null);
  assert.doesNotThrow(() => clearSave({ removeItem: () => { throw new Error('denied'); } }));
});

test('music mood stub remembers the last valid mood', () => {
  assert.equal(setMusicMood('battle'), 'battle'); assert.equal(musicMood(), 'battle');
  assert.equal(setMusicMood('polka'), 'calm');
});

test('every new interface string has a Vietnamese entry', () => {
  const vi = JSON.parse(readFileSync(new URL('../src/locales/vi.json', import.meta.url), 'utf8'));
  const keys = new Set(Object.keys(vi.messages).map((k) => k.toLowerCase()));
  for (const text of ['Continue', 'Skip', 'Next', 'Back', 'Begin mission', 'Intel', 'Objectives', 'Optional', 'Comms log', 'No messages yet.', 'Dismiss message',
    'New objective', 'Victory', 'Defeat', 'Gold medal', 'Silver medal', 'Bronze medal', 'MISSION TIME', 'BEST TIME', 'Next mission', 'Retry', 'Campaign', 'COMPLETE', 'FAILED',
    'Clear the previous mission to unlock', 'Campaign missions', 'Every mission cleared. The campaign is complete.', 'The saved match could not be loaded and was removed.'])
    assert.ok(keys.has(text.toLowerCase()), `vi.json lacks: ${text}`);
  const patterns = vi.patterns.map(([source]) => new RegExp(source, 'i'));
  for (const text of ['Start mission 4', 'Mission 4 · Three-Way Dunes', 'CAMPAIGN · MISSION 04 / 12', 'MISSION 04', '12 missions', 'ACT 2', '3 more', '3 more in Comms log',
    '2/2 held', '1/1 arrived', '4:35 left', '2 left', 'Relay North captured', 'Relay North lost', 'Relay North taken by the enemy'])
    assert.ok(patterns.some((p) => p.test(text)), `vi.json has no pattern for: ${text}`);
});
