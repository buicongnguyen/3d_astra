// W11 LAN play: the connection to the host server (tools/lan-server.mjs) and the match built from its
// `start` message. Shared by the page (src/net/lan-ui.js) and the headless test clients, which use Node's
// own WebSocket, so the tests go through the same code and the same server as two real players.
import { PROTOCOL, RELAYED, decode, encode } from "./protocol.js";
import { LanSession } from "./session.js";
import { perspectiveFor } from "./perspective.js";
import { lanSeats } from "../sim/lan.js";

// ws://<the host's address>/lan/ws for a page served by the host server.
export const lanSocketUrl = (loc = globalThis.location) => `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/lan/ws`;

export class LanClient {
  constructor(url, { name = "Player", WebSocketImpl = globalThis.WebSocket } = {}) {
    this.url = url;
    this.name = name;
    this.WebSocketImpl = WebSocketImpl;
    this.ws = null;
    this.id = null;
    this.room = null;
    this.session = null;
    this.listeners = new Set();
    this.open = false;
  }
  // Resolves with the `welcome` message; rejects when the server cannot be reached.
  connect(timeout = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value); } };
      const timer = setTimeout(() => { done(reject, new Error("timeout")); try { this.ws?.close(); } catch {} }, timeout);
      let ws;
      try { ws = new this.WebSocketImpl(this.url); } catch (error) { done(reject, error); return; }
      this.ws = ws;
      ws.onopen = () => { this.open = true; this.send({ t: "hello", name: this.name, v: PROTOCOL }); };
      ws.onerror = () => done(reject, new Error("unreachable"));
      ws.onclose = () => { this.open = false; done(reject, new Error("closed")); this.emit({ t: "closed" }, 0); };
      ws.onmessage = (event) => {
        const text = typeof event.data === "string" ? event.data : "";
        const m = decode(text);
        if (!m) return;
        if (m.t === "welcome") { this.id = m.id; this.room = m.room; done(resolve, m); }
        if (m.t === "room") this.room = m.room;
        // A running match hears its relayed messages and the server's `go` and `left`.
        if (this.session && (RELAYED.has(m.t) || m.t === "go" || m.t === "left")) this.session.handle(m, text.length);
        this.emit(m, text.length);
      };
    });
  }
  send(message) {
    if (!this.ws || !this.open) return 0;
    const text = encode(message);
    try { this.ws.send(text); } catch { return 0; }
    return text.length;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(m, size) { for (const fn of [...this.listeners]) { try { fn(m, size); } catch (error) { console.error(error); } } }
  // Waits for a message that `test` accepts (rejects after `timeout` ms).
  next(test, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const off = this.on((m) => { if (test(m)) { off(); clearTimeout(timer); resolve(m); } });
      const timer = setTimeout(() => { off(); reject(new Error("timeout waiting for a message")); }, timeout);
    });
  }
  close() {
    this.session = null;
    try { this.ws?.close(); } catch {}
  }

  // The match of a `start` message: the simulation built from the host's options (shown from this
  // player's side when it is not team 0) and its LanSession, joined to this connection.
  match(start, { Simulation, onEvent, perspective = true, now } = {}) {
    const sim = new Simulation(start.options), sides = lanSeats(start.options?.lan, start.options?.enemyCount).sides;
    const view = perspective ? perspectiveFor(start.you) : null;
    view?.toView(sim);
    const session = new LanSession({ sim, seat: start.you, seats: start.seats.map((s) => s.seat), host: start.host ?? 0, sides, send: (m) => this.send(m), Simulation, perspective: view, onEvent, ...(now ? { now } : {}) });
    this.session = session;
    return session;
  }
}
