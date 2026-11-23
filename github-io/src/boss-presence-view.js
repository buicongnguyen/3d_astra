// Boss presence (AAA round 2, W2-F; docs/aaa/BOSSES.md): a view plugin that makes any boss feel big. It
// keeps its authored size on screen (scaleFor, BOSS_SCALE; health bar lifted above it), its
// feet throw dust and shake the camera a little on each leg step, a name card opens its entrance
// (bossWake), and a boss that falls mid-match gets "<name> destroyed" (when its fall ends the match the
// end beat in app/ui-extras.js plays instead). Presentation only: no simulation state, no randomness
// but fx's own. With no boss on the field every hook returns at once.
import { showBossCard } from "./boss-ui.js";

export const BOSS_SCALE = 1;     // the models are authored at their real size, about 1.5 tanks (owner, 2026-11-23)
export const SPIDER_SCALE = 0.65; // the six-legged Iron Sovereign: a quarter of its old width, a little over a tank (owner, 2026-11-23)
const STEP = Math.PI;       // a foot lands every half stride cycle (view.js gait: stride += speed * dt * k)
const SHAKE = 0.12;         // trauma of one footfall (CameraShake adds it by distance; FEEL.buildingTrauma is stronger)

export class BossPresenceView {
  constructor(view) {
    this.view = view;
    this.steps = new Map(); // boss id -> number of foot falls already seen
  }
  scaleFor(e) { return e.boss ? (e.boss.startsWith("iron-sovereign") ? SPIDER_SCALE : BOSS_SCALE) : 1; }
  event(ev, sim) {
    // A story scene that opens on the wake carries its own title beat (story/scenes.js): no second card.
    if (ev.type === "bossWake") { if (!document.documentElement.classList.contains("scene-open")) showBossCard(ev.name || "Boss", "", "wake"); }
    else if (ev.type === "bossDefeated" && !sim.result) showBossCard(ev.name || "Boss", "destroyed", "fall");
    // A phase change (boss engine III, R3-H): the name card again, with what changed.
    else if (ev.type === "bossSurge") showBossCard(ev.name || "Boss", "Phase 2: overdrive", "phase");
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
