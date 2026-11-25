// The campaign map (0.19a): the frontier drawn as three act bands climbing north to the Keystone,
// one relay node per mission. Positions are percent of the map board (x across, y down); the
// path runs east through Act 1, back west through Act 2 and east again to the Keystone.
// Since 0.19b the nodes are laid out from the mission list itself (mapLayout), so a mission
// inserted into an act (Hold the River, Hold the Valley, later Wings over Copper) finds its place.
import { MISSIONS } from "./missions.js";

const round1 = (v) => Math.round(v * 10) / 10;
// Each act's missions spread evenly across its band (12% to 86%), zigzagging a little up and down.
// An act of six (Act 2 since Wings over Copper) widens to 11% to 89% so neighbours stay 15% apart.
export function mapLayout(missions) {
  const out = {};
  for (const act of [1, 2, 3]) {
    const list = missions.filter((m) => m.act === act), band = ACT_BANDS[act], n = list.length;
    // Clear of the act title at the band's top edge.
    const mid = (band.top + band.bottom) / 2 + 3;
    const span = Math.min(78, Math.max(74, (n - 1) * 15.6)), left = span > 74 ? 50 - span / 2 : 12;
    list.forEach((m, i) => {
      const k = n === 1 ? 0.5 : i / (n - 1), east = act !== 2;
      // At most 84% down: a 44 px node stays inside the shortest phone board (150 px).
      out[m.id] = { x: round1(left + (east ? k : 1 - k) * span), y: round1(Math.min(84, mid + (i % 2 ? 4 : -4))) };
    });
  }
  return out;
}
// The painted campaign map (R3 map pass, Codex/OpenAI ImageGen art in src/art/campaign/): the relay of each
// mission sits on its landmark. Anchors are percent of the artwork (x across, y down), copied from the art's
// README (3d_astra/codex-campaign-map/README.md): `wide` for the 2560×1440 painting (desktop, tablets and
// phones in portrait), `strip` for the 2560×900 panorama (landscape phones). `label` is the side the name
// plate takes ("a" above, "b" below, "r" right: the top-left corner keeps the act title), chosen to keep the plate off the route and off the landmark.
export const MAP_ART = { wide: { w: 2560, h: 1440 }, strip: { w: 2560, h: 900 } };
export const MAP_ANCHORS = {
  // W9 (2026-11-26): 25 relays since the four side missions of campaign C6 (src/story/side-missions.js). Three act bands
  // of two rows each cannot keep 25 relays 44 px apart on the 318 px phone board (at most about 23 fit), so the route
  // snakes over four rows of seven, 13.9% and 24.7% apart (44 px on that board): Act 1 runs east along the bottom
  // row and turns up, Act 2 runs back west and turns up again, Act 3 runs east and finishes west at the Keystone on
  // the top row's middle five (the corners stay free for the act plate and the relay count). Name plates alternate by
  // column on the two middle rows (above on even columns, below on odd ones), the top row's look down and the bottom
  // row's look up, so a column's gap never holds more than two one-line plates.
  "m01-first-light": { wide: [8.3, 86.6], strip: [8.3, 86.6], label: "a", landmark: "Landing pad in meadow" },
  "m02-first-contact": { wide: [22.2, 86.6], strip: [22.2, 86.6], label: "a", landmark: "Outpost at river bend" },
  "m02b-hold-the-river": { wide: [36.1, 86.6], strip: [36.1, 86.6], label: "a", landmark: "Twin river bridges" },
  "m02c-mirror-lake": { wide: [50, 86.6], strip: [50, 86.6], label: "a", landmark: "Island lake below the river bridges" },
  "m03-the-ashen-line": { wide: [63.9, 86.6], strip: [63.9, 86.6], label: "a", landmark: "Burnt defensive trench" },
  "m03b-loose-crystal": { wide: [77.8, 86.6], strip: [77.8, 86.6], label: "a", landmark: "Fallen siphons on the ash plain" },
  "m04-three-way-dunes": { wide: [91.7, 86.6], strip: [91.7, 86.6], label: "a", landmark: "Three desert tracks" },
  "m04b-canyon-run": { wide: [91.7, 61.9], strip: [91.7, 61.9], label: "a", landmark: "Amber canyon road north of the dunes" },
  "m05-the-verdant-pact": { wide: [77.8, 61.9], strip: [77.8, 61.9], label: "b", landmark: "Forest crossing" },
  "m06-copper-harvest": { wide: [63.9, 61.9], strip: [63.9, 61.9], label: "a", landmark: "Crystal relay in copper basin" },
  "m06b-wings-over-copper": { wide: [50, 61.9], strip: [50, 61.9], label: "b", landmark: "Airfield at rim" },
  "m06c-gun-hill": { wide: [36.1, 61.9], strip: [36.1, 61.9], label: "a", landmark: "Highridge hill between the basin camps" },
  "m06d-hawk-wing": { wide: [22.2, 61.9], strip: [22.2, 61.9], label: "b", landmark: "Balloon moorings on the open steppe" },
  "m07-copper-siege": { wide: [8.3, 61.9], strip: [8.3, 61.9], label: "a", landmark: "Walled mining town" },
  "m07b-hold-the-valley": { wide: [8.3, 37.2], strip: [8.3, 37.2], label: "a", landmark: "Narrow gorge" },
  "m08-the-quiet-vault": { wide: [22.2, 37.2], strip: [22.2, 37.2], label: "b", landmark: "Sealed stone vault" },
  "m08b-the-long-night": { wide: [36.1, 37.2], strip: [36.1, 37.2], label: "a", landmark: "Three relays lit at night" },
  "m09-a-debt-in-the-dunes": { wide: [50, 37.2], strip: [50, 37.2], label: "b", landmark: "Northern dune field" },
  "m09b-the-water-road": { wide: [63.9, 37.2], strip: [63.9, 37.2], label: "a", landmark: "Water road to the east wells" },
  "m10-obsidian-storm": { wide: [77.8, 37.2], strip: [77.8, 37.2], label: "b", landmark: "Volcanic storm highlands" },
  "m10b-crown-hill": { wide: [91.7, 37.2], strip: [91.7, 37.2], label: "a", landmark: "Gun Hills crown between the camps" },
  // The Ember Roost (m10e, W9) is relay 26: it turns up from Crown Hill to the top row's east end (77.8%); the corners stay free.
  "m10e-the-ember-roost": { wide: [77.8, 12.5], strip: [77.8, 12.5], label: "b", landmark: "Highland slopes east of the Crown (no painted landmark yet)" },
  "m11-cut-the-draw": { wide: [63.9, 12.5], strip: [63.9, 12.5], label: "b", landmark: "Sage canyon draw" },
  "m11c-hold-the-keystone-roads": { wide: [50, 12.5], strip: [50, 12.5], label: "b", landmark: "Ancient crossroads" },
  "m11d-the-sovereign-walks": { wide: [36.1, 12.5], strip: [36.1, 12.5], label: "b", landmark: "Giant footprints + 3 towers" },
  "m12-frontiers-end": { wide: [22.2, 12.5], strip: [22.2, 12.5], label: "b", landmark: "Huge cyan-gold Keystone" },
};
// Node positions for one painting: the README anchor, or (a future mission without one yet) mapLayout's place.
export function mapNodes(missions, art = "wide") {
  const fallback = mapLayout(missions), out = {};
  for (const m of missions) {
    const a = MAP_ANCHORS[m.id]?.[art];
    out[m.id] = a ? { x: a[0], y: a[1] } : fallback[m.id];
  }
  return out;
}
// Bands, top to bottom: act 3, act 2, act 1 (percent of the board height).
export const ACT_BANDS = { 3: { top: 0, bottom: 34 }, 2: { top: 34, bottom: 67 }, 1: { top: 67, bottom: 100 } };
// One node per mission, in campaign order: on the wide painting, and on the phone panorama.
export const MAP_NODES = mapNodes(MISSIONS, "wide");
export const STRIP_NODES = mapNodes(MISSIONS, "strip");
// The map's own words (story catalogue: tools/story-strings.mjs).
export const MAP_TEXT = {
  heading: "The frontier",
  endings: "Endings",
  unseen: "Not reached yet",
  chronicles: "Faction Chronicles",
  // Chronicles round 2 (2026-11-24): the four open at different points of the campaign (was "They open after Act 1.").
  chroniclesNote: "The same war, told by each faction. Each opens as you meet its people.",
  decisions: "Decisions",
  // R3-G: a relay that holds a decision not taken yet, and what each ending asks of the decisions.
  decisionAhead: "A decision waits here",
  hintOpen: "3+ merciful choices",
  hintMeridian: "0-2 merciful choices",
  shortOpen: "Open Frontier",
  shortMeridian: "Meridian Line",
};
// Each ending's hint and short name (phones), in MAP_TEXT so the story catalogue translates them.
export const ENDING_HINTS = {
  "open-frontier": { hint: MAP_TEXT.hintOpen, short: MAP_TEXT.shortOpen },
  "meridian-line": { hint: MAP_TEXT.hintMeridian, short: MAP_TEXT.shortMeridian },
};
