// Browser audio context, UI tones and the audio clock (sleeps while paused or hidden).
import { Ambience, audioPower } from "../ambience.js";
import { AudioDirector } from "../audio.js";
import { screenMix } from "../audio-logic.js";

export function setupSound(S, A) {
  const Z = S.screen;
  let lastTone = 0;
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
      if (!S.audio) {
        S.audio = new AudioDirector(S.audioContext, { project: (x, z) => { const p = S.view.project(x, z, 0.5); return screenMix(p.x, p.y, S.view.width, S.view.height); } });
        S.audio.applySettings(S.settings);
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

  const audioQuiet = () => document.hidden || (Z.started && Z.paused && !S.sim.result);

  function syncAudio(dt = 0) {
    if (!S.audioContext) return;
    const quiet = audioQuiet();
    audioIdle = quiet ? audioIdle + dt : 0;
    if (quiet ? !document.hidden && audioIdle < 0.5 : (audioRetry -= dt) > 0) return;
    audioRetry = 1;
    audioPower(S.audioContext, quiet);
  }

  Object.assign(A, { tone, unlockAudio, syncAudio });
  return function bind() {
    document.addEventListener("visibilitychange", () => syncAudio());
  };
}
