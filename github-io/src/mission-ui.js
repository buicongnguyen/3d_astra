// Story mission interface: the briefing overlay, the in-match dialogue box with its Comms log,
// the mission objectives list and the debrief. It only shows what the mission engine emits
// (src/sim/missions.js); it never changes the match. Story text is written into the page as
// plain text nodes, so the page localiser (i18n.js) translates it once the catalog has it.
import "./mission-ui.css";
import { icon } from "./icons.js";
import { castPortrait, castName, castRole } from "./cast-portraits.js";
import { statTile, matchStatTiles } from "./results-ui.js";
import { clock, pointLabel, objectiveProgress, DialogueQueue } from "./mission-text.js";

export { clock, pointLabel };

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const two = (n) => String(n).padStart(2, "0");

const MEDAL_COLOURS = { gold: ["#fff1b8", "#ffc75e", "#b96d12"], silver: ["#ffffff", "#cfd9df", "#7d8c96"], bronze: ["#ffd9b0", "#e39a5c", "#8a4a1c"] };
export const MEDAL_NAMES = { gold: "Gold medal", silver: "Silver medal", bronze: "Bronze medal" };
// A medal badge: ribbon and disc in the medal's metal, drawn so it reads at 20 px and 88 px.
export function medalBadge(medal, extra = "") {
  const c = MEDAL_COLOURS[medal];
  if (!c) return "";
  return `<svg class="medal-badge ${medal}${extra ? ` ${extra}` : ""}" viewBox="0 0 48 56" role="img" aria-label="${MEDAL_NAMES[medal]}"><path d="M13 2h9l5 20h-9Z" fill="#2f8f86"/><path d="M35 2h-9l-5 20h9Z" fill="#3fb3a6"/><circle cx="24" cy="35" r="18" fill="${c[2]}"/><circle cx="24" cy="34" r="16" fill="${c[1]}"/><circle cx="24" cy="34" r="11.5" fill="none" stroke="${c[0]}" stroke-width="2"/><path d="m24 25 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6-4.5-4.2 6.1-.8Z" fill="${c[0]}"/></svg>`;
}

