// Phone battle-HUD audit (round 3 HUD tidy pass). For five phone viewports x Skirmish / a campaign mission /
// Defence x four selections (nothing, one unit, a mixed group, a building) it prints:
//   - the clear-scene share: the same elementFromPoint grid as tests/phones.mjs (20 x 40 portrait, 40 x 20 landscape);
//   - text under 11 px, taps under 44 px, sideways scroll and HUD blocks that overlap each other;
//   - the heights of the fixed bands (top bar, touch row, dock, dock tabs, Defence bar).
// Usage (a server must be running, e.g. vite preview on 4232):
//   TEST_URL=http://127.0.0.1:4232/ node tools/phone-hud-audit.mjs --out docs/aaa/results/round3/hud/before [--only portrait390] [--modes skirmish] [--lang ko]
// Writes <out>/<viewport>-<mode>-<selection>.jpg, <out>/<viewport>-<mode>-early.jpg (two seconds into play, with the
// opening notices still up), <out>/<viewport>-mission-talk.jpg (the opening radio line) and <out>/audit.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { launchBrowser, openPage } from "../tests/lib/harness.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg("--out", ".tmp/hud-audit");
const ONLY = arg("--only", "");
const MODES = (arg("--modes", "skirmish,mission,defence")).split(",");
const LANG = arg("--lang", ""); // e.g. ko or vi: picked on the start screen before the match
export const PHONES = {
  portrait390: { width: 390, height: 844, mobile: true },
  portrait360: { width: 360, height: 780, mobile: true },
  landscape844: { width: 844, height: 390, mobile: true },
  landscape740: { width: 740, height: 360, mobile: true },
  small320: { width: 320, height: 568, mobile: true },
};

const SHARE = () => {
  const portrait = innerWidth < innerHeight, cols = portrait ? 20 : 40, rows = portrait ? 40 : 20, canvas = document.querySelector("#world canvas:not(.activity-overlay)");
  let hit = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const e = document.elementFromPoint((c + 0.5) * innerWidth / cols, (r + 0.5) * innerHeight / rows);
    if (e === canvas || e?.classList?.contains("activity-overlay")) hit++;
  }
  return hit / (cols * rows);
};

const AUDIT = () => {
  const shown = (e) => { if (!e.getClientRects().length || e.closest("[hidden]")) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === "hidden" || +s.opacity < 0.05 || s.display === "none") return false; } return true; };
  const name = (e) => e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join(".")}`;
  const roots = [...document.querySelectorAll("header.topbar, #stage > *:not(#world):not(#briefing), body > *:not(#app):not(#modal)")].filter(shown);
  const all = roots.flatMap((r) => [r, ...r.querySelectorAll("*")]).filter((e) => !e.closest("#world, #briefing, canvas") && shown(e));
  const vw = innerWidth, vh = innerHeight;
  const onScreen = (r) => r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
  const small = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && onScreen(e.getBoundingClientRect()) && (parseFloat(getComputedStyle(e).fontSize) || 99) < 11)
    .map((e) => `${name(e)} "${e.textContent.trim().slice(0, 18)}" ${parseFloat(getComputedStyle(e).fontSize)}px`);
  const taps = all.filter((e) => e.matches("button, a, select, [role=button]") && !e.disabled && getComputedStyle(e).pointerEvents !== "none" && onScreen(e.getBoundingClientRect()))
    .map((e) => [name(e), e.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5).map(([n, r]) => `${n} ${Math.round(r.width)}x${Math.round(r.height)}`);
  // HUD blocks: positioned boxes that float over the scene, outermost only.
  const blocks = all.filter((e) => { const s = getComputedStyle(e); if (!/fixed|absolute/.test(s.position) && !e.matches(".bottom-dock > *, .command-deck > *")) return false; const r = e.getBoundingClientRect(); return r.width * r.height >= 300 && onScreen(r) && s.pointerEvents !== "none" || e.matches("#notice.show, #mode-banner, #dialogue-card, #fight-hint"); })
    .filter((e, _, list) => !list.some((o) => o !== e && o.contains(e)));
  // Labels cut off inside their box (button labels, resource numbers, tabs).
  const cut = all.filter((e) => e.matches("button span, button, .resource strong, #clock") && [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && getComputedStyle(e).overflow !== "visible" && e.scrollWidth > e.clientWidth + 1)
    .map((e) => `${name(e)} "${e.textContent.trim().slice(0, 18)}" ${e.scrollWidth}>${e.clientWidth}`);
  const spill = all.filter((e) => e.matches(".resource strong")).filter((e) => { const r = e.getBoundingClientRect(), p = e.closest(".resource").getBoundingClientRect(); return r.right > p.right + 0.5 || r.left < p.left - 0.5; }).map((e) => `${name(e)} spills`);
  const overlaps = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i].getBoundingClientRect(), b = blocks[j].getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 4 && h > 4) overlaps.push(`${name(blocks[i])} x ${name(blocks[j])} ${Math.round(w)}x${Math.round(h)}`);
  }
  const height = (s) => { const e = document.querySelector(s); return e && shown(e) ? Math.round(e.getBoundingClientRect().height) : 0; };
  return {
    small: [...new Set(small)], cut: [...cut, ...spill], taps: [...new Set(taps)], overlaps, sideScroll: document.documentElement.scrollWidth > innerWidth + 1,
    bands: { topbar: height(".topbar"), touchRow: height(".touch-controls"), dock: height(".bottom-dock"), tabs: height("#dock-tabs"), defenceBar: height("#defence-bar") },
    blocks: blocks.map((e) => { const r = e.getBoundingClientRect(); return `${name(e)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; }),
  };
};

