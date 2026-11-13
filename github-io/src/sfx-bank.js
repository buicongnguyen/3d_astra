// The rendered effect bank: weapons, impacts, explosions, radio replies and engine loops, as specs for
// audio-synth.js (all made in code, no audio files). Sound design rules used throughout:
//   transient (a "crack": bright noise for a few ms) + body (band-passed noise, a pitched thump with a
//   falling pitch) + tail (low rumble, debris rattle, a short outdoor echo), and bigger = longer, lower
//   and with more debris. Level is the peak after rendering (0..1); the mix scales it again.
import { FACTION_MOTIF, SCALES } from "./audio-logic.js";

// ---------------------------------------------------------------- building blocks
const crack = (hz, at = 0, g = 1, len = 0.01) => ({ k: "noise", f: "hp", f0: hz, f1: hz * 0.7, q: 0.7, at, a: 0.0004, d: len, dur: len * 6, g });
const thump = (f0, f1, d, at = 0, g = 1) => ({ k: "tone", w: "sine", f0, f1, glide: d * 1.5, at, a: 0.0015, d, dur: d * 5, g });
const body = (f, f0, f1, d, at = 0, g = 1, q = 0.8) => ({ k: "noise", f, f0, f1, glide: d * 2, q, at, a: 0.001, d, dur: d * 5, g });
const debris = (n, at, spread, f = [900, 4500], q = 3, g = 0.4, len = [0.004, 0.03]) => ({ k: "grains", n, at, spread, len, f, q, g, skew: 1.6 });
const ring = (hz, d, at = 0, g = 0.12) => ({ k: "tone", w: "sine", f0: hz, at, a: 0.001, d, dur: d * 5, g });
// The same layers again, `count` times `gap` seconds apart, each a little different in level.
const burst = (count, gap, layers) => Array.from({ length: count }, (_, i) => layers.map((l) => ({ ...l, at: (l.at || 0) + i * gap, g: (l.g ?? 1) * (i ? 0.85 + 0.1 * (i % 2) : 1) }))).flat();

// Short outdoor reflections (feedback combs). `tail` is extra length rendered for the echo.
export const ROOM = {
  slap: { combs: [[0.067, 0.22], [0.103, 0.18]], lp: 2600, mix: 0.3, tail: 0.3 },
  field: { combs: [[0.089, 0.4], [0.137, 0.35], [0.211, 0.28]], lp: 1500, mix: 0.42, tail: 0.6 },
};

// An explosion of size `s` (0.4 small shell .. 1.8 Command core) starting at `at`:
//   crack (bright, a few ms) + blast body (band-passed noise falling) + boom (sine, pitch drop, lower and
//   longer when bigger) + fire body (low-passed noise, cutoff falling) + debris rattle + rumble tail.
export function blast(s, at = 0, g = 1) {
  return [
    crack(3200, at, 0.9 * g, 0.006 + 0.006 * s),
    body("bp", 2200, 420, 0.035 + 0.05 * s, at, 0.9 * g, 0.7),
    thump(70 + 60 / s, 30 + 6 / s, 0.1 + 0.22 * s, at, 1.1 * g),
    body("lp", 1900, 120, 0.1 + 0.28 * s, at + 0.004, 1.1 * g, 0.7),
    debris(Math.round(8 + 30 * s), at + 0.05, 0.2 + 0.7 * s, [800, 4800], 3, 0.5 * g),
    { k: "noise", f: "lp", f0: 340, f1: 80, glide: 1.5 * s, q: 0.6, at: at + 0.03, a: 0.05 * s, d: 0.3 + 0.55 * s, dur: 0.5 + 1.6 * s, g: 0.45 * g },
  ];
}

// ---------------------------------------------------------------- weapons, impacts, explosions
const rifle = (hz = 4200, g = 1) => [crack(hz, 0, g, 0.006), body("bp", 1600, 900, 0.02, 0, 0.9 * g, 1.1), thump(180, 90, 0.022, 0, 0.6 * g), body("lp", 900, 300, 0.045, 0.004, 0.35 * g)];
const tankShot = [crack(3000, 0, 1, 0.012), body("bp", 1400, 300, 0.07, 0, 1, 0.7), thump(105, 40, 0.2, 0, 1.15), body("lp", 1500, 150, 0.2, 0.003, 1, 0.7)];
// Reload clank of a cannon, a little after the shot.
const clank = (at) => [{ k: "tone", w: "square", f0: 620, f1: 590, at, a: 0.001, d: 0.012, dur: 0.06, g: 0.12 }, body("bp", 3000, 2600, 0.015, at, 0.4, 6)];

