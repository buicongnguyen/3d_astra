import test from 'node:test';
import assert from 'node:assert/strict';
import {clientFile} from './lib/client-source.js';

// The client needs the DOM, so assert on the source text of src/app/briefing.js (split from main.js in 0.8.0).
test('briefing base sentence is its own text node, not concatenated', () => {
  const src = clientFile('briefing.js');
  assert.match(src, /briefing-text"\)\.replaceChildren\(/);
  assert.doesNotMatch(src, /rival commanders\."\s*\+\s*\r?\n/);
});
