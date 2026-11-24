// Creature round (sim/content/campaign-creatures.js, src/creature-view.js): the campaign's optional creatures
// in the real client. Mission 2's Acid Hound den, mission 4's Dune Wyrm nest (cleared and tamed) and mission
// 8's Vault Sentinel (woken by the player's attack order, kneeling, then joining) on desktop and a phone.
// Checks: the creature models load with the mission, the wild-side copies draw, a whole hound pack shares
// its instanced batches, the den ring shows, the guardian kneels in the view and is redrawn in the
// player's colours when it joins, and nothing throws. Screenshots: test-results/creatures-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", ids = MISSIONS.map((m) => m.id);
const progressFor = (id) => ({ cleared: Object.fromEntries(ids.slice(0, ids.indexOf(id)).filter((m) => !MISSIONS.find((x) => x.id === m).optional).map((m) => [m, { time: 400, medal: "silver", difficulty: "standard" }])) });
const step = (page, seconds) => page.evaluate((t) => window.__frontier.step(t), seconds);

async function startMission(t, id) {
  const { page, goto, ready, tap } = t;
  await goto();
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progressFor(id)]);
  await page.reload(); await ready();
  await tap('[data-mode="campaign"]');
  await tap(`[data-mission="${id}"]`);
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible" });
  await tap("#mb-skip"); await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { const f = window.__frontier; f.hold = true; if (f.scene().open) f.skipScene(); f.sim.explored[0].fill(1); f.sim.updateVision(); });
  assert.equal(await page.evaluate(() => window.__frontier.sim.mission.id), id);
}
// Brings the camera to (x, z) and lets the view draw a couple of frames. Two unarmed Harvesters stand 10 m off
// as eyes (creatures out of sight are not drawn), outside every den's 8 m reach.
async function look(page, x, z, eyes = true) {
  await page.evaluate(([x, z, eyes]) => {
    const f = window.__frontier, s = f.sim;
    if (eyes) for (const dx of [-3, 3]) { const w = s.spawn("worker", 0, x + dx, z + 10); w.stance = "hold"; }
    s.updateVision();
    f.view.focusOn(x, z + 3);
  }, [x, z, eyes]);
  await step(page, 0.1);
  await page.waitForTimeout(400);
}

