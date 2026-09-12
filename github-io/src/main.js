import "./style.css";
import "./mobile.css";
import "./settings.css";
import "./start-screen.css";
import "./desktop-dock.css";
import "./hud-readability.css";
import { loadSettings, saveSettings, palette } from "./settings.js";
import { SettingsUI } from "./settings-ui.js";
import { MAPS, SURFACES } from "./terrain.js";
import { Ambience } from "./ambience.js";
import { createFieldGuide } from "./field-guide.js";
import { Simulation } from "./simulation.js";
import { WorldView } from "./view.js";
import {
  DEFINITIONS as D,
  BUILDINGS,
  GRID,
  HALF,
  MAP_SIZE,
  ROCKS,
  distance,
} from "./data.js";
import { icon } from "./icons.js";
import { TouchControls } from "./touch-controls.js";
import { ACTION_KEYS, HOTKEYS, HOTKEY_HELP, physicalKey } from "./hotkeys.js";
import { createConstructionUI } from "./construction-ui.js";
import { createProductionUI, createWorkStrip } from "./production-ui.js";
import { selectionStatus } from "./selection-status.js";

document.querySelector("#app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Frontier Command home"><span class="brand-mark">${icon("logo")}</span><span>FRONTIER<span class="brand-sub">C O M M A N D</span></span></a>
    <div class="resource-bar" aria-label="Resources">
      <div class="resource alloy" title="Alloy — harvested from amber deposits">${icon("alloy")}<span><strong id="alloy">450</strong><small>ALLOY</small></span></div>
      <div class="resource energy" title="Energy — harvested from blue deposits">${icon("energy")}<span><strong id="energy">150</strong><small>ENERGY</small></span></div>
      <div class="resource population" title="Used + queued population / capacity">${icon("people")}<span><strong id="population">7 <em>/ 15</em></strong><small>POPULATION</small></span></div>
    </div>
    <div class="top-actions"><span id="clock">00:00</span><button id="audio" class="icon-button" title="Mute sound" aria-label="Mute sound">${icon("volume")}</button><button id="help" class="icon-button" title="Controls" aria-label="Show controls">${icon("help")}</button><button id="pause" class="icon-button" title="Pause · Space" aria-label="Pause game">${icon("pause")}</button></div>
  </header>
  <main id="stage">
    <div id="world"></div>
    <details class="pc-shortcuts" id="pc-shortcuts"><summary>PC commands & selection <kbd>?</kbd></summary><div class="shortcut-list">${HOTKEYS.map(k=>`<button data-shortcut="${k.id}" title="${k.label} · ${k.key}"><span>${k.label}</span><kbd>${k.key}</kbd></button>`).join('')}</div><div class="control-group-buttons">${Array.from({length:9},(_,i)=>`<button data-group="${i+1}" title="Group ${i+1}: click to recall, Ctrl-click to assign, Shift-click to add">${i+1}</button>`).join('')}</div><p class="group-help">Ctrl + number saves · Shift + number adds<br>Number recalls · twice focuses</p></details>
    <div class="map-heading"><span class="eyebrow"><i class="live-dot"></i> OPERATION 01 / SKIRMISH</span><h1>Outpost Meridian<span>.</span></h1><p>THE ASHEN FRONTIER <span>·</span> SECTOR 07</p></div>
    <button id="mission-toggle" aria-expanded="false" aria-controls="mission-objectives">${icon("flag")} Objectives</button>
    <aside id="mission-objectives" class="mission panel" aria-label="Mission objectives"><div class="panel-label">MISSION OBJECTIVES <span>01—03</span></div><div class="objective" id="obj-economy"><span class="objective-num">01</span><span>Establish your economy<small>Assign Harvesters to resources</small></span></div><div class="objective" id="obj-army"><span class="objective-num">02</span><span>Mobilize a strike force<small>Field 8 combat units</small></span></div><div class="objective" id="obj-win"><span class="objective-num">03</span><span>Break their command<small>Destroy all enemy Command cores</small></span></div></aside>
    <div class="sector-status"><span class="eyebrow">TACTICAL UPLINK</span><span><i class="live-dot"></i> <span id="uplink">STANDBY</span></span></div>
    <div id="notice" role="status" aria-live="polite"></div>
    <div id="mode-banner" hidden></div>
    <div id="mode-controls" hidden><button id="confirm-build" hidden disabled>Build here</button><button id="cancel-mode">Cancel</button></div>
    <nav class="touch-controls" aria-label="Touch battlefield controls">
      <button id="select-workers" title="Select all Harvesters">${icon("worker")}<span>Workers</span></button>
      <button id="select-army" title="Select all combat units">${icon("people")}<span>Army</span></button>
      <button id="box-select" aria-pressed="false">${icon("expand")}<span>Box</span></button>
      <button id="queue-orders" aria-pressed="false">${icon("flag")}<span>Queue</span></button>
      <button id="clear-selection" aria-label="Clear selection">${icon("close")}</button>
      <button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button>
    </nav>
    <div id="selection-box"></div>
    <div id="hover-label" hidden></div>
    <section id="briefing" class="briefing panel">
      <div class="briefing-copy">
      <div class="eyebrow">EXPEDITION BRIEFING</div><div class="briefing-emblem">${icon("logo")}</div>
      <h2>A new frontier.<br> A foothold to defend.</h2>
      <p>Build your outpost. Harvest the valley. Lead your expedition against rival commanders. With multiple enemies, every faction fights for itself.</p>
      <div class="briefing-rule"><span>YOUR FORCE</span><strong>4 Harvesters · 3 defenders</strong></div>
      <div class="briefing-rule"><span>OBJECTIVE</span><strong>Eliminate enemy command</strong></div>
      </div>
      <button id="start" class="primary" disabled>Preparing expedition…</button>
      <div class="briefing-setup"><div class="briefing-tools"><select id="scenario" aria-label="Battlefield">${["riverlands", ...Object.keys(MAPS).filter(id => id !== "riverlands")].map(id => `<option value="${id}">${MAPS[id]}</option>`).join("")}</select><select id="enemy-count" aria-label="Number of AI enemies"><option value="1">1 AI enemy</option><option value="2">2 AI enemies · FFA</option><option value="3">3 AI enemies · FFA</option></select><button id="briefing-settings">Settings</button></div><small class="briefing-note">SINGLE PLAYER <span>·</span> MOUSE + KEYBOARD</small></div>
    </section>
    <div class="bottom-dock">
      <section class="minimap-panel panel"><div class="panel-label">SECTOR OVERVIEW <button id="home" title="Focus base · H" aria-label="Focus base">${icon("hq")}</button></div><canvas id="minimap" width="240" height="200" aria-label="Minimap: click to pan; right-click to command"></canvas><div class="map-legend"><span><i class="friendly"></i>YOU</span><span><i class="hostile"></i>ENEMY</span><span><i class="deposit"></i>RESOURCE</span></div></section>
      <div class="command-deck">
      <section class="selection-panel panel"><div class="panel-label"><span id="selection-label">EXPEDITION COMMAND</span><span id="selection-count">READY</span></div><div id="selection-info"></div><div class="selection-scroll"><div id="unit-list"></div></div><div id="queue"></div><div class="order-buttons"><button id="field-guide">Info & stats</button><button id="support-order" hidden>Support</button><button id="move-order" title="Click a destination">${icon("move")} Move</button><button id="attack-order" title="Attack-move · F">${icon("crosshair")} Attack-move <kbd>F</kbd></button><button id="stop-order" title="Stop · X">${icon("stop")} Stop <kbd>X</kbd></button></div></section>
      <section class="command-panel panel"><div class="panel-label"><span id="command-label">COMMAND CENTER</span><span id="command-context">ACTIONS</span></div><div id="commands"></div><div id="upgrade-actions" class="upgrade-actions"></div><div id="command-hint">Select a unit or structure to issue commands.</div></section>
      </div>
    </div>
    <nav id="dock-tabs" aria-label="Command panels"><button data-dock="selection" aria-pressed="true">${icon("people")} Selection</button><button data-dock="actions" aria-pressed="false">${icon("worker")} Actions</button><button data-dock="map" aria-pressed="false">${icon("flag")} Map</button></nav>
    <div class="statusbar"><span><i class="live-dot"></i> <span id="status-text">EXPEDITION SYSTEMS INITIALIZING</span></span><span>WASD pan <b>·</b> Scroll zoom <b>·</b> Right-click command <b>·</b> <button id="controls-link">? Controls</button></span><span id="fps">— FPS</span></div>
  </main>
  <div id="modal" class="modal-backdrop" hidden><section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-content"></div></section></div>
`;

const $ = (id) => document.getElementById(id);
let settings = loadSettings(matchMedia("(pointer:coarse)").matches),
  mapId = "riverlands",
  enemyCount = 1,
  ambience;
let sim = new Simulation({ map: mapId, enemyCount }),
  view,
  selected = new Set(),
  hover = null,
  started = false,
  paused = false,
  mode = null,
  buildType = null,
  muted = settings.muted;
let uiClock = 0,
  timePrevious = performance.now(),
  accumulator = 0,
  frameCount = 0,
  frameTime = 0,
  noticeTimeout,
  audioContext,
  lastTone = 0;
let pointer = { x: 0, y: 0, inside: false },
  drag = null,
  keys = new Set(),
  groups = new Map(),
  rememberedBuildings = new Map(),
  rememberedResources = new Map(),
  lastSelectionKey = "",
  modalType = null;
const milestones = { economy: false, army: false };
let touchInput = matchMedia("(pointer: coarse)").matches,
  touchControls,
  boxSelection = false,
  queueOrders = false,
  buildPoint = null,
  blockedBuildType = null,
  buildFailure = '';
const compactMedia = matchMedia("(max-width: 1000px), (max-height: 650px)");
const workCallbacks={getSim:()=>sim,canAct:()=>started&&!paused&&!sim.result,refresh:updateUI};
const productionUI=createProductionUI(D,workCallbacks);
const selectionWorkUI=createWorkStrip(document.querySelector('#queue'),D,workCallbacks);
document
  .querySelector(".top-actions")
  .insertAdjacentHTML(
    "afterbegin",
    '<button id="quality" class="icon-button quality-button" aria-label="Toggle graphics quality" title="Toggle graphics quality">Eco</button>',
  );
document.documentElement.classList.add("in-briefing");
document.documentElement.dataset.dock = "selection";
function setObjectivesOpen(open) {
  document.documentElement.classList.toggle('objectives-open', open);
  $('mission-toggle').setAttribute('aria-expanded', String(open));
}
function setLayout() {
  document.documentElement.classList.toggle(
    "compact-ui",
    compactMedia.matches || touchInput,
  );
  document.documentElement.classList.toggle("touch-ui", touchInput);
  if (!document.documentElement.classList.contains('compact-ui')) setObjectivesOpen(false);
  touchControls?.reset();
  drag = null;
  pointer.inside = false;
  $("selection-box").style.display = "none";
  if (view) updateUI();
  requestAnimationFrame(() => view?.resize());
}
compactMedia.addEventListener("change", setLayout);
window.addEventListener("resize", setLayout);
setLayout();
function dockTab(name) {
  document.documentElement.dataset.dock = name;
  for (const button of $("dock-tabs").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.dock === name));
}

function tone(frequency = 520, duration = 0.065) {
  if (
    muted ||
    settings.masterVolume <= 0 ||
    !audioContext ||
    performance.now() - lastTone < 70
  )
    return;
  lastTone = performance.now();
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(
    Math.max(0.0001, 0.05 * settings.masterVolume),
    audioContext.currentTime,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration,
  );
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}
function unlockAudio() {
  try {
    audioContext ||= new AudioContext();
    ambience ||= new Ambience(audioContext);
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    /* Audio is optional. */
  }
}
function notice(text) {
  // Successful work is acknowledged by its compact strip, without covering the map.
  if (Object.values(D).some(d=>text===`${d.name} queued.`||text===`${d.name} construction started.`||[2,3].some(level=>text===`${d.name} upgrading to level ${level}.`))) {
    clearTimeout(noticeTimeout); $('notice').classList.remove('show'); return;
  }
  $("notice").textContent = text;
  $("notice").classList.add("show");
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => $("notice").classList.remove("show"), 4500);
}
function selectedEntities() {
  return [...selected].map((id) => sim.get(id)).filter((e) => e?.team === 0);
}
function setSelection(ids) {
  clearMode();
  selected = new Set(ids);
  lastSelectionKey = "";
  updateUI();
  if (document.documentElement.classList.contains("compact-ui")) {
    const es = selectedEntities();
    dockTab(
      es.length === 1 && (es[0].trains || es[0].type === "worker" || (es[0].kind === 'building' && !es[0].complete))
        ? "actions"
        : "selection",
    );
  }
  tone(650);
}
function clearMode() {
  if (document.documentElement.classList.contains('construction-notice-repeated')) {
    $('notice').classList.remove('show');
    clearTimeout(noticeTimeout);
  }
  mode = null;
  buildType = null;
  buildPoint = null;
  blockedBuildType = null;
  buildFailure = '';
  $("mode-controls").hidden = true;
  $("confirm-build").hidden = true;
  if (view) view.preview.visible = false;
  $("mode-banner").hidden = true;
  $("world").classList.remove("targeting");
}
function enterMode(type) {
  if (!started || paused || sim.result) return;
  if (['patrol', 'attack'].includes(type) && !selectedEntities().some(e => e.kind === 'unit' && e.damage > 0 && (type !== 'patrol' || e.type !== 'worker'))) {
    notice(type === 'patrol' ? 'Select soldiers or tanks to patrol.' : 'Select a Harvester or combat unit to attack.');
    return;
  }
  if (!selectedEntities().some((e) => type === 'rally' ? e.kind === 'building' && e.complete && e.trains?.length : e.kind === 'unit')) {
    notice(type === 'rally' ? "Select a completed production building first." : "Select units first.");
    return;
  }
  clearMode();
  mode = type;
  $("mode-banner").hidden = false;
  $("mode-banner").textContent =
    type === "attackmove"
      ? "ATTACK-MOVE · Click a destination · Esc to cancel"
      : "MOVE · Click a destination · Esc to cancel";
  if (touchInput)
    $("mode-banner").textContent =
      `${type === "attackmove" ? "ATTACK-MOVE" : "MOVE"} · Tap your destination`;
  $("mode-controls").hidden = false;
  if (type === "support") $("mode-banner").textContent = "SUPPORT · Choose friendly infantry (Medic) or a building / vehicle (Engineer)";
  if (type === "context") $("mode-banner").textContent = "CONTEXT ORDER · Choose a deposit, enemy or friendly construction site";
  if (type === "rally") $("mode-banner").textContent = "RALLY POINT · Choose a destination for newly trained units";
  if (type === 'patrol') $("mode-banner").textContent = 'PATROL · Choose the other end of a repeating route';
  if (type === 'attack') $("mode-banner").textContent = 'ATTACK · Choose a visible enemy unit or building';
  $("notice").classList.remove('show');
  $("world").classList.add("targeting");
}
function enterBuild(type) {
  if (!started || paused || sim.result) return;
  if (!selectedEntities().some((e) => e.type === "worker")) {
    notice("Select a Harvester to construct a building.");
    return;
  }
  const missing = sim.constructionRequirements(type);
  if (missing) {
    clearMode();
    blockedBuildType = type;
    notice(missing);
    if (document.documentElement.classList.contains('compact-ui')) dockTab('actions');
    updateUI();
    return;
  }
  clearMode();
  mode = "build";
  buildType = type;
  $("mode-banner").hidden = false;
  $("mode-banner").textContent =
    `PLACE ${D[type].name.toUpperCase()} · Click to build · Esc to cancel`;
  if (touchInput)
    $("mode-banner").textContent =
      `PLACE ${D[type].name.toUpperCase()} · Tap a location, then Build here`;
  $("mode-controls").hidden = false;
  $("confirm-build").hidden = !touchInput;
  $("confirm-build").disabled = true;
  view.preview.visible = false;
  view.preview.scale.set(D[type].radius, 1, D[type].radius);
  if (document.documentElement.classList.contains('compact-ui')) dockTab('actions');
  updateUI();
}
function formatTime(s) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}
let lastGroup = { key: '', time: 0 };
function focusSelection() {
  const es=selectedEntities();
  if(es.length) view.focusOn(es.reduce((s,e)=>s+e.x,0)/es.length,es.reduce((s,e)=>s+e.z,0)/es.length);
}
function useGroup(key, assign=false, add=false) {
  if(assign) groups.set(key,[...selected]);
  else if(add) groups.set(key,[...new Set([...(groups.get(key)||[]),...selected])]);
  else {
    setSelection((groups.get(key)||[]).filter(id=>sim.get(id)?.team===0));
    if(lastGroup.key===key && performance.now()-lastGroup.time<400) focusSelection();
    lastGroup={key,time:performance.now()};
  }
  if(assign||add) notice(`Control group ${key} ${add?'extended':'assigned'}.`);
}
function runShortcut(id) {
  if(id==='pause') {togglePause();return;}
  if(!started||paused||sim.result) return;
  const es=selectedEntities(),e=es[0],own=sim.own(0);
  const choose=(items,cycle=false)=>{
    if(!items.length){notice('No matching units or buildings.');return;}
    const next=cycle?items[(items.findIndex(u=>u.id===e?.id)+1)%items.length]:null;
    setSelection(next?[next.id]:items.map(u=>u.id));
    if(cycle)focusSelection();
  };
  if(id==='build') {
    if(!es.some(u=>u.type==='worker')) choose(own.filter(u=>u.type==='worker').sort((a,b)=>a.orders.length-b.orders.length).slice(0,1));
    if(selectedEntities().some(u=>u.type==='worker')) {clearMode();dockTab('actions');notice('BUILD: Q Relay · E Barracks · R Foundry · T Tower · Y Core');}
  } else if(['move','attackmove','patrol','attack','support','context','rally'].includes(id)) enterMode(id);
  else if(id==='stop') {clearMode();sim.issue([...selected],{type:'stop'});notice('Orders cleared.');}
  else if(id==='deliver') {
    const ws=es.filter(u=>u.type==='worker'&&u.carry>0);
    if(ws.length){clearMode();sim.issue(ws.map(u=>u.id),{type:'deliver'},queueOrders);}
    else notice('Select Harvesters carrying resources.');
  } else if(id==='upgrade') {if(e?.kind==='building')sim.upgradeBuilding(e.id);else notice('Select a building to upgrade.');}
  else if(id==='cancel') {
    if(mode || blockedBuildType)clearMode();
    else if(e?.kind==='building') {
      if(!e.complete)sim.cancelBuilding(e.id);
      else if(e.levelJob)sim.cancelLevel(e.id);
      else if(e.queue.length)sim.cancelQueue(e.id,e.queue.length-1);
      else notice('No queued job to cancel.');
    }
  } else if(id==='idle')choose(own.filter(u=>u.type==='worker'&&!u.orders.length),true);
  else if(id==='army')choose(own.filter(u=>u.kind==='unit'&&u.type!=='worker'));
  else if(id==='workers')choose(own.filter(u=>u.type==='worker'));
  else if(id==='buildings')choose(own.filter(u=>u.kind==='building'));
  else if(['hq','barracks','foundry'].includes(id))choose(own.filter(u=>u.type===id),true);
  else if(id==='same'&&e)choose(own.filter(u=>u.type===e.type));
  else if(id==='all')choose(own.filter(u=>u.kind==='unit'));
  else if(id==='clear')setSelection([]);
  else if(id==='focus')focusSelection();
  else if(id==='queue')$('queue-orders').click();
  else if(id==='info')showGuide(e?.type);
  else if(id==='zoom-in')view.zoomBy(-4);
  else if(id==='zoom-out')view.zoomBy(4);
  updateUI();
}
function updateUI() {
  const p = sim.players[0],
    pop = sim.population(0);
  $("alloy").textContent = Math.floor(p.alloy).toLocaleString();
  $("energy").textContent = Math.floor(p.energy).toLocaleString();
  $("population").innerHTML =
    `${pop.used}${pop.reserved ? `<span class="reserved">+${pop.reserved}</span>` : ""} <em>/ ${pop.cap}</em>`;
  $("population").classList.toggle(
    "at-cap",
    pop.used + pop.reserved >= pop.cap,
  );
  $("clock").textContent = formatTime(sim.time);
  $("uplink").textContent = sim.result
    ? "OPERATION COMPLETE"
    : !started
      ? "STANDBY"
      : paused
        ? "PAUSED"
        : "CONNECTED";
  for (const id of selected) if (!sim.get(id)) selected.delete(id);
  const own = sim.own(0),
    army = own.filter((e) => e.kind === "unit" && e.type !== "worker");
  if (own.some((e) => e.type === "worker" && e.carry > 0))
    milestones.economy = true;
  if (army.length >= 8) milestones.army = true;
  $("obj-economy").classList.toggle("complete", milestones.economy);
  $("obj-army").classList.toggle("complete", milestones.army);
  $("obj-win").classList.toggle("complete", sim.result === "victory");
  const rivals = sim.players.slice(1).filter(player => !player.eliminated).length;
  $("obj-win").querySelector("small").textContent = `Destroy enemy cores: ${rivals} ${rivals === 1 ? "rival remains" : "rivals remain"}`;
  const es = selectedEntities(),
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
  if (!e)
    $("selection-info").innerHTML =
      `<div class="selection-empty">${icon("logo")}<div><h3>Awaiting your command</h3><p>Click a unit or drag to select your expedition.</p></div></div>`;
  else $("selection-info").innerHTML = selectionStatus(sim,es);
  $("support-order").hidden = !es.some(u => u.support);
  $("patrol-order").hidden = !es.some(u => u.kind === 'unit' && u.type !== 'worker' && u.damage > 0);
  $("attack-target-order").hidden = !es.some(u => u.type === 'worker');
  document.documentElement.classList.toggle('many-orders', [...document.querySelectorAll('.order-buttons button')].filter(b => !b.hidden).length > 5);
  $("command-context").title = `Command core technology ${sim.techLevel()} / 3`;
  const signature = `${es.map((e) => e.id).join(",")}/${p.upgrade}/${e?.level}/${sim.techLevel()}/${touchInput}`;
  if (lastSelectionKey !== signature) {
    lastSelectionKey = signature;
    $("unit-list").innerHTML =
      es.length > 1
        ? es
            .slice(0, 18)
            .map(
              (u) =>
                `<button data-select="${u.id}" title="${u.name}">${icon(u.icon || u.type)}</button>`,
            )
            .join("") +
          (es.length > 18 ? `<span>+${es.length - 18}</span>` : "")
        : "";
    const actions =
      e && es.length === 1 && e.kind === "building"
        ? e.trains || []
        : es.some((u) => u.type === "worker")
          ? BUILDINGS
          : [];
    $("command-label").textContent = es.some((u) => u.type === "worker")
      ? "CONSTRUCTION"
      : e?.trains
        ? "PRODUCTION"
        : "FIELD ORDERS";
    $("command-context").textContent = actions.length
      ? `${actions.length} AVAILABLE`
      : "TACTICAL";
    $("commands").innerHTML =
      actions
        .map((type, index) => {
          const d = D[type];
          const label = type === 'upgrade' ? 'Weapons +' : d.name;
          return `<button class="command-tile" data-action="${type}" data-hotkey="${ACTION_KEYS[index]}" aria-label="${d.name}, ${d.cost[0]} alloy${d.cost[1] ? ` and ${d.cost[1]} energy` : ''}" title="${ACTION_KEYS[index]} · ${d.name} · ${d.description}"><kbd class="action-key">${ACTION_KEYS[index]}</kbd>${icon(d.icon || type)}<span>${label}</span><small><b class="alloy-text">${d.cost[0]}</b>${d.cost[1] ? ` <b class="energy-text">/ ${d.cost[1]}</b>` : ""}</small></button>`;
        })
        .join("") || (e?.kind==='building' ? '' :
      `<div class="tactical-hint">${icon("crosshair")}<strong>${e ? "Control the battlefield" : "Your expedition is ready"}</strong><p>${e ? (touchInput ? "Open Selection for Move, Attack-move and Support orders, then tap a target on the battlefield." : "Right-click to move or engage.<br>Attack-move to advance and fight.") : "Select the Command core to train Harvesters, or the Barracks to grow your army."}</p></div>`);
    $("upgrade-actions").innerHTML = e?.kind === 'building' && es.length === 1 ?
      `<button data-level title="U · Upgrade building">${e.level < 3 ? `Upgrade L${e.level+1} · ${sim.levelCost(e).join('/')} <kbd>U</kbd>` : 'Maximum level 3'}</button>` : '';
    $("command-hint").textContent =
      e?.kind === "building"
        ? ''
        : es.some((u) => u.type === "worker")
          ? "Select a structure, then place it on clear terrain."
          : touchInput ? "Enable Queue to chain orders. Use Army or Box to select a group." : "Hold Shift to queue orders. Ctrl + 1–9 saves a group.";
  }
  for (const button of $("commands").querySelectorAll("[data-action]")) {
    const unavailable =
      !started ||
      paused ||
      sim.result;
    button.disabled = !!unavailable || (e?.kind==='building' && (!e.complete || !!e.levelJob));
  }
  // Desktop shares the selection queue; mobile retains a queue in each tab.
  productionUI.update(document.documentElement.classList.contains('compact-ui') && es.length===1?e:null, !started || paused || !!sim.result);
  selectionWorkUI.update(es.length===1?e:null, !started || paused || !!sim.result);
  const levelButton=$('upgrade-actions').querySelector('[data-level]');
  if(levelButton)levelButton.disabled=!started||paused||!!sim.result||!e.complete||!!e.levelJob||e.queue.length>0||e.level>=3;
  for (const b of document.querySelectorAll(".order-buttons button"))
    b.disabled = !started || paused || (b.id !== "field-guide" && !es.some((u) => u.kind === "unit"));
  for (const b of document.querySelectorAll(".touch-controls button"))
    b.disabled = !started || paused || !!sim.result;
  if (mode === "build" && buildPoint) {
    const error = sim.placement(buildType, 0, buildPoint.x, buildPoint.z);
    $("confirm-build").disabled = !!error || paused || !started;
    view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
  }
  constructionUI.update({sim, selected:es, mode, type:buildType, point:buildPoint, blockedType:blockedBuildType, failure:buildFailure, started, paused, touch:touchInput});
}

function minimap() {
  const {size:MAP_SIZE,half:HALF,grid:GRID}=sim.terrain;
  const c = $("minimap"),
    ctx = c.getContext("2d"),
    w = c.width,
    h = c.height,
    px = (x) => ((x + HALF) / MAP_SIZE) * w,
    pz = (z) => ((z + HALF) / MAP_SIZE) * h;
  ctx.fillStyle = "#485243";
  ctx.fillRect(0, 0, w, h);
  if (sim.terrain.river)
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        ctx.fillStyle =
          SURFACES[sim.terrain.at(x * 2 - HALF + 1, z * 2 - HALF + 1)];
        ctx.fillRect(
          (x * w) / GRID,
          (z * h) / GRID,
          w / GRID + 1,
          h / GRID + 1,
        );
      }
  ctx.strokeStyle = "#64715a";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(px(-25), pz(24));
  ctx.lineTo(px(25), pz(-24));
  if (sim.terrain.id === "classic") ctx.stroke();
  for (const [x, z, r] of ROCKS) {
    ctx.fillStyle = "#263c33";
    ctx.beginPath();
    ctx.arc(px(x), pz(z), (r / MAP_SIZE) * w, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      const i = z * GRID + x;
      if (sim.visible[0][i]) continue;
      ctx.fillStyle = sim.explored[0][i] ? "rgba(8,20,19,.45)" : "#111f20";
      ctx.fillRect(
        (x / GRID) * w,
        (z / GRID) * h,
        w / GRID + 0.5,
        h / GRID + 0.5,
      );
    }
  for (const r of sim.resources) {
    if (sim.isVisible(r)) rememberedResources.set(r.id, r.amount);
    if (rememberedResources.get(r.id) > 0 && sim.isExplored(r)) {
      ctx.fillStyle = r.type === "alloy" ? "#ddb268" : "#79cde3";
      ctx.fillRect(px(r.x) - 2, pz(r.z) - 2, 4, 4);
    }
  }
  for (const e of sim.entities)
    if (e.team !== 0 && e.kind === "building" && sim.isVisible(e))
      rememberedBuildings.set(e.id, { x: e.x, z: e.z, radius: e.radius, team: e.team });
  for (const [id, e] of rememberedBuildings) {
    if (sim.isVisible(e) && !sim.get(id)) {
      rememberedBuildings.delete(id);
      continue;
    }
    if (!sim.isVisible(e)) {
      ctx.fillStyle = palette(settings)[e.team];
      ctx.globalAlpha = 0.45;
      ctx.fillRect(px(e.x) - 3, pz(e.z) - 3, 6, 6);
      ctx.globalAlpha = 1;
    }
  }
  for (const e of sim.entities)
    if (sim.isVisible(e)) {
      ctx.fillStyle = palette(settings)[e.team];
      const r = e.kind === "building" ? 3.5 : selected.has(e.id) ? 2.5 : 1.6;
      ctx.beginPath();
      if (e.team === 0) ctx.arc(px(e.x), pz(e.z), r, 0, Math.PI * 2);
      else {
        ctx.moveTo(px(e.x), pz(e.z) - r - 1);
        ctx.lineTo(px(e.x) + r + 1, pz(e.z));
        ctx.lineTo(px(e.x), pz(e.z) + r + 1);
        ctx.lineTo(px(e.x) - r - 1, pz(e.z));
        ctx.closePath();
      }
      ctx.fill();
    }
  ctx.strokeStyle = "rgba(218,239,219,.7)";
  ctx.lineWidth = 1;
  const rect = view.renderer.domElement.getBoundingClientRect();
  ctx.beginPath();
  for (const [i, [x, y]] of [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
  ].entries()) {
    const p = view.point(x, y);
    if (p) {
      if (!i) ctx.moveTo(px(p.x), pz(p.z));
      else ctx.lineTo(px(p.x), pz(p.z));
    }
  }
  ctx.closePath();
  ctx.stroke();
}

function selectScreenType(target,additive=false) {
  const canvas=view.renderer.domElement,r=canvas.getBoundingClientRect();
  const same=sim.own(0).filter(u=>{
    if(u.type!==target.type)return false;
    const p=view.project(u.x,u.z,1),x=p.x+r.left,y=p.y+r.top;
    return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom&&document.elementFromPoint(x,y)===canvas;
  });
  const next=additive?new Set(selected):new Set(),remove=additive&&selected.has(target.id);
  for(const u of same){if(remove)next.delete(u.id);else next.add(u.id);}
  setSelection(next);
}

function commandAt(point, target, append = false, forced = null) {
  if (!point || !started || paused || sim.result) return;
  if (forced === 'context') forced = null;
  const es = selectedEntities(),
    units = es.filter((e) => e.kind === "unit");
  if (forced === 'rally') {
    for (const b of es.filter(e=>e.kind==='building' && e.complete && e.trains?.length)) b.rally={...point};
    notice('Rally point established.'); view.marker(point.x,point.z); return;
  }
  if (forced === 'attack') {
    if (!target || target.kind === 'resource' || !(target.team > 0) || !sim.isVisible(target)) {
      $("mode-banner").textContent = 'ATTACK · Choose a visible enemy unit or building';
      return false;
    }
    sim.issue(units.filter(e => e.damage > 0).map(e => e.id), { type: 'attack', target: target.id }, append);
    view.marker(target.x, target.z, 0xef9f75);
    tone(440);
    return true;
  }
  if (forced === "support") {
    const helpers = units.filter(e => sim.supportValid(e,target));
    if (!helpers.length) { notice("Medic: select allied infantry. Engineer: select a completed building or vehicle."); return false; }
    sim.issue(helpers.map(e => e.id),{type:"support",target:target.id},append);
    return true;
  }
  if (!forced && target?.team === 0) {
    const helpers = units.filter(e => sim.supportValid(e,target));
    sim.issue(helpers.map(e => e.id),{type:"support",target:target.id},append);
    for (const helper of helpers) units.splice(units.indexOf(helper),1);
  }
  for (const b of es.filter((e) => !forced && !es.some(u=>u.kind==='unit') && e.kind === "building" && e.complete && e.trains?.length)) {
    b.rally = { ...point };
    notice("Rally point established.");
  }
  if (!units.length) {
    view.marker(point.x, point.z);
    return;
  }
  let order = { type: forced || "move", ...point };
  if ((!forced || forced==='attackmove') && target?.team > 0 && sim.isVisible(target))
    order = { type: "attack", target: target.id };
  if(order.type==='attack'){
    sim.issue(units.filter(e=>e.damage>0).map(e=>e.id),order,append);
    sim.issue(units.filter(e=>!(e.damage>0)).map(e=>e.id),{type:'move',...point},append);
    view.marker(point.x,point.z,0xef9f75);tone(440);return;
  }
  if (
    !forced &&
    target &&
    (target.kind === "resource" ||
      (target.team === 0 && !target.complete) ||
      (target.team === 0 && target.type === "hq"))
  ) {
    const workers = units.filter((e) => e.type === "worker");
    sim.issue(
      workers.map((e) => e.id),
      {
        type:
          target.kind === "resource"
            ? "gather"
            : !target.complete
              ? "build"
              : "deliver",
        target: target.id,
      },
      append,
    );
    sim.issue(
      units.filter((e) => e.type !== "worker").map((e) => e.id),
      order,
      append,
    );
  } else
    sim.issue(
      units.map((e) => e.id),
      order,
      append,
    );
  view.marker(
    point.x,
    point.z,
    order.type === "attack" || forced === "attackmove" ? 0xef9f75 : view.colors[0],
  );
  tone(440);
}

function drawTouchBox(p) {
  if (!p) {
    $("selection-box").style.display = "none";
    return;
  }
  const rect = $("stage").getBoundingClientRect();
  Object.assign($("selection-box").style, {
    display: "block",
    left: `${Math.min(p.startX, p.x) - rect.left}px`,
    top: `${Math.min(p.startY, p.y) - rect.top}px`,
    width: `${Math.abs(p.x - p.startX)}px`,
    height: `${Math.abs(p.y - p.startY)}px`,
  });
}
function selectTouchBox(p) {
  const rect = view.renderer.domElement.getBoundingClientRect();
  const ids = sim
    .own(0)
    .filter((e) => {
      if (e.kind !== "unit") return false;
      const point = view.project(e.x, e.z, 1),
        x = point.x + rect.left,
        y = point.y + rect.top;
      return (
        x >= Math.min(p.startX, p.x) &&
        x <= Math.max(p.startX, p.x) &&
        y >= Math.min(p.startY, p.y) &&
        y <= Math.max(p.startY, p.y)
      );
    })
    .map((e) => e.id);
  setSelection(ids);
  boxSelection = false;
  $("box-select").setAttribute("aria-pressed", "false");
}
function showBuildPoint(point) {
  buildPoint = point;
  buildFailure = '';
  view.preview.visible = true;
  view.preview.position.set(point.x, 0.23, point.z);
  const error = sim.placement(buildType, 0, point.x, point.z);
  view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
  $("confirm-build").disabled = !!error;
  if (error) notice(error);
  updateUI();
}
function confirmBuild(point = buildPoint) {
  if (!point || mode !== "build" || paused || !started || sim.result) return;
  const worker = selectedEntities().find((e) => e.type === "worker");
  const previousEvents = sim.events.length;
  const b = worker && sim.build(worker.id, buildType, point.x, point.z);
  if (b) {
    clearMode();
    setSelection([b.id]);
    tone(330, 0.15);
  } else {
    buildFailure = sim.events.slice(previousEvents).findLast(e => e.type === 'message')?.text || 'Select a Harvester to construct this building.';
    updateUI();
  }
}
function touchTap(x, y) {
  const point = view.point(x, y),
    target = view.pick(x, y, sim, 24);
  if (!point) return;
  if (mode === "build") {
    showBuildPoint(point);
    return;
  }
  if (mode) {
    if (commandAt(point, ["support","context","attack","attackmove"].includes(mode) ? target : null, queueOrders, mode) !== false) clearMode();
    return;
  }
  if (boxSelection) {
    if (target?.team === 0) setSelection([...selected, target.id]);
    return;
  }
  if (target?.team === 0) {
    const workers = selectedEntities().filter((e) => e.type === "worker");
    if (
      workers.length &&
      (!target.complete ||
        (target.type === "hq" && workers.some((e) => e.carry > 0)))
    )
      commandAt(point, target, queueOrders);
    else setSelection([target.id]);
  } else if (selected.size) commandAt(point, target, queueOrders);
  else if (target?.kind === "resource")
    notice(
      `${target.type.toUpperCase()} · ${Math.floor(target.amount)} remaining. Select Harvesters to gather.`,
    );
  else notice("Select a unit, or use the Workers and Army buttons.");
}
function bindInput() {
  const canvas = view.renderer.domElement;
  touchControls = new TouchControls(canvas, {
    enabled: () => started && !paused && !sim.result,
    boxMode: () => boxSelection && !mode,
    activate: () => {
      unlockAudio();
      if (!touchInput) {
        touchInput = true;
        setLayout();
      }
      pointer.inside = false;
      hover = null;
    },
    tap: touchTap,
    box: selectTouchBox,
    rectangle: drawTouchBox,
    panZoom: (dx, dy, ratio) => {
      view.screenPan(
        (-dx * view.zoom) / view.height,
        (dy * view.zoom) / view.height,
      );
      if (ratio !== 1) view.zoomBy(view.zoom * (ratio - 1));
    },
  });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (e.pointerType === "touch") return;
    drag=null;$("selection-box").style.display="none";
    if (mode) {
      clearMode();
      return;
    }
    commandAt(
      view.point(e.clientX, e.clientY),
      view.pick(e.clientX, e.clientY, sim),
      e.shiftKey || queueOrders,
    );
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    unlockAudio();
    if (![0,1].includes(e.button) || !started || paused || sim.result) return;
    canvas.setPointerCapture(e.pointerId);
    drag = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      button: e.button,
    };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY, inside: true };
    hover = view.pick(e.clientX, e.clientY, sim);
    if (drag?.button === 1) {
      view.screenPan(
        (-(e.clientX - drag.lastX) * view.zoom) / view.height,
        ((e.clientY - drag.lastY) * view.zoom) / view.height,
      );
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    } else if (
      drag &&
      !mode &&
      Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6
    ) {
      const rect = $("stage").getBoundingClientRect();
      Object.assign($("selection-box").style, {
        display: "block",
        left: `${Math.min(e.clientX, drag.x) - rect.left}px`,
        top: `${Math.min(e.clientY, drag.y) - rect.top}px`,
        width: `${Math.abs(e.clientX - drag.x)}px`,
        height: `${Math.abs(e.clientY - drag.y)}px`,
      });
    }
    if (mode === "build") {
      const p = view.point(e.clientX, e.clientY);
      if (p) {
        view.preview.visible = true;
        view.preview.position.set(p.x, 0.23, p.z);
        view.preview.material.color.setHex(
          sim.placement(buildType, 0, p.x, p.z) ? 0xef7660 : 0x92ebc5,
        );
      }
    }
    $("hover-label").hidden = !hover || !!drag || !!mode;
    if (hover && !drag && !mode) {
      $("hover-label").textContent =
        hover.kind === "resource"
          ? `${hover.type.toUpperCase()} · ${Math.floor(hover.amount)}`
          : `${hover.name}${hover.team > 0 ? " · ENEMY" : ""}`;
      const rect = canvas.getBoundingClientRect();
      $("hover-label").style.left =
        `${Math.min(e.clientX - rect.left + 16, view.width - 240)}px`;
      $("hover-label").style.top = `${e.clientY - rect.top + 20}px`;
    }
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    hover = null;
    $("hover-label").hidden = true;
  });
  // The footer covers the canvas's bottom edge. Track hover there without
  // passing clicks through the UI or scrolling while using its Controls link.
  const statusbar = document.querySelector(".statusbar");
  statusbar.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY, inside: !e.target.closest("button") };
  });
  statusbar.addEventListener("pointerleave", () => { pointer.inside = false; });
  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!drag) return;
    const old = drag;
    drag = null;
    $("selection-box").style.display = "none";
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (old.button !== 0 || e.button!==0 || paused || !started || sim.result || document.elementFromPoint(e.clientX,e.clientY)!==canvas) return;
    const point = view.point(e.clientX, e.clientY);
    if (mode === "build" && point) {
      confirmBuild(point);
      return;
    }
    if (mode) {
      if (commandAt(point, ["support","context","attack","attackmove"].includes(mode) ? view.pick(e.clientX,e.clientY,sim) : null, e.shiftKey||queueOrders, mode) !== false) clearMode();
      return;
    }
    const next = e.shiftKey ? new Set(selected) : new Set();
    if (Math.hypot(e.clientX - old.x, e.clientY - old.y) > 6) {
      const rect = canvas.getBoundingClientRect();
      for (const u of sim.own(0).filter((u) => u.kind === "unit")) {
        const p = view.project(u.x, u.z, 1);
        const x = p.x + rect.left,
          y = p.y + rect.top;
        if (
          x >= Math.min(old.x, e.clientX) &&
          x <= Math.max(old.x, e.clientX) &&
          y >= Math.min(old.y, e.clientY) &&
          y <= Math.max(old.y, e.clientY)
        )
          next.add(u.id);
      }
    } else {
      const target = view.pick(e.clientX, e.clientY, sim);
      if (target?.team === 0) {
        if(e.ctrlKey && target.kind==='unit'){selectScreenType(target,e.shiftKey);return;}
        if (e.shiftKey && next.has(target.id)) next.delete(target.id);
        else next.add(target.id);
      }
    }
    setSelection(next);
  });
  canvas.addEventListener("dblclick", (e) => {
    if (!started || paused || sim.result || mode || e.ctrlKey) return;
    const target = view.pick(e.clientX, e.clientY, sim);
    if (target?.team === 0 && target.kind === "unit")
      selectScreenType(target,e.shiftKey);
  });
  canvas.addEventListener("pointercancel", () => {
    drag = null;
    pointer.inside = false;
    $("selection-box").style.display = "none";
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      view.zoomBy(Math.sign(e.deltaY) * 2.5);
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e) => {
    if(settingsUI.active || modalType==='guide' || e.isComposing ||
      (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
    const key=physicalKey(e);
    if(e.altKey||e.metaKey) return;
    if(e.ctrlKey && !/^[1-9]$/.test(key) && key!=='a')return;
    if(key==='escape') {
      if(e.repeat)return;
      e.preventDefault();keys.clear();
      if(document.documentElement.classList.contains('objectives-open'))setObjectivesOpen(false);
      else if(mode || blockedBuildType)clearMode();
      else if(modalType==='help')closeModal();
      else if(started&&!sim.result)togglePause();
      return;
    }
    if(key===' '&&!e.ctrlKey) {
      if(e.target instanceof Element && e.target.closest('#mission-toggle'))return;
      // Before play, Space must activate the focused Start/Settings button.
      if(!started && e.target instanceof Element && e.target.closest('button'))return;
      e.preventDefault();if(!e.repeat) {keys.clear();if(modalType==='pause')closeModal();else if(!modalType)togglePause();}return;
    }
    if(modalType||!started||paused||sim.result)return;
    if(/^[1-9]$/.test(key)) {
      e.preventDefault();if(!e.repeat)useGroup(key,e.ctrlKey,e.shiftKey);return;
    }
    if(e.ctrlKey&&key==='a') {e.preventDefault();if(!e.repeat)runShortcut('all');return;}
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {e.preventDefault();keys.add(key);return;}
    const tile=ACTION_KEYS.includes(key.toUpperCase()) ? document.querySelector(`#commands [data-hotkey="${key.toUpperCase()}"]`) : null;
    if(tile&&!mode) {e.preventDefault();if(!e.repeat&&!tile.disabled)tile.click();return;}
    const binding=HOTKEYS.find(k=>k.key.split(' / ')[0].toLowerCase()===key);
    const id=key==='.'?'idle':key==='-'?'zoom-out':key==='q'&&!mode?'attackmove':binding?.id;
    if(id) {e.preventDefault();if(!e.repeat)runShortcut(id);return;}
    if(key==='?'){e.preventDefault();if(!e.repeat){keys.clear();showHelp();}}
    if(key==='g'&&!e.repeat)view.grid.visible=!view.grid.visible;
  });
  window.addEventListener("keyup",e=>keys.delete(physicalKey(e)));
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      touchControls.reset();
      drag = null;
      pointer.inside = false;
      keys.clear();
      if (started && !paused && !sim.result) togglePause();
    }
  });
  const mapPoint = (e) => {
    const {size:MAP_SIZE,half:HALF}=sim.terrain;
    const r = $("minimap").getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * MAP_SIZE - HALF,
      z: ((e.clientY - r.top) / r.height) * MAP_SIZE - HALF,
    };
  };
  // Use a click target so Chrome's touch adjustment recognizes the whole map
  // instead of redirecting taps near its corners to the neighboring Home button.
  $("minimap").addEventListener("click", (e) => {
    if (e.button === 0) {
      const p = mapPoint(e);
      if (mode && mode !== "build") {
        if (commandAt(p, null, e.shiftKey||queueOrders, mode) !== false) clearMode();
      } else view.focusOn(p.x, p.z);
    }
  });
  $("minimap").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if(mode){clearMode();return;}
    const p = mapPoint(e);
    commandAt(p, null, e.shiftKey||queueOrders);
  });
}

