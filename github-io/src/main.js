import { Tutorial, TRAINING_STEPS } from "./tutorial.js";
import { Governor } from "./governor.js";
import { createMatchStats } from "./match-stats.js";
import { skirmishResultHTML } from "./results-ui.js";
import "./tutorial.css";
import "./style.css";
import "./mobile.css";
import "./settings.css";
import "./start-screen.css";
import "./desktop-dock.css";
import "./hud-readability.css";
import { loadSettings, saveSettings, palette } from "./settings.js";
import { SettingsUI } from "./settings-ui.js";
import { localizeDOM, loadStory } from "./i18n.js";
import "./language.css";
import { MAPS } from "./terrain.js";
import { surfaceColors } from "./ground-paint.js";
import { teamColors } from "./faction-colors.js";
import { Ambience, audioPower } from "./ambience.js";
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
import { TouchControls, isTouchPointer } from "./touch-controls.js";
import { createFullscreen } from "./fullscreen.js";
import { ACTION_KEYS, HOTKEYS, HOTKEY_HELP, physicalKey } from "./hotkeys.js";
import { createConstructionUI } from "./construction-ui.js";
import { createProductionUI, createWorkStrip } from "./production-ui.js";
import { selectionStatus } from "./selection-status.js";
import { abilityGroups, aimState, tacticalUnits, takesStance, clampRank, STANCE_INFO } from "./tactics-ui.js";
import { tacticsCardHTML, updateTacticsCard } from "./tactics-card.js";
import { AI_SPEEDS, ALLIANCES } from "./ai-plan.js";
import { MISSIONS, ACTS, loadProgress, saveProgress, isUnlocked, isCleared, recordClear, nextMission, bestTime, bestMedal, missionIndex } from "./campaign.js";
import { createMissionUI, pointLabel, medalBadge, clock as missionClock } from "./mission-ui.js";
import { writeSave, readSave, clearSave, AUTOSAVE_SECONDS } from "./savegame.js";
import { setMusicMood, musicMood } from "./music.js";
import { AudioDirector } from "./audio.js";
import { screenMix } from "./audio-logic.js";
import { portrait, hasPortrait } from "./portraits.js";
import keyartUrl from "./art/keyart.webp";
import keyartSmallUrl from "./art/keyart-960.webp";
import emblemUrl from "./art/emblem.webp";
import "./ui-theme.css";
import "./landscape-hud.css";

