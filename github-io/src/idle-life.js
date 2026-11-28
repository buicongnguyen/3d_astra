// Idle life (2026-11-28; owner: "when they are idle then can we make it sit down and stand up or doing some fun thing a
// little like doing exercise?"). View only: nothing here reads the simulation's random numbers or writes its state, so
// replays, save hashes and the golden bench stay byte-identical.
//
// A soldier that has stood idle for about IDLE.wait seconds (no orders, not moving or fighting, no enemy in sight and
// not the hero being driven) picks something to do: sit down on the ground with its legs out and look about, do a few
// squats, stretch (lean back, then a side twist), or look around. Soldiers idling near their own Barracks drill instead:
// squats together on one shared beat (the fun moment: a base of troops doing their exercises in step). Any order, an
// enemy coming into view or a hit makes it stand at once (IDLE.stand seconds); the rules never wait for it.
//
// Poses ride the shader bones (src/unit-rig.js): the head bone turns and nods, the spine twists, the low pose squats and
// sits, the body leans; the view packs them into the per-instance pose (packIdle), so nothing adds a draw. Every motion
// is driven by time accumulated since the activity began (never a global clock), so nothing jumps; at most
// IDLE.budget units act at once (fewer on phones), units off screen or hidden are left standing, and the whole thing is
// off with Settings > Unit motion off, reduced motion or the frame governor's still level (WorldView.richMotion).
import { lowPose } from "./unit-rig.js";

export const IDLE = Object.freeze({
  wait: 8, // seconds standing idle before the first activity (plus up to `jitter`)
  again: 4, // before each later one (plus up to `jitter`)
  jitter: 4,
  slot: 20, // seconds per time slot in the activity hash
  budget: Object.freeze({ pc: 24, phone: 12 }),
  drillRadius: 12, // metres from the unit to its own finished Barracks
  reach: 5, // a visible enemy within the unit's sight plus this ends idling
  rise: 0.5, // seconds to blend into an activity (a drill joined mid-rep)
  stand: 0.3, // seconds to stand up when interrupted
  check: 0.25, // seconds between enemy checks while it waits (every frame while it acts)
  squat: 0.42, // the low pose at the bottom of a squat (src/unit-rig.js lowPose: 0.5 is the full squat)
  rep: 1.5, // seconds per squat
  drill: Object.freeze({ reps: 6, rep: 1.6, rest: 4 }),
});
export const ACTIVITIES = Object.freeze(["sit", "squats", "stretch", "look"]);
const ALL = ACTIVITIES, LOOK = Object.freeze(["look"]);
// The drill clock wraps after a whole number of drill cycles (no jump in the beat).
const DRILL_WRAP = 200 * (IDLE.drill.reps * IDLE.drill.rep + IDLE.drill.rest);
// What each infantry type may do. The Gunner team only looks about: its machine gun stands on a tripod in the same
// rigid body, which a squat or a seat would push into the ground.
export const IDLE_KINDS = new Map([
  ...["ranger", "antitank", "vanguard", "medic", "engineer", "worker", "scrapper", "shade", "stalker", "watcher"].map((t) => [t, ALL]),
  ["gunner", LOOK],
]);

