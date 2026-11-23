// Frontier Command client: the composition root. It builds the page and the shared state,
// lets each module under app/ register what it offers (setup), connects them (bind) and boots.
// Declare the shared stylesheet cascade in order, independently of module initialization.
import "./tutorial.css";
import "./style.css";
import "./mobile.css";
import "./settings.css";
import "./start-screen.css";
import "./desktop-dock.css";
import "./hud-readability.css";
import "./portraits.css";
import "./language.css";
import "./progression.css";
import "./hotkeys.css";
import "./construction-ui.css";
import "./production-ui.css";
import "./selection-status.css";
import "./tactics-ui.css";
import "./mission-ui.css";
import "./ui-theme.css";
import "./landscape-hud.css";
import "./rule-options.css";

import { Simulation } from "./simulation.js";
import { WorldView } from "./view.js";
import { $ } from "./app/dom.js";
import { renderShell } from "./app/shell.js";
import { createState } from "./app/state.js";
import { setupHud } from "./app/hud.js";
import { setupPreferences } from "./app/preferences.js";
import { setupSound } from "./app/sound.js";
import { setupSelection } from "./app/selection.js";
import { setupOrders } from "./app/orders.js";
import { setupAbilities } from "./app/abilities.js";
import { setupCommandCard } from "./app/command-card.js";
import { setupMinimap } from "./app/minimap.js";
import { setupInputPointer } from "./app/input-pointer.js";
import { setupInputKeyboard } from "./app/input-keyboard.js";
import { setupModals } from "./app/modals.js";
import { setupBriefing } from "./app/briefing.js";
import { setupMatchFlow } from "./app/match-flow.js";
import { setupFrame } from "./app/frame.js";
import { setupUiExtras } from "./app/ui-extras.js";
import { setupDebugHooks } from "./app/debug-hooks.js";
import { setupDefenceEntry } from "./app/defence-entry.js";
import { setupChoices } from "./app/choices.js";
import { setupScenes } from "./app/scenes.js";
import { setupRank } from "./rank-ui.js"; // R3-R: commander rank chip, unlock pickers, results toast
import { resolveMission } from "./campaign.js";
import { CORE_MODEL_TYPES, modelsForMatch } from "./model-roster.js";
import { skirmishSides, matchLook } from "./factions.js";
import { prefetchModels, releaseModelBytes } from "./app/loading.js";
import "./loading.css";
// Phone battle HUD tidy pass (round 3): loaded last, scoped to phones in a match.
import "./ui-kit.css";
import "./phone-hud.css";
import { registerOffline } from "./app/offline.js";
import { setupCover } from "./app/cover.js";
import { setupQuickBattle } from "./quick-battle.js";
// The command console kit on every screen (round 3 kit pass): loaded after every other stylesheet.
import "./kit-skin.css";
import "./menu-pro.css";
import "./theme-walnut.css";
import "./theme-switch.js";

renderShell();
// S is the shared state; A is what each module offers the others (functions and widgets).
const S = createState();
const A = {};
// The title cover's live layers and loading card (R3-M); its blips use A.tone once sound is set up.
setupCover(A, S);

// Every match, preview and restart is built from the current setup (a story mission included).
// A story mission plays as this player's campaign has it: earlier decisions and the ending are
// settled from the progress record (resolveMission, src/story/choices.js) before it starts.
const createSim = () => {
  // Only a skirmish lets the player choose sides: Training (and the campaign) always command Meridian.
  const sim = new Simulation({ factions: S.mission || S.playMode !== "skirmish" ? null : skirmishSides(S.playerFaction, S.enemyFaction, S.enemyCount, S.mapId), map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, playerBonus: S.bonus, mission: S.mission ? resolveMission(S.mission, S.campaign) : null, difficulty: S.settings.campaignDifficulty, capturePoints: !S.mission && S.playMode === "skirmish", ...(!S.mission && S.playMode === "skirmish" && S.rules ? { rules: S.rules } : {}) });
  S.look = matchLook(S.mission, sim);
  return sim;
};

let bootReady = false, activeLoad = null;
function clearLoadIndicator() {
  const start = $("start");
  start.disabled = false;
  start.removeAttribute("aria-busy");
  start.style.removeProperty("--load");
  if (S.loadFailed) $("status-text").textContent = "ALL SYSTEMS READY";
  S.loadFailed = false;
}
async function loadAssets(types = modelsForMatch(S.sim)) {
  activeLoad?.abort();
  const request = new AbortController();
  activeLoad = request;
  S.view.setModelRequirements(types);
  const start = $("start");
  start.disabled = true;
  start.setAttribute("aria-busy", "true");
  try {
    // Staged download first (terrain, headquarters, harvester, then the rest), then the parse.
    await prefetchModels(({ stage, percent }) => {
      if (request.signal.aborted) return;
      start.textContent = `Loading ${stage}… ${percent}%`;
      start.style.setProperty("--load", `${percent}%`);
    }, {
      types, signal: request.signal,
      isPrepared: type => type === "environment" ? !!S.view.environmentAssets : S.view.models.has(type),
    });
    if (request.signal.aborted) return false;
    await S.view.loadModels(types);
    if (request.signal.aborted) return false;
    activeLoad = null;
    releaseModelBytes();
    clearLoadIndicator();
  } catch (error) {
    if (request.signal.aborted) return false;
    activeLoad = null;
    start.removeAttribute("aria-busy");
    start.style.removeProperty("--load");
    console.error(error);
    S.loadFailed = true;
    start.disabled = false;
    start.textContent = "Retry";
    $("status-text").textContent = "DOWNLOAD FAILED";
    A.notice("Some game files did not download. Check your connection, then press Retry.");
    if (bootReady) {
      A.setModalOpen(false);
      S.screen.toMenu();
      $("briefing").hidden = false;
      document.documentElement.classList.add("in-briefing");
    }
    return false;
  }
  if (!bootReady) { bootReady = true; ready(); }
  else { A.renderBriefing(); A.updateUI(); }
  return true;
}

