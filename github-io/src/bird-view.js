import * as THREE from "three";
import { BirdFlocks, BIRD_LIFE, BIRD_LEVELS, BIRD_SHOT, NEVER, SPECIES, SPECIES_ID, birdBudget, birdPath, pickBird, planFlocks, roofFlock } from "./bird-life.js";
import { birdGeometry, WING_POSE } from "./ambient-life.js";
import { modelLoader } from "./model-decode.js";
import { weaponStyle } from "./visual-style.js";
import { CELL, BILLBOARD } from "./fx-kinds/cells.js";

// H5 birds that react (a view plugin, docs/VIEW_PLUGINS.md; the logic is src/bird-life.js).
// Draws:
// How many: Settings > Hero > Birds (off / few, the default / many), applied at once (the flocks are planned again).
//   cards   every perched and flying bird as the small low-poly card of ambient-life.js (9 triangles), all families in
//           ONE instanced draw (colours per family from a uniform table): the RTS view and far birds in Hero mode
//   near    in Hero mode, the flocks nearest the camera (at most BIRD_BUDGET.near birds) use the detailed bird of their
//           family from public/models/birds.glb (tools/build-birds.mjs): one instanced draw per family that has a near
//           bird (usually one or two), loaded on the first Hero mode frame (the RTS view never fetches it)
// Everything moves in the vertex shaders from one clock and a few event times per bird (birdPath in bird-life.js is the
// same maths): take-off in a ripple, climb, circle (crows over the latest fight), glide back down, head jerks while
// perched, folded wings at rest, flapping and gliding in the air, and birds parting around Skywing (uSky) and closing
// up behind it (the hawk that rode near Skywing went with the brown families, 2026-11-28). No shadow casting, no per-frame allocation; the instance data changes only when a flock is startled or
// lands, or the near set changes (four times a second at most).
// Quiet: reduced motion or the governor's still level hold the birds on their perches (no startles, no flaps).
// Settings Display > Detail Off hides them, like the other ambient life; the governor's rescue level too.
// Birds under fire (Hero mode, owner 2026-11-28 "scare it, don't kill it"; src/hero-mode.js aims and fires): pick() finds
// the bird under the crosshair (bird-life.js pickBird), shotBird() makes the round whizz past it: the bird tumbles in the
// shaders (aHit, the time of the hit: two rolls and a jolt sideways, wings flailing, BIRD_SHOT.tumble s), its flock
// bursts off in the ripple from it, and a puff of feathers in its family's colours rises from the effects' pooled
// particles (+0 draws). Reduced motion (or the still level): no tumble, no feathers, and the flock leaves calmly (the
// clock runs while a flock is up, so it flies off and lands again; wings held open). No bird is ever removed.
const SIZE_CARD = { crow: 0.9, gull: 1, songbird: 0.62, duck: 0.85, goose: 1.1, hawk: 1.15 };
const PALETTE = { // sRGB like ambient-life.js: body, wing, tip
  crow: ["#2b2927", "#1f1e1c", "#121110"], gull: ["#f4f2ea", "#dedcd2", "#4b5054"], songbird: ["#f2a53c", "#9a6230", "#3b2b1f"],
  duck: ["#7a6a4c", "#55664a", "#2a2622"], goose: ["#8f8676", "#6f675b", "#2a2622"], hawk: ["#94704a", "#6f5232", "#2e241a"],
};
// Flight look per family: wingbeats a second (rad/s) and how much of the time it glides.
const FLIGHT = { crow: [10, 0.25], gull: [8.5, 0.55], songbird: [15, 0.1], duck: [12, 0.05], goose: [7.5, 0.15], hawk: [7, 0.9] };
// Folded-wing birds (modelled perched) open their wings this much longer in flight.
const STRETCH = { crow: 1.7, songbird: 1.6, duck: 1.6, goose: 1.8 };
export const NEAR = Object.freeze({ pc: 26, touch: 18 }); // m from the Hero camera
const SUN = new THREE.Vector3(-25, 55, 20).normalize();
// Feathers where a round passed, in each family's colours (two tones, as the effects draw them): black crows, white
// and grey gulls.
const FEATHERS = { crow: [[0.11, 0.1, 0.1], [0.21, 0.2, 0.19]], gull: [[0.96, 0.95, 0.92], [0.6, 0.62, 0.65]] };
const FEATHER_TONES = Object.fromEntries(Object.entries(FEATHERS).map(([k, tones]) => [k, tones.map((c) => [[...c, 0.95], [...c, 0]])]));
// The soft burst of down with them, in the family's lighter tone.
const DOWN = Object.fromEntries(Object.entries(FEATHERS).map(([k, tones]) => [k, [[...tones[1], 0.42], [...tones[1], 0]]]));
const SHOT_AT = {}, NEAREST = {};

