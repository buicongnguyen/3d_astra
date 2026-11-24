// Mission looks (AAA round 2, W2-C, idea C3): the time of day and weather of one mission, Chronicle or
// Frontier Defence level. View only: nothing here reaches the simulation.
//
// An existing mission, Chronicle or level gets its look from the table below, keyed by its id. It never
// gets a `look` field of its own: serialize() writes the whole missionDef into every save and hash, so a new
// field would move that content's checksum (plan section 2.5). New content (the Heroic variants, m11c) may
// carry `look: "night" | "storm" | "dusk"` on its definition; the table wins for an existing id.
// A skirmish rule `look` ({ rules: { look: "night" } }) is a test and screenshot hook: the render budget and
// the night suite use it to see a look on a map without a mission.

// How a look changes the map's own daylight (view.js applyTheme keeps that as `baseLight`):
//   sky, fog, ambient, bounce, sun   target colours (blended in by the look's strength k, 0 to 1)
//   ambientI, sunI, exposure         multipliers of the map's own light strengths
//   water                            a tint that multiplies the water colour ("#ffffff" = unchanged)
//   waterGlow                        multiplier of the water's own glow
//   glow                             multiplier of team glows, crystals and lamps
//   flash                            lightning: { period, first, spread } in seconds of sim.time (storm only)
// AAA round 3 (R3-D), all view only (src/night-sky.js draws them, one draw each):
//   moon, stars                      a moon disc over the void and stars on it (night)
//   rain, clouds                     rain streaks and a drifting cloud shade (High only), scaled by k (storm)
//   fogNear, fogFar                  multipliers of the distance fog's near and far planes at k = 1
//   edge                             the map edge and void (map-edge.js) recoloured { low, high } by brightness
//   rim                              the warm rim light's colour at k = 1 (team rims keep the team's colour)
//   skyGather                        optional exponent (< 1): sky and fog colour follow k ** skyGather (storm)
// The grade (shadow tint, saturation) of a look sits in look-grade.json under `looks`.
export const LOOKS = {
  // The owner's night bar: a very dark blue sky, black-blue water, cool moonlight, brighter glows.
  night: {
    sky: "#030818", fog: "#02061a", ambient: "#3a66c0", bounce: "#0a1428", sun: "#8fb4ff",
    // ambientI 0.85 (was 0.7, R3-D): owner note at the Wave 1 merge, the night ground read too dark.
    ambientI: 0.85, sunI: 0.42, exposure: 1.1, water: "#223b78", waterGlow: 0.5, glow: 1.9,
    // AAA round 3 (R3-D): the moon and stars over the void, the map edge and void in black-blue, a cool
    // moonlit rim, and the night grade (look-grade.json `looks.night`).
    moon: true, stars: true, edge: { low: "#01030b", high: "#1c2f62" }, rim: "#8fb0ff",
  },
  // Dark, heavy cloud, a grey-green gloom, and lightning on a schedule.
  storm: {
    sky: "#0d1620", fog: "#0a121b", ambient: "#8196b0", bounce: "#242a31", sun: "#b9c6dc",
    ambientI: 0.82, sunI: 0.5, exposure: 1.0, water: "#40647a", waterGlow: 0.7, glow: 1.35,
    flash: { period: 11, first: 3, spread: 5 },
    // R3-D: slanting rain, drifting cloud shade (High only), distance fog closing in, a blue-grey map edge.
    rain: 1, clouds: 1, fogNear: 0.5, fogFar: 0.72, edge: { low: "#05090e", high: "#4d5d6c" }, rim: "#b9c8e0",
    // Wave 1 merge: the sky and fog colour turn faster than the light (k ** 0.25), so a gathering storm over a
    // dusk map (m06 at k 0.48) reads blue-grey, not the map's purple. k = 1 (m10) is unchanged.
    skyGather: 0.25,
  },
  // A long red-gold evening for new content.
  dusk: {
    sky: "#3a1c30", fog: "#2a1630", ambient: "#c79aa8", bounce: "#6a3a30", sun: "#ffb070",
    ambientI: 0.9, sunI: 0.95, exposure: 1.02, water: "#c08a90", waterGlow: 1, glow: 1.2,
  },
};

