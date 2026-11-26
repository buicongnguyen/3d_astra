// The campaign archive window (owner 2026-11-26): the Achievements button on the campaign map opens it over the
// title. One tab each for the achievements (cards with progress, as in the Records screen), the veteran squad and
// the commanders met; every tab is one tap and its rows are all visible (no sub-menu). It reuses the Records
// screen's sheet (meta.css .records-sheet) so the two windows look and close alike: Close, Escape or a tap
// outside. Nothing here reaches the simulation; it reads the stored progress, record and Defence progress.
import { icon } from "./icons.js";
import { achievementsFor } from "./story/achievements.js";
import { loadRecord } from "./meta/record.js";
import { loadDefence } from "./defence/progress.js";
import { DEFINITIONS as DEFS } from "./data.js";
import { achievementGroupsHTML } from "./meta-ui.js";
import { getLanguage, loadStory } from "./i18n.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const ARCHIVE_TABS = [["achievements", "Achievements", "star"], ["veterans", "Your veterans", "shield"], ["commanders", "Commanders met", "people"]];
const COMMANDERS = [["m04-sol", "Captain Sol"], ["m07-hale", "Commander Hale"], ["m10-maren", "Ilse Maren"]];

export function archiveSheetHTML(progress, tab = "achievements") {
  const ach = achievementsFor(progress, { record: loadRecord(), defence: loadDefence() });
  const squad = progress?.squad || [];
  const counts = { achievements: `${ach.filter((a) => a.done).length} / ${ach.length}`, veterans: String(squad.length), commanders: `${COMMANDERS.filter(([id]) => typeof progress?.decisions?.[id] === "string").length} / ${COMMANDERS.length}` };
  const tabs = ARCHIVE_TABS.map(([id, label, ic]) => `<button type="button" role="tab" class="kit-face" id="archive-tab-${id}" data-archive-tab="${id}" aria-selected="${id === tab}" aria-controls="archive-panel"${id === tab ? "" : ` tabindex="-1"`}>${icon(ic)}<span>${label}</span> <b translate="no">${counts[id]}</b></button>`).join("");
  let body;
  if (tab === "veterans") {
    body = squad.length
      ? `<ul class="meta-ach-list">${squad.map((m) => `<li class="meta-ach done archive-vet">${icon("shield")}<span class="meta-ach-text"><strong>${esc(m.name)}</strong><small>${esc(DEFS[m.type]?.name || m.type)}</small></span><b class="archive-stars" translate="no">${"★".repeat(Math.min(3, m.rank))}</b></li>`).join("")}</ul>`
      : `<p class="meta-note">None yet. Rank up units and win a mission.</p>`;
  } else if (tab === "commanders") {
    body = `<ul class="meta-ach-list">${COMMANDERS.map(([id, name]) => {
      const answer = progress?.decisions?.[id], state = answer === "accept" ? "spared" : answer === "finish" ? "beaten" : "unmet";
      return `<li class="meta-ach archive-met ${state === "unmet" ? "todo" : "done"} ${state}">${icon("people")}<span class="meta-ach-text"><strong>${esc(name)}</strong><small>${state === "spared" ? "Spared" : state === "beaten" ? "Defeated" : "Not met yet"}</small></span></li>`;
    }).join("")}</ul>`;
  } else body = achievementGroupsHTML(ach);
  return `<header class="records-head"><h2 id="archive-title">Campaign archive</h2><button type="button" class="kit-face records-close" data-archive-close aria-label="Close archive">${icon("close")}<span>Close</span></button></header>
    <div class="records-jump archive-tabs" role="tablist" aria-label="Archive">${tabs}</div>
    <div class="records-body" id="archive-panel" role="tabpanel" aria-labelledby="archive-tab-${tab}" data-tab="${tab}">${body}</div>`;
}

let dialog = null, tab = "achievements";
// Opens the window; `Z` is the screen state (S.screen), restored on close like the Records screen.
export function openCampaignArchive({ progress, Z, opener = null, start = null }) {
  if (start) tab = start;
  let previous = null;
  const draw = () => { const top = dialog.querySelector(".records-body")?.scrollTop || 0; dialog.innerHTML = archiveSheetHTML(progress, tab); dialog.querySelector(".records-body").scrollTop = top; };
  if (!dialog) {
    dialog = Object.assign(document.createElement("dialog"), { id: "campaign-archive", className: "records-sheet archive-sheet" });
    dialog.setAttribute("aria-labelledby", "archive-title");
    document.body.append(dialog);
  }
  if (dialog.open) return dialog;
  dialog.onclick = (event) => {
    if (event.target.closest("[data-archive-close]") || event.target === dialog) { dialog.close(); return; }
    const pick = event.target.closest("[data-archive-tab]");
    if (pick && pick.dataset.archiveTab !== tab) { tab = pick.dataset.archiveTab; dialog.innerHTML = archiveSheetHTML(progress, tab); dialog.querySelector(`[data-archive-tab="${tab}"]`)?.focus({ preventScroll: true }); }
  };
  // Arrow keys move between the tabs (the tablist pattern); Tab still walks the page.
  dialog.onkeydown = (event) => {
    if (!event.target.closest?.("[data-archive-tab]") || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const ids = ARCHIVE_TABS.map(([id]) => id), at = ids.indexOf(tab);
    tab = ids[event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : (at + (event.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
    event.preventDefault();
    dialog.innerHTML = archiveSheetHTML(progress, tab);
    dialog.querySelector(`[data-archive-tab="${tab}"]`)?.focus({ preventScroll: true });
  };
  dialog.onclose = () => { Z?.restore(previous); opener?.isConnected ? opener.focus({ preventScroll: true }) : document.querySelector(".cmap-archive-open")?.focus({ preventScroll: true }); };
  dialog.innerHTML = archiveSheetHTML(progress, tab);
  // Mission and achievement words are story text in other languages: redraw once that catalog has loaded.
  if (getLanguage() !== "en") loadStory().then(() => { if (dialog.open) draw(); }).catch(() => {});
  previous = Z?.snapshot();
  Z?.open("guide");
  dialog.showModal();
  dialog.querySelector(`[data-archive-tab="${tab}"]`).focus({ preventScroll: true });
  return dialog;
}
export const archiveTab = () => tab;
export const closeCampaignArchive = () => { if (dialog?.open) dialog.close(); };
