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
// Writing rules: docs/WORLD.md; every line also goes to src/locales/story-vi.json and
// docs/aaa/review/story-lines.md.
export const FLASHES = ["relay", "dark", "alarm"];

export const SCENES = {
  // Mission 1: the river relay answers, and the Ashfall camp across the water goes dark.
  "relay-wakes": {
    letterbox: true,
    beats: [
      { camera: { at: "oldRelay", zoom: 0.8, seconds: 2.4 } },
      { fx: { flash: "relay" } },
      { say: { who: "okoro", text: "It is answering. Four hundred years asleep, and it is answering us, Commander." } },
      { camera: { at: "ford", zoom: 1, seconds: 1.8 } },
      { fx: { flash: "dark" } },
      { say: { who: "vale", text: "Every light in the Ashfall camp just went out. The same second our relay woke." } },
      { wait: 0.5 },
    ],
  },
  // Mission 4: Hale and Sol agree a truce on the radio and turn on the player together.
  "the-truce": {
    letterbox: true,
    beats: [
      { camera: { at: "oasisCentre", zoom: 1.1, seconds: 2.4 } },
      { say: { who: "hale", text: "Captain Sol. Every relay Meridian lights, we both lose power. A truce, until they are gone?" } },
      { say: { who: "sol", text: "I do not like you, Director. But my wells are dropping. Agreed, for today." } },
      { fx: { flash: "alarm" } },
      { say: { who: "vale", text: "Both columns are turning toward the centre oasis, Commander. Together." } },
    ],
  },
  // Mission 8: the vault door opens and ECHO tells the truth.
  "echo-wakes": {
    letterbox: true,
    beats: [
      { camera: { at: "vaultGate", zoom: 0.75, seconds: 2.4 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "Door open. This one is ECHO, caretaker of the Lattice. You are the first to ask in 412 years." } },
      { say: { who: "echo", text: "The Builders did not fall. They left, and set the Lattice to sleep so the crystal could regrow." } },
      { say: { who: "echo", text: "A man in a grey coat took the Keystone key nine days ago. He means to draw all the power at once." } },
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
      { say: { who: "echo", text: "Sixty-four relays in tune. Look up, Archivist. The sky is quiet." } },
      { say: { who: "maren", text: "The Crown is lit and the sky is clear. No storm. In thirty years I never once saw that." } },
      { wait: 0.5 },
    ],
  },
  // Mission 11: the last conduit falls and the draw stops.
  "draw-cut": {
    letterbox: true,
    beats: [
      { camera: { at: "conduitNorth", zoom: 0.85, seconds: 2.4 } },
      { fx: { flash: "dark" } },
      { say: { who: "echo", text: "The north conduit is dark. The Lattice is tired, but it is whole. Thank you." } },
      { say: { who: "hale", text: "Three conduits cut. My schedule has lost a day, Commander. The engine on the Keystone has not." } },
    ],
  },
  // Mission 12, the ending beat. Two or more merciful orders: the Keystone opens to every camp.
  "keystone-open": {
    letterbox: true,
    beats: [
      { camera: { at: "keystone", zoom: 0.75, seconds: 2.8 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "The engine is silent. Tuning the Keystone for every camp. One hundred and eight relays are answering." } },
      { say: { who: "sol", text: "Four camps, one circuit. I can see the dunes glowing from here, Commander." } },
      { say: { who: "echo", text: "I can see every camp from here. All of them are lit." } },
    ],
  },
  // Mission 12, the ending beat. Fewer merciful orders: Meridian holds the Keystone alone.
  "keystone-held": {
    letterbox: true,
    beats: [
      { camera: { at: "keystone", zoom: 0.75, seconds: 2.8 } },
      { fx: { flash: "relay" } },
      { say: { who: "echo", text: "The engine is silent. Tuning the Keystone. One hundred and eight relays are answering." } },
      { say: { who: "vale", text: "Meridian towers on every road to the Keystone. It is ours to guard now, Commander." } },
      { wait: 0.5 },
    ],
  },
};

// How long a line stays up in a scene: shorter than in play (the match waits), long enough to read.
export const sceneLineSeconds = (text) => Math.min(5.5, Math.max(2.6, 1.6 + String(text).length * 0.04));
// Seconds one beat takes when played in full.
export const beatSeconds = (beat) => (beat.camera ? beat.camera.seconds ?? 2
  : beat.say ? sceneLineSeconds(beat.say.text)
    : beat.wait !== undefined ? beat.wait
      : beat.fx ? 0.3 : 0);
export const sceneSeconds = (scene) => (scene?.beats || []).reduce((sum, beat) => sum + beatSeconds(beat), 0);
// Every line of a scene, in order (the Comms log keeps them when the scene is skipped).
export const sceneLines = (scene) => (scene?.beats || []).filter((b) => b.say).map((b) => b.say);
