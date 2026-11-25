// W11 LAN play, the parts without a network: the lockstep scheduler (turn assembly, input delay, ordering
// ties, rewind), desync detection, the stall overlay and timeout, pause holds, message decoding, the
// perspective swap, the LAN rules in the simulation and the QR code maker.
import test from "node:test";
import assert from "node:assert/strict";
import { Lockstep } from "../src/net/lockstep.js";
import { LanSession, applyCommand } from "../src/net/session.js";
import { decode, encode, cleanName, TURN_TICKS, INPUT_DELAY, STALL_SHOW_MS, STALL_TIMEOUT_MS, HASH_TICKS, turnOf } from "../src/net/protocol.js";
import { swapTeams, viewEvents, perspectiveFor } from "../src/net/perspective.js";
import { lanOptions, cleanSetup } from "../src/net/match.js";
import { lanSeats, lanHostile, lanResult, resultFor } from "../src/sim/lan.js";
import { qrMatrix, qrToSvg } from "../src/net/qr.js";
import { Simulation } from "../src/simulation.js";

test("input delay: a command given before turn T runs on turn T + delay; the first turns are empty", () => {
  const l = new Lockstep({ seats: [0, 1], me: 0 });
  assert.equal(l.delay, INPUT_DELAY);
  assert.equal(TURN_TICKS, 3);
  for (let t = 0; t < INPUT_DELAY; t++) assert.ok(l.ready(t), `turn ${t} needs nobody`);
  l.queue({ type: "harvest" });
  assert.deepEqual(l.outgoing(0), [{ n: 2, c: [{ type: "harvest" }] }]);
  assert.deepEqual(l.outgoing(0), [], "a bundle goes out once");
  assert.deepEqual(l.take(0), []);
  assert.ok(!l.ready(2), "turn 2 waits for seat 1");
  assert.deepEqual(l.missing(2), [1]);
  l.receive(1, 2, []);
  assert.deepEqual(l.take(2), [{ type: "harvest", team: 0 }]);
});

test("a turn's commands run seat by seat, each in the order given, with the seat's own team", () => {
  const a = new Lockstep({ seats: [1, 0], me: 1 }), b = new Lockstep({ seats: [0, 1], me: 0 });
  a.queue({ type: "x", team: 0, n: 1 }); a.queue({ type: "x", n: 2 });
  b.queue({ type: "y", n: 3 });
  const [ba] = a.outgoing(0), [bb] = b.outgoing(0);
  a.receive(0, bb.n, bb.c); b.receive(1, ba.n, ba.c);
  const ra = a.take(2), rb = b.take(2);
  assert.deepEqual(ra, rb, "both pages run the same list");
  assert.deepEqual(ra.map((c) => [c.team, c.n]), [[0, 3], [1, 1], [1, 2]], "lowest seat first; a command never keeps a forged team");
});

test("after a stall the owed bundles go out empty, the newest carries the orders; repeats and late bundles are dropped", () => {
  const l = new Lockstep({ seats: [0, 1], me: 0 });
  l.outgoing(0);
  l.queue({ type: "harvest" });
  assert.deepEqual(l.outgoing(3).map((b) => [b.n, b.c.length]), [[3, 0], [4, 0], [5, 1]]);
  assert.ok(l.receive(1, 2, [{ type: "a" }]));
  assert.ok(!l.receive(1, 2, [{ type: "b" }]), "the first bundle for a turn counts");
  assert.ok(!l.receive(0, 2, []), "nobody speaks for this page's seat");
  assert.ok(!l.receive(5, 2, []), "an unknown seat is ignored");
  l.take(0); l.take(1); l.take(2);
  assert.ok(!l.receive(1, 2, []), "a turn already run takes no more");
});

test("rewind: taken turns come back from history, earlier ones are forgotten", () => {
  const l = new Lockstep({ seats: [0, 1], me: 0 });
  for (let t = 0; t < 6; t++) { l.outgoing(t); l.receive(1, t + 2, [{ type: "o", t }]); l.take(t); }
  l.record(9, "aa");
  l.rewind(4, 6);
  assert.ok(l.ready(4) && l.ready(5) && l.ready(6));
  assert.deepEqual(l.take(4).map((c) => c.t), [2]);
  assert.ok(!l.hashes.has(9), "hash records after the load point are cleared");
});

