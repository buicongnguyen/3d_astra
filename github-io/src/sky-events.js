// The Hero sky's rules (owner 2026-11-28, "beautiful, vivid, like a space war"): which sky a match gets, its one sky
// event, how many meteors fall, and the warm flash a big blast throws on the low sky. Pure and small: the Hero sky
// itself (src/horizon-sky.js, src/horizon-vivid.js) is loaded on the first Hero mode entry; the victory fireworks
// (src/victory-fireworks.js) take their seed from here too. View only: nothing here reaches the simulation.
//
// Settings > Hero > Sky (settings.js heroSky):
//   calm     today's blue sky (the dome, the far ring, the key art's planets): no events, no meteors, no flash
//   vivid    (the default) a dark indigo-violet space sky: nebula, glowing planets, meteors and ONE sky event a match
//   burning  vivid with the shattered planet in every sky (a meteor-shower pick still brings its shower on top)
// The event is seeded from the match seed (skySeed: the match's own setup, what a replay rebuilds), so a replay shows
// the same sky. A map on the volcano land (lands.js, lava) always shows the shattered planet: a burning world fits it.
// Adding an event (an "Armada" sky, say): one SKY_EVENTS entry (its mesh builder lives in horizon-vivid.js EVENT_MESHES)
// and its id in EVENT_PICK.
import { fnv1a, mulberry32 } from "./rng.js";
import { landOf } from "./lands.js";

export const SKY_MODES = Object.freeze(["calm", "vivid", "burning"]);
export const DEFAULT_SKY = "vivid";
// meteors: "normal" (a few a minute) or "shower" (many); mesh: the event draw horizon-vivid.js builds (null: none).
export const SKY_EVENTS = Object.freeze({
  shower: Object.freeze({ meteors: "shower", mesh: null }),
  shattered: Object.freeze({ meteors: "normal", mesh: "shattered" }),
  eclipse: Object.freeze({ meteors: "normal", mesh: "eclipse" }),
  aurora: Object.freeze({ meteors: "normal", mesh: "aurora" }),
  // "Armada landfall" (2026-11-29): capital ships cross the far sky and one or two land behind the mountains.
  armada: Object.freeze({ meteors: "normal", mesh: "armada" }),
});
// The seeded pick, in a fixed order (a new event joins at the end, so older seeds keep their pick where they can).
export const EVENT_PICK = Object.freeze(["shower", "shattered", "eclipse", "aurora", "armada"]);
// The far space war (sky-war.js) of every Vivid sky: faint, and strong in the Armada and the Burning world.
export const WAR_STRENGTH = Object.freeze({ faint: 0.45, strong: 1 });
// A campaign mission's Vivid sky opens with the player's own fleet landing ("reinforcements"), then its own event.
export const FLEET_SHIP = Object.freeze({ meridian: "cruiser", ashfall: "hauler" });
// Meteor slots (one instanced draw): each slot shows one meteor in each of its cycles (`period` seconds, seeded).
export const METEORS = Object.freeze({
  none: Object.freeze({ slots: 0, period: [40, 70] }),
  normal: Object.freeze({ slots: 3, period: [38, 66] }), // about 3-4 a minute
  shower: Object.freeze({ slots: 16, period: [7, 15] }), // about 90 a minute
});

export const skyMode = (settings) => (SKY_MODES.includes(settings?.heroSky) ? settings.heroSky : DEFAULT_SKY);

// The match seed: the match's own setup (map, mission, rivals, difficulty, factions, alliance), the same in its replay
// (a replay builds its simulation from the remembered options, meta/replay.js). Read once per simulation.
export function skySeed(sim) {
  if (!sim) return "none";
  const mission = sim.missionDef?.id ?? sim.mission?.id ?? "";
  return [sim.terrain?.id ?? "", mission, sim.enemyCount ?? 1, sim.difficulty ?? "", JSON.stringify(sim.factions ?? null), sim.coalition ? 1 : 0].join("|");
}
export const pickEvent = (seed) => EVENT_PICK[fnv1a(`sky-event|${seed}`) % EVENT_PICK.length];
// A seeded generator for a match's sky (the shockwave's timing, the fireworks).
export const skyRandom = (seed, what) => mulberry32(fnv1a(`${what}|${seed}`));

