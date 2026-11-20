import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, fnv1a } from '../src/rng.js';
import { mulberry32 as audioRng, hashString } from '../src/audio-logic.js';
import { seeded, seedOf } from '../src/sim/defence.js';
import maps from '../src/maps.json' with { type: 'json' };

// The copies the shared module replaced, kept here verbatim as the reference.
function legacyScatterRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const legacyHashId = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
function legacySnapshotHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function legacyAudioHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const seeds = [0, 1, 7, 99, 1482, 0x5ca77e2, 0xdeadbeef, 4294967295, -5, 3.7];
test('mulberry32 equals the scatter, audio and Defence generators', () => {
  for (const seed of seeds) {
    const a = mulberry32(seed), b = legacyScatterRng(seed), c = audioRng(seed), d = seeded(seed);
    for (let i = 0; i < 200; i++) { const v = a(); assert.equal(v, b()); assert.equal(v, c()); assert.equal(v, d()); }
  }
});

test('fnv1a equals the snapshot, audio, scatter and Defence hashes on 1,000 strings and every map id', () => {
  const strings = [...Object.keys(maps), '', 'frontier-daily:2026-11-20'];
  const r = mulberry32(42);
  for (let i = 0; strings.length < 1000; i++) strings.push(Array.from({ length: Math.floor(r() * 40) }, () => String.fromCharCode(32 + Math.floor(r() * 400))).join(''));
  for (const s of strings) {
    const h = fnv1a(s);
    assert.equal(h, seedOf(s));
    assert.equal(h, hashString(s));
    assert.equal(h, legacyAudioHash(s));
    assert.equal(h.toString(16).padStart(8, '0'), legacySnapshotHash(s));
    assert.equal((h ^ 0x5ca77e2) >>> 0, (legacyHashId(s) ^ 0x5ca77e2) >>> 0);
    assert.equal(mulberry32(h)(), legacyScatterRng(legacyHashId(s))());
  }
});
