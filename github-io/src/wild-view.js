// Wild frontier, P1 (AAA round 4): what the desert test draws (sim/content/wild-frontier.js). A view
// plugin (docs/VIEW_PLUGINS.md), so view.js is not edited. Nothing is built until a match has
// `sim.wild`, and every match without it draws exactly as before.
//
// Draws (lightweight-game-objects / smooth-dense-scenes rules: shared geometry, procedural shaders, no
// textures, nothing per frame but uniforms and a few matrices):
//   Weather Spire       1  one merged stone mesh with baked vertex colours (the crystal on top is in the
//                          same mesh; the holder's colour is on the capture ring that is already there)
//   Nest                1  a ground ring with the taming arc in the taker's colour
//   Storm (while one)   2  a ground disc (warning sweep, then the storm's floor haze) and a wall of
//                          scrolling sand (an open cylinder, one shader, no texture): about 2x overdraw
//                          inside the storm, 1x on Eco (the wall's inner face is skipped)
//   Ripple (Ambush)     1  per diving Wyrm, only for its 1.5 s
//   Aim preview         1  only while the player aims the Sandstorm
// The nest guards' sand tint is a copy of the Wyrmling's team template for the wild side (WILD_TEAM).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WILD_TEAM } from "./sim/constants.js";
import { WILD, wildLand } from "./sim/content/wild-frontier.js";

const SAND = 0xe6b26a, NEST = 0x8f3a14, WARN = 0xff8a3d, WILD_PAINT = 0xc98a4a;

const DISC_VERTEX = `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// A ground disc: the edge ring, a sweep that fills it over the warning (uFill 0..1), the storm's haze
// (uHaze) and, for the nest, a progress arc (uArc 0..1) in uArcColor.
const DISC_FRAGMENT = `
uniform vec3 uColor; uniform vec3 uArcColor; uniform float uFill; uniform float uHaze; uniform float uArc; uniform float uPulse; uniform float uTime;
varying vec2 vUv;
void main(){
  float r = length(vUv);
  if (r > 1.0) discard;
  float edge = smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.97, 1.0, r));
  float a = edge * (0.55 + 0.45 * uPulse);
  // The warning sweep fills from the edge to the centre.
  a = max(a, step(1.0 - uFill, r) * 0.28 * (1.0 - r * 0.3));
  // Haze: soft, slowly turning streaks of sand.
  float ang = atan(vUv.y, vUv.x);
  float streak = 0.5 + 0.5 * sin(ang * 7.0 + r * 9.0 - uTime * 1.7) * sin(ang * 3.0 - uTime * 0.9);
  a = max(a, uHaze * (0.22 + 0.18 * streak) * smoothstep(1.0, 0.75, r));
  vec3 c = uColor;
  if (uArc > 0.0) {
    float t = fract((ang + 1.5707963) / 6.2831853);
    float arc = step(t, uArc) * smoothstep(0.74, 0.8, r) * (1.0 - smoothstep(0.84, 0.86, r));
    c = mix(c, uArcColor, arc);
    a = max(a, arc * 0.95);
  }
  gl_FragColor = vec4(c, a);
}`;
const WALL_VERTEX = `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// The storm wall: value noise scrolled round and up, thick near the ground, gone at the top.
const WALL_FRAGMENT = `
uniform vec3 uColor; uniform float uTime; uniform float uAlpha;
varying vec2 vUv; varying float vY;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec2 p = vec2(vUv.x * 18.0 - uTime * 1.3, vUv.y * 3.0 - uTime * 0.6);
  float v = 0.6 * n(p) + 0.4 * n(p * 2.3 + 4.1);
  float a = uAlpha * smoothstep(0.25, 0.75, v) * (1.0 - smoothstep(0.15, 1.0, vUv.y)) ;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor * (0.85 + 0.3 * v), a);
}`;

function disc(color, renderOrder = 3) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uArcColor: { value: new THREE.Color(SAND) }, uFill: { value: 0 }, uHaze: { value: 0 }, uArc: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 } },
    vertexShader: DISC_VERTEX, fragmentShader: DISC_FRAGMENT, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = renderOrder;
  return mesh;
}