async function startMatch(t, mode) {
  const { page, tap } = t;
  if (mode === "mission") {
    await tap('[data-mode="campaign"]'); await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible", timeout: 30000 });
    await tap("#mb-skip"); await tap("#mb-next");
  } else if (mode === "defence") {
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels", { timeout: 20000 });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence, null, { timeout: 60000 });
    // One tower on the first free pad, so the "building" case has something to select.
    await page.evaluate(() => { const s = window.__frontier.sim, def = s.missionDef.defence, pad = def.pads.find((p) => !s.towerOn(p.id)); s.players[0].alloy += 500; s.command({ team: 0, type: "padBuild", pad: pad.id, crew: def.crews[0] }); });
  } else await tap("#start");
  await page.waitForFunction(() => window.__frontier.started, null, { timeout: 60000 });
}

const browser = await launchBrowser();
mkdirSync(OUT, { recursive: true });
const report = {};
try {
  for (const [vp, size] of Object.entries(PHONES)) {
    if (ONLY && !ONLY.split(",").includes(vp)) continue;
    for (const mode of MODES) {
      const t = await openPage(browser, size);
      const { page } = t;
      await t.goto(); await t.ready();
      if (LANG) { await page.selectOption("#language", LANG); await page.waitForFunction((l) => document.documentElement.lang === l, LANG, { timeout: 20000 }); }
      await startMatch(t, mode);
      await page.evaluate(() => { const f = window.__frontier; f.sim.aiEnabled = false; f.select([]); });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/${vp}-${mode}-early.jpg`, type: "jpeg", quality: 62 });
      const early = await page.evaluate(SHARE);
      // A campaign's opening radio line (m01 at 0:03): one shot while it shows.
      if (mode === "mission" && await page.waitForFunction(() => document.documentElement.classList.contains("dialogue-open"), null, { timeout: 8000 }).then(() => true, () => false)) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${vp}-${mode}-talk.jpg`, type: "jpeg", quality: 62 });
      }
      // Settle as tests/phones.mjs does: the opening notice and radio line close, then the clock holds.
      await page.waitForFunction(() => !document.querySelector("#notice").classList.contains("show"), null, { timeout: 15000 }).catch(() => {});
      if (mode === "mission") await page.waitForFunction(() => !document.documentElement.classList.contains("dialogue-open") && window.__frontier.sim.time > 4, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => { window.__frontier.hold = true; });
      const row = { early };
      for (const sel of ["none", "one", "mixed", "building"]) {
        const picked = await page.evaluate((sel) => {
          const f = window.__frontier, mine = f.sim.own(0);
          const units = mine.filter((e) => e.kind === "unit"), army = units.filter((e) => e.type !== "worker");
          let ids = [];
          if (sel === "one") ids = (army[0] || units[0]) ? [(army[0] || units[0]).id] : [];
          if (sel === "mixed") { const types = new Map(); for (const u of units) if (!types.has(u.type)) types.set(u.type, u); ids = types.size >= 2 ? units.slice(0, 8).map((u) => u.id) : []; if (ids.length && new Set(ids.map((id) => f.sim.get(id).type)).size < 2) ids = [...types.values()].map((u) => u.id); }
          if (sel === "building") { const b = mine.find((e) => e.kind === "building"); ids = b ? [b.id] : []; }
          if (sel !== "none" && !ids.length) return false;
          f.select(ids); return true;
        }, sel);
        if (!picked) { row[sel] = null; continue; }
        await page.waitForTimeout(500);
        const share = await page.evaluate(SHARE), audit = await page.evaluate(AUDIT);
        await page.screenshot({ path: `${OUT}/${vp}-${mode}-${sel}.jpg`, type: "jpeg", quality: 62 });
        row[sel] = { share, ...audit };
      }
      row.errors = t.errors;
      report[`${vp}/${mode}`] = row;
      const pct = (r) => r ? `${(r.share * 100).toFixed(1)}%` : "n/a";
      console.log(`${vp.padEnd(13)} ${mode.padEnd(8)} early ${(early * 100).toFixed(1)}%  none ${pct(row.none)}  one ${pct(row.one)}  mixed ${pct(row.mixed)}  building ${pct(row.building)}  issues ${["none", "one", "mixed", "building"].map((s) => row[s] ? row[s].small.length + row[s].cut.length + row[s].taps.length + row[s].overlaps.length + (row[s].sideScroll ? 1 : 0) : 0).join("/")}${t.errors.length ? `  ERRORS ${t.errors.length}` : ""}`);
      await page.close();
    }
  }
} finally {
  writeFileSync(`${OUT}/audit.json`, `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
}
