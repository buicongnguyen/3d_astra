// Targeting modes, building placement and the order sent for a click or tap.
import { $ } from "./dom.js";
import { DEFINITIONS as D } from "../data.js";

export function setupOrders(S, A) {
  const Z = S.screen;
  // The order button for the pending targeting mode stays lit, as on an RTS command card.
  const ORDER_MODES = { move: 'move-order', attackmove: 'attack-order', patrol: 'patrol-order', attack: 'attack-target-order', support: 'support-order', repair: 'repair-order', rally: 'rally-order' };

  function markOrderMode() {
    for (const [type, id] of Object.entries(ORDER_MODES)) $(id)?.classList.toggle('active', S.mode === type);
  }

  function clearMode() {
    if (document.documentElement.classList.contains('construction-notice-repeated')) A.dismissNotice();
    S.mode = null;
    S.buildType = null;
    S.buildPoint = null;
    S.blockedBuildType = null;
    S.buildFailure = '';
    $("mode-controls").hidden = true;
    $("confirm-build").hidden = true;
    if (S.view) S.view.preview.visible = false;
    S.aimPoint = null;
    S.view?.tactics.clearAim();
    for (const tile of $("commands").querySelectorAll(".ability-tile.active")) tile.classList.remove("active");
    $("mode-banner").hidden = true;
    $("world").classList.remove("targeting");
    markOrderMode();
  }

  function enterMode(type) {
    if (!Z.started || Z.paused || S.sim.result) return;
    if (type === 'repair' && !A.selectedEntities().some(e => e.type === 'worker')) {
      A.notice('Select Harvesters to repair a building.');
      return;
    }
    if (['patrol', 'attack'].includes(type) && !A.selectedEntities().some(e => e.kind === 'unit' && e.damage > 0 && (type !== 'patrol' || e.type !== 'worker'))) {
      A.notice(type === 'patrol' ? 'Select soldiers or tanks to patrol.' : 'Select a Harvester or combat unit to attack.');
      return;
    }
    if (!A.selectedEntities().some((e) => type === 'rally' ? e.kind === 'building' && e.complete && e.trains?.length : e.kind === 'unit')) {
      A.notice(type === 'rally' ? "Select a completed production building first." : "Select units first.");
      return;
    }
    clearMode();
    S.mode = type;
    $("mode-banner").hidden = false;
    $("mode-banner").textContent =
      type === "attackmove"
        ? "ATTACK-MOVE · Click a destination · Esc to cancel"
        : "MOVE · Click a destination · Esc to cancel";
    if (S.touchInput)
      $("mode-banner").textContent =
        `${type === "attackmove" ? "ATTACK-MOVE" : "MOVE"} · Tap your destination`;
    $("mode-controls").hidden = false;
    if (type === "support") $("mode-banner").textContent = "SUPPORT · Choose friendly infantry (Medic) or a building / vehicle (Engineer)";
    if (type === "context") $("mode-banner").textContent = "CONTEXT ORDER · Choose a deposit, enemy, construction site or damaged building";
    if (type === "repair") $("mode-banner").textContent = "REPAIR · Choose a damaged building";
    if (type === "rally") $("mode-banner").textContent = "RALLY POINT · Choose ground, or a deposit to send new Harvesters mining";
    if (type === 'patrol') $("mode-banner").textContent = 'PATROL · Choose the other end of a repeating route';
    if (type === 'attack') $("mode-banner").textContent = 'ATTACK · Choose a visible enemy unit or building';
    A.dismissNotice(); // the prompt replaces a routine notice; an alert stays
    $("world").classList.add("targeting");
    markOrderMode();
  }

  function enterBuild(type) {
    if (!Z.started || Z.paused || S.sim.result) return;
    if (!A.selectedEntities().some((e) => e.type === "worker")) {
      A.notice("Select a Harvester to construct a building.");
      return;
    }
    const missing = S.sim.constructionRequirements(type);
    if (missing) {
      clearMode();
      S.blockedBuildType = type;
      A.notice(missing);
      if (document.documentElement.classList.contains('compact-ui')) A.dockTab('actions');
      A.updateUI();
      return;
    }
    clearMode();
    S.mode = "build";
    S.buildType = type;
    $("mode-banner").hidden = false;
    $("mode-banner").textContent =
      `PLACE ${D[type].name.toUpperCase()} · Click to build · Esc to cancel`;
    if (S.touchInput)
      $("mode-banner").textContent =
        `PLACE ${D[type].name.toUpperCase()} · Tap a location, then Build here`;
    $("mode-controls").hidden = false;
    $("confirm-build").hidden = !S.touchInput;
    $("confirm-build").disabled = true;
    S.view.preview.visible = false;
    S.view.preview.scale.set(D[type].radius, 1, D[type].radius);
    if (document.documentElement.classList.contains('compact-ui')) A.dockTab('actions');
    A.updateUI();
  }

  // A rally on a deposit remembers it, so new Harvesters gather there instead of standing idle.
  function rallyAt(point, target) {
    return target?.kind === "resource" ? { x: target.x, z: target.z, target: target.id } : { x: point.x, z: point.z };
  }

  function commandAt(point, target, append = false, forced = null) {
    if (!point || !Z.started || Z.paused || S.sim.result) return;
    if (forced === 'context') forced = null;
    const es = A.selectedEntities(),
      units = es.filter((e) => e.kind === "unit");
    if (forced === 'rally') {
      S.sim.command({team:0,type:'rally',ids:es.filter(e=>e.kind==='building' && e.team===0 && e.complete && e.trains?.length).map(e=>e.id),rally:rallyAt(point,target)});
      A.notice(target?.kind==='resource' ? 'Rally point on the deposit: new Harvesters start mining.' : 'Rally point established.');
      S.view.marker(point.x,point.z); return;
    }
    if (forced === 'repair') {
      const workers = units.filter(e => S.sim.repairValid(e,target));
      if (!workers.length || target.hp >= target.maxHp) { $("mode-banner").textContent = 'REPAIR · Choose a damaged building'; return false; }
      sendOrder(workers.map(e => e.id),{type:'repair',target:target.id},append);
      S.view.marker(target.x,target.z); A.tone(440); return true;
    }
    if (forced === 'attack') {
      if (!target || target.kind === 'resource' || !(target.team > 0 || target.kind === 'wall') || !S.sim.isVisible(target)) {
        $("mode-banner").textContent = 'ATTACK · Choose a visible enemy or a concrete wall';
        return false;
      }
      sendOrder(units.filter(e => e.damage > 0).map(e => e.id), { type: 'attack', target: target.id }, append);
      S.view.marker(target.x, target.z, 0xef9f75);
      A.tone(440);
      return true;
    }
    if (forced === "support") {
      const helpers = units.filter(e => S.sim.supportValid(e,target));
      if (!helpers.length) { A.notice("Medic: select allied infantry. Engineer: select a completed building or vehicle."); return false; }
      sendOrder(helpers.map(e => e.id),{type:"support",target:target.id},append);
      return true;
    }
    if (!forced && target?.team === 0) {
      const helpers = units.filter(e => S.sim.supportValid(e,target));
      sendOrder(helpers.map(e => e.id),{type:"support",target:target.id},append);
      for (const helper of helpers) units.splice(units.indexOf(helper),1);
    }
    for (const b of es.filter((e) => !forced && !es.some(u=>u.kind==='unit') && e.team === 0 && e.kind === "building" && e.complete && e.trains?.length)) {
      S.sim.command({ team: 0, type: "rally", ids: [b.id], rally: rallyAt(point, target) });
      A.notice(target?.kind === 'resource' ? 'Rally point on the deposit: new Harvesters start mining.' : "Rally point established.");
    }
    if (!units.length) {
      S.view.marker(point.x, point.z);
      return;
    }
    let order = { type: forced || "move", ...point };
    if ((!forced || forced==='attackmove') && (target?.team > 0 || target?.kind === 'wall') && S.sim.isVisible(target))
      order = { type: "attack", target: target.id };
    if(order.type==='attack'){
      sendOrder(units.filter(e=>e.damage>0).map(e=>e.id),order,append);
      sendOrder(units.filter(e=>!(e.damage>0)).map(e=>e.id),{type:'move',...point},append);
      S.view.marker(point.x,point.z,0xef9f75);A.tone(440);return;
    }
    if (
      !forced &&
      target &&
      (target.kind === "resource" ||
        (target.team === 0 && target.kind === "building" && (!target.complete || target.type === "hq" || target.hp < target.maxHp)))
    ) {
      // Per Harvester: gather, build, return cargo to a Command core, or repair a damaged building.
      const job = (w) => target.kind === "resource" ? "gather" : !target.complete ? "build"
        : target.type === "hq" && (w.carry > 0 || target.hp >= target.maxHp) ? "deliver" : "repair";
      const workers = units.filter((e) => e.type === "worker");
      for (const type of ["gather", "build", "deliver", "repair"])
        sendOrder(workers.filter((w) => job(w) === type).map((e) => e.id), { type, target: target.id }, append);
      // Soldiers right-clicking a damaged friendly building pitch in and repair it; otherwise they just move.
      const fixers = target.kind === "building" && target.complete && target.hp < target.maxHp
        ? units.filter((e) => e.type !== "worker" && S.sim.repairValid(e, target)) : [];
      if (fixers.length) sendOrder(fixers.map((e) => e.id), { type: "repair", target: target.id }, append);
      sendOrder(
        units.filter((e) => e.type !== "worker" && !fixers.includes(e)).map((e) => e.id),
        order,
        append,
      );
      // Harvesters with a job need no more orders: let go of them so the next tap can select
      // a building (tapping the Command core would otherwise order a cargo delivery).
      if (units.every((e) => e.type === "worker" || fixers.includes(e)) && !append) {
        S.view.marker(target.x, target.z, S.view.colors[0]);
        A.tone(440);
        A.setSelection([]);
        return;
      }
    } else
      sendOrder(
        units.map((e) => e.id),
        order,
        append,
      );
    S.view.marker(
      point.x,
      point.z,
      order.type === "attack" || forced === "attackmove" ? 0xef9f75 : S.view.colors[0],
    );
    A.tone(440);
  }

  function showBuildPoint(point) {
    // Snap to the nearest valid site so a tap beside a blocked spot still builds.
    point = S.sim.findPlacement(S.buildType, 0, point.x, point.z) || point;
    S.buildPoint = point;
    S.buildFailure = '';
    S.view.preview.visible = true;
    S.view.preview.position.set(point.x, 0.23, point.z);
    const error = S.sim.placement(S.buildType, 0, point.x, point.z);
    S.view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
    $("confirm-build").disabled = !!error;
    if (error) A.notice(error);
    A.updateUI();
  }

  function confirmBuild(point = S.buildPoint) {
    if (!point || S.mode !== "build" || Z.paused || !Z.started || S.sim.result) return;
    const worker = A.selectedEntities().find((e) => e.type === "worker");
    const previousEvents = S.sim.events.length;
    const b = worker && S.sim.command({ team: 0, type: "build", worker: worker.id, building: S.buildType, x: point.x, z: point.z });
    if (b) {
      clearMode();
      A.setSelection([b.id]);
      if (S.audio) S.audio.sfx.play("construct"); else A.tone(330, 0.15);
    } else {
      S.buildFailure = S.sim.events.slice(previousEvents).findLast(e => e.type === 'message')?.text || 'Select a Harvester to construct this building.';
      A.updateUI();
    }
  }

  // Harvesters start mining on their own, except in Training, which teaches the order.
  // Every player action goes through sim.command (see commands.js).
  function sendOrder(ids, order, append = false) {
    return S.sim.command({ team: 0, type: "order", ids, order, append });
  }

  Object.assign(A, { clearMode, enterMode, sendOrder, confirmBuild, enterBuild, commandAt, showBuildPoint });
  return function bind() {};
}
