// Layout, notices, the top bar and the selection / command panel refresh (updateUI), training panel, objectives toggle.
import { $ } from "./dom.js";
import { ACTION_KEYS } from "../hotkeys.js";
import { DEFINITIONS as D } from "../data.js";
import { buildSiteError } from "../build-reach.js";
import { TRAINING_STEPS } from "../tutorial.js";
import { createMissionUI } from "../mission-ui.js";
import { hasPortrait, portrait } from "../portraits.js";
import { icon } from "../icons.js";
import { roleIcon, isHealerGlyph } from "../role-icons.js";
import { selectionStatus } from "../selection-status.js";
import { tacticalUnits, clampRank } from "../tactics-ui.js";
import { tacticsCardHTML, updateTacticsCard } from "../tactics-card.js";
import { createMessageQueue, ROUTINE, ALERT } from "../message-queue.js";
import { productionTiles, researchState, flakTile, buildingUnits, trainsLine } from "../research-tiles.js";
import { updateBossBar } from "../boss-ui.js";
import { veteranNote } from "../sim/content/barracks-veterans.js";
import "../boss-ui.css";
import { AIR } from "../factions.js";
import { updateStewardStrip } from "../steward-ui.js";

// The flyer tiles' air line (AAA round 3, R3-W): flyers in the air and queued against the cap, and what the
// next Command core level allows (sim/air.js airCap, balance.json air.cap_by_level).
function airNote(sim, team) {
  const cap = sim.airCap(team), steps = AIR.cap_by_level || [], next = steps[steps.indexOf(cap) + 1];
  return `Air limit: ${sim.airCount(team)} of ${cap} flyers${next && steps.indexOf(cap) >= 0 ? `; ${next} with a level ${steps.indexOf(cap) + 2} Command core` : ""}`;
}
export function setupHud(S, A) {
  const Z = S.screen;
  // Story missions: briefing overlay, dialogue box, objectives list and debrief (mission-ui.js).
  const missionUI = createMissionUI({ stage: $("stage"), objectivesPanel: $("mission-objectives"), speak: (who, text, o) => S.audio?.say?.(who, text, o) || 0, hush: () => S.audio?.hushStory?.(), tone: (frequency, duration) => (frequency === 988 ? S.audio?.sfx.play("objective") : frequency === 196 ? S.audio?.sfx.play("objective-failed") : null) ?? A.tone(frequency, duration) });

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

  // Phones (owner, 2026-11-22): Selection and Actions are one context panel, so "actions" opens it too.
  function dockTab(name) {
    if (name === "actions") name = "selection";
    document.documentElement.dataset.dock = name;
    for (const button of $("dock-tabs").querySelectorAll("button"))
      button.setAttribute("aria-pressed", String(button.dataset.dock === name));
    const toggle = $("map-toggle"); // landscape phones: the minimap's own button replaces the Selection / Map tabs
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(name === "map"));
      toggle.setAttribute("aria-label", name === "map" ? "Shrink map" : "Enlarge map");
      toggle.title = toggle.getAttribute("aria-label");
    }
  }

  // The notice line (#notice): routine notices and alerts share it with a priority (message-queue.js).
  // An alert stays its full time; a routine notice that arrives meanwhile waits its turn.
  const messages = createMessageQueue();
  const NOTICE_SETTLE_MS = 2500;
  function showMessage() {
    const now = performance.now(), current = messages.update(now), el = $("notice");
    clearTimeout(S.noticeTimeout);
    clearTimeout(S.noticeSettle);
    el.classList.remove("settled");
    if (!current) { el.classList.remove("show"); return; }
    el.textContent = current.text;
    el.classList.toggle("warning", current.priority >= ALERT);
    el.classList.add("show");
    // W13: on phones a routine notice settles to one line on lighter glass once it has been read (phone-hud-slim.css);
    // an alert stays in full.
    if (current.priority < ALERT) S.noticeSettle = setTimeout(() => el.classList.add("settled"), NOTICE_SETTLE_MS);
    // Held (browser suites only, window.__frontier.holdMessages): the line waits until released.
    const expire = () => { if (globalThis.__frontierHoldMessages) S.noticeTimeout = setTimeout(expire, 100); else showMessage(); };
    S.noticeTimeout = setTimeout(expire, Math.max(0, current.until - now) + 16);
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

  const dock = document.querySelector(".bottom-dock"), tabs = $("dock-tabs");
  let coverDirty = true, cachedCrop = 0, measuredRootClass = null;
  const invalidateCover = () => {
    coverDirty = true;
    if (S.view) S.view.canvasRect = null;
  };
  const dockResize = new ResizeObserver(invalidateCover);
  for (const element of [dock, tabs, $("stage")]) dockResize.observe(element);
  const dockState = new MutationObserver(invalidateCover);
  for (const element of [document.documentElement, dock, tabs, dock.querySelector(".selection-panel")])
    dockState.observe(element, { attributes: true, attributeFilter: ["class", "hidden", "data-dock"] });
  window.addEventListener("resize", invalidateCover);
  window.addEventListener("scroll", invalidateCover, { passive: true, capture: true });

  function coverFollowsDock() {
    const view = S.view;
    if (!view?.setCoverCrop || Z.modalType === "scene") return;
    if (!(view.cover > 0)) { view.setCoverOpen(true); return; }
    // updateUI may have just toggled dock-actions, before MutationObserver runs.
    const rootClass = document.documentElement.className;
    if (coverDirty || measuredRootClass !== rootClass) {
      measuredRootClass = rootClass;
      const canvas = view.renderer.domElement.getBoundingClientRect();
      view.canvasRect = canvas;
      const panel = dock.getBoundingClientRect(), strip = tabs.getBoundingClientRect();
      const top = Math.min(strip.height ? strip.top : canvas.bottom, panel.height > 1 ? panel.top : canvas.bottom);
      // Floating controls can expose playable terrain between buttons anywhere in the dock.
      const floating = getComputedStyle(dock).getPropertyValue("--floating-controls").trim() === "1";
      cachedCrop = floating ? 0 : Math.max(0, Math.round(canvas.bottom - top));
      coverDirty = false;
    }
    view.setCoverCrop(cachedCrop);
    view.setCoverOpen(cachedCrop > 0);
  }

  let lastInfoHtml = null;
  // A unit roster wider than its row fades out at the right edge (more to scroll) instead of
  // ending in a portrait cut in half; the fade goes once the row is scrolled to its end.
  // The phone context panel's action row (#commands) fades the same way when it scrolls sideways.
  function rosterFade() {
    for (const list of [$("unit-list"), $("commands")]) {
      if (!list) continue;
      if (!list.dataset.fadeBound) { list.dataset.fadeBound = "1"; list.addEventListener("scroll", rosterFade, { passive: true }); }
      list.classList.toggle("more-right", list.scrollLeft + list.clientWidth < list.scrollWidth - 2);
    }
  }

  function updateUI() {
    renderTutorial();
    missionUI.renderObjectives(S.sim);
    updateBossBar(S.sim, Z.started);
    updateStewardStrip(S.sim, Z.started);
    const p = S.sim.players[0],
      pop = S.sim.population(0);
    $("alloy").textContent = Math.floor(p.alloy).toLocaleString();
    $("energy").textContent = Math.floor(p.energy).toLocaleString();
    // A mission with no supply source (no Command core or relay, e.g. m08's strike team) has a cap of 0:
    // show the head count alone instead of "20 / 0", and never flag it as full.
    $("population").innerHTML =
      `${pop.used}${pop.reserved ? `<span class="reserved">+${pop.reserved}</span>` : ""}${pop.cap > 0 ? ` <em>/ ${pop.cap}</em>` : ""}`;
    $("population").classList.toggle(
      "at-cap",
      pop.cap > 0 && pop.used + pop.reserved >= pop.cap,
    );
    // A fast match says so beside the clock (Settings → Game speed, Shift+Space); Defence has its bar button.
    const speed = S.sim.defence ? 1 : A.getSpeed?.() ?? 1;
    $("clock").textContent = speed > 1 ? `${formatTime(S.sim.time)} ×${speed}` : formatTime(S.sim.time);
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
    // Two rows of orders on phones: 6 sit as 3 + 3 (was 4 + 2), 7 or 8 as four columns.
    const orderCount = [...document.querySelectorAll('.order-buttons > button')].filter(b => !b.hidden).length;
    document.documentElement.classList.toggle('many-orders', orderCount > 5);
    document.documentElement.classList.toggle('wide-orders', orderCount > 6);
    $("command-context").title = `Command core technology ${S.sim.techLevel()} / 3`;
    const hasCore = S.sim.own(0).some((b) => b.type === "hq");
    const signature = `${hasCore}/${es.map((e) => e.id).join(",")}/${p.doctrine ? JSON.stringify(p.doctrine) : ""}${p.doctrine2 ? JSON.stringify(p.doctrine2) : ""}/${p.upgrade}/${p.plating}/${p.upgrade2}/${p.plating2}/${p.flak}/${S.researchOpen}/${S.sim.own(0).filter((b) => b.queue?.some((q) => q.type === "upgrade" || q.type === "plating" || q.type === "upgrade2" || q.type === "plating2" || q.type === "flak")).length}/${e?.level}/${S.sim.techLevel()}/${S.touchInput}/${document.documentElement.classList.contains("compact-ui")}/${sideDock.matches}/${e?.trains?.some((k) => D[k]?.flying) ? `${S.sim.airCount(0)}:${S.sim.airCap(0)}` : ""}/${S.sim.unlocks?.[0]?.length || 0}`;
    if (S.lastSelectionKey !== signature) {
      S.lastSelectionKey = signature;
      // Phones: a bold role glyph instead of the 3D portrait, which is unreadable at roster size (role-icons.js).
      const phone = document.documentElement.classList.contains("compact-ui");
      const roleArt = (type, extra = "") => icon(roleIcon(type), `role-icon${isHealerGlyph(type) ? " role-medic" : ""}${extra}`);
      $("unit-list").innerHTML =
        es.length > 1
          ? es
              .slice(0, 18)
              .map(
                (u) =>
                  `<button data-select="${u.id}" title="${u.name}">${phone && u.kind === "unit" ? roleArt(u.type, u.team === 0 ? "" : " hostile") : hasPortrait(u.type) ? portrait(u.type, u.team === 0 ? "friendly" : "hostile") : icon(u.icon || u.type)}<i class="vitals"></i></button>`,
              )
              .join("") +
            (es.length > 18 ? `<span>+${es.length - 18}</span>` : "")
          : "";
      requestAnimationFrame(rosterFade);
      // Production tiles with their state (research-tiles.js): research is one slot that moves forward
      // (pick a branch, research it, tier II, done); locked tiles name the building level they need.
      const production = e && es.length === 1 && e.kind === "building" ? productionTiles(S.sim, e, { choosing: S.researchOpen }) : null;
      const tiles = production ? production.tiles
        : es.some((u) => u.type === "worker") ? S.sim.buildable(0).map((type) => ({ type, action: type, label: D[type].name, state: "ready", units: buildingUnits(S.sim, type) })) : [];
      // Build menu on phones (owner, 2026-11-25): each building tile shows the units it trains standing at its foot,
      // as the role glyphs of that building's own train tiles (inline SVG: nothing to download); units that need a
      // higher building level are dimmed with the level. Up to four; more show three and "+N". The PC console keeps
      // its fixed tile height, so there the list is in the tooltip and the accessible name only.
      const unitStrip = (units) => {
        if (!phone || !units?.length) return "";
        const shown = units.length > 4 ? units.slice(0, 3) : units;
        return `<span class="tile-units" aria-hidden="true">${shown.map((u) => `<i class="tile-unit${u.level > 1 ? " needs-level" : ""}" data-unit="${u.type}">${roleArt(u.type)}${u.level > 1 ? `<b translate="no">${u.level}</b>` : ""}</i>`).join("")}${units.length > shown.length ? `<b class="tile-units-more" translate="no">+${units.length - shown.length}</b>` : ""}</span>`;
      };
      $("commands").classList.toggle("with-units", phone && tiles.some((t) => t.units?.length));
      const actions = tiles.map((t) => t.action);
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
      const ready = tiles.filter((t) => t.state === "ready" && t.action !== "back").length;
      $("command-context").textContent = production?.choosing
        ? "PICK ONE FOR THIS MATCH"
        : actions.length
        ? `${ready} AVAILABLE`
        : structure ? `LEVEL ${e.level}` : "TACTICAL";
      // Portrait phones: the doctrine pair sits in the order row beside Rally (wide, with its words), so the one row of training tiles keeps every tile in view.
      const portraitPhone = phone && !sideDock.matches, cardTiles = portraitPhone ? tiles.filter((t) => !t.doctrine) : tiles;
      // There the locked pair (below level 2) stays off the row, which it would share with the production queue for the whole early game.
      // A ready pair takes the row on its own (W7: the second tier's pair stands in for the first pick's done tile there until it is chosen).
      const rowTiles = portraitPhone ? tiles.filter((t) => t.doctrine && t.state !== "locked") : [], readyPair = rowTiles.filter((t) => t.state === "ready");
      const row = doctrineRow(), rowHtml = (readyPair.length ? readyPair : rowTiles).map((t) => doctrineTileHTML(t, null)).join(readyPair.length ? `<i class="doctrine-or-sep" aria-hidden="true">or</i>` : "");
      row.innerHTML = rowHtml;
      row.hidden = !rowHtml;
      $("commands").innerHTML =
        cardTiles
          .map((t, index) => {
            const key = ACTION_KEYS[index];
            if (t.action === "research" || t.action === "back") {
              const open = t.action === "research";
              return `<button class="command-tile branch-tile" data-action="${t.action}" data-state="ready" data-hotkey="${key}" aria-label="${open ? "Research: pick one of two upgrades for this match" : "Back"}" title="${key} · ${open ? "Research · pick Damage +10% or Armor +12% for this match; the other branch then stays locked" : "Back"}"><kbd class="action-key">${key}</kbd>${icon(open ? "research" : "stop")}<span>${open ? "Research" : "Back"}</span>${open ? `<small>${t.sub}</small>` : ""}</button>`;
            }
            if (t.doctrine) return doctrineTileHTML(t, key);
            const d = D[t.type], price = S.sim.trainCost(0, t.type); // your price (balance.json player_cost: the Kite)
            const cost = `<b class="alloy-text">${price[0]}</b>${price[1] ? ` <b class="energy-text">/ ${price[1]}</b>` : ""}`;
            // Done and researching tiles never show a price; locked tiles show what they need.
            const sub = t.state === "done" ? `<small class="tile-state">✓ ${t.sub}</small>` : t.sub ? `<small class="tile-state">${t.sub}</small>` : `<small>${t.next ? `${t.next}: ` : ""}${cost}</small>`;
            const lockNote = t.choice ? " Choosing it locks the other branch for this match." : t.state === "locked" ? ` ${t.sub}.` : "";
            const priced = t.state === "ready" || t.state === "locked" ? `, ${price[0]} alloy${price[1] ? ` and ${price[1]} energy` : ""}` : `, ${t.sub}`;
            // A sixth tile (a faction's own building in the build menu) has no letter left: click or tap it.
            const cat = t.research ? "upgrade" : d.kind === "building" ? "build" : d.kind === "unit" ? "train" : "upgrade";
            return `<button class="command-tile cat-${cat}${t.research ? " research-tile" : ""}${t.partial ? " partial" : ""} state-${t.state}" data-action="${t.action}" data-state="${t.state}"${price !== d.cost ? ` data-cost="${price.join(",")}"` : ""}${key ? ` data-hotkey="${key}"` : ""}${t.state === "busy" ? ` style="--p:${(t.progress || 0).toFixed(3)}"` : ""} aria-label="${t.label}${priced}${t.units?.length ? ` · ${trainsLine(t.units)}` : ""}" title="${key ? `${key} · ` : ""}${d.name} · ${d.description}${lockNote}${d.flying ? ` · ${airNote(S.sim, 0)}` : ""}${t.units?.length ? ` · ${trainsLine(t.units)}` : ""}">${key ? `<kbd class="action-key">${key}</kbd>` : ""}${phone && d.kind === "unit" ? roleArt(t.type) : hasPortrait(t.type) ? portrait(t.type) : icon(roleIcon(t.type))}<span>${t.label === "Anti-tank soldier" ? "Anti-tank" : t.label}</span>${sub}${d.kind === "building" && d.icon ? `<i class="tile-badge" aria-hidden="true">${icon(d.icon)}</i>` : ""}${unitStrip(t.units)}</button>`; // the long name keeps its full text in the tooltip; buildings carry their own symbol as a badge (the pictures look alike at phone size)
          })
          .join("") || tactics || (structure ? `<p class="structure-hint">${e.description}</p>` : e?.kind==='building' ? '' :
        `<div class="tactical-hint">${icon("crosshair")}<strong>${e ? "Control the battlefield" : hasCore ? "Your expedition is ready" : "Your Command core is down"}</strong><p>${e ? (S.touchInput ? "Open Selection for Move, Attack-move and Support orders, then tap a target on the battlefield." : "Right-click to move or engage.<br>Attack-move to advance and fight.") : hasCore ? "Select the Command core to train Harvesters, or the Barracks to grow your army." : "Gather your remaining forces and hold on."}</p></div>`);
      $("upgrade-actions").innerHTML = e?.kind === 'building' && es.length === 1 ?
        `<button data-level title="U · Upgrade building">${e.level < 3 ? `<span class="up-name">Upgrade to L${e.level+1}</span><span class="up-cost"><span class="sep"> · </span>${S.sim.levelCost(e).join('/')}</span> <kbd>U</kbd>` : '<span class="up-name">Maximum level 3</span>'}</button>` : '';
      $("command-hint").textContent =
        e?.kind === "building"
          ? veteranNote(S.sim, e)
          : es.some((u) => u.type === "worker")
            ? "Select a structure, then place it on clear terrain."
            : S.touchInput ? "Enable Queue to chain orders. Use Army or Box to select a group." : "Hold Shift to queue orders. Ctrl + 1–9 saves a group.";
    }
    // Phones: the context panel adds its row of actions (tiles, abilities, stance, level-up) when the selection
    // has any; the unit roster then folds into the count in the heading (owner, 2026-11-22).
    document.documentElement.classList.toggle("dock-actions", !!$("commands").querySelector("button") || !!$("upgrade-actions").querySelector("button"));
    coverFollowsDock();
    if ($("commands").dataset.fadeKey !== S.lastSelectionKey) { $("commands").dataset.fadeKey = S.lastSelectionKey; requestAnimationFrame(rosterFade); }
    for (const button of document.querySelectorAll("#commands [data-action], #doctrine-row [data-action]")) {
      const unavailable =
        !Z.started ||
        Z.paused ||
        S.sim.result;
      button.disabled = !!unavailable || (e?.kind==='building' && (!e.complete || !!e.levelJob)) || button.dataset.state === "busy" || button.dataset.state === "done";
      // Can't afford (HUD contrast, 2026-11-24): the tile stays tappable; the short resource is marked.
      const cost = button.dataset.state === "ready" && (button.dataset.cost ? button.dataset.cost.split(",").map(Number) : D[button.dataset.action]?.cost), p = S.sim.players[0];
      const shortA = !!cost && p.alloy < cost[0], shortE = !!cost && p.energy < (cost[1] || 0);
      button.classList.toggle("poor", shortA || shortE);
      button.classList.toggle("short-alloy", shortA);
      button.classList.toggle("short-energy", shortE);
    }
    // A research in progress counts up on its tile.
    const busy = $("commands").querySelector('[data-state="busy"]');
    if (busy) {
      // Flak (Command core) counts up on its own; the Foundry branch below.
      const flak = busy.dataset.action === "flak" && e ? flakTile(S.sim, e) : null, small = busy.querySelector("small");
      const r = flak ? { ...flak, waiting: flak.sub === "Waiting in queue" } : researchState(S.sim, 0);
      if (r.type !== busy.dataset.action) r.state = null;
      if (r.state === "busy") {
        busy.style.setProperty("--p", r.progress.toFixed(3));
        const text = r.waiting ? "Waiting in queue" : `Researching ${Math.round(r.progress * 100)}%`;
        if (small && small.dataset.text !== text) { small.dataset.text = text; small.textContent = text; }
      }
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
    A.updateChips?.();
    // Desktop shares the selection queue; mobile retains a queue in each tab.
    A.productionUI.update(document.documentElement.classList.contains('compact-ui') && es.length===1?e:null, !Z.started || Z.paused || !!S.sim.result);
    A.selectionWorkUI.update(es.length===1?e:null, !Z.started || Z.paused || !!S.sim.result);
    const levelButton=$('upgrade-actions').querySelector('[data-level]');
    if(levelButton)levelButton.disabled=!Z.started||Z.paused||!!S.sim.result||!e.complete||!!e.levelJob||e.queue.length>0||e.level>=3;
    for (const b of document.querySelectorAll(".order-buttons > button"))
      b.disabled = !Z.started || Z.paused || (!["field-guide", "rally-order"].includes(b.id) && !es.some((u) => u.kind === "unit"));
    for (const b of document.querySelectorAll(".touch-controls button"))
      b.disabled = !Z.started || Z.paused || !!S.sim.result;
    if (S.mode === "build" && S.buildPoint) {
      const error = buildSiteError(S.sim, S.buildType, S.buildPoint.x, S.buildPoint.z, es);
      $("confirm-build").disabled = !!error || Z.paused || !Z.started;
      S.view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
    }
    A.constructionUI.update({sim: S.sim, selected:es, mode: S.mode, type:S.buildType, point:S.buildPoint, blockedType:S.blockedBuildType, failure:S.buildFailure || (S.buildPoint ? '' : S.buildHoverError || ''), started: Z.started, paused: Z.paused, touch:S.touchInput});
    // Frontier Defence takes over the command card with its pad and tower sheets (app/defence-entry.js).
    A.defenceHud?.(es);
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

    // The phone touch row (owner, 2026-11-21): Army, Workers, Box select, Queue orders, Clear selection and
    // Info & stats, each one tap in one row under the top bar; no "…" sheet.
    $("touch-guide").onclick = () => { const e = A.selectedEntities()[0]; A.showGuide(e?.type, e?.team); };

    document.addEventListener('pointerdown', event => {
      if (document.documentElement.classList.contains('objectives-open') &&
          event.target instanceof Element && !event.target.closest('#mission-toggle, #mission-objectives')) setObjectivesOpen(false);
    });

    $("map-toggle").onclick = () => { dockTab(document.documentElement.dataset.dock === "map" ? "selection" : "map"); updateUI(); };
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

// Doctrines (research-tiles.js doctrineTiles): both options side by side, an "or" between them; one tap picks.
function doctrineTileHTML(t, key) {
  const [ca, ce] = t.cost, price = `<b class="alloy-text">${ca}</b>${ce ? ` <b class="energy-text">/ ${ce}</b>` : ""}`;
  const sub = t.state === "done" ? `<small class="tile-state"><i aria-hidden="true">✓</i> ${t.sub}</small>` : t.sub ? `<small class="tile-state">${t.sub}</small>` : `<small>${price}</small>`;
  const priced = t.state === "done" ? t.sub : `${ca} alloy and ${ce} energy`;
  const note = (t.state === "done" ? "Chosen for this match." : t.state === "locked" ? `${t.sub}.` : "Pick one for this match: the other then stays locked.") + (t.next ? ` · ${t.next}` : "") + (t.after ? ` · Second doctrine, after ${t.after}.` : "");
  return `<button class="command-tile cat-upgrade research-tile doctrine-tile state-${t.state}${t.pair === 1 ? " doctrine-second" : ""}${t.tier === 2 && t.state === "done" ? " doctrine-follow" : ""}" data-action="doctrine" data-pick="${t.pick}" data-state="${t.state}" data-cost="${ca},${ce}"${key ? ` data-hotkey="${key}"` : ""} aria-label="${t.name} · ${t.label} · ${priced}" title="${key ? `${key} · ` : ""}${t.name} · ${t.description} · ${note}">${key ? `<kbd class="action-key">${key}</kbd>` : ""}${icon(t.icon)}<span>${t.label}</span>${sub}${t.pair === 1 ? `<i class="doctrine-or" aria-hidden="true">or</i>` : ""}</button>`;
}
// The portrait phones' home for the doctrine pair: a row inside the order buttons, made once.
function doctrineRow() {
  let row = document.getElementById("doctrine-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "doctrine-row";
    row.className = "doctrine-row";
    row.hidden = true;
    // A tap goes through the command card's own handler (app/command-card.js), as a tile there would.
    row.addEventListener("click", (event) => { const button = event.target.closest("[data-action]"); if (button && !button.disabled) document.getElementById("commands").onclick?.({ target: button }); });
    document.querySelector(".order-buttons")?.append(row);
  }
  return row;
}