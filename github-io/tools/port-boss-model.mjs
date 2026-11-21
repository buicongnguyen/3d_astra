// Ports a boss model from the owner's tank game into this game's model contract (docs/ASSET_PIPELINE.md):
// every mesh gets a grey COLOR_0 (soft height-based shading: dark at the feet, light up top), the
// materials take this game's names and a palette (the trim becomes `Team`, so the runtime paints it in
// the faction colour; the core is `BossCore`, lit only while it is exposed), nothing is double-sided,
// and the root is scaled to RTS size. Node names are kept: the runtime (src/boss-view.js, BOSS_PARTS)
// animates the parts it names for that boss and shows the core.
//
//   node tools/port-boss-model.mjs <source.glb> <target.glb> [--scale 0.9] [--parts <map.json>] [--palette <name>]
//
// Without --parts and --palette it is the Iron Vanguard port: root "ironvanguard", scale 0.9, the
// Ashfall salvage palette (public/models/ironvanguard.glb comes out byte for byte the same).
//
// The parts map (--parts) is data, so a later boss needs no code here (docs/aaa/BOSSES.md):
//   {
//     "name": "ironsovereign",                // the root node's name
//     "scale": 1.7,                           // root scale (--scale overrides)
//     "palette": "sovereign",                 // a key of PALETTES below (--palette overrides)
//     "regroup": { "LegsA": ["Leg0L", "Leg1R", "Leg2L"] },
//                                             // new group nodes: the listed nodes (one common parent) become
//                                             // children of a new node with this name, so a set of legs, say,
//                                             // is one rigid part (one draw) the runtime can step as a tripod
//     "nodes": { "Core": { "translation": [0, 0.9, 0.2] } }
//                                             // local translation overrides (source units), before the scale
//   }
// Sources: Tank_game_3D public/models/boss-quad-mech.glb (Iron Vanguard), boss-walker.glb (Iron Sovereign).
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2), flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const valued = new Set(["--scale", "--parts", "--palette"]);
const [source, target] = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
if (!source || !target) throw new Error("usage: node tools/port-boss-model.mjs <source.glb> <target.glb> [--scale 0.9] [--parts map.json] [--palette name]");
const map = flag("--parts") ? JSON.parse(readFileSync(flag("--parts"), "utf8")) : {};
const SCALE = flag("--scale") !== undefined ? +flag("--scale") : map.scale ?? 0.9;
const NAME = map.name ?? "ironvanguard";

const lin = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
// Palettes: source material (by name ending) -> [new name, sRGB colour, metallic, roughness, emissive sRGB or null].
const PALETTES = {
  // Ashfall salvage: rust armour, warm steel, team trim, amber visor (the Iron Vanguard).
  ashfall: [
    [/Rubber$/, "Undercarriage", "#26292a", 0.35, 0.72, null],
    [/Trim$/, "Team", "#c9d6cf", 0.25, 0.42, null],
    [/Steel$/, "Steel", "#b9b3aa", 0.9, 0.32, null],
    [/Armor$/, "Armor", "#6a5248", 0.45, 0.55, null],
    [/Core$/, "BossCore", "#ffb04a", 0.0, 0.3, "#ff8a2a"],
    [/Optics$/, "Visor", "#ffc36a", 0.1, 0.25, null],
  ],
  // The Iron Sovereign (boss-walker): an imperial oxblood hull with gold fittings, dark iron legs,
  // faction-coloured strut trim and a white-hot core. Vivid and warm, like the rest of the roster.
  sovereign: [
    [/(Tracks|Bore)$/, "Undercarriage", "#2d2a33", 0.4, 0.6, null],
    [/Armor$/, "Armor", "#9b3a2e", 0.4, 0.5, null],
    [/BossTrim$/, "Team", "#c9d6cf", 0.25, 0.42, null],
    [/AuxiliaryTrim$/, "Gold", "#f0b13c", 0.7, 0.3, null],
    [/AuxiliarySteel$/, "Steel", "#c9bfae", 0.9, 0.32, null],
    [/Core$/, "BossCore", "#ffc65a", 0.0, 0.3, "#ff9a30"],
  ],
  // R3-J (round 3 warm kit): the Sovereign as a royal brass fortress. The dark oxblood hull read as one
  // red block with the coral (hostile) team struts; brass keeps it warm and vivid and sets the team
  // colour apart on any side. The gold fittings turn crimson, the feet and gun bores take the kit's warm
  // umber (were near-black violet), the steel is the kit's warm steel and the core runs white-hot so it
  // stands off the brass. Each material keeps its metal / roughness class (src/view.js reflects()), so
  // the baked groups and draws are unchanged.
  sovereign3: [
    [/(Tracks|Bore)$/, "Undercarriage", "#54463c", 0.4, 0.6, null],
    [/Armor$/, "Armor", "#e6a838", 0.4, 0.5, null],
    [/BossTrim$/, "Team", "#c9d6cf", 0.25, 0.42, null],
    [/AuxiliaryTrim$/, "Crimson", "#d8402c", 0.7, 0.3, null],
    [/AuxiliarySteel$/, "Steel", "#d8cdb8", 0.9, 0.32, null],
    [/Core$/, "BossCore", "#fff1c4", 0.0, 0.3, "#ffc45a"],
  ],
};
const PALETTE = PALETTES[flag("--palette") ?? map.palette ?? "ashfall"];
if (!PALETTE) throw new Error(`unknown palette ${flag("--palette") ?? map.palette}`);

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
root.name = NAME;
root.scale = [SCALE, SCALE, SCALE];

