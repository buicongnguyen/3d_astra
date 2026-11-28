// H8 Hero challenges: a headless player for tests/hero-challenges.test.js and the difficulty check. It drives Skywing
// in Hero mode with the same commands the page sends (heroMode, heroDrive, heroFire, heroDodge, skywingLand,
// challengePlant), so a run is a command log that replays exactly. Two styles:
//   "bold"   walks straight to each goal and shoots whatever it sees (a Sabotage is seen and sounds the alarm):
//            the check that Relaxed and Normal stay winnable for a careless player
//   "quiet"  (Sabotage) looks ahead on a copy of the match (a save restored) before each step: it walks on only when
//            the next stretch stays unseen for QUIET.ahead real seconds, else it waits where it is, crouched
import { Simulation } from "../../src/simulation.js";
import { enterCommands } from "../../src/sim/content/hero-mode.js";
import { restore } from "../../src/snapshot.js";

export const QUIET = Object.freeze({ ahead: 5, every: 4 });

export const TICK = 0.05;
export const ROUTES = {
  sabotage: {
    // Legs: walk the points, then plant at the relay named by `plant` (null: the way out, to the end).
    legs: [
      { to: [{ x: -12, z: 4 }, { x: -4, z: -9.8 }, { x: -0.8, z: -10.5 }, { x: -1.5, z: -24 }, { x: -2, z: -28.5 }, { x: -11.6, z: -30 }, { x: -11.6, z: -44 }, { x: 6, z: -48.5 }, { x: 11.5, z: -49 }], plant: "relayA" },
      { to: [{ x: 6, z: -48.5 }, { x: -11.6, z: -44 }, { x: -11.6, z: -30 }, { x: -2, z: -28.5 }, { x: -1.5, z: -24 }, { x: -0.8, z: -10.5 }, { x: 10, z: -6 }, { x: 28, z: -4 }, { x: 31, z: -13 }, { x: 40, z: -15.6 }, { x: 42, z: -21 }], plant: "relayB" },
      { to: [{ x: 56, z: -17 }, { x: 60, z: -8 }, { x: 58, z: -2 }], plant: null, rush: 1 },
    ],
  },
  sniper: { nest: { x: 34, z: -22.6 } },
};

export function challengeSim(def, difficulty = "standard") {
  return new Simulation({ map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, mission: def, difficulty });
}

