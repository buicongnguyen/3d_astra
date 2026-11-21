// Night and storm sky pieces (AAA round 3, R3-D), one draw each, built only when a look asks for them:
//   moon    a disc with a soft halo, fixed on the screen like a far sky (drawn just after the map edge with
//           no depth test, so the battlefield covers it and it shows only over the void)
//   stars   points scattered over the void around the map (depth tested, so the cliffs hide them)
//   rain    slanting streaks in a box that wraps around the camera's focus, animated on the GPU
//   clouds  a screen-wide drifting cloud shade (High only: a full-screen blended pass is too dear on phones)
// Every animation reads one time uniform; motion-off (reduced motion or the motion setting at 0) freezes it.
// View only: nothing here reads or writes the simulation's state beyond sim.time.
import * as THREE from "three";
import { mulberry32 } from "./rng.js";
import { CLIFF } from "./map-edge.js";

export const SKY_ORDER = { edge: -2, moon: -1, rain: 6, clouds: 8 };
// How many pieces each look adds (the draw budget: at most 6 over the day scene; tests/night-sky.test.js).
export const piecesFor = (def, lowPower = false) => (def ? ["moon", "stars", "rain", "clouds"].filter((p) => def[p] && !(p === "clouds" && lowPower)) : []);

// Star positions on the void: a square ring from `inner` beyond the map edge out to `outer`, seeded.
export function starField(half, count, seed = 38) {
  const rnd = mulberry32(seed), p = new Float32Array(count * 3), size = new Float32Array(count), inner = half + 3, outer = half + 70;
  for (let i = 0; i < count; i++) {
    let x, z;
    do { x = (rnd() * 2 - 1) * outer; z = (rnd() * 2 - 1) * outer; } while (Math.max(Math.abs(x), Math.abs(z)) < inner);
    p[i * 3] = x; p[i * 3 + 1] = -CLIFF + 0.05; p[i * 3 + 2] = z;
    size[i] = rnd() < 0.08 ? 1 : rnd() * 0.6;
  }
  return { positions: p, size };
}

