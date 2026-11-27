import * as THREE from "three";
import { mulberry32 } from "./rng.js";

// Resource deposits (visual "shine" pass, 2026-11-28): code-built crystal clusters instead of plain cones.
//   energy (blue)  slender hexagonal prisms with long points, a tall spire and leaning satellites
//   alloy (orange) stubby, chunkier hexagonal prisms with short blunt points, more of them, more upright
// Each cluster sits on a few dark rocks. Flat-shaded facets; vertex colours run dark at the base to bright at the
// tip; the shader adds a fresnel rim glow, a slow inner pulse and twinkling glints (a light sweeping round in view
// space, so single facets flash in turn). Under every deposit lie a soft additive glow (fake light spill, no real
// light) and a dark contact blob.
//
// Draws: every deposit is a Group of shared geometry and materials, so the view's EntityBatches draw all deposits
// of a kind in one instanced call per part: crystals (one per kind), glow decals (one, tinted per kind through the
// batch's instance colour) and contact blobs (one). Nothing casts a shadow. Depletion keeps working: the view
// squashes the Group's y scale as a deposit is mined (the flat decals do not mind), and hides it when empty.
// The mining hit flash brightens one deposit's crystals through the same instance colour (`flash`).

export const CRYSTAL_TIME = { value: 0 }; // the view's life clock (stops with reduced motion / still governor)

const KINDS = {
  energy: {
    dark: [0.07, 0.24, 0.42], mid: [0.2, 0.62, 0.92], tip: [0.78, 0.96, 1], emissive: 0x2a9fe0, rim: [0.55, 0.9, 1],
    glow: [0.22, 0.62, 1], seed: 11, count: 8, radius: [0.14, 0.24], height: [1, 1.7], spire: [0.36, 2.7], point: [0.32, 0.42], lean: [0.3, 0.6], spread: [0.55, 1.15],
  },
  alloy: {
    dark: [0.42, 0.13, 0.02], mid: [1, 0.46, 0.08], tip: [1, 0.8, 0.42], emissive: 0xf06a10, rim: [1, 0.7, 0.3],
    glow: [1, 0.5, 0.12], seed: 7, count: 9, radius: [0.2, 0.32], height: [0.7, 1.25], spire: [0.46, 1.95], point: [0.14, 0.22], lean: [0.12, 0.38], spread: [0.5, 1.1],
  },
};
const ROCK = [0.36, 0.34, 0.31];
// Each kind's colours, for tests and other views (the glow tint).
export const CRYSTAL_GLOW = Object.freeze({ energy: KINDS.energy.glow, alloy: KINDS.alloy.glow });

