import * as THREE from "three";
import { lookOf, themeFor } from "./visual-style.js";
import { outward } from "./plateau-relief.js";

// Ground detail (V1 terrain round, 2026-11-26): tiled detail layers over the painted ground. View only.
//
// The painted ground (ground-paint.js) stays the macro colour: each map's palette, its accent patches and every
// rules mark (plateau lips, ramps and their kill zones, ember cracks, crossings, the foam lines) come from it as
// before. On top, the ground shader blends up to seven tileable layers (public/textures/ground/<layer>.webp, 512 px
// on High; textures/ground/256/<layer>.webp on Eco and phones) by a splat of the same surfaces the paint used
// (Terrain.at, with the paint's warped borders). Each layer modulates the painted colour by its luminance ratio to its
// own mean (strength k per layer) and by its chroma relative to its own mean chroma (texture review 2026-11-26): on
// average 1, so a map keeps its palette and every painted mark its colour, whatever colour the painting has.
// No extra draw: it is the ground's own material.
//
// Textures load when a battle starts (WorldView.onBattleStart, called with the weapon sprites), never on the
// title screen, and only the layers the map uses. A painted replacement set with the same file names needs no
// code change (contract in docs/ASSET_PIPELINE.md, "Ground detail layers").

// The fourteen layer files. A new painting replaces a file; no other names are read.
export const LAYER_NAMES = ["grass", "grass-dry", "dirt", "road", "stone", "mud", "sand", "hardpan", "snow", "ice", "basalt", "ash", "beach", "cliff"];
// Shader slots: the surfaces of Terrain.at() that carry detail, then the cliff faces (steep ground and plateau rock).
export const SLOTS = ["grass", "dirt", "sand", "stone", "road", "mud", "cliff"];
// Eco and phones blend only the four broad surfaces (road, mud and cliff keep the painted ground there).
export const ECO_SLOTS = ["grass", "dirt", "sand", "stone"];
// Splat channels: A = grass, dirt, sand, stone; B = road, mud, wet (a darker, glossier band at the water), warp.
const SURFACE_CODE = { grass: 0, dirt: 1, sand: 2, stone: 3, road: 4, mud: 5, water: 6, ford: 7, bridge: 8 };
export { SURFACE_CODE };

