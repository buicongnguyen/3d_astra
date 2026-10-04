import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The camera focus assert in stages.mjs was once swallowed by a trailing // comment.
test('stages.mjs focus assertion is not inside a line comment', () => {
  const src = readFileSync(new URL('./stages.mjs', import.meta.url), 'utf8');
  for (const line of src.split(/\r?\n/)) {
    const i = line.indexOf('//');
    if (i < 0 || /https?:\/\//.test(line)) continue;
    assert.ok(!/assert\./.test(line.slice(i)), 'assert hidden in comment: ' + line.trim());
  }
  assert.ok(/^\s*assert\.ok\(Math\.abs\(state\.focus-/m.test(src));
});