// The sky of a match: { event: id or null, meteors: "none" | "normal" | "shower", war: strength, intro, picked, why }.
// campaign: a campaign mission (its Vivid sky opens with the player's fleet landing: intro "reinforcements").
export function skyPlan({ mode = DEFAULT_SKY, terrain = null, seed = "none", force = null, campaign = false } = {}) {
  if (mode === "calm") return { event: null, meteors: "none", war: 0, intro: null, picked: null, why: "calm" };
  const picked = force && SKY_EVENTS[force] ? force : pickEvent(seed), intro = campaign && !force ? "reinforcements" : null;
  const plan = (event, meteors, why) => ({ event, meteors, war: event === "armada" || mode === "burning" ? WAR_STRENGTH.strong : WAR_STRENGTH.faint, intro, picked, why });
  if (mode === "burning") return plan("shattered", SKY_EVENTS[picked].meteors === "shower" ? "shower" : "normal", "burning");
  if (!force && landOf(terrain)?.lava) return plan("shattered", "normal", "volcano");
  return plan(picked, SKY_EVENTS[picked].meteors, force ? "forced" : "seed");
}
// A campaign mission (not a Hero challenge or a Frontier Defence level): its sky opens with reinforcements landing.
export const campaignMission = (sim) => !!sim?.missionDef && !sim.missionDef.challenge && !sim.terrain?.defence && !sim.defence;

// ------------------------------------------------------------------------------------------------ the sky answers
// A big blast near the Hero camera flashes the horizon glow, the low nebula and the clouds warm orange: about 0.3 s up,
// 1.2 s down, one flash at a time, a new one no sooner than GAP s after the last began (a heavy battle flickers, it
// never strobes), never weaker than what still glows. One shader uniform (horizon-sky.js uBlast); none under reduced
// motion, in the Calm sky or outside Hero mode.
export const FLASH = Object.freeze({ rise: 0.3, fall: 1.2, gap: 0.85, reach: 26, min: 0.06 });
// How big each blast is (0-1) from its event, or 0 (not a blast).
export function blastSize(ev) {
  if (!ev) return 0;
  if (ev.type === "death") return ev.core ? 1 : ev.building ? 0.7 : 0;
  if (ev.type === "hazardBlast") return 0.55;
  if (ev.type === "strike") return 0.6;
  if (ev.type === "shot" && (ev.weapon === "tank" || ev.weapon === "breaker")) return 0.28;
  return 0;
}
// Where a blast is (a shell lands at its target point).
export const blastAt = (ev) => (ev.type === "shot" ? { x: ev.tx, z: ev.tz } : { x: ev.x, z: ev.z });
// Its strength at a camera `distance` metres away: full within a few metres, half at FLASH.reach.
export const blastStrength = (size, distance) => size / (1 + (Math.max(0, distance) / FLASH.reach) ** 2);

export class SkyFlash {
  constructor() { this.reset(); }
  reset() { this.start = -Infinity; this.from = 0; this.peak = 0; this.clock = 0; this.flashes = 0; }
  advance(dt) { if (dt > 0) this.clock += dt; }
  // The flash now (0-1).
  value(at = this.clock) {
    const t = at - this.start;
    if (!(t >= 0)) return 0;
    if (t < FLASH.rise) { const k = t / FLASH.rise; return this.from + (this.peak - this.from) * k * k * (3 - 2 * k); }
    const f = (t - FLASH.rise) / FLASH.fall;
    return f >= 1 ? 0 : this.peak * (1 - f) * (1 - f);
  }
  // A blast of `strength` (0-1): starts a flash, or is ignored (too soon after the last one, or weaker than the glow
  // still showing, or too faint to see). Returns whether it flashed.
  trigger(strength) {
    const s = Math.min(1, strength), now = this.clock;
    if (!(s >= FLASH.min) || now - this.start < FLASH.gap) return false;
    const current = this.value(now);
    if (s <= current) return false;
    this.from = current; this.peak = s; this.start = now; this.flashes++;
    return true;
  }
}
