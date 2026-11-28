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
  // W9 lands: a pale frost haze, a smoky ember haze over the volcano, a bright sea haze over the isles.
  snowfield: ["#d6e8f6", "#6c8fb4"], volcano: ["#d89a78", "#6a5a78"], archipelago: ["#bfe8e6", "#4f94b8"],
};

// V1 terrain (2026-11-26): what lies below the edge on each land, instead of a flat coloured floor. `ground` is
// the lowland's look; `sea` (the isles) puts a sea surface at that height instead of a lowland; `props` are the
// distant silhouette families and how many of each stand per 100 m of edge. All of it is the backdrop mesh: one draw.
export const SURROUND = {
  classic: { ground: "ash", props: [["snag", 10], ["rock", 13], ["spire", 2]] },
  riverlands: { ground: "meadow", props: [["tree", 30], ["pine", 10], ["rock", 6]] },
  basin: { ground: "canyon", props: [["mesa", 2.4], ["rock", 12], ["bush", 8]] },
  expanse: { ground: "meadow", props: [["pine", 20], ["tree", 10], ["rock", 3]] },
  dunes: { ground: "desert", props: [["mesa", 2.2], ["rock", 12], ["bush", 5]] },
  woodlands: { ground: "forest", props: [["pine", 28], ["tree", 18]] },
  highlands: { ground: "rock", props: [["spire", 10], ["rock", 14], ["pine", 4]] },
  snowfield: { ground: "snow", props: [["pine", 20], ["ridge", 4], ["rock", 4]] },
  volcano: { ground: "lava", props: [["spire", 11], ["snag", 6], ["cone", 0.5]], lavaRivers: 2 },
  archipelago: { ground: "sea", sea: -2.5, props: [["islet", 2.4], ["rock", 2]] },
};
export const surroundFor = (id) => SURROUND[lookOf(id)] || SURROUND.riverlands;
// The lowland reaches this far beyond the edge; haze rings carry on to REACH. Its relief lives in the near band
// (NEAR m, cells of CELL m); beyond it lies flat in cells four times as big, where the haze takes it anyway (the
// backdrop is always drawn whole). LOWLAND - NEAR and every map's half + NEAR are multiples of 4 * CELL, so the grids
// meet edge to edge.
export const LOWLAND = 88;
const NEAR = 40, CELL = 4;
// Shading baked into the colours for the fixed sun (view.js SUN_OFFSET).
const SUN = new THREE.Vector3(-25, 55, 20).normalize();

// V1 terrain round 2 (2026-11-26): which two ground-detail slots (src/ground-detail.js SLOTS: 0 grass, 1 dirt, 2 sand,
// 3 stone) grain each lowland look; a lowland vertex carries 1 + its share of the second one (0 = no detail).
export const LOWLAND_SLOTS = { meadow: [0, 1], forest: [0, 1], desert: [2, 1], canyon: [1, 2], rock: [3, 0], snow: [0, 2], lava: [1, 0], ash: [1, 0] };
// The lowland's detail tiles this much coarser than the playable ground's (it lies 7 m down and recedes).
export const LOWLAND_TILE = 2.5;
// Aerial perspective: from the playable edge out to AIR_REACH m the surround darkens and greys toward the land's haze.
export const AIR_REACH = 40;

