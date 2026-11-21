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
//
// Mission openings (R3-G, src/story/openings.js) play on the same screen: as a campaign mission begins,
// the camera starts on the mission's landmark with its title, then glides home in 4 to 6 seconds.
// Skip, a tap anywhere, Escape, Space or Enter end it; reduced motion and combat motion off skip it; it plays
// once per mission per page visit, and under ?test only with ?opening.
import "../scenes.css";
import "../openings.css";
import { $ } from "./dom.js";
import { SCENES, FLASHES, TITLE_BEAT_SECONDS, sceneLineSeconds } from "../story/scenes.js";
import { motionOff } from "./preferences.js";
import { OPENINGS, openingPlan, openingPose } from "../story/openings.js";
import { titleCardFor } from "../story/mission-intros.js";
import { hideTitleCard } from "./title-card.js";
import { MISSIONS } from "../story/missions.js";
import { DEFINITIONS } from "../data.js";

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
  veil.innerHTML = `<div class="scene-bar top" aria-hidden="true"></div><div class="scene-bar bottom" aria-hidden="true"></div><div class="scene-flash" aria-hidden="true"></div><div class="scene-title" aria-hidden="true"><strong></strong><span></span></div><div class="opening-title" aria-hidden="true"><span class="op-kicker"></span><strong></strong><span class="op-place"></span></div><button id="scene-skip" class="scene-skip" type="button" aria-keyshortcuts="Escape Space"><span>Skip scene</span><kbd aria-hidden="true">Esc</kbd></button>`;
  $("stage").append(veil);
  const flash = veil.querySelector(".scene-flash"), titleBox = veil.querySelector(".scene-title"), openingBox = veil.querySelector(".opening-title");

  // play: { id, scene, i, t, length, from, cam, later, then, back }
  let play = null;
  // Scenes already played in this match (a new match is a new simulation).
  let playedBy = null, played = new Set();
  // Openings: the simulation last looked at, and the missions already opened in this page visit.
  let openedSim = null;
  const opened = new Set();
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
    // The line of play steps aside when a scene starts (the scene speaks in its place).
    A.missionUI.dismiss?.();
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
      if (beat.title) {
        titleBox.querySelector("strong").textContent = beat.title.text;
        titleBox.querySelector("span").textContent = beat.title.sub || "";
        titleBox.classList.remove("on"); void titleBox.offsetWidth; titleBox.classList.add("on");
        play.length = TITLE_BEAT_SECONDS;
        return;
      }
      if (beat.shake !== undefined) { S.view.shake?.add(beat.shake, 0, S.view.shakeEnabled?.() ?? false); play.length = 0.3; return; }
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

  // A campaign mission that just began opens with its fly-in (see the header for when it does not).
  function maybeOpening() {
    const def = S.sim?.missionDef;
    if (!def || !OPENINGS[def.id] || opened.has(def.id) || S.playMode !== "campaign" || !Z.started || Z.paused || Z.modalType) return false;
    if (S.sim.time > 0.3 || S.sim.result || (S.query?.has("test") && !S.query.has("opening"))) return false;
    // Calm like the title cover (app/cover.js): reduced motion or "Animate combat effects" off skip it; Eco
    // graphics alone (the phones' default) keep it, a camera move costs no extra drawing.
    if (S.view?.reducedMotion?.matches || S.settings?.combatMotion === false) return false;
    return playOpening(def);
  }

  // Plays the opening of `def` from the camera's current place (its home); false when it has none.
  function playOpening(def = S.sim?.missionDef) {
    if (!def || play || !Z.started || (Z.modalType && Z.modalType !== "scene") || !S.view) return false;
    const home = { x: S.view.focus.x, z: S.view.focus.z, zoom: S.view.zoom };
    const plan = openingPlan(def, home, { baseZoom: S.view.defaultZoom, maxZoom: S.view.maxZoom || 88 });
    if (!plan) return false;
    opened.add(def.id);
    S.touchControls?.reset();
    S.drag = null;
    S.keys.clear();
    S.cameraPan = null;
    S.pointer.inside = false;
    Z.open("scene");
    play = { id: "opening", opening: plan, scene: { beats: [], letterbox: true }, sim: S.sim, i: 0, t: 0, length: plan.seconds, from: home, cam: null, later: [], then: [], back: document.activeElement };
    veil.hidden = false;
    veil.dataset.scene = "opening";
    veil.classList.add("opening");
    root.classList.add("scene-open");
    for (const node of behind()) if (node) node.inert = true;
    const info = titleCardFor(def) || { kicker: "", title: def.title || "", place: "" };
    openingBox.querySelector(".op-kicker").textContent = info.kicker;
    openingBox.querySelector("strong").textContent = info.title;
    openingBox.querySelector(".op-place").textContent = info.place;
    openingBox.style.setProperty("--op-seconds", `${plan.seconds}s`);
    openingBox.classList.remove("on"); void openingBox.offsetWidth; openingBox.classList.add("on");
    // The title reads in the opening itself; the match's own card would only repeat it.
    hideTitleCard();
    liftFog();
    // Phones: the strip under the (hidden) dock is drawn too, so the fly-in fills the letterbox.
    play.coverOpen = S.view.coverOpen;
    S.view.setCoverOpen?.(false);
    const pose = openingPose(plan, 0);
    S.view.zoom = pose.zoom;
    S.view.focusOn(pose.x, pose.z);
    requestAnimationFrame(() => { if (play?.opening === plan) veil.classList.add("on"); });
    veil.querySelector("#scene-skip").focus({ preventScroll: true });
    return true;
  }

  // The opening flies over ground the player has not explored yet: the view draws it without the fog of war
  // (the land only: units and buildings out of sight stay hidden, so no intel leaks) until the camera is home.
  // View only; the simulation's explored map is untouched.
  let fogLift = null;
  function liftFog() {
    const v = S.view;
    if (fogLift || !v?.fogMesh || !v.fogUniforms?.uFogMap) return;
    try {
      const blank = document.createElement("canvas");
      blank.width = blank.height = 1;
      const clear = new v.fogTexture.constructor(blank);
      clear.needsUpdate = true;
      fogLift = { view: v, map: v.fogUniforms.uFogMap.value, mesh: v.fogMesh, visible: v.fogMesh.visible, clear };
      v.fogUniforms.uFogMap.value = clear;
      v.fogMesh.visible = false;
    } catch { fogLift = null; }
  }
  function restoreFog() {
    if (!fogLift) return;
    const { view, map, mesh, visible, clear } = fogLift;
    fogLift = null;
    if (view.fogUniforms.uFogMap.value === clear) view.fogUniforms.uFogMap.value = map;
    if (view.fogMesh === mesh) mesh.visible = visible;
    clear.dispose?.();
  }

  // Dev hook (window.__frontier.jumpBoss): straight to a boss fight. `id` is a boss id ("iron-vanguard")
  // or its unit type. A match that already has the boss jumps there; otherwise the campaign mission that
  // fields it starts (without its opening). The map is revealed, the player's army stands 12 m from the
  // boss and the camera looks at it. Resolves { id, type, mission, x, z }, or null for an unknown boss.
  async function jumpBoss(id = "iron-vanguard") {
    const type = Object.keys(DEFINITIONS).find((t) => DEFINITIONS[t]?.boss && (t === id || DEFINITIONS[t].boss === id));
    if (!type) return null;
    const alive = () => S.sim.entities.find((e) => e.type === type && e.hp > 0);
    if (!Z.started || !alive()) {
      const index = MISSIONS.findIndex((m) => (m.setup || []).some((s) => s.spawn === type));
      if (index < 0) return null;
      if (Z.started) await A.newGame();
      S.playMode = "campaign";
      S.campaignId = "main";
      S.stagePick = index;
      opened.add(MISSIONS[index].id);
      A.previewBattle();
      await A.restart();
      S.activeStage = index;
    }
    if (play) end(true);
    hideTitleCard();
    const boss = alive();
    if (!boss) return null;
    const s = S.sim;
    s.explored[0].fill(1);
    const army = s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker");
    army.forEach((e, i) => { e.x = boss.x - 5 + (i % 5) * 1.6; e.z = boss.z + 12 + Math.floor(i / 5) * 1.6; e.orders = []; e.post = null; });
    s.updateVision();
    S.cameraPan = null;
    S.view.zoom = S.view.defaultZoom;
    S.view.focusOn(boss.x, boss.z + 6);
    return { id: boss.id, type, mission: s.missionDef?.id ?? null, x: boss.x, z: boss.z };
  }

  // Every frame with the real time that passed.
  function sceneTick(dt) {
    // A new match is looked at once it runs (a prompt opened at its start, such as Full screen, goes first).
    if (!play && S.sim !== openedSim && Z.started && !Z.paused && !Z.modalType) { openedSim = S.sim; maybeOpening(); }
    if (!play) return;
    // Something else took the screen (graphics lost): the scene quietly ends without moving it.
    if (Z.modalType !== "scene") { end(true, { keepScreen: true }); return; }
    play.t += dt;
    if (play.opening) {
      // The HUD may re-decide the dock strip as the match starts: keep it drawn, remember the HUD's latest wish.
      if (S.view.coverOpen !== false) { play.coverOpen = S.view.coverOpen; S.view.setCoverOpen?.(false); }
      const pose = openingPose(play.opening, Math.min(play.t, play.opening.seconds));
      S.view.zoom = pose.zoom;
      S.view.focusOn(pose.x, pose.z);
      // The title steps aside before the camera lands (also under motion-off, where CSS animations stop).
      if (play.t > play.opening.seconds * 0.78) openingBox.classList.remove("on");
      if (play.t >= play.opening.seconds) end(false);
      return;
    }
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
    if (p.opening) { restoreFog(); if (p.sim === S.sim) S.view.setCoverOpen?.(p.coverOpen !== false); }
    veil.classList.remove("on", "opening");
    openingBox.classList.remove("on");
    veil.hidden = true;
    flash.className = "scene-flash";
    titleBox.classList.remove("on");
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
    sceneState: () => (play ? { open: true, id: play.id, beat: play.i, beats: play.scene.beats.length, letterbox: !!play.scene.letterbox, ...(play.opening ? { opening: { mission: play.opening.id, frames: play.opening.frames, t: play.t, seconds: play.opening.seconds, from: play.opening.from, to: play.opening.to } } : {}) } : { open: false }),
    playOpening,
    jumpBoss,
  });
  return function bind() {
    veil.querySelector("#scene-skip").onclick = () => { if (play) end(true); };
    // An opening ends with a tap anywhere (a story scene keeps its lines to read: only Skip ends it).
    veil.addEventListener("pointerdown", (event) => { if (play?.opening && !event.target.closest?.("#scene-skip")) { event.preventDefault(); end(true); } });
    // The scene owns the keyboard: Escape, Space or Enter skip it; nothing else reaches the game.
    window.addEventListener("keydown", (event) => {
      if (!play) return;
      if (event.key === "Tab") { event.preventDefault(); veil.querySelector("#scene-skip").focus({ preventScroll: true }); return; }
      event.stopPropagation();
      if (["Escape", " ", "Spacebar", "Enter"].includes(event.key)) { event.preventDefault(); if (!event.repeat) end(true); }
    }, true);
  };
}
