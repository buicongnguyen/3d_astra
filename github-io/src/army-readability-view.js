import * as THREE from "three";

// Readable armies at strategic zoom (AAA round 2, W1-D, idea P3), a view plugin (docs/VIEW_PLUGINS.md).
// A phone shows a tank on Three Roads (zoom 92) about 7 to 10 px tall. From zoom 40 a unit's model
// grows by a view-only factor that reaches 1.6 at zoom 90 and above, so a column stays a column of
// shapes instead of dots. Units only: buildings and bosses keep their size (bosses are W2-F's).
// The simulation is never touched: collision radii, pathing, ranges and picking by the sim do not
// change, and a unit under 40 zoom is drawn exactly as before (the factor is not returned at all).
export const ARMY_SCALE = { from: 40, to: 90, max: 1.6 };

// 1 up to `from`, then linear up to `max` at `to`, and `max` beyond it.
export function armyScale(zoom, { from, to, max } = ARMY_SCALE) {
  if (!(zoom > from)) return 1;
  return 1 + (max - 1) * Math.min(1, (zoom - from) / (to - from));
}

// AAA round 3 (R3-K): the gold trim of a Frontier Defence Combined squad (`e.combined`, R3-C). Each
// squad tank stands on a crisp gold ring with eight bright notches and a soft warm glow that breathes
// (steady with reduced motion or combat motion off). One instanced flat quad: 1 draw call while a
// Combined tank is on screen, nothing built in a match without one. Positions upload only when a ring
// moved; the breathing is a uniform, so a still frame sends no buffer.
export const GOLD = { capacity: 24, radius: 2.45, pulse: 2.2 };
const GOLD_VERTEX = `
attribute vec4 iPlace;
varying vec2 vUv;
void main() {
  vUv = position.xy * 2.0;
  vec3 p = vec3(iPlace.x + position.x * 2.0 * iPlace.w, iPlace.y, iPlace.z - position.y * 2.0 * iPlace.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const GOLD_FRAGMENT = `
uniform float uPulse;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float band = smoothstep(0.60, 0.64, d) * (1.0 - smoothstep(0.74, 0.78, d));
  float notch = step(0.9, abs(cos(atan(vUv.y, vUv.x) * 4.0))) * smoothstep(0.56, 0.60, d) * (1.0 - smoothstep(0.84, 0.88, d));
  float glow = exp(-pow((d - 0.72) * 3.6, 2.0)) * (0.38 + 0.26 * uPulse);
  vec3 gold = mix(vec3(1.0, 0.66, 0.08), vec3(1.0, 0.9, 0.42), band * 0.5 + notch * 0.8);
  float alpha = max(max(band, notch), glow) * (1.0 - smoothstep(0.94, 1.0, d));
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(gold, alpha);
}`;

export class ArmyReadabilityView {
  constructor(view) { this.view = view; this.gold = null; this.goldCount = 0; this.clock = 0; }
  // Runs for every visible entity every frame: an early return, no allocation.
  frameScaleFor(e, u, view) {
    if (e.kind !== "unit" || e.boss) return undefined;
    const k = armyScale(view.zoom);
    return k === 1 ? undefined : k;
  }

  buildGold() {
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    this.goldPlace = new THREE.InstancedBufferAttribute(new Float32Array(GOLD.capacity * 4), 4);
    this.goldPlace.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("iPlace", this.goldPlace);
    g.instanceCount = 0;
    this.goldMaterial = new THREE.ShaderMaterial({ uniforms: { uPulse: { value: 0.5 } }, vertexShader: GOLD_VERTEX, fragmentShader: GOLD_FRAGMENT,
      transparent: true, depthWrite: false });
    this.gold = new THREE.Mesh(g, this.goldMaterial);
    this.gold.frustumCulled = false;
    this.gold.renderOrder = 3;
    this.gold.visible = false;
    this.gold.name = "CombinedTrim";
    this.view.scene.add(this.gold);
    quad.dispose();
  }

  update(sim, dt) {
    if (!sim.defence) { if (this.gold?.visible) { this.gold.visible = false; this.gold.geometry.instanceCount = 0; } return; }
    const objects = this.view.objects, entities = sim.entities;
    let n = 0, dirty = false;
    for (let i = 0; i < entities.length && n < GOLD.capacity; i++) {
      const e = entities[i];
      if (e.combined !== true || !(e.hp > 0)) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      if (!this.gold) this.buildGold();
      const A = this.goldPlace.array, f = Math.fround, r = GOLD.radius * (o.userData?.readabilityScale || 1);
      const x = o.position.x, y = (o.position.y || 0) + 0.07, z = o.position.z;
      if (A[n * 4] !== f(x) || A[n * 4 + 1] !== f(y) || A[n * 4 + 2] !== f(z) || A[n * 4 + 3] !== f(r)) { A[n * 4] = x; A[n * 4 + 1] = y; A[n * 4 + 2] = z; A[n * 4 + 3] = r; dirty = true; }
      n++;
    }
    if (!this.gold) return;
    if (n !== this.goldCount) dirty = true;
    this.goldCount = n;
    this.gold.geometry.instanceCount = n;
    this.gold.visible = n > 0;
    // The glow breathes with combat motion on; held at mid strength otherwise (reduced motion).
    const motion = this.view.feelEnabled?.() !== false;
    this.clock += dt;
    this.goldMaterial.uniforms.uPulse.value = motion ? 0.5 + 0.5 * Math.sin(this.clock * GOLD.pulse) : 0.5;
    if (n && dirty) { this.goldPlace.clearUpdateRanges(); this.goldPlace.addUpdateRange(0, n * 4); this.goldPlace.needsUpdate = true; }
  }

  reset() {
    this.goldCount = 0;
    if (!this.gold) return;
    this.view.scene.remove(this.gold);
    this.gold.geometry.dispose();
    this.goldMaterial.dispose();
    this.gold = null;
  }
}