const MOON_VS = `varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const MOON_FS = `uniform vec3 uColor; uniform float uK;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float disc = 1.0 - smoothstep(0.30, 0.32, r);
  // two soft maria so the disc reads as a moon, not a lamp
  float maria = 0.12 * (1.0 - smoothstep(0.0, 0.1, length(vUv - vec2(-0.08, 0.06)))) + 0.08 * (1.0 - smoothstep(0.0, 0.07, length(vUv - vec2(0.1, -0.08))));
  float halo = 0.34 * pow(max(0.0, 1.0 - r), 2.4);
  vec3 c = uColor * disc * (1.0 - maria) + vec3(0.35, 0.5, 0.95) * halo;
  gl_FragColor = vec4(c * uK, 1.0);
}`;
const STAR_VS = `attribute float size; uniform float uTime; uniform float uScale; varying float vB;
void main() {
  vB = 0.45 + 0.55 * size;
  vB *= 0.75 + 0.25 * sin(uTime * (1.3 + size * 2.0) + position.x * 0.37 + position.z * 0.53);
  gl_PointSize = uScale * (1.6 + size * 2.6);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const STAR_FS = `uniform float uK; varying float vB;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.15, 0.5, d);
  gl_FragColor = vec4(vec3(0.78, 0.86, 1.0) * a * vB * uK, 1.0);
}`;
const RAIN_VS = `attribute vec4 seed; attribute float tip;
uniform float uTime; uniform vec3 uFocus; uniform float uSpan; uniform float uHeight;
varying float vTip;
void main() {
  float span = 2.0 * uSpan;
  float x = uFocus.x + mod(seed.x * span - uFocus.x, span) - uSpan;
  float z = uFocus.z + mod(seed.y * span - uFocus.z, span) - uSpan;
  float y = mod(seed.z * uHeight - uTime * (22.0 + 8.0 * seed.w), uHeight);
  float len = 0.7 + 0.6 * seed.w;
  vec3 p = vec3(x + tip * len * 0.28, y + tip * len, z + tip * len * 0.12);
  vTip = tip;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const RAIN_FS = `uniform float uK; varying float vTip;
void main() { gl_FragColor = vec4(0.76, 0.85, 1.0, uK * (0.22 + 0.4 * vTip)); }`;
const CLOUD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const CLOUD_FS = `uniform float uTime; uniform float uK; uniform vec2 uAspect; uniform vec2 uDrift; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv * uAspect * 2.2 + uDrift + uTime * vec2(0.035, 0.012);
  float c = 0.65 * n(p) + 0.35 * n(p * 2.3 + 7.0);
  vec2 e = vUv - 0.5;
  float edge = smoothstep(0.25, 0.75, length(e * vec2(1.0, 1.25)));
  float a = uK * (0.10 + 0.26 * smoothstep(0.42, 0.82, c) + 0.22 * edge);
  gl_FragColor = vec4(0.03, 0.06, 0.09, a);
}`;

export class NightSky {
  constructor(view) {
    this.view = view;
    this.root = new THREE.Group();
    this.root.name = "night-sky";
    this.pieces = {};
    this.time = 0;
    this.last = null;
    view.scene.add(this.root);
  }
  // The meshes this sky draws now (tests and the render budget read the names).
  get shown() { return Object.entries(this.pieces).filter(([, m]) => m.visible).map(([k]) => k); }
  build(name) {
    const v = this.view, half = v.terrain.half;
    let mesh;
    if (name === "moon") {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color("#fff3d8") }, uK: { value: 1 } }, vertexShader: MOON_VS, fragmentShader: MOON_FS,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
      }));
      mesh.renderOrder = SKY_ORDER.moon;
    } else if (name === "stars") {
      const { positions, size } = starField(half, v.lowPower ? 700 : 1200), g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("size", new THREE.BufferAttribute(size, 1));
      mesh = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uScale: { value: Math.min(2, v.renderer.getPixelRatio?.() || 1) } },
        vertexShader: STAR_VS, fragmentShader: STAR_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false,
      }));
    } else if (name === "rain") {
      const n = v.lowPower ? 600 : 1300, rnd = mulberry32(606), seed = new Float32Array(n * 8), tip = new Float32Array(n * 2), g = new THREE.BufferGeometry();
      for (let i = 0; i < n; i++) {
        const s = [rnd(), rnd(), rnd(), rnd()];
        seed.set(s, i * 8); seed.set(s, i * 8 + 4); tip[i * 2 + 1] = 1;
      }
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
      g.setAttribute("tip", new THREE.BufferAttribute(tip, 1));
      mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uFocus: { value: new THREE.Vector3() }, uSpan: { value: 40 }, uHeight: { value: 26 } },
        vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, toneMapped: false,
      }));
      mesh.renderOrder = SKY_ORDER.rain;
    } else if (name === "clouds") {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uAspect: { value: new THREE.Vector2(1, 1) }, uDrift: { value: new THREE.Vector2() } },
        vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      }));
      mesh.renderOrder = SKY_ORDER.clouds;
    }
    mesh.name = `sky-${name}`;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = name === "moon";
    this.root.add(mesh);
    return (this.pieces[name] = mesh);
  }
  // def: the look's table entry (or null), k: its strength, t: sim.time, calm: motion off.
  update(def, k, t, calm) {
    const v = this.view, want = new Set(k > 0 ? piecesFor(def, v.lowPower) : []);
    // The time the sky animates by: sim.time, held still while motion is off.
    if (!calm) this.time = t;
    for (const name of Object.keys(this.pieces)) if (!want.has(name)) this.pieces[name].visible = false;
    if (!want.size) return;
    // The moon must come after the map edge (its depth test is off): the edge draws first.
    const edge = v.terrainRoot?.getObjectByName("backdrop");
    if (edge) edge.renderOrder = SKY_ORDER.edge;
    for (const name of want) {
      const mesh = this.pieces[name] || this.build(name), u = mesh.material.uniforms;
      mesh.visible = true;
      if (u.uTime) u.uTime.value = this.time;
      const strength = name === "rain" ? k * (def.rain ?? 1) : name === "clouds" ? k * (def.clouds ?? 1) : k;
      u.uK.value = strength;
    }
    const cam = v.camera;
    if (this.pieces.moon?.visible) {
      // Upper left of the screen (over the void beside a south-west start), far behind the focus (inside the far plane); a fixed size on screen.
      const m = this.pieces.moon, zoom = cam.top - cam.bottom, size = zoom * 0.11;
      m.position.copy(cam.position);
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), back = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2);
      m.position.addScaledVector(right, cam.left * 0.6).addScaledVector(up, cam.top * 0.66).addScaledVector(back, -Math.min(cam.far - 5, 200));
      m.quaternion.copy(cam.quaternion);
      m.scale.setScalar(size);
    }
    if (this.pieces.rain?.visible) {
      const u = this.pieces.rain.material.uniforms;
      u.uFocus.value.copy(v.focus);
      u.uSpan.value = Math.max(30, (cam.right - cam.left) * 0.75);
    }
    if (this.pieces.clouds?.visible) {
      const u = this.pieces.clouds.material.uniforms, w = Math.max(1, v.width || 1), h = Math.max(1, v.height || 1);
      u.uAspect.value.set(w / Math.max(w, h), h / Math.max(w, h));
      // The cloud pattern drifts with the camera too, so it sits on the land rather than the screen.
      u.uDrift.value.set(v.focus.x * 0.02, -v.focus.z * 0.02);
    }
  }
  dispose() {
    for (const m of Object.values(this.pieces)) { m.geometry.dispose(); m.material.dispose(); }
    this.root.removeFromParent();
    this.pieces = {};
  }
}