const browser = await launchBrowser();
await suite("creatures: campaign dens and the Vault Sentinel", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const t = await openPage(browser, viewport), { page, errors } = t;

    // Mission 2: the Acid Hound den.
    await startMission(t, "m02-first-contact");
    const den = await page.evaluate(() => {
      const f = window.__frontier, d = f.sim.mission.dens.houndDen;
      return { x: d.x, z: d.z, guards: d.guards.length, loaded: f.view.models.has("acidhound") };
    });
    assert.ok(den.loaded, `${viewport}: the hound model loads with mission 2`);
    assert.ok(den.guards >= 3, "a pack guards the den");
    await look(page, den.x, den.z);
    const pack = await page.evaluate(() => {
      const f = window.__frontier, v = f.view, d = f.sim.mission.dens.houndDen, batches = new Set();
      let drawn = 0;
      for (const id of d.guards) {
        const o = v.objects.get(id);
        if (!o) continue;
        drawn++;
        o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { const b = v.batches.byPart.get(m); if (b) batches.add(b.key); } });
      }
      return { drawn, batches: batches.size, ring: v.plugins.list.find((p) => p.built && Array.isArray(p.built.rings) && p.ripples)?.built?.rings?.[0]?.visible };
    });
    await shot(page, `creatures-hounds-${viewport}`);
    assert.equal(pack.drawn, den.guards, `${viewport}: every hound is drawn`);
    assert.ok(pack.batches > 0 && pack.batches <= 5, `${viewport}: the whole pack shares its material batches (${pack.batches})`);
    assert.equal(pack.ring, true, "the den ring shows once explored");
    // The army walks in: the hounds bite with acid, and the den is cleared.
    await page.evaluate(({ x, z }) => {
      const s = window.__frontier.sim, army = s.own(0).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
      army.forEach((e, i) => { e.x = x + 6 + (i % 3) * 1.4; e.z = z - 4 + Math.floor(i / 3) * 1.4; e.orders = []; e.post = null; });
      s.updateVision();
      s.issue(army.map((e) => e.id), { type: "attackmove", x, z });
    }, den);
    let acid = false;
    for (let i = 0; i < 30 && !acid; i++) { await step(page, 0.2); acid = await page.evaluate(() => window.__frontier.sim.events.some((e) => e.type === "creature" && e.kind === "acid")); }
    await page.waitForTimeout(150);
    await shot(page, `creatures-hounds-fight-${viewport}`);
    await page.evaluate(() => { const f = window.__frontier; for (let i = 0; i < 600 && f.sim.mission.dens.houndDen.state === "guarded"; i++) f.step(0.05); });
    assert.equal(await page.evaluate(() => window.__frontier.sim.mission.dens.houndDen.state), "cleared", `${viewport}: the den is cleared`);

    // Mission 4: the Wyrm nest, cleared and tamed.
    await startMission(t, "m04-three-way-dunes");
    const nest = await page.evaluate(() => { const d = window.__frontier.sim.mission.dens.wyrmNest; return { x: d.x, z: d.z, loaded: window.__frontier.view.models.has("wyrm") }; });
    assert.ok(nest.loaded, "the Dune Wyrm model loads with mission 4 (the nest can tame one)");
    await look(page, nest.x, nest.z);
    await shot(page, `creatures-nest-${viewport}`);
    const tamed = await page.evaluate(({ x, z }) => {
      const f = window.__frontier, s = f.sim, d = s.mission.dens.wyrmNest;
      for (const id of d.guards) { const g = s.get(id); if (g) g.hp = 0; }
      const army = s.own(0).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
      army.forEach((e, i) => { e.x = x + (i % 2) * 1.2; e.z = z + Math.floor(i / 2) * 1.2; e.orders = []; e.post = { x: e.x, z: e.z }; });
      for (let i = 0; i < 700 && d.state !== "tamed"; i++) f.step(0.05);
      const w = s.own(0).find((e) => e.type === "wyrm");
      return { state: d.state, wyrm: w?.id ?? null };
    }, nest);
    assert.equal(tamed.state, "tamed", `${viewport}: holding the cleared nest tames a Wyrm`);
    await step(page, 0.1);
    await page.waitForFunction((id) => !!window.__frontier.view.objects.get(id), tamed.wyrm, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await shot(page, `creatures-wyrm-tamed-${viewport}`);

    // Mission 8: the Vault Sentinel's test.
    await startMission(t, "m08-the-quiet-vault");
    const g0 = await page.evaluate(() => { const f = window.__frontier, g = f.sim.tagged("sentinel")[0]; return { id: g.id, x: g.x, z: g.z, team: g.team, loaded: f.view.models.has("vaultsentinel") }; });
    assert.ok(g0.loaded, "the Sentinel model loads with mission 8");
    assert.equal(g0.team, -1, "it waits on no side");
    await look(page, g0.x, g0.z);
    await page.waitForFunction((id) => !!window.__frontier.view.objects.get(id), g0.id, { timeout: TIMEOUT.step });
    await shot(page, `creatures-sentinel-dormant-${viewport}`);
    // The squad walks up; nobody fights it until the Commander orders the attack (through the player's own order path).
    // Okoro stays where he is: bringing him to the vault door completes "vault" and plays echo-wakes first.
    await page.evaluate(({ x, z }) => {
      const s = window.__frontier.sim, squad = s.own(0).filter((e) => e.kind === "unit" && e.tag !== "okoro");
      squad.forEach((e, i) => { e.x = x + 6 + (i % 5) * 1.3; e.z = z + 5 + Math.floor(i / 5) * 1.3; e.orders = []; e.post = null; });
      for (const e of s.entities) if (e.team === 1 && e.kind === "unit") e.hp = 0;
      s.updateVision();
    }, g0);
    await step(page, 2);
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id).hp === window.__frontier.sim.get(id).maxHp, g0.id), true, "an idle squad leaves the dormant guardian alone");
    await page.evaluate((id) => { const f = window.__frontier, s = f.sim; f.select(s.own(0).filter((e) => e.kind === "unit" && e.damage > 0).map((e) => e.id)); const g = s.get(id); f.commandAt(g.x, g.z, id); f.hold = false; }, g0.id);
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { window.__frontier.hold = true; });
    assert.equal(await page.evaluate(() => window.__frontier.scene().id), "vault-sentinel", "its entrance plays");
    await page.waitForTimeout(300);
    await shot(page, `creatures-sentinel-scene-${viewport}`);
    await page.evaluate(() => window.__frontier.skipScene());
    await page.waitForFunction(() => !window.__frontier.scene().open);
    const kneel = await page.evaluate((id) => {
      const f = window.__frontier, g = f.sim.get(id);
      g.hp = Math.round(g.maxHp * 0.39);
      f.step(0.6);
      return { knelt: !!g.knelt, team: g.team, state: g.guardian.state };
    }, g0.id);
    assert.deepEqual(kneel, { knelt: true, team: -1, state: "kneel" }, `${viewport}: below 40% it kneels and nobody may hit it`);
    await step(page, 0.1);
    // Slow runners (CI) draw a frame later than a fixed wait allows: wait for the pose itself.
    await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.rig?.motion?.[2] === 1, g0.id, { timeout: TIMEOUT.step }).catch(() => {});
    assert.equal(await page.evaluate((id) => window.__frontier.view.objects.get(id)?.userData.rig?.motion?.[2], g0.id), 1, "the view holds the kneel pose");
    await shot(page, `creatures-sentinel-kneel-${viewport}`);
    await step(page, 3.5);
    // The redraw in the player's colours rebuilds the model; on a slow runner it lands after a fixed 300 ms.
    await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.team === 0, g0.id, { timeout: TIMEOUT.step }).catch(() => {});
    const joined = await page.evaluate((id) => { const f = window.__frontier, g = f.sim.get(id), o = f.view.objects.get(id); return { team: g.team, state: g.guardian.state, drawnTeam: o?.userData.team, objective: f.sim.missionStatus().find((x) => x.id === "sentinel")?.state }; }, g0.id);
    assert.deepEqual(joined, { team: 0, state: "joined", drawnTeam: 0, objective: "done" }, `${viewport}: it joins and is redrawn in the player's colours`);
    await shot(page, `creatures-sentinel-joined-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
