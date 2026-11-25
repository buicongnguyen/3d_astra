// Staged scenes (release 0.19b "Story you see", docs/aaa/STAGE_4_STORY.md package 4.1). A scene is
// a short sequence the client plays while the match is held: letterbox bars, eased camera moves,
// lines in the dialogue box and small screen effects. A mission starts one with the action
// `{ scene: id }` (src/sim/missions.js), which only emits an event: nothing in the simulation
// waits for a scene or depends on how long it ran, so saves and replays are unaffected and a save
// taken during a scene continues after it. The player can skip any scene (Skip, Escape, Space);
// skipped lines still go to the Comms log.
//
// Beats, played in order:
//   { camera: { at, zoom, seconds } }  ease to a region of the mission (or { x, z }) in `seconds`;
//                                      `zoom` is a factor of the standard view (1 = default, smaller
//                                      is closer). A place the player has not explored is skipped,
//                                      so a scene never scouts for them; motion-off cuts instead.
//   { say: { who, text } }             a line in the dialogue box (CAST id), held for its reading time
//   { fx: { flash } }                  a screen glow: "relay" (teal), "dark" (lights out), "alarm" (warm)
//   { wait: seconds }                  a pause
//   { title: { text, sub } }           a name card inside the scene (a boss's entrance), held 1.8 s
//   { shake: amount }                  camera trauma 0 to 1 (a heavy footfall, a blast), 0.3 s
// Writing rules: docs/WORLD.md; every line also goes to src/locales/story-vi.json and
// docs/aaa/review/story-lines.md.
export const TITLE_BEAT_SECONDS = 1.8;
export const FLASHES = ["relay", "dark", "alarm"];

