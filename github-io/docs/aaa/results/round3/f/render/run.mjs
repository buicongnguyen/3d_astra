// R3-F review sheets: before/after contact sheets, phone-zoom pair, 24 px infantry thumbnails and the
// armour/team luminance table.
//   node docs/aaa/results/round3/f/render/run.mjs [contact] [phone] [thumbs] [lum]   (from github-io)
// "Before" models are read from .tmp/before-models/ (copy public/models/*.glb + manifest.json there from
// the base commit first); "after" from public/models/. Serves github-io on 127.0.0.1:${PORT||4237}.
// Set AUDIT_CHROME=<chrome path> if Playwright's own Chromium is missing.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../../../../../..'));
const OUT = join(ROOT, 'docs/aaa/results/round3/f');
const PORT = +(process.env.PORT || 4237);
const BEFORE = '/.tmp/before-models', AFTER = '/public/models';
const modes = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['contact', 'phone', 'thumbs', 'lum']);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css' };

// src/settings.js PRESETS + src/story/world.js faction colour and glow (as in the round-2 audit).
const F = {
  meridian: { color: '#92ebc5', glow: '#92ebc5' }, ashfall: { color: '#ef7660', glow: '#ffb347' },
  sunward: { color: '#edc76f', glow: '#fff2a8' }, veil: { color: '#b397ee', glow: '#f0b3ff' }, wardens: { color: '#689dff', glow: '#c8f1ff' },
};
const CORE = ['worker', 'vanguard', 'ranger', 'medic', 'engineer', 'antitank', 'breaker', 'tank', 'hq', 'barracks', 'foundry', 'relay', 'tower'];
const FACTION = { scrapper: 'ashfall', scorcher: 'ashfall', salvageyard: 'ashfall', rider: 'sunward', wagon: 'sunward', waystation: 'sunward',
  walker: 'wardens', pylon: 'wardens', shade: 'veil', watcher: 'veil', veilrelay: 'veil' };