// THE table: which layer each land draws on each surface (lands by look id; a map borrows its look's row).
// The surface names keep their rules (terrain.js); a land's theme gives them their colour, this table their grain.
export const GROUND_LAYERS = {
  //            grass         dirt        sand       stone      road    mud    cliff
  classic: { grass: "grass-dry", dirt: "ash", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  riverlands: { grass: "grass", dirt: "dirt", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  basin: { grass: "grass", dirt: "hardpan", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  expanse: { grass: "grass", dirt: "dirt", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  dunes: { grass: "grass-dry", dirt: "hardpan", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  woodlands: { grass: "grass", dirt: "dirt", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  highlands: { grass: "grass-dry", dirt: "dirt", sand: "sand", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
  // W9 lands: snow is "grass" and packed snow "dirt" (both snow), frozen shores "sand" (ice), rock faces stone; volcanic
  // ash is "grass" over basalt "dirt" and black basalt "stone"; the isles' sand bars and shores are beach.
  snowfield: { grass: "snow", dirt: "snow", sand: "ice", stone: "stone", road: "road", mud: "mud", cliff: "stone" },
  volcano: { grass: "ash", dirt: "basalt", sand: "hardpan", stone: "basalt", road: "road", mud: "mud", cliff: "cliff" },
  archipelago: { grass: "grass", dirt: "dirt", sand: "beach", stone: "stone", road: "road", mud: "mud", cliff: "cliff" },
};
export const layersFor = (id) => GROUND_LAYERS[lookOf(id)] || GROUND_LAYERS.riverlands;
// How each layer reads (texture review 2026-11-26): `k` the strength of its luminance detail (never above 1.25),
// `turn` whether its second sample may be turned (only grass, dry grass and basalt: a turned lit painting flips its
// light), `size` a tile-size step (stone, hardpan and basalt repeat inside their 512 px: one step larger until they
// are repainted), `opacity` how much of the layer shows at all (ice at most half). Hue share is 1 for every layer.
export const LAYER_LOOK = {
  grass: { k: 0.85, turn: true }, "grass-dry": { k: 0.8, turn: true }, dirt: { k: 1.1 }, hardpan: { k: 1.2, size: 1.5 },
  sand: { k: 0.75 }, beach: { k: 0.95 }, road: { k: 0.5 }, stone: { k: 1.15, size: 1.5 }, mud: { k: 1.0 }, snow: { k: 0.6 },
  ice: { k: 0.75, opacity: 0.5 }, basalt: { k: 1.25, turn: true, size: 1.5 }, ash: { k: 1.1 }, cliff: { k: 1.25 },
};
// One trim for all of it (the owner's knob): every layer's k is multiplied by this.
export const GROUND_DETAIL_STRENGTH = 1;
// On desktop High the grass layers are capped (units stand out more against calmer grass); phones keep the table.
export const DESKTOP_GRASS_CAP = 0.6;
// Metres per tile by tier, set on a quality or viewport change (never per frame): desktop High 4 m, Eco portrait 6 m,
// Eco landscape 8 m (a phone's tile stays 60-100 CSS px on screen, so the grain reads instead of averaging away).
export const TILE_METRES = { high: 4, ecoPortrait: 6, ecoLandscape: 8 };
export const tileMetres = (lowPower, landscape) => (lowPower ? (landscape ? TILE_METRES.ecoLandscape : TILE_METRES.ecoPortrait) : TILE_METRES.high);


const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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

// The splat: two RGBA images of `size` x `size` texels over the whole map (row 0 at z = -half). `grid` holds the
// painted surface of every paint cell (SURFACE_CODE, `cells` x `cells`, as ground-paint.js decided it, warped borders
// and ramps as bare ground). Ramp strips become road, worn paths (`wear`, 0..1 per cell) dirt, cells near open water
// wet. Water itself counts as mud (its banks), crossings as road. Weights are blurred so borders blend over a metre.
export function buildSplat(terrain, grid, cells, size, wear = null) {
  const n = size, step = cells / n, a = new Uint8Array(n * n * 4), b = new Uint8Array(n * n * 4);
  const w = new Float32Array(n * n * 6), metres = terrain.size / n;
  const slotOf = [0, 1, 2, 3, 4, 5, 5, 4, 4]; // grass dirt sand stone road mud | water->mud ford->road bridge->road
  const water = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      for (let sy = 0; sy < step; sy++)
        for (let sx = 0; sx < step; sx++) {
          const code = grid[(Math.floor(y * step) + sy) * cells + Math.floor(x * step) + sx];
          w[i * 6 + slotOf[code]] += 1;
          if (code === SURFACE_CODE.water) water[i] += 1;
        }
      const k = 1 / (step * step);
      for (let s = 0; s < 6; s++) w[i * 6 + s] *= k;
      water[i] *= k;
    }
  // Ramp strips: road, as paintPlateaus draws them (u across, v downhill; faded at both ends).
  for (const p of terrain.plateaus || [])
    for (const r of p.ramps) {
      const o = outward(terrain, p, r.x, r.z), half = r.half * 0.64, reach = 4.2 + r.half;
      const x0 = Math.max(0, Math.floor((r.x - reach + terrain.half) / metres)), x1 = Math.min(n - 1, Math.ceil((r.x + reach + terrain.half) / metres));
      const z0 = Math.max(0, Math.floor((r.z - reach + terrain.half) / metres)), z1 = Math.min(n - 1, Math.ceil((r.z + reach + terrain.half) / metres));
      for (let y = z0; y <= z1; y++)
        for (let x = x0; x <= x1; x++) {
          const wx = (x + 0.5) * metres - terrain.half - r.x, wz = (y + 0.5) * metres - terrain.half - r.z;
          const u = wx * -o.z + wz * o.x, v = wx * o.x + wz * o.z; // across, downhill
          // The strip's own fades (paintPlateaus: full from 12 % to 86 % of v -3.6..3.9).
          const t = (1 - smooth(half - 0.2, half + 0.2, Math.abs(u))) * smooth(-3.6, -2.7, v) * (1 - smooth(2.85, 3.9, v));
          if (t <= 0) continue;
          const i = (y * n + x) * 6;
          for (let s = 0; s < 6; s++) w[i + s] *= 1 - t;
          w[i + 4] += t;
        }
    }
  // Worn paths: dirt over grass, sand, stone and mud (never over roads or water).
  if (wear) {
    const wn = Math.round(Math.sqrt(wear.length)), ws = wn / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const t = wear[Math.min(wn - 1, Math.floor((y + 0.5) * ws)) * wn + Math.min(wn - 1, Math.floor((x + 0.5) * ws))] * 0.85;
        if (t <= 0.01) continue;
        // Grass, sand and stone wear down to dirt; roads, mud and water stay what they are.
        const i = (y * n + x) * 6, moved = (w[i] + w[i + 2] + w[i + 3]) * t;
        w[i] *= 1 - t; w[i + 2] *= 1 - t; w[i + 3] *= 1 - t;
        w[i + 1] += moved;
      }
  }
  // Blur the weights a little (two box passes, radius about 0.5 m).
  const radius = Math.max(1, Math.round(0.5 / metres));
  const blur = (src, channels) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length), span = 2 * radius + 1;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        for (let c = 0; c < channels; c++) {
          let sum = 0;
          for (let d = -radius; d <= radius; d++) sum += src[(y * n + Math.min(n - 1, Math.max(0, x + d))) * channels + c];
          tmp[(y * n + x) * channels + c] = sum / span;
        }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        for (let c = 0; c < channels; c++) {
          let sum = 0;
          for (let d = -radius; d <= radius; d++) sum += tmp[(Math.min(n - 1, Math.max(0, y + d)) * n + x) * channels + c];
          out[(y * n + x) * channels + c] = sum / span;
        }
    return out;
  };
  const soft = blur(w, 6);
  // Wet: within about 1.4 m of open water (a dilation of the water share), strongest at the edge.
  const reach = Math.max(1, Math.round(1.4 / metres));
  let wet = water.slice();
  for (let pass = 0; pass < reach; pass++) {
    const next = wet.slice();
    for (let y = 1; y < n - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x, m = Math.max(wet[i - 1], wet[i + 1], wet[i - n], wet[i + n]) * (1 - 1 / (reach + 1));
        if (m > next[i]) next[i] = m;
      }
    wet = next;
  }
  for (let i = 0; i < n * n; i++) {
    const s = soft.subarray(i * 6, i * 6 + 6), total = s[0] + s[1] + s[2] + s[3] + s[4] + s[5] || 1;
    a[i * 4] = Math.round((s[0] / total) * 255); a[i * 4 + 1] = Math.round((s[1] / total) * 255);
    a[i * 4 + 2] = Math.round((s[2] / total) * 255); a[i * 4 + 3] = Math.round((s[3] / total) * 255);
    b[i * 4] = Math.round((s[4] / total) * 255); b[i * 4 + 1] = Math.round((s[5] / total) * 255);
    // Wet sand: a band beside the water (not the water itself, which the water mesh covers).
    b[i * 4 + 2] = Math.round(Math.min(1, wet[i] * (1 - water[i] * 0.6)) * 255);
    const x = i % n, y = (i / n) | 0, wx = (x + 0.5) * metres, wz = (y + 0.5) * metres;
    b[i * 4 + 3] = Math.round((noise(wx * 0.11 + 7, wz * 0.11 - 3) * 0.7 + noise(wx * 0.31 - 5, wz * 0.31 + 11) * 0.3) * 255);
  }
  return { a, b, size: n };
}

// The slots a splat uses at all (a layer whose weight never reaches 1/255 is not fetched).
export function usedSlots(splat, plateaus = 0) {
  const used = new Set(), { a, b } = splat;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 4; c++) if (a[i + c] > 2) used.add(SLOTS[c]);
    if (b[i] > 2) used.add("road");
    if (b[i + 1] > 2) used.add("mud");
  }
  if (plateaus) used.add("cliff");
  return SLOTS.filter((s) => used.has(s));
}

// ---- runtime (browser) --------------------------------------------------------------------------------------
const loaded = new Map(); // layer name -> Promise<{ texture, look }> (kept for the session: lands share layers)
const blank = (() => {
  if (typeof document === "undefined") return null;
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();
const versionQuery = () => {
  // vite.config.js stamps a hash of public/textures/ground (a repainted set gets a new URL; nothing else changes).
  try { return typeof __GROUND_TEXTURES__ === "string" && __GROUND_TEXTURES__ ? `?v=${__GROUND_TEXTURES__}` : ""; } catch { return ""; }
};
// Eco and phones load the 256 px copies (textures/ground/256/, a quarter of the bytes and GPU memory; no visible loss at
// a 6-8 m tile); High loads the 512 px set.
export const layerUrl = (name, small = false) => `${import.meta.env?.BASE_URL ?? "./"}textures/ground/${small ? "256/" : ""}${name}.webp${versionQuery()}`;

// A tile's mean colour in linear RGB (sRGB-decoded, as the GPU samples it), its mean luminance and mean chroma
// (mean colour / mean luminance): the shader's per-layer constants, measured once when the painting loads, so a
// repainted file needs nothing else.
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function measure(image) {
  const c = document.createElement("canvas"), w = image.naturalWidth || 256, h = image.naturalHeight || 256;
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data, lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = toLinear(i / 255);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += lin[d[i]]; g += lin[d[i + 1]]; b += lin[d[i + 2]]; }
  const n = w * h, mean = [r / n, g / n, b / n], lum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
  return { mean, lum, chroma: mean.map((v) => v / Math.max(lum, 1e-4)) };
}

function loadLayer(name, small, anisotropy) {
  const key = `${name}|${small ? 256 : 512}`;
  if (!loaded.has(key))
    loaded.set(key, new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const texture = new THREE.Texture(img);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace; // sampled linear, like the painted ground it modulates
        // flipY (the default): the image's top is world +z, so light painted from a tile's top falls from the sun's
        // side once the detail frame is turned (the shader's GD_FRAME); trilinear mipmaps, no LOD bias.
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
        resolve({ texture, look: measure(img) });
      };
      img.onerror = () => { loaded.delete(key); resolve(null); };
      img.src = layerUrl(name, small);
    }));
  return loaded.get(key);
}

