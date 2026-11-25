// Medal cosmetics (plan C7.3, W6): paint schemes, emblems and title banners earned with medals,
// achievements and daily challenge sets, picked beside the Commander rank items (src/rank-ui.js picker).
// Cosmetic only: an item is an id, a label, a swatch or tint for the view, and how it unlocks. No item has
// a stat, and no pick is ever written into a match's options or rules (tests/meta-rewards.test.js).
//
// `meta` is the service record's summary (src/meta/record.js `meta`, written by src/meta-ui.js):
//   { ach: achievements earned, gold: missions with a gold medal, goldActs: [act], sets: daily challenge sets }
export const MEDAL_ITEMS = Object.freeze({
  paint: [
    { id: "laurel", label: "Laurel", unlock: { goldAct: 1 }, how: "Gold in all of Act 1", tint: [0.92, 1.22, 0.62], swatch: "#b9d77a" },
    { id: "silverline", label: "Silverline", unlock: { ach: 5 }, how: "5 achievements", tint: [1.12, 1.16, 1.22], swatch: "#d9e1ea" },
    { id: "crimson", label: "Crimson", unlock: { sets: 3 }, how: "3 challenge days", tint: [1.4, 0.62, 0.6], swatch: "#d9645c" },
    { id: "obsidian", label: "Obsidian", unlock: { ach: 15 }, how: "15 achievements", tint: [0.6, 0.62, 0.74], swatch: "#5c6272" },
  ],
  emblem: [
    { id: "laurels", label: "Laurels", unlock: { gold: 10 }, how: "10 gold medals", glyph: "laurels" },
    { id: "medal", label: "Medal", unlock: { ach: 10 }, how: "10 achievements", glyph: "medal" },
  ],
  banner: [
    { id: "challenger", label: "Daily Challenger", unlock: { sets: 1 }, how: "1 challenge day" },
    { id: "golden", label: "Golden Commander", unlock: { goldAct: 3 }, how: "Gold in all of Act 3" },
    { id: "decorated", label: "Decorated", unlock: { ach: 20 }, how: "20 achievements" },
  ],
});
export const MEDAL_KINDS = Object.freeze(Object.keys(MEDAL_ITEMS));

// Whether `meta` meets an item's unlock (every named condition).
export function rewardOpen(item, meta = {}) {
  const u = item?.unlock;
  if (!u) return false;
  const m = meta || {};
  if (u.ach && !((m.ach || 0) >= u.ach)) return false;
  if (u.gold && !((m.gold || 0) >= u.gold)) return false;
  if (u.sets && !((m.sets || 0) >= u.sets)) return false;
  if (u.goldAct && !(Array.isArray(m.goldActs) && m.goldActs.includes(u.goldAct))) return false;
  return true;
}
export const medalItem = (kind, id) => MEDAL_ITEMS[kind]?.find((i) => i.id === id) || null;
// The medal items `meta` unlocks, as [{ kind, ...item }].
export const openRewards = (meta) => MEDAL_KINDS.flatMap((kind) => MEDAL_ITEMS[kind].filter((i) => rewardOpen(i, meta)).map((i) => ({ kind, ...i })));
// What changed between two metas: the items newly unlocked.
export function newRewards(before, after) {
  const had = new Set(openRewards(before).map((i) => `${i.kind}:${i.id}`));
  return openRewards(after).filter((i) => !had.has(`${i.kind}:${i.id}`));
}