// One deposit's geometry of a kind: crystals (aCrystal.x = 1, aCrystal.y = 0 at the base .. 1 at the tip) and rocks.
export function crystalGeometry(kind) {
  const k = KINDS[kind] || KINDS.energy, r = mulberry32(k.seed), pos = [], col = [], cr = [];
  const between = ([a, b]) => a + (b - a) * r();
  const push = (p, c, glow, h) => { pos.push(p[0], p[1], p[2]); col.push(c[0], c[1], c[2]); cr.push(glow, h); };
  const tri = (a, b, c) => { push(...a); push(...b); push(...c); };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // A hexagonal prism from `base` along unit `axis`: radius `rad`, body to `body` m, point to `top` m.
  const prism = (base, axis, rad, body, top, twist) => {
    const side = Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let ux = axis[1] * side[2] - axis[2] * side[1], uy = axis[2] * side[0] - axis[0] * side[2], uz = axis[0] * side[1] - axis[1] * side[0];
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = axis[1] * uz - axis[2] * uy, vy = axis[2] * ux - axis[0] * uz, vz = axis[0] * uy - axis[1] * ux;
    const ring = (d, rr) => Array.from({ length: 6 }, (_, i) => {
      const a = twist + (i / 6) * Math.PI * 2, c = Math.cos(a) * rr, s = Math.sin(a) * rr;
      return [base[0] + axis[0] * d + ux * c + vx * s, base[1] + axis[1] * d + uy * c + vy * s, base[2] + axis[2] * d + uz * c + vz * s];
    });
    const low = ring(-0.25, rad * 0.92), high = ring(body, rad), tip = [base[0] + axis[0] * top, base[1] + axis[1] * top, base[2] + axis[2] * top];
    const lowC = k.dark, highC = mix(k.mid, k.tip, 0.25), tipC = k.tip, hb = body / top;
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      // Alternate facets a touch lighter, so neighbouring faces separate even under flat light.
      const f = i % 2 ? 1 : 0.86;
      const lc = lowC.map((v) => v * f), hc = highC.map((v) => v * f);
      tri([low[i], lc, 1, 0], [low[j], lc, 1, 0], [high[j], hc, 1, hb]);
      tri([low[i], lc, 1, 0], [high[j], hc, 1, hb], [high[i], hc, 1, hb]);
      tri([high[i], hc, 1, hb], [high[j], hc, 1, hb], [tip, tipC, 1, 1]);
    }
  };
  for (let i = 0; i < k.count; i++) {
    const central = i === 0, ang = (i / k.count) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const dist = central ? 0 : between(k.spread), lean = central ? r() * 0.1 : between(k.lean);
    const rad = central ? k.spire[0] : between(k.radius), h = central ? k.spire[1] : between(k.height);
    const axis = [Math.cos(ang) * Math.sin(lean), Math.cos(lean), Math.sin(ang) * Math.sin(lean)];
    const tip = h * between(k.point);
    prism([Math.cos(ang) * dist, 0, Math.sin(ang) * dist], axis, rad, h - tip, h, r() * 1.2);
  }
  // A few low rocks round the foot (five-sided lumps: a base ring, a narrower raised ring and a top), unlit by the glow.
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.5 + r() * 0.4, d = 1 + r() * 0.35, cx = Math.cos(ang) * d, cz = Math.sin(ang) * d;
    const w = 0.26 + r() * 0.16, h = 0.2 + r() * 0.14, rot = r() * Math.PI;
    const ring = (rr, y, turn) => [0, 1, 2, 3, 4].map((q) => { const a = rot + turn + (q / 5) * Math.PI * 2, j = 0.85 + ((q * 7 + i) % 3) * 0.1; return [cx + Math.cos(a) * rr * j, y, cz + Math.sin(a) * rr * j * 0.85]; });
    const low = ring(w, -0.02, 0), mid = ring(w * 0.78, h * 0.62, 0.6), top = [cx + 0.03, h, cz - 0.02];
    const lowC = ROCK, midC = ROCK.map((v) => v * 1.18), topC = ROCK.map((v) => v * 1.35);
    for (let q = 0; q < 5; q++) {
      const n = (q + 1) % 5;
      // Wound counter-clockwise seen from outside (the ring runs clockwise seen from above).
      tri([low[n], lowC, 0, 0], [low[q], lowC, 0, 0], [mid[n], midC, 0, 0]);
      tri([mid[n], midC, 0, 0], [low[q], lowC, 0, 0], [mid[q], midC, 0, 0]);
      tri([mid[n], midC, 0, 0], [mid[q], midC, 0, 0], [top, topC, 0, 0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aCrystal", new THREE.Float32BufferAttribute(cr, 2));
  g.computeVertexNormals();
  return g;
}

// The crystal material of a kind: lit (so it sits in the scene's light and the night grade), flat facets,
// self-lit toward the tips with a slow pulse, a fresnel rim and twinkling glints.
export function crystalMaterial(kind) {
  const k = KINDS[kind] || KINDS.energy;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.22, metalness: 0.12, emissive: k.emissive, emissiveIntensity: 1 });
  m.name = kind === "alloy" ? "CrystalFieldAlloy" : "CrystalFieldEnergy";
  const rim = new THREE.Vector3(...k.rim);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalTime = CRYSTAL_TIME;
    shader.uniforms.uCrystalRim = { value: rim };
    shader.vertexShader = "attribute vec2 aCrystal;\nvarying vec2 vCrystal;\nvarying float vCrystalPhase;\n" + shader.vertexShader
      .replace("#include <begin_vertex>", `#include <begin_vertex>
  vCrystal = aCrystal;
#ifdef USE_INSTANCING
  vCrystalPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
#else
  vCrystalPhase = 0.0;
#endif`);
    shader.fragmentShader = "uniform float uCrystalTime;\nuniform vec3 uCrystalRim;\nvarying vec2 vCrystal;\nvarying float vCrystalPhase;\n" + shader.fragmentShader
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  // Inner glow: none on the rocks, rising toward the tips, breathing slowly (each deposit in its own time).
  float crystalPulse = 0.82 + 0.18 * sin(uCrystalTime * 1.3 + vCrystalPhase + vCrystal.y * 2.0);
  totalEmissiveRadiance *= vCrystal.x * (0.22 + 0.7 * vCrystal.y * vCrystal.y) * crystalPulse;`)
      .replace("#include <opaque_fragment>", `
  vec3 crystalView = normalize(vViewPosition);
  float crystalFresnel = pow(1.0 - clamp(abs(dot(normal, crystalView)), 0.0, 1.0), 3.0);
  // Glints: a light circling in view space; a facet flashes as its mirror direction meets it.
  vec3 crystalSweep = normalize(vec3(sin(uCrystalTime * 0.9 + vCrystalPhase), 0.55, cos(uCrystalTime * 0.9 + vCrystalPhase)));
  float crystalGlint = pow(max(0.0, dot(reflect(-crystalView, normal), crystalSweep)), 90.0) * smoothstep(0.35, 0.9, vCrystal.y);
  outgoingLight += vCrystal.x * (uCrystalRim * crystalFresnel * 1.0 + vec3(1.0) * crystalGlint * 1.6);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "crystal-field-v1";
  return m;
}

