// Before/after screenshot sets and frame timings for the first-impression and mission-look work
// (AAA round 2, W2-C). Usage:
//   node tools/look-shots.mjs --url http://127.0.0.1:4234/ --out docs/aaa/results/round2/w2c --tag after [--only title,battle] [--frames]
// Shots (3 viewports x 3 modes): title, battle (a skirmish on Riverlands) and defence (Gorge Road), each at
// 1440x900 (High), 390x844 and 844x390 (phones, Eco). Themes: four skirmish maps. Mission looks: m08 (night),
// m10 (storm) and m06 after 16:00 (storm), each on High (desktop) and Eco (phone). --frames also prints the
// median frame time (ms, GPU synced) of the title screen and of a 60-unit battle, for a SwiftShader A/B:
// run it with SOFTWARE_RENDER=1 (the numbers are only comparable on the same machine and load).
import fs from "node:fs";
import { launchBrowser } from "../tests/lib/harness.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const url = arg("url"), out = arg("out", "test-results/look-shots"), tag = arg("tag", "after");
const only = arg("only", "").split(",").filter(Boolean), frames = process.argv.includes("--frames");
if (!url) throw new Error("--url is required");
fs.mkdirSync(out, { recursive: true });
const VIEWS = [
  ["desktop", { width: 1440, height: 900 }, false, "high"],
  ["portrait", { width: 390, height: 844 }, true, "eco"],
  ["landscape", { width: 844, height: 390 }, true, "eco"],
];
const MAPS = ["riverlands", "highlands", "dunes", "basin"];
const wanted = (name) => !only.length || only.includes(name);
const browser = await launchBrowser();
const results = {};

async function open(view, quality, { init } = {}) {
  const [, size, touch] = view;
  const context = await browser.newContext({ viewport: size, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(([q, extra]) => {
    try { localStorage.setItem("frontier-command.settings.v1", JSON.stringify({ quality: q })); } catch {}
    if (extra) try { for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v); } catch {}
  }, [quality, init || null]);
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
  await page.waitForTimeout(700);
  return { page, context, errors };
}
const press = (page, touch, sel) => page.locator(sel).first()[touch ? "tap" : "click"]();
const shot = async (page, name) => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${tag}-${name}.png` }); };
// A frozen battle: both armies on the map, the whole map known.
async function stage(page, army = 40, zoom = 30) {
  await page.evaluate(([army, zoom]) => {
    const f = window.__frontier, s = f.sim, v = f.view;
    f.hold = true;
    s.visible[0].fill(1); s.explored[0].fill(1);
    const kinds = ["ranger", "vanguard", "tank", "breaker", "antitank"];
    for (let i = 0; i < army; i++) { const team = i % 2, row = Math.floor(i / 2); s.spawn(kinds[row % kinds.length], team, -8 + (row % 6) * 2, (team ? -1 : 1) * (6 + Math.floor(row / 6) * 2)); }
    v.focusOn(-3, 0); v.zoom = zoom; v.updateCamera();
  }, [army, zoom]);
}
const frameTime = (page) => page.evaluate(() => {
  const f = window.__frontier, v = f.view, gl = v.renderer.getContext(), px = new Uint8Array(4), times = [];
  for (let i = 0; i < 14; i++) {
    const t = performance.now();
    v.update(f.sim, 0, f.selected, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return +times[Math.floor(times.length / 2)].toFixed(1);
});

try {
  for (const view of VIEWS) {
    const [name, , touch, quality] = view;
    if (wanted("title")) {
      const { page, context, errors } = await open(view, quality);
      await shot(page, `title-${name}`);
      if (frames) (results.frames ||= {})[`title-${name}`] = await frameTime(page);
      if (errors.length) console.log("errors", name, errors);
      await context.close();
    }
    if (wanted("battle")) {
      const { page, context } = await open(view, quality);
      await press(page, touch, "#start");
      await page.waitForFunction(() => window.__frontier.started);
      await stage(page);
      await shot(page, `battle-${name}`);
      if (frames) (results.frames ||= {})[`battle-${name}`] = await frameTime(page);
      await context.close();
    }
    if (wanted("defence")) {
      const { page, context } = await open(view, quality);
      await press(page, touch, '[data-mode="defence"]');
      await press(page, touch, '[data-level-id="d-gorge"]');
      await press(page, touch, "#start");
      await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar"), null, { timeout: 30000 });
      await page.waitForTimeout(800);
      await shot(page, `defence-${name}`);
      await context.close();
    }
  }
  if (wanted("themes")) for (const map of MAPS) for (const view of [VIEWS[0], VIEWS[1]]) {
    const [name, , touch, quality] = view;
    const { page, context } = await open(view, quality);
    await page.selectOption("#scenario", map);
    await page.waitForFunction(() => !document.querySelector("#start").disabled);
    await press(page, touch, "#start");
    await page.waitForFunction(() => window.__frontier.started);
    await stage(page, 30, name === "desktop" ? 36 : 30);
    await shot(page, `theme-${map}-${name}`);
    await context.close();
  }
  // Story looks: the stage list opens each mission in turn, so every earlier mission is marked cleared.
  const { MISSIONS } = await import("../src/story/missions.js");
  const stories = [["m08", "m08-the-quiet-vault", 0], ["m10", "m10-obsidian-storm", 0], ["m06", "m06-copper-harvest", 975]];
  if (wanted("stories")) for (const [label, id, seconds] of stories) for (const view of [VIEWS[0], VIEWS[1]]) {
    const [name, , touch, quality] = view;
    const index = MISSIONS.findIndex((m) => m.id === id);
    const cleared = JSON.stringify({ cleared: Object.fromEntries(MISSIONS.slice(0, index).map((m, i) => [m.id, { time: 500 + i, medal: "silver" }])) });
    const { page, context } = await open(view, quality, { init: { "frontier-campaign-v2": cleared } });
    await press(page, touch, '[data-mode="campaign"]');
    await press(page, touch, "#start");
    await press(page, touch, "#mb-skip");
    await press(page, touch, "#mb-next");
    await page.waitForFunction(() => window.__frontier.started);
    await page.evaluate((seconds) => { const f = window.__frontier; f.hold = true; if (seconds) f.sim.time = seconds; f.sim.visible[0].fill(1); f.sim.explored[0].fill(1); }, seconds);
    await shot(page, `${label}-${seconds ? "storm-late" : id.includes("m08") ? "night" : "storm"}-${name}-${quality}`);
    results[`${label}-${name}`] = await page.evaluate(() => ({ look: window.__frontier.view.mood?.state ?? null, sky: window.__frontier.view.scene.background.getHexString() }));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
