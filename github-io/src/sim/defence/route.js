// Route walking, the wave tick, carriers and cargo.
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { DEFINITIONS as D, distance, hyp } from "../../data.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, FOE, CORNER, BANK, SPAWN_CLEAR, BLOCKERS, UNLOAD, DEPART, UNLOAD_MAX, lanePoint, nearestLeg, sideOf, crossing } from "./common.js";

export const route = {
  // A unit that appears at `at` ({ x, z }) and walks route `routeId` from leg `leg` (the index of the
  // end point of the segment it is on), as any column does. A boss's drops use it (sim/bosses.js).
  spawnOnRoute(type, team, routeId, leg, at) {
    const pts = this.defenceDef()?.routes[routeId];
    if (!pts) throw new Error(`spawnOnRoute: no route "${routeId}"`);
    const e = this.spawn(type, team, at.x, at.z, true, true), next = pts[Math.min(leg, pts.length - 1)];
    e.angle = Math.atan2(next.x - e.x, next.z - e.z);
    e.orders = [{ type: "route", route: routeId, leg }];
    return e;
  },
  // The commander and Reinforce Vanguards standing in the way this tick (see BLOCKERS).
  blockersNow() {
    let c = BLOCKERS.get(this);
    if (!c || c.tick !== this.ticks || c.entities !== this.entities) {
      // An armour squad holding the road (0.23) never holds a column at its spawn spot (a move by
      // an ordinary order can take it there).
      const near = (e) => Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - e.x, pts[0].z - e.z) < SPAWN_CLEAR);
      c = { tick: this.ticks, entities: this.entities, list: this.entities.filter((e) => e.blocker && e.hp > 0 && !(e.squad && near(e))) };
      BLOCKERS.set(this, c);
    }
    return c.list;
  },
  // Route order (sim/stepEntity): walk the lane leg by leg, straight when the way is clear and
  // by the route search otherwise, firing on the move at whatever is in range. A wave never
  // stops or leaves its road to chase; only a blocker in its way (the commander, Reinforce) or a
  // blown crossing it is building over holds it.
  stepRoute(e, o, dt) {
    const def = this.defenceDef(), pts = def?.routes[o.route];
    if (!pts) { this.finish(e); return; }
    const foe = e.damage > 0 ? this.enemy(e, e.range, true) : null;
    if (foe) this.fight(e, foe, dt, false);
    const lane = ((e.id * 0.618) % 1 - 0.5) * (def.lane ?? 2.4);
    let target = null;
    for (let guard = 0; guard < pts.length; guard++) {
      if (o.leg >= pts.length) { o.leg = pts.length - 1; target = pts[o.leg]; break; }
      target = lanePoint(pts, o.leg, o.leg === pts.length - 1 ? 0 : lane);
      const a = pts[o.leg - 1], b = pts[o.leg], dx = b.x - a.x, dz = b.z - a.z;
      const past = ((e.x - a.x) * dx + (e.z - a.z) * dz) / (dx * dx + dz * dz || 1) >= 1;
      if (o.leg < pts.length - 1 && (distance(e, target) < CORNER || past)) { o.leg++; continue; }
      break;
    }
    // A bridge builder walks to the near bank of its blown crossing and waits there while the
    // pontoon goes up (stepCrossings counts the time).
    if (e.bridger && this.crossings) {
      const x = this.crossingOf(o.route);
      if (this.crossingClosed(x) && sideOf(e.z) === sideOf(pts[0].z)) {
        target = { x: x + lane, z: sideOf(pts[0].z) * BANK };
        if (distance(e, target) < 1.2) { e.moving = false; return; }
      }
    }
    // A troop carrier stops at its drop leg and lets its passengers out, then drives on empty.
    if ((e.cargo || e.departAt !== undefined) && this.stepCarrier(e, o, pts)) return;
    // Ground blockers hold ground units only: flyers pass over them.
    const blockers = e.flying ? [] : this.blockersNow();
    if (blockers.length) {
      const fx = target.x - e.x, fz = target.z - e.z;
      for (const b of blockers)
        if (b.team !== e.team && hyp(b.x - e.x, b.z - e.z) < b.radius + e.radius + 0.4 && (b.x - e.x) * fx + (b.z - e.z) * fz > 0) {
          if (!e.attacking) e.angle = Math.atan2(b.x - e.x, b.z - e.z);
          e.moving = false;
          return;
        }
    }
    const dx = target.x - e.x, dz = target.z - e.z, d = hyp(dx, dz);
    if (d < 0.05) { e.moving = false; return; }
    const step = Math.min(d, this.moveSpeed(e) * (def.pace ?? 1) * dt), next = { x: e.x + (dx / d) * step, z: e.z + (dz / d) * step };
    // Flyers (0.18.3) fly the same lane straight from corner to corner, over any ground.
    if (e.speed > 0 && (e.flying || this.nav.canTraverse(e, next, e.radius))) {
      e.x = next.x;
      e.z = next.z;
      // A unit firing keeps facing its target (turrets and the shot read the angle).
      if (!e.attacking) e.angle = Math.atan2(dx, dz);
      e.moving = true;
      e.path = [];
      e.stalled = 0;
      return;
    }
    this.move(e, target, dt, CORNER);
    // move() drops an order it cannot finish; a route is never dropped.
    if (e.orders[0] !== o) e.orders.unshift(o);
  },
  stepDefence(dt) {
    const d = this.defence, def = this.defenceDef();
    if (!d || !def || this.result) return;
    if (d.nextAt !== null && this.time >= d.nextAt - 1e-9 && d.wave < this.waveTotal()) this.startWave();
    if (d.queue.length) this.spawnQueued();
    if (this.crossings) this.stepCrossings(dt);
    if (d.hero) this.stepCommander();
    if (GARRISONS.repair) this.fieldRepair(dt);
    // Elites (W2-B, sim/content/elites.js): only once one has spawned.
    if (d.elites) this.stepElites();
    // Wave kinds (W10, sim/content/wave-kinds.js): only once one has spawned.
    if (d.kinds) this.stepWaveKinds();
    // Carriers at their stop let their passengers out (after the spawns, in entity order).
    for (const e of this.entities) if (e.cargo && e.unloadAt !== undefined && e.hp > 0 && this.time >= e.unloadAt - 1e-9) this.dropCargo(e);
    const exit = def.exit;
    // Enemies standing: of the newest wave, and of each earlier wave still held apart (d.open).
    let alive = 0, held = null;
    for (const e of this.entities) {
      // Reinforce Vanguards leave when their time is up.
      if (e.team === TEAM && e.expires !== undefined && e.hp > 0 && this.time >= e.expires - 1e-9) { e.hp = 0; e.orders = []; continue; }
      if (e.team !== FOE || e.kind !== "unit") continue;
      if (e.hp <= 0) {
        // Killed this tick (settle removes it next): one tenth of what it cost. A carrier that
        // falls before its drop takes its passengers with it, and pays their bounty too.
        if (!e.paid && !e.leaked) {
          e.paid = true;
          const worth = (type) => { const cost = D[type]?.cost || [0, 0]; return Math.ceil((cost[0] + cost[1]) * GARRISONS.bounty); };
          const lost = e.cargo?.length || 0, bounty = worth(e.type) * (e.bounty_x ?? 1) + (lost ? e.cargo.reduce((a, type) => a + worth(type), 0) : 0);
          this.players[TEAM].alloy += bounty;
          d.bounty += bounty;
          this.events.push({ type: "bounty", amount: bounty, x: e.x, z: e.z, team: TEAM, ...(lost ? { carried: lost } : {}) });
          if (lost) {
            this.events.push({ type: "carrierDown", id: e.id, amount: bounty, carried: lost, x: e.x, z: e.z, team: TEAM });
            this.events.push({ type: "strike", x: e.x, z: e.z, radius: 3, team: TEAM, victims: [] });
            e.cargo = [];
          }
        }
        continue;
      }
      if (hyp(e.x - exit.x, e.z - exit.z) <= exit.r) {
        // Through the line: lives lost (two for heavy machines and carriers), and the unit leaves the field.
        const cost = e.leak_lives ?? ((e.pop || 1) >= 3 ? 2 : 1);
        d.lives = Math.max(0, d.lives - cost);
        d.leaked += 1;
        e.leaked = true;
        e.hp = 0;
        e.orders = [];
        this.events.push({ type: "leak", lives: d.lives, cost, x: e.x, z: e.z, team: FOE });
        continue;
      }
      if (e.wave !== undefined && d.open) (held ||= new Map()).set(e.wave, (held.get(e.wave) || 0) + 1);
      else alive++;
    }
    // An earlier wave whose last unit fell: its bonus and the repair, once, oldest first.
    if (d.open) {
      for (const n of d.open.slice()) if (!held?.get(n)) { d.open.splice(d.open.indexOf(n), 1); this.creditWave(n); }
      if (!d.open.length) delete d.open;
    }
    if (d.active && !d.queue.length && !alive) {
      // Wave beaten: its bonus, every tower patched up, and the countdown to the next one.
      d.active = false;
      this.creditWave(d.wave);
      if (d.wave < this.waveTotal()) d.nextAt = this.time + (def.gap ?? 16);
    }
  },
  // Free spots for `count` units of radius r around (x, z): the middle, then rings of six every
  // 1.5 m (Reinforce), or with `inner` only the rings, from that radius out (a carrier's drop).
  ringSpots(x, z, r, count, inner = 0) {
    const spots = [];
    for (let k = inner ? 1 : 0; spots.length < count && k < (inner ? 25 : 24); k++) {
      const ring = k ? (inner || 1.5) + Math.floor((k - 1) / 6) * 1.5 : 0, angle = k * (Math.PI / 3) + (inner ? Math.floor((k - 1) / 6) * (Math.PI / 6) : 0);
      const p = { x: x + Math.cos(angle) * ring, z: z + Math.sin(angle) * ring };
      if (this.nav.canStand(p.x, p.z, r) && !spots.some((q) => hyp(q.x - p.x, q.z - p.z) < r * 2)) spots.push(p);
    }
    return spots;
  },
  // ---------------------------------------------------------------- Troop carriers (0.22)
  // A carrier (`carrier: true` in balance.json) holds `cargo`, the passengers' types in boarding
  // order, until it reaches route point `dropLeg`. There it stops (`unloadAt`), the squad steps
  // out around it on the road and walks on from the nearest leg, and the empty carrier waits
  // (`departAt`) and drives on. Called from stepRoute; true while the carrier stands still.
  stepCarrier(e, o, pts) {
    e.moving = false;
    if (!e.cargo) {
      if (this.time < e.departAt - 1e-9) return true;
      delete e.departAt;
      return false;
    }
    if (e.unloadAt === undefined) {
      if (o.leg <= Math.min(e.dropLeg ?? 1, pts.length - 2)) return false;
      e.unloadAt = this.time + UNLOAD;
      this.events.push({ type: "unload", id: e.id, x: e.x, z: e.z, count: e.cargo.length, team: FOE });
    }
    return true;
  },
  // The passengers out, in boarding order, on free spots around the carrier (stepDefence, after the
  // spawns). Any that find no room wait aboard for the next tick; after UNLOAD_MAX they step out
  // where the carrier stands.
  dropCargo(e) {
    const def = this.defenceDef(), o = e.orders[0], route = o?.type === "route" ? o.route : null, pts = route && def.routes[route];
    const r = Math.max(...e.cargo.map((type) => D[type]?.radius || 0.7));
    // The first ring clears the truck's long body (about twice its collision radius from the middle).
    const spots = this.ringSpots(e.x, e.z, r, e.cargo.length, e.radius * 2 + r + 0.2);
    if (this.time >= e.unloadAt + UNLOAD_MAX - 1e-9) while (spots.length < e.cargo.length) spots.push({ x: e.x, z: e.z });
    const out = [];
    for (const p of spots) {
      const type = e.cargo.shift(), u = this.spawn(type, FOE, p.x, p.z, true, true);
      if (e.cargoHp) { u.hp = u.maxHp = Math.round(u.maxHp * e.cargoHp); this.setBaseHp(u); }
      if (e.wave !== undefined) u.wave = e.wave;
      u.angle = e.angle;
      // From the nearest leg, never back past the carrier's own (the squad does not walk back to the stop).
      if (pts) u.orders = [{ type: "route", route, leg: Math.max(nearestLeg(pts, u), o.leg) }];
      out.push(u.id);
    }
    if (out.length) this.events.push({ type: "drop", id: e.id, ids: out, x: e.x, z: e.z, team: FOE });
    if (!e.cargo.length) {
      delete e.cargo;
      delete e.cargoHp;
      delete e.unloadAt;
      delete e.dropLeg;
      e.departAt = this.time + DEPART;
    }
  },
};
