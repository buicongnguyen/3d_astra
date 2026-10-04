import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// main.js needs the DOM, so assert on its source text.
test('briefing base sentence is its own text node, not concatenated', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /briefing-text"\)\.replaceChildren\(/);
  assert.doesNotMatch(src, /rival commanders\."\s*\+\s*\r?\n/);
});
