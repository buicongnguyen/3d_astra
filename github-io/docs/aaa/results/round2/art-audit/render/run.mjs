// Frontier Command art audit: renders every manifest model into three contact sheets.
// node docs/aaa/results/round2/art-audit/render/run.mjs  (from github-io; AUDIT_CHROME=<chrome path> if Playwright's own browser is missing)   (serves github-io on 127.0.0.1:4238 while it runs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { serve, open, ROOT } from './serve.mjs';

const OUT = `${ROOT}/docs/aaa/results/round2/art-audit`;
mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(readFileSync(`${ROOT}/public/models/manifest.json`, 'utf8')).assets;
const portraitOrder = readFileSync(`${ROOT}/src/portraits.js`, 'utf8').match(/PORTRAIT_ORDER = (\[[\s\S]*?\]);/)[1];
const PORTRAITS = new Set(JSON.parse(portraitOrder));

// src/settings.js PRESETS + src/story/world.js faction colour and glow.
const F = {
  meridian: { color: '#92ebc5', glow: '#92ebc5', label: 'Meridian (mint)' },
  ashfall: { color: '#ef7660', glow: '#ffb347', label: 'Ashfall (coral)' },
  sunward: { color: '#edc76f', glow: '#fff2a8', label: 'Sunward (gold)' },
  veil: { color: '#b397ee', glow: '#f0b3ff', label: 'Veil (violet)' },
  wardens: { color: '#689dff', glow: '#c8f1ff', label: 'Wardens (blue)' },
};
// Budgets: manifest where present; the 13 core models have none, so the STAGE_2_FACTIONS.md bands are used (marked *).
const IMPLIED = { worker: 3200, vanguard: 3200, ranger: 3200, medic: 3200, engineer: 3200, antitank: 3200, breaker: 4500, tank: 6300,
  hq: 4000, barracks: 4000, foundry: 4000, relay: 4000, tower: 4000 };
const CORE = Object.keys(IMPLIED);
const owner = { scrapper: 'ashfall', scorcher: 'ashfall', salvageyard: 'ashfall', rider: 'sunward', wagon: 'sunward', waystation: 'sunward',
  drone: 'wardens', walker: 'wardens', pylon: 'wardens', shade: 'veil', watcher: 'veil', veilrelay: 'veil', hawk: 'meridian', balloon: 'ashfall',
  glider: 'sunward', gunner: 'meridian', workshop: 'meridian', stalker: 'veil', rampart: 'ashfall' };
function coloursFor(name) {
  if (CORE.includes(name)) return ['meridian', 'ashfall', 'wardens'];
  if (name === 'kite') return ['meridian', 'ashfall', 'veil'];
  if (['ironvanguard', 'ironsovereign', 'carrier'].includes(name)) return ['ashfall', 'wardens'];
  return [owner[name], owner[name] === 'meridian' ? 'ashfall' : 'meridian'];
}
const CORE_BUILDINGS = ['hq', 'barracks', 'foundry', 'relay', 'tower'];
const assets = manifest.map((a) => ({ ...a, kind: a.kind || (CORE_BUILDINGS.includes(a.name) ? 'building' : CORE.includes(a.name) ? 'unit' : a.kind), budget: a.budget || IMPLIED[a.name], implied: !a.budget, boss: !!a.boss,
  group: CORE.includes(a.name) ? 'core' : a.faction ? 'faction' : a.air ? 'air' : 'round2', home: owner[a.name] || (CORE.includes(a.name) ? 'shared' : a.boss ? 'boss' : 'shared') }));
writeFileSync(`${ROOT}/.tmp/audit/assets.json`, JSON.stringify(assets, null, 1));

const server = await serve();
const { browser, page } = await open();
const css = `body{margin:0;background:#f6efe2;font:13px/1.25 "Segoe UI",Arial,sans-serif;color:#2b2420}
h1{font-size:20px;margin:10px 14px 2px}p.sub{margin:0 14px 8px;color:#6b5d50}
.grid{display:grid;gap:8px;padding:0 10px 10px}.card{background:#fffaf2;border:1px solid #e0d2bc;border-radius:8px;padding:6px}
.card img{display:block;border-radius:4px}.row{display:flex;gap:4px;align-items:flex-end}.col{display:flex;flex-direction:column;gap:4px}
.name{font-weight:700;font-size:15px}.meta{color:#6b5d50;font-size:12px}.over{color:#b3261e;font-weight:700}.tag{font-size:11px;color:#6b5d50}`;
async function shoot(html, file, width) {
  await page.setViewportSize({ width, height: 400 });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  console.log('wrote', file);
}
const tile = (fn, args) => page.evaluate(([f, a]) => window[f](a), [fn, args]);

