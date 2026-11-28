export const STORAGE_KEY = "frontier-command.settings.v1";
export const PRESETS = Object.freeze({
  mint: "#92ebc5",
  coral: "#ef7660",
  blue: "#689dff",
  cyan: "#64d9ed",
  gold: "#edc76f",
  orange: "#efa34f",
  violet: "#b397ee",
  rose: "#e88fbd",
  ivory: "#ebe7cd",
});
// The keys of PLAYER_FACTIONS in factions.js (kept here so settings load without the rules data).
export const PLAYER_FACTION_IDS = Object.freeze(["meridian", "ashfall", "sunward", "wardens", "veil"]);
export const TEAM_PALETTES = {
  protanopia: ["#68bfff", "#ffd451", "#e7e8ef", "#875197"],
  deuteranopia: ["#57cafa", "#ffae43", "#efedee", "#955dad"],
  tritanopia: ["#4be2ac", "#ff718c", "#f4edd9", "#536aa5"],
};
export const UI_SCALES = [90, 100, 115, 130];
export function defaults(coarse = false) {
  return {
    version: 1,
    language: "en",
    campaignDifficulty: "standard",
    // Skirmish "Your faction" (factions.js PLAYER_FACTIONS); remembered between visits.
    playerFaction: "meridian",
    teamPalette: "custom",
    uiScale: 100,
    playerColor: "mint",
    enemyColor: "coral",
    quality: coarse ? "eco" : "high",
    masterVolume: 0.5,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,
    // Music: recorded tracks on menus and briefings and the player's faction theme in matches, with the
    // adaptive score in Defence waves ("recorded"),
    // the adaptive score only ("adaptive", downloads no music), or none ("off").
    music: "recorded",
    waterMotion: true,
    combatMotion: true,
    // Unit motion (unit-rig.js): knees, run lean, kneel-to-fire, hull rock, turret scan, stowed artillery barrels.
    unitMotion: true,
    // Weather (2026-11-25): storm missions' rain, gloom, close fog and lightning. View only (mission-looks.js
    // viewLook): Off shows the map's own sky and keeps night and dusk; battles play out the same.
    weather: true,
    // (screenShake was dropped 2026-11-24: Round A A1 took the camera shake out, so the key did nothing.
    // Old saves that still carry it load fine; normalize() ignores it.)
    // Settings sheet (2026-11-24): ask before Restart / New game drops a battle in progress.
    confirmRestart: true,
    // Camera pan speed (keys, screen edges): a multiplier, 0.5 to 2. Edge scrolling is a mouse thing.
    panSpeed: 1,
    edgeScroll: true,
    // Phase 2 (2026-11-24). Camera: look-down preset and a turn in quarter steps (Frontier Defence keeps its
    // own framing), zoom sensitivity for the wheel and the pinch.
    cameraAngle: "standard",
    cameraTurn: 0,
    zoomSpeed: 1,
    // The minimap in the left or right corner (desktop dock; phones since W13, 2026-11-25).
    minimapSide: "left",
    // W13: phones, "left" mirrors the touch controls (the dock, the button rows, Map and the flag) for left-handed
    // players. Choosing it in the sheet also moves the minimap to the right (it can be moved back on its own).
    handedness: "right",
    // Vitals bars: "hurt" (damaged units, the selection and the hovered unit; as before), "always", "selected".
    healthBars: "hurt",
    // Toasts: "all", or "important" (attack warnings, losses and objectives; routine news stays in the log).
    alerts: "all",
    // Frame cap in frames a second (0 = the display's own rate). Phones default to 60: a 120 Hz phone halves
    // its GPU work and battery draw for no visible loss in an RTS; PCs draw at the display rate.
    frameCap: coarse ? 60 : 0,
    // Short vibrations on phones for attack warnings and losses (navigator.vibrate; nothing elsewhere).
    haptics: true,
    // Reading text (notices, dialogue, objectives, dialogs) apart from the interface size: s = as designed.
    textSize: "s",
    // "system" follows the device's reduced-motion choice; "on" always calms motion; "off" never does.
    reducedMotion: "system",
    // Floating damage numbers (AAA round 2, W2-E): "focus" = bosses and Frontier Defence, "all", or "off".
    damageNumbers: "focus",
    ambient: true,
    detail: true,
    showFps: false,
    // Units use their abilities on their own: on where there is no keyboard for the ability keys.
    autocast: !!coarse,
    // R3-B: a move of two or more units keeps the fighters' pace, support units behind (app/orders.js).
    groupPace: true,
    // R3-U: quiet mode mutes the unit voice chirps (barks) on select and order; all other sound stays.
    quietMode: false,
    // W3 (2026-11-25): spoken unit replies, announcer and story lines (voice.js), and their own volume.
    voices: true,
    voiceVolume: 0.8,
    // Subtitles for the spoken unit replies and announcer lines, in the player's language (captions-ui.js).
    subtitles: true,
    // H3d: the battle's clock in Hero mode (0.4 / 0.5 / 0.75 / 1; LAN matches always 1), and the ground hero's camera.
    battleTime: 0.5,
    heroView: "shoulder",
    // H7 Settings > Hero (2026-11-28). Dodge help: slower rifle rounds at the hero, a reflex slow-down before a
    // rocket or shell hits and a 3 s dodge (carried into the match by the heroMode command, so replays keep it).
    dodgeHelp: false,
    // Shot warnings: the landing rings and the edge marks for shots at the hero (looks only).
    shotWarnings: true,
    // Aim assist: "off", "low" (the PC cone) or "high" (the phone cone); the page picks the target, the command
    // carries it.
    aimAssist: coarse ? "high" : "low",
    // Close-up detail near the hero camera (H5): "auto" (the governor decides on phones), "on", "off".
    closeDetail: "auto",
    // The Skywing assist row on the setup screens and the mission briefing (the Hero battle tile always stays).
    skywingOffer: true,
    // Birds rising from the fog hint at hidden enemies (H5).
    birdHint: true,
    // How many birds: "off", "few" (a couple of small flocks and one geese V) or "many" (owner 2026-11-28: few by default).
    birds: "few",
  };
}
export function normalize(value, coarse = false) {
  const d = defaults(coarse);
  if (!value || value.version !== 1) return d;
  if (["story", "standard", "veteran"].includes(value.campaignDifficulty)) d.campaignDifficulty = value.campaignDifficulty;
  if (["en", "vi", "ko"].includes(value.language)) d.language = value.language;
  if (Object.hasOwn(TEAM_PALETTES, value.teamPalette)) d.teamPalette = value.teamPalette;
  if (UI_SCALES.includes(Number(value.uiScale))) d.uiScale = Number(value.uiScale);
  if (PLAYER_FACTION_IDS.includes(value.playerFaction)) d.playerFaction = value.playerFaction;
  for (const key of ["playerColor", "enemyColor"])
    if (Object.hasOwn(PRESETS, value[key])) d[key] = value[key];
  if (d.playerColor === d.enemyColor)
    d.enemyColor = d.playerColor === "coral" ? "mint" : "coral";
  if (["eco", "high"].includes(value.quality)) d.quality = value.quality;
  if (["focus", "all", "off"].includes(value.damageNumbers)) d.damageNumbers = value.damageNumbers;
  // Saves from before the Music setting have no `music` key and get the default.
  if (["recorded", "adaptive", "off"].includes(value.music)) d.music = value.music;
  if (Number.isFinite(value.masterVolume))
    d.masterVolume = Math.max(0, Math.min(1, value.masterVolume));
  for (const key of ["musicVolume", "sfxVolume", "voiceVolume"])
    if (Number.isFinite(value[key])) d[key] = Math.max(0, Math.min(1, value[key]));
  for (const key of ["muted", "waterMotion", "combatMotion", "unitMotion", "weather", "ambient", "detail", "showFps", "autocast", "confirmRestart", "edgeScroll"])
    if (typeof value[key] === "boolean") d[key] = value[key];
  if (Number.isFinite(value.panSpeed)) d.panSpeed = Math.max(0.5, Math.min(2, value.panSpeed));
  if (Number.isFinite(value.zoomSpeed)) d.zoomSpeed = Math.max(0.5, Math.min(2, value.zoomSpeed));
  const pick = (key, allowed) => { if (allowed.includes(value[key])) d[key] = value[key]; };
  pick("cameraAngle", ["low", "standard", "top"]);
  pick("cameraTurn", [0, 90, 180, 270]);
  pick("minimapSide", ["left", "right"]);
  pick("handedness", ["right", "left"]);
  pick("healthBars", ["hurt", "always", "selected"]);
  pick("alerts", ["all", "important"]);
  pick("frameCap", [0, 30, 60]);
  pick("textSize", ["s", "m", "l"]);
  pick("reducedMotion", ["system", "on", "off"]);
  if (typeof value.haptics === "boolean") d.haptics = value.haptics;
  if (typeof value.groupPace === "boolean") d.groupPace = value.groupPace;
  if (typeof value.quietMode === "boolean") d.quietMode = value.quietMode;
  if (typeof value.voices === "boolean") d.voices = value.voices;
  if (typeof value.subtitles === "boolean") d.subtitles = value.subtitles;
  pick("battleTime", [0.4, 0.5, 0.75, 1]);
  pick("heroView", ["shoulder", "first"]);
  for (const key of ["dodgeHelp", "shotWarnings", "skywingOffer", "birdHint"]) if (typeof value[key] === "boolean") d[key] = value[key];
  pick("aimAssist", ["off", "low", "high"]);
  pick("closeDetail", ["auto", "on", "off"]);
  pick("birds", ["off", "few", "many"]);
  return d;
}
export function loadSettings(coarse = false, storage) {
  try {
    return normalize(
      JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY)),
      coarse,
    );
  } catch {
    return defaults(coarse);
  }
}
export function saveSettings(value, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}
// `:root.motion-off` (app/preferences.js): decorative motion stops with Eco graphics, with combat
// motion off or when the system asks for reduced motion. Later effects rely on the same class.
export const motionOffFor = (settings, reducedMotion = false) =>
  reducedFor(settings, reducedMotion) || settings?.quality === "eco" || settings?.combatMotion === false;
// Settings → Assist → Reduced motion over the device's choice: "on" / "off" win, "system" follows it.
export const reducedFor = (settings, system = false) =>
  settings?.reducedMotion === "on" ? true : settings?.reducedMotion === "off" ? false : !!system;
// Camera look-down presets (degrees above the ground); 46 is the designed view (view.js CAMERA_OFFSET).
export const CAMERA_PITCH = Object.freeze({ low: 36, standard: 45.7, top: 60 });
export const palette = (settings) => {
  if (Object.hasOwn(TEAM_PALETTES, settings.teamPalette)) return [...TEAM_PALETTES[settings.teamPalette]];
  const chosen = [PRESETS[settings.playerColor], PRESETS[settings.enemyColor]];
  return [...chosen, ...["blue", "gold", "violet", "orange"].map(key => PRESETS[key]).filter(color => !chosen.includes(color))].slice(0, 4);
};
