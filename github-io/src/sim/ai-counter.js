import { DEFINITIONS as D, distance } from "../data.js";

// How the computer opponent reads the battlefield and spends a surplus (0.9.1). Mixed into Simulation.
// Everything here uses vision only: the AI remembers enemies it has actually seen (id -> type) and
// forgets them when it sees them die or vanish from the match. Normal and faster speeds only;
// `pace.counter` is unset for Relaxed, which stays simple.
const MAX_SEEN = 400;
// Share of the seen army that must be of one kind before the AI reacts to it.
const MECH_SHARE = 0.4, INFANTRY_SHARE = 0.6, MIN_SEEN = 4;
// Units below this share of health retreat to a Medic until healed past RECOVER.
export const HURT = 0.35, RECOVER = 0.7;

export const aiCounter = {
  // Adds every hostile fighter, tower or core this team can see right now to its memory, and drops ones
  // that no longer exist. Fog is respected: an unseen unit is never added.
  observeEnemies(team) {
    const seen = (this.intel[team] ||= new Map());
    for (const [id] of seen) {
      const e = this.get(id);
      if (!e || e.hp <= 0) seen.delete(id);
    }
    for (const e of this.entities) {
      if (e.hp <= 0 || e.type === "worker" || e.kind === "wall" || !this.hostile(team, e.team)) continue;
      if (seen.has(e.id) || !this.isVisible(e, team)) continue;
      if (seen.size >= MAX_SEEN) break;
      seen.set(e.id, e.type);
    }
    return seen;
  },
  // Counts of what the AI believes the enemy fields: { mech, infantry, towers, total }.
  seenMix(team) {
    const mix = { mech: 0, infantry: 0, towers: 0, total: 0 };
    for (const type of (this.intel[team] || new Map()).values()) {
      const d = D[type];
      if (d.kind === "building") { if (type === "tower") mix.towers++; continue; }
      mix.total++;
      if (d.mechanical) mix.mech++; else mix.infantry++;
    }
    return mix;
  },
  // Adjusts the unit a building was about to train to the enemy mix. `choice` is the default pick.
  counterChoice(team, b, army, choice) {
    if (!this.pace.counter) return choice;
    const mix = this.seenMix(team);
    if (mix.total < MIN_SEEN && mix.towers < 2) return choice;
    const have = (type) => army.filter((e) => this.slotOf(e.type) === type).length;
    if (b.type === "barracks") {
      // Many vehicles: rockets (Anti-tank, Level 2) up to half of the seen vehicles; else Rangers.
      if (mix.total >= MIN_SEEN && mix.mech / mix.total >= MECH_SHARE)
        return b.level >= 2 && have("antitank") < Math.ceil(mix.mech / 2) + 2 ? "antitank" : "ranger";
      // Infantry swarm: Rangers rake it from range.
      if (mix.total >= MIN_SEEN && mix.infantry / mix.total >= INFANTRY_SHARE) return "ranger";
      return choice;
    }
    // Foundry: shell towers and fighting infantry blobs with Breakers; vehicles are left to Anti-tank.
    if (b.type === "foundry") {
      if (mix.towers >= 2 || (mix.total >= MIN_SEEN && mix.infantry / mix.total >= INFANTRY_SHARE)) return "breaker";
      if (mix.total >= MIN_SEEN && mix.mech / mix.total >= MECH_SHARE && choice === "tank") return "breaker";
    }
    return choice;
  },
  // Rich bases build more instead of sitting on alloy: a third Barracks and extra towers.
  // Returns the building to add, or null. Used by updateAI's build choice.
  surplusBuilding(team, own, role) {
    if (!this.pace.counter || this.players[team].alloy < 500) return null;
    const count = (type) => own.filter((e) => e.type === type).length;
    if (count("barracks") < 3) return "barracks";
    if (own.some((e) => e.type === "foundry" && e.complete) && count("tower") < this.pace.towers + 2 + (role === "siege" ? 1 : 0)) return "tower";
    return null;
  },
  // Which research branch the AI takes at the Foundry: a siege AI takes plating, everyone else (raider, assault, lone AI) the weapons. Relaxed keeps the original weapons-only line.
  researchBranch(team, role) {
    if (!this.pace.counter) return "upgrade";
    return role === "siege" ? "plating" : "upgrade";
  },
  // Badly hurt fighters fall back to a Medic (if the team has one) and rejoin once healed.
  // With the field commander (sim/ai-attack.js) they also use Engineers and Supply wagons, the
  // Wardens' self-repair, and otherwise go home to guard the base instead of dying in the field.
  aiRetreat(team, army, hq = null) {
    const cmd = this.aiCommandFor(team);
    if (cmd) return cmd.pullback && this.aiPullBack(team, army, hq);
    if (!this.pace.counter) return;
    const medics = army.filter((e) => this.slotOf(e.type) === "medic" && e.hp > 0);
    for (const e of army) {
      if (e.mechanical || this.slotOf(e.type) === "medic" || this.slotOf(e.type) === "engineer" || !e.damage) continue;
      if (e.retreating) {
        if (e.hp >= e.maxHp * RECOVER || !medics.length) { e.retreating = false; e.orders = []; }
        continue;
      }
      if (!medics.length || e.hp >= e.maxHp * HURT) continue;
      const medic = medics.sort((a, b) => distance(a, e) - distance(b, e))[0];
      if (distance(e, medic) < 4) continue;
      e.retreating = true;
      this.issue([e.id], { type: "move", x: medic.x, z: medic.z });
    }
  },
  aiPullBack(team, army, hq) {
    const healers = army.filter((e) => e.support && e.hp > 0), mends = this.factionFor(team).trait === "selfrepair";
    // A spot just outside the core on the unit's side of it (the core itself cannot be stood on).
    const home = (e) => {
      const d = distance(e, hq) || 1, r = hq.radius + 5, x = hq.x + ((e.x - hq.x) / d) * r, z = hq.z + ((e.z - hq.z) / d) * r;
      return this.nav.canStand(x, z, e.radius) ? { x, z } : this.nav.nearest(x, z, e.radius) || { x: hq.x, z: hq.z };
    };
    for (const e of army) {
      if (e.support || !(e.damage > 0)) continue;
      const healer = healers.filter((h) => this.supportValid(h, e)).sort((a, b) => distance(a, e) - distance(b, e) || a.id - b.id)[0];
      if (e.retreating) {
        if (e.hp >= e.maxHp * RECOVER) {
          e.retreating = false;
          this.issue([e.id], { type: "stop" });
        } else if (!healer && !mends && (!hq || !e.orders.length || distance(e, hq) < 16)) e.retreating = false; // home: guard it
        else if (!healer && !mends && e.orders[0]?.type !== "move") this.issue([e.id], { type: "move", ...home(e) });
        continue;
      }
      if (e.hp >= e.maxHp * HURT) continue;
      if (healer) {
        if (distance(e, healer) < 4) continue;
        e.retreating = true;
        this.issue([e.id], { type: "move", x: healer.x, z: healer.z });
        continue;
      }
      // Nothing to heal it nearby: a unit already home keeps defending; one in the field goes home.
      if (!hq || distance(e, hq) < 20) continue;
      e.retreating = true;
      this.issue([e.id], { type: "move", ...home(e) });
    }
  },
};
