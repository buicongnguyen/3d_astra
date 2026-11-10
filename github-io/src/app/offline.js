// Registers the service worker (tools/sw.template.js, published as sw.js) so the game opens
// offline after the first visit. Skipped in development and in browser suites (?test) unless the
// page asks with ?sw, so tests see the same network behaviour as before.
import { areModelsLoaded, modelPlan } from "./loading.js";

export function registerOffline(A, query = new URLSearchParams(location.search)) {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  if (query.has("test") && !query.has("sw")) return;
  const hadController = !!navigator.serviceWorker.controller;
  addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      // When the worker is active, hand it the model list so every model is cached for offline play.
      const warm = () => navigator.serviceWorker.ready.then((ready) => ready.active?.postMessage({ type: "models", urls: modelPlan().map((item) => new URL(item.url, location.href).href) }));
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