// The Weather Spire: a weathered sandstone obelisk on a low plinth, four leaning standing stones and a
// crystal cradle on top, merged into one mesh with baked vertex colours.
function spireMesh() {
  const parts = [];
  const add = (geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geometry.rotateX(rx); geometry.rotateY(ry); geometry.rotateZ(rz); geometry.translate(x, y, z);
    const c = new THREE.Color(color), n = geometry.attributes.position.count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // A little baked shade: darker at the foot.
      const k = 0.72 + 0.28 * Math.min(1, Math.max(0, geometry.attributes.position.getY(i) / 6));
      colors[i * 3] = c.r * k; colors[i * 3 + 1] = c.g * k; colors[i * 3 + 2] = c.b * k;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
  };
  add(new THREE.CylinderGeometry(2.3, 2.7, 0.5, 10), 0xc98d55, 0, 0.25);
  add(new THREE.CylinderGeometry(0.55, 0.95, 5.2, 6), 0xe0a866, 0, 3.0);
  add(new THREE.CylinderGeometry(0.9, 0.6, 0.45, 6), 0xa8471f, 0, 5.7);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    add(new THREE.BoxGeometry(0.55, 2.1, 0.4), 0xd39a5c, Math.cos(a) * 2.0, 1.1, Math.sin(a) * 2.0, 0, -a, (i % 2 ? 0.18 : -0.18));
  }
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    add(new THREE.ConeGeometry(0.16, 1.1, 5), 0xa8471f, Math.cos(a) * 0.62, 6.25, Math.sin(a) * 0.62, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  // The crystal: pale gold in the same mesh (the holder's colour is on the capture ring around the Spire).
  const crystal = new THREE.OctahedronGeometry(0.62, 0);
  crystal.scale(1, 1.6, 1);
  add(crystal, 0xfff0c4, 0, 6.9);
  const geometry = mergeGeometries(parts, false);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = false;
  return mesh;
}

