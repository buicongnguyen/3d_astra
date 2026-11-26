import { Group } from "three";
import { addVanguardWave } from "./vanguard-wave.js";
import { weaponStyle } from "./visual-style.js";

// Seconds relative to visible contact. The effect and the victim's hit flash use the same delay.
export const VANGUARD_WINDUP = weaponStyle({ unit: "vanguard" }).life;
export const VANGUARD_RECOVERY = 0.38;

// Shoulder yaw, shoulder pitch, elbow bend and forward weight shift (model units).
const GUARD = [0, 0, 0, 0];
const SLASH = [
  [1.16, -0.65, -0.12, -0.07], // raise the point outside the shield
  [-0.24, -0.39, 0.32, 0.19], // cross the target on a descending diagonal
  [-0.94, -0.04, 0.21, 0.13],
];
const THRUST = [
  [0.16, 0.68, -0.76, -0.13], // draw the elbow back while keeping the point forward
  [-0.22, -1.23, 1.16, 0.40], // drive from the shoulder, point level with the target
  [-0.24, -1.18, 1.14, 0.37],
];

// Mirror the hip pivot the rest of the infantry uses in its vertex shader.
export function prepareVanguardArm(arm, hipY) {
  const torso = new Group();
  torso.name = "SwordTorso";
  torso.position.y = hipY;
  arm.position.y -= hipY;
  addVanguardWave(arm);
  torso.add(arm);
  return torso;
}

export function attachVanguardSword(model) {
  const torso = model.getObjectByName("SwordTorso");
  const arm = torso?.getObjectByName("SwordArm");
  const elbow = arm?.getObjectByName("SwordElbow");
  return elbow ? { torso, arm, elbow, wave: elbow.getObjectByName("SwordWave"), hip: torso.position.y, lunge: 0, elapsed: Infinity, sequence: -1 } : null;
}

// Rigid meshes share the model's instanced draw batches. Carry the shoulder with the body's
// shader-driven hip rotation (unit-rig.js), including lean while running or flinching.
export function followVanguardTorso(sword, motion) {
  sword.torso.rotation.x = motion[3] - 1;
  sword.torso.position.y = sword.hip * (1 - motion[2] * 0.45);
}

function pose(sword, from, to, t) {
  const k = t * t * (3 - 2 * t);
  sword.arm.rotation.set(from[1] + (to[1] - from[1]) * k, from[0] + (to[0] - from[0]) * k, 0, "YXZ");
  sword.elbow.rotation.x = from[2] + (to[2] - from[2]) * k;
  sword.lunge = from[3] + (to[3] - from[3]) * k;
}

export function restVanguardSword(sword) {
  pose(sword, GUARD, GUARD, 0);
  if (sword.wave) {
    sword.wave.visible = false;
    sword.wave.scale.setScalar(0);
  }
}

export function strikeVanguardSword(sword, elapsed, sequence) {
  const [windup, contact, follow] = sequence % 2 === 0 ? SLASH : THRUST;
  const release = -VANGUARD_WINDUP * 0.48;
  const wave = sword.wave;
  if (wave) {
    // Open the fan behind the edge during the cut, then let it collapse into the tip.
    const strength = Math.min(1, (elapsed - release) / -release, (0.19 - elapsed) / 0.13);
    wave.visible = sequence % 2 === 0 && strength > 0;
    wave.scale.setScalar(wave.visible ? wave.userData.length * strength : 0);
  }
  if (elapsed <= -VANGUARD_WINDUP || elapsed >= VANGUARD_RECOVERY) restVanguardSword(sword);
  else if (elapsed < release) pose(sword, GUARD, windup, (elapsed + VANGUARD_WINDUP) / (release + VANGUARD_WINDUP));
  else if (elapsed < 0) pose(sword, windup, contact, (elapsed - release) / -release);
  else if (elapsed < 0.09) pose(sword, contact, follow, elapsed / 0.09);
  else pose(sword, follow, GUARD, (elapsed - 0.09) / (VANGUARD_RECOVERY - 0.09));
}
