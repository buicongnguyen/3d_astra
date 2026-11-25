// Targeting modes, building placement and the order sent for a click or tap.
import { $ } from "./dom.js";
import { placeOnGround, GHOST_LIFT } from "../ground-y.js";
import { buildSiteError, reachingBuilder } from "../build-reach.js";
import { DEFINITIONS as D } from "../data.js";
import { REPAIR } from "../progression.js";
import { isFighter } from "../sim/escort.js";

// R3-B: the high-ground hint (numbers from balance.json terrain: high_range 2, high_damage 1.2).
export const HIGH_GROUND_HINT = "High ground: +2 m range, +20% damage";
const HIGH_GROUND_KEY = "frontier-command.hint.high-ground";

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
    S.buildHoverError = '';
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
      if (document.documentElement.classList.contains('compact-ui')) A.dockTab('selection');
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
    if (document.documentElement.classList.contains('compact-ui')) A.dockTab('selection');
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
      sendOrder(repairCrew(workers,target).map(e => e.id),{type:'repair',target:target.id,resume:true},append);
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
    if ((!forced || forced==='attackmove') && (target?.team > 0 || target?.kind === 'wall' || (target?.team < 0 && target.kind === 'unit')) && S.sim.isVisible(target))
      order = { type: "attack", target: target.id };
    if(order.type==='attack'){
      const fighters=units.filter(e=>e.damage>0);
      sendOrder(fighters.map(e=>e.id),order,append);
      // Medics, Engineers and wagons follow the fighters from behind (sim/escort.js) instead of walking
      // onto the enemy's spot; other unarmed units (and support without fighters) still move there.
      const escorts=units.filter(e=>e.support&&fighters.some(isFighter));
      if(escorts.length)sendOrder(escorts.map(e=>e.id),{type:'escort',members:fighters.filter(isFighter).map(e=>e.id),x:target.x,z:target.z},append);
      sendOrder(units.filter(e=>!(e.damage>0)&&!escorts.includes(e)).map(e=>e.id),{type:'move',...point},append);
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
      // A repair needs at most a crew of two (progression.js REPAIR.crew): the nearest go, the rest carry on.
      // After building or repairing, Harvesters go back to their last deposit (`resume`, sim/orders.js finish).
      const repairing = repairCrew(workers.filter((w) => job(w) === "repair"), target);
      for (const type of ["gather", "build", "deliver", "repair"])
        sendOrder((type === "repair" ? repairing : workers.filter((w) => job(w) === type)).map((e) => e.id), { type, target: target.id, ...(type === "build" || type === "repair" ? { resume: true } : {}) }, append);
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
    placeOnGround(S.view.preview, S.view.terrain, point.x, point.z, GHOST_LIFT);
    // W14: red, with the reason, also when no selected Harvester can walk there (src/build-reach.js).
    const error = buildSiteError(S.sim, S.buildType, point.x, point.z, A.selectedEntities());
    S.view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
    $("confirm-build").disabled = !!error;
    if (error) A.notice(error);
    A.updateUI();
  }

  function confirmBuild(point = S.buildPoint) {
    if (!point || S.mode !== "build" || Z.paused || !Z.started || S.sim.result) return;
    // The first selected Harvester that can walk there builds it (W14); else the first, and the sim says why not.
    const selected = A.selectedEntities();
    const worker = reachingBuilder(S.sim, S.buildType, point.x, point.z, selected) || selected.find((e) => e.type === "worker");
    const previousEvents = S.sim.events.length;
    const b = worker && S.sim.command({ team: 0, type: "build", worker: worker.id, building: S.buildType, x: point.x, z: point.z });
    if (b) {
      // The builder goes back to its last deposit once the site is done (sim/orders.js finish, `resume`).
      S.sim.command({ team: 0, type: "order", ids: [worker.id], order: { type: "build", target: b.id, resume: true } });
      clearMode();
      A.setSelection([b.id]);
      highGroundHint(b);
      if (S.audio) S.audio.sfx.play("construct"); else A.tone(330, 0.15);
      S.audio?.order("build", S.sim);
    } else {
      S.buildFailure = S.sim.events.slice(previousEvents).findLast(e => e.type === 'message')?.text || 'Select a Harvester to construct this building.';
      A.updateUI();
    }
  }

  // R3-B: the first building the player places on a plateau says what high ground gives (once per browser).
  function highGroundHint(b) {
    if (!S.sim.terrain.plateaus?.length || !(S.sim.levelOf(b) > 0)) return;
    try { if (localStorage.getItem(HIGH_GROUND_KEY)) return; localStorage.setItem(HIGH_GROUND_KEY, "1"); } catch { if (S.highGroundHinted) return; }
    S.highGroundHinted = true;
    A.notice(HIGH_GROUND_HINT);
  }

  // The Harvesters a repair needs: the nearest, up to the crew size less those already on it.
  function repairCrew(workers, target) {
    const busy = S.sim.own(0).filter((w) => !workers.includes(w) && w.orders[0]?.type === "repair" && w.orders[0].target === target.id).length;
    const d = (w) => Math.hypot(w.x - target.x, w.z - target.z);
    return [...workers].sort((a, b) => d(a) - d(b) || a.id - b.id).slice(0, Math.max(0, REPAIR.crew - busy));
  }

  // Harvesters start mining on their own, except in Training, which teaches the order.
  // Every player action goes through sim.command (see commands.js).
  function sendOrder(ids, order, append = false) {
    // R3-B group pace: a move or attack-move of two or more units keeps together, fighters in front and
    // support units behind (sim/formation.js). The only place the flag is set; Settings > Army turns it off.
    const marching = order.type === "move" || order.type === "attackmove";
    if (S.settings?.groupPace !== false && ids.length > 1 && (marching || order.type === "attack")) order = { ...order, pace: "group" };
    // Group pace off: support units in a mixed group still never lead; they follow the fighters (sim/escort.js).
    else if (marching && ids.length > 1 && !append) {
      const es = ids.map((id) => S.sim.get(id)), fighters = es.filter(isFighter), escorts = es.filter((e) => e?.support);
      if (fighters.length && escorts.length) {
        sendOrder(escorts.map((e) => e.id), { type: "escort", members: fighters.map((e) => e.id), x: order.x, z: order.z });
        ids = ids.filter((id) => !escorts.some((e) => e.id === id));
      }
    }
    const sent = S.sim.command({ team: 0, type: "order", ids, order, append });
    if (sent !== false && ids.length) S.audio?.order(order.type, S.sim); // radio reply (rate-limited in audio-logic.js)
    return sent;
  }

  Object.assign(A, { clearMode, enterMode, sendOrder, confirmBuild, enterBuild, commandAt, showBuildPoint });
  return function bind() {};
}
