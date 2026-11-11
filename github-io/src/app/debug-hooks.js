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
      get cameraPan() { return S.cameraPan; },
      get pings() { return S.pings; },
      get endBeat() { return S.endBeat; },
      get fightHint() { return document.getElementById("fight-hint"); },
      get mode() { return S.mode; },
      get musicMood() { return musicMood(); },
      get audio() { return S.audio; },
      save: A.autosave,
    };
  }

  Object.assign(A, { installDebugHooks });
  return function bind() {};
}
