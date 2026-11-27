// Builds the close-up detail models (H3b): one headless Blender process per kind (several generators change the
// shared kit palette when imported), then writes public/models/detail/manifest.json from the rows they print.
//   node tools/build-detail.mjs                 every kind the manifest lists
//   node tools/build-detail.mjs medic tank      just these (merged into the manifest)
//   --jobs 3                                    parallel Blender processes (default 3)
// FRONTIER_BLENDER=<path> overrides the Blender binary (default: the shared Blender 5.2.5 LTS in C:/tools/blender, see its
// README.txt); the version is checked either way.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import { compressModels } from "./compress-models.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const script = join(here, "blender", "generate_detail.py");
const manifestPath = join(app, "public", "models", "detail", "manifest.json");
const BLENDER = process.env.FRONTIER_BLENDER || "C:/tools/blender/blender-5.2.5-windows-x64/blender.exe";
const blenderVersion = (spawnSync(BLENDER, ["--version"], { encoding: "utf8" }).stdout ?? "").split(/\r?\n/)[0].trim();
if (!/^Blender 5\.2\.5\b/.test(blenderVersion)) {
  console.error(`Need Blender 5.2.5 LTS at ${BLENDER}, got "${blenderVersion}" (set FRONTIER_BLENDER to its blender.exe).`);
  process.exit(1);
}

const args = process.argv.slice(2);
let jobs = 3;
const kinds = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--jobs") jobs = Number(args[++i]) || 1;
  else kinds.push(args[i]);
}
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { assets: [] };
const todo = kinds.length ? kinds : manifest.assets.map((a) => a.name);

const rows = new Map(); // kind -> row built by this run
const failed = [];
function run(kind) {
  return new Promise((resolve) => {
    const child = spawn(BLENDER, ["--background", "--factory-startup", "--python", script, "--", kind], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => child.kill(), 10 * 60 * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      const line = out.split(/\r?\n/).find((l) => l.startsWith("DETAIL_ROW "));
      if (line && code === 0) {
        const row = JSON.parse(line.slice("DETAIL_ROW ".length));
        rows.set(kind, row);
        console.log(`${kind}: ${row.base_triangles} -> ${row.triangles} triangles (x${(row.triangles / row.base_triangles).toFixed(2)}), ${(row.bytes / 1024).toFixed(0)} KB`);
      } else {
        failed.push(kind);
        console.log(`${kind}: FAILED (exit ${code})\n${out.split(/\r?\n/).filter((l) => /Error|error|Traceback|File "/.test(l)).slice(-12).join("\n")}`);
      }
      resolve();
    });
  });
}
const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));

// Pack what Blender wrote (tools/compress-models.mjs: meshopt over 16-bit attributes); the manifest keeps the packed size.
await compressModels([...rows.keys()].map((kind) => join(app, "public", "models", "detail", `${kind}.glb`)), { log: () => {} });
for (const [kind, row] of rows) row.bytes = statSync(join(app, "public", "models", "detail", `${kind}.glb`)).size;

// Re-read before writing: another build may have finished in the meantime (rows merge by kind).
const latest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { assets: [] };
const merged = new Map(latest.assets.map((a) => [a.name, a]));
for (const [kind, row] of rows) merged.set(kind, row);
manifest.generator = "Blender Python (frontier_kit + generate_detail.py)";
manifest.units = "meters";
manifest.provenance = "Original assets generated for this repository; no third-party model sources.";
manifest.note = "Close-up detail models, loaded only by the close view (src/close-view.js). Build: node tools/build-detail.mjs";
manifest.assets = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
if (failed.length) { console.log(`failed: ${failed.join(", ")}`); process.exit(1); }
