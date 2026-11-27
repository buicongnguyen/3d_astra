// Campaign heroes (owner-approved 2026-11-27; docs/MISSIONS.md "Campaign heroes"). Named allies fight
// beside the player in story missions:
//   Mira Vale       (Vanguard)  from mission 2 on: Meridian's operations officer takes the field herself;
//   Sol's Outrider  (Rider)     from The Verdant Pact on, when Captain Sol's surrender was accepted;
//   Hale's Ironclad (Tank)      from The Quiet Vault on, when Hale's surrender was accepted;
//   Maren's Watcher (Watcher)   from Cut the Draw on, when Ilse Maren's surrender was accepted.
// The spared commanders stay with their own camps (the story still needs them there); each sends the
// Commander a sworn champion with their name on it. Finishing a commander instead pays a one-off war
// chest in the mission named by `cacheIn` (src/story/heroes.js settles both from the campaign progress).
//
// Hero rules: HERO_RULES.hp x the unit type's health (HERO_RULES.hpHardest on Veteran), HERO_RULES.speed x
// its speed and HERO_RULES.damage x its damage, and one signature ability in place of the type's own (the
// ability bar shows it like any other). A fallen hero comes back at the Command core (or, with no core,
// where it first stood) RETURN_SECONDS later, with a notice. Heroes only ever help: no lose condition
// names them, and nothing the computer fields is touched.
//
// State: entity keys `hero` (the hero id, as the enemy heroes of campaign C3 use it), `heroStart` and
// `ability`; mission.heroIds and mission.heroReturns, created only when a mission carries heroes, so every
// other match saves and hashes exactly as before. Heroes take ids from their own range (like the dens of
// campaign-creatures.js), so every other entity keeps the id it would have had without them.
import { distance } from "../../data.js";

export const HERO_RULES = Object.freeze({ hp: 2.5, hpHardest: 2, speed: 1.15, damage: 1.2 });
export const RETURN_SECONDS = 30;
const HERO_IDS = 3e6;

// The signature abilities (the ability bar reads name, description, icon, order and cooldown).
const ABILITY = {
  holdline: { id: "holdline", name: "Hold the line", cooldown: 35, duration: 6, radius: 8, taken: 0.7, icon: "rally", order: 30, tint: [1, 0.82, 0.35],
    description: "Vale and every ally within 8 m take 30% less damage for 6 seconds." },
  volley: { id: "volley", name: "Caravan volley", cooldown: 25, radius: 11, targets: 4, damage: 45, icon: "chevrons", order: 31, tint: [1, 0.78, 0.4],
    description: "Shoot up to 4 enemies within 11 m at once: 45 damage each." },
  ironhull: { id: "ironhull", name: "Iron hull", cooldown: 40, duration: 8, guard: 0.5, icon: "armor", order: 32, tint: [1, 0.7, 0.35],
    description: "Take half damage for 8 seconds." },
  damper: { id: "damper", name: "Damper pulse", cooldown: 30, duration: 5, radius: 9, speed: 0.6, icon: "boot", order: 33, tint: [0.75, 0.6, 1],
    description: "Enemies within 9 m move 40% slower for 5 seconds." },
};

// Every campaign hero: unit type, display name, the cast member whose portrait and colours it carries,
// the first mission it fights in, and (for a spared commander) the decision that brings it and the
// one-off war chest finishing that commander pays instead.
export const ALLY_HEROES = Object.freeze({
  vale: { id: "vale", type: "vanguard", name: "Mira Vale", cast: "vale", from: "m02-first-contact", ability: ABILITY.holdline },
  sol: { id: "sol", type: "rider", name: "Sol's Outrider", cast: "sol", decision: "m04-sol", from: "m05-the-verdant-pact", ability: ABILITY.volley,
    cache: { alloy: 250 }, cacheIn: "m05-the-verdant-pact" },
  hale: { id: "hale", type: "tank", name: "Hale's Ironclad", cast: "hale", decision: "m07-hale", from: "m08-the-quiet-vault", ability: ABILITY.ironhull,
    cache: { alloy: 300 }, cacheIn: "m09-a-debt-in-the-dunes" },
  maren: { id: "maren", type: "watcher", name: "Maren's Watcher", cast: "maren", decision: "m10-maren", from: "m11-cut-the-draw", ability: ABILITY.damper,
    cache: { energy: 200 }, cacheIn: "m11-cut-the-draw" },
});

export const isAllyHero = (e) => !!e && e.team === 0 && typeof e.hero === "string" && !!ALLY_HEROES[e.hero];

function withHeroIds(sim, make) {
  const saved = sim.nextId;
  sim.nextId = sim.mission.heroIds ?? HERO_IDS;
  try { return make(); } finally { sim.mission.heroIds = sim.nextId; sim.nextId = saved; }
}

// The hero's health factor on this difficulty.
export const heroHealth = (difficulty) => (difficulty === "veteran" ? HERO_RULES.hpHardest : HERO_RULES.hp);

// Turns a freshly spawned unit into hero `id` (the stat rules above). Exported for the tests.
export function makeHero(sim, e, id) {
  const h = ALLY_HEROES[id];
  e.hero = id;
  e.name = h.name;
  e.hp = e.maxHp = Math.round(e.maxHp * heroHealth(sim.difficulty));
  sim.setBaseHp(e);
  e.speed = Math.round(e.speed * HERO_RULES.speed * 1000) / 1000;
  e.damage = Math.round(e.damage * HERO_RULES.damage * 100) / 100;
  e.ability = { ...h.ability };
  e.stance = "guard";
  return e;
}

