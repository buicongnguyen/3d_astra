import * as THREE from "three";

// Small living details per battlefield: birds with ground shadows, butterflies, dragonflies,
// fish and drifting motes (ash, dust, pollen, fireflies, embers). Every family is one
// instanced draw whose motion runs entirely in the vertex shader; the CPU advances one clock.
// Creatures sample the fog-of-war texture, so nothing shows over unexplored ground, and every
// path is bounded inside the map, so nothing is drawn beyond the playable edge.
//
// Motion levels (set by the frame-time governor in main.js): 2 full, 1 calm (slower, smaller
// wingbeats), 0 still (the clock stops and wings rest). Reduced motion is level 0.

// Counts are per 96 x 96 map area; they scale with map area and the device budget.
export const LIFE = {
  classic: { birds: { look: "crow", count: 6, height: [9, 12], speed: [2.6, 3.4], soar: 0.25, radius: [7, 13] }, motes: { look: "ash", count: 90 } },
  riverlands: { birds: { look: "gull", count: 7, height: [9, 13], speed: [3, 4], soar: 0.45, radius: [8, 14] }, fish: { count: 26 }, butterflies: { count: 14 }, dragonflies: { count: 8 }, motes: { look: "pollen", count: 50 } },
  basin: { birds: { look: "hawk", count: 4, height: [12, 15], speed: [2.2, 2.8], soar: 0.9, radius: [10, 16] }, butterflies: { count: 6 }, motes: { look: "dust", count: 90 } },
  expanse: { geese: { flocks: 2, size: 7 }, fish: { count: 30 }, butterflies: { count: 16 }, dragonflies: { count: 8 }, motes: { look: "pollen", count: 50 } },
  dunes: { birds: { look: "vulture", count: 5, height: [12, 15], speed: [2, 2.6], soar: 0.92, radius: [9, 15] }, motes: { look: "sand", count: 120 } },
  woodlands: { birds: { look: "songbird", count: 8, height: [7, 10], speed: [3.4, 4.4], soar: 0.1, radius: [5, 9] }, fish: { count: 22 }, butterflies: { count: 28 }, dragonflies: { count: 10 }, motes: { look: "firefly", count: 70 } },
  highlands: { birds: { look: "raven", count: 6, height: [10, 13], speed: [2.6, 3.4], soar: 0.5, radius: [8, 14] }, motes: { look: "ember", count: 110 } },
};

// Colours are sRGB, written unconverted like the other effect shaders.
const BIRDS = {
  crow: ["#2b2927", "#1f1e1c", "#121110"],
  gull: ["#f4f2ea", "#dedcd2", "#4b5054"],
  hawk: ["#94704a", "#6f5232", "#2e241a"],
  vulture: ["#3e352f", "#2d2622", "#8a7c6c"],
  songbird: ["#f2a53c", "#9a6230", "#3b2b1f"],
  raven: ["#272a34", "#1b1d26", "#0f1016"],
  goose: ["#8f8676", "#6f675b", "#2a2622"],
};
// Wingspan multipliers: songbirds smaller than a soldier, vultures and hawks broad.
const BIRD_SIZE = { crow: 0.9, gull: 1, hawk: 1.15, vulture: 1.35, songbird: 0.62, raven: 0.95, goose: 1.1 };
const MOTES = {
  ash: { colors: ["#bdb8ad", "#8f8a80"], size: [0.1, 0.16], additive: false },
  dust: { colors: ["#e2b583", "#c98f5e"], size: [0.09, 0.15], additive: false },
  sand: { colors: ["#ecd3a0", "#d8b77c"], size: [0.08, 0.13], additive: false },
  pollen: { colors: ["#fff7d8", "#f4ffd0"], size: [0.07, 0.11], additive: false },
  firefly: { colors: ["#e6ff86", "#b9ff6a"], size: [0.12, 0.18], additive: true },
  ember: { colors: ["#ff9a3c", "#ff5426"], size: [0.09, 0.15], additive: true },
};
const BUTTERFLY_COLORS = ["#ff9a2e", "#ffd43b", "#f7f3e3", "#6ec6ff", "#ff6fb5", "#ff7a3d"];
const DRAGONFLY_COLORS = ["#2fd1c6", "#3b8cff", "#7be04f"];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashId = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const between = (r, [a, b]) => a + (b - a) * r();
const hex = (value) => new THREE.Color().setHex(parseInt(value.slice(1), 16), THREE.LinearSRGBColorSpace);

