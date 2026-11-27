// H3a/H3d Hero mode on screen (HERO-COINS-PLAN.md, owner 2026-11-27). The rules are src/sim/content/hero-mode.js
// (driving, firing, dodgeable projectiles, battle time in the state) and src/sim/steward.js (the computer runs the
// base meanwhile); the aim rules are src/hero-aim.js; the drawn projectiles, landing rings and reticle are
// src/hero-mode-view.js. This file is the page side:
//   - the 44 px "Hero mode" button, shown only while you own a hero (a campaign hero or Skywing), one tap;
//   - entering: the hero is selected, Hero mode and the steward go on (one command each), battle time eases in
//     (0.3 s) and the RTS bars give way to the Hero mode HUD; leaving (the button, Esc, Tab, or 1 s after the hero
//     falls) sends the two commands back and restores the RTS view, every queue and order kept;
//   - ground heroes: a shoulder camera (or first person, Settings > Camera > Hero view); PC WASD, mouse aim, left
//     click fire, Q/E abilities, Space dodge; phones a left stick, drag on the right to aim, Fire, Ability, Dodge
//     and Exit buttons; aim assist snaps to the enemy nearest the aim line inside the cone;
//   - Skywing: a look-down camera behind and above it (52 degrees), a ground reticle, Sniper (tap or click to
//     shoot, wheel or pinch to zoom) and Rocket (hold 0.6 s on a target to lock, then it fires), the Sniper | Rocket
//     switch on the HUD, Dive strike as its ability, a barrel roll for a dodge;
//   - the close-up detail follows the aim point (20 m), with a soft distance fog; warning rings where rockets
//     and shells land, and marks at the screen edge for shots from off screen; no camera shake anywhere.
import "./hero-mode.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { isAllyHero } from "./sim/content/campaign-heroes.js";
import { isSkywing, WEAPONS } from "./sim/content/skywing.js";
import { HERO_TIME, enterCommands, leaveCommands } from "./sim/content/hero-mode.js";
import { pickTarget, RocketLock, moveVector, battleTime, AIM } from "./hero-aim.js";
import { translate, getLanguage } from "./i18n.js";
import { PHONE_NAME } from "./tactics-card.js";
// The ground shoulder camera per screen: metres behind (back), above the ground (up) and to the side of the hero, the
// look point `ahead` m in front at `lookY` m. Look-down: PC about 13 degrees, landscape phone 19, portrait phone 30
// (its 84-degree tall view otherwise shows mostly sky); the hero stands a little under the middle of the screen.
export const SHOULDER = Object.freeze({
  pc: { back: 6.2, up: 4.0, side: 1.2, ahead: 7, lookY: 0.9, fov: 56 },
  landscape: { back: 7, up: 5.4, side: 0.6, ahead: 6, lookY: 0.8, fov: 62 },
  portrait: { back: 7.5, up: 7.2, side: 0.4, ahead: 4, lookY: 0.5, fov: 62 },
});

export const HERO_CLOSE_RADIUS = 20;
const SKY_PITCH = 52; // degrees down (45-60)
const FALL_HOLD = 1; // real seconds on screen after the hero falls, then back to the RTS view
const TAP_MS = 280, TAP_PX = 12;