// The soft round texture both decals use (white centre, transparent rim), made once.
let blobTexture = null;
function softDisc() {
  if (blobTexture) return blobTexture;
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2), a = Math.max(0, 1 - d) ** 1.8;
      data.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  blobTexture = new THREE.DataTexture(data, size, size);
  blobTexture.needsUpdate = true;
  blobTexture.magFilter = blobTexture.minFilter = THREE.LinearFilter;
  return blobTexture;
}

// The shared parts of every deposit (built once per view).
export class CrystalFieldKit {
  constructor() {
    this.geometry = { energy: crystalGeometry("energy"), alloy: crystalGeometry("alloy") };
    this.material = { energy: crystalMaterial("energy"), alloy: crystalMaterial("alloy") };
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    this.decal = plane;
    this.glowMaterial = new THREE.MeshBasicMaterial({ map: softDisc(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.glowMaterial.name = "CrystalFieldGlow";
    this.blobMaterial = new THREE.MeshBasicMaterial({ map: softDisc(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.blobMaterial.name = "CrystalFieldBlob";
  }
  get triangles() { return { energy: this.geometry.energy.attributes.position.count / 3, alloy: this.geometry.alloy.attributes.position.count / 3 }; }
  // One deposit: a Group holding its crystals, its glow and its blob (shared geometry and materials).
  create(kind) {
    kind = kind === "alloy" ? "alloy" : "energy";
    const group = new THREE.Group();
    group.name = `crystal-field:${kind}`;
    const crystals = new THREE.Mesh(this.geometry[kind], this.material[kind]);
    crystals.name = "CrystalFieldCrystals";
    crystals.castShadow = false;
    crystals.receiveShadow = true;
    crystals.userData.tint = [1, 1, 1];
    const blob = new THREE.Mesh(this.decal, this.blobMaterial);
    blob.name = "CrystalFieldBlob";
    blob.scale.set(3.4, 1, 3.4);
    blob.position.y = 0.03;
    blob.renderOrder = 1;
    const glow = new THREE.Mesh(this.decal, this.glowMaterial);
    glow.name = "CrystalFieldGlow";
    glow.scale.set(5.6, 1, 5.6);
    glow.position.y = 0.05;
    glow.renderOrder = 2;
    const g = KINDS[kind].glow;
    const lift = kind === "alloy" ? 0.75 : 0.55; // the orange spill needs more to show on sand and dirt
    glow.userData.tint = [g[0] * lift, g[1] * lift, g[2] * lift];
    for (const m of [blob, glow]) m.castShadow = m.receiveShadow = false;
    group.add(blob, glow, crystals);
    group.userData.crystals = crystals;
    group.userData.flash = 0;
    group.userData.shared = true; // the kit owns the geometry and materials: clearing a match disposes nothing
    return group;
  }
  // A mining hit: the deposit's crystals flash bright for a moment (instance colour, no extra draw).
  static flash(group, amount = 1) { if (group?.userData.crystals) group.userData.flash = Math.max(group.userData.flash, amount); }
  // Once a frame per deposit: the flash fades.
  static step(group, dt) {
    const c = group.userData.crystals;
    if (!c) return;
    const f = group.userData.flash = Math.max(0, group.userData.flash - dt * 5);
    const v = 1 + f * 1.4;
    c.userData.tint[0] = c.userData.tint[1] = c.userData.tint[2] = v;
  }
  dispose() {
    for (const g of Object.values(this.geometry)) g.dispose();
    for (const m of Object.values(this.material)) m.dispose();
    this.decal.dispose(); this.glowMaterial.dispose(); this.blobMaterial.dispose();
  }
}
