import { MIX } from "./audio-mix.js";
// Pure audio logic: no Web Audio and no DOM, so it is unit-tested in Node (tests/audio.test.js).
// The score and the sound effects are made in-house: this file holds the rules (which mood fits
// the match, which notes a bar contains, how many voices may sound, which sounds the fog hides).
// Audio has its own seeded generator; none of this touches the simulation or Math.random.

// ---------------------------------------------------------------- seeded generator
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
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

// ---------------------------------------------------------------- moods
export const MOODS = ["calm", "tense", "battle", "victory", "defeat"];
// Moods a mission may ask for. Victory and defeat only come from the match result.
export const MISSION_MOODS = ["calm", "tense", "battle"];
const RANK = { calm: 0, tense: 1, battle: 2 };

// Picks the mood from what the match is doing. `s`:
//   result            "victory" | "defeat" | null
//   now               match time in seconds
//   lastCombatAt      time of the last audible shot, blast or loss (-Infinity if none)
//   incomingAt        time of the last "incoming" warning for the player (-Infinity if none)
//   enemyDistance     distance of the nearest visible enemy to the player's core (Infinity if none)
//   missionMood       mood the mission asked for (a floor: auto battle can still raise it)
// Holds: combat keeps "battle" for 8 s after the last shot, a warning keeps "tense" for 25 s.
export function pickMood(s) {
  if (s.result === "victory" || s.result === "defeat") return s.result;
  let best = MISSION_MOODS.includes(s.missionMood) ? s.missionMood : "calm";
  const raise = (mood) => { if (RANK[mood] > RANK[best]) best = mood; };
  if (s.now - s.lastCombatAt < 8) raise("battle");
  if (s.now - s.incomingAt < 25) raise("tense");
  if (s.enemyDistance < 30) raise("tense");
  return best;
}

// ---------------------------------------------------------------- scales and flavour
export const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};
// One key, scale and voice colour per map (maps.json ids). `wave` is the lead/pluck oscillator,
// `pad` the pad oscillator, `cutoff` the low-pass of the whole score, `degrees` the chord roots
// (scale degrees) the four-bar progression walks through.
// `tempo` is the field tempo shared by the calm, tense and combat layers, so they cross-fade in time.
export const MAP_FLAVOUR = {
  classic: { root: 50, scale: "dorian", wave: "triangle", pad: "sine", cutoff: 2600, degrees: [0, 5, 3, 4], tempo: 92 },
  riverlands: { root: 53, scale: "lydian", wave: "sine", pad: "triangle", cutoff: 3200, degrees: [0, 4, 5, 3], tempo: 88 },
  basin: { root: 48, scale: "phrygian", wave: "sawtooth", pad: "triangle", cutoff: 1900, degrees: [0, 1, 5, 4], tempo: 96 },
  expanse: { root: 57, scale: "aeolian", wave: "triangle", pad: "sine", cutoff: 2800, degrees: [0, 5, 2, 6], tempo: 90 },
  dunes: { root: 52, scale: "phrygianDominant", wave: "sawtooth", pad: "sine", cutoff: 2200, degrees: [0, 1, 0, 6], tempo: 94 },
  woodlands: { root: 55, scale: "pentatonic", wave: "sine", pad: "triangle", cutoff: 3400, degrees: [0, 2, 3, 1], tempo: 86 },
  highlands: { root: 49, scale: "minorPentatonic", wave: "sawtooth", pad: "sine", cutoff: 1700, degrees: [0, 3, 4, 2], tempo: 98 },
};
// Faction motifs: scale-degree sequences (with beat lengths) that tag the enemy of a mission.
export const FACTION_MOTIF = {
  meridian: { degrees: [0, 2, 4, 7], beats: [1, 1, 1, 2] },
  ashfall: { degrees: [0, 0, 3, 2], beats: [0.75, 0.25, 1, 2] },
  sunward: { degrees: [0, 2, 4, 2], beats: [1, 1, 1, 1] },
  veil: { degrees: [0, 1, 6, 3], beats: [1.5, 0.5, 1, 1] },
  wardens: { degrees: [0, 4, 0, 5], beats: [2, 1, 1, 2] },
};
// Frontier Defence maps play the score of the map they borrow their look from (src/defence/maps.json "look").
const BORROWED = { gorge: "highlands", bridges: "riverlands" };
export const flavourFor = (map) => MAP_FLAVOUR[BORROWED[map] || map] || MAP_FLAVOUR.classic;
export const MOOD_TEMPO = { calm: 92, tense: 92, battle: 92, victory: 104, defeat: 54 };
// The field moods (calm, tense, battle) share the map's tempo; the stings keep their own.
export const FIELD_MOODS = ["calm", "tense", "battle"];
export const tempoFor = (mood, map) => (FIELD_MOODS.includes(mood) ? flavourFor(map).tempo || MOOD_TEMPO[mood] : MOOD_TEMPO[mood] || 92);
// The base layer under a mood: battle plays the tense layer under the combat layer.
export const baseMood = (mood) => (mood === "battle" ? "tense" : mood);

