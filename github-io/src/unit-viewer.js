// The Field Guide's 3D view (W5, 2026-11-25): one small WebGL renderer showing a unit's real model, built from
// the game's own model cache (WorldView.teamTemplates: the same merged parts, baked finishes, team paint, rim
// and shader bones), and posed with the game's own motion code (unit-rig.js, air-motion.js). Loaded lazily by
// field-guide.js the first time a guide page opens, so none of this is in the main bundle.
//
// Ownership: the cached templates, their geometry buffers and their materials belong to the game and are never
// disposed here. Each preview draws through its own geometry wrappers (sharing the cached vertex buffers, plus
// one pose attribute) and its own material copies, so this renderer never registers a listener on the game's
// objects; dispose() frees exactly what this file made, then releases the WebGL context.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DEFINITIONS as D } from "./data.js";
import { FACTIONS } from "./story/world.js";
import { PRESETS } from "./settings.js";
import { weaponStyle } from "./visual-style.js";
import { FEEL } from "./camera-shake.js";
import { airParts, poseAirParts } from "./air-motion.js";
import { KNEELERS, GAIT, BARREL_POSES, RECOIL, newGun, fireBarrel, stepBarrel, poseBarrel, stepInfantry, stepHull, approach,
  barrelKick, bodyKick, kickSize, poseTurretOnHull, swingLegs } from "./unit-rig.js";
import { ORBIT, fitDistance, clampOrbit, dragOrbit, pinchZoom, wheelZoom, orbitOffset, isDoubleTap, colourCycle, motionsFor } from "./unit-viewer-math.js";

const TEXTURES = ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "bumpMap", "lightMap"];
const reflects = (m) => m.metalness >= 0.5 || m.roughness <= 0.25; // view.js applyReflections
const SUN = new THREE.Vector3(-25, 55, 20).normalize(); // view.js SUN_OFFSET
const FIRE_AIM = 0.55; // Fire: the turret swings this far (radians) to a target off the bow
const HOVER = 1.3; // flyers float this high over the plate (their real fly height would shrink the model)
const hexOf = (c) => new THREE.Color(c).getHex();

// Asked once per page load; the probe context is released at once.
let webgl = null;
export const supportsWebGL = () => {
  if (webgl === null) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { webgl = false; }
  }
  return webgl;
};

// One preview model: a clone of a cached template drawn through this renderer's own wrappers and materials.
function buildPreview(template, env) {
  const model = template.clone(true);
  const own = { geometries: [], materials: [], textures: [], paints: [] };
  const motion = new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0, 1]), 4);
  motion.setUsage(THREE.DynamicDrawUsage);
  const copies = new Map();
  const copy = (src) => {
    if (copies.has(src)) return copies.get(src);
    const m = src.clone();
    // Material.copy keeps neither hook: the game's patches (baked finish, rim, team rim, shader bones) come along.
    m.customProgramCacheKey = src.customProgramCacheKey;
    m.onBeforeCompile = src.onBeforeCompile;
    for (const key of TEXTURES) if (m[key]?.isTexture) { m[key] = m[key].clone(); own.textures.push(m[key]); }
    if (m.isMeshStandardMaterial) {
      m.envMap = reflects(m) ? env : null;
      if (m.envMap) m.envMapIntensity = 0.6;
    }
    if (src.name.startsWith("Team")) {
      // Team rim: this copy's own colour (the game's rim colour object stays with the game's material).
      const rim = new THREE.Color(), before = src.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => { before.call(src, shader, renderer); if (shader.uniforms.uRimColor) shader.uniforms.uRimColor = { value: rim }; };
      own.paints.push({ m, rim, glow: src.name.startsWith("TeamGlow") });
    }
    copies.set(src, m);
    own.materials.push(m);
    return m;
  };
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  let rigged = 0;
  for (const o of meshes) {
    const g = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(o.geometry.attributes)) g.setAttribute(name, attribute);
    g.setIndex(o.geometry.index);
    for (const group of o.geometry.groups) g.addGroup(group.start, group.count, group.materialIndex);
    own.geometries.push(g);
    const material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
    let mesh = o;
    if (g.getAttribute("aRig")) {
      // Shader bones read a per-instance pose: one instance, the same pose attribute for every rigged part.
      g.setAttribute("aMotion", motion);
      mesh = new THREE.InstancedMesh(g, material, 1);
      mesh.setMatrixAt(0, new THREE.Matrix4());
      mesh.name = o.name;
      mesh.position.copy(o.position); mesh.quaternion.copy(o.quaternion); mesh.scale.copy(o.scale);
      o.parent.add(mesh);
      o.removeFromParent();
      rigged++;
    } else { o.geometry = g; o.material = material; }
    mesh.layers.set(0); // the game draws its parts through batches (SOURCE_LAYER); this view draws them directly
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
  }
  return { model, own, motion, rigged };
}
function disposePreview(p) {
  if (!p) return;
  p.model.removeFromParent();
  p.model.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  p.own.geometries.forEach((g) => g.dispose());
  p.own.materials.forEach((m) => m.dispose());
  p.own.textures.forEach((t) => t.dispose());
}

