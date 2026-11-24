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
    // Music: recorded tracks on menus and briefings plus the adaptive score in matches ("recorded"),
    // the adaptive score only ("adaptive", downloads no music), or none ("off").
    music: "recorded",
    waterMotion: true,
    combatMotion: true,
    // Unit motion (unit-rig.js): knees, run lean, kneel-to-fire, hull rock, turret scan, stowed artillery barrels.
    unitMotion: true,
    // (screenShake was dropped 2026-11-24: Round A A1 took the camera shake out, so the key did nothing.
    // Old saves that still carry it load fine; normalize() ignores it.)
    // Settings sheet (2026-11-24): ask before Restart / New game drops a battle in progress.
    confirmRestart: true,
    // Camera pan speed (keys, screen edges): a multiplier, 0.5 to 2. Edge scrolling is a mouse thing.
    panSpeed: 1,
    edgeScroll: true,
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
  for (const key of ["musicVolume", "sfxVolume"])
    if (Number.isFinite(value[key])) d[key] = Math.max(0, Math.min(1, value[key]));
  for (const key of ["muted", "waterMotion", "combatMotion", "unitMotion", "ambient", "detail", "showFps", "autocast", "confirmRestart", "edgeScroll"])
    if (typeof value[key] === "boolean") d[key] = value[key];
  if (Number.isFinite(value.panSpeed)) d.panSpeed = Math.max(0.5, Math.min(2, value.panSpeed));
  if (typeof value.groupPace === "boolean") d.groupPace = value.groupPace;
  if (typeof value.quietMode === "boolean") d.quietMode = value.quietMode;
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
  !!reducedMotion || settings?.quality === "eco" || settings?.combatMotion === false;
export const palette = (settings) => {
  if (Object.hasOwn(TEAM_PALETTES, settings.teamPalette)) return [...TEAM_PALETTES[settings.teamPalette]];
  const chosen = [PRESETS[settings.playerColor], PRESETS[settings.enemyColor]];
  return [...chosen, ...["blue", "gold", "violet", "orange"].map(key => PRESETS[key]).filter(color => !chosen.includes(color))].slice(0, 4);
};