const hyp = Math.hypot;
// Plays `def` with the bot to the end (or `limit` game seconds). Returns { sim, result, seconds }.
export function playChallenge(def, { difficulty = "standard", style = "bold", limit = 600, scale = 0.5, crouch = true } = {}) {
  const s = challengeSim(def, difficulty);
  const hero = () => s.get(s.skywing?.id);
  const send = (c) => s.command({ team: 0, ...c });
  for (const c of enterCommands(0, hero().id, scale)) s.command(c);
  if (crouch) send({ type: "heroCrouch", on: "auto" });
  const kind = def.challenge.kind;
  let leg = "in", wp = 0, point = 0, fire = null, drive = "", landing = false, checkAt = 0, safe = true, back = null;
  // A copy of the match walked along `points` for QUIET.ahead real seconds: true when nobody saw the hero.
  const ahead = (points) => {
    const copy = restore(Simulation, s.serialize()), h = copy.get(copy.skywing.id);
    let i = 0, key = "";
    for (let t = 0, n = Math.round((QUIET.ahead * scale) / TICK); t < n; t++) {
      const p = points[Math.min(i, points.length - 1)], dx = p.x - h.x, dz = p.z - h.z, d = hyp(dx, dz);
      if (d < 0.35) { if (i < points.length - 1) i++; else break; }
      const k = d < 0.35 ? "0,0" : `${(dx / d).toFixed(3)},${(dz / d).toFixed(3)}`;
      if (k !== key) { key = k; copy.command({ team: 0, type: "heroDrive", dx: d < 0.35 ? 0 : dx / d, dz: d < 0.35 ? 0 : dz / d }); }
      copy.tick(TICK);
      if (copy.challenge.sus > 0.02 || copy.challenge.alarm) return false;
    }
    return true;
  };
  const go = (p) => {
    const e = hero(), dx = p.x - e.x, dz = p.z - e.z, d = hyp(dx, dz);
    const key = d < 0.35 ? "0,0" : `${(dx / d).toFixed(3)},${(dz / d).toFixed(3)}`;
    if (key !== drive) { drive = key; if (d < 0.35) send({ type: "heroDrive", dx: 0, dz: 0 }); else send({ type: "heroDrive", dx: dx / d, dz: dz / d }); }
    return d < 0.35;
  };
  const shoot = (filter = () => true) => {
    const e = hero();
    let best = null, bd = Infinity;
    for (const t of s.entities) {
      if (t.hp <= 0 || t.team === 0 || t.kind !== "unit" || !s.isVisible(t, 0) || !filter(t)) continue;
      const d = hyp(t.x - e.x, t.z - e.z);
      if (d < bd) { best = t; bd = d; }
    }
    const want = best && bd <= (e.range || 12) + 14 ? best.id : null;
    if (want !== fire) { fire = want; send({ type: "heroFire", target: want, hold: true }); }
  };
  const end = Math.round(limit / TICK);
  while (s.ticks < end && !s.result) {
    const e = hero();
    if (!e) { s.tick(TICK); continue; }
    if (kind === "sabotage") {
      const c = s.challenge, L = ROUTES.sabotage.legs[Math.min(wp, ROUTES.sabotage.legs.length - 1)];
      if (c.alarm) shoot();
      if (leg === "in") {
        const p = L.to[point];
        // Quiet: walk on only while a look ahead on a copy stays unseen; else hold still (crouched by cover).
        if (style === "quiet" && !c.alarm && s.ticks >= checkAt) {
          checkAt = s.ticks + QUIET.every;
          safe = ahead(L.to.slice(point));
          // Not safe to go on, nor to stay: back to the last point (behind the last cover) until it is.
          back = !safe && point > 0 && !ahead([{ x: e.x, z: e.z }]) ? L.to[point - 1] : back && !safe ? back : null;
        }
        // A leg may rush its first points (away from a charge about to blow).
        if (style === "quiet" && !c.alarm && !safe && point >= (L.rush || 0)) go(back || e);
        else if (go(p)) { point++; back = null; if (point >= L.to.length) { point = 0; leg = L.plant ? "plant" : "done"; } }
      } else if (leg === "plant") {
        go(e);
        if (!c.planting) send({ type: "challengePlant", on: true });
        if (c.charges[L.plant].set) { send({ type: "challengePlant", on: false }); wp++; leg = "in"; }
      } else go(e);
    } else {
      const c = s.challenge, nest = ROUTES.sniper.nest;
      if (leg === "in") {
        if (e.flying && !e.skyland) {
          const d = hyp(nest.x - e.x, nest.z - e.z);
          if (d > 4) go(nest);
          else { go(e); if (!landing && s.command({ team: 0, type: "skywingLand", id: e.id, land: true, x: nest.x, z: nest.z })) landing = true; }
        } else if (!e.skyland) { go(e); leg = "fight"; }
      } else {
        go(e);
        // Trucks first, then escorts that come close.
        shoot((t) => t.tag === "convoy" || (t.tag === "escort" && hyp(t.x - e.x, t.z - e.z) < 12));
        void c;
      }
    }
    s.tick(TICK);
  }
  return { sim: s, result: s.result, seconds: s.time, real: s.challenge?.real ?? 0 };
}

// Replays a played sim's command log on a fresh copy; returns the new sim.
export function replayLog(def, played, difficulty = "standard") {
  const r = challengeSim(def, difficulty);
  const log = played.commandLog.map((c) => ({ ...c }));
  let i = 0;
  for (let tick = 0; tick < played.ticks; tick++) {
    while (i < log.length && log[i].tick === tick) { const { tick: _, ...cmd } = log[i++]; r.command(cmd); }
    r.tick(TICK);
  }
  return r;
}