// A unit's motion state, the subset of view.js's per-entity userData this view needs.
function motionState(type, model) {
  const def = D[type] || {}, rig = model.userData.rig;
  const legs = [];
  model.traverse((o) => { if (o.name.startsWith("leg_")) legs.push({ node: o, base: o.quaternion.clone() }); });
  const turret = model.getObjectByName("TurretRig"), barrel = model.getObjectByName("BarrelRig");
  const pose = BARREL_POSES.get(type);
  const air = def.flying ? airParts(model, { spins: [], flames: [], clock: 0, hover: 0 }) : null;
  return {
    type, def, legs, turret, barrel, pose, air, turretBase: turret?.position.clone(),
    gun: pose ? newGun(pose.park, pose.rest) : newGun(),
    rig: rig ? { kind: rig, motion: new Float32Array([0, 0, 0, 1]), phase: 0, gait: 0, kneel: 0, flinch: 0, lean: 0, vs: 0, pitch: 0, pitchV: 0, squat: 0,
      legLength: model.userData.legLength || 0.95, hullPivot: model.userData.hullPivot || [0.6, 0] } : null,
    gait: 0, stride: 0, recoil: 0, kick: 0, kickSize: kickSize(weaponStyle({ unit: type, weapon: type }).kind), reload: 0.25, scan: 0, shots: 0,
    kind: weaponStyle({ unit: type, weapon: type }).kind,
    hoverClock: 0,
  };
}

