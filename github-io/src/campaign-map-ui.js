// The campaign map (0.19a): the frontier drawn as three act bands climbing to the Keystone, with
// a relay node per mission that lights up in its medal colour when cleared, dimmed nodes for
// locked missions, the decisions taken as small marks on their mission, the endings seen and the
// four Faction Chronicle cards (0.20, chronicles-ui.js). Inline SVG ground plus positioned HTML, so
// it stays crisp at any size and the words translate like the rest of the page.
//
// The mission list in the setup column (app/briefing.js) stays the keyboard and screen-reader
// structure; the map's nodes are the same choices for pointer and touch, hidden from assistive
// technology. The endings seen are real buttons: they replay that epilogue.
import "./campaign-map.css";
import { MISSIONS, ACTS, isCleared, isUnlocked, bestMedal, nextMission } from "./campaign.js";
import { MAP_NODES, LANDS, ACT_BANDS, MAP_TEXT } from "./story/campaign-map.js";
import { DECISIONS, ENDINGS, ENDING_IDS, optionOf } from "./story/choices.js";
import { chronicleCardsHTML } from "./chronicles-ui.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// The decision a mission asked, with the answer the progress holds (only once one is recorded).
export function missionChoices(progress, missionId) {
  return Object.values(DECISIONS).filter((d) => d.mission === missionId && typeof progress?.decisions?.[d.id] === "string")
    .map((d) => ({ id: d.id, option: optionOf(d.id, progress.decisions[d.id]) })).filter((c) => c.option);
}

// `campaign`: "main" or the Faction Chronicle chosen (0.20); a chronicle's card is marked and no relay is picked.
export function campaignMapHTML({ progress, pick = 0, campaign = "main" }) {
  if (campaign !== "main") pick = -1;
  const next = nextMission(progress);
  const nodes = MISSIONS.map((m, i) => ({ m, i, at: MAP_NODES[m.id] || { x: 50, y: 50 }, open: isUnlocked(progress, i), done: isCleared(progress, i), medal: bestMedal(progress, i) }));
  const lit = nodes.filter((n) => n.done).length;
  const seen = new Set(progress?.endingsSeen || []);
  const anyChoice = nodes.some((n) => missionChoices(progress, n.m.id).length);
  // Ground: act bands, a patch of each mission's land, the relay line between missions.
  const lands = [...new Set(nodes.map((n) => n.m.map))];
  const ground = [
    `<defs>${lands.map((id) => `<radialGradient id="cml-${id}"><stop offset="0" stop-color="${LANDS[id] || "#5d7a80"}" stop-opacity="0.55"/><stop offset="0.6" stop-color="${LANDS[id] || "#5d7a80"}" stop-opacity="0.22"/><stop offset="1" stop-color="${LANDS[id] || "#5d7a80"}" stop-opacity="0"/></radialGradient>`).join("")}</defs>`,
    ...ACTS.map(({ act }) => { const b = ACT_BANDS[act]; return `<rect class="cmap-band band-${act}" x="0" y="${b.top}" width="100" height="${b.bottom - b.top}"/>`; }),
    ...ACTS.slice(1).map(({ act }) => `<line class="cmap-rule" x1="0" x2="100" y1="${ACT_BANDS[act].bottom}" y2="${ACT_BANDS[act].bottom}" vector-effect="non-scaling-stroke"/>`),
    ...nodes.map((n) => `<ellipse class="cmap-land" cx="${n.at.x}" cy="${n.at.y}" rx="15" ry="13" fill="url(#cml-${n.m.map})"/>`),
    `<path class="cmap-river" d="M0 76 C 18 70, 26 96, 48 88 S 78 70, 100 80" vector-effect="non-scaling-stroke"/>`,
    ...nodes.slice(1).map((n, k) => { const a = nodes[k]; return `<line class="cmap-route ${a.done ? "lit" : "dim"}" x1="${a.at.x}" y1="${a.at.y}" x2="${n.at.x}" y2="${n.at.y}" vector-effect="non-scaling-stroke"/>`; }),
    `<circle class="cmap-keystone" cx="${nodes.at(-1).at.x}" cy="${nodes.at(-1).at.y}" r="7"/>`,
  ].join("");
  const acts = ACTS.map(({ act, title }) => `<span class="cmap-act" style="top:${ACT_BANDS[act].top + 1.5}%"><b>ACT ${act}</b> <span>${esc(title)}</span></span>`).join("");
  const node = (n) => {
    const state = n.done ? `done medal-${n.medal}` : n.open ? "open" : "locked";
    const marks = missionChoices(progress, n.m.id).map((c) => `<i class="cmap-choice ${c.option.mercy ? "mercy" : "firm"}" title="${esc(c.option.label)}"></i>`).join("");
    // A mission played under the Defence rules (0.19b) has a square relay.
    const extra = `${n.i === pick ? " picked" : ""}${n.i === next && !n.done ? " next" : ""}${n.i === nodes.length - 1 ? " keystone" : ""}${n.m.defence ? " defence" : ""}`;
    return `<button class="cmap-node ${state}${extra}" data-map-stage="${n.i}" data-map-mission="${esc(n.m.id)}" style="left:${n.at.x}%;top:${n.at.y}%" tabindex="-1" aria-hidden="true"${n.open ? "" : " disabled"} title="${n.i + 1} · ${esc(n.m.title)}"><b>${n.i + 1}</b>${marks}<span class="cmap-title">${esc(n.m.title)}</span></button>`;
  };
  const endings = ENDING_IDS.map((id) => (seen.has(id)
    ? `<button class="cmap-ending seen ${id}" data-ending="${id}" title="Replay the epilogue"><i aria-hidden="true"></i><span>${esc(ENDINGS[id].title)}</span></button>`
    : `<span class="cmap-ending unseen" title="${esc(MAP_TEXT.unseen)}"><i aria-hidden="true"></i><span>${esc(MAP_TEXT.unseen)}</span></span>`)).join("");
  const legend = anyChoice ? `<span class="cmap-legend"><span class="cmap-label">${esc(MAP_TEXT.decisions)}</span><span><i class="cmap-choice mercy" aria-hidden="true"></i>Merciful</span><span><i class="cmap-choice firm" aria-hidden="true"></i>Firm</span></span>` : "";
  return `<div class="cmap" role="group" aria-label="Campaign map" data-lit="${lit}">
    <div class="cmap-head"><span class="eyebrow">CAMPAIGN MAP</span><strong>${esc(MAP_TEXT.heading)}</strong><span class="cmap-count">${lit} / ${MISSIONS.length} relays lit</span></div>
    <div class="cmap-board"><svg class="cmap-ground" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${ground}</svg>${acts}${nodes.map(node).join("")}</div>
    <div class="cmap-foot">
      <div class="cmap-endings"><span class="cmap-label">${esc(MAP_TEXT.endings)}</span>${endings}</div>
      ${legend}
      ${chronicleCardsHTML({ progress, campaign })}
    </div>
  </div>`;
}
