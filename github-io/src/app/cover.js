// Title cover (AAA round 3, R3-M): the painted key art and its live layers.
//
//   1. First paint: the flat cover for this frame shape (<picture> in shell.js), nothing else. It is also the
//      calm fallback.
//   2. After the game's models are in and the browser is idle, the parallax layers (cover-layers.js) load,
//      are placed exactly over the flat cover and cross-fade in. Then: pointer parallax on desktop, a slow
//      idle drift on touch, ships drifting and bobbing, the Ranger firing every few seconds, star twinkle.
//   3. One Canvas 2D layer on top: a few twinkling stars, ship streaks, distant battle flashes on the worlds
//      and lightning on the storm world and the horizon.
//   4. Planet labels (HTML, translated), the loading card (a planet in a progress ring mirroring Start's
//      byte-true progress; a full loading screen on the first load) and soft UI blips on the menu cards.
//
// Cost: compositor transforms on ~14 images and one small canvas (<= 1.5x density, 30 fps on touch);
// nothing runs during a match, in a hidden tab or with the menu closed. Calm (the system's reduced motion,
// or the game's "Animate combat effects" off) keeps the flat cover and one still frame, and never fetches the
// layers. Eco graphics alone keeps the cover alive (phones default to Eco); while it runs, #briefing.cover-live
// re-enables the cover's own CSS animations under :root.motion-off.
import "../cover.css";
import { $ } from "./dom.js";
import { FRAMES, LAYERS, SHAPES, WORLDS, layerBox, layerUrl } from "./cover-layers.js";

// Planet labels: the battlefields of the game (maps.json names) plus one scouted world.
export const COVER_WORLDS = {
  riverlands: { name: "Meridian Riverlands", status: "Contested" },
  dunes: { name: "Amber Dunes", status: "Under siege" },
  highlands: { name: "Obsidian Highlands", status: "Enemy held" },
  storm: { name: "Frostline Reach", status: "Scouted" },
};
const FLASH_COLOURS = ["255,214,120", "255,150,70", "255,236,190"];

