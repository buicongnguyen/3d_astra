// The visible rocket of the Anti-tank soldier (and the Hawk's pod rockets): a finned body with a hot
// orange-white tail flame, every rocket in flight drawn by ONE InstancedMesh (AAA round 3, R3-W).
// 26 triangles, no texture, no shadow (it is too small and fast to need one), hidden when no rocket flies,
// so a quiet battlefield draws nothing extra. The flight itself (arc, spin, trail, impact) lives in
// src/fx.js and src/fx-kinds/rocket.js; this file is only the mesh and the per-instance matrix.
import * as THREE from "three";

// Local frame: +Z is the nose, the flame trails along -Z; body 1.1 m long and 0.22 m thick (SIZE 1.2), flame 0.75 m.
// Per vertex: colour, `hot` (1 = self-lit flame: no shading, flickers) and `tint` (1 = the faction band).
const BODY = [0.66, 0.62, 0.44], BAND = [1, 1, 1], NOSE = [0.95, 0.4, 0.16], FIN = [0.36, 0.32, 0.26], FLAME_IN = [1, 0.97, 0.85], FLAME_OUT = [1, 0.55, 0.12];
export const SIZE = 1.2;
export function rocketGeometry() {
  const pos = [], col = [], hot = [], tint = [];
  const tri = (a, b, c, ca, cb = ca, cc = ca, h = 0, t = 0) => {
    pos.push(...a, ...b, ...c); col.push(...ca, ...cb, ...cc); hot.push(h, h, h); tint.push(t, t, t);
  };
  const r = 0.09, z0 = -0.42, zb = 0.05, z1 = 0.18, zn = 0.5;
  // A square body seen as a diamond (corners up, down and to the sides), from the tail to the band.
  const ring = (z) => [[0, r, z], [r, 0, z], [0, -r, z], [-r, 0, z]];
  const tail = ring(z0), mid = ring(zb), head = ring(z1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tri(tail[i], tail[j], mid[j], BODY); tri(tail[i], mid[j], mid[i], BODY);
    tri(mid[i], mid[j], head[j], BAND, BAND, BAND, 0, 1); tri(mid[i], head[j], head[i], BAND, BAND, BAND, 0, 1);
    tri(head[i], head[j], [0, 0, zn], NOSE); // the warhead cone
  }
  // Two crossed fins at the tail (the material is double sided).
  tri([0, 0, z0 + 0.2], [0, 0.24, z0 - 0.02], [0, 0, z0 - 0.02], FIN);
  tri([0, 0, z0 + 0.2], [0, -0.24, z0 - 0.02], [0, 0, z0 - 0.02], FIN);
  tri([0, 0, z0 + 0.2], [0.24, 0, z0 - 0.02], [0, 0, z0 - 0.02], FIN);
  tri([0, 0, z0 + 0.2], [-0.24, 0, z0 - 0.02], [0, 0, z0 - 0.02], FIN);
  // The tail flame: a crossed pair of bright blades, white at the nozzle, orange at the tip (z -1.05).
  tri([0, 0.12, z0], [0, -0.12, z0], [0, 0, -1.05], FLAME_IN, FLAME_IN, FLAME_OUT, 1);
  tri([0.12, 0, z0], [-0.12, 0, z0], [0, 0, -1.05], FLAME_IN, FLAME_IN, FLAME_OUT, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("paint", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("hot", new THREE.Float32BufferAttribute(hot, 1));
  g.setAttribute("tint", new THREE.Float32BufferAttribute(tint, 1));
  g.scale(SIZE, SIZE, SIZE);
  g.computeVertexNormals();
  return g;
}

const VERTEX = `
attribute vec3 paint; attribute float hot; attribute float tint;
uniform float uTime;
varying vec3 vColor; varying float vHot; varying float vShade;
void main() {
  vec3 p = position;
  // The flame flickers per rocket (its length breathes), the body stays rigid.
  float id = float(gl_InstanceID);
  if (hot > 0.5 && p.z < -0.5) p.z = -0.42 + (p.z + 0.42) * (0.78 + 0.28 * sin(uTime * 47.0 + id * 2.1) + 0.12 * sin(uTime * 83.0 + id));
  vec3 c = paint;
#ifdef USE_INSTANCING_COLOR
  c = mix(c, instanceColor, tint);
#endif
  vColor = c; vHot = hot;
  vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  // A fixed warm key light from above and the camera side, wrapped so the underside is never black.
  vShade = 0.62 + 0.38 * max(0.0, dot(n, normalize(vec3(0.35, 0.85, 0.4))));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
}`;
const FRAGMENT = `
uniform float uLight;
varying vec3 vColor; varying float vHot; varying float vShade;
void main() {
  vec3 lit = vColor * vShade * uLight;
  gl_FragColor = vec4(mix(lit, vColor * 0.4, vHot), 1.0);
}`;

const UP = new THREE.Vector3(0, 0, 1), DIR = new THREE.Vector3(), Q = new THREE.Quaternion(), ROLL = new THREE.Quaternion(), POS = new THREE.Vector3(), SCALE = new THREE.Vector3(), M = new THREE.Matrix4(), C = new THREE.Color();

export class RocketBodies {
  constructor(capacity = 48) {
    this.capacity = capacity;
    this.material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uLight: { value: 1 } }, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(rocketGeometry(), this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, C.setRGB(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.name = "rocket-bodies";
    this.drawn = 0;
  }
  get triangles() { return this.mesh.geometry.attributes.position.count / 3; }
  begin(time, light) { this.drawn = 0; this.material.uniforms.uTime.value = time; this.material.uniforms.uLight.value = light; }
  // One rocket at (x, y, z), nose along (dx, dy, dz) (any length), rolled `roll` radians, `scale` times its size.
  add(x, y, z, dx, dy, dz, roll, scale, color) {
    if (this.drawn >= this.capacity) return;
    const l = Math.hypot(dx, dy, dz) || 1;
    Q.setFromUnitVectors(UP, DIR.set(dx / l, dy / l, dz / l));
    Q.multiply(ROLL.setFromAxisAngle(UP, roll));
    M.compose(POS.set(x, y, z), Q, SCALE.setScalar(scale));
    this.mesh.setMatrixAt(this.drawn, M);
    this.mesh.setColorAt(this.drawn, color ? C.setRGB(color[0], color[1], color[2]) : C.setRGB(1, 1, 1));
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
