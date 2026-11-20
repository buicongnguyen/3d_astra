// Waves: calling, spawning, previews, elite marks, and the endless generator.
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { DEFINITIONS as D, hyp } from "../../data.js";
import { difficultyRules } from "../../difficulty.js";
import { waveCount } from "../missions.js";
import BALANCE from "../../balance.json" with { type: "json" };
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, FOE, RETRY, lanePoint, nearestLeg, crossing } from "./common.js";

// A small seeded generator (mulberry32): endless waves come from the seed and the wave number only.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Text to a 32-bit seed (FNV-1a): a level id for Endless, a date for the Daily seed.
export function seedOf(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
// The units a level's designed waves use: endless waves draw from them (slot, faction and tag).
// (Carriers are not drawn: endless waves add their own, below.)
// Memoised off the simulation (module WeakMaps keyed by the level definition, never saved or hashed).
const PALETTES = new WeakMap(), ENDLESS = new WeakMap();
function palette(def) {
  let list = PALETTES.get(def);
  if (!list) PALETTES.set(def, list = buildPalette(def));
  return list;
}
function buildPalette(def) {
  const seen = new Map();
  for (const w of def.waves) for (const g of w.groups) for (const slot of Object.keys(g.units)) {
    if (slot === "carrier") continue;
    const key = `${slot}|${g.faction || ""}`;
    if (!seen.has(key)) seen.set(key, { slot, faction: g.faction || null });
  }
  return [...seen.values()];
}
// Endless wave n (0-based): a budget that grows forever, spent on groups drawn from the level's
// own units and routes by the seed. Pure: the same seed and n always give the same wave.
export function endlessWave(def, n) {
  let waves = ENDLESS.get(def);
  if (!waves) ENDLESS.set(def, waves = new Map());
  let wave = waves.get(n);
  if (!wave) waves.set(n, wave = buildEndlessWave(def, n));
  return wave;
}
function buildEndlessWave(def, n) {
  const rnd = seeded((def.endless.seed >>> 0) ^ Math.imul(n + 1, 0x9e3779b1)), units = palette(def), routes = Object.keys(def.routes);
  const budget = 6 + n * 2.4 + Math.pow(n, 1.45) * 0.25;
  const groups = Math.min(4, 1 + Math.floor(n / 3));
  // Health grows from the tenth wave (0.24: by garrisons.json endless.hp a wave, 0.06 before).
  const hp = n < 10 ? 1 : Math.round((1 + (n - 9) * (GARRISONS.endless?.hp ?? 0.06)) * 100) / 100;
  const out = [];
  let delay = 0;
  for (let k = 0; k < groups; k++) {
    const u = units[Math.floor(rnd() * units.length)], pop = D[u.slot]?.pop || 1;
    const count = Math.max(1, Math.round(budget / groups / pop * (0.8 + rnd() * 0.4)));
    const g = { units: { [u.slot]: count }, route: routes[Math.floor(rnd() * routes.length)], every: pop >= 3 ? 2 : 0.6, delay: Math.round(delay * 10) / 10 };
    if (hp !== 1) g.hp = hp;
    if (u.faction) g.faction = u.faction;
    // Every fourth wave on a river with demolition brings bridge builders along.
    if (def.bridges && n % 4 === 3 && k === 0) g.tag = "bridger";
    out.push(g);
    delay += 2.5 + rnd() * 3;
  }
  // Every fifth wave from the fifth (0.22): troop carriers bring a squad of the level's own foot
  // soldiers and drop it half-way down a road. Drawn after the groups, so they stay as they were.
  const foot = units.filter((u) => !D[u.slot]?.flying && (D[u.slot]?.pop || 1) <= 2);
  if (n % 5 === 4 && foot.length) {
    const u = foot[Math.floor(rnd() * foot.length)], route = routes[Math.floor(rnd() * routes.length)];
    const g = { units: { carrier: Math.min(3, 1 + Math.floor(n / 15)) }, carry: { [u.slot]: Math.min(8, 4 + Math.floor(n / 6)) }, dropLeg: Math.max(1, Math.floor((def.routes[route].length - 1) / 2)), route, every: 3, delay: Math.round(delay * 10) / 10 };
    if (hp !== 1) g.hp = hp;
    if (u.faction) g.faction = u.faction;
    out.push(g);
  }
  return { groups: out, bonus: 30 + n * 4 };
}

export const waves = {
  // Sends the next wave now. The time left on the countdown pays a small bonus.
  waveCall(team) {
    const d = this.defence, def = this.defenceDef();
    if (!d || this.result || team !== TEAM || d.wave >= this.waveTotal() || d.queue.length) return false;
    const left = d.nextAt !== null ? Math.max(0, d.nextAt - this.time) : def.gap ?? 16;
    const bonus = def.noCallBonus ? 0 : Math.ceil(left * 2);
    this.players[TEAM].alloy += bonus;
    d.called += bonus;
    this.startWave();
    this.events.push({ type: "waveCall", bonus, team });
    return true;
  },
  // Wave sizes by difficulty: the level's own table (defence.count), else the campaign's.
  defenceWaveScale() {
    const count = this.defenceDef()?.count;
    return count?.[this.difficulty] ?? difficultyRules(this).wave;
  },
  // The unit a wave group's slot (or unit type) stands for: the enemy team's roster, or the
  // roster of the group's own faction in a mixed wave (any unit type names itself).
  waveType(g, slot) {
    return g.faction ? BALANCE.factions[g.faction]?.swap?.[slot] || slot : this.typeFor(FOE, slot);
  },
  // The units of wave group `g` as [type, count] pairs, scaled for the difficulty; a carrier
  // group's passengers (`carry`) likewise. Shared by startWave and wavePreview.
  waveUnits(g, units = g.units, scale = this.defenceWaveScale()) {
    return Object.entries(units).map(([slot, n]) => { const type = this.waveType(g, slot); return [type, D[type]?.boss ? n : waveCount(n, scale, D[type])]; });
  },
  startWave() {
    const d = this.defence, def = this.defenceDef(), wave = this.defenceWave(d.wave), scale = this.defenceWaveScale();
    // A wave called while the last one is still on the road (waveCall): that one keeps its own
    // tally, so its clear bonus and the tower repair still come when its last unit falls.
    if (d.active) this.holdWave();
    d.wave++;
    d.active = true;
    d.nextAt = null;
    // One warning per spawn point the wave uses (several groups may share one), in group order.
    const spawns = [];
    for (const g of wave.groups) {
      const pts = def.routes[g.route];
      if (!pts) continue;
      let at = spawns.find((s) => hyp(s.x - pts[0].x, s.z - pts[0].z) < 1);
      if (!at) spawns.push((at = { x: pts[0].x, z: pts[0].z, count: 0 }));
      // Passengers ride in every carrier of the group, one squad each, in the order they board.
      let cargo = null;
      if (g.carry) {
        cargo = [];
        const ride = this.waveUnits(g, g.carry, scale);
        for (let k = 0; ride.some(([, n]) => n > 0); k++) { const entry = ride[k % ride.length]; if (entry[1] > 0) { entry[1]--; cargo.push(entry[0]); } }
      }
      // Types take turns, so a mixed group arrives mixed.
      const left = this.waveUnits(g, g.units, scale);
      for (let k = 0, i = 0; left.some(([, n]) => n > 0); k++) {
        const entry = left[k % left.length];
        if (entry[1] <= 0) continue;
        entry[1]--;
        const q = { at: this.time + (g.delay || 0) + i * (g.every ?? 0.7), type: entry[0], route: g.route };
        // Tougher crews: the group's own factor times the difficulty's (defence.hp).
        const hp = (g.hp ?? 1) * (typeof def.hp === "object" ? def.hp[this.difficulty] ?? 1 : def.hp ?? 1);
        if (hp !== 1) q.hp = hp;
        if (g.tag === "bridger") q.bridger = true;
        // Elite affixes (AAA round 2, W2-B, sim/content/elites.js): every `every`-th spawn of a group with `mods`.
        if (g.mods?.elite && !g.carry && i % (g.mods.every || 1) === 0) q.mods = { elite: g.mods.elite, ...(g.mods.elite === "splitter" ? { split: this.waveType(g, "vanguard") } : {}) };
        if (cargo && D[entry[0]]?.carrier) { q.cargo = cargo.slice(); q.dropLeg = g.dropLeg ?? 1; at.count += cargo.length; }
        d.queue.push(q);
        i++;
        at.count++;
      }
    }
    d.queue.sort((a, b) => a.at - b.at);
    for (const s of spawns) this.events.push({ type: "incoming", team: TEAM, x: s.x, z: s.z, count: s.count, wave: d.wave, spawns: spawns.length });
  },
  // The wave on the field is held apart while the next one comes (see startWave): every enemy
  // still standing is tagged with its wave number, which stepDefence counts down on its own.
  holdWave() {
    const d = this.defence;
    for (const e of this.entities) if (e.team === FOE && e.kind === "unit" && e.hp > 0 && e.wave === undefined) e.wave = d.wave;
    (d.open ||= []).push(d.wave);
  },
  // Wave n (1-based) beaten: its bonus, every tower patched up, one more wave held.
  creditWave(n) {
    const d = this.defence, wave = this.defenceWave(n - 1);
    d.cleared++;
    if (wave?.bonus) this.players[TEAM].alloy += wave.bonus;
    for (const t of this.entities) if (t.team === TEAM && t.crew && t.hp > 0) { t.hp = t.maxHp; t.shield = t.maxShield; }
    if (d.armourNext) this.refitArmour();
    this.events.push({ type: "waveCleared", wave: n, bonus: wave?.bonus || 0, team: TEAM });
  },
  // What the next wave brings, for the preview before it is called: per group its route and
  // units (counts as they will spawn on this difficulty), a carrier with its passengers.
  wavePreview() {
    const d = this.defence;
    if (!d || d.wave >= this.waveTotal()) return null;
    const def = this.defenceDef(), wave = this.defenceWave(d.wave), scale = this.defenceWaveScale(), units = new Map(), routes = [];
    for (const g of wave.groups) {
      if (!def.routes[g.route]) continue;
      if (!routes.includes(g.route)) routes.push(g.route);
      const ride = g.carry ? this.waveUnits(g, g.carry, scale).reduce((a, [, n]) => a + n, 0) : 0;
      // An elite group (mods): its elite units get their own entry, `elite` the affix (the intel chips read it).
      const marks = g.mods?.elite ? this.eliteMarks(g, scale) : null;
      for (const [type, n] of this.waveUnits(g, g.units, scale)) {
        if (marks) {
          const m = marks.get(type) || 0;
          if (m) { const key = `${type}|${g.mods.elite}`, u = units.get(key) || { type, count: 0, elite: g.mods.elite }; u.count += m; units.set(key, u); }
          if (n - m > 0) { const u = units.get(type) || { type, count: 0 }; u.count += n - m; units.set(type, u); }
          continue;
        }
        const carrier = !!D[type]?.carrier && ride > 0, key = carrier ? `${type}|${ride}` : type;
        const u = units.get(key) || { type, count: 0, ...(carrier ? { carry: ride, passengers: this.waveUnits(g, g.carry, scale).map(([t]) => t) } : {}) };
        u.count += n;
        units.set(key, u);
      }
    }
    return { wave: d.wave + 1, units: [...units.values()], routes };
  },
  // How many of each type of group `g` become elites: the turn order of startWave, counted.
  eliteMarks(g, scale) {
    const left = this.waveUnits(g, g.units, scale), marks = new Map(), every = g.mods.every || 1;
    for (let k = 0, i = 0; left.some(([, n]) => n > 0); k++) {
      const entry = left[k % left.length];
      if (entry[1] <= 0) continue;
      entry[1]--;
      if (!g.carry && i % every === 0) marks.set(entry[0], (marks.get(entry[0]) || 0) + 1);
      i++;
    }
    return marks;
  },
  // A due spawn appears on its lane at the route's start, once that spot is clear.
  spawnQueued() {
    const d = this.defence, def = this.defenceDef();
    let spawned = false;
    while (d.queue.length && d.queue[0].at <= this.time + 1e-9) {
      const q = d.queue[0], pts = def.routes[q.route], id = this.nextId, r = D[q.type].radius || 0.7;
      const start = lanePoint(pts, 0, ((id * 0.618) % 1 - 0.5) * (def.lane ?? 2.4));
      const crowded = !this.nav.canStand(start.x, start.z, r) ||
        this.entities.some((e) => e.hp > 0 && e.kind === "unit" && hyp(e.x - start.x, e.z - start.z) < e.radius + r);
      if (crowded) {
        // Everything behind it waits its turn as well, keeping the column's spacing.
        for (const later of d.queue) later.at += RETRY;
        break;
      }
      d.queue.shift();
      const e = this.spawn(q.type, FOE, start.x, start.z, true, true);
      if (q.hp) { e.hp = e.maxHp = Math.round(e.maxHp * q.hp); this.setBaseHp(e); }
      if (q.bridger) e.bridger = true;
      if (q.mods) this.applyElite(e, q.mods);
      // A troop carrier keeps its passengers on board (saved with it) until its drop leg.
      if (q.cargo) { e.cargo = q.cargo.slice(); e.dropLeg = q.dropLeg; if (q.hp) e.cargoHp = q.hp; }
      const next = pts[1] || pts[0];
      e.angle = Math.atan2(next.x - e.x, next.z - e.z);
      // A route over a blown crossing is swapped for the nearest open one (bridge builders keep theirs).
      const route = !q.bridger && this.crossingClosed(this.crossingOf(q.route)) ? this.alternateRoute(q.route) || q.route : q.route;
      e.orders = [{ type: "route", route, leg: route === q.route ? 1 : nearestLeg(def.routes[route], e) }];
      spawned = true;
    }
    return spawned;
  },
};
