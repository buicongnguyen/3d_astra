// Interleaved A/B timing of the headless sim tick (AAA round 2, W0-B; plan section 2.3).
// Loads two source trees in one process, plays the same fixed scene on each, alternating A and B
// (ABBA order, after one warm-up run each), and times every sim.tick() call. Each run gives its mean,
// p50, p95 and p99 tick time; the table reports the median of each over the runs, and B against A.
// Timings on a shared machine are indicative: the gate is the integrator's re-run on a quiet machine.
//
// Usage: node tools/perf-ab.mjs --a <tree> --b <tree> --scene <name> [--runs 7] [--warmup 1] [--json]
//   <tree>  a `src` folder (its sibling `tools` folder supplies the bots), for example `src` or
//           ../3d_astra-zones/github-io/src, or a git ref (r2-wave-0, HEAD~1, a commit id): its
//           github-io/src and github-io/tools are extracted once into .tmp/perf-ab/<commit>/.
//   --scene riverlands-x2-300   AI against AI on riverlands, 2 rivals, Fast, 300 s (aiPlayer)
//           crossroads-wave-120  Three Roads on Standard played by the DefenceBot, the first 120 s
// Run node with --expose-gc to collect garbage before every run (fewer GC pauses inside a run).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, "..");
const args = process.argv.slice(2), value = (name, fallback = null) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

// Each scene drives one tree's own code (its Simulation, data and bots) and returns the final state hash.
export const SCENES = {
  "riverlands-x2-300": {
    about: "AI against AI, riverlands, 2 rivals, Fast, 300 s",
    async play(tree) {
      const { Simulation } = await import(tree.module("src/simulation.js"));
      const sim = new Simulation({ map: "riverlands", enemyCount: 2, aiSpeed: "fast", aiPlayer: true });
      for (let i = 0; i < 6000 && !sim.result; i++) { sim.tick(0.05); sim.events.length = 0; }
      return sim.hash();
    },
  },
  "crossroads-wave-120": {
    about: "Three Roads (d-crossroads), Standard, the DefenceBot, the first 120 s",
    async play(tree) {
      const { DEFENCE_LEVELS } = await import(tree.module("src/defence/levels.js"));
      const { playDefence } = await import(tree.module("tools/defence-bot.mjs"));
      return playDefence(DEFENCE_LEVELS.find((l) => l.id === "d-crossroads"), { difficulty: "standard", limit: 120 }).sim.hash();
    },
  },
};

// A tree: a src folder on disk, or a git ref extracted into .tmp/perf-ab/<commit>/ (once).
// `module(file)` gives the URL of one of its files ("src/simulation.js", "tools/defence-bot.mjs").
export function resolveTree(spec) {
  const dir = path.resolve(spec);
  if (fs.existsSync(path.join(dir, "simulation.js"))) return tree(path.dirname(dir), spec);
  const git = (...a) => execFileSync("git", ["-c", "safe.directory=*", ...a], { cwd: GAME, encoding: "utf8", maxBuffer: 1 << 28 });
  let commit;
  try { commit = git("rev-parse", "--verify", `${spec}^{commit}`).trim(); } catch { throw new Error(`--a/--b "${spec}": not a src folder and not a git ref`); }
  const root = path.join(GAME, ".tmp", "perf-ab", commit.slice(0, 12));
  if (!fs.existsSync(path.join(root, "src", "simulation.js"))) {
    // ls-tree paths are relative to the game folder; cat-file --batch streams every blob in one call.
    const files = git("ls-tree", "-r", "-z", commit, "--", "src", "tools").split("\0").filter(Boolean)
      .map((line) => { const [meta, file] = line.split("\t"); return { sha: meta.split(" ")[2], type: meta.split(" ")[1], file }; })
      .filter((f) => f.type === "blob");
    const out = spawnSync("git", ["-c", "safe.directory=*", "cat-file", "--batch"], { cwd: GAME, input: files.map((f) => f.sha).join("\n") + "\n", maxBuffer: 1 << 30 }).stdout;
    let at = 0;
    for (const f of files) {
      const eol = out.indexOf(10, at), size = Number(out.toString("utf8", at, eol).split(" ")[2]);
      const target = path.join(root, f.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, out.subarray(eol + 1, eol + 1 + size));
      at = eol + 1 + size + 1;
    }
  }
  return tree(root, `${spec} (${commit.slice(0, 8)})`);
}
// Two trees are two folders, so their modules load side by side as separate copies.
function tree(root, label) {
  return { label, root, module: (file) => pathToFileURL(path.join(root, file)).href };
}

