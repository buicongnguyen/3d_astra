// Presentation only: critical damage never adds damage-over-time or obstacles.
export function isBurning(e) {
  return e.complete && e.hp > 0 && e.maxHp > 0 && e.hp < e.maxHp * .35 &&
    (e.kind === 'building' || e.mechanical === true);
}
export function effectDuration(e) {
  return e.type === 'impact' ? .28 : e.building || e.heavy ? 2.2 : .75;
}
// Fires the player can see, capped at 8 in Eco and 16 in High. Shared by the 3D effects and
// the HUD snapshot so both agree on what burns; hidden enemies never reveal their damage.
export function burningEntities(sim, lowPower) {
  const limit = lowPower ? 8 : 16, out = [];
  for (const e of sim.entities) {
    if (out.length >= limit) break;
    if (isBurning(e) && sim.isVisible(e)) out.push(e);
  }
  return out;
}

// The combat-animation preference shared by the 3D effects (src/fx.js): off when the player
// disables "Animate combat effects" or the system requests reduced motion.
export class CombatPainter {
  constructor(view) { this.view = view; }
  get motion() { return this.view.settings.combatMotion !== false && !this.view.reducedMotion.matches; }
}