const ally = (e, t) => t.team === e.team && t.hp > 0 && t.kind === "unit" && !t.flying;
const seenFoe = (sim, e, t) => t.hp > 0 && (t.kind === "unit" || t.kind === "building") && sim.hostile(e.team, t.team) && sim.isVisible(t, e.team);

export const campaignHeroes = {
  id: "campaignHeroes",
  order: 44, // after air strikes (43)
  statuses: {
    // Hold the line: less damage taken. Drawn with the rally flag.
    steadied: { taken: ABILITY.holdline.taken, icon: "rally", label: "Holding the line", tint: ABILITY.holdline.tint },
    // Damper pulse: slower.
    damped: { speed: ABILITY.damper.speed, icon: "boot", label: "Damped", tint: ABILITY.damper.tint },
  },
  abilities: {
    holdline: {
      use(sim, e, a) {
        let n = 0;
        for (const t of sim.entities) if (ally(e, t) && distance(e, t) <= a.radius + (t.radius || 0) && sim.applyStatus(t, "steadied", a.duration)) n++;
        return n > 0 ? {} : false;
      },
    },
    volley: {
      // Instant: the nearest few enemies the hero can see within reach each take a shot.
      use(sim, e, a) {
        const foes = sim.entities.filter((t) => seenFoe(sim, e, t) && !t.flying && distance(e, t) <= a.radius + (t.radius || 0))
          .sort((p, q) => distance(e, p) - distance(e, q) || p.id - q.id).slice(0, a.targets);
        if (!foes.some((t) => t.kind === "unit")) return false;
        for (const t of foes) {
          sim.events.push({ type: "shot", weapon: e.type, unit: e.type, source: e.id, target: t.id, x: e.x, z: e.z, tx: t.x, tz: t.z, team: e.team, heavy: false });
          sim.applyDamage(t, a.damage * (t.kind === "unit" ? 1 : 0.5), e.team, e.id);
        }
        return { at: { x: foes[0].x, z: foes[0].z } };
      },
    },
    ironhull: {
      use(sim, e, a) { return { guard: a.guard }; },
    },
    damper: {
      use(sim, e, a) {
        let n = 0;
        for (const t of sim.entities) if (t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && distance(e, t) <= a.radius + (t.radius || 0) && sim.applyStatus(t, "damped", a.duration)) n++;
        return n > 0 ? {} : false;
      },
    },
  },
  mixin: {
    // The heroes a settled mission carries (def.heroes, src/story/heroes.js), once the setup is in place.
    spawnHeroes(list) {
      for (const h of list) {
        const at = this.heroHome(h, true), spot = this.missionSpot(at, 6 + (h.slot || 0), 0.8);
        const e = withHeroIds(this, () => this.spawn(ALLY_HEROES[h.id].type, 0, spot.x, spot.z, true, true));
        makeHero(this, e, h.id);
        e.heroStart = { x: at.x, z: at.z };
      }
    },
    // Where a hero stands: beside the Command core (the squad's muster when it starts, the core when it
    // comes back) or, in a mission without one, where the player's own squad starts.
    heroHome(h, first) {
      if (this.own(0).some((e) => e.type === "hq")) return this.missionPlace(first ? "playerFront" : "playerBase");
      if (h.start) return { r: 6, ...h.start };
      const squad = this.own(0).find((e) => e.kind === "unit" && e.type !== "worker") || this.own(0)[0];
      return squad ? { x: squad.x, z: squad.z, r: 6 } : { x: 0, z: 0, r: 6 };
    },
  },
  onDeath(sim, t) {
    if (!isAllyHero(t) || !sim.mission || sim.defence) return;
    const back = sim.time + RETURN_SECONDS;
    (sim.mission.heroReturns ||= []).push({ id: t.hero, at: back, start: t.heroStart || null });
    const core = sim.own(0).some((e) => e.type === "hq" && e.hp > 0);
    sim.events.push({ type: "heroDown", hero: t.hero, x: t.x, z: t.z, at: back });
    sim.message(core ? `${t.name} is down: back at the Command core in ${RETURN_SECONDS} seconds.` : `${t.name} is down: back in ${RETURN_SECONDS} seconds.`);
  },
  step(sim) {
    const m = sim.mission, list = m?.heroReturns;
    if (!list?.length || sim.result) return;
    const due = list.filter((r) => sim.time >= r.at - 1e-9);
    if (!due.length) return;
    m.heroReturns = list.filter((r) => sim.time < r.at - 1e-9);
    if (!m.heroReturns.length) delete m.heroReturns;
    for (const r of due) {
      const at = sim.heroHome({ start: r.start }, false), spot = sim.missionSpot(at, 0, 0.8);
      const e = withHeroIds(sim, () => sim.spawn(ALLY_HEROES[r.id].type, 0, spot.x, spot.z, true, true));
      makeHero(sim, e, r.id);
      e.heroStart = r.start || { x: at.x, z: at.z };
      sim.events.push({ type: "heroBack", hero: r.id, id: e.id, x: e.x, z: e.z });
      sim.message(sim.own(0).some((b) => b.type === "hq") ? `${e.name} is back at the Command core.` : `${e.name} is back on the field.`);
    }
  },
};
