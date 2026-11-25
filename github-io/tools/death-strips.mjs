// Frame strips of unit deaths at the default phone camera (readable deaths, 2026-11-26): a small mixed fight on
// open ground, one unit of each kind killed (the same death event the rules send), the view stepped in fixed
// 0.05 s steps and the cropped frames saved to <out>/<label>/<viewport>/<case>/fNN.png. Join them with
// `python tools/fx-strip-montage.py <out> <viewport> <sheet dir>` (before row over after row).
// Usage: TEST_URL=http://127.0.0.1:4244/ node tools/death-strips.mjs <label> <phone|landscape|desktop> <out dir> [cases,comma]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [label, vp, out, only] = process.argv.slice(2);
const VIEWPORTS = { phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 }, desktop: { width: 1440, height: 900 } };
const viewport = VIEWPORTS[vp], mobile = vp !== "desktop", dt = 0.05, frames = 26;
if (!label || !viewport || !out) throw Error("Usage: node tools/death-strips.mjs <label> <phone|landscape|desktop> <out dir> [cases]");
// [case, victim type, victim team, air]
const CASES = [
  ["ranger-enemy", "ranger", 1, 0],
  ["ranger-own", "ranger", 0, 0],
  ["tank-enemy", "tank", 1, 0],
  ["walker-own", "walker", 0, 0],
  ["hawk-enemy", "hawk", 1, 1],
].filter(([name]) => !only || only.split(",").includes(name));
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__nativeRAF = raf;
    window.requestAnimationFrame = (cb) => raf((t) => { if (!window.__freezeFrames) cb(t); });
  });
  await page.goto(`${process.env.TEST_URL || "http://127.0.0.1:4244/"}?test=1`);
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
  await page.selectOption("#scenario", "riverlands");
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const f = window.__frontier;
    await f.view.preloadModels(["hawk", "walker", "tank", "ranger", "antitank"]);
    await f.view.fx.sprites.whenReady?.();
    window.__freezeFrames = true;
  });
  for (const [name, type, team, air] of CASES) {
    const info = await page.evaluate(({ type, team, air }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1);
      for (const d of v.dying.splice(0)) v.disposeEntity(d.object);
      v.fx.clear();
      let seed = 1482; v.fx.rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      s.entities = s.entities.filter((e) => e.kind !== "unit");
      const ox = 4, oz = -2;
      // A few soldiers and machines of both sides around the victim, as in a fight.
      const crowd = [["ranger", 0, -3, 1.5], ["antitank", 0, -2.5, -1.5], ["tank", 1, 3.5, 2], ["ranger", 1, 3, -1.8], ["ranger", 1, 2.2, 0.6], ["ranger", 0, -1.6, 0.2]];
      for (const [t, k, dx, dz] of crowd) s.spawn(t, k, ox + dx, oz + dz);
      const victim = s.spawn(type, team, ox, oz, !!air, !!air);
      v.resize(); f.cameraPan = null; f.select([]);
      v.focusOn(ox, oz);
      v.zoom = v.defaultZoom; v.updateCamera();
      for (let i = 0; i < 3; i++) v.update(s, 0.05, f.selected, null);
      return { air: !!air, id: victim.id, x: victim.x, z: victim.z, team, mechanical: !!victim.mechanical, angle: victim.angle };
    }, { type, team, air });
    const dir = path.join(out, label, vp, name);
    fs.mkdirSync(dir, { recursive: true });
    const box = await page.evaluate((info) => {
      const v = window.__frontier.view;
      const vec = new v.camera.position.constructor(info.x, info.air ? 2.5 : 1, info.z).project(v.camera), r = v.renderer.domElement.getBoundingClientRect();
      return { x: (vec.x * 0.5 + 0.5) * r.width + r.left, y: (-vec.y * 0.5 + 0.5) * r.height + r.top };
    }, info);
    const w = 180, h = 170;
    const clip = { x: Math.max(0, Math.round(box.x - w / 2)), y: Math.max(0, Math.round(box.y - h * 0.55)), width: w, height: h };
    for (let i = 0; i < frames; i++) {
      if (i === 2) await page.evaluate((info) => {
        // The rules' death event (progression.js), the unit already gone from the field.
        const f = window.__frontier, s = f.sim, v = f.view;
        s.entities = s.entities.filter((e) => e.id !== info.id);
        s.lookup?.delete?.(info.id);
        v.event({ type: "death", x: info.x, z: info.z, team: info.team, building: false, heavy: info.mechanical, core: false, seed: info.id, direction: info.angle + Math.PI }, s);
      }, info);
      await page.evaluate((dt) => { const f = window.__frontier; f.view.update(f.sim, dt, f.selected, null); }, dt);
      if (process.env.DEBUG && i < 6) console.log(i, await page.evaluate(() => { const v = window.__frontier.view; return JSON.stringify({ n: v.fx.smoke.items.length, cap: v.fx.particleCap, keep: [...v.fx.smoke.items, ...v.fx.glow.items].filter((p) => p.keep).map((p) => [p.cell, p.mode, +p.age.toFixed(2), +p.life.toFixed(2), +p.s0.toFixed(2), +p.s1.toFixed(2), p.c0[3], p.hold]) }); }));
      await page.evaluate(() => new Promise(window.__nativeRAF));
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(2, "0")}.png`), clip });
    }
    if (process.env.DEBUG) console.log(await page.evaluate(() => { const v = window.__frontier.view; return JSON.stringify({ spawned: v.deathCues?.spawned, keep: [...v.fx.smoke.items, ...v.fx.glow.items].filter((p) => p.keep).map((p) => [p.cell, p.mode, +p.age.toFixed(2), +p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)]) }); }));
    console.log(name, "ok", JSON.stringify(clip));
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 5));
} finally { await browser.close(); }
