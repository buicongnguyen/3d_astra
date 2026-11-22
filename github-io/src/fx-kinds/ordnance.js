// The flights of the heavy weapon classes (AAA round 3, R3-X): shells, artillery lobs, flak rounds, missiles and
// bombs. Each round is a pooled record in `fx.rounds` (records are reused: no allocation per shot once warm),
// drawn as one instance of the ordnance mesh (src/fx-kinds/ordnance-body.js, one draw for every round in flight)
// with a pooled glow halo and a trail from the smoke pool. A round lands exactly `travel` seconds after the shot
// event, the moment the target's hit flash is timed to (src/view.js flashWait), so the visible damage and the
// visible impact coincide. A round that already killed its target lands sooner (CLASS_LOOK.quick).
// The Barrage's falling shell is drawn from the simulation's own strike list (sim.strikes, read only), so it
// meets the ground on the tick the strike resolves.
import { CELL, STRETCH, GROUND } from "./cells.js";
import { CLASS_LOOK } from "./weapon-class.js";
import { spriteImpact, spriteTrailPuff, spritesReady } from "./sprite-fx.js";
import { impactKind } from "../fx-sprites-data.js";

// Per-instance colours of the bodies (above 1 glows) and the trail / halo / burst palettes (shared arrays).
export const BODY = Object.freeze({
  shell: [3, 2.1, 1.1], lob: [1.9, 1.25, 0.7], flak: [2.4, 1.7, 0.9], missile: [1.8, 1.75, 1.6],
  bomb: [0.34, 0.32, 0.31], firebomb: [2.4, 1.05, 0.3], barrage: [2.1, 1.3, 0.7],
});
const PAL = {
  halo: [1, 0.72, 0.32, 0.95], haloHot: [1, 0.86, 0.55, 1], haloMissile: [1, 0.9, 0.7, 1],
  shellSmoke: [0.42, 0.4, 0.38, 0.72], shellSmokeEnd: [0.55, 0.54, 0.53, 0],
  lobSmoke: [0.5, 0.48, 0.46, 0.55], lobSmokeEnd: [0.55, 0.55, 0.55, 0],
  ribbon: [0.95, 0.94, 0.9, 0.7], ribbonEnd: [0.8, 0.8, 0.8, 0],
  ember: [1, 0.7, 0.3, 1], emberEnd: [1, 0.3, 0.05, 0],
  flakBlack: [0.07, 0.065, 0.06, 0.88], flakBlackEnd: [0.22, 0.21, 0.2, 0], flakFire: [1, 0.62, 0.2, 1], flakFireEnd: [1, 0.3, 0.05, 0],
  flash: [1, 0.97, 0.88, 1], flashEnd: [1, 0.6, 0.2, 0], calm: [1, 0.8, 0.5, 0.45], calmEnd: [1, 0.6, 0.3, 0],
  ring: [1, 0.86, 0.55, 0.8], ringEnd: [1, 0.6, 0.2, 0], scorchRing: [0.05, 0.04, 0.035, 0.6], scorchRingEnd: [0.05, 0.04, 0.035, 0],
  shadow: [0.02, 0.02, 0.03, 0.12], shadowEnd: [0.02, 0.02, 0.03, 0.6],
  warn: [0.95, 0.1, 0.05, 0.85], warnEnd: [0.95, 0.15, 0.06, 0], warnHold: [0.9, 0.12, 0.06, 0.9], warnWash: [0.95, 0.14, 0.05, 0.42], warnHoldEnd: [0.9, 0.12, 0.06, 0],
  spark: [1, 0.92, 0.65, 1], sparkEnd: [1, 0.45, 0.12, 0],
};

const P = { x: 0, y: 0, z: 0 }, Q = { x: 0, y: 0, z: 0 }; // scratch points (module-level: no allocation per frame)

// A pooled round, reset to defaults (every field set in one order, so the records keep one shape).
export function takeRound(fx) {
  const r = fx.roundFree.pop() || { from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, land: { x: 0, y: 0, z: 0 } };
  r.cls = ""; r.travel = 1; r.age = 0; r.wait = 0; r.arc = 0; r.weave = 0; r.phase = 0; r.sx = 0; r.sz = 0; r.drop = false; r.body = 1; r.grow = 0;
  r.color = BODY.shell; r.halo = null; r.haloSize = 0; r.haloColor = PAL.halo; r.token = 0; r.trail = 0; r.power = 0; r.anchor = null; r.air = false;
  r.fire = false; r.roll = 0; r.spin = 0; r.team = 0;
  fx.rounds.push(r);
  return r;
}
const copy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };

// Launch a round of class `cls` along the aim `a` (src/fx-kinds/common.js). `o` overrides: { travel, delay, side, body, color }.
export function launch(fx, cls, a, ev, o = null) {
  const r = takeRound(fx), look = CLASS_LOOK[cls] || CLASS_LOOK.shell, side = o?.side || 0;
  r.cls = cls; copy(r.from, a.from); copy(r.to, a.to); copy(r.land, a.land);
  if (side) { r.from.x += a.sx * side; r.from.z += a.sz * side; r.to.x += a.sx * side; r.to.z += a.sz * side; r.land.x += a.sx * side; r.land.z += a.sz * side; }
  const target = ev?.target != null ? fx.frameSim?.get?.(ev.target) : null, killed = ev?.target != null && !(target && target.hp > 0);
  r.travel = o?.travel ?? a.travel;
  if (killed) r.travel = Math.min(r.travel, CLASS_LOOK.quick);
  r.wait = o?.delay || 0;
  const len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z);
  r.arc = Math.min(look.arcMax ?? 0, len * (look.arc ?? 0));
  r.body = o?.body ?? look.body ?? 1;
  r.color = o?.color || BODY[cls] || BODY.shell;
  r.haloSize = look.halo ?? 0; r.haloColor = cls === "missile" ? PAL.haloMissile : cls === "shell" ? PAL.haloHot : PAL.halo;
  r.power = a.power; r.anchor = a.anchor; r.air = !!ev?.tAir; r.team = ev?.team ?? 0;
  r.sx = a.sx ?? 0; r.sz = a.sz ?? 0;
  r.roll = fx.rng() * 6.28; r.spin = cls === "missile" ? 9 : cls === "bomb" ? 1.5 : 4;
  if (cls === "missile") { r.weave = look.weave * Math.min(1, len / 6); r.phase = o?.phase ?? fx.rng() * 6.28; }
  if (cls === "bomb") { r.drop = true; r.grow = look.grow; r.fire = !!o?.fire; if (r.fire) r.color = BODY.firebomb; r.spin = 0.8; }
  return r;
}

// Where a round is at flight fraction t (0..1), into `out`.
export function place(r, t, out) {
  out.x = r.from.x + (r.to.x - r.from.x) * t;
  out.z = r.from.z + (r.to.z - r.from.z) * t;
  // A dropped bomb falls faster and faster; everything else follows a parabola over the straight line.
  out.y = r.drop ? r.from.y + (r.to.y - r.from.y) * t * t : r.from.y + (r.to.y - r.from.y) * t + r.arc * 4 * t * (1 - t);
  if (r.weave) {
    // A missile corkscrews around its line, widest mid-flight and closing onto the target.
    const env = Math.sin(t * Math.PI), w = r.weave * env, ph = t * Math.PI * 3.2 + r.phase;
    out.x += r.sx * Math.sin(ph) * w; out.z += r.sz * Math.sin(ph) * w; out.y += Math.cos(ph) * w * 0.55;
  }
  return out;
}

// One frame of every round: move, draw the body, keep the halo on it, lay the trail, land.
export function stepRounds(fx, dt, visible) {
  const rounds = fx.rounds, eco = fx.view.lowPower, m = fx.motion;
  let keep = 0;
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    if (r.wait > 0) { r.wait -= dt; rounds[keep++] = r; continue; }
    r.age += dt;
    const t = Math.min(1, r.age / r.travel);
    place(r, t, P);
    place(r, t < 0.98 ? t + 0.02 : t - 0.02, Q);
    let ux = Q.x - P.x, uy = Q.y - P.y, uz = Q.z - P.z;
    if (t >= 0.98) { ux = -ux; uy = -uy; uz = -uz; }
    const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    const seen = visible(r.anchor);
    if (t < 1) {
      r.roll += r.spin * dt;
      const length = r.body * fx.bodyScale * (1 + r.grow * t);
      if (seen) fx.ordnance.add(P.x, P.y, P.z, ux, uy, uz, r.roll, length, r.color);
      if (r.haloSize > 0 || r.fire) {
        let h = r.halo;
        if (!h || h.owner !== r.token) {
          h = r.halo = fx.emit(fx.glow, P.x, P.y, P.z, r.anchor, true);
          h.life = r.travel + 1; h.s0 = h.s1 = r.fire ? 1.1 : r.haloSize;
          h.c0 = h.c1 = r.fire ? PAL.halo : r.haloColor;
          h.owner = r.token = ++fx.rocketTokens; // one token counter with the rockets: halo owners never collide
        }
        const back = length * 0.45;
        h.x = P.x - ux * back; h.y = P.y - uy * back; h.z = P.z - uz * back;
      }
      if (m && dt > 0) trail(fx, r, dt, eco, ux, uy, uz, length);
      rounds[keep++] = r;
      continue;
    }
    // Landed.
    if (r.halo && r.halo.owner === r.token) { r.halo.age = r.halo.life; r.halo.owner = 0; }
    r.halo = null;
    if (seen) landRound(fx, r, ux, uz);
    r.anchor = null;
    fx.roundFree.push(r);
  }
  rounds.length = keep;
}

