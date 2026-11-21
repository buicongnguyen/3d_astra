import * as THREE from "three";

// Frontier Defence readability (AAA round 3, R3-E), a view plugin (docs/VIEW_PLUGINS.md):
//  - contrast discs: a dark disc with a team-coloured rim under every Defence unit (the waves, armour
//    squads, the commander and its Vanguards), so they read on the orange ground: one InstancedMesh,
//    1 draw;
//  - tower badges: a small plate over each crewed tower with the crew's icon and its tier pips (bronze,
//    steel, gold; a gold double rim and white pips for branch ranks), a fixed size on screen so it reads
//    at the phone zoom: one InstancedMesh of camera-facing quads on one canvas atlas, 1 draw.
// Only in a Defence match (sim.defence): anywhere else nothing is built and nothing is drawn. It only
// reads the simulation. Buffers are uploaded only when something moved or changed.
const UNITS = 192, TOWERS = 48;
export const CREWS = ["ranger", "breaker", "antitank", "watcher", "tank", "scorcher"];
// Atlas rows: tier 1, 2, 3, then branch rank 1 and 2.
const STATES = 5, CELL = 64;
const TIER = ["#b8692e", "#c4dcee", "#ffd23a", "#ffd23a", "#ffd23a"];
const RIM = { friend: 0x7fe8ff, foe: 0xff5a6e };
// Badge size on screen (CSS px) and how far over the tower's top it floats (world units).
export const BADGE_PX = 30, BADGE_LIFT = 1.1;
// The disc under a unit: its radius times this (times the army readability scale).
export const DISC_SCALE = 1.45;

// Crew glyphs on a 24-unit grid (the house icon grid, icons.js): SVG path data for Path2D, plus circles.
const GLYPH = {
  ranger: { d: "M12 1v6m0 10v6M1 12h6m10 0h6", c: [[12, 12, 7], [12, 12, 1.2]] },
  breaker: { d: "M12 2v8m-3-3 3 3 3-3", c: [[12, 16, 5.5]] },
  antitank: { d: "M20 4l-9 3-4 4 6 6 4-4 3-9zM7 11l-3 1 2 2M13 17l-1 3-2-2M4 20l3-3" },
  watcher: { d: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z", c: [[12, 12, 2.8]] },
  tank: { d: "M3 13h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 13V8h8v5M15 9h7" },
  scorcher: { d: "M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z" },
};

// The atlas: one cell per crew (column) and state (row), drawn once on a canvas.
function drawAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = CREWS.length * CELL;
  canvas.height = STATES * CELL;
  const g = canvas.getContext("2d");
  CREWS.forEach((crew, col) => {
    for (let row = 0; row < STATES; row++) {
      const x = col * CELL, y = row * CELL, tint = TIER[row], rank = row >= 3;
      g.save();
      g.translate(x, y);
      // Plate: dark navy with the tier colour as a thick rim (a second inner rim for branch ranks).
      g.beginPath();
      g.roundRect(4, 4, CELL - 8, CELL - 8, 12);
      g.fillStyle = "rgba(6, 16, 24, 0.94)";
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = tint;
      g.stroke();
      if (rank) { g.beginPath(); g.roundRect(10, 10, CELL - 20, CELL - 20, 7); g.lineWidth = 2; g.stroke(); }
      // The crew glyph, 24 units in a 30 px box over the pips.
      g.save();
      g.translate(17, 8);
      g.scale(30 / 24, 30 / 24);
      g.lineWidth = 2.6;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "#ffffff";
      const glyph = GLYPH[crew];
      g.stroke(new Path2D(glyph.d));
      for (const [cx, cy, r] of glyph.c || []) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      // Pips: the tier count in its colour; branch ranks show three gold pips and the rank in white.
      const pips = rank ? 3 : row + 1, extra = rank ? row - 2 : 0, total = pips + extra, w = 9, gap = 3, start = CELL / 2 - (total * w + (total - 1) * gap) / 2;
      for (let i = 0; i < total; i++) {
        const px = start + i * (w + gap) + w / 2, py = CELL - 15;
        g.beginPath();
        g.moveTo(px, py - 5); g.lineTo(px + 5, py); g.lineTo(px, py + 5); g.lineTo(px - 5, py); g.closePath();
        g.fillStyle = i < pips ? TIER[Math.min(row, 2)] : "#ffffff";
        g.fill();
      }
      g.restore();
    }
  });
  return canvas;
}

