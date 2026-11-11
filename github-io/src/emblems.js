import * as THREE from "three";

// Faction emblems for story missions: a small glowing glyph floating over each building so a
// player can tell whose base they are looking at without reading the colour alone. The shapes
// follow the `emblem` notes in src/story/world.js. One white-on-clear texture per faction and one
// sprite material per (faction, team colour), shared by every building of that team.
const SIZE = 96;
const DRAW = {
  // A ring crossed by one vertical line.
  meridian(c) {
    c.beginPath(); c.arc(48, 52, 26, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(48, 10); c.lineTo(48, 86); c.stroke();
  },
  // A falling spark above three stacked bars.
  ashfall(c) {
    c.beginPath(); c.moveTo(48, 6); c.lineTo(58, 28); c.lineTo(48, 36); c.lineTo(38, 28); c.closePath(); c.fill();
    for (let i = 0; i < 3; i++) c.fillRect(24 + i * 3, 46 + i * 15, 48 - i * 6, 9);
  },
  // A half sun over a wheel.
  sunward(c) {
    c.beginPath(); c.arc(48, 40, 20, Math.PI, 0); c.closePath(); c.fill();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 5);
      c.beginPath(); c.moveTo(48 + Math.cos(a) * 25, 40 + Math.sin(a) * 25); c.lineTo(48 + Math.cos(a) * 36, 40 + Math.sin(a) * 36); c.stroke();
    }
    c.beginPath(); c.arc(48, 68, 16, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(48, 52); c.lineTo(48, 84); c.moveTo(32, 68); c.lineTo(64, 68); c.stroke();
  },
  // An open book with a closed eye on the page.
  veil(c) {
    c.beginPath(); c.moveTo(8, 30); c.lineTo(48, 40); c.lineTo(88, 30); c.lineTo(88, 74); c.lineTo(48, 84); c.lineTo(8, 74); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(48, 40); c.lineTo(48, 84); c.stroke();
    c.beginPath(); c.arc(28, 60, 11, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    c.beginPath(); c.arc(68, 60, 11, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  },
  // Three small circles joined in a triangle.
  wardens(c) {
    const p = [[48, 22], [20, 72], [76, 72]];
    c.beginPath(); c.moveTo(...p[0]); c.lineTo(...p[1]); c.lineTo(...p[2]); c.closePath(); c.stroke();
    for (const [x, y] of p) { c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill(); }
  },
};

const textures = new Map();
const materials = new Map();

export const hasEmblem = (faction) => Boolean(DRAW[faction]);

function texture(faction) {
  if (textures.has(faction)) return textures.get(faction);
  const canvas = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE }),
    c = canvas.getContext("2d");
  c.lineCap = c.lineJoin = "round";
  c.lineWidth = 8;
  c.fillStyle = c.strokeStyle = "#fff";
  DRAW[faction](c);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  textures.set(faction, t);
  return t;
}

// A sprite for a building of `faction` owned by `team`, painted in `color` (hex). `size` is its height in world units.
export function createEmblem(faction, team, color, size) {
  const key = `${faction}:${team}`;
  let material = materials.get(key);
  if (!material) {
    material = new THREE.SpriteMaterial({ map: texture(faction), color, transparent: true, opacity: 0.92, depthWrite: false });
    material.userData.team = team;
    materials.set(key, material);
  }
  const sprite = new THREE.Sprite(material);
  sprite.name = "Emblem";
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 2;
  return sprite;
}

// A player changed the team colours: repaint every emblem material.
export function recolorEmblems(colors) {
  for (const m of materials.values()) m.color.setHex(colors[m.userData.team] ?? 0xffffff);
}

// Drop the shared textures and materials (a test or a full renderer teardown).
export function disposeEmblems() {
  for (const t of textures.values()) t.dispose();
  for (const m of materials.values()) m.dispose();
  textures.clear();
  materials.clear();
}
