// The campaign map (0.19a): the frontier drawn as three act bands climbing north to the Keystone,
// one relay node per mission. Positions are percent of the map board (x across, y down); the
// path runs east through Act 1, back west through Act 2 and east again to the Keystone.
// `land` paints the ground under a node: the region of the mission's map (docs/WORLD.md).
export const MAP_NODES = {
  "m01-first-light": { x: 12, y: 85 },
  "m02-first-contact": { x: 36, y: 90 },
  "m03-the-ashen-line": { x: 61, y: 82 },
  "m04-three-way-dunes": { x: 86, y: 89 },
  "m05-the-verdant-pact": { x: 86, y: 53 },
  "m06-copper-harvest": { x: 61, y: 59 },
  "m07-copper-siege": { x: 36, y: 51 },
  "m08-the-quiet-vault": { x: 12, y: 58 },
  "m09-a-debt-in-the-dunes": { x: 12, y: 24 },
  "m10-obsidian-storm": { x: 36, y: 16 },
  "m11-cut-the-draw": { x: 61, y: 25 },
  "m12-frontiers-end": { x: 86, y: 15 },
};
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
// The map's own words (story catalogue: tools/story-strings.mjs).
export const MAP_TEXT = {
  heading: "The frontier",
  endings: "Endings",
  unseen: "Not reached yet",
  chronicles: "Faction Chronicles",
  chroniclesNote: "The same war, told by each faction. They open after Act 1.",
  decisions: "Decisions",
};
