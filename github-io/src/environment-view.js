import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CROSSINGS, SURFACES } from "./terrain.js";
import { ROCKS } from "./data.js";
import { themeFor } from './visual-style.js';
import { fogAware } from "./fog-aware.js";
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
  const colors={...SURFACES,...themeFor(terrain.id)};
  for (let y = 0; y < size; y += 4)
    for (let x = 0; x < size; x += 4) {
      const wx = (x / size) * terrain.size - terrain.half,
        wz = (y / size) * terrain.size - terrain.half;
      ctx.fillStyle = colors[terrain.at(wx, wz)];
      ctx.fillRect(x, y, 4, 4);
    }
}
export class EnvironmentView {
  constructor(scene, terrain, assets, fog = null) {
    this.scene = scene;
    this.fog = fog;
    this.reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");
    this.terrain = terrain;
    this.root = new THREE.Group();
    this.decor = new THREE.Group();
    this.root.add(this.decor);
    scene.add(this.root);
    this.water = null;
    this.particles = [];
    this.lastTime = 0;
    this.owned=[];
    // The bridge models by crossing x: Frontier Defence hides a blown one (app/defence-ui.js).
    this.bridges = new Map();
    // Everything drawn here lies inside the map; the area beyond the edge stays empty.
    // The old boulder obstacles are concrete walls now, drawn as entities (view.js).
    if (!terrain.river) return;
    // Clear, saturated water in the map's own colours: deep in mid-stream, pale over the
    // shallows and foam-white where it meets the banks. No metalness: without an environment
    // map it only greyed the colour.
    const theme = themeFor(terrain.id);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0,
      emissive: new THREE.Color(theme.water).multiplyScalar(0.16),
    });
    // A real channel bed is cut into the ground; water stays below the banks.
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(terrain.size, 6, terrain.size, 6),
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
    const deep = new THREE.Color(theme.water), shallow = new THREE.Color(theme.shallow), ford = new THREE.Color(theme.ford),
      foam = new THREE.Color(theme.foam), gravel = new THREE.Color(theme.dust), c = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const bank = Math.abs(positions.getY(i)), x = Math.abs(positions.getX(i));
      // The ford: a pale gravel bar under shallow water, edged across the river by white riffle
      // lines where the deep channel spills over it, so the crossing reads from any zoom.
      if (x <= 4) c.copy(ford).lerp(gravel, 0.82).lerp(foam, (positions.getX(i) + positions.getY(i)) % 2 ? 0.12 : 0.3).multiplyScalar(1.15);
      else if (x <= 5) c.copy(foam).multiplyScalar(1.3);
      else if (bank > 2.5) c.copy(shallow).lerp(foam, 0.6);
      else if (bank > 1.5) c.copy(shallow);
      else c.copy(deep).lerp(shallow, bank > 0.5 ? 0.3 : 0);
      c.toArray(colors, i * 3);
    }
    this.water.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
    waterMat.vertexColors = true;
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
    waterMat.normalScale.set(0.55, 0.55);
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
    for (const c of CROSSINGS.filter((c) => c.type === "bridge")) {
      const bridge = add("bridge", c.x, 0);
      if (bridge) this.bridges.set(c.x, bridge);
    }
    let seed = 773;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const c of CROSSINGS.filter((c) => c.type === "ford")) this.fordMarks(c, theme);
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
        // Thin reed blades cast no visible shadow; skip them in the shadow pass.
        batch.castShadow = name !== "reed";
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
    const transforms = { bush: [], reed: [], crate: [] },
      dummy = new THREE.Object3D();
    // Decoration stays well inside the playable edge; nothing is placed on or beyond it.
    for (let i = 0; i < 120; i++) {
      const x = (rand() - 0.5) * 88,
        z = (rand() - 0.5) * 88,
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
      const x = -44 + i * 1.48;
      if (CROSSINGS.some((c) => Math.abs(x - c.x) < 6)) continue;
      dummy.position.set(x, 0, (i % 2 ? 1 : -1) * (3.5 + rand()));
      dummy.scale.setScalar(0.6 + rand() * 0.5);
      dummy.updateMatrix();
      transforms.reed.push(dummy.matrix.clone());
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
    // One bounded pool for movement dust and ford spray. Combat effects live in fx.js.
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
        color: theme.dust,
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
  // The ford's marks, one merged vertex-coloured mesh (one draw, no shadow pass): a line of
  // banded marker posts down each edge of the crossing, a cairn at each corner on the banks and
  // flat cobbles just breaking the surface between them. Always shown, like the bridges.
  fordMarks(c, theme) {
    const parts = [], color = new THREE.Color(), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let seed = 991;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const piece = (geometry, hex, x, y, z, sx, sy, sz, turn = 0) => {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      if (g !== geometry) geometry.dispose();
      g.deleteAttribute("uv");
      g.applyMatrix4(matrix.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, turn, 0)), new THREE.Vector3(sx, sy, sz)));
      color.set(hex);
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(g);
    };
    const wood = theme.wood, band = "#ffe9a8", stone = new THREE.Color(theme.rock).lerp(new THREE.Color(theme.dust), 0.35).getHexString();
    for (const side of [-1, 1]) {
      const x = c.x + side * (c.half - 0.4);
      for (const z of [-2.2, 0, 2.2]) {
        piece(new THREE.CylinderGeometry(0.15, 0.17, 1.1, 6), wood, x, 0.45, z, 1, 1, 1);
        piece(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 6), band, x, 0.95, z, 1, 1, 1);
        piece(new THREE.ConeGeometry(0.19, 0.18, 6), band, x, 1.2, z, 1, 1, 1);
      }
      for (const bankSide of [-1, 1]) {
        const cx = c.x + side * (c.half + 0.3), cz = bankSide * 4.3;
        piece(new THREE.DodecahedronGeometry(0.5), `#${stone}`, cx, 0.2, cz, 1.1, 0.55, 1, rand() * 6);
        piece(new THREE.DodecahedronGeometry(0.36), `#${stone}`, cx + 0.05, 0.62, cz, 1, 0.6, 1, rand() * 6);
        piece(new THREE.DodecahedronGeometry(0.22), band, cx, 0.9, cz, 1, 0.8, 1, rand() * 6);
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = c.x + (rand() - 0.5) * (c.half * 2 - 2.2), z = (rand() - 0.5) * 5.2, s = 0.22 + rand() * 0.2;
      piece(new THREE.DodecahedronGeometry(1), `#${stone}`, x, 0.06, z, s * 1.3, s * 0.4, s, rand() * 6);
    }
    const geometry = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    // Posts and stones stand above the fog-of-war plane: they sink into the fog colour like scenery.
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    if (this.fog) fogAware(material, this.fog);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "ford-marks";
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.owned.push(geometry, material);
  }
  // Rock obstacles block movement, so they stay visible regardless of the decoration setting.
  // Each obstacle gets one Blender boulder (its satellite stones already break the outline).
  rocks(assets) {
    const variants=['a','b','c'].map(k=>assets.getObjectByName(`asset_rock_${k}`)?.children.find(m=>m.isMesh)).filter(Boolean);
    if(!variants.length)return;
    const material=variants[0].material.clone();
    material.color.set(themeFor(this.terrain.id).rock);
    material.envMapIntensity=.35;
    this.owned.push(material);
    // Scale by each variant's measured footprint so the drawn rock stays inside the collision
    // circle units path around (radius r).
    const reach=variants.map(({geometry})=>{
      const p=geometry.attributes.position;let max=0;
      for(let i=0;i<p.count;i++)max=Math.max(max,Math.hypot(p.getX(i),p.getZ(i)));
      return max||1;
    });
    const transforms=variants.map(()=>[]),dummy=new THREE.Object3D();
    ROCKS.forEach(([x,z,r],i)=>{
      const v=i%variants.length,scale=r*.98/reach[v];
      dummy.position.set(x,0,z);dummy.rotation.set(0,i*2.1,0);dummy.scale.set(scale,scale*(.9+(i%3)*.12),scale);
      dummy.updateMatrix();transforms[v].push(dummy.matrix.clone());
    });
    variants.forEach((source,k)=>{
      const batch=new THREE.InstancedMesh(source.geometry,material,transforms[k].length);
      transforms[k].forEach((matrix,i)=>batch.setMatrixAt(i,matrix));
      batch.castShadow=batch.receiveShadow=true;
      this.root.add(batch);
    });
  }
  configure(settings) {
    this.settings = settings;
    this.decor.visible = settings.detail;

  }
  // `still` is set by the frame-time governor when the device struggles.
  get motion() {
    return this.settings?.waterMotion === true && !this.reducedMotion.matches && !this.still;
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
        if (e.hp<=0 || !e.moving || !(e.id%3===0 || this.terrain.at(e.x,e.z)==="ford")) continue;
        this.particles[this.cursor] = {
          x: e.x,
          y: 0.2,
          z: e.z,
          life: 0.45,
        };
        this.cursor = (this.cursor + 1) % 64;
      }
    }
    for (let i = 0; i < 64; i++) {
      const p = this.particles[i];
      if (p && p.life > 0) {
        p.life -= dt;
        p.y += dt * 0.3;
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
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    for(const resource of this.owned)resource.dispose();
  }
}
