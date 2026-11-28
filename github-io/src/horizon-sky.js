// The Hero-view horizon (owner 2026-11-28: "in landed Skywing mode, maybe add some scene far away like mountain or sea or
// blue sky with very little cloud? if that is cheap"; then "static big moons like the art at the beginning of the game",
// a Saturn-like ring, a comet and a purple night nebula). Loaded by src/horizon-view.js on the first Hero mode entry and
// never drawn in the RTS view. Three draws at most, all far away:
//   dome     one triangle over the whole screen, drawn last among the opaque meshes on the far plane, so only the open
//            sky runs its shader (none of it when Skywing flies and the camera looks down). A gradient from a vivid
//            blue overhead to the backdrop's own horizon haze (the hero fog colour, so the fogged ground meets it without
//            a seam), a warm glow toward the sun's bearing, a few soft clouds of hash noise drifting slowly, stars at
//            night, and a comet (head, coma, a white-blue dust tail and a faint teal ion tail). Everything follows the
//            mission look (day, dusk, night, storm, river fog).
//   ring     low-poly silhouettes in three layers around the camera (far ones bluer and hazier), shaped and coloured by
//            the land (green hills, forest, desert mesas, rocky or snowy peaks, a glowing volcano, islands in the sea),
//            and a sea strip on the side where the map's rivers run out (all round for the isles). 1.8-2.4k triangles
//            (the isles, mostly sea, about 1k).
//   planets  the title key art's worlds (src/art/cover layers, packed by tools/bake-sky-atlas.py into one 1024x512 atlas):
//            the ringed river world (the big one, low over the hills, ring whole), the storm world and the dune moon on
//            the other side, a small dark moon, the amber and silver suns, and at night a violet nebula band behind them.
//            Hazed like a daytime moon by day, full colour at night, dim behind a storm's cloud.
// The distance trick: the ring and planets are placed around the camera (cameraPosition in the vertex shader, so they
// never get nearer) and pushed onto the far plane in clip space: they only fill pixels nothing else drew, so they never
// cover the battlefield, need no second pass, and draw nothing into the shadow map. View only: nothing here reaches the
// simulation. Reduced motion (or the governor's still steps) holds the clouds, stars and the comet's shimmer still.
import * as THREE from "three";
import { lookOf, themeFor } from "./visual-style.js";
import { LOOKS } from "./mission-looks.js";
import { DEG, FRONT, SUN_DIR, RADIUS, ATLAS, skyDir } from "./sky-basis.js";
import { VividSky, VIVID_LOOK, WARM_LANDS, BAND_COLOR, HERO_CLOUDS, NEBULA_TOP, GLOW_TOP } from "./horizon-vivid.js";

export { FRONT, SUN_DIR, RADIUS, ATLAS, skyDir };
// The atlas (tools/bake-sky-atlas.py): Vite emits it with the bundle (precached like the cover art in src/art).
export const ATLAS_URL = new URL("./art/sky/sky-atlas.webp", import.meta.url).href;
// Clip-space depth (z / w) of the ring's layers [far, middle, near, sea]: behind every real surface (only the last 2 m
// before a 140 m far plane are deeper), each layer 84 depth steps (24-bit) in front of the one behind it, and all of
// them in front of the planets and the dome (z = w).
export const DEPTHS = Object.freeze([0.99997, 0.99995, 0.99994, 0.99996]);
export const RING_BASE = -9; // degrees: the silhouettes' feet, deep in the haze
export const RING_HIDDEN = -6; // degrees: a view whose top edge is lower sees only haze there (no draw)
export const TRIANGLES = Object.freeze({ min: 1500, max: 4000 });

// Per land (lookOf): the silhouette style, the day sky's colour overhead, the sun glow and the cloud cover (0-1).
export const SKIES = {
  classic: { style: "ash", zenith: "#2b2d7c", glow: 0.55, glowColor: "#ff9850", cloud: 0.12 },
  riverlands: { style: "hills", zenith: "#2878e2", glow: 0.3, glowColor: "#ffc27a", cloud: 0.2 },
  basin: { style: "mesa", zenith: "#3068cc", glow: 0.42, glowColor: "#ffb46a", cloud: 0.12 },
  expanse: { style: "hills", zenith: "#2270e8", glow: 0.22, glowColor: "#ffd08a", cloud: 0.22 },
  dunes: { style: "mesa", zenith: "#3a5cc4", glow: 0.5, glowColor: "#ffae5a", cloud: 0.08 },
  woodlands: { style: "forest", zenith: "#2472d4", glow: 0.26, glowColor: "#ffd08a", cloud: 0.2 },
  highlands: { style: "peaks", zenith: "#323f86", glow: 0.48, glowColor: "#ffa86a", cloud: 0.16 },
  snowfield: { style: "snow", zenith: "#2a7ce8", glow: 0.26, glowColor: "#ffd6a0", cloud: 0.14 },
  volcano: { style: "volcano", zenith: "#4a2e70", glow: 0.5, glowColor: "#ff7a3a", cloud: 0.1 },
  archipelago: { style: "isles", zenith: "#1784e2", glow: 0.26, glowColor: "#ffd08a", cloud: 0.2 },
};
export const skyFor = (id) => SKIES[lookOf(id)] || SKIES.riverlands;

// The sky of each mission look (mission-looks.js), blended in by its strength k. stars / comet / planets / nebula are
// strengths; day 1 hazes the planets like a daytime moon.
export const LOOK_SKY = {
  day: { glow: null, cloudLit: "#ffffff", cloudShade: "#c6d4ea", stars: 0, comet: 0.24, planets: 1, nebula: 0, day: 1 },
  night: { zenith: "#030a26", glow: 0, cloud: 0.1, cloudLit: "#2a3a66", cloudShade: "#0b1330", stars: 1, comet: 1, planets: 1, nebula: 0.9, day: 0 },
  storm: { zenith: "#25303c", glow: 0, cloud: 0.62, cloudLit: "#6a7684", cloudShade: "#28313c", stars: 0, comet: 0.08, planets: 0.28, nebula: 0.25, day: 0.7 },
  fog: { zenith: "#a3afba", glow: 0.08, cloud: 0.45, cloudLit: "#e2e8ed", cloudShade: "#9ca7b1", stars: 0, comet: 0.08, planets: 0.35, nebula: 0, day: 1 },
  dusk: { zenith: "#2a2864", glow: 0.95, glowColor: "#ff7845", cloud: 0.16, cloudLit: "#ffb08a", cloudShade: "#5a3a64", stars: 0.3, comet: 0.7, planets: 0.95, nebula: 0, day: 0.4 },
};

