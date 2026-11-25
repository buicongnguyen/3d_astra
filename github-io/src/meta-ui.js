// Replay value on the page (W6, docs/aaa/ROADMAP_TO_AAA_2026-11-25.md): the service record and the
// achievements (src/meta/record.js, src/story/achievements.js) with their toast, the "Records" tile on the
// title and the Records screen, the daily challenges (src/meta/challenges.js) as three tiles on the title, and
// the medal cosmetics (src/meta/rewards.js): unlocked here, picked beside the rank items in the Skirmish setup,
// and the match history (src/meta/history.js): the last 20 finished matches, listed in the Records screen, the
// last REPLAY_CAP with a replay (src/meta/replay.js) watched in src/replay-ui.js.
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
import { CHALLENGE_XP, dailyChallenges, loadChallenges, saveChallenges, judgeChallenges } from "./meta/challenges.js";
import { localDay } from "./profile-rank.js";
import { MEDAL_ITEMS, MEDAL_KINDS, rewardOpen, newRewards } from "./meta/rewards.js";
import { emblemSvg } from "./rank-ui.js";
import { loadHistory, saveHistory, addHistory, HISTORY_CAP, loadReplays, storeReplay } from "./meta/history.js";
import { recordReplay, replayProblem, optionsOf } from "./meta/replay.js";
import { APP_VERSION } from "./replay-ui.js";
import { missionById } from "./campaign.js";
import { defenceLevel } from "./defence/levels.js";
import { MAPS } from "./terrain.js";
import { PLAYER_FACTIONS } from "./factions.js";
import { formatClock } from "./results-ui.js";
import { getLanguage, loadStory } from "./i18n.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The campaign's thirteen carry no icon of their own (story/achievements.js); these suit them.
const CAMPAIGN_ICONS = { "first-light": "flag", "act-1": "map", "act-2": "map", "act-3": "map", "gold-5": "star", "veteran-5": "shield", decider: "objectives", mercy: "linkshield", "no-quarter": "crosshair", "both-endings": "objectives", "squad-6": "people", "extras-10": "check", chronicler: "logo" };
const achIcon = (a) => CAMPAIGN_ICONS[a.id] || a.icon || "star";
const KIND_NAMES = { paint: "Paint", emblem: "Emblem", banner: "Title banner" };
// A reward's picture: its swatch, its emblem, or a banner flag.
const rewardArt = (r) => (r.kind === "paint" ? `<i class="meta-swatch" style="--swatch:${r.swatch}" aria-hidden="true"></i>` : r.kind === "emblem" ? emblemSvg(r.id) : icon("flag"));
const MODE_LABELS = { skirmish: "Skirmish", campaign: "Campaign", defence: "Defence", training: "Training" };
const RESULT_LABELS = { victory: "Victory", defeat: "Defeat", score: "Score" };
const factionName = (id) => (PLAYER_FACTIONS[id] || id || "").replace(/^The /, "").split(" ")[0];
// What a history row is called: its mission or Defence level, else its map.
function matchTitle(e) {
  const m = e.mission && (missionById(e.mission)?.mission || defenceLevel(e.mission));
  return m?.title || (MAPS[e.map] || e.map || "").split(" · ")[0];
}
// The Records screen's direct jumps to its sections (no menu: every section is also on the page).
const JUMPS = [["records-challenges", "Challenges", "objectives"], ["records-history", "History", "queue"], ["records-ach", "Achievements", "star"], ["records-rewards", "Rewards", "flag"]];
const GROUP_LABELS = { campaign: "Campaign", skirmish: "Skirmish", defence: "Defence", kite: "Kite scouts", wild: "Wild frontier" };

