// Boss presence (AAA round 2, W2-F; docs/aaa/BOSSES.md): a view plugin that makes any boss feel big. It
// stands 1.5 times taller on screen (scaleFor: past FEEL.maxModelScale, health bar lifted with it), its
// feet throw dust and shake the camera a little on each leg step, a name card opens its entrance
// (bossWake), and a boss that falls mid-match gets "<name> destroyed" (when its fall ends the match the
// end beat in app/ui-extras.js plays instead). Presentation only: no simulation state, no randomness
// but fx's own. With no boss on the field every hook returns at once.
import { showBossCard } from "./boss-ui.js";

export const BOSS_SCALE = 1.5;
const STEP = Math.PI;       // a foot lands every half stride cycle (view.js gait: stride += speed * dt * k)
const SHAKE = 0.12;         // trauma of one footfall (CameraShake adds it by distance; FEEL.buildingTrauma is stronger)

export class BossPresenceView {
  constructor(view) {
    this.view = view;
    this.steps = new Map(); // boss id -> number of foot falls already seen
  }
  scaleFor(e) { return e.boss ? BOSS_SCALE : 1; }
  event(ev, sim) {
    if (ev.type === "bossWake" && sim.isVisible?.(ev) !== false) showBossCard(ev.name || "Boss", "", "wake");
    else if (ev.type === "bossDefeated" && !sim.result) showBossCard(ev.name || "Boss", "destroyed", "fall");
  }
  update(sim, dt) {
    if (!(dt > 0)) return;
    const view = this.view;
    for (const e of sim.entities) {
      if (!e.boss || e.hp <= 0) continue;
      const o = view.objects.get(e.id), u = o?.userData;
      if (!u || !o.visible || !(u.gait > 0.25)) continue;
      const n = Math.floor(u.stride / STEP);
      const seen = this.steps.get(e.id);
      this.steps.set(e.id, n);
      if (seen === undefined || n === seen || !sim.isVisible(e)) continue;
      // The foot that lands: left and right in turn, a metre or so out from the body's centre line.
      const side = n % 2 ? 1 : -1, c = Math.cos(e.angle), s = Math.sin(e.angle), reach = e.radius * 0.55;
      const at = { x: e.x + c * side * reach, y: 0.25, z: e.z - s * side * reach };
      view.fx.dust(at, 3, { x: e.x, z: e.z, team: e.team }, 1.4 + e.radius * 0.2, 1.3);
      view.shake.add(SHAKE, Math.hypot(e.x - view.focus.x, e.z - view.focus.z), view.shakeEnabled());
    }
  }
  reset() { this.steps.clear(); }
}
