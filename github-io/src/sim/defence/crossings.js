// Crossings: bridge demolition, pontoons, and the result and status read-outs.
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { CROSSINGS } from "../../terrain.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, FOE, WATER, BANK, nearestLeg, sideOf, crossing, starsFor } from "./common.js";

export const crossings = {
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
