import { SOUND_TESTS } from "./audio-mix.js";
import { PRESETS, TEAM_PALETTES, UI_SCALES, defaults, normalize, palette } from "./settings.js";
import { portrait } from "./portraits.js";
import { icon } from "./icons.js";
import { translate, loadLocale } from "./i18n.js";

// Injected by vite.config.js; absent under node:test.
const VERSION = typeof __APP_VERSION__ === "undefined" ? "dev" : __APP_VERSION__,
  BUILD_DATE = typeof __BUILD_DATE__ === "undefined" ? "" : __BUILD_DATE__;

// The unified settings sheet (2026-11-24, owner-approved): one sheet opened from the gear (title bar and
// match bar) or Pause → Settings. Eight sections in one segmented tab row (Hero since H7, 2026-11-28), so every setting is one tap
// away once the sheet is open; segmented buttons instead of dropdowns; every change applies and saves at
// once (no Apply / Cancel). Full screen, theme and language live here only.
export const SECTIONS = [
  ["audio", "Sound", "volume"],
  ["game", "Game", "flag"],
  ["camera", "Camera", "map"],
  ["hero", "Hero", "star"],
  ["display", "Display", "theme"],
  ["controls", "Controls", "move"],
  ["access", "Assist", "people"],
  ["language", "Language", "globe"],
];
// The Add to Home Screen guide's picture: Safari's Share button, the menu row and the new home-screen icon.
// Shapes only (the steps beside it carry the words, so they translate).
const INSTALL_PICTURE = `<svg class="install-picture" viewBox="0 0 300 112" aria-hidden="true" focusable="false"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="74" height="100" rx="12" fill="#0b1a33" stroke="#5d7fa6" stroke-width="2"/><rect x="12" y="80" width="62" height="20" rx="5" fill="#16294a"/><circle cx="43" cy="90" r="11" fill="#ffc75e" opacity=".25" stroke="#ffc75e" stroke-width="2"/><path d="M38 89v6h10v-6M43 92V82M39.5 85.5 43 82l3.5 3.5" stroke="#ffc75e" stroke-width="2"/><path d="M90 56h22m-6-6 6 6-6 6" stroke="#7fe8ff" stroke-width="2.5"/><rect x="120" y="30" width="96" height="52" rx="8" fill="#0b1a33" stroke="#5d7fa6" stroke-width="2"/><rect x="128" y="36" width="80" height="12" rx="3" fill="#16294a"/><rect x="128" y="51" width="80" height="14" rx="3" fill="#2a4a2f" stroke="#92ebc5" stroke-width="1.5"/><rect x="132" y="53" width="10" height="10" rx="2" stroke="#92ebc5" stroke-width="1.5"/><path d="M137 55.5v5M134.5 58h5" stroke="#92ebc5" stroke-width="1.5"/><path d="M147 58h52" stroke="#92ebc5" stroke-width="3" opacity=".7"/><rect x="128" y="68" width="80" height="10" rx="3" fill="#16294a"/><path d="M224 56h22m-6-6 6 6-6 6" stroke="#7fe8ff" stroke-width="2.5"/><rect x="254" y="30" width="40" height="40" rx="10" fill="#020713" stroke="#5d7fa6" stroke-width="1"/></g><image href="./icons/icon-192.png" x="256" y="32" width="36" height="36" clip-path="inset(0 round 9px)"/><path d="M258 80h32" stroke="#c9d6e6" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
const LANGUAGES = [["en", "English", "en"], ["vi", "Tiếng Việt", "vi"], ["ko", "한국어", "ko"]];
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
const pressed = (on) => `aria-pressed="${on ? "true" : "false"}"`;
// The Hero tab's name: "Hero" alone is another word in the catalogues (a commander's title), so the tab carries its
// own key and is kept out of the page translation (translate="no").
const HERO_TAB = "Hero (Settings tab)";

export class SettingsUI {
  // `extras` reaches the parts of the app that are not stored settings: the match speed, full screen,
  // the UI theme and the Help dialog. Every member is optional, so tests can build the sheet bare.
  constructor({ get, apply, enter, leave, soundTest, extras = {} }) {
    Object.assign(this, { get, apply, enter, leave, soundTest, extras });
    this.tab = "audio";
    this.root = document.createElement("div");
    this.root.className = "settings-backdrop";
    this.root.hidden = true;
    document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) { this.close(); return; }
      const button = e.target.closest("button");
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      if (button.dataset.soundTest) this.soundTest?.(button.dataset.soundTest);
      if (button.dataset.tab) { this.tab = button.dataset.tab; this.paint(); return; }
      if (button.dataset.setting && button.dataset.value !== undefined) {
        const { setting, value } = button.dataset;
        // W13: the left-handed layout mirrors the minimap too (its own row can move it back).
        if (setting === "handedness") { this.commit({ ...this.get(), handedness: value, minimapSide: value === "left" ? "right" : "left" }); return; }
        // A segmented On/Off row of a true/false setting (Weather) carries "true" / "false".
        this.set(setting, value === "true" ? true : value === "false" ? false : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value);
      }
      if (button.dataset.color) {
        const team = button.dataset.team, other = team === "playerColor" ? "enemyColor" : "playerColor";
        const next = { ...this.get(), teamPalette: "custom", [team]: button.dataset.color };
        // Your army and the enemy never share a colour: picking the other side's colour swaps the two.
        if (next[other] === next[team]) next[other] = this.get()[team];
        this.commit(next);
      }
      if (button.dataset.do === "contrast") this.commit({ ...this.get(), teamPalette: "custom", playerColor: "gold", enemyColor: "violet" });
      if (button.dataset.do === "speed") { this.extras.speed?.set(Number(button.dataset.speed)); this.refresh(); }
      if (button.dataset.do === "theme") { this.extras.theme?.set(button.dataset.theme); this.refresh(); }
      if (button.dataset.do === "fullscreen") this.extras.fullscreen?.toggle(button);
      if (button.dataset.do === "install") this.install();
      if (button.dataset.do === "install-close") { this.installGuide = false; this.repaintBody("install"); }
      if (button.dataset.do === "help") { this.close(); this.extras.help?.(); }
      if (button.dataset.do === "close" || button.dataset.do === "done") this.close();
      if (button.dataset.do === "reset") {
        // Defaults keep the skirmish faction (a battle choice, not shown here) and the language (resetting
        // it would leave a Vietnamese or Korean player in front of English they may not read).
        const now = this.get();
        this.commit({ ...defaults(coarse()), playerFaction: now.playerFaction, language: now.language });
        this.status("Defaults restored.");
      }
    });
    // Switches and sliders: a switch applies on change, a slider while it moves (one apply a frame).
    this.root.addEventListener("input", (e) => {
      const key = e.target.dataset.setting;
      if (!key || e.target.type !== "range") return;
      this.pendingRange = { key, value: Number(e.target.value) };
      this.rangeFrame ??= requestAnimationFrame(() => {
        this.rangeFrame = null;
        const pending = this.pendingRange;
        this.pendingRange = null;
        if (pending) this.set(pending.key, pending.value, { quiet: true });
      });
    });
    this.root.addEventListener("change", (e) => {
      const key = e.target.dataset.setting;
      if (!key) return;
      if (e.target.type === "checkbox") this.set(key, e.target.checked);
      else if (e.target.type === "range") { this.pendingRange = null; this.set(key, Number(e.target.value)); }
    });
    this.root.addEventListener("keydown", (e) => {
      e.stopPropagation();
      const tab = e.target.closest?.("[role=tab]");
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const names = SECTIONS.map(([id]) => id), at = names.indexOf(this.tab);
        this.tab = e.key === "Home" ? names[0] : e.key === "End" ? names.at(-1)
          : names[(at + (e.key === "ArrowRight" ? 1 : names.length - 1)) % names.length];
        this.paint();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
      if (e.key === "Tab") {
        const nodes = [...this.root.querySelectorAll("button:not(:disabled),input,select")].filter((n) => n.offsetParent !== null);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  get active() {
    return !this.root.hidden;
  }
  open(tab) {
    if (this.active) return;
    this.focus = document.activeElement;
    this.state = this.enter();
    if (tab && SECTIONS.some(([id]) => id === tab)) this.tab = tab;
    this.root.hidden = false;
    document.querySelector("#app").inert = true;
    this.paint();
  }
  // One setting changed: normalise, apply (which also saves) and update the pressed states in place.
  set(key, value, { quiet = false } = {}) {
    this.commit({ ...this.get(), [key]: value }, { quiet });
  }
  commit(next, { quiet = false } = {}) {
    this.apply(normalize(next, coarse()));
    this.refresh();
    if (!quiet) this.status("Saved on this device.");
  }
  status(text) {
    const line = this.root.querySelector("#settings-status");
    if (line) line.textContent = text;
  }
  sections(s) {
    const touch = coarse();
    const toggle = (key, label, note = "") =>
      `<label class="setting-row">${label}<input type="checkbox" role="switch" data-setting="${key}" ${s[key] ? "checked" : ""}><span class="switch-state" aria-hidden="true">${s[key] ? "On" : "Off"}</span></label>${note ? `<p class="settings-note">${note}</p>` : ""}`;
    const seg = (key, label, options, note = "") =>
      `<div class="setting-row seg-row"><span class="seg-label" id="seg-${key}">${label}</span><div class="seg" role="group" aria-labelledby="seg-${key}" data-setting-group="${key}" style="--n:${options.length}">${options.map(([value, text]) =>
        `<button type="button" class="kit-face" data-setting="${key}" data-value="${value}" ${pressed(String(s[key]) === String(value))}>${text}</button>`).join("")}</div></div>${note ? `<p class="settings-note">${note}</p>` : ""}`;
    const slider = (key, label, min, max, step) =>
      `<label class="setting-row slider-row">${label}<input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" value="${s[key]}"></label>`;
    const extras = this.extras;

    const audio = `${toggle("muted", "Mute all sound")}${seg("music", "Music", [["recorded", "Recorded"], ["adaptive", "Adaptive"], ["off", "Off"]], "Recorded: menu music and your faction's own theme in battle, downloaded on first play. Adaptive: a synthesised score that follows every battle.")}${slider("masterVolume", "Master volume", 0, 1, 0.05)}${slider("musicVolume", "Music volume", 0, 1, 0.05)}${slider("sfxVolume", "Effects volume", 0, 1, 0.05)}${toggle("voices", "Voices", "Spoken unit replies, announcer and story lines. Downloaded when a match starts (about 200 KB).")}${slider("voiceVolume", "Voice volume", 0, 1, 0.05)}${toggle("subtitles", "Subtitles", "Unit replies and announcer lines as text in your language. Story lines stay in the dialogue box; the size follows Text size.")}${toggle("ambient", "River and wind ambience")}${toggle("quietMode", "Quiet mode: no unit replies")}<div class="sound-tests"><h3>Sound test</h3>${Object.entries(SOUND_TESTS).map(([name, label]) => `<button type="button" data-sound-test="${name}">${label}</button>`).join("")}</div>`;

    // Game speed is this match's (it starts at ×1 and drops back to ×1 at story scenes and decisions);
    // ×3 needs a mouse, like the Defence bar.
    const inMatch = !!extras.speed?.available?.(), speed = extras.speed?.get?.() ?? 1;
    const speeds = touch ? [1, 2] : [1, 2, 3];
    const speedRow = `<div class="setting-row seg-row"><span class="seg-label" id="seg-speed">Game speed</span><div class="seg" role="group" aria-labelledby="seg-speed" style="--n:${speeds.length}">${speeds.map((n) =>
      `<button type="button" class="kit-face" data-do="speed" data-speed="${n}" ${pressed(inMatch && speed === n)} ${inMatch ? "" : 'aria-disabled="true"'} translate="no">×${n}</button>`).join("")}</div></div><p class="settings-note">${inMatch ? "Only the clock runs faster: every battle plays out the same. Story scenes and decisions return to ×1." : "Set during a battle. Every battle starts at ×1."}</p>`;
    const game = `${speedRow}${seg("alerts", "Alerts", [["all", "All"], ["important", "Important"]], "Important: only attack warnings, losses and objectives pop up.")}${toggle("confirmRestart", "Confirm Restart and New game", "Asks before a battle in progress is thrown away.")}${seg("damageNumbers", "Damage numbers", [["focus", "Bosses"], ["all", "All"], ["off", "Off"]], "Bosses: floating numbers on bosses and in Frontier Defence only.")}`;

    const camera = `${seg("cameraAngle", "Angle", [["low", "Low"], ["standard", "Standard"], ["top", "Top-down"]])}${seg("cameraTurn", "Turn", [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]], touch ? "Twist two fingers on the battlefield to turn it freely; picking a turn here resets the twist. Frontier Defence frames its roads itself." : "Page Up / Page Down turn it too. Frontier Defence frames its roads itself.")}${slider("panSpeed", "Pan speed", 0.5, 2, 0.25)}${slider("zoomSpeed", "Zoom sensitivity", 0.5, 2, 0.25)}${touch ? "" : toggle("edgeScroll", "Scroll at screen edges", "Moving the mouse to an edge of the battlefield pans the camera.")}`;

    // H7 (2026-11-28): Hero mode in one section, flat segmented rows, every choice one tap. Battle time and the
    // ground camera moved here from Game and Camera.
    const offOn = [[false, "Off"], [true, "On"]];
    const hero = `${seg("battleTime", "Battle time in Hero mode", [[0.4, "×0.4"], [0.5, "×0.5"], [0.75, "×0.75"], [1, "×1"]], "The whole battle slows while you fight as a hero; your hero stays quick. LAN matches always play at ×1.")}`
      + seg("dodgeHelp", "Dodge help", offOn, "On: rifle rounds at your hero fly slower, time slows for a moment before a rocket or shell hits while your dodge is ready, and the dodge is ready again after 3 s.")
      + seg("shotWarnings", "Shot warnings", offOn, "Rings where rockets and shells will land, and marks at the screen edge for shots from off screen.")
      + seg("aimAssist", "Aim assist", [["off", "Off"], ["low", "Low"], ["high", "High"]], "How far from the crosshair your hero picks a target.")
      + seg("autoFire", "Auto fire", offOn, "On: your hero shoots the nearest enemy in range on its own. Fire at an enemy to make it the target; hold fire to aim by hand. The Auto button in Hero mode switches it too.")
      + seg("heroView", "Camera (ground)", [["shoulder", "Shoulder"], ["first", "First person"]], "The camera for a hero on foot in Hero mode. Skywing always looks down from above.")
      + seg("closeDetail", "Close-up detail", [["auto", "Auto"], ["on", "On"], ["off", "Off"]], "Sharper models near your hero. Auto lets a phone turn it down when the battle gets busy.")
      + seg("skywingOffer", "Skywing before matches", offOn, "Off hides the Skywing assist offer on the setup screens. The Hero battle tile stays on the title screen.")
      + seg("birds", "Birds", [["off", "Off"], ["few", "Few"], ["many", "Many"]], "Few: a couple of small flocks on each battlefield. Many: flocks on every bank and roof. Looks only.")
      + seg("birdHint", "Bird hint from fog", offOn, s.birds === "off" ? "Birds are Off, so there are no birds to give hidden enemies away." : "Birds take off from the fog where hidden enemies move.");

    const fs = extras.fullscreen;
    const fullscreenRow = fs?.supported?.()
      ? `<div class="setting-row">Full screen<button type="button" class="secondary seg-single" data-do="fullscreen" ${pressed(fs.active?.())}>${fs.active?.() ? "Exit" : "Enter"}</button></div>`
      : `<p class="settings-note">${fs?.standalone?.() ? "Full screen: you are playing in a home-screen web app without the browser bars."
        : extras.install?.state?.() === "ios" ? "Full screen: iPhone has no full-screen button for web pages. Install the app (above) to play without the browser bars."
        : "Full screen: on iPhone, open the game in Safari, tap Share → Add to Home Screen and launch it from that icon."}</p>`;
    const theme = extras.theme?.get?.() ?? "walnut";
    const themeRow = `<div class="setting-row seg-row"><span class="seg-label" id="seg-theme">Theme</span><div class="seg" role="group" aria-labelledby="seg-theme" style="--n:2"><button type="button" class="kit-face" data-do="theme" data-theme="walnut" ${pressed(theme === "walnut")}>Walnut</button><button type="button" class="kit-face" data-do="theme" data-theme="dark" ${pressed(theme === "dark")}>Dark</button></div></div>`;
    const display = `${this.installTile()}${fullscreenRow}${themeRow}${seg("quality", "Graphics quality", [["eco", "Eco"], ["high", "High"]], "Eco limits pixel density and shadow cost. Bridges, water and terrain obstacles remain visible at every setting.")}${seg("uiScale", "Interface size", UI_SCALES.map((n) => [n, `${n}%`]))}${seg("healthBars", "Health bars", [["hurt", "Hurt"], ["always", "Always"], ["selected", "Selected"]])}${seg("minimapSide", "Minimap side", [["left", "Left"], ["right", "Right"]])}${seg("frameCap", "Frame cap", [[30, "30"], [60, "60"], [0, "Max"]], "Lower caps save battery on phones.")}${seg("weather", "Weather", [[true, "On"], [false, "Off"]], "Off: no rain, storm gloom or lightning, and a clearer view; night and dusk stay. Looks only: every battle plays out the same.")}${toggle("detail", "Decorative vegetation")}${toggle("waterMotion", "Animate water")}${toggle("unitMotion", "Unit motion")}${toggle("showFps", "Show FPS")}`;

    const controls = `${touch ? toggle("haptics", "Haptics", "A short buzz for attack warnings and losses. Off under reduced motion.") : ""}<div class="setting-row">Controls and shortcuts<button type="button" class="secondary seg-single" data-do="help">${icon("help")}<span>Help</span></button></div>${toggle("autocast", "Auto-cast abilities", "Your units use their abilities on their own in a fight, as rival armies do. Off: you give the order from the command card.")}${toggle("groupPace", "Group pace", "A group you move keeps together at its fighters' pace, with Medics and Engineers walking behind them. Off: every unit walks at its own speed.")}${touch ? seg("handedness", "Hand", [["right", "Right hand"], ["left", "Left hand"]], "Left hand mirrors the phone controls: the dock, the button rows, Map and the objectives flag move to the other side, and the minimap to the right.") : ""}`;

    const swatches = (team) => `<div class="swatch-row"><span class="seg-label">${team === "playerColor" ? "Your army" : "Enemy army"}</span><div class="swatches" style="--count:${Object.keys(PRESETS).length}">${Object.entries(PRESETS).map(([id, color]) =>
      `<button type="button" data-team="${team}" data-color="${id}" aria-label="${team === "playerColor" ? "Your" : "Enemy"} ${id}" title="${id}" ${pressed(s.teamPalette === "custom" && s[team] === id)} style="--swatch:${color}"><i></i></button>`).join("")}</div></div>`;
    const paletteLabels = { custom: "Custom", protanopia: "Protan", deuteranopia: "Deutan", tritanopia: "Tritan" };
    const access = `<div class="army-preview" aria-hidden="true"><div class="preview-unit player">${portrait("tank", "friendly", "preview-art")}<b>● YOU</b></div><div class="preview-unit enemy">${portrait("tank", "hostile", "preview-art")}<b>◆ ENEMY</b></div></div>${seg("teamPalette", "Team colours", Object.entries(paletteLabels), "Protan, Deutan and Tritan are palettes for colour-blind players. Team symbols stay distinct.")}${swatches("playerColor")}${swatches("enemyColor")}<button type="button" data-do="contrast" class="contrast-button">${icon("shield")}<span>High contrast · Gold / Violet</span></button>${seg("textSize", "Text size", [["s", "Small"], ["m", "Medium"], ["l", "Large"]], "Notices, dialogue, objectives and dialogs; the interface size is under Display.")}${seg("reducedMotion", "Reduced motion", [["system", "System"], ["on", "On"], ["off", "Off"]])}${toggle("combatMotion", "Animate combat effects", "Off also stops decorative motion.")}`;

    const language = `<div class="language-options" role="group" aria-label="Language / Ngôn ngữ / 언어" translate="no">${LANGUAGES.map(([id, label, lang]) =>
      `<button type="button" class="kit-face" data-setting="language" data-value="${id}" lang="${lang}" ${pressed(s.language === id)}>${icon("globe")}<span>${label}</span></button>`).join("")}</div><p class="settings-version"><span>Version</span> <span translate="no">${VERSION}${BUILD_DATE ? ` · ${BUILD_DATE}` : ""}</span><span class="settings-copyright" translate="no">© 2026 Bui Cong Nguyen, Solluxlabs.com · All rights reserved</span></p>`;
    return { audio, game, camera, hero, display, controls, access, language };
  }
  // Platform reach (2026-11-26): the "Install app" tile at the top of Display, in the state app/install.js
  // reports. Installed (or a browser that cannot install): no tile. iPhone / iPad: the tile opens the
  // Share → Add to Home Screen guide in place.
  installTile() {
    const state = this.extras.install?.state?.() ?? "none";
    if (state !== "prompt" && state !== "ios") return "";
    const tile = `<button type="button" class="install-tile" data-do="install" data-install="${state}" ${state === "ios" ? `aria-expanded="${!!this.installGuide}"` : ""}><img src="./icons/icon-192.png" alt="" width="48" height="48"><span class="install-text"><b>Install app</b><small>${state === "ios" ? "Add Frontier Command to your Home Screen: it opens full screen and starts offline." : "Opens in its own window, full screen, and starts offline."}</small></span></button>`;
    if (state !== "ios" || !this.installGuide) return tile;
    return `${tile}<div class="install-guide" role="group" aria-label="Add to Home Screen">${INSTALL_PICTURE}<ol><li>In Safari, tap Share (the square with an arrow). On newer iPhones it is in the ••• menu.</li><li>Choose Add to Home Screen, then Add.</li><li>Open Frontier Command from its new icon: no browser bars, and it starts offline after this visit.</li></ol><p class="settings-note">In another app's browser (Facebook, Zalo, KakaoTalk…), open this page in Safari first.</p><button type="button" class="secondary seg-single" data-do="install-close">Got it</button></div>`;
  }
  async install() {
    const state = this.extras.install?.state?.();
    if (state === "ios") { this.installGuide = !this.installGuide; this.repaintBody(this.installGuide ? "install-close" : "install"); return; }
    if (state !== "prompt") return;
    const outcome = await this.extras.install.prompt();
    this.repaintBody("install");
    if (outcome === "accepted") this.status("Installed. Open Frontier Command from your apps.");
  }
  // The install state changed (prompt offered, app installed): repaint Display in place.
  installChanged() {
    if (this.active && this.tab === "display") this.repaintBody("install");
  }
  repaintBody(focus) {
    if (!this.active) return;
    const body = this.root.querySelector("#settings-body");
    if (!body) return;
    body.innerHTML = this.sections(this.get())[this.tab];
    this.refresh();
    (body.querySelector(`[data-do="${focus}"]`) || this.root.querySelector(`[data-tab="${this.tab}"]`))?.focus({ preventScroll: true });
  }
  paint() {
    const s = this.get();
    const body = this.sections(s)[this.tab];
    this.root.innerHTML = `<section class="settings-panel panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div class="settings-heading"><span class="eyebrow">COMMANDER PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" data-do="close" class="settings-close" aria-label="Close settings">${icon("close")}</button></header><nav role="tablist" aria-label="Settings sections" style="--tabs:${SECTIONS.length}">${SECTIONS.map(([t, label, glyph]) => `<button type="button" role="tab" id="settings-tab-${t}" data-tab="${t}" aria-selected="${t === this.tab}" aria-controls="settings-body" tabindex="${t === this.tab ? 0 : -1}" title="${t === "hero" ? "Hero mode" : label}">${icon(glyph)}<span class="tab-label"${t === "hero" ? ' translate="no" data-hero-tab' : ""}>${t === "hero" ? this.heroTab(s.language) : label}</span>${t === "language" ? `<span class="tab-code" aria-hidden="true" translate="no">${s.language.toUpperCase()}</span>` : ""}</button>`).join("")}</nav><div class="settings-body" id="settings-body" role="tabpanel" aria-labelledby="settings-tab-${this.tab}" data-section="${this.tab}">${body}</div><footer><button type="button" data-do="reset" class="ghost">Defaults</button><p id="settings-status" role="status">Changes save as you go.</p><button type="button" data-do="done" class="primary">Done</button></footer></section>`;
    this.refresh();
    this.root.querySelector(`[data-tab="${this.tab}"]`).focus();
  }
  // The Hero tab's name in `lang` (its catalogue loads on the first language change; the label follows then).
  heroTab(lang) {
    if (lang === "en") return "Hero";
    const text = translate(HERO_TAB, lang);
    if (text === HERO_TAB) { loadLocale(lang).then(() => this.refresh()).catch(() => {}); return "Hero"; }
    return text;
  }
  // Pressed states, switches, colours and the full-screen label follow the stored settings.
  refresh() {
    if (!this.active) return;
    const s = this.get();
    const heroTab = this.root.querySelector("[data-hero-tab]"), heroName = heroTab && this.heroTab(s.language);
    if (heroTab && heroTab.textContent !== heroName) heroTab.textContent = heroName;
    for (const b of this.root.querySelectorAll("button[data-setting][data-value]"))
      b.setAttribute("aria-pressed", String(String(s[b.dataset.setting]) === b.dataset.value));
    for (const input of this.root.querySelectorAll('input[type="checkbox"][data-setting]')) {
      input.checked = !!s[input.dataset.setting];
      const state = input.nextElementSibling;
      if (state?.classList.contains("switch-state")) state.textContent = input.checked ? "On" : "Off";
    }
    for (const b of this.root.querySelectorAll("[data-color]"))
      b.setAttribute("aria-pressed", String(s.teamPalette === "custom" && s[b.dataset.team] === b.dataset.color));
    const speed = this.extras.speed?.get?.() ?? 1, inMatch = !!this.extras.speed?.available?.();
    for (const b of this.root.querySelectorAll("[data-speed]")) b.setAttribute("aria-pressed", String(inMatch && Number(b.dataset.speed) === speed));
    const theme = this.extras.theme?.get?.();
    for (const b of this.root.querySelectorAll("[data-theme]")) b.setAttribute("aria-pressed", String(b.dataset.theme === theme));
    const colors = palette(s);
    this.root.style.setProperty("--preview-player", colors[0]);
    this.root.style.setProperty("--preview-enemy", colors[1]);
  }
  // Full screen changed (the request is asynchronous): the row's label follows.
  fullscreenChanged(active) {
    const b = this.root.querySelector('[data-do="fullscreen"]');
    if (!b) return;
    b.textContent = active ? "Exit" : "Enter";
    b.setAttribute("aria-pressed", String(!!active));
  }
  close() {
    if (!this.active) return;
    if (this.rangeFrame) { cancelAnimationFrame(this.rangeFrame); this.rangeFrame = null; }
    if (this.pendingRange) { const p = this.pendingRange; this.pendingRange = null; this.set(p.key, p.value, { quiet: true }); }
    this.root.hidden = true;
    document.querySelector("#app").inert = false;
    this.leave(this.state);
    this.focus?.focus();
  }
}
