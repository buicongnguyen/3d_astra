import * as THREE from "three";
import { DEFINITIONS as D } from "./data.js";
import { TERRAIN } from "./terrain.js";
import { onHighGround } from "./terrain-labels.js";

// 3D marks for veterancy, abilities and Barrage aiming: rank chevrons over ranked units, a
// tinted ground ring under a unit while its ability lasts, the warning circle where a Barrage
// is about to land, and (while aiming) the target circle with a reach ring around each ready
// Breaker. Every mark is one instance of a single quad: one draw call however many there
// are, none while there is nothing to show. The frame update writes into fixed typed arrays
// (no allocation) and uploads only when a value changed. Marks follow fog of war: a unit's
// marks need the unit drawn, an enemy shell's circle needs the ground in sight.

const CAPACITY = 192;
const BUFF = 0, WARNING = 1, REACH = 2, AIM = 3, CHEVRONS = 10, HIGH = 11;
export const MARK = { BUFF, WARNING, REACH, AIM, CHEVRONS, HIGH };
// Raw display colours (the shader writes them unconverted, like the selection rings).
const BUFF_TINT = { shieldwall: [0.42, 0.8, 1], focus: [1, 0.8, 0.3], overdrive: [1, 0.5, 0.2], lockon: [0.84, 0.56, 1] };
const GOLD = [1, 0.83, 0.38], IN_REACH = [0.6, 0.95, 0.78], OUT_OF_REACH = [0.96, 0.36, 0.28], REACH_TINT = [0.9, 0.95, 0.88];
const BAR_HEIGHT = 2.55, CHEVRON_RISE = 0.36, CHEVRON_SIZE = 0.75, HIGH_SIZE = 0.42, HIGH_REACH = [1, 0.83, 0.38], BASE_REACH = [0.9, 0.95, 0.88];

const VERTEX = `
attribute vec4 iPlace; attribute vec4 iTint; attribute vec2 iKind;
varying vec2 vP; varying vec4 vTint; varying vec2 vKind; varying float vSize;
void main() {
  vP = position.xy * 2.0; vTint = iTint; vKind = iKind; vSize = iPlace.w;
  if (iKind.x > 9.5) {
    // Camera-facing, drawn over everything like the vitals bars.
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    gl_Position = projectionMatrix * viewMatrix * vec4(iPlace.xyz + (right * vP.x + up * vP.y) * iPlace.w, 1.0);
    gl_Position.z = -gl_Position.w * 0.999;
  } else gl_Position = projectionMatrix * viewMatrix * vec4(iPlace.xyz + vec3(vP.x, 0.0, -vP.y) * iPlace.w, 1.0);
}`;
const FRAGMENT = `
uniform float time;
varying vec2 vP; varying vec4 vTint; varying vec2 vKind; varying float vSize;
float band(float r, float at, float w, float aa) { return 1.0 - smoothstep(w, w + aa, abs(r - at)); }
void main() {
  float r = length(vP), aa = fwidth(r) * 1.5, turn = atan(vP.y, vP.x) / 6.2831853, style = vKind.x, v = vKind.y;
  vec3 col = vTint.rgb;
  float alpha = 0.0;
  if (style < 0.5) {
    // Ability ring: bright band, soft halo, six slowly turning dashes outside it.
    float pulse = 0.82 + 0.18 * sin(time * 6.0);
    float dash = step(0.5, fract(turn * 6.0 + time * 0.22)) * band(r, 0.95, 0.028, aa);
    alpha = band(r, 0.8, 0.05, aa) * pulse + exp(-pow((r - 0.8) / 0.14, 2.0)) * 0.42 + dash * 0.85;
  } else if (style < 1.5) {
    // Barrage warning: the edge, a fill that deepens and a ring closing on the centre as the shell falls.
    float inside = 1.0 - smoothstep(0.96 - aa, 0.96, r);
    float cross = (1.0 - smoothstep(0.02, 0.02 + aa, min(abs(vP.x), abs(vP.y)))) * step(r, 0.2);
    alpha = band(r, 0.96, 0.03, aa) + inside * (0.1 + 0.2 * v) + band(r, mix(0.96, 0.06, v), 0.022, aa) * 0.9 * inside + cross * 0.8;
  } else if (style < 2.5) {
    // Reach of a Breaker: a thin dashed line of constant world width.
    float w = 0.06 / max(vSize, 0.001);
    alpha = band(r, 1.0 - w * 2.0, w, aa) * (0.3 + 0.7 * step(0.4, fract(turn * 44.0))) * 0.8;
  } else if (style < 3.5) {
    // Target circle while aiming.
    float inside = 1.0 - smoothstep(0.95 - aa, 0.95, r);
    float cross = (1.0 - smoothstep(0.025, 0.025 + aa, min(abs(vP.x), abs(vP.y)))) * step(r, 0.28);
    alpha = band(r, 0.95, 0.035, aa) + inside * 0.17 + cross;
  } else if (style < 10.5) {
    // Rank chevrons: v of them side by side, gold on a dark outline.
    float best = 9.0, aaP = fwidth(vP.y) * 1.5;
    for (int i = 0; i < 3; i++) {
      if (float(i) >= v) break;
      float lx = vP.x - (float(i) - (v - 1.0) * 0.5) * 0.62;
      best = min(best, max(abs(vP.y - 0.14 + abs(lx) * 1.15) - 0.1, abs(lx) - 0.25));
    }
    float gold = 1.0 - smoothstep(0.0, aaP, best), edge = 1.0 - smoothstep(0.07, 0.07 + aaP, best);
    col = mix(vec3(0.04, 0.06, 0.055), col, gold);
    alpha = max(gold, edge * 0.88);
  } else {
    // High ground: a gold triangle pointing up on a dark outline, beside the vitals bar.
    vec2 q = vec2(abs(vP.x) - 0.62, vP.y + 0.62 / 1.7320508);
    if (q.x + 1.7320508 * q.y > 0.0) q = vec2(q.x - 1.7320508 * q.y, -1.7320508 * q.x - q.y) / 2.0;
    q.x -= clamp(q.x, -1.24, 0.0);
    float d = -length(q) * sign(q.y), aaT = fwidth(d) * 1.5;
    float gold = 1.0 - smoothstep(-0.06, -0.06 + aaT, d), edge = 1.0 - smoothstep(0.12, 0.12 + aaT, d);
    col = mix(vec3(0.04, 0.06, 0.055), col, gold);
    alpha = max(gold, edge * 0.88);
  }
  alpha *= vTint.a;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, min(1.0, alpha));
}`;

