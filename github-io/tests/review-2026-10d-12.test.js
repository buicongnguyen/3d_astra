import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README pan row covers every screen edge', () => {
  assert.doesNotMatch(readme, /left\/right\/top screen edges/);
  assert.match(readme, /any screen edge \(including over the console\)/);
});

test('README states relay supply scaling and core supply', () => {
  assert.match(readme, /relay adds 10 population capacity \(15 at L2, 20 at L3\)/);
  assert.match(readme, /Command core adds 15/);
});
