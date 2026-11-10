// The static page: top bar, battlefield overlays, start screen, dock and dialog shell.
import emblemUrl from "../art/emblem.webp";
import keyartSmallUrl from "../art/keyart-960.webp";
import keyartUrl from "../art/keyart.webp";
import { AI_SPEEDS, ALLIANCES } from "../ai-plan.js";
import { MAPS } from "../terrain.js";
import { MISSIONS } from "../campaign.js";
import { TRAINING_STEPS } from "../tutorial.js";
import { icon } from "../icons.js";

export function renderShell() {
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
}
