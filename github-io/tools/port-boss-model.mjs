// Ports a boss model from the owner's tank game into this game's model contract (docs/ASSET_PIPELINE.md):
// every mesh gets a grey COLOR_0 (soft height-based shading: dark at the feet, light up top), the
// materials take this game's names and the Ashfall salvage palette (the trim becomes `Team`, so the
// runtime paints it in the faction colour; the core is `BossCore`, lit only while it is exposed),
// nothing is double-sided, and the root is scaled to RTS size. Node names are kept: the runtime
// (src/boss-view.js) animates LeftLeg, RightLeg, Turret, ArmL, ArmR and LightGun and shows Core.
//
//   node tools/port-boss-model.mjs <source.glb> public/models/ironvanguard.glb [--scale 0.9]
//
// Source for the Iron Vanguard: Tank_game_3D public/models/boss-quad-mech.glb (same owner).
import { readFileSync, writeFileSync } from "node:fs";

const [source, target] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const scaleArg = process.argv.indexOf("--scale");
const SCALE = scaleArg > 0 ? +process.argv[scaleArg + 1] : 0.9;
if (!source || !target) throw new Error("usage: node tools/port-boss-model.mjs <source.glb> <target.glb> [--scale 0.9]");

const lin = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
// Source material (by name ending) -> [new name, sRGB colour, metallic, roughness, emissive sRGB or null].
const PALETTE = [
  [/Rubber$/, "Undercarriage", "#26292a", 0.35, 0.72, null],
  [/Trim$/, "Team", "#c9d6cf", 0.25, 0.42, null],
  [/Steel$/, "Steel", "#b9b3aa", 0.9, 0.32, null],
  [/Armor$/, "Armor", "#6a5248", 0.45, 0.55, null],
  [/Core$/, "BossCore", "#ffb04a", 0.0, 0.3, "#ff8a2a"],
  [/Optics$/, "Visor", "#ffc36a", 0.1, 0.25, null],
];

const glb = readFileSync(source);
if (glb.toString("utf8", 0, 4) !== "glTF") throw new Error("not a GLB");
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
const binStart = 20 + jsonLength + 8, binLength = glb.readUInt32LE(20 + jsonLength);
let bin = Buffer.from(glb.subarray(binStart, binStart + binLength));

// World matrices from the node tree (translation, rotation, scale only).
const compose = (t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) => {
  const [x, y, z, w] = r, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
};
const multiply = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const scene = json.scenes[json.scene ?? 0];
if (scene.nodes.length !== 1) throw new Error("expected one root node");
const root = json.nodes[scene.nodes[0]];
root.name = "ironvanguard";
root.scale = [SCALE, SCALE, SCALE];
const world = new Map();
const walk = (index, parent) => {
  const n = json.nodes[index];
  if (n.matrix) throw new Error("node matrices are not supported");
  const m = multiply(parent, compose(n.translation, n.rotation, n.scale));
  world.set(index, m);
  for (const child of n.children || []) walk(child, m);
};
walk(scene.nodes[0], compose());

const read = (accessor) => {
  const a = json.accessors[accessor], view = json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.type !== "VEC3") throw new Error("POSITION must be float VEC3");
  const stride = view.byteStride || 12, out = [];
  for (let i = 0; i < a.count; i++) {
    const o = (view.byteOffset || 0) + (a.byteOffset || 0) + i * stride;
    out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
  }
  return out;
};
// Height of the model in world space (after the root scale) for the shading ramp.
let top = 0;
for (const [index, m] of world) {
  const n = json.nodes[index];
  if (n.mesh === undefined) continue;
  for (const p of json.meshes[n.mesh].primitives) for (const [x, y, z] of read(p.attributes.POSITION)) top = Math.max(top, m[1] * x + m[5] * y + m[9] * z + m[13]);
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const extra = [];
let offset = bin.length;
const align = (n) => (n + 3) & ~3;
for (const [index, m] of world) {
  const n = json.nodes[index];
  if (n.mesh === undefined) continue;
  for (const p of json.meshes[n.mesh].primitives) {
    if (p.attributes.COLOR_0 !== undefined) continue;
    const positions = read(p.attributes.POSITION), data = Buffer.alloc(positions.length * 12);
    positions.forEach(([x, y, z], i) => {
      const h = m[1] * x + m[5] * y + m[9] * z + m[13];
      // Grime at the feet, full light from the waist up, a faint band of shade under the shoulders.
      const g = 0.5 + 0.5 * smooth(0, top * 0.55, h) - 0.06 * smooth(top * 0.62, top * 0.7, h) * (1 - smooth(top * 0.7, top * 0.78, h));
      for (let k = 0; k < 3; k++) data.writeFloatLE(g, i * 12 + k * 4);
    });
    const start = align(offset);
    if (start > offset) extra.push(Buffer.alloc(start - offset));
    extra.push(data);
    json.bufferViews.push({ buffer: 0, byteOffset: start, byteLength: data.length, target: 34962 });
    json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: 5126, count: positions.length, type: "VEC3" });
    p.attributes.COLOR_0 = json.accessors.length - 1;
    offset = start + data.length;
  }
}
bin = Buffer.concat([bin, ...extra]);
if (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]);
json.buffers[0].byteLength = bin.length;

for (const material of json.materials) {
  const row = PALETTE.find(([pattern]) => pattern.test(material.name));
  if (!row) throw new Error(`no palette entry for material ${material.name}`);
  const [, name, color, metallic, roughness, emissive] = row;
  material.name = name;
  material.pbrMetallicRoughness = { baseColorFactor: [...lin(color), 1], metallicFactor: metallic, roughnessFactor: roughness };
  if (emissive) material.emissiveFactor = lin(emissive); else delete material.emissiveFactor;
  delete material.doubleSided;
}
json.asset = { version: "2.0", generator: "tools/port-boss-model.mjs (from Tank_game_3D boss-quad-mech.glb, same owner)" };

let text = Buffer.from(JSON.stringify(json), "utf8");
if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
const header = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
header.write("glTF", 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
jsonHead.writeUInt32LE(text.length, 0); jsonHead.write("JSON", 4);
binHead.writeUInt32LE(bin.length, 0); binHead.write("BIN\0", 4);
writeFileSync(target, Buffer.concat([header, jsonHead, text, binHead, bin]));
const triangles = json.meshes.reduce((n, mesh) => n + mesh.primitives.reduce((k, p) => k + (p.indices === undefined ? json.accessors[p.attributes.POSITION].count : json.accessors[p.indices].count) / 3, 0), 0);
console.log(`${target}: ${triangles} triangles, ${json.materials.length} materials, height ${top.toFixed(2)} m, ${(12 + 16 + text.length + bin.length) / 1024 | 0} KB`);
