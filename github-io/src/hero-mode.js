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
//   - Skywing lands and takes off (owner 2026-11-28): one 44 px "Land" / "Take off" button (R) beside Ability, Dodge
//     and Fire; it glides down to a clear spot under the reticle (sim/content/skywing.js), the camera blends from the
//     look-down view to the shoulder view (no shake), it walks like a ground hero with the weapons it carries (a
//     steadier, longer Sniper), dodges with the ground dash, and Dive strike greys out with "Air only" until it flies;
//   - on foot (PART D): a "Scope" tag on the reticle once the sim's scope is up (sim/content/skywing.js SIGHT), a
//     wider fog than other ground heroes, and an air warning: enemy flyers within AIR_WARN m get edge marks and a sky
//     marker even outside sight (the hero HUD only: never the RTS view or the minimap), with a rate-limited notice;
//   - the close-up detail follows the aim point (20 m), with a soft distance fog; warning rings where rockets
//     and shells land, and marks at the screen edge for shots from off screen; no camera shake anywhere;
//   - H8 fight feel (rules: src/sim/hero-feel.js): the magazine as pips under the crosshair ("Reloading" while it
//     refills; PC X tops it up, phones reload on their own when empty), the crosshair's spread ring (wide on the move,
//     tight standing still), a headshot when the crosshair sits on a soldier's head (sent with heroFire), crouch
//     (PC C toggles it; phones crouch on their own standing still by cover) with a "Crouched" tag, a hit marker
//     (red for a headshot), damage numbers and a kill notice; an explosive barrel under the crosshair tints the
//     reticle orange and a shot sets it off (sim/hazards.js); a PC-only 0.6 degree kick on the hero's own shot
//     (never on phones, never with reduced motion).
import "./hero-mode.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { isAllyHero } from "./sim/content/campaign-heroes.js";
import { isSkywing, isLanded, WEAPONS, LAND } from "./sim/content/skywing.js";
import { flightOf } from "./skywing-view.js";
import { HERO_TIME, DODGE, enterCommands, leaveCommands } from "./sim/content/hero-mode.js";
import { pickTarget, RocketLock, moveVector, battleTime, AIM } from "./hero-aim.js";
import { translate, getLanguage } from "./i18n.js";
import { PHONE_NAME } from "./tactics-card.js";
import { DEFINITIONS as D } from "./data.js";
import { HEAD, magSize, hasMagazine, headable } from "./sim/hero-feel.js";
import { hazardAt, HAZARD } from "./sim/hazards.js";
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
// Skywing on foot (PART D): the air warning's reach (m), the gap between two warnings (real ms), the camera's fog.
export const AIR_WARN = Object.freeze({ range: 30, every: 12000 });
const SKY_FOG = Object.freeze({ air: { fogNear: 46, fogFar: 132, far: 160 }, ground: { fogNear: 36, fogFar: 110, far: 140 } });
// H7 Settings > Hero. Aim assist per choice: the cone (degrees) around the aim line and the snap (m) round the aim point.
export const AIM_ASSIST = Object.freeze({ off: { cone: 0, snap: 1.2 }, low: { cone: AIM.cone, snap: AIM.snap }, high: { cone: AIM.conePhone, snap: AIM.snap } });
// Dodge help's reflex slow-down: the clock at `scale` of the battle time for `seconds` (real) before a rocket or
// shell hits, `gap` seconds at least between two.
export const REFLEX = Object.freeze({ scale: 0.25, seconds: 0.4, gap: 1.2 });
// H8: the crosshair's spread ring (px, from still to on the move), the head zone round a soldier's head (px at least),
// the hit marker and damage numbers (ms on screen), and the PC shot kick (radians, recovering in `back` s).
export const FEEL_HUD = Object.freeze({ ring: [16, 46], head: 11, headPhone: 16, marker: 220, number: 700, feed: 2200, kick: 0.011, back: 0.14 });

