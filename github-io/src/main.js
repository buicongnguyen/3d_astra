import "./style.css";
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
    <div class="map-heading"><span class="eyebrow"><i class="live-dot"></i> OPERATION 01 / SKIRMISH</span><h1>Outpost Meridian<span>.</span></h1><p>THE ASHEN FRONTIER <span>·</span> SECTOR 07</p></div>
    <aside class="mission panel"><div class="panel-label">MISSION OBJECTIVES <span>01—03</span></div><div class="objective" id="obj-economy"><span class="objective-num">01</span><span>Establish your economy<small>Assign Harvesters to resources</small></span></div><div class="objective" id="obj-army"><span class="objective-num">02</span><span>Mobilize a strike force<small>Field 8 combat units</small></span></div><div class="objective" id="obj-win"><span class="objective-num">03</span><span>Break their command<small>Destroy the enemy Command core</small></span></div><div class="mission-footer">${icon("flag")} MERIDIAN EXPEDITION</div></aside>
    <div class="sector-status"><span class="eyebrow">TACTICAL UPLINK</span><span><i class="live-dot"></i> <span id="uplink">STANDBY</span></span></div>
    <div id="notice" role="status" aria-live="polite"></div>
    <div id="mode-banner" hidden></div>
    <div id="selection-box"></div>
    <div id="hover-label" hidden></div>
    <section id="briefing" class="briefing panel">
      <div class="eyebrow">EXPEDITION BRIEFING</div><div class="briefing-emblem">${icon("logo")}</div>
      <h2>A new frontier.<br>A foothold to defend.</h2>
      <p>Build your outpost. Harvest the valley. Lead your expedition against the Crimson Collective.</p>
      <div class="briefing-rule"><span>YOUR FORCE</span><strong>4 Harvesters · 3 defenders</strong></div>
      <div class="briefing-rule"><span>OBJECTIVE</span><strong>Eliminate enemy command</strong></div>
      <button id="start" class="primary" disabled>Preparing expedition…</button><small class="briefing-note">SINGLE PLAYER <span>·</span> MOUSE + KEYBOARD</small>
    </section>
    <div class="bottom-dock">
      <section class="minimap-panel panel"><div class="panel-label">SECTOR OVERVIEW <button id="home" title="Focus base · H" aria-label="Focus base">${icon("hq")}</button></div><canvas id="minimap" width="240" height="200" aria-label="Minimap: click to pan; right-click to command"></canvas><div class="map-legend"><span><i class="friendly"></i>YOU</span><span><i class="hostile"></i>ENEMY</span><span><i class="deposit"></i>RESOURCE</span></div></section>
      <section class="selection-panel panel"><div class="panel-label"><span id="selection-label">EXPEDITION COMMAND</span><span id="selection-count">READY</span></div><div id="selection-info"></div><div id="unit-list"></div><div id="queue"></div><div class="order-buttons"><button id="move-order" title="Click a destination">${icon("move")} Move</button><button id="attack-order" title="Attack-move · F">${icon("crosshair")} Attack-move <kbd>F</kbd></button><button id="stop-order" title="Stop · X">${icon("stop")} Stop <kbd>X</kbd></button></div></section>
      <section class="command-panel panel"><div class="panel-label"><span id="command-label">COMMAND CENTER</span><span id="command-context">ACTIONS</span></div><div id="commands"></div><div id="command-hint">Select a unit or structure to issue commands.</div></section>
    </div>
    <div class="statusbar"><span><i class="live-dot"></i> <span id="status-text">EXPEDITION SYSTEMS INITIALIZING</span></span><span>WASD pan <b>·</b> Scroll zoom <b>·</b> Right-click command <b>·</b> <button id="controls-link">? Controls</button></span><span id="fps">— FPS</span></div>
  </main>
  <div id="modal" class="modal-backdrop" hidden><section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-content"></div></section></div>
  <div class="small-screen"><span class="brand-mark">${icon("logo")}</span><h2>Your command station awaits.</h2><p>Frontier Command is designed for a desktop browser with a mouse and keyboard. Open it in a wider window (at least 900 × 700).</p></div>