try {
  // (a) close-ups, three pages.
  const groups = [['a1-core', 'Core roster (shared by every faction)', assets.filter((a) => a.group === 'core')],
    ['a2-faction', 'Faction models (approved 2026-11-11)', assets.filter((a) => a.group === 'faction')],
    ['a3-air-round2', 'Flyers, bosses and round-2 additions', assets.filter((a) => a.group === 'air' || a.group === 'round2')]];
  for (const [file, title, list] of groups) {
    const cards = [];
    for (const a of list) {
      const cols = coloursFor(a.name), f0 = F[cols[0]];
      const big = await tile('closeTile', { name: a.name, color: f0.color, glow: f0.glow, boss: a.boss, w: 300, h: 300, dpr: 1 });
      const smalls = [];
      for (const c of cols.slice(1)) smalls.push((await tile('closeTile', { name: a.name, color: F[c].color, glow: F[c].glow, boss: a.boss, w: 116, h: 116, dpr: 1 })).url);
      const game = await tile('gameTile', { name: a.name, color: f0.color, glow: f0.glow, boss: a.boss, w: a.kind === 'building' || a.boss ? 150 : 72, h: a.kind === 'building' || a.boss ? 150 : 72 });
      const pct = Math.round(100 * a.triangles / a.budget);
      cards.push(`<div class="card"><div class="row"><img src="${big.url}" width="300" height="300"><div class="col">${smalls.map((u) => `<img src="${u}" width="116" height="116">`).join('')}
        <div class="tag">phone, real size:</div><img src="${game.url}" style="width:${a.kind === 'building' || a.boss ? 150 : 72}px"></div></div>
        <div class="name">${a.name}</div><div class="meta">${a.home} · ${a.kind || (a.air ? 'flyer' : a.boss ? 'boss' : 'unit')} · <span class="${pct > 100 ? 'over' : ''}">${a.triangles} / ${a.budget}${a.implied ? '*' : ''} tris (${pct}%)</span> · ${game.px}px tall at zoom 38 · portrait ${PORTRAITS.has(a.name) ? 'yes' : '<span class="over">MISSING</span>'}</div>
        <div class="tag">colours: ${cols.map((c) => F[c].label).join(', ')}</div></div>`);
    }
    await shoot(`<h1>(a) ${title}</h1><p class="sub">Close-up 3/4 view, game lighting (riverlands sun + sky, Neutral+grade tone map, team rim, room reflections). * = no budget in manifest; STAGE_2 band used.</p><div class="grid" style="grid-template-columns:repeat(3,1fr)">${cards.join('')}</div>`, `${file}.png`, 1460);
  }

  // (b) real game zoom on a 390x844 phone (zoom 38, orthographic camera offset 25,51,43).
  const R = [0.8638, 0, -0.5038], D = [-0.5038, 0, -0.8638]; // screen-right and away-from-camera on the ground
  const place = (u, v) => ({ x: R[0] * u + D[0] * v, z: R[2] * u + D[2] * v });
  const layout = (names, cols, du, dv, v0, extra = {}) => names.map((n, i) => {
    const a = assets.find((x) => x.name === n), c = coloursFor(n)[0];
    return { name: n, color: F[c].color, glow: F[c].glow, boss: a.boss, yaw: 0.9, ...place((i % cols - (cols - 1) / 2) * du, v0 - Math.floor(i / cols) * dv), ...extra };
  });
  const phones = [
    ['Ground units', layout(['worker', 'vanguard', 'ranger', 'breaker', 'medic', 'engineer', 'tank', 'antitank', 'scrapper', 'scorcher', 'rider', 'wagon', 'drone', 'walker', 'shade', 'watcher', 'gunner', 'stalker', 'rampart', 'carrier'], 4, 4.2, 9.5, 21)],
    ['Buildings', layout(['hq', 'barracks', 'foundry', 'relay', 'tower', 'salvageyard', 'waystation', 'pylon', 'veilrelay', 'workshop'], 2, 8, 10.5, 22)],
    ['Flyers and a mixed fight', [
      ...layout(['kite', 'hawk', 'balloon', 'glider'], 2, 8, 9, 16, { y: 3.2 }),
      ...['vanguard', 'ranger', 'antitank', 'tank', 'medic', 'vanguard'].map((n, i) => ({ name: n, label: 'mint ' + n, color: F.meridian.color, glow: F.meridian.glow, yaw: 0.9, ...place(-6 + (i % 3) * 2.2, -1 - Math.floor(i / 3) * 3.2) })),
      ...['scrapper', 'scrapper', 'antitank', 'scorcher', 'ranger', 'scrapper'].map((n, i) => ({ name: n, label: 'coral ' + n, color: F.ashfall.color, glow: F.ashfall.glow, yaw: -2.2, ...place(1.6 + (i % 3) * 2.2, -1 - Math.floor(i / 3) * 3.2) })),
      ...['vanguard', 'drone', 'walker'].map((n, i) => ({ name: n, label: 'blue ' + n, color: F.wardens.color, glow: F.wardens.glow, yaw: 0.2, ...place(-5 + i * 4.5, -13) })),
      ...['shade', 'watcher', 'ranger'].map((n, i) => ({ name: n, label: 'violet ' + n, color: F.veil.color, glow: F.veil.glow, yaw: 0.9, ...place(-5 + i * 4.5, -20) })),
    ]],
    ['Bosses (tank for scale)', [
      ...layout(['ironvanguard'], 1, 0, 0, 14),
      ...layout(['ironsovereign'], 1, 0, 0, -8),
      { name: 'tank', label: 'tank', color: F.meridian.color, glow: F.meridian.glow, yaw: 0.9, ...place(-5.5, 6) },
    ]],
  ];
  const phoneHtml = [];
  for (const [title, items] of phones) {
    const r = await tile('gameScene', { items, w: 390, h: 844, dpr: 1.6 });
    const labels = r.labels.map((l) => `<div style="position:absolute;left:${l.x - 45}px;top:${l.y + 2}px;width:90px;text-align:center;font:600 9px/1.1 Arial;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000">${l.name}<br>${l.px}px${l.k > 1 ? ' ×' + l.k : ''}</div>`).join('');
    phoneHtml.push(`<div><div class="name" style="margin:4px 0">${title}</div><div style="position:relative;width:390px;height:844px"><img src="${r.url}" width="390" height="844">${labels}</div></div>`);
  }
  await shoot(`<h1>(b) Real game zoom on a phone</h1><p class="sub">390x844 CSS px, renderer pixel ratio 1.6 (view.js cap), default zoom 38 (Eco 31 is a little closer), orthographic game camera, riverlands grass. Labels: drawn height in CSS px, ×k = the game's readability scale (min 1.25, max(1, 28 px / height)). Flyers at 3.2 m; bosses at 1.5× (boss-view.js).</p><div style="display:flex;gap:14px;padding:0 12px 12px">${phoneHtml.join('')}</div>`, 'b-phone-zoom.png', 1640);

  // (c) the shared infantry in each faction colour, plus that faction's own swaps.
  const INF = ['vanguard', 'ranger', 'medic', 'engineer', 'antitank', 'breaker'];
  const SWAPS = { meridian: ['gunner', 'workshop'], ashfall: ['scrapper', 'scorcher'], sunward: ['rider', 'wagon'], wardens: ['drone', 'walker'], veil: ['shade', 'watcher'] };
  const EXCLUDED = { wardens: ['medic', 'engineer'] };
  const swapOf = { ashfall: { vanguard: 'scrapper', breaker: 'scorcher' }, sunward: { ranger: 'rider', medic: 'wagon' }, wardens: { ranger: 'drone' }, veil: { vanguard: 'shade', antitank: 'watcher' } };
  const rows = [];
  for (const [id, f] of Object.entries(F)) {
    const cells = [];
    for (const n of INF) {
      const t = await tile('closeTile', { name: n, color: f.color, glow: f.glow, w: 150, h: 150, dpr: 1 });
      const g = await tile('gameTile', { name: n, color: f.color, glow: f.glow, w: 60, h: 60 });
      const note = EXCLUDED[id]?.includes(n) ? '<span class="over">not in roster</span>' : swapOf[id]?.[n] ? `<span class="over">replaced by ${swapOf[id][n]}</span>` : 'fielded';
      cells.push(`<div class="card"><img src="${t.url}" width="150"><div class="row" style="justify-content:space-between"><div><b>${n}</b><br><span class="tag">${note}</span></div><img src="${g.url}" style="width:60px"></div></div>`);
    }
    for (const n of SWAPS[id]) {
      const a = assets.find((x) => x.name === n);
      const t = await tile('closeTile', { name: n, color: f.color, glow: f.glow, w: 150, h: 150, dpr: 1, bg: '#f3d9c9' });
      const g = await tile('gameTile', { name: n, color: f.color, glow: f.glow, w: 60, h: 60 });
      cells.push(`<div class="card" style="background:#fbe9de"><img src="${t.url}" width="150"><div class="row" style="justify-content:space-between"><div><b>${n}</b><br><span class="tag">own ${a.kind || 'unit'}</span></div><img src="${g.url}" style="width:60px"></div></div>`);
    }
    rows.push(`<div style="display:flex;align-items:center;gap:6px;padding:0 10px 8px"><div style="width:90px;font-weight:700"><span style="display:inline-block;width:14px;height:14px;background:${f.color};border-radius:3px;vertical-align:middle"></span> ${f.label}</div>${cells.join('')}</div>`);
  }
  await shoot(`<h1>(c) Shared infantry by faction</h1><p class="sub">The six shared infantry models in each faction's team colour and glow (left), then two of that faction's own models (pink cards). Inset: the same unit at real phone size (zoom 38, ratio 1.6). Only Team/TeamGlow materials change between factions.</p>${rows.join('')}`, 'c-infantry-factions.png', 1400);
} finally {
  await browser.close();
  server.close();
}
