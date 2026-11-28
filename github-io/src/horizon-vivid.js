// The Vivid Hero sky (owner 2026-11-28: "a dark, vivid, colourful space sky like the key art"; Codex painted the art in
// src/art/sky/, src/art/sky/manifest.json). Part of the lazy Hero sky (src/horizon-sky.js owns the dome, the far ring and
// today's Calm planets; this file adds the rest). Nothing here is fetched until a Vivid sky first shows.
//   dome     (horizon-sky.js DOME_FS, uVivid) a dark indigo-to-violet sky over the hero fog's haze, the land's warm or
//            teal horizon glow band (horizon-glow.webp), the nebula band (nebula-band.webp, the phone band on phones)
//            twice round the sky (the second copy mirrored and lifted, slow noise thinning and thickening it) and two
//            hero clouds at fixed bearings. Strongest at dusk and night, a soft veil by day. +0 draws.
//   bodies   one draw: the key art's worlds plus a violet gas giant and an ice moon, bigger than the Calm sky's, each
//            with an atmosphere halo in its own colour, a lit rim on its upper-left limb and an 8 s breathing pulse,
//            all from the same textures (additive in the same draw).
//   meteors  one instanced draw: thin blue-white or violet streaks (meteor-streaks.webp; never gold or orange, which
//            mean enemy fire) falling calmly high in the visible band; a few a minute, many in a meteor shower.
//   event    one draw, one sky event a match (sky-events.js skyPlan): the shattered planet (base, breathing crack glow,
//            flickering flames, a scrolling flame corona, a shockwave ring every 20-30 s and drifting debris), the
//            twin-moon eclipse (a sun slides behind the larger moon: a corona flares round its limb) or the aurora.
// Everything sits in the band the Hero camera sees (0-15 degrees up on a PC, 0-12 on a landscape phone): bodies at
// 5-15 degrees, the big ones at the sides and corners of the key art's view, clear of its middle. Reduced motion and
// the governor's still steps hold it all still (no pulse, scroll, meteors or shockwave); the rescue step drops the
// meteors, the event and the far ring first. Phones load half-size sheets (GPU memory in `gpuBytes`).
// More sky layers later (an orbital ring, a far space battle): one more entry in EVENT_MESHES (an event) or one more
// mesh beside these (a layer) with its own art in src/art/sky/; the dome and the bodies need no change.
import * as THREE from "three";
import { DEG, FRONT, RADIUS, ATLAS, skyDir, skyFrame } from "./sky-basis.js";
import { METEORS, skyRandom } from "./sky-events.js";
import { ARMADA, ARMADA_SHIPS, armadaPlan, armadaPose, armadaOut, WAR_SLOTS, warPlan, warPose } from "./sky-war.js";

const art = (name) => new URL(`./art/sky/${name}.webp`, import.meta.url).href;
export const ART = Object.freeze({
  nebula: art("nebula-band"), nebulaPhone: art("nebula-band-phone"), heroA: art("nebula-hero-a"), heroB: art("nebula-hero-b"),
  glow: art("horizon-glow"), meteors: art("meteor-streaks"), giant: art("planet-violet-giant"), ice: art("planet-ice-moon"),
  twins: art("planet-twin-moons"), aurora: art("aurora-band"), base: art("shattered-base"), cracks: art("shattered-glow"),
  flames: art("shattered-flames"), strip: art("flame-strip"), shock: art("shockwave-ring"), debris: art("debris-sheet"),
  // The orbital ring and the far war (src/art/sky/orbital/), loaded with the rest on the first Vivid Hero sky.
  ringBand: new URL("./art/sky/orbital/ring-band.webp", import.meta.url).href, ringLights: new URL("./art/sky/orbital/ring-lights.webp", import.meta.url).href,
  ringGlow: new URL("./art/sky/orbital/ring-glow.webp", import.meta.url).href, warHaze: new URL("./art/sky/orbital/war-haze.webp", import.meta.url).href,
  warShips: new URL("./art/sky/orbital/war-ships.webp", import.meta.url).href, warBlooms: new URL("./art/sky/orbital/war-explosions.webp", import.meta.url).href,
  warFlak: new URL("./art/sky/orbital/war-flak.webp", import.meta.url).href, warBeams: new URL("./art/sky/orbital/war-beams.webp", import.meta.url).href,
  warWreck: new URL("./art/sky/orbital/war-wreck.webp", import.meta.url).href,
  // The armada (src/art/sky/armada/), loaded only when the Armada landfall runs.
  cruiserSide: new URL("./art/sky/armada/cruiser-side.webp", import.meta.url).href, cruiserDescend: new URL("./art/sky/armada/cruiser-descend.webp", import.meta.url).href,
  haulerSide: new URL("./art/sky/armada/hauler-side.webp", import.meta.url).href, haulerDescend: new URL("./art/sky/armada/hauler-descend.webp", import.meta.url).href,
  arkSide: new URL("./art/sky/armada/ark-side.webp", import.meta.url).href, arkDescend: new URL("./art/sky/armada/ark-descend.webp", import.meta.url).href,
  lightsMask: new URL("./art/sky/armada/lights-mask.webp", import.meta.url).href, engineGlow: new URL("./art/sky/armada/engine-glow.webp", import.meta.url).href,
  landingFlare: new URL("./art/sky/armada/landing-flare.webp", import.meta.url).href, escorts: new URL("./art/sky/armada/escort-sheet.webp", import.meta.url).href,
  escape: new URL("./art/sky/armada/escape-craft.webp", import.meta.url).href,
});

// ------------------------------------------------------------------------------------------------ colours
// Per mission look: the low sky (just over the glow band), the zenith, and strengths. Night and storm are darker.
export const VIVID_LOOK = {
  day: { low: "#2e2172", zenith: "#0d1038", stars: 0.5, nebula: 0.6, band: 0.95, cloud: 0.06, cloudLit: "#6c6aac", cloudShade: "#221d4c", planets: 1, glow: 0.4 },
  dusk: { low: "#41206a", zenith: "#110b35", stars: 0.65, nebula: 1, band: 1.15, warm: true, cloud: 0.1, cloudLit: "#c48294", cloudShade: "#3b1f52", planets: 1, glow: 0.8 },
  night: { low: "#181044", zenith: "#05061c", stars: 1, nebula: 1, band: 0.62, cloud: 0.06, cloudLit: "#2b2d5e", cloudShade: "#0a0b23", planets: 1, glow: 0 },
  storm: { low: "#1c2138", zenith: "#070915", stars: 0.08, nebula: 0.3, band: 0.4, cloud: 0.6, cloudLit: "#4d5772", cloudShade: "#151a29", planets: 0.35, glow: 0 },
  fog: { low: "#454b6e", zenith: "#171a39", stars: 0.15, nebula: 0.25, band: 0.5, cloud: 0.4, cloudLit: "#9aa2b8", cloudShade: "#565d75", planets: 0.45, glow: 0.1 },
};
// The horizon glow band of each land: the warm dusk row or the teal haze row of horizon-glow.webp.
export const WARM_LANDS = new Set(["classic", "basin", "dunes", "highlands", "volcano"]);
export const BAND_COLOR = { warm: "#ff8a6a", teal: "#3fb6c8" };

// ------------------------------------------------------------------------------------------------ placement
// The visible band: horizon to about 15 degrees on a PC, 12 on a landscape phone (the shoulder camera looks 13 and
// 19.5 degrees down). Body centres sit at 5-15 degrees.
export const BAND = Object.freeze({ pc: 15, landscape: 12, low: 5, high: 15 });
// The stage: where the event's body hangs, the upper right of the key art's view.
export const STAGE = Object.freeze({ u: 27, el: 8.2, d: 9.6 });
// Phones see less sky (a landscape phone to about 12 degrees, over hills that reach 5): bodies are a little smaller
// and the high ones come down (above the knee their height is squeezed), the stage, the ring's arch and the meteors too.
export const PHONE_FIT = Object.freeze({ scale: 0.78, knee: 7, squeeze: 0.4, top: 11.8, stage: { el: 7, d: 8 }, ringTop: 9.6, meteors: [7.2, 3.6] });
export const fitEl = (el, phone) => (phone && el > PHONE_FIT.knee ? PHONE_FIT.knee + (el - PHONE_FIT.knee) * PHONE_FIT.squeeze : el);
// A body's centre and diameter on a phone: lower, smaller, its top never above PHONE_FIT.top.
export const phoneBody = (b) => { const el = fitEl(b.el, true); return { el, d: Math.min(b.d * PHONE_FIT.scale, 2 * (PHONE_FIT.top - el)) }; };
export const stageOf = (phone) => (phone ? { u: STAGE.u, ...PHONE_FIT.stage } : STAGE);
// Bodies: u degrees right of FRONT, el the disc centre's elevation, d its diameter (degrees). halo: the atmosphere's
// colour (brief section 4 palette), reach: how far it glows (disc radii), glow and rim strengths; sun: no rim.
export const VIVID_BODIES = [
  { name: "amber", u: -37, el: 12.4, d: 2.8, halo: "#ffb347", reach: 3.4, glow: 1.15, rim: 0, sun: true },
  { name: "silver", u: -31.5, el: 13.5, d: 1.5, halo: "#e2ecff", reach: 3.4, glow: 1, rim: 0, sun: true },
  { name: "ringed", u: -20, el: 7.6, d: 13, halo: "#5ab8ff", reach: 1.42, glow: 0.75, rim: 0.9 }, // very large, ring whole
  { name: "ember", u: -64, el: 6.4, d: 2.4, halo: "#ff8a5a", reach: 1.6, glow: 0.45, rim: 0.6 },
  { name: "storm", u: 52, el: 8.6, d: 9.6, halo: "#2fd0c8", reach: 1.42, glow: 0.7, rim: 0.9 },
  { name: "dunes", u: 76, el: 11.2, d: 3.6, halo: "#ffc78a", reach: 1.5, glow: 0.55, rim: 0.7 },
  { name: "ice", u: 104, el: 10.4, d: 5, halo: "#c9f3ff", reach: 1.5, glow: 0.6, rim: 1 },
  { name: "giant", u: 160, el: 7.6, d: 15, halo: "#9a5cff", reach: 1.36, glow: 0.8, rim: 1 }, // the far side's very large one
];
// The discs in their sheets: the key-art atlas (tex 0, cells measured from its alpha) and the bodies sheet built from
// planet-violet-giant + planet-ice-moon (tex 1: 768x512 on a PC, half on phones; manifest bodyRadiusPx scaled).
export const SHEET = Object.freeze({ size: [768, 512], giant: [0, 0, 512, 512], ice: [512, 0, 256, 256] });
export const DISCS = Object.freeze({
  ringed: { tex: 0, cell: ATLAS.ringed, r: 171 }, storm: { tex: 0, cell: ATLAS.storm, r: 179.6 },
  silver: { tex: 0, cell: ATLAS.silver, r: 19.6 }, ember: { tex: 0, cell: ATLAS.ember, r: 25.2 },
  dunes: { tex: 0, cell: ATLAS.dunes, r: 56.6 }, amber: { tex: 0, cell: ATLAS.amber, r: 46.9 },
  giant: { tex: 1, cell: SHEET.giant, r: 225 }, ice: { tex: 1, cell: SHEET.ice, r: 112.5 },
});
// The two hero clouds (nebula-hero-a / -b): centre bearing (u), width (degrees); the band covers 0-20 degrees up.
export const HERO_CLOUDS = Object.freeze([{ u: -58, w: 80 }, { u: 118, w: 60 }]);
export const NEBULA_TOP = 20; // degrees: the nebula images' height (manifest elevationDegrees)
export const GLOW_TOP = 9; // degrees: the horizon glow band's height

