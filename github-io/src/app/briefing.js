import { DIFFICULTY_DESCRIPTIONS } from "../difficulty.js";
import { saveSettings } from "../settings.js";
// The start screen: mode switch, campaign list, battle setup and preview.
import { $ } from "./dom.js";
import { AI_SPEEDS } from "../ai-plan.js";
import { MAPS } from "../terrain.js";
import { MISSIONS, missionIndex, isUnlocked, isCleared, bestMedal, bestTime, ACTS } from "../campaign.js";
import { icon } from "../icons.js";
import { medalBadge, clock as missionClock } from "../mission-ui.js";
import { readSave } from "../savegame.js";
import { teamColors } from "../faction-colors.js";

export function setupBriefing(S, A) {
  const Z = S.screen;
  // Briefing: Skirmish picks the map, rivals, AI speed and alliance; Campaign plays the
  // stages in order. The battle behind the briefing always previews the current choice.
  function battleSetup() {
    if(S.playMode === "training") return {map:"classic",enemyCount:1,aiSpeed:"relaxed",alliance:"ffa",bonus:null,mission:null};
    const m = MISSIONS[S.stagePick];
    return S.playMode === "campaign"
      ? { map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, bonus: m.bonus || null, mission: m }
      : { map: $("scenario").value, enemyCount: Number($("enemy-count").value), aiSpeed: $("ai-speed").value, alliance: $("alliance").value, bonus: null, mission: null };
  }

  function describeRivals({ enemyCount: count, aiSpeed: speed, alliance: side }) {
    const pace = `${AI_SPEEDS[speed].label} speed`;
    return count === 1 ? `1 AI · ${pace}` : `${count} AIs · ${side === "coalition" ? "allied against you" : "free-for-all"} · ${pace}`;
  }

  const mapName = (id) => (MAPS[id] || String(id)).split(" · ")[0];

  function updateHeading() {
    const stage = Z.started ? S.activeStage : S.playMode === "campaign" ? S.stagePick : null;
    document.querySelector(".map-heading p").innerHTML = `${mapName(S.mapId).toUpperCase()} <span>·</span> SECTOR 07`;
    document.querySelector(".map-heading h1").innerHTML = stage === null
      ? `${mapName(S.mapId)}<span>.</span>` : `Mission ${stage + 1} · ${MISSIONS[stage].title}<span>.</span>`;
    $("operation-label").textContent = stage === null
      ? "OPERATION 01 / SKIRMISH" : `CAMPAIGN · MISSION ${String(stage + 1).padStart(2, "0")} / ${String(MISSIONS.length).padStart(2, "0")}`;
  }

  // The Continue button appears while a saved match exists (savegame.js).
  function renderContinue() {
    const save = Z.started ? null : readSave(), button = $("continue");
    const known = save && (save.mode !== "campaign" || missionIndex(save.missionId) >= 0);
    button.hidden = !known;
    if (!known) return;
    const title = save.mode === "campaign" ? MISSIONS[missionIndex(save.missionId)].title : mapName(save.map);
    const html = `${icon("play")}<span class="continue-text"><strong>Continue</strong><small><span>${title}</span> · <span translate="no">${A.formatTime(save.time)}</span></small></span>`;
    if (button.dataset.html !== html) { button.dataset.html = html; button.innerHTML = html; }
  }

  function renderCampaign() {
    const card = (m, i) => {
      const open = isUnlocked(S.campaign, i), done = isCleared(S.campaign, i), medal = bestMedal(S.campaign, i);
      const state = done ? `${medalBadge(medal)}${S.campaign.cleared[m.id]?.difficulty === "veteran" ? '<span title="Veteran clear" aria-label="Veteran clear">★</span>' : ""}<span translate="no">${missionClock(bestTime(S.campaign, i))}</span>` : open ? "" : icon("lock");
      return `<li><button data-stage="${i}" data-mission="${m.id}"${i === S.stagePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}${open ? "" : ' title="Clear the previous mission to unlock"'}><b>${i + 1}</b><span><strong>${m.title}</strong><small>${mapName(m.map)}</small></span><em${done ? ` data-medal="${medal}"` : ""}>${state}</em></button></li>`;
    };
    $("campaign-setup").innerHTML = ACTS.map(({ act, title }) =>
      `<section class="act" aria-labelledby="act-${act}"><h3 class="act-title" id="act-${act}"><span>ACT ${act}</span> <strong>${title}</strong></h3><ol class="stage-list" aria-label="Campaign missions">${MISSIONS.map((m, i) => (m.act === act ? card(m, i) : "")).join("")}</ol></section>`).join("");
  }

  function renderBriefing() {
    const setup = battleSetup(), inCampaign = S.playMode === "campaign";
    renderContinue();
    $("briefing-goal").textContent = S.playMode === "training" ? "Complete eight guided lessons"
      : inCampaign ? (MISSIONS[S.stagePick].objectives.find((o) => !o.hidden && !o.optional) || MISSIONS[S.stagePick].objectives[0]).text : "Eliminate enemy command";
    for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === S.playMode));
    $("skirmish-setup").hidden = S.playMode !== "skirmish";
    $("campaign-setup").hidden = !inCampaign;
    $("campaign-difficulty").hidden = !inCampaign;
    for (const button of document.querySelectorAll('[data-difficulty]')) button.setAttribute('aria-pressed', String(button.dataset.difficulty === S.settings.campaignDifficulty));
    $("difficulty-description").textContent = DIFFICULTY_DESCRIPTIONS[S.settings.campaignDifficulty];
    $("training-setup").hidden = S.playMode !== "training";
    // Alliances need at least two AIs.
    $("alliance").disabled = Number($("enemy-count").value) < 2;
    $("briefing-rivals").textContent = S.playMode === "training" ? "Practice field · no AI attacks" : describeRivals(setup);
    if (inCampaign) {
      const m = MISSIONS[S.stagePick];
      $("briefing-title").textContent = `Mission ${S.stagePick + 1} · ${m.title}`;
      $("briefing-text").textContent = m.briefing.lines[0]?.text || m.briefing.place;
      renderCampaign();
    } else {
      $("briefing-title").innerHTML = "A new frontier.<br> A foothold to defend.";
      // Separate text nodes so each catalog sentence translates on its own.
      $("briefing-text").replaceChildren("Build your outpost. Harvest the valley. Lead your expedition against rival commanders.",
        ...(setup.enemyCount < 2 ? [] : [setup.alliance === "coalition"
          ? " Your rivals are allied: they share scouting, raid your Harvesters and attack together."
          : " Every faction fights for itself."]));
    }
    if(S.playMode === "training"){ $("briefing-title").textContent="Commander training"; $("briefing-text").textContent="Learn selection, movement, harvesting, construction, production, attack and withdrawal in eight guided steps. Training supplies replenish. Leave or replay whenever you like."; }
    if (!$("start").disabled && !S.loadFailed) $("start").textContent = S.playMode === "training" ? "Start training" : inCampaign ? `Start mission ${S.stagePick + 1}` : "Start";
  }

  function previewBattle() {
    if (Z.started) return;
    const setup = battleSetup();
    const same = (!setup.mission || S.sim.difficulty === S.settings.campaignDifficulty) && setup.map === S.mapId && setup.enemyCount === S.enemyCount && setup.aiSpeed === S.aiSpeed && setup.alliance === S.alliance && setup.bonus === S.bonus && setup.mission === S.mission;
    if (!same) {
      const terrain = setup.map !== S.mapId || setup.enemyCount !== S.enemyCount;
      ({ map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, bonus: S.bonus, mission: S.mission } = setup);
      S.sim = A.createSim();
      S.view?.reset();
      A.ensureMatchModels();
      S.hover = null;
      $("hover-label").hidden = true;
      if (terrain) S.view?.setTerrain(S.sim.terrain);
      S.view?.setMission(S.mission);
      document.documentElement.style.setProperty("--team-hostile", teamColors(S.settings, S.mission)[1]);
      S.selected.clear();
      S.rememberedBuildings.clear();
      S.rememberedResources.clear();
      A.updateUI();
    }
    // Choosing a battle (even the same one) re-centres the preview on your base.
    A.focusHome();
    updateHeading();
    renderBriefing();
  }

  Object.assign(A, { previewBattle, renderContinue, updateHeading, renderBriefing, battleSetup });
  return function bind() {
    $("campaign-difficulty").onclick = event => {
      const button = event.target.closest('[data-difficulty]');
      if (!button || Z.started) return;
      S.settings.campaignDifficulty = button.dataset.difficulty;
      saveSettings(S.settings);
      previewBattle();
    };
    for (const id of ["scenario", "enemy-count", "ai-speed", "alliance"]) $(id).onchange = previewBattle;

    $("briefing").querySelector(".mode-switch").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button || Z.started) return;
      S.playMode = button.dataset.mode;
      previewBattle();
    });

    $("campaign-setup").onclick = (event) => {
      const button = event.target.closest("[data-stage]");
      if (!button || button.disabled || Z.started) return;
      S.stagePick = Number(button.dataset.stage);
      previewBattle();
    };
  };
}
