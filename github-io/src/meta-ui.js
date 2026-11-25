// Replay value on the page (W6, docs/aaa/ROADMAP_TO_AAA_2026-11-25.md): the service record and the
// achievements (src/meta/record.js, src/story/achievements.js) with their toast, the "Records" tile on the
// title and the Records screen.
//
// Every finished match (ceremony.js onMatchEnd) is described once (matchContext) and added to the record.
// A few achievements can be reached mid-match (a Kite Dive, a tamed Wyrm, a Field commander rank): a light
// check every second shows their toast at once. Nothing here reaches the simulation: it reads the match,
// its counters (src/match-stats.js) and the stored progress only.
//
// Owner rules kept: no hidden or grouped buttons (the Records tile opens the screen in one tap; every row
// in it is visible, nothing behind a sub-menu), text 11 px and up, taps 44 px and up, EN/VI/KO catalogs.
import "./meta.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { onMatchEnd } from "./ceremony.js";
import { loadProgress } from "./campaign.js";
import { loadDefence } from "./defence/progress.js";
import { playerFactionOf } from "./factions.js";
import { ACHIEVEMENTS, achievementsFor, recordMoreAchievements, goldActs, goldCount } from "./story/achievements.js";
import { loadRecord, saveRecord, addMatch } from "./meta/record.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The campaign's thirteen carry no icon of their own (story/achievements.js); these suit them.
const CAMPAIGN_ICONS = { "first-light": "flag", "act-1": "map", "act-2": "map", "act-3": "map", "gold-5": "star", "veteran-5": "shield", decider: "objectives", mercy: "linkshield", "no-quarter": "crosshair", "both-endings": "objectives", "squad-6": "people", "extras-10": "check", chronicler: "logo" };
const achIcon = (a) => CAMPAIGN_ICONS[a.id] || a.icon || "star";
const GROUP_LABELS = { campaign: "Campaign", skirmish: "Skirmish", defence: "Defence", kite: "Kite scouts", wild: "Wild frontier" };

