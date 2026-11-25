import balance from "../balance.json" with { type: "json" };
import { DEFINITIONS as D, distance } from "../data.js";
import { HOST_OF, workshopUnitsOf, EXPANDED } from "../factions.js";

// Field command army census (AAA round 3, R3-A). Mixed into Simulation through `ai` (sim/ai.js), and
// used only for a computer team under `rules.aiPlan === "field"` in a skirmish (fieldPlan): Classic,
// missions and Defence never call it.
//
// Every think the AI counts its own army (alive plus queued) by role and compares it with a target mix
// per faction (balance.json `ai_mix`). The Barracks and the Foundry then train toward the biggest
// shortfall they can fill; the enemy census (the intel memory, sim/ai-counter.js) raises the targets:
// anti-armour against vehicles, ranged against an infantry swarm, heavy guns against towers, and
// anti-air against flyers (a floor, not a share). Nothing is stored: the census is counted afresh.
//
//   role       units
//   front      melee infantry (Vanguard, Scrapper, Shade)
//   ranged     ranged infantry (Ranger, Rider, Drone)
//   heavy      vehicles and guns (Breaker, Scorcher, Tank, Walker)
//   antiarmor  Anti-tank teams and Watchers
//   support    Medics, Engineers, Supply wagons
//   workshop   the Expanded roster's workshop units (trained at the faction's host, sim/content/workshops.js)
//   air        armed flyers (trained at the core from spare resources, sim/ai-counter.js); counted only
// Unarmed scouts (the Kite) are left out of the census.
export const MIX = balance.ai_mix;
export const ROLES = Object.freeze(["front", "ranged", "heavy", "antiarmor", "support", "workshop", "air"]);

export function censusRole(type) {
  const d = D[type];
  if (!d || d.kind !== "unit" || type === "worker") return null;
  if (d.workshop) return "workshop";
  if (d.flying) return d.damage > 0 ? "air" : null;
  if (d.class === "support") return "support";
  if (d.class === "antiarmor") return "antiarmor";
  if (d.class === "armor" || d.class === "siege") return "heavy";
  if (d.class === "melee") return "front";
  if (d.class === "ranged") return "ranged";
  return null;
}

// The slot each role asks of a production building (mapped to the faction's own unit by typeFor).
const BARRACKS = { front: "vanguard", ranged: "ranger", antiarmor: "antitank", support: "medic" };
const FOUNDRY = { heavy: "breaker", support: "engineer" };

