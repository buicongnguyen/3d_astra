// W11 LAN play: the wire format shared by the page, the headless test clients and the host server
// (tools/lan-server.mjs). Every message is one JSON text frame: { t: type, ...fields }. The server adds
// `s` (the sender's seat) to what it relays, so a peer can never speak for another seat.
//
// Lobby (client <-> server):
//   hello   { name, v }                 first message; the server answers `welcome` { id, v, room }
//   host    { setup }                   become the host of the one room (refused when it has one)
//   join    {}                          join the room as a guest
//   setup   { setup }                   host: the battle chosen (relayed to guests in `room`)
//   name    { name }   ready { on }     a player's name and ready check
//   start   { options }                 host: every guest is ready; the server answers each with
//                                       `start` { options, seats: [{ seat, name }], you }
//   loaded  {}                          this page has built the match; when all have, the server sends `go`
//   reset   {}                          host: back to the lobby after a match
//   room    { room }                    server: the room as it stands now (players, setup, phase)
//   left    { seat, name, id }          server: someone closed the page or lost the connection
//   error   { code }                    server: a refused request (the page words it: lan-ui.js ERRORS)
// Match (relayed peer to peer by the server):
//   turn    { n, c }                    the sender's commands for turn n (an empty list still counts)
//   hash    { k, h }                    the sender's state hash after tick k
//   hold    { on, why }                 the sender paused (any open menu) or resumed
//   desync  { k }                       someone saw different hashes at tick k
//   resync  { k, save }                 host: its battle at tick k, for every page to continue from
//   askSync {}                          guest: please send `resync`
//   ping    { at }  pong { at, to }     round-trip time
//   bye     { why }                     leaving the match on purpose
export const PROTOCOL = 1;
export const TICK = 0.05;
// A turn is three 0.05 s ticks (150 ms). Commands given during a turn run two turns later (input delay
// 300 ms at most, 225 ms on average): enough for phones on busy home Wi-Fi, short enough for orders.
export const TURN_TICKS = 3;
export const INPUT_DELAY = 2;
// Both pages compare state hashes every 100 ticks (5 s of play).
export const HASH_TICKS = 100;
// Waiting for a player: the overlay shows after STALL_SHOW_MS, the match ends after STALL_TIMEOUT_MS.
export const STALL_SHOW_MS = 700;
export const STALL_TIMEOUT_MS = 30000;
export const PING_MS = 2000;
// A resync carries a whole save (a few hundred kB); anything else is small.
export const MAX_MESSAGE = 16 * 1024 * 1024;
export const MAX_SMALL = 64 * 1024;
export const NAME_MAX = 16;

const TYPES = new Set(["hello", "welcome", "host", "join", "setup", "name", "ready", "start", "loaded", "go", "reset", "room", "left", "error",
  "turn", "hash", "hold", "desync", "resync", "askSync", "ping", "pong", "bye"]);
// Messages a peer may send that the server passes on to the other players in the match.
export const RELAYED = new Set(["turn", "hash", "hold", "desync", "resync", "askSync", "ping", "pong", "bye"]);

export function encode(message) {
  return JSON.stringify(message);
}

// A received frame -> a message object, or null when it is not one of ours (never throws).
export function decode(text) {
  if (typeof text !== "string" || text.length > MAX_MESSAGE) return null;
  let m;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== "object" || Array.isArray(m) || !TYPES.has(m.t)) return null;
  if (m.t !== "resync" && m.t !== "start" && m.t !== "room" && text.length > MAX_SMALL) return null;
  if (m.t === "turn" && !(Number.isInteger(m.n) && m.n >= 0 && Array.isArray(m.c) && m.c.every((c) => c && typeof c === "object" && typeof c.type === "string"))) return null;
  if (m.t === "hash" && !(Number.isInteger(m.k) && typeof m.h === "string")) return null;
  if (m.t === "resync" && !(Number.isInteger(m.k) && typeof m.save === "string")) return null;
  if ("s" in m && !Number.isInteger(m.s)) return null;
  return m;
}

// A player name as shown: trimmed, plain characters, at most NAME_MAX long.
export function cleanName(name, fallback = "Player") {
  const text = String(name ?? "").replace(/[\u0000-\u001f<>&"'`]/g, "").trim().slice(0, NAME_MAX);
  return text || fallback;
}

export const turnOf = (tick) => Math.floor(tick / TURN_TICKS);
