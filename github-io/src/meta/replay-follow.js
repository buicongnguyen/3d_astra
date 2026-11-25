// Follow action for the replay viewer (src/replay-ui.js; re-score 2026-11-25b): where the camera should look.
// Pure and DOM-free: it reads a simulation and never writes it, so a replay still ends on its recorded hash.
// Follow action: units that fired within FIGHT_SECONDS count as the action; KNOT metres around the busiest one
// make the knot; the camera closes FOLLOW_RATE of the gap each second (frame-rate free); a focus more than
// MANUAL_SLACK metres from where follow left it means the player moved the camera.
export const FIGHT_SECONDS = 3, KNOT = 16, FOLLOW_RATE = 2.5, MANUAL_SLACK = 0.75;

// The point the follow camera aims at, or null: the centre of the busiest knot of recent shooters, else of the
// player's army (team 0 units that are not Harvesters), else of anything team 0 still has. `keep` (the last aim)
// is kept while its knot still holds most of the busiest one's units, so two fights do not make the camera swing.
export function actionTarget(sim, keep = null) {
  const now = sim.time, alive = sim.entities.filter((e) => e.hp > 0 && Number.isFinite(e.x) && Number.isFinite(e.z));
  const hot = alive.filter((e) => Number.isFinite(e.shotAt) && now - e.shotAt <= FIGHT_SECONDS);
  const army = alive.filter((e) => e.team === 0 && e.kind === "unit" && e.type !== "worker");
  const pool = hot.length ? hot : army.length ? army : alive.filter((e) => e.team === 0);
  if (!pool.length) return null;
  const near = (p) => pool.filter((e) => Math.hypot(e.x - p.x, e.z - p.z) <= KNOT);
  let best = pool[0], most = 0;
  for (const e of pool) { const n = near(e).length; if (n > most) { most = n; best = e; } }
  if (keep) { const held = near(keep); if (held.length && held.length >= most * 0.6) best = keep; }
  const knot = near(best), mid = knot.reduce((a, e) => ({ x: a.x + e.x / knot.length, z: a.z + e.z / knot.length }), { x: 0, z: 0 });
  return { x: mid.x, z: mid.z, fight: hot.length > 0, count: knot.length };
}
