// Mission openings (AAA round 3, R3-G): one shared, parameterised fly-in as a campaign mission begins.
// The camera starts on the mission's own landmark (the bridge, the plateau, the enemy camp, the enemy
// road or the objective), drifts there while the title reads, then glides home to where the match
// really starts. It is 4 to 6 seconds long, skippable at once, and the match clock waits meanwhile
// (app/scenes.js plays it on the "scene" screen). View only: nothing here reaches the simulation.
//
// The table is keyed by mission id, like the title cards (never a field on the mission: serialize()
// writes the whole mission into the save and its checksum). A row:
//   at       a region name of the mission or a literal { x, z } (Frontier Defence missions have no regions)
//   offset   optional [x, z] metres from that place, to frame a wide landmark from one side
//   frames   what the start shows: "bridge", "plateau", "camp", "road" (the enemy's way in) or "objective"
//   zoom     the start zoom as a multiple of the view's default zoom (wider than 1 shows more ground)
//   drift    metres the camera slides along x and z while it holds on the landmark
//   seconds  the whole opening, 4 to 6
// A mission missing here (new content) gets no opening, only its title card.

export const OPENING_SECONDS = { min: 4, max: 6 };
// The share of the opening spent holding on the landmark (the title reads there); the rest is the glide home.
export const OPENING_HOLD = 0.34;
export const OPENING_FRAMES = ["bridge", "plateau", "camp", "road", "objective"];

export const OPENINGS = {
  "m01-first-light": { at: "oldRelay", frames: "objective", zoom: 1.45, drift: [-5, 3], seconds: 4.6 },
  "m02-first-contact": { at: "bridgehead", frames: "bridge", zoom: 1.3, drift: [6, 0], seconds: 4.6 },
  "m02b-hold-the-river": { at: { x: 22, z: -18 }, frames: "bridge", zoom: 1.15, drift: [-8, 0], seconds: 4.8 },
  // Map variety: over the east water of Mirror Lake, drifting west across the island toward the camp's ford.
  "m02c-mirror-lake": { at: "island", offset: [22, -4], frames: "plateau", zoom: 1.5, drift: [-6, 6], seconds: 5 },
  "m03-the-ashen-line": { at: "vanguardYard", frames: "camp", zoom: 1.25, drift: [4, 4], seconds: 5 },
  // W9 side missions (src/story/side-missions.js): each opens on its own objective or the enemy's way in.
  "m03b-loose-crystal": { at: "wreckWest", frames: "objective", zoom: 1.4, drift: [4, 4], seconds: 4.8 },
  "m04-three-way-dunes": { at: "oasisCentre", frames: "objective", zoom: 1.7, drift: [-4, -4], seconds: 4.8 },
  // Map variety: over Hale's outpost beyond the canyon's north mouth, drifting toward the road down to the squad.
  "m04b-canyon-run": { at: "outpost", offset: [-6, 4], frames: "camp", zoom: 1.4, drift: [-6, 4], seconds: 5 },
  "m05-the-verdant-pact": { at: "bridgeNorth", frames: "bridge", zoom: 1.3, drift: [0, 6], seconds: 5 },
  "m06-copper-harvest": { at: "seam", frames: "objective", zoom: 1.4, drift: [5, -3], seconds: 4.8 },
  "m06b-wings-over-copper": { at: "yard", frames: "camp", zoom: 1.4, drift: [-6, 2], seconds: 4.8 },
  // Campaign C6: over the player's hill on Highridge, drifting down its ramp toward the camp.
  "m06c-gun-hill": { at: "hill", offset: [-4, -8], frames: "plateau", zoom: 1.5, drift: [-5, 5], seconds: 4.8 },
  "m06d-hawk-wing": { at: "mooringWest", frames: "objective", zoom: 1.4, drift: [-4, 6], seconds: 4.8 },
  "m07-copper-siege": { at: "eastRoad", frames: "road", zoom: 1.35, drift: [-3, -6], seconds: 5 },
  "m07b-hold-the-valley": { at: { x: -25.6, z: -38.3 }, frames: "road", zoom: 1.1, drift: [6, 5], seconds: 4.8 },
  // The void beyond the vault's corner shows the night sky and its moon (R3-D seam).
  "m08-the-quiet-vault": { at: "vaultGate", frames: "objective", zoom: 1.6, drift: [-4, -4], seconds: 5.4 },
  "m08b-the-long-night": { at: "relayWest", offset: [0, -8], frames: "objective", zoom: 1.5, drift: [6, 0], seconds: 5 },
  "m09-a-debt-in-the-dunes": { at: "solCamp", frames: "camp", zoom: 1.4, drift: [-6, -2], seconds: 4.8 },
  "m09b-the-water-road": { at: "midPost", frames: "road", zoom: 1.4, drift: [-6, 2], seconds: 4.8 },
  "m10-obsidian-storm": { at: "crown", offset: [10, -8], frames: "plateau", zoom: 1.6, drift: [3, 5], seconds: 5.2 },
  // Campaign C6: high over the crown hill of Gun Hills and its three Warden towers.
  "m10b-crown-hill": { at: "crown", offset: [14, 6], frames: "plateau", zoom: 1.5, drift: [-5, 5], seconds: 5 },
  // Map variety: Twin Rivers since 2026-11, high over the west ford of the south river, drifting across it.
  "m11-cut-the-draw": { at: "bridge", offset: [2, -8], frames: "bridge", zoom: 1.4, drift: [0, -6], seconds: 4.8 },
  "m11c-hold-the-keystone-roads": { at: { x: 4, z: -44 }, frames: "road", zoom: 1.2, drift: [0, 8], seconds: 5 },
  // R3-H: high over the ford's north-west bank, where the Sovereign crosses (clear of m01/m04/m11 starts), drifting toward the player's line and its two forward towers.
  "m11d-the-sovereign-walks": { at: "ford", offset: [-7, -6], frames: "road", zoom: 1.5, drift: [-5, 3], seconds: 5 },
  "m12-frontiers-end": { at: "keystone", offset: [10, -10], frames: "objective", zoom: 1.6, drift: [4, -3], seconds: 5.6 },
};