export function setupHeroMode(S, A) {
  const Z = S.screen;
  const H = {
    on: false, id: null, sky: false, sim: null, yaw: 0, pitch: 0, zoom: 1,
    scale: 1, ease: null, aim: null, target: null, firing: false, sent: { drive: "0,0", fire: "null" },
    lock: new RocketLock(), keys: new Set(), stick: null, look: null, fell: null, pointer: null, pinch: null, touches: new Map(),
    cursor: null, button: null, hud: null, edges: [], skies: [], turn: 0, flight: 1, grounded: null, warned: 0, flyers: new Set(),
    reflex: { left: 0, wait: 0, seen: new Set(), count: 0 },
    // H8 fight feel (page side): the crosshair's hazard (index or -1) and head aim, PC crouch toggle, the shot kick.
    barrel: -1, head: false, crouch: false, kick: 0, hits: 0, kills: 0, heads: 0, blasts: 0, numbers: [], feedAt: 0,
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
        <div class="hh-plate"><span class="hh-star" aria-hidden="true">★</span><b class="hh-name" translate="no"></b><em class="hh-assist" hidden>ASSIST</em><em class="hh-crouch" hidden>Crouched</em><i class="hh-hp" aria-hidden="true"><i></i></i></div>
        <div class="hh-time" role="status"><span>Battle time</span> <b translate="no"></b></div>
        <div class="hh-sys"><button type="button" data-hero="pause" aria-label="Pause">${icon("pause")}<span>Pause</span></button><button type="button" data-hero="exit" class="hh-exit">${icon("close")}<span>Exit</span><kbd translate="no">Tab</kbd></button></div>
      </div>
      <div class="hh-weapons" role="group" aria-label="Weapon" hidden>${Object.values(WEAPONS).map((w) => `<button type="button" data-weapon="${w.id}" aria-pressed="false">${icon(w.id === "sniper" ? "sniper" : "lockon")}<span>${w.name}</span></button>`).join("")}<kbd translate="no">E</kbd></div>
      <div class="hh-actions">
        <button type="button" data-hero="ability" class="hh-ability"><i class="hh-sweep" aria-hidden="true"></i><span class="hh-ability-name"></span><small class="hh-why" hidden>Air only</small><kbd translate="no">Q</kbd></button>
        <button type="button" data-hero="dodge" class="hh-dodge"><i class="hh-sweep" aria-hidden="true"></i><span class="hh-dodge-name">Dodge</span><kbd translate="no">Space</kbd></button>
        <button type="button" data-hero="land" class="hh-land" hidden><i class="hh-sweep" aria-hidden="true"></i><span class="hh-land-name">Land</span><kbd translate="no">R</kbd></button>
        <button type="button" data-hero="fire" class="hh-fire"><span>Fire</span><kbd translate="no">F</kbd></button>
      </div>
      <div class="hh-stick" aria-hidden="true"><i class="hh-knob"></i></div>
      <div class="hh-cross" aria-hidden="true"><i class="hh-lockring"></i><i class="hh-spread"></i><i class="hh-hitmark"></i><b class="hh-scope" hidden>Scope</b><span class="hh-mag"><span class="hh-pips"></span><b class="hh-reload" hidden>Reloading</b></span></div>
      <div class="hh-dmgs" aria-hidden="true"></div>
      <div class="hh-feed" role="status"></div>
      <div class="hh-edges" aria-hidden="true"></div>
      <div class="hh-down" role="status" hidden><span>Hero down</span></div>
      <p class="hh-help"><span>WASD move · Mouse aim · Click/F fire · X reload · C crouch · Q ability · Space dodge · Tab exit</span></p>`;
    document.body.append(root);
    for (let i = 0; i < 6; i++) { const m = document.createElement("i"); m.className = "hh-edge"; m.hidden = true; root.querySelector(".hh-edges").append(m); H.edges.push(m); }
    // H8: damage numbers, pooled (no allocation in battle).
    for (let i = 0; i < 5; i++) { const b = document.createElement("b"); b.className = "hh-dmg"; b.hidden = true; root.querySelector(".hh-dmgs").append(b); H.numbers.push({ el: b, until: 0, id: null }); }
    // Sky markers for enemy flyers near a landed Skywing (PART D): pooled, no draw.
    for (let i = 0; i < 4; i++) { const m = document.createElement("i"); m.className = "hh-sky"; m.hidden = true; root.querySelector(".hh-edges").append(m); H.skies.push(m); }
    root.addEventListener("click", (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      if (b.dataset.weapon) { weapon(b.dataset.weapon); return; }
      const what = b.dataset.hero;
      if (what === "exit") leave();
      else if (what === "pause") A.togglePause?.();
      else if (what === "ability") ability();
      else if (what === "dodge") dodge();
      else if (what === "land") land();
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
    // H7 Settings > Hero > Dodge help: carried by the command, so the match (and its replay) keeps it.
    const [mode, steward] = enterCommands(0, id, scale, S.settings.dodgeHelp === true);
    if (!S.sim.command(mode)) { A.notice?.("Hero mode is not available now."); return false; }
    // H8: a Hero challenge has no base to run, so no steward (and no "AI running your base" strip).
    if (!S.sim.missionDef?.challenge) S.sim.command(steward);
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
    root.querySelector(".hh-land").hidden = !H.sky;
    H.flight = H.sky ? flightOf(S.sim, e) : 0;
    H.grounded = null;
    root.querySelector(".hh-help span").textContent = H.sky
      ? "WASD fly · Mouse aim · Click/F shoot · Hold to lock rockets · Wheel zoom · Q Dive · E weapon · Space roll · Tab exit"
      : "WASD move · Mouse aim · Click/F fire · X reload · C crouch · Q ability · Space dodge · Tab exit";
    // H8: phones crouch on their own standing still by cover; a PC toggles it with C (off at the start).
    H.crouch = false; H.barrel = -1; H.head = false; H.kick = 0;
    S.sim.command({ team: 0, type: "heroCrouch", on: phone() ? "auto" : false });
    if (H.sky) labels(e);
    H.button && (H.button.hidden = true);
    const v = S.view;
    v.resize();
    v.setHeroCamera(H.sky ? SKY_FOG[isLanded(e) ? "ground" : "air"] : { fogNear: 26, fogFar: 92, far: 120 });
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
  // Skywing lands under the reticle (or takes off): one command, the sim picks the clear spot nearest the aim.
  function land() {
    const e = hero();
    if (!isSkywing(e) || e.hp <= 0) return;
    const down = isLanded(e), at = H.aim;
    if (e.skyland) return;
    if (!down && (e.swoop || S.sim.time < (e.skyReady ?? -Infinity))) { A.notice?.(e.swoop ? "Skywing is diving." : "Skywing can land again in a moment."); return; }
    const ok = send({ type: "skywingLand", id: e.id, land: !down, ...(!down && at ? { x: at.x, z: at.z } : null) });
    if (ok) A.tone?.(down ? 620 : 420, 0.1);
    else if (!down) A.notice?.("No clear spot to land here.");
  }
  // Skywing's HUD words for its state: the dodge (a barrel roll in the air, the dash on foot) and the help line.
  function labels(e) {
    const ground = isLanded(e) || e.skyland?.phase === "land";
    if (H.grounded === ground) return;
    const first = H.grounded === null;
    H.grounded = ground;
    // On foot a little more of the field shows than for other ground heroes (the fog eases with the camera blend).
    if (!first && H.on) S.view.setHeroCamera(SKY_FOG[ground ? "ground" : "air"]);
    const root = H.hud;
    root.querySelector(".hh-dodge-name").textContent = ground ? "Dodge" : "Barrel roll";
    root.querySelector(".hh-help span").textContent = ground
      ? "WASD walk · Mouse aim · Click/F shoot · Hold to lock rockets · E weapon · X reload · C crouch · R take off · Space dodge · Tab exit"
      : "WASD fly · Mouse aim · Click/F shoot · Hold to lock rockets · Wheel zoom · Q Dive · E weapon · R land · Space roll · Tab exit";
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
    // H8: an explosive barrel under the crosshair (the reticle tints orange) takes the shot: one at a time.
    if (H.barrel >= 0) {
      const key = `b${H.barrel}`;
      if (hold && H.sent.fire === key) return true;
      H.sent.fire = hold ? key : H.sent.fire;
      return send({ type: "heroFire", barrel: H.barrel });
    }
    if (!t) { if (!hold) A.tone?.(260, 0.05); return false; }
    // A held trigger is sent once per target (and again when the aim moves on or off its head); a single shot always
    // goes (and leaves the held state alone).
    const head = H.head ? { head: true } : null;
    if (!hold) return send({ type: "heroFire", target: t.id, hold: false, ...head });
    const key = `${t.id}${H.head ? "h" : ""}`;
    if (H.sent.fire === key) return true;
    H.sent.fire = key;
    return send({ type: "heroFire", target: t.id, hold: true, ...head });
  }
  // H8: top the magazine up (PC X; phones reload on their own when it runs dry).
  function reload() {
    const e = hero();
    if (!e || !hasMagazine(e)) return;
    if (send({ type: "heroReload" })) A.tone?.(340, 0.06);
  }
  // H8: crouch on or off (PC C). Crouched only standing still beside cover; moving stands up.
  function crouch() {
    if (phone()) return;
    H.crouch = !H.crouch;
    if (send({ type: "heroCrouch", on: H.crouch })) { A.tone?.(H.crouch ? 300 : 420, 0.05); A.notice?.(H.crouch ? "Crouch on: stand still by cover to take half damage." : "Crouch off."); }
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
    if (code === "KeyR" || k === "r") { stop(event); if (!event.repeat && H.sky) land(); return; }
    // H8: X reloads (R lands, F fires), C crouches (on a PC; RTS Stop and Context are not used in Hero mode).
    if (code === "KeyX" || k === "x") { stop(event); if (!event.repeat) reload(); return; }
    if (code === "KeyC" || k === "c") { stop(event); if (!event.repeat) crouch(); return; }
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
    // H8: the PC shot kick (a small look-up that settles in FEEL_HUD.back s; never on phones or with reduced motion).
    const kick = H.kick > 0 ? H.kick : 0;
    const shoulder = () => {
      // Re-score 2026-11-28: the old 8-10 degree look-down left about 45% sky on a portrait phone with the hero low;
      // each screen now looks down far enough that the horizon sits in the top fifth to third (SHOULDER).
      const c = SHOULDER[!phone() ? "pc" : v.height > v.width ? "portrait" : "landscape"];
      return {
        eye: { x: p.x - f.x * c.back + r.x * c.side, y: groundY + c.up + H.pitch * 2, z: p.z - f.z * c.back + r.z * c.side },
        look: { x: p.x + f.x * c.ahead + r.x * c.side * 0.4, y: groundY + c.lookY - H.pitch * 1.5, z: p.z + f.z * c.ahead + r.z * c.side * 0.4 },
        fov: c.fov,
      };
    };
    if (H.sky) {
      const a = (SKY_PITCH * Math.PI) / 180, dist = (phone() ? 21 : 18) * H.zoom;
      look = { x: p.x + f.x * 7, y: groundY, z: p.z + f.z * 7 };
      eye = { x: look.x - f.x * dist * Math.cos(a), y: look.y + dist * Math.sin(a) + Math.max(0, p.y - groundY) * 0.4, z: look.z - f.z * dist * Math.cos(a) };
      fov = 54 / Math.sqrt(H.zoom) * (H.zoom < 0.85 ? 0.92 : 1);
      // Landing and taking off: an eased blend toward the shoulder view on foot (H.flight, eased in tick()).
      const k = H.flight;
      if (k < 0.999) {
        const g = shoulder(), mix = (a, b) => ({ x: b.x + (a.x - b.x) * k, y: b.y + (a.y - b.y) * k, z: b.z + (a.z - b.z) * k });
        eye = mix(eye, g.eye); look = mix(look, g.look); fov = g.fov + (fov - g.fov) * k;
      }
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
    if (kick) look = { ...look, y: look.y + kick * Math.hypot(look.x - eye.x, look.z - eye.z) };
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
    const hz = H.barrel >= 0 ? sim.hazards?.[H.barrel] : null;
    if (hz) reticle?.setReticle({ x: hz[0], z: hz[1], y: v.terrain.heightAt(hz[0], hz[1]), size: 1, target: true, hazard: true, locked: false, progress: 0 });
    else if (a) reticle?.setReticle({ x: t ? t.x : a.x, z: t ? t.z : a.z, y: v.terrain.heightAt(t ? t.x : a.x, t ? t.z : a.z) + (t?.flying ? (t.fly || 3) : 0), size: t ? Math.max(0.9, (t.radius || 0.7) * 1.4) : H.sky ? 1.1 : 0.8, target: !!t, locked: H.lock.progress >= 1, progress: H.lock.progress });
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
    // H7 Settings > Hero > Aim assist: Off (only a target right under the reticle), Low (the PC cone), High (the
    // phone cone). The pick is the page's: the heroFire command carries the target, so replays stay exact.
    const assist = AIM_ASSIST[S.settings.aimAssist] || (phone() ? AIM_ASSIST.high : AIM_ASSIST.low);
    H.target = pickTarget(S.sim, e, p, { cone: assist.cone, snap: Math.min(assist.snap, H.sky ? AIM.snap : 2.5) });
    // H8: an intact explosive barrel nearer the aim point than the target (and in reach) takes the crosshair.
    const sim = S.sim, i = sim.hazards?.length ? hazardAt(sim.hazards, p.x, p.z, HAZARD.aim) : -1;
    const hz = i >= 0 ? sim.hazards[i] : null, t = H.target;
    H.barrel = hz && Math.hypot(hz[0] - e.x, hz[1] - e.z) <= (e.range || 10) + 16 && (!t || Math.hypot(hz[0] - p.x, hz[1] - p.z) < Math.hypot(t.x - p.x, t.z - p.z) - 0.2) ? i : -1;
    // A headshot: the crosshair within the head zone of a soldier target (its head projected on screen).
    H.head = false;
    if (t && H.barrel < 0 && hasMagazine(e) && headable(t)) {
      const q = v.project(t.x, t.z, v.terrain.heightAt(t.x, t.z) + HEAD.height * (v.objects.get(t.id)?.userData.readabilityScale || 1));
      const zone = Math.max(phone() ? FEEL_HUD.headPhone : FEEL_HUD.head, 0);
      H.head = Math.hypot(q.x + rect.left - sx, q.y + rect.top - sy) <= zone;
    }
  }
  // Marks at the screen edge for shots at the hero from off screen.
  function edges(sim, e) {
    // H7 Settings > Hero > Shot warnings Off: no marks for incoming shots (the air warning stays).
    const shots = S.settings.shotWarnings === false ? [] : sim.heroMode?.shots || [], v = S.view, w = v.width, h = v.height;
    let n = 0;
    for (const s of shots) {
      if (s.target !== e.id || s.blocked || n >= H.edges.length) continue;
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
    // PART D: a landed Skywing is warned of enemy flyers within AIR_WARN.range m, seen or not (flyers only).
    let k = 0;
    const flyers = isSkywing(e) && isLanded(e) ? sim.entities.filter((t) => t.flying && t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && Math.hypot(t.x - e.x, t.z - e.z) <= AIR_WARN.range) : [];
    for (const t of flyers) {
      const y = v.terrain.heightAt(t.x, t.z) + (t.fly || 3.5), q = v.project(t.x, t.z, y), behind = isBehind(v.camera, t.x, t.z);
      const inside = !behind && q.x > 0 && q.y > 0 && q.x < w && q.y < h;
      if (inside) {
        if (k >= H.skies.length) continue;
        const m = H.skies[k++];
        m.hidden = false;
        m.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
        continue;
      }
      if (n >= H.edges.length) continue;
      let dx = q.x - w / 2, dy = q.y - h / 2;
      if (behind) { dx = -dx; dy = Math.abs(dy) + h; }
      const f = Math.min((w / 2 - 28) / Math.max(1, Math.abs(dx)), (h / 2 - 28) / Math.max(1, Math.abs(dy)));
      const m = H.edges[n++];
      m.hidden = false;
      m.className = "hh-edge air";
      m.style.transform = `translate(${Math.round(w / 2 + dx * f)}px, ${Math.round(h / 2 + dy * f)}px) rotate(${Math.atan2(dy, dx)}rad)`;
    }
    for (let i = n; i < H.edges.length; i++) if (!H.edges[i].hidden) H.edges[i].hidden = true;
    for (let i = k; i < H.skies.length; i++) if (!H.skies[i].hidden) H.skies[i].hidden = true;
    // A new flyer in reach: one notice and a tone, at most every AIR_WARN.every ms.
    const now = performance.now(), fresh = flyers.some((t) => !H.flyers.has(t.id));
    H.flyers.clear();
    for (const t of flyers) H.flyers.add(t.id);
    if (fresh && now - H.warned >= AIR_WARN.every) {
      H.warned = now;
      A.notice?.(flyers.some((t) => t.type === "hawk") ? "Hawks inbound!" : "Enemy flyers inbound!");
      A.tone?.(300, 0.14);
    }
    H.airWarn = flyers.length;
  }

  // ---------------------------------------------------------------- every frame (app/frame.js, before the ticks)
  function tick(dt) {
    // The clock's ease in and out (real time).
    if (H.kick > 0) H.kick = Math.max(0, H.kick - (FEEL_HUD.kick / FEEL_HUD.back) * dt);
    if (H.ease) {
      H.ease.t += dt;
      H.scale = battleTime(H.ease.from, H.ease.to, H.ease.t);
      if (H.ease.t >= HERO_TIME.ease) { H.scale = H.ease.to; H.ease = null; }
    }
    if (H.on && (H.sim !== S.sim || !Z.started)) { leave(true); H.scale = 1; H.ease = null; }
    reflexTick(dt);
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
    if (H.sky) {
      // The camera's flight blend: the sim's glide or climb, eased again in real time (smooth, never a jump).
      const want = flightOf(S.sim, e);
      H.flight = Math.abs(want - H.flight) < 0.002 ? want : H.flight + (want - H.flight) * Math.min(1, dt * 5);
      labels(e);
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
      // Skywing's Dive strike works only in the air: greyed with its reason while it is down (or on the way).
      const grounded = H.sky && (!e.flying || !!e.skyland);
      const why = root.querySelector(".hh-why");
      if (why.hidden === grounded) { why.hidden = !grounded; ab.classList.toggle("grounded", grounded); ab.title = grounded ? translate("Dive strike works only in the air") : ""; }
      ab.disabled = left > 0 || grounded;
    } else ab.hidden = true;
    const dg = root.querySelector(".hh-dodge"), wait = Math.max(0, (e.dodgeReady ?? -Infinity) - S.sim.time);
    dg.style.setProperty("--cd", (wait / ((e.dodgeHelp ? DODGE.helped : DODGE.cooldown) * (e.driven || 1))).toFixed(3));
    dg.disabled = wait > 0;
    if (H.sky) {
      const lb = root.querySelector(".hh-land"), ground = isLanded(e) || e.skyland?.phase === "land";
      const name = ground ? "Take off" : "Land";
      const span = lb.querySelector(".hh-land-name");
      if (span.dataset.src !== name) { span.dataset.src = name; span.textContent = name; lb.setAttribute("aria-label", translate(name)); }
      // The sweep: the glide or climb under way, else the wait before landing again.
      const k = e.driven || 1, s = e.skyland;
      const wait = s ? Math.max(0, s.at - S.sim.time) / Math.max(1e-6, s.at - s.t0) : !ground ? Math.max(0, (e.skyReady ?? -Infinity) - S.sim.time) / (LAND.cooldown * k) : 0;
      lb.style.setProperty("--cd", wait.toFixed(3));
      lb.disabled = !!s || !!e.swoop || wait > 0;
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
    // H8: the spread ring, the head and barrel tints, the magazine pips, "Reloading" and the crouch tag.
    const ring = FEEL_HUD.ring[0] + (FEEL_HUD.ring[1] - FEEL_HUD.ring[0]) * Math.max(0, Math.min(1, e.spread || 0));
    cross.style.setProperty("--spread", `${ring.toFixed(1)}px`);
    cross.classList.toggle("on-head", !!H.head);
    cross.classList.toggle("on-hazard", H.barrel >= 0);
    const mag = cross.querySelector(".hh-mag"), magged = hasMagazine(e);
    if (mag.hidden === magged) mag.hidden = !magged;
    if (magged) {
      const size = magSize(e), left = e.mag ?? size, reloading = S.sim.time < (e.reloadAt ?? -Infinity) - 1e-9;
      const pips = `${size}:${reloading ? size : left}:${reloading}`;
      if (mag.dataset.pips !== pips) {
        mag.dataset.pips = pips;
        mag.querySelector(".hh-pips").innerHTML = Array.from({ length: size }, (_, i) => `<i${i < (reloading ? 0 : left) ? "" : ' class="spent"'}></i>`).join("");
        mag.querySelector(".hh-reload").hidden = !reloading;
        mag.classList.toggle("reloading", reloading);
      }
    }
    const tag = root.querySelector(".hh-crouch"), low = !!e.crouched;
    if (tag.hidden === low) tag.hidden = !low;
    feelTick();
    const scope = cross.querySelector(".hh-scope"), scoped = !!(H.sky && e.scope);
    if (scope.hidden === scoped) scope.hidden = !scoped;
    cross.style.setProperty("--lock", H.lock.progress.toFixed(2));
    cross.classList.toggle("locked", H.lock.progress >= 1);
  }

  // H8: the hero's own hits (sim heroHit / hazardBlast / heroReload events, read in app/frame.js through factionEvent):
  // the hit marker (red for a headshot), a damage number over the target, a kill notice, the PC kick.
  function feelEvent(ev) {
    if (!H.on) return;
    if (ev.type === "heroHit" && ev.id === H.id) {
      H.hits++;
      if (ev.head) H.heads++;
      const mark = H.hud.querySelector(".hh-hitmark");
      mark.classList.toggle("head", !!ev.head);
      mark.classList.remove("show"); void mark.offsetWidth; mark.classList.add("show");
      H.markUntil = performance.now() + FEEL_HUD.marker;
      if (ev.dmg > 0) number(ev);
      if (ev.kill) { H.kills++; feed(ev.head ? "Headshot" : "Enemy down", ev.unit ? D[ev.unit]?.name || ev.name : ev.name, ev.head ? "head" : "kill"); A.tone?.(ev.head ? 980 : 760, 0.07); }
      else A.tone?.(ev.head ? 1180 : 1320, 0.025);
      if (!phone() && !S.view.reducedMotion?.matches && S.settings.combatMotion !== false) H.kick = FEEL_HUD.kick;
    } else if (ev.type === "hazardBlast" && ev.by === H.id) {
      H.blasts++;
      feed("Barrel blast", ev.kills ? `×${ev.kills}` : "", "blast");
    }
  }
  function number(ev) {
    const slot = H.numbers.find((n) => n.until < performance.now()) || H.numbers.reduce((a, b) => (b.until < a.until ? b : a));
    slot.until = performance.now() + FEEL_HUD.number;
    slot.at = { x: ev.x, z: ev.z, air: ev.air };
    slot.t0 = performance.now();
    slot.el.textContent = String(ev.dmg);
    slot.el.className = `hh-dmg${ev.head ? " head" : ""}${ev.kill ? " kill" : ""}`;
    slot.el.hidden = false;
  }
  function feed(what, who = "", kind = "kill") {
    const box = H.hud.querySelector(".hh-feed");
    const line = document.createElement("p");
    line.className = `hh-note ${kind}`;
    line.innerHTML = `<b></b>${who ? " <span></span>" : ""}`;
    line.querySelector("b").textContent = translate(what);
    if (who) line.querySelector("span").textContent = who.startsWith("×") ? who : translate(who);
    box.prepend(line);
    while (box.children.length > 3) box.lastElementChild.remove();
    H.feedAt = performance.now();
  }
  // Damage numbers rise and fade; old notices leave; the marker clears (cheap, in place).
  function feelTick() {
    // Browser suites (__frontier.holdMessages) keep the marker, numbers and notices up until released.
    const hold = !!globalThis.__frontierHoldMessages, now = performance.now(), v = S.view;
    for (const n of H.numbers) {
      if (n.el.hidden) continue;
      if (now >= n.until && !hold) { n.el.hidden = true; continue; }
      const k = hold ? 0.3 : (now - n.t0) / FEEL_HUD.number, y = v.terrain.heightAt(n.at.x, n.at.z) + (n.at.air ? 3.6 : 1.9) + k * 0.8;
      const q = v.project(n.at.x, n.at.z, y), r = v.renderer.domElement.getBoundingClientRect();
      n.el.style.transform = `translate(${Math.round(q.x + r.left)}px, ${Math.round(q.y + r.top)}px)`;
      n.el.style.opacity = String(Math.max(0, 1 - k * k));
    }
    const mark = H.hud.querySelector(".hh-hitmark");
    if (mark.classList.contains("show") && now >= (H.markUntil || 0) && !hold) mark.classList.remove("show");
    const box = H.hud.querySelector(".hh-feed");
    if (box.firstChild && now - H.feedAt > FEEL_HUD.feed && !hold) { box.lastElementChild.remove(); H.feedAt = now - FEEL_HUD.feed * 0.6; }
  }
  // H7 Dodge help's reflex: a rocket or shell about to hit the hero, with the dodge ready, slows the clock to
  // REFLEX.scale of the battle time for REFLEX.seconds (real time), once a shot and at most every REFLEX.gap s.
  // Page time only (the sim's ticks and commands are unchanged), never in a LAN match; no camera shake.
  function reflexTick(dt) {
    const R = H.reflex;
    if (R.left > 0) { R.left = Math.max(0, R.left - dt); }
    R.wait = Math.max(0, R.wait - dt);
    const e = H.on ? hero() : null;
    if (!e || !e.dodgeHelp || S.sim.lan || S.lan || R.left > 0 || R.wait > 0) return;
    const sim = S.sim, k = e.driven || 1;
    if (sim.time < (e.dodgeReady ?? -Infinity) - 1e-9) return;
    // The window in game time (never under one 0.05 s tick, so a frame always sees it).
    const due = Math.max(REFLEX.seconds * REFLEX.scale * k, 0.051);
    for (const s of sim.heroMode?.shots || []) {
      if (s.target !== e.id || !s.heavy || s.blocked || s.air || R.seen.has(s.n)) continue;
      const left = s.at - sim.time;
      if (left > 0 && left <= due) { R.seen.add(s.n); R.left = REFLEX.seconds; R.wait = REFLEX.gap; R.count++; if (R.seen.size > 64) R.seen.clear(); return; }
    }
  }
  // The clock's pace while Hero mode is on or easing (app/frame.js), else null.
  const pace = () => (H.on || H.ease ? H.scale * (H.reflex.left > 0 ? REFLEX.scale : 1) : null);

  function isBehind(camera, x, z) {
    const m = camera.matrixWorld.elements;
    // The camera looks down its -z axis: a point behind has a positive dot with the +z axis.
    return (x - m[12]) * m[8] + (z - m[14]) * m[10] > 0;
  }

  // H8: the sim's events reach the hero HUD through factionEvent (app/frame.js calls it for every event).
  const factionEvent = A.factionEvent;
  A.factionEvent = (ev) => { factionEvent?.(ev); feelEvent(ev); };
  Object.assign(A, { heroTick: tick, heroPace: pace, enterHeroMode: enter, leaveHeroMode: leave, heroModeOn: () => H.on, heroInfo: () => ({ on: H.on, id: H.id, sky: H.sky, flight: H.flight, scope: !!H.hud?.querySelector(".hh-scope:not([hidden])"), airWarn: H.airWarn || 0,
    barrel: H.barrel, head: H.head, crouch: H.crouch, hits: H.hits, kills: H.kills, heads: H.heads, blasts: H.blasts, kick: H.kick,
    marker: !!H.hud?.querySelector(".hh-hitmark.show"), feed: [...(H.hud?.querySelectorAll(".hh-note") || [])].map((n) => n.textContent.trim()),
    reflex: H.reflex.count, reflexOn: H.reflex.left > 0,
    marks: H.edges.filter((m) => !m.hidden && m.classList.contains("air")).length + H.skies.filter((m) => !m.hidden).length, yaw: H.yaw, zoom: H.zoom, scale: H.scale, aim: H.aim, target: H.target?.id ?? null, lock: H.lock.progress, screen: H.screen || null, sent: { ...H.sent } }) });
  return function bind() {
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", () => { H.keys.clear(); if (H.on) trigger(false, null); });
  };
}
