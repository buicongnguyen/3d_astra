// W11 LAN play: the input-delay lockstep scheduler. No network, no DOM, no simulation: it only decides
// which commands run on which turn, so every page runs the same commands in the same order.
//
//   - A turn is TURN_TICKS ticks. A command given while this page is about to run turn T is sent in
//     this page's bundle for turn T + delay; turns 0 .. delay-1 are empty for everyone.
//   - Turn T may run only when every seat's bundle for T is here (an empty bundle counts).
//   - A turn's commands run before its first tick, seat by seat (lowest seat first), each seat's in the
//     order it gave them; `team` is always the seat's own (a page cannot command another team).
//   - Taken turns are kept for a while (history), so a page that loads the host's battle after a
//     desync can run again from an earlier turn (rewind).
//   - Hashes: each page records its own state hash every HASH_TICKS ticks and hears the others';
//     the first tick where two differ is a desync.
import { INPUT_DELAY } from "./protocol.js";

export class Lockstep {
  constructor({ seats, me, delay = INPUT_DELAY, keep = 400 }) {
    if (!Array.isArray(seats) || !seats.includes(me)) throw new Error("Lockstep: my seat must be one of the seats");
    this.seats = [...new Set(seats)].sort((a, b) => a - b);
    this.me = me;
    this.delay = delay;
    this.keep = keep;
    this.turns = new Map(); // turn -> Map(seat -> commands)
    this.history = new Map(); // taken turn -> Map(seat -> commands)
    this.pending = []; // my commands not yet put in a bundle
    this.nextSend = delay; // the first turn I have not sent a bundle for
    this.hashes = new Map(); // tick -> Map(seat -> hash)
    this.desync = null; // { tick, hashes } once seen
  }

  // A command from this page's player; it runs on a later turn (never mutates the match now).
  queue(command) {
    this.pending.push(command);
  }

  // The bundles this page owes before it runs `turn`: every turn up to turn + delay. The newest gets the
  // pending commands; the ones in between (after a stall) go out empty. Returns [{ n, c }] to send.
  outgoing(turn) {
    const out = [];
    const last = turn + this.delay;
    while (this.nextSend <= last) {
      const n = this.nextSend++;
      const c = n === last ? this.pending.splice(0) : [];
      this.put(this.me, n, c);
      out.push({ n, c });
    }
    return out;
  }

  // A peer's bundle (the first one for a turn counts; a repeat or a late one for a taken turn is dropped).
  receive(seat, n, commands) {
    if (!this.seats.includes(seat) || seat === this.me || !Number.isInteger(n) || n < 0) return false;
    if (this.history.has(n) || this.turns.get(n)?.has(seat)) return false;
    this.put(seat, n, Array.isArray(commands) ? commands : []);
    return true;
  }

  put(seat, n, commands) {
    let bundle = this.turns.get(n);
    if (!bundle) this.turns.set(n, (bundle = new Map()));
    bundle.set(seat, commands);
  }

  // The seats whose bundle for `turn` has not arrived ([] = the turn can run).
  missing(turn) {
    if (turn < this.delay) return [];
    const bundle = this.turns.get(turn);
    return this.seats.filter((s) => !bundle?.has(s));
  }
  ready(turn) {
    return this.missing(turn).length === 0;
  }

  // The commands of a ready turn in run order, each with its seat's team; the turn moves to history.
  take(turn) {
    if (!this.ready(turn)) return null;
    const bundle = this.turns.get(turn) || new Map();
    this.turns.delete(turn);
    this.history.set(turn, bundle);
    for (const old of this.history.keys()) { if (old > turn - this.keep) break; this.history.delete(old); }
    const out = [];
    for (const seat of this.seats) for (const c of bundle.get(seat) || []) out.push({ ...c, team: seat });
    return out;
  }

  // A seat that left for good: its turns are no longer waited for (its team stands idle).
  drop(seat) {
    if (seat === this.me) return;
    this.seats = this.seats.filter((s) => s !== seat);
  }

  // Run again from `turn` (after loading the host's battle): taken turns from there on come back,
  // turns before it are forgotten, and hash records after the load point are cleared.
  rewind(turn, fromTick = turn) {
    for (const [n, bundle] of this.history) if (n >= turn && !this.turns.has(n)) this.turns.set(n, bundle);
    for (const n of [...this.turns.keys()]) if (n < turn) this.turns.delete(n);
    for (const n of [...this.history.keys()]) if (n >= turn) this.history.delete(n);
    for (const k of [...this.hashes.keys()]) if (k > fromTick) this.hashes.delete(k);
    this.desync = null;
  }

  // State hashes: mine (record) and a peer's (hear). Returns the desync { tick, hashes } the first time
  // two seats disagree at one tick, else null.
  record(tick, hash) { return this.note(this.me, tick, hash); }
  hear(seat, tick, hash) { return this.seats.includes(seat) ? this.note(seat, tick, hash) : null; }
  note(seat, tick, hash) {
    let at = this.hashes.get(tick);
    if (!at) this.hashes.set(tick, (at = new Map()));
    at.set(seat, hash);
    // Old checks that every seat agreed on are not needed any more.
    for (const [k, m] of this.hashes) if (k < tick - 12000) this.hashes.delete(k);
    if (this.desync) return null;
    if (new Set(at.values()).size > 1) {
      this.desync = { tick, hashes: Object.fromEntries(at) };
      return this.desync;
    }
    return null;
  }
}
