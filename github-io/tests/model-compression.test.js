// Model packing (tools/compress-models.mjs, src/model-decode.js): every shipped model is meshopt-compressed, and the
// loader hands the runtime the same Float32 attributes the uncompressed export had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allModels } from '../tools/compress-models.mjs';
import { parseModel, readGlbJson } from './lib/glb.mjs';

test('every model under public/models/ is packed (run node tools/compress-models.mjs after a Blender export)', () => {
  for (const file of allModels()) {
    const data = readFileSync(file), json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    assert.ok(json.extensionsRequired?.includes('EXT_meshopt_compression'), `${file}: not compressed`);
    // Positions stay float32 (16-bit positions moved edge pixels in the A/B; node-transform dequantisation distorted
    // the batched models in the first attempt).
    for (const mesh of json.meshes) for (const p of mesh.primitives) assert.equal(json.accessors[p.attributes.POSITION].componentType, 5126, `${file}: ${mesh.name} float positions`);
  }
});

test('the loader restores Float32 normals and colours, keeps the authored bounds and leaves no packing extras', async () => {
  for (const name of ['tank', 'ranger', 'dress-veil', 'environment', 'detail/tank']) {
    const url = new URL(`../public/models/${name}.glb`, import.meta.url), json = readGlbJson(url);
    const { scene } = await parseModel(readFileSync(url));
    let meshes = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry, pos = g.getAttribute('position');
      assert.ok(pos.array instanceof Float32Array && !pos.normalized, `${name} ${o.name}: float positions`);
      assert.ok(!g.userData.fcq, `${name} ${o.name}: no packing extras left`);
      if (!name.startsWith('dress-')) for (const a of ['normal', 'color']) if (g.getAttribute(a)) assert.ok(g.getAttribute(a).array instanceof Float32Array, `${name} ${o.name}: float ${a}`);
    });
    assert.ok(meshes > 0 && meshes >= json.meshes.length, name);
    // The first mesh's box matches the authored accessor bounds within 0.1 mm.
    const a = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    assert.equal(a.componentType, 5126);
    const first = []; scene.traverse((o) => { if (o.isMesh && o.name && first.length === 0 && json.nodes.some((n) => n.mesh === 0 && n.name.replace(/[.]/g, '') === o.name)) first.push(o); });
    if (first[0]) {
      const box = first[0].geometry.boundingBox;
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(box.min.getComponent(k) - a.min[k]) < 1e-4, `${name}: min ${k}`);
        assert.ok(Math.abs(box.max.getComponent(k) - a.max[k]) < 1e-4, `${name}: max ${k}`);
      }
    }
  }
});
