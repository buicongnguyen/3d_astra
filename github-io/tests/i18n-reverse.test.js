// Reverse of i18n-coverage: every message in src/locales/vi.json must still match text somewhere in
// the game (source, markup, data json), so a renamed or deleted string cannot leave a dead entry
// behind. Matching is the catalog's own (trimmed, whitespace collapsed, case-insensitive); a key may
// be a clause inside a longer source string. Strings built in a template literal (`Hold the Heroic
// ${n} waves`) count as present when the key fits the template with each ${...} as a wildcard.
// Patterns are checked for a valid regex only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const GAME = new URL('../', import.meta.url);
const norm = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const unescape = (text) => text
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\(["'`])/g, '$1').replace(/\\n/g, ' ')
  .replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);

let corpus = '';
const templates = [];
function read(url) {
  const raw = readFileSync(url, 'utf8');
  corpus += '\n' + norm(unescape(raw));
  if (!/\.m?js$/.test(url.pathname)) return;
  for (const m of raw.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    if (!m[1].includes('${')) continue;
    const parts = m[1].split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/).map((part) => norm(unescape(part)));
    if (parts.join('').length < 8) continue;
    templates.push(new RegExp('^' + parts.map(escapeRe).join('.{0,60}?') + '$'));
  }
}
function walk(dir, skipLocale) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) walk(url, skipLocale);
    else if (/\.(js|mjs|json|html)$/.test(entry.name) && !/locales\/vi\.(js|json)$/.test(url.pathname)) read(url);
  }
}
walk(new URL('src/', GAME));
read(new URL('index.html', GAME));
if (existsSync(new URL('public/', GAME))) walk(new URL('public/', GAME));

const catalog = JSON.parse(readFileSync(new URL('src/locales/vi.json', GAME), 'utf8'));
// Kept on purpose: tests/terrain-rules.test.js asserts that this text has a Vietnamese entry.
const KEEP = new Set(["Can't see up there: send a unit up the ramp first"]);
const alive = (key) => {
  if (KEEP.has(key)) return true;
  const n = norm(key);
  return corpus.includes(n) || templates.some((re) => re.test(n));
};

test('every vi.json message still matches a string in the game', () => {
  const stale = Object.keys(catalog.messages).filter((key) => !alive(key));
  assert.deepEqual(stale, [], `Remove these from src/locales/vi.json (or restore the English text that used them):\n${stale.join('\n')}`);
});

test('every vi.json pattern is a valid regular expression with a target', () => {
  for (const [source, target] of catalog.patterns) {
    assert.doesNotThrow(() => new RegExp(source, 'i'), source);
    assert.ok(typeof target === 'string' && target.length, source);
  }
});
