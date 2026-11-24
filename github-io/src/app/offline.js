// Registers the service worker (tools/sw.template.js, published as sw.js) so the game opens
// offline after the first visit. Skipped in development and in browser suites (?test) unless the
// page asks with ?sw, so tests see the same network behaviour as before.
// 2026-11-24: a new version waiting (found now or at an earlier visit) shows a small toast in the
// top-left notice lane, "New version · tap to reload", instead of the old build running on silently
// until every game tab is closed. A tap saves the match, lets the new worker take over and reloads.
import { areModelsLoaded, modelPlan } from "./loading.js";

// The toast (one at most). Exported for the browser suites, which have no second build to publish.
export function showUpdateToast(A, worker) {
  if (document.getElementById("update-toast")) return;
  const toast = document.createElement("button");
  toast.type = "button";
  toast.id = "update-toast";
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `<span>New version · tap to reload</span>`;
  toast.addEventListener("click", () => {
    toast.disabled = true;
    try { A.autosave?.(); } catch { /* Saving is best effort. */ }
    let done = false;
    const reload = () => { if (!done) { done = true; location.reload(); } };
    navigator.serviceWorker?.addEventListener("controllerchange", reload, { once: true });
    worker?.postMessage("skipWaiting");
    // No worker to hand over to (or it never answers): a plain reload still fetches the new page.
    setTimeout(reload, worker ? 1500 : 0);
  });
  document.body.append(toast);
}

export function registerOffline(A, query, matchTypes) {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  if (query.has("test") && !query.has("sw")) return;
  const hadController = !!navigator.serviceWorker.controller;
  addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      // Warm the selected match after the menu is ready, including a remembered faction.
      const warm = async () => {
        const { active } = await navigator.serviceWorker.ready;
        const urls = modelPlan(matchTypes()).map(item => new URL(item.url, location.href).href);
        active?.postMessage({ type: "models", urls });
      };
      if (areModelsLoaded()) warm(); else addEventListener("fc-models-loaded", warm, { once: true });
      // A version found at an earlier visit, still waiting for every game tab to close.
      if (registration.waiting && navigator.serviceWorker.controller) showUpdateToast(A, registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          // A new version is ready. A running match is untouched until the player taps the toast.
          if (worker.state === "installed" && (hadController || navigator.serviceWorker.controller)) showUpdateToast(A, worker);
        });
      });
    }).catch(() => {
      /* Offline play is optional. */
    });
  });
}
