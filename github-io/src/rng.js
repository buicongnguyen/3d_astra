// The one shared seeded generator and text hash (mulberry32 and FNV-1a). Pure, no DOM, no Math.random.
// Used by the scatter, ambient life, audio and cosmetic effects. The simulation's own copies in
// src/sim/defence.js (`seeded`, `seedOf`) give identical output (tests/rng.test.js pins it).

// Text to an unsigned 32-bit hash (FNV-1a).
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// A seeded generator returning floats in [0, 1) (mulberry32).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
