// Air life (AAA round 3, R3-W): what makes a flyer read as a living machine in the air, all in ONE draw.
//   rotor blur   a faint disc over each spinning rotor or fan (flat, tilted with the craft), and an edge-on
//                blur bar for the Glider's pusher propeller
//   nav lights   red on the left wing tip, green on the right, blinking on a per-craft phase; a white tail strobe
//   engine glow  a warm glow at the exhaust, fan motors or burner; stronger under a night look (mission-looks.js
//                `glow`, 1.9 at night) so flyers mark the dark sky
//   contrails    thin wing-tip streaks while a craft flies fast, from the effects' pooled smoke layer (no draw)
//   shadow       the existing blob under each flyer (view.js prepareFlyer) now shrinks with altitude
// One instanced quad batch with premultiplied blending: discs blend normally, lights add light, in the same draw.
// Hidden when no flyer is on screen; static (no blink, no trails, no spin streaks) with motion off or reduced.
// Flyer motion itself (bank, climb pitch, sway) is src/air-motion.js, applied in view.js.
import * as THREE from "three";
import { LOOKS as MOOD_LOOKS } from "./mission-looks.js";
import { STRETCH, CELL } from "./fx-kinds/cells.js";

// Model-space points per flyer type (three.js axes: the craft faces +Z, its left wing is +X, Y is up), from
// tools/blender/generate_air.py (Blender (x, y, z) -> three (x, z, -y)). r = disc radius, prop = an edge-on blur.
export const AIR_PARTS = {
  kite: {
    discs: [{ at: [0.82, 1.2, 0.05], r: 0.4 }, { at: [-0.82, 1.2, 0.05], r: 0.4 }],
    red: [0.9, 1.04, 0.05], green: [-0.9, 1.04, 0.05], strobe: [0, 0.42, -1.45],
    engines: [{ at: [0, 0.62, 0.6], size: 0.5, team: true }],
    tips: [[0.86, 1.04, 0.05], [-0.86, 1.04, 0.05]],
  },
  hawk: {
    discs: [{ at: [1.32, 1.06, 0.05], r: 0.5 }, { at: [-1.32, 1.06, 0.05], r: 0.5 }],
    red: [1.96, 1.0, 0.05], green: [-1.96, 1.0, 0.05], strobe: [0, 1.66, -2.5],
    engines: [{ at: [0, 0.92, -1.26], size: 0.8 }, { at: [1.32, 0.97, 0.05], size: 0.45 }, { at: [-1.32, 0.97, 0.05], size: 0.45 }],
    tips: [[1.94, 1.0, 0.05], [-1.94, 1.0, 0.05]],
  },
  balloon: {
    discs: [],
    red: [0.58, 0.95, 0], green: [-0.58, 0.95, 0], strobe: [0, 4.25, 0],
    engines: [{ at: [0, 1.4, 0], size: 1.5, burner: true }],
    tips: [],
  },
  glider: {
    discs: [{ at: [0, 0.86, -1.04], r: 0.52, prop: true }],
    red: [1.96, 1.88, -0.66], green: [-1.96, 1.88, -0.66], strobe: [0, 1.8, -0.82],
    engines: [{ at: [0, 0.86, -0.92], size: 0.55 }],
    tips: [[1.9, 1.86, -0.66], [-1.9, 1.86, -0.66]],
  },
};
export const AIR_LIFE = Object.freeze({
  capacity: 256,
  blink: 1.3,          // seconds per nav-light cycle
  trailSpeed: 4.2,     // m/s above which wing tips leave contrails
  trailGap: 0.05,      // seconds between two contrail segments of one tip
  shadowShrink: 0.07,  // blob shadow: scale lost per metre of altitude above the craft's fly height (min 0.7)
});

const VERTEX = `
attribute vec3 iPos; attribute vec3 iU; attribute vec3 iV; attribute vec4 iColor; attribute vec2 iCell;
varying vec2 vUv; varying vec4 vColor; varying float vAdd;
void main() {
  vColor = iColor; vAdd = iCell.y;
  vUv = vec2((uv.x + iCell.x) * 0.5, uv.y);
  vec3 u = iU, v = iV;
  // A zero iV marks a camera-facing sprite of size |iU|.
  if (dot(v, v) < 1e-8) {
    float s = length(iU);
    u = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * s;
    v = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * s;
  }
  vec3 world = iPos + u * position.x * 2.0 + v * position.y * 2.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAGMENT = `
uniform sampler2D map;
varying vec2 vUv; varying vec4 vColor; varying float vAdd;
void main() {
  float a = texture2D(map, vUv).a * vColor.a;
  if (a < 0.003) discard;
  // Premultiplied: vAdd 0 blends like paint, vAdd 1 adds light (alpha 0 keeps what is behind).
  gl_FragColor = vec4(vColor.rgb * a, a * (1.0 - vAdd));
}`;

// Two 64 px cells: a rotor blur disc (faint, with a brighter rim and blade-arc bands) and a hot light dot.
function atlas() {
  const size = 64, canvas = document.createElement("canvas");
  canvas.width = size * 2; canvas.height = size;
  const g = canvas.getContext("2d"), image = g.createImageData(size * 2, size);
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size * 2; px++) {
      const cell = px >= size ? 1 : 0, x = ((px % size) + 0.5) / size * 2 - 1, y = (py + 0.5) / size * 2 - 1, d = Math.hypot(x, y);
      let a = 0;
      if (cell === 0) a = d > 1 ? 0 : 0.28 + 0.5 * Math.exp(-(((d - 0.9) / 0.07) ** 2)) + 0.12 * Math.max(0, Math.cos(d * 18)) - 0.25 * Math.exp(-((d / 0.15) ** 2));
      else a = Math.max(0, 1 - d) ** 2.4 + 0.6 * Math.exp(-((d / 0.16) ** 2));
      const i = (py * size * 2 + px) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
    }
  g.putImageData(image, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const P = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3();
const RED = [1, 0.32, 0.22], GREEN = [0.2, 1, 0.4], WHITE = [1, 0.97, 0.9], WARM = [1, 0.62, 0.24], BURNER = [1, 0.55, 0.15], DISC = [0.86, 0.88, 0.9];
const TRAIL = [0.96, 0.97, 1, 0.5], TRAIL_END = [0.92, 0.94, 0.98, 0];

export class AirLifeView {
  constructor(view) {
    this.view = view;
    this.texture = atlas();
    const n = AIR_LIFE.capacity, quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.setAttribute("uv", quad.getAttribute("uv"));
    const attr = (name, k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * k), k); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.attrs = { pos: attr("iPos", 3), u: attr("iU", 3), v: attr("iV", 3), color: attr("iColor", 4), cell: attr("iCell", 2) };
    this.attrList = Object.values(this.attrs);
    g.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({ uniforms: { map: { value: this.texture } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.name = "air-life";
    this.mesh.visible = false;
    view.scene.add(this.mesh);
    quad.dispose();
    this.count = 0;
    this.disc = DISC.slice();
    this.trails = new Map(); // entity id -> seconds to the next contrail segment (and last position)
  }
  get lively() { const v = this.view; return v.motionLevel > 0 && !v.reducedMotion?.matches && v.settings?.combatMotion !== false; }
  // Night and storm make the lights stronger (mission look `glow`), day keeps them small and soft.
  get glowScale() {
    const state = this.view.mood?.state, def = state?.name ? MOOD_LOOKS[state.name] : null;
    return def ? 1 + (def.glow - 1) * (state.k ?? 1) : 1;
  }
  push(x, y, z, u, v, color, alpha, cell, add) {
    if (this.count >= AIR_LIFE.capacity) return;
    const i = this.count++, A = this.attrs;
    A.pos.array[i * 3] = x; A.pos.array[i * 3 + 1] = y; A.pos.array[i * 3 + 2] = z;
    A.u.array[i * 3] = u.x; A.u.array[i * 3 + 1] = u.y; A.u.array[i * 3 + 2] = u.z;
    A.v.array[i * 3] = v ? v.x : 0; A.v.array[i * 3 + 1] = v ? v.y : 0; A.v.array[i * 3 + 2] = v ? v.z : 0;
    A.color.array[i * 4] = color[0]; A.color.array[i * 4 + 1] = color[1]; A.color.array[i * 4 + 2] = color[2]; A.color.array[i * 4 + 3] = alpha;
    A.cell.array[i * 2] = cell; A.cell.array[i * 2 + 1] = add;
  }
  // A model-space point of the flyer's model `m` (root unrotated at o) in the world, into P.
  world(o, m, at) {
    P.set(at[0], at[1], at[2]).multiply(m.scale).applyQuaternion(m.quaternion).add(m.position).add(o.position);
    return P;
  }
  light(o, m, at, size, color, alpha) {
    const p = this.world(o, m, at), s = m.scale.x;
    this.push(p.x, p.y, p.z, U.set(size * s, 0, 0), null, color, alpha, 1, 1);
  }
  update(sim, dt) {
    const view = this.view, lively = this.lively, glow = this.glowScale, night = Math.max(0, Math.min(1, (glow - 1) / 0.9));
    const fx = view.fx, time = (this.time = (this.time || 0) + (lively ? dt : 0));
    this.count = 0;
    // Rotor blur is paint, not light: it darkens with the scene at night.
    const k = 1 - 0.6 * night;
    this.disc[0] = DISC[0] * k; this.disc[1] = DISC[1] * k; this.disc[2] = DISC[2] * k;
    for (const [id, o] of view.objects) {
      const u = o.userData, air = u.air;
      if (!air || !o.visible) continue;
      const e = sim.get?.(id), parts = AIR_PARTS[e?.type];
      if (!e || !parts) continue;
      const m = u.model, s = m.scale.x;
      // Rotor blur discs: in the craft's rotor plane (tilted with its bank and pitch).
      for (const d of parts.discs) {
        const p = this.world(o, m, d.at), r = d.r * s;
        if (d.prop) { U.set(r, 0, 0).applyQuaternion(m.quaternion); V.set(0, r, 0).applyQuaternion(m.quaternion); }
        else { U.set(r, 0, 0).applyQuaternion(m.quaternion); V.set(0, 0, r).applyQuaternion(m.quaternion); }
        this.push(p.x, p.y, p.z, U, V, this.disc, lively ? 0.4 : 0.2, 0, 0);
      }
      // Engine glow: warm at the exhaust, the burner breathes with the flame; team-coloured spotter eye on the Kite.
      for (const g of parts.engines) {
        const flick = lively ? 0.85 + 0.15 * Math.sin(air.clock * (g.burner ? 13 : 23) + id) : 1;
        const color = g.team ? view.fx.tint(e.team) : g.burner ? BURNER : WARM;
        this.light(o, m, g.at, g.size * (0.85 + 0.6 * night) * flick, color, (0.55 + 0.45 * night) * flick);
      }
      // Navigation lights: steady small cores, a bright blink once a cycle (always on, unblinking, when still).
      const phase = lively ? ((time / AIR_LIFE.blink + id * 0.37) % 1) : 0.5;
      const blink = lively ? (phase < 0.12 ? 1 : 0.35) : 0.6, strobe = lively ? (Math.abs(phase - 0.5) < 0.05 ? 1 : 0) : 0;
      const size = 0.46 + 0.4 * night;
      this.light(o, m, parts.red, size * (0.7 + 0.5 * blink), RED, 0.5 + 0.5 * blink);
      this.light(o, m, parts.green, size * (0.7 + 0.5 * blink), GREEN, 0.5 + 0.5 * blink);
      if (strobe) this.light(o, m, parts.strobe, size * 1.6, WHITE, 0.95);
      // The blob shadow shrinks a little as the craft rides higher (a plateau rim, a climb), so height reads.
      const shadow = u.contactShadow;
      if (shadow) {
        const lift = (air.y ?? o.position.y) - o.position.y - air.fly;
        shadow.scale.setScalar(e.radius * 1.5 * Math.max(0.7, Math.min(1.1, 1 - lift * AIR_LIFE.shadowShrink)));
      }
      // Contrails from the wing tips while flying fast.
      if (!lively || !(dt > 0) || !fx || !parts.tips.length) continue;
      let t = this.trails.get(id);
      if (!t) this.trails.set(id, (t = { wait: 0, x: o.position.x, z: o.position.z, seen: 0 }));
      const speed = Math.hypot(o.position.x - t.x, o.position.z - t.z) / dt;
      t.x = o.position.x; t.z = o.position.z; t.seen = time;
      if (speed < AIR_LIFE.trailSpeed || (t.wait -= dt) > 0) continue;
      t.wait = AIR_LIFE.trailGap / (fx.governed || 1);
      const fwd = U.set(0, 0, 1).applyQuaternion(m.quaternion);
      for (const tip of parts.tips) {
        const p = this.world(o, m, tip);
        const q = fx.emit(fx.smoke, p.x - fwd.x * 0.3, p.y, p.z - fwd.z * 0.3, e, true);
        q.mode = STRETCH; q.ax = fwd.x; q.ay = fwd.y; q.az = fwd.z; q.length = speed * AIR_LIFE.trailGap * 1.6;
        q.s0 = 0.09; q.s1 = 0.2; q.life = 0.55; q.cell = CELL.glow; q.c0 = TRAIL; q.c1 = TRAIL_END;
      }
    }
    if (this.trails.size > 64) for (const [id, t] of this.trails) if (t.seen !== time) this.trails.delete(id);
    const n = this.count, g = this.mesh.geometry;
    this.mesh.visible = n > 0;
    if (!n && !g.instanceCount) return;
    // A still frame (paused, or the render budget's frozen scene) moves nothing: keep the buffers already sent.
    if (!(dt > 0) && n === g.instanceCount && this.sent) return;
    this.sent = true;
    g.instanceCount = n;
    for (const a of this.attrList) {
      a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); a.needsUpdate = true;
    }
  }
  reset() { this.trails.clear(); this.count = 0; this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; }
}