function trail(fx, r, dt, eco, ux, uy, uz, length) {
  const look = CLASS_LOOK[r.cls], cls = r.cls;
  const sprite = spritesReady(fx) && cls !== "bomb";
  const gap = cls === "bomb" ? (r.fire ? 0.05 : 0) : sprite ? (cls === "missile" ? 0.045 : 0.05) * (eco ? 1.7 : 1) : (look?.trailGap || 0) * (eco ? 1.6 : 1);
  if (!gap) return;
  r.trail += dt;
  const lifeK = eco ? CLASS_LOOK.ecoTrail : 1, tail = length * 0.5;
  while (r.trail > gap) {
    r.trail -= gap;
    if (r.fire) {
      // A burning bomb sheds embers.
      const e = fx.emit(fx.glow, P.x - ux * tail, P.y - uy * tail, P.z - uz * tail, r.anchor, true);
      e.vx = (fx.rng() - 0.5) * 0.8; e.vy = 0.6; e.vz = (fx.rng() - 0.5) * 0.8; e.drag = 1.2; e.life = 0.4 * lifeK; e.s0 = 0.18; e.s1 = 0.04;
      e.cell = CELL.flare; e.c0 = PAL.ember; e.c1 = PAL.emberEnd;
      continue;
    }
    // R3-FX: a shell, lob or missile trails smoke-trail sprite puffs (the first sheet to read at phone size), fewer and bigger; Eco shortens them.
    if (spritesReady(fx) && cls !== "bomb") {
      const size = (cls === "missile" ? 1.15 : cls === "lob" ? 1.5 : 1.75) * Math.max(1, fx.bodyScale * 0.9);
      spriteTrailPuff(fx, P.x - ux * tail, P.y - uy * tail, P.z - uz * tail, size, (cls === "missile" ? 0.7 : 1) * (eco ? 0.55 : 1), r.anchor, cls === "missile" ? 0.7 : 0.8);
      continue;
    }
    const q = fx.emit(fx.smoke, P.x - ux * tail, P.y - uy * tail, P.z - uz * tail, r.anchor, true);
    if (cls === "missile") {
      // A thin ribbon: soft stretched segments laid along the corkscrew, so the curl stays in the air behind it.
      q.vy = 0.15; q.drag = 1.6; q.life = look.trailLife * lifeK; q.s0 = 0.09; q.s1 = 0.3; q.cell = CELL.glow;
      q.mode = STRETCH; q.ax = ux; q.ay = uy; q.az = uz; q.length = 0.55; q.c0 = PAL.ribbon; q.c1 = PAL.ribbonEnd;
    } else {
      const lob = cls === "lob";
      // A shell's trail is long and thick (owner 2026-11-22); Eco keeps it shorter through lifeK and the wider gap.
      q.vy = 0.25; q.drag = 1.2; q.life = (look.trailLife + fx.rng() * 0.15) * lifeK; q.s0 = lob ? 0.3 : 0.3; q.s1 = lob ? 1.05 : 1.2;
      q.cell = CELL.puff; q.c0 = lob ? PAL.lobSmoke : PAL.shellSmoke; q.c1 = lob ? PAL.lobSmokeEnd : PAL.shellSmokeEnd; q.spin = 0.6;
    }
  }
}

// A pooled glow or smoke sprite at a point (y already includes the ground), the allocation-free path.
function sprite(fx, layer, x, y, z, anchor, cell, s0, s1, life, c0, c1, delay = 0) {
  const p = fx.emit(layer, x, y, z, anchor, true);
  p.cell = cell; p.s0 = s0; p.s1 = s1; p.life = life; p.c0 = c0; p.c1 = c1; p.age = -delay;
  return p;
}

