import * as THREE from "three";

// Selection presentation: ground rings, vitals bars and command markers. Shader colours are
// written unconverted (no tone mapping or colour-space transform), so team colours match
// their settings swatches exactly.
const PLAIN = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const raw = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

// Ground ring: bright core, soft halo, faint footprint disc and a slowly rotating dashed band
// that appears only when selected. `appear` animates the lock-on (fade and scale in).
const RING = `
varying vec4 vShape, vState, vTint;
#define flash vTint.a
#define color vTint.rgb
#define radius vShape.x
#define appear vShape.y
#define strength vShape.z
#define selected vShape.w
#define time vState.x
#define px vState.y
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * (radius + 0.9);
  float r = length(p), a = atan(p.y, p.x), w = fwidth(r);
  float edge = radius + 0.28;
  // px: world units per screen pixel. The line never gets thinner than about 2.5 px.
  float thick = max(0.045, px * 1.25);
  float core = 1.0 - smoothstep(thick, thick + w * 1.5, abs(r - edge));
  float halo = exp(-pow((r - edge) / max(0.24, px * 4.5), 2.0)) * 0.45;
  float disc = (1.0 - smoothstep(edge - 0.12, edge, r)) * 0.12;
  float segments = floor(radius * 5.0 + 8.0);
  float band = 1.0 - smoothstep(thick * 0.8, thick * 0.8 + w * 1.5, abs(r - edge - 0.3));
  float dash = step(0.45, fract(a / 6.2831853 * segments + time * 0.07)) * band;
  float alpha = (core + halo + disc + dash * selected * 0.9) * strength * appear;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(mix(color, vec3(1.0), max(flash, core * 0.35 * selected)), min(1.0, alpha));
}`;

export function createRing(radius, hex) {
  const ring = new THREE.Object3D();
  ring.userData.radius = radius;
  ring.userData.color = raw(hex);
  ring.rotation.x = -Math.PI / 2;
  // Clear of the ground, the start pads (top 0.045) and building base plates (up to 0.080) and below unit feet (from 0.093):
  // a ring level with a plate z-fights and the footprint blinks.
  ring.position.y = 0.088;
  ring.renderOrder = 3;
  ring.visible = false;
  ring.userData.appear = 0;
  return ring;
}

// Advance a ring: selected rings lock on over 0.2 s; hover shows a dim ring without dashes.
export function updateRing(ring, selected, hovered, time, dt, unitsPerPixel = 0) {
  // R3-B: view plugins (the follow tether) read who is selected from the ring.
  ring.userData.selected = !!selected;
  const on = selected || hovered;
  const target = on ? 1 : 0;
  ring.userData.appear = dt > 0 ? Math.min(1, Math.max(0, ring.userData.appear + Math.sign(target - ring.userData.appear) * dt * 5)) : target;
  if (!on) ring.userData.appear = 0;
  ring.visible = on;
  if (!on) return;
  const u = ring.userData, t = u.appear;
  u.px = unitsPerPixel;
  u.time = time;
  u.strength = selected ? 1 : 0.5;
  ring.scale.setScalar(1 + (1 - t) * 0.35);
}

