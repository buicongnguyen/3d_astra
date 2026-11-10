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
export const MAP_FLAVOUR = {
  classic: { root: 50, scale: "dorian", wave: "triangle", pad: "sine", cutoff: 2600, degrees: [0, 5, 3, 4] },
  riverlands: { root: 53, scale: "lydian", wave: "sine", pad: "triangle", cutoff: 3200, degrees: [0, 4, 5, 3] },
  basin: { root: 48, scale: "phrygian", wave: "sawtooth", pad: "triangle", cutoff: 1900, degrees: [0, 1, 5, 4] },
  expanse: { root: 57, scale: "aeolian", wave: "triangle", pad: "sine", cutoff: 2800, degrees: [0, 5, 2, 6] },
  dunes: { root: 52, scale: "phrygianDominant", wave: "sawtooth", pad: "sine", cutoff: 2200, degrees: [0, 1, 0, 6] },
  woodlands: { root: 55, scale: "pentatonic", wave: "sine", pad: "triangle", cutoff: 3400, degrees: [0, 2, 3, 1] },
  highlands: { root: 49, scale: "minorPentatonic", wave: "sawtooth", pad: "sine", cutoff: 1700, degrees: [0, 3, 4, 2] },
};
// Faction motifs: scale-degree sequences (with beat lengths) that tag the enemy of a mission.
export const FACTION_MOTIF = {
  meridian: { degrees: [0, 2, 4, 7], beats: [1, 1, 1, 2] },
  ashfall: { degrees: [0, 0, 3, 2], beats: [0.75, 0.25, 1, 2] },
  sunward: { degrees: [0, 2, 4, 2], beats: [1, 1, 1, 1] },
  veil: { degrees: [0, 1, 6, 3], beats: [1.5, 0.5, 1, 1] },
  wardens: { degrees: [0, 4, 0, 5], beats: [2, 1, 1, 2] },
};
export const flavourFor = (map) => MAP_FLAVOUR[map] || MAP_FLAVOUR.classic;
export const MOOD_TEMPO = { calm: 66, tense: 84, battle: 122, victory: 104, defeat: 54 };

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
    for (let i = 0; i < 4; i++) if (rnd() < 0.55) add(i + (rnd() < 0.5 ? 0 : 0.5), "pluck", deg(pick(chord) + pick([0, 7])) + 12, 1.5, 0.45 + rnd() * 0.2);
    if (bar % 4 === 0) add(0, "bass", deg(chordDegree) - 12, 4, 0.5);
  } else if (mood === "tense") {
    add(0, "bass", deg(chordDegree) - 12, 1.5, 0.6);
    add(2, "bass", deg(chordDegree) - 12, 1.5, 0.5);
    for (let i = 0; i < 8; i++) if (i % 2 === 0 || rnd() < 0.4) add(i / 2, "pluck", deg(pick([chordDegree, chordDegree + 1, chordDegree + 4, chordDegree + 2])) + 12, 0.4, 0.4);
    for (let i = 0; i < 4; i++) add(i, "tick", 0, 0.1, 0.25);
    if (bar % 2 === 0) add(0, "pad", deg(chordDegree) + 12, 8, 0.4), add(0, "pad", deg(chordDegree + 1) + 12, 8, 0.25);
  } else if (mood === "battle") {
    for (let i = 0; i < 4; i++) add(i, "kick", 0, 0.2, 0.9);
    add(1, "snare", 0, 0.2, 0.7); add(3, "snare", 0, 0.2, 0.7);
    for (let i = 0; i < 8; i++) add(i / 2 + 0.25, "hat", 0, 0.1, 0.35);
    for (let i = 0; i < 8; i++) add(i / 2, "bass", deg(i % 4 === 3 ? chordDegree + 4 : chordDegree) - 12, 0.4, 0.7);
    for (let i = 0; i < 4; i++) if (rnd() < 0.7) add(i + 0.5 * (rnd() < 0.4 ? 1 : 0), "lead", deg(pick(chord) + pick([0, 0, 7])) + 12, 0.8, 0.5);
    if (bar % 4 === 0) add(0, "pad", deg(chordDegree) + 12, 16, 0.35);
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
// Voice budget with priority: at most `max` sounds at once. A newcomer that is quieter in
// priority than everything sounding is dropped; otherwise it replaces the lowest priority voice
// (the replaced entry is returned so its gain can be faded). `gap` limits one sound's rate.
export class VoiceBudget {
  constructor(max = 14) { this.max = max; this.voices = []; this.lastPlayed = new Map(); }
  tryAcquire(name, priority, now, duration, gap = 0) {
    this.voices = this.voices.filter((v) => v.end > now);
    if (gap && now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return null;
    let stolen = null;
    if (this.voices.length >= this.max) {
      let low = this.voices[0];
      for (const v of this.voices) if (v.priority < low.priority || (v.priority === low.priority && v.end < low.end)) low = v;
      if (low.priority >= priority) return null;
      this.voices.splice(this.voices.indexOf(low), 1);
      stolen = low;
    }
    const voice = { name, priority, end: now + duration };
    this.voices.push(voice);
    this.lastPlayed.set(name, now);
    return { voice, stolen };
  }
  get active() { return this.voices.length; }
}

// Sound name, priority and rate gap for a simulation event. null = silent event.
export function soundFor(event) {
  switch (event.type) {
    case "shot": return { name: `shot:${event.weapon || "vanguard"}`, priority: 2, gap: 0.05 };
    case "impact": return { name: event.shield ? "impact:shield" : event.building ? "impact:building" : "impact:body", priority: 1, gap: 0.07 };
    case "death": return { name: event.building ? "boom:building" : event.heavy ? "boom:heavy" : "boom:small", priority: 5, gap: 0.08 };
    case "strike": return { name: "boom:strike", priority: 6, gap: 0.1 };
    case "built": return { name: "complete", priority: 4, gap: 0.2 };
    case "spawn": return { name: "trained", priority: 3, gap: 0.12 };
    case "ability": return { name: `ability:${event.ability}`, priority: 6, gap: 0.1 };
    case "promote": return { name: "promote", priority: 7, gap: 0.3 };
    case "point": return { name: event.owner === 0 ? "capture" : "lost", priority: 8, gap: 0.3 };
    case "incoming": return { name: "alarm", priority: 8, gap: 2 };
    default: return null;
  }
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
