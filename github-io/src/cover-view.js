import * as THREE from "three";
import { COVER_KINDS } from "./sim/cover.js";
import { fogAware } from "./fog-aware.js";

// H6 cover walls on the battlefield (rules: src/sim/cover.js, src/sim/content/cover.js). A view plugin:
//   - every piece of the match (sim.cover) built in code, flat-shaded with vertex colours, and merged into ONE
//     static mesh when the pieces appear (1 draw; no shadow casting, no per-frame work): broken concrete walls
//     with rebar and rubble, sandbag lines, crate stacks on a pallet; 60-150 triangles each;
//   - a soft dark blob baked under each piece (vertex alpha in the same mesh), in place of a cast shadow;
//   - sunk into the fog of war like the scatter (fog-aware.js);
//   - a round cover stops (heroShotLand with `blocked`): concrete chips and dust from the effect pools (rockets
//     and shells throw more), no camera shake.
// Nothing is built in a match without cover: normal play draws exactly as before.
const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  concrete: [C("#c9bfa9"), C("#bdb39c"), C("#d4cab3")],
  rebar: C("#8a4f2c"),
  rubble: C("#a89e8a"),
  bag: [C("#d1b778"), C("#c2a666"), C("#dcc385")],
  crate: [C("#c07f3e"), C("#b07034"), C("#cc8c4a")],
  strap: C("#4c4a46"),
  pallet: C("#7c5a34"),
};

// Collects flat-shaded triangles in piece space (u along the long side, v across, y up), then places them.
class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; this.tris = 0; }
  tri(a, b, c, col, alpha = [1, 1, 1], shade = [1, 1, 1]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    [a, b, c].forEach((q, i) => {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(nx, ny, nz);
      this.c.push(col.r * shade[i], col.g * shade[i], col.b * shade[i], alpha[i]);
    });
    this.tris++;
  }
  // A quad a b c d (counter-clockwise seen from outside).
  quad(a, b, c, d, col, shade) {
    this.tri(a, b, c, col, undefined, shade && [shade[0], shade[1], shade[2]]);
    this.tri(a, c, d, col, undefined, shade && [shade[0], shade[2], shade[3]]);
  }
  // A box without its bottom (10 triangles): u0..u1, v0..v1, y0..y1, turned by `yaw` about its own centre and
  // tilted by `tilt` (radians about u); its bottom corners darkened (contact shade).
  box(u0, u1, v0, v1, y0, y1, col, { yaw = 0, tilt = 0, top = null } = {}) {
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, cy = (y0 + y1) / 2, cs = Math.cos(yaw), sn = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const P = (u, v, y) => {
      let du = u - cu, dv = v - cv, dy = y - cy;
      [dv, dy] = [dv * ct - dy * st, dv * st + dy * ct];
      return [cu + du * cs - dv * sn, cy + dy, cv + du * sn + dv * cs];
    };
    const t = top || col, dark = 0.7;
    const b00 = P(u0, v0, y0), b10 = P(u1, v0, y0), b11 = P(u1, v1, y0), b01 = P(u0, v1, y0);
    const t00 = P(u0, v0, y1), t10 = P(u1, v0, y1), t11 = P(u1, v1, y1), t01 = P(u0, v1, y1);
    const side = [dark, dark, 1, 1];
    this.quad(b00, b10, t10, t00, col, side);
    this.quad(b10, b11, t11, t10, col, side);
    this.quad(b11, b01, t01, t11, col, side);
    this.quad(b01, b00, t00, t01, col, side);
    this.quad(t00, t10, t11, t01, t);
  }
  // A prism lying along u (a sandbag): `ring` is its cross-section [[v, y], ...] from one ground edge over the top
  // to the other; both ends capped. 2 * (ring - 1) + 2 * (ring - 2) triangles.
  prism(u0, u1, ring, col) {
    for (let i = 1; i < ring.length; i++) {
      const [va, ya] = ring[i - 1], [vb, yb] = ring[i];
      const s = (y) => 0.72 + 0.28 * Math.min(1, y / 0.2);
      this.quad([u0, ya, va], [u0, yb, vb], [u1, yb, vb], [u1, ya, va], col, [s(ya), s(yb), s(yb), s(ya)]);
    }
    for (const [u, flip] of [[u0, true], [u1, false]])
      for (let i = 1; i < ring.length - 1; i++) {
        const a = [u, ring[0][1], ring[0][0]], b = [u, ring[i][1], ring[i][0]], c = [u, ring[i + 1][1], ring[i + 1][0]];
        if (flip) this.tri(a, c, b, col, undefined, [0.8, 0.85, 0.85]); else this.tri(a, b, c, col, undefined, [0.8, 0.85, 0.85]);
      }
  }
  // The soft blob under a piece: a fan, dark in the middle and clear at the rim (`seg` triangles).
  blob(L, W, seg = 10) {
    const black = { r: 0, g: 0, b: 0 }, y = 0.075; // the piece sits 0.04 m into the ground (buildCoverGeometry)
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      this.tri([0, y, 0], [Math.cos(a1) * L, y, Math.sin(a1) * W], [Math.cos(a0) * L, y, Math.sin(a0) * W], black, [0.5, 0, 0]);
    }
  }
}

