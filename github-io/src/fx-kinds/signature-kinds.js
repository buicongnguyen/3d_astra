// How each signature shot flies (V4, 2026-11-26). A kind is `spawn(fx, ev, a, L, P)`: `ev` the shot event, `a` the aim
// (src/fx-kinds/common.js: from, to, land, ux.., len, sx, sz, nx, nz, travel, anchor, power, style), `L` the look
// (signature-shots.json, sizes are what the player sees: [metres, CSS-pixel floor]) and `P` the faction palette (signature-common.js).
// A round lands exactly `travel` seconds after the shot event (visual-style.json `life`, the moment the target's hit flash is timed
// to); a burst's first round lands then and the others a beat later. Light rounds are velocity-driven pooled particles (no
// per-frame work); orbs, rockets and wisps are pooled records stepped every frame (stepSignatures) so they can arc, weave, pulse,
// crackle and lay trails. Every shape is a normal-blended outlined body in the faction colour under an additive glow.
// A round in flight is a projectile: its body and hot heart are flagged `keep`, so the effects' particle cap (src/fx.js
// trimParticles: about 24 records per ten troops on screen) lets it complete its path, as it does the shells and rockets; its
// glow, trail and landing stay ordinary, trimmable detail.
//   bolt      darts, tracers, photon bolts, molten slugs, sun-darts, electric pulses: a round-nosed dart, its glow and hot nose
//   zigzag    Wardens rifles: a flickering zig-zag bolt          strafe   the Hawk at the ground: a walk of darts up to the target
//   crescent  Veil rifles: spinning violet crescent blades       hoops    the Halo: flying ring hoops
//   beam      the Veil's Shade, Watcher and Stalker: a violet beam (crystal rail), crystal shards on the hit
//   arc       the Wardens tower: a crackle gathers, then a jagged arc bolt snaps to the target on the hit
//   orb       plasma orbs, mortar balls, molten slugs, scrap balls, sun-discs, electric shock balls, void orbs (stepped)
//   rocket    every faction's anti-tank rocket: the painted head (or the finned body) with the faction's exhaust and trail (stepped)
//   wisps     the Moth: violet homing wisps weaving to the target (stepped)
//   motes     the Sunward Wagon's heal: a golden beam, the plus in gold, golden motes rising
import { CELL, STRETCH, SHOT_SCALE } from "./cells.js";
import { size, quad, put, shape, flyStreak, flyPoint, sparksAt, later, sheet, SHEET, phoneTier, flightCell } from "./signature-common.js";
import { IMPACTS, lightning } from "./signature-impacts.js";
import { CLASS_LOOK } from "./weapon-class.js";
import { warnRing } from "./ordnance.js";
import { ROCKET, armoured } from "./rocket.js";
import { spriteStomp, spriteBeamLine, spritesReady } from "./sprite-fx.js";
import { chargeGlow, beamLine } from "./beam.js";
import { HEAD_FRAME, SHEETS, MUZZLE_ROW } from "../fx-sprites-data.js";

// How hard a round lands, as src/fx.js hit sizes its blast: power, never wider than two target widths.
const scaleOf = (a) => Math.max(0.35, Math.min(a.power || 0.5, (a.anchor?.targetWidth ?? Infinity) * 2 / 4.6));
// The options every impact reads (one object per landing).
export function landing(a, L, P, ev, calm = false) {
  return { pal: P, s: scaleOf(a), power: a.power, anchor: a.anchor, aloft: !!ev.tAir, direct: !!a.anchor?.direct, calm, team: ev.team,
    target: ev.target, chain: L.chain || 0, sheet: L.sheet, shards: L.shards };
}
const impactOf = (L) => IMPACTS[L.impact] || IMPACTS.pop;

// The muzzle: the white-hot star (rate-limited with every other flare, src/fx.js allowFlash) inside a glow of the faction's colour,
// and each faction's own touch: Ashfall's painted flame and sparks, a Wardens crackle, a Sunward starburst, a Veil shard glint,
// a Meridian ring for a heavy gun. With the Codex muzzle-energy sheet packed, its row for the faction replaces the glow.
export function muzzle(fx, ev, a, L, P, heavy, delay = 0) {
  const from = a.from, anchor = a.anchor, v = size(fx, L.muzzle || [0.5, 10]), id = P.id;
  // The painted flash, opening along the shot from the muzzle: the faction's energy row (attached at 0.23 of its cell), or for
  // Ashfall, which has no energy row, the fire muzzle sheet (attached at its inlet). A cell of 1.4 m, never under 28 CSS px on a
  // desktop or 20 (gold 24) on a phone, no extra quartering; 24 fps, 40 where the gun refires faster than 0.2 s (review 2026-11-26).
  const M = SHEET.muzzleEnergy, rows = M.rows, ash = id === "ashfall";
  const name = ash ? sheet(fx, "muzzle") : Object.hasOwn(rows, id) ? sheet(fx, "muzzleEnergy") : null;
  if (name && fx.motion && fx.allowFlash()) {
    const u = fx.view.unitsPerPixel || 0, phone = phoneTier(fx), floor = phone ? (id === "sunward" ? M.goldPhone : M.cell[2]) : M.cell[1];
    const cell = Math.max(M.cell[0], floor * u), back = (0.5 - (ash ? SHEETS.muzzle.inlet : M.attach)) * cell;
    const p = fx.sprites.take(name, from.x + a.ux * back, from.y + a.uy * back, from.z + a.uz * back, cell, anchor, true);
    if (p) {
      p.mode = 2; p.ax = a.ux; p.ay = a.uy; p.az = a.uz; p.count = 4; p.age = -delay;
      p.fps = (L.count || 1) > 3 ? 40 : 24;
      p.start = ash ? MUZZLE_ROW[heavy ? "large" : "small"] * 4 : rows[id] * 4; p.life = 4 / p.fps;
    }
  }
  fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, cell: CELL.flare, s0: quad("flare", v * 0.6), s1: quad("flare", v * 0.75), life: 0.05, c0: P.core, c1: P.main0, anchor, delay });
  shape(fx, fx.glow, from, CELL.glow, v, v * 1.25, heavy ? 0.1 : 0.065, P.mainSoft, P.main0, anchor, delay);
  if (id === "ashfall") {
    sparksAt(fx, from, L.sparks || (heavy ? 4 : 1), anchor, heavy ? 0.6 : 0.35, P.spark, P.main0, delay, 16);
  } else if (id === "wardens") {
    const c = shape(fx, fx.glow, from, CELL.crackle, v * 0.55, v * 0.85, heavy ? 0.12 : 0.07, P.spark, P.main0, anchor, delay);
    c.frames = 2; c.fps = 30; c.jump = 2.4;
  } else if (id === "sunward") {
    shape(fx, fx.glow, from, CELL.starburst, v * 0.45, v * 0.9, heavy ? 0.12 : 0.07, P.core, P.main0, anchor, delay).spin = 4;
  } else if (id === "veil") {
    shape(fx, fx.glow, from, CELL.shard, v * 0.4, v * 0.6, heavy ? 0.12 : 0.07, P.spark, P.main0, anchor, delay);
  } else if (heavy) {
    shape(fx, fx.glow, from, CELL.ring, v * 0.3, v * 0.75, 0.14, P.main, P.main0, anchor, delay);
  }
  // A heavy gun's blast kicks up the ground under the muzzle (src/fx.js shot), and Ashfall's guns smoke.
  if (heavy && fx.budget === 1 && !ev.sAir && ev.unit !== "tower") fx.dust({ x: from.x, y: 0.25, z: from.z }, 1, anchor, 0.8, 0.8);
  if (heavy && id === "ashfall" && fx.budget === 1) {
    const q = shape(fx, fx.smoke, from, CELL.puff, 0.35, 1.5, 1, P.smokeSoft, P.smoke0, anchor, delay);
    q.vx = a.nx * 1.4; q.vz = a.nz * 1.4; q.vy = 0.5; q.drag = 2; q.spin = 0.8;
  }
}

