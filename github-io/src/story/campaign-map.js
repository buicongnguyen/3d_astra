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
  // Map variety (2026-11-24): Act 1 holds seven relays since Mirror Lake (m02c) and Canyon Run (m04b), 13.3% apart
  // like Acts 2 and 3, zigzagging 78% / 86% so neighbours keep 44 px on the 318 px phone board (README had 18.5%).
  "m01-first-light": { wide: [10, 78], strip: [10, 78], label: "b", landmark: "Landing pad in meadow" },
  "m02-first-contact": { wide: [23.3, 86], strip: [23.3, 86], label: "b", landmark: "Outpost at river bend" },
  "m02b-hold-the-river": { wide: [36.7, 78], strip: [36.7, 78], label: "b", landmark: "Twin river bridges" },
  "m02c-mirror-lake": { wide: [50, 86], strip: [50, 86], label: "b", landmark: "Island lake below the river bridges" },
  "m03-the-ashen-line": { wide: [63.3, 78], strip: [63.3, 78], label: "b", landmark: "Burnt defensive trench" },
  "m04-three-way-dunes": { wide: [76.7, 86], strip: [76.7, 86], label: "b", landmark: "Three desert tracks" },
  "m04b-canyon-run": { wide: [90, 78], strip: [90, 78], label: "b", landmark: "Amber canyon road north of the dunes" },
  "m05-the-verdant-pact": { wide: [90, 49.5], strip: [90, 49.5], label: "a", landmark: "Forest crossing" },
  "m06-copper-harvest": { wide: [76.7, 57.5], strip: [76.7, 59], label: "b", landmark: "Crystal relay in copper basin" },
  "m06b-wings-over-copper": { wide: [63.3, 49.5], strip: [63.3, 49.5], label: "a", landmark: "Airfield at rim" },
  "m06c-gun-hill": { wide: [50, 57.5], strip: [50, 59], label: "b", landmark: "Highridge hill between the basin camps" },
  "m07-copper-siege": { wide: [36.7, 49.5], strip: [36.7, 49.5], label: "a", landmark: "Walled mining town" },
  "m07b-hold-the-valley": { wide: [23.3, 57.5], strip: [23.3, 59], label: "b", landmark: "Narrow gorge" },
  "m08-the-quiet-vault": { wide: [10, 49.5], strip: [10, 49.5], label: "a", landmark: "Sealed stone vault" },
  "m09-a-debt-in-the-dunes": { wide: [10, 16], strip: [10, 18], label: "r", landmark: "Northern dune field" },
  "m10-obsidian-storm": { wide: [23.3, 24], strip: [23.3, 25], label: "b", landmark: "Volcanic storm highlands" },
  "m10b-crown-hill": { wide: [36.7, 16], strip: [36.7, 18], label: "a", landmark: "Gun Hills crown between the camps" },
  // W9 (2026-11-26): an eighth Act 3 relay. The painting has no landmark for it yet, so it sits on the highland
  // slopes east of Crown Hill and m11, m11c and m11d moved a little to keep 44 px apart on the 318 px phone board.
  "m10e-the-ember-roost": { wide: [47.2, 32.9], strip: [47.2, 27.4], label: "b", landmark: "Highland slopes east of the Crown (no painted landmark yet)" },
  "m11-cut-the-draw": { wide: [55.4, 12.6], strip: [55.4, 25.1], label: "b", landmark: "Sage canyon draw" },
  "m11c-hold-the-keystone-roads": { wide: [69.5, 12.6], strip: [69.5, 17.7], label: "a", landmark: "Ancient crossroads" },
  "m11d-the-sovereign-walks": { wide: [78.8, 31.3], strip: [78.8, 24.7], label: "b", landmark: "Giant footprints + 3 towers" },
  "m12-frontiers-end": { wide: [90, 16], strip: [90, 18], label: "a", landmark: "Huge cyan-gold Keystone" },
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
