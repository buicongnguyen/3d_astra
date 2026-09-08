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
export function defaults(coarse = false) {
  return {
    version: 1,
    playerColor: "mint",
    enemyColor: "coral",
    quality: coarse ? "eco" : "high",
    masterVolume: 0.5,
    muted: false,
    waterMotion: true,
    ambient: true,
    detail: true,
  };
}
export function normalize(value, coarse = false) {
  const d = defaults(coarse);
  if (!value || value.version !== 1) return d;
  for (const key of ["playerColor", "enemyColor"])
    if (Object.hasOwn(PRESETS, value[key])) d[key] = value[key];
  if (d.playerColor === d.enemyColor)
    d.enemyColor = d.playerColor === "coral" ? "mint" : "coral";
  if (["eco", "high"].includes(value.quality)) d.quality = value.quality;
  if (Number.isFinite(value.masterVolume))
    d.masterVolume = Math.max(0, Math.min(1, value.masterVolume));
  for (const key of ["muted", "waterMotion", "ambient", "detail"])
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
export const palette = (settings) => {
  const chosen = [PRESETS[settings.playerColor], PRESETS[settings.enemyColor]];
  return [...chosen, ...["blue", "gold", "violet", "orange"].map(key => PRESETS[key]).filter(color => !chosen.includes(color))].slice(0, 4);
};
