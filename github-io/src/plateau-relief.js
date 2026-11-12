import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { themeFor } from "./visual-style.js";

// Plateau relief (Stage 3 look, 2026-11-13): a lit rock cliff face around every plateau, a bright
// lip along its top edge and closed rock ends beside each ramp. The ground mesh (1 m vertices)
// only roughs the 2.4 m step out over a 1.6 m band, which read as a dark ring from the game
// camera; this sheet follows each edge every 0.4 m instead. It is merged into the ground
// geometry and uses the ground's own material and texture, so it costs no extra draw.
//
// Nothing here is gameplay: Terrain.heightAt (units, effects, picking) is unchanged. The sheet
// stands proud of the smooth render height (a concave rock envelope over the cliff band, where
// nothing can stand), and lowerCliffBand() drops the ground vertices under it so no coarse
// ground triangle pokes through the rock.
//
// Profile across an edge: d is the signed distance to the plateau edge (outward +), heights are
// fractions of the plateau height. The cap lies 2 cm above the plateau top and reaches 2.4 m in,
// past every ground triangle the lowered band can tilt. Its texture is the ground's own (world
// UVs, so it joins the top seamlessly); the rock face samples a white ring painted under it in
// the ground texture (ground-paint.js paintPlateaus), so its colours are the vertex colours.
const CAP = [[-2.4, 1], [-1.3, 1], [-0.45, 1.08], [0.02, 1.28]];
// Face rows: [d, height fraction, stratum]. Rows a few centimetres apart switch stratum, so the
// rock shows crisp horizontal bands instead of one smooth gradient.
const FACE = [[0.06, 0.97, 0], [0.17, 0.86, 0], [0.2, 0.83, 1], [0.342, 0.66, 1], [0.365, 0.63, 2], [0.506, 0.44, 2], [0.528, 0.41, 3], [0.668, 0.2, 3], [0.74, 0.083, 4], [0.84, -0.04, 5]];
export const RELIEF = { lift: 0.02, foot: 0.84, faceUV: 0.47, band: 0.8 };
// Sun from -x, +z (view.js SUN_OFFSET): faces turned that way are lit, the others in shade.
const SUN = new THREE.Vector2(-25, 20).normalize();

const hash = (a, b) => {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The plateau's outward direction at a point on its edge (numerical gradient of Terrain.edge).
export function outward(terrain, p, x, z) {
  const e = 0.05, gx = terrain.edge(p, x + e, z) - terrain.edge(p, x - e, z), gz = terrain.edge(p, x, z + e) - terrain.edge(p, x, z - e), l = Math.hypot(gx, gz) || 1;
  return { x: gx / l, z: gz / l };
}

// Height of the rock envelope at signed edge distance d (the cap, then the face down to its foot).
function envelope(d, H) {
  if (d <= CAP[3][0]) return H + RELIEF.lift;
  let prev = [CAP[3][0], 1];
  for (const row of FACE) {
    if (row[0] <= prev[0]) continue;
    if (d <= row[0]) { const t = (d - prev[0]) / (row[0] - prev[0]); return H * (prev[1] + (row[1] - prev[1]) * t); }
    prev = row;
  }
  return 0;
}

// The fog sheet (2 m vertices) must stay above the rock: each fog vertex takes the envelope as if
// the plateau were one fog-cell diagonal wider, so every fog triangle covers the rock beneath it.
export function fogLift(terrain, x, z) {
  let h = 0;
  for (const p of terrain.plateaus) h = Math.max(h, envelope(terrain.edge(p, x, z) - 2.83, terrain.heightAt(p.x, p.z)));
  return h;
}

// Ground vertices inside a cliff band (not on a ramp) drop to the low ground: the rock sheet
// covers that band, and a ground triangle tilted across it then lies wholly under the sheet.
export function lowerCliffBand(geometry, terrain) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = -p.getY(i);
    for (const q of terrain.plateaus) {
      const d = terrain.edge(q, x, z);
      if (d > -RELIEF.band && d < RELIEF.band && !terrain.rampOf(q, x, z)) { p.setZ(i, 0); break; }
    }
  }
}

