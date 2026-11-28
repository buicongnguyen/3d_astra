import * as THREE from "three";
import { WATCH } from "./sim/content/hero-challenges.js";

// H8 Hero challenges on the battlefield (rules: src/sim/content/hero-challenges.js). A view plugin, only in a challenge:
//   - the watchers' view cones (Sabotage): a soft fan on the ground for each patrol and guard the player can see,
//     green while unseen, amber while one is filling the "seen" meter, red once the alarm is up; ONE mesh whose few
//     vertices move each frame (1 draw);
//   - the markers: a gold ring and a light beam on each relay still to charge, on the extraction point once it is
//     open, on the sniper nest, and an orange ring under every convoy truck (the marked targets); ONE instanced mesh
//     with a colour per instance (1 draw).
// No other match builds anything here.
const SEG = 10;
// Over the fog plane and the ground paint (m).
const LIFT = 0.32;
const MAX_WATCH = 8;
const MAX_MARKS = 12;
export const CONE_COLORS = Object.freeze({ calm: [0.45, 1, 0.55], seen: [1, 0.72, 0.2], alarm: [1, 0.3, 0.22] });
const MARK = Object.freeze({ goal: new THREE.Color("#ffd36a"), out: new THREE.Color("#7fe8ff"), target: new THREE.Color("#ff7a2a") });

export class ChallengeView {
  constructor(view) {
    this.view = view;
    this.cones = null;
    this.marks = null;
    this.dummy = new THREE.Object3D();
    this.drawn = { cones: 0, marks: 0 };
    this.clock = 0;
  }
  build() {
    const scene = this.view.scene;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_WATCH * SEG * 9);
    this.col = new Float32Array(MAX_WATCH * SEG * 12);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.cones = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    this.cones.name = "WatchCones";
    this.cones.frustumCulled = false;
    this.cones.renderOrder = 2;
    // A marker: a ground ring and a tall thin beam (two crossed planes), merged.
    const ring = new THREE.RingGeometry(0.82, 1, 36).rotateX(-Math.PI / 2).toNonIndexed();
    const beam = (turn) => new THREE.PlaneGeometry(0.16, 7).translate(0, 3.5, 0).rotateY(turn).toNonIndexed();
    const parts = [ring, beam(0), beam(Math.PI / 2)];
    const merged = new THREE.BufferGeometry(), arr = [];
    for (const p of parts) { arr.push(...p.attributes.position.array); p.dispose(); }
    merged.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    this.marks = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), MAX_MARKS);
    this.marks.name = "ChallengeMarks";
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.marks.count = 0;
    this.marks.frustumCulled = false;
    this.marks.renderOrder = 3;
    for (let i = 0; i < MAX_MARKS; i++) this.marks.setColorAt(i, MARK.goal);
    scene.add(this.cones, this.marks);
  }
  update(sim, dt) {
    this.clock += dt;
    const c = sim.challenge, def = sim.missionDef?.challenge;
    if (!c || !def) { if (this.cones) this.hide(); return; }
    if (!this.cones) this.build();
    const v = this.view, T = v.terrain;
    // ---------- cones
    let n = 0;
    if (def.kind === "sabotage") {
      const range = WATCH.range[sim.difficulty === "story" || sim.difficulty === "veteran" ? sim.difficulty : "standard"], half = (WATCH.half * Math.PI) / 180;
      const tint = c.alarm ? CONE_COLORS.alarm : CONE_COLORS.calm;
      for (const e of sim.entities) {
        if (!e.watch || e.hp <= 0 || n >= MAX_WATCH || !sim.isVisible(e, 0)) continue;
        const o = v.objects.get(e.id)?.position, x = o ? o.x : e.x, z = o ? o.z : e.z, a = e.angle || 0;
        const col = c.seen === e.id && !c.alarm ? CONE_COLORS.seen : tint, y = T.heightAt(x, z) + LIFT;
        for (let s = 0; s < SEG; s++) {
          const a0 = a - half + (2 * half * s) / SEG, a1 = a - half + (2 * half * (s + 1)) / SEG, o9 = (n * SEG + s) * 9, o12 = (n * SEG + s) * 12;
          const x0 = x + Math.sin(a0) * range, z0 = z + Math.cos(a0) * range, x1 = x + Math.sin(a1) * range, z1 = z + Math.cos(a1) * range;
          this.pos.set([x, y, z, x0, T.heightAt(x0, z0) + LIFT, z0, x1, T.heightAt(x1, z1) + LIFT, z1], o9);
          this.col.set([col[0], col[1], col[2], 0.62, col[0], col[1], col[2], 0.2, col[0], col[1], col[2], 0.2], o12);
        }
        n++;
      }
    }
    const g = this.cones.geometry;
    g.setDrawRange(0, n * SEG * 3);
    if (n) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    this.cones.visible = n > 0;
    // ---------- markers
    let m = 0;
    const mark = (x, z, r, color) => {
      if (m >= MAX_MARKS) return;
      const d = this.dummy, pulse = 1 + 0.06 * Math.sin(this.clock * 3 + m);
      d.position.set(x, T.heightAt(x, z) + 0.08, z);
      d.rotation.set(0, 0, 0);
      d.scale.set(r * pulse, 1, r * pulse);
      d.updateMatrix();
      this.marks.setMatrixAt(m, d.matrix);
      this.marks.setColorAt(m, color);
      m++;
    };
    const region = (name) => sim.missionDef.regions?.[name];
    if (def.kind === "sabotage") {
      for (const tag of def.relays) {
        if (c.charges?.[tag]?.set) continue;
        const r = sim.tagged(tag)[0];
        if (r) mark(r.x, r.z, r.radius + 1.2, MARK.goal);
      }
      if (c.planted) { const p = region(def.extract); if (p) mark(p.x, p.z, p.r, MARK.out); }
    } else {
      const p = region(def.nest);
      if (p && !c.inNest) mark(p.x, p.z, p.r, MARK.goal);
      for (const e of sim.entities) if (e.tag === "convoy" && e.hp > 0 && sim.isVisible(e, 0)) { const o = v.objects.get(e.id)?.position; mark(o ? o.x : e.x, o ? o.z : e.z, 2, MARK.target); }
    }
    this.marks.count = m;
    this.marks.visible = m > 0;
    if (m) { this.marks.instanceMatrix.needsUpdate = true; if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true; }
    this.drawn.cones = n;
    this.drawn.marks = m;
  }
  hide() {
    this.cones.visible = false;
    this.marks.visible = false;
    this.marks.count = 0;
    this.drawn.cones = this.drawn.marks = 0;
  }
  reset() { if (this.cones) this.hide(); }
}
