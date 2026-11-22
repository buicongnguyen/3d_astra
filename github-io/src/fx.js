import * as THREE from "three";
import { mulberry32 } from "./rng.js";
import { themeFor, weaponStyle, shotVisible } from "./visual-style.js";
import { damagedEntities, damageState, BURNING, hitPower, scorchPlan, SCORCH } from "./combat-feedback.js";
import { isHarvesting, harvestTarget } from "./activity.js";
import { shotSlope } from "./terrain-labels.js";

// 3D combat effects: muzzle flashes, tracers, shells, rockets, sparks, fireballs, smoke,
// shockwaves, scorch marks, debris, smoke on damaged buildings and fire on critical ones.
// Everything renders through four fixed draw calls (glow, smoke, ground decals, debris) no
// matter how many effects are alive, so heavy fighting never adds draw calls, and each pool
// is capped (halved in Eco). Effects follow fog of war every frame, freeze while paused
// (dt = 0) and lose drift, debris and flicker when combat motion is off or reduced motion
// is requested. Particle and debris records are pooled: the per-frame emitters (fire, smoke,
// trails) and the update loop allocate nothing once the pools are warm.

import { CELLS, CELL, BILLBOARD, STRETCH, GROUND, SHOT_SCALE } from "./fx-kinds/cells.js";
import { LOOKS, MOMENTS, shimmer } from "./fx-kinds/index.js";
import { crit, resisted } from "./fx-kinds/counter.js";
import { RocketBodies } from "./fx-kinds/rocket-body.js";
import { ROCKET } from "./fx-kinds/rocket.js";
// R3-X: weapon effect classes, the ordnance bodies (one instanced draw) and their flights.
import { groundSplashRadius, weaponClass } from "./fx-kinds/weapon-class.js";
import { OrdnanceBodies } from "./fx-kinds/ordnance-body.js";
import { launch, stepRounds, stepStrikes, warnRing, flakBurst, airBurst } from "./fx-kinds/ordnance.js";
import { LOOKS as MOOD_LOOKS } from "./mission-looks.js";
// R3-FX: the Codex weapon sprite sheets (two pooled instanced batches), played for impacts, muzzle flashes, trails, jets, heals and decals.
import { FxSprites } from "./fx-sprites.js";
import { spriteTracer, spriteHead, spriteImpact, spriteMuzzle, spriteSpark, spriteTrailPuff, spritesReady } from "./fx-kinds/sprite-fx.js";
import { impactKind } from "./fx-sprites-data.js";

// Procedural sprite atlas: one 128 px cell per shape, white with alpha.
function atlas() {
  const size = 128, canvas = document.createElement("canvas");
  canvas.width = size * CELLS.length;
  canvas.height = size;
  const g = canvas.getContext("2d"), image = g.createImageData(canvas.width, size);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blobs = Array.from({ length: 10 }, () => [(rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.9, 0.3 + rnd() * 0.3]);
  const shapes = [
    (x, y, d) => Math.max(0, 1 - d) ** 2.2,
    (x, y) => Math.min(1, blobs.reduce((a, [bx, by, r]) => a + 0.45 * Math.max(0, 1 - Math.hypot(x - bx, y - by) / r) ** 1.6, 0)),
    (x, y, d) => Math.exp(-(((d - 0.8) / 0.07) ** 2)) + 0.25 * Math.exp(-(((d - 0.8) / 0.2) ** 2)),
    // Streak: v runs tail (bottom) to head (top); gaussian across, bright head.
    (x, y) => Math.exp(-((x / 0.3) ** 2)) * Math.max(0, (y + 1) / 2) ** 1.4 * Math.min(1, (1 - y) * 6),
    (x, y, d) => Math.max(0, 1 - d) ** 0.9 * (0.75 + 0.25 * Math.sin(x * 9 + y * 7) * Math.cos(y * 11 - x * 5)),
    (x, y, d) => Math.min(1, Math.max(Math.exp(-((x / 0.07) ** 2)) * (1 - Math.abs(y)), Math.exp(-((y / 0.07) ** 2)) * (1 - Math.abs(x))) + Math.exp(-((d / 0.28) ** 2))),
  ];
  shapes.push(
    (x, y) => Math.max(Math.abs(x), Math.abs(y)) < 0.78 && Math.min(Math.abs(x), Math.abs(y)) < 0.23 ? 1 : 0,
    (x, y) => {
      const head = Math.hypot(x - 0.3, y - 0.3) < 0.38 && !(x > 0.24 && y > 0.24);
      const handle = Math.abs(x - y) < 0.21 && x + y > -1.15 && x + y < 0.65;
      return head || handle ? 1 : 0;
    },
  );
  shapes.forEach((shape, cell) => {
    for (let py = 0; py < size; py++)
      for (let px = 0; px < size; px++) {
        const x = (px + 0.5) / size * 2 - 1, y = 1 - (py + 0.5) / size * 2, d = Math.hypot(x, y);
        const i = (py * canvas.width + cell * size + px) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, d > 1 && cell !== 3 && cell !== 5 ? 0 : shape(x, y, d))));
      }
  });
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

const VERTEX = `
attribute vec3 iPos; attribute vec4 iColor; attribute vec4 iAxis; attribute vec3 iSize;
uniform float cells;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vColor = iColor;
  vUv = vec2((uv.x + iSize.z) / cells, uv.y);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 forward = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec2 q = position.xy;
  float c = cos(iSize.y), s = sin(iSize.y);
  vec2 r = vec2(q.x * c - q.y * s, q.x * s + q.y * c) * iSize.x;
  // Camera-facing sprites are pulled toward the (orthographic) camera by about their own
  // size: an explosion centred inside a hull or building draws in front of the wreck instead
  // of being clipped by it, without moving on screen.
  vec3 world;
  if (iAxis.w < 0.5) world = iPos + right * r.x + up * r.y + forward * (iSize.x * 0.8 + 0.4);
  else if (iAxis.w < 1.5) {
    vec3 side = normalize(cross(iAxis.xyz, forward) + vec3(1e-5, 0.0, 0.0));
    world = iPos + iAxis.xyz * q.y + side * q.x * iSize.x + forward * 0.4;
  } else world = iPos + vec3(r.x, 0.0, r.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAGMENT = `
uniform sampler2D map;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = abs(vColor.a) * t.a;
  if (a < 0.004) discard;
  #ifdef MIXED_FX
    // Premultiplied normal and additive share one blend state. An additive
    // instance contributes RGB while preserving all of the destination.
    gl_FragColor = vec4(vColor.rgb * t.rgb * a, vColor.a < 0.0 ? 0.0 : a);
  #else
    gl_FragColor = vec4(vColor.rgb * t.rgb, a);
  #endif
}`;

// The pools keep their capacity, but only the live prefix needs to cross to the
// GPU. Retain pending data if several updates happen before a render.
function uploadPrefix(attribute, count) {
  let end = count * attribute.itemSize;
  for (const range of attribute.updateRanges) end = Math.max(end, range.start + range.count);
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, end);
  attribute.needsUpdate = true;
}

// Every field a particle record carries, set in one order so pooled records keep one shape.
function resetParticle(p, rng) {
  p.x = 0; p.y = 0; p.z = 0; p.vx = 0; p.vy = 0; p.vz = 0; p.age = 0; p.life = 1; p.s0 = 1; p.s1 = 1;
  p.rot = rng() * 6.28; p.spin = 0; p.c0 = WARM.flash; p.c1 = WARM.ember; p.mode = BILLBOARD;
  p.ax = 0; p.ay = 1; p.az = 0; p.length = 0; p.cell = CELL.glow; p.drag = 0; p.gravity = 0; p.floor = -10;
  p.opacity = 1; p.hold = 0; p.fadeIn = 0; p.anchor = null; p.lifted = false; p.delay = 0; p.hitScorch = false;
  p.priorityHit = false; p.owner = 0; // the token of a rocket that moves this record each frame (its flame halo); 0 when the record is reused
  return p;
}

class Layer {
  constructor(capacity, blending, renderOrder, texture) {
    this.capacity = capacity; // allocated size; `share` scales the live cap with quality
    this.share = () => 1;
    this.items = [];
    this.free = []; // expired records, reused by spawn()
    this.drawn = 0;
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.setAttribute("uv", quad.getAttribute("uv"));
    const attr = (name, n) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    };
    this.pos = attr("iPos", 3);
    this.color = attr("iColor", 4);
    this.axis = attr("iAxis", 4);
    this.size = attr("iSize", 3);
    this.attrs = [this.pos, this.color, this.axis, this.size];
    this.sent = false;
    g.instanceCount = 1;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, cells: { value: CELLS.length } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    quad.dispose();
  }
  // A live record reset to defaults; at the cap the oldest one is recycled.
  spawn(rng) {
    if (this.items.length >= Math.max(1, Math.round(this.capacity * this.share()))) this.free.push(this.items.shift());
    const p = resetParticle(this.free.pop() || {}, rng);
    this.items.push(p);
    return p;
  }
  update(dt, visible, target = this, offset = 0, additive = false) {
    let keep = 0, drawn = offset;
    const P = target.pos.array, C = target.color.array, A = target.axis.array, S = target.size.array;
    for (const p of this.items) {
      p.age += dt;
      if (p.age >= p.life) { this.free.push(p); continue; }
      this.items[keep++] = p;
      if (p.age < 0) continue; // delayed start
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp; p.vy = p.vy * damp - p.gravity * dt; p.vz *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy = 0; }
      p.rot += p.spin * dt;
      if (!visible(p.anchor)) continue;
      const t = p.age / p.life, k = Math.max(0, (t - p.hold) / (1 - p.hold));
      const fade = p.fadeIn > 0 ? Math.min(1, p.age / p.fadeIn) : 1;
      P[drawn * 3] = p.x; P[drawn * 3 + 1] = p.y; P[drawn * 3 + 2] = p.z;
      for (let j = 0; j < 4; j++) C[drawn * 4 + j] = p.c0[j] + (p.c1[j] - p.c0[j]) * k;
      C[drawn * 4 + 3] *= p.opacity * (additive ? -fade : fade);
      const len = p.length ? p.length : 0;
      A[drawn * 4] = p.ax * len; A[drawn * 4 + 1] = p.ay * len; A[drawn * 4 + 2] = p.az * len; A[drawn * 4 + 3] = p.mode;
      S[drawn * 3] = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) ** 2); S[drawn * 3 + 1] = p.rot; S[drawn * 3 + 2] = p.cell;
      drawn++;
    }
    this.items.length = keep;
    if (target !== this) {
      this.drawn = drawn - offset;
      this.mesh.visible = false;
      return drawn;
    }
    const previous = this.drawn;
    this.drawn = drawn;
    this.mesh.visible = drawn > 0;
    if (!drawn) {
      // Keep the invisible instance so shaders stay warm, without uploading the
      // same empty pools every frame. Clear it once when the last effect ends.
      if (!previous) return;
      S[0] = 0; C[3] = 0; drawn = 1;
    }
    // A still frame (dt 0: paused, or a frozen benchmark scene) moves and fades nothing: keep what was sent (R3-W).
    if (!(dt > 0) && drawn === previous && this.sent) return;
    this.sent = true;
    this.mesh.geometry.instanceCount = drawn;
    for (const a of this.attrs) uploadPrefix(a, drawn);
  }
  clear() { for (const p of this.items) this.free.push(p); this.items.length = 0; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const rgba = (hex, a = 1) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a];
const WARM = { flash: [1, 0.96, 0.82, 1], fire: [1, 0.78, 0.4, 1], ember: [0.85, 0.2, 0.04, 0], spark: [1, 0.88, 0.55, 1], sparkEnd: [1, 0.45, 0.12, 0] };
const SCORCH_COLOR = [0.03, 0.028, 0.025, 0.8], HIT_SCORCH_COLOR = [0.035, 0.03, 0.026, 0.78];
// Colours of the per-frame emitters (shared arrays: the pooled records only reference them).
const PAL = {
  flame: [1, 0.72, 0.24, 0.95], flameEnd: [0.7, 0.14, 0.04, 0], lick: [1, 0.85, 0.5, 0.8], lickEnd: [1, 0.3, 0.05, 0],
  ember: [1, 0.7, 0.3, 1], emberEnd: [1, 0.3, 0.05, 0],
  fireSmoke: [0.11, 0.1, 0.1, 0.8], fireSmokeEnd: [0.3, 0.29, 0.29, 0],
  damageSmoke: [0.17, 0.16, 0.16, 0.82], damageSmokeEnd: [0.42, 0.41, 0.4, 0],
  wreckSmoke: [0.12, 0.11, 0.11, 0.5], wreckSmokeEnd: [0.28, 0.27, 0.27, 0],
  trail: [0.82, 0.8, 0.77, 0.5], trailEnd: [0.7, 0.7, 0.7, 0],
  chunkTrail: [0.22, 0.2, 0.19, 0.5], chunkTrailEnd: [0.35, 0.34, 0.33, 0],
  // The Anti-tank rocket (R3-W): a pale smoke ribbon and the hot halo around its tail flame.
  ribbon: [0.93, 0.91, 0.86, 0.85], ribbonEnd: [0.78, 0.77, 0.75, 0], halo: [1, 0.7, 0.3, 1],
};
// Roof height of each building type (measured on the models), where its smoke and fire start.
const ROOF = { hq: 5.2, barracks: 3.8, foundry: 4.4, relay: 3.6, tower: 3.8 };

export class Effects {
  constructor(view) {
    this.view = view;
    this.touchTier = globalThis.matchMedia?.("(pointer: coarse)").matches === true;
    // The random source of the weapon kinds (src/fx-kinds): a seeded generator (the view reseeds it in reset()).
    this.rng = mulberry32(1482);
    this.texture = atlas();
    this.workTimers = new Map(); // per-Harvester countdown to its next spark
    this.workCursor = 0; // where the work-effect scan resumes, for fairness between busy Harvesters
    this.depositLive = new Map(); // resource id -> had stock last frame (for the shatter)
    // Buffers are allocated at High size; the live cap follows view.lowPower so a quality switch needs no rebuild.
    // Hit scorches share the decal pool with destruction scorches (combat-feedback.js SCORCH caps hits).
    this.decals = new Layer(64, THREE.NormalBlending, 1, this.texture);
    this.smoke = new Layer(420, THREE.NormalBlending, 5, this.texture);
    this.glow = new Layer(900, THREE.AdditiveBlending, 6, this.texture);
    if (this.touchTier) {
      this.phoneBatch = new Layer(64+420+900, THREE.CustomBlending, 5, this.texture);
      const mat = this.phoneBatch.material;
      mat.defines = { MIXED_FX: 1 };
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    }
    this.smoke.share = this.glow.share = () => this.budget;
    this.debrisMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.7, metalness: 0.3, emissive: 0x401a08, emissiveIntensity: 0.6 }),
      96,
    );
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.count = 1;
    this.debrisMesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
    this.debris = [];
    this.debrisFree = [];
    this.debrisDrawn = 0;
    this.projectiles = [];
    // Every rocket body in flight: one instanced draw, hidden while none flies (src/fx-kinds/rocket-body.js).
    this.rockets = new RocketBodies(48);
    this.rocketTokens = 0;
    // R3-X: shells, lobs, flak rounds, missiles and bombs in flight (pooled records, src/fx-kinds/ordnance.js),
    // all drawn by one instanced mesh hidden while none flies; the Barrage strikes already marked.
    this.ordnance = new OrdnanceBodies(64);
    this.rounds = [];
    this.roundFree = [];
    this.strikeState = new WeakMap();
    this.bodyScale = 1;
    this.timeline = [];
    this.emitters = new Map();
    this.burning = []; // damaged entities drawn this frame (smoke and fire), refilled in place
    this.emitShare = 1; // their shared emission budget (see update)
    this.time = 0;
    this.nextFlash = -Infinity;
    this.root = new THREE.Group();
    this.root.add(this.decals.mesh, this.smoke.mesh, this.glow.mesh, this.debrisMesh, this.rockets.mesh, this.ordnance.mesh);
    if (this.phoneBatch) this.root.add(this.phoneBatch.mesh);
    view.scene.add(this.root);
    this.dummy = new THREE.Object3D();
    // R3-FX: the weapon sprite sheets load when a battle starts (match-flow.js restart); until they have, the procedural effects are the fallback.
    this.sprites = new FxSprites(view, this, this.root);
    // Per-frame fog checks are cached per anchor in a map reused every frame.
    this.seen = new Map();
    this.frameSim = null;
    this.visible = (anchor) => {
      if (!anchor) return true;
      let v = this.seen.get(anchor);
      if (v === undefined) this.seen.set(anchor, (v = anchor.shot ? shotVisible(anchor, this.frameSim) : this.frameSim.isVisible(anchor)));
      return v;
    };
    this.sphere = new THREE.Sphere();
    this.nextCount = -1;
    this.particleCap = 24;
    this.particlePools = [this.glow, this.smoke, this.decals, { items: this.debris, free: this.debrisFree }];
    this.priorityCounts = new Uint16Array(5);
    this.selectedHits = new Set();
  }
  get debrisCapacity() { return this.view.lowPower ? 32 : 96; }
  get motion() { return this.view.activity.combat.motion; }
  get budget() { return this.view.lowPower || this.touchTier ? 0.6 : 1; }
  // The frame governor (governor.js) thins cosmetic emission on slow frames: calm 3/4, still 1/2.
  get governed() { const level = this.view.motionLevel; return level === 0 ? 0.5 : level === 1 ? 0.75 : 1; }
  count(n) { return Math.max(1, Math.round(n * 0.5 * this.budget * this.governed)); }
  ground(x, z) {
    const t = this.view.terrain;
    return t?.plateaus?.length ? t.heightAt(x, z) : 0;
  }
  allowFlash(now = performance.now()) {
    // Real presentation time keeps the same limit during Defence fast-forward.
    if (!this.motion || now < this.nextFlash) return false;
    this.nextFlash = now + 340;
    return true;
  }
  // -- particle helpers
  particle(layer, o) {
    const p = Object.assign(layer.spawn(this.rng), o);
    p.age = -(o.delay || 0);
    if (layer === this.glow && p.cell === CELL.flare && !this.allowFlash()) p.c0 = [0.75, 0.46, 0.19, 0.26];
    // On maps with plateaus every effect is lifted to the ground under it.
    const t = this.view.terrain;
    if (t?.plateaus?.length && !o.lifted && Number.isFinite(o.x) && Number.isFinite(o.z)) p.y = (o.y || 0) + t.heightAt(o.x, o.z);
    return p;
  }
  // The allocation-free path for per-frame emitters: a pooled record at (x, y above ground, z);
  // the caller sets the rest. `lifted` means y already includes the ground.
  emit(layer, x, y, z, anchor, lifted = false) {
    const p = layer.spawn(this.rng);
    p.x = x; p.y = lifted ? y : y + this.ground(x, z); p.z = z; p.anchor = anchor;
    return p;
  }
  // Damage emitters only run for buildings and machines on screen (last frame's camera frustum).
  onScreen(e, reach) {
    const batches = this.view.batches;
    if (!batches?.cull) return true;
    this.sphere.center.set(e.x, this.ground(e.x, e.z) + reach * 0.5, e.z);
    this.sphere.radius = reach + 3;
    return batches.frustum.intersectsSphere(this.sphere);
  }
  burst(layer, n, at, o, speed = [1, 2], up = 0) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2, e = this.rng() * 0.9 + 0.1, v = this.motion ? speed[0] + this.rng() * (speed[1] - speed[0]) : 0;
      const dir = { x: Math.cos(a) * e, y: Math.sqrt(1 - e * e) + up, z: Math.sin(a) * e };
      this.particle(layer, { ...o, x: at.x, y: at.y, z: at.z, vx: dir.x * v, vy: dir.y * v, vz: dir.z * v,
        life: 0.7 * o.life * (0.8 + this.rng() * 0.4), ...(typeof o.extra === "function" ? o.extra(i) : {}) });
    }
  }
  sparks(at, n, anchor, power = 1) {
    if (!this.motion) return;
    for (let i = 0; i < this.count(n); i++) {
      const a = this.rng() * Math.PI * 2, e = 0.3 + this.rng() * 0.7, v = (5 + this.rng() * 6) * power;
      const vx = Math.cos(a) * e * v, vy = (0.4 + this.rng()) * v * 0.7, vz = Math.sin(a) * e * v, len = Math.hypot(vx, vy, vz) || 1;
      this.particle(this.glow, { x: at.x, y: at.y, z: at.z, vx, vy, vz, gravity: 14, drag: 1.5, life: 0.25 + this.rng() * 0.3,
        mode: STRETCH, ax: vx / len, ay: vy / len, az: vz / len, length: 0.35 * power, s0: 0.07, s1: 0.04, cell: CELL.streak,
        c0: WARM.spark, c1: WARM.sparkEnd, floor: 0.05, anchor });
    }
  }
  // R3-X: the map's dust colour as a shared [r, g, b, alpha] array (alpha 0 for fade-outs, else the puff alpha), cached per map.
  dustColor(alpha = 0.55) {
    const id = this.view.terrain?.id;
    if (!this.dustCache || this.dustCache.id !== id) {
      const [r, g, b] = rgba(parseInt(themeFor(id).dust.slice(1), 16));
      this.dustCache = { id, on: [r, g, b, 0.55], off: [r, g, b, 0] };
    }
    return alpha > 0 ? this.dustCache.on : this.dustCache.off;
  }
  hitDust(at, n, anchor, size = 1, life = 1.1) {
    this.dust(at, n, anchor, size * SHOT_SCALE, life);
  }
  dust(at, n, anchor, size = 1, life = 1.1) {
    const [r, g, b] = rgba(parseInt(themeFor(this.view.terrain.id).dust.slice(1), 16));
    this.burst(this.smoke, this.count(n), at, { life, s0: 0.6 * size, s1: 2.2 * size, drag: 2.5, cell: CELL.puff,
      c0: [r, g, b, 0.55], c1: [r, g, b, 0], floor: 0.1, anchor, spin: (this.rng() - 0.5) * 0.6 }, [0.8 * size, 2 * size], 0.2);
  }
  // Chunks thrown by a blast: they arc, bounce on the ground (plateaus included), tumble to a
  // stop and shrink away. `trails` gives the first few a thin smoke trail while airborne.
  addDebris(at, n, anchor, power = 1, trails = 0) {
    if (!this.motion) return;
    const base = this.ground(at.x, at.z);
    for (let i = 0, count = this.count(n); i < count; i++) {
      if (this.debris.length >= this.debrisCapacity) this.debrisFree.push(this.debris.shift());
      const d = this.debrisFree.pop() || {};
      const a = this.rng() * Math.PI * 2, v = (1.5 + this.rng() * 3) * power;
      d.x = at.x; d.y = at.y + base; d.z = at.z; d.ground = base;
      d.vx = Math.cos(a) * v; d.vy = (3 + this.rng() * 4) * power; d.vz = Math.sin(a) * v;
      d.rx = this.rng() * 6; d.ry = this.rng() * 6; d.spin = (this.rng() - 0.5) * 14; d.age = 0;
      d.life = 1.12 + this.rng() * 0.84; d.scale = (0.45 + this.rng() * 0.75) * Math.sqrt(power);
      if (this.touchTier) {
        const chip = this.emit(this.smoke, d.x, d.y, d.z, anchor, true);
        chip.cell = CELL.scorch; chip.s0 = d.scale*0.52; chip.s1 = chip.s0*0.6;
        chip.vx = d.vx; chip.vy = d.vy; chip.vz = d.vz; chip.gravity = 16;
        chip.floor = base+0.08; chip.drag = 1.5; chip.life = d.life*0.7; chip.spin = d.spin;
        chip.c0 = [0.31,0.26,0.2,1]; chip.c1 = [0.15,0.14,0.12,0];
        this.debrisFree.push(d);
        continue;
      }
      d.anchor = anchor; d.trail = i < trails && this.budget === 1 ? 0 : -1;
      this.debris.push(d);
    }
  }
  decal(at, size, life, anchor, cell = CELL.scorch, color = SCORCH_COLOR, layer = this.decals, s0 = size, extra = {}) {
    return this.particle(layer, { x: at.x, y: 0.04 + layer.items.length * 0.0004, z: at.z, mode: GROUND, cell, s0, s1: size, life,
      c0: color, c1: [...color.slice(0, 3), 0], hold: 0.7, anchor, rot: this.rng() * 6.28, ...extra });
  }
  // A scorch left by a hit: fades over SCORCH.life seconds, capped (fewer in Eco); a hit on a
  // fresh scorch darkens and slightly widens that one instead of stacking a new decal.
  scorch(at, size, anchor, crater = false) {
    // R3-FX: a pooled sprite decal (scorch mark or crater, flat on the ground, fades over ~20 s) once the sheets have loaded.
    if (spritesReady(this)) return this.sprites.decal(at.x, at.z, size * (crater ? 1.5 : 1.35), crater, anchor);
    const items = this.decals.items, plan = scorchPlan(items, at.x, at.z, this.view.lowPower ? SCORCH.ecoCap : SCORCH.cap);
    if (plan.merge !== undefined) {
      const m = items[plan.merge];
      m.age = Math.min(m.age, m.life * 0.1);
      m.s0 = m.s1 = Math.min(Math.max(m.s1, size) * 1.06, size * 1.5);
      return m;
    }
    if (plan.evict !== undefined) items[plan.evict].age = items[plan.evict].life; // recycled on the next update
    const p = this.decal(at, size, SCORCH.life, anchor, CELL.scorch, HIT_SCORCH_COLOR);
    p.hold = SCORCH.hold;
    p.hitScorch = true;
    return p;
  }
  explosion(at, scale, anchor, heavy = true) {
    const m = this.motion;
    this.particle(this.glow, { ...at, cell: CELL.flare, s0: 3.6 * scale, s1: 4.4 * scale, life: 0.16, c0: WARM.flash, c1: [1, 0.6, 0.2, 0], anchor });
    this.particle(this.glow, { ...at, s0: 4.2 * scale, s1: 5.5 * scale, life: 0.176, c0: [1, 0.72, 0.38, 0.9], c1: [1, 0.35, 0.08, 0], anchor });
    this.burst(this.glow, this.count(8), at, { life: 0.6, s0: 1.1 * scale, s1: 3 * scale, drag: 3.5, c0: WARM.fire, c1: WARM.ember, anchor,
      spin: 1.5 }, [1.5 * scale, 4 * scale], 0.5);
    // Normal-blended fire body: stays saturated on bright ground where additive light washes out.
    this.burst(this.smoke, this.count(7), at, { life: 0.95, s0: 1.2 * scale, s1: 3.2 * scale, drag: 3, cell: CELL.puff,
      c0: [1, 0.6, 0.18, 0.95], c1: [0.2, 0.17, 0.15, 0], anchor, spin: 1, gravity: -1.2 }, [1.2 * scale, 3.2 * scale], 0.6);
    this.burst(this.smoke, this.count(6), { ...at, y: at.y + 0.3 }, { life: m ? 2.4 : 1, s0: 1.1 * scale, s1: 3.8 * scale, drag: 1.4,
      cell: CELL.puff, c0: [0.2, 0.19, 0.18, 0.78], c1: [0.36, 0.35, 0.34, 0], fadeIn: 0.12, delay: 0.06, anchor, gravity: -0.6,
      spin: 0.4 }, [0.6 * scale, 1.6 * scale], 1.2);
    this.sparks(at, heavy ? 10 : 5, anchor, scale);
    this.decal(at, 3.4 * scale, 12, anchor);
    if (heavy) this.addDebris(at, 7, anchor, scale, 2);
  }
  contactHit(at, anchor) {
    // A glint on the material, a couple of tiny chips, and dust only on the ground.
    this.particle(this.glow, { ...at, cell: CELL.flare, life: 0.075, s0: Math.min(0.56, (anchor?.targetWidth || 1.2) / 2), s1: 0.2, priorityHit: true,
      c0: WARM.flash, c1: WARM.sparkEnd, anchor });
    if (!this.motion) return;
    this.sparks(at, 2, anchor, 0.32);
    if (at.y < 2.2) this.hitDust({ ...at, y: 0.14 }, 1, anchor, 0.45, 0.26);
  }
  precisionShot(from, to, land, travel, anchor) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const moving = this.motion, life = moving ? travel : 0.075;
    const rendered = moving && spriteTracer(this, from, to, dx/len,dy/len,dz/len, travel, anchor);
    if (!rendered) {
      const width = (moving ? 0.11 : 0.11 * 0.7) * SHOT_SCALE;
      const body = { ...from, lifted: true, mode: STRETCH, ax: dx/len, ay: dy/len, az: dz/len,
        length: (moving ? Math.min(2, len) : len) * SHOT_SCALE, cell: CELL.streak, life, anchor, opacity: SHOT_SCALE };
      if (moving) Object.assign(body, { vx: dx/life, vy: dy/life, vz: dz/life });
      else Object.assign(body, { x: (from.x+to.x)/2, y: (from.y+to.y)/2, z: (from.z+to.z)/2 });
      this.particle(this.glow, { ...body, s0: width, s1: width, c0: WARM.flash, c1: [1,.85,.55,.8] });
      this.particle(this.glow, { ...from, cell: CELL.flare, s0: .7, s1: .24, life: .045, c0: WARM.flash, c1: WARM.sparkEnd, anchor });
    }
    this.timeline.push({ at: this.time + (moving ? travel : 0), run: () => this.contactHit(land, anchor) });
  }
  // A shell or rocket landing. Small arms (power 0) stay light: a spark and now and then a
  // dust puff. Tank shells, artillery and rockets (power from combat-feedback.js hitPower)
  // throw a white flash, a fireball rolling into smoke, sparks, dirt, debris chunks that arc
  // and bounce, a brief hot glow on the ground and a scorch that fades over ~14 s.
  hit(at, power, anchor, kind = "shell") {
    if (anchor?.direct) { this.contactHit(at, anchor); return; }
    if (power === true) power = 1;
    // R3-X: a hit high above the ground (a round meeting a flyer) bursts in the air: no dust, scorch or ground glow under it.
    // (`at.y` is above the local ground here, as for every particle that is not `lifted`.)
    const aloft = at.y > 2.2;
    if (!(power > 0)) {
      // R3-FX: a rifle round that lands throws the needle sparks of the beam-impact sheet, small (Eco: every other round).
      if (!aloft && (!this.view.lowPower || this.rng() < 0.5)) spriteSpark(this, at, anchor);
      this.particle(this.glow, { ...at, s0: 0.5, s1: 0.7, life: 0.07, c0: [1, 0.9, 0.6, 0.9], c1: [1, 0.5, 0.2, 0], anchor });
      this.sparks(at, 3, anchor, 0.45);
      // R3-X tracers: every rifle round that reaches the ground kicks a small dust puff (Eco: every other one).
      if (!aloft && this.rng() < (this.view.lowPower ? 0.5 : 1)) this.hitDust({ x: at.x, y: 0.25, z: at.z }, 1, anchor, 0.45, 0.7);
      return;
    }
    if (aloft) { airBurst(this, { x: at.x, y: at.y + this.ground(at.x, at.z), z: at.z }, anchor, Math.min(1.2, 0.5 + power * 0.5)); return; }
    const s = Math.min(power, (anchor?.targetWidth ?? Infinity) * 2 / 4.6), m = this.motion, top = { x: at.x, y: at.y + 0.35, z: at.z };
    // Keep the blast within two target widths with or without sprites.
    if (spriteImpact(this, kind, at, power, anchor)) {
      this.hitDust({ x: at.x, y: 0.3, z: at.z }, 2, anchor, 1.1 * s, 1.1);
      this.sparks(top, 8, anchor, s);
      this.addDebris(at, Math.round(4 * s), anchor, 0.85 * s, s >= 1 ? 2 : 0);
      this.scorch(at, 2.6 * s, anchor, kind === "artillery" || kind === "bomb" || kind === "firebomb");
      return;
    }
    // Reduced motion / combat motion off: a soft warm flare instead of the white-hot star (no flashing).
    this.particle(this.glow, { ...top, cell: CELL.flare, s0: 3.8 * s, s1: 4.6 * s, life: 0.12, c0: m ? WARM.flash : [1, 0.8, 0.5, 0.45], c1: [1, 0.6, 0.2, 0], anchor });
    this.particle(this.glow, { ...top, s0: 3.2 * s, s1: 4.2 * s, life: 0.176, c0: [1, 0.76, 0.42, 0.95], c1: [1, 0.35, 0.08, 0], anchor });
    // Fireball: a normal-blended body (stays saturated on bright ground) and additive licks.
    this.burst(this.smoke, this.count(7), top, { life: 0.8, s0: 1.3 * s, s1: 3.3 * s, drag: 3.2, cell: CELL.puff,
      c0: [1, 0.6, 0.18, 0.96], c1: [0.22, 0.18, 0.16, 0], anchor, spin: 1, gravity: -1.6 }, [1.3 * s, 3.2 * s], 0.75);
    this.burst(this.glow, this.count(5), top, { life: 0.5, s0: 1.1 * s, s1: 2.7 * s, drag: 3.5, c0: WARM.fire, c1: WARM.ember, anchor,
      spin: 1.5 }, [1.4 * s, 3.4 * s], 0.6);
    this.burst(this.smoke, this.count(4), { x: at.x, y: at.y + 0.7, z: at.z }, { life: m ? 2.1 : 0.9, s0: 1 * s, s1: 3.6 * s, drag: 1.4,
      cell: CELL.puff, c0: [0.19, 0.18, 0.17, 0.74], c1: [0.38, 0.37, 0.36, 0], fadeIn: 0.1, delay: 0.1, anchor, gravity: -0.8,
      spin: 0.4 }, [0.6 * s, 1.4 * s], 1.1);
    this.hitDust({ x: at.x, y: 0.3, z: at.z }, 2, anchor, 1.1 * s, 1.1);
    this.sparks(top, 8, anchor, s);
    this.addDebris(at, Math.round(4 * s), anchor, 0.85 * s, s >= 1 ? 2 : 0);
    // Hot ground: an orange glow that cools in about a second, then the scorch.
    this.decal(at, 2.2 * s, 0.96, anchor, CELL.glow, [1, 0.45, 0.1, 0.85], this.glow, 1.7 * s, { hold: 0.15, y: 0.08 });
    this.scorch(at, 2.6 * s, anchor);
  }
  // An Anti-tank rocket landing (src/fx-kinds/rocket.js), shaped by its target. On armour: a white-hot star,
  // the usual heavy hit, a fan of sparks thrown back off the plate, a few metal chips and a ring. On infantry or a
  // building (20 damage): a smaller burst. (ux, uz) is the rocket's heading, so the sparks fly back at the shooter's side.
  rocketImpact(p, ux = 0, uz = 0) {
    const at = p.land || p.to, anchor = p.anchor, top = { x: at.x, y: at.y + 0.2, z: at.z };
    if (anchor?.direct) { this.contactHit(at, anchor); return; }
    if (p.impact !== "armour") {
      this.particle(this.glow, { ...top, cell: CELL.flare, s0: 1.6, s1: 2, life: 0.1, c0: WARM.flash, c1: [1, 0.6, 0.2, 0], anchor });
      this.hit(at, 0.45, anchor, "rocket");
      return;
    }
    this.particle(this.glow, { ...top, cell: CELL.flare, s0: 4.6, s1: 5.4, life: 0.14, c0: [1, 1, 0.94, 1], c1: [1, 0.7, 0.3, 0], anchor });
    this.hit(at, 0.8, anchor, "rocket");
    if (!this.motion) return;
    for (let i = 0, n = this.count(9); i < n; i++) {
      const spread = (this.rng() - 0.5) * 2.2, v = 5 + this.rng() * 6, c = Math.cos(spread), s = Math.sin(spread);
      const vx = (-ux * c + uz * s) * v, vz = (-uz * c - ux * s) * v, vy = (1.5 + this.rng() * 3), l = Math.hypot(vx, vy, vz) || 1;
      this.particle(this.glow, { ...top, vx, vy, vz, gravity: 14, drag: 1.4, life: 0.3 + this.rng() * 0.25, mode: STRETCH,
        ax: vx / l, ay: vy / l, az: vz / l, length: 0.5, s0: 0.08, s1: 0.04, cell: CELL.streak, c0: [1, 0.95, 0.75, 1], c1: WARM.sparkEnd, floor: 0.05, anchor });
    }
    this.addDebris(at, 3, anchor, 0.7, 1);
  }
  // How brightly the rocket bodies are lit: the mission look's sun strength (night 0.42, storm 0.5), softened.
  rocketLight() {
    const state = this.view.mood?.state, def = state?.name ? MOOD_LOOKS[state.name] : null;
    return def ? 1 + (Math.max(0.55, 0.35 + def.sunI) - 1) * (state.k ?? 1) : 1;
  }
  // -- events
  // Muzzle and aim point of a shot, in world height (plateaus included). Rounds take
  // style.life seconds to fly, so the aim leads a moving target by its last-tick velocity;
  // otherwise shells land where the target was and look like misses.
  aim(e, sim) {
    const style = weaponStyle(e, sim?.factions?.[e.team]), t = this.view.terrain, ground = (x, z) => (t?.plateaus?.length ? t.heightAt(x, z) : 0);
    let tx = e.tx, tz = e.tz;
    const target = e.target != null ? sim?.get?.(e.target) : null, before = target && this.view.previous?.get(target.id);
    if (target && before && e.type !== "support") {
      const lead = Math.min(1, 3 / (Math.hypot(target.x - before.x, target.z - before.z) / 0.05 * style.life || Infinity));
      tx = target.x + (target.x - before.x) / 0.05 * style.life * lead;
      tz = target.z + (target.z - before.z) / 0.05 * style.life * lead;
    }
    const dx = tx - e.x, dz = tz - e.z, dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist, reach = Math.min(style.reach, dist * 0.45);
    const fx = e.x + nx * reach, fz = e.z + nz * reach;
    // Flyers fire and are hit at their altitude (shot events carry sAir / tAir, sim/combat.js).
    const from = { x: fx, y: (e.sAir ? e.sAir + 0.4 : style.height) + ground(fx, fz), z: fz, lifted: true };
    const land = { x: tx, y: (e.type === "support" || e.weapon === "tower" ? 1 : 0.95) + (e.tAir || 0), z: tz };
    const to = { ...land, y: land.y + ground(tx, tz), lifted: true };
    return { style, nx, nz, from, to, land };
  }
  // The shooter or the target is in fog: show only the end the player can see (a muzzle
  // flash, or the hit landing), never the path, so fog still hides positions.
  shotPartial(e, sim) {
    if (e.type === "support" || !sim?.isVisible) return;
    const { style, from, land } = this.aim(e, sim), heavy = style.kind === "cannon" || style.kind === "rocket";
    if (sim.isVisible({ x: e.x, z: e.z })) {
      const anchor = { x: e.x, z: e.z }, flash = heavy ? 1.4 : 0.7;
      this.particle(this.glow, { ...from, cell: CELL.flare, s0: flash, s1: flash * 1.2, life: heavy ? 0.11 : 0.06, c0: WARM.flash, c1: [1, 0.55, 0.15, 0], anchor });
    }
    if (sim.isVisible({ x: e.tx, z: e.tz })) {
      const anchor = { x: e.tx, z: e.tz, target: e.target, targetWidth: 2 * (sim?.get?.(e.target)?.radius || 0.75), direct: !groundSplashRadius(e, sim) }, power = style.hit ?? hitPower(e.weapon, style.kind);
      this.timeline.push({ at: this.time + style.life, run: () => this.hit(land, power, anchor, impactKind(weaponClass(e, style)) || (style.kind === "rocket" ? "rocket" : "shell")) });
    }
  }
  shot(e, sim) {
    const { style, nx, nz, from, to, land } = this.aim(e, sim);
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const travel = style.life, anchor = { ...e, shot: true, targetWidth: 2 * (sim?.get?.(e.target)?.radius || 0.75), direct: !groundSplashRadius(e, sim) };
    const kind = style.kind, m = this.motion;
    if (kind === "support") {
      // Engineer: cool white beam. Harvester repair: warm welding sparks. Medic: green.
      const engineer = e.weapon === "engineer", tint = e.weapon === "repair" || engineer ? [1, 0.69, 0.22, 0.95] : [0.5, 1, 0.75, 0.9];
      const repair = engineer || e.weapon === "repair";
      const width = anchor.targetWidth, glyphSize = Math.min(width * 0.72, 0.86);
      this.particle(this.smoke, { ...land, y: land.y + width*0.55, cell: repair ? CELL.wrench : CELL.cross,
        rot: 0, s0: glyphSize, s1: glyphSize, life: 0.48,
        c0: [tint[0], tint[1], tint[2], 0.58], c1: [tint[0], tint[1], tint[2], 0], anchor });
      const beamWidth = Math.min(0.16, width * 0.15);
      this.particle(this.glow, { lifted: true, x: (from.x+to.x)/2, y: (from.y+to.y)/2, z: (from.z+to.z)/2,
        mode: STRETCH, ax: dir.x/len, ay: dir.y/len, az: dir.z/len, length: len, cell: CELL.glow, anchor,
        s0: beamWidth, s1: beamWidth * 0.7, life: 0.34, c0: [tint[0],tint[1],tint[2],0.55], c1: [tint[0],tint[1],tint[2],0] });
      return;
    }
    if ((e.unit || e.weapon) === "ranger" && anchor.direct) {
      this.precisionShot(from, to, land, travel, anchor);
      return;
    }
    const cls = weaponClass(e, style);
    const power = style.hit ?? hitPower(e.weapon, kind);
    // A weapon with its own look (src/fx-kinds): the kind draws the muzzle, the rounds and the landing.
    const look = m && style.look ? LOOKS[style.look] : null;
    if (look) {
      const ux = dir.x / len, uy = dir.y / len, uz = dir.z / len, h = Math.hypot(ux, uz) || 1;
      look.spawn(this, e, this.rng, { from, to, land, ux, uy, uz, len, sx: -uz / h, sz: ux / h, nx, nz, travel, anchor, power, style, color: style.color });
      this.slope(e, to, anchor, m, travel);
      return;
    }
    const cannon = kind === "cannon", rocket = kind === "rocket";
    // R3-X: a shell (tank-class cannon) fires with a bigger flash and a heavier recoil puff (owner: "more dramatic, if cheap").
    const shell = cls === "shell";
    // Muzzle: star flare, hot glow and (for heavy weapons) a smoke puff drifting forward.
    const flash = (cannon ? (e.weapon === "tank" ? 1.9 : 1.4) : rocket ? 1 : 0.7) * (shell ? 1.45 : 1);
    this.particle(this.glow, { ...from, cell: CELL.flare, s0: flash, s1: flash * 1.2, life: cannon ? 0.11 : 0.06, c0: m ? WARM.flash : [1, 0.8, 0.5, 0.45],
      c1: [1, 0.55, 0.15, 0], anchor });
    this.particle(this.glow, { ...from, s0: flash * 1.5, s1: flash * 1.8, life: cannon ? 0.14 : 0.08, c0: [1, 0.72, 0.35, 0.7],
      c1: [1, 0.4, 0.1, 0], anchor });
    if ((cannon || rocket) && m && this.budget === 1) {
      const back = rocket ? -1 : 1;
      for (let i = 0; i < this.count(shell ? 5 : 3); i++)
        this.particle(this.smoke, { lifted: true, x: from.x - (rocket ? nx * 1.4 : 0), y: from.y, z: from.z - (rocket ? nz * 1.4 : 0),
          vx: nx * back * (1.5 + i * 0.6), vy: 0.5 + this.rng() * 0.4, vz: nz * back * (1.5 + i * 0.6), drag: 2.2,
          life: (shell ? 1.2 : 0.9) + this.rng() * 0.4, s0: shell ? 0.6 : 0.45, s1: shell ? 2.4 : 1.7, cell: CELL.puff, c0: [0.6, 0.58, 0.55, 0.5], c1: [0.55, 0.55, 0.55, 0],
          anchor, spin: 0.8 });
      // A big gun's blast kicks up the ground under the muzzle.
      if (cannon && e.weapon !== "tower" && !e.sAir) this.dust({ x: from.x, y: 0.25, z: from.z }, 1, anchor, 0.8, 0.8);
    }
    // R3-FX: a sprite muzzle flash, turned along the barrel (large for a Tank and the Breaker, medium for other cannons and rockets).
    if ((cannon || rocket) && m) spriteMuzzle(this, from, dir.x / len, dir.y / len, dir.z / len, e.weapon === "tank" || cls === "lob" ? "large" : "medium", anchor);
    // Projectile: a streak (and shell/rocket glow) flying to the target; reduced motion
    // shows a brief static tracer along the whole path instead.
    const width = cannon ? 0.34 : rocket ? 0.2 : 0.11, tail = cannon ? 2.4 : rocket ? 1.3 : 2;
    const color = style.color ?? (cannon ? [1, 0.78, 0.4, 1] : rocket ? [1, 0.85, 0.6, 1] : [1, 0.9, 0.6, 1]);
    if (m && (cls === "shell" || cls === "lob" || cls === "flak")) {
      // R3-X: a glowing round in flight (the ordnance mesh), a short smoke trail and a slight arc (a high lob for
      // artillery, a red warning ring where it will land; a fast round and flak bursts at a flyer).
      const ux = dir.x / len, uy = dir.y / len, uz = dir.z / len, h = Math.hypot(ux, uz) || 1;
      const a = { from, to, land, sx: -uz / h, sz: ux / h, travel, anchor, power };
      launch(this, cls, a, e);
      if (cls === "lob") warnRing(this, land.x, land.z, 1.6, travel, anchor);
      if (cls === "flak") this.particle(this.glow, { ...from, vx: dir.x / travel, vy: dir.y / travel, vz: dir.z / travel, mode: STRETCH, ax: ux, ay: uy, az: uz,
        opacity: SHOT_SCALE, length: Math.min(1.6, len) * SHOT_SCALE, s0: 0.12 * SHOT_SCALE, s1: 0.12 * SHOT_SCALE, life: travel, cell: CELL.streak, c0: [1, 0.85, 0.5, 1], c1: [1, 0.7, 0.4, 0.6], anchor });
    } else if (m) {
      const v = { vx: dir.x / travel, vy: dir.y / travel, vz: dir.z / travel };
      this.particle(this.glow, { ...from, ...v, mode: STRETCH, ax: dir.x / len, ay: dir.y / len, az: dir.z / len,
        opacity: SHOT_SCALE, length: Math.min(tail, len) * SHOT_SCALE, s0: width * SHOT_SCALE, s1: width * SHOT_SCALE, life: travel, cell: CELL.streak, c0: color, c1: [...color.slice(0, 3), 0.8], anchor });
      if (cannon || rocket)
        this.particle(this.glow, { ...from, ...v, opacity: SHOT_SCALE, s0: (cannon ? 0.75 : 0.55) * SHOT_SCALE, s1: (cannon ? 0.75 : 0.55) * SHOT_SCALE, life: travel, c0: [1, 0.85, 0.5, 1],
          c1: [1, 0.7, 0.4, 1], anchor });
      // R3-X tracer: a thin streak with a small white-hot head, so a rifle round reads as a bright dash, not a smear.
      else this.particle(this.glow, { ...from, ...v, opacity: SHOT_SCALE, s0: 0.24 * SHOT_SCALE, s1: 0.2 * SHOT_SCALE, life: travel, c0: [1, 0.97, 0.85, 0.95], c1: [...color.slice(0, 3), 0.7], anchor });
      this.projectiles.push({ from, to, land, travel, age: 0, rocket, cannon, power, anchor, trail: 0, weapon: e.weapon, kind: impactKind(cls) || (rocket ? "rocket" : "shell") });
    } else {
      this.particle(this.glow, { lifted: true, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2, mode: STRETCH,
        ax: dir.x / len, ay: dir.y / len, az: dir.z / len, opacity: SHOT_SCALE, length: len * SHOT_SCALE, s0: width * 0.7 * SHOT_SCALE, s1: width * 0.7 * SHOT_SCALE, life: 0.1,
        cell: CELL.glow, c0: [...color.slice(0, 3), 0.7], c1: [...color.slice(0, 3), 0], anchor });
      this.hit(land, power, anchor, impactKind(cls) || (rocket ? "rocket" : "shell"));
    }
    // High ground: a shot fired down lands with a small gold flare, one fired up with a dull puff.
    const slope = e.sAir || e.tAir ? 0 : shotSlope(this.view.terrain, e.x, e.z, e.tx, e.tz);
    if (slope) this.timeline.push({ at: this.time + (m ? travel : 0), run: () => slope > 0
      ? this.particle(this.glow, { ...to, cell: CELL.flare, s0: 1.2, s1: 0.35, life: 0.24, c0: [1, 0.86, 0.4, 0.95], c1: [1, 0.7, 0.2, 0], anchor })
      : this.particle(this.smoke, { ...to, vy: m ? 0.4 : 0, s0: 0.35 * SHOT_SCALE, s1: 0.9 * SHOT_SCALE, life: 0.45, cell: CELL.puff, c0: [0.5, 0.5, 0.48, 0.4], c1: [0.5, 0.5, 0.5, 0], anchor }) });
  }
  // High ground for the shots drawn by a weapon kind (the same flare or puff as above).
  slope(e, to, anchor, m, travel) {
    const slope = e.sAir || e.tAir ? 0 : shotSlope(this.view.terrain, e.x, e.z, e.tx, e.tz);
    if (slope) this.timeline.push({ at: this.time + travel, run: () => slope > 0
      ? this.particle(this.glow, { ...to, cell: CELL.flare, s0: 1.2, s1: 0.35, life: 0.24, c0: [1, 0.86, 0.4, 0.95], c1: [1, 0.7, 0.2, 0], anchor })
      : this.particle(this.smoke, { ...to, vy: m ? 0.4 : 0, s0: 0.35 * SHOT_SCALE, s1: 0.9 * SHOT_SCALE, life: 0.45, cell: CELL.puff, c0: [0.5, 0.5, 0.48, 0.4], c1: [0.5, 0.5, 0.5, 0], anchor }) });
  }
  // Counter-hit feedback (src/counter-hit-view.js): a gold flare on an effective hit, a grey puff on a resisted one.
  counterHit(at, anchor, effective) { (effective ? crit : resisted)(this, this.rng, at, anchor); }
  // -- celebration effects: a unit arriving, a building finishing, an upgrade, a cargo drop-off.
  // A handful of pooled particles each (halved in Eco, still when combat motion is off), team coloured.
  tint(team) {
    const hex = this.view.colors[team] ?? 0xb8b2a4;
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }
  spawn(e) {
    const [r, g, b] = this.tint(e.team), anchor = { x: e.x, z: e.z, team: e.team };
    this.decal({ x: e.x, z: e.z }, 2.4, 0.45, anchor, CELL.ring, [r, g, b, 0.85], this.glow, 0.4, { hold: 0, y: 0.1 });
    this.particle(this.glow, { x: e.x, y: 0.9, z: e.z, cell: CELL.flare, s0: 1.8, s1: 0.4, life: 0.3, c0: [1, 1, 1, 0.9], c1: [r, g, b, 0], anchor });
    for (let i = 0; i < this.count(3); i++)
      this.particle(this.glow, { x: e.x + (this.rng() - 0.5) * 0.9, y: 0.2, z: e.z + (this.rng() - 0.5) * 0.9, vy: this.motion ? 2.4 + this.rng() : 0,
        drag: 1.2, life: 0.5 + this.rng() * 0.2, s0: 0.35, s1: 0.05, c0: [r, g, b, 0.9], c1: [r, g, b, 0], anchor, delay: i * 0.04 });
  }
  built(e) {
    const [r, g, b] = this.tint(e.team), anchor = { x: e.x, z: e.z, team: e.team }, size = e.radius * 1.15;
    this.decal({ x: e.x, z: e.z }, size * 3, 0.7, anchor, CELL.ring, [r, g, b, 0.8], this.glow, size * 0.6, { hold: 0, y: 0.1 });
    this.decal({ x: e.x, z: e.z }, size * 2.1, 0.5, anchor, CELL.ring, [1, 0.95, 0.8, 0.7], this.glow, size * 0.4, { hold: 0, y: 0.12, delay: 0.08 });
    this.particle(this.glow, { x: e.x, y: e.radius * 0.6, z: e.z, cell: CELL.flare, s0: size * 1.6, s1: size * 0.5, life: 0.35, c0: [1, 0.97, 0.85, 0.95], c1: [r, g, b, 0], anchor });
    this.dust({ x: e.x, y: 0.25, z: e.z }, 4, anchor, 0.9 + e.radius * 0.12, 1);
    for (let i = 0; i < this.count(5); i++) {
      const a = (i / 5) * Math.PI * 2 + this.rng() * 0.6, d = e.radius * (0.6 + this.rng() * 0.5);
      this.particle(this.glow, { x: e.x + Math.cos(a) * d, y: 0.3, z: e.z + Math.sin(a) * d, vy: this.motion ? 3.2 + this.rng() * 2 : 0,
        drag: 1.4, life: 0.6 + this.rng() * 0.3, s0: 0.3, s1: 0.05, cell: CELL.flare, c0: [1, 0.95, 0.7, 0.9], c1: [r, g, b, 0], anchor, delay: i * 0.05 });
    }
  }
  levelup(e) {
    const anchor = { x: e.x, z: e.z, team: e.team }, [r, g, b] = this.tint(e.team);
    for (let i = 0; i < this.count(3); i++)
      this.particle(this.glow, { x: e.x, y: 0.4 + i * 1.1, z: e.z, cell: CELL.ring, s0: e.radius * 1.1, s1: e.radius * 0.7, life: 0.55,
        c0: [1, 0.86, 0.4, 0.85], c1: [r, g, b, 0], anchor, delay: i * 0.12, vy: this.motion ? 1.5 : 0 });
    this.particle(this.glow, { x: e.x, y: e.radius * 1.2, z: e.z, cell: CELL.flare, s0: 2.6, s1: 0.6, life: 0.45, c0: [1, 0.95, 0.6, 0.95], c1: [1, 0.7, 0.2, 0], anchor, delay: 0.1 });
  }
  deliver(e) {
    // Cargo drop-off: a small coloured glint at the depot (amber alloy, blue energy).
    const energy = e.resource === "energy", c0 = energy ? [0.5, 0.88, 1, 0.9] : [1, 0.78, 0.3, 0.9], c1 = energy ? [0.3, 0.7, 1, 0] : [1, 0.55, 0.1, 0];
    const at = { x: e.tx ?? e.x, y: 1.6, z: e.tz ?? e.z }, anchor = { x: e.x, z: e.z, team: e.team };
    this.particle(this.glow, { ...at, cell: CELL.flare, s0: 0.9, s1: 0.2, life: 0.28, c0, c1, anchor });
    for (let i = 0; i < this.count(2); i++)
      this.particle(this.glow, { x: at.x + (this.rng() - 0.5) * 0.8, y: at.y, z: at.z + (this.rng() - 0.5) * 0.8, vy: this.motion ? 1.8 : 0, drag: 1,
        life: 0.4 + this.rng() * 0.15, s0: 0.22, s1: 0.04, c0, c1, anchor, delay: i * 0.05 });
  }
  // -- veterancy and abilities (events from sim/tactics.js; fog is checked by the caller)
  promote(e) {
    // A promotion: a gold ring opening at the unit's feet, a glint overhead and rising motes.
    const anchor = { x: e.x, z: e.z, team: e.team }, gold = [1, 0.84, 0.4];
    this.decal({ x: e.x, z: e.z }, 3.4, 0.6, anchor, CELL.ring, [...gold, 0.9], this.glow, 0.6, { hold: 0, y: 0.1 });
    this.particle(this.glow, { x: e.x, y: 2.2, z: e.z, cell: CELL.flare, s0: 2.2, s1: 0.5, life: 0.4, c0: [1, 0.97, 0.8, 0.95], c1: [...gold, 0], anchor });
    for (let i = 0; i < this.count(4); i++)
      this.particle(this.glow, { x: e.x + (this.rng() - 0.5) * 0.9, y: 0.5, z: e.z + (this.rng() - 0.5) * 0.9, vy: this.motion ? 2.6 + this.rng() : 0,
        drag: 1.1, life: 0.6 + this.rng() * 0.2, s0: 0.32, s1: 0.05, cell: CELL.flare, c0: [...gold, 0.95], c1: [...gold, 0], anchor, delay: i * 0.05 });
  }
  ability(e) {
    const anchor = { x: e.x, z: e.z, team: e.team };
    const tint = { shieldwall: [0.42, 0.8, 1], focus: [1, 0.8, 0.3], overdrive: [1, 0.5, 0.2], lockon: [0.84, 0.56, 1], triage: [0.5, 1, 0.72], fortify: [0.75, 0.9, 1], barrage: [1, 0.8, 0.45], rush: [1, 0.62, 0.3], dash: [1, 0.85, 0.4], brace: [0.55, 0.8, 1], mark: [0.8, 0.55, 1], burnline: [1, 0.5, 0.12] }[e.ability] || e.tint || [1, 1, 1];
    // Ability moments (src/fx-kinds/moments.js): a wake, a shockwave, an exhaust, a glint, on top of the flash below.
    if (this.motion && Object.hasOwn(MOMENTS, e.ability)) MOMENTS[e.ability](this, e, this.rng, tint, anchor);
    if (e.ability === 'triage' || e.ability === 'fortify') {
      // A pulse that opens to the ability's reach (the ring sits at 0.8 of the sprite's half width).
      this.decal({ x: e.x, z: e.z }, (e.radius || 6) * 2.5, 0.7, anchor, CELL.ring, [...tint, 0.85], this.glow, 1, { hold: 0, y: 0.1 });
      for (let i = 0; i < this.count(5); i++) {
        const a = this.rng() * Math.PI * 2, d = this.rng() * (e.radius || 6) * 0.7;
        this.particle(this.glow, { x: e.x + Math.cos(a) * d, y: 0.4, z: e.z + Math.sin(a) * d, vy: this.motion ? 1.6 + this.rng() : 0, drag: 1, life: 0.7 + this.rng() * 0.2,
          s0: 0.3, s1: 0.06, cell: CELL.flare, c0: [...tint, 0.9], c1: [...tint, 0], anchor, delay: i * 0.04 });
      }
    } else if (e.ability === 'burnline' && Number.isFinite(e.tx)) {
      // Burning ground: a scorch and a glowing ring for as long as it burns, with flames rising inside it.
      const at = { x: e.tx, z: e.tz }, r = e.radius || 3, life = e.duration || 6, zone = { x: e.tx, z: e.tz, team: e.team };
      this.decal(at, r * 2.3, life + 4, zone);
      this.decal(at, r * 2.5, life, zone, CELL.ring, [...tint, 0.8], this.glow, r * 2.5, { hold: 0.85, y: 0.1 });
      for (let i = 0; i < this.count(14); i++) {
        const a = this.rng() * Math.PI * 2, d = Math.sqrt(this.rng()) * r * 0.85;
        this.particle(this.glow, { x: at.x + Math.cos(a) * d, y: 0.3, z: at.z + Math.sin(a) * d, vy: this.motion ? 1.4 + this.rng() : 0, drag: 0.8, life: 0.7 + this.rng() * 0.4,
          s0: 0.9, s1: 0.2, cell: CELL.flare, c0: [1, 0.72, 0.25, 0.9], c1: [1, 0.3, 0.05, 0], anchor: zone, delay: (i / 14) * life });
      }
    } else if (e.ability === 'mark' && Number.isFinite(e.tx)) {
      // The mark lands on the target, not on the Watcher.
      const target = { x: e.tx, z: e.tz, team: e.team };
      this.decal({ x: e.tx, z: e.tz }, 2.6, 1.2, target, CELL.ring, [...tint, 0.95], this.glow, 5, { hold: 0.4, y: 0.1 });
      this.particle(this.glow, { x: e.tx, y: 1.6, z: e.tz, cell: CELL.flare, s0: 1.6, s1: 0.3, life: 0.5, c0: [1, 1, 1, 0.9], c1: [...tint, 0], anchor: target });
    } else if (e.ability === 'barrage') {
      // The launch: a flash and a streak climbing out of the Breaker.
      this.particle(this.glow, { x: e.x, y: 1.8, z: e.z, cell: CELL.flare, s0: 2.2, s1: 2.6, life: 0.14, c0: WARM.flash, c1: [1, 0.55, 0.15, 0], anchor });
      if (this.motion) this.particle(this.glow, { x: e.x, y: 2.2, z: e.z, vy: 26, mode: STRETCH, ax: 0, ay: 1, az: 0, length: 2.6, s0: 0.3, s1: 0.2, life: 0.35,
        cell: CELL.streak, c0: [...tint, 1], c1: [...tint, 0], anchor });
      this.dust({ x: e.x, y: 0.3, z: e.z }, 3, anchor, 0.9, 0.9);
    } else {
      this.decal({ x: e.x, z: e.z }, 3.2, 0.4, anchor, CELL.ring, [...tint, 0.9], this.glow, 0.8, { hold: 0, y: 0.1 });
      this.particle(this.glow, { x: e.x, y: 1.3, z: e.z, cell: CELL.flare, s0: 1.9, s1: 0.4, life: 0.3, c0: [1, 1, 1, 0.9], c1: [...tint, 0], anchor });
    }
  }
  // Faction signals: a hidden unit coming into view, and alloy pulled from a wreck.
  factionMark(e) {
    const anchor = { x: e.x, z: e.z, team: e.team }, tint = e.type === 'salvage' ? [1, 0.7, 0.3] : [0.8, 0.55, 1];
    this.decal({ x: e.x, z: e.z }, 2.8, 0.5, anchor, CELL.ring, [...tint, 0.9], this.glow, 0.5, { hold: 0, y: 0.1 });
    this.glint({ x: e.x, y: 0.9, z: e.z }, [...tint, 1], [...tint, 0], anchor, e.type === 'salvage' ? 6 : 4, 0.7);
    if (e.type !== 'salvage' && this.motion) shimmer(this, e, this.rng, tint, anchor); // the decloak shimmer
  }
  strike(e) {
    // A Barrage shell landing: one heavy blast and a shockwave out to the damage radius.
    // A heavy blast, a fire column climbing out of it, dirt thrown wide, a ring out to the
    // damage radius, a shower of debris and a wide crater scorch.
    const anchor = { x: e.x, z: e.z, team: e.team }, r = e.radius || 4, m = this.motion;
    // R3-FX: the artillery-blast sheet (sized to the damage radius) replaces the procedural fireball; the crater is a decal.
    if (spriteImpact(this, "bomb", { x: e.x, y: 0.3, z: e.z }, 1, anchor, 0, Math.max(0.8, r / 5))) {
      this.sparks({ x: e.x, y: 1.2, z: e.z }, 10, anchor, 1.6);
      this.hitDust({ x: e.x, y: 0.3, z: e.z }, 5, anchor, 1.6, 1.6);
      this.addDebris({ x: e.x, y: 0.8, z: e.z }, 10, anchor, 1.45, 3);
      this.scorch({ x: e.x, z: e.z }, r * 1.1, anchor, true);
      return;
    }
    this.explosion({ x: e.x, y: 0.9, z: e.z }, 2.1, anchor, true);
    this.burst(this.smoke, this.count(8), { x: e.x, y: 1.4, z: e.z }, { life: m ? 1.5 : 0.8, s0: 1.8, s1: 4.6, drag: 1.2, cell: CELL.puff,
      c0: [1, 0.56, 0.16, 0.96], c1: [0.18, 0.15, 0.13, 0], anchor, gravity: m ? -4.5 : 0, spin: 0.6 }, [0.5, 1.6], 2.6);
    this.decal({ x: e.x, z: e.z }, r * 0.9, 1.4, anchor, CELL.glow, [1, 0.42, 0.08, 0.9], this.glow, r * 0.7, { hold: 0.2, y: 0.08 });
    this.hitDust({ x: e.x, y: 0.3, z: e.z }, 7, anchor, 1.6, 1.6);
    this.addDebris({ x: e.x, y: 0.8, z: e.z }, 10, anchor, 1.45, 3);
    this.decal({ x: e.x, z: e.z }, r * 1.35, 16, anchor, CELL.scorch, SCORCH_COLOR, this.decals, r * 1.35, { hold: 0.45 });
  }
  // -- continuous work effects, rate-limited per worker and capped per frame (halved in Eco)
  glint(at, c0, c1, anchor, n, power = 1) {
    for (let i = 0; i < this.count(n); i++) {
      const a = this.rng() * Math.PI * 2, v = (2.4 + this.rng() * 3.2) * power, vx = Math.cos(a) * v, vz = Math.sin(a) * v, vy = (1.2 + this.rng() * 2.4) * power;
      const len = Math.hypot(vx, vy, vz) || 1;
      this.particle(this.glow, { x: at.x, y: at.y, z: at.z, vx, vy, vz, gravity: 11, drag: 1.2, life: 0.22 + this.rng() * 0.22, mode: STRETCH,
        ax: vx / len, ay: vy / len, az: vz / len, length: 0.5 * power, s0: 0.1, s1: 0.04, cell: CELL.streak, c0, c1, floor: 0.05, anchor });
    }
  }
  work(sim, dt) {
    if (!this.motion || dt <= 0) return;
    const limit = this.view.lowPower ? 6 : 12, gap = this.view.lowPower ? 1.5 : 1, all = sim.entities, total = all.length;
    let n = 0, i = 0;
    if (this.workTimers.size > 96) this.workTimers.clear();
    // The cap counts effects emitted, not workers seen, and the scan starts where the last one stopped,
    // so every working Harvester gets its turn however many are busy.
    for (; i < total && n < limit; i++) {
      const e = all[(this.workCursor + i) % total];
      if (e.type !== "worker" || e.hp <= 0 || !e.working || e.moving) continue;
      const o = e.orders[0];
      if (!o) continue;
      let kind = null, target = null;
      if (o.type === "gather") { if (isHarvesting(sim, e)) { kind = "mine"; target = harvestTarget(sim, e); } }
      else if (o.type === "build") { target = sim.get(o.target); if (target && target.kind === "building" && !target.complete && target.hp > 0) kind = "build"; }
      if (!kind || !sim.isVisible(e)) continue;
      const left = (this.workTimers.get(e.id) ?? this.rng() * 0.25) - dt;
      if (left > 0) { this.workTimers.set(e.id, left); continue; }
      n++;
      this.workTimers.set(e.id, (kind === "mine" ? 0.26 : 0.17) * gap * (0.8 + this.rng() * 0.4));
      const dx = target.x - e.x, dz = target.z - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, anchor = { x: e.x, z: e.z, team: e.team };
      if (kind === "mine") {
        // Chips fly off the crystal face the Harvester is working, in the deposit's own colour.
        const energy = target.type === "energy", reach = Math.max(0.3, d - target.radius * 0.75);
        const at = { x: e.x + ux * reach, y: 0.8 + this.rng() * 0.5, z: e.z + uz * reach };
        this.glint(at, energy ? [0.6, 0.92, 1, 1] : [1, 0.82, 0.38, 1], energy ? [0.3, 0.7, 1, 0] : [1, 0.5, 0.12, 0], anchor, 2, 0.9);
        this.particle(this.glow, { ...at, cell: CELL.flare, s0: 0.5, s1: 0.1, life: 0.16, c0: energy ? [0.7, 0.95, 1, 0.9] : [1, 0.9, 0.55, 0.9], c1: energy ? [0.3, 0.7, 1, 0] : [1, 0.5, 0.1, 0], anchor });
      } else {
        // Welding: white-hot sparks and a puff of site dust where the Harvester meets the frame.
        const reach = Math.max(0.3, d - target.radius * 0.85), at = { x: e.x + ux * reach, y: 0.9 + this.rng() * 0.8, z: e.z + uz * reach };
        this.glint(at, [1, 0.97, 0.8, 1], [1, 0.6, 0.15, 0], anchor, 3, 1);
        this.particle(this.glow, { ...at, cell: CELL.flare, s0: 0.7, s1: 0.15, life: 0.12, c0: [1, 1, 0.9, 0.95], c1: [1, 0.7, 0.3, 0], anchor });
        if (this.rng() < 0.4) this.dust({ x: at.x, y: 0.25, z: at.z }, 1, anchor, 0.55, 0.9);
      }
    }
    this.workCursor = total ? (this.workCursor + i) % total : 0;
  }
  shatter(r) {
    // A deposit running dry: its crystals burst into glints and a faint ring.
    const energy = r.type === "energy", anchor = { x: r.x, z: r.z, team: -1 }, c0 = energy ? [0.6, 0.92, 1, 1] : [1, 0.82, 0.38, 1], c1 = energy ? [0.3, 0.7, 1, 0] : [1, 0.5, 0.12, 0];
    this.decal({ x: r.x, z: r.z }, r.radius * 3, 0.6, anchor, CELL.ring, [c0[0], c0[1], c0[2], 0.7], this.glow, r.radius * 0.8, { hold: 0, y: 0.1 });
    this.particle(this.glow, { x: r.x, y: 1, z: r.z, cell: CELL.flare, s0: r.radius * 2, s1: r.radius * 0.5, life: 0.3, c0: [1, 1, 0.92, 0.95], c1, anchor });
    if (this.motion) this.glint({ x: r.x, y: 0.9, z: r.z }, c0, c1, anchor, 9, 1.4);
    this.dust({ x: r.x, y: 0.3, z: r.z }, 3, anchor, 1, 1);
  }
  impact(e) {
    const at = { x: e.x, y: e.building ? 2.2 : 1.1, z: e.z }, anchor = { x: e.x, z: e.z, team: e.team, target: e.seed };
    if (e.shield) {
      // Shield: a cyan ripple shell and flash where the round is stopped.
      this.particle(this.glow, { ...at, priorityHit: true, cell: CELL.glow, s0: 0.75, s1: 0.35, life: 0.3,
        c0: [0.55, 0.92, 1, 0.9], c1: [0.35, 0.75, 1, 0], anchor, delay: 0.05 });
      this.particle(this.glow, { ...at, s0: 1.3, s1: 1.8, life: 0.14, c0: [0.5, 0.9, 1, 0.55], c1: [0.4, 0.8, 1, 0], anchor, delay: 0.05 });
    } else {
      this.sparks(at, 4, anchor, 0.7);
      this.particle(this.smoke, { ...at, priorityHit: true, vy: this.motion ? 0.8 : 0, s0: 0.4 * SHOT_SCALE, s1: 1.2 * SHOT_SCALE, life: 0.6, cell: CELL.puff,
        c0: [0.35, 0.34, 0.32, 0.45], c1: [0.4, 0.4, 0.4, 0], anchor, delay: 0.05 });
    }
  }
  // R3-X: a flyer shot down bursts where it flies (a flash, a puff of black smoke, sparks and chips), not on the
  // ground under it; the wreck (the unit's own model, src/view.js updateDying) then spins down trailing smoke.
  airKill(e, o) {
    const anchor = { x: e.x, z: e.z, team: e.team }, y = o.position.y + (o.userData.model?.position?.y ?? 3), at = { x: e.x, y, z: e.z }, m = this.motion;
    airBurst(this, at, anchor, 1.4);
    flakBurst(this, at, anchor, 2, 0.6, 1.1);
    if (m) this.burst(this.glow, this.count(5), { ...at, y: y - this.ground(e.x, e.z) }, { life: 0.45, s0: 0.9, s1: 2.2, drag: 3.5, c0: WARM.fire, c1: WARM.ember, anchor, spin: 1.5 }, [1.2, 3], 0.3);
    this.addDebris({ x: e.x, y: y - this.ground(e.x, e.z), z: e.z }, 3, anchor, 0.6, 1);
  }
  airWrecks(dying, dt) {
    const m = this.motion, gap = this.view.lowPower ? 0.07 : 0.04;
    for (let i = 0; i < dying.length; i++) {
      const d = dying[i];
      if (d.kind !== 'air' || d.crashed) continue;
      const o = d.object, y = o.position.y + (o.userData.model?.position?.y ?? 0);
      if (d.age >= 0.9) {
        // The crash: dust thrown up, a small fireball and a scorch under the wreck.
        d.crashed = true;
        if (!this.visible(d)) continue;
        this.explosion({ x: d.x, y: 0.6, z: d.z }, 0.6, d, false);
        this.dust({ x: d.x, y: 0.3, z: d.z }, 4, d, 1.2, 1.3);
        continue;
      }
      if (!m || !(dt > 0)) continue;
      d.smokeT = (d.smokeT || 0) + dt;
      while (d.smokeT >= gap) {
        d.smokeT -= gap;
        const p = this.emit(this.smoke, d.x + (this.rng() - 0.5) * 0.3, y + 0.2, d.z + (this.rng() - 0.5) * 0.3, d, true);
        p.vy = 0.5; p.drag = 0.8; p.life = 1.1; p.s0 = 0.45; p.s1 = 1.5; p.cell = CELL.puff; p.c0 = PAL.fireSmoke; p.c1 = PAL.fireSmokeEnd; p.spin = 0.8;
        const f = this.emit(this.glow, d.x, y, d.z, d, true);
        f.life = 0.18; f.s0 = 0.8; f.s1 = 0.3; f.c0 = PAL.lick; f.c1 = PAL.lickEnd;
      }
    }
  }
  death(e) {
    const anchor = { x: e.x, z: e.z, team: e.team };
    const flyer = !e.building ? this.view.objects?.get?.(e.seed) : null;
    if (flyer?.userData?.air) { this.airKill(e, flyer); return; }
    if (e.building) {
      // Collapse: staged blasts across the footprint, a rolling dust wall, a smoke column,
      // debris and a large scorch; the model itself sinks in WorldView.
      const r = 2.6;
      this.explosion({ x: e.x, y: 1.26, z: e.z }, 1.35, anchor);
      this.addDebris({ x: e.x, y: 2.2, z: e.z }, 12, anchor, 1.35, 4);
      for (const [delay, k] of [[0.47, 0.8], [1.08, 0.94]]) {
        const a = this.rng() * Math.PI * 2, d = this.rng() * r;
        this.timeline.push({ at: this.time + delay, run: () => {
          const at = { x: e.x + Math.cos(a) * d, y: 0.56 + this.rng() * 1.4, z: e.z + Math.sin(a) * d };
          this.explosion(at, k, anchor, false);
          this.addDebris(at, 3, anchor, 0.9 * k, 1);
        } });
      }
      // The collapse raises a big dust cloud: a wall rolling outward and a dome rising over the ruin.
      this.timeline.push({ at: this.time + 0.25, run: () => {
        const [r0, g0, b0] = rgba(parseInt(themeFor(this.view.terrain.id).dust.slice(1), 16));
        const n = this.count(18), m = this.motion;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.rng() * 0.3, v = m ? 2.6 + this.rng() * 1.4 : 0;
          this.particle(this.smoke, { x: e.x + Math.cos(a) * 1.8, y: 0.5, z: e.z + Math.sin(a) * 1.8, vx: Math.cos(a) * v,
            vy: 0.4, vz: Math.sin(a) * v, drag: 1, life: 3 + this.rng(), s0: 1.8, s1: 5.4, cell: CELL.puff,
            c0: [r0, g0, b0, 0.78], c1: [r0, g0, b0, 0], anchor, fadeIn: 0.2, spin: 0.3 });
        }
        for (let i = 0, dome = this.count(8); i < dome; i++)
          this.particle(this.smoke, { x: e.x + (this.rng() - 0.5) * 2.4, y: 1 + this.rng(), z: e.z + (this.rng() - 0.5) * 2.4,
            vy: m ? 1 + this.rng() * 0.8 : 0.1, vx: m ? (this.rng() - 0.5) * 0.8 : 0, vz: m ? (this.rng() - 0.5) * 0.8 : 0, drag: 0.5,
            life: 3.6 + this.rng(), s0: 2.4, s1: 6.8, cell: CELL.puff, c0: [r0 * 0.9, g0 * 0.9, b0 * 0.9, 0.72], c1: [r0, g0, b0, 0],
            anchor, fadeIn: 0.3, spin: 0.2, delay: i * 0.08 });
      } });
      for (let i = 0; i < 12; i++)
        this.timeline.push({ at: this.time + 0.2 + i * 0.2, run: () => this.particle(this.smoke, { x: e.x + (this.rng() - 0.5) * 2.4,
          y: 2.5, z: e.z + (this.rng() - 0.5) * 2.4, vy: this.motion ? 2.4 : 0.2, vx: this.motion ? 0.5 : 0, drag: 0.4,
          life: 3.2, s0: 2, s1: 6, cell: CELL.puff, c0: [0.16, 0.15, 0.15, 0.74], c1: [0.33, 0.32, 0.31, 0], fadeIn: 0.25,
          anchor, spin: 0.25 }) });
      this.decal(anchor, 9, 20, anchor);
    } else if (e.heavy) {
      this.explosion({ x: e.x, y: 0.63, z: e.z }, 0.8, anchor);
      this.decal({ x: e.x, z: e.z }, 2.2, 1.4, anchor, CELL.glow, [1, 0.45, 0.1, 0.85], this.glow, 1.8, { hold: 0.2, y: 0.08 });
    }
    else {
      this.particle(this.glow, { x: e.x, y: 1, z: e.z, s0: 1.4, s1: 1.8, life: 0.12, c0: [1, 0.88, 0.62, 0.9], c1: [1, 0.5, 0.2, 0], anchor });
      this.sparks({ x: e.x, y: 1.1, z: e.z }, 6, anchor, 0.7);
      this.dust({ x: e.x, y: 0.3, z: e.z }, 3, anchor, 0.9);
      this.addDebris({ x: e.x, y: 1, z: e.z }, 3, anchor, 0.6);
      this.decal(anchor, 1.8, 6, anchor);
    }
  }
  // Damage on buildings and machines (visual only, combat-feedback.js damageState): grey smoke
  // from two vents on a building below half health; below a quarter (machines below 35%)
  // flames, embers and thick black smoke. Rates follow quality and the frame governor; only
  // on-screen emitters run, and every record comes from the pools.
  burn(e, state, dt) {
    let em = this.emitters.get(e.id);
    if (!em) this.emitters.set(e.id, (em = { fire: this.rng(), smoke: this.rng(), seen: 0, licks: 0, vent: 0 }));
    em.seen = this.time;
    const building = e.kind === "building", h = building ? ROOF[e.type] || 3.8 : 1.3;
    const spread = building ? e.radius * 0.35 : 0.245, m = this.motion, rate = dt * this.budget * this.governed * this.emitShare;
    if (!this.onScreen(e, building ? h + 4 : 3)) return;
    if (state !== BURNING) {
      // Smoking: a steady dark-grey plume from two fixed vents on the roof.
      em.smoke += rate * 4.5;
      while (em.smoke >= 1) {
        em.smoke -= 1;
        const a = e.id * 2.399 + (em.vent++ % 2) * Math.PI, d = spread * 0.6;
        const p = this.emit(this.smoke, e.x + Math.cos(a) * d + (this.rng() - 0.5) * 0.3, h * 0.9, e.z + Math.sin(a) * d + (this.rng() - 0.5) * 0.3, e);
        p.vy = m ? 0.9 + this.rng() * 0.5 : 0.1; p.vx = m ? 0.45 : 0; p.drag = 0.2; p.life = m ? 2.8 : 1.2;
        p.s0 = 1.4; p.s1 = 4; p.cell = CELL.puff; p.c0 = PAL.damageSmoke; p.c1 = PAL.damageSmokeEnd; p.fadeIn = 0.2; p.spin = 0.3;
        p.hold = 0.3;
      }
      return;
    }
    em.fire += rate * (building ? 20 : 10);
    em.smoke += rate * (building ? 6 : 3);
    while (em.fire >= 1) {
      em.fire -= 1;
      const a = this.rng() * 6.28, d = this.rng() * spread;
      const x = e.x + Math.cos(a) * d, y = 0.7 * h * (building ? 0.7 + this.rng() * 0.3 : 0.6 + this.rng() * 0.3), z = e.z + Math.sin(a) * d;
      const vy = m ? 0.7 * (1.4 + this.rng() * 1.2) : 0, vx = m ? (this.rng() - 0.5) * 0.4 : 0, life = 0.55 + this.rng() * 0.35;
      const p = this.emit(this.smoke, x, y, z, e);
      p.vy = vy; p.vx = vx; p.life = life; p.spin = 2; p.cell = CELL.puff;
      p.s0 = building ? 1.47 : 0.56; p.s1 = building ? 0.42 : 0.21; p.c0 = PAL.flame; p.c1 = PAL.flameEnd; p.hold = 0.25;
      if (++em.licks % (building ? 2 : 3) === 0) {
        const g = this.emit(this.glow, x, y, z, e);
        g.vy = vy; g.vx = vx; g.life = life; g.spin = 2; g.s0 = building ? 1.05 : 0.455; g.s1 = 0.3; g.c0 = PAL.lick; g.c1 = PAL.lickEnd;
      }
      if (building && m && em.licks % 4 === 0) {
        // Embers drifting up out of the fire.
        const k = this.emit(this.glow, x, y + 0.4, z, e);
        k.vy = 1.54 + this.rng() * 0.98; k.vx = (this.rng() - 0.5) * 0.65; k.vz = (this.rng() - 0.5) * 0.65; k.drag = 0.6;
        k.life = 0.9 + this.rng() * 0.5; k.s0 = 0.18; k.s1 = 0.06; k.cell = CELL.flare; k.c0 = PAL.ember; k.c1 = PAL.emberEnd;
      }
    }
    while (em.smoke >= 1) {
      em.smoke -= 1;
      const p = this.emit(this.smoke, e.x + (this.rng() - 0.5) * spread, h + 0.4, e.z + (this.rng() - 0.5) * spread, e);
      p.vy = m ? 1.1 + this.rng() * 0.6 : 0.1; p.vx = m ? 0.5 : 0; p.drag = 0.2; p.life = m ? 2.8 : 1.2;
      p.s0 = building ? 1.6 : 0.6; p.s1 = building ? 4.8 : 2; p.cell = CELL.puff; p.c0 = PAL.fireSmoke; p.c1 = PAL.fireSmokeEnd;
      p.fadeIn = 0.2; p.spin = 0.35; p.hold = building ? 0.3 : 0;
    }
  }
  // -- bosses (src/boss-view.js): guns glowing while they aim, and a long, heavy fall.
  charge(at, size, anchor, gold = false) {
    this.particle(this.glow, { ...at, lifted: true, cell: CELL.flare, s0: size, s1: size * 0.4, life: 0.14, c0: gold ? [1, 0.86, 0.45, 0.95] : [1, 0.62, 0.25, 0.9], c1: [1, gold ? 0.55 : 0.3, 0.08, 0], anchor });
  }
  bossDeath(e) {
    const anchor = { x: e.x, z: e.z, team: e.team }, m = this.motion;
    this.explosion({ x: e.x, y: 2.2, z: e.z }, 2.3, anchor, true);
    for (const [delay, dx, dz, y, k] of [[0.25, 1.2, 0.4, 3.1, 1.1], [0.5, -1.1, -0.6, 2.3, 1.2], [0.8, 0.3, 1.2, 3.6, 1], [1.15, -0.4, -1.3, 1.4, 1.3], [1.55, 0, 0, 2.4, 1.9]])
      this.timeline.push({ at: this.time + delay, run: () => {
        const at = { x: e.x + dx, y, z: e.z + dz };
        this.explosion(at, k, anchor, true);
        this.addDebris(at, 6, anchor, 1.2 * k, 2);
      } });
    this.decal(anchor, 11, 24, anchor);
  }
  smoulder(d, dt) {
    d.puff = (d.puff ?? this.rng()) + dt * 1.6 * this.budget * this.governed;
    const m = this.motion;
    while (d.puff >= 1) {
      d.puff -= 1;
      const p = this.emit(this.smoke, d.x + (this.rng() - 0.5) * 0.5, 0.9, d.z + (this.rng() - 0.5) * 0.5, d);
      p.vy = m ? 1.1 + this.rng() * 0.5 : 0.1; p.vx = m ? 0.35 : 0; p.drag = 0.3; p.life = m ? 2.4 : 1.1; p.s0 = 0.5; p.s1 = 1.8;
      p.cell = CELL.puff; p.c0 = PAL.wreckSmoke; p.c1 = PAL.wreckSmokeEnd; p.fadeIn = 0.2; p.spin = 0.35;
    }
  }
  // Cull the least visible detail first and reserve the selected target's hit.
  trimParticles(sim, selected) {
    if (this.sprites.batches && this.particlePools.length === 4)
      this.particlePools.push(this.sprites.batches.normal, this.sprites.batches.add);
    if (this.time >= this.nextCount) {
      let units = 0;
      for (const e of sim.entities) {
        if (e.kind === "unit" && e.hp > 0 && sim.isVisible(e) && this.onScreen(e, e.radius || 1)) units++;
      }
      this.particleCap = Math.max(12, Math.ceil(units * 2.4 * this.budget));
      this.nextCount = this.time + 0.25;
    }
    let excess = this.projectiles.length + this.rounds.length - this.particleCap;
    for (const pool of this.particlePools) excess += pool.items.length;
    if (excess <= 0) return;
    const bins = this.priorityCounts;
    bins.fill(0);
    this.selectedHits.clear();
    const focus = this.view.focus || { x: 0, z: 0 }, near = (this.view.zoom || 40) * 0.35;
    for (const pool of this.particlePools) for (const p of pool.items) {
      const target = p.anchor?.target;
      const selectedHit = selected?.has(target) && (p.priorityHit || p.hotCore || p.def?.name === "flak") && !this.selectedHits.has(target);
      if (selectedHit) this.selectedHits.add(target);
      const close = (p.x-focus.x)**2 + (p.z-focus.z)**2 < near*near;
      p.priority = selectedHit ? 4 : (close ? 2 : 0) + (!p.decal && (p.s0 || p.scale || 0) >= 0.45 ? 1 : 0);
      bins[p.priority]++;
    }
    for (let i = 0; i < 4; i++) { bins[i] = Math.min(excess, bins[i]); excess -= bins[i]; }
    for (const pool of this.particlePools) {
      let keep = 0;
      for (const p of pool.items) {
        if (p.priority < 4 && bins[p.priority] > 0) {
          bins[p.priority]--; p.owner = 0; pool.free.push(p);
        } else pool.items[keep++] = p;
      }
      pool.items.length = keep;
    }
  }
  update(sim, dt, selected) {
    this.time += dt;
    this.frameSim = sim;
    this.seen.clear();
    const visible = this.visible;
    for (let i = this.timeline.length - 1; i >= 0; i--)
      if (this.timeline[i].at <= this.time) this.timeline.splice(i, 1)[0].run();
    // Rocket bodies are lit like the scene: dimmer under a night or storm look, never black.
    this.rockets.begin(this.time, this.rocketLight());
    // Never smaller than about 24 CSS pixels nose to flame tip, so a rocket reads at phone zoom too.
    const bodyScale = Math.min(1.8, Math.max(1, 24 * (this.view.unitsPerPixel || 0) / 1.86));
    // R3-X: shells and bombs (about 1 m) never shorter than about 20 CSS pixels either.
    this.bodyScale = Math.min(1.8, Math.max(1, 20 * (this.view.unitsPerPixel || 0)));
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.wait > 0) { p.wait -= dt; continue; } // a rocket of a salvo that has not left yet (src/fx-kinds/pods.js)
      p.age += dt;
      const t = Math.min(1, p.age / p.travel), lift = p.arc ? p.arc * 4 * t * (1 - t) : 0;
      const x = p.from.x + (p.to.x - p.from.x) * t, y = p.from.y + (p.to.y - p.from.y) * t + lift, z = p.from.z + (p.to.z - p.from.z) * t;
      // The heading along the arc (its derivative), for the body, its flame halo and its ribbon.
      let ux = 0, uy = 0, uz = 0;
      if (p.body) {
        ux = p.to.x - p.from.x; uy = p.to.y - p.from.y + (p.arc || 0) * 4 * (1 - 2 * t); uz = p.to.z - p.from.z;
        const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      }
      const tail = p.body ? 0.62 * p.body * bodyScale : 0;
      if (p.body && !p.step) p.step = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y, p.to.z - p.from.z) / p.travel * ROCKET.trailGap;
      if (p.rocket && dt > 0 && this.budget === 1) {
        p.trail += dt;
        // R3-FX: with the sheets loaded the rocket's trail is smoke-trail sprite puffs, fewer and bigger (Eco: fewer still).
        const sprite = spritesReady(this), gap = sprite ? (this.view.lowPower ? 0.075 : 0.05) : p.body ? ROCKET.trailGap : 0.025;
        while (p.trail > gap) {
          p.trail -= gap;
          if (sprite) { spriteTrailPuff(this, x - ux * tail, y - uy * tail, z - uz * tail, 1.5 * (p.body || 0.8) * this.bodyScale, (this.view.lowPower ? 0.5 : 0.8), p.anchor, 0.75); continue; }
          const q = this.emit(this.smoke, x - ux * tail, y - uy * tail, z - uz * tail, p.anchor, true);
          if (p.body) {
            // A short ribbon: soft segments laid along the flight path that widen a little and fade in half a second.
            q.vy = 0.25; q.drag = 1.4; q.life = 0.42 + this.rng() * 0.14; q.s0 = 0.2 * p.body; q.s1 = 0.62 * p.body; q.cell = CELL.glow;
            q.mode = STRETCH; q.ax = ux; q.ay = uy; q.az = uz; q.length = p.step * 2.2; q.c0 = PAL.ribbon; q.c1 = PAL.ribbonEnd;
          } else {
            q.vy = 0.3; q.drag = 1; q.life = 0.7 + this.rng() * 0.3; q.s0 = 0.25; q.s1 = 1; q.cell = CELL.puff;
            q.c0 = PAL.trail; q.c1 = PAL.trailEnd; q.spin = 0.6;
          }
        }
      }
      if (p.body && t < 1) {
        p.roll += ROCKET.spin * dt;
        // The flame halo: one pooled glow sprite per rocket, moved to the nozzle every frame.
        let h = p.halo;
        if (!h || h.owner !== p.token) {
          h = p.halo = this.particle(this.glow, { lifted: true, x, y, z, opacity: SHOT_SCALE, s0: 1.15 * p.body * SHOT_SCALE, s1: 1.15 * p.body * SHOT_SCALE, life: p.travel + 1, c0: PAL.halo, c1: PAL.halo, anchor: p.anchor });
          h.owner = p.token = p.token || ++this.rocketTokens;
        }
        h.x = x - ux * tail * 1.25; h.y = y - uy * tail * 1.25; h.z = z - uz * tail * 1.25;
        if (visible(p.anchor) && !(this.touchTier && spriteHead(this, "rocket", x,y,z, ux,uy,uz, 1.9 * p.body * bodyScale, p.anchor))) this.rockets.add(x, y, z, ux, uy, uz, p.roll, p.body * bodyScale * SHOT_SCALE, p.color);
      }
      if (t >= 1) {
        this.projectiles.splice(i, 1);
        if (p.halo && p.halo.owner === p.token) { p.halo.age = p.halo.life; p.halo.owner = 0; }
        if (visible(p.anchor)) {
          if (p.impact) this.rocketImpact(p, ux, uz);
          else this.hit(p.land || p.to, p.power ?? (p.cannon || p.rocket ? 1 : 0), p.anchor, p.kind);
        }
      }
    }
    this.rockets.end(dt > 0);
    // R3-X: shells, lobs, flak, missiles and bombs (one instanced draw for all), and the Barrage shells falling onto their marks.
    this.ordnance.begin(this.rocketLight());
    stepRounds(this, dt, visible);
    stepStrikes(this, sim, dt);
    this.ordnance.end(dt > 0);
    // R3-X: a shot-down flyer trails smoke as it spins down and crashes in dust and fire.
    if (this.view.dying) this.airWrecks(this.view.dying, dt);
    // Smoke on damaged buildings, fire on critical ones and on machines; fog-aware and capped
    // like the HUD's fire list.
    // Many damaged buildings share one smoke budget (about 220 live puffs at High) so they
    // never crowd explosions out of the pool.
    damagedEntities(sim, this.view.lowPower, this.burning);
    let load = 0;
    for (let i = 0; i < this.burning.length; i++) {
      const e = this.burning[i];
      load += damageState(e) !== BURNING ? 13 : e.kind === "building" ? 31 : 15; // live puffs each emitter keeps
    }
    this.emitShare = Math.min(0.5, 110 / Math.max(1, load));
    if (dt > 0) for (let i = 0; i < this.burning.length; i++) this.burn(this.burning[i], damageState(this.burning[i]), dt);
    // Vehicle wrecks smoulder: a thin dark plume until they sink away.
    const dying = this.view.dying;
    if (dt > 0 && dying) for (let i = 0; i < dying.length; i++) if ((dying[i].kind === 'vehicle' || (dying[i].kind === 'air' && dying[i].crashed)) && dying[i].age < dying[i].life - 1) this.smoulder(dying[i], dt);
    this.work(sim, dt);
    for (const r of sim.resources ?? []) {
      const live = r.amount > 0, was = this.depositLive.get(r.id);
      if (was && !live && sim.isVisible(r)) this.shatter(r);
      this.depositLive.set(r.id, live);
    }
    for (const [id, em] of this.emitters) if (this.time - em.seen > 1) this.emitters.delete(id);
    this.trimParticles(sim, selected);
    if (this.phoneBatch) {
      const batch = this.phoneBatch;
      let count = this.decals.update(dt, visible, batch);
      count = this.smoke.update(dt, visible, batch, count);
      count = this.glow.update(dt, visible, batch, count, true);
      batch.mesh.visible = count > 0;
      batch.mesh.geometry.instanceCount = count;
      if (dt > 0 || count !== batch.drawn)
        for (const a of batch.attrs) uploadPrefix(a, count);
      batch.drawn = count;
    } else {
      this.decals.update(dt, visible);
      this.smoke.update(dt, visible);
      this.glow.update(dt, visible);
    }
    this.sprites.update(dt, visible);
    let n = 0;
    const t = this.view.terrain, plateaus = t?.plateaus?.length;
    for (const d of this.debris) {
      d.age += dt;
      if (d.age >= d.life) { this.debrisFree.push(d); continue; }
      this.debris[n++] = d;
      d.vy -= 16 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.spin * dt; d.ry += d.spin * 0.7 * dt;
      if (plateaus && dt > 0) d.ground = t.heightAt(d.x, d.z);
      const floor = d.ground + 0.08 * d.scale;
      if (d.y < floor) { d.y = floor; d.vy = Math.abs(d.vy) > 1.5 ? -d.vy * 0.38 : 0; d.vx *= 0.55; d.vz *= 0.55; d.spin *= 0.5; }
      else if (d.trail >= 0 && dt > 0 && d.age < 0.8) {
        // A thin smoke trail behind the first chunks while they fly.
        d.trail += dt;
        if (d.trail >= 0.05) {
          d.trail = 0;
          const q = this.emit(this.smoke, d.x, d.y, d.z, d.anchor, true);
          q.vy = 0.2; q.drag = 1.2; q.life = 0.55; q.s0 = 0.3 * d.scale + 0.15; q.s1 = 0.8; q.cell = CELL.puff;
          q.c0 = PAL.chunkTrail; q.c1 = PAL.chunkTrailEnd; q.spin = 0.5;
        }
      }
    }
    this.debris.length = n;
    let drawn = 0;
    for (const d of this.debris) {
      if (!visible(d.anchor)) continue;
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.rotation.set(d.rx, d.ry, 0);
      this.dummy.scale.setScalar(d.scale * Math.min(1, (d.life - d.age) / 0.4));
      this.dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(drawn++, this.dummy.matrix);
    }
    const previous = this.debrisDrawn;
    this.debrisDrawn = drawn;
    this.debrisMesh.visible = drawn > 0;
    if (!drawn) {
      if (!previous) return;
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(0, this.dummy.matrix); drawn = 1;
    }
    // R3-X: a still frame (dt 0: paused, or a frozen benchmark scene) moves no chunk: keep what was sent.
    if (!(dt > 0) && drawn === this.debrisMesh.count && this.debrisSent) return;
    this.debrisSent = true;
    this.debrisMesh.count = drawn;
    uploadPrefix(this.debrisMesh.instanceMatrix, drawn);
  }
  get active() {
    return this.glow.items.length + this.smoke.items.length + this.decals.items.length + this.debris.length + this.projectiles.length + this.rounds.length + this.sprites.active;
  }
  clear() {
    this.nextCount = -1;
    for (const layer of [this.decals, this.smoke, this.glow]) layer.clear();
    this.sprites.clear();
    for (const d of this.debris) this.debrisFree.push(d);
    this.debris.length = this.projectiles.length = this.timeline.length = 0;
    this.rockets.begin(this.time, 1); this.rockets.end();
    for (const r of this.rounds) { r.halo = null; r.anchor = null; this.roundFree.push(r); }
    this.rounds.length = 0;
    this.strikeState = new WeakMap();
    this.ordnance.begin(1); this.ordnance.end();
    this.emitters.clear();
    this.workTimers.clear();
    this.workCursor = 0;
    this.depositLive.clear();
    this.burning.length = 0;
    this.update({ isVisible: () => false, entities: [] }, 0);
  }
  dispose() {
    this.view.scene.remove(this.root);
    for (const layer of [this.decals, this.smoke, this.glow]) layer.dispose();
    this.debrisMesh.geometry.dispose();
    this.debrisMesh.material.dispose();
    this.phoneBatch?.dispose();
    this.rockets.dispose();
    this.ordnance.dispose();
    this.sprites.dispose();
    this.texture.dispose();
  }
}