export const BANK = {
  // Weapons: one voice per unit class.
  "shot:rifle": { level: 0.5, drive: 2, room: ROOM.slap, layers: rifle() },
  "shot:smg": { level: 0.46, drive: 2, room: ROOM.slap, layers: burst(3, 0.072, rifle(3000, 0.9)) },
  "shot:silenced": { level: 0.3, layers: burst(2, 0.11, [body("lp", 1100, 500, 0.016, 0, 1), thump(240, 120, 0.02, 0, 0.6), crack(6000, 0, 0.2, 0.003), { k: "tone", w: "square", f0: 1800, at: 0.03, a: 0.0005, d: 0.004, dur: 0.02, g: 0.08 }]) },
  "shot:scrap": { level: 0.52, drive: 2.5, room: ROOM.slap, layers: [crack(2600, 0, 1, 0.01), body("bp", 1100, 500, 0.055, 0, 1, 0.6), thump(130, 60, 0.05, 0, 0.8), ring(1870, 0.08), ring(2650, 0.06, 0.003, 0.08), debris(5, 0.02, 0.12, [2000, 5000], 6, 0.25)] },
  "shot:flame": { level: 0.4, layers: [{ k: "noise", f: "lp", f0: 500, f1: 1600, glide: 0.12, q: 0.9, a: 0.03, d: 0.16, dur: 0.45, g: 1 }, { k: "noise", f: "bp", f0: 2500, q: 0.8, a: 0.01, d: 0.05, dur: 0.2, g: 0.35 }, thump(65, 50, 0.15, 0, 0.5), debris(10, 0.02, 0.3, [2500, 6000], 2, 0.25, [0.002, 0.008])] },
  "shot:rocket": { level: 0.55, drive: 1.5, room: ROOM.slap, layers: [crack(3000, 0, 0.7, 0.006), thump(320, 110, 0.025, 0, 0.6), { k: "noise", f: "bp", f0: 700, f1: 2600, glide: 0.25, q: 1.6, at: 0.01, a: 0.03, d: 0.14, dur: 0.5, g: 1.2 }, { k: "noise", f: "lp", f0: 400, f1: 900, glide: 0.3, at: 0.01, a: 0.02, d: 0.2, dur: 0.6, g: 0.5 }] },
  "shot:rail": { level: 0.5, room: ROOM.slap, layers: [crack(5200, 0, 1, 0.005), { k: "tone", w: "saw", f0: 2600, f1: 500, glide: 0.07, a: 0.001, d: 0.04, dur: 0.2, g: 0.3 }, { k: "tone", w: "sine", f0: 3400, f1: 1500, glide: 0.1, a: 0.001, d: 0.05, dur: 0.25, g: 0.2 }, body("bp", 1800, 900, 0.03, 0, 0.7, 1.2), thump(150, 80, 0.03, 0, 0.5)] },
  "shot:drone": { level: 0.42, layers: [{ k: "tone", w: "saw", f0: 1900, f1: 700, glide: 0.05, a: 0.001, d: 0.03, dur: 0.15, g: 0.4 }, { k: "tone", w: "sine", f0: 3200, f1: 1600, glide: 0.06, a: 0.001, d: 0.03, dur: 0.15, g: 0.25 }, crack(5000, 0, 0.6, 0.004), body("bp", 1300, 900, 0.02, 0, 0.5, 1.5)] },
  "shot:tank": { level: 0.78, drive: 2.2, room: ROOM.field, layers: [...tankShot, ...clank(0.62)] },
  "shot:walker": { level: 0.78, drive: 2.2, room: ROOM.field, layers: [...tankShot, { k: "tone", w: "saw", f0: 280, f1: 520, glide: 0.35, at: 0.22, a: 0.05, d: 0.12, dur: 0.5, g: 0.1 }, { k: "noise", f: "hp", f0: 3500, at: 0.28, a: 0.02, d: 0.1, dur: 0.4, g: 0.18 }] },
  "shot:artillery": { level: 0.76, drive: 2, room: ROOM.field, layers: [crack(2000, 0, 0.6, 0.015), thump(78, 34, 0.32, 0, 1.25), body("lp", 800, 110, 0.28, 0.004, 1, 0.7), body("bp", 900, 300, 0.06, 0, 0.6, 0.8)] },
  "shot:tower": { level: 0.6, drive: 2, room: ROOM.slap, layers: burst(2, 0.13, [crack(3400, 0, 1, 0.008), body("bp", 1200, 500, 0.04, 0, 0.9, 0.8), thump(150, 70, 0.05, 0, 0.8), ring(1320, 0.05)]) },
  // Impacts on the target (every hit) and the explosions of heavy rounds landing.
  "impact:body": { level: 0.28, layers: [body("lp", 1600, 300, 0.025, 0, 1, 0.8), thump(150, 70, 0.03, 0, 0.7), crack(4500, 0, 0.25, 0.003)] },
  "impact:building": { level: 0.32, layers: [body("bp", 1000, 350, 0.04, 0, 1, 0.8), { k: "tone", w: "square", f0: 220, f1: 100, glide: 0.04, a: 0.001, d: 0.02, dur: 0.1, g: 0.2 }, debris(5, 0.01, 0.15, [1200, 4000], 4, 0.35)] },
  "impact:shield": { level: 0.3, layers: [{ k: "tone", w: "sine", f0: 1500, f1: 900, glide: 0.15, a: 0.001, d: 0.08, dur: 0.3, g: 0.6 }, { k: "tone", w: "sine", f0: 2250, f1: 1350, glide: 0.12, at: 0.005, a: 0.001, d: 0.06, dur: 0.25, g: 0.3 }, { k: "noise", f: "hp", f0: 5000, f1: 3000, a: 0.0005, d: 0.02, dur: 0.08, g: 0.3 }] },
  "hit:small": { level: 0.5, drive: 1.8, layers: blast(0.45) },
  "hit:rocket": { level: 0.6, drive: 1.8, layers: blast(0.65) },
  "hit:shell": { level: 0.7, drive: 2, room: ROOM.slap, layers: blast(0.85) },
  "hit:artillery": { level: 0.82, drive: 2, room: ROOM.field, layers: [...blast(1.1), thump(55, 28, 0.4, 0.01, 0.6)] },
  // A Barrage shell coming in (sfx.js plays it where it will land, ending as it hits): a whistle that
  // rises then falls over 0.8 s (a falling glide with one slow half-cycle of vibrato on top: 1.3 kHz
  // up to about 1.7 kHz, then down to 800 Hz), a faint octave above, and band-passed air rush,
  // all swelling as the shell gets closer.
  "incoming:shell": { level: 0.42, layers: [
    { k: "tone", w: "sine", f0: 1300, f1: 800, glide: 0.8, vib: [0.625, 0.6], a: 0.55, d: 0.6, dur: 0.8, g: 1 },
    { k: "tone", w: "sine", f0: 2600, f1: 1600, glide: 0.8, vib: [0.625, 0.6], a: 0.55, d: 0.6, dur: 0.8, g: 0.16 },
    { k: "noise", f: "bp", f0: 2400, f1: 1300, glide: 0.8, q: 3, a: 0.5, d: 0.6, dur: 0.8, g: 0.4 },
  ] },
  // Losses: a soldier down is a thud and a rattle of gear; vehicles, buildings and the core explode.
  "boom:small": { level: 0.38, layers: [body("lp", 700, 200, 0.06, 0, 1, 0.8), thump(120, 60, 0.06, 0, 0.9), debris(6, 0.03, 0.3, [1500, 4500], 5, 0.35, [0.003, 0.012])] },
  "boom:heavy": { level: 0.88, drive: 2, room: ROOM.field, layers: [...blast(1.2), ...blast(0.4, 0.38, 0.5), debris(36, 0.1, 1.1, [1500, 6500], 7, 0.35)] },
  "boom:strike": { level: 0.86, drive: 2, room: ROOM.field, layers: [...blast(1.2), debris(20, 0.15, 0.9, [600, 2500], 2, 0.3)] },
  "boom:building": { level: 0.95, drive: 2, room: ROOM.field, layers: [...blast(1.6), { k: "noise", f: "lp", f0: 500, f1: 90, glide: 1.6, q: 0.7, at: 0.15, a: 0.25, d: 0.8, dur: 2.6, g: 1.2 }, debris(60, 0.2, 1.8, [600, 3500], 3, 0.45, [0.006, 0.04])] },
  "boom:core": { level: 1, drive: 2.2, room: ROOM.field, len: 4, layers: [...blast(1.8), ...blast(0.7, 0.45, 0.7), ...blast(0.9, 1.05, 0.6), { k: "noise", f: "lp", f0: 450, f1: 70, glide: 2.4, q: 0.7, at: 0.2, a: 0.3, d: 1.1, dur: 3.6, g: 1 }, debris(80, 0.3, 2.4, [500, 3500], 3, 0.45, [0.006, 0.05])] },
};
export const BANK_NAMES = Object.keys(BANK);

