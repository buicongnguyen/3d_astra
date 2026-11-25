#!/usr/bin/env node
// W11 LAN play: the host server. Run on one PC of the home network (`npm run lan`):
//   - serves the built game (dist/) on every network address of this PC (0.0.0.0), port 4570;
//   - keeps one battle room (a host and one guest) and relays the lockstep messages between them
//     over WebSocket (/lan/ws, tools/lan-ws.mjs; no package needed);
//   - prints the address to open on the other phone or PC, with a QR code to scan.
// No internet is needed and nothing leaves the local network. See docs/LAN_PLAY.md.
//
//   node tools/lan-server.mjs [--port 4570] [--host 0.0.0.0] [--dist dist] [--no-qr]
// startLanServer() is also used in-process by tests/lan-integration.test.js.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptUpgrade } from "./lan-ws.mjs";
import { PROTOCOL, RELAYED, decode, encode, cleanName } from "../src/net/protocol.js";
import { qrToTerminal } from "../src/net/qr.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const DEFAULT_PORT = 4570;
// One host and one guest: the two seats of 1v1 and of co-op against the computer.
export const MAX_PLAYERS = 2;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".ico": "image/x-icon" };

// This PC's addresses on the local network (IPv4, not loopback), most likely home Wi-Fi/LAN first.
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) for (const a of list || []) {
    if (a.internal || (a.family !== "IPv4" && a.family !== 4)) continue;
    const virtual = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|docker|Loopback/i.test(name);
    const home = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
    out.push({ name, address: a.address, rank: (virtual ? 2 : 0) + (home ? 0 : 1) });
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ name, address }) => ({ name, address }));
}

export async function startLanServer({ port = DEFAULT_PORT, host = "0.0.0.0", dist = resolve(HERE, "..", "dist"), log = console.log, app = "dev" } = {}) {
  let nextId = 1;
  const clients = new Map();
  const room = { host: null, setup: null, phase: "lobby", loaded: new Set() };

  const roomView = () => ({
    phase: room.phase,
    setup: room.setup,
    players: [...clients.values()].filter((c) => c.role).sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : a.id - b.id))
      .map((c) => ({ id: c.id, name: c.name, role: c.role, ready: c.role === "host" || c.ready, seat: c.seat })),
  });
  const members = () => [...clients.values()].filter((c) => c.role);
  const tell = (c, m) => { try { return c.ws.send(encode(m)); } catch { return 0; } };
  const broadcastRoom = () => { const view = roomView(); for (const c of clients.values()) tell(c, { t: "room", room: view }); };
  // A refused request: a code the page words in the player's language (src/net/lan-ui.js ERRORS).
  const refuse = (c, code) => tell(c, { t: "error", code });

  function leaveRoom(c, why = "left") {
    if (!c.role) return;
    const wasHost = c.role === "host", seat = c.seat, inMatch = room.phase === "match";
    c.role = null; c.ready = false; c.seat = null;
    if (inMatch && seat !== null) for (const o of members()) tell(o, { t: "left", seat, name: c.name, id: c.id, why });
    // The host gone closes the room (a guest in the lobby hears it; one in a match already heard `left`).
    if (wasHost) {
      room.host = null; room.setup = null; room.phase = "lobby"; room.loaded.clear();
      for (const o of members()) { if (!inMatch) tell(o, { t: "left", seat: 0, name: c.name, id: c.id, why: "hostLeft" }); o.role = null; o.ready = false; o.seat = null; }
    }
    room.loaded.delete(c.id);
    log(`  ${c.name} left${wasHost ? " (the room is closed)" : ""}`);
    broadcastRoom();
  }

  function onMessage(c, m, size) {
    switch (m.t) {
      case "hello":
        if (m.v !== PROTOCOL) { refuse(c, "version"); c.ws.close(1008); return; }
        c.name = cleanName(m.name, `Player ${c.id}`);
        tell(c, { t: "welcome", id: c.id, v: PROTOCOL, app, room: roomView() });
        return;
      case "name":
        c.name = cleanName(m.name, c.name);
        broadcastRoom();
        return;
      case "host":
        if (room.host && room.host !== c.id) { refuse(c, "hosted"); return; }
        if (c.role === "guest") leaveRoom(c);
        room.host = c.id; room.setup = m.setup ?? null; room.phase = "lobby";
        c.role = "host"; c.ready = true; c.seat = null;
        log(`  ${c.name} is hosting a battle`);
        broadcastRoom();
        return;
      case "join":
        if (c.role) return;
        if (!room.host) { refuse(c, "noHost"); return; }
        if (room.phase === "match") { refuse(c, "started"); return; }
        if (members().length >= MAX_PLAYERS) { refuse(c, "full"); return; }
        c.role = "guest"; c.ready = false;
        log(`  ${c.name} joined`);
        broadcastRoom();
        return;
      case "setup":
        if (c.id !== room.host || room.phase !== "lobby") return;
        room.setup = m.setup ?? null;
        for (const o of members()) if (o.role === "guest") o.ready = false;
        broadcastRoom();
        return;
      case "ready":
        if (c.role !== "guest" || room.phase !== "lobby") return;
        c.ready = !!m.on;
        broadcastRoom();
        return;
      case "start": {
        if (c.id !== room.host || room.phase !== "lobby") return;
        const guests = members().filter((o) => o.role === "guest");
        if (!guests.length) { refuse(c, "noGuest"); return; }
        if (guests.some((o) => !o.ready)) { refuse(c, "notReady"); return; }
        room.phase = "match"; room.loaded.clear();
        const order = [c, ...guests];
        order.forEach((o, seat) => { o.seat = seat; });
        const seats = order.map((o) => ({ seat: o.seat, name: o.name }));
        for (const o of order) tell(o, { t: "start", options: m.options, setup: room.setup, seats, you: o.seat, host: 0 });
        log(`  Battle started: ${seats.map((s) => s.name).join(" vs ")}`);
        broadcastRoom();
        return;
      }
      case "loaded":
        if (room.phase !== "match" || c.seat === null) return;
        room.loaded.add(c.id);
        if (members().filter((o) => o.seat !== null).every((o) => room.loaded.has(o.id))) for (const o of members()) tell(o, { t: "go" });
        return;
      case "reset":
        if (c.id !== room.host) return;
        room.phase = "lobby"; room.loaded.clear();
        for (const o of members()) { o.seat = null; if (o.role === "guest") o.ready = false; }
        broadcastRoom();
        return;
      default:
        if (RELAYED.has(m.t) && room.phase === "match" && c.seat !== null) {
          const text = encode({ ...m, s: c.seat });
          for (const o of members()) if (o !== c && o.seat !== null) { try { o.ws.send(text); } catch { /* closing */ } }
          if (m.t === "bye") leaveRoom(c, "bye");
        }
    }
  }

  async function serveFile(req, res) {
    const url = new URL(req.url, "http://lan.local");
    if (url.pathname === "/lan/info") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ lan: true, v: PROTOCOL, app, port: server.address().port, addresses: lanAddresses().map((a) => a.address), room: roomView() }));
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(dist, path));
    if (!file.startsWith(resolve(dist) + sep) && file !== resolve(dist)) { res.writeHead(403).end(); return; }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      const body = await readFile(file);
      const fresh = /(^|[\\/])(index\.html|sw\.js|manifest\.webmanifest)$/.test(file);
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": fresh ? "no-cache" : "max-age=3600" });
      res.end(body);
    } catch {
      if (path === "/index.html") {
        res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
        res.end("The game is not built yet. On the host PC run: npm run lan");
      } else res.writeHead(404).end();
    }
  }

  const server = createServer((req, res) => { serveFile(req, res).catch(() => { try { res.writeHead(500).end(); } catch {} }); });
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url, "http://lan.local").pathname !== "/lan/ws") { socket.end("HTTP/1.1 404 Not Found\r\n\r\n"); return; }
    acceptUpgrade(req, socket, head, (ws) => {
      const c = { id: nextId++, ws, name: "Player", role: null, ready: false, seat: null };
      c.name = `Player ${c.id}`;
      clients.set(c.id, c);
      ws.on("message", (text, size) => { const m = decode(text); if (m) onMessage(c, m, size); });
      ws.on("close", () => { clients.delete(c.id); leaveRoom(c, "disconnected"); });
    });
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(port, host, () => { server.off("error", fail); ok(); }); });
  return {
    port: server.address().port,
    room: roomView,
    close: () => new Promise((ok) => { for (const c of clients.values()) c.ws.close(1001); server.close(() => ok()); }),
  };
}

