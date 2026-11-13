// Commander decisions and the epilogue (0.19a "Choices").
//
// The choice card: a story mission's `{ decide: id }` action leaves `sim.mission.pending`; the
// frame loop (app/frame.js) then opens this card in the dialog shell as the "decision" screen,
// which holds the match but keeps its music. The card shows the speaker's portrait, one sentence
// and two orders with their consequence; keys 1 and 2 choose, Tab stays inside, Escape and the
// pause button do nothing. The answer is the `decide` command, so it is logged and replays.
// Because the card follows `pending`, a save taken while it was open shows it again on Continue.
//
// The epilogue: after the finale is won, five cards for the ending the decisions led to (Vale,
// Sol, Hale, Maren, ECHO), then back to the campaign map. A seen ending replays from the map.
import "../choices.css";
import { $ } from "./dom.js";
import { castPortrait, castName, castRole } from "../cast-portraits.js";
import { ENDINGS } from "../story/choices.js";
import { icon } from "../icons.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function setupChoices(S, A) {
  const Z = S.screen;
  let shown = null;

  // ---------------------------------------------------------------- Choice card
  function openDecision() {
    const pending = S.sim.mission?.pending, d = pending && S.sim.missionDef?.decisions?.[pending.id];
    if (!d || Z.modalType === "decision" || A.settingsUI?.active) return false;
    S.touchControls?.reset();
    S.drag = null;
    S.pointer.inside = false;
    S.keys.clear();
    A.clearMode?.();
    $("selection-box").style.display = "none";
    $("modal").classList.remove("help-wide");
    Z.open("decision");
    A.setModalOpen(true);
    $("modal").classList.add("decision-wide");
    shown = pending.id;
    $("modal-content").innerHTML = `<div class="decision-card" data-decision="${esc(pending.id)}">
      <span class="eyebrow">COMMANDER'S DECISION</span>
      <div class="decision-speaker">${castPortrait(d.who, "large")}<div class="decision-who"><strong>${esc(castName(d.who))}</strong><span>${esc(castRole(d.who))}</span></div></div>
      <h2 id="modal-title" class="decision-prompt">${esc(d.prompt)}</h2>
      <div class="decision-orders" role="group" aria-label="Your orders">${d.options.map((o, i) => `<button class="decision-order ${o.mercy ? "mercy" : "firm"}" data-decide="${esc(o.id)}" aria-keyshortcuts="${i + 1}"><kbd aria-hidden="true">${i + 1}</kbd><span><strong>${esc(o.label)}</strong><small>${esc(o.effect)}</small></span></button>`).join("")}</div>
      <p class="decision-note">The battle waits for your order.</p>
    </div>`;
    $("modal").querySelector("[data-decide]").focus({ preventScroll: true });
    A.tone(620, 0.12);
    return true;
  }
  function decide(option) {
    if (Z.modalType !== "decision" || !shown) return false;
    const ok = S.sim.command({ team: 0, type: "decide", id: shown, option });
    // An answer the match refused keeps the card (it cannot happen from the buttons).
    if (!ok && S.sim.mission?.pending) return false;
    shown = null;
    $("modal").classList.remove("decision-wide");
    A.setModalOpen(false);
    Z.close();
    S.keys.clear();
    A.tone(880, 0.12);
    return true;
  }

  // ---------------------------------------------------------------- Epilogue
  const overlay = document.createElement("section");
  overlay.id = "epilogue";
  overlay.className = "mission-briefing epilogue";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ep-title");
  overlay.innerHTML = `<div class="mb-card">
    <header class="mb-head"><span class="eyebrow" id="ep-eyebrow">EPILOGUE</span><h2 id="ep-title"></h2><p id="ep-summary"></p></header>
    <div class="mb-body" id="ep-body"><div class="mb-speech"><div id="ep-portrait"></div><div class="mb-words"><div class="mb-who"><strong id="ep-name"></strong><span id="ep-role"></span></div><div id="ep-lines" aria-live="polite"></div></div></div></div>
    <footer class="mb-foot"><span class="mb-step" id="ep-step" aria-hidden="true"></span><button class="secondary" id="ep-skip">Skip</button><button class="primary" id="ep-next">Next</button></footer>
  </div>`;
  document.querySelector("#app").append(overlay);
  const q = (id) => overlay.querySelector(`#${id}`);
  let epi = null;
  const behind = () => [document.querySelector("main"), document.querySelector(".topbar"), document.querySelector("#modal"), document.querySelector("#mission-briefing")];
  function renderEpilogue() {
    const ending = ENDINGS[epi.id], card = ending.cards[epi.step], last = epi.step === ending.cards.length - 1;
    q("ep-portrait").innerHTML = castPortrait(card.who, "large");
    q("ep-name").textContent = castName(card.who);
    q("ep-role").textContent = castRole(card.who);
    q("ep-lines").replaceChildren(...card.lines.map((text) => Object.assign(document.createElement("p"), { className: "ep-line", textContent: text })));
    q("ep-step").textContent = `${epi.step + 1} / ${ending.cards.length}`;
    q("ep-skip").hidden = last;
    q("ep-next").innerHTML = last ? `<span>${epi.toMap ? "Campaign map" : "Close"}</span>${icon("arrow")}` : "<span>Next</span>";
    overlay.dataset.step = String(epi.step);
    q("ep-body").scrollTop = 0;
  }
  // toMap: the finale's debrief opens it, and it ends on the campaign map.
  function showEpilogue(id, { toMap = false } = {}) {
    if (!Object.hasOwn(ENDINGS, id)) return false;
    const ending = ENDINGS[id];
    epi = { id, step: 0, toMap, back: document.activeElement };
    overlay.dataset.ending = id;
    q("ep-eyebrow").textContent = "EPILOGUE";
    q("ep-title").textContent = ending.title;
    q("ep-summary").textContent = ending.summary;
    for (const node of behind()) if (node) node.inert = true;
    overlay.hidden = false;
    document.documentElement.classList.add("epilogue-open");
    renderEpilogue();
    q("ep-next").focus({ preventScroll: true });
    return true;
  }
  function closeEpilogue() {
    if (!epi) return;
    const { toMap, back } = epi;
    epi = null;
    overlay.hidden = true;
    document.documentElement.classList.remove("epilogue-open");
    for (const node of behind()) if (node) node.inert = false;
    if (toMap) { S.playMode = "campaign"; A.newGame(); return; }
    if (back?.isConnected && !back.disabled) back.focus?.({ preventScroll: true });
  }
  function nextCard() {
    if (!epi) return;
    if (epi.step >= ENDINGS[epi.id].cards.length - 1) { closeEpilogue(); return; }
    epi.step++;
    renderEpilogue();
    q("ep-next").focus({ preventScroll: true });
  }
  function skipCards() {
    if (!epi) return;
    epi.step = ENDINGS[epi.id].cards.length - 1;
    renderEpilogue();
    q("ep-next").focus({ preventScroll: true });
  }
  q("ep-next").onclick = nextCard;
  q("ep-skip").onclick = skipCards;
  q("ep-body").addEventListener("click", (event) => { if (epi && !event.target.closest("button, a")) nextCard(); });

  Object.assign(A, { openDecision, decide, showEpilogue, closeEpilogue });
  return function bind() {
    // Keys 1 and 2 give the orders on the card; the epilogue owns the keyboard while it is open.
    window.addEventListener("keydown", (event) => {
      if (epi) {
        event.stopPropagation();
        const onButton = event.target instanceof Element && overlay.contains(event.target) && event.target.closest("button");
        if (event.key === "Escape") { event.preventDefault(); closeEpilogue(); return; }
        if (event.key === "Enter" || event.key === " ") { if (!onButton) { event.preventDefault(); if (!event.repeat) nextCard(); } return; }
        if (event.key !== "Tab") return;
        const items = [...overlay.querySelectorAll("button:not([disabled])")].filter((b) => !b.hidden);
        const first = items[0], last = items[items.length - 1];
        if (!overlay.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if (Z.modalType !== "decision" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const k = /^Digit([1-9])$/.exec(event.code)?.[1] || (/^[1-9]$/.test(event.key) ? event.key : null);
      const button = k && $("modal").querySelectorAll("[data-decide]")[Number(k) - 1];
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      decide(button.dataset.decide);
    }, true);
  };
}
