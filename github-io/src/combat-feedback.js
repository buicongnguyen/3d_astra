// Presentation only: critical damage never adds damage-over-time or obstacles.

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