// Pure, seeded placement: the same map always gets the same cast, and tests can check bounds.
export function planLife(terrain, budget = 1) {
  const recipe = LIFE[terrain.id] || {}, r = rng(hashId(terrain.id)), half = terrain.half;
  const scale = (n) => Math.max(0, Math.round(n * (terrain.size / 96) ** 2 * budget));
  const plan = { birds: [], fish: [], butterflies: [], dragonflies: [], motes: [], look: recipe.birds?.look || (recipe.geese ? "goose" : null), moteLook: recipe.motes?.look || null };
  const land = (x, z) => !["water", "ford", "bridge", "stone"].includes(terrain.at(x, z));
  if (recipe.birds) {
    const b = recipe.birds;
    for (let i = 0; i < scale(b.count); i++) {
      const radius = between(r, b.radius), reach = half - radius - 3;
      plan.birds.push({ x: (r() * 2 - 1) * reach, y: between(r, b.height), z: (r() * 2 - 1) * reach, size: (0.9 + r() * 0.3) * BIRD_SIZE[b.look],
        radius, speed: between(r, b.speed) * (r() < 0.5 ? -1 : 1), phase: r() * 6.283, mode: 0,
        flap: 9 + r() * 3, soar: b.soar, back: 0, side: 0 });
    }
  }
  if (recipe.geese) {
    // V formations crossing the map on straight lines; they shrink away before the edge.
    for (let f = 0; f < Math.max(1, Math.round(recipe.geese.flocks * Math.min(1, budget + 0.2))); f++) {
      const dir = r() * 6.283, phase = r(), x = (r() * 2 - 1) * half * 0.3, z = (r() * 2 - 1) * half * 0.3, y = 11 + r() * 2;
      for (let k = 0; k < recipe.geese.size; k++) {
        const rank = Math.ceil(k / 2), side = k === 0 ? 0 : k % 2 ? 1 : -1;
        plan.birds.push({ x, y: y + rank * 0.08, z, size: BIRD_SIZE.goose, radius: dir, speed: 4.2, phase, mode: 1,
          flap: 7.5 + (k % 3) * 0.4, soar: 0.15, back: rank * 1.5, side: side * rank * 1.25 });
      }
    }
  }
  if (recipe.fish && terrain.river) {
    for (let i = 0; i < scale(recipe.fish.count); i++)
      plan.fish.push({ x: (r() * 2 - 1) * (half - 4), z: (r() * 2 - 1) * 2.1, size: 0.85 + r() * 0.45,
        dir: r() < 0.5 ? -1 : 1, speed: 0.9 + r() * 1.3, phase: r() * 6.283, koi: r() < 0.22 ? 1 : 0 });
  }
  const scatter = (count, accept, attempts = 12) => {
    const out = [];
    for (let i = 0; i < count; i++)
      for (let a = 0; a < attempts; a++) {
        const x = (r() * 2 - 1) * (half - 6), z = (r() * 2 - 1) * (half - 6);
        if (accept(x, z)) { out.push([x, z]); break; }
      }
    return out;
  };
  if (recipe.butterflies)
    for (const [x, z] of scatter(scale(recipe.butterflies.count), (x, z) => land(x, z) && (!terrain.river || Math.abs(z) > 6)))
      plan.butterflies.push({ x, y: 0.75, z, size: 0.95 + r() * 0.35, rx: 1.5 + r() * 2.5, rz: 1.5 + r() * 2.5,
        speed: 0.7 + r() * 0.6, phase: r() * 6.283, color: BUTTERFLY_COLORS[Math.floor(r() * BUTTERFLY_COLORS.length)] });
  if (recipe.dragonflies && terrain.river)
    for (let i = 0; i < scale(recipe.dragonflies.count); i++) {
      const side = r() < 0.5 ? -1 : 1;
      plan.dragonflies.push({ x: (r() * 2 - 1) * (half - 8), y: 0.95, z: side * (3.6 + r() * 2.4), size: 1, rx: 1.6, rz: 0.7,
        speed: 0.4 + r() * 0.25, phase: r() * 50, color: DRAGONFLY_COLORS[Math.floor(r() * DRAGONFLY_COLORS.length)] });
    }
  if (recipe.motes) {
    const look = MOTES[recipe.motes.look];
    for (let i = 0; i < scale(recipe.motes.count); i++)
      plan.motes.push({ x: (r() * 2 - 1) * (half - 8), y: r(), z: (r() * 2 - 1) * (half - 8), size: between(r, look.size),
        rate: 0.05 + r() * 0.08, phase: r(), tone: r() });
  }
  return plan;
}

