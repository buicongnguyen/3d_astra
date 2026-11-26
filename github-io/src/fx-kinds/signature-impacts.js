// How each faction's rounds land (V4 signature shots, 2026-11-26). An impact is `(fx, at, o)`: `at` a world point (y includes
// the ground), `o` = { pal, s (scale: 1 = a tank shell), power, anchor, aloft (a flyer was hit: no dust or scorch), direct (a weapon
// with no splash: a contact, no scorch), calm (reduced motion or combat motion off: no flash, no rings opening or closing, no
// sparks, shards or arcs; a soft glow in the faction's colour), team, target, chain, sheet, shards }. Light impacts are a rifle
// round's; heavy ones keep the ground feedback of src/fx.js hit (dust, chips, a fading scorch) and add their faction's look,
// each shape twice: a normal-blended body in the faction's colour (reads on snow and sand) under an additive glow.
//   pop        Meridian: a small cyan ring pops on the hit            shock       Meridian heavy: flash, a cyan shock ring, sparks
//   ringsplash Meridian mortar: two rings and a splash of droplets     ember       Ashfall light: hot orange sparks dripping
//   molten     Ashfall heavy: the fireball, molten droplets, embers   sunpop      Sunward light: a little starburst
//   starburst  Sunward heavy: a radiant twelve-ray flare               zap         Wardens light: a crackle
//   discharge  Wardens heavy: a crackling discharge, chain arcs        shards      Veil light: crystal shards thrown out
//   implode    Veil heavy: a violet rim and a dark core collapse, then shards burst out
// Chain arcs (discharge) are drawing only: they jump to the nearest other enemy units the player can see, never deal damage
// and never reach into fog (each arc's anchor is its segment, checked every frame like a shot's path).
import { CELL, STRETCH } from "./cells.js";
import { size, quad, put, shape, sparksAt, sheet, SHEET } from "./signature-common.js";

// The white-hot star of a landing (rate-limited with every flare, src/fx.js allowFlash).
const flare = (fx, at, v, P, anchor, life = 0.06, delay = 0) =>
  fx.particle(fx.glow, { lifted: true, x: at.x, y: at.y, z: at.z, cell: CELL.flare, s0: quad("flare", v), s1: quad("flare", v) * 1.2, life, c0: P.core, c1: P.main0, anchor, delay });