export function createMissionUI({ stage, objectivesPanel, tone = () => {}, onLayout = () => {} }) {
  // ---------------------------------------------------------------- Briefing overlay
  const overlay = document.createElement("section");
  overlay.id = "mission-briefing";
  overlay.className = "mission-briefing";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "mb-title");
  overlay.innerHTML = `<div class="mb-card">
    <header class="mb-head"><span class="eyebrow" id="mb-place"></span><h2 id="mb-title"><small id="mb-number"></small><span id="mb-name"></span></h2></header>
    <div class="mb-body" id="mb-body">
      <div class="mb-speech" id="mb-speech"><div id="mb-portrait"></div><div class="mb-words"><div class="mb-who"><strong id="mb-speaker"></strong><span id="mb-role"></span></div><p id="mb-line" aria-live="polite"></p></div></div>
      <div class="mb-orders" id="mb-orders" hidden><section><h3>Intel</h3><ul id="mb-intel"></ul></section><section><h3>Objectives</h3><ol id="mb-objectives"></ol></section></div>
    </div>
    <footer class="mb-foot"><button class="secondary" id="mb-back">Back</button><span class="mb-step" id="mb-step" aria-hidden="true"></span><button class="secondary" id="mb-skip">Skip</button><button class="primary" id="mb-next">Next</button></footer>
  </div>`;
  document.querySelector("#app").append(overlay);
  const q = (id) => overlay.querySelector(`#${id}`);
  let brief = null, briefReturn = null;
  const behind = () => [document.querySelector("main"), document.querySelector(".topbar"), document.querySelector("#modal")];
  function renderBrief() {
    const { mission, step } = brief, lines = mission.briefing.lines, last = step >= lines.length;
    q("mb-speech").hidden = last;
    q("mb-orders").hidden = !last;
    q("mb-skip").hidden = last;
    q("mb-step").textContent = last ? "" : `${step + 1} / ${lines.length}`;
    q("mb-next").innerHTML = last ? `<span>Begin mission</span>${icon("arrow")}` : "<span>Next</span>";
    overlay.classList.toggle("orders", last);
    if (!last) {
      const line = lines[step];
      if (q("mb-portrait").dataset.who !== line.who) {
        q("mb-portrait").dataset.who = line.who;
        q("mb-portrait").innerHTML = castPortrait(line.who, "large");
        q("mb-speaker").textContent = castName(line.who);
        q("mb-role").textContent = castRole(line.who);
      }
      q("mb-line").textContent = line.text;
    }
    q("mb-body").scrollTop = 0;
  }
  function advance() {
    if (!brief) return;
    if (brief.step >= brief.mission.briefing.lines.length) { const begin = brief.onBegin; closeBriefing(false); begin?.(); return; }
    brief.step++;
    renderBrief();
    q("mb-next").focus({ preventScroll: true });
  }
  function skip() {
    if (!brief) return;
    brief.step = brief.mission.briefing.lines.length;
    renderBrief();
    q("mb-next").focus({ preventScroll: true });
  }
  function back() {
    if (!brief) return;
    const done = brief.onBack;
    closeBriefing(true);
    done?.();
  }
  function openBriefing(mission, index, { onBegin, onBack } = {}) {
    briefReturn = document.activeElement;
    brief = { mission, step: 0, onBegin, onBack };
    q("mb-place").textContent = mission.briefing.place || "";
    q("mb-number").textContent = `MISSION ${two(index + 1)}`;
    q("mb-name").textContent = mission.title;
    q("mb-portrait").dataset.who = "";
    q("mb-intel").innerHTML = (mission.briefing.intel || []).map((text) => `<li>${esc(text)}</li>`).join("");
    q("mb-objectives").innerHTML = mission.objectives.filter((o) => !o.hidden)
      .map((o) => `<li${o.optional ? ' class="optional"' : ""}><span>${esc(o.text)}</span>${o.optional ? "<em>Optional</em>" : ""}</li>`).join("");
    for (const node of behind()) if (node) node.inert = true;
    overlay.hidden = false;
    document.documentElement.classList.add("mission-briefing-open");
    renderBrief();
    q("mb-next").focus({ preventScroll: true });
  }
  function closeBriefing(restoreFocus = true) {
    if (!brief) return;
    brief = null;
    overlay.hidden = true;
    document.documentElement.classList.remove("mission-briefing-open");
    for (const node of behind()) if (node) node.inert = false;
    const target = briefReturn;
    briefReturn = null;
    if (restoreFocus && target?.isConnected && !target.disabled) target.focus?.({ preventScroll: true });
  }
  q("mb-next").onclick = advance;
  q("mb-skip").onclick = skip;
  q("mb-back").onclick = back;
  // A tap or click on the text advances, like Next.
  q("mb-body").addEventListener("click", (event) => {
    if (brief && brief.step < brief.mission.briefing.lines.length && !event.target.closest("button, a")) advance();
  });
  // The overlay owns the keyboard while it is open, wherever focus is: Enter and Space advance,
  // Escape goes back, Tab stays inside, and no game shortcut fires behind it.
  window.addEventListener("keydown", (event) => {
    if (!brief) return;
    event.stopPropagation();
    const onButton = event.target instanceof Element && overlay.contains(event.target) && event.target.closest("button");
    if (event.key === "Escape") { event.preventDefault(); back(); return; }
    if (event.key === "Enter" || event.key === " ") {
      // A focused button activates natively; anywhere else the key advances.
      if (!onButton) { event.preventDefault(); if (!event.repeat) advance(); }
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...overlay.querySelectorAll("button:not([disabled])")].filter((b) => !b.hidden);
    const first = items[0], last = items[items.length - 1];
    if (!overlay.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);

  // ---------------------------------------------------------------- Dialogue box and Comms log
  const queue = new DialogueQueue();
  const box = document.createElement("div");
  box.id = "dialogue";
  box.className = "dialogue";
  box.hidden = true;
  box.setAttribute("aria-live", "polite");
  box.setAttribute("aria-atomic", "true");
  box.innerHTML = `<div class="dialogue-card" id="dialogue-card"><div id="dialogue-portrait"></div><div class="dialogue-words"><strong id="dialogue-name"></strong><p id="dialogue-text"></p><small id="dialogue-more" hidden></small></div><button id="dialogue-close" aria-label="Dismiss message" title="Dismiss message">${icon("close")}</button></div>`;
  stage.append(box);
  const d = (id) => box.querySelector(`#${id}`);
  // Toasts move below the box while a line is up (see .dialogue-open in mission-ui.css). The
  // observer fires only when the card changes size, never per frame.
  const root = document.documentElement;
  new ResizeObserver(() => { if (!box.hidden) root.style.setProperty("--dialogue-h", `${d("dialogue-card").offsetHeight}px`); }).observe(d("dialogue-card"));
  function renderLine() {
    const line = queue.current;
    box.hidden = !line;
    root.classList.toggle("dialogue-open", !!line);
    if (!line) return;
    if (d("dialogue-portrait").dataset.who !== line.who) {
      d("dialogue-portrait").dataset.who = line.who;
      d("dialogue-portrait").innerHTML = castPortrait(line.who);
      d("dialogue-name").textContent = castName(line.who);
    }
    d("dialogue-text").textContent = line.text;
    renderMore();
    // Restart the arrival animation for each new line.
    const card = d("dialogue-card");
    card.classList.remove("arrive");
    void card.offsetWidth;
    card.classList.add("arrive");
  }
  let moreShown = "";
  function renderMore() {
    const waiting = queue.waiting.length + queue.skipped;
    const text = queue.skipped ? `${waiting} more in Comms log` : waiting ? `${waiting} more` : "";
    if (text === moreShown) return;
    moreShown = text;
    d("dialogue-more").hidden = !text;
    d("dialogue-more").textContent = text;
  }
  const dismiss = () => { if (queue.next()) renderLine(); };
  // The whole card dismisses on a tap or click; it is small and never covers the controls.
  d("dialogue-card").addEventListener("click", (event) => { event.stopPropagation(); dismiss(); });

  // Objectives panel: the default three goals stay for skirmish; missions get their own list.
  const fallback = document.createElement("div");
  fallback.id = "objectives-default";
  fallback.append(...objectivesPanel.querySelectorAll(".objective"));
  const list = document.createElement("ol");
  list.id = "objectives-mission";
  list.className = "objectives-mission";
  list.hidden = true;
  const comms = document.createElement("div");
  comms.className = "comms";
  comms.hidden = true;
  comms.innerHTML = `<button id="comms-toggle" class="comms-toggle" aria-expanded="false" aria-controls="comms-log">${icon("info")}<span>Comms log</span></button><ol id="comms-log" class="comms-log" aria-label="Comms log" hidden></ol>`;
  objectivesPanel.append(fallback, list, comms);
  const counter = objectivesPanel.querySelector(".panel-label > span");
  const defaultCount = counter?.textContent || "";
  const commsToggle = comms.querySelector("#comms-toggle"), commsLog = comms.querySelector("#comms-log");
  let logDirty = true;
  function renderLog() {
    if (commsLog.hidden || !logDirty) return;
    logDirty = false;
    commsLog.innerHTML = queue.log.length
      ? queue.log.map((line) => `<li>${castPortrait(line.who, "small")}<span><strong>${esc(castName(line.who))}</strong><span>${esc(line.text)}</span></span></li>`).join("")
      : "<li class=\"empty\"><span>No messages yet.</span></li>";
    commsLog.scrollTop = commsLog.scrollHeight;
  }
  commsToggle.onclick = () => {
    commsLog.hidden = !commsLog.hidden;
    commsToggle.setAttribute("aria-expanded", String(!commsLog.hidden));
    logDirty = true;
    renderLog();
  };

  function say(who, text) {
    const shown = queue.push(who, text);
    logDirty = true;
    renderLog();
    if (shown) { renderLine(); tone(660, 0.05); } else renderMore();
  }
  // Called every frame with the play time that passed (0 while paused): no page work unless
  // the line changes.
  function tick(dt) {
    if (dt > 0 && queue.tick(dt)) renderLine();
  }

  // ---------------------------------------------------------------- Objectives
  let rows = new Map(), listKey = "", active = false;
  function setActive(on) {
    if (active === on) return;
    active = on;
    fallback.hidden = on;
    list.hidden = !on;
    comms.hidden = !on;
    objectivesPanel.classList.toggle("story", on);
    if (!on) {
      list.replaceChildren(); rows = new Map(); listKey = "";
      if (counter) counter.textContent = defaultCount;
      commsLog.hidden = true;
      commsToggle.setAttribute("aria-expanded", "false");
    }
    onLayout();
  }
  // Rewrites a row only when what it shows changed.
  function renderObjectives(sim) {
    const status = sim?.mission ? sim.missionStatus() : null;
    setActive(!!status);
    if (!status) return;
    const key = status.map((o) => o.id).join("|");
    if (key !== listKey) {
      listKey = key;
      const old = rows;
      rows = new Map();
      list.replaceChildren(...status.map((o, i) => {
        const kept = old.get(o.id);
        const row = kept?.row || document.createElement("li");
        if (!kept) {
          row.className = "objective";
          row.dataset.objective = o.id;
          row.innerHTML = `<span class="objective-num"></span><span class="objective-body"><span class="objective-text"></span>${o.optional ? '<em class="objective-tag">Optional</em>' : ""}<small></small></span>`;
          row.classList.toggle("optional", o.optional);
          // A newly shown objective (revealed mid-mission) gets the same brief highlight.
          if (old.size) flash(row);
        }
        const entry = kept || { row, text: null, progress: null, state: null, num: null };
        const num = two(i + 1);
        if (entry.num !== num) { entry.num = num; if (entry.state !== "done") row.querySelector(".objective-num").textContent = num; }
        rows.set(o.id, entry);
        return row;
      }));
      if (counter) counter.textContent = `${two(1)}—${two(status.length)}`;
    }
    for (const o of status) {
      const entry = rows.get(o.id), def = sim.missionDef.objectives.find((x) => x.id === o.id);
      if (entry.text !== o.text) { entry.text = o.text; entry.row.querySelector(".objective-text").textContent = o.text; }
      if (entry.state !== o.state) {
        entry.state = o.state;
        entry.row.classList.toggle("complete", o.state === "done");
        entry.row.classList.toggle("failed", o.state === "failed");
        entry.row.dataset.state = o.state;
        if (o.state === "done") entry.row.querySelector(".objective-num").innerHTML = icon("check");
      }
      const total = def?.tag && o.state === "active" && (o.type === "escort" || o.type === "destroyTag") ? sim.tagged(def.tag).length : 0;
      const progress = objectiveProgress(o, total);
      if (entry.progress !== progress) {
        entry.progress = progress;
        const small = entry.row.querySelector("small");
        small.textContent = progress;
        small.hidden = !progress;
      }
    }
  }
  function flash(row) {
    row.classList.remove("flash");
    void row.offsetWidth;
    row.classList.add("flash");
  }
  // An objective changed: tick, strike or reveal it with a short tone.
  function objectiveEvent(event, sim) {
    renderObjectives(sim);
    const row = rows.get(event.id)?.row;
    if (row) flash(row);
    if (event.state === "done") tone(988, 0.18);
    else if (event.state === "failed") tone(196, 0.25);
    else tone(740, 0.08);
  }

  function resetMatch() {
    queue.reset();
    logDirty = true;
    moreShown = "";
    d("dialogue-more").hidden = true;
    d("dialogue-more").textContent = "";
    renderLine();
    commsLog.hidden = true;
    commsToggle.setAttribute("aria-expanded", "false");
    list.replaceChildren(); rows = new Map(); listKey = "";
  }
  // The match ended: what was waiting stays in the log, the box closes.
  function endMatch() {
    if (queue.flush()) renderLine();
  }

  // ---------------------------------------------------------------- Debrief
  function debriefHTML({ mission, index, total, sim, win, best, hasNext, stats }) {
    const status = sim.missionStatus() || [], medal = win ? sim.mission.medal || "bronze" : null;
    const lines = (win ? mission.debrief?.win : mission.debrief?.lose) || [];
    const marks = { done: icon("check"), failed: icon("close"), active: "" };
    const objectives = status.map((o) => `<li class="${o.state}${o.optional ? " optional" : ""}"><i>${marks[o.state] || ""}</i><span>${esc(o.text)}</span>${o.optional ? "<em>Optional</em>" : ""}</li>`).join("");
    const talk = lines.map((line) => `<div class="debrief-line">${castPortrait(line.who)}<div><strong>${esc(castName(line.who))}</strong><p>${esc(line.text)}</p></div></div>`).join("");
    const buttons = win && hasNext
      ? `<button class="primary" data-next-mission><span>Next mission</span>${icon("arrow")}</button><button class="secondary" data-restart>Retry</button><button class="secondary" data-new-game>Campaign</button>`
      : `<button class="primary" data-restart><span>Retry</span>${icon("arrow")}</button><button class="secondary" data-new-game>Campaign</button>`;
    const seconds = sim.mission.clock ?? sim.time;
    return `<div class="debrief ${win ? "won" : "lost"}" data-result="${win ? "victory" : "defeat"}"${medal ? ` data-medal="${medal}"` : ""}>
      <span class="eyebrow">MISSION ${two(index + 1)} · ${win ? "COMPLETE" : "FAILED"}</span>
      <div class="debrief-head">${win ? medalBadge(medal) : `<span class="debrief-loss">${icon("close")}</span>`}<div><h2 id="modal-title">${esc(mission.title)}</h2><p class="debrief-result"><strong>${win ? "Victory" : "Defeat"}</strong>${medal ? `<span>${MEDAL_NAMES[medal]}</span>` : ""}</p></div></div>
      <div class="result-grid">${matchStatTiles(stats, { structures: false, extra: [statTile(clock(seconds), "Mission time", "time"), statTile(best != null ? clock(best) : "—", "Best time")] })}</div>
      <h3>Objectives</h3><ol class="debrief-objectives">${objectives}</ol>
      ${talk ? `<div class="debrief-lines">${talk}</div>` : ""}
      ${win && !hasNext && index === total - 1 ? "<p class=\"debrief-end\">Every mission cleared. The campaign is complete.</p>" : ""}
      <div class="debrief-actions">${buttons}</div>
    </div>`;
  }

  return {
    openBriefing, closeBriefing, get briefingOpen() { return !!brief; }, get briefingStep() { return brief?.step ?? -1; },
    say, tick, dismiss, renderObjectives, objectiveEvent, resetMatch, endMatch, debriefHTML,
    get queue() { return queue; },
  };
}
