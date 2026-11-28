import * as THREE from "three";
import { weaponStyle } from "./visual-style.js";
import { weaponClass } from "./fx-kinds/weapon-class.js";
import { RocketBodies } from "./fx-kinds/rocket-body.js";

// H3a/H3d Hero mode on the battlefield (rules: src/sim/content/hero-mode.js; camera and HUD: src/hero-mode.js).
// A view plugin that only reads the simulation:
//   - the projectiles flying at the hero (sim.heroMode.shots), drawn like the battle's own weapon effects
//     (src/fx-kinds): a rifle round is a faction-tinted tracer with a white-hot head and a fading tail, a rocket
//     the Anti-tank's finned body (rocket-body.js) with a flame and a curling smoke trail, a shell a glowing ball
//     with a short trail. Every streak, flame, smoke trail and ball is one camera-facing ribbon in ONE instanced
//     draw (premultiplied blending: glows add, smoke covers); the rocket bodies are one more while a rocket flies;
//   - a warning ring flashing where each rocket or shell will land (1 draw for all of them);
//   - the ground reticle where the weapon in hand will hit (1 draw), placed by the page (setReticle);
//   - Skywing's barrel roll when it dodges (the model's roll, no draw).
// Nothing is built until Hero mode first fires a shot or shows the reticle: normal play draws nothing more.
// View only: the hit and dodge rules stay in the simulation; nothing here allocates per frame.
const SHOTS = 24;
const OWN = 8; // the driven hero's own rounds in flight (item 6)
const RIBBONS = (SHOTS + OWN) * 2; // a rocket takes two (smoke trail + flame), every other round one
const RINGS = 12;
const WARN = 0xff4a3a;

// Ribbon kinds (the shader's aHead.w).
export const RIBBON = Object.freeze({ tracer: 0, smoke: 1, flame: 2, shell: 3 });
// How each look is drawn, metres: `trail` is the tail's length, `width` the ribbon's half width.
export const SHOT_LOOKS = Object.freeze({
  tracer: { trail: 2.4, width: 0.11 },
  rocket: { trail: 4.2, width: 0.3, flame: 0.95, flameWidth: 0.22 },
  shell: { trail: 1.5, width: 0.3 },
});
// The hero's own rounds, seen from just behind it: longer trails, a bigger rocket, a slight arc to follow.
export const OWN_LOOKS = Object.freeze({
  tracer: { trail: 6, width: 0.085 },
  rocket: { trail: 7.5, width: 0.34, flame: 1.2, flameWidth: 0.26, scale: 1.35, arc: 0.07, arcMax: 1.6 },
  shell: { trail: 2.6, width: 0.32 },
});

// The look of one shot at the hero, from the same weapon classes and colours as the battle's effects
// (src/fx-kinds/weapon-class.js, visual-style.json, faction tints): "tracer" for rifles, guns, beams and pulses,
// "rocket" for rockets and missiles, "shell" for cannons, lobs, flak, bombs and flame. `unit` is the shooter's
// type (several units share a weapon key), `faction` its faction id. Writes into `out` (no allocation per frame).
const EVENT = { type: "shot", weapon: "", unit: "", tAir: 0 };
const SHELL_CLASSES = ["shell", "lob", "flak", "bomb", "flamer"];
export function heroShotLook(shot, unit, faction, out = {}) {
  EVENT.weapon = shot.weapon; EVENT.unit = unit || shot.weapon; EVENT.tAir = shot.air ? 1 : 0;
  const style = weaponStyle(EVENT, faction), cls = weaponClass(EVENT, style);
  out.kind = cls === "missile" ? "rocket" : SHELL_CLASSES.includes(cls) ? "shell" : "tracer";
  out.cls = cls;
  out.color = style.color || [1, 0.9, 0.6, 1];
  return out;
}

const VERTEX = `
attribute vec4 aHead; // head xyz, kind
attribute vec4 aTail; // tail xyz, half width
attribute vec4 aColor; // rgb, seed
varying vec2 vQ; // x: across (-1..1), y: metres from the tail (-w .. len + w)
varying float vLen, vW, vKind, vSeed;
varying vec3 vColor;
void main() {
  vec3 axis = aHead.xyz - aTail.xyz;
  float len = max(length(axis), 1e-3), w = aTail.w;
  vec3 dir = axis / len;
  // The quad runs from one width behind the tail to one width past the head, so a round head fits.
  float d = -w + (len + 2.0 * w) * position.y;
  vec3 p = aTail.xyz + dir * d;
  vec3 side = cross(dir, normalize(cameraPosition - p));
  float s = length(side);
  side = s > 1e-4 ? side / s : vec3(0.0, 1.0, 0.0);
  p += side * position.x * w;
  vQ = vec2(position.x, d); vLen = len; vW = w; vKind = aHead.w; vSeed = aColor.w; vColor = aColor.rgb;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FRAGMENT = `