// Dust, chips and a fading scorch where a heavy round meets the ground (as src/fx.js hit does).
function ground(fx, at, s, anchor, crater = false) {
  const g = fx.ground(at.x, at.z);
  fx.hitDust({ x: at.x, y: 0.3, z: at.z }, 2, anchor, 1.1 * s, 1.1);
  fx.addDebris({ x: at.x, y: Math.max(0.3, at.y - g), z: at.z }, Math.round(3 * s), anchor, 0.8 * s, s >= 1 ? 1 : 0);
  fx.scorch(at, 1.4 * s, anchor, crater);
}
// A rifle round on the ground kicks a small dust puff (Eco: every other one), as src/fx.js hit does.
function puff(fx, at, anchor) {
  if (fx.rng() < (fx.view.lowPower ? 0.5 : 1)) fx.hitDust({ x: at.x, y: 0.25, z: at.z }, 1, anchor, 0.45, 0.7);
}
const grounded = (o) => !o.aloft && !o.direct;
// One shape twice: the outlined body in the faction's colour (normal blended) and its glow (additive), `v0` -> `v1` visible metres.
function both(fx, at, cell, v0, v1, life, P, anchor, delay = 0, glowColour = P.core, bodyColour = P.main) {
  const body = shape(fx, fx.smoke, at, cell, v0, v1, life, bodyColour, fade(bodyColour), anchor, delay);
  const glow = shape(fx, fx.glow, at, cell, v0, v1, life, glowColour, fade(glowColour), anchor, delay);
  glow.rot = body.rot;
  return glow;
}
// Ashfall's rolling fire: white-hot yellow cooling through orange to soot (normal blended, as src/fx.js explosion's fire body).
const FIRE = Object.freeze([1, 0.66, 0.22, 0.95]), FIRE_END = Object.freeze([0.16, 0.11, 0.09, 0]);
const FADED = new Map();
function fade(c) { let f = FADED.get(c); if (!f) FADED.set(c, (f = Object.freeze([c[0], c[1], c[2], 0]))); return f; }
// `n` small shapes (crystal shards, droplets, motes) thrown out of `at`, spinning, falling a little (additive).
function scatter(fx, at, n, v, cell, c0, c1, anchor, { speed = 4, up = 2, gravity = 7, life = 0.34, delay = 0, spin = 12, layer = fx.glow } = {}) {
  for (let i = 0, count = fx.count(n); i < count; i++) {
    const a = fx.rng() * 6.28, sp = speed * (0.6 + fx.rng() * 0.6), p = put(fx, layer, at.x, at.y, at.z, anchor);
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = up * (0.5 + fx.rng()); p.gravity = gravity; p.drag = 1.4;
    p.cell = cell; p.s0 = quad(cellNameOf(cell), v); p.s1 = p.s0 * 0.45; p.life = life * (0.75 + fx.rng() * 0.5); p.c0 = c0; p.c1 = c1; p.spin = (fx.rng() - 0.5) * 2 * spin; p.age = -delay;
    p.rot = fx.rng() * 6.28; p.floor = fx.ground(at.x, at.z) + 0.05;
  }
}
const cellNameOf = (cell) => (cell === CELL.shard ? "shard" : cell === CELL.starburst ? "starburst" : cell === CELL.flare ? "flare" : cell === CELL.orb ? "orb" : "glow");
// How wide a heavy landing is drawn: `metres` at hit scale, never under `px` CSS pixels, and never wider than two target widths
// (1.2 on a direct contact), as src/fx-kinds/sprite-fx.js caps the painted blasts: a phone shows a burst, not a curtain.
function blast(fx, o, metres, px) {
  const w = o.anchor?.targetWidth;
  return Math.min(size(fx, [metres, px]), w ? w * (o.direct ? 1.2 : 2) : Infinity);
}
// The Codex impact (the `<key>Hit` item: the painted frames 8-15, played once, centred on the contact), `v` visible metres across
// (the art fills about 0.8 of its cell). Like the painted blasts of src/fx-kinds/sprite-fx.js, it shares the real-time flash limit
// (src/fx.js allowFlash, off with reduced motion or combat motion off): without the token it skips its two brightest frames and
// plays a little dimmer, and with reduced motion the sprite steps calmly (src/fx-sprites.js `calm`). True when it drew.
function sheetImpact(fx, key, at, v, anchor, delay = 0) {
  const name = key && sheet(fx, key + "Hit");
  if (!name) return false;
  const p = fx.sprites.take(name, at.x, at.y, at.z, v / 0.8, anchor, true);
  if (!p) return false;
  p.age = -delay; p.fade = 0.25; p.rot = (fx.rng() - 0.5) * 0.6;
  if (!fx.allowFlash()) { p.start = 2; p.count = 6; p.a = 0.85; }
  p.life = p.count / Math.max(1, p.fps);
  return true;
}

