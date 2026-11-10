import * as THREE from "three";
import { themeFor } from "./visual-style.js";

// The map edge: a cliff skirt under the playable square and the land or sea far below it,
// fading into the haze colour the scene clears to. One unlit, vertex-coloured mesh (one draw,
// no shadows, no textures); the shading is baked for the fixed sun and camera.
export const CLIFF = 7;
const REACH = 190;

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
  const top = (x, z) => terrain.river && Math.abs(z) < 4 && Math.abs(x) > 5 ? -0.5 * Math.min(1, 4 - Math.abs(z)) : 0;
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
  if (terrain.river) {
    const x = half + 0.03, bright = mix(water, foam, 0.35), spray = mix(water, foam, 0.9);
    for (const [z0, z1] of [[-3, -1], [-1, 1], [1, 3]]) {
      const edge = (z) => Math.abs(z) === 3 ? spray : bright;
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
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  mesh.name = "backdrop";
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  return mesh;
}
