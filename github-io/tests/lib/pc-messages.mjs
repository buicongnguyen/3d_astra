// PC message stack (src/app/message-stack.js, owner 2026-11-27): on desktop every transient battle message (the
// notice line, the fight hint, the achievement toast, the voice caption) sits at the top left, one under another,
// never in the middle and never over a HUD panel. Shared by messages.mjs, captions.mjs and defence.mjs.
import assert from "node:assert/strict";

export const PC_MESSAGES = ["#notice.show", "#update-toast", "#fight-hint:not([hidden])", "#meta-toast:not([hidden])", "#voice-caption.show"];
export const PC_HUD = [".topbar", ".map-heading", "#mission-objectives", ".minimap-panel", ".bottom-dock", "#dock-tabs", ".dialogue:not([hidden])",
  "#idle-chips", "#defence-bar", "#defence-intel", "#training", "#boss-bar", "#group-strip", ".selection-panel", "#order-tip"];

// Holds transient messages (fight hint, voice caption) past their timers, so a slow runner cannot end them before
// assertPcStack measures. Call before the message is triggered; assertPcStack releases the hold when it is done.
export const holdMessages = (page, on = true) => page.evaluate((on) => { window.__frontier.holdMessages = on; }, on);

// Asserts the stack and returns the boxes it measured. `want` lists messages that must be drawn.
export async function assertPcStack(page, name, want = []) {
  // The wanted messages (up to 3 s), then one frame for the stack to place them.
  if (want.length) await page.waitForFunction((want) => want.every((q) => document.querySelector(q)), want, { timeout: 3000 }).catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m = await page.evaluate(([msgs, hud]) => {
    const box = (el) => {
      if (!el || el.hidden) return null;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      if (s.display === "none" || s.visibility === "hidden" || r.width < 2 || r.height < 2) return null;
      return { id: el.id || el.className, l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    return {
      msgs: msgs.map((q) => ({ q, b: box(document.querySelector(q)) })).filter((x) => x.b),
      hud: hud.flatMap((q) => [...document.querySelectorAll(q)].map(box)).filter(Boolean),
      W: innerWidth, H: innerHeight,
    };
  }, [PC_MESSAGES, PC_HUD]);
  const ov = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  for (const q of want) assert.ok(m.msgs.some((x) => x.q === q), `${name}: ${q} drawn`);
  for (const { q, b } of m.msgs) {
    assert.ok(b.l <= 24, `${name}: ${q} starts at the left edge (x ${b.l})`);
    assert.ok(b.r <= m.W / 2, `${name}: ${q} stays in the left half (right ${b.r} of ${m.W})`);
    assert.ok(b.t < m.H / 2, `${name}: ${q} starts in the top half (y ${b.t} of ${m.H})`);
    for (const h of m.hud) if (!b.id.includes(h.id) && ov(b, h)) assert.fail(`${name}: ${q} ${JSON.stringify(b)} over ${h.id} ${JSON.stringify(h)}`);
  }
  for (let i = 0; i < m.msgs.length; i++) for (let j = i + 1; j < m.msgs.length; j++)
    assert.equal(ov(m.msgs[i].b, m.msgs[j].b), false, `${name}: ${m.msgs[i].q} over ${m.msgs[j].q}`);
  // Stacked one under another in order.
  for (let i = 1; i < m.msgs.length; i++) assert.ok(m.msgs[i].b.t >= m.msgs[i - 1].b.b - 1, `${name}: ${m.msgs[i].q} under ${m.msgs[i - 1].q}`);
  await holdMessages(page, false);
  return m;
}
