import { Group } from "three";
import { addVanguardWave } from "./vanguard-wave.js";
import { weaponStyle } from "./visual-style.js";
import { meleeStyle } from "./melee-styles.js";
import { motionKneel, motionLean, motionTwist } from "./unit-rig.js";

// Seconds relative to visible contact. The effect and the victim's hit flash use the same delay.
export const VANGUARD_WINDUP = weaponStyle({ unit: "vanguard" }).life;
export const VANGUARD_RECOVERY = 0.38;

// Shoulder yaw, shoulder pitch, elbow bend and forward weight shift (model units). The slice and thrust
// keyframes of each blade fighter (Vanguard, Scrapper, Shade) are in src/melee-styles.js.
const GUARD = [0, 0, 0, 0];

// Mirror the hip pivot the rest of the infantry uses in its vertex shader.
// `type`: the unit (src/melee-styles.js); only the Vanguard draws the lightning wave.
export function prepareVanguardArm(arm, hipY, type = "vanguard") {
  const torso = new Group();
  torso.name = "SwordTorso";
  torso.position.y = hipY;
  arm.position.y -= hipY;
  if (meleeStyle(type).wave) addVanguardWave(arm);
  torso.add(arm);
  return torso;
}

export function attachVanguardSword(model, type = "vanguard") {
  const torso = model.getObjectByName("SwordTorso");
  const arm = torso?.getObjectByName("SwordArm");
  const elbow = arm?.getObjectByName("SwordElbow");
  return elbow ? { torso, arm, elbow, wave: elbow.getObjectByName("SwordWave"), hip: torso.position.y, shoulder: torso.position.y + arm.position.y,
    lunge: 0, elapsed: Infinity, sequence: -1, style: meleeStyle(type) } : null;
}

// Rigid meshes share the model's instanced draw batches. Carry the shoulder with the body's
// shader-driven hip rotation (unit-rig.js), including lean while running or flinching, and idle life's spine twist
// (the shader turns the body by twist x smoothstep(hip, 1.7 hip, height); the shoulder takes its height's share).
export function followVanguardTorso(sword, motion) {
  const twist = motionTwist(motion), h = sword.hip, t = Math.min(1, Math.max(0, (sword.shoulder - h) / (0.7 * h)));
  sword.torso.rotation.set(motionLean(motion), twist ? twist * t * t * (3 - 2 * t) : 0, 0);
  sword.torso.position.y = h * (1 - motionKneel(motion) * 0.45);
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
  const style = sword.style || meleeStyle("vanguard");
  const [windup, contact, follow] = sequence % 2 === 0 ? style.slash : style.thrust;
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