// ---------------------------------------------------------------- radio replies
// Squelch open (noise burst) + a short tone motif (the faction's FACTION_MOTIF) + squelch close, all
// band-limited to a radio's 350-3000 Hz and a little distorted, over a faint hiss.
export const RADIO_VOICE = {
  meridian: { hz: 1180, w: "square", scale: "ionian", drive: 3 },
  ashfall: { hz: 760, w: "saw", scale: "aeolian", drive: 5 },
  sunward: { hz: 1400, w: "tri", scale: "ionian", drive: 2 },
  wardens: { hz: 980, w: "sine", scale: "dorian", drive: 2, fm: [2, 1.2] },
  veil: { hz: 620, w: "sine", scale: "phrygian", drive: 2, vib: [7, 0.03] },
};
export const RADIO_KINDS = ["move", "attack", "build", "contact"];
export function radioSpec(kind, faction = "meridian") {
  const v = RADIO_VOICE[faction] || RADIO_VOICE.meridian, motif = (FACTION_MOTIF[faction] || FACTION_MOTIF.meridian).degrees, scale = SCALES[v.scale];
  const semis = (d) => Math.floor(d / scale.length) * 12 + scale[((d % scale.length) + scale.length) % scale.length];
  const pattern = { move: [motif[0], motif[1], motif[2]], attack: [motif[0], motif[0], motif[2]], build: [motif[0], motif[2], motif[1]], contact: motif }[kind] || motif;
  const beat = kind === "attack" ? 0.05 : kind === "contact" ? 0.09 : 0.07, gap = kind === "attack" ? 0.02 : 0.03, base = v.hz * (kind === "contact" ? 0.8 : 1);
  const layers = [{ k: "noise", f: "bp", f0: 2600, q: 0.7, a: 0.001, d: 0.02, dur: 0.05, g: 0.8 }];
  let t = 0.05;
  pattern.forEach((d, i) => {
    const hz = base * 2 ** (semis(d) / 12);
    layers.push({ k: "tone", w: v.fm ? "sine" : v.w, f0: hz, at: t, a: 0.003, d: beat * 0.8, dur: beat, g: kind === "attack" && i === 0 ? 0.6 : 0.45, fm: v.fm, vib: v.vib });
    t += beat + gap;
  });
  layers.push({ k: "noise", f: "bp", f0: 3000, q: 0.6, at: t, a: 0.002, d: 0.04, dur: 0.09, g: 0.6 });
  layers.push({ k: "tone", w: "square", f0: 1800, at: t, a: 0.0005, d: 0.003, dur: 0.01, g: 0.2 });
  layers.push({ k: "noise", f: "hp", f0: 1800, a: 0.01, d: 2, dur: t + 0.09, g: 0.06 });
  return { level: kind === "contact" ? 0.4 : 0.34, drive: v.drive, band: [350, 3000], vary: 0, layers };
}

