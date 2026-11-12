// Sample-level synthesis for the effect bank: pure JS (no Web Audio, no DOM), so it is unit-tested in
// Node (tests/audio-weight.test.js). A sound is a spec, rendered once per variant into a Float32Array
// at SYNTH_RATE and then played from an AudioBuffer: one buffer source + gain (+ pan) per play, so a
// big fight costs three nodes per sound instead of a graph of oscillators and filters.
//
// Spec: { level, len?, drive?, band?: [lowHz, highHz], room?: { combs: [[seconds, feedback]...], lp, mix }, layers }
// Layers (times in seconds, `at` = start, `a` = attack, `d` = decay time constant, `dur` = length):
//   { k: "tone",   w: sine|tri|saw|square, f0, f1, glide, at, a, d, dur, g, fm?: [ratio, depth], vib?: [hz, depth] }
//   { k: "noise",  f: lp|bp|hp|none, f0, f1, glide, q, at, a, d, dur, g }         white noise through a swept filter
//   { k: "grains", n, at, spread, len: [lo, hi], f: [lo, hi], q, g, skew }          debris rattle: short band-passed bursts
// Post: sum -> normalise -> soft clip (`drive`, adds harmonics so booms carry on small speakers) ->
// telephone band (`band`, radio) -> short outdoor room (`room`, feedback combs) -> DC block ->
// normalise to `level` (peak) -> fade out. Randomness comes from the seed (cosmetic, never the sim's).
import { mulberry32 } from "./audio-logic.js";

export const SYNTH_RATE = 24000;
const TAU = Math.PI * 2;

// TPT state-variable filter: stable under fast cutoff sweeps. `bp` is normalised to unit peak gain.
function makeFilter(mode, q = 0.707) {
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0, last = -1;
  const k = 1 / Math.max(0.1, q);
  return (x, fc, rate) => {
    if (fc !== last) {
      last = fc;
      const g = Math.tan((Math.PI * Math.max(10, Math.min(fc, rate * 0.45))) / rate);
      a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
    }
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return mode === "lp" ? v2 : mode === "bp" ? k * v1 : mode === "hp" ? x - k * v1 - v2 : x;
  };
}
const sweep = (f0, f1, glide, t) => (f1 === undefined || f1 === f0 || !(glide > 0) ? f0 : f0 * (f1 / f0) ** Math.min(1, t / glide));
function envelope(t, a, d, dur) {
  if (t < 0 || t >= dur) return 0;
  const v = t < a ? t / a : Math.exp(-(t - a) / d);
  return v * Math.min(1, (dur - t) / 0.004);
}
const layerEnd = (l) => (l.at || 0) + (l.k === "grains" ? l.spread + l.len[1] : l.dur ?? (l.d || 0.1) * 5);
const wave = (w, ph) => (w === "sine" ? Math.sin(TAU * ph) : w === "tri" ? 1 - 4 * Math.abs(ph - 0.5) : w === "saw" ? 2 * ph - 1 : ph < 0.5 ? 1 : -1);

function tone(out, l, rate, vary) {
  const start = Math.round((l.at || 0) * rate), dur = l.dur ?? l.d * 5, n = Math.min(out.length - start, Math.round(dur * rate));
  const f0 = l.f0 * vary, f1 = (l.f1 ?? l.f0) * vary, a = l.a ?? 0.001, d = l.d ?? 0.1, g = l.g ?? 1;
  let ph = 0, mph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let f = sweep(f0, f1, l.glide ?? dur, t);
    if (l.vib) f *= 1 + l.vib[1] * Math.sin(TAU * l.vib[0] * t);
    ph += f / rate; ph -= Math.floor(ph);
    let s;
    if (l.fm) { mph += (f * l.fm[0]) / rate; mph -= Math.floor(mph); s = Math.sin(TAU * ph + l.fm[1] * Math.sin(TAU * mph)); }
    else s = wave(l.w || "sine", ph);
    out[start + i] += s * envelope(t, a, d, dur) * g;
  }
}
function noise(out, l, rate, rnd, vary) {
  const start = Math.round((l.at || 0) * rate), dur = l.dur ?? l.d * 5, n = Math.min(out.length - start, Math.round(dur * rate));
  const f0 = (l.f0 ?? 1000) * vary, f1 = (l.f1 ?? l.f0 ?? 1000) * vary, a = l.a ?? 0.001, d = l.d ?? 0.1, g = l.g ?? 1;
  const filter = makeFilter(l.f || "none", l.q ?? 0.707);
  let fc = f0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    if ((i & 15) === 0) fc = sweep(f0, f1, l.glide ?? dur, t);
    out[start + i] += filter(rnd() * 2 - 1, fc, rate) * envelope(t, a, d, dur) * g;
  }
}
function grains(out, l, rate, rnd) {
  const [lo, hi] = l.len, [flo, fhi] = l.f, g = l.g ?? 0.4, skew = l.skew ?? 1.6;
  for (let j = 0; j < l.n; j++) {
    const t0 = (l.at || 0) + l.spread * rnd() ** skew, len = lo + (hi - lo) * rnd(), fc = flo * (fhi / flo) ** rnd();
    const amp = g * (0.4 + 0.6 * rnd()) * Math.exp(-(t0 - (l.at || 0)) / (l.spread * 0.45 + 1e-6));
    const filter = makeFilter("bp", l.q ?? 3), start = Math.round(t0 * rate), n = Math.min(out.length - start, Math.round(len * rate));
    for (let i = 0; i < n; i++) {
      const t = i / rate, e = t < 0.001 ? t / 0.001 : Math.exp(-(t - 0.001) / (len / 3));
      out[start + i] += filter(rnd() * 2 - 1, fc, rate) * e * amp;
    }
  }
}
function peakOf(x) { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; }
function scale(x, k) { for (let i = 0; i < x.length; i++) x[i] *= k; }