document.querySelector("#app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Frontier Command home" translate="no"><span class="brand-mark"><img src="${emblemUrl}" alt="" width="40" height="40" decoding="async"></span><span class="brand-name">FRONTIER<span class="brand-sub">COMMAND</span></span></a>
    <div class="resource-bar" aria-label="Resources">
      <div class="resource alloy" title="Alloy — harvested from amber deposits">${icon("alloy")}<span><strong id="alloy">450</strong><small>ALLOY</small></span></div>
      <div class="resource energy" title="Energy — harvested from blue deposits">${icon("energy")}<span><strong id="energy">150</strong><small>ENERGY</small></span></div>
      <div class="resource population" title="Used + queued population / capacity">${icon("people")}<span><strong id="population">7 <em>/ 15</em></strong><small>POPULATION</small></span></div>
    </div>
    <div class="top-actions"><button id="briefing-settings" class="icon-button menu-only" title="Settings" aria-label="Settings">${icon("gear")}</button><span id="clock">00:00</span><button id="audio" class="icon-button" title="Mute sound" aria-label="Mute sound">${icon("volume")}</button><button id="help" class="icon-button" title="Controls" aria-label="Show controls">${icon("help")}</button><button id="pause" class="icon-button" title="Pause · Space" aria-label="Pause game">${icon("pause")}</button></div>
  </header>
  <main id="stage">
    <div id="world"></div><div id="training-marker" hidden aria-hidden="true">◎</div><aside id="training" hidden><button id="training-toggle" aria-expanded="true">Training</button><div id="training-card" class="panel"><strong id="training-title"></strong><p id="training-copy"></p><small>Training supplies replenish · no AI attacks</small><div><button id="training-focus">Focus target</button><button id="training-exit">Leave training</button></div></div></aside>
    <div class="map-heading"><span class="eyebrow"><i class="live-dot"></i> <span id="operation-label">OPERATION 01 / SKIRMISH</span></span><h1>Outpost Meridian<span>.</span></h1><p>THE ASHEN FRONTIER <span>·</span> SECTOR 07</p></div>
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
    <section id="briefing" class="briefing" aria-labelledby="briefing-title">
      <div class="briefing-hero">
        <picture class="briefing-art" aria-hidden="true"><source media="(max-width: 720px)" srcset="${keyartSmallUrl}"><img src="${keyartUrl}" alt="" width="1600" height="900" decoding="async"></picture>
        <div class="briefing-copy">
          <div class="eyebrow">EXPEDITION BRIEFING</div>
          <h2 id="briefing-title">A new frontier.<br> A foothold to defend.</h2>
          <p id="briefing-text">Build your outpost. Harvest the valley. Lead your expedition against rival commanders.</p>
          <div class="briefing-facts">
            <div class="briefing-rule"><span>RIVALS</span><strong id="briefing-rivals">1 AI · Normal speed</strong></div>
            <div class="briefing-rule"><span>OBJECTIVE</span><strong id="briefing-goal">Eliminate enemy command</strong></div>
          </div>
        </div>
      </div>
      <div class="briefing-setup">
        <button id="continue" class="secondary continue-launch" hidden></button>
        <div class="mode-switch" role="group" aria-label="Game mode">
          <button data-mode="training" aria-pressed="false">${icon("flag")}<span>Training</span><small>Start here</small></button>
          <button data-mode="skirmish" aria-pressed="true">${icon("crosshair")}<span>Skirmish</span><small>Custom battle</small></button>
          <button data-mode="campaign" aria-pressed="false">${icon("logo")}<span>Campaign</span><small>${MISSIONS.length} missions</small></button>
        </div>
        <div class="briefing-tools" id="skirmish-setup">
          <label class="field field-wide"><span>Battlefield</span><select id="scenario" aria-label="Battlefield">${["riverlands", ...Object.keys(MAPS).filter(id => id !== "riverlands")].map(id => `<option value="${id}">${MAPS[id]}</option>`).join("")}</select></label>
          <label class="field"><span>Rivals</span><select id="enemy-count" aria-label="Number of AI enemies"><option value="1">1 AI enemy</option><option value="2">2 AI enemies</option><option value="3">3 AI enemies</option></select></label>
          <label class="field"><span>AI speed</span><select id="ai-speed" aria-label="AI speed" title="AI speed: how fast rivals build, tech up and attack">${Object.entries(AI_SPEEDS).map(([id, p]) => `<option value="${id}"${id === "normal" ? " selected" : ""}>${p.label} AI</option>`).join("")}</select></label>
          <label class="field field-wide"><span>AI teams</span><select id="alliance" aria-label="AI teams" disabled>${Object.entries(ALLIANCES).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
        </div>
        <div id="campaign-setup" hidden></div>
        <div id="training-setup" hidden><ol class="lesson-list" aria-label="Training lessons">${TRAINING_STEPS.map(step => `<li>${step.title}</li>`).join("")}</ol></div>
        <button id="fullscreen" class="secondary fullscreen-launch" data-fullscreen aria-pressed="false">${icon("expand")}<span>Full screen</span></button>
        <button id="start" class="primary" disabled>Preparing expedition…</button>
      </div>
    </section>
    <div class="bottom-dock">
      <section class="minimap-panel panel"><div class="panel-label">SECTOR OVERVIEW <button id="home" title="Focus base · H" aria-label="Focus base">${icon("hq")}</button></div><canvas id="minimap" width="240" height="200" aria-label="Minimap: click to pan; right-click to command"></canvas><div class="map-legend"><span><i class="friendly"></i>YOU</span><span><i class="hostile"></i>ENEMY</span><span><i class="deposit"></i>RESOURCE</span></div></section>
      <div class="command-deck">
      <section class="selection-panel panel"><div id="group-strip" class="group-strip" aria-label="Control groups"></div><div class="panel-label"><span id="selection-label">EXPEDITION COMMAND</span><span id="selection-count">READY</span></div><div id="selection-info"></div><div class="selection-scroll"><div id="unit-list"></div></div><div id="queue"></div><div class="order-buttons"><button id="field-guide" title="Info & stats">${icon("info","desk")}<span class="order-label">Info & stats</span></button><button id="support-order" hidden title="Support: heal / repair">${icon("medic","desk")}<span class="order-label">Support</span></button><button id="move-order" title="Move">${icon("move")}<span class="order-label">Move</span></button><button id="attack-order" title="Attack-move · F">${icon("crosshair")}<span class="order-label">Attack-move</span> <kbd>F</kbd></button><button id="stop-order" title="Stop · X">${icon("stop")}<span class="order-label">Stop</span> <kbd>X</kbd></button></div></section>
      <section class="command-panel panel"><div class="panel-label"><span id="command-label">COMMAND CENTER</span><span id="command-context">ACTIONS</span></div><div id="commands"></div><div id="upgrade-actions" class="upgrade-actions"></div><div id="command-hint">Select a unit or structure to issue commands.</div><div id="order-tip" aria-hidden="true" hidden></div></section>
      </div>
    </div>
    <nav id="dock-tabs" aria-label="Command panels"><button data-dock="selection" aria-pressed="true">${icon("people")} Selection</button><button data-dock="actions" aria-pressed="false">${icon("worker")} Actions</button><button data-dock="map" aria-pressed="false">${icon("flag")} Map</button></nav>
    <div class="statusbar"><span><i class="live-dot"></i> <span id="status-text">EXPEDITION SYSTEMS INITIALIZING</span></span><span>WASD pan <b>·</b> Scroll zoom <b>·</b> Right-click command <b>·</b> <button id="controls-link">? Controls</button></span><span id="fps">— FPS</span></div>
  </main>
  <div id="modal" class="modal-backdrop" hidden><section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-content"></div></section></div>
`;

const $ = (id) => document.getElementById(id);
const matchStats = createMatchStats();
let settings = loadSettings(matchMedia("(pointer:coarse)").matches),
  mapId = "riverlands",
  enemyCount = 1,
  aiSpeed = "normal",
  alliance = "ffa",
  bonus = null,
  mission = null,
  ambience;
// Story missions: briefing overlay, dialogue box, objectives list and debrief (mission-ui.js).
const missionUI = createMissionUI({ stage: $("stage"), objectivesPanel: $("mission-objectives"), tone: (frequency, duration) => (frequency === 988 ? audio?.sfx.play("objective") : frequency === 196 ? audio?.sfx.play("objective-failed") : null) ?? tone(frequency, duration) });
const localization = localizeDOM(document.body, settings.language);
// Vietnamese story text arrives in its own file; the page is translated again once it is in.
// Story text is plain text nodes, so open briefings, objectives and the Comms log follow.
function syncStoryLanguage() {
  if (settings.language !== 'vi') return;
  loadStory().then(() => { if (settings.language === 'vi') localization.apply('vi'); }, () => {});
}
syncStoryLanguage();
const languageRow = document.createElement('label');
languageRow.className = 'language-choice menu-only';
languageRow.title = 'Language / Ngôn ngữ';
languageRow.innerHTML = `${icon('globe')}<span class="visually-hidden" translate="no">Language / Ngôn ngữ</span><select id="language" aria-label="Language / Ngôn ngữ" translate="no"><option value="en">English</option><option value="vi">Tiếng Việt</option></select>`;
document.querySelector('.top-actions').prepend(languageRow);
$('language').value = settings.language;
$('language').onchange = () => applyPreferences({...settings, language: $('language').value});
// Campaign: progress is saved in this browser; stagePick is the mission chosen on the campaign
// screen and activeStage the one being played (indexes into MISSIONS).
let tutorial = null, tutorialShown = -1;
const query = new URLSearchParams(location.search);
// New players open on Campaign; returning players keep the mode they last started. Browser
// tests (?test) keep the Skirmish default unless they ask for the first visit with ?firstrun.
const MODE_KEY = "frontier-command.mode";
function initialMode(progress) {
  if (query.has("test") && !query.has("firstrun")) return "skirmish";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (["training", "skirmish", "campaign"].includes(last)) return last;
    if (localStorage.getItem("frontier-training-complete") || Object.keys(progress.cleared || {}).length) return "skirmish";
  } catch {
    /* Storage is optional. */
  }
  return "campaign";
}
let campaign = loadProgress(),
  playMode = initialMode(campaign),
  stagePick = nextMission(campaign),
  activeStage = null;
({ map: mapId, enemyCount, aiSpeed, alliance, bonus, mission } = battleSetup());
// Every match, preview and restart is built from the current setup (a story mission included).
const createSim = () => new Simulation({ map: mapId, enemyCount, aiSpeed, alliance, playerBonus: bonus, mission });
let sim = createSim(),
  view,
  selected = new Set(),
  hover = null,
  started = false,
  paused = false,
  mode = null,
  buildType = null,
  muted = settings.muted;
// Slow devices give up cosmetic motion, then resolution, to keep play smooth (governor.js).
// Browser tests opt in with ?governor=1 so their measurements see fixed quality.
const governor = new Governor({
  onChange: (level) => {
    view?.setMotionLevel(level.motion);
    view?.setLifeShare(level.life);
    view?.setRenderScale(level.scale);
  },
});
const governed = !query.has("test") || query.get("governor") === "1";
let uiClock = 0,
  timePrevious = performance.now(),
  accumulator = 0,
  renderAlpha = 1,
  frameCount = 0,
  frameTime = 0,
  coveredRedraw = 0,
  noticeTimeout,
  audioContext,
  audio,
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
  lastTouch = -Infinity,
  touchControls,
  boxSelection = false,
  queueOrders = false,
  buildPoint = null,
  blockedBuildType = null,
  buildFailure = '',
  aimPoint = null;
const compactMedia = matchMedia("(max-width: 1000px), (max-height: 650px)");
// Compact layouts dock the panels at the side on wide screens (mobile.css).
const sideDock = matchMedia("(min-aspect-ratio: 1.35)");
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
    compactMedia.matches || touchInput,
  );
  document.documentElement.classList.toggle("touch-ui", touchInput);
  placeConsole(!document.documentElement.classList.contains('compact-ui'));
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
// The HUD follows the last pointer used: touch brings the touch HUD, a mouse (or a pen beside
// a fine pointer) the desktop one. Browsers send mouse events after a touch; those are ignored.
const finePointer = matchMedia("(any-pointer: fine)");
const isTouch = (e) => isTouchPointer(e, finePointer.matches);
function setInputMode(touch) {
  if (touchInput === touch) return;
  touchInput = touch;
  if (mode === "build") $("confirm-build").hidden = !touch;
  lastSelectionKey = "";
  setLayout();
}
for (const type of ["pointerdown", "pointermove"])
  window.addEventListener(type, (e) => {
    if (isTouch(e)) lastTouch = performance.now();
    else if (touchInput && finePointer.matches && performance.now() - lastTouch > 800) setInputMode(false);
  }, { capture: true, passive: true });
function dockTab(name) {
  document.documentElement.dataset.dock = name;
  for (const button of $("dock-tabs").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.dock === name));
}

function tone(frequency = 520, duration = 0.065) {
  if (
    muted ||
    settings.masterVolume <= 0 ||
    settings.sfxVolume <= 0 ||
    !audioContext ||
    audioQuiet() ||
    performance.now() - lastTone < 70
  )
    return;
  lastTone = performance.now();
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(
    0.07,
    audioContext.currentTime,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration,
  );
  oscillator.connect(gain);
  gain.connect(audio?.bus.sfx ?? audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}
function unlockAudio() {
  try {
    audioContext ||= new AudioContext();
    ambience ||= new Ambience(audioContext);
    if (!audio) {
      audio = new AudioDirector(audioContext, { project: (x, z) => { const p = view.project(x, z, 0.5); return screenMix(p.x, p.y, view.width, view.height); } });
      audio.applySettings(settings);
    }
    // "interrupted" is iOS after a call or app switch; only a user gesture brings it back.
    if (audioContext.state !== "running" && !audioQuiet()) audioPower(audioContext, false);
  } catch {
    /* Audio is optional. */
  }
}
// The audio clock sleeps while the match is paused or the page is hidden. A pause waits for
// the ambience to fade first; the result screen keeps sound for its jingle.
let audioIdle = 0, audioRetry = 0;
const audioQuiet = () => document.hidden || (started && paused && !sim.result);
function syncAudio(dt = 0) {
  if (!audioContext) return;
  const quiet = audioQuiet();
  audioIdle = quiet ? audioIdle + dt : 0;
  if (quiet ? !document.hidden && audioIdle < 0.5 : (audioRetry -= dt) > 0) return;
  audioRetry = 1;
  audioPower(audioContext, quiet);
}
document.addEventListener("visibilitychange", () => syncAudio());
function notice(text) {
  // Successful work is acknowledged by its compact strip, without covering the map.
  if (Object.values(D).some(d=>text===`${d.name} queued.`||text===`${d.name} construction started.`||[2,3].some(level=>text===`${d.name} upgrading to level ${level}.`))) {
    clearTimeout(noticeTimeout); $('notice').classList.remove('show'); return;
  }
  $("notice").textContent = text;
  $("notice").classList.remove("warning");
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
// The order button for the pending targeting mode stays lit, as on an RTS command card.
const ORDER_MODES = { move: 'move-order', attackmove: 'attack-order', patrol: 'patrol-order', attack: 'attack-target-order', support: 'support-order', repair: 'repair-order', rally: 'rally-order' };
function markOrderMode() {
  for (const [type, id] of Object.entries(ORDER_MODES)) $(id)?.classList.toggle('active', mode === type);
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
  aimPoint = null;
  view?.tactics.clearAim();
  for (const tile of $("commands").querySelectorAll(".ability-tile.active")) tile.classList.remove("active");
  $("mode-banner").hidden = true;
  $("world").classList.remove("targeting");
  markOrderMode();
}
function enterMode(type) {
  if (!started || paused || sim.result) return;
  if (type === 'repair' && !selectedEntities().some(e => e.type === 'worker')) {
    notice('Select Harvesters to repair a building.');
    return;
  }
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
  if (type === "context") $("mode-banner").textContent = "CONTEXT ORDER · Choose a deposit, enemy, construction site or damaged building";
  if (type === "repair") $("mode-banner").textContent = "REPAIR · Choose a damaged building";
  if (type === "rally") $("mode-banner").textContent = "RALLY POINT · Choose ground, or a deposit to send new Harvesters mining";
  if (type === 'patrol') $("mode-banner").textContent = 'PATROL · Choose the other end of a repeating route';
  if (type === 'attack') $("mode-banner").textContent = 'ATTACK · Choose a visible enemy unit or building';
  $("notice").classList.remove('show');
  $("world").classList.add("targeting");
  markOrderMode();
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
let groupStripHtml = '';
function focusSelection() {
  const es=selectedEntities();
  if(es.length) view.focusOn(es.reduce((s,e)=>s+e.x,0)/es.length,es.reduce((s,e)=>s+e.z,0)/es.length);
}
function groupMembers(key) {
  return (groups.get(key) || []).filter(id => sim.get(id)?.team === 0);
}
// Assigned control groups as tabs on the console, with a unit icon and live count.
function renderGroupStrip() {
  const tabs = [...groups.keys()].sort().map(key => [key, groupMembers(key)]).filter(([, ids]) => ids.length);
  const html = tabs.map(([key, ids]) => {
    const lead = sim.get(ids[0]), active = ids.length === selected.size && ids.every(id => selected.has(id));
    return `<button data-group="${key}" class="${active ? "active" : ""}" title="Group ${key} · ${ids.length} ${ids.length === 1 ? "unit" : "units"} — click or press ${key} to recall, Ctrl-click to save, Shift-click to add"><kbd>${key}</kbd>${icon(lead.icon || lead.type)}<span>${ids.length}</span></button>`;
  }).join("");
  // Rebuild only on change so a click is never lost to a re-render between press and release.
  if (groupStripHtml !== html) $("group-strip").innerHTML = groupStripHtml = html;
}
function useGroup(key, assign=false, add=false) {
  if(assign) groups.set(key,[...selected]);
  else if(add) groups.set(key,[...new Set([...(groups.get(key)||[]),...selected])]);
  else {
    const live=(groups.get(key)||[]).filter(id=>sim.get(id)?.team===0);
    if(!live.length) { groups.delete(key); renderGroupStrip(); return; }
    setSelection(live);
    if(lastGroup.key===key && performance.now()-lastGroup.time<400) focusSelection();
    lastGroup={key,time:performance.now()};
  }
  if(assign||add) notice(`Control group ${key} ${add?'extended':'assigned'}.`);
  renderGroupStrip();
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
  else if(id.startsWith('stance-')) setStance(id.slice(7), true);
  else if(id==='stop') {clearMode();sendOrder([...selected],{type:'stop'});notice('Orders cleared.');}
  else if(id==='deliver') {
    const ws=es.filter(u=>u.type==='worker'&&u.carry>0);
    if(ws.length){clearMode();sendOrder(ws.map(u=>u.id),{type:'deliver'},queueOrders);}
    else notice('Select Harvesters carrying resources.');
  } else if(id==='upgrade') {if(e?.kind==='building')sim.command({team:0,type:"upgrade",building:e.id});else notice('Select a building to upgrade.');}
  else if(id==='cancel') {
    if(mode || blockedBuildType)clearMode();
    else if(e?.kind==='building') {
      if(!e.complete)sim.command({team:0,type:"cancelBuild",building:e.id});
      else if(e.levelJob)sim.command({team:0,type:"cancelUpgrade",building:e.id});
      else if(e.queue.length)sim.command({team:0,type:"cancelTrain",building:e.id,index:e.queue.length-1});
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
let lastInfoHtml = null;
function updateUI() {
  renderTutorial();
  missionUI.renderObjectives(sim);
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
  const infoHtml = !e
    ? `<div class="selection-empty">${icon("logo")}<div><h3>Awaiting your command</h3><p>Click a unit or drag to select your expedition.</p></div></div>`
    : selectionStatus(sim,es);
  // Only touch the DOM when the panel text changed, so hover and text selection survive.
  if (infoHtml !== lastInfoHtml) {
    lastInfoHtml = infoHtml;
    $("selection-info").innerHTML = infoHtml;
  }
  $("support-order").hidden = !es.some(u => u.support);
  $("patrol-order").hidden = !es.some(u => u.kind === 'unit' && u.type !== 'worker' && u.damage > 0);
  $("attack-target-order").hidden = !es.some(u => u.type === 'worker');
  // Phones repair by tapping a damaged building; the button would add a row to the small dock.
  $("repair-order").hidden = document.documentElement.classList.contains('compact-ui') || !es.some(u => u.team === 0 && sim.canRepair(u));
  $("rally-order").hidden = !es.some(u => u.kind === 'building' && u.team === 0 && u.complete && u.trains?.length);
  // Desktop hides unit-only orders while only buildings are selected.
  document.documentElement.classList.toggle('no-units', !es.some(u => u.kind === 'unit'));
  document.documentElement.classList.toggle('many-orders', [...document.querySelectorAll('.order-buttons button')].filter(b => !b.hidden).length > 5);
  $("command-context").title = `Command core technology ${sim.techLevel()} / 3`;
  const signature = `${es.map((e) => e.id).join(",")}/${p.upgrade}/${e?.level}/${sim.techLevel()}/${touchInput}/${document.documentElement.classList.contains("compact-ui")}/${sideDock.matches}`;
  if (lastSelectionKey !== signature) {
    lastSelectionKey = signature;
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
    const actions =
      e && es.length === 1 && e.kind === "building"
        ? e.trains || []
        : es.some((u) => u.type === "worker")
          ? BUILDINGS
          : [];
    const structure = es.length === 1 && e?.kind === "building" && !e.trains;
    // Fighting units without a Harvester among them: abilities and stance take the card.
    const tactics = !actions.length && tacticalUnits(es).length
      ? tacticsCardHTML(sim, es, { compact: document.documentElement.classList.contains("compact-ui"), side: sideDock.matches, keys: !touchInput }) : "";
    $("commands").classList.toggle("tactics-card", !!tactics);
    $("command-label").textContent = es.some((u) => u.type === "worker")
      ? "CONSTRUCTION"
      : e?.trains
        ? "PRODUCTION"
        : structure ? "STRUCTURE" : "FIELD ORDERS";
    $("command-context").textContent = actions.length
      ? `${actions.length} AVAILABLE`
      : structure ? `LEVEL ${e.level}` : "TACTICAL";
    $("commands").innerHTML =
      actions
        .map((type, index) => {
          const d = D[type];
          const label = type === 'upgrade' ? 'Weapons +' : d.name;
          return `<button class="command-tile" data-action="${type}" data-hotkey="${ACTION_KEYS[index]}" aria-label="${d.name}, ${d.cost[0]} alloy${d.cost[1] ? ` and ${d.cost[1]} energy` : ''}" title="${ACTION_KEYS[index]} · ${d.name} · ${d.description}"><kbd class="action-key">${ACTION_KEYS[index]}</kbd>${hasPortrait(type) ? portrait(type) : icon(d.icon || type)}<span>${label}</span><small><b class="alloy-text">${d.cost[0]}</b>${d.cost[1] ? ` <b class="energy-text">/ ${d.cost[1]}</b>` : ""}</small></button>`;
        })
        .join("") || tactics || (structure ? `<p class="structure-hint">${e.description}</p>` : e?.kind==='building' ? '' :
      `<div class="tactical-hint">${icon("crosshair")}<strong>${e ? "Control the battlefield" : "Your expedition is ready"}</strong><p>${e ? (touchInput ? "Open Selection for Move, Attack-move and Support orders, then tap a target on the battlefield." : "Right-click to move or engage.<br>Attack-move to advance and fight.") : "Select the Command core to train Harvesters, or the Barracks to grow your army."}</p></div>`);
    $("upgrade-actions").innerHTML = e?.kind === 'building' && es.length === 1 ?
      `<button data-level title="U · Upgrade building">${e.level < 3 ? `<span class="up-name">Upgrade L${e.level+1}</span><span class="up-cost"><span class="sep"> · </span>${sim.levelCost(e).join('/')}</span> <kbd>U</kbd>` : '<span class="up-name">Maximum level 3</span>'}</button>` : '';
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
  // Ability cooldowns and the pressed stance, refreshed in place.
  if ($("commands").classList.contains("tactics-card")) {
    if (mode === "barrage") refreshAim(aimPoint);
    updateTacticsCard($("commands"), sim, es, { compact: document.documentElement.classList.contains("compact-ui"), side: sideDock.matches,
      blocked: !started || paused || !!sim.result, aiming: mode === "barrage" ? "barrage" : null });
  } else if (mode === "barrage") clearMode();
  // Live vitals on each roster card; the cards themselves are rebuilt only on selection change.
  for (const card of $("unit-list").querySelectorAll("[data-select]")) {
    const u = sim.get(Number(card.dataset.select));
    if (!u) continue;
    const hp = u.hp / u.maxHp;
    card.style.setProperty("--hp", hp.toFixed(3));
    card.style.setProperty("--sh", u.maxShield ? (u.shield / u.maxShield).toFixed(3) : "0");
    card.classList.toggle("critical", hp < 0.35);
    const rank = String(clampRank(u.rank));
    if (card.dataset.rank !== rank) card.dataset.rank = rank;
  }
  renderGroupStrip();
  // Desktop shares the selection queue; mobile retains a queue in each tab.
  productionUI.update(document.documentElement.classList.contains('compact-ui') && es.length===1?e:null, !started || paused || !!sim.result);
  selectionWorkUI.update(es.length===1?e:null, !started || paused || !!sim.result);
  const levelButton=$('upgrade-actions').querySelector('[data-level]');
  if(levelButton)levelButton.disabled=!started||paused||!!sim.result||!e.complete||!!e.levelJob||e.queue.length>0||e.level>=3;
  for (const b of document.querySelectorAll(".order-buttons button"))
    b.disabled = !started || paused || (!["field-guide", "rally-order"].includes(b.id) && !es.some((u) => u.kind === "unit"));
  for (const b of document.querySelectorAll(".touch-controls button"))
    b.disabled = !started || paused || !!sim.result;
  if (mode === "build" && buildPoint) {
    const error = sim.placement(buildType, 0, buildPoint.x, buildPoint.z);
    $("confirm-build").disabled = !!error || paused || !started;
    view.preview.material.color.setHex(error ? 0xef7660 : 0x92ebc5);
  }
  constructionUI.update({sim, selected:es, mode, type:buildType, point:buildPoint, blockedType:blockedBuildType, failure:buildFailure, started, paused, touch:touchInput});
}

// ---- Abilities, stances and veterancy (rules: sim/tactics.js; logic: tactics-ui.js).
function useAbility(id) {
  if (!started || paused || sim.result) return;
  const group = abilityGroups(sim, selectedEntities(), 99).find((g) => g.id === id);
  if (!group) return;
  if (!group.ready) { notice(`${group.name} is recharging.`); return; }
  if (group.aimed) { enterAim(); return; }
  clearMode();
  if (sim.command({ team: 0, type: "ability", ids: group.ids })) tone(700, 0.1);
  else notice(id === "triage" ? "No injured infantry in range." : id === "fortify" ? "No damaged vehicle or building in range." : `${group.name} is recharging.`);
  updateUI();
}
function setStance(stance, announce = false) {
  if (!started || paused || sim.result) return;
  const ids = selectedEntities().filter(takesStance).map((e) => e.id);
  if (!ids.length) { notice("Select soldiers or tanks to set a stance."); return; }
  if (sim.command({ team: 0, type: "stance", ids, stance })) {
    tone(600);
    if (announce) notice(`Stance: ${STANCE_INFO[stance].label}`);
  }
  updateUI();
}
// Barrage is aimed: a target circle follows the pointer (or the last tap), a ring around each
// ready Breaker shows its reach, and the circle turns red beyond it.
function enterAim() {
  clearMode();
  mode = "barrage";
  $("mode-banner").hidden = false;
  $("mode-banner").textContent = touchInput ? "BARRAGE · Tap a target inside the ring" : "BARRAGE · Click a target inside the ring · Esc to cancel";
  $("mode-controls").hidden = false;
  $("notice").classList.remove("show");
  $("world").classList.add("targeting");
  refreshAim(!touchInput && hoverPoint ? view.point(hoverPoint.x, hoverPoint.y) : null);
  updateUI();
}
function refreshAim(point) {
  const aim = aimState(sim, selectedEntities(), point);
  if (!aim.sources.length) { clearMode(); return null; }
  aimPoint = point;
  view.tactics.showAim(aim.sources, aim.range, aim.radius, point, aim.ok);
  return aim;
}
function fireBarrage(point) {
  if (!point || !started || paused || sim.result) return;
  const aim = refreshAim(point);
  if (!aim) { notice("Barrage is recharging."); updateUI(); return; }
  if (!aim.ok) {
    $("mode-banner").textContent = "BARRAGE · Out of range: choose a spot inside the ring";
    tone(260, 0.12);
    return;
  }
  if (sim.command({ team: 0, type: "ability", ids: aim.casters, x: point.x, z: point.z })) {
    tone(520, 0.12);
    clearMode();
  }
  updateUI();
}
// Auto-cast is a setting (settings.js): the match is told at its start, after a save is
// loaded and whenever the setting changes.
function syncAutocast(always = true) {
  if (!started || sim.result) return;
  if (always || !!sim.players[0].autocast !== !!settings.autocast) sim.command({ team: 0, type: "autocast", on: !!settings.autocast });
}
function promoted(event) {
  const unit = sim.get(event.id);
  notice(`${unit?.name || "Unit"} promoted to rank ${event.rank}`);
  tone(990, 0.16);
}
// An enemy wave has set out for our core: warn, and ping where it gathers for about 6 s.
const pings = [];
function incomingAlert(event) {
  notice("Enemy attack incoming!");
  $("notice").classList.add("warning");
  if (Number.isFinite(event.x) && Number.isFinite(event.z)) pings.push({ x: event.x, z: event.z, at: sim.time });
  tone(300, 0.3);
}
// Capture points: a toast and a ping when one changes hands.
const pointOwners = new Map();
function syncPointOwners() {
  pointOwners.clear();
  for (const [name, p] of Object.entries(sim.mission?.points || {})) pointOwners.set(name, p.owner ?? null);
}
function pointAlert(event) {
  const name = pointLabel(sim.missionDef, event.name), before = pointOwners.get(event.name) ?? null;
  pointOwners.set(event.name, event.owner);
  if (event.owner === 0) { notice(`${name} captured`); }
  else {
    notice(before === 0 ? `${name} lost` : `${name} taken by the enemy`);
    $("notice").classList.add("warning");
  }
  pings.push({ x: event.x, z: event.z, at: sim.time });
}
// A mission camera cue: a smooth 1.2 s pan that any camera input from the player cancels.
let cameraPan = null;
function startCameraPan(x, z) {
  if (!view) return;
  if (view.reducedMotion?.matches) { view.focusOn(x, z); return; }
  cameraPan = { fromX: view.focus.x, fromZ: view.focus.z, x, z, t: 0 };
}
for (const type of ["pointerdown", "wheel", "keydown"])
  window.addEventListener(type, (event) => {
    if (cameraPan && (type === "keydown" || (event.target instanceof Element && event.target.closest("#world, #minimap, #home, .touch-controls")))) cameraPan = null;
  }, { capture: true, passive: true });
let minimapBase = null, minimapFog = null;
function minimap() {
  const {size:MAP_SIZE,half:HALF,grid:GRID}=sim.terrain;
  const c = $("minimap"),
    ctx = c.getContext("2d"),
    w = c.width,
    h = c.height,
    px = (x) => ((x + HALF) / MAP_SIZE) * w,
    pz = (z) => ((z + HALF) / MAP_SIZE) * h;
  // Terrain and road depend only on the map: paint them once per terrain into an offscreen canvas.
  if (minimapBase?.terrain !== sim.terrain || minimapBase.canvas.width !== w || minimapBase.canvas.height !== h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const b = canvas.getContext("2d");
    // The same surface colours as the battlefield (visual-style.json), on every map.
    const surfaces = surfaceColors(sim.terrain.id);
    b.fillStyle = surfaces.dirt;
    b.fillRect(0, 0, w, h);
    if (sim.terrain.id !== "classic")
      for (let z = 0; z < GRID; z++)
        for (let x = 0; x < GRID; x++) {
          b.fillStyle =
            surfaces[sim.terrain.at(x * 2 - HALF + 1, z * 2 - HALF + 1)];
          b.fillRect((x * w) / GRID, (z * h) / GRID, w / GRID + 1, h / GRID + 1);
        }
    b.strokeStyle = surfaces.road;
    b.lineWidth = 9;
    b.beginPath();
    b.moveTo(px(-25), pz(24));
    b.lineTo(px(25), pz(-24));
    if (sim.terrain.id === "classic") b.stroke();
    minimapBase = { terrain: sim.terrain, canvas };
  }
  ctx.drawImage(minimapBase.canvas, 0, 0);
  for (const wall of sim.entities) {
    if (wall.kind !== "wall" || wall.hp <= 0) continue;
    ctx.fillStyle = "#8d8a80";
    ctx.beginPath();
    ctx.arc(px(wall.x), pz(wall.z), (wall.radius / MAP_SIZE) * w, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fog is one pixel per cell, scaled up in a single draw instead of a fillRect per cell.
  if (minimapFog?.grid !== GRID) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = GRID;
    const fctx = canvas.getContext("2d");
    minimapFog = { grid: GRID, canvas, fctx, image: fctx.createImageData(GRID, GRID) };
  }
  const fogPx = minimapFog.image.data;
  for (let i = 0; i < GRID * GRID; i++) {
    const o = i * 4;
    if (sim.visible[0][i]) fogPx[o + 3] = 0;
    else if (sim.explored[0][i]) { fogPx[o] = 8; fogPx[o + 1] = 20; fogPx[o + 2] = 19; fogPx[o + 3] = 115; }
    else { fogPx[o] = 17; fogPx[o + 1] = 31; fogPx[o + 2] = 32; fogPx[o + 3] = 255; }
  }
  minimapFog.fctx.putImageData(minimapFog.image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(minimapFog.canvas, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  // Capture points: a ring in the owner's colour (grey while neutral) and the taker's progress.
  for (const p of Object.values(sim.mission?.points || {})) {
    const cx = px(p.x), cy = pz(p.z), radius = Math.max(4.5, (p.r / MAP_SIZE) * w), owned = p.owner !== null && p.owner !== undefined;
    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle = owned ? teamColors(settings, mission)[p.owner] : "#d3dadb";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (owned) { ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.stroke();
    if (p.taker !== null && p.taker !== undefined) {
      ctx.strokeStyle = teamColors(settings, mission)[p.taker];
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.since / 5));
      ctx.stroke();
    }
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
    if (sim.players[e.team]?.eliminated || (sim.isVisible(e) && !sim.get(id))) {
      rememberedBuildings.delete(id);
      continue;
    }
    if (!sim.isVisible(e)) {
      ctx.fillStyle = teamColors(settings, mission)[e.team];
      ctx.globalAlpha = 0.45;
      ctx.fillRect(px(e.x) - 3, pz(e.z) - 3, 6, 6);
      ctx.globalAlpha = 1;
    }
  }
  const teams = teamColors(settings, mission);
  for (const e of sim.entities)
    if (e.team >= 0 && sim.isVisible(e)) {
      ctx.fillStyle = teams[e.team];
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
  for (let i = pings.length - 1; i >= 0; i--) {
    const ping = pings[i], age = sim.time - ping.at;
    if (!(age >= 0 && age < 6)) { pings.splice(i, 1); continue; }
    const pulse = (performance.now() / 900) % 1;
    ctx.strokeStyle = "#ff8a6a";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - pulse * 0.75;
    ctx.beginPath();
    ctx.arc(px(ping.x), pz(ping.z), 4 + pulse * 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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

// Hover picking raycasts every visible model: at most once a frame, and only after the pointer
// or the camera moved.
let hoverPoint = null, hoverStale = false, hoverCamera = "";
function refreshHover() {
  if (!hoverPoint) return;
  const camera = `${view.focus.x},${view.focus.z},${view.zoom},${view.width},${view.height}`;
  if (!hoverStale && camera === hoverCamera) return;
  hoverStale = false;
  hoverCamera = camera;
  const { x, y } = hoverPoint;
  hover = view.pick(x, y, sim);
  $("hover-label").hidden = !hover || !!drag || !!mode;
  if (hover && !drag && !mode) {
    $("hover-label").textContent =
      hover.kind === "resource"
        ? `${hover.type.toUpperCase()} · ${Math.floor(hover.amount)}`
        : `${hover.name}${hover.team > 0 ? " · ENEMY" : ""}`;
    const rect = view.renderer.domElement.getBoundingClientRect();
    $("hover-label").style.left = `${Math.min(x - rect.left + 16, view.width - 240)}px`;
    $("hover-label").style.top = `${y - rect.top + 20}px`;
  }
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

// A rally on a deposit remembers it, so new Harvesters gather there instead of standing idle.
function rallyAt(point, target) {
  return target?.kind === "resource" ? { x: target.x, z: target.z, target: target.id } : { x: point.x, z: point.z };
}
function commandAt(point, target, append = false, forced = null) {
  if (!point || !started || paused || sim.result) return;
  if (forced === 'context') forced = null;
  const es = selectedEntities(),
    units = es.filter((e) => e.kind === "unit");
  if (forced === 'rally') {
    sim.command({team:0,type:'rally',ids:es.filter(e=>e.kind==='building' && e.team===0 && e.complete && e.trains?.length).map(e=>e.id),rally:rallyAt(point,target)});
    notice(target?.kind==='resource' ? 'Rally point on the deposit: new Harvesters start mining.' : 'Rally point established.');
    view.marker(point.x,point.z); return;
  }
  if (forced === 'repair') {
    const workers = units.filter(e => sim.repairValid(e,target));
    if (!workers.length || target.hp >= target.maxHp) { $("mode-banner").textContent = 'REPAIR · Choose a damaged building'; return false; }
    sendOrder(workers.map(e => e.id),{type:'repair',target:target.id},append);
    view.marker(target.x,target.z); tone(440); return true;
  }
  if (forced === 'attack') {
    if (!target || target.kind === 'resource' || !(target.team > 0 || target.kind === 'wall') || !sim.isVisible(target)) {
      $("mode-banner").textContent = 'ATTACK · Choose a visible enemy or a concrete wall';
      return false;
    }
    sendOrder(units.filter(e => e.damage > 0).map(e => e.id), { type: 'attack', target: target.id }, append);
    view.marker(target.x, target.z, 0xef9f75);
    tone(440);
    return true;
  }
  if (forced === "support") {
    const helpers = units.filter(e => sim.supportValid(e,target));
    if (!helpers.length) { notice("Medic: select allied infantry. Engineer: select a completed building or vehicle."); return false; }
    sendOrder(helpers.map(e => e.id),{type:"support",target:target.id},append);
    return true;
  }
  if (!forced && target?.team === 0) {
    const helpers = units.filter(e => sim.supportValid(e,target));
    sendOrder(helpers.map(e => e.id),{type:"support",target:target.id},append);
    for (const helper of helpers) units.splice(units.indexOf(helper),1);
  }
  for (const b of es.filter((e) => !forced && !es.some(u=>u.kind==='unit') && e.team === 0 && e.kind === "building" && e.complete && e.trains?.length)) {
    sim.command({ team: 0, type: "rally", ids: [b.id], rally: rallyAt(point, target) });
    notice(target?.kind === 'resource' ? 'Rally point on the deposit: new Harvesters start mining.' : "Rally point established.");
  }
  if (!units.length) {
    view.marker(point.x, point.z);
    return;
  }
  let order = { type: forced || "move", ...point };
  if ((!forced || forced==='attackmove') && (target?.team > 0 || target?.kind === 'wall') && sim.isVisible(target))
    order = { type: "attack", target: target.id };
  if(order.type==='attack'){
    sendOrder(units.filter(e=>e.damage>0).map(e=>e.id),order,append);
    sendOrder(units.filter(e=>!(e.damage>0)).map(e=>e.id),{type:'move',...point},append);
    view.marker(point.x,point.z,0xef9f75);tone(440);return;
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
      ? units.filter((e) => e.type !== "worker" && sim.repairValid(e, target)) : [];
    if (fixers.length) sendOrder(fixers.map((e) => e.id), { type: "repair", target: target.id }, append);
    sendOrder(
      units.filter((e) => e.type !== "worker" && !fixers.includes(e)).map((e) => e.id),
      order,
      append,
    );
    // Harvesters with a job need no more orders: let go of them so the next tap can select
    // a building (tapping the Command core would otherwise order a cargo delivery).
    if (units.every((e) => e.type === "worker" || fixers.includes(e)) && !append) {
      view.marker(target.x, target.z, view.colors[0]);
      tone(440);
      setSelection([]);
      return;
    }
  } else
    sendOrder(
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
  // Snap to the nearest valid site so a tap beside a blocked spot still builds.
  point = sim.findPlacement(buildType, 0, point.x, point.z) || point;
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
  const b = worker && sim.command({ team: 0, type: "build", worker: worker.id, building: buildType, x: point.x, z: point.z });
  if (b) {
    clearMode();
    setSelection([b.id]);
    if (audio) audio.sfx.play("construct"); else tone(330, 0.15);
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
  if (mode === "barrage") {
    fireBarrage(point);
    return;
  }
  if (mode) {
    if (commandAt(point, ["support","context","attack","attackmove","repair","rally"].includes(mode) ? target : null, queueOrders, mode) !== false) clearMode();
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
        (target.type === "hq" && workers.some((e) => e.carry > 0)) ||
        (target.kind === "building" && target.hp < target.maxHp))
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
    isTouch,
    activate: () => {
      unlockAudio();
      lastTouch = performance.now();
      setInputMode(true);
      pointer.inside = false;
      hover = hoverPoint = null;
      $("hover-label").hidden = true;
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
    if (isTouch(e)) return;
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
    if (isTouch(e)) return;
    pointer = { x: e.clientX, y: e.clientY, inside: true };
    hoverPoint = { x: e.clientX, y: e.clientY };
    hoverStale = true;
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
    if (mode === "barrage") refreshAim(view.point(e.clientX, e.clientY));
    if (mode === "build") {
      const aim = view.point(e.clientX, e.clientY),
        p = aim && (sim.findPlacement(buildType, 0, aim.x, aim.z) || aim);
      if (p) {
        view.preview.visible = true;
        view.preview.position.set(p.x, 0.23, p.z);
        view.preview.material.color.setHex(
          sim.placement(buildType, 0, p.x, p.z) ? 0xef7660 : 0x92ebc5,
        );
      }
    }
  });
  canvas.addEventListener("pointerleave", () => {
    if (mode === "barrage" && !touchInput) refreshAim(null);
    pointer.inside = false;
    hover = hoverPoint = null;
    $("hover-label").hidden = true;
  });
  // The footer and the desktop console cover the canvas's bottom edge. Track hover there so
  // screen-edge scrolling works along the whole border (as in StarCraft), without passing
  // clicks through the UI or scrolling while a button is under the pointer.
  for (const hud of [document.querySelector(".statusbar"), document.querySelector(".bottom-dock")]) {
    hud.addEventListener("pointermove", (e) => {
      if (isTouch(e)) return;
      pointer = { x: e.clientX, y: e.clientY, inside: !e.target.closest("button") };
    });
    hud.addEventListener("pointerleave", () => { pointer.inside = false; });
  }
  canvas.addEventListener("pointerup", (e) => {
    if (isTouch(e)) return;
    if (!drag) return;
    const old = drag;
    drag = null;
    $("selection-box").style.display = "none";
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (old.button !== 0 || e.button!==0 || paused || !started || sim.result || document.elementFromPoint(e.clientX,e.clientY)!==canvas) return;
    const point = view.point(e.clientX, e.clientY);
    if (mode === "build" && point) {
      confirmBuild(sim.findPlacement(buildType, 0, point.x, point.z) || point);
      return;
    }
    if (mode === "barrage") {
      fireBarrage(point);
      return;
    }
    if (mode) {
      if (commandAt(point, ["support","context","attack","attackmove","repair","rally"].includes(mode) ? view.pick(e.clientX,e.clientY,sim) : null, e.shiftKey||queueOrders, mode) !== false) clearMode();
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
      if(modalType==='fullscreen')closeModal();
      else if(document.documentElement.classList.contains('objectives-open'))setObjectivesOpen(false);
      else if(mode || blockedBuildType)clearMode();
      else if(modalType==='help')closeModal();
      else if(started&&!sim.result)togglePause();
      return;
    }
    if(key===' '&&!e.ctrlKey) {
      if(e.target instanceof Element && e.target.closest('#mission-toggle'))return;
      // Before play, Space must activate the focused Start/Settings button.
      if(!started && e.target instanceof Element && e.target.closest('button'))return;
      // Inside a modal, Space activates the focused button natively.
      if(modalType && e.target instanceof Element && e.target.closest('#modal button'))return;
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
  const suspendInput = () => {
    touchControls.reset();
    drag = null;
    pointer.inside = false;
    keys.clear();
    $("selection-box").style.display = "none";
    // Safari/embedded browsers can blur before visibilitychange or pagehide.
    // Stay paused on return, so an interrupted gesture cannot issue an order.
    // Only a running match pauses: an open modal, settings or the guide already hold it.
    if (started && !paused && !sim.result && !modalType && !settingsUI.active) togglePause();
  };
  window.addEventListener("blur", suspendInput);
  window.addEventListener("pagehide", suspendInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspendInput();
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
      if (mode === "barrage") fireBarrage(p);
      else if (mode && mode !== "build") {
        if (commandAt(p, null, e.shiftKey||queueOrders, mode) !== false) clearMode();
      } else view.focusOn(p.x, p.z);
    }
  });
  $("minimap").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (e.pointerType === "touch") return;
    if(mode){clearMode();return;}
    const p = mapPoint(e);
    commandAt(p, null, e.shiftKey||queueOrders);
  });
}

// A mission can field the player without a Command core: the squad is home then.
function focusHome() {
  cameraPan = null;
  const own = sim.own(0), hq = own.find((e) => e.type === "hq");
  const squad = hq ? null : own.find((e) => e.kind === "unit" && e.type !== "worker") || own[0];
  if (hq) view?.focusOn(hq.x + 5, hq.z - 5);
  else if (squad) view?.focusOn(squad.x, squad.z);
}
function selectHome() {
  const own = sim.own(0), hq = own.find((e) => e.type === "hq");
  setSelection(hq ? [hq.id] : own.filter((e) => e.kind === "unit" && e.type !== "worker").map((e) => e.id));
}
// One place to show/hide the modal: inert the HUD behind it and restore focus on close.
let modalReturnFocus = null;
function setModalOpen(open) {
  // The top bar is a sibling of the modal: everything in it goes inert except sound, Help and Pause.
  const modal = $("modal"), main = document.querySelector("main");
  modal.classList.remove("debrief-wide", "result-wide");
  const behind = [main, document.querySelector(".brand"), document.querySelector(".resource-bar"),
    ...[...document.querySelector(".top-actions").children].filter((node) => !["audio", "help", "pause"].includes(node.id))];
  if (open) {
    if (modal.hidden) modalReturnFocus = document.activeElement;
    for (const node of behind) if (node) node.inert = true;
    modal.hidden = false;
    return;
  }
  const wasOpen = !modal.hidden;
  modal.hidden = true;
  for (const node of behind) if (node) node.inert = false;
  const back = modalReturnFocus;
  modalReturnFocus = null;
  if (!wasOpen) return;
  const target = back && back.isConnected && !back.closest("[hidden]") && !back.disabled ? back : $("pause");
  target?.focus?.({ preventScroll: true });
}
$("modal").addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const items = [...$("modal").querySelectorAll("button:not([disabled])")].filter((b) => !b.hidden);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (!$("modal").contains(document.activeElement)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
function closeModal() {
  // Help opened over the pause menu goes back to it instead of resuming the match.
  if (modalType === "help" && helpOverPause && started && !sim.result) { showPause(); return; }
  setModalOpen(false);
  $("modal").classList.remove("help-wide");
  modalType = null;
  if (started && !sim.result) paused = false;
  if (audioContext) unlockAudio();
  keys.clear();
}
// WebGL context loss (GPU reset, a long time in the background): hold the match and say so.
// A lost match in progress comes back on the pause menu, never straight into play.
let graphicsHeld = false, graphicsNoticed = false;
function graphicsLost() {
  const text = "Graphics were interrupted. Restoring…";
  graphicsHeld = started && !sim.result && (!paused || modalType === "pause" || modalType === "help");
  if (settingsUI.active || (modalType && !graphicsHeld)) { notice(text); graphicsNoticed = true; return; }
  if (started) paused = true;
  touchControls?.reset();
  drag = null;
  pointer.inside = false;
  keys.clear();
  clearMode();
  modalType = "graphics";
  $("modal").classList.remove("help-wide");
  setModalOpen(true);
  $("modal-content").innerHTML = `<h2 id="modal-title">Graphics were interrupted.</h2><p role="status">Restoring…</p>`;
}
function graphicsRestored() {
  if (graphicsNoticed) $("notice").classList.remove("show");
  graphicsNoticed = false;
  if (modalType !== "graphics") return;
  if (graphicsHeld && started && !sim.result) showPause();
  else { modalType = null; setModalOpen(false); }
  graphicsHeld = false;
}
function showFullscreenHelp(reason) {
  if (sim.result || modalType === "graphics") return;
  paused = true;
  touchControls?.reset();
  drag = null;
  pointer.inside = false;
  keys.clear();
  $("selection-box").style.display = "none";
  modalType = "fullscreen";
  $("modal").classList.remove("help-wide");
  setModalOpen(true);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const message = reason === 'exit'
    ? '<p>Could not leave full screen. Use your browser’s exit control or press Esc on a keyboard.</p>'
    : standalone
      ? '<p>You are already playing in a home-screen web app without the browser bars.</p>'
      : '<p>This browser could not enter full screen.</p><p>On iPhone, open this game in Safari, tap Share → Add to Home Screen, then enable Open as Web App if shown. Launch the game from that new icon.</p>';
  $("modal-content").innerHTML = `<h2 id="modal-title">Full screen</h2>${message}<p>iPhone app-switching gestures still work. Start camera drags away from the screen edges.</p><button class="primary" data-resume>${started ? 'Resume operation' : 'Back'}</button>`;
  $("modal").querySelector('[data-resume]').focus({ preventScroll: true });
}
const fullscreen = createFullscreen({
  onUnavailable: showFullscreenHelp,
  onChange: ({ active, pending }) => {
    const label = active ? 'Exit full screen' : 'Full screen';
    for (const button of document.querySelectorAll('[data-fullscreen]')) {
      // Keep keyboard focus during the asynchronous request. The controller
      // ignores duplicate activations while pending; native disabled loses focus.
      button.setAttribute('aria-disabled', String(pending));
      button.setAttribute('aria-pressed', String(active));
      button.title = label;
      button.innerHTML = `${icon(active ? 'collapse' : 'expand')}<span>${label}</span>`;
    }
  },
});
function toggleFullscreenFrom(button) {
  // Safari does not focus a button on touch/click by default. Remember a useful
  // return target before opening fallback help, including before the game starts.
  button.focus({ preventScroll: true });
  fullscreen.toggle();
}
$("fullscreen").onclick = (event) => toggleFullscreenFrom(event.currentTarget);
fullscreen.refresh();
document.addEventListener('fullscreenchange', setLayout);
document.addEventListener('webkitfullscreenchange', setLayout);
function applyPreferences(value) {
  settings = value;
  localization.apply(settings.language);
  syncStoryLanguage();
  $('language').value = settings.language;
  muted = settings.muted;
  audio?.applySettings(settings);
  $("fps").hidden = !settings.showFps;
  view?.applySettings(settings);
  syncAutocast(false);
  $("quality").textContent = settings.quality === "eco" ? "Eco" : "High";
  $("audio").innerHTML = icon(muted ? "muted" : "volume");
  $("audio").setAttribute("aria-label", muted ? "Enable sound" : "Mute sound");
  $("audio").title = muted ? "Enable sound" : "Mute sound";
  document.documentElement.style.setProperty(
    "--team-friendly",
    palette(settings)[0],
  );
  document.documentElement.style.setProperty(
    "--team-hostile",
    teamColors(settings, mission)[1],
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
// Briefing: Skirmish picks the map, rivals, AI speed and alliance; Campaign plays the
// stages in order. The battle behind the briefing always previews the current choice.
function battleSetup() {
  if(playMode === "training") return {map:"classic",enemyCount:1,aiSpeed:"relaxed",alliance:"ffa",bonus:null,mission:null};
  const m = MISSIONS[stagePick];
  return playMode === "campaign"
    ? { map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, bonus: m.bonus || null, mission: m }
    : { map: $("scenario").value, enemyCount: Number($("enemy-count").value), aiSpeed: $("ai-speed").value, alliance: $("alliance").value, bonus: null, mission: null };
}
function describeRivals({ enemyCount: count, aiSpeed: speed, alliance: side }) {
  const pace = `${AI_SPEEDS[speed].label} speed`;
  return count === 1 ? `1 AI · ${pace}` : `${count} AIs · ${side === "coalition" ? "allied against you" : "free-for-all"} · ${pace}`;
}
const mapName = (id) => (MAPS[id] || String(id)).split(" · ")[0];
function updateHeading() {
  const stage = started ? activeStage : playMode === "campaign" ? stagePick : null;
  document.querySelector(".map-heading p").innerHTML = `${mapName(mapId).toUpperCase()} <span>·</span> SECTOR 07`;
  document.querySelector(".map-heading h1").innerHTML = stage === null
    ? `${mapName(mapId)}<span>.</span>` : `Mission ${stage + 1} · ${MISSIONS[stage].title}<span>.</span>`;
  $("operation-label").textContent = stage === null
    ? "OPERATION 01 / SKIRMISH" : `CAMPAIGN · MISSION ${String(stage + 1).padStart(2, "0")} / ${String(MISSIONS.length).padStart(2, "0")}`;
}
// The Continue button appears while a saved match exists (savegame.js).
function renderContinue() {
  const save = started ? null : readSave(), button = $("continue");
  const known = save && (save.mode !== "campaign" || missionIndex(save.missionId) >= 0);
  button.hidden = !known;
  if (!known) return;
  const title = save.mode === "campaign" ? MISSIONS[missionIndex(save.missionId)].title : mapName(save.map);
  const html = `${icon("play")}<span class="continue-text"><strong>Continue</strong><small><span>${title}</span> · <span translate="no">${formatTime(save.time)}</span></small></span>`;
  if (button.dataset.html !== html) { button.dataset.html = html; button.innerHTML = html; }
}
function renderCampaign() {
  const card = (m, i) => {
    const open = isUnlocked(campaign, i), done = isCleared(campaign, i), medal = bestMedal(campaign, i);
    const state = done ? `${medalBadge(medal)}<span translate="no">${missionClock(bestTime(campaign, i))}</span>` : open ? "" : icon("lock");
    return `<li><button data-stage="${i}" data-mission="${m.id}"${i === stagePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}${open ? "" : ' title="Clear the previous mission to unlock"'}><b>${i + 1}</b><span><strong>${m.title}</strong><small>${mapName(m.map)}</small></span><em${done ? ` data-medal="${medal}"` : ""}>${state}</em></button></li>`;
  };
  $("campaign-setup").innerHTML = ACTS.map(({ act, title }) =>
    `<section class="act" aria-labelledby="act-${act}"><h3 class="act-title" id="act-${act}"><span>ACT ${act}</span> <strong>${title}</strong></h3><ol class="stage-list" aria-label="Campaign missions">${MISSIONS.map((m, i) => (m.act === act ? card(m, i) : "")).join("")}</ol></section>`).join("");
}
function renderBriefing() {
  const setup = battleSetup(), inCampaign = playMode === "campaign";
  renderContinue();
  $("briefing-goal").textContent = playMode === "training" ? "Complete eight guided lessons"
    : inCampaign ? (MISSIONS[stagePick].objectives.find((o) => !o.hidden && !o.optional) || MISSIONS[stagePick].objectives[0]).text : "Eliminate enemy command";
  for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === playMode));
  $("skirmish-setup").hidden = playMode !== "skirmish";
  $("campaign-setup").hidden = !inCampaign;
  $("training-setup").hidden = playMode !== "training";
  // Alliances need at least two AIs.
  $("alliance").disabled = Number($("enemy-count").value) < 2;
  $("briefing-rivals").textContent = playMode === "training" ? "Practice field · no AI attacks" : describeRivals(setup);
  if (inCampaign) {
    const m = MISSIONS[stagePick];
    $("briefing-title").textContent = `Mission ${stagePick + 1} · ${m.title}`;
    $("briefing-text").textContent = m.briefing.lines[0]?.text || m.briefing.place;
    renderCampaign();
  } else {
    $("briefing-title").innerHTML = "A new frontier.<br> A foothold to defend.";
    // Separate text nodes so each catalog sentence translates on its own.
    $("briefing-text").replaceChildren("Build your outpost. Harvest the valley. Lead your expedition against rival commanders.",
      ...(setup.enemyCount < 2 ? [] : [setup.alliance === "coalition"
        ? " Your rivals are allied: they share scouting, raid your Harvesters and attack together."
        : " Every faction fights for itself."]));
  }
  if(playMode === "training"){ $("briefing-title").textContent="Commander training"; $("briefing-text").textContent="Learn selection, movement, harvesting, construction, production, attack and withdrawal in eight guided steps. Training supplies replenish. Leave or replay whenever you like."; }
  if (!$("start").disabled && !loadFailed) $("start").textContent = playMode === "training" ? "Start training" : inCampaign ? `Start mission ${stagePick + 1}` : "Start";
}
function previewBattle() {
  if (started) return;
  const setup = battleSetup();
  const same = setup.map === mapId && setup.enemyCount === enemyCount && setup.aiSpeed === aiSpeed && setup.alliance === alliance && setup.bonus === bonus && setup.mission === mission;
  if (!same) {
    const terrain = setup.map !== mapId || setup.enemyCount !== enemyCount;
    ({ map: mapId, enemyCount, aiSpeed, alliance, bonus, mission } = setup);
    sim = createSim();
    view?.reset();
    hover = null;
    $("hover-label").hidden = true;
    if (terrain) view?.setTerrain(sim.terrain);
    view?.setMission(mission);
    document.documentElement.style.setProperty("--team-hostile", teamColors(settings, mission)[1]);
    selected.clear();
    rememberedBuildings.clear();
    rememberedResources.clear();
    updateUI();
  }
  // Choosing a battle (even the same one) re-centres the preview on your base.
  focusHome();
  updateHeading();
  renderBriefing();
}
for (const id of ["scenario", "enemy-count", "ai-speed", "alliance"]) $(id).onchange = previewBattle;
$("briefing").querySelector(".mode-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button || started) return;
  playMode = button.dataset.mode;
  previewBattle();
});
$("campaign-setup").onclick = (event) => {
  const button = event.target.closest("[data-stage]");
  if (!button || button.disabled || started) return;
  stagePick = Number(button.dataset.stage);
  previewBattle();
};
function togglePause() {
  if (!started || sim.result || modalType === "graphics") return;
  if (paused) {
    helpOverPause = false;
    closeModal();
    return;
  }
  showPause();
}
let helpOverPause = false;
function showPause() {
  helpOverPause = false;
  $("modal").classList.remove("help-wide");
  paused = true;
  touchControls?.reset();
  drag = null;
  pointer.inside = false;
  modalType = "pause";
  keys.clear();
  autosave();
  setModalOpen(true);
  $("modal-content").innerHTML =
    `<span class="eyebrow">TACTICAL PAUSE</span><h2 id="modal-title">Hold your position.</h2><p>The battlefield is paused. Take a moment to plan your next move.</p><button class="primary" data-resume>Resume operation ${icon("play")}</button><button class="secondary" data-new-game>New game / choose map</button><button class="secondary" data-restart>Restart this map</button><button class="secondary fullscreen-launch" data-fullscreen></button><button class="pause-settings" data-settings>Settings · army, graphics & sound</button>`;
  fullscreen.refresh();
  $("modal").querySelector("[data-resume]").focus();
}
function showHelp() {
  if (sim.result || modalType === "graphics") return;
  if (modalType === "help") { closeModal(); return; }
  helpOverPause = modalType === "pause";
  paused = true;
  touchControls?.reset();
  keys.clear();
  modalType = "help";
  setModalOpen(true);
  $("modal-content").innerHTML =
    `<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Your command station.</h2><div class="controls-grid"><span>Select / box select</span><kbd>Left-click / drag</kbd><span>Add to selection / queue order</span><kbd>Shift + click</kbd><span>Move, gather, build, attack</span><kbd>Right-click target</kbd><span>Pan camera</span><kbd>WASD / arrows / middle drag</kbd><span>Zoom</span><kbd>Mouse wheel</kbd><span>Attack-move / stop</span><kbd>F / X</kbd><span>Assign / recall group</span><kbd>Ctrl + 1–9 / 1–9</kbd><span>Focus base / toggle grid</span><kbd>H / G</kbd><span>Pause / cancel</span><kbd>Space / Esc</kbd></div><p class="help-note">Select a Harvester and right-click amber or blue deposits to gather. Select a building to train units; select a Harvester to construct. Click a queued unit to cancel and refund it. Build Supply relays before reaching the population cap.</p><button class="primary" data-resume>Return to the frontier ${icon("arrow")}</button>`;
  $("modal").querySelector("[data-resume]").focus({ preventScroll: true });
  if (!touchInput) {
    $("modal-content").querySelector(".controls-grid").outerHTML = HOTKEY_HELP;
    $("modal-content").querySelector(".help-note").remove();
    $("modal").classList.add("help-wide");
    for (const button of $("modal-content").querySelectorAll("[data-group]")) {
      const count = groupMembers(button.dataset.group).length;
      if (count) button.dataset.count = count;
    }
  }
  if (touchInput) {
    $("modal-content").querySelector(".controls-grid").innerHTML =
      "<span>Select a unit / structure</span><kbd>Tap it</kbd><span>Move / gather / attack</span><kbd>Select, then tap target</kbd><span>Pan the battlefield</span><kbd>Drag one finger</kbd><span>Zoom / pan together</span><kbd>Pinch / two fingers</kbd><span>Select multiple units</span><kbd>Box, then drag</kbd><span>Select your forces</span><kbd>Workers / Army</kbd><span>Queue multiple orders</span><kbd>Enable Queue</kbd><span>Use an ability / set a stance</span><kbd>Select soldiers, then Actions</kbd><span>Place a structure</span><kbd>Tap location → Build here</kbd><span>Change HUD panel</span><kbd>Selection / Actions / Map</kbd>";
    $("modal-content").querySelector(".help-note").textContent =
      "Tap Workers, then tap amber or blue deposits to gather. Tap a building to train units in Actions. Use Move or Attack-move in Selection, then tap a destination. To set a rally point, select a production building and tap ground. Eco graphics reduces rendering cost on phones.";
  }
}
function showResult() {
  paused = true;
  modalType = "result";
  clearMode();
  setModalOpen(true);
  if (audio) audio.sfx.play(sim.result === "victory" ? "win" : "lose"); else tone(sim.result === "victory" ? 880 : 220, 0.3);
  const win = sim.result === "victory";
  // A finished match cannot be continued (Training never had a save of its own).
  if (!tutorial && playMode !== "training") clearSave();
  missionUI.endMatch();
  if(tutorial){
    if(tutorial.done){try{localStorage.setItem("frontier-training-complete","1");}catch{}}
    $("modal-content").innerHTML = `<h2 id="modal-title">${tutorial.done?"Training complete!":"Training ended"}</h2><p>You practiced selection, economy, construction, production, attacking and withdrawal. Campaign introduces an active opponent.</p><button class="primary" data-training-campaign>Campaign menu</button><button class="secondary" data-restart>Replay training</button><button class="secondary" data-new-game>Choose a game</button>`;$("modal").querySelector(".primary").focus();return;
  }
  if (activeStage !== null) return showDebrief(win);
  $("modal").classList.add("result-wide");
  $("modal-content").innerHTML = skirmishResultHTML({ result: sim.result, seconds: sim.time, stats: matchStats.stats, emblem: emblemUrl, arrow: icon("arrow") });
  $("modal").querySelector(".primary").focus();
}
// Mission debrief: result, medal, time, objectives and the closing lines. A win records the
// best time and medal and opens the next mission.
function showDebrief(win) {
  const n = activeStage, m = sim.missionDef || MISSIONS[n], last = n === MISSIONS.length - 1;
  if (win) {
    campaign = recordClear(campaign, n, sim.mission?.clock ?? sim.time, sim.mission?.medal || "bronze");
    saveProgress(campaign);
    stagePick = last ? n : n + 1;
  }
  $("modal").classList.add("debrief-wide");
  $("modal-content").innerHTML = missionUI.debriefHTML({ mission: m, index: n, total: MISSIONS.length, sim, win, best: bestTime(campaign, n), hasNext: win && !last, stats: matchStats.stats });
  document.querySelector("#modal .modal").scrollTop = 0;
  $("modal").querySelector(".primary").focus({ preventScroll: true });
}
// Next mission: back to the campaign screen with the next mission picked, straight into its briefing.
function nextMissionNow() {
  playMode = "campaign";
  newGame();
  openMissionBriefing();
}
function newGame() {
  // One clean simulation for the briefing preview: restart(false) reuses it and starts no tutorial.
  sim = createSim();
  restart(false);
  started = false;
  tutorial = null;
  activeStage = null;
  previewBattle();
  paused = true;
  selected.clear();
  $("briefing").hidden = false;
  document.documentElement.classList.add("in-briefing");
  $("status-text").textContent = "CHOOSE YOUR BATTLEFIELD";
  view.resize();
  updateUI();
  // #scenario is hidden in campaign and training, so focus the first visible control instead.
  (playMode === "skirmish" ? $("scenario") : document.querySelector("[data-mode][aria-pressed=true]") || $("start"))?.focus();
}
// Harvesters start mining on their own, except in Training, which teaches the order.
// Every player action goes through sim.command (see commands.js).
function sendOrder(ids, order, append = false) {
  return sim.command({ team: 0, type: "order", ids, order, append });
}
function startEconomy() {
  // Browser suites (?test) measure a still economy; ?autoharvest gives them the real start.
  if (playMode !== "training" && (!query.has("test") || query.has("autoharvest"))) sim.command({ team: 0, type: "harvest" });
}
// restart() starts the current setup again; restart(false) only resets the interface around
// the simulation that is already there (the briefing preview, or a saved match with resume).
function restart(play = true, resume = false) {
  matchStats.reset();
  touchControls?.reset();
  pings.length = 0;
  cameraPan = null;
  saveClock = 0;
  missionUI.resetMatch();
  setMusicMood("calm");
  audio?.reset();
  drag = null;
  keys.clear();
  pointer.inside = false;
  boxSelection = false;
  queueOrders = false;
  $("box-select").setAttribute("aria-pressed", "false");
  $("queue-orders").setAttribute("aria-pressed", "false");
  if (play !== false) sim = createSim();
  syncPointOwners();
  tutorial = null;
  view.reset();
  governor.reset();
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
  setModalOpen(false);
  $("briefing").hidden = true;
  document.documentElement.classList.remove("in-briefing");
  view.resize();
  $("status-text").textContent = "OPERATION ACTIVE";
  selectHome();
  if (play !== false || resume) syncAutocast();
  if (!resume) startEconomy();
  if(play !== false && playMode === "training") beginTutorial();
}
// Autosave: every 30 s of play, on pause and when the page is hidden. Training is never saved.
let saveClock = 0;
function autosave() {
  if (!started || sim.result || playMode === "training" || tutorial) return false;
  saveClock = 0;
  return writeSave({ mode: playMode, missionId: activeStage !== null ? MISSIONS[activeStage].id : null, sim });
}
document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });
window.addEventListener("pagehide", () => autosave());
// Continue: restore the saved match and come back paused on the pause menu.
$("continue").onclick = () => {
  const save = readSave(), index = save?.missionId ? missionIndex(save.missionId) : -1;
  const loaded = save && (save.mode !== "campaign" || index >= 0) ? Simulation.load(save.text) : null;
  if (!loaded) {
    clearSave();
    renderContinue();
    notice("The saved match could not be loaded and was removed.");
    $("start").focus();
    return;
  }
  unlockAudio();
  try { localStorage.setItem(MODE_KEY, save.mode); } catch { /* Storage is optional. */ }
  playMode = save.mode;
  sim = loaded;
  mapId = sim.terrain.id; enemyCount = sim.enemyCount; aiSpeed = sim.aiSpeed; alliance = sim.coalition ? "coalition" : "ffa";
  mission = index >= 0 ? MISSIONS[index] : null;
  bonus = mission?.bonus || null;
  if (index >= 0) stagePick = index;
  restart(false, true);
  activeStage = index >= 0 ? index : null;
  view.setTerrain(sim.terrain);
  view.setMission(mission);
  focusHome();
  $("hover-label").hidden = true;
  updateHeading();
  showPause();
};

// Campaign: Start opens the mission briefing; the match begins from its "Begin mission".
function openMissionBriefing() {
  missionUI.openBriefing(MISSIONS[stagePick], stagePick, { onBegin: beginMatch });
}

$("start").onclick = () => {
  if (loadFailed) { loadAssets(); return; }
  unlockAudio();
  if (playMode === "campaign") { openMissionBriefing(); return; }
  beginMatch();
};
function beginMatch() {
  try { localStorage.setItem(MODE_KEY, playMode); } catch { /* Storage is optional. */ }
  pings.length = 0;
  cameraPan = null;
  saveClock = 0;
  missionUI.resetMatch();
  setMusicMood("calm");
  audio?.reset();
  sim = createSim();
  syncPointOwners();
  view.reset();
  focusHome();
  hover = null;
  $("hover-label").hidden = true;
  governor.reset();
  tutorial = null;
  activeStage = playMode === "campaign" ? stagePick : null;
  started = true;
  paused = false;
  $("briefing").hidden = true;
  document.documentElement.classList.remove("in-briefing");
  view.resize();
  $("status-text").textContent = "OPERATION ACTIVE";
  selectHome();
  updateHeading();
  syncAutocast();
  startEconomy();
  // A story mission opens with its own first line instead of the general hint.
  if (playMode !== "campaign") notice(
    playMode !== "training"
      ? "Your Harvesters are mining. Train more at the Command core, then build a Barracks."
      : touchInput
        ? "Tap Workers, then tap amber crystals. Drag to pan; pinch to zoom."
        : "Select Harvesters, then right-click amber crystals to start your economy.",
  );
  if(playMode === "training") beginTutorial();
  tone(780, 0.15);
}
$("pause").onclick = togglePause;
// Mid-match the logo opens the pause menu (New game lives there); following the link would drop the battle.
document.querySelector(".brand").addEventListener("click", (event) => {
  if (!started || sim.result) return;
  event.preventDefault();
  if (!paused) togglePause();
});
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
$('group-strip').onclick=event=>{
  const group=event.target.closest('[data-group]');
  if(group&&started&&!paused&&!sim.result)useGroup(group.dataset.group,event.ctrlKey||event.metaKey,event.shiftKey);
};
// Command card tooltip line: names the hovered order or tile above the card, as RTS consoles do.
// While it shows, the title moves to data-tip so the browser tooltip does not repeat it.
let tipButton = null;
function showOrderTip(button) {
  if (tipButton && tipButton !== button && tipButton.dataset.tip) {
    tipButton.title = tipButton.dataset.tip;
    delete tipButton.dataset.tip;
  }
  tipButton = button && !document.documentElement.classList.contains('compact-ui') ? button : null;
  if (tipButton?.title) {
    tipButton.dataset.tip = localization.sourceAttribute(tipButton, 'title');
    tipButton.removeAttribute('title');
  }
  $('order-tip').hidden = !tipButton?.dataset.tip;
  if (tipButton) $('order-tip').textContent = tipButton.dataset.tip;
}
{
  const card = document.querySelector('.command-panel'), target = event => event.target.closest('button[title],button[data-tip]');
  card.addEventListener('pointerover', event => showOrderTip(target(event)));
  card.addEventListener('focusin', event => showOrderTip(target(event)));
  card.addEventListener('pointerleave', () => showOrderTip(null));
  card.addEventListener('focusout', () => showOrderTip(null));
}
$("upgrade-actions").onclick = event => {
  if (!started || paused || sim.result) return;
  const e = selectedEntities()[0];
  if (!e) return;
  if (event.target.closest('[data-level]')) sim.command({team:0,type:"upgrade",building:e.id});
  if (event.target.closest('[data-cancel-level]')) sim.command({team:0,type:"cancelUpgrade",building:e.id});
  updateUI();
};
$("move-order").onclick = () => enterMode("move");
$("attack-order").onclick = () => enterMode("attackmove");
$("attack-order").insertAdjacentHTML('afterend', `<button id="patrol-order" hidden title="Patrol between two points · P">${icon("patrol","desk")}<span class="order-label">Patrol</span> <kbd>P</kbd></button><button id="attack-target-order" hidden title="Attack a chosen enemy · N">${icon("attack","desk")}<span class="order-label">Attack</span> <kbd>N</kbd></button>`);
$("patrol-order").onclick = () => enterMode('patrol');
$("attack-target-order").onclick = () => enterMode('attack');
$("stop-order").onclick = () => runShortcut('stop');
$("stop-order").insertAdjacentHTML('afterend', `<button id="repair-order" hidden title="Repair a damaged building (or right-click it) · costs a quarter of its price for a full repair">${icon("engineer","desk")}<span class="order-label">Repair</span></button><button id="rally-order" hidden title="Rally point: new units gather here; on a deposit, new Harvesters start mining · L">${icon("flag","desk")}<span class="order-label">Rally</span> <kbd>L</kbd></button>`);
$("repair-order").onclick = () => enterMode('repair');
$("rally-order").onclick = () => enterMode('rally');
$("commands").onclick = (event) => {
  const ability = event.target.closest("[data-ability]"), stance = event.target.closest("[data-stance]");
  if (ability) { if (!ability.disabled) useAbility(ability.dataset.ability); return; }
  if (stance) { if (!stance.disabled) setStance(stance.dataset.stance); return; }
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const type = button.dataset.action;
  if (D[type].kind === "building") enterBuild(type);
  else {
    const b = selectedEntities()[0];
    if (b) {
      sim.command({ team: 0, type: "train", building: b.id, unit: type });
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
  const fullscreenButton = event.target.closest('[data-fullscreen]');
  if (fullscreenButton) { toggleFullscreenFrom(fullscreenButton); return; }
  // Help lists every PC command and control group; running one returns to the battlefield.
  const shortcut = event.target.closest("[data-shortcut]"), group = event.target.closest("[data-group]");
  if ((shortcut || group) && modalType === "help") {
    closeModal();
    if (shortcut) runShortcut(shortcut.dataset.shortcut);
    else if (started && !sim.result) useGroup(group.dataset.group, event.ctrlKey || event.metaKey, event.shiftKey);
    updateUI();
    return;
  }
  if (event.target.closest("[data-settings]")) settingsUI.open();
  if (event.target.closest("[data-resume]")) closeModal();
  if (event.target.closest("[data-restart]")) restart();
  if (event.target.closest("[data-new-game]")) newGame();
  if (event.target.closest("[data-next-mission]")) nextMissionNow();
  if(event.target.closest("[data-training-campaign]")){playMode="campaign";newGame();}
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
  syncAudio(elapsed);
  audio?.update(elapsed, { sim, settings, started, paused, hidden: document.hidden, mapId });
  refreshHover();
  const running = started && !paused && !sim.result;
  if (running) {
    accumulator += dt;
    while (accumulator >= 0.05) {
      view.beforeTick(sim);
      tutorial?.update(sim,[...selected]);
      matchStats.before(sim);
      sim.tick(0.05);
      matchStats.after(sim);
      tutorial?.update(sim,[...selected]);
      accumulator -= 0.05;
    }
    if (sim.result) showResult();
    else if ((saveClock += dt) >= AUTOSAVE_SECONDS) autosave();
  }
  missionUI.tick(running ? dt : 0);
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
    if (dx || dy) { cameraPan = null; view.screenPan(dx * speed, dy * speed); }
  }
  if (cameraPan && started && !paused) {
    const k = (cameraPan.t = Math.min(1, cameraPan.t + dt / 1.2)), ease = k * k * (3 - 2 * k);
    view.focusOn(cameraPan.fromX + (cameraPan.x - cameraPan.fromX) * ease, cameraPan.fromZ + (cameraPan.z - cameraPan.fromZ) * ease);
    if (k >= 1) cameraPan = null;
  }
  const events = sim.events.splice(0);
  for (const event of events) {
    if (started) audio?.event(event, sim);
    if (event.type === "message") notice(event.text);
    else if (event.type === "incoming") { if (event.team === 0) incomingAlert(event); }
    // Story mission cues (sim/missions.js).
    // A line spoken on the tick that ended the match goes straight to the Comms log.
    else if (event.type === "say") { if (started) { missionUI.say(event.who, event.text); if (sim.result) missionUI.endMatch(); } }
    else if (event.type === "objective") { missionUI.objectiveEvent(event, sim); if (event.state === "revealed") notice("New objective"); }
    else if (event.type === "point") pointAlert(event);
    else if (event.type === "camera") startCameraPan(event.x, event.z);
    else if (event.type === "ping") { pings.push({ x: event.x, z: event.z, at: sim.time }); tone(520, 0.1); }
    else if (event.type === "music") setMusicMood(event.mood);
    else if (event.type === "missionEnd") { /* The debrief opens from sim.result (showResult). */ }
    else if (event.type === "promote") { if (event.team === 0 && started) promoted(event); view.event(event, sim); }
    else view.event(event, sim);
  }
  // Presentation effects hold still while paused; units render between the last two
  // 20 Hz simulation steps so movement stays smooth on high-refresh displays. The blend
  // is kept while paused so pausing and resuming never snap units back and forth.
  if (running && !sim.result) renderAlpha = accumulator / 0.05;
  // The phone start screen is opaque: redraw the hidden battlefield twice a second, enough to keep
  // models and shaders warm for Start without spending battery on frames nobody sees.
  const root = document.documentElement;
  coveredRedraw -= elapsed;
  if (started || !root.classList.contains("compact-ui") || !root.classList.contains("in-briefing") || coveredRedraw <= 0) {
    view.update(sim, started && !paused ? dt : 0, selected, hover, renderAlpha);
    coveredRedraw = 0.5;
  }
  uiClock -= dt;
  if (uiClock <= 0) {
    if (hover && !sim.get(hover.id)) { hover = null; $("hover-label").hidden = true; }
    updateUI();
    minimap();
    uiClock = 0.15;
  }
  if (governed)
    governor.sample(elapsed, performance.now() - now, started && !paused && !sim.result && !modalType && !document.hidden);
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

// Model downloads show their progress on the Start button; a failure turns it into Retry,
// which fetches only the files still missing.
let loadFailed = false;
async function loadAssets() {
  loadFailed = false;
  $("start").disabled = true;
  try {
    await view.loadModels((done, total) => { $("start").textContent = `Loading ${done} of ${total}…`; });
  } catch (error) {
    console.error(error);
    loadFailed = true;
    $("start").disabled = false;
    $("start").textContent = "Retry";
    $("status-text").textContent = "DOWNLOAD FAILED";
    notice("Some game files did not download. Check your connection, then press Retry.");
    return;
  }
  ready();
}
function boot() {
  try {
    view = new WorldView($("world"), { terrain: sim.terrain, settings, mission });
    view.onContextLost = graphicsLost;
    view.onContextRestored = graphicsRestored;
    $("quality").textContent = view.lowPower ? "Eco" : "High";
  } catch (error) {
    initFailed(error);
    return;
  }
  loadAssets();
}
function initFailed(error) {
  console.error(error);
  $("start").textContent = "Unable to initialize";
  $("status-text").textContent = "INITIALIZATION FAILED";
  notice(
    "The 3D engine could not start. Enable hardware acceleration and reload in a browser with WebGL 2 support.",
  );
  $("briefing").querySelector("p").textContent =
    "Check your connection and WebGL support, then reload. All game assets must be served from the built site.";
}
function ready() {
  try {
    applyPreferences(settings);
    updateHeading();
    bindInput();
    $("start").disabled = false;
    renderBriefing();
    focusHome();
    $("status-text").textContent = "ALL SYSTEMS READY";
    updateUI();
    requestAnimationFrame(frame);
    // Explicit opt-in hook used by browser integration tests. Absent in normal play.
    if (new URLSearchParams(location.search).has("test"))
      window.__frontier = {
        get tutorial(){return tutorial;},
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
          for (let i = 0; i < seconds / 0.05; i++){tutorial?.update(sim,[...selected]);matchStats.before(sim);sim.tick(0.05);matchStats.after(sim);tutorial?.update(sim,[...selected]);}
          updateUI();
        },
        get started() {
          return started;
        },
        get settings() {
          return settings;
        },
        governor,
        // Story missions and saves.
        mission: missionUI,
        get campaign() { return campaign; },
        get cameraPan() { return cameraPan; },
        get mode() { return mode; },
        get musicMood() { return musicMood(); },
        get audio() { return audio; },
        save: autosave,
      };
  } catch (error) {
    initFailed(error);
  }
}
boot();

function beginTutorial(){
  tutorial = new Tutorial(sim); tutorialShown = -1; setSelection([]); renderTutorial();
}
function renderTutorial(){
  const active=!!tutorial && started && !tutorial.done && !sim.result;
  $("training").hidden=!active;$("training-marker").hidden=!active;
  document.documentElement.classList.toggle("in-training",active);
  if(!active)return;
  const step=tutorial.step;
  $("training-toggle").textContent=`Training ${tutorial.index+1}/${TRAINING_STEPS.length}`;
  $("training-title").textContent=step.title;
  $("training-copy").textContent=touchInput?step.touch:step.desktop;
  if(tutorialShown!==tutorial.index){tutorialShown=tutorial.index;$("training-card").hidden=false;$("training-toggle").setAttribute("aria-expanded","true");}
  if(view){
    const target=tutorial.point(sim),p=view.project(target.x,target.z,0.2);
    const canvas=view.renderer.domElement.getBoundingClientRect(),stage=$("stage").getBoundingClientRect();
    $("training-marker").style.left=(p.x+canvas.left-stage.left)+"px";
    $("training-marker").style.top=(p.y+canvas.top-stage.top)+"px";
  }
}
$("training-toggle").onclick=()=>{const card=$("training-card");card.hidden=!card.hidden;$("training-toggle").setAttribute("aria-expanded",String(!card.hidden));};
$("training-focus").onclick=()=>{if(!tutorial)return;const p=tutorial.point(sim);view.focusOn(p.x,p.z);$("training-card").hidden=true;$("training-toggle").setAttribute("aria-expanded","false");};
$("training-exit").onclick=()=>{playMode="skirmish";newGame();};
