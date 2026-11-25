// Unit review 2026-11-25: every unit of every faction drawn right, in the browser at 1440x900 and 390x844.
// Each trainable unit of each faction (base slots and swaps, Kite and faction flyers, workshop units), the
// Carrier, the creatures and the bosses spawn on Amber Dunes: team 1 on flat sand, team 0 on the plateau top.
// For each one it checks:
//  - a real model (not the built-in FallbackFlyer airframe that stands in while a model loads);
//  - feet, wheels or hull on the ground (|lowest point - terrain| small; hovering types a little above),
//    on the plateau too; flyers at their fly height above the ground under them;
//  - its team colour on its Team paint (bosses repaint their own geometry: skipped);
//  - drawn on screen (inside the view, its object visible);
//  - its vitals bar above its own top (a Walker's bar is not drawn across its body).
// One evaluate per check, a couple of renders each (CI's 20x slowed CPU: no long frame loops).
// Screenshots: test-results/unit-roster-*.png. Scratch contact sheets: .tmp/units-sheet.mjs (not in CI).
import assert from "node:assert/strict";
import fs from "node:fs";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const balance = JSON.parse(fs.readFileSync(new URL("../src/balance.json", import.meta.url), "utf8"));
const D = balance.definitions, F = balance.factions;
const SLOTS = ["worker", "vanguard", "ranger", "breaker", "tank", "antitank", "medic", "engineer"];
const roster = new Set();
for (const [id, f] of Object.entries(F)) {
  for (const slot of SLOTS) if (!f.exclude?.includes(slot)) roster.add(f.swap[slot] || slot);
  for (const t of ["kite", ...Object.values(f.extra || {}).flat()]) roster.add(t);
  for (const [t, d] of Object.entries(D)) if (d.kind === "unit" && d.workshop === id) roster.add(t);
}
// Everything else a match can put on the field: transport, creatures, bosses.
for (const [t, d] of Object.entries(D)) if (d.kind === "unit" && fs.existsSync(new URL(`../public/models/${t}.glb`, import.meta.url))) roster.add(t);
const TYPES = [...roster];
// Types that hover by design (a model with a "hover" node): their lowest point may sit this far up.
const HOVER = 0.9, GROUND = 0.12;

