// Meshopt compression for the unit, building and detail models (EXT_meshopt_compression, 2026-11-27).
// Runs after the Blender exports (tools/build-detail.mjs calls it; after any tools/blender/generate_*.py run:
// `node tools/compress-models.mjs`). Per primitive:
//   POSITION   kept float32, bit for bit (16-bit positions moved ~4-7k edge pixels per frame in the same-page A/B)
//   NORMAL     int16 normalised (error 1.5e-5), COLOR_0 uint16 normalised (error 7.6e-6; only when inside [0, 1]);
//              both listed in extras.fcq.float and turned back into Float32 arrays by src/model-decode.js
//   TEXCOORD_0 zeros: no model has a texture and every runtime path drops or zeroes model UVs (view.js part merge,
//              faction-dress.js); the attribute stays so the vertex layout is unchanged
// then EXT_meshopt_compression with no filters and the INDICES codec (exact index order). Node names, transforms,
// pivots, materials, extras and the attribute set are untouched; there is no node-transform dequantisation (what
// distorted the batched models in the first attempt). modelLoader (src/model-decode.js) decodes meshopt and restores
// the floats before GLTFLoader resolves, so batching, dress and instancing code read the arrays they always did.
//   node tools/compress-models.mjs                   every .glb in public/models/ and public/models/detail/
//   node tools/compress-models.mjs a.glb b.glb       just these files (already compressed files are skipped)
//   --decode                                         the reverse (plain float GLBs, e.g. for a Blender import)
//   --check                                          exit 1 if any model is not compressed (writes nothing)
// Manifests that record a file's size (models/manifest.json dress rows, models/detail/manifest.json; the page
// versions URLs with ?v=<bytes>) are updated to the new sizes.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const here = dirname(fileURLToPath(import.meta.url));
const models = join(here, "..", "public", "models");
const DIRS = [models, join(models, "detail")];

// glTF-Transform packs triangle lists with the meshopt TRIANGLES codec, which may rotate each triangle's three
// indices (same winding). INDICES keeps the exact index sequence, so the decoded buffers are bit-identical.
class ExactMeshopt extends EXTMeshoptCompression {
  _prewriteBuffers(context) {
    for (const view of Object.values(this._encoderBufferViews)) {
      const ext = view.extensions.EXT_meshopt_compression;
      if (ext.mode === "TRIANGLES") ext.mode = "INDICES";
    }
    return super._prewriteBuffers(context);
  }
}

// Float normals and colours -> 16-bit ones, UVs -> zeros (see the header). Returns the number of primitives packed.
export function pack(doc, { normal = true, color = true, uv = true } = {}) {
  const done = new Map();
  let packed = 0;
  // Each accessor once (primitives may share one); a non-float accessor (the dress files' int8 normals) stays.
  const once = (acc, fn) => { if (!acc || acc.getComponentType() !== 5126 || acc.getSparse?.()) return done.get(acc); if (!done.has(acc)) done.set(acc, fn(acc)); return done.get(acc); };
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const float = [];
    if (normal && once(prim.getAttribute("NORMAL"), (a) => { a.setArray(Int16Array.from(a.getArray(), (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767))).setNormalized(true); return "normal"; }) === "normal") float.push("normal");
    if (color && once(prim.getAttribute("COLOR_0"), (a) => { const v = a.getArray(); if (v.some((x) => x < 0 || x > 1)) return "kept"; a.setArray(Uint16Array.from(v, (x) => Math.round(x * 65535))).setNormalized(true); return "color"; }) === "color") float.push("color");
    if (uv) once(prim.getAttribute("TEXCOORD_0"), (a) => { a.setArray(new Float32Array(a.getArray().length)); return "zero"; });
    if (float.length) { prim.setExtras({ ...prim.getExtras(), fcq: { float } }); packed++; }
  }
  if (packed) doc.createExtension(KHRMeshQuantization).setRequired(true);
  return packed;
}

// The reverse of pack (float normals and colours, no fcq extras; UVs stay zero): for a Blender import of a model.
export function unpack(doc) {
  const done = new Set();
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const { fcq, ...rest } = prim.getExtras() || {};
    if (!fcq) continue;
    for (const [key, sem] of [["normal", "NORMAL"], ["color", "COLOR_0"]]) {
      const a = prim.getAttribute(sem);
      if (!a || done.has(a) || !(fcq.float || []).includes(key)) continue;
      done.add(a);
      const el = a.getElementSize(), out = new Float32Array(a.getCount() * el), tmp = [];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, tmp); for (let k = 0; k < el; k++) out[i * el + k] = tmp[k]; }
      a.setArray(out).setNormalized(false);
    }
    prim.setExtras(rest);
  }
}

export const isCompressed = (bytes) => {
  const json = JSON.parse(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  return (json.extensionsUsed || []).includes("EXT_meshopt_compression");
};

export async function compressModels(files, { decode = false, check = false, log = console.log, packing } = {}) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions([...ALL_EXTENSIONS.filter((e) => e !== EXTMeshoptCompression), ExactMeshopt]).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const sizes = new Map(), plain = [];
  for (const file of files) {
    const before = readFileSync(file);
    if (isCompressed(before) !== decode) {
      continue;
    }
    if (check) { plain.push(file); continue; }
    const doc = await io.readBinary(new Uint8Array(before.buffer, before.byteOffset, before.byteLength));
    if (decode) {
      unpack(doc);
      doc.getRoot().listExtensionsUsed().filter((e) => e.extensionName === "EXT_meshopt_compression").forEach((e) => e.dispose());
    } else pack(doc, packing);
    if (!decode) doc.createExtension(ExactMeshopt).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const after = await io.writeBinary(doc);
    writeFileSync(file, after);
    sizes.set(resolve(file), after.byteLength);
    log(`${basename(dirname(file)) === "detail" ? "detail/" : ""}${basename(file)}: ${before.length} -> ${after.byteLength} bytes`);
  }
  if (check) return plain;
  // Size rows in the manifests follow the files.
  for (const dir of DIRS) {
    const path = join(dir, "manifest.json");
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    for (const row of Object.values(manifest).filter(Array.isArray).flat()) {
      const size = sizes.get(resolve(dir, row.file || ""));
      if (size !== undefined && Number.isFinite(row.bytes) && row.bytes !== size) { row.bytes = size; changed = true; }
    }
    if (changed) writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  }
  return [...sizes.keys()];
}

export const allModels = () => DIRS.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".glb")).sort().map((f) => join(dir, f)));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const decode = args.includes("--decode"), check = args.includes("--check");
  const named = args.filter((a) => !a.startsWith("--")).map((a) => resolve(a));
  const result = await compressModels(named.length ? named : allModels(), { decode, check });
  if (check) {
    if (result.length) { console.log(`not compressed (run node tools/compress-models.mjs):\n  ${result.join("\n  ")}`); process.exit(1); }
    console.log("every model is meshopt-compressed");
  } else console.log(`${decode ? "decoded" : "compressed"} ${result.length} file(s)`);
}
