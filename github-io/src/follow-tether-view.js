import * as THREE from "three";

// Follow tether (AAA round 3, R3-B; docs/VIEW_PLUGINS.md). While a Medic, Engineer or Supply wagon on a
// Support order is selected, a dashed team-colour line runs from it to the unit or building it follows
// (like the rally route, selection-view.js createRally, but wide enough to read on a phone), and a pip floats over that target: a heart
// for a healer, a wrench for an Engineer. A view plugin: it only reads the simulation and the selection
// rings (selection-view.js updateRing marks `ring.userData.selected`). Nothing is built until the first
// tether; then one instanced set of dashes (1 draw call) and two instanced pips (1 each, only while shown).
// A WebGL line is 1 px wide on most devices, so the dashes are flat bars on the ground instead.
const CAPACITY = 16;

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(-0.1, -0.3, -0.5, -0.05, -0.5, 0.18);
  s.bezierCurveTo(-0.5, 0.42, -0.22, 0.52, 0, 0.3);
  s.bezierCurveTo(0.22, 0.52, 0.5, 0.42, 0.5, 0.18);
  s.bezierCurveTo(0.5, -0.05, 0.1, -0.3, 0, -0.42);
  return s;
}
function wrenchShape() {
  // An open-ended spanner: a handle and a C-shaped jaw at the top, drawn in the plane.
  const s = new THREE.Shape();
  s.moveTo(-0.08, -0.5);
  s.lineTo(0.08, -0.5);
  s.lineTo(0.08, 0.12);
  s.lineTo(0.28, 0.24);
  s.lineTo(0.28, 0.52);
  s.lineTo(0.12, 0.52);
  s.lineTo(0.12, 0.34);
  s.lineTo(-0.12, 0.34);
  s.lineTo(-0.12, 0.52);
  s.lineTo(-0.28, 0.52);
  s.lineTo(-0.28, 0.24);
  s.lineTo(-0.08, 0.12);
  s.lineTo(-0.08, -0.5);
  return s;
}

// Who is on a tether this frame: [{ helper, target }] for selected own support units with a live target.
export function tethers(sim, isSelected) {
  const out = [];
  for (const e of sim.entities) {
    if (e.team !== 0 || !e.support || !(e.hp > 0)) continue;
    const o = e.orders?.[0];
    if (o?.type !== "support" || !isSelected(e)) continue;
    const t = sim.get(o.target);
    if (t && t.hp > 0) out.push({ helper: e, target: t });
    if (out.length >= CAPACITY) break;
  }
  return out;
}

// Dashes along each tether: flat team-colour bars on the ground, marching toward the followed unit.
const DASH = 0.7, GAP = 0.5, DASHES = 256;

export class FollowTetherView {
  constructor(view) {
    this.view = view;
    this.line = null;
    this.phase = 0;
  }
  build() {
    const dash = new THREE.PlaneGeometry(1, 1);
    dash.rotateX(-Math.PI / 2);
    const line = new THREE.InstancedMesh(dash, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false }), DASHES);
    line.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    line.frustumCulled = false;
    line.renderOrder = 4;
    line.name = "FollowTether";
    line.count = 0;
    line.visible = false;
    const pip = (shape, color) => {
      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide }), CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      mesh.count = 0;
      mesh.visible = false;
      return mesh;
    };
    this.line = line;
    this.hearts = pip(heartShape(), 0xff6f8e);
    this.wrenches = pip(wrenchShape(), 0xffc75e);
    this.hearts.name = "FollowPipHeart";
    this.wrenches.name = "FollowPipWrench";
    this.dummy = new THREE.Object3D();
    this.view.scene.add(this.line, this.hearts, this.wrenches);
  }
  update(sim, dt = 0) {
    const objects = this.view.objects;
    const list = tethers(sim, (e) => !!objects?.get(e.id)?.userData?.ring?.userData?.selected);
    if (!list.length) {
      if (this.line?.visible) this.line.visible = this.hearts.visible = this.wrenches.visible = false;
      return;
    }
    if (!this.line) this.build();
    this.line.material.color.setHex(this.view.colors?.[0] ?? 0x92ebc5);
    // The dashes march toward the followed unit (held still when motion is off).
    const still = this.view.motionLevel === 0 || this.view.reducedMotion?.matches;
    if (!still) this.phase = (this.phase + (dt || 0) * 1.6) % (DASH + GAP);
    const d = this.dummy, ground = (e) => (objects.get(e.id)?.position.y || 0) + 0.16;
    let n = 0;
    for (const { helper: h, target: t } of list) {
      const dx = t.x - h.x, dz = t.z - h.z, len = Math.hypot(dx, dz);
      // From the helper's edge to the target's edge, so the line never runs under either body.
      const from = (h.radius || 0.6) + 0.2, to = len - (t.radius || 0.6) - 0.2;
      if (to <= from) continue;
      const ux = dx / len, uz = dz / len, angle = Math.atan2(-dz, dx), y0 = ground(h), y1 = ground(t);
      for (let a = from + this.phase - (DASH + GAP); a < to && n < DASHES; a += DASH + GAP) {
        const s0 = Math.max(from, a), s1 = Math.min(to, a + DASH);
        if (s1 - s0 < 0.05) continue;
        const mid = (s0 + s1) / 2;
        d.position.set(h.x + ux * mid, y0 + (y1 - y0) * (mid / len), h.z + uz * mid);
        d.rotation.set(0, angle, 0);
        d.scale.set(s1 - s0, 1, 0.2);
        d.updateMatrix();
        this.line.setMatrixAt(n++, d.matrix);
      }
    }
    this.line.count = n;
    this.line.visible = n > 0;
    if (n) this.line.instanceMatrix.needsUpdate = true;
    // Pips: over the followed unit, above its vitals bar, facing the camera.
    let hearts = 0, wrenches = 0;
    const q = this.view.camera?.quaternion;
    d.rotation.set(0, 0, 0);
    for (const { helper, target } of list) {
      const o = objects.get(target.id), u = o?.userData;
      if (!o || !o.visible) continue;
      const y = (o.position.y || 0) + (u?.bar?.position?.y ?? 2.4) + 0.9;
      d.position.set(o.position.x, y, o.position.z);
      if (q) d.quaternion.copy(q);
      d.scale.setScalar(1.3);
      d.updateMatrix();
      if (helper.type === "engineer") this.wrenches.setMatrixAt(wrenches++, d.matrix);
      else this.hearts.setMatrixAt(hearts++, d.matrix);
    }
    for (const [mesh, k] of [[this.hearts, hearts], [this.wrenches, wrenches]]) {
      mesh.count = k;
      mesh.visible = k > 0;
      if (k) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  reset() {
    if (!this.line) return;
    this.view.scene.remove(this.line, this.hearts, this.wrenches);
    for (const m of [this.line, this.hearts, this.wrenches]) { m.geometry.dispose(); m.material.dispose(); }
    this.line = null;
  }
}