// Edge columns: a point on the edge, its outward normal n and the inward step m (n on straight
// sides and discs; the corner diagonal for box corners, whose inner outline stays square).
function columns(p, step = 0.4) {
  const cols = [];
  if (p.shape === "disc") {
    const n = Math.max(48, Math.ceil((2 * Math.PI * p.r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      cols.push({ x: p.x + nx * p.r, z: p.z + nz * p.r, nx, nz, mx: nx, mz: nz });
    }
    return cols;
  }
  const hw = p.w / 2, hd = p.d / 2, corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let c = 0; c < 4; c++) {
    const [sx, sz] = corners[c], [tx, tz] = corners[(c + 1) % 4], a0 = (c * Math.PI) / 2;
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      cols.push({ x: p.x + sx * hw, z: p.z + sz * hd, nx: Math.cos(a), nz: Math.sin(a), mx: sx, mz: sz });
    }
    // The side from this corner to the next one, outward normal = the fan's last direction.
    const nx = Math.round(Math.cos(a0 + Math.PI / 2)), nz = Math.round(Math.sin(a0 + Math.PI / 2));
    const x0 = p.x + sx * hw, z0 = p.z + sz * hd, x1 = p.x + tx * hw, z1 = p.z + tz * hd, length = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.ceil(length / step));
    for (let i = 1; i < n; i++) cols.push({ x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n, nx, nz, mx: nx, mz: nz });
  }
  return cols;
}

