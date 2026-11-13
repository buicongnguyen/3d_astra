import { MIX } from "./audio-mix.js";
// Sound effects, all made in code (no audio files), two kinds:
//  * the rendered bank (sfx-bank.js + audio-synth.js): weapons, impacts, explosions, radio replies and
//    engine loops, rendered once into small AudioBuffers (2 variants each, warmed up in idle time) and
//    played with one buffer source + gain (+ pan) per play;
//  * live recipes (below) for UI, abilities and moments, short layers of oscillators and noise:
//      ["o", wave, hz0, hz1, seconds, volume, delay]            an oscillator gliding hz0 -> hz1
//      ["n", filter, hz0, hz1, seconds, volume, delay, q]       filtered noise sweeping hz0 -> hz1
// Every play gets a small random pitch/level variation (own seeded generator, never the simulation's),
// a stereo pan and a distance gain from its screen position, and must pass the voice budget (global
// cap, per-group caps, priority, per-sound rate limit). Nothing is created while effects are off.
import { VoiceBudget, audible, dbToGain, hitFor, incomingFor, mulberry32, nearPriority, screenMix, shouldCull, soundFor } from "./audio-logic.js";
import { BANK, ENGINE, radioSpec } from "./sfx-bank.js";
import { SYNTH_RATE, renderEngine, renderSound, specLength } from "./audio-synth.js";