export function setupHeroMode(S, A) {
  const Z = S.screen;
  const H = {
    on: false, id: null, sky: false, sim: null, yaw: 0, pitch: 0, zoom: 1,
    scale: 1, ease: null, aim: null, target: null, firing: false, sent: { drive: "0,0", fire: "null" },
    lock: new RocketLock(), keys: new Set(), stick: null, look: null, fell: null, pointer: null, pinch: null, touches: new Map(),
    cursor: null, button: null, hud: null, edges: [], turn: 0,
  };
  S.hero = H;

  const heroes = () => (S.sim && Z.started && !S.sim.result ? S.sim.own(0).filter((e) => e.kind === "unit" && e.hp > 0 && (isSkywing(e) || isAllyHero(e))) : []);
  const phone = () => !!S.touchInput;
  const firstPerson = () => S.settings.heroView === "first";
  const hero = () => (H.id === null ? null : S.sim.get(H.id));
  const send = (c) => S.sim.command({ team: 0, ...c });

  // ---------------------------------------------------------------- the Hero mode button
  function button() {
    if (H.button?.isConnected) return H.button;
    const b = document.createElement("button");
    b.type = "button";
    b.id = "hero-mode-btn";
    b.hidden = true;
    // The full label on a PC; phones show the short one in a tile of the touch tool row (place()).
    b.innerHTML = `${icon("star")}<span class="hm-full">Hero mode</span><span class="hm-short" translate="no" data-no-localize></span>`;
    b.addEventListener("click", () => enter());
    document.body.append(b);
    return (H.button = b);
  }
  function syncButton() {
    const list = H.on ? [] : heroes();
    const show = list.length > 0 && !Z.paused && !Z.modalType && !S.replay;
    if (!show && !H.button) return;
    const b = button();
    const appeared = b.hidden && show;
    if (b.hidden === show) b.hidden = !show;
    if (show) {
      place(b, appeared);
      const name = pickHero(list)?.name || "";
      const label = `Hero mode: fight as ${name}`;
      if (b.dataset.label !== label) { b.dataset.label = label; b.title = label; b.setAttribute("aria-label", translate(label)); }
      const short = getLanguage() === "en" ? "Hero" : translate("Hero (Hero mode button)");
      const tag = b.querySelector(".hm-short");
      if (tag.textContent !== short) tag.textContent = short;
    }
  }
  // Phones (re-score 2026-11-28: the old chip above the dock covered the caption strip and the Map tab): the button
  // is one more tile of the touch tool row (Army, Workers, Box, Queue, Clear, Info), the same size, in the next slot:
  // under Info in the portrait column, right of Info in the landscape row (either hand). Measured twice a second;
  // with no tool row on screen it falls back to the spot just above the dock (or the Defence bar).
  let placedAt = -1;
  function place(b, force = false) {
    const now = performance.now();
    if (!force && now - placedAt < 500) return;
    placedAt = now;
    const root = document.documentElement;
    const clear = () => { b.classList.remove("hero-tile"); for (const k of ["left", "top", "width", "height"]) b.style.removeProperty(k); };
    if (!root.classList.contains("compact-ui")) { clear(); b.style.removeProperty("--hero-btn-bottom"); return; }
    const info = document.querySelector(".touch-controls #touch-guide"), prev = document.querySelector(".touch-controls #clear-selection");
    const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    if (shown(info) && shown(prev)) {
      const r = info.getBoundingClientRect(), q = prev.getBoundingClientRect();
      const row = Math.abs(r.top - q.top) < r.height / 2;
      // The gap the row already uses between its tiles (at least 6 px).
      const gap = Math.max(6, row ? (r.left > q.left ? r.left - q.right : q.left - r.right) : r.top - q.bottom);
      let left = row ? (r.left >= q.left ? r.right + gap : r.left - gap - r.width) : r.left;
      let top = row ? r.top : r.bottom + gap;
      // A landscape row with no room before the clock and pause cluster: the slot under Info instead.
      if (row) {
        const end = { left, right: left + r.width, top, bottom: top + r.height };
        const hit = [...document.querySelectorAll(".topbar .top-actions, .topbar .resource-bar")].some((el) => {
          const o = el.getBoundingClientRect();
          return o.width > 0 && o.left < end.right + 2 && o.right > end.left - 2 && o.top < end.bottom && o.bottom > end.top;
        });
        if (hit || end.left < 0 || end.right > innerWidth) { left = r.left; top = r.bottom + gap; }
      }
      b.classList.add("hero-tile");
      b.style.left = `${Math.round(left)}px`; b.style.top = `${Math.round(top)}px`;
      b.style.width = `${Math.round(r.width)}px`; b.style.height = `${Math.max(44, Math.round(r.height))}px`;
      return;
    }
    clear();
    if (innerWidth > innerHeight) { b.style.removeProperty("--hero-btn-bottom"); return; }
    let top = innerHeight;
    for (const el of document.querySelectorAll(".bottom-dock, #defence-bar, #defence-intel")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.top > innerHeight * 0.35 && getComputedStyle(el).visibility !== "hidden") top = Math.min(top, r.top);
    }
    b.style.setProperty("--hero-btn-bottom", `${Math.round(innerHeight - top + 8)}px`);
  }
  function pickHero(list = heroes()) {
    return list.find((e) => S.selected.has(e.id)) || list.find(isSkywing) || list[0] || null;
  }

  // ---------------------------------------------------------------- the HUD
  function hud() {
    if (H.hud) return H.hud;
    const root = document.createElement("div");
    root.id = "hero-hud";
    root.hidden = true;
    root.innerHTML = `
      <div class="hh-top">
        <div class="hh-plate"><span class="hh-star" aria-hidden="true">★</span><b class="hh-name" translate="no"></b><em class="hh-assist" hidden>ASSIST</em><i class="hh-hp" aria-hidden="true"><i></i></i></div>
        <div class="hh-time" role="status"><span>Battle time</span> <b translate="no"></b></div>
        <div class="hh-sys"><button type="button" data-hero="pause" aria-label="Pause">${icon("pause")}<span>Pause</span></button><button type="button" data-hero="exit" class="hh-exit">${icon("close")}<span>Exit</span><kbd translate="no">Tab</kbd></button></div>
      </div>
      <div class="hh-weapons" role="group" aria-label="Weapon" hidden>${Object.values(WEAPONS).map((w) => `<button type="button" data-weapon="${w.id}" aria-pressed="false">${icon(w.id === "sniper" ? "sniper" : "lockon")}<span>${w.name}</span></button>`).join("")}<kbd translate="no">E</kbd></div>
      <div class="hh-actions">
        <button type="button" data-hero="ability" class="hh-ability"><i class="hh-sweep" aria-hidden="true"></i><span class="hh-ability-name"></span><kbd translate="no">Q</kbd></button>
        <button type="button" data-hero="dodge" class="hh-dodge"><i class="hh-sweep" aria-hidden="true"></i><span class="hh-dodge-name">Dodge</span><kbd translate="no">Space</kbd></button>
        <button type="button" data-hero="fire" class="hh-fire"><span>Fire</span><kbd translate="no">F</kbd></button>
      </div>
      <div class="hh-stick" aria-hidden="true"><i class="hh-knob"></i></div>
      <div class="hh-cross" aria-hidden="true"><i class="hh-lockring"></i></div>
      <div class="hh-edges" aria-hidden="true"></div>
      <div class="hh-down" role="status" hidden><span>Hero down</span></div>
      <p class="hh-help"><span>WASD move · Mouse aim · Click/F fire · Q ability · Space dodge · Tab exit</span></p>`;
    document.body.append(root);
    for (let i = 0; i < 6; i++) { const m = document.createElement("i"); m.className = "hh-edge"; m.hidden = true; root.querySelector(".hh-edges").append(m); H.edges.push(m); }
    root.addEventListener("click", (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      if (b.dataset.weapon) { weapon(b.dataset.weapon); return; }
      const what = b.dataset.hero;
      if (what === "exit") leave();
      else if (what === "pause") A.togglePause?.();
      else if (what === "ability") ability();
      else if (what === "dodge") dodge();
    });
    // Fire is held (a ground hero keeps firing; a rocket locks while held); its own pointer events.
    const fire = root.querySelector(".hh-fire");
    fire.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); try { fire.setPointerCapture(event.pointerId); } catch { /* a pointer the browser no longer tracks */ } trigger(true, "button"); });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) fire.addEventListener(type, () => trigger(false, "button"));
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    root.addEventListener("wheel", (event) => { if (!H.on) return; event.preventDefault(); zoomBy(event.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    root.addEventListener("contextmenu", (event) => event.preventDefault());
    return (H.hud = root);
  }
  const playArea = (event) => !event.target.closest("button, .hh-top, .hh-actions, .hh-weapons");

  // ---------------------------------------------------------------- entering and leaving
  function enter(id = pickHero()?.id) {
    if (H.on || id == null || !Z.started || Z.paused || S.sim.result) return false;
    const e = S.sim.get(id);
    if (!e) return false;
    const scale = S.sim.lan || S.lan ? 1 : HERO_TIME.scales.includes(S.settings.battleTime) ? S.settings.battleTime : HERO_TIME.scale;
    const [mode, steward] = enterCommands(0, id, scale);
    if (!S.sim.command(mode)) { A.notice?.("Hero mode is not available now."); return false; }
    S.sim.command(steward);
    Object.assign(H, { on: true, id, sky: isSkywing(e), sim: S.sim, yaw: Number.isFinite(e.angle) ? e.angle : 0, pitch: 0, zoom: 1, fell: null, firing: false, target: null, aim: null });
    H.sent = { drive: "0,0", fire: "null" };
    H.lock.reset();
    H.keys.clear();
    S.keys?.clear();
    S.cameraPan = null;
    A.clearMode?.();
    A.setSelection?.([id]);
    A.setMatchSpeed?.(1);
    H.ease = { from: H.scale, to: scale, t: 0 };
    document.documentElement.classList.add("hero-mode");
    document.documentElement.classList.toggle("hero-sky", H.sky);
    document.documentElement.classList.toggle("hero-phone", phone());
    const root = hud();
    root.hidden = false;
    root.querySelector(".hh-weapons").hidden = !H.sky;
    root.querySelector(".hh-assist").hidden = !H.sky;
    root.querySelector(".hh-name").textContent = translate(e.name);
    root.querySelector(".hh-dodge-name").textContent = H.sky ? "Barrel roll" : "Dodge";
    root.querySelector(".hh-help span").textContent = H.sky
      ? "WASD fly · Mouse aim · Click/F shoot · Hold to lock rockets · Wheel zoom · Q Dive · E weapon · Space roll · Tab exit"
      : "WASD move · Mouse aim · Click/F fire · Q ability · Space dodge · Tab exit";
    H.button && (H.button.hidden = true);
    const v = S.view;
    v.resize();
    v.setHeroCamera(H.sky ? { fogNear: 46, fogFar: 132, far: 160 } : { fogNear: 26, fogFar: 92, far: 120 });
    v.heroRig = rig;
    v.setCloseView({ x: e.x, z: e.z, radius: HERO_CLOSE_RADIUS });
    A.tone?.(660, 0.12);
    A.updateUI?.();
    return true;
  }
  function leave(quiet = false) {
    if (!H.on) return false;
    const e = hero();
    if (H.sim === S.sim && !S.sim.result) for (const c of leaveCommands(0)) S.sim.command(c);
    H.on = false;
    H.ease = { from: H.scale, to: 1, t: 0 };
    H.keys.clear();
    H.firing = false;
    H.lock.reset();
    H.stick = null; H.look = null; H.pinch = null; H.touches.clear();
    document.documentElement.classList.remove("hero-mode", "hero-sky", "hero-phone");
    if (H.hud) H.hud.hidden = true;
    const v = S.view;
    v.heroRig = null;
    v.plugins?.list.find((p) => p.setReticle)?.setReticle(null);
    v.setHeroCamera(null);
    v.setCloseView(null);
    v.resize();
    if (e && H.sim === S.sim) v.focusOn(e.x, e.z);
    H.id = null;
    if (!quiet) A.tone?.(440, 0.1);
    A.updateUI?.();
    return true;
  }

  // ---------------------------------------------------------------- actions
  function ability() {
    const e = hero();
    if (!e?.ability) return;
    const at = H.aim;
    if (!send({ type: "ability", ids: [e.id], ...(at ? { x: at.x, z: at.z } : null) })) A.notice?.(`${e.ability.name} is recharging.`);
    else A.tone?.(700, 0.1);
  }
  function weapon(id) {
    const e = hero();
    if (!isSkywing(e)) return;
    const next = id || ((e.weaponTo || e.weapon) === "sniper" ? "rocket" : "sniper");
    if (send({ type: "heroWeapon", id: e.id, weapon: next })) { A.tone?.(next === "rocket" ? 380 : 720, 0.08); H.lock.reset(); }
  }
  function dodge() {
    const e = hero();
    if (!e) return;
    const d = e.drive || null;
    if (send({ type: "heroDodge", ...(d ? { dx: d.x, dz: d.z } : null) })) A.tone?.(520, 0.06);
  }
  // The trigger (mouse button, a tap, or the Fire button): `on` true while held.
  function trigger(on, from = "mouse") {
    if (!H.on) return;
    const e = hero();
    if (!e) return;
    if (on) {
      H.firing = from;
      H.lock.reset();
      // Skywing's sniper: one shot per press, at the target under the reticle.
      if (H.sky && e.weapon === "sniper") { shoot(false); H.firing = false; }
    } else if (H.firing === from || !from) {
      H.firing = false;
      H.lock.reset();
    }
  }
  function shoot(hold) {
    const t = H.target;
    if (!t) { if (!hold) A.tone?.(260, 0.05); return false; }
    // A held trigger is sent once per target; a single shot always goes (and leaves the held state alone).
    if (!hold) return send({ type: "heroFire", target: t.id, hold: false });
    const key = `${t.id}`;
    if (H.sent.fire === key) return true;
    H.sent.fire = key;
    return send({ type: "heroFire", target: t.id, hold: true });
  }
  function ceaseFire() {
    if (H.sent.fire === "null") return;
    H.sent.fire = "null";
    send({ type: "heroFire", target: null });
  }
  function zoomBy(k) {
    H.zoom = Math.max(0.6, Math.min(1.7, H.zoom * k));
  }

  // ---------------------------------------------------------------- pointer input over the HUD
  function down(event) {
    if (!H.on || !playArea(event)) return;
    event.preventDefault();
    const touch = event.pointerType === "touch";
    H.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (H.touches.size === 2 && touch) {
      const [a, b] = [...H.touches.values()];
      H.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: H.zoom };
      if (H.look) H.look = null;
      return;
    }
    if (touch) {
      const left = event.clientX < innerWidth * 0.45;
      if (left && !H.stick) {
        H.stick = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
        const s = H.hud.querySelector(".hh-stick");
        s.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        s.classList.add("live");
      } else if (!H.look) {
        H.look = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), moved: 0, aim: { x: event.clientX, y: event.clientY } };
        // Skywing: a press on the battlefield aims there (a tap shoots, a hold locks rockets).
        if (H.sky) { H.cursor = { x: event.clientX, y: event.clientY, at: performance.now() }; if (hero()?.weapon === "rocket") trigger(true, "touch"); }
      }
      return;
    }
    try { H.hud.setPointerCapture(event.pointerId); } catch { /* a pointer the browser no longer tracks */ }
    if (event.button === 2) { H.look = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), moved: 0, mouse: true }; return; }
    if (event.button === 0) trigger(true, "mouse");
  }
  function move(event) {
    if (!H.on) return;
    if (H.touches.has(event.pointerId)) H.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (H.pinch && H.touches.size >= 2) {
      const [a, b] = [...H.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 10) H.zoom = Math.max(0.6, Math.min(1.7, H.pinch.zoom * (H.pinch.d / d)));
      return;
    }
    if (event.pointerType !== "touch") H.cursor = { x: event.clientX, y: event.clientY, at: performance.now() };
    if (H.stick && event.pointerId === H.stick.id) {
      const dx = event.clientX - H.stick.x, dy = event.clientY - H.stick.y, n = Math.hypot(dx, dy), max = 56, k = n > max ? max / n : 1;
      H.stick.dx = (dx * k) / max; H.stick.dy = (dy * k) / max;
      H.hud.querySelector(".hh-knob").style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      return;
    }
    if (H.look && event.pointerId === H.look.id) {
      const dx = event.clientX - H.look.x, dy = event.clientY - H.look.y;
      H.look.moved += Math.abs(dx) + Math.abs(dy);
      H.look.x = event.clientX; H.look.y = event.clientY;
      // Dragging turns the camera (and tilts the shoulder view a little); a Skywing press that drags stops aiming.
      if (H.look.moved > TAP_PX) {
        H.yaw -= dx * (H.look.mouse ? 0.005 : 0.008);
        H.pitch = Math.max(-0.6, Math.min(0.8, H.pitch - dy * 0.004));
        if (H.sky && H.firing === "touch" && H.look.moved > TAP_PX * 3) trigger(false, "touch");
      }
    }
  }
  function up(event) {
    if (!H.on) return;
    H.touches.delete(event.pointerId);
    if (H.touches.size < 2) H.pinch = null;
    if (H.stick && event.pointerId === H.stick.id) {
      H.stick = null;
      const s = H.hud.querySelector(".hh-stick");
      s.classList.remove("live");
      s.style.transform = "";
      H.hud.querySelector(".hh-knob").style.transform = "";
      return;
    }
    if (H.look && event.pointerId === H.look.id) {
      const tap = H.look.moved <= TAP_PX && performance.now() - H.look.t < TAP_MS + (H.sky ? 200 : 0);
      const wasTouch = !H.look.mouse;
      H.look = null;
      if (wasTouch && tap) {
        // A tap: Skywing shoots where it was tapped (sniper); a ground hero fires one burst at the reticle.
        if (H.sky) { if (hero()?.weapon === "sniper") { aimNow(); shoot(false); } }
        else { aimNow(); shoot(false); }
      }
      if (H.firing === "touch") trigger(false, "touch");
      return;
    }
    if (event.pointerType !== "touch" && event.button === 0) trigger(false, "mouse");
  }

  // ---------------------------------------------------------------- keyboard (capture: before the RTS keys)
  const KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
  function keydown(event) {
    if (!H.on || Z.modalType || A.settingsUI?.active || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest("input,textarea,select")) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
    const code = event.code;
    const k = code === "KeyW" ? "w" : code === "KeyA" ? "a" : code === "KeyS" ? "s" : code === "KeyD" ? "d" : key;
    if (KEYS.has(k)) { H.keys.add(k); stop(event); return; }
    if (Z.paused) return;
    if (k === "escape" || k === "tab") { stop(event); if (!event.repeat) leave(); return; }
    if (k === " " || code === "Space") { stop(event); if (!event.repeat) dodge(); return; }
    // F fires like the mouse button and aims the same way (the target under the reticle): held for a ground hero
    // and Skywing's rocket lock, one shot per press for Skywing's sniper.
    if (code === "KeyF" || k === "f") { stop(event); if (!event.repeat) { aimNow(); trigger(true, "key"); } return; }
    if (code === "KeyQ" || k === "q") { stop(event); if (!event.repeat) ability(); return; }
    if (code === "KeyE" || k === "e") { stop(event); if (!event.repeat) { if (H.sky) weapon(); else ability(); } return; }
  }
  function keyup(event) {
    const code = event.code, key = event.key.toLowerCase();
    if (code === "KeyF" || key === "f") { if (H.on) { trigger(false, "key"); stop(event); } return; }
    const k = code === "KeyW" ? "w" : code === "KeyA" ? "a" : code === "KeyS" ? "s" : code === "KeyD" ? "d" : key;
    H.keys.delete(k);
  }
  const stop = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };

  // ---------------------------------------------------------------- the camera rig (inside view.update)
  function rig(sim) {
    const v = S.view, e = hero(), o = e ? v.objects.get(e.id) : null;
    if (!o) return;
    const p = o.position, f = { x: Math.sin(H.yaw), z: Math.cos(H.yaw) }, r = { x: -Math.cos(H.yaw), z: Math.sin(H.yaw) };
    const groundY = v.terrain.heightAt(p.x, p.z);
    let eye, look, fov = 58;
    if (H.sky) {
      const a = (SKY_PITCH * Math.PI) / 180, dist = (phone() ? 21 : 18) * H.zoom;
      look = { x: p.x + f.x * 7, y: groundY, z: p.z + f.z * 7 };
      eye = { x: look.x - f.x * dist * Math.cos(a), y: look.y + dist * Math.sin(a) + Math.max(0, p.y - groundY) * 0.4, z: look.z - f.z * dist * Math.cos(a) };
      fov = 54 / Math.sqrt(H.zoom) * (H.zoom < 0.85 ? 0.92 : 1);
    } else if (firstPerson()) {
      eye = { x: p.x + f.x * 0.55, y: groundY + 1.65, z: p.z + f.z * 0.55 };
      look = { x: p.x + f.x * 20, y: groundY + 1.1 + H.pitch * 8, z: p.z + f.z * 20 };
      fov = 66;
    } else {
      // Re-score 2026-11-28: the old 8-10 degree look-down left about 45% sky on a portrait phone with the hero low;
      // each screen now looks down far enough that the horizon sits in the top fifth to third (SHOULDER).
      const c = SHOULDER[!phone() ? "pc" : v.height > v.width ? "portrait" : "landscape"];
      eye = { x: p.x - f.x * c.back + r.x * c.side, y: groundY + c.up + H.pitch * 2, z: p.z - f.z * c.back + r.z * c.side };
      look = { x: p.x + f.x * c.ahead + r.x * c.side * 0.4, y: groundY + c.lookY - H.pitch * 1.5, z: p.z + f.z * c.ahead + r.z * c.side * 0.4 };
      fov = c.fov;
    }
    // Portrait screens keep at least a 52 degree wide view (a taller vertical angle, up to 84).
    const aspect = v.width / Math.max(1, v.height), minV = (2 * Math.atan(Math.tan((52 * Math.PI) / 360) / aspect) * 180) / Math.PI;
    v.placeHeroCamera(eye, look, Math.min(84, Math.max(fov, minV)));
    // The model faces the aim (a ground hero), so the shoulder view never looks at its back walking sideways.
    if (firstPerson() && !H.sky && o.userData.model) o.visible = false; else o.visible = sim.isVisible(e);
    // Its own health shows on the HUD: no bar or selection ring hanging in front of the camera.
    if (o.userData.bar) o.userData.bar.visible = false;
    if (o.userData.ring) o.userData.ring.visible = false;
    aimNow();
    const t = H.target, a = H.aim;
    const reticle = v.plugins?.list.find((q) => q.setReticle);
    if (a) reticle?.setReticle({ x: t ? t.x : a.x, z: t ? t.z : a.z, y: v.terrain.heightAt(t ? t.x : a.x, t ? t.z : a.z) + (t?.flying ? (t.fly || 3) : 0), size: t ? Math.max(0.9, (t.radius || 0.7) * 1.4) : H.sky ? 1.1 : 0.8, target: !!t, locked: H.lock.progress >= 1, progress: H.lock.progress });
    // Close-up detail around the aim point, not the camera.
    const cv = v.closeView;
    if (cv?.on && a) { cv.x = t ? t.x : a.x; cv.z = t ? t.z : a.z; }
    edges(sim, e);
  }
  // The aim point on the ground under the reticle (PC: the cursor; phones: the screen centre, or a Skywing tap),
  // and the target aim assist picks there.
  function aimNow() {
    const v = S.view, e = hero();
    if (!e || !v.heroCameraOn) return;
    const rect = v.renderer.domElement.getBoundingClientRect();
    let sx = rect.left + rect.width / 2, sy = rect.top + rect.height * (H.sky ? 0.5 : 0.47);
    const recent = H.cursor && (!phone() || performance.now() - H.cursor.at < 2500);
    if (recent && (!phone() || H.sky)) { sx = H.cursor.x; sy = H.cursor.y; }
    H.screen = { x: sx, y: sy };
    let p = v.point(sx, sy, rect);
    const f = { x: Math.sin(H.yaw), z: Math.cos(H.yaw) };
    if (!p || Math.hypot(p.x - e.x, p.z - e.z) > 60) p = { x: e.x + f.x * Math.max(6, e.range || 8), z: e.z + f.z * Math.max(6, e.range || 8) };
    H.aim = p;
    H.target = pickTarget(S.sim, e, p, { cone: phone() ? AIM.conePhone : AIM.cone, snap: H.sky ? AIM.snap : 2.5 });
  }
  // Marks at the screen edge for shots at the hero from off screen.
  function edges(sim, e) {
    const shots = sim.heroMode?.shots || [], v = S.view, w = v.width, h = v.height;
    let n = 0;
    for (const s of shots) {
      if (s.target !== e.id || n >= H.edges.length) continue;
      const from = v.objects.get(s.by)?.position, x = from ? from.x : s.sx, z = from ? from.z : s.sz;
      const q = v.project(x, z, v.terrain.heightAt(x, z) + 1);
      const behind = isBehind(v.camera, x, z);
      const inside = !behind && q.x > 0 && q.y > 0 && q.x < w && q.y < h;
      if (inside) continue;
      let dx = q.x - w / 2, dy = q.y - h / 2;
      if (behind) { dx = -dx; dy = Math.abs(dy) + h; }
      const k = Math.min((w / 2 - 28) / Math.max(1, Math.abs(dx)), (h / 2 - 28) / Math.max(1, Math.abs(dy)));
      const m = H.edges[n++];
      m.hidden = false;
      m.className = `hh-edge${s.heavy ? " heavy" : ""}`;
      m.style.transform = `translate(${Math.round(w / 2 + dx * k)}px, ${Math.round(h / 2 + dy * k)}px) rotate(${Math.atan2(dy, dx)}rad)`;
    }
    for (let i = n; i < H.edges.length; i++) if (!H.edges[i].hidden) H.edges[i].hidden = true;
  }

  // ---------------------------------------------------------------- every frame (app/frame.js, before the ticks)
  function tick(dt) {
    // The clock's ease in and out (real time).
    if (H.ease) {
      H.ease.t += dt;
      H.scale = battleTime(H.ease.from, H.ease.to, H.ease.t);
      if (H.ease.t >= HERO_TIME.ease) { H.scale = H.ease.to; H.ease = null; }
    }
    if (H.on && (H.sim !== S.sim || !Z.started)) { leave(true); H.scale = 1; H.ease = null; }
    if (H.on && S.sim.result) leave(true);
    // A story scene or a Commander decision takes the screen: back to the RTS view first.
    if (H.on && (A.sceneActive?.() || S.sim.mission?.pending)) leave(true);
    syncButton();
    if (!H.on) return;
    const e = hero();
    // The hero fell: "Hero down" for a second, then back to the RTS view.
    if (!e || e.hp <= 0) {
      if (H.fell === null) { H.fell = 0; H.hud.querySelector(".hh-down").hidden = false; ceaseFire(); }
      H.fell += dt;
      if (H.fell >= FALL_HOLD) { H.hud.querySelector(".hh-down").hidden = true; leave(); }
      return;
    }
    if (Z.paused || Z.modalType) return;
    // PC: the cursor near the left or right edge turns the camera.
    if (!phone() && H.cursor && !H.look) {
      const rect = S.view.renderer.domElement.getBoundingClientRect(), u = (H.cursor.x - rect.left) / rect.width;
      const edge = u < 0.1 ? -(0.1 - u) / 0.1 : u > 0.9 ? (u - 0.9) / 0.1 : 0;
      if (edge) H.yaw -= edge * 1.6 * dt;
    }
    // The move: keys or the stick, in camera space.
    let right = 0, forward = 0;
    if (H.stick) { right = H.stick.dx; forward = -H.stick.dy; }
    else {
      right = (H.keys.has("d") || H.keys.has("arrowright") ? 1 : 0) - (H.keys.has("a") || H.keys.has("arrowleft") ? 1 : 0);
      forward = (H.keys.has("w") || H.keys.has("arrowup") ? 1 : 0) - (H.keys.has("s") || H.keys.has("arrowdown") ? 1 : 0);
    }
    const d = moveVector(right, forward, { x: -Math.cos(H.yaw), z: Math.sin(H.yaw) }, { x: Math.sin(H.yaw), z: Math.cos(H.yaw) });
    const key = `${d.x},${d.z}`;
    if (key !== H.sent.drive) { H.sent.drive = key; send({ type: "heroDrive", dx: d.x, dz: d.z }); }
    // The weapon: held fire (a ground hero, or the Fire button), the rocket lock.
    if (H.firing) {
      if (H.sky && e.weapon === "rocket") {
        const locked = H.lock.update(H.target?.id ?? null, dt);
        if (locked !== null) { shoot(false); H.lock.reset(); A.tone?.(880, 0.08); }
      } else if (!H.sky) shoot(true);
    } else if (!H.sky || e.weapon !== "sniper") ceaseFire();
    paint(e);
  }
  // The HUD's live parts (health, cooldowns, the weapon, the lock ring, the crosshair), cheap and in place.
  // Shrinks a tile's label from its CSS size down to 11 px until it fits inside the tile (never smaller).
  function fitName(name, tile) {
    name.style.removeProperty("font-size");
    if (!phone()) return;
    requestAnimationFrame(() => {
      let px = parseFloat(getComputedStyle(name).fontSize) || 13;
      const over = () => tile.scrollHeight > tile.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1;
      while (over() && px > 11) { px -= 1; name.style.fontSize = `${px}px`; }
    });
  }
  function paint(e) {
    const root = H.hud;
    const hp = Math.max(0, (e.hp + (e.shield || 0)) / Math.max(1, e.maxHp + (e.maxShield || 0)));
    const bar = root.querySelector(".hh-hp > i");
    const w = `${Math.round(hp * 100)}%`;
    if (bar.style.width !== w) bar.style.width = w;
    const time = root.querySelector(".hh-time b"), label = `×${String(H.scale.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "")}`;
    if (time.textContent !== label) time.textContent = label;
    const ab = root.querySelector(".hh-ability");
    if (e.ability) {
      const left = Math.max(0, (e.abilityAt ?? 0) - S.sim.time), cd = e.ability.cooldown || 1;
      ab.hidden = false;
      const name = root.querySelector(".hh-ability-name");
      // Phones: the short word the command card uses (tactics-card.js PHONE_NAME, "Hold the line" -> "Line"), so
      // no translation wraps past two lines in the 76 x 54 tile (VI "Giữ vững trận tuyến" was four, re-score
      // 2026-11-28); the full name stays the tile's label for screen readers and on a PC.
      const shown = phone() ? PHONE_NAME[e.ability.name] || e.ability.name : e.ability.name;
      if (name.dataset.src !== shown) { name.dataset.src = shown; name.textContent = shown; ab.dataset.ability = e.ability.name; ab.setAttribute("aria-label", translate(e.ability.name)); fitName(name, ab); }
      ab.style.setProperty("--cd", (left / cd).toFixed(3));
      ab.disabled = left > 0;
    } else ab.hidden = true;
    const dg = root.querySelector(".hh-dodge"), wait = Math.max(0, (e.dodgeReady ?? -Infinity) - S.sim.time);
    dg.style.setProperty("--cd", (wait / (4 * (e.driven || 1))).toFixed(3));
    dg.disabled = wait > 0;
    if (H.sky) {
      const now = e.weaponTo || e.weapon;
      for (const b of root.querySelectorAll("[data-weapon]")) {
        const pressed = String(b.dataset.weapon === now);
        if (b.getAttribute("aria-pressed") !== pressed) b.setAttribute("aria-pressed", pressed);
        b.classList.toggle("switching", !!e.weaponTo && b.dataset.weapon === e.weaponTo);
      }
    }
    const cross = root.querySelector(".hh-cross");
    if (H.screen) cross.style.transform = `translate(${Math.round(H.screen.x)}px, ${Math.round(H.screen.y)}px)`;
    cross.classList.toggle("on-target", !!H.target);
    cross.style.setProperty("--lock", H.lock.progress.toFixed(2));
    cross.classList.toggle("locked", H.lock.progress >= 1);
  }

  // The clock's pace while Hero mode is on or easing (app/frame.js), else null.
  const pace = () => (H.on || H.ease ? H.scale : null);

  function isBehind(camera, x, z) {
    const m = camera.matrixWorld.elements;
    // The camera looks down its -z axis: a point behind has a positive dot with the +z axis.
    return (x - m[12]) * m[8] + (z - m[14]) * m[10] > 0;
  }

  Object.assign(A, { heroTick: tick, heroPace: pace, enterHeroMode: enter, leaveHeroMode: leave, heroModeOn: () => H.on, heroInfo: () => ({ on: H.on, id: H.id, sky: H.sky, yaw: H.yaw, zoom: H.zoom, scale: H.scale, aim: H.aim, target: H.target?.id ?? null, lock: H.lock.progress, screen: H.screen || null, sent: { ...H.sent } }) });
  return function bind() {
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", () => { H.keys.clear(); if (H.on) trigger(false, null); });
  };
}