// ------------------------------------------------------------------------------------------------ textures
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const loadImage = (url) => new Promise((resolve, reject) => { const img = new Image(); img.decoding = "async"; img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
// A sheet drawn into a canvas (scaled for phones) and uploaded premultiplied: the canvas keeps premultiplied colour, so
// filtering and mipmaps never pull a dark fringe from the art's transparent texels.
function sheet(w, h, draw, { repeat = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d");
  g.imageSmoothingQuality = "high";
  draw(g);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace; // decoded in the shader (UNPM), after the premultiplied filtering
  t.premultiplyAlpha = true;
  t.anisotropy = 2;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  t.userData.bytes = Math.round(w * h * 4 * 4 / 3); // RGBA8 with mipmaps
  return t;
}
// Every sheet: its size on a PC (phones: half), its sources and how they are drawn in.
export const SHEETS = {
  nebula: { size: [2048, 256], phone: [1024, 128], src: (phone) => [phone ? ART.nebulaPhone : ART.nebula], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h) },
  heroes: { size: [1024, 512], src: () => [ART.heroA, ART.heroB], draw: (g, [a, b], w, h) => { g.drawImage(a, 0, 0, w, h / 2); g.drawImage(b, 0, h / 2, w * 0.75, h / 2); } },
  glow: { size: [1024, 128], src: () => [ART.glow], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h) },
  meteors: { size: [512, 128], phone: [512, 128], src: () => [ART.meteors], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h) },
  bodies: { size: SHEET.size, src: () => [ART.giant, ART.ice], draw: (g, [a, b], w, h) => { const k = w / SHEET.size[0]; g.drawImage(a, 0, 0, 512 * k, 512 * k); g.drawImage(b, 512 * k, 0, 256 * k, 256 * k); } },
  // The shattered planet's layers packed in one sheet: base, flames, crack glow and shockwave in 512 cells, the debris row.
  shattered: { size: [1024, 1280], src: () => [ART.base, ART.flames, ART.cracks, ART.shock, ART.debris], draw: (g, [base, flames, cracks, shock, debris], w) => { const c = w / 2; g.drawImage(base, 0, 0, c, c); g.drawImage(flames, c, 0, c, c); g.drawImage(cracks, 0, c, c, c); g.drawImage(shock, c, c, c, c); g.drawImage(debris, 0, 2 * c, w, c / 2); } },
  strip: { size: [1024, 256], src: () => [ART.strip], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h), repeat: true },
  twins: { size: [512, 256], src: () => [ART.twins], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h) },
  aurora: { size: [2048, 256], phone: [1024, 128], src: () => [ART.aurora], draw: (g, [a], w, h) => g.drawImage(a, 0, 0, w, h), repeat: true },
  // The orbital ring's rows (band, lights, glow, haze; RING_ROWS) and the war's sheet (WAR_SHEET).
  ring: { size: [2048, 352], src: () => [ART.ringBand, ART.ringLights, ART.ringGlow, ART.warHaze], repeat: true,
    draw: (g, [band, lights, glow, haze], w, h) => { const k = h / 352; g.drawImage(band, 0, 0, w, 128 * k); g.drawImage(lights, 0, 128 * k, w, 128 * k); g.drawImage(glow, 0, 256 * k, w, 32 * k); g.drawImage(haze, 0, 288 * k, w, 64 * k); } },
  war: { size: [512, 512], phone: [512, 512], src: () => [ART.warBlooms, ART.warShips, ART.warWreck, ART.warFlak, ART.warBeams],
    draw: (g, [blooms, ships, wreck, flak, beams], w) => { const k = w / 512; g.drawImage(blooms, 0, 0, 512 * k, 256 * k); g.drawImage(ships, 0, 256 * k, 512 * k, 128 * k); g.drawImage(wreck, 0, 384 * k, 256 * k, 128 * k); g.drawImage(flak, 256 * k, 384 * k, 256 * k, 64 * k); g.drawImage(beams, 256 * k, 448 * k, 256 * k, 32 * k); } },
  armada: { size: [1536, 768], phone: [1024, 512], src: () => [ART.cruiserSide, ART.haulerSide, ART.arkSide, ART.cruiserDescend, ART.haulerDescend, ART.arkDescend, ART.lightsMask, ART.engineGlow, ART.landingFlare, ART.escape, ART.escorts],
    draw: (g, [cs, hs, as, cd, hd, ad, mask, glow, flare, escape, escorts], w) => {
      const k = w / ARMADA_SHEET.size[0], put = (img, [x, y, rw, rh]) => g.drawImage(img, x * k, y * k, rw * k, rh * k);
      const A = ARMADA_SHEET, M = A.maskFrom;
      put(cs, A.side.cruiser); put(hs, A.side.hauler); put(as, A.side.ark); put(cd, A.descend.cruiser); put(hd, A.descend.hauler); put(ad, A.descend.ark);
      for (const view of ["side", "descend"]) for (const t of ["cruiser", "hauler", "ark"]) { const [sx, sy, sw, sh] = M[view][t], [x, y, rw, rh] = A[view === "side" ? "lightsSide" : "lightsDescend"][t]; g.drawImage(mask, sx, sy, sw, sh, x * k, y * k, rw * k, rh * k); }
      put(glow, A.glow); put(flare, A.flare); put(escape, A.escape); put(escorts, A.escorts);
    } },
};
export const sheetSize = (name, phone) => { const s = SHEETS[name]; return phone ? s.phone || s.size.map((n) => n / 2) : s.size; };
export const sheetBytes = (name, phone) => { const [w, h] = sheetSize(name, phone); return Math.round(w * h * 4 * 4 / 3); };
// Which sheets each part needs: the base sky (any Vivid sky), and each event's own.
export const BASE_SHEETS = Object.freeze(["nebula", "heroes", "glow", "meteors", "bodies", "ring", "war"]);
export const EVENT_SHEETS = Object.freeze({ shattered: ["shattered", "strip"], eclipse: ["twins"], aurora: ["aurora"], armada: ["armada"] });

