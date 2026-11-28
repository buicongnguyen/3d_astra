// W11 LAN play, end to end without a browser: the real host server (tools/lan-server.mjs, in this process on
// LAN_TEST_PORT, default 4573) and two headless players, each a LanClient over Node's own WebSocket with its
// own Simulation and LanSession (src/net/), the guest showing the match from its own side (perspective.js)
// as the page does. Scripted players (tests/lib/lan-bot.mjs) give orders on both sides.
//   - 1v1 for up to 3 minutes (or to a result both pages reach at the same tick) and co-op against the computer
//     for 2.5 minutes end on the same state hash on both pages, every 5 s check agreed, and both teams' orders ran;
//   - a forced desync is seen by both pages, the guest continues from the host's battle, and the two agree again;
//   - a guest leaving: 1v1 ends for the host ("opponentLeft"); in co-op the host plays on.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { startLanServer } from "../tools/lan-server.mjs";
import { LanClient } from "../src/net/client.js";
import { lanOptions } from "../src/net/match.js";
import { swapTeams } from "../src/net/perspective.js";
import { lanBot } from "./lib/lan-bot.mjs";

const PORT = Number(process.env.LAN_TEST_PORT || 4573);
const URL_WS = `ws://127.0.0.1:${PORT}/lan/ws`;
const yieldIO = () => new Promise((resolve) => setImmediate(resolve));

const canonicalHash = (s) => { if (s.seat) swapTeams(s.sim, 0, s.seat); try { return s.sim.hash(); } finally { if (s.seat) swapTeams(s.sim, 0, s.seat); } };

// Every connection a test opened, closed after the test even when it fails (test.afterEach below).
const opened = new Set();

// Host + guest through the lobby to a started match; resolves with both players' sessions.
async function lobby(setup) {
  const host = new LanClient(URL_WS, { name: "Host" }), guest = new LanClient(URL_WS, { name: "Guest" });
  opened.add(host).add(guest);
  await host.connect();
  await guest.connect();
  host.send({ t: "host", setup });
  await host.next((m) => m.t === "room" && m.room.players.length === 1);
  guest.send({ t: "join" });
  await host.next((m) => m.t === "room" && m.room.players.length === 2);
  guest.send({ t: "ready", on: true });
  await host.next((m) => m.t === "room" && m.room.players.every((p) => p.ready));
  const starts = [host.next((m) => m.t === "start"), guest.next((m) => m.t === "start")];
  host.send({ t: "start", options: lanOptions(setup) });
  const [hs, gs] = await Promise.all(starts);
  assert.equal(hs.you, 0);
  assert.equal(gs.you, 1);
  assert.deepEqual(gs.seats.map((s) => s.name), ["Host", "Guest"]);
  const events = [[], []];
  const players = [[host, hs], [guest, gs]].map(([client, start], i) => {
    const session = client.match(start, { Simulation, onEvent: (type, data) => events[i].push({ type, data }) });
    return { client, session, bot: lanBot(0, { seed: i + 1 }), botTick: -1, events: events[i] };
  });
  const go = Promise.all(players.map((p) => p.client.next((m) => m.t === "go")));
  for (const p of players) p.client.send({ t: "loaded" });
  await go;
  return players;
}

// Both pages play on as fast as the lockstep lets them, each player's bot giving its orders once per tick.
// Returns "done" at untilTick (or the end of the match), "held" once nothing has moved for 300 rounds.
async function play(players, untilTick, { maxRounds = 200000, during } = {}) {
  let idle = 0;
  for (let round = 0; round < maxRounds; round++) {
    const live = players.filter((p) => !p.gone && !p.session.ended && !p.session.sim.result && p.session.sim.ticks < untilTick);
    if (!live.length) return "done";
    let moved = false;
    for (const p of live) {
      const s = p.session;
      for (let n = 0; n < 30 && s.sim.ticks < untilTick; n++) {
        if (p.botTick !== s.sim.ticks) { p.botTick = s.sim.ticks; for (const c of p.bot(s.sim)) s.queue(c); }
        const ok = s.tick();
        s.sim.events.length = 0;
        if (!ok) break;
        moved = true;
        during?.(p);
      }
    }
    if ((idle = moved ? 0 : idle + 1) > 300) return "held";
    await yieldIO();
  }
  throw new Error("the match did not reach its end in time");
}