function boot() {
  try {
    S.view = new WorldView($("world"), { terrain: S.sim.terrain, settings: S.settings, mission: S.look });
    // R3-K: the group badges read the Ctrl+number groups (mutated in place, never replaced).
    S.view.controlGroups = S.groups;
    S.view.onContextLost = A.graphicsLost;
    S.view.onContextRestored = A.graphicsRestored;
    $("quality").textContent = S.view.lowPower ? "Eco" : "High";
  } catch (error) {
    initFailed(error);
    return;
  }
  // A fresh campaign opens on the mission list. Its opponent can load when the match starts.
  // A skirmish previews the player's remembered faction on the opening screen.
  loadAssets(S.playMode === "campaign" ? CORE_MODEL_TYPES : modelsForMatch(S.sim));
}

function initFailed(error) {
  console.error(error);
  $("start").textContent = "Unable to initialize";
  $("status-text").textContent = "INITIALIZATION FAILED";
  A.notice(
    "The 3D engine could not start. Enable hardware acceleration and reload in a browser with WebGL 2 support.",
  );
  $("briefing").querySelector("p").textContent =
    "Check your connection and WebGL support, then reload. All game assets must be served from the built site.";
}

function ready() {
  try {
    A.applyPreferences(S.settings);
    A.updateHeading();
    A.bindInput();
    $("start").disabled = false;
    A.renderBriefing();
    A.focusHome();
    $("status-text").textContent = "ALL SYSTEMS READY";
    A.updateUI();
    requestAnimationFrame(A.frame);
    // Explicit opt-in hook used by browser integration tests. Absent in normal play.
    if (new URLSearchParams(location.search).has("test"))
      A.installDebugHooks();
  } catch (error) {
    initFailed(error);
  }
}

Object.assign(A, { createSim, loadAssets, ensureMatchModels: (onReady) => {
  const types = modelsForMatch(S.sim);
  if (S.view.setModelRequirements(types)) {
    // Returning to a cached roster must also dismiss any abandoned download or Retry state.
    if (bootReady && (activeLoad || S.loadFailed)) {
      activeLoad?.abort();
      activeLoad = null;
      clearLoadIndicator();
      A.renderBriefing();
    }
    return null;
  }
  return loadAssets(types).then(ok => ok ? onReady?.() : false);
} });

// Each module's setup(S, A) registers what it offers on A and returns its bind(): the listeners
// and one-off DOM changes. Setup order is construction order (the mission UI exists before the
// page is translated, the production panels before the layout runs). Bind order keeps the
// original order of same-type listeners (visibilitychange: audio, autosave; pointerdown: touch
// mode, then camera-pan cancel) and of the top-bar buttons.
const SETUP = [
  ["hud", setupHud], ["preferences", setupPreferences], ["sound", setupSound], ["selection", setupSelection],
  ["orders", setupOrders], ["abilities", setupAbilities], ["command-card", setupCommandCard], ["minimap", setupMinimap],
  ["input-pointer", setupInputPointer], ["input-keyboard", setupInputKeyboard], ["modals", setupModals],
  ["briefing", setupBriefing], ["match-flow", setupMatchFlow], ["frame", setupFrame], ["ui-extras", setupUiExtras], ["choices", setupChoices], ["scenes", setupScenes], ["debug-hooks", setupDebugHooks],
  ["defence", setupDefenceEntry],
  ["rank", setupRank],
  // R3-Q: Quick battle and First watch wrap createSim, newGame, defenceMission and defenceHud, so they come last.
  ["quick-battle", setupQuickBattle],
];
const BIND = ["preferences", "hud", "input-pointer", "sound", "frame", "modals", "briefing", "match-flow", "selection",
  "orders", "abilities", "command-card", "input-keyboard", "minimap", "ui-extras", "choices", "scenes", "debug-hooks", "defence", "rank", "quick-battle"];
const binds = Object.fromEntries(SETUP.map(([name, setup]) => [name, setup(S, A)]));
// The start screen shows the battle chosen there, so the first simulation is built from it.
({ map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, bonus: S.bonus, mission: S.mission, faction: S.enemyFaction, playerFaction: S.playerFaction } = A.battleSetup());
S.sim = createSim();
for (const name of BIND) binds[name]();
boot();
registerOffline(A, S.query, () => modelsForMatch(S.sim));
