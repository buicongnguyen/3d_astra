import { distance } from "../data.js";
import { sharpSide } from "../ai-plan.js";

// W8 AI quality (2026-11-25): readable tactics for the chosen-challenge speeds, Fast and Relentless, in a
// skirmish (Classic or Field plan). Relaxed, Normal, missions and Defence never call anything here, so they
// play exactly as before (owner: those must not get harder). Mixed into Simulation through `ai` (sim/ai.js).
//
//   shared focus   an attack's shooters agree on one target (two at most): the one their priorities rate highest
//                  for the time it takes them to kill it, so a volley drops a unit instead of scratching three;
//                  shooters past what the first target needs spill onto the second (no overkill)
//   flank side     a flank waypoint goes on the side with fewer seen enemy towers (sim/ai-attack.js aiSecondGroup);
//                  the main push waits at the rally so both groups arrive together (aiWave)
//   rejoin         a wounded unit pulled back to a Medic or Engineer stands behind it and, healed, rejoins its attack
//   Kite scouting  an idle Kite flies to the unexplored ground where an enemy base is likely (the mirror spots of its
//                  own core), and turns back as soon as it sees something that shoots flyers, remembering the spot
//
// Deterministic (no random numbers, no wall-clock): ties break on entity id or grid order. State lives on
// `sim.aiWar` (created by the field commander) and, for a wounded unit, its `aiRejoin` attack number.

// The shared focus keeps its target unless another is this much better (as aiFocus).
const SWITCH = 1.35;
// Seconds of fire a focus target is given before the extra shooters spill onto the second target.
const KILL_WINDOW = 4, SPILL = 1.25;
// A Kite turns back from anything that hits air within its range plus this margin, and avoids that spot (m).
const AA_MARGIN = 6, DANGER_RADIUS = 14, DANGER_SPOTS = 6;
// Scouting grid step (as scoutDestination) and how near a likely base counts as "there".
const GRID = 18;

const centre = (list) => ({ x: list.reduce((n, e) => n + e.x, 0) / list.length, z: list.reduce((n, e) => n + e.z, 0) / list.length });

