// The procedural cells of the signature shots (V4, 2026-11-26), painted once into the effects' procedural atlas
// (src/fx.js atlas) after the older cells. A painter takes (x, y, d) with x, y in -1..1 (y up) and d = hypot(x, y) and returns
// the alpha; `shade` (default 1) is the cell's brightness: the body shapes are white inside a dark rim, so one normal-blended
// particle in a faction colour draws a solid coloured body with a dark outline (it reads on snow, sand and lava), while the same
// cell drawn additively is a glow whose rim adds almost nothing. `clip: false` lets a shape reach the corners of its cell (the
// stretched bolts). Frames of one animation are consecutive cells (src/fx.js Layer cycles a particle's `frames` at `fps`).
// `fill` is the share of the cell's width the visible shape spans (its radius in cell units; for a STRETCH cell its half
// thickness): signature-common.js sizes shapes by what is seen.
//   orb        a ball: a white core inside a dark rim, a faint shadow round it      dart       a bolt for STRETCH sprites: a round
//   bolt..3    four jagged lightning bolts along the cell's v axis (STRETCH)                    bright head, a thinning tail, a dark rim
//   crackle..1 two crackles: jagged filaments out of a bright centre              crescent   a crescent blade with a dark rim
//   sundisc    a disc with eight rays (it spins)                                  shard      a long crystal diamond with a dark edge
//   starburst  a radiant flare of twelve rays, long and short
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const gauss = (v, w) => Math.exp(-((v / w) ** 2));
const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const RIM = 0.12; // the rim's brightness: dark enough to outline a pale colour on snow

// A jagged polyline from (x0, y0) to (x1, y1) in `n` steps, displaced sideways up to `amp` (smaller near the ends).
function jagged(rng, x0, y0, x1, y1, n, amp) {
  const pts = [[x0, y0]], len = Math.hypot(x1 - x0, y1 - y0) || 1, sx = -(y1 - y0) / len, sy = (x1 - x0) / len;
  for (let i = 1; i < n; i++) {
    const k = i / n, o = (rng() - 0.5) * 2 * amp * (0.35 + 0.65 * Math.sin(Math.PI * k));
    pts.push([x0 + (x1 - x0) * k + sx * o, y0 + (y1 - y0) * k + sy * o]);
  }
  pts.push([x1, y1]);
  return pts;
}
// Glow of a set of polylines: a sharp core and a wide soft sheath (`core`, `sheath` widths in cell units). The segments
// sit in one typed array (ax, ay, bx, by, weight and a padded bounding box) and the nearest one decides the alpha;
// `.distance(x, y)` is the distance to the nearest line (the dark rim of the line's shade).
function strokes(lines, core, sheath, weight = 1) {
  const list = [];
  for (const [pts, w] of lines) for (let i = 0; i + 1 < pts.length; i++) list.push([...pts[i], ...pts[i + 1], w]);
  const S = new Float64Array(list.length * 9), pad = sheath * 2.4, ic = 1 / (core * core), is = 1 / (sheath * sheath);
  list.forEach(([ax, ay, bx, by, w], i) => S.set([ax, ay, bx, by, w, Math.min(ax, bx) - pad, Math.max(ax, bx) + pad, Math.min(ay, by) - pad, Math.max(ay, by) + pad], i * 9));
  const paint = (x, y) => {
    let best = 0;
    for (let o = 0; o < S.length; o += 9) {
      if (x < S[o + 5] || x > S[o + 6] || y < S[o + 7] || y > S[o + 8]) continue;
      const ax = S[o], ay = S[o + 1], dx = S[o + 2] - ax, dy = S[o + 3] - ay, l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)), ex = x - ax - dx * t, ey = y - ay - dy * t, q = ex * ex + ey * ey;
      const a = S[o + 4] * (Math.exp(-q * ic) + 0.42 * Math.exp(-q * is));
      if (a > best) best = a;
    }
    return Math.min(1, best * weight);
  };
  paint.distance = (x, y) => {
    let best = Infinity;
    for (let o = 0; o < S.length; o += 9) {
      const ax = S[o], ay = S[o + 1], dx = S[o + 2] - ax, dy = S[o + 3] - ay, l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)), q = (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2;
      if (q < best) best = q;
    }
    return Math.sqrt(best);
  };
  return paint;
}

function bolt(seed) {
  const rng = seeded(seed), main = jagged(rng, 0, -0.97, 0, 0.97, 9, 0.62), lines = [[main, 1]];
  // One or two short forks off the main bolt.
  for (let b = 0, n = 1 + (seed % 2); b < n; b++) {
    const i = 2 + Math.floor(rng() * 5), [x0, y0] = main[i], dir = rng() < 0.5 ? -1 : 1;
    lines.push([jagged(rng, x0, y0, Math.max(-0.92, Math.min(0.92, x0 + dir * (0.35 + rng() * 0.35))), Math.min(0.9, y0 + 0.2 + rng() * 0.25), 3, 0.12), 0.7]);
  }
  const paint = strokes(lines, 0.15, 0.32);
  return { clip: false, fill: 0.7, paint: (x, y) => paint(x, y) * Math.min(1, (1 - Math.abs(y)) * 14),
    shade: (x, y) => RIM + (1 - RIM) * smooth(0.17, 0.1, paint.distance(x, y)) };
}

