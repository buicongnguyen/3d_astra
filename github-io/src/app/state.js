// The one shared, mutable app state. Modules receive it as `S`; nothing hides in module globals
// except values that only one module touches. The app flow (started / paused / dialog) is the
// screen machine in screens.js, kept here as `S.screen`.
import { Governor } from "../governor.js";
import { createMatchStats } from "../match-stats.js";
import { loadSettings } from "../settings.js";
import { loadProgress, nextMission } from "../campaign.js";
import { createScreens } from "./screens.js";

export const MODE_KEY = "frontier-command.mode";

// New players open on Campaign; returning players keep the mode they last started. Browser
// tests (?test) keep the Skirmish default unless they ask for the first visit with ?firstrun.
function initialMode(query, progress) {
  if (query.has("test") && !query.has("firstrun")) return "skirmish";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (["training", "skirmish", "campaign", "defence"].includes(last)) return last;
    if (localStorage.getItem("frontier-training-complete") || Object.keys(progress.cleared || {}).length) return "skirmish";
  } catch {
    /* Storage is optional. */
  }
  return "campaign";
}

export function createState() {
  const query = new URLSearchParams(location.search);
  const settings = loadSettings(matchMedia("(pointer:coarse)").matches);
  const campaign = loadProgress();
  const S = {
    query,
    screen: createScreens(),
    matchStats: createMatchStats(),
    settings,
    // The battle set up on the start screen (battleSetup in briefing.js fills these in).
    mapId: "riverlands",
    enemyCount: 1,
    aiSpeed: "normal",
    alliance: "ffa",
    // Skirmish "Enemy faction" and what the colours and emblems follow (factions.js matchLook).
    enemyFaction: "mirror",
    look: null,
    bonus: null,
    mission: null,
    ambience: undefined,
    // Training panel, campaign progress, and the mode/stage picked on the start screen.
    tutorial: null,
    tutorialShown: -1,
    campaign,
    stagePick: nextMission(campaign),
    // Frontier Defence: the level picked on the start screen and the pad tapped in a match (app/defence-entry.js).
    defencePick: 0,
    defencePad: null,
    activeStage: null,
    // The match and its view (sim is created by createSim in main.js, view by boot).
    sim: null,
    view: undefined,
    selected: new Set(),
    hover: null,
    mode: null,
    buildType: null,
    muted: settings.muted,
    // Slow devices give up cosmetic motion, then resolution, to keep play smooth (governor.js).
    // Browser tests opt in with ?governor=1 so their measurements see fixed quality.
    governor: null,
    governed: !query.has("test") || query.get("governor") === "1",
    accumulator: 0,
    noticeTimeout: undefined,
    audioContext: undefined,
    audio: undefined,
    pointer: { x: 0, y: 0, inside: false },
    drag: null,
    keys: new Set(),
    groups: new Map(),
    rememberedBuildings: new Map(),
    rememberedResources: new Map(),
    lastSelectionKey: "",
    milestones: { economy: false, army: false },
    touchInput: matchMedia("(pointer: coarse)").matches,
    lastTouch: -Infinity,
    touchControls: undefined,
    boxSelection: false,
    queueOrders: false,
    buildPoint: null,
    blockedBuildType: null,
    buildFailure: "",
    aimPoint: null,
    hoverPoint: null,
    hoverStale: false,
    // Enemy-wave and capture-point pings drawn on the minimap, a mission camera pan, autosave clock.
    pings: [],
    cameraPan: null,
    saveClock: 0,
    loadFailed: false,
  };
  // The play mode lives in the screen machine (screens.js); S.playMode reads and sets it there,
  // so every Training / Skirmish / Campaign change is checked against the legal moves.
  Object.defineProperty(S, "playMode", { get: () => S.screen.mode, set: (mode) => S.screen.setMode(mode), enumerable: true });
  S.playMode = initialMode(query, campaign);
  S.governor = new Governor({
    onChange: (level) => {
      S.view?.setMotionLevel(level.motion);
      S.view?.setLifeShare(level.life);
      S.view?.setRenderScale(level.scale);
    },
  });
  return S;
}
