// Registers the service worker (tools/sw.template.js, published as sw.js) so the game opens
// offline after the first visit. Skipped in development and in browser suites (?test) unless the
// page asks with ?sw, so tests see the same network behaviour as before.
import { areModelsLoaded, modelPlan } from "./loading.js";

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
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          // A new version is ready; it takes over the next time the game is opened, so a running match is untouched.
          if (worker.state === "installed" && (hadController || navigator.serviceWorker.controller)) {
            A.notice("A new version is ready. It starts the next time you open the game.");
          }
        });
      });
    }).catch(() => {
      /* Offline play is optional. */
    });
  });
}
