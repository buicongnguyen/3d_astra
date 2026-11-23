// UI theme (owner, 2026-11-23): warm Walnut by default, the original dark console one tap away in the top bar.
// Stored per device. Colours only: it never touches a battle.
const KEY = "frontier-ui-theme", THEMES = ["walnut", "dark"];
const read = () => { try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : "walnut"; } catch { return "walnut"; } };
export function applyTheme(theme) {
  document.documentElement.dataset.uiTheme = theme;
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  // The button names the theme a tap will switch to.
  const label = theme === "walnut" ? "Dark theme" : "Walnut theme";
  button.title = label;
  button.setAttribute("aria-label", label);
}
applyTheme(read());
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("#theme-toggle")) return;
  const next = document.documentElement.dataset.uiTheme === "walnut" ? "dark" : "walnut";
  try { localStorage.setItem(KEY, next); } catch { /* private window: this visit only */ }
  applyTheme(next);
});
new MutationObserver((_, watcher) => {
  if (!document.getElementById("theme-toggle")) return;
  watcher.disconnect();
  applyTheme(document.documentElement.dataset.uiTheme);
}).observe(document.documentElement, { childList: true, subtree: true });
