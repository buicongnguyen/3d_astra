// Contact sheet of every faction's signature shots (V4, 2026-11-26): for each faction and each of its units, one shot on open
// ground (shooter and target spawned fresh, fog revealed, the frame loop held), the effects stepped in fixed 0.04 s steps and
// cropped around the shot, so a row shows the muzzle, the flight and the landing. Writes <out>/<label>/<viewport>/<faction>/<unit>/fNN.png;
// python tools/signature-sheet-montage.py joins them into one image per faction and viewport.
// Usage: TEST_URL=http://127.0.0.1:4614/ node tools/signature-sheet.mjs <out dir> <label> <desktop|phone> [factions,comma|all] [land]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [out = ".tmp/visual-round/sheet", label = "after", vp = "desktop", only = "all", land = "riverlands"] = process.argv.slice(2);
const mobile = vp === "phone", dt = 0.04, frames = 20;
// [unit, distance, shooter flies, target type, target flies, support]
const UNITS = {
  meridian: [["vanguard", 9], ["ranger", 12], ["gunner", 9], ["tank", 13], ["tower", 12], ["breaker", 16], ["antitank", 12], ["hawk", 10, 1]],
  ashfall: [["ranger", 12], ["scrapper", 7], ["tank", 13], ["rampart", 10], ["tower", 12], ["antitank", 12], ["scorcher", 6], ["balloon", 8, 1]],
  sunward: [["vanguard", 9], ["rider", 11], ["tank", 13], ["tower", 12], ["breaker", 16], ["antitank", 12], ["lancer", 9], ["wagon", 5, 0, "tank", 0, 1]],
  wardens: [["vanguard", 9], ["drone", 11], ["bulwark", 10], ["walker", 13], ["tower", 12], ["breaker", 16], ["antitank", 12], ["halo", 11, 1]],
  veil: [["ranger", 12], ["shade", 8], ["watcher", 13], ["stalker", 16], ["tank", 13], ["tower", 12], ["breaker", 16], ["moth", 9, 1]],
};
const factions = only === "all" ? Object.keys(UNITS) : only.split(",");
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__nativeRAF = raf;
    window.requestAnimationFrame = (cb) => raf((t) => { if (!window.__freezeFrames) cb(t); });
  });
  await page.goto(`${process.env.TEST_URL || "http://127.0.0.1:4614/"}?test=1`, { timeout: 120000 });
  await page.waitForFunction(() => window.__frontier?.view.modelsReady, null, { timeout: 120000 });
  await page.selectOption("#scenario", land).catch(() => {});
  await page.selectOption("#enemy-count", "1").catch(() => {});
  await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
  const types = [...new Set(Object.values(UNITS).flat().map(([u]) => u).concat(["tank", "ranger", "kite"]))];
  await page.evaluate(async (types) => {
    window.__freezeFrames = true;
    const f = window.__frontier;
    await f.view.preloadModels(types);
    f.restart();
    await f.view.fx.sprites.whenReady();
  }, types);
  await page.addStyleTag({ content: "#hud,.hud,#bottom-bar,#dock,#top-bar,[class*='hud'],#minimap,#log,#notice,.notice,#fight-hint{display:none!important}" });
  for (const faction of factions) {
    for (const [unit, dist, sAir = 0, targetType = "tank", tAir = 0, support = 0] of UNITS[faction]) {
      const info = await page.evaluate(({ faction, unit, dist, sAir, targetType, tAir, support, mobile }) => {
        const f = window.__frontier, s = f.sim, v = f.view;
        s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1);
        s.factions[0] = faction; s.factions[1] = faction === "meridian" ? "ashfall" : "meridian";
        v.fx.clear();
        let seed = 1482; v.fx.rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        s.entities = s.entities.filter((e) => e.kind !== "unit" && !(e.type === "tower" && Math.hypot(e.x + 8, e.z) < 4));
        const ox = -8, oz = 0;
        const a = s.spawn(unit, 0, ox, oz, true, true);
        if (sAir && a.fly == null) a.fly = 3.6;
        const t = s.spawn(targetType, support ? 0 : 1, ox + dist, oz, true, true);
        // Ten idle onlookers on screen (out of the crop), so the effects' particle cap is a small real fight's, not a duel's.
        for (let i = 0; i < 10; i++) s.spawn("ranger", 0, ox - 14 + (i % 5) * 2, oz + (i < 5 ? -9 : 9), true, true);
        if (support) t.hp = t.maxHp * 0.5;
        v.resize(); f.select([]);
        v.focusOn(ox + dist / 2, oz); v.zoom = mobile ? 30 : 38; v.updateCamera();
        v.update(s, 0, f.selected, null);
        return { a: a.id, t: t.id, ax: a.x, az: a.z, tx: t.x, tz: t.z, aFly: a.flying ? a.fly : null, tFly: t.flying ? t.fly : null };
      }, { faction, unit, dist, sAir, targetType, tAir, support, mobile });
      const dir = path.join(out, label, vp, faction, unit);
      fs.mkdirSync(dir, { recursive: true });
      await page.evaluate(({ unit, info, support }) => {
        const f = window.__frontier, s = f.sim, v = f.view, shooter = s.get(info.a);
        const weapon = support ? unit : shooter.shot || unit;
        const ev = { type: support ? "support" : "shot", unit, weapon, source: info.a, target: info.t, x: info.ax, z: info.az, tx: info.tx, tz: info.tz, team: 0,
          ...(info.aFly != null ? { sAir: info.aFly } : null), ...(info.tFly != null ? { tAir: info.tFly } : null) };
        v.event(ev, s);
      }, { unit, info, support });
      const box = await page.evaluate(({ info }) => {
        const v = window.__frontier.view, mx = info.ax + (info.tx - info.ax) * 0.55, mz = info.az;
        const vec = new v.camera.position.constructor(mx, 1, mz).project(v.camera), r = v.renderer.domElement.getBoundingClientRect();
        return { x: (vec.x * 0.5 + 0.5) * r.width + r.left, y: (-vec.y * 0.5 + 0.5) * r.height + r.top };
      }, { info });
      const w = mobile ? 230 : 420, h = mobile ? 120 : 190;
      const clip = { x: Math.max(0, Math.round(box.x - w / 2)), y: Math.max(0, Math.round(box.y - h * 0.62)), width: w, height: h };
      for (let i = 0; i < frames; i++) {
        await page.evaluate((dt) => { const f = window.__frontier; f.view.update(f.sim, dt, f.selected, null); }, i === 0 ? 0.001 : dt);
        await page.evaluate(() => new Promise(window.__nativeRAF));
        await page.screenshot({ path: path.join(dir, `f${String(i).padStart(2, "0")}.png`), clip });
      }
    }
    console.log(faction, vp, "ok");
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 5));
} finally { await browser.close(); }
