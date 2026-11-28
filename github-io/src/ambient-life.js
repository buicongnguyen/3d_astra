import * as THREE from "three";
import { fnv1a, mulberry32 } from "./rng.js";
import { lookOf } from "./visual-style.js";

// Small living details per battlefield: birds with ground shadows, butterflies, dragonflies,
// fish and drifting motes (ash, dust, pollen, fireflies, embers). Every family is one
// instanced draw whose motion runs entirely in the vertex shader; the CPU advances one clock.
// Creatures sample the fog-of-war texture, so nothing shows over unexplored ground, and every
// path is bounded inside the map, so nothing is drawn beyond the playable edge.
//
// Motion levels (set by the frame-time governor in main.js): 2 full, 1 calm (slower, smaller
// wingbeats), 0 still (the clock stops and wings rest). Reduced motion is level 0.

// Counts are per 96 x 96 map area; they scale with map area and the device budget. Birds follow Settings > Hero > Birds
// (BIRD_SHARE): Many is the count below, Few (the default) a third of it (two to four) and one geese V, Off none.
// 2026-11-28: the brown birds were removed (the owner saw them as spiky shards): Basin and Woodlands fly crows.
export const LIFE = {
  classic: { birds: { look: "crow", count: 6, height: [9, 12], speed: [2.6, 3.4], soar: 0.25, radius: [7, 13] }, motes: { look: "ash", count: 90 } },
  riverlands: { birds: { look: "gull", count: 7, height: [9, 13], speed: [3, 4], soar: 0.45, radius: [8, 14] }, fish: { count: 26 }, butterflies: { count: 14 }, dragonflies: { count: 8 }, motes: { look: "pollen", count: 50 } },
  basin: { birds: { look: "crow", count: 4, height: [12, 15], speed: [2.2, 2.8], soar: 0.9, radius: [10, 16] }, butterflies: { count: 6 }, motes: { look: "dust", count: 90 } },
  expanse: { geese: { flocks: 2, size: 7 }, fish: { count: 30 }, butterflies: { count: 16 }, dragonflies: { count: 8 }, motes: { look: "pollen", count: 50 } },
  dunes: { birds: { look: "vulture", count: 5, height: [12, 15], speed: [2, 2.6], soar: 0.92, radius: [9, 15] }, motes: { look: "sand", count: 120 } },
  woodlands: { birds: { look: "crow", count: 8, height: [7, 10], speed: [3.4, 4.4], soar: 0.1, radius: [5, 9] }, fish: { count: 22 }, butterflies: { count: 28 }, dragonflies: { count: 10 }, motes: { look: "firefly", count: 70 } },
  highlands: { birds: { look: "raven", count: 6, height: [10, 13], speed: [2.6, 3.4], soar: 0.5, radius: [8, 14] }, motes: { look: "ember", count: 110 } },
  // W9 lands (src/lands.js). Snow and ash are land weather: their motes fall in a box that follows the camera
  // (`weather`), so the same few hundred flakes fill every view (one draw, all motion on the GPU). `count` is then
  // the whole box's, not per 96 x 96 m.
  snowfield: { birds: { look: "snowfinch", count: 6, height: [8, 11], speed: [3.2, 4.2], soar: 0.2, radius: [6, 10] }, motes: { look: "snow", count: 520, weather: true } },
  volcano: { birds: { look: "crow", count: 4, height: [11, 14], speed: [2.4, 3], soar: 0.7, radius: [9, 14] }, motes: { look: "ashfall", count: 360, weather: true } },
  archipelago: { birds: { look: "gull", count: 9, height: [9, 13], speed: [3, 4], soar: 0.55, radius: [8, 15] }, butterflies: { count: 18 }, motes: { look: "pollen", count: 50 } },
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
  snowfinch: ["#f2f4f6", "#c9d3de", "#3a4250"],
};
// Wingspan multipliers: songbirds smaller than a soldier, vultures and hawks broad.
const BIRD_SIZE = { crow: 0.9, gull: 1, hawk: 1.15, vulture: 1.35, songbird: 0.62, raven: 0.95, goose: 1.1, snowfinch: 0.7 };
const MOTES = {
  ash: { colors: ["#bdb8ad", "#8f8a80"], size: [0.1, 0.16], additive: false },
  dust: { colors: ["#e2b583", "#c98f5e"], size: [0.09, 0.15], additive: false },
  sand: { colors: ["#ecd3a0", "#d8b77c"], size: [0.08, 0.13], additive: false },
  pollen: { colors: ["#fff7d8", "#f4ffd0"], size: [0.07, 0.11], additive: false },
  firefly: { colors: ["#e6ff86", "#b9ff6a"], size: [0.12, 0.18], additive: true },
  ember: { colors: ["#ff9a3c", "#ff5426"], size: [0.09, 0.15], additive: true },
  // W9 land weather: soft falling snow; on the volcano grey ash drifting down with embers rising among it.
  snow: { colors: ["#ffffff", "#d8ecff"], size: [0.11, 0.2], additive: false },
  ashfall: { colors: ["#b8aca4", "#ff8a34"], size: [0.09, 0.16], additive: false },
};
// The weather box (W9): flakes wrap within WEATHER_SPAN m of the camera's focus and fall from WEATHER_TOP m.
export const WEATHER_SPAN = 26, WEATHER_TOP = 9;
const BUTTERFLY_COLORS = ["#ff9a2e", "#ffd43b", "#f7f3e3", "#6ec6ff", "#ff6fb5", "#ff7a3d"];
const DRAGONFLY_COLORS = ["#2fd1c6", "#3b8cff", "#7be04f"];

