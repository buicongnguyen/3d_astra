#!/usr/bin/env node
/**
 * Measures draw calls, instanced draws, triangles and frame times of any WebGL page,
 * without hooks in the game: it wraps the WebGL draw functions before the page loads.
 *
 *   node render-probe.mjs <url> [--viewport 390x844] [--mobile] [--throttle 4]
 *        [--click "#start-button"] [--wait 4000] [--frames 120] [--eval "js run before measuring"]
 *        [--screenshot out.png] [--json]
 *
 * Playwright comes from PLAYWRIGHT_MODULE (a path or file:// URL to playwright's index.mjs),
 * else from the project in the current folder, else from a global `playwright` install.
 * It also reports each WebGL canvas's size in megapixels and whether antialiasing (MSAA)
 * is on: on phones, the pixels drawn often matter more than the triangles.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) ?? args[0];
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = name => args.includes(`--${name}`);
if (!url || url.startsWith('--')) { console.error('Usage: node render-probe.mjs <url> [--viewport WxH] [--mobile] [--throttle N] [--click selector] [--wait ms] [--frames N] [--eval js] [--screenshot file] [--json]'); process.exit(2); }

async function loadPlaywright() {
  const given = process.env.PLAYWRIGHT_MODULE;
  if (given) return import(given.startsWith('file:') ? given : pathToFileURL(given).href);
  try { return await import(pathToFileURL(createRequire(path.join(process.cwd(), 'package.json')).resolve('playwright')).href); }
  catch { return import('playwright'); }
}
// A CommonJS entry puts its exports under `default`.
const playwright = await loadPlaywright(), chromium = playwright.chromium ?? playwright.default?.chromium;
const [width, height] = option('viewport', '1440x900').split('x').map(Number);
const mobile = flag('mobile'), frames = Number(option('frames', '120'));

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await context.addInitScript(() => {
  const probe = { frames: [], current: { calls: 0, instanced: 0, triangles: 0 }, last: 0 };
  const wrap = proto => {
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = proto[name]; if (!original) continue;
      proto[name] = function (...a) {
        const c = probe.current, instanced = name.endsWith('Instanced'), arrays = name.startsWith('drawArrays');
        const count = arrays ? a[2] : a[1], copies = instanced ? (arrays ? a[3] : a[4]) : 1;
        c.calls++; if (instanced) c.instanced++; if (a[0] === 4) c.triangles += count / 3 * copies;
        return original.apply(this, a);
      };
    }
  };
  // Remember every WebGL context, to report its drawing-buffer size and antialiasing.
  const getContext = HTMLCanvasElement.prototype.getContext, contexts = probe.contexts = [];
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) { const ctx = getContext.call(this, type, ...rest); if (ctx && /webgl/.test(type) && !contexts.includes(ctx)) contexts.push(ctx); return ctx; };
  if (window.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype);
  if (window.WebGLRenderingContext) wrap(WebGLRenderingContext.prototype);
  const tick = now => {
    if (probe.last && probe.current.calls) probe.frames.push({ ms: now - probe.last, ...probe.current });
    probe.current = { calls: 0, instanced: 0, triangles: 0 }; probe.last = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__renderProbe = probe;
});
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
if (option('click')) await page.locator(option('click')).first().click().catch(e => errors.push(`click: ${e.message}`));
await page.waitForTimeout(Number(option('wait', '3000')));
if (option('eval')) await page.evaluate(option('eval')).catch(e => errors.push(`eval: ${e.message}`));
if (option('throttle')) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(option('throttle')) }); }
await page.evaluate(() => { window.__renderProbe.frames = []; });
await page.waitForFunction(n => window.__renderProbe.frames.length >= n, frames, { timeout: 120000 });
const samples = await page.evaluate(() => window.__renderProbe.frames);
const canvases = await page.evaluate(() => window.__renderProbe.contexts.filter(c => !c.isContextLost()).map(c => ({ size: `${c.drawingBufferWidth}x${c.drawingBufferHeight}`, megapixels: +(c.drawingBufferWidth * c.drawingBufferHeight / 1e6).toFixed(2), msaa: !!c.getContextAttributes()?.antialias, gpu: (() => { const info = c.getExtension('WEBGL_debug_renderer_info'); return info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() })));
if (option('screenshot')) await page.screenshot({ path: option('screenshot') });
await browser.close();

const sorted = key => samples.map(s => s[key]).sort((a, b) => a - b);
const at = (list, q) => list[Math.min(list.length - 1, Math.floor(list.length * q))];
const summary = {};
for (const key of ['calls', 'instanced', 'triangles', 'ms']) { const list = sorted(key); summary[key] = { median: +at(list, .5).toFixed(1), p95: +at(list, .95).toFixed(1), max: +list[list.length - 1].toFixed(1) }; }
summary.frames = samples.length; summary.longFrames = samples.filter(s => s.ms > 33.4).length; summary.viewport = `${width}x${height}${mobile ? ' mobile' : ''}${option('throttle') ? ` cpu÷${option('throttle')}` : ''}`;
summary.canvases = canvases;
if (flag('json')) console.log(JSON.stringify({ summary, errors }, null, 2));
else {
  console.log(`${url} · ${summary.viewport} · ${summary.frames} frames`);
  console.table({ 'draw calls': summary.calls, 'instanced draws': summary.instanced, triangles: summary.triangles, 'frame ms': summary.ms });
  console.log(`frames over 33 ms: ${summary.longFrames}`);
  for (const c of canvases) console.log(`canvas ${c.size} = ${c.megapixels} MP, antialiasing ${c.msaa ? 'on' : 'off'}`);
  // Headless browsers may silently fall back to a software renderer; its frame times mean nothing.
  for (const c of canvases) { console.log(`gpu: ${c.gpu}`); if (/swiftshader|llvmpipe|software/i.test(c.gpu)) console.log('WARNING: software rendering: draw-call and triangle counts are valid, frame times are not.'); }
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
}
