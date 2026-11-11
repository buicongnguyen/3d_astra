// Safety net for the string-keyed catalogue (src/locales/vi.json): every English string the UI
// source renders as visible text must have a Vietnamese entry, or be listed as intentionally
// English below. The scan reads source files, so a new button, notice or label added without a
// translation fails here. (Strings built with ${...} are covered by the patterns and by the
// language browser suite.) See "Text and translation" in docs/ARCHITECTURE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { translate } from '../src/i18n.js';

const SRC = new URL('../src/', import.meta.url);
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) { if (!['locales', 'art', 'sim', 'story'].includes(entry.name)) walk(url); }
    else if (entry.name.endsWith('.js') && entry.name !== 'icons.js') files.push(url);
  }
})(SRC);

// Text that is the same in both languages on purpose: names, key labels, units, symbols.
const KEEP = new Set([
  // Shader source edited in view.js (bakeFinishes), not text on screen.
  '", "#include',
  'FRONTIER', 'COMMAND', 'FPS', '— FPS', 'HQ', 'AI', 'Eco', 'High', 'Q', 'E', 'R', 'T', 'Y', 'WASD', 'Esc', 'Tab', 'Shift', 'Ctrl', 'Ctrl + 1–9 / 1–9', 'Space / Esc', 'Frontier Command home',
]);
const isProse = (text) => /[A-Za-z]{3}/.test(text) && !/^[\w.#:/\\-]+$/.test(text) && !/[{}<>=;]|=>|\$\{/.test(text);
const clean = (text) => text.replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function strings(source) {
  const found = new Set();
  const add = (text) => { const t = clean(text); if (t && isProse(t) && !KEEP.has(t)) found.add(t); };
  // Text after a real HTML tag, and title / aria-label / placeholder attributes, in templates.
  for (const m of source.matchAll(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?>([^<>{}$`]*[A-Za-z]{3}[^<>{}$`]*)</g)) add(m[1]);
  for (const m of source.matchAll(/\b(?:title|aria-label|placeholder)="([^"${}]+)"/g)) add(m[1]);
  // Notices and text assigned from a plain string literal.
  for (const m of source.matchAll(/\b(?:notice|setStatus|announce)\(\s*(["'])((?:(?!\1).)+)\1/g)) add(m[2]);
  for (const m of source.matchAll(/\.textContent\s*=\s*(["'])((?:(?!\1).)+)\1/g)) add(m[2]);
  return found;
}

test('every English string the UI source renders has a Vietnamese entry', () => {
  const missing = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const text of strings(source)) {
      if (translate(text, 'vi') === text) missing.push(`${file.pathname.split('/src/')[1]}: ${text}`);
    }
  }
  assert.deepEqual(missing, [], `Add these to src/locales/vi.json (or KEEP in this test if they stay English):\n${missing.join('\n')}`);
});
