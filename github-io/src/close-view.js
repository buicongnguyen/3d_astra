import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_LAYER } from "./entity-batches.js";
import { cacheTransforms } from "./transform-cache.js";

// Close view (H3b): close-up detail models for units near a close camera (the coming Hero mode, H3a).
//
// - Detail GLBs live in public/models/detail/ with a manifest. They load on the first set() and each
//   type is turned into team templates by WorldView.buildTemplates(type, gltf, true), which reuses the
//   normal model's materials, so a detail model compiles no new program and follows every recolour.
// - A unit within the radius of the close camera gets a clone of its detail template as a child of its
//   model (identity transform). Its normal parts are parked on PARKED_LAYER, which neither the camera,
//   the shadow pass nor the batches (entity-batches.js, SOURCE_LAYER only) draw; the detail parts sit on
//   SOURCE_LAYER, so they batch (one extra instanced batch per part, type and team) and stay pickable.
// - Every frame the detail copies its partner's local pose (legs, turret, barrel, sword arm, rotors), the
//   per-part tint (hit flash, wrecks, rank paint), visibility and the shader-bone pose (unit-rig.js),
//   so animation, team colour, selection rings and state fx work as on the normal model.
// - Units switch back beyond radius x EXIT (hysteresis), and never while the view is off.
// - A model wearing a faction dress (syncFactionDress) keeps its normal model: the dress fits only that.
// While the view was never turned on, update() returns at once: normal play is untouched.
export const PARKED_LAYER = 2;
export const CLOSE_RADIUS = 25;
export const EXIT = 1.15;
// The governor (governor.js LEVELS) shrinks the radius on a struggling device.
export const LEVEL_RADIUS = { full: 1, calm: 1, still: 0.7, rescue: 0.45 };