// Shader code (texture review 2026-11-26, applied): every layer is sampled sRGB-decoded (linear) and modulates the
// painted colour by its luminance ratio to its own mean (strength k per layer, GROUND_DETAIL_STRENGTH over all) times
// its full chroma relative to its own mean chroma: on average 1, so every map keeps its palette and every painted mark
// keeps its colour. Detail UVs: world x/z in tiles of uGdTile metres, the whole frame turned 40 degrees so the light
// painted from each tile's top falls from the sun's side and the tiling never lines up with roads, rivers and bases.
// GD_SCALES 2 (High) mixes in a second, 0.37x sample by slow noise (turned only for grass, dry grass and basalt: a lit
// layer turned would flip its light). Everything sits inside `if (uGdOn > 0.0)`.
const VERT_DECL = "varying vec3 vGdW;\nvarying vec3 vGdN;\n";
const VERT_BODY = "vGdW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGdN = normalize(mat3(modelMatrix) * objectNormal);\n";
const FRAG_DECL = `
uniform float uGdOn;
uniform float uGdHalf;
uniform float uGdTile;
uniform float uGdFar;
uniform sampler2D uGdSplatA;
uniform sampler2D uGdSplatB;
uniform sampler2D uGdL0;
uniform sampler2D uGdL1;
uniform sampler2D uGdL2;
uniform sampler2D uGdL3;
uniform sampler2D uGdL4;
uniform sampler2D uGdL5;
uniform sampler2D uGdL6;
uniform vec4 uGdLook[7];
uniform vec4 uGdMean[7];
varying vec3 vGdW;
varying vec3 vGdN;
float gdWet = 0.0;
const vec3 GD_LUMA = vec3(0.2126, 0.7152, 0.0722);
const mat2 GD_FRAME = mat2(0.7660, -0.6428, 0.6428, 0.7660);
const mat2 GD_TURN = mat2(0.8, 0.6, -0.6, 0.8);
// One layer at q (tiles): rgb = how it modulates the painted colour, w = its height for the blend (0 on average).
// look: x mean luminance, y strength k, z may turn (grass, dry grass, basalt), w opacity. mean: xyz mean chroma, w size.
// A layer whose weight is nil here costs nothing: the branch skips its samples (textureGrad with derivatives taken
// before the branch keeps the mip choice exact; most pixels lie inside one surface and read one layer).
vec4 gdLayer(sampler2D t, vec2 q, vec2 dqx, vec2 dqy, vec4 look, vec4 mean, float farMix, float weight) {
  if (weight <= 0.004) return vec4(1.0, 1.0, 1.0, -8.0);
  float inv = 1.0 / mean.w;
  vec2 p = q * inv, gx = dqx * inv, gy = dqy * inv;
  vec3 c = textureGrad(t, p, gx, gy).rgb;
#if GD_SCALES > 1
  vec2 pf = p * 0.37 + vec2(0.41, 0.17), fx = gx * 0.37, fy = gy * 0.37;
  if (look.z > 0.5) { pf = GD_TURN * pf; fx = GD_TURN * fx; fy = GD_TURN * fy; }
  c = mix(c, textureGrad(t, pf, fx, fy).rgb, farMix);
#endif
  float tl = max(dot(c, GD_LUMA), 1e-4), r = tl / look.x;
  vec3 m = max(mix(1.0, r, look.y), 0.15) * clamp((c / tl) / mean.xyz, vec3(0.25), vec3(3.0));
  return vec4(mix(vec3(1.0), m, look.w), r - 1.0);
}
void gdApply(inout vec3 col) {
  if (uGdOn <= 0.0) return;
  vec2 suv = (vGdW.xz + uGdHalf) / (2.0 * uGdHalf);
  vec4 wa = texture2D(uGdSplatA, suv);
  vec4 wb = texture2D(uGdSplatB, suv);
  // Soft offsets by the splat's slow noise (never a turn or a mirror for the lit layers).
  vec2 q = GD_FRAME * vGdW.xz / uGdTile + (wb.w - 0.5) * 0.35;
  float far = uGdFar * smoothstep(0.3, 0.75, wb.w) * 0.5;
  float steep = 1.0 - smoothstep(0.5, 0.82, abs(vGdN.y));
  float level = 1.0 - steep;
  // Derivatives in uniform control flow, before any layer branches.
  vec2 dqx = dFdx(q), dqy = dFdy(q);
#if GD_SCALES > 1
  vec4 l0 = gdLayer(uGdL0, q, dqx, dqy, uGdLook[0], uGdMean[0], far, wa.x * level);
  vec4 l1 = gdLayer(uGdL1, q, dqx, dqy, uGdLook[1], uGdMean[1], far, wa.y * level);
  vec4 l2 = gdLayer(uGdL2, q, dqx, dqy, uGdLook[2], uGdMean[2], far, wa.z * level);
  vec4 l3 = gdLayer(uGdL3, q, dqx, dqy, uGdLook[3], uGdMean[3], far, wa.w * level);
  vec4 l4 = gdLayer(uGdL4, q, dqx, dqy, uGdLook[4], uGdMean[4], far, wb.x * level);
  vec4 l5 = gdLayer(uGdL5, q, dqx, dqy, uGdLook[5], uGdMean[5], far, wb.y * level);
  // The cliff layer stands on the rock faces: projected from the side (u along the face, v the world height).
  vec2 pc = mix(vGdW.xy, vGdW.zy, smoothstep(0.35, 0.65, abs(vGdN.x))) / uGdTile;
  vec4 l6 = gdLayer(uGdL6, pc, dFdx(pc), dFdy(pc), uGdLook[6], uGdMean[6], 0.0, steep);
  // Height blend: where two surfaces meet, the locally brighter grain wins, so borders follow pebbles and clumps.
  float h0 = wa.x * level + l0.w * 0.35, h1 = wa.y * level + l1.w * 0.35, h2 = wa.z * level + l2.w * 0.35, h3 = wa.w * level + l3.w * 0.35;
  float h4 = wb.x * level + l4.w * 0.35, h5 = wb.y * level + l5.w * 0.35, h6 = steep + l6.w * 0.35;
  float top = max(max(max(h0, h1), max(h2, h3)), max(max(h4, h5), h6)) - 0.16;
  float b0 = max(h0 - top, 0.0) * step(0.004, wa.x * level), b1 = max(h1 - top, 0.0) * step(0.004, wa.y * level);
  float b2 = max(h2 - top, 0.0) * step(0.004, wa.z * level), b3 = max(h3 - top, 0.0) * step(0.004, wa.w * level);
  float b4 = max(h4 - top, 0.0) * step(0.004, wb.x * level), b5 = max(h5 - top, 0.0) * step(0.004, wb.y * level);
  float b6 = max(h6 - top, 0.0) * step(0.004, steep);
  float bs = b0 + b1 + b2 + b3 + b4 + b5 + b6 + 1e-4;
  vec3 m = (l0.rgb * b0 + l1.rgb * b1 + l2.rgb * b2 + l3.rgb * b3 + l4.rgb * b4 + l5.rgb * b5 + l6.rgb * b6) / bs;
#else
  // Eco (phones): one texture read per pixel, the dominant broad surface's layer (grass, dirt, sand or stone); it fades
  // out where two surfaces are nearly even, so a border is a soft flat seam, never a hard switch of grain. Roads, mud
  // banks and cliff faces keep the painted ground.
  float a1 = max(wa.x, wa.y), c1 = min(wa.x, wa.y), a2 = max(wa.z, wa.w), c2 = min(wa.z, wa.w);
  float first = max(a1, a2), second = max(min(a1, a2), max(c1, c2));
  vec4 l;
  if (wa.x >= first) l = gdLayer(uGdL0, q, dqx, dqy, uGdLook[0], uGdMean[0], 0.0, 1.0);
  else if (wa.y >= first) l = gdLayer(uGdL1, q, dqx, dqy, uGdLook[1], uGdMean[1], 0.0, 1.0);
  else if (wa.z >= first) l = gdLayer(uGdL2, q, dqx, dqy, uGdLook[2], uGdMean[2], 0.0, 1.0);
  else l = gdLayer(uGdL3, q, dqx, dqy, uGdLook[3], uGdMean[3], 0.0, 1.0);
  vec3 m = mix(vec3(1.0), l.rgb, level * first * smoothstep(0.0, 0.3, first - second));
#endif
  // Marks keep their paint crisp: very bright (lines, lips, foam) or very saturated (ember cracks, kill-zone stripes).
  float lum = dot(col, GD_LUMA);
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float k = uGdOn * (1.0 - max(smoothstep(0.62, 0.9, lum), smoothstep(0.66, 0.9, sat)));
  col *= mix(vec3(1.0), m, k);
  gdWet = wb.z * k;
  col *= 1.0 - gdWet * 0.2;
}
`;

