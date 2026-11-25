// W11 LAN play: a minimal WebSocket server side (RFC 6455) for tools/lan-server.mjs, so the host needs no
// package: the opening handshake, masked client frames (text, continuation, ping, close), unmasked server
// text frames. Messages are UTF-8 text up to MAX bytes; anything else closes the connection.
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
export const MAX = 16 * 1024 * 1024;

// Answers an HTTP upgrade request; calls onConnection(ws, req) with a WsConnection, or refuses it.
export function acceptUpgrade(req, socket, head, onConnection) {
  const key = req.headers["sec-websocket-key"];
  if (!key || String(req.headers.upgrade || "").toLowerCase() !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }
  const accept = createHash("sha1").update(key + GUID).digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const ws = new WsConnection(socket);
  onConnection(ws, req);
  if (head?.length) ws.feed(head);
}

export class WsConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.parts = [];
    this.open = true;
    socket.on("data", (chunk) => this.feed(chunk));
    socket.on("close", () => this.closed());
    socket.on("error", () => this.closed());
  }
  closed() {
    if (!this.open) return;
    this.open = false;
    this.emit("close");
  }
  feed(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.open && this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, at = 2;
      if (len === 126) { if (this.buffer.length < 4) return; len = this.buffer.readUInt16BE(2); at = 4; }
      else if (len === 127) { if (this.buffer.length < 10) return; len = Number(this.buffer.readBigUInt64BE(2)); at = 10; }
      if (!masked) { this.close(1002); return; }
      if (len > MAX) { this.close(1009); return; }
      if (this.buffer.length < at + 4 + len) return;
      const mask = this.buffer.subarray(at, at + 4), data = Buffer.from(this.buffer.subarray(at + 4, at + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buffer = this.buffer.subarray(at + 4 + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { this.frame(0xa, data); continue; }
      if (op === 0xa) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.parts.push(data);
        const size = this.parts.reduce((n, p) => n + p.length, 0);
        if (size > MAX) { this.close(1009); return; }
        if (fin) {
          const message = Buffer.concat(this.parts).toString("utf8");
          this.parts = [];
          this.emit("message", message, size);
        }
        continue;
      }
      this.close(1002);
      return;
    }
  }
  frame(op, data) {
    if (!this.open) return 0;
    const n = data.length;
    const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
    if (n >= 126 && n < 65536) { head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); }
    else if (n >= 65536) { head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    this.socket.write(Buffer.concat([head, data]));
    return n;
  }
  // Sends one text message; returns its size in bytes.
  send(text) {
    return this.frame(0x1, Buffer.from(String(text), "utf8"));
  }
  close(code = 1000) {
    if (!this.open) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code, 0);
    try { this.frame(0x8, body); } catch { /* already gone */ }
    this.socket.end();
    this.closed();
  }
}