// A small seeded generator so the cover looks the same on every visit (and in screenshots).
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function setupCover(A = {}, S = {}) {
  const briefing = $("briefing"), hero = briefing?.querySelector(".briefing-hero");
  if (!briefing || !hero) return {};
  const art = hero.querySelector(".briefing-art img");
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () => reduced.matches || S.settings?.combatMotion === false;

  const stack = document.createElement("div");
  stack.className = "cover-layers";
  stack.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  canvas.className = "cover-fx";
  canvas.setAttribute("aria-hidden", "true");
  const scan = document.createElement("div");
  scan.className = "cover-scan";
  scan.setAttribute("aria-hidden", "true");
  const labels = document.createElement("div");
  labels.className = "cover-labels";
  labels.setAttribute("aria-hidden", "true");
  labels.innerHTML = Object.entries(COVER_WORLDS).map(([id, w]) => `<span class="cover-label" data-world="${id}" hidden><b>${w.name}</b><small>${w.status}</small></span>`).join("");
  const loading = document.createElement("div");
  loading.className = "cover-loading boot";
  loading.setAttribute("aria-hidden", "true");
  loading.innerHTML = `<b class="cover-load-title" translate="no"><span>FRONTIER</span> <span>COMMAND</span></b><div class="cover-load-orb"><svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="54"/><circle class="ring-fill" cx="60" cy="60" r="54" pathLength="100"/></svg><i class="cover-load-planet"></i></div><div class="cover-load-text"><strong class="cover-load-pct">0%</strong><span class="cover-load-stage">Preparing expedition…</span></div>`;
  hero.querySelector(".briefing-art").after(stack, canvas, scan, labels);
  briefing.append(loading);

  // ---------- where the frame is on screen (object-fit: cover, centred, like the flat image) ----------
  let frame = null; // { shape, s, ox, oy, box }
  const shapeNow = () => SHAPES.find((s) => (art?.currentSrc || "").includes(`keyart-${s}`)) || "desktop";
  function measure() {
    const stage = $("stage");
    briefing.style.setProperty("--cover-top", `${Math.round(stage?.getBoundingClientRect().top || 0)}px`);
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) { frame = null; return; }
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const shape = shapeNow(), [fw, fh] = FRAMES[shape];
    const s = Math.max(box.width / fw, box.height / fh);
    // Same placement as the flat image (object-fit: cover at its object-position).
    const pos = art ? getComputedStyle(art).objectPosition.split(" ").map((v) => parseFloat(v) / 100) : [];
    const px = Number.isFinite(pos[0]) ? pos[0] : 0.5, py = Number.isFinite(pos[1]) ? pos[1] : 0.5;
    frame = { shape, s, ox: (box.width - fw * s) * px, oy: (box.height - fh * s) * py, box };
    briefing.dataset.coverShape = shape;
    placeLayers();
    placeLabels();
  }
  const toScreen = (x, y) => [frame.ox + x * frame.s, frame.oy + y * frame.s];

  // Worlds on screen: centre and radius in CSS pixels.
  function worlds() {
    if (!frame) return [];
    return LAYERS.filter((l) => WORLDS[l[0]]).map((l) => {
      const [x, y, w, h] = layerBox(l, frame.shape), wd = WORLDS[l[0]];
      const [cx, cy] = toScreen(x + w * wd.cx, y + h * wd.cy);
      return { id: wd.id, layer: l[0], x: cx, y: cy, r: w * wd.r * frame.s };
    });
  }

  // ---------- the parallax layers ----------
  const images = new Map(); // name -> img
  let layersState = "idle"; // idle | loading | ready
  async function loadLayers() {
    if (layersState !== "idle" || calm() || !active()) return;
    layersState = "loading";
    try {
      // Only this frame's nebula; the other one comes if the device turns (placeLayers).
      const imgs = [nebula(frame?.shape), ...LAYERS.map((l) => layerImage(l[0]))];
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      // The nebula at the back, then the art's own order.
      stack.append(...imgs);
      layersState = "ready";
      placeLayers();
      moveLayers(time);
      requestAnimationFrame(() => stack.classList.add("on"));
      wake();
    } catch {
      layersState = "idle"; // The flat cover stays; nothing else depends on the layers.
    }
  }
  function layerImage(name) {
    if (images.has(name)) return images.get(name);
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    img.className = `cover-layer layer-${name}`;
    img.src = layerUrl(name);
    images.set(name, img);
    return img;
  }
  function nebula(shape) {
    const name = shape === "portrait" ? "nebula-portrait" : "nebula-wide";
    const had = images.has(name), img = layerImage(name);
    if (!had && layersState === "ready") stack.prepend(img);
    return img;
  }
  function placeLayers() {
    if (layersState !== "ready" || !frame) return;
    const { shape, s } = frame, [fw, fh] = FRAMES[shape];
    // The nebula fills the reference frame, aspect kept, centred; it never moves.
    const nimg = nebula(shape);
    for (const name of ["nebula-wide", "nebula-portrait"]) if (images.has(name)) images.get(name).hidden = images.get(name) !== nimg;
    const na = nimg.naturalWidth / nimg.naturalHeight || 16 / 9;
    const nw = Math.max(fw, fh * na), nh = nw / na;
    const setBox = (img, x, y, w, h) => {
      const [sx, sy] = toScreen(x, y);
      img.style.left = `${sx}px`; img.style.top = `${sy}px`;
      img.style.width = `${w * s}px`; img.style.height = `${h * s}px`;
    };
    setBox(nimg, (fw - nw) / 2, (fh - nh) / 2, nw, nh);
    const lift = squadLift(), squadBox = layerBox(LAYERS.find((l) => l[6] === "squad"), shape);
    for (const l of LAYERS) {
      const [x, y, w, h] = layerBox(l, shape);
      if ((l[6] === "squad" || l[6] === "flash") && lift > 0) setBox(images.get(l[0]), ...liftedBox([x, y, w, h], squadBox, lift, fw));
      else setBox(images.get(l[0]), x, y, w, h);
    }
  }
  // The lifted squad (portrait) also steps toward the centre and grows a little, so the whole assembly stands in
  // the sky above the sheet instead of leaning off the right edge. The flash keeps its place on the Ranger.
  function liftedBox([x, y, w, h], [sx, sy, sw, sh], lift, fw) {
    const k = 1.1, cx = sx + sw / 2, by = sy + sh;
    const dx = fw * 0.54 - cx;
    // Never over the logo: a short hero (tablets) lifts the squad only until its head clears the title.
    const brand = briefing.querySelector(".title-brand")?.getBoundingClientRect();
    if (brand?.height) lift = Math.max(0, Math.min(lift, by - sh * k - (brand.bottom - frame.box.top - frame.oy) / frame.s));
    return [cx + dx + (x - cx) * k, by - lift + (y - by) * k, w * k, h * k];
  }
  // Phones and tablets in portrait: the setup sheet covers the lower half, where the flat cover keeps its
  // squad, so the animated assembly lifts the squad (and the Ranger's flash) to stand at the foot of the
  // visible sky, in front of the ringed world.
  function squadLift() {
    if (!frame || frame.shape !== "portrait" || !root.classList.contains("compact-ui") || briefing.classList.contains("campaign-view")) return 0;
    const squad = LAYERS.find((l) => l[6] === "squad"), [, y, , h] = layerBox(squad, "portrait");
    const heroBottom = (hero.getBoundingClientRect().bottom - frame.box.top - frame.oy) / frame.s;
    return Math.max(0, y + h - (heroBottom + h * 0.1));
  }

  // Per-frame motion: each layer's offset (pointer on desktop, idle drift on touch), ships drifting and
  // bobbing, the Ranger's shots. Amplitudes are the art's table, in desktop pixels scaled by width / 2560.
  let pointer = [0, 0];
  const eased = [0, 0];
  function moveLayers(t) {
    if (layersState !== "ready" || !frame) return;
    const unit = frame.box.width / 2560, own = frame.s;
    const touch = root.classList.contains("touch-ui");
    eased[0] += (pointer[0] - eased[0]) * 0.06; eased[1] += (pointer[1] - eased[1]) * 0.06;
    LAYERS.forEach((l, i) => {
      const [ax, ay] = l[5];
      let dx, dy;
      if (touch) { dx = Math.sin(t * 0.16 + i * 0.7) * ax * unit * 2; dy = Math.cos(t * 0.12 + i * 0.5) * ay * unit * 2; }
      else { dx = -eased[0] * 2 * ax * unit * 2; dy = -eased[1] * 2 * ay * unit * 2; }
      if (l[6] === "ship") { dx += Math.sin(t * (0.09 + i * 0.013) + i) * 40 * own; dy += Math.sin(t * (0.6 + i * 0.07) + i * 2) * 5 * own; }
      const img = images.get(l[0]);
      img.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      if (l[6] === "flash") {
        // The Ranger fires a double shot every few seconds.
        const k = (t % 3.6) / 3.6, burst = k < 0.035 ? 1 : k < 0.07 ? 0.25 : k > 0.09 && k < 0.115 ? 0.9 : 0;
        img.style.opacity = String(burst);
      }
    });
  }

  // ---------- labels: upper right of their world, giving way to everything that matters more ----------
  function placeLabels() {
    const compact = root.classList.contains("compact-ui");
    const avoid = [".title-brand", ".briefing-copy .eyebrow", ".briefing-copy h2", ".briefing-copy p", ".briefing-facts", ".briefing-setup"]
      .map((sel) => briefing.querySelector(sel)?.getBoundingClientRect()).filter((r) => r && r.width);
    const taken = [], list = worlds();
    const hit = (a, b) => a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 6 && a.bottom > b.top - 6;
    // The other worlds' discs and the squad's figures are art the labels must not cover.
    const discs = list.map((w) => ({ id: w.id, left: w.x - w.r + frame.box.left, right: w.x + w.r + frame.box.left, top: w.y - w.r + frame.box.top, bottom: w.y + w.r + frame.box.top }));
    const squad = images.get("foreground-squad")?.getBoundingClientRect() || (() => {
      const [x, y, w, h] = layerBox(LAYERS.find((l) => l[6] === "squad"), frame.shape), [sx, sy] = toScreen(x, y - squadLift());
      return { left: sx + frame.box.left, top: sy + frame.box.top, right: sx + w * frame.s + frame.box.left, bottom: sy + h * frame.s + frame.box.top };
    })();
    const figures = { left: squad.left + (squad.right - squad.left) * 0.08, right: squad.right, top: squad.top, bottom: squad.bottom };
    for (const el of labels.children) {
      const p = list.find((d) => d.id === el.dataset.world);
      el.hidden = true;
      if (!p || briefing.classList.contains("campaign-view") || p.r < 16 || (compact && taken.length >= 2)) continue;
      // A world whose centre is under the panel or the briefing gets no tag (it would float unattached).
      const cx = p.x + frame.box.left, cy = p.y + frame.box.top;
      if (avoid.some((a) => cx > a.left && cx < a.right && cy > a.top && cy < a.bottom)) continue;
      el.hidden = false;
      const width = el.offsetWidth;
      // Upper right of the world first, then upper left.
      for (const [lx, ly] of [[p.x + p.r * 0.72 + 8, p.y - p.r * 0.72 - 10], [p.x - p.r * 0.72 - 8 - width, p.y - p.r * 0.72 - 10]]) {
        el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
        const r = el.getBoundingClientRect(), box = frame.box;
        const off = r.left < box.left + 4 || r.top < box.top + 4 || r.right > box.right - 4 || r.bottom > box.bottom - 4;
        const blocked = off || avoid.some((a) => hit(r, a)) || taken.some((t) => hit(r, t)) || hit(r, figures) || discs.some((d) => d.id !== p.id && hit(r, d));
        if (!blocked) { taken.push(r); el.hidden = false; break; }
        el.hidden = true;
      }
      if (el.hidden) continue;
    }
  }

  // ---------- the canvas layer ----------
  const ctx = canvas.getContext("2d");
  const rand = seeded(907);
  const stars = Array.from({ length: 70 }, () => ({ x: rand(), y: rand() * 0.7, s: 0.8 + rand() * rand() * 1.8, a: 0.3 + rand() * 0.6, f: 0.6 + rand() * 2.4, p: rand() * 6.28 }));
  const fx = seeded(1907);
  let streaks = [], flashes = [], nextStreak = 1.2, nextFlash = 0.4, nextBolt = 2, last = 0, time = 0, running = false;
  const active = () => !document.hidden && !briefing.hidden && root.classList.contains("in-briefing");

  function spawnStreak() {
    const fromLeft = fx() < 0.5;
    streaks.push({ x: fromLeft ? -0.1 : 1.1, y: 0.06 + fx() * 0.4, vx: (fromLeft ? 1 : -1) * (0.35 + fx() * 0.35), vy: (fx() - 0.5) * 0.08, life: 0, len: 0.06 + fx() * 0.08, hue: fx() < 0.7 ? "127,232,255" : "255,196,110" });
  }
  function spawnFlash() {
    const list = worlds().filter((w) => w.id !== "storm" && w.r > 12);
    if (!list.length) return;
    const total = list.reduce((sum, w) => sum + w.r, 0);
    let pick = fx() * total, w = list[0];
    for (const c of list) { pick -= c.r; if (pick <= 0) { w = c; break; } }
    const angle = fx() * 6.283, dist = Math.sqrt(fx()) * 0.8;
    flashes.push({ x: w.x + Math.cos(angle) * w.r * dist, y: w.y + Math.sin(angle) * w.r * dist, life: 0, dur: 0.45 + fx() * 0.5, size: Math.max(5, w.r * 0.08) + fx() * 6, c: FLASH_COLOURS[Math.floor(fx() * FLASH_COLOURS.length)] });
  }
  function spawnBolt() {
    // Lightning: on the storm world, or along the far horizon.
    const storm = worlds().find((w) => w.id === "storm");
    if (storm && fx() < 0.55) {
      const a = fx() * 6.283, d = Math.sqrt(fx()) * 0.7;
      flashes.push({ x: storm.x + Math.cos(a) * storm.r * d, y: storm.y + Math.sin(a) * storm.r * d, life: 0, dur: 0.28, size: storm.r * 0.35, c: "190,225,255", bolt: true });
    } else if (frame) {
      const h = LAYERS.find((l) => l[0] === "storm-horizon"), [x, y, w] = layerBox(h, frame.shape);
      const [sx, sy] = toScreen(x + w * (0.05 + fx() * 0.4), y + 20);
      flashes.push({ x: sx, y: sy, life: 0, dur: 0.3, size: 140 * frame.s, c: "180,220,255", bolt: true });
    }
  }

  function draw(dt) {
    if (!frame) return;
    const dpr = canvas.width / frame.box.width, W = frame.box.width, H = frame.box.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    time += dt;
    for (const s of stars) {
      const x = (((s.x - time * 0.002 * s.s) % 1) + 1) % 1 * W, y = s.y * H;
      const a = s.a * (0.5 + 0.5 * Math.sin(time * s.f + s.p));
      ctx.fillStyle = `rgba(215,238,255,${a})`;
      ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
      if (s.s > 2) { ctx.fillStyle = `rgba(200,240,255,${a * 0.35})`; ctx.fillRect(x - s.s * 1.6, y - 0.5, s.s * 3.2, 1); ctx.fillRect(x - 0.5, y - s.s * 1.6, 1, s.s * 3.2); }
    }
    ctx.globalCompositeOperation = "lighter";
    nextFlash -= dt;
    if (nextFlash <= 0) { spawnFlash(); nextFlash = 0.4 + fx() * 1.4; }
    nextBolt -= dt;
    if (nextBolt <= 0) { spawnBolt(); nextBolt = 1.6 + fx() * 3.5; }
    flashes = flashes.filter((f) => (f.life += dt) < f.dur);
    for (const f of flashes) {
      const k = f.life / f.dur, r = f.size * (f.bolt ? 1 : 0.4 + k);
      const alpha = f.bolt ? (k < 0.2 ? 1 : k < 0.35 ? 0.3 : k < 0.5 ? 0.85 : 1 - k) * 0.8 : (1 - k) * (k < 0.15 ? k / 0.15 : 1);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,252,240,${alpha})`); g.addColorStop(0.25, `rgba(${f.c},${alpha * 0.7})`); g.addColorStop(1, `rgba(${f.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }
    nextStreak -= dt;
    if (nextStreak <= 0) { spawnStreak(); nextStreak = 2.5 + fx() * 4.5; }
    streaks = streaks.filter((s) => (s.life += dt) < 4 && s.x > -0.3 && s.x < 1.3);
    for (const s of streaks) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      const x = s.x * W, y = s.y * H, tx = x - Math.sign(s.vx) * s.len * W, ty = y - s.vy / Math.abs(s.vx) * s.len * W;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, `rgba(${s.hue},0)`); g.addColorStop(1, `rgba(${s.hue},0.9)`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function tick(now) {
    if (!active() || calm()) { running = false; wake(); return; }
    // Touch devices: 30 fps is plenty for drift and twinkle, and saves battery.
    if (root.classList.contains("touch-ui") && last && now - last < 30) { requestAnimationFrame(tick); return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    draw(dt);
    moveLayers(time);
    requestAnimationFrame(tick);
  }
  function still() {
    // Calm: the flat cover and one quiet frame of stars; no flashes, streaks or moving layers.
    flashes = []; streaks = []; nextFlash = nextStreak = nextBolt = 1e9;
    draw(0);
    nextFlash = 0.4; nextStreak = 1.2; nextBolt = 2;
  }
  function wake() {
    if (!active()) return;
    measure();
    const svg = briefing.querySelector(".title-brand svg");
    const quiet = calm();
    briefing.classList.toggle("cover-live", !quiet);
    stack.classList.toggle("calm", quiet);
    if (quiet) { svg?.pauseAnimations?.(); still(); return; }
    svg?.unpauseAnimations?.();
    // The layers wait for the game's own models, then for an idle moment.
    if (booted && layersState === "idle") (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => loadLayers(), { timeout: 2500 });
    if (!running) { running = true; last = 0; requestAnimationFrame(tick); }
  }

  // Pointer parallax on desktop.
  briefing.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    pointer = [event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5];
  }, { passive: true });

  // ---------- loading card: mirrors #start (aria-busy, --load, label) ----------
  const start = $("start"), pct = loading.querySelector(".cover-load-pct"), stage = loading.querySelector(".cover-load-stage");
  let booted = false;
  // The loading screen shows the flat cover behind its ring. It takes the URL only once the <img> has finished
  // loading: set while the image is still in flight (slow machines), the CSS background starts a second
  // download of the same file. Once loaded, the background is served from the image already in memory.
  function coverArt() {
    if (art?.complete && art.naturalWidth && art.currentSrc && !loading.style.getPropertyValue("--cover-art")) loading.style.setProperty("--cover-art", `url("${art.currentSrc}")`);
  }
  art?.addEventListener("load", coverArt);
  function syncLoading() {
    coverArt();
    const busy = start.getAttribute("aria-busy") === "true";
    // Once a load ends the card fades with its last numbers (100%), never back to 0%.
    if (!busy && booted) { loading.classList.remove("on"); return; }
    const value = busy ? parseFloat(start.style.getPropertyValue("--load")) || 0 : start.disabled ? 0 : 100;
    loading.style.setProperty("--load", String(value));
    pct.textContent = `${Math.round(value)}%`;
    const label = start.textContent.replace(/\s*\d+%\s*$/, "").trim();
    if (busy && label && stage.textContent !== label) stage.textContent = label;
    // The loading screen fades out whole, then becomes the small card for later roster loads.
    if (!busy && !start.disabled && !booted) { booted = true; setTimeout(() => loading.classList.remove("boot"), 450); wake(); }
    loading.classList.toggle("on", busy || !booted);
  }
  new MutationObserver(syncLoading).observe(start, { attributes: true, attributeFilter: ["aria-busy", "style", "disabled"], childList: true, characterData: true, subtree: true });
  syncLoading();

  // ---------- UI blips (hover and confirm) on the menu cards ----------
  const cards = "#briefing .mode-switch button, #start, #continue, #title-actions button";
  briefing.addEventListener("pointerover", (event) => {
    const button = event.target.closest?.(cards);
    if (!button || button.disabled || event.pointerType !== "mouse" || button.contains(event.relatedTarget)) return;
    A.tone?.(1180, 0.035);
  });
  briefing.addEventListener("click", (event) => {
    const button = event.target.closest?.(cards);
    if (button && !button.disabled) A.tone?.(button.id === "start" ? 740 : 880, 0.07);
  });

  addEventListener("resize", () => requestAnimationFrame(measure));
  document.addEventListener("visibilitychange", wake);
  art?.addEventListener("load", wake);
  // Settings changes toggle :root.motion-off / .compact-ui; the reduced-motion preference can change live.
  new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ["class"] });
  reduced.addEventListener?.("change", wake);
  new MutationObserver(wake).observe(briefing, { attributes: true, attributeFilter: ["hidden", "class"] });
  requestAnimationFrame(wake);
  return { measure, wake, frame: () => frame, layers: () => layersState };
}