// Black and orange flak puffs bursting around a flyer: the first exactly at the hit, the rest a beat later.
export function flakBurst(fx, at, anchor, n = CLASS_LOOK.flak.bursts, spread = CLASS_LOOK.flak.spread, power = 1) {
  const calm = !fx.motion, sheets = spritesReady(fx);
  for (let i = 0, count = Math.max(1, Math.round(n * fx.budget)); i < count; i++) {
    const a = fx.rng() * 6.28, d = i ? spread * (0.6 + fx.rng() * 0.5) : 0, delay = i * 0.08;
    const x = at.x + Math.cos(a) * d, y = at.y + (i ? (fx.rng() - 0.3) * spread : 0), z = at.z + Math.sin(a) * d;
    // R3-FX: the flak-burst sheet (a cluster of soot puffs with orange flashes): the first at the hit, the next ones a beat later and smaller.
    if (sheets && spriteImpact(fx, "flak", { x, y: y - fx.ground(x, z), z }, power, anchor, delay, i ? 0.7 : 1)) continue;
    sprite(fx, fx.glow, x, y, z, anchor, CELL.flare, 2 * power, 2.6 * power, 0.14, calm ? PAL.calm : PAL.flakFire, calm ? PAL.calmEnd : PAL.flakFireEnd, delay);
    const s = sprite(fx, fx.smoke, x, y, z, anchor, CELL.puff, 0.8 * power, 2.4 * power, 1.2 + fx.rng() * 0.4, PAL.flakBlack, PAL.flakBlackEnd, delay);
    s.drag = 1.5; s.vy = calm ? 0 : 0.35; s.spin = (fx.rng() - 0.5) * 1.2; s.fadeIn = 0.04;
  }
}

// A sharp burst in the air (a missile meeting a flyer): a white star, a quick ring, sparks and a dark puff. No ground marks.
export function airBurst(fx, at, anchor, power = 1) {
  const calm = !fx.motion;
  // R3-FX: the flak-burst sheet is the burst (a missile or shell meeting a flyer); the sparks below stay.
  const sheet = spriteImpact(fx, "flak", { x: at.x, y: at.y - fx.ground(at.x, at.z), z: at.z }, power, anchor, 0, 0.85);
  if (!sheet) sprite(fx, fx.glow, at.x, at.y, at.z, anchor, CELL.flare, 2.4 * power, 3 * power, 0.1, calm ? PAL.calm : PAL.flash, calm ? PAL.calmEnd : PAL.flashEnd);
  if (!calm && !sheet) sprite(fx, fx.glow, at.x, at.y, at.z, anchor, CELL.ring, 0.4, 2.6 * power, 0.2, PAL.ring, PAL.ringEnd);
  if (!sheet) { const s = sprite(fx, fx.smoke, at.x, at.y, at.z, anchor, CELL.puff, 0.5, 1.5 * power, 0.9, PAL.flakBlack, PAL.flakBlackEnd, 0.03); s.drag = 1.5; s.vy = calm ? 0 : 0.3; }
  if (calm) return;
  for (let i = 0, n = fx.count(6); i < n; i++) {
    const a = fx.rng() * 6.28, e = fx.rng() * 0.8 + 0.2, v = 4 + fx.rng() * 5;
    const vx = Math.cos(a) * e * v, vy = (fx.rng() - 0.3) * v * 0.7, vz = Math.sin(a) * e * v, l = Math.hypot(vx, vy, vz) || 1;
    const p = sprite(fx, fx.glow, at.x, at.y, at.z, anchor, CELL.streak, 0.06, 0.03, 0.22 + fx.rng() * 0.2, PAL.spark, PAL.sparkEnd);
    p.vx = vx; p.vy = vy; p.vz = vz; p.gravity = 10; p.drag = 1.5; p.mode = STRETCH; p.ax = vx / l; p.ay = vy / l; p.az = vz / l; p.length = 0.35;
  }
}