const browser = await launchBrowser();
await suite("unit-roster", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const { page, errors, goto, ready } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    await goto();
    await ready();
    await page.selectOption("#scenario", "dunes");
    await ready();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    await page.evaluate((types) => window.__frontier.view.preloadModels(types), TYPES);
    await page.waitForFunction((types) => types.every((t) => window.__frontier.view.models.has(t)), TYPES, { timeout: TIMEOUT.models });
    // Spawn: team 1 in a grid on flat sand, team 0 in a grid on the plateau top; nothing ticks.
    const layout = await page.evaluate((types) => {
      const f = window.__frontier, s = f.sim, v = f.view, T = v.terrain;
      f.hold = true; s.aiEnabled = false; f.select([]);
      s.entities = s.entities.filter((e) => e.kind !== "unit");
      s.visible[0].fill(1); s.explored[0].fill(1);
      const flat = (x, z, r) => { const h = T.heightAt(x, z); return [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]].every(([dx, dz]) => Math.abs(T.heightAt(x + dx, z + dz) - h) < 0.02); };
      const clear = (x, z, r) => s.entities.every((e) => Math.hypot(e.x - x, e.z - z) > r + (e.radius || 1));
      let sand = null;
      for (let r = 0; r < 70 && !sand; r += 3) for (let a = 0; a < 6.28 && !sand; a += 0.3) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (flat(x, z, 16) && clear(x, z, 20)) sand = { x, z }; }
      const top = T.plateaus.map((p) => ({ x: p.x, z: p.z, h: T.heightAt(p.x, p.z) })).sort((a, b) => b.h - a.h)[0];
      const cols = Math.ceil(Math.sqrt(types.length)), place = (c, gap, i) => ({ x: c.x + ((i % cols) - (cols - 1) / 2) * gap, z: c.z + (Math.floor(i / cols) - (cols - 1) / 2) * gap });
      const ids = { sand: [], top: [] };
      types.forEach((t, i) => {
        const a = place(sand, 4.4, i), e = s.spawn(t, 1, a.x, a.z, true, true); e.angle = 0.6; e.hp = e.maxHp * 0.8; ids.sand.push(e.id);
        const b = place(top, 2.2, i), g = s.spawn(t, 0, b.x, b.z, true, true); g.angle = 0.6; g.hp = g.maxHp * 0.8; ids.top.push(g.id);
      });
      return { sand, top, ids, plateau: top.h };
    }, TYPES);
    assert.ok(layout.sand && layout.top && layout.plateau > 1, `${viewport}: open sand and a plateau top ${JSON.stringify(layout)}`);
    for (const group of ["sand", "top"]) {
      const rows = await page.evaluate(({ ids, centre, top }) => {
        const f = window.__frontier, s = f.sim, v = f.view, T = v.terrain;
        v.yaw = 0; v.focus.set(centre.x, top ? centre.h : 0, centre.z); v.zoom = top ? 34 : 62; v.updateCamera();
        v.update(s, 0.5, f.selected, null); v.update(s, 0.5, f.selected, null);
        const p = { x: 0, y: 0, z: 0 }, out = [];
        const world = (el, x, y, z) => ({ x: el[0] * x + el[4] * y + el[8] * z + el[12], y: el[1] * x + el[5] * y + el[9] * z + el[13], z: el[2] * x + el[6] * y + el[10] * z + el[14] });
        for (const id of ids) {
          const e = s.get(id), o = v.objects.get(id);
          if (!o) { out.push({ type: e.type, missing: true }); continue; }
          const m = o.userData.model, ground = T.heightAt(e.x, e.z);
          let lo = Infinity, hi = -Infinity, paint = 0, painted = 0;
          o.updateMatrixWorld(true);
          m.traverse((part) => {
            if (!part.isMesh) return;
            if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
            const b = part.geometry.boundingBox, el = part.matrixWorld.elements;
            for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const w = world(el, x, y, z); lo = Math.min(lo, w.y); hi = Math.max(hi, w.y); }
            const name = part.material?.name || "";
            if (name.startsWith("Team") && !name.startsWith("TeamGlow")) { paint++; if (part.material.color.getHex() === v.colors[e.team]) painted++; }
          });
          const c = o.position.clone().setY((lo + hi) / 2).project(v.camera);
          out.push({ type: e.type, team: e.team, fallback: m.name === "FallbackFlyer", hover: !!o.userData.hover, flying: !!e.flying, boss: !!e.boss,
            low: +(lo - ground).toFixed(3), high: +(hi - ground).toFixed(3), lift: o.userData.air ? +(o.userData.air.y - ground).toFixed(2) : 0,
            paint, painted, visible: o.visible && m.visible, onScreen: Math.abs(c.x) <= 1 && Math.abs(c.y) <= 1,
            bar: +(o.userData.bar.position.y + o.position.y - ground - (o.userData.air ? (o.userData.air.y - ground) : 0)).toFixed(2), top: +(hi - ground - (o.userData.air ? o.userData.air.y - ground : 0)).toFixed(2) });
        }
        return out;
      }, { ids: layout.ids[group], centre: group === "top" ? { ...layout.top } : { ...layout.sand, h: 0 }, top: group === "top" });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await shot(page, `unit-roster-${group}-${viewport}`);
      const bad = [];
      for (const r of rows) {
        const id = `${viewport} ${group} ${r.type}`;
        if (r.missing) { bad.push(`${id}: not drawn at all`); continue; }
        if (r.fallback) bad.push(`${id}: stand-in airframe, not its model`);
        if (r.flying) { if (!(r.lift > 2 && r.low > 1.5)) bad.push(`${id}: flyer not up at its height (lift ${r.lift}, lowest ${r.low})`); }
        else if (!(r.low > -GROUND && r.low < (r.hover ? HOVER : GROUND))) bad.push(`${id}: lowest point ${r.low} off the ground`);
        if (!r.boss && !(r.paint > 0 && r.painted === r.paint)) bad.push(`${id}: team colour on ${r.painted}/${r.paint} Team parts`);
        if (!r.visible || !r.onScreen) bad.push(`${id}: not on screen (visible ${r.visible}, in view ${r.onScreen})`);
        if (!r.flying && !r.boss && !(r.bar >= r.top)) bad.push(`${id}: vitals bar at ${r.bar} under its top ${r.top}`);
      }
      assert.deepEqual(bad, [], bad.join("\n"));
      assert.equal(rows.length, TYPES.length);
    }
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    console.log(`unit-roster ${viewport}: ${TYPES.length} unit types x 2 teams (sand and plateau) checked`);
    await page.close();
  }
}, { browser });