// id -> a look name, { look, from, fade } (from sim.time seconds, blended in over `fade` seconds) or
// { look, ramp: [[seconds, k], ...] } (k follows the points, held flat before the first and after the last).
export const MISSION_LOOKS = {
  "m08-the-quiet-vault": "night", // "Ashen Frontier, night 38"
  "cv1-night-count": "night", // the Night Count Chronicle
  "m10-obsidian-storm": "storm",
  // Map variety (2026-11-24): Gun Hill is fought at night (the basin run m06/m06b/m07 is all daylight), and
  // the Canyon Run drives through Amber Canyon in a long red-gold evening.
  "m06c-gun-hill": "night",
  "m04b-canyon-run": "dusk",
  // R3-D: the storm gathers from the first second (cloud, fog and rain thicken over 90 s), then the surge
  // storm Vale warns of breaks in full at 16:00 (it was all-or-nothing at 16:00 before).
  "m06-copper-harvest": { look: "storm", ramp: [[0, 0.35], [90, 0.75], [960, 0.75], [980, 1]] },
};

const own = (table, id) => Object.hasOwn(table, id);

// The look a match plays under, or null: { name, k }. k is 0 to 1 (a late look fades in).
export function missionLook(sim) {
  const id = sim?.missionDef?.id;
  let name = null, from = 0, fade = 0, ramp = null;
  const entry = id !== undefined && own(MISSION_LOOKS, id) ? MISSION_LOOKS[id] : null;
  if (entry) {
    if (typeof entry === "string") name = entry;
    else ({ look: name, from = 0, fade = 0, ramp = null } = entry);
  } else name = sim?.missionDef?.look ?? sim?.rules?.look ?? null;
  if (!name || !own(LOOKS, name)) return null;
  const k = ramp ? rampAt(ramp, sim.time) : fade > 0 ? Math.max(0, Math.min(1, (sim.time - from) / fade)) : sim.time >= from ? 1 : 0;
  return { name, k };
}

// Settings > Display > Weather (2026-11-25): the looks that are weather rather than a time of day. With the
// setting Off the view drops them (rain, cloud shade, storm gloom and close fog, lightning, the rain bed and
// thunder) and shows the map's own sky; night and dusk stay. View only like the looks themselves: no mission
// storm reaches the sim, so outcomes and golden pins do not move. (The Wild frontier Sandstorm is a sim power,
// drawn by wild-view.js as a marked zone, and stays on screen: it is gameplay, not weather dressing.)
export const WEATHER_LOOKS = new Set(["storm"]);
export function viewLook(sim, settings) {
  const look = missionLook(sim);
  return look && settings?.weather === false && WEATHER_LOOKS.has(look.name) ? null : look;
}

// A piecewise-linear strength: [[seconds, k], ...] in time order.
export function rampAt(points, t) {
  if (!(t > points[0][0])) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, k1] = points[i];
    if (t <= t1) { const [t0, k0] = points[i - 1]; return t1 > t0 ? k0 + ((k1 - k0) * (t - t0)) / (t1 - t0) : k1; }
  }
  return points[points.length - 1][1];
}

// The weather the view last drew, for the ambience (src/ambience.js): view state only, never the sim's.
// storm: 0 to 1 (rain bed level), flash: the lightning now (0 when motion is off), name: the look or null.
export const WEATHER = { name: null, storm: 0, flash: 0 };

// Lightning strength (0 to 1) at sim time t for a look with a `flash` schedule: one strike every `period`
// seconds, at a place in the period that is fixed by the strike's number (no random numbers), a bright flash
// then a weaker second one 0.22 s later. One strike per period, so it is safe to watch.
export function flashAt(t, schedule) {
  if (!schedule || !(t >= 0)) return 0;
  const n = Math.floor(t / schedule.period), hash = (((Math.imul(n + 1, 2654435761) >>> 8) % 1000) / 1000);
  const at = n * schedule.period + schedule.first + hash * schedule.spread, d = t - at;
  if (d < 0 || d > 0.8) return 0;
  return Math.max(Math.exp(-d * 8), d > 0.22 ? 0.65 * Math.exp(-(d - 0.22) * 11) : 0);
}
