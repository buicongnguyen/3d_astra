// Adaptive score, synthesised with Web Audio (no audio files). The notes come from
// composeBar() in audio-logic.js, which is deterministic per (map, mood, faction, bar); this
// file only plays them. It schedules ahead of the audio clock from a slow timer and stops its timer
// when silent, so it costs a few dozen short-lived nodes a second.
//
// Layers: the field moods share the map's tempo. A base layer (calm, or tense under a fight) always
// plays; the combat layer (drums, driving bass, string ostinato, stabs) plays on top of it and its
// level follows combat intensity (setCombat, from the director), so music swells into a fight and
// fades back after it. Victory and defeat are stings that replace both. A short reverb made from a
// generated impulse gives the score a room.
import { FIELD_MOODS, MISSION_MOODS, MOODS, baseMood, composeBar, flavourFor, midiToHz, mulberry32, tempoFor } from "./audio-logic.js";
import { MIX } from "./audio-mix.js";

// Mood a mission asked for (the `music` action). main.js merges it with the live match state.
let requested = "calm";
export function setMusicMood(next) {
  requested = MISSION_MOODS.includes(next) ? next : "calm";
  return requested;
}
export const musicMood = () => requested;

const LOOKAHEAD = 1.6, TIMER_MS = 250;
const LAYER_GAIN = { calm: 1, tense: 0.95, battle: 0.9, victory: 1, defeat: 1 };
const REVERB = { seconds: 1.6, wet: 0.18 };

// The shared output graph: music and effects buses -> master -> glue compressor -> ceiling limiter
// -> speakers. Levels come from the settings (busLevels in audio-logic.js).
export function createAudioBus(context) {
  const master = context.createGain(), limiter = context.createDynamicsCompressor(), ceiling = context.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.2;
  ceiling.threshold.value = -1.5; ceiling.knee.value = 0; ceiling.ratio.value = 20; ceiling.attack.value = 0.001; ceiling.release.value = 0.08;
  const music = context.createGain(), sfx = context.createGain();
  music.connect(master); sfx.connect(master); master.connect(limiter); limiter.connect(ceiling); ceiling.connect(context.destination);
  return { master, music, sfx, limiter, ceiling };
}

// A stereo room impulse: decaying noise that darkens as it fades (seeded, made once).
export function makeImpulse(context, seconds = REVERB.seconds) {
  const rate = context.sampleRate, n = Math.round(seconds * rate), buffer = context.createBuffer(2, n, rate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c), rnd = mulberry32(31 + c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate, k = 0.9 - 0.8 * (t / seconds);
      lp += k * (rnd() * 2 - 1 - lp);
      data[i] = t < 0.012 ? 0 : lp * Math.exp(-t / 0.38) * (1 - t / seconds) ** 2;
    }
  }
  return buffer;
}