// Every 5 s check both pages hold: the host's and the guest's hash of one tick, wherever both arrived.
function agreedChecks(players) {
  let both = 0;
  for (const p of players) for (const [tick, at] of p.session.lock.hashes) {
    if (!at.has(0) || !at.has(1)) continue;
    assert.equal(at.get(0), at.get(1), `both pages hashed the same state at tick ${tick}`);
    both++;
  }
  return both / 2;
}
const teamsCommanded = (sim) => new Set(sim.commandLog.map((c) => c.team));
// Closes both connections and waits (bounded) until the server's room is empty again.
async function close(players) {
  for (const p of players) p.client.close();
  for (let i = 0; i < 400 && server.room().players.length; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(server.room().players.length, 0, "the room is free for the next battle");
}

let server;
test.before(async () => { server = await startLanServer({ port: PORT, host: "127.0.0.1", log: () => {} }); });
test.after(async () => { await server?.close(); });
// A test that fails before its close() would leave the room taken, and every later test would then fail with
// "timeout waiting for a message" in the lobby: its connections are closed here, so a failure stays its own.
test.afterEach(async () => {
  for (const client of opened) client.close();
  opened.clear();
  for (let i = 0; i < 400 && server?.room().players.length; i++) await new Promise((r) => setTimeout(r, 5));
});

// The result of the match as the guest's page tells it (its own side is team 0 there).
const guestView = { victory: "defeat", defeat: "victory", draw: "draw" };

test("1v1 over the LAN server: up to three minutes of orders on both sides end on one state hash and one result", async () => {
  const players = await lobby({ mode: "duel", map: "riverlands", factions: ["meridian", "ashfall"] });
  const started = Date.now();
  await play(players, 3600);
  const [h, g] = players.map((p) => p.session);
  // The match plays its three minutes, or ends sooner in one result that both pages reach at the same tick.
  // 2026-11-28 (owner: player Harvesters go to work on their own, sendToWork): both bots' trained Harvesters now
  // mine instead of standing idle, and the host's bot takes the guest's core at tick 2763, the same on both pages.
  assert.equal(g.sim.ticks, h.sim.ticks, "both pages stopped at the same tick");
  assert.ok(h.sim.ticks >= 2400, `at least two minutes of play (${h.sim.ticks} ticks)`);
  if (h.sim.ticks < 3600) assert.ok(h.sim.result, `a match that stops before 3600 ticks has a result (tick ${h.sim.ticks})`);
  assert.equal(g.sim.result, h.sim.result ? guestView[h.sim.result] : null, "both pages tell the same result, each from its own side");
  assert.equal(canonicalHash(h), canonicalHash(g), "the same match on both pages");
  assert.ok(agreedChecks(players) >= Math.floor(h.sim.ticks / 120), "every 5 s hash check agreed");
  assert.deepEqual([...teamsCommanded(h.sim)].sort(), [0, 1], "both people's orders ran");
  const log = h.sim.commandLog, built = log.findIndex((c) => c.team === 1 && c.type === "build");
  assert.ok(built >= 0 && log[built + 1]?.type === "order" && log[built + 1].order.type === "build" && log[built + 1].team === 1, "the guest's build order and its builder's follow-up ran as a pair");
  assert.ok(players.every((p) => !p.events.some((e) => e.type === "desync")), "no desync");
  const seconds = (Date.now() - started) / 1000;
  const lag = h.stats.lags.length ? h.stats.lags.reduce((a, b) => a + b, 0) / h.stats.lags.length : 0;
  const played = h.sim.ticks / 20;
  console.log(`# 1v1 ${played.toFixed(0)} s of play (${h.sim.result || "running"}) in ${seconds.toFixed(1)} s; host sent ${h.stats.sent} messages, ${(h.stats.bytesOut / played).toFixed(0)} B per played second`);
  console.log(`# guest hash ${canonicalHash(g)}; host command lag (unpaced) ${lag.toFixed(1)} ms over ${h.stats.lags.length} orders`);
  await close(players);
});

test("co-op against the computer: two people and an AI side agree for 2.5 minutes", async () => {
  const players = await lobby({ mode: "coop", map: "classic", factions: ["meridian", "wardens"], aiFaction: "ashfall", aiCount: 2, aiSpeed: "normal" });
  await play(players, 3000);
  const [h, g] = players.map((p) => p.session);
  assert.equal(h.sim.enemyCount, 3);
  assert.deepEqual(h.sim.lan.sides, [0, 0, 1, 1]);
  assert.equal(h.sim.hostile(0, 1), false, "the two people are allies");
  assert.equal(h.sim.hostile(0, 2), true);
  assert.equal(h.sim.hostile(2, 3), false, "the computer sides are allies");
  assert.equal(canonicalHash(h), canonicalHash(g));
  assert.ok(agreedChecks(players) >= 25);
  assert.ok(h.sim.own(2).length > 10 && h.sim.own(3).length > 10, "the computer sides play");
  await close(players);
});

test("a forced desync is seen on both pages and the guest continues from the host's battle", async () => {
  const players = await lobby({ mode: "duel", map: "basin" });
  await play(players, 600);
  const [h, g] = players.map((p) => p.session);
  // Something only the guest's page changes: its rival's stock (team 0 is the host in the shared state).
  swapTeams(g.sim, 0, 1); g.sim.players[0].alloy += 77; swapTeams(g.sim, 0, 1);
  assert.equal(await play(players, 800), "held", "the match holds once the hashes differ");
  for (const p of players) assert.ok(p.events.some((e) => e.type === "desync"), "both pages say the battles went out of step");
  assert.ok(h.desync && g.desync, "the match holds while out of step");
  const resynced = players[1].client.next((m) => m.t === "resync");
  g.requestSync();
  await resynced;
  await yieldIO();
  assert.equal(g.desync, null);
  assert.equal(h.desync, null);
  assert.ok(players[1].events.some((e) => e.type === "resync"));
  assert.equal(canonicalHash(h), canonicalHash(g), "the same battle right after the resync");
  await play(players, 1400);
  assert.equal(canonicalHash(h), canonicalHash(g), "and still the same 30 s later");
  assert.equal(players.filter((p) => p.events.filter((e) => e.type === "desync").length > 1).length, 0, "no second desync");
  await close(players);
});

test("a guest who leaves: a 1v1 ends for the host, a co-op host plays on", async () => {
  const duel = await lobby({ mode: "duel", map: "riverlands" });
  await play(duel, 200);
  const ended = duel[0].client.next((m) => m.t === "left");
  duel[1].client.close();
  duel[1].gone = true;
  await ended;
  assert.equal(duel[0].session.ended, "opponentLeft");
  await close(duel);

  const coop = await lobby({ mode: "coop", map: "riverlands", aiCount: 1 });
  await play(coop, 200);
  const left = coop[0].client.next((m) => m.t === "left");
  coop[1].client.close();
  coop[1].gone = true;
  await left;
  assert.equal(coop[0].session.ended, null, "co-op goes on");
  assert.ok(coop[0].events.some((e) => e.type === "left" && e.data.ally));
  await play(coop, 600);
  assert.equal(coop[0].session.sim.ticks, 600, "the host plays on alone");
  await close(coop);
});
