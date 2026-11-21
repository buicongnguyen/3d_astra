// Shells, lobbed artillery rounds, flak rounds, missiles and bombs in flight (AAA round 3, R3-X): one small
// finned ovoid, every one of them drawn by ONE InstancedMesh. 52 triangles, no texture, no shadow, hidden
// while nothing flies (a quiet battlefield draws nothing extra). The per-instance colour sets the look: above
// 1 a shell glows hot (tank shells, missiles), around 0.3 it is dark iron (bombs). The flights themselves
// (arc, weave, fall, trails, landing) live in src/fx.js and src/fx-kinds/ordnance.js.
import * as THREE from "three";

// Local frame: +Z is the nose. Length 1 m before scaling, 0.26 m thick. Per vertex: `paint` (the body, a
// copper driving band, a darker tail) and `rim` (1 on the nose: it catches a brighter light, so the round
// reads as a solid shape on dark ground).
const BODY = [0.86, 0.82, 0.74], BAND = [1, 0.78, 0.46], TAIL = [0.55, 0.52, 0.48], FIN = [0.5, 0.47, 0.43];
export const SEGMENTS = 6;
export function ordnanceGeometry() {
  const pos = [], col = [], rim = [];
  const tri = (a, b, c, ca, cb = ca, cc = ca, r = 0) => { pos.push(...a, ...b, ...c); col.push(...ca, ...cb, ...cc); rim.push(r, r, r); };
  // Rings from the tail to the nose: [z, radius, colour, rim].
  const rings = [[-0.46, 0.09, TAIL, 0], [-0.3, 0.13, BODY, 0], [0.1, 0.13, BAND, 0], [0.3, 0.1, BODY, 0.5]];
  const at = (z, r, i) => { const a = (i / SEGMENTS) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, z]; };
  for (let k = 0; k + 1 < rings.length; k++) {
    const [z0, r0, c0, h0] = rings[k], [z1, r1, c1, h1] = rings[k + 1];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = at(z0, r0, i), b = at(z0, r0, i + 1), c = at(z1, r1, i + 1), d = at(z1, r1, i);
      tri(a, b, c, c0, c0, c1, (h0 + h1) / 2); tri(a, c, d, c0, c1, c1, (h0 + h1) / 2);
    }
  }
  // The ogive nose and the flat base.
  const [zn, rn] = rings[rings.length - 1], [zt, rt] = rings[0];
  for (let i = 0; i < SEGMENTS; i++) {
    tri(at(zn, rn, i), at(zn, rn, i + 1), [0, 0, 0.54], BODY, BODY, BODY, 1);
    tri(at(zt, rt, i + 1), at(zt, rt, i), [0, 0, zt], TAIL);
  }
  // Four small tail fins (the material is double sided): a bomb's tail, a dart's flights.
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) tri([0, 0, -0.18], [x * 0.24, y * 0.24, -0.5], [0, 0, -0.5], FIN);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("paint", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("rim", new THREE.Float32BufferAttribute(rim, 1));
  g.computeVertexNormals();
  return g;
}

const VERTEX = `
attribute vec3 paint; attribute float rim;
varying vec3 vColor; varying float vShade;
void main() {
  vec3 c = paint;
#ifdef USE_INSTANCING_COLOR
  c *= instanceColor;
#endif
  vColor = c;
  vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  // A fixed warm key light from above and the camera side, wrapped so the underside is never black; the nose rim brighter.
  vShade = 0.6 + 0.4 * max(0.0, dot(n, normalize(vec3(0.35, 0.85, 0.4)))) + 0.25 * rim;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAGMENT = `
uniform float uLight;
varying vec3 vColor; varying float vShade;
void main() { gl_FragColor = vec4(vColor * vShade * uLight, 1.0); }`;

const UP = new THREE.Vector3(0, 0, 1), DIR = new THREE.Vector3(), Q = new THREE.Quaternion(), ROLL = new THREE.Quaternion(), POS = new THREE.Vector3(), SCALE = new THREE.Vector3(), M = new THREE.Matrix4(), C = new THREE.Color();

export class OrdnanceBodies {
  constructor(capacity = 64) {
    this.capacity = capacity;
    this.material = new THREE.ShaderMaterial({ uniforms: { uLight: { value: 1 } }, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(ordnanceGeometry(), this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, C.setRGB(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.name = "ordnance-bodies";
    this.drawn = 0;
  }
  get triangles() { return this.mesh.geometry.attributes.position.count / 3; }
  begin(light) { this.drawn = 0; this.material.uniforms.uLight.value = light; }
  // One round at (x, y, z), nose along (dx, dy, dz) (any length), rolled `roll` radians, `length` metres long,
  // coloured `color` (an [r, g, b] array; above 1 glows).
  add(x, y, z, dx, dy, dz, roll, length, color) {
    if (this.drawn >= this.capacity) return;
    const l = Math.hypot(dx, dy, dz) || 1;
    Q.setFromUnitVectors(UP, DIR.set(dx / l, dy / l, dz / l));
    Q.multiply(ROLL.setFromAxisAngle(UP, roll));
    M.compose(POS.set(x, y, z), Q, SCALE.setScalar(length));
    this.mesh.setMatrixAt(this.drawn, M);
    this.mesh.setColorAt(this.drawn, C.setRGB(color[0], color[1], color[2]));
    this.drawn++;
  }
  // `moved` false (a still frame: dt 0) keeps the buffers already sent when the count is unchanged.
  end(moved = true) {
    const n = this.drawn, mesh = this.mesh;
    mesh.visible = n > 0;
    if (!n && !mesh.count) return;
    if (!moved && n === mesh.count) return;
    mesh.count = n;
    if (n) {
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16); mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, n * 3); mesh.instanceColor.needsUpdate = true;
    }
  }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