export class Music {
  constructor(context, out) {
    this.context = context;
    this.duckGain = context.createGain();
    this.duckGain.connect(out);
    try {
      this.reverb = context.createConvolver();
      this.reverb.buffer = makeImpulse(context);
      this.send = context.createGain();
      this.send.gain.value = REVERB.wet;
      this.duckGain.connect(this.send); this.send.connect(this.reverb); this.reverb.connect(out);
    } catch { this.reverb = null; }
    this.layers = {};
    for (const mood of MOODS) {
      const filter = context.createBiquadFilter(), gain = context.createGain();
      filter.type = "lowpass"; filter.frequency.value = 2600; filter.Q.value = 0.5;
      gain.gain.value = 0;
      filter.connect(gain); gain.connect(this.duckGain);
      this.layers[mood] = { filter, gain, target: 0 };
    }
    // One second of noise shared by every drum hit.
    const n = context.sampleRate, buffer = context.createBuffer(1, n, context.sampleRate), data = buffer.getChannelData(0), rnd = mulberry32(7);
    for (let i = 0; i < n; i++) data[i] = rnd() * 2 - 1;
    this.noise = buffer;
    this.map = "classic"; this.faction = null; this.mood = null;
    this.combat = null; // combat layer level 0..1 from the director; null = follow the mood (battle = full)
    this.combatLevel = 0; // the combat layer's current target (observable in tests)
    this.active = false; this.timer = null; this.nextBar = 0; this.bar = 0;
    this.scheduled = 0; // notes scheduled so far (observable in tests)
    this.combatNotes = 0; // of which on the combat layer
  }
  setMap(map, faction = null) {
    this.map = map; this.faction = faction;
    const f = flavourFor(map);
    for (const layer of Object.values(this.layers)) layer.filter.frequency.setTargetAtTime(f.cutoff, this.context.currentTime, 0.3);
  }
  combatTarget() {
    if (!FIELD_MOODS.includes(this.mood)) return 0;
    return this.combat == null ? (this.mood === "battle" ? 1 : 0) : Math.max(0, Math.min(1, this.combat));
  }
  // Layer levels from the mood and the combat level. `quick` = a sting cutting in.
  applyGains(quick = false) {
    const now = this.context.currentTime, field = FIELD_MOODS.includes(this.mood);
    const combat = this.combatTarget(), base = field ? baseMood(this.mood) : this.mood, baseGain = field ? 1 - MIX.baseDip * combat : 1;
    for (const m of MOODS) {
      const layer = this.layers[m], target = (m === "battle" ? combat : m === base ? baseGain : 0) * LAYER_GAIN[m];
      if (Math.abs(target - layer.target) < 0.005) continue;
      const rising = target > layer.target;
      layer.gain.gain.setTargetAtTime(target, now, quick ? (rising ? 0.12 : 0.4) : m === "battle" ? (rising ? 0.5 : 1.4) : rising ? 0.9 : 1.2);
      layer.target = target;
    }
    this.combatLevel = combat;
  }
  // Cross-fade: the new layer rises while the old one falls; notes already queued fade with it.
  setMood(mood) {
    if (!MOODS.includes(mood) || mood === this.mood) return;
    const now = this.context.currentTime, quick = mood === "victory" || mood === "defeat";
    this.mood = mood;
    this.applyGains(quick);
    this.bar = 0; this.nextBar = Math.max(this.nextBar, now + 0.1);
    if (this.active) this.schedule();
  }
  // Combat layer level 0..1 (crossfade() in audio-logic.js). Small changes are ignored.
  setCombat(level) {
    level = Math.max(0, Math.min(1, level || 0));
    if (this.combat != null && Math.abs(level - this.combat) < 0.02 && !(level === 0 && this.combat !== 0)) return;
    this.combat = level;
    this.applyGains();
  }
  duckFor(seconds) {
    const g = this.duckGain.gain, now = this.context.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.4, now, 0.15);
    g.setTargetAtTime(1, now + Math.max(0.5, seconds), 0.5);
  }
  // Start or stop scheduling. Stopped = no timer at all (muted, hidden or paused).
  setActive(on) {
    on = !!on;
    if (on === this.active) return;
    this.active = on;
    if (on) {
      this.nextBar = this.context.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), TIMER_MS);
      this.schedule();
    } else {
      clearInterval(this.timer); this.timer = null;
    }
  }
  // `ahead` is the look-ahead in seconds; offline rendering (tools/render-audio.mjs) passes the whole length.
  schedule(ahead = LOOKAHEAD) {
    if (!this.active || !this.mood) return;
    const ctx = this.context, beat = 60 / tempoFor(this.mood, this.map);
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + ahead) {
      const base = FIELD_MOODS.includes(this.mood) ? baseMood(this.mood) : this.mood;
      for (const note of composeBar({ map: this.map, mood: base, faction: this.faction, bar: this.bar })) this.play(note, this.nextBar + note.t * beat, beat, base);
      // The combat layer is only scheduled while it is audible (it still fades with its gain).
      if (this.combatTarget() > 0.02)
        for (const note of composeBar({ map: this.map, mood: "battle", faction: this.faction, bar: this.bar })) { this.play(note, this.nextBar + note.t * beat, beat, "battle"); this.combatNotes++; }
      this.nextBar += 4 * beat; this.bar++;
    }
  }
  play(note, when, beat, layerName = this.mood) {
    const ctx = this.context, layer = this.layers[layerName] || this.layers.calm, f = flavourFor(this.map), dur = note.dur * beat, vel = note.vel;
    const out = layer.filter;
    this.scheduled++;
    const gainNode = (peak, attack, hold, release, dest = out) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + attack);
      g.gain.setValueAtTime(peak, when + Math.max(attack, hold));
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack, hold) + release);
      g.connect(dest);
      return g;
    };
    const osc = (type, hz, g, detune = 0, end) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = hz; o.detune.value = detune;
      o.connect(g); o.start(when); o.stop(end);
      return o;
    };
    // A low-pass whose cutoff falls from hz0 to hz1 (a plucked / brassy envelope), feeding `out`.
    const sweepFilter = (hz0, hz1, seconds, dest = out) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.Q.value = 2;
      filter.frequency.setValueAtTime(hz0, when); filter.frequency.exponentialRampToValueAtTime(hz1, when + seconds);
      filter.connect(dest);
      return filter;
    };
    const noiseHit = (type, hz, g, length, q = 0.8) => {
      const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      src.buffer = this.noise; filter.type = type; filter.frequency.value = hz; filter.Q.value = q;
      src.connect(filter); filter.connect(g);
      src.start(when, (this.scheduled * 0.137) % 0.8, length);
    };
    const hz = note.midi ? midiToHz(note.midi) : 0;
    switch (note.voice) {
      case "pad": {
        const g = gainNode(0.05 * vel, 1.4, dur, 1.6);
        osc(f.pad, hz, g, -7, when + dur + 1.7); osc(f.pad, hz, g, 7, when + dur + 1.7);
        break;
      }
      case "pluck": { const g = gainNode(0.11 * vel, 0.006, 0.006, dur + 0.5); osc(f.wave, hz, g, 0, when + dur + 0.6); break; }
      case "bass": { const g = gainNode(0.2 * vel, 0.02, dur * 0.6, 0.35); osc("sine", hz, g, 0, when + dur + 0.5); osc("triangle", hz * 2, g, 0, when + dur + 0.5); break; }
      case "lead": { const g = gainNode(0.07 * vel, 0.012, dur * 0.7, 0.25); osc(f.wave, hz, g, 0, when + dur + 0.35); break; }
      case "bell": {
        const g = gainNode(0.08 * vel, 0.004, 0.004, dur + 0.9);
        osc("sine", hz, g, 0, when + dur + 1); osc("sine", hz * 2.76, g, 0, when + dur + 1);
        break;
      }
      case "tick": { const g = gainNode(0.05 * vel, 0.001, 0.001, 0.05); osc("sine", 1900, g, 0, when + 0.08); break; }
      case "kick": {
        // Body (falling sine) + a short bright click so it reads on small speakers.
        const g = gainNode(0.5 * vel, 0.002, 0.002, 0.26), o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.13);
        o.connect(g); o.start(when); o.stop(when + 0.3);
        noiseHit("highpass", 3000, gainNode(0.08 * vel, 0.0005, 0.0005, 0.012), 0.03);
        break;
      }
      case "snare": {
        noiseHit("bandpass", 1800, gainNode(0.2 * vel, 0.001, 0.001, 0.16), 0.2);
        const g = gainNode(0.1 * vel, 0.001, 0.001, 0.08), o = ctx.createOscillator();
        o.type = "triangle"; o.frequency.setValueAtTime(200, when); o.frequency.exponentialRampToValueAtTime(160, when + 0.08);
        o.connect(g); o.start(when); o.stop(when + 0.12);
        break;
      }
      case "hat": { noiseHit("highpass", 7000, gainNode(0.07 * vel, 0.001, 0.001, 0.05), 0.08); break; }
      case "taiko": case "tom": {
        // Low drum: a falling sine two octaves above the note (it carries on phones) + a noise thud.
        const taiko = note.voice === "taiko", g = gainNode((taiko ? 0.42 : 0.26) * vel, 0.002, 0.002, taiko ? 0.55 : 0.28), o = ctx.createOscillator();
        o.frequency.setValueAtTime(hz * 4, when); o.frequency.exponentialRampToValueAtTime(hz * (taiko ? 2 : 3), when + (taiko ? 0.12 : 0.15));
        o.connect(g); o.start(when); o.stop(when + (taiko ? 0.7 : 0.35));
        noiseHit("lowpass", taiko ? 600 : 900, gainNode((taiko ? 0.25 : 0.12) * vel, 0.001, 0.001, 0.09), 0.12);
        break;
      }
      case "cbass": {
        // Driving combat bass: a saw through a closing low-pass, over a sine sub.
        const g = gainNode(0.15 * vel, 0.004, dur * 0.5, 0.18), filter = sweepFilter(1300, 220, 0.25, g);
        osc("sawtooth", hz, filter, 0, when + dur + 0.25); osc("sine", hz, g, 0, when + dur + 0.25);
        break;
      }
      case "ost": {
        const g = gainNode(0.045 * vel, 0.005, dur * 0.4, 0.14);
        osc("sawtooth", hz, g, -6, when + dur + 0.2); osc("sawtooth", hz, g, 6, when + dur + 0.2);
        break;
      }
      case "stab": {
        // Brass-like stab: detuned saws, a quick swell and a closing filter.
        const g = gainNode(0.05 * vel, 0.02, dur * 0.4, 0.3), filter = sweepFilter(2600, 600, 0.35, g);
        osc("sawtooth", hz, filter, -10, when + dur + 0.4); osc("sawtooth", hz, filter, 10, when + dur + 0.4);
        break;
      }
      default:
    }
  }
}
