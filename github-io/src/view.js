import * as THREE from "three";
import { CORE_MODEL_TYPES } from "./model-roster.js";
import { CameraShake, FEEL } from "./camera-shake.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Terrain } from "./terrain.js";
import { ActivityView } from "./activity-view.js";
import { Effects } from "./fx.js";
import { createRing, updateRing, createBar, updateBar, setTeamColor, createMarker, createRally, updateRally } from "./selection-view.js";
import { CaptureRings } from "./capture-view.js";
import { TacticsView } from "./tactics-view.js";
import {themeFor,lightFor,shotVisible,weaponStyle} from './visual-style.js';
import { Scatter } from "./scatter.js";
import { createMapEdge } from "./map-edge.js";
import { paintGround } from "./ground-paint.js";
import { fogAware } from "./fog-aware.js";
import { teamColors, teamGlows, factionOf } from "./faction-colors.js";
import { createEmblem, hasEmblem, recolorEmblems } from "./emblems.js";
import { isHarvesting } from "./activity.js";
import { EntityBatches, adoptBatchedParts, SOURCE_LAYER } from "./entity-batches.js";
import { cacheTransforms } from "./transform-cache.js";
import { AmbientLife } from "./ambient-life.js";
import { defaults } from "./settings.js";
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

// Draw-call relief: within each rigid group of a model (body, each leg, turret, barrel), the plain
// painted parts become one mesh. Each vertex carries its part's colour, roughness and metalness, and
// one shared material reads them, so the picture is unchanged while a unit type needs about half
// the batches. Team paint (recoloured live), glows, glass, lamps, energy and textured or
// see-through parts stay separate.
const KEEP_FINISH = /^(Team|Glass|Lamp|Energy)/;
// Two shared materials: parts that take image-based reflections (applyReflections: metal or very
// glossy) and parts that do not. Their uniform roughness and metalness only steer that choice; the
// shader reads the per-vertex values.
const bakedShared = new Map();
const reflects = (m) => m.metalness >= 0.5 || m.roughness <= 0.25;
export function bakedMaterial(reflective) {
  if (bakedShared.has(reflective)) return bakedShared.get(reflective);
  const m = new THREE.MeshStandardMaterial({ name: reflective ? "BakedReflect" : "Baked", vertexColors: true, roughness: 1, metalness: reflective ? 1 : 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 finish;\nvarying vec2 vFinish;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFinish = finish;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFinish;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vFinish.x;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vFinish.y;");
  };
  m.customProgramCacheKey = () => "baked-finish";
  bakedShared.set(reflective, m);
  return m;
}
export function bakeFinishes(root) {
  const groups = new Map();
  root.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || Array.isArray(m) || !m.isMeshStandardMaterial || KEEP_FINISH.test(m.name) || m.map || m.transparent || m.emissive?.getHex()) return;
    const key = `${o.parent.uuid}|${reflects(m)}`;
    if (!groups.has(key)) groups.set(key, { parent: o.parent, reflective: reflects(m), meshes: [] });
    groups.get(key).meshes.push(o);
  });
  for (const { parent, reflective, meshes } of groups.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().compose(o.position, o.quaternion, o.scale));
      const m = o.material, source = m.vertexColors ? g.getAttribute("color") : null, n = g.getAttribute("position").count;
      const colors = new Float32Array(n * 3), finish = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = m.color.r * (source ? source.getX(i) : 1);
        colors[i * 3 + 1] = m.color.g * (source ? source.getY(i) : 1);
        colors[i * 3 + 2] = m.color.b * (source ? source.getZ(i) : 1);
        finish[i * 2] = m.roughness;
        finish[i * 2 + 1] = m.metalness;
      }
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      g.setAttribute("finish", new THREE.BufferAttribute(finish, 2));
      return g;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const o of meshes) parent.remove(o);
    const mesh = new THREE.Mesh(merged, bakedMaterial(reflective));
    mesh.name = "baked";
    parent.add(mesh);
  }
}

