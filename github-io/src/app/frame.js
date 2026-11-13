// The frame loop: simulation steps, event dispatch, camera pan and alerts.
import { $ } from "./dom.js";
import { AUTOSAVE_SECONDS } from "../savegame.js";
import { pointLabel } from "../mission-ui.js";
import { setMusicMood } from "../music.js";
import { airModelsFor } from "../model-roster.js";

export function setupFrame(S, A) {
  const Z = S.screen;
  let uiClock = 0, airFor = null;
  let timePrevious = performance.now();
  let renderAlpha = 1;
  let frameCount = 0;
  let frameTime = 0;
  let coveredRedraw = 0;
  function promoted(event) {
    const unit = S.sim.get(event.id);
    A.notice(`${unit?.name || "Unit"} promoted to rank ${event.rank}`);
    A.tone(990, 0.16);
  }

  // Alerts (A.alert, the warning style) keep the notice line their full time: a routine notice waits
  // and a counter hint sits apart (app/hud.js, message-queue.js). The same alert again only refreshes.
  // The rules' raid warning (ai.js, ai-plan.js) is an alert too.
  const RAID_WARNING = /^Scouts report enemy raiders/;
  function incomingAlert(event) {
    A.alert("Enemy attack incoming!");
    if (Number.isFinite(event.x) && Number.isFinite(event.z)) S.pings.push({ x: event.x, z: event.z, at: S.sim.time });
    A.tone(300, 0.3);
  }

  // Your own buildings or units hit: a toast and a minimap ping, at most once every ten seconds of play.
  let attackedAt = -Infinity;
  function underAttack(event) {
    if (S.sim.time >= attackedAt && S.sim.time - attackedAt < 10) return;
    attackedAt = S.sim.time;
    A.alert("Under attack!");
    S.pings.push({ x: event.x, z: event.z, at: S.sim.time });
  }

  // Capture points: a toast and a ping when one changes hands.
  const pointOwners = new Map();

  function syncPointOwners() {
    pointOwners.clear();
    for (const [name, p] of Object.entries(S.sim.mission?.points || S.sim.skirmishPoints || {})) pointOwners.set(name, p.owner ?? null);
  }

  function pointAlert(event) {
    const name = pointLabel(S.sim.missionDef, event.name), before = pointOwners.get(event.name) ?? null;
    pointOwners.set(event.name, event.owner);
    if (event.owner === 0) { A.notice(`${name} captured`); }
    else A.alert(before === 0 ? `${name} lost` : `${name} taken by the enemy`);
    S.pings.push({ x: event.x, z: event.z, at: S.sim.time });
  }

  function startCameraPan(x, z) {
    if (!S.view) return;
    if (S.view.reducedMotion?.matches) { S.view.focusOn(x, z); return; }
    S.cameraPan = { fromX: S.view.focus.x, fromZ: S.view.focus.z, x, z, t: 0 };
  }

  // A mission can field the player without a Command core: the squad is home then.
  function focusHome() {
    S.cameraPan = null;
    const own = S.sim.own(0), hq = own.find((e) => e.type === "hq");
    const squad = hq ? null : own.find((e) => e.kind === "unit" && e.type !== "worker") || own[0];
    if (hq) S.view?.focusOn(hq.x + 5, hq.z - 5);
    else if (squad) S.view?.focusOn(squad.x, squad.z);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - timePrevious) / 1000),
      dt = Math.min(elapsed, 0.25);
    timePrevious = now;
    S.ambience?.update(
      S.settings,
      Z.started && !Z.paused && !S.sim.result,
      S.sim.terrain.river && Math.abs(S.view.focus.z) < 14,
    );
    A.syncAudio(elapsed);
    S.audio?.update(elapsed, { sim: S.sim, settings: S.settings, started: Z.started, paused: Z.paused, hidden: document.hidden, mapId: S.mapId, screen: A.musicScreen(), inBattle: S.sim.defence?.phase === "wave" });
    A.refreshHover();
    const running = Z.started && !Z.paused && !S.sim.result;
    if (running) {
      S.accumulator += dt;
      while (S.accumulator >= 0.05) {
        S.view.beforeTick(S.sim);
        S.tutorial?.update(S.sim,[...S.selected]);
        S.matchStats.before(S.sim);
        S.sim.tick(0.05);
        S.matchStats.after(S.sim);
        S.tutorial?.update(S.sim,[...S.selected]);
        S.accumulator -= 0.05;
      }
      if (S.sim.result) { if (!A.beginBeat()) A.showResult(); }
      else if ((S.saveClock += dt) >= AUTOSAVE_SECONDS) A.autosave();
    }
    A.missionUI.tick(running ? dt : 0);
    if (!Z.modalType) {
      const speed = dt * S.view.zoom * 0.65;
      let dx =
        (S.keys.has("d") || S.keys.has("arrowright") ? 1 : 0) -
        (S.keys.has("a") || S.keys.has("arrowleft") ? 1 : 0);
      let dy =
        (S.keys.has("w") || S.keys.has("arrowup") ? 1 : 0) -
        (S.keys.has("s") || S.keys.has("arrowdown") ? 1 : 0);
      if (S.pointer.inside && Z.started && !S.drag && !S.mode) {
        const r = S.view.renderer.domElement.getBoundingClientRect();
        if (S.pointer.x < r.left + 8) dx--;
        if (S.pointer.x > r.right - 8) dx++;
        if (S.pointer.y < r.top + 8) dy++;
        if (S.pointer.y > r.bottom - 8) dy--;
      }
      if (dx || dy) { S.cameraPan = null; S.view.screenPan(dx * speed, dy * speed); }
    }
    if (S.cameraPan && Z.started && !Z.paused) {
      const k = (S.cameraPan.t = Math.min(1, S.cameraPan.t + dt / 1.2)), ease = k * k * (3 - 2 * k);
      S.view.focusOn(S.cameraPan.fromX + (S.cameraPan.x - S.cameraPan.fromX) * ease, S.cameraPan.fromZ + (S.cameraPan.z - S.cameraPan.fromZ) * ease);
      if (k >= 1) S.cameraPan = null;
    }
    const beatScale = A.stepBeat(dt);
    const events = S.sim.events.splice(0);
    S.view.cameraCue = !!S.cameraPan || events.some(e => e.type === "camera");
    for (const event of events) {
      A.factionEvent(event);
      if (event.type === "impact" && event.team === 0 && Z.started) underAttack(event);
      if (Z.started) S.audio?.event(event, S.sim);
      if (event.type === "message") (RAID_WARNING.test(event.text) ? A.alert : A.notice)(event.text);
      else if (event.type === "incoming") { if (event.team === 0) incomingAlert(event); }
      // Story mission cues (sim/missions.js).
      // A line spoken on the tick that ended the match goes straight to the Comms log.
      else if (event.type === "say") { if (Z.started) { A.missionUI.say(event.who, event.text); if (S.sim.result) A.missionUI.endMatch(); } }
      else if (event.type === "objective") { A.missionUI.objectiveEvent(event, S.sim); if (event.state === "revealed") A.notice("New objective"); }
      else if (event.type === "point") pointAlert(event);
      else if (event.type === "camera") startCameraPan(event.x, event.z);
      else if (event.type === "ping") { S.pings.push({ x: event.x, z: event.z, at: S.sim.time }); A.tone(520, 0.1); }
      else if (event.type === "music") setMusicMood(event.mood);
      else if (event.type === "missionEnd") { /* The debrief opens from sim.result (showResult). */ }
      else if (event.type === "promote") { if (event.team === 0 && Z.started) promoted(event); S.view.event(event, S.sim); }
      else S.view.event(event, S.sim);
    }
    // Presentation effects hold still while paused; units render between the last two
    // 20 Hz simulation steps so movement stays smooth on high-refresh displays. The blend
    // is kept while paused so pausing and resuming never snap units back and forth.
    if (running && !S.sim.result) renderAlpha = S.accumulator / 0.05;
    // The phone start screen is opaque: redraw the hidden battlefield twice a second, enough to keep
    // models and shaders warm for Start without spending battery on frames nobody sees.
    const root = document.documentElement;
    coveredRedraw -= elapsed;
    if (Z.started || !root.classList.contains("compact-ui") || !root.classList.contains("in-briefing") || coveredRedraw <= 0) {
      if (S.view.modelsReady) S.view.update(S.sim, Z.started && !Z.paused ? dt * beatScale : 0, S.selected, S.hover, renderAlpha);
      coveredRedraw = 0.5;
    }
    uiClock -= dt;
    if (uiClock <= 0) {
      // Flyers come minutes into a match: their models load in the background once it has started (0.18).
      if (Z.started && airFor !== S.sim) { airFor = S.sim; S.view.preloadModels?.(airModelsFor(S.sim)); }
      if (S.hover && !S.sim.get(S.hover.id)) { S.hover = null; $("hover-label").hidden = true; }
      A.updateUI();
      A.minimap();
      A.uiExtrasTick();
      uiClock = 0.15;
    }
    if (S.governed)
      S.governor.sample(elapsed, performance.now() - now, Z.started && !Z.paused && !S.sim.result && !Z.modalType && !document.hidden);
    frameCount++;
    frameTime += elapsed;
    if (frameTime >= 1) {
      $("fps").textContent = `${Math.round(frameCount / frameTime)} FPS`;
      frameCount = 0;
      frameTime = 0;
    }
  }

  Object.assign(A, { focusHome, syncPointOwners, frame });
  return function bind() {
    for (const type of ["pointerdown", "wheel", "keydown"])
      window.addEventListener(type, (event) => {
        if (S.cameraPan && (type === "keydown" || (event.target instanceof Element && event.target.closest("#world, #minimap, #home, .touch-controls")))) S.cameraPan = null;
      }, { capture: true, passive: true });

    $("home").onclick = focusHome;
  };
}
