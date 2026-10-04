import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/tutorial.css', import.meta.url), 'utf8');
test('training container does not swallow taps', () => {
  assert.match(css, /#training\{[^}]*pointer-events:none/);
  assert.match(css, /#training-toggle,#training-card\{pointer-events:auto\}/);
});
test('training card clears toolbar and dock', () => {
  assert.match(css, /max-aspect-ratio:1\.35\)\{#training\{top:54px\}/);
  assert.match(css, /min-aspect-ratio:1\.35\)\{\.compact-ui #training\{top:96px;right:calc\(var\(--side-width/);
});
