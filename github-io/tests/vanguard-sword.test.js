import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { attachVanguardSword, prepareVanguardArm, strikeVanguardSword, restVanguardSword, VANGUARD_WINDUP, VANGUARD_RECOVERY } from "../src/vanguard-sword.js";

test("Vanguard's wave follows the actual blade through the cut and disappears in guard and thrust", async () => {
  const bytes = await readFile(new URL("../public/models/vanguard.glb", import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const arm = scene.getObjectByName("SwordArm"), hip = scene.getObjectByName("leg_L").position.y;
  const model = new Group();
  model.add(prepareVanguardArm(arm, hip));
  const sword = attachVanguardSword(model), wave = sword.wave;
  const blade = arm.getObjectByName("Sword_blade");
  assert.equal(wave.parent, blade.parent);
  assert.equal(wave.visible, false);
  assert.ok(wave.userData.length > 1);
  assert.ok(wave.geometry.getAttribute("color").itemSize === 4 && !wave.material.depthWrite);

  const start = wave.getWorldPosition(new Vector3());
  strikeVanguardSword(sword, -VANGUARD_WINDUP, 0);
  assert.equal(wave.visible, false);
  strikeVanguardSword(sword, 0, 0);
  assert.equal(wave.visible, true);
  assert.equal(wave.scale.x, wave.userData.length);
  strikeVanguardSword(sword, 0.09, 0);
  assert.ok(wave.getWorldPosition(new Vector3()).x < start.x - 0.75, "the point cuts across the defender");
  strikeVanguardSword(sword, VANGUARD_RECOVERY, 0);
  assert.equal(wave.visible, false);
  assert.ok(wave.getWorldPosition(new Vector3()).distanceTo(start) < 1e-6);

  strikeVanguardSword(sword, 0, 1);
  assert.equal(wave.visible, false);
  const forward = wave.getWorldPosition(new Vector3()).z + sword.lunge;
  assert.ok(forward > start.z + 0.35, "the second hit extends toward the defender");
  restVanguardSword(sword);
  assert.equal(sword.lunge, 0);
  assert.equal(attachVanguardSword(new Group()), null);
});
