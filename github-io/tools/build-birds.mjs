// Builds public/models/birds.glb (H5 birds, src/bird-view.js): the near-detail bird of each family as ONE rigid mesh
// with its colours baked into COLOR_0 and a custom attribute _BIRD per vertex = (wing side -1/0/1, span 0 at the
// shoulder .. 1 at the tip, head 0/1), so one instanced draw per family flaps, folds and turns the head in the vertex
// shader. Sources are the owner's own procedural Blender birds in sibling repos (copied, no live links):
//   crow       3D_game_fighting/public/models/crow.glb       skinned: bind pose, parts from the dominant joint
//   duck       3D_game_fighting/public/models/duck.glb       skinned (ducks on the rivers)
//   goose      the duck, recoloured as a grey-brown goose with a black neck (the Expanse V)
//   hawk       cute_game/public/assets/models/forest-birds.glb, forest_raptor (rigid body/head/wing_l/wing_r)
//   gull       race3D_game/public/models/bird.glb (rigid Bird_WingL/R)
//   goose_lod  the goose simplified to at most 400 triangles (the V formation over the Expanse, src/ambient-life.js)
//   songbird   the crow simplified to about half its triangles (meshoptimizer) and recoloured warm orange-brown
// Each bird faces +z, y up, wings along x (or folded along the body), scaled to SIZE metres; the shoulder hinge and neck pivot are in
// the mesh extras with `folded` (wings modelled along the body) (bird-view.js reads them).  node tools/build-birds.mjs   (then it packs the file: compress-models.mjs)
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compressModels } from "./compress-models.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "models", "birds.glb");
const REPOS = process.env.OWNER_REPOS || "C:/Users/n/source/repos";
const SOURCES = {
  crow: `${REPOS}/3D_game_fighting/public/models/crow.glb`,
  duck: `${REPOS}/3D_game_fighting/public/models/duck.glb`,
  hawk: `${REPOS}/cute_game/public/assets/models/forest-birds.glb`,
  gull: [`E:/repo/race3D_game/public/models/bird.glb`, `${REPOS}/race3D_game/public/models/bird.glb`],
};
// Size in metres, a little over life size so a bird reads from the hero's shoulder camera: the wingspan of a bird
// modelled with open wings (gull, hawk), the beak-to-tail length of one modelled perched with folded wings (crow, duck).
export const SIZE = { crow: 0.6, gull: 1.3, hawk: 1.6, songbird: 0.32, goose: 1.0, duck: 0.65 };

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const rot = (m, n) => { const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]]; const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// Every triangle of a file as flat arrays (world space), with a part tag per vertex: 0 body, 1 head, 2 wing L, 3 wing R.
async function read(file, { only = null } = {}) {
  const doc = await io.read(file), pos = [], nrm = [], col = [], part = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    let chain = "", p = node;
    while (p) { chain += `/${p.getName()}`; p = p.getParentNode(); }
    if (only && !only.test(chain)) continue;
    const m = node.getWorldMatrix(), skin = node.getSkin(), joints = skin?.listJoints().map((j) => j.getName());
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), C = prim.getAttribute("COLOR_0"), J = prim.getAttribute("JOINTS_0"), W = prim.getAttribute("WEIGHTS_0");
      const base = prim.getMaterial()?.getBaseColorFactor() || [1, 1, 1, 1];
      const idx = prim.getIndices()?.getArray() || [...Array(P.getCount()).keys()];
      const tmp = [], tj = [], tw = [];
      for (const i of idx) {
        P.getElement(i, tmp); pos.push(...mul(m, tmp));
        if (N) { N.getElement(i, tmp); nrm.push(...rot(m, tmp)); } else nrm.push(0, 1, 0);
        const c = C ? (C.getElement(i, tmp), tmp.slice(0, 3)) : [1, 1, 1];
        col.push(c[0] * base[0], c[1] * base[1], c[2] * base[2]);
        let tag = 0;
        if (J && W) {
          J.getElement(i, tj); W.getElement(i, tw);
          let best = 0; for (let k = 1; k < 4; k++) if (tw[k] > tw[best]) best = k;
          const name = joints[tj[best]] || "";
          tag = /^wing.*_L$/i.test(name) ? 2 : /^wing.*_R$/i.test(name) ? 3 : /head|jaw|neck/i.test(name) ? 1 : 0;
        } else tag = /wing_?l\b|wingl|left wing/i.test(chain) ? 2 : /wing_?r\b|wingr|right wing/i.test(chain) ? 3 : /head|eye|pupil|beak/i.test(chain) ? 1 : 0;
        part.push(tag);
      }
    }
  }
  return { pos, nrm, col, part };
}