function focusHome() {
  const hq = sim.own(0).find((e) => e.type === "hq");
  if (hq) view.focusOn(hq.x + 5, hq.z - 5);
}
function closeModal() {
  $("modal").hidden = true;
  modalType = null;
  if (started && !sim.result) paused = false;
  keys.clear();
}
function applyPreferences(value) {
  settings = value;
  muted = settings.muted;
  view?.applySettings(settings);
  $("quality").textContent = settings.quality === "eco" ? "Eco" : "High";
  $("audio").innerHTML = icon(muted ? "muted" : "volume");
  $("audio").setAttribute("aria-label", muted ? "Enable sound" : "Mute sound");
  document.documentElement.style.setProperty(
    "--team-friendly",
    palette(settings)[0],
  );
  document.documentElement.style.setProperty(
    "--team-hostile",
    palette(settings)[1],
  );
  if (!saveSettings(settings))
    notice(
      "Settings applied for this session. Browser storage is unavailable.",
    );
}
const settingsUI = new SettingsUI({
  get: () => settings,
  apply: applyPreferences,
  enter: () => {
    const state = { paused, modalType };
    paused = true;
    keys.clear();
    touchControls?.reset();
    drag = null;
    pointer.inside = false;
    clearMode();
    ambience?.update(settings, false, false);
    return state;
  },
  leave: (state) => {
    paused = state.paused || !!sim.result;
    modalType = state.modalType;
    if (document.hidden && started) paused = true;
    updateUI();
  },
});
$("briefing-settings").onclick = () => settingsUI.open();
$("scenario").onchange = $("enemy-count").onchange = () => {
  if (started) return;
  mapId = $("scenario").value;
  enemyCount = Number($("enemy-count").value);
  sim = new Simulation({ map: mapId, enemyCount });
  view?.reset();
  view?.setTerrain(sim.terrain);
  focusHome();
  selected.clear();
  rememberedBuildings.clear();
  rememberedResources.clear();
  updateUI();
  document.querySelector(".map-heading h1").innerHTML =
    `${MAPS[mapId]}<span>.</span>`;
};
function togglePause() {
  if (!started || sim.result) return;
  if (paused) {
    closeModal();
    return;
  }
  paused = true;
  touchControls?.reset();
  drag = null;
  pointer.inside = false;
  modalType = "pause";
  keys.clear();
  $("modal").hidden = false;
  $("modal-content").innerHTML =
    `<span class="eyebrow">TACTICAL PAUSE</span><h2 id="modal-title">Hold your position.</h2><p>The battlefield is paused. Take a moment to plan your next move.</p><button class="primary" data-resume>Resume operation ${icon("play")}</button><button class="secondary" data-restart>Restart skirmish</button><button class="pause-settings" data-settings>Settings · army, graphics & sound</button>`;
  $("modal").querySelector("[data-resume]").focus();
}
function showHelp() {
  if (sim.result) return;
  paused = true;
  touchControls?.reset();
  keys.clear();
  modalType = "help";
  $("modal").hidden = false;
  $("modal-content").innerHTML =
    `<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Your command station.</h2><div class="controls-grid"><span>Select / box select</span><kbd>Left-click / drag</kbd><span>Add to selection / queue order</span><kbd>Shift + click</kbd><span>Move, gather, build, attack</span><kbd>Right-click target</kbd><span>Pan camera</span><kbd>WASD / arrows / middle drag</kbd><span>Zoom</span><kbd>Mouse wheel</kbd><span>Attack-move / stop</span><kbd>F / X</kbd><span>Assign / recall group</span><kbd>Ctrl + 1–9 / 1–9</kbd><span>Focus base / toggle grid</span><kbd>H / G</kbd><span>Pause / cancel</span><kbd>Space / Esc</kbd></div><p class="help-note">Select a Harvester and right-click amber or blue deposits to gather. Select a building to train units; select a Harvester to construct. Click a queued unit to cancel and refund it. Build Supply relays before reaching the population cap.</p><button class="primary" data-resume>Return to the frontier ${icon("arrow")}</button>`;
  $("modal").querySelector("[data-resume]").focus();
  if (!touchInput) $("modal-content").querySelector(".controls-grid").outerHTML = HOTKEY_HELP;
  if (touchInput) {
    $("modal-content").querySelector(".controls-grid").innerHTML =
      "<span>Select a unit / structure</span><kbd>Tap it</kbd><span>Move / gather / attack</span><kbd>Select, then tap target</kbd><span>Pan the battlefield</span><kbd>Drag one finger</kbd><span>Zoom / pan together</span><kbd>Pinch / two fingers</kbd><span>Select multiple units</span><kbd>Box, then drag</kbd><span>Select your forces</span><kbd>Workers / Army</kbd><span>Queue multiple orders</span><kbd>Enable Queue</kbd><span>Place a structure</span><kbd>Tap location → Build here</kbd><span>Change HUD panel</span><kbd>Selection / Actions / Map</kbd>";
    $("modal-content").querySelector(".help-note").textContent =
      "Tap Workers, then tap amber or blue deposits to gather. Tap a building to train units in Actions. Use Move or Attack-move in Selection, then tap a destination. To set a rally point, select a production building and tap ground. Eco graphics reduces rendering cost on phones.";
  }
}
function showResult() {
  paused = true;
  modalType = "result";
  clearMode();
  $("modal").hidden = false;
  tone(sim.result === "victory" ? 880 : 220, 0.3);
  const win = sim.result === "victory";
  $("modal-content").innerHTML =
    `<span class="eyebrow">OPERATION ${sim.result === "draw" ? "CONCLUDED" : win ? "SUCCESSFUL" : "FAILED"}</span><div class="result-emblem ${win ? "" : "loss"}">${icon(win ? "flag" : "shield")}</div><h2 id="modal-title">${win ? "The frontier is yours." : sim.result === "draw" ? "Mutual destruction." : "Your outpost has fallen."}</h2><p>${win ? "Enemy command has been eliminated. Meridian holds the valley." : sim.result === "draw" ? "All Command cores were destroyed." : "An enemy destroyed your Command core. Regroup and try a different approach."}</p><div class="result-stats"><span><strong>${formatTime(sim.time)}</strong>OPERATION TIME</span><span><strong>${sim.players[0].kills}</strong>ENEMIES ELIMINATED</span></div><button class="primary" data-restart>Deploy again ${icon("arrow")}</button>`;
}
function restart() {
  touchControls?.reset();
  drag = null;
  keys.clear();
  pointer.inside = false;
  boxSelection = false;
  queueOrders = false;
  $("box-select").setAttribute("aria-pressed", "false");
  $("queue-orders").setAttribute("aria-pressed", "false");
  sim = new Simulation({ map: mapId, enemyCount });
  view.reset();
  focusHome();
  selected.clear();
  groups.clear();
  rememberedBuildings.clear();
  rememberedResources.clear();
  milestones.economy = milestones.army = false;
  setObjectivesOpen(false);
  clearMode();
  modalType = null;
  started = true;
  paused = false;
  accumulator = 0;
  hover = null;
  $("modal").hidden = true;
  $("briefing").hidden = true;
  document.documentElement.classList.remove("in-briefing");
  view.resize();
  $("status-text").textContent = "OPERATION ACTIVE";
  setSelection([sim.own(0).find((e) => e.type === "hq").id]);
}