// A shell's extra impact (R3-X, owner 2026-11-22): a big star flash (soft and warm with reduced motion) and a ring of
// sparks thrown out flat around the hit, from the glow pool.
const RING_SPARKS = 10;
function shellImpact(fx, at, anchor) {
  const calm = !fx.motion, y = at.y + fx.ground(at.x, at.z) + 0.4;
  sprite(fx, fx.glow, at.x, y, at.z, anchor, CELL.flare, 5.2, 6.2, 0.13, calm ? PAL.calm : PAL.flash, calm ? PAL.calmEnd : PAL.flashEnd);
  if (calm) return;
  shellSparks(fx, at, anchor);
}
function shellSparks(fx, at, anchor) {
  const y = at.y + fx.ground(at.x, at.z) + 0.4;
  for (let i = 0, n = fx.count(RING_SPARKS); i < n; i++) {
    const a = (i / n) * 6.28 + fx.rng() * 0.4, v = 6 + fx.rng() * 3, vx = Math.cos(a) * v, vz = Math.sin(a) * v, vy = 1 + fx.rng() * 1.5, l = Math.hypot(vx, vy, vz);
    const p = sprite(fx, fx.glow, at.x, y, at.z, anchor, CELL.streak, 0.09, 0.04, 0.3 + fx.rng() * 0.15, PAL.spark, PAL.sparkEnd);
    p.vx = vx; p.vy = vy; p.vz = vz; p.gravity = 12; p.drag = 1.8; p.mode = STRETCH; p.ax = vx / l; p.ay = vy / l; p.az = vz / l; p.length = 0.55; p.floor = 0.05;
  }
}

// A dark scorch ring opening on the ground around a heavy impact (normal blended, in the decal pool).
function scorchRing(fx, x, z, size, anchor) {
  const p = fx.emit(fx.decals, x, 0.06, z, anchor);
  p.mode = GROUND; p.cell = CELL.ring; p.s0 = size * 0.4; p.s1 = size; p.life = 2.4; p.hold = 0.35; p.c0 = PAL.scorchRing; p.c1 = PAL.scorchRingEnd; p.rot = fx.rng() * 6.28;
}

export function landRound(fx, r, ux, uz) {
  const at = r.air ? r.to : r.land, anchor = r.anchor;
  switch (r.cls) {
    case "flak": flakBurst(fx, r.to, anchor); return;
    case "missile": if (r.air) { airBurst(fx, r.to, anchor, 0.8); return; } fx.hit(at, r.power, anchor, "rocket"); return;
    case "bomb": {
      fx.hit(r.land, r.power, anchor, r.fire ? "firebomb" : "bomb");
      if (r.fire && fx.motion) for (let i = 0, n = fx.count(5); i < n; i++) {
        const p = sprite(fx, fx.glow, r.land.x, r.land.y + 0.4, r.land.z, anchor, CELL.glow, 0.9, 0.2, 0.5 + fx.rng() * 0.3, PAL.flakFire, PAL.flakFireEnd);
        p.vx = (fx.rng() - 0.5) * 3; p.vy = 1.2 + fx.rng() * 1.6; p.vz = (fx.rng() - 0.5) * 3; p.drag = 1.4;
      }
      fx.dust({ x: r.land.x, y: 0.3, z: r.land.z }, 3, anchor, 1.2, 1.2);
      return;
    }
    default: {
      // shell, artillery: the heavy hit, a bright ring and a scorch ring; in the air (a shell at a flyer) a burst instead.
      if (r.air) { airBurst(fx, r.to, anchor, 0.7); return; }
      fx.hit(at, r.power, anchor, impactKind(r.cls) || "shell");
      // R3-FX: with the sheets loaded the blast, its shockwave and the scorch are the sprite and its decal (fx.hit); no extra flash or ring on top.
      if (spritesReady(fx)) { if (r.cls === "shell" && fx.motion) shellSparks(fx, at, anchor); if (r.cls === "lob") fx.dust({ x: at.x, y: 0.3, z: at.z }, 2, anchor, 1.3, 1.3); return; }
      if (fx.motion) sprite(fx, fx.glow, at.x, at.y + 0.3, at.z, anchor, CELL.ring, 0.5, r.cls === "lob" ? 4.2 : 4.4, 0.24, PAL.ring, PAL.ringEnd);
      if (r.cls === "shell") shellImpact(fx, at, anchor);
      scorchRing(fx, at.x, at.z, r.cls === "lob" ? 4.4 : 4.2, anchor);
      if (r.cls === "lob") fx.dust({ x: at.x, y: 0.3, z: at.z }, 2, anchor, 1.3, 1.3);
    }
  }
}