const COMMON = `
uniform float uTime, uAmp, uHalf;
uniform sampler2D uFog;
// Fog of war: 0 visible, ~0.57 explored, ~0.91 unexplored (view.js fog texture).
float fogAt(vec3 p) {
  vec2 uv = vec2((p.x + uHalf) / (2.0 * uHalf), (uHalf - p.z) / (2.0 * uHalf));
  return texture2D(uFog, uv).a;
}
// Shrink to nothing near the edge so paths never draw beyond the playable map.
float inside(vec3 p, float margin) { return 1.0 - smoothstep(uHalf - margin - 3.0, uHalf - margin, max(abs(p.x), abs(p.z))); }
vec3 place(vec3 local, vec2 fwd, vec3 origin) {
  vec2 right = vec2(fwd.y, -fwd.x);
  return origin + vec3(right.x * local.x + fwd.x * local.z, local.y, right.y * local.x + fwd.y * local.z);
}
float hash(float n) { return fract(sin(n) * 43758.5453); }
`;

// Birds: circling (mode 0) or crossing in formation (mode 1). Wings flap about the body axis;
// soaring species glide most of the time. The SHADOW variant draws a soft blob on the ground,
// offset along the sun, from the same path.
const BIRD_PATH = `
attribute vec4 aA; // centre x, height, centre z, size
attribute vec4 aB; // radius (mode 0) or heading (mode 1), speed, phase, mode
attribute vec4 aC; // flap rate, soar, formation back, formation side
void birdPath(out vec3 p, out vec2 fwd, out float bank) {
  float t = uTime, phase = aB.z;
  if (aB.w < 0.5) {
    float a = phase + t * aB.y / max(aB.x, 1.0);
    p = vec3(aA.x + cos(a) * aB.x, aA.y, aA.z + sin(a) * aB.x);
    fwd = normalize(vec2(-sin(a), cos(a)) * sign(aB.y));
    bank = -0.32 * sign(aB.y);
  } else {
    fwd = vec2(cos(aB.x), sin(aB.x));
    float span = uHalf * 2.0 + 40.0, s = mod(t * aB.y + phase * span, span) - span * 0.5;
    vec2 right = vec2(fwd.y, -fwd.x);
    vec2 xz = aA.xz + fwd * (s - aC.z) + right * aC.w;
    p = vec3(xz.x, aA.y, xz.y);
    bank = 0.0;
  }
  p.y += sin(t * 0.5 + phase) * 0.45 * uAmp;
}
float birdFlap(float span) {
  float glide = smoothstep(0.5, 0.92, sin(uTime * 0.33 + aB.z * 3.1));
  float flapping = mix(1.0, glide, aC.y);
  return mix(0.14, sin(uTime * aC.x + aB.z * 7.0) * 0.85, flapping) * uAmp + 0.12 * (1.0 - uAmp);
}`;