$("start").onclick = () => {
  unlockAudio();
  started = true;
  paused = false;
  $("briefing").hidden = true;
  document.documentElement.classList.remove("in-briefing");
  view.resize();
  $("status-text").textContent = "OPERATION ACTIVE";
  setSelection([sim.own(0).find((e) => e.type === "hq").id]);
  notice(
    touchInput
      ? "Tap Workers, then tap amber crystals. Drag to pan; pinch to zoom."
      : "Select Harvesters, then right-click amber crystals to start your economy.",
  );
  tone(780, 0.15);
};
$("pause").onclick = togglePause;
$("mission-toggle").onclick = () => setObjectivesOpen(!document.documentElement.classList.contains('objectives-open'));
document.addEventListener('pointerdown', event => {
  if (document.documentElement.classList.contains('objectives-open') &&
      event.target instanceof Element && !event.target.closest('#mission-toggle, #mission-objectives')) setObjectivesOpen(false);
});
$("help").onclick = showHelp;
$("controls-link").onclick = showHelp;
$("home").onclick = focusHome;
$("dock-tabs").onclick = (event) => {
  const button = event.target.closest("[data-dock]");
  if (button) { dockTab(button.dataset.dock); updateUI(); }
};
$("confirm-build").onclick = () => confirmBuild();
$("cancel-mode").onclick = () => { clearMode(); updateUI(); };
$("select-workers").onclick = () => {
  clearMode();
  setSelection(
    sim
      .own(0)
      .filter((e) => e.type === "worker")
      .map((e) => e.id),
  );
  dockTab("actions");
};
$("select-army").onclick = () => {
  clearMode();
  setSelection(
    sim
      .own(0)
      .filter((e) => e.kind === "unit" && e.type !== "worker")
      .map((e) => e.id),
  );
};
$("clear-selection").onclick = () => {
  clearMode();
  setSelection([]);
};
$("box-select").onclick = () => {
  clearMode();
  boxSelection = !boxSelection;
  $("box-select").setAttribute("aria-pressed", String(boxSelection));
  notice(
    boxSelection
      ? "Drag a box around your units. Tap Box again to return to panning."
      : "Drag to pan the battlefield.",
  );
};
$("queue-orders").onclick = () => {
  queueOrders = !queueOrders;
  $("queue-orders").setAttribute("aria-pressed", String(queueOrders));
  notice(
    queueOrders
      ? "New commands will be queued."
      : "New commands replace existing orders.",
  );
};
$("zoom-in").onclick = () => view.zoomBy(-4);
$("zoom-out").onclick = () => view.zoomBy(4);
$("quality").onclick = () => {
  if (!view) return;
  applyPreferences({ ...settings, quality: view.lowPower ? "high" : "eco" });
  $("quality").textContent = view.lowPower ? "Eco" : "High";
  notice(
    view.lowPower
      ? "Eco graphics: reduced resolution and simple shadows."
      : "High graphics: detailed shadows and higher resolution.",
  );
};
$("audio").onclick = () => {
  unlockAudio();
  muted = !muted;
  applyPreferences({ ...settings, muted });
  $("audio").innerHTML = icon(muted ? "muted" : "volume");
  $("audio").title = muted ? "Enable sound" : "Mute sound";
  $("audio").setAttribute("aria-label", $("audio").title);
};
let guidePrevious = null;
const showGuide = createFieldGuide(() => {
  guidePrevious = {paused,modalType}; paused = true; modalType = 'guide'; keys.clear();
}, () => { paused = guidePrevious.paused; modalType = guidePrevious.modalType; keys.clear(); });
$("field-guide").onclick = () => showGuide(selectedEntities()[0]?.type);
$("support-order").onclick = () => enterMode('support');
for(const [id,key] of [['field-guide','I'],['support-order','R'],['move-order','M']]) {
  $(id).insertAdjacentHTML('beforeend',` <kbd>${key}</kbd>`);$(id).title+=` · ${key}`;
}
$('pc-shortcuts').addEventListener('click',event=>{
  const command=event.target.closest('[data-shortcut]'),group=event.target.closest('[data-group]');
  if(command){runShortcut(command.dataset.shortcut);$('pc-shortcuts').open=false;}
  if(group&&started&&!paused&&!sim.result)useGroup(group.dataset.group,event.ctrlKey,event.shiftKey);
});
$("upgrade-actions").onclick = event => {
  if (!started || paused || sim.result) return;
  const e = selectedEntities()[0];
  if (!e) return;
  if (event.target.closest('[data-level]')) sim.upgradeBuilding(e.id);
  if (event.target.closest('[data-cancel-level]')) sim.cancelLevel(e.id);
  updateUI();
};
$("move-order").onclick = () => enterMode("move");
$("attack-order").onclick = () => enterMode("attackmove");
$("attack-order").insertAdjacentHTML('afterend', '<button id="patrol-order" hidden title="Patrol between two points · P">Patrol <kbd>P</kbd></button><button id="attack-target-order" hidden title="Attack a chosen enemy · N">Attack <kbd>N</kbd></button>');
$("patrol-order").onclick = () => enterMode('patrol');
$("attack-target-order").onclick = () => enterMode('attack');
$("stop-order").onclick = () => runShortcut('stop');
$("commands").onclick = (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const type = button.dataset.action;
  if (D[type].kind === "building") enterBuild(type);
  else {
    const b = selectedEntities()[0];
    if (b) {
      sim.enqueue(b.id, type);
      tone();
      updateUI();
    }
  }
};
$("unit-list").onclick = (event) => {
  const button = event.target.closest("[data-select]");
  if (button) setSelection([Number(button.dataset.select)]);
};
$("modal").onclick = (event) => {
  if (event.target.closest("[data-settings]")) settingsUI.open();
  if (event.target.closest("[data-resume]")) closeModal();
  if (event.target.closest("[data-restart]")) restart();
};

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.max(0, (now - timePrevious) / 1000),
    dt = Math.min(elapsed, 0.25);
  timePrevious = now;
  ambience?.update(
    settings,
    started && !paused && !sim.result,
    sim.terrain.river && Math.abs(view.focus.z) < 14,
  );
  if (started && !paused && !sim.result) {
    accumulator += dt;
    while (accumulator >= 0.05) {
      sim.tick(0.05);
      accumulator -= 0.05;
    }
    if (sim.result) showResult();
  }
  if (!modalType) {
    const speed = dt * view.zoom * 0.65;
    let dx =
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let dy =
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    if (pointer.inside && started && !drag && !mode) {
      const r = view.renderer.domElement.getBoundingClientRect();
      if (pointer.x < r.left + 8) dx--;
      if (pointer.x > r.right - 8) dx++;
      if (pointer.y < r.top + 8) dy++;
      if (pointer.y > r.bottom - 8) dy--;
    }
    if (dx || dy) view.screenPan(dx * speed, dy * speed);
  }
  const events = sim.events.splice(0);
  for (const event of events) {
    if (event.type === "message") notice(event.text);
    else view.event(event, sim);
  }
  view.update(sim, dt, selected, hover);
  uiClock -= dt;
  if (uiClock <= 0) {
    updateUI();
    minimap();
    uiClock = 0.15;
  }
  frameCount++;
  frameTime += elapsed;
  if (frameTime >= 1) {
    $("fps").textContent = `${Math.round(frameCount / frameTime)} FPS`;
    frameCount = 0;
    frameTime = 0;
  }
}

