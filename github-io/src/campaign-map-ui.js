// The campaign map: the painted frontier (Codex/OpenAI ImageGen art, src/art/campaign/) with a holo relay pin
// on each mission's landmark, lit in its medal colour when cleared, a cyan beacon on the next mission and dim
// pins for locked ones; the route drawn as a glowing dashed path along the zigzag, act plates, the decisions
// as small marks on their relay, the endings and the four Faction Chronicle cards (chronicles-ui.js).
// One image, one SVG and positioned HTML: no per-frame script, crisp at any size, and the words translate
// like the rest of the page.
//
// The painting and its overlay share one layer (`.cmap-layer`) that covers the board like `object-fit: cover`,
// so the README anchors are percentages of that layer. Desktop and portrait boards are aspect-locked (the
// layer is the board); a landscape phone's board may be a little taller than the strip, and the layer then
// crops a few pixels at the sides, relays and route together. Desktop, tablets and phones in portrait use the wide painting; landscape phones the strip
// panorama (one <picture>, so the browser fetches only the painting the layout shows, and only once the
// campaign opens).
//
// The mission list in the setup column (app/briefing.js) stays the keyboard and screen-reader
// structure; the map's nodes are the same choices for pointer and touch, hidden from assistive
// technology. The endings seen are real buttons: they replay that epilogue.
import "./campaign-map.css";
import wideArt from "./art/campaign/campaign-map-wide.webp";
import stripArt from "./art/campaign/campaign-map-strip.webp";
import { MISSIONS, ACTS, isCleared, isUnlocked, bestMedal, nextMission } from "./campaign.js";
import { MAP_NODES, STRIP_NODES, MAP_ANCHORS, MAP_ART, MAP_TEXT, ENDING_HINTS } from "./story/campaign-map.js";
import { DECISIONS, ENDINGS, ENDING_IDS, optionOf } from "./story/choices.js";
import { chronicleCardsHTML } from "./chronicles-ui.js";
import { achievementsFor } from "./story/achievements.js";
import { loadRecord } from "./meta/record.js";
import { loadDefence } from "./defence/progress.js";
import { DEFINITIONS as DEFS } from "./data.js";
import "./campaign-archive.css";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The layout that shows the strip panorama (kept equal to the media rules in campaign-map.css).
export const STRIP_MEDIA = "(orientation: landscape) and (max-height: 520px)";

// The decision a mission asked, with the answer the progress holds (only once one is recorded).
export function missionChoices(progress, missionId) {
  return Object.values(DECISIONS).filter((d) => d.mission === missionId && typeof progress?.decisions?.[d.id] === "string")
    .map((d) => ({ id: d.id, option: optionOf(d.id, progress.decisions[d.id]) })).filter((c) => c.option);
}

// R3-G: the decisions a mission asks that the progress holds no answer for yet (a "decision ahead" mark).
export const decisionsAhead = (progress, missionId) => Object.values(DECISIONS).filter((d) => d.mission === missionId && typeof progress?.decisions?.[d.id] !== "string").map((d) => d.id);
// Merciful answers actually given so far (the ending counts defaults too; the hint counts only choices made).
export const mercyGiven = (progress) => Object.keys(DECISIONS).filter((id) => typeof progress?.decisions?.[id] === "string" && optionOf(id, progress.decisions[id])?.mercy).length;

const r2 = (v) => Math.round(v * 100) / 100;
// The route through the relays as one smooth curve (Catmull-Rom turned into cubic Béziers), one piece per leg,
// in the board's percent space (the SVG stretches with the board, strokes keep their pixel width).
export function routeLegs(points) {
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  return points.slice(1).map((b, k) => {
    const p0 = at(k - 1), a = points[k], p3 = at(k + 2), t = 0.18;
    const c1 = { x: a.x + (b.x - p0.x) * t, y: a.y + (b.y - p0.y) * t }, c2 = { x: b.x - (p3.x - a.x) * t, y: b.y - (p3.y - a.y) * t };
    return `M${r2(a.x)} ${r2(a.y)}C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(b.x)} ${r2(b.y)}`;
  });
}
// Act plates: Act 3 in the painting's calm top-left corner, Acts 2 and 1 at the left edge of their bands.
// W9: the relays snake over four rows (story/campaign-map.js); Act 2 and Act 1 plates sit in the gaps left of the rows.
const ACT_AT = { 3: 1.6, 2: 46, 1: 68.5 };

