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
export const LOOKS = {
  // The owner's night bar: a very dark blue sky, black-blue water, cool moonlight, brighter glows.
  night: {
    sky: "#030818", fog: "#02061a", ambient: "#4560b4", bounce: "#0b1226", sun: "#9db8ff",
    ambientI: 0.62, sunI: 0.42, exposure: 1.1, water: "#223b78", waterGlow: 0.5, glow: 1.9,
  },
  // Dark, heavy cloud, a grey-green gloom, and lightning on a schedule.
  storm: {
    sky: "#0d1620", fog: "#0a121b", ambient: "#8196b0", bounce: "#242a31", sun: "#b9c6dc",
    ambientI: 0.82, sunI: 0.5, exposure: 1.0, water: "#40647a", waterGlow: 0.7, glow: 1.35,
    flash: { period: 11, first: 3, spread: 5 },
  },
  // A long red-gold evening for new content.
  dusk: {
    sky: "#3a1c30", fog: "#2a1630", ambient: "#c79aa8", bounce: "#6a3a30", sun: "#ffb070",
    ambientI: 0.9, sunI: 0.95, exposure: 1.02, water: "#c08a90", waterGlow: 1, glow: 1.2,
  },
};

// id -> a look name, or { look, from, fade }: from sim.time seconds, blended in over `fade` seconds.
export const MISSION_LOOKS = {
  "m08-the-quiet-vault": "night", // "Ashen Frontier, night 38"
  "cv1-night-count": "night", // the Night Count Chronicle
  "m10-obsidian-storm": "storm",
  "m06-copper-harvest": { look: "storm", from: 960, fade: 20 }, // the last four minutes (16:00)
};

const own = (table, id) => Object.hasOwn(table, id);

// The look a match plays under, or null: { name, k }. k is 0 to 1 (a late look fades in).
export function missionLook(sim) {
  const id = sim?.missionDef?.id;
  let name = null, from = 0, fade = 0;
  const entry = id !== undefined && own(MISSION_LOOKS, id) ? MISSION_LOOKS[id] : null;
  if (entry) {
    if (typeof entry === "string") name = entry;
    else ({ look: name, from = 0, fade = 0 } = entry);
  } else name = sim?.missionDef?.look ?? sim?.rules?.look ?? null;
  if (!name || !own(LOOKS, name)) return null;
  const k = fade > 0 ? Math.max(0, Math.min(1, (sim.time - from) / fade)) : sim.time >= from ? 1 : 0;
  return { name, k };
}

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