export class WildView {
  constructor(view) {
    this.view = view;
    this.built = null;
    this.ripples = new Map();
    this.time = 0;
    // The player's aim (app/wild-ui.js): { x, z } or null.
    view.wildAim = null;
  }
  reset() {
    this.clear();
  }
  clear() {
    if (!this.built) return;
    for (const o of this.built.objects) { this.view.scene.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    for (const r of this.ripples.values()) { this.view.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    this.ripples.clear();
    this.built = null;
  }
  ground(x, z) {
    const t = this.view.terrain;
    return t?.plateaus?.length ? t.heightAt(x, z) : 0;
  }
  build(sim) {
    const scene = this.view.scene, spire = sim.skirmishPoints.spire, nest = sim.wild.nest, objects = [];
    const stone = spireMesh();
    stone.position.set(spire.x, this.ground(spire.x, spire.z), spire.z);
    // The nest reads as a rust-red hollow in the sand with a bright rim (sand on sand would vanish).
    const nestRing = disc(NEST);
    nestRing.material.uniforms.uFill.value = 1;
    if (nest) { nestRing.position.set(nest.x, this.ground(nest.x, nest.z) + 0.11, nest.z); nestRing.scale.setScalar(nest.r); }
    nestRing.visible = !!nest;
    const floor = disc(WARN, 4), wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.06, 1, 40, 1, true),
      new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(SAND) }, uTime: { value: 0 }, uAlpha: { value: 0 } }, vertexShader: WALL_VERTEX, fragmentShader: WALL_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    wall.geometry.translate(0, 0.5, 0);
    wall.renderOrder = 5;
    floor.visible = wall.visible = false;
    const aim = disc(SAND, 6);
    aim.visible = false;
    for (const o of [stone, nestRing, floor, wall, aim]) { scene.add(o); objects.push(o); }
    this.built = { sim, stone, nestRing, floor, wall, aim, objects };
  }
  // The guards' sand-tinted template (team WILD_TEAM), copied from the Wyrmling's first team variant once it is loaded.
  wildTemplate(sim) {
    const v = this.view, land = wildLand(sim), key = `${land.guard}-${WILD_TEAM}`;
    if (!v.teamTemplates || v.teamTemplates.has(key) || !v.teamTemplates.has(`${land.guard}-0`)) return;
    const variant = v.teamTemplates.get(`${land.guard}-0`).clone(true), paints = new Map();
    variant.traverse((o) => {
      if (!o.isMesh || !o.material?.name?.startsWith("Team")) return;
      // Renamed off "Team": view.applySettings recolours every Team* material by the key's last number (it would read "-2" as team 2).
      if (!paints.has(o.material)) { const m = o.material.clone(); m.name = "WildPaint"; m.userData = {}; m.color.setHex(WILD_PAINT); m.emissive?.setHex?.(0); paints.set(o.material, m); }
      o.material = paints.get(o.material);
    });
    v.teamTemplates.set(key, variant);
  }
  update(sim, dt) {
    if (!sim.wild) { if (this.built) this.clear(); return; }
    if (this.built?.sim !== sim) { this.clear(); this.build(sim); }
    this.time += dt;
    const b = this.built, v = this.view, colors = v.colors || [], still = !!v.lowPower || !!v.reducedMotion?.matches;
    this.wildTemplate(sim);
    // The tamed Wyrm's model is fetched in the background as soon as a Wild match is on screen.
    const land = wildLand(sim);
    if (!this.asked && v.models && !v.models.has(land.creature)) { this.asked = true; v.preloadModels?.([land.creature]); }
    // The nest: its ring, and the taming arc in the taker's colour.
    const nest = sim.wild.nest;
    if (nest) {
      const u = b.nestRing.material.uniforms;
      u.uArc.value = nest.state === "open" && nest.taker !== null ? Math.max(0.02, nest.since / WILD.nest.tame) : 0;
      if (nest.taker !== null) u.uArcColor.value.setHex(colors[nest.taker] ?? SAND);
      u.uPulse.value = nest.state === "open" && !still ? 0.5 + 0.5 * Math.sin(this.time * 3) : nest.state === "open" ? 1 : 0.2;
      b.nestRing.visible = sim.isExplored(nest);
    }
    // The storm: warning sweep, then the floor haze and the sand wall. Both sides see it.
    const storm = sim.wild.storms.find((s) => sim.time < s.until);
    b.floor.visible = b.wall.visible = !!storm;
    if (storm) {
      const y = this.ground(storm.x, storm.z), warn = sim.time < storm.at, u = b.floor.material.uniforms, w = b.wall.material.uniforms;
      b.floor.position.set(storm.x, y + 0.13, storm.z);
      b.floor.scale.setScalar(storm.r);
      u.uColor.value.setHex(warn ? WARN : SAND);
      u.uFill.value = warn ? 1 - (storm.at - sim.time) / WILD.spire.warn : 0;
      u.uHaze.value = warn ? 0 : 1;
      u.uPulse.value = warn && !still ? 0.5 + 0.5 * Math.sin(this.time * 9) : 0.6;
      u.uTime.value = still ? 0 : this.time;
      // The wall rises in 0.6 s and falls in the storm's last second.
      const grow = warn ? 0 : Math.min(1, (sim.time - storm.at) / 0.6) * Math.min(1, (storm.until - sim.time) / 1);
      b.wall.visible = grow > 0.01;
      b.wall.position.set(storm.x, y, storm.z);
      b.wall.scale.set(storm.r, 6 * grow, storm.r);
      w.uAlpha.value = (v.lowPower ? 0.5 : 0.62) * grow;
      w.uTime.value = still ? 0 : this.time;
      b.wall.material.side = v.lowPower ? THREE.FrontSide : THREE.DoubleSide;
    }
    // The player's aim preview.
    const aim = v.wildAim;
    b.aim.visible = !!aim;
    if (aim) {
      b.aim.position.set(aim.x, this.ground(aim.x, aim.z) + 0.14, aim.z);
      b.aim.scale.setScalar(WILD.sandstorm.radius);
      b.aim.material.uniforms.uPulse.value = still ? 1 : 0.5 + 0.5 * Math.sin(this.time * 6);
      b.aim.material.uniforms.uHaze.value = 0.5;
      b.aim.material.uniforms.uTime.value = this.time;
    }
    // Ripples under a diving Wyrm's target, until it bursts up.
    for (const [id, r] of this.ripples) {
      if (sim.time < r.at && sim.get(id)?.burrow) {
        r.mesh.material.uniforms.uFill.value = 1 - (r.at - sim.time) / r.delay;
        r.mesh.material.uniforms.uPulse.value = still ? 1 : 0.5 + 0.5 * Math.sin(this.time * 14);
        continue;
      }
      v.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose();
      this.ripples.delete(id);
    }
  }
  event(ev, sim) {
    if (ev.type !== "wild" || !this.built) return;
    const fx = this.view.fx;
    if (ev.kind === "burrow") {
      const mesh = disc(WARN, 4);
      mesh.position.set(ev.tx, this.ground(ev.tx, ev.tz) + 0.12, ev.tz);
      mesh.scale.setScalar(ev.radius);
      this.view.scene.add(mesh);
      const old = this.ripples.get(ev.id);
      if (old) { this.view.scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
      this.ripples.set(ev.id, { mesh, at: ev.at, delay: Math.max(0.1, ev.at - sim.time) });
      fx?.dust?.({ x: ev.x, y: 0.3, z: ev.z }, 6, { x: ev.x, z: ev.z, team: ev.team }, 1.2);
    } else if (ev.kind === "ambush") {
      const anchor = { x: ev.x, z: ev.z, team: ev.team };
      fx?.dust?.({ x: ev.x, y: 0.4, z: ev.z }, 14, anchor, 1.8, 1.4);
      fx?.shockwave?.({ x: ev.x, z: ev.z }, ev.radius * 2, anchor);
      fx?.addDebris?.({ x: ev.x, y: 0.5, z: ev.z }, 8, anchor, 1.2);
    } else if (ev.kind === "stormStart") {
      fx?.dust?.({ x: ev.x, y: 0.6, z: ev.z }, 16, { x: ev.x, z: ev.z, team: ev.team }, 3, 1.6);
    } else if (ev.kind === "tamed") {
      fx?.dust?.({ x: ev.x, y: 0.5, z: ev.z }, 12, { x: ev.x, z: ev.z, team: ev.team }, 1.6);
    }
  }
}