export function buildPlateauRelief(terrain) {
  if (!terrain.plateaus.length) return null;
  const theme = themeFor(terrain.id), size = terrain.size, half = terrain.half;
  const color = (key) => new THREE.Color(theme[key]);
  const cliff = color("cliff"), dust = color("dust"), deep = color("cliffDeep"), rock = color("rock");
  // Rock strata from the lip down: a pale capstone, warm and stony bands, a darker foot in its
  // own shadow.
  const strata = [cliff.clone().lerp(dust, 0.42), cliff.clone().multiplyScalar(1.04), cliff.clone().lerp(rock, 0.45).lerp(dust, 0.18), cliff.clone().multiplyScalar(0.86), cliff.clone().lerp(deep, 0.3), cliff.clone().lerp(deep, 0.62)];
  const sheet = { p: [], uv: [], c: [], index: [] }, ends = { p: [], n: [], uv: [], c: [], index: [] };
  const local = (x, y, z) => [x, -z, y];
  const uvAt = (x, z) => [(x + half) / size, (half - z) / size];
  terrain.plateaus.forEach((p, pi) => {
    const H = terrain.heightAt(p.x, p.z), cols = columns(p);
    // Columns beside a ramp are left out; the rock ends there with a closed face.
    const skip = cols.map((col) => p.ramps.some((r) => Math.hypot(col.x - r.x, col.z - r.z) < r.half - 0.2));
    // Every rock vertex samples one white texel of the ring under the face, at the column
    // farthest from any ramp (the ring is left out near ramps; see paintPlateaus).
    const far = cols.reduce((best, col) => {
      const gap = Math.min(Infinity, ...p.ramps.map((r) => Math.hypot(col.x - r.x, col.z - r.z)));
      return gap > best.gap ? { gap, col } : best;
    }, { gap: -1, col: cols[0] }).col;
    const faceUV = uvAt(far.x + far.nx * RELIEF.faceUV, far.z + far.nz * RELIEF.faceUV);
    const points = cols.map((col, ci) => {
      const tone = 0.9 + hash(pi, ci) * 0.2, bulge = hash(ci, pi + 31) * 0.1, sun = col.nx * SUN.x + col.nz * SUN.y;
      // Inward, a box's outline stays a square-cornered inset: side columns near a corner
      // gather on the inset corner instead of folding past it.
      const at = (d) => {
        if (d >= 0) return [col.x + col.nx * d, col.z + col.nz * d];
        const x = col.x + col.mx * d, z = col.z + col.mz * d;
        if (p.shape === "disc") return [x, z];
        return [Math.min(Math.max(x, p.x - p.w / 2 - d), p.x + p.w / 2 + d), Math.min(Math.max(z, p.z - p.d / 2 - d), p.z + p.d / 2 + d)];
      };
      const cap = CAP.map(([d, light], j) => {
        const [x, z] = at(d);
        const k = j === CAP.length - 1 ? light * (1 + 0.12 * sun) : light;
        return { pos: local(x, H + (j === CAP.length - 1 ? 0 : RELIEF.lift), z), uv: uvAt(x, z), c: [k, k, k] };
      });
      const face = FACE.map(([d, f, band], j) => {
        // Rocky faces bulge out a little, never at the buried foot.
        const [x, z] = at(d + (j > 0 && j < FACE.length - 1 ? bulge * Math.sin((j / FACE.length) * Math.PI) : 0));
        const k = tone * (1 + 0.2 * sun), s = strata[band];
        return { pos: local(x, H * f, z), uv: faceUV, c: [s.r * k, s.g * k, s.b * k] };
      });
      return { cap, face, col };
    });
    // Runs of kept columns (cyclic). A plateau without ramps is one closed loop.
    const n = cols.length, first = skip.indexOf(true), runs = [];
    if (first < 0) runs.push({ ids: [...Array(n).keys()], closed: true });
    else {
      let run = null;
      for (let k = 1; k <= n; k++) {
        const i = (first + k) % n;
        if (skip[i]) { if (run) runs.push(run); run = null; }
        else (run ||= { ids: [], closed: false }).ids.push(i);
      }
      if (run) runs.push(run);
    }
    for (const run of runs) {
      if (run.ids.length < 2) continue;
      // Winding: cap triangles must face up, i.e. (tangent x outward).y > 0 (box corner fans
      // repeat a point, so take the first pair of columns that are apart).
      let k = 1;
      while (k < run.ids.length - 1 && Math.hypot(cols[run.ids[k]].x - cols[run.ids[0]].x, cols[run.ids[k]].z - cols[run.ids[0]].z) < 1e-6) k++;
      const a = cols[run.ids[0]], b = cols[run.ids[k]], flip = (b.z - a.z) * a.nx - (b.x - a.x) * a.nz < 0;
      for (const part of ["cap", "face"]) {
        const rows = part === "cap" ? CAP.length : FACE.length, base = sheet.p.length / 3;
        for (const i of run.ids) for (const v of points[i][part]) { sheet.p.push(...v.pos); sheet.uv.push(...v.uv); sheet.c.push(...v.c); }
        const count = run.ids.length, last = run.closed ? count : count - 1;
        for (let i = 0; i < last; i++)
          for (let j = 0; j < rows - 1; j++) {
            const i2 = (i + 1) % count, q0 = base + i * rows + j, q1 = base + i2 * rows + j, q2 = q1 + 1, q3 = q0 + 1;
            if (flip) sheet.index.push(q0, q2, q1, q0, q3, q2);
            else sheet.index.push(q0, q1, q2, q0, q2, q3);
          }
      }
      if (run.closed) continue;
      // Closed rock ends beside the ramps: a fan from a buried point to the profile.
      for (const [ci, ni] of [[run.ids[0], run.ids[1]], [run.ids.at(-1), run.ids.at(-2)]]) {
        const col = cols[ci], other = cols[ni];
        // The end's normal points away from the run, toward the ramp.
        const nx = col.x - other.x, nz = col.z - other.z, nl = Math.hypot(nx, nz) || 1, normal = local(nx / nl, 0, nz / nl);
        // The end shows the same strata as the face, under a pale capstone.
        const top = strata[0], foot = strata[5];
        const profile = [...points[ci].cap.map((v) => ({ pos: v.pos, c: [top.r, top.g, top.b] })), ...points[ci].face], base = ends.p.length / 3;
        const centre = { pos: local(col.x - col.mx * 0.6, 0, col.z - col.mz * 0.6), c: [foot.r, foot.g, foot.b] };
        for (const v of [centre, ...profile]) { ends.p.push(...v.pos); ends.n.push(...normal); ends.uv.push(...faceUV); ends.c.push(...v.c.map((c) => c * 0.9)); }
        for (let k = 1; k < profile.length; k++) {
          const A = centre.pos, B = profile[k - 1].pos, C = profile[k].pos;
          const cross = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])];
          if (cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] >= 0) ends.index.push(base, base + k, base + k + 1);
          else ends.index.push(base, base + k + 1, base + k);
        }
      }
    }
  });
  const build = (part, normals) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.p, 3));
    if (normals) g.setAttribute("normal", new THREE.Float32BufferAttribute(part.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(part.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(part.c, 3));
    g.setIndex(part.index);
    if (!normals) g.computeVertexNormals();
    return g;
  };
  const parts = [build(sheet, false)];
  if (ends.index.length) parts.push(build(ends, true));
  const merged = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
  if (merged !== parts[0]) parts.forEach((g) => g.dispose());
  return merged;
}