function skyMaterial(terrain, geometry, kinds, lows, detail) {
  const [horizon, zenith] = SKY[lookOf(terrain.id)] ?? SKY.riverlands;
  const sky = { horizon: new THREE.Color(horizon), zenith: new THREE.Color(zenith) };
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  // uEdgeTime drives the sea's glints and the lava's pulse (view.js advances it while the world is lively);
  // uEdgeLive fades them under a mission look (tintEdge), so a night sea does not sparkle in daylight colours.
  // uEdgeHero (horizon-view.js): 1 while the Hero-view sky dome is drawn: the far-plane triangle steps aside for it and
  // the far haze takes the horizon colour itself (no screen-space gradient for a low camera). 0 = exactly as before.
  const motion = { time: { value: 0 }, live: { value: 1 }, hero: { value: 0 } };
  material.userData.sky = { ...sky, dayHorizon: sky.horizon.clone(), dayZenith: sky.zenith.clone() };
  material.userData.motion = motion;
  const pos = geometry.attributes.position, skyData = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count - 3; i++) {
    const distance = Math.max(Math.abs(pos.getX(i)), Math.abs(pos.getZ(i))) - terrain.half;
    skyData[i * 3] = kinds[i] || 0;
    skyData[i * 3 + 1] = lows[i] || 0;
    // The near lowland keeps its own colours and melts into the haze from 30 m out (was 14-35 m: a flat void).
    skyData[i * 3 + 2] = THREE.MathUtils.smoothstep(distance, 30, 96);
  }
  // One far-plane triangle completes the sky wherever the horizon mesh ends.
  skyData.set([-1, -1, -1, 3, -1, -1, -1, 3, -1], skyData.length - 9);
  geometry.setAttribute("skyData", new THREE.BufferAttribute(skyData, 3));
  // The lowland's grain reads the ground detail's own layers (shared uniforms: they arrive, fade and switch off with it).
  const [slotA, slotB] = LOWLAND_SLOTS[surroundFor(terrain.id).ground] ?? [0, 1];
  const gd = detail?.uniforms;
  const low = {
    uLowOn: gd ? gd.uGdOn : { value: 0 },
    uLowTile: { get value() { return (gd ? gd.uGdTile.value : 4) * LOWLAND_TILE; } },
    uLowA: { get value() { return gd ? gd[`uGdL${slotA}`].value : null; } },
    uLowB: { get value() { return gd ? gd[`uGdL${slotB}`].value : null; } },
    uLowLookA: { get value() { return gd ? gd.uGdLook.value[slotA] : OFF; } },
    uLowLookB: { get value() { return gd ? gd.uGdLook.value[slotB] : OFF; } },
    uLowMeanA: { get value() { return gd ? gd.uGdMean.value[slotA] : ONE; } },
    uLowMeanB: { get value() { return gd ? gd.uGdMean.value[slotB] : ONE; } },
    uEdgeHalf: { value: terrain.half },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, low);
    shader.uniforms.uHorizon = { value: sky.horizon };
    shader.uniforms.uZenith = { value: sky.zenith };
    shader.uniforms.uEdgeTime = motion.time;
    shader.uniforms.uEdgeLive = motion.live;
    shader.uniforms.uEdgeHero = motion.hero;
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute vec3 skyData; uniform float uEdgeHero; varying vec3 vAtmosphere; varying vec3 vEdgeW; varying float vKind; varying float vLow;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vEdgeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vKind = skyData.z < 0.0 ? 0.0 : skyData.x;
        vLow = skyData.z < 0.0 ? 0.0 : skyData.y;
        if (skyData.z < 0.0) gl_Position = uEdgeHero > 0.5 ? vec4(0.0, 0.0, 2.0, 1.0) : vec4(skyData.xy, 0.999999, 1.0);
        vAtmosphere = vec3(gl_Position.xy / gl_Position.w, abs(skyData.z));`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nuniform vec3 uHorizon, uZenith; uniform float uEdgeTime, uEdgeLive, uEdgeHero; varying vec3 vAtmosphere; varying vec3 vEdgeW; varying float vKind; varying float vLow;\n" + LOW_GLSL)
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (vKind > 0.5) {
          float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          if (vKind < 1.5) {
            // Water: slow drifting glints.
            float r = sin(vEdgeW.x * 2.3 + uEdgeTime * 1.1 + sin(vEdgeW.z * 0.9) * 2.0) * sin(vEdgeW.z * 1.9 - uEdgeTime * 0.8 + sin(vEdgeW.x * 0.7) * 2.0);
            float swell = 0.5 + 0.5 * sin(vEdgeW.x * 0.11 + vEdgeW.z * 0.07 + uEdgeTime * 0.35);
            diffuseColor.rgb += (smoothstep(0.9, 0.99, r) * 0.22 + swell * 0.04) * (0.4 + lum) * uEdgeLive;
          } else {
            // Lava: a slow breathing glow.
            diffuseColor.rgb *= mix(1.0, 0.8 + 0.3 * sin(uEdgeTime * 1.1 + vEdgeW.x * 0.13 + vEdgeW.z * 0.17), uEdgeLive);
          }
        }
        // Aerial perspective: the surround greys and darkens toward the haze with distance from the playable edge.
        float air = smoothstep(1.0, ${AIR_REACH.toFixed(1)}, max(abs(vEdgeW.x), abs(vEdgeW.z)) - uEdgeHalf);
        // The lowland's grain: the land's own detail layers at a coarser tile, softer as it recedes.
        vec2 lq = mat2(0.7660, -0.6428, 0.6428, 0.7660) * vEdgeW.xz / uLowTile;
        vec2 lqx = dFdx(lq), lqy = dFdy(lq);
        if (vLow > 0.5 && uLowOn > 0.0) {
          float t = clamp(vLow - 1.0, 0.0, 1.0);
          vec3 m = vec3(1.0);
          if (t < 0.98) m = lowLayer(uLowA, lq, lqx, lqy, uLowLookA, uLowMeanA);
          if (t > 0.02) m = mix(m, lowLayer(uLowB, lq, lqx, lqy, uLowLookB, uLowMeanB), t);
          diffuseColor.rgb *= mix(vec3(1.0), m, uLowOn * (1.0 - 0.55 * air));
        }
        float airLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 airTone = mix(uHorizon, uZenith, 0.6) * 0.55;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(airLum), air * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.22 * air), airTone, air * 0.3);
        float altitude = smoothstep(-0.7, 1.1, vAtmosphere.y + 0.12 * vAtmosphere.x) * (1.0 - uEdgeHero);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(uHorizon, uZenith, altitude), vAtmosphere.z);`);
  };
  material.customProgramCacheKey = () => "backdrop-v4";
  return material;
}