// Vitals: framed plate, team tab, segmented health (green / amber / red) with a pale damage
// ghost, shield bar and, on buildings, three level pips (and, left of them, the ranks of a
// Frontier Defence branch, 0.24, in pale gold). One instance per visible plate.
const BAR = `
varying vec4 vShape, vState, vTint;
#define hp vShape.x
#define ghost vShape.y
#define shield vShape.z
#define segments vShape.w
#define hasShield vState.x
#define level vState.y
#define building vState.z
#define rank vState.w
#define team vTint.rgb
#define flash vTint.a
varying vec2 vUv;
float rect(vec2 p, vec2 a, vec2 b) {
  vec2 w = max(fwidth(p), vec2(1e-4));
  vec2 s = smoothstep(a - w * 0.5, a + w * 0.5, p) * (1.0 - smoothstep(b - w * 0.5, b + w * 0.5, p));
  return s.x * s.y;
}
void main() {
  vec2 size = vec2(building > 0.5 ? 3.6 : 2.3, building > 0.5 ? 0.62 : (hasShield > 0.5 ? 0.39 : 0.29));
  vec2 p = vUv * size;
  float pad = 0.05, tab = 0.12;
  float top = pad + (hasShield > 0.5 ? 0.29 : 0.19);
  vec4 col = vec4(0.0);
  float plate = rect(p, vec2(0.0), vec2(size.x, top + pad));
  col = mix(col, vec4(0.62, 0.72, 0.68, 0.55), plate);
  col = mix(col, vec4(0.03, 0.065, 0.065, 0.9), rect(p, vec2(0.018), vec2(size.x - 0.018, top + pad - 0.018)));
  col = mix(col, vec4(team, 1.0), rect(p, vec2(pad), vec2(pad + tab, top)));
  float x0 = pad + tab + 0.05, x1 = size.x - pad, width = x1 - x0, fx = (p.x - x0) / width;
  float bar = rect(p, vec2(x0, pad), vec2(x1, pad + 0.17));
  vec3 health = mix(vec3(0.95, 0.27, 0.2), vec3(1.0, 0.76, 0.24), smoothstep(0.22, 0.4, hp));
  health = mix(health, vec3(0.36, 0.88, 0.42), smoothstep(0.5, 0.7, hp));
  float shade = 0.82 + 0.3 * (p.y - pad) / 0.17;
  col = mix(col, vec4(0.1, 0.14, 0.13, 1.0), bar);
  col = mix(col, vec4(1.0, 0.94, 0.8, 1.0), bar * step(fx, ghost));
  col = mix(col, vec4(health * shade, 1.0), bar * step(fx, hp));
  float step50 = width / segments;
  float tick = bar * (1.0 - smoothstep(0.012, 0.03, mod(p.x - x0, step50))) * step(0.02, p.x - x0);
  col.rgb = mix(col.rgb, vec3(0.02, 0.05, 0.05), tick * 0.75);
  if (hasShield > 0.5) {
    float sb = rect(p, vec2(x0, pad + 0.205), vec2(x1, pad + 0.275));
    col = mix(col, vec4(0.09, 0.16, 0.2, 1.0), sb);
    col = mix(col, vec4(0.42, 0.86, 1.0, 1.0), sb * step(fx, shield));
  }
  if (building > 0.5)
    for (int i = 0; i < 3; i++) {
      float x = size.x - pad - float(3 - i) * 0.26;
      float pip = rect(p, vec2(x, top + pad + 0.04), vec2(x + 0.2, top + pad + 0.13));
      col = mix(col, float(i) < level ? vec4(0.93, 0.78, 0.43, 1.0) : vec4(0.2, 0.26, 0.25, 0.9), pip);
    }
  if (building > 0.5 && rank > 0.5)
    for (int i = 0; i < 2; i++) {
      if (float(i) >= rank) break;
      float x = size.x - pad - float(4 + i) * 0.26 - 0.06;
      float pip = rect(p, vec2(x, top + pad + 0.02), vec2(x + 0.2, top + pad + 0.15));
      col = mix(col, vec4(1.0, 0.95, 0.72, 1.0), pip);
    }
  if (col.a < 0.01) discard;
  col.rgb = mix(col.rgb, vec3(1.0), flash);
  gl_FragColor = col;
}`;

export function createBar(e, hex) {
  const building = e.kind === "building";
  const bar = new THREE.Object3D();
  bar.position.y = building ? 4.9 : 2.55;
  bar.scale.setScalar(building ? 0.58 : 0.62); // compact plates leave the battlefield visible
  bar.renderOrder = 10;
  bar.visible = false;
  bar.userData = { color: raw(hex), building, hasShield: e.maxShield > 0, ghost: 1, last: 1, hold: 0, base: building ? 0.58 : 0.62 };
  return bar;
}

