import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Terrain } from "./terrain.js";
import { ActivityView } from "./activity-view.js";
import {themeFor,shotVisible,weaponStyle} from './visual-style.js';
import { isHarvesting } from "./activity.js";
import { defaults, palette } from "./settings.js";
import {
  EnvironmentView,
  paintTerrain,
  optimizeEnvironment,
} from "./environment-view.js";
import {
  DEFINITIONS as D,
  MAP_SIZE,
  HALF,
  GRID,
  ROCKS,
  clamp,
} from "./data.js";

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
// Meshes named like this in the Blender models aim (towers) and recoil together. Blender
// duplicate suffixes arrive sanitised by GLTFLoader ("Barrel.001" -> "Barrel001").
export const RIG_PART = /^(Main_cannon|Muzzle_brake|Barrel|Cannon|Muzzle|Turret_head)(?![a-z])/i;
const SUN_OFFSET = new THREE.Vector3(-25, 55, 20);
// Shadow camera basis, as Matrix4.lookAt builds it (looking from SUN_OFFSET, up +Y).
const LIGHT_Z = SUN_OFFSET.clone().normalize();
const LIGHT_X = new THREE.Vector3(0, 1, 0).cross(LIGHT_Z).normalize();
const LIGHT_Y = LIGHT_Z.clone().cross(LIGHT_X);
let seed = 1482;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class WorldView {
  constructor(
    container,
    { terrain = new Terrain(), settings = defaults() } = {},
  ) {
    this.container = container;
    this.terrain = terrain;
    this.settings = settings;
    this.colors = palette(settings).map((c) => new THREE.Color(c).getHex());
    this.lowPower = settings.quality === "eco";
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6),
    );
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D battlefield. Left-click selects; right-click commands.",
    );
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x283630);
    this.scene.fog = new THREE.Fog(0x283630, 105, 190);
    this.camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240);
    this.focus = new THREE.Vector3(
      this.lowPower ? -25 : -20,
      0,
      this.lowPower ? 21 : 19,
    );
    this.defaultZoom = this.lowPower ? 34 : 42;
    this.zoom = this.defaultZoom;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.models = new Map();
    this.objects = new Map();
    this.resourceObjects = new Map();
    this.effects = [];
    this.activity = new ActivityView(this);
    this.teamTemplates = new Map();
    this.fogClock = 0;
    this.gridVisible = false;
    this.previous = new Map();
    // Image-based lighting gives the Blender PBR materials (bare steel, painted armour,
    // crystals) real reflections. It is assigned per material (applyReflections()), not as
    // scene.environment: three.js would then override every material's envMapIntensity and
    // wash out the terrain, which is tuned for the sun and hemisphere light alone.
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environmentMap = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.ambientLight=new THREE.HemisphereLight(0xc1ddd7, 0x736145, 2.0);
    this.scene.add(this.ambientLight);
    const sun = new THREE.DirectionalLight(0xffe1b0, 3.2);
    this.sun=sun;
    // The shadow frustum follows the camera focus and is sized to the view (updateCamera):
    // a fixed frustum around the origin left whole bases unshadowed on the 160 and 192 maps.
    sun.position.copy(SUN_OFFSET);
    this.scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near: 0.5, far: 220 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.applyTheme();
    this.createTerrain();
    this.createFog();
    this.preview = mesh(
      new THREE.CylinderGeometry(1, 1, 0.09, 48),
      new THREE.MeshBasicMaterial({
        color: this.colors[0],
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.selection = new Set();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");
    this.reducedMotion.addEventListener("change", () =>
      this.environment?.configure(this.settings),
    );
  }
  applyTheme() {
    const style=themeFor(this.terrain.id);
    this.scene.background.set(style.sky);this.scene.fog.color.set(style.sky);
    this.ambientLight.color.set(style.ambient);this.sun.color.set(style.sun);
  }
  applySettings(settings) {
    this.settings = settings;
    this.colors = palette(settings).map((c) => new THREE.Color(c).getHex());
    for (const [key, template] of this.teamTemplates) {
      const team = Number(key.split("-").at(-1));
      template.traverse((o) => {
        if (!o.isMesh || !o.material.name.startsWith("Team")) return;
        o.material.color.setHex(this.colors[team]);
        if (o.material.name.startsWith("TeamGlow"))
          o.material.emissive.setHex(this.colors[team]);
      });
    }
    for (const o of this.objects.values()) {
      o.userData.ring.material.color.setHex(this.colors[o.userData.team]);
      o.userData.fill.material.color.setHex(this.colors[o.userData.team]);
    }
    for (const e of this.effects)
      if (e.team !== undefined)
        e.mesh.material.color.setHex(this.colors[e.team]);
    this.terrainRoot?.traverse((o) => {
      if (o.userData.team !== undefined)
        o.material.color.setHex(this.colors[o.userData.team]);
    });
    if (this.lowPower !== (settings.quality === "eco"))
      this.setQuality(settings.quality === "eco" ? "low" : "high");
    this.environment?.configure(settings);
    if (this.grass) this.grass.visible = settings.detail;
  }
  setTerrain(terrain) {
    this.terrain = terrain;
    this.applyTheme();
    this.environment?.dispose();
    if (this.terrainRoot) {
      this.scene.remove(this.terrainRoot);
      const geometries = new Set(),
        materials = new Set();
      this.terrainRoot.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) materials.add(o.material);
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) {
        m.map?.dispose();
        m.dispose();
      }
    }
    this.createTerrain();
    this.createFog();
    if (this.environmentAssets) {
      this.environment = new EnvironmentView(
        this.scene,
        terrain,
        this.environmentAssets,
      );
      this.environment.configure(this.settings);
    }
  }
  setQuality(level) {
    this.lowPower = level === "low";
    this.applyReflections();
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6),
    );
    this.renderer.shadowMap.enabled = !this.lowPower;
    for (const o of this.objects.values())
      o.userData.contactShadow.visible = this.lowPower;
    this.scene.traverse((o) => {
      if (o.isMesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => (m.needsUpdate = true));
      }
    });
    this.resize();
  }
  async loadModels() {
    const loader = new GLTFLoader();
    await Promise.all(
      Object.keys(D)
        .filter((k) => k !== "upgrade")
        .map(async (type) => {
          const gltf = await loader.loadAsync(
            `${import.meta.env.BASE_URL}models/${type}.glb`,
          );
          gltf.scene.updateMatrixWorld(true);
          // Merge stationary pieces by material, preserving the two articulated leg pivots.
          const template = new THREE.Group(),
            buckets = new Map(),
            barrelBuckets = new Map(),
            legs = [];
          gltf.scene.traverse((o) => {
            if (o.name.startsWith("leg_")) {
              const leg = o.clone(true);
              o.matrixWorld.decompose(leg.position, leg.quaternion, leg.scale);
              template.add(leg);
              legs.push(leg);
            }
            if (!o.isMesh) return;
            let parent = o.parent;
            while (parent) {
              if (parent.name.startsWith("leg_")) return;
              parent = parent.parent;
            }
            // Keep the existing named Blender cannon pieces articulated while
            // still merging the barrel's materials into a compact rig.
            const target=RIG_PART.test(o.name)?barrelBuckets:buckets;
            const key = o.material.name;
            if (!target.has(key))
              target.set(key, { material: o.material, geometries: [] });
            target
              .get(key)
              .geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
          });
          for (const { material, geometries } of buckets.values()) {
            const combined = mergeGeometries(geometries, false);
            if (combined) template.add(new THREE.Mesh(combined, material));
            geometries.forEach((g) => g.dispose());
          }
          const barrel=new THREE.Group();barrel.name='BarrelRig';
          for(const {material,geometries} of barrelBuckets.values()){
            const combined=mergeGeometries(geometries,false);
            if(combined)barrel.add(new THREE.Mesh(combined,material));
            geometries.forEach(g=>g.dispose());
          }
          template.add(barrel);
          for (let team = 0; team < this.colors.length; team++) {
            const variant = template.clone(true),
              materials = new Map();
            variant.traverse((o) => {
              if (!o.isMesh) return;
              const name = o.material.name;
              if (!materials.has(name)) {
                const m = o.material.clone();
                if (name.startsWith("Team")) {
                  m.color.setHex(this.colors[team]);
                  if (name.startsWith("TeamGlow")) {
                    m.emissive.setHex(this.colors[team]);
                    m.emissiveIntensity = 0.8;
                  }
                }
                materials.set(name, m);
              }
              o.material = materials.get(name);
              o.castShadow = true;
              o.receiveShadow = true;
            });
            this.teamTemplates.set(`${type}-${team}`, variant);
          }
          this.models.set(type, true);
        }),
    );
    this.environmentAssets = (
      await loader.loadAsync(
        `${import.meta.env.BASE_URL}models/environment.glb`,
      )
    ).scene;
    optimizeEnvironment(this.environmentAssets);
    // Blender boulders (EnvironmentView) replace the placeholder rocks drawn before loading.
    if (this.environmentAssets.getObjectByName("asset_rock_a")) this.removePlaceholderRocks();
    this.environment = new EnvironmentView(
      this.scene,
      this.terrain,
      this.environmentAssets,
    );
    this.environment.configure(this.settings);
    this.applyReflections();
  }
  createTerrain() {
    seed = 1482;
    this.terrainRoot = new THREE.Group();
    this.scene.add(this.terrainRoot);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = themeFor(this.terrain.id).dirt;
    ctx.fillRect(0, 0, 1024, 1024);
    if (this.terrain.id !== "classic") {
      paintTerrain(ctx, this.terrain, 1024);
      // Surfaces are sampled in 4-pixel blocks; blur them into natural transitions instead
      // of staircase borders. Browsers without canvas filters keep the blocks.
      const soft = document.createElement("canvas");
      soft.width = soft.height = 1024;
      const softContext = soft.getContext("2d");
      softContext.drawImage(canvas, 0, 0);
      ctx.filter = "blur(4px)";
      ctx.drawImage(soft, 0, 0);
      ctx.filter = "none";
    }
    for (let i = 0; i < 16000; i++) {
      const x = random() * 1024,
        y = random() * 1024,
        r = 1 + random() * 10;
      ctx.fillStyle =
        random() > 0.5
          ? `rgba(209,188,128,${random() * 0.09})`
          : `rgba(31,58,40,${random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (const points of [
      [
        [230, 780],
        [370, 610],
        [680, 420],
        [800, 210],
      ],
      [
        [230, 780],
        [130, 480],
        [220, 220],
        [800, 210],
      ],
      [
        [230, 780],
        [790, 800],
        [910, 490],
        [800, 210],
      ],
    ]) {
      for (let w = 90; w > 0; w -= 7) {
        ctx.strokeStyle = "rgba(185,159,105,0.025)";
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        ctx.bezierCurveTo(...points[1], ...points[2], ...points[3]);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const groundGeometry = new THREE.PlaneGeometry(this.terrain.size, this.terrain.size, 96, 96);
    if (this.terrain.river) {
      const p = groundGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = -p.getY(i);
        if (Math.abs(z) < 4 && Math.abs(x) > 5)
          p.setZ(i, -0.5 * Math.min(1, 4 - Math.abs(z)));
      }
      groundGeometry.computeVertexNormals();
    }
    const ground = mesh(groundGeometry, mat(0xffffff, { map: texture }));
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    this.terrainRoot.add(ground);
    this.terrainRoot.add(
      mesh(
        new THREE.BoxGeometry(this.terrain.size, 2.5, this.terrain.size),
        mat(0x424634),
        0,
        this.terrain.river ? -1.85 : -1.3,
        0,
      ),
    );
    // One grid line per two-unit navigation cell on every map size.
    this.grid = new THREE.GridHelper(this.terrain.size, this.terrain.grid, 0xd8d8b4, 0xa6b087);
    this.grid.position.y = 0.035;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.15;
    this.grid.visible = false;
    this.terrainRoot.add(this.grid);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(this.terrain.size, 0.1, this.terrain.size)),
      new THREE.LineBasicMaterial({
        color: 0xb7b38a,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.terrainRoot.add(edge);
    const rockMat = mat(0x626957);
    this.pebbleMaterial = rockMat;
    // Placeholder obstacles until the Blender boulders load (EnvironmentView draws those).
    // The random sequence is consumed either way, so the scatter below is identical on
    // every build of a map regardless of when the models finished loading.
    const placeholders = !this.environmentAssets?.getObjectByName("asset_rock_a"),
      topMat = placeholders ? mat(0x888872) : null;
    this.placeholderRocks = new THREE.Group();
    this.terrainRoot.add(this.placeholderRocks);
    for (const [x, z, r] of ROCKS) {
      for (let i = 0; i < 4; i++) {
        const position = [x + (random() - 0.5) * r, 0.6 + random() * r * 0.3, z + (random() - 0.5) * r],
          scale = [r * (0.6 + random() * 0.4), r * (0.45 + random() * 0.55), r * (0.6 + random() * 0.4)],
          rotation = [random() * 0.7, random() * 6, random() * 0.4];
        if (!placeholders) continue;
        const stone = mesh(new THREE.DodecahedronGeometry(1, 0), i === 0 ? topMat : rockMat, ...position);
        stone.scale.set(...scale);
        stone.rotation.set(...rotation);
        this.placeholderRocks.add(stone);
      }
    }
    const inRock = (p) => ROCKS.some(([x, z, r]) => Math.hypot(p.x - x, p.z - z) < r + 0.3);
    // Scatter scales with map area so large maps are not bare beyond the central 96 units.
    const spread = this.terrain.size - 1,
      density = (this.terrain.size / 96) ** 2;
    const pebbleCount = Math.round(500 * density);
    const pebbles = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      rockMat,
      pebbleCount,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < pebbleCount; i++) {
      dummy.position.set((random() - 0.5) * spread, 0.08, (random() - 0.5) * spread);
      dummy.scale.setScalar(0.5 + random());
      if ((this.terrain.river && Math.abs(dummy.position.z) < 5) || inRock(dummy.position))
        dummy.scale.setScalar(0);
      dummy.rotation.set(random(), random() * 6, random());
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
    }
    this.terrainRoot.add(pebbles);
    const grassCount = Math.round(850 * density);
    const grass = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.22, 0.6, 3),
      mat(0x515f40),
      grassCount,
    );
    for (let i = 0; i < grassCount; i++) {
      dummy.position.set((random() - 0.5) * spread, 0.22, (random() - 0.5) * spread);
      dummy.scale.setScalar(0.4 + random() * 0.7);
      if (
        (this.terrain.river &&
          this.terrain.at(dummy.position.x, dummy.position.z) !== "grass") ||
        inRock(dummy.position)
      )
        dummy.scale.setScalar(0);
      dummy.rotation.set(0, random() * 6, 0.15);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.terrainRoot.add(grass);
    this.grass = grass;
    grass.visible = this.settings.detail;
    // Subtle starting-base landing pad under each Command core spawn (maps offset bases outward).
    const offset = this.terrain.offset || 0;
    for (const side of [1, -1]) {
      const px = (-25 - offset) * side,
        pz = (24 + offset) * side;
      const pad = mesh(
        new THREE.CylinderGeometry(6.2, 6.2, 0.04, 8),
        mat(0x6a7262),
        px,
        0.025,
        pz,
      );
      pad.rotation.y = Math.PI / 8;
      pad.castShadow = false;
      this.terrainRoot.add(pad);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(6.3, 6.38, 64),
        new THREE.MeshBasicMaterial({
          color: 0xdad4af,
          transparent: true,
          opacity: 0.35,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(px, 0.052, pz);
      this.terrainRoot.add(ring);
    }
  }
  // Reflections pay off on metal, glass and crystals. Matte paint, fabric and scenery gain
  // little, and the per-pixel environment lookup is the most expensive part of the model
  // shaders on weak GPUs and software renderers, so Eco quality skips it entirely.
  applyReflections() {
    const map = this.lowPower ? null : this.environmentMap;
    const apply = (o) => {
      const m = o.material;
      if (!o.isMesh || !m.isMeshStandardMaterial || !(m.metalness >= 0.5 || m.roughness <= 0.25)) return;
      if (m.envMap === map) return;
      m.envMap = map;
      m.envMapIntensity = 0.6;
      m.needsUpdate = true;
    };
    for (const template of this.teamTemplates.values()) template.traverse(apply);
    this.environmentAssets?.traverse(apply);
  }
  removePlaceholderRocks() {
    if (!this.placeholderRocks) return;
    this.placeholderRocks.removeFromParent();
    const materials = new Set();
    this.placeholderRocks.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      materials.add(o.material);
    });
    // The darker rock material is shared with the pebbles, which stay.
    for (const m of materials) if (m !== this.pebbleMaterial) m.dispose();
    this.placeholderRocks = null;
  }
  createFog() {
    if (this.fogMesh) { this.scene.remove(this.fogMesh); this.fogMesh.geometry.dispose(); this.fogMesh.material.dispose(); this.fogTexture.dispose(); }
    this.fogClock = 0;
    this.fogCanvas = document.createElement("canvas");
    this.fogCanvas.width = this.fogCanvas.height = this.terrain.grid;
    this.fogContext = this.fogCanvas.getContext("2d");
    this.fogImage = this.fogContext.createImageData(this.terrain.grid, this.terrain.grid);
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTexture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: this.fogTexture,
      transparent: true,
      depthWrite: false,
    });
    this.fogMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.terrain.size, this.terrain.size),
      material,
    );
    this.fogMesh.rotation.x = -Math.PI / 2;
    this.fogMesh.position.y = 0.15;
    this.fogMesh.renderOrder = 2;
    this.scene.add(this.fogMesh);
  }
  resize() {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.updateCamera();
  }
  updateCamera() {
    const aspect = this.width / this.height;
    this.camera.left = (-this.zoom * aspect) / 2;
    this.camera.right = (this.zoom * aspect) / 2;
    this.camera.top = this.zoom / 2;
    this.camera.bottom = -this.zoom / 2;
    this.camera.position.copy(this.focus).add(new THREE.Vector3(22, 56, 38));
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // Shadow frustum: cover the farthest visible ground corner (the tilted view reaches about
    // 0.64 x zoom deep), then snap its centre to whole shadow texels in light space so
    // shadow edges do not shimmer while the camera pans.
    const half = Math.min(130, this.zoom * Math.hypot(aspect / 2, 0.64) + 6),
      shadow = this.sun.shadow.camera;
    if (shadow.right !== half) {
      Object.assign(shadow, { left: -half, right: half, top: half, bottom: -half });
      shadow.updateProjectionMatrix();
    }
    const texel = (2 * half) / this.sun.shadow.mapSize.x,
      snap = (axis) => Math.round(this.focus.dot(axis) / texel) * texel;
    const center = LIGHT_X.clone()
      .multiplyScalar(snap(LIGHT_X))
      .addScaledVector(LIGHT_Y, snap(LIGHT_Y))
      .addScaledVector(LIGHT_Z, this.focus.dot(LIGHT_Z));
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    this.sun.position.copy(center).add(SUN_OFFSET);
  }
  pan(dx, dz) {
    this.focus.x = clamp(this.focus.x + dx, -this.terrain.half+6, this.terrain.half-6);
    this.focus.z = clamp(this.focus.z + dz, -this.terrain.half+6, this.terrain.half-6);
    this.updateCamera();
  }
  screenPan(dx, dy) {
    const right = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      0,
    );
    const up = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      1,
    );
    up.y = 0;
    up.normalize();
    this.pan(right.x * dx + up.x * dy, right.z * dx + up.z * dy);
  }
  zoomBy(delta) {
    this.zoom = clamp(this.zoom + delta, 22, 88);
    this.updateCamera();
  }
  focusOn(x, z) {
    this.focus.set(clamp(x, -this.terrain.half+6, this.terrain.half-6), 0, clamp(z, -this.terrain.half+6, this.terrain.half-6));
    this.updateCamera();
  }
  point(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, p)
      ? { x: clamp(p.x, -this.terrain.half+1, this.terrain.half-1), z: clamp(p.z, -this.terrain.half+1, this.terrain.half-1) }
      : null;
  }
  project(x, z, y = 0) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.width,
      y: ((1 - p.y) / 2) * this.height,
    };
  }
  pick(clientX, clientY, sim, minRadius = 14) {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      x = clientX - rect.left,
      y = clientY - rect.top;
    this.raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-y/rect.height*2+1),this.camera);
    const candidates = sim.entities.filter(e => e.hp > 0 && sim.isVisible(e) && this.objects.has(e.id));
    const meshes = candidates.map(e => this.objects.get(e.id).userData.model);
    const hits = this.raycaster.intersectObjects(meshes,true);
    if (hits.length) {
      let node = hits[0].object;
      while (node && !meshes.includes(node)) node = node.parent;
      if (node) return candidates[meshes.indexOf(node)];
    }
    let best = null,
      score = Infinity;
    for (const e of [...sim.entities, ...sim.resources]) {
      // Explored deposits stay drawn under fog, so they must stay targetable for gathering.
      const shown = e.kind === "resource" ? this.resourceObjects.get(e.id)?.visible : sim.isVisible(e);
      if (!shown || e.amount === 0 || e.hp <= 0) continue;
      const p = this.project(
        e.x,
        e.z,
        e.kind === "building" ? 1.8 : e.kind === "resource" ? 1 : 0.9,
      );
      const d = Math.hypot(p.x - x, p.y - y),
        radius = Math.max(
          minRadius,
          ((e.radius + 0.6) * this.height) / this.zoom,
        );
      if (d < radius && d / radius < score) {
        best = e;
        score = d / radius;
      }
    }
    return best;
  }
  createEntity(e) {
    const root = new THREE.Group(),
      model = this.teamTemplates.get(`${e.type}-${e.team}`).clone(true);
    root.add(model);
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(e.radius * 1.25, 20),
      new THREE.MeshBasicMaterial({
        color: 0x13251b,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.07;
    contactShadow.visible = this.lowPower;
    root.add(contactShadow);
    root.userData.contactShadow = contactShadow;
    root.userData.model = model;
    root.userData.barrel=model.getObjectByName('BarrelRig');
    root.userData.recoil=0;
    root.userData.team = e.team;
    root.userData.legs = [];
    model.traverse((o) => {
      if (o.name.startsWith("leg_"))
        root.userData.legs.push({ node: o, base: o.quaternion.clone() });
    });
    const ringGeometry=new THREE.RingGeometry(e.radius+.26,e.radius+.46,40,4);
    const ringColors=new Float32Array(ringGeometry.attributes.position.count*3);
    for(let i=0;i<ringGeometry.attributes.position.count;i++){
      const band=Math.floor(i/41),shade=band===0||band===4?.12:1;
      ringColors.set([shade,shade,shade],i*3);
    }
    ringGeometry.setAttribute('color',new THREE.BufferAttribute(ringColors,3));
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: this.colors[e.team],
        vertexColors:true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.19;
    ring.visible = false;
    ring.renderOrder = 3;
    root.add(ring);
    root.userData.ring = ring;
    const bar = new THREE.Group(),
      back = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x111a1a, depthTest: false }),
      );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.09),
      new THREE.MeshBasicMaterial({
        color: this.colors[e.team],
        depthTest: false,
      }),
    );
    fill.position.z = 0.01;
    bar.add(back, fill);
    bar.position.y = e.kind === "building" ? 5.2 : 2.9;
    bar.visible = false;
    bar.renderOrder = 10;
    root.add(bar);
    root.userData.bar = bar;
    root.userData.fill = fill;
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(2,0.07),new THREE.MeshBasicMaterial({color:0x69cbee,depthTest:false}));
    shield.position.set(0,0.15,0.02); bar.add(shield); root.userData.shield = shield;
    if (e.kind === 'building') {
      const levels = new THREE.Group();
      for (let i=0;i<3;i++) { const pip = new THREE.Mesh(new THREE.PlaneGeometry(0.18,0.12),new THREE.MeshBasicMaterial({color:0xedc76f,depthTest:false})); pip.position.set(-0.24+i*0.24,0.38,0); levels.add(pip); }
      root.add(levels); levels.position.y = 5.2; root.userData.levels = levels;
    }
    this.scene.add(root);
    this.objects.set(e.id, root);
    return root;
  }
  createResource(e) {
    const template = this.environmentAssets?.getObjectByName(`asset_crystal_${e.type}`);
    if (template) {
      // Shared Blender crystal cluster; each deposit gets its own stable heading.
      const cluster = template.clone(true);
      cluster.userData.shared = true;
      cluster.rotation.y = (e.id * 2.39996) % (Math.PI * 2);
      cluster.position.set(e.x, 0, e.z);
      cluster.traverse((m) => {
        if (m.isMesh) m.castShadow = m.receiveShadow = true;
      });
      this.scene.add(cluster);
      this.resourceObjects.set(e.id, cluster);
      return cluster;
    }
    const group = new THREE.Group(),
      color = e.type === "alloy" ? 0xd59d43 : 0x65c9e2;
    const material = mat(color, {
      metalness: 0.2,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    for (let i = 0; i < 7; i++) {
      const crystal = mesh(
        new THREE.CylinderGeometry(
          0,
          0.45 + random() * 0.35,
          1.3 + random() * 1.8,
          5,
        ),
        material,
        (random() - 0.5) * 2.5,
        0.8,
        (random() - 0.5) * 2.5,
      );
      crystal.rotation.set(
        (random() - 0.5) * 0.6,
        random() * 6,
        (random() - 0.5) * 0.6,
      );
      group.add(crystal);
    }
    group.position.set(e.x, 0, e.z);
    this.scene.add(group);
    this.resourceObjects.set(e.id, group);
    return group;
  }
  marker(x, z, color = this.colors[0]) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.23, z);
    m.renderOrder = 4;
    this.scene.add(m);
    this.effects.push({ mesh: m, life: 0.8, max: 0.8, marker: true, team: color===this.colors[0]?0:undefined });
    while(this.effects.length>64){
      const old=this.effects.shift();this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();old.mesh.material.dispose();
    }
  }
  event(event, sim) {
    this.activity.event(event, sim);
    if(event.type==='shot' && shotVisible(event,sim)){
      const o=this.objects.get(event.source);
      if(o && weaponStyle(event).kind==='cannon')o.userData.recoil=.22;
    }
  }
  // Record the state before each fixed simulation step so frames between steps can
  // interpolate: the simulation runs at 20 Hz, displays at 60-240 Hz.
  beforeTick(sim) {
    this.previousTime = sim.time;
    for (const e of sim.entities) {
      if (e.kind !== "unit") continue;
      const p = this.previous.get(e.id);
      if (p) {
        p.x = e.x;
        p.z = e.z;
        p.angle = e.angle;
      } else this.previous.set(e.id, { x: e.x, z: e.z, angle: e.angle });
    }
  }
  update(sim, dt, selected, hover, alpha = 1) {
    this.environment?.update(sim, dt);
    const alive = new Set();
    // Interpolate only from a snapshot taken exactly one tick before the current state;
    // ticks run outside the frame loop (test stepping) leave the snapshot stale.
    const interpolate = alpha < 1 && Math.abs(sim.time - 0.05 - this.previousTime) < 1e-6;
    for (const e of sim.entities) {
      alive.add(e.id);
      const o = this.objects.get(e.id) || this.createEntity(e);
      o.userData.recoil=Math.max(0,o.userData.recoil-dt);
      o.visible = sim.isVisible(e);
      if (!o.visible) continue;
      let p = e.kind === "unit" && interpolate ? this.previous.get(e.id) : null;
      // No unit covers more than ~0.3 units per tick; a larger jump is a teleport.
      if (p && Math.hypot(e.x - p.x, e.z - p.z) > 1) p = null;
      const m = o.userData.model;
      if (p) {
        o.position.set(p.x + (e.x - p.x) * alpha, 0, p.z + (e.z - p.z) * alpha);
        const turn = Math.atan2(Math.sin(e.angle - p.angle), Math.cos(e.angle - p.angle));
        m.rotation.y = p.angle + turn * alpha;
      } else {
        o.position.set(e.x, 0, e.z);
        m.rotation.y = e.kind === "unit" ? e.angle : e.team === 0 ? 0 : Math.PI;
      }
      if(o.userData.barrel){
        const rig=o.userData.barrel;
        rig.rotation.y=e.type==='tower'?e.angle-m.rotation.y:0;
        const kick=this.activity.combat.motion?Math.sin(o.userData.recoil/.22*Math.PI)*.18:0;
        rig.position.set(-Math.sin(rig.rotation.y)*kick,0,-Math.cos(rig.rotation.y)*kick);
      }
      m.position.y =
        e.kind === "unit" && e.moving
          ? Math.sin(sim.time * 13 + e.id) * 0.045
          : 0;
      m.scale.y = e.complete ? 1 : 0.15 + e.progress * 0.85;
      m.rotation.z = isHarvesting(sim,e) && !this.reducedMotion.matches ? Math.sin(sim.time*7+e.id)*0.045 : 0;
      for (let i = 0; i < o.userData.legs.length; i++) {
        const leg = o.userData.legs[i];
        leg.node.quaternion.copy(leg.base);
        if (e.moving)
          leg.node.rotateX(Math.sin(sim.time * 11 + i * Math.PI) * 0.4);
      }
      o.userData.ring.visible = selected.has(e.id) || hover?.id === e.id;
      o.userData.bar.visible =
        selected.has(e.id) || hover?.id === e.id || e.hp < e.maxHp || e.shield < e.maxShield;
      o.userData.bar.quaternion.copy(this.camera.quaternion);
      o.userData.fill.scale.x = Math.max(0, e.hp / e.maxHp);
      o.userData.fill.position.x = -(1 - e.hp / e.maxHp);
      o.userData.shield.scale.x = e.shield/e.maxShield;
      o.userData.shield.position.x = -(1-e.shield/e.maxShield);
      if (o.userData.levels) {
        o.userData.levels.quaternion.copy(this.camera.quaternion);
        o.userData.levels.children.forEach((pip,i) => { pip.visible = i < e.level; });
      }
    }
    for (const [id, object] of this.objects)
      if (!alive.has(id)) {
        this.disposeEntity(object);
        this.objects.delete(id);
      }
    for (const id of this.previous.keys()) if (!alive.has(id)) this.previous.delete(id);
    for (const r of sim.resources) {
      const o = this.resourceObjects.get(r.id) || this.createResource(r);
      if (sim.isVisible(r)) o.userData.lastAmount = r.amount;
      const amount = o.userData.lastAmount || 0;
      o.visible = amount > 0 && sim.isExplored(r);
      o.scale.y = 0.4 + (0.6 * amount) / r.initial;
    }
    this.fogClock -= dt;
    if (this.fogClock <= 0) {
      this.fogClock = 0.25;
      for (let i = 0; i < this.terrain.grid * this.terrain.grid; i++) {
        const j = i * 4;
        this.fogImage.data[j] = 14;
        this.fogImage.data[j + 1] = 26;
        this.fogImage.data[j + 2] = 25;
        this.fogImage.data[j + 3] = sim.visible[0][i]
          ? 0
          : sim.explored[0][i]
            ? 145
            : 232;
      }
      this.fogContext.putImageData(this.fogImage, 0, 0);
      this.fogTexture.needsUpdate = true;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.material.opacity = Math.max(0, e.life / e.max);
      if (e.marker || e.explosion)
        e.mesh.scale.setScalar(1 + (1 - e.life / e.max) * 2);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.activity.draw(sim,dt,selected,hover);
  }
  disposeEntity(o) {
    this.scene.remove(o);
    // Model geometry and materials belong to shared templates; only dispose per-instance UI.
    for (const m of [
      o.userData.ring,
      o.userData.contactShadow,
      ...o.userData.bar.children,
      ...(o.userData.levels?.children || []),
    ]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
  reset() {
    this.activity.reset();
    this.environment?.reset();
    for (const o of this.objects.values()) this.disposeEntity(o);
    this.objects.clear();
    for (const o of this.resourceObjects.values()) {
      this.scene.remove(o);
      if (o.userData.shared) continue; // Blender clusters share the loaded template's data.
      o.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
      o.children[0]?.material.dispose();
    }
    this.resourceObjects.clear();
    this.previous.clear();
    for (const e of this.effects) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
    }
    this.effects = [];
    this.focusOn(
      this.defaultZoom === 34 ? -25 : -20,
      this.defaultZoom === 34 ? 21 : 19,
    );
    this.zoom = this.defaultZoom;
    this.updateCamera();
    this.fogClock = 0;
  }
}
