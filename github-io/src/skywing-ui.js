// H1/H2 Skywing and coins on screen (HERO-COINS-PLAN.md; owner 2026-11-27). Rules live in
// src/sim/content/skywing.js (the hero) and src/meta/coins.js (the wallet); this file only shows them:
//   - the coin chip (44 px) on the title screen's top bar and in the mission briefing, never in battle;
//   - the row "Skywing assist: Off / On (60 coins)", one segmented control with both choices always
//     visible, on the mission briefing, the skirmish setup and the Defence menu (one choice for all three);
//   - "Need help? Take Skywing." on that row after two losses in a row on the mission (once per streak);
//   - paying when the match starts (never earlier: Back or a preview costs nothing), then the hero is called
//     with the `skywing` command, so saves, replays and the steward see it like any other order;
//   - the coins a finished match paid, counted up on its results screen (static with reduced motion);
//   - the weapon switch's command (the switch itself is drawn by tactics-card.js).
// Off is the default, and the choice goes back to Off once paid: every purchase is a fresh tap.
import "./skywing-ui.css";
import { $ } from "./app/dom.js";
import { loadWallet, saveWallet, canAfford, spend, settle, wantsHint, markHinted, SKYWING_PRICE } from "./meta/coins.js";
import { isSkywing } from "./sim/content/skywing.js";
import { enemyAntiAir } from "./story/assist-intel.js";
import { onMatchEnd } from "./ceremony-rules.js";
import { reducedMotionQuery } from "./reduced-motion.js";
import { missionsOf } from "./campaign.js";
import { DEFENCE_LEVELS } from "./defence/levels.js";

const MODES = new Set(["campaign", "skirmish", "defence"]);
// The debrief's line names (src/locales translate each).
const LINE_NAMES = { win: "Mission won", stars: "Medal stars", first: "First win", loss: "Mission lost", matchWin: "Match won", matchLoss: "Match played", daily: "First match today", achievement: "New achievement" };

