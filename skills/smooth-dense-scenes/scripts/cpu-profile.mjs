#!/usr/bin/env node
// Where a frame's CPU time goes while playing: a DevTools CPU profile of a few seconds of play with the CPU slowed
// (4x ≈ mid phone, 8x ≈ old phone), printed as time per frame by source file, by function (self) and by function
// (total), plus --expand to split one function by what it calls. Needs no hooks; build the game without minifying
// (e.g. `vite build --minify false`) so the names mean something.
//
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   node cpu-profile.mjs http://127.0.0.1:5173/ [--viewport 390x844 --mobile] [--click "#start"] [--wait 4000]
//     [--setup "js to reach a busy spot"] [--cpu 8] [--secs 5] [--expand "update game.js:120"]
//
// Reading it: "(program)" is native work outside JS, mostly the cost of each WebGL call (state, uniforms,
// validation): it grows with draw calls, not triangles. projectObject / updateMatrixWorld grow with the number of
// visible objects in the scene graph (bones included). Compare runs at the same spot; repeat on a shared machine.
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const url = argv.find(a => !a.startsWith('--') && /^https?:/.test(a));
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
if (!url) { console.error('usage: cpu-profile.mjs <url> [--viewport WxH] [--mobile] [--click sel] [--wait ms] [--setup js] [--cpu n] [--secs n] [--expand "fn file:line"]'); process.exit(2); }
const pw = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright');
const [w, h] = String(opt('viewport', '390x844')).split('x').map(Number);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const ctx = await browser.newContext(opt('mobile') ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: w, height: h } });
const page = await ctx.newPage();
await page.goto(url);
if (opt('click')) await page.click(opt('click'));
if (opt('setup')) { await page.waitForTimeout(+opt('wait', 4000)); await page.evaluate(js => (0, eval)(js), opt('setup')); }
await page.waitForTimeout(+opt('wait', 4000));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt('cpu', 4) });
await page.waitForTimeout(1500);
await page.evaluate(() => { const m = window.__cpf = { gaps: [], last: 0 }; const f = t => { if (m.last) m.gaps.push(t - m.last); m.last = t; m.raf = requestAnimationFrame(f); }; m.raf = requestAnimationFrame(f); });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
await page.waitForTimeout(+opt('secs', 5) * 1000);
const { profile } = await cdp.send('Profiler.stop');
const gaps = await page.evaluate(() => { cancelAnimationFrame(window.__cpf.raf); return window.__cpf.gaps; });
const sorted = [...gaps].sort((a, b) => a - b), frames = gaps.length;
console.log(`CPU ${opt('cpu', 4)}x, ${frames} frames: frame time median ${sorted[frames >> 1].toFixed(1)} ms, p90 ${sorted[Math.floor(frames * 0.9)].toFixed(1)} ms`);
const dt = new Map(); profile.samples.forEach((s, i) => dt.set(s, (dt.get(s) || 0) + (profile.timeDeltas[i] || 0) / 1000));
const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const memo = new Map(); const tot = id => { if (memo.has(id)) return memo.get(id); let t = dt.get(id) || 0; for (const c of byId.get(id).children || []) t += tot(c); memo.set(id, t); return t; };
const file = n => (n.callFrame.url.split('/').pop() || `(${n.callFrame.functionName})`).replace(/-[\w-]{8}\.js$/, '.js');
const name = n => `${n.callFrame.functionName || '(anon)'} ${file(n)}:${n.callFrame.lineNumber + 1}`;
const self = new Map(), total = new Map(), files = new Map();
for (const n of profile.nodes) {
  const k = name(n), s = dt.get(n.id) || 0;
  self.set(k, (self.get(k) || 0) + s); files.set(file(n), (files.get(file(n)) || 0) + s);
  let p = parent.get(n.id), rec = false; while (p !== undefined) { if (name(byId.get(p)) === k) { rec = true; break; } p = parent.get(p); }
  if (!rec) total.set(k, (total.get(k) || 0) + tot(n.id));
}
const show = (m, n, label) => console.log(`${label} (ms per frame):\n` + [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${(v / frames).toFixed(2).padStart(6)}  ${k}`).join('\n'));
show(files, 10, 'self time by file');
show(self, 20, 'self time by function');
show(new Map([...total].filter(([k]) => !/^\((root|program|idle|garbage)/.test(k))), 25, 'total time by function');
if (opt('expand')) {
  const want = opt('expand'), kids = new Map();
  for (const n of profile.nodes) if (name(n) === want || name(n).endsWith(' ' + want)) for (const c of n.children || []) { const k = name(byId.get(c)); kids.set(k, (kids.get(k) || 0) + tot(c)); }
  show(kids, 20, `inside ${want}`);
}
await browser.close();