export class TacticsView {
  constructor(view) {
    this.view = view;
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    const attr = (name, n) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    };
    this.place = attr("iPlace", 4);
    this.tint = attr("iTint", 4);
    this.kind = attr("iKind", 2);
    this.attributes = [this.place, this.tint, this.kind];
    g.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
    view.scene.add(this.mesh);
    this.count = 0;
    this.dirty = false;
    this.time = 0;
    // Aiming state, set by the interface (main.js). `sources` are the ready units' entities.
    this.aim = { active: false, has: false, ok: false, x: 0, z: 0, radius: 0, range: 0, sources: [] };
    this.delay = D.breaker?.ability?.delay || 1.5;
    quad.dispose();
  }
  showAim(sources, range, radius, point, ok) {
    const a = this.aim;
    a.active = true; a.sources = sources; a.range = range; a.radius = radius;
    a.has = !!point; a.ok = !!ok;
    if (point) { a.x = point.x; a.z = point.z; }
  }
  clearAim() {
    this.aim.active = this.aim.has = false;
    this.aim.sources = [];
  }
  put(x, y, z, size, tint, alpha, style, value) {
    if (this.count >= CAPACITY) return;
    const i = this.count++, P = this.place.array, T = this.tint.array, K = this.kind.array, p = i * 4, k = i * 2, f = Math.fround;
    // Compared at the buffer's float precision: a double that float32 cannot hold must not look changed every frame.
    if (P[p] !== f(x) || P[p + 1] !== f(y) || P[p + 2] !== f(z) || P[p + 3] !== f(size) || T[p] !== f(tint[0]) || T[p + 1] !== f(tint[1]) || T[p + 2] !== f(tint[2]) ||
      T[p + 3] !== f(alpha) || K[k] !== f(style) || K[k + 1] !== f(value)) {
      P[p] = x; P[p + 1] = y; P[p + 2] = z; P[p + 3] = size;
      T[p] = tint[0]; T[p + 1] = tint[1]; T[p + 2] = tint[2]; T[p + 3] = alpha;
      K[k] = style; K[k + 1] = value;
      this.dirty = true;
    }
  }
  teamTint(team) {
    const tints = (this.tints ||= []);
    const hex = this.view.colors[team] ?? 0xb8b2a4;
    let t = tints[team];
    if (!t) t = tints[team] = [0, 0, 0, -1];
    if (t[3] !== hex) { t[0] = ((hex >> 16) & 255) / 255; t[1] = ((hex >> 8) & 255) / 255; t[2] = (hex & 255) / 255; t[3] = hex; }
    return t;
  }
  update(sim, dt, selected = null) {
    const view = this.view, still = !view.activity.combat.motion || view.motionLevel === 0;
    // Rings hold still (no pulse, no turning dashes) with combat motion off or reduced motion.
    if (still) this.time = 0;
    else this.time += dt;
    this.material.uniforms.time.value = this.time;
    const before = this.count;
    this.count = 0;
    const strikes = sim.strikes;
    if (strikes)
      for (let i = 0; i < strikes.length; i++) {
        const s = strikes[i];
        // The player's own shells are always marked; an enemy's only on ground in sight.
        if (!sim.isVisible(s)) continue;
        const left = Math.max(0, Math.min(1, (s.at - sim.time) / this.delay));
        this.put(s.x, 0.11, s.z, s.radius, this.teamTint(s.team), 1, WARNING, still ? 0.5 : Math.round((1 - left) * 40) / 40);
      }
    const entities = sim.entities, m = view.camera.matrixWorld.elements, terrain = sim.terrain, plateaus = terrain?.plateaus?.length > 0;
    // High ground: the ▲ sits left of where the vitals bar is drawn (half its width plus a gap).
    const side = -(2.3 * 0.62 * (view.barScale || 1) / 2 + 0.34);
    let rings = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const high = plateaus && e.hp > 0 && onHighGround(terrain, e);
      if (!e.buff && !e.rank && !high) continue;
      const o = view.objects.get(e.id);
      if (!o || !o.visible || e.hp <= 0) continue;
      if (high) {
        const lift = o.position.y + (e.kind === "unit" ? BAR_HEIGHT * (o.userData.readabilityScale || 1) : 4.9);
        this.put(o.position.x + m[0] * side, lift + m[1] * side, o.position.z + m[2] * side, HIGH_SIZE, GOLD, 1, HIGH, 0);
        // A selected unit on high ground shows its reach: the extra metres in gold, the level-ground range dashed.
        if (selected?.has(e.id) && e.team === 0 && e.range > 0 && e.damage > 0 && rings < 8) {
          rings++;
          // Drawn on the low ground, where the targets of the extra reach stand.
          this.put(o.position.x, 0.12, o.position.z, e.range + TERRAIN.high_range, HIGH_REACH, 1, REACH, 0);
          this.put(o.position.x, 0.12, o.position.z, e.range, BASE_REACH, 0.55, REACH, 0);
        }
      }
      if (e.buff) {
        const fade = Math.max(0, Math.min(1, (e.buff.until - sim.time) / 0.4));
        this.put(o.position.x, o.position.y + 0.1, o.position.z, e.radius + 0.8, BUFF_TINT[e.buff.id] || GOLD, Math.round(fade * 20) / 20, BUFF, 0);
      }
      if (e.rank > 0 && e.kind === "unit")
        this.put(o.position.x + m[4] * CHEVRON_RISE, o.position.y + BAR_HEIGHT + m[5] * CHEVRON_RISE, o.position.z + m[6] * CHEVRON_RISE, CHEVRON_SIZE, GOLD, 1, CHEVRONS, Math.min(3, e.rank));
    }
    const aim = this.aim;
    if (aim.active) {
      for (let i = 0; i < aim.sources.length && i < 8; i++) {
        const e = aim.sources[i], o = view.objects.get(e.id);
        if (e.hp > 0) this.put(o ? o.position.x : e.x, 0.12, o ? o.position.z : e.z, aim.range, REACH_TINT, 1, REACH, 0);
      }
      if (aim.has) this.put(aim.x, 0.13, aim.z, aim.radius, aim.ok ? IN_REACH : OUT_OF_REACH, 1, AIM, aim.ok ? 1 : 0);
    }
    if (this.count !== before) {
      this.mesh.geometry.instanceCount = this.count;
      this.mesh.visible = this.count > 0;
    }
    if (this.dirty && this.count) {
      for (const a of this.attributes) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, this.count * a.itemSize);
        a.needsUpdate = true;
      }
    }
    this.dirty = false;
  }
  // Transient effects go through the pooled particles in fx.js; fog rules are applied here.
  event(event, sim) {
    const fx = this.view.fx;
    if (event.type === "promote") { if (sim.isVisible(event)) fx.promote(event); }
    else if (event.type === "ability") { if (sim.isVisible(event)) fx.ability(event); }
    else if (event.type === "strike") { if (sim.isVisible(event)) fx.strike(event); }
    else if (event.type === "reveal" || event.type === "salvage") { if (sim.isVisible(event)) fx.factionMark(event); }
  }
  // For tests and debugging: the marks drawn this frame.
  snapshot() {
    const out = [];
    for (let i = 0; i < this.count; i++)
      out.push({ style: this.kind.array[i * 2], value: this.kind.array[i * 2 + 1], x: this.place.array[i * 4], y: this.place.array[i * 4 + 1], z: this.place.array[i * 4 + 2],
        size: this.place.array[i * 4 + 3], color: [this.tint.array[i * 4], this.tint.array[i * 4 + 1], this.tint.array[i * 4 + 2]] });
    return out;
  }
  reset() {
    this.clearAim();
    this.count = 0;
    this.time = 0;
    this.mesh.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }
  dispose() {
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
