// Korean (한국어) catalogs mirror the Vietnamese ones: src/locales/ko.json has every message and
// pattern of vi.json (same keys, same regex sources, the same captured groups used), and
// src/locales/story-ko.json has every story entry of story-vi.json. Numbers, placeholders and proper
// names (transliterated, docs: LOCALIZATION.md glossary) carry over, every value is Korean, and the
// bundled Korean font (tools/subset-korean-font.py) covers every Hangul character the catalogs use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate, addMessages, setLanguage, getLanguage, LANGUAGES } from '../src/i18n.js';
import { storyStrings } from '../tools/story-strings.mjs';
import { normalize, defaults, saveSettings, loadSettings } from '../src/settings.js';
import { DEFINITIONS } from '../src/data.js';
import tutorial from '../src/tutorial-steps.json' with { type: 'json' };

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const vi = JSON.parse(read('locales/vi.json')), ko = JSON.parse(read('locales/ko.json'));
const storyVi = JSON.parse(read('locales/story-vi.json')), storyKo = JSON.parse(read('locales/story-ko.json'));
addMessages(storyKo, 'ko');
const hangul = /[가-힣]/;
const tokens = (text, pattern) => (text.match(pattern) || []).sort().join(' ');
// English proper names and their one Korean form (LOCALIZATION.md glossary).
// Chronicles round 2 (2026-11-24): Juno Rask (Wardens) and Teo Lind (Veil) joined the cast.
const NAMES = { Meridian: '메리디언', Ashfall: '애시폴', Sunward: '선워드', Wardens: '워든', Okoro: '오코로', Hale: '헤일', Maren: '마렌', Vale: '베일', Juno: '주노', Rask: '라스크', Teo: '테오', Lind: '린드' };
// Values that may stay without Hangul: symbols, numbers and kept Latin marks only.
const NO_HANGUL_OK = /^[\s\d{}·:/%+×x–—.,()\[\]#?!✓▲●◆→←↑↓-]*(ECHO|HQ|AI|FPS|MVP|m|L\d|I{1,3}|IV|Q|E|R|T|Y|WASD|Esc|Tab|Shift|Ctrl)?[\s\d{}·:/%+×x–—.,()\[\]#?!✓▲●◆→←↑↓-]*$/;

test('Korean is a language choice, saved like the others', () => {
  assert.equal(LANGUAGES.ko, '한국어');
  assert.equal(normalize({ version: 1, language: 'ko' }).language, 'ko');
  let stored;
  const storage = { setItem: (_, value) => (stored = value), getItem: () => stored };
  saveSettings({ ...defaults(), language: 'ko' }, storage);
  assert.equal(loadSettings(false, storage).language, 'ko');
  setLanguage('ko'); assert.equal(getLanguage(), 'ko'); assert.equal(translate('Start'), '시작');
  setLanguage('en'); assert.equal(translate('Start'), 'Start');
  assert.equal(translate('Start', 'vi'), 'Bắt đầu', 'the Vietnamese catalog is untouched');
});

test('ko.json has exactly the messages and patterns of vi.json', () => {
  assert.deepEqual(Object.keys(ko.messages), Object.keys(vi.messages));
  assert.deepEqual(ko.patterns.map(([source]) => source), vi.patterns.map(([source]) => source));
  for (const [i, [source, target]] of ko.patterns.entries()) {
    assert.doesNotThrow(() => new RegExp(source, 'i'), source);
    assert.equal(tokens(target, /\{\d+\}/g).split(' ').filter((t, k, a) => a.indexOf(t) === k).join(' '),
      tokens(vi.patterns[i][1], /\{\d+\}/g).split(' ').filter((t, k, a) => a.indexOf(t) === k).join(' '), `groups used: ${source}`);
  }
});

// Proper names alone have no Vietnamese entry (Vietnamese keeps them in Latin letters); Korean
// writes them in Hangul, so story-ko.json carries these extra name-only entries.
const NAME_ONLY = ['Meridian', 'Ashfall', 'Sunward', 'Wardens', 'Veil', 'Mira Vale', 'Vale', 'Tobi Okoro', 'Okoro', 'Corvin Hale', 'Hale', 'Tamsin Sol', 'Sol', 'Ilse Maren', 'Maren', 'Juno Rask', 'Teo Lind'];
test('story-ko.json has exactly the entries of story-vi.json, plus the names', () => {
  assert.deepEqual(Object.keys(storyKo.messages), [...Object.keys(storyVi.messages), ...NAME_ONLY]);
});

test('every Korean value is Korean, with the English numbers, placeholders and names', () => {
  const all = [...Object.entries(ko.messages), ...Object.entries(storyKo.messages)];
  for (const [en, kr] of all) {
    assert.ok(typeof kr === 'string' && kr.trim(), en);
    assert.ok(hangul.test(kr) || NO_HANGUL_OK.test(kr), `not Korean: ${en} -> ${kr}`);
    assert.equal(tokens(kr, /\d+(?::\d+)?/g), tokens(en, /\d+(?::\d+)?/g), `numbers: ${en} -> ${kr}`);
    assert.equal(tokens(kr, /\{\w*\}/g), tokens(en, /\{\w*\}/g), `placeholders: ${en}`);
  }
  for (const [en, kr] of Object.entries(storyKo.messages)) {
    for (const [name, korean] of Object.entries(NAMES)) if (new RegExp(`\\b${name}\\b`).test(en)) assert.ok(kr.includes(korean), `${korean} (${name}) in: ${kr}`);
    assert.doesNotMatch(kr, /\b(the|and|for|with|Commander|Captain|Director|Keystone|Lattice|Builders?|Caravan|Pact)\b/i, `English left in: ${kr}`);
  }
});

test('every story string and every unit, building and training step reads in Korean', () => {
  const SAME = new Set(['ECHO']);
  for (const { text, where } of storyStrings()) {
    if (SAME.has(text)) continue;
    assert.notEqual(translate(text, 'ko'), text, `${where}: ${text}`);
  }
  for (const d of Object.values(DEFINITIONS)) for (const key of ['name', 'description']) assert.notEqual(translate(d[key], 'ko'), d[key], `${d.name}: ${key}`);
  for (const step of tutorial) for (const field of ['title', 'desktop', 'touch']) assert.notEqual(translate(step[field], 'ko'), step[field]);
});

test('lines built from patterns come out whole in Korean', () => {
  const english = /(?<!\p{L})(alloy|energy|needs?|more|build|train|level|the|and)(?!\p{L})/iu;
  for (const line of ['Need 180 alloy and 90 energy more to build Foundry. Assign Harvesters to deposits.', 'Upgrade Barracks to level 2 to train Medic.']) {
    const out = translate(line, 'ko');
    assert.ok(hangul.test(out), out);
    assert.doesNotMatch(out, english, out);
  }
  assert.equal(translate('Q / E / R / T / Y', 'ko'), 'Q / E / R / T / Y');
  assert.equal(translate('9750', 'ko'), '9750');
});

test('the bundled Korean font covers every Hangul character of the catalogs', () => {
  const covered = new Set([...read('fonts/noto-sans-kr-chars.txt').trim()]);
  const used = new Set();
  for (const text of [...Object.values(ko.messages), ...ko.patterns.map(([, t]) => t), ...Object.values(storyKo.messages)]) {
    for (const ch of text) if (hangul.test(ch)) used.add(ch);
  }
  const missing = [...used].filter((ch) => !covered.has(ch));
  assert.deepEqual(missing, [], 'run: python tools/subset-korean-font.py <NotoSansKR[wght].ttf>');
  // Loaded only through the Korean stacks: no other stylesheet names the family.
  assert.match(read('language.css'), /font-family: "Frontier KR"/);
  assert.doesNotMatch(read('ui-theme.css'), /Frontier KR/);
});