// A well-mixed hash in [0, 1) of a unit id, a slot and a salt (never the simulation's random numbers).
export function idleHash(id, slot, salt = 0) {
  let h = Math.imul((id | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((slot | 0) + 0x632be5ab) ^ Math.imul(salt + 1, 0x27d4eb2f), 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// The activity a unit of `type` picks in `slot`; null for a type with no idle life.
export function chooseActivity(type, id, slot) {
  const kinds = IDLE_KINDS.get(type);
  return kinds ? kinds[Math.floor(idleHash(id, slot, 1) * kinds.length)] : null;
}
// Seconds of standing idle before the activity of `slot` starts (`first`: the unit's first since it last stood still).
export const idleDelay = (id, slot, first) => (first ? IDLE.wait : IDLE.again) + idleHash(id, slot, 2) * IDLE.jitter;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
// 0 -> 1 between a and b, back to 0 between c and d.
const hold = (t, a, b, c, d) => ease((t - a) / (b - a)) - ease((t - c) / (d - c));

// Each activity writes its raw pose into p ({ yaw, nod, low, lean, twist }) at its own time t and returns true when it is
// over (every one starts and ends standing, so it needs no blend of its own). s.dir (+1 / -1) and s.len vary it by unit.
export const ACT = Object.freeze({
  sit(p, t, s) {
    const down = 0.6, up = 0.45, end = down + s.len, look = hold(t, down + 0.3, down + 1.2, end - 0.9, end - 0.2);
    p.low = t < down ? ease(t / down) : t < end ? 1 : 1 - ease((t - end) / up);
    p.yaw = s.dir * 0.6 * Math.sin(0.8 * Math.max(0, t - down)) * look;
    p.nod = 0.08 * look;
    return t >= end + up;
  },
  squats(p, t, s) {
    const u = t / IDLE.rep;
    p.low = u < s.reps ? IDLE.squat * (1 - Math.cos(2 * Math.PI * u)) / 2 : 0;
    p.nod = -0.15 * (p.low / IDLE.squat); // the face stays forward as the body leans over the squat
    return u >= s.reps;
  },
  stretch(p, t, s) {
    const back = hold(t, 0, 0.6, 1.8, 2.3);
    p.lean = -0.3 * back;
    p.nod = -0.3 * back; // looking up at the sky
    p.twist = s.dir * 0.5 * (ease((t - 2.4) / 0.5) - 2 * ease((t - 3.4) / 0.8) + ease((t - 4.8) / 0.5));
    p.yaw = p.twist * 0.6; // and over the shoulder
    return t >= 5.4;
  },
  look(p, t, s) {
    const a = s.dir * (0.6 + 0.2 * s.amp);
    p.yaw = a * (ease(t / 0.5) - 2 * ease((t - 1.7) / 0.9) + ease((t - 3.8) / 0.5));
    p.nod = -0.06 * hold(t, 0, 0.5, 3.8, 4.3);
    return t >= 4.4;
  },
  // The Barracks drill: squats on the shared beat (the view's one drill clock), then a short stretch, round and round.
  drill(p, t, s, clock) {
    const D = IDLE.drill, set = D.reps * D.rep, u = clock % (set + D.rest);
    p.low = u < set ? IDLE.squat * (1 - Math.cos(2 * Math.PI * (u / D.rep))) / 2 : 0;
    p.nod = -0.15 * (p.low / IDLE.squat);
    const r = u - set;
    p.lean = u < set ? 0 : -0.22 * hold(r, 0, 0.8, D.rest - 1.4, D.rest - 0.4);
    return false;
  },
});

// The view's idle-life controller: one per WorldView. begin() once a frame, then unit() for each rigged soldier drawn.
export class IdleLife {
  constructor({ budget = IDLE.budget.pc } = {}) {
    this.budget = budget;
    this.enabled = false;
    this.frame = 0;
    this.clock = 0; // seconds of play seen (the time slot of the hash)
    this.drillClock = 0; // the drill's shared beat
    this.live = new Set(); // states with an activity
    this.threats = []; // per team: { frame, n, xz: Float32Array } of visible enemies
    this.barracks = []; // per team: { frame, n, xz }
    this.lp = {};
    this.started = 0; // activities begun (tests, probes)
  }
  // enabled: the view's rich motion and the idle option; budget: how many may act at once on this device.
  begin(dt, enabled, budget = this.budget) {
    this.frame++;
    this.budget = budget;
    this.enabled = enabled;
    if (enabled && dt > 0) { this.clock += dt; this.drillClock = (this.drillClock + dt) % DRILL_WRAP; }
    // A unit with an activity that was not drawn last frame (gone, hidden in fog, a new match) stops it.
    for (const s of this.live) if (!enabled || s.frame < this.frame - 1) this.stop(s);
  }
  stop(s) {
    s.act = null; s.w = 0; s.ending = false; s.calm = 0;
    this.live.delete(s);
  }
  // Force an activity now (tests and the probe): skips the wait, never the budget.
  force(rig, e, act) {
    const s = this.state(rig, e);
    if (s.act) this.stop(s);
    if (this.live.size >= this.budget) return false;
    this.start(s, e, act);
    s.frame = this.frame; // drawn "this frame": the next one carries on without a gap
    return true;
  }
  state(rig, e) {
    return (rig.idle ||= { id: e.id, frame: -9, calm: 0, wait: idleDelay(e.id, 0, true), first: true, n: 0, act: null, t: 0, w: 0,
      ending: false, dir: 1, len: 0, reps: 0, amp: 0, health: e.hp + (e.shield || 0), threat: false, checkAt: 0,
      raw: { yaw: 0, nod: 0, low: 0, lean: 0, twist: 0 }, out: { yaw: 0, nod: 0, low: 0, lean: 0, twist: 0, drop: 0, back: 0 } });
  }
  start(s, e, act) {
    s.act = act; s.t = 0; s.w = act === "drill" ? 0 : 1; s.ending = false;
    const slot = s.n + 31 * Math.floor(this.clock / IDLE.slot);
    s.dir = idleHash(e.id, slot, 3) < 0.5 ? -1 : 1;
    s.len = 6 + 4 * idleHash(e.id, slot, 4);
    s.reps = 3 + Math.floor(idleHash(e.id, slot, 5) * 4); // 3-6
    s.amp = idleHash(e.id, slot, 6);
    this.live.add(s);
    this.started++;
  }
  // One frame of one soldier. rig: its view rig (src/unit-rig.js); e: its entity; onScreen: inside last frame's camera
  // view. Returns the pose to pack ({ yaw, nod, low, lean, twist, drop, back }: drop and back in model units, from
  // lowPose) or null (standing as the rules have it).
  unit(rig, e, sim, dt, onScreen) {
    const kinds = IDLE_KINDS.get(e.type);
    if (!kinds) return null;
    const s = this.state(rig, e), gap = s.frame !== this.frame - 1;
    s.frame = this.frame;
    const health = e.hp + (e.shield || 0), hurt = health < s.health - 1e-6;
    s.health = health;
    if (!this.enabled || !onScreen || gap) {
      // Off, out of view, or back after a gap: stand as modelled and wait afresh.
      if (s.act) this.stop(s);
      s.calm = 0;
      if (!onScreen) s.frame = -9; // the next frame on screen counts as back after a gap
      return null;
    }
    const busy = e.hp <= 0 || e.orders.length > 0 || e.moving || e.attacking || e.working || e.target != null || e.driven !== undefined ||
      e.flying || e.knelt || (e.support && e.cooldown > 0);
    if (!busy && (s.act || this.clock >= s.checkAt)) {
      s.threat = this.threatened(sim, e);
      s.checkAt = this.clock + IDLE.check;
    }
    if (busy || hurt || s.threat) {
      // Busy again: the next activity waits the full first delay of standing idle.
      s.calm = 0;
      if (!s.first) { s.first = true; s.wait = idleDelay(e.id, s.n + 31 * Math.floor(this.clock / IDLE.slot), true); }
      if (s.act) s.ending = true;
      if (!s.act) return null;
    } else if (!s.ending) s.calm += dt; // standing up after a hit counts as busy
    if (!s.act) {
      if (s.calm < s.wait || this.live.size >= this.budget) return null;
      const near = kinds.includes("squats") && this.nearBarracks(sim, e);
      this.start(s, e, near ? "drill" : chooseActivity(e.type, e.id, s.n + 31 * Math.floor(this.clock / IDLE.slot)));
    }
    s.t += dt;
    s.w = s.ending ? Math.max(0, s.w - dt / IDLE.stand) : Math.min(1, s.w + dt / IDLE.rise);
    const p = s.raw;
    p.yaw = 0; p.nod = 0; p.low = 0; p.lean = 0; p.twist = 0;
    const done = ACT[s.act](p, s.t, s, this.drillClock);
    if ((done && !s.ending) || (s.ending && s.w <= 0)) {
      // Over: it stands as modelled (every activity ends at rest; an interrupted one has blended out). The next one
      // follows a shorter wait, unless this one was interrupted (then the full first wait, set when it was).
      this.stop(s);
      s.n++;
      if (done && s.w > 0) { s.first = false; s.wait = idleDelay(e.id, s.n + 31 * Math.floor(this.clock / IDLE.slot), false); }
      return null;
    }
    const k = ease(s.w), out = s.out, lp = lowPose(p.low * k, rig.legLength, rig.kneeY || rig.legLength * 0.5, this.lp);
    out.yaw = p.yaw * k; out.nod = p.nod * k; out.low = p.low * k; out.twist = p.twist * k;
    out.lean = p.lean * k + (out.low > 0 ? lp.lean : 0);
    out.drop = out.low > 0 ? lp.drop : 0;
    out.back = out.low > 0 ? lp.back : 0;
    return out;
  }
  // A visible enemy (to the unit's own side) within its sight plus IDLE.reach.
  threatened(sim, e) {
    const list = this.listFor(this.threats, sim, e.team, (o, team) => o.hp > 0 && (o.kind === "unit" || (o.kind === "building" && o.damage > 0)) &&
      sim.hostile(team, o.team) && sim.isVisible(o, team));
    const r = (e.vision || 12) + IDLE.reach, r2 = r * r, xz = list.xz;
    for (let i = 0; i < list.n; i++) { const dx = xz[i * 2] - e.x, dz = xz[i * 2 + 1] - e.z; if (dx * dx + dz * dz < r2) return true; }
    return false;
  }
  nearBarracks(sim, e) {
    const list = this.listFor(this.barracks, sim, e.team, (o, team) => o.type === "barracks" && o.team === team && o.complete && o.hp > 0);
    const r2 = IDLE.drillRadius * IDLE.drillRadius, xz = list.xz;
    for (let i = 0; i < list.n; i++) { const dx = xz[i * 2] - e.x, dz = xz[i * 2 + 1] - e.z; if (dx * dx + dz * dz < r2) return true; }
    return false;
  }
  // A per-team list of entity positions, built at most once a frame into a reused buffer.
  listFor(lists, sim, team, keep) {
    const key = team + 2; // teams from -1 (wild creatures) up
    const list = (lists[key] ||= { frame: -1, n: 0, xz: new Float32Array(64) });
    if (list.frame === this.frame) return list;
    list.frame = this.frame;
    list.n = 0;
    for (const o of sim.entities) {
      if (!keep(o, team)) continue;
      if (list.n * 2 + 2 > list.xz.length) { const grown = new Float32Array(list.xz.length * 2); grown.set(list.xz); list.xz = grown; }
      list.xz[list.n * 2] = o.x; list.xz[list.n * 2 + 1] = o.z; list.n++;
    }
    return list;
  }
}