// Wraps the tree's Simulation.prototype.tick so every call is timed into `sink`.
async function timeTicks(t) {
  const { Simulation } = await import(t.module("src/simulation.js"));
  const tick = Simulation.prototype.tick;
  if (!tick.timed) {
    const timed = function (dt) { const t0 = performance.now(); tick.call(this, dt); timed.sink?.push(performance.now() - t0); };
    timed.timed = true;
    Simulation.prototype.tick = timed;
  }
  return Simulation.prototype.tick;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
function stats(times) {
  const s = [...times].sort((a, b) => a - b), total = times.reduce((n, x) => n + x, 0);
  return { ticks: times.length, total, mean: total / times.length, p50: pct(s, 0.5), p95: pct(s, 0.95), p99: pct(s, 0.99) };
}

async function main() {
  const scene = SCENES[value("scene")];
  if (!value("a") || !value("b") || !scene) {
    console.error(`Usage: node tools/perf-ab.mjs --a <tree> --b <tree> --scene <${Object.keys(SCENES).join("|")}> [--runs 7] [--warmup 1] [--json]`);
    process.exit(2);
  }
  const runs = Math.max(1, +value("runs", 7)), warmup = Math.max(0, +value("warmup", 1));
  const sides = { A: resolveTree(value("a")), B: resolveTree(value("b")) };
  for (const side of Object.values(sides)) { side.tick = await timeTicks(side); side.runs = []; side.hashes = new Set(); }
  const once = async (side, keep) => {
    globalThis.gc?.();
    const sink = [];
    side.tick.sink = sink;
    const hash = await scene.play(side);
    side.tick.sink = null;
    side.hashes.add(hash);
    if (keep) side.runs.push(stats(sink));
  };
  for (let i = 0; i < warmup; i++) { await once(sides.A, false); await once(sides.B, false); }
  // ABBA: A first on even rounds, B first on odd ones, so a drift in machine load hits both alike.
  for (let i = 0; i < runs; i++) for (const k of i % 2 ? ["B", "A"] : ["A", "B"]) await once(sides[k], true);
  const summary = Object.fromEntries(Object.entries(sides).map(([k, side]) => [k, {
    tree: side.label, hash: [...side.hashes].join(" "), ticks: side.runs[0].ticks,
    ...Object.fromEntries(["mean", "p50", "p95", "p99", "total"].map((key) => [key, median(side.runs.map((r) => r[key]))])),
  }]));
  const delta = Object.fromEntries(["mean", "p50", "p95", "p99"].map((key) => [key, (summary.B[key] / summary.A[key] - 1) * 100]));
  const result = { scene: value("scene"), about: scene.about, runs, warmup, gc: !!globalThis.gc, A: summary.A, B: summary.B, deltaPercent: delta, sameHash: summary.A.hash === summary.B.hash };
  if (args.includes("--json")) { console.log(JSON.stringify(result, null, 2)); return; }
  const ms = (x) => x.toFixed(3).padStart(8);
  console.log(`${result.scene}: ${scene.about}. ${runs} interleaved runs per side (ABBA, ${warmup} warm-up each), median of the runs, ms per tick${result.gc ? ", GC before each run" : ""}.`);
  console.log(`      ${"mean".padStart(8)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"p99".padStart(8)}  ticks  run ms  tree`);
  for (const k of ["A", "B"]) { const s = summary[k]; console.log(`  ${k}   ${ms(s.mean)} ${ms(s.p50)} ${ms(s.p95)} ${ms(s.p99)}  ${String(s.ticks).padStart(5)} ${s.total.toFixed(0).padStart(7)}  ${s.tree}`); }
  console.log(`  B/A ${["mean", "p50", "p95", "p99"].map((key) => `${delta[key] >= 0 ? "+" : ""}${delta[key].toFixed(1)}%`.padStart(8)).join(" ")}`);
  console.log(result.sameHash ? `  Same final state on both sides (${summary.A.hash}).` : `  Final states differ: A ${summary.A.hash}, B ${summary.B.hash} (the trees do not play this scene alike).`);
  console.log("  Indicative on a shared machine; the integrator's quiet-machine re-run is the gate.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
