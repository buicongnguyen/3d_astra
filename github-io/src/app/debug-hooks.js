// window.__frontier, the opt-in hook used by browser integration tests.
import { musicMood } from "../music.js";

export function setupDebugHooks(S, A) {
  const Z = S.screen;
  // Explicit opt-in hook used by browser integration tests. Absent in normal play.
  function installDebugHooks() {
    window.__frontier = {
      get tutorial(){return S.tutorial;},
      get sim() {
        return S.sim;
      },
      loadModels: types => A.loadAssets(types),
      get modelsReady() { return S.view?.modelsReady === true; },
      get view() {
        return S.view;
      },
      get selected() {
        return S.selected;
      },
      select: A.setSelection,
      restart: A.restart,
      get paused() {
        return Z.paused;
      },
      // Freeze the match clock (rendering goes on); tests then advance time only with step().
      get hold() { return !!S.testHold; },
      set hold(on) { S.testHold = !!on; },
      step: (seconds) => {
        for (let i = 0; i < seconds / 0.05; i++){S.tutorial?.update(S.sim,[...S.selected]);S.matchStats.before(S.sim);S.sim.tick(0.05);S.matchStats.after(S.sim);S.tutorial?.update(S.sim,[...S.selected]);}
        A.updateUI();
      },
      get started() {
        return Z.started;
      },
      get settings() {
        return S.settings;
      },
      governor: S.governor,
      // Story missions and saves.
      mission: A.missionUI,
      get campaign() { return S.campaign; },
      // Faction Chronicles (0.20): which campaign the list shows ("main" or a chronicle id), the pick and the mission playing.
      get chronicle() { return { campaign: S.campaignId, pick: S.stagePick, active: S.activeStage }; },
      get cameraPan() { return S.cameraPan; },
      get pings() { return S.pings; },
      get endBeat() { return S.endBeat; },
      get fightHint() { return document.getElementById("fight-hint"); },
      get mode() { return S.mode; },
      get musicMood() { return musicMood(); },
      get audio() { return S.audio; },
      // Recorded music (music-recorded.js): state() lists the cue, fetches and decoded buffers.
      get music() { return S.audio?.recorded; },
      save: A.autosave,
      // Commander decisions and endings (app/choices.js): the card's state and an epilogue by ending id.
      decision: () => ({ open: Z.modalType === "decision", pending: S.sim.mission?.pending || null, flags: S.sim.flags || null }),
      epilogue: (id, options) => A.showEpilogue(id, options),
      // Story scenes (app/scenes.js): fire one in-page, its state, skip it; and whether the audio is told the match is paused.
      playScene: (id) => A.playScene(id),
      scene: () => A.sceneState(),
      skipScene: () => A.skipScene(),
      get audioPaused() { return S.audioPaused ?? null; },
      renderCampaign: () => A.renderBriefing(),
    };
  }

  Object.assign(A, { installDebugHooks });
  return function bind() {};
}
