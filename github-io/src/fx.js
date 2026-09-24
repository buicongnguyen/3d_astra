import * as THREE from "three";
import { themeFor, weaponStyle, shotVisible } from "./visual-style.js";
import { burningEntities } from "./combat-feedback.js";

// 3D combat effects: muzzle flashes, tracers, shells, rockets, sparks, fireballs, smoke,
// shockwaves, scorch marks, debris and fire on damaged machines and buildings.
// Everything renders through four fixed draw calls (glow, smoke, ground decals, debris) no
// matter how many effects are alive, so heavy fighting never adds draw calls, and each pool
// is capped (halved in Eco). Effects follow fog of war every frame, freeze while paused
// (dt = 0) and lose drift, debris and flicker when combat motion is off or reduced motion
// is requested.

const CELLS = ["glow", "puff", "ring", "streak", "scorch", "flare"];
const CELL = Object.fromEntries(CELLS.map((name, i) => [name, i]));
const BILLBOARD = 0, STRETCH = 1, GROUND = 2;

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
  float a = vColor.a * t.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
}`;

class Layer {
  constructor(capacity, blending, renderOrder, texture) {
    this.capacity = capacity;
    this.items = [];
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
  add(p) {
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(p);
    return p;
  }
  update(dt, visible) {
    let keep = 0, drawn = 0;
    const P = this.pos.array, C = this.color.array, A = this.axis.array, S = this.size.array;
    for (const p of this.items) {
      p.age += dt;
      if (p.age >= p.life) continue;
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
      C[drawn * 4 + 3] *= fade;
      const len = p.length ? p.length : 0;
      A[drawn * 4] = p.ax * len; A[drawn * 4 + 1] = p.ay * len; A[drawn * 4 + 2] = p.az * len; A[drawn * 4 + 3] = p.mode;
      S[drawn * 3] = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) ** 2); S[drawn * 3 + 1] = p.rot; S[drawn * 3 + 2] = p.cell;
      drawn++;
    }
    this.items.length = keep;
    if (!drawn) { S[0] = 0; C[3] = 0; drawn = 1; } // keep one invisible instance: a fixed draw call
    this.mesh.geometry.instanceCount = drawn;
    for (const a of [this.pos, this.color, this.axis, this.size]) a.needsUpdate = true;
  }
  clear() { this.items.length = 0; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const rgba = (hex, a = 1) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a];
const WARM = { flash: [1, 0.96, 0.82, 1], fire: [1, 0.78, 0.4, 1], ember: [0.85, 0.2, 0.04, 0], spark: [1, 0.88, 0.55, 1], sparkEnd: [1, 0.45, 0.12, 0] };

export class Effects {
  constructor(view) {
    this.view = view;
    this.texture = atlas();
    const scale = view.lowPower ? 0.5 : 1;
    this.decals = new Layer(48, THREE.NormalBlending, 1, this.texture);
    this.smoke = new Layer(Math.round(420 * scale) || 1, THREE.NormalBlending, 5, this.texture);
    this.glow = new Layer(Math.round(900 * scale) || 1, THREE.AdditiveBlending, 6, this.texture);
    this.debrisCapacity = view.lowPower ? 24 : 64;
    this.debrisMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.7, metalness: 0.3, emissive: 0x401a08, emissiveIntensity: 0.6 }),
      this.debrisCapacity,
    );
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.count = 1;
    this.debrisMesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
    this.debris = [];
    this.projectiles = [];
    this.timeline = [];
    this.emitters = new Map();
    this.burning = [];
    this.time = 0;
    this.root = new THREE.Group();
    this.root.add(this.decals.mesh, this.smoke.mesh, this.glow.mesh, this.debrisMesh);
    view.scene.add(this.root);
    this.dummy = new THREE.Object3D();
  }
  get motion() { return this.view.activity.combat.motion; }
  get budget() { return this.view.lowPower ? 0.5 : 1; }
  count(n) { return Math.max(1, Math.round(n * this.budget)); }
  // -- particle helpers
  particle(layer, o) {
    return layer.add({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: -(o.delay || 0), life: 1, s0: 1, s1: 1, rot: Math.random() * 6.28,
      spin: 0, c0: WARM.flash, c1: WARM.ember, mode: BILLBOARD, ax: 0, ay: 1, az: 0, length: 0, cell: CELL.glow,
      drag: 0, gravity: 0, floor: -10, hold: 0, fadeIn: 0, anchor: null, ...o,
    });
  }
  burst(layer, n, at, o, speed = [1, 2], up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, v = this.motion ? speed[0] + Math.random() * (speed[1] - speed[0]) : 0;
      const dir = { x: Math.cos(a) * e, y: Math.sqrt(1 - e * e) + up, z: Math.sin(a) * e };
      this.particle(layer, { ...o, x: at.x, y: at.y, z: at.z, vx: dir.x * v, vy: dir.y * v, vz: dir.z * v,
        life: o.life * (0.8 + Math.random() * 0.4), ...(typeof o.extra === "function" ? o.extra(i) : {}) });
    }
  }
  sparks(at, n, anchor, power = 1) {
    if (!this.motion) return;
    for (let i = 0; i < this.count(n); i++) {
      const a = Math.random() * Math.PI * 2, e = 0.3 + Math.random() * 0.7, v = (5 + Math.random() * 6) * power;
      const vx = Math.cos(a) * e * v, vy = (0.4 + Math.random()) * v * 0.7, vz = Math.sin(a) * e * v, len = Math.hypot(vx, vy, vz) || 1;
      this.particle(this.glow, { x: at.x, y: at.y, z: at.z, vx, vy, vz, gravity: 14, drag: 1.5, life: 0.25 + Math.random() * 0.3,
        mode: STRETCH, ax: vx / len, ay: vy / len, az: vz / len, length: 0.35 * power, s0: 0.07, s1: 0.04, cell: CELL.streak,
        c0: WARM.spark, c1: WARM.sparkEnd, floor: 0.05, anchor });
    }
  }
  dust(at, n, anchor, size = 1, life = 1.1) {
    const [r, g, b] = rgba(parseInt(themeFor(this.view.terrain.id).dust.slice(1), 16));
    this.burst(this.smoke, this.count(n), at, { life, s0: 0.6 * size, s1: 2.2 * size, drag: 2.5, cell: CELL.puff,
      c0: [r, g, b, 0.55], c1: [r, g, b, 0], floor: 0.1, anchor, spin: (Math.random() - 0.5) * 0.6 }, [0.8 * size, 2 * size], 0.2);
  }
  addDebris(at, n, anchor, power = 1) {
    if (!this.motion) return;
    for (let i = 0; i < this.count(n); i++) {
      if (this.debris.length >= this.debrisCapacity) this.debris.shift();
      const a = Math.random() * Math.PI * 2, v = (1.5 + Math.random() * 3) * power;
      this.debris.push({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * v, vy: (3 + Math.random() * 4) * power, vz: Math.sin(a) * v,
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 14, age: 0, life: 1.6 + Math.random() * 1.2,
        scale: (0.45 + Math.random() * 0.75) * Math.sqrt(power), anchor });
    }
  }
  decal(at, size, life, anchor, cell = CELL.scorch, color = [0.03, 0.028, 0.025, 0.8], layer = this.decals, s0 = size, extra = {}) {
    return this.particle(layer, { x: at.x, y: 0.04 + layer.items.length * 0.0004, z: at.z, mode: GROUND, cell, s0, s1: size, life,
      c0: color, c1: [...color.slice(0, 3), 0], hold: 0.7, anchor, rot: Math.random() * 6.28, ...extra });
  }
  shockwave(at, size, anchor) {
    this.decal(at, size, 0.45, anchor, CELL.ring, [1, 0.78, 0.5, 0.75], this.glow, size * 0.15, { hold: 0, y: 0.1 });
  }
  explosion(at, scale, anchor, heavy = true) {
    const m = this.motion;
    this.particle(this.glow, { ...at, cell: CELL.flare, s0: 3.6 * scale, s1: 4.4 * scale, life: 0.16, c0: WARM.flash, c1: [1, 0.6, 0.2, 0], anchor });
    this.particle(this.glow, { ...at, s0: 4.2 * scale, s1: 5.5 * scale, life: 0.22, c0: [1, 0.72, 0.38, 0.9], c1: [1, 0.35, 0.08, 0], anchor });
    this.burst(this.glow, this.count(8), at, { life: 0.6, s0: 1.1 * scale, s1: 3 * scale, drag: 3.5, c0: WARM.fire, c1: WARM.ember, anchor,
      spin: 1.5 }, [1.5 * scale, 4 * scale], 0.5);
    // Normal-blended fire body: stays saturated on bright ground where additive light washes out.
    this.burst(this.smoke, this.count(7), at, { life: 0.95, s0: 1.2 * scale, s1: 3.2 * scale, drag: 3, cell: CELL.puff,
      c0: [1, 0.6, 0.18, 0.95], c1: [0.2, 0.17, 0.15, 0], anchor, spin: 1, gravity: -1.2 }, [1.2 * scale, 3.2 * scale], 0.6);
    this.burst(this.smoke, this.count(6), { ...at, y: at.y + 0.3 }, { life: m ? 2.4 : 1, s0: 1.1 * scale, s1: 3.8 * scale, drag: 1.4,
      cell: CELL.puff, c0: [0.2, 0.19, 0.18, 0.78], c1: [0.36, 0.35, 0.34, 0], fadeIn: 0.12, delay: 0.06, anchor, gravity: -0.6,
      spin: 0.4 }, [0.6 * scale, 1.6 * scale], 1.2);
    this.sparks(at, heavy ? 10 : 5, anchor, scale);
    if (m) this.shockwave(at, 7 * scale, anchor);
    this.decal(at, 3.4 * scale, 12, anchor);
    if (heavy) this.addDebris(at, 6, anchor, scale);
  }
  // -- events
  shot(e, sim) {
    const style = weaponStyle(e), dx = e.tx - e.x, dz = e.tz - e.z, dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist, reach = Math.min(style.reach, dist * 0.45);
    const from = { x: e.x + nx * reach, y: style.height, z: e.z + nz * reach };
    const to = { x: e.tx, y: e.type === "support" || e.weapon === "tower" ? 1 : 0.95, z: e.tz };
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const travel = style.life, anchor = { ...e, shot: true };
    const kind = style.kind, m = this.motion;
    if (kind === "support") {
      const engineer = e.weapon === "engineer", tint = engineer ? [0.75, 0.9, 1, 0.9] : [0.5, 1, 0.75, 0.9];
      this.particle(this.glow, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2, mode: STRETCH,
        ax: dir.x / len, ay: dir.y / len, az: dir.z / len, length: len, s0: 0.2, s1: 0.1, life: 0.3, cell: CELL.glow,
        c0: tint, c1: [...tint.slice(0, 3), 0], anchor });
      this.burst(this.glow, this.count(4), to, { life: 0.55, s0: 0.35, s1: 0.1, c0: tint, c1: [...tint.slice(0, 3), 0], anchor,
        gravity: -1.5 }, [0.4, 1], 0.8);
      return;
    }
    const cannon = kind === "cannon", rocket = kind === "rocket";
    // Muzzle: star flare, hot glow and (for heavy weapons) a smoke puff drifting forward.
    const flash = cannon ? (e.weapon === "tank" ? 1.9 : 1.4) : rocket ? 1 : 0.7;
    this.particle(this.glow, { ...from, cell: CELL.flare, s0: flash, s1: flash * 1.2, life: cannon ? 0.11 : 0.06, c0: WARM.flash,
      c1: [1, 0.55, 0.15, 0], anchor });
    this.particle(this.glow, { ...from, s0: flash * 1.5, s1: flash * 1.8, life: cannon ? 0.14 : 0.08, c0: [1, 0.72, 0.35, 0.7],
      c1: [1, 0.4, 0.1, 0], anchor });
    if ((cannon || rocket) && m) {
      const back = rocket ? -1 : 1;
      for (let i = 0; i < this.count(3); i++)
        this.particle(this.smoke, { x: from.x - (rocket ? nx * 1.4 : 0), y: from.y, z: from.z - (rocket ? nz * 1.4 : 0),
          vx: nx * back * (1.5 + i * 0.6), vy: 0.5 + Math.random() * 0.4, vz: nz * back * (1.5 + i * 0.6), drag: 2.2,
          life: 0.9 + Math.random() * 0.4, s0: 0.45, s1: 1.7, cell: CELL.puff, c0: [0.6, 0.58, 0.55, 0.5], c1: [0.55, 0.55, 0.55, 0],
          anchor, spin: 0.8 });
    }
    // Projectile: a streak (and shell/rocket glow) flying to the target; reduced motion
    // shows a brief static tracer along the whole path instead.
    const width = cannon ? 0.34 : rocket ? 0.2 : 0.15, tail = cannon ? 2.4 : rocket ? 1.3 : 2;
    const color = cannon ? [1, 0.78, 0.4, 1] : rocket ? [1, 0.85, 0.6, 1] : [1, 0.9, 0.6, 1];
    if (m) {
      const v = { vx: dir.x / travel, vy: dir.y / travel, vz: dir.z / travel };
      this.particle(this.glow, { ...from, ...v, mode: STRETCH, ax: dir.x / len, ay: dir.y / len, az: dir.z / len,
        length: Math.min(tail, len), s0: width, s1: width, life: travel, cell: CELL.streak, c0: color, c1: [...color.slice(0, 3), 0.8], anchor });
      if (cannon || rocket)
        this.particle(this.glow, { ...from, ...v, s0: cannon ? 0.75 : 0.55, s1: cannon ? 0.75 : 0.55, life: travel, c0: [1, 0.85, 0.5, 1],
          c1: [1, 0.7, 0.4, 1], anchor });
      this.projectiles.push({ from, to, travel, age: 0, rocket, cannon, anchor, trail: 0, weapon: e.weapon });
    } else {
      this.particle(this.glow, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2, mode: STRETCH,
        ax: dir.x / len, ay: dir.y / len, az: dir.z / len, length: len, s0: width * 0.7, s1: width * 0.7, life: 0.1,
        cell: CELL.glow, c0: [...color.slice(0, 3), 0.7], c1: [...color.slice(0, 3), 0], anchor });
      this.hit(to, cannon || rocket, anchor);
    }
  }
  hit(at, heavy, anchor) {
    if (heavy) {
      this.particle(this.glow, { ...at, s0: 1.6, s1: 2.2, life: 0.14, c0: WARM.flash, c1: [1, 0.4, 0.1, 0], anchor });
      this.burst(this.glow, this.count(3), at, { life: 0.35, s0: 0.5, s1: 1.2, drag: 4, c0: WARM.fire, c1: WARM.ember, anchor }, [1, 2.5], 0.6);
      this.sparks(at, 5, anchor, 0.8);
      this.dust({ ...at, y: 0.3 }, 2, anchor, 0.8, 0.9);
    } else {
      this.particle(this.glow, { ...at, s0: 0.5, s1: 0.7, life: 0.07, c0: [1, 0.9, 0.6, 0.9], c1: [1, 0.5, 0.2, 0], anchor });
      this.sparks(at, 3, anchor, 0.45);
    }
  }
  impact(e) {
    const at = { x: e.x, y: e.building ? 2.2 : 1.1, z: e.z }, anchor = { x: e.x, z: e.z };
    if (e.shield) {
      // Shield: a cyan ripple shell and flash where the round is stopped.
      this.particle(this.glow, { ...at, cell: CELL.ring, s0: e.building ? 2 : 1.1, s1: e.building ? 4.4 : 2.4, life: 0.3,
        c0: [0.55, 0.92, 1, 0.9], c1: [0.35, 0.75, 1, 0], anchor, delay: 0.05 });
      this.particle(this.glow, { ...at, s0: 1.3, s1: 1.8, life: 0.14, c0: [0.5, 0.9, 1, 0.55], c1: [0.4, 0.8, 1, 0], anchor, delay: 0.05 });
    } else {
      this.sparks(at, 4, anchor, 0.7);
      this.particle(this.smoke, { ...at, vy: this.motion ? 0.8 : 0, s0: 0.4, s1: 1.2, life: 0.6, cell: CELL.puff,
        c0: [0.35, 0.34, 0.32, 0.45], c1: [0.4, 0.4, 0.4, 0], anchor, delay: 0.05 });
    }
  }
  death(e) {
    const anchor = { x: e.x, z: e.z };
    if (e.building) {
      // Collapse: staged blasts across the footprint, a rolling dust wall, a smoke column,
      // debris and a large scorch; the model itself sinks in WorldView.
      const r = 2.4;
      this.explosion({ x: e.x, y: 1.6, z: e.z }, 1.5, anchor);
      for (const [delay, k] of [[0.3, 0.8], [0.65, 0.9], [1.0, 0.75], [1.45, 0.7]]) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * r;
        this.timeline.push({ at: this.time + delay, run: () => this.explosion({ x: e.x + Math.cos(a) * d, y: 0.8 + Math.random() * 2, z: e.z + Math.sin(a) * d }, k, anchor, false) });
      }
      this.timeline.push({ at: this.time + 0.25, run: () => {
        const [r0, g0, b0] = rgba(parseInt(themeFor(this.view.terrain.id).dust.slice(1), 16));
        const n = this.count(14);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, v = this.motion ? 2.4 + Math.random() : 0;
          this.particle(this.smoke, { x: e.x + Math.cos(a) * 1.6, y: 0.5, z: e.z + Math.sin(a) * 1.6, vx: Math.cos(a) * v,
            vy: 0.35, vz: Math.sin(a) * v, drag: 1.1, life: 2.6 + Math.random(), s0: 1.6, s1: 4.6, cell: CELL.puff,
            c0: [r0, g0, b0, 0.7], c1: [r0, g0, b0, 0], anchor, fadeIn: 0.2, spin: 0.3 });
        }
      } });
      for (let i = 0; i < 10; i++)
        this.timeline.push({ at: this.time + 0.2 + i * 0.22, run: () => this.particle(this.smoke, { x: e.x + (Math.random() - 0.5) * 2,
          y: 2.5, z: e.z + (Math.random() - 0.5) * 2, vy: this.motion ? 2.2 : 0.2, vx: this.motion ? 0.5 : 0, drag: 0.4,
          life: 3.2, s0: 1.8, s1: 5.5, cell: CELL.puff, c0: [0.16, 0.15, 0.15, 0.7], c1: [0.33, 0.32, 0.31, 0], fadeIn: 0.25,
          anchor, spin: 0.25 }) });
      this.addDebris({ x: e.x, y: 2, z: e.z }, 8, anchor, 1.2);
      this.decal(anchor, 8, 20, anchor);
    } else if (e.heavy) this.explosion({ x: e.x, y: 0.9, z: e.z }, 1, anchor);
    else {
      this.particle(this.glow, { x: e.x, y: 1, z: e.z, s0: 1.4, s1: 1.8, life: 0.12, c0: [1, 0.88, 0.62, 0.9], c1: [1, 0.5, 0.2, 0], anchor });
      this.sparks({ x: e.x, y: 1.1, z: e.z }, 6, anchor, 0.7);
      this.dust({ x: e.x, y: 0.3, z: e.z }, 3, anchor, 0.9);
      this.addDebris({ x: e.x, y: 1, z: e.z }, 3, anchor, 0.6);
      this.decal(anchor, 1.8, 6, anchor);
    }
  }
  // Fire and smoke from critically damaged buildings and machines (visual only).
  burn(e, dt) {
    let em = this.emitters.get(e.id);
    if (!em) this.emitters.set(e.id, (em = { fire: Math.random(), smoke: Math.random(), seen: 0 }));
    em.seen = this.time;
    const building = e.kind === "building", h = building ? { hq: 3.9, barracks: 3.2, foundry: 3.4, relay: 2.4, tower: 3.8 }[e.type] || 3 : 1.3;
    const spread = building ? e.radius * 0.45 : 0.35, m = this.motion, anchor = e;
    em.fire += dt * (building ? 16 : 10) * this.budget;
    em.smoke += dt * (building ? 5 : 3) * this.budget;
    while (em.fire >= 1) {
      em.fire -= 1;
      const a = Math.random() * 6.28, d = Math.random() * spread;
      const flame = { x: e.x + Math.cos(a) * d, y: h * (0.6 + Math.random() * 0.3), z: e.z + Math.sin(a) * d,
        vy: m ? 1.2 + Math.random() : 0, vx: m ? (Math.random() - 0.5) * 0.4 : 0, life: 0.5 + Math.random() * 0.3, anchor, spin: 2 };
      this.particle(this.smoke, { ...flame, cell: CELL.puff, s0: building ? 1.1 : 0.75, s1: building ? 0.4 : 0.3,
        c0: [1, 0.72, 0.24, 0.95], c1: [0.7, 0.14, 0.04, 0] });
      if ((em.licks = (em.licks || 0) + 1) % 3 === 0)
        this.particle(this.glow, { ...flame, s0: building ? 0.9 : 0.6, s1: 0.3, c0: [1, 0.85, 0.5, 0.8], c1: [1, 0.3, 0.05, 0] });
    }
    while (em.smoke >= 1) {
      em.smoke -= 1;
      this.particle(this.smoke, { x: e.x + (Math.random() - 0.5) * spread, y: h + 0.3, z: e.z + (Math.random() - 0.5) * spread,
        vy: m ? 1.4 + Math.random() * 0.6 : 0.1, vx: m ? 0.45 : 0, drag: 0.3, life: m ? 2.6 : 1.2, s0: building ? 1 : 0.6,
        s1: building ? 3.4 : 2, cell: CELL.puff, c0: [0.14, 0.13, 0.13, 0.62], c1: [0.3, 0.29, 0.29, 0], fadeIn: 0.2, anchor, spin: 0.35 });
    }
  }
  update(sim, dt) {
    this.time += dt;
    const cache = new Map();
    const visible = (anchor) => {
      if (!anchor) return true;
      if (!cache.has(anchor)) cache.set(anchor, anchor.shot ? shotVisible(anchor, sim) : sim.isVisible(anchor));
      return cache.get(anchor);
    };
    for (let i = this.timeline.length - 1; i >= 0; i--)
      if (this.timeline[i].at <= this.time) this.timeline.splice(i, 1)[0].run();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.travel);
      if (p.rocket && dt > 0) {
        p.trail += dt;
        while (p.trail > 0.025) {
          p.trail -= 0.025;
          this.particle(this.smoke, { x: p.from.x + (p.to.x - p.from.x) * t, y: p.from.y + (p.to.y - p.from.y) * t,
            z: p.from.z + (p.to.z - p.from.z) * t, vy: 0.3, drag: 1, life: 0.7 + Math.random() * 0.3, s0: 0.25, s1: 1,
            cell: CELL.puff, c0: [0.82, 0.8, 0.77, 0.5], c1: [0.7, 0.7, 0.7, 0], anchor: p.anchor, spin: 0.6 });
        }
      }
      if (t >= 1) {
        this.projectiles.splice(i, 1);
        if (visible(p.anchor)) this.hit(p.to, p.cannon || p.rocket, p.anchor);
      }
    }
    // Fire on critically damaged machines and buildings; same fog-aware budget as the HUD.
    this.burning = burningEntities(sim, this.view.lowPower);
    if (dt > 0) for (const e of this.burning) this.burn(e, dt);
    for (const [id, em] of this.emitters) if (this.time - em.seen > 1) this.emitters.delete(id);
    this.decals.update(dt, visible);
    this.smoke.update(dt, visible);
    this.glow.update(dt, visible);
    let n = 0;
    for (const d of this.debris) {
      d.age += dt;
      if (d.age >= d.life) continue;
      this.debris[n++] = d;
      d.vy -= 16 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.spin * dt; d.ry += d.spin * 0.7 * dt;
      const floor = 0.08 * d.scale;
      if (d.y < floor) { d.y = floor; d.vy = Math.abs(d.vy) > 1.5 ? -d.vy * 0.3 : 0; d.vx *= 0.55; d.vz *= 0.55; d.spin *= 0.5; }
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
    if (!drawn) { this.debrisMesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0)); drawn = 1; }
    this.debrisMesh.count = drawn;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }
  get active() {
    return this.glow.items.length + this.smoke.items.length + this.decals.items.length + this.debris.length + this.projectiles.length;
  }
  clear() {
    for (const layer of [this.decals, this.smoke, this.glow]) layer.clear();
    this.debris.length = this.projectiles.length = this.timeline.length = 0;
    this.emitters.clear();
    this.burning = [];
    this.update({ isVisible: () => false, entities: [] }, 0);
  }
  dispose() {
    this.view.scene.remove(this.root);
    for (const layer of [this.decals, this.smoke, this.glow]) layer.dispose();
    this.debrisMesh.geometry.dispose();
    this.debrisMesh.material.dispose();
    this.texture.dispose();
  }
}
