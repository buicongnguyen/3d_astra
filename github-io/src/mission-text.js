// The page-free part of the mission interface (mission-ui.js): clocks, capture point names,
// objective progress text and the dialogue queue. Plain functions, so they are unit-tested.
// Mission clocks read m:ss ("1:15 / 3:00").
export const clock = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

// "relayNorth" -> "Relay North": the name of a capture point unless the mission gives a label.
export function pointLabel(mission, name) {
  const label = mission?.regions?.[name]?.label || (mission?.setup || []).find((s) => s.capturePoint === name)?.label;
  if (label) return label;
  const words = String(name).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Live progress under an objective, by type. `total` is the size of the tagged group for
// escort (how many must arrive) and destroyTag (how many are left).
export function objectiveProgress(o, total = 0) {
  if (o.state !== "active") return "";
  if (o.type === "hold") return `${o.have}/${o.need} held · ${clock(o.held)} / ${clock(o.seconds)}`;
  if (o.type === "survive") return `${clock(Math.ceil(Math.max(0, o.seconds - o.held)))} left`;
  if (o.type === "collect") return `${Math.min(100, Math.floor((o.have || 0) * 100))}%`;
  if (o.type === "build") return `${Math.min(o.have, o.need)}/${o.need}`;
  if (o.type === "escort") return `${o.have}/${Math.max(total, o.have, 1)} arrived`;
  if (o.type === "destroyTag" && total > 0) return `${total} left`;
  return "";
}

// How long a line stays up: about five seconds plus reading time.
export const lineSeconds = (text) => 5 + Math.min(8, String(text).length * 0.045);
export const LOG_LIMIT = 20, BACKLOG_LIMIT = 4;

// The dialogue queue without the page: lines wait their turn, a backlog over four keeps the
// newest four waiting (the older ones are still in the log), and the log keeps twenty lines.
export class DialogueQueue {
  constructor() { this.reset(); }
  reset() { this.current = null; this.waiting = []; this.log = []; this.left = 0; this.skipped = 0; }
  push(who, text) {
    const line = { who, text };
    this.log.push(line);
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
    if (!this.current) return this.show(line);
    this.waiting.push(line);
    if (this.waiting.length > BACKLOG_LIMIT) this.skipped += this.waiting.splice(0, this.waiting.length - BACKLOG_LIMIT).length;
    return false;
  }
  show(line) { this.current = line; this.left = line ? lineSeconds(line.text) : 0; return true; }
  // Returns true when the line on screen changed.
  next() {
    if (!this.current) return false;
    this.skipped = 0;
    this.show(this.waiting.shift() || null);
    return true;
  }
  tick(dt) {
    if (!this.current) return false;
    this.left -= dt;
    return this.left <= 0 ? this.next() : false;
  }
  // Everything goes to the log (it is already there) and the box empties.
  flush() { const had = !!this.current; this.current = null; this.waiting = []; this.skipped = 0; return had; }
}
