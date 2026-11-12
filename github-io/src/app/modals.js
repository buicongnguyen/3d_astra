// Pause, help, full screen, graphics-lost and field-guide dialogs, and the modal shell.
import { $ } from "./dom.js";
import { HOTKEY_HELP } from "../hotkeys.js";
import { createFieldGuide } from "../field-guide.js";
import { createFullscreen } from "../fullscreen.js";
import { icon } from "../icons.js";

export function setupModals(S, A) {
  const Z = S.screen;
  // One place to show/hide the modal: inert the HUD behind it and restore focus on close.
  let modalReturnFocus = null;

  function setModalOpen(open) {
    // The top bar is a sibling of the modal: everything in it goes inert except sound, Help and Pause.
    const modal = $("modal"), main = document.querySelector("main");
    modal.classList.remove("debrief-wide", "result-wide");
    const behind = [main, document.querySelector(".brand"), document.querySelector(".resource-bar"),
      ...[...document.querySelector(".top-actions").children].filter((node) => !["audio", "help", "pause"].includes(node.id))];
    if (open) {
      if (modal.hidden) modalReturnFocus = document.activeElement;
      for (const node of behind) if (node) node.inert = true;
      modal.hidden = false;
      return;
    }
    const wasOpen = !modal.hidden;
    modal.hidden = true;
    for (const node of behind) if (node) node.inert = false;
    const back = modalReturnFocus;
    modalReturnFocus = null;
    if (!wasOpen) return;
    const target = back && back.isConnected && !back.closest("[hidden]") && !back.disabled ? back : $("pause");
    target?.focus?.({ preventScroll: true });
  }

  function closeModal() {
    // Help opened over the pause menu goes back to it instead of resuming the match.
    if (Z.modalType === "help" && helpOverPause && Z.started && !S.sim.result) { showPause(); return; }
    setModalOpen(false);
    $("modal").classList.remove("help-wide");
    Z.close(!!S.sim.result);
    if (S.audioContext) A.unlockAudio();
    S.keys.clear();
  }

  // WebGL context loss (GPU reset, a long time in the background): hold the match and say so.
  // A lost match in progress comes back on the pause menu, never straight into play.
  let graphicsHeld = false,
    graphicsNoticed = false;

  function graphicsLost() {
    const text = "Graphics were interrupted. Restoring…";
    graphicsHeld = Z.started && !S.sim.result && (!Z.paused || Z.modalType === "pause" || Z.modalType === "help");
    if (A.settingsUI.active || (Z.modalType && !graphicsHeld)) { A.notice(text); graphicsNoticed = true; return; }
    S.touchControls?.reset();
    S.drag = null;
    S.pointer.inside = false;
    S.keys.clear();
    A.clearMode();
    Z.open("graphics");
    $("modal").classList.remove("help-wide");
    setModalOpen(true);
    $("modal-content").innerHTML = `<h2 id="modal-title">Graphics were interrupted.</h2><p role="status">Restoring…</p>`;
  }

  function graphicsRestored() {
    if (graphicsNoticed) A.dismissNotice();
    graphicsNoticed = false;
    if (Z.modalType !== "graphics") return;
    if (graphicsHeld && Z.started && !S.sim.result) showPause();
    else { Z.dismiss(); setModalOpen(false); }
    graphicsHeld = false;
  }

  function showFullscreenHelp(reason) {
    if (S.sim.result || Z.modalType === "graphics") return;
    S.touchControls?.reset();
    S.drag = null;
    S.pointer.inside = false;
    S.keys.clear();
    $("selection-box").style.display = "none";
    Z.open("fullscreen");
    $("modal").classList.remove("help-wide");
    setModalOpen(true);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const message = reason === 'exit'
      ? '<p>Could not leave full screen. Use your browser’s exit control or press Esc on a keyboard.</p>'
      : standalone
        ? '<p>You are already playing in a home-screen web app without the browser bars.</p>'
        : '<p>This browser could not enter full screen.</p><p>On iPhone, open this game in Safari, tap Share → Add to Home Screen, then enable Open as Web App if shown. Launch the game from that new icon.</p>';
    $("modal-content").innerHTML = `<h2 id="modal-title">Full screen</h2>${message}<p>iPhone app-switching gestures still work. Start camera drags away from the screen edges.</p><button class="primary" data-resume>${Z.started ? 'Resume operation' : 'Back'}</button>`;
    $("modal").querySelector('[data-resume]').focus({ preventScroll: true });
  }

  const fullscreen = createFullscreen({
    onUnavailable: showFullscreenHelp,
    onChange: ({ active, pending }) => {
      const label = active ? 'Exit full screen' : 'Full screen';
      for (const button of document.querySelectorAll('[data-fullscreen]')) {
        // Keep keyboard focus during the asynchronous request. The controller
        // ignores duplicate activations while pending; native disabled loses focus.
        button.setAttribute('aria-disabled', String(pending));
        button.setAttribute('aria-pressed', String(active));
        button.title = label;
        button.innerHTML = `${icon(active ? 'collapse' : 'expand')}<span>${label}</span>`;
      }
    },
  });

  function toggleFullscreenFrom(button) {
    // Safari does not focus a button on touch/click by default. Remember a useful
    // return target before opening fallback help, including before the game starts.
    button.focus({ preventScroll: true });
    fullscreen.toggle();
  }

  function togglePause() {
    if (!Z.started || S.sim.result || Z.modalType === "graphics") return;
    if (Z.paused) {
      helpOverPause = false;
      closeModal();
      return;
    }
    showPause();
  }

  let helpOverPause = false;

  function showPause() {
    helpOverPause = false;
    $("modal").classList.remove("help-wide");
    S.touchControls?.reset();
    S.drag = null;
    S.pointer.inside = false;
    Z.open("pause");
    S.keys.clear();
    A.autosave();
    setModalOpen(true);
    $("modal-content").innerHTML =
      `<span class="eyebrow">TACTICAL PAUSE</span><h2 id="modal-title">Hold your position.</h2><p>The battlefield is paused. Take a moment to plan your next move.</p><button class="primary" data-resume>Resume operation ${icon("play")}</button><button class="secondary" data-new-game>New game / choose map</button><button class="secondary" data-restart>Restart this map</button><button class="secondary fullscreen-launch" data-fullscreen></button><button class="pause-settings" data-settings>Settings · army, graphics & sound</button>`;
    fullscreen.refresh();
    $("modal").querySelector("[data-resume]").focus();
  }

  function showHelp() {
    if (S.sim.result || Z.modalType === "graphics") return;
    if (Z.modalType === "help") { closeModal(); return; }
    helpOverPause = Z.modalType === "pause";
    S.touchControls?.reset();
    S.keys.clear();
    Z.open("help");
    setModalOpen(true);
    $("modal-content").innerHTML =
      `<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Your command station.</h2><div class="controls-grid"><span>Select / box select</span><kbd>Left-click / drag</kbd><span>Add to selection / queue order</span><kbd>Shift + click</kbd><span>Move, gather, build, attack</span><kbd>Right-click target</kbd><span>Pan camera</span><kbd>WASD / arrows / middle drag</kbd><span>Zoom</span><kbd>Mouse wheel</kbd><span>Attack-move / stop</span><kbd>F / X</kbd><span>Assign / recall group</span><kbd>Ctrl + 1–9 / 1–9</kbd><span>Focus base / toggle grid</span><kbd>H / G</kbd><span>Pause / cancel</span><kbd>Space / Esc</kbd></div><p class="help-note">Select a Harvester and right-click amber or blue deposits to gather. Select a building to train units; select a Harvester to construct. Click a queued unit to cancel and refund it. Build Supply relays before reaching the population cap.</p><button class="primary" data-resume>Return to the frontier ${icon("arrow")}</button>`;
    $("modal").querySelector("[data-resume]").focus({ preventScroll: true });
    if (!S.touchInput) {
      $("modal-content").querySelector(".controls-grid").outerHTML = HOTKEY_HELP;
      $("modal-content").querySelector(".help-note").remove();
      $("modal").classList.add("help-wide");
      for (const button of $("modal-content").querySelectorAll("[data-group]")) {
        const count = A.groupMembers(button.dataset.group).length;
        if (count) button.dataset.count = count;
      }
    }
    if (S.touchInput) {
      $("modal-content").querySelector(".controls-grid").innerHTML =
        "<span>Select a unit / structure</span><kbd>Tap it</kbd><span>Move / gather / attack</span><kbd>Select, then tap target</kbd><span>Pan the battlefield</span><kbd>Drag one finger</kbd><span>Zoom / pan together</span><kbd>Pinch / two fingers</kbd><span>Select multiple units</span><kbd>Box, then drag</kbd><span>Select your forces</span><kbd>Workers / Army</kbd><span>Queue multiple orders</span><kbd>Enable Queue</kbd><span>Use an ability / set a stance</span><kbd>Select soldiers, then Actions</kbd><span>Place a structure</span><kbd>Tap location → Build here</kbd><span>Change HUD panel</span><kbd>Selection / Actions / Map</kbd>";
      $("modal-content").querySelector(".help-note").textContent =
        "Tap Workers, then tap amber or blue deposits to gather. Tap a building to train units in Actions. Use Move or Attack-move in Selection, then tap a destination. To set a rally point, select a production building and tap ground. Eco graphics reduces rendering cost on phones.";
    }
  }

  let guidePrevious = null;

  const showGuide = createFieldGuide(() => {
    guidePrevious = Z.snapshot(); Z.open('guide'); S.keys.clear();
  }, () => { Z.restore(guidePrevious); S.keys.clear(); }, () => S.sim);

  Object.assign(A, { togglePause, showGuide, closeModal, showHelp, setModalOpen, showPause, graphicsLost, graphicsRestored });
  return function bind() {
    $("modal").addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = [...$("modal").querySelectorAll("button:not([disabled])")].filter((b) => !b.hidden);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!$("modal").contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    $("fullscreen").onclick = (event) => toggleFullscreenFrom(event.currentTarget);

    fullscreen.refresh();

    document.addEventListener('fullscreenchange', A.setLayout);

    document.addEventListener('webkitfullscreenchange', A.setLayout);

    $("pause").onclick = togglePause;

    // Mid-match the logo opens the pause menu (New game lives there); following the link would drop the battle.
    document.querySelector(".brand").addEventListener("click", (event) => {
      if (!Z.started || S.sim.result) return;
      event.preventDefault();
      if (!Z.paused) togglePause();
    });

    $("help").onclick = showHelp;

    $("controls-link").onclick = showHelp;

    $("modal").onclick = (event) => {
      const fullscreenButton = event.target.closest('[data-fullscreen]');
      if (fullscreenButton) { toggleFullscreenFrom(fullscreenButton); return; }
      // Help lists every PC command and control group; running one returns to the battlefield.
      const shortcut = event.target.closest("[data-shortcut]"), group = event.target.closest("[data-group]");
      if ((shortcut || group) && Z.modalType === "help") {
        closeModal();
        if (shortcut) A.runShortcut(shortcut.dataset.shortcut);
        else if (Z.started && !S.sim.result) A.useGroup(group.dataset.group, event.ctrlKey || event.metaKey, event.shiftKey);
        A.updateUI();
        return;
      }
      if (event.target.closest("[data-settings]")) A.settingsUI.open();
      if (event.target.closest("[data-resume]")) closeModal();
      if (event.target.closest("[data-restart]")) A.restart();
      if (event.target.closest("[data-new-game]")) A.newGame();
      if (event.target.closest("[data-next-mission]")) A.nextMissionNow();
      if(event.target.closest("[data-training-campaign]")){S.playMode="campaign";A.newGame();}
    };
  };
}
