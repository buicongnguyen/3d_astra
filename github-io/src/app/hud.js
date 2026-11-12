// Layout, notices, the top bar and the selection / command panel refresh (updateUI), training panel, objectives toggle.
import { $ } from "./dom.js";
import { ACTION_KEYS } from "../hotkeys.js";
import { DEFINITIONS as D } from "../data.js";
import { TRAINING_STEPS } from "../tutorial.js";
import { createMissionUI } from "../mission-ui.js";
import { hasPortrait, portrait } from "../portraits.js";
import { icon } from "../icons.js";
import { selectionStatus } from "../selection-status.js";
import { tacticalUnits, clampRank } from "../tactics-ui.js";
import { tacticsCardHTML, updateTacticsCard } from "../tactics-card.js";
import { createMessageQueue, ROUTINE, ALERT } from "../message-queue.js";

export function setupHud(S, A) {
  const Z = S.screen;
  // Story missions: briefing overlay, dialogue box, objectives list and debrief (mission-ui.js).
  const missionUI = createMissionUI({ stage: $("stage"), objectivesPanel: $("mission-objectives"), tone: (frequency, duration) => (frequency === 988 ? S.audio?.sfx.play("objective") : frequency === 196 ? S.audio?.sfx.play("objective-failed") : null) ?? A.tone(frequency, duration) });

  const compactMedia = matchMedia("(max-width: 1000px), (max-height: 650px)");

  // Compact layouts dock the panels at the side on wide screens (mobile.css).
  const sideDock = matchMedia("(min-aspect-ratio: 1.35)");

  function setObjectivesOpen(open) {
    document.documentElement.classList.toggle('objectives-open', open);
    $('mission-toggle').setAttribute('aria-expanded', String(open));
  }

  // Desktop console: unit orders and targeting Cancel sit beside the selected object's stats,
  // and the frame rate moves to the top bar because the desktop hides the status bar.
  // Compact layouts keep orders under Selection and Cancel on the battlefield or construction card.
  function placeConsole(desktop) {
    const orders = document.querySelector(".order-buttons"), card = document.querySelector(".command-panel"), controls = $("mode-controls");
    if (desktop) {
      if (orders.parentElement !== card) $("commands").before(orders);
      if (controls.parentElement !== card) card.append(controls);
      $("clock").before($("fps"));
    } else {
      document.querySelector(".statusbar").append($("fps"));
      if (orders.parentElement === card) $("queue").after(orders);
      if (controls.parentElement === card) $("stage").append(controls);
    }
  }

  function setLayout() {
    document.documentElement.classList.toggle(
      "compact-ui",
      compactMedia.matches || S.touchInput,
    );
    document.documentElement.classList.toggle("touch-ui", S.touchInput);
    placeConsole(!document.documentElement.classList.contains('compact-ui'));
    if (!document.documentElement.classList.contains('compact-ui')) setObjectivesOpen(false);
    S.touchControls?.reset();
    S.drag = null;
    S.pointer.inside = false;
    $("selection-box").style.display = "none";
    if (S.view) updateUI();
    requestAnimationFrame(() => S.view?.resize());
  }

  function dockTab(name) {
    document.documentElement.dataset.dock = name;
    for (const button of $("dock-tabs").querySelectorAll("button"))
      button.setAttribute("aria-pressed", String(button.dataset.dock === name));
  }

  // The notice line (#notice): routine notices and alerts share it with a priority (message-queue.js).
  // An alert stays its full time; a routine notice that arrives meanwhile waits its turn.
  const messages = createMessageQueue();
  function showMessage() {
    const now = performance.now(), current = messages.update(now), el = $("notice");
    clearTimeout(S.noticeTimeout);
    if (!current) { el.classList.remove("show"); return; }
    el.textContent = current.text;
    el.classList.toggle("warning", current.priority >= ALERT);
    el.classList.add("show");
    S.noticeTimeout = setTimeout(showMessage, Math.max(0, current.until - now) + 16);
  }
  function notice(text) {
    // Successful work is acknowledged by its compact strip, without covering the map.
    if (Object.values(D).some(d=>text===`${d.name} queued.`||text===`${d.name} construction started.`||[2,3].some(level=>text===`${d.name} upgrading to level ${level}.`))) {
      dismissNotice(); return;
    }
    messages.push(text, ROUTINE, performance.now());
    showMessage();
  }
  // Under attack, attack incoming, a point lost: never replaced by a routine notice or covered by a hint.
  function alertNotice(text) {
    messages.push(text, ALERT, performance.now());
    showMessage();
  }
  function clearMessages() { messages.clear(); showMessage(); }
  // Targeting prompts and build feedback take the place of a routine notice; an alert stays.
  function dismissNotice() { messages.dismissRoutine(performance.now()); showMessage(); }

  function formatTime(s) {
    return `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  }

  let lastInfoHtml = null;

  function updateUI() {
    renderTutorial();
    missionUI.renderObjectives(S.sim);
    const p = S.sim.players[0],
      pop = S.sim.population(0);
    $("alloy").textContent = Math.floor(p.alloy).toLocaleString();
    $("energy").textContent = Math.floor(p.energy).toLocaleString();
    $("population").innerHTML =
      `${pop.used}${pop.reserved ? `<span class="reserved">+${pop.reserved}</span>` : ""} <em>/ ${pop.cap}</em>`;
    $("population").classList.toggle(
      "at-cap",
      pop.used + pop.reserved >= pop.cap,
    );
    $("clock").textContent = formatTime(S.sim.time);
    $("uplink").textContent = S.sim.result
      ? "OPERATION COMPLETE"
      : !Z.started
        ? "STANDBY"
        : Z.paused
          ? "PAUSED"
          : "CONNECTED";
    for (const id of S.selected) if (!S.sim.get(id)) S.selected.delete(id);
    const own = S.sim.own(0),
      army = own.filter((e) => e.kind === "unit" && e.type !== "worker");
    if (own.some((e) => e.type === "worker" && e.carry > 0))
      S.milestones.economy = true;
    if (army.length >= 8) S.milestones.army = true;
    $("obj-economy").classList.toggle("complete", S.milestones.economy);
    $("obj-army").classList.toggle("complete", S.milestones.army);
    $("obj-win").classList.toggle("complete", S.sim.result === "victory");
    const rivals = S.sim.players.slice(1).filter(player => !player.eliminated).length;
    $("obj-win").querySelector("small").textContent = `Destroy enemy cores: ${rivals} ${rivals === 1 ? "rival remains" : "rivals remain"}`;
    const es = A.selectedEntities(),
      e = es[0];
    document.querySelector('.selection-panel').classList.toggle('has-entity',!!e);
    document.querySelector('.selection-panel').classList.toggle('has-roster',es.length>1);
    $("selection-count").textContent =
      es.length > 1
        ? `${es.length} SELECTED`
        : e?.kind === "building"
          ? "STRUCTURE"
          : e
            ? "UNIT"
            : "READY";
    $("selection-label").textContent = e
      ? "SELECTION DETAILS"
      : "EXPEDITION COMMAND";
    const idle = A.idleCounts?.() || { worker: 0, army: 0 };
    const idleRow = `<div class="idle-row"><button type="button" data-idle="worker" title="F1 · Next idle Harvester"${idle.worker ? "" : " disabled"}>${icon("worker")}<span>Idle Harvesters</span><kbd>F1</kbd><b>${idle.worker}</b></button><button type="button" data-idle="army" title=", · Next idle army unit"${idle.army ? "" : " disabled"}>${icon("crosshair")}<span>Idle army</span><kbd>,</kbd><b>${idle.army}</b></button></div>`;
    const infoHtml = !e
      ? `<div class="selection-empty">${icon("logo")}<div><h3>Awaiting your command</h3><p>Click a unit or drag to select your expedition.</p>${idleRow}</div></div>`
      : selectionStatus(S.sim,es);
    // Only touch the DOM when the panel text changed, so hover and text selection survive.
    if (infoHtml !== lastInfoHtml) {
      lastInfoHtml = infoHtml;
      $("selection-info").innerHTML = infoHtml;
    }
    $("support-order").hidden = !es.some(u => u.support);
    $("patrol-order").hidden = !es.some(u => u.kind === 'unit' && u.type !== 'worker' && u.damage > 0);
    $("attack-target-order").hidden = !es.some(u => u.type === 'worker');
    // Phones repair by tapping a damaged building; the button would add a row to the small dock.
    $("repair-order").hidden = document.documentElement.classList.contains('compact-ui') || !es.some(u => u.team === 0 && S.sim.canRepair(u));
    $("rally-order").hidden = !es.some(u => u.kind === 'building' && u.team === 0 && u.complete && u.trains?.length);
    // Desktop hides unit-only orders while only buildings are selected.
    document.documentElement.classList.toggle('no-units', !es.some(u => u.kind === 'unit'));
    document.documentElement.classList.toggle('many-orders', [...document.querySelectorAll('.order-buttons button')].filter(b => !b.hidden).length > 5);
    $("command-context").title = `Command core technology ${S.sim.techLevel()} / 3`;
    const signature = `${es.map((e) => e.id).join(",")}/${p.upgrade}/${p.plating}/${p.upgrade2}/${p.plating2}/${S.researchOpen}/${S.sim.own(0).filter((b) => b.queue?.some((q) => q.type === "upgrade" || q.type === "plating" || q.type === "upgrade2" || q.type === "plating2")).length}/${e?.level}/${S.sim.techLevel()}/${S.touchInput}/${document.documentElement.classList.contains("compact-ui")}/${sideDock.matches}`;
    if (S.lastSelectionKey !== signature) {
      S.lastSelectionKey = signature;
      $("unit-list").innerHTML =
        es.length > 1
          ? es
              .slice(0, 18)
              .map(
                (u) =>
                  `<button data-select="${u.id}" title="${u.name}">${hasPortrait(u.type) ? portrait(u.type, u.team === 0 ? "friendly" : "hostile") : icon(u.icon || u.type)}<i class="vitals"></i></button>`,
              )
              .join("") +
            (es.length > 18 ? `<span>+${es.length - 18}</span>` : "")
          : "";
      // A research that is only queued counts as chosen: the other branch is locked at once.
      const queued = (type) => S.sim.own(0).some((b) => b.queue?.some((q) => q.type === type));
      const wChosen = p.upgrade || queued("upgrade"), pChosen = p.plating || queued("plating");
      const actions =
        e && es.length === 1 && e.kind === "building"
          // Weapons and plating are exclusive branches sharing one slot: the "research" tile opens a
          // choice sheet (weapons, plating, back); once one is chosen the slot shows it and the other stays locked.
          ? e.team === 0 && e.trains?.includes("upgrade") && !wChosen && !pChosen && S.researchOpen
            ? ["upgrade", "plating", "back"]
            : (e.trains || []).filter((t) => t !== "plating" && t !== "upgrade2" && t !== "plating2").map((t) => t !== "upgrade" || e.team !== 0 ? t
              : wChosen || pChosen ? (pChosen && !wChosen ? "plating" : "upgrade") : "research")
              // The second tier of the chosen branch appears beside it once the first tier is done.
              .concat(e.team === 0 && e.trains?.includes("upgrade2") ? (p.upgrade && !p.upgrade2 ? ["upgrade2"] : p.plating && !p.plating2 ? ["plating2"] : []) : [])
          : es.some((u) => u.type === "worker")
            ? S.sim.buildable(0)
            : [];
      const structure = es.length === 1 && e?.kind === "building" && !e.trains;
      // Fighting units without a Harvester among them: abilities and stance take the card.
      const tactics = !actions.length && tacticalUnits(es).length
        ? tacticsCardHTML(S.sim, es, { compact: document.documentElement.classList.contains("compact-ui"), side: sideDock.matches, keys: !S.touchInput }) : "";
      $("commands").classList.toggle("tactics-card", !!tactics);
      $("command-label").textContent = es.some((u) => u.type === "worker")
        ? "CONSTRUCTION"
        : e?.trains
          ? "PRODUCTION"
          : structure ? "STRUCTURE" : "FIELD ORDERS";
      $("command-context").textContent = actions.includes("back")
        ? "CHOOSE ONE"
        : actions.length
        ? `${actions.length} AVAILABLE`
        : structure ? `LEVEL ${e.level}` : "TACTICAL";
      $("commands").innerHTML =
        actions
          .map((type, index) => {
            if (type === "research" || type === "back") {
              const open = type === "research";
              return `<button class="command-tile branch-tile" data-action="${type}" data-hotkey="${ACTION_KEYS[index]}" aria-label="${open ? "Research: choose one of two exclusive upgrades" : "Back"}" title="${ACTION_KEYS[index]} · ${open ? "Research · choose Overcharged weapons or Reinforced plating; the other is then locked" : "Back"}"><kbd class="action-key">${ACTION_KEYS[index]}</kbd>${icon(open ? "bolt" : "stop")}<span>${open ? "Research" : "Back"}</span>${open ? "<small>Choose one</small>" : ""}</button>`;
            }
            const d = D[type];
            const label = type === 'upgrade' ? 'Weapons +' : type === 'plating' ? 'Plating' : type === 'upgrade2' ? 'Weapons II' : type === 'plating2' ? 'Plating II' : d.name;
            return `<button class="command-tile" data-action="${type}" data-hotkey="${ACTION_KEYS[index]}" aria-label="${d.name}, ${d.cost[0]} alloy${d.cost[1] ? ` and ${d.cost[1]} energy` : ''}" title="${ACTION_KEYS[index]} · ${d.name} · ${d.description}${S.researchOpen && (type === "upgrade" || type === "plating") ? " Choosing it locks the other branch." : ""}"><kbd class="action-key">${ACTION_KEYS[index]}</kbd>${hasPortrait(type) ? portrait(type) : icon(d.icon || type)}<span>${label}</span><small><b class="alloy-text">${d.cost[0]}</b>${d.cost[1] ? ` <b class="energy-text">/ ${d.cost[1]}</b>` : ""}</small></button>`;
          })
          .join("") || tactics || (structure ? `<p class="structure-hint">${e.description}</p>` : e?.kind==='building' ? '' :
        `<div class="tactical-hint">${icon("crosshair")}<strong>${e ? "Control the battlefield" : "Your expedition is ready"}</strong><p>${e ? (S.touchInput ? "Open Selection for Move, Attack-move and Support orders, then tap a target on the battlefield." : "Right-click to move or engage.<br>Attack-move to advance and fight.") : "Select the Command core to train Harvesters, or the Barracks to grow your army."}</p></div>`);
      $("upgrade-actions").innerHTML = e?.kind === 'building' && es.length === 1 ?
        `<button data-level title="U · Upgrade building">${e.level < 3 ? `<span class="up-name">Upgrade L${e.level+1}</span><span class="up-cost"><span class="sep"> · </span>${S.sim.levelCost(e).join('/')}</span> <kbd>U</kbd>` : '<span class="up-name">Maximum level 3</span>'}</button>` : '';
      $("command-hint").textContent =
        e?.kind === "building"
          ? ''
          : es.some((u) => u.type === "worker")
            ? "Select a structure, then place it on clear terrain."
            : S.touchInput ? "Enable Queue to chain orders. Use Army or Box to select a group." : "Hold Shift to queue orders. Ctrl + 1–9 saves a group.";
    }
    for (const button of $("commands").querySelectorAll("[data-action]")) {
      const unavailable =
        !Z.started ||
        Z.paused ||
        S.sim.result;
      button.disabled = !!unavailable || (e?.kind==='building' && (!e.complete || !!e.levelJob));
    }
    // Ability cooldowns and the pressed stance, refreshed in place.
    if ($("commands").classList.contains("tactics-card")) {
      if (S.mode === "barrage") A.refreshAim(S.aimPoint);
      updateTacticsCard($("commands"), S.sim, es, { compact: document.documentElement.classList.contains("compact-ui"), side: sideDock.matches,
        blocked: !Z.started || Z.paused || !!S.sim.result, aiming: S.mode === "barrage" ? "barrage" : null });
    } else if (S.mode === "barrage") A.clearMode();
    // Live vitals on each roster card; the cards themselves are rebuilt only on selection change.
    for (const card of $("unit-list").querySelectorAll("[data-select]")) {
      const u = S.sim.get(Number(card.dataset.select));
      if (!u) continue;
      const hp = u.hp / u.maxHp;
      card.style.setProperty("--hp", hp.toFixed(3));
      card.style.setProperty("--sh", u.maxShield ? (u.shield / u.maxShield).toFixed(3) : "0");
      card.classList.toggle("critical", hp < 0.35);
      const rank = String(clampRank(u.rank));
      if (card.dataset.rank !== rank) card.dataset.rank = rank;
    }
    A.renderGroupStrip();
    // Desktop shares the selection queue; mobile retains a queue in each tab.
    A.productionUI.update(document.documentElement.classList.contains('compact-ui') && es.length===1?e:null, !Z.started || Z.paused || !!S.sim.result);
    A.selectionWorkUI.update(es.length===1?e:null, !Z.started || Z.paused || !!S.sim.result);
    const levelButton=$('upgrade-actions').querySelector('[data-level]');
    if(levelButton)levelButton.disabled=!Z.started||Z.paused||!!S.sim.result||!e.complete||!!e.levelJob||e.queue.length>0||e.level>=3;
    for (const b of document.querySelectorAll(".order-buttons button"))
      b.disabled = !Z.started || Z.paused || (!["field-guide", "rally-order"].includes(b.id) && !es.some((u) => u.kind === "unit"));
    for (const b of document.querySelectorAll(".touch-controls button"))
      b.disabled = !Z.started || Z.paused || !!S.sim.result;
    if (S.mode === "build" && S.buildPoint) {
      const error = S.sim.placement(S.buildType, 0, S.buildPoint.x, S.buildPoint.z);
      $("confirm-build").disabled = !!error || Z.paused || !Z.started;
      S.view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
    }
    A.constructionUI.update({sim: S.sim, selected:es, mode: S.mode, type:S.buildType, point:S.buildPoint, blockedType:S.blockedBuildType, failure:S.buildFailure, started: Z.started, paused: Z.paused, touch:S.touchInput});
  }

  // Training panel guards (the lesson card opens while the player is still tapping the battlefield).
  let pressedIn = null;
  // A press on a card button counts only when its pointer-down also began on that button. Without this,
  // a tap on a unit that completes a lesson raises the card under the finger (pointer-down is on the
  // battlefield), the click that ends the tap lands on "Focus target" and folds the card away again.
  // It only happens when the page is slow enough to lay the card out between pointer-down and the click.
  function trainingPress(event, button) {
    if (event.detail === 0) return true; // keyboard activation has no pointer
    return pressedIn === button;
  }
  // The panel must never sit on the lesson's target. When the marker is under it, it tries the other side,
  // the bottom of the battlefield and the opposite corner, and keeps the first spot that is clear. It looks
  // again only while it overlaps, and at most every 1.5 s, so it cannot flicker.
  function keepTargetClear() {
    const panel = $("training"), marker = $("training-marker");
    if (panel.hidden || marker.hidden) return;
    const m = marker.getBoundingClientRect();
    const covered = () => [$("training-toggle"), $("training-card")].some((e) => {
      if (!e.getClientRects().length) return false;
      const r = e.getBoundingClientRect();
      return m.right > r.left - 4 && m.left < r.right + 4 && m.bottom > r.top - 4 && m.top < r.bottom + 4;
    });
    if (!covered() || performance.now() - (S.trainingFlipAt || -Infinity) < 1500) return;
    S.trainingFlipAt = performance.now();
    const stage = $("stage").getBoundingClientRect(), world = $("world").getBoundingClientRect();
    const place = (x, y) => {
      panel.classList.toggle("flip-x", x);
      panel.classList.toggle("flip-y", y);
      panel.style.top = y ? Math.round(world.bottom - stage.top - panel.getBoundingClientRect().height - 8) + "px" : "";
    };
    for (const [x, y] of [[true, false], [false, true], [true, true]]) { place(x, y); if (!covered()) return; }
    place(false, false);
  }

  function renderTutorial(){
    const active=!!S.tutorial && Z.started && !S.tutorial.done && !S.sim.result;
    $("training").hidden=!active;$("training-marker").hidden=!active;
    document.documentElement.classList.toggle("in-training",active);
    if(!active)return;
    const step=S.tutorial.step;
    $("training-toggle").textContent=`Training ${S.tutorial.index+1}/${TRAINING_STEPS.length}`;
    $("training-title").textContent=step.title;
    $("training-copy").textContent=S.touchInput?step.touch:step.desktop;
    if(S.tutorialShown!==S.tutorial.index){
      S.tutorialShown=S.tutorial.index;
      $("training-card").hidden=false;$("training-toggle").setAttribute("aria-expanded","true");
    }
    if(S.view){
      const target=S.tutorial.point(S.sim),p=S.view.project(target.x,target.z,0.2);
      const canvas=S.view.renderer.domElement.getBoundingClientRect(),stage=$("stage").getBoundingClientRect();
      $("training-marker").style.left=(p.x+canvas.left-stage.left)+"px";
      $("training-marker").style.top=(p.y+canvas.top-stage.top)+"px";
      keepTargetClear();
    }
  }

  Object.assign(A, { notice, alert: alertNotice, clearMessages, dismissNotice, updateUI, dockTab, setObjectivesOpen, setLayout, formatTime, missionUI, renderTutorial });
  return function bind() {
    document.documentElement.classList.add("in-briefing");

    document.documentElement.dataset.dock = "selection";

    compactMedia.addEventListener("change", setLayout);

    window.addEventListener("resize", setLayout);

    setLayout();

    $("mission-toggle").onclick = () => setObjectivesOpen(!document.documentElement.classList.contains('objectives-open'));

    document.addEventListener('pointerdown', event => {
      if (document.documentElement.classList.contains('objectives-open') &&
          event.target instanceof Element && !event.target.closest('#mission-toggle, #mission-objectives')) setObjectivesOpen(false);
    });

    $("dock-tabs").onclick = (event) => {
      const button = event.target.closest("[data-dock]");
      if (button) { dockTab(button.dataset.dock); updateUI(); }
    };

    document.addEventListener("pointerdown",(event)=>{pressedIn=event.target instanceof Element?event.target.closest("#training-toggle, #training-focus"):null;},true);
    $("training-toggle").onclick=(event)=>{if(!trainingPress(event,$("training-toggle")))return;const card=$("training-card");card.hidden=!card.hidden;$("training-toggle").setAttribute("aria-expanded",String(!card.hidden));};

    $("training-focus").onclick=(event)=>{if(!S.tutorial||!trainingPress(event,$("training-focus")))return;const p=S.tutorial.point(S.sim);S.view.focusOn(p.x,p.z);$("training-card").hidden=true;$("training-toggle").setAttribute("aria-expanded","false");};

    $("training-exit").onclick=()=>{S.playMode="skirmish";A.newGame();};
  };
}
