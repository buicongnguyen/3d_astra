// Elite affixes (AAA round 2, W2-B; docs/MISSIONS.md "Heroic challenges"). A Defence wave group may carry
// `mods: { elite: "<affix>", every?: n }`: startWave copies the mods onto every n-th spawn of the group
// (all of them by default) and spawnQueued calls sim.applyElite(e, mods) on the new unit. An elite has
// 1.6x the health, three times the bounty, a gold ring in the view (src/elite-view.js) and one affix:
//
//   plated    shield x2.5, back 2 s after a hit (a unit without a shield gets 30% of its hull)
//   swift     +35% speed, -20% health
//   splitter  on death, two units of the group's vanguard slot walk on from where it fell
//   volatile  on death, 40 damage within 2.5 m to towers and blockers
//   banner    allies within 7 m take x0.8 (never stacks: one factor however many banners)
//   mender    heals allies within 7 m by 40 every 6 s
//
// The numbers are balance.json "elites". State: `e.elite` (and the affix's own fields) on the elite
// unit only, `defence.elites` (the count) once the first one has spawned, `defence.splits` while a
// Splitter's children are waiting for the next tick. A match with no elite in it never reads any of it:
// every hook answers at once when `sim.defence.elites` is unset, so no existing pin moves.
import BALANCE from "../../balance.json" with { type: "json" };
import { DEFINITIONS as D } from "../../data.js";

export const ELITES = BALANCE.elites;
export const AFFIXES = Object.keys(ELITES.affixes);
const FOE = 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The banners standing this tick (one list a tick, kept off the saved state).
const BANNERS = new WeakMap();
function banners(sim) {
  let c = BANNERS.get(sim);
  if (!c || c.tick !== sim.ticks || c.entities !== sim.entities) {
    c = { tick: sim.ticks, entities: sim.entities, list: sim.entities.filter((e) => e.elite === "banner" && e.hp > 0) };
    BANNERS.set(sim, c);
  }
  return c.list;
}

export const elites = {
  id: "elites",
  mixin: {
    // Turns a freshly spawned wave unit into an elite. `mods` = { elite, split? } from the queued spawn.
    applyElite(e, mods) {
      const a = ELITES.affixes[mods.elite];
      if (!a) return false;
      e.elite = mods.elite;
      e.maxHp = Math.round(e.maxHp * ELITES.hp * (a.hp ?? 1));
      e.hp = e.maxHp;
      this.setBaseHp(e);
      e.bounty_x = ELITES.bounty;
      if (mods.elite === "plated") {
        const base = D[e.type]?.shield || Math.round(e.maxHp * a.fallback);
        e.maxShield = Math.round(base * a.shield);
        e.shield = e.maxShield;
        e.shield_delay = a.delay;
      } else if (mods.elite === "swift") e.speed *= a.speed;
      else if (mods.elite === "splitter") e.split = mods.split || "vanguard";
      else if (mods.elite === "mender") e.mendAt = this.time + a.every;
      this.defence.elites = (this.defence.elites || 0) + 1;
      return true;
    },
    // Once a tick from stepDefence, only while an elite has spawned: a Splitter's children step onto its
    // road (after the tick's deaths), and a Mender heals.
    stepElites() {
      const d = this.defence;
      if (d.splits?.length) {
        const a = ELITES.affixes.splitter, list = d.splits;
        delete d.splits;
        for (const s of list) {
          for (let k = 0; k < a.count; k++) {
            const side = k - (a.count - 1) / 2;
            const kid = this.spawnOnRoute(s.type, FOE, s.route, s.leg, { x: s.x + side * a.spread * 2, z: s.z + side * a.spread });
            if (s.wave !== undefined) kid.wave = s.wave;
          }
        }
      }
      const a = ELITES.affixes.mender;
      for (const m of this.entities) {
        if (m.elite !== "mender" || m.hp <= 0 || this.time < m.mendAt - 1e-9) continue;
        m.mendAt = this.time + a.every;
        for (const o of this.entities) {
          if (o === m || o.team !== FOE || o.kind !== "unit" || o.hp <= 0 || o.hp >= o.maxHp || dist(o, m) > a.radius) continue;
          o.hp = Math.min(o.maxHp, o.hp + a.heal);
          this.events.push({ type: "support", weapon: "medic", x: m.x, z: m.z, tx: o.x, tz: o.z, team: m.team });
        }
      }
    },
  },
  // Banner: the factor on everything an ally of a banner takes.
  taken(sim, t) {
    if (!sim.defence?.elites || t.team !== FOE || t.kind !== "unit") return 1;
    const a = ELITES.affixes.banner;
    for (const b of banners(sim)) if (b !== t && dist(b, t) <= a.radius) return a.taken;
    return 1;
  },
  onDeath(sim, t) {
    if (!t.elite || !sim.defence?.elites) return;
    if (t.elite === "volatile") {
      const a = ELITES.affixes.volatile;
      for (const o of sim.entities) {
        if (o.team === FOE || o.hp <= 0 || !(o.crew || o.blocker) || dist(o, t) > a.radius + (o.radius || 0)) continue;
        sim.applyDamage(o, a.damage, t.team, t.id);
      }
      sim.events.push({ type: "strike", x: t.x, z: t.z, radius: a.radius, team: t.team, victims: [] });
    } else if (t.elite === "splitter") {
      const o = t.orders?.[0];
      if (o?.type !== "route") return;
      (sim.defence.splits ||= []).push({ type: t.split, route: o.route, leg: o.leg, x: t.x, z: t.z, wave: t.wave });
    }
  },
};
