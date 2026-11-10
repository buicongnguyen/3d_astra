// Synthesised sound effects (no audio files). Each effect is a short recipe of layers:
//   ["o", wave, hz0, hz1, seconds, volume, delay]            an oscillator gliding hz0 -> hz1
//   ["n", filter, hz0, hz1, seconds, volume, delay, q]       filtered noise sweeping hz0 -> hz1
// Every play gets a small random pitch/volume variation (own seeded generator, never the
// simulation's), a stereo pan and a distance gain from its screen position, and must pass the
// voice budget (priority + per-sound rate limit). Nothing is created while muted.
import { VoiceBudget, audible, mulberry32, screenMix, soundFor } from "./audio-logic.js";

const R = {
  // Weapons, one signature per weapon identity.
  "shot:vanguard": [["n", "bandpass", 2400, 900, 0.07, 0.5, 0, 1.2], ["o", "square", 190, 85, 0.06, 0.25, 0]],
  "shot:ranger": [["n", "highpass", 4200, 2500, 0.05, 0.4, 0], ["o", "sawtooth", 820, 190, 0.13, 0.3, 0], ["o", "sine", 2800, 1500, 0.04, 0.12, 0.01]],
  "shot:tank": [["o", "sine", 120, 38, 0.32, 0.9, 0], ["n", "lowpass", 1200, 150, 0.28, 0.7, 0], ["o", "square", 340, 110, 0.05, 0.25, 0.02]],
  "shot:breaker": [["n", "bandpass", 300, 1500, 0.42, 0.55, 0, 0.9], ["o", "sine", 78, 34, 0.45, 0.8, 0], ["o", "sawtooth", 160, 60, 0.2, 0.2, 0.03]],
  "shot:antitank": [["n", "bandpass", 900, 3200, 0.22, 0.45, 0, 1.4], ["o", "sawtooth", 360, 1100, 0.18, 0.18, 0], ["o", "sine", 100, 45, 0.18, 0.55, 0.12]],
  "shot:tower": [["o", "triangle", 1100, 260, 0.2, 0.4, 0], ["n", "highpass", 3000, 1400, 0.12, 0.3, 0], ["o", "sine", 2200, 2200, 0.03, 0.12, 0]],
  "shot:support": [["o", "sine", 520, 880, 0.18, 0.28, 0], ["o", "sine", 780, 1320, 0.2, 0.18, 0.05]],
  "shot:engineer": [["n", "highpass", 5000, 3500, 0.09, 0.35, 0], ["o", "square", 120, 90, 0.06, 0.15, 0]],
  "shot:worker": [["o", "triangle", 640, 380, 0.05, 0.18, 0], ["n", "bandpass", 1800, 1200, 0.04, 0.2, 0]],
  // Impacts and explosions.
  "impact:body": [["n", "lowpass", 1800, 300, 0.08, 0.5, 0], ["o", "sine", 160, 70, 0.07, 0.4, 0]],
  "impact:building": [["n", "bandpass", 900, 260, 0.14, 0.55, 0, 0.8], ["o", "square", 210, 90, 0.07, 0.25, 0]],
  "impact:shield": [["o", "sine", 1500, 900, 0.18, 0.3, 0], ["o", "sine", 2250, 1350, 0.14, 0.15, 0.01], ["n", "highpass", 5000, 3000, 0.05, 0.18, 0]],
  "boom:small": [["o", "sine", 110, 40, 0.28, 0.7, 0], ["n", "lowpass", 2400, 200, 0.3, 0.7, 0]],
  "boom:heavy": [["o", "sine", 85, 28, 0.55, 1, 0], ["n", "lowpass", 2000, 120, 0.6, 0.8, 0], ["n", "bandpass", 700, 200, 0.25, 0.4, 0.05, 0.7]],
  "boom:building": [["o", "sine", 70, 24, 0.9, 1, 0], ["n", "lowpass", 1600, 90, 1, 0.85, 0], ["n", "bandpass", 500, 140, 0.5, 0.45, 0.2, 0.6], ["o", "sine", 55, 30, 0.6, 0.5, 0.3]],
  "boom:strike": [["o", "sine", 95, 30, 0.6, 1, 0], ["n", "lowpass", 2600, 140, 0.55, 0.9, 0], ["n", "highpass", 4000, 1500, 0.2, 0.3, 0]],
  // Construction, production, UI.
  construct: [["n", "bandpass", 2600, 2000, 0.04, 0.35, 0, 3], ["o", "square", 520, 500, 0.04, 0.15, 0], ["n", "bandpass", 2200, 1800, 0.04, 0.3, 0.12, 3]],
  complete: [["o", "triangle", 392, 392, 0.22, 0.4, 0], ["o", "triangle", 494, 494, 0.22, 0.4, 0.09], ["o", "triangle", 587, 587, 0.4, 0.45, 0.18], ["n", "highpass", 4000, 3000, 0.04, 0.2, 0.18]],
  trained: [["o", "sine", 660, 660, 0.1, 0.35, 0], ["o", "sine", 880, 880, 0.16, 0.35, 0.07]],
  tap: [["o", "sine", 1150, 760, 0.045, 0.3, 0]],
  select: [["o", "sine", 700, 700, 0.05, 0.25, 0], ["o", "sine", 940, 940, 0.05, 0.2, 0.04]],
  error: [["o", "square", 150, 120, 0.14, 0.25, 0], ["o", "square", 140, 110, 0.14, 0.2, 0.08]],
  // Abilities.
  "ability:shieldwall": [["o", "sine", 300, 900, 0.5, 0.4, 0], ["o", "triangle", 450, 1350, 0.45, 0.2, 0.05], ["n", "bandpass", 800, 3000, 0.4, 0.2, 0, 2]],
  "ability:focus": [["o", "sine", 1760, 1760, 0.3, 0.3, 0], ["n", "highpass", 1500, 5000, 0.18, 0.18, 0], ["o", "sine", 880, 880, 0.2, 0.2, 0.04]],
  "ability:barrage": [["n", "bandpass", 250, 2200, 0.7, 0.55, 0, 0.8], ["o", "sine", 70, 40, 0.5, 0.7, 0], ["o", "sawtooth", 140, 600, 0.5, 0.12, 0.05]],
  "ability:overdrive": [["o", "sawtooth", 70, 420, 0.7, 0.3, 0], ["o", "square", 105, 630, 0.6, 0.12, 0.05], ["n", "lowpass", 400, 3000, 0.6, 0.25, 0]],
  "ability:lockon": [["o", "square", 1900, 1900, 0.05, 0.2, 0], ["o", "square", 1900, 1900, 0.05, 0.2, 0.12], ["o", "sine", 2400, 2400, 0.3, 0.25, 0.24]],
  "ability:triage": [["o", "sine", 523, 523, 0.2, 0.3, 0], ["o", "sine", 659, 659, 0.2, 0.3, 0.1], ["o", "sine", 784, 784, 0.35, 0.3, 0.2]],
  "ability:fortify": [["o", "square", 110, 60, 0.12, 0.4, 0], ["n", "bandpass", 1500, 300, 0.2, 0.4, 0, 2], ["o", "triangle", 220, 440, 0.4, 0.25, 0.1]],
  // Moments.
  promote: [["o", "triangle", 523, 523, 0.15, 0.4, 0], ["o", "triangle", 659, 659, 0.15, 0.4, 0.1], ["o", "triangle", 784, 784, 0.15, 0.4, 0.2], ["o", "sine", 1568, 1568, 0.5, 0.35, 0.3], ["o", "sine", 4331, 4331, 0.4, 0.1, 0.3]],
  capture: [["o", "triangle", 440, 440, 0.15, 0.4, 0], ["o", "triangle", 554, 554, 0.15, 0.4, 0.1], ["o", "triangle", 660, 660, 0.4, 0.45, 0.2]],
  lost: [["o", "triangle", 392, 392, 0.2, 0.4, 0], ["o", "triangle", 311, 311, 0.2, 0.4, 0.14], ["o", "triangle", 247, 247, 0.5, 0.45, 0.28]],
  alarm: [["o", "square", 440, 440, 0.18, 0.2, 0], ["o", "square", 330, 330, 0.18, 0.2, 0.22], ["o", "square", 440, 440, 0.18, 0.2, 0.44]],
  objective: [["o", "sine", 784, 784, 0.12, 0.4, 0], ["o", "sine", 1175, 1175, 0.4, 0.4, 0.1], ["o", "sine", 2349, 2349, 0.3, 0.1, 0.1]],
  "objective-failed": [["o", "triangle", 220, 175, 0.4, 0.45, 0], ["o", "triangle", 165, 130, 0.5, 0.4, 0.2]],
  win: [["o", "triangle", 523, 523, 0.18, 0.4, 0], ["o", "triangle", 659, 659, 0.18, 0.4, 0.15], ["o", "triangle", 784, 784, 0.18, 0.4, 0.3], ["o", "triangle", 1047, 1047, 0.8, 0.5, 0.45], ["o", "sine", 2093, 2093, 0.7, 0.15, 0.45]],
  lose: [["o", "triangle", 330, 330, 0.3, 0.4, 0], ["o", "triangle", 262, 262, 0.3, 0.4, 0.28], ["o", "triangle", 196, 196, 0.9, 0.5, 0.56], ["o", "sine", 98, 98, 0.9, 0.4, 0.56]],
  blip: [["o", "sine", 520, 520, 0.065, 0.4, 0]],
};
// Priority and rate limit for the effects that are not simulation events.
const EXTRA = { construct: [4, 0.15], tap: [8, 0.03], select: [7, 0.05], error: [8, 0.1], objective: [8, 0.2], "objective-failed": [8, 0.2], win: [10, 1], lose: [10, 1], blip: [7, 0.07] };
const duration = (recipe) => recipe.reduce((m, l) => Math.max(m, l[4] + l[6]), 0);
export const SFX_NAMES = Object.keys(R);
export const recipeFor = (name) => R[name];

