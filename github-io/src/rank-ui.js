// Commander rank on the page (AAA round 3, R3-R): the rank chip on the title, the "Commander" unlock
// pickers in the skirmish setup and the rank toast on every results screen (through R3-V's onMatchEnd).
// The rules and the profile are in src/profile-rank.js (pure). Nothing here reaches the simulation:
// the picks are kept in the rank profile, never in the battle rules, and the paint is a view tint.
//
// Owner rules kept: every pick is one tap (each item is its own button, no sub-menu), text at least
// 11 px, taps at least 44 px, only the game font stacks. Styles: src/rank.css (Codex UI kit tokens).
import "./rank.css";
import { $ } from "./app/dom.js";
import { onMatchEnd } from "./ceremony.js";
import {
  ITEMS, KINDS, KIND_LABELS, PLEDGE_XP, MAX_RANK, rankOf, isUnlocked, itemOf, loadProfile, saveProfile, withPick,
  recordMatch, setActivePaint, activePaint,
} from "./profile-rank.js";

// Emblem glyphs (24 x 24, drawn in currentColor).
// Each glyph is path data: `fill` drawn solid, `line` drawn as a 2.2 px stroke.
const GLYPHS = {
  ring: { line: "M5.5 13a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0ZM12 2.5v19" },
  spear: { fill: "M12 2 17 11h-3.2v10h-3.6V11H7z" },
  wings: { fill: "M12 8c-2-3-6-4.5-10-4 1 4 3.5 7 7 8-2 .3-3.6 1.2-4.5 2.6C7.8 15.6 10.4 15 12 13c1.6 2 4.2 2.6 7.5 1.6-.9-1.4-2.5-2.3-4.5-2.6 3.5-1 6-4 7-8-4-.5-8 1-10 4ZM9.8 18.5a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0Z" },
  star: { fill: "m12 2.6 2.8 6.1 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.8 3.3 1.4-6.6-5-4.5 6.6-.7z" },
  crown: { fill: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5zM5 19h14v2.2H5z" },
  phoenix: { fill: "M12 21c-3.5-2.4-5.5-5.6-5-9.2C5 11 3.4 9.2 3 6.5c2.4 1.2 4.4 1.4 6 .8C9.6 5 10.6 3.4 12 2c1.4 1.4 2.4 3 3 5.3 1.6.6 3.6.4 6-.8-.4 2.7-2 4.5-4 5.3.5 3.6-1.5 6.8-5 9.2Z" },
};
export function emblemSvg(id) {
  const g = GLYPHS[id] || GLYPHS.ring;
  const fill = g.fill ? `<path d="${g.fill}" fill="currentColor"/>` : "";
  const line = g.line ? `<path d="${g.line}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` : "";
  return `<svg class="rank-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${fill}${line}</svg>`;
}

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const xpLine = (r) => (r.next ? `${r.xp} / ${r.next} XP` : `${r.xp} XP`);
const barHTML = (r) => `<span class="rank-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, Math.max(0, r.progress)) * 100)}%"></i></span>`;

// The title chip: emblem, rank number and name, the title banner and the XP bar. A status, not a control.
export function chipHTML(profile) {
  const r = rankOf(profile.xp), banner = itemOf("banner", profile.picks.banner);
  return `<div class="rank-emblem">${emblemSvg(profile.picks.emblem)}</div>
    <div class="rank-text"><span class="rank-line"><b class="rank-number">Rank ${r.rank}</b><span class="rank-name">${esc(r.name)}</span></span><span class="rank-banner-name">${esc(banner.label)}</span></div>
    <div class="rank-xp">${barHTML(r)}<small class="rank-xp-text">${xpLine(r)}</small></div>`;
}

// One button per item: unlocked items, plus the next locked one of each kind as a teaser (disabled, with
// the rank that unlocks it). Items further away are not controls yet, so nothing is tucked away.
function itemButton(kind, item, profile, rank) {
  const open = item.rank <= rank, picked = profile.picks[kind] === item.id;
  const art = kind === "paint" ? `<i class="rank-swatch" style="--swatch:${item.swatch}" aria-hidden="true"></i>`
    : kind === "emblem" ? emblemSvg(item.id) : "";
  return `<button type="button" data-rank-item="${item.id}" aria-pressed="${picked}"${open ? "" : ` disabled aria-disabled="true" title="Unlocks at rank ${item.rank}"`}>${art}<span class="rank-item-label">${esc(item.label)}</span>${open ? "" : `<small class="rank-lock">Rank ${item.rank}</small>`}</button>`;
}
const HELP = {
  paint: "Your units' colour scheme. Looks only: it never changes a battle.",
  emblem: "Shown on your rank and your results.",
  banner: "The title under your rank.",
};
function pickerHTML(profile) {
  const { rank } = rankOf(profile.xp);
  const row = (kind) => {
    const list = ITEMS[kind], open = list.filter((i) => i.rank <= rank), next = list.find((i) => i.rank > rank);
    const help = kind === "pledge" ? (profile.picks.pledge === "none" ? `Pledge a Daily order for +${PLEDGE_XP} XP on a win, once a day. It never changes a battle.` : itemOf("pledge", profile.picks.pledge).help) : HELP[kind];
    return `<div class="rule-row rank-row" data-rank-kind="${kind}"><span class="rule-name">${KIND_LABELS[kind]}</span><div class="rule-buttons rank-buttons rank-kind-${kind}" role="group" aria-label="${KIND_LABELS[kind]}">${[...open, ...(next ? [next] : [])].map((item) => itemButton(kind, item, profile, rank)).join("")}</div><small class="rule-help">${help}</small></div>`;
  };
  return `<span class="rule-title" id="rank-unlocks-title">Commander rank</span>${KINDS.map(row).join("")}`;
}

// The results toast: XP gained and, on a rank up, what it unlocked.
export function toastHTML(record, profile) {
  const r = record.after;
  const unlocked = record.unlocked.map((u) => `<li class="rank-unlock" data-kind="${u.kind}">${u.kind === "paint" ? `<i class="rank-swatch" style="--swatch:${u.swatch}" aria-hidden="true"></i>` : u.kind === "emblem" ? emblemSvg(u.id) : ""}<span>${KIND_LABELS[u.kind]} · ${esc(u.label)}</span></li>`).join("");
  return `<div class="rank-emblem">${emblemSvg(profile.picks.emblem)}</div>
    <div class="rank-toast-body">
      <strong class="rank-toast-title">${record.rankUp ? "Rank up!" : "Commander XP"}</strong>
      <span class="rank-line"><b class="rank-number">Rank ${r.rank}</b><span class="rank-name">${esc(r.name)}</span><span class="rank-gain">+${record.gained} XP</span></span>
      ${barHTML(r)}<small class="rank-xp-text">${xpLine(r)}</small>
      ${record.pledgeMet ? `<small class="rank-pledge">Daily order met</small>` : ""}
      ${record.rankUp && unlocked ? `<div class="rank-unlocked"><span class="rank-unlocked-head">Unlocked:</span><ul>${unlocked}</ul></div><small class="rank-hint">Pick it in the Skirmish setup.</small>` : ""}
    </div>`;
}

export function setupRank(S, A) {
  let profile = loadProfile();
  let last = null;
  setActivePaint(profile.picks.paint);

  function renderChip() {
    let chip = $("rank-chip");
    const head = document.querySelector("#briefing .briefing-setup .setup-head");
    if (!chip) {
      if (!head) return;
      chip = Object.assign(document.createElement("div"), { id: "rank-chip", className: "rank-chip" });
      chip.setAttribute("role", "group");
      chip.setAttribute("aria-label", "Commander rank");
      head.after(chip);
    }
    chip.dataset.rank = String(rankOf(profile.xp).rank);
    chip.dataset.banner = profile.picks.banner;
    chip.innerHTML = chipHTML(profile);
  }
  function renderPicker() {
    let box = $("rank-unlocks");
    const setup = $("skirmish-setup");
    if (!box) {
      if (!setup) return;
      box = Object.assign(document.createElement("div"), { id: "rank-unlocks", className: "rule-rows rank-unlocks" });
      box.setAttribute("role", "group");
      box.setAttribute("aria-labelledby", "rank-unlocks-title");
      setup.append(box);
      box.addEventListener("click", (event) => {
        const button = event.target.closest("[data-rank-item]");
        if (!button || button.disabled || S.screen?.started) return;
        pick(button.closest("[data-rank-kind]").dataset.rankKind, button.dataset.rankItem);
      });
    }
    box.innerHTML = pickerHTML(profile);
  }
  function render() { renderChip(); renderPicker(); }

  function pick(kind, id) {
    const next = withPick(profile, kind, id);
    if (next === profile) return false;
    profile = next;
    saveProfile(profile);
    if (kind === "paint") setActivePaint(id);
    render();
    return true;
  }

  // One finished match: XP, the profile saved, the toast on its results screen, the title refreshed.
  function matchEnded(summary) {
    const record = recordMatch(profile, summary);
    profile = record.profile;
    saveProfile(profile);
    last = { gained: record.gained, parts: record.parts, before: record.before.rank, after: record.after.rank, rankUp: record.rankUp, unlocked: record.unlocked.map((u) => `${u.kind}:${u.id}`), pledgeMet: record.pledgeMet };
    const root = summary.root;
    if (root?.isConnected) {
      root.querySelector(".rank-toast")?.remove();
      const toast = Object.assign(document.createElement("section"), { className: `rank-toast${record.rankUp ? " rank-up" : ""}` });
      toast.setAttribute("role", "status");
      toast.dataset.rankUp = String(record.rankUp);
      toast.innerHTML = toastHTML(record, profile);
      const actions = root.querySelector(".result-actions, .debrief-actions");
      if (actions) actions.before(toast); else root.append(toast);
    }
    render();
  }

  function info() {
    const r = rankOf(profile.xp);
    return { xp: profile.xp, rank: r.rank, name: r.name, next: r.next, matches: profile.matches, picks: { ...profile.picks }, paint: activePaint(), last,
      open: Object.fromEntries(KINDS.map((kind) => [kind, ITEMS[kind].filter((i) => isUnlocked(kind, i.id, r.rank)).map((i) => i.id)])), maxRank: MAX_RANK };
  }

  Object.assign(A, { rankInfo: info, rankPick: pick });
  return function bind() {
    render();
    onMatchEnd(matchEnded);
  };
}
