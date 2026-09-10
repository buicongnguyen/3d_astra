import { DEFINITIONS as D } from './data.js';

// Read-only presentation state. Orders alone must never imply active mining.
export function harvestTarget(sim, e) {
  const o = e.orders[0];
  if (e.type !== 'worker' || !['gather', 'deliver'].includes(o?.type)) return null;
  const r = sim.get(o.type === 'gather' ? o.target : e.resource);
  return r?.kind === 'resource' ? r : null;
}
export function isHarvesting(sim, e) {
  const r = harvestTarget(sim, e);
  return !!(e.hp > 0 && e.working && !e.moving && e.orders[0]?.type === 'gather' && r &&
    e.carry < 10 && (!e.carry || e.carryType === r.type) && Math.hypot(e.x-r.x, e.z-r.z) <= r.radius+1.4);
}
export function buildingActivity(sim, e) {
  if (e.kind !== 'building' || e.team !== 0 || e.hp <= 0) return null;
  if (!e.complete) {
    const builders = sim.own(0).filter(w => w.orders[0]?.type === 'build' && w.orders[0]?.target === e.id);
    return {progress:e.progress, label:!builders.length ? 'Needs Harvester' : builders.some(w => w.working) ? 'Building' : 'Builder travelling', waiting:!builders.some(w => w.working)};
  }
  if (e.levelJob) return {progress:Math.min(1,e.levelJob.elapsed/e.levelJob.time), label:`Upgrade L${e.level+1}`};
  const q = e.queue[0];
  return q ? {progress:Math.min(1,q.elapsed/D[q.type].time), label:q.blocked || D[q.type].name, waiting:!!q.blocked} : null;
}
