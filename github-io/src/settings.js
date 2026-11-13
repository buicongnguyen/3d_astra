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
export function defaults(coarse = false) {
  return {
    version: 1,
    language: "en",
    campaignDifficulty: "standard",
    // Skirmish "Your faction" (factions.js PLAYER_FACTIONS); remembered between visits.
    playerFaction: "meridian",
    playerColor: "mint",
    enemyColor: "coral",
    quality: coarse ? "eco" : "high",
    masterVolume: 0.5,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,
    waterMotion: true,
    combatMotion: true,
    // Screen shake on the biggest blasts (a Command core falling, a Barrage landing). Off = steady camera.
    screenShake: true,
    ambient: true,
    detail: true,
    showFps: false,
    // Units use their abilities on their own: on where there is no keyboard for the ability keys.
    autocast: !!coarse,
  };
}
export function normalize(value, coarse = false) {
  const d = defaults(coarse);
  if (!value || value.version !== 1) return d;
  if (["story", "standard", "veteran"].includes(value.campaignDifficulty)) d.campaignDifficulty = value.campaignDifficulty;
  if (["en", "vi"].includes(value.language)) d.language = value.language;
  if (PLAYER_FACTION_IDS.includes(value.playerFaction)) d.playerFaction = value.playerFaction;
  for (const key of ["playerColor", "enemyColor"])
    if (Object.hasOwn(PRESETS, value[key])) d[key] = value[key];
  if (d.playerColor === d.enemyColor)
    d.enemyColor = d.playerColor === "coral" ? "mint" : "coral";
  if (["eco", "high"].includes(value.quality)) d.quality = value.quality;
  if (Number.isFinite(value.masterVolume))
    d.masterVolume = Math.max(0, Math.min(1, value.masterVolume));
  for (const key of ["musicVolume", "sfxVolume"])
    if (Number.isFinite(value[key])) d[key] = Math.max(0, Math.min(1, value[key]));
  for (const key of ["muted", "waterMotion", "combatMotion", "screenShake", "ambient", "detail", "showFps", "autocast"])
    if (typeof value[key] === "boolean") d[key] = value[key];
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
  const chosen = [PRESETS[settings.playerColor], PRESETS[settings.enemyColor]];
  return [...chosen, ...["blue", "gold", "violet", "orange"].map(key => PRESETS[key]).filter(color => !chosen.includes(color))].slice(0, 4);
};
