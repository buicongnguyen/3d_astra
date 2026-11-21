// The one texture of the building decals (src/building-decals-view.js, AAA round 3, R3-L): 32 cells of
// 128 px in an 8 x 4 grid, drawn with Canvas 2D when the first building appears (no file to load, about
// 2 MB of GPU memory with mipmaps). Cells painted white or light grey are tinted per instance (team colour);
// the others keep their own colours. Every cell keeps a 2 px clear margin so mipmaps do not bleed.
//
// Ground cells are calm and low in saturation; only the lights are vivid.

export const GRID = { cols: 8, rows: 4, cell: 128 };

// Cell ids, in grid order (row by row from the top left).
export const CELL = {
  hazard: 0, plate1: 1, plate2: 2, emblem: 3, ticker: 4, vent: 5, beacon: 6, banner: 7,
  gauge: 8, bar: 9, door: 10, helmet: 11, gear: 12, bolt: 13, sight: 14, wrench: 15,
  apron: 16, chevron: 17, runway: 18, dust: 19, boots: 20, tread: 21, dash: 22, blueprint: 23,
  pool: 24, ashfall: 25, wardens: 26, sunward: 27, veil: 28, meridian: 29, caution: 30, ember: 31,
};

const S = GRID.cell;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
function glow(g, x, y, r, inner, outer = "rgba(255,255,255,0)") {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, "0.75)")); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function plate(g, label) {
  roundRect(g, 14, 30, 100, 68, 10); g.fillStyle = "#f3e7cf"; g.fill();
  g.lineWidth = 5; g.strokeStyle = "#3b2f27"; g.stroke();
  g.fillStyle = "#3b2f27"; g.font = "bold 50px Arial, Helvetica, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, 64, 66);
}
function pictogram(g, draw) {
  roundRect(g, 10, 10, 108, 108, 16); g.fillStyle = "#2c3f45"; g.fill();
  g.lineWidth = 5; g.strokeStyle = "#f6dfa8"; g.stroke();
  g.fillStyle = "#ffe2a0"; g.strokeStyle = "#ffe2a0"; draw();
}

