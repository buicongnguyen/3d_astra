// Data shared by the live mixer, offline renderer and pure tests. Every level the owner may want
// to tune after listening lives here (see docs/ARCHITECTURE.md, "Sound that has weight").
export const MIX = {identicalVoices:3,windowSeconds:.08,combatWindow:1,combatThreshold:6,duckDb:-4,pitchVariation:.04,auditionSeconds:2,
  // Voices sounding at once: all effects together, and per group (a big fight fills "weapon" first).
  maxVoices: 24,
  groupCaps: { weapon: 12, impact: 4, explosion: 8, radio: 1, ui: 4, moment: 6 },
  // Effect bank playback: overall level of rendered effects and the per-play jitter (cosmetic RNG).
  bankLevel: 0.55, gainJitterDb: 1,
  // Off-screen small sounds (shots, impacts) quieter than this distance gain are not played at all.
  cullGain: 0.45,
  // Zoomed all the way out the whole field is this much quieter (0.3 = about -3 dB).
  zoomQuiet: 0.3, zoomRange: [22, 88],
  // Loud events duck the music: [dB, seconds held] by size, scaled by closeness to the camera.
  loudDuck: { medium: [-3, 0.45], large: [-6, 0.9], huge: [-9, 1.6] },
  duckAttack: 0.03, duckRelease: 0.35,
  // Combat intensity -> music. Heard combat sounds add weight (times closeness); the sum decays with
  // `tau`; intensity = 1 - exp(-sum / scale). Once a fight registers (>= enter) its peak is held
  // `hold` seconds after the last such sound, then released with time constant `release`.
  intensity: { tau: 3, scale: 1.2, hold: 8, release: 2.5, enter: 0.12, full: 0.6 },
  intensityWeight: { shot: 0.12, heavyShot: 0.25, impact: 0.04, hit: 0.35, death: 0.5, heavyDeath: 0.8, building: 1, strike: 1 },
  // A mood of "battle" (any fight in the last 8 s) keeps at least this much combat layer; a mission
  // that asks for battle music gets the full layer.
  battleFloor: 0.35,
  // The calm/tense base layer dips by this share while the combat layer is full.
  baseDip: 0.55,
  // Radio replies: at most one per `gap` s, the same reply kind at most every `sameKind` s, enemy
  // contact at most every `contact` s and only after `quiet` s without a visible enemy.
  radio: { gap: 1.5, sameKind: 4, contact: 20, quiet: 30, level: 0.9 },
  // Engine hum of selected / moving own vehicles: bus level at full and the loop's rate range.
  engine: { level: 0.12, idle: 0.35, unselected: 0.3, rate: [0.85, 1.1] },
  // Recorded music (music-recorded.js): crossfade seconds between cues and to/from the adaptive score,
  // the loudness every track is trimmed to (from its manifest `lufs`, at most `maxTrimDb` either way),
  // and `level`, which offsets the music bus make-up gain the synthesised score needs.
  recorded: { crossfade: 1.2, stingFade: 0.05, targetLufs: -16, maxTrimDb: 9, level: 0.6 },
};
export const SOUND_TESTS = {trained:'Unit ready',research:'Research done','boom:building':'Building lost',objective:'Objective done','objective-failed':'Objective failed',win:'Mission won',lose:'Mission lost'};
