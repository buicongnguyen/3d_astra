import { DEFINITIONS } from "../data.js";
// Weapon effect classes (AAA round 3, R3-X "slow and beautiful, but cheap"). Every shot event maps to ONE
// class, and the class decides how heavy and how slow its drawing is: the heavier the weapon, the slower and
// showier the round. Pure data (no three.js): the effects (src/fx.js, this folder) and the audio (R3-U) can
// both key on it.
//
//   tracer     rifles, machine guns, bursts, pellets, hoses, the Drone's pulses: thin bright tracers, a small flash, a dust puff
//   shell      tank-class cannons (Tank, Tower, Walker, Rampart): a glowing shell on a slight arc, a short smoke trail
//   lob        the Breaker's lob (and the Barrage ability): a high arc, a red warning ring where it will land
//   flak       a ground cannon firing at a flyer: black and orange bursts around the target
//   beam       beams and rails: a charge glow, then a bright line fading from the muzzle forward
//   flamer     flamers: a flame cone and embers
//   heal       medics, engineers and repair: a soft beam and rising sparkles
//   missile    the Hawk's missiles at a flyer (a small glowing missile on a curling smoke ribbon, a sharp burst),
//              and the Anti-tank rocket (R3-W's finned body; an air burst when it meets a flyer)
//   strafe     the Hawk's guns at the ground: a walking burst of tracers with dust spurts
//   bomb       Glider and Balloon drops: the bomb falls and grows over its shadow dot, then a blast
//
// View only: nothing here reads or writes the simulation's state; the class is a function of the shot event
// (`type`, `weapon`, `unit`, `sAir`, `tAir`) and its visual style (src/visual-style.js weaponStyle).
import { weaponStyle } from "../visual-style.js";

// The ids are R3-U's (src/audio-logic.js WEAPON_CLASSES), so a sound and a look always name the same class.
export const WEAPON_CLASSES = Object.freeze(["tracer", "shell", "lob", "flak", "beam", "flamer", "heal", "missile", "bomb", "strafe"]);

// Defence crew upgrades can change splash on the live shooter. The unit id
// distinguishes flyers and faction vehicles which reuse another unit's weapon key.
export function groundSplashRadius(event, sim) {
  if (event.tAir || event.type === "support") return 0;
  const source = sim?.get?.(event.source) || DEFINITIONS[event.unit] || DEFINITIONS[event.weapon];
  return source?.splash_radius > 0 && source.splash_damage > 0 ? source.splash_radius : 0;
}

// The weapon keys (visual-style.json `weapons`) drawn as an artillery lob rather than a direct shell.
const ARTILLERY = new Set(["breaker"]);
const BEAMS = new Set(["beam", "rail"]);

export function weaponClass(ev, style = weaponStyle(ev)) {
  if (ev.type === "support" || style.kind === "support") return "heal";
  const look = style.look;
  if (look === "bomb" || look === "firebomb") return "bomb";
  if (look === "flame") return "flamer";
  if (BEAMS.has(look)) return "beam";
  if (look === "rocket") return "missile"; // the Anti-tank rocket (R3-W look) sounds and lands as a missile
  if (look === "pods") return ev.tAir ? "missile" : "strafe";
  if (style.kind === "cannon") {
    if (ARTILLERY.has(ev.weapon)) return "lob";
    return ev.tAir && !ev.sAir ? "flak" : "shell";
  }
  return "tracer";
}

// Timings and sizes of the classes (seconds and metres). Eco quality keeps the shapes but shortens the trails
// (`ecoTrail`) and the pools' `count()` halves every burst.
export const CLASS_LOOK = Object.freeze({
  shell: { arc: 0.065, arcMax: 1, body: 1.55, trailGap: 0.022, trailLife: 0.8, halo: 1.7 },
  lob: { arc: 0.22, arcMax: 3.2, body: 1.35, trailGap: 0.03, trailLife: 0.7, halo: 0.9 },
  flak: { arc: 0, arcMax: 0, body: 0.6, trailGap: 0, trailLife: 0, halo: 0.6, bursts: 3, spread: 1.4 },
  missile: { body: 0.55, weave: 0.55, trailGap: 0.022, trailLife: 0.55 },
  bomb: { body: 1.15, grow: 0.55 },
  strafe: { rounds: 4, walk: 3.2, gap: 0.05 },
  barrage: { fall: 0.85, height: 17, body: 1.6, rings: 3 },
  ecoTrail: 0.6,     // Eco: trail puffs live 60% as long and come 1.6x further apart
  quick: 0.24,       // a round that killed its target lands this soon at most (the wreck is already falling)
});
