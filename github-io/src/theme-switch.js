// UI theme (owner, 2026-11-23): warm Walnut by default, the original dark console one tap away.
// Since the settings sheet (2026-11-24) the switch lives in Settings → Display only; the choice is still
// stored per device under its own key. Colours only: it never touches a battle.
const KEY = "frontier-ui-theme", THEMES = ["walnut", "dark"];
const read = () => { try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : "walnut"; } catch { return "walnut"; } };
export function applyTheme(theme) {
  document.documentElement.dataset.uiTheme = THEMES.includes(theme) ? theme : "walnut";
}
export const getTheme = () => document.documentElement.dataset.uiTheme || "walnut";
export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  try { localStorage.setItem(KEY, theme); } catch { /* private window: this visit only */ }
  applyTheme(theme);
}
applyTheme(read());
