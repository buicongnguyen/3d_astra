import * as THREE from "three";
import { lookOf, themeFor } from "./visual-style.js";

// The map edge: a cliff skirt under the playable square and the land or sea far below it,
// fading into the haze colour the scene clears to. One unlit, vertex-coloured mesh (one draw,
// no shadows, no textures); the shading is baked for the fixed sun and camera.
export const CLIFF = 7;
const REACH = 190;

// Pale dust or moisture gathers by the ridge, cooling to a deeper colour overhead.
const SKY = {
  classic: ["#e6aa77", "#647995"], riverlands: ["#b5dbcf", "#5388a4"],
  basin: ["#e6bc91", "#7792a2"], expanse: ["#c2dfc6", "#658da2"],
  dunes: ["#efd29e", "#7897ad"], woodlands: ["#b5d2bd", "#527d95"],
  highlands: ["#bfaaa1", "#6a788d"],
};

function skyMaterial(terrain, geometry) {
  const [horizon, zenith] = SKY[lookOf(terrain.id)] ?? SKY.riverlands;
  const sky = { horizon: new THREE.Color(horizon), zenith: new THREE.Color(zenith) };
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  material.userData.sky = { ...sky, dayHorizon: sky.horizon.clone(), dayZenith: sky.zenith.clone() };
  const pos = geometry.attributes.position, skyData = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count - 3; i++) {
    const distance = Math.max(Math.abs(pos.getX(i)), Math.abs(pos.getZ(i))) - terrain.half;
    skyData[i * 3 + 2] = THREE.MathUtils.smoothstep(distance, 14, 35);
  }
  // One far-plane triangle completes the sky wherever the horizon mesh ends.
  skyData.set([-1, -1, -1, 3, -1, -1, -1, 3, -1], skyData.length - 9);
  geometry.setAttribute("skyData", new THREE.BufferAttribute(skyData, 3));
  material.onBeforeCompile = shader => {
    shader.uniforms.uHorizon = { value: sky.horizon };
    shader.uniforms.uZenith = { value: sky.zenith };
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute vec3 skyData; varying vec3 vAtmosphere;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        if (skyData.z < 0.0) gl_Position = vec4(skyData.xy, 0.999999, 1.0);
        vAtmosphere = vec3(gl_Position.xy / gl_Position.w, abs(skyData.z));`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nuniform vec3 uHorizon, uZenith; varying vec3 vAtmosphere;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float altitude = smoothstep(-0.7, 1.1, vAtmosphere.y + 0.12 * vAtmosphere.x);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(uHorizon, uZenith, altitude), vAtmosphere.z);`);
  };
  return material;
}