// ---------------------------------------------------------------- engine loops, one per faction
export const ENGINE = {
  meridian: { f: 44, harm: [[1, 0.45, "saw"], [2, 0.25, "sine"], [3, 0.12, "sine"]], noise: [380, 0.35], am: [22, 0.25], whine: [[760, 0.04]], lp: 900 },
  ashfall: { f: 34, harm: [[1, 0.5, "saw"], [2, 0.2, "square"]], noise: [300, 0.5], am: [17, 0.5], lp: 700 },
  sunward: { f: 62, harm: [[1, 0.3, "saw"], [2, 0.12, "square"]], noise: [700, 0.3], am: [31, 0.3], whine: [[1240, 0.03]], lp: 1400 },
  wardens: { f: 50, harm: [[1, 0.6, "sine"], [2, 0.1, "sine"]], noise: [500, 0.3], am: [3, 0.2], whine: [[600, 0.08], [900, 0.04]], lp: 1300 },
  veil: { f: 55, harm: [[1, 0.6, "sine"], [2, 0.2, "sine"]], noise: [250, 0.2], am: [2, 0.3], lp: 600 },
};
// ---------------------------------------------------------------- flyer loops (0.18), same format (whole Hz: seamless 1 s loops)
//   rotor   Kite and Hawk: a low hum chopped by the blades (deep, fast amplitude beat) over air noise
//   burner  Ember balloon: a soft roaring whoosh that swells slowly
//   prop    Swift glider: a small engine's buzz with a quick propeller beat
export const AIR_HUM = {
  rotor: { f: 38, harm: [[1, 0.35, "sine"], [2, 0.18, "saw"]], noise: [520, 0.55], am: [19, 0.6], lp: 1100 },
  burner: { f: 30, harm: [[1, 0.12, "sine"]], noise: [700, 0.9], am: [1, 0.65], lp: 900 },
  prop: { f: 96, harm: [[1, 0.35, "saw"], [2, 0.12, "square"]], noise: [900, 0.25], am: [32, 0.35], whine: [[1440, 0.02]], lp: 1700 },
};
export const airHumFor = (type) => (type === "balloon" ? "burner" : type === "glider" ? "prop" : "rotor");
