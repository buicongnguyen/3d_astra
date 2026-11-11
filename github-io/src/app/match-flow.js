// Starting, restarting, saving, continuing and finishing a match.
import emblemUrl from "../art/emblem.webp";
import { $ } from "./dom.js";
import { MISSIONS, recordClear, saveProgress, bestTime, missionIndex } from "../campaign.js";
import { MODE_KEY } from "./state.js";
import { Simulation } from "../simulation.js";
import { Tutorial } from "../tutorial.js";
import { clearSave, writeSave, readSave } from "../savegame.js";
import { icon } from "../icons.js";
import { setMusicMood } from "../music.js";
import { skirmishResultHTML } from "../results-ui.js";

export function setupMatchFlow(S, A) {
  const Z = S.screen;
  function showResult() {
    Z.open("result");
    A.clearMode();
    A.setModalOpen(true);
    if (S.audio) S.audio.sfx.play(S.sim.result === "victory" ? "win" : "lose"); else A.tone(S.sim.result === "victory" ? 880 : 220, 0.3);
    const win = S.sim.result === "victory";
    // A finished match cannot be continued (Training never had a save of its own).
    if (!S.tutorial && S.playMode !== "training") clearSave();
    A.missionUI.endMatch();
    if(S.tutorial){
      if(S.tutorial.done){try{localStorage.setItem("frontier-training-complete","1");}catch{}}
      $("modal-content").innerHTML = `<h2 id="modal-title">${S.tutorial.done?"Training complete!":"Training ended"}</h2><p>You practiced selection, economy, construction, production, attacking and withdrawal. Campaign introduces an active opponent.</p><button class="primary" data-training-campaign>Campaign menu</button><button class="secondary" data-restart>Replay training</button><button class="secondary" data-new-game>Choose a game</button>`;$("modal").querySelector(".primary").focus();return;
    }
    if (S.activeStage !== null) return showDebrief(win);
    $("modal").classList.add("result-wide");
    $("modal-content").innerHTML = skirmishResultHTML({ result: S.sim.result, seconds: S.sim.time, stats: S.matchStats.stats, emblem: emblemUrl, arrow: icon("arrow") });
    $("modal").querySelector(".primary").focus();
  }

  // Mission debrief: result, medal, time, objectives and the closing lines. A win records the
  // best time and medal and opens the next mission.
  function showDebrief(win) {
    const n = S.activeStage, m = S.sim.missionDef || MISSIONS[n], last = n === MISSIONS.length - 1;
    if (win) {
      S.campaign = recordClear(S.campaign, n, S.sim.mission?.clock ?? S.sim.time, S.sim.mission?.medal || "bronze", S.sim.difficulty);
      saveProgress(S.campaign);
      S.stagePick = last ? n : n + 1;
    }
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = A.missionUI.debriefHTML({ mission: m, index: n, total: MISSIONS.length, sim: S.sim, win, best: bestTime(S.campaign, n), hasNext: win && !last, stats: S.matchStats.stats });
    document.querySelector("#modal .modal").scrollTop = 0;
    $("modal").querySelector(".primary").focus({ preventScroll: true });
  }

  // Next mission: back to the campaign screen with the next mission picked, straight into its briefing.
  async function nextMissionNow() {
    S.playMode = "campaign";
    await newGame();
    openMissionBriefing();
  }

  function newGame() {
    // One clean simulation for the briefing preview: restart(false) reuses it and starts no tutorial.
    S.sim = A.createSim();
    const models = A.ensureMatchModels(() => newGame());
    if (models) return models;
    restart(false);
    Z.toMenu();
    S.tutorial = null;
    S.activeStage = null;
    A.previewBattle();
    S.selected.clear();
    $("briefing").hidden = false;
    document.documentElement.classList.add("in-briefing");
    $("status-text").textContent = "CHOOSE YOUR BATTLEFIELD";
    S.view.resize();
    A.updateUI();
    // #scenario is hidden in campaign and training, so focus the first visible control instead.
    (S.playMode === "skirmish" ? $("scenario") : document.querySelector("[data-mode][aria-pressed=true]") || $("start"))?.focus();
  }

  function startEconomy() {
    // Browser suites (?test) measure a still economy; ?autoharvest gives them the real start.
    if (S.playMode !== "training" && (!S.query.has("test") || S.query.has("autoharvest"))) S.sim.command({ team: 0, type: "harvest" });
  }

  // restart() starts the current setup again; restart(false) only resets the interface around
  // the simulation that is already there (the briefing preview, or a saved match with resume).
  function restart(play = true, resume = false) {
    if (play !== false) S.sim = A.createSim();
    const models = A.ensureMatchModels(() => restart(play, resume));
    if (models) return models;
    S.matchStats.reset();
    S.touchControls?.reset();
    S.pings.length = 0;
    S.endBeat = null;
    A.resetHints?.();
    S.cameraPan = null;
    S.saveClock = 0;
    A.missionUI.resetMatch();
    setMusicMood("calm");
    S.audio?.reset();
    S.drag = null;
    S.keys.clear();
    S.pointer.inside = false;
    S.boxSelection = false;
    S.queueOrders = false;
    $("box-select").setAttribute("aria-pressed", "false");
    $("queue-orders").setAttribute("aria-pressed", "false");
    A.syncPointOwners();
    S.tutorial = null;
    S.view.reset();
    S.governor.reset();
    A.focusHome();
    S.selected.clear();
    S.groups.clear();
    S.rememberedBuildings.clear();
    S.rememberedResources.clear();
    S.milestones.economy = S.milestones.army = false;
    A.setObjectivesOpen(false);
    A.clearMode();
    Z.begin();
    S.accumulator = 0;
    S.hover = null;
    A.setModalOpen(false);
    $("briefing").hidden = true;
    document.documentElement.classList.remove("in-briefing");
    S.view.resize();
    $("status-text").textContent = "OPERATION ACTIVE";
    A.selectHome();
    if (play !== false || resume) A.syncAutocast();
    if (!resume) startEconomy();
    if(play !== false && S.playMode === "training") beginTutorial();
  }

  function autosave() {
    if (!Z.started || S.sim.result || S.playMode === "training" || S.tutorial) return false;
    S.saveClock = 0;
    return writeSave({ mode: S.playMode, missionId: S.activeStage !== null ? MISSIONS[S.activeStage].id : null, sim: S.sim });
  }

  // Campaign: Start opens the mission briefing; the match begins from its "Begin mission".
  function openMissionBriefing() {
    Z.openBriefing();
    A.missionUI.openBriefing(MISSIONS[S.stagePick], S.stagePick, { difficulty: S.settings.campaignDifficulty, onBegin: () => { Z.closeBriefing(); beginMatch(); }, onBack: () => Z.closeBriefing() });
  }

  function beginMatch() {
    S.sim = A.createSim();
    const models = A.ensureMatchModels(() => beginMatch());
    if (models) return models;
    try { localStorage.setItem(MODE_KEY, S.playMode); } catch { /* Storage is optional. */ }
    S.pings.length = 0;
    S.endBeat = null;
    A.resetHints?.();
    S.cameraPan = null;
    S.saveClock = 0;
    A.missionUI.resetMatch();
    setMusicMood("calm");
    S.audio?.reset();
    A.syncPointOwners();
    S.view.reset();
    A.focusHome();
    S.hover = null;
    $("hover-label").hidden = true;
    S.governor.reset();
    S.tutorial = null;
    S.activeStage = S.playMode === "campaign" ? S.stagePick : null;
    Z.begin();
    $("briefing").hidden = true;
    document.documentElement.classList.remove("in-briefing");
    S.view.resize();
    $("status-text").textContent = "OPERATION ACTIVE";
    A.selectHome();
    A.updateHeading();
    A.syncAutocast();
    startEconomy();
    // A story mission opens with its own first line instead of the general hint.
    if (S.playMode !== "campaign") A.notice(
      S.playMode !== "training"
        ? "Your Harvesters are mining. Train more at the Command core, then build a Barracks."
        : S.touchInput
          ? "Tap Workers, then tap amber crystals. Drag to pan; pinch to zoom."
          : "Select Harvesters, then right-click amber crystals to start your economy.",
    );
    if(S.playMode === "training") beginTutorial();
    A.tone(780, 0.15);
  }

  function beginTutorial(){
    S.tutorial = new Tutorial(S.sim); S.tutorialShown = -1; A.setSelection([]); A.renderTutorial();
  }

  Object.assign(A, { newGame, autosave, restart, nextMissionNow, showResult });
  return function bind() {
    document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });

    window.addEventListener("pagehide", () => autosave());

    // Continue: restore the saved match and come back paused on the pause menu.
    $("continue").onclick = async () => {
      const save = readSave(), index = save?.missionId ? missionIndex(save.missionId) : -1;
      const loaded = save && (save.mode !== "campaign" || index >= 0) ? Simulation.load(save.text) : null;
      if (!loaded) {
        clearSave();
        A.renderContinue();
        A.notice("The saved match could not be loaded and was removed.");
        $("start").focus();
        return;
      }
      A.unlockAudio();
      try { localStorage.setItem(MODE_KEY, save.mode); } catch { /* Storage is optional. */ }
      S.playMode = save.mode;
      S.sim = loaded;
      S.mapId = S.sim.terrain.id; S.enemyCount = S.sim.enemyCount; S.aiSpeed = S.sim.aiSpeed; S.alliance = S.sim.coalition ? "coalition" : "ffa";
      S.mission = index >= 0 ? MISSIONS[index] : null;
      S.bonus = S.mission?.bonus || null;
      if (index >= 0) S.stagePick = index;
      await restart(false, true);
      S.activeStage = index >= 0 ? index : null;
      S.view.setTerrain(S.sim.terrain);
      S.view.setMission(S.mission);
      A.focusHome();
      $("hover-label").hidden = true;
      A.updateHeading();
      A.showPause();
    };

    $("start").onclick = () => {
      if (S.loadFailed) { A.loadAssets(); return; }
      A.unlockAudio();
      if (S.playMode === "campaign") { openMissionBriefing(); return; }
      beginMatch();
    };
  };
}
