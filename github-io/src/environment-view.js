import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CROSSINGS, SURFACES } from "./terrain.js";
export function optimizeEnvironment(assets) {
  assets.updateMatrixWorld(true);
  const original = new Set();
  for (const source of assets.children) {
    if (!source.name.startsWith("asset_")) continue;
    const buckets = new Map();
    source.traverse((m) => {
      if (!m.isMesh) return;
      if (!buckets.has(m.material)) buckets.set(m.material, []);
      buckets
        .get(m.material)
        .push(m.geometry.clone().applyMatrix4(m.matrixWorld));
      original.add(m.geometry);
    });
    source.clear();
    source.position.set(0, 0, 0);
    source.quaternion.identity();
    source.scale.set(1, 1, 1);
    for (const [material, parts] of buckets) {
      source.add(new THREE.Mesh(mergeGeometries(parts, false), material));
      for (const p of parts) p.dispose();
    }
  }
  for (const geometry of original) geometry.dispose();
}
export function paintTerrain(ctx, terrain, size) {
  for (let y = 0; y < size; y += 4)
    for (let x = 0; x < size; x += 4) {
      const wx = (x / size) * 96 - 48,
        wz = (y / size) * 96 - 48;
      ctx.fillStyle = SURFACES[terrain.at(wx, wz)];
      ctx.fillRect(x, y, 4, 4);
    }
}
export class EnvironmentView {
  constructor(scene, terrain, assets) {
    this.scene = scene;
    this.terrain = terrain;
    this.root = new THREE.Group();
    this.decor = new THREE.Group();
    this.root.add(this.decor);
    scene.add(this.root);
    this.water = null;
    this.particles = [];
    this.lastTime = 0;
    if (terrain.id !== "riverlands") return;
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x428a94,
      roughness: 0.32,
      metalness: 0.25,
    });
    // A real channel bed is cut into the ground; water stays below the banks.
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(96, 6, 96, 6),
      waterMat,
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.09;
    this.water.receiveShadow = true;
    this.root.add(this.water);
    const positions = this.water.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      if (Math.abs(positions.getX(i)) <= 5) positions.setZ(i, 0.12);
    this.waterBase = positions.array.slice();
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const c = new THREE.Color(
        Math.abs(positions.getX(i)) <= 5 ? 0x94c6b5 : 0x428a94,
      );
      c.toArray(colors, i * 3);
    }
    this.water.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
    waterMat.vertexColors = true;
    waterMat.color.setHex(0xffffff);
    const normalCanvas = document.createElement("canvas");
    normalCanvas.width = 128;
    normalCanvas.height = 128;
    const context = normalCanvas.getContext("2d"),
      normal = context.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        normal.data[i] =
          128 +
          Math.sin((x / 128) * Math.PI * 8 + (y / 128) * Math.PI * 4) * 40;
        normal.data[i + 1] =
          128 +
          Math.cos((y / 128) * Math.PI * 12 + (x / 128) * Math.PI * 4) * 40;
        normal.data[i + 2] = 245;
        normal.data[i + 3] = 255;
      }
    context.putImageData(normal, 0, 0);
    this.normalTexture = new THREE.CanvasTexture(normalCanvas);
    this.normalTexture.wrapS = this.normalTexture.wrapT = THREE.RepeatWrapping;
    this.normalTexture.repeat.set(20, 2);
    waterMat.normalMap = this.normalTexture;
    waterMat.normalScale.set(0.4, 0.4);
    const add = (name, x, z, scale = 1, target = this.root) => {
      const source = assets.getObjectByName("asset_" + name);
      if (!source) return;
      const o = source.clone(true);
      o.position.set(x, 0, z);
      o.scale.setScalar(scale);
      o.traverse((m) => {
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      target.add(o);
      return o;
    };
    for (const c of CROSSINGS.filter((c) => c.type === "bridge"))
      add("bridge", c.x, 0);
    let seed = 773;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Batch repeated meshes by source primitive: decoration adds a fixed number of draw calls.
    const instances = (name, transforms) => {
      const source = assets.getObjectByName("asset_" + name);
      if (!source) return;
      source.updateMatrixWorld(true);
      source.traverse((m) => {
        if (!m.isMesh) return;
        const batch = new THREE.InstancedMesh(
          m.geometry,
          m.material,
          transforms.length,
        );
        batch.castShadow = true;
        batch.receiveShadow = true;
        transforms.forEach((matrix, i) =>
          batch.setMatrixAt(
            i,
            new THREE.Matrix4().multiplyMatrices(matrix, m.matrixWorld),
          ),
        );
        this.decor.add(batch);
      });
    };
    const transforms = { tree: [], bush: [], reed: [], crate: [] },
      dummy = new THREE.Object3D();
    for (let i = 0; i < 120; i++) {
      const x = (rand() - 0.5) * 94,
        z = (rand() - 0.5) * 94,
        type = terrain.at(x, z);
      if (
        type !== "grass" ||
        Math.hypot(x + 25, z - 24) < 14 ||
        Math.hypot(x - 25, z + 24) < 14
      )
        continue;
      dummy.position.set(x, 0, z);
      dummy.rotation.y = rand() * 6.28;
      dummy.scale.setScalar(0.45 + rand() * 0.5);
      dummy.updateMatrix();
      transforms.bush.push(dummy.matrix.clone());
    }
    for (let i = 0; i < 60; i++) {
      const x = -46 + i * 1.55;
      if (CROSSINGS.some((c) => Math.abs(x - c.x) < 6)) continue;
      dummy.position.set(x, 0, (i % 2 ? 1 : -1) * (3.5 + rand()));
      dummy.scale.setScalar(0.6 + rand() * 0.5);
      dummy.updateMatrix();
      transforms.reed.push(dummy.matrix.clone());
    }
    for (let i = 0; i < 40; i++) {
      dummy.position.set(i % 2 ? 49 : -49, 0, -46 + Math.floor(i / 2) * 4.8);
      dummy.scale.setScalar(0.8 + rand() * 0.5);
      dummy.updateMatrix();
      transforms.tree.push(dummy.matrix.clone());
    }
    for (const [x, z] of [
      [-30, 29],
      [-31, 30],
      [30, -29],
      [31, -30],
    ]) {
      dummy.position.set(x, 0, z);
      dummy.scale.setScalar(0.75);
      dummy.updateMatrix();
      transforms.crate.push(dummy.matrix.clone());
    }
    for (const [name, list] of Object.entries(transforms))
      instances(name, list);
    // One bounded particle pool for dust, spray and damaged-structure smoke.
    this.positions = new Float32Array(64 * 3);
    this.positions.fill(10000);
    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.particleMesh = new THREE.Points(
      this.particleGeometry,
      new THREE.PointsMaterial({
        color: 0xc8c8aa,
        size: 0.19,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.particleMesh.frustumCulled = false;
    this.root.add(this.particleMesh);
    this.cursor = 0;
    this.emission = 0;
  }
  configure(settings) {
    this.settings = settings;
    this.decor.visible = settings.detail;
    this.motion =
      settings.waterMotion &&
      !matchMedia("(prefers-reduced-motion:reduce)").matches;
  }
  update(sim, dt) {
    if (!this.water) return;
    const active = sim.time !== this.lastTime;
    dt = Math.max(0, Math.min(0.25, sim.time - this.lastTime));
    this.lastTime = sim.time;
    if (this.motion && active) {
      const p = this.water.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.array[i * 3 + 2] =
          this.waterBase[i * 3 + 2] +
          Math.sin(
            this.waterBase[i * 3] * 1.5 +
              this.waterBase[i * 3 + 1] * 2 +
              sim.time * 1.6,
          ) *
            0.018;
      p.needsUpdate = true;
      this.normalTexture.offset.x = sim.time * 0.018;
      this.normalTexture.offset.y = sim.time * 0.007;
    }
    this.particleMesh.visible = this.motion && this.settings.detail;
    if (!active || !this.particleMesh.visible) return;
    this.emission += dt;
    if (this.emission > 0.18) {
      this.emission = 0;
      for (const e of sim.entities) {
        if (!sim.isVisible(e)) continue;
        const smoke = e.kind === "building" && e.hp < e.maxHp * 0.45;
        if (
          !smoke &&
          !(
            e.moving &&
            (e.id % 3 === 0 || this.terrain.at(e.x, e.z) === "ford")
          )
        )
          continue;
        this.particles[this.cursor] = {
          x: e.x,
          y: smoke ? 3 : 0.2,
          z: e.z,
          life: smoke ? 1.2 : 0.45,
          smoke,
        };
        this.cursor = (this.cursor + 1) % 64;
      }
    }
    for (let i = 0; i < 64; i++) {
      const p = this.particles[i];
      if (p && p.life > 0) {
        p.life -= dt;
        p.y += dt * (p.smoke ? 0.7 : 0.3);
        this.positions.set([p.x, p.y, p.z], i * 3);
      } else this.positions.set([10000, 10000, 10000], i * 3);
    }
    this.particleGeometry.attributes.position.needsUpdate = true;
  }
  reset() {
    this.particles = [];
    if (this.positions) {
      this.positions.fill(10000);
      this.particleGeometry.attributes.position.needsUpdate = true;
    }
    this.lastTime = 0;
  }
  dispose() {
    this.scene.remove(this.root);
    this.water?.geometry.dispose();
    this.normalTexture?.dispose();
    this.water?.material.dispose();
    this.particleGeometry?.dispose();
    this.particleMesh?.material.dispose();
    this.decor.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
  }
}
