import * as THREE from "three";
import { CELL, DIGITS, GRID } from "./building-decals-atlas.js";
import { DEFINITIONS as D } from "./data.js";

// H5 team emblems and unit numbers (a view plugin, docs/VIEW_PLUGINS.md). In Hero mode only, every unit drawing its
// close-up detail model (close-view.js) wears its team's emblem, a hull stripe and a two-digit number on both flanks,
// all cut from the building decals' atlas (building-decals-atlas.js: emblem, stripe, digits) in ONE instanced draw that
// casts and receives no shadow. The flank points come from rays cast at each type's detail template once; every frame
// only the near units' matrices are rewritten (at most CAPACITY quads, no allocation). The normal RTS view draws
// nothing: the mesh is built on the first Hero frame and hidden outside it.
export const UNIT_DECALS = Object.freeze({ units: 24, perSide: 4 });
// Creatures and bosses wear no army markings.
const BARE = new Set(["acidhound", "wyrmling", "wyrm", "vaultsentinel", "emberdrake"]);
const CAPACITY = UNIT_DECALS.units * 2 * UNIT_DECALS.perSide;

const VERTEX = /* glsl */ `
attribute vec4 aData; // cell, digit (-1: the whole cell), unused, unused
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
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vData;
varying vec3 vTint;
#include <common>
#include <fog_pars_fragment>
void main() {
  float cell = vData.x, digit = vData.y;
  vec2 uv = clamp(vUv, 0.03, 0.97);
  if (digit >= 0.0) uv = (vec2(mod(digit, ${DIGITS.cols}.0), ${DIGITS.rows - 1}.0 - floor(digit / ${DIGITS.cols}.0)) + clamp(vUv, 0.04, 0.96)) / vec2(${DIGITS.cols}.0, ${DIGITS.rows}.0);
  vec2 cuv = (vec2(mod(cell, ${GRID.cols}.0), ${GRID.rows - 1}.0 - floor(cell / ${GRID.cols}.0)) + uv) / vec2(${GRID.cols}.0, ${GRID.rows}.0);
  vec4 tex = texture2D(uAtlas, cuv);
  if (tex.a < 0.02) discard;
  vec3 col = tex.rgb * vTint;
  #ifdef USE_FOG
    col = mix(col, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  gl_FragColor = vec4(col * tex.a, tex.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The two-digit number a unit wears: stable per entity (its id), 01..99.
export function unitNumber(id) {
  const n = ((Math.abs(id | 0) - 1) % 99) + 1;
  return [Math.floor(n / 10), n % 10];
}

const M = new THREE.Matrix4(), C = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class UnitDecalsView {
  constructor(view) {
    this.view = view;
    view.unitDecals = this; // H5: tests and probes reach the plugin here (class names are minified in a build)
    this.mesh = null;
    this.spots = new Map(); // type -> [{ matrix, cell, digit }] in model space (null while its detail template is missing)
    this.state = { units: 0, quads: 0 }; // read by tests and probes
  }
  build() {
    const material = new THREE.ShaderMaterial({
      name: "UnitDecals",
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null } }]),
      vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, CAPACITY);
    mesh.name = "UnitDecals";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute("aData", this.data);
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.count = 0;
    mesh.visible = false;
    this.mesh = mesh;
    this.view.scene.add(mesh);
  }
  // The decal quads of a type on its detail model: on each flank at about 60% of its height, emblem, stripe, number.
  spotsFor(type, team) {
    if (this.spots.has(type)) return this.spots.get(type);
    if (BARE.has(type) || D[type]?.boss) { this.spots.set(type, []); return []; }
    const template = this.view.detailTemplates?.get(`${type}-${team}`);
    if (!template) return null;
    template.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(template), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const ray = new THREE.Raycaster(), list = [];
    ray.layers.enableAll();
    const scale = Math.max(0.55, Math.min(1.6, size.y / 2.2));
    for (const side of [1, -1]) {
      // Infantry (taller than long): the shoulder; vehicles: the hull side, below the turret.
      const tall = size.y > Math.max(size.x, size.z) * 1.15;
      const origin = new THREE.Vector3(centre.x + side * (size.x + 2), box.min.y + size.y * (tall ? 0.62 : 0.36), centre.z);
      ray.set(origin, new THREE.Vector3(-side, 0, 0));
      ray.far = size.x + 4;
      const hit = ray.intersectObject(template, true).find((h) => h.face && h.object.isMesh);
      if (!hit) continue;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (normal.x * side < 0.2) normal.set(side, 0, 0);
      normal.y = 0; normal.normalize();
      // The quad's u runs toward the back on the right flank and toward the back on the left too (text reads front to back).
      const along = new THREE.Vector3(0, 0, -1).projectOnPlane(normal).normalize().multiplyScalar(side);
      const up = new THREE.Vector3().crossVectors(normal, along).normalize();
      const at = hit.point.clone().addScaledVector(normal, 0.03);
      const quad = (du, dv, w, h, cell, digit = -1) => list.push({ matrix: new THREE.Matrix4().makeBasis(along.clone().multiplyScalar(w * scale), up.clone().multiplyScalar(h * scale), normal)
        .setPosition(at.clone().addScaledVector(along, du * scale).addScaledVector(up, dv * scale)), cell, digit });
      quad(-0.16, 0, 0.3, 0.32, CELL.emblem);
      quad(0.08, 0.1, 0.12, 0.17, CELL.digits, 0); // tens (set per unit)
      quad(0.19, 0.1, 0.12, 0.17, CELL.digits, 1); // units
      quad(0.13, -0.08, 0.3, 0.12, CELL.stripe);
    }
    this.spots.set(type, list);
    return list;
  }
  update() {
    const v = this.view, close = v.closeView;
    const on = !!(v.heroCameraOn && close?.on && close.shown.size);
    if (!on) { if (this.mesh) this.mesh.visible = false; this.state.units = this.state.quads = 0; return; }
    const atlas = v.decalAtlas?.uAtlas?.value;
    if (!atlas) return; // the building decals build the atlas with the first building
    if (!this.mesh) this.build();
    this.mesh.material.uniforms.uAtlas.value = atlas;
    let n = 0, units = 0;
    for (const root of close.shown) {
      if (units >= UNIT_DECALS.units) break;
      const u = root.userData, model = u.model;
      if (!root.visible || !model || !u.lod?.detail?.visible) continue;
      const spots = this.spotsFor(u.type, u.team);
      if (!spots?.length) continue;
      model.updateWorldMatrix(true, false);
      const [tens, ones] = unitNumber(u.id ?? 0);
      C.setHex(v.colors?.[u.team] ?? 0xffffff);
      for (const s of spots) {
        M.multiplyMatrices(model.matrixWorld, s.matrix);
        this.mesh.setMatrixAt(n, M);
        const team = s.cell !== CELL.digits;
        this.mesh.instanceColor.setXYZ(n, team ? C.r : 1, team ? C.g : 1, team ? C.b : 1);
        this.data.setXYZW(n, s.cell, s.digit < 0 ? -1 : s.digit === 0 ? tens : ones, 0, 0);
        n++;
      }
      units++;
    }
    for (let i = n; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) {
      for (const a of [this.mesh.instanceMatrix, this.mesh.instanceColor, this.data]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
    }
    this.state.units = units; this.state.quads = n;
  }
  reset() {
    if (this.mesh) {
      this.view.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    this.spots.clear();
    this.state.units = this.state.quads = 0;
  }
}