// Turns, scales and tags a bird: forward = body centre -> head centre (xz) becomes +z; the wing marked left goes to +x
// (bird-view.js's local frame: +x right wing... both are mirrored, only the side sign matters); the span becomes SIZE.
function shape(raw, span, recolour = null) {
  const n = raw.part.length, centre = (tag) => { let x = 0, z = 0, c = 0; for (let i = 0; i < n; i++) if (raw.part[i] === tag) { x += raw.pos[i * 3]; z += raw.pos[i * 3 + 2]; c++; } return c ? [x / c, z / c] : [0, 0]; };
  const body = centre(0), head = centre(1), a = Math.atan2(head[0] - body[0], head[1] - body[1]); // forward angle from +z
  const cos = Math.cos(-a), sin = Math.sin(-a);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), B = new Float32Array(n * 3);
  let minY = Infinity, maxX = 0;
  for (let i = 0; i < n; i++) {
    const x = raw.pos[i * 3] - body[0], y = raw.pos[i * 3 + 1], z = raw.pos[i * 3 + 2] - body[1];
    P[i * 3] = x * cos + z * sin; P[i * 3 + 1] = y; P[i * 3 + 2] = -x * sin + z * cos;
    const nx = raw.nrm[i * 3], nz = raw.nrm[i * 3 + 2];
    N[i * 3] = nx * cos + nz * sin; N[i * 3 + 1] = raw.nrm[i * 3 + 1]; N[i * 3 + 2] = -nx * sin + nz * cos;
    minY = Math.min(minY, y); maxX = Math.max(maxX, Math.abs(P[i * 3]));
  }
  // Folded wings lie along the body (their reach along z beats their reach along x): size by length, not span.
  let wx = 0, wz0 = Infinity, wz1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]);
    if (raw.part[i] >= 2) { wx = Math.max(wx, Math.abs(P[i * 3])); wz0 = Math.min(wz0, P[i * 3 + 2]); wz1 = Math.max(wz1, P[i * 3 + 2]); }
  }
  const folded = wz1 - wz0 > wx;
  const k = folded ? span / (z1 - z0) : span / 2 / maxX;
  // The shoulder: the wing vertex nearest the body's middle plane; the neck: the head's lowest rear point.
  let hingeX = Infinity, hingeY = 0, hingeZ = 0, neckY = Infinity, neckZ = 0, tip = 0;
  for (let i = 0; i < n; i++) {
    P[i * 3] *= k; P[i * 3 + 1] = (P[i * 3 + 1] - minY) * k; P[i * 3 + 2] *= k;
    const t = raw.part[i], ax = Math.abs(P[i * 3]);
    if (t >= 2 && (folded ? P[i * 3 + 2] > hingeZ || hingeX === Infinity : ax < hingeX)) { hingeX = ax; hingeY = P[i * 3 + 1]; hingeZ = P[i * 3 + 2]; }
    if (t === 1 && P[i * 3 + 1] < neckY) { neckY = P[i * 3 + 1]; neckZ = P[i * 3 + 2]; }
  }
  // A folded wing's shoulder is its front end; the span runs from there to its farthest point (in xz).
  const reach = (i) => Math.hypot(Math.abs(P[i * 3]) - hingeX, P[i * 3 + 2] - hingeZ);
  for (let i = 0; i < n; i++) if (raw.part[i] >= 2) tip = Math.max(tip, reach(i));
  for (let i = 0; i < n; i++) {
    const t = raw.part[i], x = P[i * 3];
    B[i * 3] = t >= 2 ? Math.sign(x) || 1 : 0;
    B[i * 3 + 1] = t >= 2 ? Math.max(0, Math.min(1, reach(i) / Math.max(1e-3, tip))) : 0;
    B[i * 3 + 2] = t === 1 ? 1 : 0;
    const c = [raw.col[i * 3], raw.col[i * 3 + 1], raw.col[i * 3 + 2]];
    const r = recolour ? recolour(c, t, P[i * 3 + 1] / (span * 0.5)) : c;
    C[i * 3] = r[0]; C[i * 3 + 1] = r[1]; C[i * 3 + 2] = r[2];
  }
  return { P, N, C, B, extras: { hinge: [+hingeX.toFixed(4), +hingeY.toFixed(4), +hingeZ.toFixed(4)], neck: [+neckY.toFixed(4), +neckZ.toFixed(4)], size: span, folded } };
}