// Health ghost: after damage the lost span stays pale for 0.45 s, then drains away.
// R3-X `inbound`: a round drawn in flight has not landed yet, so the bar keeps the health from before the hit.
export function updateBar(bar, e, dt, inbound = false) {
  const s = bar.userData, real = Math.max(0, e.hp / e.maxHp), hp = inbound && real < s.last ? s.last : real;
  if (hp < s.last) s.hold = 0.45;
  if (hp >= s.ghost) s.ghost = hp;
  else if (s.hold > 0) s.hold -= dt;
  else s.ghost = Math.max(hp, s.ghost - dt * 0.7);
  s.last = hp;
  s.shield = e.maxShield > 0 ? Math.max(0, e.shield / e.maxShield) : 0;
  s.level = e.level || 1;
  s.rank = e.branchRank || 0;
  s.segments = Math.max(2, Math.min(40, Math.round(e.maxHp / 50)));
}

export function setTeamColor(object, hex) {
  object.userData.ring.userData.color.setHex(hex, THREE.LinearSRGBColorSpace);
  object.userData.bar.userData.color.setHex(hex, THREE.LinearSRGBColorSpace);
}

// Ground rings depth-test against the world. Vitals draw over it. Each kind
// shares a single draw across all visible entities.
function writeFour(attr, i, x, y, z, w) {
  const a = attr.array, off = i * 4;
  if (a[off] === Math.fround(x) && a[off + 1] === Math.fround(y) &&
      a[off + 2] === Math.fround(z) && a[off + 3] === Math.fround(w)) return;
  attr.setXYZW(i, x, y, z, w);
  attr.overlayDirty = true;
}
class OverlayBatch {
  constructor(scene, ring) {
    this.scene = scene;
    this.ring = ring;
    this.used = 0;
    this.capacity = 0;
    const vertex = `
      attribute vec4 iShape, iState, iTint;
      varying vec4 vShape, vState, vTint;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vShape = iShape; vState = iState; vTint = iTint;
        vec2 size = ${ring ? "vec2(2.0 * (iShape.x + 0.9))" : "vec2(iState.z > 0.5 ? 3.6 : 2.3, iState.z > 0.5 ? 0.62 : (iState.x > 0.5 ? 0.39 : 0.29))"};
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position.xy * size, 0.0, 1.0);
      }`;
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: ring ? RING : BAR,
      transparent: true, depthWrite: false, depthTest: ring,
      polygonOffset: ring, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  }
  grow() {
    this.capacity = Math.max(16, this.capacity * 2);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const name of ["iShape", "iState", "iTint"]) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4);
      attr.setUsage(THREE.DynamicDrawUsage);
      if (this.mesh) attr.array.set(this.mesh.geometry.attributes[name].array);
      geometry.setAttribute(name, attr);
    }
    if (this.mesh) {
      mesh.instanceMatrix.array.set(this.mesh.instanceMatrix.array);
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }
    mesh.name = this.ring ? "Selection rings" : "Vitals bars";
    mesh.renderOrder = this.ring ? 3 : 10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.mesh = mesh;
    this.uploads = [mesh.instanceMatrix, geometry.attributes.iShape, geometry.attributes.iState, geometry.attributes.iTint];
  }
  add(anchor) {
    if (!anchor.visible) return;
    if (this.used >= this.capacity) this.grow();
    const i = this.used++, u = anchor.userData, attrs = this.mesh.geometry.attributes;
    const matrix = this.mesh.instanceMatrix, expected = anchor.matrixWorld.elements;
    for (let j = 0; j < 16; j++) {
      if (matrix.array[i * 16 + j] === Math.fround(expected[j])) continue;
      this.mesh.setMatrixAt(i, anchor.matrixWorld);
      matrix.overlayDirty = true;
      break;
    }
    writeFour(attrs.iTint, i, u.color.r, u.color.g, u.color.b, u.flash || 0);
    if (this.ring) {
      writeFour(attrs.iShape, i, u.radius, u.appear, u.strength ?? 1, u.selected ? 1 : 0);
      writeFour(attrs.iState, i, u.time || 0, u.px || 0, 0, 0);
    } else {
      writeFour(attrs.iShape, i, u.last, u.ghost, u.shield, u.segments);
      writeFour(attrs.iState, i, u.hasShield ? 1 : 0, u.level, u.building ? 1 : 0, u.rank);
    }
  }
  finish() {
    if (!this.mesh) return;
    this.mesh.count = this.used;
    this.mesh.visible = this.used > 0;
    if (this.used) {
      for (const attr of this.uploads) {
        if (!attr.overlayDirty) continue;
        attr.overlayDirty = false;
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, this.used * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
    this.used = 0;
  }
}
export class SelectionBatches {
  constructor(scene) {
    this.rings = new OverlayBatch(scene, true);
    this.bars = new OverlayBatch(scene, false);
  }
  collect(o) {
    if (!o.visible) return;
    this.rings.add(o.userData.ring);
    this.bars.add(o.userData.bar);
  }
  finish() {
    this.rings.finish();
    this.bars.finish();
  }
}

// Command marker: a lock-on ring that tightens onto the point, a centre ping and, for
// attacks, crosshair ticks. `progress` runs 0 -> 1 over the marker's life.
const MARKER = `
uniform float flash;
uniform vec3 color; uniform float progress, attack;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p), a = atan(p.y, p.x), w = fwidth(r), t = progress;
  float ringR = mix(0.95, 0.5, 1.0 - pow(1.0 - t, 3.0));
  float lock = 1.0 - smoothstep(0.035, 0.035 + w * 1.5, abs(r - ringR));
  float ping = (1.0 - smoothstep(0.02, 0.02 + w * 1.5, abs(r - t * 0.45))) * (1.0 - t);
  float dot = 1.0 - smoothstep(0.08, 0.08 + w * 1.5, r);
  float ticks = attack * (1.0 - smoothstep(0.03, 0.03 + w * 2.0, abs(sin(a * 2.0)) * r)) * step(ringR + 0.06, r) * step(r, ringR + 0.3);
  float glow = exp(-pow((r - ringR) / 0.12, 2.0)) * 0.35;
  float fade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.7, 1.0, t));
  float alpha = (lock + ping * 0.8 + dot + ticks + glow) * fade;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(mix(color, vec3(1.0), lock * 0.3), min(1.0, alpha));
}`;

export function createMarker(hex, attack) {
  const material = new THREE.ShaderMaterial({
    uniforms: { flash: { value: 0 }, color: { value: raw(hex) }, progress: { value: 0 }, attack: { value: attack ? 1 : 0 } },
    vertexShader: PLAIN, fragmentShader: MARKER, transparent: true, depthWrite: false,
  });
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), material);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.09;
  marker.renderOrder = 4;
  return marker;
}

