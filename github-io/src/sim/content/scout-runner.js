// Scout Runner (AAA round 3, R3-Q: first-minute hooks). A Defence level whose `defence` block has a
// `runner` (only the new "First watch" variant of level 1, src/defence/first-watch.js, played on a
// profile that has never won a Defence level) sends one fast, unarmed scout down the road with the
// first wave, a little ahead of it. Catch it for bonus alloy (its bounty times `bounty`); if it gets
// through it costs no lives. Every other level has no `runner`: both hooks answer at once and never
// read or write anything, so no pin moves.
//
// runner: { wave, type, route, ahead, bounty, speed }
//   wave    the wave it runs with (1); it sets off when that wave's first unit appears
//   type    the unit (any type; it is made unarmed), `route` the road it runs, `ahead` metres down
//           the first leg from the spawn spot (clear of the column), `speed` a factor on its speed
//
// State, only in such a level: `defence.runner` = { id, done? } once it is on the road (`done` is
// "caught" when it falls). The unit carries `runner: true`, `bounty_x` and `leak_lives: 0`, which
// stepDefence (sim/defence/route.js) already reads.
const FOE = 1, TEAM = 0;

export const scoutRunner = {
  id: "scout-runner",
  // The first unit of the runner's wave has just appeared (spawnQueued): the runner sets off too.
  onSpawn(sim, e) {
    if (e.team !== FOE || e.kind !== "unit" || e.runner) return;
    const d = sim.defence, r = d && sim.missionDef?.defence?.runner;
    if (!r || d.runner || d.wave < r.wave) return;
    const pts = sim.missionDef.defence.routes[r.route];
    if (!pts || pts.length < 2) return;
    const a = pts[0], b = pts[1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, k = Math.min(r.ahead ?? 4, l * 0.8) / l;
    d.runner = { id: sim.nextId };
    const u = sim.spawnOnRoute(r.type, FOE, r.route, 1, { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k });
    u.runner = true;
    u.damage = 0;
    u.speed = Math.round(u.speed * (r.speed ?? 1) * 100) / 100;
    u.bounty_x = r.bounty;
    u.leak_lives = 0;
    d.runner.id = u.id;
    sim.events.push({ type: "runner", phase: "out", id: u.id, x: u.x, z: u.z, team: TEAM });
    sim.message("A Scout Runner is on the road! Catch it for bonus alloy.");
  },
  // Caught: stepDefence pays its bounty (times `bounty`) later this tick.
  onDeath(sim, t) {
    if (!t.runner || t.team !== FOE || !sim.defence?.runner || sim.defence.runner.done) return;
    sim.defence.runner.done = "caught";
    sim.events.push({ type: "runner", phase: "caught", id: t.id, x: t.x, z: t.z, team: TEAM });
    sim.message("Scout Runner caught: bonus alloy!");
  },
};
