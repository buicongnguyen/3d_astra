import { SURFACES } from "./terrain.js";
import { themeFor } from "./visual-style.js";

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
  const cells = size / 4, small = document.createElement("canvas");
  small.width = small.height = cells;
  const sctx = small.getContext("2d"), image = sctx.createImageData(cells, cells), data = image.data, accent = table.accent;
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) {
      const wx = ((x + 0.5) / cells) * terrain.size - terrain.half, wz = ((y + 0.5) / cells) * terrain.size - terrain.half;
      // Borders between soft surfaces wander by up to a unit, so no patch has a ruler-straight
      // edge; water, crossings and banks keep their true outline.
      let type = terrain.at(wx, wz);
      if (SOFT.has(type) && type !== "mud") {
        const warped = terrain.at(wx + (noise(wx * 0.3 + 5, wz * 0.3) - 0.5) * 2.4, wz + (noise(wx * 0.3 - 9, wz * 0.3 + 4) - 0.5) * 2.4);
        if (SOFT.has(warped) && warped !== "mud") type = warped;
      }
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
  ctx.filter = "blur(3px)";
  ctx.drawImage(soft, 0, 0);
  ctx.filter = "none";
  const scale = size / terrain.size, world = (p) => p / scale - terrain.half;
  const tint = ([r, g, b], a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const light = rgb(themeFor(terrain.id).sun), dark = rgb(themeFor(terrain.id).cliffDeep);
  // Fine grain everywhere.
  for (let i = 0; i < 9000; i++) {
    const x = random() * size, y = random() * size, radius = 1 + random() * 5;
    ctx.fillStyle = random() > 0.5 ? tint(light, random() * 0.07) : tint(dark, random() * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Surface detail, drawn where that surface is.
  ctx.lineCap = "round";
  const leaf = rgb(themeFor(terrain.id).leafAlt), shade = rgb(themeFor(terrain.id).leaf);
  for (let i = 0; i < 11000; i++) {
    const x = random() * size, y = random() * size, pick = random(), turn = random(), type = terrain.at(world(x), world(y));
    if (type === "grass") {
      ctx.strokeStyle = pick > 0.45 ? tint(leaf, 0.2 + pick * 0.16) : tint(shade.map((v) => v * 0.6), 0.22);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (turn - 0.5) * 5, y - 4 - pick * 5);
      ctx.stroke();
    } else if (type === "sand" && i % 4 === 0) {
      // Wind ripples, all leaning the same way.
      ctx.strokeStyle = pick > 0.5 ? tint(light, 0.1) : tint(dark, 0.08);
      ctx.lineWidth = 1.5;
      const length = 14 + pick * 26, angle = 0.45 + (turn - 0.5) * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(angle) * length * 0.5 + 3, y + Math.sin(angle) * length * 0.5 - 3, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    } else if ((type === "dirt" || type === "stone") && i % 5 === 0) {
      ctx.strokeStyle = tint(dark, 0.14);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (turn - 0.5) * 12, y + (pick - 0.5) * 12);
      ctx.lineTo(x + (pick - 0.5) * 16, y + (turn - 0.5) * 16);
      ctx.stroke();
    }
  }
  if (terrain.river) {
    // Wet sand, then a broken foam line where the water meets each bank.
    const foam = rgb(themeFor(terrain.id).foam), shallow = rgb(themeFor(terrain.id).shallow), mid = size / 2;
    for (const side of [-1, 1]) {
      const edge = mid + side * 3 * scale;
      const wet = ctx.createLinearGradient(0, edge, 0, edge + side * 1.6 * scale);
      wet.addColorStop(0, tint(shallow, 0.5));
      wet.addColorStop(1, tint(shallow, 0));
      ctx.fillStyle = wet;
      ctx.fillRect(0, Math.min(edge, edge + side * 1.6 * scale), size, 1.6 * scale);
      ctx.strokeStyle = tint(foam, 0.8);
      ctx.lineWidth = Math.max(1.5, scale * 0.16);
      for (let x = 0; x < size; x += 18) {
        if (random() < 0.25) continue;
        const y = edge + side * (1 + random() * 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 7, y + side * (1 + random() * 3), x + 12 + random() * 5, y);
        ctx.stroke();
      }
    }
  }
}
