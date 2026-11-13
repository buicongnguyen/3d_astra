import { RANK_BONUS, STANCES } from "./sim/tactics.js";

// Interface logic for veterancy, stances and unit abilities (rules: sim/tactics.js).
// Pure functions over simulation state: no DOM, no rendering, so node:test covers them.

export { STANCES };
// Ability tiles sit on the command card and take the card's free tile keys. Q and R stay
// Attack-move and Heal / repair while units are selected.
export const ABILITY_KEYS = ["E", "T", "Y"];
// Fixed display order, so the same army always gets the same tile under the same key.
export const ABILITY_ORDER = ["shieldwall", "focus", "barrage", "lockon", "overdrive", "triage", "fortify", "rush", "dash", "burnline", "brace", "mark"];
export const ABILITY_ICONS = { shieldwall: "shield", focus: "rapid", barrage: "barrage", lockon: "crosshair", overdrive: "bolt", triage: "medic", fortify: "engineer", rush: "bolt", dash: "bolt", burnline: "barrage", brace: "hold", mark: "crosshair" };
// Abilities that need a point on the ground.
export const AIMED = new Set(["barrage"]);
export const STANCE_INFO = {
  guard: { label: "Guard", key: "[", icon: "shield", title: "Guard: answer threats nearby, then return to the post" },
  hold: { label: "Hold", key: "]", icon: "hold", title: "Hold position: fire from the spot, never chase" },
  aggressive: { label: "Aggressive", key: "\\", icon: "attack", title: "Aggressive: chase enemies freely" },
};

const alive = (e) => !!e && e.kind === "unit" && e.hp > 0;
// Units that obey a stance: armed, and not Harvesters (the same test as sim.setStance).
export const takesStance = (e) => alive(e) && e.damage > 0 && e.type !== "worker";
export const hasAbility = (e) => alive(e) && !!e.ability;
// The tactics card appears for these.
export const tacticalUnits = (entities) => entities.filter((e) => takesStance(e) || hasAbility(e));

// One entry per distinct ability in the selection: who has it, how many are ready and how long
// until the next one is. At most `max` entries: the abilities most units share win.
export function abilityGroups(sim, entities, max = ABILITY_KEYS.length) {
  const groups = new Map();
  for (const e of entities) {
    if (!hasAbility(e)) continue;
    const a = e.ability;
    let g = groups.get(a.id);
    if (!g) groups.set(a.id, (g = { id: a.id, name: a.name, description: a.description, aimed: AIMED.has(a.id), cooldown: a.cooldown,
      range: a.range ?? 0, radius: a.radius ?? 0, ids: [], count: 0, ready: 0, wait: Infinity }));
    g.ids.push(e.id);
    g.count++;
    const wait = Math.max(0, (e.abilityAt || 0) - sim.time);
    if (wait <= 0) g.ready++;
    g.wait = Math.min(g.wait, wait);
  }
  const order = (g) => { const i = ABILITY_ORDER.indexOf(g.id); return i < 0 ? ABILITY_ORDER.length : i; };
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || order(a) - order(b))
    .slice(0, Math.max(0, max))
    .sort((a, b) => order(a) - order(b))
    .map((g) => ({ ...g, fraction: g.ready || !(g.cooldown > 0) ? 0 : Math.min(1, g.wait / g.cooldown) }));
}

// What the tile says under the ability name: "Ready", "Ready 2/3" or the seconds left.
export function abilityStatus(group) {
  if (!group.ready) return `${Math.max(1, Math.ceil(group.wait))}s`;
  return group.count > 1 ? `Ready ${group.ready}/${group.count}` : "Ready";
}

// Ready pulse (tactics-card.js): whether an ability tile starts its short pulse now. `was` is the
// tile's last state ("ready", "cooling", or undefined for a tile just built), `ready` its state now,
// `last` when this ability last pulsed (ms). A cooldown ending always pulses; a new tile that is
// already ready pulses unless the same ability pulsed within `quietMs`; recharging never pulses.
export const PULSE_QUIET_MS = 30000;
export function shouldPulse(was, ready, now, last = -Infinity, quietMs = PULSE_QUIET_MS) {
  if (!ready || was === "ready") return false;
  return was === "cooling" || now - last >= quietMs;
}

// The stance shared by the selection, "mixed" when they differ, null when nobody takes one.
export function stanceState(entities) {
  let state = null;
  for (const e of entities) {
    if (!takesStance(e)) continue;
    const stance = STANCES.includes(e.stance) ? e.stance : "guard";
    if (state === null) state = stance;
    else if (state !== stance) return "mixed";
  }
  return state;
}
export const stancesInUse = (entities) => new Set(entities.filter(takesStance).map((e) => (STANCES.includes(e.stance) ? e.stance : "guard")));

// Aiming an aimed ability (Barrage): the ready units, the ones that reach `point`, and the
// circle to draw. `ok` is false without a point or when no ready unit reaches it.
export function aimState(sim, entities, point, id = "barrage") {
  const sources = entities.filter((e) => hasAbility(e) && e.ability.id === id && sim.time >= (e.abilityAt || 0));
  const a = sources[0]?.ability;
  const valid = !!point && Number.isFinite(point.x) && Number.isFinite(point.z);
  const casters = valid ? sources.filter((e) => Math.hypot(e.x - point.x, e.z - point.z) <= e.ability.range) : [];
  return { id, sources, casters: casters.map((e) => e.id), range: a?.range ?? 0, radius: a?.radius ?? 0, ok: casters.length > 0 };
}

export const clampRank = (rank) => Math.max(0, Math.min(3, Math.floor(rank || 0)));
export const rankBonus = (rank) => Math.round(RANK_BONUS * clampRank(rank) * 100);
export const rankTitle = (rank) => `Rank ${clampRank(rank)} · +${rankBonus(rank)}% damage and health`;
// Rank chevrons for the selection panel: one inline SVG, 1 to 3 chevrons; nothing at rank 0.
export function rankBadge(rank) {
  const n = clampRank(rank);
  if (!n) return "";
  const chevrons = Array.from({ length: n }, (_, i) => `<path d="M2 ${9 + i * 5}l6-5 6 5"/>`).join("");
  return `<span class="rank-badge" data-rank="${n}" role="img" aria-label="Rank ${n}" title="${rankTitle(n)}"><svg viewBox="0 0 16 ${8 + n * 5}" width="16" height="${8 + n * 5}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${chevrons}</svg></span>`;
}

// Auto-cast starts on where there is no keyboard for the ability keys.
export const autocastDefault = (coarse) => !!coarse;