// A jagged lightning arc from `a` to `b` (world points): `segments` stretched bolt cells between joints thrown sideways (the big
// zigzag), the small one inside each cell; `gens` flickers of `life` s, each new one re-drawn. With the Codex lightning sheet packed,
// one stretched sprite per flicker instead. The anchor decides the fog (a shot-like anchor checks the whole segment).
export function lightning(fx, a, b, width, life, P, anchor, delay = 0, segments = 3, amp = 0.4, gens = 2) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, dist = Math.hypot(dx, dy, dz) || 1, h = Math.hypot(dx, dz) || 1;
  const sx = -dz / h, sz = dx / h, swing = amp * Math.min(1, dist / 3), name = sheet(fx, "lightning"), L = SHEET.lightning;
  for (let g = 0; g < gens; g++) {
    const start = delay + g * life * 0.7;
    // A soft blue glow along the whole arc, and a darker line under it so the arc shows on snow.
    for (const layer of [fx.smoke, fx.glow]) {
      const line = put(fx, layer, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, anchor);
      line.mode = STRETCH; line.ax = dx / dist; line.ay = dy / dist; line.az = dz / dist; line.length = dist; line.cell = CELL.streak;
      line.s0 = line.s1 = quad("streak", width * (layer === fx.smoke ? 0.5 : 1.4)); line.life = life; line.age = -start;
      line.c0 = layer === fx.smoke ? P.mainSolid : P.mainDim; line.c1 = layer === fx.smoke ? P.main0 : P.main0;
    }
    let px = a.x, py = a.y, pz = a.z;
    for (let i = 1; i <= segments; i++) {
      const k = i / segments, last = i === segments, o = last ? 0 : (fx.rng() - 0.5) * 2 * swing, oy = last ? 0 : (fx.rng() - 0.5) * swing * 0.7;
      const qx = a.x + dx * k + sx * o, qy = a.y + dy * k + oy, qz = a.z + dz * k + sz * o;
      const ex = qx - px, ey = qy - py, ez = qz - pz, l = Math.hypot(ex, ey, ez) || 1, frame = Math.floor(fx.rng() * 4);
      // A painted bolt per segment (one of the 16 Codex poses, its two bright ends on the segment's ends) when the sheet is there.
      const cell = name && width / L.thick, q = name && fx.sprites.take(name, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, cell, anchor, true);
      if (q) {
        q.mode = 2; q.ax = ex / l; q.ay = ey / l; q.az = ez / l; q.sx = l / ((L.ends[1] - L.ends[0]) * cell); q.sy = 1;
        q.start = Math.floor(fx.rng() * 16); q.count = 1; q.fps = 0; q.life = life; q.age = -start; q.fade = 0.3;
        px = qx; py = qy; pz = qz;
        continue;
      }
      // Each segment twice: the outlined blue bolt (normal blended, it reads on snow) and its pale light, flickering together.
      for (const layer of [fx.smoke, fx.glow]) {
        const p = put(fx, layer, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, anchor);
        p.mode = STRETCH; p.ax = ex / l; p.ay = ey / l; p.az = ez / l; p.length = l * 1.12; p.cell = CELL.bolt;
        p.frames = 4; p.fps = 34; p.frame = frame; p.s0 = p.s1 = quad("bolt", width); p.life = life; p.age = -start;
        p.c0 = p.c1 = layer === fx.smoke ? P.main : P.sparkSoft;
      }
      px = qx; py = qy; pz = qz;
    }
  }
}

// Up to `n` arcs from a Wardens hit to the nearest other enemy units the player can see (5 m at most). Drawing only.
const NEAR = [];
function chainArcs(fx, at, o, n) {
  const sim = fx.frameSim;
  if (!(n > 0) || !sim?.entities || o.calm || !fx.motion) return;
  NEAR.length = 0;
  for (const e of sim.entities) {
    if (e.kind !== "unit" || !(e.hp > 0) || e.flying || e.id === o.target || e.team === o.team) continue;
    if (typeof sim.hostile === "function" && !sim.hostile(o.team, e.team)) continue;
    const d = Math.hypot(e.x - at.x, e.z - at.z);
    if (d < 0.6 || d > 5) continue;
    if (!sim.isVisible(e)) continue; // fog: never an arc to a unit the player cannot see
    let i = NEAR.length;
    while (i > 0 && NEAR[i - 1].d > d) i--;
    if (i >= n) continue;
    NEAR.splice(i, 0, { e, d });
    if (NEAR.length > n) NEAR.length = n;
  }
  const width = size(fx, [0.3, 8]);
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i].e, b = { x: e.x, y: fx.ground(e.x, e.z) + 0.9, z: e.z }, delay = 0.03 + i * 0.05;
    // The arc's own anchor: the segment from the hit to that unit, checked against the fog every frame.
    const anchor = { x: at.x, z: at.z, tx: e.x, tz: e.z, shot: true, team: o.team };
    lightning(fx, at, b, width, 0.11, o.pal, anchor, delay, 3, 0.45, 2);
    const c = shape(fx, fx.glow, b, CELL.crackle, size(fx, [0.45, 11]), size(fx, [0.65, 16]), 0.12, o.pal.spark, o.pal.main0, anchor, delay);
    c.frames = 2; c.fps = 30; c.jump = 2.4;
  }
  NEAR.length = 0;
}