// ------------------------------------------------------------------------------------------------ the bodies mesh
export function buildBodies(phone = false) {
  const P = [], L = [], UV = [], CELL = [], HALO = [], INFO = [], idx = [];
  const d = new THREE.Vector3(), c = new THREE.Vector3(), halo = new THREE.Color();
  VIVID_BODIES.forEach((b, i) => {
    const disc = DISCS[b.name], [cx, cy, cw, ch] = disc.cell, [W, H] = disc.tex ? SHEET.size : ATLAS.size, pad = disc.tex ? 0 : ATLAS.pad;
    const cellX = (cw / 2 - pad) / disc.r, cellY = (ch / 2 - pad) / disc.r;
    const hx = Math.max(cellX, b.reach), hy = Math.max(cellY, b.reach);
    const at = phone ? phoneBody(b) : b;
    skyDir(b.u, at.el, d);
    const { right, up } = skyFrame(b.u, d);
    const R = Math.tan((at.d / 2) * DEG) * RADIUS;
    c.copy(d).multiplyScalar(RADIUS);
    halo.set(b.halo);
    const base = P.length / 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx * hx, y = sy * hy;
      P.push(c.x + (right.x * x + up.x * y) * R, c.y + (right.y * x + up.y * y) * R, c.z + (right.z * x + up.z * y) * R);
      L.push(x, y);
      UV.push((cx + cw / 2) / W, 1 - (cy + ch / 2) / H, disc.r / W, disc.r / H);
      CELL.push(cellX, cellY);
      HALO.push(halo.r, halo.g, halo.b, b.reach);
      INFO.push(disc.tex, i * 1.7, b.glow, b.rim);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aLocal", new THREE.Float32BufferAttribute(L, 2));
  g.setAttribute("aUv", new THREE.Float32BufferAttribute(UV, 4));
  g.setAttribute("aCell", new THREE.Float32BufferAttribute(CELL, 2));
  g.setAttribute("aHalo", new THREE.Float32BufferAttribute(HALO, 4));
  g.setAttribute("aInfo", new THREE.Float32BufferAttribute(INFO, 4));
  g.setIndex(idx);
  return g;
}
const FAR = /* glsl */ `
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + dir, 1.0);
  p.z = p.w; // on the far plane: only the open sky takes it
`;
const BODY_VS = /* glsl */ `
attribute vec2 aLocal, aCell;
attribute vec4 aUv, aHalo, aInfo;
varying vec2 vLocal, vCell;
varying vec4 vUv, vHalo, vInfo;
varying vec3 vDir;
void main() {
  vLocal = aLocal; vCell = aCell; vUv = aUv; vHalo = aHalo; vInfo = aInfo; vDir = position;
  vec3 dir = position;
  ${FAR}
  gl_Position = p;
}`;
// The sheets are premultiplied sRGB bytes, sampled raw (canvas uploads, filtered and mipmapped premultiplied, so no
// dark fringe): back to the straight sRGB colour, to linear, premultiplied again.
export const UNPM = /* glsl */ `
vec3 srgbLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec4 unpm(vec4 t) { return t.a > 0.002 ? vec4(srgbLin(clamp(t.rgb / t.a, 0.0, 1.0)) * t.a, t.a) : vec4(0.0); }`;
const BODY_FS = /* glsl */ `
uniform sampler2D uMap, uSheet;
uniform float uTime, uPlanets, uMapReady, uSheetReady;
varying vec2 vLocal, vCell;
varying vec4 vUv, vHalo, vInfo;
varying vec3 vDir;
${UNPM}
void main() {
  vec2 q = vLocal;
  float r = length(q);
  vec2 uv = vUv.xy + q * vUv.zw;
  float inCell = step(abs(q.x), vCell.x) * step(abs(q.y), vCell.y);
  vec4 t;
  float ready = vInfo.x < 0.5 ? uMapReady : uSheetReady; // (no halo before its planet has loaded)
  if (vInfo.x < 0.5) { t = texture2D(uMap, uv); t.rgb *= t.a; } // the key-art atlas: straight alpha
  else t = unpm(texture2D(uSheet, uv));
  t *= inCell;
  vec3 d = normalize(vDir);
  float rise = smoothstep(-0.01, 0.02, d.y);
  float pulse = 1.0 + 0.22 * sin(uTime * 0.7853982 + vInfo.y); // a slow 8 s breath
  float facing = r > 1e-3 ? max(dot(q / r, vec2(-0.7071, 0.7071)), 0.0) : 0.0; // the key light, upper left
  // The atmosphere's halo outside the disc (brighter on the lit side) and the lit rim on the upper-left limb.
  float span = max(vHalo.w - 1.0, 0.05), out1 = max(r - 1.0, 0.0);
  float halo = exp(-out1 * 3.4 / span) * (1.0 - smoothstep(0.6, 1.0, out1 / span)) * smoothstep(0.92, 1.0, r);
  halo *= (0.42 + 0.58 * facing) * vInfo.z * pulse;
  float rim = smoothstep(0.8, 0.985, r) * (1.0 - smoothstep(0.985, 1.03, r)) * facing * vInfo.w;
  vec3 col = t.rgb + vHalo.rgb * (halo * (1.0 - t.a) + rim * t.a * (0.75 + 0.25 * pulse));
  float k = uPlanets * rise * ready;
  gl_FragColor = vec4(col * k, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.a = t.a * k;
}`;

// ------------------------------------------------------------------------------------------------ meteors
export const METEOR_MAX = METEORS.shower.slots;
// One quad, instanced: per slot a seed, its cycle (s), a phase offset and the streak row (0 blue-white, 1 violet).
export function buildMeteors(seed = "none", kind = "normal") {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const rnd = skyRandom(seed, `meteors-${kind}`), spec = METEORS[kind] || METEORS.normal, data = new Float32Array(METEOR_MAX * 4);
  for (let i = 0; i < METEOR_MAX; i++) {
    const period = spec.period[0] + rnd() * (spec.period[1] - spec.period[0]);
    data.set([1 + rnd() * 97, period, rnd() * period, rnd() < 0.62 ? 0 : 1], i * 4);
  }
  g.setAttribute("aMeteor", new THREE.InstancedBufferAttribute(data, 4));
  g.instanceCount = spec.slots;
  g.userData.kind = kind;
  return g;
}
const HASH = /* glsl */ `float h1(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }`;
const METEOR_VS = /* glsl */ `
attribute vec4 aMeteor;
uniform float uTime, uFront, uShower, uRadiant;
uniform vec2 uMeteorEl;
varying vec2 vUv;
varying float vFade;
${HASH}
void main() {
  float P = aMeteor.y, cyc = floor((uTime + aMeteor.z) / P), at = uTime + aMeteor.z - cyc * P;
  float s = aMeteor.x * 17.0 + cyc * 3.71;
  float life = 1.1 + 0.9 * h1(s + 1.0), t0 = h1(s + 2.0) * max(P - life, 0.0), age = at - t0;
  float live = step(0.0, age) * step(age, life);
  // All round the sky; a shower falls from its radiant (one bearing), away from it to both sides.
  float yaw = mix(h1(s + 3.0) * 6.2831853, uRadiant + (h1(s + 3.0) - 0.5) * 2.4, uShower);
  float side = mix(h1(s + 6.0) > 0.5 ? 1.0 : -1.0, sign(yaw - uRadiant + 1e-4), uShower);
  float el = (uMeteorEl.x + uMeteorEl.y * h1(s + 4.0)) * ${DEG}, ang = -(16.0 + 24.0 * h1(s + 5.0)) * ${DEG};
  float len = (2.8 + 3.2 * h1(s + 7.0)) * ${DEG}, travel = (4.5 + 5.0 * h1(s + 8.0)) * ${DEG}, wid = 0.55 * ${DEG};
  float k = clamp(age / life, 0.0, 1.0);
  vec3 base = vec3(sin(yaw) * cos(el), sin(el), cos(yaw) * cos(el));
  vec3 right = vec3(-cos(yaw), 0.0, sin(yaw)), up = normalize(vec3(0.0, 1.0, 0.0) - base * base.y);
  vec2 mv = vec2(cos(ang) * side, sin(ang));
  vec2 o = mv * (travel * k + (position.x - 1.0) * len) + vec2(-mv.y, mv.x) * position.y * wid;
  vec3 dir = normalize(base + right * o.x + up * o.y) * ${RADIUS.toFixed(1)};
  ${FAR}
  gl_Position = live > 0.5 ? p : vec4(0.0, 0.0, 2.0, 1.0);
  float row = aMeteor.w;
  vUv = vec2(position.x * 0.97, (1.0 - row) * 0.5 + 0.25 + position.y * 0.25);
  vFade = smoothstep(0.0, 0.14, k) * (1.0 - smoothstep(0.55, 1.0, k)) * smoothstep(0.0, 0.03, base.y);
}`;
const METEOR_FS = /* glsl */ `
uniform sampler2D uStreaks;
uniform float uReady;
varying vec2 vUv;
varying float vFade;
${UNPM}
void main() {
  vec4 t = unpm(texture2D(uStreaks, vUv)) * vFade * uReady;
  gl_FragColor = vec4(t.rgb * 1.6, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.a = 0.0; // added
}`;

// ------------------------------------------------------------------------------------------------ the event mesh
// Kinds: 0 the shattered planet (base, crack glow, flames, corona), 1 its shockwave, 2 a debris chunk, 3 the eclipse's
// sun, 4 the twin moons, 5 the aurora curtain. Local coordinates are stage radii (the event body's disc radius).
export const SHATTER = Object.freeze({
  // The packed sheet's cells (SHEETS.shattered, fractions of its 1024x1280): base, flames, crack glow, shockwave, debris row.
  base: [0, 0, 0.5, 0.4], flames: [0.5, 0, 0.5, 0.4], cracks: [0, 0.4, 0.5, 0.4], shock: [0.5, 0.4, 0.5, 0.4], debris: [0, 0.8, 1, 0.2],
  disc: 450 / 1024, ring: 471 / 1024, corona: [0.9, 1.42], shockGrow: 2.8, shockLife: 6, shockEvery: [20, 30], chunks: 10, cells: 6,
  breathe: 4, // seconds: the cracks' breath
});
export const ECLIPSE = Object.freeze({ period: 150, sun: 0.62, from: [-2.6, 0.62], to: [2.6, -0.5], large: [469, 256, 222], small: [632, 330, 146], size: [1024, 512] });
export const AURORA = Object.freeze({ u0: -78, u1: 78, el0: 2.6, el1: 15, segments: 40, repeat: 2.5 });

function eventGeometry(build) {
  const P = [], L = [], UV = [], K = [], S = [], idx = [];
  const vert = (p, l, uv, kind, seed) => { P.push(p[0], p[1], p[2]); L.push(l[0], l[1]); UV.push(uv[0], uv[1]); K.push(kind); S.push(seed); return K.length - 1; };
  const quad = (kind, seed, hx, hy, cx = 0, cy = 0, uv = [0, 0, 1, 1]) => {
    const a = vert([0, 0, 0], [cx - hx, cy - hy], [uv[0], uv[1]], kind, seed), b = vert([0, 0, 0], [cx + hx, cy - hy], [uv[2], uv[1]], kind, seed);
    const c = vert([0, 0, 0], [cx + hx, cy + hy], [uv[2], uv[3]], kind, seed), d = vert([0, 0, 0], [cx - hx, cy + hy], [uv[0], uv[3]], kind, seed);
    idx.push(a, b, c, a, c, d);
  };
  build({ vert, quad, idx });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aLocal", new THREE.Float32BufferAttribute(L, 2));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(K, 1));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(idx);
  return g;
}
// The event meshes by id (sky-events.js SKY_EVENTS[id].mesh). A new event adds its builder here.
export const EVENT_MESHES = {
  shattered: { code: 1, build: () => eventGeometry(({ quad }) => {
    const shock = 1 / (SHATTER.ring * 2); // the ring sits at 1 stage radius when the quad is +-shock
    quad(1, 0, shock, shock); // the shockwave first: it passes behind the planet
    quad(0, 0, SHATTER.corona[1], SHATTER.corona[1]);
    for (let i = 0; i < SHATTER.chunks; i++) {
      const cell = i % SHATTER.cells, [x0, y0, w, h] = SHATTER.debris;
      const u0 = x0 + (cell * 160) / 1024, u1 = u0 + 160 / 1024, v1 = 1 - y0, v0 = 1 - (y0 + h * (160 / 256));
      quad(2, i + 1, 1, 1, 0, 0, [u0, v0, u1, v1]);
    }
  }) },
  eclipse: { code: 2, build: () => eventGeometry(({ quad }) => {
    const [W, H] = ECLIPSE.size, [lx, ly, lr] = ECLIPSE.large;
    quad(3, 0, 3.4, 3.4); // the sun (placed along its path in the shader)
    // The twin moons' sheet, the larger moon's centre at the stage point.
    const hx = W / 2 / lr, hy = H / 2 / lr, cx = (W / 2 - lx) / lr, cy = -(H / 2 - ly) / lr;
    quad(4, 0, hx, hy, cx, cy);
  }) },
  aurora: { code: 3, build: () => eventGeometry(({ vert, idx }) => {
    const A = AURORA, d = new THREE.Vector3(), rows = [];
    for (let i = 0; i <= A.segments; i++) {
      const t = i / A.segments, u = A.u0 + (A.u1 - A.u0) * t, bow = 1.6 * Math.sin(t * Math.PI);
      const lo = skyDir(u, A.el0 + bow * 0.4, d).multiplyScalar(RADIUS).toArray(), hi = skyDir(u, A.el1 + bow, d).multiplyScalar(RADIUS).toArray();
      rows.push([vert(lo, [t, 0], [t * A.repeat, 0], 5, 0), vert(hi, [t, 1], [t * A.repeat, 1], 5, 0)]);
    }
    for (let i = 0; i < A.segments; i++) idx.push(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][0], rows[i + 1][1], rows[i][1]);
  }) },
  armada: { code: 4, build: () => buildArmada() },
};
const NOISE = /* glsl */ `
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y); }
float tri(float t) { t = fract(t); return 1.0 - abs(1.0 - 2.0 * t); }`;
// ------------------------------------------------------------------------------------------------ the armada
// "Armada landfall" (sky-war.js armadaPlan / armadaPose; art in src/art/sky/armada/): one sheet in a 2048x1024 design
// space, drawn at 3/4 on a PC and 1/2 on a phone. Ships at half their painted size (each still 150-400 px on screen),
// their light masks beside them (the mask sheet holds them at half size already), the engine glow, the landing flare,
// the escorts and the escape craft.
export const ARMADA_SHEET = Object.freeze({
  size: [2048, 1024],
  side: { cruiser: [640, 0, 512, 160], hauler: [1152, 0, 512, 160], ark: [0, 0, 640, 192] },
  descend: { cruiser: [448, 192, 384, 256], hauler: [832, 192, 384, 256], ark: [0, 192, 448, 256] },
  lightsSide: { cruiser: [640, 448, 512, 160], hauler: [1152, 448, 512, 160], ark: [0, 448, 640, 192] },
  lightsDescend: { cruiser: [448, 640, 384, 256], hauler: [832, 640, 384, 256], ark: [0, 640, 448, 256] },
  // where each light mask sits in lights-mask.webp (manifest lightsRect)
  maskFrom: { side: { cruiser: [8, 8, 512, 160], hauler: [8, 280, 512, 160], ark: [8, 552, 640, 192] }, descend: { cruiser: [632, 8, 384, 256], hauler: [632, 280, 384, 256], ark: [568, 752, 448, 256] } },
  glow: [1664, 0, 256, 64], flare: [1216, 192, 512, 256], escape: [1216, 768, 512, 128], escorts: [1216, 896, 512, 128],
});
const SHIP_ORDER = ["cruiser", "hauler", "ark"]; // ARMADA_SHIPS index order
// A rectangle of the armada sheet as uv (u0, v0, u1, v1; the canvas is uploaded flipped, so v counts up).
const rectUv = ([x, y, w, h], [W, H] = ARMADA_SHEET.size) => [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];
const vec4s = (list) => `vec4[${list.length}](${list.map((r) => `vec4(${r.map((n) => n.toFixed(5)).join(", ")})`).join(", ")})`;
const vec2s = (list) => `vec2[${list.length}](${list.map((r) => `vec2(${r.map((n) => n.toFixed(5)).join(", ")})`).join(", ")})`;
// Engine points as local coordinates of their image (x -0.5..0.5 left to right, y -0.5..0.5 bottom to top).
const engineLocal = (type, view) => { const s = ARMADA_SHIPS[type], [W, H] = s[view]; return s.engines[view].map(([x, y]) => [x / W - 0.5, 0.5 - y / H]); };
export const ARMADA_GLSL = /* glsl */ `
const vec4 SHIP_SIDE[3] = ${vec4s(SHIP_ORDER.map((t) => rectUv(ARMADA_SHEET.side[t])))};
const vec4 SHIP_DESC[3] = ${vec4s(SHIP_ORDER.map((t) => rectUv(ARMADA_SHEET.descend[t])))};
const vec4 LIGHT_SIDE[3] = ${vec4s(SHIP_ORDER.map((t) => rectUv(ARMADA_SHEET.lightsSide[t])))};
const vec4 LIGHT_DESC[3] = ${vec4s(SHIP_ORDER.map((t) => rectUv(ARMADA_SHEET.lightsDescend[t])))};
const vec2 SHIP_ASPECT[3] = ${vec2s(SHIP_ORDER.map((t) => { const s = ARMADA_SHIPS[t]; return [s.side[1] / s.side[0], s.descend[0] / s.side[0]]; }))};
const vec2 DESC_ASPECT[3] = ${vec2s(SHIP_ORDER.map((t) => { const s = ARMADA_SHIPS[t]; return [s.descend[1] / s.descend[0], s.glow]; }))};
const vec2 ENG_SIDE[6] = ${vec2s(SHIP_ORDER.flatMap((t) => engineLocal(t, "side")))};
const vec2 ENG_DESC[6] = ${vec2s(SHIP_ORDER.flatMap((t) => engineLocal(t, "descend")))};
const vec4 GLOW_RECT = vec4(${rectUv(ARMADA_SHEET.glow).map((n) => n.toFixed(5)).join(", ")});
const vec4 FLARE_RECT = vec4(${rectUv(ARMADA_SHEET.flare).map((n) => n.toFixed(5)).join(", ")});
const vec4 ESCAPE_RECT = vec4(${rectUv(ARMADA_SHEET.escape).map((n) => n.toFixed(5)).join(", ")});
const vec4 ESCORT_RECT = vec4(${rectUv(ARMADA_SHEET.escorts).map((n) => n.toFixed(5)).join(", ")});
vec2 inRect(vec4 r, vec2 uv) { return vec2(mix(r.x, r.z, uv.x), mix(r.y, r.w, uv.y)); }
`;
// The armada's quads: per ship slot its side view, its descend view and two engine glows for each; then the escorts
// and escape craft round the battleship, then the landing flare. aSeed: the slot (or the craft's number).
export function buildArmada() {
  return eventGeometry(({ quad }) => {
    for (let i = 0; i < ARMADA.slots; i++) {
      quad(6, i, 0.5, 0.5);
      quad(7, i, 0.5, 0.5);
      for (let j = 0; j < 4; j++) quad(8, i * 4 + j, 0.5, 0.5);
    }
    for (let i = 0; i < 8; i++) quad(9, i, 0.5, 0.5);
    quad(10, 0, 0.5, 0.5);
  });
}

// ------------------------------------------------------------------------------------------------ the orbital layer
// One draw (sky-war.js; art in src/art/sky/orbital/): the orbital ring, a wide low arc of structure across every Vivid
// sky (its lit edge toward the sun, lights travelling along it, a teal-violet glow strip under it), and the far space
// war of sky-war.js (warships, short beam dashes, round blooms, flak, a falling wreck) over a band of battle haze.
// Behind the bodies (its draw comes first), on the far plane like the rest.
export const ORBIT = Object.freeze({
  apex: 4, top: 11.2, half: 54, height: 2.8, tile: 44, segments: 72, glowDrop: 1.6, glowHeight: 1.5,
  haze: [{ u0: -12, u1: 20, el0: 4.6, el1: 10.8 }, { u0: 160, u1: 212, el0: 6.4, el1: 12.6 }],
});
// The ring sheet (design 2048x352, repeating across): band, its light mask, the glow strip and the battle haze rows.
export const RING_ROWS = Object.freeze({ size: [2048, 352], band: [0, 128], lights: [128, 128], glow: [256, 32], haze: [288, 64] });
// The war sheet (512x512): explosion flipbook (8 cells of 128), warships (8 of 128x64), the wreck, flak (4 of 64), beams.
export const WAR_SHEET = Object.freeze({ size: [512, 512], blooms: [0, 0, 512, 256], ships: [0, 256, 512, 128], wreck: [0, 384, 256, 128], flak: [256, 384, 256, 64], beams: [256, 448, 256, 32] });
export const ringEl = (u, top = ORBIT.top) => { const d = (u - ORBIT.apex) / ORBIT.half; return Math.abs(d) >= 1 ? -2 : top * Math.cos((d * Math.PI) / 2) - 2 * (1 - Math.cos((d * Math.PI) / 2)); };
export function buildOrbit(phone = false) {
  const top = phone ? PHONE_FIT.ringTop : ORBIT.top;
  const P = [], L = [], UV = [], K = [], S = [], idx = [], d = new THREE.Vector3();
  const vert = (p, l, uv, kind, seed) => { P.push(p[0], p[1], p[2]); L.push(l[0], l[1]); UV.push(uv[0], uv[1]); K.push(kind); S.push(seed); return K.length - 1; };
  const strip = (kind, from, to, n, lo, hi, uScale) => {
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = from + (to - from) * t;
      rows.push([vert(skyDir(u, lo(u), d).multiplyScalar(RADIUS).toArray(), [t, 0], [(u - from) / uScale, 0], kind, 0), vert(skyDir(u, hi(u), d).multiplyScalar(RADIUS).toArray(), [t, 1], [(u - from) / uScale, 1], kind, 0)]);
    }
    for (let i = 0; i < n; i++) idx.push(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][0], rows[i + 1][1], rows[i][1]);
  };
  // The battle haze first (behind the war), then the war's slots, then the ring and its glow strip.
  for (const h of ORBIT.haze) strip(2, h.u0, h.u1, 8, () => h.el0, () => h.el1, (h.u1 - h.u0) / 1.4);
  for (let i = 0; i < WAR_SLOTS; i++) {
    const a = vert([0, 0, 0], [-0.5, -0.5], [0, 0], 3, i), b = vert([0, 0, 0], [0.5, -0.5], [1, 0], 3, i), c = vert([0, 0, 0], [0.5, 0.5], [1, 1], 3, i), e = vert([0, 0, 0], [-0.5, 0.5], [0, 1], 3, i);
    idx.push(a, b, c, a, c, e);
  }
  const from = ORBIT.apex - ORBIT.half, to = ORBIT.apex + ORBIT.half, H = ORBIT.height;
  strip(1, from, to, ORBIT.segments, (u) => ringEl(u, top) - ORBIT.glowDrop - ORBIT.glowHeight / 2, (u) => ringEl(u, top) - ORBIT.glowDrop + ORBIT.glowHeight / 2, ORBIT.tile);
  strip(0, from, to, ORBIT.segments, (u) => ringEl(u, top) - H / 2, (u) => ringEl(u, top) + H / 2, ORBIT.tile);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aLocal", new THREE.Float32BufferAttribute(L, 2));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(K, 1));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(idx);
  return g;
}
const ROW = (row) => { const [y, h] = RING_ROWS[row], H = RING_ROWS.size[1]; return [1 - (y + h) / H, 1 - y / H]; };
const WRECT = (name) => { const [x, y, w, h] = WAR_SHEET[name], [W, Hh] = WAR_SHEET.size; return `vec4(${[x / W, 1 - (y + h) / Hh, w / W, h / Hh].map((n) => n.toFixed(5)).join(", ")})`; };
const ORBIT_VS = /* glsl */ `
attribute vec2 aLocal;
attribute float aKind, aSeed;
uniform vec4 uWar[${WAR_SLOTS * 2}];
uniform float uFront, uWarK;
varying vec2 vUv, vLocal;
varying float vKind, vAlpha;
varying vec4 vPose;
varying vec3 vDir;
void main() {
  vUv = uv; vLocal = aLocal; vKind = aKind; vAlpha = 1.0; vPose = vec4(0.0);
  vec3 dir = position;
  if (aKind > 2.5) {
    // A war slot (sky-war.js warPose): u, el, size (degrees), alpha | cell, angle, kind, flip.
    int s = int(aSeed + 0.5);
    vec4 A = uWar[s * 2], B = uWar[s * 2 + 1];
    vPose = B; vAlpha = A.w * uWarK;
    float kind = B.z, yaw = uFront - A.x * ${DEG}, el = A.y * ${DEG}, size = A.z * ${DEG};
    vec2 scale = kind < 0.5 ? vec2(1.0, 0.5) : kind < 1.5 ? vec2(1.0, 0.09) : kind > 3.5 ? vec2(1.0, 0.5) : vec2(1.0);
    vec2 q = aLocal * scale * size;
    float a = B.y;
    q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
    vec3 base = vec3(sin(yaw) * cos(el), sin(el), cos(yaw) * cos(el));
    vec3 right = vec3(-cos(yaw), 0.0, sin(yaw)), up = normalize(vec3(0.0, 1.0, 0.0) - base * base.y);
    dir = normalize(base + right * q.x + up * q.y) * ${RADIUS.toFixed(1)};
  }
  vDir = dir;
  ${FAR}
  gl_Position = vAlpha > 0.003 ? p : vec4(0.0, 0.0, 2.0, 1.0);
}`;
const ORBIT_FS = /* glsl */ `
uniform sampler2D uRingMap, uWarMap;
uniform float uTime, uRingReady, uWarReady, uPlanets;
uniform vec3 uHaze, uSun;
varying vec2 vUv, vLocal;
varying float vKind, vAlpha;
varying vec4 vPose;
varying vec3 vDir;
${UNPM}
float hashO(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
vec4 cellOf(vec4 r, float i, vec2 grid, vec2 uv) { vec2 c = vec2(mod(i, grid.x), floor(i / grid.x)); return texture2D(uWarMap, vec2(r.x + r.z * (c.x + uv.x) / grid.x, r.y + r.w * (1.0 - (c.y + 1.0 - uv.y) / grid.y))); }
void main() {
  vec4 acc = vec4(0.0);
  vec3 d = normalize(vDir);
  if (vKind < 0.5) {
    // The ring: its band (lit upper edge, panels, docks), the window lights travelling along it and twinkling.
    float v = clamp(vLocal.y, 0.01, 0.99);
    vec2 band = vec2(${ROW("band")[0].toFixed(5)}, ${ROW("band")[1].toFixed(5)}), lights = vec2(${ROW("lights")[0].toFixed(5)}, ${ROW("lights")[1].toFixed(5)});
    acc = unpm(texture2D(uRingMap, vec2(vUv.x, mix(band.x, band.y, v))));
    float m = texture2D(uRingMap, vec2(vUv.x, mix(lights.x, lights.y, v))).r;
    float travel = 0.35 + 0.65 * smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vUv.x * 37.7 - uTime * 0.9));
    float twinkle = 0.75 + 0.25 * sin(uTime * 3.1 + hashO(floor(vec2(vUv.x * 300.0, v * 8.0))) * 40.0);
    acc.rgb += vec3(1.0, 0.93, 0.76) * m * m * travel * twinkle * 1.4 * acc.a;
    // the sun-side edge lit a little brighter, the rest hazed toward the sky behind it (far, softer)
    vec2 h = d.xz / max(length(d.xz), 1e-4);
    acc.rgb *= 1.0 + 0.35 * smoothstep(0.6, 0.95, v) * max(dot(h, normalize(uSun.xz)), 0.0);
    acc.rgb = mix(acc.rgb, uHaze * acc.a, 0.22) * uRingReady;
    acc.a *= uRingReady;
  } else if (vKind < 1.5) {
    vec2 glow = vec2(${ROW("glow")[0].toFixed(5)}, ${ROW("glow")[1].toFixed(5)});
    vec4 t = unpm(texture2D(uRingMap, vec2(vUv.x * 0.5 + uTime * 0.002, mix(glow.x, glow.y, clamp(vLocal.y, 0.02, 0.98)))));
    acc = vec4(t.rgb * 0.42 * uRingReady, 0.0);
  } else if (vKind < 2.5) {
    vec2 haze = vec2(${ROW("haze")[0].toFixed(5)}, ${ROW("haze")[1].toFixed(5)});
    vec4 t = unpm(texture2D(uRingMap, vec2(vUv.x + uTime * 0.003, mix(haze.x, haze.y, clamp(vLocal.y, 0.02, 0.98)))));
    float ends = smoothstep(0.0, 0.2, vLocal.x) * (1.0 - smoothstep(0.8, 1.0, vLocal.x));
    acc = t * ends * 0.8 * uRingReady * uWarReady;
  } else {
    // The far war: hazed and soft; beams, blooms and flak glow (added), ships and the wreck cover.
    vec2 uv = vLocal + 0.5;
    float kind = vPose.z;
    if (vPose.w < 0.0) uv.x = 1.0 - uv.x;
    if (kind < 0.5) {
      acc = unpm(cellOf(${WRECT("ships")}, vPose.x, vec2(4.0, 2.0), uv));
      acc.rgb = mix(acc.rgb, uHaze * acc.a, 0.35);
    } else if (kind < 1.5) {
      vec4 r = ${WRECT("beams")};
      vec4 t = unpm(texture2D(uWarMap, vec2(r.x + r.z * uv.x, r.y + r.w * (vPose.x < 0.5 ? 0.5 + 0.5 * uv.y : 0.5 * uv.y))));
      acc = vec4(t.rgb * 1.6, 0.0);
    } else if (kind < 2.5) {
      acc = unpm(cellOf(${WRECT("blooms")}, vPose.x, vec2(4.0, 2.0), uv));
      acc.rgb *= 1.35;
      acc.a *= 0.7;
    } else if (kind < 3.5) {
      vec4 t = unpm(cellOf(${WRECT("flak")}, vPose.x, vec2(4.0, 1.0), uv));
      acc = vec4(t.rgb * 1.5, 0.0);
    } else {
      vec4 r = ${WRECT("wreck")};
      acc = unpm(texture2D(uWarMap, vec2(r.x + r.z * uv.x, r.y + r.w * uv.y)));
      acc.rgb = mix(acc.rgb, uHaze * acc.a, 0.25) * (0.9 + 0.2 * sin(uTime * 9.0));
    }
    acc *= vAlpha * uWarReady;
  }
  float k = uPlanets * smoothstep(-0.01, 0.02, d.y);
  gl_FragColor = vec4(acc.rgb * k, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.a = acc.a * k;
}`;

