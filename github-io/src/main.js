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
import { setupTypeChips } from "./app/type-chips.js";
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
import { setupMessageStack } from "./app/message-stack.js";
import { setupCover } from "./app/cover.js";
import { setupQuickBattle } from "./quick-battle.js";
import { setupLan } from "./lan-entry.js"; // W11 LAN play: the title tile; the rest loads on first use (src/net/)
import { setupMeta } from "./meta-ui.js";
import { setupReplay } from "./replay-ui.js";
import { setupSkywing } from "./skywing-ui.js"; // H1/H2: Skywing assist and the coin wallet
import { setupHeroMode } from "./hero-mode.js"; // H3a/H3d: Hero mode (camera, controls, battle time, dodging)
import { setupHeroChallenges } from "./hero-challenges-ui.js";
// The command console kit on every screen (round 3 kit pass): loaded after every other stylesheet.
import "./kit-skin.css";
import "./menu-pro.css";
import "./hero-plates.css"; // campaign heroes: the nameplates (src/hero-view.js)
import "./theme-walnut.css";
import "./hud-contrast.css";
import "./phone-hud-slim.css";
import "./phone-topbar.css";
import "./phone-handed.css";
import "./theme-switch.js";
import { setupWildUi } from "./app/wild-ui.js";
import { rulesForMap } from "./app/rules-store.js";
import { rememberOptions } from "./meta/replay.js";

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
  // W6: the options are remembered beside the match (meta/replay.js), so a finished match can be replayed.
  const options = { factions: S.mission || S.playMode !== "skirmish" ? null : skirmishSides(S.playerFaction, S.enemyFaction, S.enemyCount, S.mapId), map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, playerBonus: S.bonus, mission: S.mission ? resolveMission(S.mission, S.campaign) : null, difficulty: S.settings.campaignDifficulty, capturePoints: !S.mission && S.playMode === "skirmish", ...(S.playMode === "training" || !S.query || (S.query.has("test") && !S.query.has("rich")) ? (!S.mission && S.playMode === "skirmish" && rulesForMap(S.rules, S.mapId) ? { rules: rulesForMap(S.rules, S.mapId) } : {}) : { rules: { ...(!S.mission && S.playMode === "skirmish" ? rulesForMap(S.rules, S.mapId) : null), economy: "rich" } }) };
  const sim = rememberOptions(new Simulation(options), options);
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
  ["hud", setupHud], ["preferences", setupPreferences], ["sound", setupSound], ["selection", setupSelection], ["type-chips", setupTypeChips],
  ["orders", setupOrders], ["abilities", setupAbilities], ["command-card", setupCommandCard], ["minimap", setupMinimap],
  ["input-pointer", setupInputPointer], ["input-keyboard", setupInputKeyboard], ["modals", setupModals],
  ["briefing", setupBriefing], ["match-flow", setupMatchFlow], ["frame", setupFrame], ["ui-extras", setupUiExtras], ["choices", setupChoices], ["scenes", setupScenes], ["debug-hooks", setupDebugHooks],
  ["defence", setupDefenceEntry],
  ["rank", setupRank],
  // R3-Q: Quick battle and First watch wrap createSim, newGame, defenceMission and defenceHud, so they come last.
  ["quick-battle", setupQuickBattle],
  // W11 LAN play: its tile follows the Quick battle tiles in the quick row.
  ["lan", setupLan],
  ["wild", setupWildUi],
  // W6 replay value: after Quick battle, so the Records tile joins the quick row it fills.
  ["meta", setupMeta],
  // H1/H2: the Skywing row, the coin chip and the debrief's coins (after the rank toast).
  ["skywing", setupSkywing],
  // H3a/H3d Hero mode: its keys listen in the capture phase, before the RTS keys.
  ["hero-mode", setupHeroMode],
  // H8 Hero challenges: the title row, the challenge match (wraps createSim, newGame, skywingStart, heroTick), its HUD
  // strip and result card; after Hero mode, whose HUD it adds to.
  ["hero-challenges", setupHeroChallenges],
  // W6 replay viewer: binds last, so its wraps of showResult, openDecision, playScene, togglePause and newGame see the final ones.
  ["replay", setupReplay],
];
const BIND = ["preferences", "hud", "input-pointer", "sound", "frame", "modals", "briefing", "match-flow", "selection", "type-chips",
  "orders", "abilities", "command-card", "input-keyboard", "minimap", "ui-extras", "choices", "scenes", "debug-hooks", "defence", "rank", "quick-battle", "lan", "meta", "skywing", "hero-mode", "hero-challenges", "replay"];
const binds = Object.fromEntries(SETUP.map(([name, setup]) => [name, setup(S, A)]));
// The start screen shows the battle chosen there, so the first simulation is built from it.
({ map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, bonus: S.bonus, mission: S.mission, faction: S.enemyFaction, playerFaction: S.playerFaction } = A.battleSetup());
S.sim = createSim();
for (const name of BIND) binds[name]();
// The 3D world (terrain, scatter, environment map) is the heaviest step of the start: about 0.5 s on a fast PC,
// far more on a slow phone or a CI runner (15 s of a 19 s start with the CPU slowed 20x). Built right here it held
// the first paint (a blank page instead of the loading card) and the page's load event (its fonts and cover art
// finish only after it), so it waits for that load event: on a slow connection 0.8 s at most after the first
// frame (the loading card is up by then), and 3 s in a tab opened in the background, where frames do not run.
let booted = false;
const bootOnce = () => {
  if (booted) return;
  booted = true;
  boot();
};
// Here, not in bootOnce: it registers the service worker from a load listener, which must exist before load fires.
registerOffline(A, S.query, () => modelsForMatch(S.sim));
// PC: transient battle messages stack at the top left (app/message-stack.js).
setupMessageStack();
if (document.readyState === "complete") setTimeout(bootOnce, 0);
else addEventListener("load", () => setTimeout(bootOnce, 0), { once: true });
requestAnimationFrame(() => setTimeout(bootOnce, 800));
setTimeout(bootOnce, 3000);