export class WorldView {
  constructor(
    container,
    { terrain = new Terrain(), settings = defaults(), mission = null } = {},
  ) {
    this.container = container;
    this.terrain = terrain;
    this.settings = settings;
    // A story mission paints each enemy team in its faction's colour (faction-colors.js).
    this.mission = mission;
    this.colors = teamColors(settings, mission).map((c) => new THREE.Color(c).getHex());
    this.glows = teamGlows(settings, mission).map((c) => new THREE.Color(c).getHex());
    this.lowPower = settings.quality === "eco";
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6));
    this.renderer.shadowMap.enabled = !this.lowPower;
    // three r185 replaced PCFSoftShadowMap with PCFShadowMap (it logs a deprecation and falls back).
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos neutral tone mapping keeps the palette's saturated colours as painted;
    // ACES pulled every map toward the same dusty grey.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D battlefield. Left-click selects; right-click commands.",
    );
    this.scene = new THREE.Scene();
    cacheTransforms(this.scene);
    this.scene.background = new THREE.Color(0x123f63);
    this.scene.fog = new THREE.Fog(0x123f63, 105, 190);
    // Shared by every material that sinks into the fog of war (fog-aware.js).
    this.fogUniforms = { uFogMap: { value: null }, uFogColor: { value: new THREE.Color() }, uFogHalf: { value: terrain.half } };
    this.fogRGB = [11, 34, 54];
    this.lifeClock = 0;
    this.pulsing = [];
    this.camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240);
    this.focus = new THREE.Vector3(
      this.lowPower ? -25 : -20,
      0,
      this.lowPower ? 21 : 19,
    );
    this.defaultZoom = this.lowPower ? 34 : 42;
    this.zoom = this.defaultZoom;
    this.raycaster = new THREE.Raycaster();
    // Picking hits the cloned model parts, which the batches draw (entity-batches.js).
    this.raycaster.layers.enable(SOURCE_LAYER);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.models = new Map();
    this.modelsReady = false;
    this.requiredModels = [...CORE_MODEL_TYPES];
    this.modelQueue = Promise.resolve();
    this.objects = new Map();
    this.resourceObjects = new Map();
    this.effects = [];
    this.activity = new ActivityView(this);
    this.fx = new Effects(this);
    this.tactics = new TacticsView(this);
    this.dying = [];
    this.shake = new CameraShake();
    this.hitStop = 0;
    this.cameraCue = false;
    this.shakePosition = new THREE.Vector3();
    this.shakeRotation = new THREE.Quaternion();
    this.teamTemplates = new Map();
    this.buildingTops = new Map();
    this.fogClock = 0;
    this.gridVisible = false;
    this.previous = new Map();
    // Image-based lighting gives the Blender PBR materials (bare steel, painted armour,
    // crystals) real reflections. It is assigned per material (applyReflections()), not as
    // scene.environment: three.js would then override every material's envMapIntensity and
    // wash out the terrain, which is tuned for the sun and hemisphere light alone.
    this.buildEnvironmentMap();
    // A restored GL context keeps textures and programs (three.js re-uploads them) but not the
    // PMREM render target's pixels, so the map is rendered again and reassigned.
    // While the context is gone nothing is drawn; main.js pauses the match and tells the player.
    this.renderer.domElement?.addEventListener?.('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.onContextLost?.();
    });
    this.renderer.domElement?.addEventListener?.('webglcontextrestored', () => {
      this.contextLost = false;
      this.restoreEnvironmentMap();
      this.onContextRestored?.();
    });
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
    this.createScatter();
    this.motionLevel = 2;
    this.renderScale = 1;
    this.createLife();
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
    this.batches = new EntityBatches(this.scene);
    this.contactShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x13251b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      // The blob lies at y=0.07, level with building base plates; biased, the plates always
      // win the tie instead of flickering through it (Eco/phone mode draws these blobs).
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    });
    this.contactShadowGeometries = new Map();
    this.resize();
    // The observer covers window resizes too; resize() itself ignores an unchanged size.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");
    this.reducedMotion.addEventListener("change", () =>
      this.environment?.configure(this.settings),
    );
  }
  // Each map has its own time of day: a warm key light, a cool sky fill, a warm bounce from
  // the ground, and a deep fog-of-war colour from the same family as its horizon.
  applyTheme() {
    const style=themeFor(this.terrain.id),light=lightFor(this.terrain.id);
    this.scene.background.set(style.sky);this.scene.fog.color.set(style.sky);
    this.ambientLight.color.set(style.ambient);this.ambientLight.groundColor.set(style.bounce);
    this.ambientLight.intensity=light.ambient;
    this.sun.color.set(style.sun);this.sun.intensity=light.sun;
    this.renderer.toneMappingExposure=light.exposure;
    this.fogUniforms.uFogColor.value.set(style.fog);
    this.fogUniforms.uFogHalf.value=this.terrain.half;
    this.fogRGB=[1,3,5].map(i=>parseInt(style.fog.slice(i,i+2),16));
    this.tintFog();
    if(this.wallParts){this.wallParts[0].material.color.set(style.wall);this.wallParts[1].material.color.set(style.glow);this.wallParts[1].material.emissive.set(style.glow);}
    this.applyAssetTheme();
  }
  // The fog image keeps one colour; each refresh then writes only how thick it is.
  tintFog() {
    this.fogClock=0;
    const data=this.fogImage?.data;
    if(!data)return;
    for(let j=0;j<data.length;j+=4){data[j]=this.fogRGB[0];data[j+1]=this.fogRGB[1];data[j+2]=this.fogRGB[2];}
  }
  // The shared Blender scenery takes the map's foliage colours.
  applyAssetTheme() {
    if(!this.environmentAssets)return;
    const style=themeFor(this.terrain.id);
    this.environmentAssets.traverse(o=>{
      const m=o.material;if(!o.isMesh||!m)return;
      if(m.name==='Foliage')m.color.set(style.leaf);
      else if(m.name==='FoliageLight')m.color.set(style.leafAlt);
      else if(m.name==='Bark')m.color.set(style.wood);
      else if(m.name==='Rock')m.color.set(style.rock);
    });
  }
  // A story mission (or none): enemy teams take their faction's colour and glow.
  setMission(mission) {
    if (mission === this.mission) return;
    this.mission = mission;
    this.applySettings(this.settings);
  }
  applySettings(settings) {
    this.settings = settings;
    this.colors = teamColors(settings, this.mission).map((c) => new THREE.Color(c).getHex());
    this.glows = teamGlows(settings, this.mission).map((c) => new THREE.Color(c).getHex());
    recolorEmblems(this.colors);
    for (const [key, template] of this.teamTemplates) {
      const team = Number(key.split("-").at(-1));
      template.traverse((o) => {
        if (!o.isMesh || !o.material.name.startsWith("Team")) return;
        o.material.color.setHex(this.colors[team]);
        if (o.material.name.startsWith("TeamGlow"))
          o.material.emissive.setHex(this.glows[team]);
      });
    }
    for (const o of this.objects.values()) if (o.userData.team >= 0) setTeamColor(o, this.colors[o.userData.team]);
    for (const e of this.effects)
      if (e.team !== undefined)
        e.mesh.material.uniforms.color.value.setHex(this.colors[e.team], THREE.LinearSRGBColorSpace);
    this.terrainRoot?.traverse((o) => {
      if (o.userData.team !== undefined)
        o.material.color.setHex(this.colors[o.userData.team]);
    });
    if (this.lowPower !== (settings.quality === "eco"))
      this.setQuality(settings.quality === "eco" ? "low" : "high");
    this.environment?.configure(settings);
    this.life?.configure(settings);
    this.showScatter();
  }
  // Dressing follows the "ground detail" setting and goes when the governor is rescuing frames.
  showScatter() {
    if (this.scatter) this.scatter.root.visible = this.settings.detail !== false && (this.lifeShare ?? 1) > 0;
  }
  createScatter() {
    this.scatter?.dispose();
    this.scatter = new Scatter(this.scene, this.terrain, { budget: this.lowPower ? 0.6 : 1, fog: this.fogUniforms });
    this.showScatter();
    for (const o of this.objects.values()) o.userData.pressed = false;
    for (const o of this.resourceObjects.values()) o.userData.pressed = false;
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
    this.createScatter();
    this.createLife();
    if (this.environmentAssets) {
      this.environment = new EnvironmentView(
        this.scene,
        terrain,
        this.environmentAssets,
      );
      this.environment.configure(this.settings);
      this.environment.still = this.motionLevel === 0;
    }
  }
  // Per-map birds, butterflies, fish and motes (ambient-life.js); fewer on Eco.
  createLife() {
    this.life?.dispose();
    this.life = new AmbientLife(this.scene, this.terrain, { fogTexture: this.fogTexture, budget: this.lowPower ? 0.6 : 1 });
    this.life.configure(this.settings);
    this.life.setLevel(this.motionLevel);
    this.life.setShare(this.lifeShare ?? 1);
  }
  setLifeShare(share) {
    this.lifeShare = share;
    this.life?.setShare(share);
    this.showScatter();
  }
  // Frame-time governor hooks (main.js). Motion: 2 full, 1 calm, 0 still; still also freezes
  // water ripples and dust. Render scale multiplies the quality's pixel-ratio cap.
  setMotionLevel(level) {
    this.motionLevel = level;
    this.life?.setLevel(level);
    if (this.environment) this.environment.still = level === 0;
  }
  setRenderScale(scale) {
    if (scale === this.renderScale) return;
    this.renderScale = scale;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.updateCamera();
  }
  pixelRatio() {
    return Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6) * (this.renderScale || 1);
  }
  setQuality(level) {
    this.lowPower = level === "low";
    this.applyReflections();
    this.createLife();
    this.createScatter();
    this.renderer.setPixelRatio(this.pixelRatio());
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
  // Each file is tried three times. A later call (the player's Retry) fetches only what is missing.
  hasModels(types = this.requiredModels) {
    return !!this.environmentAssets && types.every(type => type === 'environment' || this.models.has(type));
  }
  loadModels(types = CORE_MODEL_TYPES, onProgress) {
    if (typeof types === 'function') { onProgress = types; types = CORE_MODEL_TYPES; }
    return this.ensureModels(types, onProgress);
  }
  ensureModels(types, onProgress) {
    const required = [...new Set(types.filter(type => type !== 'environment'))];
    if (required.some(type => !/^[a-z][a-z0-9_-]*$/.test(type))) return Promise.reject(new Error('Invalid model type'));
    this.requiredModels = required;
    this.modelsReady = this.hasModels(required);
    const operation = this.modelQueue.catch(() => {}).then(() => this.prepareModels(required, onProgress));
    this.modelQueue = operation;
    return operation.finally(() => { this.modelsReady = this.hasModels(this.requiredModels); });
  }
  async prepareModels(types, onProgress) {
    const loader = new GLTFLoader(), total = types.length + 1;
    let loaded = types.filter((type) => this.models.has(type)).length + (this.environmentAssets ? 1 : 0);
    onProgress?.(loaded, total);
    const fetchModel = async (name) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
          onProgress?.(++loaded, total);
          return gltf;
        } catch (error) {
          if (attempt >= 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    };
    const results = await Promise.allSettled([
      ...types
        .filter((type) => !this.models.has(type))
        .map(async (type) => {
          const gltf = await fetchModel(type);
          gltf.scene.updateMatrixWorld(true);
          // Merge stationary pieces by material, preserving the two articulated leg pivots.
          const template = new THREE.Group(),
            buckets = new Map(),
            barrelBuckets = new Map(),
            turretBuckets = new Map(), // vehicles: Turret_head* parts turn about Turret_pivot
            legs = [];
          template.userData.hover = !!gltf.scene.getObjectByName("hover");
          let pivot = null;
          gltf.scene.traverse((o) => { if (o.name.startsWith("Turret_pivot")) pivot = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); });
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
            const rigged=RIG_PART.test(o.name),target=rigged?(pivot&&/^Turret_head/i.test(o.name)?turretBuckets:barrelBuckets):buckets;
            const key = o.material.name;
            if (!target.has(key))
              target.set(key, { material: o.material, geometries: [] });
            const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
            if (rigged && pivot) geometry.translate(-pivot.x, 0, -pivot.z);
            target.get(key).geometries.push(geometry);
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
          if(pivot){
            const turret=new THREE.Group();turret.name='TurretRig';turret.position.set(pivot.x,0,pivot.z);
            for(const {material,geometries} of turretBuckets.values()){
              const combined=mergeGeometries(geometries,false);
              if(combined)turret.add(new THREE.Mesh(combined,material));
              geometries.forEach(g=>g.dispose());
            }
            turret.add(barrel);template.add(turret);
          }else template.add(barrel);
          bakeFinishes(template);
          // Only Team/TeamGlow materials vary by faction. Share the other finishes
          // so identical armour, tyres and suits can join one batch across armies.
          const materials = new Map();
          for (let team = 0; team < this.colors.length; team++) {
            const variant = template.clone(true);
            variant.traverse((o) => {
              if (!o.isMesh) return;
              const name = o.material.name;
              const key = `${name.startsWith("Team") ? team : "shared"}:${name}`;
              if (!materials.has(key)) {
                // The baked material is one shared program for every model; it is never cloned.
                const m = name.startsWith("Baked") ? o.material : o.material.clone();
                if (name.startsWith("Team")) {
                  m.color.setHex(this.colors[team]);
                  if (name.startsWith("TeamGlow")) {
                    m.emissive.setHex(this.glows[team]);
                    m.emissiveIntensity = 0.8;
                    this.pulsing.push({ m, base: 0.8, depth: 0.3, rate: 2.2, phase: team * 1.3 });
                  }
                } else if (name.startsWith("Energy")) this.pulsing.push({ m, base: m.emissiveIntensity, depth: 0.35, rate: 3.1, phase: 0 });
                materials.set(key, m);
              }
              o.material = materials.get(key);
              o.castShadow = CORE_MODEL_TYPES.includes(type) || D[type]?.kind === "building";
              o.receiveShadow = true;
            });
            adoptBatchedParts(variant);
            this.teamTemplates.set(`${type}-${team}`, variant);
          }
          this.models.set(type, true);
        }),
      this.environmentAssets || fetchModel("environment").then((gltf) => {
        this.environmentAssets = gltf.scene;
        optimizeEnvironment(this.environmentAssets);
        // Crystals glow from inside and shimmer slowly; shrubs and reeds sink into the fog of war.
        const seen = new Set();
        this.environmentAssets.traverse((o) => {
          const m = o.material;
          if (!o.isMesh || seen.has(m)) return;
          seen.add(m);
          if (m.name.startsWith("Crystal")) {
            m.emissiveIntensity = 1.5;
            this.pulsing.push({ m, base: 1.5, depth: 0.22, rate: 1.4, phase: m.name.length });
          } else if (["Foliage", "FoliageLight", "Bark"].includes(m.name)) fogAware(m, this.fogUniforms);
        });
        this.applyAssetTheme();
      }),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    // Blender boulders (EnvironmentView) replace the placeholder rocks drawn before loading.
    if (this.environmentAssets.getObjectByName("asset_rock_a")) this.removePlaceholderRocks();
    if (!this.environment) {
      this.environment = new EnvironmentView(this.scene, this.terrain, this.environmentAssets);
      this.environment.configure(this.settings);
      this.environment.still = this.motionLevel === 0;
    }
    this.applyReflections();
  }
  createTerrain() {
    seed = 1482;
    this.terrainRoot = new THREE.Group();
    this.scene.add(this.terrainRoot);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    // Surfaces, accent patches and painted detail (ground-paint.js); seeded, so identical each build.
    paintGround(ctx, this.terrain, 1024, random);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.lowPower ? 1 : 4;
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
    // Depth bias: building bases, pads and decals sit level with (or millimetres above) the
    // ground, which z-fights and blinks, worst on phones' coarser depth buffers. The biased
    // ground always loses those ties.
    const ground = mesh(groundGeometry, mat(0xffffff, { map: texture, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    this.terrainRoot.add(ground);
    // The edge of the world: a cliff skirt and the land or sea below it, fading into the
    // horizon haze (map-edge.js). The old slab under the map also had a top face 5 cm below
    // the ground, which won the biased depth test and hid the ground texture on every map
    // without a river; the skirt has sides only.
    this.terrainRoot.add(createMapEdge(this.terrain));
    // One grid line per two-unit navigation cell on every map size.
    this.grid = new THREE.GridHelper(this.terrain.size, this.terrain.grid, 0xd8d8b4, 0xa6b087);
    this.grid.position.y = 0.035;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.15;
    this.grid.visible = false;
    this.terrainRoot.add(this.grid);
    this.placeholderRocks = null;
    // Grass, flowers, rocks, ruins and each map's own props are planned and drawn by scatter.js.
    // No raised start pads under the Command cores: a floor a few millimetres above the ground
    // z-fought with the cores' base plates and blinked on phones.
  }
  // Reflections pay off on metal, glass and crystals. Matte paint, fabric and scenery gain
  // little, and the per-pixel environment lookup is the most expensive part of the model
  // shaders on weak GPUs and software renderers, so Eco quality skips it entirely.
  buildEnvironmentMap() {
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environmentMap = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  restoreEnvironmentMap() {
    this.environmentMap?.dispose();
    this.buildEnvironmentMap();
    this.applyReflections();
  }
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
    // Always magnified (one texel per two-unit cell), so no mipmaps to rebuild on each refresh.
    this.fogTexture.minFilter = THREE.LinearFilter;
    this.fogTexture.generateMipmaps = false;
    this.fogTexture.colorSpace = THREE.SRGBColorSpace;
    this.tintFog();
    this.fogUniforms.uFogMap.value = this.fogTexture;
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
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
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
    // Vitals bars and selection rings keep a readable size on small screens: a unit's bar
    // is never under about 30 px wide (a phone shows as little as 11 px per world unit).
    const pixels = this.height / this.zoom, grow = clamp(30 / (1.43 * pixels), 1, 1.9);
    this.barScale = grow;
    this.barTall = 1 + 0.35 * Math.min(1, (grow - 1) * 2);
    this.unitsPerPixel = 1 / pixels;
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
  // Concrete wall: three crossing slabs with hazard-striped caps, built once at radius 1 and
  // scaled per wall, so every wall shares two batches (entity-batches.js).
  wallTemplate() {
    if (this.wallParts) return this.wallParts;
    // Builder stone with a band of Lattice light, in the map's colours (applyTheme recolours them).
    const style = themeFor(this.terrain.id);
    const concrete = new THREE.MeshStandardMaterial({ color: style.wall, roughness: 0.94, name: "Concrete" });
    const trim = new THREE.MeshStandardMaterial({ color: style.glow, emissive: style.glow, emissiveIntensity: 0.55, roughness: 0.6, name: "WallTrim" });
    // A ruined Builder pylon: six standing stones of uneven height on a plinth, around a
    // core that still holds Lattice light. Everything stays inside the obstacle's circle.
    const slabs = [], caps = [];
    [1.5, 0.95, 1.7, 0.7, 1.35, 1.1].forEach((height, i) => {
      const angle = (i / 6) * Math.PI * 2 + 0.26, lean = i % 2 ? 0.07 : -0.05;
      const stone = new THREE.BoxGeometry(0.56, height, 0.34).translate(0, height / 2 + 0.2, 0);
      const band = new THREE.BoxGeometry(0.58, 0.09, 0.36).translate(0, height * 0.55 + 0.2, 0);
      for (const g of [stone, band]) g.rotateZ(lean).translate(0, 0, 0.62).rotateY(angle);
      slabs.push(stone);
      caps.push(band);
    });
    slabs.push(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 6).translate(0, 0.67, 0));
    caps.push(new THREE.CylinderGeometry(0.2, 0.31, 0.3, 6).translate(0, 1.29, 0));
    // A low footing ring fills the obstacle's footprint.
    slabs.push(new THREE.CylinderGeometry(0.98, 1, 0.22, 10).translate(0, 0.11, 0));
    this.wallParts = [
      new THREE.Mesh(mergeGeometries(slabs.map((g) => g.toNonIndexed()), false), concrete),
      new THREE.Mesh(mergeGeometries(caps.map((g) => g.toNonIndexed()), false), trim),
    ];
    for (const m of this.wallParts) m.castShadow = m.receiveShadow = true;
    return this.wallParts;
  }
  createWallModel(e) {
    const model = new THREE.Group(), inner = new THREE.Group();
    for (const part of this.wallTemplate()) inner.add(part.clone());
    inner.rotation.y = (e.x * 0.37 + e.z * 0.61) % Math.PI;
    inner.scale.set(e.radius, 1, e.radius);
    model.add(inner);
    adoptBatchedParts(model);
    return model;
  }
  createEntity(e) {
    const root = new THREE.Group(),
      model = e.kind === "wall" ? this.createWallModel(e) : this.teamTemplates.get(`${e.type}-${e.team}`).clone(true);
    root.add(model);
    // Shared per radius, so every blob shadow joins one batch.
    let shadowGeometry = this.contactShadowGeometries.get(e.radius);
    if (!shadowGeometry)
      this.contactShadowGeometries.set(e.radius, (shadowGeometry = new THREE.CircleGeometry(e.radius * 1.25, 20)));
    const contactShadow = new THREE.Mesh(shadowGeometry, this.contactShadowMaterial);
    contactShadow.layers.set(SOURCE_LAYER);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.07;
    contactShadow.visible = this.lowPower;
    root.add(contactShadow);
    root.userData.contactShadow = contactShadow;
    root.userData.model = model;
    root.userData.hover = !!model.userData.hover;
    root.userData.hoverClock = e.id * FEEL.hoverPhaseStep;
    // Measure the template in the default camera projection, once per new unit.
    // A capped visual scale never changes the simulation collision radius.
    root.userData.readabilityScale = 1;
    if (e.kind === 'unit') {
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1), point = new THREE.Vector3();
      model.rotation.y = e.angle;
      model.updateMatrixWorld(true);
      let min = Infinity, max = -Infinity;
      model.traverse(part => {
        if (!part.isMesh) return;
        if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
        const box = part.geometry.boundingBox;
        for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
          const projected = point.set(x,y,z).applyMatrix4(part.matrixWorld).dot(up);
          min = Math.min(min,projected); max = Math.max(max,projected);
        }
      });
      const height = (max-min) * this.renderer.domElement.getBoundingClientRect().height / this.defaultZoom;
      root.userData.readabilityScale = Math.min(FEEL.maxModelScale, Math.max(1, FEEL.minPixels / Math.max(height, Number.EPSILON)));
    }
    root.userData.barrel=model.getObjectByName('BarrelRig');
    root.userData.turret=model.getObjectByName('TurretRig');
    root.userData.recoil=0;
    root.userData.kick=0;root.userData.kickSize=0;
    root.userData.gait=0;root.userData.stride=(e.id*0.7)%6.28;
    root.userData.pop=0;root.userData.built=e.complete!==false;
    root.userData.team = e.team;
    // Story missions: a faction emblem floats over each building (Meridian for the player's own).
    if (e.kind === "building" && this.mission?.factions) {
      const faction = e.team === 0 ? "meridian" : factionOf(this.mission, e.team)?.id;
      if (hasEmblem(faction)) {
        let top = this.buildingTops.get(e.type);
        if (top === undefined) this.buildingTops.set(e.type, (top = new THREE.Box3().setFromObject(model).max.y));
        const size = Math.min(2.8, Math.max(1.4, e.radius * 1)),
          emblem = createEmblem(faction, e.team, this.colors[e.team], size);
        emblem.position.y = top + size * 0.55;
        root.add(emblem);
        root.userData.emblem = emblem;
      }
    }
    root.userData.legs = [];
    model.traverse((o) => {
      if (o.name.startsWith("leg_"))
        root.userData.legs.push({ node: o, base: o.quaternion.clone() });
    });
    // Selection ring and vitals bar (health, damage ghost, shield, level pips): one shader
    // mesh each, see selection-view.js.
    const side = e.team >= 0 ? this.colors[e.team] : 0xb8b2a4; // walls are neutral grey
    const ring = createRing(e.radius, side);
    root.add(ring);
    root.userData.ring = ring;
    const bar = createBar(e, side);
    root.add(bar);
    root.userData.bar = bar;
    bar.position.y *= root.userData.readabilityScale;
    cacheTransforms(root);
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
      // Deposits retain their own fog/remaining-amount state and pick target, but
      // repeated Blender crystal parts render through the same instanced path.
      adoptBatchedParts(cluster);
      cacheTransforms(cluster);
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
    cacheTransforms(group);
    this.scene.add(group);
    this.resourceObjects.set(e.id, group);
    return group;
  }
  // Command confirmation on the ground: attack orders get crosshair ticks.
  marker(x, z, color = this.colors[0], attack = color !== this.colors[0]) {
    const m = createMarker(color, attack);
    m.position.x = x;
    m.position.z = z;
    this.scene.add(m);
    this.effects.push({ mesh: m, life: 0.8, max: 0.8, marker: true, team: color===this.colors[0]?0:undefined });
    while(this.effects.length>64){
      const old=this.effects.shift();this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();old.mesh.material.dispose();
    }
  }
  shakeEnabled() { return this.settings.screenShake !== false && this.feelEnabled(); }
  feelEnabled() { return this.settings.combatMotion !== false && !this.reducedMotion.matches && !this.cameraCue; }
  onScreen(event) {
    const p = new THREE.Vector3(event.x, 0, event.z).project(this.camera);
    return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1;
  }
  event(event, sim) {
    const enabled = this.feelEnabled();
    if (Number.isFinite(event.x) && Number.isFinite(event.z) && sim.isVisible(event)) {
      const trauma = event.type === 'strike' ? FEEL.barrageTrauma : event.type === 'death' ? (event.core ? FEEL.coreTrauma : event.building ? FEEL.buildingTrauma : 0) : 0;
      if (trauma) this.shake.add(trauma, Math.hypot(event.x-this.focus.x,event.z-this.focus.z), this.shakeEnabled());
      if (enabled && event.type === 'death' && event.core && this.onScreen(event)) this.hitStop = FEEL.stopSeconds;
      if (enabled && event.type === 'strike' && (event.victims || []).filter(v => sim.isVisible(v) && this.onScreen(v)).length >= FEEL.stopKills) this.hitStop = FEEL.stopSeconds;
      if (event.type === 'impact') {
        const o = this.objects.get(event.seed);
        if (o) o.userData.flash = FEEL.flashSeconds;
      }
    }
    // Rules resolve shells immediately; the existing shot event carries the landing point.
    if (FEEL.shellTrauma && event.type === 'shot' && ['tank','breaker'].includes(event.weapon) && shotVisible(event,sim))
      this.shake.add(FEEL.shellTrauma, Math.hypot(event.tx-this.focus.x,event.tz-this.focus.z), this.shakeEnabled());
    this.activity.event(event, sim);
    this.tactics.event(event, sim);
    if(event.type==='shot' && shotVisible(event,sim)){
      const o=this.objects.get(event.source),kind=weaponStyle(event).kind;
      if(o && kind==='cannon')o.userData.recoil=.22;
      // Every shooter rocks back a little: hulls and rocket troops most, rifles barely.
      if(o && kind!=='support'){o.userData.kick=.16;o.userData.kickSize=kind==='rocket'?.11:kind==='cannon'?.07:.03;}
    }
    if (event.type === 'death' && sim.isVisible(event)) this.beginDeath(event);
    // Blasts kill the small creatures they reach; a new match brings the full cast back.
    if (event.type === 'strike') this.life?.disturb(event.x, event.z, event.radius || 4);
    if (event.type === 'death' || event.type === 'impact')
      this.life?.disturb(event.x, event.z, event.type === 'impact' ? 1.5 : event.building ? 6 : event.heavy ? 4 : 2.5);
  }
  // The destroyed entity's model stays for a short death animation instead of vanishing:
  // buildings shake and sink with a tilt, vehicles are thrown and settle as a wreck, infantry
  // fall. Models are clones sharing template materials, so only transforms animate.
  beginDeath(event) {
    const o = this.objects.get(event.seed);
    if (!o) return;
    this.objects.delete(event.seed);
    for (const part of [o.userData.ring, o.userData.bar, o.userData.contactShadow]) part.visible = false;
    if (this.dying.length >= FEEL.wreckCap) this.disposeEntity(this.dying.shift().object);
    const kind = event.building ? 'building' : event.heavy ? 'vehicle' : 'infantry';
    const model = o.userData.model;
    if (o.userData.emblem) o.userData.emblem.visible = false;
    model.rotation.order = 'YXZ';
    this.dying.push({ object: o, kind, team: event.team, age: 0, x: o.position.x, z: o.position.z, tilt: (event.seed % 2 ? 1 : -1),
      life: { building: 2.8, vehicle: this.lowPower ? FEEL.ecoWreckSeconds : FEEL.wreckSeconds, infantry: 1.6 }[kind], baseY: model.rotation.y, direction: event.direction ?? model.rotation.y });
  }
  updateDying(sim, dt) {
    const motion = this.activity.combat.motion;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i], o = d.object, m = o.userData.model;
      d.age += dt;
      if (d.age >= d.life) { this.disposeEntity(o); this.dying.splice(i, 1); continue; }
      o.visible = sim.isVisible(d);
      const t = d.age, clamp01 = (x) => Math.min(1, Math.max(0, x));
      const ease = (x) => 1 - (1 - clamp01(x)) ** 3, heavy = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
      if (d.kind === 'building') {
        // A heavy collapse: a shudder, then a slow start that accelerates into the ground.
        const shake = motion ? Math.max(0, 1 - t / 1.1) * 0.12 : 0;
        o.position.set(d.x + Math.sin(t * 61) * shake, -heavy((t - 0.35) / 2.35) * 5.6, d.z + Math.cos(t * 53) * shake);
        m.rotation.z = d.tilt * heavy((t - 0.4) / 2.2) * 0.16;
        m.rotation.x = d.tilt * heavy((t - 0.4) / 2.2) * 0.07;
      } else if (d.kind === 'vehicle') {
        const hop = motion ? Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.55 : 0;
        o.position.y = hop - ease((t - (d.life - 0.9)) / 0.9) * 1.8;
        m.rotation.z = d.tilt * ease(t / 0.45) * 0.18;
        m.rotation.x = -ease(t / 0.45) * 0.1;
      } else {
        m.rotation.y = d.direction;
        m.rotation.x = -ease(t / FEEL.fallSeconds) * 1.45;
        o.position.y = -ease((t - 0.9) / 0.7) * 1.2;
      }
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
    if (this.contextLost) return;
    const realDt = dt, enabled = this.feelEnabled();
    this.shake.step(realDt, enabled, this.lowPower);
    if (!enabled) this.hitStop = 0;
    if (this.hitStop > 0) {
      const held = Math.min(realDt, this.hitStop);
      dt = realDt - held + held * FEEL.stopScale;
      this.hitStop = Math.max(0, this.hitStop-realDt);
    }
    this.environment?.update(sim, dt);
    if (this.life) {
      this.life.quiet = this.reducedMotion.matches;
      this.life.update(dt, this.camera, this.renderer.domElement.height);
    }
    // Cosmetic clocks stop with the game (dt 0), with reduced motion and when the governor
    // holds everything still. Lamps and crystals breathe; grass leans with the wind.
    const lively = this.motionLevel > 0 && !this.reducedMotion.matches;
    if (lively && dt > 0) {
      this.lifeClock = (this.lifeClock + Math.min(0.05, dt)) % 3600;
      for (const p of this.pulsing) p.m.emissiveIntensity = p.base * (1 + p.depth * Math.sin(this.lifeClock * p.rate + p.phase));
    }
    this.scatter?.update(dt, lively && this.settings.waterMotion !== false);
    // Idle troops breathe only at full quality and full motion: it re-poses every idle unit.
    const breathing = lively && this.motionLevel === 2 && !this.lowPower;
    const kicking = this.activity.combat.motion;
    const alive = new Set();
    // Interpolate only from a snapshot taken exactly one tick before the current state;
    // ticks run outside the frame loop (test stepping) leave the snapshot stale.
    const interpolate = alpha < 1 && Math.abs(sim.time - 0.05 - this.previousTime) < 1e-6;
    for (const e of sim.entities) {
      // A unit whose model is still downloading (or failed offline) is drawn once it arrives.
      if (!this.objects.has(e.id) && e.kind !== "wall" && !this.teamTemplates.has(`${e.type}-${e.team}`)) continue;
      alive.add(e.id);
      const o = this.objects.get(e.id) || this.createEntity(e);
      const u=o.userData;
      u.recoil=Math.max(0,u.recoil-dt);u.kick=Math.max(0,u.kick-dt);
      // Walls are neutral and see nothing: keep them drawn once explored, like the minimap does.
      o.visible = e.kind === "wall" ? sim.isExplored(e) : sim.isVisible(e);
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
      if(u.turret){
        // Vehicles: the hull keeps its heading while the turret swings to the target (turn-rate limited, shortest way).
        if(e.moving||u.hullYaw===undefined)u.hullYaw=m.rotation.y;else m.rotation.y=u.hullYaw;
        const aim=e.attacking?e.angle-m.rotation.y:0,diff=Math.atan2(Math.sin(aim-u.turret.rotation.y),Math.cos(aim-u.turret.rotation.y));
        const step=this.activity.combat.motion&&!this.reducedMotion.matches?3*dt:Math.PI;
        u.turret.rotation.y+=Math.max(-step,Math.min(step,diff));
      }
      if(o.userData.barrel){
        const rig=o.userData.barrel;
        if(u.turret){
          rig.rotation.y=0;
          rig.position.set(0,0,-(this.activity.combat.motion?Math.sin(u.recoil/.22*Math.PI)*.18:0));
        }else{
        rig.rotation.y=e.type==='tower'?e.angle-m.rotation.y:0;
        const kick=this.activity.combat.motion?Math.sin(o.userData.recoil/.22*Math.PI)*.18:0;
        rig.position.set(-Math.sin(rig.rotation.y)*kick,0,-Math.cos(rig.rotation.y)*kick);
        }
      }
      let lift = 0, squash = 0, back = 0;
      if (e.kind === "unit") {
        // The gait follows the ground actually covered this tick, so feet neither slide nor
        // march on the spot: stride length drives the leg swing, speed its size.
        const speed = p ? Math.sqrt((e.x - p.x) ** 2 + (e.z - p.z) ** 2) * 20 : e.moving ? D[e.type].speed || 3 : 0;
        const pace = Math.min(1, speed / 2.4);
        if (dt > 0) {
          u.gait += (pace - u.gait) * Math.min(1, dt * 10);
          if (pace === 0 && u.gait < 0.03) u.gait = 0;
          u.stride += speed * dt * (u.legs.length ? 2.5 : 3.4);
        } else if (!p) u.gait = pace;
        lift = u.legs.length ? Math.abs(Math.sin(u.stride)) * 0.07 * u.gait : Math.sin(u.stride * 2.1) * 0.016 * u.gait;
        if (breathing && u.gait === 0 && u.legs.length) squash = Math.sin(this.lifeClock * 2.1 + e.id * 1.7) * 0.012;
        if (kicking && u.kick > 0) back = Math.sin((u.kick / 0.16) * Math.PI) * u.kickSize;
      } else if (e.kind === "building") {
        // A finished building settles with a small bounce.
        if (e.complete && !u.built && kicking) u.pop = 0.4;
        u.built = !!e.complete;
        if (u.pop > 0) { u.pop = Math.max(0, u.pop - dt); squash = Math.sin((u.pop / 0.4) * Math.PI) * 0.07; }
        // Dressing under a building the player has seen is pressed flat (visual only).
        if (!u.pressed) { u.pressed = true; this.scatter?.flatten(e.x, e.z, e.radius + 0.5); }
      }
      if (u.hover && lively && !this.lowPower && this.settings.combatMotion !== false) { u.hoverClock += dt * FEEL.hoverRate; lift += Math.sin(u.hoverClock) * FEEL.hoverAmplitude; }
      m.position.set(back ? -Math.sin(m.rotation.y) * back : 0, lift, back ? -Math.cos(m.rotation.y) * back : 0);
      m.scale.set(1 + squash * 0.5, (e.complete ? 1 : 0.15 + e.progress * 0.85) + squash, 1 + squash * 0.5);
      m.scale.multiplyScalar(u.readabilityScale);
      m.rotation.z = isHarvesting(sim,e) && !this.reducedMotion.matches ? Math.sin(sim.time*7+e.id)*0.045 : 0;
      for (let i = 0; i < u.legs.length; i++) {
        const leg = u.legs[i];
        leg.node.quaternion.copy(leg.base);
        if (u.gait > 0)
          leg.node.rotateX(Math.sin(u.stride + i * Math.PI) * 0.46 * u.gait);
      }
      updateRing(u.ring, selected.has(e.id), hover?.id === e.id, sim.time, dt, this.unitsPerPixel);
      const bar = u.bar;
      bar.visible =
        selected.has(e.id) || hover?.id === e.id || e.hp < e.maxHp || e.shield < e.maxShield;
      if (bar.visible) {
        bar.quaternion.copy(this.camera.quaternion);
        bar.scale.set(bar.userData.base * this.barScale, bar.userData.base * this.barScale * this.barTall, 1);
      }
      updateBar(bar, e, dt);
      u.flash = Math.max(0, (u.flash || 0)-realDt);
      const flash = u.flash > 0 && this.settings.combatMotion !== false && !this.reducedMotion.matches;
      u.ring.material.uniforms.flash.value = bar.material.uniforms.flash.value = flash ? 1 : 0;
      if (flash) { u.ring.visible = bar.visible = true; u.ring.material.uniforms.appear.value = 1; }

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
      if (o.visible && !o.userData.pressed) { o.userData.pressed = true; this.scatter?.flatten(r.x, r.z, (r.radius || 1.6) + 0.6); }
    }
    this.fogClock -= dt;
    if (this.fogClock <= 0) {
      this.fogClock = 0.25;
      const fog = this.fogImage.data, seen = sim.visible[0], known = sim.explored[0];
      for (let i = 0, j = 3, n = this.terrain.grid * this.terrain.grid; i < n; i++, j += 4)
        fog[j] = seen[i] ? 0 : known[i] ? 128 : 246;
      this.fogContext.putImageData(this.fogImage, 0, 0);
      this.fogTexture.needsUpdate = true;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.material.uniforms.progress.value = Math.min(1, 1 - e.life / e.max);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.updateDying(sim, dt);
    this.fx.update(sim, dt);
    this.tactics.update(sim, dt);
    // Story missions: a ground ring at each capture point.
    if (sim.mission || sim.capturePointsOn || this.captureRings) {
      this.captureRings ||= new CaptureRings(this.scene);
      this.captureRings.update(sim, this.colors, this.lowPower || this.motionLevel === 0 || this.reducedMotion.matches);
    }
    if (!this.rally) this.scene.add(this.rally = createRally());
    const rallying = [...selected].map((id) => sim.get(id)).find((e) => e?.team === 0 && e.kind === "building" && e.rally);
    updateRally(this.rally, rallying, rallying?.rally, this.colors[0], sim.time);
    // Update world matrices once, copy entity parts into their batches, then render without
    // a second scene-wide matrix pass.
    this.scene.updateMatrixWorld();
    const shadows = this.renderer.shadowMap.enabled && this.sun.castShadow;
    if (shadows) this.sun.shadow.updateMatrices(this.sun);
    this.batches.begin(this.camera, shadows ? this.sun.shadow.getFrustum() : null);
    for (const o of this.objects.values()) this.batches.collect(o);
    for (const d of this.dying) this.batches.collect(d.object);
    for (const o of this.resourceObjects.values()) this.batches.collect(o);
    this.batches.end();
    this.scene.matrixWorldAutoUpdate = false;
    // Shake only during drawing: picking, panning and UI projections use the stable camera.
    const shaking = this.shake.trauma > 0;
    if (shaking) {
      this.shakePosition.copy(this.camera.position);
      this.shakeRotation.copy(this.camera.quaternion);
      this.camera.translateX(this.shake.offset.x);
      this.camera.translateY(this.shake.offset.y);
      this.camera.rotateZ(this.shake.offset.roll);
      this.camera.updateMatrixWorld();
    }
    try { this.renderer.render(this.scene, this.camera); }
    finally {
      if (shaking) {
        this.camera.position.copy(this.shakePosition);
        this.camera.quaternion.copy(this.shakeRotation);
        this.camera.updateMatrixWorld();
      }
      this.scene.matrixWorldAutoUpdate = true;
    }
    this.activity.draw(sim,dt,selected,hover);
  }
  disposeEntity(o) {
    this.scene.remove(o);
    // Model geometry and materials belong to shared templates, and blob shadows share theirs;
    // only dispose per-instance UI.
    for (const m of [o.userData.ring, o.userData.bar]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
  reset() {
    if (this.life && this.life.aliveCount < this.life.groups.reduce((n, g) => n + g.rows.length, 0)) this.createLife();
    this.activity.reset();
    this.tactics.reset();
    this.environment?.reset();
    this.scatter?.restore();
    for (const o of this.objects.values()) this.disposeEntity(o);
    this.objects.clear();
    for (const d of this.dying) this.disposeEntity(d.object);
    this.dying = [];
    this.shake = new CameraShake();
    this.hitStop = 0;
    this.cameraCue = false;
    this.shakePosition = new THREE.Vector3();
    this.shakeRotation = new THREE.Quaternion();
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
    this.captureRings?.clear();
    this.focusOn(
      this.defaultZoom === 34 ? -25 : -20,
      this.defaultZoom === 34 ? 21 : 19,
    );
    this.zoom = this.defaultZoom;
    this.updateCamera();
    this.fogClock = 0;
  }
}