const OFF = new THREE.Vector4(0.2, 0, 0, 0), ONE = new THREE.Vector4(1, 1, 1, 1);
// One detail layer as the ground shader reads it (ground-detail.js gdLayer, without the second scale): luminance ratio
// at strength k times relative chroma, by the layer's opacity (0 until it has loaded).
const LOW_GLSL = `
uniform float uLowOn, uLowTile, uEdgeHalf;
uniform sampler2D uLowA, uLowB;
uniform vec4 uLowLookA, uLowLookB, uLowMeanA, uLowMeanB;
vec3 lowLayer(sampler2D t, vec2 q, vec2 gx, vec2 gy, vec4 look, vec4 mean) {
  float inv = 1.0 / mean.w;
  vec3 c = textureGrad(t, q * inv, gx * inv, gy * inv).rgb;
  float tl = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  vec3 m = max(mix(1.0, tl / look.x, look.y), 0.15) * clamp((c / tl) / mean.xyz, vec3(0.25), vec3(3.0));
  return mix(vec3(1.0), m, look.w);
}
`;

// Smooth value noise for the lowland (seedless, the same everywhere).
const lattice = (x, z) => {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.6 + noise(x * 2.1 + 17, z * 2.1 - 9) * 0.3 + noise(x * 4.3 - 5, z * 4.3 + 31) * 0.1;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

export function createMapEdge(terrain, detail = null) {
  const theme = themeFor(terrain.id), half = terrain.half, p = [], c = [], kinds = [], lows = [];
  const color = (key) => { const v = new THREE.Color(theme[key]); return [v.r, v.g, v.b]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const quad = (a, b, cc, d, ca, cb, ccc, cd, kind = 0, low = null) => {
    p.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    c.push(...ca, ...cb, ...ccc, ...ca, ...ccc, ...cd);
    kinds.push(kind, kind, kind, kind, kind, kind);
    if (low) lows.push(low[0], low[1], low[2], low[0], low[2], low[3]);
    else lows.push(0, 0, 0, 0, 0, 0);
  };
  const surround = surroundFor(terrain.id), sea = surround.ground === "sea" ? surround.sea : null;
  const cliff = color("cliff"), deep = color("cliffDeep"), near = color("outlandNear"), far = color("outland"), haze = color("sky"),
    water = color("water"), foam = color("foam"), lip = mix(color(terrain.id === "classic" ? "dirt" : terrain.biome === "desert" ? "sand" : terrain.biome === "highland" ? "stone" : terrain.biome === "volcanic" ? "dirt" : "grass"), cliff, 0.35);
  // The river bed is cut 0.5 deep; the skirt's top edge follows it.
  // Each river band (maps.json "rivers"); the old river maps have one, at z = 0, with its ford at x = 0.
  // A lake that runs off the map (the W9 isles' sea inlets) dips the skirt's top too; no older lake reaches the edge.
  const top = (x, z) => {
    const river = terrain.river ? terrain.riverNear(z, 4) : null;
    const bed = river && !river.fords.some((c) => Math.abs(x - c.x) <= c.half) ? -0.5 * Math.min(1, 4 - Math.abs(z - river.z)) : 0;
    return terrain.lakes?.length ? Math.min(bed, -terrain.lakeBed(x, z)) : bed;
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
  const foot = sea ?? -CLIFF;
  if (terrain.river) for (const river of terrain.rivers) {
    const x = half + 0.03, bright = mix(water, foam, 0.35), spray = mix(water, foam, 0.9);
    for (const [z0, z1] of [[-3, -1], [-1, 1], [1, 3]].map(([a, b]) => [river.z + a, river.z + b])) {
      const edge = (z) => Math.abs(z - river.z) === 3 ? spray : bright;
      quad([x, -0.09, z0], [x, -0.09, z1], [x, -CLIFF * 0.55, z1], [x, -CLIFF * 0.55, z0], edge(z0), edge(z1), water, water);
      quad([x, -CLIFF * 0.55, z0], [x, -CLIFF * 0.55, z1], [x, -CLIFF + 0.02, z1], [x, -CLIFF + 0.02, z0], water, water, foam, foam);
    }
  }
  // A lake that leaves the map (the W9 isles' inlets) spills down the skirt as a falling sheet, on every side
  // (into the sea where the land has one).
  for (const [axis, sign] of [["x", 1], ["x", -1], ["z", 1], ["z", -1]]) {
    if (!terrain.lakes?.some((l) => (axis === "x" ? sign * l.x : sign * l.z) + l.r > half)) continue;
    const at = (t, y) => (axis === "x" ? [sign * (half + 0.03), y, t] : [t, y, sign * (half + 0.03)]);
    const bright = mix(water, foam, 0.35), mid = Math.max(foot, -CLIFF * 0.55);
    for (let t = -half; t < half; t += 1) {
      const wet = (u) => { const [x, , z] = at(u, 0); return terrain.lakeBed(axis === "x" ? x - sign * 0.05 : x, axis === "z" ? z - sign * 0.05 : z) > 0.2; };
      if (!wet(t) || !wet(t + 1)) continue;
      quad(at(t, -0.09), at(t + 1, -0.09), at(t + 1, mid), at(t, mid), bright, bright, water, water);
      if (mid > foot + 0.05) quad(at(t, mid), at(t + 1, mid), at(t + 1, foot + 0.02), at(t, foot + 0.02), water, water, foam, foam);
    }
  }
  const lowland = buildLowland(terrain, surround, sea, quad, mix, mul, color);
  if (surround.lavaRivers) buildLavaRivers(terrain, surround.lavaRivers, lowland, quad, mix, mul, color);
  buildSilhouettes(terrain, surround, sea, p, c, kinds, lows, mix, mul, color, lowland);
  // The far haze: square rings from the lowland's rim out to the horizon, at the lowland's (or the sea's) level.
  const floor = sea ?? -CLIFF, rim = sea !== null ? mix(water, haze, 0.3) : mix(mix(near, far, 0.5), haze, 0.45);
  const rings = [[LOWLAND, rim], [LOWLAND + 30, mix(rim, haze, 0.6)], [REACH, haze]];
  const corner = (d, sx, sz) => [sx * (half + d), floor, sz * (half + d)];
  for (let i = 0; i < rings.length - 1; i++) {
    const [d0, c0] = rings[i], [d1, c1] = rings[i + 1];
    for (const [a, b] of [[[-1, 1], [1, 1]], [[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]]])
      quad(corner(d0, ...a), corner(d0, ...b), corner(d1, ...b), corner(d1, ...a), c0, c0, c1, c1, sea !== null ? 1 : 0);
  }
  // The triangle's shader sets its clip position; keep its world bounds on the far edge.
  p.push(...corner(REACH, -1, -1), ...corner(REACH, 1, -1), ...corner(REACH, -1, 1));
  c.push(...haze, ...haze, ...haze);
  kinds.push(0, 0, 0);
  lows.push(0, 0, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
  const mesh = new THREE.Mesh(geometry, skyMaterial(terrain, geometry, kinds, lows, detail));
  mesh.name = "backdrop";
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  return mesh;
}

// The lowland below the edge: a heightfield ring of CELL m squares from the cliff foot (y = -CLIFF) out to LOWLAND,
// shaped and coloured by the land (rolling meadow, forest floor, dunes, copper terraces, dark rock, snow and ice,
// basalt with lava rivers, an ash plain), or a sea for the isles: shallow and foamy at the shore, deep further out.
// A dark band at the cliff foot keeps the playable edge clear. Every point stays well below the playable ground.
function buildLowland(terrain, surround, sea, quad, mix, mul, color) {
  const half = terrain.half, kind = surround.ground, R = half + LOWLAND;
  const grass = color("grass"), dirt = color("dirt"), sand = color("sand"), stone = color("stone"), rock = color("rock"), leaf = color("leaf"),
    leafAlt = color("leafAlt"), dust = color("dust"), water = color("water"), shallow = color("shallow"), foam = color("foam"), ford = color("ford");
  const rivers = terrain.rivers || [];
  // Height above the floor, colour and water kind (1 water, 2 lava) of a lowland point.
  const sample = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) - half, rise = smooth(0, 14, d) * (1 - smooth(NEAR - 12, NEAR, d)), n = fbm(x * 0.035 + 3, z * 0.035 - 7), m = fbm(x * 0.11 - 11, z * 0.11 + 5);
    // A river leaving the map runs on across the lowland (east and west: the bands run along x).
    const river = rivers.find((r) => Math.abs(z - r.z) < 6 && Math.abs(x) > half);
    const inRiver = river ? 1 - smooth(2.2, 4.4, Math.abs(z - river.z) + (noise(x * 0.2, z * 0.2) - 0.5) * 1.6) : 0;
    // t: the share of the land's second detail layer (LOWLAND_SLOTS); `patch` lays broad patches of the land's other
    // surfaces (bare earth in a meadow, hardpan between dunes, scree on rock, ice on snow) across the lowland.
    let h = 0, col, k = 0, t = 0;
    const patch = smooth(0.6, 0.78, fbm(x * 0.045 + 40, z * 0.045 - 23));
    switch (kind) {
      case "sea": {
        const shore = smooth(0, 3, d), deepness = smooth(4, 40, d + (n - 0.5) * 10);
        col = mix(mix(foam, shallow, shore), mix(shallow, water, 0.75), deepness);
        // Reef shallows here and there.
        if (m > 0.66 && d > 8) col = mix(col, ford, (m - 0.66) * 1.6);
        return { h: 0, col, k: 1 };
      }
      case "meadow": case "forest": {
        h = rise * (0.9 + 2.1 * n);
        // Three tones: dark grove floor, meadow, sunny clearing; bare earth in the hollows.
        const grove = mul(leaf, kind === "forest" ? 0.45 : 0.55), meadow = mul(mix(grass, leaf, 0.35), 0.7), sunny = mul(mix(grass, leafAlt, 0.45), 0.82);
        col = mix(mix(grove, meadow, smooth(0.3, 0.55, m)), sunny, smooth(0.62, 0.85, m));
        if (n < 0.3) col = mix(col, mul(mix(dirt, grass, 0.3), 0.72), Math.min(1, (0.3 - n) * 3));
        // Broad patches of bare earth and dry grass.
        col = mix(col, mul(mix(dirt, sand, 0.35), 0.74), patch * 0.85);
        t = Math.max(n < 0.3 ? Math.min(1, (0.3 - n) * 3) : 0, patch);
        break;
      }
      case "desert": {
        const dune = Math.pow(0.5 + 0.5 * Math.sin(x * 0.075 + z * 0.045 + n * 5), 2);
        h = rise * (0.5 + 2.4 * dune);
        col = mix(mix(mul(dirt, 0.85), sand, 0.4 + 0.6 * dune), dust, dune * 0.25);
        // Wind lines: pale crests and darker troughs across the dunes.
        const ripple = 0.5 + 0.5 * Math.sin(x * 0.31 + z * 0.19 + n * 6);
        col = mix(col, mul(dust, 0.92), smooth(0.78, 0.97, ripple) * 0.4 * rise);
        col = mul(col, 1 - smooth(0.0, 0.25, ripple) * 0.12 * rise);
        // Hardpan floors between the dunes.
        t = Math.max(1 - dune, patch) * 0.9;
        col = mix(col, mul(dirt, 0.8), patch * 0.5);
        break;
      }
      case "canyon": {
        h = rise * Math.floor((0.4 + 2.8 * n) * 2) / 2;
        col = mix(mul(dirt, 0.82), sand, smooth(0.4, 0.8, m) * 0.6);
        if (h % 1 > 0.4) col = mul(col, 1.1);
        t = Math.max(smooth(0.4, 0.8, m) * 0.6, patch);
        col = mix(col, mul(sand, 0.85), patch * 0.45);
        break;
      }
      case "rock": {
        h = rise * (0.8 + 2.8 * n * n);
        col = mix(mul(stone, 0.78), mul(rock, 0.85), m);
        if (m > 0.62) col = mix(col, mul(grass, 0.75), (m - 0.62) * 2);
        // Dark crevices and pale scree.
        const crack = Math.abs(noise(x * 0.09 + 21, z * 0.09 - 4) - 0.5);
        if (crack < 0.05) col = mul(col, 0.62 + crack * 6);
        else if (n > 0.66) col = mix(col, mul(dust, 0.8), (n - 0.66) * 1.5);
        t = m > 0.62 ? Math.min(1, (m - 0.62) * 2) : 0;
        break;
      }
      case "snow": {
        h = rise * (0.6 + 1.6 * n);
        col = mix(mul(grass, 0.98), mul(dust, 0.95), smooth(0.5, 0.8, m) * 0.5);
        // Frozen hollows: pale ice sheets.
        if (n < 0.38) { col = mix(col, mix(ford, dirt, 0.25), Math.min(1, (0.38 - n) * 3)); h *= 0.6; t = Math.min(1, (0.38 - n) * 3); }
        // Wind-scoured patches of darker crust.
        col = mix(col, mul(mix(stone, grass, 0.6), 0.85), patch * 0.4);
        break;
      }
      case "lava": {
        h = rise * (0.6 + 2.2 * n);
        col = mix(mul(dirt, 0.62), mul(stone, 0.7), m);
        // Warm, lighter scoria patches; the lava rivers are ribbons laid on top (buildLavaRivers).
        if (m > 0.6) col = mix(col, mul(mix(dirt, water, 0.25), 0.8), (m - 0.6) * 1.5);
        // Ash drifts over the basalt.
        col = mix(col, mul(dust, 0.55), patch * 0.5);
        t = patch;
        break;
      }
      default: { // ash
        h = rise * (0.5 + 1.8 * n);
        col = mix(mul(dirt, 0.7), mul(dust, 0.6), smooth(0.45, 0.75, m) * 0.55);
        col = mix(col, mul(mix(grass, dirt, 0.4), 0.7), patch * 0.5);
        t = patch;
        break;
      }
    }
    if (inRiver > 0) { col = mix(col, mix(shallow, water, inRiver), Math.min(1, inRiver * 1.4)); h *= 1 - inRiver; if (inRiver > 0.4) k = kind === "lava" ? 2 : 1; }
    // The plateau's shade: a soft drop below the rim (reaching 20 m out, so it still reads beyond the far edges, where the
    // cliff hides its own foot from the camera) and ambient occlusion right at the cliff foot.
    col = mul(col, (0.36 + 0.64 * smooth(0, 20, d)) * (0.8 + 0.2 * smooth(0, 4, d)));
    return { h: Math.min(h, CLIFF - 3.2), col, k, t };
  };
  const floor = sea ?? -CLIFF;
  const vertex = new Map();
  const at = (x, z) => {
    const key = `${x}|${z}`;
    let v = vertex.get(key);
    if (!v) {
      const s = sample(x, z);
      v = { pos: [x, floor + s.h, z], col: s.col, k: s.k, low: sea === null && s.k === 0 ? 1 + s.t : 0 };
      vertex.set(key, v);
    }
    return v;
  };
  const light = (a, b, cc) => {
    // Flat shading for the fixed sun: slopes facing the light are brighter.
    const ux = b.pos[0] - a.pos[0], uy = b.pos[1] - a.pos[1], uz = b.pos[2] - a.pos[2], vx = cc.pos[0] - a.pos[0], vy = cc.pos[1] - a.pos[1], vz = cc.pos[2] - a.pos[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return 0.74 + 0.5 * ((nx * SUN.x + ny * SUN.y + nz * SUN.z) / l - 0.72) / 0.28;
  };
  // Two grids: CELL m squares over the near band (around the playable square), 2 * CELL m beyond it.
  const grid = (outer, inner, cell) => {
    const n = Math.round((2 * outer) / cell);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x0 = -outer + i * cell, z0 = -outer + j * cell;
        if (x0 >= -inner && x0 + cell <= inner && z0 >= -inner && z0 + cell <= inner) continue; // under the square inside
        const a = at(x0, z0), b = at(x0 + cell, z0), cc = at(x0 + cell, z0 + cell), d = at(x0, z0 + cell);
        const k = sea === null ? Math.max(0.62, Math.min(1.2, light(a, d, cc))) : 1;
        const wet = [a, b, cc, d].some((v) => v.k === 1) ? 1 : [a, b, cc, d].some((v) => v.k === 2) ? 2 : 0;
        quad(a.pos, b.pos, cc.pos, d.pos, mul(a.col, k), mul(b.col, k), mul(cc.col, k), mul(d.col, k), wet, wet ? null : [a.low, b.low, cc.low, d.low]);
      }
  };
  grid(half + NEAR, half, CELL);
  grid(half + LOWLAND, half + NEAR, CELL * 4);
  // The lowland's height at a point (silhouettes stand on it).
  return (x, z) => floor + sample(x, z).h;
}

// Lava rivers on the volcano's lowland: winding ribbons from the cliff foot out into the haze, a white-hot core between
// dark crusted banks (kind 2: the backdrop shader breathes their glow). `perSide` rivers on each side, seeded.
function buildLavaRivers(terrain, perSide, lowland, quad, mix, mul, color) {
  const half = terrain.half, lava = color("water"), hot = mix(color("water"), color("foam"), 0.45), crust = mul(color("dirt"), 0.45);
  let seed = 0x1a7a ^ terrain.size;
  const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let side = 0; side < 4; side++)
    for (let k = 0; k < perSide; k++) {
      // Start at the cliff foot, then wander outward.
      const along = (r() * 1.6 - 0.8) * half, out = [[0, -1], [1, 0], [0, 1], [-1, 0]][side], tan = [-out[1], out[0]];
      let x = out[0] * (half + 1.5) + tan[0] * along, z = out[1] * (half + 1.5) + tan[1] * along, heading = Math.atan2(out[1], out[0]) + (r() - 0.5) * 0.6;
      const pts = [];
      for (let i = 0; i < 34; i++) {
        pts.push([x, z]);
        heading += (noise(x * 0.05 + side * 31, z * 0.05 + k * 17) - 0.5) * 0.45;
        // Keep heading away from the map.
        const away = Math.atan2(out[1], out[0]), diff = Math.atan2(Math.sin(heading - away), Math.cos(heading - away));
        if (Math.abs(diff) > 1.1) heading = away + Math.sign(diff) * 1.1;
        x += Math.cos(heading) * 2.2; z += Math.sin(heading) * 2.2;
      }
      const width = (t) => (0.75 + 0.9 * Math.min(1, t * 3)) * (1 - t * 0.3);
      // Molten in the middle, hotter in patches along the flow; crusted dark banks.
      const glow = (px, pz) => mix(lava, hot, Math.max(0, noise(px * 0.35 + side * 7, pz * 0.35 - k * 5) - 0.45) * 1.8);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], t0 = i / pts.length, t1 = (i + 1) / pts.length;
        const nx = -(bz - az) / 2.2, nz = (bx - ax) / 2.2, w0 = width(t0), w1 = width(t1);
        const y = (px, pz) => lowland(px, pz) + 0.06;
        const P = (px, pz, w, s) => [px + nx * w * s, y(px + nx * w * s, pz + nz * w * s), pz + nz * w * s];
        const ga = glow(ax, az), gb = glow(bx, bz);
        quad(P(ax, az, w0 * 1.7, -1), P(bx, bz, w1 * 1.7, -1), P(bx, bz, w1, -1), P(ax, az, w0, -1), crust, crust, lava, lava, 2);
        quad(P(ax, az, w0, -1), P(bx, bz, w1, -1), P(bx, bz, w1, 1), P(ax, az, w0, 1), ga, gb, gb, ga, 2);
        quad(P(ax, az, w0, 1), P(bx, bz, w1, 1), P(bx, bz, w1 * 1.7, 1), P(ax, az, w0 * 1.7, 1), lava, lava, crust, crust, 2);
      }
    }
}