const OTHER = { gunner: 'meridian', workshop: 'meridian', stalker: 'veil', rampart: 'ashfall', carrier: 'ashfall', kite: 'meridian', hawk: 'meridian', balloon: 'ashfall', glider: 'sunward' };
const home = (n) => FACTION[n] || OTHER[n] || 'meridian';

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
await page.goto(`http://127.0.0.1:${PORT}/docs/aaa/results/round3/f/render/sheet.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const call = (fn, args) => page.evaluate(([f, a]) => window[f](a), [fn, args]);
const css = `body{margin:0;background:#f6efe2;font:13px/1.25 Arial,sans-serif;color:#2b2420}h1{font-size:20px;margin:10px 14px 2px}p.sub{margin:0 14px 8px;color:#6b5d50}
.grid{display:grid;gap:8px;padding:0 10px 10px}.card{background:#fffaf2;border:1px solid #e0d2bc;border-radius:8px;padding:6px}.card img{display:block;border-radius:4px}
.row{display:flex;gap:4px;align-items:flex-end}.name{font-weight:700;font-size:14px}.tag{font-size:11px;color:#6b5d50}`;
async function shoot(html, file, width) {
  await page.setViewportSize({ width, height: 400 });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: join(OUT, file), fullPage: true });
  await page.goto(`http://127.0.0.1:${PORT}/docs/aaa/results/round3/f/render/sheet.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  console.log('wrote', file);
}
// Deterministic shuffle (mulberry32) so the thumbnail order is fixed but not grouped by type.
function shuffled(list, seed) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

try {
  await mkdir(OUT, { recursive: true });
  if (modes.has('contact')) {
    const groups = [['contact-core', 'Core roster (team colour: Meridian mint)', CORE], ['contact-faction', 'Faction models in their own colour (Drone excluded: R3-J)', Object.keys(FACTION)],
      ['contact-other', 'Workshop units, carrier and flyers (palette only)', Object.keys(OTHER)]];
    for (const [file, title, names] of groups) {
      const cards = [];
      for (const n of names) {
        const f = F[home(n)];
        const before = await call('closeTile', { base: BEFORE, name: n, color: f.color, glow: f.glow, w: 220, h: 220 });
        const after = await call('closeTile', { base: AFTER, name: n, color: f.color, glow: f.glow, w: 220, h: 220 });
        const alt = n in FACTION ? await call('closeTile', { base: AFTER, name: n, color: F.meridian.color, glow: F.meridian.glow, w: 108, h: 108 }) : null;
        cards.push(`<div class="card"><div class="row"><div><div class="tag">before</div><img src="${before.url}" width="220"></div><div><div class="tag">after</div><img src="${after.url}" width="220"></div>
          ${alt ? `<div><div class="tag">after, mint player</div><img src="${alt.url}" width="108"></div>` : ''}</div><div class="name">${n}</div></div>`);
      }
      await shoot(`<h1>R3-F ${title}</h1><p class="sub">Close-up 3/4 view in the game's look (riverlands grade, rim, room reflections). Left: base r3-base. Right: R3-F warm kit.</p><div class="grid" style="grid-template-columns:repeat(${names.length > 9 ? 3 : 3},1fr)">${cards.join('')}</div>`, `${file}.png`, 1500);
    }
  }
  if (modes.has('phone')) {
    const R = [0.8638, 0, -0.5038], D = [-0.5038, 0, -0.8638];
    const place = (u, v) => ({ x: R[0] * u + D[0] * v, z: R[2] * u + D[2] * v });
    const names = ['worker', 'ranger', 'medic', 'engineer', 'vanguard', 'antitank', 'breaker', 'tank', 'scrapper', 'scorcher', 'rider', 'wagon', 'walker', 'shade', 'watcher', 'gunner'];
    const html = [];
    for (const [label, base] of [['before', BEFORE], ['after', AFTER]]) {
      const items = names.map((n, i) => ({ base, name: n, color: F[home(n)].color, glow: F[home(n)].glow, yaw: 0.9, ...place((i % 4 - 1.5) * 4.2, 15 - Math.floor(i / 4) * 8.5) }));
      const r = await call('gameScene', { items });
      const labels = r.labels.map((l) => `<div style="position:absolute;left:${l.x - 45}px;top:${l.y + 4}px;width:90px;text-align:center;font:600 10px/1.1 Arial;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000">${l.name}</div>`).join('');
      html.push(`<div><div class="name" style="margin:4px 0">${label}</div><div style="position:relative;width:390px;height:844px"><img src="${r.url}" width="390" height="844">${labels}</div></div>`);
    }
    await shoot(`<h1>R3-F at real phone zoom</h1><p class="sub">390x844, ratio 1.6, zoom 38, game camera; core infantry in Meridian mint, faction models in their own colour.</p><div style="display:flex;gap:14px;padding:0 12px 12px">${html.join('')}</div>`, 'phone-before-after.png', 840);
  }
  if (modes.has('thumbs')) {
    // Six shared infantry x three team colours, shuffled; no names on the sheet (key in thumbs-key.json).
    const INF = ['worker', 'ranger', 'medic', 'engineer', 'vanguard', 'antitank'];
    const tiles = shuffled(INF.flatMap((n) => ['meridian', 'ashfall', 'wardens'].map((c) => ({ n, c }))), 20261121);
    const key = {};
    for (const [label, base] of [['before', BEFORE], ['after', AFTER]]) {
      const cells = [];
      for (const [i, t] of tiles.entries()) {
        const r = await call('thumbTile', { base, name: t.n, color: F[t.c].color, glow: F[t.c].glow, size: 24 });
        key[i + 1] = t.n;
        cells.push(`<div style="text-align:center;font:700 12px Arial"><div>${i + 1}</div><img src="${r.url}" width="24" height="24" style="display:block;margin:2px auto"><img src="${r.url}" width="96" height="96" style="image-rendering:pixelated;display:block"></div>`);
      }
      await shoot(`<div style="padding:10px;font:13px Arial">Each tile: a unit at 24 x 24 px (top: actual size; below: the same 24 px image enlarged 4x, nearest-neighbour).</div><div style="display:grid;grid-template-columns:repeat(6,104px);gap:10px;padding:10px">${cells.join('')}</div>`, `thumbs-${label}.png`, 720);
    }
    await writeFile(join(OUT, 'render/thumbs-key.json'), JSON.stringify(key, null, 1) + '\n');
  }
  if (modes.has('lum')) {
    const names = [...CORE, ...Object.keys(FACTION), ...Object.keys(OTHER)];
    const rows = [];
    for (const n of names) {
      const f = F[home(n)];
      const b = await call('closeTile', { base: BEFORE, name: n, color: f.color, glow: f.glow, w: 300, h: 300, stats: true });
      const a = await call('closeTile', { base: AFTER, name: n, color: f.color, glow: f.glow, w: 300, h: 300, stats: true });
      rows.push({ name: n, group: CORE.includes(n) ? 'core' : n in FACTION ? 'faction' : 'other', colour: home(n), before: b.stats, after: a.stats });
      console.log(n, JSON.stringify(b.stats.body), '->', JSON.stringify(a.stats.body), 'team', b.stats.team.Y, '->', a.stats.team.Y);
    }
    await writeFile(join(OUT, 'luminance.json'), JSON.stringify(rows, null, 1) + '\n');
  }
} finally {
  await browser.close();
  server.close();
}
