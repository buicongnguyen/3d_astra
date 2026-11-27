// Model files are packed by tools/compress-models.mjs (2026-11-27): EXT_meshopt_compression, float positions,
// 16-bit normals and colours. modelLoader() is the GLTFLoader every unit, building, environment, dress and detail
// model goes through: it decodes meshopt and, before loadAsync/parseAsync resolve, turns the 16-bit attributes back
// into the Float32 arrays the batching, dress and instancing code always read (listed per primitive in extras.fcq).
// Plain files pass through unchanged.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { BufferAttribute } from "three";

// extras.fcq = { float: ["normal", "color"] }: these attributes were float32 in the export.
export function restoreFloats(scene) {
  const seen = new Set();
  scene.traverse((o) => {
    const g = o.geometry, info = g?.userData?.fcq;
    if (!info || seen.has(g)) return;
    seen.add(g);
    for (const name of info.float || []) {
      const a = g.getAttribute(name);
      if (!a || a.array instanceof Float32Array) continue;
      const n = a.count, size = a.itemSize, out = new Float32Array(n * size);
      for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
      g.setAttribute(name, new BufferAttribute(out, size));
    }
    delete g.userData.fcq;
  });
}

export function modelLoader(manager) {
  return new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({ name: "frontier_restore_floats", afterRoot: (gltf) => { for (const s of gltf.scenes) restoreFloats(s); } }));
}
