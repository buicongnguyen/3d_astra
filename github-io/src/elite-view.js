import * as THREE from "three";

// Gold rings under elite units (AAA round 2, W2-B; docs/VIEW_PLUGINS.md). One InstancedMesh of flat rings,
// 1 draw call while any elite is on screen, nothing built until the first one (a match with no elite never
// creates it). A view plugin: it only reads the simulation (`e.elite`). The ring pulses gently (still under
// motion-off) and its colour follows the affix: gold for all, with a warm tint per affix.
const CAPACITY = 64;
const TINT = { plated: 0xffd84a, swift: 0xfff07a, splitter: 0xffb04a, volatile: 0xff8a3a, banner: 0xffe066, mender: 0xb8ff8a };

export class EliteView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }
  build() {
    const geo = new THREE.RingGeometry(0.78, 1, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = "EliteRings";
    this.mesh.visible = false;
    this.view.scene.add(this.mesh);
  }
  update(sim, dt) {
    if (!sim.defence?.elites) { if (this.mesh?.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    if (!this.mesh) this.build();
    const objects = this.view.objects, motion = this.view.feelEnabled?.() !== false && !this.view.lowPower;
    let n = 0;
    for (const e of sim.entities) {
      if (!e.elite || !(e.hp > 0) || n >= CAPACITY) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const r = (e.radius || 0.7) * 1.35 * (o.userData?.readabilityScale || 1) * (motion ? 1 + 0.06 * Math.sin(sim.time * 4 + e.id) : 1);
      this.dummy.position.set(o.position.x, (o.position.y || 0) + 0.06, o.position.z);
      this.dummy.scale.set(r, 1, r);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      this.mesh.setColorAt(n, this.color.setHex(TINT[e.elite] || 0xffd84a));
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  }
  reset() {
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose?.();
    this.mesh = null;
  }
}
