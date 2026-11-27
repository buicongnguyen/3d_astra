// PC message stack (owner, 2026-11-27: "some message on PC still appear in the middle of the screen, it should show in
// the top left"). On PC (not .compact-ui) every transient battle message sits in one column at the top left, under the
// top bar and the map title, stacked one under another in this order: the notice line (#notice: notices and
// alerts), the new-version toast, the counter / fight hint (#fight-hint), the achievement
// toast (#meta-toast) and the voice caption (#voice-caption). The mission dialogue box (#dialogue) and the first-build
// guide keep their own places on the left; the stack steps below them instead of covering them.
// The targeting prompt (#mode-banner) is not part of it: on PC it is a control state shown above the command console
// while an ability is aimed, next to the button that started it.
// message-stack.css puts each one at the left (no centring transform); this file only sets each one's top. Phones
// keep their own lanes (phone-hud.css, captions-ui.js): there the inline top is cleared and nothing else changes.
import "../message-stack.css";

export const STACK = ["#notice", "#update-toast", "#fight-hint", "#meta-toast", "#voice-caption"];
// Pieces on the left the stack never covers; it continues below them.
const KEEP_CLEAR = ["#dialogue", "#defence-guide"];
const GAP = 6, LEFT_LIMIT = 560;

const isPc = () => !document.documentElement.classList.contains("compact-ui");

function shown(el) {
  if (!el || el.hidden || !el.isConnected) return false;
  if (el.id === "notice" || el.id === "voice-caption") return el.classList.contains("show");
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden";
}

// Places the stack once. Returns the boxes it placed (the browser suites read them through window.__frontier).
export function placeMessageStack() {
  const els = STACK.map((sel) => document.querySelector(sel)).filter(Boolean);
  if (!isPc()) {
    for (const el of els) if (el.style.top) el.style.top = "";
    return [];
  }
  const under = [".topbar", ".map-heading"].map((sel) => document.querySelector(sel)).filter((el) => el && el.getClientRects().length);
  let y = Math.max(44, ...under.map((el) => el.getBoundingClientRect().bottom)) + GAP;
  const clear = KEEP_CLEAR.map((sel) => document.querySelector(sel)).filter((el) => shown(el) && el.getClientRects().length)
    .map((el) => el.getBoundingClientRect()).filter((r) => r.left < LEFT_LIMIT && r.width > 2);
  const placed = [];
  for (const el of els) {
    if (!shown(el)) continue;
    const h = el.offsetHeight;
    // Step below a left-side piece this one would run into.
    for (let pass = 0; pass < 2; pass++) for (const r of clear) if (y < r.bottom + GAP && y + h > r.top - GAP) y = r.bottom + GAP;
    const parent = getComputedStyle(el).position === "fixed" ? null : el.offsetParent;
    const top = Math.round(y - (parent ? parent.getBoundingClientRect().top + parent.clientTop : 0));
    if (el.style.top !== `${top}px`) el.style.top = `${top}px`;
    placed.push({ id: el.id, top: y, height: h });
    y += h + GAP;
  }
  return placed;
}

// Runs the stack whenever one of its pieces (or a piece it keeps clear of) changes, and a few times a second as a
// fallback (pieces made later, a dialogue box growing a line, a window resize).
export function setupMessageStack() {
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; placeMessageStack(); }); };
  const watched = new WeakSet();
  const observer = new MutationObserver(queue);
  const watch = () => {
    for (const sel of [...STACK, ...KEEP_CLEAR]) {
      const el = document.querySelector(sel);
      if (!el || watched.has(el)) continue;
      watched.add(el);
      // Not the style attribute: this file writes it.
      observer.observe(el, { attributes: true, attributeFilter: ["class", "hidden"], childList: true, characterData: true, subtree: true });
    }
  };
  watch();
  setInterval(() => { watch(); placeMessageStack(); }, 250);
  addEventListener("resize", queue);
  addEventListener("fc-hud-changed", queue);
  return { place: placeMessageStack };
}
