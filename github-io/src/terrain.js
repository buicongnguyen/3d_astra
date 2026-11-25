import { ROCKS, hyp } from "./data.js";
import MAP_CONFIG from './maps.json' with { type: 'json' };
import balance from './balance.json' with { type: 'json' };
// Frontier Defence maps (src/defence/maps.json) are built like the others but never offered in Skirmish.
import DEFENCE_MAPS from './defence/maps.json' with { type: 'json' };
// Campaign-only battlefields (src/campaign-maps.json, "campaign": true): in no Skirmish list, MAPS or fingerprint of the old maps.
import CAMPAIGN_MAPS from './campaign-maps.json' with { type: 'json' };
export const ALL_MAPS = { ...MAP_CONFIG, ...DEFENCE_MAPS, ...CAMPAIGN_MAPS };
// Height rules (Stage 3): plateau_height, high_range, high_damage, low_damage, hidden_depth, high_vision.
export const TERRAIN = balance.terrain;
export const MAPS = Object.fromEntries(Object.entries(MAP_CONFIG).map(([id,m])=>[id,`${m.name} · ${m.size}×${m.size}`]));
// The one-line idea of a map (maps.json "blurb", the R3 maps), shown as the picker option's tooltip.
export const MAP_BLURBS = Object.fromEntries(Object.entries(MAP_CONFIG).filter(([,m])=>m.blurb).map(([id,m])=>[id,m.blurb]));
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
    hyp(
      x - Math.max(b.left, Math.min(b.right, x)),
      z - Math.max(b.top, Math.min(b.bottom, z)),
    ) <
    r + 1e-6
  );
}
// The reflections of a two-sided layout (the point mirror) or a four-camp one (both axis mirrors too).
export const REFLECTIONS = { point: [[1, 1], [-1, -1]], quad: [[1, 1], [-1, -1], [-1, 1], [1, -1]] };
// Every reflection of [x, z] under a map's symmetry, each point once (a point on an axis is not doubled).
export function reflect(x, z, symmetry = "point") {
  const out = [];
  for (const [sx, sz] of REFLECTIONS[symmetry] || REFLECTIONS.point) {
    const p = [x * sx || 0, z * sz || 0];
    if (!out.some(([a, b]) => a === p[0] && b === p[1])) out.push(p);
  }
  return out;
}
export class Terrain {
  constructor(id = "classic") {
    this.id = Object.hasOwn(ALL_MAPS, id) ? id : "classic";
    Object.assign(this, ALL_MAPS[this.id]);
    this.half = this.size/2; this.grid = this.size/2;
    this.buildHeights();
    // Optional map fields (R3 map variety, docs/MISSIONS.md "Map layouts"). A map without them builds exactly as before.
    //   rivers: [{ z, crossings: [{ x, half, type }] }]  east-west water bands 6 m wide (default: the one
    //           river at z = 0 with CROSSINGS on a map whose `river` is true)
    //   rocks: [[x, z, r]]  the concrete walls (default ROCKS)    roads: [[[x, z], ...]]  painted roads
    //   symmetry: "point" | "quad"  how `roads` (and the simulation's `deposits`) are mirrored
    const custom = Array.isArray(this.rivers);
    this.rivers = custom ? this.rivers.map((r) => this.makeRiver(r.z, r.crossings)) : this.river ? [this.makeRiver(0, CROSSINGS)] : [];
    if (custom) this.river = this.rivers.length > 0;
    this.rocks = this.rocks || ROCKS;
    this.roadLines = this.roads ? this.roads.flatMap((line) => REFLECTIONS[this.symmetry === "quad" ? "quad" : "point"].map(([sx, sz]) => line.map(([x, z]) => [x * sx, z * sz]))) : null;
    this.water = custom
      ? this.rivers.flatMap((r) => r.gaps.map(([left, right]) => ({ left, right, top: r.z - 3, bottom: r.z + 3 })))
      : this.river ? waterRects.map((r,i)=>({...r,left:i===0 ? -this.half:r.left,right:i===3 ? this.half:r.right})) : [];
    // lakes (campaign maps, 2026-11 map variety): [{ x, z, r, island, fords: [{ angle, width }] }]. A round lake of
    // radius r; with `island` the water is a ring from that radius out (a plateau sits inside it). Each ford is a
    // shallow strip `width` wide running from the middle out along `angle` (degrees, like plateau ramps): wadeable.
    this.lakes = (this.lakes || []).map((l) => ({ x: l.x, z: l.z, r: l.r, inner: l.island || 0,
      fords: (l.fords || []).map((f) => { const a = (f.angle * Math.PI) / 180; return { angle: f.angle, half: f.width / 2, dx: Math.cos(a), dz: Math.sin(a) }; }) }));
  }
  // The ford of a lake whose strip holds a circle of radius r at (x, z) entirely, or null.
  lakeFord(l, x, z, r = 0) {
    const dx = x - l.x, dz = z - l.z;
    for (const f of l.fords) if (dx * f.dx + dz * f.dz > 0 && Math.abs(dx * f.dz - dz * f.dx) < f.half - r) return f;
    return null;
  }
  // How deep the drawn ground is cut under lake water at (x, z): 0.5 m inside, easing to 0 a metre beyond the
  // shore (as a river bank does), 0 on a ford. View only (view.js); the rules read lakeWater.
  lakeBed(x, z) {
    let depth = 0;
    for (const l of this.lakes) {
      const d = hyp(x - l.x, z - l.z), s = Math.min(l.r + 1 - d, l.inner ? d - (l.inner - 1) : Infinity);
      if (s > 0 && !this.lakeFord(l, x, z)) depth = Math.max(depth, 0.5 * Math.min(1, s));
    }
    return depth;
  }
  // True when (x, z) wades a lake's ford strip (between the island and the shore): slow like a river ford
  // (sim/traits.js inFord). A plain numeric test, cheap enough for every move step.
  inLakeFord(x, z) {
    for (const l of this.lakes) {
      const d = hyp(x - l.x, z - l.z);
      if (d <= l.r && d >= l.inner && this.lakeFord(l, x, z)) return true;
    }
    return false;
  }
  // True when a circle of radius r at (x, z) touches a lake's open water (its fords are wadeable).
  lakeWater(l, x, z, r = 0) {
    const d = hyp(x - l.x, z - l.z);
    return d < l.r + r && d > l.inner - r && !this.lakeFord(l, x, z, r);
  }
  // A river band: its crossings (west to east), its fords and the open water between them.
  makeRiver(z, crossings) {
    const list = crossings === CROSSINGS ? CROSSINGS : crossings.map((c) => ({ ...c })).sort((a, b) => a.x - b.x), gaps = [];
    let left = -this.half;
    for (const c of list) { if (c.x - c.half > left) gaps.push([left, c.x - c.half]); left = c.x + c.half; }
    if (left < this.half) gaps.push([left, this.half]);
    return { z, crossings: list, fords: list.filter((c) => c.type === "ford"), gaps };
  }
  // The river whose band (|z - river z| < reach) holds z, or null. The old river maps have one, at z = 0.
  riverNear(z, reach) {
    const rivers = this.rivers;
    for (let i = 0; i < rivers.length; i++) if (Math.abs(z - rivers[i].z) < reach) return rivers[i];
    return null;
  }
  cellAt(x,z) { const g = this.grid - 1, h = this.half; return [Math.max(0,Math.min(g,Math.floor((x+h)/2))), Math.max(0,Math.min(g,Math.floor((z+h)/2)))]; }
  // The row-major index of the cell holding (x, z): cellAt without the array (hot paths: visibility, fog).
  cellIndex(x,z) { const g = this.grid - 1, h = this.half; return Math.max(0,Math.min(g,Math.floor((z+h)/2))) * this.grid + Math.max(0,Math.min(g,Math.floor((x+h)/2))); }
  worldAt(x,z) { return {x:x*2-this.half+1,z:z*2-this.half+1}; }
  at(x, z) {
    // Cliff faces read as stone and ramps as road (ground paint, scenery, Sunward's road bonus).
    if (this.plateaus.length) { if (this.onRamp(x, z)) return "road"; if (this.cliff(x, z)) return "stone"; }
    if (this.id === "classic") return "dirt";
    // A lake: open water, its fords, and a sandy shore 2.5 m wide around it.
    for (const l of this.lakes) {
      const d = hyp(x - l.x, z - l.z);
      if (d <= l.r && d >= l.inner) return this.lakeFord(l, x, z) ? "ford" : "water";
      if (d > l.r && d < l.r + 2.5) return "sand";
    }
    const river = this.river ? this.riverNear(z, 5) : null;
    // Defence maps: the enemy road is painted, and none of the skirmish roads or boulders are there.
    if (this.defence && !river) return this.onRoute(x, z) ? "road" : this.ground(x, z);
    if (river && Math.abs(z - river.z) < 3) {
      // Frontier Defence: a blown bridge is water, a pontoon wades like the ford (sim/defence.js applyCrossings).
      const c = river.crossings.find((c) => Math.abs(x - c.x) < c.half);
      return !c || this.blown?.has(c.x) ? "water" : this.pontoons?.includes(c.x) ? "ford" : c.type;
    }
    if (river)
      return river.crossings.some((c) => Math.abs(x - c.x) < c.half) ? "road" : "mud";
    if (this.rocks.some(([rx, rz, r]) => hyp(x - rx, z - rz) < r + 1))
      return "stone";
    // A map with its own roads ("roads") has none of the old ones.
    if (this.roadLines) return this.onRoad(x, z) ? "road" : this.ground(x, z);
    if (Math.min(Math.abs(x + 22), Math.abs(x - 22)) < 2.3 || this.diagonalRoad(x, z) || this.fordTrack(x, z)) return "road";
    return this.ground(x, z);
  }
  ground(x, z) {
    const n =
      Math.sin(x * 0.13) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.09);
    if (this.biome === "desert") return n < -0.8 ? "dirt" : "sand";
    // No bare-earth patch touches a river bank away from a crossing: from the game camera a
    // brown strip at the water's edge reads as a way across.
    const bank = this.river && !!this.riverNear(z, 8);
    if (this.biome === "woodland") return n > 1.2 && !bank ? "dirt" : "grass";
    if (this.biome === "highland") return n > 0.4 ? "stone" : n < -0.8 ? "grass" : "dirt";
    return n > 0.65 ? "sand" : n < -0.4 && !bank ? "dirt" : "grass";
  }
  // Within the 5 m wide road of a defence route (maps "routes", polylines of [x, z]).
  onRoute(x, z, half = 2.5, lines = Object.values(this.routes || {})) {
    for (const pts of lines)
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], dx = pts[i][0] - ax, dz = pts[i][1] - az, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        if (hyp(x - ax - t * dx, z - az - t * dz) < half) return true;
      }
    return false;
  }
  // On one of the map's own roads (maps.json "roads"; 4.4 m wide, like the old bridge roads).
  onRoad(x, z) { return this.onRoute(x, z, 2.2, this.roadLines); }
  // The diagonal road. It runs at a shallow angle to the river, so on river maps it stops where it
  // meets the bridge roads (|z| 6.5) instead of reaching the bank along 15 m of water; the ford
  // gets its own short track straight across the river instead.
  diagonalRoad(x, z) {
    return Math.abs(z + x * 0.35) < 1.8 && (!this.river || Math.abs(z) >= 6.5);
  }
  fordTrack(x, z) {
    return this.river && Math.abs(z) >= 5 && Math.abs(z) < 14 && Math.abs(x) < 2.2 - (Math.abs(z) - 5) * 0.1;
  }
  canStand(x, z, r = 0.55) {
    if (this.plateaus.length && this.cliff(x, z, r)) return false;
    return (
      Number.isFinite(x) &&
      Number.isFinite(z) &&
      Number.isFinite(r) &&
      r >= 0 &&
      Math.abs(x) < this.half - r &&
      Math.abs(z) < this.half - r &&
      !this.inWater(x, z, r)
    );
  }
  inWater(x, z, r) {
    const water = this.water;
    for (let i = 0; i < water.length; i++) if (overlaps(x, z, r, water[i])) return true;
    const lakes = this.lakes;
    for (let i = 0; i < lakes.length; i++) if (this.lakeWater(lakes[i], x, z, r)) return true;
    return false;
  }
  canTraverse(a, b, r = 0.55) {
    if (!(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(r)) || r < 0) return false;
    if (!this.canStand(a.x, a.z, r) || !this.canStand(b.x, b.z, r))
      return false;
    if (!this.water.length && !this.plateaus.length && !this.lakes.length) return true;
    const steps = Math.max(
      1,
      Math.ceil(hyp(b.x - a.x, b.z - a.z) / 0.4),
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
    if (this.plateaus.length && (this.cliff(x, z, r + 1) || this.onRamp(x, z, r + 1)))
      return "Keep cliffs and ramps clear.";
    // Banks end at |z| = 5. Bridge and ford approaches keep a wider clear band so a building
    // never blocks a crossing; elsewhere structures may stand close to the bank.
    for (const river of this.rivers) {
      const approach = river.crossings.some((c) => Math.abs(x - c.x) < c.half + r + 1.5);
      if (Math.abs(z - river.z) < (approach ? 7 : 5.5) + r)
        return "Keep river banks and crossing approaches clear.";
    }
    // A lake's shore stays clear 2 m out, so no building closes a ford's landing.
    for (const l of this.lakes) {
      const d = hyp(x - l.x, z - l.z);
      if (d < l.r + 2 + r && d > l.inner - 1 - r) return "Keep river banks and crossing approaches clear.";
    }
    return "";
  }
  // ---- Height (Stage 3). Two levels: ground (0) and plateau (1, drawn HEIGHT m higher). A
  // plateau's edge is a cliff band 2 m wide that blocks movement and building, except where a
  // ramp crosses it. Maps list plateaus in maps.json; "mirror" adds the point-mirrored copy, like
  // the bases. Straight walls ("walls") are read here too and spawned by the simulation.
  buildHeights() {
    const raw = this.plateaus || [], list = [];
    const SIDES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }, FLIP = { north: "south", south: "north", east: "west", west: "east" };
    const make = (p) => {
      const q = { shape: p.shape, x: p.x, z: p.z, r: p.r, w: p.w, d: p.d, ramps: [] };
      for (const ramp of p.ramps || []) {
        if (p.shape === "disc") {
          const a = (ramp.angle * Math.PI) / 180;
          q.ramps.push({ x: p.x + Math.cos(a) * p.r, z: p.z + Math.sin(a) * p.r, half: ramp.width / 2 });
        } else {
          const [nx, nz] = SIDES[ramp.side], at = ramp.at || 0;
          q.ramps.push({ x: p.x + nx * p.w / 2 + (nz ? at : 0), z: p.z + nz * p.d / 2 + (nx ? at : 0), half: ramp.width / 2 });
        }
      }
      return q;
    };
    // "quad" (opt-in, R3 map variety) adds the two axis mirrors as well, for maps fair to four camps.
    const FLIP_X = { east: "west", west: "east", north: "north", south: "south" }, FLIP_Z = { north: "south", south: "north", east: "east", west: "west" };
    const flipX = (p) => ({ ...p, x: -p.x, ramps: (p.ramps || []).map((r) => (p.shape === "disc" ? { ...r, angle: 180 - r.angle } : { ...r, side: FLIP_X[r.side], at: r.side === "north" || r.side === "south" ? -(r.at || 0) : r.at })) });
    const flipZ = (p) => ({ ...p, z: -p.z, ramps: (p.ramps || []).map((r) => (p.shape === "disc" ? { ...r, angle: -r.angle } : { ...r, side: FLIP_Z[r.side], at: r.side === "east" || r.side === "west" ? -(r.at || 0) : r.at })) });
    for (const p of raw) {
      list.push(make(p));
      if (p.mirror) list.push(make({ ...p, x: -p.x, z: -p.z, ramps: (p.ramps || []).map((r) => (p.shape === "disc" ? { ...r, angle: r.angle + 180 } : { ...r, side: FLIP[r.side], at: -(r.at || 0) })) }));
      if (p.mirror === "quad") { list.push(make(flipX(p))); list.push(make(flipZ(p))); }
    }
    this.plateaus = list;
    this.walls = (this.walls || []).flatMap((w) => (w.mirror ? [w, { ...w, x: -w.x, z: -w.z }] : [w]));
    // Per-cell level, plateau index and "deep" (more than HIDDEN_DEPTH m inside the edge), for vision.
    const n = this.grid * this.grid;
    this.cellLevel = new Uint8Array(n);
    this.cellPlateau = new Int8Array(n).fill(-1);
    this.cellDeep = new Uint8Array(n);
    if (!list.length) return;
    for (let cz = 0; cz < this.grid; cz++)
      for (let cx = 0; cx < this.grid; cx++) {
        const { x, z } = this.worldAt(cx, cz), i = cz * this.grid + cx;
        list.forEach((p, k) => {
          const d = this.edge(p, x, z);
          if (d >= 0) return;
          this.cellLevel[i] = 1;
          this.cellPlateau[i] = k;
          if (-d > TERRAIN.hidden_depth) this.cellDeep[i] = 1;
        });
      }
  }
  // Signed distance to a plateau's edge: negative inside.
  edge(p, x, z) {
    if (p.shape === "disc") return hyp(x - p.x, z - p.z) - p.r;
    const dx = Math.abs(x - p.x) - p.w / 2, dz = Math.abs(z - p.z) - p.d / 2;
    return hyp(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
  }
  plateauAt(x, z) {
    for (let k = 0; k < this.plateaus.length; k++) if (this.edge(this.plateaus[k], x, z) < 0) return k;
    return -1;
  }
  level(x, z) { return this.plateaus.length && this.plateauAt(x, z) >= 0 ? 1 : 0; }
  rampOf(p, x, z, r = 0) { return p.ramps.some((ramp) => hyp(x - ramp.x, z - ramp.z) < ramp.half + r); }
  onRamp(x, z, r = 0) { return this.plateaus.some((p) => this.rampOf(p, x, z, r)); }
  // True when a circle of radius r at (x, z) touches a cliff band outside every ramp.
  cliff(x, z, r = 0) {
    for (const p of this.plateaus) if (Math.abs(this.edge(p, x, z)) < 1 + r && !this.rampOf(p, x, z)) return true;
    return false;
  }
  // Render height: the plateau top, a steep step at cliffs and an even slope along ramps.
  heightAt(x, z) {
    let h = 0;
    for (const p of this.plateaus) {
      const d = this.edge(p, x, z);
      if (d > 3.2) continue;
      const t = this.rampOf(p, x, z) ? 0.5 - d / 6 : 0.5 - d / 1.6, k = Math.min(1, Math.max(0, t));
      h = Math.max(h, TERRAIN.plateau_height * k * k * (3 - 2 * k));
    }
    return h;
  }
}