export const aiSharp = {
  aiSharpOn(team) { return sharpSide(this, team); },
  // Shared focus fire for one attack `a` (aiWatch, cmd.sharp). Melee units and units walking (a pull-back, a
  // retreat) are left alone, as in aiFocus. Fewer than two shooters: the per-unit focus (aiFocus) decides.
  aiFocusShared(team, members, a) {
    const shooters = members.filter((e) => e.damage > 0 && e.range >= 4 && e.orders[0]?.type !== "move");
    if (shooters.length < 2) { if (shooters.length) this.aiFocus(team, shooters, a); return; }
    const reachOf = (e, t) => (t.kind !== "unit" && e.siege_range ? e.siege_range : e.range) + 1.5 + (t.radius || 0);
    const mid = centre(shooters);
    let spread = 0, far = 0;
    for (const e of shooters) { spread = Math.max(spread, distance(mid, e)); far = Math.max(far, (e.siege_range || e.range) + 1.5); }
    const limit = spread + far + 4;
    // Candidates: every visible enemy within reach of at least one shooter, scored once for the whole group.
    const cands = [];
    for (const t of this.entities) {
      if (t.hp <= 0 || t.kind === "wall" || t.kind === "resource") continue;
      const dx = t.x - mid.x, dz = t.z - mid.z;
      if (dx * dx + dz * dz > limit * limit || !this.hostile(team, t.team) || !this.isVisible(t, team)) continue;
      let prio = 0, dps = 0;
      const reach = [];
      for (const e of shooters) {
        const r = reachOf(e, t), ex = t.x - e.x, ez = t.z - e.z;
        if (ex * ex + ez * ez > r * r || (t.flying && !this.canHit(e, t))) continue;
        const p = this.aiPriority(e, t);
        if (!p) continue;
        prio += p; dps += e.damage / Math.max(0.2, e.interval || 1); reach.push(e);
      }
      if (!reach.length) continue;
      // Worth: the summed priority, discounted by the seconds this group needs to kill it.
      const eff = t.hp + (t.shield || 0), score = prio / (1 + eff / (dps * KILL_WINDOW));
      cands.push({ t, score, reach, eff });
    }
    // Shooters on an attack order whose target left reach or sight carry on with the advance.
    const resume = (e) => {
      const o = e.orders[0], cur = o?.type === "attack" ? this.get(o.target) : null;
      if (cur && !cands.some((c) => c.t === cur && c.reach.includes(e))) this.issue([e.id], { type: "attackmove", x: a.x, z: a.z, aiw: a.n });
    };
    if (!cands.length) { delete a.focus; for (const e of shooters) resume(e); return; }
    cands.sort((p, q) => q.score - p.score || p.t.id - q.t.id);
    // Hysteresis: the focus targets kept from the last think stay unless a new one is SWITCH times better.
    const kept = (a.focus || []).map((id) => cands.find((c) => c.t.id === id)).filter(Boolean);
    const picks = [];
    for (const c of kept) if (cands[0].score <= c.score * SWITCH || cands[0] === c) picks.push(c);
    for (const c of cands) { if (picks.length >= 2) break; if (!picks.includes(c)) picks.push(c); }
    picks.length = Math.min(picks.length, 2);
    a.focus = picks.map((c) => c.t.id);
    // Assign: shooters in reach of the first target until it has enough fire for SPILL times its health in the
    // window; the rest (in reach) take the second; anyone else keeps its own fight.
    const given = new Map();
    for (const c of picks) {
      let fire = 0;
      const need = c.eff * SPILL;
      const order = [...c.reach].sort((p, q) => distance(p, c.t) - distance(q, c.t) || p.id - q.id);
      for (const e of order) {
        if (given.has(e) || (c !== picks[picks.length - 1] && fire >= need)) continue;
        given.set(e, c.t);
        fire += (e.damage / Math.max(0.2, e.interval || 1)) * KILL_WINDOW;
      }
    }
    for (const e of shooters) {
      const t = given.get(e);
      if (!t) { resume(e); continue; }
      const o = e.orders[0];
      if (o?.type === "attack" && o.target === t.id) continue;
      if (!this.nav.clearLine(e, t, t.id)) { resume(e); continue; }
      this.issue([e.id], { type: "attack", target: t.id, aiw: a.n });
      this.issue([e.id], { type: "attackmove", x: a.x, z: a.z, aiw: a.n }, true);
    }
  },
  // The flank waypoint's side: the one with fewer seen enemy towers within 22 m; a tie keeps the seeded side.
  // `vias` is [first, second] (either may be null when nothing can stand there).
  aiFlankSide(team, vias, seeded) {
    const danger = (p) => {
      if (!p) return Infinity;
      let n = 0;
      for (const [id, type] of this.intel[team] || []) {
        if (type !== "tower") continue;
        const t = this.get(id);
        if (t && t.hp > 0 && distance(t, p) < 22) n++;
      }
      return n;
    };
    const d0 = danger(vias[0]), d1 = danger(vias[1]);
    return d0 === d1 ? vias[seeded] || vias[1 - seeded] : d0 < d1 ? vias[0] : vias[1];
  },
  // Seconds the main push should wait at the rally so a flank through `via` arrives with it (0 to 25).
  aiFlankDelay(main, flank, via, target) {
    const slow = (list) => list.reduce((m, e) => Math.min(m, e.speed || 1), Infinity);
    const fighters = main.filter((e) => e.damage > 0);
    if (!fighters.length || !flank.length) return 0;
    const from = centre(flank), mid = centre(fighters);
    const flankEta = (distance(from, via) + distance(via, target)) / slow(flank), mainEta = distance(mid, target) / slow(fighters);
    return Math.max(0, Math.min(25, flankEta - mainEta));
  },
  // The point a wounded unit walks to: just behind its healer, on the side away from its attack's objective.
  aiBehind(healer, n, team) {
    const a = this.aiWar?.[team]?.attacks.find((x) => x.n === n);
    if (!a) return { x: healer.x, z: healer.z };
    const d = distance(healer, a) || 1, x = healer.x + ((healer.x - a.x) / d) * 2.5, z = healer.z + ((healer.z - a.z) / d) * 2.5;
    return this.nav.canStand(x, z, 0.6) ? { x, z } : { x: healer.x, z: healer.z };
  },
  // A healed unit's way back: its attack, if that is still in the field. True when it was sent.
  aiRejoin(team, e) {
    const n = e.aiRejoin;
    delete e.aiRejoin;
    const a = n && this.aiWar?.[team]?.attacks.find((x) => x.n === n && !x.back);
    if (!a) return false;
    this.issue([e.id], { type: "attackmove", x: a.x, z: a.z, aiw: a.n });
    return true;
  },
  // Kites (unarmed flyers): turn back from anti-air, then scout the likely enemy bases.
  aiKites(team, army, hq) {
    let war = null;
    for (const k of army) {
      if (!k.flying || k.damage > 0 || k.hp <= 0) continue;
      war ||= this.aiWarFor(team);
      const threat = this.aiAntiAirNear(team, k);
      if (threat) {
        const spots = (war.danger ||= []);
        if (!spots.some((p) => distance(p, threat) < DANGER_RADIUS * 0.6)) {
          spots.push({ x: Math.round(threat.x), z: Math.round(threat.z) });
          if (spots.length > DANGER_SPOTS) spots.shift();
        }
        const d = distance(k, threat) || 1, limit = this.terrain.half - 4;
        const clampTo = (v) => Math.max(-limit, Math.min(limit, v));
        const away = { x: clampTo(k.x + ((k.x - threat.x) / d) * 14), z: clampTo(k.z + ((k.z - threat.z) / d) * 14) };
        const o = k.orders[0];
        if (!(o?.type === "move" && !o.aiw && distance(o, away) < 4 && distance(o, threat) > d)) this.issue([k.id], { type: "move", ...away });
        continue;
      }
      if (k.orders.length) continue;
      const p = this.aiScoutPoint(team, hq, k);
      if (p) this.issue([k.id], { type: "move", x: p.x, z: p.z });
    }
  },
  // The nearest visible enemy that shoots flyers and could reach Kite `k` soon, or null.
  aiAntiAirNear(team, k) {
    let best = null, bd = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0 || !(t.damage > 0)) continue;
      const aa = t.kind === "unit" ? !!t.hits_air : t.kind === "building" && t.complete && !!this.players[t.team]?.flak;
      if (!aa || !this.hostile(team, t.team)) continue;
      const d = distance(k, t), reach = (t.range || 0) + (t.radius || 0) + AA_MARGIN;
      if (d > reach || !this.isVisible(t, team)) continue;
      if (d < bd || (d === bd && t.id < best.id)) { best = t; bd = d; }
    }
    return best;
  },
  // Where an idle Kite scouts: the unexplored grid point nearest a likely enemy base (the mirror spots of its own
  // core across the map centre) it has not explored, else the unexplored point nearest the Kite; never within
  // DANGER_RADIUS of a spot where it met anti-air. Everything explored: the usual search pattern.
  aiScoutPoint(team, hq, k) {
    const explored = this.explored[team], limit = this.terrain.half - 8, danger = this.aiWar?.[team]?.danger || [];
    const seen = (x, z) => !!explored[this.terrain.cellIndex(x, z)];
    const safe = (x, z) => !danger.some((p) => Math.hypot(p.x - x, p.z - z) < DANGER_RADIUS);
    const likely = hq ? [{ x: -hq.x, z: -hq.z }, { x: -hq.x, z: hq.z }, { x: hq.x, z: -hq.z }]
      .filter((p) => distance(p, hq) > 30 && !seen(p.x, p.z) && safe(p.x, p.z)) : [];
    let best = null, bs = Infinity;
    for (let z = -limit; z <= limit; z += GRID)
      for (let x = -limit; x <= limit; x += GRID) {
        if (seen(x, z) || !safe(x, z)) continue;
        const s = likely.length ? Math.min(...likely.map((p) => Math.hypot(p.x - x, p.z - z))) : Math.hypot(k.x - x, k.z - z);
        if (s < bs) { bs = s; best = { x, z }; }
      }
    return best || this.scoutDestination(team);
  },
};