test("desync detection: the first tick where two seats' hashes differ, once", () => {
  const l = new Lockstep({ seats: [0, 1], me: 0 });
  assert.equal(l.record(100, "abc"), null);
  assert.equal(l.hear(1, 100, "abc"), null);
  assert.equal(l.hear(1, 200, "def"), null, "one hash alone is no disagreement");
  assert.deepEqual(l.record(200, "xyz"), { tick: 200, hashes: { 0: "xyz", 1: "def" } });
  assert.equal(l.hear(1, 300, "q"), null);
  assert.equal(l.record(300, "r"), null, "reported once until a rewind");
});

// Two sessions joined by hand, a fake clock, no server.
function pair({ wire = true } = {}) {
  let clock = 0;
  const now = () => clock, events = [[], []], sessions = [];
  const options = lanOptions({ mode: "duel", map: "classic" });
  for (const seat of [0, 1]) {
    const sim = new Simulation(options), view = perspectiveFor(seat);
    view?.toView(sim);
    sessions.push(new LanSession({ sim, seat, seats: [0, 1], send: (m) => { if (wire) sessions[1 - seat].handle({ ...JSON.parse(encode(m)), s: seat }); return 1; }, Simulation, now, perspective: view, onEvent: (type, data) => events[seat].push({ type, data }) }));
  }
  for (const s of sessions) s.go = true;
  return { sessions, events, tick: (ms) => { clock += ms; } };
}

test("a stalled peer: the overlay event after a moment, the match ends after the timeout", () => {
  const { sessions: [a], events, tick } = pair({ wire: false });
  let ran = 0;
  while (a.tick()) ran++;
  assert.equal(ran, INPUT_DELAY * TURN_TICKS, "the empty opening turns run, then the page waits");
  assert.ok(!events[0].some((e) => e.type === "stall"), "no overlay for a short wait");
  tick(STALL_SHOW_MS);
  assert.equal(a.tick(), false);
  assert.deepEqual(events[0].at(-1), { type: "stall", data: { seats: [1], ms: STALL_SHOW_MS } });
  tick(STALL_TIMEOUT_MS - STALL_SHOW_MS - 1);
  a.update();
  assert.equal(a.ended, null);
  tick(1);
  a.update();
  assert.equal(a.ended, "timeout");
  assert.deepEqual(events[0].at(-1), { type: "ended", data: { why: "timeout", seats: [1] } });
});

test("a pause holds both pages and never times out; resuming lets both run on", () => {
  const { sessions: [a, b], events, tick } = pair();
  a.setHold("pause");
  assert.equal(b.canRun, false, "the other page stops at once");
  assert.equal(b.remoteHolds.get(0), "pause");
  assert.equal(a.tick(), false);
  tick(STALL_TIMEOUT_MS * 2);
  b.update();
  assert.equal(b.ended, null);
  a.setHold(null);
  for (let i = 0; i < 30; i++) { a.tick(); b.tick(); }
  assert.equal(a.sim.ticks, b.sim.ticks);
  assert.ok(a.sim.ticks >= 27);
  assert.ok(events[1].some((e) => e.type === "hold" && e.data.on) && events[1].some((e) => e.type === "hold" && !e.data.on));
});

test("hash checks run every HASH_TICKS ticks and agree; a page's own orders run after the input delay", () => {
  const { sessions: [a, b] } = pair();
  b.queue({ type: "harvest" });
  for (let i = 0; i < HASH_TICKS * 2 + 3; i++) { a.tick(); b.tick(); }
  assert.equal(a.lock.hashes.get(HASH_TICKS).get(1), a.lock.hashes.get(HASH_TICKS).get(0));
  assert.equal(a.desync, null);
  const harvest = a.sim.commandLog.find((c) => c.type === "harvest");
  assert.deepEqual([harvest.team, harvest.tick], [1, INPUT_DELAY * TURN_TICKS], "the guest's order ran for team 1 on turn 2");
});

test("messages: our types only, sizes and shapes checked; names trimmed and plain", () => {
  assert.deepEqual(decode(encode({ t: "turn", n: 3, c: [{ type: "harvest" }] })), { t: "turn", n: 3, c: [{ type: "harvest" }] });
  for (const bad of ["", "{", "[]", "null", '{"t":"nope"}', '{"t":"turn","n":-1,"c":[]}', '{"t":"turn","n":1,"c":[1]}', '{"t":"hash","k":1}', '{"t":"ping","s":"x"}', JSON.stringify({ t: "ping", pad: "x".repeat(70000) })]) assert.equal(decode(bad), null, bad.slice(0, 30));
  assert.ok(decode(JSON.stringify({ t: "resync", k: 3, save: "x".repeat(200000) })), "a resync carries a whole save");
  assert.equal(cleanName("  <b>Nguyễn</b>  "), "bNguyễn/b");
  assert.equal(cleanName(""), "Player");
  assert.equal(cleanName("x".repeat(40)).length, 16);
  assert.equal(turnOf(7), 2);
});

