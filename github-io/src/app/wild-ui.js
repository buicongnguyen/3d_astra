// Wild frontier, P1 (AAA round 4): the Weather button and its aim. One button, always on screen in a
// Wild match (owner: one tap, never behind a menu), on desktop and phones alike:
//   - nobody's Spire yet / an enemy's: "Take Spire"; a tap pans the camera to the Spire and says how
//   - arming or recharging: the seconds left
//   - ready: a tap starts the aim (a sand circle follows the pointer or sits mid-screen on touch); the
//     next tap or click on the map calls the storm there (Esc or Cancel stops)
// Presentation only: the storm is the sim command `weather` (sim/content/wild-frontier.js).
import { $ } from "./dom.js";
import { spireState } from "../sim/content/wild-frontier.js";
import "../wild-ui.css";

const STORM_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 8.5h11.5a3 3 0 1 0-3-3" /><path d="M3 12.5h16a3 3 0 1 1-3 3" /><path d="M5 16.5h6" /><path d="M7 4.5h2" /></svg>`;

export function weatherLabel(state) {
  if (!state) return null;
  if (!state.held) return { label: "Sandstorm", sub: "Take Spire", ready: false };
  if (state.ready) return { label: "Sandstorm", sub: "Ready", ready: true };
  return { label: "Sandstorm", sub: `${Math.ceil(state.readyIn)} s`, ready: false };
}

export function setupWildUi(S, A) {
  const Z = S.screen;
  let button = null;

  function ensureButton() {
    if (button) return button;
    button = document.createElement("button");
    button.id = "weather-power";
    button.type = "button";
    button.hidden = true;
    button.innerHTML = `<span class="wp-icon">${STORM_ICON}</span><span class="wp-text"><span class="wp-label">Sandstorm</span><small class="wp-sub">Take Spire</small></span>`;
    button.title = "Sandstorm: hold the Weather Spire, then tap here and tap the map. Enemies inside fire 30% slower and see 4 m; your units inside are hidden.";
    button.setAttribute("aria-label", "Sandstorm power");
    button.addEventListener("click", press);
    $("stage").appendChild(button);
    return button;
  }

  function press() {
    if (!Z.started || Z.paused || S.sim.result) return;
    const state = spireState(S.sim, 0);
    if (!state) return;
    if (S.mode === "weather") { A.clearMode(); A.updateUI(); return; }
    if (!state.held) {
      A.notice("Hold the Weather Spire to call a sandstorm.");
      S.view.focusOn(state.x, state.z);
      return;
    }
    if (!state.ready) { A.notice(`Sandstorm recharging: ${Math.ceil(state.readyIn)} s.`); return; }
    A.clearMode();
    S.mode = "weather";
    $("mode-banner").hidden = false;
    $("mode-banner").textContent = S.touchInput ? "SANDSTORM · Tap a spot on the map" : "SANDSTORM · Click a spot on the map · Esc to cancel";
    $("mode-controls").hidden = false;
    A.dismissNotice?.();
    $("world").classList.add("targeting");
    // Touch: the circle waits mid-screen until the tap; desktop: it follows the pointer.
    const r = S.view.renderer.domElement.getBoundingClientRect();
    S.view.wildAim = S.touchInput ? S.view.point(r.left + r.width / 2, r.top + r.height / 2) : (S.hoverPoint ? S.view.point(S.hoverPoint.x, S.hoverPoint.y) : null);
    A.tone?.(640, 0.08);
    tick();
  }

  function aimWeather(point) {
    if (S.mode === "weather") S.view.wildAim = point || null;
  }

  function fireWeather(point) {
    if (!point || !Z.started || Z.paused || S.sim.result) return;
    if (S.sim.command({ team: 0, type: "weather", x: point.x, z: point.z })) {
      A.tone?.(420, 0.16);
      A.clearMode();
    } else {
      A.notice("The Sandstorm is not ready.");
      A.clearMode();
    }
    S.view.wildAim = null;
    A.updateUI();
  }

  // Where the button goes: the first free corner of the battlefield, never on the dock, the top bar, the
  // touch tool row, the objectives or the minimap (it never grows the fixed phone docks: it floats).
  // Bottom right (desktop, where the dock leaves the corner free), then just above the dock on the right
  // (phones), then just under the top bar on the right.
  let placedFor = "", placedAt = -1e9;
  function place(b) {
    // Reading the layout forces it on phones: once a second, or at once after a resize.
    const now = performance.now();
    if (placedFor.startsWith(`${innerWidth}x${innerHeight}:`) && now - placedAt < 1000) return;
    placedAt = now;
    const W = innerWidth, H = innerHeight, rect = (s) => { const el = document.querySelector(s); if (!el || el.offsetParent === null) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const blockers = [".bottom-dock", ".command-deck", ".minimap-panel", "#dock-tabs", ".topbar", ".touch-controls", "#mission-objectives", "#mission-toggle", ".statusbar", "#mode-controls", "#mode-banner"].map(rect).filter(Boolean);
    const key = `${W}x${H}:${blockers.map((r) => `${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}`).join(";")}`;
    if (key === placedFor) return;
    placedFor = key;
    const w = Math.max(b.offsetWidth, 132), h = Math.max(b.offsetHeight, 48), gap = 10;
    const top = Math.max(0, ...[rect(".topbar"), rect(".touch-controls")].filter(Boolean).map((r) => r.bottom));
    const dock = [rect(".bottom-dock"), rect("#dock-tabs"), rect(".statusbar")].filter(Boolean);
    const dockTop = Math.min(H, ...dock.filter((r) => r.right > W - w - gap).map((r) => r.top));
    const free = (x, y) => x >= 0 && y >= top && x + w <= W && y + h <= H && !blockers.some((r) => x < r.right && x + w > r.left && y < r.bottom && y + h > r.top);
    const spots = [[W - w - 14, H - h - 14], [W - w - 12, dockTop - h - gap], [W - w - 12, top + gap], [12, top + gap]];
    const [x, y] = spots.find(([x, y]) => free(x, y)) || spots[1];
    b.style.left = `${Math.round(x)}px`;
    b.style.top = `${Math.round(y)}px`;
    b.style.right = b.style.bottom = "auto";
  }

  // Every UI tick (app/frame.js): show, label and arm the button.
  function tick() {
    const state = Z.started ? spireState(S.sim, 0) : null;
    if (!state) {
      if (button) button.hidden = true;
      if (S.view) S.view.wildAim = null;
      return;
    }
    const b = ensureButton(), text = weatherLabel(state);
    b.hidden = false;
    place(b);
    b.querySelector(".wp-sub").textContent = text.sub;
    b.classList.toggle("ready", text.ready);
    b.classList.toggle("held", state.held);
    b.setAttribute("aria-pressed", String(S.mode === "weather"));
    if (S.mode !== "weather") S.view.wildAim = null;
    // The power was lost (the Spire fell) while aiming.
    else if (!state.ready) { A.clearMode(); S.view.wildAim = null; }
  }

  Object.assign(A, { wildTick: tick, fireWeather, aimWeather });
  return function bind() {};
}