// A light round's path: `side` metres sideways at the muzzle and `spread` more at the target.
function path(a, side, spread) {
  return [{ x: a.from.x + a.sx * side, y: a.from.y, z: a.from.z + a.sz * side }, { x: a.to.x + a.sx * (side + spread), y: a.to.y, z: a.to.z + a.sz * (side + spread) }];
}

function bolt(fx, ev, a, L, P) {
  const n = L.count > 3 ? fx.count(L.count * 2) : (L.count || 1), gap = L.gap || 0, len = size(fx, L.length), w = size(fx, L.width), h = size(fx, L.head);
  const impact = impactOf(L), o = landing(a, L, P, ev), headCell = L.headCell ? CELL[L.headCell] : CELL.glow;
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0; i < n; i++) {
    const delay = i * gap, side = L.side ? (i % 2 ? 1 : -1) * L.side : 0;
    const fan = L.fan && n > 1 ? (i / (n - 1) - 0.5) * 2 * L.fan : 0, jitter = L.jitter ? (fx.rng() - 0.5) * 2 * L.jitter : 0;
    const [from, to] = path(a, side, fan + jitter);
    const flight = Math.max(0.05, a.travel * (L.speedSpread ? 1 + (fx.rng() - 0.5) * L.speedSpread : 1));
    // The outlined dart in the faction's colour (normal blended: it reads on snow), the light round it, and a glowing ball at
    // its nose (the outlined ball and its small white-hot heart).
    const lead = Math.min(len, a.len * 0.9) * 0.88;
    flyStreak(fx, fx.smoke, from, to, flight, len, w, CELL.dart, P.main, P.main, a.anchor, delay).keep = true;
    flyStreak(fx, fx.glow, from, to, flight, len * 1.1, w * 2.4, CELL.streak, P.mainSoft, P.mainSoft, a.anchor, delay);
    const ball = flyPoint(fx, fx.smoke, from, to, flight, h, headCell === CELL.glow ? CELL.orb : headCell, P.main, P.main, a.anchor, delay, lead);
    const heart = flyPoint(fx, fx.glow, from, to, flight, h * (headCell === CELL.glow ? 0.55 : 0.8), headCell, P.core, P.core, a.anchor, delay, lead);
    heart.keep = true;
    if (headCell === CELL.starburst) { ball.spin = heart.spin = 10; heart.rot = ball.rot; }
    if (L.crackle) {
      const c = flyPoint(fx, fx.glow, from, to, flight, h * 1.7, CELL.crackle, P.spark, P.spark, a.anchor, delay, lead);
      c.frames = 2; c.fps = 28; c.jump = 2.4;
    }
    for (let j = 0, shimmer = L.shimmer || 0; j < shimmer; j++) {
      // Sunward light shimmers: a twinkle left in the air where the bolt passed.
      const k = (j + 1) / (shimmer + 1), at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
      shape(fx, fx.glow, at, CELL.starburst, h * 0.4, h * 1.1, 0.22, P.spark, P.main0, a.anchor, delay + flight * k).spin = 3;
    }
    // Every round of a short burst lands with its hit; a long stream every other one.
    if (n <= 3 || i % 2 === 0) later(fx, delay + flight, () => impact(fx, to, o));
  }
}

function zigzag(fx, ev, a, L, P) {
  const n = L.count || 1, gap = L.gap || 0, len = size(fx, L.length), w = size(fx, L.width), impact = impactOf(L), o = landing(a, L, P, ev);
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0; i < n; i++) {
    const delay = i * gap, jitter = L.jitter ? (fx.rng() - 0.5) * 2 * L.jitter : 0, [from, to] = path(a, 0, jitter), flight = Math.max(0.05, a.travel);
    const frame = Math.floor(fx.rng() * 4);
    // The outlined blue bolt (normal blended, for snow) under its pale light, flickering through the four bolt cells together.
    for (const layer of [fx.smoke, fx.glow]) {
      const b = flyStreak(fx, layer, from, to, flight, len, w, CELL.bolt, layer === fx.smoke ? P.main : P.sparkSoft, layer === fx.smoke ? P.main : P.sparkSoft, a.anchor, delay);
      b.frames = 4; b.fps = 36; b.frame = frame; b.keep = true;
    }
    flyPoint(fx, fx.glow, from, to, flight, w * 0.6, CELL.glow, P.core, P.core, a.anchor, delay, Math.min(len, a.len * 0.9) * 0.9);
    later(fx, delay + flight, () => impact(fx, to, o));
  }
}

