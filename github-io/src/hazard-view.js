import * as THREE from "three";
import { fogAware } from "./fog-aware.js";
import { CELL } from "./fx-kinds/cells.js";
import { HAZARD } from "./sim/hazards.js";

// H8 explosive crates and barrels on the battlefield (rules: src/sim/hazards.js). A view plugin:
//   - every hazard of the match (sim.hazards) is one instance of ONE instanced mesh (1 draw, built only in a match
//     that has hazards, i.e. a match with cover): a red fuel drum with orange hazard stripes and a black-and-orange
//     striped crate beside it, flat-shaded vertex colours with a soft dark blob under them, sunk into the fog of war;
//     a blown one is hidden (its instance scaled to nothing, no rebuild);
//   - a blast (hazardBlast) shows fire, smoke and chips from the effect pools, a short orange shockwave ring on the
//     ground and a scorch; no camera shake anywhere (owner: never on phones).
const C = (hex) => new THREE.Color(hex);
export const HAZARD_LOOK = Object.freeze({ red: C("#c8281e"), orange: C("#ff8a1e"), black: C("#1b1712"), steel: C("#8a8f94"), lid: C("#5d6064") });
const DRUM = { r: 0.36, h: 0.95, seg: 12, rings: 4 };

// Flat-shaded triangles with vertex colours (rgba).
function tris() {
  const p = [], n = [], c = [];
  const tri = (a, b, d, col, alpha = [1, 1, 1], shade = 1) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    [a, b, d].forEach((q, i) => { p.push(...q); n.push(nx / l, ny / l, nz / l); c.push(col.r * shade, col.g * shade, col.b * shade, alpha[i]); });
  };
  return { p, n, c, tri, quad: (a, b, d, e, col, shade) => { tri(a, b, d, col, undefined, shade); tri(a, d, e, col, undefined, shade); } };
}

// One hazard in its own space (y up, metres): a drum with diagonal red / orange bands, a steel lid with a rim, a
// striped crate beside it and the blob under both. About 180 triangles.
export function hazardMesh() {
  const m = tris(), L = HAZARD_LOOK, { r, h, seg, rings } = DRUM;
  // The blob: dark in the middle, clear at the rim.
  const black = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2;
    m.tri([0.15, 0.03, 0], [0.15 + Math.cos(a1) * 1.05, 0.03, Math.sin(a1) * 0.85], [0.15 + Math.cos(a0) * 1.05, 0.03, Math.sin(a0) * 0.85], black, [0.55, 0, 0]);
  }
  const at = (i, y) => { const a = (i / seg) * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  for (let j = 0; j < rings; j++) {
    const y0 = (j / rings) * h, y1 = ((j + 1) / rings) * h;
    for (let i = 0; i < seg; i++) {
      // Diagonal bands: the band steps one segment per ring.
      const col = (((i + j) >> 1) & 1) ? L.orange : L.red;
      m.quad(at(i, y0), at(i, y1), at(i + 1, y1), at(i + 1, y0), col, j === 0 ? 0.8 : 1);
    }
  }
  // A dark rolling hoop and the lid.
  for (const y of [h * 0.5]) for (let i = 0; i < seg; i++) { const g = 1.04; const a = at(i, y), b = at(i + 1, y); m.quad([a[0] * g, y - 0.025, a[2] * g], [a[0] * g, y + 0.025, a[2] * g], [b[0] * g, y + 0.025, b[2] * g], [b[0] * g, y - 0.025, b[2] * g], L.black); }
  for (let i = 0; i < seg; i++) m.tri([0, h + 0.01, 0], at(i + 1, h + 0.01), at(i, h + 0.01), i % 3 ? L.lid : L.steel);
  // The crate: 0.5 m, beside the drum, black and orange vertical stripes on each side, an orange top.
  const cx = 0.62, cz = 0.18, s = 0.25, y0 = 0, y1 = 0.5, k = 4;
  const side = (ax, az, bx, bz) => {
    for (let i = 0; i < k; i++) {
      const u0 = i / k, u1 = (i + 1) / k;
      const p0 = [ax + (bx - ax) * u0, az + (bz - az) * u0], p1 = [ax + (bx - ax) * u1, az + (bz - az) * u1];
      m.quad([p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [p1[0], y0, p1[1]], i % 2 ? L.black : L.orange);
    }
  };
  side(cx - s, cz - s, cx + s, cz - s); side(cx + s, cz - s, cx + s, cz + s); side(cx + s, cz + s, cx - s, cz + s); side(cx - s, cz + s, cx - s, cz - s);
  m.quad([cx - s, y1, cz - s], [cx - s, y1, cz + s], [cx + s, y1, cz + s], [cx + s, y1, cz - s], L.orange, 1.1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(m.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(m.n, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(m.c, 4));
  g.computeBoundingSphere();
  return g;
}

export class HazardView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.list = null;
    this.key = "";
    this.dummy = new THREE.Object3D();
  }
  build(sim) {
    this.clear();
    const v = this.view, list = sim.hazards;
    const material = fogAware(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: true, side: THREE.DoubleSide, forceSinglePass: true, emissive: 0x2a1408 }), v.fogUniforms);
    this.mesh = new THREE.InstancedMesh(hazardMesh(), material, list.length);
    this.mesh.name = "Hazards";
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    v.scene.add(this.mesh);
    this.list = list;
    this.key = "";
    this.place();
  }
  // Each hazard on the ground, turned by its index; a blown one scaled to nothing.
  place() {
    const v = this.view, d = this.dummy;
    this.list.forEach((h, i) => {
      d.position.set(h[0], v.terrain.heightAt(h[0], h[1]) - 0.02, h[1]);
      d.rotation.set(0, i * 2.1, 0);
      d.scale.setScalar(h[2] ? 1 : 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.key = this.list.map((h) => h[2]).join("");
  }
  update(sim) {
    if (!sim.hazards?.length) { if (this.mesh) this.clear(); return; }
    if (this.list !== sim.hazards) { this.build(sim); return; }
    if (this.key !== sim.hazards.map((h) => h[2]).join("")) this.place();
  }
  event(ev) {
    if (ev.type !== "hazardBlast") return;
    const fx = this.view.fx;
    if (!fx) return;
    const anchor = { x: ev.x, z: ev.z, team: ev.team };
    // The barrage blast drawn to the hazard's reach (fire column, sparks, chips, crater; fx.js strike), called
    // directly: no shake (owner: never on phones; the camera never shakes for a hazard).
    fx.strike({ x: ev.x, z: ev.z, team: ev.team, radius: ev.radius || HAZARD.radius });
    // A short orange shockwave ring out to the blast's reach.
    fx.decal({ x: ev.x, z: ev.z }, (ev.radius || HAZARD.radius) * 2.1, 0.45, anchor, CELL.ring, [1, 0.62, 0.22, 0.95], fx.glow, 0.8, { hold: 0, y: 0.1 });
  }
  clear() {
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose?.();
    this.mesh = null;
    this.list = null;
  }
  reset() { this.clear(); }
}
