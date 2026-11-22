// Presentation only: critical damage never adds damage-over-time or obstacles.
import { weaponStyle } from './visual-style.js';
import { groundSplashRadius } from './fx-kinds/weapon-class.js';
import { CELL } from './fx-kinds/cells.js';

// Damage states drawn by the 3D effects (src/fx.js): completed buildings smoke below half
// health and burn (fire and smoke) below a quarter; machines burn below 35%. Infantry and
// unfinished construction never smoke or burn.
export const DAMAGE = { smoke: .5, fire: .25, machineFire: .35 };
export const SMOKING = 1, BURNING = 2;
export function damageState(e) {
  if (!e.complete || !(e.hp > 0) || !(e.maxHp > 0)) return 0;
  const share = e.hp / e.maxHp;
  if (e.kind === 'building') return share < DAMAGE.fire ? BURNING : share < DAMAGE.smoke ? SMOKING : 0;
  if (e.mechanical === true) return share < DAMAGE.machineFire ? BURNING : 0;
  return 0;
}
export function isBurning(e) {
  return damageState(e) === BURNING;
}
export function effectDuration(e) {
  return e.type === 'impact' ? .28 : e.building || e.heavy ? 2.2 : .75;
}
// Fires the player can see, capped at 8 in Eco and 16 in High. Shared by the 3D effects and
// the HUD snapshot so both agree on what burns; hidden enemies never reveal their damage.
export function burningEntities(sim, lowPower, out = []) {
  const limit = lowPower ? 8 : 16;
  out.length = 0;
  for (const e of sim.entities) {
    if (out.length >= limit) break;
    if (isBurning(e) && sim.isVisible(e)) out.push(e);
  }
  return out;
}
// Everything the effects draw damage on: the fires above plus smoking buildings (6 in Eco,
// 12 in High). Fills and returns `out`, so the frame loop allocates nothing.
export function damagedEntities(sim, lowPower, out = []) {
  const fires = lowPower ? 8 : 16, smokes = lowPower ? 6 : 12;
  let burning = 0, smoking = 0;
  out.length = 0;
  for (const e of sim.entities) {
    const state = damageState(e);
    if (!state || (state === BURNING ? burning >= fires : smoking >= smokes) || !sim.isVisible(e)) continue;
    if (state === BURNING) burning++; else smoking++;
    out.push(e);
    if (burning >= fires && smoking >= smokes) break;
  }
  return out;
}

// How hard a landing round hits, by weapon: tank shells 1, Breaker artillery more, rockets
// less, small arms 0 (sparks and a dust puff only). Faction weapons fall back on their kind.
export const HIT_POWER = { tank: 1, breaker: 1.25, tower: .9, antitank: .75 };
export function hitPower(weapon, kind) {
  if (Object.hasOwn(HIT_POWER, weapon)) return HIT_POWER[weapon];
  return kind === 'cannon' ? 1 : kind === 'rocket' ? .75 : 0;
}

// Scorch marks from hits share the decal layer with destruction scorches. Hits are capped
// (24, 12 in Eco), and a hit landing on a fresh scorch darkens that one instead of stacking
// another. Returns {merge: i} (reuse scorch i), {evict: i} (drop the oldest hit scorch i
// first) or {} (room for a new one). `marks` are decal particles: {x, z, age, life, hitScorch}.
export const SCORCH = { life: 14, hold: .35, cap: 24, ecoCap: 12, merge: 1.1 };
export function scorchPlan(marks, x, z, cap, merge = SCORCH.merge) {
  let count = 0, oldest = -1, oldestAge = -Infinity;
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (!m.hitScorch || m.age >= m.life) continue;
    if (Math.abs(m.x - x) < merge && Math.abs(m.z - z) < merge && (m.x - x) ** 2 + (m.z - z) ** 2 < merge * merge) return { merge: i };
    count++;
    if (m.age > oldestAge) { oldestAge = m.age; oldest = i; }
  }
  return count >= cap ? { evict: oldest } : {};
}

