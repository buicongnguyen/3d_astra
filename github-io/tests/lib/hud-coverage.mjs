// HUD coverage (W13, 2026-11-25): the share of the screen the interface paints over the battlefield.
// Runs inside the page (page.evaluate(hudCoverage, options)). Every rendered element outside the battlefield
// canvas paints onto a grid of samples (clipped to the viewport and to any ancestor that clips its overflow):
// a background counts by its alpha (a gradient by its most opaque stop, an image fully), an element that
// draws content of its own (an icon, an image, a canvas such as the minimap) counts fully over its box, text over its line boxes, and the
// element's opacity (with its ancestors') scales both; text counts by its line boxes. A sample's cover is 1 - product(1 - alpha), so a
// translucent panel where the map shows through counts for less than a solid one. Hover-free overlays
// (pointer-events: none notices) count like anything else.
// Not counted: the battlefield canvas and its overlays, and full-screen layers (grading, vignettes) that are
// part of the picture rather than chrome.
export function hudCoverage({ step = 4, detail = false } = {}) {
  const W = innerWidth, H = innerHeight, cols = Math.ceil(W / step), rows = Math.ceil(H / step);
  const clear = new Float32Array(cols * rows).fill(1);
  const world = document.querySelector("#world");
  const opacityCache = new Map();
  const opacity = (el) => {
    if (!el || el === document.documentElement) return 1;
    if (opacityCache.has(el)) return opacityCache.get(el);
    const v = (parseFloat(getComputedStyle(el).opacity) || 0) * opacity(el.parentElement);
    opacityCache.set(el, v);
    return v;
  };
  const alphaOf = (color) => {
    const m = /rgba?\(([^)]+)\)/.exec(color || "");
    if (!m) return 0;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
  };
  const clipCache = new Map();
  // The visible box of an element's children: the viewport cut by every ancestor that clips its overflow.
  const clipOf = (el) => {
    if (!el || el === document.body || el === document.documentElement) return { l: 0, t: 0, r: W, b: H };
    if (clipCache.has(el)) return clipCache.get(el);
    const up = clipOf(el.parentElement), s = getComputedStyle(el);
    let box = up;
    if (s.position === "fixed") box = { l: 0, t: 0, r: W, b: H };
    if (/hidden|auto|scroll|clip/.test(s.overflowX + s.overflowY)) {
      const r = el.getBoundingClientRect();
      box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top), r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) };
    }
    clipCache.set(el, box);
    return box;
  };
  const parts = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    if (world && world.contains(el) && el.tagName === "CANVAS") continue;
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue; // an icon counts once, by its box
    if (!el.getClientRects().length) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "contents") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.width >= W * 0.95 && r.height >= H * 0.95) continue;
    let bg = alphaOf(s.backgroundColor);
    const img = s.backgroundImage;
    if (img && img !== "none") {
      if (/url\(/.test(img)) bg = 1;
      else for (const c of img.match(/rgba?\([^)]+\)/g) || []) bg = Math.max(bg, alphaOf(c));
    }
    const own = el.tagName === "svg" || ["IMG", "CANVAS", "VIDEO", "PICTURE"].includes(el.tagName);
    const fade = opacity(el), a = Math.min(1, Math.max(bg, own ? 1 : 0)) * fade;
    const c = clipOf(el.parentElement);
    // Boxes this element paints: its own box (background, icon), and the line boxes of its own text.
    const boxes = a > 0.01 ? [[r, a]] : [];
    if (!own && fade > 0.01 && s.color !== "transparent") for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const line of range.getClientRects()) boxes.push([line, fade]);
    }
    let added = 0;
    for (const [box, alpha] of boxes) {
      const l = Math.max(box.left, c.l, 0), t = Math.max(box.top, c.t, 0), rr = Math.min(box.right, c.r, W), b = Math.min(box.bottom, c.b, H);
      if (rr <= l || b <= t) continue;
      const x0 = Math.ceil(l / step - 0.5), x1 = Math.floor(rr / step - 0.5), y0 = Math.ceil(t / step - 0.5), y1 = Math.floor(b / step - 0.5);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * cols + x, before = clear[i];
        clear[i] = before * (1 - alpha);
        added += before - clear[i];
      }
    }
    if (detail && added > 0) {
      const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : ""}`;
      parts.set(name, (parts.get(name) || 0) + added);
    }
  }
  let total = 0;
  for (const v of clear) total += 1 - v;
  const n = cols * rows, pct = (100 * total) / n;
  return detail ? { pct, parts: [...parts].map(([k, v]) => [k, +((100 * v) / n).toFixed(2)]).sort((a, b) => b[1] - a[1]).slice(0, 16) } : { pct };
}
