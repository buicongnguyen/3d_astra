import * as THREE from "three";
import { DEFINITIONS as D } from "./data.js";
import { factionOf } from "./faction-colors.js";
import { CELL, GRID, drawAtlas } from "./building-decals-atlas.js";

// Building life (AAA round 3, R3-L; docs/VIEW_PLUGINS.md): flat 2D details drawn on and in front of the
// buildings from ONE canvas-drawn atlas (building-decals-atlas.js) in ONE InstancedMesh, so every decal of
// every building costs a single draw call (no shadow pass: it casts and receives no shadow).
//
// On the walls: hazard stripes, bay numbers, emblem plates, pictogram signs, vents, banners, crystal gauges,
// blinking beacons, a scrolling sign, a production light bar (lit while training) and a door light that
// flashes when a unit comes out. They sit on the faces that look toward the default camera (south, east
// and west in world space), found by casting rays at the building's own model once per type and facing.
// On the ground, in front of the gate (the south exit, sim/economy.js EXIT_ORDER): a painted concrete apron
// with team chevrons pointing out, runway lights that chase toward the gate while the building trains
// (faster near the end), a dust puff and fading tracks when a unit leaves, energy dashes from the Foundry and
// Relays toward the Command core, a scrolling blueprint grid under a building going up, a warm light pool
// that grows strong on night looks, and a ground stencil in the building's faction style.
//
// One draw handles both plain and glowing parts: premultiplied blending, where a plain decal writes its
// alpha and a glow writes alpha 0 (pure addition). Every animation runs in the shader from one clock
// uniform and per-instance data (cell, mode, phase, value); the instance buffers are rewritten only when a
// building appears, finishes, hides or goes, and a few floats change while a building trains. The clock
// stops with the game, with reduced motion and when the frame governor holds motion still (static look).
// View only: the plugin reads the simulation and never writes it.

const CAPACITY = 2048, TRACKS = 96, DUSTS = 12, POOL = TRACKS + DUSTS;
const GLOW = 32; // added to a cell id: drawn as light (additive)
export const MODE = { still: 0, blink: 1, progress: 2, scroll: 3, pulse: 4, chase: 5, track: 6, rotate: 7, night: 8, blueprint: 9, dust: 10, halo: 11 };
const LIGHT = { red: 0xff6a3d, amber: 0xffc46b, warm: 0xffd9a0, white: 0xffffff, mauve: 0xd9a8ff, ice: 0xbfe6ff, ember: 0xff8a3a };
// World faces (outward x, z) and the tangent u runs along.
const FACE = { S: [0, 1, 1, 0], E: [1, 0, 0, -1], W: [-1, 0, 0, 1] };

