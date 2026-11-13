// The campaign map (0.19a): the frontier drawn as three act bands climbing north to the Keystone,
// one relay node per mission. Positions are percent of the map board (x across, y down); the
// path runs east through Act 1, back west through Act 2 and east again to the Keystone.
// Since 0.19b the nodes are laid out from the mission list itself (mapLayout), so a mission
// inserted into an act (Hold the River, Hold the Valley, later Wings over Copper) finds its place.
import { MISSIONS } from "./missions.js";

const round1 = (v) => Math.round(v * 10) / 10;
// Each act's missions spread evenly across its band (12% to 86%), zigzagging a little up and down.
export function mapLayout(missions) {
  const out = {};
  for (const act of [1, 2, 3]) {
    const list = missions.filter((m) => m.act === act), band = ACT_BANDS[act], n = list.length;
    // Clear of the act title at the band's top edge.
    const mid = (band.top + band.bottom) / 2 + 3;
    list.forEach((m, i) => {
      const k = n === 1 ? 0.5 : i / (n - 1), east = act !== 2;
      out[m.id] = { x: round1(12 + (east ? k : 1 - k) * 74), y: round1(mid + (i % 2 ? 4 : -4)) };
    });
  }
  return out;
}
// Ground colours per map id (maps.json), from the region's look.
export const LANDS = {
  riverlands: "#2f8f9a",
  classic: "#6f6a64",
  dunes: "#c79a4c",
  woodlands: "#4f8c4c",
  basin: "#b26a3c",
  highlands: "#54477a",
  expanse: "#8aa59c",
};
// Bands, top to bottom: act 3, act 2, act 1 (percent of the board height).
export const ACT_BANDS = { 3: { top: 0, bottom: 34 }, 2: { top: 34, bottom: 67 }, 1: { top: 67, bottom: 100 } };
// One node per mission, in campaign order.
export const MAP_NODES = mapLayout(MISSIONS);
// The map's own words (story catalogue: tools/story-strings.mjs).
export const MAP_TEXT = {
  heading: "The frontier",
  endings: "Endings",
  unseen: "Not reached yet",
  chronicles: "Faction Chronicles",
  chroniclesNote: "Coming soon: the same war, told by each faction.",
  decisions: "Decisions",
};
