// Frontier Defence, the landscape phone dock (AAA round 3, R3-E): the Actions / Selection panel is
// narrower in Defence (landscape-hud.css, at most 22% of the view width) and can be collapsed to one
// 44 px button, so the road stays in view. A new pick on the battlefield opens it again (input.js
// picked). The button exists on every layout; CSS shows it only on landscape phones in Defence.
export function createDock(c) {
  const { A, root, ui } = c;
  const { icon } = c.deps;
  function ensureToggle() {
    if (ui.dockToggle?.isConnected) return ui.dockToggle;
    const dock = document.querySelector(".bottom-dock");
    if (!dock) return null;
    const b = document.createElement("button");
    b.id = "defence-dock-toggle";
    b.type = "button";
    b.addEventListener("click", () => { setDockMin(!root.classList.contains("defence-dock-min")); A.updateUI(); });
    dock.prepend(b);
    ui.dockToggle = b;
    paint(root.classList.contains("defence-dock-min"));
    return b;
  }
  function paint(min) {
    const b = ui.dockToggle;
    if (!b || b.dataset.min === String(min)) return;
    b.dataset.min = String(min);
    b.setAttribute("aria-expanded", String(!min));
    b.setAttribute("aria-label", min ? "Show the panel" : "Hide the panel");
    b.title = min ? "Show the panel" : "Hide the panel";
    b.innerHTML = icon(min ? "expand" : "collapse");
  }
  function setDockMin(on) {
    ensureToggle();
    root.classList.toggle("defence-dock-min", !!on);
    paint(!!on);
  }
  Object.assign(c, { setDockMin, ensureDockToggle: ensureToggle });
}