function strafe(fx, ev, a, L, P) {
  const n = Math.max(2, Math.round((L.count || 4) * (fx.view.lowPower ? 0.75 : 1))), gap = Math.min(L.gap || 0.05, a.travel / (n + 1)), flight = Math.max(0.05, a.travel - (n - 1) * gap);
  const len = size(fx, L.length), w = size(fx, L.width), h = size(fx, L.head), impact = impactOf(L), o = landing(a, L, P, ev);
  const dx = a.to.x - a.from.x, dz = a.to.z - a.from.z, d = Math.hypot(dx, dz) || 1, walk = Math.min(L.walk || 3, d * 0.6);
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0; i < n; i++) {
    // Round i lands `back` metres short of the target on the line from the gunship; the last on the target, at the hit.
    const back = walk * (1 - i / (n - 1)), delay = i * gap, last = i === n - 1;
    const tx = a.to.x - (dx / d) * back + (fx.rng() - 0.5) * 0.4, tz = a.to.z - (dz / d) * back + (fx.rng() - 0.5) * 0.4;
    const to = { x: tx, y: last ? a.to.y : fx.ground(tx, tz) + 0.15, z: tz };
    flyStreak(fx, fx.smoke, a.from, to, flight, len, w, CELL.dart, P.main, P.main, a.anchor, delay).keep = true;
    flyStreak(fx, fx.glow, a.from, to, flight, len * 1.1, w * 2.4, CELL.streak, P.mainSoft, P.mainSoft, a.anchor, delay);
    flyPoint(fx, fx.smoke, a.from, to, flight, h, CELL.orb, P.main, P.main, a.anchor, delay, len * 0.88);
    flyPoint(fx, fx.glow, a.from, to, flight, h * 0.55, CELL.glow, P.core, P.core, a.anchor, delay, len * 0.88);
    later(fx, delay + flight, () => impact(fx, to, last ? o : { ...o, direct: true }));
  }
}

function crescent(fx, ev, a, L, P) {
  const n = L.count || 1, gap = L.gap || 0, v = size(fx, L.size), impact = impactOf(L), o = landing(a, L, P, ev), painted = sheet(fx, L.sheet);
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0; i < n; i++) {
    const delay = i * gap, side = L.side ? (i % 2 ? 1 : -1) * L.side : 0, [from, to] = path(a, side, 0), flight = Math.max(0.05, a.travel);
    const spin = (L.spin || 20) * (i % 2 ? -1 : 1);
    if (painted) {
      // The Codex flipbook (frames 0-7: the turning blade with its afterimages, travel pointing right), its spin centre on the path.
      const p = flySprite(fx, painted, from, to, flight, flightCell(fx, SHEET.crescent), SHEET.crescent.head[0], a.anchor, delay);
      if (p) p.hard = true; // spinner poses about 45 degrees apart: step, do not cross-fade
    } else {
      // The blade (outlined violet, normal blended) and its glow, spinning together.
      const body = flyPoint(fx, fx.smoke, from, to, flight, v, CELL.crescent, P.main, P.main, a.anchor, delay);
      body.keep = true;
      const glow = flyPoint(fx, fx.glow, from, to, flight, v, CELL.crescent, P.spark, P.spark, a.anchor, delay);
      body.spin = glow.spin = spin; glow.rot = body.rot;
      flyPoint(fx, fx.glow, from, to, flight, v * 1.5, CELL.glow, P.mainDim, P.mainDim, a.anchor, delay);
    }
    // A faint violet wake behind the blade.
    if (!painted) flyStreak(fx, fx.glow, from, to, flight, Math.min(v * 2.6, a.len * 0.6), v * 0.45, CELL.streak, P.mainSoft, P.mainSoft, a.anchor, delay);
    later(fx, delay + flight, () => impact(fx, to, o));
  }
}

function hoops(fx, ev, a, L, P) {
  const n = L.count || 2, gap = L.gap || 0.05, v = size(fx, L.size), impact = impactOf(L), o = landing(a, L, P, ev), painted = sheet(fx, L.sheet);
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0; i < n; i++) {
    const delay = i * gap, flight = Math.max(0.05, a.travel);
    if (painted) {
      // The Codex flipbook (frames 0-7: the Halo's elliptical hoop and its wisps, travel pointing right).
      const p = flySprite(fx, painted, a.from, a.to, flight, flightCell(fx, SHEET.hoop), SHEET.hoop.head[0], a.anchor, delay);
      if (p) upright(fx, p, SHEET.hoop.upright);
    } else {
      // A cyan ring hoop: the band (normal blended, for snow), its bright edge and a soft glow.
      const hoop = P.accent || P.main, soft = P.accentSoft || P.mainSoft;
      flyPoint(fx, fx.smoke, a.from, a.to, flight, v, CELL.band, hoop, hoop, a.anchor, delay).keep = true;
      flyPoint(fx, fx.glow, a.from, a.to, flight, v * 1.04, CELL.ring, P.core, hoop, a.anchor, delay);
      flyPoint(fx, fx.glow, a.from, a.to, flight, v * 1.3, CELL.glow, soft, soft, a.anchor, delay);
    }
    if (i === 0) later(fx, delay + flight, () => impact(fx, a.to, o));
  }
}

