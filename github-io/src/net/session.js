// W11 LAN play: one page's side of a running LAN match. It joins the lockstep scheduler (lockstep.js),
// the messages (protocol.js) and the simulation: the page's own orders are queued, never applied at once;
// each tick runs only when every player's commands for its turn are here; state hashes are compared every
// HASH_TICKS ticks; a desync, a stall, a pause and a player leaving each become an event for the page.
//
// The same class drives the browser page (src/net/lan-ui.js) and the headless test clients
// (tests/lan-integration.test.js), so the tests play through exactly the code the game uses.
//
//   const session = new LanSession({ sim, seat, seats, host: 0, send, Simulation, onEvent });
//   session.handle(message)       every relayed message from the server
//   session.queue(command)        this page's order (team is set to the seat when it runs)
//   session.advance(dt, hooks)    the frame: runs the ticks that are due and ready; returns how many
//   session.update()              pings, the stall timeout (call every frame)
// Events (onEvent(type, data)): "stall" { seats, ms }, "timeout" { seats }, "desync" { tick }, "resync" { sim },
//   "hold" { seat, on, why }, "left" { seat, ally }, "ended" { why }, "pong" { rtt }.
import { TICK, TURN_TICKS, HASH_TICKS, STALL_SHOW_MS, STALL_TIMEOUT_MS, PING_MS, turnOf } from "./protocol.js";
import { Lockstep } from "./lockstep.js";
import { autoRepairJobs } from "../sim/auto-repair.js";
import { viewEvents } from "./perspective.js";

// The simulation's own command door (a page may lock sim.command with an own property, as the replay viewer does).
export function door(sim, command) {
  return Object.getPrototypeOf(sim).command.call(sim, command);
}

// One scheduled command. A build placed with its builder's follow-up order (app/orders.js confirmBuild sends
// the two together: the second needs the new site's id) runs as the pair, both logged as ordinary commands.
export function applyCommand(sim, command) {
  if (command.type === "build" && command.follow && typeof command.follow === "object") {
    const { follow, ...build } = command;
    const site = door(sim, build);
    if (site && Number.isInteger(site.id)) door(sim, { team: command.team, type: "order", ids: [command.worker], order: { ...follow, target: site.id } });
    return site;
  }
  return door(sim, command);
}

export class LanSession {
  constructor({ sim, seat, seats, host = 0, sides = null, send, Simulation = null, now = () => Date.now(), onEvent = () => {}, perspective = null, delay }) {
    this.sim = sim;
    this.seat = seat;
    this.host = host;
    // Canonical sides (team -> side id); never the live sim.lan.sides, which a perspective page swaps.
    this.sides = sides ? [...sides] : sim?.lan ? [...sim.lan.sides] : null;
    this.lock = new Lockstep({ seats, me: seat, ...(delay !== undefined ? { delay } : {}) });
    this.sendRaw = send;
    this.Simulation = Simulation;
    this.now = now;
    this.onEvent = onEvent;
    // Optional { toCanonical(sim), toView(sim) }: a page whose player is not team 0 shows the match from its
    // own side (perspective.js) and puts the shared state back before every tick, hash and save.
    this.perspective = perspective;
    this.go = false;
    this.ended = null;
    this.localHold = null;
    this.remoteHolds = new Map();
    this.desync = null;
    this.stallSince = null;
    this.accumulator = 0;
    this.rtt = null;
    this.lastPing = -Infinity;
    this.stats = { sent: 0, received: 0, bytesOut: 0, bytesIn: 0, lags: [] };
    this.queuedAt = [];
    this.sentAt = new Map();
  }

  send(message) {
    this.stats.sent++;
    try { this.stats.bytesOut += this.sendRaw(message) || 0; } catch { /* the connection is closing: the server reports it */ }
  }

  // ---------- this page's orders ----------
  queue(command) {
    if (this.ended) return false;
    const { team, ...rest } = command;
    this.lock.queue(rest);
    this.queuedAt.push(this.now());
    return rest;
  }

  // ---------- running ----------
  get canRun() {
    return this.go && !this.ended && !this.desync && !this.localHold && this.remoteHolds.size === 0 && !this.sim.result;
  }

  // The frame: real time in, ticks out (at most `max` per frame; a stall keeps at most 0.25 s owed).
  advance(dt, hooks = {}, max = 6) {
    if (!this.canRun) { this.accumulator = 0; this.stallSince = null; return 0; }
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    let ran = 0;
    while (this.accumulator >= TICK && ran < max) {
      if (!this.tick(hooks)) break;
      this.accumulator -= TICK;
      ran++;
      if (!this.canRun) break;
    }
    return ran;
  }

