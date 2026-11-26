// Signature shots (V4, 2026-11-26, owner: "some weapon maybe have circle bullet blue glowing or electric shock ball bullet? or
// something fancy one?"): every unit fires a shot in its faction's style, after the painted story portraits.
//   Meridian  clean cyan "photon" energy: plasma darts, photon bolts, plasma orbs with a comet tail, a ring-exhaust rocket
//   Ashfall   fire and molten scrap: hot orange tracers, shotgun sprays of molten slugs, slugs trailing black smoke
//   Sunward   sunlight: amber bolts that shimmer, twin sun-darts, spinning golden sun-discs that land in a starburst
//   Wardens   electricity: zig-zag bolts, a crackling electric shock ball with chain arcs, a tower's jagged arc, ring hoops
//   Veil      crystal and void: spinning violet crescent blades, a crystal rail, void orbs that implode, homing wisps
// The look follows the shooter's FACTION (a story mission's side, else the simulation's faction of the shooter's team, shared units
// too), with the faction's colours, never the team paint: a player in mint still fires their faction's colours. View only: flight
// times are the weapon's visual-style `life` as before, nothing here reads anything the simulation would not show and nothing
// writes to it (the chain arcs pick visible units to draw to, and are only drawn). Creatures, bosses, the Ember Drake, the Iron
// units, the bombers, the flamers, the medics and every ability keep their own looks: they have no entry in signature-shots.json.
import { CELL, STRETCH } from "./cells.js";
import { DATA, PALETTES, size, quad, shape, later } from "./signature-common.js";
import { KINDS, stepSignatures, clearSignatures, liveSignatures, muzzle, landing } from "./signature-kinds.js";
import { IMPACTS } from "./signature-impacts.js";

export { stepSignatures, clearSignatures, liveSignatures, DATA as SIGNATURE };
const FACTIONS = new Set(Object.keys(DATA.factions));

// The faction whose look a team's shots take: a story mission names each side's faction (its paint and emblems) even when the
// side fields the shared roster; a skirmish, a Chronicle or a Defence level uses the simulation's faction of the team.
export function shotFaction(fx, sim, team) {
  if (!(team >= 0)) return null; // creatures (the wild team) have no faction
  const story = fx.view?.mission?.factions?.[team];
  if (FACTIONS.has(story)) return story;
  const id = typeof sim?.factionId === "function" ? sim.factionId(team) : sim?.factions?.[team];
  return FACTIONS.has(id) ? id : null;
}

// The unit a shot speaks for: its own type, or for a crewed Defence tower the crew's weapon (the event's `weapon`).
const unitOf = (ev) => (ev.unit === "tower" && ev.weapon && ev.weapon !== "tower" ? ev.weapon : ev.unit || ev.weapon);
const RESOLVED = new Map();
// The look of a shot: { id, look, pal } or null (no faction, or a unit that keeps its own look: creatures, bosses, Iron units...).
export function signatureOf(faction, unit, air = false) {
  if (!faction || !unit) return null;
  const key = `${faction}:${unit}:${air ? 1 : 0}`;
  let hit = RESOLVED.get(key);
  if (hit === undefined) {
    const table = DATA.factions[faction], id = table ? table[unit] ?? table[DATA.families[unit]] : null, look = id ? DATA.looks[id] : null;
    hit = look && !(air && look.air === false) ? Object.freeze({ id, look, pal: PALETTES[faction] }) : null;
    RESOLVED.set(key, hit);
  }
  return hit;
}
export function signatureLook(fx, ev, sim) {
  if (!ev || ev.boss != null || ev.type === "support") return null;
  return signatureOf(shotFaction(fx, sim, ev.team), unitOf(ev), !!ev.tAir);
}

// The impact a look lands with (no flight: the fog partial and the calm path), now or `delay` s from now.
function landNow(fx, sig, ev, at, a, calm, delay) {
  const o = landing(a, sig.look, sig.pal, ev, calm), impact = IMPACTS[sig.look.impact] || IMPACTS.pop;
  if (delay > 0) later(fx, delay, () => impact(fx, at, o)); else impact(fx, at, o);
}
const HEAVY = new Set(["orb", "rocket", "arc"]);

// Draws one shot in its faction's look. `a` is the aim of src/fx.js shot (from, to, land, ux, uy, uz, len, sx, sz, nx, nz, travel,
// anchor, power, style). Combat motion off or reduced motion: a brief still line in the faction's colour along the whole path and
// a calm landing at once (no flight, no flash), as src/fx.js draws every other weapon then.
export function signatureShot(fx, ev, sig, a) {
  if (fx.motion) { KINDS[sig.look.kind]?.(fx, ev, a, sig.look, sig.pal); return; }
  const { from, to, ux, uy, uz, len, anchor } = a, P = sig.pal, w = size(fx, [0.1, 3]);
  for (const layer of [fx.smoke, fx.glow]) {
    const p = fx.emit(layer, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, anchor, true);
    p.mode = STRETCH; p.ax = ux; p.ay = uy; p.az = uz; p.length = len; p.cell = CELL.streak; p.s0 = p.s1 = quad("streak", w); p.life = 0.1;
    p.c0 = layer === fx.smoke ? P.mainSolid : P.mainSoft; p.c1 = P.main0;
  }
  landNow(fx, sig, ev, ev.tAir || a.anchor?.direct ? to : { x: a.land.x, y: a.land.y + fx.ground(a.land.x, a.land.z), z: a.land.z }, a, true, 0);
}

// The shooter or the target is in fog (src/fx.js shotPartial): only the end the player can see, never the path, so fog still
// hides positions. A seen muzzle flashes in the faction's colour; a seen target takes the faction's landing on time.
export function signaturePartial(fx, ev, sim, sig, a, shooterSeen, targetSeen) {
  if (shooterSeen) {
    const anchor = { x: ev.x, z: ev.z };
    if (fx.motion) muzzle(fx, ev, { ...a, anchor }, sig.look, sig.pal, HEAVY.has(sig.look.kind));
    else shape(fx, fx.glow, a.from, CELL.glow, 0.3, 0.4, 0.08, sig.pal.mainSoft, sig.pal.main0, anchor);
  }
  if (targetSeen) {
    // The landing's own anchor is the target's ground point: the path stays hidden.
    const anchor = { x: ev.tx, z: ev.tz, target: ev.target, targetWidth: a.anchor?.targetWidth, direct: a.anchor?.direct };
    const at = ev.tAir || anchor.direct ? a.to : { x: a.land.x, y: a.land.y + fx.ground(a.land.x, a.land.z), z: a.land.z };
    landNow(fx, sig, ev, at, { ...a, anchor }, !fx.motion, fx.motion ? a.travel : 0);
  }
}

// Support beams in a faction's look (the Sunward Wagon's golden motes); false leaves the shot to src/fx.js.
export function signatureSupport(fx, ev, sim, a) {
  const faction = shotFaction(fx, sim, ev.team), table = faction ? DATA.factions[faction] : null, id = table?.[ev.weapon];
  const look = id ? DATA.looks[id] : null;
  if (!look || look.kind !== "motes") return false;
  KINDS.motes(fx, ev, a, look, PALETTES[faction]);
  return true;
}