export function createMapEdge(terrain) {
  const theme = themeFor(terrain.id), half = terrain.half, p = [], c = [];
  const color = (key) => { const v = new THREE.Color(theme[key]); return [v.r, v.g, v.b]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const quad = (a, b, cc, d, ca, cb, ccc, cd) => {
    p.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    c.push(...ca, ...cb, ...ccc, ...ca, ...ccc, ...cd);
  };
  const cliff = color("cliff"), deep = color("cliffDeep"), near = color("outlandNear"), far = color("outland"), haze = color("sky"),
    water = color("water"), foam = color("foam"), lip = mix(color(terrain.id === "classic" ? "dirt" : terrain.biome === "desert" ? "sand" : terrain.biome === "highland" ? "stone" : "grass"), cliff, 0.35);
  // The river bed is cut 0.5 deep; the skirt's top edge follows it.
  // Each river band (maps.json "rivers"); the old river maps have one, at z = 0, with its ford at x = 0.
  const top = (x, z) => {
    const river = terrain.river ? terrain.riverNear(z, 4) : null;
    return river && !river.fords.some((c) => Math.abs(x - c.x) <= c.half) ? -0.5 * Math.min(1, 4 - Math.abs(z - river.z)) : 0;
  };
  let hash = 0x9e3779b1 ^ terrain.size;
  const jitter = () => { hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) + 0x297a2d39 >>> 0; return (hash & 1023) / 1023; };
  // Four walls in strata: a lip in the ground's colour, warm rock, then shade toward the base.
  // Sun comes from -x, +z: the +z wall is lit, the +x wall is in cool shade.
  const step = 4;
  for (const [axis, sign, light] of [["z", 1, 1], ["x", 1, 0.66], ["z", -1, 0.6], ["x", -1, 0.85]]) {
    const at = (t, y) => axis === "z" ? [t, y, sign * half] : [sign * half, y, t];
    for (let t = -half; t < half; t += step) {
      const bands = [[0, lip], [-0.45, mix(lip, cliff, 0.6)], [-1.6, cliff], [-3.6, mix(cliff, deep, 0.55)], [-CLIFF, mix(deep, near, 0.35)]];
      const tone = 0.86 + jitter() * 0.24;
      for (let i = 0; i < bands.length - 1; i++) {
        const [y0, c0] = bands[i], [y1, c1] = bands[i + 1], k = light * (i === 2 ? tone : 0.5 + tone * 0.5);
        const a = at(t, y0), b = at(t + step, y0);
        if (i === 0) { a[1] = top(a[0], a[2]); b[1] = top(b[0], b[2]); }
        quad(a, b, at(t + step, y1), at(t, y1), mul(c0, k), mul(c0, k), mul(c1, k), mul(c1, k));
      }
    }
  }
  // The river leaves the map as a waterfall on the side the camera sees.
  if (terrain.river) for (const river of terrain.rivers) {
    const x = half + 0.03, bright = mix(water, foam, 0.35), spray = mix(water, foam, 0.9);
    for (const [z0, z1] of [[-3, -1], [-1, 1], [1, 3]].map(([a, b]) => [river.z + a, river.z + b])) {
      const edge = (z) => Math.abs(z - river.z) === 3 ? spray : bright;
      quad([x, -0.09, z0], [x, -0.09, z1], [x, -CLIFF * 0.55, z1], [x, -CLIFF * 0.55, z0], edge(z0), edge(z1), water, water);
      quad([x, -CLIFF * 0.55, z0], [x, -CLIFF * 0.55, z1], [x, -CLIFF + 0.02, z1], [x, -CLIFF + 0.02, z0], water, water, foam, foam);
    }
  }
  // The outland: square rings from the cliff foot out to the haze.
  const rings = [[0, mix(near, deep, 0.45)], [2.2, near], [9, mix(near, far, 0.7)], [26, far], [70, mix(far, haze, 0.7)], [REACH, haze]];
  const corner = (d, sx, sz) => [sx * (half + d), -CLIFF, sz * (half + d)];
  for (let i = 0; i < rings.length - 1; i++) {
    const [d0, c0] = rings[i], [d1, c1] = rings[i + 1];
    for (const [a, b] of [[[-1, 1], [1, 1]], [[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]]])
      quad(corner(d0, ...a), corner(d0, ...b), corner(d1, ...b), corner(d1, ...a), c0, c0, c1, c1);
  }
  // Beyond the playable lip, low foothills break up the flat outland. Each ridge tapers
  // into the existing haze ring and shares the backdrop mesh and its night/storm tint.
  for (const [axis, sign] of [["x", -1], ["x", 1], ["z", -1], ["z", 1]]) {
    const span = half + 20, segments = 24;
    const summit = (t) => -CLIFF + 2.8 + 1.5 * Math.cos(t * 0.14) + 1.1 * Math.sin(t * 0.21 + sign);
    const pt = (t, depth, y) => axis === "x" ? [sign * (half + depth), y, t] : [t, y, sign * (half + depth)];
    for (let i = 0; i < segments; i++) {
      const a = span * (2 * i / segments - 1), b = span * (2 * (i + 1) / segments - 1);
      const crest = mix(far, haze, 0.22 + 0.12 * Math.sin(a * 0.12));
      quad(pt(a, 5, -CLIFF), pt(b, 5, -CLIFF), pt(b, 14, summit(b)), pt(a, 14, summit(a)), near, near, crest, crest);
      quad(pt(a, 14, summit(a)), pt(b, 14, summit(b)), pt(b, 28, -CLIFF), pt(a, 28, -CLIFF), crest, crest, far, far);
    }
  }
  // The triangle's shader sets its clip position; keep its world bounds on the far edge.
  p.push(...corner(REACH, -1, -1), ...corner(REACH, 1, -1), ...corner(REACH, -1, 1));
  c.push(...haze, ...haze, ...haze);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
  const mesh = new THREE.Mesh(geometry, skyMaterial(terrain, geometry));
  mesh.name = "backdrop";
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  return mesh;
}

// R3-D: a mission look recolours the edge and void (night: black-blue, storm: blue-grey) by blending each
// vertex toward `edge.low`..`edge.high` by its own brightness, so the strata and rings keep their shape but
// lose the warm daylight colour. k = 0 restores the day colours. No new draw; one buffer upload per change.
const linear = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export function edgeColor(rgb, lo, hi, k, out = [0, 0, 0]) {
  const l = Math.min(1, Math.pow(Math.max(0, 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]), 0.8) * 1.6);
  for (let i = 0; i < 3; i++) out[i] = rgb[i] + (lo[i] + (hi[i] - lo[i]) * l - rgb[i]) * k;
  return out;
}
export function tintEdge(mesh, edge, k) {
  const attribute = mesh?.geometry?.attributes.color;
  if (!attribute) return;
  const sky = mesh.material?.userData.sky;
  if (sky) {
    sky.horizon.copy(sky.dayHorizon);
    sky.zenith.copy(sky.dayZenith);
    if (edge && k > 0) {
      const shade = new THREE.Color();
      sky.horizon.lerp(shade.set(edge.high), k);
      sky.zenith.lerp(shade.set(edge.low), k);
    }
  }
  const day = (mesh.userData.dayColors ??= attribute.array.slice()), out = attribute.array;
  if (!edge || !(k > 0)) out.set(day);
  else {
    const lo = linear(edge.low), hi = linear(edge.high), rgb = [0, 0, 0], mixed = [0, 0, 0];
    for (let i = 0; i < day.length; i += 3) {
      rgb[0] = day[i]; rgb[1] = day[i + 1]; rgb[2] = day[i + 2];
      edgeColor(rgb, lo, hi, k, mixed);
      out[i] = mixed[0]; out[i + 1] = mixed[1]; out[i + 2] = mixed[2];
    }
  }
  attribute.needsUpdate = true;
}
