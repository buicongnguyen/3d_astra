// The skirmish rules the player chose on the setup screen (S.rules): only the choices that differ
// from their default, as an object, or null when every rule is at its default. That is exactly what
// the Simulation's `rules` option wants (a match with none is byte-identical to one before the rules
// existed), so src/main.js createSim passes S.rules as it is. Remembered in its own storage key (the
// settings record keeps a fixed set of keys).
import { RULE_OPTIONS } from "./rule-options.js";

export const RULES_KEY = "frontier-command.rules.v1";

const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const optionOf = (id) => RULE_OPTIONS.find((o) => o.id === id);
const valid = (option, value) => !!option && option.values.some((v) => v.id === value);

// Keeps only known rules at a known, non-default value; null when nothing is left.
export function activeRules(chosen) {
  const out = {};
  for (const option of RULE_OPTIONS) {
    const value = chosen?.[option.id];
    if (valid(option, value) && value !== option.default) out[option.id] = value;
  }
  return Object.keys(out).length ? out : null;
}

// The value a rule shows on the setup screen: the chosen one, else its default.
export const ruleValue = (rules, id) => (valid(optionOf(id), rules?.[id]) ? rules[id] : optionOf(id)?.default);

// `rules` with rule `id` set to `value` (back to its default removes it): a new object or null.
export function withRule(rules, id, value) {
  if (!valid(optionOf(id), value)) return activeRules(rules);
  return activeRules({ ...rules, [id]: value });
}

// A stable text of the rules a sim runs (or the setup chose), to compare the two.
export const rulesKey = (rules) => JSON.stringify(activeRules(rules));

export function loadRules(store = storage()) {
  try { return activeRules(JSON.parse(store?.getItem(RULES_KEY) || "null")); } catch { return null; }
}

// True when the choice was stored. Blocked storage fails silently: the choice lasts for the visit.
export function saveRules(rules, store = storage()) {
  try {
    const active = activeRules(rules);
    if (active) store.setItem(RULES_KEY, JSON.stringify(active));
    else store.removeItem(RULES_KEY);
    return true;
  } catch {
    return false;
  }
}

// The rules a match on battlefield `mapId` gets: a rule that plays only on some maps (`maps`, round 4 Wild frontier:
// Amber Dunes) is left out elsewhere, so it never reaches that match's options, save or hash. null when none is left.
export function rulesForMap(rules, mapId) {
  if (!rules) return null;
  // A rule at its default or tied to other maps is dropped: rules with no setup row (Quick battle, a test's look) pass through.
  const out = Object.fromEntries(Object.entries(rules).filter(([id, value]) => { const option = optionOf(id); return !option || (value !== option.default && (!option.maps || option.maps.includes(mapId))); }));
  return Object.keys(out).length ? out : null;
}