// Total length of a spec in seconds (layers plus the room's tail).
export function specLength(spec) {
  const base = spec.len ?? Math.max(...spec.layers.map(layerEnd));
  return Math.min(5, base + (spec.room ? spec.room.tail ?? 0.5 : 0) + 0.01);
}

export function renderSound(spec, { rate = SYNTH_RATE, seed = 1 } = {}) {
  const rnd = mulberry32(seed), length = Math.max(1, Math.round(specLength(spec) * rate)), out = new Float32Array(length);
  for (const l of spec.layers) {
    const vary = seed > 1 && spec.vary !== 0 ? 1 + (rnd() * 2 - 1) * (spec.vary ?? 0.03) : 1;
    if (l.k === "tone") tone(out, l, rate, vary);
    else if (l.k === "noise") noise(out, l, rate, rnd, vary);
    else if (l.k === "grains") grains(out, l, rate, rnd);
  }
  let p = peakOf(out);
  if (!(p > 0)) return out;
  scale(out, 1 / p);
  if (spec.drive) { const d = spec.drive, k = 1 / Math.tanh(d); for (let i = 0; i < length; i++) out[i] = Math.tanh(d * out[i]) * k; }
  if (spec.band) {
    const hp = makeFilter("hp", 0.707), lp = makeFilter("lp", 0.707);
    for (let i = 0; i < length; i++) out[i] = lp(hp(out[i], spec.band[0], rate), spec.band[1], rate);
  }
  if (spec.room) {
    const { combs, lp = 2000, mix = 0.35 } = spec.room, a = 1 - Math.exp((-TAU * lp) / rate), wet = new Float32Array(length);
    for (const [seconds, fb] of combs) {
      const D = Math.max(1, Math.round(seconds * rate)), y = new Float32Array(length);
      let s = 0;
      for (let i = D; i < length; i++) { s += a * (y[i - D] - s); y[i] = out[i - D] + fb * s; wet[i] += y[i] / combs.length; }
    }
    for (let i = 0; i < length; i++) out[i] += mix * wet[i];
  }
  // DC blocker (about 20 Hz), then the final level and a fade so no sound ends on a click.
  let x1 = 0, y1 = 0; const R = 1 - (TAU * 20) / rate;
  for (let i = 0; i < length; i++) { const y = out[i] - x1 + R * y1; x1 = out[i]; y1 = y; out[i] = y; }
  p = peakOf(out);
  if (p > 0) scale(out, (spec.level ?? 0.7) / p);
  // Trim the tail below -56 dB of the peak (keeps the bank small), then fade the last bit.
  let end = length - 1;
  const floor = (spec.level ?? 0.7) * 0.0015;
  while (end > 0 && Math.abs(out[end]) < floor) end--;
  const kept = Math.min(length, end + 1 + Math.round(0.01 * rate)), trimmed = kept < length ? out.slice(0, kept) : out;
  const fade = Math.min(kept, Math.round(Math.min(0.15, kept * 0.25 / rate) * rate));
  for (let i = 0; i < fade; i++) trimmed[kept - 1 - i] *= i / fade;
  return trimmed;
}

// A seamless one-second engine loop: every frequency is a whole number of cycles per second, and the
// noise is filtered twice around the loop so the filter state at the seam matches.
//   { f, harm: [[multiple, gain, wave]...], noise: [lowpassHz, gain], am: [hz, depth], whine: [[hz, gain]...], lp }
export function renderEngine(spec, { rate = SYNTH_RATE, seed = 3 } = {}) {
  const n = rate, out = new Float32Array(n), rnd = mulberry32(seed), white = new Float32Array(n);
  for (let i = 0; i < n; i++) white[i] = rnd() * 2 - 1;
  const nf = makeFilter("lp", 0.9), post = makeFilter("lp", 0.707);
  const [am, depth] = spec.am || [0, 0];
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const mod = 1 - depth + depth * (0.5 + 0.5 * Math.sin(TAU * am * t));
      let s = 0;
      for (const [m, g, w] of spec.harm || []) { const ph = (spec.f * m * t) % 1; s += wave(w || "sine", ph) * g; }
      for (const [hz, g] of spec.whine || []) s += Math.sin(TAU * ((hz * t) % 1)) * g;
      const nz = spec.noise ? nf(white[i], spec.noise[0], rate) * spec.noise[1] * 2.5 : 0;
      const y = post((s + nz) * mod, spec.lp || 1200, rate);
      if (pass === 1) out[i] = y;
    }
  let mean = 0; for (let i = 0; i < n; i++) mean += out[i] / n;
  for (let i = 0; i < n; i++) out[i] -= mean;
  const p = peakOf(out);
  if (p > 0) scale(out, 0.9 / p);
  return out;
}