const COMMON = /* glsl */ `
uniform float uTime, uAmp, uHalf, uHint;
uniform sampler2D uFog;
uniform vec4 uSky;
attribute vec4 aPerch;  // perch x, y, z, size (0: not drawn here)
attribute vec4 aTimes;  // take-off time, landing time, phase, family
attribute vec4 aCircle; // circle centre x, y, z, radius
attribute float aHit;   // when a round whizzed past this bird (Hero mode): it tumbles for a moment from then
// 0..1 through the tumble at time t, else 0.
float tumbleAt(float t) { float h = (t - aHit) / ${BIRD_SHOT.tumble.toFixed(2)}; return h > 0.0 && h < 1.0 ? h : 0.0; }
// The tumble: two rolls (ending level) and a pitch wobble round the bird's own middle.
vec3 tumbleSpin(vec3 q, float h) {
  if (h <= 0.0) return q;
  float roll = (1.0 - (1.0 - h) * (1.0 - h)) * 12.5664, pitch = sin(h * 6.2832) * 0.55;
  float c = cos(roll), s = sin(roll);
  q = vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z);
  c = cos(pitch); s = sin(pitch);
  return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
}
float fogAt(vec3 p) {
  vec2 uv = vec2((p.x + uHalf) / (2.0 * uHalf), (uHalf - p.z) / (2.0 * uHalf));
  return texture2D(uFog, uv).a;
}
float inside(vec3 p) { return 1.0 - smoothstep(uHalf - 2.0, uHalf, max(abs(p.x), abs(p.z))); }
float easeK(float k) { return k * k * (3.0 - 2.0 * k); }
vec3 birdAt(float t, out float flying, out float open) {
  vec3 perch = aPerch.xyz;
  float k1 = clamp((t - aTimes.x) / ${BIRD_LIFE.takeoff.toFixed(2)}, 0.0, 1.0), k2 = clamp((t - aTimes.y) / ${BIRD_LIFE.land.toFixed(2)}, 0.0, 1.0);
  flying = step(1e-4, k1) * (1.0 - step(0.9999, k2));
  open = smoothstep(0.0, 0.3, k1) * (1.0 - smoothstep(0.7, 1.0, k2));
  if (flying < 0.5) return perch;
  float ph = aTimes.z, dir = ph < 0.5 ? 1.0 : -1.0;
  float r = aCircle.w * (0.75 + 0.5 * fract(ph * 7.13));
  float a = ph * 6.2832 + dir * max(0.0, t - aTimes.x) * ${BIRD_LIFE.speed.toFixed(2)} / r;
  vec3 c = vec3(aCircle.x + cos(a) * r, aCircle.y + sin(t * 0.7 + ph * 9.0) * 0.6, aCircle.z + sin(a) * r);
  vec3 p = mix(perch, c, easeK(k1));
  p.y += sin(k1 * 3.14159) * 1.2;
  p = mix(p, perch, easeK(k2));
  p.y += sin(k2 * 3.14159) * 0.8;
  // A struck bird is knocked aside while it tumbles (sideways only: it never drops; birdPath in bird-life.js).
  float h = tumbleAt(t);
  if (h > 0.0) { float j = sin(h * 3.14159) * ${BIRD_SHOT.jolt.toFixed(2)}; p.x += cos(ph * 20.0) * j; p.z += sin(ph * 20.0) * j; }
  // Skywing passing through: the birds part around it and close up behind.
  if (uSky.w > 0.0) {
    vec3 d = p - uSky.xyz;
    float l = length(d);
    if (l < uSky.w) p += d / max(l, 0.05) * (uSky.w - l) * 0.85;
  }
  return p;
}
// Heading (xz) and the frame's position; perched birds face their own way and look about.
void birdFrame(out vec3 p, out vec2 fwd, out float flying, out float open) {
  float f2, o2;
  p = birdAt(uTime, flying, open);
  vec3 q = birdAt(uTime + 0.06, f2, o2);
  float ph = aTimes.z;
  vec2 rest = vec2(sin(ph * 6.2832), cos(ph * 6.2832));
  vec2 d = q.xz - p.xz;
  fwd = flying > 0.5 && dot(d, d) > 1e-6 ? normalize(d) : rest;
}
vec3 place(vec3 local, vec2 fwd, vec3 origin) {
  vec2 right = vec2(fwd.y, -fwd.x);
  return origin + vec3(right.x * local.x + fwd.x * local.z, local.y, right.y * local.x + fwd.y * local.z);
}
float birdShow(vec3 p, float flying) {
  float fog = fogAt(p);
  float seen = 1.0 - smoothstep(0.7, 0.85, fog);
  // Fog-of-war hint: a bird in the air shows above the fog.
  seen = max(seen, uHint * flying);
  // A bird about to brush the Hero camera shrinks away instead of filling the screen.
  return inside(p) * seen * step(0.001, aPerch.w) * smoothstep(1.5, 4.0, distance(p, cameraPosition));
}
uniform vec4 uFlight[6]; // per family: wingbeat rate, glide share, wing stretch, folded (1)
float flapAngle(float fam, float flying, float ph) {
  vec4 fl = uFlight[int(fam + 0.5)];
  float glide = smoothstep(0.5, 0.92, sin(uTime * 0.33 + ph * 3.1)) * fl.y;
  return flying * mix(sin(uTime * fl.x + ph * 7.0) * 0.85, 0.12, glide) * uAmp;
}`;