// Where a bomb will land: a shadow dot that grows darker as the bomb falls onto it.
export function shadowDot(fx, x, z, life, anchor, delay = 0) {
  const p = fx.emit(fx.decals, x, 0.07, z, anchor);
  p.mode = GROUND; p.cell = CELL.glow; p.s0 = 0.35; p.s1 = 1.2; p.life = life; p.c0 = PAL.shadow; p.c1 = PAL.shadowEnd; p.age = -delay;
  return p;
}

// A red warning ring where an artillery round will land (`life` seconds): rings closing in on the spot, and a
// steady faint ring under them. Reduced motion keeps only the steady ring (no flashing).
export function warnRing(fx, x, z, radius, life, anchor, rings = 1) {
  const steady = fx.emit(fx.decals, x, 0.12, z, anchor); // normal blended: a red that reads on pale sand too
  steady.mode = GROUND; steady.cell = CELL.ring; steady.s0 = steady.s1 = radius * 2.5; steady.life = life; steady.hold = 0.85; steady.c0 = PAL.warnHold; steady.c1 = PAL.warnHoldEnd;
  // A soft red wash over the whole danger zone, so the warning reads at phone zoom over any other ring.
  const wash = fx.emit(fx.decals, x, 0.11, z, anchor);
  wash.mode = GROUND; wash.cell = CELL.glow; wash.s0 = radius * 2.1; wash.s1 = radius * 2.4; wash.life = life; wash.hold = 0.9; wash.c0 = PAL.warnWash; wash.c1 = PAL.warnHoldEnd;
  if (!fx.motion) return;
  for (let i = 0; i < rings; i++) {
    const p = fx.emit(fx.decals, x, 0.13, z, anchor), each = life / rings;
    p.mode = GROUND; p.cell = CELL.ring; p.s0 = radius * 3.6; p.s1 = radius * 2.3; p.life = each; p.hold = 0.4; p.c0 = PAL.warn; p.c1 = PAL.warnEnd; p.age = -i * each;
  }
}

// The Barrage's shells (sim.strikes): a red warning when a strike is first seen, then, in its last `fall`
// seconds, a big glowing round dropping out of the sky onto the mark with a smoke trail. Fog as the strike
// marks (src/tactics-view.js): only strikes on ground in sight.
export function stepStrikes(fx, sim, dt) {
  const strikes = sim.strikes;
  if (!strikes?.length) return;
  const look = CLASS_LOOK.barrage, eco = fx.view.lowPower;
  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i];
    if (!sim.isVisible?.(s)) continue;
    const left = s.at - sim.time;
    let st = fx.strikeState.get(s);
    if (!st) {
      fx.strikeState.set(s, (st = { trail: 0, anchor: { x: s.x, z: s.z, team: s.team } }));
      if (left > 0) warnRing(fx, s.x, s.z, s.radius || 4, left, st.anchor, look.rings);
    }
    if (!(left > 0) || left > look.fall) continue;
    const k = left / look.fall; // 1 at the top of the fall, 0 at the ground
    const by = s.by != null ? sim.get?.(s.by) : null;
    let dx = by ? s.x - by.x : 1, dz = by ? s.z - by.z : 0;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const g = fx.ground(s.x, s.z), x = s.x - dx * k * 5, z = s.z - dz * k * 5, y = g + 0.8 + look.height * k * k;
    // Heading: forward and steeply down (the derivative of the fall).
    const ux = dx * 5, uy = -2 * look.height * k, uz = dz * 5;
    fx.ordnance.add(x, y, z, ux, uy, uz, s.at * 7, look.body, BODY.barrage);
    if (fx.motion && dt > 0) {
      st.trail += dt;
      const gap = 0.035 * (eco ? 1.6 : 1);
      while (st.trail > gap) {
        st.trail -= gap;
        const q = fx.emit(fx.smoke, x, y + 0.6, z, st.anchor, true);
        q.vy = 0.2; q.drag = 1.2; q.life = 0.6 * (eco ? CLASS_LOOK.ecoTrail : 1); q.s0 = 0.35; q.s1 = 1.1; q.cell = CELL.puff;
        q.c0 = PAL.lobSmoke; q.c1 = PAL.lobSmokeEnd; q.spin = 0.5;
        const h = fx.emit(fx.glow, x, y + 0.3, z, st.anchor, true);
        h.life = 0.06; h.s0 = 1.4; h.s1 = 1.2; h.c0 = PAL.haloHot; h.c1 = PAL.halo;
      }
    }
  }
}