// The parts map: local translation overrides, then new group nodes (before the world matrices).
const byName = (name) => { const i = json.nodes.findIndex((n) => n.name === name); if (i < 0) throw new Error(`parts map: no node "${name}"`); return i; };
for (const [name, set] of Object.entries(map.nodes || {})) if (set.translation) json.nodes[byName(name)].translation = set.translation;
for (const [group, members] of Object.entries(map.regroup || {})) {
  const ids = members.map(byName), parents = ids.map((id) => json.nodes.findIndex((n) => (n.children || []).includes(id)));
  if (new Set(parents).size !== 1 || parents[0] < 0) throw new Error(`parts map: the members of ${group} need one common parent`);
  const parent = json.nodes[parents[0]];
  json.nodes.push({ name: group, children: ids });
  parent.children = [...parent.children.filter((c) => !ids.includes(c)), json.nodes.length - 1];
}

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
// Height of the model in world space (after the root scale) for the shading ramp, and its extent.
let top = 0;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const [index, m] of world) {
  const n = json.nodes[index];
  if (n.mesh === undefined) continue;
  for (const p of json.meshes[n.mesh].primitives) for (const [x, y, z] of read(p.attributes.POSITION)) {
    top = Math.max(top, m[1] * x + m[5] * y + m[9] * z + m[13]);
    for (let k = 0; k < 3; k++) { const v = m[k] * x + m[4 + k] * y + m[8 + k] * z + m[12 + k]; lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); }
  }
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
// Two source materials may take one game material (a dark undercarriage, say): keep the first of each
// name and point the primitives at it, so the model carries one material per name.
const kept = new Map(), remap = json.materials.map((m, i) => { if (!kept.has(m.name)) kept.set(m.name, i); return kept.get(m.name); });
if (kept.size < json.materials.length) {
  const order = [...kept.values()], fresh = new Map(order.map((old, i) => [old, i]));
  for (const mesh of json.meshes) for (const p of mesh.primitives) p.material = fresh.get(remap[p.material]);
  json.materials = order.map((i) => json.materials[i]);
}
json.asset = { version: "2.0", generator: `tools/port-boss-model.mjs (from Tank_game_3D ${NAME === "ironvanguard" ? "boss-quad-mech.glb" : source.split(/[\\/]/).pop()}, same owner)` };

let text = Buffer.from(JSON.stringify(json), "utf8");
if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
const header = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
header.write("glTF", 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
jsonHead.writeUInt32LE(text.length, 0); jsonHead.write("JSON", 4);
binHead.writeUInt32LE(bin.length, 0); binHead.write("BIN\0", 4);
writeFileSync(target, Buffer.concat([header, jsonHead, text, binHead, bin]));
const triangles = json.meshes.reduce((n, mesh) => n + mesh.primitives.reduce((k, p) => k + (p.indices === undefined ? json.accessors[p.attributes.POSITION].count : json.accessors[p.indices].count) / 3, 0), 0);
const size = lo.map((v, k) => (hi[k] - v).toFixed(2));
console.log(`${target}: ${triangles} triangles, ${json.materials.length} materials, height ${top.toFixed(2)} m, extent ${size[0]} x ${size[1]} x ${size[2]} m (x, y, z), ${(12 + 16 + text.length + bin.length) / 1024 | 0} KB`);