// Scale degree (may be negative or above one octave) to a MIDI note.
export function degreeToMidi(flavour, degree) {
  const scale = SCALES[flavour.scale], n = scale.length;
  const octave = Math.floor(degree / n), step = ((degree % n) + n) % n;
  return flavour.root + octave * 12 + scale[step];
}
export const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One bar (4 beats) of a mood as a plain list of notes: { t (beats from bar start), voice,
// midi (pitch voices), dur (beats), vel (0..1) }. Deterministic from (map, mood, faction, bar).
export function composeBar({ map = "classic", mood = "calm", faction = null, bar = 0 } = {}) {
  const fl = flavourFor(map), rnd = mulberry32(hashString(`${map}|${mood}|${faction || ""}|${bar}`));
  const chordDegree = fl.degrees[((bar % 4) + 4) % 4];
  const deg = (d) => degreeToMidi(fl, d);
  const notes = [], add = (t, voice, midi, dur, vel) => notes.push({ t, voice, midi, dur, vel });
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chord = [chordDegree, chordDegree + 2, chordDegree + 4];
  if (mood === "calm") {
    if (bar % 2 === 0) for (const d of chord) add(0, "pad", deg(d) + 12, 8, 0.5);
    for (let i = 0; i < 4; i++) if (rnd() < 0.45) add(i + (rnd() < 0.5 ? 0 : 0.5), "pluck", deg(pick(chord) + pick([0, 7])) + 12, 1.5, 0.45 + rnd() * 0.2);
    if (bar % 4 === 0) add(0, "bass", deg(chordDegree) - 12, 4, 0.5);
  } else if (mood === "tense") {
    add(0, "bass", deg(chordDegree) - 12, 1.5, 0.6);
    add(2, "bass", deg(chordDegree) - 12, 1.5, 0.5);
    for (let i = 0; i < 8; i++) if (i % 2 === 0 || rnd() < 0.4) add(i / 2, "pluck", deg(pick([chordDegree, chordDegree + 1, chordDegree + 4, chordDegree + 2])) + 12, 0.4, 0.4);
    for (let i = 0; i < 4; i++) add(i, "tick", 0, 0.1, 0.25);
    if (bar % 2 === 0) add(0, "pad", deg(chordDegree) + 12, 8, 0.4), add(0, "pad", deg(chordDegree + 1) + 12, 8, 0.25);
  } else if (mood === "battle") {
    // The combat layer (plays over the tense layer): low drums, a driving filtered bass, a string
    // ostinato on the chord, brass-like stabs every other bar and a tom fill closing each phrase.
    for (const t of [0, 1, 2, 2.5, 3]) add(t, "kick", 0, 0.2, t % 1 ? 0.7 : 0.9);
    add(1, "snare", 0, 0.2, 0.75); add(3, "snare", 0, 0.2, 0.75);
    if (rnd() < 0.35) add(3.75, "snare", 0, 0.1, 0.3);
    for (let i = 0; i < 8; i++) add(i / 2 + 0.25, "hat", 0, 0.1, i % 2 ? 0.3 : 0.22);
    if (bar % 2 === 0) add(0, "taiko", deg(chordDegree) - 24, 1, 0.8);
    for (let i = 0; i < 8; i++) add(i / 2, "cbass", deg(i % 4 === 3 ? chordDegree + 4 : chordDegree) - 12, 0.4, i % 2 ? 0.55 : 0.75);
    const ost = [0, 1, 2, 1];
    for (let i = 0; i < 8; i++) add(i / 2, "ost", deg(chord[ost[i % 4]]) + 12, 0.35, i % 4 === 0 ? 0.45 : 0.32);
    if (bar % 2 === 0) for (const d of chord) add(0, "stab", deg(d), 0.6, 0.5);
    for (let i = 0; i < 4; i++) if (rnd() < 0.45) add(i + 0.5 * (rnd() < 0.4 ? 1 : 0), "lead", deg(pick(chord) + pick([0, 0, 7])) + 12, 0.8, 0.45);
    if (bar % 4 === 3) [0, -1, -2, -3].forEach((s, i) => add(3 + i * 0.25, "tom", deg(chordDegree + 4 + s) - 24, 0.25, 0.6 + i * 0.08));
    if (bar % 4 === 0) add(0, "pad", deg(chordDegree) + 12, 16, 0.3);
  } else if (mood === "victory") {
    const run = [0, 2, 4, 7, 9, 11, 14];
    if (bar === 0) for (let i = 0; i < run.length; i++) add(i * 0.5, "lead", deg(run[i]) + 12, i === run.length - 1 ? 4 : 0.6, 0.65);
    for (const d of chord) add(0, "pad", deg(d) + 12, 8, 0.5);
    add(0, "bass", deg(chordDegree) - 12, 4, 0.6);
    if (bar > 0) for (let i = 0; i < 4; i++) if (rnd() < 0.6) add(i, "bell", deg(pick(chord) + 7) + 12, 1.5, 0.4);
  } else {
    // defeat: a slow falling line over a low drone
    const fall = [4, 3, 2, 1, 0];
    if (bar % 2 === 0) { add(0, "pad", deg(0) - 12, 8, 0.6); add(0, "pad", deg(2) , 8, 0.3); }
    for (let i = 0; i < 4; i++) if (bar < 4 || rnd() < 0.4) add(i, "bell", deg(fall[(bar + i) % fall.length]) + 12, 2, 0.4);
  }
  // Faction motif: a short tagged phrase every fourth bar in the active moods.
  const motif = faction && FACTION_MOTIF[faction];
  if (motif && bar % 4 === 2 && (mood === "tense" || mood === "battle")) {
    let t = 0;
    motif.degrees.forEach((d, i) => { add(t, "bell", deg(d + chordDegree) + 12, motif.beats[i], 0.45); t += motif.beats[i]; });
  }
  return notes;
}

// ---------------------------------------------------------------- sound effects
// Voice budget with priority: at most `max` sounds at once, and at most `caps[group]` of one group
// (weapons, impacts, explosions, radio, UI, moments). A newcomer that is lower in priority than
// everything it would have to replace is dropped; otherwise it replaces the lowest priority voice
// of its group (group full) or of all (budget full); the replaced entry is returned so its gain can
// be faded. `gap` limits one sound's rate; identical sounds start at most MIX.identicalVoices times
// per MIX.windowSeconds.
export class VoiceBudget {
  constructor(max = MIX.maxVoices, caps = MIX.groupCaps) { this.max = max; this.caps = caps || {}; this.voices = []; this.lastPlayed = new Map(); this.recent = new Map(); }
  tryAcquire(name, priority, now, duration, gap = 0, group = null) {
    this.voices = this.voices.filter((v) => v.end > now);
    if (gap && now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return null;
    const recent = (this.recent.get(name) || []).filter(t => now-t < MIX.windowSeconds);
    this.recent.set(name,recent);
    if (recent.length >= MIX.identicalVoices) return null;
    const lowest = (list) => { let low = list[0]; for (const v of list) if (v.priority < low.priority || (v.priority === low.priority && v.end < low.end)) low = v; return low; };
    let stolen = null;
    const cap = group ? this.caps[group] : undefined;
    const same = cap !== undefined ? this.voices.filter((v) => v.group === group) : null;
    if (same && same.length >= cap) {
      const low = cap > 0 ? lowest(same) : null;
      if (!low || low.priority >= priority) return null;
      stolen = low;
    } else if (this.voices.length >= this.max) {
      const low = lowest(this.voices);
      if (low.priority >= priority) return null;
      stolen = low;
    }
    if (stolen) this.voices.splice(this.voices.indexOf(stolen), 1);
    const voice = { name, priority, group, end: now + duration };
    this.voices.push(voice);
    this.lastPlayed.set(name, now);
    recent.push(now);
    return { voice, stolen };
  }
  get active() { return this.voices.length; }
  count(group) { let n = 0; for (const v of this.voices) if (v.group === group) n++; return n; }
}

// The weapon voice of a shot: the event's weapon (balance.json `shot`, else the unit type), refined
// by the shooter's type where several units share one shot (drone, walker, watcher).
export const WEAPON_VOICE = {
  ranger: "rifle", rider: "rifle", drone: "drone", vanguard: "smg", scrapper: "scrap", shade: "silenced",
  tank: "tank", walker: "walker", breaker: "artillery", scorcher: "flame", antitank: "rocket", watcher: "rail",
  tower: "tower", medic: "support", wagon: "support", engineer: "engineer", worker: "worker", repair: "worker",
};
const REFINED = new Set(["drone", "walker", "watcher"]);
export function weaponVoice(weapon, sourceType) {
  if (REFINED.has(sourceType) && weapon !== "repair") return WEAPON_VOICE[sourceType];
  return WEAPON_VOICE[weapon] || "smg";
}
// Heavy rounds land a little later (visual-style.json `life` is the flight time) with an explosion
// at the target: name and delay per weapon voice. Light rounds only have the target's impact sound.
export const HIT = {
  tank: { name: "hit:shell", delay: 0.32 }, walker: { name: "hit:shell", delay: 0.32 }, artillery: { name: "hit:artillery", delay: 0.28 },
  rocket: { name: "hit:rocket", delay: 0.24 }, rail: { name: "hit:small", delay: 0.24 }, tower: { name: "hit:small", delay: 0.26 },
};
export const hitFor = (voice) => HIT[voice] || null;
const HEAVY_VOICES = new Set(["tank", "walker", "artillery", "rocket", "rail", "tower", "flame"]);

// Sound name, priority, rate gap and voice group for a simulation event. null = silent event.
// `sourceType` is the shooter's unit type when known (refines the weapon voice).
export function soundFor(event, sourceType = null) {
  switch (event.type) {
    case "shot": {
      const voice = weaponVoice(event.weapon || "vanguard", sourceType);
      return { name: `shot:${voice}`, priority: HEAVY_VOICES.has(voice) ? 3 : 2, gap: voice === "flame" ? 0.22 : HEAVY_VOICES.has(voice) ? 0.08 : 0.05, group: "weapon", heavy: HEAVY_VOICES.has(voice) };
    }
    case "impact": return { name: event.shield ? "impact:shield" : event.building ? "impact:building" : "impact:body", priority: 1, gap: 0.07, group: "impact" };
    case "death": return { name: event.core ? "boom:core" : event.building ? "boom:building" : event.heavy ? "boom:heavy" : "boom:small", priority: event.core ? 9 : event.building ? 7 : 5, gap: event.core ? 0 : 0.08, group: "explosion" };
    case "strike": return { name: "boom:strike", priority: 6, gap: 0.1, group: "explosion" };
    case "built": return { name: "complete", priority: 4, gap: 0.2, group: "moment" };
    case "research": return { name: "research", priority: 7, gap: 0.12, group: "moment" };
    case "spawn": return { name: "trained", priority: 3, gap: 0.12, group: "moment" };
    case "ability": return { name: `ability:${event.ability}`, priority: 6, gap: 0.1, group: "moment" };
    case "promote": return { name: "promote", priority: 7, gap: 0.3, group: "moment" };
    case "point": return { name: event.owner === 0 ? "capture" : "lost", priority: 8, gap: 0.3, group: "moment" };
    case "incoming": return { name: "alarm", priority: 8, gap: 2, group: "moment" };
    default: return null;
  }
}

// Explosion size class of a sound (drives music ducking): null for everything that is not loud.
export const EXPLOSION_SIZE = {
  "hit:rocket": "medium", "hit:shell": "medium", "hit:artillery": "large", "boom:heavy": "large",
  "boom:strike": "large", "boom:building": "huge", "boom:core": "huge",
};
export const explosionSize = (name) => EXPLOSION_SIZE[name] || null;

// Weight a heard sound adds to combat intensity (before closeness to the camera).
export function intensityWeight(name) {
  const w = MIX.intensityWeight;
  if (name.startsWith("shot:")) return HEAVY_VOICES.has(name.slice(5)) ? w.heavyShot : name === "shot:support" || name === "shot:engineer" || name === "shot:worker" ? 0 : w.shot;
  if (name.startsWith("impact:")) return w.impact;
  if (name.startsWith("hit:")) return w.hit;
  if (name === "boom:small") return w.death;
  if (name === "boom:heavy") return w.heavyDeath;
  if (name === "boom:building" || name === "boom:core") return w.building;
  if (name === "boom:strike") return w.strike;
  return 0;
}

// Fog rule: the player's own actions always sound; an enemy action sounds only if the place it
// happens is visible to the player, so sound never shows what the fog hides. `isVisible({x,z})`
// is the simulation's visibility test for the player's team.
export function audible(event, isVisible, playerTeam = 0) {
  if (event.type === "point") return true; // a mission capture is announced on screen anyway
  if (event.type === "incoming" || event.type === "promote") return event.team === playerTeam;
  if (event.team === playerTeam) return true;
  if (!Number.isFinite(event.x) || !Number.isFinite(event.z)) return false;
  return !!isVisible({ x: event.x, z: event.z });
}

// Stereo pan (-1..1) and a distance gain (0.35..1) from a screen position; points off screen
// are quieter and fully panned. `x`,`y` are pixels in a `width` x `height` view.
export function screenMix(x, y, width, height) {
  if (!(width > 0 && height > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return { pan: 0, gain: 1 };
  const nx = (x / width) * 2 - 1, ny = (y / height) * 2 - 1;
  const pan = Math.max(-1, Math.min(1, nx)) * 0.8;
  const out = Math.max(0, Math.abs(nx) - 1, Math.abs(ny) - 1);
  const edge = Math.max(Math.abs(nx), Math.abs(ny));
  const gain = Math.max(0.35, 1 - edge * 0.25 - out * 0.6);
  return { pan, gain };
}

// Effective bus levels from the settings: muted stops everything, music and effects have their own sliders.
// Make-up gain: the synthesised layers are mixed with headroom, so the buses lift them (the limiter catches peaks).
export const MAKEUP = { music: 1.5, sfx: 1.8 };
export function busLevels(settings) {
  const master = settings.muted ? 0 : Math.max(0, Math.min(1, settings.masterVolume ?? 0.5));
  return { music: master * MAKEUP.music * Math.max(0, Math.min(1, settings.musicVolume ?? 0.6)), sfx: master * MAKEUP.sfx * Math.max(0, Math.min(1, settings.sfxVolume ?? 0.8)) };
}

export class CombatMix {
  constructor() { this.times=[]; }
  played(now) { this.times.push(now); this.gain(now); }
  gain(now) {
    this.times=this.times.filter(t=>now-t < MIX.combatWindow);
    return this.times.length>MIX.combatThreshold ? 10**(MIX.duckDb/20) : 1;
  }
}

// ---------------------------------------------------------------- weight: mix rules
export const dbToGain = (db) => 10 ** (db / 20);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Distance from the camera: zoomed out, the whole field is a little quieter.
export function zoomGain(zoom) {
  if (!Number.isFinite(zoom)) return 1;
  const [near, far] = MIX.zoomRange;
  return 1 - MIX.zoomQuiet * clamp01((zoom - near) / (far - near));
}
// Screen position (pan, off-screen attenuation) times the zoom gain.
export function spatialMix(x, y, width, height, zoom) {
  const m = screenMix(x, y, width, height);
  return { pan: m.pan, gain: m.gain * zoomGain(zoom) };
}
// Small sounds (light shots, impacts) far off screen are skipped: they would only fill voices.
// Heavy weapons and explosions always sound (quietly), so a distant battle is still heard.
export const shouldCull = (group, gain, heavy = false) => !heavy && (group === "weapon" || group === "impact") && gain < MIX.cullGain;
// Closeness 0..1 from a distance gain (0.35 far off screen .. 1 in the middle).
export const closeness = (gain) => clamp01((gain - 0.35) / 0.65);
// Priority bonus for nearer sounds, so a big fight keeps what is on screen.
export const nearPriority = (priority, gain) => priority + closeness(gain) * 0.9;

// Combat intensity from heard combat sounds (see MIX.intensity). Pure and clock-driven.
export class CombatIntensity {
  constructor(o = MIX.intensity) { this.o = o; this.sum = 0; this.at = 0; this.peak = 0; this.fightAt = -Infinity; }
  sumAt(now) { return this.sum * Math.exp(-Math.max(0, now - this.at) / this.o.tau); }
  raw(now) { return 1 - Math.exp(-this.sumAt(now) / this.o.scale); }
  held(now) {
    if (!Number.isFinite(this.fightAt)) return 0;
    const after = now - this.fightAt - this.o.hold;
    return after <= 0 ? this.peak : this.peak * Math.exp(-after / this.o.release);
  }
  add(now, weight) {
    if (!(weight > 0)) return this.level(now);
    const held = this.held(now);
    this.sum = this.sumAt(now) + weight; this.at = now;
    const raw = this.raw(now);
    if (raw >= this.o.enter) { this.peak = Math.max(held, raw); this.fightAt = now; }
    return this.level(now);
  }
  level(now) { return Math.max(this.raw(now), this.held(now)); }
  reset() { this.sum = 0; this.at = 0; this.peak = 0; this.fightAt = -Infinity; }
}
// Intensity -> layer gains. `floor` is the least combat layer the mood asks for.
export function crossfade(intensity, floor = 0) {
  const combat = Math.max(clamp01(floor), smoothstep(MIX.intensity.enter, MIX.intensity.full, intensity));
  return { combat, base: 1 - MIX.baseDip * combat };
}
// The least combat layer for a mood: a mission asking for battle gets it all, a recent fight a little.
export const combatFloor = (mood, missionMood) => (missionMood === "battle" ? 1 : mood === "battle" ? MIX.battleFloor : 0);

// Loud events duck the music: the deepest active duck wins, scaled by closeness. `delay` = the
// explosion starts later (a shell in flight), so its duck does too.
export class LoudDuck {
  constructor() { this.ducks = []; }
  hit(now, size, gain = 1, delay = 0) {
    const spec = MIX.loudDuck[size];
    if (!spec) return;
    const db = spec[0] * (0.4 + 0.6 * closeness(gain));
    this.ducks.push({ db, from: now + delay, until: now + delay + spec[1] });
  }
  db(now) {
    let d = 0;
    this.ducks = this.ducks.filter((x) => x.until > now);
    for (const x of this.ducks) if (x.from <= now) d = Math.min(d, x.db);
    return d;
  }
  gain(now) { return dbToGain(this.db(now)); }
}

// Radio replies: the kind of reply an order gets (null = no reply).
export function radioKind(orderType) {
  if (orderType === "attack" || orderType === "attackmove") return "attack";
  if (orderType === "build") return "build";
  if (["move", "patrol", "gather", "deliver", "repair", "support", "rally"].includes(orderType)) return "move";
  return null;
}
// Rate limit for radio replies (MIX.radio): one at a time, not the same reply again and again.
export class RadioGate {
  constructor(o = MIX.radio) { this.o = o; this.last = -Infinity; this.byKind = new Map(); }
  allow(kind, now) {
    if (!kind || now - this.last < this.o.gap) return false;
    const gap = kind === "contact" ? this.o.contact : this.o.sameKind;
    if (now - (this.byKind.get(kind) ?? -Infinity) < gap) return false;
    this.last = now; this.byKind.set(kind, now);
    return true;
  }
}
// Enemy contact: the first visible enemy of a match, and again after MIX.radio.quiet seconds with none.
export class ContactWatch {
  constructor(quiet = MIX.radio.quiet) { this.quiet = quiet; this.seenAt = -Infinity; }
  update(now, visibleEnemies) {
    if (!(visibleEnemies > 0)) return false;
    const fresh = now - this.seenAt > this.quiet;
    this.seenAt = now;
    return fresh;
  }
  reset() { this.seenAt = -Infinity; }
}

// Engine hum: own vehicles, each { selected, moving, gain } -> one loop's level 0..1 and rate.
export function engineMix(vehicles) {
  const o = MIX.engine;
  let sum = 0, moving = 0, weight = 0;
  for (const v of vehicles) {
    const w = v.selected ? (v.moving ? 1 : o.idle) : v.moving ? o.unselected : 0;
    if (!w) continue;
    const g = w * clamp01(v.gain ?? 1);
    sum += g; weight += g; if (v.moving) moving += g;
  }
  const level = clamp01(sum);
  const share = weight > 0 ? moving / weight : 0;
  return { level, rate: o.rate[0] + (o.rate[1] - o.rate[0]) * share };
}
