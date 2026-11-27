// H3c: the "AI running your base" strip, shown while the steward (sim/steward.js) runs the player's side.
// Top left: on PC it is the first piece of the message stack (app/message-stack.js), on phones it sits under
// the top-right controls, clear of the idle buttons (steward-ui.css). It never takes taps. Made on first use, so a match without it builds nothing.
import "./steward-ui.css";

export const STEWARD_TEXT = "AI running your base";
let strip = null;

export function updateStewardStrip(sim, started = true, team = 0) {
  const on = !!started && !!sim?.steward?.[team] && !sim.result;
  if (!strip && !on) return;
  if (!strip) {
    strip = document.createElement("div");
    strip.id = "steward-strip";
    strip.setAttribute("role", "status");
    strip.innerHTML = `<i class="steward-dot" aria-hidden="true"></i><span class="steward-text"></span>`;
    strip.querySelector(".steward-text").textContent = STEWARD_TEXT;
    strip.hidden = true;
    document.body.append(strip);
  }
  if (strip.hidden === on) strip.hidden = !on;
}
