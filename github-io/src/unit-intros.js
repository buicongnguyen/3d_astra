// Unit intro cards (AAA round 2, W1-D): the first time ever that a unit type with a special rule is on
// screen, own or enemy, the hint slot (#fight-hint, app/ui-extras.js) shows one line that says what it
// does. The line is `D[type].intro` (balance.json, written by the unit's own package, with its
// Vietnamese in src/locales/vi.json); a type without `intro` is never introduced. Once per unit type,
// remembered across matches in localStorage with try/catch, exactly like ability-hints.js. Pure:
// storage, the simulation and the screen test are passed in, so node:test covers it.
export const UNIT_INTROS_KEY = "frontier-command.unit-intros.v1";

// The unit types already introduced. Missing, broken or blocked storage reads as "none yet" (a card
// may then show again next match, which is harmless).
export function loadSeenIntros(storage) {
  try {
    const list = JSON.parse((storage ?? globalThis.localStorage).getItem(UNIT_INTROS_KEY));
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}
// Adds `type` and saves the set; false when storage is unavailable (the set still holds it this session).
export function rememberIntro(seen, type, storage) {
  seen.add(type);
  try {
    (storage ?? globalThis.localStorage).setItem(UNIT_INTROS_KEY, JSON.stringify([...seen]));
    return true;
  } catch {
    return false;
  }
}

// The intro of the first unit (entity order, so deterministic) that has one, is alive, is on screen and
// not yet introduced; null when there is none. `defs` maps a type to its definition. `onScreen(e)` is the
// caller's test (inside the camera view); the default accepts the player's own units and any other unit
// the fog shows (`sim.isVisible`), so a hidden enemy is never announced early.
export function nextUnitIntro(sim, seen, defs, onScreen = () => true) {
  for (const e of sim.entities) {
    if (e.kind !== "unit" || !(e.hp > 0) || seen.has(e.type)) continue;
    const text = defs[e.type]?.intro;
    if (typeof text !== "string" || !text.trim()) continue;
    if (e.team !== 0 && !sim.isVisible(e)) continue;
    if (!onScreen(e)) continue;
    return { type: e.type, text };
  }
  return null;
}