// One piece's triangles in its own space; `rnd` is the piece's seeded generator (its look, never its rules).
export function pieceMesh(kind, rnd) {
  const m = new Mesher(), K = COVER_KINDS[kind], pick = (list) => list[Math.floor(rnd() * list.length) % list.length];
  m.blob(K.L + 0.75, K.W + 0.85);
  if (kind === 0) {
    // Broken concrete: three slabs stepping down (one leaning), rebar out of the break, rubble at its foot.
    const col = pick(PALETTE.concrete), top = col.clone().multiplyScalar(1.12), h = K.h;
    m.box(-K.L, -0.5, -K.W, K.W, 0, h, col, { top });
    m.box(-0.5, 0.55, -K.W, K.W, 0, h * (0.72 + rnd() * 0.12), col, { top, tilt: 0.06 });
    m.box(0.55, K.L, -K.W * 0.9, K.W * 0.9, 0, h * 0.42, col, { top, tilt: -0.1 });
    for (const [u, v, y] of [[0.72, -0.08, 0.95], [1.05, 0.1, 0.85]]) m.box(u - 0.03, u + 0.03, v - 0.03, v + 0.03, h * 0.3, y, PALETTE.rebar, { tilt: 0.25 });
    for (let i = 0; i < 3; i++) {
      const u = 1.1 + rnd() * 0.9, v = (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.4), s = 0.14 + rnd() * 0.12;
      m.box(u - s, u + s, v - s, v + s, 0, s * 1.3, PALETTE.rubble, { yaw: rnd() * 3 });
    }
  } else if (kind === 1) {
    // Sandbags: a row of four and three on top, each a flattened hexagonal prism.
    const ring = (w, y0) => [[-w, y0], [-w * 0.92, y0 + 0.13], [-w * 0.45, y0 + 0.27], [w * 0.45, y0 + 0.27], [w * 0.92, y0 + 0.13], [w, y0]];
    for (let i = 0; i < 4; i++) { const u = -K.L + 0.4 + i * 0.8; m.prism(u - 0.38, u + 0.38, ring(K.W, 0), pick(PALETTE.bag)); }
    for (let i = 0; i < 3; i++) { const u = -K.L + 0.8 + i * 0.8; m.prism(u - 0.38, u + 0.38, ring(K.W * 0.86, 0.25), pick(PALETTE.bag)); }
  } else {
    // Crates: two on a pallet, one on top a little turned, each with a dark strap.
    m.box(-K.L - 0.05, K.L + 0.05, -K.W - 0.05, K.W + 0.05, 0, 0.14, PALETTE.pallet);
    for (const u of [-0.5, 0.5]) {
      const col = pick(PALETTE.crate);
      m.box(u - 0.47, u + 0.47, -K.W, K.W, 0.14, 1.0, col, { top: col.clone().multiplyScalar(1.1) });
      m.box(u - 0.5, u + 0.5, -K.W - 0.02, K.W + 0.02, 0.5, 0.6, PALETTE.strap);
    }
    const col = pick(PALETTE.crate), yaw = (rnd() - 0.5) * 0.6, u = (rnd() - 0.5) * 0.3;
    m.box(u - 0.42, u + 0.42, -0.42, 0.42, 1.0, K.h, col, { yaw, top: col.clone().multiplyScalar(1.1) });
    m.box(u - 0.44, u + 0.44, -0.08, 0.08, 1.0, K.h + 0.02, PALETTE.strap, { yaw });
  }
  return m;
}

// A tiny seeded generator for the looks (mulberry32), from the piece's place.
function looks(p) {
  let a = (Math.round(p[1] * 100) * 73856093) ^ (Math.round(p[2] * 100) * 19349663) ^ (p[0] * 83492791);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every piece placed on the ground and merged: { geometry, triangles: [per piece] }.
export function buildCoverGeometry(pieces, heightAt = () => 0) {
  const pos = [], nor = [], col = [], tris = [];
  for (const p of pieces) {
    const m = pieceMesh(p[0], looks(p)), c = Math.cos(p[3]), s = Math.sin(p[3]), base = heightAt(p[1], p[2]) - 0.04;
    tris.push(m.tris);
    for (let i = 0; i < m.p.length; i += 3) {
      const u = m.p[i], y = m.p[i + 1], v = m.p[i + 2];
      pos.push(p[1] + u * c - v * s, base + y, p[2] + u * s + v * c);
      const nu = m.n[i], ny = m.n[i + 1], nv = m.n[i + 2];
      nor.push(nu * c - nv * s, ny, nu * s + nv * c);
    }
    col.push(...m.c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.computeBoundingSphere();
  return { geometry: g, triangles: tris };
}

export class CoverView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.pieces = null;
  }
  build(sim) {
    this.clear();
    const v = this.view, { geometry, triangles } = buildCoverGeometry(sim.cover, (x, z) => v.terrain.heightAt(x, z));
    const material = fogAware(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: true, side: THREE.DoubleSide, forceSinglePass: true, emissive: 0x3a3024 }), v.fogUniforms);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "CoverWalls";
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
    this.mesh.userData.triangles = triangles;
    v.scene.add(this.mesh);
    this.pieces = sim.cover;
  }
  update(sim) {
    if (!sim.cover?.length) { if (this.mesh) this.clear(); return; }
    if (this.pieces !== sim.cover) this.build(sim);
  }
  event(ev) {
    if (ev.type !== "heroShotLand" || !ev.blocked) return;
    const fx = this.view.fx;
    if (!fx) return;
    const at = { x: ev.x, y: 0.8, z: ev.z };
    // A rocket or shell on concrete: a small blast and chips; a rifle round: sparks and a puff of dust.
    if (ev.heavy) { fx.hit(at, 0.45, null, "rocket"); fx.addDebris(at, 6, null, 0.7, 1); }
    else fx.hit(at, 0, null);
  }
  clear() {
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
    this.pieces = null;
  }
  reset() { this.clear(); }
}