// Hit flash: a struck unit or building lights up warm white for ~0.1 s through its
// per-instance colour (src/entity-batches.js), then returns to its own tint. Shields flash
// pale cyan. The flash waits for the round to arrive when the shot is drawn flying.
export const HIT_FLASH = { seconds: .1, warm: [3.4, 3, 2.3], shield: [1.7, 2.6, 3.2], building: .4 };
export function startFlash(state, wait = 0, shield = false) {
  state.flashWait = Math.max(0, wait);
  state.flashShield = !!shield;
}
// Advances the flash by dt and writes the tint to `out` (an [r, g, b] array). Returns true
// while the tint differs from white; false once there is nothing to draw.
export function stepFlash(state, dt, out, strength = 1) {
  if (state.flashWait >= 0) {
    state.flashWait -= dt;
    if (state.flashWait > 0) return false;
    state.flashWait = -1;
    state.flashLeft = HIT_FLASH.seconds; // the landing frame shows the full flash
  } else if (state.flashLeft > 0) state.flashLeft = state.flashLeft - dt > 1e-6 ? state.flashLeft - dt : 0;
  if (!(state.flashLeft > 0)) return false;
  const k = (state.flashLeft / HIT_FLASH.seconds) * strength, peak = state.flashShield ? HIT_FLASH.shield : HIT_FLASH.warm;
  for (let i = 0; i < 3; i++) out[i] = 1 + (peak[i] - 1) * k;
  return true;
}

// The combat-animation preference shared by the 3D effects (src/fx.js): off when the player
// disables "Animate combat effects" or the system requests reduced motion.
export class CombatPainter {
  constructor(view) { this.view = view; }
  get motion() { return this.view.settings.combatMotion !== false && !this.view.reducedMotion.matches; }
}

// ---------------------------------------------------------------- counter hits (AAA round 2, W2-E)
// A hit is effective when the shooter's `counter` is the target's class, or the shooter has a mechanical bonus
// and the target is mechanical (the rules of sim/combat.js `hit`, read-only); it is resisted when the target
// counters the shooter's class, or when infantry fire hits a machine they have no bonus against. `src` and
// `target` are entities (or definitions). 1 = effective, -1 = resisted, 0 = neither.
export function counterKind(src, target) {
  if (!src || !target) return 0;
  if ((src.counter && src.counter === target.class) || (target.mechanical && src.mechanical_bonus > 1)) return 1;
  if (target.counter && target.counter === src.class) return -1;
  if (target.mechanical && src.kind === 'unit' && (src.class === 'ranged' || src.class === 'melee')) return -1;
  return 0;
}

