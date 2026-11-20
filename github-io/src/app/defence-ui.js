// Frontier Defence match interface, imported on first use (app/defence-entry.js):
//  - the pads, drawn as one instanced mesh, coloured by kind (ground, rim, deep) and by selection;
//  - crews standing on their towers (clones of the unit templates, drawn by the same instanced
//    batches as the army) with tier trims through the per-instance tint; the commander in gold;
//  - the pad sheet (crews with portraits and costs), the tower sheet (Upgrade, Sell, and at tier 3
//    the two branches), the commander sheet (Barrage, Reinforce) and the bridge sheet (Blow
//    bridge) in the command card; lives, wave and countdown chips, Commander, Call wave and
//    Overview on the battlefield;
//  - blown bridges hidden, pontoons (one merged mesh each) and the fuse light;
//  - the wave intel strip beside the bar (0.22): the next wave's units with counts (a carrier with
//    its passengers) and its roads, while it can still be called; the "+N" of a carrier lost with
//    its squad aboard;
//  - the result screen with stars (or waves held, in Endless and the Daily seed), and progress.
// The rules are in src/sim/defence.js; this module only reads the match and sends commands.
// Since CW-F the closure is split into modules under app/defence/ (pads-view, bar, sheets, input,
// result, constants). They share one small state object (`ui`) and one context (`c`) that each
// module fills with its functions; nothing is global.
// Everything it needs from the always-loaded app arrives as `deps` (app/defence-entry.js): a
// shared import would make the bundler split those modules, and their CSS, into a new chunk.
import "../defence-ui.css";
import { PHONE_ZOOM } from "./defence/constants.js";
import { createPadsView } from "./defence/pads-view.js";
import { createBar } from "./defence/bar.js";
import { createSheets } from "./defence/sheets.js";
import { createInput } from "./defence/input.js";
import { createResult } from "./defence/result.js";

export { TIER_TINT, RANK_TINT, HERO_TINT } from "./defence/constants.js";

export function createDefenceUI(S, A, deps) {
  const { $, ACTION_KEYS } = deps;
  const Z = S.screen, root = document.documentElement;
  // The state the parts share (what used to be `let`s of one closure).
  const ui = { viewMode: "free", saved: null, follow: { set: false, pauseUntil: 0, x: 0, z: 0, zoom: 0 }, cardQueue: [], cardEl: null, cardAt: 0, cardWave: -1, pads: null, bar: null, intel: null, intelKey: "", seen: null, overview: false, leakAt: -Infinity, affordable: false, burstTier: 0, aim: null, cross: null, ring: null, towerTop: null, dropAt: null, refitAt: null, lastTap: null, infoKey: "" };
  const key = (i) => ACTION_KEYS[i] || "";
  const c = {
    S, A, Z, root, deps, ui, key,
    kbd: (k) => (k ? `<kbd class="action-key">${k}</kbd>` : ""),
    motionOff: () => root.classList.contains("motion-off") || matchMedia("(prefers-reduced-motion: reduce)").matches,
    phone: () => root.classList.contains("compact-ui"),
    // The squad number when the selection is one armour squad (some or all of its tanks), else null.
    selectedSquad: (es) => (es.length && es.every((e) => e.squad && e.team === 0 && e.squad === es[0].squad) ? es[0].squad : null),
  };
  S.defenceBridge ??= null;
  createPadsView(c);
  createBar(c);
  createSheets(c);
  createInput(c);
  createResult(c);
  const { buildPads, ensureBar, setAim, setOverview, paintView, closeCard, updateBar, announce, sheet, info, paintPads, rangeRing, syncCrossings, hideRing, disposePads, tap, result, event, phone } = c;

  // ---------------------------------------------------------------- Lifecycle
  function begin(resume = false) {
    if (!S.sim?.defence) return;
    buildPads();
    ensureBar();
    ui.intelKey = "";
    ui.seen = null;
    S.defencePad = null;
    S.defenceBridge = null;
    S.defenceSpot = null;
    S.defenceDepot = false;
    setAim(null);
    if (ui.cross) ui.cross.key = "";
    const cam = S.sim.missionDef.defence.camera;
    S.view.maxZoom = cam.maxZoom;
    setOverview(false);
    S.view.focusOn(cam.x, cam.z);
    // W1-F: a phone opens at road zoom over the first spawn and follows the wave; a desktop keeps its free camera.
    ui.viewMode = "free"; ui.saved = null; ui.follow = { set: false, pauseUntil: 0, x: 0, z: 0, zoom: 0 };
    ui.cardQueue = []; ui.cardWave = -1; closeCard();
    if (phone()) {
      const first = S.sim.defenceWave(0)?.groups?.[0], pt = first && S.sim.missionDef.defence.routes[first.route]?.[0];
      S.view.zoom = Math.min(cam.zoom, PHONE_ZOOM);
      if (pt) S.view.focusOn(pt.x, pt.z);
      S.view.updateCamera();
      ui.viewMode = "follow";
    }
    paintView();
    // The skirmish opening line ("assign Harvesters") does not apply here.
    S.sim.events = S.sim.events.filter((e) => e.type !== "message");
    if (!resume && Z.started) A.notice(S.sim.missionDef.defence.zones?.length ? "Tap a pad or a marked field, then pick a crew." : "Tap a pad beside the road, then pick a crew.");
    A.updateUI();
  }
  function hud(es) {
    if (!ui.pads || ui.pads.def !== S.sim.missionDef.defence || ui.pads.terrain !== S.view.terrain) buildPads();
    ensureBar();
    ui.bar.hidden = !Z.started;
    if (S.view.maxZoom == null) S.view.maxZoom = S.sim.missionDef.defence.camera.maxZoom;
    updateBar();
    if (Z.started) announce();
    sheet(es);
    info(es);
    // A picked pad or bridge counts as a selection for the docks (landscape phones hide an empty dock).
    if ((S.defencePad || S.defenceBridge !== null || S.defenceSpot || S.defenceDepot) && !es.length) document.querySelector(".selection-panel").classList.add("has-entity");
    paintPads();
    rangeRing(es);
    syncCrossings();
  }
  // Not a defence match (any more): take the pads, crossings and the bar away.
  function idle() {
    hideRing();
    disposePads();
    if (ui.aim) setAim(null);
    if (ui.bar) ui.bar.hidden = true;
    root.style.removeProperty("--defence-bar-h");
    closeCard();
    if (ui.intel) { ui.intel.hidden = true; ui.intelKey = ""; }
    delete $("commands").dataset.tier;
  }

  return { begin, hud, idle, tap, result, setOverview, event, get pads() { return ui.pads; }, get aim() { return ui.aim; } };
}
