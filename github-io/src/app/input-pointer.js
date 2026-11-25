// Mouse and touch input: hover, drag boxes, taps, camera drag and the touch buttons.
import { $ } from "./dom.js";
import { placeOnGround, GHOST_LIFT } from "../ground-y.js";
import { FACTIONS } from "../story/world.js";
import { isTouchPointer, TouchControls } from "../touch-controls.js";
import { CROSSING_TEXT, HIGH_GROUND_TEXT, crossingAt, onHighGround } from "../terrain-labels.js";

export function setupInputPointer(S, A) {
  const Z = S.screen;
  // The HUD follows the last pointer used: touch brings the touch HUD, a mouse (or a pen beside
  // a fine pointer) the desktop one. Browsers send mouse events after a touch; those are ignored.
  const finePointer = matchMedia("(any-pointer: fine)");

  const isTouch = (e) => isTouchPointer(e, finePointer.matches);

  function setInputMode(touch) {
    if (S.touchInput === touch) return;
    S.touchInput = touch;
    if (S.mode === "build") $("confirm-build").hidden = !touch;
    S.lastSelectionKey = "";
    A.setLayout();
  }

  // Hover picking raycasts every visible model: at most once a frame, and only after the pointer
  // or the camera moved.
  let hoverCamera = "";

  function refreshHover() {
    if (!S.hoverPoint) return;
    const camera = `${S.view.focus.x},${S.view.focus.z},${S.view.zoom},${S.view.width},${S.view.height}`;
    if (!S.hoverStale && camera === hoverCamera) return;
    S.hoverStale = false;
    hoverCamera = camera;
    const { x, y } = S.hoverPoint;
    S.hover = S.view.pick(x, y, S.sim);
    // Nothing under the pointer: a river crossing still gets a short label.
    const ground = !S.hover && !S.drag && !S.mode ? groundLabel(S.view.point(x, y)) : "";
    $("hover-label").hidden = (!S.hover && !ground) || !!S.drag || !!S.mode;
    if ((S.hover || ground) && !S.drag && !S.mode) {
      $("hover-label").textContent = S.hover ? labelFor(S.hover) : ground;
      const rect = S.view.renderer.domElement.getBoundingClientRect();
      $("hover-label").style.left = `${Math.min(x - rect.left + 16, S.view.width - 240)}px`;
      $("hover-label").style.top = `${y - rect.top + 20}px`;
    }
  }

  function drawTouchBox(p) {
    if (!p) {
      $("selection-box").style.display = "none";
      return;
    }
    const rect = $("stage").getBoundingClientRect();
    Object.assign($("selection-box").style, {
      display: "block",
      left: `${Math.min(p.startX, p.x) - rect.left}px`,
      top: `${Math.min(p.startY, p.y) - rect.top}px`,
      width: `${Math.abs(p.x - p.startX)}px`,
      height: `${Math.abs(p.y - p.startY)}px`,
    });
  }

  function selectTouchBox(p) {
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    const ids = S.sim
      .own(0)
      .filter((e) => {
        if (e.kind !== "unit") return false;
        const point = S.view.project(e.x, e.z, S.view.liftOf(e)),
          x = point.x + rect.left,
          y = point.y + rect.top;
        return (
          x >= Math.min(p.startX, p.x) &&
          x <= Math.max(p.startX, p.x) &&
          y >= Math.min(p.startY, p.y) &&
          y <= Math.max(p.startY, p.y)
        );
      })
      .map((e) => e.id);
    A.setSelection(ids);
    S.boxSelection = false;
    $("box-select").setAttribute("aria-pressed", "false");
  }

  // Touch picking (owner, 2026-11-24): a fingertip covers a Medic at default zoom, so a tap within
  // TOUCH_PICK px of one of your units picks it before the ground, a building or an enemy, and tapping the
  // same spot again steps through the units standing there. A tap right on an enemy with units selected
  // still attacks, and a tap right on a damaged building with Harvesters selected still repairs it.
  const TOUCH_PICK = 26;
  let tapCycle = null;
  function touchTarget(x, y) {
    let target = S.view.pick(x, y, S.sim, 24);
    if (S.mode && S.mode !== "support") return target;
    const near = S.view.ownUnitsNear(x, y, S.sim, TOUCH_PICK);
    if (!near.length) return target;
    const direct = S.view.pickDirect && target;
    const workers = A.selectedEntities().some((e) => e.type === "worker");
    if (direct && S.selected.size && target.team > 0 && target.kind === "unit") return target;
    if (direct && workers && target.team === 0 && target.kind === "building" && (!target.complete || target.hp < target.maxHp || target.type === "hq")) return target;
    if (direct && target.team === 0 && target.kind === "unit") { const i = near.indexOf(target); if (i > 0) near.unshift(...near.splice(i, 1)); else if (i < 0) near.unshift(target); }
    const now = performance.now(), again = tapCycle && Math.hypot(tapCycle.x - x, tapCycle.y - y) <= 16 && now - tapCycle.time < 2500 && near.some((e) => e.id === tapCycle.id);
    target = again ? near[(near.findIndex((e) => e.id === tapCycle.id) + 1) % near.length] : near[0];
    tapCycle = { x, y, time: now, id: target.id };
    return target;
  }

  function touchTap(x, y) {
    const point = S.view.point(x, y),
      target = touchTarget(x, y);
    if (!point) return;
    if (S.mode === "build") {
      A.showBuildPoint(point);
      return;
    }
    if (S.mode === "barrage") {
      A.fireBarrage(point);
      return;
    }
    if (S.mode === "weather") { A.fireWeather(point); return; }
    if (S.mode) {
      if (A.commandAt(point, ["support","context","attack","attackmove","repair","rally"].includes(S.mode) ? target : null, S.queueOrders, S.mode) !== false) A.clearMode();
      return;
    }
    if (A.defenceTap?.(x, y)) return;
    if (S.boxSelection) {
      if (target?.team === 0) A.setSelection([...S.selected, target.id]);
      return;
    }
    if (target?.team === 0) {
      const workers = A.selectedEntities().filter((e) => e.type === "worker");
      if (
        workers.length &&
        (!target.complete ||
          (target.type === "hq" && workers.some((e) => e.carry > 0)) ||
          (target.kind === "building" && target.hp < target.maxHp))
      )
        A.commandAt(point, target, S.queueOrders);
      else A.setSelection([target.id]);
    } else if (S.selected.size) A.commandAt(point, target, S.queueOrders);
    // Touch has no hover: a tap on an enemy with nothing selected names it.
    else if (target && target.team > 0) A.notice(labelFor(target));
    else if (target?.kind === "resource")
      A.notice(
        `${target.type.toUpperCase()} · ${Math.floor(target.amount)} remaining. Select Harvesters to gather.`,
      );
    else A.notice(groundLabel(point) || "Select a unit, or use the Workers and Army buttons.");
  }

  let edgeProbe = null;
  function bindInput() {
    const canvas = S.view.renderer.domElement;
    S.touchControls = new TouchControls(canvas, {
      enabled: () => Z.started && !Z.paused && !S.sim.result,
      // Phones draw the battlefield to the screen edges (phone-hud.css) but keep the gesture margins in the
      // input: a touch starting within --gesture-left/right of a side or --safe-bottom of the bottom is left
      // to the system (back swipe, home bar), as when the canvas stopped short of the edges.
      inEdge: (e) => {
        if (!document.documentElement.classList.contains("compact-ui")) return false;
        // The margins are max()/env() expressions: a hidden probe resolves them to pixels.
        if (!edgeProbe) {
          edgeProbe = document.createElement("i");
          edgeProbe.setAttribute("aria-hidden", "true");
          edgeProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:0 var(--gesture-right, 0px) var(--safe-bottom, 0px) var(--gesture-left, 0px)";
          document.body.append(edgeProbe);
        }
        const m = getComputedStyle(edgeProbe), px = (v) => parseFloat(v) || 0;
        return e.clientX < px(m.paddingLeft) || e.clientX > innerWidth - px(m.paddingRight) || e.clientY > innerHeight - px(m.paddingBottom);
      },
      boxMode: () => S.boxSelection && !S.mode,
      isTouch,
      activate: () => {
        A.unlockAudio();
        S.lastTouch = performance.now();
        setInputMode(true);
        S.pointer.inside = false;
        S.hover = S.hoverPoint = null;
        $("hover-label").hidden = true;
      },
      tap: touchTap,
      box: selectTouchBox,
      rectangle: drawTouchBox,
      panZoom: (dx, dy, ratio) => {
        S.view.screenPan(
          (-dx * S.view.unitsPerPixel),
          (dy * S.view.unitsPerPixel),
        );
        if (ratio !== 1) S.view.zoomBy(S.view.zoom * (ratio - 1) * (S.settings.zoomSpeed || 1)); // Settings → Camera → Zoom sensitivity
      },
    });
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (e.pointerType === "touch") return;
      S.drag=null;$("selection-box").style.display="none";
      if (S.mode) {
        A.clearMode();
        return;
      }
      A.commandAt(
        S.view.point(e.clientX, e.clientY),
        S.view.pick(e.clientX, e.clientY, S.sim),
        e.shiftKey || S.queueOrders,
      );
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (isTouch(e)) return;
      A.unlockAudio();
      if (![0,1].includes(e.button) || !Z.started || Z.paused || S.sim.result) return;
      canvas.setPointerCapture(e.pointerId);
      S.drag = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        button: e.button,
      };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (isTouch(e)) return;
      S.pointer = { x: e.clientX, y: e.clientY, inside: true };
      S.hoverPoint = { x: e.clientX, y: e.clientY };
      S.hoverStale = true;
      if (S.drag?.button === 1) {
        S.view.screenPan(
          (-(e.clientX - S.drag.lastX) * S.view.unitsPerPixel),
          ((e.clientY - S.drag.lastY) * S.view.unitsPerPixel),
        );
        S.drag.lastX = e.clientX;
        S.drag.lastY = e.clientY;
      } else if (
        S.drag &&
        !S.mode &&
        Math.hypot(e.clientX - S.drag.x, e.clientY - S.drag.y) > 6
      ) {
        const rect = $("stage").getBoundingClientRect();
        Object.assign($("selection-box").style, {
          display: "block",
          left: `${Math.min(e.clientX, S.drag.x) - rect.left}px`,
          top: `${Math.min(e.clientY, S.drag.y) - rect.top}px`,
          width: `${Math.abs(e.clientX - S.drag.x)}px`,
          height: `${Math.abs(e.clientY - S.drag.y)}px`,
        });
      }
      if (S.mode === "barrage") A.refreshAim(S.view.point(e.clientX, e.clientY));
      if (S.mode === "weather") A.aimWeather(S.view.point(e.clientX, e.clientY));
      if (S.mode === "build") {
        const aim = S.view.point(e.clientX, e.clientY),
          p = aim && (S.sim.findPlacement(S.buildType, 0, aim.x, aim.z) || aim);
        if (p) {
          S.view.preview.visible = true;
          placeOnGround(S.view.preview, S.view.terrain, p.x, p.z, GHOST_LIFT);
          S.view.preview.material.color.setHex(
            S.sim.placement(S.buildType, 0, p.x, p.z) ? 0xef7660 : 0x92ebc5,
          );
        }
      }
    });
    canvas.addEventListener("pointerleave", () => {
      if (S.mode === "barrage" && !S.touchInput) A.refreshAim(null);
      S.pointer.inside = false;
      S.hover = S.hoverPoint = null;
      $("hover-label").hidden = true;
    });
    // The footer and the desktop console cover the canvas's bottom edge. Track hover there so
    // screen-edge scrolling works along the whole border (as in StarCraft), without passing
    // clicks through the UI or scrolling while a button is under the pointer.
    for (const hud of [document.querySelector(".statusbar"), document.querySelector(".bottom-dock")]) {
      hud.addEventListener("pointermove", (e) => {
        if (isTouch(e)) return;
        S.pointer = { x: e.clientX, y: e.clientY, inside: !e.target.closest("button") };
      });
      hud.addEventListener("pointerleave", () => { S.pointer.inside = false; });
    }
    canvas.addEventListener("pointerup", (e) => {
      if (isTouch(e)) return;
      if (!S.drag) return;
      const old = S.drag;
      S.drag = null;
      $("selection-box").style.display = "none";
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      if (old.button !== 0 || e.button!==0 || Z.paused || !Z.started || S.sim.result) return;
      const dragged = Math.hypot(e.clientX - old.x, e.clientY - old.y) > 6;
      // A click must land on the map itself; a drag box may end over the dock or the minimap
      // (players often release there) and still selects what it covers.
      if ((!dragged || S.mode) && document.elementFromPoint(e.clientX,e.clientY)!==canvas) return;
      const point = S.view.point(e.clientX, e.clientY);
      if (S.mode === "build" && point) {
        A.confirmBuild(S.sim.findPlacement(S.buildType, 0, point.x, point.z) || point);
        return;
      }
      if (S.mode === "barrage") {
        A.fireBarrage(point);
        return;
      }
      if (S.mode === "weather") { A.fireWeather(point); return; }
      if (S.mode) {
        if (A.commandAt(point, ["support","context","attack","attackmove","repair","rally"].includes(S.mode) ? S.view.pick(e.clientX,e.clientY,S.sim) : null, e.shiftKey||S.queueOrders, S.mode) !== false) A.clearMode();
        return;
      }
      if (!dragged && A.defenceTap?.(e.clientX, e.clientY)) return;
      const next = e.shiftKey ? new Set(S.selected) : new Set();
      if (dragged) {
        const rect = canvas.getBoundingClientRect();
        for (const u of S.sim.own(0).filter((u) => u.kind === "unit")) {
          const p = S.view.project(u.x, u.z, S.view.liftOf(u));
          const x = p.x + rect.left,
            y = p.y + rect.top;
          if (
            x >= Math.min(old.x, e.clientX) &&
            x <= Math.max(old.x, e.clientX) &&
            y >= Math.min(old.y, e.clientY) &&
            y <= Math.max(old.y, e.clientY)
          )
            next.add(u.id);
        }
      } else {
        const target = S.view.pick(e.clientX, e.clientY, S.sim);
        if (target?.team === 0) {
          if(e.ctrlKey && target.kind==='unit'){A.selectScreenType(target,e.shiftKey);return;}
          if (e.shiftKey && next.has(target.id)) next.delete(target.id);
          else next.add(target.id);
        }
      }
      A.setSelection(next);
    });
    canvas.addEventListener("dblclick", (e) => {
      if (!Z.started || Z.paused || S.sim.result || S.mode || e.ctrlKey) return;
      const target = S.view.pick(e.clientX, e.clientY, S.sim);
      if (target?.team === 0 && target.kind === "unit")
        A.selectScreenType(target,e.shiftKey);
    });
    canvas.addEventListener("pointercancel", () => {
      S.drag = null;
      S.pointer.inside = false;
      $("selection-box").style.display = "none";
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        S.view.zoomBy(Math.sign(e.deltaY) * 2.5 * (S.settings.zoomSpeed || 1));
      },
      { passive: false },
    );
    A.bindKeyboard();
    A.bindMinimapInput();
  }

  // What the pointer is on: a deposit and its stock, or a unit or building, with the enemy's faction when it has one.
  // A unit or tower on a plateau top adds what high ground gives it (src/terrain-labels.js).
  function labelFor(e) {
    if (e.kind === "resource") return `${e.type.toUpperCase()} · ${Math.floor(e.amount)}`;
    const high = onHighGround(S.sim.terrain, e) ? ` · ${HIGH_GROUND_TEXT}` : "";
    if (!(e.team > 0)) return `${e.name}${high}`;
    const id = S.sim.missionDef?.factions?.[e.team] || S.sim.factions?.[e.team];
    // A Meridian enemy is named too once the player commands another faction.
    const faction = id && (id !== "meridian" || (S.sim.factions?.[0] || "meridian") !== "meridian") ? FACTIONS[id]?.short : null;
    return `${e.name}${faction ? ` · ${faction}` : ""} · ENEMY${high}`;
  }
  // The ground itself: only river crossings have something to say.
  function groundLabel(p) {
    const c = p && crossingAt(S.sim.terrain, p.x, p.z);
    return c ? CROSSING_TEXT[c.type] : "";
  }
  Object.assign(A, { refreshHover, bindInput });
  return function bind() {
    for (const type of ["pointerdown", "pointermove"])
      window.addEventListener(type, (e) => {
        if (isTouch(e)) S.lastTouch = performance.now();
        else if (S.touchInput && finePointer.matches && performance.now() - S.lastTouch > 800) setInputMode(false);
      }, { capture: true, passive: true });

    $("box-select").onclick = () => {
      A.clearMode();
      S.boxSelection = !S.boxSelection;
      $("box-select").setAttribute("aria-pressed", String(S.boxSelection));
      A.notice(
        S.boxSelection
          ? "Drag a box around your units. Tap Box again to return to panning."
          : "Drag to pan the battlefield.",
      );
    };

    $("queue-orders").onclick = () => {
      S.queueOrders = !S.queueOrders;
      $("queue-orders").setAttribute("aria-pressed", String(S.queueOrders));
      A.notice(
        S.queueOrders
          ? "New commands will be queued."
          : "New commands replace existing orders.",
      );
    };

    $("zoom-in").onclick = () => S.view.zoomBy(-4);

    $("zoom-out").onclick = () => S.view.zoomBy(4);
  };
}
