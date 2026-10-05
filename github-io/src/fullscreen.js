// Request from the click handler itself: browsers require a fresh user gesture.
// Feature detection also covers iPhone browsers without element fullscreen support.
export function createFullscreen({ doc = document, onChange, onUnavailable }) {
  let pending = false;
  const active = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  const refresh = () => onChange({ active: active(), pending });
  doc.addEventListener('fullscreenchange', refresh);
  doc.addEventListener('webkitfullscreenchange', refresh);
  return {
    refresh,
    async toggle() {
      if (pending) return;
      const exiting = active();
      pending = true;
      refresh();
      try {
        if (exiting) {
          const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
          if (!exit) throw new Error('Fullscreen exit unavailable');
          await exit.call(doc);
        } else {
          const root = doc.documentElement;
          const request = root.requestFullscreen || root.webkitRequestFullscreen;
          const enabled = root.requestFullscreen ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled;
          if (!request || enabled === false) {
            onUnavailable('enter');
            return;
          }
          // The whole document includes the HUD, dialogs and settings overlay.
          await request.call(root);
        }
      } catch {
        onUnavailable(exiting ? 'exit' : 'enter');
      } finally {
        pending = false;
        refresh();
      }
    },
  };
}
