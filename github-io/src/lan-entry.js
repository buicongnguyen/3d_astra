// W11 LAN play, the part loaded with the page: the "LAN play" tile in the title's quick row (one tap, like
// Quick battle) and the loader of the rest (src/net/lan-ui.js, its own chunk: single player never loads it).
// A page opened from the host server's address (?lan, or ?lan=join as the host prints it) opens the LAN
// screen by itself once the game is ready. S.lan is set only while a LAN battle runs (app/frame.js reads it).
import "./lan-entry.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";

export function setupLan(S, A) {
  S.lan = null;
  let loading = null;
  const load = () => (loading ??= import("./net/lan-ui.js").then((m) => m.installLan(S, A)).catch((error) => { loading = null; throw error; }));
  A.openLan = () => load().then((lan) => lan.open()).catch((error) => { console.error(error); A.notice("LAN play could not be loaded. Check the connection to the host, then try again."); });

  return function bind() {
    const slot = $("title-actions");
    if (!slot) return;
    const tile = Object.assign(document.createElement("button"), { type: "button", id: "lan-open", className: "quick-battle lan-tile" });
    tile.innerHTML = `${icon("people")}<span class="quick-text"><strong>LAN play</strong><small>Same Wi-Fi · 2 players</small></span>`;
    tile.title = "Play with a friend on the same Wi-Fi or network";
    slot.append(tile);
    const start = $("start");
    // Usable exactly when Start is (not while the first models load), as the Quick battle tile.
    const sync = () => { tile.disabled = start.disabled && !S.loadFailed; };
    sync();
    new MutationObserver(sync).observe(start, { attributes: true, attributeFilter: ["disabled"] });
    tile.addEventListener("click", () => { if (!S.screen.started) A.openLan(); });
    if (S.query?.has("lan")) {
      // Opened from the host's address: the LAN screen comes up once the title is ready.
      const auto = () => { if (start.disabled || S.screen.started) return false; A.openLan(); return true; };
      if (!auto()) { const watch = new MutationObserver(() => { if (auto()) watch.disconnect(); }); watch.observe(start, { attributes: true, attributeFilter: ["disabled"] }); }
    }
  };
}
