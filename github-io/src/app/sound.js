import { MIX, SOUND_TESTS } from "../audio-mix.js";
// Browser audio context, UI tones and the audio clock (sleeps while paused or hidden).
import { Ambience, audioPower } from "../ambience.js";
import { musicScreen, spatialMix } from "../audio-logic.js";

export function setupSound(S, A) {
  const Z = S.screen;
  let lastTone = 0,
    audioLoading = null;
  function tone(frequency = 520, duration = 0.065) {
    if (
      S.muted ||
      S.settings.masterVolume <= 0 ||
      S.settings.sfxVolume <= 0 ||
      !S.audioContext ||
      audioQuiet() ||
      performance.now() - lastTone < 70
    )
      return;
    lastTone = performance.now();
    const oscillator = S.audioContext.createOscillator(),
      gain = S.audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, S.audioContext.currentTime);
    gain.gain.setValueAtTime(
      0.07,
      S.audioContext.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      S.audioContext.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(S.audio?.bus.sfx ?? S.audioContext.destination);
    oscillator.start();
    oscillator.stop(S.audioContext.currentTime + duration);
  }

  function unlockAudio() {
    try {
      S.audioContext ||= new AudioContext();
      S.ambience ||= new Ambience(S.audioContext);
      // The sound engine (audio.js, sfx.js) is its own chunk, fetched on the first gesture.
      if (!S.audio && !audioLoading) {
        const context = S.audioContext;
        audioLoading = import("../audio.js").then(({ AudioDirector }) => {
          if (S.audio) return;
          // Pan and distance gain from the screen position and the camera's zoom; the selection feeds the engine hum.
          S.audio = new AudioDirector(context, {
            project: (x, z) => { const p = S.view.project(x, z, 0.5); return spatialMix(p.x, p.y, S.view.width, S.view.height, S.view.zoom); },
            selected: () => S.selected,
          });
          S.audio.applySettings(S.settings);
        }).catch(() => { audioLoading = null; });
      }
      // "interrupted" is iOS after a call or app switch; only a user gesture brings it back.
      if (S.audioContext.state !== "running" && !audioQuiet()) audioPower(S.audioContext, false);
    } catch {
      /* Audio is optional. */
    }
  }

  // The audio clock sleeps while the match is paused or the page is hidden. A pause waits for
  // the ambience to fade first; the result screen keeps sound for its jingle.
  let audioIdle = 0,
    audioRetry = 0;

  let auditionUntil = 0;
  // A Commander decision card holds the match but keeps its music (screens.js, "decision").
  const audioQuiet = () => document.hidden || (Z.started && Z.paused && !S.sim.result && Z.modalType !== "decision" && performance.now() >= auditionUntil);
  async function playSoundTest(name) {
    if (!Object.hasOwn(SOUND_TESTS,name)) return;
    auditionUntil = performance.now() + MIX.auditionSeconds * 1000;
    unlockAudio();
    await audioLoading;
    if (!S.audioContext || document.hidden) return;
    await S.audioContext.resume();
    S.audio?.sfx.play(name);
  }

  function syncAudio(dt = 0) {
    if (!S.audioContext) return;
    const quiet = audioQuiet();
    audioIdle = quiet ? audioIdle + dt : 0;
    if (quiet ? !document.hidden && audioIdle < 0.5 : (audioRetry -= dt) > 0) return;
    audioRetry = 1;
    audioPower(S.audioContext, quiet);
  }

  // The screen the music follows (musicPlan in audio-logic.js): the start screen's mode, a campaign
  // briefing, the match, or its result. A Defence level exposes `sim.defence.phase` ("calm" between waves).
  const menuView = () => (Z.briefing ? "briefing" : S.playMode);
  const musicNow = () => musicScreen({ started: Z.started, result: S.sim?.result, menuView: menuView(), defenceCalm: S.sim?.defence?.phase === "calm" });

  // The first gesture anywhere on the start screen unlocks audio, so the title music starts before
  // Start is pressed. Mouse presses and keys grant the browser's permission on the way down, touch on
  // the way up. The listeners go once the context runs (or a match has begun).
  const firstGesture = (event) => {
    if (S.audioContext?.state === "running" || Z.started) {
      for (const type of ["pointerdown", "pointerup", "keydown"]) window.removeEventListener(type, firstGesture, true);
      return;
    }
    if (event.type === "pointerdown" && event.pointerType !== "mouse") return;
    if (event.type === "keydown" && event.key === "Escape") return;
    unlockAudio();
  };

  Object.assign(A, { tone, unlockAudio, syncAudio, playSoundTest, musicScreen: musicNow });
  return function bind() {
    document.addEventListener("visibilitychange", () => syncAudio());
    for (const type of ["pointerdown", "pointerup", "keydown"]) window.addEventListener(type, firstGesture, { capture: true, passive: true });
  };
}
