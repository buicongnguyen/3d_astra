// Campaign: a series of stages, one per battlefield, each harder than the last.
// Progress (cleared stages and best times) is kept in this browser only.
// Allied AIs outnumber you, so Command sends extra supplies and a Sentinel tower.
const ALLIED_BONUS = { alloy: 200, energy: 100, tower: true };
export const STAGES = [
  { id: 'first-contact', name: 'First Contact', map: 'riverlands', enemies: 1, speed: 'relaxed', alliance: 'ffa',
    story: 'A lone rival outpost watches the river crossings. Build your economy, then take their Command core.' },
  { id: 'ashen-line', name: 'The Ashen Line', map: 'classic', enemies: 1, speed: 'normal', alliance: 'ffa',
    story: 'A seasoned commander holds the ash plains and attacks on schedule. Hold the chokepoints and strike back.' },
  { id: 'three-way-dunes', name: 'Three-Way Dunes', map: 'dunes', enemies: 2, speed: 'normal', alliance: 'ffa',
    story: 'Two rival factions fight over the dunes, and each other. Let them bleed, then finish the survivor.' },
  { id: 'verdant-pact', name: 'The Verdant Pact', map: 'woodlands', enemies: 2, speed: 'relaxed', alliance: 'coalition', bonus: ALLIED_BONUS,
    story: 'The rivals have signed a pact. They share scouting, raid your Harvesters and attack together. Command sends supplies and a Sentinel tower.' },
  { id: 'copper-siege', name: 'Copper Siege', map: 'basin', enemies: 2, speed: 'normal', alliance: 'coalition', bonus: ALLIED_BONUS,
    story: 'The pact moves faster now: earlier technology, bigger economies and shorter gaps between joint offensives.' },
  { id: 'obsidian-storm', name: 'Obsidian Storm', map: 'highlands', enemies: 3, speed: 'normal', alliance: 'coalition', bonus: ALLIED_BONUS,
    story: 'Three allied commanders: an assault force, a raider and a siege corps. Expect attacks from every side.' },
  { id: 'frontiers-end', name: "Frontier's End", map: 'expanse', enemies: 3, speed: 'fast', alliance: 'coalition', bonus: ALLIED_BONUS,
    story: 'The final coalition attacks early and often. Survive the first joint offensive, then break them one by one.' },
];

const KEY = 'frontier-campaign-v1';
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
export function loadProgress(store = storage()) {
  try {
    const cleared = JSON.parse(store?.getItem(KEY) || '{}').cleared;
    return { cleared: cleared && typeof cleared === 'object' ? { ...cleared } : {} };
  } catch {
    return { cleared: {} };
  }
}
export function saveProgress(progress, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(progress)); } catch { /* private mode or full storage */ }
}
// A stored time (even 0) means cleared.
export const isCleared = (progress, index) => index >= 0 && index < STAGES.length && Object.hasOwn(progress.cleared, STAGES[index].id);
export const isUnlocked = (progress, index) => index === 0 || (index < STAGES.length && isCleared(progress, index - 1));
// Best (shortest) clear time in seconds.
export function recordClear(progress, index, time) {
  const id = STAGES[index].id, best = progress.cleared[id];
  return { cleared: { ...progress.cleared, [id]: best === undefined ? time : Math.min(best, time) } };
}
export const nextStage = (progress) => {
  const open = STAGES.findIndex((_, i) => isUnlocked(progress, i) && !isCleared(progress, i));
  return open < 0 ? STAGES.length - 1 : open;
};