const BIRD_VERTEX = `${COMMON}${BIRD_PATH}
uniform vec3 uBody, uWing, uTip;
attribute float aSpan; // 0 body, up to 1 at the wing tip
attribute float aTip;
varying vec3 vColor;
void main() {
  vec3 p; vec2 fwd; float bank;
  birdPath(p, fwd, bank);
  float a = birdFlap(aSpan) * (1.0 + 0.45 * aSpan);
  vec3 local = position * aA.w;
  if (aSpan > 0.0) { float x = local.x; local.x = x * cos(a); local.y += abs(x) * sin(a); }
  local.y += local.x * sin(bank);
  float show = inside(p, 1.0) * (1.0 - smoothstep(0.7, 0.85, fogAt(p)));
  vec3 world = place(local * show, fwd, p);
  float shade = mix(1.05, 0.78, clamp(abs(sin(a)) * aSpan, 0.0, 1.0));
  vColor = mix(mix(uBody, uWing, step(0.01, aSpan)), uTip, aTip) * shade;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const SOLID_FRAGMENT = `varying vec3 vColor; void main() { gl_FragColor = vec4(vColor, 1.0); }`;

const SHADOW_VERTEX = `${COMMON}${BIRD_PATH}
uniform vec2 uSun; // ground shift per unit of height, along the sun
varying vec2 vUv; varying float vAlpha;
void main() {
  vec3 p; vec2 fwd; float bank;
  birdPath(p, fwd, bank);
  float a = birdFlap(1.0);
  vec3 ground = vec3(p.x + uSun.x * p.y, 0.06, p.z + uSun.y * p.y);
  vec3 local = vec3(position.x * 0.62 * cos(a), 0.0, position.y * 0.42) * aA.w;
  vUv = position.xy;
  vAlpha = 0.16 * inside(ground, 1.0) * (1.0 - smoothstep(0.5, 0.8, fogAt(ground)));
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local, fwd, ground), 1.0);
}`;
const SHADOW_FRAGMENT = `varying vec2 vUv; varying float vAlpha;
void main() { float d = length(vUv); float a = vAlpha * (1.0 - smoothstep(0.35, 1.0, d)); if (a < 0.004) discard; gl_FragColor = vec4(0.05, 0.08, 0.07, a); }`;

// Butterflies (mode 0) wander on loose loops; dragonflies (mode 1) hover, then dart.
const FLUTTER_VERTEX = `${COMMON}
attribute vec4 aA; // anchor x, height, z, size
attribute vec4 aB; // loop radius x, z, speed, phase
attribute vec4 aC; // mode, flap rate
attribute vec3 aColor;
attribute float aSide; // -1 left wing, 1 right wing, 0 body
attribute float aEdge; // 1 at the wing rim
varying vec3 vColor;
vec3 flutterAt(float t) {
  float ph = aB.w;
  if (aC.x < 0.5)
    return aA.xyz + vec3(sin(t * 0.5 * aB.z + ph) * aB.x + sin(t * 1.3 * aB.z + ph * 2.0) * 0.4,
      0.35 * sin(t * 1.7 + ph),
      sin(t * 0.37 * aB.z + ph * 1.7) * aB.y + cos(t * 1.1 * aB.z + ph) * 0.4);
  float k = t * aB.z + ph, seg = floor(k), u = fract(k);
  vec2 from = vec2(hash(seg), hash(seg + 17.3)) * 2.0 - 1.0, to = vec2(hash(seg + 1.0), hash(seg + 18.3)) * 2.0 - 1.0;
  vec2 o = mix(from, to, smoothstep(0.72, 0.94, u)) * aB.xy;
  return aA.xyz + vec3(o.x, 0.15 * sin(t * 3.0 + ph), o.y);
}
void main() {
  float t = uTime;
  vec3 p = flutterAt(t), ahead = flutterAt(t + 0.08) - p;
  vec2 fwd = length(ahead.xz) > 1e-4 ? normalize(ahead.xz) : vec2(0.0, 1.0);
  float flap = sin(t * aC.y + aB.w * 5.0);
  float a = aC.x < 0.5 ? (0.25 + 0.75 * (0.5 + 0.5 * flap)) * 1.2 : 0.35 * flap;
  a *= uAmp;
  p.y += (aC.x < 0.5 ? 0.06 * flap : 0.0) * uAmp;
  vec3 local = position * aA.w;
  if (aSide != 0.0) { float x = local.x; local.x = x * cos(a); local.y += abs(x) * sin(a); }
  float show = inside(p, 1.0) * (1.0 - smoothstep(0.7, 0.85, fogAt(p)));
  // Butterflies: dark body, coloured wings. Dragonflies: coloured body, pale glassy wings.
  vec3 wing = aC.x < 0.5 ? mix(aColor, aColor * 0.25, aEdge * 0.7) : mix(aColor, vec3(0.86, 0.93, 0.96), 0.72);
  vec3 body = aC.x < 0.5 ? vec3(0.16, 0.14, 0.12) : aColor;
  vColor = (aSide == 0.0 ? body : wing) * mix(1.0, 0.82, abs(sin(a)));
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local * show, fwd, p), 1.0);
}`;

// Fish swim along the river channel and wrap at the map ends; a travelling wave bends the
// body. Drawn just above the opaque water, tinted and half transparent so they read as under it.
const FISH_VERTEX = `${COMMON}
attribute vec4 aA; // x, z, size, direction
attribute vec4 aB; // speed, phase, koi
varying vec3 vColor; varying float vAlpha;
void main() {
  float t = uTime, span = uHalf * 2.0 - 4.0, dir = aA.w;
  float x = mod(aA.x + uHalf - 2.0 + t * aB.x * dir, span) - span * 0.5;
  float z = aA.y + sin(t * 0.4 + aB.y) * 0.5;
  vec3 p = vec3(x, -0.05, z);
  vec2 fwd = normalize(vec2(dir, cos(t * 0.4 + aB.y) * 0.2));
  vec3 local = position * aA.z;
  local.x += sin(t * 9.0 + aB.y - position.z * 9.0) * 0.08 * (0.45 - position.z) * aA.z * uAmp;
  float ford = smoothstep(4.5, 6.5, abs(x));
  float show = inside(p, 1.0) * ford;
  vColor = mix(vec3(0.12, 0.27, 0.3), vec3(0.94, 0.54, 0.24), aB.z);
  vAlpha = 0.6 * show * (1.0 - smoothstep(0.7, 0.85, fogAt(p)));
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local * show, fwd, p), 1.0);
}`;
const FISH_FRAGMENT = `varying vec3 vColor; varying float vAlpha; void main() { if (vAlpha < 0.01) discard; gl_FragColor = vec4(vColor, vAlpha); }`;

const MOTE_VERTEX = (kind) => `${COMMON}
#define KIND_${kind.toUpperCase()}
uniform float uPx; uniform vec3 uColorA, uColorB;
attribute vec4 aA; // x, y (0..1), z, size
attribute vec4 aB; // rate, phase, tone
varying vec3 vColor; varying float vAlpha;
void main() {
  float t = uTime, life = fract(t * aB.x + aB.y), ph = aB.y * 6.283;
  vec3 p; float alpha;
#if defined(KIND_ASH)
  p = vec3(aA.x + sin(t * 0.3 + ph) * 1.2 + life * 4.0, 5.0 - life * 4.8, aA.z + life * 2.0);
  alpha = sin(life * 3.1416) * 0.6;
#elif defined(KIND_DUST) || defined(KIND_SAND)
  p = vec3(aA.x + (life - 0.5) * 14.0, 0.25 + aA.y * 1.2 + sin(t * 1.3 + ph) * 0.15, aA.z + (life - 0.5) * 5.0);
  alpha = sin(life * 3.1416) * 0.55;
#elif defined(KIND_POLLEN)
  p = vec3(aA.x + sin(t * 0.4 + ph) * 0.8, 0.6 + aA.y * 2.4 + sin(t * 0.6 + ph) * 0.4, aA.z + cos(t * 0.35 + ph) * 0.8);
  alpha = 0.55 + 0.25 * sin(t * 1.7 + ph);
#elif defined(KIND_FIREFLY)
  p = vec3(aA.x + sin(t * 0.45 + ph) * 1.2, 0.5 + aA.y * 1.2 + sin(t * 0.9 + ph) * 0.3, aA.z + cos(t * 0.33 + ph) * 1.2);
  alpha = pow(0.5 + 0.5 * sin(t * 2.4 + ph * 9.0), 6.0) * 0.95 + 0.05;
#else
  p = vec3(aA.x + sin(t * 1.5 + ph) * 0.3, life * 5.5, aA.z + cos(t * 1.2 + ph) * 0.3);
  alpha = (1.0 - life) * smoothstep(0.0, 0.08, life) * 0.9;
#endif
  float fog = fogAt(p);
  vAlpha = alpha * inside(p, 1.0) * (1.0 - smoothstep(0.3, 0.75, fog));
  vColor = mix(uColorA, uColorB, aB.z);
#if defined(KIND_EMBER)
  vColor = mix(uColorA, uColorB, life);
#endif
  gl_PointSize = clamp(aA.w * uPx, 1.5, 14.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const MOTE_FRAGMENT = `varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, d)); if (a < 0.004) discard; gl_FragColor = vec4(vColor, a); }`;

// Low-poly shapes in a local frame: +z forward, +x right, y up.
function birdGeometry() {
  const p = [], span = [], tip = [];
  const v = (x, y, z, s = 0, t = 0) => { p.push(x, y, z); span.push(s); tip.push(t); };
  const tri = (a, b, c) => { v(...a); v(...b); v(...c); };
  // Body and forked tail.
  tri([0, 0.03, 0.36], [-0.07, 0, 0.06], [0.07, 0, 0.06]);
  tri([-0.07, 0, 0.06], [0, 0.02, -0.34], [0.07, 0, 0.06]);
  tri([0, 0.02, -0.28], [-0.12, 0, -0.46], [0.12, 0, -0.46]);
  for (const side of [-1, 1]) {
    const rf = [0.05 * side, 0, 0.12, 0.08], rb = [0.05 * side, 0, -0.12, 0.08];
    const ef = [0.32 * side, 0, 0.08, 0.5], eb = [0.3 * side, 0, -0.12, 0.5], tp = [0.64 * side, 0, -0.16, 1, 1];
    tri(rf, rb, eb); tri(rf, eb, ef); tri(ef, eb, tp);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("aSpan", new THREE.Float32BufferAttribute(span, 1));
  g.setAttribute("aTip", new THREE.Float32BufferAttribute(tip, 1));
  return g;
}
function flutterGeometry(dragonfly) {
  const p = [], side = [], edge = [];
  // Corners are [x, z, edge]: edge 1 darkens toward the wing rim.
  const quad = (a, b, c, d, s) => { for (const [x, z, e] of [a, b, c, a, c, d]) { p.push(x, 0, z); side.push(s); edge.push(e); } };
  if (dragonfly) {
    quad([-0.025, -0.34, 0], [0.025, -0.34, 0], [0.025, 0.22, 0], [-0.025, 0.22, 0], 0);
    for (const s of [-1, 1]) {
      quad([0.02 * s, 0.1, 0], [0.36 * s, 0.1, 0], [0.36 * s, 0.03, 0], [0.02 * s, 0.02, 0], s);
      quad([0.02 * s, 0, 0], [0.3 * s, 0, 0], [0.3 * s, -0.07, 0], [0.02 * s, -0.08, 0], s);
    }
  } else {
    quad([-0.02, -0.13, 0], [0.02, -0.13, 0], [0.02, 0.14, 0], [-0.02, 0.14, 0], 0);
    for (const s of [-1, 1]) {
      // Slanted forewing and a smaller rounded hindwing.
      quad([0.01 * s, 0.11, 0], [0.31 * s, 0.2, 1], [0.27 * s, -0.03, 0.8], [0.01 * s, -0.02, 0], s);
      quad([0.01 * s, -0.02, 0], [0.23 * s, -0.06, 0.8], [0.15 * s, -0.22, 1], [0.01 * s, -0.12, 0], s);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  return g;
}
function fishGeometry() {
  const p = [0, 0, 0.42, -0.13, 0, 0.05, 0.13, 0, 0.05, -0.13, 0, 0.05, 0, 0, -0.26, 0.13, 0, 0.05,
    0, 0, -0.22, -0.15, 0, -0.44, 0.15, 0, -0.44];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return g;
}
function instanced(geometry, rows, pick, names) {
  for (const [name, size] of names) {
    const data = new Float32Array(rows.length * size);
    rows.forEach((row, i) => data.set(pick(row, name), i * size));
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(data, size));
  }
  geometry.instanceCount = rows.length;
  return geometry;
}

export class AmbientLife {
  constructor(scene, terrain, { fogTexture, budget = 1, sunShift = [25 / 55, -20 / 55] } = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "AmbientLife";
    scene.add(this.root);
    this.plan = planLife(terrain, budget);
    this.uniforms = { uTime: { value: 0 }, uAmp: { value: 1 }, uHalf: { value: terrain.half }, uFog: { value: fogTexture } };
    this.level = 2;
    this.quiet = false;
    this.share = 1;
    this.shown = true;
    this.materials = [];
    // Each family's live creatures sit first in its buffers; `alive` of them are drawn (times
    // `share`), so killed or thinned creatures cost nothing at all.
    this.groups = [];
    const half = terrain.half;
    const register = (name, geometry, rows, at, points = false) => {
      const group = { name, geometry, rows: rows.slice(), alive: rows.length, at, points };
      this.groups.push(group);
      return group;
    };
    const plan = this.plan, shared = this.uniforms;
    const material = (vertexShader, fragmentShader, extra = {}, options = {}) => {
      const m = new THREE.ShaderMaterial({ uniforms: { ...shared, ...extra }, vertexShader, fragmentShader, ...options });
      this.materials.push(m);
      return m;
    };
    const add = (geometry, mat, name, renderOrder = 0) => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = name;
      mesh.frustumCulled = false; // positions come from the shader
      mesh.renderOrder = renderOrder;
      this.root.add(mesh);
      return mesh;
    };
    if (plan.birds.length) {
      const colors = BIRDS[plan.look].map(hex);
      const pick = (b, name) => name === "aA" ? [b.x, b.y, b.z, b.size] : name === "aB" ? [b.radius, b.speed, b.phase, b.mode] : [b.flap, b.soar, b.back, b.side];
      const names = [["aA", 4], ["aB", 4], ["aC", 4]];
      const birds = instanced(birdGeometry(), plan.birds, pick, names);
      add(birds, material(BIRD_VERTEX, SOLID_FRAGMENT, { uBody: { value: colors[0] }, uWing: { value: colors[1] }, uTip: { value: colors[2] } }, { side: THREE.DoubleSide }), "life:birds");
      const quad = new THREE.InstancedBufferGeometry();
      quad.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      for (const [name] of names) quad.setAttribute(name, birds.getAttribute(name));
      quad.instanceCount = plan.birds.length;
      add(quad, material(SHADOW_VERTEX, SHADOW_FRAGMENT, { uSun: { value: new THREE.Vector2(...sunShift) } }, { transparent: true, depthWrite: false }), "life:bird-shadows", 1);
      // Birds fly above the battle: never killed, only thinned. Shadows follow their birds.
      register("birds", birds, plan.birds, null).shadow = quad;
    }
    const flutter = (rows, dragonfly) => {
      if (!rows.length) return;
      const pick = (b, name) => name === "aA" ? [b.x, b.y, b.z, b.size] : name === "aB" ? [b.rx, b.rz, b.speed, b.phase]
        : name === "aC" ? [dragonfly ? 1 : 0, dragonfly ? 46 : 16, 0, 0] : hex(b.color).toArray();
      const geometry = instanced(flutterGeometry(dragonfly), rows, pick, [["aA", 4], ["aB", 4], ["aC", 4], ["aColor", 3]]);
      add(geometry, material(FLUTTER_VERTEX, SOLID_FRAGMENT, {}, { side: THREE.DoubleSide }), dragonfly ? "life:dragonflies" : "life:butterflies");
      register(dragonfly ? "dragonflies" : "butterflies", geometry, rows, (b) => [b.x, b.z, Math.max(b.rx, b.rz)]);
    };
    flutter(plan.butterflies, false);
    flutter(plan.dragonflies, true);
    if (plan.fish.length) {
      const pick = (f, name) => name === "aA" ? [f.x, f.z, f.size, f.dir] : [f.speed, f.phase, f.koi, 0];
      const geometry = instanced(fishGeometry(), plan.fish, pick, [["aA", 4], ["aB", 4]]);
      add(geometry, material(FISH_VERTEX, FISH_FRAGMENT, {}, { transparent: true, depthWrite: false, side: THREE.DoubleSide }), "life:fish");
      // Same path as FISH_VERTEX, so a blast kills the fish that is actually there now.
      const span = half * 2 - 4, wrap = (a, n) => ((a % n) + n) % n;
      register("fish", geometry, plan.fish, (f, t) => [wrap(f.x + half - 2 + t * f.speed * f.dir, span) - span / 2, f.z, 0.6]);
    }
    if (plan.motes.length) {
      const look = MOTES[plan.moteLook], g = new THREE.BufferGeometry();
      const A = new Float32Array(plan.motes.length * 4), B = new Float32Array(plan.motes.length * 4);
      plan.motes.forEach((m, i) => { A.set([m.x, m.y, m.z, m.size], i * 4); B.set([m.rate, m.phase, m.tone, 0], i * 4); });
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(plan.motes.length * 3), 3));
      g.setAttribute("aA", new THREE.BufferAttribute(A, 4));
      g.setAttribute("aB", new THREE.BufferAttribute(B, 4));
      this.pixels = { value: 10 };
      const points = new THREE.Points(g, material(MOTE_VERTEX(plan.moteLook), MOTE_FRAGMENT,
        { uPx: this.pixels, uColorA: { value: hex(look.colors[0]) }, uColorB: { value: hex(look.colors[1]) } },
        { transparent: true, depthWrite: false, blending: look.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      points.name = "life:motes";
      points.frustumCulled = false;
      this.root.add(points);
      register("motes", g, plan.motes, (m) => [m.x, m.z, 1.5], true);
    }
  }
  configure(settings) {
    this.shown = settings.detail !== false;
    this.root.visible = this.shown && this.share > 0;
  }
  // level: 2 full, 1 calm, 0 still. quiet (reduced motion) holds everything still.
  setLevel(level) {
    this.level = level;
  }
  // Fraction of the live creatures drawn: the governor thins them on slow devices.
  setShare(share) {
    this.share = share;
    this.root.visible = this.shown && share > 0;
    for (const group of this.groups) this.applyCount(group);
  }
  applyCount(group) {
    const n = Math.ceil(group.alive * this.share);
    if (group.points) group.geometry.setDrawRange(0, n);
    else group.geometry.instanceCount = n;
    if (group.shadow) group.shadow.instanceCount = n;
  }
  // Combat kills the small creatures it reaches (birds fly above it). A dead creature swaps
  // places with the last live one in every per-instance buffer, and the draw shrinks by one.
  disturb(x, z, radius) {
    const t = this.uniforms.uTime.value;
    let killed = 0;
    for (const group of this.groups) {
      if (!group.at) continue;
      const before = group.alive;
      for (let i = group.alive - 1; i >= 0; i--) {
        const [cx, cz, reach] = group.at(group.rows[i], t);
        if (Math.hypot(cx - x, cz - z) > radius + reach * 0.5) continue;
        const last = --group.alive;
        for (const [name, attribute] of Object.entries(group.geometry.attributes)) {
          if (name === "position" || !(group.points || attribute.isInstancedBufferAttribute)) continue;
          const size = attribute.itemSize, array = attribute.array;
          for (let k = 0; k < size; k++) {
            const a = array[i * size + k];
            array[i * size + k] = array[last * size + k];
            array[last * size + k] = a;
          }
          attribute.needsUpdate = true;
        }
        [group.rows[i], group.rows[last]] = [group.rows[last], group.rows[i]];
        killed++;
      }
      if (group.alive !== before) this.applyCount(group);
    }
    return killed;
  }
  get aliveCount() {
    return this.groups.reduce((n, g) => n + g.alive, 0);
  }
  update(dt, camera, bufferHeight) {
    const level = this.quiet ? 0 : this.level, speed = [0, 0.35, 1][level];
    this.uniforms.uTime.value = (this.uniforms.uTime.value + Math.min(0.05, Math.max(0, dt)) * speed) % 3600;
    this.uniforms.uAmp.value = [0, 0.45, 1][level];
    if (this.pixels) this.pixels.value = bufferHeight / Math.max(1, camera.top - camera.bottom);
  }
  get drawCount() {
    return this.root.children.length;
  }
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => o.geometry?.dispose());
    for (const m of this.materials) m.dispose();
  }
}