const EVENT_VS = /* glsl */ `
attribute vec2 aLocal;
attribute float aKind, aSeed;
uniform float uTime;
uniform vec3 uStage, uStageRight, uStageUp;
uniform float uStageR;
uniform vec2 uShock;
uniform float uFront;
uniform vec4 uShipA[${ARMADA.slots}], uShipB[${ARMADA.slots}], uFlare;
varying vec2 vLocal, vUv, vSun;
varying float vKind, vAlpha;
varying vec4 vInfo;
varying vec3 vDir;
${HASH}
${ARMADA_GLSL}
// A sky point u, el (degrees) moved by q degrees along the sky's right and up there.
vec3 skyAt(float u, float el, vec2 q) {
  float yaw = uFront - u * ${DEG}, e = el * ${DEG};
  vec3 base = vec3(sin(yaw) * cos(e), sin(e), cos(yaw) * cos(e));
  vec3 right = vec3(-cos(yaw), 0.0, sin(yaw)), up = normalize(vec3(0.0, 1.0, 0.0) - base * base.y);
  return normalize(base + (right * q.x + up * q.y) * ${DEG}) * ${RADIUS.toFixed(1)};
}
void main() {
  vLocal = aLocal; vUv = uv; vKind = aKind; vAlpha = 1.0; vSun = vec2(0.0); vInfo = vec4(0.0);
  vec3 dir;
  if (aKind > 5.5) {
    // The armada (sky-war.js armadaPose): uShipA = u, el, length (degrees), alpha; uShipB = descend mix, ship type.
    if (aKind < 8.5) {
      int i = aKind < 7.5 ? int(aSeed + 0.5) : int(floor(aSeed / 4.0 + 0.01));
      vec4 A = uShipA[i], B = uShipB[i];
      int type = int(B.y + 0.5);
      float w = A.z, h = w * SHIP_ASPECT[type].x, wd = w * SHIP_ASPECT[type].y, hd = wd * DESC_ASPECT[type].x;
      vInfo = vec4(B.y, DESC_ASPECT[type].y, 1.0, 0.0);
      vec2 q;
      if (aKind < 6.5) { q = aLocal * vec2(w, h); vAlpha = A.w * (1.0 - B.x); }
      else if (aKind < 7.5) { q = aLocal * vec2(wd, hd); vAlpha = A.w * B.x; }
      else {
        // An engine glow at its nozzle, the plume pointing aft (a descend view's tilted 20 degrees).
        int j = int(mod(aSeed + 0.5, 4.0));
        bool desc = j >= 2;
        vec2 e = desc ? ENG_DESC[type * 2 + j - 2] * vec2(wd, hd) : ENG_SIDE[type * 2 + j] * vec2(w, h);
        float L = 0.3 * w, ang = desc ? -0.349 : 0.0;
        vec2 o = vec2((aLocal.x - (0.855 - 0.5)) * L, aLocal.y * L * 0.5);
        q = e + mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * o;
        vAlpha = A.w * (desc ? B.x : 1.0 - B.x) * (0.82 + 0.18 * sin(uTime * 23.0 + aSeed * 3.1));
      }
      dir = skyAt(A.x, A.y, q);
    } else if (aKind < 9.5) {
      // Escorts and escape craft circling the battleship (slot 0), smaller and simpler, in its colours.
      vec4 A = uShipA[0], B = uShipB[0];
      float s = aSeed, ang = uTime * (0.07 + 0.025 * s) + s * 0.785;
      float rx = A.z * (0.5 + 0.06 * s), ry = A.z * (0.16 + 0.025 * s), size = A.z * (s < 3.5 ? 0.1 : 0.085);
      vec2 c = vec2(cos(ang) * rx, sin(ang) * ry + A.z * 0.04);
      vInfo = vec4(s, 0.0, -sin(ang) < 0.0 ? -1.0 : 1.0, 0.0);
      vAlpha = A.w * (sin(ang) > 0.35 ? 0.6 : 1.0);
      dir = skyAt(A.x, A.y, c + aLocal * vec2(size, size));
    } else {
      // The landing flare on the horizon where a ship went down.
      float wf = uFlare.z;
      vAlpha = uFlare.y;
      // (its foot lifted a little: the far hills hide where the ship went down, the dome of light rises over them)
      dir = skyAt(uFlare.x, 0.0, vec2(aLocal.x * wf, (aLocal.y + 0.5) * wf * 0.5 + 1.6));
    }
  } else if (aKind > 4.5) {
    // The aurora: the curtain sways and ripples (its top more than its foot).
    float sway = sin(aLocal.x * 9.0 + uTime * 0.23) * 0.012 + sin(aLocal.x * 23.0 - uTime * 0.41) * 0.005;
    dir = position + vec3(0.0, sway * ${RADIUS.toFixed(1)} * aLocal.y, 0.0);
  } else {
    vec2 o = aLocal;
    if (aKind > 0.5 && aKind < 1.5) {
      // The shockwave: grows outward and fades over ${SHATTER.shockLife} s from each start (uShock.x), when allowed (uShock.y).
      float age = uTime - uShock.x, k = clamp(age / ${SHATTER.shockLife.toFixed(1)}, 0.0, 1.0);
      o *= 1.0 + ${SHATTER.shockGrow.toFixed(2)} * (1.0 - (1.0 - k) * (1.0 - k));
      vAlpha = uShock.y * step(0.0, age) * step(age, ${SHATTER.shockLife.toFixed(1)}) * (1.0 - k) * smoothstep(0.0, 0.3, age);
    } else if (aKind > 1.5 && aKind < 2.5) {
      // A debris chunk: drifts slowly outward from the broken planet, turning, then fades and starts again.
      float P = 40.0 + 30.0 * h1(aSeed), ph = fract((uTime + h1(aSeed + 1.0) * P) / P);
      float a = h1(aSeed + 2.0) * 6.2831853, rot = h1(aSeed + 3.0) * 6.2831853 + uTime * (h1(aSeed + 4.0) - 0.5) * 0.4;
      float size = 0.1 + 0.1 * h1(aSeed + 5.0);
      mat2 turn = mat2(cos(rot), sin(rot), -sin(rot), cos(rot));
      o = vec2(cos(a), sin(a)) * (1.08 + 1.5 * ph) + turn * aLocal * size;
      vAlpha = smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.62, 1.0, ph));
    } else if (aKind > 2.5 && aKind < 3.5) {
      // The eclipse's sun slides behind the larger moon and out again (${ECLIPSE.period} s).
      // (eased: it lingers near totality; a still sky holds it there, its corona out)
      float k = fract(uTime / ${ECLIPSE.period.toFixed(1)} + 0.47) * 2.0 - 1.0;
      k = 0.5 + 0.5 * sign(k) * pow(abs(k), 1.8);
      vSun = mix(vec2(${ECLIPSE.from[0].toFixed(2)}, ${ECLIPSE.from[1].toFixed(2)}), vec2(${ECLIPSE.to[0].toFixed(2)}, ${ECLIPSE.to[1].toFixed(2)}), k);
      o = vSun + aLocal * ${ECLIPSE.sun.toFixed(2)} * 2.0;
      vLocal = o;
    }
    dir = uStage * ${RADIUS.toFixed(1)} + (uStageRight * o.x + uStageUp * o.y) * uStageR;
  }
  vDir = dir;
  ${FAR}
  // The landing flare's light rises over the far hills that hide the ship (just in front of the far ring's layers).
  if (aKind > 9.5) p.z = p.w * 0.99992;
  gl_Position = vAlpha > 0.0 ? p : vec4(0.0, 0.0, 2.0, 1.0);
}`;
const EVENT_FS = /* glsl */ `
uniform sampler2D uMapA, uFlame;
uniform float uTime, uReady, uPlanets;
uniform vec3 uHaze;
varying vec2 vLocal, vUv, vSun;
varying float vKind, vAlpha;
varying vec4 vInfo;
varying vec3 vDir;
${ARMADA_GLSL}
${UNPM}
${NOISE}
vec2 cell(vec4 c, vec2 q) { return vec2(c.x + c.z * (0.5 + q.x * ${SHATTER.disc.toFixed(4)}), 1.0 - c.y - c.w * (0.5 - q.y * ${SHATTER.disc.toFixed(4)})); }
void main() {
  vec4 acc = vec4(0.0);
  vec2 q = vLocal;
  float r = length(q);
  if (vKind > 5.5) {
    vec2 uv = vLocal + 0.5;
    int type = int(vInfo.x + 0.5);
    if (vKind < 7.5) {
      // A capital ship far away: hazed, its running lights blinking, its windows lit, its shield and reactor breathing.
      bool desc = vKind > 6.5;
      vec4 t = unpm(texture2D(uMapA, inRect(desc ? SHIP_DESC[type] : SHIP_SIDE[type], uv)));
      float m = texture2D(uMapA, inRect(desc ? LIGHT_DESC[type] : LIGHT_SIDE[type], uv)).r;
      vec3 c = t.rgb;
      float cyan = smoothstep(0.02, 0.12, min(c.g, c.b) - c.r * 1.1);
      c += c * cyan * (0.45 + 0.4 * sin(uTime * 1.7));
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(mix(vec3(lum), c, 0.85), uHaze * t.a, 0.28);
      vec2 cell = floor(uv * vec2(46.0, 9.0));
      float h = hash2(cell), blink = h > 0.72 ? step(0.55, fract(uTime * 0.8 + h * 7.0)) * 1.6 : 0.55;
      c += vec3(1.0, 0.93, 0.8) * m * blink * t.a;
      acc = vec4(c, t.a) * vAlpha;
    } else if (vKind < 8.5) {
      vec4 t = unpm(texture2D(uMapA, inRect(GLOW_RECT, vec2((vInfo.y + clamp(uv.x, 0.01, 0.99)) * 0.5, uv.y))));
      acc = vec4(t.rgb * 1.4 * vAlpha, 0.0);
    } else if (vKind < 9.5) {
      if (vInfo.z < 0.0) uv.x = 1.0 - uv.x;
      float s = vInfo.x, i = mod(s, 4.0);
      vec4 r = s < 3.5 ? ESCORT_RECT : ESCAPE_RECT;
      vec4 t = unpm(texture2D(uMapA, vec2(mix(r.x, r.z, (i + clamp(uv.x, 0.01, 0.99)) * 0.25), mix(r.y, r.w, uv.y))));
      t.rgb = mix(t.rgb, uHaze * t.a, 0.25);
      acc = t * vAlpha;
    } else {
      vec4 t = unpm(texture2D(uMapA, inRect(FLARE_RECT, vec2(uv.x, clamp(uv.y, 0.004, 0.996)))));
      acc = vec4(t.rgb * 2.4 * vAlpha, 0.0);
    }
  } else if (vKind < 0.5) {
    // The shattered planet: a flame corona behind it, the broken rock, its cracks breathing, flames licking out.
    float inC = step(abs(q.x), 1.13) * step(abs(q.y), 1.13);
    float th = atan(q.y, q.x) / 6.2831853;
    vec4 co = unpm(texture2D(uFlame, vec2(tri(th) * 3.0 + uTime * 0.025, clamp((r - ${SHATTER.corona[0].toFixed(2)}) / ${(SHATTER.corona[1] - SHATTER.corona[0]).toFixed(2)}, 0.004, 0.996))));
    co *= step(${SHATTER.corona[0].toFixed(2)}, r) * step(r, ${SHATTER.corona[1].toFixed(2)}) * (0.3 + 0.7 * vnoise2(vec2(th * 14.0, uTime * 0.12))) * 0.85;
    vec4 base = unpm(texture2D(uMapA, cell(vec4(${SHATTER.base.join(", ")}), q))) * inC;
    float m = texture2D(uMapA, cell(vec4(${SHATTER.cracks.join(", ")}), q)).r * inC;
    vec2 jit = vec2(vnoise2(q * 3.0 + uTime * 0.7), vnoise2(q * 3.0 - uTime * 0.6)) * 0.012;
    vec4 fl = unpm(texture2D(uMapA, cell(vec4(${SHATTER.flames.join(", ")}), q + jit))) * inC;
    float breathe = 0.6 + 0.4 * (0.5 + 0.5 * sin(uTime * ${(2 * Math.PI / SHATTER.breathe).toFixed(4)}));
    acc = co;
    acc = base + acc * (1.0 - base.a);
    acc.rgb += mix(vec3(0.58, 0.03, 0.01), vec3(1.0, 0.64, 0.1), m) * m * 2.6 * breathe * base.a;
    fl *= 0.7 + 0.3 * vnoise2(q * 5.0 + vec2(uTime * 2.3, -uTime * 1.7));
    acc = fl + acc * (1.0 - fl.a);
    acc.rgb += vec3(1.0, 0.38, 0.1) * exp(-max(r - 1.0, 0.0) * 5.0) * smoothstep(0.92, 1.0, r) * (1.0 - smoothstep(1.12, 1.4, r)) * 0.32 * breathe * (1.0 - acc.a);
  } else if (vKind < 1.5) {
    vec4 t = unpm(texture2D(uMapA, vec2(${SHATTER.shock[0]} + ${SHATTER.shock[2]} * vUv.x, 1.0 - ${SHATTER.shock[1]} - ${SHATTER.shock[3]} * (1.0 - vUv.y)))) * vAlpha;
    acc = vec4(t.rgb * 1.4, t.a * 0.4);
  } else if (vKind < 2.5) {
    acc = unpm(texture2D(uMapA, vUv)) * vAlpha;
  } else if (vKind < 3.5) {
    // The eclipse's sun (behind the moons), and the corona that flares round the larger moon's limb as it covers it.
    float ds = length(q - vSun), dm = r, e = 1.0 - smoothstep(0.0, 1.0, length(vSun));
    float core = 1.0 - smoothstep(${(ECLIPSE.sun - 0.06).toFixed(2)}, ${ECLIPSE.sun.toFixed(2)}, ds);
    float glow = exp(-max(ds - ${ECLIPSE.sun.toFixed(2)}, 0.0) * 2.4) * 0.7;
    float ang = atan(q.y, q.x);
    float corona = exp(-max(dm - 1.0, 0.0) * 4.5) * smoothstep(0.96, 1.01, dm) * e * (0.75 + 0.25 * sin(ang * 7.0 + uTime * 0.2)) * 1.6;
    acc.rgb = vec3(1.0, 0.93, 0.78) * (core * 2.2 + glow) * (1.0 - 0.7 * e) + vec3(0.9, 0.95, 1.0) * corona;
  } else if (vKind < 4.5) {
    acc = unpm(texture2D(uMapA, vUv));
  } else {
    // The aurora: a curtain of teal and green with violet tops, shimmering, scrolling slowly, fading at its ends.
    vec4 t = unpm(texture2D(uMapA, vec2(vUv.x + uTime * 0.008, clamp(vUv.y, 0.004, 0.996))));
    float ends = smoothstep(0.0, 0.1, vLocal.x) * (1.0 - smoothstep(0.9, 1.0, vLocal.x));
    float shimmer = 0.55 + 0.45 * vnoise2(vec2(vLocal.x * 40.0 + uTime * 0.3, uTime * 0.15));
    acc = vec4(t.rgb * 1.25 * ends * shimmer, 0.0);
  }
  float rise = smoothstep(-0.01, 0.02, normalize(vDir).y), k = uReady * uPlanets * rise;
  gl_FragColor = vec4(acc.rgb * k, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.a = acc.a * k;
}`;

