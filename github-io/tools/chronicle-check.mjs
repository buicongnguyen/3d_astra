// Plays the Faction Chronicles (0.20, src/story/chronicles.js) headless and checks each mission's
// own targets (`check` in its data):
//   passive    only the "harvest" command; must not be defeated before check.passive seconds,
//              and must lose (every chronicle mission has a time limit, so it plays to it)
//   objective  ObjectiveBot (tools/playbot.mjs) on the chronicle faction's roster; must win
//              inside check.win and not before check.earliest
// A Defence mission plays the DefenceBot instead (tools/defence-bot.mjs): it must reach
// check[difficulty] stars, and an empty field must lose.
// Usage: npm run check:missions -- --chronicle <id|all> [--only cs1] [--difficulty story|standard|veteran]
//                                 [--bots passive,objective] [--jobs 2] [--timeout 240] [--log]
// One mission at a time by default (--jobs 1): the machine is shared. Exits 1 when a target is missed.
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHRONICLES } from "../src/story/chronicles.js";
import { play } from "./mission-check.mjs";
import { playDefence } from "./defence-bot.mjs";

const args = process.argv.slice(2), flag = (name) => args.includes(name), value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const DIFFICULTY = value("--difficulty") || "standard";
const TIMEOUT = 1000 * +(value("--timeout") || 240);
const missionsOf = (id) => CHRONICLES.filter((c) => id === "all" || c.id === id).flatMap((c) => c.missions);
const find = (id) => CHRONICLES.flatMap((c) => c.missions).find((m) => m.id === id);
// Story: anything goes except losing; the time windows apply at Standard and stretch at Veteran.
function targets(m) {
  const t = { passive: 210, win: [420, 1200], earliest: 300, ...m.check };
  if (DIFFICULTY === "story") return { ...t, earliest: 0, win: [0, 1800] };
  if (DIFFICULTY === "veteran") return { ...t, passive: 150, earliest: 0, win: [0, t.win[1] * 1.5] };
  return t;
}
const limitOf = (m) => (m.lose || []).find((l) => l.type === "time")?.seconds ?? 1500;

function run(id, kind) {
  const m = find(id);
  if (m.defence) {
    const r = playDefence(m, { difficulty: DIFFICULTY, policy: kind === "passive" ? "passive" : "bot" });
    return { kind, result: r.result, time: r.seconds, objectives: `w${r.wave}`, stars: r.stars, lives: r.lives, towers: r.towers, wave: null, lost: 0, medal: r.medal };
  }
  return play(m, kind, { cap: kind === "passive" ? limitOf(m) + 5 : Math.max(limitOf(m) + 5, 21 * 60), log: flag("--log") && kind === "objective", progress: null, decide: "default" });
}

export function misses(m, r) {
  const out = [];
  if (m.defence) {
    const want = m.check?.[DIFFICULTY] ?? 1;
    if (r.kind === "objective" && (r.result !== "victory" || r.stars < want)) out.push(`defence bot: ${r.result} ${r.stars} stars (needs ${want})`);
    if (r.kind === "passive" && r.result !== "defeat") out.push(`empty field: ${r.result}`);
    return out;
  }
  const t = targets(m);
  if (r.kind === "passive" && r.result === "defeat" && r.time < t.passive) out.push(`passive player defeated at ${r.time} s (limit ${t.passive} s)`);
  if (r.kind === "passive" && r.result !== "defeat") out.push(`passive player did not lose (${r.result} at ${r.time} s)`);
  if (r.kind === "objective" && (r.result !== "victory" || r.time < Math.max(t.win[0], t.earliest) || r.time > t.win[1])) out.push(`objective bot: ${r.result} at ${r.time} s (must win in ${Math.max(t.win[0], t.earliest)}-${t.win[1]} s)`);
  return out;
}

// Runs the chronicle missions named by --chronicle (and --only), each kind in its own process.
export async function runChronicles() {
  const only = value("--only"), started = Date.now();
  const todo = missionsOf(value("--chronicle")).filter((m) => !only || m.id.startsWith(only));
  if (!todo.length) { console.error(`No chronicle mission for --chronicle ${value("--chronicle")}${only ? " --only " + only : ""}`); return 2; }
  const kinds = (value("--bots") || "passive,objective").split(",");
  const queue = todo.flatMap((m) => kinds.map((kind) => ({ id: m.id, kind })));
  const results = new Map(), jobs = Math.max(1, Math.min(+(value("--jobs") || 1), queue.length));
  console.log(`Chronicles · ${DIFFICULTY} · ${todo.length} mission(s)`);
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (queue.length) {
      const { id, kind } = queue.shift();
      await new Promise((done) => {
        const child = fork(fileURLToPath(import.meta.url), ["--child", id, "--kind", kind, ...args], { stdio: ["ignore", "pipe", "inherit", "ipc"] });
        let text = "";
        child.stdout.on("data", (d) => (text += d));
        const timer = setTimeout(() => child.kill(), TIMEOUT);
        child.on("message", (r) => results.set(id + kind, { ...r, text }));
        child.on("exit", () => { clearTimeout(timer); done(); });
      });
    }
  }));
  let failed = 0;
  for (const m of todo) for (const kind of kinds) {
    const r = results.get(m.id + kind);
    if (!r) { console.log(m.id.padEnd(26), kind.padEnd(10), "did not finish (wall-clock cap)"); failed++; continue; }
    if (r.text) process.stdout.write(r.text);
    const bad = misses(m, r);
    failed += bad.length;
    const extra = m.defence ? ` ${r.stars}★ ${r.lives}♥ ${r.towers || ""}` : ` obj ${String(r.objectives).padEnd(5)} wave ${String(r.wave ?? "-").padStart(4)} lost ${String(r.lost).padStart(3)}`;
    console.log(m.id.padEnd(26), r.kind.padEnd(10), String(r.result).padEnd(8), String(r.time).padStart(5) + " s", extra, r.medal ? " " + r.medal : "", bad.length ? "  MISS: " + bad.join("; ") : "");
  }
  console.log(`${failed ? failed + " target(s) missed" : "All targets met"} (${Math.round((Date.now() - started) / 1000)} s)`);
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (flag("--child")) process.send(run(value("--child"), value("--kind")));
  else process.exit(await runChronicles());
}