const VIOLET_STRIP = [0.95, 0.62, 1];
function beam(fx, ev, a, L, P) {
  const { from, to, anchor, travel, style } = a, w = size(fx, L.width), life = Math.max(0.14, style?.beamLife ?? 0.14), o = landing(a, L, P, ev);
  muzzle(fx, ev, a, L, P, false);
  // A violet charge gathers at the muzzle for the shot's flight time, then the line snaps out with the hit (beam.js).
  chargeGlow(fx, fx.rng, from, P.main, travel, anchor, 0.8);
  if (!spriteBeamLine(fx, from, to, a.ux, a.uy, a.uz, "magenta", Math.max(w * 4, 0.9), Math.max(life, 0.28), anchor, travel, VIOLET_STRIP)) {
    beamLine(fx, fx.rng, a, P.core, quad("glow", w) * 0.45, life, travel);
    beamLine(fx, fx.rng, a, P.main, quad("glow", w), life, travel);
  }
  // A crystal rail leaves shards hanging along the line, glinting as they drift and fade.
  for (let i = 0, n = L.floaters ? fx.count(L.floaters * 2) : 0; i < n; i++) {
    const k = 0.15 + fx.rng() * 0.8, at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
    const life2 = 0.55 + fx.rng() * 0.3, vy = 0.35 + fx.rng() * 0.3, vx = (fx.rng() - 0.5) * 0.4, vz = (fx.rng() - 0.5) * 0.4, spin = (fx.rng() - 0.5) * 3;
    for (const [layer, c] of [[fx.smoke, P.main], [fx.glow, P.spark]]) {
      const p = shape(fx, layer, at, CELL.shard, size(fx, [0.22, 7]), size(fx, [0.1, 3]), life2, c, P.main0, anchor, travel);
      p.vx = vx; p.vy = vy; p.vz = vz; p.spin = spin;
    }
  }
  later(fx, travel, () => impactOf(L)(fx, to, o));
}

function arc(fx, ev, a, L, P) {
  const { from, to, anchor, travel } = a, w = size(fx, L.width), o = landing(a, L, P, ev);
  muzzle(fx, ev, a, L, P, true);
  // The crackle gathers on the emitter for the flight time; then the arc snaps to the target, flickering three times.
  const c = shape(fx, fx.glow, from, CELL.crackle, size(fx, [0.25, 7]), size(fx, [0.8, 20]), Math.max(0.05, travel), P.spark, P.main, anchor);
  c.frames = 2; c.fps = 24; c.jump = 2.4;
  const segments = Math.max(3, Math.min(6, Math.round(a.len / 2.2)));
  lightning(fx, from, to, w, 0.07, P, anchor, travel, segments, 0.55, 3);
  later(fx, travel, () => impactOf(L)(fx, to, o));
}

// Orbs, rockets and wisps: pooled flight records stepped every frame. Parts are pooled glow / smoke records the round owns
// (owner = its token, as the rocket halo of src/fx.js): one a part has lost to the pool's cap is simply taken again.
const PARTS = 6;
function newRound() {
  return { L: null, P: null, style: "", cls: "", from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, land: { x: 0, y: 0, z: 0 }, travel: 1, age: 0, wait: 0,
    arc: 0, weave: 0, phase: 0, sx: 0, sz: 0, token: 0, anchor: null, o: null, trail: 0, trail2: 0, roll: 0, spin: 0, body: 0, halo: 0, tail: 0, armour: false,
    sprite: null, parts: new Array(PARTS).fill(null) };
}
const state = (fx) => fx.sig || (fx.sig = { rounds: [], free: [] });
function launchRound(fx, ev, a, L, P, style, cls) {
  const S = state(fx), r = S.free.pop() || newRound();
  r.L = L; r.P = P; r.style = style; r.cls = cls; r.age = 0; r.wait = 0; r.trail = 0; r.trail2 = 0; r.sprite = null;
  r.from.x = a.from.x; r.from.y = a.from.y; r.from.z = a.from.z; r.to.x = a.to.x; r.to.y = a.to.y; r.to.z = a.to.z; r.land.x = a.land.x; r.land.y = a.land.y; r.land.z = a.land.z;
  const target = ev.target != null ? fx.frameSim?.get?.(ev.target) : null, killed = ev.target != null && !(target && target.hp > 0);
  r.travel = Math.max(0.05, a.travel);
  if (killed) r.travel = Math.min(r.travel, cls === "rocket" ? ROCKET.quick : CLASS_LOOK.quick); // the wreck is already falling
  const len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z), look = cls === "rocket" ? ROCKET : CLASS_LOOK[cls === "lob" ? "lob" : "shell"];
  r.arc = cls === "wisp" ? 0 : Math.min(look.arcMax ?? 0, len * (look.arc ?? 0));
  r.weave = cls === "wisp" ? (L.weave || 0.6) * Math.min(1, len / 6) : 0;
  r.phase = fx.rng() * 6.28; r.sx = a.sx; r.sz = a.sz; r.roll = fx.rng() * 6.28; r.spin = style === "disc" ? 15 : style === "scrap" ? 5 : 0;
  r.anchor = a.anchor; r.token = ++fx.rocketTokens;
  r.armour = armoured(target);
  r.o = landing(a, L, P, ev);
  r.body = L.body ? size(fx, L.body) : L.size ? size(fx, L.size) : 0; r.halo = L.halo ? size(fx, L.halo) : 0; r.tail = L.tail ? size(fx, L.tail) : 0;
  for (let i = 0; i < PARTS; i++) r.parts[i] = null;
  S.rounds.push(r);
  return r;
}
function orb(fx, ev, a, L, P) {
  const lob = L.arc === "lob";
  muzzle(fx, ev, a, L, P, true);
  // A Walker's feet still stamp the ground as it fires (R3-FX2), so it never reads as a Tank.
  if (ev.unit === "walker") spriteStomp(fx, { x: ev.x, y: 0.1, z: ev.z }, a.anchor);
  // The artillery warning: a red ring where the lob will land (a gameplay cue every faction keeps, src/fx-kinds/ordnance.js).
  if (lob) warnRing(fx, a.land.x, a.land.z, 1.6, a.travel, a.anchor);
  launchRound(fx, ev, a, L, P, L.style || "plasma", lob ? "lob" : "shell");
}
const VAPOUR = Object.freeze([0.62, 0.6, 0.56, 0.42]), VAPOUR_END = Object.freeze([0.62, 0.6, 0.56, 0]);
function rocket(fx, ev, a, L, P) {
  const { from, nx, nz, anchor } = a;
  muzzle(fx, ev, a, L, P, false);
  // Back-blast: Ashfall's rockets throw black smoke behind the launcher, the energy rockets a breath of pale vapour.
  if (fx.budget === 1) for (let i = 0, n = fx.count(3); i < n; i++) {
    const ash = P.id === "ashfall", q = shape(fx, fx.smoke, { x: from.x - nx * 1.2, y: from.y, z: from.z - nz * 1.2 }, CELL.puff, 0.32, 1.2, 0.8 + fx.rng() * 0.3,
      ash ? P.smokeSoft : VAPOUR, ash ? P.smoke0 : VAPOUR_END, anchor);
    q.vx = -nx * (1.6 + i * 0.6); q.vz = -nz * (1.6 + i * 0.6); q.vy = 0.5; q.drag = 2.2; q.spin = 0.8;
  }
  launchRound(fx, ev, a, L, P, "rocket", "rocket");
}
function wisps(fx, ev, a, L, P) {
  muzzle(fx, ev, a, L, P, false);
  for (let i = 0, n = L.count || 2; i < n; i++) {
    const r = launchRound(fx, ev, a, L, P, "wisp", "wisp");
    r.phase = i ? Math.PI : 0; r.wait = i * 0.05; r.travel = Math.max(0.05, r.travel - r.wait);
    if (i) r.o = null; // one landing for the pair
  }
}