// The disc: a dark fill (vertex colour near black, so the team tint barely shows) and a bright rim (white,
// so the instance colour shows in full).
function discGeometry() {
  const n = 28, inner = 0.82, positions = [0, 0, 0], colors = [0.05, 0.07, 0.1], index = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    positions.push(c * inner, 0, s * inner, c * inner, 0, s * inner, c, 0, s);
    colors.push(0.05, 0.07, 0.1, 1, 1, 1, 1, 1, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = 1 + i * 3, b = 1 + ((i + 1) % n) * 3;
    index.push(0, b, a);
    index.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  return geo;
}

export class DefenceReadabilityView {
  constructor(view) {
    this.view = view;
    this.discs = null;
    this.badges = null;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.tops = new WeakMap();
    this.key = "";
    this.drawnDiscs = 0;
    this.teams = new Int8Array(UNITS).fill(-1);
  }
  build() {
    const discs = new THREE.InstancedMesh(discGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, name: "DefenceDisc" }), UNITS);
    discs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    discs.count = 0;
    discs.frustumCulled = false;
    discs.matrixAutoUpdate = false;
    discs.renderOrder = 2;
    discs.name = "DefenceDiscs";
    discs.visible = false;
    const texture = new THREE.CanvasTexture(drawAtlas());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, name: "DefenceBadge" });
    // Each instance shows one atlas cell: its offset comes from a per-instance attribute.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 badgeCell;")
        .replace("#include <uv_vertex>", `#include <uv_vertex>\n\tvMapUv = ( vMapUv + badgeCell ) * vec2( ${(1 / CREWS.length).toFixed(6)}, ${(1 / STATES).toFixed(6)} );`);
    };
    material.customProgramCacheKey = () => "defence-badge";
    const quad = new THREE.PlaneGeometry(1, 1);
    const cells = new THREE.InstancedBufferAttribute(new Float32Array(TOWERS * 2), 2);
    cells.setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute("badgeCell", cells);
    const badges = new THREE.InstancedMesh(quad, material, TOWERS);
    badges.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    badges.count = 0;
    badges.frustumCulled = false;
    badges.matrixAutoUpdate = false;
    badges.renderOrder = 20;
    badges.name = "DefenceBadges";
    badges.visible = false;
    this.view.scene.add(discs, badges);
    Object.assign(this, { discs, badges, cells, texture });
  }
  update(sim) {
    if (!sim?.defence) { if (this.discs?.visible || this.badges?.visible) { this.discs.visible = this.badges.visible = false; this.discs.count = this.badges.count = 0; } return; }
    if (!this.discs) this.build();
    this.updateDiscs(sim);
    this.updateBadges(sim);
  }
  updateDiscs(sim) {
    const objects = this.view.objects, mesh = this.discs, A = mesh.instanceMatrix.array, terrain = this.view.terrain;
    let n = 0, dirty = false, tinted = false;
    for (const e of sim.entities) {
      if (e.kind !== "unit" || !(e.hp > 0) || n >= UNITS) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const r = (e.radius || 0.7) * DISC_SCALE * (o.userData?.readabilityScale || 1);
      const y = (e.flying || e.fly ? terrain?.heightAt?.(o.position.x, o.position.z) ?? 0 : o.position.y || 0) + 0.04;
      // A flat disc is scale and position only: written straight into the buffer (no compose), and
      // only when it changed, so a still frame costs no matrix work and no upload.
      const at = n * 16, x = Math.fround(o.position.x), yy = Math.fround(y), z = Math.fround(o.position.z), rr = Math.fround(r);
      if (this.drawnDiscs <= n || A[at] !== rr || A[at + 12] !== x || A[at + 13] !== yy || A[at + 14] !== z) {
        A.fill(0, at, at + 16);
        A[at] = rr; A[at + 5] = 1; A[at + 10] = rr; A[at + 12] = x; A[at + 13] = yy; A[at + 14] = z; A[at + 15] = 1;
        dirty = true;
      }
      // The rim colour follows the team (a slot may change hands as units come and go).
      const team = e.team === 0 ? 0 : 1;
      if (this.teams[n] !== team) { this.teams[n] = team; mesh.setColorAt(n, this.color.setHex(team ? RIM.foe : RIM.friend)); tinted = true; }
      n++;
    }
    if (n !== mesh.count) dirty = true;
    this.drawnDiscs = n;
    mesh.count = n;
    mesh.visible = n > 0;
    if (n && dirty) mesh.instanceMatrix.needsUpdate = true;
    if (n && tinted) mesh.instanceColor.needsUpdate = true;
  }
  // The top of a crewed tower's model, measured once per dress (the crew stands on the platform).
  topOf(o) {
    const u = o.userData, seen = this.tops.get(o);
    if (seen && seen.dressed === u.dressed) return seen.top;
    o.updateWorldMatrix(true, true);
    const top = new THREE.Box3().setFromObject(o).max.y;
    this.tops.set(o, { dressed: u.dressed, top });
    return top;
  }
  updateBadges(sim) {
    const view = this.view, objects = view.objects, mesh = this.badges, cam = view.camera;
    const size = (BADGE_PX * view.zoom) / (view.frameHeight || view.height || 600);
    let n = 0, key = `${size.toFixed(3)}|${cam.quaternion.x.toFixed(4)},${cam.quaternion.y.toFixed(4)},${cam.quaternion.z.toFixed(4)}`;
    const list = [];
    for (const e of sim.entities) {
      if (!e.crew || e.team !== 0 || !(e.hp > 0) || n >= TOWERS) continue;
      const o = objects.get(e.id), col = CREWS.indexOf(e.crew);
      if (!o || !o.visible || col < 0) continue;
      const row = e.branchRank ? 2 + Math.min(2, e.branchRank) : Math.max(0, Math.min(2, (e.tier || 1) - 1));
      const top = this.topOf(o);
      list.push([o.position.x, top + BADGE_LIFT + size / 2, o.position.z, col, row]);
      key += `|${e.id}:${col}${row}:${o.position.x.toFixed(2)},${top.toFixed(2)},${o.position.z.toFixed(2)}`;
      n++;
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (key === this.key) return;
    this.key = key;
    this.dummy.quaternion.copy(cam.quaternion);
    this.dummy.scale.set(size, size, 1);
    list.forEach(([x, y, z, col, row], i) => {
      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      // Canvas rows run down, texture v runs up: row 0 is the top cell.
      this.cells.setXY(i, col, STATES - 1 - row);
    });
    if (n) { mesh.instanceMatrix.needsUpdate = true; this.cells.needsUpdate = true; }
    this.dummy.quaternion.identity();
  }
  reset() {
    if (!this.discs) return;
    for (const m of [this.discs, this.badges]) { this.view.scene.remove(m); m.geometry.dispose(); m.material.dispose(); m.dispose?.(); }
    this.texture.dispose();
    this.discs = this.badges = null;
    this.tops = new WeakMap();
    this.key = "";
    this.drawnDiscs = 0;
    this.teams.fill(-1);
  }
}
