// The app flow as one small state machine. Every screen the player can be on is a name here,
// and every move between screens goes through one of the transition methods below, so the
// rules live in one place instead of being spread over `started`, `paused` and modal flags.
//
//   menu        The start screen. Its three views (Training, Skirmish, Campaign list) are the
//               play mode on the app state; the campaign mission briefing is the overlay that
//               mission-ui.js draws over this screen.
//   playing     A match is running.
//   held        A match is on but held with no dialog (for example after the graphics notice).
//   pause       Tactical pause dialog.            help        Controls dialog (also over pause).
//   result      Victory/defeat or the mission debrief.
//   graphics    "Graphics were interrupted" while WebGL restores.
//   fullscreen  Full-screen help for browsers that refuse.
//   guide       Field guide (unit and building stats).
//   settings    Settings dialog, opened over any other screen and returning to it.
//
// The data is deliberately the same three fields the app always had (`started`, `paused`,
// `modalType`) so behaviour is identical; `screen` is derived from them.

export const SCREENS = ["menu", "playing", "held", "pause", "help", "result", "graphics", "fullscreen", "guide", "settings"];
const MODALS = ["pause", "help", "result", "graphics", "fullscreen", "guide"];

// Which screen may follow which. `settings` returns to wherever it was opened from.
export const LEGAL = {
  menu: ["menu", "playing", "fullscreen", "guide", "graphics", "settings"],
  playing: ["playing", "menu", "pause", "help", "result", "graphics", "fullscreen", "guide", "settings"],
  held: ["held", "menu", "playing", "pause", "help", "result", "graphics", "fullscreen", "guide", "settings"],
  pause: ["pause", "menu", "playing", "help", "result", "graphics", "fullscreen", "guide", "settings"],
  help: ["help", "pause", "menu", "playing", "graphics", "fullscreen", "guide", "settings"],
  result: ["result", "menu", "playing", "held", "settings"],
  graphics: ["graphics", "pause", "held", "menu", "playing", "settings"],
  fullscreen: ["fullscreen", "menu", "playing", "held", "pause", "settings"],
  guide: ["guide", "menu", "playing", "held", "pause", "help", "settings"],
  settings: SCREENS,
};
export const isLegal = (from, to) => !!LEGAL[from]?.includes(to);

export class Screens {
  started = false;
  paused = false;
  modalType = null;
  settingsOpen = false;
  // Moves the machine was not told were legal (it still makes them; tests assert this stays empty).
  violations = [];

  get screen() {
    if (this.settingsOpen) return "settings";
    if (this.modalType) return this.modalType;
    return !this.started ? "menu" : this.paused ? "held" : "playing";
  }

  // A match begins or restarts: running, no dialog.
  begin() {
    const from = this.screen;
    this.modalType = null;
    this.started = true;
    this.paused = false;
    this.#moved(from);
  }

  // Back to the start screen (the pause flag stays set, as it always did).
  toMenu() {
    const from = this.screen;
    this.modalType = null;
    this.started = false;
    this.paused = true;
    this.#moved(from);
  }

  // A dialog opens and holds the match. Graphics notices only hold a match that is on.
  open(type) {
    const from = this.screen;
    if (!MODALS.includes(type)) throw new Error(`Unknown screen ${type}`);
    if (type !== "graphics" || this.started) this.paused = true;
    this.modalType = type;
    this.#moved(from);
  }

  // The dialog closes; a match that is still on carries on.
  close(finished = false) {
    const from = this.screen;
    this.modalType = null;
    if (this.started && !finished) this.paused = false;
    this.#moved(from);
  }

  // The dialog goes away but the match stays held (graphics restored without a pause menu).
  dismiss() {
    const from = this.screen;
    this.modalType = null;
    this.#moved(from);
  }

  // Settings open over the current screen and hold the match; the snapshot is the way back.
  hold() {
    const snapshot = this.snapshot();
    this.settingsOpen = true;
    this.paused = true;
    return snapshot;
  }

  // Back from settings: the saved screen returns. A finished match, or a page hidden
  // meanwhile, stays held.
  release(snapshot, { held = false } = {}) {
    const from = this.screen;
    this.settingsOpen = false;
    this.paused = snapshot.paused || held;
    this.modalType = snapshot.modalType;
    this.#moved(from);
  }

  // The field guide overlays whatever is showing and puts it back when it closes.
  snapshot() {
    return { paused: this.paused, modalType: this.modalType };
  }

  restore(snapshot) {
    const from = this.screen;
    this.paused = snapshot.paused;
    this.modalType = snapshot.modalType;
    this.#moved(from);
  }

  // Hold a running match without a dialog (settings closing on a hidden page).
  holdIfStarted() {
    if (this.started) this.paused = true;
  }

  #moved(from) {
    const to = this.screen;
    if (!isLegal(from, to)) this.violations.push(`${from}>${to}`);
  }
}

export const createScreens = () => new Screens();