// The sky's bodies, placed like the key art seen from the start toward the rival: u degrees right of FRONT, el degrees
// above the horizon (the middle), w degrees wide (the height follows the cell). Everything stays under 11.6 degrees,
// inside the sky a portrait phone's shoulder view shows (its top edge is about 11.8 degrees up).
export const BODIES = [
  { name: "amber", u: -37, el: 9.6, w: 2.6 },
  { name: "silver", u: -32, el: 10.3, w: 1.3 },
  { name: "ringed", u: -19, el: 6.1, w: 16.5 }, // the big ringed world, low over the valley, its ring whole
  { name: "ember", u: 9, el: 5.4, w: 1.9 },
  { name: "dunes", u: 18.5, el: 9.4, w: 3.4 },
  { name: "storm", u: 29, el: 7.3, w: 7.6 },
];
// The night nebula: a band behind the bodies from u0 to u1, el0..el1 (a gentle arc), drawn additive.
export const NEBULA = Object.freeze({ u0: -68, u1: 72, el0: 2.2, el1: 11.2, rise: 1.6, segments: 16 });
// The comet: its head (u, el) and the tail's direction on the sky (degrees: 0 = right, 90 = up), length in degrees.
export const COMET = Object.freeze({ u: -2.5, el: 4.2, angle: 58, length: 11 });

// ------------------------------------------------------------------------------------------------ noise (seedless)
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
// Noise around the circle (periodic in the bearing a): `f` features per turn / 2 pi.
const ringNoise = (a, f, seed) => noise(Math.cos(a) * f + seed * 17.31, Math.sin(a) * f - seed * 9.17);
const fbm = (a, f, seed) => ringNoise(a, f, seed) * 0.62 + ringNoise(a, f * 2.3, seed + 1) * 0.28 + ringNoise(a, f * 5.1, seed + 2) * 0.1;
const ridged = (a, f, seed) => 1 - Math.abs(2 * fbm(a, f, seed) - 1);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// The angle between two bearings, -pi..pi.
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------------------------------------ the land's ring
// Where a sea opens on the horizon: the isles all round; a map whose rivers run off the edge (they leave east and west,
// the waterfall on +x) opens to the sea on +x; a map with lakes (the frozen lakes) opens toward its lakes as an ice
// sheet. Lava (the volcano) never makes a sea. Returns null or { bearing, half (radians), ice, all }.
export function seaFor(terrain) {
  const look = lookOf(terrain.id);
  if (look === "archipelago") return { bearing: 0, half: Math.PI, ice: false, all: true };
  if (look === "volcano") return null;
  if (terrain.lakes?.length && look === "snowfield") {
    let x = 0, z = 0, w = 0;
    for (const l of terrain.lakes) { x += l.x * l.r * l.r; z += l.z * l.r * l.r; w += l.r * l.r; }
    const bearing = Math.abs(x) + Math.abs(z) > 1e-6 * w ? Math.atan2(x, z) : Math.PI / 2;
    return { bearing, half: 26 * DEG, ice: true, all: false };
  }
  if (terrain.river || terrain.rivers?.length) return { bearing: Math.PI / 2, half: 28 * DEG, ice: false, all: false };
  if (terrain.lakes?.length) return { bearing: Math.PI / 2, half: 24 * DEG, ice: false, all: false };
  return null;
}

// The three layers of a style: the ridge height (degrees) at bearing a, the sample spacing (degrees), the colour.
function layersFor(style, theme, seed) {
  const c = (key) => new THREE.Color(theme[key]);
  const mix = (a, b, t) => a.clone().lerp(b, t);
  const blue = new THREE.Color("#5a78b8"), haze = new THREE.Color("#9aa8c8");
  const hills = (a, f, s, lo, hi) => lo + (hi - lo) * smooth(0.2, 0.85, fbm(a, f, s));
  const peak = (a, f, s, lo, hi, p) => lo + (hi - lo) * Math.pow(ridged(a, f, s), p);
  const plateau = (a, f, s, lo, hi) => { const t = fbm(a, f, s); return lo + (hi - lo) * (0.25 * t + 0.75 * smooth(0.5, 0.53, t)); };
  const L = (h, step, color, extra = {}) => ({ h, step, color, ...extra });
  switch (style) {
    case "mesa":
      return [
        L((a) => plateau(a, 3.6, seed, 1.2, 4.4), 1.6, mix(c("cliff"), haze, 0.45), { haze: 0.5 }),
        L((a) => plateau(a, 5.5, seed + 5, 0.6, 2.9), 1.3, mix(c("cliff"), c("dust"), 0.2), { haze: 0.24 }),
        L((a) => hills(a, 9, seed + 9, 0.15, 1.1), 1.6, mix(c("sand"), c("dust"), 0.3), { haze: 0.1 }),
      ];
    case "peaks":
      return [
        L((a) => peak(a, 3.4, seed, 1.4, 6.6, 2.0), 2.4, mix(c("stone"), blue, 0.45), { haze: 0.5, snow: 4.2 }),
        L((a) => peak(a, 5, seed + 5, 0.9, 3.8, 1.5), 1.9, mix(c("rock"), c("stone"), 0.4).multiplyScalar(0.85), { haze: 0.26, snow: 3.3 }),
        L((a) => hills(a, 9, seed + 9, 0.3, 1.5), 1.6, mix(c("leaf"), c("rock"), 0.55).multiplyScalar(0.75), { haze: 0.1 }),
      ];
    case "snow":
      return [
        L((a) => peak(a, 3.2, seed, 1.6, 6.4, 1.8), 2.4, mix(c("stone"), blue, 0.4), { haze: 0.45, snow: 2.2 }),
        L((a) => peak(a, 4.8, seed + 5, 0.8, 3.6, 1.4), 1.9, c("rock").multiplyScalar(0.8), { haze: 0.22, snow: 1.6 }),
        L((a) => hills(a, 9, seed + 9, 0.2, 1.1), 1.4, c("leaf").multiplyScalar(0.62), { haze: 0.08, pines: 0.9 }),
      ];
    case "forest":
      return [
        L((a) => peak(a, 3.2, seed, 1.2, 5.2, 1.6), 2.6, mix(c("stone"), blue, 0.5), { haze: 0.5 }),
        L((a) => hills(a, 5.5, seed + 5, 0.7, 2.8), 2, mix(c("leaf"), blue, 0.25).multiplyScalar(0.8), { haze: 0.24 }),
        L((a) => hills(a, 9, seed + 9, 0.3, 1.3), 1.4, c("leaf").multiplyScalar(0.55), { haze: 0.08, pines: 1 }),
      ];
    case "volcano":
      return [
        L((a) => peak(a, 3.4, seed, 1.2, 5, 1.8), 2.4, mix(c("cliffDeep"), new THREE.Color("#5a4a6a"), 0.55), { haze: 0.45 }),
        L((a) => Math.max(peak(a, 5.2, seed + 5, 0.8, 3.2, 1.6), cone(a, 255 * DEG, 6.4, 0.85)), 1.4, mix(c("stone"), c("cliffDeep"), 0.4), { haze: 0.18, crater: { bearing: 255 * DEG, top: 6.4 } }),
        L((a) => hills(a, 9, seed + 9, 0.25, 1.2), 1.6, c("stone").multiplyScalar(0.62), { haze: 0.08 }),
      ];
    case "ash":
      return [
        L((a) => peak(a, 3.6, seed, 1.3, 5.2, 2.0), 2.4, mix(c("cliffDeep"), new THREE.Color("#7a5a8a"), 0.5), { haze: 0.48 }),
        L((a) => peak(a, 6, seed + 5, 0.8, 3.4, 1.3), 1.5, mix(c("cliff"), c("rock"), 0.5).multiplyScalar(0.8), { haze: 0.22 }),
        L((a) => hills(a, 9, seed + 9, 0.3, 1.3), 1.6, c("rock").multiplyScalar(0.7), { haze: 0.08 }),
      ];
    case "isles":
      return [
        L((a) => islands(a, 7, seed, 0.66, 1.8), 1.6, mix(c("leaf"), blue, 0.55), { haze: 0.5 }),
        L((a) => Math.max(islands(a, 4.6, seed + 5, 0.7, 2.4), cone(a, 205 * DEG, 3.6, 1.1) - 0.4), 1.2, mix(c("leaf"), c("rock"), 0.3).multiplyScalar(0.8), { haze: 0.22, island: true }),
        L(() => -5, 4, c("leaf"), { haze: 0.1 }),
      ];
    default: // hills: riverlands, expanse
      return [
        L((a) => peak(a, 3.2, seed, 1.3, 5.4, 1.6), 2.5, mix(c("stone"), blue, 0.5), { haze: 0.5, snow: 4.6 }),
        L((a) => hills(a, 5.5, seed + 5, 0.7, 3), 2, mix(c("leaf"), c("grass"), 0.4).multiplyScalar(0.78), { haze: 0.24 }),
        L((a) => hills(a, 9, seed + 9, 0.25, 1.4), 1.5, c("leaf").multiplyScalar(0.62), { haze: 0.08 }),
      ];
  }
}
// A volcano's cone over the bearing `at`: `top` degrees high with a notched crater, flanks falling `slope` deg per deg.
function cone(a, at, top, slope) {
  const d = Math.abs(wrap(a - at)) / DEG;
  return top - Math.max(d * slope, d < 1.1 ? 0.55 * (1 - d / 1.1) : 0);
}
// Sparse islands: a bump where the noise rises past `gate`, up to `hi` degrees; elsewhere under the sea.
function islands(a, f, seed, gate, hi) {
  const t = fbm(a, f, seed);
  return t > gate ? -0.6 + (hi + 0.6) * smooth(gate, gate + 0.12, t) : -3;
}