// ---------------------------------------------------------------- damage numbers and tag labels
// Floating numbers come from the per-frame change of every entity's hp + shield (so splash, burn, strikes and
// boss zones count; an increase is a heal and shows nothing). The loss of one target is summed for
// NUMBERS.window seconds and shown as one number (Tank_game_3D hit-feedback.ts does the same). Slots are
// preallocated: nothing is allocated per frame once an entity is known. A view plugin draws them
// (src/counter-hit-view.js); this class is plain data and runs headless.
export const NUMBERS = { window: .14, life: .9, rise: 1.5, cap: 24, tagLife: 1.1, min: .05, prune: 60 };
export const TAG_TEXT = { rear: 'REAR', pinned: 'PINNED', pierce: 'PIERCE' };
// "Bosses & Defence" (the default) numbers only a boss or any hit in a Frontier Defence match; "all" numbers everything seen.
export const NUMBER_MODES = ['focus', 'all', 'off'];
export class DamageNumbers {
  constructor(cap = NUMBERS.cap) {
    this.slots = Array.from({ length: cap }, () => ({ on: false, text: '', x: 0, y: 0, z: 0, age: 0, life: 1, kind: 0 }));
    this.watch = new Map(); // entity id -> { total, seen, sum, since, x, y, z, enemy, big }
    this.pending = [];
    this.tagged = new Map(); // target id -> time of its last tag label
    this.stamp = 0;
    this.live = 0;
  }
  reset() {
    this.watch.clear(); this.pending.length = 0; this.tagged.clear();
    for (const s of this.slots) s.on = false;
    this.stamp = 0; this.live = 0;
  }
  // The slot to fill: a free one, else the one that has been showing longest.
  take() {
    let pick = this.slots[0];
    for (const s of this.slots) { if (!s.on) { pick = s; break; } if (s.age > pick.age) pick = s; }
    if (!pick.on) this.live++;
    pick.on = true; pick.age = 0;
    return pick;
  }
  // kind: 0 damage to an enemy, 1 damage to the player's side, 2 big damage (boss or heavy), 3 tag label.
  emit(text, x, y, z, kind, life = NUMBERS.life) {
    const s = this.take();
    s.text = text; s.x = x; s.y = y; s.z = z; s.kind = kind; s.life = life;
    return s;
  }
  // One frame. `now` is the simulation clock. `visible(e)` says whether the player sees the entity.
  observe(sim, now, mode, visible) {
    if (mode === 'off') { if (this.watch.size) this.reset(); return; }
    const focus = mode !== 'all' && !sim.defence, stamp = ++this.stamp;
    for (const e of sim.entities) {
      if (focus && !e.boss) continue;
      if (!Number.isFinite(e.hp)) continue;
      const total = Math.max(0, e.hp) + (e.shield || 0);
      let r = this.watch.get(e.id);
      if (!r) { this.watch.set(e.id, { total, seen: stamp, sum: 0, since: 0, x: e.x, y: 0, z: e.z, enemy: e.team !== 0, big: !!e.boss }); continue; }
      r.seen = stamp;
      const d = r.total - total;
      r.total = total;
      if (d <= NUMBERS.min || !visible(e)) continue;
      if (!(r.sum > 0)) { r.since = now; this.pending.push(r); }
      r.sum += d; r.x = e.x; r.z = e.z; r.enemy = e.team !== 0; r.big = !!e.boss;
      r.y = (e.kind === 'unit' ? (e.flying ? (e.fly || 3) + 1.6 : 2.3) : (e.radius || 2) + 2.4);
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const r = this.pending[i];
      if (now - r.since < NUMBERS.window && r.seen === stamp) continue;
      this.emit(String(Math.round(r.sum)), r.x, r.y, r.z, r.big || r.sum >= 60 ? 2 : r.enemy ? 0 : 1);
      r.sum = 0;
      this.pending[i] = this.pending[this.pending.length - 1]; this.pending.pop();
    }
    if (stamp % NUMBERS.prune === 0) for (const [id, r] of this.watch) if (r.seen < stamp - 1 && !(r.sum > 0)) this.watch.delete(id);
  }
  // A tag label ("REAR", "PINNED", "PIERCE") over a shot's target, at most one per target per 0.5 s.
  tag(ev, now, text) {
    const last = this.tagged.get(ev.target);
    if (last !== undefined && now - last < .5) return null;
    if (this.tagged.size > 200) this.tagged.clear();
    this.tagged.set(ev.target, now);
    return this.emit(text, ev.tx, 3.1, ev.tz, 3, NUMBERS.tagLife);
  }
  step(dt) {
    if (!this.live) return;
    for (const s of this.slots) {
      if (!s.on) continue;
      s.age += dt;
      if (s.age >= s.life) { s.on = false; this.live--; }
    }
  }
}

