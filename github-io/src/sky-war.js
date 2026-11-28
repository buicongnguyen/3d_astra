// Timelines for the Vivid Hero sky's moving set pieces (owner 2026-11-29: "a beautiful, vivid sky that looks like a
// space war"; Codex art in src/art/sky/armada/ and src/art/sky/orbital/). Pure: seeded plans and poses at a sky time,
// no three.js, no allocation per frame (poses are written into arrays the caller owns). src/horizon-vivid.js draws them.
//   armada   "Armada landfall" (sky-events.js): 2-4 capital ships drift across the far sky over 60-90 s, one or two
//            turn to their descend view and sink behind the far mountains, a landing flare blooms on the horizon (and
//            the low sky answers it); escorts and escape craft circle the battleship.
//   war      the faint far-away space war of every Vivid sky (stronger in the Armada and the Burning world): distant
//            warships drifting in two clusters, short violet and teal beam dashes between them, round explosion blooms
//            and flak pops a few times a minute, and now and then a burning wreck falling slowly behind the mountains.
// Gameplay rules: none of it is a unit (nothing is in the simulation), nothing streaks gold or orange (beams are violet
// and teal, explosions are round blooms), and beams are short dashes (at most 1/20 of the sky's width).
import { skyRandom } from "./sky-events.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------------ the armada
// The capital ships (armada/manifest.json): their length in degrees on the sky (scaled by lengthM: ark 2400 m), the
// side and descend images' sizes, the engine points (px) and the engine-glow cell (0 teal, 1 orange).
export const ARMADA_SHIPS = Object.freeze({
  cruiser: { index: 0, lengthM: 1700, len: 11.3, side: [1024, 320], descend: [768, 512], glow: 0, engines: { side: [[28, 170], [27, 208]], descend: [[27, 172], [21, 204]] } },
  hauler: { index: 1, lengthM: 1400, len: 9.3, side: [1024, 320], descend: [768, 512], glow: 1, engines: { side: [[32, 153], [30, 218]], descend: [[38, 143], [22, 180]] } },
  ark: { index: 2, lengthM: 2400, len: 16, side: [1280, 384], descend: [896, 512], glow: 0, engines: { side: [[38, 211], [37, 283]], descend: [[40, 146], [28, 185]] } },
});
export const ARMADA = Object.freeze({
  slots: 4, period: 120, cross: [60, 90], from: [-78, -62], travel: [118, 140], el: [5, 10.6],
  sink: 22, sinkTo: -5, slow: 0.35, flareAt: 1.2, flareRise: 1.4, flareFall: 9, flareWidth: 20,
  still: 34, // seconds into the cycle a still sky (reduced motion) shows: ships mid-crossing, one turning to land
  intro: 105, // seconds: a campaign mission's opening fleet ("reinforcements landing") before its own event
});
// A match's armada: which ships, when each enters, where it crosses, and which turn to land. reinforcements: the
// player's own fleet (`fleet`: its ship type, sky-events.js FLEET_SHIP) arriving and landing.
export function armadaPlan(seed, { reinforcements = false, fleet = "cruiser" } = {}) {
  const r = skyRandom(seed, "armada"), n = reinforcements ? 3 : 2 + Math.floor(r() * 3), ships = [];
  const others = ["hauler", "ark", "cruiser", "ark"];
  for (let i = 0; i < n; i++) {
    const type = reinforcements ? (ARMADA_SHIPS[fleet] ? fleet : "cruiser") : i === 0 ? "cruiser" : others[Math.floor(r() * others.length)];
    const dur = ARMADA.cross[0] + r() * (ARMADA.cross[1] - ARMADA.cross[0]);
    const u0 = ARMADA.from[0] + r() * (ARMADA.from[1] - ARMADA.from[0]) - i * 6;
    const el = ARMADA.el[0] + ((i * 0.37 + r() * 0.25) % 1) * (ARMADA.el[1] - ARMADA.el[0]);
    ships.push({ type, index: ARMADA_SHIPS[type].index, start: i * (5 + r() * 7), dur, u0, travel: ARMADA.travel[0] + r() * (ARMADA.travel[1] - ARMADA.travel[0]), el, land: null });
  }
  // One or two turn to land (never the battleship while its escorts circle it, unless it is alone in landing).
  const landers = reinforcements ? [0, 1] : n > 2 && r() < 0.5 ? [1, 2] : [n - 1];
  for (const i of landers) if (ships[i]) ships[i].land = 0.42 + r() * 0.2;
  return { ships, reinforcements, period: ARMADA.period };
}
// The pose of every slot at sky time t (out: { ships: [{ u, el, len, alpha, descend, index }], flare: { u, k }, flares }).
export function armadaPose(plan, t, out = armadaOut()) {
  const tl = ((t % plan.period) + plan.period) % plan.period;
  out.flare.k = 0;
  let landing = -1;
  for (let i = 0; i < ARMADA.slots; i++) {
    const s = plan.ships[i], o = out.ships[i];
    o.alpha = 0;
    if (!s) continue;
    const spec = ARMADA_SHIPS[s.type], a = (tl - s.start) / s.dur;
    o.index = s.index; o.len = spec.len; o.descend = 0;
    if (a < 0) continue;
    if (s.land === null || a < s.land) {
      if (a > 1) continue;
      o.u = s.u0 + s.travel * a; o.el = s.el;
      o.alpha = ease(a / 0.06) * (1 - ease((a - 0.94) / 0.06));
      continue;
    }
    // Landing: it slows, turns to its descend view and sinks behind the far mountains; the flare blooms where it went down.
    const since = tl - (s.start + s.land * s.dur), k = since / ARMADA.sink;
    if (k > 1.6) continue;
    o.u = s.u0 + s.travel * s.land + (s.travel / s.dur) * ARMADA.slow * since;
    o.el = s.el + (ARMADA.sinkTo - s.el) * ease(k);
    o.descend = ease(since / 2.2);
    o.alpha = 1 - ease((k - 1) / 0.5);
    // The flare: from the moment its keel passes the horizon, rising, then fading.
    const down = (ARMADA.flareAt - s.el) / (ARMADA.sinkTo - s.el); // the k when it is ARMADA.flareAt degrees up
    const at = down * ARMADA.sink, f = since - at;
    if (f >= 0 && f < ARMADA.flareRise + ARMADA.flareFall) {
      const kf = f < ARMADA.flareRise ? ease(f / ARMADA.flareRise) : 1 - ease((f - ARMADA.flareRise) / ARMADA.flareFall);
      if (kf > out.flare.k) { out.flare.k = kf; out.flare.u = o.u + 1.5; landing = i; }
    }
  }
  out.flare.ship = landing;
  return out;
}
export const armadaOut = () => ({ ships: Array.from({ length: ARMADA.slots }, () => ({ u: 0, el: 0, len: 0, alpha: 0, descend: 0, index: 0 })), flare: { u: 0, k: 0, ship: -1 } });

