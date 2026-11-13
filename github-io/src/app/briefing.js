import { DIFFICULTY_DESCRIPTIONS } from "../difficulty.js";
import { saveSettings } from "../settings.js";
// The start screen: mode switch, campaign list, battle setup and preview.
import { $ } from "./dom.js";
import { AI_SPEEDS } from "../ai-plan.js";
import { MAPS } from "../terrain.js";
import { MISSIONS, ACTS, missionById, missionsOf, nextIn, chronicleUnlocked } from "../campaign.js";
import { chronicleListHTML, chronicleMissionsHTML, chronicleLabel, chronicleTitle, rowState } from "../chronicles-ui.js";
import DEFENCE_MAPS from "../defence/maps.json" with { type: "json" };
import { icon } from "../icons.js";
import { medalBadge, clock as missionClock } from "../mission-ui.js";
import { campaignMapHTML, missionChoices } from "../campaign-map-ui.js";
import { readSave } from "../savegame.js";
import { teamColors } from "../faction-colors.js";
import { DEFENCE_LEVELS, defenceLevel } from "../defence/levels.js";

export function setupBriefing(S, A) {
  const Z = S.screen;
  // The faction chosen last time (the first battle is built from the setup, see main.js).
  $("player-faction").value = S.settings.playerFaction;
  // Briefing: Skirmish picks the map, rivals, AI speed and alliance; Campaign plays the
  // stages in order. The battle behind the briefing always previews the current choice.
  function battleSetup() {
    // Training, the campaign and Defence always command Meridian; only a skirmish uses "Your faction".
    if(S.playMode === "training") return {map:"classic",enemyCount:1,aiSpeed:"relaxed",alliance:"ffa",bonus:null,mission:null,faction:"mirror",playerFaction:"meridian"};
    // Frontier Defence: the level is a mission-shaped definition (src/defence/levels.js).
    if (S.playMode === "defence") { const l = DEFENCE_LEVELS[S.defencePick] || DEFENCE_LEVELS[0]; return { map: l.map, enemyCount: l.enemies, aiSpeed: l.speed, alliance: l.alliance, bonus: null, mission: l, faction: "mirror", playerFaction: "meridian" }; }
    // The main campaign, or a Faction Chronicle played as its own faction (0.20: factions[0]).
    const m = missionsOf(S.campaignId)[S.stagePick] || MISSIONS[0];
    return S.playMode === "campaign"
      ? { map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, bonus: m.bonus || null, mission: m, faction: "mirror", playerFaction: (m.rules?.rosters && m.factions?.[0]) || "meridian" }
      : { map: $("scenario").value, enemyCount: Number($("enemy-count").value), aiSpeed: $("ai-speed").value, alliance: $("alliance").value, bonus: null, mission: null, faction: $("enemy-faction").value, playerFaction: $("player-faction").value };
  }

  function describeRivals({ enemyCount: count, aiSpeed: speed, alliance: side }) {
    const pace = `${AI_SPEEDS[speed].label} speed`;
    return count === 1 ? `1 AI · ${pace}` : `${count} AIs · ${side === "coalition" ? "allied against you" : "free-for-all"} · ${pace}`;
  }

  const mapName = (id) => (MAPS[id] || DEFENCE_MAPS[id]?.name || String(id)).split(" · ")[0];

  function updateHeading() {
    const stage = Z.started ? S.activeStage : S.playMode === "campaign" ? S.stagePick : null;
    // A campaign mission keeps the campaign heading even when it plays Defence rules (a chronicle's last mission).
    if (stage === null && A.defenceHeading?.()) return;
    const list = missionsOf(S.campaignId), chronicle = S.campaignId !== "main";
    document.querySelector(".map-heading p").innerHTML = `${mapName(S.mapId).toUpperCase()} <span>·</span> SECTOR 07`;
    document.querySelector(".map-heading h1").innerHTML = stage === null
      ? `${mapName(S.mapId)}<span>.</span>` : chronicle ? `${chronicleTitle(S.campaignId, list[stage])}<span>.</span>` : `Mission ${stage + 1} · ${MISSIONS[stage].title}<span>.</span>`;
    $("operation-label").textContent = stage === null
      ? "OPERATION 01 / SKIRMISH" : chronicle ? chronicleLabel(S.campaignId, stage) : `CAMPAIGN · MISSION ${String(stage + 1).padStart(2, "0")} / ${String(MISSIONS.length).padStart(2, "0")}`;
  }

  // The Continue button appears while a saved match exists (savegame.js).
  function renderContinue() {
    const save = Z.started ? null : readSave(), button = $("continue");
    // A campaign save names its mission by id: the main campaign or a Faction Chronicle.
    const found = save?.mode === "campaign" ? missionById(save.missionId) : null;
    const known = save && (save.mode === "defence" ? !!defenceLevel(save.missionId) : save.mode !== "campaign" || !!found);
    button.hidden = !known;
    if (!known) return;
    const title = save.mode === "campaign" ? found.mission.title : save.mode === "defence" ? defenceLevel(save.missionId).title : mapName(save.map);
    const html = `${icon("play")}<span class="continue-text"><strong>Continue</strong><small><span>${title}</span> · <span translate="no">${A.formatTime(save.time)}</span></small></span>`;
    if (button.dataset.html !== html) { button.dataset.html = html; button.innerHTML = html; }
  }

  function renderCampaign() {
    const c = S.campaignId;
    const card = (m, i) => {
      // Any campaign reads the same way: the main one by its record, a chronicle by progress.chronicles (0.20).
      const { open, done, best } = rowState(S.campaign, c, i), medal = best?.medal;
      const state = done ? `${medalBadge(medal)}${best?.difficulty === "veteran" ? '<span title="Veteran clear" aria-label="Veteran clear">★</span>' : ""}<span translate="no">${missionClock(best?.time)}</span>` : open ? "" : icon("lock");
      // A decision taken in this mission (0.19a): a small mark, with the order as its title.
      const choices = missionChoices(S.campaign, m.id).map((c) => `<span class="stage-choice" title="${c.option.label.replace(/"/g, "&quot;")}"><i class="cmap-choice ${c.option.mercy ? "mercy" : "firm"}" aria-hidden="true"></i><span>${c.option.mercy ? "Merciful" : "Firm"}</span></span>`).join("");
      return `<li><button data-stage="${i}" data-mission="${m.id}"${i === S.stagePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}${open ? "" : ' title="Clear the previous mission to unlock"'}><b>${i + 1}</b><span><strong>${m.title}</strong><small>${mapName(m.map)}${choices}</small></span><em${done ? ` data-medal="${medal}"` : ""}>${state}</em></button></li>`;
    };
    // The main campaign's acts with the Faction Chronicles under them, or the chosen chronicle's missions.
    $("campaign-setup").innerHTML = c === "main"
      ? ACTS.map(({ act, title }) =>
        `<section class="act" aria-labelledby="act-${act}"><h3 class="act-title" id="act-${act}"><span>ACT ${act}</span> <strong>${title}</strong></h3><ol class="stage-list" aria-label="Campaign missions">${MISSIONS.map((m, i) => (m.act === act ? card(m, i) : "")).join("")}</ol></section>`).join("") + chronicleListHTML({ progress: S.campaign, campaign: c })
      : chronicleMissionsHTML({ progress: S.campaign, campaign: c, card });
    // The campaign map in the hero (campaign-map-ui.js); redrawn only when what it shows changed.
    const map = campaignMapHTML({ progress: S.campaign, pick: S.stagePick, campaign: c });
    if (mapShown !== map) { mapShown = map; $("campaign-map").innerHTML = map; }
  }
  let mapShown = "";

  function renderBriefing() {
    const setup = battleSetup(), inCampaign = S.playMode === "campaign";
    renderContinue();
    const picked = missionsOf(S.campaignId)[S.stagePick] || MISSIONS[0];
    $("briefing-goal").textContent = S.playMode === "training" ? "Complete eight guided lessons"
      : inCampaign ? (picked.objectives.find((o) => !o.hidden && !o.optional) || picked.objectives[0]).text : "Eliminate enemy command";
    for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === S.playMode));
    $("skirmish-setup").hidden = S.playMode !== "skirmish";
    $("campaign-setup").hidden = !inCampaign;
    $("campaign-difficulty").hidden = !inCampaign && S.playMode !== "defence";
    $("defence-setup").hidden = S.playMode !== "defence";
    // Campaign shows the campaign map where the key art is.
    $("briefing").classList.toggle("campaign-view", inCampaign);
    $("campaign-map").hidden = !inCampaign;
    for (const button of document.querySelectorAll('[data-difficulty]')) button.setAttribute('aria-pressed', String(button.dataset.difficulty === S.settings.campaignDifficulty));
    $("difficulty-description").textContent = DIFFICULTY_DESCRIPTIONS[S.settings.campaignDifficulty];
    $("training-setup").hidden = S.playMode !== "training";
    // Alliances need at least two AIs.
    $("alliance").disabled = Number($("enemy-count").value) < 2;
    $("briefing-rivals").textContent = S.playMode === "training" ? "Practice field · no AI attacks" : describeRivals(setup);
    if (inCampaign) {
      const m = picked;
      $("briefing-title").textContent = S.campaignId === "main" ? `Mission ${S.stagePick + 1} · ${m.title}` : chronicleTitle(S.campaignId, m);
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
    if (S.playMode === "defence") A.renderDefenceMenu?.();
  }

  function previewBattle() {
    if (Z.started) return;
    const setup = battleSetup();
    const same = (!setup.mission || S.sim.difficulty === S.settings.campaignDifficulty) && setup.map === S.mapId && setup.enemyCount === S.enemyCount && setup.aiSpeed === S.aiSpeed && setup.alliance === S.alliance && setup.faction === S.enemyFaction && setup.playerFaction === S.playerFaction && setup.bonus === S.bonus && setup.mission === S.mission;
    if (!same) {
      const terrain = setup.map !== S.mapId || setup.enemyCount !== S.enemyCount;
      ({ map: S.mapId, enemyCount: S.enemyCount, aiSpeed: S.aiSpeed, alliance: S.alliance, bonus: S.bonus, mission: S.mission, faction: S.enemyFaction, playerFaction: S.playerFaction } = setup);
      S.sim = A.createSim();
      S.view?.reset();
      A.ensureMatchModels();
      S.hover = null;
      $("hover-label").hidden = true;
      if (terrain) S.view?.setTerrain(S.sim.terrain);
      S.view?.setMission(S.look);
      document.documentElement.style.setProperty("--team-hostile", teamColors(S.settings, S.look)[1]);
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

  // Show a campaign's missions ("main" or a chronicle id) with its next open mission picked.
  function chooseCampaign(id) {
    if (id !== "main" && !chronicleUnlocked(S.campaign, id)) return;
    S.campaignId = id;
    S.stagePick = nextIn(S.campaign, id);
    previewBattle();
    // Keep keyboard focus in the list after it is redrawn.
    (document.querySelector('#campaign-setup [aria-current="true"]') || document.querySelector("#campaign-setup button:not([disabled])"))?.focus({ preventScroll: true });
  }

  Object.assign(A, { previewBattle, renderContinue, updateHeading, renderBriefing, battleSetup, chooseCampaign });
  return function bind() {
    $("campaign-difficulty").onclick = event => {
      const button = event.target.closest('[data-difficulty]');
      if (!button || Z.started) return;
      S.settings.campaignDifficulty = button.dataset.difficulty;
      saveSettings(S.settings);
      previewBattle();
    };
    for (const id of ["scenario", "enemy-count", "ai-speed", "alliance", "enemy-faction"]) $(id).onchange = previewBattle;
    // "Your faction" is remembered between visits (settings.playerFaction).
    $("player-faction").onchange = () => {
      S.settings.playerFaction = $("player-faction").value;
      saveSettings(S.settings);
      previewBattle();
    };

    $("briefing").querySelector(".mode-switch").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button || Z.started) return;
      S.playMode = button.dataset.mode;
      previewBattle();
    });

    $("defence-setup").onclick = (event) => {
      const button = event.target.closest("[data-level]");
      if (!button || button.disabled || Z.started) return;
      S.defencePick = Number(button.dataset.level);
      previewBattle();
    };

    $("campaign-setup").onclick = (event) => {
      if (Z.started) return;
      // A Faction Chronicle, or the way back to the main campaign (0.20).
      const pickCampaign = event.target.closest("[data-chronicle], [data-campaign]");
      if (pickCampaign) { if (!pickCampaign.disabled) chooseCampaign(pickCampaign.dataset.chronicle || pickCampaign.dataset.campaign); return; }
      const button = event.target.closest("[data-stage]");
      if (!button || button.disabled) return;
      S.stagePick = Number(button.dataset.stage);
      previewBattle();
    };
    // The map's relay nodes pick a mission like the list; a seen ending replays its epilogue; a
    // chronicle card opens that chronicle.
    $("campaign-map").onclick = (event) => {
      if (Z.started) return;
      const ending = event.target.closest("[data-ending]");
      if (ending) { A.showEpilogue(ending.dataset.ending); return; }
      const chronicle = event.target.closest("[data-chronicle]");
      if (chronicle) { if (!chronicle.disabled) chooseCampaign(chronicle.dataset.chronicle); return; }
      const node = event.target.closest("[data-map-stage]");
      if (!node || node.disabled) return;
      S.campaignId = "main";
      S.stagePick = Number(node.dataset.mapStage);
      previewBattle();
    };
  };
}
