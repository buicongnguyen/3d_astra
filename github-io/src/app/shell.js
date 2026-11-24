// The static page: top bar, battlefield overlays, start screen, dock and dialog shell.
import emblemUrl from "../art/emblem.webp";
// Title cover (R3-M): painted key art, one flat cover per frame shape; <picture> fetches only the one that
// matches. The parallax layers come later (app/cover.js).
import { COVERS } from "./cover-layers.js";
import wordmarkSvg from "../art/wordmark.svg?raw";
import { AI_SPEEDS, ALLIANCES } from "../ai-plan.js";
import { MAPS, MAP_BLURBS } from "../terrain.js";
import { MISSIONS } from "../campaign.js";
import { TRAINING_STEPS } from "../tutorial.js";
import { icon } from "../icons.js";
import { ENEMY_FACTIONS, PLAYER_FACTIONS } from "../factions.js";

export function renderShell() {
  document.querySelector("#app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Frontier Command home" translate="no"><span class="brand-mark"><img src="${emblemUrl}" alt="" width="40" height="40" decoding="async"></span><span class="brand-name">FRONTIER<span class="brand-sub">COMMAND</span></span></a>
    <div class="resource-bar" aria-label="Resources">
      <div class="resource alloy" title="Alloy — harvested from amber deposits">${icon("alloy")}<span><strong id="alloy">450</strong><small>ALLOY</small></span></div>
      <div class="resource energy" title="Energy — harvested from blue deposits">${icon("energy")}<span><strong id="energy">150</strong><small>ENERGY</small></span></div>
      <div class="resource population" title="Used + queued population / capacity">${icon("people")}<span><strong id="population">7 <em>/ 15</em></strong><small>POPULATION</small></span></div>
    </div>
    <div class="top-actions"><button id="theme-toggle" class="icon-button menu-only" type="button" title="Dark theme" aria-label="Dark theme">${icon("theme")}</button><button id="fullscreen" class="icon-button menu-only" data-fullscreen aria-pressed="false" title="Full screen" aria-label="Full screen">${icon("expand")}</button><button id="briefing-settings" class="icon-button menu-only" title="Settings" aria-label="Settings">${icon("gear")}</button><span id="clock">00:00</span><button id="fullscreen-top" class="icon-button" data-fullscreen aria-pressed="false" title="Full screen" aria-label="Full screen">${icon("expand")}</button><button id="audio" class="icon-button" title="Mute sound" aria-label="Mute sound">${icon("volume")}</button><button id="help" class="icon-button" title="Controls" aria-label="Show controls">${icon("help")}</button><button id="pause" class="icon-button" title="Pause · Space" aria-label="Pause game">${icon("pause")}</button></div>
  </header>
  <main id="stage">
    <div id="world"></div><div id="training-marker" hidden aria-hidden="true">◎</div><aside id="training" hidden><button id="training-toggle" aria-expanded="true">Training</button><div id="training-card" class="panel"><strong id="training-title"></strong><p id="training-copy"></p><small>Training supplies replenish · no AI attacks</small><div><button id="training-focus">Focus target</button><button id="training-exit">Leave training</button></div></div></aside>
    <div class="map-heading"><span class="eyebrow"><i class="live-dot"></i> <span id="operation-label">OPERATION 01 / SKIRMISH</span></span><h1>Outpost Meridian<span>.</span></h1><p>THE ASHEN FRONTIER <span>·</span> SECTOR 07</p></div>
    <button id="mission-toggle" aria-expanded="false" aria-controls="mission-objectives">${icon("objectives")} Objectives</button>
    <aside id="mission-objectives" class="mission panel" aria-label="Mission objectives"><div class="panel-label">MISSION OBJECTIVES <span>01—03</span></div><div class="objective" id="obj-economy"><span class="objective-num">01</span><span>Establish your economy<small>Assign Harvesters to resources</small></span></div><div class="objective" id="obj-army"><span class="objective-num">02</span><span>Mobilize a strike force<small>Field 8 combat units</small></span></div><div class="objective" id="obj-win"><span class="objective-num">03</span><span>Break their command<small>Destroy all enemy Command cores</small></span></div></aside>
    <div class="sector-status"><span class="eyebrow">TACTICAL UPLINK</span><span><i class="live-dot"></i> <span id="uplink">STANDBY</span></span></div>
    <div id="notice" role="status" aria-live="polite"></div>
    <div id="mode-banner" hidden></div>
    <div id="mode-controls" hidden><button id="confirm-build" hidden disabled>Build here</button><button id="cancel-mode">Cancel</button></div>
    <nav class="touch-controls" aria-label="Touch battlefield controls">
      <button id="select-army" title="Select all combat units">${icon("people")}<span>Army</span></button>
      <button id="select-workers" title="Select all Harvesters">${icon("worker")}<span>Workers</span></button>
      <button id="box-select" aria-pressed="false" aria-label="Box select" title="Box select">${icon("box")}<span>Box</span></button>
      <button id="queue-orders" aria-pressed="false" aria-label="Queue orders" title="Queue orders">${icon("queue")}<span>Queue</span></button>
      <button id="clear-selection" aria-label="Clear selection" title="Clear selection">${icon("close")}<span>Clear</span></button>
      <button id="touch-guide" type="button" aria-label="Info & stats" title="Info & stats">${icon("info")}<span>Info</span></button>
      <button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button>
    </nav>
    <div id="selection-box"></div>
    <div id="hover-label" hidden></div>
    <section id="briefing" class="briefing" aria-labelledby="briefing-title">
      <div class="briefing-hero">
        <picture class="briefing-art" aria-hidden="true"><source media="(orientation: portrait) and (max-width: 900px)" srcset="${COVERS.portrait}" width="1170" height="2532"><source media="(orientation: landscape) and (max-height: 520px)" srcset="${COVERS.landscape}" width="1688" height="780"><img src="${COVERS.desktop}" alt="" width="2560" height="1440" decoding="async" fetchpriority="high"></picture>
        <div id="campaign-map" hidden></div>
        <div class="title-brand"><img class="title-emblem" src="${emblemUrl}" alt="" width="72" height="72" decoding="async"><div class="title-words"><span translate="no">${wordmarkSvg}</span><span class="title-sub">War for the Meridian Frontier</span></div></div>
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
        <div class="setup-head" aria-hidden="true"><span><i class="live-dot"></i> Command uplink</span><span>Sector 07</span></div>
        <div id="title-actions" class="title-actions" hidden></div>
        <button id="continue" class="secondary continue-launch" hidden></button>
        <div class="setup-label">Game mode</div>
        <div class="mode-switch" role="group" aria-label="Game mode">
          <button data-mode="campaign" aria-pressed="false">${icon("logo")}<span>Campaign</span><small>${MISSIONS.length} missions</small></button>
          <button data-mode="skirmish" aria-pressed="true">${icon("crosshair")}<span>Skirmish</span><small>Custom battle</small></button>
          <button data-mode="defence" aria-pressed="false">${icon("tower")}<span>Defence</span><small>Hold the road</small></button>
          <button data-mode="training" aria-pressed="false">${icon("flag")}<span>Training</span><small>The basics</small></button>
        </div>
        <div class="briefing-tools" id="skirmish-setup">
          <label class="field field-wide"><span>Map</span><select id="scenario" aria-label="Battlefield">${["riverlands", ...Object.keys(MAPS).filter(id => id !== "riverlands")].map(id => `<option value="${id}"${MAP_BLURBS[id] ? ` title="${MAP_BLURBS[id]}"` : ""}>${MAPS[id]}</option>`).join("")}</select></label>
          <label class="field field-bare"><select id="enemy-count" aria-label="Number of AI enemies"><option value="1">1 AI enemy</option><option value="2">2 AI enemies</option><option value="3">3 AI enemies</option></select></label>
          <label class="field field-bare"><select id="ai-speed" aria-label="AI speed" title="AI speed: how fast rivals build, tech up and attack">${Object.entries(AI_SPEEDS).map(([id, p]) => `<option value="${id}"${id === "normal" ? " selected" : ""}>${p.label} AI</option>`).join("")}</select></label>
          <label class="field"><span>You</span><select id="player-faction" aria-label="Your faction" title="Your faction: the army you command, with its own units, building and way of fighting">${Object.entries(PLAYER_FACTIONS).map(([id, label]) => `<option value="${id}">${label.replace(/^The /, "").split(" ")[0]}</option>`).join("")}</select></label>
          <label class="field"><span>Enemy</span><select id="enemy-faction" aria-label="Enemy faction" title="Enemy faction: each has two units, one building and a way of fighting of its own">${Object.entries(ENEMY_FACTIONS).map(([id, label]) => `<option value="${id}">${label.replace(/^The /, "").split(" ")[0]}</option>`).join("")}</select></label>
          <label class="field"><span>Teams</span><select id="alliance" aria-label="AI teams" disabled>${Object.entries(ALLIANCES).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
        </div>
        <div id="campaign-setup" hidden></div>
        <div id="defence-setup" hidden></div>
        <div id="training-setup" hidden><ol class="lesson-list" aria-label="Training lessons">${TRAINING_STEPS.map(step => `<li>${step.title}</li>`).join("")}</ol></div>

        <div id="campaign-difficulty" hidden><div class="difficulty-buttons" role="group" aria-label="Campaign difficulty"><button data-difficulty="story" aria-pressed="false">Story</button><button data-difficulty="standard" aria-pressed="true">Standard</button><button data-difficulty="veteran" aria-pressed="false">Veteran</button></div><p id="difficulty-description"></p></div>
        <button id="start" class="primary" disabled>Preparing expedition…</button>
      </div>
    </section>
    <div class="bottom-dock">
      <section class="minimap-panel panel"><div class="panel-label">SECTOR OVERVIEW <button id="defence-map-size" type="button" aria-label="Map" title="Map" aria-controls="minimap" aria-expanded="false">${icon("expand")}</button><button id="map-toggle" type="button" aria-label="Enlarge map" title="Enlarge map" aria-pressed="false">${icon("expand")}</button><button id="home" title="Focus base · H" aria-label="Focus base">${icon("hq")}</button></div><canvas id="minimap" width="240" height="200" aria-label="Minimap: click to pan; right-click to command"></canvas><div class="map-legend"><span><i class="friendly"></i>YOU</span><span><i class="hostile"></i>ENEMY</span><span><i class="deposit"></i>RESOURCE</span></div></section>
      <div class="command-deck">
      <section class="selection-panel panel"><div id="group-strip" class="group-strip" aria-label="Control groups"></div><div class="panel-label"><span id="selection-label">EXPEDITION COMMAND</span><span id="selection-count">READY</span></div><div id="selection-info"></div><div class="selection-scroll"><div id="unit-list"></div></div><div id="queue"></div><div class="order-buttons"><button id="field-guide" title="Info & stats">${icon("info","desk")}<span class="order-label">Info & stats</span></button><button id="support-order" hidden title="Support: heal / repair">${icon("medic","desk")}<span class="order-label">Support</span></button><button id="move-order" title="Move">${icon("move")}<span class="order-label">Move</span></button><button id="attack-order" title="Attack-move · F">${icon("crosshair")}<span class="order-label">Attack-move</span> <kbd>F</kbd></button><button id="stop-order" title="Stop · X">${icon("stop")}<span class="order-label">Stop</span> <kbd>X</kbd></button></div></section>
      <section class="command-panel panel"><div class="panel-label"><span id="command-label">COMMAND CENTER</span><span id="command-context">ACTIONS</span></div><div id="commands"></div><div id="upgrade-actions" class="upgrade-actions"></div><div id="command-hint">Select a unit or structure to issue commands.</div><div id="order-tip" aria-hidden="true" hidden></div></section>
      </div>
    </div>
    <nav id="dock-tabs" aria-label="Command panels"><button data-dock="selection" aria-pressed="true">${icon("people")} Selection</button><button data-dock="map" aria-pressed="false">${icon("map")} Map</button></nav>
    <div class="statusbar"><span><i class="live-dot"></i> <span id="status-text">EXPEDITION SYSTEMS INITIALIZING</span></span><span>WASD pan <b>·</b> Scroll zoom <b>·</b> Right-click command <b>·</b> <button id="controls-link">? Controls</button></span><span id="fps">— FPS</span></div>
  </main>
  <div id="modal" class="modal-backdrop" hidden><section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-content"></div></section></div>
`;
}
