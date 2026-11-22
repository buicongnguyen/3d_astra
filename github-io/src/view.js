import * as THREE from "three";
import { addTeamBands } from "./team-bands.js";
import { CORE_MODEL_TYPES } from "./model-roster.js";
import { CameraShake, FEEL } from "./camera-shake.js";
const WRECK_TINT = [0.2, 0.18, 0.16]; // burnt: paint and team colour multiplied down to soot
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Terrain } from "./terrain.js";
import { ActivityView } from "./activity-view.js";
import { mulberry32 } from "./rng.js";
import { Effects } from "./fx.js";
import { startFlash, stepFlash, HIT_FLASH } from "./combat-feedback.js";
import { SelectionBatches, createRing, updateRing, createBar, updateBar, setTeamColor, createMarker, createRally, updateRally } from "./selection-view.js";
import { CaptureRings, DestinationMarkers } from "./capture-view.js";
import { TacticsView } from "./tactics-view.js";
import {themeFor,lightFor,lookOf,shotVisible,weaponStyle} from './visual-style.js';
import { Scatter } from "./scatter.js";
import { createMapEdge } from "./map-edge.js";
import { paintGround } from "./ground-paint.js";
import { buildPlateauRelief, lowerCliffBand, fogLift } from "./plateau-relief.js";
import { fogAware } from "./fog-aware.js";
import { teamColors, teamGlows, factionOf } from "./faction-colors.js";
import { createEmblem, hasEmblem, recolorEmblems } from "./emblems.js";
import { isHarvesting } from "./activity.js";
import { EntityBatches, adoptBatchedParts, SOURCE_LAYER } from "./entity-batches.js";
import { BossView, bossTemplates, recolorBossPaint } from "./boss-view.js";
import { cacheTransforms } from "./transform-cache.js";
import { AmbientLife } from "./ambient-life.js";
import { defaults } from "./settings.js";
import { ViewPlugins } from "./view-plugins.js";
import { installGrade, gradeKey, fogOverride, rimShader, addTeamRim, setRimTier } from "./look-grade.js";
import { MissionLook } from "./mission-look-view.js";
import { airMotion } from "./air-motion.js";
import {
  EnvironmentView,
  optimizeEnvironment,
} from "./environment-view.js";
import {
  DEFINITIONS as D,
  ROCKS,
  clamp,
} from "./data.js";

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
// Meshes named like this in the Blender models aim (towers) and recoil together. Blender
// duplicate suffixes arrive sanitised by GLTFLoader ("Barrel.001" -> "Barrel001").
export const RIG_PART = /^(Main_cannon|Muzzle_brake|Barrel|Cannon|Muzzle|Turret_head)(?![a-z])/i;
// Pivots kept as their own nodes: walking legs, and the flyers' rotors (spin_*) and burner flame (flicker_*).
const MOVING_PART = /^(leg_|spin_|flicker_)/;
// Flyers: rotor axes, a scratch quaternion, and where the altitude looks for higher ground (a rim ahead).
const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1), SPIN = new THREE.Quaternion();
const FLY_SAMPLES = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]];
// The left and right rotors of a flyer are the same part mirrored in place: after baking, the right
// one draws with the left one's geometry, so both join one batch (one draw instead of two).
function shareRotorGeometry(pivots) {
  const first = new Map();
  for (const pivot of pivots) {
    if (!pivot.name.startsWith("spin_")) continue;
    const key = pivot.name.replace(/_[LR]$/, "");
    const meshes = pivot.children.filter((c) => c.isMesh);
    const left = first.get(key);
    if (!left) { first.set(key, meshes); continue; }
    if (left.length !== meshes.length) continue;
    meshes.forEach((m, i) => {
      const a = left[i].geometry, b = m.geometry;
      if (a !== b && a.attributes.position.count === b.attributes.position.count && left[i].material.name === m.material.name &&
        left[i].position.equals(m.position) && left[i].quaternion.equals(m.quaternion) && left[i].scale.equals(m.scale)) { b.dispose(); m.geometry = a; }
    });
  }
}
const SUN_OFFSET = new THREE.Vector3(-25, 55, 20);
// The game camera sits this far from its focus (the same 71 m as before 0.14, so the distance
// haze is unchanged), looking down about 46 degrees: low enough that plateaus, cliffs and unit
// silhouettes read as height. scatter.js winds foliage toward the same direction.
const CAMERA_OFFSET = new THREE.Vector3(25, 51, 43);
// How deep (in world units, per unit of zoom) half the view reaches across the ground.
const VIEW_DEPTH = (0.5 * CAMERA_OFFSET.length()) / CAMERA_OFFSET.y;
const ECO_ZOOM = 31;
// Shadow camera basis, as Matrix4.lookAt builds it (looking from SUN_OFFSET, up +Y).
const LIGHT_Z = SUN_OFFSET.clone().normalize();
const LIGHT_X = new THREE.Vector3(0, 1, 0).cross(LIGHT_Z).normalize();
const LIGHT_Y = LIGHT_Z.clone().cross(LIGHT_X);
// Cosmetic module generator: reseeded in createTerrain (shared mulberry32, src/rng.js).
let cosmetic = mulberry32(1482);
const random = () => cosmetic();
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
// Shared materials for matte-only, reflective-only, and mixed rigid groups.
// Roughness and metalness remain per vertex; mixed groups mask the environment lookup by finish.
const bakedShared = new Map();
const reflects = (m) => m.metalness >= 0.5 || m.roughness <= 0.25;
export function bakedMaterial(reflective, mixed = false) {
  const key = mixed ? "mixed" : reflective;
  if (bakedShared.has(key)) return bakedShared.get(key);
  const m = new THREE.MeshStandardMaterial({ name: mixed ? "BakedMixed" : reflective ? "BakedReflect" : "Baked", vertexColors: true, roughness: 1, metalness: reflective ? 1 : 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 finish;\nvarying vec2 vFinish;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFinish = finish;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFinish;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vFinish.x;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vFinish.y;");
    // A single rigid group may have matte canvas next to polished metal. Keep
    // the old per-finish reflection choice when their geometry shares a draw.
    if (mixed) shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_maps>",
      "if (vFinish.y >= 0.5 || vFinish.x <= 0.25) {\n#include <lights_fragment_maps>\n}");
    rimShader(shader); // W2-C: the warm Fresnel rim (look-grade.js); Team parts get their own colour below
  };
  m.customProgramCacheKey = () => `baked-finish|${key}|${gradeKey()}`;
  bakedShared.set(key, m);
  return m;
}
// `compact` (flyers, 0.18): small craft seen from far above, so each rigid group bakes into ONE mesh,
// glass included and metal and paint together (the reflective material if any part reflects).
export function bakeFinishes(root, { compact = false } = {}) {
  const groups = new Map();
  root.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || Array.isArray(m) || !m.isMeshStandardMaterial || (compact ? /^(Team|Lamp|Energy|Flame)/ : KEEP_FINISH).test(m.name) || m.map || (m.transparent && !compact) || (m.emissive?.getHex() && !(compact && m.name.startsWith("Glass")))) return;
    const key = o.parent.uuid;
    if (!groups.has(key)) groups.set(key, { parent: o.parent, reflective: reflects(m), meshes: [] });
    const group = groups.get(key);
    group.reflective ||= reflects(m);
    group.meshes.push(o);
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
    const mesh = new THREE.Mesh(merged, bakedMaterial(reflective, !compact && reflective && meshes.some(o => !reflects(o.material))));
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
    // ACES pulled every map toward the same dusty grey. W2-C: the custom mapping is Neutral plus the
    // warm grade of look-grade.js (installed by applyTheme before anything compiles).
    this.renderer.toneMapping = THREE.CustomToneMapping;
    setRimTier(this.lowPower);
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
    // A little closer than before 0.14 (42 / 34), so units and height read from the start.
    this.defaultZoom = this.lowPower ? ECO_ZOOM : 38;
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
    this.bosses = new BossView(this);
    this.dying = [];
    this.flashBatch = []; // hit flashes started by this tick's impacts (see event)
    this.flashBatchTime = -1;
    this.shake = new CameraShake();
    this.hitStop = 0;
    this.cameraCue = false;
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
    this.resize();
    // The observer covers window resizes too; resize() itself ignores an unchanged size.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");
    this.reducedMotion.addEventListener("change", () =>
      this.environment?.configure(this.settings),
    );
    // Round 2 view plugins (src/view-plugins.js, docs/VIEW_PLUGINS.md), built once with the view ready.
    this.plugins = new ViewPlugins(this);
    this.mood = new MissionLook(this);
  }
  // Each map has its own time of day: a warm key light, a cool sky fill, a warm bounce from
  // the ground, and a deep fog-of-war colour from the same family as its horizon.
  applyTheme() {
    const style=themeFor(this.terrain.id),light=lightFor(this.terrain.id);
    this.scene.background.set(style.sky);this.scene.fog.color.set(style.sky);
    this.ambientLight.color.set(style.ambient).lerp(new THREE.Color("#c4dded"), 0.22);this.ambientLight.groundColor.set(style.bounce);
    this.ambientLight.intensity=light.ambient;
    this.sun.color.set(style.sun).lerp(new THREE.Color("#ffe0b2"), 0.28);this.sun.intensity=light.sun;
    this.renderer.toneMappingExposure=light.exposure;
    // W2-C: the grade (and a lighter fog-of-war colour for the Ashen map) come from look-grade.json.
    const themeId=lookOf(this.terrain.id),fog=fogOverride(themeId)??style.fog;
    if(installGrade(themeId))this.regrade();
    this.fogUniforms.uFogColor.value.set(fog);
    this.fogUniforms.uFogHalf.value=this.terrain.half;
    this.fogRGB=[1,3,5].map(i=>parseInt(fog.slice(i,i+2),16));
    this.tintFog();
    // The map's own daylight, which a mission look (night, storm: mission-look-view.js) blends away from.
    this.baseLight={sky:style.sky,fog,ambient:this.ambientLight.color.getHex(),bounce:style.bounce,sun:this.sun.color.getHex(),ambientI:light.ambient,sunI:light.sun,exposure:light.exposure};
    this.mood?.themeChanged();
    if(this.wallParts){this.wallParts[0].material.color.set(style.wall);this.wallParts[1].material.color.set(style.glow);this.wallParts[1].material.emissive.set(style.glow);}
    this.applyAssetTheme();
  }
  // A changed grade makes every program compile again (the grade is part of its cache key).
  regrade() {
    this.scene?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    });
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
        if (!o.isMesh) return;
        recolorBossPaint(o.geometry, this.colors[team]);
        if (!o.material.name.startsWith("Team")) return;
        o.material.color.setHex(this.colors[team]);
        o.material.userData.rim?.setHex(this.colors[team]);
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
        this.fogUniforms,
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
    setRimTier(this.lowPower);
    this.applyReflections();
    this.createLife();
    this.createScatter();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = !this.lowPower;
    for (const o of this.objects.values())
      o.userData.contactShadow.visible = this.lowPower || !!o.userData.air; // flyers always mark their spot
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
  setModelRequirements(types) {
    this.requiredModels = [...new Set(types.filter(type => type !== 'environment'))];
    this.modelsReady = this.hasModels();
    return this.modelsReady;
  }
  ensureModels(types, onProgress) {
    if (types.some(type => !/^[a-z][a-z0-9_-]*$/.test(type))) return Promise.reject(new Error('Invalid model type'));
    this.setModelRequirements(types);
    const required = this.requiredModels;
    const operation = this.modelQueue.catch(() => {}).then(() => this.prepareModels(required, onProgress));
    this.modelQueue = operation;
    return operation.finally(() => { this.modelsReady = this.hasModels(this.requiredModels); });
  }
  // Models a match may need later (its flyers, model-roster.js airModelsFor): parsed in the background
  // after whatever is queued, without touching requiredModels or modelsReady, so the frame never waits.
  // A flyer uses a small shared airframe until its full model arrives.
  preloadModels(types) {
    const missing = types.filter((type) => /^[a-z][a-z0-9_-]*$/.test(type) && !this.models.has(type));
    if (!missing.length) return Promise.resolve();
    const operation = this.modelQueue.catch(() => {}).then(() => this.prepareModels(missing));
    this.modelQueue = operation;
    return operation.catch(() => {});
  }
  async prepareModels(types, onProgress) {
    const total = types.length + 1;
    let loaded = types.filter((type) => this.models.has(type)).length + (this.environmentAssets ? 1 : 0);
    onProgress?.(loaded, total);
    const fetchModel = async (name) => {
      const url = `${import.meta.env.BASE_URL}models/${name}.glb`;
      const loader = new GLTFLoader();
      for (let attempt = 0; ; attempt++) {
        try {
          const gltf = await loader.loadAsync(url);
          onProgress?.(++loaded, total);
          return gltf;
        } catch (error) {
          // FileLoader caches successful HTTP bodies before GLTFLoader can validate them.
          // Drop the failed bytes and ask both the worker and HTTP cache for a fresh copy.
          THREE.Cache.remove(`file:${url}`);
          loader.setRequestHeader({ "Cache-Control": "no-cache" });
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
          addTeamBands(gltf.scene, type);
          // Bosses (boss-view.js) keep their own rigid parts: legs, torso, arms, light gun and core.
          if (D[type]?.boss) {
            bossTemplates(gltf.scene, { colors: this.colors, glows: this.glows, bakedMaterial }).forEach((variant, team) => this.teamTemplates.set(`${type}-${team}`, variant));
            this.models.set(type, true);
            return;
          }
          // Merge stationary pieces by material, preserving the two articulated leg pivots.
          const template = new THREE.Group(),
            buckets = new Map(),
            barrelBuckets = new Map(),
            turretBuckets = new Map(), // vehicles: Turret_head* parts turn about Turret_pivot
            legs = [];
          template.userData.hover = !!gltf.scene.getObjectByName("hover");
          const flyer = !!D[type]?.flying;
          let teamPaint = null;
          if (flyer) gltf.scene.traverse((o) => { if (o.isMesh && o.material.name.startsWith("Team") && !o.material.name.startsWith("TeamGlow")) teamPaint ||= o.material; });
          let pivot = null;
          gltf.scene.traverse((o) => { if (o.name.startsWith("Turret_pivot")) pivot = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); });
          gltf.scene.traverse((o) => {
            // Leg pivots, and the flyers' spinning rotors and flickering burner flame (0.18), stay
            // separate nodes so they can move per instance inside their batches.
            if (MOVING_PART.test(o.name)) {
              const leg = o.clone(true);
              o.matrixWorld.decompose(leg.position, leg.quaternion, leg.scale);
              template.add(leg);
              legs.push(leg);
            }
            if (!o.isMesh) return;
            let parent = o.parent;
            while (parent) {
              if (MOVING_PART.test(parent.name)) return;
              parent = parent.parent;
            }
            // Keep the existing named Blender cannon pieces articulated while
            // still merging the barrel's materials into a compact rig.
            // (A flyer's guns stay part of its body: the whole craft kicks back when it fires.)
            const rigged=RIG_PART.test(o.name)&&!flyer,target=rigged?(pivot&&/^Turret_head/i.test(o.name)?turretBuckets:barrelBuckets):buckets;
            // Flyers: their small team lights join the team paint (one team-coloured draw per craft, not two).
            const glowAsPaint = flyer && teamPaint && o.material.name.startsWith("TeamGlow");
            const key = glowAsPaint ? teamPaint.name : o.material.name;
            if (!target.has(key))
              target.set(key, { material: glowAsPaint ? teamPaint : o.material, geometries: [] });
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
          bakeFinishes(template, { compact: flyer });
          shareRotorGeometry(legs);
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
                  addTeamRim(m, this.colors[team]); // W2-C: the team's own colour on the edge
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
      this.environment = new EnvironmentView(this.scene, this.terrain, this.environmentAssets, this.fogUniforms);
      this.environment.configure(this.settings);
      this.environment.still = this.motionLevel === 0;
    }
    this.applyReflections();
  }
  createTerrain() {
    cosmetic = mulberry32(1482);
    this.terrainRoot = new THREE.Group();
    this.scene.add(this.terrainRoot);
    const canvas = document.createElement("canvas");
    // PCs on High get a 2048 ground (crisper borders and detail up close); Eco and touch devices
    // keep 1024 (4x less texture memory and paint time).
    const groundSize = this.lowPower || matchMedia("(pointer: coarse)").matches ? 1024 : 2048;
    canvas.width = canvas.height = groundSize;
    const ctx = canvas.getContext("2d");
    // Surfaces, accent patches and painted detail (ground-paint.js); seeded, so identical each build.
    // Plateaus add a lighter top, a bright lip, foot shadows and road ramps (paintPlateaus).
    paintGround(ctx, this.terrain, groundSize, random);
    this.groundCanvas = canvas; // the minimap draws its terrain from this (app/minimap.js)
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.lowPower ? 1 : 4;
    const segments = this.terrain.plateaus.length ? this.terrain.size : 96;
    let groundGeometry = new THREE.PlaneGeometry(this.terrain.size, this.terrain.size, segments, segments);
    if (this.terrain.plateaus.length) {
      const p = groundGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, this.terrain.heightAt(p.getX(i), -p.getY(i)));
      // The rock relief (plateau-relief.js) covers each cliff band; the ground drops under it.
      lowerCliffBand(groundGeometry, this.terrain);
      groundGeometry.computeVertexNormals();
    }
    if (this.terrain.river) {
      const p = groundGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = -p.getY(i);
        // Each river band (maps.json "rivers"; one at z = 0 on the old maps), level across its fords.
        const river = this.terrain.riverNear(z, 4);
        if (river && !river.fords.some((c) => Math.abs(x - c.x) <= c.half))
          p.setZ(i, Math.min(p.getZ(i), -0.5 * Math.min(1, 4 - Math.abs(z - river.z))));
      }
      groundGeometry.computeVertexNormals();
    }
    // Plateau cliffs: lit rock faces and a bright lip, merged into the ground (same material and
    // texture, vertex-coloured), so height reads from the game camera at no extra draw.
    const relief = buildPlateauRelief(this.terrain);
    if (relief) {
      const count = groundGeometry.attributes.position.count;
      groundGeometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
      const merged = mergeGeometries([groundGeometry, relief], false);
      groundGeometry.dispose();
      relief.dispose();
      groundGeometry = merged;
    }
    // Depth bias: building bases, pads and decals sit level with (or millimetres above) the
    // ground, which z-fights and blinks, worst on phones' coarser depth buffers. The biased
    // ground always loses those ties.
    const ground = mesh(groundGeometry, mat(0xffffff, { map: texture, vertexColors: !!relief, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
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
    const fogSegments = this.terrain.plateaus.length ? this.terrain.size / 2 : 1;
    const fogGeometry = new THREE.PlaneGeometry(this.terrain.size, this.terrain.size, fogSegments, fogSegments);
    if (this.terrain.plateaus.length) {
      // Over cliffs the fog rises to cover the rock relief (plateau-relief.js fogLift).
      const p = fogGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.max(this.terrain.heightAt(p.getX(i), -p.getY(i)), fogLift(this.terrain, p.getX(i), -p.getY(i))));
    }
    this.fogMesh = new THREE.Mesh(fogGeometry, material);
    this.fogMesh.rotation.x = -Math.PI / 2;
    this.fogMesh.position.y = 0.15;
    this.fogMesh.renderOrder = 2;
    this.scene.add(this.fogMesh);
  }
  resize() {
    this.canvasRect = null;
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    // Portrait phones run the canvas on under the floating dock (CSS --view-cover, px). The camera
    // frames the uncovered part exactly as before (same scale, focus in its middle); the covered
    // strip just shows more map, so opening or closing a panel never resizes or jumps the view.
    // The same for a strip along the top (--view-cover-top: the floating phone tool row).
    // The covers may be calc() expressions (phone-hud.css): a hidden probe resolves them to pixels.
    if (!this.coverProbe) {
      this.coverProbe = document.createElement("i");
      this.coverProbe.setAttribute("aria-hidden", "true");
      this.coverProbe.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--view-cover-top, 0px) 0 var(--view-cover, 0px)";
      this.container.append(this.coverProbe);
    }
    const probe = getComputedStyle(this.coverProbe), px = (name) => Math.max(0, parseFloat(name === "--view-cover" ? probe.paddingBottom : probe.paddingTop) || 0);
    let cover = px("--view-cover"), coverTop = px("--view-cover-top");
    if (cover + coverTop > height * 0.7) cover = coverTop = 0; // a squashed window: plain framing (0.7: phones now run the canvas under the top bar and the tabs too, 355 of 568 px on a 320 px phone)
    if (width === this.width && height === this.height && cover === this.cover && coverTop === this.coverTop) return;
    this.width = width;
    this.height = height;
    this.cover = cover;
    this.coverTop = coverTop;
    this.frameHeight = height - cover - coverTop;
    this.renderer.setSize(width, height);
    this.updateCamera();
  }
  // While a dock panel is open over the bottom strip, that strip is not drawn at all (render() sets
  // the viewport to the part above it), so phones pay nothing for map nobody can see. The HUD
  // calls this with false when the panel closes; the strip is then drawn as extra map.
  setCoverOpen(open) {
    open = open !== false;
    if (open === (this.coverOpen !== false)) return;
    this.coverOpen = open;
    this.updateCamera();
  }
  // Phones (round 3 kit pass): how much of the bottom cover is under opaque HUD right now (px from the canvas
  // bottom: the dock panel, or the tab strip when no panel is open). Only that much is cut from the drawing, so the
  // map still shows under see-through bars and the gaps above them. Defaults to the whole cover.
  setCoverCrop(px) {
    const crop = Number.isFinite(px) ? Math.max(0, px) : null;
    if (crop === (this.coverCrop ?? null)) return;
    this.coverCrop = crop;
    this.updateCamera();
  }
  // The part of the canvas that shows the map right now, in client pixels (minimap outline).
  visibleRect() {
    const r = this.canvasRect ??= this.renderer.domElement.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + (this.coverTop || 0), bottom: r.top + (this.drawHeight || this.height) };
  }
  updateCamera() {
    const frame = this.frameHeight || this.height, aspect = this.width / frame, perPixel = this.zoom / frame;
    const cover = this.cover || 0, crop = Math.min(cover, this.coverCrop ?? cover);
    const shown = this.coverOpen === false ? cover : cover - crop;
    this.drawHeight = this.height - (this.cover || 0) + shown;
    this.camera.left = (-this.zoom * aspect) / 2;
    this.camera.right = (this.zoom * aspect) / 2;
    this.camera.top = this.zoom / 2 + (this.coverTop || 0) * perPixel;
    this.camera.bottom = -this.zoom / 2 - shown * perPixel;
    this.camera.position.copy(this.focus).add(CAMERA_OFFSET);
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // Vitals bars and selection rings keep a readable size on small screens: a unit's bar
    // is never under about 30 px wide (a phone shows as little as 11 px per world unit).
    const pixels = frame / this.zoom, grow = clamp(30 / (1.43 * pixels), 1, 1.9);
    this.barScale = grow;
    this.barTall = 1 + 0.35 * Math.min(1, (grow - 1) * 2);
    this.unitsPerPixel = 1 / pixels;
    // Shadow frustum: cover the farthest visible ground corner (the tilted view reaches about
    // VIEW_DEPTH x zoom deep), then snap its centre to whole shadow texels in light space so
    // shadow edges do not shimmer while the camera pans.
    // (The strip under a phone's dock reaches nearer the camera: grow the depth to match.)
    const half = Math.min(130, this.zoom * Math.hypot(aspect / 2, VIEW_DEPTH * (this.height / frame)) + 6),
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
    // A match may allow a wider view (Frontier Defence's Overview sets maxZoom; reset clears it).
    this.zoom = clamp(this.zoom + delta, 22, this.maxZoom || 88);
    this.updateCamera();
  }
  focusOn(x, z) {
    this.focus.set(clamp(x, -this.terrain.half+6, this.terrain.half-6), 0, clamp(z, -this.terrain.half+6, this.terrain.half-6));
    this.updateCamera();
  }
  point(clientX, clientY, rect = this.renderer.domElement.getBoundingClientRect()) {
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / (this.drawHeight || rect.height)) * 2 + 1,
      ),
      this.camera,
    );
    const p = new THREE.Vector3();
    let hit = this.raycaster.ray.intersectPlane(this.plane, p);
    if (hit && this.terrain.plateaus.length) {
      // Two refinements against the height field are enough for 2.4 m plateaus.
      for (let k = 0; k < 2; k++) {
        const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.terrain.heightAt(p.x, p.z));
        const q = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(level, q)) p.copy(q);
      }
    }
    return hit
      ? { x: clamp(p.x, -this.terrain.half+1, this.terrain.half-1), z: clamp(p.z, -this.terrain.half+1, this.terrain.half-1) }
      : null;
  }
  project(x, z, y = 0) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.width,
      y: ((1 - p.y) / 2) * (this.drawHeight || this.height),
    };
  }
  // The world height to aim at for an entity on screen: a flyer's drawn altitude (plus half its
  // body), otherwise `fallback`. Used by picking, drag boxes and the HUD's screen positions.
  liftOf(e, fallback = 1) {
    const air = e?.flying && this.objects.get(e.id)?.userData.air;
    return air ? (air.y ?? this.terrain.heightAt(e.x, e.z) + air.fly) + air.top * 0.4 : fallback;
  }
  pick(clientX, clientY, sim, minRadius = 14) {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      x = clientX - rect.left,
      y = clientY - rect.top;
    // The drawn part of the canvas (portrait phones leave the strip under an open dock undrawn,
    // setCoverOpen): normalised the same way as point() and project(), or rays miss the models.
    this.raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-y/(this.drawHeight || rect.height)*2+1),this.camera);
    const candidates = sim.entities.filter(e => e.hp > 0 && sim.isVisible(e) && this.objects.has(e.id));
    const meshes = candidates.map(e => this.objects.get(e.id).userData.model);
    const hits = this.raycaster.intersectObjects(meshes,true);
    // A unit under the pointer wins over a building the same ray also crosses (a Harvester parked
    // at a Refinery, infantry in front of a Factory), as in most RTS games.
    let building = null;
    for (const hit of hits) {
      let node = hit.object;
      while (node && !meshes.includes(node)) node = node.parent;
      if (!node) continue;
      const e = candidates[meshes.indexOf(node)];
      if (e.kind === "unit") return e;
      building ||= e;
    }
    if (building) return building;
    let best = null,
      score = Infinity;
    for (const e of [...sim.entities, ...sim.resources]) {
      // Explored deposits stay drawn under fog, so they must stay targetable for gathering.
      const shown = e.kind === "resource" ? this.resourceObjects.get(e.id)?.visible : sim.isVisible(e);
      if (!shown || e.amount === 0 || e.hp <= 0) continue;
      const p = this.project(
        e.x,
        e.z,
        e.flying ? this.liftOf(e) : e.kind === "building" ? 1.8 : e.kind === "resource" ? 1 : 0.9,
      );
      const d = Math.hypot(p.x - x, p.y - y),
        radius = Math.max(
          minRadius,
          (e.radius + 0.6) / this.unitsPerPixel,
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
    if (e.axis) {
      const model = new THREE.Group(), [concrete, trim] = this.wallTemplate();
      this.straightWall ||= [new THREE.BoxGeometry(2.04, 1.7, 1.1).translate(0, 0.85, 0), new THREE.BoxGeometry(2.06, 0.12, 1.14).translate(0, 1.2, 0)];
      const block = new THREE.Mesh(this.straightWall[0], concrete.material), band = new THREE.Mesh(this.straightWall[1], trim.material);
      block.castShadow = block.receiveShadow = band.receiveShadow = true;
      model.add(block, band);
      model.rotation.y = e.axis === "v" ? Math.PI / 2 : 0;
      adoptBatchedParts(model);
      return model;
    }
    const model = new THREE.Group(), inner = new THREE.Group();
    for (const part of this.wallTemplate()) inner.add(part.clone());
    inner.rotation.y = (e.x * 0.37 + e.z * 0.61) % Math.PI;
    inner.scale.set(e.radius, 1, e.radius);
    model.add(inner);
    adoptBatchedParts(model);
    return model;
  }
  // Aircraft can take off before the optional GLB arrives, including during offline play.
  // A swept wing and canopy share the same altitude, picking and selection logic as its replacement.
  fallbackFlyer(team) {
    const key = `fallback-flyer-${team}`;
    if (!this.teamTemplates.has(key)) {
      const wing = new THREE.Shape();
      wing.moveTo(0, 1.65);
      wing.lineTo(-1.45, -0.9);
      wing.lineTo(0, -0.48);
      wing.lineTo(1.45, -0.9);
      wing.closePath();
      const geometry = new THREE.ExtrudeGeometry(wing, { depth: 0.22, bevelEnabled: false });
      geometry.rotateX(Math.PI / 2);
      const paint = mat(this.colors[team]);
      paint.name = "Team";
      // The offline wing has no authored panels. Paint its centre stripe in
      // local coordinates so it follows the airframe using the existing draw.
      paint.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWingStripe;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWingStripe = position.x + 0.15 * position.z;");
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWingStripe;")
          .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.35, 1.0, smoothstep(0.16, 0.18, abs(vWingStripe)));");
      };
      const template = new THREE.Group();
      template.name = "FallbackFlyer";
      template.add(new THREE.Mesh(geometry, paint));
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(0x283b46));
      canopy.scale.set(0.24, 0.2, 0.57);
      canopy.position.z = 0.27;
      template.add(canopy);
      adoptBatchedParts(template);
      this.teamTemplates.set(key, template);
    }
    return this.teamTemplates.get(key);
  }
  createEntity(e) {
    const root = new THREE.Group();
    const template = this.teamTemplates.get(`${e.type}-${e.team}`);
    const model = e.kind === "wall" ? this.createWallModel(e) : (template || this.fallbackFlyer(e.team)).clone(true);
    root.add(model);
    // Unit disc, scaled per instance: all ground footprints share one draw.
    this.contactShadowGeometry ??= new THREE.CircleGeometry(1, 20);
    const contactShadow = new THREE.Mesh(this.contactShadowGeometry, this.contactShadowMaterial);
    contactShadow.scale.setScalar(e.radius * 1.25);
    contactShadow.layers.set(SOURCE_LAYER);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.07;
    contactShadow.visible = this.lowPower;
    root.add(contactShadow);
    root.userData.contactShadow = contactShadow;
    if (e.flying) this.prepareFlyer(e, root, model, contactShadow);
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
      // The framed height (a phone's canvas also runs under the tool row and the dock).
      const height = (max-min) * (this.frameHeight || this.renderer.domElement.getBoundingClientRect().height) / this.defaultZoom;
      const infantry = !e.mechanical && !e.flying;
      const targetPixels = infantry ? 32 : FEEL.minPixels;
      root.userData.readabilityScale = Math.min(infantry ? 1.4 : FEEL.maxModelScale, Math.max(1, targetPixels / Math.max(height, Number.EPSILON)));
    }
    // View plugins' static scale, after the clamp (it may pass maxModelScale); exactly 1 without one.
    const pluginScale = this.plugins.scaleFor(e);
    root.userData.readabilityScale *= pluginScale;
    root.userData.barrel=model.getObjectByName('BarrelRig');
    root.userData.turret=model.getObjectByName('TurretRig');
    root.userData.recoil=0;
    root.userData.kick=0;root.userData.kickSize=0;
    root.userData.gait=0;root.userData.stride=(e.id*0.7)%6.28;
    root.userData.pop=0;root.userData.built=e.complete!==false;
    root.userData.team = e.team;
    // Story missions and faction skirmishes: a faction emblem floats over each building (the player's
    // own faction for team 0: Meridian in the story, the skirmish choice otherwise). Crewed Defence
    // towers carry none (one sprite draw each).
    if (e.kind === "building" && this.mission?.factions && !e.crew) {
      const faction = factionOf(this.mission, e.team)?.id || (e.team === 0 ? "meridian" : undefined);
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
    // Per-entity anchors feed the two shared selection batches.
    const side = e.team >= 0 ? this.colors[e.team] : 0xb8b2a4; // walls are neutral grey
    const ring = createRing(e.radius, side);
    root.add(ring);
    root.userData.ring = ring;
    const bar = createBar(e, side);
    root.add(bar);
    root.userData.bar = bar;
    bar.position.y *= root.userData.readabilityScale;
    if (e.boss) this.bosses.dress(root, e);
    // BossView.dress puts a boss's bar at its own height: a plugin's static scale lifts it too (x1 without one).
    if (e.boss) bar.position.y *= pluginScale;
    // A flyer's bar rides above it: its fly height plus its own height (set again as it flies).
    if (root.userData.air) root.userData.air.barY = bar.position.y = root.userData.air.top * root.userData.readabilityScale + 0.7;
    this.plugins.dress(root, e);
    cacheTransforms(root);
    this.scene.add(root);
    this.objects.set(e.id, root);
    return root;
  }
  // A view plugin's per-frame scale (frameScaleFor) lifts the vitals bar with the model: a flyer's from
  // its own top (its fly height is already in the bar), anything else's from the bar's height at
  // scale 1, read the first time a plugin scales it (u.barRest).
  scaleBar(u, frame) {
    if (u.air) { u.bar.position.y += u.air.top * u.readabilityScale * (frame - 1); return; }
    u.barRest ??= u.bar.position.y;
    u.bar.position.y = u.barRest * frame;
  }
  // Flyers (0.18, sim/air.js): the model rides at its fly height (balance.json `fly`) above the
  // highest ground near it; rotors spin and the balloon's flame flickers per instance (their
  // pivots are separate nodes, see MOVING_PART); a soft blob on the ground shows where it is.
  // Every flyer's blob shares one geometry and material, so all of them are one instanced draw.
  prepareFlyer(e, root, model, blob) {
    const air = { fly: D[e.type].fly || 3.5, y: null, spins: [], flames: [], clock: (e.id * 0.37) % 6.28, top: 1.5, barY: 0 };
    model.rotation.order = "YXZ"; // heading, then a pitch about the craft's own axis
    model.traverse((o) => {
      if (o.name.startsWith("spin_")) air.spins.push({ node: o, base: o.quaternion.clone(), axis: /^spin_prop/.test(o.name) ? AXIS_Z : AXIS_Y, rate: /^spin_prop/.test(o.name) ? 34 : 26 });
      else if (o.name.startsWith("flicker_")) air.flames.push({ node: o, base: o.scale.y });
    });
    this.flyerTops ||= new Map();
    const topKey = model.name === "FallbackFlyer" ? model.name : e.type;
    let top = this.flyerTops.get(topKey);
    if (top === undefined) this.flyerTops.set(topKey, (top = new THREE.Box3().setFromObject(model).max.y - root.position.y));
    air.top = top;
    if (!this.airShadow) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d"), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.6, "rgba(255,255,255,0.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      const map = new THREE.CanvasTexture(canvas);
      this.airShadow = {
        geometry: new THREE.CircleGeometry(1, 20),
        material: new THREE.MeshBasicMaterial({ color: 0x050c08, map, transparent: true, opacity: 0.58, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }),
      };
    }
    blob.geometry = this.airShadow.geometry;
    blob.material = this.airShadow.material;
    blob.scale.setScalar(e.radius * 1.5);
    blob.visible = true;
    root.userData.air = air;
  }
  // Per frame: altitude (eased over plateau rims), rotor spin, flame flicker. Returns the lift
  // above the root (which stays on the ground with the blob shadow).
  stepFlyer(u, x, z, ground, dt, lively) {
    const a = u.air, t = this.terrain;
    let high = ground;
    if (t.plateaus.length) for (const [dx, dz] of FLY_SAMPLES) high = Math.max(high, t.heightAt(x + dx, z + dz));
    const want = high + a.fly;
    a.y = a.y === null ? want : a.y + (want - a.y) * Math.min(1, dt * 2.5);
    if (lively && dt > 0) a.clock = (a.clock + dt) % 600;
    for (const s of a.spins) s.node.quaternion.copy(s.base).multiply(SPIN.setFromAxisAngle(s.axis, lively ? (a.clock * s.rate) % (Math.PI * 2) : 0.6));
    for (const f of a.flames) f.node.scale.y = f.base * (lively ? 0.82 + 0.22 * Math.sin(a.clock * 17) + 0.1 * Math.sin(a.clock * 31 + 1.3) : 1);
    return a.y - ground;
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
  shakeEnabled() { return false; }
  feelEnabled() { return this.settings.combatMotion !== false && !this.reducedMotion.matches && !this.cameraCue; }
  onScreen(event) {
    const p = new THREE.Vector3(event.x, 0, event.z).project(this.camera);
    return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1;
  }
  event(event, sim) {
    this.bosses.event(event, sim);
    const enabled = this.feelEnabled();
    if (Number.isFinite(event.x) && Number.isFinite(event.z) && sim.isVisible(event)) {
      const trauma = event.type === 'strike' ? FEEL.barrageTrauma : event.type === 'death' ? (event.core ? FEEL.coreTrauma : event.building ? FEEL.buildingTrauma : 0) : 0;
      if (trauma) this.shake.add(trauma, Math.hypot(event.x-this.focus.x,event.z-this.focus.z), this.shakeEnabled());
      if (enabled && event.type === 'death' && event.core && this.onScreen(event)) this.hitStop = FEEL.stopSeconds;
      if (enabled && event.type === 'strike' && (event.victims || []).filter(v => sim.isVisible(v) && this.onScreen(v)).length >= FEEL.stopKills) this.hitStop = FEEL.stopSeconds;
      if (event.type === 'impact') {
        const o = this.objects.get(event.seed);
        if (o) {
          o.userData.flash = FEEL.flashSeconds;
          // The model flashes too (per-instance tint), timed below to the round's arrival.
          startFlash(o.userData, 0, event.shield);
          o.userData.flashX = event.x; o.userData.flashZ = event.z;
          if (this.flashBatchTime !== sim.time) { this.flashBatch.length = 0; this.flashBatchTime = sim.time; }
          this.flashBatch.push(o.userData);
        }
      }
    }
    // Rules apply damage when a round is fired: a hit flash from the same tick waits until the
    // drawn round lands (the target and anything in its splash).
    if (event.type === 'shot' && this.flashBatchTime === sim.time && Number.isFinite(event.tx)) {
      const travel = weaponStyle(event).life;
      for (const u of this.flashBatch)
        if (u.flashWait >= 0 && Math.hypot(u.flashX - event.tx, u.flashZ - event.tz) < 3.5) u.flashWait = travel;
    }
    // Rules resolve shells immediately; the existing shot event carries the landing point.
    if (FEEL.shellTrauma && event.type === 'shot' && ['tank','breaker'].includes(event.weapon) && shotVisible(event,sim))
      this.shake.add(FEEL.shellTrauma, Math.hypot(event.tx-this.focus.x,event.tz-this.focus.z), this.shakeEnabled());
    this.activity.event(event, sim);
    this.tactics.event(event, sim);
    // The shooter recoils whenever the shooter itself is in view, even if the path is fogged.
    if(event.type==='shot' && sim.isVisible({x:event.x,z:event.z})){
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
    this.plugins.event(event, sim);
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
    const kind = event.building ? 'building' : o.userData.air ? 'air' : event.heavy ? 'vehicle' : 'infantry';
    const model = o.userData.model;
    if (o.userData.flashLit) this.setFlashTint(o.userData, false);
    if (o.userData.emblem) o.userData.emblem.visible = false;
    model.rotation.order = 'YXZ';
    // Wrecks lose their paint, team colour and lights so a dead tank reads as dead at a
    // glance: every part is tinted burnt per instance (same batches, no extra draws) and
    // glowing parts go dark.
    if (kind !== 'infantry') {
      model.traverse?.((part) => {
        if (!part.isMesh) return;
        const glow = part.material?.emissive && part.material.emissiveIntensity > 0 && part.material.emissive.getHex() !== 0;
        if (glow) part.visible = false;
        else part.userData.tint = WRECK_TINT;
      });
    }
    // R3-K: `look` (combat-feedback.js DEATH_LOOK) is settled by the DeathLooks plugin once the frame's
    // killing shot is known (0 until then); `id` lets it find the shot.
    this.dying.push({ id: event.seed, look: 0, baseY: o.position.y, object: o, kind, team: event.team, age: 0, x: o.position.x, z: o.position.z, tilt: (event.seed % 2 ? 1 : -1), lift: model.position?.y ?? 0,
      life: { building: 2.8, vehicle: this.lowPower ? FEEL.ecoWreckSeconds : FEEL.wreckSeconds, air: this.lowPower ? FEEL.ecoWreckSeconds : FEEL.wreckSeconds, infantry: 1.6 }[kind], baseAngle: model.rotation.y, direction: event.direction ?? model.rotation.y });
  }
  // Hit flash (combat-feedback.js stepFlash): every model part shares one tint array that the
  // batches copy into instanceColor, so a flash costs no material, batch or draw call. Off
  // with combat motion; paused frames hold it.
  stepHitFlash(u, e, dt) {
    u.flashTint ||= [1, 1, 1];
    const lit = stepFlash(u, dt, u.flashTint, e.kind === 'unit' ? 1 : HIT_FLASH.building) && this.activity.combat.motion;
    if (lit !== !!u.flashLit) this.setFlashTint(u, lit);
  }
  setFlashTint(u, lit) {
    if (!u.flashParts) {
      u.flashParts = [];
      u.model?.traverse?.((part) => { if (part.isMesh) u.flashParts.push(part); });
      u.flashBase = u.flashParts.map((part) => part.userData.tint);
    }
    for (let i = 0; i < u.flashParts.length; i++) u.flashParts[i].userData.tint = lit ? u.flashTint : u.flashBase[i];
    u.flashLit = lit;
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
        // A heavy collapse: a shudder, then a slow start that accelerates into the ground
        // while the structure keels over to one side.
        const shake = motion ? Math.max(0, 1 - t / 1.1) * 0.14 : 0;
        o.position.set(d.x + Math.sin(t * 61) * shake, d.baseY - heavy((t - 0.35) / 2.35) * 5.6, d.z + Math.cos(t * 53) * shake);
        m.rotation.z = d.tilt * heavy((t - 0.4) / 2.2) * 0.26;
        m.rotation.x = d.tilt * heavy((t - 0.4) / 2.2) * 0.11;
      } else if (d.kind === 'air') {
        // A shot-down flyer drops from its altitude, turning and rolling, then settles as a wreck.
        const fall = clamp01(t / 0.9);
        m.position.y = d.lift * (1 - fall * fall);
        // R3-X: it spins down (about one full turn on the way) under the smoke trail drawn by src/fx.js airWrecks.
        m.rotation.y = d.baseAngle + (motion ? d.tilt * (ease(t / 0.9) * 1.6 + Math.min(t, 0.9) * 6.5) : 0);
        m.rotation.z = d.tilt * ease(t / 0.9) * 0.45;
        m.rotation.x = 0.2 * ease(t / 0.9);
        o.position.y = d.baseY - ease((t - (d.life - 0.9)) / 0.9) * 1.8;
      } else if (d.kind === 'boss') {
        this.bosses.fall(d, t, motion);
      } else if (d.kind === 'vehicle') {
        // R3-K death looks: a blast throws the wreck higher, rolls it further and turns it; a seared
        // wreck does not hop, it shudders and settles lower. Motion off: the same final poses, no throw.
        const blast = d.look === 2, seared = d.look === 3;
        const hop = motion && !seared ? Math.sin(Math.min(1, t / (blast ? 0.6 : 0.45)) * Math.PI) * (blast ? 1.05 : 0.55) : 0;
        const shudder = motion && seared ? Math.sin(t * 57) * Math.max(0, 1 - t / 0.5) * 0.06 : 0;
        o.position.y = d.baseY + hop - ease((t - (d.life - 0.9)) / 0.9) * 1.8 - (seared ? ease(t / 0.8) * 0.18 : 0);
        if (seared) o.position.x = d.x + shudder;
        m.rotation.z = d.tilt * ease(t / (blast ? 0.6 : 0.45)) * (blast ? 0.42 : seared ? 0.08 : 0.18);
        m.rotation.x = -ease(t / 0.45) * (blast ? 0.22 : 0.1);
        if (blast && motion) m.rotation.y = d.baseAngle + d.tilt * ease(t / 0.6) * 0.5;
      } else if (d.look === 2 && motion) {
        // R3-K: thrown back along the shot, landing flat (d.direction points from the killer to the unit).
        const k = ease(t / 0.55), hop = Math.sin(Math.min(1, t / 0.55) * Math.PI) * 0.6;
        m.rotation.y = d.direction;
        m.rotation.x = -ease(t / 0.45) * 1.55;
        m.rotation.z = d.tilt * k * 0.35;
        o.position.set(d.x + Math.sin(d.direction) * k * 1.4, d.baseY + hop - ease((t - 0.9) / 0.7) * 1.2, d.z + Math.cos(d.direction) * k * 1.4);
      } else if (d.look === 3) {
        // R3-K: seared where it stands, a stiff shudder then a crumple onto its knees and down.
        const shake = motion ? Math.sin(t * 63) * Math.max(0, 1 - t / 0.35) * 0.08 : 0;
        m.rotation.y = d.direction + shake;
        m.rotation.x = -ease((t - 0.25) / 0.7) * 1.3;
        o.position.y = d.baseY - ease(t / 0.9) * 0.25 - ease((t - 0.9) / 0.7) * 1.0;
      } else {
        m.rotation.y = d.direction;
        m.rotation.x = -ease(t / FEEL.fallSeconds) * 1.45;
        o.position.y = d.baseY - ease((t - 0.9) / 0.7) * 1.2;
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
    this.mood?.update(sim);
    if (this.life) {
      this.life.quiet = this.reducedMotion.matches;
      this.life.update(dt, this.camera, (this.drawHeight || this.height) * this.renderer.getPixelRatio());
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
    // Frontier Defence limits enemy vitals to the weakest twelve for readability.
    const bars = sim.defence ? weakest(sim, 12) : null;
    for (const e of sim.entities) {
      let o = this.objects.get(e.id);
      if (e.flying && o?.userData.model.name === "FallbackFlyer" && this.models.has(e.type)) {
        this.disposeEntity(o);
        o = null;
      }
      if (!o) {
        if (!e.flying && e.kind !== "wall" && !this.teamTemplates.has(`${e.type}-${e.team}`)) continue;
        o = this.createEntity(e);
      }
      alive.add(e.id);
      const u=o.userData;
      u.recoil=Math.max(0,u.recoil-dt);u.kick=Math.max(0,u.kick-dt);
      if (u.flashWait >= 0 || u.flashLeft > 0 || u.flashLit) this.stepHitFlash(u, e, dt);
      // Walls are neutral and see nothing: keep them drawn once explored, like the minimap does.
      o.visible = e.kind === "wall" ? sim.isExplored(e) : sim.isVisible(e);
      if (!o.visible) continue;
      let p = e.kind === "unit" && interpolate ? this.previous.get(e.id) : null;
      // No unit covers more than ~0.3 units per tick; a larger jump is a teleport.
      if (p && Math.hypot(e.x - p.x, e.z - p.z) > 1) p = null;
      const m = o.userData.model;
      if (p) {
        const ix = p.x + (e.x - p.x) * alpha, iz = p.z + (e.z - p.z) * alpha;
        o.position.set(ix, this.terrain.heightAt(ix, iz), iz);
        const turn = Math.atan2(Math.sin(e.angle - p.angle), Math.cos(e.angle - p.angle));
        m.rotation.y = p.angle + turn * alpha;
      } else {
        o.position.set(e.x, this.terrain.heightAt(e.x, e.z), e.z);
        m.rotation.y = e.kind === "unit" ? e.angle : e.team === 0 ? 0 : Math.PI;
      }
      if(u.turret){
        // Vehicles: the hull keeps its heading while the turret swings to the target (turn-rate limited, shortest way).
        if(e.moving||u.hullYaw===undefined)u.hullYaw=m.rotation.y;else m.rotation.y=u.hullYaw;
        const aim=e.attacking?e.angle-m.rotation.y:0,diff=Math.atan2(Math.sin(aim-u.turret.rotation.y),Math.cos(aim-u.turret.rotation.y));
        const step=this.activity.combat.motion&&!this.reducedMotion.matches?3*dt:Math.PI;
        u.turret.rotation.y+=Math.max(-step,Math.min(step,diff));
      }
      // Frontier Defence: a crewed tower carries its crew (dressEntity, app/defence-ui.js), facing its
      // target; the commander wears gold trims (tints only, the batches keep their materials).
      if ((e.crew || e.hero) && u.dressed !== dressKey(e)) this.dressEntity?.(o, e);
      if (u.crew) u.crew.rotation.y = e.angle;
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
      // View plugins' scale this frame (exactly 1 without one), applied with the readability scale.
      const frame = this.plugins.frameScaleFor(e, u, this);
      if (u.air) {
        // Flyers: up at their altitude, nose down in forward flight; ring and bar ride with them.
        const air = this.stepFlyer(u, o.position.x, o.position.z, o.position.y, dt, lively);
        lift += air;
        // R3-W (air-motion.js): bank into turns and lift the nose on a climb, on top of the forward-flight nose-down.
        airMotion(u.air, e.type, m.rotation.y, u.air.y ?? 0, dt, lively && this.settings.combatMotion !== false);
        m.rotation.x = Math.min(1, u.gait) * 0.14 + u.air.pitch;
        u.ring.position.y = air + 0.12;
        u.bar.position.y = u.air.barY + air;
      }
      m.position.set(back ? -Math.sin(m.rotation.y) * back : 0, lift, back ? -Math.cos(m.rotation.y) * back : 0);
      m.scale.set(1 + squash * 0.5, (e.complete ? 1 : 0.15 + e.progress * 0.85) + squash, 1 + squash * 0.5);
      m.scale.multiplyScalar(u.readabilityScale * frame);
      if (frame !== 1 || u.barRest !== undefined) this.scaleBar(u, frame);
      m.rotation.z = u.air ? u.air.bank : isHarvesting(sim,e) && !this.reducedMotion.matches ? Math.sin(sim.time*7+e.id)*0.045 : 0;
      for (let i = 0; i < u.legs.length; i++) {
        const leg = u.legs[i];
        leg.node.quaternion.copy(leg.base);
        if (u.gait > 0)
          leg.node.rotateX(Math.sin(u.stride + i * Math.PI) * 0.46 * u.gait);
      }
      updateRing(u.ring, selected.has(e.id), hover?.id === e.id, sim.time, dt, this.unitsPerPixel);
      const bar = u.bar;
      bar.visible =
        selected.has(e.id) || hover?.id === e.id || ((e.hp < e.maxHp || e.shield < e.maxShield) && (!bars || e.team === 0 || bars.has(e.id)));
      if (bar.visible) {
        bar.quaternion.copy(this.camera.quaternion);
        bar.scale.set(bar.userData.base * this.barScale, bar.userData.base * this.barScale * this.barTall, 1);
      }
      // R3-X: while a drawn round is still flying at this unit (its hit flash waits, flashWait), the bar keeps the
      // health it had, so the bar drops, flashes and the model flashes together when the round lands.
      const inbound = u.flashWait > 0 && this.activity.combat.motion;
      updateBar(bar, e, dt, inbound);
      if (!inbound) u.flash = Math.max(0, (u.flash || 0)-realDt);
      const flash = !inbound && u.flash > 0 && this.settings.combatMotion !== false && !this.reducedMotion.matches;
      u.ring.userData.flash = bar.userData.flash = flash ? 1 : 0;
      if (flash) { u.ring.visible = bar.visible = true; u.ring.userData.appear = 1; }

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
    this.bosses.update(sim, dt);
    this.updateDying(sim, dt);
    this.fx.update(sim, dt);
    this.tactics.update(sim, dt, selected);
    this.plugins.update(sim, dt);
    // Story missions: a ground ring at each capture point.
    if (sim.mission || sim.capturePointsOn || this.captureRings) {
      this.captureRings ||= new CaptureRings(this.scene);
      this.captureRings.update(sim, this.colors, this.lowPower || this.motionLevel === 0 || this.reducedMotion.matches);
    }
    // Where an escort or a "reach" objective must go: a gold ring and a beam of light.
    if (sim.mission || this.destinations) {
      this.destinations ||= new DestinationMarkers(this.scene, this.terrain);
      this.destinations.update(sim, this.motionLevel === 0 || this.reducedMotion.matches);
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
    this.selectionBatches ??= new SelectionBatches(this.scene);
    for (const o of this.objects.values()) {
      this.batches.collect(o);
      this.selectionBatches.collect(o);
    }
    this.selectionBatches.finish();
    for (const d of this.dying) this.batches.collect(d.object);
    for (const o of this.resourceObjects.values()) this.batches.collect(o);
    this.batches.end();
    this.scene.matrixWorldAutoUpdate = false;
    // Draw only the part not under an open dock panel (setCoverOpen); setSize() resets the viewport.
    const drawn = this.drawHeight || this.height;
    this.renderer.setViewport(0, this.height - drawn, this.width, drawn);
    try { this.renderer.render(this.scene, this.camera); }
    finally {
      this.scene.matrixWorldAutoUpdate = true;
    }
    this.activity.draw(sim,dt,selected,hover);
  }
  disposeEntity(o) {
    this.scene.remove(o);
  }
  reset() {
    this.fx.rng = mulberry32(1482); // cosmetic effects only: a fixed per-match generator (no Math.random in the sim)
    if (this.life && this.life.aliveCount < this.life.groups.reduce((n, g) => n + g.rows.length, 0)) this.createLife();
    this.activity.reset();
    this.tactics.reset();
    this.bosses.reset();
    this.environment?.reset();
    this.scatter?.restore();
    for (const o of this.objects.values()) this.disposeEntity(o);
    this.objects.clear();
    for (const d of this.dying) this.disposeEntity(d.object);
    this.dying = [];
    // Empty the entity batches too: until the new match's first update they would still draw the last
    // frame's instances (the old map's buildings, for a frame or until its models load).
    this.batches.begin();
    this.batches.end();
    this.selectionBatches?.finish();
    this.flashBatch.length = 0;
    this.flashBatchTime = -1;
    this.shake = new CameraShake();
    this.hitStop = 0;
    this.cameraCue = false;
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
    this.destinations?.dispose();
    this.destinations = null;
    this.focusOn(
      this.defaultZoom === ECO_ZOOM ? -25 : -20,
      this.defaultZoom === ECO_ZOOM ? 21 : 19,
    );
    this.zoom = this.defaultZoom;
    this.maxZoom = null;
    this.updateCamera();
    this.fogClock = 0;
    this.plugins.reset();
  }
}
// What a Frontier Defence entity is dressed as: the commander, or a garrison's tier (and branch,
// and since 0.24 its rank; app/defence-ui.js dress() writes the same key).
export const dressKey = (e) => (e.hero ? "hero" : e.branch ? `${e.tier}${e.branch}${e.branchRank || ""}` : e.tier);
// The ids of the n enemy units with the lowest share of health left (damaged ones only).
function weakest(sim, n) {
  const hurt = [];
  for (const e of sim.entities) if (e.team > 0 && e.kind === "unit" && e.hp > 0 && (e.hp < e.maxHp || e.shield < e.maxShield)) hurt.push(e);
  if (hurt.length > n) hurt.sort((a, b) => (a.hp + a.shield) / (a.maxHp + a.maxShield) - (b.hp + b.shield) / (b.maxHp + b.maxShield) || a.id - b.id);
  return new Set(hurt.slice(0, n).map((e) => e.id));
}
