// Interleaved A/B frame cost of the effects in a big phone fight (V4 signature shots, 2026-11-26). Two builds of the game are
// served side by side (A = before, B = after); each run loads one build, stages the same 300-unit fight on a 390x844 touch
// phone (Eco unless `high`), holds the frame loop and steps the fight by hand in fixed 0.05 s ticks, timing every view update
// (the effects, the batches and the render submit, closed by gl.finish so the GPU work is inside the sample). Runs go A B B A
// A B B A ...; the null control is A against A (the first A runs against the later ones), the spread a change must beat.
// Timings on a shared machine are indicative; the draws are exact.
// Usage: node tools/signature-ab.mjs <A url> <B url> [runs=8] [eco|high] [factions: "meridian" | "wardens,ashfall" ...]
import { chromium } from "playwright";

const [A, B, runsArg = "8", quality = "eco", factionArg = "meridian"] = process.argv.slice(2);
const runs = Number(runsArg), [f0, f1 = f0] = factionArg.split(",");
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
async function run(url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  try {
    await page.goto(url + "?test=1", { timeout: 120000 });
    await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
    await page.locator('[data-mode="skirmish"]').click();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 120000 });
    return await page.evaluate(async ({ quality, f0, f1 }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      f.hold = true;
      v.applySettings({ ...v.settings, quality });
      s.aiEnabled = false;
      s.factions[0] = f0; s.factions[1] = f1;
      const types = ["ranger", "tank", "vanguard", "breaker", "antitank"];
      await v.preloadModels([...new Set([0, 1].flatMap((team) => types.map((t) => s.typeFor(team, t))))]);
      await v.fx.sprites.whenReady?.();
      for (let i = 0; i < 300; i++) {
        const team = i % 2, row = Math.floor(i / 2);
        // Two blocks of ranks 5 m apart, attack-moving into each other: a fight with many shots in flight at once.
        const x = -12 + row % 15 * 1.7, z = (team ? -1 : 1) * (2.5 + Math.floor(row / 15) * 1.35);
        const e = s.spawn(types[row % types.length], team, x, z);
        s.issue([e.id], { type: "attackmove", x, z: -z });
      }
      s.visible[0].fill(1); s.explored[0].fill(1);
      f.select([]);
      v.focusOn(0, 0); v.zoom = v.defaultZoom; v.updateCamera();
      const gl = v.renderer.getContext(), times = [], draws = [], live = [];
      let shots = 0;
      for (let i = 0; i < 180; i++) {
        s.tick(0.05);
        for (const ev of s.events.splice(0)) { if (ev.type === "shot") shots++; v.event(ev, s); }
        const t0 = performance.now();
        v.update(s, 0.05, f.selected, null);
        gl.finish();
        const t = performance.now() - t0;
        if (i >= 20) { times.push(t); draws.push(v.renderer.info.render.calls); live.push(v.fx.active); }
        if (i % 20 === 19) await new Promise(requestAnimationFrame);
      }
      const sorted = (l) => l.slice().sort((a, b) => a - b), pct = (l, q) => sorted(l)[Math.min(l.length - 1, Math.floor(l.length * q))];
      return { mean: times.reduce((a, b) => a + b, 0) / times.length, p50: pct(times, 0.5), p95: pct(times, 0.95), draws50: pct(draws, 0.5), draws95: pct(draws, 0.95), shots,
        live50: pct(live, 0.5), live95: pct(live, 0.95), eco: v.lowPower };
    }, { quality, f0, f1 });
  } finally { await page.close(); }
}
const results = { A: [], B: [] };
const order = [];
for (let i = 0; i < runs; i++) order.push(i % 4 === 0 || i % 4 === 3 ? "A" : "B");
try {
  await run(A); await run(B); // warm-up: caches, shaders, models
  for (const which of order) {
    const r = await run(which === "A" ? A : B);
    results[which].push(r);
    console.log(which, JSON.stringify(r));
  }
} finally { await browser.close(); }
const med = (l) => { const s = l.slice().sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const sum = (list, k) => med(list.map((r) => r[k]));
const half = Math.floor(results.A.length / 2), A1 = results.A.slice(0, half), A2 = results.A.slice(half);
const row = (name, list) => ({ name, runs: list.length, meanMs: +sum(list, "mean").toFixed(2), p50Ms: +sum(list, "p50").toFixed(2), p95Ms: +sum(list, "p95").toFixed(2), draws50: sum(list, "draws50"), draws95: sum(list, "draws95"), shots: sum(list, "shots"), live50: sum(list, "live50"), live95: sum(list, "live95") });
const table = [row("A (before)", results.A), row("B (after)", results.B), row("A first half", A1), row("A second half", A2)];
console.table(table);
const pct = (b, a) => ((b / a - 1) * 100).toFixed(1) + "%";
console.log(JSON.stringify({ quality, factions: factionArg, nullControl: { mean: pct(table[3].meanMs, table[2].meanMs), p95: pct(table[3].p95Ms, table[2].p95Ms) },
  afterVsBefore: { mean: pct(table[1].meanMs, table[0].meanMs), p95: pct(table[1].p95Ms, table[0].p95Ms), draws50: table[1].draws50 - table[0].draws50, draws95: table[1].draws95 - table[0].draws95 } }));
