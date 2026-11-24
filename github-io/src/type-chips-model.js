// One-tap type chips: the model and markup (no DOM, so unit tests can use it; src/app/type-chips.js binds it).
import { icon } from "./icons.js";
import { roleIcon, isHealerGlyph } from "./role-icons.js";

export const CHIP_ROW_LABEL = "Unit types";
export const CHIP_BACK_HINT = "Tap again for the whole group";

// The chips for a selection: { base: [unit], types: [{ type, name, ids }], active } or null when the
// selection (or the group it was narrowed from) holds fewer than two unit types.
export function chipModel(sim, selected, group) {
  const live = (ids) => ids.map((id) => sim.get(id)).filter((e) => e && e.team === 0 && e.kind === "unit" && e.hp > 0);
  const chosen = live([...selected]);
  const fromGroup = group && chosen.length && chosen.every((e) => group.includes(e.id));
  const base = fromGroup ? live(group) : chosen;
  // Only a selection of your own units (no building or enemy among them) gets chips.
  if (!base.length || (!fromGroup && chosen.length !== selected.size)) return null;
  const types = [];
  for (const e of base) {
    let t = types.find((x) => x.type === e.type);
    if (!t) types.push((t = { type: e.type, name: e.name, ids: [] }));
    t.ids.push(e.id);
  }
  if (types.length < 2) return null;
  // Fighters first (as the Army button), then support; larger groups first; then by name.
  const support = (t) => (sim.get(t.ids[0])?.support ? 1 : 0);
  types.sort((a, b) => support(a) - support(b) || b.ids.length - a.ids.length || a.name.localeCompare(b.name));
  const narrowed = fromGroup && chosen.length < base.length && chosen.every((e) => e.type === chosen[0].type) ? chosen[0].type : null;
  return { base, types, active: narrowed };
}

export function chipsHTML(model) {
  if (!model) return "";
  return model.types.map((t) => {
    const on = t.type === model.active;
    return `<button type="button" data-chip="${t.type}" class="${on ? "active" : ""}" aria-pressed="${on}" aria-label="${t.name}" title="${on ? CHIP_BACK_HINT : t.name}">${icon(roleIcon(t.type), `role-icon${isHealerGlyph(t.type) ? " role-medic" : ""}`)}<b>${t.ids.length}</b><i class="vitals"></i></button>`;
  }).join("");
}

