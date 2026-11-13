// Frontier Command client: the composition root. It builds the page and the shared state,
// lets each module under app/ register what it offers (setup), connects them (bind) and boots.
// Imports below keep their original order on purpose: it fixes the order of the stylesheets.
import "./tutorial.js";
import "./governor.js";
import "./match-stats.js";
import "./results-ui.js";
import "./tutorial.css";
import "./style.css";
import "./mobile.css";
import "./settings.css";
import "./start-screen.css";
import "./desktop-dock.css";
import "./hud-readability.css";
import "./settings.js";
import "./settings-ui.js";
import "./i18n.js";
import "./language.css";
import "./terrain.js";
import "./ground-paint.js";
import "./faction-colors.js";
import "./ambience.js";
import "./field-guide.js";
import { Simulation } from "./simulation.js";
import { WorldView } from "./view.js";
import "./data.js";
import "./icons.js";
import "./touch-controls.js";
import "./fullscreen.js";
import "./hotkeys.js";
import "./construction-ui.js";
import "./production-ui.js";
import "./selection-status.js";
import "./tactics-ui.js";
import "./tactics-card.js";
import "./ai-plan.js";
import "./campaign.js";
import "./mission-ui.js";
import "./savegame.js";
import "./music.js";
import "./audio.js";
import "./audio-logic.js";
import "./portraits.js";
import "./ui-theme.css";
import "./landscape-hud.css";
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
import { resolveMission } from "./campaign.js";
import { CORE_MODEL_TYPES, modelsForMatch } from "./model-roster.js";
import { skirmishSides, matchLook } from "./factions.js";
import { prefetchModels, releaseModelBytes } from "./app/loading.js";
import "./loading.css";
import { registerOffline } from "./app/offline.js";

renderShell();
// S is the shared state; A is what each module offers the others (functions and widgets).
const S = createState();
const A = {};

// Every match, preview and restart is built from the current setup (a story mission included).
// A story mission plays as this player's campaign has it: earlier decisions and the ending are
// settled from the progress record (resolveMission, src/story/choices.js) before it starts.
const createSim = () => {
  // Only a skirmish lets the player choose sides: Training (and the campaign) always command Meridian.
  const sim = new Simulation({ factions: S.mission || S.playMode !== "skirmish" ? null : skirmishSides(S.playerFaction, S.enemyFaction, S.enemyCount, S.mapId), map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, playerBonus: S.bonus, mission: S.mission ? resolveMission(S.mission, S.campaign) : null, difficulty: S.settings.campaignDifficulty, capturePoints: !S.mission && S.playMode === "skirmish" });
  S.look = matchLook(S.mission, sim);
  return sim;
};

let bootReady = false, loadGeneration = 0;
async function loadAssets(types = modelsForMatch(S.sim)) {
  const generation = ++loadGeneration;
  S.loadFailed = false;
  $("start").disabled = true;
  const start = $("start");
  start.setAttribute("aria-busy", "true");
  try {
    // Staged download first (terrain, headquarters, harvester, then the rest), then the parse.
    await prefetchModels(({ stage, percent }) => {
      if (generation !== loadGeneration) return;
      start.textContent = `Loading ${stage}… ${percent}%`;
      start.style.setProperty("--load", `${percent}%`);
    }, {types});
    if (generation !== loadGeneration) return false;
    await S.view.loadModels(types);
    if (generation !== loadGeneration) return false;
    releaseModelBytes();
    start.removeAttribute("aria-busy");
    start.style.removeProperty("--load");
  } catch (error) {
    if (generation !== loadGeneration) return false;
    start.removeAttribute("aria-busy");
    console.error(error);
    S.loadFailed = true;
    $("start").disabled = false;
    $("start").textContent = "Retry";
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
  else { $("start").disabled = false; A.renderBriefing(); A.updateUI(); }
  return true;
}

function boot() {
  try {
    S.view = new WorldView($("world"), { terrain: S.sim.terrain, settings: S.settings, mission: S.look });
    S.view.onContextLost = A.graphicsLost;
    S.view.onContextRestored = A.graphicsRestored;
    $("quality").textContent = S.view.lowPower ? "Eco" : "High";
  } catch (error) {
    initFailed(error);
    return;
  }
  loadAssets(CORE_MODEL_TYPES);
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
  if (S.view.hasModels(types)) { S.view.modelsReady = true; return null; }
  S.view.modelsReady = false;
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
];
const BIND = ["preferences", "hud", "input-pointer", "sound", "frame", "modals", "briefing", "match-flow", "selection",
  "orders", "abilities", "command-card", "input-keyboard", "minimap", "ui-extras", "choices", "scenes", "debug-hooks", "defence"];
const binds = Object.fromEntries(SETUP.map(([name, setup]) => [name, setup(S, A)]));
// The start screen shows the battle chosen there, so the first simulation is built from it.
({ map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, bonus: S.bonus, mission: S.mission, faction: S.enemyFaction, playerFaction: S.playerFaction } = A.battleSetup());
S.sim = createSim();
for (const name of BIND) binds[name]();
boot();
registerOffline(A, S.query);
