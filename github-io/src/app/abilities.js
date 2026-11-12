// Abilities, stances, Barrage aiming and auto-cast.
import { $ } from "./dom.js";
import { abilityGroups, takesStance, STANCE_INFO, aimState } from "../tactics-ui.js";

export function setupAbilities(S, A) {
  const Z = S.screen;
  // ---- Abilities, stances and veterancy (rules: sim/tactics.js; logic: tactics-ui.js).
  function useAbility(id) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const group = abilityGroups(S.sim, A.selectedEntities(), 99).find((g) => g.id === id);
    if (!group) return;
    if (!group.ready) { A.notice(`${group.name} is recharging.`); return; }
    if (group.aimed) { enterAim(); return; }
    A.clearMode();
    if (S.sim.command({ team: 0, type: "ability", ids: group.ids })) A.tone(700, 0.1);
    else A.notice(id === "triage" ? "No injured infantry in range." : id === "fortify" ? "No damaged vehicle or building in range." : `${group.name} is recharging.`);
    A.updateUI();
  }

  function setStance(stance, announce = false) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const ids = A.selectedEntities().filter(takesStance).map((e) => e.id);
    if (!ids.length) { A.notice("Select soldiers or tanks to set a stance."); return; }
    if (S.sim.command({ team: 0, type: "stance", ids, stance })) {
      A.tone(600);
      if (announce) A.notice(`Stance: ${STANCE_INFO[stance].label}`);
    }
    A.updateUI();
  }

  // Barrage is aimed: a target circle follows the pointer (or the last tap), a ring around each
  // ready Breaker shows its reach, and the circle turns red beyond it.
  function enterAim() {
    A.clearMode();
    S.mode = "barrage";
    $("mode-banner").hidden = false;
    $("mode-banner").textContent = S.touchInput ? "BARRAGE · Tap a target inside the ring" : "BARRAGE · Click a target inside the ring · Esc to cancel";
    $("mode-controls").hidden = false;
    A.dismissNotice(); // the prompt replaces a routine notice; an alert stays
    $("world").classList.add("targeting");
    refreshAim(!S.touchInput && S.hoverPoint ? S.view.point(S.hoverPoint.x, S.hoverPoint.y) : null);
    A.updateUI();
  }

  function refreshAim(point) {
    const aim = aimState(S.sim, A.selectedEntities(), point);
    if (!aim.sources.length) { A.clearMode(); return null; }
    S.aimPoint = point;
    S.view.tactics.showAim(aim.sources, aim.range, aim.radius, point, aim.ok);
    return aim;
  }

  function fireBarrage(point) {
    if (!point || !Z.started || Z.paused || S.sim.result) return;
    const aim = refreshAim(point);
    if (!aim) { A.notice("Barrage is recharging."); A.updateUI(); return; }
    if (!aim.ok) {
      $("mode-banner").textContent = "BARRAGE · Out of range: choose a spot inside the ring";
      A.tone(260, 0.12);
      return;
    }
    if (S.sim.command({ team: 0, type: "ability", ids: aim.casters, x: point.x, z: point.z })) {
      A.tone(520, 0.12);
      A.clearMode();
    }
    A.updateUI();
  }

  // Auto-cast is a setting (settings.js): the match is told at its start, after a save is
  // loaded and whenever the setting changes.
  function syncAutocast(always = true) {
    if (!Z.started || S.sim.result) return;
    if (always || !!S.sim.players[0].autocast !== !!S.settings.autocast) S.sim.command({ team: 0, type: "autocast", on: !!S.settings.autocast });
  }

  Object.assign(A, { refreshAim, syncAutocast, setStance, useAbility, fireBarrage });
  return function bind() {};
}
