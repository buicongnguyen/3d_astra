import * as THREE from "three";

// Capture points of a story mission: one flat ring per point. Grey while neutral, the owner's
// army colour when owned; while a side is taking it the ring pulses and an inner arc fills
// over the five seconds the capture needs. One quad and one small shader per point; the frame
// update only writes uniforms.
export const CAPTURE_SECONDS = 5;
const NEUTRAL = 0x9aa5a8;
const VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAGMENT = `
uniform vec3 uColor; uniform vec3 uTaker; uniform float uProgress; uniform float uPulse; uniform float uOwned;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p), aa = fwidth(r) * 1.5;
  float band = smoothstep(0.88 - aa, 0.88 + aa, r) * (1.0 - smoothstep(0.98 - aa, 0.98 + aa, r));
  float fill = (1.0 - smoothstep(0.88 - aa, 0.88 + aa, r)) * (0.05 + 0.09 * uOwned);
  float turn = (atan(p.x, p.y) + 3.14159265) / 6.2831853;
  float lane = smoothstep(0.70 - aa, 0.70 + aa, r) * (1.0 - smoothstep(0.82 - aa, 0.82 + aa, r));
  float taking = step(0.0001, uProgress);
  float arc = lane * step(turn, uProgress) * taking;
  float track = lane * 0.2 * taking;
  vec3 colour = mix(uColor, uTaker, clamp(arc + track * 2.0, 0.0, 1.0));
  float alpha = band * (0.7 + 0.3 * uPulse) + fill * (1.0 + 1.5 * uPulse) + arc * 0.95 + track;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(colour, min(alpha, 1.0));
  #include <colorspace_fragment>
}`;

export class CaptureRings {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.rings = new Map();
    this.source = null;
  }
  clear() {
    for (const ring of this.rings.values()) { this.scene.remove(ring); ring.material.dispose(); }
    this.rings.clear();
    this.source = null;
  }
  build(points) {
    this.clear();
    this.source = points;
    for (const [name, p] of Object.entries(points)) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(NEUTRAL) }, uTaker: { value: new THREE.Color(NEUTRAL) }, uProgress: { value: 0 }, uPulse: { value: 0 }, uOwned: { value: 0 } },
        vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
      });
      const ring = new THREE.Mesh(this.geometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.1, p.z);
      ring.scale.setScalar(p.r);
      ring.renderOrder = 3;
      ring.userData.owner = undefined;
      ring.userData.taker = undefined;
      this.scene.add(ring);
      this.rings.set(name, ring);
    }
  }
  // `colors` are the army colours by team (hex numbers); `still` turns the pulse off for Eco
  // graphics and reduced motion.
  update(sim, colors, still) {
    const points = sim.mission?.points;
    if (!points || !Object.keys(points).length) { if (this.rings.size) this.clear(); return; }
    if (points !== this.source) this.build(points);
    for (const [name, ring] of this.rings) {
      const p = points[name], u = ring.material.uniforms;
      if (!p) continue;
      if (ring.userData.owner !== p.owner || ring.userData.palette !== colors) {
        ring.userData.owner = p.owner;
        u.uColor.value.setHex(p.owner === null || p.owner === undefined ? NEUTRAL : colors[p.owner] ?? NEUTRAL);
        u.uOwned.value = p.owner === null || p.owner === undefined ? 0 : 1;
      }
      if (ring.userData.taker !== p.taker || ring.userData.palette !== colors) {
        ring.userData.taker = p.taker;
        if (p.taker !== null && p.taker !== undefined) u.uTaker.value.setHex(colors[p.taker] ?? NEUTRAL);
      }
      ring.userData.palette = colors;
      const taking = p.taker !== null && p.taker !== undefined;
      u.uProgress.value = taking ? Math.min(1, Math.max(0.02, p.since / CAPTURE_SECONDS)) : 0;
      u.uPulse.value = taking && !still ? 0.5 + 0.5 * Math.sin(sim.time * 7) : 0;
    }
  }
}