// The ring's geometry for a terrain. Non-indexed triangles, each flat-lit (low-poly facets). Attributes: position (on
// the RADIUS sphere around the camera), color (linear, lit), aInfo (snowline elevation in radians, glow 0-1, layer haze,
// the facet's own light for the snow), aMist (the base mist's elevation range in radians: full haze below .x, none above .y).
export function buildRing(terrain) {
  const look = lookOf(terrain.id), theme = themeFor(terrain.id), sky = skyFor(terrain.id);
  const seed = ((terrain.size || 160) * 7 + look.length * 13) % 97;
  const sea = seaFor(terrain), layers = layersFor(sky.style, theme, seed);
  const P = [], C = [], I = [], M = [];
  let rnd = 0x2545f491 ^ (terrain.size || 160);
  const r = () => { rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0; return rnd / 4294967296; };
  const point = (a, el, rad) => { const c = Math.cos(el * DEG) * rad; return [Math.sin(a) * c, Math.sin(el * DEG) * rad, Math.cos(a) * c]; };
  // aMist: the base haze (full below .x, none above .y, radians) and the layer's clip-space depth (.z): nearer layers
  // sit a little nearer, so they cover the farther ones without fighting (24-bit depth: 84 steps apart).
  const mistOf = (index, sea = false) => [-5.5 * DEG, (sea ? -2.6 : -1.4) * DEG, DEPTHS[index]];
  const vert = (p, col, info, mist) => { P.push(...p); C.push(col.r, col.g, col.b); I.push(...info); M.push(...mist); };
  const quad = (a, b, c, d, ca, cb, cc, cd, ia, ib, mist) => {
    vert(a, ca, ia, mist); vert(b, cb, ib, mist); vert(c, cc, ib, mist);
    vert(a, ca, ia, mist); vert(c, cc, ib, mist); vert(d, cd, ia, mist);
  };
  // How a bearing sits for the sky's composition: the valley under the ringed world (its ring stays clear of the hills)
  // and the sea's opening.
  const ringed = BODIES.find((b) => b.name === "ringed"), valleyAt = FRONT - ringed.u * DEG, valleyHalf = (ringed.w / 2 + 2) * DEG;
  const valley = (a) => 1 - smooth(valleyHalf * 0.55, valleyHalf * 1.35, Math.abs(wrap(a - valleyAt)));
  const inSea = (a) => (sea ? (sea.all ? 1 : 1 - smooth(sea.half * 0.75, sea.half * 1.2, Math.abs(wrap(a - sea.bearing)))) : 0);
  const sunYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  const snowColor = new THREE.Color(sky.style === "snow" ? theme.foam : "#f2f6ff");
  const hot = new THREE.Color(theme.water).lerp(new THREE.Color(theme.foam), 0.35), sand = new THREE.Color(theme.sand).lerp(new THREE.Color(theme.dust), 0.3);
  // One layer: columns from the ridge down to the haze, two triangles each; the ridge light follows the slope against
  // the sun's bearing (flanks facing it are lit, peaks toward the sun stand backlit), the feet a little darker.
  const drawLayer = (layer, index) => {
    const n = Math.round(360 / (layer.step * 0.62)), step = (2 * Math.PI) / n, haze = layer.haze ?? 0.2;
    const bearings = Array.from({ length: n }, (_, i) => i * step + (r() - 0.5) * step * 0.5);
    const heights = bearings.map((a, i) => {
      let h = layer.h(a);
      const v = valley(a), s = inSea(a);
      // (across a sea the far layer's tallest peaks stand as distant islands; the nearer layers leave it open)
      if (sea?.all) h *= 1 - 0.4 * v;
      else if (index === 0) h = h * (1 - 0.62 * v) * (1 - 0.7 * s) - 1.2 * s;
      else h = h * (1 - (index === 1 ? 0.5 : 0.35) * v) - 5 * s;
      return h;
    });
    const snowline = layer.snow ? layer.snow * DEG : 9, mist = mistOf(index, !!layer.island);
    const light = (i) => {
      const a = bearings[i], p = bearings[(i + n - 1) % n], q = bearings[(i + 1) % n];
      const da = (wrap(q - p) || step) / DEG, slope = (heights[(i + 1) % n] - heights[(i + n - 1) % n]) / da, d = wrap(sunYaw - a);
      return (1 + 0.32 * Math.max(-1, Math.min(1, -slope * Math.sin(d) * 1.4))) * (1 - 0.2 * Math.max(0, Math.cos(d))) * (0.97 + 0.06 * r());
    };
    const lights = heights.map((_, i) => light(i));
    const glow = (a) => (layer.crater ? Math.max(0, 1 - Math.abs(wrap(a - layer.crater.bearing)) / (1.4 * DEG)) : 0);
    const info = (k, a, g = 0) => [snowline + (r() - 0.5) * 0.6 * DEG, g, haze, k];
    const foot = layer.island ? sand : layer.color;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a0 = bearings[i], a1 = bearings[j] + (j === 0 ? 2 * Math.PI : 0), h0 = heights[i], h1 = heights[j];
      if (h0 < -0.9 && h1 < -0.9) continue; // under the haze or the sea: nothing to draw
      const B0 = point(a0, RING_BASE, RADIUS), B1 = point(a1, RING_BASE, RADIUS);
      const c0 = layer.color.clone().multiplyScalar(lights[i]), c1 = layer.color.clone().multiplyScalar(lights[j]);
      let R0 = point(a0, h0, RADIUS), R1 = point(a1, h1, RADIUS);
      // The volcano's crater: a thin molten rim along the top (it keeps its glow at night), dark rock below it.
      const g0 = glow(a0), g1 = glow(a1);
      if (g0 > 0.05 || g1 > 0.05) {
        const L0 = point(a0, h0 - 0.32 * g0, RADIUS), L1 = point(a1, h1 - 0.32 * g1, RADIUS);
        quad(R0, R1, L1, L0, hot, hot, c1, c0, info(lights[i], a0, g0), info(lights[j], a1, g1), mist);
        R0 = L0; R1 = L1;
      }
      quad(R0, R1, B1, B0, c0, c1, foot.clone().multiplyScalar(lights[j] * 0.8), foot.clone().multiplyScalar(lights[i] * 0.8), info(lights[i], a0), info(lights[j], a1), mist);
    }
    // A tree line on the near forest: pines of mixed sizes standing on the ridge, in clumps with gaps.
    if (layer.pines) {
      const height = (a) => { const t = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / step, i = Math.floor(t) % n, f = t - Math.floor(t); return heights[i] + (heights[(i + 1) % n] - heights[i]) * f; };
      for (let a = 0; a < 2 * Math.PI; a += (0.28 + r() * 0.5) * DEG) {
        const h = height(a);
        if (h < -0.5 || ringNoise(a, 14, seed + 31) < 0.36) continue; // clearings
        const tall = layer.pines * (0.35 + 0.55 * r()) * (0.7 + 0.6 * ringNoise(a, 6, seed + 33)), half = tall * (0.32 + 0.12 * r());
        const col = layer.color.clone().multiplyScalar(0.82 + 0.22 * r());
        const P0 = point(a - half * DEG, h - 0.15, RADIUS), P1 = point(a + half * DEG, h - 0.15, RADIUS), T = point(a, h + tall, RADIUS);
        vert(P0, col, info(1, a), mist); vert(T, col.clone().multiplyScalar(1.12), info(1, a), mist); vert(P1, col, info(1, a), mist);
      }
    }
  };
  drawLayer(layers[0], 0);
  // The sea strip (or the ice sheet): from the haze up to just under the horizon, brighter toward the horizon line.
  if (sea) {
    const deep = new THREE.Color(sea.ice ? theme.ford : theme.outland), shine = new THREE.Color(sea.ice ? theme.foam : theme.shallow).lerp(new THREE.Color(theme.foam), sea.ice ? 0 : 0.2);
    if (!sea.ice) deep.lerp(new THREE.Color(theme.water), 0.45);
    const span = sea.all ? Math.PI : sea.half * 1.25, n = Math.max(8, Math.round((2 * span) / (2 * DEG))), info = [9, 0, 0.1, 1], mist = mistOf(3, true);
    for (let i = 0; i < n; i++) {
      const a0 = sea.bearing - span + (i / n) * 2 * span, a1 = sea.bearing - span + ((i + 1) / n) * 2 * span;
      const T0 = point(a0, -0.1, RADIUS), T1 = point(a1, -0.1, RADIUS), M0 = point(a0, -1.2, RADIUS), M1 = point(a1, -1.2, RADIUS), B0 = point(a0, RING_BASE, RADIUS), B1 = point(a1, RING_BASE, RADIUS);
      quad(M0, M1, T1, T0, deep, deep, shine, shine, info, info, mist);
      quad(B0, B1, M1, M0, deep, deep, deep, deep, info, info, mist);
    }
  }
  drawLayer(layers[1], 1);
  drawLayer(layers[2], 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute("aInfo", new THREE.Float32BufferAttribute(I, 4));
  g.setAttribute("aMist", new THREE.Float32BufferAttribute(M, 3));
  g.userData.triangles = P.length / 9;
  g.userData.snow = snowColor;
  return g;
}

