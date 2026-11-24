// One-tap type chips (owner, 2026-11-24): a mixed selection shows a flat row of chips, one per unit type
// (its role glyph and count). Tapping a chip narrows the selection to that type in one tap; tapping the
// lit chip again brings the whole group back. No menu, no second step; on phones the row takes the place
// of the group heading and its totals, so the fixed dock never grows (desktop: in place of the roster).
import { $ } from "./dom.js";
import { chipModel, chipsHTML } from "../type-chips-model.js";
import "../type-chips.css";

export function setupTypeChips(S, A) {
  let key = "", model = null;
  // Called from updateUI: rebuilds the row only when the selection changes (a click is never lost to a
  // re-render), and refreshes each chip's health bar in place.
  function updateChips() {
    const row = $("type-chips");
    if (!row) return;
    // A selection made elsewhere (a tap, Army, a box) forgets the group the chips came from.
    if (S.chipGroup && ![...S.selected].every((id) => S.chipGroup.includes(id))) S.chipGroup = null;
    model = chipModel(S.sim, S.selected, S.chipGroup);
    const next = model ? `${model.types.map((t) => `${t.type}:${t.ids.join(".")}`).join("|")}/${model.active}` : "";
    if (next !== key) {
      key = next;
      row.innerHTML = chipsHTML(model);
      row.hidden = !model;
      document.querySelector(".selection-panel")?.classList.toggle("has-chips", !!model);
    }
    if (!model) return;
    for (const button of row.querySelectorAll("[data-chip]")) {
      const t = model.types.find((x) => x.type === button.dataset.chip);
      if (!t) continue;
      let hp = 0, max = 0;
      for (const id of t.ids) { const e = S.sim.get(id); if (e) { hp += e.hp; max += e.maxHp; } }
      button.style.setProperty("--hp", (max ? hp / max : 0).toFixed(3));
    }
  }
  function chooseChip(type) {
    if (!model) return;
    const t = model.types.find((x) => x.type === type);
    if (!t) return;
    const group = model.base.map((e) => e.id);
    if (model.active === type) { A.setSelection(group); S.chipGroup = null; }
    else { A.setSelection(t.ids); S.chipGroup = group; }
    A.updateUI();
  }
  Object.assign(A, { updateChips, chooseChip });
  return function bind() {
    $("type-chips").onclick = (event) => {
      const chip = event.target.closest("[data-chip]");
      if (chip && S.screen.started && !S.screen.paused && !S.sim.result) chooseChip(chip.dataset.chip);
    };
  };
}
