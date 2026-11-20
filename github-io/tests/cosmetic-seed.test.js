import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Source-text test (these files need WebGL or Web Audio): cosmetic code draws from a seeded generator.
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('no Math.random in fx.js, fx-kinds, view.js, scatter.js, ambient-life.js or ambience.js', () => {
  const files = ['../src/fx.js', '../src/view.js', '../src/scatter.js', '../src/ambient-life.js', '../src/ambience.js',
    ...readdirSync(new URL('../src/fx-kinds/', import.meta.url)).map((f) => `../src/fx-kinds/${f}`)];
  for (const f of files) assert.doesNotMatch(code(read(f)), /Math\.random/, f);
});

test('the view reseeds the effects generator in reset() and the module generator in createTerrain()', () => {
  const view = read('../src/view.js');
  assert.match(view, /reset\(\) \{\s*this\.fx\.rng = mulberry32\(1482\)/);
  assert.match(view, /createTerrain\(\) \{\s*cosmetic = mulberry32\(1482\)/);
});

test('no file keeps its own copy of mulberry32 or FNV-1a', () => {
  for (const f of ['scatter', 'ambient-life', 'audio-logic', 'audio-synth', 'music', 'sfx', 'snapshot']) {
    assert.doesNotMatch(read(`../src/${f}.js`), /0x6d2b79f5|0x01000193|16777619/i, f);
  }
});
