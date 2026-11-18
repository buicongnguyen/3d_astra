// The boss bar (bosses: src/sim/bosses.js, docs/aaa/BOSSES.md): the boss's name, what it is doing
// (ARMORED, ATTACK INBOUND, CORE EXPOSED) and its health, with notches at the two health stages.
// Shown from the moment the boss wakes until it falls. Desktop: above the central console; phone
// portrait: just above the dock, left of the idle buttons; phone landscape: the top row, right of
// the idle buttons. It never takes taps. Text is 11 px or more (boss-ui.css, loaded by app/hud.js).
import { BOSSES } from "./sim/bosses.js";

export const BOSS_STATES = { tracking: "ARMORED", warning: "ATTACK INBOUND", attacking: "ATTACK INBOUND", exposed: "CORE EXPOSED" };

// What the bar shows, or null: the awake boss on the field (one at a time).
export function bossStatus(sim) {
  const e = sim?.entities?.find((x) => x.boss && x.hp > 0 && BOSS_STATES[x.bs?.phase]);
  if (!e) return null;
  const spec = BOSSES[e.boss] || {};
  return { id: e.id, name: e.name, phase: e.bs.phase, state: BOSS_STATES[e.bs.phase], stage: e.bs.stage || 1, health: Math.max(0, e.hp / e.maxHp), shield: e.maxShield ? e.shield / e.maxShield : 0, stages: spec.stages || [] };
}

let bar = null;
function create() {
  bar = document.createElement("div");
  bar.id = "boss-bar";
  bar.hidden = true;
  bar.setAttribute("role", "status");
  bar.innerHTML = `<div class="boss-head"><strong class="boss-name"></strong><span class="boss-state"></span></div><div class="boss-track"><i class="boss-fill"></i><i class="boss-shield"></i></div>`;
  (document.getElementById("world") || document.body).append(bar);
  return bar;
}

export function updateBossBar(sim, started = true) {
  const status = started ? bossStatus(sim) : null;
  if (!bar && !status) return;
  bar ||= create();
  bar.hidden = !status;
  if (!status) return;
  if (bar.dataset.id !== String(status.id)) {
    bar.dataset.id = status.id;
    bar.querySelector(".boss-name").textContent = status.name;
    const track = bar.querySelector(".boss-track");
    track.querySelectorAll(".boss-notch").forEach((n) => n.remove());
    for (const f of status.stages) { const n = document.createElement("i"); n.className = "boss-notch"; n.style.left = `${(f * 100).toFixed(2)}%`; track.append(n); }
  }
  if (bar.dataset.phase !== status.phase) {
    bar.dataset.phase = status.phase;
    bar.querySelector(".boss-state").textContent = status.state;
  }
  bar.dataset.stage = status.stage;
  // Phone landscape: the bar shares the top row with the idle buttons, whose width follows their
  // counts, so it starts just right of the last one shown (boss-ui.css --boss-left).
  if (document.documentElement.classList.contains("compact-ui") && innerWidth >= innerHeight * 1.35) {
    const world = bar.parentElement.getBoundingClientRect();
    const right = Math.max(0, ...[...(document.getElementById("idle-chips")?.children || [])].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect().right));
    const left = right ? `${Math.round(right - world.left + 8)}px` : "";
    if (bar.style.getPropertyValue("--boss-left") !== left) bar.style.setProperty("--boss-left", left);
  }
  bar.style.setProperty("--boss-hp", status.health.toFixed(4));
  bar.style.setProperty("--boss-shield", status.shield.toFixed(4));
}