// The landmark of a mission's opening as { x, z }, or null without a row or a resolvable place.
export function openingStart(def) {
  const row = OPENINGS[def?.id];
  if (!row) return null;
  const p = typeof row.at === "string" ? def.regions?.[row.at] : row.at;
  const [ox, oz] = row.offset || [0, 0];
  return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x + ox, z: p.z + oz } : null;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (k) => k * k * (3 - 2 * k);
// The opening of `def` that ends on `home` ({ x, z, zoom }): { id, frames, seconds, from, to, drift }, or null.
// `baseZoom` is the view's default zoom; the start zoom stays inside the view's 22 to `maxZoom` range.
export function openingPlan(def, home, { baseZoom = 38, maxZoom = 88 } = {}) {
  const row = OPENINGS[def?.id], start = openingStart(def);
  if (!row || !start || !home) return null;
  const seconds = clamp(row.seconds ?? 5, OPENING_SECONDS.min, OPENING_SECONDS.max);
  const zoom = clamp(baseZoom * (row.zoom ?? 1.4), 22, Math.max(maxZoom, home.zoom ?? 0));
  return { id: def.id, frames: row.frames, seconds, from: { x: start.x, z: start.z, zoom }, to: { x: home.x, z: home.z, zoom: home.zoom ?? baseZoom }, drift: row.drift || [0, 0] };
}

// The skirmish camera starts just beyond the base and returns to the captured home pose.
export function baseOpening(home, quick = false) {
  return { id: quick ? "quick" : "skirmish", frames: "camp", seconds: 3.4,
    from: { x: home.x * 0.88, z: home.z * 0.88, zoom: home.zoom * 1.12 },
    to: { ...home }, drift: [0, 0] };
}

// The camera at `t` seconds into `plan`: a slow drift on the landmark (zooming in a little), then the glide home.
export function openingPose(plan, t) {
  const hold = plan.seconds * OPENING_HOLD, [dx, dz] = plan.drift;
  if (t <= hold) {
    const k = clamp(t / hold, 0, 1);
    return { x: plan.from.x + dx * k, z: plan.from.z + dz * k, zoom: plan.from.zoom * (1 - 0.06 * k) };
  }
  const k = smooth(clamp((t - hold) / (plan.seconds - hold), 0, 1));
  const x0 = plan.from.x + dx, z0 = plan.from.z + dz, zoom0 = plan.from.zoom * 0.94;
  return { x: x0 + (plan.to.x - x0) * k, z: z0 + (plan.to.z - z0) * k, zoom: zoom0 + (plan.to.zoom - zoom0) * k };
}
