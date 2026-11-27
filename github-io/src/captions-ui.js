// Subtitles on screen (2026-11-25): one caption at a time for the unit reply or announcer line that is speaking,
// in the player's language, with who said it. The rules (which line, how long) are voice-captions.js; the audio
// director (audio.js) calls show() when a line starts, clear() when it is stopped and update() every frame with
// the audio clock, so a caption follows the voice scheduler exactly (only lines actually spoken).
// Placement: bottom centre of the battlefield, above anything that spans the bottom (the phone dock, the PC
// console) and between the side pieces at that height (the minimap, the landscape dock, the Defence bar), so it
// never covers the HUD; measured again a few times a second while it shows, so a growing dock pushes it up and a
// left-handed layout mirrors for free. position: fixed and pointer-events: none: no layout shift, no lost taps.
// The style is captions.css; text size follows Settings → Text size (:root[data-text-size]).
import { translate } from "./i18n.js";
import "./captions.css";

// What a caption must stay clear of (only the visible ones in the lower part of the screen count).
const AVOID = [
  ".bottom-dock", ".minimap-panel", "#dock-tabs", "#mission-toggle", "#idle-chips", ".touch-controls", "#mode-controls",
  "#defence-bar", "#defence-intel", "#defence-card", "#boss-bar", "#dialogue", "#notice", "#mission-objectives", "#training",
  // Re-score 2026-11-27: the fight hint (ui-extras.js) shares the phone's bottom slot; the caption stacks above it, never over it.
  "#fight-hint",
  // Re-score 2026-11-28: the Hero mode button (a tool-row tile on phones; above the dock only without that row).
  "#hero-mode-btn:not([hidden])",
].join(",");
const GAP = 8;

export class CaptionBox {
  constructor(parent = document.querySelector("#stage") || document.body) {
    const el = this.el = document.createElement("div");
    el.id = "voice-caption";
    el.className = "voice-caption";
    // A polite live region (present from the start, so screen readers hear each new line); the text is already
    // translated here, so the page translator leaves it alone.
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.setAttribute("translate", "no");
    el.dataset.noLocalize = "";
    el.innerHTML = '<b class="vc-who"></b><span class="vc-text"></span>';
    parent.append(el);
    this.who = el.querySelector(".vc-who"); this.text = el.querySelector(".vc-text");
    this.pending = null; this.shown = null; this.placedAt = -Infinity; this.count = 0;
    // A hint that appears or goes (ui-extras.js) moves a shown caption at once, not on the next 250 ms check.
    this.onHud = () => { if (this.shown) this.place(); };
    addEventListener("fc-hud-changed", this.onHud);
  }
  // A line started: show `caption` ({ text, speaker, faction, channel }) from window.from until window.until
  // (audio clock seconds). Replaces whatever caption is up.
  show(caption, window, line = null) {
    this.pending = { caption, window, line };
    this.shown = null;
    this.el.classList.remove("show");
  }
  // The line was stopped early (cut, Voices off, scene skipped): its caption goes now. With `line`, only if it is
  // that line's caption (a cut that starts a new line already replaced it).
  clear(line = null) {
    const mine = this.pending || this.shown;
    if (line && mine?.line && mine.line !== line) return;
    if (line && globalThis.__frontierHoldMessages && this.shown) return; // held (browser suites): the line's end waits for until
    this.pending = null; this.shown = null;
    this.el.classList.remove("show");
  }
  get visible() { return !!this.shown; }
  update(now) {
    const p = this.pending;
    if (p && now >= p.window.from) {
      this.pending = null;
      if (now < p.window.until) this.reveal(p);
    }
    if (this.shown && now >= this.shown.window.until && !globalThis.__frontierHoldMessages) this.clear(); // held: browser suites only
    else if (this.shown && performance.now() - this.placedAt > 250) this.place();
  }
  reveal(entry) {
    const { caption } = entry;
    this.who.textContent = translate(caption.speaker);
    this.text.textContent = translate(caption.text);
    this.el.dataset.faction = caption.faction;
    this.el.dataset.channel = caption.channel;
    this.shown = entry; this.count++;
    this.place();
    this.el.classList.add("show");
  }
  // Bottom centre, clear of the HUD (see the header).
  place() {
    this.placedAt = performance.now();
    const W = innerWidth, H = innerHeight, el = this.el;
    // PC: the caption is part of the top-left message stack (app/message-stack.js, message-stack.css).
    if (!document.documentElement.classList.contains("compact-ui")) {
      el.style.left = el.style.bottom = el.style.maxWidth = "";
      return;
    }
    const boxes = [];
    for (const node of document.querySelectorAll(AVOID)) {
      if (node === el || !node.getClientRects().length) continue;
      const s = getComputedStyle(node);
      if (s.visibility === "hidden" || parseFloat(s.opacity) < 0.05) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < H * 0.4 || r.top > H) continue;
      boxes.push(r);
    }
    // Pieces that span the middle of the screen (the phone dock, the PC console) set the floor.
    const spans = (r) => r.left < W / 2 - 60 && r.right > W / 2 + 60;
    let floor = H - GAP;
    for (const r of boxes) if (spans(r)) floor = Math.min(floor, r.top - GAP);
    const fit = (bottom) => {
      let left = GAP, right = W - GAP;
      el.style.maxWidth = `${right - left}px`;
      for (let pass = 0; pass < 2; pass++) {
        const h = el.offsetHeight || 40;
        left = GAP; right = W - GAP;
        for (const r of boxes) {
          if (spans(r) || r.top >= bottom || r.bottom <= bottom - h) continue;
          if (r.left + r.right < W) left = Math.max(left, r.right + GAP);
          else right = Math.min(right, r.left - GAP);
        }
        el.style.maxWidth = `${Math.max(0, right - left)}px`;
      }
      return { left, right };
    };
    let room = fit(floor);
    // Too narrow beside the side pieces: go above the lowest of them instead.
    if (room.right - room.left < 220) {
      const h = el.offsetHeight || 40;
      const side = boxes.filter((r) => !spans(r) && r.top < floor && r.bottom > floor - h);
      if (side.length) { floor = Math.min(...side.map((r) => r.top)) - GAP; room = fit(floor); }
    }
    el.style.left = `${(room.left + room.right) / 2}px`;
    el.style.bottom = `max(${Math.max(0, H - floor)}px, env(safe-area-inset-bottom, 0px) + ${GAP}px)`;
  }
  remove() { removeEventListener("fc-hud-changed", this.onHud); this.el.remove(); }
}