export class Sfx {
  constructor(context, out, { isVisible = () => true, project = null, seed = 20261110 } = {}) {
    this.context = context; this.out = out; this.isVisible = isVisible; this.project = project;
    this.rnd = mulberry32(seed); this.budget = new VoiceBudget(14);
    this.enabled = true; this.played = 0; this.dropped = 0;
    const n = context.sampleRate, buffer = context.createBuffer(1, n, context.sampleRate), data = buffer.getChannelData(0), r = mulberry32(99);
    for (let i = 0; i < n; i++) data[i] = r() * 2 - 1;
    this.noise = buffer;
  }
  // A simulation event: fog rule, then the sound for it. `pos` mixing comes from the screen.
  event(event, sim) {
    if (!this.enabled) return false;
    const sound = soundFor(event);
    if (sound && !R[sound.name] && sound.name.startsWith("shot:")) sound.name = sound.name === "shot:medic" ? "shot:support" : "shot:vanguard";
    if (!sound || !R[sound.name] || !audible(event, (p) => sim.isVisible(p, 0), 0)) return false;
    const mix = this.project && Number.isFinite(event.x) ? this.project(event.x, event.z) : null;
    return this.play(sound.name, { pan: mix?.pan, gain: mix?.gain, priority: sound.priority, gap: sound.gap });
  }
  play(name, { pan = 0, gain = 1, priority, gap } = {}) {
    const recipe = R[name], ctx = this.context;
    if (!this.enabled || !recipe) return false;
    const extra = EXTRA[name];
    priority ??= extra?.[0] ?? 3; gap ??= extra?.[1] ?? 0;
    const now = ctx.currentTime, got = this.budget.tryAcquire(name, priority, now, duration(recipe) + 0.05, gap);
    if (!got) { this.dropped++; return false; }
    const pitch = 1 + (this.rnd() - 0.5) * 0.12, level = gain * (0.9 + this.rnd() * 0.2);
    let dest = this.out, panner = null;
    if (pan && ctx.createStereoPanner) { panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(this.out); dest = panner; }
    for (const layer of recipe) this.layer(layer, now, pitch, level * 0.5, dest);
    this.played++;
    return true;
  }
  layer([kind, a, f0, f1, secs, vol, delay = 0, q = 1], now, pitch, level, dest) {
    const ctx = this.context, t = now + delay, g = ctx.createGain(), peak = Math.max(0.0002, vol * level);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.006, secs / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    g.connect(dest);
    const f = (hz) => Math.max(20, hz * pitch);
    if (kind === "o") {
      const o = ctx.createOscillator();
      o.type = a; o.frequency.setValueAtTime(f(f0), t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f(f1), t + secs);
      o.connect(g); o.start(t); o.stop(t + secs + 0.02);
    } else {
      const s = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      s.buffer = this.noise; filter.type = a; filter.Q.value = q;
      filter.frequency.setValueAtTime(f(f0), t);
      if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f(f1), t + secs);
      s.connect(filter); filter.connect(g);
      s.start(t, this.rnd() * 0.6, secs + 0.02);
    }
  }
}
export { screenMix };
