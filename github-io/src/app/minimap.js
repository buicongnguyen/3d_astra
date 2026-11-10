// Minimap drawing, remembered buildings and deposits, and minimap clicks.
import { $ } from "./dom.js";
import { surfaceColors } from "../ground-paint.js";
import { teamColors } from "../faction-colors.js";

const OWN_PING_SECONDS = 2.5;

export function setupMinimap(S, A) {
  let minimapBase = null,
    minimapFog = null;

  function minimap() {
    const {size:MAP_SIZE,half:HALF,grid:GRID}=S.sim.terrain;
    const c = $("minimap"),
      ctx = c.getContext("2d"),
      w = c.width,
      h = c.height,
      px = (x) => ((x + HALF) / MAP_SIZE) * w,
      pz = (z) => ((z + HALF) / MAP_SIZE) * h;
    // Terrain and road depend only on the map: paint them once per terrain into an offscreen canvas.
    if (minimapBase?.terrain !== S.sim.terrain || minimapBase.canvas.width !== w || minimapBase.canvas.height !== h) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const b = canvas.getContext("2d");
      // The same surface colours as the battlefield (visual-style.json), on every map.
      const surfaces = surfaceColors(S.sim.terrain.id);
      b.fillStyle = surfaces.dirt;
      b.fillRect(0, 0, w, h);
      if (S.sim.terrain.id !== "classic")
        for (let z = 0; z < GRID; z++)
          for (let x = 0; x < GRID; x++) {
            b.fillStyle =
              surfaces[S.sim.terrain.at(x * 2 - HALF + 1, z * 2 - HALF + 1)];
            b.fillRect((x * w) / GRID, (z * h) / GRID, w / GRID + 1, h / GRID + 1);
          }
      b.strokeStyle = surfaces.road;
      b.lineWidth = 9;
      b.beginPath();
      b.moveTo(px(-25), pz(24));
      b.lineTo(px(25), pz(-24));
      if (S.sim.terrain.id === "classic") b.stroke();
      minimapBase = { terrain: S.sim.terrain, canvas };
    }
    ctx.drawImage(minimapBase.canvas, 0, 0);
    for (const wall of S.sim.entities) {
      if (wall.kind !== "wall" || wall.hp <= 0) continue;
      ctx.fillStyle = "#8d8a80";
      ctx.beginPath();
      ctx.arc(px(wall.x), pz(wall.z), (wall.radius / MAP_SIZE) * w, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fog is one pixel per cell, scaled up in a single draw instead of a fillRect per cell.
    if (minimapFog?.grid !== GRID) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = GRID;
      const fctx = canvas.getContext("2d");
      minimapFog = { grid: GRID, canvas, fctx, image: fctx.createImageData(GRID, GRID) };
    }
    const fogPx = minimapFog.image.data;
    for (let i = 0; i < GRID * GRID; i++) {
      const o = i * 4;
      if (S.sim.visible[0][i]) fogPx[o + 3] = 0;
      else if (S.sim.explored[0][i]) { fogPx[o] = 8; fogPx[o + 1] = 20; fogPx[o + 2] = 19; fogPx[o + 3] = 115; }
      else { fogPx[o] = 17; fogPx[o + 1] = 31; fogPx[o + 2] = 32; fogPx[o + 3] = 255; }
    }
    minimapFog.fctx.putImageData(minimapFog.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(minimapFog.canvas, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    // Capture points: a ring in the owner's colour (grey while neutral) and the taker's progress.
    for (const p of Object.values(S.sim.mission?.points || S.sim.skirmishPoints || {})) {
      const cx = px(p.x), cy = pz(p.z), radius = Math.max(4.5, (p.r / MAP_SIZE) * w), owned = p.owner !== null && p.owner !== undefined;
      ctx.lineWidth = 2;
      ctx.strokeStyle = ctx.fillStyle = owned ? teamColors(S.settings, S.mission)[p.owner] : "#d3dadb";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      if (owned) { ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.stroke();
      if (p.taker !== null && p.taker !== undefined) {
        ctx.strokeStyle = teamColors(S.settings, S.mission)[p.taker];
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.since / 5));
        ctx.stroke();
      }
    }
    for (const r of S.sim.resources) {
      if (S.sim.isVisible(r)) S.rememberedResources.set(r.id, r.amount);
      if (S.rememberedResources.get(r.id) > 0 && S.sim.isExplored(r)) {
        ctx.fillStyle = r.type === "alloy" ? "#ddb268" : "#79cde3";
        ctx.fillRect(px(r.x) - 2, pz(r.z) - 2, 4, 4);
      }
    }
    for (const e of S.sim.entities)
      if (e.team !== 0 && e.kind === "building" && S.sim.isVisible(e))
        S.rememberedBuildings.set(e.id, { x: e.x, z: e.z, radius: e.radius, team: e.team });
    for (const [id, e] of S.rememberedBuildings) {
      if (S.sim.players[e.team]?.eliminated || (S.sim.isVisible(e) && !S.sim.get(id))) {
        S.rememberedBuildings.delete(id);
        continue;
      }
      if (!S.sim.isVisible(e)) {
        ctx.fillStyle = teamColors(S.settings, S.mission)[e.team];
        ctx.globalAlpha = 0.45;
        ctx.fillRect(px(e.x) - 3, pz(e.z) - 3, 6, 6);
        ctx.globalAlpha = 1;
      }
    }
    const teams = teamColors(S.settings, S.mission);
    for (const e of S.sim.entities)
      if (e.team >= 0 && S.sim.isVisible(e)) {
        ctx.fillStyle = teams[e.team];
        const r = e.kind === "building" ? 3.5 : S.selected.has(e.id) ? 2.5 : 1.6;
        ctx.beginPath();
        if (e.team === 0) ctx.arc(px(e.x), pz(e.z), r, 0, Math.PI * 2);
        else {
          ctx.moveTo(px(e.x), pz(e.z) - r - 1);
          ctx.lineTo(px(e.x) + r + 1, pz(e.z));
          ctx.lineTo(px(e.x), pz(e.z) + r + 1);
          ctx.lineTo(px(e.x) - r - 1, pz(e.z));
          ctx.closePath();
        }
        ctx.fill();
      }
    for (let i = S.pings.length - 1; i >= 0; i--) {
      const ping = S.pings[i], age = S.sim.time - ping.at;
      if (!(age >= 0 && age < (ping.own ? OWN_PING_SECONDS : 6))) { S.pings.splice(i, 1); continue; }
      const pulse = (performance.now() / 900) % 1;
      if (ping.own) {
        // The player's own marker: cool colour, two ripples, fades out over its short life.
        const fade = 1 - age / OWN_PING_SECONDS;
        if (fade <= 0) { S.pings.splice(i, 1); continue; }
        ctx.strokeStyle = "#8fe8ff";
        ctx.lineWidth = 2;
        for (const phase of [pulse, (pulse + 0.5) % 1]) {
          ctx.globalAlpha = fade * (1 - phase * 0.7);
          ctx.beginPath();
          ctx.arc(px(ping.x), pz(ping.z), 3 + phase * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "#8fe8ff";
        ctx.globalAlpha = fade;
        ctx.fillRect(px(ping.x) - 1.5, pz(ping.z) - 1.5, 3, 3);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.strokeStyle = "#ff8a6a";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - pulse * 0.75;
      ctx.beginPath();
      ctx.arc(px(ping.x), pz(ping.z), 4 + pulse * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(218,239,219,.7)";
    ctx.lineWidth = 1;
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    ctx.beginPath();
    for (const [i, [x, y]] of [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ].entries()) {
      const p = S.view.point(x, y);
      if (p) {
        if (!i) ctx.moveTo(px(p.x), pz(p.z));
        else ctx.lineTo(px(p.x), pz(p.z));
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  function bindMinimapInput() {
    const mapPoint = (e) => {
      const {size:MAP_SIZE,half:HALF}=S.sim.terrain;
      const r = $("minimap").getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * MAP_SIZE - HALF,
        z: ((e.clientY - r.top) / r.height) * MAP_SIZE - HALF,
      };
    };
    // Your own ping: visible to you only, client-side (the simulation never sees it).
    const ping = (p) => {
      let own = 0;
      for (let i = S.pings.length - 1; i >= 0; i--) if (S.pings[i].own && ++own >= 4) S.pings.splice(i, 1);
      S.pings.push({ x: p.x, z: p.z, at: S.sim.time, own: true });
      A.tone(700, 0.08);
    };
    // Dragging the map moves the camera along with the finger or pointer (not while aiming an order).
    let drag = null, dragged = 0, lastTap = null;
    const mm = $("minimap");
    mm.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || S.mode || !S.screen.started) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    });
    mm.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      if (!drag.moved) { drag.moved = true; try { mm.setPointerCapture(e.pointerId); } catch { /* Capture is optional. */ } }
      const p = mapPoint(e);
      S.cameraPan = null;
      S.view.focusOn(p.x, p.z);
    });
    const endDrag = (e) => {
      if (drag && e.pointerId === drag.id) { if (drag.moved) dragged = performance.now(); drag = null; }
    };
    mm.addEventListener("pointerup", endDrag);
    mm.addEventListener("pointercancel", endDrag);
    // Use a click target so Chrome's touch adjustment recognizes the whole map
    // instead of redirecting taps near its corners to the neighboring Home button.
    $("minimap").addEventListener("click", (e) => {
      if (performance.now() - dragged < 80) return;
      if (e.button === 0) {
        const p = mapPoint(e);
        if (!S.mode && (e.altKey || (lastTap && performance.now() - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 16))) {
          lastTap = null;
          ping(p);
          return;
        }
        lastTap = { t: performance.now(), x: e.clientX, y: e.clientY };
        if (S.mode === "barrage") A.fireBarrage(p);
        else if (S.mode && S.mode !== "build") {
          if (A.commandAt(p, null, e.shiftKey||S.queueOrders, S.mode) !== false) A.clearMode();
        } else S.view.focusOn(p.x, p.z);
      }
    });
    $("minimap").addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (e.pointerType === "touch") return;
      if(S.mode){A.clearMode();return;}
      const p = mapPoint(e);
      if (!S.selected.size) { ping(p); return; }
      A.commandAt(p, null, e.shiftKey||S.queueOrders);
    });
  }

  Object.assign(A, { bindMinimapInput, minimap });
  return function bind() {};
}
