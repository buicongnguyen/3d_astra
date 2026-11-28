// H9 Skywing boards a Tank or a Breaker (HERO-COINS-PLAN.md H9; owner 2026-11-28: "in skywing, if landed then can we
// control breaker and make longer fire or tank which can fire normally"). The rules part; the page side (the "Board" /
// "Leave" tile, T on a PC, the hull camera, turret aim and the Breaker's landing ring) is src/hero-mode.js.
//
// The command `{ type: "skywingBoard", team, board: true, vehicle }` / `{ type: "skywingBoard", team, board: false }`
// (logged and replayed like `skywingLand`):
//   board  Skywing in Hero mode, landed (not gliding, not climbing), next to the team's own Tank or Breaker (at most
//          BOARD.reach m from its hull's edge) with no one aboard yet climbs in. Skywing leaves the field (it is out
//          of `sim.entities`, kept whole in `sim.skywing.rider`): nothing can target it, splash cannot reach it and it
//          adds no sight. Hero mode then drives the vehicle (sim/content/hero-mode.js): it moves by the stick, its hull
//          turns with the move, and it fires its own weapon with its own HP, damage, rate and range (no buff). The
//          Breaker lobs its shell at a ground point out to its full (siege) range, as the page aims it.
//   leave  Skywing steps out beside the vehicle (the nearest clear spot on its right, else its left, else anywhere
//          near), landed, and Hero mode drives Skywing again; the vehicle goes back to the computer's normal rules
//          (no orders: it holds where it was left and fights whatever comes in range).
//   Leaving Hero mode while aboard steps out first (the heroMode command). If the vehicle is destroyed with Skywing
//   aboard, Skywing is ejected unhurt, landed, beside the wreck, and Hero mode drives it on.
// Not in a Hero challenge (its rules count Skywing on the field). State only while aboard: `sim.skywing.aboard`
// (the vehicle's id), `sim.skywing.rider` (Skywing's entity) and the vehicle's `rider` (Skywing's id). A match that never
// boards saves and hashes exactly as before.
import { distance, DEFINITIONS as D } from "../../data.js";
import { isSkywing, landSpot } from "./skywing.js";
import { release } from "./hero-mode.js";

// reach: metres from the vehicle's hull edge to Skywing's centre; out: metres between the hull edge and the spot it steps
// out to. `types`: the vehicles Skywing can drive (the base roster's Battle tank and Breaker).
export const BOARD = Object.freeze({ reach: 4, out: 1.4, types: Object.freeze(["tank", "breaker"]) });
export const boardable = (v) => !!v && v.kind === "unit" && BOARD.types.includes(v.type);
// A vehicle Skywing is driving.
export const isCrewed = (v) => !!v && v.rider !== undefined;
// The ground point a vehicle's own shot reaches: the Breaker's siege range (its long lob), else its range.
export const pointRange = (v) => (v.siege_range || v.range || 0);

// The vehicle `team`'s landed, driven Skywing could board now, or a reason it cannot.
export function boardCheck(sim, team, vehicle) {
  const s = sim.skywing, e = s && s.id != null ? sim.get(s.id) : null, now = sim.heroModeOf?.(team);
  if (!e || !isSkywing(e) || e.team !== team || s.aboard !== undefined) return "none";
  if (sim.challenge) return "challenge";
  if (!now || now.id !== e.id) return "hero";
  if (e.flying || !e.landed || e.skyland || e.swoop) return "air";
  const v = vehicle === undefined ? null : sim.get(vehicle);
  if (!v || v.team !== team || !boardable(v) || v.hp <= 0 || isCrewed(v) || v.driven !== undefined) return "vehicle";
  if (distance(e, v) - (v.radius || 1) > BOARD.reach + 1e-9) return "far";
  return null;
}
// The team's own Tank or Breaker nearest Skywing within reach (ties: the lower id), or null.
export function boardTarget(sim, team) {
  const s = sim.skywing, e = s && s.id != null ? sim.get(s.id) : null;
  if (!e) return null;
  let best = null, bd = Infinity;
  for (const v of sim.entities) {
    if (v.team !== team || !boardable(v) || v.hp <= 0 || isCrewed(v)) continue;
    const d = distance(e, v) - (v.radius || 1);
    if (d <= BOARD.reach + 1e-9 && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && v.id < best.id))) { best = v; bd = d; }
  }
  return best;
}

