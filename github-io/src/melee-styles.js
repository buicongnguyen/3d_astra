// Blade fighters (2026-11-28, owner: "the similar vanguard unit of other faction should have similar slice and thrust move
// like vanguard instead of fire gun in short distance"). The three Vanguard-slot units fight in melee in the rules (range 2):
// the Meridian Vanguard with its sword, the Ashfall Scrapper with a scrap cleaver, the Veil Shade with a slim dark blade.
// All three swing on the Vanguard's timing (src/vanguard-sword.js: wind-up = visual-style.json `life`, contact, recovery),
// alternating a slice and a thrust; each keeps its faction's character in the arm poses and in the contact effect
// (src/fx.js swordContact). View only: nothing here reads or writes the simulation.
//
// Keyframes: [shoulder yaw, shoulder pitch, elbow bend, forward weight shift (model units)] for wind-up, contact, follow
// through. Yaw turns the point toward the unit's right (+), negative pitch raises the point.
// The Vanguard's arm bends at a real elbow. The Scrapper's and the Shade's whole arm turns at the shoulder (their
// SwordElbow sits on the shoulder, tools/blender/generate_factions.py), so the arm is one rigid part: one batch per type.
export const MELEE_TYPES = Object.freeze(["vanguard", "scrapper", "shade"]);
const MELEE = new Set(MELEE_TYPES);
export const isMeleeType = (type) => MELEE.has(type);

const frames = (rows) => Object.freeze(rows.map((r) => Object.freeze(r)));
export const MELEE_STYLE = Object.freeze({
  vanguard: Object.freeze({
    slash: frames([
      [1.16, -0.65, -0.12, -0.07], // raise the point outside the shield
      [-0.24, -0.39, 0.32, 0.19], // cross the target on a descending diagonal
      [-0.94, -0.04, 0.21, 0.13],
    ]),
    thrust: frames([
      [0.16, 0.68, -0.76, -0.13], // draw the elbow back while keeping the point forward
      [-0.22, -1.23, 1.16, 0.40], // drive from the shoulder, point level with the target
      [-0.24, -1.18, 1.14, 0.37],
    ]),
    wave: true, // the lightning crescent behind the edge (src/vanguard-wave.js)
    // Contact glint (fx.js swordContact): cyan Meridian light, a few warm sparks (fx.sparks); the others throw `glint` streaks.
    contact: Object.freeze({ c0: [0.83, 1, 0.97], c1: [0.28, 0.85, 0.92], sparks: 5, power: 0.48 }),
  }),
  // Ashfall: a crude cleaver hacked down from over the shoulder, then a shoving stab; heavy, short, chunky.
  scrapper: Object.freeze({
    slash: frames([
      [0.62, -1.18, 0, -0.1], // heave the cleaver up over the shoulder
      [-0.12, 0.2, 0, 0.24], // chop down through the target
      [-0.36, 0.34, 0, 0.18],
    ]),
    thrust: frames([
      [0.34, 0.18, 0, -0.2], // pull the cleaver back to the hip
      [-0.1, -0.16, 0, 0.42], // shove it in
      [-0.12, -0.12, 0, 0.38],
    ]),
    wave: false,
    // Rusty orange: a hot orange glint and a fistful of scrap sparks thrown wide.
    contact: Object.freeze({ c0: [1, 0.74, 0.32], c1: [0.78, 0.25, 0.05], sparks: 8, power: 0.7,
      glint: frames([[1, 0.62, 0.2, 1], [0.55, 0.16, 0.03, 0]]) }),
  }),
  // Veil: a quick flick across, then a long darting lunge; a violet edge and a short shadow left behind the blade.
  shade: Object.freeze({
    slash: frames([
      [1.0, -0.5, 0, -0.08], // the blade drawn back wide at chest height
      [-0.15, -0.1, 0, 0.26], // one flat flick across
      [-0.8, 0, 0, 0.2],
    ]),
    thrust: frames([
      [0.22, 0.2, 0, -0.18], // coil
      [-0.06, -0.14, 0, 0.58], // dart in, the point level
      [-0.08, -0.12, 0, 0.52],
    ]),
    wave: false,
    contact: Object.freeze({ c0: [0.95, 0.78, 1], c1: [0.55, 0.22, 0.95], sparks: 3, power: 0.42, afterimage: true,
      glint: frames([[0.95, 0.78, 1, 1], [0.55, 0.22, 0.95, 0]]) }),
  }),
});
export const meleeStyle = (type) => MELEE_STYLE[type] || MELEE_STYLE.vanguard;