// Wagon (support): a golden beam to the patient, the plus glyph in gold and golden motes rising off it.
function motes(fx, ev, a, L, P) {
  const { from, to, anchor } = a, dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz) || 1, width = anchor.targetWidth || 1.5;
  const beamW = Math.min(0.18, width * 0.15);
  const b = put(fx, fx.glow, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, anchor);
  b.mode = STRETCH; b.ax = dx / len; b.ay = dy / len; b.az = dz / len; b.length = len; b.cell = CELL.glow; b.s0 = beamW; b.s1 = beamW * 0.7; b.life = 0.34; b.c0 = P.mainSoft; b.c1 = P.main0;
  const glyph = Math.min(width * 0.72, 0.86), g = put(fx, fx.smoke, to.x, to.y + width * 0.55, to.z, anchor);
  g.cell = CELL.cross; g.rot = 0; g.s0 = g.s1 = glyph; g.life = 0.48; g.c0 = P.mainSolid; g.c1 = P.main0;
  for (let i = 0, n = fx.count(6); i < n; i++) {
    const at = { x: to.x + (fx.rng() - 0.5) * width * 0.8, y: to.y - 0.3 + fx.rng() * 0.5, z: to.z + (fx.rng() - 0.5) * width * 0.8 };
    const p = shape(fx, fx.glow, at, i % 2 ? CELL.starburst : CELL.glow, size(fx, [0.16, 5]), size(fx, [0.05, 2]), 0.6 + fx.rng() * 0.3, P.spark, P.main0, anchor, i * 0.05);
    p.vy = fx.motion ? 1.1 + fx.rng() * 0.8 : 0; p.drag = 0.8; p.spin = 2;
  }
}

// A painted flight loop flying from `a` to `b` in `flight` s, turned along the flight (travel points right in the sheet) and
// placed so the painted head (`head`, its x in the cell) rides the path; `cell` metres is the quad.
function flySprite(fx, name, a, b, flight, cell, head, anchor, delay) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, dist = Math.hypot(dx, dy, dz) || 1, back = (head - 0.5) * cell;
  const p = fx.sprites.take(name, a.x - dx / dist * back, a.y - dy / dist * back, a.z - dz / dist * back, cell, anchor, true);
  if (!p) return null;
  p.mode = 2; p.ax = dx / dist; p.ay = dy / dist; p.az = dz / dist; p.vx = dx / flight; p.vy = dy / flight; p.vz = dz / flight;
  p.life = flight; p.age = -delay; p.snap = true; p.fade = 0.05; p.keep = true;
  return p;
}

// Keeps a flying sprite within `limit` degrees of its painted (screen-horizontal travel) pose: the Halo's hoop is an upright
// ellipse, and turned toward the screen's vertical it would read as a ground selection ring. Travel to the left mirrors the
// sprite instead of turning it upside down.
function upright(fx, p, limit) {
  const cam = fx.view.camera;
  if (!cam?.matrixWorld) return;
  const m = cam.matrixWorld.elements, sx = p.ax * m[0] + p.ay * m[1] + p.az * m[2], sy = p.ax * m[4] + p.ay * m[5] + p.az * m[6];
  const mirror = sx < 0, a = Math.atan2(sy, mirror ? -sx : sx), max = (limit * Math.PI) / 180;
  p.mode = 0; p.sx = mirror ? -1 : 1; p.rot = (mirror ? -1 : 1) * Math.max(-max, Math.min(max, a));
}

export const KINDS = Object.freeze({ bolt, zigzag, strafe, crescent, hoops, beam, arc, orb, rocket, wisps, motes });

// ---- the stepped rounds
const P0 = { x: 0, y: 0, z: 0 }, P1 = { x: 0, y: 0, z: 0 };
function place(r, t, out) {
  out.x = r.from.x + (r.to.x - r.from.x) * t; out.z = r.from.z + (r.to.z - r.from.z) * t;
  out.y = r.from.y + (r.to.y - r.from.y) * t + r.arc * 4 * t * (1 - t);
  if (r.weave) {
    // A wisp curls around its line, widest mid-flight and closing onto the target.
    const env = Math.sin(t * Math.PI), w = r.weave * env, ph = t * Math.PI * 2.6 + r.phase;
    out.x += r.sx * Math.sin(ph) * w; out.z += r.sz * Math.sin(ph) * w; out.y += Math.cos(ph) * w * 0.5;
  }
  return out;
}
// Part `i` of a round, taken again from its pool when the cap recycled it (never on a still frame).
function part(fx, r, i, layer, dt) {
  const p = r.parts[i];
  if (p && p.owner === r.token) return p;
  if (!(dt > 0)) return null;
  const q = put(fx, layer, P0.x, P0.y, P0.z, r.anchor);
  q.owner = r.token; q.life = r.travel + 1; r.parts[i] = q;
  q.keep = i < 2; // the ball and its heart are the projectile (never trimmed); halo, tail and crackle are detail
  return q;
}
function release(r) {
  for (let i = 0; i < PARTS; i++) { const p = r.parts[i]; if (p && p.owner === r.token) { p.age = p.life; p.owner = 0; } r.parts[i] = null; }
  if (r.sprite && r.sprite.owner === r.token) { r.sprite.age = r.sprite.life; r.sprite.owner = 0; }
  r.sprite = null;
}
// Puts part `p` on (x, y, z) as a billboard of `cell` at visible size `v` in colour `c`, turned `rot`.
function billboard(p, x, y, z, cell, name, v, c, rot) {
  if (!p) return;
  p.x = x; p.y = y; p.z = z; p.mode = 0; p.cell = cell; p.s0 = p.s1 = quad(name, v); p.c0 = p.c1 = c; p.rot = rot;
}
// Puts part `p` along (ux, uy, uz) as a STRETCH sprite `length` long and `thick` thick, its centre `back` metres behind (x, y, z).
function stretch(p, x, y, z, ux, uy, uz, back, cell, name, length, thick, c) {
  if (!p) return;
  p.x = x - ux * back; p.y = y - uy * back; p.z = z - uz * back; p.mode = STRETCH; p.ax = ux; p.ay = uy; p.az = uz; p.length = length;
  p.cell = cell; p.s0 = p.s1 = quad(name, thick); p.c0 = p.c1 = c;
}