const constructionUI = createConstructionUI(D, {
  retry: type => enterBuild(type),
  back: () => { clearMode(); updateUI(); },
});

async function boot() {
  try {
    view = new WorldView($("world"), { terrain: sim.terrain, settings });
    $("quality").textContent = view.lowPower ? "Eco" : "High";
    if (touchInput)
      $("briefing").querySelector(".briefing-note").textContent =
        "SINGLE PLAYER · TOUCH + MOUSE";
    await view.loadModels();
    applyPreferences(settings);
    document.querySelector(".map-heading h1").innerHTML =
      `${MAPS[mapId]}<span>.</span>`;
    bindInput();
    $("start").disabled = false;
    $("start").textContent = "Start";
    $("status-text").textContent = "ALL SYSTEMS READY";
    updateUI();
    requestAnimationFrame(frame);
    // Explicit opt-in hook used by browser integration tests. Absent in normal play.
    if (new URLSearchParams(location.search).has("test"))
      window.__frontier = {
        get sim() {
          return sim;
        },
        get view() {
          return view;
        },
        get selected() {
          return selected;
        },
        select: setSelection,
        restart,
        get paused() {
          return paused;
        },
        step: (seconds) => {
          for (let i = 0; i < seconds / 0.05; i++) sim.tick(0.05);
          updateUI();
        },
        get started() {
          return started;
        },
        get settings() {
          return settings;
        },
      };
  } catch (error) {
    console.error(error);
    $("start").textContent = "Unable to initialize";
    $("status-text").textContent = "INITIALIZATION FAILED";
    notice(
      "The 3D engine could not start. Enable hardware acceleration and reload in a browser with WebGL 2 support.",
    );
    $("briefing").querySelector("p").textContent =
      "Check your connection and WebGL support, then reload. All game assets must be served from the built site.";
  }
}
boot();
