// W11 LAN tests: a scripted player for one seat of a LAN match. It reads the match as its page shows it
// (`team` is the team it commands there: 0 on a page that shows its own side as team 0) and returns the
// orders a person would give at this tick, for LanSession.queue. Same ticks, same orders, every run.
export function lanBot(team, { seed = 1 } = {}) {
  let barracks = false;
  return function orders(sim) {
    const out = [], t = sim.ticks, own = sim.own(team);
    const hq = own.find((e) => e.type === "hq");
    if (!hq) return out;
    if (t === 2) out.push({ type: "harvest" });
    if (t % 240 === 7 * seed && own.filter((e) => e.type === "worker").length < 9) out.push({ type: "train", building: hq.id, unit: "worker" });
    if (!barracks && t >= 300 && t % 60 === 0) {
      const worker = own.find((e) => e.type === "worker"), spot = sim.findPlacement("barracks", team, hq.x + 9 * Math.sign(-hq.x || 1), hq.z + 5 * Math.sign(-hq.z || 1));
      // A build and its builder's order go together, as app/orders.js confirmBuild sends them on a LAN page.
      if (worker && spot) { out.push({ type: "build", worker: worker.id, building: "barracks", x: spot.x, z: spot.z, follow: { type: "build", resume: true } }); barracks = true; }
    }
    if (t % 200 === 100) for (const b of own.filter((e) => e.type === "barracks" && e.complete)) out.push({ type: "train", building: b.id, unit: t % 400 === 100 ? "ranger" : "vanguard" });
    if (t % 300 === 150) {
      const army = own.filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
      if (army.length >= 5) out.push({ type: "order", ids: army.map((e) => e.id), order: { type: "attackmove", x: -hq.x * 0.6, z: -hq.z * 0.6 } });
      else if (army.length) out.push({ type: "order", ids: army.map((e) => e.id), order: { type: "move", x: hq.x * 0.7, z: hq.z * 0.7 } });
    }
    return out;
  };
}