// Skywing's entity as kept aboard: only what differs from its type's definition (as a save stores an entity), so a
// save made aboard and the live match step it back out the same.
function pack(e) {
  const base = D[e.type] || {}, out = {};
  for (const key of Object.keys(e)) if (e[key] !== base[key] || key === "type") out[key] = e[key];
  return out;
}

// Where Skywing steps out: beside the hull on its right, else its left, else the clear spot nearest the vehicle.
function exitSpot(sim, r, v) {
  const a = v.angle || 0, off = (v.radius || 1) + (r.radius || 0.8) + BOARD.out - 0.8;
  for (const side of [1, -1]) {
    const x = v.x + Math.cos(a) * off * side, z = v.z - Math.sin(a) * off * side;
    if (sim.nav.canStand(x, z, r.radius || 0.8)) return { x, z };
  }
  return landSpot(sim, r, v.x, v.z) || { x: v.x, z: v.z };
}

export const skywingBoard = {
  id: "skywingBoard",
  order: 47, // after Hero mode (46)
  mixin: {
    // Skywing climbs into `vehicle` (board) or steps out. False when it cannot.
    skywingBoard(team, board, vehicle) {
      if (!board) return this.skywingLeave(team);
      if (boardCheck(this, team, vehicle) !== null) return false;
      const s = this.skywing, e = this.get(s.id), v = this.get(vehicle), h = this.heroMode.teams[team];
      release(e);
      e.orders = []; e.path = []; e.moving = false; e.attacking = false;
      delete e.scope;
      s.aboard = v.id;
      s.rider = pack(e);
      this.entities = this.entities.filter((t) => t !== e);
      v.rider = e.id;
      v.orders = []; v.path = [];
      v.driven = h.scale;
      h.id = v.id;
      this.events.push({ type: "skywingBoard", on: true, id: e.id, vehicle: v.id, unit: v.type, team, x: v.x, z: v.z });
      return true;
    },
    // Skywing steps out of the vehicle it drives (`eject`: the vehicle was destroyed). False when it is not aboard.
    skywingLeave(team, eject = false) {
      const s = this.skywing;
      if (!s || s.aboard === undefined || !s.rider || s.rider.team !== team) return false;
      const r = { ...D[s.rider.type], ...s.rider }, v = this.entities.find((t) => t.id === s.aboard) || null;
      const at = v ? exitSpot(this, r, v) : { x: r.x, z: r.z };
      r.x = at.x; r.z = at.z;
      if (v) r.angle = v.angle || 0;
      r.flying = false; r.landed = true;
      delete r.skyland; delete r.swoop; delete r.scope;
      r.orders = []; r.path = []; r.post = { x: r.x, z: r.z };
      r.moving = false; r.attacking = false;
      r.stillAt = this.time;
      delete s.aboard; delete s.rider;
      this.entities.push(r);
      const h = this.heroMode?.teams[team];
      if (v) {
        delete v.rider;
        if (v.driven !== undefined) release(v);
        v.orders = []; v.path = [];
        if (v.hp > 0) v.post = { x: v.x, z: v.z };
      }
      if (h && (!v || h.id === v.id)) {
        h.id = r.id;
        r.driven = h.scale;
        if (h.help) r.dodgeHelp = true;
      }
      this.events.push({ type: "skywingBoard", on: false, eject, id: r.id, vehicle: v?.id ?? null, unit: v?.type ?? null, team, x: r.x, z: r.z });
      if (eject) this.message("Vehicle lost: Skywing bailed out.", team);
      return true;
    },
  },
  commands: {
    skywingBoard: {
      allowed: (sim, c) => typeof c.board === "boolean" && (!c.board || Number.isInteger(c.vehicle)) && !!sim.skywing && sim.humanTeam(c.team),
      run: (sim, c) => sim.skywingBoard(c.team, c.board, c.vehicle),
    },
  },
  // The vehicle falls with Skywing aboard: Skywing is ejected unhurt beside the wreck.
  onDeath(sim, t) {
    if (!isCrewed(t) || sim.skywing?.aboard !== t.id) return;
    sim.skywingLeave(sim.skywing.rider.team, true);
  },
};