export class CloseView {
  constructor(view) {
    this.view = view;
    this.on = false;
    this.x = 0;
    this.z = 0;
    this.radius = CLOSE_RADIUS;
    this.scale = LEVEL_RADIUS[view.closeLevel] ?? 1;
    this.chase = false;
    this.shown = new Set(); // roots drawing their detail model
    this.types = null; // detail types listed in the manifest
    this.loads = new Map(); // type -> promise
    this.ready = new Set();
    this.failed = null;
  }
  get effectiveRadius() {
    return this.radius * this.scale;
  }
  setLevel(name) {
    this.scale = LEVEL_RADIUS[name] ?? 1;
  }
  // options: { x, z, radius, chase } or null (off).
  set(options) {
    if (!options) {
      this.on = false;
      this.chase = false;
      this.endChase();
      return Promise.resolve(this.info());
    }
    this.on = true;
    if (Number.isFinite(options.x)) this.x = options.x;
    if (Number.isFinite(options.z)) this.z = options.z;
    if (Number.isFinite(options.radius) && options.radius > 0) this.radius = options.radius;
    if (options.chase !== undefined) this.chase = !!options.chase;
    return this.loadLoaded().then(() => this.info());
  }
  manifest() {
    this.manifestLoad ||= fetch(`${import.meta.env.BASE_URL}models/detail/manifest.json`)
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((m) => { this.types = new Map(m.assets.map((a) => [a.name, a.file])); })
      .catch((error) => { this.failed = String(error); this.types = new Map(); });
    return this.manifestLoad;
  }
  // Detail models for every listed type whose normal model is loaded (the rest load when first needed).
  async loadLoaded() {
    await this.manifest();
    await Promise.all([...this.types.keys()].filter((type) => this.view.models.has(type)).map((type) => this.ensure(type)));
  }
  ensure(type) {
    if (!this.types?.has(type) || !this.view.models.has(type)) return Promise.resolve();
    let load = this.loads.get(type);
    if (!load) {
      const url = `${import.meta.env.BASE_URL}models/detail/${this.types.get(type)}`;
      load = new GLTFLoader().loadAsync(url).then((gltf) => {
        this.view.buildTemplates(type, gltf, true);
        this.ready.add(type);
      }).catch((error) => { this.failed = `${type}: ${error}`; });
      this.loads.set(type, load);
    }
    return load;
  }
  info() {
    const types = new Set();
    for (const root of this.shown) types.add(root.userData.type);
    return { on: this.on, x: this.x, z: this.z, radius: this.effectiveRadius, chase: this.chase, near: this.shown.size,
      types: [...types].sort(), ready: [...this.ready].sort(), failed: this.failed };
  }
  // Per frame, after all entity animation and before the scene's matrix pass (WorldView.update).
  update(sim, selected) {
    if (!this.on && !this.shown.size) return;
    if (this.on && this.chase) this.stepChase(sim, selected);
    const v = this.view, r = this.effectiveRadius, enter = r * r, exit = (r * EXIT) * (r * EXIT);
    for (const root of v.objects.values()) this.consider(root, enter, exit);
    for (const d of v.dying) this.consider(d.object, enter, exit);
    // Entities that left the scene (disposed, a reset) drop out of the set.
    for (const root of this.shown) if (!root.parent) this.shown.delete(root);
  }
  consider(root, enter, exit) {
    const u = root.userData;
    if (u.kind !== "unit" || !u.model) return;
    const shown = this.shown.has(root);
    let want = false;
    if (this.on && root.visible) {
      const dx = root.position.x - this.x, dz = root.position.z - this.z, d = dx * dx + dz * dz;
      want = d < (shown ? exit : enter) && !this.view.dressOn?.has(`${u.type}-${u.team}`);
      if (want && !this.view.detailTemplates.has(`${u.type}-${u.team}`)) {
        if (this.types && !this.loads.has(u.type)) this.ensure(u.type);
        want = false;
      }
    }
    if (want && !shown) this.attach(root);
    else if (!want && shown) this.detach(root);
    if (this.shown.has(root)) mirror(u.lod);
  }
  attach(root) {
    const u = root.userData, model = u.model;
    let lod = u.lod;
    if (!lod) {
      const template = this.view.detailTemplates.get(`${u.type}-${u.team}`);
      const detail = template.clone(true);
      detail.name = "CloseDetail";
      // The normal model's own parts: those built from its template (plugins' extras stay as they are).
      const normal = this.view.teamTemplates.get(`${u.type}-${u.team}`), own = new Set();
      normal?.traverse((o) => { if (o.isMesh) own.add(o.geometry); });
      const base = [];
      model.traverse((o) => { if (o.isMesh && own.has(o.geometry)) base.push(o); });
      const nodes = [], meshes = [];
      pair(model, detail, nodes, meshes, base[0] || null);
      const motion = u.rig?.motion || null;
      for (const [, d] of meshes) if (d.geometry.getAttribute("aRig")) d.userData.motion = motion;
      cacheTransforms(detail);
      model.add(detail);
      lod = u.lod = { detail, base, nodes, meshes };
    }
    for (const o of lod.base) o.layers.set(PARKED_LAYER);
    lod.detail.visible = true;
    this.shown.add(root);
  }
  detach(root) {
    const lod = root.userData.lod;
    if (lod) {
      for (const o of lod.base) o.layers.set(SOURCE_LAYER);
      lod.detail.visible = false;
    }
    this.shown.delete(root);
  }
  // Dev camera (?closecam): a low chase view behind the selected unit, about 25 degrees above the ground
  // on a PC and 35 on a phone (less horizon to draw). H3a replaces it with the real Hero mode camera.
  stepChase(sim, selected) {
    const v = this.view;
    let e = null;
    for (const id of selected || []) {
      const x = sim.get?.(id);
      if (x && x.kind === "unit" && x.hp > 0) { e = x; break; }
    }
    if (!e) { this.endChase(); return; }
    if (!this.saved) this.saved = { pitch: v.pitch ?? null, yaw: v.yaw || 0, zoom: v.zoom };
    const phone = v.width < 700 || v.height < 500;
    v.setPitch(phone ? 35 : 25);
    const root = v.objects.get(e.id), heading = root?.userData.model?.rotation.y ?? e.angle ?? 0;
    const offset = v.cameraOffset;
    const base = offset ? Math.atan2(offset.x, offset.z) : 0;
    v.yaw = heading + Math.PI - base;
    v.zoom = phone ? 15 : 12;
    v.focus.set(e.x, 0, e.z);
    v.updateCamera();
    this.x = e.x;
    this.z = e.z;
  }
  endChase() {
    if (!this.saved) return;
    const v = this.view, saved = this.saved;
    this.saved = null;
    v.setPitch(saved.pitch);
    v.yaw = saved.yaw;
    v.zoom = saved.zoom;
    v.updateCamera();
  }
}

// Pair the detail tree with the normal one: groups by name (pivots: legs, TurretRig, BarrelRig, SwordArm,
// spin_*), meshes by shared material (then name). A detail mesh with no partner of its own follows `fallback`.
function pair(src, dst, nodes, meshes, fallback) {
  const used = new Set();
  for (const d of dst.children) {
    if (d.isMesh) {
      let s = src.children.find((c) => c.isMesh && !used.has(c) && c.material === d.material && c.name === d.name)
        || src.children.find((c) => c.isMesh && !used.has(c) && c.material === d.material)
        || src.children.find((c) => c.isMesh && !used.has(c));
      if (s) used.add(s);
      meshes.push([s || fallback, d]);
      if (s && s.name === d.name) nodes.push([s, d]);
    } else {
      const s = src.children.find((c) => !c.isMesh && c.name === d.name && c.name !== "CloseDetail");
      if (s) {
        nodes.push([s, d]);
        pair(s, d, nodes, meshes, fallback);
      }
    }
  }
}

function mirror(lod) {
  for (let i = 0; i < lod.nodes.length; i++) {
    const [s, d] = lod.nodes[i];
    d.position.copy(s.position);
    d.quaternion.copy(s.quaternion);
    d.scale.copy(s.scale);
    d.visible = s.visible;
  }
  for (let i = 0; i < lod.meshes.length; i++) {
    const [s, d] = lod.meshes[i];
    if (!s) continue;
    d.visible = s.visible;
    const tint = s.userData.tint;
    if (tint) d.userData.tint = tint; else if (d.userData.tint) delete d.userData.tint;
  }
}

