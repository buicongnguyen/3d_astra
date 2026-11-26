import { SURFACES } from "./terrain.js";
import { themeFor } from "./visual-style.js";
import { outward } from "./plateau-relief.js";
import { landOf } from "./lands.js";
import { SURFACE_CODE } from "./ground-detail.js";
import { planPaths } from "./worn-paths.js";

// Paints a map's ground texture once: surface colours from the theme, broad patches of the
// theme's accent colour so no map is one flat tone, then small hand-drawn detail (grass dabs,
// sand ripples, cracked earth, a foam line along river banks). All cosmetic: the surface a
// unit stands on still comes from Terrain.at().

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export const surfaceColors = (id) => ({ ...SURFACES, ...themeFor(id) });

// Value noise on an integer lattice, smooth and seedless (same on every device).
const lattice = (x, z) => {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SOFT = new Set(["grass", "dirt", "sand", "stone", "mud"]);

export function paintGround(ctx, terrain, size, random) {
  const colors = surfaceColors(terrain.id), table = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, rgb(v)]));
  // A ramp counts as road for the rules (Terrain.at), but is painted as the ground around it:
  // paintPlateaus() draws the road itself as a strip, so the ramp no longer reads as a blob.
  const bare = terrain.plateaus?.length ? Object.assign(Object.create(terrain), { plateaus: [] }) : terrain;
  const surface = (x, z) => (bare !== terrain && terrain.onRamp(x, z) ? bare.at(x, z) : terrain.at(x, z));
  // One colour cell per ~1.2 m: borders stay crisp after the upscale (was 2 m, which smeared).
  const k = size / 1024; // detail below is drawn in 1024-texture pixels, scaled to the texture
  const cells = Math.min(512, size / 2), small = document.createElement("canvas");
  small.width = small.height = cells;
  const sctx = small.getContext("2d"), image = sctx.createImageData(cells, cells), data = image.data, accent = table.accent;
  // The surface of every cell as painted (warped borders, ramps as bare ground): the ground detail's splat
  // (ground-detail.js) is built from it, so the tiled layers follow the painted borders exactly.
  const grid = new Uint8Array(cells * cells);
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) {
      const wx = ((x + 0.5) / cells) * terrain.size - terrain.half, wz = ((y + 0.5) / cells) * terrain.size - terrain.half;
      // Borders between soft surfaces wander by up to a unit, so no patch has a ruler-straight
      // edge; water, crossings and banks keep their true outline.
      let type = surface(wx, wz);
      if (SOFT.has(type) && type !== "mud") {
        const warped = surface(wx +(noise(wx * 0.3 + 5, wz * 0.3) - 0.5) * 2.4, wz + (noise(wx * 0.3 - 9, wz * 0.3 + 4) - 0.5) * 2.4);
        if (SOFT.has(warped) && warped !== "mud") type = warped;
      }
      grid[y * cells + x] = SURFACE_CODE[type] ?? 0;
      let [r, g, b] = table[type];
      if (SOFT.has(type)) {
        const broad = noise(wx * 0.05 + 11, wz * 0.05 - 7) * 0.65 + noise(wx * 0.13 - 3, wz * 0.13 + 19) * 0.35;
        const patch = smooth(0.5, 0.72, broad) * (type === "mud" ? 0.25 : 0.6);
        r += (accent[0] - r) * patch; g += (accent[1] - g) * patch; b += (accent[2] - b) * patch;
        // The ash plain has one surface: break it up with paler drifts.
        if (terrain.id === "classic") {
          const drift = smooth(0.55, 0.75, noise(wx * 0.07 - 31, wz * 0.07 + 5)) * 0.55;
          r += (table.sand[0] - r) * drift; g += (table.sand[1] - g) * drift; b += (table.sand[2] - b) * drift;
        }
        const mottle = 0.9 + noise(wx * 0.45 + 50, wz * 0.45 + 90) * 0.2;
        r *= mottle; g *= mottle; b *= mottle;
      }
      const i = (y * cells + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  sctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, size, size);
  // Soften the borders a little more where the browser supports canvas filters.
  const soft = document.createElement("canvas");
  soft.width = soft.height = size;
  soft.getContext("2d").drawImage(ctx.canvas, 0, 0);
  ctx.filter = `blur(${1.5 * k}px)`;
  ctx.drawImage(soft, 0, 0);
  ctx.filter = "none";
  const scale = size / terrain.size, world = (p) => p / scale - terrain.half;
  const tint = ([r, g, b], a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const light = rgb(themeFor(terrain.id).sun), dark = rgb(themeFor(terrain.id).cliffDeep);
  // Fine grain everywhere. V1 terrain: thinner (the detail layers carry the grain in battle; this stays for the title
  // screen's preview, the minimap and a ground whose layers are off).
  for (let i = 0; i < 9000 * k * k * 0.55; i++) {
    const x = random() * size, y = random() * size, radius = (1 + random() * 5) * k;
    ctx.fillStyle = random() > 0.5 ? tint(light, random() * 0.07) : tint(dark, random() * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Surface detail, drawn where that surface is.
  ctx.lineCap = "round";
  const leaf = rgb(themeFor(terrain.id).leafAlt), shade = rgb(themeFor(terrain.id).leaf);
  // W9 lands (src/lands.js): snow is painted with wind drifts and sparkle, volcanic ash with grey flecks.
  const paint = landOf(terrain)?.paint, foamTint = rgb(themeFor(terrain.id).foam), dustTint = rgb(themeFor(terrain.id).dust);
  // V1 terrain: a third as many strokes as before, so painted blades, ripples and drifts do not double the detail layers'
  // grain or cross its direction (texture review 2026-11-26).
  for (let i = 0; i < 11000 * k * k * 0.34; i++) {
    const x = random() * size, y = random() * size, pick = random(), turn = random(), type = surface(world(x), world(y));
    if (paint === "snow" && (type === "grass" || type === "dirt")) {
      // Wind-carved drifts: soft pale crescents all leaning one way, and a few bright glints.
      if (i % 3 === 0) {
        ctx.strokeStyle = pick > 0.4 ? tint(foamTint, 0.13 + pick * 0.13) : tint(dark, 0.05);
        ctx.lineWidth = (2 + pick * 2.5) * k;
        const length = (10 + pick * 22) * k, angle = -0.35 + (turn - 0.5) * 0.25;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5 - 3 * k, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
      } else if (i % 7 === 1) {
        ctx.fillStyle = tint(foamTint, 0.5 + pick * 0.4);
        ctx.fillRect(x, y, 1.2 * k, 1.2 * k);
      }
    } else if (paint === "embers" && type === "grass") {
      // Ash: grey and warm flecks instead of grass blades.
      ctx.fillStyle = pick > 0.5 ? tint(dustTint, 0.18 + pick * 0.12) : tint(dark, 0.14);
      ctx.beginPath(); ctx.ellipse(x, y, (1 + pick * 2.4) * k, (0.7 + turn) * k, turn * 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === "grass") {
      ctx.strokeStyle = pick > 0.45 ? tint(leaf, 0.2 + pick * 0.16) : tint(shade.map((v) => v * 0.6), 0.22);
      ctx.lineWidth = 1.6 * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (turn - 0.5) * 5 * k, y - (4 + pick * 5) * k);
      ctx.stroke();
    } else if (type === "sand" && i % 4 === 0) {
      // Wind ripples, all leaning the same way.
      ctx.strokeStyle = pick > 0.5 ? tint(light, 0.1) : tint(dark, 0.08);
      ctx.lineWidth = 1.5 * k;
      const length = (14 + pick * 26) * k, angle = 0.45 + (turn - 0.5) * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(angle) * length * 0.5 + 3 * k, y + Math.sin(angle) * length * 0.5 - 3 * k, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    } else if ((type === "dirt" || type === "stone") && i % 3 === 0) {
      // Pebbles and clods: a dark contact shadow with a lit top, so bare ground reads as
      // gravelly earth instead of smeared paint (the old zigzag cracks blurred into streaks).
      const r = (1.1 + pick * 2.2) * k, ox = (turn - 0.5) * 0.8 * k;
      ctx.fillStyle = tint(dark, 0.26);
      ctx.beginPath(); ctx.ellipse(x + 0.6 * k, y + 0.7 * k, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tint(light, 0.1 + turn * 0.12);
      ctx.beginPath(); ctx.ellipse(x + ox, y - 0.4 * k, r * 0.85, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  paintPaths(ctx, terrain, size);
  paintEdgeRim(ctx, terrain, size);
  if (paint === "embers") paintEmberCracks(ctx, terrain, size, random, surface);
  paintPlateaus(ctx, terrain, size);
  if (terrain.river) {
    // Wet sand, then a broken foam line where the water meets each bank.
    // Each river band in turn (maps.json "rivers"; the old river maps have one, at z = 0).
    const foam = rgb(themeFor(terrain.id).foam), shallow = rgb(themeFor(terrain.id).shallow);
    for (const river of terrain.rivers || [{ z: 0 }])
    for (const side of [-1, 1]) {
      const mid = size / 2 + river.z * scale, edge = mid + side * 3 * scale;
      const wet = ctx.createLinearGradient(0, edge, 0, edge + side * 1.6 * scale);
      wet.addColorStop(0, tint(shallow, 0.5));
      wet.addColorStop(1, tint(shallow, 0));
      ctx.fillStyle = wet;
      ctx.fillRect(0, Math.min(edge, edge + side * 1.6 * scale), size, 1.6 * scale);
      ctx.strokeStyle = tint(foam, 0.8);
      ctx.lineWidth = Math.max(1.5, scale * 0.16);
      for (let x = 0; x < size; x += 18 * k) {
        if (random() < 0.25) continue;
        const y = edge + side * (1 + random() * 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 7 * k, y + side * (1 + random() * 3), x + (12 + random() * 5) * k, y);
        ctx.stroke();
      }
    }
  }
  // Lakes (campaign maps): the same wet sand and broken foam line round the shore and the island's foot.
  for (const lake of terrain.lakes || []) {
    const foam = rgb(themeFor(terrain.id).foam), shallow = rgb(themeFor(terrain.id).shallow);
    const cx = size / 2 + lake.x * scale, cz = size / 2 + lake.z * scale;
    for (const [radius, out] of [[lake.r, 1], ...(lake.inner ? [[lake.inner, -1]] : [])]) {
      const r0 = radius * scale, r1 = (radius + out * 1.6) * scale;
      const wet = ctx.createRadialGradient(cx, cz, Math.min(r0, r1), cx, cz, Math.max(r0, r1));
      wet.addColorStop(out > 0 ? 0 : 1, tint(shallow, 0.5));
      wet.addColorStop(out > 0 ? 1 : 0, tint(shallow, 0));
      ctx.fillStyle = wet;
      ctx.beginPath(); ctx.arc(cx, cz, Math.max(r0, r1), 0, Math.PI * 2); ctx.arc(cx, cz, Math.min(r0, r1), 0, Math.PI * 2, true); ctx.fill();
      ctx.strokeStyle = tint(foam, 0.8);
      ctx.lineWidth = Math.max(1.5, scale * 0.16);
      const steps = Math.round((2 * Math.PI * radius * scale) / (18 * k));
      for (let i = 0; i < steps; i++) {
        if (random() < 0.25) continue;
        const a0 = (i / steps) * Math.PI * 2, a1 = a0 + (12 * k) / (radius * scale), rr = (radius + out * (0.3 + random() * 0.6)) * scale;
        ctx.beginPath(); ctx.arc(cx, cz, rr, a0, a1); ctx.stroke();
      }
    }
  }
  return { grid, cells };
}

// The playable edge (V1 terrain): with a land below the edge instead of a dark void, the border needs its own line.
// A soft dark band 1.4 m wide inside the edge and a thin pale lip on it, like a plateau's rim; water runs under it.
export function paintEdgeRim(ctx, terrain, size) {
  const theme = themeFor(terrain.id), k = size / terrain.size, band = 1.4 * k, lipW = 0.22 * k;
  const deep = rgb(theme.cliffDeep), lip = rgb(theme.dust).map((v, i) => v + (rgb(theme.sun)[i] - v) * 0.3);
  ctx.save();
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [[0, 0, size, band, 0, 0, 0, band], [0, size - band, size, band, 0, size, 0, size - band],
    [0, 0, band, size, 0, 0, band, 0], [size - band, 0, band, size, size, 0, size - band, 0]]) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `rgba(${deep[0]},${deep[1]},${deep[2]},0.34)`);
    g.addColorStop(1, `rgba(${deep[0]},${deep[1]},${deep[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = `rgba(${lip[0] | 0},${lip[1] | 0},${lip[2] | 0},0.7)`;
  ctx.lineWidth = lipW;
  ctx.strokeRect(lipW / 2, lipW / 2, size - lipW, size - lipW);
  ctx.restore();
}

// Worn paths (V1 terrain, worn-paths.js): a soft band of trodden earth with two darker wheel ruts along each track,
// on open ground only (roads, water, crossings and ramps keep their own paint). Drawn into a 512 px mask first, where
// overlapping tracks take the stronger wear (no darker blots where they cross), then laid over the ground once.
const PATH_LAND = new Set(["grass", "dirt", "sand", "stone", "mud"]);
export function paintPaths(ctx, terrain, size, paths = planPaths(terrain)) {
  if (!paths.length || typeof document === "undefined") return;
  const n = 512, s = n / terrain.size, at = (v) => (v + terrain.half) * s;
  const mask = document.createElement("canvas");
  mask.width = mask.height = n;
  const m = mask.getContext("2d");
  m.fillStyle = "#000"; m.fillRect(0, 0, n, n);
  m.globalCompositeOperation = "lighten"; m.lineCap = "round"; m.lineJoin = "round";
  const open = (x, z) => PATH_LAND.has(terrain.at(x, z)) && !terrain.onRamp?.(x, z, 0.6);
  for (const p of paths)
    for (let k = 1; k < p.points.length; k++) {
      const [ax, az] = p.points[k - 1], [bx, bz] = p.points[k];
      if (!open((ax + bx) / 2, (az + bz) / 2)) continue;
      const w = Math.round(((p.wear[k - 1] + p.wear[k]) / 2) * 255);
      if (w <= 2) continue;
      const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l;
      m.strokeStyle = `rgb(${w},0,0)`; m.lineWidth = p.width * s;
      m.beginPath(); m.moveTo(at(ax), at(az)); m.lineTo(at(bx), at(bz)); m.stroke();
      m.strokeStyle = `rgb(0,${w},0)`; m.lineWidth = Math.max(1, 0.32 * s);
      for (const side of [-1, 1]) {
        const o = side * p.width * 0.21;
        m.beginPath(); m.moveTo(at(ax + nx * o), at(az + nz * o)); m.lineTo(at(bx + nx * o), at(bz + nz * o)); m.stroke();
      }
    }
  const soft = document.createElement("canvas");
  soft.width = soft.height = n;
  const sc = soft.getContext("2d", { willReadFrequently: true });
  sc.filter = `blur(${Math.max(1, 0.3 * s).toFixed(1)}px)`;
  sc.drawImage(mask, 0, 0);
  sc.filter = "none";
  const theme = themeFor(terrain.id), land = landOf(terrain);
  const mixed = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Trodden earth in the land's own colours (packed blue-grey snow on Frostmere), ruts a shade darker.
  const worn = (land?.paint === "snow" ? mixed(rgb(theme.dirt), rgb(theme.stone), 0.35) : mixed(rgb(theme.road), rgb(theme.dirt), 0.55)).map((v) => v * 0.9);
  const rut = worn.map((v) => v * 0.68);
  const image = sc.getImageData(0, 0, n, n), d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = Math.min(1, (d[i] / 255) * 0.85), r = (d[i + 1] / 255) * 0.42, alpha = 1 - (1 - a) * (1 - r);
    if (alpha <= 0.004) { d[i + 3] = 0; continue; }
    const t = r / (a + r);
    d[i] = worn[0] + (rut[0] - worn[0]) * t; d[i + 1] = worn[1] + (rut[1] - worn[1]) * t; d[i + 2] = worn[2] + (rut[2] - worn[2]) * t;
    d[i + 3] = alpha * 255;
  }
  sc.putImageData(image, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(soft, 0, 0, size, size);
  ctx.restore();
}

// Volcano (W9): glowing cracks in the basalt. Each crack wanders a few metres in short zigzag steps, drawn twice:
// a wide, faint red-orange glow and a thin hot core. Only on bare basalt and rock, never into water, lava or roads.
export function paintEmberCracks(ctx, terrain, size, random, surface = (x, z) => terrain.at(x, z)) {
  const k = size / 1024, scale = size / terrain.size, world = (p) => p / scale - terrain.half;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 120 * k * k; i++) {
    let x = random() * size, y = random() * size;
    if (!["dirt", "stone"].includes(surface(world(x), world(y)))) continue;
    const points = [[x, y]], heading = random() * Math.PI * 2, steps = 3 + Math.floor(random() * 5);
    for (let n = 0; n < steps; n++) {
      const a = heading + (random() - 0.5) * 1.6, step = (5 + random() * 9) * k;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      if (!["dirt", "stone"].includes(surface(world(x), world(y)))) break;
      points.push([x, y]);
    }
    if (points.length < 2) continue;
    const width = (0.8 + random() * 1.1) * k;
    for (const [style, w] of [["rgba(255, 92, 30, 0.22)", width * 4.2], ["rgba(255, 150, 50, 0.65)", width * 1.6], ["rgba(255, 228, 140, 0.9)", width * 0.6]]) {
      ctx.strokeStyle = style; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
      for (const [px, py] of points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The kill zone at a ramp (16.2): attackers must climb here under the guns on top, so the lower
// slope and its foot carry faint red-orange diagonal stripes across the whole ramp, faded at both
// ends. Drawn in the ramp's frame (u across, v downhill, metres), painted once: no extra draw.
export const KILL_ZONE = { from: 0.2, to: 4.4, colour: [214, 72, 40], alpha: 0.48, pitch: 1.3, width: 0.5 };
function paintKillZone(ctx, half) {
  const { from, to, colour: [r, g, b], alpha, pitch, width } = KILL_ZONE, w = half - 0.3, depth = to - from;
  ctx.save();
  ctx.beginPath(); ctx.rect(-w, from, w * 2, depth); ctx.clip();
  const fade = ctx.createLinearGradient(0, from, 0, to);
  for (const [at, a] of [[0, 0], [0.28, alpha], [0.72, alpha], [1, 0]]) fade.addColorStop(at, `rgba(${r},${g},${b},${a})`);
  ctx.strokeStyle = fade; ctx.lineWidth = width; ctx.lineCap = "butt";
  ctx.beginPath();
  for (let u = -w - depth; u < w; u += pitch) { ctx.moveTo(u, from); ctx.lineTo(u + depth, to); }
  ctx.stroke();
  ctx.restore();
}

// Plateaus (Stage 3) in the ground texture, under the rock relief of plateau-relief.js: a
// lighter top, a bright lip, a white ring the rock face takes its vertex colours over, a soft
// shadow at the cliff foot (long on the side away from the sun) and each ramp as a road strip
// with edge lines and chevrons pointing uphill. All painted once, so no extra draws.
export function paintPlateaus(ctx, terrain, size) {
  if (!terrain.plateaus?.length) return;
  const theme = themeFor(terrain.id), k = size / terrain.size, px = (v) => (v + terrain.half) * k;
  const tint = ([r, g, b], a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const mixed = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sun = rgb(theme.sun), dust = rgb(theme.dust), deep = rgb(theme.cliffDeep), lip = mixed(dust, sun, 0.3);
  // Adds one plateau outline, grown outward by `grow` metres (negative: inset), as a subpath.
  const trace = (p, grow) => {
    if (p.shape === "disc") {
      const r = Math.max(0.05, p.r + grow) * k;
      ctx.moveTo(px(p.x) + r, px(p.z));
      ctx.arc(px(p.x), px(p.z), r, 0, Math.PI * 2);
      return;
    }
    const w = p.w + grow * 2, d = p.d + grow * 2;
    // A rounded box grown by `grow` keeps rounded corners of radius corner + grow (square once inset past them).
    if (p.shape === "rbox") {
      const radius = Math.max(0, p.corner + grow) * k;
      if (radius > 0 && ctx.roundRect) ctx.roundRect(px(p.x - w / 2), px(p.z - d / 2), w * k, d * k, radius);
      else ctx.rect(px(p.x - w / 2), px(p.z - d / 2), w * k, d * k);
      return;
    }
    if (grow > 0 && ctx.roundRect) ctx.roundRect(px(p.x - w / 2), px(p.z - d / 2), w * k, d * k, grow * k);
    else ctx.rect(px(p.x - w / 2), px(p.z - d / 2), w * k, d * k);
  };
  const ring = (p, inner, outer, style) => { ctx.beginPath(); trace(p, outer); trace(p, inner); ctx.fillStyle = style; ctx.fill("evenodd"); };
  const SHADOW = [0.78, -0.62]; // away from the sun (view.js SUN_OFFSET: from -x, +z)
  for (const p of terrain.plateaus) {
    ctx.beginPath(); trace(p, -1.2); ctx.fillStyle = tint(sun, 0.16); ctx.fill();
  }
  // Rings and shadows stop short of the ramps, which keep their own ground.
  const clipRamps = (grow) => {
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    for (const p of terrain.plateaus) for (const r of p.ramps) { const radius = (r.half + grow) * k; ctx.moveTo(px(r.x) + radius, px(r.z)); ctx.arc(px(r.x), px(r.z), radius, 0, Math.PI * 2); }
    ctx.clip("evenodd");
  };
  ctx.save();
  clipRamps(-0.25);
  for (const p of terrain.plateaus) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, size, size); trace(p, 0.79); ctx.clip("evenodd");
    ctx.filter = `blur(${Math.max(1, 0.7 * k)}px)`;
    ctx.save();
    ctx.translate(SHADOW[0] * 1.3 * k, SHADOW[1] * 1.3 * k);
    ctx.beginPath(); trace(p, 0.9); ctx.fillStyle = tint(deep, 0.45); ctx.fill();
    ctx.restore();
    ctx.beginPath(); trace(p, 1.15); ctx.lineWidth = 1.3 * k; ctx.strokeStyle = tint(deep, 0.24); ctx.stroke();
    // V1 terrain: a soft occlusion ring all round the foot (the cliff shades the ground beside it on every side).
    ctx.beginPath(); trace(p, 1.7); ctx.lineWidth = 2.2 * k; ctx.strokeStyle = tint(deep, 0.14); ctx.stroke();
    ctx.filter = "none";
    ctx.restore();
    ring(p, -1.2, -0.6, tint(lip, 0.4));
    ring(p, -0.6, 0.15, tint(lip, 1));
  }
  // The white ring the rock samples stays well clear of the ramps, where the rock ends.
  clipRamps(1.2);
  for (const p of terrain.plateaus) ring(p, 0.15, 0.8, "#ffffff");
  ctx.restore();
  // Ramps: a road strip running up the slope (v is downhill, u across), edges and chevrons.
  const line = "rgba(255, 241, 207, 0.92)";
  for (const p of terrain.plateaus)
    for (const r of p.ramps) {
      const n = outward(terrain, p, r.x, r.z), w = r.half * 0.64;
      ctx.setTransform(-n.z * k, n.x * k, n.x * k, n.z * k, px(r.x), px(r.z));
      // The strip covers the slope (v from -3 to 3) and a short apron at each end.
      // Faded ends, so the strip joins the ground above and below instead of lying on it.
      const road = rgb(theme.road), fill = ctx.createLinearGradient(0, -3.6, 0, 3.9);
      for (const [at, a] of [[0, 0], [0.12, 1], [0.86, 1], [1, 0]]) fill.addColorStop(at, tint(road, a));
      ctx.fillStyle = fill;
      ctx.fillRect(-w, -3.6, w * 2, 7.5);
      paintKillZone(ctx, r.half);
      ctx.lineWidth = 0.3; ctx.strokeStyle = tint(deep, 0.3);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * w, -3.2); ctx.lineTo(side * w, 3.5); ctx.stroke(); }
      ctx.strokeStyle = line; ctx.lineWidth = 0.26; ctx.lineCap = "round";
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * (w - 0.38), -3.1); ctx.lineTo(side * (w - 0.38), 3.4); ctx.stroke(); }
      ctx.lineWidth = 0.42; ctx.lineJoin = "round";
      for (const v of [-1.9, 0, 1.9]) { ctx.beginPath(); ctx.moveTo(-1.2, v + 0.85); ctx.lineTo(0, v - 0.15); ctx.lineTo(1.2, v + 0.85); ctx.stroke(); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}
