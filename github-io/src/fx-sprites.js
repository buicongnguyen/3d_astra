// Weapon VFX sprites (AAA round 3, R3-FX): the Codex sprite sheets (public/fx, data and maths in fx-sprites-data.js) played
// from two pooled instanced quad batches, one per blend mode (normal alpha for smoke, scorch and mixed blasts; additive for
// bright effects). Every sprite is a pooled record (no Mesh, no allocation per sprite or per frame once warm), billboarded to the
// camera, flat on the ground (decals) or turned along a world direction (flame jet, muzzle flash). The frame is chosen on the
// CPU and passed as two frame indices + a mix, so the shader cross-fades between poses. Eleven sheets share ONE texture:
// +2 draws. The atlas loads when a battle starts (Effects is built then; never on the title) and the procedural effects of
// src/fx.js stay the fallback until it has loaded (or if it never does). View only.
import * as THREE from "three";
import { SHEETS, frameAt, atlasFile, atlasSize, DECAL, POOL, SCORCH_FRAMES, CRATER_FRAMES } from "./fx-sprites-data.js";

const OCCLUDED = -1, BILLBOARD = 0, GROUND = 1, ORIENTED = 2;
export { OCCLUDED, BILLBOARD, GROUND, ORIENTED };

const VERTEX = `
attribute vec3 iPos; attribute vec4 iColor; attribute vec4 iRect; attribute vec4 iFrame; attribute vec3 iSize; attribute vec3 iAxis; attribute vec4 iExtra;
uniform vec2 texel;
varying vec2 vA; varying vec2 vB; varying vec4 vColor; varying float vMix;
// iRect: x, y, frame w, frame h of the sheet in the atlas (0..1, y from the top). iFrame: columns, frame a, frame b, mix.
// iExtra: stretch x, stretch y (a beam is long and thin), repeats along x (a seamless strip), scroll.
vec2 cellUv(float frame, vec2 q) {
  float cols = iFrame.x;
  vec2 o = iRect.xy + vec2(mod(frame, cols) * iRect.z, floor(frame / cols) * iRect.w);
  vec2 l = vec2(mix(0.5 * texel.x, iRect.z - 0.5 * texel.x, q.x), mix(0.5 * texel.y, iRect.w - 0.5 * texel.y, 1.0 - q.y));
  return vec2(o.x + l.x, 1.0 - (o.y + l.y));
}
void main() {
  vColor = iColor; vMix = iFrame.w;
  vec2 q = uv;
  if (iExtra.z > 0.0) q.x = fract(uv.x * iExtra.z + iExtra.w); // a strip repeats along its length
  vA = cellUv(iFrame.y, q); vB = cellUv(iFrame.z, q);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 forward = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  float rot = iSize.y;
  if (iSize.z > 1.5) rot += atan(dot(iAxis, up), dot(iAxis, right)); // turned along a world direction, seen from the camera
  float c = cos(rot), s = sin(rot);
  vec2 p = position.xy * iExtra.xy;
  vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c) * iSize.x;
  vec3 world;
  // Camera-facing sprites are pulled toward the (orthographic) camera by about their own size, like the glow pool: a
  // blast centred in a hull draws in front of it instead of being clipped, without moving on screen.
  if (iSize.z < -0.5) world = iPos + right * r.x + up * r.y - forward * 0.6;
  else if (iSize.z < 0.5 || iSize.z > 1.5) world = iPos + right * r.x + up * r.y + forward * (iSize.x * 0.45 + 0.4);
  else world = iPos + vec3(r.x, 0.0, r.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAGMENT = `
uniform sampler2D map;
varying vec2 vA; varying vec2 vB; varying vec4 vColor; varying float vMix;
void main() {
  vec4 a = texture2D(map, vA), b = texture2D(map, vB);
  float alpha = mix(a.a, b.a, vMix);
  if (alpha * vColor.a < 0.004) discard;
  vec3 rgb = mix(a.rgb * a.a, b.rgb * b.a, vMix) / max(alpha, 0.001);
  gl_FragColor = vec4(vColor.rgb * rgb, vColor.a * alpha);
}`;

// One record shape for every sprite (pooled).
function newRecord() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 1, rot: 0, spin: 0, r: 1, g: 1, b: 1, a: 1, def: null, start: 0, count: 1, fps: 12, loop: false,
    mode: BILLBOARD, ax: 1, ay: 0, az: 0, anchor: null, decal: false, calm: false, fade: 0.05, drag: 0, sx: 1, sy: 1, tiles: 0, scroll: 0, scrollSpeed: 0, once: false };
}

class Batch {
  constructor(capacity, blending, renderOrder, texture, texel) {
    this.capacity = capacity;
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute("position", quad.getAttribute("position")); g.setAttribute("uv", quad.getAttribute("uv"));
    const attr = (name, n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.pos = attr("iPos", 3); this.color = attr("iColor", 4); this.rect = attr("iRect", 4); this.frame = attr("iFrame", 4); this.size = attr("iSize", 3); this.axis = attr("iAxis", 3); this.extra = attr("iExtra", 4);
    this.attrs = [this.pos, this.color, this.rect, this.frame, this.size, this.axis, this.extra];
    g.instanceCount = 1;
    this.material = new THREE.ShaderMaterial({ uniforms: { map: { value: texture }, texel: { value: texel } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, blending });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder;
    this.items = []; this.free = []; this.drawn = 0; this.sent = false;
    for (let i = 0; i < capacity; i++) this.free.push(newRecord());
    quad.dispose();
  }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const FRAME = { a: 0, b: 0, mix: 0 };

export class FxSprites {
  constructor(view, fx, parent) {
    this.view = view; this.fx = fx; this.parent = parent;
    this.ready = false; this.failed = false; this.tier = null;
    this.texture = null; this.batches = null; this.loading = null; this.textureBytes = 0;
    this.stats = { spawned: 0, recycled: 0 };
    // Nothing loads here (the view is built on the title screen): match-flow.js restart() calls start() when a battle begins.
  }
  get phone() { return !!this.view.lowPower || Math.min(innerWidth || 1000, innerHeight || 1000) < 600; }
  get budget() { return this.view.lowPower ? 0.55 : 1; }
  // Loads the atlas for this quality tier (a phone or Eco gets the 256 px sheets).
  start() {
    // ?sprites=0 keeps the procedural effects (the before/after strips and A/B draw counts use it).
    try { if (new URLSearchParams(location.search).get("sprites") === "0") { this.failed = true; return null; } } catch { /* no location */ }
    const phone = this.phone, tier = phone ? "phone" : "full";
    if (this.tier === tier || this.loading) return this.loading;
    this.tier = tier;
    this.loading = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { this.install(img, phone); this.loading = null; resolve(true); };
      img.onerror = () => { this.failed = true; this.tier = null; this.loading = null; resolve(false); };
      img.src = `${import.meta.env.BASE_URL}fx/${atlasFile(phone)}`;
    });
    return this.loading;
  }
  whenReady() { return this.loading ? this.loading.then(() => this.ready) : Promise.resolve(this.ready); }
  install(img, phone) {
    const old = this.texture, texture = new THREE.Texture(img);
    texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
    this.texture = texture;
    const [aw, ah] = atlasSize(phone), texel = new THREE.Vector2(1 / aw, 1 / ah);
    if (!this.batches) {
      this.batches = { normal: new Batch(POOL.normal, THREE.NormalBlending, 5.5, texture, texel), add: new Batch(POOL.add, THREE.AdditiveBlending, 7, texture, texel) };
      this.parent.add(this.batches.normal.mesh, this.batches.add.mesh);
    } else for (const b of Object.values(this.batches)) { b.material.uniforms.map.value = texture; b.material.uniforms.texel.value = texel; }
    old?.dispose();
    this.ready = true;
    this.textureBytes = img.naturalWidth * img.naturalHeight * 4; // RGBA8, no mips (budget note)
  }
  batchOf(sheet) { return this.batches[SHEETS[sheet].blend === "add" ? "add" : "normal"]; }
  // How many sprites of one batch live now (tests and probes).
  count(sheet) { return this.batchOf(sheet).items.length; }
  // A new pooled sprite of `sheet` at the world point (x, y, z); the caller sets the rest. y is above the ground unless `lifted`.
  take(sheet, x, y, z, size, anchor, lifted = false) {
    const def = SHEETS[sheet], batch = this.batchOf(sheet);
    const cap = Math.max(1, Math.round(batch.capacity * this.budget));
    let p = batch.items.length >= cap ? this.recycle(batch) : batch.free.pop();
    if (!p) return null;
    batch.items.push(p);
    p.x = x; p.y = lifted ? y : y + this.fx.ground(x, z); p.z = z; p.vx = p.vy = p.vz = 0; p.age = 0; p.life = def.loop ? 1 : def.frames / Math.max(1, def.fps);
    p.s0 = p.s1 = size; p.rot = 0; p.spin = 0; p.r = p.g = p.b = p.a = 1; p.def = def; p.start = 0; p.count = def.frames; p.fps = def.fps; p.loop = def.loop;
    p.splash = false; p.hotCore = false; p.mode = BILLBOARD; p.ax = 1; p.ay = 0; p.az = 0; p.sx = p.sy = 1; p.tiles = 0; p.scroll = 0; p.scrollSpeed = 0; p.once = false; p.anchor = anchor; p.decal = false; p.calm = !this.fx.motion; p.fade = 0.06; p.drag = 0;
    if (p.calm) p.fps *= 0.6;
    this.stats.spawned++;
    return p;
  }
  // At the live cap (smaller in Eco) the oldest sprite that is not a decal is reused.
  recycle(batch) {
    let best = -1, age = -1;
    for (let i = 0; i < batch.items.length; i++) { const q = batch.items[i]; if (!q.decal && q.age > age) { age = q.age; best = i; } }
    if (best < 0) return null;
    const p = batch.items[best];
    batch.items[best] = batch.items[batch.items.length - 1]; batch.items.pop();
    this.stats.recycled++;
    return p;
  }
  // A flat scorch mark or crater on the ground that fades over about 20 s; capped (fewer in Eco). A fresh mark on one
  // made a moment ago refreshes that one instead of stacking.
  decal(x, z, size, crater, anchor) {
    if (!this.ready) return null;
    const items = this.batches.normal.items, cap = this.view.lowPower ? DECAL.ecoCap : DECAL.cap;
    let oldest = null, n = 0;
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      if (!q.decal) continue;
      n++;
      if (Math.hypot(q.x - x, q.z - z) < size * DECAL.merge && q.age < q.life * 0.12) { q.age = Math.min(q.age, q.life * 0.05); q.s0 = q.s1 = Math.min(Math.max(q.s1, size) * 1.05, size * 1.5); return q; }
      if (!oldest || q.age > oldest.age) oldest = q;
    }
    if (n >= cap && oldest) oldest.age = oldest.life; // retired on the next update
    const frames = crater ? CRATER_FRAMES : SCORCH_FRAMES;
    const p = this.take("scorch", x, 0.05 + n * 0.0004, z, size, anchor, true);
    if (!p) return null;
    p.y += this.fx.ground(x, z);
    p.mode = GROUND; p.decal = true; p.count = 1; p.start = frames[Math.floor(this.fx.rng() * frames.length)]; p.fps = 0; p.life = DECAL.life; p.rot = this.fx.rng() * 6.28;
    p.a = crater ? 0.92 : 0.85; p.fade = 0.3; p.calm = false;
    return p;
  }
  update(dt, visible) {
    if (!this.batches) return;
    for (const key of ["normal", "add"]) {
      const batch = this.batches[key], P = batch.pos.array, C = batch.color.array, R = batch.rect.array, E = batch.frame.array, S = batch.size.array, A = batch.axis.array, X = batch.extra.array, items = batch.items;
      let keep = 0, drawn = 0;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p.once) p.age += dt;
        else if (p.age > 0) { p.anchor = null; batch.free.push(p); continue; } // drawn once, the frame it was put
        if (p.age >= p.life) { p.anchor = null; batch.free.push(p); continue; }
        items[keep++] = p;
        if (p.age < 0) continue; // delayed start
        if (dt > 0 && (p.vx || p.vy || p.vz)) {
          const damp = Math.max(0, 1 - p.drag * dt);
          p.vx *= damp; p.vy *= damp; p.vz *= damp; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
        p.rot += p.spin * dt;
        if (!visible(p.anchor)) continue;
        const t = p.age / p.life, o = drawn;
        frameAt(p.age, p.fps, p.start, p.count, p.loop, FRAME, p.calm ? 3 : 1);
        P[o * 3] = p.x; P[o * 3 + 1] = p.y; P[o * 3 + 2] = p.z;
        // Out over the last `fade` of the life; loops ease in over the first moments.
        const out = Math.min(1, (p.life - p.age) / Math.max(0.05, p.life * p.fade)), inn = p.loop ? Math.min(1, p.age / 0.08) : 1;
        const boost = p.hotCore && p.age < 0.05 ? 1.24 : 1;
        C[o * 4] = p.r * boost; C[o * 4 + 1] = p.g * boost; C[o * 4 + 2] = p.b * boost; C[o * 4 + 3] = p.a * out * inn;
        if (p.splash) {
          // The normal-blended flame cools to dull, translucent smoke after its peak.
          const smoke = Math.min(1, Math.max(0, (p.age - 0.06) / 0.1));
          C[o*4] *= 1 - smoke*0.65;
          C[o*4+1] *= 1 - smoke*0.67;
          C[o*4+2] *= 1 - smoke*0.62;
          C[o*4+3] *= 1 - smoke*0.52;
        }
        const d = p.def;
        R[o * 4] = d.x; R[o * 4 + 1] = d.y; R[o * 4 + 2] = d.fw; R[o * 4 + 3] = d.fh;
        E[o * 4] = d.cols; E[o * 4 + 1] = FRAME.a; E[o * 4 + 2] = FRAME.b; E[o * 4 + 3] = FRAME.mix;
        X[o * 4] = p.sx; X[o * 4 + 1] = p.sy; X[o * 4 + 2] = p.tiles; X[o * 4 + 3] = p.scroll + p.scrollSpeed * p.age;
        S[o * 3] = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t)); S[o * 3 + 1] = p.rot; S[o * 3 + 2] = p.mode;
        A[o * 3] = p.ax; A[o * 3 + 1] = p.ay; A[o * 3 + 2] = p.az;
        if (p.once) p.age = 1; // freed at the next update
        drawn++;
      }
      items.length = keep;
      const previous = batch.drawn;
      batch.drawn = drawn;
      batch.mesh.visible = drawn > 0;
      if (!drawn) { if (!previous && batch.sent) continue; S[2] = 0; S[0] = 0; C[3] = 0; drawn = 1; } // one invisible instance keeps the shader warm
      if (!(dt > 0) && drawn === previous && batch.sent) continue; // a still frame (paused or frozen): keep what was sent
      batch.sent = true;
      batch.mesh.geometry.instanceCount = drawn;
      for (const a of batch.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, drawn * a.itemSize); a.needsUpdate = true; }
    }
  }
  get active() { return this.batches ? this.batches.normal.items.length + this.batches.add.items.length : 0; }
  clear() {
    if (!this.batches) return;
    for (const b of Object.values(this.batches)) { for (const p of b.items) { p.anchor = null; b.free.push(p); } b.items.length = 0; }
  }
  dispose() {
    if (this.batches) for (const b of Object.values(this.batches)) { this.parent.remove(b.mesh); b.dispose(); }
    this.texture?.dispose();
    this.batches = null; this.ready = false;
  }
}