const rng = mulberry32;
// H5: the most a fish turns a second (rad).
export const FISH_TURN = 1.1;
const hashId = fnv1a;
const DIRECTION = new THREE.Vector3();
const between = (r, [a, b]) => a + (b - a) * r();
const hex = (value) => new THREE.Color().setHex(parseInt(value.slice(1), 16), THREE.LinearSRGBColorSpace);

// How many of the planned birds fly at each Birds setting (the plan draws them all first, so the rest of the cast stays
// where it was whatever the setting).
export const BIRD_SHARE = Object.freeze({ off: () => 0, few: (n) => Math.min(n, 4, Math.max(2, Math.round(n / 3))), many: (n) => n });
export const GEESE_FLOCKS = Object.freeze({ off: 0, few: 1, many: 2 });
// Pure, seeded placement: the same map always gets the same cast, and tests can check bounds.
export function planLife(terrain, budget = 1, birdLevel = "few") {
  const level = Object.hasOwn(BIRD_SHARE, birdLevel) ? birdLevel : "few";
  const recipe = LIFE[lookOf(terrain.id)] || {}, r = rng(hashId(terrain.id)), half = terrain.half;
  const scale = (n) => Math.max(0, Math.round(n * (terrain.size / 96) ** 2 * budget));
  const plan = { birds: [], fish: [], butterflies: [], dragonflies: [], motes: [], look: recipe.birds?.look || (recipe.geese ? "goose" : null), moteLook: recipe.motes?.look || null };
  const land = (x, z) => !["water", "ford", "bridge", "stone"].includes(terrain.at(x, z)) && !(terrain.level?.(x, z));
  if (recipe.birds) {
    const b = recipe.birds;
    const keep = BIRD_SHARE[level](scale(b.count));
    for (let i = 0; i < scale(b.count); i++) {
      const radius = between(r, b.radius), reach = half - radius - 3;
      // Every bird is drawn from the generator (so the rest of the cast stays put), only `keep` of them fly.
      const bird = { x: (r() * 2 - 1) * reach, y: between(r, b.height), z: (r() * 2 - 1) * reach, size: (0.9 + r() * 0.3) * BIRD_SIZE[b.look],
        radius, speed: between(r, b.speed) * (r() < 0.5 ? -1 : 1), phase: r() * 6.283, mode: 0,
        flap: 9 + r() * 3, soar: b.soar, back: 0, side: 0 };
      if (i < keep) plan.birds.push(bird);
    }
  }
  if (recipe.geese) {
    // V formations crossing the map on straight lines; they shrink away before the edge.
    const flocks = Math.max(1, Math.round(recipe.geese.flocks * Math.min(1, budget + 0.2)));
    for (let f = 0; f < flocks; f++) {
      const dir = r() * 6.283, phase = r(), x = (r() * 2 - 1) * half * 0.3, z = (r() * 2 - 1) * half * 0.3, y = 11 + r() * 2;
      for (let k = 0; k < recipe.geese.size; k++) {
        const rank = Math.ceil(k / 2), side = k === 0 ? 0 : k % 2 ? 1 : -1;
        if (f < GEESE_FLOCKS[level]) plan.birds.push({ x, y: y + rank * 0.08, z, size: BIRD_SIZE.goose, radius: dir, speed: 4.2, phase, mode: 1,
          flap: 7.5 + (k % 3) * 0.4, soar: 0.15, back: rank * 1.5, side: side * rank * 1.25 });
      }
    }
  }
  // Each river of the map (maps.json "rivers"; the one at z = 0 on the old river maps) takes its turn.
  const riverZ = (i) => terrain.rivers?.length ? terrain.rivers[i % terrain.rivers.length].z : 0;
  if (recipe.fish && terrain.river) {
    for (let i = 0; i < scale(recipe.fish.count); i++)
      plan.fish.push({ x: (r() * 2 - 1) * (half - 4), z: riverZ(i) + (r() * 2 - 1) * 2.1, size: 0.85 + r() * 0.45,
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
    for (const [x, z] of scatter(scale(recipe.butterflies.count), (x, z) => land(x, z) && (!terrain.river || (terrain.rivers || [{ z: 0 }]).every((river) => Math.abs(z - river.z) > 6))))
      plan.butterflies.push({ x, y: 0.75, z, size: 0.95 + r() * 0.35, rx: 1.5 + r() * 2.5, rz: 1.5 + r() * 2.5,
        speed: 0.7 + r() * 0.6, phase: r() * 6.283, color: BUTTERFLY_COLORS[Math.floor(r() * BUTTERFLY_COLORS.length)] });
  if (recipe.dragonflies && terrain.river)
    for (let i = 0; i < scale(recipe.dragonflies.count); i++) {
      const side = r() < 0.5 ? -1 : 1;
      plan.dragonflies.push({ x: (r() * 2 - 1) * (half - 8), y: 0.95, z: riverZ(i) + side * (3.6 + r() * 2.4), size: 1, rx: 1.6, rz: 0.7,
        speed: 0.4 + r() * 0.25, phase: r() * 50, color: DRAGONFLY_COLORS[Math.floor(r() * DRAGONFLY_COLORS.length)] });
    }
  if (recipe.motes) {
    const look = MOTES[recipe.motes.look];
    plan.weather = !!recipe.motes.weather;
    // Weather motes live in a box around the camera (x, z from -1 to 1 of its half span): their count does not
    // grow with the map, only with the device budget.
    if (plan.weather) {
      for (let i = 0; i < Math.round(recipe.motes.count * budget); i++)
        plan.motes.push({ x: r() * 2 - 1, y: r(), z: r() * 2 - 1, size: between(r, look.size), rate: 0.05 + r() * 0.05, phase: r(), tone: r() });
      return plan;
    }
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

// A detailed bird's wing (public/models/birds.glb, tools/build-birds.mjs): each vertex carries _bird = (wing side -1/0/1,
// span 0 at the shoulder .. 1 at the tip, head 0/1). Turns a wing vertex about its shoulder `hinge` (|x|, y, z): a bird
// modelled with folded wings (folded 1) spreads them as it opens and stretches them `stretch` times longer; an open-wing
// bird folds them back along the body at rest. Then the wingbeat `flap` (rad, + = up) about the body axis, stronger
// toward the tip. Shared by bird-view.js (near birds in Hero mode) and the goose V below, so both flap the same way.
export const WING_POSE = /* glsl */ `
vec3 rotY(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(q.x * c + q.z * s, q.y, -q.x * s + q.z * c); }
vec3 rotZ(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z); }
vec3 wingPose(vec3 local, inout vec3 n, vec3 bird, vec3 hinge, float folded, float stretch, float open, float flap) {
  float side = bird.x;
  vec3 h = vec3(side * hinge.x, hinge.y, hinge.z);
  vec3 q = local - h;
  float turn = folded > 0.5 ? -1.5708 * side * open : 1.45 * side * (1.0 - open);
  q = rotY(q, turn); n = rotY(n, turn);
  if (folded > 0.5) q *= mix(1.0, stretch, open);
  else { q.xz *= mix(0.5, 1.0, open); q.x *= mix(0.45, 1.0, open); q.y += (1.0 - open) * 0.04; }
  float a = side * flap * (0.7 + 0.5 * bird.y);
  q = rotZ(q, a); n = rotZ(n, a);
  return q + h;
}`;

// The Expanse geese V in Hero mode: the detailed goose (birds.glb "goose_lod", at most 400 triangles) on the same path
// and instance rows as the cards (BIRD_PATH), the wings spread and beating from the _bird attribute (WING_POSE). One
// instanced draw that replaces the card draw while it shows; lit by a fixed sun, fogged like the scene.
const GOOSE_VERTEX = /* glsl */ `${COMMON}${BIRD_PATH}${WING_POSE}
#include <fog_pars_vertex>
uniform vec3 uHinge, uSun;
uniform vec2 uNeck;    // neck pivot (y, z)
uniform vec4 uLook;    // body width, body length, neck reach (rad), wing stretch
uniform float uScale;
attribute vec3 _bird;
varying vec3 vColor;
void main() {
  vec3 p; vec2 fwd; float bank;
  birdPath(p, fwd, bank);
  vec3 local = position, n = normal;
  if (_bird.x != 0.0) local = wingPose(local, n, _bird, uHinge, 1.0, uLook.w, 1.0, birdFlap(1.0));
  else {
    // A goose in flight: the head and neck reach forward (the model sits with its head up), the body long and slim.
    if (_bird.z > 0.5) {
      vec3 q = local - vec3(0.0, uNeck.x, uNeck.y);
      float c = cos(uLook.z), s = sin(uLook.z);
      q = vec3(q.x, q.y * c - q.z * s, q.z * c + q.y * s);
      n = vec3(n.x, n.y * c - n.z * s, n.z * c + n.y * s);
      local = q + vec3(0.0, uNeck.x, uNeck.y);
    }
    local.x *= uLook.x; local.z *= uLook.y;
  }
  // A goose about to brush the Hero camera shrinks away instead of filling the screen (as bird-view.js's near birds).
  float show = inside(p, 1.0) * (1.0 - smoothstep(0.7, 0.85, fogAt(p))) * smoothstep(1.5, 4.0, distance(p, cameraPosition));
  vec3 world = place(local * aA.w * uScale * show, fwd, p);
  vec2 right = vec2(fwd.y, -fwd.x);
  vec3 wn = normalize(vec3(right.x * n.x + fwd.x * n.z, n.y, right.y * n.x + fwd.y * n.z));
  vColor = color * (0.5 + 0.62 * max(dot(wn, uSun), 0.0) + 0.12 * wn.y);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GOOSE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const GOOSE_SUN = new THREE.Vector3(-25, 55, 20).normalize();
// The goose of birds.glb is the duck recoloured, modelled sitting: in the V its body is this much narrower and longer, its
// head and neck tip this far forward (rad) and its wings spread this many times their folded length, so it reads as a
// goose in flight from below (long neck, broad wings; compared against 1, 1, 0, 1.8 in Hero mode shots).
export const GOOSE_LOOK = Object.freeze([0.8, 1.25, 1.2, 2.4]);

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
varying vec3 vWing; // H5: |x| and z on the wing (metres at size 1), 1 on a wing (0 the body)
varying float vKind; // 0 butterfly, 1 dragonfly
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
  vWing = vec3(abs(position.x), position.z, aSide == 0.0 ? 0.0 : 1.0);
  vKind = aC.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local * show, fwd, p), 1.0);
}`;
// H5: butterfly wings get a pattern (an eye spot on each forewing, a smaller one on each hindwing, dark veins and a pale
// band), dragonfly wings are see-through with a fine vein net and a dark spot near the tip. Same draws as before; the
// dragonflies' material blends (the wings let the water show through).
const FLUTTER_FRAGMENT = `varying vec3 vColor; varying vec3 vWing; varying float vKind;
void main() {
  vec3 c = vColor; float a = 1.0;
  if (vWing.z > 0.5) {
    vec2 w = vWing.xy;
    if (vKind < 0.5) {
      float fore = step(-0.02, w.y);
      vec2 spot = fore > 0.5 ? vec2(0.2, 0.1) : vec2(0.13, -0.12);
      float r = length(w - spot) / (fore > 0.5 ? 1.0 : 0.75);
      c = mix(c, c * 0.18, smoothstep(0.042, 0.034, r));                 // dark ring
      c = mix(c, vec3(0.96, 0.95, 0.86), smoothstep(0.024, 0.016, r));    // pale eye
      c = mix(c, vec3(0.05, 0.05, 0.08), smoothstep(0.01, 0.003, r));     // pupil
      float ang = atan(w.y, w.x + 0.01);
      c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.05, abs(fract(ang * 1.6 + 0.5) - 0.5))) * step(0.04, w.x); // veins
      c = mix(c, c * 1.35 + 0.08, smoothstep(0.012, 0.0, abs(w.x - 0.12)) * fore * 0.6); // pale band
    } else {
      vec2 g = abs(fract(w * vec2(38.0, 52.0)) - 0.5);
      float vein = 1.0 - smoothstep(0.0, 0.12, min(g.x, g.y));
      a = 0.3 + 0.35 * vein;
      c = mix(vec3(0.82, 0.9, 0.94), c * 0.5, vein * 0.6);
      float tip = smoothstep(0.025, 0.012, length(w - vec2(0.31, w.y > 0.0 ? 0.075 : -0.035)));
      c = mix(c, vec3(0.12, 0.12, 0.16), tip); a = max(a, tip * 0.9);
    }
  }
  gl_FragColor = vec4(c * a, a);
}`;

// Fish swim along the river channel and wrap at the map ends. Each is a small low-poly 3D fish
// (fishGeometry: a lofted body, dorsal fin, side fins and a forked tail, 49 triangles) in one of three
// kinds picked per instance (aB.w: 0 silver, 1 orange-and-white koi, 2 dark carp), dark on the back and pale
// on the belly. A travelling wave bends the body, growing toward the tail; a fixed light shades the facets.
// Drawn just above the opaque water, tinted toward it and partly transparent so they read as under it.
const FISH_VERTEX = `${COMMON}
attribute vec4 aA; // x, z, size, heading (H5: the wander's live state, written each frame by AmbientLife.swim)
attribute vec4 aB; // speed, phase, koi (0/1), kind (0 silver, 1 koi, 2 carp)
attribute vec2 aPaint; // 0 belly .. 1 back, 1 = fin
varying vec3 vColor; varying float vAlpha;
void main() {
  float t = uTime, x = aA.x, z = aA.y;
  vec3 p = vec3(x, -0.03, z);
  vec2 fwd = vec2(cos(aA.w), sin(aA.w));
  vec3 local = position * aA.z;
  // The swimming wave: nothing at the nose, strongest at the tail tip.
  float k = clamp((0.42 - position.z) / 0.9, 0.0, 1.0);
  float wave = t * 9.0 * (0.7 + 0.3 * aB.x) + aB.y - position.z * 7.0;
  local.x += sin(wave) * 0.12 * k * k * aA.z * uAmp;
  float ford = smoothstep(4.5, 6.5, abs(x));
  float show = inside(p, 1.0) * ford;
  // Colours (sRGB, unconverted like the other effect shaders): back, belly and fin of each kind.
  vec3 back = vec3(0.36, 0.46, 0.5), belly = vec3(0.84, 0.88, 0.9), fin = vec3(0.62, 0.7, 0.74);
  if (aB.w > 1.5) { back = vec3(0.16, 0.18, 0.12); belly = vec3(0.55, 0.48, 0.3); fin = vec3(0.24, 0.24, 0.17); }
  else if (aB.w > 0.5) {
    back = vec3(0.97, 0.94, 0.88); belly = vec3(0.98, 0.96, 0.92); fin = vec3(1.0, 0.86, 0.72);
    // Koi patches: orange blotches on the back, a different pattern per fish.
    float blotch = sin(position.z * 15.0 + aB.y * 3.0) * sin(position.x * 22.0 + aB.y * 5.0 + 1.3) + 0.25 * sin(position.z * 31.0 + aB.y);
    back = mix(back, vec3(0.95, 0.38, 0.1), step(0.05, blotch) * step(0.25, aPaint.x));
  }
  vec3 c = mix(mix(belly, back, aPaint.x), fin, aPaint.y);
  // A fixed light from above and the sun side: the facets of the turned body shade.
  vec2 right = vec2(fwd.y, -fwd.x);
  vec3 n = normalize(vec3(right.x * normal.x + fwd.x * normal.z, normal.y, right.y * normal.x + fwd.y * normal.z));
  float lit = 0.58 + 0.42 * abs(dot(n, normalize(vec3(0.35, 0.9, 0.25))));
  vColor = mix(c * lit, vec3(0.12, 0.32, 0.36), 0.18);
  vAlpha = 0.75 * show * (1.0 - smoothstep(0.7, 0.85, fogAt(p)));
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local * show, fwd, p), 1.0);
}`;
const FISH_FRAGMENT = `varying vec3 vColor; varying float vAlpha; void main() { if (vAlpha < 0.01) discard; gl_FragColor = vec4(vColor, vAlpha); }`;

const MOTE_VERTEX = (kind) => `${COMMON}
#define KIND_${kind.toUpperCase()}
uniform float uPx; uniform vec3 uColorA, uColorB; uniform vec3 uFocus;
attribute vec4 aA; // x, y (0..1), z, size
attribute vec4 aB; // rate, phase, tone
varying vec3 vColor; varying float vAlpha;
void main() {
  float t = uTime, life = fract(t * aB.x + aB.y), ph = aB.y * 6.283;
  vec3 p; float alpha;
#if defined(KIND_SNOW) || defined(KIND_ASHFALL)
  // Land weather (W9): a box of ${WEATHER_SPAN * 2} m around the camera's focus, wrapped so it always fills the view.
  float span = ${(WEATHER_SPAN * 2).toFixed(1)};
  vec2 drift = vec2(sin(t * 0.5 + ph) * 0.6 + t * 0.35, cos(t * 0.4 + ph) * 0.4 + t * 0.12);
  float wx = uFocus.x + mod(aA.x * ${WEATHER_SPAN.toFixed(1)} + drift.x - uFocus.x + span * 0.5, span) - span * 0.5;
  float wz = uFocus.z + mod(aA.z * ${WEATHER_SPAN.toFixed(1)} + drift.y - uFocus.z + span * 0.5, span) - span * 0.5;
  p = vec3(wx, ${WEATHER_TOP.toFixed(1)} * (1.0 - life), wz);
  alpha = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.85, 1.0, life)) * 0.85;
#if defined(KIND_ASHFALL)
  // A third of the motes are embers rising from the ground instead of ash falling.
  if (aB.z > 0.66) { p.y = 0.3 + life * 6.0; p.x += sin(t * 1.4 + ph) * 0.4; alpha = (1.0 - life) * smoothstep(0.0, 0.1, life); }
#endif
#elif defined(KIND_ASH)
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
#if defined(KIND_ASHFALL)
  vColor = aB.z > 0.66 ? uColorB : uColorA;
#endif
  gl_PointSize = clamp(aA.w * uPx, 1.5, 14.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const MOTE_FRAGMENT = `varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, d)); if (a < 0.004) discard; gl_FragColor = vec4(vColor, a); }`;

// Low-poly shapes in a local frame: +z forward, +x right, y up.
export function birdGeometry() {
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
// A low-poly fish in its local frame (+z nose, y up, metres at size 1): a lofted body of hexagonal rings, a
// dorsal fin, two side fins and a forked tail spread flat so it reads from the high camera. Flat-shaded facets;
// aPaint.x is 0 on the belly and 1 on the back, aPaint.y 1 on the fins.
export const FISH_TRIANGLES = 49;
export function fishGeometry() {
  const pos = [], paint = [];
  const tri = (a, b, c, fin = 0) => { for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); paint.push(fin ? 0.6 : Math.min(1, Math.max(0, 0.5 + v[1] * 9)), fin); } };
  // Stations along the body: z, half width, half height.
  const stations = [[0.28, 0.08, 0.055], [0.1, 0.125, 0.078], [-0.1, 0.095, 0.06], [-0.25, 0.03, 0.022]];
  const ring = ([z, w, h]) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * w, Math.sin(a) * h, z]; });
  const rings = stations.map(ring), nose = [0, 0.005, 0.42];
  for (let i = 0; i < 6; i++) tri(nose, rings[0][(i + 1) % 6], rings[0][i]);
  for (let s = 0; s < 3; s++)
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6, a = rings[s], b = rings[s + 1];
      tri(a[i], a[j], b[j]); tri(a[i], b[j], b[i]);
    }
  // Dorsal fin (a raked blade on the back) and two side fins.
  tri([0, 0.075, 0.13], [0, 0.15, -0.03], [0, 0.055, -0.12], 1);
  tri([0.07, -0.01, 0.12], [0.2, -0.03, 0.02], [0.08, -0.02, 0.02], 1);
  tri([-0.07, -0.01, 0.12], [-0.08, -0.02, 0.02], [-0.2, -0.03, 0.02], 1);
  // Forked tail: two lobes, each a pair of triangles, spread from the narrow root.
  for (const side of [-1, 1]) {
    const root = [0.025 * side, 0, -0.24], mid = [0, 0, -0.31], tip = [0.16 * side, 0.01, -0.45], inner = [0.05 * side, 0.005, -0.37];
    tri(root, tip, inner, 1); tri(root, inner, mid, 1);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aPaint", new THREE.Float32BufferAttribute(paint, 2));
  g.computeVertexNormals();
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
  constructor(scene, terrain, { fogTexture, budget = 1, sunShift = [25 / 55, -20 / 55], birds = "few" } = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "AmbientLife";
    scene.add(this.root);
    this.birdLevel = birds;
    this.plan = planLife(terrain, budget, birds);
    this.uniforms = { uTime: { value: 0 }, uAmp: { value: 1 }, uHalf: { value: terrain.half }, uFog: { value: fogTexture } };
    // The camera's focus on the ground, for land weather (W9): flakes fall around it.
    this.focus = { value: new THREE.Vector3() };
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
      this.birdCards = add(birds, material(BIRD_VERTEX, SOLID_FRAGMENT, { uBody: { value: colors[0] }, uWing: { value: colors[1] }, uTip: { value: colors[2] } }, { side: THREE.DoubleSide }), "life:birds");
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
      // Premultiplied blending: the butterflies stay opaque (alpha 1), the dragonflies' wings let the ground through.
      const options = { side: THREE.DoubleSide, ...(dragonfly ? { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } : {}) };
      add(geometry, material(FLUTTER_VERTEX, FLUTTER_FRAGMENT, {}, options), dragonfly ? "life:dragonflies" : "life:butterflies", dragonfly ? 1 : 0);
      register(dragonfly ? "dragonflies" : "butterflies", geometry, rows, (b) => [b.x, b.z, Math.max(b.rx, b.rz)]);
    };
    flutter(plan.butterflies, false);
    flutter(plan.dragonflies, true);
    if (plan.fish.length) {
      // Kind: the koi stay koi; the rest are silver or dark carp, picked from the phase (the seeded plan is unchanged).
      const kind = (f) => f.koi ? 1 : (f.phase * 7.31) % 1 < 0.6 ? 0 : 2;
      // H5: each fish wanders with a turn limit (swim()): its live place and heading start at the plan's.
      // The lane is the centre line of the fish's own river (the nearest one).
      const rivers = terrain.rivers?.length ? terrain.rivers.map((r) => r.z) : [0];
      const laneOf = (z) => rivers.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
      for (const f of plan.fish) Object.assign(f, { px: f.x, pz: f.z, h: f.dir > 0 ? 0 : Math.PI, aim: f.dir > 0 ? 0 : Math.PI, next: f.phase, lane: laneOf(f.z) });
      const pick = (f, name) => name === "aA" ? [f.px, f.pz, f.size, f.h] : [f.speed, f.phase, f.koi, kind(f)];
      const geometry = instanced(fishGeometry(), plan.fish, pick, [["aA", 4], ["aB", 4]]);
      geometry.getAttribute("aA").setUsage(THREE.DynamicDrawUsage);
      add(geometry, material(FISH_VERTEX, FISH_FRAGMENT, {}, { transparent: true, side: THREE.DoubleSide }), "life:fish");
      // The fish's live place, so a blast kills the fish that is actually there now.
      this.fish = register("fish", geometry, plan.fish, (f) => [f.px, f.pz, 0.6]);
      this.wander = rng(hashId(`${terrain.id}|fish`)); // cosmetic only: never the simulation's generator
      this.fishHalf = half;
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
        { uPx: this.pixels, uColorA: { value: hex(look.colors[0]) }, uColorB: { value: hex(look.colors[1]) }, uFocus: this.focus },
        { transparent: true, depthWrite: false, blending: look.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      points.name = plan.weather ? "life:weather" : "life:motes";
      points.frustumCulled = false;
      this.root.add(points);
      // Weather flakes have no place of their own on the map: blasts never thin them.
      const motes = register("motes", g, plan.motes, plan.weather ? null : (m) => [m.x, m.z, 1.5], true);
      if (plan.weather) { this.weather = points; motes.weather = true; }
    }
  }
  configure(settings) {
    this.shown = settings.detail !== false;
    this.root.visible = this.shown && this.share > 0;
    // Settings > Display > Weather Off also stops the land's snow or ash (W9), like a storm's rain.
    if (this.weather) this.weather.visible = settings.weather !== false;
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
    if (group.model) group.model.instanceCount = n;
  }
  // Hero mode (bird-view.js hands over birds.glb's "goose_lod" once it has loaded it; null hands it back): the geese V
  // draws as the detailed goose instead of the cards. Same instance rows (shared buffers: kills, thinning and the
  // clock apply to both), so it is a swap, never an extra draw. Built on first use; cheap to call every frame.
  gooseModel(src, { size = 1.1 } = {}) {
    const birds = this.groups.find((g) => g.name === "birds");
    if (!birds || this.plan.look !== "goose") return false;
    if (src && !this.geese) {
      const g = new THREE.InstancedBufferGeometry(), sg = src.geometry;
      for (const name of ["position", "normal", "color", "_bird"]) g.setAttribute(name, sg.getAttribute(name));
      if (sg.index) g.setIndex(sg.index);
      for (const name of ["aA", "aB", "aC"]) g.setAttribute(name, birds.geometry.getAttribute(name));
      const x = src.userData || {};
      const mat = new THREE.ShaderMaterial({ name: "GooseV",
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...this.uniforms, uHinge: { value: new THREE.Vector3(...(x.hinge || [0, 0, 0])) },
          uNeck: { value: new THREE.Vector2(...(x.neck || [0, 0])) }, uLook: { value: new THREE.Vector4(...GOOSE_LOOK) },
          uSun: { value: GOOSE_SUN }, uScale: { value: 1 / size } },
        vertexShader: GOOSE_VERTEX, fragmentShader: GOOSE_FRAGMENT, vertexColors: true, fog: true, side: THREE.DoubleSide });
      this.materials.push(mat);
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = "life:geese";
      mesh.frustumCulled = false; // positions come from the shader
      mesh.visible = false;
      this.root.add(mesh);
      this.geese = { mesh, on: false, triangles: (sg.index ? sg.index.count : sg.getAttribute("position").count) / 3 };
      birds.model = g;
      this.applyCount(birds);
    }
    const on = !!(src && this.geese);
    if (this.geese && this.geese.on !== on) { this.geese.on = on; this.geese.mesh.visible = on; this.birdCards.visible = !on; }
    return on;
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
  // H5 fish wander (lightweight-game-objects: turn-limited wander, accumulated state): each fish turns toward an aim
  // heading at most FISH_TURN rad/s, picks a new aim every 1.5-4 s (seeded), keeps to its river (about 2 m either side of the centre line)
  // and turns back before the map's end and the ford in the middle.
  swim(dt) {
    const g = this.fish;
    if (!g || dt <= 0) return;
    const r = this.wander, a = g.geometry.getAttribute("aA"), arr = a.array, lim = this.fishHalf - 5;
    for (let i = 0; i < g.alive; i++) {
      const f = g.rows[i];
      f.next -= dt;
      if (f.next <= 0) { f.next = 1.5 + r() * 2.5; f.aim = f.h + (r() - 0.5) * 1.6; }
      // Keep to the lane: steer back toward it the further the fish strays; turn round at the ends and the ford.
      const off = f.pz - f.lane, east = Math.cos(f.h) >= 0;
      let aim = f.aim;
      if (Math.abs(off) > 1.1) aim = Math.atan2(-Math.sign(off), east ? 0.8 : -0.8);
      else if (Math.abs(Math.sin(aim)) > 0.55) aim = Math.atan2(Math.sign(Math.sin(aim)) * 0.55, Math.cos(aim) || 1);
      if ((east && f.px > lim) || (!east && f.px < -lim) || (Math.abs(f.px) < 7.5 && (east ? f.px < 0 : f.px > 0) && Math.abs(f.px) > 5.5)) { aim = east ? (off > 0 ? -Math.PI + 0.25 : Math.PI - 0.25) : (off > 0 ? -0.25 : 0.25); f.aim = aim; } // turn round toward the centre line
      let d = Math.atan2(Math.sin(aim - f.h), Math.cos(aim - f.h));
      const turn = FISH_TURN * dt;
      d = Math.max(-turn, Math.min(turn, d));
      f.h += d;
      const v = f.speed * (1 - 0.6 * Math.abs(d) / Math.max(1e-6, turn)); // slower in a tight turn
      f.px += Math.cos(f.h) * v * dt; f.pz += Math.sin(f.h) * v * dt;
      arr[i * 4] = f.px; arr[i * 4 + 1] = f.pz; arr[i * 4 + 3] = f.h;
    }
    a.clearUpdateRanges(); a.addUpdateRange(0, g.alive * 4); a.needsUpdate = true;
  }
  update(dt, camera, bufferHeight) {
    const level = this.quiet ? 0 : this.level, speed = [0, 0.35, 1][level];
    this.swim(Math.min(0.05, Math.max(0, dt)) * speed);
    this.uniforms.uTime.value = (this.uniforms.uTime.value + Math.min(0.05, Math.max(0, dt)) * speed) % 3600;
    this.uniforms.uAmp.value = [0, 0.45, 1][level];
    if (this.pixels) this.pixels.value = bufferHeight / Math.max(1, camera.top - camera.bottom);
    // Land weather follows the point on the ground the camera looks at.
    if (this.weather && camera?.isCamera) {
      camera.getWorldDirection(DIRECTION);
      const k = DIRECTION.y < -1e-3 ? -camera.position.y / DIRECTION.y : 0;
      this.focus.value.set(camera.position.x + DIRECTION.x * k, 0, camera.position.z + DIRECTION.z * k);
    }
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