const CARD_VERTEX = /* glsl */ `${COMMON}
uniform vec3 uPal[18];
uniform float uCard[6];
attribute float aSpan;
attribute float aTip;
varying vec3 vColor;
void main() {
  vec3 p; vec2 fwd; float flying, open;
  birdFrame(p, fwd, flying, open);
  float fam = aTimes.w, ph = aTimes.z;
  int f = int(fam + 0.5);
  // A struck bird: wings out and flailing while it tumbles.
  float tk = tumbleAt(uTime);
  if (tk > 0.0) open = 1.0;
  float a = (tk > 0.0 ? sin(uTime * 34.0 + ph * 5.0) * 0.95 : flapAngle(fam, flying, ph)) * (1.0 + 0.45 * aSpan);
  vec3 local = position * aPerch.w * uCard[f];
  if (aSpan > 0.0) { local.x *= mix(0.22, 1.0, open); float x = local.x; local.x = x * cos(a); local.y += abs(x) * sin(a); }
  local = tumbleSpin(local, tk);
  local.y += 0.12 * aPerch.w;
  float show = birdShow(p, flying);
  vColor = mix(mix(uPal[f * 3], uPal[f * 3 + 1], step(0.01, aSpan)), uPal[f * 3 + 2], aTip) * mix(1.05, 0.8, clamp(abs(sin(a)) * aSpan, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(place(local * show, fwd, p), 1.0);
}`;
const CARD_FRAGMENT = /* glsl */ `varying vec3 vColor; void main() { gl_FragColor = vec4(vColor, 1.0); }`;