// The pale core and the coloured glow every landing starts with (visible size `v`).
function core(fx, at, v, P, anchor, life = 0.08) {
  shape(fx, fx.glow, at, CELL.glow, v, v * 0.55, life, P.core, P.main0, anchor);
}
// A heavy landing's splash: an outlined ball of the faction's colour that swells and fades (normal blended, so the burst keeps
// its colour on snow, sand, lava and over pale hulls), from `v0` to `v1` visible metres.
function splash(fx, at, v0, v1, life, P, anchor, colour = P.main, cell = CELL.orb) {
  return shape(fx, fx.smoke, at, cell, v0, v1, life, colour, fade(colour), anchor);
}

export const IMPACTS = {
  pop(fx, at, o) {
    const P = o.pal, a = o.anchor;
    core(fx, at, size(fx, [0.32, 8]), P, a);
    if (!o.calm) {
      both(fx, at, CELL.ring, size(fx, [0.1, 3]), size(fx, [0.55, 15]), 0.16, P, a, 0, P.main);
      sparksAt(fx, at, 2, a, 0.4, P.spark, P.main0);
    }
    if (!o.aloft) puff(fx, at, a);
  },
  shock(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s;
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 2.8 * s, 46), a) && !o.calm) {
      flare(fx, at, 1.6 * s, P, a);
      both(fx, at, CELL.ring, 0.4 * s, size(fx, [2.8 * s, 46]), 0.3, P, a, 0, P.main);
      shape(fx, fx.glow, at, CELL.band, 0.3 * s, size(fx, [2 * s, 32]), 0.2, P.coreDim, P.main0, a);
    }
    splash(fx, at, size(fx, [0.6 * s, 13]), size(fx, [1.5 * s, 28]), 0.2, P, a);
    core(fx, at, size(fx, [0.9 * s, 18]), P, a, o.calm ? 0.35 : 0.12);
    shape(fx, fx.glow, at, CELL.glow, 1.1 * s, size(fx, [1.8 * s, 34]), o.calm ? 0.4 : 0.22, P.mainSoft, P.main0, a);
    if (!o.calm) sparksAt(fx, at, 7, a, 0.8 * s + 0.2, P.spark, P.main0);
    if (grounded(o)) ground(fx, at, s, a);
  },
  ringsplash(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s;
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 3.1 * s, 50), a) && !o.calm) {
      flare(fx, at, 1.8 * s, P, a);
      both(fx, at, CELL.ring, 0.5 * s, size(fx, [3.2 * s, 52]), 0.34, P, a, 0, P.main);
      both(fx, at, CELL.ring, 0.25 * s, size(fx, [2 * s, 32]), 0.26, P, a, 0.07, P.core);
    }
    splash(fx, at, size(fx, [0.6 * s, 13]), size(fx, [1.6 * s, 30]), 0.22, P, a);
    core(fx, at, size(fx, [1 * s, 20]), P, a, o.calm ? 0.35 : 0.13);
    shape(fx, fx.glow, at, CELL.glow, 1.2 * s, size(fx, [2 * s, 36]), o.calm ? 0.4 : 0.24, P.mainSoft, P.main0, a);
    if (!o.calm) {
      // The splash: droplets of light thrown up and falling back.
      scatter(fx, at, 8, size(fx, [0.16, 5]), CELL.orb, P.main, P.main0, a, { speed: 3, up: 5, gravity: 14, life: 0.5, spin: 0, layer: fx.smoke });
      sparksAt(fx, at, 5, a, 0.7 * s + 0.2, P.spark, P.main0);
    }
    if (grounded(o)) ground(fx, at, s, a, true);
  },
  ember(fx, at, o) {
    const P = o.pal, a = o.anchor;
    core(fx, at, size(fx, [0.32, 8]), P, a);
    if (!o.calm) {
      shape(fx, fx.smoke, at, CELL.orb, size(fx, [0.14, 4]), size(fx, [0.26, 7]), 0.12, P.main, P.main0, a);
      sparksAt(fx, at, 3, a, 0.5, P.spark, P.main0, 0, 20);
    }
    if (!o.aloft) puff(fx, at, a);
  },
  molten(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s;
    // The heavy landing of src/fx.js (the painted fireball once the sheets have loaded, dust, chips, the scorch) suits molten
    // scrap; in the air or on a contact a hot burst instead.
    const g = { x: at.x, y: at.y - fx.ground(at.x, at.z), z: at.z };
    if (grounded(o)) fx.hit(g, o.power || s, { ...a, direct: false }, "shell");
    if (!o.calm) flare(fx, at, 1.3 * s, P, a);
    // A ball of fire rolling out of the hit (normal blended: it keeps its colour on snow and over pale hulls, and draws in front
    // of the hull it struck), its white-hot heart, then a gout of black smoke.
    const k = Math.max(0.5, s), v = size(fx, [0.9 * k, 16]) / 0.8;
    // The painted molten splash and embers (codex-vfx3) when the sheet is there, else a rolling procedural fire body.
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 2.8 * s, 46), a))
      fx.burst(fx.smoke, fx.count(o.calm ? 3 : 7), g, { life: 0.3, s0: v * 0.55, s1: v * 1.5, drag: 3, cell: CELL.puff, c0: FIRE, c1: FIRE_END, anchor: a, spin: 1,
        gravity: -1.4 }, [1.1 * k, 2.6 * k], 0.7);
    core(fx, at, size(fx, [1 * s, 20]), P, a, 0.13);
    const q = shape(fx, fx.smoke, at, CELL.puff, 0.6 * s, 2.3 * s, 1.1, P.smokeSolid, P.smoke0, a, 0.12);
    q.vy = fx.motion ? 0.7 : 0; q.drag = 1.2; q.spin = 0.6;
    if (o.calm) return;
    // Molten droplets (outlined, they read on snow) dripping out, sparks and a few embers rising.
    scatter(fx, at, 7, size(fx, [0.14, 5]), CELL.orb, P.main, P.main0, a, { speed: 3.4, up: 4, gravity: 16, life: 0.5, spin: 0, layer: fx.smoke });
    sparksAt(fx, at, 5, a, 0.9 * s + 0.2, P.core, P.main0, 0, 20);
    scatter(fx, at, 4, size(fx, [0.12, 4]), CELL.flare, P.spark, P.main0, a, { speed: 1, up: 2.2, gravity: -0.8, life: 0.8, spin: 2 });
  },
  sunpop(fx, at, o) {
    const P = o.pal, a = o.anchor;
    core(fx, at, size(fx, [0.3, 8]), P, a);
    const p = both(fx, at, CELL.starburst, size(fx, [0.2, 6]), size(fx, [0.6, 16]), o.calm ? 0.2 : 0.17, P, a, 0, P.core);
    p.spin = o.calm ? 0 : 5;
    if (!o.calm) sparksAt(fx, at, 2, a, 0.4, P.spark, P.main0);
    if (!o.aloft) puff(fx, at, a);
  },
  starburst(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s;
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 3 * s, 48), a) && !o.calm) {
      flare(fx, at, 1.5 * s, P, a);
      both(fx, at, CELL.starburst, 0.9 * s, size(fx, [3.4 * s, 56]), 0.32, P, a, 0, P.core).spin = 2.2;
      const second = shape(fx, fx.glow, at, CELL.starburst, 0.6 * s, size(fx, [2.4 * s, 40]), 0.24, P.spark, P.main0, a, 0.04);
      second.spin = -3;
    }
    splash(fx, at, size(fx, [0.7 * s, 15]), size(fx, [1.6 * s, 30]), 0.22, P, a, P.main, CELL.sundisc).spin = 3;
    core(fx, at, size(fx, [0.9 * s, 18]), P, a, o.calm ? 0.35 : 0.13);
    shape(fx, fx.glow, at, CELL.glow, 1.1 * s, size(fx, [1.9 * s, 34]), o.calm ? 0.4 : 0.25, P.mainSoft, P.main0, a);
    if (!o.calm) scatter(fx, at, 6, size(fx, [0.18, 6]), CELL.starburst, P.spark, P.main0, a, { speed: 1.6, up: 2.6, gravity: -0.4, life: 0.6, spin: 4 });
    if (grounded(o)) ground(fx, at, s, a);
  },
  zap(fx, at, o) {
    const P = o.pal, a = o.anchor;
    core(fx, at, size(fx, [0.3, 8]), P, a);
    if (sheetImpact(fx, o.sheet === "hoop" ? "hoop" : null, at, blast(fx, o, 0.9, 24), a)) { if (!o.aloft) puff(fx, at, a); return; }
    if (!o.calm) {
      const c = both(fx, at, CELL.crackle, size(fx, [0.36, 11]), size(fx, [0.5, 15]), 0.12, P, a, 0, P.spark);
      c.frames = 2; c.fps = 30; c.jump = 2.4;
      sparksAt(fx, at, 2, a, 0.4, P.spark, P.main0);
    }
    if (!o.aloft) puff(fx, at, a);
  },
  discharge(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s;
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 2.9 * s, 48), a) && !o.calm) {
      flare(fx, at, 1.6 * s, P, a);
      for (let i = 0; i < 2; i++) {
        const c = both(fx, at, CELL.crackle, (1 - i * 0.25) * s, size(fx, [(2.6 - i * 0.7) * s, 48 - i * 12]), 0.24, P, a, i * 0.05, i ? P.main : P.spark);
        c.frames = 2; c.fps = 26; c.jump = 2.4; c.frame = i;
      }
    }
    splash(fx, at, size(fx, [0.6 * s, 13]), size(fx, [1.4 * s, 26]), 0.2, P, a);
    core(fx, at, size(fx, [0.9 * s, 18]), P, a, o.calm ? 0.35 : 0.12);
    shape(fx, fx.glow, at, CELL.glow, 1.1 * s, size(fx, [1.9 * s, 34]), o.calm ? 0.4 : 0.22, P.mainSoft, P.main0, a);
    if (!o.calm) sparksAt(fx, at, 7, a, 0.8 * s + 0.2, P.spark, P.main0);
    if (grounded(o)) ground(fx, at, s, a);
    chainArcs(fx, at, o, o.chain || 0);
  },
  shards(fx, at, o) {
    const P = o.pal, a = o.anchor;
    core(fx, at, size(fx, [0.32, 8]), P, a, 0.09);
    if (sheetImpact(fx, o.sheet === "crescent" ? "crescent" : null, at, blast(fx, o, 0.9, 24), a)) { if (!o.aloft) puff(fx, at, a); return; }
    if (!o.calm) scatter(fx, at, o.shards || 3, size(fx, [0.22, 7]), CELL.shard, P.main, P.main0, a, { speed: 2.6, up: 2, gravity: 9, life: 0.34, layer: fx.smoke });
    if (!o.calm) scatter(fx, at, 2, size(fx, [0.18, 6]), CELL.shard, P.spark, P.main0, a, { speed: 2.2, up: 1.6, gravity: 9, life: 0.28 });
    if (!o.aloft) puff(fx, at, a);
  },
  implode(fx, at, o) {
    const P = o.pal, a = o.anchor, s = o.s, burst = 0.2;
    if (!sheetImpact(fx, o.sheet, at, blast(fx, o, 2.8 * s, 46), a) && !o.calm) {
      // The collapse: a dark core and a violet rim closing in on the point, then a flash and shards bursting out of it.
      shape(fx, fx.smoke, at, CELL.orb, size(fx, [1.3 * s, 24]), 0.12 * s, burst + 0.02, P.voidSolid || P.under, P.void0 || P.under0, a);
      both(fx, at, CELL.ring, size(fx, [2.8 * s, 46]), 0.15 * s, burst, P, a, 0, P.main);
      shape(fx, fx.glow, at, CELL.glow, 0.3 * s, size(fx, [1.6 * s, 30]), 0.16, P.core, P.main0, a, burst);
      both(fx, at, CELL.band, 0.25 * s, size(fx, [2.2 * s, 36]), 0.22, P, a, burst, P.mainSoft);
    }
    if (o.calm) shape(fx, fx.glow, at, CELL.glow, 1.1 * s, 1.6 * s, 0.4, P.mainSoft, P.main0, a);
    else {
      scatter(fx, at, 6, size(fx, [0.24, 8]), CELL.shard, P.main, P.main0, a, { speed: 3.4, up: 2.4, gravity: 8, life: 0.42, delay: burst, layer: fx.smoke });
      scatter(fx, at, 3, size(fx, [0.2, 6]), CELL.shard, P.spark, P.main0, a, { speed: 3, up: 2, gravity: 8, life: 0.34, delay: burst });
    }
    if (grounded(o)) ground(fx, at, s, a);
  },
};
