// Phase G interface extras: idle-unit cycling (keys, dock and touch buttons), in-fight counter hints
// and the core-destruction beat. All of it is presentation: nothing here changes the simulation.
import { $ } from "./dom.js";
import { DEFINITIONS as D } from "../data.js";
import { icon } from "../icons.js";
import { HIGH_GROUND_HINT, onHighGround } from "../terrain-labels.js";
import "../ui-extras.css";

export const HINT_SECONDS = 9;
// Phones: the hint is a thin line under the top bar (portrait) or above the notice line (landscape)
// and leaves sooner, so it never sits on the battle for long (ui-extras.css).
export const PHONE_HINT_SECONDS = 4;
export const BEAT_SECONDS = 1.5;
export const BEAT_SLOWDOWN = 0.3;

const isIdleWorker = (u) => u.type === "worker" && !u.orders.length;
const isIdleArmy = (u) => u.kind === "unit" && u.type !== "worker" && !u.orders.length;

// Which of the player's unit types beat or lose to an enemy type, from balance.json
// (`counter` = the type a unit is strong against, `mechanical_bonus` = strong against vehicles).
export function strongAgainst(a, b) {
  const da = D[a], db = D[b];
  return !!da && !!db && (da.counter && da.counter === db.class || (!!da.mechanical_bonus && !!db.mechanical));
}

// The hint text for an enemy type, or null when nothing the player has is involved.
export function counterHint(enemyType, ownTypes, availableTypes = Object.keys(D)) {
  const e = D[enemyType];
  if (!e) return null;
  const weak = ownTypes.find((t) => strongAgainst(enemyType, t));
  if (weak) {
    const answer = availableTypes.find((t) => D[t].kind === "unit" && t !== "worker" && strongAgainst(t, enemyType));
    return answer
      ? `${e.name} counters your ${D[weak].name}. Pull them back and bring ${D[answer].name}.`
      : `${e.name} counters your ${D[weak].name}. Pull them back.`;
  }
  const strong = ownTypes.find((t) => strongAgainst(t, enemyType));
  return strong ? `Your ${D[strong].name} counters ${e.name}. Let it lead the fight.` : null;
}

