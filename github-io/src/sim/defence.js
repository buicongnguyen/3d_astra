import { DEFINITIONS as D, distance, hyp } from "../data.js";
import { difficultyRules } from "../difficulty.js";
import { waveCount } from "./missions.js";
import { CROSSINGS } from "../terrain.js";
import BALANCE from "../balance.json" with { type: "json" };
import GARRISONS from "../defence/garrisons.json" with { type: "json" };

// Frontier Defence (release 0.17, completed in 0.21): enemy waves walk fixed routes while the
// player crews towers on fixed pads. Everything this mode keeps is in `this.defence`, created
// only when the mission definition has a `defence` block, so every other match serializes (and
// hashes) exactly as before. Mixed into Simulation (see simulation.js).
// Format: docs/MISSIONS.md ("Frontier Defence levels").
//
// 0.21 adds, each only when the defence block asks for it (older blocks play exactly as before):
//  - tier-3 branches (`padBranch`), stored on the tower as `branch`;
//  - the commander (`commander: {x, z}`): one hero unit with Barrage and Reinforce, respawning;
//  - bridge demolition (`bridges: true`): `this.crossings`, created lazily, re-applied on load;
//    `bridger` groups build a pontoon over a blown crossing; waves reroute by `crossings`;
//  - mixed-faction waves: a group's `faction` resolves its slots with that faction's roster;
//  - endless waves (`endless: {seed}`), generated forever from the seed (endlessWave below);
//  - perks (`perks: [...]`, set only by the Defence menu, never by a campaign mission).
export { GARRISONS };
const TEAM = 0, FOE = 1;
// Seconds between spawn attempts when the spawn spot is still crowded.
const RETRY = 0.25;
// A route leg is done within this distance of its corner, or once the unit is past its end.
const CORNER = 1.5;
// Burning ground kept at once (as in sim/tactics.js); the oldest goes first.
const MAX_ZONES = 16;
// Half-width of the river's water (terrain water rectangles) and where a bridger waits on the bank.
const WATER = 3, BANK = 5.2;
// The commander is not sent within this many metres of a route's start (the spawn spot).
const SPAWN_CLEAR = 10;
// The units that hold a wave up this tick (the commander and Reinforce Vanguards), per simulation.
// Kept outside the simulation so it is never saved or hashed.
const BLOCKERS = new WeakMap();
// Troop carriers (0.22): seconds from the stop to the passengers stepping out, and from the last
// one out to the empty carrier driving on. A carrier waiting this long for room drops the rest
// where it stands.
const UNLOAD = 0.6, DEPART = 1, UNLOAD_MAX = 5;
// Build zones (0.23): metres a zone tower keeps from a road's centre line (half a lane, the widest
// wave body and the tower itself, with room to spare: the fixed pads keep the same) and from any
// other pad or tower.
const ZONE_CLEAR = 4.5, ZONE_GAP = 5;
// Distance from (x, z) to the segment a-b.
function segmentDistance(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return hyp(x - a.x - t * dx, z - a.z - t * dz);
}

