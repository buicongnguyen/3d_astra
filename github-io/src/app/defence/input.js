// Frontier Defence, what a tap or a click on the battlefield or on the command card does:
// picking pads, towers, bridges, zone spots and squads, and the commands they send.
import { GHOST_MS } from "./constants.js";
import { commanderStats } from "../../sim/defence/commander.js";

export function createInput(c) {
  const { S, A, Z, root, ui, phone, selectedSquad } = c;
  const { $ } = c.deps;
  // Called across modules: bound when every module exists.
  const nearestPad = (...a) => c.nearestPad(...a);
  const nearestBridge = (...a) => c.nearestBridge(...a);
  // The commander's aimed abilities: the reach ring around it until a spot is tapped.
  function setAim(which) {
    ui.aim = which;
    // The ring follows the commander's ranks (Artillery's wider Barrage).
    const hero = S.sim.commander(), c = commanderStats(S.sim.defence?.hero);
    if (!which || !hero) { ui.aim = null; S.view.tactics?.clearAim(); return; }
    const a = c[which];
    S.view.tactics?.showAim([hero], a.range, which === "barrage" ? a.radius : 2.5, null, false);
  }
  // "Crew a pad" (2026-11-24): the best empty pad is picked as if tapped, and its crews open.
  function crewPad() {
    const pad = c.bestPad?.();
    if (!pad) return;
    S.defencePad = pad.id;
    S.defenceBridge = null;
    S.defenceSpot = null;
    S.defenceDepot = false;
    A.setSelection([]);
    // A phone's framed camera already shows every pad; a desktop camera moves to it.
    if (!phone()) S.view.focusOn(pad.x, pad.z);
    picked();
  }
  function act(action, el) {
    if (!Z.started || Z.paused || S.sim.result) return;
    if (action === "crew-pad") { crewPad(); return; }
    if (action === "demolish") {
      const x = Number(el.dataset.crossing);
      if (S.sim.command({ team: 0, type: "demolish", crossing: x })) A.tone(220, 0.2);
      A.updateUI();
      return;
    }
    const t = A.selectedEntities()[0];
    if (!t?.crew) return;
    if (action === "upgrade" && S.sim.command({ team: 0, type: "padUpgrade", building: t.id })) { ui.burstTier = t.tier; A.tone(880, 0.14); }
    if (action === "rank" && S.sim.command({ team: 0, type: "padRank", building: t.id })) { ui.burstTier = 3; A.tone(1046, 0.16); }
    if (action === "sell" && S.sim.command({ team: 0, type: "padSell", building: t.id })) { S.defencePad = t.pad; A.setSelection([]); A.tone(330, 0.12); }
    if (action === "focus") S.view.focusOn(t.x, t.z);
    A.updateUI();
  }
  function branch(id) {
    const t = A.selectedEntities()[0];
    if (!Z.started || Z.paused || S.sim.result || !t?.crew) return;
    if (S.sim.command({ team: 0, type: "padBranch", building: t.id, branch: id })) { ui.burstTier = 3; A.tone(990, 0.16); }
    A.updateUI();
  }
  function heroAct(id) {
    const hero = S.sim.commander();
    if (!Z.started || Z.paused || S.sim.result || !hero) return;
    if (id === "focus") S.view.focusOn(hero.x, hero.z);
    // Commander ranks (2026-11-25): one tap buys the next rank, or the branch tapped.
    else if (id === "rank" || id === "artillery" || id === "rally") {
      if (S.sim.command({ team: 0, type: "heroUpgrade", ...(id === "rank" ? {} : { branch: id }) })) A.tone(id === "rank" ? 760 : 880, 0.14);
    } else if (id === "top") return;
    else setAim(ui.aim === id ? null : id);
    A.updateUI();
  }
  function build(crew) {
    if (!Z.started || Z.paused || S.sim.result || (!S.defencePad && !S.defenceSpot)) return;
    // A zone spot (0.23) makes its own pad: the newest one.
    const spot = !S.defencePad ? S.defenceSpot : null, pad = S.defencePad;
    if (S.sim.command(spot ? { team: 0, type: "zoneBuild", zone: spot.zone, x: spot.x, z: spot.z, crew } : { team: 0, type: "padBuild", pad, crew })) {
      A.tone(740, 0.14);
      const t = spot ? S.sim.towerOn(S.sim.defence.zonePads.at(-1).id) : S.sim.towerOn(pad);
      S.defenceSpot = null;
      if (t) A.setSelection([t.id]);
      // Phones: stay on the card with the new tower's Upgrade and Sell.
      if (root.classList.contains("compact-ui")) A.dockTab("selection");
    }
    A.updateUI();
  }
  // Armour (0.23): Guard / Hold the road for the picked squad, a new squad, or the camera on it.
  function armourAct(id) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const squad = selectedSquad(A.selectedEntities());
    if (id === "buy") {
      if (S.sim.command({ team: 0, type: "armourBuy" })) {
        A.tone(700, 0.14);
        const made = S.sim.armourSquads().at(-1);
        S.defenceDepot = false;
        if (made) A.setSelection(made.units.map((e) => e.id));
        // Phones: stay on the card with the squad's Guard and Hold the road.
        if (root.classList.contains("compact-ui")) A.dockTab("selection");
      }
    } else if (squad && (id === "rank2" || id === "assault" || id === "bulwark")) {
      if (S.sim.command({ team: 0, type: "armourUpgrade", squad, ...(id === "rank2" ? {} : { branch: id }) })) A.tone(id === "rank2" ? 760 : 880, 0.14);
    } else if (squad && id === "combined") {
      // R3-C: the Combined step. The sheet's key does not name it, so the card is redrawn by hand.
      if (S.sim.command({ team: 0, type: "armourUpgrade", squad, combined: true })) { A.tone(990, 0.16); $("commands").querySelector("[data-defence-sheet]")?.removeAttribute("data-key"); }
    } else if (squad && (id === "guard" || id === "road")) {
      if (S.sim.command({ team: 0, type: "armourMode", squad, mode: id })) A.tone(id === "road" ? 420 : 520, 0.1);
    } else if (squad && id === "focus") { const u = S.sim.armourUnits(squad)[0]; if (u) S.view.focusOn(u.x, u.z); }
    A.updateUI();
  }
  $("commands").addEventListener("click", (event) => {
    if (!S.sim?.defence) return;
    // A phone's click that follows the tap which opened this sheet lands where the finger was: on
    // a landscape phone that can be a tile of the sheet just shown. Taken for what it is, a ghost.
    if (ui.lastTap && performance.now() - ui.lastTap.at < GHOST_MS && Math.hypot(event.clientX - ui.lastTap.x, event.clientY - ui.lastTap.y) < 12) return;
    const aimBtn = event.target.closest("[data-defence-aim]");
    if (aimBtn && !aimBtn.disabled) {
      const t = A.selectedEntities()[0];
      if (Z.started && !Z.paused && !S.sim.result && t?.crew && S.sim.command({ team: 0, type: "padAim", building: t.id, aim: aimBtn.dataset.defenceAim })) A.tone(640, 0.06);
      A.updateUI();
      return;
    }
    const crew = event.target.closest("[data-defence-crew]"), action = event.target.closest("[data-defence-act]"), pick = event.target.closest("[data-defence-branch]"), hero = event.target.closest("[data-defence-hero]"), armour = event.target.closest("[data-defence-armour]");
    if (armour && !armour.disabled) armourAct(armour.dataset.defenceArmour);
    else if (crew && !crew.disabled) build(crew.dataset.defenceCrew);
    else if (pick && !pick.disabled) branch(pick.dataset.defenceBranch);
    else if (hero && !hero.disabled) heroAct(hero.dataset.defenceHero);
    else if (action && !action.disabled) act(action.dataset.defenceAct, action);
  });
  function tap(x, y) {
    if (!Z.started || Z.paused || S.sim.result || S.mode) return false;
    ui.lastTap = { x, y, at: performance.now() };
    const point = S.view.point(x, y), hero = S.sim.commander();
    // An aimed commander ability takes the tap.
    if (ui.aim && hero) {
      if (point && S.sim.command({ team: 0, type: "heroCast", ability: ui.aim, x: point.x, z: point.z })) { A.tone(ui.aim === "barrage" ? 300 : 600, 0.16); setAim(null); }
      else A.notice("Out of reach: tap inside the ring.");
      A.updateUI();
      return true;
    }
    const target = S.view.pick(x, y, S.sim, 24);
    if (target?.team === 0 && target.crew) { S.defencePad = target.pad; S.defenceBridge = null; A.setSelection([target.id]); return picked(); }
    if (target?.hero) { S.defencePad = null; S.defenceBridge = null; S.defenceSpot = null; A.setSelection([target.id]); return picked(); }
    // A tank of an armour squad (0.23) picks the whole squad.
    if (target?.team === 0 && target.squad) { S.defencePad = null; S.defenceBridge = null; S.defenceSpot = null; A.setSelection(S.sim.armourUnits(target.squad).map((e) => e.id)); return picked(); }
    const pad = nearestPad(x, y);
    if (pad) {
      S.defencePad = pad.id;
      S.defenceBridge = null;
      S.defenceSpot = null;
      S.defenceDepot = false;
      const t = S.sim.towerOn(pad.id);
      A.setSelection(t ? [t.id] : []);
      return picked();
    }
    const bridge = nearestBridge(x, y, point);
    if (bridge !== null) {
      S.defencePad = null;
      S.defenceBridge = bridge;
      S.defenceSpot = null;
      S.defenceDepot = false;
      A.setSelection([]);
      return picked();
    }
    // An armour squad picked: a tap on the map sends it there (it guards that spot).
    const squad = selectedSquad(A.selectedEntities());
    if (squad && point && !(target?.team > 0)) {
      if (S.sim.command({ team: 0, type: "armourMove", squad, x: point.x, z: point.z })) A.tone(560, 0.08);
      else A.notice("The squad cannot go there.");
      A.updateUI();
      return true;
    }
    // The commander picked: a tap on open ground sends it there.
    if (hero && S.selected.has(hero.id) && point && !(target?.team > 0)) {
      if (S.sim.command({ team: 0, type: "heroMove", x: point.x, z: point.z })) A.tone(560, 0.08);
      else A.notice("The commander cannot go there.");
      A.updateUI();
      return true;
    }
    // A spot in a build zone (0.23), snapped to the grid; the sheet says if a crew may stand there.
    const zone = point && !(target?.team > 0) ? S.sim.zoneAt(point.x, point.z) : null;
    if (zone) {
      const p = S.sim.zoneSnap(point.x, point.z);
      S.defencePad = null;
      S.defenceBridge = null;
      S.defenceDepot = false;
      S.defenceSpot = { zone: zone.id, x: p.x, z: p.z };
      A.setSelection([]);
      return picked();
    }
    S.defencePad = null;
    S.defenceBridge = null;
    S.defenceSpot = null;
    S.defenceDepot = false;
    if (target?.team > 0) return false; // the usual label for an enemy
    A.setSelection([]);
    A.updateUI();
    return true;
  }
  function picked() {
    A.tone(520, 0.06);
    // R3-E: a new pick opens a collapsed landscape dock again.
    c.setDockMin?.(false);
    if (root.classList.contains("compact-ui")) A.dockTab("selection");
    A.updateUI();
    return true;
  }
  Object.assign(c, { crewPad, setAim, act, branch, heroAct, build, armourAct, tap, picked });
}