// ------------------------------------------------------------------------------------------------ the planets mesh
// One quad per body (the nebula a curved strip first, so the bodies cover it) on the RADIUS sphere, uv into the atlas.
// aKind: 0 a body (alpha blended), 1 the nebula (added).
export function buildPlanets() {
  const P = [], U = [], K = [], idx = [];
  const [AW, AH] = ATLAS.size, pad = ATLAS.pad;
  const up = new THREE.Vector3(), right = new THREE.Vector3(), d = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const vert = (p, u, v, kind) => { P.push(p.x, p.y, p.z); U.push(u, v); K.push(kind); return K.length - 1; };
  // The nebula: a strip of quads along the arc, the atlas cell's u along it.
  const [nx, ny, nw, nh] = ATLAS.nebula, N = NEBULA;
  const rows = [];
  for (let i = 0; i <= N.segments; i++) {
    const t = i / N.segments, u = N.u0 + (N.u1 - N.u0) * t, lift = N.rise * Math.sin(t * Math.PI);
    const tu = (nx + 2 + (nw - 4) * t) / AW;
    rows.push([vert(skyDir(u, N.el0 + lift, d).multiplyScalar(RADIUS), tu, 1 - (ny + nh - 2) / AH, 1), vert(skyDir(u, N.el1 + lift, d).multiplyScalar(RADIUS), tu, 1 - (ny + 2) / AH, 1)]);
  }
  for (let i = 0; i < N.segments; i++) idx.push(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][0], rows[i + 1][1], rows[i][1]);
  for (const b of BODIES) {
    const [x, y, w, h] = ATLAS[b.name], aspect = (w - 2 * pad) / (h - 2 * pad);
    skyDir(b.u, b.el, d);
    right.set(-Math.cos(FRONT - b.u * DEG), 0, Math.sin(FRONT - b.u * DEG));
    up.copy(Y).addScaledVector(d, -d.y).normalize();
    const hw = Math.tan((b.w / 2) * DEG) * RADIUS, hh = hw / aspect, c = d.clone().multiplyScalar(RADIUS);
    const u0 = (x + pad) / AW, u1 = (x + w - pad) / AW, v0 = 1 - (y + h - pad) / AH, v1 = 1 - (y + pad) / AH;
    const a = vert(c.clone().addScaledVector(right, -hw).addScaledVector(up, -hh), u0, v0, 0);
    const bq = vert(c.clone().addScaledVector(right, hw).addScaledVector(up, -hh), u1, v0, 0);
    const cq = vert(c.clone().addScaledVector(right, hw).addScaledVector(up, hh), u1, v1, 0);
    const dq = vert(c.clone().addScaledVector(right, -hw).addScaledVector(up, hh), u0, v1, 0);
    idx.push(a, bq, cq, a, cq, dq);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(K, 1));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------------------------------------ shaders
