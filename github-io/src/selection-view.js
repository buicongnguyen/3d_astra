import * as THREE from "three";

// Selection presentation: ground rings, vitals bars and command markers. Shader colours are
// written unconverted (no tone mapping or colour-space transform), so team colours match
// their settings swatches exactly.
const PLAIN = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const raw = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

// Ground ring: bright core, soft halo, faint footprint disc and a slowly rotating dashed band
// that appears only when selected. `appear` animates the lock-on (fade and scale in).
const RING = `
uniform vec3 color; uniform float time, appear, strength, radius, selected;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * (radius + 0.9);
  float r = length(p), a = atan(p.y, p.x), w = fwidth(r);
  float edge = radius + 0.28;
  float core = 1.0 - smoothstep(0.045, 0.045 + w * 1.5, abs(r - edge));
  float halo = exp(-pow((r - edge) / 0.24, 2.0)) * 0.45;
  float disc = (1.0 - smoothstep(edge - 0.12, edge, r)) * 0.12;
  float segments = floor(radius * 5.0 + 8.0);
  float band = 1.0 - smoothstep(0.035, 0.035 + w * 1.5, abs(r - edge - 0.3));
  float dash = step(0.45, fract(a / 6.2831853 * segments + time * 0.07)) * band;
  float alpha = (core + halo + disc + dash * selected * 0.9) * strength * appear;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(mix(color, vec3(1.0), core * 0.35 * selected), min(1.0, alpha));
}`;

export function createRing(radius, hex) {
  const size = 2 * (radius + 0.9);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: raw(hex) }, time: { value: 0 }, appear: { value: 0 }, strength: { value: 1 },
      radius: { value: radius }, selected: { value: 1 } },
    vertexShader: PLAIN, fragmentShader: RING, transparent: true, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  ring.renderOrder = 3;
  ring.visible = false;
  ring.userData.appear = 0;
  return ring;
}

// Advance a ring: selected rings lock on over 0.2 s; hover shows a dim ring without dashes.
export function updateRing(ring, selected, hovered, time, dt) {
  const on = selected || hovered;
  const target = on ? 1 : 0;
  ring.userData.appear = dt > 0 ? Math.min(1, Math.max(0, ring.userData.appear + Math.sign(target - ring.userData.appear) * dt * 5)) : target;
  if (!on) ring.userData.appear = 0;
  ring.visible = on;
  if (!on) return;
  const u = ring.material.uniforms, t = ring.userData.appear;
  u.appear.value = t;
  u.time.value = time;
  u.selected.value = selected ? 1 : 0;
  u.strength.value = selected ? 1 : 0.5;
  ring.scale.setScalar(1 + (1 - t) * 0.35);
}

// Vitals: framed plate, team tab, segmented health (green / amber / red) with a pale damage
// ghost, shield bar and, on buildings, three level pips. One mesh per entity.
const BAR = `
uniform float hp, ghost, shield, hasShield, segments, level, building;
uniform vec3 team; uniform vec2 size;
varying vec2 vUv;
float rect(vec2 p, vec2 a, vec2 b) {
  vec2 w = max(fwidth(p), vec2(1e-4));
  vec2 s = smoothstep(a - w * 0.5, a + w * 0.5, p) * (1.0 - smoothstep(b - w * 0.5, b + w * 0.5, p));
  return s.x * s.y;
}
void main() {
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
  if (col.a < 0.01) discard;
  gl_FragColor = col;
}`;

export function createBar(e, hex) {
  const building = e.kind === "building";
  const size = new THREE.Vector2(building ? 3.6 : 2.3, building ? 0.62 : e.maxShield > 0 ? 0.39 : 0.29);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      hp: { value: 1 }, ghost: { value: 1 }, shield: { value: 1 }, hasShield: { value: e.maxShield > 0 ? 1 : 0 },
      segments: { value: Math.max(2, Math.min(40, Math.round(e.maxHp / 50))) }, level: { value: e.level || 1 },
      building: { value: building ? 1 : 0 }, team: { value: raw(hex) }, size: { value: size },
    },
    vertexShader: PLAIN, fragmentShader: BAR, transparent: true, depthTest: false, depthWrite: false,
  });
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
  bar.position.y = building ? 5.4 : 2.95;
  bar.renderOrder = 10;
  bar.visible = false;
  bar.userData = { ghost: 1, last: 1, hold: 0 };
  return bar;
}

// Health ghost: after damage the lost span stays pale for 0.45 s, then drains away.
export function updateBar(bar, e, dt) {
  const u = bar.material.uniforms, s = bar.userData, hp = Math.max(0, e.hp / e.maxHp);
  if (hp < s.last) s.hold = 0.45;
  if (hp >= s.ghost) s.ghost = hp;
  else if (s.hold > 0) s.hold -= dt;
  else s.ghost = Math.max(hp, s.ghost - dt * 0.7);
  s.last = hp;
  u.hp.value = hp;
  u.ghost.value = s.ghost;
  u.shield.value = e.maxShield > 0 ? Math.max(0, e.shield / e.maxShield) : 0;
  u.level.value = e.level || 1;
  u.segments.value = Math.max(2, Math.min(40, Math.round(e.maxHp / 50)));
}

export function setTeamColor(object, hex) {
  object.userData.ring.material.uniforms.color.value = raw(hex);
  object.userData.bar.material.uniforms.team.value = raw(hex);
}

// Command marker: a lock-on ring that tightens onto the point, a centre ping and, for
// attacks, crosshair ticks. `progress` runs 0 -> 1 over the marker's life.
const MARKER = `
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
    uniforms: { color: { value: raw(hex) }, progress: { value: 0 }, attack: { value: attack ? 1 : 0 } },
    vertexShader: PLAIN, fragmentShader: MARKER, transparent: true, depthWrite: false,
  });
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), material);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.09;
  marker.renderOrder = 4;
  return marker;
}
