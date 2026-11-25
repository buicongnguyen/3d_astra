// Mission title cards (AAA round 2, W2-F): the act and the day of every mission, Chronicle mission and
// Defence level, in an id-keyed table of their own (never fields on the missions: serialize() writes the
// whole mission into the save and its checksum). `kicker` is the act ("ACT II") or the campaign
// ("ASHFALL CHRONICLE", "FRONTIER DEFENCE"), `day` the story day. The card (app/title-card.js) reads
// "ACT I · LANDFALL · DAY 1", then the title, then the place; an id missing here falls back to the
// mission's title and `briefing.place`. The Vietnamese of the labels: patterns in src/locales/vi.json.
import { ACTS } from "../campaign.js";

export const MISSION_INTROS = {
  "m01-first-light": { kicker: "ACT I", day: "DAY 1" },
  "m02-first-contact": { kicker: "ACT I", day: "DAY 4" },
  "m02b-hold-the-river": { kicker: "ACT I", day: "DAY 6" },
  "m02c-mirror-lake": { kicker: "ACT I", day: "DAY 7" },
  "m03-the-ashen-line": { kicker: "ACT I", day: "DAY 9" },
  "m03b-loose-crystal": { kicker: "ACT I", day: "DAY 11" },
  "m04-three-way-dunes": { kicker: "ACT I", day: "DAY 15" },
  "m04b-canyon-run": { kicker: "ACT I", day: "DAY 17" },
  "m05-the-verdant-pact": { kicker: "ACT II", day: "DAY 22" },
  "m06-copper-harvest": { kicker: "ACT II", day: "DAY 30" },
  "m06b-wings-over-copper": { kicker: "ACT II", day: "DAY 32" },
  "m06c-gun-hill": { kicker: "ACT II", day: "DAY 33" },
  "m06d-hawk-wing": { kicker: "ACT II", day: "DAY 33" },
  "m07-copper-siege": { kicker: "ACT II", day: "DAY 34" },
  "m07b-hold-the-valley": { kicker: "ACT II", day: "DAY 36" },
  "m08-the-quiet-vault": { kicker: "ACT II", day: "NIGHT 38" },
  "m08b-the-long-night": { kicker: "ACT II", day: "NIGHT 39" },
  "m09-a-debt-in-the-dunes": { kicker: "ACT III", day: "DAY 41" },
  "m09b-the-water-road": { kicker: "ACT III", day: "DAY 43" },
  "m10-obsidian-storm": { kicker: "ACT III", day: "DAY 47" },
  "m10b-crown-hill": { kicker: "ACT III", day: "DAY 49" },
  "m11-cut-the-draw": { kicker: "ACT III", day: "DAY 52" },
  "m11c-hold-the-keystone-roads": { kicker: "ACT III", day: "DAY 54" },
  "m11d-the-sovereign-walks": { kicker: "ACT III", day: "DAY 54" },
  "m12-frontiers-end": { kicker: "ACT III", day: "DAY 55" },
  "ca1-cold-berths": { kicker: "ASHFALL CHRONICLE", day: "DAY 3" },
  "ca2-lights-out": { kicker: "ASHFALL CHRONICLE", day: "DAY 4" },
  "ca3-scrapyard-gorge": { kicker: "ASHFALL CHRONICLE", day: "DAY 44" },
  "ca4-the-toll-road": { kicker: "ASHFALL CHRONICLE", day: "DAY 46" },
  "cs1-dry-wells": { kicker: "SUNWARD CHRONICLE", day: "DAY 11" },
  "cs2-three-way-dunes": { kicker: "SUNWARD CHRONICLE", day: "DAY 15" },
  "cs3-verdant-road": { kicker: "SUNWARD CHRONICLE", day: "DAY 22" },
  "cs4-guns-on-the-caravan": { kicker: "SUNWARD CHRONICLE", day: "DAY 41" },
  "cw1-standing-orders": { kicker: "WARDENS CHRONICLE", day: "DAY 18" },
  "cw2-a-grey-coat": { kicker: "WARDENS CHRONICLE", day: "DAY 40" },
  "cw3-hold-the-river": { kicker: "WARDENS CHRONICLE", day: "DAY 52" },
  "cw4-without-a-key": { kicker: "WARDENS CHRONICLE", day: "DAY 53" },
  "cv1-night-count": { kicker: "VEIL CHRONICLE", day: "NIGHT 9" },
  "cv2-one-circuit": { kicker: "VEIL CHRONICLE", day: "DAY 22" },
  "cv3-inside-the-dampers": { kicker: "VEIL CHRONICLE", day: "DAY 47" },
  "cv4-the-second-vanguard": { kicker: "VEIL CHRONICLE", day: "DAY 50" },
  "d-gorge": { kicker: "FRONTIER DEFENCE" },
  "d-bridges": { kicker: "FRONTIER DEFENCE" },
  "d-switchback": { kicker: "FRONTIER DEFENCE" },
  "d-fordwood": { kicker: "FRONTIER DEFENCE" },
  "d-canyon": { kicker: "FRONTIER DEFENCE" },
  "d-longcrossing": { kicker: "FRONTIER DEFENCE" },
  "d-crossroads": { kicker: "FRONTIER DEFENCE" },
};

// What the card shows for a mission definition: { kicker, title, place }, or null without a title.
// The line a campaign Defence mission's title card adds under its place.
export const DEFENCE_RULE = "Defence: no base — crew the pads beside the road";
export function titleCardFor(def) {
  if (!def?.title) return null;
  const row = MISSION_INTROS[def.id], place = def.briefing?.place || "";
  const act = row?.kicker?.startsWith("ACT ") ? ACTS.find((a) => a.act === def.act)?.title : "";
  const kicker = row ? [row.kicker, act?.toUpperCase(), row.day].filter(Boolean).join(" · ") : "";
  // 2026-11-24: a campaign mission under the Defence rules says so on its card (no base, pads only).
  const rule = def.rules?.mode === "defence" && def.act ? DEFENCE_RULE : "";
  return { kicker, title: def.title, place, rule };
}