// Rally point: a team-coloured flag with a pulsing base ring and a dashed route from the
// building. One shared object (4 draw calls), shown only while a building with a rally is selected.
export function createRally() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.1, 8), new THREE.MeshBasicMaterial({ color: 0x1b2a27 }));
  pole.position.y = 1.55;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.6, -0.45), new THREE.Vector2(0, -0.9)]);
  const banner = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  banner.position.y = 3.05;
  const base = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.1;
  const flag = new THREE.Group();
  flag.add(pole, banner, base);
  const route = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  route.frustumCulled = false;
  route.renderOrder = 4;
  group.add(flag, route);
  group.visible = false;
  group.userData = { flag, banner, base, route, key: "" };
  return group;
}
export function updateRally(group, building, rally, hex, time) {
  const { flag, banner, base, route } = group.userData;
  group.visible = !!rally;
  if (!rally) return;
  for (const m of [banner.material, base.material, route.material]) m.color.setHex(hex);
  base.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
  flag.position.set(rally.x, 0, rally.z);
  banner.rotation.y = Math.sin(time * 2.2) * 0.25;
  const key = `${building.x},${building.z},${rally.x},${rally.z}`;
  if (group.userData.key === key) return;
  group.userData.key = key;
  route.geometry.attributes.position.array.set([building.x, 0.18, building.z, rally.x, 0.18, rally.z]);
  route.geometry.attributes.position.needsUpdate = true;
  route.computeLineDistances();
}