// ------------------------------------------------------------------------------------------------ the vivid layer
const blend = { transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

export class VividSky {
  // sky: the HorizonSky (its root, its mesh() helper and its shared uniforms); art: false in node tests (no images).
  constructor(sky, { art = typeof document !== "undefined", phone = coarse() } = {}) {
    this.sky = sky;
    this.art = art;
    this.phone = phone;
    this.textures = {}; // name -> texture, once its sheet is drawn
    this.loading = {};
    this.ready = {};
    const U = sky.uniforms;
    Object.assign(U, {
      uSheet: { value: null }, uMapReady: { value: 0 }, uSheetReady: { value: 0 },
      uStreaks: { value: null }, uMeteorReady: { value: 0 }, uShower: { value: 0 }, uRadiant: { value: 0 },
      uMapA: { value: null }, uFlame: { value: null }, uEventReady: { value: 0 },
      uStage: { value: skyDir(stageOf(phone).u, stageOf(phone).el) }, uStageRight: { value: new THREE.Vector3() }, uStageUp: { value: new THREE.Vector3() },
      uStageR: { value: Math.tan((stageOf(phone).d / 2) * DEG) * RADIUS }, uShock: { value: new THREE.Vector2(-100, 0) },
      uMeteorEl: { value: new THREE.Vector2(...(phone ? PHONE_FIT.meteors : [8.5, 6])) },
      uShipA: { value: new Float32Array(ARMADA.slots * 4) }, uShipB: { value: new Float32Array(ARMADA.slots * 4) }, uFlare: { value: new THREE.Vector4(0, 0, ARMADA.flareWidth, 0) },
      uWar: { value: new Float32Array(WAR_SLOTS * 8) }, uWarK: { value: 0 }, uRingMap: { value: null }, uWarMap: { value: null }, uRingReady: { value: 0 }, uWarReady: { value: 0 },
      uHaze: { value: new THREE.Color("#3a3f66") },
    });
    skyFrame(stageOf(phone).u, U.uStage.value, U.uStageRight.value, U.uStageUp.value);
    const pick = (...names) => Object.fromEntries(names.map((n) => [n, U[n]]));
    this.bodies = sky.mesh("horizon-bodies", buildBodies(phone), new THREE.ShaderMaterial({
      uniforms: pick("uMap", "uSheet", "uTime", "uPlanets", "uMapReady", "uSheetReady"), vertexShader: BODY_VS, fragmentShader: BODY_FS, ...blend,
    }), -1000);
    this.meteors = sky.mesh("horizon-meteors", buildMeteors(), new THREE.ShaderMaterial({
      uniforms: { ...pick("uTime", "uShower", "uRadiant", "uMeteorEl"), uFront: { value: FRONT }, uStreaks: U.uStreaks, uReady: U.uMeteorReady }, vertexShader: METEOR_VS, fragmentShader: METEOR_FS, ...blend,
    }), -998);
    this.event = sky.mesh("horizon-event", new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: { ...pick("uTime", "uStage", "uStageRight", "uStageUp", "uStageR", "uShock", "uMapA", "uFlame", "uPlanets", "uFront", "uShipA", "uShipB", "uFlare", "uHaze"), uReady: U.uEventReady }, vertexShader: EVENT_VS, fragmentShader: EVENT_FS, ...blend,
    }), -999);
    // The orbital ring and the far war: one draw behind the bodies.
    this.orbit = sky.mesh("horizon-orbital", buildOrbit(phone), new THREE.ShaderMaterial({
      uniforms: pick("uTime", "uFront", "uWar", "uWarK", "uRingMap", "uWarMap", "uRingReady", "uWarReady", "uPlanets", "uHaze", "uSun"), vertexShader: ORBIT_VS, fragmentShader: ORBIT_FS, ...blend,
    }), -1001);
    for (const m of [this.bodies, this.meteors, this.event, this.orbit]) m.visible = false;
    this.plan = null;
    this.seed = null;
    this.eventId = null;
    this.meteorKind = null;
    this.shock = { next: Infinity, start: -100, rnd: null };
    this.armada = { main: null, intro: null, pose: armadaOut(), flare: 0 };
    this.war = { plan: null, prev: 0 };
    this.state = { event: null, meteors: "none", why: null, base: false, eventArt: false, gpuBytes: 0, shocks: 0, intro: false, war: 0, ships: 0, flare: 0, flares: 0 };
  }
  // Loads one sheet (once): its images, drawn into its canvas, uploaded on first use.
  load(name) {
    if (!this.art || this.loading[name]) return this.loading[name] || null;
    const spec = SHEETS[name], [w, h] = sheetSize(name, this.phone);
    this.loading[name] = Promise.all(spec.src(this.phone).map(loadImage)).then((images) => {
      const t = sheet(w, h, (g) => spec.draw(g, images, w, h), { repeat: !!spec.repeat });
      this.textures[name] = t;
      this.ready[name] = true;
      this.bind();
      return t;
    }).catch(() => { this.loading[name] = null; });
    return this.loading[name];
  }
  // Every sheet in `names` loaded?
  has(names) { return names.every((n) => this.ready[n]); }
  // The loaded sheets into their uniforms.
  bind() {
    const U = this.sky.uniforms, T = this.textures, E = EVENT_SHEETS[this.eventId] || [];
    U.uNebulaMap.value = T.nebula || null; U.uNebReady.value = T.nebula ? 1 : 0;
    U.uHeroes.value = T.heroes || null; U.uHeroReady.value = T.heroes ? 1 : 0;
    U.uGlowBand.value = T.glow || null; U.uGlowReady.value = T.glow ? 1 : 0;
    U.uSheet.value = T.bodies || null; U.uSheetReady.value = T.bodies ? 1 : 0;
    U.uStreaks.value = T.meteors || null; U.uMeteorReady.value = T.meteors ? 1 : 0;
    U.uRingMap.value = T.ring || null; U.uRingReady.value = T.ring ? 1 : 0;
    U.uWarMap.value = T.war || null; U.uWarReady.value = T.war ? 1 : 0;
    const mapOf = { shattered: T.shattered, eclipse: T.twins, aurora: T.aurora, armada: T.armada };
    U.uMapA.value = mapOf[this.eventId] || null;
    U.uFlame.value = T.strip || null;
    U.uEventReady.value = E.length && this.has(E) ? 1 : 0;
    this.state.base = this.has(BASE_SHEETS);
    this.state.eventArt = !!U.uEventReady.value;
    this.state.gpuBytes = Object.values(T).reduce((n, t) => n + (t.userData.bytes || 0), 0);
  }
  // The event drawn now: its mesh, its sheets (loaded on first use).
  showEvent(id) {
    if (id === this.eventId) return;
    // The last event's own sheets go (a campaign's opening fleet hands over to the match's event): GPU memory back.
    for (const name of EVENT_SHEETS[this.eventId] || []) if (!(EVENT_SHEETS[id] || []).includes(name) && this.textures[name]) {
      this.textures[name].dispose(); delete this.textures[name]; delete this.ready[name]; delete this.loading[name];
    }
    this.eventId = id;
    this.event.geometry.dispose();
    const spec = id && EVENT_MESHES[id];
    this.event.geometry = spec ? spec.build() : new THREE.BufferGeometry();
    for (const name of EVENT_SHEETS[id] || []) this.load(name);
    this.bind();
  }
  // The match's sky plan (sky-events.js skyPlan) and its seed: the meteor slots, the war and the armada on a change.
  setPlan(plan, seed) {
    const kind = plan.meteors === "shower" ? "shower" : "normal";
    if (kind !== this.meteorKind || seed !== this.seed) {
      this.meteorKind = kind;
      this.meteors.geometry.dispose();
      this.meteors.geometry = buildMeteors(seed, kind);
      this.sky.uniforms.uShower.value = kind === "shower" ? 1 : 0;
      this.sky.uniforms.uRadiant.value = FRONT - (skyRandom(seed, "radiant")() * 120 - 60) * DEG;
    }
    if (seed !== this.seed || plan.intro !== this.plan?.intro || plan.fleet !== this.plan?.fleet) {
      this.shock = { next: 6 + skyRandom(seed, "shock-first")() * 8, start: -100, rnd: skyRandom(seed, "shock") };
      this.war.plan = warPlan(seed);
      this.armada.main = armadaPlan(seed);
      this.armada.intro = plan.intro ? armadaPlan(`${seed}|fleet`, { reinforcements: true, fleet: plan.fleet }) : null;
    }
    this.seed = seed;
    this.plan = plan;
    Object.assign(this.state, { meteors: plan.meteors, why: plan.why, picked: plan.picked });
  }
  // Each frame while the Hero sky is on. vivid: this sky shows; show: the sky above the haze can be seen (top > 0);
  // lively: motion allowed; level: the governor's level; time: the sky's clock. Returns a sky flash to start (0-1):
  // a landing flare's bloom or a big explosion in orbit.
  update({ vivid, show, lively, level = "full", time }) {
    if (vivid && this.art) for (const name of BASE_SHEETS) this.load(name);
    const U = this.sky.uniforms, plan = this.plan, rescue = level === "rescue";
    // The event now: a campaign mission opens with its fleet landing (the first ARMADA.intro seconds), then its own.
    const intro = vivid && !!this.armada.intro && time < ARMADA.intro;
    this.showEvent(vivid ? (intro ? "armada" : plan?.event ?? null) : this.eventId);
    this.state.intro = intro;
    this.state.event = vivid ? this.eventId : null;
    this.bodies.visible = vivid && show && !!this.sky.atlasReady;
    this.meteors.visible = vivid && show && lively && !rescue && !!U.uMeteorReady.value && plan?.meteors !== "none" && this.meteors.geometry.instanceCount > 0;
    this.event.visible = vivid && show && !rescue && !!this.eventId && !!U.uEventReady.value;
    this.orbit.visible = vivid && show && !!U.uRingReady.value;
    let flash = 0;
    // The shockwave: every 20-30 s (seeded) while the shattered planet shows and motion is allowed.
    const s = this.shock;
    if (vivid && this.eventId === "shattered" && lively) {
      if (time < s.start) { s.start = -100; s.next = time + 6; } // the clock went back (a new sky)
      while (time >= s.next) { s.start = s.next; s.next += SHATTER.shockEvery[0] + (s.rnd ? s.rnd() : 0.5) * (SHATTER.shockEvery[1] - SHATTER.shockEvery[0]); this.state.shocks++; }
    }
    U.uShock.value.set(s.start, lively ? 1 : 0);
    // The armada: poses at the sky's time (a still sky holds it mid-crossing with one ship turning to land).
    if (this.event.visible && this.eventId === "armada") flash = Math.max(flash, this.poseArmada(intro ? this.armada.intro : this.armada.main, lively ? time + (intro ? 8 : 20) : ARMADA.still));
    // The far war: faint in every Vivid sky, strong in the Armada and the Burning world; a phone drops it at the
    // governor's first step, every screen at the rescue step; a still sky keeps its ships and wreck, without fire.
    const drop = rescue || (this.phone && level !== "full");
    const warK = this.orbit.visible && !drop && this.war.plan ? (intro ? 1 : plan?.war ?? 0) : 0;
    U.uWarK.value = warK;
    if (warK > 0) {
      const t = lively ? time + 40 : 40, bloom = warPose(this.war.plan, t, U.uWar.value, lively ? this.war.prev : t);
      this.war.prev = t;
      if (!lively) for (let i = 0; i < WAR_SLOTS; i++) if (U.uWar.value[i * 8 + 6] > 0.5 && U.uWar.value[i * 8 + 6] < 3.5) U.uWar.value[i * 8 + 3] = 0;
      flash = Math.max(flash, bloom * warK);
    }
    this.state.war = warK;
    return lively ? flash : 0;
  }
  poseArmada(plan, t) {
    const U = this.sky.uniforms, pose = armadaPose(plan, t, this.armada.pose), A = U.uShipA.value, B = U.uShipB.value;
    let ships = 0;
    for (let i = 0; i < pose.ships.length; i++) {
      const o = pose.ships[i], j = i * 4;
      A[j] = o.u; A[j + 1] = o.el; A[j + 2] = o.len; A[j + 3] = o.alpha;
      B[j] = o.descend; B[j + 1] = o.index; B[j + 2] = 0; B[j + 3] = 0;
      if (o.alpha > 0.01) ships++;
    }
    U.uFlare.value.set(pose.flare.u, pose.flare.k, ARMADA.flareWidth, 0);
    // A landing flare's first bloom flashes the low sky.
    const rising = pose.flare.k > 0.05 && this.armada.flare <= 0.05;
    this.armada.flare = pose.flare.k;
    Object.assign(this.state, { ships, flare: pose.flare.k });
    if (rising) this.state.flares++;
    return rising ? 0.85 : 0;
  }
  report() {
    return { bodies: this.bodies.visible, meteors: this.meteors.visible, event: this.event.visible, orbit: this.orbit.visible, eventId: this.state.event, meteorKind: this.state.meteors, why: this.state.why, picked: this.state.picked, base: this.state.base, eventArt: this.state.eventArt, gpuBytes: this.state.gpuBytes, shocks: this.state.shocks, intro: this.state.intro, war: this.state.war, ships: this.state.ships, flare: this.state.flare, flares: this.state.flares };
  }
  get draws() { return [this.bodies, this.meteors, this.event, this.orbit].filter((m) => m.visible).length; }
  dispose() {
    for (const m of [this.bodies, this.meteors, this.event, this.orbit]) { m.geometry.dispose(); m.material.dispose(); }
    for (const t of Object.values(this.textures)) t.dispose();
  }
}