// ---------- command line ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flag = (name) => args.includes(name);
  const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
  const port = Number(value("--port", process.env.LAN_PORT || DEFAULT_PORT));
  const dist = resolve(value("--dist", resolve(HERE, "..", "dist")));
  let app = "dev";
  try { app = JSON.parse(await readFile(resolve(HERE, "..", "package.json"), "utf8")).version; } catch {}
  try { await stat(join(dist, "index.html")); } catch { console.error(`No built game in ${dist}. Run: npm run lan (it builds first)`); process.exit(1); }
  let lan;
  try { lan = await startLanServer({ port, host: value("--host", "0.0.0.0"), dist, app }); }
  catch (error) { console.error(error.code === "EADDRINUSE" ? `Port ${port} is in use. Try: npm run lan:serve -- --port ${port + 1}` : String(error)); process.exit(1); }
  const addresses = lanAddresses();
  const url = (a) => `http://${a}:${lan.port}/?lan=join`;
  console.log(`\nFrontier Command LAN host (version ${app}) is running.\n`);
  console.log(`  On this PC open:   http://localhost:${lan.port}/?lan   and press Host.`);
  if (addresses.length) {
    console.log(`  Other players (same Wi-Fi or network) open:`);
    for (const a of addresses) console.log(`      ${url(a.address)}    (${a.name})`);
    if (!flag("--no-qr")) { console.log(`\n  Scan to join on a phone (${url(addresses[0].address)}):\n`); console.log(qrToTerminal(url(addresses[0].address))); }
  } else console.log("  No network address found: connect this PC to the Wi-Fi or network first.");
  console.log(`\n  Windows may ask whether Node.js may use the network: allow it on Private networks.`);
  console.log(`  Press Ctrl+C to stop.\n`);
  const stop = () => { lan.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
