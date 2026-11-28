// Starting, restarting, saving, continuing and finishing a match.
import { showTitleCard, hideTitleCard } from "./title-card.js";
import emblemUrl from "../art/emblem.webp";
import { $ } from "./dom.js";
import { recordDecisions, recordSquad, recordOptional, recordEnding, endingFor, resolveMission, saveProgress, missionById, missionsOf, recordIn, bestIn } from "../campaign.js";
import { MODE_KEY } from "./state.js";
import { enemyFactionOf, playerFactionOf, matchLook } from "../factions.js";
import { Simulation } from "../simulation.js";
import { Tutorial } from "../tutorial.js";
import { clearSave, writeSave, readSave } from "../savegame.js";
import { icon } from "../icons.js";
import { setMusicMood } from "../music.js";
import { skirmishResultHTML } from "../results-ui.js";
import { defenceLevel } from "../defence/levels.js";
import { createCeremony, emitMatchEnd, onMatchEnd, fallbackMvp, lossTip, closeness } from "../ceremony.js";

export function setupMatchFlow(S, A) {
  const Z = S.screen;
  // R3-V: the victory ceremony (ceremony.js). A win plays its slow motion and camera swing before the
  // results open (once per match); every results screen is then dressed (MVP card, stamp, confetti,
  // count-up, or "So close" and a tip) and the onMatchEnd listeners hear about it.
  const ceremony = createCeremony(S, A);
  let beatRan = false, ceremonyFor = null;
  // The MVP with where it stands now (a live unit moves on during the beat).
  function currentMvp() {
    const mvp = S.matchStats.mvp?.() || fallbackMvp(S.sim);
    const live = mvp && S.sim.entities.find((e) => e.id === mvp.id && e.hp > 0);
    return mvp && live ? { ...mvp, x: live.x, z: live.z } : mvp;
  }
  function showResult() {
    if (S.sim.result === "victory" && !S.tutorial && ceremonyFor !== S.sim && ceremony.animated) {
      ceremonyFor = S.sim;
      const mvp = currentMvp();
      if (ceremony.begin({ slow: beatRan ? null : S.matchStats.lastKill, mvp, done: openResult })) return;
    }
    openResult();
  }
  function openResult() {
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
      $("modal-content").innerHTML = `<h2 id="modal-title">${S.tutorial.done?"Training complete!":"Training ended"}</h2><p>You practiced selection, economy, construction, production, attacking and withdrawal. Campaign introduces an active opponent.</p><button class="primary" data-training-campaign>Campaign menu</button><button class="secondary" data-restart>Replay training</button><button class="secondary" data-new-game>Choose a game</button>`;$("modal").querySelector(".primary").focus();announce("training");return;
    }
    if (S.activeStage !== null) { showDebrief(win); dress("campaign"); return; }
    // The Defence screens load lazily (app/defence-entry.js): dress the result once it is on the page.
    if (S.sim.defence) { const sim = S.sim; Promise.resolve(A.defenceResult()).then(() => { if (S.sim === sim && Z.modalType === "result") dress("defence"); }); return; }
    // H8 Hero challenges (src/hero-challenges-ui.js): stars, coins, Retry, the other challenge and the main menu.
    if (S.sim.missionDef?.challenge && A.challengeResultHTML) {
      $("modal").classList.add("result-wide");
      $("modal-content").innerHTML = A.challengeResultHTML();
      $("modal").querySelector(".primary")?.focus();
      dress("challenge");
      return;
    }
    $("modal").classList.add("result-wide");
    $("modal-content").innerHTML = skirmishResultHTML({ result: S.sim.result, seconds: S.sim.time, stats: S.matchStats.stats, emblem: emblemUrl, arrow: icon("arrow"), faction: playerFactionOf(S.sim) });
    $("modal").querySelector(".primary").focus();
    dress("skirmish");
  }

  // R3-V: the results screen on the page gets its MVP card or loss tip, stamp, confetti and count-up.
  // Endless and the Daily seed (a score, never a defeat to mourn) are dressed like a win, without the swing.
  function dress(mode) {
    const sim = S.sim, variant = sim.defence ? sim.missionDef?.variant || null : null, score = variant === "endless" || variant === "daily";
    const result = score ? "victory" : sim.result, win = result === "victory";
    const seconds = sim.mission?.clock ?? sim.time;
    const mvp = win ? currentMvp() : null;
    const added = ceremony.present($("modal-content"), { result, mode, mvp, tip: !win && mode !== "defence" ? lossTip(S.matchStats.stats, { seconds }) : null, near: win ? null : closeness(sim) });
    announce(mode, { mvp, added, variant, seconds });
    // Rank and MVP panels are inserted before the footer by the result listeners.
    const footer = $("modal-content").querySelector(".result-actions, .debrief-actions");
    if (footer && document.documentElement.classList.contains("compact-ui")) {
      const body = document.createElement("div");
      body.className = "result-scroll";
      while (footer.parentNode.firstChild !== footer) body.append(footer.parentNode.firstChild);
      footer.before(body);
    }
  }
  // onMatchEnd (ceremony.js): one summary per finished match, after its results screen is on the page.
  function announce(mode, { mvp = null, added = null, variant = null, seconds = S.sim.time } = {}) {
    const sim = S.sim, root = $("modal-content");
    const stars = Number(root.querySelector("[data-stars]")?.dataset.stars ?? NaN);
    // H8: a Hero challenge's stars better than its best so far pay coins (src/meta/coins.js).
    const newStars = mode === "challenge" ? Number(root.querySelector("[data-new-stars]")?.dataset.newStars ?? 0) || 0 : 0;
    emitMatchEnd({
      mode, result: sim.result, win: sim.result === "victory", seconds, stats: S.matchStats.stats, mvp,
      medal: mode === "campaign" && sim.result === "victory" ? sim.mission?.medal || "bronze" : null,
      stars: Number.isFinite(stars) ? stars : null, score: variant === "endless" || variant === "daily" ? sim.defence?.cleared ?? 0 : null,
      variant, difficulty: sim.difficulty || "standard", missionId: sim.missionDef?.id ?? null, campaignId: mode === "campaign" ? S.campaignId : null,
      tutorialDone: mode === "training" ? !!S.tutorial?.done : null, ceremony: added, root, ...(mode === "challenge" ? { newStars, challenge: sim.missionDef.challenge.id } : null),
    });
  }

  // Mission debrief: result, medal, time, objectives and the closing lines. A win records the
  // best time and medal, the Commander's decisions in this mission (a loss records nothing) and,
  // after the finale, the ending reached; then it opens the next mission or the epilogue.
  // A Faction Chronicle (0.20) records into progress.chronicles; its last win finishes it, which
  // adds its lead's line to the finale.
  function showDebrief(win) {
    const c = S.campaignId, list = missionsOf(c), main = c === "main";
    const n = S.activeStage, m = S.sim.missionDef || list[n], last = n === list.length - 1;
    let ending = null;
    if (win) {
      S.campaign = recordIn(S.campaign, c, n, S.sim.mission?.clock ?? S.sim.time, S.sim.mission?.medal || "bronze", S.sim.difficulty);
      if (main) S.campaign = recordDecisions(S.campaign, S.sim.flags);
      if (main) S.campaign = recordOptional(S.campaign, m.id, (m.objectives || []).filter((o) => o.optional && S.sim.mission?.objectives?.[o.id]?.state === "done").length);
      if (main && !S.sim.defence && S.sim.missionDef?.rules?.playerBase !== false) S.campaign = recordSquad(S.campaign, S.sim.entities, m.id);
      if (main && last) { ending = endingFor(S.campaign); S.campaign = recordEnding(S.campaign, ending); }
      saveProgress(S.campaign);
      S.stagePick = last ? n : n + 1;
    }
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = A.missionUI.debriefHTML({ mission: m, index: n, total: list.length, sim: S.sim, win, best: bestIn(S.campaign, c, n)?.time ?? null, hasNext: win && !last, stats: S.matchStats.stats, epilogue: ending,
      ...(main ? {} : { label: `CHRONICLE · ${n + 1}/${list.length}`, complete: "Chronicle complete. Its lead now speaks at the end of the main campaign." }) });
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

  function startEconomy(frameOpening = true) {
    // Browser suites (?test) measure a still economy; ?autoharvest gives them the real start.
    if (S.playMode === "training" || (S.query.has("test") && !S.query.has("autoharvest"))) return;
    S.sim.command({ team: 0, type: "harvest" });
    // Frame the working mine and the core together on narrow Skirmish openings.
    if (!frameOpening || S.playMode !== "skirmish" || S.view.width >= S.view.height) return;
    const own = S.sim.own(0), core = own.find(e => e.type === "hq");
    if (!core) return;
    const deposit = own.filter(e => e.type === "worker" && e.orders[0]?.type === "gather")
      .map(e => S.sim.get(e.orders[0].target)).filter(r => r?.type === "alloy")
      .sort((a, b) => Math.hypot(a.x-core.x, a.z-core.z) - Math.hypot(b.x-core.x, b.z-core.z))[0];
    if (deposit) S.view.focusOn((core.x + deposit.x) / 2, (core.z + deposit.z) / 2);
  }

  // The title card of a mission, Chronicle mission or Defence level as it begins (a tutorial and a skirmish have none).
  function showBaseObjective() {
    showTitleCard({ title: "Establish your economy", briefing: { place: "Your Harvesters are mining. Train more at the Command core, then build a Barracks." } });
  }
  A.showBaseObjective = showBaseObjective;

  function openTitleCard() {
    hideTitleCard();
    if (!S.sim.missionDef && S.playMode === "skirmish") {
      if (!S.query?.has("test") || S.query.has("opening") || S.query.has("titlecard")) showBaseObjective();
      return;
    }
    if (S.sim.missionDef && S.playMode !== "training" && (!S.query?.has("test") || S.query.has("titlecard"))) showTitleCard(S.sim.missionDef);
  }

  // restart() starts the current setup again; restart(false) only resets the interface around
  // the simulation that is already there (the briefing preview, or a saved match with resume).
  function restart(play = true, resume = false) {
    if (play !== false) S.sim = A.createSim();
    const models = A.ensureMatchModels(() => restart(play, resume));
    if (models) return models;
    S.matchStats.reset();
    ceremony.cancel(); beatRan = false;
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
    S.cameraTwist = 0; // W13: a new match starts untwisted
    S.view.reset();
    if (play !== false) S.view.fx?.sprites?.start(); // R3-FX: the weapon sprite sheets load when a battle starts, never on the title
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
    if (!resume) startEconomy(play !== false);
    if(play !== false && S.playMode === "training") beginTutorial();
    if (S.sim.defence) A.defenceBegin(resume);
    // H1/H2 Skywing: a restart buys it again when the match restarted had it (skywing-ui.js).
    if (play !== false && !resume) A.skywingStart?.(true);
    // Mission title card (W2-F): campaign, Chronicle and Defence matches, not a resumed save; browser suites (?test) opt in with ?titlecard.
    if (play !== false && !resume) openTitleCard();
  }

  function autosave() {
    // H8: a Hero challenge (a few minutes) is never saved: Continue would resume it as a plain skirmish.
    if (!Z.started || S.sim.result || S.playMode === "training" || S.tutorial || S.replay || S.sim.missionDef?.challenge) return false;
    S.saveClock = 0;
    return writeSave({ mode: S.playMode, missionId: S.activeStage !== null ? S.sim.missionDef?.id ?? missionsOf(S.campaignId)[S.activeStage].id : S.sim.defence ? S.sim.missionDef.id : null, sim: S.sim });
  }

  // Campaign: Start opens the mission briefing; the match begins from its "Begin mission".
  // The briefing reads the mission as this campaign plays it (earlier decisions settled).
  function openMissionBriefing() {
    Z.openBriefing();
    const label = S.campaignId === "main" ? null : `CHRONICLE · ${S.stagePick + 1}/${missionsOf(S.campaignId).length}`;
    A.missionUI.openBriefing(resolveMission(missionsOf(S.campaignId)[S.stagePick], S.campaign), S.stagePick, { label, difficulty: S.settings.campaignDifficulty, onBegin: () => { Z.closeBriefing(); beginMatch(); }, onBack: () => Z.closeBriefing() });
  }

  function beginMatch() {
    S.sim = A.createSim();
    const models = A.ensureMatchModels(() => beginMatch());
    if (models) return models;
    try { localStorage.setItem(MODE_KEY, S.playMode); } catch { /* Storage is optional. */ }
    ceremony.cancel(); beatRan = false;
    S.pings.length = 0;
    S.endBeat = null;
    A.resetHints?.();
    S.cameraPan = null;
    S.saveClock = 0;
    A.missionUI.resetMatch();
    setMusicMood("calm");
    S.audio?.reset();
    A.syncPointOwners();
    S.cameraTwist = 0; // W13: a new match starts untwisted
    S.view.reset();
    A.focusHome();
    S.hover = null;
    $("hover-label").hidden = true;
    S.governor.reset();
    S.tutorial = null;
    S.activeStage = S.playMode === "campaign" ? S.stagePick : null;
    S.view.fx?.sprites?.start(); // The menu path built its match with restart(false), which loads no weapon sprites.
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
    if (S.playMode === "training") A.notice(
      S.touchInput
          ? "Tap Workers, then tap amber crystals. Drag to pan; pinch to zoom."
          : "Select Harvesters, then right-click amber crystals to start your economy.",
    );
    if(S.playMode === "training") beginTutorial();
    if (S.sim.defence) A.defenceBegin();
    // H1/H2 Skywing: paid for here, as the match starts, when the briefing row says On (skywing-ui.js).
    A.skywingStart?.(false);
    A.tone(780, 0.15);
    openTitleCard();
  }

  function beginTutorial(){
    S.tutorial = new Tutorial(S.sim); S.tutorialShown = -1; A.setSelection([]); A.renderTutorial();
  }

  Object.assign(A, { newGame, autosave, restart, nextMissionNow, showResult, onMatchEnd, ceremony });
  return function bind() {
    // R3-V: every setup has run, so app/ui-extras.js's beat is on A. Remember whether the core beat slowed
    // the last kill already, and let the ceremony scale the view's time while it plays.
    const beginBeat = A.beginBeat, stepBeat = A.stepBeat;
    if (beginBeat) A.beginBeat = () => (beatRan = !!beginBeat());
    if (stepBeat) A.stepBeat = (dt) => { const scale = stepBeat(dt); return ceremony.active ? ceremony.step(dt) : scale; };
    document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });

    window.addEventListener("pagehide", () => autosave());

    // Continue: restore the saved match and come back paused on the pause menu, or on the
    // decision card when the save was taken while one was open. A story mission continues with
    // the mission data saved in the match (not today's), so it plays and replays exactly.
    $("continue").onclick = async () => {
      // A campaign save names its mission by id, in the main campaign or a Faction Chronicle (0.20).
      const save = readSave(), found = save?.missionId && save.mode === "campaign" ? missionById(save.missionId) : null, index = found?.index ?? -1;
      const level = save?.mode === "defence" ? defenceLevel(save.missionId) : null;
      const loaded = save && (save.mode === "defence" ? !!level : save.mode !== "campaign" || index >= 0) ? Simulation.load(save.text) : null;
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
      S.rules = loaded.rules ? { ...loaded.rules } : null;
      S.mapId = S.sim.terrain.id; S.enemyCount = S.sim.enemyCount; S.aiSpeed = S.sim.aiSpeed; S.alliance = S.sim.coalition ? "coalition" : "ffa";
      S.mission = index >= 0 ? S.sim.missionDef || found.mission : level;
      // A loaded defence match keeps the level it was saved with (its options carry the definition).
      if (level) { S.mission = S.sim.missionDef; S.defencePick = Math.max(0, A.defenceIndex?.(level.id) ?? 0); }
      S.bonus = S.mission?.bonus || null;
      S.enemyFaction = S.mission ? "mirror" : enemyFactionOf(S.sim);
      // A story mission's army is its factions[0] (a Faction Chronicle) or Meridian; a skirmish's is the saved choice.
      S.playerFaction = playerFactionOf(S.sim);
      S.look = matchLook(S.mission, S.sim);
      if (!S.mission) { $("enemy-faction").value = S.enemyFaction; $("player-faction").value = S.playerFaction; }
      if (index >= 0) { S.campaignId = found.campaign; S.stagePick = index; }
      const resumed = await restart(false, true);
      S.view.fx?.sprites?.start();
      if (resumed === false) return;
      S.activeStage = index >= 0 ? index : null;
      S.view.setTerrain(S.sim.terrain);
      S.view.setMission(S.look);
      A.focusHome();
      $("hover-label").hidden = true;
      A.updateHeading();
      if (!(S.sim.mission?.pending && A.openDecision())) A.showPause();
    };

    $("start").onclick = () => {
      if (S.loadFailed) { A.loadAssets(); return; }
      A.unlockAudio();
      if (S.playMode === "campaign") { openMissionBriefing(); return; }
      beginMatch();
    };
  };
}
