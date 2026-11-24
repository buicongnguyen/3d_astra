// Reduced motion as the game sees it (Settings → Assist → Reduced motion, 2026-11-24): "system" follows the
// device's prefers-reduced-motion, "on" always calms motion, "off" never does. app/preferences.js writes the
// choice to <html data-reduced-motion>; views read `.matches` here instead of their own matchMedia.
import { reducedFor } from "./settings.js";

const query = typeof matchMedia === "function"
  ? matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false, addEventListener() {}, removeEventListener() {} };
const choice = () => (typeof document !== "undefined" && document.documentElement?.dataset.reducedMotion) || "system";
export const reducedMotion = () => reducedFor({ reducedMotion: choice() }, query.matches);
// MediaQueryList-shaped, so code written against matchMedia keeps working; the change event fires for the
// device setting (preferences.js re-applies the view settings when the game setting changes).
export const reducedMotionQuery = {
  get matches() { return reducedMotion(); },
  addEventListener: (...args) => query.addEventListener?.(...args),
  removeEventListener: (...args) => query.removeEventListener?.(...args),
};
