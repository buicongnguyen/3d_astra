// The Hero sky's frame (shared by src/horizon-sky.js and src/horizon-vivid.js, both loaded on the first Hero mode
// entry): bearings, the sun, the sphere everything sky-locked sits on, and the key-art atlas cells.
import * as THREE from "three";

export const DEG = Math.PI / 180;
// The bearing (yaw: direction (sin, cos) in x, z) from the player's start toward the rival's (sim HQs at (-25, 24) and
// (25, -24)): the key art's view. Sky objects sit at fixed offsets from it, `u` degrees to the right.
export const FRONT = (3 * Math.PI) / 4;
// The scene's sun (view.js SUN_OFFSET): the warm glow sits on its bearing.
export const SUN_DIR = Object.freeze(new THREE.Vector3(-25, 55, 20).normalize());
export const RADIUS = 50; // metres: any value works (the depth is set in clip space); inside every hero far plane

// The atlas (tools/bake-sky-atlas.py CELLS, 1024x512): x, y, w, h in pixels.
export const ATLAS = Object.freeze({
  size: [1024, 512], pad: 4,
  ringed: [0, 0, 576, 384], storm: [576, 0, 384, 384], silver: [960, 0, 64, 64], ember: [960, 64, 64, 64],
  dunes: [640, 384, 128, 128], amber: [768, 384, 128, 128], nebula: [0, 384, 640, 128],
});

// A sky direction (unit vector) at `u` degrees right of FRONT and `el` degrees up.
export function skyDir(u, el, out = new THREE.Vector3()) {
  const yaw = FRONT - u * DEG, c = Math.cos(el * DEG);
  return out.set(Math.sin(yaw) * c, Math.sin(el * DEG), Math.cos(yaw) * c);
}
// The sky's own right and up at a direction `u` degrees right of FRONT (for quads that face the camera's sphere).
export function skyFrame(u, dir, right = new THREE.Vector3(), up = new THREE.Vector3()) {
  right.set(-Math.cos(FRONT - u * DEG), 0, Math.sin(FRONT - u * DEG));
  up.set(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  return { right, up };
}