  // One tick if its turn is ready: the turn's commands (on its first tick), the step, the auto-repair jobs
  // of every person's team (as app/frame.js asks them for team 0 in single player) and the hash check.
  tick({ before, after } = {}) {
    const sim = this.sim;
    if (!this.canRun) return false;
    let commands = null;
    if (sim.ticks % TURN_TICKS === 0) {
      const turn = sim.ticks / TURN_TICKS;
      for (const bundle of this.lock.outgoing(turn)) {
        this.sentAt.set(bundle.n, this.queuedAt.splice(0, bundle.c.length));
        this.send({ t: "turn", n: bundle.n, c: bundle.c });
      }
      commands = this.lock.take(turn);
      if (!commands) {
        const t = this.now();
        this.stallSince ??= t;
        if (t - this.stallSince >= STALL_SHOW_MS) this.onEvent("stall", { seats: this.lock.missing(turn), ms: t - this.stallSince });
        return false;
      }
      if (this.stallSince !== null) { this.stallSince = null; this.onEvent("stall", { seats: [], ms: 0 }); }
      const mine = this.sentAt.get(turn);
      if (mine) { const t = this.now(); for (const at of mine) this.stats.lags.push(t - at); this.sentAt.delete(turn); }
    }
    before?.(sim);
    const heard = sim.events.length;
    this.perspective?.toCanonical(sim);
    let hash = null;
    try {
      if (commands) for (const c of commands) applyCommand(sim, c);
      sim.tick(TICK);
      if (sim.ticks % 20 === 0 && sim.lan) for (const team of sim.lan.humans) {
        if (sim.players[team]?.eliminated) continue;
        for (const job of autoRepairJobs(sim, team)) door(sim, { team, type: "order", ids: job.ids, order: { type: "repair", target: job.target, auto: true, resume: true } });
      }
      if (sim.ticks % HASH_TICKS === 0) hash = sim.hash();
    } finally {
      this.perspective?.toView(sim);
    }
    viewEvents(sim.events, heard, 0, this.perspective?.team || 0);
    after?.(sim);
    if (hash) {
      this.send({ t: "hash", k: sim.ticks, h: hash });
      const d = this.lock.record(sim.ticks, hash);
      if (d) this.flagDesync(d.tick, true);
    }
    return true;
  }

  // ---------- pings, stall timeout ----------
  update() {
    const t = this.now();
    if (this.go && !this.ended && t - this.lastPing >= PING_MS) { this.lastPing = t; this.send({ t: "ping", at: t }); }
    if (this.stallSince !== null && !this.ended && !this.localHold && this.remoteHolds.size === 0 && t - this.stallSince >= STALL_TIMEOUT_MS) {
      const seats = this.lock.missing(turnOf(this.sim.ticks));
      this.end("timeout", { seats });
    }
  }

  // ---------- pause ----------
  // Any open menu on this page holds the match for everyone (why: "pause", "away", ...); null resumes.
  setHold(why) {
    const next = why || null;
    if (next === this.localHold) return;
    this.localHold = next;
    this.stallSince = null;
    if (!this.ended) this.send({ t: "hold", on: !!next, why: next || "" });
  }

  // ---------- desync ----------
  flagDesync(tick, tell) {
    if (this.desync || this.ended) return;
    this.desync = { tick };
    if (tell) this.send({ t: "desync", k: tick });
    this.onEvent("desync", { tick });
  }
  // "Continue from the host's battle": the host sends its battle; a guest asks the host to.
  requestSync() {
    if (this.ended) return;
    if (this.seat === this.host) this.sendResync();
    else this.send({ t: "askSync" });
  }
  sendResync() {
    this.perspective?.toCanonical(this.sim);
    let save, tick;
    try { save = this.sim.serialize(); tick = this.sim.ticks; } finally { this.perspective?.toView(this.sim); }
    this.send({ t: "resync", k: tick, save });
    this.lock.rewind(Math.ceil(tick / TURN_TICKS), tick);
    this.desync = null;
    this.onEvent("resync", { sim: this.sim, tick, own: true });
  }
  loadResync(tick, save) {
    const loaded = this.Simulation?.load(save);
    if (!loaded || loaded.ticks !== tick) { this.end("resyncFailed"); return; }
    this.sim = loaded;
    this.perspective?.toView(loaded);
    this.lock.rewind(Math.ceil(tick / TURN_TICKS), tick);
    this.desync = null;
    this.accumulator = 0;
    this.onEvent("resync", { sim: loaded, tick, own: false });
  }

  // ---------- leaving ----------
  end(why, data = {}) {
    if (this.ended) return;
    this.ended = why;
    this.onEvent("ended", { why, ...data });
  }
  leave() {
    if (!this.ended) this.send({ t: "bye", why: "left" });
    this.end("quit");
  }
  allyOf(seat) {
    return !!this.sides && this.sides[seat] === this.sides[this.seat];
  }
  // A player gone for good: an ally's team stands idle and the match goes on; a rival's leaving ends it.
  peerGone(seat) {
    if (!this.lock.seats.includes(seat) || seat === this.seat) return;
    const ally = this.allyOf(seat);
    this.lock.drop(seat);
    this.remoteHolds.delete(seat);
    this.onEvent("left", { seat, ally });
    if (!ally && !this.lock.seats.some((s) => s !== this.seat && !this.allyOf(s))) this.end("opponentLeft", { seat });
  }

  // ---------- messages ----------
  handle(m, bytes = 0) {
    this.stats.received++;
    this.stats.bytesIn += bytes;
    const from = m.s;
    switch (m.t) {
      case "go": this.go = true; break;
      case "turn": this.lock.receive(from, m.n, m.c); break;
      case "hash": { const d = this.lock.hear(from, m.k, m.h); if (d) this.flagDesync(d.tick, true); break; }
      case "desync": this.flagDesync(m.k, false); break;
      case "askSync": if (this.seat === this.host) this.sendResync(); break;
      case "resync": if (from === this.host && this.seat !== this.host) this.loadResync(m.k, m.save); break;
      case "hold":
        if (m.on) this.remoteHolds.set(from, m.why || "pause"); else this.remoteHolds.delete(from);
        this.onEvent("hold", { seat: from, on: !!m.on, why: m.why || "pause" });
        break;
      case "ping": this.send({ t: "pong", at: m.at, to: from }); break;
      case "pong": if (m.to === this.seat && Number.isFinite(m.at)) { this.rtt = this.now() - m.at; this.onEvent("pong", { rtt: this.rtt }); } break;
      case "bye": this.peerGone(from); break;
      case "left": if (Number.isInteger(m.seat)) this.peerGone(m.seat); break;
      default: break;
    }
  }
}
