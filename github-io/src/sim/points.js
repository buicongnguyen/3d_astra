import { distance } from "../data.js";

// Skirmish capture points: neutral rings between the camps that pay their owner a small income.
// They reuse the mission ring mechanics (stepPoints in sim/missions.js). Only matches created
// with { capturePoints: true } have them: never Training, never a story mission.
// Layout, from maps.json: the crossroads at the map centre plus a pair of ridges on the line
// that bisects the two home camps, mirrored through the centre so both sides stand equally far.
export const POINT_RADIUS = 5;
export const POINT_INCOME = { alloy: 0.25, energy: 0.1 };
// A ridge too close to an extra rival camp (two or three enemies) is left out.
const CAMP_CLEARANCE = 17;

export const points = {
  initSkirmishPoints() {
    const [fx, fz] = this.terrain.flank || [0, 0];
    const camps = this.entities.filter((e) => e.type === "hq");
    const layout = { crossroads: [0, 0], ridgeEast: [fx, fz], ridgeWest: [-fx, -fz] };
    for (const [name, [x, z]] of Object.entries(layout)) {
      if (camps.some((c) => distance(c, { x, z }) < CAMP_CLEARANCE)) continue;
      if (!this.terrain.canStand(x, z, 1)) continue;
      this.skirmishPoints[name] = { x, z, r: POINT_RADIUS, owner: null, taker: null, since: 0, gives: { ...POINT_INCOME } };
    }
  },
  // The computer opponent keeps a small squad on each of the nearest points: it walks there
  // to take the ring and stays to defend it. Cost-neutral: the squad is ordinary army units.
  aiPoints(team, hq, army, pace) {
    const rings = this.skirmishPoints, names = Object.keys(rings || {});
    if (!names.length || !hq || this.time < 45) return;
    const size = this.aiSpeed === "relaxed" ? 2 : 3, squads = this.aiSpeed === "relaxed" ? 1 : 2;
    for (const e of army) if (e.pointDuty && !rings[e.pointDuty]) e.pointDuty = null;
    const nearest = names.sort((a, b) => distance(hq, rings[a]) - distance(hq, rings[b]) || (a < b ? -1 : 1)).slice(0, squads);
    // Never strip the core: keep a home guard of at least minWave units off duty.
    // Flyers cannot take a ring (sim/air.js), so they never go on point duty.
    let spare = army.filter((e) => !e.pointDuty && !e.orders.length && e.damage > 0 && !e.flying && distance(e, hq) < 40);
    for (const name of nearest) {
      const ring = rings[name], crew = army.filter((e) => e.pointDuty === name);
      const held = ring.owner === team || (ring.owner !== null && !this.hostile(team, ring.owner));
      // Duty units that wandered or were left without orders walk back to the ring.
      const lost = crew.filter((e) => !e.orders.length && distance(e, ring) > ring.r);
      if (lost.length && !(held && distance(lost[0], ring) < ring.r + 6)) this.issue(lost.map((e) => e.id), { type: "attackmove", x: ring.x, z: ring.z });
      const missing = size - crew.length;
      if (missing <= 0 || spare.length - missing < (pace.minWave ?? 4) - 1) continue;
      const send = spare.sort((a, b) => distance(a, ring) - distance(b, ring) || a.id - b.id).slice(0, missing);
      spare = spare.filter((e) => !send.includes(e));
      for (const e of send) e.pointDuty = name;
      this.issue(send.map((e) => e.id), { type: "attackmove", x: ring.x, z: ring.z });
    }
  },
};
