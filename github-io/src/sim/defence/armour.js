// Armour squads.
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { DEFINITIONS as D, hyp } from "../../data.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, SPAWN_CLEAR } from "./common.js";

export const armour = {
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
  // A squad tank; a refit one (`like`, a tank of the squad) comes with the squad's upgrades.
  spawnArmour(type, x, z, squad, angle, like = null) {
    const a = this.armourRules(), e = this.spawn(type, TEAM, x, z, true, true);
    e.squad = squad;
    e.leash = a.leash;
    if (a.hp !== 1) { e.hp = e.maxHp = Math.round(e.maxHp * a.hp); this.setBaseHp(e); }
    if (a.damage !== 1) e.damage *= a.damage;
    e.angle = angle;
    e.post = { x, z };
    if (like?.squadRank) this.armourBoost(e, this.armourGains(1, null), this.armourGains(like.squadRank, like.squadBranch || null, !!like.combined), like.squadRank, like.squadBranch || null);
    if (like?.combined) e.combined = true;
    return e;
  },
  // ---------------------------------------------------------------- Armour upgrades (0.24)
  // GARRISONS.armour.rank2 then one of armour.branches (Assault or Bulwark), bought for a squad
  // from its sheet (`armourUpgrade`), kept on its tanks (`squadRank`, `squadBranch`, created on
  // the first upgrade) and given to the tanks a refit brings. hp, damage and mech multiply,
  // interval multiplies, leash adds; `repair` is the share of health a tank mends a second once
  // it has not been hit for GARRISONS.repair.delay seconds (`mend`).
  // `combined` (AAA round 3, R3-C): the squad's branch plus the other one (GARRISONS.armour.combined),
  // every branch's hp, damage, interval and mech, the best repair, and the leash set back to the
  // squad's own (the owner's decision O3: a Combined squad holds within the default 9 m).
  armourGains(rank, branch, combined = false) {
    const a = GARRISONS.armour, g = { hp: 1, damage: 1, interval: 1, mech: 1, leash: 0, repair: 0 };
    const branches = combined && branch && a.branches ? Object.keys(a.branches).map((id) => a.branches[id]) : [branch ? a.branches?.[branch] : null];
    for (const u of [rank >= 2 ? a.rank2 : null, ...branches]) {
      if (!u) continue;
      g.hp *= u.hp ?? 1; g.damage *= u.damage ?? 1; g.interval *= u.interval ?? 1; g.mech *= u.mech ?? 1; g.leash += u.leash ?? 0;
      if (u.repair) g.repair = combined ? Math.max(g.repair, u.repair) : u.repair;
    }
    if (combined && branch) g.leash = 0;
    return g;
  },
  // One tank from the gains `from` to `to`: health grows by what the upgrade adds. Its health
  // before ranks (baseHp) grows the same way, so a later promotion keeps the upgrade. A tank
  // without baseHp (a plain squad tank, or one saved before baseHp existed) has its type's health
  // times the squad's factor and the gains it already has.
  armourBoost(e, from, to, rank, branch) {
    const max = Math.round((e.maxHp / from.hp) * to.hp);
    e.hp = Math.min(max, e.hp + Math.max(0, max - e.maxHp));
    e.maxHp = max;
    if (to.hp !== from.hp) this.setBaseHp(e, Math.round(((e.baseHp ?? D[e.type].hp * (this.armourRules()?.hp ?? 1) * from.hp) / from.hp) * to.hp));
    e.damage = (e.damage / from.damage) * to.damage;
    e.interval = (e.interval / from.interval) * to.interval;
    if (to.mech !== from.mech) e.mechanical_bonus = ((e.mechanical_bonus || 1) / from.mech) * to.mech;
    e.leash += to.leash - from.leash;
    if (to.repair) e.mend = to.repair;
    e.squadRank = rank;
    if (branch) e.squadBranch = branch;
  },
  // What the squad's next upgrade is: { kind: "rank" | "branch", cost } or null when it has both.
  armourNextUpgrade(squad) {
    const lead = this.armourUnits(squad)[0], a = GARRISONS.armour;
    if (!lead || !a.rank2) return null;
    if ((lead.squadRank || 1) < 2) return { kind: "rank", cost: a.rank2.cost };
    if (!lead.squadBranch && a.branches) return { kind: "branch", costs: Object.fromEntries(Object.entries(a.branches).map(([id, b]) => [id, b.cost])) };
    return null;
  },
  // Rank 2 (no branch given), then one branch, once; then Combined (`combined` true, no branch).
  armourUpgrade(team, squad, branch = null, combined = false) {
    if (combined) return this.armourCombine(team, squad);
    const units = this.armourUnits(squad), a = GARRISONS.armour, next = this.armourNextUpgrade(squad);
    if (!this.defence || this.result || team !== TEAM || !this.armourRules() || !units.length || !next) return false;
    if (next.kind === "rank" ? branch : !a.branches?.[branch]) return false;
    const cost = next.kind === "rank" ? next.cost : a.branches[branch].cost;
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    const lead = units[0], rank = next.kind === "rank" ? 2 : lead.squadRank, from = this.armourGains(lead.squadRank || 1, lead.squadBranch || null), to = this.armourGains(rank, branch);
    for (const e of units) this.armourBoost(e, from, to, rank, branch);
    this.events.push({ type: "armourUpgrade", squad, rank, ...(branch ? { branch } : {}), ids: units.map((e) => e.id), team, x: lead.x, z: lead.z });
    return true;
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
        const e = this.spawnArmour(lead.type, p.x, p.z, squad, lead.angle, lead);
        if (lead.road) { e.stance = "hold"; e.blocker = true; e.road = true; }
      }
      this.events.push({ type: "armourRefit", squad, team: TEAM, x: lead.x, z: lead.z });
    }
  },
};

// The Combined squad step (AAA round 3, R3-C). Two Simulation methods outside the `armour` mixin above,
// whose keys tests/mixins.test.js pins: src/sim/content/barracks-veterans.js (R3-C's content module)
// adds them to the Simulation through its `mixin`.
export const combinedSquads = {
  // What the Combined step costs this squad now (GARRISONS.armour.combined.cost), or null: only after
  // its branch, once. Kept apart from armourNextUpgrade, which tools/defence-bot.mjs reads, so the
  // Defence bot never buys it and check:defence keeps its numbers.
  armourCombinedCost(squad) {
    const lead = this.armourUnits(squad)[0], c = GARRISONS.armour.combined;
    return c && lead?.squadBranch && !lead.combined ? c.cost : null;
  },
  // The Combined step: the squad's tanks gain the other branch too. The lazy `combined` flag on each
  // tank (kept by a refit) is what the view draws the gold trim from (R3-K).
  armourCombine(team, squad) {
    const units = this.armourUnits(squad), cost = this.armourCombinedCost(squad);
    if (!this.defence || this.result || team !== TEAM || !this.armourRules() || !units.length || cost === null) return false;
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    const lead = units[0], rank = lead.squadRank || 1, branch = lead.squadBranch, from = this.armourGains(rank, branch), to = this.armourGains(rank, branch, true);
    for (const e of units) { this.armourBoost(e, from, to, rank, branch); e.combined = true; }
    this.events.push({ type: "armourUpgrade", squad, rank, branch, combined: true, ids: units.map((e) => e.id), team, x: lead.x, z: lead.z });
    return true;
  },
};