const R = {
  // Support "shots" (beams, tools): light, kept live.
  "shot:support": [["o", "sine", 520, 880, 0.18, 0.28, 0], ["o", "sine", 780, 1320, 0.2, 0.18, 0.05]],
  "shot:engineer": [["n", "highpass", 5000, 3500, 0.09, 0.35, 0], ["o", "square", 120, 90, 0.06, 0.15, 0]],
  "shot:worker": [["o", "triangle", 640, 380, 0.05, 0.18, 0], ["n", "bandpass", 1800, 1200, 0.04, 0.2, 0]],
  // Construction, production, UI.
  construct: [["n", "bandpass", 2600, 2000, 0.04, 0.35, 0, 3], ["o", "square", 520, 500, 0.04, 0.15, 0], ["n", "bandpass", 2200, 1800, 0.04, 0.3, 0.12, 3]],
  complete: [["o", "triangle", 392, 392, 0.22, 0.4, 0], ["o", "triangle", 494, 494, 0.22, 0.4, 0.09], ["o", "triangle", 587, 587, 0.4, 0.45, 0.18], ["n", "highpass", 4000, 3000, 0.04, 0.2, 0.18]],
  research: [["o", "sine", 440, 880, 0.25, 0.3, 0], ["o", "triangle", 1320, 1320, 0.4, 0.3, 0.25]],
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
// Priority, rate limit and group for the effects that are not simulation events.
const EXTRA = { construct: [4, 0.15, "ui"], tap: [8, 0.03, "ui"], select: [7, 0.05, "ui"], error: [8, 0.1, "ui"], objective: [8, 0.2, "moment"], "objective-failed": [8, 0.2, "moment"], win: [10, 1, "moment"], lose: [10, 1, "moment"], blip: [7, 0.07, "ui"] };
const duration = (recipe) => recipe.reduce((m, l) => Math.max(m, l[4] + l[6]), 0);
export const SFX_NAMES = [...Object.keys(R), ...Object.keys(BANK)];
export const recipeFor = (name) => R[name] || BANK[name];
export const hasSound = (name) => Object.hasOwn(R, name) || Object.hasOwn(BANK, name);
// The big, rare explosions keep one rendering (pitch jitter varies them); everything else has two.
export const variantsFor = (name) => (name.startsWith("boom:") && name !== "boom:small" ? 1 : 2);
// The voice group of a bank sound played directly (sound tests, the voice-cap check).
export const groupOf = (name) => (name.startsWith("shot:") ? "weapon" : name.startsWith("impact:") ? "impact" : name.startsWith("hit:") || name.startsWith("boom:") ? "explosion" : "moment");
// A faction's weapons sound a little different (playback rate of the shared voices).
export const FACTION_TUNE = { meridian: 1, ashfall: 0.94, sunward: 1.05, wardens: 1.02, veil: 0.97 };

export class Sfx {
  constructor(context, out, { isVisible = () => true, project = null, seed = 20261110 } = {}) {
    this.context = context; this.out = out; this.isVisible = isVisible; this.project = project;
    this.rnd = mulberry32(seed); this.budget = new VoiceBudget(MIX.maxVoices, MIX.groupCaps);
    this.enabled = true; this.played = 0; this.dropped = 0; this.culled = 0;
    this.buffers = new Map(); this.rendered = 0;
    this.onPlay = null; // (name, gain, delay) for every effect heard; the director uses it for the music
    this.engineVoice = null;
    const n = context.sampleRate, buffer = context.createBuffer(1, n, context.sampleRate), data = buffer.getChannelData(0), r = mulberry32(99);
    for (let i = 0; i < n; i++) data[i] = r() * 2 - 1;
    this.noise = buffer;
  }
  // The rendered buffer for a bank sound (rendered now if the warm-up has not reached it yet).
  buffer(key, spec, variant = 0, engine = false) {
    const id = `${key}#${variant}`;
    let b = this.buffers.get(id);
    if (!b) {
      const data = engine ? renderEngine(spec, { seed: 3 + variant }) : renderSound(spec, { seed: 2 + variant * 7919 });
      b = this.context.createBuffer(1, data.length, SYNTH_RATE);
      b.getChannelData(0).set(data);
      this.buffers.set(id, b); this.rendered++;
    }
    return b;
  }
  // Renders the common bank sounds a few at a time while the browser is idle, so the first big fight
  // does not pay for it. The Command core blast renders when it is needed (the match ends there).
  warm() {
    if (this.warming) return;
    const queue = [];
    for (const name of Object.keys(BANK)) if (name !== "boom:core") for (let v = 0; v < variantsFor(name); v++) queue.push([name, v]);
    this.warming = true;
    const idle = globalThis.requestIdleCallback ? (f) => globalThis.requestIdleCallback(f, { timeout: 400 }) : (f) => setTimeout(f, 40);
    const step = () => {
      if (!queue.length) { this.warming = false; return; }
      const [name, v] = queue.shift();
      try { this.buffer(name, BANK[name], v); } catch { /* audio is optional */ }
      idle(step);
    };
    idle(step);
  }
  mixAt(x, z) { return this.project && Number.isFinite(x) && Number.isFinite(z) ? this.project(x, z) : { pan: 0, gain: 1 }; }
  // A simulation event: fog rule, then the sound for it (and, for heavy rounds, the explosion where
  // they land). Returns the distance gain of what was heard (0 = nothing).
  event(event, sim, sourceType = null) {
    if (!this.enabled) return 0;
    const sound = soundFor(event, sourceType);
    if (!sound || !hasSound(sound.name)) return 0;
    const isVisible = (p) => sim.isVisible(p, 0);
    let heard = 0;
    if (audible(event, isVisible, 0)) {
      const mix = this.mixAt(event.x, event.z);
      if (shouldCull(sound.group, mix.gain, sound.heavy)) this.culled++;
      else {
        const rate = sound.group === "weapon" ? FACTION_TUNE[sim.factions?.[event.team]] || 1 : 1;
        if (this.play(sound.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(sound.priority, mix.gain), gap: sound.gap, group: sound.group, rate })) heard = mix.gain;
      }
    }
    // A Barrage on its way: the incoming whistle where the shells will land, timed to end as they hit.
    // The player's own always; an enemy's only when that ground is in sight (fog rule).
    const incoming = incomingFor(event);
    if (incoming && (event.team === 0 || isVisible({ x: event.tx, z: event.tz }))) {
      const mix = this.mixAt(event.tx, event.tz);
      if (this.play(incoming.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(6, mix.gain), gap: 0.15, group: "moment", delay: incoming.delay })) heard = Math.max(heard, mix.gain);
    }
    const hit = event.type === "shot" ? hitFor(sound.name.slice(5)) : null;
    if (hit && Number.isFinite(event.tx) && Number.isFinite(event.tz) && (event.team === 0 || isVisible({ x: event.tx, z: event.tz }))) {
      const mix = this.mixAt(event.tx, event.tz);
      if (this.play(hit.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(4, mix.gain), gap: 0.06, group: "explosion", delay: hit.delay })) heard = Math.max(heard, mix.gain);
    }
    return heard;
  }
  play(name, { pan = 0, gain = 1, priority, gap, group, delay = 0, rate = 1 } = {}) {
    if (!this.enabled) return false;
    if (Object.hasOwn(BANK, name)) return this.playBank(name, BANK[name], { pan, gain, priority: priority ?? 3, gap: gap ?? 0, group: group ?? groupOf(name), delay, rate });
    const recipe = R[name], ctx = this.context;
    if (!recipe) return false;
    const extra = EXTRA[name];
    priority ??= extra?.[0] ?? 3; gap ??= extra?.[1] ?? 0; group ??= extra?.[2] ?? (name.startsWith("shot:") ? "weapon" : "moment");
    const now = ctx.currentTime, got = this.budget.tryAcquire(name, priority, now, duration(recipe) + 0.05, gap, group);
    if (!got) { this.dropped++; return false; }
    got.stolen?.stop?.();
    const pitch = 1 + (this.rnd() * 2 - 1) * MIX.pitchVariation, level = gain * (0.9 + this.rnd() * 0.2);
    let dest = this.out, panner = null;
    if (pan && ctx.createStereoPanner) { panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(this.out); dest = panner; }
    for (const layer of recipe) this.layer(layer, now + delay, pitch, level * 0.5, dest);
    this.played++;
    this.onPlay?.(name, gain, delay);
    return true;
  }
  playBank(key, spec, { pan, gain, priority, gap, group, delay, rate }, variants = variantsFor(key)) {
    const ctx = this.context, now = ctx.currentTime, variant = variants > 1 ? Math.floor(this.rnd() * variants) % variants : 0;
    const pitch = Math.max(0.5, rate * (1 + (this.rnd() * 2 - 1) * MIX.pitchVariation));
    const cached = this.buffers.get(`${key}#${variant}`), length = cached ? cached.duration : specLength(spec);
    const got = this.budget.tryAcquire(key, priority, now, delay + length / pitch, gap, group);
    if (!got) { this.dropped++; return false; }
    got.stolen?.stop?.();
    const buffer = cached || this.buffer(key, spec, variant);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffer; src.playbackRate.value = pitch;
    g.gain.value = MIX.bankLevel * gain * dbToGain((this.rnd() * 2 - 1) * MIX.gainJitterDb);
    let panner = null;
    src.connect(g);
    if (pan && ctx.createStereoPanner) { panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(panner); panner.connect(this.out); }
    else g.connect(this.out);
    src.start(now + delay);
    got.voice.stop = () => { try { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.015); src.stop(t + 0.08); } catch { /* already stopped */ } };
    src.onended = () => { src.disconnect(); g.disconnect(); panner?.disconnect(); };
    this.played++;
    this.onPlay?.(key, gain, delay);
    return true;
  }
  // A radio reply in the player's ear (not panned): `kind` move | attack | build | contact, in the
  // faction's tone motif. The rate limit is the caller's (RadioGate in audio-logic.js).
  radio(kind, faction = "meridian") {
    if (!this.enabled) return false;
    const key = `radio:${faction}:${kind}`;
    return this.playBank(key, radioSpec(kind, faction), { pan: 0, gain: MIX.radio.level, priority: 8, gap: 0, group: "radio", delay: 0, rate: 1 }, 1);
  }
  // Engine hum: one looping voice for the player's vehicles. Called a few times a second; level 0
  // fades it out and, after two quiet seconds, stops the loop so it costs nothing.
  engine(level, rate = 1, faction = "meridian") {
    const ctx = this.context, now = ctx.currentTime, e = this.engineVoice;
    if (!this.enabled || !(level > 0.001)) {
      if (!e) return;
      e.gain.gain.setTargetAtTime(0, now, 0.3);
      e.quietSince ??= now;
      if (now - e.quietSince > 2) { try { e.src.stop(); } catch { /* stopped */ } this.engineVoice = null; }
      return;
    }
    if (!e || e.faction !== faction) {
      if (e) { try { e.src.stop(now + 0.3); } catch { /* stopped */ } e.gain.gain.setTargetAtTime(0, now, 0.1); }
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = this.buffer(`engine:${faction}`, ENGINE[faction] || ENGINE.meridian, 0, true); src.loop = true;
      gain.gain.value = 0; src.connect(gain); gain.connect(this.out); src.start(now, this.rnd() * 0.9);
      src.onended = () => { src.disconnect(); gain.disconnect(); };
      this.engineVoice = { src, gain, faction, quietSince: null };
    }
    const v = this.engineVoice;
    v.quietSince = null;
    v.gain.gain.setTargetAtTime(level * MIX.engine.level, now, 0.35);
    v.src.playbackRate.setTargetAtTime(rate, now, 0.5);
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