// The archive under the map (plan C5.3 and C7): achievements, the veteran squad and the commanders met, in one
// block with no sub-menus; New Game+ is a plain button once every main mission is cleared.
const COMMANDERS = [["m04-sol", "Captain Sol"], ["m07-hale", "Commander Hale"], ["m10-maren", "Ilse Maren"]];
export function archiveHTML(progress) {
  // W6: all 25, the Skirmish, Defence, Kite and taming ones from the service record (src/meta/record.js).
  const ach = achievementsFor(progress, { record: loadRecord(), defence: loadDefence() }), done = ach.filter((a) => a.done).length;
  const chips = ach.map((a) => `<span class="cmap-chip ${a.done ? "done" : "todo"}" title="${esc(a.how)}${a.done ? "" : ` · ${a.have}/${a.need}`}"><i aria-hidden="true">${a.done ? "✓" : "○"}</i>${esc(a.title)}</span>`).join("");
  const squad = (progress?.squad || []).map((m) => `<span class="cmap-vet"><b aria-hidden="true">${"★".repeat(Math.min(3, m.rank))}</b> ${esc(m.name)} <em>${esc(DEFS[m.type]?.name || m.type)}</em></span>`).join("");
  const met = COMMANDERS.map(([id, name]) => {
    const answer = progress?.decisions?.[id];
    return `<span class="cmap-met ${answer === "accept" ? "spared" : answer === "finish" ? "beaten" : "unmet"}">${esc(name)} <em>${answer === "accept" ? "Spared" : answer === "finish" ? "Defeated" : "Not met yet"}</em></span>`;
  }).join("");
  const allDone = MISSIONS.every((m, i) => /^m\d+[a-z]-/.test(m.id) || isCleared(progress, i));
  const plus = allDone ? `<button type="button" class="cmap-ngplus" data-ngplus>New Game+${progress?.ngPlus ? ` · run ${progress.ngPlus + 1}` : ""}</button>` : "";
  return `<div class="cmap-archive" role="group" aria-label="Archive">
    <div class="cmap-row"><span class="cmap-label">${esc("Achievements")} <b>${done} / ${ach.length}</b></span><span class="cmap-chips">${chips}</span></div>
    <div class="cmap-row"><span class="cmap-label">${esc("Your veterans")}</span><span class="cmap-chips">${squad || `<span class="cmap-none">${esc("None yet. Rank up units and win a mission.")}</span>`}</span></div>
    <div class="cmap-row"><span class="cmap-label">${esc("Commanders met")}</span><span class="cmap-chips">${met}</span></div>
    ${plus}
  </div>`;
}

