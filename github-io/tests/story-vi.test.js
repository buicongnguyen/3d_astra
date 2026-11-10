// The campaign story in Vietnamese: every string the mission interface shows (walked the same
// way the interface reads the data, tools/story-strings.mjs) has an entry in
// src/locales/story-vi.json, with the same numbers and proper names as the English source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate, addMessages } from '../src/i18n.js';
import { storyStrings } from '../tools/story-strings.mjs';
import { MISSIONS } from '../src/story/missions.js';
import { objectiveProgress, pointLabel } from '../src/mission-text.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../src/locales/${name}`, import.meta.url), 'utf8'));
const main = read('vi.json'), story = read('story-vi.json');
const lower = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const mainKeys = new Set(Object.keys(main.messages).map(lower));
// Proper names are the same in both languages.
const NAMES = ['Meridian', 'Ashfall', 'Sunward', 'Veil', 'Wardens', 'Vale', 'Okoro', 'Hale', 'Sol', 'Maren', 'ECHO'];
// Strings that are only a proper name, so they have no entry and read the same.
const SAME = new Set(['Meridian', 'Ashfall', 'Sunward', 'Wardens', 'Mira Vale', 'Tobi Okoro', 'Corvin Hale', 'Tamsin Sol', 'Ilse Maren', 'ECHO', 'Okoro']);
const strings = storyStrings();
addMessages(story);

test('every story string has a Vietnamese entry', () => {
  assert.ok(strings.length > 300, 'the walk found the story');
  const missing = strings.filter(({ text }) => !SAME.has(text) && !Object.hasOwn(story.messages, text) && !mainKeys.has(lower(text)));
  assert.deepEqual(missing.map((s) => `${s.where}: ${s.text}`), []);
  for (const { text, where } of strings) {
    const out = translate(text, 'vi');
    if (SAME.has(text)) assert.equal(out, text, where);
    else assert.notEqual(out, text, `${where}: ${text}`);
  }
});

test('the story catalog has no stale, empty or duplicated entries', () => {
  const live = new Set(strings.map((s) => s.text));
  assert.deepEqual(Object.keys(story.messages).filter((key) => !live.has(key)), [], 'entries whose English text is no longer in the story');
  assert.deepEqual(Object.keys(story.messages).filter((key) => mainKeys.has(lower(key))), [], 'entries the main catalog already has');
  for (const [key, value] of Object.entries(story.messages)) assert.ok(typeof value === 'string' && value.trim() && value !== key, key);
  assert.equal(new Set(Object.keys(story.messages).map(lower)).size, Object.keys(story.messages).length, 'keys differ by more than case');
});

test('numbers, clock times, placeholders and proper names match the English text', () => {
  const tokens = (text, pattern) => (text.match(pattern) || []).sort().join(' ');
  for (const [en, vi] of Object.entries(story.messages)) {
    assert.equal(tokens(vi, /\d+(?::\d+)?/g), tokens(en, /\d+(?::\d+)?/g), `numbers: ${en}`);
    assert.equal(tokens(vi, /\{\w*\}/g), tokens(en, /\{\w*\}/g), `placeholders: ${en}`);
    for (const name of NAMES) if (new RegExp(`\\b${name}\\b`).test(en)) assert.ok(new RegExp(`(^|[^\\p{L}])${name}($|[^\\p{L}])`, 'u').test(vi), `${name} kept in: ${en}`);
    assert.doesNotMatch(vi, /\b(the|and|for|with|minutes?|seconds?|relay|oasis|Commander|Captain|Director|Keystone|Lattice|Builders?|Crown|Caravan|Pact)\b/i, `English left in: ${vi}`);
  }
});

test('every pattern of the main catalog uses only groups its English side captures', () => {
  for (const [source, target] of main.patterns) {
    const groups = new RegExp(`${source}|`).exec('').length - 1;
    for (const [, index] of target.matchAll(/\{(\d+)\}/g)) assert.ok(Number(index) >= 1 && Number(index) <= groups, `${source} -> ${target}`);
  }
});

test('lines built from story text and numbers come out whole in Vietnamese', () => {
  assert.equal(translate('Mission 4 · Three-Way Dunes', 'vi'), 'Nhiệm vụ 4 · Ba phe trên đồi cát');
  assert.equal(translate('Builder relay captured', 'vi'), 'Đã chiếm Trạm Kiến Tạo');
  assert.equal(translate('Crown relay taken by the enemy', 'vi'), 'Địch đã chiếm Trạm Vương Miện');
  assert.equal(translate('Copper seam lost', 'vi'), 'Đã mất Vỉa đồng');
  // Capture toasts and the live progress under each kind of objective.
  const english = /(?<!\p{L})(held|arrived|left|captured|lost|taken|enemy|relay|oasis|seam|crown|copper|north|east|centre|builder|by|the)(?!\p{L})/iu;
  for (const m of MISSIONS) {
    for (const s of m.setup || []) if (s.capturePoint) {
      assert.ok(s.label || m.regions?.[s.capturePoint]?.label, `${m.id}: capture point ${s.capturePoint} has a label`);
      for (const tail of ['captured', 'lost', 'taken by the enemy']) {
        const out = translate(`${pointLabel(m, s.capturePoint)} ${tail}`, 'vi');
        assert.doesNotMatch(out, english, out);
      }
    }
    for (const o of m.objectives) {
      const live = { ...o, state: 'active', have: 1, held: 75, need: o.need ?? o.count ?? 1, seconds: o.seconds ?? 0 };
      const out = translate(objectiveProgress(live, 3), 'vi');
      assert.doesNotMatch(out, english, `${m.id} ${o.id}: ${out}`);
    }
  }
});
