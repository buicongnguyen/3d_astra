// First-time ability hints: the first time the player has a unit whose ability is ready, a one-line
// hint names the ability, says what it does and how to use it (app/ui-extras.js shows it in the
// fight-hint slot, which never covers alerts). Once per ability id, remembered across matches in
// localStorage. Pure: storage and the simulation are passed in, so node:test covers it.
import { ABILITY_KEYS, ABILITY_ORDER } from "./tactics-ui.js";

export const ABILITY_HINTS_KEY = "frontier-command.ability-hints.v1";
// No hint in the first seconds of a match: the briefing and the first orders come first.
export const ABILITY_HINT_AFTER = 4;

// The ability ids the player has already been told about. Missing, broken or blocked storage
// reads as "none yet" (the hint may then show again next match, which is harmless).
export function loadSeenAbilities(storage) {
  try {
    const list = JSON.parse((storage ?? globalThis.localStorage).getItem(ABILITY_HINTS_KEY));
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}
// Adds `id` and saves the set; false when storage is unavailable (the set still holds it this session).
export function rememberAbility(seen, id, storage) {
  seen.add(id);
  try {
    (storage ?? globalThis.localStorage).setItem(ABILITY_HINTS_KEY, JSON.stringify([...seen]));
    return true;
  } catch {
    return false;
  }
}

const order = (id) => { const i = ABILITY_ORDER.indexOf(id); return i < 0 ? ABILITY_ORDER.length : i; };
// The first unit of `team` (in the fixed ability display order) whose ability is ready and not yet
// explained, or null.
export function nextAbilityHint(sim, seen, team = 0) {
  let best = null;
  for (const e of sim.entities) {
    if (e.team !== team || e.kind !== "unit" || !(e.hp > 0) || !e.ability || seen.has(e.ability.id)) continue;
    if (sim.time < (e.abilityAt || 0)) continue;
    if (!best || order(e.ability.id) < order(best.ability.id)) best = e;
  }
  return best;
}

// The hint line. `groups` are the ability groups of the current selection (tactics-ui.js
// abilityGroups), so the key named is the one the card shows; a unit that is not selected gets the
// key it has when selected on its own (the first tile key). Every form has a pattern in vi.json.
export function abilityHintText(unit, { groups = [], touch = false } = {}) {
  const a = unit.ability, index = groups.findIndex((g) => g.id === a.id);
  if (index >= 0) return touch ? `${a.name} is ready. Tap its tile: ${a.description}` : `${a.name} is ready. Press ${ABILITY_KEYS[index] || ABILITY_KEYS[0]}: ${a.description}`;
  return touch ? `${a.name} is ready on your ${unit.name}. Select it and tap its tile: ${a.description}`
    : `${a.name} is ready on your ${unit.name}. Select it and press ${ABILITY_KEYS[0]}: ${a.description}`;
}