// Each painter draws one cell in a 128 x 128 box at the origin.
const PAINT = [
  /* hazard */ (g) => {
    g.save(); roundRect(g, 4, 34, 120, 60, 6); g.clip();
    g.fillStyle = "#f2b630"; g.fillRect(0, 0, S, S); g.fillStyle = "#2a221d";
    for (let x = -80; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 94); g.lineTo(x + 16, 94); g.lineTo(x + 76, 34); g.lineTo(x + 60, 34); g.fill(); }
    g.restore();
  },
  /* plate1 */ (g) => plate(g, "01"),
  /* plate2 */ (g) => plate(g, "02"),
  /* emblem: a white shield with a chevron, tinted by the team colour */ (g) => {
    g.beginPath(); g.moveTo(64, 8); g.lineTo(114, 24); g.lineTo(108, 76); g.quadraticCurveTo(96, 106, 64, 120); g.quadraticCurveTo(32, 106, 20, 76); g.lineTo(14, 24); g.closePath();
    g.fillStyle = "#e9edf0"; g.fill(); g.lineWidth = 6; g.strokeStyle = "#ffffff"; g.stroke();
    g.fillStyle = "#5d666c"; g.beginPath(); g.moveTo(34, 50); g.lineTo(64, 76); g.lineTo(94, 50); g.lineTo(94, 66); g.lineTo(64, 92); g.lineTo(34, 66); g.closePath(); g.fill();
  },
  /* ticker: lit chevrons on a dark strip (scrolls) */ (g) => {
    g.fillStyle = "#ffd36a";
    for (let x = 0; x < S; x += 32) { g.beginPath(); g.moveTo(x + 4, 40); g.lineTo(x + 18, 40); g.lineTo(x + 30, 64); g.lineTo(x + 18, 88); g.lineTo(x + 4, 88); g.lineTo(x + 16, 64); g.closePath(); g.fill(); }
  },
  /* vent */ (g) => {
    roundRect(g, 12, 22, 104, 84, 8); g.fillStyle = "#4b4038"; g.fill();
    g.fillStyle = "#231c18"; for (let y = 32; y < 100; y += 14) g.fillRect(20, y, 88, 7);
    g.fillStyle = "#8b7a68"; for (let y = 39; y < 100; y += 14) g.fillRect(20, y, 88, 2);
  },
  /* beacon */ (g) => { glow(g, 64, 64, 60, "rgba(255,255,255,1)"); },
  /* banner: white pennant with a grey stripe, tinted */ (g) => {
    g.fillStyle = "#6b5a4c"; g.fillRect(58, 4, 12, 10);
    g.beginPath(); g.moveTo(26, 12); g.lineTo(102, 12); g.lineTo(102, 104); g.lineTo(64, 122); g.lineTo(26, 104); g.closePath();
    g.fillStyle = "#f2f2ee"; g.fill();
    g.fillStyle = "#a9adb0"; g.fillRect(26, 44, 76, 14);
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(64, 82, 11, 0, Math.PI * 2); g.fill();
  },
  /* gauge: crystal gauge frame with a cyan fill (fills with the value) */ (g) => {
    roundRect(g, 22, 8, 84, 112, 14); g.fillStyle = "#3b322b"; g.fill(); g.lineWidth = 5; g.strokeStyle = "#e6c98c"; g.stroke();
    const grad = g.createLinearGradient(0, 100, 0, 20); grad.addColorStop(0, "#21c9d9"); grad.addColorStop(1, "#b7fbff");
    g.fillStyle = grad; roundRect(g, 34, 20, 60, 88, 8); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(52, 30); g.lineTo(62, 30); g.lineTo(50, 96); g.lineTo(42, 96); g.closePath(); g.fill();
  },
  /* bar: five segments, white (tinted), lit up to the progress */ (g) => {
    for (let i = 0; i < 5; i++) { roundRect(g, 6 + i * 24, 46, 20, 36, 5); g.fillStyle = "#ffffff"; g.fill(); }
  },
  /* door: a warm light strip */ (g) => {
    const grad = g.createLinearGradient(0, 40, 0, 88); grad.addColorStop(0, "rgba(255,210,120,0)"); grad.addColorStop(0.5, "rgba(255,220,140,1)"); grad.addColorStop(1, "rgba(255,210,120,0)");
    g.fillStyle = grad; g.fillRect(4, 40, 120, 48);
  },
  /* helmet (Barracks) */ (g) => pictogram(g, () => {
    g.beginPath(); g.arc(64, 74, 34, Math.PI, 0); g.lineTo(104, 80); g.lineTo(24, 80); g.closePath(); g.fill(); g.fillRect(48, 84, 32, 10);
  }),
  /* gear (Foundry) */ (g) => pictogram(g, () => {
    g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 30 : 40; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = "#2c3f45"; g.beginPath(); g.arc(64, 64, 13, 0, Math.PI * 2); g.fill();
  }),
  /* bolt (Command core, Relay) */ (g) => pictogram(g, () => {
    g.beginPath(); g.moveTo(72, 20); g.lineTo(38, 70); g.lineTo(60, 70); g.lineTo(52, 108); g.lineTo(90, 54); g.lineTo(66, 54); g.closePath(); g.fill();
  }),
  /* sight (Tower) */ (g) => pictogram(g, () => {
    g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.stroke();
    g.fillRect(60, 22, 8, 26); g.fillRect(60, 80, 8, 26); g.fillRect(22, 60, 26, 8); g.fillRect(80, 60, 26, 8);
  }),
  /* wrench (Field workshop) */ (g) => pictogram(g, () => {
    g.save(); g.translate(64, 64); g.rotate(-Math.PI / 4); g.fillRect(-7, -6, 14, 46);
    g.beginPath(); g.arc(0, -22, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2c3f45"; g.fillRect(-6, -44, 12, 22); g.restore();
  }),
  /* apron: painted concrete pad, calm warm grey with a darker edge */ (g) => {
    roundRect(g, 4, 4, 120, 120, 12); g.fillStyle = "rgba(150,138,118,0.82)"; g.fill();
    g.lineWidth = 6; g.strokeStyle = "rgba(92,82,70,0.85)"; g.stroke();
    g.strokeStyle = "rgba(120,110,95,0.6)"; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 8); g.lineTo(64, 120); g.moveTo(8, 64); g.lineTo(120, 64); g.stroke();
    g.fillStyle = "rgba(235,200,95,0.85)"; g.fillRect(12, 12, 8, 104); g.fillRect(108, 12, 8, 104);
  },
  /* chevron: white (tinted), points to +v (out of the gate) */ (g) => {
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath(); g.moveTo(10, 96); g.lineTo(64, 30); g.lineTo(118, 96); g.lineTo(92, 96); g.lineTo(64, 62); g.lineTo(36, 96); g.closePath(); g.fill();
  },
  /* runway light */ (g) => { glow(g, 64, 64, 56, "rgba(255,214,128,1)"); g.fillStyle = "#fff6dc"; g.beginPath(); g.arc(64, 64, 12, 0, Math.PI * 2); g.fill(); },
  /* dust puff */ (g) => {
    for (const [x, y, r] of [[64, 64, 44], [40, 58, 26], [88, 70, 28], [62, 40, 24]]) glow(g, x, y, r, "rgba(214,196,168,0.7)", "rgba(214,196,168,0)");
  },
  /* boots: a pair of boot prints */ (g) => {
    g.fillStyle = "rgba(70,56,44,0.7)";
    for (const [x, y] of [[44, 34], [84, 78]]) { g.beginPath(); g.ellipse(x, y, 11, 20, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - 9, y + 22, 18, 10); }
  },
  /* tread: two tread bands */ (g) => {
    g.fillStyle = "rgba(66,54,44,0.65)";
    for (const x of [18, 86]) for (let y = 4; y < 124; y += 14) g.fillRect(x, y, 24, 9);
  },
  /* dash: a glowing dash (tinted), scrolled along u */ (g) => {
    const grad = g.createLinearGradient(0, 0, S, 0); grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.55, "rgba(255,255,255,1)"); grad.addColorStop(0.75, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 50, S, 28);
  },
  /* blueprint: a soft blue grid (tileable) */ (g) => {
    g.fillStyle = "rgba(110,190,255,0.16)"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(170,225,255,0.9)"; g.lineWidth = 3;
    for (let i = 0; i <= S; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  },
  /* pool: a warm amber light pool */ (g) => { glow(g, 64, 64, 62, "rgba(255,178,90,0.9)", "rgba(255,170,80,0)"); },
  /* ashfall: scorched stencil (calm) */ (g) => {
    glow(g, 64, 64, 60, "rgba(40,28,22,0.7)", "rgba(40,28,22,0)");
    g.fillStyle = "rgba(120,52,30,0.75)"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 16 : 36; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill();
  },
  /* wardens: frost-edged slab */ (g) => {
    roundRect(g, 14, 14, 100, 100, 6); g.fillStyle = "rgba(160,170,178,0.78)"; g.fill();
    g.lineWidth = 7; g.strokeStyle = "rgba(226,242,255,0.9)"; g.stroke();
    g.strokeStyle = "rgba(226,242,255,0.6)"; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14 + i * 18, 14); g.lineTo(24 + i * 18, 30); g.stroke(); }
  },
  /* sunward: canvas rug with a sun mark */ (g) => {
    roundRect(g, 10, 22, 108, 84, 8); g.fillStyle = "rgba(196,164,118,0.82)"; g.fill();
    g.fillStyle = "rgba(170,92,52,0.8)"; g.fillRect(10, 30, 108, 6); g.fillRect(10, 92, 108, 6);
    g.fillStyle = "rgba(240,190,90,0.9)"; g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(240,190,90,0.9)"; g.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 19, 64 + Math.sin(a) * 19); g.lineTo(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26); g.stroke(); }
  },
  /* veil: a slow mist swirl (rotated in the shader) */ (g) => {
    g.lineCap = "round";
    for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(214,200,232,${0.5 - k * 0.12})`; g.lineWidth = 10 - k * 2; g.beginPath(); for (let a = 0; a < 5.5; a += 0.1) { const r = 10 + a * 9 + k * 3; g.lineTo(64 + Math.cos(a + k * 2.1) * r, 64 + Math.sin(a + k * 2.1) * r); } g.stroke(); }
  },
  /* meridian: clean mint lines */ (g) => {
    g.strokeStyle = "rgba(130,226,196,0.8)"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(10, 100); g.lineTo(118, 100); g.moveTo(10, 86); g.lineTo(80, 86); g.stroke();
    g.fillStyle = "rgba(130,226,196,0.8)"; g.beginPath(); g.moveTo(88, 80); g.lineTo(100, 86); g.lineTo(88, 92); g.closePath(); g.fill();
  },
  /* caution: warning triangle */ (g) => {
    g.beginPath(); g.moveTo(64, 12); g.lineTo(118, 110); g.lineTo(10, 110); g.closePath(); g.fillStyle = "#f2b630"; g.fill(); g.lineWidth = 6; g.strokeStyle = "#2a221d"; g.stroke();
    g.fillStyle = "#2a221d"; g.fillRect(59, 44, 10, 38); g.fillRect(59, 88, 10, 10);
  },
  /* ember */ (g) => { glow(g, 64, 64, 40, "rgba(255,150,60,1)", "rgba(255,90,30,0)"); },
];

// Draws the atlas into a new canvas (browser only).
export function drawAtlas(doc = globalThis.document) {
  const canvas = doc.createElement("canvas");
  canvas.width = GRID.cols * S;
  canvas.height = GRID.rows * S;
  const g = canvas.getContext("2d");
  PAINT.forEach((paint, i) => {
    g.save();
    g.translate((i % GRID.cols) * S, Math.floor(i / GRID.cols) * S);
    g.beginPath(); g.rect(2, 2, S - 4, S - 4); g.clip();
    paint(g);
    g.restore();
  });
  return canvas;
}
export const CELL_COUNT = PAINT.length;
