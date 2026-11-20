// Readable armies at strategic zoom (AAA round 2, W1-D, idea P3), a view plugin (docs/VIEW_PLUGINS.md).
// A phone shows a tank on Three Roads (zoom 92) about 7 to 10 px tall. From zoom 40 a unit's model
// grows by a view-only factor that reaches 1.6 at zoom 90 and above, so a column stays a column of
// shapes instead of dots. Units only: buildings and bosses keep their size (bosses are W2-F's).
// The simulation is never touched: collision radii, pathing, ranges and picking by the sim do not
// change, and a unit under 40 zoom is drawn exactly as before (the factor is not returned at all).
export const ARMY_SCALE = { from: 40, to: 90, max: 1.6 };

// 1 up to `from`, then linear up to `max` at `to`, and `max` beyond it.
export function armyScale(zoom, { from, to, max } = ARMY_SCALE) {
  if (!(zoom > from)) return 1;
  return 1 + (max - 1) * Math.min(1, (zoom - from) / (to - from));
}

export class ArmyReadabilityView {
  constructor(view) { this.view = view; }
  // Runs for every visible entity every frame: an early return, no allocation.
  frameScaleFor(e, u, view) {
    if (e.kind !== "unit" || e.boss) return undefined;
    const k = armyScale(view.zoom);
    return k === 1 ? undefined : k;
  }
}
