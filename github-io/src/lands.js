// W9 new lands (roadmap 2026-11-25): Snow, Volcano and the Isles. A land is a look (palette and light in
// visual-style.json, dressing in scatter.js, life in ambient-life.js, music in audio-logic.js, sky in map-edge.js)
// plus a ground rule (`biome`, src/terrain.js ground()) and the view switches below. Its Skirmish map has the land's
// id (maps.json); any other map (a campaign map, a Defence level) is drawn on the land by naming it as its `look`
// and its `biome` (docs/WORLD.md "Lands"). The rules are the old ones: a frozen lake's ice roads are lake fords
// (slow), lava is water (impassable, crossed by bridges), the isles are lakes linked by fords and plank bridges.
// View only: nothing here reaches the simulation.
import { lookOf } from "./visual-style.js";

//   biome     the ground rule a map on this land uses (terrain.js ground())
//   weather   a mote kind drawn as land weather around the camera (ambient-life.js): falling snow, ash and embers
//   lava      the water is lava: it glows (environment-view.js), has no foam or riffle, no reeds, fish or lilies
//   ice       the lake's open water is dark and cold and its fords are pale ice roads
//   reeds     reeds ring the water (environment-view.js); bushes: the Blender shrubs on grass
//   paint     the ground detail painted in the ground texture (ground-paint.js): "snow" drifts, "embers" cracks
export const LANDS = {
  snowfield: { biome: "snow", weather: "snow", ice: true, reeds: false, bushes: false, paint: "snow" },
  volcano: { biome: "volcanic", weather: "ashfall", lava: true, reeds: false, bushes: false, paint: "embers" },
  archipelago: { biome: "isles", weather: null, reeds: true, bushes: true, paint: null },
};
export const LAND_IDS = Object.keys(LANDS);

// The land a terrain is drawn on (its look's), or null for the older lands.
export const landOf = (terrain) => {
  const id = terrain && lookOf(terrain.id);
  return id && Object.hasOwn(LANDS, id) ? LANDS[id] : null;
};
