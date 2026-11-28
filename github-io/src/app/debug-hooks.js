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
      // H3c: the steward runs the player's base and army (sim/steward.js), through the command door like any order.
      steward: (on = true) => { const ok = S.sim.command({ team: 0, type: "steward", on: !!on }); A.updateUI(); return ok; },
      // W13: the notice line (a routine notice, an alert, clear) and the touch camera twist (radians, session only).
      notice: (text) => A.notice(text),
      alertNotice: (text) => A.alert(text),
      clearMessages: () => A.clearMessages(),
      get cameraTwist() { return S.cameraTwist || 0; },
      restart: A.restart,
      // Skirmish rules for the next match built (createSim passes S.rules to the Simulation; round 2).
      // Tests set them before restart() and clear them after (undefined or null).
      get rules() { return S.rules; },
      set rules(r) { S.rules = r || null; },
      get paused() {
        return Z.paused;
      },
      // Freeze the match clock (rendering goes on); tests then advance time only with step().
      get hold() { return !!S.testHold; },
      set hold(on) { S.testHold = !!on; },
      // Browser suites only: transient messages (fight hint, voice caption) stay up past their time until released,
      // so a slow CI runner measures them deterministically (tests/lib/pc-messages.mjs). Released, they end at once.
      get holdMessages() { return !!globalThis.__frontierHoldMessages; },
      set holdMessages(on) { globalThis.__frontierHoldMessages = !!on; },
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
      // R3-B: the order a click or tap gives at a world point, through the same path as the player's
      // (app/orders.js commandAt, which adds the group-pace flag).
      commandAt: (x, z, targetId = null, forced = null) => A.commandAt({ x, z }, targetId == null ? null : S.sim.get(targetId), false, forced),
      // R3-G: straight to a boss fight ("iron-vanguard", or a unit type; app/scenes.js), and a mission
      // opening played on demand (scene() then reports { opening: { mission, frames, t, seconds, from, to } }).
      jumpBoss: (id) => A.jumpBoss(id),
      playOpening: () => A.playOpening(),
      // R3-V: the victory ceremony's state (phase, stamps landed, screens dressed) and the match-end listener list.
      get ceremony() { return A.ceremony?.info() ?? null; },
      onMatchEnd: (fn) => A.onMatchEnd?.(fn),
      mvp: () => S.matchStats.mvp?.() ?? null,
      // R3-R: the commander rank (xp, rank, picks, the last match's XP) and a pick through the same path as a tap.
      rank: () => A.rankInfo?.() ?? null,
      // W6 replay value (src/meta-ui.js): the record, achievements, challenges, history and the replay viewer.
      get meta() { return A.metaHooks ?? null; },
      rankPick: (kind, id) => A.rankPick?.(kind, id),
      // R3-Q: whether the match being played (or the next one built) is a Quick battle.
      get quick() { return !!S.quick; },
      // H3b close view: units within ~25 m of (x, z) draw their close-up detail models (resolves when the files are in);
      // closeView(false) turns it off. closeInfo: on, centre, radius, units near, detail types drawn and loaded.
      closeView: (on, x, z, radius) => S.view.setCloseView(on ? { x, z, radius } : null),
      get closeInfo() { return S.view?.closeView?.info() ?? null; },
      // H3a/H3d Hero mode (src/hero-mode.js): enter (with a hero id, else the one the button picks), leave, and its state
      // (on, hero, Skywing, camera yaw and zoom, the clock scale, the aim point and target, the rocket lock).
      heroMode: { enter: (id) => A.enterHeroMode(id ?? undefined), leave: () => A.leaveHeroMode(), get info() { return A.heroInfo(); } },
      // H8 Hero challenges (src/hero-challenges-ui.js): start one by id, read the best stars, clear them.
      heroChallenges: { start: (id) => A.heroChallenges?.start(id), get progress() { return A.heroChallenges?.progress(); }, reset: () => A.heroChallenges?.reset() },
    };
  }

  Object.assign(A, { installDebugHooks });
  return function bind() {};
}