// `campaign`: "main" or the Faction Chronicle chosen (0.20); a chronicle's card is marked and no relay is picked.
export function campaignMapHTML({ progress, pick = 0, campaign = "main" }) {
  if (campaign !== "main") pick = -1;
  const next = nextMission(progress);
  const nodes = MISSIONS.map((m, i) => ({ m, i, at: MAP_NODES[m.id] || { x: 50, y: 50 }, strip: STRIP_NODES[m.id] || MAP_NODES[m.id] || { x: 50, y: 50 }, open: isUnlocked(progress, i), done: isCleared(progress, i), medal: bestMedal(progress, i) }));
  const lit = nodes.filter((n) => n.done).length;
  const seen = new Set(progress?.endingsSeen || []);
  const anyChoice = nodes.some((n) => missionChoices(progress, n.m.id).length);
  // The route: walked legs glow gold, the leg to the next relay is cyan, the rest a faint survey dash.
  const legState = (k) => (nodes[k + 1].done ? "walked" : nodes[k].done || k + 1 === next ? "ahead" : "dim");
  const route = (key) => {
    const legs = routeLegs(nodes.map((n) => n[key]));
    const draw = (cls) => legs.map((d, k) => `<path class="${cls} ${legState(k)}" d="${d}" vector-effect="non-scaling-stroke"/>`).join("");
    return `<svg class="cmap-route-svg ${key === "at" ? "for-wide" : "for-strip"}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${draw("cmap-glow")}${draw("cmap-route")}</svg>`;
  };
  const acts = ACTS.map(({ act, title }) => `<span class="cmap-act act-${act}" style="top:${ACT_AT[act]}%"><b>ACT ${act}</b> <span>${esc(title)}</span></span>`).join("");
  const node = (n) => {
    const state = n.done ? `done medal-${n.medal}` : n.open ? "open" : "locked";
    const marks = missionChoices(progress, n.m.id).map((c) => `<i class="cmap-choice ${c.option.mercy ? "mercy" : "firm"}" title="${esc(c.option.label)}"></i>`).join("")
      + (decisionsAhead(progress, n.m.id).length ? `<i class="cmap-ahead" title="${esc(MAP_TEXT.decisionAhead)}"></i>` : "");
    // The name plate's side on each painting: the README table's choice on the wide one; on the strip, low
    // relays (Act 1) look up and the rest down, so the plate stays on the shorter board.
    const wideSide = MAP_ANCHORS[n.m.id]?.label || (n.at.y > 70 ? "b" : "a"), stripSide = n.strip.y > 70 ? "a" : n.strip.y < 30 ? "b" : wideSide;
    // A mission played under the Defence rules (0.19b) has a square relay.
    const extra = `${n.i === pick ? " picked" : ""}${n.i === next && !n.done ? " next" : ""}${n.i === nodes.length - 1 ? " keystone" : ""}${n.m.defence ? " defence" : ""} a${n.m.act} lw-${wideSide} ls-${stripSide}${n.at.x < 18 ? " edge-l" : n.at.x > 82 ? " edge-r" : ""}`;
    const place = `--wx:${n.at.x}%;--wy:${n.at.y}%;--sx:${n.strip.x}%;--sy:${n.strip.y}%`;
    return `<button class="cmap-node ${state}${extra}" data-map-stage="${n.i}" data-map-mission="${esc(n.m.id)}" style="${place}" tabindex="-1" aria-hidden="true"${n.open ? "" : " disabled"} title="${n.i + 1} · ${esc(n.m.title)}"><b>${n.i + 1}</b>${marks}<span class="cmap-title">${esc(n.m.title)}</span></button>`;
  };
  // Each ending names what leads there (R3-G): a seen one is a button that replays its epilogue.
  const words = (id) => `<span class="cmap-ending-words"><b class="cmap-ending-name">${esc(ENDINGS[id].title)}</b><b class="cmap-ending-short">${esc(ENDING_HINTS[id]?.short || ENDINGS[id].title)}</b><small class="cmap-hint">${esc(ENDING_HINTS[id]?.hint || "")}</small></span>`;
  const endings = ENDING_IDS.map((id) => (seen.has(id)
    ? `<button class="cmap-ending seen ${id}" data-ending="${id}" title="Replay the epilogue"><i aria-hidden="true"></i>${words(id)}</button>`
    : `<span class="cmap-ending unseen ${id}" title="${esc(MAP_TEXT.unseen)}"><i aria-hidden="true"></i>${words(id)}</span>`)).join("");
  const given = mercyGiven(progress), asked = Object.keys(DECISIONS).length;
  const anyAhead = nodes.some((n) => decisionsAhead(progress, n.m.id).length);
  const legend = anyChoice || anyAhead ? `<span class="cmap-legend"><span class="cmap-label">${esc(MAP_TEXT.decisions)}</span>${anyChoice ? `<span><i class="cmap-choice mercy" aria-hidden="true"></i>Merciful</span><span><i class="cmap-choice firm" aria-hidden="true"></i>Firm</span>` : ""}<span><i class="cmap-ahead" aria-hidden="true"></i>Ahead</span><span class="cmap-mercy">${given} / ${asked} merciful</span></span>` : "";
  const art = `<picture class="cmap-art" aria-hidden="true"><source media="${STRIP_MEDIA}" srcset="${stripArt}" width="${MAP_ART.strip.w}" height="${MAP_ART.strip.h}"><img src="${wideArt}" alt="" width="${MAP_ART.wide.w}" height="${MAP_ART.wide.h}" decoding="async" draggable="false"></picture>`;
  return `<div class="cmap" role="group" aria-label="Campaign map" data-lit="${lit}">
    <div class="cmap-head"><span class="eyebrow">CAMPAIGN MAP</span><strong>${esc(MAP_TEXT.heading)}</strong>${legend}<span class="cmap-count">${lit} / ${MISSIONS.length} relays lit</span></div>
    <div class="cmap-frame"><div class="cmap-board"><div class="cmap-layer">${art}${route("at")}${route("strip")}${nodes.map(node).join("")}</div><span class="cmap-vignette" aria-hidden="true"></span>${acts}</div></div>
    <div class="cmap-foot">
      <div class="cmap-endings"><span class="cmap-label">${esc(MAP_TEXT.endings)}</span>${endings}</div>
      ${campaign === "main" ? archiveHTML(progress) : ""}
      ${chronicleCardsHTML({ progress, campaign })}
    </div>
  </div>`;
}