// ---------------------------------------------------------------- death looks (AAA round 3, R3-K)
// Three ways a unit dies, by what killed it, so a fight reads at a glance:
//   BALLISTIC  rifles, bursts, pellets, melee: the fall or wreck hop as before, plus a dust kick;
//   BLAST      shells, rockets, bombs, barrages and splash: thrown back along the shot, a fire flash and
//              chunks (a vehicle flips higher and turns, a secondary fireball);
//   SEARED     beams, rails, pulses and flame: a flash in the weapon's own colour, rising embers and ash,
//              the body charred dark where it stands.
// A view plugin (docs/VIEW_PLUGINS.md) remembers each target's last shot. The killing shot's event comes
// after the death event in the same frame (sim/combat.js pushes the shot after the damage), so the look
// is settled in update(), once every event of the frame is in; WorldView.beginDeath leaves `look` at 0
// for that. Every effect comes from the existing pools in src/fx.js: no new mesh, no new draw call.
export const DEATH_LOOK = { ballistic: 1, blast: 2, seared: 3 };
export const DEATH_CHAR = [0.24, 0.2, 0.18]; // a seared body: charred, a little warmer than the wreck tint
const SEARING = new Set(['flame']);
const PRECISION = new Set(['rocket', 'rail', 'beam', 'hose', 'plough', 'bomb', 'twin-pulse']);
const BULLET = { kind: 'rifle' };
const BLASTING = new Set(['bomb', 'firebomb', 'plough', 'pods', 'rocket', 'twin-heavy']);
const STRIKE_STYLE = { kind: 'cannon', look: 'strike', color: [1, 0.7, 0.3, 1] };
// The look a shot of this style gives the unit it kills.
export function deathLookOf(style) {
  if (!style) return DEATH_LOOK.ballistic;
  if (PRECISION.has(style.look)) return DEATH_LOOK.ballistic;
  if (SEARING.has(style.look)) return DEATH_LOOK.seared;
  if (style.kind === 'cannon' || style.kind === 'rocket' || BLASTING.has(style.look)) return DEATH_LOOK.blast;
  return DEATH_LOOK.ballistic;
}
// Seconds a remembered shot still names the killer; zones (splash, barrages) only count in their own frame.
const REMEMBER = 4, ZONE_SLOTS = 8;

