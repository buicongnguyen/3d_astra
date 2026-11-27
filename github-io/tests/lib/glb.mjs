// Reading the packed model files (tools/compress-models.mjs: EXT_meshopt_compression, 16-bit normals/colours) in tests.
//   glbJson(bytes)     the JSON chunk as the file was authored: packed accessors read as float again (componentType,
//                      normalized, min/max), fcq extras and the meshopt extension gone, KHR_mesh_quantization
//                      kept only where an attribute is still an integer one (the dress files' int8 normals)
//   readGlbJson(url)   the same from a file
//   parseModel(bytes)  three.js GLTFLoader through src/model-decode.js (meshopt decoded, Float32 attributes restored)
import { readFileSync } from 'node:fs';
import { modelLoader } from '../../src/model-decode.js';

const SCALE = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

export function glbJson(data) {
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const restored = new Set();
  for (const mesh of json.meshes || []) for (const p of mesh.primitives) {
    const fcq = p.extras?.fcq;
    if (!fcq) continue;
    const fix = (index, map) => {
      if (index === undefined || restored.has(index)) return;
      restored.add(index);
      const a = json.accessors[index], s = SCALE[a.componentType];
      const v = (x, k) => map(a.normalized ? Math.max(x / s, -1) : x, k);
      if (a.min) a.min = a.min.map(v);
      if (a.max) a.max = a.max.map(v);
      a.componentType = 5126;
      delete a.normalized;
    };
    if (fcq.float?.includes('normal')) fix(p.attributes.NORMAL, (x) => x);
    if (fcq.float?.includes('color')) fix(p.attributes.COLOR_0, (x) => x);
    delete p.extras.fcq;
    if (!Object.keys(p.extras).length) delete p.extras;
  }
  const integer = (json.meshes || []).some((m) => m.primitives.some((p) => Object.values(p.attributes).some((i) => json.accessors[i].componentType !== 5126)));
  const drop = (name) => name === 'EXT_meshopt_compression' || (name === 'KHR_mesh_quantization' && !integer);
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (!json[key]) continue;
    json[key] = json[key].filter((n) => !drop(n));
    if (!json[key].length) delete json[key];
  }
  return json;
}

export const readGlbJson = (url) => glbJson(readFileSync(url));

export const parseModel = (bytes) => modelLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