// Distant silhouettes on the lowland: groves of trees and pines, mesas, spires, rocks, snow ridges, a volcano cone,
// islets with palms. Low-poly, flat-shaded for the fixed sun, merged into the backdrop. Placed from the map size and
// land alone (seeded); none reaches the playable ground's height (y <= -0.3).
function buildSilhouettes(terrain, surround, sea, p, c, kinds, lows, mix, mul, color, lowland) {
  const half = terrain.half, floor = sea ?? -CLIFF;
  let seed = 0x51ed ^ terrain.size ^ (lookOf(terrain.id).length * 977);
  const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const leaf = color("leaf"), leafAlt = color("leafAlt"), wood = color("wood"), rock = color("rock"), stone = color("stone"), sand = color("sand"),
    dust = color("dust"), cliff = color("cliff"), cliffDeep = color("cliffDeep"), foam = color("foam"), grass = color("grass"), lava = color("water");
  const tri = (a, b, cc, col, kind = 0) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    // Double-sided: shade by the side that faces the sun.
    const lit = Math.abs(nx * SUN.x + ny * SUN.y + nz * SUN.z) / l, k = 0.55 + 0.6 * lit;
    p.push(...a, ...b, ...cc);
    for (let i = 0; i < 3; i++) { c.push(col[0] * k, col[1] * k, col[2] * k); kinds.push(kind); lows.push(0); }
  };
  const ring = (x, z, y, rad, n, spin = 0) => Array.from({ length: n }, (_, i) => { const a = spin + (i / n) * Math.PI * 2; return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad]; });
  const cone = (x, z, y0, rad, h, col, tip = col, n = 6, spin = 0) => {
    const base = ring(x, z, y0, rad, n, spin), apex = [x, y0 + h, z];
    for (let i = 0; i < n; i++) tri(base[i], base[(i + 1) % n], apex, i % 2 ? col : mix(col, tip, 0.5));
  };
  const prism = (x, z, y0, r0, r1, h, side, topCol, n = 6, spin = 0, kind = 0) => {
    const lo = ring(x, z, y0, r0, n, spin), hi = ring(x, z, y0 + h, r1, n, spin);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(lo[i], lo[j], hi[j], side); tri(lo[i], hi[j], hi[i], side); }
    for (let i = 1; i < n - 1; i++) tri(hi[0], hi[i], hi[i + 1], topCol, kind);
  };
  // Props stand on the lowland (sunk a little into it), never below the skirt's foot.
  const ground = (x, z) => Math.max(-CLIFF, (sea !== null ? floor : lowland(x, z)) - 0.25);
  const cap = (y, h) => Math.max(0.3, Math.min(h, -0.3 - y)); // no top above y = -0.3
  const SHAPES = {
    tree(x, z, s) { const y = ground(x, z), h = cap(y, 3.4 * s); prism(x, z, y, 0.18 * s, 0.14 * s, h * 0.35, wood, wood, 4); cone(x, z, y + h * 0.3, 1.3 * s, h * 0.7, mul(leaf, 0.75 + r() * 0.2), leafAlt, 7, r()); },
    pine(x, z, s) { const y = ground(x, z), h = cap(y, 4.2 * s), dark = mul(leaf, 0.6 + r() * 0.2), tip = surround.ground === "snow" ? foam : leafAlt; cone(x, z, y + h * 0.15, 1.15 * s, h * 0.6, dark, tip, 6, r()); cone(x, z, y + h * 0.45, 0.8 * s, h * 0.55, dark, tip, 6, r()); },
    bush(x, z, s) { const y = ground(x, z); cone(x, z, y, 1.1 * s, cap(y, 1.2 * s), mul(leaf, 0.7), leafAlt, 6, r()); },
    rock(x, z, s) { const y = ground(x, z), base = surround.ground === "snow" ? mix(rock, foam, 0.3) : rock; prism(x, z, Math.max(-CLIFF, y - 0.2), 1.2 * s, 0.55 * s, cap(y, 1.4 * s), mul(base, 0.85), mix(base, dust, 0.3), 5, r() * 3); },
    snag(x, z, s) { const y = ground(x, z); prism(x + 0.1, z, y, 0.16 * s, 0.04 * s, cap(y, 2.6 * s), mul(wood, 0.8), wood, 4, r()); },
    spire(x, z, s) { const y = ground(x, z), base = surround.ground === "lava" ? mix(stone, rock, 0.6) : mix(stone, rock, 0.5); prism(x, z, Math.max(-CLIFF, y - 0.3), 1.5 * s, 0.25 * s, cap(y, 5.5 * s), base, mix(base, dust, 0.3), 5, r() * 3); },
    mesa(x, z, s) {
      const y = ground(x, z), h = cap(y, 4.6 * s), rad = (5 + r() * 4) * s, spin = r() * 3;
      prism(x, z, Math.max(-CLIFF, y - 0.3), rad, rad * 0.86, h * 0.55, mul(cliff, 0.9), mul(cliff, 0.9), 8, spin);
      prism(x, z, y + h * 0.55 - 0.3, rad * 0.86, rad * 0.78, h * 0.45, mix(cliff, dust, 0.25), mix(sand, dust, 0.4), 8, spin);
    },
    ridge(x, z, s) { const y = ground(x, z), base = mix(foam, dust, 0.3); prism(x, z, Math.max(-CLIFF, y - 0.3), 3.2 * s, 0.9 * s, cap(y, 2.6 * s), mul(base, 0.9), foam, 5, r() * 3); },
    cone(x, z, s) {
      // A distant volcano: dark flanks, a glowing crater.
      const y = floor, h = cap(y, 6.6), rad = 14 * s;
      prism(x, z, y, rad, rad * 0.22, h, mul(cliffDeep, 0.9), mix(lava, foam, 0.3), 9, r(), 2);
    },
    islet(x, z, s) {
      // A low sandy islet with a grassy crown and two or three palms.
      const y = floor, rad = (3.5 + r() * 3) * s;
      prism(x, z, y - 0.3, rad, rad * 0.8, 0.7, mix(sand, dust, 0.3), mix(sand, dust, 0.2), 8, r());
      prism(x, z, y + 0.4, rad * 0.7, rad * 0.45, 0.5, mul(grass, 0.85), mul(grass, 0.95), 7, r());
      for (let k = 0; k < 2 + (r() < 0.5 ? 1 : 0); k++) {
        const px = x + (r() - 0.5) * rad * 0.8, pz = z + (r() - 0.5) * rad * 0.8, ph = cap(y + 0.8, 2.2 + r());
        prism(px, pz, y + 0.8, 0.12, 0.08, ph, wood, wood, 4);
        cone(px + 0.1, pz, y + 0.8 + ph - 0.25, 1.5, 0.45, mul(leaf, 0.85), leafAlt, 5, r());
      }
    },
  };
  // Families stand in clusters of mixed sizes: a big one at the heart, smaller ones scattered in a blob around it (wider
  // and looser further out), with an understory of the land's companions (bushes and stones under trees, small stones
  // round rocks and spires, scree at a mesa's foot), so the edge reads as groves and outcrops, not rows.
  const UNDER = {
    tree: surround.ground === "snow" ? [["rock", 0.5]] : [["bush", 1.4], ["rock", 0.3]],
    pine: surround.ground === "snow" ? [["rock", 0.6]] : [["bush", 0.9], ["rock", 0.4]],
    rock: [["rock", 1.6]], spire: [["rock", 1.4]], snag: [["rock", 0.8]], bush: [["rock", 0.4]],
    mesa: [["rock", 3]], ridge: [["rock", 1]], cone: [], islet: [],
  };
  const perimeter = 8 * half;
  const place = (family, x, z, s, big) => {
    // Never under the playable square, never right against the cliff.
    if (Math.max(Math.abs(x), Math.abs(z)) < half + (big ? 18 : 3.5)) return;
    SHAPES[family](x, z, s);
  };
  for (const [family, per100] of surround.props) {
    const big = family === "cone" || family === "mesa" || family === "islet";
    const groups = Math.max(1, Math.round((perimeter / 100) * per100 / (big ? 1 : 5)));
    for (let g = 0; g < groups; g++) {
      const t = r() * perimeter, side = Math.floor(t / (2 * half)), along = (t % (2 * half)) - half;
      const d = big ? 26 + r() * 40 : 3.5 + Math.pow(r(), 2) * 56;
      const [ox, oz] = [[along, -half - d], [half + d, along], [-along, half + d], [-half - d, -along]][side];
      const members = big ? 1 : 2 + Math.floor(r() * r() * 9);
      const spread = 2.5 + members * 0.9 + d * 0.06;
      for (let m = 0; m < members; m++) {
        const a = r() * Math.PI * 2, rad = m ? spread * Math.sqrt(r()) : 0;
        // The heart is the biggest; the rest shrink toward the blob's rim, each a little different.
        const s = m ? (0.55 + r() * 0.5) * (1 - 0.25 * (rad / spread)) : 1.05 + r() * 0.35;
        place(family, ox + Math.cos(a) * rad, oz + Math.sin(a) * rad, s, big);
      }
      for (const [under, per] of UNDER[family] ?? []) {
        const count = Math.floor(per * (big ? 1 : Math.sqrt(members)) + r());
        for (let u = 0; u < count; u++) {
          const a = r() * Math.PI * 2, rad = big ? 11 + r() * 7 : spread * (0.4 + r() * 0.8);
          place(under, ox + Math.cos(a) * rad, oz + Math.sin(a) * rad, 0.35 + r() * 0.35, false);
        }
      }
    }
  }
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
  const sky = mesh.material?.userData.sky, motion = mesh.material?.userData.motion;
  if (motion) motion.live.value = edge && k > 0 ? 1 - k : 1;
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