// Wall decals of each building type: cell, face, u (-1..1 of the half width), v (0..1 of the height),
// width, height (world units for a building of radius 2.5; scaled with the radius), then options:
// m mode, p phase, glow, team (tinted by the team colour), color, role ("bar": production progress,
// "door": flashes when a unit leaves).
const w = (cell, face, u, v, wd, ht, o = {}) => ({ cell: CELL[cell], face, u, v, wd, ht, ...o });
const PRODUCER = [
  w("door", "S", 0, 0.14, 1.7, 0.4, { glow: true, m: MODE.pulse, role: "door", color: LIGHT.warm }),
  w("bar", "S", 0, 0.52, 1.25, 0.32, { glow: true, m: MODE.progress, role: "bar", team: true }),
  w("hazard", "S", 0, 0.04, 2.1, 0.32),
];
export const WALL = {
  hq: [...PRODUCER,
    w("bolt", "S", -0.62, 0.42, 0.8, 0.8), w("emblem", "S", 0.62, 0.45, 0.8, 0.85, { team: true }),
    w("ticker", "S", 0, 0.74, 1.8, 0.34, { glow: true, m: MODE.scroll, p: 2, color: LIGHT.amber }),
    w("beacon", "S", -0.85, 0.92, 0.45, 0.45, { glow: true, m: MODE.blink, p: 0, color: LIGHT.red }),
    w("beacon", "S", 0.85, 0.92, 0.45, 0.45, { glow: true, m: MODE.blink, p: 0.5, color: LIGHT.red }),
    w("banner", "E", -0.5, 0.55, 0.6, 1.0, { team: true }), w("banner", "E", 0.5, 0.55, 0.6, 1.0, { team: true }),
    w("gauge", "E", 0, 0.4, 0.5, 0.75), w("vent", "W", 0, 0.35, 0.9, 0.7), w("gauge", "W", 0.55, 0.4, 0.5, 0.75)],
  barracks: [...PRODUCER,
    w("plate1", "S", -0.62, 0.36, 0.75, 0.55), w("helmet", "S", 0.62, 0.4, 0.7, 0.7),
    w("beacon", "S", 0.8, 0.9, 0.4, 0.4, { glow: true, m: MODE.blink, p: 0.25, color: LIGHT.amber }),
    w("emblem", "E", -0.35, 0.55, 0.7, 0.75, { team: true }), w("banner", "E", 0.45, 0.55, 0.55, 0.9, { team: true }),
    w("vent", "E", 0, 0.22, 0.7, 0.45), w("caution", "W", 0, 0.42, 0.6, 0.6)],
  foundry: [...PRODUCER,
    w("plate2", "S", -0.62, 0.36, 0.75, 0.55), w("gear", "S", 0.62, 0.4, 0.7, 0.7),
    w("ticker", "S", 0, 0.76, 1.6, 0.32, { glow: true, m: MODE.scroll, p: 2, color: LIGHT.amber }),
    w("beacon", "S", -0.8, 0.92, 0.4, 0.4, { glow: true, m: MODE.blink, p: 0.6, color: LIGHT.red }),
    w("vent", "E", -0.45, 0.35, 0.7, 0.55), w("vent", "E", 0.45, 0.35, 0.7, 0.55), w("gauge", "E", 0, 0.45, 0.5, 0.75),
    w("emblem", "W", 0, 0.5, 0.7, 0.75, { team: true })],
  relay: [w("bolt", "S", 0, 0.38, 0.65, 0.65), w("gauge", "S", 0.6, 0.4, 0.4, 0.6),
    w("beacon", "S", 0, 0.95, 0.4, 0.4, { glow: true, m: MODE.blink, p: 0.1, color: LIGHT.amber }), w("vent", "E", 0, 0.3, 0.6, 0.45)],
  tower: [w("sight", "S", 0, 0.32, 0.6, 0.6), w("hazard", "S", 0, 0.06, 1.4, 0.26),
    w("beacon", "S", 0, 0.9, 0.38, 0.38, { glow: true, m: MODE.blink, p: 0.35, color: LIGHT.red }), w("caution", "E", 0, 0.3, 0.5, 0.5)],
  workshop: [w("wrench", "S", 0.55, 0.42, 0.7, 0.7), w("hazard", "S", 0, 0.05, 1.9, 0.3),
    w("door", "S", -0.2, 0.14, 1.2, 0.35, { glow: true, m: MODE.pulse, role: "door", color: LIGHT.warm }),
    w("beacon", "S", -0.75, 0.85, 0.38, 0.38, { glow: true, m: MODE.blink, p: 0.8, color: LIGHT.amber }),
    w("vent", "E", 0, 0.3, 0.7, 0.5), w("banner", "E", 0.5, 0.55, 0.5, 0.85, { team: true })],
  salvageyard: [w("hazard", "S", 0, 0.06, 1.9, 0.3), w("caution", "S", 0.6, 0.4, 0.6, 0.6), w("vent", "S", -0.55, 0.35, 0.7, 0.55),
    w("ember", "S", -0.2, 0.75, 0.4, 0.4, { glow: true, m: MODE.blink, p: 0.2, color: LIGHT.ember }),
    w("ember", "S", 0.25, 0.8, 0.35, 0.35, { glow: true, m: MODE.blink, p: 0.7, color: LIGHT.ember }), w("banner", "E", 0, 0.55, 0.55, 0.9, { team: true })],
  waystation: [w("banner", "S", -0.55, 0.5, 0.55, 0.9, { team: true }), w("banner", "S", 0.55, 0.5, 0.55, 0.9, { team: true }),
    w("emblem", "S", 0, 0.45, 0.6, 0.65, { team: true }), w("beacon", "S", 0, 0.9, 0.35, 0.35, { glow: true, m: MODE.blink, p: 0.4, color: LIGHT.amber }),
    w("gauge", "E", 0, 0.4, 0.45, 0.65)],
  pylon: [w("emblem", "S", 0, 0.45, 0.6, 0.65, { team: true }), w("hazard", "E", 0, 0.08, 1.2, 0.26),
    w("beacon", "S", -0.5, 0.88, 0.35, 0.35, { glow: true, m: MODE.blink, p: 0, color: LIGHT.ice }),
    w("beacon", "S", 0.5, 0.88, 0.35, 0.35, { glow: true, m: MODE.blink, p: 0.5, color: LIGHT.ice })],
  veilrelay: [w("emblem", "S", 0, 0.42, 0.6, 0.65, { team: true }), w("gauge", "S", 0.6, 0.4, 0.4, 0.6),
    w("beacon", "S", -0.5, 0.9, 0.38, 0.38, { glow: true, m: MODE.blink, p: 0.3, color: LIGHT.mauve }), w("banner", "E", 0, 0.55, 0.5, 0.85, { team: true })],
};
const TYPE_FACTION = { salvageyard: "ashfall", waystation: "sunward", pylon: "wardens", veilrelay: "veil" };
const FACTION_CELL = { ashfall: CELL.ashfall, wardens: CELL.wardens, sunward: CELL.sunward, veil: CELL.veil, meridian: CELL.meridian };
const FLOW_FROM = new Set(["foundry", "relay"]); // energy dashes run from these to the Command core