`;

const $ = (id) => document.getElementById(id);
let sim = new Simulation(),
  view,
  selected = new Set(),
  hover = null,
  started = false,
  paused = false,
  mode = null,
  buildType = null,
  muted = false;
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
  lastQueueKey = "",
  modalType = null;
const milestones = { economy: false, army: false };

function tone(frequency = 520, duration = 0.065) {
  if (muted || !audioContext || performance.now() - lastTone < 70) return;
  lastTone = performance.now();
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(0.025, audioContext.currentTime);
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
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    /* Audio is optional. */
  }
}
function notice(text) {
  $("notice").textContent = text;
  $("notice").classList.add("show");
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => $("notice").classList.remove("show"), 4500);
}
function selectedEntities() {
  return [...selected].map((id) => sim.get(id)).filter((e) => e?.team === 0);
}
function setSelection(ids) {
  selected = new Set(ids);
  lastSelectionKey = "";
  updateUI();
  tone(650);
}
function clearMode() {
  mode = null;
  buildType = null;
  if (view) view.preview.visible = false;
  $("mode-banner").hidden = true;
  $("world").classList.remove("targeting");
}
function enterMode(type) {
  if (!started || paused || sim.result) return;
  if (!selectedEntities().some((e) => e.kind === "unit")) {
    notice("Select units first.");
    return;
  }
  clearMode();
  mode = type;
  $("mode-banner").hidden = false;
  $("mode-banner").textContent =
    type === "attackmove"
      ? "ATTACK-MOVE · Click a destination · Esc to cancel"
      : "MOVE · Click a destination · Esc to cancel";
  $("world").classList.add("targeting");
}
function enterBuild(type) {
  if (!started || paused || sim.result) return;
  if (!selectedEntities().some((e) => e.type === "worker")) {
    notice("Select a Harvester to construct a building.");
    return;
  }
  clearMode();
  mode = "build";
  buildType = type;
  $("mode-banner").hidden = false;
  $("mode-banner").textContent =
    `PLACE ${D[type].name.toUpperCase()} · Click to build · Esc to cancel`;
  view.preview.visible = true;
  view.preview.scale.set(D[type].radius, 1, D[type].radius);
}
function formatTime(s) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
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
  const es = selectedEntities(),
    e = es[0];
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
  else {
    const hp = es.reduce((s, u) => s + u.hp, 0),
      max = es.reduce((s, u) => s + u.maxHp, 0);
    $("selection-info").innerHTML =
      `<div class="portrait">${icon(es.length > 1 ? "people" : e.icon)}<span>ME</span></div><div class="entity-details"><span class="eyebrow">${es.length > 1 ? "MERIDIAN EXPEDITION" : e.role.toUpperCase()}</span><h3>${es.length > 1 ? "Expedition squad" : e.name}</h3><div class="health-track"><i style="width:${(hp / max) * 100}%"></i></div><div class="entity-stats"><span>${Math.ceil(hp)} / ${max} HP</span><span>${!e.complete ? `BUILDING ${Math.floor(e.progress * 100)}%` : e.carry ? `${e.carry} ${e.carryType.toUpperCase()} CARRIED` : e.orders[0]?.type.toUpperCase() || (e.kind === "building" ? "OPERATIONAL" : "STANDING BY")}</span></div></div>`;
  }
  const signature = `${es.map((e) => e.id).join(",")}/${e?.complete}/${p.upgrade}`;
  if (lastSelectionKey !== signature) {
    lastSelectionKey = signature;
    $("unit-list").innerHTML =
      es.length > 1
        ? es
            .slice(0, 18)
            .map(
              (u) =>
                `<button data-select="${u.id}" title="${u.name}">${icon(u.icon)}</button>`,
            )
            .join("") +
          (es.length > 18 ? `<span>+${es.length - 18}</span>` : "")
        : "";
    const actions =
      e && es.length === 1 && e.kind === "building" && e.complete
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
        .map((type) => {
          const d = D[type];
          return `<button class="command-tile" data-action="${type}" title="${d.description}">${icon(d.icon)}<span>${d.name}</span><small><b class="alloy-text">${d.cost[0]}</b>${d.cost[1] ? ` <b class="energy-text">/ ${d.cost[1]}</b>` : ""}</small></button>`;
        })
        .join("") ||
      `<div class="tactical-hint">${icon("crosshair")}<strong>${e ? "Control the battlefield" : "Your expedition is ready"}</strong><p>${e ? "Right-click to move or engage.<br>Attack-move to advance and fight." : "Select the Command core to train Harvesters, or the Barracks to grow your army."}</p></div>`;
    $("command-hint").textContent =
      e?.kind === "building"
        ? e.complete
          ? "Right-click terrain to set a rally point."
          : "A Harvester must remain nearby to finish construction."
        : es.some((u) => u.type === "worker")
          ? "Select a structure, then place it on clear terrain."
          : "Hold Shift to queue orders. Ctrl + 1–9 saves a group.";
  }
  for (const button of $("commands").querySelectorAll("[data-action]")) {
    const d = D[button.dataset.action];
    const unavailable =
      !started ||
      paused ||
      sim.result ||
      !sim.canPay(0, d.cost) ||
      (button.dataset.action === "upgrade" &&
        (p.upgrade ||
          own.some((b) => b.queue.some((q) => q.type === "upgrade"))));
    button.disabled = !!unavailable;
  }
  const queueKey = `${e?.id}/${e?.complete}/${e?.queue.map(q => q.id).join(',')}`;
  // Preserve interactive nodes while updating progress, including on slow frames.
  if (queueKey !== lastQueueKey) {
    lastQueueKey = queueKey;
    $("queue").innerHTML = e?.queue.length
      ? `<span class="queue-label">QUEUE</span>${e.queue.map((q, i) => `<button data-cancel="${i}" title="Cancel ${D[q.type].name} — full refund">${icon(D[q.type].icon)}<span></span><i></i></button>`).join("")}`
      : e && !e.complete
        ? `<button class="cancel-build" data-cancel-build="${e.id}">Cancel construction · 75% refund</button>`
        : "";
  }
  for (const button of $("queue").querySelectorAll('[data-cancel]')) {
    const q = e.queue[Number(button.dataset.cancel)];
    const progress = Math.min(100, q.elapsed / D[q.type].time * 100);
    button.querySelector('span').textContent = `${Math.floor(progress)}%`;
    button.querySelector('i').style.width = `${progress}%`;
  }
  for (const b of document.querySelectorAll(".order-buttons button"))
    b.disabled = !started || paused || !es.some((u) => u.kind === "unit");
}

function minimap() {
  const c = $("minimap"),
    ctx = c.getContext("2d"),
    w = c.width,
    h = c.height,
    px = (x) => ((x + HALF) / MAP_SIZE) * w,
    pz = (z) => ((z + HALF) / MAP_SIZE) * h;
  ctx.fillStyle = "#485243";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#64715a";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(px(-25), pz(24));
  ctx.lineTo(px(25), pz(-24));
  ctx.stroke();
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
    if (e.team === 1 && e.kind === "building" && sim.isVisible(e))
      rememberedBuildings.set(e.id, { x: e.x, z: e.z, radius: e.radius });
  for (const [id, e] of rememberedBuildings) {
    if (sim.isVisible(e) && !sim.get(id)) {
      rememberedBuildings.delete(id);
      continue;
    }
    if (!sim.isVisible(e)) {
      ctx.fillStyle = "#774b41";
      ctx.fillRect(px(e.x) - 3, pz(e.z) - 3, 6, 6);
    }
  }
  for (const e of sim.entities)
    if (sim.isVisible(e)) {
      ctx.fillStyle = e.team === 0 ? "#a3efcb" : "#ff8169";
      const r = e.kind === "building" ? 3.5 : selected.has(e.id) ? 2.5 : 1.6;
      ctx.fillRect(px(e.x) - r, pz(e.z) - r, r * 2, r * 2);
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

function commandAt(point, target, append = false, forced = null) {
  if (!point || !started || paused || sim.result) return;
  const es = selectedEntities(),
    units = es.filter((e) => e.kind === "unit");
  for (const b of es.filter((e) => e.kind === "building" && e.complete)) {
    b.rally = { ...point };
    notice("Rally point established.");
  }
  if (!units.length) {
    view.marker(point.x, point.z);
    return;
  }
  let order = { type: forced || "move", ...point };
  if (!forced && target?.team === 1 && sim.isVisible(target))
    order = { type: "attack", target: target.id };
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
    order.type === "attack" || forced === "attackmove" ? 0xef9f75 : 0xa3efcb,
  );
  tone(440);
}

function bindInput() {
  const canvas = view.renderer.domElement;
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (mode) {
      clearMode();
      return;
    }
    commandAt(
      view.point(e.clientX, e.clientY),
      view.pick(e.clientX, e.clientY, sim),
      e.shiftKey,
    );
  });
  canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    if (e.button === 2 || !started || paused || sim.result) return;
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
      const rect = canvas.getBoundingClientRect();
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
          : `${hover.name}${hover.team === 1 ? " · ENEMY" : ""}`;
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
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const old = drag;
    drag = null;
    $("selection-box").style.display = "none";
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (old.button !== 0 || paused || !started) return;
    const point = view.point(e.clientX, e.clientY);
    if (mode === "build" && point) {
      const worker = selectedEntities().find((e) => e.type === "worker");
      const b = worker && sim.build(worker.id, buildType, point.x, point.z);
      if (b) {
        clearMode();
        setSelection([b.id]);
        tone(330, 0.15);
      }
      return;
    }
    if (mode) {
      commandAt(point, null, e.shiftKey, mode);
      clearMode();
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
        if (e.shiftKey && next.has(target.id)) next.delete(target.id);
        else next.add(target.id);
      }
    }
    setSelection(next);
  });
  canvas.addEventListener("dblclick", (e) => {
    if (!started || paused) return;
    const target = view.pick(e.clientX, e.clientY, sim);
    if (target?.team === 0 && target.kind === "unit")
      setSelection(
        sim
          .own(0)
          .filter((u) => u.type === target.type && sim.isVisible(u))
          .map((u) => u.id),
      );
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
    if (
      e.target.matches("input, textarea") ||
      (e.repeat && [" ", "Escape"].includes(e.key))
    )
      return;
    const key = e.key.toLowerCase();
    if (
      [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) ||
      (e.ctrlKey && /^[1-9]$/.test(key))
    )
      e.preventDefault();
    if (key === "escape") {
      if (mode) clearMode();
      else if (modalType === "help") closeModal();
      else if (started && !sim.result) togglePause();
      return;
    }
    if (modalType) {
      if (key === " " && modalType === "pause") closeModal();
      return;
    }
    if (key === " ") {
      togglePause();
      return;
    }
    keys.add(key);
    if (key === "h") focusHome();
    if (key === "f") enterMode("attackmove");
    if (key === "x" && !paused && started) {
      sim.issue([...selected], { type: "stop" });
      notice("Orders cleared.");
    }
    if (key === "g") {
      view.grid.visible = !view.grid.visible;
    }
    if (key === "?") showHelp();
    if (/^[1-9]$/.test(key)) {
      if (e.ctrlKey) {
        groups.set(key, [...selected]);
        notice(`Control group ${key} assigned.`);
      } else if (groups.has(key))
        setSelection(groups.get(key).filter((id) => sim.get(id)));
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keys.clear();
      if (started && !paused && !sim.result) togglePause();
    }
  });
  const mapPoint = (e) => {
    const r = $("minimap").getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * MAP_SIZE - HALF,
      z: ((e.clientY - r.top) / r.height) * MAP_SIZE - HALF,
    };
  };
  $("minimap").addEventListener("pointerdown", (e) => {
    if (e.button === 0) {
      const p = mapPoint(e);
      view.focusOn(p.x, p.z);
    }
  });
  $("minimap").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const p = mapPoint(e);
    commandAt(p, null, e.shiftKey, mode === "attackmove" ? "attackmove" : null);
    clearMode();
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
function togglePause() {
  if (!started || sim.result) return;
  if (paused) {
    closeModal();
    return;
  }
  paused = true;
  modalType = "pause";
  keys.clear();
  $("modal").hidden = false;
  $("modal-content").innerHTML =
    `<span class="eyebrow">TACTICAL PAUSE</span><h2 id="modal-title">Hold your position.</h2><p>The battlefield is paused. Take a moment to plan your next move.</p><button class="primary" data-resume>Resume operation ${icon("play")}</button><button class="secondary" data-restart>Restart skirmish</button>`;
  $("modal").querySelector("[data-resume]").focus();
}
function showHelp() {
  if (sim.result) return;
  paused = true;
  keys.clear();
  modalType = "help";
  $("modal").hidden = false;
  $("modal-content").innerHTML =
    `<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Your command station.</h2><div class="controls-grid"><span>Select / box select</span><kbd>Left-click / drag</kbd><span>Add to selection / queue order</span><kbd>Shift + click</kbd><span>Move, gather, build, attack</span><kbd>Right-click target</kbd><span>Pan camera</span><kbd>WASD / arrows / middle drag</kbd><span>Zoom</span><kbd>Mouse wheel</kbd><span>Attack-move / stop</span><kbd>F / X</kbd><span>Assign / recall group</span><kbd>Ctrl + 1–9 / 1–9</kbd><span>Focus base / toggle grid</span><kbd>H / G</kbd><span>Pause / cancel</span><kbd>Space / Esc</kbd></div><p class="help-note">Select a Harvester and right-click amber or blue deposits to gather. Select a building to train units; select a Harvester to construct. Click a queued unit to cancel and refund it. Build Supply relays before reaching the population cap.</p><button class="primary" data-resume>Return to the frontier ${icon("arrow")}</button>`;
  $("modal").querySelector("[data-resume]").focus();
}
function showResult() {
  paused = true;
  modalType = "result";
  clearMode();
  $("modal").hidden = false;
  tone(sim.result === "victory" ? 880 : 220, 0.3);
  const win = sim.result === "victory";
  $("modal-content").innerHTML =
    `<span class="eyebrow">OPERATION ${sim.result === "draw" ? "CONCLUDED" : win ? "SUCCESSFUL" : "FAILED"}</span><div class="result-emblem ${win ? "" : "loss"}">${icon(win ? "flag" : "shield")}</div><h2 id="modal-title">${win ? "The frontier is yours." : sim.result === "draw" ? "Mutual destruction." : "Your outpost has fallen."}</h2><p>${win ? "Enemy command has been eliminated. Meridian holds the valley." : sim.result === "draw" ? "Both Command cores were destroyed." : "The Crimson Collective destroyed your Command core. Regroup and try a different approach."}</p><div class="result-stats"><span><strong>${formatTime(sim.time)}</strong>OPERATION TIME</span><span><strong>${sim.players[0].kills}</strong>ENEMIES ELIMINATED</span></div><button class="primary" data-restart>Deploy again ${icon("arrow")}</button>`;
}
function restart() {
  sim = new Simulation();
  view.reset();
  selected.clear();
  groups.clear();
  rememberedBuildings.clear();
  rememberedResources.clear();
  milestones.economy = milestones.army = false;
  clearMode();
  modalType = null;
  started = true;
  paused = false;
  accumulator = 0;
  hover = null;
  $("modal").hidden = true;
  $("briefing").hidden = true;
  $("status-text").textContent = "OPERATION ACTIVE";
  setSelection([sim.own(0).find((e) => e.type === "hq").id]);
}

$("start").onclick = () => {
  unlockAudio();
  started = true;
  paused = false;
  $("briefing").hidden = true;
  $("status-text").textContent = "OPERATION ACTIVE";
  setSelection([sim.own(0).find((e) => e.type === "hq").id]);
  notice(
    "Select Harvesters, then right-click amber crystals to start your economy.",
  );
  tone(780, 0.15);
};
$("pause").onclick = togglePause;
$("help").onclick = showHelp;
$("controls-link").onclick = showHelp;
$("home").onclick = focusHome;
$("audio").onclick = () => {
  unlockAudio();
  muted = !muted;
  $("audio").innerHTML = icon(muted ? "muted" : "volume");
  $("audio").title = muted ? "Enable sound" : "Mute sound";
  $("audio").setAttribute("aria-label", $("audio").title);
};
$("move-order").onclick = () => enterMode("move");
$("attack-order").onclick = () => enterMode("attackmove");
$("stop-order").onclick = () => {
  sim.issue([...selected], { type: "stop" });
  notice("Orders cleared.");
};
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
$("queue").onclick = (event) => {
  if (paused || !started) return;
  const button = event.target.closest("[data-cancel]"),
    cancel = event.target.closest("[data-cancel-build]");
  if (button)
    sim.cancelQueue(selectedEntities()[0].id, Number(button.dataset.cancel));
  if (cancel) sim.cancelBuilding(Number(cancel.dataset.cancelBuild));
  updateUI();
};
$("modal").onclick = (event) => {
  if (event.target.closest("[data-resume]")) closeModal();
  if (event.target.closest("[data-restart]")) restart();
};

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - timePrevious) / 1000, 0.1);
  timePrevious = now;
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
  frameTime += dt;
  if (frameTime >= 1) {
    $("fps").textContent = `${Math.round(frameCount / frameTime)} FPS`;
    frameCount = 0;
    frameTime = 0;
  }
}

async function boot() {
  try {
    view = new WorldView($("world"));
    await view.loadModels();
    bindInput();
    $("start").disabled = false;
    $("start").innerHTML = `Deploy expedition ${icon("arrow")}`;
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
      };
  } catch (error) {
    console.error(error);
    $("start").textContent = "Unable to initialize";
    $("status-text").textContent = "INITIALIZATION FAILED";
    notice(
      "The 3D engine could not start. Enable hardware acceleration and reload in a current desktop browser.",
    );
    $("briefing").querySelector("p").textContent =
      "Check your connection and WebGL support, then reload. All game assets must be served from the built site.";
  }
}
boot();