export class DeathLooks {
  constructor(view) {
    this.view = view;
    this.last = new Map(); // target id -> { style, at } (records reused through `free`)
    this.free = [];
    this.zones = Array.from({ length: ZONE_SLOTS }, () => ({ x: 0, z: 0, r: 0, style: null, at: -1 }));
    this.zoneNext = 0;
    this.frame = 0;
    this.counts = [0, 0, 0, 0]; // looks resolved this match, by code (tests and probes)
  }
  event(ev, sim) {
    if (ev.type === 'shot' && ev.target != null) {
      const base = weaponStyle(ev);
      const radius = groundSplashRadius(ev, sim);
      const style = radius || base.look === 'flame' ? base : BULLET;
      let r = this.last.get(ev.target);
      if (!r) this.last.set(ev.target, (r = this.free.pop() || { style: null, at: 0 }));
      r.style = style; r.at = sim.time;
      if (Number.isFinite(ev.tx) && deathLookOf(style) === DEATH_LOOK.blast && radius) this.zone(ev.tx, ev.tz, radius, style, sim.time);
    } else if (ev.type === 'strike' && Number.isFinite(ev.x)) this.zone(ev.x, ev.z, (ev.radius || 4) + 0.5, STRIKE_STYLE, sim.time);
  }
  zone(x, z, r, style, at) {
    const s = this.zones[this.zoneNext];
    this.zoneNext = (this.zoneNext + 1) % ZONE_SLOTS;
    s.x = x; s.z = z; s.r = r; s.style = style; s.at = at;
  }
  // The style that killed entity `id` lying at (x, z) at time `now`: a splash or barrage of this frame,
  // else the last shot at it, else none (ballistic).
  killer(id, x, z, now) {
    const r = this.last.get(id);
    if (r && r.at >= now - 1e-6) return r.style; // the killing shot itself, this frame
    for (const s of this.zones) if (s.at >= now - 1e-6 && (s.x - x) ** 2 + (s.z - z) ** 2 <= s.r * s.r) return s.style;
    return r && now - r.at <= REMEMBER ? r.style : null;
  }
  update(sim, dt) {
    const dying = this.view.dying;
    if (dying?.length) for (let i = 0; i < dying.length; i++) {
      const d = dying[i];
      if (d.look !== 0) continue;
      const style = this.killer(d.id, d.x, d.z, sim.time);
      d.look = deathLookOf(style);
      if (d.kind !== 'infantry' && d.kind !== 'vehicle') { d.look = DEATH_LOOK.ballistic; continue; } // buildings, flyers, bosses keep their own falls
      this.counts[d.look]++;
      const r = this.last.get(d.id);
      if (r) { this.last.delete(d.id); r.style = null; this.free.push(r); }
      if (d.look === DEATH_LOOK.seared && d.kind === 'infantry') this.char(d.object);
      if (d.object.visible !== false) this.effects(d, style);
    }
    if (++this.frame % 120 === 0) for (const [id, r] of this.last) if (sim.time - r.at > REMEMBER) { this.last.delete(id); r.style = null; this.free.push(r); }
  }
  // A seared soldier goes dark at once (per-instance tint: same batches, no draw).
  char(o) {
    const u = o.userData;
    o.userData.model?.traverse?.((part) => { if (part.isMesh) part.userData.tint = DEATH_CHAR; });
    if (u.flashParts) u.flashBase = u.flashParts.map(() => DEATH_CHAR);
  }
  effects(d, style) {
    const fx = this.view.fx;
    if (!fx?.particle) return;
    const anchor = { x: d.x, z: d.z, team: d.team }, heavy = d.kind === 'vehicle';
    if (d.look === DEATH_LOOK.blast) {
      fx.particle(fx.glow, { x: d.x, y: heavy ? 1.2 : 0.9, z: d.z, s0: heavy ? 2.6 : 1.6, s1: heavy ? 3.6 : 2.4, life: 0.18, c0: [1, 0.86, 0.5, 0.95], c1: [1, 0.4, 0.1, 0], anchor });
      fx.addDebris({ x: d.x, y: 0.9, z: d.z }, heavy ? 6 : 3, anchor, heavy ? 1.1 : 0.7, heavy ? 2 : 0);
      fx.dust({ x: d.x, y: 0.3, z: d.z }, heavy ? 4 : 2, anchor, heavy ? 1.2 : 0.8);
      if (heavy) fx.explosion({ x: d.x, y: 1.3, z: d.z }, 0.7, anchor, false);
    } else if (d.look === DEATH_LOOK.seared) {
      const c = style?.color || [1, 0.6, 0.25, 1], m = fx.motion;
      fx.particle(fx.glow, { x: d.x, y: 1, z: d.z, s0: heavy ? 2.4 : 1.5, s1: heavy ? 3.4 : 2.4, life: 0.32, c0: [c[0], c[1], c[2], 0.95], c1: [c[0], c[1], c[2], 0], anchor });
      fx.burst(fx.glow, fx.count(heavy ? 10 : 7), { x: d.x, y: 0.8, z: d.z }, { life: 1.1, s0: 0.22, s1: 0.06, drag: 1.4, gravity: m ? -1.6 : 0,
        c0: [1, 0.86, 0.5, 1], c1: [c[0], c[1], c[2], 0], anchor }, [0.4, 1.4], 1.2);
      fx.burst(fx.smoke, fx.count(heavy ? 5 : 3), { x: d.x, y: 0.9, z: d.z }, { life: m ? 1.8 : 0.9, s0: 0.5, s1: 1.8, drag: 1.2, gravity: m ? -0.8 : 0,
        cell: CELL.puff, c0: [0.12, 0.11, 0.11, 0.7], c1: [0.3, 0.29, 0.28, 0], anchor, fadeIn: 0.1 }, [0.2, 0.7], 1.5);
    } else if (!heavy) fx.dust({ x: d.x, y: 0.2, z: d.z }, 2, anchor, 0.7, 0.8);
  }
  reset() {
    for (const r of this.last.values()) { r.style = null; this.free.push(r); }
    this.last.clear();
    for (const s of this.zones) { s.at = -1; s.style = null; }
    this.counts.fill(0);
  }
}
