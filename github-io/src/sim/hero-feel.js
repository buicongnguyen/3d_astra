// H8 fight feel in Hero mode (HERO-COINS-PLAN.md "H8 also includes", owner 2026-11-28). Pure rules and figures,
// used by the driven hero's step (sim/content/hero-mode.js) and read by the page (src/hero-mode.js):
//   magazine   each ranged weapon holds MAG rounds; a full magazine fires at MAG.fire of the weapon's interval and the
//              reload takes MAG.share of the interval per round missing, so a whole magazine plus its reload lasts 95%
//              of what the same rounds took before (and the first rounds come sooner; the 5% covers the 0.05 s tick):
//              the hero's damage over time never drops (tests/hero-feel.test.js checks the time to kill);
//              empty, it reloads on its own (phones never need a key); a PC may top up early (heroReload, key X);
//   headshot   a round the page aimed at the head (the heroFire command's `head`) of a soldier (not a machine, a flyer
//              or a boss) does HEAD.bonus (the Sniper HEAD.sniper), only while the spread is tight (<= HEAD.spread);
//   spread     0 (still) to 1 (on the move): rises SPREAD.rise a real second while the hero moves or dashes, falls
//              SPREAD.fall a real second standing still; it widens the drawn crosshair and gates the headshot, and never
//              makes a body shot miss (no shot that hit before misses now);
//   crouch     a driven ground hero with crouch on (PC: the C toggle; phones: always "auto") is crouched when it stands
//              still (spread under CROUCH.still) within CROUCH.near m of a cover piece: dodgeable rounds and splash
//              at it do CROUCH.taken of their damage. Standing up to move costs nothing.
// Everything is in the match state on the driven hero only (keys `mag`, `reloadAt`, `spread`, `crouch`, `crouched`),
// released with the rest when Hero mode ends, so a match without Hero mode saves and hashes as before.
import { COVER_KINDS } from "./cover.js";

export const MAG = Object.freeze({ sniper: 5, rocket: 3, per: 8, min: 4, max: 12, fire: 0.8, share: 0.15 });
export const HEAD = Object.freeze({ bonus: 1.5, sniper: 2, spread: 0.35, height: 1.5 });
export const SPREAD = Object.freeze({ rise: 4, fall: 2.5 });
export const CROUCH = Object.freeze({ taken: 0.5, near: 1.6, still: 0.2 });
// A scoped Sniper (Skywing on foot, standing still; sim/content/skywing.js SIGHT) reaches this far inside its cone.
export const SCOPE_REACH = 26;
// The melee reach (sim/content/hero-mode.js SHOTS.melee): no magazine for a blade.
const MELEE = 2.6;

export const hasMagazine = (e) => (e.range || 0) > MELEE;
// Rounds in a full magazine for the weapon in hand.
export function magSize(e) {
  if (e.weapon === "sniper") return MAG.sniper;
  if (e.weapon === "rocket") return MAG.rocket;
  return Math.max(MAG.min, Math.min(MAG.max, Math.round(MAG.per / Math.max(0.1, e.interval || 1))));
}
// Real seconds to reload `missing` rounds.
export const reloadSeconds = (e, missing) => MAG.share * (e.interval || 1) * Math.max(0, missing);
// A target a headshot counts on: a soldier on the ground.
export const headable = (t) => !!t && t.kind === "unit" && !t.mechanical && !t.flying && !t.boss;
export const headBonus = (e) => (e.weapon === "sniper" ? HEAD.sniper : HEAD.bonus);

// Metres from (x, z) to the nearest cover piece's footprint (Infinity with none).
export function coverDistance(pieces, x, z) {
  let best = Infinity;
  for (const p of pieces || []) {
    const K = COVER_KINDS[p[0]];
    if (!K) continue;
    const c = Math.cos(p[3]), s = Math.sin(p[3]), ox = x - p[1], oz = z - p[2];
    const u = Math.abs(ox * c + oz * s) - K.L, v = Math.abs(-ox * s + oz * c) - K.W;
    const d = Math.hypot(Math.max(0, u), Math.max(0, v));
    if (d < best) best = d;
  }
  return best;
}
// The spread after `real` seconds of moving (or standing).
export const nextSpread = (spread, moving, real) => Math.max(0, Math.min(1, (spread || 0) + (moving ? SPREAD.rise : -SPREAD.fall) * real));
