import * as THREE from "three";

// H3a/H3d Hero mode on the battlefield (rules: src/sim/content/hero-mode.js; camera and HUD: src/hero-mode.js).
// A view plugin that only reads the simulation:
//   - the projectiles flying at the hero (sim.heroMode.shots): one InstancedMesh of glowing bolts (1 draw);
//   - a warning ring flashing where each rocket or shell will land (1 draw for all of them);
//   - the ground reticle where the weapon in hand will hit (1 draw), placed by the page (setReticle);
//   - Skywing's barrel roll when it dodges (the model's roll, no draw).
// Nothing is built until Hero mode first fires a shot or shows the reticle: normal play draws nothing more.
const BOLTS = 24;
const RINGS = 12;
const HOT = new THREE.Color(1, 0.62, 0.22);
const RIFLE = new THREE.Color(1, 0.92, 0.6);
const WARN = 0xff4a3a;

export class HeroModeView {
  constructor(view) {
    this.view = view;
    this.bolts = null;
    this.rings = null;
    this.reticle = null;
    this.dummy = new THREE.Object3D();
    this.rolls = new Map(); // entity id -> { t, seconds }
    this.clock = 0;
  }
  build() {
    const scene = this.view.scene;
    const bolt = new THREE.BoxGeometry(0.16, 0.16, 1.1);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    this.bolts = new THREE.InstancedMesh(bolt, boltMat, BOLTS);
    this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bolts.setColorAt(0, RIFLE);
    this.bolts.count = 0;
    this.bolts.frustumCulled = false;
    this.bolts.name = "HeroBolts";
    this.bolts.renderOrder = 4;
    const ring = new THREE.RingGeometry(0.82, 1, 40);
    ring.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.rings = new THREE.InstancedMesh(ring, ringMat, RINGS);
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.name = "HeroWarnRings";
    this.rings.renderOrder = 3;
    // The reticle: a thin ring with four ticks, drawn over the ground.
    const r = new THREE.RingGeometry(0.55, 0.68, 32);
    const ticks = [0, 1, 2, 3].map((i) => { const g = new THREE.PlaneGeometry(0.1, 0.42); g.translate(0, 0.98, 0); g.rotateZ((i * Math.PI) / 2); return g; });
    const geo = mergeGeometries([r, ...ticks]);
    geo.rotateX(-Math.PI / 2);
    this.reticleMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.reticle = new THREE.Mesh(geo, this.reticleMat);
    this.reticle.name = "HeroReticle";
    this.reticle.renderOrder = 6;
    this.reticle.visible = false;
    this.reticle.frustumCulled = false;
    scene.add(this.bolts, this.rings, this.reticle);
  }
  // The page's reticle: { x, z, y, size, locked, progress, target } or null to hide it.
  setReticle(p) {
    if (!p) { if (this.reticle) this.reticle.visible = false; return; }
    if (!this.reticle) this.build();
    const s = p.size || 1;
    this.reticle.position.set(p.x, (p.y || 0) + 0.12, p.z);
    this.reticle.scale.set(s, 1, s);
    this.reticle.rotation.y = p.locked ? this.clock * 4 : (p.progress || 0) * Math.PI;
    this.reticleMat.color.set(p.locked ? 0xff6a3a : p.target ? 0xfff2b0 : 0xd8e6f0);
    this.reticle.visible = true;
  }
  event(ev) {
    if (ev.type === "heroDodge" && ev.roll) this.rolls.set(ev.id, { t: 0, seconds: Math.max(0.2, ev.seconds || 0.3) });
  }
  update(sim, dt) {
    this.clock += dt;
    const shots = sim.heroMode?.shots;
    if (this.rolls.size) this.roll(dt);
    if (!shots?.length) {
      if (this.bolts && (this.bolts.count || this.rings.count)) { this.bolts.count = 0; this.rings.count = 0; this.bolts.visible = this.rings.visible = false; }
      return;
    }
    if (!this.bolts) this.build();
    const T = this.view.terrain;
    let b = 0, r = 0;
    for (const s of shots) {
      const span = Math.max(1e-3, s.at - s.t0), k = Math.min(1, Math.max(0, (sim.time - s.t0) / span));
      const from = this.view.objects.get(s.by)?.position;
      const sx = from ? from.x : s.sx, sz = from ? from.z : s.sz;
      const ground = T.heightAt(s.x, s.z);
      const sy = (from ? from.y : T.heightAt(sx, sz)) + 1.1, ty = ground + (s.air ? 3.5 : 0.9);
      // A shell or rocket arcs; a rifle round flies straight.
      const arc = s.heavy ? Math.sin(k * Math.PI) * Math.min(4, span * 3) : 0;
      if (b < BOLTS) {
        const x = sx + (s.x - sx) * k, z = sz + (s.z - sz) * k, y = sy + (ty - sy) * k + arc;
        this.dummy.position.set(x, y, z);
        this.dummy.lookAt(s.x, ty, s.z);
        const size = s.heavy ? 1.9 : 1.1;
        this.dummy.scale.set(size, size, s.heavy ? 1.1 : 1.6);
        this.dummy.updateMatrix();
        this.bolts.setMatrixAt(b, this.dummy.matrix);
        this.bolts.setColorAt(b, s.heavy ? HOT : RIFLE);
        b++;
      }
      // The landing ring for a rocket or shell: it tightens and flashes as the round comes in.
      if (s.heavy && !s.air && r < RINGS) {
        const radius = Math.max(1.3, s.splash?.r || 1.3) * (1.25 - 0.25 * k);
        this.dummy.position.set(s.x, ground + 0.1, s.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(radius, 1, radius);
        this.dummy.updateMatrix();
        this.rings.setMatrixAt(r, this.dummy.matrix);
        r++;
      }
    }
    this.bolts.count = b;
    this.rings.count = r;
    this.bolts.visible = b > 0;
    this.rings.visible = r > 0;
    this.rings.material.opacity = 0.55 + 0.4 * Math.abs(Math.sin(this.clock * 12));
    this.bolts.instanceMatrix.needsUpdate = true;
    if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
    if (r) this.rings.instanceMatrix.needsUpdate = true;
  }
  roll(dt) {
    for (const [id, roll] of this.rolls) {
      roll.t += dt;
      const model = this.view.objects.get(id)?.userData.model;
      const k = Math.min(1, roll.t / roll.seconds);
      if (model) model.rotation.z = k < 1 ? k * Math.PI * 2 : 0;
      if (k >= 1) this.rolls.delete(id);
    }
  }
  reset() {
    this.rolls.clear();
    if (this.bolts) { this.bolts.count = 0; this.rings.count = 0; this.bolts.visible = this.rings.visible = false; }
    if (this.reticle) this.reticle.visible = false;
  }
}

// Several plain geometries (position only) as one, so the reticle stays a single draw.
function mergeGeometries(list) {
  const pos = [], index = [];
  let offset = 0;
  for (const g of list) {
    const ng = g.index ? g : g.toNonIndexed();
    pos.push(...ng.attributes.position.array);
    if (ng.index) index.push(...[...ng.index.array].map((i) => i + offset));
    else for (let i = 0; i < ng.attributes.position.count; i++) index.push(i + offset);
    offset += ng.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}
