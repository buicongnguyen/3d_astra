import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { addTeamBands } from '../src/team-bands.js';
import { bossTemplates, recolorBossPaint } from '../src/boss-view.js';
import balance from '../src/balance.json' with { type: 'json' };

test('every combat model has projected team paint that can join its GLB paint batch', async () => {
  for (const [type, def] of Object.entries(balance.definitions)) {
    if (!['unit', 'building'].includes(def.kind)) continue;
    const bytes = await readFile(new URL('../public/models/' + type + '.glb', import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    addTeamBands(scene, type);
    const stripes = [];
    scene.traverse(part => { if (part.name.endsWith('_TeamBand')) stripes.push(part); });
    assert.ok(stripes.length, type);
    for (const { geometry, material } of stripes) {
      assert.match(material.name, /^Team(?:\.|$)/);
      assert.ok(geometry.attributes.position.count >= 3, type);
      assert.ok(geometry.attributes.position.array.every(Number.isFinite), type);
      assert.ok(geometry.attributes.color.count === geometry.attributes.position.count, type);
    }
    if (!def.boss) continue;
    const [boss] = bossTemplates(scene, { colors: [0xff0000], glows: [0xffffff], bakedMaterial: () => new THREE.MeshStandardMaterial() });
    let repainted = 0;
    boss.traverse(part => {
      const paint = part.geometry?.userData.bossPaint;
      if (!paint) return;
      recolorBossPaint(part.geometry, 0x00ff00);
      for (const { start, shades } of paint.ranges) {
        assert.equal(part.geometry.attributes.color.getX(start), 0);
        assert.equal(part.geometry.attributes.color.getY(start), shades[0]);
        repainted += shades.length;
      }
    });
    assert.ok(repainted > 0, type);
  }
});