const SKY_COMMON = /* glsl */ `
uniform vec3 uHorizon, uZenith, uGlow, uSun;
vec3 skyBase(vec3 d) {
  float el = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, 1.0 - exp(-el * 8.5));
  vec2 h = d.xz / max(length(d.xz), 1e-4), s = normalize(uSun.xz);
  float face = max(dot(h, s), 0.0);
  float low = exp(-max(d.y, -0.02) * 7.0);
  c += uGlow * (pow(face, 7.0) * low + 0.22 * face * face * exp(-el * 14.0));
  return c;
}`;
const DOME_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 view = inverse(projectionMatrix) * vec4(position.xy, 1.0, 1.0);
  vDir = transpose(mat3(viewMatrix)) * (view.xyz / view.w);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;
const DOME_FS = /* glsl */ `
${SKY_COMMON}
uniform float uTime, uCloud, uStars, uComet, uFlash;
uniform vec3 uCloudLit, uCloudShade, uCometHead, uCometTail, uCometSide;
// The Vivid sky (horizon-vivid.js; uVivid 0 = the Calm sky, exactly as before): a dark indigo-violet gradient, the
// nebula band twice round the sky, two hero clouds, the land's horizon glow band, and the warm flash of a big blast.
uniform float uVivid, uFront, uNebK, uNebReady, uHeroReady, uGlowK, uGlowReady, uGlowRow;
uniform vec3 uVLow, uVZenith, uBlast;
uniform vec4 uHeroA, uHeroB;
uniform sampler2D uNebulaMap, uHeroes, uGlowBand;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float tri(float t) { t = fract(t); return 1.0 - abs(1.0 - 2.0 * t); }
vec3 srgbLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec4 unpm(vec4 t) { return t.a > 0.002 ? vec4(srgbLin(clamp(t.rgb / t.a, 0.0, 1.0)) * t.a, t.a) : vec4(0.0); }
// Stars (fixed on the sky, a slow twinkle).
vec3 stars(vec3 d, float up) {
  vec2 sc = vec2(atan(d.z, d.x), asin(d.y)) * 70.0;
  vec2 cell = floor(sc), f = fract(sc) - 0.5;
  float h = hash(cell);
  if (h <= 0.88) return vec3(0.0);
  vec2 o = vec2(hash(cell + 11.7), hash(cell + 3.1)) - 0.5;
  float px = max(fwidth(sc.y), 1e-3), r = max(0.1, 1.1 * px);
  float b = (1.0 - smoothstep(r * 0.4, r, length(f - o * 0.6))) * (0.35 + 0.65 * fract(h * 13.7));
  b *= 0.75 + 0.25 * sin(uTime * (1.1 + 2.0 * fract(h * 7.3)) + h * 40.0);
  return vec3(0.8, 0.87, 1.0) * b * uStars * up;
}
vec3 vividBase(vec3 d) {
  float el = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uVLow, smoothstep(0.0, 0.075, el));
  c = mix(c, uVZenith, smoothstep(0.05, 0.42, el));
  vec2 h = d.xz / max(length(d.xz), 1e-4), s = normalize(uSun.xz);
  float face = max(dot(h, s), 0.0);
  return c + uGlow * (pow(face, 7.0) * exp(-max(d.y, -0.02) * 7.0) + 0.22 * face * face * exp(-el * 14.0));
}
// A placed hero cloud: H = (bearing, width (rad), its share of the sheet's width, its row's v).
vec4 heroCloud(vec4 H, float yaw, float ev) {
  float da = atan(sin(yaw - H.x), cos(yaw - H.x)), u = 0.5 - da / H.y;
  vec4 t = unpm(texture2D(uHeroes, vec2(clamp(u, 0.0, 1.0) * H.z, H.w + 0.004 + 0.492 * clamp(ev, 0.0, 1.0))));
  return t * step(0.0, u) * step(u, 1.0) * step(0.0, ev) * step(ev, 1.0);
}
void main() {
  vec3 d = normalize(vDir);
  bool vivid = uVivid > 0.5;
  vec3 c = vivid ? vividBase(d) : skyBase(d);
  float up = smoothstep(0.004, 0.05, d.y), neb = 0.0, band = 0.0, cover = 0.0;
  float el = asin(clamp(d.y, -1.0, 1.0)), yaw = atan(d.x, d.z), t = (yaw - uFront) / 6.2831853;
  if (vivid) {
    if (uStars > 0.001 && d.y > 0.0) c += stars(d, up);
    // The nebula band, twice round (tri: the second copy mirrored, so both joins are seamless), the second lifted a
    // little; slow noise on the circle thins and thickens it so the repeat is not seen.
    float ev = el / ${(NEBULA_TOP * DEG).toFixed(5)};
    float v = ev - 0.1 * (0.5 - 0.5 * cos(yaw - uFront));
    // (the mirror joins sit 90 degrees either side of the key art's bearing, never in its middle)
    vec4 n = unpm(texture2D(uNebulaMap, vec2(tri(t + 0.25), clamp(v, 0.002, 0.998)))) * step(0.0, v) * step(v, 1.0);
    vec2 ring = vec2(cos(yaw), sin(yaw)) * 2.9;
    float dens = vnoise(ring + vec2(uTime * 0.006, el * 9.0)) * 0.7 + vnoise(ring * 2.3 + vec2(el * 21.0, -uTime * 0.01)) * 0.3;
    float k = uNebK * uNebReady * mix(0.3, 1.35, dens);
    c = c * (1.0 - 0.5 * n.a * k) + n.rgb * k;
    neb = n.a * k;
    float kh = uNebK * uHeroReady * 1.1;
    vec4 ha = heroCloud(uHeroA, yaw, ev), hb = heroCloud(uHeroB, yaw, ev);
    c = c * (1.0 - 0.5 * ha.a * kh) + ha.rgb * kh;
    c = c * (1.0 - 0.5 * hb.a * kh) + hb.rgb * kh;
    neb = max(neb, max(ha.a, hb.a) * kh);
  }
  // A few soft clouds on a high flat layer (very little cover by day), drifting slowly.
  if (uCloud > 0.001 && d.y > 0.004) {
    vec2 p = d.xz / (d.y + 0.07) * 0.55 + vec2(uTime * 0.0045, uTime * 0.0018);
    float n = vnoise(p) * 0.62 + vnoise(p * 2.4 + 7.3) * 0.26 + vnoise(p * 5.3 - 3.1) * 0.12;
    cover = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.2, n) * up;
    vec2 h = d.xz / max(length(d.xz), 1e-4);
    float lit = 0.5 + 0.5 * dot(h, normalize(uSun.xz));
    vec3 cc = mix(uCloudShade, uCloudLit, clamp(0.35 + 0.65 * smoothstep(0.5, 0.95, n) * (0.6 + 0.4 * lit), 0.0, 1.0));
    c = mix(c, cc + uGlow * 0.25 * lit, cover * 0.88);
  }
  // Stars at night (the Calm sky draws them over its clouds, as before).
  if (!vivid && uStars > 0.001 && d.y > 0.0) c += stars(d, up);
  if (vivid) {
    // The land's horizon glow band (warm dusk or teal haze row), rising out of the haze.
    float gv = clamp(el / ${(GLOW_TOP * DEG).toFixed(5)}, 0.0, 1.0);
    vec4 g = unpm(texture2D(uGlowBand, vec2(tri(t + 0.25), uGlowRow + 0.006 + 0.488 * gv)));
    float gk = uGlowK * uGlowReady * smoothstep(-0.003, 0.025, d.y) * step(el, ${(GLOW_TOP * DEG).toFixed(5)});
    c = c * (1.0 - 0.6 * g.a * gk) + g.rgb * gk;
    band = g.a * gk;
  }
  // The comet: a bright head in a soft coma, a curved white-blue dust tail and a straight faint teal ion tail.
  if (uComet > 0.001) {
    float z = dot(d, uCometHead);
    if (z > 0.96) {
      vec2 q = vec2(dot(d, uCometTail), dot(d, uCometSide));
      float r = length(q);
      vec3 add = vec3(0.96, 0.98, 1.0) * (exp(-r * r / 0.0000045) * 1.4 + exp(-r / 0.0065) * 0.4);
      float x = q.x;
      if (x > 0.0) {
        float L = ${(COMET.length * DEG).toFixed(4)}, t = x / L;
        float shimmer = 0.88 + 0.12 * sin(x * 140.0 - uTime * 0.5 + q.y * 300.0);
        float yd = q.y + 0.22 * x * t, wd = 0.0035 + 0.075 * x;
        float dust = exp(-yd * yd / (wd * wd)) * (1.0 - smoothstep(0.0, 1.0, t)) * (1.0 - 0.45 * t);
        float wi = 0.0015 + 0.022 * x;
        float ion = exp(-q.y * q.y / (wi * wi)) * (1.0 - smoothstep(0.1, 1.2, t));
        add += (vec3(0.78, 0.88, 1.0) * dust * 0.55 + vec3(0.3, 0.95, 0.88) * ion * 0.32) * shimmer;
      }
      c += add * uComet * smoothstep(0.0, 0.01, d.y);
    }
  }
  // The sky answers the battle (sky-events.js SkyFlash): a big blast warms the glow band, the low nebula and clouds.
  if (vivid) c += uBlast * (1.0 - smoothstep(0.0, 0.26, el)) * (0.3 + 1.2 * band + neb + 0.8 * cover) * smoothstep(-0.01, 0.01, d.y);
  // Below the horizon the open sky is the haze itself (the fog colour), lightning lifts it all.
  c = mix(uHorizon, c, smoothstep(-0.03, 0.0, d.y));
  c += vec3(0.8, 0.86, 1.0) * uFlash * 0.35;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const RING_VS = /* glsl */ `
