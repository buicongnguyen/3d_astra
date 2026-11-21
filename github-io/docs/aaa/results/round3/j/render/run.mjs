// R3-J review sheets: before/after close-ups of the rebuilt models, the luminance table, and the
// portrait atlas before/after with the runtime tint.
//   node docs/aaa/results/round3/j/render/run.mjs [contact] [lum] [atlas] [review name ...]   (from github-io)
// "Before" models are read from .tmp/before-models/ and the old atlas from .tmp/before-art/ (copy them from
// the base commit first); "after" from public/models/ and src/art/. Serves github-io on 127.0.0.1:${PORT||4235}.
// Renders with R3-F's look (docs/aaa/results/round3/f/render/sheet.html: riverlands grade, rim, reflections).
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../../../../../..'));
const OUT = join(ROOT, 'docs/aaa/results/round3/j');
const PORT = +(process.env.PORT || 4235);
const BEFORE = '/.tmp/before-models', AFTER = '/public/models';
const args = process.argv.slice(2);
const modes = new Set(args.length ? args.filter((a) => /^(contact|lum|atlas|review)$/.test(a)) : ['contact', 'lum', 'atlas']);
const reviewNames = args.filter((a) => !/^(contact|lum|atlas|review)$/.test(a));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };
const F = {
  meridian: { color: '#92ebc5', glow: '#92ebc5' }, ashfall: { color: '#ef7660', glow: '#ffb347' },
  sunward: { color: '#edc76f', glow: '#fff2a8' }, veil: { color: '#b397ee', glow: '#f0b3ff' }, wardens: { color: '#689dff', glow: '#c8f1ff' },
};
// The models R3-J changed, in their own colour (bosses fight as the hostile coral side).
const CHANGED = { drone: 'wardens', ironsovereign: 'ashfall', pylon: 'wardens', salvageyard: 'ashfall', waystation: 'sunward', workshop: 'meridian' };
const server = http.createServer(async (req, res) => {
  try {
    const file = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(ROOT)) throw new Error('outside');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.AUDIT_CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.setDefaultTimeout(120000);
const SHEET = `http://127.0.0.1:${PORT}/docs/aaa/results/round3/f/render/sheet.html`;
const open = async () => { await page.goto(SHEET); await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 }); };
await open();
const call = (fn, a) => page.evaluate(([f, x]) => window[f](x), [fn, a]);
const css = `body{margin:0;background:#f6efe2;font:13px/1.25 Arial,sans-serif;color:#2b2420}h1{font-size:20px;margin:10px 14px 2px}p.sub{margin:0 14px 8px;color:#6b5d50}
.grid{display:grid;gap:8px;padding:0 10px 10px}.card{background:#fffaf2;border:1px solid #e0d2bc;border-radius:8px;padding:6px}.card img{display:block;border-radius:4px}
.row{display:flex;gap:4px;align-items:flex-end}.name{font-weight:700;font-size:14px}.tag{font-size:11px;color:#6b5d50}`;
async function shoot(html, file, width) {
  await page.setViewportSize({ width, height: 400 });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: file, fullPage: true });
  await open();
  console.log('wrote', file);
}

