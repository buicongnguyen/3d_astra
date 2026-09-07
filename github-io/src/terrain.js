import { HALF, ROCKS } from "./data.js";
export const MAPS = {
  classic: "Ashen Frontier",
  riverlands: "Meridian Riverlands",
};
export const CROSSINGS = [
  { x: -22, half: 5, type: "bridge" },
  { x: 0, half: 5, type: "ford" },
  { x: 22, half: 5, type: "bridge" },
];
export const SURFACES = {
  grass: "#788662",
  dirt: "#928260",
  sand: "#b5a074",
  road: "#aa9371",
  stone: "#69736a",
  mud: "#686955",
  water: "#387d89",
  ford: "#70a7a0",
  bridge: "#ada38a",
};
const waterRects = [
  [-48, -27],
  [-17, -5],
  [5, 17],
  [27, 48],
].map(([left, right]) => ({ left, right, top: -3, bottom: 3 }));
function overlaps(x, z, r, b) {
  return (
    Math.hypot(
      x - Math.max(b.left, Math.min(b.right, x)),
      z - Math.max(b.top, Math.min(b.bottom, z)),
    ) <
    r + 1e-6
  );
}
export class Terrain {
  constructor(id = "classic") {
    this.id = Object.hasOwn(MAPS, id) ? id : "classic";
    this.water = this.id === "riverlands" ? waterRects : [];
  }
  at(x, z) {
    if (this.id === "classic") return "dirt";
    if (Math.abs(z) < 3)
      return CROSSINGS.find((c) => Math.abs(x - c.x) < c.half)?.type ?? "water";
    if (Math.abs(z) < 5)
      return CROSSINGS.some((c) => Math.abs(x - c.x) < c.half) ? "road" : "mud";
    if (ROCKS.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + 1))
      return "stone";
    if (
      Math.min(Math.abs(x + 22), Math.abs(x - 22)) < 2.3 ||
      Math.abs(z + x * 0.35) < 1.8
    )
      return "road";
    const n =
      Math.sin(x * 0.13) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.09);
    return n > 0.65 ? "sand" : n < -0.4 ? "dirt" : "grass";
  }
  canStand(x, z, r = 0.55) {
    return (
      Number.isFinite(x) &&
      Number.isFinite(z) &&
      Number.isFinite(r) &&
      r >= 0 &&
      Math.abs(x) < HALF - r &&
      Math.abs(z) < HALF - r &&
      !this.water.some((b) => overlaps(x, z, r, b))
    );
  }
  canTraverse(a, b, r = 0.55) {
    if (![a.x, a.z, b.x, b.z, r].every(Number.isFinite) || r < 0) return false;
    if (!this.canStand(a.x, a.z, r) || !this.canStand(b.x, b.z, r))
      return false;
    if (!this.water.length) return true;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4),
    );
    for (let i = 0; i <= steps; i++)
      if (
        !this.canStand(
          a.x + ((b.x - a.x) * i) / steps,
          a.z + ((b.z - a.z) * i) / steps,
          r,
        )
      )
        return false;
    return true;
  }
  placement(x, z, r) {
    if (this.id === "riverlands" && Math.abs(z) < 7 + r)
      return "Keep water, banks and crossing approaches clear.";
    return "";
  }
}