attribute vec4 aInfo;
attribute vec3 aMist;
varying vec3 vColor, vDir;
varying vec4 vInfo;
varying vec2 vMist;
void main() {
  vColor = color; vInfo = aInfo; vMist = aMist.xy; vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
  p.z = p.w * aMist.z;
  gl_Position = p;
}`;
const RING_FS = /* glsl */ `
uniform vec3 uHorizon, uZenith, uEdgeLo, uEdgeHi, uSnow;
uniform float uEdgeK, uNightGlow;
varying vec3 vColor, vDir;
varying vec4 vInfo;
varying vec2 vMist;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.z, d.x);
  vec3 c = vColor;
  // Snow caps above the layer's snowline (ragged).
  float snow = smoothstep(vInfo.x, vInfo.x + 0.004, el + 0.0035 * sin(az * 41.0) + 0.002 * sin(az * 97.0));
  c = mix(c, uSnow * vInfo.w, snow);
  // A mission look recolours the silhouettes by brightness (map-edge.js edgeColor); molten rock keeps its glow.
  float l = min(1.0, pow(max(0.0, dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.8) * 1.6);
  vec3 tinted = c + (uEdgeLo + (uEdgeHi - uEdgeLo) * l - c) * uEdgeK;
  c = mix(tinted, c * (1.0 + uNightGlow), vInfo.y);
  // Aerial perspective: the farther layers bluer and paler, and all of them rising out of the horizon haze.
  c = mix(c, mix(uHorizon, uZenith, 0.22), vInfo.z * (1.0 - vInfo.y));
  c = mix(uHorizon, c, smoothstep(vMist.x, vMist.y, el));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const PLANET_VS = /* glsl */ `
attribute float aKind;
varying vec2 vUv;
varying vec3 vDir;
varying float vKind;
void main() {
  vUv = uv; vDir = position; vKind = aKind;
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
  p.z = p.w; // on the far plane: only the open sky takes it
  gl_Position = p;
}`;
const PLANET_FS = /* glsl */ `
${SKY_COMMON}
uniform sampler2D uMap;
uniform float uDay, uPlanets, uNebula;
varying vec2 vUv;
varying vec3 vDir;
varying float vKind;
void main() {
  vec4 t = texture2D(uMap, vUv);
  vec3 d = normalize(vDir);
  float rise = smoothstep(-0.01, 0.02, d.y);
  if (vKind > 0.5) {
    gl_FragColor = vec4(t.rgb * uNebula * rise, 1.0);
    #include <colorspace_fragment>
    gl_FragColor.a = 0.0; // added
    return;
  }
  float lum = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722));
  // A daytime moon: the dark side melts into the blue and a little haze lies over the lit side.
  float a = t.a * uPlanets * rise * mix(1.0, 0.6 + 0.4 * smoothstep(0.02, 0.25, lum), uDay);
  vec3 c = mix(t.rgb, skyBase(d), 0.1 * uDay);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}`;

// ------------------------------------------------------------------------------------------------ the sky itself
const TMP = new THREE.Color(), color = (hex) => TMP.set(hex); // one scratch colour: apply() runs every frame
const TMP2 = new THREE.Color(), TMP3 = new THREE.Color();
const lerpN = (a, b, k) => a + (b - a) * k;
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
// The warm orange a big blast throws on the low sky (sky-events.js SkyFlash), at full strength.
export const BLAST_COLOR = Object.freeze(new THREE.Color("#ff7a2e"));
export const BLAST_GAIN = 0.75;

export class HorizonSky {
  // atlasUrl: the key-art atlas (null: none, as in node tests); art: load the Vivid sky's sheets (default: in a page).
  constructor(view, { atlasUrl = ATLAS_URL, art = !!atlasUrl && typeof document !== "undefined" } = {}) {
    this.view = view;
    this.root = new THREE.Group();
    this.root.name = "horizon";
    this.time = 0;
    this.terrainKey = null;
    this.atlasReady = false;
    this.mode = "vivid";
    this.blast = 0;
    const common = { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSun: { value: SUN_DIR.clone() } };
    const yawOf = (u) => FRONT - u * DEG, [A, B] = HERO_CLOUDS;
    this.uniforms = {
      ...common, uTime: { value: 0 }, uCloud: { value: 0.2 }, uStars: { value: 0 }, uComet: { value: 0.3 }, uFlash: { value: 0 },
      uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
      uCometHead: { value: skyDir(COMET.u, COMET.el) }, uCometTail: { value: new THREE.Vector3() }, uCometSide: { value: new THREE.Vector3() },
      uEdgeLo: { value: new THREE.Color() }, uEdgeHi: { value: new THREE.Color() }, uEdgeK: { value: 0 }, uNightGlow: { value: 0 }, uSnow: { value: new THREE.Color("#f2f6ff") },
      uMap: { value: null }, uDay: { value: 1 }, uPlanets: { value: 1 }, uNebula: { value: 0 },
      // The Vivid dome (horizon-vivid.js): 0 = the Calm sky.
      uVivid: { value: 0 }, uFront: { value: FRONT }, uNebK: { value: 0 }, uNebReady: { value: 0 }, uHeroReady: { value: 0 },
      uGlowK: { value: 0 }, uGlowReady: { value: 0 }, uGlowRow: { value: 0 }, uVLow: { value: new THREE.Color() }, uVZenith: { value: new THREE.Color() },
      uBlast: { value: new THREE.Color(0, 0, 0) },
      uHeroA: { value: new THREE.Vector4(yawOf(A.u), A.w * DEG, 1, 0.5) }, uHeroB: { value: new THREE.Vector4(yawOf(B.u), B.w * DEG, 0.75, 0) },
      uNebulaMap: { value: null }, uHeroes: { value: null }, uGlowBand: { value: null },
    };
    this.cometFrame();
    const U = this.uniforms, pick = (...names) => Object.fromEntries(names.map((n) => [n, U[n]]));
    // The dome: one clip-space triangle on the far plane, drawn after every opaque mesh (only the open sky runs it).
    const domeGeo = new THREE.BufferGeometry();
    domeGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.dome = this.mesh("horizon-dome", domeGeo, new THREE.ShaderMaterial({
      uniforms: pick("uHorizon", "uZenith", "uGlow", "uSun", "uTime", "uCloud", "uStars", "uComet", "uFlash", "uCloudLit", "uCloudShade", "uCometHead", "uCometTail", "uCometSide",
        "uVivid", "uFront", "uNebK", "uNebReady", "uHeroReady", "uGlowK", "uGlowReady", "uGlowRow", "uVLow", "uVZenith", "uBlast", "uHeroA", "uHeroB", "uNebulaMap", "uHeroes", "uGlowBand"),
      vertexShader: DOME_VS, fragmentShader: DOME_FS,
      depthWrite: false, fog: false, toneMapped: false,
    }), 1001);
    // The ring (built per land in update()).
    this.ringMaterial = new THREE.ShaderMaterial({
      uniforms: pick("uHorizon", "uZenith", "uEdgeLo", "uEdgeHi", "uEdgeK", "uNightGlow", "uSnow"),
      vertexShader: RING_VS, fragmentShader: RING_FS, vertexColors: true, fog: false, toneMapped: false,
    });
    this.ring = this.mesh("horizon-ring", new THREE.BufferGeometry(), this.ringMaterial, 1000);
    // The planets: blended over the dome (premultiplied: the nebula's alpha 0 adds it), before every other transparent.
    this.planets = this.mesh("horizon-planets", buildPlanets(), new THREE.ShaderMaterial({
      uniforms: pick("uHorizon", "uZenith", "uGlow", "uSun", "uMap", "uDay", "uPlanets", "uNebula"),
      vertexShader: PLANET_VS, fragmentShader: PLANET_FS, transparent: true, depthWrite: false, fog: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }), -1000);
    this.planets.visible = false;
    // The Vivid sky's layers (horizon-vivid.js; their sheets load the first time a Vivid sky shows).
    this.vivid = new VividSky(this, { art });
    view.scene.add(this.root);
    if (atlasUrl && typeof document !== "undefined") {
      new THREE.TextureLoader().load(atlasUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 2;
        texture.needsUpdate = true;
        this.uniforms.uMap.value = texture;
        this.uniforms.uMapReady.value = 1;
        this.atlasReady = true;
      });
    }
    // The sky's colours for the Hero-view water (water-close-view.js): its zenith and horizon, as bright as the backdrop's.
    this.water = { horizon: new THREE.Color(), zenith: new THREE.Color(), ready: false };
    this.state = { dome: false, ring: false, planets: false, bodies: false, meteors: false, event: false, triangles: 0, style: null, sea: null, look: null, mode: "vivid" };
  }
  mesh(name, geometry, material, order) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.frustumCulled = false; // placed in the shader around the camera
    m.matrixAutoUpdate = false;
    m.renderOrder = order;
    m.castShadow = m.receiveShadow = false;
    m.raycast = () => {}; // never picked: its geometry is not where it is drawn
    this.root.add(m);
    return m;
  }
  // The comet's frame on the sky: the head, the tail's direction and its side (unit vectors).
  cometFrame() {
    const U = this.uniforms, head = U.uCometHead.value, a = COMET.angle * DEG;
    const right = new THREE.Vector3(-Math.cos(FRONT - COMET.u * DEG), 0, Math.sin(FRONT - COMET.u * DEG));
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(head, -head.y).normalize();
    U.uCometTail.value.copy(right).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a)).normalize();
    U.uCometSide.value.crossVectors(head, U.uCometTail.value).normalize();
  }
  // The land's ring: rebuilt when the terrain changes.
  setTerrain(terrain) {
    const key = `${terrain.id}|${terrain.size}|${terrain.half}`;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    this.ring.geometry.dispose();
    this.ring.geometry = buildRing(terrain);
    this.uniforms.uSnow.value.copy(this.ring.geometry.userData.snow);
    const sea = seaFor(terrain);
    this.state.triangles = this.ring.geometry.userData.triangles;
    this.state.style = skyFor(terrain.id).style;
    this.state.sea = sea ? (sea.all ? "all" : sea.ice ? "ice" : "sea") : null;
  }
  // The highest elevation (radians) any part of the view reaches: what of the sky can show at all.
  topElevation() {
    const cam = this.view.camera;
    if (!cam?.isPerspectiveCamera) return -Math.PI / 2;
    const t = Math.tan((cam.fov * DEG) / 2), aspect = cam.aspect || 1, e = cam.matrixWorld.elements;
    let top = -Infinity;
    for (const [sx, sy] of [[-1, 1], [1, 1], [0, 1], [-1, -1], [1, -1]]) {
      // camera-space ray (sx t aspect, sy t, -1) to world: columns 0, 1, 2 of the camera matrix
      const x = sx * t * aspect, y = sy * t;
      const wx = e[0] * x + e[4] * y - e[8], wy = e[1] * x + e[5] * y - e[9], wz = e[2] * x + e[6] * y - e[10];
      top = Math.max(top, Math.asin(wy / Math.hypot(wx, wy, wz)));
    }
    return top;
  }
  // on: the hero camera is up and the horizon allowed; dt: the frame's game time (0 while paused or held).
  // mode: Settings > Hero > Sky ("calm", "vivid", "burning"); plan: the match's sky (sky-events.js skyPlan) and its
  // seed; blast: the sky flash now (0-1, sky-events.js SkyFlash); level: the governor's level name.
  update(sim, dt, on, { mode = "vivid", plan = null, seed = "none", blast = 0 } = {}) {
    const v = this.view;
    this.root.visible = on;
    if (!on) { Object.assign(this.state, { dome: false, ring: false, planets: false, bodies: false, meteors: false, event: false, war: false }); return; }
    this.setTerrain(v.terrain);
    const top = this.topElevation(), level = v.closeLevel || "full", rescue = level === "rescue", vivid = mode !== "calm";
    this.mode = mode;
    if (plan) this.vivid.setPlan(plan, seed);
    this.dome.visible = true;
    // (below -6 degrees the ring is all haze, the colour the dome already gives the open sky there)
    this.ring.visible = !rescue && top > RING_HIDDEN * DEG;
    this.planets.visible = !vivid && !rescue && this.atlasReady && top > 0;
    // The clock: still with reduced motion or the governor's still steps, and while the game is paused.
    const lively = (v.motionLevel ?? 2) > 0 && !v.reducedMotion?.matches;
    if (lively && dt > 0) this.time += Math.min(dt, 0.05);
    // The Vivid layers: the governor's rescue step drops the meteors, the event and the far ring first (the bodies stay).
    // (its own big moments, a landing flare or a bloom in orbit, ask horizon-view.js for a sky flash: flashAsk)
    const ask = this.vivid.update({ vivid, show: top > 0, lively, level, time: this.time });
    this.blast = vivid ? blast : 0;
    Object.assign(this.state, { dome: true, ring: this.ring.visible, planets: this.planets.visible, top: top / DEG, mode, lively, flashAsk: ask, ...this.vivid.report() });
    this.state.gpuBytes += this.atlasReady ? Math.round(1024 * 512 * 4 * 4 / 3) : 0;
    this.apply();
  }
  // Colours and strengths for the land and the mission look (view.mood: mission-look-view.js).
  apply() {
    const v = this.view, U = this.uniforms, land = skyFor(v.terrain.id), mood = v.mood?.state || { name: null, k: 0, flash: 0 };
    const name = mood.name && LOOK_SKY[mood.name] ? mood.name : null, k = name ? mood.k : 0, def = name ? LOOKS[name] : null;
    const L = name ? LOOK_SKY[name] : LOOK_SKY.day, D = LOOK_SKY.day;
    const ks = def?.skyGather ? k ** def.skyGather : k;
    // The horizon is the backdrop's own haze (the hero fog's colour, tinted by the look: map-edge.js tintEdge).
    const sky = v.backdrop?.material?.userData?.sky, haze = sky?.horizon;
    if (haze) U.uHorizon.value.copy(haze); else U.uHorizon.value.set(themeFor(v.terrain.id).sky);
    U.uZenith.value.set(land.zenith).lerp(color(L.zenith || land.zenith), ks);
    U.uGlow.value.set(land.glowColor).lerp(color(L.glowColor || land.glowColor), k).multiplyScalar(lerpN(land.glow, L.glow ?? land.glow, k));
    U.uCloud.value = lerpN(land.cloud, L.cloud ?? land.cloud, ks);
    U.uCloudLit.value.set(D.cloudLit).lerp(color(L.cloudLit), ks);
    U.uCloudShade.value.set(D.cloudShade).lerp(color(L.cloudShade), ks);
    U.uStars.value = lerpN(D.stars, L.stars, k);
    U.uComet.value = lerpN(D.comet, L.comet, k);
    U.uPlanets.value = lerpN(D.planets, L.planets, ks);
    U.uNebula.value = lerpN(D.nebula, L.nebula, k);
    U.uDay.value = lerpN(D.day, L.day, k);
    U.uFlash.value = mood.flash || 0;
    U.uTime.value = this.time;
    const vivid = this.mode !== "calm";
    U.uVivid.value = vivid ? 1 : 0;
    if (vivid) {
      // The Vivid sky: dark indigo to violet on every map, darker still at night and in a storm (horizon-vivid.js).
      const VD = VIVID_LOOK.day, VL = (name && VIVID_LOOK[name]) || VD;
      U.uVLow.value.set(VD.low).lerp(color(VL.low), ks);
      U.uVZenith.value.set(VD.zenith).lerp(color(VL.zenith), ks);
      U.uZenith.value.copy(U.uVZenith.value); // (the far ring's aerial perspective follows it)
      U.uStars.value = lerpN(VD.stars, VL.stars, k);
      U.uNebK.value = lerpN(VD.nebula, VL.nebula, k);
      U.uGlowK.value = lerpN(VD.band, VL.band, k);
      U.uCloud.value = lerpN(VD.cloud, VL.cloud, ks);
      U.uCloudLit.value.set(VD.cloudLit).lerp(color(VL.cloudLit), ks);
      U.uCloudShade.value.set(VD.cloudShade).lerp(color(VL.cloudShade), ks);
      U.uPlanets.value = lerpN(VD.planets, VL.planets, ks);
      U.uGlow.value.multiplyScalar(lerpN(VD.glow, VL.glow, k));
      const warm = (name === "dusk" && k > 0.5) || WARM_LANDS.has(lookOf(v.terrain.id));
      U.uGlowRow.value = warm ? 0.5 : 0;
      U.uBlast.value.copy(BLAST_COLOR).multiplyScalar(this.blast * BLAST_GAIN);
      U.uHaze.value.copy(U.uVLow.value).lerp(U.uHorizon.value, 0.3); // the far ships' and the ring's distance haze
      this.state.band = warm ? "warm" : "teal";
    } else { U.uBlast.value.setRGB(0, 0, 0); this.state.band = null; }
    // The water's sky (water-close-view.js): this dome's zenith and its horizon (the glow band's colour over the haze in
    // a Vivid sky), each as bright as the backdrop's own (the water keeps its light; it takes the sky's hue).
    const wz = vivid ? TMP2.copy(U.uVLow.value).lerp(U.uVZenith.value, 0.35) : TMP2.copy(U.uZenith.value);
    const wh = vivid ? TMP3.copy(U.uHorizon.value).lerp(color(this.state.band === "warm" ? BAND_COLOR.warm : BAND_COLOR.teal), 0.45) : TMP3.copy(U.uHorizon.value);
    const W = this.water, match = (out, c, target) => out.copy(c).multiplyScalar(Math.min(20, Math.max(0.3, lum(target) / Math.max(lum(c), 1e-4))));
    match(W.zenith, wz, sky?.zenith || wz);
    match(W.horizon, wh, sky?.horizon || wh);
    W.ready = true;
    // The silhouettes take the look's edge colours (night: black-blue, storm: blue-grey) like the backdrop does.
    if (def?.edge) { U.uEdgeLo.value.set(def.edge.low); U.uEdgeHi.value.set(def.edge.high); U.uEdgeK.value = k; } else U.uEdgeK.value = 0;
    U.uNightGlow.value = name === "night" ? 0.6 * k : 0;
    this.state.look = name ? `${name}:${k.toFixed(2)}` : "day";
  }
  // Draw calls this sky adds now (Calm: 3 at most; Vivid: the dome, the ring and the Vivid layers).
  get draws() {
    if (!this.root.visible) return 0;
    return [this.dome, this.ring, this.planets].filter((m) => m.visible && (m !== this.ring || m.geometry.attributes.position)).length + this.vivid.draws;
  }
  dispose() {
    for (const m of [this.dome, this.ring, this.planets]) m.geometry.dispose();
    this.dome.material.dispose(); this.ringMaterial.dispose(); this.planets.material.dispose();
    this.vivid.dispose();
    this.uniforms.uMap.value?.dispose();
    this.root.removeFromParent();
  }
}