export const SCENES = {
  // Mission 1: the river relay answers, and the Ashfall camp across the water goes dark.
  "relay-wakes": {
    letterbox: true,
    beats: [
      { camera: { at: "oldRelay", zoom: 0.8, seconds: 2.4 } },
      { fx: { flash: "relay" } },
      { say: { who: "okoro", text: "It is answering us, after four hundred years of sleep!" } },
      { camera: { at: "ford", zoom: 1, seconds: 1.8 } },
      { fx: { flash: "dark" } },
      { say: { who: "vale", text: "Every Ashfall light died the moment our relay woke." } },
      { wait: 0.5 },
    ],
  },
  // Mission 4: Hale and Sol agree a truce on the radio and turn on the player together.
  "the-truce": {
    letterbox: true,
    beats: [
      { camera: { at: "oasisCentre", zoom: 1.1, seconds: 2.4 } },
      { say: { who: "hale", text: "Captain Sol. Meridian drains us both. A truce?" } },
      { say: { who: "sol", text: "I do not like you, Director. But agreed, for today." } },
      { fx: { flash: "alarm" } },
      { say: { who: "vale", text: "Both columns are turning toward the centre oasis. Together." } },
    ],
  },
  // Mission 3 (bosses, docs/aaa/BOSSES.md): the Iron Vanguard powers up in Hale's salvage yard.
  "iron-vanguard": {
    letterbox: true,
    beats: [
      { camera: { at: "vanguardYard", zoom: 0.8, seconds: 2.2 } },
      { fx: { flash: "alarm" } },
      { shake: 0.5 },
      { title: { text: "Iron Vanguard", sub: "Salvaged war machine" } },
      { say: { who: "okoro", text: "That is no Ashfall design! It is a Builder war machine!" } },
      { say: { who: "hale", text: "The Iron Vanguard. Nine weeks to dig out." } },
      { say: { who: "vale", text: "It marks the ground before firing. Avoid the red." } },
    ],
  },
  // Wings over Copper (0.18.3): the first Ember balloon drifts over the copper works.
  "first-balloon": {
    letterbox: true,
    beats: [
      { camera: { at: "refinery", zoom: 1.15, seconds: 2.2 } },
      { fx: { flash: "alarm" } },
      { say: { who: "okoro", text: "A fire balloon, drifting at the refinery!" } },
      { say: { who: "vale", text: "Towers cannot reach Ember balloons. Rangers can." } },
      { say: { who: "vale", text: "Research Anti-air guns at the Command core. Towers will shoot up." } },
    ],
  },
  // Mission 8: the vault door opens and ECHO tells the truth.
  "echo-wakes": {
    letterbox: true,
    beats: [
      { camera: { at: "vaultGate", zoom: 0.75, seconds: 2.4 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "Door open. This one is ECHO. First visitors in 412 years." } },
      { say: { who: "echo", text: "The Builders did not fall. They left." } },
      { say: { who: "echo", text: "A grey coat took the Keystone key. He wants all the power." } },
      { fx: { flash: "alarm" } },
      { wait: 0.4 },
    ],
  },
  // Mission 10: the Crown lights with no storm, and Maren sees it.
  "crown-lights": {
    letterbox: true,
    beats: [
      { camera: { at: "crown", zoom: 0.8, seconds: 2.4 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "Sixty-four relays in tune. Look up, Archivist." } },
      { say: { who: "maren", text: "The Crown is lit, with no storm. Never before." } },
      { wait: 0.5 },
    ],
  },
  // Mission 11: the last conduit falls and the draw stops.
  "draw-cut": {
    letterbox: true,
    beats: [
      { camera: { at: "conduitNorth", zoom: 0.85, seconds: 2.4 } },
      { fx: { flash: "dark" } },
      { say: { who: "echo", text: "The north conduit is dark. The Lattice is whole." } },
      { say: { who: "hale", text: "Three conduits cut. I lost a day. The engine did not." } },
    ],
  },
  // Wardens Chronicle, Without a Key (chronicles round 2): the Iron Sovereign walks on the Warden Rise.
  "sovereign-at-the-rise": {
    letterbox: true,
    beats: [
      { camera: { at: "gate", zoom: 0.9, seconds: 2.2 } },
      { fx: { flash: "alarm" } },
      { shake: 0.5 },
      { title: { text: "Iron Sovereign", sub: "Walking siege fortress" } },
      { say: { who: "rask", text: "There, from the north! Hale taught it to walk." } },
      { camera: { at: "line", zoom: 1.1, seconds: 1.8 } },
      { say: { who: "echo", text: "An old machine, with no key either. Only orders." } },
    ],
  },
  // Mission 12, the ending beat. Two or more merciful orders: the Keystone opens to every camp.
  "keystone-open": {
    letterbox: true,
    beats: [
      { camera: { at: "keystone", zoom: 0.75, seconds: 2.8 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "The engine is silent. Tuning the Keystone for all." } },
      { say: { who: "sol", text: "Four camps, one circuit. The dunes are glowing!" } },
      { say: { who: "echo", text: "I can see every camp from here. All lit." } },
    ],
  },
  // Mission 12, the ending beat. Fewer merciful orders: Meridian holds the Keystone alone.
  "keystone-held": {
    letterbox: true,
    beats: [
      { camera: { at: "keystone", zoom: 0.75, seconds: 2.8 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "The engine is silent. One hundred and eight relays answer." } },
      { say: { who: "vale", text: "Meridian towers on every Keystone road. Ours to guard." } },
      { wait: 0.5 },
    ],
  },
  // Mission 8 (creature round): the Commander strikes the vault's guardian and it rises for its test.
  "vault-sentinel": {
    letterbox: true,
    beats: [
      { camera: { at: "sentinelPost", zoom: 0.8, seconds: 1.8 } },
      { fx: { flash: "relay" } },
      { shake: 0.4 },
      { title: { text: "Vault Sentinel", sub: "Builder guardian" } },
      { say: { who: "okoro", text: "It is standing! Do not destroy it. Show strength." } },
    ],
  },
  // Mission 12 (creature round, Veil story): after the first offensive the Veil steps off Hale's line.
  "veil-turns": {
    letterbox: true,
    beats: [
      { camera: { at: "westBank", zoom: 1, seconds: 2 } },
      { say: { who: "maren", text: "A week of readings. Hale's engine empties the Lattice." } },
      { say: { who: "lind", text: "Teo Lind here, captain of the Veil Shades. Half my crews left his line." } },
      { say: { who: "vale", text: "Then let them watch. Every idle Shade is one gun fewer." } },
    ],
  },
};

// How long a line stays up in a scene: shorter than in play (the match waits), long enough to read.
export const sceneLineSeconds = (text) => Math.min(5.5, Math.max(2.6, 1.6 + String(text).length * 0.04));
// Seconds one beat takes when played in full.
export const beatSeconds = (beat) => (beat.camera ? beat.camera.seconds ?? 2
  : beat.say ? sceneLineSeconds(beat.say.text)
    : beat.wait !== undefined ? beat.wait
      : beat.title ? TITLE_BEAT_SECONDS
        : beat.shake !== undefined ? 0.3
          : beat.fx ? 0.3 : 0);
export const sceneSeconds = (scene) => (scene?.beats || []).reduce((sum, beat) => sum + beatSeconds(beat), 0);
// Every line of a scene, in order (the Comms log keeps them when the scene is skipped).
export const sceneLines = (scene) => (scene?.beats || []).filter((b) => b.say).map((b) => b.say);