export function setupUiExtras(S, A) {
  const Z = S.screen;
  const cursor = { worker: -1, army: -1 };
  let seen = new Set();
  let nextHintAt = 0;
  let hintEl = null, hintTimer = 0;
  let idleButtons = null;

  const idleOf = (kind) => S.sim.own(0).filter(kind === "worker" ? isIdleWorker : isIdleArmy).sort((a, b) => a.id - b.id);
  function idleCounts() {
    let worker = 0, army = 0;
    for (const u of S.sim.own(0)) { if (isIdleWorker(u)) worker++; else if (isIdleArmy(u)) army++; }
    return { worker, army };
  }

  // Next idle unit after the last one visited: select it and bring it to the middle of the screen.
  function cycleIdle(kind) {
    const list = idleOf(kind);
    if (!list.length) { A.notice(kind === "worker" ? "No idle Harvesters." : "No idle army units."); return false; }
    const next = list.find((u) => u.id > cursor[kind]) || list[0];
    cursor[kind] = next.id;
    A.setSelection([next.id]);
    A.focusSelection();
    return true;
  }

  function makeHint() {
    hintEl = document.createElement("div");
    hintEl.id = "fight-hint";
    hintEl.setAttribute("role", "status");
    hintEl.hidden = true;
    hintEl.innerHTML = `<span class="fh-text"></span><button type="button" class="fh-close" aria-label="Dismiss hint">×</button>`;
    hintEl.querySelector(".fh-close").onclick = hideHint;
    $("stage").append(hintEl);
  }
  function hideHint() { if (hintEl) hintEl.hidden = true; clearTimeout(hintTimer); }
  function showHint(text) {
    hintEl.querySelector(".fh-text").textContent = text;
    hintEl.hidden = false;
    clearTimeout(hintTimer);
    const compact = document.documentElement.classList.contains("compact-ui");
    hintTimer = setTimeout(hideHint, (compact ? PHONE_HINT_SECONDS : HINT_SECONDS) * 1000);
    nextHintAt = performance.now() + 12000;
  }

  // Your army and an enemy unit that is both visible and on screen: once per enemy type per match.
  function fightHints() {
    if (!hintEl || !hintEl.hidden || performance.now() < nextHintAt) return;
    if (!Z.started || Z.paused || Z.modalType || S.sim.result || S.tutorial || S.playMode === "training") return;
    const army = S.sim.own(0).filter((u) => u.kind === "unit" && u.type !== "worker" && u.damage > 0);
    if (!army.length) return;
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    for (const e of S.sim.entities) {
      if (e.kind !== "unit" || e.team <= 0 || e.type === "worker" || seen.has(e.type)) continue;
      if (!S.sim.hostile(0, e.team) || !S.sim.isVisible(e)) continue;
      const p = S.view.project(e.x, e.z, 0.5);
      if (!p || p.x < 0 || p.y < 0 || p.x > rect.width || p.y > rect.height) continue;
      const near = army.filter((u) => Math.hypot(u.x - e.x, u.z - e.z) < 18);
      if (!near.length) continue;
      const text = counterHint(e.type, [...new Set(near.map((u) => u.type))], S.sim.unitRoster(0));
      seen.add(e.type);
      if (text) { showHint(text); return; }
    }
  }

  // The first ambush by a hidden unit explains the cloak, once per match.
  function factionEvent(event) {
    if (event.type !== "reveal" || !event.ambush || event.victim !== 0 || seen.has("cloak") || !hintEl) return;
    if (!Z.started || S.tutorial || S.sim.result) return;
    seen.add("cloak");
    showHint("Shades are hidden until they strike. Towers and Command cores reveal them.");
  }

  // The first time one of the player's units stands on a plateau top, once per match.
  function highGroundHint() {
    if (!hintEl || seen.has("high") || !S.sim.terrain.plateaus.length || !hintEl.hidden || performance.now() < nextHintAt) return;
    if (!Z.started || Z.paused || Z.modalType || S.sim.result || S.tutorial) return;
    if (!S.sim.own(0).some((u) => u.kind === "unit" && u.hp > 0 && onHighGround(S.sim.terrain, u))) return;
    seen.add("high");
    showHint(HIGH_GROUND_HINT);
  }

  function updateIdleButtons() {
    if (!idleButtons) return;
    const counts = idleCounts();
    for (const [kind, button] of Object.entries(idleButtons)) {
      button.hidden = !counts[kind] || !Z.started;
      button.querySelector("b").textContent = counts[kind];
    }
  }

  // Beat before the result: called by the frame loop when the match has just ended.
  function beginBeat() {
    if (S.tutorial || S.view?.reducedMotion?.matches) return false;
    const core = S.sim.events.find((ev) => ev.type === "death" && ev.core);
    if (!core) return false;
    S.endBeat = { t: 0, x: core.x, z: core.z, fromX: S.view.focus.x, fromZ: S.view.focus.z };
    S.cameraPan = null;
    return true;
  }
  // Returns the time scale for presentation effects; shows the result when the beat is over.
  function stepBeat(dt) {
    const b = S.endBeat;
    if (!b) return 1;
    b.t += dt;
    const k = Math.min(1, b.t / 0.7), ease = k * k * (3 - 2 * k);
    S.view.focusOn(b.fromX + (b.x - b.fromX) * ease, b.fromZ + (b.z - b.fromZ) * ease);
    if (b.t >= BEAT_SECONDS) { S.endBeat = null; A.showResult(); return 1; }
    return BEAT_SLOWDOWN;
  }

  Object.assign(A, { factionEvent, cycleIdle, idleCounts, resetHints() { seen = new Set(); nextHintAt = 0; hideHint(); A.clearMessages?.(); }, beginBeat, stepBeat, uiExtrasTick() { updateIdleButtons(); fightHints(); highGroundHint(); } });

  return function bind() {
    makeHint();
    // Touch buttons; they appear only while something is idle. They float over the battlefield (phone portrait:
    // bottom-right corner; landscape: right of the Objectives chip) because both button rails are already full.
    const chips = document.createElement("div");
    chips.id = "idle-chips";
    idleButtons = {};
    for (const [kind, id, glyph, label] of [["worker", "idle-worker", "worker", "Next idle Harvester"], ["army", "idle-army", "crosshair", "Next idle army unit"]]) {
      const b = document.createElement("button");
      b.id = id; b.className = "idle-button"; b.hidden = true; b.type = "button";
      b.title = label; b.setAttribute("aria-label", label);
      b.innerHTML = `${icon(glyph)}<b>0</b>`;
      b.onclick = () => { cycleIdle(kind); A.updateUI(); };
      chips.append(b);
      idleButtons[kind] = b;
    }
    $("world").append(chips);
    // The empty dock (desktop and phone) offers the same two buttons.
    document.addEventListener("click", (event) => {
      const b = event.target instanceof Element && event.target.closest("[data-idle]");
      if (b && !b.disabled) { cycleIdle(b.dataset.idle); A.updateUI(); }
    });
  };
}
