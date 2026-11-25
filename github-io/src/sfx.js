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
import { counterKind } from "./combat-feedback.js";
import { BARK, THUNDER, VoiceBudget, audible, barkVoice, dbToGain, hitFor, impactLayer, incomingFor, landingFor, nearPriority, screenMix, shouldCull, soundFor, stingerFor } from "./audio-logic.js";
import { mulberry32 } from "./rng.js";
import { AIR_HUM, BANK, ENGINE, radioSpec } from "./sfx-bank.js";
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
  // Kite Dive: a falling whine, then the blast as it hits.
  // W12 (2026-11-25): every ability has its cast. Charges and dashes rise, buffs chime, marks lock on,
  // ambushes and shadow strikes come in hushed, rams thud.
  "ability:rush": [["n", "bandpass", 400, 2400, 0.35, 0.4, 0, 1.2], ["o", "sawtooth", 160, 420, 0.3, 0.14, 0], ["o", "triangle", 330, 660, 0.25, 0.2, 0.08]],
  "ability:dash": [["n", "bandpass", 3000, 600, 0.22, 0.45, 0, 1.5], ["o", "sine", 900, 300, 0.18, 0.2, 0]],
  "ability:spurs": [["o", "triangle", 880, 880, 0.06, 0.3, 0], ["o", "triangle", 1175, 1175, 0.06, 0.3, 0.07], ["n", "bandpass", 1800, 1200, 0.18, 0.3, 0.04, 2], ["o", "sine", 220, 160, 0.2, 0.3, 0.1]],
  "ability:burnline": [["n", "lowpass", 300, 2400, 0.6, 0.5, 0, 0.9], ["o", "sawtooth", 90, 60, 0.5, 0.2, 0], ["n", "highpass", 4000, 6000, 0.4, 0.15, 0.1]],
  "ability:shieldlink": [["o", "sine", 600, 600, 0.3, 0.3, 0], ["o", "sine", 900, 900, 0.3, 0.25, 0.08], ["o", "sine", 1200, 1200, 0.35, 0.2, 0.16], ["n", "bandpass", 2000, 2600, 0.4, 0.12, 0, 4]],
  "ability:brace": [["o", "square", 140, 90, 0.1, 0.35, 0], ["n", "bandpass", 1200, 400, 0.15, 0.35, 0, 2], ["o", "square", 120, 80, 0.1, 0.3, 0.12]],
  "ability:shadowstrike": [["n", "highpass", 6000, 2500, 0.25, 0.3, 0], ["o", "sine", 1400, 400, 0.3, 0.2, 0.05], ["n", "bandpass", 900, 300, 0.12, 0.4, 0.28, 2]],
  "ability:mark": [["o", "square", 2200, 2200, 0.04, 0.18, 0], ["o", "square", 2200, 2200, 0.04, 0.18, 0.09], ["o", "sine", 1650, 1650, 0.2, 0.22, 0.18]],
  "ability:crossfire": [["n", "bandpass", 3500, 2500, 0.05, 0.4, 0, 3], ["n", "bandpass", 3500, 2500, 0.05, 0.4, 0.08, 3], ["n", "bandpass", 3500, 2500, 0.05, 0.4, 0.16, 3], ["o", "triangle", 660, 990, 0.3, 0.2, 0.05]],
  "ability:steadyaim": [["n", "lowpass", 800, 300, 0.4, 0.2, 0], ["o", "sine", 1320, 1320, 0.35, 0.22, 0.15]],
  "ability:ram": [["o", "sawtooth", 60, 140, 0.35, 0.3, 0], ["n", "lowpass", 600, 1800, 0.35, 0.3, 0], ["o", "sine", 80, 40, 0.3, 0.6, 0.35], ["n", "bandpass", 1500, 500, 0.2, 0.4, 0.35, 1]],
  "ability:ambush": [["n", "highpass", 3500, 1500, 0.4, 0.18, 0], ["o", "sine", 300, 300, 0.5, 0.18, 0.05], ["o", "sine", 450, 450, 0.4, 0.12, 0.2]],
  "ability:reinforce": [["o", "triangle", 392, 392, 0.12, 0.35, 0], ["o", "triangle", 523, 523, 0.12, 0.35, 0.1], ["n", "bandpass", 300, 900, 0.6, 0.3, 0.05, 0.8], ["o", "sine", 70, 50, 0.5, 0.4, 0.15]],
  // W12: interface clicks (app/sound.js tone): a short tick in front of the pitch, so it reads as a button.
  "ui:click": [["n", "bandpass", 3600, 2800, 0.012, 0.5, 0, 3], ["o", "triangle", 600, 560, 0.05, 0.28, 0.004]],
  "ability:dive": [["o", "sawtooth", 1500, 220, 0.42, 0.16, 0], ["n", "bandpass", 3200, 500, 0.42, 0.18, 0, 1.5], ["o", "sine", 95, 35, 0.6, 0.6, 0.4], ["n", "lowpass", 1400, 160, 0.7, 0.5, 0.4]],
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
const EXTRA = { "ui:click": [7, 0.06, "ui"], construct: [4, 0.15, "ui"], tap: [8, 0.03, "ui"], select: [7, 0.05, "ui"], error: [8, 0.1, "ui"], objective: [8, 0.2, "moment"], "objective-failed": [8, 0.2, "moment"], win: [10, 1, "moment"], lose: [10, 1, "moment"], blip: [7, 0.07, "ui"] };
// R3-U: bank sounds played directly (not from a sim event): priority, rate limit and group.
const BANK_EXTRA = { "sting:victory": [10, 1, "moment"], "sting:boss": [9, 0.8, "moment"], "sting:surge": [9, 1, "moment"], "warn:lowhp": [8, 1, "moment"], thunder: [5, 0.6, "moment"] };
// R3-U: a unit voice chirp ("bark") as a live recipe: two or three formant blips in the type's voice
// (audio-logic.js barkVoice). select = a rising "huh?", order = a falling "roger", attack = three sharp ones.
export const BARK_KINDS = ["select", "order", "attack"];
export function barkRecipe(voice, kind = "select") {
  const steps = kind === "attack" ? [[1.3, 1.2, 0.045], [1.3, 1.2, 0.045], [1.45, 1.1, 0.07]] : kind === "order" ? [[1.2, 1, 0.07], [1.1, 1.15, 0.08]] : [[1, 1.22, 0.07], [1.22, 1.3, 0.06]];
  const out = [];
  let t = 0;
  for (const [a, b, d] of steps) {
    out.push(["o", voice.wave, voice.hz * a, voice.hz * b, d, voice.wave === "sine" ? 0.42 : 0.3, t]);
    out.push(["n", "bandpass", voice.formant * a, voice.formant * b, d, 0.14, t, 4]);
    t += d + 0.025;
  }
  return out;
}
const duration = (recipe) => recipe.reduce((m, l) => Math.max(m, l[4] + l[6]), 0);
export const SFX_NAMES = [...Object.keys(R), ...Object.keys(BANK)];
export const recipeFor = (name) => R[name] || BANK[name];
export const hasSound = (name) => Object.hasOwn(R, name) || Object.hasOwn(BANK, name);
// The big, rare explosions keep one rendering (pitch jitter varies them); everything else has two.
export const variantsFor = (name) => ((name.startsWith("boom:") && name !== "boom:small") || name.startsWith("sting:") || name === "thunder" ? 1 : 2);
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
    this.airVoice = null;
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
    const sound = refineSound(soundFor(event, sourceType), event, sim);
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
    // A counter hit: a crisp "crit" layer where the round lands (the player's own or what the player sees).
    if (event.type === "shot" && event.target != null && Number.isFinite(event.tx) && (event.team === 0 || isVisible({ x: event.tx, z: event.tz })) && counterKind(sim.get?.(event.source), sim.get?.(event.target)) > 0) {
      const mix = this.mixAt(event.tx, event.tz);
      this.play("impact:crit", { pan: mix.pan, gain: mix.gain, priority: nearPriority(2, mix.gain), gap: 0.12, group: "impact", delay: 0.05 });
    }
    // R3-U: where the round lands (the player's own, or ground the player sees): a falling whistle
    // before a lob or a bomb, the class's own landing (bomb, fire bomb, flak burst) and the size layer
    // of the impact (small, medium, heavy) over the target's material sound.
    if (event.type === "shot" && Number.isFinite(event.tx) && Number.isFinite(event.tz) && (event.team === 0 || isVisible({ x: event.tx, z: event.tz }))) {
      const mix = this.mixAt(event.tx, event.tz), land = landingFor(event, sourceType), layer = impactLayer(event, sourceType);
      if (land?.incoming) this.play(land.incoming.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(4, mix.gain), gap: 0.12, group: "moment", delay: land.incoming.delay });
      if (land?.hit && this.play(land.hit.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(4, mix.gain), gap: 0.06, group: "explosion", delay: land.hit.delay })) heard = Math.max(heard, mix.gain);
      if (layer && !shouldCull("impact", mix.gain, layer.size === "heavy")) this.play(layer.name, { pan: mix.pan, gain: mix.gain, priority: nearPriority(layer.size === "heavy" ? 3 : layer.size === "medium" ? 2 : 1, mix.gain), gap: layer.size === "small" ? 0.06 : 0.09, group: "impact", delay: layer.delay });
    }
    // R3-U: a stinger over the big turns (a boss stage falls).
    const sting = stingerFor(event);
    if (sting && audible(event, isVisible, 0)) this.play(sting, { priority: 9, gap: 0.8, group: "moment" });
    return heard;
  }
  // W12: an interface click at `hz` (the old sine beeps of app/sound.js): the recipe shifted to that pitch.
  click(hz = 520, seconds = 0.065) {
    const k = Math.max(0.3, Math.min(3, hz / 600));
    const recipe = R["ui:click"].map(([kind, a, f0, f1, secs, vol, delay, q]) => (kind === "o" ? [kind, a, f0 * k, f1 * k, Math.max(secs, Math.min(0.3, seconds)), vol, delay] : [kind, a, f0, f1, secs, vol, delay, q]));
    return this.playRecipe("ui:click", recipe, { priority: 7, gap: 0.06, group: "ui", jitter: 0.01 });
  }
  // Phones (eco quality) keep fewer voices sounding at once: a big fight costs less audio work.
  setVoiceCaps(eco) {
    const scale = eco ? MIX.ecoVoices : 1;
    this.budget.max = Math.round(MIX.maxVoices * scale);
    this.budget.caps = Object.fromEntries(Object.entries(MIX.groupCaps).map(([g, n]) => [g, n <= 1 ? n : Math.max(1, Math.round(n * scale))]));
  }
  // R3-U: a unit voice chirp for `kind` (select | order | attack) in the voice of `unit` (an entity:
  // type, class, position). Rate limit and quiet mode are the caller's (BarkGate in audio-logic.js).
  bark(kind, unit) {
    if (!this.enabled || !unit) return false;
    const voice = barkVoice(unit.type, unit.class), mix = this.mixAt(unit.x, unit.z);
    return this.playRecipe(`bark:${unit.type}`, barkRecipe(voice, kind), { pan: mix.pan, gain: BARK.level, priority: 7, gap: 0, group: "voice", jitter: BARK.pitchJitter });
  }
  // R3-U: the low-HP heartbeat and the thunder crack (a moment after the flash), in the player's ear.
  lowHp() { return this.play("warn:lowhp"); }
  thunder(level = 1) { return this.play("thunder", { gain: THUNDER.level * level, delay: THUNDER.delay }); }
  play(name, { pan = 0, gain = 1, priority, gap, group, delay = 0, rate = 1 } = {}) {
    if (!this.enabled) return false;
    if (Object.hasOwn(BANK, name)) {
      const extra = BANK_EXTRA[name];
      return this.playBank(name, BANK[name], { pan, gain, priority: priority ?? extra?.[0] ?? 3, gap: gap ?? extra?.[1] ?? 0, group: group ?? extra?.[2] ?? groupOf(name), delay, rate });
    }
    const recipe = R[name];
    if (!recipe) return false;
    const extra = EXTRA[name];
    priority ??= extra?.[0] ?? 3; gap ??= extra?.[1] ?? 0; group ??= extra?.[2] ?? (name.startsWith("shot:") ? "weapon" : "moment");
    return this.playRecipe(name, recipe, { pan, gain, priority, gap, group, delay });
  }
  // A live recipe (oscillators and noise) through the voice budget; `jitter` = the pitch variation.
  playRecipe(name, recipe, { pan = 0, gain = 1, priority = 3, gap = 0, group = "moment", delay = 0, jitter = MIX.pitchVariation } = {}) {
    const ctx = this.context;
    const now = ctx.currentTime, got = this.budget.tryAcquire(name, priority, now, duration(recipe) + 0.05, gap, group);
    if (!got) { this.dropped++; return false; }
    got.stolen?.stop?.();
    const pitch = 1 + (this.rnd() * 2 - 1) * jitter, level = gain * (0.9 + this.rnd() * 0.2);
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
    this.loop("engineVoice", `engine:${faction}`, ENGINE[faction] || ENGINE.meridian, level, rate, MIX.engine.level);
  }
  // Flyers (0.18): one quiet loop for the player's flyers, rotor hum, burner whoosh or prop buzz.
  airHum(level, rate = 1, kind = "rotor") {
    this.loop("airVoice", `air:${kind}`, AIR_HUM[kind] || AIR_HUM.rotor, level, rate, MIX.air.level);
  }
  // A persistent looped voice in `slot`, faded to `level` × `base`; a new key crossfades to its buffer.
  loop(slot, key, spec, level, rate, base) {
    const ctx = this.context, now = ctx.currentTime, e = this[slot];
    if (!this.enabled || !(level > 0.001)) {
      if (!e) return;
      e.gain.gain.setTargetAtTime(0, now, 0.3);
      e.quietSince ??= now;
      if (now - e.quietSince > 2) { try { e.src.stop(); } catch { /* stopped */ } this[slot] = null; }
      return;
    }
    if (!e || e.key !== key) {
      if (e) { try { e.src.stop(now + 0.3); } catch { /* stopped */ } e.gain.gain.setTargetAtTime(0, now, 0.1); }
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = this.buffer(key, spec, 0, true); src.loop = true;
      gain.gain.value = 0; src.connect(gain); gain.connect(this.out); src.start(now, this.rnd() * 0.9);
      src.onended = () => { src.disconnect(); gain.disconnect(); };
      this[slot] = { src, gain, key, quietSince: null };
    }
    const v = this[slot];
    v.quietSince = null;
    v.gain.gain.setTargetAtTime(level * base, now, 0.35);
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
// W12: impacts by armour and infantry falls. A round on a mechanical unit rings as metal; an infantry
// death is a fall, not a blast (vehicles and buildings keep their explosions).
export function refineSound(sound, event, sim) {
  if (!sound) return sound;
  if (sound.name === "impact:body" && sim?.get?.(event.seed)?.mechanical) return { ...sound, name: "impact:metal" };
  if (sound.name === "boom:small" && event.type === "death" && !event.heavy && !event.building) return { ...sound, name: "fall:body" };
  return sound;
}