uniform float uTime;
varying vec2 vQ;
varying float vLen, vW, vKind, vSeed;
varying vec3 vColor;
void main() {
  float t = clamp(vQ.y / vLen, 0.0, 1.0); // 0 at the tail, 1 at the head
  float across = max(0.0, 1.0 - vQ.x * vQ.x);
  float head = length(vec2(vQ.x, (vQ.y - vLen) / vW)); // 0 at the head point, 1 one width away
  vec4 o = vec4(0.0);
  if (vKind < 0.5) {
    // Tracer: a thin bright core in the faction's colour fading to nothing at the tail, a white-hot head.
    float core = across * across * across * pow(t, 1.6) * step(vQ.y, vLen);
    float hot = 1.0 - smoothstep(0.0, 1.6, head);
    o = vec4(vColor * core * 1.6 + mix(vColor, vec3(1.0), 0.75) * hot * 1.5, 0.0);
  } else if (vKind < 1.5) {
    // Smoke trail: soft grey, thickest just behind the rocket, curling, thinning toward the tail.
    float wob = sin(vQ.y * 2.3 - uTime * 3.0 + vSeed * 6.3) * 0.22 * (1.0 - t);
    float x = (vQ.x - wob) / mix(0.45, 1.0, t);
    float a = max(0.0, 1.0 - x * x) * smoothstep(0.0, 0.6, t) * (1.0 - smoothstep(0.9, 1.0, t)) * 0.5;
    o = vec4(vec3(0.6, 0.58, 0.54) * a, a);
  } else if (vKind < 2.5) {
    // Rocket flame: white at the nozzle (the head end), orange toward its tip, flickering.
    float flick = 0.85 + 0.15 * sin(uTime * 53.0 + vSeed * 9.0);
    float shape = max(0.0, 1.0 - vQ.x * vQ.x / max(0.05, t * t)) * smoothstep(0.0, 0.35, t);
    vec3 c = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.96, 0.82), smoothstep(0.55, 1.0, t)) * shape * 1.6 * flick;
    c += vec3(1.0, 0.62, 0.25) * (1.0 - smoothstep(0.0, 2.2, head)) * 0.7 * flick; // the halo round the nozzle
    o = vec4(c, 0.0);
  } else {
    // Shell: a glowing ball (white core, warm rim) and a short fading trail behind it.
    float ball = 1.0 - smoothstep(0.0, 1.0, head);
    float trail = across * across * t * t * 0.7 * step(vQ.y, vLen);
    o = vec4(mix(vColor, vec3(1.0, 0.98, 0.9), ball * ball) * (ball * 1.8 + trail), 0.0);
  }
  if (o.r + o.g + o.b + o.a < 0.004) discard;
  gl_FragColor = o;
}`;

const LOOK = { kind: "tracer", cls: "tracer", color: null };
const P = { x: 0, y: 0, z: 0 };

export class HeroModeView {
  constructor(view) {
    this.view = view;
    this.shots = null;
    this.rockets = null;
    this.rings = null;
    this.reticle = null;
    this.dummy = new THREE.Object3D();
    this.rolls = new Map(); // entity id -> { t, seconds }
    this.clock = 0;
    this.drawn = { tracer: 0, rocket: 0, shell: 0 }; // this frame's rounds by look (tests read it)
    // Item 6: the driven hero's own rounds (fx.js hands them over through view.heroOwnShots), a fixed pool.
    this.own = Array.from({ length: OWN }, () => ({ on: false, kind: "tracer", t: 0, travel: 1, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, color: [1, 1, 1], seed: 0 }));
    this.ownCount = 0;
    this.ownDrawn = { tracer: 0, rocket: 0, shell: 0 };
    this.ownTaken = { tracer: 0, rocket: 0, shell: 0 }; // every own round taken over since the start, by look (tests)
    view.heroOwnShots = this;
  }
  // fx.js: a shot event. True (and the flight is ours) when it is the driven hero's own shot under the Hero camera,
  // with motion allowed; the effects then draw only the muzzle and the landing. `from`/`to` are fx.aim's ends, the
  // flight lasts the style's `life`, so it lands exactly when the effects' hit does.
  take(e, sim, from, to, style) {
    const v = this.view;
    if (!v.heroCameraOn || v.reducedMotion?.matches || !sim?.heroMode) return false;
    const driven = sim.heroMode.teams?.[0]?.id;
    if (driven == null || e.source !== driven) return false;
    let slot = this.own.find((q) => !q.on);
    if (!slot) slot = this.own.reduce((a, b) => (b.t / b.travel > a.t / a.travel ? b : a));
    heroShotLook({ weapon: e.weapon, air: !!e.tAir }, e.unit, sim.factions?.[e.team], LOOK);
    Object.assign(slot, { on: true, kind: style.kind === "rocket" ? "rocket" : LOOK.kind, t: 0, travel: Math.max(0.08, style.life || 0.3), fx: from.x, fy: from.y, fz: from.z, tx: to.x, ty: to.y, tz: to.z, seed: Math.random() });
    slot.color[0] = LOOK.color[0]; slot.color[1] = LOOK.color[1]; slot.color[2] = LOOK.color[2];
    this.ownCount = this.own.reduce((n, q) => n + (q.on ? 1 : 0), 0);
    this.ownTaken[slot.kind]++;
    return true;
  }
  build() {
    const scene = this.view.scene;
    // The ribbons: one quad, x across (-1..1), y along (0 tail .. 1 head), drawn once per ribbon.
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    const dynamic = () => new THREE.InstancedBufferAttribute(new Float32Array(RIBBONS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.head = dynamic();
    this.tail = dynamic();
    this.color = dynamic();
    quad.setAttribute("aHead", this.head);
    quad.setAttribute("aTail", this.tail);
    quad.setAttribute("aColor", this.color);
    quad.instanceCount = 0;
    this.time = { value: 0 };
    const shotMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.shots = new THREE.Mesh(quad, shotMat);
    this.shots.frustumCulled = false;
    this.shots.name = "HeroShots";
    this.shots.renderOrder = 4;
    this.shots.visible = false;
    // The rockets' finned bodies: the battle's own rocket mesh (one instanced draw, hidden with no rocket in the air).
    this.rockets = new RocketBodies(8);
    this.rockets.mesh.name = "HeroRockets";
    const ring = new THREE.RingGeometry(0.82, 1, 40);
    ring.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.rings = new THREE.InstancedMesh(ring, ringMat, RINGS);
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.name = "HeroWarnRings";
    this.rings.renderOrder = 3;
    // The reticle: a thin ring with four ticks, drawn over the ground.
    const r = new THREE.RingGeometry(0.55, 0.68, 32);
    const ticks = [0, 1, 2, 3].map((i) => { const g = new THREE.PlaneGeometry(0.1, 0.42); g.translate(0, 0.98, 0); g.rotateZ((i * Math.PI) / 2); return g; });
    const geo = mergeGeometries([r, ...ticks]);
    geo.rotateX(-Math.PI / 2);
    this.reticleMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.reticle = new THREE.Mesh(geo, this.reticleMat);
    this.reticle.name = "HeroReticle";
    this.reticle.renderOrder = 6;
    this.reticle.visible = false;
    this.reticle.frustumCulled = false;
    scene.add(this.shots, this.rockets.mesh, this.rings, this.reticle);
  }
  // The page's reticle: { x, z, y, size, locked, progress, target } or null to hide it.
  setReticle(p) {
    if (!p) { if (this.reticle) this.reticle.visible = false; return; }
    if (!this.reticle) this.build();
    const s = p.size || 1;
    this.reticle.position.set(p.x, (p.y || 0) + 0.12, p.z);
    this.reticle.scale.set(s, 1, s);
    this.reticle.rotation.y = p.locked ? this.clock * 4 : (p.progress || 0) * Math.PI;
    this.reticleMat.color.set(p.locked ? 0xff6a3a : p.target ? 0xfff2b0 : 0xd8e6f0);
    this.reticle.visible = true;
  }
  event(ev) {
    if (ev.type === "heroDodge" && ev.roll) this.rolls.set(ev.id, { t: 0, seconds: Math.max(0.2, ev.seconds || 0.3) });
  }
  hide() {
    if (!this.shots) return;
    this.shots.geometry.instanceCount = 0;
    this.rings.count = 0;
    this.shots.visible = this.rings.visible = false;
    this.rockets.begin(this.clock, 1); this.rockets.end();
  }
  // One ribbon: from (tx, ty, tz) to the head (hx, hy, hz), half width `w`, colour `c` (rgb), `seed` for its wobble.
  ribbon(i, kind, hx, hy, hz, tx, ty, tz, w, c, seed) {
    const h = this.head.array, t = this.tail.array, col = this.color.array, o = i * 4;
    h[o] = hx; h[o + 1] = hy; h[o + 2] = hz; h[o + 3] = kind;
    t[o] = tx; t[o + 1] = ty; t[o + 2] = tz; t[o + 3] = w;
    col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2]; col[o + 3] = seed;
  }
  update(sim, dt) {
    this.clock += dt;
    const shots = sim.heroMode?.shots;
    if (this.rolls.size) this.roll(dt);
    const drawn = this.drawn, own = this.ownDrawn;
    drawn.tracer = drawn.rocket = drawn.shell = 0;
    own.tracer = own.rocket = own.shell = 0;
    if (!shots?.length && !this.ownCount) {
      if (this.shots && (this.shots.visible || this.rings.count)) this.hide();
      return;
    }
    if (!this.shots) this.build();
    // The flame's flicker and the smoke's curl hold still with reduced motion.
    if (!this.view.reducedMotion?.matches) this.time.value = (this.time.value + dt) % 600;
    const T = this.view.terrain, warn = this.view.settings?.shotWarnings !== false;
    let n = 0, r = 0;
    this.rockets.begin(this.clock, 1);
    for (let i = 0; shots && i < shots.length && i < SHOTS; i++) {
      const s = shots[i];
      const span = Math.max(1e-3, s.at - s.t0), k = Math.min(1, Math.max(0, (sim.time - s.t0) / span));
      const from = this.view.objects.get(s.by)?.position;
      const sx = from ? from.x : s.sx, sz = from ? from.z : s.sz;
      const ground = T.heightAt(s.x, s.z);
      const sy = (from ? from.y : T.heightAt(sx, sz)) + 1.1, ty = ground + (s.air ? 3.5 : 0.9);
      // A shell or rocket arcs; a rifle round flies straight.
      const arc = s.heavy ? Math.min(4, span * 3) : 0;
      const at = (q) => { P.x = sx + (s.x - sx) * q; P.z = sz + (s.z - sz) * q; P.y = sy + (ty - sy) * q + Math.sin(q * Math.PI) * arc; return P; };
      const dist = Math.hypot(s.x - sx, ty - sy, s.z - sz) || 1;
      heroShotLook(s, sim.get?.(s.by)?.type, sim.factions?.[s.team], LOOK);
      const look = SHOT_LOOKS[LOOK.kind], seed = (s.n * 0.618) % 1;
      at(k);
      const hx = P.x, hy = P.y, hz = P.z;
      at(Math.max(0, k - look.trail / dist));
      const tx = P.x, ty2 = P.y, tz = P.z;
      if (LOOK.kind === "rocket") {
        // Nose along the flight (a step back along the arc), the flame at the tail, the smoke behind the flame.
        at(Math.max(0, k - 0.3 / dist));
        let dx = hx - P.x, dy = hy - P.y, dz = hz - P.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        dx /= l; dy /= l; dz /= l;
        this.rockets.add(hx, hy, hz, dx, dy, dz, this.clock * 13 + seed * 6.28, 1, LOOK.color);
        const nx = hx - dx * 0.5, ny = hy - dy * 0.5, nz = hz - dz * 0.5;
        this.ribbon(n++, RIBBON.flame, nx, ny, nz, nx - dx * look.flame, ny - dy * look.flame, nz - dz * look.flame, look.flameWidth, LOOK.color, seed);
        const mx = nx - dx * 0.4, my = ny - dy * 0.4, mz = nz - dz * 0.4;
        if (Math.hypot(mx - tx, my - ty2, mz - tz) > 0.2 && k * dist > 1.2) this.ribbon(n++, RIBBON.smoke, mx, my, mz, tx, ty2, tz, look.width, LOOK.color, seed);
      } else this.ribbon(n++, LOOK.kind === "shell" ? RIBBON.shell : RIBBON.tracer, hx, hy, hz, tx, ty2, tz, look.width, LOOK.color, seed);
      drawn[LOOK.kind]++;
      // The landing ring for a rocket or shell: it tightens and flashes as the round comes in.
      // H7 Settings > Hero > Shot warnings Off hides them; a round cover stops (H6) gets none: it cannot hit.
      if (s.heavy && !s.air && !s.blocked && warn && r < RINGS) {
        const radius = Math.max(1.3, s.splash?.r || 1.3) * (1.25 - 0.25 * k);
        this.dummy.position.set(s.x, ground + 0.1, s.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(radius, 1, radius);
        this.dummy.updateMatrix();
        this.rings.setMatrixAt(r, this.dummy.matrix);
        r++;
      }
    }
    // The hero's own rounds: muzzle to aim point in the style's flight time; rockets arc a little.
    if (this.ownCount) {
      let live = 0;
      for (const q of this.own) {
        if (!q.on) continue;
        q.t += dt;
        if (q.t >= q.travel) { q.on = false; continue; }
        live++;
        const look = OWN_LOOKS[q.kind], k = q.t / q.travel, dist = Math.hypot(q.tx - q.fx, q.ty - q.fy, q.tz - q.fz) || 1;
        const arc = q.kind === "rocket" ? Math.min(look.arcMax, dist * look.arc) : 0;
        const at = (u) => { P.x = q.fx + (q.tx - q.fx) * u; P.y = q.fy + (q.ty - q.fy) * u + Math.sin(u * Math.PI) * arc; P.z = q.fz + (q.tz - q.fz) * u; return P; };
        at(k);
        const hx = P.x, hy = P.y, hz = P.z;
        at(Math.max(0, k - look.trail / dist));
        const tx = P.x, ty = P.y, tz = P.z;
        if (q.kind === "rocket") {
          at(Math.max(0, k - 0.3 / dist));
          let dx = hx - P.x, dy = hy - P.y, dz = hz - P.z;
          const l = Math.hypot(dx, dy, dz) || 1;
          dx /= l; dy /= l; dz /= l;
          this.rockets.add(hx, hy, hz, dx, dy, dz, this.clock * 13 + q.seed * 6.28, look.scale, q.color);
          const b = 0.5 * look.scale, nx = hx - dx * b, ny = hy - dy * b, nz = hz - dz * b;
          this.ribbon(n++, RIBBON.flame, nx, ny, nz, nx - dx * look.flame, ny - dy * look.flame, nz - dz * look.flame, look.flameWidth, q.color, q.seed);
          const mx = nx - dx * 0.4, my = ny - dy * 0.4, mz = nz - dz * 0.4;
          if (Math.hypot(mx - tx, my - ty, mz - tz) > 0.2) this.ribbon(n++, RIBBON.smoke, mx, my, mz, tx, ty, tz, look.width, q.color, q.seed);
        } else this.ribbon(n++, q.kind === "shell" ? RIBBON.shell : RIBBON.tracer, hx, hy, hz, tx, ty, tz, look.width, q.color, q.seed);
        own[q.kind]++;
      }
      this.ownCount = live;
    }
    this.rockets.end(true);
    const g = this.shots.geometry;
    g.instanceCount = n;
    this.shots.visible = n > 0;
    for (const a of [this.head, this.tail, this.color]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
    this.rings.count = r;
    this.rings.visible = r > 0;
    this.rings.material.opacity = 0.55 + 0.4 * Math.abs(Math.sin(this.clock * 12));
    if (r) this.rings.instanceMatrix.needsUpdate = true;
  }
  roll(dt) {
    for (const [id, roll] of this.rolls) {
      roll.t += dt;
      const u = this.view.objects.get(id)?.userData, model = u?.model;
      const k = Math.min(1, roll.t / roll.seconds);
      // Skywing's own model lies prone in flight: it rolls about its body (skywing-view.js poseSkywing reads it).
      if (u?.skywing) u.skywing.roll = k < 1 ? k * Math.PI * 2 : 0;
      else if (model) model.rotation.z = k < 1 ? k * Math.PI * 2 : 0;
      if (k >= 1) this.rolls.delete(id);
    }
  }
  reset() {
    this.rolls.clear();
    for (const q of this.own) q.on = false;
    this.ownCount = 0;
    this.hide();
    if (this.reticle) this.reticle.visible = false;
  }
}

// Several plain geometries (position only) as one, so the reticle stays a single draw.
function mergeGeometries(list) {
  const pos = [], index = [];
  let offset = 0;
  for (const g of list) {
    const ng = g.index ? g : g.toNonIndexed();
    pos.push(...ng.attributes.position.array);
    if (ng.index) index.push(...[...ng.index.array].map((i) => i + offset));
    else for (let i = 0; i < ng.attributes.position.count; i++) index.push(i + offset);
    offset += ng.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}