// One frame of a preview in `mode` (idle, walk, fire): the same calls view.js makes for a unit in that state.
function stepMotion(u, root, model, preview, mode, dt) {
  const moving = mode === "walk", attacking = mode === "fire", def = u.def;
  const speed = moving ? def.speed || 3 : 0;
  u.recoil = Math.max(0, u.recoil - dt); u.kick = Math.max(0, u.kick - dt);
  if (attacking && def.damage) {
    u.reload -= dt;
    if (u.reload <= 0) {
      u.reload = Math.max(0.35, def.interval || 1);
      u.shots++;
      if (u.kind === "cannon") u.recoil = RECOIL.barrel;
      fireBarrel(u.gun);
      if (u.kind !== "support") u.kick = RECOIL.body;
    }
  } else u.reload = 0.25;
  u.scan += dt;
  if (u.turret) {
    const aim = attacking ? FIRE_AIM : moving ? 0 : Math.sin(u.scan * 0.35) * 0.44;
    const diff = Math.atan2(Math.sin(aim - u.turret.rotation.y), Math.cos(aim - u.turret.rotation.y));
    u.turret.rotation.y += Math.max(-3 * dt, Math.min(3 * dt, diff));
  }
  if (u.barrel) {
    const kick = barrelKick(u.recoil), hinge = u.barrel.userData.trunnion;
    if (u.turret) {
      if (hinge && u.pose) {
        stepBarrel(u.gun, u.pose, { moving, attacking, dt, rich: true });
        poseBarrel(u.barrel, hinge, u.gun.elevation, u.gun.drawn, kick);
      } else u.barrel.position.set(0, 0, -kick);
    } else {
      // A tower's gun turns on its own to the target; any other gun points where the unit faces.
      const aim = u.type === "tower" ? (attacking ? FIRE_AIM : Math.sin(u.scan * 0.35) * 0.44) : 0;
      u.barrel.rotation.y = approach(u.barrel.rotation.y, aim, 4, dt);
      u.barrel.position.set(-Math.sin(u.barrel.rotation.y) * kick, 0, -Math.cos(u.barrel.rotation.y) * kick);
    }
  }
  let lift = 0, back = 0;
  if (def.kind === "unit") {
    const pace = Math.min(1, speed / 2.4);
    u.gait += (pace - u.gait) * Math.min(1, dt * 10);
    if (pace === 0 && u.gait < 0.03) u.gait = 0;
    u.stride += speed * dt * (u.legs.length ? 2.5 : 3.4);
    lift = u.legs.length ? Math.abs(Math.sin(u.stride)) * 0.07 * u.gait : Math.sin(u.stride * 2.1) * 0.016 * u.gait;
    if (u.rig?.kind === "infantry") {
      lift = stepInfantry(u.rig, u.rig.motion, { speed, base: def.speed || 3, scale: 1, legLength: u.rig.legLength, moving, attacking, dt, rich: true,
        kneels: KNEELERS.has(u.type), gait: GAIT[u.type] });
    } else if (u.rig?.kind === "hull") {
      const pitch = stepHull(u.rig, u.rig.motion, { speed, moving, dt, rich: true, scale: 1 });
      if (u.turret) poseTurretOnHull(u.turret, u.turretBase, u.rig.hullPivot, pitch, u.rig.squat);
    }
    if (u.kick > 0) back = bodyKick(u.kick, u.kickSize);
  }
  if (u.rig) { preview.motion.array.set(u.rig.motion); preview.motion.needsUpdate = true; }
  swingLegs(u.legs, u.stride, u.gait);
  model.rotation.x = 0;
  if (u.air) {
    u.air.clock = (u.air.clock + dt) % 600;
    poseAirParts(u.air, true);
    u.hoverClock += dt * FEEL.hoverRate;
    lift += HOVER + Math.sin(u.hoverClock) * FEEL.hoverAmplitude;
    model.rotation.x = Math.min(1, u.gait) * (u.type === "hawk" ? 0.22 : 0.14);
  }
  model.position.set(0, lift, -back);
}

function plateTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, "rgba(4,10,14,0.62)"); r.addColorStop(0.42, "rgba(4,10,14,0.38)"); r.addColorStop(0.9, "rgba(40,80,90,0.12)"); r.addColorStop(1, "rgba(40,80,90,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class UnitViewer {
  // stage: the element the canvas fills. view: the game's WorldView (model cache, team colours).
  // onLost(): the WebGL context went away (fallback to the 2D portrait).
  constructor(stage, { view, side = 0, reducedMotion = false, onLost = () => {}, onState = () => {} }) {
    this.stage = stage; this.view = view; this.onLost = onLost; this.onState = onState;
    this.reducedMotion = reducedMotion;
    this.coarse = matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.coarse ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.CustomToneMapping; // the game's Neutral + warm grade (look-grade.js)
    r.toneMappingExposure = 1;
    r.setClearColor(0x000000, 0);
    const canvas = r.domElement;
    canvas.className = "unit-3d-canvas";
    canvas.setAttribute("role", "img");
    canvas.style.touchAction = "none";
    stage.append(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
    this.scene.add(new THREE.HemisphereLight(0xc1ddd7, 0x736145, 2.0));
    const sun = new THREE.DirectionalLight(0xffe1b0, 3.2);
    sun.position.copy(SUN).multiplyScalar(20);
    this.scene.add(sun);
    const pmrem = new THREE.PMREMGenerator(r), room = new RoomEnvironment();
    this.envTarget = pmrem.fromScene(room, 0.04);
    this.env = this.envTarget.texture;
    room.dispose(); pmrem.dispose();
    this.plateMap = plateTexture();
    this.plate = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: this.plateMap, transparent: true, depthWrite: false }));
    this.plate.rotation.x = -Math.PI / 2;
    this.plate.position.y = 0.01;
    this.scene.add(this.plate);
    this.orbit = { ...ORBIT.home };
    this.autoTurn = !reducedMotion;
    this.mode = "idle";
    this.sizeOn = false;
    this.colourIndex = 0;
    this.side = side;
    this.active = false; this.visible = true; this.running = false; this.frames = 0;
    this.pointers = new Map(); this.lastTap = null;
    this.listen();
    this.resize();
  }
  get canvas() { return this.renderer.domElement; }
  listen() {
    const c = this.canvas, on = (target, name, fn, opts) => { target.addEventListener(name, fn, opts); (this.unlisten ||= []).push(() => target.removeEventListener(name, fn, opts)); };
    on(c, "webglcontextlost", (event) => { event.preventDefault(); this.lost = true; this.stop(); this.onLost(); });
    on(c, "pointerdown", (event) => {
      this.autoTurn = false; // any touch stops the slow turn for good
      c.setPointerCapture?.(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY });
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.orbit.zoom }; }
    });
    on(c, "pointermove", (event) => {
      const p = this.pointers.get(event.pointerId);
      if (!p) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y;
      p.x = event.clientX; p.y = event.clientY;
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        this.orbit.zoom = pinchZoom(this.pinch.zoom, this.pinch.gap, Math.hypot(a.x - b.x, a.y - b.y));
      } else this.orbit = dragOrbit(this.orbit, dx, dy);
      this.kick();
    });
    const up = (event) => {
      const p = this.pointers.get(event.pointerId);
      if (!p) return;
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      // A tap that did not drag: two of them make a double tap (touch; mice also get dblclick).
      if (event.type === "pointerup" && event.pointerType === "touch" && Math.hypot(event.clientX - p.x0, event.clientY - p.y0) < 10) {
        const tap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
        if (isDoubleTap(this.lastTap, tap)) { this.resetView(); this.lastTap = null; } else this.lastTap = tap;
      }
    };
    on(c, "pointerup", up); on(c, "pointercancel", up);
    on(c, "dblclick", () => this.resetView());
    on(c, "wheel", (event) => { event.preventDefault(); this.autoTurn = false; this.orbit.zoom = wheelZoom(this.orbit.zoom, event.deltaY * (event.deltaMode === 1 ? 33 : 1)); this.kick(); }, { passive: false });
    on(document, "visibilitychange", () => this.sync());
    this.resizeObserver = new ResizeObserver(() => { this.resize(); this.kick(); });
    this.resizeObserver.observe(this.stage);
    this.intersection = new IntersectionObserver((entries) => { this.visible = entries.at(-1).isIntersecting; this.sync(); });
    this.intersection.observe(this.stage);
  }
  resize() {
    const w = Math.max(1, this.stage.clientWidth), h = Math.max(1, this.stage.clientHeight);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  resetView() { this.orbit = { ...ORBIT.home }; this.kick(); }
  // The loop runs only while the guide is open, the panel is on screen and the tab is visible.
  setActive(on) { this.active = on; this.sync(); }
  sync() {
    const run = this.active && this.visible && !document.hidden && !this.lost && !this.disposed;
    if (run && !this.running) { this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.frame(t)); }
    else if (!run) this.stop();
  }
  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  kick() { if (!this.running) this.sync(); }
  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.step(dt);
    this.draw();
  }
  step(dt) {
    if (this.autoTurn && !this.reducedMotion) this.orbit.yaw = clampOrbit({ ...this.orbit, yaw: this.orbit.yaw + dt * ORBIT.autoTurn }).yaw;
    for (const p of [this.unit, this.ranger]) if (p) stepMotion(p.state, p.root, p.preview.model, p.preview, p === this.unit ? this.mode : "idle", dt);
  }
  draw() {
    if (this.lost || this.disposed) return;
    const t = this.target;
    if (!t) { this.renderer.clear(); return; }
    const [x, y, z] = orbitOffset(this.orbit, this.distance);
    this.camera.position.set(t.x + x, t.y + y, t.z + z);
    this.camera.lookAt(t);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
  }
  // Colours to cycle (the match's teams, then every faction).
  colours() {
    const factions = Object.values(FACTIONS).map((f) => ({ id: f.id, short: f.short, color: hexOf(PRESETS[f.color] || f.glow), glow: hexOf(f.glow) }));
    return colourCycle(this.view.colors, this.view.glows, factions, this.side);
  }
  // Show `type`; resolves true once its real model is on screen, false if there is none (the panel keeps the portrait).
  async show(type) {
    const ticket = (this.ticket = (this.ticket || 0) + 1);
    this.type = type;
    this.mode = "idle";
    const key = `${type}-0`;
    if (!this.view.teamTemplates.has(key) && this.view.preloadModels) await this.view.preloadModels([type]);
    if (!this.view.teamTemplates.has("ranger-0") && this.view.preloadModels) await this.view.preloadModels(["ranger"]);
    if (ticket !== this.ticket || this.disposed) return false;
    const template = this.view.teamTemplates.get(key);
    this.clearUnits();
    if (!template || D[type]?.boss) { this.target = null; this.draw(); return false; }
    this.unit = this.place(type, template);
    if (this.sizeOn) this.addRanger();
    this.paint();
    this.frame3d();
    this.draw();
    this.kick();
    this.onState(this.state());
    return true;
  }
  place(type, template) {
    const preview = buildPreview(template, this.env), root = new THREE.Group();
    root.add(preview.model);
    preview.model.rotation.order = "YXZ";
    this.scene.add(root);
    const state = motionState(type, preview.model);
    const box = new THREE.Box3().setFromObject(preview.model);
    if (D[type]?.flying) { box.min.y += HOVER; box.max.y += HOVER; }
    return { type, preview, root, state, box };
  }
  addRanger() {
    if (this.ranger || !this.unit) return;
    const template = this.view.teamTemplates.get("ranger-0");
    if (!template || this.type === "ranger") return;
    this.ranger = this.place("ranger", template);
    // Beside the unit, on its left as the camera first sees it, with a little air between them.
    const u = this.unit.box, r = this.ranger.box;
    this.ranger.root.position.x = u.min.x - 0.35 - r.max.x;
  }
  clearUnits() {
    for (const p of [this.unit, this.ranger]) if (p) { disposePreview(p.preview); p.root.removeFromParent(); }
    this.unit = this.ranger = null;
  }
  // Fit the camera (and the plate) to what is shown.
  frame3d() {
    const box = this.unit.box.clone();
    if (this.ranger) { const r = this.ranger.box.clone().translate(this.ranger.root.position); box.union(r); }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.target = sphere.center.clone();
    this.target.y = Math.max(this.target.y, 0.3);
    this.distance = fitDistance(sphere.radius, this.camera.fov, this.camera.aspect);
    this.camera.near = Math.max(0.05, this.distance * 0.02);
    this.camera.far = this.distance * 6;
    this.camera.updateProjectionMatrix();
    const plate = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.7 + 0.4;
    this.plate.scale.setScalar(plate);
    this.plate.position.set((box.min.x + box.max.x) / 2, 0.01, (box.min.z + box.max.z) / 2);
  }
  paint() {
    const list = this.colours(), c = list[this.colourIndex % list.length];
    for (const p of [this.unit, this.ranger]) if (p) for (const { m, rim, glow } of p.preview.own.paints) {
      m.color.setHex(c.color);
      rim.setHex(c.color);
      if (glow) m.emissive.setHex(c.glow);
    }
    this.colour = c;
  }
  setMode(mode) { if (!this.unit) return; this.mode = mode; this.autoTurn = false; this.kick(); this.onState(this.state()); }
  cycleColour() { this.colourIndex = (this.colourIndex + 1) % this.colours().length; this.paint(); this.kick(); this.onState(this.state()); }
  // The first colour when the guide opens for an enemy unit is that enemy's.
  startColour(side) { this.side = side; this.colourIndex = side > 0 ? 1 : 0; }
  toggleSize() {
    if (!this.unit) return;
    this.sizeOn = !this.sizeOn;
    if (this.sizeOn) this.addRanger();
    else if (this.ranger) { disposePreview(this.ranger.preview); this.ranger.root.removeFromParent(); this.ranger = null; }
    this.paint();
    this.frame3d();
    this.kick();
    this.onState(this.state());
  }
  motions() { const u = this.unit?.state; return motionsFor(D[this.type], { hull: u?.rig?.kind === "hull", wheels: GAIT[this.type] === "ride", legs: u?.rig?.kind === "infantry" || !!u?.legs.length }); }
  // For tests and the panel: what is shown and how it is posed.
  state() {
    const u = this.unit?.state;
    return {
      type: this.unit ? this.type : null, mode: this.mode, orbit: { ...this.orbit }, autoTurn: this.autoTurn, colour: this.colour?.id, colourHex: this.colour?.color, size: !!this.ranger, running: this.running, frames: this.frames,
      rigged: this.unit?.preview.rigged || 0, motion: u?.rig ? [...u.rig.motion] : null, stride: u?.stride || 0, shots: u?.shots || 0,
      turret: u?.turret ? u.turret.rotation.y : null, barrel: u?.barrel ? { elevation: u.gun.elevation, length: u.gun.drawn, z: u.barrel.position.z, rotation: u.barrel.rotation.x } : null,
      lift: this.unit ? this.unit.preview.model.position.y : 0, spins: u?.air?.spins.length || 0,
      paint: this.unit?.preview.own.paints[0]?.m.color.getHex() ?? null,
      memory: { ...this.renderer.info.memory }, calls: this.renderer.info.render.calls, pixelRatio: this.renderer.getPixelRatio(),
    };
  }
  // Test probe: draw now and count the canvas pixels that are not clear (drawn in the same task, so the
  // buffer is still there to read).
  probe() {
    this.draw();
    const gl = this.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let lit = 0; const colours = new Set();
    for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 8) { lit++; colours.add((px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | px[i + 2] >> 4); }
    return { lit: lit / (px.length / 16), colours: colours.size, w, h };
  }
  // Free everything this view made and release its WebGL context. Returns the renderer's memory counts after
  // the unit resources were freed (all zero: nothing of this view is left on the GPU when the context goes).
  dispose() {
    if (this.disposed) return this.report;
    this.disposed = true;
    this.stop();
    this.unlisten?.forEach((off) => off());
    this.resizeObserver?.disconnect(); this.intersection?.disconnect();
    this.clearUnits();
    this.plate.geometry.dispose(); this.plate.material.dispose(); this.plateMap.dispose();
    this.envTarget.dispose();
    this.renderer.renderLists.dispose();
    const memory = { ...this.renderer.info.memory };
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.report = { memory, contextLost: this.renderer.getContext().isContextLost?.() ?? true };
    return this.report;
  }
}