test("the perspective swap is an involution: twice gives back the same state, once shows team 1 as the player", () => {
  const sim = new Simulation(lanOptions({ mode: "coop", map: "classic", aiCount: 2, factions: ["meridian", "veil"] }));
  for (let i = 0; i < 400; i++) sim.tick(0.05);
  const before = sim.hash(), guestCore = sim.own(1).find((e) => e.type === "hq").id;
  swapTeams(sim, 0, 1);
  assert.equal(sim.own(0).find((e) => e.type === "hq").id, guestCore, "the guest's own core is team 0 on its page");
  assert.equal(sim.factions[0], "veil");
  assert.equal(sim.hostile(0, 1), false);
  swapTeams(sim, 0, 1);
  assert.equal(sim.hash(), before);
  const duel = new Simulation(lanOptions({ mode: "duel" }));
  duel.result = "victory";
  swapTeams(duel, 0, 1);
  assert.equal(duel.result, "defeat", "the host's win is the guest's defeat");
  const events = [{ type: "message", text: "for host", team: 0 }, { type: "message", text: "for guest", team: 1 }, { type: "impact", team: 1 }];
  viewEvents(events, 0, 0, 1);
  assert.deepEqual(events, [{ type: "message", text: "for guest", team: 0 }, { type: "impact", team: 0 }], "teams as the guest sees them; the host's message is not shown");
});

test("LAN rules: seats, sides, results; a match without the option is unchanged", () => {
  assert.deepEqual(lanSeats({ humans: [1, 1, 9], sides: [0, 1] }, 1), { humans: [0, 1], sides: [0, 1] });
  const coop = { humans: [0, 1], sides: [0, 0, 1, 1] };
  assert.equal(lanHostile(coop, 0, 1), false);
  assert.equal(lanHostile(coop, 1, 3), true);
  assert.equal(lanResult(coop, [false, true, true, false]), null, "a person whose ally stands keeps watching");
  assert.equal(lanResult(coop, [false, true, false, false]), "victory");
  assert.equal(lanResult(coop, [false, false, true, true]), "defeat");
  assert.equal(resultFor({ sides: [0, 1] }, "victory", 1), "defeat");
  assert.equal(resultFor(coop, "victory", 1), "victory");
  const plain = new Simulation();
  assert.equal("lan" in plain, false);
  assert.equal(plain.humanTeam(1), false);
  assert.equal(JSON.parse(plain.serialize()).options.lan, undefined);
  const lan = new Simulation(lanOptions({ mode: "duel" }));
  assert.equal(lan.humanTeam(1), true);
  assert.equal(lan.coalition, false);
  const loaded = Simulation.load(lan.serialize());
  assert.deepEqual(loaded.lan, lan.lan, "a LAN save loads as a LAN match (the resync)");
  assert.equal(loaded.hash(), lan.hash());
  assert.deepEqual(cleanSetup({ mode: "coop", map: "nowhere", factions: ["veil", "x"], aiCount: 7 }, { classic: 1 }), { mode: "coop", map: "riverlands", factions: ["veil", "ashfall"], aiFaction: "sunward", aiCount: 1, aiSpeed: "normal" });
});

test("a build with its builder's follow-up order runs as the pair", () => {
  const sim = new Simulation(lanOptions({ mode: "duel", map: "classic" }));
  const hq = sim.own(1).find((e) => e.type === "hq"), worker = sim.own(1).find((e) => e.type === "worker");
  const spot = sim.findPlacement("barracks", 1, hq.x + 9 * Math.sign(-hq.x), hq.z + 5 * Math.sign(-hq.z));
  const site = applyCommand(sim, { team: 1, type: "build", worker: worker.id, building: "barracks", x: spot.x, z: spot.z, follow: { type: "build", resume: true } });
  assert.ok(site?.id);
  assert.deepEqual(sim.commandLog.map((c) => c.type), ["build", "order"]);
  assert.equal(worker.orders[0].target, site.id);
});

test("QR codes: the join address fits a small code; the svg has a quiet zone", () => {
  const q = qrMatrix("http://192.168.1.20:4570/?lan=join");
  assert.equal(q.version, 3);
  assert.equal(q.size, 29);
  assert.ok(q.dark(0, 0) && q.dark(6, 6) && !q.dark(7, 7), "finder pattern corner");
  assert.match(qrToSvg("hi"), /^<svg[^>]+viewBox="0 0 29 29"/);
  assert.throws(() => qrMatrix("x".repeat(300)));
});