export function setupMeta(S, A) {
  const Z = S.screen;
  let record = loadRecord();
  const extra = () => ({ record, defence: S.defenceProgress || loadDefence() });
  const progress = () => S.campaign || loadProgress();
  const all = () => achievementsFor(progress(), extra());

  // ---------- the summary the medal cosmetics read (src/meta/rewards.js) ----------
  function syncMeta() {
    const p = progress(), list = all();
    record = { ...record, meta: { ...record.meta, ach: list.filter((a) => a.done).length, gold: goldCount(p), goldActs: goldActs(p) } };
  }

  // ---------- the toast: one line at a time at the top, never over the dock or the minimap, taps pass through ----------
  const queue = [];
  let toast = null, showing = false;
  function showToast(html, kind = "achievement") {
    queue.push({ html, kind });
    if (!showing) nextToast();
  }
  function nextToast() {
    const item = queue.shift();
    if (!item) { showing = false; if (toast) toast.hidden = true; return; }
    showing = true;
    if (!toast?.isConnected) {
      toast = Object.assign(document.createElement("div"), { id: "meta-toast", className: "meta-toast" });
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.dataset.kind = item.kind;
    toast.innerHTML = item.html;
    toast.hidden = false;
    toast.classList.remove("in");
    void toast.offsetWidth;
    toast.classList.add("in");
    setTimeout(nextToast, S.query?.has("test") ? 1500 : 3400);
  }
  const achievementToast = (a) => `${icon(achIcon(a))}<span class="meta-toast-text"><small>Achievement earned</small><strong>${esc(a.title)}</strong></span>`;

  // ---------- earning: the campaign's live in its progress (src/campaign.js saves them), the rest in the record ----------
  // `known` is what was already shown as earned; earn() returns (and toasts) what is new since.
  const doneIds = () => new Set(all().filter((a) => a.done).map((a) => a.id));
  let known = new Set();
  function earn(toastNow = true) {
    record = recordMoreAchievements(progress(), record, S.defenceProgress || loadDefence()).record;
    syncMeta();
    saveRecord(record);
    const now = doneIds(), list = all().filter((a) => now.has(a.id) && !known.has(a.id));
    known = now;
    if (toastNow) for (const a of list) showToast(achievementToast(a));
    renderTile();
    return list;
  }

  // ---------- one finished match ----------
  function matchContext(summary) {
    const sim = S.sim, stats = { ...(S.matchStats?.stats || {}), ...(summary?.stats || {}) };
    const def = sim.missionDef, hero = sim.defence?.hero;
    const level = hero ? (hero.rank || 1) + (hero.branch ? hero.branchRank || 0 : 0) : 0;
    return {
      mode: summary?.mode || S.playMode, win: !!summary?.win, scored: Number.isFinite(summary?.score), score: summary?.score ?? null,
      seconds: summary?.seconds ?? sim.time, enemyCount: sim.enemyCount, aiSpeed: sim.aiSpeed, difficulty: summary?.difficulty || sim.difficulty,
      rivals: Object.entries(sim.factions || {}).filter(([team]) => Number(team) > 0).map(([, id]) => id), player: playerFactionOf(sim),
      medal: summary?.medal ?? null, stars: summary?.stars ?? null, variant: summary?.variant ?? null,
      optional: (def?.objectives || []).filter((o) => o.optional && sim.mission?.objectives?.[o.id]?.state === "done").length,
      stats, hero: hero ? { level, branch: hero.branch || null } : null, map: sim.terrain?.id, mission: def?.id ?? null,
    };
  }
  let last = null;
  function matchEnded(summary) {
    if (S.replay || summary?.mode === "training") return;
    const ctx = matchContext(summary);
    record = addMatch(record, ctx);
    // Defence stars were just saved by the Defence result (app/defence/result.js): read them again.
    if (ctx.mode === "defence") S.defenceProgress = loadDefence();
    const earned = earn(false);
    last = { ctx, earned: earned.map((a) => a.id) };
    resultsRow(summary?.root, earned);
    for (const a of earned) showToast(achievementToast(a));
  }
  // A row on the results screen: what this match earned (nothing when nothing was).
  function resultsRow(root, earned) {
    if (!root?.isConnected || !earned.length) return;
    root.querySelector(".meta-earned")?.remove();
    const row = Object.assign(document.createElement("section"), { className: "meta-earned" });
    row.setAttribute("aria-label", "Achievements earned");
    row.innerHTML = `<span class="meta-earned-head">${icon("star")}<span>Achievements earned</span></span><ul>${earned.map((a) => `<li>${icon(achIcon(a))}<span>${esc(a.title)}</span></li>`).join("")}</ul>`;
    const actions = root.querySelector(".result-actions, .debrief-actions");
    if (actions) actions.before(row); else root.append(row);
  }

  // ---------- live: what the match already counts (a dive, a tamed Wyrm, a commander rank) ----------
  function liveCheck() {
    if (!Z.started || Z.paused || S.sim?.result || S.replay || S.playMode === "training" || S.tutorial) return;
    const ctx = matchContext({ mode: S.activeStage !== null ? "campaign" : S.sim.defence ? "defence" : S.playMode, win: false });
    const live = addMatch(record, ctx, { live: true });
    const reached = recordMoreAchievements(progress(), live, S.defenceProgress || loadDefence()).added;
    if (!reached.length) return;
    // Only the earned ids are kept now; the match's counters are added once, when it ends.
    record = { ...record, earned: [...new Set([...record.earned, ...reached])] };
    earn();
  }

  // ---------- the Records tile (in the title's quick row) ----------
  function renderTile() {
    const slot = $("title-actions");
    if (!slot) return;
    let tile = $("records-open");
    if (!tile) {
      tile = Object.assign(document.createElement("button"), { type: "button", id: "records-open", className: "quick-battle records-tile" });
      tile.addEventListener("click", () => openRecords());
      slot.append(tile);
    }
    const list = all(), done = list.filter((a) => a.done).length;
    tile.title = "Achievements, daily challenges and match history";
    tile.innerHTML = `${icon("star")}<span class="quick-text"><strong>Records</strong><small translate="no" aria-label="${done} / ${list.length}">★ ${done} / ${list.length}</small></span>`;
  }

  // ---------- the Records screen: a dialog over the title, like the field guide ----------
  let dialog = null, previous = null;
  function achievementsHTML() {
    const list = all(), done = list.filter((a) => a.done).length;
    const card = (a) => `<li class="meta-ach ${a.done ? "done" : "todo"}" data-ach="${a.id}">${icon(achIcon(a))}<span class="meta-ach-text"><strong>${esc(a.title)}</strong><small>${esc(a.how)}</small></span>${a.done ? `<b class="meta-ach-done">${icon("check")}</b>` : `<span class="meta-ach-progress"><span class="meta-bar" aria-hidden="true"><i style="width:${Math.round((a.have / a.need) * 100)}%"></i></span><small translate="no">${a.have} / ${a.need}</small></span>`}</li>`;
    const groups = ["campaign", "skirmish", "defence", "kite", "wild"].map((g) => {
      const items = list.filter((a) => a.group === g);
      return items.length ? `<h4 class="meta-group">${GROUP_LABELS[g]}</h4><ul class="meta-ach-list">${items.map(card).join("")}</ul>` : "";
    }).join("");
    return `<section class="meta-section" aria-labelledby="records-ach"><h3 id="records-ach">${icon("star")}<span>Achievements</span> <b translate="no">${done} / ${list.length}</b></h3>${groups}</section>`;
  }
  function recordsHTML() {
    return `<header class="records-head"><h2 id="records-title">Service record</h2><button type="button" class="kit-face records-close" data-records-close aria-label="Close records">${icon("close")}<span>Close</span></button></header>
      <div class="records-body">${achievementsHTML()}</div>`;
  }
  function openRecords() {
    if (Z.started && !S.sim.result) return;
    if (!dialog) {
      dialog = Object.assign(document.createElement("dialog"), { id: "records", className: "records-sheet" });
      dialog.setAttribute("aria-labelledby", "records-title");
      document.body.append(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target.closest("[data-records-close]") || event.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => { Z.restore(previous); S.keys?.clear?.(); $("records-open")?.focus({ preventScroll: true }); });
    }
    if (dialog.open) return;
    syncMeta();
    dialog.innerHTML = recordsHTML();
    previous = Z.snapshot();
    Z.open("guide");
    dialog.showModal();
    dialog.querySelector("[data-records-close]").focus({ preventScroll: true });
  }

  function info() {
    const list = all();
    return { record: structuredClone(record), achievements: list.map((a) => ({ id: a.id, done: a.done, have: a.have, need: a.need })), done: list.filter((a) => a.done).length, total: ACHIEVEMENTS.length, last, toast: toast && !toast.hidden ? toast.textContent : null };
  }

  Object.assign(A, { metaInfo: info, openRecords, metaToast: showToast });
  // Browser tests (window.__frontier.meta): the state, and the same paths a tap or a match end takes.
  A.metaHooks = { info, openRecords, closeRecords: () => dialog?.open && dialog.close(), matchEnded, earn, liveCheck, get record() { return record; }, set record(r) { record = r; saveRecord(r); earn(false); } };
  return function bind() {
    // Achievements reached by older play (before W6) are remembered quietly, without a toast.
    earn(false);
    onMatchEnd(matchEnded);
    setInterval(liveCheck, 1000);
  };
}