try {
  await mkdir(OUT, { recursive: true });
  if (modes.has('review')) {
    for (const n of reviewNames) {
      const f = F[CHANGED[n] || 'meridian'];
      const tiles = [];
      for (const [base, yaw] of [[BEFORE, 0.6], [AFTER, 0.6], [AFTER, 2.6]]) tiles.push(await call('closeTile', { base, name: n, color: f.color, glow: f.glow, yaw, w: 360, h: 360 }));
      await shoot(`<div class="row">${tiles.map((t) => `<img src="${t.url}" width="360">`).join('')}</div>`, join(ROOT, `.tmp/review-${n}.png`), 1100);
    }
  }
  if (modes.has('contact')) {
    const cards = [];
    for (const [n, home] of Object.entries(CHANGED)) {
      const f = F[home];
      const before = await call('closeTile', { base: BEFORE, name: n, color: f.color, glow: f.glow, w: 260, h: 260 });
      const after = await call('closeTile', { base: AFTER, name: n, color: f.color, glow: f.glow, w: 260, h: 260 });
      const back = await call('closeTile', { base: AFTER, name: n, color: f.color, glow: f.glow, yaw: 2.7, w: 130, h: 130 });
      const mint = await call('closeTile', { base: AFTER, name: n, color: F.meridian.color, glow: F.meridian.glow, w: 130, h: 130 });
      cards.push(`<div class="card"><div class="row"><div><div class="tag">before</div><img src="${before.url}" width="260"></div><div><div class="tag">after</div><img src="${after.url}" width="260"></div>
        <div><div class="tag">after, back</div><img src="${back.url}" width="130"><div class="tag">after, mint player</div><img src="${mint.url}" width="130"></div></div><div class="name">${n}</div></div>`);
    }
    await shoot(`<h1>R3-J models: before / after</h1><p class="sub">Close-up 3/4 view in the game's look (riverlands grade, rim, room reflections), each in its own side's colour. Left: tag r3-wave-1m. Right: R3-J.</p><div class="grid" style="grid-template-columns:repeat(2,1fr)">${cards.join('')}</div>`, join(OUT, 'contact-models.png'), 1500);
  }
  if (modes.has('lum')) {
    const rows = [];
    for (const [n, home] of Object.entries(CHANGED)) {
      const f = F[home];
      const b = await call('closeTile', { base: BEFORE, name: n, color: f.color, glow: f.glow, w: 300, h: 300, stats: true });
      const a = await call('closeTile', { base: AFTER, name: n, color: f.color, glow: f.glow, w: 300, h: 300, stats: true });
      rows.push({ name: n, colour: home, before: b.stats, after: a.stats });
      console.log(n, JSON.stringify(b.stats), '->', JSON.stringify(a.stats));
    }
    await writeFile(join(OUT, 'luminance.json'), JSON.stringify(rows, null, 1) + '\n');
  }
  if (modes.has('atlas')) {
    // The runtime portrait CSS (src/portraits.css), with the order read from src/portraits.js for "after"
    // and the r3-wave-1m order (29 cells, 4 x 8) for "before".
    const order = JSON.parse((await readFile(join(ROOT, 'src/portraits.js'), 'utf8')).match(/PORTRAIT_ORDER = (\[[\s\S]*?\]);/)[1]);
    const old = order.slice(0, 29), rowsAfter = Math.ceil(order.length / 4);
    const tile = (src, mask, rows, i, name, tint) => `<div style="text-align:center;font:600 11px Arial"><i style="position:relative;display:block;width:96px;height:96px;margin:0 auto;isolation:isolate;background:url(${src}) no-repeat;background-size:400% ${rows * 100}%;background-position:calc(${i % 4} * 100% / 3) calc(${Math.floor(i / 4)} * 100% / ${rows - 1})"><i style="position:absolute;inset:0;background:${tint};mix-blend-mode:multiply;-webkit-mask:url(${mask}) no-repeat;-webkit-mask-size:400% ${rows * 100}%;-webkit-mask-position:calc(${i % 4} * 100% / 3) calc(${Math.floor(i / 4)} * 100% / ${rows - 1})"></i></i>${name}</div>`;
    const sheet = (label, src, mask, list, rows) => `<div style="background:#142330;color:#e9f2f0;padding:10px;border-radius:8px"><div class="name" style="margin-bottom:6px">${label}</div><div style="display:grid;grid-template-columns:repeat(8,100px);gap:8px">${list.map((n, i) => n ? tile(src, mask, rows, i, n, i % 2 ? F.ashfall.color : F.meridian.color) : '<div></div>').join('')}</div></div>`;
    const html = `<h1>R3-J portrait atlas: before / after</h1><p class="sub">Runtime CSS: atlas + team mask multiplied with the side colour (mint friendly, coral hostile, alternating). Before: 29 cells (4 x 8). After: ${order.length} cells (4 x ${rowsAfter}), every unit and building type; the last cell is reserved for R3-H's ironsovereign2 (same render as ironsovereign).</p>
      <div style="display:flex;flex-direction:column;gap:12px;padding:0 12px 12px">${sheet('before (r3-wave-1m)', `http://127.0.0.1:${PORT}/.tmp/before-art/portraits.webp`, `http://127.0.0.1:${PORT}/.tmp/before-art/portrait-mask.webp`, old, 8)}
      ${sheet('after (R3-J)', `http://127.0.0.1:${PORT}/src/art/portraits.webp`, `http://127.0.0.1:${PORT}/src/art/portrait-mask.webp`, order, rowsAfter)}</div>`;
    await page.setViewportSize({ width: 900, height: 400 });
    await page.setContent(`<style>${css}</style>${html}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, 'contact-portraits.png'), fullPage: true });
    console.log('wrote contact-portraits.png');
  }
} finally {
  await browser.close();
  server.close();
}