export const aiCensus = {
  // True once the census, join-fight and Kite scouting may run: from MIX.from seconds of match time (difficulty
  // guard, owner 2026-11-21: the opening plays as on r3-base, so the Field AI gains variety, not strength). Never at
  // Relaxed, the easy speed, which plays exactly as on r3-base (no workshop floor or stall breaker there either).
  aiCensusOn() { return this.aiSpeed !== "relaxed" && this.time >= (MIX.from ?? 0); },
  // The team's census: counts per role (alive plus queued), the anti-air count, the total, and the
  // target shares after the counter rules. `army` is updateAI's list (units, no Harvesters).
  aiCensusOf(team, own, army) {
    const counts = Object.fromEntries(ROLES.map((r) => [r, 0]));
    let antiAir = 0, total = 0;
    const add = (type) => {
      const role = censusRole(type);
      if (!role) return;
      counts[role]++;
      total++;
      if (D[type].hits_air) antiAir++;
    };
    for (const e of army) if (e.hp > 0) add(e.type);
    for (const b of own) for (const q of b.queue || []) add(q.type);
    const base = MIX[this.factionId(team)] || MIX.default, c = MIX.counter;
    const target = { ...MIX.default, ...base };
    // The enemy census, from what this side has seen (fog respected).
    const seen = this.seenMix(team);
    let airFloor = 0;
    if (seen.air) airFloor = seen.air * c.air_per_flyer + c.air_base;
    if (seen.total >= c.min_seen) {
      if (seen.mech / seen.total >= c.mech_share) target.antiarmor = Math.max(target.antiarmor, c.antiarmor_vs_mech);
      if (seen.infantry / seen.total >= c.infantry_share) target.ranged = Math.max(target.ranged, c.ranged_vs_infantry);
    }
    if (seen.towers >= c.towers) target.heavy = Math.max(target.heavy, c.heavy_vs_towers);
    return { counts, antiAir, total, target, airFloor };
  },
  // The roles a building can fill now, each with its unit type (or none).
  aiCensusOptions(team, b, army = null) {
    const slots = b.type === "barracks" ? BARRACKS : b.type === "foundry" ? FOUNDRY : null;
    if (!slots) return [];
    const out = [];
    for (const [role, slot] of Object.entries(slots)) {
      let type = this.typeFor(team, slot);
      // The Foundry's heavy role: the faction's Tank (or Walker) once the Foundry reaches its level.
      if (role === "heavy") { const tank = this.typeFor(team, "tank"); if (this.canTrain(team, tank) && b.level >= (D[tank].required_level || 1)) type = tank; }
      if (!this.canTrain(team, type) || b.level < (D[type].required_level || 1)) continue;
      if (role === "support" && army && !this.aiSupportUseful(team, army, type)) continue;
      out.push({ role, slot: this.slotOf(type), type });
    }
    return out;
  },
  // A support unit (Medic, Engineer, Supply wagon) is worth training only with patients for it: a Medic
  // needs 3 infantry fighters per Medic (this one included), an Engineer 2 vehicles per Engineer, a
  // wagon 3 fighters of any kind. Owner 2026-11-26: the AI trained Engineers and Medics with no
  // Breakers or soldiers to look after.
  aiSupportUseful(team, army, type) {
    const d = D[type];
    if (!d) return false;
    const slot = this.slotOf(type);
    const mine = army.filter((e) => e.type === type).length;
    const fits = slot === "engineer" ? (e) => e.mechanical : d.heals === "all" ? () => true : (e) => !e.mechanical;
    const patients = army.filter((e) => e.damage > 0 && !e.flying && D[e.type]?.class !== "support" && fits(e)).length;
    return patients >= (slot === "engineer" ? 2 : 3) * (mine + 1);
  },
  // The slot building `b` should train: the role with the biggest shortfall it can fill, or `choice`
  // (the earlier picks) when that already fills the neediest role or nothing is short.
  aiCensusPick(team, b, census, choice, army = null) {
    const options = this.aiCensusOptions(team, b, army);
    if (!options.length) return choice;
    // Flyers seen: the Barracks trains units that hit air until the floor is met.
    if (b.type === "barracks" && census.antiAir < census.airFloor) {
      const aa = options.find((o) => o.role === "ranged" && D[o.type].hits_air) || options.find((o) => D[o.type].hits_air);
      if (aa) return aa.slot;
    }
    const next = census.total + 1;
    let best = null, gap = 0;
    for (const o of options) {
      const short = (census.target[o.role] || 0) * next - census.counts[o.role];
      if (short > gap + 1e-9) { best = o; gap = short; }
    }
    if (!best) return choice;
    const chosen = censusRole(this.typeFor(team, choice));
    // The earlier pick already fills that role (a Tank against a Breaker for "heavy"): keep it.
    if (chosen === best.role) return choice;
    return best.slot;
  },
  // Expanded roster: alloy the Barracks keeps back so the faction's host can train its first workshop
  // unit (the census keeps at least one per host). 0 when there is none to wait for.
  aiCensusSave(team, own, census) {
    if (this.ruleOn("roster") !== EXPANDED || census.counts.workshop > 0) return 0;
    const host = HOST_OF[this.factionId(team)];
    const b = host && own.find((e) => e.type === host && e.complete && !e.levelJob);
    if (!b || b.queue.length) return 0;
    const type = workshopUnitsOf(this.factionId(team)).find((t) => b.trains?.includes(t) && b.level >= (D[t].required_level || 1));
    return type ? D[type].cost[0] : 0;
  },
  // S7 stall breaker: from MIX.stall.from seconds of match time, after MIX.stall.after seconds with no contact
  // (nothing of this side hit or fired) and with at least MIX.stall.min_units free fighters, the free army attack-moves on the nearest enemy building it has seen. Returns true when it sent one.
  aiBreakStall(team, own, hq, wave) {
    const s = MIX.stall;
    if (this.time < Math.max(s.after, s.from)) return false;
    let last = -Infinity;
    for (const e of own) last = Math.max(last, e.hitAt ?? -Infinity, e.shotAt ?? -Infinity);
    if (this.time - last < s.after) return false;
    const units = wave.filter((e) => e.damage > 0 && !e.orders.some((o) => o.aiw) && !e.flying);
    if (units.length < s.min_units) return false;
    let target = null, best = Infinity;
    for (const [id] of this.intel[team] || []) {
      const t = this.get(id);
      if (!t || t.hp <= 0 || t.kind !== "building" || !this.hostile(team, t.team)) continue;
      const d = distance(hq, t);
      if (d < best || (d === best && t.id < target.id)) { best = d; target = t; }
    }
    target ||= this.aiNearestCore(team, hq);
    if (!target) return false;
    this.aiLaunch(team, units, { x: target.x, z: target.z }, null, false);
    return true;
  },
  // Scouting (extends the Kite spotter, sim/ai-counter.js): an idle Kite with no attack to lead flies
  // the search pattern of scoutDestination, so the census has an enemy army to counter.
  aiScout(team, army) {
    for (const k of army) {
      if (!k.flying || k.damage > 0 || k.orders.length || k.hp <= 0) continue;
      const p = this.scoutDestination(team);
      if (p) this.issue([k.id], { type: "move", x: p.x, z: p.z });
    }
  },
};
