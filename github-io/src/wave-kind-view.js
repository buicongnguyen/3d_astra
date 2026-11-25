import * as THREE from "three";
import KINDS from "./defence/kinds.json" with { type: "json" };

// Wave kinds on the battlefield (W10, Defence 6.7; sim/content/wave-kinds.js). A view plugin that only reads
// the simulation (`e.waveKind`):
//   - the unit's model takes the kind's tint (kinds.json `tint`, copied into the entity batches' instanceColor
//     like the paint schemes: no material, batch or draw call of its own);
//   - a hexagon ring in the kind's colour under it, one InstancedMesh for every kind (1 draw while any is on
//     screen, nothing built until the first one; a match with no kind never creates it). Buffers are uploaded
//     only when a ring moved, as the elite rings do.
const CAPACITY = 96;

export class WaveKindView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.drawn = 0;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }
  dress(root, e) {
    const k = e.waveKind && e.kind === "unit" ? KINDS[e.waveKind] : null;
    if (!k?.tint) return;
    root.userData.waveKind = e.waveKind;
    root.userData.model?.traverse?.((part) => { if (part.isMesh) part.userData.tint = k.tint; });
  }
  build() {
    const geo = new THREE.RingGeometry(0.8, 1, 6);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = "WaveKindRings";
    this.mesh.visible = false;
    this.view.scene.add(this.mesh);
  }
  update(sim) {
    if (!sim.defence?.kinds) { if (this.mesh?.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    if (!this.mesh) this.build();
    const objects = this.view.objects, A = this.mesh.instanceMatrix.array;
    let n = 0, dirty = false;
    for (const e of sim.entities) {
      if (!e.waveKind || !(e.hp > 0) || n >= CAPACITY) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const r = (e.radius || 0.7) * (KINDS[e.waveKind]?.child ? 1.1 : 1.45) * (o.userData?.readabilityScale || 1);
      this.dummy.position.set(o.position.x, (o.position.y || 0) + 0.07, o.position.z);
      this.dummy.rotation.y = 0;
      this.dummy.scale.set(r, 1, r);
      this.dummy.updateMatrix();
      const m = this.dummy.matrix.elements;
      let moved = this.drawn <= n;
      for (let k = 0; !moved && k < 16; k++) if (A[n * 16 + k] !== Math.fround(m[k])) moved = true;
      if (moved) { dirty = true; this.mesh.setMatrixAt(n, this.dummy.matrix); this.mesh.setColorAt(n, this.color.set(KINDS[e.waveKind]?.ring || "#ffffff")); }
      n++;
    }
    if (n !== this.mesh.count) dirty = true;
    this.drawn = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n && dirty) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  }
  reset() {
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose?.();
    this.mesh = null;
    this.drawn = 0;
  }
}