export class GroundDetail {
  constructor() {
    this.uniforms = {
      uGdOn: { value: 0 }, uGdHalf: { value: 48 }, uGdTile: { value: TILE_METRES.high }, uGdFar: { value: 1 },
      uGdSplatA: { value: blank }, uGdSplatB: { value: blank },
      uGdLook: { value: SLOTS.map(() => new THREE.Vector4(0.2, 0, 0, 0)) },
      uGdMean: { value: SLOTS.map(() => new THREE.Vector4(1, 1, 1, 1)) },
    };
    SLOTS.forEach((_, i) => (this.uniforms[`uGdL${i}`] = { value: blank }));
    this.scales = 2;
    this.target = 0; // what uGdOn eases toward: 1 once the land's layers are in, 0 when off
    this.enabled = true; // the governor's "still" and "rescue" steps (and ?groundDetail=0) turn it off
    this.started = false;
    this.pending = null;
    this.land = null;
    this.splat = null;
    this.textures = [];
  }
  // The terrain was (re)built: a new splat; the land's layers load now if a battle has started.
  setTerrain(terrain, grid, cells, { lowPower = false, wear = null } = {}) {
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.terrain = terrain;
    this.uniforms.uGdHalf.value = terrain.half;
    this.lowPower = lowPower;
    this.anisotropy = lowPower ? 1 : 4;
    this.scales = lowPower ? 1 : 2;
    this.uniforms.uGdFar.value = lowPower ? 0 : 1;
    const splat = buildSplat(terrain, grid, cells, lowPower ? 256 : 512, wear);
    this.splat = splat;
    for (const [key, data] of [["uGdSplatA", splat.a], ["uGdSplatB", splat.b]]) {
      const t = new THREE.DataTexture(data, splat.size, splat.size);
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.NoColorSpace;
      t.needsUpdate = true;
      this.textures.push(t);
      this.uniforms[key].value = t;
    }
    this.layers = layersFor(terrain.id);
    this.slots = usedSlots(splat, terrain.plateaus?.length || 0);
    this.land = lookOf(terrain.id);
    this.target = 0;
    this.uniforms.uGdOn.value = 0;
    this.applyLoaded();
    if (this.started) this.start();
  }
  // Patches the ground material (once per material; its program is keyed by the scale count).
  patch(material) {
    const self = this;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, self.uniforms);
      shader.defines = { ...shader.defines, GD_SCALES: self.scales };
      shader.vertexShader = VERT_DECL + shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FRAG_DECL)
        .replace("#include <color_fragment>", "#include <color_fragment>\ngdApply(diffuseColor.rgb);")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.45, gdWet);");
    };
    material.customProgramCacheKey = () => `ground-detail-v1|${self.scales}`;
    material.needsUpdate = true;
    this.material = material;
    return material;
  }
  // A battle started (or a match was restored): fetch the land's layers (each once per session).
  start() {
    this.started = true;
    if (!this.terrain || !this.slots) return Promise.resolve(false);
    try { if (new URLSearchParams(location.search).get("groundDetail") === "0") { this.enabled = false; return Promise.resolve(false); } } catch { /* no location */ }
    const names = [...new Set(this.slots.filter((s) => !this.lowPower || ECO_SLOTS.includes(s)).map((s) => this.layers[s]))], land = this.land, small = !!this.lowPower;
    // applyLoaded is async (it awaits each layer): chain it, so whenReady() never answers before the bind.
    const loading = Promise.all(names.map((name) => loadLayer(name, small, this.anisotropy)))
      .then(() => (land === this.land ? this.applyLoaded() : null))
      .then(() => this.target > 0);
    this.pending = loading;
    return loading;
  }
  // Binds every layer of this land that has arrived (at this tier's size); turns the detail on once all the used ones are in.
  async applyLoaded() {
    if (!this.slots) return;
    let ready = 0;
    const small = !!this.lowPower;
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i], name = this.layers[slot], key = `${name}|${small ? 256 : 512}`, entry = loaded.has(key) ? await loaded.get(key) : null;
      if (!entry) { this.uniforms[`uGdL${i}`].value = blank; this.uniforms.uGdLook.value[i].set(0.2, 0, 0, 0); continue; }
      const look = LAYER_LOOK[name] || { k: 0.8 };
      const grassCap = !small && (name === "grass" || name === "grass-dry") ? DESKTOP_GRASS_CAP : Infinity;
      const k = Math.min(1.25, Math.min(look.k, grassCap) * GROUND_DETAIL_STRENGTH);
      this.uniforms[`uGdL${i}`].value = entry.texture;
      this.uniforms.uGdLook.value[i].set(Math.max(1e-3, entry.look.lum), k, look.turn ? 1 : 0, look.opacity ?? 1);
      this.uniforms.uGdMean.value[i].set(...entry.look.chroma, look.size ?? 1);
      if (this.slots.includes(slot) && (!small || ECO_SLOTS.includes(slot))) ready++;
    }
    const needed = this.slots.filter((s) => !small || ECO_SLOTS.includes(s)).length;
    this.target = ready >= needed && needed > 0 ? 1 : 0;
  }
  whenReady() { return this.pending ? this.pending.then(() => this.target > 0) : Promise.resolve(this.target > 0); }
  get ready() { return this.target > 0 && this.uniforms.uGdOn.value >= 1; }
  // Eases the detail in over half a second (no pop when the textures land mid-battle). Call every frame.
  update(dt, instant = false) {
    const goal = this.enabled ? this.target : 0, u = this.uniforms.uGdOn;
    if (u.value === goal) return;
    u.value = instant ? goal : goal > u.value ? Math.min(goal, u.value + dt * 2) : Math.max(goal, u.value - dt * 2);
  }
  setQuality(lowPower) {
    const scales = lowPower ? 1 : 2;
    if (scales !== this.scales) { this.scales = scales; if (this.material) this.material.needsUpdate = true; }
    this.anisotropy = lowPower ? 1 : 4;
    this.uniforms.uGdFar.value = lowPower ? 0 : 1;
    if (!!lowPower !== !!this.lowPower) {
      // The other tier's files (256 or 512 px): rebind once they are in (a battle already started fetches them now).
      this.lowPower = lowPower;
      this.target = 0;
      this.applyLoaded();
      if (this.started) this.start();
    }
  }
  // The tile size for this tier and viewport (WorldView.resize and setQuality; a uniform, never a recompile).
  setViewport(lowPower, landscape) {
    this.uniforms.uGdTile.value = tileMetres(lowPower, landscape);
  }
  dispose() {
    for (const t of this.textures) t.dispose();
    this.textures = [];
  }
}
// The theme colours of the surfaces (for the docs table and tests).
export const surfaceTheme = (id) => { const t = themeFor(id); return Object.fromEntries(SLOTS.slice(0, 6).map((s) => [s, t[s]])); };