// How strong the warm light pools are under a mission look (0 by day, 1 at full night).
export function nightOf(state) {
  if (!state?.name) return 0;
  return (state.name === "night" ? 1 : state.name === "storm" ? 0.55 : state.name === "dusk" ? 0.45 : 0) * (state.k ?? 1);
}

const VERTEX = /* glsl */ `
attribute vec4 aData;
varying vec2 vUv;
varying vec4 vData;
varying vec3 vTint;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vData = aData;
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(1.0);
  #endif
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  if (aData.y == ${MODE.halo}.0) {
    mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * aData.w;
    mvPosition.z += 0.14;
  }
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uStill;
uniform float uNight;
varying vec2 vUv;
varying vec4 vData;
varying vec3 vTint;
#include <common>
#include <fog_pars_fragment>
bool outside(vec2 p) { return p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0; }
void main() {
  float cell = vData.x, phase = vData.z, val = vData.w, t = uTime;
  float glow = step(${GLOW - 0.5}, cell);
  cell -= glow * ${GLOW}.0;
  int m = int(vData.y + 0.5);
  vec2 uv = vUv;
  float k = 1.0, fade = 1.0;
  if (m == ${MODE.scroll}) uv.x = fract(uv.x * phase + val - t * 0.9);
  else if (m == ${MODE.rotate}) {
    float a = t * 0.25 + phase; vec2 c = uv - 0.5;
    uv = vec2(cos(a) * c.x - sin(a) * c.y, sin(a) * c.x + cos(a) * c.y) + 0.5;
    if (outside(uv)) discard;
  } else if (m == ${MODE.blueprint}) uv = fract(uv * phase + vec2(0.0, t * 0.15));
  else if (m == ${MODE.dust}) {
    float age = max(0.0, t - val);
    fade = clamp(1.0 - age / 0.9, 0.0, 1.0);
    uv = (uv - 0.5) / (0.55 + age * 0.9) + 0.5;
    if (outside(uv)) discard;
  }
  vec2 cuv = (vec2(mod(cell, ${GRID.cols}.0), ${GRID.rows - 1}.0 - floor(cell / ${GRID.cols}.0)) + clamp(uv, 0.02, 0.98)) / vec2(${GRID.cols}.0, ${GRID.rows}.0);
  vec4 tex = texture2D(uAtlas, cuv);
  if (m == ${MODE.blink}) k = uStill > 0.5 ? 1.0 : 0.2 + 0.8 * step(0.5, fract(t * 0.7 + phase));
  else if (m == ${MODE.progress}) k = vUv.x <= val ? 1.0 : 0.16;
  else if (m == ${MODE.pulse}) k = 0.35 + 1.4 * exp(-max(0.0, t - val) * 3.0);
  else if (m == ${MODE.chase}) {
    // Idle landing guides breathe slowly; units in production keep the quicker chase.
    float idle = 0.52 + 0.25 * cos(6.283 * (t * 0.27 - phase));
    k = uStill > 0.5 ? 0.72 : (val <= 0.0 ? idle : 0.25 + 1.2 * smoothstep(0.7, 1.0, fract(t * val - phase)));
  }
  else if (m == ${MODE.track}) fade = clamp(1.0 - (t - val) / 20.0, 0.0, 1.0);
  else if (m == ${MODE.night}) k = 0.05 + 0.7 * uNight;
  else if (m == ${MODE.blueprint}) fade = val < 0.0 ? 1.0 : clamp(1.0 - (t - val) / 1.5, 0.0, 1.0);
  vec3 col = tex.rgb * vTint;
  float a = tex.a * fade;
  if (a < 0.01) discard;
  float ff = 0.0;
  #ifdef USE_FOG
    ff = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  if (glow > 0.5) gl_FragColor = vec4(col * a * k * (1.0 - ff), 0.0);
  else {
    float o = a * min(k, 1.0);
    #ifdef USE_FOG
      col = mix(col, fogColor, ff);
    #endif
    gl_FragColor = vec4(col * o, o);
  }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const scratch = { m: new THREE.Matrix4(), b: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() };
const UP = new THREE.Vector3(0, 1, 0);

export class BuildingDecalsView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.placements = new Map(); // `${type}|${angle}` -> { wall: [{ matrix, spec }], ext }
    this.clock = 0;
    this.hash = 0;
    this.records = new Map(); // building id -> { e, bar: [slots], chase: [slots], door: [slots] }
    this.finished = new Map(); // building id -> clock when it was seen complete (blueprint fade)
    this.watch = []; // units just out of a building: tracks while they walk off
    this.trackNext = 0;
    this.dustNext = 0;
    this.count = POOL;
    this.state = { decals: 0, buildings: 0 }; // read by the tests and the render budget
  }
  build() {
    const atlas = typeof document === "undefined" ? new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) : new THREE.CanvasTexture(drawAtlas(document));
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    atlas.needsUpdate = true;
    this.uniforms = { uAtlas: { value: atlas }, uTime: { value: 0 }, uStill: { value: 0 }, uNight: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      name: "BuildingDecals",
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, fog: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    Object.assign(material.uniforms, this.uniforms);
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, CAPACITY);
    mesh.name = "BuildingDecals";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3).fill(1), 3);
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
    this.data.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute("aData", this.data);
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    // Under units and selection rings (ring 3, markers 4) and under eco blob shadows (0); the fog of war (2)
    // covers the ground parts in fogged ground.
    mesh.renderOrder = -1;
    // The pools (tracks, dust) start empty: long faded.
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < POOL; i++) { mesh.setMatrixAt(i, zero); this.data.setXYZW(i, CELL.boots, MODE.track, 0, -1e6); }
    mesh.count = POOL;
    mesh.visible = false;
    this.mesh = mesh;
    this.view.scene.add(mesh);
  }
  // The local placements of one type facing one way, from rays cast at its model (null until it loads).
  placement(type, angle, team) {
    const key = `${type}|${angle.toFixed(3)}`;
    if (this.placements.has(key)) return this.placements.get(key);
    const template = this.view.teamTemplates?.get(`${type}-${team}`);
    if (!template) return null;
    const saved = [template.position.clone(), template.quaternion.clone(), template.scale.clone()];
    template.position.set(0, 0, 0); template.quaternion.identity(); template.scale.set(1, 1, 1);
    template.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(template);
    const size = D[type]?.radius ? D[type].radius / 2.5 : 1;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // World direction -> model space (the model turns by `angle` about y).
    const toModel = (x, z) => new THREE.Vector3(x * cos - z * sin, 0, x * sin + z * cos);
    const centre = box.getCenter(new THREE.Vector3()), reach = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) + 3;
    const ray = new THREE.Raycaster();
    ray.layers.enableAll();
    const wall = [];
    for (const spec of WALL[type] || []) {
      const [fx, fz, tx, tz] = FACE[spec.face], out = toModel(fx, fz), along = toModel(tx, tz);
      const half = Math.abs(along.x) * (box.max.x - box.min.x) / 2 + Math.abs(along.z) * (box.max.z - box.min.z) / 2;
      const origin = centre.clone().addScaledVector(along, spec.u * half * 0.8).addScaledVector(out, reach);
      origin.y = box.min.y + spec.v * (box.max.y - box.min.y);
      ray.set(origin, out.clone().negate());
      ray.far = reach * 2;
      const hit = ray.intersectObject(template, true).find((h) => h.face && h.object.isMesh);
      if (!hit) continue;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (normal.dot(out) < 0) normal.negate();
      if (normal.y > 0.8) normal.copy(out); // a ledge: stand the decal up facing out
      const x = new THREE.Vector3().crossVectors(UP, normal);
      if (x.lengthSq() < 1e-6) x.copy(along);
      x.normalize();
      const y = new THREE.Vector3().crossVectors(normal, x).normalize();
      const p = hit.point.clone().addScaledVector(normal, 0.035);
      const matrix = new THREE.Matrix4().makeBasis(x.multiplyScalar(spec.wd * size), y.multiplyScalar(spec.ht * size), normal).setPosition(p);
      wall.push({ matrix, spec });
    }
    // The footprint in world axes (for the ground parts in front of the gate).
    const ext = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const bx of [box.min.x, box.max.x]) for (const bz of [box.min.z, box.max.z]) {
      const x = bx * cos + bz * sin, z = -bx * sin + bz * cos;
      ext.minX = Math.min(ext.minX, x); ext.maxX = Math.max(ext.maxX, x); ext.minZ = Math.min(ext.minZ, z); ext.maxZ = Math.max(ext.maxZ, z);
    }
    // Anchor the halo to a real roof emitter, including asymmetric relays.
    let emitter = null;
    if (type === "hq" || type === "relay") {
      const point = new THREE.Vector3();
      template.traverse(part => {
        if (!part.isMesh || !/^(TeamGlow|Energy)/.test(part.material?.name)) return;
        const vertices = part.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
          point.fromBufferAttribute(vertices, i).applyMatrix4(part.matrixWorld);
          if (!emitter || point.y > emitter.y) (emitter ??= new THREE.Vector3()).copy(point);
        }
      });
    }
    template.position.copy(saved[0]); template.quaternion.copy(saved[1]); template.scale.copy(saved[2]);
    template.updateMatrixWorld(true);
    const result = { wall, ext, emitter };
    this.placements.set(key, result);
    return result;
  }
  // Writes one instance: a full matrix, a tint, then cell, mode, phase and value.
  put(i, matrix, tint, cell, mode, phase, value) {
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.instanceColor.setXYZ(i, scratch.c.setHex(tint).r, scratch.c.g, scratch.c.b);
    this.data.setXYZW(i, cell, mode, phase, value);
  }
  // A flat decal on the ground at (x, z), its texture's up pointing along (ox, oz).
  ground(i, x, z, ox, oz, wd, ht, lift, tint, cell, mode, phase, value) {
    const y = (this.view.terrain?.heightAt?.(x, z) ?? 0) + lift;
    // Columns: u axis = (-oz, 0, ox)·wd, v axis = (ox, 0, oz)·ht, normal = up (so u × v = up: front face).
    scratch.m.set(-oz * wd, ox * ht, 0, x, 0, 0, 1, y, ox * wd, oz * ht, 0, z, 0, 0, 0, 1);
    this.put(i, scratch.m, tint, cell, mode, phase, value);
  }
  // The signature of everything static: which buildings are drawn, where, finished or not, in which colour.
  signature(sim) {
    let h = 7, n = 0;
    const colors = this.view.colors || [];
    for (const e of sim.entities) {
      if (e.kind !== "building" || !(e.hp > 0)) continue;
      const o = this.view.objects?.get(e.id);
      const shown = o?.visible ? 1 : 0;
      const m = o?.userData?.model;
      h = Math.imul(h ^ e.id, 16777619) ^ (shown + (e.complete ? 2 : 0) + (this.finishing(e) ? 4 : 0));
      h = Math.imul(h ^ Math.round(e.x * 8), 2246822519) ^ Math.round(e.z * 8);
      h = Math.imul(h ^ ((colors[e.team] ?? 0) | 0), 3266489917) ^ Math.round((m?.scale?.y ?? 1) * 64) ^ Math.round((m?.rotation?.y ?? 0) * 64);
      n++;
    }
    return (h ^ n ^ (this.view.teamTemplates?.size ?? 0)) >>> 0;
  }
  finishing(e) {
    const at = this.finished.get(e.id);
    return at !== undefined && this.clock - at < 1.5;
  }
  rebuild(sim) {
    const view = this.view, colors = view.colors || [];
    this.records.clear();
    let i = POOL, buildings = 0;
    const hqs = sim.entities.filter((e) => e.type === "hq" && e.hp > 0 && e.complete);
    for (const e of sim.entities) {
      if (e.kind !== "building" || !(e.hp > 0)) continue;
      const o = view.objects?.get(e.id);
      if (!o?.visible) continue;
      const model = o.userData?.model;
      const angle = model?.rotation?.y ?? 0, team = colors[e.team] ?? 0xffffff;
      const place = this.placement(e.type, angle, e.team);
      if (!place || i > CAPACITY - 40) continue;
      buildings++;
      const r = e.radius || 2;
      // A building going up (or just finished): only the blueprint grid under it.
      if (!e.complete || this.finishing(e)) {
        const size = r * 2.3 + 1;
        this.ground(i++, e.x, e.z, 0, 1, size, size, 0.05, 0x7fb4d6, CELL.blueprint + GLOW, MODE.blueprint, Math.max(1, Math.round(size / 2)), e.complete ? this.finished.get(e.id) : -1);
        if (!e.complete) continue;
      }
      const rec = { e, bar: [], chase: [], door: [] };
      this.records.set(e.id, rec);
      // Walls: model space -> world (position, the model's turn and scale).
      scratch.b.compose(o.position, scratch.q.setFromAxisAngle(UP, angle), scratch.s.copy(model.scale));
      if (place.emitter) {
        const centre = scratch.v.copy(place.emitter).applyMatrix4(scratch.b);
        scratch.m.makeTranslation(centre.x, centre.y, centre.z);
        this.put(i++, scratch.m, team, CELL.beacon + GLOW, MODE.halo, 0, r * 0.95);
      }
      for (const { matrix, spec } of place.wall) {
        if (spec.role === "bar" && !D[e.type]?.trains?.length) continue;
        scratch.m.multiplyMatrices(scratch.b, matrix);
        const tint = spec.team ? team : spec.color ?? 0xffffff;
        if (spec.role) rec[spec.role].push(i);
        this.put(i++, scratch.m, tint, spec.cell + (spec.glow ? GLOW : 0), spec.m ?? MODE.still, spec.p ?? 0, spec.role === "door" ? -100 : 0);
      }
      // Ground in front of the gate (south, +z).
      const front = e.z + place.ext.maxZ, half = Math.max(1.2, Math.min(2.6, (place.ext.maxX - place.ext.minX) * 0.36));
      const producer = !!D[e.type]?.trains?.length;
      this.ground(i++, e.x, front + 1.5, 0, 1, half * 2, 3, 0.05, 0xffffff, CELL.apron, MODE.still, 0, 0);
      this.ground(i++, e.x, front + 0.7, 0, 1, half * 2 + 0.6, 2.2, 0.07, LIGHT.amber, CELL.pool + GLOW, MODE.night, 0, 0);
      if (producer) {
        for (let c = 0; c < 3; c++) this.ground(i++, e.x, front + 0.75 + c * 0.85, 0, 1, 1.15, 0.7, 0.06, team, CELL.chevron, MODE.still, 0, 0);
        for (const sideX of [-1, 1]) for (let l = 0; l < 4; l++) {
          rec.chase.push(i);
          this.ground(i++, e.x + sideX * (half - 0.3), front + 0.45 + l * 0.75, 0, 1, 0.62, 0.62, 0.065, LIGHT.amber, CELL.runway + GLOW, MODE.chase, (3 - l) * 0.22, 0);
        }
      }
      const faction = TYPE_FACTION[e.type] || factionOf(view.mission, e.team)?.id || "meridian";
      const fx = e.x + half + 1.1, fz = front + 1.4;
      this.ground(i++, fx, fz, 0, 1, 1.8, 1.8, 0.055, 0xffffff, FACTION_CELL[faction] ?? CELL.meridian, faction === "veil" ? MODE.rotate : MODE.still, e.id * 0.7, 0);
      if (faction === "ashfall") for (let k = 0; k < 2; k++) this.ground(i++, fx - 0.4 + k * 0.8, fz + 0.3 - k * 0.5, 0, 1, 0.45, 0.45, 0.065, LIGHT.ember, CELL.ember + GLOW, MODE.blink, k * 0.45 + e.id * 0.13, 0);
      // Energy dashes toward the nearest Command core, in short pieces that follow the ground.
      if (FLOW_FROM.has(e.type)) {
        let hq = null, best = Infinity;
        for (const h of hqs) if (h.team === e.team) { const d = Math.hypot(h.x - e.x, h.z - e.z); if (d < best) { best = d; hq = h; } }
        if (hq && best < 60) {
          const dim = scratch.c.setHex(team).multiplyScalar(0.55).getHex();
          const dx = (hq.x - e.x) / best, dz = (hq.z - e.z) / best, start = r + 0.8, end = best - (hq.radius || 3) - 0.8;
          const pieces = Math.max(0, Math.min(16, Math.ceil((end - start) / 4)));
          const len = pieces ? (end - start) / pieces : 0;
          for (let k = 0; k < pieces && i < CAPACITY - 4; k++) {
            const at = start + (k + 0.5) * len;
            // The u axis runs along the line: up = the side direction, so u points toward the core.
            this.ground(i++, e.x + dx * at, e.z + dz * at, dz, -dx, len, 0.3, 0.06, dim, CELL.dash + GLOW, MODE.scroll, len / 1.6, (k * len) / 1.6);
          }
        }
      }
    }
    this.count = i;
    this.mesh.count = i;
    this.state = { decals: i - POOL, buildings };
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.data.needsUpdate = true;
  }
  update(sim, dt) {
    const view = this.view;
    if (!view?.scene || !sim?.entities) return;
    if (!sim.entities.some((e) => e.kind === "building")) { if (this.mesh) this.mesh.visible = false; return; }
    if (!this.mesh) this.build();
    // Still with reduced motion, combat motion off (Settings) or the governor's motion level 0; Eco keeps the
    // lights moving like the map's own lamps (view.js lifeClock).
    const lively = (view.motionLevel ?? 2) > 0 && !view.reducedMotion?.matches && view.settings?.combatMotion !== false;
    if (lively && dt > 0) this.clock = (this.clock + Math.min(0.05, dt)) % 3600;
    this.uniforms.uTime.value = this.clock;
    this.uniforms.uStill.value = lively ? 0 : 1;
    this.uniforms.uNight.value = nightOf(view.mood?.state);
    this.lively = lively;
    // A building seen finishing gets its blueprint fade (1.5 s of the decal clock).
    for (const e of sim.entities) if (e.kind === "building" && e.complete && !this.finished.has(e.id)) this.finished.set(e.id, this.seenUnfinished?.has(e.id) && lively ? this.clock : -1e6);
    this.seenUnfinished ??= new Set();
    for (const e of sim.entities) if (e.kind === "building" && !e.complete) this.seenUnfinished.add(e.id);
    const hash = this.signature(sim);
    if (hash !== this.hash) { this.hash = hash; this.rebuild(sim); }
    // Production: the light bar fills and the runway lights chase faster toward the end.
    let dirty = false;
    for (const rec of this.records.values()) {
      if (!rec.bar.length && !rec.chase.length) continue;
      const q = rec.e.queue?.[0], d = q && D[q.type];
      const p = d?.time ? Math.min(1, q.elapsed / d.time) : 0;
      const speed = q && !rec.e.levelJob ? 0.8 + 2.2 * p : 0;
      for (const s of rec.bar) if (this.data.getW(s) !== Math.fround(p)) { this.data.setW(s, p); dirty = true; }
      for (const s of rec.chase) if (this.data.getW(s) !== Math.fround(speed)) { this.data.setW(s, speed); dirty = true; }
    }
    // Tracks behind units that just came out.
    if (this.watch.length) {
      let moved = false;
      for (let k = this.watch.length - 1; k >= 0; k--) {
        const t = this.watch[k], u = sim.get?.(t.id);
        if (!u || !(u.hp > 0) || this.clock > t.until || !lively) { this.watch.splice(k, 1); continue; }
        const dx = u.x - t.x, dz = u.z - t.z, step = Math.hypot(dx, dz);
        if (step < (t.heavy ? 1.1 : 0.8)) continue;
        const slot = this.trackNext;
        this.trackNext = (this.trackNext + 1) % TRACKS;
        const sx = (u.x + t.x) / 2, sz = (u.z + t.z) / 2;
        this.ground(slot, sx, sz, dx / step, dz / step, t.heavy ? 1.3 : 0.6, step * 1.05, 0.045, 0xffffff, t.heavy ? CELL.tread : CELL.boots, MODE.track, 0, this.clock);
        t.x = u.x; t.z = u.z;
        moved = true;
      }
      if (moved) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; dirty = true; }
    }
    if (dirty) this.data.needsUpdate = true;
    this.mesh.visible = this.mesh.count > POOL || this.watch.length > 0;
  }
  // A unit came out (economy.js spawn event): the door flashes, dust puffs, tracks start.
  event(ev, sim) {
    if (ev.type !== "spawn" || !this.mesh || !this.lively) return;
    let rec = null;
    for (const r of this.records.values()) {
      const b = r.e;
      if (b.team === ev.team && D[b.type]?.trains?.length && Math.hypot(b.x - ev.x, b.z - ev.z) <= (b.radius || 2) + 7) { rec = r; break; }
    }
    if (!rec) return;
    for (const s of rec.door) this.data.setW(s, this.clock);
    const slot = TRACKS + this.dustNext;
    this.dustNext = (this.dustNext + 1) % DUSTS;
    this.ground(slot, ev.x, ev.z, 0, 1, 2.2, 2.2, 0.09, 0xffffff, CELL.dust, MODE.dust, 0, this.clock);
    const u = sim?.get?.(ev.seed);
    if (u && this.watch.length < 24) this.watch.push({ id: u.id, x: u.x, z: u.z, heavy: (u.radius || 0.5) > 0.8, until: this.clock + 4 });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.data.needsUpdate = true;
  }
  reset() {
    if (this.mesh) {
      this.view.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.uniforms.uAtlas.value.dispose();
      this.mesh.dispose?.();
      this.mesh = null;
    }
    this.placements.clear();
    this.records.clear();
    this.finished.clear();
    this.seenUnfinished = null;
    this.watch.length = 0;
    this.hash = 0;
    this.clock = 0;
  }
}
