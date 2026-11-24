// Pads, zones, garrisons and their on-hit effects (the start of the Defence mixin).
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { DEFINITIONS as D, hyp } from "../../data.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, SPAWN_CLEAR, ZONE_CLEAR, ZONE_GAP, segmentDistance, crossing } from "./common.js";
import { endlessWave } from "./waves.js";
import { applyHitEffects, pierceShield, burstStep } from "../effects.js";

export const towers = {
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
  // The next rank of a branch (0.24): its entry in garrisons.json (cost and effects), or null at the top.
  rankOf(crew, branch, rank) {
    return GARRISONS.crews[crew]?.branches?.[branch]?.ranks?.[rank] ?? null;
  },
  // Tower figures for a crew at a tier (and its tier-3 branch, and that branch's ranks), from the
  // crew's own unit (balance.json) and garrisons.json. 0.24: front-line crews carry their own hp
  // factor (crews[crew].hp).
  garrisonStats(crew, tier, team = TEAM, branch = null, rank = 0) {
    const g = GARRISONS.crews[crew], type = this.crewType(crew, team), d = D[type], t = GARRISONS.tiers[tier - 1];
    const s = {
      name: g.name,
      damage: d.damage * g.damage * t.damage,
      interval: d.interval * (g.interval ?? 1) * t.interval,
      // A short-reach crew may add its own metres a tier (garrisons.json tier_range) in place of the shared tiers[].range.
      range: d.range + g.range + (g.tier_range?.[tier - 1] ?? t.range),
      shot: d.shot || type,
      maxHp: Math.round(D.tower.hp * (GARRISONS.hp ?? 1) * t.hp * (g.hp ?? 1)),
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
      // Branch ranks (0.24), in order, each on top of the last: the same keys as a branch, plus
      // hp (multiplies), splash_add (metres of blast), pierce (share of a target's shield the shot
      // passes), burst (shots fired close together), slow_radius / mark_radius (the effect spreads
      // to enemies that near the target) and burn.every (multiplies).
      let hp = 1;
      for (let i = 0; i < rank; i++) {
        const r = b.ranks?.[i];
        if (!r) break;
        hp *= r.hp ?? 1;
        s.damage *= r.damage ?? 1;
        s.interval *= r.interval ?? 1;
        s.range += r.range ?? 0;
        if (r.mech) s.mechanical_bonus = (s.mechanical_bonus || 1) * r.mech;
        if (r.reveal) s.reveal = (s.reveal || 0) + r.reveal;
        if (s.splash_radius) { s.splash_radius = s.splash_radius * (r.splash ?? 1) + (r.splash_add ?? 0); if (r.splash_damage) s.splash_damage = r.splash_damage; }
        if (r.pierce) s.pierce = r.pierce;
        if (r.burst) s.burst = { shots: r.burst.shots, gap: r.burst.gap };
        if (r.slow) s.slow = { factor: r.slow.factor, seconds: r.slow.seconds };
        if (r.slow_radius) s.slow_radius = r.slow_radius;
        if (r.mark) s.beacon = { taken: r.mark.taken, seconds: r.mark.seconds };
        if (r.mark_radius) s.mark_radius = r.mark_radius;
        if (r.burn && s.burn) s.burn = { ...s.burn, dps: s.burn.dps * (r.burn.dps ?? 1), radius: s.burn.radius + (r.burn.radius ?? 0), seconds: s.burn.seconds * (r.burn.seconds ?? 1), every: s.burn.every * (r.burn.every ?? 1) };
      }
      if (rank) { s.maxHp = Math.round(s.maxHp * hp); s.branchRank = rank; }
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
    const before = e.maxHp, s = this.garrisonStats(e.crew, tier, e.team, e.branch || null, e.branchRank || 0);
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
  // A branched tower takes its next rank (0.24): up to the branch's ranks, each once, in order.
  padRank(team, id) {
    const e = this.get(id), r = e?.branch ? this.rankOf(e.crew, e.branch, e.branchRank || 0) : null;
    if (!this.defence || this.result || !e || e.team !== team || !e.crew || !r) return false;
    if (this.players[team].alloy < r.cost) { this.message(`Need ${Math.ceil(r.cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= r.cost;
    e.spent += r.cost;
    e.branchRank = (e.branchRank || 0) + 1;
    this.setGarrison(e, 3);
    this.events.push({ type: "levelup", x: e.x, z: e.z, team: e.team, radius: e.radius, level: 3, seed: e.id, garrison: true, branch: e.branch, rank: e.branchRank });
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
  // The bodies live in sim/effects.js (applyHitEffects); these wrappers keep the method names.
  garrisonHit(e, t) {
    applyHitEffects(this, e, t);
  },
  // A shot of a piercing rank (0.24): that share of the target's shield is set aside while the
  // shot lands, so it goes through to the hull; what was set aside comes back after.
  garrisonPierce(e, t, land) {
    pierceShield(e, t, land);
  },
  // A burst rank (0.24): the shots of a burst come `gap` seconds apart, then the full reload.
  garrisonBurst(e) {
    burstStep(e);
  },
  // Field repair (0.24, garrisons.json repair): a garrison not hit for `delay` seconds mends
  // `rate` of its health a second, between waves and during them; an armour squad of Rank 2
  // mends at its own rate (`mend`). Only Defence matches run this (stepDefence).
  fieldRepair(dt) {
    const r = GARRISONS.repair;
    for (const e of this.entities) {
      if (e.team !== TEAM || e.hp <= 0 || e.hp >= e.maxHp || !(e.crew || e.mend)) continue;
      if (this.time - (e.hitAt ?? -Infinity) < r.delay - 1e-9) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (e.crew ? r.rate : e.mend) * dt);
    }
  },
};