export function setupMeta(S, A) {
  const Z = S.screen;
  let record = loadRecord();
  // The Defence progress, read from storage at most once a visit unless the Defence screens hold it (S.defenceProgress).
  let defenceCache = null;
  const defenceSeen = () => (defenceCache ??= loadDefence());
  const extra = () => ({ record, defence: S.defenceProgress || defenceSeen() });
  const progress = () => S.campaign || loadProgress();
  const all = () => achievementsFor(progress(), extra());

  // The daily challenges: today's three and what is done (the date is read on the page, never by a match;
  // browser tests may pin it with ?day=YYYY-MM-DD).
  const today = () => (/^\d{4}-\d{2}-\d{2}$/.test(S.query?.get?.("day") || "") ? S.query.get("day") : localDay());
  let challenges = loadChallenges(today());
  let history = loadHistory(), replays = {};

  // ---------- the summary the medal cosmetics read (src/meta/rewards.js) ----------
  function syncMeta() {
    const p = progress(), list = all();
    record = { ...record, meta: { ...record.meta, ach: list.filter((a) => a.done).length, gold: goldCount(p), goldActs: goldActs(p), sets: challenges.sets } };
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
  const challengeToast = (c) => `${icon(c.icon)}<span class="meta-toast-text"><small>Challenge complete · +${CHALLENGE_XP} XP</small><strong>${esc(c.title)}</strong></span>`;
  const rewardToast = (r) => `${rewardArt(r)}<span class="meta-toast-text"><small>Reward unlocked</small><strong>${esc(KIND_NAMES[r.kind])} · ${esc(r.label)}</strong></span>`;
  const achievementToast = (a) => `${icon(achIcon(a))}<span class="meta-toast-text"><small>Achievement earned</small><strong>${esc(a.title)}</strong></span>`;

  // ---------- earning: the campaign's live in its progress (src/campaign.js saves them), the rest in the record ----------
  // `known` is what was already shown as earned; earn() returns (and toasts) what is new since.
  const doneIds = () => new Set(all().filter((a) => a.done).map((a) => a.id));
  let known = new Set();
  // `unlocked` holds the medal cosmetics the last earn() opened (achievements and challenge days unlock them).
  let unlocked = [];
  function earn(toastNow = true) {
    const metaBefore = record.meta;
    record = recordMoreAchievements(progress(), record, S.defenceProgress || defenceSeen()).record;
    syncMeta();
    saveRecord(record);
    const now = doneIds(), list = all().filter((a) => now.has(a.id) && !known.has(a.id));
    known = now;
    unlocked = newRewards(metaBefore, record.meta);
    if (toastNow) { for (const a of list) showToast(achievementToast(a)); for (const r of unlocked) showToast(rewardToast(r), "reward"); }
    // The Skirmish setup's pickers show a newly opened reward at once.
    if (unlocked.length) A.rankRender?.();
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
    if (ctx.mode === "defence") S.defenceProgress = defenceCache = loadDefence();
    // Today's challenges: each met one pays Commander XP once (rank-ui.js), all three make a challenge day.
    const day = today(), judged = judgeChallenges(challenges, ctx, day);
    challenges = judged.state;
    if (judged.met.length) saveChallenges(challenges);
    const award = judged.xp ? A.rankAward?.(judged.xp) : null;
    const earned = earn(false);
    // The match history: newest first, at most HISTORY_CAP (src/meta/history.js).
    const at = Date.now(), entry = { id: `${at.toString(36)}${(history.length % 36).toString(36)}`, at, mode: ctx.mode, map: ctx.map || "", mission: ctx.mission, player: ctx.player, rivals: [...new Set(ctx.rivals)],
      result: ctx.scored ? "score" : ctx.win ? "victory" : "defeat", seconds: ctx.seconds, difficulty: ctx.difficulty, aiSpeed: ctx.aiSpeed, enemyCount: ctx.enemyCount, medal: ctx.medal, stars: ctx.stars, score: ctx.score,
      stats: { killed: ctx.stats.killed, lost: ctx.stats.lost, trained: ctx.stats.trained, built: ctx.stats.built, alloy: ctx.stats.alloy, energy: ctx.stats.energy } };
    // Its replay: a match built at tick 0 in this visit (not a loaded save) with its options remembered.
    const replay = !S.tutorial && optionsOf(S.sim) ? recordReplay(S.sim, { app: APP_VERSION, at }) : null;
    if (replay && storeReplay(entry.id, replay)) entry.replay = true;
    history = addHistory(history, entry);
    saveHistory(history);
    last = { ctx, earned: earned.map((a) => a.id), challenges: judged.met.map((c) => c.id), xp: judged.xp, set: judged.set, rankUp: !!award?.rankUp, rewards: unlocked.map((r) => `${r.kind}:${r.id}`) };
    resultsRow(summary?.root, earned, judged, unlocked);
    for (const c of judged.met) showToast(challengeToast(c), "challenge");
    for (const a of earned) showToast(achievementToast(a));
    for (const r of unlocked) showToast(rewardToast(r), "reward");
    renderChallenges();
  }
  // Rows on the results screen: the challenges met and the achievements earned by this match (none: no row).
  function resultsRow(root, earned, judged = { met: [] }, rewards = []) {
    if (!root?.isConnected) return;
    root.querySelectorAll(".meta-earned").forEach((el) => el.remove());
    const rows = [];
    if (judged.met.length) rows.push(["meta-earned meta-earned-challenges", "Challenges complete", "check", judged.met.map((c) => `<li>${icon(c.icon)}<span>${esc(c.title)}</span> <b>+${CHALLENGE_XP} XP</b></li>`).join("") + (judged.set ? `<li class="meta-set">${icon("star")}<span>Challenge day complete</span></li>` : "")]);
    if (earned.length) rows.push(["meta-earned", "Achievements earned", "star", earned.map((a) => `<li>${icon(achIcon(a))}<span>${esc(a.title)}</span></li>`).join("")]);
    if (rewards.length) rows.push(["meta-earned meta-earned-rewards", "Rewards unlocked", "flag", rewards.map((r) => `<li>${rewardArt(r)}<span>${esc(KIND_NAMES[r.kind])} · ${esc(r.label)}</span></li>`).join("") + `<li class="meta-hint"><span>Pick it in the Skirmish setup.</span></li>`]);
    const actions = root.querySelector(".result-actions, .debrief-actions");
    for (const [cls, head, ic, items] of rows) {
      const row = Object.assign(document.createElement("section"), { className: cls });
      row.setAttribute("aria-label", head);
      row.innerHTML = `<span class="meta-earned-head">${icon(ic)}<span>${head}</span></span><ul>${items}</ul>`;
      if (actions) actions.before(row); else root.append(row);
    }
  }

  // ---------- live: what the match already counts (a dive, a tamed Wyrm, a commander rank) ----------
  function liveCheck() {
    if (!Z.started || Z.paused || S.sim?.result || S.replay || S.playMode === "training" || S.tutorial) return;
    const ctx = matchContext({ mode: S.activeStage !== null ? "campaign" : S.sim.defence ? "defence" : S.playMode, win: false });
    const live = addMatch(record, ctx, { live: true });
    const reached = recordMoreAchievements(progress(), live, S.defenceProgress || defenceSeen()).added;
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
    tile.dataset.matches = String(history.length);
    tile.title = "Achievements, daily challenges and match history";
    tile.innerHTML = `${icon("star")}<span class="quick-text"><strong>Records</strong><small translate="no">★ ${done} / ${list.length} · ✓ ${challenges.done.length} / 3</small></span>`;
  }

  // ---------- today's challenges: three direct tiles under the quick row (a tap picks the mode) ----------
  function challengeTile(c, done) {
    return `<button type="button" class="kit-face challenge-tile${done ? " done" : ""}" data-challenge="${c.id}" data-challenge-mode="${c.mode}">${icon(done ? "check" : c.icon)}<span class="challenge-text"><strong>${esc(c.title)}</strong><small>${esc(c.goal)}</small></span><b class="challenge-reward">${done ? "Done" : `+${CHALLENGE_XP} XP`}</b></button>`;
  }
  function renderChallenges() {
    const day = today();
    if (challenges.day !== day) challenges = loadChallenges(day);
    const slot = $("title-actions");
    if (!slot) return;
    let strip = $("daily-challenges");
    if (!strip) {
      strip = Object.assign(document.createElement("section"), { id: "daily-challenges", className: "daily-challenges" });
      strip.setAttribute("aria-labelledby", "daily-challenges-title");
      slot.after(strip);
      strip.addEventListener("click", (event) => {
        const tile = event.target.closest("[data-challenge-mode]");
        if (!tile || Z.started) return;
        // One tap: the mode the challenge is played in (the mode row's own button, so everything follows it).
        document.querySelector(`#briefing .mode-switch [data-mode="${tile.dataset.challengeMode}"]`)?.click();
      });
    }
    const list = dailyChallenges(challenges.day);
    strip.innerHTML = `<h3 id="daily-challenges-title" class="challenges-head">${icon("objectives")}<span>Daily challenges</span><b translate="no">${challenges.done.length} / ${list.length}</b></h3><div class="challenge-tiles">${list.map((c) => challengeTile(c, challenges.done.includes(c.id))).join("")}</div>`;
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
  function recordsChallengesHTML() {
    const list = dailyChallenges(challenges.day), done = (c) => challenges.done.includes(c.id);
    const row = (c) => `<li class="meta-ach ${done(c) ? "done" : "todo"}" data-challenge="${c.id}">${icon(c.icon)}<span class="meta-ach-text"><strong>${esc(c.title)}</strong><small>${esc(c.goal)}</small></span>${done(c) ? `<b class="meta-ach-done">${icon("check")}</b>` : `<b class="challenge-reward">+${CHALLENGE_XP} XP</b>`}</li>`;
    return `<section class="meta-section" aria-labelledby="records-challenges"><h3 id="records-challenges">${icon("objectives")}<span>Daily challenges</span> <b translate="no">${challenges.done.length} / ${list.length}</b></h3>
      <p class="meta-note"><span>New goals every day. Each pays Commander XP once; all three make a challenge day, which unlocks rewards.</span> <span>Challenge days:</span> <b translate="no">${challenges.sets}</b></p><ul class="meta-ach-list">${list.map(row).join("")}</ul></section>`;
  }
  // Medal cosmetics: every one with what unlocks it; picking is one tap in the Skirmish setup's Commander rows.
  function rewardsHTML() {
    const items = MEDAL_KINDS.flatMap((kind) => MEDAL_ITEMS[kind].map((i) => ({ kind, ...i })));
    const open = items.filter((i) => rewardOpen(i, record.meta));
    const row = (i) => { const on = rewardOpen(i, record.meta); return `<li class="meta-ach meta-reward ${on ? "done" : "todo"}" data-reward="${i.kind}:${i.id}">${rewardArt(i)}<span class="meta-ach-text"><strong>${esc(KIND_NAMES[i.kind])} · ${esc(i.label)}</strong><small>${esc(i.how)}</small></span>${on ? `<b class="meta-ach-done">${icon("check")}</b>` : `<b class="meta-lock">${icon("lock")}</b>`}</li>`; };
    return `<section class="meta-section" aria-labelledby="records-rewards"><h3 id="records-rewards">${icon("flag")}<span>Medal rewards</span> <b translate="no">${open.length} / ${items.length}</b></h3>
      <p class="meta-note">Paint, emblems and title banners earned with medals, achievements and challenge days. Looks only: they never change a battle. Pick them in the Skirmish setup.</p><ul class="meta-ach-list">${items.map(row).join("")}</ul></section>`;
  }
  // A row's replay: a Watch button, or why it cannot be watched (another version recorded it).
  function watchHTML(e) {
    const r = e.replay ? replays[e.id] : null;
    if (!r) return "";
    const problem = replayProblem(r, APP_VERSION);
    return problem ? `<small class="meta-replay-note">${esc(problem)}</small>` : `<button type="button" class="kit-face meta-watch" data-watch="${esc(e.id)}" aria-label="Watch replay">${icon("play")}<span>Watch</span></button>`;
  }
  // The last matches, newest first: result, what was played, sides, time and the key numbers.
  function historyHTML() {
    const row = (e) => {
      const sides = e.mode === "skirmish" ? `<span>${esc(factionName(e.player))}</span> <span translate="no">vs</span> <span>${e.rivals.map((r) => esc(factionName(r))).join(" · ")}</span>` : "";
      const extra = e.result === "score" ? `<span class="meta-stat"><b translate="no">${e.score ?? 0}</b> <span>Waves held</span></span>` : e.medal ? `<span class="meta-stat meta-medal-${e.medal}"><span>${{ bronze: "Bronze medal", silver: "Silver medal", gold: "Gold medal" }[e.medal]}</span></span>` : Number.isInteger(e.stars) ? `<span class="meta-stat" translate="no">${"★".repeat(e.stars)}${"☆".repeat(Math.max(0, 3 - e.stars))}</span>` : "";
      const when = new Date(e.at), date = Number.isFinite(when.getTime()) ? when.toLocaleString(document.documentElement.lang || undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
      return `<li class="meta-match ${e.result}" data-match="${esc(e.id)}">
        <span class="meta-result">${icon(e.result === "defeat" ? "close" : e.result === "score" ? "chevrons" : "check")}<span>${RESULT_LABELS[e.result]}</span></span>
        <span class="meta-match-main"><strong>${esc(matchTitle(e))}</strong><small><span>${MODE_LABELS[e.mode]}</span>${sides ? ` · ${sides}` : ""}</small><small class="meta-when" translate="no">${esc(date)} · ${formatClock(e.seconds)}</small></span>
        <span class="meta-match-stats"><span class="meta-stat"><b translate="no">${Math.round(e.stats.killed)}</b> <span>Kills</span></span><span class="meta-stat"><b translate="no">${Math.round(e.stats.lost)}</b> <span>Units lost</span></span>${extra}</span>${watchHTML(e)}</li>`;
    };
    return `<section class="meta-section" id="records-history-section" aria-labelledby="records-history"><h3 id="records-history">${icon("queue")}<span>Match history</span> <b translate="no">${history.length} / ${HISTORY_CAP}</b></h3>
      ${history.length ? `<ol class="meta-history">${history.map(row).join("")}</ol>` : `<p class="meta-note">No matches yet. Finished matches appear here, the last 20 kept.</p>`}</section>`;
  }
  function recordsHTML() {
    return `<header class="records-head"><h2 id="records-title">Service record</h2><button type="button" class="kit-face records-close" data-records-close aria-label="Close records">${icon("close")}<span>Close</span></button></header>
      <nav class="records-jump" aria-label="Records sections">${JUMPS.map(([id, label, ic]) => `<button type="button" class="kit-face" data-records-jump="${id}">${icon(ic)}<span>${label}</span></button>`).join("")}</nav>
      <div class="records-body">${recordsChallengesHTML()}${historyHTML()}${achievementsHTML()}${rewardsHTML()}</div>`;
  }
  // One tap on Watch: the Records screen closes and the replay plays (src/replay-ui.js).
  async function watchReplay(id) {
    const replay = replays[id] || loadReplays()[id], entry = history.find((e) => e.id === id) || null;
    const problem = replay ? replayProblem(replay, APP_VERSION) : "This replay is no longer stored.";
    if (problem) { showToast(`${icon("close")}<span class="meta-toast-text"><strong>${esc(problem)}</strong></span>`, "error"); return problem; }
    // The dialog's close event puts the title's screen state back: let it run before the replay starts.
    if (dialog?.open) await new Promise((done) => { dialog.addEventListener("close", done, { once: true }); dialog.close(); });
    const error = await A.watchReplay?.(replay, entry);
    if (error) showToast(`${icon("close")}<span class="meta-toast-text"><strong>${esc(error)}</strong></span>`, "error");
    return error || null;
  }
  function openRecords() {
    if (Z.started && !S.sim.result) return;
    if (!dialog) {
      dialog = Object.assign(document.createElement("dialog"), { id: "records", className: "records-sheet" });
      dialog.setAttribute("aria-labelledby", "records-title");
      document.body.append(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target.closest("[data-records-close]") || event.target === dialog) { dialog.close(); return; }
        const watchButton = event.target.closest("[data-watch]");
        if (watchButton) { watchReplay(watchButton.dataset.watch); return; }
        const jump = event.target.closest("[data-records-jump]");
        if (jump) dialog.querySelector(`#${jump.dataset.recordsJump}`)?.scrollIntoView({ block: "start", behavior: document.documentElement.classList.contains("motion-off") ? "auto" : "smooth" });
      });
      dialog.addEventListener("close", () => { Z.restore(previous); S.keys?.clear?.(); $("records-open")?.focus({ preventScroll: true }); });
    }
    if (dialog.open) return;
    syncMeta();
    history = loadHistory();
    replays = loadReplays();
    dialog.innerHTML = recordsHTML();
    // Mission titles are story text: their catalog loads on first use; the screen redraws when it arrives.
    if (getLanguage() !== "en") loadStory().then(() => { if (dialog.open) { const top = dialog.querySelector(".records-body")?.scrollTop || 0; dialog.innerHTML = recordsHTML(); dialog.querySelector(".records-body").scrollTop = top; } }).catch(() => {});
    previous = Z.snapshot();
    Z.open("guide");
    dialog.showModal();
    dialog.querySelector("[data-records-close]").focus({ preventScroll: true });
  }

  function info() {
    const list = all();
    return { replay: S.replay ? { status: S.replay.status, paused: S.replay.paused, speed: S.replay.speed, ticks: S.sim.ticks, total: S.replay.replay.ticks, follow: S.replay.follow ? { on: S.replay.follow.on, target: S.replay.follow.target && { x: S.replay.follow.target.x, z: S.replay.follow.target.z } } : null } : null, replays: Object.keys(loadReplays()), history: history.map((e) => ({ ...e })), challenges: { ...challenges, today: dailyChallenges(challenges.day).map((c) => c.id) }, record: structuredClone(record), achievements: list.map((a) => ({ id: a.id, done: a.done, have: a.have, need: a.need })), done: list.filter((a) => a.done).length, total: ACHIEVEMENTS.length, last, toast: toast && !toast.hidden ? toast.textContent : null };
  }

  Object.assign(A, { metaInfo: info, openRecords, metaToast: showToast });
  // Browser tests (window.__frontier.meta): the state, and the same paths a tap or a match end takes.
  A.metaHooks = { info, openRecords, closeRecords: () => dialog?.open && dialog.close(), matchEnded, earn, liveCheck, get record() { return record; }, set record(r) { record = r; saveRecord(r); earn(false); }, renderChallenges, watchReplay, toMenu: () => A.newGame(),
    // Ends the match here as if it had finished (browser tests: a real end takes minutes); returns the history entry.
    recordNow() { const at = Date.now(), id = `t${at.toString(36)}`, replay = optionsOf(S.sim) ? recordReplay(S.sim, { app: APP_VERSION, at }) : null; const stored = !!(replay && storeReplay(id, replay)); history = addHistory(history, { id, at, mode: S.playMode, map: S.sim.terrain.id, mission: S.sim.missionDef?.id ?? null, player: playerFactionOf(S.sim), rivals: [], result: "defeat", seconds: S.sim.time, stats: {}, ...(stored ? { replay: true } : {}) }); saveHistory(history); return { id, stored, ticks: replay?.ticks ?? null, hash: replay?.hash ?? null }; } };
  return function bind() {
    // Achievements reached by older play (before W6) are remembered quietly, without a toast.
    earn(false);
    renderChallenges();
    onMatchEnd(matchEnded);
    setInterval(liveCheck, 1000);
  };
}
