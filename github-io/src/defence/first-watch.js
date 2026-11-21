// "First watch" (AAA round 3, R3-Q: first-minute hooks): the new-player variant of Defence level 1.
// It is new data built from Gorge Road, never an edit of it: the designed level, check:defence, the
// Defence pins and every other variant stay exactly as they are. A profile that has never won a
// Defence level plays level 1's designed ten waves through this variant (app: src/quick-battle.js);
// it adds two things:
//
//  - a Scout Runner (sim/content/scout-runner.js): one fast, unarmed scout runs the road a little
//    ahead of the first wave. Catching it pays bonus alloy; letting it through costs no lives.
//  - `preview`: the start of the match shows the level's enemy roster as a strip (which units come,
//    from which wave), until the first wave sets off.
//
// The variant keeps the level's id, so its stars and best lives count for Gorge Road and a saved
// match continues as any level-1 match does.
import { DEFENCE_LEVELS } from "./levels.js";

export const FIRST_WATCH_LEVEL = "d-gorge";
export const RUNNER = Object.freeze({ wave: 1, type: "rider", route: "main", ahead: 4, bounty: 6, speed: 1 });

// The first-watch definition of `level` (a variant definition from defenceVariant), or the level
// unchanged when it is not level 1's designed waves.
export function firstWatch(level) {
  if (!level || level.id !== FIRST_WATCH_LEVEL || level.variant || level.defence?.heroic || level.defence?.endless) return level;
  return { ...level, defence: { ...level.defence, runner: { ...RUNNER }, preview: true } };
}

// The enemy roster of a level's designed waves, in order of first appearance: { slot, faction, wave }.
// The view turns a slot into the unit the level's enemy faction fields (sim.waveType).
export function rosterOf(level) {
  const seen = new Map();
  (level?.defence?.waves || []).forEach((w, i) => {
    for (const g of w.groups) for (const slot of Object.keys(g.units)) {
      const key = `${slot}|${g.faction || ""}`;
      if (!seen.has(key)) seen.set(key, { slot, faction: g.faction || null, wave: i + 1 });
    }
  });
  return [...seen.values()];
}

export const firstWatchLevel = () => firstWatch(DEFENCE_LEVELS.find((l) => l.id === FIRST_WATCH_LEVEL));