export function setupSkywing(S, A) {
  const Z = S.screen;
  S.wallet = loadWallet(S.campaign);
  S.assistPick = "off";
  S.assistLast = false;
  let hintShown = null; // the mission whose row showed "Need help? Take Skywing." (given once per streak)

  const coinHTML = (extra = "") => `<span class="coin-chip${extra}" role="status" aria-label="Coins"><i class="coin-glyph" aria-hidden="true"></i><b translate="no">${S.wallet.coins}</b> <span>coins</span></span>`;

  // The mission the current setup plays (a story mission or a Defence level), for the loss streak.
  function pickedMission() {
    if (S.playMode === "campaign") return missionsOf(S.campaignId)[S.stagePick] || null;
    if (S.playMode === "defence") return DEFENCE_LEVELS[S.defencePick] || DEFENCE_LEVELS[0];
    return null;
  }

  function rowHTML(where) {
    const affordable = canAfford(S.wallet), m = pickedMission(), on = S.assistPick === "on" && affordable;
    const hint = !!m && wantsHint(S.wallet, m.id);
    if (hint) hintShown = m.id;
    const noAir = m && !enemyAntiAir(m);
    return `<div class="rule-rows assist-rows" data-assist-where="${where}" role="group" aria-labelledby="assist-title-${where}">
      <div class="assist-head"><span class="rule-title" id="assist-title-${where}">Skywing assist</span>${coinHTML(" in-row")}</div>
      <div class="rule-row"><div class="rule-buttons" role="group" aria-label="Skywing assist">
        <button type="button" data-assist="off" aria-pressed="${!on}">Off</button>
        <button type="button" data-assist="on" aria-pressed="${on}"${affordable ? "" : " disabled"}><span>On</span> <small class="assist-price">(<b translate="no">${SKYWING_PRICE}</b> <span>coins</span>)</small></button>
      </div>
      ${hint ? '<p class="assist-hint" data-assist-hint>Need help? Take Skywing.</p>' : ""}
      <small class="rule-help">${affordable ? "A flying hero joins you for this match, with a sniper rifle and a rocket launcher you switch in the field. It cannot capture points and deals half damage to buildings." : "Not enough coins. Every mission or match you play pays coins, a loss too."}</small>
      ${noAir ? '<small class="rule-help">No enemy here can shoot flyers.</small>' : ""}</div>
    </div>`;
  }

  // Each place keeps one row, redrawn when what it shows changed.
  function place(container, where, before = null) {
    if (!container) return;
    let row = container.querySelector(`[data-assist-where="${where}"]`);
    const html = rowHTML(where);
    if (row && row.dataset.html === html) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const next = wrap.firstElementChild;
    next.dataset.html = html;
    if (row) row.replaceWith(next);
    else if (before && before.parentNode === container) container.insertBefore(next, before);
    else container.append(next);
  }

  function renderChip() {
    let chip = $("coin-chip");
    const top = document.querySelector(".topbar");
    if (!chip && top) {
      chip = Object.assign(document.createElement("div"), { id: "coin-chip", className: "coin-top" });
      const anchor = $("top-rank") || top.querySelector(".brand");
      if (anchor) anchor.after(chip); else top.prepend(chip);
    }
    if (chip) { const html = coinHTML(); if (chip.dataset.html !== html) { chip.dataset.html = html; chip.innerHTML = html; } }
  }

  function renderRows() {
    renderChip();
    if (Z.started) return;
    if (S.playMode === "skirmish") place($("skirmish-setup"), "skirmish", $("battle-rules"));
    if (S.playMode === "defence") place($("defence-setup"), "defence", $("defence-perks-toggle"));
    // The mission briefing: between its body and its buttons, so the row never scrolls out of view.
    const card = document.querySelector("#mission-briefing .mb-card");
    if (A.missionUI?.briefingOpen && card) place(card, "mission", card.querySelector(".mb-foot"));
  }

  function pick(value) {
    if (Z.started && !A.missionUI?.briefingOpen) return;
    if (value === "on" && !canAfford(S.wallet)) { A.notice("Not enough coins for Skywing yet."); return; }
    S.assistPick = value === "on" ? "on" : "off";
    A.tone?.(value === "on" ? 660 : 440, 0.08);
    renderRows();
  }

  // The match has started (match-flow.js): pay and call Skywing in. `again`: a restart of a match that had it.
  function start(again = false) {
    const m = S.sim?.missionDef;
    // A hint the player saw on this mission's row counts as given.
    if (!again && m?.id && hintShown === m.id && wantsHint(S.wallet, m.id)) { S.wallet = markHinted(S.wallet, m.id); saveWallet(S.wallet); }
    hintShown = null;
    const want = again ? S.assistLast : S.assistPick === "on";
    S.assistPick = "off";
    S.assistLast = false;
    if (!want || !MODES.has(S.playMode) || S.tutorial || S.replay || S.sim?.lan) { renderChip(); return; }
    const paid = spend(S.wallet);
    if (!paid) { A.notice("Not enough coins for Skywing."); renderChip(); return; }
    if (!S.sim.command({ team: 0, type: "skywing" })) { renderChip(); return; }
    S.wallet = paid;
    saveWallet(S.wallet);
    S.assistLast = true;
    renderChip();
  }

  // The weapon switch on the command card (tactics-card.js).
  function switchWeapon(weapon) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const e = A.selectedEntities().find(isSkywing);
    if (!e) return;
    if (S.sim.command({ team: 0, type: "heroWeapon", id: e.id, weapon })) A.tone?.(weapon === "rocket" ? 380 : 720, 0.08);
    A.updateUI?.();
  }

  // ---------------------------------------------------------------- The debrief
  function matchEnded(summary) {
    if (!MODES.has(summary.mode) || S.replay || S.sim?.lan) return;
    const before = S.wallet;
    const { wallet, lines, total } = settle(before, { mode: summary.mode, win: !!summary.win, missionId: summary.missionId, medal: summary.medal, seconds: summary.seconds, achievements: S.campaign?.earned || [] });
    if (!lines.length) return;
    S.wallet = wallet;
    saveWallet(S.wallet);
    renderChip();
    const root = summary.root;
    if (!root?.isConnected) return;
    root.querySelector(".coin-toast")?.remove();
    const box = Object.assign(document.createElement("section"), { className: "coin-toast" });
    box.setAttribute("role", "status");
    box.dataset.total = String(total);
    box.innerHTML = `<div class="coin-toast-head">${'<i class="coin-glyph" aria-hidden="true"></i>'}<span>Coins earned</span><b class="coin-gain" translate="no">+${total}</b></div>
      <ul class="coin-lines">${lines.map((l) => `<li><span>${LINE_NAMES[l.id]}</span><b translate="no">+${l.coins}</b></li>`).join("")}</ul>
      <p class="coin-total"><span>Coins</span> <b translate="no" data-coins>${wallet.coins}</b></p>`;
    const actions = root.querySelector(".result-actions, .debrief-actions");
    if (actions) actions.before(box); else root.append(box);
    // The count-up: 0 to the total in about 0.9 s; with motion off it shows the total at once.
    const calm = reducedMotionQuery.matches || S.settings?.combatMotion === false || S.query?.has("test");
    if (calm) return;
    const gain = box.querySelector(".coin-gain"), coins = box.querySelector("[data-coins]"), t0 = performance.now();
    const frame = (now) => {
      if (!box.isConnected) return;
      const k = Math.min(1, (now - t0) / 900), eased = 1 - (1 - k) ** 3;
      gain.textContent = `+${Math.round(total * eased)}`;
      coins.textContent = String(before.coins + Math.round(total * eased));
      if (k < 1) requestAnimationFrame(frame);
    };
    gain.textContent = "+0";
    coins.textContent = String(before.coins);
    requestAnimationFrame(frame);
  }

  Object.assign(A, { skywingStart: start, switchWeapon, renderSkywing: renderRows, wallet: () => S.wallet, setWallet: (w) => { S.wallet = w; saveWallet(w); renderRows(); } });
  return function bind() {
    // The rows follow the start screen and the mission briefing wherever they are redrawn.
    // (app/briefing.js renderBriefing and app/defence-entry.js renderDefenceMenu call A.renderSkywing.)
    const openBriefing = A.missionUI?.openBriefing;
    if (openBriefing) A.missionUI.openBriefing = (...args) => { const r = openBriefing(...args); renderRows(); return r; };
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-assist]");
      if (!button || button.disabled || !button.closest(".assist-rows")) return;
      pick(button.dataset.assist);
    });
    onMatchEnd(matchEnded);
    renderRows();
  };
}
