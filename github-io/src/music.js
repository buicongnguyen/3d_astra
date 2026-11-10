// Adaptive score, synthesised with Web Audio (no audio files). The notes come from
// composeBar() in audio-logic.js, which is deterministic per (map, mood, faction, bar); this
// file only plays them. It schedules ahead of the audio clock from a slow timer, shares one
// noise buffer and one filter per mood layer, and stops its timer when silent, so it costs a
// few oscillators a second.
import { MISSION_MOODS, MOODS, MOOD_TEMPO, composeBar, flavourFor, midiToHz, mulberry32 } from "./audio-logic.js";

// Mood a mission asked for (the `music` action). main.js merges it with the live match state.
let requested = "calm";
export function setMusicMood(next) {
  requested = MISSION_MOODS.includes(next) ? next : "calm";
  return requested;
}
export const musicMood = () => requested;

const LOOKAHEAD = 1.6, TIMER_MS = 250;
const LAYER_GAIN = { calm: 1, tense: 0.95, battle: 0.9, victory: 1, defeat: 1 };

// The shared output graph: master -> limiter -> speakers, with a music bus (ducked under
// dialogue) and an effects bus. Levels come from the settings (busLevels in audio-logic.js).
export function createAudioBus(context) {
  const master = context.createGain(), limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.2;
  const music = context.createGain(), sfx = context.createGain();
  music.connect(master); sfx.connect(master); master.connect(limiter); limiter.connect(context.destination);
  return { master, music, sfx, limiter };
}

export class Music {
  constructor(context, out) {
    this.context = context;
    this.duckGain = context.createGain();
    this.duckGain.connect(out);
    this.layers = {};
    for (const mood of MOODS) {
      const filter = context.createBiquadFilter(), gain = context.createGain();
      filter.type = "lowpass"; filter.frequency.value = 2600; filter.Q.value = 0.5;
      gain.gain.value = 0;
      filter.connect(gain); gain.connect(this.duckGain);
      this.layers[mood] = { filter, gain };
    }
    // One second of noise shared by every drum hit.
    const n = context.sampleRate, buffer = context.createBuffer(1, n, context.sampleRate), data = buffer.getChannelData(0), rnd = mulberry32(7);
    for (let i = 0; i < n; i++) data[i] = rnd() * 2 - 1;
    this.noise = buffer;
    this.map = "classic"; this.faction = null; this.mood = null;
    this.active = false; this.timer = null; this.nextBar = 0; this.bar = 0;
    this.scheduled = 0; // notes scheduled so far (observable in tests)
  }
  setMap(map, faction = null) {
    this.map = map; this.faction = faction;
    const f = flavourFor(map);
    for (const layer of Object.values(this.layers)) layer.filter.frequency.setTargetAtTime(f.cutoff, this.context.currentTime, 0.3);
  }
  // Cross-fade: the new layer rises while the old one falls; notes already queued fade with it.
  setMood(mood) {
    if (!MOODS.includes(mood) || mood === this.mood) return;
    const now = this.context.currentTime, quick = mood === "victory" || mood === "defeat";
    for (const m of MOODS) this.layers[m].gain.gain.setTargetAtTime(m === mood ? LAYER_GAIN[m] : 0, now, m === mood ? (quick ? 0.12 : 0.9) : quick ? 0.4 : 1.2);
    this.mood = mood;
    this.bar = 0; this.nextBar = Math.max(this.nextBar, now + 0.1);
    if (this.active) this.schedule();
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
    const ctx = this.context, beat = 60 / MOOD_TEMPO[this.mood];
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + ahead) {
      const notes = composeBar({ map: this.map, mood: this.mood, faction: this.faction, bar: this.bar });
      for (const note of notes) this.play(note, this.nextBar + note.t * beat, beat);
      this.nextBar += 4 * beat; this.bar++;
    }
  }
  play(note, when, beat) {
    const ctx = this.context, layer = this.layers[this.mood], f = flavourFor(this.map), dur = note.dur * beat, vel = note.vel;
    const out = layer.filter;
    this.scheduled++;
    const gainNode = (peak, attack, hold, release) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + attack);
      g.gain.setValueAtTime(peak, when + Math.max(attack, hold));
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack, hold) + release);
      g.connect(out);
      return g;
    };
    const osc = (type, hz, g, detune = 0, end) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = hz; o.detune.value = detune;
      o.connect(g); o.start(when); o.stop(end);
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
        const g = gainNode(0.5 * vel, 0.002, 0.002, 0.2), o = ctx.createOscillator();
        o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.14);
        o.connect(g); o.start(when); o.stop(when + 0.25);
        break;
      }
      case "snare": case "hat": {
        const snare = note.voice === "snare", g = gainNode((snare ? 0.2 : 0.07) * vel, 0.001, 0.001, snare ? 0.16 : 0.05);
        const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
        src.buffer = this.noise; filter.type = snare ? "bandpass" : "highpass"; filter.frequency.value = snare ? 1800 : 7000;
        src.connect(filter); filter.connect(g);
        src.start(when, (this.scheduled * 0.137) % 0.8, 0.2);
        break;
      }
      default:
    }
  }
}