const NEAR_VERTEX = /* glsl */ `${COMMON}${WING_POSE}
#include <fog_pars_vertex>
uniform vec3 uHinge;   // shoulder (|x|, y, z)
uniform vec2 uNeck;    // neck pivot (y, z)
uniform vec3 uSun;
attribute vec3 _bird;  // wing side, span, head
varying vec3 vColor;
void main() {
  vec3 p; vec2 fwd; float flying, open;
  birdFrame(p, fwd, flying, open);
  float fam = aTimes.w, ph = aTimes.z;
  vec4 fl = uFlight[int(fam + 0.5)];
  vec3 local = position, n = normal;
  // A struck bird: wings out and flailing while it tumbles (and the whole bird rolls, below).
  float tk = tumbleAt(uTime);
  float flap = tk > 0.0 ? sin(uTime * 34.0 + ph * 5.0) * 0.95 : flapAngle(fam, flying, ph);
  // Folded-wing birds spread and stretch their wings in flight; open-wing birds fold theirs back along the body when
  // perched (WING_POSE in ambient-life.js, shared with the geese V).
  if (_bird.x != 0.0) local = wingPose(local, n, _bird, uHinge, fl.w, fl.z, tk > 0.0 ? 1.0 : open, flap);
  if (_bird.z > 0.5) {
    // Head: quick jerks left and right while perched, steady in flight.
    float yaw = (1.0 - flying) * 0.65 * sin(floor(uTime * 0.9 + ph * 5.0) * 2.3 + ph * 11.0) * uAmp;
    vec3 c = vec3(0.0, uNeck.x, uNeck.y);
    local = rotY(local - c, yaw) + c; n = rotY(n, yaw);
  }
  // A perched duck bobs on the water; a bird in the air banks into its turn.
  float bank = flying * open * (aTimes.z < 0.5 ? -0.32 : 0.32);
  local = rotZ(local, bank); n = rotZ(n, bank);
  if (tk > 0.0) { vec3 mid = vec3(0.0, 0.12, 0.0); local = tumbleSpin(local - mid, tk) + mid; n = tumbleSpin(n, tk); }
  float show = birdShow(p, flying);
  vec3 world = place(local * aPerch.w * show, fwd, p);
  vec2 right = vec2(fwd.y, -fwd.x);
  vec3 wn = normalize(vec3(right.x * n.x + fwd.x * n.z, n.y, right.y * n.x + fwd.y * n.z));
  float lit = 0.5 + 0.62 * max(dot(wn, uSun), 0.0) + 0.12 * wn.y;
  vColor = color * lit;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const NEAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const P = {};

export class BirdView {
  constructor(view) {
    this.view = view;
    view.birds = this; // H5: tests and probes reach the plugin here (class names are minified in a build)
    this.touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    this.level = "few";
    this.budget = birdBudget(this.touch, this.level);
    this.flocks = null;
    this.cards = null;
    this.near = new Map(); // family -> { mesh, rows } (detailed birds, Hero mode)
    this.models = null; // birds.glb meshes by family once loaded
    this.clock = 0;
    this.check = 0;
    this.roofs = new Set(); // building ids with a roof flock
    this.state = { flocks: 0, birds: 0, flying: 0, near: 0, nearDraws: 0, startles: 0, geese: 0, shots: 0, startled: 0, feathers: 0 }; // tests and probes
    // Birds under fire: drawn now (Birds on, detail on), the pick's reused result and fog test, the last shot's bird.
    this.shown = false;
    this.picked = {};
    this.spot = { x: 0, z: 0 };
    this.pickSim = null;
    this.seenAt = (x, z, flying) => {
      if (flying && this.uniforms?.uHint.value > 0) return true;
      this.spot.x = x; this.spot.z = z;
      return this.pickSim?.isVisible?.(this.spot) ?? true;
    };
    this.lastShot = { x: 0, y: 0, z: 0, species: "crow", birds: 0, flock: -1, bird: -1 };
    this.pickOpts = { from: null, reach: 0, seen: this.seenAt, sky: null, touch: this.touch }; // reused every frame
  }
  // The map's flocks and the card mesh (once per map: reset() drops them).
  build() {
    const v = this.view, t = v.terrain;
    if (!t) return false;
    const map = { id: t.id, half: t.half, rivers: t.river ? (t.rivers?.length ? t.rivers : [{ z: 0 }]) : [], heightAt: (x, z) => t.heightAt(x, z), at: (x, z) => t.at(x, z), tall: v.scatter?.tall || [] };
    this.budget = birdBudget(this.touch, this.level);
    this.flocks = new BirdFlocks(planFlocks(map, { touch: this.touch, level: this.level }));
    this.capacity = this.budget.flocks * 7 + this.budget.roofs * 5 + 1;
    const g = birdGeometry();
    const attr = (n) => new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * n), n).setUsage(THREE.DynamicDrawUsage);
    this.aPerch = attr(4); this.aTimes = attr(4); this.aCircle = attr(4); this.aHit = attr(1);
    this.aHit.array.fill(NEVER);
    g.setAttribute("aPerch", this.aPerch); g.setAttribute("aTimes", this.aTimes); g.setAttribute("aCircle", this.aCircle); g.setAttribute("aHit", this.aHit);
    g.instanceCount = 0;
    this.uniforms = {
      uTime: { value: 0 }, uAmp: { value: 1 }, uHalf: { value: t.half }, uHint: { value: 1 }, uFog: { value: v.fogTexture },
      uSky: { value: new THREE.Vector4() },
      uFlight: { value: SPECIES.map((s) => new THREE.Vector4(FLIGHT[s][0], FLIGHT[s][1], STRETCH[s] || 1, STRETCH[s] ? 1 : 0)) },
    };
    const pal = [];
    for (const s of SPECIES) for (const c of PALETTE[s]) pal.push(new THREE.Color().setHex(parseInt(c.slice(1), 16), THREE.LinearSRGBColorSpace));
    const material = new THREE.ShaderMaterial({ name: "BirdCards", uniforms: { ...this.uniforms, uPal: { value: pal }, uCard: { value: SPECIES.map((s) => SIZE_CARD[s]) } },
      vertexShader: CARD_VERTEX, fragmentShader: CARD_FRAGMENT, side: THREE.DoubleSide });
    this.cards = new THREE.Mesh(g, material);
    this.cards.name = "BirdCards";
    this.cards.frustumCulled = false;
    v.scene.add(this.cards);
    this.slots = []; // per flock: [first instance, count]
    for (const f of this.flocks.flocks) this.alloc(f);
    return true;
  }
  alloc(f) {
    const at = this.slots.length ? this.slots.at(-1)[0] + this.slots.at(-1)[1] : 0;
    if (at + f.birds.length > this.capacity) return false;
    this.slots[f.id] = [at, f.birds.length];
    this.cards.geometry.instanceCount = at + f.birds.length;
    this.write(f);
    return true;
  }
  // A flock's rows into the card buffers (and into its near rows when it is near).
  write(f, hidden = this.nearSet?.has(f.id)) {
    hidden ||= !!f.gone;
    const [at] = this.slots[f.id] || [];
    if (at === undefined) return;
    const fam = SPECIES_ID[f.species];
    f.birds.forEach((b, i) => {
      const k = at + i;
      this.aPerch.setXYZW(k, f.x + b.ox, f.y + b.oy, f.z + b.oz, hidden ? 0 : b.size);
      this.aTimes.setXYZW(k, b.start, b.landAt, b.phase, fam);
      this.aCircle.setXYZW(k, f.cx, f.y + f.climb, f.cz, f.radius);
      this.aHit.setX(k, b.hit ?? NEVER);
    });
    for (const a of [this.aPerch, this.aTimes, this.aCircle, this.aHit]) a.needsUpdate = true;
  }
  // Tests and screenshots (window.__frontier.view): a flock of `species` perched at (x, y, z). Returns its id.
  addFlock(species, x, y, z, n = 6, spread = 1.4) {
    if (!this.flocks && !this.build()) return -1;
    const birds = Array.from({ length: n }, (_, i) => ({ ox: Math.cos(i * 2.4) * spread * Math.sqrt((i + 0.5) / n), oy: 0, oz: Math.sin(i * 2.4) * spread * Math.sqrt((i + 0.5) / n), size: 1, phase: ((i * 0.618) % 1) }));
    const f = this.flocks.add({ species, kind: "ground", x, y, z, birds });
    if (!this.alloc(f)) { this.flocks.flocks.pop(); return -1; }
    return f.id;
  }
  // Startles from the battle: a shot's muzzle, a heavy round's landing. Hidden sources count only with the bird hint.
  // (A round past a bird, `ev.bird`, is the Hero mode page's: it calls shotBird first, then this sees the muzzle as for
  // any shot; it is no fight for the crows to circle.)
  event(ev, sim) {
    if (ev.type !== "shot" || !this.flocks || !this.lively) return;
    const hint = this.view.settings?.birdHint !== false;
    const hiddenAt = (x, z) => !(sim?.isVisible?.({ x, z }) ?? true);
    // The fight first: crows startled by this shot take off toward it (their circle is fixed at take-off).
    if (!ev.bird && Number.isFinite(ev.tx) && !hiddenAt(ev.tx, ev.tz)) this.flocks.fought(ev.tx, ev.tz, this.clock);
    const muzzle = hiddenAt(ev.x, ev.z);
    if (!muzzle || hint) this.state.startles += this.flocks.startle(ev.x, ev.z, BIRD_LIFE.reach.shot, this.clock, { hidden: muzzle });
    if (ev.heavy && Number.isFinite(ev.tx)) {
      const land = hiddenAt(ev.tx, ev.tz);
      if (!land || hint) this.state.startles += this.flocks.startle(ev.tx, ev.tz, BIRD_LIFE.reach.blast, this.clock, { hidden: land });
    }
  }
  // Hero mode (src/hero-mode.js aimNow): the bird under the crosshair, or null. `ray` the camera ray through it, `from`
  // the shooter (its ground x/z) and `reach` its weapon's (ground metres). Null with Birds Off, detail off, or nothing
  // seen in reach; never the hawk. The result is one reused object (read it before the next pick).
  pick(ray, from, reach, sim) {
    if (!this.flocks || !this.shown || !ray) return null;
    this.pickSim = sim;
    const o = this.pickOpts;
    o.from = from; o.reach = reach; o.sky = this.uniforms.uSky.value;
    return pickBird(this.flocks.flocks, ray, this.clock, o, this.picked);
  }
  // Hero mode: the hero's round (shot event `ev`, its `bird` set; tx/tz the bird's ground point, tAir its height) whizzes
  // past the bird the page picked (`pick` = { flock, bird }; when that bird is no longer there, the one nearest the
  // round's end within 3 m): it tumbles as the round arrives, its flock bursts off in the ripple from it and circles away
  // from `from` (the shooter), feathers puff. Returns the bird's place and family and how many birds took off (the
  // reused this.lastShot), or null (no bird there, Birds Off, detail off).
  shotBird(pick, ev, from = null) {
    if (!this.flocks || !this.shown || !ev) return null;
    const t = this.view.terrain, ty = (t?.heightAt(ev.tx, ev.tz) ?? 0) + (ev.tAir || 0), at = SHOT_AT;
    let f = pick ? this.flocks.flocks[pick.flock] : null, i = pick?.bird ?? -1;
    if (f && f.birds[i]) { birdPath(f, f.birds[i], this.clock, at); if (Math.hypot(at.x - ev.tx, at.y - ty, at.z - ev.tz) > 8) f = null; } else f = null;
    if (!f) {
      let best = 3;
      for (const g of this.flocks.flocks) for (let k = 0; k < g.birds.length; k++) {
        const q = birdPath(g, g.birds[k], this.clock, NEAREST), d = Math.hypot(q.x - ev.tx, q.y - ty, q.z - ev.tz);
        if (d < best) { best = d; f = g; i = k; }
      }
      if (!f) return null;
    }
    // The round reaches the bird after its flight (the effects' own time for it).
    const delay = Math.min(0.3, Math.max(0.05, weaponStyle(ev)?.life ?? 0.14)), when = this.clock + delay, calm = !this.lively;
    const n = this.flocks.shotAt(f.id, i, when, { from, calm, half: t?.half ?? Infinity });
    if (!n) return null;
    this.state.shots++;
    this.state.startled += n;
    const p = birdPath(f, f.birds[i], when, SHOT_AT), y = p.y + BIRD_SHOT.pick.lift * (f.birds[i].size || 1);
    if (!calm) this.puff(p.x, y, p.z, f.species, delay);
    return Object.assign(this.lastShot, { x: p.x, y, z: p.z, species: f.species, birds: n, flock: f.id, bird: i });
  }
  // A puff of feathers in the family's colours where the round passed, `delay` s from now: a few slow, spinning, falling
  // feathers and a soft burst of down, on the effects' own pooled particles (no draw added, the view's generator).
  puff(x, y, z, species, delay = 0) {
    const fx = this.view.fx;
    if (!fx?.particle || !fx.smoke) return;
    const tones = FEATHER_TONES[species] || FEATHER_TONES.crow, rng = fx.rng, n = fx.count(16);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, up = 0.4 + rng() * 0.8, v = 1.1 + rng() * 1.4, [c0, c1] = tones[i % 2];
      fx.particle(fx.smoke, { x, y, z, lifted: true, vx: Math.cos(a) * v, vy: up, vz: Math.sin(a) * v, gravity: 1.2, drag: 2.6,
        life: 1.3 + rng() * 0.9, s0: 0.36, s1: 0.28, cell: CELL.streak, mode: BILLBOARD, rot: rng() * 6.28, spin: (rng() - 0.5) * 9,
        c0, c1, hold: 0.55, delay, anchor: null });
    }
    const down = DOWN[species] || DOWN.crow;
    fx.particle(fx.smoke, { x, y, z, lifted: true, cell: CELL.puff, s0: 0.45, s1: 1.2, life: 0.5, c0: down[0], c1: down[1], delay, anchor: null });
    this.state.feathers += n;
  }
  update(sim, dt) {
    const v = this.view;
    this.shown = false;
    if (!sim?.entities || !v.terrain) return;
    const s = v.settings || {}, share = v.lifeShare ?? 1;
    // Settings > Hero > Birds: a new level plans the flocks again; Off draws none.
    const level = BIRD_LEVELS.includes(s.birds) ? s.birds : "few";
    if (level !== this.level) { if (this.flocks) this.reset(); this.level = level; }
    if (level === "off") { this.geese(share); return; }
    if (!this.flocks && !this.build()) return;
    const shown = s.detail !== false && share > 0;
    this.lively = shown && (v.motionLevel ?? 2) > 0 && !v.reducedMotion?.matches;
    this.cards.visible = shown;
    if (!shown) { for (const n of this.near.values()) n.mesh.visible = false; return; }
    this.shown = true;
    // Quiet (reduced motion, the still level): the clock still runs while a flock is up (one shot off its perch by the
    // hero leaves calmly and comes back), and stops again once every bird has perched.
    if ((this.lively || this.flocks.flying > 0) && dt > 0) this.clock = (this.clock + Math.min(0.05, dt)) % 3000;
    const U = this.uniforms;
    U.uTime.value = this.clock;
    U.uAmp.value = this.lively ? [0, 0.5, 1][v.motionLevel ?? 2] : 0;
    U.uHint.value = s.birdHint !== false ? 1 : 0;
    U.uFog.value = v.fogTexture;
    this.sky(sim);
    this.check -= dt > 0 ? dt : 0;
    if (this.check <= 0) {
      this.check = 0.25;
      if (this.lively) this.walkers(sim, s.birdHint !== false);
      this.roof(sim);
      this.flocks.step(this.clock);
      this.pickNear(share >= 1);
    }
    for (const id of this.flocks.dirty) { const f = this.flocks.flocks[id]; this.write(f); if (this.nearSet?.has(id)) this.nearDirty = true; }
    this.flocks.dirty.clear();
    if (this.nearDirty) this.fillNear();
    this.geese(share);
    this.state.flocks = this.flocks.flocks.length;
    this.state.birds = this.cards.geometry.instanceCount;
    this.state.flying = this.flocks.flying;
  }
  // Perched flocks take off when a unit walks within reach (hidden units only with the bird hint).
  walkers(sim, hint) {
    const reach = BIRD_LIFE.reach.unit;
    for (const f of this.flocks.flocks) {
      if (f.state !== "perched") continue;
      for (const e of sim.entities) {
        if (e.kind !== "unit" || !(e.hp > 0) || e.flying && (e.fly || 0) > 6) continue;
        if (Math.abs(e.x - f.x) > reach || Math.abs(e.z - f.z) > reach || Math.hypot(e.x - f.x, e.z - f.z) > reach) continue;
        const hidden = !(sim.isVisible?.(e) ?? true);
        if (hidden && !hint) continue;
        this.state.startles += this.flocks.startle(e.x, e.z, reach, this.clock, { hidden, perchedOnly: true });
        break;
      }
    }
  }
  // Crows settle on the roofs of finished buildings the player has seen (up to the roof budget, once per building).
  roof(sim) {
    if (this.roofs.size >= this.budget.roofs) return;
    for (const e of sim.entities) {
      if (this.roofs.size >= this.budget.roofs) break;
      if (e.kind !== "building" || !e.complete || !(e.hp > 0) || this.roofs.has(e.id)) continue;
      const o = this.view.objects?.get(e.id);
      if (!o?.visible || !o.userData.model) continue;
      this.roofs.add(e.id);
      const box = new THREE.Box3().setFromObject(o.userData.model);
      if (box.isEmpty()) continue;
      const f = this.flocks.add(roofFlock(e.id, e.x, box.max.y - 0.05, e.z, e.radius || 2, this.level === "many" ? 5 : 3));
      if (!this.alloc(f)) this.flocks.flocks.pop();
    }
  }
  // Skywing in the air: birds part around it and close up behind it.
  sky(sim) {
    const sw = sim.skywing, e = sw?.id != null ? sim.get?.(sw.id) : null;
    const up = !!(e && e.hp > 0 && e.flying !== false && (e.fly || 0) > 1.5);
    const U = this.uniforms.uSky.value;
    if (!up) { U.w = 0; return; }
    U.set(e.x, this.view.terrain.heightAt(e.x, e.z) + (e.fly || 3), e.z, 6.5);
  }
  // Hero mode: the flocks nearest the camera get the detailed birds (up to the budget), loaded on first use.
  pickNear(allowed) {
    const v = this.view, on = allowed && v.heroCameraOn && v.heroEye;
    if (!on) { if (this.nearSet?.size) { const was = this.nearSet; this.nearSet = new Set(); for (const id of was) this.write(this.flocks.flocks[id], false); this.nearDirty = true; } return; }
    if (!this.models) { this.load(); return; }
    const eye = v.heroEye, limit = NEAR[this.touch ? "touch" : "pc"];
    const ranked = [];
    for (const f of this.flocks.flocks) {
      const x = f.state === "perched" ? f.x : f.cx, z = f.state === "perched" ? f.z : f.cz, y = f.state === "perched" ? f.y : f.y + f.climb;
      const d = Math.hypot(x - eye.x, y - eye.y, z - eye.z);
      // A flock already near keeps its detailed birds until it is 4 m past the limit, so a flock circling at the edge
      // does not swap between cards and models (it blinked).
      const keep = this.nearSet?.has(f.id) ? 4 : 0;
      if (!f.gone && d < limit + keep + (f.state === "perched" ? 0 : f.radius) && this.models.has(f.species)) ranked.push([d - keep, f]);
    }
    ranked.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    const next = new Set();
    let birds = 0;
    for (const [, f] of ranked) { if (birds + f.birds.length > this.budget.near) continue; next.add(f.id); birds += f.birds.length; }
    const was = this.nearSet || new Set();
    if (next.size === was.size && [...next].every((id) => was.has(id))) return;
    this.nearSet = next;
    for (const id of new Set([...was, ...next])) this.write(this.flocks.flocks[id], next.has(id));
    this.nearDirty = true;
  }
  // The Expanse geese V (ambient-life.js) flies as the detailed goose in Hero mode: birds.glb's goose_lod (at most 400
  // triangles) in place of the cards, one draw either way. The RTS view keeps the cards: from its camera a goose is
  // 12-17 CSS px across, seen from above, where the card's silhouette already reads, and it never fetches birds.glb. A
  // thinned frame budget (governor share < 1) hands the cards back.
  geese(share) {
    const v = this.view, life = v.life;
    if (life?.plan?.look !== "goose") { this.state.geese = 0; return; }
    const want = !!(v.heroCameraOn && share >= 1);
    if (want && !this.models) this.load();
    const on = life.gooseModel(want ? this.models?.get("goose_lod") || null : null, { size: SIZE_CARD.goose });
    this.state.geese = on ? life.geese.mesh.geometry.instanceCount : 0;
  }
  load() {
    if (this.loading) return;
    this.loading = modelLoader().loadAsync(`${import.meta.env?.BASE_URL ?? "./"}models/birds.glb`).then((gltf) => {
      const models = new Map();
      gltf.scene.traverse((o) => { if (o.isMesh && (SPECIES.includes(o.name) || o.name === "goose_lod")) models.set(o.name, o); });
      this.models = models;
    }).catch(() => { this.models = new Map(); });
  }
  // The detailed birds' instance rows: one mesh per family with near birds, the rest hidden.
  fillNear() {
    this.nearDirty = false;
    const counts = new Map();
    for (const id of this.nearSet || []) {
      const f = this.flocks.flocks[id], n = this.nearMesh(f.species);
      if (!n) continue;
      let k = counts.get(f.species) || 0;
      const fam = SPECIES_ID[f.species];
      for (const b of f.birds) {
        if (k >= n.capacity) break;
        n.aPerch.setXYZW(k, f.x + b.ox, f.y + b.oy, f.z + b.oz, b.size);
        n.aTimes.setXYZW(k, b.start, b.landAt, b.phase, fam);
        n.aCircle.setXYZW(k, f.cx, f.y + f.climb, f.cz, f.radius);
        n.aHit.setX(k, b.hit ?? NEVER);
        k++;
      }
      counts.set(f.species, k);
    }
    let near = 0, draws = 0;
    for (const [species, n] of this.near) {
      const k = counts.get(species) || 0;
      n.mesh.geometry.instanceCount = k;
      n.mesh.visible = k > 0;
      for (const a of [n.aPerch, n.aTimes, n.aCircle, n.aHit]) a.needsUpdate = true;
      near += k; draws += k > 0 ? 1 : 0;
    }
    this.state.near = near; this.state.nearDraws = draws;
  }
  nearMesh(species) {
    if (this.near.has(species)) return this.near.get(species);
    const src = this.models?.get(species);
    if (!src) return null;
    const g = new THREE.InstancedBufferGeometry(), sg = src.geometry;
    for (const name of ["position", "normal", "color", "_bird"]) if (sg.getAttribute(name)) g.setAttribute(name, sg.getAttribute(name));
    if (sg.index) g.setIndex(sg.index);
    const capacity = this.budget.near;
    const attr = (n) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(THREE.DynamicDrawUsage);
    const n = { capacity, aPerch: attr(4), aTimes: attr(4), aCircle: attr(4), aHit: attr(1) };
    n.aHit.array.fill(NEVER);
    g.setAttribute("aPerch", n.aPerch); g.setAttribute("aTimes", n.aTimes); g.setAttribute("aCircle", n.aCircle); g.setAttribute("aHit", n.aHit);
    g.instanceCount = 0;
    const x = src.userData || {};
    const material = new THREE.ShaderMaterial({
      name: `Bird:${species}`,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...this.uniforms,
        uHinge: { value: new THREE.Vector3(...(x.hinge || [0, 0, 0])) }, uNeck: { value: new THREE.Vector2(...(x.neck || [0, 0])) }, uSun: { value: SUN } },
      vertexShader: NEAR_VERTEX, fragmentShader: NEAR_FRAGMENT, vertexColors: true, fog: true, side: THREE.DoubleSide,
    });
    n.mesh = new THREE.Mesh(g, material);
    n.mesh.name = `Birds:${species}`;
    n.mesh.frustumCulled = false;
    n.mesh.visible = false;
    this.view.scene.add(n.mesh);
    this.near.set(species, n);
    return n;
  }
  reset() {
    const scene = this.view.scene;
    if (this.cards) { scene.remove(this.cards); this.cards.geometry.dispose(); this.cards.material.dispose(); this.cards = null; }
    for (const n of this.near.values()) { scene.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh.material.dispose(); }
    this.near.clear();
    this.flocks = null; this.nearSet = null;
    this.roofs.clear();
    this.clock = 0;
    this.state = { flocks: 0, birds: 0, flying: 0, near: 0, nearDraws: 0, startles: 0, geese: 0, shots: 0, startled: 0, feathers: 0 };
  }
}
export { NEVER };
