// Staged story scenes (0.19b "Story you see"; data and beat format in src/story/scenes.js).
//
// A mission's `{ scene: id }` action emits a `scene` event; the frame loop (app/frame.js) stops
// ticking on that tick and calls playScene. The scene is the "scene" screen (screens.js): it holds
// the match like a dialog but keeps the music playing. Letterbox bars slide in (transform only),
// the HUD steps aside, the camera eases to explored places of the mission (cuts under
// :root.motion-off), the lines appear in the ordinary dialogue box with their portraits, then the
// camera returns to where the player left it and the match runs on. Skip (44 px), Escape, Space
// or Enter end it at once; the lines not yet shown go to the Comms log. A scene plays once per
// match; lines spoken on the tick that started it wait until it ends. The simulation never waits
// for a scene, so saving, loading and replays are exactly as without it.
import "../scenes.css";
import { $ } from "./dom.js";
import { SCENES, FLASHES, sceneLineSeconds } from "../story/scenes.js";
import { motionOff } from "./preferences.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (k) => k * k * (3 - 2 * k);

export function setupScenes(S, A) {
  const Z = S.screen, root = document.documentElement;
  const veil = document.createElement("div");
  veil.id = "scene";
  veil.className = "scene-veil";
  veil.hidden = true;
  veil.setAttribute("role", "region");
  veil.setAttribute("aria-label", "Story scene");
  veil.innerHTML = `<div class="scene-bar top" aria-hidden="true"></div><div class="scene-bar bottom" aria-hidden="true"></div><div class="scene-flash" aria-hidden="true"></div><button id="scene-skip" class="scene-skip" type="button" aria-keyshortcuts="Escape Space"><span>Skip scene</span><kbd aria-hidden="true">Esc</kbd></button>`;
  $("stage").append(veil);
  const flash = veil.querySelector(".scene-flash");

  // play: { id, scene, i, t, length, from, cam, later, then, back }
  let play = null;
  // Scenes already played in this match (a new match is a new simulation).
  let playedBy = null, played = new Set();
  const behind = () => [document.querySelector(".brand"), document.querySelector(".resource-bar"),
    ...[...(document.querySelector(".top-actions")?.children || [])].filter((node) => node.id !== "audio")];

  // A region of the mission or a literal { x, z }; null when it cannot be resolved.
  function place(at) {
    const p = typeof at === "string" ? S.sim.missionDef?.regions?.[at] : at;
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z } : null;
  }
  const explored = (p) => { try { return S.sim.isExplored(p, 0); } catch { return false; } };

  function playScene(id) {
    const scene = SCENES[id];
    if (playedBy !== S.sim) { playedBy = S.sim; played = new Set(); }
    if (!scene || play || played.has(id) || !Z.started || (Z.modalType && Z.modalType !== "scene") || !S.view) return false;
    played.add(id);
    S.touchControls?.reset();
    S.drag = null;
    S.keys.clear();
    S.cameraPan = null;
    S.pointer.inside = false;
    A.clearMode?.();
    $("selection-box").style.display = "none";
    Z.open("scene");
    play = { id, scene, sim: S.sim, i: -1, t: 0, length: 0, from: { x: S.view.focus.x, z: S.view.focus.z, zoom: S.view.zoom }, cam: null, later: [], then: [], back: document.activeElement };
    veil.hidden = false;
    veil.dataset.scene = id;
    root.classList.add("scene-open");
    for (const node of behind()) if (node) node.inert = true;
    // The bars slide in on the next frame (no transition under motion-off).
    requestAnimationFrame(() => { if (play?.id === id) veil.classList.add("on"); });
    veil.querySelector("#scene-skip").focus({ preventScroll: true });
    next();
    return true;
  }

  // Starts the next beat (or ends the scene). A camera beat to an unexplored place is skipped.
  function next() {
    for (;;) {
      play.i++;
      play.t = 0;
      const beat = play.scene.beats[play.i];
      if (!beat) { end(false); return; }
      veil.dataset.beat = String(play.i);
      if (beat.camera) {
        const to = place(beat.camera.at);
        if (!to || !explored(to)) continue;
        const zoom = clamp(S.view.defaultZoom * (beat.camera.zoom ?? 1), 22, S.view.maxZoom || 88);
        play.cam = { fromX: S.view.focus.x, fromZ: S.view.focus.z, fromZoom: S.view.zoom, x: to.x, z: to.z, zoom };
        play.length = beat.camera.seconds ?? 2;
        // Motion off: cut there, and hold a moment so the place reads.
        if (motionOff() || S.view.reducedMotion?.matches) { setCamera(1); play.length = Math.min(play.length, 0.8); play.cam = null; }
        return;
      }
      play.cam = null;
      if (beat.say) { A.missionUI.sceneLine(beat.say.who, beat.say.text); play.length = sceneLineSeconds(beat.say.text); return; }
      if (beat.fx) {
        if (FLASHES.includes(beat.fx.flash) && !motionOff()) { flash.className = "scene-flash"; void flash.offsetWidth; flash.className = `scene-flash ${beat.fx.flash}`; }
        if (beat.fx.ping) { const p = place(beat.fx.ping); if (p) S.pings.push({ x: p.x, z: p.z, at: S.sim.time }); }
        play.length = 0.3;
        return;
      }
      if (beat.wait !== undefined) { play.length = beat.wait; return; }
    }
  }
  function setCamera(k) {
    const c = play.cam, e = smooth(clamp(k, 0, 1));
    S.view.zoom = c.fromZoom + (c.zoom - c.fromZoom) * e;
    S.view.focusOn(c.fromX + (c.x - c.fromX) * e, c.fromZ + (c.z - c.fromZ) * e);
  }

  // Every frame with the real time that passed.
  function sceneTick(dt) {
    if (!play) return;
    // Something else took the screen (graphics lost): the scene quietly ends without moving it.
    if (Z.modalType !== "scene") { end(true, { keepScreen: true }); return; }
    play.t += dt;
    if (play.cam) setCamera(play.t / Math.max(0.01, play.length));
    if (play.t >= play.length) next();
  }

  // skipped: the lines not yet shown go to the Comms log. The camera returns to the player's view.
  function end(skipped, { keepScreen = false } = {}) {
    if (!play) return;
    const p = play;
    play = null;
    if (skipped) for (const beat of p.scene.beats.slice(Math.max(0, p.i + 1))) if (beat.say) A.missionUI.sceneLine(beat.say.who, beat.say.text, false);
    // (A match restarted meanwhile keeps its own fresh camera.)
    if (p.sim === S.sim) { S.view.zoom = p.from.zoom; S.view.focusOn(p.from.x, p.from.z); }
    veil.classList.remove("on");
    veil.hidden = true;
    flash.className = "scene-flash";
    delete veil.dataset.scene;
    root.classList.remove("scene-open");
    for (const node of behind()) if (node) node.inert = false;
    S.keys.clear();
    if (!keepScreen && Z.modalType === "scene") Z.close(!!S.sim.result);
    for (const event of p.later) { A.missionUI.say(event.who, event.text); if (S.sim.result) A.missionUI.endMatch(); }
    if (p.back?.isConnected && !p.back.closest?.("[hidden]") && !p.back.disabled) p.back.focus?.({ preventScroll: true });
    for (const fn of p.then) fn();
  }

  Object.assign(A, {
    playScene,
    sceneTick,
    skipScene: () => { if (!play) return false; end(true); return true; },
    sceneActive: () => !!play,
    // A line from the tick that started the scene: shown when it ends.
    sceneLater: (event) => { if (play) play.later.push(event); else A.missionUI.say(event.who, event.text); },
    // Runs after the scene (the debrief of a winning tick); at once when none is playing.
    afterScene: (fn) => { if (play) play.then.push(fn); else fn(); },
    sceneState: () => (play ? { open: true, id: play.id, beat: play.i, beats: play.scene.beats.length, letterbox: !!play.scene.letterbox } : { open: false }),
  });
  return function bind() {
    veil.querySelector("#scene-skip").onclick = () => { if (play) end(true); };
    // The scene owns the keyboard: Escape, Space or Enter skip it; nothing else reaches the game.
    window.addEventListener("keydown", (event) => {
      if (!play) return;
      if (event.key === "Tab") { event.preventDefault(); veil.querySelector("#scene-skip").focus({ preventScroll: true }); return; }
      event.stopPropagation();
      if (["Escape", " ", "Spacebar", "Enter"].includes(event.key)) { event.preventDefault(); if (!event.repeat) end(true); }
    }, true);
  };
}
