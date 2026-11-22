// Frame strips of every weapon class (R3-FX): fires one shot per class on open ground, steps the effects in fixed time steps
// and saves the cropped frames to <out>/<label>/<viewport>/<class>/fNN.png (python tools/fx-strip-montage.py joins them).
// Usage: TEST_URL=http://127.0.0.1:4232/ node tools/fx-strips.mjs <label> <desktop|phone> <out dir> [classes,comma] [sprites=0|1]
// `sprites=0` keeps the procedural effects (?sprites=0), so the same script makes the "before" strips.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [label, vp, out, only, sprites = "1"] = process.argv.slice(2);
const mobile = vp === "phone", dt = 0.07, frames = 16;
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
// [class, shooter type, weapon key, shooter air, target type, target air, extra event fields, distance]
const CLASSES = [
  ["tracer", "ranger", "ranger", 0, "ranger", 0, {}, 12],
  ["shell", "tank", "tank", 0, "tank", 0, {}, 14],
  ["lob", "breaker", "breaker", 0, "tank", 0, {}, 18],
  ["flak", "tower", "tower", 0, "kite", 1, {}, 14],
  ["beam", "shade", "shade", 0, "tank", 0, {}, 12],
  ["rail", "watcher", "watcher", 0, "tank", 0, {}, 14],
  ["flamer", "scorcher", "scorcher", 0, "ranger", 0, {}, 5],
  ["heal", "ranger", "medic", 0, "ranger", 0, { type: "support" }, 5],
  ["rocket", "antitank", "antitank", 0, "tank", 0, {}, 14],
  ["missile", "hawk", "ranger", 1, "kite", 1, {}, 12],
  ["strafe", "hawk", "ranger", 1, "tank", 0, {}, 12],
  ["bomb", "glider", "ranger", 1, "tank", 0, {}, 8],
  ["firebomb", "balloon", "breaker", 1, "tank", 0, {}, 8],
  ["walker", "walker", "walker", 0, "tank", 0, {}, 14],
  ["strike", null, null, 0, "tank", 0, {}, 0],
].filter(([name]) => !only || only === "all" || only.split(",").includes(name));
try {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__nativeRAF = raf;
    window.requestAnimationFrame = (cb) => raf((t) => { if (!window.__freezeFrames) cb(t); });
  });
  await page.goto(`${process.env.TEST_URL || "http://127.0.0.1:4232/"}?test=1${sprites === "0" ? "&sprites=0" : ""}`);
  await page.waitForFunction(() => window.__frontier?.view.modelsReady, null, { timeout: 90000 });
  await page.selectOption("#scenario", "riverlands");
  await page.selectOption("#enemy-count", "1");
  await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 90000 });
  await page.evaluate(async (types) => {
    window.__freezeFrames = true;
    const f = window.__frontier;
    await f.view.preloadModels(types);
    f.restart();
    await f.view.fx.sprites.whenReady();
  }, ["hawk", "kite", "glider", "balloon", "walker", "watcher", "shade", "medic", "scorcher", "tower"]);
  // A clean frame: no HUD (the strips show the effects), reveal everything, no enemy AI.
  await page.addStyleTag({ content: "#hud,.hud,#bottom-bar,#dock,#top-bar,[class*='hud'],#minimap,#log{display:none!important}" });
  for (const [name, unit, weapon, sAir, targetType, tAir, extra, dist] of CLASSES) {
    // Fresh scene per class: units on open ground, camera on the middle of the shot.
    const info = await page.evaluate(({ unit, weapon, sAir, targetType, tAir, dist, mobile }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1);
      v.fx.clear();
      let seed = 1482; v.fx.rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      s.entities = s.entities.filter((e) => e.kind !== "unit");
      const ox = -8, oz = 0;
      const a = unit ? s.spawn(unit, 0, ox, oz, !!sAir, !!sAir) : null;
      const t = s.spawn(targetType, 1, ox + (dist || 10), oz, !!tAir, !!tAir);
      v.resize(); f.cameraPan = null; f.select([]);
      v.focusOn(ox + (dist || 10) / 2, oz);
      v.zoom = mobile ? 30 : 38; v.maxZoom = null; v.updateCamera();
      v.update(s, 0, f.selected, null);
      return { a: a && a.id, t: t.id, ax: a && a.x, az: a && a.z, tx: t.x, tz: t.z, aFly: a?.fly, tFly: t.fly };
    }, { unit, weapon, sAir, targetType, tAir, dist, mobile });
    const dir = path.join(out, label, vp, name);
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(({ unit, weapon, name, extra, info }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      if (name === "strike") { v.fx.strike({ x: info.tx, z: info.tz, team: 0, radius: 4 }); return; }
      const ev = { type: "shot", unit, weapon, source: info.a, target: info.t, x: info.ax, z: info.az, tx: info.tx, tz: info.tz, team: 0,
        ...(info.aFly != null ? { sAir: info.aFly } : null), ...(info.tFly != null ? { tAir: info.tFly } : null), ...extra };
      if (extra.type === "support") ev.type = "support";
      v.fx.shot(ev, s);
    }, { unit, weapon, name, extra, info });
    // Crop around the middle of the shot (CSS px).
    const box = await page.evaluate(({ info, mobile }) => {
      const v = window.__frontier.view;
      const mx = info.ax != null ? info.ax + (info.tx - info.ax) * 0.68 : info.tx, mz = info.az != null ? info.az + (info.tz - info.az) * 0.68 : info.tz;
      const vec = new v.camera.position.constructor(mx, 1, mz).project(v.camera), r = v.renderer.domElement.getBoundingClientRect();
      return { x: (vec.x * 0.5 + 0.5) * r.width + r.left, y: (-vec.y * 0.5 + 0.5) * r.height + r.top, mobile };
    }, { info, mobile });
    if (process.env.FULL) await page.screenshot({ path: path.join(out, "full-" + vp + "-" + name + ".png") });
    const w = mobile ? 200 : 360, h = mobile ? 170 : 240;
    const clip = { x: Math.max(0, Math.round(box.x - w / 2)), y: Math.max(0, Math.round(box.y - h * 0.55)), width: w, height: h };
    for (let i = 0; i < frames; i++) {
      await page.evaluate((dt) => { const f = window.__frontier; f.view.update(f.sim, dt, f.selected, null); }, i === 0 ? 0.001 : dt);
      await page.evaluate(() => new Promise(window.__nativeRAF));
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(2, "0")}.png`), clip });
    }
    console.log(name, "ok", JSON.stringify(clip));
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 5));
} finally { await browser.close(); }