// ------------------------------------------------------------------------------------------------ the space war
// Slots in one draw (horizon-vivid.js ORBIT): warships, beams, blooms, flak, a wreck. Clusters: u (degrees right of
// the key art's bearing), el range; the front one between the ringed world and the event's stage, one behind.
export const WAR = Object.freeze({
  ships: 6, beams: 6, blooms: 3, flak: 4, wrecks: 1,
  clusters: [{ u: [-9, 17], el: [5.4, 8.6] }, { u: [168, 204], el: [6.4, 10.2] }],
  shipSize: [4.2, 5.6], drift: 0.035, beamLen: [1.2, 2.4], beamLife: 0.55, bloomLife: 1.8, bloomSize: [1.8, 3.2],
  bloomWait: [7, 22], flakLife: 0.45, flakWait: [1.5, 6], flakSize: [0.45, 0.85], wreckWait: [40, 80], wreckFall: 26, wreckSize: 3.2,
  // A bloom this big in a strong war flashes the low sky (sky-events.js SkyFlash), as a near blast would.
  flash: 0.32,
});
export const WAR_SLOTS = WAR.ships + WAR.beams + WAR.blooms + WAR.flak + WAR.wrecks;
// Per slot (8 floats): u, el, size (degrees), alpha | cell or frame, angle (radians), kind code, flip.
export const WAR_KIND = Object.freeze({ ship: 0, beam: 1, bloom: 2, flak: 3, wreck: 4 });
export function warPlan(seed) {
  const r = skyRandom(seed, "war"), ships = [];
  for (let i = 0; i < WAR.ships; i++) {
    const c = WAR.clusters[i % 2], side = Math.floor(i / 2) % 2; // each cluster has both sides
    ships.push({ c: i % 2, u: c.u[0] + r() * (c.u[1] - c.u[0]), el: c.el[0] + r() * (c.el[1] - c.el[0]), size: WAR.shipSize[0] + r() * (WAR.shipSize[1] - WAR.shipSize[0]),
      cell: side * 4 + Math.floor(r() * 4), flip: side ? -1 : 1, phase: r() * 100 });
  }
  const timers = (n, wait, salt) => Array.from({ length: n }, (_, i) => ({ seed: (r() * 1e6) | 0, wait, salt: salt + i }));
  // Each ship's foes (the other side in its cluster), and the live poses written each frame (no allocation per frame).
  const foes = ships.map((s, i) => ships.map((q, j) => j).filter((j) => j !== i && ships[j].c === s.c && ships[j].flip !== s.flip));
  return { seed, ships, foes, live: ships.map((s) => ({ u: 0, el: 0, s })), beams: timers(WAR.beams, [0.6, 3.2], 10), blooms: timers(WAR.blooms, WAR.bloomWait, 20), flak: timers(WAR.flak, WAR.flakWait, 30), wrecks: timers(WAR.wrecks, WAR.wreckWait, 40) };
}
// A slot's n-th event, seeded: when it starts (cycles of `life + wait`), and its own random numbers.
const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const C = { n: 0, age: 0, live: false, key: 0 };
function cycle(timer, life, t) {
  // Fixed-length cycles (life + the slot's own wait, seeded per slot) so any time maps to its cycle directly.
  const len = life + timer.wait[0] + hash(timer.seed, 7) * (timer.wait[1] - timer.wait[0]);
  const shift = hash(timer.seed, 3) * len, n = Math.floor((t + shift) / len), at = t + shift - n * len;
  C.n = n; C.age = at; C.live = at < life; C.key = timer.seed + n * 131;
  return C;
}
const rnd = (k) => hash(C.key, k);
// Writes every slot's pose at sky time t into `out` (Float32Array(WAR_SLOTS * 8)); returns the strongest bloom that
// began since `prev` (0-1, for the sky flash).
export function warPose(plan, t, out, prev = t) {
  let slot = 0, flash = 0;
  const put = (u, el, size, alpha, cell, angle, kind, flip = 1) => { const o = slot++ * 8; out[o] = u; out[o + 1] = el; out[o + 2] = size; out[o + 3] = alpha; out[o + 4] = cell; out[o + 5] = angle; out[o + 6] = kind; out[o + 7] = flip; };
  const S = plan.live;
  for (const p of S) {
    const s = p.s;
    p.u = s.u + Math.sin((t + s.phase) * 0.05) * 1.2 + WAR.drift * s.flip * (((t + s.phase) % 200) - 100) * 0.1;
    p.el = s.el + Math.sin((t + s.phase) * 0.07) * 0.25;
    put(p.u, p.el, s.size, 1, s.cell, 0, WAR_KIND.ship, s.flip);
  }
  // Beams: a short dash from one ship toward an enemy ship of its cluster, travelling for half a second.
  for (const b of plan.beams) {
    const c = cycle(b, WAR.beamLife, t), fi = Math.floor(rnd(1) * S.length), from = S[fi], foes = plan.foes[fi];
    const to = foes.length ? S[foes[Math.floor(rnd(2) * foes.length)]] : S[(fi + 1) % S.length];
    const k = c.age / WAR.beamLife, du = to.u - from.u, de = to.el - from.el, len = WAR.beamLen[0] + rnd(3) * (WAR.beamLen[1] - WAR.beamLen[0]);
    put(from.u + du * (0.15 + 0.7 * k), from.el + de * (0.15 + 0.7 * k), len, c.live ? Math.sin(Math.PI * clamp01(k)) : 0, rnd(4) < 0.5 ? 0 : 1, Math.atan2(de, du), WAR_KIND.beam);
  }
  // Blooms: a round explosion near a ship, its 8-frame flipbook over WAR.bloomLife.
  for (const b of plan.blooms) {
    const c = cycle(b, WAR.bloomLife, t), near = S[Math.floor(rnd(1) * S.length)];
    const size = WAR.bloomSize[0] + rnd(2) * (WAR.bloomSize[1] - WAR.bloomSize[0]);
    put(near.u + (rnd(3) - 0.5) * 3, near.el + (rnd(4) - 0.5) * 1.6, size, c.live ? 1 : 0, Math.min(7, Math.floor((c.age / WAR.bloomLife) * 8)), rnd(5) * 6.28, WAR_KIND.bloom);
    if (c.live && c.age <= t - prev + 1e-6 && t > prev) flash = Math.max(flash, (size / WAR.bloomSize[1]) * WAR.flash);
  }
  for (const b of plan.flak) {
    const c = cycle(b, WAR.flakLife, t), near = S[Math.floor(rnd(1) * S.length)], k = c.age / WAR.flakLife;
    put(near.u + (rnd(3) - 0.5) * 5, near.el + (rnd(4) - 0.2) * 2, (WAR.flakSize[0] + rnd(2) * (WAR.flakSize[1] - WAR.flakSize[0])) * (0.6 + 0.6 * k), c.live ? 1 - k * k : 0, Math.floor(rnd(5) * 4), 0, WAR_KIND.flak);
  }
  // The wreck: falls slowly from the war cluster behind the mountains, turning a little.
  for (const b of plan.wrecks) {
    const c = cycle(b, WAR.wreckFall, t), from = S[Math.floor(rnd(1) * S.length)], k = c.age / WAR.wreckFall;
    put(from.u + 3 + k * 5, from.el - (from.el + 4) * k * k, WAR.wreckSize, c.live ? ease(k / 0.08) * (1 - ease((k - 0.85) / 0.15)) : 0, 0, -0.1 - 0.15 * k, WAR_KIND.wreck);
  }
  return flash;
}