// The Codex flipbook (frames 0-7: the ball with its painted glow and tail, travel pointing right) draws the round; its painted
// head rides the round's path. The trail (drawOrb) still runs: black smoke off molten scrap, motes, wisps, arcs.
function paintedOrb(fx, r, dt, painted, ux, uy, uz, pulse) {
  const { L } = r, x = P0.x, y = P0.y, z = P0.z, b = r.body;
  const def = SHEET[L.sheet], cell = flightCell(fx, def), back = (def.head[0] - 0.5) * cell;
  let s = r.sprite;
  if ((!s || s.owner !== r.token) && dt > 0) {
    s = r.sprite = fx.sprites.take(painted, x, y, z, cell, r.anchor, true);
    if (s) { s.owner = r.token; s.keep = true; s.mode = 2; s.life = r.travel + 1; s.snap = true; s.age = fx.rng() * 0.4; s.hard = !!def.hard; }
  }
  if (s && s.owner === r.token) { s.x = x - ux * back; s.y = y - uy * back; s.z = z - uz * back; s.ax = ux; s.ay = uy; s.az = uz; s.s0 = s.s1 = cell; }
}
// The procedural orb: the outlined ball (normal blended) and its glow, and each style's own parts.
function proceduralOrb(fx, r, dt, ux, uy, uz, pulse, rot) {
  const { P, style } = r, x = P0.x, y = P0.y, z = P0.z, b = r.body;
  const core = part(fx, r, 1, fx.glow, dt), halo = part(fx, r, 2, fx.glow, dt);
  billboard(halo, x, y, z, CELL.glow, "glow", r.halo * (style === "void" ? 0.75 : 1), P.mainDim, 0);
  const body = part(fx, r, 0, fx.smoke, dt), extra = part(fx, r, 3, fx.glow, dt);
  if (style === "slug") {
    // A molten slug: a stretched outlined blob, white-hot at its nose, a short hot tail.
    stretch(body, x, y, z, ux, uy, uz, b * 0.55, CELL.dart, "dart", b * 2.6, b, P.main);
    billboard(core, x, y, z, CELL.glow, "glow", b * 0.6 * pulse, P.core, 0);
    stretch(extra, x, y, z, ux, uy, uz, r.tail * 0.5 + b * 0.3, CELL.streak, "streak", r.tail, b * 1.1, P.mainSoft);
  } else if (style === "void") {
    // A void orb: a dark ball inside a violet rim (outlined for snow, glowing for the night).
    billboard(body, x, y, z, CELL.orb, "orb", b, P.voidSolid || P.deep, 0);
    billboard(core, x, y, z, CELL.ring, "ring", b * 1.08 * pulse, P.main, rot);
    const rim = part(fx, r, 4, fx.smoke, dt);
    billboard(rim, x, y, z, CELL.ring, "ring", b * 1.08 * pulse, P.mainSolid, rot);
    stretch(extra, x, y, z, ux, uy, uz, r.tail * 0.5 + b * 0.3, CELL.streak, "streak", r.tail, b * 0.6, P.mainDim);
  } else if (style === "disc") {
    // A sun-disc: the rayed disc spinning, outlined, with its own glow on top.
    billboard(body, x, y, z, CELL.sundisc, "sundisc", b * pulse, P.main, rot);
    billboard(extra, x, y, z, CELL.sundisc, "sundisc", b * pulse, P.mainSoft, rot);
    billboard(core, x, y, z, CELL.glow, "glow", b * 0.3, P.core, 0);
  } else {
    // A plasma ball, a scrap ball or an electric shock ball: the outlined ball, its white-hot heart and (plasma) a comet tail.
    billboard(body, x, y, z, CELL.orb, "orb", b * pulse, P.main, rot);
    billboard(core, x, y, z, CELL.glow, "glow", b * 0.42, P.core, 0);
    if (style === "electric") {
      // The crackle round it, twice: blue lines (normal blended, for snow) and their pale light, flickering together.
      const lines = part(fx, r, 4, fx.smoke, dt);
      for (const [p, c] of [[extra, P.mainSoft], [lines, P.main]]) {
        if (!p) continue;
        billboard(p, x, y, z, CELL.crackle, "crackle", b * 1.75, c, r.roll);
        p.frames = 2; p.fps = 24; p.jump = 2.4;
      }
    } else {
      // The comet tail: a coloured streak (normal blended) under its light.
      const back = r.tail * 0.5 + b * 0.15;
      stretch(part(fx, r, 4, fx.smoke, dt), x, y, z, ux, uy, uz, back, CELL.dart, "dart", r.tail, b * 0.55, P.main);
      stretch(extra, x, y, z, ux, uy, uz, back, CELL.streak, "streak", r.tail * 1.05, b * 0.9, style === "scrap" ? P.mainSoft : P.main);
    }
  }
}
// One frame of an orb in flight: its parts on the ball (pulsing, spinning, crackling), its trail.
function drawOrb(fx, r, dt, ux, uy, uz) {
  const { P, style, L } = r, x = P0.x, y = P0.y, z = P0.z, b = r.body;
  const pulse = 1 + (L.pulse || 0.08) * Math.sin(r.age * 38 + r.phase), rot = r.roll + r.spin * r.age;
  const painted = sheet(fx, L.sheet);
  if (painted) paintedOrb(fx, r, dt, painted, ux, uy, uz, pulse);
  else proceduralOrb(fx, r, dt, ux, uy, uz, pulse, rot);
  if (!fx.motion || !(dt > 0)) return;
  // The trail.
  r.trail += dt;
  const eco = fx.view.lowPower, gap = (style === "slug" || style === "scrap" ? 0.028 : 0.04) * (eco ? 1.6 : 1);
  while (r.trail > gap) {
    r.trail -= gap;
    r.trail2++;
    const bx = x - ux * b * 0.8, by = y - uy * b * 0.8, bz = z - uz * b * 0.8;
    if (style === "slug" || style === "scrap") {
      // Black smoke rolling off molten scrap, flames licking off a burning ball, now and then an ember dripping.
      const q = put(fx, fx.smoke, bx, by, bz, r.anchor);
      q.cell = CELL.puff; q.s0 = quad("puff", b * 0.6); q.s1 = quad("puff", b * 2); q.life = (0.55 + fx.rng() * 0.2) * (eco ? 0.6 : 1); q.c0 = P.smokeSoft; q.c1 = P.smoke0;
      q.vy = 0.45; q.drag = 1.2; q.spin = 0.6; q.rot = fx.rng() * 6.28;
      if (style === "scrap" && r.trail2 % 2 === 0) {
        const f = put(fx, fx.glow, x + (fx.rng() - 0.5) * b * 0.6, y + (fx.rng() - 0.5) * b * 0.6, z + (fx.rng() - 0.5) * b * 0.6, r.anchor);
        f.cell = CELL.puff; f.s0 = quad("puff", b * 0.9); f.s1 = quad("puff", b * 0.3); f.life = 0.22; f.c0 = P.main; f.c1 = P.main0; f.vy = 1; f.spin = 2; f.rot = fx.rng() * 6.28;
      }
      if (r.trail2 % 3 === 0) {
        const e = put(fx, fx.glow, bx, by, bz, r.anchor);
        e.cell = CELL.glow; e.s0 = quad("glow", b * 0.45); e.s1 = quad("glow", b * 0.1); e.life = 0.4; e.c0 = P.spark; e.c1 = P.main0;
        e.vx = (fx.rng() - 0.5) * 0.8; e.vy = -0.5; e.vz = (fx.rng() - 0.5) * 0.8; e.gravity = 6;
      }
    } else if (style === "electric") {
      // Little arcs snapping off the ball.
      const a = fx.rng() * 6.28, e = (fx.rng() - 0.3) * 1.2, l = b * (1.3 + fx.rng() * 0.8);
      const q = put(fx, fx.glow, x + Math.cos(a) * l * 0.5, y + e * l * 0.4, z + Math.sin(a) * l * 0.5, r.anchor);
      const n = Math.hypot(Math.cos(a), e * 0.8, Math.sin(a)) || 1;
      q.mode = STRETCH; q.ax = Math.cos(a) / n; q.ay = e * 0.8 / n; q.az = Math.sin(a) / n; q.length = l; q.cell = CELL.bolt; q.frame = Math.floor(fx.rng() * 4);
      q.s0 = q.s1 = quad("bolt", b * 0.5); q.life = 0.06; q.c0 = P.spark; q.c1 = P.main;
    } else {
      // Motes shed by plasma, glimmers by a sun-disc, violet wisps and shards by a void orb.
      const q = put(fx, fx.glow, bx + (fx.rng() - 0.5) * b * 0.4, by + (fx.rng() - 0.5) * b * 0.4, bz + (fx.rng() - 0.5) * b * 0.4, r.anchor);
      const cell = style === "disc" ? CELL.starburst : style === "void" && r.trail2 % 3 === 0 ? CELL.shard : CELL.glow;
      q.cell = cell; q.s0 = quad(cell === CELL.starburst ? "starburst" : cell === CELL.shard ? "shard" : "glow", b * 0.5); q.s1 = q.s0 * 0.2;
      q.life = style === "void" ? 0.34 : 0.26; q.c0 = style === "void" ? P.mainSoft : P.main; q.c1 = P.main0;
      q.vy = 0.3; q.drag = 1.5; q.spin = (fx.rng() - 0.5) * 4; q.rot = fx.rng() * 6.28;
    }
  }
}
function drawRocket(fx, r, dt, ux, uy, uz, seen) {
  const { P, L } = r, x = P0.x, y = P0.y, z = P0.z, u = fx.view.unitsPerPixel || 0.05, bodyScale = Math.min(1.8, Math.max(1, 24 * u / 1.86));
  r.roll += ROCKET.spin * dt;
  const tail = 0.62 * bodyScale * SHOT_SCALE + 10 * u;
  if (seen) {
    // The painted head (src/fx-sprites.js `heads`, tinted toward the faction) once the sheets have loaded, else the finned body
    // (one instanced draw for every rocket, src/fx-kinds/rocket-body.js) with its band in the faction's colour.
    const head = spritesReady(fx) && fx.sprites.take("heads", x, y, z, 20 * u, r.anchor, true);
    if (head) {
      head.sx = 1.5; head.r = 0.7 + P.main[0] * 0.8; head.g = 0.7 + P.main[1] * 0.8; head.b = 0.7 + P.main[2] * 0.8;
      head.mode = 2; head.ax = ux; head.ay = uy; head.az = uz; head.a = 0.95; head.start = L.headFrame ?? HEAD_FRAME.rocket; head.count = 1; head.fps = 0; head.once = true; head.life = 1; head.fade = 0.0001; head.age = 0;
    } else fx.rockets.add(x, y, z, ux, uy, uz, r.roll, bodyScale * SHOT_SCALE, P.main);
  }
  const hx = x - ux * tail, hy = y - uy * tail, hz = z - uz * tail;
  billboard(part(fx, r, 0, fx.glow, dt), hx, hy, hz, CELL.glow, "glow", size(fx, [0.4, 11]), P.mainSoft, 0);
  billboard(part(fx, r, 1, fx.glow, dt), hx, hy, hz, CELL.glow, "glow", size(fx, [0.18, 5]), P.core, 0);
  if (L.exhaust === "ring") {
    // Meridian: a glowing ring of exhaust behind the rocket, breathing.
    const v = size(fx, [0.32, 9]) * (1 + 0.15 * Math.sin(r.age * 50));
    billboard(part(fx, r, 2, fx.smoke, dt), hx, hy, hz, CELL.ring, "ring", v, P.main, 0);
    billboard(part(fx, r, 3, fx.glow, dt), hx, hy, hz, CELL.ring, "ring", v, P.core, 0);
  }
  if (!fx.motion || !(dt > 0) || fx.budget < 1) return;
  r.trail += dt;
  const gap = L.trail === "smoke" ? 0.03 : 0.028;
  while (r.trail > gap) {
    r.trail -= gap;
    if (L.trail === "smoke") {
      const q = put(fx, fx.smoke, hx, hy, hz, r.anchor);
      q.cell = CELL.puff; q.s0 = 0.25; q.s1 = 1.1; q.life = 0.6 + fx.rng() * 0.2; q.c0 = P.smokeSoft; q.c1 = P.smoke0; q.vy = 0.35; q.drag = 1.2; q.spin = 0.6; q.rot = fx.rng() * 6.28;
    } else if (L.trail === "crackle") {
      const q = put(fx, fx.glow, hx, hy, hz, r.anchor), a = fx.rng() * 6.28, l = size(fx, [0.5, 12]);
      let ax = -ux * 0.6 + Math.cos(a) * 0.4, ay = -uy * 0.6 + 0.2, az = -uz * 0.6 + Math.sin(a) * 0.4;
      const n = Math.hypot(ax, ay, az) || 1; ax /= n; ay /= n; az /= n;
      q.mode = STRETCH; q.ax = ax; q.ay = ay; q.az = az; q.length = l; q.cell = CELL.bolt; q.frame = Math.floor(fx.rng() * 4); q.s0 = q.s1 = quad("bolt", size(fx, [0.16, 5])); q.life = 0.07; q.c0 = P.spark; q.c1 = P.main;
    } else {
      // A glowing ribbon of motes: cyan, gold sparkles or violet wisps.
      const q = put(fx, fx.glow, hx, hy, hz, r.anchor), cell = L.trail === "sparkle" ? CELL.starburst : CELL.glow;
      q.cell = cell; q.s0 = quad(cell === CELL.starburst ? "starburst" : "glow", size(fx, [0.22, 6])); q.s1 = q.s0 * 0.2; q.life = 0.32; q.c0 = P.mainSoft; q.c1 = P.main0;
      q.vy = 0.25; q.drag = 1.4; q.spin = 3; q.rot = fx.rng() * 6.28;
    }
  }
}
function drawWisp(fx, r, dt) {
  const { P } = r, x = P0.x, y = P0.y, z = P0.z, b = r.body;
  billboard(part(fx, r, 0, fx.smoke, dt), x, y, z, CELL.orb, "orb", b, P.main, 0);
  billboard(part(fx, r, 1, fx.glow, dt), x, y, z, CELL.glow, "glow", b * 1.6, P.mainSoft, 0);
  billboard(part(fx, r, 2, fx.glow, dt), x, y, z, CELL.glow, "glow", b * 0.32, P.core, 0);
  if (!fx.motion || !(dt > 0)) return;
  r.trail += dt;
  while (r.trail > 0.022) {
    r.trail -= 0.022;
    const q = put(fx, fx.glow, x, y, z, r.anchor);
    q.cell = CELL.glow; q.s0 = quad("glow", b); q.s1 = quad("glow", b * 0.1); q.life = 0.3; q.c0 = P.mainSoft; q.c1 = P.main0; q.vy = 0.2; q.drag = 1;
  }
}

