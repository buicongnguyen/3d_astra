// The frame loop: simulation steps, event dispatch, camera pan and alerts.
import { $ } from "./dom.js";
import { AUTOSAVE_SECONDS } from "../savegame.js";
import { pointLabel } from "../mission-ui.js";
import { setMusicMood } from "../music.js";
import { airModelsFor } from "../model-roster.js";
import { MUSIC_HOLDS } from "./screens.js";
import { FastForward, MAX_TICKS_PER_FRAME, tickBudgetSpent } from "../governor.js";

// Fast-forward (Frontier Defence, AAA round 2 W1-F): module-local, not in app/state.js. The speed is
// 1, 2 or 3 and only feeds the clock that drives the fixed 0.05 s ticks, so a match played at any
// speed replays tick for tick. FastForward (governor.js) holds the rules and is tested without a DOM.
const fastForward = new FastForward();
export const getSpeed = () => fastForward.speed;
export const setSpeed = (speed) => fastForward.set(speed);

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
  // A Defence wave from several spawn points warns once per point (sim/defence.js startWave):
  // one ping each, but one alert and one tone for the whole batch.
  let incomingBatch = null;
  function incomingAlert(event, batch) {
    if (Number.isFinite(event.x) && Number.isFinite(event.z)) S.pings.push({ x: event.x, z: event.z, at: S.sim.time });
    if (incomingBatch === batch) return;
    incomingBatch = batch;
    A.alert("Enemy attack incoming!");
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
      S.sim.terrain.river && !!S.sim.terrain.riverNear(S.view.focus.z, 14),
    );
    A.syncAudio(elapsed);
    // The decision card and a story scene hold the match but the music plays on (screens.js MUSIC_HOLDS).
    S.audio?.update(elapsed, { sim: S.sim, settings: S.settings, started: Z.started, paused: (S.audioPaused = Z.paused && !MUSIC_HOLDS.includes(Z.modalType)), hidden: document.hidden, mapId: S.mapId, screen: A.musicScreen(), inBattle: !!S.sim.defence?.active });
    A.refreshHover();
    // A story mission waiting for a Commander decision (also after loading a save) shows its card.
    if (Z.started && !Z.paused && !S.sim.result && S.sim.mission?.pending) A.openDecision();
    // S.testHold (browser tests only, window.__frontier.hold): draw but do not advance the match, so a
    // test moves time with step() alone and a slow machine cannot run the clock on between its checks.
    // S.defenceGuideHold (app/defence/guide.js): the Defence first-build guide's steps 1 and 2 wait on the clock too.
    const running = Z.started && !Z.paused && !S.sim.result && !S.testHold && !S.defenceGuideHold;
    // D2: the clock's pace, 1 in everything but a Defence match; a scene or a decision puts it back to 1.
    const pace = fastForward.pace({ sim: S.sim, started: Z.started, defence: !!S.sim.defence, forced: MUSIC_HOLDS.includes(Z.modalType) || !!A.sceneActive?.() || !!S.sim.mission?.pending });
    if (running) {
      S.accumulator += dt * pace;
      let ticks = 0;
      const tickStart = performance.now();
      while (S.accumulator >= 0.05) {
        S.view.beforeTick(S.sim);
        S.tutorial?.update(S.sim,[...S.selected]);
        S.matchStats.before(S.sim);
        const heard = S.sim.events.length;
        S.sim.tick(0.05);
        S.matchStats.after(S.sim);
        S.tutorial?.update(S.sim,[...S.selected]);
        S.accumulator -= 0.05;
        // A decision stops the clock on the tick that asked it; the card opens next frame.
        if (S.sim.mission?.pending) { S.accumulator = 0; break; }
        // So does a story scene (app/scenes.js): it starts on the tick that called it.
        if (S.sim.events.length > heard && S.sim.events.some((e, i) => i >= heard && e.type === "scene")) { S.accumulator = 0; break; }
        ticks++;
        // Account for the next tick as well: two 14 ms ticks miss the 20 ms budget,
        // even though the first one returned before the deadline.
        const work = performance.now() - tickStart;
        if (S.accumulator >= 0.05 && tickBudgetSpent(work, ticks)) {
          S.accumulator %= 0.05;
          break;
        }
        // Fast-forward: at most MAX_TICKS_PER_FRAME ticks a frame; what a slow frame cannot run is dropped, not owed.
        if (pace > 1 && ticks >= MAX_TICKS_PER_FRAME) { S.accumulator = Math.min(S.accumulator, 0.05); break; }
      }
      // A scene holds the match while it plays; one called by the winning tick plays before the debrief.
      const scene = S.sim.events.find((e) => e.type === "scene");
      if (scene) A.playScene?.(scene.id);
      if (S.sim.result) { if (A.sceneActive?.()) A.afterScene(() => { if (!A.beginBeat()) A.showResult(); }); else if (!A.beginBeat()) A.showResult(); }
      else if ((S.saveClock += dt) >= AUTOSAVE_SECONDS) A.autosave();
    }
    A.missionUI.tick(running ? dt : 0);
    A.sceneTick?.(dt);
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
      else if (event.type === "incoming") { if (event.team === 0) incomingAlert(event, events); }
      // Frontier Defence troop carriers (0.22): the drop and the "+N" of a carrier lost with its squad.
      else if (event.type === "drop" || event.type === "carrierDown") { if (Z.started) A.defenceEvent?.(event); }
      // Story mission cues (sim/missions.js).
      // A line spoken on the tick that ended the match goes straight to the Comms log.
      // Lines from the tick that started a scene wait until it is over (app/scenes.js).
      else if (event.type === "say") { if (Z.started) { if (A.sceneActive?.()) A.sceneLater(event); else { A.missionUI.say(event.who, event.text); if (S.sim.result) A.missionUI.endMatch(); } } }
      else if (event.type === "objective") { A.missionUI.objectiveEvent(event, S.sim); if (event.state === "revealed") A.notice("New objective"); }
      else if (event.type === "point") pointAlert(event);
      else if (event.type === "camera") startCameraPan(event.x, event.z);
      else if (event.type === "ping") { S.pings.push({ x: event.x, z: event.z, at: S.sim.time }); A.tone(520, 0.1); }
      else if (event.type === "music") setMusicMood(event.mood);
      else if (event.type === "missionEnd") { /* The debrief opens from sim.result (showResult). */ }
      else if (event.type === "decision" || event.type === "decided") { /* The card follows sim.mission.pending (above). */ }
      else if (event.type === "scene") { /* Started above, before the events are read. */ }
      else if (event.type === "death" && event.squad && event.team === 0) { if (Z.started) A.notice(`${event.squad} has fallen`); S.view.event(event, S.sim); }
      else if (event.type === "promote") { if (event.team === 0 && Z.started) promoted(event); S.view.event(event, S.sim); }
      else S.view.event(event, S.sim);
    }
    // Presentation effects hold still while paused; units render between the last two
    // 20 Hz simulation steps so movement stays smooth on high-refresh displays. The blend
    // is kept while paused so pausing and resuming never snap units back and forth.
    if (running && !S.sim.result) renderAlpha = S.accumulator / 0.05;
    // The start screen is opaque on every frame shape (the painted cover, R3-M): redraw the hidden battlefield
    // twice a second, enough to keep models and shaders warm for Start without spending GPU on frames nobody sees.
    const root = document.documentElement;
    coveredRedraw -= elapsed;
    if (Z.started || !root.classList.contains("in-briefing") || coveredRedraw <= 0) {
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
      A.wildTick?.();
      uiClock = 0.15;
    }
    if (S.governed)
      S.governor.sample(elapsed, performance.now() - now, Z.started && !Z.paused && !S.sim.result && !Z.modalType && !document.hidden);
    // D2: a touch device that cannot keep up at a fast pace drops back to ×1 and says so.
    if (pace > 1 && S.governed && fastForward.sample(elapsed, performance.now() - now, { touch: S.touchInput, playing: running && !Z.modalType && !document.hidden }))
      A.notice("Fast-forward off: this device could not keep up.");
    A.defenceFrame?.(dt);
    frameCount++;
    frameTime += elapsed;
    if (frameTime >= 1) {
      $("fps").textContent = `${Math.round(frameCount / frameTime)} FPS`;
      frameCount = 0;
      frameTime = 0;
    }
  }

  // The speed control (the Defence bar, Shift+Space and the help list): the next speed, ×3 on a fine pointer only.
  function cycleSpeed() {
    if (!S.sim?.defence || !Z.started) return fastForward.speed;
    const speed = fastForward.cycle(!S.touchInput);
    A.notice(`Speed ×${speed}`);
    return speed;
  }
  Object.assign(A, { focusHome, syncPointOwners, frame, cycleSpeed, getSpeed });
  return function bind() {
    window.addEventListener("online", () => { airFor = null; });
    for (const type of ["pointerdown", "wheel", "keydown"])
      window.addEventListener(type, (event) => {
        if (S.cameraPan && (type === "keydown" || (event.target instanceof Element && event.target.closest("#world, #minimap, #home, .touch-controls")))) S.cameraPan = null;
      }, { capture: true, passive: true });

    $("home").onclick = focusHome;
  };
}