// Fewer triangles (the songbird): meshoptimizer's simplifier on the welded mesh, the attributes follow each kept vertex.
// `ratio` of the triangles, or with `target` at most that many (a looser error bound lets it get there).
function simplify(bird, ratio, { target = 0, error = 0.02 } = {}) {
  const n = bird.P.length / 3, key = new Map(), remap = new Uint32Array(n), uniq = [];
  for (let i = 0; i < n; i++) {
    const k = `${bird.P[i * 3].toFixed(5)},${bird.P[i * 3 + 1].toFixed(5)},${bird.P[i * 3 + 2].toFixed(5)},${bird.B[i * 3 + 2]},${bird.B[i * 3]}`;
    if (!key.has(k)) { key.set(k, uniq.length); uniq.push(i); }
    remap[i] = key.get(k);
  }
  const verts = new Float32Array(uniq.length * 3);
  uniq.forEach((i, j) => verts.set(bird.P.subarray(i * 3, i * 3 + 3), j * 3));
  const [idx] = MeshoptSimplifier.simplify(remap, verts, 3, target ? target * 3 : Math.floor((n * ratio) / 3) * 3, error, target ? [] : ["LockBorder"]);
  const pick = (A) => { const o = new Float32Array(idx.length * 3); idx.forEach((v, j) => o.set(A.subarray(uniq[v] * 3, uniq[v] * 3 + 3), j * 3)); return o; };
  return { ...bird, P: pick(bird.P), N: pick(bird.N), C: pick(bird.C), B: pick(bird.B) };
}

const lin = (hex) => [0, 2, 4].map((i) => { const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const source = (s) => [s].flat().find((f) => existsSync(f));

const raw = {
  crow: await read(source(SOURCES.crow)),
  duck: await read(source(SOURCES.duck)),
  hawk: await read(source(SOURCES.hawk), { only: /forest_raptor/ }),
  gull: await read(source(SOURCES.gull)),
};
const birds = {
  crow: shape(raw.crow, SIZE.crow),
  // The gull's stylised blue-grey wings become a real gull's pale grey (same shading, no blue).
  gull: shape(raw.gull, SIZE.gull, (c) => { if (c[2] < c[0] * 1.4 || c[2] < 0.06) return c; const g = Math.min(1, luma(c) * 1.25 + 0.04); return [g, g * 1.01, g * 1.04]; }),
  hawk: shape(raw.hawk, SIZE.hawk),
  duck: shape(raw.duck, SIZE.duck),
  // The goose: the duck's bright parts become pale grey-brown, the head and neck black with the cheek kept pale.
  goose: shape(raw.duck, SIZE.goose, (c, part, h) => {
    const l = luma(c);
    if (part === 1) return l > 0.5 ? lin("#efe9dc") : lin("#17150f");
    if (l > 0.55) return lin("#d9d2c2");
    return h > 0.6 ? lin("#6f6352") : lin("#8f8574");
  }),
  // The songbird: the crow's dark plumage becomes a warm orange breast and brown back, its beak and legs stay.
  songbird: simplify(shape(raw.crow, SIZE.songbird, (c, part, h) => {
    const l = luma(c);
    if (l > 0.35) return c; // beak, eye shine
    if (part >= 2) return h > 0.5 ? lin("#7a4a26") : lin("#5b3a22");
    return h < 0.45 ? lin("#f0a040") : part === 1 ? lin("#3b2b1f") : lin("#9a6230");
  }), 0.55),
};
// The goose far LOD (ambient-life.js: the Expanse V formation in Hero mode): the goose at no more than GOOSE_LOD
// triangles, so all 14 geese of the two Vs stay one cheap instanced draw on a phone.
export const GOOSE_LOD = 400;
birds.goose_lod = simplify(birds.goose, 0, { target: GOOSE_LOD, error: 0.2 });

const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene("birds");
for (const [name, b] of Object.entries(birds)) {
  const acc = (arr, type = "VEC3") => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute("POSITION", acc(b.P)).setAttribute("NORMAL", acc(b.N)).setAttribute("COLOR_0", acc(b.C)).setAttribute("_BIRD", acc(b.B));
  const mesh = doc.createMesh(name).addPrimitive(prim).setExtras(b.extras);
  scene.addChild(doc.createNode(name).setMesh(mesh));
  console.log(`${name}: ${b.P.length / 9} triangles, size ${b.extras.size} m, folded ${b.extras.folded}, hinge ${b.extras.hinge}, neck ${b.extras.neck}`);
}
await io.write(out, doc);
await compressModels([out], { log: () => {} });
console.log(`birds.glb ${(statSync(out).size / 1024).toFixed(0)} KB`);