export function stepSignatures(fx, dt, visible) {
  const S = fx.sig;
  if (!S || !S.rounds.length) return;
  const rounds = S.rounds;
  let keep = 0;
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    if (r.wait > 0) { if (dt > 0) r.wait -= dt; rounds[keep++] = r; continue; }
    r.age += dt;
    const t = Math.min(1, r.age / r.travel);
    place(r, t, P1); place(r, t < 0.98 ? t + 0.02 : t - 0.02, P0);
    let ux = P0.x - P1.x, uy = P0.y - P1.y, uz = P0.z - P1.z;
    if (t >= 0.98) { ux = -ux; uy = -uy; uz = -uz; }
    const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    place(r, t, P0);
    const seen = visible(r.anchor);
    if (t < 1) {
      if (r.cls === "rocket") drawRocket(fx, r, dt, ux, uy, uz, seen);
      else if (r.cls === "wisp") drawWisp(fx, r, dt);
      else drawOrb(fx, r, dt, ux, uy, uz);
      rounds[keep++] = r;
      continue;
    }
    // Landed: the parts go back to their pools and the faction's impact plays where it hit.
    release(r);
    if (seen && r.o) {
      const o = r.o, ground = { x: r.land.x, y: r.land.y + fx.ground(r.land.x, r.land.z), z: r.land.z };
      // A rocket's blast follows what it hits: bigger on armour (as src/fx.js rocketImpact).
      if (r.cls === "rocket") o.s = Math.max(0.45, Math.min(r.armour ? 0.9 : 0.55, o.s));
      (IMPACTS[r.L.impact] || IMPACTS.pop)(fx, o.aloft || o.direct ? r.to : ground, o);
    }
    r.anchor = null; r.o = null; r.L = null; r.P = null;
    S.free.push(r);
  }
  rounds.length = keep;
}
export function clearSignatures(fx) {
  const S = fx.sig;
  if (!S) return;
  for (const r of S.rounds) { release(r); r.anchor = null; r.o = null; S.free.push(r); }
  S.rounds.length = 0;
}
export const liveSignatures = (fx) => fx.sig?.rounds.length || 0;