function crackle(seed) {
  const rng = seeded(seed), lines = [];
  for (let i = 0, n = 6; i < n; i++) {
    const a = (i + rng() * 0.7) / n * Math.PI * 2, r = 0.55 + rng() * 0.38;
    lines.push([jagged(rng, Math.cos(a) * 0.08, Math.sin(a) * 0.08, Math.cos(a) * r, Math.sin(a) * r, 4, 0.16), 0.8 + rng() * 0.2]);
  }
  const paint = strokes(lines, 0.07, 0.14);
  return { fill: 0.85, paint: (x, y, d) => Math.min(1, paint(x, y) + 0.9 * gauss(d, 0.16)),
    shade: (x, y, d) => RIM + (1 - RIM) * Math.max(smooth(0.09, 0.05, paint.distance(x, y)), smooth(0.2, 0.1, d)) };
}

// The dart's half width along its length: thin at the tail, full behind the head, a round nose from y 0.55 to 0.95.
const dartWidth = (y) => (0.1 + 0.3 * smooth(-0.95, 0.35, y)) * (y > 0.55 ? Math.sqrt(Math.max(0, 1 - ((y - 0.55) / 0.4) ** 2)) : 1);
export const SIGNATURE_CELLS = Object.freeze([
  { name: "orb", fill: 0.46,
    paint: (x, y, d) => Math.min(1, smooth(0.47, 0.42, d) + 0.22 * Math.max(0, 1 - d) ** 1.6),
    shade: (x, y, d) => RIM + (1 - RIM) * smooth(0.36, 0.29, d) },
  { name: "bolt", ...bolt(31) },
  { name: "bolt1", ...bolt(77) },
  { name: "bolt2", ...bolt(123) },
  { name: "bolt3", ...bolt(901) },
  { name: "crackle", ...crackle(19) },
  { name: "crackle1", ...crackle(4242) },
  { name: "crescent", fill: 0.9,
    paint: (x, y) => {
      // A thick moon opening to the right: inside the outer disc, outside the inner one.
      const outer = Math.hypot(x + 0.06, y), inner = Math.hypot(x - 0.3, y * 1.05);
      return smooth(0.9, 0.84, outer) * smooth(0.6, 0.67, inner);
    },
    shade: (x, y) => {
      const outer = Math.hypot(x + 0.06, y), inner = Math.hypot(x - 0.3, y * 1.05);
      return RIM + (1 - RIM) * smooth(0.82, 0.75, outer) * smooth(0.69, 0.76, inner);
    } },
  { name: "sundisc", fill: 0.9,
    paint: (x, y, d) => {
      const a = Math.atan2(y, x), ray = Math.max(0, Math.cos(a * 8)) ** 4, tip = 0.52 + 0.43 * ray;
      return Math.min(1, smooth(0.44, 0.39, d) + ray * smooth(tip, tip - 0.12, d) * smooth(0.3, 0.42, d) + 0.18 * Math.max(0, 1 - d));
    },
    shade: (x, y, d) => (d < 0.42 ? RIM + (1 - RIM) * smooth(0.36, 0.3, d) : 1) },
  { name: "shard", fill: 0.96,
    paint: (x, y) => smooth(1, 0.9, Math.abs(x) / 0.3 + Math.abs(y) / 0.96),
    shade: (x, y) => RIM + (1 - RIM) * smooth(0.82, 0.62, Math.abs(x) / 0.3 + Math.abs(y) / 0.96) },
  { name: "starburst", fill: 0.9,
    paint: (x, y, d) => {
      const a = Math.atan2(y, x), long = Math.max(0, Math.cos(a * 6)) ** 60, short = Math.max(0, -Math.cos(a * 6)) ** 60;
      return Math.min(1, gauss(d, 0.17) + long * smooth(0.98, 0.3, d) + 0.8 * short * smooth(0.62, 0.2, d) + 0.25 * gauss(d, 0.45));
    } },
  // Last, so every older index stays: the dart (src/fx-kinds/signature-kinds.js bolts and molten slugs).
  { name: "dart", fill: 0.4, clip: false,
    paint: (x, y) => {
      const w = dartWidth(y), tail = 0.35 + 0.65 * smooth(-1, 0.3, y);
      return y > 0.96 ? 0 : smooth(w + 0.06, w, Math.abs(x)) * tail;
    },
    shade: (x, y) => RIM + (1 - RIM) * smooth(dartWidth(y) - 0.01, dartWidth(y) - 0.11, Math.abs(x)) },
]);