// Where a unit walks on a route: its own lane, offset sideways from the centre line. At a corner
// the offset follows the bisector, so lanes do not cross.
function lanePoint(pts, i, lane) {
  const p = pts[i], a = pts[i - 1] || p, b = pts[i + 1] || p;
  const n1 = normal(a, p), n2 = normal(p, b);
  let nx = n1.x + n2.x, nz = n1.z + n2.z;
  const l = hyp(nx, nz);
  if (l < 1e-6) { nx = n1.x; nz = n1.z; } else { nx /= l; nz /= l; }
  // Keep the lane width on both legs (the bisector is longer at a corner), within reason.
  const scale = Math.min(1.6, 1 / Math.max(0.6, nx * n1.x + nz * n1.z || 1));
  return { x: p.x + nx * lane * scale, z: p.z + nz * lane * scale };
}
function normal(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz);
  return l < 1e-6 ? { x: 0, z: 0 } : { x: -dz / l, z: dx / l };
}
// The leg (index of its end point) of the route segment nearest to a point.
function nearestLeg(pts, p) {
  let best = 1, bestD = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const d = hyp(p.x - a.x - t * dx, p.z - a.z - t * dz);
    if (d < bestD - 1e-9) { best = i; bestD = d; }
  }
  return best;
}
const sideOf = (z) => (z >= 0 ? 1 : -1);
const crossing = (x) => CROSSINGS.find((c) => c.x === x) || null;

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
function palette(def) {
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
  const rnd = seeded((def.endless.seed >>> 0) ^ Math.imul(n + 1, 0x9e3779b1)), units = palette(def), routes = Object.keys(def.routes);
  const budget = 6 + n * 2.4 + Math.pow(n, 1.45) * 0.25;
  const groups = Math.min(4, 1 + Math.floor(n / 3));
  const hp = n < 10 ? 1 : Math.round((1 + (n - 9) * 0.06) * 100) / 100;
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

export const defence = {
  initDefence(def) {
    const lives = (def.lives ?? 20) + (this.hasPerk("reserves") ? GARRISONS.perks.reserves.lives : 0);
    this.defence = { lives, wave: 0, active: false, nextAt: def.firstWave ?? 30, queue: [], cleared: 0, leaked: 0, bounty: 0, called: 0 };
    const p = this.players[TEAM], alloy = typeof def.alloy === "object" ? def.alloy[this.difficulty] ?? def.alloy.standard : def.alloy;
    p.alloy = alloy ?? 250;
    p.energy = 0;
    // A level can open with a crossing already down (a river with one bridge and the ford).
    if (def.startBlown?.length) {
      this.crossings = {};
      for (const x of def.startBlown) this.crossings[x] = { state: "blown", at: 0, progress: 0 };
      this.applyCrossings(false);
    }
    if (def.commander) this.spawnCommander();
  },
  defenceDef() {
    return this.missionDef?.defence || null;
  },
  // Perks bought with stars (src/defence/progress.js). Only the Defence menu puts them on a level.
  hasPerk(id) {
    return !!this.missionDef?.defence?.perks?.includes(id);
  },
  defenceMaxLives() {
    const def = this.defenceDef();
    return (def?.lives ?? 20) + (this.hasPerk("reserves") ? GARRISONS.perks.reserves.lives : 0);
  },
  // Waves in the level: endless levels never run out.
  waveTotal() {
    const def = this.defenceDef();
    return def.endless ? Infinity : def.waves.length;
  },
  defenceWave(n) {
    const def = this.defenceDef();
    return def.endless ? endlessWave(def, n) : def.waves[n] || null;
  },
  // The crew of a garrison, resolved for this team's roster: the unit it is made from.
  crewType(crew, team = TEAM) {
    const g = GARRISONS.crews[crew];
    return g ? g.type || this.typeFor(team, g.slot) : null;
  },
  crewCost(crew, tier = 1) {
    return GARRISONS.crews[crew]?.cost[tier - 1] ?? null;
  },
  // What the next tower costs: the Quartermaster perk takes a fifth off the first one.
  buildCost(crew) {
    const cost = this.crewCost(crew, 1);
    return cost !== null && this.hasPerk("quartermaster") && !this.defence?.firstBuilt ? Math.round(cost * GARRISONS.perks.quartermaster.first) : cost;
  },
  branchCost(crew, branch) {
    return GARRISONS.crews[crew]?.branches?.[branch]?.cost ?? null;
  },
  // Tower figures for a crew at a tier (and its tier-3 branch), from the crew's own unit
  // (balance.json) and garrisons.json.
  garrisonStats(crew, tier, team = TEAM, branch = null) {
    const g = GARRISONS.crews[crew], type = this.crewType(crew, team), d = D[type], t = GARRISONS.tiers[tier - 1];
    const s = {
      name: g.name,
      damage: d.damage * g.damage * t.damage,
      interval: d.interval * (g.interval ?? 1) * t.interval,
      range: d.range + g.range + t.range,
      shot: d.shot || type,
      maxHp: Math.round(D.tower.hp * (GARRISONS.hp ?? 1) * t.hp),
      maxShield: D.tower.shield,
      level: tier,
    };
    if (d.splash_radius) { s.splash_radius = d.splash_radius * (g.splash ?? 1); s.splash_damage = d.splash_damage; }
    if (d.counter && g.counter !== false) { s.counter = d.counter; s.counter_bonus = d.counter_bonus; }
    // Armour: machines shrug off small arms and shrapnel (garrisons.json mech), not rockets.
    if (d.mechanical_bonus || g.mech) s.mechanical_bonus = (d.mechanical_bonus || 1) * (g.mech ?? 1);
    if (g.reveal) s.reveal = g.reveal;
    // A flame trap lays burning ground where it fires (the Burn line zones of sim/tactics.js).
    if (g.burn) s.burn = { dps: g.burn.dps * t.damage, radius: g.burn.radius, seconds: g.burn.seconds, every: g.burn.every };
    const b = tier >= 3 && branch ? g.branches?.[branch] : null;
    if (b) {
      s.branch = branch;
      s.damage *= b.damage ?? 1;
      s.interval *= b.interval ?? 1;
      s.range += b.range ?? 0;
      if (b.splash_radius) { s.splash_radius = b.splash_radius; s.splash_damage = b.splash_damage ?? 0.4; }
      else if (s.splash_radius) { s.splash_radius *= b.splash ?? 1; if (b.splash_damage) s.splash_damage = b.splash_damage; }
      if (b.mech) s.mechanical_bonus = (s.mechanical_bonus || 1) * b.mech;
      if (b.reveal) s.reveal = (s.reveal || 0) + b.reveal;
      if (b.slow) s.slow = { factor: b.slow.factor, seconds: b.slow.seconds };
      if (b.mark) s.beacon = { taken: b.mark.taken, seconds: b.mark.seconds };
      if (b.burn && s.burn) s.burn = { ...s.burn, dps: s.burn.dps * (b.burn.dps ?? 1), radius: s.burn.radius + (b.burn.radius ?? 0), seconds: s.burn.seconds * (b.burn.seconds ?? 1) };
    }
    // Air waves (0.18.3): in a level with rules.air, a crew whose unit hits air (Ranger, Anti-tank,
    // Watcher; never Breaker) makes the tower hit flyers too (sim/air.js canHit; towers do ×AIR.flak_bonus).
    if (d.hits_air && this.airAllowed()) s.hits_air = true;
    return s;
  },
  // A level's fixed pads, then the pads made in its build zones (0.23, `defence.zonePads`).
  padById(id) {
    return this.defenceDef()?.pads.find((p) => p.id === id) || this.defence?.zonePads?.find((p) => p.id === id) || null;
  },
  towerOn(padId) {
    return this.entities.find((e) => e.pad === padId && e.hp > 0) || null;
  },
  padBuild(team, padId, crew) {
    const def = this.defenceDef(), pad = this.padById(padId);
    if (!this.defence || this.result || team !== TEAM || !pad || !def.crews.includes(crew) || !GARRISONS.crews[crew]) return false;
    if (this.towerOn(padId)) return false;
    const cost = this.buildCost(crew);
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.crewTower(team, pad, crew, cost);
    return true;
  },
  // A garrison on a pad, paid for (padBuild and zoneBuild).
  crewTower(team, pad, crew, cost) {
    this.players[team].alloy -= cost;
    if (this.hasPerk("quartermaster")) this.defence.firstBuilt = true;
    const e = this.spawn("tower", team, pad.x, pad.z, true, true);
    e.pad = pad.id;
    e.crew = crew;
    e.tier = 1;
    e.spent = cost;
    this.setGarrison(e, 1);
    e.hp = e.maxHp;
    this.nav.rebuild(this.entities);
    this.events.push({ type: "padBuild", id: e.id, pad: pad.id, crew, team, x: e.x, z: e.z, ...(pad.zone ? { zone: pad.zone } : {}) });
    return e;
  },
  // ---------------------------------------------------------------- Build zones (0.23)
  // `defence.zones`: areas ({id, x, z, w, d} rectangles or {id, poly: [[x, z], ...]}) where a
  // crew may stand anywhere, on the 2 m navigation grid. A spot must keep clear of every road
  // (ZONE_CLEAR from a route's centre line, as the fixed pads do), the spawn spots and the exit,
  // and ZONE_GAP from every pad and tower. A build makes a pad of its own (`defence.zonePads`,
  // created on the first one), so Upgrade, branches and Sell work as on a fixed pad; selling
  // frees the spot. `max` caps the towers one zone takes.
  zoneById(id) {
    return this.defenceDef()?.zones?.find((z) => z.id === id) || null;
  },
  // The 2 m grid cell centre a spot snaps to.
  zoneSnap(x, z) {
    return this.terrain.worldAt(...this.terrain.cellAt(x, z));
  },
  inZone(zone, x, z) {
    if (zone.poly) {
      let inside = false;
      for (let i = 0, j = zone.poly.length - 1; i < zone.poly.length; j = i++) {
        const [xi, zi] = zone.poly[i], [xj, zj] = zone.poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    }
    return Math.abs(x - zone.x) <= zone.w / 2 && Math.abs(z - zone.z) <= zone.d / 2;
  },
  // The zone a snapped spot falls in, or null.
  zoneAt(x, z) {
    const p = this.zoneSnap(x, z);
    return this.defenceDef()?.zones?.find((zone) => this.inZone(zone, p.x, p.z)) || null;
  },
  // Why a crew may not stand at this snapped spot for terrain and roads alone (never changes in a
  // match, so the interface paints the open cells from it): "" when it may.
  zoneGround(x, z) {
    const def = this.defenceDef(), t = this.terrain, r = D.tower.radius;
    if (!t.canStand(x, z, r) || (t.plateaus.length && (t.cliff(x, z, r + 0.5) || t.onRamp(x, z, r + 1))) || (t.river && Math.abs(z) < 6)) return "Not on open ground.";
    if (Math.abs(x) > t.half - r - 2 || Math.abs(z) > t.half - r - 2) return "Too close to the edge of the map.";
    const clear = def.zoneClear ?? ZONE_CLEAR;
    for (const pts of Object.values(def.routes)) {
      if (hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR) return "Too close to where the enemy comes in.";
      for (let i = 1; i < pts.length; i++) if (segmentDistance(x, z, pts[i - 1], pts[i]) < clear) return "Too close to the road: the column must pass.";
    }
    if (hyp(def.exit.x - x, def.exit.z - z) < def.exit.r + 4) return "Too close to the exit.";
    return "";
  },
  // The full check for a crew in a zone at (x, z) (snapped): { x, z, zone } or { why }.
  zoneCheck(team, zoneId, x, z) {
    const zone = this.zoneById(zoneId);
    if (!this.defence || team !== TEAM || !zone || !Number.isFinite(x) || !Number.isFinite(z)) return { why: "Not a build zone." };
    const p = this.zoneSnap(x, z);
    if (!this.inZone(zone, p.x, p.z)) return { why: "Outside the build zone." };
    const ground = this.zoneGround(p.x, p.z);
    if (ground) return { why: ground };
    const gap = ZONE_GAP;
    if (this.defenceDef().pads.some((q) => hyp(q.x - p.x, q.z - p.z) < gap) || (this.defence.zonePads || []).some((q) => hyp(q.x - p.x, q.z - p.z) < gap) ||
      this.entities.some((e) => e.hp > 0 && e.kind === "building" && hyp(e.x - p.x, e.z - p.z) < gap))
      return { why: "Too close to another tower or pad." };
    if (zone.max && (this.defence.zonePads || []).filter((q) => q.zone === zoneId).length >= zone.max) return { why: `This zone holds ${zone.max} towers.` };
    if (this.entities.some((e) => e.hp > 0 && e.kind === "unit" && !e.flying && hyp(e.x - p.x, e.z - p.z) < D.tower.radius + e.radius + 0.3)) return { why: "Units are standing there." };
    if (this.nav.wouldSeal(p.x, p.z, D.tower.radius)) return { why: "That would wall in the ground behind it." };
    return { x: p.x, z: p.z, zone: zoneId };
  },
  zoneBuild(team, zoneId, x, z, crew) {
    const def = this.defenceDef();
    if (!this.defence || this.result || team !== TEAM || !def.zones || !def.crews.includes(crew) || !GARRISONS.crews[crew]) return false;
    const spot = this.zoneCheck(team, zoneId, x, z);
    if (spot.why) { this.message(spot.why, team); return false; }
    const cost = this.buildCost(crew);
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    const d = this.defence, n = (d.zoneNext ??= 1);
    d.zoneNext++;
    const pad = { id: `${zoneId}-${n}`, x: spot.x, z: spot.z, zone: zoneId };
    (d.zonePads ||= []).push(pad);
    this.crewTower(team, pad, crew, cost);
    return true;
  },
  setGarrison(e, tier) {
    const before = e.maxHp, s = this.garrisonStats(e.crew, tier, e.team, e.branch || null);
    Object.assign(e, s);
    e.tier = tier;
    e.hp = Math.min(e.maxHp, e.hp + Math.max(0, e.maxHp - before));
  },
  padUpgrade(team, id) {
    const e = this.get(id);
    if (!this.defence || this.result || !e || e.team !== team || !e.crew || e.tier >= 3) return false;
    const cost = this.crewCost(e.crew, e.tier + 1);
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    e.spent += cost;
    this.setGarrison(e, e.tier + 1);
    this.events.push({ type: "levelup", x: e.x, z: e.z, team: e.team, radius: e.radius, level: e.tier, seed: e.id, garrison: true });
    return true;
  },
  // A tier-3 tower takes one of its crew's two branches, once (garrisons.json crews[crew].branches).
  padBranch(team, id, branch) {
    const e = this.get(id), b = GARRISONS.crews[e?.crew]?.branches?.[branch];
    if (!this.defence || this.result || !e || e.team !== team || !b || e.tier < 3 || e.branch) return false;
    if (this.players[team].alloy < b.cost) { this.message(`Need ${Math.ceil(b.cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= b.cost;
    e.spent += b.cost;
    e.branch = branch;
    this.setGarrison(e, 3);
    this.events.push({ type: "levelup", x: e.x, z: e.z, team: e.team, radius: e.radius, level: 3, seed: e.id, garrison: true, branch });
    return true;
  },
  padSell(team, id) {
    const e = this.get(id);
    if (!this.defence || this.result || !e || e.team !== team || !e.crew) return false;
    const refund = Math.floor(e.spent * GARRISONS.sell);
    this.players[team].alloy += refund;
    e.hp = 0;
    // A zone tower's pad goes with it: the spot is free again.
    const zp = this.defence.zonePads, at = zp ? zp.findIndex((p) => p.id === e.pad) : -1;
    if (at >= 0) zp.splice(at, 1);
    this.nav.rebuild(this.entities);
    this.events.push({ type: "padSell", id: e.id, pad: e.pad, team, refund, x: e.x, z: e.z });
    return true;
  },
  // On-hit effects of a garrison's branch or crew (sim/combat.js hit): slow, mark, burning ground.
  garrisonHit(e, t) {
    if (t.kind === "unit" && e.slow) { t.slowUntil = this.time + e.slow.seconds; t.slowBy = e.slow.factor; }
    if (t.kind === "unit" && e.beacon) { t.markedUntil = this.time + e.beacon.seconds; t.markTaken = e.beacon.taken; }
    if (e.burn && this.time >= (e.burnAt ?? 0) - 1e-9) {
      e.burnAt = this.time + e.burn.every;
      (this.zones ||= []).push({ x: t.x, z: t.z, radius: e.burn.radius, until: this.time + e.burn.seconds, dps: e.burn.dps, team: e.team, by: e.id });
      if (this.zones.length > MAX_ZONES) this.zones.shift();
      this.events.push({ type: "ability", ability: "burnline", id: e.id, team: e.team, x: e.x, z: e.z, tx: t.x, tz: t.z, radius: e.burn.radius, duration: e.burn.seconds });
    }
  },
  // Sends the next wave now. The time left on the countdown pays a small bonus.
  waveCall(team) {
    const d = this.defence, def = this.defenceDef();
    if (!d || this.result || team !== TEAM || d.wave >= this.waveTotal() || d.queue.length) return false;
    const left = d.nextAt !== null ? Math.max(0, d.nextAt - this.time) : def.gap ?? 16;
    const bonus = Math.ceil(left * 2);
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
    return Object.entries(units).map(([slot, n]) => { const type = this.waveType(g, slot); return [type, waveCount(n, scale, D[type])]; });
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
      for (const [type, n] of this.waveUnits(g, g.units, scale)) {
        const carrier = !!D[type]?.carrier && ride > 0, key = carrier ? `${type}|${ride}` : type;
        const u = units.get(key) || { type, count: 0, ...(carrier ? { carry: ride, passengers: this.waveUnits(g, g.carry, scale).map(([t]) => t) } : {}) };
        u.count += n;
        units.set(key, u);
      }
    }
    return { wave: d.wave + 1, units: [...units.values()], routes };
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
      if (q.hp) e.hp = e.maxHp = Math.round(e.maxHp * q.hp);
      if (q.bridger) e.bridger = true;
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
  // The commander and Reinforce Vanguards standing in the way this tick (see BLOCKERS).
  blockersNow() {
    let c = BLOCKERS.get(this);
    if (!c || c.tick !== this.ticks || c.entities !== this.entities) {
      // An armour squad holding the road (0.23) never holds a column at its spawn spot (a move by
      // an ordinary order can take it there).
      const near = (e) => Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - e.x, pts[0].z - e.z) < SPAWN_CLEAR);
      c = { tick: this.ticks, entities: this.entities, list: this.entities.filter((e) => e.blocker && e.hp > 0 && !(e.squad && near(e))) };
      BLOCKERS.set(this, c);
    }
    return c.list;
  },
  // Route order (sim/stepEntity): walk the lane leg by leg, straight when the way is clear and
  // by the route search otherwise, firing on the move at whatever is in range. A wave never
  // stops or leaves its road to chase; only a blocker in its way (the commander, Reinforce) or a
  // blown crossing it is building over holds it.
  stepRoute(e, o, dt) {
    const def = this.defenceDef(), pts = def?.routes[o.route];
    if (!pts) { this.finish(e); return; }
    const foe = e.damage > 0 ? this.enemy(e, e.range, true) : null;
    if (foe) this.fight(e, foe, dt, false);
    const lane = ((e.id * 0.618) % 1 - 0.5) * (def.lane ?? 2.4);
    let target = null;
    for (let guard = 0; guard < pts.length; guard++) {
      if (o.leg >= pts.length) { o.leg = pts.length - 1; target = pts[o.leg]; break; }
      target = lanePoint(pts, o.leg, o.leg === pts.length - 1 ? 0 : lane);
      const a = pts[o.leg - 1], b = pts[o.leg], dx = b.x - a.x, dz = b.z - a.z;
      const past = ((e.x - a.x) * dx + (e.z - a.z) * dz) / (dx * dx + dz * dz || 1) >= 1;
      if (o.leg < pts.length - 1 && (distance(e, target) < CORNER || past)) { o.leg++; continue; }
      break;
    }
    // A bridge builder walks to the near bank of its blown crossing and waits there while the
    // pontoon goes up (stepCrossings counts the time).
    if (e.bridger && this.crossings) {
      const x = this.crossingOf(o.route);
      if (this.crossingClosed(x) && sideOf(e.z) === sideOf(pts[0].z)) {
        target = { x: x + lane, z: sideOf(pts[0].z) * BANK };
        if (distance(e, target) < 1.2) { e.moving = false; return; }
      }
    }
    // A troop carrier stops at its drop leg and lets its passengers out, then drives on empty.
    if ((e.cargo || e.departAt !== undefined) && this.stepCarrier(e, o, pts)) return;
    // Ground blockers hold ground units only: flyers pass over them.
    const blockers = e.flying ? [] : this.blockersNow();
    if (blockers.length) {
      const fx = target.x - e.x, fz = target.z - e.z;
      for (const b of blockers)
        if (b.team !== e.team && hyp(b.x - e.x, b.z - e.z) < b.radius + e.radius + 0.4 && (b.x - e.x) * fx + (b.z - e.z) * fz > 0) {
          if (!e.attacking) e.angle = Math.atan2(b.x - e.x, b.z - e.z);
          e.moving = false;
          return;
        }
    }
    const dx = target.x - e.x, dz = target.z - e.z, d = hyp(dx, dz);
    if (d < 0.05) { e.moving = false; return; }
    const step = Math.min(d, this.moveSpeed(e) * (def.pace ?? 1) * dt), next = { x: e.x + (dx / d) * step, z: e.z + (dz / d) * step };
    // Flyers (0.18.3) fly the same lane straight from corner to corner, over any ground.
    if (e.speed > 0 && (e.flying || this.nav.canTraverse(e, next, e.radius))) {
      e.x = next.x;
      e.z = next.z;
      // A unit firing keeps facing its target (turrets and the shot read the angle).
      if (!e.attacking) e.angle = Math.atan2(dx, dz);
      e.moving = true;
      e.path = [];
      e.stalled = 0;
      return;
    }
    this.move(e, target, dt, CORNER);
    // move() drops an order it cannot finish; a route is never dropped.
    if (e.orders[0] !== o) e.orders.unshift(o);
  },
  stepDefence(dt) {
    const d = this.defence, def = this.defenceDef();
    if (!d || !def || this.result) return;
    if (d.nextAt !== null && this.time >= d.nextAt - 1e-9 && d.wave < this.waveTotal()) this.startWave();
    if (d.queue.length) this.spawnQueued();
    if (this.crossings) this.stepCrossings(dt);
    if (d.hero) this.stepCommander();
    // Carriers at their stop let their passengers out (after the spawns, in entity order).
    for (const e of this.entities) if (e.cargo && e.unloadAt !== undefined && e.hp > 0 && this.time >= e.unloadAt - 1e-9) this.dropCargo(e);
    const exit = def.exit;
    // Enemies standing: of the newest wave, and of each earlier wave still held apart (d.open).
    let alive = 0, held = null;
    for (const e of this.entities) {
      // Reinforce Vanguards leave when their time is up.
      if (e.team === TEAM && e.expires !== undefined && e.hp > 0 && this.time >= e.expires - 1e-9) { e.hp = 0; e.orders = []; continue; }
      if (e.team !== FOE || e.kind !== "unit") continue;
      if (e.hp <= 0) {
        // Killed this tick (settle removes it next): one tenth of what it cost. A carrier that
        // falls before its drop takes its passengers with it, and pays their bounty too.
        if (!e.paid && !e.leaked) {
          e.paid = true;
          const worth = (type) => { const cost = D[type]?.cost || [0, 0]; return Math.ceil((cost[0] + cost[1]) * GARRISONS.bounty); };
          const lost = e.cargo?.length || 0, bounty = worth(e.type) + (lost ? e.cargo.reduce((a, type) => a + worth(type), 0) : 0);
          this.players[TEAM].alloy += bounty;
          d.bounty += bounty;
          this.events.push({ type: "bounty", amount: bounty, x: e.x, z: e.z, team: TEAM, ...(lost ? { carried: lost } : {}) });
          if (lost) {
            this.events.push({ type: "carrierDown", id: e.id, amount: bounty, carried: lost, x: e.x, z: e.z, team: TEAM });
            this.events.push({ type: "strike", x: e.x, z: e.z, radius: 3, team: TEAM, victims: [] });
            e.cargo = [];
          }
        }
        continue;
      }
      if (hyp(e.x - exit.x, e.z - exit.z) <= exit.r) {
        // Through the line: lives lost (two for heavy machines and carriers), and the unit leaves the field.
        const cost = (e.pop || 1) >= 3 ? 2 : 1;
        d.lives = Math.max(0, d.lives - cost);
        d.leaked += 1;
        e.leaked = true;
        e.hp = 0;
        e.orders = [];
        this.events.push({ type: "leak", lives: d.lives, cost, x: e.x, z: e.z, team: FOE });
        continue;
      }
      if (e.wave !== undefined && d.open) (held ||= new Map()).set(e.wave, (held.get(e.wave) || 0) + 1);
      else alive++;
    }
    // An earlier wave whose last unit fell: its bonus and the repair, once, oldest first.
    if (d.open) {
      for (const n of d.open.slice()) if (!held?.get(n)) { d.open.splice(d.open.indexOf(n), 1); this.creditWave(n); }
      if (!d.open.length) delete d.open;
    }
    if (d.active && !d.queue.length && !alive) {
      // Wave beaten: its bonus, every tower patched up, and the countdown to the next one.
      d.active = false;
      this.creditWave(d.wave);
      if (d.wave < this.waveTotal()) d.nextAt = this.time + (def.gap ?? 16);
    }
  },
  // Free spots for `count` units of radius r around (x, z): the middle, then rings of six every
  // 1.5 m (Reinforce), or with `inner` only the rings, from that radius out (a carrier's drop).
  ringSpots(x, z, r, count, inner = 0) {
    const spots = [];
    for (let k = inner ? 1 : 0; spots.length < count && k < (inner ? 25 : 24); k++) {
      const ring = k ? (inner || 1.5) + Math.floor((k - 1) / 6) * 1.5 : 0, angle = k * (Math.PI / 3) + (inner ? Math.floor((k - 1) / 6) * (Math.PI / 6) : 0);
      const p = { x: x + Math.cos(angle) * ring, z: z + Math.sin(angle) * ring };
      if (this.nav.canStand(p.x, p.z, r) && !spots.some((q) => hyp(q.x - p.x, q.z - p.z) < r * 2)) spots.push(p);
    }
    return spots;
  },
  // ---------------------------------------------------------------- Troop carriers (0.22)
  // A carrier (`carrier: true` in balance.json) holds `cargo`, the passengers' types in boarding
  // order, until it reaches route point `dropLeg`. There it stops (`unloadAt`), the squad steps
  // out around it on the road and walks on from the nearest leg, and the empty carrier waits
  // (`departAt`) and drives on. Called from stepRoute; true while the carrier stands still.
  stepCarrier(e, o, pts) {
    e.moving = false;
    if (!e.cargo) {
      if (this.time < e.departAt - 1e-9) return true;
      delete e.departAt;
      return false;
    }
    if (e.unloadAt === undefined) {
      if (o.leg <= Math.min(e.dropLeg ?? 1, pts.length - 2)) return false;
      e.unloadAt = this.time + UNLOAD;
      this.events.push({ type: "unload", id: e.id, x: e.x, z: e.z, count: e.cargo.length, team: FOE });
    }
    return true;
  },
  // The passengers out, in boarding order, on free spots around the carrier (stepDefence, after the
  // spawns). Any that find no room wait aboard for the next tick; after UNLOAD_MAX they step out
  // where the carrier stands.
  dropCargo(e) {
    const def = this.defenceDef(), o = e.orders[0], route = o?.type === "route" ? o.route : null, pts = route && def.routes[route];
    const r = Math.max(...e.cargo.map((type) => D[type]?.radius || 0.7));
    // The first ring clears the truck's long body (about twice its collision radius from the middle).
    const spots = this.ringSpots(e.x, e.z, r, e.cargo.length, e.radius * 2 + r + 0.2);
    if (this.time >= e.unloadAt + UNLOAD_MAX - 1e-9) while (spots.length < e.cargo.length) spots.push({ x: e.x, z: e.z });
    const out = [];
    for (const p of spots) {
      const type = e.cargo.shift(), u = this.spawn(type, FOE, p.x, p.z, true, true);
      if (e.cargoHp) u.hp = u.maxHp = Math.round(u.maxHp * e.cargoHp);
      if (e.wave !== undefined) u.wave = e.wave;
      u.angle = e.angle;
      // From the nearest leg, never back past the carrier's own (the squad does not walk back to the stop).
      if (pts) u.orders = [{ type: "route", route, leg: Math.max(nearestLeg(pts, u), o.leg) }];
      out.push(u.id);
    }
    if (out.length) this.events.push({ type: "drop", id: e.id, ids: out, x: e.x, z: e.z, team: FOE });
    if (!e.cargo.length) {
      delete e.cargo;
      delete e.cargoHp;
      delete e.unloadAt;
      delete e.dropLeg;
      e.departAt = this.time + DEPART;
    }
  },
  // ---------------------------------------------------------------- Commander (0.21)
  // One hero on the field (defence.commander {x, z}): a gold-trimmed unit of the player's roster
  // that holds where it is sent, never chases, blocks the road, and comes back 20 s after it falls.
  spawnCommander() {
    const def = this.defenceDef(), c = GARRISONS.commander, at = def.commander, type = this.typeFor(TEAM, c.slot);
    const e = this.spawn(type, TEAM, at.x, at.z, true, true);
    e.hero = true;
    e.blocker = true;
    e.name = c.name;
    e.hp = e.maxHp = Math.round(D[type].hp * c.hp);
    e.damage = D[type].damage * c.damage;
    e.interval = D[type].interval * c.interval;
    e.speed = c.speed;
    e.stance = "hold";
    e.ability = null;
    const exit = def.exit;
    e.angle = Math.atan2(-(exit.x - at.x), -(exit.z - at.z));
    const h = this.defence.hero;
    if (h) { h.id = e.id; h.deadAt = null; }
    else this.defence.hero = { id: e.id, deadAt: null, barrageAt: 0, reinforceAt: 0 };
    return e;
  },
  commander() {
    const h = this.defence?.hero;
    return h ? this.get(h.id) || null : null;
  },
  stepCommander() {
    const h = this.defence.hero;
    if (this.get(h.id)) return;
    if (h.deadAt === null) {
      h.deadAt = this.time;
      this.events.push({ type: "commanderDown", team: TEAM, back: GARRISONS.commander.respawn });
    } else if (this.time >= h.deadAt + GARRISONS.commander.respawn - 1e-9) {
      const e = this.spawnCommander();
      this.events.push({ type: "commanderBack", id: e.id, team: TEAM, x: e.x, z: e.z });
    }
  },
  // Seconds until an ability is ready again (0: ready).
  commanderCooldown(ability) {
    const h = this.defence?.hero;
    return h ? Math.max(0, (ability === "barrage" ? h.barrageAt : h.reinforceAt) - this.time) : null;
  },
  heroMove(team, x, z) {
    const e = this.commander();
    if (!this.defence || this.result || team !== TEAM || !e || !Number.isFinite(x) || !Number.isFinite(z) || !this.nav.canStand(x, z, e.radius)) return false;
    // Never onto the spot where the waves come in: the column would wait behind it for ever.
    if (Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR)) return false;
    e.orders = [{ type: "move", x, z }];
    e.path = [];
    e.stalled = 0;
    this.events.push({ type: "heroMove", id: e.id, team, x, z });
    return true;
  },
  // Barrage: the Breakers' shelling, called in by the commander. Reinforce: three Vanguards
  // dropped on the road who hold it for a while. Both within reach of the commander.
  heroCast(team, ability, x, z) {
    const e = this.commander(), h = this.defence?.hero, c = GARRISONS.commander;
    if (!this.defence || this.result || team !== TEAM || !e || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (ability === "barrage") {
      const a = c.barrage;
      if (this.time < h.barrageAt - 1e-9 || hyp(x - e.x, z - e.z) > a.range || this.hiddenTop({ x, z }, team)) return false;
      (this.strikes ||= []).push({ at: this.time + a.delay, x, z, team, by: e.id, damage: a.damage, radius: a.radius });
      h.barrageAt = this.time + a.cooldown * (this.hasPerk("gunnery") ? GARRISONS.perks.gunnery.cooldown : 1);
      this.events.push({ type: "ability", ability: "barrage", id: e.id, team, x: e.x, z: e.z, tx: x, tz: z, radius: a.radius, delay: a.delay });
      return true;
    }
    if (ability === "reinforce") {
      const a = c.reinforce, type = this.typeFor(team, a.slot), r = D[type].radius || 0.65;
      if (this.time < h.reinforceAt - 1e-9 || hyp(x - e.x, z - e.z) > a.range || !this.nav.canStand(x, z, r)) return false;
      if (Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR)) return false;
      for (const p of this.ringSpots(x, z, r, a.count)) {
        const v = this.spawn(type, team, p.x, p.z, true, true);
        v.blocker = true;
        v.stance = "hold";
        v.expires = this.time + a.seconds;
        v.angle = e.angle;
      }
      h.reinforceAt = this.time + a.cooldown;
      this.events.push({ type: "ability", ability: "reinforce", id: e.id, team, x: e.x, z: e.z, tx: x, tz: z, radius: 2.5 });
      return true;
    }
    return false;
  },
  // ---------------------------------------------------------------- Armour squads (0.23)
  // `defence.armour` ({ cap?, cost?, depot?: {x, z} }, over GARRISONS.armour): squads of `size`
  // tanks of the player's roster, bought at the depot (the commander's post unless the level names
  // one), up to `cap` in the field. A squad unit carries `squad` (its number) and `leash`: on Guard
  // it holds where it was sent, fires at whatever comes in range, chases only within the leash of
  // that spot and walks back (combat.js holdPost); on "Hold the road" it stands fast and blocks a
  // column like the commander. Moves go through `armourMove` (or any ordinary move order). A squad
  // that ends a wave with a tank left is refitted to full strength; a squad wiped out frees its slot.
  // State: `defence.armourNext` (the next squad number), created on the first purchase.
  armourRules() {
    const a = this.defenceDef()?.armour;
    return a ? { ...GARRISONS.armour, ...a } : null;
  },
  // The player's squads in the field: [{ squad, units }] by squad number.
  armourSquads() {
    const out = new Map();
    for (const e of this.entities) if (e.squad && e.team === TEAM && e.hp > 0) { if (!out.has(e.squad)) out.set(e.squad, []); out.get(e.squad).push(e); }
    return [...out].sort((a, b) => a[0] - b[0]).map(([squad, units]) => ({ squad, units }));
  },
  armourUnits(squad) {
    return this.entities.filter((e) => e.squad === squad && e.team === TEAM && e.hp > 0);
  },
  // Why a squad cannot be bought now ("" when it can).
  armourWhy(team = TEAM) {
    const a = this.armourRules();
    if (!this.defence || this.result || team !== TEAM || !a) return "No armour depot here.";
    if (this.armourSquads().length >= a.cap) return `All ${a.cap} armour squads are in the field.`;
    if (this.players[team].alloy < a.cost) return `Need ${Math.ceil(a.cost - this.players[team].alloy)} more alloy.`;
    return "";
  },
  spawnArmour(type, x, z, squad, angle) {
    const a = this.armourRules(), e = this.spawn(type, TEAM, x, z, true, true);
    e.squad = squad;
    e.leash = a.leash;
    if (a.hp !== 1) e.hp = e.maxHp = Math.round(e.maxHp * a.hp);
    if (a.damage !== 1) e.damage *= a.damage;
    e.angle = angle;
    e.post = { x, z };
    return e;
  },
  armourBuy(team) {
    const why = this.armourWhy(team);
    if (why) { if (this.armourRules()) this.message(why, team); return false; }
    const a = this.armourRules(), def = this.defenceDef(), at = a.depot || def.commander || def.exit, type = this.typeFor(team, a.slot), r = D[type].radius || 1;
    const spots = this.ringSpots(at.x, at.z, r + 0.1, a.size, r * 2 + 0.6);
    if (!spots.length) { this.message("The depot is crowded: move the squads off it first.", team); return false; }
    this.players[team].alloy -= a.cost;
    const d = this.defence, squad = (d.armourNext ??= 1);
    d.armourNext++;
    const angle = Math.atan2(-(def.exit.x - at.x), -(def.exit.z - at.z));
    const ids = spots.map((p) => this.spawnArmour(type, p.x, p.z, squad, angle).id);
    this.events.push({ type: "armourBuy", squad, ids, team, x: at.x, z: at.z });
    return true;
  },
  // A squad sent to a spot: never onto a spawn spot (a squad holding the road there would hold
  // every column for ever), anywhere else it can stand.
  armourMove(team, squad, x, z) {
    const units = this.armourUnits(squad);
    if (!this.defence || this.result || team !== TEAM || !units.length || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (!this.nav.canStand(x, z, units[0].radius)) return false;
    if (Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR)) return false;
    this.issue(units.map((e) => e.id), { type: "move", x, z });
    this.events.push({ type: "armourMove", squad, ids: units.map((e) => e.id), team, x, z });
    return true;
  },
  // "guard" (the default) or "road": hold fast and block the column.
  armourMode(team, squad, mode) {
    const units = this.armourUnits(squad);
    if (!this.defence || this.result || team !== TEAM || !units.length || !["guard", "road"].includes(mode)) return false;
    for (const e of units) {
      if (mode === "road") { e.stance = "hold"; e.blocker = true; e.road = true; }
      else { delete e.stance; delete e.blocker; delete e.road; }
    }
    this.events.push({ type: "armourMode", squad, mode, team });
    return true;
  },
  armourModeOf(squad) {
    return this.armourUnits(squad)[0]?.road ? "road" : "guard";
  },
  // Wave beaten: every squad still in the field is mended and brought back to full strength
  // beside its first tank.
  refitArmour() {
    const a = this.armourRules();
    if (!a) return;
    for (const { squad, units } of this.armourSquads()) {
      for (const e of units) { e.hp = e.maxHp; e.shield = e.maxShield; }
      const lead = units[0], missing = a.size - units.length;
      if (missing <= 0) continue;
      const spots = this.ringSpots(lead.x, lead.z, lead.radius + 0.1, missing, lead.radius * 2 + 0.6);
      for (const p of spots) {
        const e = this.spawnArmour(lead.type, p.x, p.z, squad, lead.angle);
        if (lead.road) { e.stance = "hold"; e.blocker = true; e.road = true; }
      }
      this.events.push({ type: "armourRefit", squad, team: TEAM, x: lead.x, z: lead.z });
    }
  },
  // ---------------------------------------------------------------- Crossings (0.21)
  // `this.crossings` = { [x]: { state: "fuse" | "blown" | "pontoon", at, progress } }, created on
  // the first demolition. The terrain (derived, never saved) is rebuilt from it here: on every
  // change, and by snapshot.restore before the navigation grid, so a loaded match keeps the river.
  applyCrossings(rebuild = true) {
    if (!this.crossings) return;
    const t = this.terrain, blown = [], pontoons = [];
    t.baseWater ??= t.water.slice();
    for (const [key, c] of Object.entries(this.crossings)) {
      if (c.state === "blown") blown.push(Number(key));
      else if (c.state === "pontoon") pontoons.push(Number(key));
    }
    t.water = [...t.baseWater, ...blown.map((x) => { const c = crossing(x); return { left: x - c.half, right: x + c.half, top: -WATER, bottom: WATER }; })];
    t.blown = new Set(blown);
    t.pontoons = pontoons;
    if (rebuild) this.nav.rebuild(this.entities);
  },
  // The crossing a route goes over (defence.crossings: route id -> crossing x), or null.
  crossingOf(route) {
    const x = this.defenceDef()?.crossings?.[route];
    return Number.isFinite(x) ? x : null;
  },
  crossingState(x) {
    return this.crossings?.[x]?.state || "open";
  },
  // A crossing nobody can walk over: blown and not (yet) bridged.
  crossingClosed(x) {
    return x !== null && this.crossings?.[x]?.state === "blown";
  },
  // The crossings the level's routes use (every crossing when the level lists none).
  routeCrossings() {
    const map = this.defenceDef()?.crossings;
    return map ? [...new Set(Object.values(map))] : CROSSINGS.map((c) => c.x);
  },
  // The nearest open route over another crossing, for a group whose crossing is down.
  alternateRoute(route) {
    const def = this.defenceDef(), from = this.crossingOf(route);
    let best = null, bestD = Infinity;
    for (const [id, x] of Object.entries(def.crossings || {})) {
      if (id === route || x === from || !def.routes[id] || this.crossingClosed(x) || this.crossingState(x) === "fuse") continue;
      const d = Math.abs(x - (from ?? 0));
      if (d < bestD) { best = id; bestD = d; }
    }
    return best;
  },
  canDemolish(team, x) {
    const def = this.defenceDef(), c = crossing(x);
    if (!this.defence || this.result || team !== TEAM || !def?.bridges || !this.terrain.river || !c) return "";
    if (c.type !== "bridge") return "The ford cannot be blown.";
    const state = this.crossingState(x);
    if (state === "fuse" || state === "blown") return "";
    // The route never seals: another crossing the waves use must stay open.
    if (!this.routeCrossings().some((u) => u !== x && this.crossingState(u) !== "blown" && this.crossingState(u) !== "fuse")) return "That is the last way across: it must stay open.";
    return "ok";
  },
  demolish(team, x) {
    const why = this.canDemolish(team, x);
    if (why !== "ok") { if (why) this.message(why, team); return false; }
    const cost = GARRISONS.demolish.cost, fuse = GARRISONS.demolish.fuse;
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    (this.crossings ||= {})[x] = { state: "fuse", at: this.time + fuse, progress: 0 };
    this.events.push({ type: "fuse", x, z: 0, at: this.time + fuse, team });
    return true;
  },
  stepCrossings(dt) {
    for (const [key, c] of Object.entries(this.crossings)) {
      const x = Number(key);
      if (c.state === "fuse" && this.time >= c.at - 1e-9) this.blowCrossing(x, c);
      else if (c.state === "blown") this.stepPontoon(x, c, dt);
    }
  },
  // The charge goes off: anyone on the span is thrown to the nearer bank (by the sign of z) and
  // hurt, the river closes over the crossing and the waves that meant to use it turn aside.
  blowCrossing(x, c) {
    const span = crossing(x), hurt = GARRISONS.demolish.damage;
    c.state = "blown";
    c.at = this.time;
    c.progress = 0;
    for (const e of this.entities) {
      if (e.hp <= 0 || e.kind !== "unit" || e.flying || Math.abs(e.x - x) >= span.half + e.radius || Math.abs(e.z) >= WATER + e.radius) continue;
      e.z = sideOf(e.z) * (WATER + e.radius + 0.3);
      e.path = [];
      e.escape = null;
      this.applyDamage(e, hurt, TEAM, null);
    }
    this.applyCrossings();
    this.rerouteWaves(x);
    this.events.push({ type: "demolish", x, z: 0, team: TEAM });
    this.events.push({ type: "strike", x, z: 0, radius: span.half, team: TEAM, victims: [] });
  },
  rerouteWaves(x) {
    const def = this.defenceDef();
    for (const e of this.entities) {
      if (e.team !== FOE || e.kind !== "unit" || e.hp <= 0 || e.bridger) continue;
      const o = e.orders[0];
      if (o?.type !== "route" || this.crossingOf(o.route) !== x || sideOf(e.z) !== sideOf(def.routes[o.route][0].z)) continue;
      const alt = this.alternateRoute(o.route);
      if (!alt) continue;
      o.route = alt;
      o.leg = nearestLeg(def.routes[alt], e);
      e.path = [];
    }
  },
  // Bridge builders at the bank put a pontoon over a blown crossing in GARRISONS.demolish.pontoon
  // seconds; if every builder heading for it falls, the work is lost.
  stepPontoon(x, c, dt) {
    const def = this.defenceDef();
    let builders = 0, working = false;
    for (const e of this.entities) {
      if (e.team !== FOE || !e.bridger || e.hp <= 0 || e.orders[0]?.type !== "route" || this.crossingOf(e.orders[0].route) !== x) continue;
      const start = def.routes[e.orders[0].route][0];
      if (sideOf(e.z) !== sideOf(start.z)) continue;
      builders++;
      if (Math.abs(e.x - x) < 4 && Math.abs(e.z - sideOf(start.z) * BANK) < 2) working = true;
    }
    if (!builders) { if (c.progress) c.progress = 0; return; }
    if (!working) return;
    c.progress += dt;
    if (c.progress >= GARRISONS.demolish.pontoon - 1e-9) {
      c.state = "pontoon";
      c.at = this.time;
      this.applyCrossings();
      this.events.push({ type: "pontoon", x, z: 0, team: FOE });
    }
  },
  // Called from missionResult(): lives decide defeat, the last wave beaten decides victory.
  // Endless never ends in victory: the score is the waves held.
  defenceResult() {
    const d = this.defence, def = this.defenceDef(), m = this.mission;
    if (!d || !def) return null;
    const lost = d.lives <= 0;
    const won = !lost && !def.endless && d.wave >= def.waves.length && !d.active && !d.queue.length && !d.open;
    if (!lost && !won) return null;
    if (won) {
      for (const o of this.missionDef.objectives) this.setObjective(o.id, "done");
      const medals = this.missionDef.medals || {};
      m.medal = medals.gold && d.lives >= medals.gold.lives ? "gold" : medals.silver && d.lives >= medals.silver.lives ? "silver" : "bronze";
    } else for (const o of this.missionDef.objectives) this.setObjective(o.id, "failed");
    this.events.push({ type: "missionEnd", result: won ? "victory" : "defeat", medal: m.medal, seconds: m.clock, lives: d.lives, stars: won ? starsFor(m.medal) : 0, ...(def.endless ? { endless: true, score: d.cleared } : {}) });
    return won ? "victory" : "defeat";
  },
  // What the interface shows: lives, wave n of N, the countdown and whether a wave can be called.
  defenceStatus() {
    const d = this.defence, def = this.defenceDef();
    if (!d || !def) return null;
    const total = this.waveTotal();
    return {
      lives: d.lives, maxLives: this.defenceMaxLives(), wave: d.wave, waves: Number.isFinite(total) ? total : null, active: d.active || !!d.open, endless: !!def.endless,
      countdown: d.nextAt !== null ? Math.max(0, d.nextAt - this.time) : null,
      canCall: !this.result && d.wave < total && !d.queue.length,
      enemies: this.entities.filter((e) => e.team === FOE && e.kind === "unit" && e.hp > 0).length,
    };
  },
};
export const starsFor = (medal) => ({ gold: 3, silver: 2, bronze: 1 })[medal] || 0;
